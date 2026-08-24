import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicSupabaseConfig } from "./config";

function requestCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try { return [{ name, value: decodeURIComponent(rawValue) }]; }
    catch { return []; }
  });
}

export async function createServerSupabaseClient(request?: Request) {
  const { url, publishableKey } = getPublicSupabaseConfig();
  if (request) {
    return createServerClient(url, publishableKey, {
      cookies: { getAll: () => requestCookies(request), setAll: () => undefined },
    });
  }
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. A later Auth mission will
          // add session refresh to the request proxy before using Auth.
        }
      },
    },
  });
}
