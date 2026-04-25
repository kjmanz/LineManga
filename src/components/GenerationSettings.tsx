"use client";

import type { GenerationMode } from "@/lib/types";
import { cn } from "@/lib/cn";

type Props = {
  mode: GenerationMode;
  loading: boolean;
  onChange: (mode: GenerationMode) => void;
};

export function GenerationSettings({ mode, loading, onChange }: Props) {
  return (
    <section className="app-panel mt-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
      <div>
        <h2 className="text-sm font-bold text-slate-900">生成モード</h2>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-600">
          通常は即時レスポンス。Batch は待ち時間と引き換えに割安になる場合があります。
        </p>
      </div>
      <div className="inline-flex w-full rounded-xl border border-slate-200/90 bg-slate-100/70 p-1 sm:w-auto">
        <button
          type="button"
          disabled={loading}
          onClick={() => onChange("standard")}
          className={cn(
            "min-h-10 flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition sm:min-w-[7.5rem] disabled:cursor-not-allowed disabled:opacity-50",
            mode === "standard"
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          通常
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onChange("batch")}
          className={cn(
            "min-h-10 flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition sm:min-w-[7.5rem] disabled:cursor-not-allowed disabled:opacity-50",
            mode === "batch" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          Batch
        </button>
      </div>
    </section>
  );
}
