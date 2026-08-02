import {
  describe,
  expect,
  it,
} from "vitest";

import { CreativeProviderError } from "../errors";
import {
  decodeGeneratedImage,
  hasExpectedImageSignature,
  MAX_GENERATED_IMAGE_BYTES,
  readGeneratedImageDimensions,
} from "../imageBinary";

function writeUint32BigEndian(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint32LittleEndian(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(58);
  bytes.set([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);
  writeUint32BigEndian(bytes, 8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32BigEndian(bytes, 16, width);
  writeUint32BigEndian(bytes, 20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  writeUint32BigEndian(bytes, 33, 1);
  bytes.set([0x49, 0x44, 0x41, 0x54], 37);
  bytes[41] = 0x00;
  bytes.set([0x49, 0x45, 0x4e, 0x44], 50);
  return bytes;
}

function jpegBytes(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
    0xff,
    0xda,
    0x00,
    0x0c,
    0x03,
    0x01,
    0x00,
    0x02,
    0x00,
    0x03,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x00,
    0xff,
    0xd9,
  ]);
}

function webpVp8xBytes(
  width: number,
  height: number,
): Uint8Array {
  const bytes = new Uint8Array(50);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  writeUint32LittleEndian(bytes, 4, bytes.length - 8);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  writeUint32LittleEndian(bytes, 16, 10);
  const storedWidth = width - 1;
  const storedHeight = height - 1;
  bytes[24] = storedWidth & 0xff;
  bytes[25] = (storedWidth >>> 8) & 0xff;
  bytes[26] = (storedWidth >>> 16) & 0xff;
  bytes[27] = storedHeight & 0xff;
  bytes[28] = (storedHeight >>> 8) & 0xff;
  bytes[29] = (storedHeight >>> 16) & 0xff;
  bytes.set([0x56, 0x50, 0x38, 0x20], 30);
  writeUint32LittleEndian(bytes, 34, 11);
  bytes.set([0x9d, 0x01, 0x2a], 41);
  bytes[44] = width & 0xff;
  bytes[45] = (width >>> 8) & 0x3f;
  bytes[46] = height & 0xff;
  bytes[47] = (height >>> 8) & 0x3f;
  return bytes;
}

function webpVp8lBytes(
  width: number,
  height: number,
): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  writeUint32LittleEndian(bytes, 4, bytes.length - 8);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
  writeUint32LittleEndian(bytes, 16, 6);
  bytes[20] = 0x2f;
  const storedWidth = width - 1;
  const storedHeight = height - 1;
  bytes[21] = storedWidth & 0xff;
  bytes[22] =
    ((storedWidth >>> 8) & 0x3f) |
    ((storedHeight & 0x03) << 6);
  bytes[23] = (storedHeight >>> 2) & 0xff;
  bytes[24] = (storedHeight >>> 10) & 0x0f;
  return bytes;
}

describe("generated image integrity", () => {
  it("reads dimensions from PNG, JPEG, and WebP headers", () => {
    const png = pngBytes(1024, 1024);
    const jpeg = jpegBytes(1536, 864);
    const webp = webpVp8xBytes(3840, 2160);
    const losslessWebp = webpVp8lBytes(1024, 1536);

    expect(readGeneratedImageDimensions(png, "png")).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(readGeneratedImageDimensions(jpeg, "jpeg")).toEqual({
      width: 1536,
      height: 864,
    });
    expect(readGeneratedImageDimensions(webp, "webp")).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(
      readGeneratedImageDimensions(losslessWebp, "webp"),
    ).toEqual({
      width: 1024,
      height: 1536,
    });
  });

  it("decodes a matching image with its actual dimensions", () => {
    const png = pngBytes(1024, 1536);
    const encoded = Buffer.from(png).toString("base64");
    const result = decodeGeneratedImage(encoded, "png");

    expect(result.byteLength).toBe(png.byteLength);
    expect(result).toMatchObject({
      width: 1024,
      height: 1536,
    });
    expect(
      hasExpectedImageSignature(
        new Uint8Array(result.data),
        "png",
      ),
    ).toBe(true);
  });

  it("rejects malformed base64 and mismatched image formats", () => {
    expect(() => decodeGeneratedImage("not base64", "png")).toThrow(
      CreativeProviderError,
    );

    const png = Buffer.from(pngBytes(1024, 1024)).toString(
      "base64",
    );

    expect(() => decodeGeneratedImage(png, "webp")).toThrow(
      CreativeProviderError,
    );
  });

  it("rejects truncated or structurally invalid image headers", () => {
    const headerOnlyPng = Buffer.from(
      pngBytes(1024, 1024).slice(0, 33),
    ).toString("base64");
    const truncatedWebp = webpVp8xBytes(1536, 864).slice(0, 29);
    const headerOnlyJpeg = jpegBytes(1536, 864).slice(0, 21);
    const metadataOnlyWebp = webpVp8xBytes(1536, 864).slice(0, 30);
    writeUint32LittleEndian(
      metadataOnlyWebp,
      4,
      metadataOnlyWebp.length - 8,
    );

    expect(() =>
      decodeGeneratedImage(headerOnlyPng, "png"),
    ).toThrow(CreativeProviderError);
    expect(() =>
      decodeGeneratedImage(
        Buffer.from(truncatedWebp).toString("base64"),
        "webp",
      ),
    ).toThrow(CreativeProviderError);
    expect(() =>
      decodeGeneratedImage(
        Buffer.from(headerOnlyJpeg).toString("base64"),
        "jpeg",
      ),
    ).toThrow(CreativeProviderError);
    expect(() =>
      decodeGeneratedImage(
        Buffer.from(metadataOnlyWebp).toString("base64"),
        "webp",
      ),
    ).toThrow(CreativeProviderError);
  });

  it("fails closed on malformed recognized WebP chunks", () => {
    const malformed = webpVp8lBytes(1024, 1024);
    malformed[20] = 0x00;

    expect(readGeneratedImageDimensions(malformed, "webp")).toBeNull();
  });

  it("caps the raw base64 input before whitespace normalization", () => {
    const oversizedWhitespace = " ".repeat(
      Math.ceil((MAX_GENERATED_IMAGE_BYTES * 4) / 3) + 5,
    );

    expect(() =>
      decodeGeneratedImage(oversizedWhitespace, "png"),
    ).toThrow(CreativeProviderError);
  });
});
