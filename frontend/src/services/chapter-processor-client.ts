/**
 * chapter-processor-client.ts
 *
 * Client-side ingestion and optimization engine for KuraScroll.
 * Decodes images, archives (CBZ/ZIP), and strips on the client device
 * using Canvas / Web Workers and converts them to optimized WebP
 * (max width 1440px, quality 0.82) before uploading to Fastify backend.
 */

export interface ProcessedWebpPage {
  blob: Blob;
  width: number;
  height: number;
  aspectRatio: number;
  byteLength: number;
  mimeType: 'image/webp';
  pageNumber: number;
  originalName: string;
}

export interface IngestionProgress {
  stage: 'analyzing' | 'processing' | 'uploading' | 'publishing' | 'complete' | 'cancelled';
  currentPage: number;
  totalPages: number;
  percent: number;
  message: string;
}

export interface ClientIngestionOptions {
  maxWidth?: number;
  quality?: number;
  maxDimension?: number;
  signal?: AbortSignal;
  onProgress?: (progress: IngestionProgress) => void;
}

const DEFAULT_MAX_WIDTH = 1440;
const DEFAULT_QUALITY = 0.82;
const MAX_WEBP_DIMENSION = 16000; // Hard limit in WebP format is 16383px; safe margin at 16000
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024; // 250 MiB
const MAX_ZIP_ENTRIES = 10000;
const MAX_EXPANDED_BYTES = 1024 * 1024 * 1024; // 1 GiB
const MAX_COMPRESSION_RATIO = 200; // 200:1 zip bomb guard

/**
 * Checks whether the current browser/runtime actually supports encoding WebP from Canvas.
 * Validates that canvas doesn't fall back to PNG/JPEG.
 */
export async function isWebpSupported(): Promise<boolean> {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(1, 1);
      const ctx = oc.getContext('2d');
      if (ctx) {
        const blob = await oc.convertToBlob({ type: 'image/webp', quality: 0.8 });
        if (blob && blob.type === 'image/webp') return true;
      }
    }
  } catch {}

  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const dataUrl = canvas.toDataURL('image/webp');
      return dataUrl.startsWith('data:image/webp');
    }
  } catch {}

  return false;
}

/**
 * Natural sort comparator for filenames (e.g. page-2 comes before page-10).
 */
export function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Converts an image source into one or more WebP blobs.
 * If the image is extremely tall (e.g. webtoon vertical strip > 16000px),
 * splits it into contiguous vertical segments in stable sequential order.
 */
export async function convertBitmapToWebpBlobs(
  source: ImageBitmap | HTMLImageElement,
  originalName: string,
  startPageNumber: number,
  options?: ClientIngestionOptions
): Promise<ProcessedWebpPage[]> {
  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options?.quality ?? DEFAULT_QUALITY;
  const maxDim = options?.maxDimension ?? MAX_WEBP_DIMENSION;
  const signal = options?.signal;

  const srcWidth = 'width' in source ? source.width : (source as any).naturalWidth;
  const srcHeight = 'height' in source ? source.height : (source as any).naturalHeight;

  if (srcWidth <= 0 || srcHeight <= 0) {
    throw new Error(`Dimensiones inválidas de imagen para "${originalName}": ${srcWidth}x${srcHeight}`);
  }

  const targetWidth = Math.min(srcWidth, maxWidth);
  const scale = targetWidth / srcWidth;
  const scaledTotalHeight = Math.round(srcHeight * scale);

  const results: ProcessedWebpPage[] = [];

  // Check if strip slicing is required
  if (scaledTotalHeight <= maxDim) {
    if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');
    const blob = await renderCanvasSlice(source, 0, 0, srcWidth, srcHeight, targetWidth, scaledTotalHeight, quality);
    results.push({
      blob,
      width: targetWidth,
      height: scaledTotalHeight,
      aspectRatio: scaledTotalHeight > 0 ? Number((targetWidth / scaledTotalHeight).toFixed(4)) : 1,
      byteLength: blob.size,
      mimeType: 'image/webp',
      pageNumber: startPageNumber,
      originalName,
    });
  } else {
    // Split vertical strip into contiguous segments
    const maxSourceSliceHeight = Math.floor(maxDim / scale);
    let currentY = 0;
    let sliceIndex = 0;

    while (currentY < srcHeight) {
      if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');
      const sliceHeight = Math.min(maxSourceSliceHeight, srcHeight - currentY);
      const destSliceHeight = Math.round(sliceHeight * scale);

      const blob = await renderCanvasSlice(
        source,
        0, currentY, srcWidth, sliceHeight,
        targetWidth, destSliceHeight,
        quality
      );

      results.push({
        blob,
        width: targetWidth,
        height: destSliceHeight,
        aspectRatio: destSliceHeight > 0 ? Number((targetWidth / destSliceHeight).toFixed(4)) : 1,
        byteLength: blob.size,
        mimeType: 'image/webp',
        pageNumber: startPageNumber + sliceIndex,
        originalName: `${originalName}#segment-${sliceIndex + 1}`,
      });

      currentY += sliceHeight;
      sliceIndex += 1;
    }
  }

  return results;
}

/**
 * Renders a specific slice of an image to a WebP blob via OffscreenCanvas or DOM Canvas.
 */
async function renderCanvasSlice(
  source: ImageBitmap | HTMLImageElement,
  sx: number, sy: number, sw: number, sh: number,
  dw: number, dh: number,
  quality: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(dw, dh);
    const ctx = oc.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar el contexto 2D de OffscreenCanvas.');
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
    const blob = await oc.convertToBlob({ type: 'image/webp', quality });
    if (blob.type !== 'image/webp') {
      throw new Error(`El navegador produjo un MIME type incompatible (${blob.type}). Se requiere WebP nativo.`);
    }
    return blob;
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar el contexto 2D de Canvas.');
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) throw new Error('Fallo al renderizar Blob WebP en Canvas.');
    if (blob.type !== 'image/webp') {
      throw new Error(`El navegador produjo un MIME type incompatible (${blob.type}). Se requiere WebP nativo.`);
    }
    return blob;
  }

  throw new Error('No se encontró soporte de Canvas en este entorno.');
}

/**
 * Decodes a single File or Blob to an ImageBitmap or HTMLImageElement,
 * converts to WebP, and frees references immediately.
 */
export async function processSingleImageFile(
  file: Blob | File,
  originalName: string,
  startPageNumber: number,
  options?: ClientIngestionOptions
): Promise<ProcessedWebpPage[]> {
  let bitmap: ImageBitmap | null = null;
  let imgElem: HTMLImageElement | null = null;
  let objectUrl: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file);
      } catch {}
    }

    if (!bitmap && typeof document !== 'undefined') {
      objectUrl = URL.createObjectURL(file);
      imgElem = new Image();
      await new Promise<void>((resolve, reject) => {
        imgElem!.onload = () => resolve();
        imgElem!.onerror = () => reject(new Error(`No se pudo decodificar la imagen "${originalName}".`));
        imgElem!.src = objectUrl!;
      });
    }

    const source = bitmap || imgElem;
    if (!source) {
      throw new Error(`No se pudo inicializar decodificador para "${originalName}".`);
    }

    return await convertBitmapToWebpBlobs(source, originalName, startPageNumber, options);
  } finally {
    if (bitmap) {
      try { bitmap.close(); } catch {}
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * ZIP entry structure discovered from Central Directory.
 */
export interface ZipImageEntry {
  name: string;
  localHeaderOffset: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number; // 0 = stored, 8 = deflated
  extract: () => Promise<Blob>;
}

/**
 * Reads Central Directory of a ZIP / CBZ archive incrementally.
 * Validates zip bomb thresholds, ratio, entries count and natural sort order.
 */
export async function inspectZipArchive(
  archiveFile: File,
  signal?: AbortSignal
): Promise<ZipImageEntry[]> {
  if (archiveFile.size > MAX_ARCHIVE_BYTES) {
    throw new Error(`El archivo comprimido supera el límite de ${MAX_ARCHIVE_BYTES / (1024 * 1024)} MB.`);
  }

  // Find End of Central Directory record (EOCD signature: 0x06054b50)
  const scanSize = Math.min(archiveFile.size, 65536 + 22);
  const tailBuffer = await archiveFile.slice(archiveFile.size - scanSize).arrayBuffer();
  const tailView = new DataView(tailBuffer);

  let eocdOffsetInTail = -1;
  for (let i = tailBuffer.byteLength - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocdOffsetInTail = i;
      break;
    }
  }

  if (eocdOffsetInTail === -1) {
    throw new Error('Formato ZIP inválido: No se encontró el registro End of Central Directory (EOCD).');
  }

  const cdTotalEntries = tailView.getUint16(eocdOffsetInTail + 10, true);
  const cdSize = tailView.getUint32(eocdOffsetInTail + 12, true);
  const cdOffset = tailView.getUint32(eocdOffsetInTail + 16, true);

  if (cdTotalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`El archivo ZIP contiene demasiadas entradas (${cdTotalEntries} > ${MAX_ZIP_ENTRIES}).`);
  }

  if (cdOffset + cdSize > archiveFile.size) {
    throw new Error('Estructura ZIP corrupta: El directorio central excede el tamaño del archivo.');
  }

  const cdBuffer = await archiveFile.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
  const cdView = new DataView(cdBuffer);

  const entries: ZipImageEntry[] = [];
  let offset = 0;
  let totalUncompressed = 0;

  const validExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

  while (offset < cdBuffer.byteLength) {
    if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');
    if (cdView.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const flag = cdView.getUint16(offset + 8, true);
    if ((flag & 0x0001) !== 0) {
      throw new Error('Los archivos ZIP protegidos con contraseña no están admitidos.');
    }

    const compressionMethod = cdView.getUint16(offset + 10, true);
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error(`Método de compresión ZIP no soportado (${compressionMethod}). Solo se admiten Store y Deflate.`);
    }

    const compressedSize = cdView.getUint32(offset + 20, true);
    const uncompressedSize = cdView.getUint32(offset + 24, true);
    const fileNameLen = cdView.getUint16(offset + 28, true);
    const extraLen = cdView.getUint16(offset + 30, true);
    const commentLen = cdView.getUint16(offset + 32, true);
    const localHeaderOffset = cdView.getUint32(offset + 42, true);

    const rawNameBytes = new Uint8Array(cdBuffer, offset + 46, fileNameLen);
    const fileName = new TextDecoder('utf-8').decode(rawNameBytes);

    offset += 46 + fileNameLen + extraLen + commentLen;

    // Zip bomb checks
    if (compressedSize > 0 && (uncompressedSize / compressedSize) > MAX_COMPRESSION_RATIO) {
      throw new Error(`Ratio de compresión anormal en "${fileName}" (${Math.round(uncompressedSize / compressedSize)}:1).`);
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_EXPANDED_BYTES) {
      throw new Error(`El archivo descomprimido superaría el límite de ${MAX_EXPANDED_BYTES / (1024 * 1024 * 1024)} GiB.`);
    }

    // Skip directories, OS metadata, hidden files, and unsupported extensions
    const normalizedName = fileName.replace(/\\/g, '/');
    if (
      normalizedName.endsWith('/') ||
      normalizedName.startsWith('__MACOSX/') ||
      normalizedName.includes('/.') ||
      normalizedName.startsWith('.')
    ) {
      continue;
    }

    if (normalizedName.includes('..')) {
      throw new Error(`Ruta inválida en archivo ZIP: "${normalizedName}".`);
    }

    const dotIndex = normalizedName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? normalizedName.slice(dotIndex).toLowerCase() : '';
    if (!validExtensions.has(ext)) {
      continue;
    }

    // Construct lazy extractor for this entry
    const entryData: ZipImageEntry = {
      name: normalizedName,
      localHeaderOffset,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      extract: async () => {
        // Read local header (signature 0x04034b50)
        const localHeaderBuf = await archiveFile.slice(localHeaderOffset, localHeaderOffset + 30).arrayBuffer();
        const localView = new DataView(localHeaderBuf);
        if (localView.getUint32(0, true) !== 0x04034b50) {
          throw new Error(`Cabecera local corrupta para "${normalizedName}".`);
        }
        const localNameLen = localView.getUint16(26, true);
        const localExtraLen = localView.getUint16(28, true);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const compressedBlob = archiveFile.slice(dataStart, dataStart + compressedSize);

        if (compressionMethod === 0) {
          return compressedBlob;
        }

        if (typeof DecompressionStream === 'undefined') {
          throw new Error('DecompressionStream no está soportado en este navegador para descomprimir Deflate.');
        }

        const ds = new DecompressionStream('deflate-raw');
        const decompressedStream = compressedBlob.stream().pipeThrough(ds);
        return await new Response(decompressedStream).blob();
      },
    };

    entries.push(entryData);
  }

  if (entries.length === 0) {
    throw new Error('El archivo comprimido no contiene imágenes válidas (JPG, PNG, WebP, AVIF, GIF).');
  }

  // Natural sort order
  entries.sort((a, b) => naturalSortCompare(a.name, b.name));

  return entries;
}

/**
 * Uploads a single pre-processed WebP blob directly to the backend.
 */
export async function uploadSingleWebpPage(
  seriesId: string,
  chapterId: string,
  webpBlob: Blob,
  signal?: AbortSignal
): Promise<{ statusCode: number; pageNumber: number }> {
  const formData = new FormData();
  formData.append('page', webpBlob, `page-${Date.now()}.webp`);

  const res = await fetch(
    `/api/v1/manga/${encodeURIComponent(seriesId)}/chapters/${encodeURIComponent(chapterId)}/pages`,
    {
      method: 'POST',
      headers: {
        'X-Requested-With': 'KuraScrollSPA',
      },
      credentials: 'include',
      body: formData,
      signal,
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Error al subir página (${res.status})`);
  }

  return data;
}

/**
 * High-level orchestration function:
 * Converts either a CBZ/ZIP archive or a list of image files on the client device
 * into sequential WebP pages (max width 1440, quality 0.82), streaming one page
 * at a time to the Fastify backend, and yields to avoid blocking UI rendering.
 */
export async function processAndUploadChapterPages(params: {
  seriesId: string;
  chapterId: string;
  source: { type: 'archive'; file: File } | { type: 'pages'; files: File[] };
  options?: ClientIngestionOptions;
}): Promise<{ totalPagesUploaded: number }> {
  const { seriesId, chapterId, source, options } = params;
  const onProgress = options?.onProgress;
  const signal = options?.signal;

  // Validate native WebP support
  const webpSupported = await isWebpSupported();
  if (!webpSupported) {
    throw new Error('Su navegador no soporta la codificación WebP requerida. Actualice su navegador para publicar mangas.');
  }

  let totalPagesUploaded = 0;

  if (source.type === 'archive') {
    onProgress?.({
      stage: 'analyzing',
      currentPage: 0,
      totalPages: 0,
      percent: 5,
      message: 'Analizando archivo comprimido...',
    });

    const entries = await inspectZipArchive(source.file, signal);
    const totalEntries = entries.length;

    for (let i = 0; i < totalEntries; i++) {
      if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');

      const entry = entries[i];
      onProgress?.({
        stage: 'processing',
        currentPage: i + 1,
        totalPages: totalEntries,
        percent: Math.round(((i + 0.3) / totalEntries) * 90),
        message: `Extrayendo y optimizando página ${i + 1} de ${totalEntries} (${entry.name})...`,
      });

      // Cooperative yield
      await new Promise((resolve) => setTimeout(resolve, 0));

      const rawBlob = await entry.extract();
      const processedPages = await processSingleImageFile(
        rawBlob,
        entry.name,
        totalPagesUploaded + 1,
        options
      );

      // Upload each generated page segment
      for (const page of processedPages) {
        if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');
        onProgress?.({
          stage: 'uploading',
          currentPage: totalPagesUploaded + 1,
          totalPages: totalEntries,
          percent: Math.round(((i + 0.8) / totalEntries) * 90),
          message: `Transmitiendo página WebP ${totalPagesUploaded + 1}...`,
        });

        await uploadSingleWebpPage(seriesId, chapterId, page.blob, signal);
        totalPagesUploaded += 1;
      }
    }
  } else {
    // Individual image files
    const sortedFiles = [...source.files].sort((a, b) => naturalSortCompare(a.name, b.name));
    const totalFiles = sortedFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');

      const file = sortedFiles[i];
      onProgress?.({
        stage: 'processing',
        currentPage: i + 1,
        totalPages: totalFiles,
        percent: Math.round(((i + 0.3) / totalFiles) * 90),
        message: `Optimizando imagen ${i + 1} de ${totalFiles} (${file.name}) a WebP...`,
      });

      // Cooperative yield
      await new Promise((resolve) => setTimeout(resolve, 0));

      const processedPages = await processSingleImageFile(
        file,
        file.name,
        totalPagesUploaded + 1,
        options
      );

      for (const page of processedPages) {
        if (signal?.aborted) throw new DOMException('Procesamiento cancelado por el usuario', 'AbortError');
        onProgress?.({
          stage: 'uploading',
          currentPage: totalPagesUploaded + 1,
          totalPages: totalFiles,
          percent: Math.round(((i + 0.8) / totalFiles) * 90),
          message: `Transmitiendo página WebP ${totalPagesUploaded + 1}...`,
        });

        await uploadSingleWebpPage(seriesId, chapterId, page.blob, signal);
        totalPagesUploaded += 1;
      }
    }
  }

  onProgress?.({
    stage: 'complete',
    currentPage: totalPagesUploaded,
    totalPages: totalPagesUploaded,
    percent: 100,
    message: `¡${totalPagesUploaded} páginas procesadas y enviadas con éxito!`,
  });

  return { totalPagesUploaded };
}
