import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const ACCESS_COOKIE_NAME =
  "iaura_beta_access";
export const ACCESS_SESSION_SECONDS =
  60 * 60 * 24 * 7;
export const MIN_ACCESS_KEY_LENGTH = 10;

const TOKEN_VERSION = "v1";

function sign(
  payload: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function safeMatch(
  left: string,
  right: string
): boolean {
  const leftDigest = createHash("sha256")
    .update(left)
    .digest();
  const rightDigest = createHash("sha256")
    .update(right)
    .digest();

  return timingSafeEqual(
    leftDigest,
    rightDigest
  );
}

function readCookie(
  request: Request,
  name: string
): string | null {
  const cookieHeader =
    request.headers.get("cookie");

  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] =
      cookie.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(
        valueParts.join("=")
      );
    }
  }

  return null;
}

export function getAccessSecret():
  | string
  | null {
  const secret =
    process.env.IAURA_ACCESS_KEY?.trim();

  return secret || null;
}

export function hasValidAccessConfiguration(
  secret = getAccessSecret()
): secret is string {
  return Boolean(
    secret &&
      secret.length >= MIN_ACCESS_KEY_LENGTH
  );
}

export function requiresPrivateBetaAccess(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    getAccessSecret() !== null
  );
}

export function matchesAccessKey(
  candidate: string,
  secret: string
): boolean {
  return safeMatch(candidate, secret);
}

export function createAccessToken(
  secret: string,
  now = Date.now()
): string {
  const expiresAt =
    Math.floor(now / 1000) +
    ACCESS_SESSION_SECONDS;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAccessToken(
  token: string,
  secret: string,
  now = Date.now()
): boolean {
  const [version, expiresAtRaw, signature] =
    token.split(".");

  if (
    version !== TOKEN_VERSION ||
    !expiresAtRaw ||
    !signature ||
    !/^\d+$/.test(expiresAtRaw)
  ) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(now / 1000)
  ) {
    return false;
  }

  const payload = `${version}.${expiresAtRaw}`;
  const expectedSignature = sign(
    payload,
    secret
  );

  return safeMatch(
    signature,
    expectedSignature
  );
}

export function isRequestAuthorized(
  request: Request
): boolean {
  if (!requiresPrivateBetaAccess()) {
    return true;
  }

  const secret = getAccessSecret();

  if (!hasValidAccessConfiguration(secret)) {
    return false;
  }

  const token = readCookie(
    request,
    ACCESS_COOKIE_NAME
  );

  return Boolean(
    token && verifyAccessToken(token, secret)
  );
}
