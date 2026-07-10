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
    <section className="app-panel overflow-hidden p-6 sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Step 3</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">構成案を選ぶ</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          1つ選んで生成するか、3つまとめて一括生成できます。一括は時間がかかります。
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {patterns.map((pattern) => {
          const selected = pattern.id === selectedPatternId;
          return (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onSelect(pattern.id)}
              aria-pressed={selected}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                selected
                  ? "border-teal-700 bg-teal-50/60 ring-2 ring-teal-700/15"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-teal-700">{pattern.patternType}</p>
                {selected ? (
                  <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-medium text-white">
                    選択中
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1.5 text-base font-semibold leading-snug text-slate-900">{pattern.title}</h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
                {pattern.fourPanels.map((panel) => (
                  <li key={`${pattern.id}-${panel.panel}`} className="rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-slate-100">
                    <span className="font-semibold text-slate-700">コマ{panel.panel}</span>
                    <span className="mt-0.5 block text-slate-600">{panel.dialogue}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="app-sticky-actions">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={onBack} disabled={loading} className="app-btn-ghost">
              戻る
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading || !selectedPatternId}
              className="app-btn-primary w-full sm:w-auto"
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
          </div>
          <button
            type="button"
            onClick={onGenerateAll}
            disabled={loading || patterns.length === 0}
            className="app-btn-secondary w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="text-slate-900" />
                <span>一括生成中...</span>
              </>
            ) : (
              <span>全構成案を一括生成（時間がかかります）</span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
