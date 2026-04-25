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
    <section className="app-panel p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">STEP4 漫画生成プレビュー</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        4コマとA4縦1ページ漫画を確認し、必要なら修正再生成に進みます。
      </p>

      <p className="mt-4 inline-flex items-baseline gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700">
        <span className="text-zinc-400" aria-hidden>
          ·
        </span>
        生成 {generatedImageCount} 枚 / 概算 {estimatedCost} USD
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-lg border border-zinc-200 bg-zinc-50/30 p-4">
          <h3 className="text-sm font-medium text-zinc-900 sm:text-base">4コマ（1080×1080）</h3>
          <img
            src={result.fourPanelImageDataUrl}
            alt="4コマ漫画"
            className="mt-3 w-full rounded-md border border-zinc-200 bg-white"
          />
          <button
            type="button"
            onClick={() => downloadDataUrl(result.fourPanelImageDataUrl, "manga-4panel.png")}
            className="app-btn-primary mt-3 w-full min-h-10 sm:w-auto"
          >
            4コマをダウンロード
          </button>
        </article>

        <article className="rounded-lg border border-zinc-200 bg-zinc-50/30 p-4">
          <h3 className="text-sm font-medium text-zinc-900 sm:text-base">A4 縦1ページ（2480×3508）</h3>
          <img
            src={result.a4ImageDataUrl}
            alt="A4縦1ページ漫画"
            className="mt-3 w-full rounded-md border border-zinc-200 bg-white"
          />
          <button
            type="button"
            onClick={() => downloadDataUrl(result.a4ImageDataUrl, "manga-a4.png")}
            className="app-btn-primary mt-3 w-full min-h-10 sm:w-auto"
          >
            A4をダウンロード
          </button>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={onBack} className="app-btn-ghost min-h-10">
          STEP3へ戻る
        </button>
        <button
          type="button"
          onClick={onOpenRevise}
          className="app-btn-primary min-h-10"
        >
          修正して再生成へ
        </button>
      </div>
    </section>
  );
}
