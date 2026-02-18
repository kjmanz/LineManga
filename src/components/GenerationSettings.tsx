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
        通常モードは即時レスポンス、Batchモードは待ち時間と引き換えに安価になる場合があります。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
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
      </div>
    </section>
  );
}
