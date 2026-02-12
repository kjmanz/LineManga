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
type MangaLayout = "four-panel-square" | "a4-vertical";

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

type GeminiBatchInlinedRequest = {
  request: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type GeminiBatchInlineError = {
  message?: string;
};

type GeminiBatchInlinedResponse = {
  metadata?: Record<string, unknown>;
  response?: GeminiResponse;
  error?: GeminiBatchInlineError;
};

type GeminiBatchOperation = {
  name?: string;
  done?: boolean;
  metadata?: Record<string, unknown>;
  response?: {
    inlinedResponses?:
      | GeminiBatchInlinedResponse[]
      | {
          inlinedResponses?: GeminiBatchInlinedResponse[];
        };
    responsesFile?: string;
    state?: string;
  } & Record<string, unknown>;
  error?: {
    message?: string;
  };
};

type GeminiFileResource = {
  name?: string;
  mimeType?: string;
  mime_type?: string;
  state?: string;
  downloadUri?: string;
  download_uri?: string;
  error?: {
    message?: string;
  };
};

type GeminiFileUploadResponse = {
  file?: GeminiFileResource;
  error?: {
    message?: string;
  };
};

type GeminiBatchFileRequest = {
  key: string;
  request: Record<string, unknown>;
};

type GeminiBatchFileResponse = {
  key?: string;
  response?: GeminiResponse | { response?: GeminiResponse };
  error?: {
    message?: string;
  };
  status?: {
    message?: string;
  };
};

type BatchImageResult = {
  patternId: string;
  patternType: PatternType;
  patternTitle: string;
  layout: MangaLayout;
  prompt: string;
  imageDataUrl: string;
};

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const API_BASE = `${API_ROOT}/models`;
const FILE_API_BASE = `${API_ROOT}/files`;
const FILE_UPLOAD_API = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const DEFAULT_TEXT_MODEL = "gemini-3-flash-preview";
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
const MODEL_LIST_CACHE_MS = 1000 * 60 * 10;
const GEMINI_MAX_RETRIES = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 1200;
const BATCH_POLL_INTERVAL_MS = 5000;
const BATCH_PATTERNS_PER_JOB = 1;
const BATCH_FILE_MIME_TYPE = "application/jsonl";
const BATCH_KEY_PREFIX = "line-manga";
const BATCH_TERMINAL_KEYWORDS = ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"];
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
  layout: MangaLayout;
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

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const parseGeminiResponseText = (rawText: string): GeminiResponse | null => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as GeminiResponse;
  } catch {
    return null;
  }
};

const buildGeminiErrorMessage = (status: number, response: GeminiResponse | null, rawText: string) => {
  const apiMessage = response?.error?.message?.trim();
  if (apiMessage) {
    return apiMessage;
  }

  const trimmed = rawText.trim();
  if (trimmed) {
    return `Gemini API呼び出しに失敗しました。(${status}) ${trimmed.slice(0, 200)}`;
  }

  return `Gemini API呼び出しに失敗しました。(${status})`;
};

const isRetryableGeminiError = (status: number, message: string) =>
  [408, 409, 425, 429, 500, 502, 503, 504].includes(status) ||
  /high demand|spikes in demand|try again later|resource[_\s-]*exhausted|rate limit|temporarily unavailable|overloaded|backend error/i.test(
    message
  );

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
  /not found|not supported for (generatecontent|batchgeneratecontent)|unsupported/i.test(message);

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

const withImageModelFallback = async <T>(
  env: Env,
  action: (modelId: string) => Promise<T>,
  preferredModel?: string
) => {
  const configuredModel = resolveImageModelAlias(preferredModel ?? env.GEMINI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL);
  try {
    return await action(configuredModel);
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
    if (fallbackModel.toLowerCase() === configuredModel.toLowerCase()) {
      throw error;
    }
    return action(fallbackModel);
  }
};

const requestGemini = async (env: Env, model: string, body: Record<string, unknown>) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const modelId = normalizeModelId(model);

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${API_BASE}/${modelId}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const rawText = await response.text();
    const data = parseGeminiResponseText(rawText);

    if (response.ok && data) {
      if (data.promptFeedback?.blockReason) {
        throw new Error(`生成がブロックされました: ${data.promptFeedback.blockReason}`);
      }
      return data;
    }

    const message = response.ok
      ? "Gemini API応答の解析に失敗しました。"
      : buildGeminiErrorMessage(response.status, data, rawText);
    const canRetry =
      attempt < GEMINI_MAX_RETRIES &&
      (response.ok ? true : isRetryableGeminiError(response.status, message));
    if (!canRetry) {
      throw new Error(message);
    }

    const delayMs = GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt;
    await wait(delayMs);
  }

  throw new Error("Gemini API呼び出しに失敗しました。");
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

const buildMangaImageParts = ({
  prompt,
  referenceDataUrls = [],
  previousImageDataUrl
}: {
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

  return parts;
};

const buildMangaImageRequestBody = (parts: GeminiPart[]) =>
  ({
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
  }) satisfies Record<string, unknown>;

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
  const parts = buildMangaImageParts({
    prompt,
    referenceDataUrls,
    previousImageDataUrl
  });
  const requestBody = buildMangaImageRequestBody(parts);
  const response = await withImageModelFallback(env, (modelId) => requestGemini(env, modelId, requestBody));
  return extractImage(response);
};

const requestGeminiBatchGenerateInline = async (
  env: Env,
  model: string,
  requests: GeminiBatchInlinedRequest[],
  displayName: string
) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const modelId = normalizeModelId(model);

  const response = await fetch(`${API_BASE}/${modelId}:batchGenerateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      batch: {
        displayName,
        inputConfig: {
          requests: {
            requests
          }
        }
      }
    })
  });

  const data = (await response.json()) as GeminiBatchOperation;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Gemini Batch API呼び出しに失敗しました。");
  }
  if (!data.name) {
    throw new Error("Batchジョブ名の取得に失敗しました。");
  }
  return data;
};

const requestGeminiBatchGenerateWithFile = async (
  env: Env,
  model: string,
  fileName: string,
  displayName: string
) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const modelId = normalizeModelId(model);

  const response = await fetch(`${API_BASE}/${modelId}:batchGenerateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      batch: {
        displayName,
        inputConfig: {
          mimeType: BATCH_FILE_MIME_TYPE,
          fileName: normalizeFileName(fileName)
        }
      }
    })
  });

  const data = (await response.json()) as GeminiBatchOperation;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Gemini Batch API(file input)呼び出しに失敗しました。");
  }
  if (!data.name) {
    throw new Error("Batchジョブ名の取得に失敗しました。");
  }
  return data;
};

const normalizeBatchName = (value: string) => {
  const trimmed = value.trim().replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
  const unversioned = trimmed.replace(/^v1beta\//, "");
  return unversioned.startsWith("batches/") ? unversioned : trimmed;
};

const normalizeFileName = (value: string) => {
  const trimmed = value.trim().replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
  const unversioned = trimmed.replace(/^v1beta\//, "");
  return unversioned.startsWith("files/") ? unversioned : trimmed;
};

const readJsonSafely = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const uploadBatchInputFile = async (env: Env, jsonlContent: string, displayName: string) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }

  const fileBytes = new TextEncoder().encode(jsonlContent);
  const startResponse = await fetch(`${FILE_UPLOAD_API}?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": `${fileBytes.byteLength}`,
      "X-Goog-Upload-Header-Content-Type": BATCH_FILE_MIME_TYPE,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file: {
        displayName: `${displayName}.jsonl`
      }
    })
  });

  const startData = await readJsonSafely<GeminiFileUploadResponse>(startResponse);
  if (!startResponse.ok) {
    throw new Error(startData?.error?.message ?? "Batch入力ファイルのアップロード開始に失敗しました。");
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Batch入力ファイルのアップロードURL取得に失敗しました。");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "Content-Type": BATCH_FILE_MIME_TYPE
    },
    body: fileBytes
  });

  const uploadData = await readJsonSafely<GeminiFileUploadResponse | GeminiFileResource>(uploadResponse);
  if (!uploadResponse.ok) {
    const message =
      (uploadData as GeminiFileUploadResponse | null)?.error?.message ??
      (uploadData as GeminiFileResource | null)?.error?.message;
    throw new Error(message ?? "Batch入力ファイルのアップロードに失敗しました。");
  }

  const uploadedFile =
    (uploadData as GeminiFileUploadResponse | null)?.file ?? (uploadData as GeminiFileResource | null);
  if (!uploadedFile?.name) {
    throw new Error("Batch入力ファイル名の取得に失敗しました。");
  }

  return normalizeFileName(uploadedFile.name);
};

const requestGeminiFile = async (env: Env, fileName: string): Promise<GeminiFileResource> => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const normalizedFileName = normalizeFileName(fileName);
  if (!normalizedFileName.startsWith("files/")) {
    throw new Error("fileName は `files/...` 形式で指定してください。");
  }

  const response = await fetch(
    `${FILE_API_BASE}/${normalizedFileName.slice("files/".length)}?key=${env.GEMINI_API_KEY}`
  );
  const data = await readJsonSafely<GeminiFileResource | { file?: GeminiFileResource }>(response);
  const file =
    data && typeof data === "object" && "file" in data ? (data as { file?: GeminiFileResource }).file : data;
  if (!response.ok || !file) {
    const message =
      data && typeof data === "object" && "error" in data
        ? ((data as GeminiFileResource).error?.message ?? "Batch結果ファイル情報の取得に失敗しました。")
        : "Batch結果ファイル情報の取得に失敗しました。";
    throw new Error(message);
  }
  return file as GeminiFileResource;
};

const downloadGeminiFileContent = async (env: Env, file: GeminiFileResource) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const fileName = normalizeFileName(cleanText(file.name, ""));
  const downloadUri = cleanText(file.downloadUri ?? file.download_uri, "");

  const attempts: Array<{ url: string; headers?: HeadersInit }> = [];
  if (downloadUri) {
    attempts.push({ url: downloadUri });
    attempts.push({
      url: downloadUri,
      headers: { "x-goog-api-key": env.GEMINI_API_KEY }
    });
  }
  if (fileName.startsWith("files/")) {
    attempts.push({
      url: `${FILE_API_BASE}/${fileName.slice("files/".length)}:download?key=${env.GEMINI_API_KEY}`
    });
  }

  let lastError = "Batch結果ファイルのダウンロードに失敗しました。";
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, {
      method: "GET",
      headers: attempt.headers
    });
    if (response.ok) {
      return response.text();
    }
    const data = await readJsonSafely<{ error?: { message?: string } }>(response);
    lastError = data?.error?.message ?? `HTTP ${response.status}`;
  }

  throw new Error(lastError);
};

const requestGeminiBatchStatus = async (env: Env, batchName: string) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Cloudflare Worker secret `GEMINI_API_KEY` が未設定です。");
  }
  const normalizedName = normalizeBatchName(batchName);
  if (!normalizedName.startsWith("batches/")) {
    throw new Error("batchName は `batches/...` 形式で指定してください。");
  }

  const response = await fetch(`${API_ROOT}/${normalizedName}?key=${env.GEMINI_API_KEY}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });
  const data = (await response.json()) as GeminiBatchOperation;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Batchジョブ状態の取得に失敗しました。");
  }
  return data;
};

const getBatchState = (operation: GeminiBatchOperation) => {
  const metadataState =
    operation.metadata && typeof operation.metadata.state === "string"
      ? operation.metadata.state
      : undefined;
  if (metadataState) {
    return metadataState;
  }
  if (typeof operation.response?.state === "string") {
    return operation.response.state;
  }
  return operation.done ? "SUCCEEDED" : "RUNNING";
};

const isTerminalBatchState = (state: string) => {
  const upper = state.toUpperCase();
  return BATCH_TERMINAL_KEYWORDS.some((keyword) => upper.includes(keyword));
};

const isSuccessfulBatchState = (state: string) => state.toUpperCase().includes("SUCCEEDED");

const extractInlinedBatchResponses = (operation: GeminiBatchOperation): GeminiBatchInlinedResponse[] => {
  const container = operation.response?.inlinedResponses;
  if (Array.isArray(container)) {
    return container;
  }
  if (container && Array.isArray(container.inlinedResponses)) {
    return container.inlinedResponses;
  }
  return [];
};

const toBatchRequestKey = (pattern: CompositionPattern, layout: MangaLayout) =>
  [
    BATCH_KEY_PREFIX,
    encodeURIComponent(pattern.id),
    layout,
    encodeURIComponent(pattern.patternType),
    encodeURIComponent(pattern.title)
  ].join("|");

const parseBatchRequestKey = (key: unknown) => {
  if (typeof key !== "string") {
    return null;
  }
  const parts = key.split("|");
  if (parts.length < 3 || parts[0] !== BATCH_KEY_PREFIX) {
    return null;
  }
  try {
    const patternId = decodeURIComponent(parts[1]);
    const layout = parts[2] === "a4-vertical" ? "a4-vertical" : "four-panel-square";
    const patternType =
      parts.length >= 4 ? normalizePatternType(decodeURIComponent(parts[3])) : ("共感型" satisfies PatternType);
    const patternTitle =
      parts.length >= 5 ? cleanText(decodeURIComponent(parts[4]), "提案パターン") : "提案パターン";

    return {
      patternId: cleanText(patternId, "pattern-unknown"),
      layout,
      patternType,
      patternTitle
    } as const;
  } catch {
    return null;
  }
};

const parseInlinedBatchImageResults = (operation: GeminiBatchOperation) => {
  const inlinedResponses = extractInlinedBatchResponses(operation);
  const results: BatchImageResult[] = [];
  const errors: string[] = [];

  for (const entry of inlinedResponses) {
    const metadata = entry.metadata ?? {};
    const decoded = parseBatchRequestKey(metadata.key);
    const patternId = cleanText(metadata.patternId, decoded?.patternId ?? "pattern-unknown");
    const patternType = normalizePatternType(metadata.patternType ?? decoded?.patternType);
    const patternTitle = cleanText(metadata.patternTitle, decoded?.patternTitle ?? "提案パターン");
    const layout =
      metadata.layout === "a4-vertical" || decoded?.layout === "a4-vertical"
        ? "a4-vertical"
        : "four-panel-square";
    const prompt = cleanText(metadata.prompt, "");

    if (entry.error?.message) {
      errors.push(`${patternId}/${layout}: ${entry.error.message}`);
      continue;
    }
    if (!entry.response) {
      errors.push(`${patternId}/${layout}: 画像応答がありません。`);
      continue;
    }

    try {
      results.push({
        patternId,
        patternType,
        patternTitle,
        layout,
        prompt,
        imageDataUrl: extractImage(entry.response)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "画像解析に失敗しました。";
      errors.push(`${patternId}/${layout}: ${message}`);
    }
  }

  return { results, errors };
};

const parseBatchFileResponseRecords = (fileContent: string): GeminiBatchFileResponse[] => {
  const records: GeminiBatchFileResponse[] = [];
  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    try {
      records.push(JSON.parse(line) as GeminiBatchFileResponse);
    } catch {
      continue;
    }
  }
  return records;
};

const unwrapFileResponse = (entry: GeminiBatchFileResponse) => {
  if (!entry.response) {
    return null;
  }
  if ("candidates" in entry.response) {
    return entry.response as GeminiResponse;
  }
  if (
    typeof entry.response === "object" &&
    entry.response !== null &&
    "response" in entry.response &&
    entry.response.response
  ) {
    return entry.response.response;
  }
  return null;
};

const parseBatchFileImageResults = (fileResponses: GeminiBatchFileResponse[]) => {
  const results: BatchImageResult[] = [];
  const errors: string[] = [];

  for (const entry of fileResponses) {
    const decoded = parseBatchRequestKey(entry.key);
    const patternId = decoded?.patternId ?? "pattern-unknown";
    const layout = decoded?.layout ?? "four-panel-square";
    const patternType = decoded?.patternType ?? "共感型";
    const patternTitle = decoded?.patternTitle ?? "提案パターン";
    const response = unwrapFileResponse(entry);
    const entryError = entry.error?.message ?? entry.status?.message;

    if (entryError) {
      errors.push(`${patternId}/${layout}: ${entryError}`);
      continue;
    }
    if (!response) {
      errors.push(`${patternId}/${layout}: 画像応答がありません。`);
      continue;
    }

    try {
      results.push({
        patternId,
        patternType,
        patternTitle,
        layout,
        prompt: "",
        imageDataUrl: extractImage(response)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "画像解析に失敗しました。";
      errors.push(`${patternId}/${layout}: ${message}`);
    }
  }

  return { results, errors };
};

const toBatchImageRequest = ({
  pattern,
  layout,
  prompt,
  referenceDataUrls,
  previousImageDataUrl
}: {
  pattern: CompositionPattern;
  layout: MangaLayout;
  prompt: string;
  referenceDataUrls: string[];
  previousImageDataUrl?: string;
}): GeminiBatchInlinedRequest => {
  const parts = buildMangaImageParts({
    prompt,
    referenceDataUrls,
    previousImageDataUrl
  });
  return {
    request: buildMangaImageRequestBody(parts),
    metadata: {
      key: toBatchRequestKey(pattern, layout),
      patternId: pattern.id,
      patternType: pattern.patternType,
      patternTitle: pattern.title,
      layout,
      prompt
    }
  };
};

const toBatchFileRequest = (request: GeminiBatchInlinedRequest, index: number): GeminiBatchFileRequest => {
  const metadata = request.metadata ?? {};
  const rawKey = cleanText(metadata.key, "");
  const fallbackKey = `${BATCH_KEY_PREFIX}|pattern-${index + 1}|four-panel-square`;
  return {
    key: rawKey || fallbackKey,
    request: request.request
  };
};

const createImageBatch = async ({
  env,
  requests,
  displayName
}: {
  env: Env;
  requests: GeminiBatchInlinedRequest[];
  displayName: string;
}) => {
  const fileRequests = requests.map(toBatchFileRequest);
  const jsonlContent = fileRequests.map((entry) => JSON.stringify(entry)).join("\n");

  try {
    const fileName = await uploadBatchInputFile(env, jsonlContent, displayName);
    const operation = await withImageModelFallback(env, (modelId) =>
      requestGeminiBatchGenerateWithFile(env, modelId, fileName, displayName)
    );
    return operation.name as string;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Batch file inputに失敗したためinlineにフォールバックします。";
    console.warn(`Batch file input failed: ${message}`);
  }

  const operation = await withImageModelFallback(env, (modelId) =>
    requestGeminiBatchGenerateInline(env, modelId, requests, `${displayName}-inline`)
  );
  return operation.name as string;
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

const buildPatternPrompts = ({
  summary,
  pattern,
  revisionInstruction
}: {
  summary: SummaryResult;
  pattern: CompositionPattern;
  revisionInstruction?: string;
}) => {
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
  return { fourPanelPrompt, a4Prompt };
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

  const { fourPanelPrompt, a4Prompt } = buildPatternPrompts({
    summary,
    pattern
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

  const { fourPanelPrompt, a4Prompt } = buildPatternPrompts({
    summary,
    pattern,
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

const batchGenerate = async (request: Request, env: Env, origin: string | null) => {
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
  const { fourPanelPrompt, a4Prompt } = buildPatternPrompts({
    summary,
    pattern
  });

  const requests: GeminiBatchInlinedRequest[] = [
    toBatchImageRequest({
      pattern,
      layout: "four-panel-square",
      prompt: fourPanelPrompt,
      referenceDataUrls
    }),
    toBatchImageRequest({
      pattern,
      layout: "a4-vertical",
      prompt: a4Prompt,
      referenceDataUrls
    })
  ];

  const batchName = await createImageBatch({
    env,
    requests,
    displayName: `line-manga-generate-${Date.now()}`
  });

  return json(
    {
      batchName,
      requestCount: requests.length,
      pollIntervalMs: BATCH_POLL_INTERVAL_MS
    },
    200,
    origin
  );
};

const batchGenerateAll = async (request: Request, env: Env, origin: string | null) => {
  const body = (await request.json()) as {
    summary?: unknown;
    patterns?: unknown;
    ownerReferenceDataUrl?: string;
    wifeReferenceDataUrl?: string;
  };

  const summary = normalizeSummary(body.summary);
  const patterns = normalizePatterns({ patterns: body.patterns });
  const referenceDataUrls = collectReferenceDataUrls(
    body.ownerReferenceDataUrl,
    body.wifeReferenceDataUrl
  );
  const patternGroups: CompositionPattern[][] = [];
  for (let index = 0; index < patterns.length; index += BATCH_PATTERNS_PER_JOB) {
    patternGroups.push(patterns.slice(index, index + BATCH_PATTERNS_PER_JOB));
  }

  const batchJobs = await Promise.all(
    patternGroups.map(async (group, groupIndex) => {
      const requests = group.flatMap((pattern) => {
        const { fourPanelPrompt, a4Prompt } = buildPatternPrompts({
          summary,
          pattern
        });
        return [
          toBatchImageRequest({
            pattern,
            layout: "four-panel-square",
            prompt: fourPanelPrompt,
            referenceDataUrls
          }),
          toBatchImageRequest({
            pattern,
            layout: "a4-vertical",
            prompt: a4Prompt,
            referenceDataUrls
          })
        ];
      });

      const batchName = await createImageBatch({
        env,
        requests,
        displayName: `line-manga-generate-all-${Date.now()}-${groupIndex + 1}`
      });

      return {
        batchName,
        requestCount: requests.length,
        patternIds: group.map((pattern) => pattern.id)
      };
    })
  );

  const totalRequestCount = batchJobs.reduce((total, job) => total + job.requestCount, 0);

  return json(
    {
      batchName: batchJobs[0]?.batchName ?? null,
      batchJobs,
      requestCount: totalRequestCount,
      patternCount: patterns.length,
      pollIntervalMs: BATCH_POLL_INTERVAL_MS
    },
    200,
    origin
  );
};

const batchRevise = async (request: Request, env: Env, origin: string | null) => {
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
  const { fourPanelPrompt, a4Prompt } = buildPatternPrompts({
    summary,
    pattern,
    revisionInstruction
  });

  const requests: GeminiBatchInlinedRequest[] = [
    toBatchImageRequest({
      pattern,
      layout: "four-panel-square",
      prompt: fourPanelPrompt,
      referenceDataUrls,
      previousImageDataUrl: body.previousFourPanelImageDataUrl
    }),
    toBatchImageRequest({
      pattern,
      layout: "a4-vertical",
      prompt: a4Prompt,
      referenceDataUrls,
      previousImageDataUrl: body.previousA4ImageDataUrl
    })
  ];

  const batchName = await createImageBatch({
    env,
    requests,
    displayName: `line-manga-revise-${Date.now()}`
  });

  return json(
    {
      batchName,
      requestCount: requests.length,
      pollIntervalMs: BATCH_POLL_INTERVAL_MS
    },
    200,
    origin
  );
};

const batchStatus = async (request: Request, env: Env, origin: string | null) => {
  const body = (await request.json()) as { batchName?: string };
  const batchName = body.batchName?.trim();
  if (!batchName) {
    return badRequest("batchName を指定してください。", origin);
  }

  const operation = await requestGeminiBatchStatus(env, batchName);
  const state = getBatchState(operation);
  const done = operation.done === true || isTerminalBatchState(state);

  if (!done) {
    return json(
      {
        done: false,
        state,
        batchName: normalizeBatchName(batchName),
        pollIntervalMs: BATCH_POLL_INTERVAL_MS
      },
      200,
      origin
    );
  }

  if (operation.error?.message) {
    return json(
      {
        done: true,
        state,
        batchName: normalizeBatchName(batchName),
        error: operation.error.message
      },
      200,
      origin
    );
  }

  if (!isSuccessfulBatchState(state)) {
    return json(
      {
        done: true,
        state,
        batchName: normalizeBatchName(batchName),
        error: `Batchが失敗しました: ${state}`
      },
      200,
      origin
    );
  }

  const inlined = parseInlinedBatchImageResults(operation);
  let results = inlined.results;
  const errors = [...inlined.errors];

  if (results.length === 0 && operation.response?.responsesFile) {
    const outputFile = await requestGeminiFile(env, operation.response.responsesFile);
    const outputContent = await downloadGeminiFileContent(env, outputFile);
    const fileEntries = parseBatchFileResponseRecords(outputContent);
    const parsedFromFile = parseBatchFileImageResults(fileEntries);
    results = parsedFromFile.results;
    errors.push(...parsedFromFile.errors);
  }

  if (results.length === 0 && errors.length === 0) {
    errors.push("Batch結果から画像を取得できませんでした。");
  }

  if (errors.length > 0 && results.length === 0) {
    return json(
      {
        done: true,
        state,
        batchName: normalizeBatchName(batchName),
        error: errors.join(" | "),
        results: []
      },
      200,
      origin
    );
  }

  if (errors.length > 0) {
    return json(
      {
        done: true,
        state,
        batchName: normalizeBatchName(batchName),
        error: errors.join(" | "),
        results
      },
      200,
      origin
    );
  }

  return json(
    {
      done: true,
      state,
      batchName: normalizeBatchName(batchName),
      results
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
        case "/api/batch-generate":
          return await batchGenerate(request, env, originState.origin);
        case "/api/batch-generate-all":
          return await batchGenerateAll(request, env, originState.origin);
        case "/api/batch-revise":
          return await batchRevise(request, env, originState.origin);
        case "/api/batch-status":
          return await batchStatus(request, env, originState.origin);
        default:
          return json({ error: "Not Found" }, 404, originState.origin);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "処理中にエラーが発生しました。";
      return json({ error: message }, 500, originState.origin);
    }
  }
} satisfies ExportedHandler<Env>;
