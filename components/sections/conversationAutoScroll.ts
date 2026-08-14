export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 120;

export function returnToLatestScrollBehavior(
  prefersReducedMotion: boolean,
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

export function isConversationNearBottom(
  conversationEndBottom: number,
  viewportHeight: number,
  threshold = AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
): boolean {
  return (
    conversationEndBottom >= -threshold &&
    conversationEndBottom <= viewportHeight + threshold
  );
}

export function anchoredDocumentScrollTop(
  previousScrollTop: number,
  previousScrollHeight: number,
  nextScrollHeight: number,
): number {
  return previousScrollTop + Math.max(0, nextScrollHeight - previousScrollHeight);
}

export interface ConversationGrowthDecision {
  shouldFollow: boolean;
  hasUnseenNewContent: boolean;
}

export interface ConversationScrollDecision {
  autoFollowEnabled: boolean;
  hasUnseenNewContent: boolean;
}

export function conversationScrollDecision(
  isNearBottom: boolean,
  currentHasUnseenNewContent: boolean,
): ConversationScrollDecision {
  return {
    autoFollowEnabled: isNearBottom,
    hasUnseenNewContent: isNearBottom
      ? false
      : currentHasUnseenNewContent,
  };
}

export function conversationGrowthDecision(
  autoFollowEnabled: boolean,
  isHistoricalLoad = false,
): ConversationGrowthDecision {
  if (isHistoricalLoad) {
    return { shouldFollow: false, hasUnseenNewContent: false };
  }
  return {
    shouldFollow: autoFollowEnabled,
    hasUnseenNewContent: !autoFollowEnabled,
  };
}
