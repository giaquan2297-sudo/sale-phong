import imageCompression from 'browser-image-compression';

function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

/**
 * Compress image on client before upload: max 1600px, JPEG ~80%.
 */
export async function compressRoomImage(file) {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 0.9,
    initialQuality: 0.8,
    fileType: 'image/jpeg',
    useWebWorker: true,
  });

  const baseName = (file.name || 'room').replace(/\.[^.]+$/, '');
  const jpegFile = new File([compressed], `${baseName}.jpg`, { type: 'image/jpeg' });
  const dims = await readImageDimensions(jpegFile);

  return {
    file: jpegFile,
    width: dims.width,
    height: dims.height,
  };
}
