/**
 * chapter-processor.worker.ts
 *
 * Dedicated Web Worker for background image and archive decompression,
 * Canvas/OffscreenCanvas rendering, and WebP generation.
 */

self.onmessage = async (event: MessageEvent) => {
  const { type, id, payload } = event.data;

  if (type === 'PING') {
    self.postMessage({ type: 'PONG', id });
    return;
  }

  if (type === 'PROCESS_IMAGE') {
    try {
      const { imageBlob, maxWidth = 1440, quality = 0.82, maxDimension = 16000 } = payload;
      const bitmap = await createImageBitmap(imageBlob);

      const targetWidth = Math.min(bitmap.width, maxWidth);
      const scale = targetWidth / bitmap.width;
      const targetHeight = Math.round(bitmap.height * scale);

      const results: { blob: Blob; width: number; height: number }[] = [];

      if (targetHeight <= maxDimension) {
        const oc = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = oc.getContext('2d');
        if (!ctx) throw new Error('No se pudo inicializar OffscreenCanvas en Worker.');
        ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, targetWidth, targetHeight);
        const blob = await oc.convertToBlob({ type: 'image/webp', quality });
        if (blob.type !== 'image/webp') {
          throw new Error('El encoder de OffscreenCanvas no generó image/webp.');
        }
        results.push({ blob, width: targetWidth, height: targetHeight });
      } else {
        const maxSourceSliceHeight = Math.floor(maxDimension / scale);
        let currentY = 0;
        while (currentY < bitmap.height) {
          const sliceHeight = Math.min(maxSourceSliceHeight, bitmap.height - currentY);
          const destSliceHeight = Math.round(sliceHeight * scale);
          const oc = new OffscreenCanvas(targetWidth, destSliceHeight);
          const ctx = oc.getContext('2d');
          if (!ctx) throw new Error('No se pudo inicializar OffscreenCanvas en Worker.');
          ctx.drawImage(bitmap, 0, currentY, bitmap.width, sliceHeight, 0, 0, targetWidth, destSliceHeight);
          const blob = await oc.convertToBlob({ type: 'image/webp', quality });
          if (blob.type !== 'image/webp') {
            throw new Error('El encoder de OffscreenCanvas no generó image/webp.');
          }
          results.push({ blob, width: targetWidth, height: destSliceHeight });
          currentY += sliceHeight;
        }
      }

      bitmap.close();
      self.postMessage({ type: 'SUCCESS', id, results });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', id, error: err.message || 'Error en Worker al procesar imagen' });
    }
  }
};
