"use client";

import { Spinner } from "./Spinner";
import type { SummaryResult } from "@/lib/types";

type Props = {
  summary: SummaryResult;
  loading: boolean;
  onChange: (summary: SummaryResult) => void;
  onBack: () => void;
  onNext: () => void;
};

const updateList = (
  list: string[],
  index: number,
  value: string,
  onApply: (next: string[]) => void
) => {
  const next = [...list];
  next[index] = value;
  onApply(next);
};

const addListItem = (list: string[], onApply: (next: string[]) => void) => {
  onApply([...list, ""]);
};

const removeListItem = (list: string[], index: number, onApply: (next: string[]) => void) => {
  if (list.length <= 1) {
    onApply([""]);
    return;
  }
  onApply(list.filter((_, current) => current !== index));
};

export function SummaryView({ summary, loading, onChange, onBack, onNext }: Props) {
  return (
    <section className="app-panel p-6">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">STEP2 要点確認</h2>
      <p className="mt-2 text-sm text-slate-600">
        AIが抽出した要点を必要に応じて編集し、3パターン構成案を生成してください。
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-800">メインテーマ</span>
          <input
            className="app-field w-full"
            value={summary.mainTheme}
            onChange={(event) => onChange({ ...summary, mainTheme: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-800">想定読者</span>
          <input
            className="app-field w-full"
            value={summary.targetPersona}
            onChange={(event) => onChange({ ...summary, targetPersona: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold text-slate-800">困りごと</div>
        <div className="space-y-2">
          {summary.painPoints.map((item, index) => (
            <div key={`pain-${index}`} className="flex gap-2">
              <input
                className="app-field min-w-0 flex-1 text-sm"
                value={item}
                onChange={(event) =>
                  updateList(summary.painPoints, index, event.target.value, (painPoints) =>
                    onChange({ ...summary, painPoints })
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  removeListItem(summary.painPoints, index, (painPoints) =>
                    onChange({ ...summary, painPoints })
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addListItem(summary.painPoints, (painPoints) => onChange({ ...summary, painPoints }))}
          className="mt-2 rounded-lg border border-brand-300 bg-brand-50/60 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
        >
          困りごとを追加
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm font-semibold text-slate-800">事実・補足</div>
        <div className="space-y-2">
          {summary.keyFacts.map((item, index) => (
            <div key={`fact-${index}`} className="flex gap-2">
              <input
                className="app-field min-w-0 flex-1 text-sm"
                value={item}
                onChange={(event) =>
                  updateList(summary.keyFacts, index, event.target.value, (keyFacts) =>
                    onChange({ ...summary, keyFacts })
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  removeListItem(summary.keyFacts, index, (keyFacts) => onChange({ ...summary, keyFacts }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addListItem(summary.keyFacts, (keyFacts) => onChange({ ...summary, keyFacts }))}
          className="mt-2 rounded-lg border border-brand-300 bg-brand-50/60 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
        >
          事実を追加
        </button>
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-semibold text-slate-800">解決メッセージ</span>
        <textarea
          className="app-textarea h-20 resize-y"
          value={summary.solutionMessage}
          onChange={(event) => onChange({ ...summary, solutionMessage: event.target.value })}
        />
      </label>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-semibold text-slate-800">口調メモ</span>
        <input
          className="app-field w-full"
          value={summary.toneNotes}
          onChange={(event) => onChange({ ...summary, toneNotes: event.target.value })}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
        >
          STEP1へ戻る
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/15 transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>構成案生成中...</span>
            </>
          ) : (
            <span>構成案3パターンを生成</span>
          )}
        </button>
      </div>
    </section>
  );
}
