import { describe, expect, it } from "vitest";

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  anchoredDocumentScrollTop,
  conversationGrowthDecision,
  conversationScrollDecision,
  isConversationNearBottom,
  returnToLatestScrollBehavior,
} from "@/components/sections/conversationAutoScroll";

describe("conversation auto-scroll", () => {
  it("uses a forgiving near-bottom threshold", () => {
    expect(isConversationNearBottom(900, 800)).toBe(true);
    expect(isConversationNearBottom(
      800 + AUTO_SCROLL_BOTTOM_THRESHOLD_PX + 1,
      800,
    )).toBe(false);
  });

  it("treats scrolling above the conversation end as leaving auto-follow", () => {
    expect(isConversationNearBottom(-AUTO_SCROLL_BOTTOM_THRESHOLD_PX - 1, 800))
      .toBe(false);
    expect(conversationScrollDecision(false, false)).toEqual({
      autoFollowEnabled: false,
      hasUnseenNewContent: false,
    });
  });

  it("reactivates follow and clears unseen state on manual return to bottom", () => {
    expect(conversationScrollDecision(true, true)).toEqual({
      autoFollowEnabled: true,
      hasUnseenNewContent: false,
    });
  });

  it("follows new content only while auto-follow is enabled", () => {
    expect(conversationGrowthDecision(true)).toEqual({
      shouldFollow: true,
      hasUnseenNewContent: false,
    });
    expect(conversationGrowthDecision(false)).toEqual({
      shouldFollow: false,
      hasUnseenNewContent: true,
    });
  });

  it("does not follow or mark historical load-older content as unseen", () => {
    expect(conversationGrowthDecision(false, true)).toEqual({
      shouldFollow: false,
      hasUnseenNewContent: false,
    });
  });

  it("anchors the viewport by the document-height increase", () => {
    expect(anchoredDocumentScrollTop(450, 2_000, 2_720)).toBe(1_170);
    expect(anchoredDocumentScrollTop(450, 2_000, 1_900)).toBe(450);
  });

  it("avoids smooth return scrolling when reduced motion is preferred", () => {
    expect(returnToLatestScrollBehavior(true)).toBe("auto");
    expect(returnToLatestScrollBehavior(false)).toBe("smooth");
  });
});
