import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface BetaMembership {
  role: "founder" | "member";
  status: "active" | "revoked";
  claimedAt: string;
}

interface MembershipRow {
  role: BetaMembership["role"];
  status: BetaMembership["status"];
  claimed_at: string;
}

export class BetaClaimError extends Error {
  constructor(public readonly kind: "unauthenticated" | "already_member" | "unavailable") {
    super(kind);
  }
}

function toMembership(row: MembershipRow): BetaMembership {
  return { role: row.role, status: row.status, claimedAt: row.claimed_at };
}

export async function getCurrentBetaMembership(): Promise<BetaMembership | null> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("beta_memberships")
    .select("role,status,claimed_at")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return toMembership(data as MembershipRow);
}

export async function claimCurrentUserBetaInvite(inviteToken: string): Promise<BetaMembership> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new BetaClaimError("unauthenticated");

  const { data, error } = await supabase.rpc("claim_beta_invite", {
    invite_token: inviteToken,
  });

  if (error) {
    throw new BetaClaimError(error.code === "23505" ? "already_member" : "unavailable");
  }

  return toMembership(data as MembershipRow);
}

export async function recognizeBetaInvite(inviteToken: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("recognize_beta_invite", {
    invite_token: inviteToken,
  });
  return !error && data === true;
}
