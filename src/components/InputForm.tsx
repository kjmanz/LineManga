"use client";

import { Spinner } from "./Spinner";

type Props = {
  postText: string;
  ownerReferenceDataUrl: string | null;
  wifeReferenceDataUrl: string | null;
  referenceLoading: boolean;
  referenceError: string | null;
  loading: boolean;
  onPostTextChange: (value: string) => void;
  onSubmit: () => void;
};

export function InputForm({
  postText,
  ownerReferenceDataUrl,
  wifeReferenceDataUrl,
  referenceLoading,
  referenceError,
  loading,
  onPostTextChange,
  onSubmit
}: Props) {
  const hasReferences = Boolean(ownerReferenceDataUrl && wifeReferenceDataUrl);
  const charCount = postText.trim().length;
  const canSubmit = !loading && !referenceLoading && hasReferences && charCount > 0;

  return (
    <section className="app-panel overflow-hidden p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-teal-700">Step 1</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">投稿文を入力</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            LINE投稿文を貼り付けてください。店主・妻の参照画像は自動で使われます。
          </p>
        </div>
        <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium tabular-nums text-slate-600">
          {charCount.toLocaleString()} 文字
        </p>
      </div>

      <label className="mt-5 block">
        <span className="sr-only">LINE投稿文</span>
        <textarea
          className="app-textarea h-56 resize-y"
          placeholder="例: エアコンの効きが悪いとき、設定温度より先にフィルター掃除を..."
          value={postText}
          onChange={(event) => onPostTextChange(event.target.value)}
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          {referenceLoading ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
              <Spinner size="sm" className="text-slate-400" />
            </div>
          ) : (
            <img
              src="references/owner.png"
              alt="店主参照"
              className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">店主</p>
            <p className="text-xs text-slate-500">参照画像（固定）</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          {referenceLoading ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
              <Spinner size="sm" className="text-slate-400" />
            </div>
          ) : (
            <img
              src="references/wife.png"
              alt="妻参照"
              className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">妻</p>
            <p className="text-xs text-slate-500">参照画像（固定）</p>
          </div>
        </div>
      </div>

      {referenceError ? (
        <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {referenceError}
        </p>
      ) : null}

      <div className="app-sticky-actions">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {charCount === 0
              ? "投稿文を入力すると次へ進めます"
              : !hasReferences
                ? "参照画像の読み込み完了をお待ちください"
                : "準備OK。要点抽出へ進めます"}
          </p>
          <button type="button" onClick={onSubmit} disabled={!canSubmit} className="app-btn-primary w-full sm:w-auto">
            {loading ? (
              <>
                <Spinner size="sm" className="text-white" />
                <span>要点抽出中...</span>
              </>
            ) : (
              <span>要点を抽出する</span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
