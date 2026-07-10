# line-manga-api (Cloudflare Worker)

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars
```

Set `GEMINI_API_KEY` in `.dev.vars`.
Optionally set `OPENAI_API_KEY` to enable GPT Image models.

## Local

```bash
npm run dev
```

## Deploy

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put OPENAI_API_KEY
npm run deploy
```
