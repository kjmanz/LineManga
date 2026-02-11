"use client";

import { useEffect, useMemo, useState } from "react";
import { InputForm } from "@/components/InputForm";
import { MangaPreview } from "@/components/MangaPreview";
import { PatternCards } from "@/components/PatternCards";
import { RevisePanel } from "@/components/RevisePanel";
import { SummaryView } from "@/components/SummaryView";
import { normalizeSummary, type CompositionPattern, type GenerationResult, type SummaryResult } from "@/lib/types";

type ApiError = {
  error?: string;
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
    throw new Error(data.error ?? "API呼び出しに失敗しました。");
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
  const [revisedGeneration, setRevisedGeneration] = useState<GenerationResult | null>(null);
  const [ownerReferenceDataUrl, setOwnerReferenceDataUrl] = useState<string | null>(null);
  const [wifeReferenceDataUrl, setWifeReferenceDataUrl] = useState<string | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [generatedImageCount, setGeneratedImageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isApiBaseConfigured = API_BASE_URL.length > 0;

  const selectedPattern = useMemo(
    () => patterns.find((pattern) => pattern.id === selectedPatternId) ?? null,
    [patterns, selectedPatternId]
  );

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
      const data = await postJson<GenerationResult>("/api/generate", {
        summary,
        pattern: selectedPattern,
        ownerReferenceDataUrl,
        wifeReferenceDataUrl
      });
      setGeneration(data);
      setRevisedGeneration(null);
      setGeneratedImageCount((count) => count + 2);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "漫画生成に失敗しました。");
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
      const data = await postJson<GenerationResult>("/api/revise", {
        summary,
        pattern: selectedPattern,
        ownerReferenceDataUrl,
        wifeReferenceDataUrl,
        revisionInstruction,
        previousFourPanelImageDataUrl: generation.fourPanelImageDataUrl,
        previousA4ImageDataUrl: generation.a4ImageDataUrl
      });
      setRevisedGeneration(data);
      setGeneratedImageCount((count) => count + 2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "修正再生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleAdoptRevised = () => {
    if (!revisedGeneration) {
      return;
    }
    setGeneration(revisedGeneration);
    setRevisedGeneration(null);
    setStep(4);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-panel backdrop-blur">
        <h1 className="text-2xl font-black text-slate-900 md:text-3xl">LINE投稿 漫画化エージェント</h1>
        <p className="mt-2 text-sm text-slate-600">
          LINE投稿文から「4コマ(1080x1080)」と「A4縦(2480x3508)」を同時生成します。
        </p>
      </header>

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
            onSelect={setSelectedPatternId}
            onBack={() => setStep(2)}
            onGenerate={handleGenerate}
          />
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
    </main>
  );
}
