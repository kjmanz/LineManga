"use client";

import type { GenerationMode } from "@/lib/types";

type Props = {
  mode: GenerationMode;
  loading: boolean;
  onChange: (mode: GenerationMode) => void;
};

export function GenerationSettings({ mode, loading, onChange }: Props) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
      <h2 className="text-sm font-bold text-slate-900">生成設定</h2>
      <p className="mt-1 text-xs text-slate-600">
        Batchは安価ですが待ち時間が長くなる場合があります。通常は即時レスポンスを優先します。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onChange("batch")}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            mode === "batch"
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-300 bg-white text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Batchモード
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onChange("standard")}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            mode === "standard"
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-300 bg-white text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          通常モード
        </button>
      </div>
    </section>
  );
}
