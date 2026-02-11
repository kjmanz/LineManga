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
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-bold text-slate-900">STEP4 漫画生成プレビュー</h2>
      <p className="mt-2 text-sm text-slate-600">
        4コマとA4縦1ページ漫画を確認し、必要なら修正再生成に進みます。
      </p>

      <p className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        バッチ生成枚数: {generatedImageCount}枚 / 概算コスト: ${estimatedCost}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">正方形4コマ (1080x1080)</h3>
          <img src={result.fourPanelImageDataUrl} alt="4コマ漫画" className="mt-3 w-full rounded-lg border" />
          <button
            type="button"
            onClick={() => downloadDataUrl(result.fourPanelImageDataUrl, "manga-4panel.png")}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            4コマをダウンロード
          </button>
        </article>

        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">A4縦1ページ漫画 (2480x3508)</h3>
          <img src={result.a4ImageDataUrl} alt="A4縦1ページ漫画" className="mt-3 w-full rounded-lg border" />
          <button
            type="button"
            onClick={() => downloadDataUrl(result.a4ImageDataUrl, "manga-a4.png")}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            A4縦1ページ漫画をダウンロード
          </button>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          STEP3へ戻る
        </button>
        <button
          type="button"
          onClick={onOpenRevise}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          修正して再生成へ
        </button>
      </div>
    </section>
  );
}
