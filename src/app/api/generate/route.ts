import { NextResponse } from "next/server";
import { generateMangaImage } from "@/lib/gemini";
import { imagePrompt } from "@/lib/prompts";
import { normalizePatterns, normalizeSummary } from "@/lib/types";

type GenerateRequest = {
  summary?: unknown;
  pattern?: unknown;
  ownerReferenceDataUrl?: string;
  wifeReferenceDataUrl?: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const collectReferenceDataUrls = (ownerReferenceDataUrl?: string, wifeReferenceDataUrl?: string) => {
  return [ownerReferenceDataUrl, wifeReferenceDataUrl].filter(
    (value): value is string => typeof value === "string" && value.startsWith("data:image/")
  );
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const summary = normalizeSummary(body.summary);
    const pattern = normalizePatterns({ patterns: [body.pattern] })[0];

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

    const referenceDataUrls = collectReferenceDataUrls(
      body.ownerReferenceDataUrl,
      body.wifeReferenceDataUrl
    );

    const [fourPanelImageDataUrl, a4ImageDataUrl] = await Promise.all([
      generateMangaImage({
        prompt: fourPanelPrompt,
        referenceDataUrls
      }),
      generateMangaImage({
        prompt: a4Prompt,
        referenceDataUrls
      })
    ]);

    return NextResponse.json({
      fourPanelImageDataUrl,
      a4ImageDataUrl,
      fourPanelPrompt,
      a4Prompt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像生成に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
