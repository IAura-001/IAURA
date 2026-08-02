import { IAURA_CONSTITUTION } from "./constitution";
import { IAURA_IDENTITY } from "./identity";
import { IAURA_REASONING } from "./reasoning";
import { IAURA_TONE } from "./tone";

export const IAURA_SYSTEM_PROMPT = [
  IAURA_CONSTITUTION,
  IAURA_IDENTITY,
  IAURA_REASONING,
  IAURA_TONE,
]
  .filter(Boolean)
  .join("\n\n");