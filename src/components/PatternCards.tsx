"use client";

import { Spinner } from "./Spinner";
import type { CompositionPattern } from "@/lib/types";
import { cn } from "@/lib/cn";

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
    <section className="app-panel p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">STEP3 構成案選択</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        3パターンから1つを選んで生成するか、全構成案を一括で生成できます。
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {patterns.map((pattern) => {
          const selected = pattern.id === selectedPatternId;
          return (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onSelect(pattern.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition",
                selected
                  ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80"
              )}
            >
              <p className="text-xs font-medium text-zinc-500">{pattern.patternType}</p>
              <h3 className="mt-1 text-base font-semibold text-zinc-900">{pattern.title}</h3>
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-zinc-600">
                {pattern.fourPanels.map((panel) => (
                  <li key={`${pattern.id}-${panel.panel}`}>
                    <span className="font-medium text-zinc-700">コマ{panel.panel}:</span> {panel.dialogue}
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-2 text-xs text-zinc-600">
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
          className="app-btn-ghost min-h-10 disabled:cursor-not-allowed"
        >
          STEP2へ戻る
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || !selectedPatternId}
          className="app-btn-primary min-h-10"
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
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-zinc-900 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-zinc-900" />
              <span>一括生成中...</span>
            </>
          ) : (
            <span>全構成案を一括生成</span>
          )}
        </button>
      </div>
    </section>
  );
}
