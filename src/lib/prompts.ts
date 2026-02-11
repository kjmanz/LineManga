import type { CompositionPattern, SummaryResult } from "@/lib/types";

export const TEXT_SYSTEM_PROMPT = `
あなたは「地域密着の電気屋さん向け漫画コンテンツディレクター」です。
対象読者は50代以上の地域のお客様です。
読みやすく、親しみやすく、短いセリフで伝えてください。
必ず行動導線（CTA）を含めてください。
出力は指定したJSON形式のみで返答してください。
`.trim();

export const summarizePrompt = (postText: string) => `
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

export const composePrompt = (summary: SummaryResult) => `
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
- A4縦は「導入・共感・解決・行動」の順
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

type PromptInput = {
  summary: SummaryResult;
  pattern: CompositionPattern;
  layout: "four-panel-square" | "a4-vertical";
  revisionInstruction?: string;
};

const panelText = (pattern: CompositionPattern) =>
  pattern.fourPanels
    .map(
      (panel) =>
        `コマ${panel.panel}
- シーン: ${panel.scene}
- セリフ: ${panel.dialogue}`
    )
    .join("\n");

export const imagePrompt = ({
  summary,
  pattern,
  layout,
  revisionInstruction
}: PromptInput) => {
  const sizeInstruction =
    layout === "four-panel-square"
      ? "1080x1080pxの正方形1枚に4コマをレイアウト。"
      : "2480x3508pxのA4縦1枚に、導入→共感→解決→行動の順でレイアウト。";

  const layoutInstruction =
    layout === "four-panel-square"
      ? "4コマは田の字または縦1列で読みやすく配置。"
      : "A4は見出しと吹き出しを整理し、印刷時に文字が潰れないサイズにする。";

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
