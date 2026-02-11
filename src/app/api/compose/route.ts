import { NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { composePrompt, TEXT_SYSTEM_PROMPT } from "@/lib/prompts";
import {
  normalizePatterns,
  normalizeSummary,
  type CompositionPattern,
  type SummaryResult
} from "@/lib/types";

type ComposeRequest = {
  summary?: SummaryResult;
};

type ComposeResponse = {
  patterns: CompositionPattern[];
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ComposeRequest;
    const summary = normalizeSummary(body.summary);

    const raw = await generateStructuredJson<ComposeResponse>({
      systemPrompt: TEXT_SYSTEM_PROMPT,
      userPrompt: composePrompt(summary)
    });

    return NextResponse.json({
      patterns: normalizePatterns(raw)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "構成案の生成に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
