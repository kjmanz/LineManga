# LINE投稿 漫画化エージェント

LINE投稿文を入力し、要点抽出→3パターン構成案→4コマ/A4漫画生成→修正再生成まで行うWebアプリです。

## 構成

- フロントエンド: Next.js (App Router) + TypeScript + Tailwind
- 配信: GitHub Pages（静的出力）
- API: Cloudflare Workers
- AI: Gemini API（テキスト + 画像）

APIキーは Cloudflare Worker の Secret にのみ保持し、GitHub Pages 側には置きません。

## ローカル開発

### 1) Frontend

```bash
npm install
cp .env.example .env.local
```

`.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
```

起動:

```bash
npm run dev
```

### 2) Worker

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
```

`.dev.vars` に `GEMINI_API_KEY` を設定して起動:

```bash
npm run dev
```

Worker は通常 `http://127.0.0.1:8787` で待受します。

## Cloudflare Workers デプロイ

```bash
cd worker
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

必要なら追加:

- `GEMINI_TEXT_MODEL`
- `GEMINI_IMAGE_MODEL`
- `ALLOWED_ORIGINS`（`,` 区切り）

## GitHub Pages デプロイ

1. GitHub の `Settings > Pages` で `GitHub Actions` を有効化  
2. `Settings > Secrets and variables > Actions` に Repository Secret を追加  
   `NEXT_PUBLIC_API_BASE_URL=https://<your-worker>.workers.dev`
3. `main` へ push すると `.github/workflows/deploy-pages.yml` で自動デプロイ

## 主要エンドポイント（Worker）

- `POST /api/summarize`
- `POST /api/compose`
- `POST /api/generate`
- `POST /api/revise`
- `GET /api/health`

## ディレクトリ

```text
src/
  app/
    layout.tsx
    page.tsx
  components/
  lib/
    types.ts

worker/
  src/index.ts
  wrangler.toml
```
