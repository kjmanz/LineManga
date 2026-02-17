"use client";

import { useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Spinner } from "./Spinner";
import type {
  GenerationMode,
  GenerationResult,
  ImageEditInstruction,
  ImageEditKind,
  ImageEditLayout,
  ImageEditShape
} from "@/lib/types";

type RevisePayload = {
  revisionInstruction: string;
  imageEdits: ImageEditInstruction[];
};

type Props = {
  previousResult: GenerationResult;
  revisedResult: GenerationResult | null;
  loading: boolean;
  mode: GenerationMode;
  onBack: () => void;
  onRevise: (payload: RevisePayload) => void;
  onAdoptRevised: () => void;
};

type DraftRect = {
  layout: ImageEditLayout;
  kind: ImageEditKind;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toPercent = (value: number) => `${Math.round(value * 1000) / 10}%`;

const defaultCommentByKind: Record<ImageEditKind, string> = {
  general: "",
  owner_face: "この箇所の顔を店主参照画像に合わせてください。",
  wife_face: "この箇所の顔を妻参照画像に合わせてください。"
};

const layoutLabel: Record<ImageEditLayout, string> = {
  "four-panel-square": "4コマ",
  "a4-vertical": "A4"
};

const kindLabel: Record<ImageEditKind, string> = {
  general: "通常修正",
  owner_face: "店主顔再生成",
  wife_face: "妻顔再生成"
};

const kindTone: Record<ImageEditKind, string> = {
  general: "border-sky-400 bg-sky-50 text-sky-700",
  owner_face: "border-emerald-400 bg-emerald-50 text-emerald-700",
  wife_face: "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700"
};

export function RevisePanel({
  previousResult,
  revisedResult,
  loading,
  mode,
  onBack,
  onRevise,
  onAdoptRevised
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [toolShape, setToolShape] = useState<ImageEditShape>("point");
  const [toolKind, setToolKind] = useState<ImageEditKind>("general");
  const [imageEdits, setImageEdits] = useState<ImageEditInstruction[]>([]);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const editIdSeq = useRef(1);
  const isBatchMode = mode === "batch";
  const hasEmptyEditComment = useMemo(
    () => imageEdits.some((edit) => edit.comment.trim().length === 0),
    [imageEdits]
  );
  const canSubmit = (instruction.trim().length > 0 || imageEdits.length > 0) && !hasEmptyEditComment;

  const toNormalizedPoint = (event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    return { x, y };
  };

  const createEdit = (
    layout: ImageEditLayout,
    kind: ImageEditKind,
    shape: ImageEditShape,
    x: number,
    y: number,
    width?: number,
    height?: number
  ) => {
    const id = `edit-${editIdSeq.current}`;
    editIdSeq.current += 1;
    const nextEdit: ImageEditInstruction = {
      id,
      layout,
      shape,
      kind,
      x: clamp01(x),
      y: clamp01(y),
      comment: defaultCommentByKind[kind]
    };
    if (shape === "rect") {
      nextEdit.width = clamp01(width ?? 0);
      nextEdit.height = clamp01(height ?? 0);
    }
    setImageEdits((current) => [...current, nextEdit]);
  };

  const handleImageClick = (layout: ImageEditLayout) => (event: MouseEvent<HTMLDivElement>) => {
    if (loading || toolShape !== "point") {
      return;
    }
    const point = toNormalizedPoint(event);
    createEdit(layout, toolKind, "point", point.x, point.y);
  };

  const handlePointerDown = (layout: ImageEditLayout) => (event: PointerEvent<HTMLDivElement>) => {
    if (loading || toolShape !== "rect") {
      return;
    }
    event.preventDefault();
    const point = toNormalizedPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftRect({
      layout,
      kind: toolKind,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y
    });
  };

  const handlePointerMove = (layout: ImageEditLayout) => (event: PointerEvent<HTMLDivElement>) => {
    if (!draftRect || draftRect.layout !== layout) {
      return;
    }
    const point = toNormalizedPoint(event);
    setDraftRect((current) =>
      current
        ? {
            ...current,
            currentX: point.x,
            currentY: point.y
          }
        : null
    );
  };

  const handlePointerUp = (layout: ImageEditLayout) => (event: PointerEvent<HTMLDivElement>) => {
    if (!draftRect || draftRect.layout !== layout) {
      return;
    }
    const point = toNormalizedPoint(event);
    const left = Math.min(draftRect.startX, point.x);
    const top = Math.min(draftRect.startY, point.y);
    const width = Math.abs(draftRect.startX - point.x);
    const height = Math.abs(draftRect.startY - point.y);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDraftRect(null);

    if (width < 0.01 || height < 0.01) {
      createEdit(layout, draftRect.kind, "point", point.x, point.y);
      return;
    }
    createEdit(layout, draftRect.kind, "rect", left, top, width, height);
  };

  const updateEditComment = (id: string, comment: string) => {
    setImageEdits((current) =>
      current.map((edit) =>
        edit.id === id
          ? {
              ...edit,
              comment
            }
          : edit
      )
    );
  };

  const removeEdit = (id: string) => {
    setImageEdits((current) => current.filter((edit) => edit.id !== id));
  };

  const renderEditOverlay = (edit: ImageEditInstruction, index: number) => {
    const commonBadge = (
      <span
        className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-bold ${kindTone[edit.kind]}`}
      >
        {index + 1}
      </span>
    );

    if (edit.shape === "rect") {
      return (
        <div
          key={edit.id}
          className={`absolute border-2 ${kindTone[edit.kind]}`}
          style={{
            left: `${edit.x * 100}%`,
            top: `${edit.y * 100}%`,
            width: `${(edit.width ?? 0) * 100}%`,
            height: `${(edit.height ?? 0) * 100}%`
          }}
        >
          <div className="-mt-6 ml-0.5">{commonBadge}</div>
        </div>
      );
    }

    return (
      <div
        key={edit.id}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${edit.x * 100}%`,
          top: `${edit.y * 100}%`
        }}
      >
        <div className={`h-5 w-5 rounded-full border-2 bg-white/90 ${kindTone[edit.kind]}`}>{commonBadge}</div>
      </div>
    );
  };

  const renderEditableImage = ({
    layout,
    title,
    imageDataUrl
  }: {
    layout: ImageEditLayout;
    title: string;
    imageDataUrl: string;
  }) => {
    const edits = imageEdits.filter((edit) => edit.layout === layout);
    const draftOnThisImage = draftRect?.layout === layout ? draftRect : null;
    const draftLeft = draftOnThisImage
      ? Math.min(draftOnThisImage.startX, draftOnThisImage.currentX)
      : 0;
    const draftTop = draftOnThisImage
      ? Math.min(draftOnThisImage.startY, draftOnThisImage.currentY)
      : 0;
    const draftWidth = draftOnThisImage ? Math.abs(draftOnThisImage.startX - draftOnThisImage.currentX) : 0;
    const draftHeight = draftOnThisImage ? Math.abs(draftOnThisImage.startY - draftOnThisImage.currentY) : 0;

    return (
      <article className="rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {toolShape === "point"
            ? "画像をクリックして編集ポイントを追加"
            : "画像上でドラッグして編集範囲を追加"}
        </p>
        <div
          className="relative mt-2 overflow-hidden rounded-lg border bg-slate-50"
          onClick={handleImageClick(layout)}
          onPointerDown={handlePointerDown(layout)}
          onPointerMove={handlePointerMove(layout)}
          onPointerUp={handlePointerUp(layout)}
        >
          <img src={imageDataUrl} alt={title} className="w-full select-none" draggable={false} />
          <div className="pointer-events-none absolute inset-0">
            {edits.map((edit, index) => renderEditOverlay(edit, index))}
            {draftOnThisImage ? (
              <div
                className="absolute border-2 border-amber-400 bg-amber-100/25"
                style={{
                  left: `${draftLeft * 100}%`,
                  top: `${draftTop * 100}%`,
                  width: `${draftWidth * 100}%`,
                  height: `${draftHeight * 100}%`
                }}
              />
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-xl font-bold text-slate-900">STEP5 修正再生成</h2>
      <p className="mt-2 text-sm text-slate-600">
        テキスト指示に加えて、画像上のポイント/範囲指定で複数箇所をまとめて編集できます。
      </p>

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">編集ツール</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setToolShape("point")}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                toolShape === "point"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              ポイント指定
            </button>
            <button
              type="button"
              onClick={() => setToolShape("rect")}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                toolShape === "rect"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              範囲指定
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700">編集種別</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setToolKind("general")}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                toolKind === "general"
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              通常修正
            </button>
            <button
              type="button"
              onClick={() => setToolKind("owner_face")}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                toolKind === "owner_face"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              店主顔再生成
            </button>
            <button
              type="button"
              onClick={() => setToolKind("wife_face")}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                toolKind === "wife_face"
                  ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              妻顔再生成
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {renderEditableImage({
          layout: "four-panel-square",
          title: "編集対象: 4コマ",
          imageDataUrl: previousResult.fourPanelImageDataUrl
        })}
        {renderEditableImage({
          layout: "a4-vertical",
          title: "編集対象: A4",
          imageDataUrl: previousResult.a4ImageDataUrl
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">編集ポイント一覧 ({imageEdits.length})</h3>
          <button
            type="button"
            onClick={() => setImageEdits([])}
            disabled={loading || imageEdits.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            全削除
          </button>
        </div>
        {imageEdits.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">まだ編集ポイントがありません。画像をクリックまたはドラッグして追加してください。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {imageEdits.map((edit, index) => (
              <div key={edit.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    #{index + 1} / {layoutLabel[edit.layout]} / {kindLabel[edit.kind]} /{" "}
                    {edit.shape === "point"
                      ? `点(${toPercent(edit.x)}, ${toPercent(edit.y)})`
                      : `範囲(${toPercent(edit.x)}, ${toPercent(edit.y)}) ${toPercent(edit.width ?? 0)} x ${toPercent(edit.height ?? 0)}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeEdit(edit.id)}
                    disabled={loading}
                    className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
                <textarea
                  className="mt-2 h-20 w-full rounded-lg border border-slate-200 p-2 text-xs"
                  placeholder="この箇所をどう編集したいかを入力"
                  value={edit.comment}
                  onChange={(event) => updateEditComment(edit.id, event.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <textarea
        className="mt-4 h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
        placeholder="例: 2コマ目のセリフを短く、4コマ目をやさしいオチに変更"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
      />
      <p className="mt-2 text-xs text-slate-500">
        補足の全体指示を入力できます。画像編集ポイントのみでも再生成可能です。
      </p>
      {hasEmptyEditComment ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          編集ポイントのコメントが未入力です。各ポイントの意図を入力してください。
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          STEP4へ戻る
        </button>
        <button
          type="button"
          disabled={loading || !canSubmit}
          onClick={() =>
            onRevise({
              revisionInstruction: instruction.trim(),
              imageEdits
            })
          }
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>{isBatchMode ? "バッチ再生成中..." : "通常再生成中..."}</span>
            </>
          ) : (
            <span>{isBatchMode ? "修正してバッチ再生成" : "修正して通常再生成"}</span>
          )}
        </button>
        {revisedResult ? (
          <button
            type="button"
            onClick={onAdoptRevised}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            修正版を採用してSTEP4へ
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">前回 4コマ</h3>
          <img src={previousResult.fourPanelImageDataUrl} alt="前回4コマ" className="mt-2 rounded-lg border" />
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">修正版 4コマ</h3>
          {revisedResult ? (
            <img src={revisedResult.fourPanelImageDataUrl} alt="修正版4コマ" className="mt-2 rounded-lg border" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">まだ再生成していません。</p>
          )}
        </article>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">前回 A4</h3>
          <img src={previousResult.a4ImageDataUrl} alt="前回A4" className="mt-2 rounded-lg border" />
        </article>
        <article className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-800">修正版 A4</h3>
          {revisedResult ? (
            <img src={revisedResult.a4ImageDataUrl} alt="修正版A4" className="mt-2 rounded-lg border" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">まだ再生成していません。</p>
          )}
        </article>
      </div>
    </section>
  );
}
