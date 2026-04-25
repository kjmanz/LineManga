"use client";

import type { GenerationResult } from "@/lib/types";

type Props = {
  result: GenerationResult;
  generatedImageCount: number;
  onBack: () => void;
  onOpenRevise: () => void;
};

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
};

export function MangaPreview({ result, generatedImageCount, onBack, onOpenRevise }: Props) {
  const estimatedCost = (generatedImageCount * 0.15).toFixed(2);

  return (
    <section className="app-panel p-6">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">STEP4 漫画生成プレビュー</h2>
      <p className="mt-2 text-sm text-slate-600">
        4コマとA4縦1ページ漫画を確認し、必要なら修正再生成に進みます。
      </p>

      <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm">
        <span className="font-mono text-amber-600" aria-hidden>
          $
        </span>
        画像生成 {generatedImageCount} 枚 / 概算 {estimatedCost} USD
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">正方形4コマ (1080×1080)</h3>
          <img
            src={result.fourPanelImageDataUrl}
            alt="4コマ漫画"
            className="mt-3 w-full rounded-lg border border-slate-200/80 bg-white shadow-inner shadow-slate-900/5"
          />
          <button
            type="button"
            onClick={() => downloadDataUrl(result.fourPanelImageDataUrl, "manga-4panel.png")}
            className="mt-3 w-full min-h-10 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/15 transition hover:bg-brand-700 sm:w-auto"
          >
            4コマをダウンロード
          </button>
        </article>

        <article className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">A4縦1ページ (2480×3508)</h3>
          <img
            src={result.a4ImageDataUrl}
            alt="A4縦1ページ漫画"
            className="mt-3 w-full rounded-lg border border-slate-200/80 bg-white shadow-inner shadow-slate-900/5"
          />
          <button
            type="button"
            onClick={() => downloadDataUrl(result.a4ImageDataUrl, "manga-a4.png")}
            className="mt-3 w-full min-h-10 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/15 transition hover:bg-brand-700 sm:w-auto"
          >
            A4縦1ページをダウンロード
          </button>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
        >
          STEP3へ戻る
        </button>
        <button
          type="button"
          onClick={onOpenRevise}
          className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-slate-900/25 transition hover:bg-slate-800"
        >
          修正して再生成へ
        </button>
      </div>
    </section>
  );
}
