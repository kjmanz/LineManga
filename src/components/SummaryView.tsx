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
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-bold text-slate-900">STEP2 要点確認</h2>
      <p className="mt-2 text-sm text-slate-600">
        AIが抽出した要点を必要に応じて編集し、3パターン構成案を生成してください。
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-800">メインテーマ</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={summary.mainTheme}
            onChange={(event) => onChange({ ...summary, mainTheme: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-800">想定読者</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
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
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 text-xs"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addListItem(summary.painPoints, (painPoints) => onChange({ ...summary, painPoints }))}
          className="mt-2 rounded-lg border border-brand-500 px-3 py-1 text-xs text-brand-700"
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
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                className="rounded-lg border border-slate-300 px-3 text-xs"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addListItem(summary.keyFacts, (keyFacts) => onChange({ ...summary, keyFacts }))}
          className="mt-2 rounded-lg border border-brand-500 px-3 py-1 text-xs text-brand-700"
        >
          事実を追加
        </button>
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-semibold text-slate-800">解決メッセージ</span>
        <textarea
          className="h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
          value={summary.solutionMessage}
          onChange={(event) => onChange({ ...summary, solutionMessage: event.target.value })}
        />
      </label>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-semibold text-slate-800">口調メモ</span>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          value={summary.toneNotes}
          onChange={(event) => onChange({ ...summary, toneNotes: event.target.value })}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          STEP1へ戻る
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
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
