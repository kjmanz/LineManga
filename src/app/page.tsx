"use client";

import { useEffect, useMemo, useState } from "react";
import { GenerationSettings } from "@/components/GenerationSettings";
import { InputForm } from "@/components/InputForm";
import { MangaPreview } from "@/components/MangaPreview";
import { PatternCards } from "@/components/PatternCards";
import { RevisePanel } from "@/components/RevisePanel";
import { SummaryView } from "@/components/SummaryView";
import {
  normalizeSummary,
  type CompositionPattern,
  type GenerationMode,
  type GenerationResult,
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

type MangaLayout = "four-panel-square" | "a4-vertical";

type BatchStartResponse = {
  batchName: string;
  requestCount: number;
  pollIntervalMs?: number;
};

type BatchImageResult = {
  patternId: string;
  patternType: CompositionPattern["patternType"];
  patternTitle: string;
  layout: MangaLayout;
  prompt: string;
  imageDataUrl: string;
};

type BatchStatusResponse = {
  done: boolean;
  state: string;
  batchName: string;
  pollIntervalMs?: number;
  error?: string;
  results?: BatchImageResult[];
};

type PatternGenerationMap = Record<string, GenerationResult>;

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

const STEP_LABELS = [
  "1. 投稿文入力",
  "2. 要点確認",
  "3. 構成案選択",
  "4. 漫画プレビュー",
  "5. 修正再生成"
];

const INITIAL_SUMMARY: SummaryResult = normalizeSummary(null);
const OWNER_REFERENCE_PATH = "references/owner.png";
const WIFE_REFERENCE_PATH = "references/wife.png";
const BATCH_POLL_INTERVAL_MS = 5000;
const BATCH_WARNING_MS = 3 * 60 * 1000;
const BATCH_TIMEOUT_MS = 10 * 60 * 1000;
const GENERATION_MODE_STORAGE_KEY = "line-manga-generation-mode";

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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const toSingleGenerationResult = (results: BatchImageResult[], patternId: string): GenerationResult => {
  const fourPanel = results.find(
    (result) => result.patternId === patternId && result.layout === "four-panel-square"
  );
  const a4 = results.find((result) => result.patternId === patternId && result.layout === "a4-vertical");
  if (!fourPanel || !a4) {
    throw new Error(`バッチ結果が不足しています: ${patternId}`);
  }
  return {
    fourPanelImageDataUrl: fourPanel.imageDataUrl,
    a4ImageDataUrl: a4.imageDataUrl,
    fourPanelPrompt: fourPanel.prompt,
    a4Prompt: a4.prompt
  };
};

const toPatternGenerationMap = (results: BatchImageResult[]): PatternGenerationMap => {
  const map: PatternGenerationMap = {};
  const patternIds = Array.from(new Set(results.map((result) => result.patternId)));

  for (const patternId of patternIds) {
    const fourPanel = results.find(
      (result) => result.patternId === patternId && result.layout === "four-panel-square"
    );
    const a4 = results.find((result) => result.patternId === patternId && result.layout === "a4-vertical");
    if (!fourPanel || !a4) {
      continue;
    }
    map[patternId] = {
      fourPanelImageDataUrl: fourPanel.imageDataUrl,
      a4ImageDataUrl: a4.imageDataUrl,
      fourPanelPrompt: fourPanel.prompt,
      a4Prompt: a4.prompt
    };
  }

  return map;
};

const toBatchApiErrorMessage = (error: unknown, endpoint: string, fallback: string) => {
  if (error instanceof HttpError && error.status === 404) {
    return `Worker APIが旧版です。${endpoint} が見つかりません。Workerを最新コードで再デプロイしてください。`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

export default function Home() {
  const [step, setStep] = useState(1);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("batch");
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
  const [batchStatusMessage, setBatchStatusMessage] = useState<string | null>(null);
  const [batchWarningMessage, setBatchWarningMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isApiBaseConfigured = API_BASE_URL.length > 0;

  const selectedPattern = useMemo(
    () => patterns.find((pattern) => pattern.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId]
  );

  const generatedPatternIds = useMemo(() => Object.keys(generationByPatternId), [generationByPatternId]);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(GENERATION_MODE_STORAGE_KEY);
    if (savedMode === "batch" || savedMode === "standard") {
      setGenerationMode(savedMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(GENERATION_MODE_STORAGE_KEY, generationMode);
  }, [generationMode]);

  const clearBatchMessages = () => {
    setBatchStatusMessage(null);
    setBatchWarningMessage(null);
  };

  const handleGenerationModeChange = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setError(null);
    clearBatchMessages();
  };

  const pollBatchUntilDone = async (batchName: string, fallbackIntervalMs = 5000) => {
    const startedAt = Date.now();
    let warned = false;

    for (let attempt = 0; ; attempt += 1) {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= BATCH_TIMEOUT_MS) {
        throw new Error("Batchモードは10分でタイムアウトしました。通常モードに切り替えるか時間をおいて再試行してください。");
      }

      const status = await postJson<BatchStatusResponse>("/api/batch-status", { batchName });
      if (status.done) {
        if (status.error) {
          throw new Error(status.error);
        }
        return status;
      }

      const stateText = status.state || "RUNNING";
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const restSec = `${elapsedSec % 60}`.padStart(2, "0");
      setBatchStatusMessage(
        `バッチ処理中: ${stateText} (${attempt + 1}回目の確認 / 経過 ${elapsedMin}:${restSec})`
      );

      if (!warned && elapsedMs >= BATCH_WARNING_MS) {
        warned = true;
        setBatchWarningMessage("Batch処理が3分を超えました。混雑中の可能性があります。");
      }

      await wait(status.pollIntervalMs ?? fallbackIntervalMs);
    }
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
      clearBatchMessages();
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
      clearBatchMessages();
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
      if (generationMode === "batch") {
        clearBatchMessages();
        setBatchStatusMessage("バッチジョブを作成しています...");
        const started = await postJson<BatchStartResponse>("/api/batch-generate", {
          summary,
          pattern: selectedPattern,
          ownerReferenceDataUrl,
          wifeReferenceDataUrl
        });
        setBatchStatusMessage(`バッチ作成完了: ${started.batchName}`);
        const completed = await pollBatchUntilDone(
          started.batchName,
          started.pollIntervalMs ?? BATCH_POLL_INTERVAL_MS
        );
        const results = completed.results ?? [];
        const generated = toSingleGenerationResult(results, selectedPattern.id);
        setGeneration(generated);
        setGenerationByPatternId({ [selectedPattern.id]: generated });
        setRevisedGeneration(null);
        setGeneratedImageCount((count) => count + results.length);
        clearBatchMessages();
      } else {
        clearBatchMessages();
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
      }
      setStep(4);
    } catch (err) {
      clearBatchMessages();
      setError(
        generationMode === "batch"
          ? toBatchApiErrorMessage(err, "/api/batch-generate", "バッチ生成に失敗しました。")
          : err instanceof Error
          ? err.message
          : "通常生成に失敗しました。"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (patterns.length === 0) {
      setError("構成案がありません。STEP2からやり直してください。");
      return;
    }
    if (generationMode !== "batch") {
      setError("全構成案の一括生成はBatchモードでのみ利用できます。設定でBatchモードを選択してください。");
      return;
    }

    try {
      setError(null);
      clearBatchMessages();
      setBatchStatusMessage("全構成案のバッチジョブを作成しています...");
      setLoading(true);
      const started = await postJson<BatchStartResponse>("/api/batch-generate-all", {
        summary,
        patterns,
        ownerReferenceDataUrl,
        wifeReferenceDataUrl
      });
      setBatchStatusMessage(`全構成案バッチ作成完了: ${started.batchName}`);
      const completed = await pollBatchUntilDone(
        started.batchName,
        started.pollIntervalMs ?? BATCH_POLL_INTERVAL_MS
      );
      const results = completed.results ?? [];
      const map = toPatternGenerationMap(results);
      const generatedIds = Object.keys(map);
      if (generatedIds.length === 0) {
        throw new Error("全構成案バッチの生成結果が空でした。");
      }

      const preferredId =
        (selectedPatternId && map[selectedPatternId] ? selectedPatternId : null) ??
        patterns.find((pattern) => map[pattern.id])?.id ??
        generatedIds[0];

      setGenerationByPatternId(map);
      setSelectedPatternId(preferredId);
      setGeneration(map[preferredId] ?? null);
      setRevisedGeneration(null);
      setGeneratedImageCount((count) => count + results.length);
      clearBatchMessages();
      setStep(4);
    } catch (err) {
      clearBatchMessages();
      setError(
        toBatchApiErrorMessage(err, "/api/batch-generate-all", "全構成案バッチ生成に失敗しました。")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRevise = async (revisionInstruction: string) => {
    if (!selectedPattern || !generation) {
      setError("再生成前にSTEP3で生成してください。");
      return;
    }
    try {
      setError(null);
      setLoading(true);
      if (generationMode === "batch") {
        clearBatchMessages();
        setBatchStatusMessage("修正再生成のバッチジョブを作成しています...");
        const started = await postJson<BatchStartResponse>("/api/batch-revise", {
          summary,
          pattern: selectedPattern,
          ownerReferenceDataUrl,
          wifeReferenceDataUrl,
          revisionInstruction,
          previousFourPanelImageDataUrl: generation.fourPanelImageDataUrl,
          previousA4ImageDataUrl: generation.a4ImageDataUrl
        });
        setBatchStatusMessage(`修正バッチ作成完了: ${started.batchName}`);
        const completed = await pollBatchUntilDone(
          started.batchName,
          started.pollIntervalMs ?? BATCH_POLL_INTERVAL_MS
        );
        const results = completed.results ?? [];
        const revised = toSingleGenerationResult(results, selectedPattern.id);
        setRevisedGeneration(revised);
        setGeneratedImageCount((count) => count + results.length);
        clearBatchMessages();
      } else {
        clearBatchMessages();
        const revised = await postJson<GenerationResult>("/api/revise", {
          summary,
          pattern: selectedPattern,
          ownerReferenceDataUrl,
          wifeReferenceDataUrl,
          revisionInstruction,
          previousFourPanelImageDataUrl: generation.fourPanelImageDataUrl,
          previousA4ImageDataUrl: generation.a4ImageDataUrl
        });
        setRevisedGeneration(revised);
        setGeneratedImageCount((count) => count + 2);
      }
    } catch (err) {
      clearBatchMessages();
      setError(
        generationMode === "batch"
          ? toBatchApiErrorMessage(err, "/api/batch-revise", "修正再生成バッチに失敗しました。")
          : err instanceof Error
          ? err.message
          : "通常再生成に失敗しました。"
      );
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
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-panel backdrop-blur">
        <h1 className="text-2xl font-black text-slate-900 md:text-3xl">LINE投稿 漫画化エージェント</h1>
        <p className="mt-2 text-sm text-slate-600">
          LINE投稿文から「4コマ(1080x1080)」と「A4縦1ページ漫画(2480x3508)」を同時生成します。
        </p>
      </header>
      <GenerationSettings mode={generationMode} loading={loading} onChange={handleGenerationModeChange} />

      <ol className="mt-5 grid gap-2 rounded-xl bg-slate-900 p-3 text-xs text-white md:grid-cols-5 md:text-sm">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isCurrent = step === stepNumber;
          const isCompleted = step > stepNumber;
          return (
            <li
              key={label}
              className={`rounded-lg px-3 py-2 ${
                isCurrent
                  ? "bg-brand-500 font-bold"
                  : isCompleted
                  ? "bg-emerald-500 font-semibold text-emerald-950"
                  : "bg-slate-700"
              }`}
            >
              {label}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {batchStatusMessage ? (
        <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {batchStatusMessage}
        </p>
      ) : null}
      {batchWarningMessage ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {batchWarningMessage}
        </p>
      ) : null}

      {!isApiBaseConfigured ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          `NEXT_PUBLIC_API_BASE_URL` が未設定です。Cloudflare WorkerのURLを設定してください。
        </p>
      ) : null}

      <section className="mt-5 space-y-5">
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
            generationMode={generationMode}
            onSelect={setSelectedPatternId}
            onBack={() => setStep(2)}
            onGenerate={handleGenerate}
            onGenerateAll={handleGenerateAll}
          />
        ) : null}

        {(step === 4 || step === 5) && generatedPatternIds.length > 1 ? (
          <section className="rounded-2xl bg-white p-4 shadow-panel">
            <h3 className="text-sm font-semibold text-slate-800">生成済み構成案</h3>
            <p className="mt-1 text-xs text-slate-600">表示・修正する構成案を選択できます。</p>
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
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-300 bg-white text-slate-700"
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
            mode={generationMode}
            onBack={() => setStep(4)}
            onRevise={handleRevise}
            onAdoptRevised={handleAdoptRevised}
          />
        ) : null}
      </section>
    </main>
  );
}
