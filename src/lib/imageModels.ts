export type ImageModelId =
  | "nano-banana-2-lite"
  | "nano-banana-2"
  | "nano-banana-pro"
  | "gpt-image-2";

export type ImageModelOption = {
  id: ImageModelId;
  label: string;
  description: string;
  provider: "gemini" | "openai";
  estimatedCostPerImageUsd: number;
};

export const DEFAULT_IMAGE_MODEL_ID: ImageModelId = "nano-banana-2-lite";

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    id: "nano-banana-2-lite",
    label: "Gemini Flash Lite",
    description: "最安・高速。日常生成向け",
    provider: "gemini",
    estimatedCostPerImageUsd: 0.034
  },
  {
    id: "nano-banana-2",
    label: "Gemini Flash",
    description: "バランス型。品質と速度の中間",
    provider: "gemini",
    estimatedCostPerImageUsd: 0.067
  },
  {
    id: "nano-banana-pro",
    label: "Gemini Pro",
    description: "高品質。細部までしっかり",
    provider: "gemini",
    estimatedCostPerImageUsd: 0.134
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    description: "OpenAI最新。文字描写が強い",
    provider: "openai",
    estimatedCostPerImageUsd: 0.053
  }
];

export const isImageModelId = (value: unknown): value is ImageModelId =>
  typeof value === "string" && IMAGE_MODEL_OPTIONS.some((option) => option.id === value);

export const resolveImageModelOption = (modelId: ImageModelId) =>
  IMAGE_MODEL_OPTIONS.find((option) => option.id === modelId) ?? IMAGE_MODEL_OPTIONS[0];

export const estimateImageCostUsd = (modelId: ImageModelId, imageCount: number) =>
  resolveImageModelOption(modelId).estimatedCostPerImageUsd * imageCount;
