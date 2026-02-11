type SummaryResult = {
  mainTheme: string;
  targetPersona: string;
  painPoints: string[];
  keyFacts: string[];
  solutionMessage: string;
  ctaCandidates: string[];
  toneNotes: string;
};

type MangaPanel = {
  panel: 1 | 2 | 3 | 4;
  scene: string;
  dialogue: string;
};

type A4Flow = {
  intro: string;
  empathy: string;
  solution: string;
  action: string;
};

type PatternType = "共感型" | "驚き型" | "体験談型";

type CompositionPattern = {
  id: string;
  patternType: PatternType;
  title: string;
  fourPanels: [MangaPanel, MangaPanel, MangaPanel, MangaPanel];
  a4Flow: A4Flow;
  cta: string;
};

type Env = {
  GEMINI_API_KEY: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_IMAGE_MODEL?: string;
  ALLOWED_ORIGINS?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<
        GeminiPart & {
          inline_data?: {
            mimeType?: string;
            mime_type?: string;
            data?: string;
          };
        }
      >;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
};

type GeminiModel = {
  name?: string;
  supportedGenerationMethods?: string[];
};

type GeminiListModelsResponse = {
  models?: GeminiModel[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
};

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TEXT_MODEL = "gemini-3-flash-preview";
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
const MODEL_LIST_CACHE_MS = 1000 * 60 * 10;
const IMAGE_MODEL_ALIASES: Record<string, string> = {
  "nano-banana-pro": DEFAULT_IMAGE_MODEL,
  "nano-banana": DEFAULT_IMAGE_MODEL
};
const IMAGE_MODEL_PRIORITY = [
  DEFAULT_IMAGE_MODEL,
  "gemini-2.5-flash-image-preview",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp-image-generation",
  "gemini-2.0-flash"
];

let geminiModelCache:
  | {
      expiresAt: number;
      models: GeminiModel[];
    }
  | null = null;

const TEXT_SYSTEM_PROMPT = `
あなたは「地域密着の電気屋さん向け漫画コンテンツディレクター」です。
対象読者は50代以上の地域のお客様です。
読みやすく、親しみやすく、短いセリフで伝えてください。
必ず行動導線（CTA）を含めてください。
出力は指定したJSON形式のみで返答してください。
`.trim();

const summarizePrompt = (postText: string) => `
以下のLINE投稿文を、漫画化に使える要点に整理してください。

LINE投稿文:
"""${postText}"""

必須要件:
- 投稿文から逸脱しないこと
- 50代以上の読者に伝わる言葉に言い換えること
- CTA候補を3つ以上入れること

次のJSONを必ず返してください:
{
  "mainTheme": "投稿の中心テーマ",
  "targetPersona": "想定読者",
  "painPoints": ["困りごと1", "困りごと2"],
  "keyFacts": ["事実1", "事実2"],
  "solutionMessage": "店主としての提案",
  "ctaCandidates": ["LINE返信", "電話相談", "来店予約"],
  "toneNotes": "話し方の方針"
}
`.trim();

const composePrompt = (summary: SummaryResult) => `
次の要点から、漫画構成案を3パターン作ってください。
3パターンは「共感型」「驚き型」「体験談型」をそれぞれ1つずつ作ること。

要点(JSON):
${JSON.stringify(summary, null, 2)}

条件:
- タイトルは短く印象的
- 4コマは必ず1〜4コマの流れを守る
  1コマ目: 状況きっかけ
  2コマ目: 困りごと共感
  3コマ目: 店主の解決策
  4コマ目: オチ+CTA
- A4縦は4コマ形式を禁止し、1ページ漫画として「導入・共感・解決・行動」の順で設計する
- CTAは必ず入れる
- セリフは短く、スマホ可読性を優先

次のJSONを返してください:
{
  "patterns": [
    {
      "id": "empathy",
      "patternType": "共感型",
      "title": "タイトル",
      "fourPanels": [
        { "panel": 1, "scene": "状況", "dialogue": "セリフ" },
        { "panel": 2, "scene": "状況", "dialogue": "セリフ" },
        { "panel": 3, "scene": "状況", "dialogue": "セリフ" },
        { "panel": 4, "scene": "状況", "dialogue": "セリフ" }
      ],
      "a4Flow": {
        "intro": "導入",
        "empathy": "共感",
        "solution": "解決",
        "action": "行動"
      },
      "cta": "CTA文言"
    }
  ]
}
`.trim();

const panelText = (pattern: CompositionPattern) =>
  pattern.fourPanels
    .map(
      (panel) =>
        `コマ${panel.panel}
- シーン: ${panel.scene}
- セリフ: ${panel.dialogue}`
    )
    .join("\n");

const imagePrompt = ({
  summary,
  pattern,
  layout,
  revisionInstruction
}: {
  summary: SummaryResult;
  pattern: CompositionPattern;
  layout: "four-panel-square" | "a4-vertical";
  revisionInstruction?: string;
}) => {
  const sizeInstruction =
    layout === "four-panel-square"
      ? "1080x1080pxの正方形1枚に4コマをレイアウト。"
      : "2480x3508pxのA4縦1枚。4コマ分割はせず、1ページ漫画として導入→共感→解決→行動の順で構成する。";

  const layoutInstruction =
    layout === "four-panel-square"
      ? "4コマは田の字または縦1列で読みやすく配置。"
      : "A4は4コマ枠(均等4分割)を使わず、メインビジュアル+吹き出し+補助カットで視線誘導を設計する。";

  const revisionBlock = revisionInstruction
    ? `修正指示:
- ${revisionInstruction}
上記指示を必ず反映して再生成する。`
    : "初回生成。";

  return `
あなたは日本語漫画の画像生成アシスタントです。
style固定: cute chibi style, pop color, Japanese manga

必須キャラクター:
- 店主（きょうしんさん）: 電気工事・家電のプロ、親切で頼もしい
- 妻: 明るく寄り添う
- お客様: 50代以上を中心に1〜2名

要約情報:
- メインテーマ: ${summary.mainTheme}
- 想定読者: ${summary.targetPersona}
- 困りごと: ${summary.painPoints.join(" / ")}
- 解決メッセージ: ${summary.solutionMessage}
- CTA候補: ${summary.ctaCandidates.join(" / ")}

選択構成:
- 切り口: ${pattern.patternType}
- タイトル: ${pattern.title}
- 4コマ:
${panelText(pattern)}
- A4流れ:
  - 導入: ${pattern.a4Flow.intro}
  - 共感: ${pattern.a4Flow.empathy}
  - 解決: ${pattern.a4Flow.solution}
  - 行動: ${pattern.a4Flow.action}
- 最終CTA: ${pattern.cta}

画像要件:
- ${sizeInstruction}
- ${layoutInstruction}
- 日本語テキストを入れる。セリフは短く簡潔。
- 最後に必ずCTAを明示。
- 投稿内容から逸脱しない。

${revisionBlock}
`.trim();
};

const cleanText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

const cleanList = (value: unknown, fallback: string[]) =>
  Array.isArray(value)
    ? value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
    : fallback;

const normalizeSummary = (raw: unknown): SummaryResult => {
  const source = (raw ?? {}) as Record<string, unknown>;
  const ctaCandidates = cleanList(source.ctaCandidates, [
    "LINEで返信してください",
    "お電話でご相談ください",
    "ご来店予約をお願いします"
  ]);

  return {
    mainTheme: cleanText(source.mainTheme, "季節の家電相談"),
    targetPersona: cleanText(source.targetPersona, "50代以上の地域のお客様"),
    painPoints: cleanList(source.painPoints, ["何を選べばいいか分からない"]),
    keyFacts: cleanList(source.keyFacts, ["投稿文の要点をまとめる"]),
    solutionMessage: cleanText(
      source.solutionMessage,
      "店主が状況に合わせて分かりやすく提案します"
    ),
    ctaCandidates: ctaCandidates.length > 0 ? ctaCandidates : ["LINEで返信してください"],
    toneNotes: cleanText(source.toneNotes, "やさしく親しみやすい口調")
  };
};

const panelFallback = (panel: 1 | 2 | 3 | 4): MangaPanel => ({
  panel,
  scene: `コマ${panel}の状況`,
  dialogue: "短いセリフ"
});

const normalizePanel = (raw: unknown, panel: 1 | 2 | 3 | 4): MangaPanel => {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    panel,
    scene: cleanText(source.scene, panelFallback(panel).scene),
    dialogue: cleanText(source.dialogue, panelFallback(panel).dialogue)
  };
};

const normalizeA4Flow = (raw: unknown): A4Flow => {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    intro: cleanText(source.intro, "導入: お客様の状況説明"),
    empathy: cleanText(source.empathy, "共感: 困りごとへの寄り添い"),
    solution: cleanText(source.solution, "解決: 店主の提案"),
    action: cleanText(source.action, "行動: LINE返信か電話相談へ")
  };
};

const normalizePatternType = (value: unknown): PatternType => {
  if (value === "共感型" || value === "驚き型" || value === "体験談型") {
    return value;
  }
  return "共感型";
};

const normalizePatterns = (raw: unknown): CompositionPattern[] => {
  const source = raw as { patterns?: unknown };
  const rawPatterns = Array.isArray(source?.patterns) ? source.patterns : [];

  const normalized = rawPatterns.slice(0, 3).map((item, index) => {
    const pattern = (item ?? {}) as Record<string, unknown>;
    const panels = Array.isArray(pattern.fourPanels) ? pattern.fourPanels : [];

    return {
      id: cleanText(pattern.id, `pattern-${index + 1}`),
      patternType: normalizePatternType(pattern.patternType),
      title: cleanText(pattern.title, `提案パターン${index + 1}`),
      fourPanels: [
        normalizePanel(panels[0], 1),
        normalizePanel(panels[1], 2),
        normalizePanel(panels[2], 3),
        normalizePanel(panels[3], 4)
      ] as [MangaPanel, MangaPanel, MangaPanel, MangaPanel],
      a4Flow: normalizeA4Flow(pattern.a4Flow),
      cta: cleanText(pattern.cta, "LINEで返信してください")
    } satisfies CompositionPattern;
  });

  if (normalized.length === 3) {
    return normalized;
  }

  const fallbackTypes: PatternType[] = ["共感型", "驚き型", "体験談型"];
  while (normalized.length < 3) {
    const index = normalized.length;
    normalized.push({
      id: `pattern-${index + 1}`,
      patternType: fallbackTypes[index],
      title: `${fallbackTypes[index]}の提案`,
      fourPanels: [1, 2, 3, 4].map((panel) =>
        panelFallback(panel as 1 | 2 | 3 | 4)
      ) as [MangaPanel, MangaPanel, MangaPanel, MangaPanel],
      a4Flow: normalizeA4Flow(null),
      cta: "LINEで返信してください"
    });
  }

  return normalized;
};

const parseJsonSafely = <T>(rawText: string): T => {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1]) as T;
    }
    const objectMatch = rawText.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error("JSONの解析に失敗しました。");
    }
    return JSON.parse(objectMatch[0]) as T;
  }
};

const normalizeModelId = (model: string) => model.trim().replace(/^models\//i, "");

const resolveImageModelAlias = (model: string) => {
  const normalized = normalizeModelId(model);
  return IMAGE_MODEL_ALIASES[normalized.toLowerCase()] ?? normalized;
};

const modelSupportsGenerateContent = (model: GeminiModel) =>
  Array.isArray(model.supportedGenerationMethods) &&
  model.supportedGenerationMethods.includes("generateContent");

const listGeminiModels = async (env: Env, forceRefresh = false): Promise<GeminiModel[]> => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }

  const now = Date.now();
  if (!forceRefresh && geminiModelCache && geminiModelCache.expiresAt > now) {
    return geminiModelCache.models;
  }

  const models: GeminiModel[] = [];
  let pageToken: string | undefined;
  for (let index = 0; index < 10; index += 1) {
    const params = new URLSearchParams({ key: env.GEMINI_API_KEY });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }
    const response = await fetch(`${API_BASE}?${params.toString()}`);
    const data = (await response.json()) as GeminiListModelsResponse;
    if (!response.ok) {
      throw new Error(data.error?.message ?? "Geminiモデル一覧の取得に失敗しました。");
    }
    if (Array.isArray(data.models)) {
      models.push(...data.models);
    }
    const next = data.nextPageToken?.trim();
    if (!next) {
      break;
    }
    pageToken = next;
  }

  geminiModelCache = {
    expiresAt: now + MODEL_LIST_CACHE_MS,
    models
  };
  return models;
};

const isRecoverableModelError = (message: string) =>
  /not found|not supported for generatecontent|unsupported/i.test(message);

const pickImageFallbackModel = (models: GeminiModel[], excludeModel: string) => {
  const excluded = normalizeModelId(excludeModel).toLowerCase();
  const uniqueIds: string[] = [];
  const seen = new Set<string>();

  for (const model of models) {
    if (!modelSupportsGenerateContent(model) || !model.name) {
      continue;
    }
    const modelId = normalizeModelId(model.name);
    const lower = modelId.toLowerCase();
    if (!modelId || lower === excluded || seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    uniqueIds.push(modelId);
  }

  for (const preferred of IMAGE_MODEL_PRIORITY) {
    const matched = uniqueIds.find((id) => id.toLowerCase() === preferred.toLowerCase());
    if (matched) {
      return matched;
    }
  }

  const imageLike = uniqueIds.find((id) => /image|imagen/i.test(id));
  if (imageLike) {
    return imageLike;
  }

  return uniqueIds[0];
};

const requestGemini = async (env: Env, model: string, body: Record<string, unknown>) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const modelId = normalizeModelId(model);

  const response = await fetch(`${API_BASE}/${modelId}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Gemini API呼び出しに失敗しました。");
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`生成がブロックされました: ${data.promptFeedback.blockReason}`);
  }
  return data;
};

const extractText = (response: GeminiResponse) => {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  throw new Error("Geminiからテキスト応答を取得できませんでした。");
};

const extractImage = (response: GeminiResponse) => {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      if (!inline?.data) {
        continue;
      }
      const mimeType =
        "mimeType" in inline && typeof inline.mimeType === "string"
          ? inline.mimeType
          : "mime_type" in inline && typeof inline.mime_type === "string"
            ? inline.mime_type
            : "image/png";
      return `data:${mimeType};base64,${inline.data}`;
    }
  }
  throw new Error("Geminiから画像応答を取得できませんでした。");
};

const generateStructuredJson = async <T>({
  env,
  systemPrompt,
  userPrompt,
  temperature = 0.4
}: {
  env: Env;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}) => {
  const model = env.GEMINI_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;
  const response = await requestGemini(env, model, {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      temperature,
      responseMimeType: "application/json"
    }
  });

  return parseJsonSafely<T>(extractText(response));
};

const toInlinePartFromDataUrl = (dataUrl: string): GeminiPart => {
  const matched = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matched) {
    throw new Error("Data URL形式が不正です。");
  }
  return {
    inlineData: {
      mimeType: matched[1],
      data: matched[2]
    }
  };
};

const generateMangaImage = async ({
  env,
  prompt,
  referenceDataUrls = [],
  previousImageDataUrl
}: {
  env: Env;
  prompt: string;
  referenceDataUrls?: string[];
  previousImageDataUrl?: string;
}) => {
  const parts: GeminiPart[] = [{ text: prompt }];

  if (referenceDataUrls.length > 0) {
    parts.push({
      text: "以下は固定キャラクター参照画像です。店主・妻の見た目を維持してください。"
    });
    for (const dataUrl of referenceDataUrls) {
      parts.push(toInlinePartFromDataUrl(dataUrl));
    }
  }

  if (previousImageDataUrl) {
    parts.push({ text: "以下は前回生成画像です。構図の意図を保ちながら修正してください。" });
    parts.push(toInlinePartFromDataUrl(previousImageDataUrl));
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts
      }
    ],
    generationConfig: {
      temperature: 0.8,
      responseModalities: ["IMAGE", "TEXT"]
    }
  } satisfies Record<string, unknown>;

  const configuredModel = resolveImageModelAlias(env.GEMINI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL);
  let response: GeminiResponse;
  try {
    response = await requestGemini(env, configuredModel, requestBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini API呼び出しに失敗しました。";
    if (!isRecoverableModelError(message)) {
      throw error;
    }

    const availableModels = await listGeminiModels(env, true);
    const fallbackModel = pickImageFallbackModel(availableModels, configuredModel);
    if (!fallbackModel) {
      throw new Error(
        `画像生成モデル '${configuredModel}' が利用できません。利用可能な generateContent 対応モデルを確認してください。`
      );
    }

    response = await requestGemini(env, fallbackModel, requestBody);
  }

  return extractImage(response);
};

const collectReferenceDataUrls = (ownerReferenceDataUrl?: string, wifeReferenceDataUrl?: string) =>
  [ownerReferenceDataUrl, wifeReferenceDataUrl].filter(
    (value): value is string => typeof value === "string" && value.startsWith("data:image/")
  );

const getAllowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const checkOrigin = (request: Request, env: Env) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    return { allowed: true, origin: null as string | null };
  }

  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.length === 0) {
    return { allowed: false, origin };
  }
  return { allowed: allowedOrigins.includes(origin), origin };
};

const corsHeaders = (origin: string | null): HeadersInit => {
  if (!origin) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
};

const json = (data: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });

const badRequest = (message: string, origin: string | null) => json({ error: message }, 400, origin);

const toPath = (requestUrl: string) => {
  const path = new URL(requestUrl).pathname;
  return path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
};

const summarize = async (request: Request, env: Env, origin: string | null) => {
  const body = (await request.json()) as { postText?: string };
  const postText = body.postText?.trim();
  if (!postText) {
    return badRequest("投稿文が空です。LINE投稿文を入力してください。", origin);
  }

  const raw = await generateStructuredJson<SummaryResult>({
    env,
    systemPrompt: TEXT_SYSTEM_PROMPT,
    userPrompt: summarizePrompt(postText)
  });

  return json({ summary: normalizeSummary(raw) }, 200, origin);
};

const compose = async (request: Request, env: Env, origin: string | null) => {
  const body = (await request.json()) as { summary?: SummaryResult };
  const summary = normalizeSummary(body.summary);

  const raw = await generateStructuredJson<{ patterns: CompositionPattern[] }>({
    env,
    systemPrompt: TEXT_SYSTEM_PROMPT,
    userPrompt: composePrompt(summary)
  });

  return json({ patterns: normalizePatterns(raw) }, 200, origin);
};

const generate = async (request: Request, env: Env, origin: string | null) => {
  const body = (await request.json()) as {
    summary?: unknown;
    pattern?: unknown;
    ownerReferenceDataUrl?: string;
    wifeReferenceDataUrl?: string;
  };

  const summary = normalizeSummary(body.summary);
  const pattern = normalizePatterns({ patterns: [body.pattern] })[0];
  const referenceDataUrls = collectReferenceDataUrls(
    body.ownerReferenceDataUrl,
    body.wifeReferenceDataUrl
  );

  const fourPanelPrompt = imagePrompt({
    summary,
    pattern,
    layout: "four-panel-square"
  });
  const a4Prompt = imagePrompt({
    summary,
    pattern,
    layout: "a4-vertical"
  });

  const [fourPanelImageDataUrl, a4ImageDataUrl] = await Promise.all([
    generateMangaImage({
      env,
      prompt: fourPanelPrompt,
      referenceDataUrls
    }),
    generateMangaImage({
      env,
      prompt: a4Prompt,
      referenceDataUrls
    })
  ]);

  return json(
    {
      fourPanelImageDataUrl,
      a4ImageDataUrl,
      fourPanelPrompt,
      a4Prompt
    },
    200,
    origin
  );
};

const revise = async (request: Request, env: Env, origin: string | null) => {
  const body = (await request.json()) as {
    summary?: unknown;
    pattern?: unknown;
    revisionInstruction?: string;
    ownerReferenceDataUrl?: string;
    wifeReferenceDataUrl?: string;
    previousFourPanelImageDataUrl?: string;
    previousA4ImageDataUrl?: string;
  };

  const revisionInstruction = body.revisionInstruction?.trim();
  if (!revisionInstruction) {
    return badRequest("修正指示を入力してください。", origin);
  }

  const summary = normalizeSummary(body.summary);
  const pattern = normalizePatterns({ patterns: [body.pattern] })[0];
  const referenceDataUrls = collectReferenceDataUrls(
    body.ownerReferenceDataUrl,
    body.wifeReferenceDataUrl
  );

  const fourPanelPrompt = imagePrompt({
    summary,
    pattern,
    layout: "four-panel-square",
    revisionInstruction
  });
  const a4Prompt = imagePrompt({
    summary,
    pattern,
    layout: "a4-vertical",
    revisionInstruction
  });

  const [fourPanelImageDataUrl, a4ImageDataUrl] = await Promise.all([
    generateMangaImage({
      env,
      prompt: fourPanelPrompt,
      referenceDataUrls,
      previousImageDataUrl: body.previousFourPanelImageDataUrl
    }),
    generateMangaImage({
      env,
      prompt: a4Prompt,
      referenceDataUrls,
      previousImageDataUrl: body.previousA4ImageDataUrl
    })
  ]);

  return json(
    {
      fourPanelImageDataUrl,
      a4ImageDataUrl,
      fourPanelPrompt,
      a4Prompt
    },
    200,
    origin
  );
};

export default {
  async fetch(request, env): Promise<Response> {
    const path = toPath(request.url);
    const originState = checkOrigin(request, env);

    if (request.method === "OPTIONS") {
      if (!originState.allowed) {
        return json({ error: "Origin is not allowed." }, 403, null);
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders(originState.origin)
      });
    }

    if (!originState.allowed) {
      return json({ error: "Origin is not allowed." }, 403, null);
    }

    if (request.method === "GET" && path === "/api/health") {
      return json(
        {
          ok: true,
          now: new Date().toISOString()
        },
        200,
        originState.origin
      );
    }

    if (request.method !== "POST") {
      return json({ error: "Not Found" }, 404, originState.origin);
    }

    try {
      switch (path) {
        case "/api/summarize":
          return await summarize(request, env, originState.origin);
        case "/api/compose":
          return await compose(request, env, originState.origin);
        case "/api/generate":
          return await generate(request, env, originState.origin);
        case "/api/revise":
          return await revise(request, env, originState.origin);
        default:
          return json({ error: "Not Found" }, 404, originState.origin);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "処理中にエラーが発生しました。";
      return json({ error: message }, 500, originState.origin);
    }
  }
} satisfies ExportedHandler<Env>;
