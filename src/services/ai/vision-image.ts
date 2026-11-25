/** Anthropic recommends a long edge of 1568px and rejects images over 8000px or 5 MB of base64. */
export const VISION_LONG_EDGE = 1568;
export const VISION_MAX_EDGE = 8000;
export const VISION_MAX_BASE64 = 5 * 1024 * 1024;

export interface VisionImage {
  getSize(): { width: number; height: number };
  resize(size: { width: number; height: number }): VisionImage;
  toJPEG(quality: number): Buffer;
}

export function visionPixelSize(width: number, height: number, longEdge = VISION_LONG_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  const limit = Math.min(longEdge, VISION_MAX_EDGE);
  if (longest <= limit) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const scale = limit / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export function visionJpeg(image: VisionImage): Buffer {
  let current = image;
  const fitted = visionPixelSize(current.getSize().width, current.getSize().height);
  const size = current.getSize();
  if (fitted.width !== size.width || fitted.height !== size.height) current = current.resize(fitted);

  let quality = 80;
  let jpeg = current.toJPEG(quality);
  while (jpeg.toString('base64').length > VISION_MAX_BASE64 && quality > 35) {
    quality -= 10;
    jpeg = current.toJPEG(quality);
  }
  for (let attempt = 0; jpeg.toString('base64').length > VISION_MAX_BASE64 && attempt < 6; attempt++) {
    const now = current.getSize();
    current = current.resize({
      width: Math.max(1, Math.round(now.width * 0.75)),
      height: Math.max(1, Math.round(now.height * 0.75))
    });
    jpeg = current.toJPEG(quality);
  }
  return jpeg;
}

export interface EncodedVisionImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
  dataUrl: string;
}

/** Re-encode with Electron when it is available. Tests keep the original bytes. */
export function limitVisionDataUrl(dataUrl: string): EncodedVisionImage {
  const comma = dataUrl.indexOf(',');
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const original = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  try {
    const nativeImage = require('electron')?.nativeImage;
    if (nativeImage?.createFromDataURL) {
      const image = nativeImage.createFromDataURL(dataUrl);
      if (image && !image.isEmpty?.()) {
        const jpeg = visionJpeg(image);
        const data = jpeg.toString('base64');
        return { mediaType: 'image/jpeg', data, dataUrl: `data:image/jpeg;base64,${data}` };
      }
    }
  } catch {
    // Plain Node tests do not load Electron's native image decoder.
  }
  const mediaType = meta.includes('image/png') ? 'image/png'
    : meta.includes('image/gif') ? 'image/gif'
    : meta.includes('image/webp') ? 'image/webp'
    : 'image/jpeg';
  return { mediaType, data: original, dataUrl };
}
