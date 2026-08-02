// Large enough for a sharp desktop preview, while keeping full-resolution 4K
// originals out of the render path and the initial IndexedDB query.
const THUMBNAIL_MAX_EDGE = 1280;

export async function createImageThumbnail(
  source: Blob,
): Promise<Blob | undefined> {
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return undefined;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(source);
    const scale = Math.min(
      1,
      THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) return undefined;

    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ?? undefined),
        "image/webp",
        0.82,
      );
    });
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
  }
}
