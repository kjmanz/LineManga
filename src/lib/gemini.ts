const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY が未設定です。");
  }
  return key;
};

const getTextModel = () => process.env.GEMINI_TEXT_MODEL ?? "gemini-3-pro";
const getImageModel = () => process.env.GEMINI_IMAGE_MODEL ?? "nano-banana-pro";

const requestGemini = async (model: string, body: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE}/${model}:generateContent?key=${getApiKey()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
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
      if (inline?.data) {
        const mimeType =
          "mimeType" in inline && typeof inline.mimeType === "string"
            ? inline.mimeType
            : "mime_type" in inline && typeof inline.mime_type === "string"
            ? inline.mime_type
            : "image/png";
        return `data:${mimeType};base64,${inline.data}`;
      }
    }
  }
  throw new Error("Geminiから画像応答を取得できませんでした。");
};

const parseJsonSafely = <T>(rawText: string): T => {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("JSONの解析に失敗しました。");
    }
    return JSON.parse(match[0]) as T;
  }
};

export const generateStructuredJson = async <T>({
  systemPrompt,
  userPrompt,
  temperature = 0.4
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}) => {
  const response = await requestGemini(getTextModel(), {
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

  const text = extractText(response);
  return parseJsonSafely<T>(text);
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

export const generateMangaImage = async ({
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

  const response = await requestGemini(getImageModel(), {
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
  });

  return extractImage(response);
};
