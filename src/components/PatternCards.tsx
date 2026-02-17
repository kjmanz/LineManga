"use client";

import { Spinner } from "./Spinner";
import type { CompositionPattern } from "@/lib/types";

type Props = {
  patterns: CompositionPattern[];
  selectedPatternId: string | null;
  loading: boolean;
  onSelect: (patternId: string) => void;
  onBack: () => void;
  onGenerate: () => void;
  onGenerateAll: () => void;
};

export function PatternCards({
  patterns,
  selectedPatternId,
  loading,
  onSelect,
  onBack,
  onGenerate,
  onGenerateAll
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-bold text-slate-900">STEP3 構成案選択</h2>
      <p className="mt-2 text-sm text-slate-600">
        3パターンから1つを選んで生成します。全構成案の一括生成も実行できます。
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {patterns.map((pattern) => {
          const selected = pattern.id === selectedPatternId;
          return (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onSelect(pattern.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                  : "border-slate-200 hover:border-brand-300"
              }`}
            >
              <p className="text-xs font-semibold text-brand-700">{pattern.patternType}</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">{pattern.title}</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-700">
                {pattern.fourPanels.map((panel) => (
                  <li key={`${pattern.id}-${panel.panel}`}>
                    <span className="font-semibold">コマ{panel.panel}:</span> {panel.dialogue}
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg bg-slate-100 p-2 text-xs text-slate-700">
                {pattern.cta ? `CTA: ${pattern.cta}` : "CTAなし"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          STEP2へ戻る
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || !selectedPatternId}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>生成中...</span>
            </>
          ) : (
            <span>選択中の構成案を生成</span>
          )}
        </button>
        <button
          type="button"
          onClick={onGenerateAll}
          disabled={loading || patterns.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>生成中...</span>
            </>
          ) : (
            <span>全構成案を一括生成</span>
          )}
        </button>
      </div>
    </section>
  );
}
