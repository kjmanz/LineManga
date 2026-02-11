import { NextResponse } from "next/server";
import { generateMangaImage } from "@/lib/gemini";
import { imagePrompt } from "@/lib/prompts";
import { normalizePatterns, normalizeSummary } from "@/lib/types";

type ReviseRequest = {
  summary?: unknown;
  pattern?: unknown;
  revisionInstruction?: string;
  ownerReferenceDataUrl?: string;
  wifeReferenceDataUrl?: string;
  previousFourPanelImageDataUrl?: string;
  previousA4ImageDataUrl?: string;
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
    const body = (await request.json()) as ReviseRequest;
    const summary = normalizeSummary(body.summary);
    const pattern = normalizePatterns({ patterns: [body.pattern] })[0];
    const revisionInstruction = body.revisionInstruction?.trim();

    if (!revisionInstruction) {
      return NextResponse.json({ error: "修正指示を入力してください。" }, { status: 400 });
    }

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

    const referenceDataUrls = collectReferenceDataUrls(
      body.ownerReferenceDataUrl,
      body.wifeReferenceDataUrl
    );

    const [fourPanelImageDataUrl, a4ImageDataUrl] = await Promise.all([
      generateMangaImage({
        prompt: fourPanelPrompt,
        referenceDataUrls,
        previousImageDataUrl: body.previousFourPanelImageDataUrl
      }),
      generateMangaImage({
        prompt: a4Prompt,
        referenceDataUrls,
        previousImageDataUrl: body.previousA4ImageDataUrl
      })
    ]);

    return NextResponse.json({
      fourPanelImageDataUrl,
      a4ImageDataUrl,
      fourPanelPrompt,
      a4Prompt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "修正再生成に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
