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

  return (
    <section className="app-panel p-6">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">STEP1 投稿文入力</h2>
      <p className="mt-2 text-sm text-slate-600">
        LINE投稿文を貼り付けて「要点を抽出する」を押してください。店主/妻の参照画像は固定で自動適用されます。
      </p>

      <textarea
        className="app-textarea mt-4 h-56 resize-y"
        placeholder="例: エアコンの効きが悪いとき、設定温度より先にフィルター掃除を..."
        value={postText}
        onChange={(event) => onPostTextChange(event.target.value)}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 text-sm">
          <div className="font-semibold text-slate-800">店主参照画像（固定）</div>
          {referenceLoading ? (
            <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-slate-100">
              <Spinner size="sm" className="text-slate-400" />
            </div>
          ) : (
            <img src="references/owner.png" alt="店主参照" className="mt-3 h-24 rounded-lg object-cover" />
          )}
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 text-sm">
          <div className="font-semibold text-slate-800">妻参照画像（固定）</div>
          {referenceLoading ? (
            <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-slate-100">
              <Spinner size="sm" className="text-slate-400" />
            </div>
          ) : (
            <img src="references/wife.png" alt="妻参照" className="mt-3 h-24 rounded-lg object-cover" />
          )}
        </div>
      </div>

      {referenceError ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {referenceError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || referenceLoading || !hasReferences}
        className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/15 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
      >
        {loading ? (
          <>
            <Spinner size="sm" className="text-white" />
            <span>要点抽出中...</span>
          </>
        ) : (
          <span>要点を抽出する</span>
        )}
      </button>
    </section>
  );
}
