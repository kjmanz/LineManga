"use client";

import type { GenerationResult } from "@/lib/types";
import {
  estimateImageCostUsd,
  resolveImageModelOption,
  type ImageModelId
} from "@/lib/imageModels";

type Props = {
  result: GenerationResult;
  imageModel: ImageModelId;
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

export function MangaPreview({
  result,
  imageModel,
  generatedImageCount,
  onBack,
  onOpenRevise
}: Props) {
  const modelOption = resolveImageModelOption(imageModel);
  const estimatedCost = estimateImageCostUsd(imageModel, generatedImageCount).toFixed(2);
  const hasFourPanel = Boolean(result.fourPanelImageDataUrl);
  const hasA4 = Boolean(result.a4ImageDataUrl);
  const hasAnyImage = hasFourPanel || hasA4;

  return (
    <section className="app-panel overflow-hidden p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Step 4</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">生成結果を確認</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            4コマとA4縦を確認し、ダウンロードするか、修正して再生成できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            {modelOption.label}
          </p>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            生成 {generatedImageCount} 枚 / 概算 ${estimatedCost}
          </p>
        </div>
      </div>

      {!hasAnyImage ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">画像データが見つかりません</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            前回のセッションでは画像が保存されていませんでした。「構成案に戻る」から再生成してください。今後は画像も自動保存されます。
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">4コマ（正方形）</h3>
            <span className="text-[11px] text-slate-500">1080×1080</span>
          </div>
          <div className="p-3">
            {hasFourPanel ? (
              <img
                src={result.fourPanelImageDataUrl}
                alt="4コマ漫画"
                className="w-full rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
                画像なし
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={() => downloadDataUrl(result.fourPanelImageDataUrl, "manga-4panel.png")}
              disabled={!hasFourPanel}
              className="app-btn-primary w-full min-h-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              4コマをダウンロード
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">A4 縦1ページ</h3>
            <span className="text-[11px] text-slate-500">2480×3508</span>
          </div>
          <div className="p-3">
            {hasA4 ? (
              <img
                src={result.a4ImageDataUrl}
                alt="A4縦1ページ漫画"
                className="w-full rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
                画像なし
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-4 py-3">
            <button
              type="button"
              onClick={() => downloadDataUrl(result.a4ImageDataUrl, "manga-a4.png")}
              disabled={!hasA4}
              className="app-btn-primary w-full min-h-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              A4をダウンロード
            </button>
          </div>
        </article>
      </div>

      <div className="app-sticky-actions">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onBack} className="app-btn-ghost">
            構成案に戻る
          </button>
          <button type="button" onClick={onOpenRevise} disabled={!hasAnyImage} className="app-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            修正して再生成へ
          </button>
        </div>
      </div>
    </section>
  );
}
