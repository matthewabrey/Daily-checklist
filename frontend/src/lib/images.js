const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Shrinks a photo (File, Blob, data URL or <video>/<img> element) to a phone-friendly JPEG data URL
export const compressImage = async (source) => {
  let img = source;
  let objectUrl = null;
  if (typeof source === 'string') {
    img = await loadImage(source);
  } else if (source instanceof Blob) {
    objectUrl = URL.createObjectURL(source);
    img = await loadImage(objectUrl);
  }
  const srcW = img.videoWidth || img.naturalWidth || img.width;
  const srcH = img.videoHeight || img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};
