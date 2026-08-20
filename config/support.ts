const DEVELOPMENT_SUPPORT_URL =
  "https://buy.stripe.com/test_fZu28q20L0XF4Eu6zYe7m00";

export function resolveVaeoraSupportUrl(
  configuredUrl: string | undefined,
  environment: string | undefined,
): string | null {
  const candidate = configuredUrl?.trim() ||
    (environment === "production" ? "" : DEVELOPMENT_SUPPORT_URL);

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const isStripePaymentLink =
      url.protocol === "https:" && url.hostname === "buy.stripe.com";
    const isTestLink = url.pathname.startsWith("/test_");

    if (!isStripePaymentLink || (environment === "production" && isTestLink)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export const VAEORA_SUPPORT_URL = resolveVaeoraSupportUrl(
  process.env.NEXT_PUBLIC_VAEORA_SUPPORT_URL,
  process.env.NODE_ENV,
);
