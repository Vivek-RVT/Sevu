type Preset = "logo" | "banner" | "post" | "work";

type Options = {
  maxPx?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
};

// Aggressive presets sized to keep total per-account storage under ~3 MB
// even with banner + logo + many post images.
const PRESETS: Record<Preset, Required<Options>> = {
  logo:   { maxPx: 384, quality: 0.78, mimeType: "image/jpeg" },
  banner: { maxPx: 960, quality: 0.72, mimeType: "image/jpeg" },
  post:   { maxPx: 900, quality: 0.70, mimeType: "image/jpeg" },
  work:   { maxPx: 900, quality: 0.70, mimeType: "image/jpeg" },
};

// Per-preset target byte budget. If the first encode exceeds it, retry tighter.
const TARGET_BYTES: Record<Preset, number> = {
  logo:   60  * 1024,   // ~60 KB
  banner: 220 * 1024,   // ~220 KB
  post:   180 * 1024,   // ~180 KB
  work:   180 * 1024,
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

async function encode(
  img: HTMLImageElement,
  maxPx: number,
  mimeType: string,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  let { width, height } = img;
  if (width > maxPx || height > maxPx) {
    const ratio = Math.min(maxPx / width, maxPx / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob | null = await new Promise(resolve =>
    canvas.toBlob(b => resolve(b), mimeType, quality),
  );
  if (!blob) return null;
  return { blob, width, height };
}

export async function compressImage(file: File, preset: Preset, opts?: Options): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const { maxPx, quality, mimeType } = { ...PRESETS[preset], ...(opts ?? {}) };

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }

  const result = await encode(img, maxPx, mimeType, quality);
  if (!result) return file;

  let { blob } = result;
  const target = TARGET_BYTES[preset];

  // Two-step retry to bring size down to budget if first pass overshoots.
  if (blob.size > target) {
    const tighter = await encode(img, Math.round(maxPx * 0.85), mimeType, Math.max(0.6, quality - 0.08));
    if (tighter && tighter.blob.size < blob.size) blob = tighter.blob;
  }
  if (blob.size > target) {
    const tightest = await encode(img, Math.round(maxPx * 0.7), mimeType, 0.55);
    if (tightest && tightest.blob.size < blob.size) blob = tightest.blob;
  }

  if (blob.size >= file.size) return file;

  const ext = mimeType === "image/webp" ? ".webp" : ".jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}${ext}`, { type: mimeType });
}
