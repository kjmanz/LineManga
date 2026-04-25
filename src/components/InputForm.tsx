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
    <section className="app-panel p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">STEP1 投稿文入力</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        LINE投稿文を貼り付けて「要点を抽出する」を押してください。店主/妻の参照画像は固定で自動適用されます。
      </p>

      <textarea
        className="app-textarea mt-4 h-56 resize-y"
        placeholder="例: エアコンの効きが悪いとき、設定温度より先にフィルター掃除を..."
        value={postText}
        onChange={(event) => onPostTextChange(event.target.value)}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm">
          <div className="font-medium text-zinc-800">店主参照画像（固定）</div>
          {referenceLoading ? (
            <div className="mt-3 flex h-24 items-center justify-center rounded-md bg-zinc-100">
              <Spinner size="sm" className="text-zinc-400" />
            </div>
          ) : (
            <img src="references/owner.png" alt="店主参照" className="mt-3 h-24 rounded-md object-cover" />
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-sm">
          <div className="font-medium text-zinc-800">妻参照画像（固定）</div>
          {referenceLoading ? (
            <div className="mt-3 flex h-24 items-center justify-center rounded-md bg-zinc-100">
              <Spinner size="sm" className="text-zinc-400" />
            </div>
          ) : (
            <img src="references/wife.png" alt="妻参照" className="mt-3 h-24 rounded-md object-cover" />
          )}
        </div>
      </div>

      {referenceError ? (
        <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {referenceError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || referenceLoading || !hasReferences}
        className="app-btn-primary mt-6 w-full sm:w-auto"
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
