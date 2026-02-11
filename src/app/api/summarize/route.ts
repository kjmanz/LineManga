import { NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { summarizePrompt, TEXT_SYSTEM_PROMPT } from "@/lib/prompts";
import { normalizeSummary, type SummaryResult } from "@/lib/types";

type SummarizeRequest = {
  postText?: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SummarizeRequest;
    const postText = body.postText?.trim();
    if (!postText) {
      return NextResponse.json(
        { error: "投稿文が空です。LINE投稿文を入力してください。" },
        { status: 400 }
      );
    }

    const raw = await generateStructuredJson<SummaryResult>({
      systemPrompt: TEXT_SYSTEM_PROMPT,
      userPrompt: summarizePrompt(postText)
    });

    return NextResponse.json({
      summary: normalizeSummary(raw)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "要点抽出に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
