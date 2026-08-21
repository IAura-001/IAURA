"use client";

import { useEffect } from "react";
import { trackBetaUsage } from "@/core/betaUsage/client";

export default function BetaUsageEntryTracker({ userId }: { userId: string }) {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `vaeora-beta-entered:v2:${userId}:${today}`;
    if (sessionStorage.getItem(key)) return;
    void trackBetaUsage({ type: "beta_signed_in" }).then((recorded) => {
      if (recorded) sessionStorage.setItem(key, "1");
    });
  }, [userId]);

  return null;
}
