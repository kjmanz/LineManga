"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InputForm } from "@/components/InputForm";
import { MangaPreview } from "@/components/MangaPreview";
import { PatternCards } from "@/components/PatternCards";
import { RevisePanel } from "@/components/RevisePanel";
import { Stepper } from "@/components/Stepper";
import { SummaryView } from "@/components/SummaryView";
import {
  normalizeSummary,
  type CompositionPattern,
  type GenerationResult,
  type ImageEditInstruction,
  type ImageEditLayout,
  type ImageEditMode,
  type SummaryResult
} from "@/lib/types";

type ApiError = {
  error?: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

type PatternGenerationMap = Record<string, GenerationResult>;
type ReviseTarget = ImageEditLayout | "both";

type RevisePayload = {
  revisionInstruction: string;
  imageEdits: ImageEditInstruction[];
  editMode: ImageEditMode;
  preserveOutsideMask: boolean;
  maskFeatherPx: number;
  fourPanelMaskImageDataUrl?: string;
  a4MaskImageDataUrl?: string;
  reviseTarget: ReviseTarget;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

const resolveApiUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const WORKFLOW_STEPS = [
  { label: "1. 投稿文入力", short: "投稿" },
  { label: "2. 要点確認", short: "要点" },
  { label: "3. 構成案選択", short: "構成" },
  { label: "4. 漫画プレビュー", short: "プレビュー" },
  { label: "5. 修正再生成", short: "修正" }
] as const;

const INITIAL_SUMMARY: SummaryResult = normalizeSummary(null);
const OWNER_REFERENCE_PATH = "references/owner.png";
const WIFE_REFERENCE_PATH = "references/wife.png";
const AUTOSAVE_STORAGE_KEY = "line-manga-autosave";

type AutosaveState = {
  step: number;
  postText: string;
  summary: SummaryResult;
  patterns: CompositionPattern[];
  selectedPatternId: string | null;
  generation: GenerationResult | null;
  generationByPatternId: PatternGenerationMap;
  revisedGeneration: GenerationResult | null;
  generatedImageCount: number;
};

const saveAutosaveState = (state: AutosaveState) => {
  try {
    const stateToSave: AutosaveState = {
      ...state,
      generation: state.generation
        ? {
            ...state.generation,
            fourPanelImageDataUrl: "",
            a4ImageDataUrl: ""
          }
        : null,
      generationByPatternId: Object.fromEntries(
        Object.entries(state.generationByPatternId).map(([id, gen]) => [
          id,
          {
            ...gen,
            fourPanelImageDataUrl: "",
            a4ImageDataUrl: ""
          }
        ])
      ),
      revisedGeneration: state.revisedGeneration
        ? {
            ...state.revisedGeneration,
            fourPanelImageDataUrl: "",
            a4ImageDataUrl: ""
          }
        : null
    };
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(stateToSave));
  } catch {
    // ignore quota/storage errors
  }
};

const loadAutosaveState = (): AutosaveState | null => {
  try {
    const saved = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!saved) {
      return null;
    }
    const parsed = JSON.parse(saved) as AutosaveState;
    if (typeof parsed.step !== "number" || parsed.step < 1 || parsed.step > 5) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const clearAutosaveState = () => {
  try {
    window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("固定参照画像の読み込みに失敗しました。"));
    reader.readAsDataURL(blob);
  });

const imagePathToDataUrl = async (path: string) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`固定参照画像の取得に失敗しました: ${path}`);
  }
  return blobToDataUrl(await response.blob());
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(resolveApiUrl(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as T & ApiError;
  if (!response.ok) {
    throw new HttpError(response.status, data.error ?? `API呼び出しに失敗しました。(${response.status})`);
  }
  return data;
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [postText, setPostText] = useState("");
  const [summary, setSummary] = useState<SummaryResult>(INITIAL_SUMMARY);
  const [patterns, setPatterns] = useState<CompositionPattern[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [generationByPatternId, setGenerationByPatternId] = useState<PatternGenerationMap>({});
  const [revisedGeneration, setRevisedGeneration] = useState<GenerationResult | null>(null);
  const [ownerReferenceDataUrl, setOwnerReferenceDataUrl] = useState<string | null>(null);
  const [wifeReferenceDataUrl, setWifeReferenceDataUrl] = useState<string | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [generatedImageCount, setGeneratedImageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [autosaveLoaded, setAutosaveLoaded] = useState(false);
  const isApiBaseConfigured = API_BASE_URL.length > 0;

  const selectedPattern = useMemo(
    () => patterns.find((pattern) => pattern.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId]
  );

  const generatedPatternIds = useMemo(() => Object.keys(generationByPatternId), [generationByPatternId]);

  useEffect(() => {
    const saved = loadAutosaveState();
    if (saved) {
      setStep(saved.step);
      setPostText(saved.postText);
      setSummary(saved.summary);
      setPatterns(saved.patterns);
      setSelectedPatternId(saved.selectedPatternId);
      setGeneratedImageCount(saved.generatedImageCount);
    }
    setAutosaveLoaded(true);
  }, []);

  useEffect(() => {
    if (!autosaveLoaded) {
      return;
    }
    saveAutosaveState({
      step,
      postText,
      summary,
      patterns,
      selectedPatternId,
      generation,
      generationByPatternId,
      revisedGeneration,
      generatedImageCount
    });
  }, [
    autosaveLoaded,
    generatedImageCount,
    generation,
    generationByPatternId,
    patterns,
    postText,
    revisedGeneration,
    selectedPatternId,
    step,
    summary
  ]);

  const handleReset = () => {
    clearAutosaveState();
    setStep(1);
    setPostText("");
    setSummary(INITIAL_SUMMARY);
    setPatterns([]);
    setSelectedPatternId(null);
    setGeneration(null);
    setGenerationByPatternId({});
    setRevisedGeneration(null);
    setGeneratedImageCount(0);
    setError(null);
    setShowResetDialog(false);
  };

  const selectGeneratedPattern = (patternId: string) => {
    const generated = generationByPatternId[patternId];
    if (!generated) {
      return;
    }
    setSelectedPatternId(patternId);
    setGeneration(generated);
    setRevisedGeneration(null);
  };

  useEffect(() => {
    let cancelled = false;

    const loadFixedReferences = async () => {
      try {
        setReferenceError(null);
        setReferenceLoading(true);
        const [ownerDataUrl, wifeDataUrl] = await Promise.all([
          imagePathToDataUrl(OWNER_REFERENCE_PATH),
          imagePathToDataUrl(WIFE_REFERENCE_PATH)
        ]);
        if (cancelled) {
          return;
        }
        setOwnerReferenceDataUrl(ownerDataUrl);
        setWifeReferenceDataUrl(wifeDataUrl);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setOwnerReferenceDataUrl(null);
        setWifeReferenceDataUrl(null);
        setReferenceError(err instanceof Error ? err.message : "固定参照画像の読込に失敗しました。");
      } finally {
        if (!cancelled) {
          setReferenceLoading(false);
        }
      }
    };

    void loadFixedReferences();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSummarize = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await postJson<{ summary: SummaryResult }>("/api/summarize", {
        postText
      });
      setSummary(data.summary);
      setPatterns([]);
      setSelectedPatternId(null);
      setGeneration(null);
      setGenerationByPatternId({});
      setRevisedGeneration(null);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "要点抽出に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleCompose = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await postJson<{ patterns: CompositionPattern[] }>("/api/compose", {
        summary
      });
      setPatterns(data.patterns);
      setSelectedPatternId(data.patterns[0]?.id ?? null);
      setGeneration(null);
      setGenerationByPatternId({});
      setRevisedGeneration(null);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "構成案生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPattern) {
      setError("構成案を選択してください。");
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const generated = await postJson<GenerationResult>("/api/generate", {
        summary,
        pattern: selectedPattern,
        ownerReferenceDataUrl,
        wifeReferenceDataUrl
      });
      setGeneration(generated);
      setGenerationByPatternId({ [selectedPattern.id]: generated });
      setRevisedGeneration(null);
      setGeneratedImageCount((count) => count + 2);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (patterns.length === 0) {
      setError("構成案がありません。STEP2からやり直してください。");
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const map: PatternGenerationMap = {};
      let generatedCount = 0;

      for (const pattern of patterns) {
        const generated = await postJson<GenerationResult>("/api/generate", {
          summary,
          pattern,
          ownerReferenceDataUrl,
          wifeReferenceDataUrl
        });
        map[pattern.id] = generated;
        generatedCount += 2;
      }

      const generatedIds = Object.keys(map);
      if (generatedIds.length === 0) {
        throw new Error("全構成案の生成結果が空でした。");
      }

      const preferredId =
        (selectedPatternId && map[selectedPatternId] ? selectedPatternId : null) ??
        patterns.find((pattern) => map[pattern.id])?.id ??
        generatedIds[0];

      setGenerationByPatternId(map);
      setSelectedPatternId(preferredId);
      setGeneration(map[preferredId] ?? null);
      setRevisedGeneration(null);
      setGeneratedImageCount((count) => count + generatedCount);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "全構成案生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleRevise = async ({
    revisionInstruction,
    imageEdits,
    editMode,
    preserveOutsideMask,
    maskFeatherPx,
    fourPanelMaskImageDataUrl,
    a4MaskImageDataUrl,
    reviseTarget
  }: RevisePayload) => {
    if (!selectedPattern || !generation) {
      setError("再生成前にSTEP3で生成してください。");
      return;
    }

    const normalizedInstruction = revisionInstruction.trim();
    if (!normalizedInstruction && imageEdits.length === 0) {
      setError("修正指示か編集ポイントを1つ以上入力してください。");
      return;
    }

    const reviseTargets: ImageEditLayout[] =
      reviseTarget === "both" ? ["four-panel-square", "a4-vertical"] : [reviseTarget];

    try {
      setError(null);
      setLoading(true);
      const revised = await postJson<GenerationResult>("/api/revise", {
        summary,
        pattern: selectedPattern,
        ownerReferenceDataUrl,
        wifeReferenceDataUrl,
        revisionInstruction: normalizedInstruction,
        imageEdits,
        editMode,
        preserveOutsideMask,
        maskFeatherPx,
        fourPanelMaskImageDataUrl,
        a4MaskImageDataUrl,
        reviseTargets,
        previousFourPanelImageDataUrl: generation.fourPanelImageDataUrl,
        previousA4ImageDataUrl: generation.a4ImageDataUrl,
        previousFourPanelPrompt: generation.fourPanelPrompt,
        previousA4Prompt: generation.a4Prompt
      });
      setRevisedGeneration(revised);
      setGeneratedImageCount((count) => count + reviseTargets.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleAdoptRevised = () => {
    if (!revisedGeneration || !selectedPatternId) {
      return;
    }
    setGeneration(revisedGeneration);
    setGenerationByPatternId((current) => ({
      ...current,
      [selectedPatternId]: revisedGeneration
    }));
    setRevisedGeneration(null);
    setStep(4);
  };

  return (
    <main className="min-h-screen px-4 py-8 pb-12 md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="app-panel flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 border-l-[3px] border-zinc-900 pl-5">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">LINE Manga Studio</p>
            <h1 className="text-balance mt-1 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              LINE投稿 漫画化エージェント
            </h1>
            <p className="text-pretty mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">
              投稿文から「4コマ (1080×1080)」と「A4 縦1ページ (2480×3508)」を同時に生成し、必要なら指示とマスクで微調整します。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="app-btn-ghost min-h-10 shrink-0 self-start px-4 py-2 text-sm disabled:cursor-not-allowed"
            disabled={step === 1 && !postText}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-slate-500"
            >
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">新規作成</span>
            <span className="sm:hidden">新規</span>
          </button>
        </header>

      <ConfirmDialog
        open={showResetDialog}
        title="新規作成の確認"
        message="入力内容と生成履歴をすべて削除して新規作成しますか？"
        confirmLabel="新規作成"
        cancelLabel="キャンセル"
        onConfirm={handleReset}
        onCancel={() => setShowResetDialog(false)}
      />

        <Stepper current={step} items={WORKFLOW_STEPS} />

        <div className="mt-4 space-y-3">
          {error ? (
            <p className="flex gap-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <span className="mt-0.5 shrink-0 text-rose-500" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span className="min-w-0 leading-relaxed">{error}</span>
            </p>
          ) : null}
          {!isApiBaseConfigured ? (
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <code className="rounded bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800">
                NEXT_PUBLIC_API_BASE_URL
              </code>
              <span>が未設定です。Cloudflare Worker の URL を設定してください。</span>
            </p>
          ) : null}
        </div>

        <section className="mt-6 space-y-5">
          {step === 1 ? (
            <InputForm
              postText={postText}
              ownerReferenceDataUrl={ownerReferenceDataUrl}
              wifeReferenceDataUrl={wifeReferenceDataUrl}
              referenceLoading={referenceLoading}
              referenceError={referenceError}
              loading={loading}
              onPostTextChange={setPostText}
              onSubmit={handleSummarize}
            />
          ) : null}

          {step === 2 ? (
            <SummaryView
              summary={summary}
              loading={loading}
              onChange={setSummary}
              onBack={() => setStep(1)}
              onNext={handleCompose}
            />
          ) : null}

          {step === 3 ? (
            <PatternCards
              patterns={patterns}
              selectedPatternId={selectedPatternId}
              loading={loading}
              onSelect={setSelectedPatternId}
              onBack={() => setStep(2)}
              onGenerate={handleGenerate}
              onGenerateAll={handleGenerateAll}
            />
          ) : null}

          {(step === 4 || step === 5) && generatedPatternIds.length > 1 ? (
            <section className="app-panel p-4 sm:p-5">
              <h3 className="text-sm font-medium text-zinc-900">生成済み構成案</h3>
              <p className="mt-1 text-xs text-zinc-600">表示・修正する構成案を選択できます。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {patterns
                  .filter((pattern) => generationByPatternId[pattern.id])
                  .map((pattern) => {
                    const selected = pattern.id === selectedPatternId;
                    return (
                      <button
                        key={pattern.id}
                        type="button"
                        onClick={() => selectGeneratedPattern(pattern.id)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                          selected
                            ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        {pattern.patternType} / {pattern.title}
                      </button>
                    );
                  })}
              </div>
            </section>
          ) : null}

          {step === 4 && generation ? (
            <MangaPreview
              result={generation}
              generatedImageCount={generatedImageCount}
              onBack={() => setStep(3)}
              onOpenRevise={() => setStep(5)}
            />
          ) : null}

          {step === 5 && generation ? (
            <RevisePanel
              previousResult={generation}
              revisedResult={revisedGeneration}
              loading={loading}
              onBack={() => setStep(4)}
              onRevise={handleRevise}
              onAdoptRevised={handleAdoptRevised}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
