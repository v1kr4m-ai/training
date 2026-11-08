/** Read an image file, scale it to at most `maxWidth` px wide and return a JPEG data URL under `maxBytes`. */
export async function imageToDataUrl(file: File, maxWidth = 1600, maxBytes = 450_000): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (let q = 0.85; q >= 0.4; q -= 0.15) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length * 0.75 <= maxBytes) return url;
  }
  throw new Error('The image is too large even after compression. Choose a smaller picture.');
}
