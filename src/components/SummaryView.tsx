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
  const canProceed = Boolean(summary.mainTheme.trim() && summary.targetPersona.trim() && summary.solutionMessage.trim());

  return (
    <section className="app-panel overflow-hidden p-6 sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Step 2</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">要点を確認・編集</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          AIが抽出した要点です。必要なら直してから、構成案3パターンを作ります。
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-slate-800">メインテーマ</span>
          <input
            className="app-field w-full"
            value={summary.mainTheme}
            onChange={(event) => onChange({ ...summary, mainTheme: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium text-slate-800">想定読者</span>
          <input
            className="app-field w-full"
            value={summary.targetPersona}
            onChange={(event) => onChange({ ...summary, targetPersona: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 text-sm font-medium text-slate-800">困りごと</div>
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
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addListItem(summary.painPoints, (painPoints) => onChange({ ...summary, painPoints }))}
          className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
        >
          ＋ 困りごとを追加
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 text-sm font-medium text-slate-800">事実・補足</div>
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
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                削除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addListItem(summary.keyFacts, (keyFacts) => onChange({ ...summary, keyFacts }))}
          className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
        >
          ＋ 事実を追加
        </button>
      </div>

      <label className="mt-5 block text-sm">
        <span className="mb-1.5 block font-medium text-slate-800">解決メッセージ</span>
        <textarea
          className="app-textarea h-24 resize-y"
          value={summary.solutionMessage}
          onChange={(event) => onChange({ ...summary, solutionMessage: event.target.value })}
        />
      </label>

      <label className="mt-5 block text-sm">
        <span className="mb-1.5 block font-medium text-slate-800">口調メモ</span>
        <input
          className="app-field w-full"
          value={summary.toneNotes}
          onChange={(event) => onChange({ ...summary, toneNotes: event.target.value })}
        />
      </label>

      <div className="app-sticky-actions">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onBack} disabled={loading} className="app-btn-ghost">
            戻る
          </button>
          <button type="button" onClick={onNext} disabled={loading || !canProceed} className="app-btn-primary">
            {loading ? (
              <>
                <Spinner size="sm" className="text-white" />
                <span>構成案生成中...</span>
              </>
            ) : (
              <span>構成案3パターンを生成</span>
            )}
          </button>
          {!canProceed ? (
            <p className="basis-full text-xs text-amber-700">メインテーマ・想定読者・解決メッセージを入力してください。</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
