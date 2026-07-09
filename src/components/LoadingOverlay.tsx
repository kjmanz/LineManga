"use client";

import { Spinner } from "./Spinner";

type Props = {
  open: boolean;
  title: string;
  message?: string;
};

export function LoadingOverlay({ open, title, message }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/35 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Spinner size="md" className="text-zinc-800" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{title}</p>
            {message ? <p className="mt-1 text-xs leading-relaxed text-zinc-600">{message}</p> : null}
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          画像生成には数十秒かかることがあります。このままお待ちください。
        </p>
      </div>
    </div>
  );
}
