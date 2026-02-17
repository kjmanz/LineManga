export type SummaryResult = {
  mainTheme: string;
  targetPersona: string;
  painPoints: string[];
  keyFacts: string[];
  solutionMessage: string;
  ctaCandidates: string[];
  toneNotes: string;
};

export type MangaPanel = {
  panel: 1 | 2 | 3 | 4;
  scene: string;
  dialogue: string;
};

export type A4Flow = {
  intro: string;
  empathy: string;
  solution: string;
  action: string;
};

export type PatternType = "共感型" | "驚き型" | "体験談型";
export type GenerationMode = "batch" | "standard";

export type CompositionPattern = {
  id: string;
  patternType: PatternType;
  title: string;
  fourPanels: [MangaPanel, MangaPanel, MangaPanel, MangaPanel];
  a4Flow: A4Flow;
  cta: string;
};

export type GenerationResult = {
  fourPanelImageDataUrl: string;
  a4ImageDataUrl: string;
  fourPanelPrompt: string;
  a4Prompt: string;
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

export const normalizeSummary = (raw: unknown): SummaryResult => {
  const source = (raw ?? {}) as Record<string, unknown>;
  const ctaCandidates = cleanList(source.ctaCandidates, []);

  return {
    mainTheme: cleanText(source.mainTheme, "季節の家電相談"),
    targetPersona: cleanText(source.targetPersona, "50代以上の地域のお客様"),
    painPoints: cleanList(source.painPoints, ["何を選べばいいか分からない"]),
    keyFacts: cleanList(source.keyFacts, ["投稿文の要点をまとめる"]),
    solutionMessage: cleanText(
      source.solutionMessage,
      "店主が状況に合わせて分かりやすく提案します"
    ),
    ctaCandidates,
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
    action: cleanText(source.action, "締め: 安心感のある一言")
  };
};

const normalizePatternType = (value: unknown): PatternType => {
  if (value === "共感型" || value === "驚き型" || value === "体験談型") {
    return value;
  }
  return "共感型";
};

export const normalizePatterns = (raw: unknown): CompositionPattern[] => {
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
      cta: cleanText(pattern.cta, "")
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
      cta: ""
    });
  }

  return normalized;
};
