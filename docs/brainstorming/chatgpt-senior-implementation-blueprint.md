¡Perfecto, colega! Ahora sí tenemos las condiciones reales para diseñar esto sin especular demasiado.

Con Windows 10/11, HDD de 5400 RPM, aproximadamente 75 IOPS y archivos WebP individuales, mi decisión sería:

- A: caché LRU por bytes, con presupuestos independientes para manifiestos y páginas.
- B: prefetch predictivo con cancelación real de peticiones HTTP y deduplicación de trabajos.
- C: virtualización por altura conocida desde el manifiesto, con anclaje de scroll como segunda protección.

Hay una consideración importante: en un HDD de 5400 RPM, reducir operaciones físicas aleatorias suele ser más importante que incrementar la concurrencia. No queremos 20 lecturas simultáneas compitiendo por el cabezal.

Voy a plantearlo como código integrable, no solamente pseudocódigo.

# A. ByteLRU para Fastify

## A.1. Presupuesto de memoria

No daría a la caché permiso para consumir toda la RAM disponible.

Propongo comenzar con este presupuesto configurable:

## Presupuesto inicial de caché

# 320 MiB

Presupuesto máximo de las dos cachés de aplicación

Buffers WebP

256 MiB

Manifiestos

32 MiB

Reserva

32 MiB

La reserva no se asigna automáticamente a las cachés. Está destinada a absorber variaciones de memoria y otros componentes.

Esto no es un límite del RSS del proceso: Node.js, Sharp, SQLite, buffers temporales y el propio navegador consumen memoria adicional.

## A.2. Implementación del LRU

Crearía:

```
src/
  infrastructure/
    cache/
      ByteLRU.js
      mediaCache.js
```

`ByteLRU.js`:

```

export class ByteLRU {
  constructor({
    maxBytes,
    maxEntryBytes = maxBytes,
    onEvict = () => {}
  }) {
    this.maxBytes = maxBytes;
    this.maxEntryBytes = maxEntryBytes;
    this.onEvict = onEvict;

    this.bytes = 0;
    this.items = new Map();

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      rejected: 0
    };
  }

  get(key) {
    const item = this.items.get(key);

    if (!item) {
      this.stats.misses++;
      return undefined;
    }

    // Actualizar posición LRU.
    this.items.delete(key);
    this.items.set(key, item);

    this.stats.hits++;

    return item.value;
  }

  has(key) {
    return this.items.has(key);
  }

  set(key, value, size) {
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > this.maxEntryBytes
    ) {
      this.stats.rejected++;
      return false;
    }

    this.delete(key);

    // Eliminar entradas menos recientes.
    while (
      this.bytes + size > this.maxBytes &&
      this.items.size > 0
    ) {
      const oldestKey =
        this.items.keys().next().value;

      this.delete(oldestKey);
      this.stats.evictions++;
    }

    this.items.set(key, {
      value,
      size
    });

    this.bytes += size;

    return true;
  }

  delete(key) {
    const item = this.items.get(key);

    if (!item) return false;

    this.items.delete(key);
    this.bytes -= item.size;

    try {
      this.onEvict(item.value, key);
    } catch {
      // La liberación no debe romper el cache.
    }

    return true;
  }

  clear() {
    for (const key of this.items.keys()) {
      this.delete(key);
    }
  }

  getMetrics() {
    return {
      entries: this.items.size,
      usedBytes: this.bytes,
      maxBytes: this.maxBytes,
      hitRatio:
        this.stats.hits +
        this.stats.misses > 0
          ? this.stats.hits /
            (this.stats.hits + this.stats.misses)
          : 0,
      ...this.stats
    };
  }
}

```

Detalle importante: este LRU supone que los valores almacenados son inmutables mientras permanecen en caché. No debes modificar un Buffer recuperado ni compartirlo con código que lo altere.

También conviene protegerlo de operaciones concurrentes sobre la misma clave, algo que resolveremos con un pequeño mecanismo de deduplicación.

## A.3. Dos cachés independientes

`mediaCache.js`:

```

import { ByteLRU } from "./ByteLRU.js";

export const manifestCache = new ByteLRU({
  maxBytes: 32 * 1024 * 1024,
  maxEntryBytes: 2 * 1024 * 1024
});

export const imageCache = new ByteLRU({
  maxBytes: 256 * 1024 * 1024,
  maxEntryBytes: 8 * 1024 * 1024
});

```

¿Por qué separar las dos?

Porque una importación o lectura de imágenes no debe expulsar todos los manifiestos de la caché.

Para los manifiestos, cobraría el tamaño del JSON serializado multiplicado por un factor conservador para aproximar el coste del objeto JavaScript. Para imágenes, utilizaría el tamaño real del Buffer comprimido.

## A.4. Integración con Fastify

Ahora necesitamos que dos peticiones simultáneas de la misma página no provoquen dos lecturas físicas.

Usaría una capa `getOrLoad()` que deduplique operaciones en curso:

```

export class CacheLoader {
  constructor(cache) {
    this.cache = cache;
    this.pending = new Map();
  }

  async getOrLoad(key, loader) {
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const existing = this.pending.get(key);

    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const result = await loader();

        if (result) {
          this.cache.set(
            key,
            result.value,
            result.size
          );
        }

        return result?.value;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, promise);

    return promise;
  }
}

```

Añadiría una instancia para cada caché:

```
import { CacheLoader } from "./CacheLoader.js";
import {
  imageCache,
  manifestCache
} from "./mediaCache.js";

export const loadImage =
  new CacheLoader(imageCache);

export const loadManifest =
  new CacheLoader(manifestCache);
```

### Endpoint de páginas

El endpoint debe trabajar con un ID interno de página. Nunca con una ruta arbitraria enviada por React.

Ejemplo de integración:

```

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { loadImage } from "./cacheInstances.js";

// Estas dos funciones pertenecen a tu capa de datos.
import {
  findPageById,
  getLibraryRoot
} from "./libraryRepository.js";

export async function registerPageRoutes(fastify) {
  fastify.get(
    "/api/pages/:pageId",
    async (request, reply) => {
      const page = await findPageById(
        request.params.pageId
      );

      if (!page) {
        return reply.code(404).send({
          error: "PAGE_NOT_FOUND"
        });
      }

      const root = await getLibraryRoot();

      // La ruta debe proceder de metadatos internos.
      const filePath = path.resolve(
        root,
        page.relativePath
      );

      const relative = path.relative(
        root,
        filePath
      );

      if (
        relative.startsWith("..") ||
        path.isAbsolute(relative)
      ) {
        return reply.code(403).send({
          error: "INVALID_PAGE_PATH"
        });
      }

      let stat;

      try {
        stat = await fs.stat(filePath);
      } catch {
        return reply.code(404).send({
          error: "PAGE_FILE_NOT_FOUND"
        });
      }

      if (!stat.isFile()) {
        return reply.code(404).send({
          error: "INVALID_PAGE_FILE"
        });
      }

      // El cache solo almacena archivos pequeños.
      if (stat.size > 8 * 1024 * 1024) {
        return reply.code(413).send({
          error: "PAGE_TOO_LARGE"
        });
      }

      const cacheKey = [
        page.id,
        stat.size,
        stat.mtimeMs
      ].join(":");

      let buffer;

      try {
        buffer = await loadImage.getOrLoad(
          cacheKey,
          async () => {
            const data = await fs.readFile(
              filePath
            );

            // Verificar que el archivo no cambió
            // mientras se estaba leyendo.
            const currentStat = await fs.stat(
              filePath
            );

            if (
              currentStat.size !== stat.size ||
              currentStat.mtimeMs !== stat.mtimeMs
            ) {
              return null;
            }

            return {
              value: data,
              size: data.byteLength
            };
          }
        );
      } catch {
        return reply.code(500).send({
          error: "PAGE_READ_ERROR"
        });
      }

      if (!buffer) {
        return reply.code(503).send({
          error: "PAGE_CHANGED_DURING_READ"
        });
      }

      const etag = `"${createHash("sha256")
        .update(buffer)
        .digest("hex")}"`;

      reply
        .header("Content-Type", "image/webp")
        .header("Content-Length", buffer.length)
        .header("ETag", etag)
        .header(
          "Cache-Control",
          "private, max-age=31536000, immutable"
        );

      if (request.headers["if-none-match"] === etag) {
        return reply.code(304).send();
      }

      return reply.send(buffer);
    }
  );
}

```

Hay dos consideraciones para producción:

- El ejemplo supone que las páginas WebP son inmutables después de importarse. Si se reemplazan, usa una versión de contenido en la clave de caché y en la URL.
- El límite de 8 MiB permite mantener un presupuesto predecible. Para imágenes superiores, usaría streaming con `createReadStream()` y sin introducirlas en el LRU.

El `sha256` del ejemplo se calcula al servir la respuesta; si esto resulta costoso, calcula el hash durante la importación y guárdalo en SQLite.

Otra mejora para Windows: cuando implementes la cola de lectura física, limita inicialmente las lecturas simultáneas del HDD a 1–2. El LRU y la deduplicación deben funcionar antes de incrementar esa concurrencia.

## A.5. Endpoint de manifiestos

Los manifiestos deben validarse antes de entrar en caché.

Una estrategia:

1. Leer el archivo.
2. Validar JSON.
3. Validar esquema y límites.
4. Convertirlo a una estructura normalizada.
5. Guardarlo en caché con una clave versionada.

No permitiría que un manifiesto de varios megabytes se introduzca sin validar.

También evitaría almacenar dos copias grandes del mismo manifiesto, una como Buffer y otra como objeto, sin contabilizar ambas.

# B. Adaptive Prefetch Controller en React 19

Aquí propongo una arquitectura que distingue tres conceptos:

- Página visible: prioridad máxima.
- Página próxima: prefetch prioritario.
- Página lejana: prefetch de baja prioridad.

La cancelación debe ser real, no simplemente ignorar una respuesta que ya llegó.

## B.1. Política de prefetch

Para nuestro HDD utilizaría esta configuración inicial:

| Velocidad de scroll | Siguientes páginas | Anteriores |
| ------------------- | ------------------ | ---------- |
| Lento               | 4                  | 2          |
| Normal              | 3                  | 1          |
| Rápido              | 2                  | 0          |
| Muy rápido          | 1                  | 0          |

Puede parecer extraño reducir el número de páginas durante un scroll muy rápido.

La razón: si alguien pasa del índice 20 al 70, precargar 21–30 es desperdiciar recursos.

En ese momento importa priorizar la nueva zona visible, no completar el recorrido anterior.

## B.2. Implementación del controlador

Crearía:

```
src/
  reader/
    prefetch/
      AdaptivePrefetchController.js
      useAdaptivePrefetch.js
```

`AdaptivePrefetchController.js`:

```

export class AdaptivePrefetchController {
  constructor({
    maxConcurrent = 2,
    maxCachedBytes = 32 * 1024 * 1024,
    maxBlobBytes = 4 * 1024 * 1024
  } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.maxCachedBytes = maxCachedBytes;
    this.maxBlobBytes = maxBlobBytes;

    this.queue = [];
    this.active = new Map();
    this.blobs = new Map();

    this.cachedBytes = 0;
    this.sequence = 0;
    this.destroyed = false;
  }

  setPriority(pages) {
    if (this.destroyed) return;

    const wanted = new Map(
      pages.map((page, index) => [
        page.id,
        {
          ...page,
          priority: pages.length - index
        }
      ])
    );

    // Cancelar peticiones que ya no interesan.
    for (const [id, task] of this.active) {
      if (!wanted.has(id)) {
        task.controller.abort();
        this.active.delete(id);
      }
    }

    // Limpiar trabajos obsoletos.
    this.queue = this.queue.filter(page =>
      wanted.has(page.id) &&
      !this.blobs.has(page.id) &&
      !this.active.has(page.id)
    );

    // Añadir trabajos pendientes.
    for (const page of wanted.values()) {
      if (
        this.blobs.has(page.id) ||
        this.active.has(page.id)
      ) {
        continue;
      }

      this.queue.push({
        ...page,
        sequence: ++this.sequence
      });
    }

    this.queue.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.sequence - b.sequence
    );

    this.pump();
  }

  pump() {
    if (this.destroyed) return;

    while (
      this.active.size < this.maxConcurrent &&
      this.queue.length > 0
    ) {
      const page = this.queue.shift();

      const controller = new AbortController();

      const task = {
        controller,
        priority: page.priority
      };

      this.active.set(page.id, task);

      this.fetchPage(page, controller.signal)
        .catch(() => {})
        .finally(() => {
          if (this.active.get(page.id) === task) {
            this.active.delete(page.id);
          }

          this.pump();
        });
    }
  }

  async fetchPage(page, signal) {
    const response = await fetch(page.url, {
      signal,
      cache: "force-cache",
      priority: "low"
    });

    if (!response.ok) {
      throw new Error(
        `Prefetch failed: ${response.status}`
      );
    }

    const blob = await response.blob();

    if (signal.aborted || this.destroyed) {
      return;
    }

    if (
      blob.size === 0 ||
      blob.size > this.maxBlobBytes
    ) {
      return;
    }

    this.insertBlob(page.id, blob);
  }

  insertBlob(id, blob) {
    if (this.blobs.has(id)) return;

    while (
      this.cachedBytes + blob.size >
      this.maxCachedBytes
    ) {
      const oldestKey =
        this.blobs.keys().next().value;

      if (oldestKey === undefined) return;

      const oldest = this.blobs.get(oldestKey);

      this.blobs.delete(oldestKey);
      this.cachedBytes -= oldest.size;
    }

    this.blobs.set(id, blob);
    this.cachedBytes += blob.size;
  }

  getBlob(id) {
    const blob = this.blobs.get(id);

    if (!blob) return null;

    // Actualizar LRU.
    this.blobs.delete(id);
    this.blobs.set(id, blob);

    return blob;
  }

  cancelAll() {
    for (const task of this.active.values()) {
      task.controller.abort();
    }

    this.active.clear();
    this.queue = [];
  }

  destroy() {
    this.destroyed = true;

    this.cancelAll();
    this.blobs.clear();

    this.cachedBytes = 0;
  }
}

```

Una aclaración: `priority: "low"` es una pista al navegador, no una garantía de orden de ejecución. La prioridad real de nuestro sistema la determina la cola.

También recuerda que cancelar una descarga no garantiza detener inmediatamente todo el trabajo de red que el navegador ya haya completado.

## B.3. Hook de React 19

El controlador será una instancia estable durante la vida del lector.

El hook debe:

- Medir velocidad.
- Detectar dirección.
- Calcular páginas objetivo.
- Cancelar solicitudes obsoletas.
- Destruirse al abandonar el capítulo.

```

import {
  useCallback,
  useEffect,
  useRef
} from "react";

import {
  AdaptivePrefetchController
} from "./AdaptivePrefetchController.js";

export function useAdaptivePrefetch(pages) {
  const controllerRef = useRef(null);

  const positionRef = useRef({
    index: 0,
    previousY: 0,
    previousTime: 0,
    velocity: 0
  });

  useEffect(() => {
    const controller =
      new AdaptivePrefetchController({
        maxConcurrent: 2,
        maxCachedBytes: 32 * 1024 * 1024
      });

    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const update = useCallback(
    (index, scrollY) => {
      const controller = controllerRef.current;

      if (!controller) return;

      const now = performance.now();
      const state = positionRef.current;

      const deltaY = scrollY - state.previousY;
      const deltaTime = now - state.previousTime;

      const velocity = deltaTime > 0
        ? Math.abs(deltaY / deltaTime)
        : 0;

      const direction = deltaY >= 0 ? 1 : -1;

      state.index = index;
      state.previousY = scrollY;
      state.previousTime = now;
      state.velocity = velocity;

      let forward;
      let backward;

      if (velocity > 2.5) {
        forward = 1;
        backward = 0;
      } else if (velocity > 1.2) {
        forward = 2;
        backward = 0;
      } else {
        forward = 4;
        backward = 2;
      }

      const targets = [];

      // Priorizar la dirección del movimiento.
      for (let i = 1; i <= forward; i++) {
        const pageIndex = index + direction * i;

        if (pages[pageIndex]) {
          targets.push({
            ...pages[pageIndex],
            priority: 100 - i
          });
        }
      }

      // Precargar algunas páginas hacia atrás.
      for (let i = 1; i <= backward; i++) {
        const pageIndex = index - direction * i;

        if (pages[pageIndex]) {
          targets.push({
            ...pages[pageIndex],
            priority: 50 - i
          });
        }
      }

      controller.setPriority(targets);
    },
    [pages]
  );

  const getBlob = useCallback((id) => {
    return controllerRef.current?.getBlob(id) ?? null;
  }, []);

  return {
    update,
    getBlob
  };
}

```

Para React, la llamada sería:

```
const prefetch = useAdaptivePrefetch(pages);

// Cuando cambia la página visible:
prefetch.update(visibleIndex, window.scrollY);
```

Hay una mejora que incorporaría antes de producción: aplicar un intervalo mínimo de actualización de unos 80–120 ms para evitar recalcular la cola en cada evento de scroll.

Importante: este ejemplo almacena los Blob comprimidos, no imágenes decodificadas. Eso permite un presupuesto más predecible. El componente de imagen puede crear un Object URL para la página que realmente necesita mostrar, revocándolo cuando ya no lo utiliza.

No utilizaría `useMemo` para almacenar el controlador ni crearía un controlador nuevo en cada render.

## B.4. Dos correcciones importantes antes de producción

Hay dos detalles que no dejaría pasar en la primera versión.

Primero: no liberar un slot de concurrencia antes de que termine la petición abortada.

`AbortController.abort()` inicia la cancelación, pero la promesa todavía puede estar finalizando. Si eliminamos inmediatamente la tarea del mapa, podemos superar accidentalmente el límite de dos peticiones.

La solución es mantener la petición registrada hasta su `finally`.

Segundo: si una página vuelve a ser necesaria mientras su petición se está cancelando, hay que volver a programarla.

Para ello, modificaría el controlador anterior incorporando un mapa de páginas deseadas:

```
// En el constructor:
this.desired = new Map();

// Dentro de setPriority(), después de crear wanted:
this.desired = wanted;

// No elimines inmediatamente las tareas abortadas:
for (const [id, task] of this.active) {
  if (!wanted.has(id)) {
    task.controller.abort();
  }
}

// En finally de pump():
.finally(() => {
  if (this.active.get(page.id) === task) {
    this.active.delete(page.id);
  }

  const current = this.desired.get(page.id);

  // Si volvió a ser necesaria durante la cancelación,
  // volver a ponerla en cola.
  if (
    current &&
    !this.blobs.has(page.id) &&
    !this.queue.some(item => item.id === page.id)
  ) {
    this.queue.push(current);
  }

  this.pump();
});
```

En este caso, sustituye el bloque correspondiente del controlador anterior. Así conservas el límite real de concurrencia.

También inicializa correctamente el primer evento del hook:

```
if (state.previousTime === 0) {
  state.previousY = scrollY;
  state.previousTime = now;
  return;
}
```

Esto evita interpretar la primera lectura del scroll como un desplazamiento de miles de píxeles por segundo.

# C. Webtoon virtualizado sin saltos de layout

Esta es mi parte favorita porque podemos eliminar buena parte del problema desde el pipeline de importación.

No esperes a que el navegador conozca las dimensiones de una imagen para calcular su altura.

Ya tienes Sharp y `manifest.json`. Aprovechémoslo.

## C.1. Añadir dimensiones al manifiesto

Cada página debería tener:

```
{
  "id": "page-001",
  "index": 0,
  "file": "0001.webp",
  "width": 1440,
  "height": 3200,
  "aspectRatio": 0.45
}
```

El cálculo es:

\\[ H\_{\text{render}} = W\_{\text{container}} \times \frac{H\_{\text{original}}}{W\_{\text{original}}} \\]

Por ejemplo, con un contenedor de 900 px y una imagen de 1440 × 3200:

\\[ H\_{\text{render}} = 900 \times \frac{3200}{1440} = 2000\text{ px} \\]

React ya conoce la altura antes de que el WebP llegue.

Antes y después

Incorrecto

Imagen cargando

Altura desconocida

Contenido desplazado

Correcto

Placeholder

Altura reservada

Imagen reemplazada

Sin desplazamiento

Representación conceptual; la altura reservada debe coincidir con las dimensiones reales.

## C.2. Implementación con TanStack Virtual

Instalación:

```
npm install @tanstack/react-virtual
```

Componente `WebtoonReader.jsx`:

```

import {
  useRef,
  useState,
  useMemo,
  useLayoutEffect
} from "react";

import { useVirtualizer } from
  "@tanstack/react-virtual";

function WebtoonReader({ pages }) {
  const parentRef = useRef(null);

  const [containerWidth, setContainerWidth] =
    useState(900);

  const [fastScroll, setFastScroll] =
    useState(false);

  const virtualizer = useVirtualizer({
    count: pages.length,

    getScrollElement: () => parentRef.current,

    getItemKey: (index) => pages[index].id,

    estimateSize: (index) => {
      const page = pages[index];

      return (
        containerWidth *
        page.height /
        page.width
      );
    },

    overscan: fastScroll ? 8 : 4,

    // Evita saltos cuando se corrige
    // una altura previamente estimada.
    shouldAdjustScrollPositionOnItemSizeChange:
      (item, delta) => {
        return item.start <
          (parentRef.current?.scrollTop ?? 0);
      }
  });

  useLayoutEffect(() => {
    const element = parentRef.current;

    if (!element) return;

    const observer = new ResizeObserver(
      ([entry]) => {
        setContainerWidth(
          entry.contentRect.width
        );
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const virtualItems =
    virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="webtoon-scroll"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative"
        }}
      >
        {virtualItems.map((item) => {
          const page = pages[item.index];

          return (
            <div
              key={page.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="webtoon-item"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform:
                  `translateY(${item.start}px)`,
                aspectRatio:
                  `${page.width} / ${page.height}`
              }}
            >
              <WebtoonImage page={page} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WebtoonImage({ page }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="webtoon-image">
      <div className="webtoon-placeholder" />

      <img
        src={page.url}
        width={page.width}
        height={page.height}
        loading="eager"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        className={
          loaded
            ? "webtoon-image-loaded"
            : "webtoon-image-loading"
        }
        alt=""
      />
    </div>
  );
}

export default WebtoonReader;

```

Hay una pequeña extensión que añadiría al ejemplo: el `ResizeObserver` debe actualizar también el tamaño del virtualizador cuando cambia el ancho del contenedor. En la versión final, después de `setContainerWidth`, llama a `virtualizer.measure()` para recalcular las alturas estimadas.

Además, `fastScroll` debe conectarse al detector de velocidad del apartado B, no permanecer como estado decorativo.

## C.3. CSS para eliminar el flash visual

```
.webtoon-scroll {
  height: 100%;
  overflow-y: auto;

  /* Evita que el navegador y el virtualizador
     compensen simultáneamente el scroll. */
  overflow-anchor: none;

  scrollbar-gutter: stable;
}

.webtoon-item {
  overflow: hidden;
  contain: layout paint;
  background: #111;
}

.webtoon-image {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #111;
}

.webtoon-placeholder {
  position: absolute;
  inset: 0;
  background: #171717;
}

.webtoon-image img {
  position: absolute;
  inset: 0;

  display: block;
  width: 100%;
  height: 100%;

  object-fit: contain;
}

.webtoon-image-loading {
  opacity: 0;
}

.webtoon-image-loaded {
  opacity: 1;
}
```

El placeholder conserva el espacio mientras llega la imagen. No necesitas animaciones de entrada ni transiciones complejas para resolver el parpadeo.

Importante: al utilizar `overflow-anchor: none`, dependes del ajuste de scroll del virtualizador. No debes desactivar el anclaje automático sin activar una estrategia propia de compensación.

## C.4. Anclaje del scroll: la última defensa

Aunque las dimensiones del manifiesto sean correctas, puede haber pequeñas diferencias por redondeo, cambio de ancho, zoom o mediciones tardías.

Aquí utilizaría la estrategia de TanStack:

`shouldAdjustScrollPositionOnItemSizeChange`.

La condición del ejemplo indica que las correcciones de elementos situados por encima del scroll deben compensarse.

Así, si el usuario está leyendo el panel 65 y una medición tardía modifica la altura del panel 20, la posición visual del panel 65 permanece estable.

Mi recomendación es no combinar esta compensación con otro sistema manual que modifique `scrollTop`, porque podrías corregir dos veces el mismo desplazamiento.

## C.5. Integración del prefetch con las imágenes

Hay un último detalle importante: el `AdaptivePrefetchController` guarda los Blob, pero el componente anterior utiliza directamente `page.url`.

Para aprovechar realmente esa caché, haría que el controlador notifique cuando termina una descarga.

En el constructor:

```
constructor({
  maxConcurrent = 2,
  maxCachedBytes = 32 * 1024 * 1024,
  onReady = () => {}
} = {}) {
  // ... configuración anterior

  this.onReady = onReady;
}
```

Después de `insertBlob()`:

```
this.insertBlob(page.id, blob);
this.onReady(page.id);
```

En el hook, añade un estado que permita notificar a React:

```
const [cacheVersion, setCacheVersion] = useState(0);

// Al crear el controlador:
const controller = new AdaptivePrefetchController({
  maxConcurrent: 2,
  maxCachedBytes: 32 * 1024 * 1024,
  onReady: () => {
    setCacheVersion(v => v + 1);
  }
});
```

Y devuelve `cacheVersion` junto con `getBlob`.

El componente puede crear su URL temporal:

```
function WebtoonImage({
  page,
  getBlob,
  cacheVersion
}) {
  const [src, setSrc] = useState(page.url);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const blob = getBlob(page.id);

    if (!blob) {
      setSrc(page.url);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);

    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [page.id, page.url, cacheVersion, getBlob]);

  return (
    <img
      src={src}
      width={page.width}
      height={page.height}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
      alt=""
    />
  );
}
```

De esta manera, el navegador no necesita volver a solicitar al servidor una página que ya está en la caché de prefetch.

En producción, añadiría una pequeña distinción entre páginas visibles y páginas únicamente precargadas: nunca revocaría una URL mientras el elemento todavía la esté utilizando.

# 7. Ajustes finales que no dejaría pendientes

Antes de integrar todo en KuraScroll, hay cuatro mejoras que considero importantes:

| Componente  | Mejora                                              |
| ----------- | --------------------------------------------------- |
| ByteLRU     | Invalidación por versión de contenido               |
| Fastify     | `realpath()` para impedir escapes mediante symlinks |
| Prefetch    | No superar concurrencia mientras abortan peticiones |
| Virtualizer | Recalcular mediciones cuando cambia el ancho        |

Y una corrección al endpoint anterior: los 8 MiB son el límite de admisión a la caché, no un límite que deba impedir mostrar imágenes más grandes. Para archivos superiores, utiliza `createReadStream()` y no los almacenes en el LRU.

## 8. Cómo validaría esta implementación

No daría por terminada la optimización hasta ejecutar estos escenarios:

## Pruebas de aceptación KuraScroll

Progreso de validación

0/10

Abrir un capítulo de 120 páginas sin cargar todas las imágenes simultáneamente.

Hacer scroll rápidamente desde el panel 10 hasta el 100.

Invertir inmediatamente la dirección del scroll.

Cambiar de capítulo mientras existen peticiones pendientes.

Verificar que la concurrencia de prefetch nunca supera 2.

Repetir la lectura de 20 páginas y medir el hit ratio.

Redimensionar la ventana durante la lectura.

Comprobar que el panel visible no cambia de posición por mediciones tardías.

Abrir páginas mayores de 8 MiB mediante streaming.

Comprobar que el uso de memoria de caché nunca supera sus presupuestos.

## Mi decisión técnica definitiva

Storage

ByteLRU independiente para manifiestos y WebP, deduplicación de lecturas y máximo dos operaciones de prefetch simultáneas.

Prefetch

Ventana adaptativa, AbortController, Blob cache y prioridades según dirección y velocidad.

Rendering

TanStack Virtual, dimensiones anticipadas desde Sharp, placeholders con altura reservada y compensación de scroll.

Una propuesta para la siguiente fase: construiría un benchmark automatizado que compare KuraScroll con caché fría y caliente, simulando scroll humano y saltos bruscos entre capítulos en el HDD de 5400 RPM.

Así tendremos datos reales para decidir si merece la pena introducir un scheduler físico de disco o si la caché actual ya está resolviendo el problema.

Podemos preparar esa suite de benchmarks y sus informes de rendimiento cuando quieran pasar a la siguiente fase.

Preparar benchmarks de rendimiento de KuraScroll
