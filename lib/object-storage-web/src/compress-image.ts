export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
  maxSizeBytes?: number;
}

const DEFAULTS: Required<Omit<CompressImageOptions, "maxSizeBytes">> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  mimeType: "image/jpeg",
};

const COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isCompressibleImage(file: File | Blob): boolean {
  return COMPRESSIBLE_TYPES.has(file.type);
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fitDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob produced no result"));
      },
      type,
      quality,
    );
  });
}

/**
 * Compress an image file in the browser before upload.
 *
 * - Skips non-image files (returned as-is).
 * - Resizes so the longest edge fits within maxWidth/maxHeight.
 * - Re-encodes as JPEG (default) for strong compression.
 * - If the encoded result is larger than the original, returns the original.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  const opts = { ...DEFAULTS, ...options };

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }

  const { width, height } = fitDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = opts.quality;
  let blob: Blob;
  try {
    blob = await canvasToBlob(canvas, opts.mimeType, quality);
  } catch {
    return file;
  }

  // If a target byte budget is set, iteratively lower quality until we hit it.
  if (options.maxSizeBytes) {
    while (blob.size > options.maxSizeBytes && quality > 0.4) {
      quality = Math.max(0.4, quality - 0.1);
      try {
        blob = await canvasToBlob(canvas, opts.mimeType, quality);
      } catch {
        break;
      }
    }
  }

  if (blob.size >= file.size) return file;

  const ext = opts.mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, {
    type: opts.mimeType,
    lastModified: Date.now(),
  });
}
