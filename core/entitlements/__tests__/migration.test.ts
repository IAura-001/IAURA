import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20260830160000_plan_neutral_entitlements_v1.sql"), "utf8");
const readinessSql = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20260830010000_saas_data_readiness_v1.sql"), "utf8");

describe("entitlement migration contract", () => {
  it("cascades assignments, overrides, and storage reservations with account deletion", () => {
    expect(sql.match(/references auth\.users\(id\) on delete cascade/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("binds project-scoped entitlement data to the owner's composite project key", () => {
    expect(sql).toContain("foreign key (user_id, project_id) references public.projects(user_id, id)");
  });
  it("serializes concurrent project creation and AI reservation per user", () => {
    expect(sql).toContain("'project:'||actor::text");
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(actor::text,0))");
  });
  it("makes the entitlement RPC the only authenticated project-creation boundary", () => {
    expect(sql).toContain("revoke insert on public.projects from authenticated");
    expect(sql).toContain("grant execute on function public.create_project_with_entitlement(text,jsonb) to authenticated");
  });
  it("reserves incoming storage metadata before upload to prevent parallel limit bypass", () => {
    expect(sql).toContain("asset_storage_reservations");
    expect(sql).toContain("'storage:'||actor::text");
    expect(sql).toContain("finalize_asset_storage");
    expect(sql).toContain("drop policy if exists creative_assets_insert_own on storage.objects");
    expect(readinessSql).toContain("creative_assets_insert_own on storage.objects");
    expect(readinessSql).toContain("where p.id = (storage.foldername(name))[2]");
    expect(readinessSql).toContain("creative_assets_select_own on storage.objects");
    expect(readinessSql).toContain("creative_assets_delete_own on storage.objects");
  });
  it("enforces entitlement limits when a completed project becomes active", () => {
    expect(sql).toContain("enforce_project_reactivation_entitlement");
    expect(sql).toContain("coalesce(old.data->>'status','planning')='completed'");
    expect(sql).toContain("coalesce(new.data->>'status','planning')<>'completed'");
    expect(sql).toContain("if current_count>=project_limit");
    expect(sql).toContain("projects_reactivation_entitlement before update of data");
  });
  it("uses a neutral monthly period and preserves separate 24-hour safety ceilings", () => {
    expect(sql).toContain("date_trunc('month', now())");
    expect(sql).toContain("now()-interval '24 hours'");
    expect(sql).toContain("SAFETY_LIMIT_REACHED");
  });
  it("contains no billing provider or commercial plan coupling", () => {
    expect(sql.toLowerCase()).not.toContain("stripe");
    expect(sql.toLowerCase()).not.toContain("plan_name");
  });
});
