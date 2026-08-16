import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth })),
}));

import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { POST as signup } from "./signup/route";

function formRequest(path: string, values: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return new Request(`https://vaeora.test${path}`, { method: "POST", body });
}

describe("Supabase Auth route boundaries", () => {
  beforeEach(() => {
    auth.signInWithPassword.mockReset();
    auth.signUp.mockReset();
    auth.signOut.mockReset();
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it("logs in with normalized server-validated credentials", async () => {
    const response = await login(formRequest("/api/auth/login", {
      email: " USER@Example.COM ", password: "long-password", next: "/iaura?view=projects",
    }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "long-password" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://vaeora.test/iaura?view=projects");
  });

  it("uses a generic login failure for wrong credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new Error("specific provider error") });
    const response = await login(formRequest("/api/auth/login", {
      email: "user@example.com", password: "wrong-password", next: "/iaura",
    }));
    expect(response.headers.get("location")).toContain("/login?error=credentials");
    expect(response.headers.get("location")).not.toContain("provider");
  });

  it("signs up and rejects an unsafe next destination", async () => {
    const response = await signup(formRequest("/api/auth/signup", {
      email: "new@example.com", password: "long-password", next: "https://evil.test",
    }));
    expect(auth.signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "long-password" });
    expect(response.headers.get("location")).toBe("https://vaeora.test/iaura");
  });

  it("keeps a real signup error in the calm failure flow", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: new Error("provider detail") });
    const response = await signup(formRequest("/api/auth/signup", {
      email: "new@example.com", password: "long-password", next: "/iaura",
    }));
    expect(response.headers.get("location")).toContain("/signup?error=signup");
    expect(response.headers.get("location")).not.toContain("provider");
  });

  it("shows confirmation-required signup without consuming claim context", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: "new-user" } }, error: null });
    const request = formRequest("/api/auth/signup", {
      email: "new@example.com", password: "long-password", next: "/iaura?view=projects",
    });
    request.headers.set("cookie", "iaura_claim_context=preserve-me");
    const response = await signup(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://vaeora.test/signup?confirmation=required&next=%2Fiaura%3Fview%3Dprojects");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects malformed credentials before calling Supabase", async () => {
    const response = await signup(formRequest("/api/auth/signup", {
      email: "invalid", password: "short", next: "/iaura",
    }));
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/signup?error=signup");
  });

  it("logs out through Supabase and returns to login", async () => {
    const response = await logout(new Request("https://vaeora.test/api/auth/logout", { method: "POST" }));
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://vaeora.test/login");
  });
});
