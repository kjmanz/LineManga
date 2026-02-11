"use client";

import { ChangeEvent } from "react";

type Props = {
  postText: string;
  ownerReferenceDataUrl: string | null;
  wifeReferenceDataUrl: string | null;
  loading: boolean;
  onPostTextChange: (value: string) => void;
  onOwnerReferenceChange: (value: string | null) => void;
  onWifeReferenceChange: (value: string | null) => void;
  onSubmit: () => void;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });

const handleFileChange = async (
  event: ChangeEvent<HTMLInputElement>,
  onChange: (value: string | null) => void
) => {
  const file = event.target.files?.[0];
  if (!file) {
    onChange(null);
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  onChange(dataUrl);
};

export function InputForm({
  postText,
  ownerReferenceDataUrl,
  wifeReferenceDataUrl,
  loading,
  onPostTextChange,
  onOwnerReferenceChange,
  onWifeReferenceChange,
  onSubmit
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-bold text-slate-900">STEP1 投稿文入力</h2>
      <p className="mt-2 text-sm text-slate-600">
        LINE投稿文を貼り付けて「要点を抽出する」を押してください。
      </p>

      <textarea
        className="mt-4 h-56 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        placeholder="例: エアコンの効きが悪いとき、設定温度より先にフィルター掃除を..."
        value={postText}
        onChange={(event) => onPostTextChange(event.target.value)}
      />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="rounded-xl border border-slate-200 p-4 text-sm">
          <div className="font-semibold text-slate-800">店主参照画像</div>
          <input
            className="mt-2 block w-full text-xs"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleFileChange(event, onOwnerReferenceChange)}
          />
          {ownerReferenceDataUrl ? (
            <img src={ownerReferenceDataUrl} alt="店主参照" className="mt-3 h-24 rounded-lg object-cover" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">未設定（アップロード推奨）</p>
          )}
        </label>

        <label className="rounded-xl border border-slate-200 p-4 text-sm">
          <div className="font-semibold text-slate-800">妻参照画像</div>
          <input
            className="mt-2 block w-full text-xs"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void handleFileChange(event, onWifeReferenceChange)}
          />
          {wifeReferenceDataUrl ? (
            <img src={wifeReferenceDataUrl} alt="妻参照" className="mt-3 h-24 rounded-lg object-cover" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">未設定（アップロード推奨）</p>
          )}
        </label>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="mt-5 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "要点抽出中..." : "要点を抽出する"}
      </button>
    </section>
  );
}
