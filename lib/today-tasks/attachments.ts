const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CANVAS_EDGE = 1400;
const JPEG_QUALITY = 0.82;

export function newAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 将图片文件缩放并转为 JPEG data URL，控制 LocalStorage 体积 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('单张图片请小于 8MB');
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('无法读取该图片，请换一张或转为 JPG/PNG');
  });

  try {
    let w = bitmap.width;
    let h = bitmap.height;
    if (w > MAX_CANVAS_EDGE || h > MAX_CANVAS_EDGE) {
      const r = Math.min(MAX_CANVAS_EDGE / w, MAX_CANVAS_EDGE / h);
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持画布压缩');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
