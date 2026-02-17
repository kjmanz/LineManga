"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";
import type { GenerationMode, GenerationResult } from "@/lib/types";

type Props = {
  previousResult: GenerationResult;
  revisedResult: GenerationResult | null;
  loading: boolean;
  mode: GenerationMode;
  onBack: () => void;
  onRevise: (instruction: string) => void;
  onAdoptRevised: () => void;
};

export function RevisePanel({
  previousResult,
  revisedResult,
  loading,
  mode,
  onBack,
  onRevise,
  onAdoptRevised
}: Props) {
  const [instruction, setInstruction] = useState("");
  const isBatchMode = mode === "batch";

  return (
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-bold text-slate-900">STEP5 修正再生成</h2>
      <p className="mt-2 text-sm text-slate-600">
        修正点をテキストで入力すると、4コマとA4を再生成して比較できます。
      </p>

      <textarea
        className="mt-4 h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
        placeholder="例: 2コマ目のセリフを短く、4コマ目をやさしいオチに変更"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          STEP4へ戻る
        </button>
        <button
          type="button"
          disabled={loading || !instruction.trim()}
          onClick={() => onRevise(instruction)}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>{isBatchMode ? "バッチ再生成中..." : "通常再生成中..."}</span>
            </>
          ) : (
            <span>{isBatchMode ? "修正してバッチ再生成" : "修正して通常再生成"}</span>
          )}
        </button>
        {revisedResult ? (
          <button
            type="button"
            onClick={onAdoptRevised}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            修正版を採用してSTEP4へ
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">前回 4コマ</h3>
          <img src={previousResult.fourPanelImageDataUrl} alt="前回4コマ" className="mt-2 rounded-lg border" />
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">修正版 4コマ</h3>
          {revisedResult ? (
            <img src={revisedResult.fourPanelImageDataUrl} alt="修正版4コマ" className="mt-2 rounded-lg border" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">まだ再生成していません。</p>
          )}
        </article>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">前回 A4</h3>
          <img src={previousResult.a4ImageDataUrl} alt="前回A4" className="mt-2 rounded-lg border" />
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">修正版 A4</h3>
          {revisedResult ? (
            <img src={revisedResult.a4ImageDataUrl} alt="修正版A4" className="mt-2 rounded-lg border" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">まだ再生成していません。</p>
          )}
        </article>
      </div>
    </section>
  );
}
