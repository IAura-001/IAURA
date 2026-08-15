export const AUTH_REQUIRED_CODE = "IAURA_AUTH_REQUIRED";

export function safeIauraNextPath(value: string | null | undefined): string {
  if (
    value === "/iaura" ||
    value?.startsWith("/iaura?") ||
    value?.startsWith("/iaura/")
  ) {
    return value;
  }
  return "/iaura";
}
