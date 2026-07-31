const FIRST_SPEECH_CHUNK_MAX = 170;
const FOLLOWING_SPEECH_CHUNK_MAX = 420;
const MIN_FIRST_SPEECH_CHUNK = 36;

function findSentenceBoundary(
  text: string,
  maximum: number,
  preferFirst: boolean
): number {
  const candidate = text.slice(0, maximum);
  const boundaries = Array.from(
    candidate.matchAll(/[.!?…]+(?=\s|$)/g)
  )
    .map((match) =>
      (match.index ?? 0) + match[0].length
    )
    .filter((index) =>
      preferFirst
        ? index >= MIN_FIRST_SPEECH_CHUNK
        : true
    );

  if (boundaries.length > 0) {
    return preferFirst
      ? boundaries[0]
      : boundaries[boundaries.length - 1];
  }

  const wordBoundary =
    candidate.lastIndexOf(" ");

  return wordBoundary > 0
    ? wordBoundary
    : Math.min(maximum, text.length);
}

export function splitSpeechText(
  text: string
): string[] {
  let remaining = text
    .replace(/\s+/g, " ")
    .trim();
  const chunks: string[] = [];

  while (remaining) {
    const isFirst = chunks.length === 0;
    const maximum = isFirst
      ? FIRST_SPEECH_CHUNK_MAX
      : FOLLOWING_SPEECH_CHUNK_MAX;

    if (remaining.length <= maximum) {
      chunks.push(remaining);
      break;
    }

    const boundary = findSentenceBoundary(
      remaining,
      maximum,
      isFirst
    );
    const chunk = remaining
      .slice(0, boundary)
      .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    remaining = remaining
      .slice(boundary)
      .trim();
  }

  return chunks;
}
