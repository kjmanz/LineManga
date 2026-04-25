"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GenerationSettings } from "@/components/GenerationSettings";
import { InputForm } from "@/components/InputForm";
import { MangaPreview } from "@/components/MangaPreview";
import { PatternCards } from "@/components/PatternCards";
import { RevisePanel } from "@/components/RevisePanel";
import { Stepper } from "@/components/Stepper";
import { SummaryView } from "@/components/SummaryView";
import {
  normalizeSummary,
  type CompositionPattern,
  type GenerationMode,
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

type BatchJobStart = {
  batchName: string;
  requestCount: number;
  patternIds?: string[];
};

type BatchStartResponse = {
  batchName?: string | null;
  batchJobs?: BatchJobStart[];
  requestCount: number;
  pollIntervalMs?: number;
};

type BatchImageResult = {
  patternId: string;
  patternType: CompositionPattern["patternType"];
  patternTitle: string;
  layout: ImageEditLayout;
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
const BATCH_POLL_INTERVAL_MS = 5000;
const BATCH_WARNING_MS = 3 * 60 * 1000;
const BATCH_TIMEOUT_MS = 10 * 60 * 1000;
const GENERATION_MODE_STORAGE_KEY = "line-manga-generation-mode";
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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const toGenerationResultFromBatch = (
  results: BatchImageResult[],
  patternId: string,
  fallback?: GenerationResult
): GenerationResult => {
  const fourPanel = results.find(
    (result) => result.patternId === patternId && result.layout === "four-panel-square"
  );
  const a4 = results.find((result) => result.patternId === patternId && result.layout === "a4-vertical");

  const fourPanelImageDataUrl = fourPanel?.imageDataUrl ?? fallback?.fourPanelImageDataUrl;
  const a4ImageDataUrl = a4?.imageDataUrl ?? fallback?.a4ImageDataUrl;
  const fourPanelPrompt = fourPanel?.prompt ?? fallback?.fourPanelPrompt;
  const a4Prompt = a4?.prompt ?? fallback?.a4Prompt;

  if (!fourPanelImageDataUrl || !a4ImageDataUrl || !fourPanelPrompt || !a4Prompt) {
    throw new Error(`バッチ結果が不足しています: ${patternId}`);
  }

  return {
    fourPanelImageDataUrl,
    a4ImageDataUrl,
    fourPanelPrompt,
    a4Prompt
  };
};

const toPatternGenerationMap = (results: BatchImageResult[]): PatternGenerationMap => {
  const map: PatternGenerationMap = {};
  const patternIds = Array.from(new Set(results.map((result) => result.patternId)));

  for (const patternId of patternIds) {
    try {
      map[patternId] = toGenerationResultFromBatch(results, patternId);
    } catch {
      // ignore incomplete pattern results
    }
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
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [autosaveLoaded, setAutosaveLoaded] = useState(false);
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

  const clearBatchMessages = () => {
    setBatchStatusMessage(null);
    setBatchWarningMessage(null);
  };

  const handleGenerationModeChange = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setError(null);
    clearBatchMessages();
  };

  const toBatchJobs = (started: BatchStartResponse): BatchJobStart[] => {
    const jobs = Array.isArray(started.batchJobs) ? started.batchJobs : [];
    if (jobs.length > 0) {
      return jobs
        .filter((job) => typeof job.batchName === "string" && job.batchName.trim().length > 0)
        .map((job) => ({
          ...job,
          batchName: job.batchName.trim()
        }));
    }

    const singleBatchName = started.batchName?.trim();
    if (!singleBatchName) {
      return [];
    }

    return [
      {
        batchName: singleBatchName,
        requestCount: started.requestCount
      }
    ];
  };

  const pollBatchJobsUntilDone = async (
    batchJobs: BatchJobStart[],
    fallbackIntervalMs = BATCH_POLL_INTERVAL_MS
  ) => {
    if (batchJobs.length === 0) {
      throw new Error("バッチジョブ情報が不足しています。Workerを最新にデプロイしてください。");
    }

    const startedAt = Date.now();
    let warned = false;
    const pending = new Map(batchJobs.map((job) => [job.batchName, job] as const));
    const completed = new Map<string, BatchStatusResponse>();

    for (let attempt = 0; ; attempt += 1) {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= BATCH_TIMEOUT_MS) {
        throw new Error(
          "Batchモードは10分でタイムアウトしました。通常モードに切り替えるか時間をおいて再試行してください。"
        );
      }

      const pendingBatchNames = Array.from(pending.keys());
      const statuses = await Promise.all(
        pendingBatchNames.map((batchName) =>
          postJson<BatchStatusResponse>("/api/batch-status", {
            batchName
          })
        )
      );

      let pollIntervalMs = fallbackIntervalMs;
      const stateCounts = new Map<string, number>();

      for (let index = 0; index < statuses.length; index += 1) {
        const status = statuses[index];
        const batchName = pendingBatchNames[index];
        if (status.done) {
          if (status.error) {
            throw new Error(`${batchName}: ${status.error}`);
          }
          completed.set(batchName, status);
          pending.delete(batchName);
          continue;
        }

        const stateText = status.state || "RUNNING";
        stateCounts.set(stateText, (stateCounts.get(stateText) ?? 0) + 1);
        if (typeof status.pollIntervalMs === "number" && status.pollIntervalMs > 0) {
          pollIntervalMs = Math.min(pollIntervalMs, status.pollIntervalMs);
        }
      }

      if (completed.size === batchJobs.length) {
        return batchJobs
          .map((job) => completed.get(job.batchName))
          .filter((status): status is BatchStatusResponse => Boolean(status));
      }

      const elapsedSec = Math.floor(elapsedMs / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);
      const restSec = `${elapsedSec % 60}`.padStart(2, "0");
      const stateText =
        stateCounts.size > 0
          ? Array.from(stateCounts.entries())
              .map(([state, count]) => `${state}x${count}`)
              .join(", ")
          : "RUNNING";

      setBatchStatusMessage(
        `バッチ処理中: ${completed.size}/${batchJobs.length}完了 / ${stateText} (${attempt + 1}回目の確認 / 経過 ${elapsedMin}:${restSec})`
      );

      if (!warned && elapsedMs >= BATCH_WARNING_MS) {
        warned = true;
        setBatchWarningMessage("Batch処理が3分を超えました。混雑中の可能性があります。");
      }

      await wait(pollIntervalMs);
    }
  };

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
    clearBatchMessages();
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
        const batchJobs = toBatchJobs(started);
        setBatchStatusMessage(`バッチ作成完了: ${batchJobs.length}ジョブ`);
        const completedStatuses = await pollBatchJobsUntilDone(
          batchJobs,
          started.pollIntervalMs ?? BATCH_POLL_INTERVAL_MS
        );
        const results = completedStatuses.flatMap((status) => status.results ?? []);
        const generated = toGenerationResultFromBatch(results, selectedPattern.id);
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

    try {
      setError(null);
      setLoading(true);
      if (generationMode === "batch") {
        clearBatchMessages();
        setBatchStatusMessage("全構成案のバッチジョブを作成しています...");
        const started = await postJson<BatchStartResponse>("/api/batch-generate-all", {
          summary,
          patterns,
          ownerReferenceDataUrl,
          wifeReferenceDataUrl
        });
        const batchJobs = toBatchJobs(started);
        setBatchStatusMessage(`全構成案バッチ作成完了: ${batchJobs.length}ジョブ`);
        const completedStatuses = await pollBatchJobsUntilDone(
          batchJobs,
          started.pollIntervalMs ?? BATCH_POLL_INTERVAL_MS
        );
        const results = completedStatuses.flatMap((status) => status.results ?? []);
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
      } else {
        clearBatchMessages();
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
      }
    } catch (err) {
      clearBatchMessages();
      setError(
        generationMode === "batch"
          ? toBatchApiErrorMessage(err, "/api/batch-generate-all", "全構成案バッチ生成に失敗しました。")
          : err instanceof Error
          ? err.message
          : "全構成案生成に失敗しました。"
      );
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
      if (generationMode === "batch") {
        clearBatchMessages();
        setBatchStatusMessage("修正再生成のバッチジョブを作成しています...");
        const started = await postJson<BatchStartResponse>("/api/batch-revise", {
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
        const batchJobs = toBatchJobs(started);
        setBatchStatusMessage(`修正バッチ作成完了: ${batchJobs.length}ジョブ`);
        const completedStatuses = await pollBatchJobsUntilDone(
          batchJobs,
          started.pollIntervalMs ?? BATCH_POLL_INTERVAL_MS
        );
        const results = completedStatuses.flatMap((status) => status.results ?? []);
        const revised = toGenerationResultFromBatch(results, selectedPattern.id, generation);
        setRevisedGeneration(revised);
        setGeneratedImageCount((count) => count + reviseTargets.length);
        clearBatchMessages();
      } else {
        clearBatchMessages();
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
    <main className="min-h-screen px-4 py-6 pb-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="app-panel flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="flex gap-4 sm:items-start">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-sm font-black text-white shadow-lg shadow-brand-500/20 sm:h-14 sm:w-14 sm:text-base"
              aria-hidden
            >
              LM
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600/90 sm:text-xs">
                LINE Manga Studio
              </p>
              <h1 className="text-balance text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                LINE投稿 漫画化エージェント
              </h1>
              <p className="text-pretty mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                投稿文から「4コマ (1080×1080)」と「A4 縦1ページ (2480×3508)」を同時に生成し、必要なら指示とマスクで微調整します。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowResetDialog(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
        <GenerationSettings mode={generationMode} loading={loading} onChange={handleGenerationModeChange} />

        <Stepper current={step} items={WORKFLOW_STEPS} />

        <div className="mt-4 space-y-3">
          {error ? (
            <p className="flex gap-3 rounded-xl border border-rose-200/90 bg-rose-50/95 px-4 py-3 text-sm text-rose-800 shadow-sm">
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
          {batchStatusMessage ? (
            <p className="flex gap-3 rounded-xl border border-sky-200/90 bg-sky-50/95 px-4 py-3 text-sm text-sky-900 shadow-sm">
              <span className="mt-0.5 shrink-0 text-sky-500" aria-hidden>
                <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
              <span className="min-w-0 font-medium leading-relaxed">{batchStatusMessage}</span>
            </p>
          ) : null}
          {batchWarningMessage ? (
            <p className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <span className="mt-0.5 shrink-0 text-amber-500" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0v4a1 1 0 102 0v-4zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <span className="min-w-0 leading-relaxed">{batchWarningMessage}</span>
            </p>
          ) : null}
          {!isApiBaseConfigured ? (
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <code className="rounded-md bg-amber-100/90 px-1.5 py-0.5 font-mono text-[0.85em] text-amber-950">
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
              generationMode={generationMode}
              onSelect={setSelectedPatternId}
              onBack={() => setStep(2)}
              onGenerate={handleGenerate}
              onGenerateAll={handleGenerateAll}
            />
          ) : null}

          {(step === 4 || step === 5) && generatedPatternIds.length > 1 ? (
            <section className="app-panel p-4 sm:p-5">
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
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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
