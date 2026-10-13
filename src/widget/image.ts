import { CAPTURE } from "../config/capture";
import { fitWithin } from "./imageCheck";

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  srcWidth: number;
  srcHeight: number;
}

export function renderToJpeg(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
): Promise<PreparedPhoto> {
  const { width, height } = fitWithin(srcWidth, srcHeight, CAPTURE.outputMaxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas unavailable"));
  ctx.fillStyle = "#fff"; // PNG transparency becomes white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve({ blob, width, height, srcWidth, srcHeight })
          : reject(new Error("encode failed")),
      "image/jpeg",
      CAPTURE.jpegQuality,
    ),
  );
}

export async function fileToJpeg(file: File): Promise<PreparedPhoto> {
  try {
    const bmp = await createImageBitmap(file); // honours EXIF rotation in current browsers
    try {
      return await renderToJpeg(bmp, bmp.width, bmp.height);
    } finally {
      bmp.close();
    }
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await renderToJpeg(img, img.naturalWidth, img.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
