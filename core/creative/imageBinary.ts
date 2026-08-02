import { CreativeProviderError } from "./errors";
import type {
  CreativeImageOutputFormat,
} from "./types";

export const MAX_GENERATED_IMAGE_BYTES =
  25 * 1024 * 1024;

export interface GeneratedImageDimensions {
  width: number;
  height: number;
}

const MAX_BASE64_CHARACTERS =
  Math.ceil((MAX_GENERATED_IMAGE_BYTES * 4) / 3) + 4;

function hasPrefix(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  if (bytes.length < offset + signature.length) return false;

  return signature.every(
    (byte, index) => bytes[offset + index] === byte,
  );
}

function readUint16BigEndian(
  bytes: Uint8Array,
  offset: number,
): number {
  return bytes[offset] * 0x100 + bytes[offset + 1];
}

function readUint16LittleEndian(
  bytes: Uint8Array,
  offset: number,
): number {
  return bytes[offset] + bytes[offset + 1] * 0x100;
}

function readUint24LittleEndian(
  bytes: Uint8Array,
  offset: number,
): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000
  );
}

function readUint32BigEndian(
  bytes: Uint8Array,
  offset: number,
): number {
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

function readUint32LittleEndian(
  bytes: Uint8Array,
  offset: number,
): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000
  );
}

function validDimensions(
  width: number,
  height: number,
): GeneratedImageDimensions | null {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return { width, height };
}

export function hasExpectedImageSignature(
  bytes: Uint8Array,
  format: CreativeImageOutputFormat,
): boolean {
  if (format === "png") {
    return hasPrefix(bytes, [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);
  }

  if (format === "jpeg") {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  }

  return (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    hasPrefix(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  );
}

function readPngDimensions(
  bytes: Uint8Array,
): GeneratedImageDimensions | null {
  if (bytes.length < 45) return null;

  let offset = 8;
  let dimensions: GeneratedImageDimensions | null = null;
  let idatBytes = 0;

  while (offset + 12 <= bytes.length) {
    const chunkLength = readUint32BigEndian(bytes, offset);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + chunkLength;
    const chunkEnd = dataEnd + 4;

    if (chunkEnd > bytes.length) return null;

    const isIhdr = hasPrefix(
      bytes,
      [0x49, 0x48, 0x44, 0x52],
      offset + 4,
    );
    const isIdat = hasPrefix(
      bytes,
      [0x49, 0x44, 0x41, 0x54],
      offset + 4,
    );
    const isIend = hasPrefix(
      bytes,
      [0x49, 0x45, 0x4e, 0x44],
      offset + 4,
    );

    if (offset === 8) {
      if (
        !isIhdr ||
        chunkLength !== 13 ||
        bytes[dataOffset + 10] !== 0 ||
        bytes[dataOffset + 11] !== 0 ||
        (bytes[dataOffset + 12] !== 0 &&
          bytes[dataOffset + 12] !== 1)
      ) {
        return null;
      }

      dimensions = validDimensions(
        readUint32BigEndian(bytes, dataOffset),
        readUint32BigEndian(bytes, dataOffset + 4),
      );

      if (!dimensions) return null;
    } else if (isIhdr) {
      return null;
    }

    if (isIdat) {
      idatBytes += chunkLength;
    }

    if (isIend) {
      if (
        chunkLength !== 0 ||
        idatBytes === 0 ||
        chunkEnd !== bytes.length
      ) {
        return null;
      }

      return dimensions;
    }

    offset = chunkEnd;
  }

  return null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function readJpegDimensions(
  bytes: Uint8Array,
): GeneratedImageDimensions | null {
  let offset = 2;
  let dimensions: GeneratedImageDimensions | null = null;
  let insideScan = false;
  let sawScan = false;
  let sawEntropyData = false;

  while (offset < bytes.length) {
    if (insideScan) {
      if (bytes[offset] !== 0xff) {
        sawEntropyData = true;
        offset += 1;
        continue;
      }

      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset += 1;
      }

      if (offset >= bytes.length) return null;

      const scanMarker = bytes[offset];
      offset += 1;

      if (scanMarker === 0x00) {
        sawEntropyData = true;
        continue;
      }

      if (scanMarker >= 0xd0 && scanMarker <= 0xd7) {
        continue;
      }

      if (scanMarker === 0xd9) {
        return dimensions &&
          sawScan &&
          sawEntropyData &&
          offset === bytes.length
            ? dimensions
            : null;
      }

      insideScan = false;

      if (scanMarker === 0xd8 || scanMarker === 0x01) {
        return null;
      }

      if (offset + 2 > bytes.length) return null;

      const scanSegmentLength = readUint16BigEndian(bytes, offset);

      if (
        scanSegmentLength < 2 ||
        offset + scanSegmentLength > bytes.length
      ) {
        return null;
      }

      if (scanMarker === 0xda) {
        const componentCount = bytes[offset + 2];

        if (
          componentCount === 0 ||
          scanSegmentLength !== 6 + 2 * componentCount
        ) {
          return null;
        }

        sawScan = true;
        insideScan = true;
      } else if (isJpegStartOfFrame(scanMarker)) {
        return null;
      }

      offset += scanSegmentLength;
      continue;
    }

    if (bytes[offset] !== 0xff) return null;

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0x00 || marker === 0xd8) {
      return null;
    }

    if (
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      return null;
    }

    if (offset + 2 > bytes.length) return null;

    const segmentLength = readUint16BigEndian(bytes, offset);

    if (
      segmentLength < 2 ||
      offset + segmentLength > bytes.length
    ) {
      return null;
    }

    if (isJpegStartOfFrame(marker)) {
      const componentCount = bytes[offset + 7];

      if (
        dimensions ||
        componentCount === 0 ||
        segmentLength !== 8 + 3 * componentCount
      ) {
        return null;
      }

      dimensions = validDimensions(
        readUint16BigEndian(bytes, offset + 5),
        readUint16BigEndian(bytes, offset + 3),
      );

      if (!dimensions) return null;
    }

    if (marker === 0xda) {
      const componentCount = bytes[offset + 2];

      if (
        !dimensions ||
        componentCount === 0 ||
        segmentLength !== 6 + 2 * componentCount
      ) {
        return null;
      }

      sawScan = true;
      insideScan = true;
    }

    offset += segmentLength;
  }

  return null;
}

interface WebpChunkDimensionsResult {
  recognized: boolean;
  dimensions: GeneratedImageDimensions | null;
}

function readWebpChunkDimensions(
  bytes: Uint8Array,
  chunkOffset: number,
  chunkSize: number,
): WebpChunkDimensionsResult {
  const payloadOffset = chunkOffset + 8;

  if (hasPrefix(bytes, [0x56, 0x50, 0x38, 0x58], chunkOffset)) {
    if (
      chunkOffset !== 12 ||
      chunkSize !== 10 ||
      (bytes[payloadOffset] & 0xc3) !== 0
    ) {
      return { recognized: true, dimensions: null };
    }

    return {
      recognized: true,
      dimensions: validDimensions(
        readUint24LittleEndian(bytes, payloadOffset + 4) + 1,
        readUint24LittleEndian(bytes, payloadOffset + 7) + 1,
      ),
    };
  }

  if (hasPrefix(bytes, [0x56, 0x50, 0x38, 0x4c], chunkOffset)) {
    if (
      chunkSize <= 5 ||
      bytes[payloadOffset] !== 0x2f ||
      (bytes[payloadOffset + 4] & 0xe0) !== 0
    ) {
      return { recognized: true, dimensions: null };
    }

    const first = bytes[payloadOffset + 1];
    const second = bytes[payloadOffset + 2];
    const third = bytes[payloadOffset + 3];
    const fourth = bytes[payloadOffset + 4];

    return {
      recognized: true,
      dimensions: validDimensions(
        1 + first + ((second & 0x3f) << 8),
        1 +
          (second >> 6) +
          (third << 2) +
          ((fourth & 0x0f) << 10),
      ),
    };
  }

  if (hasPrefix(bytes, [0x56, 0x50, 0x38, 0x20], chunkOffset)) {
    if (
      chunkSize <= 10 ||
      (bytes[payloadOffset] & 0x01) !== 0 ||
      !hasPrefix(bytes, [0x9d, 0x01, 0x2a], payloadOffset + 3)
    ) {
      return { recognized: true, dimensions: null };
    }

    return {
      recognized: true,
      dimensions: validDimensions(
        readUint16LittleEndian(bytes, payloadOffset + 6) & 0x3fff,
        readUint16LittleEndian(bytes, payloadOffset + 8) & 0x3fff,
      ),
    };
  }

  return { recognized: false, dimensions: null };
}

function readWebpDimensions(
  bytes: Uint8Array,
): GeneratedImageDimensions | null {
  if (bytes.length < 20) return null;

  const declaredLength = readUint32LittleEndian(bytes, 4) + 8;

  if (declaredLength !== bytes.length) return null;

  let offset = 12;
  let canvasDimensions: GeneratedImageDimensions | null = null;
  let pixelDimensions: GeneratedImageDimensions | null = null;

  while (offset + 8 <= declaredLength) {
    const chunkSize = readUint32LittleEndian(bytes, offset + 4);
    const payloadEnd = offset + 8 + chunkSize;
    const paddedEnd = payloadEnd + (chunkSize % 2);

    if (payloadEnd > declaredLength || paddedEnd > declaredLength) {
      return null;
    }

    const result = readWebpChunkDimensions(
      bytes,
      offset,
      chunkSize,
    );

    if (result.recognized) {
      if (!result.dimensions) return null;

      const isCanvas = hasPrefix(
        bytes,
        [0x56, 0x50, 0x38, 0x58],
        offset,
      );

      if (isCanvas) {
        if (canvasDimensions || pixelDimensions) return null;
        canvasDimensions = result.dimensions;
      } else {
        if (pixelDimensions) return null;
        pixelDimensions = result.dimensions;
      }
    }

    offset = paddedEnd;
  }

  if (offset !== declaredLength || !pixelDimensions) return null;

  if (
    canvasDimensions &&
    (canvasDimensions.width !== pixelDimensions.width ||
      canvasDimensions.height !== pixelDimensions.height)
  ) {
    return null;
  }

  return canvasDimensions ?? pixelDimensions;
}

export function readGeneratedImageDimensions(
  bytes: Uint8Array,
  format: CreativeImageOutputFormat,
): GeneratedImageDimensions | null {
  if (!hasExpectedImageSignature(bytes, format)) return null;

  if (format === "png") return readPngDimensions(bytes);
  if (format === "jpeg") return readJpegDimensions(bytes);
  return readWebpDimensions(bytes);
}

export function decodeGeneratedImage(
  encodedImage: string,
  expectedFormat: CreativeImageOutputFormat,
): {
  data: ArrayBuffer;
  byteLength: number;
  width: number;
  height: number;
} {
  if (
    !encodedImage ||
    encodedImage.length > MAX_BASE64_CHARACTERS
  ) {
    throw new CreativeProviderError("invalid_result");
  }

  const normalized = encodedImage.replace(/\s/g, "");

  if (
    !normalized ||
    normalized.length > MAX_BASE64_CHARACTERS ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw new CreativeProviderError("invalid_result");
  }

  const decoded = Buffer.from(normalized, "base64");

  if (
    decoded.byteLength === 0 ||
    decoded.byteLength > MAX_GENERATED_IMAGE_BYTES ||
    !hasExpectedImageSignature(decoded, expectedFormat)
  ) {
    throw new CreativeProviderError("invalid_result");
  }

  const copy = new Uint8Array(decoded.byteLength);
  copy.set(decoded);
  const dimensions = readGeneratedImageDimensions(
    copy,
    expectedFormat,
  );

  if (!dimensions) {
    throw new CreativeProviderError("invalid_result");
  }

  return {
    data: copy.buffer,
    byteLength: copy.byteLength,
    ...dimensions,
  };
}
