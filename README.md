# LINE投稿 漫画化エージェント

LINE投稿文を入力すると、要点抽出→3パターン構成案→4コマ/A4漫画生成→修正再生成までを行う Next.js Webアプリです。

## 技術構成

- Next.js (App Router) + TypeScript
- Tailwind CSS
- API Routes（`/api/summarize`, `/api/compose`, `/api/generate`, `/api/revise`）
- Gemini API（テキスト + 画像生成）

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を設定

`.env.example` を `.env.local` にコピーして値を設定。

```bash
cp .env.example .env.local
```

最低限必要:

- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL`（例: `gemini-3-pro`）
- `GEMINI_IMAGE_MODEL`（例: `nano-banana-pro`）

注: モデルIDは契約・リージョン・時期で変わる場合があります。利用中のGemini APIで有効なIDに合わせてください。

3. 開発サーバー起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 画面フロー

1. `STEP1` 投稿文入力（参照画像アップロード可）
2. `STEP2` 要点確認・編集
3. `STEP3` 構成案3パターン選択
4. `STEP4` 4コマ/A4プレビュー + ダウンロード
5. `STEP5` 修正指示で再生成 + 比較

## ディレクトリ

```text
src/
  app/
    api/
      summarize/route.ts
      compose/route.ts
      generate/route.ts
      revise/route.ts
    layout.tsx
    page.tsx
  components/
    InputForm.tsx
    SummaryView.tsx
    PatternCards.tsx
    MangaPreview.tsx
    RevisePanel.tsx
  lib/
    gemini.ts
    prompts.ts
    types.ts
```
