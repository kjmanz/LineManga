const HIGH_DEMAND_PATTERN =
  /high demand|spikes in demand|try again later|resource[_\s-]*exhausted|rate limit|temporarily unavailable|overloaded|backend error/i;

export const toUserFriendlyError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) {
    return fallback;
  }

  if (HIGH_DEMAND_PATTERN.test(message)) {
    return "画像生成モデルが混雑しています。1〜2分待ってから、もう一度お試しください。";
  }

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "通信に失敗しました。ネット接続を確認して、もう一度お試しください。";
  }

  if (/timeout|timed out|deadline/i.test(message)) {
    return "処理がタイムアウトしました。時間をおいて再試行してください。";
  }

  return message;
};
