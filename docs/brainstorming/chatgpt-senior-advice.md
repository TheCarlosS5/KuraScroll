¡Hola, Gemini! Un gusto trabajar contigo. 🤝

Para KuraScroll hay una decisión arquitectónica que considero fundamental: no diseñar el sistema como un visor de archivos, sino como un motor de distribución local de páginas con acceso aleatorio optimizado.

Con 4 TB de HDD, React y Node.js, el cuello de botella no será necesariamente Sharp ni SQLite. Será la combinación de latencia mecánica, patrones de acceso impredecibles, presión de memoria y trabajo innecesario en el hilo principal.

Voy por áreas.

# 1. Optimización de lectura aleatoria en HDD de 4 TB



Recomendación arquitectónica

&#x20;Separar almacenamiento, lectura anticipada y caché en tres capas.



## 1.1. No leas directamente desde el HDD cada vez que React lo solicite

Un HDD tiene una penalización considerable por movimientos del cabezal. Leer 30 archivos pequeños dispersos puede ser mucho peor que leer un bloque contiguo.

Mi propuesta:

Capa 1 — HDD (4 TB)

Almacenamiento persistente · CBZ originales · WebP optimizados

Capa 2 — RAM

LRU de páginas decodificadas y buffers recientes

Capa 3 — Read-ahead

Cola de páginas próximas y lecturas concurrentes limitadas

React Reader

Solicita páginas por ID lógico, no por rutas físicas

### 1.2. Prefetching adaptativo

No recomiendo precargar 10 páginas indiscriminadamente.

Implementaría un predictor sencillo:

| Comportamiento     | Prefetch recomendado            |
| ------------------ | ------------------------------- |
| Lectura normal     | 3–5 páginas siguientes          |
| Scroll rápido      | 6–10 páginas siguientes         |
| Scroll inverso     | 2–3 anteriores                  |
| Usuario detenido   | Reducir o pausar                |
| Cambio de capítulo | Cancelar solicitudes anteriores |

Estos números son valores iniciales para experimentar, no constantes universales.

Una optimización importante: utiliza prioridades y cancelación.

Por ejemplo, si el usuario pasa del panel 20 al 65, no tiene sentido seguir procesando las solicitudes 21–25.

Usaría `AbortController` en las solicitudes HTTP y una cola de trabajos con prioridades.

### 1.3. Caché LRU con presupuesto de memoria

Aquí hay una trampa: no debes calcular la caché por cantidad de páginas.

Una página WebP de 200 KB puede convertirse en una imagen decodificada de varios megabytes.

Ejemplo:

- Imagen: 1440 × 2200.
- RGBA decodificado: 1440 × 2200 × 4.
- Resultado: aproximadamente 12,1 MiB.

100 imágenes decodificadas representarían aproximadamente 1,18 GiB.

Por eso recomiendo:

- LRU por bytes, no por elementos.
- Presupuesto configurable.
- Separar caché de bytes comprimidos y caché de imágenes decodificadas.
- Liberar `ImageBitmap` cuando corresponda mediante `close()`.
- Evitar retener Blob URLs indefinidamente.

Una implementación conceptual:

```
class ByteLRU {
  constructor(maxBytes) {
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key, value, size) {
    if (size > this.maxBytes) return;

    const old = this.cache.get(key);

    if (old) {
      this.bytes -= old.size;
      this.cache.delete(key);
    }

    while (this.bytes + size > this.maxBytes) {
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);

      this.bytes -= oldest.size;
      this.cache.delete(oldestKey);

      oldest.dispose?.();
    }

    this.cache.set(key, { value, size });
    this.bytes += size;
  }
}
```

En producción añadiría protección contra inserciones concurrentes, entradas duplicadas, errores de decodificación y políticas de expiración.

### 1.4. Chunking: cuidado con cómo lo implementas

No empaquetaría todo el manga en un único archivo gigante.

Mantendría las páginas WebP individuales, pero introduciría un índice de almacenamiento:

```
library/
  manga-id/
    chapter-id/
      pages/
        0001.webp
        0002.webp
        0003.webp
      manifest.json
```

Si el número de archivos genera demasiada sobrecarga del sistema de archivos, evaluaría contenedores por capítulo con índice de offsets.

Esto permite leer rangos mediante `FileHandle.read()` sin cargar el capítulo completo.

Mi recomendación: primero mide el rendimiento de archivos individuales. Solo implementa contenedores por offsets si el número de operaciones de apertura y búsqueda realmente se convierte en un cuello de botella.

# 2. Virtualización del lector Webtoon: cero parpadeos

Mi recomendación: virtualización por altura medida + overscan adaptativo

Aquí hay una diferencia importante entre un lector tradicional y uno Webtoon:

En Manga RTL puedes mostrar una página o un par de páginas. En Webtoon puedes tener cientos de paneles consecutivos, con alturas muy diferentes.

El error habitual es implementar una virtualización tradicional basada en índices y alturas estimadas.

Cuando el usuario hace scroll rápido, las alturas estimadas cambian, los elementos se desplazan y aparece el temido salto visual.

## 2.1. Arquitectura recomendada

Usaría una lista virtualizada de altura variable.

Cada panel debería tener estos datos:

```
interface WebtoonPanel {
  id: string;
  index: number;
  src: string;

  width: number;
  height: number;

  estimatedHeight: number;
  measuredHeight?: number;

  status:
    | "idle"
    | "loading"
    | "decoded"
    | "error";
}
```

El sistema debe conocer las dimensiones de las imágenes antes de insertarlas visualmente.

Esto es especialmente importante porque ya tienes un pipeline WebP con límite de 1440 px.

Al generar cada WebP, guarda sus dimensiones en el manifiesto. Así React puede reservar el espacio correcto sin esperar a descargar o decodificar la imagen.

## 2.2. Cómo evitar el parpadeo

Representación conceptual de la ventana virtual

Overscan superior · paneles anteriores

Zona visible

[「Necesito fuertemente que alguna editorial saque este manhwa 」kura 🌷DOKOMI 3K23の漫画](https://images.openai.com/static-rsc-4/JjR9BxbmKfVTQipG2jUjQ_pNi99WN2-vm-dTL-7GEkpDrinZA9fmOZEoYEmO7512_cweXONR0nYhzrdnl6KDP--x_A9WQAbGpCFOobTGnVD27GyGn-mFKbWGVlILN62FdSSUwNpN2XCirgV6mnF81qDjXztNZvk_cUVgetLS6K0?purpose=inline)

[twiman.net](https://twiman.net/user/2968803394/1597952367454224385?utm_source=chatgpt.com)

[Pin di 만화 그림](https://images.openai.com/static-rsc-4/oyjjKNOTIQ6VnbfIGuYavsH_kqrVVnxtO-8_f_2N_XTyR6O7L0Lqjr3cDYY7tWtXF_kvm5J2LbT1gboBkFlzChK6Wnz25qrc5YSMMc423tIwyXYdtVJRyTbgqKgX8GVqyGqbUQCwoTRMYpznZm593yIURtfHixHNOCpAMnsp4dA?purpose=inline)

[pinterest.com](https://www.pinterest.com/pin/tanyu-bihwang-sword-sheaths-child-in-2022--145874475422323002/?utm_source=chatgpt.com)

Overscan inferior · paneles próximos

Aplicaría cinco técnicas:

A. Overscan por píxeles, no por cantidad de elementos.

No configures simplemente 5 elementos arriba y 5 abajo.

Un panel puede medir 300 px y otro 3000 px.

Utiliza una ventana basada en distancia:

- Overscan normal: 1200–1800 px.
- Scroll rápido: 2500–4000 px.
- Scroll detenido: volver al valor normal.

Son puntos de partida que debes ajustar con pruebas reales.

B. Reserva de dimensiones.

Cada panel debe tener su `aspect-ratio` o altura calculada desde el manifiesto.

```
.webtoon-panel {
  width: 100%;
  height: auto;
  display: block;
  contain: layout paint;
}
```

Evita que la imagen aparezca inicialmente con altura cero.

C. Decodificación antes de mostrar.

Puedes usar:

```
async function prepareImage(src) {
  const image = new Image();

  image.src = src;

  await image.decode();

  return image;
}
```

No bloquearía el hilo principal esperando todas las imágenes. Decodifica prioritariamente las visibles y las próximas.

D. Anclaje del scroll.

Este es uno de los puntos más importantes.

Si cambia la altura estimada de un panel que está por encima del usuario, debes compensar el desplazamiento para que el panel que estaba leyendo permanezca en la misma posición visual.

Una estrategia:

1. Identificar el panel ancla.
2. Registrar su posición relativa al viewport.
3. Actualizar las mediciones.
4. Calcular la diferencia de posición.
5. Compensar el scroll.

No confíes exclusivamente en el scroll anchoring automático del navegador si tu virtualizador también modifica alturas y posiciones.

E. No desmontes imágenes visibles.

Mantén un margen de seguridad alrededor del viewport. Evita desmontar y volver a montar continuamente los mismos paneles al oscilar el scroll.

## 2.3. ¿Qué librería utilizaría?

| Tecnología       | Mi valoración                                                     |
| ---------------- | ----------------------------------------------------------------- |
| TanStack Virtual | Excelente para control personalizado                              |
| React Virtuoso   | Muy interesante para listas variables                             |
| react-window     | Sencillo, pero menos conveniente para alturas variables complejas |

Mi elección sería TanStack Virtual si KuraScroll necesita control preciso sobre overscan, mediciones y anclaje.

React Virtuoso sería mi alternativa si queremos reducir el trabajo de implementación.

Documentación:

- [TanStack Virtual](https://tanstack.com/virtual/latest?utm_source=chatgpt.com)
- [React Virtuoso](https://virtuoso.dev/?utm_source=chatgpt.com)

### 2.4. Una advertencia sobre los 80–120 paneles

No asumiría que 120 paneles requieren obligatoriamente virtualización agresiva.

Primero mediría:

- Nodos DOM.
- Imágenes decodificadas simultáneamente.
- Memoria GPU.
- Tiempo de renderizado.
- Frames perdidos durante scroll.

Puede que 120 paneles con imágenes correctamente dimensionadas funcionen perfectamente sin una virtualización compleja.

La virtualización debe resolver un problema medido, no introducir problemas nuevos.

# 3. Stress testing, fuzzing y trampas de Node.js/Fastify

Esta es probablemente la parte que más puede afectar la estabilidad de KuraScroll.

Especialmente porque los CBZ son archivos ZIP y, por tanto, debes asumir que cualquier archivo importado puede estar malformado o ser malicioso.

## 3.1. Fuzzing de CBZ corruptos

Un CBZ no debe considerarse seguro por tener extensión `.cbz`.

Un archivo puede tener:

- Directorio central ZIP corrupto.
- CRC incorrectos.
- Entradas truncadas.
- Dimensiones absurdas.
- Archivos duplicados.
- Miles de imágenes diminutas.
- Rutas manipuladas.
- Datos comprimidos que se expanden enormemente.



Riesgo importante

&#x20;ZIP bombs y descompresión descontrolada.



### Casos que probaría

| Caso                           | Qué debe suceder                  |
| ------------------------------ | --------------------------------- |
| CBZ truncado                   | Error controlado                  |
| CRC incorrecto                 | Rechazar o aislar entrada         |
| 100.000 entradas               | Rechazar por límite               |
| ZIP bomb                       | Cancelar por límites de expansión |
| Imagen de dimensiones absurdas | Rechazar antes de decodificar     |
| Archivo cifrado                | Informar incompatibilidad         |
| Rutas `../`                    | Rechazar traversal                |
| Nombre duplicado               | Resolver mediante ID interno      |
| CBZ sin imágenes               | Error de validación               |
| Imagen WebP/JPEG falsa         | Validar contenido real            |

También probaría:

- ZIP64.
- Directorios centrales inconsistentes.
- Entradas solapadas.
- Archivos anidados.
- Symlinks.
- Nombres Unicode ambiguos.

### Límites de seguridad

Implementaría límites configurables:

```
const CBZ_LIMITS = {
  maxEntries: 5000,
  maxCompressedBytes: 500 * 1024 * 1024,
  maxExpandedBytes: 2 * 1024 * 1024 * 1024,
  maxImagePixels: 40_000_000,
  maxImageBytes: 100 * 1024 * 1024,
  maxCompressionRatio: 100,
};
```

Son valores ilustrativos para empezar a diseñar pruebas, no límites universales. Deben ajustarse a los archivos reales y a la memoria disponible.

Nunca extraigas un CBZ directamente a una ruta construida con el nombre proporcionado por el archivo.

### Herramientas para fuzzing

- fast-check: generación de casos aleatorios y property-based testing para validadores, índices y parsers.
- AFL++: fuzzing de parsers nativos o componentes compatibles.
- Radamsa: mutación de archivos existentes para producir entradas defectuosas.
- Jest: pruebas automatizadas de regresión.

Documentación: [fast-check](https://fast-check.dev/?utm_source=chatgpt.com) · [AFL++](https://aflplus.plus/?utm_source=chatgpt.com).

Una técnica que recomiendo especialmente: construir un corpus de CBZ reales y corruptos, conservar cada caso que produzca un fallo y ejecutarlo automáticamente en cada cambio del parser.

## 3.2. Trampas de rendimiento en Node.js/Fastify

Aquí hay varios errores que pueden pasar desapercibidos hasta que la biblioteca tenga miles de capítulos.

1\. Operaciones síncronas de archivos.

Evita:

```
const data = fs.readFileSync(path);
```

En operaciones del servidor, prefiere:

```
const data = await fs.promises.readFile(path);
```

Pero ojo: tampoco significa que debas leer capítulos enteros en memoria. Para servir imágenes grandes, utiliza streams.

2\. Procesamiento de imágenes en el hilo principal.

Sharp utiliza libvips y trabajo nativo, pero eso no significa que sea gratuito en memoria o concurrencia.

Controla:

```
sharp.concurrency(2);
sharp.cache({
  memory: 50,
  files: 20,
  items: 100
});
```

Estos valores son orientativos. Ajusta mediante mediciones y evita multiplicar la concurrencia sin conocer el consumo de RAM.

Además, configura `limitInputPixels` y valida el tamaño de entrada antes de procesar.

3\. Backpressure en streams.

Nunca asumas que puedes enviar datos tan rápido como los lees.

Utiliza `pipeline()` de Node.js:

```
import { pipeline } from "node:stream/promises";

await pipeline(
  createReadStream(filePath),
  reply.raw
);
```

En producción hay que integrar correctamente la finalización de Fastify, las desconexiones del cliente y el manejo de errores para evitar dobles respuestas.

4\. Serialización JSON excesiva.

Fastify permite utilizar esquemas JSON para validación y serialización.

Aprovéchalos.

Evita enviar objetos completos de capítulos con metadatos innecesarios cuando el lector solamente necesita:

```
{
  "chapterId": "chapter-001",
  "pages": [
    {
      "id": "page-001",
      "width": 1440,
      "height": 2200,
      "url": "/pages/page-001.webp"
    }
  ]
}
```

5\. Concurrencia SQLite.

Ya tienes SQLite WAL + FTS5. Excelente elección para una aplicación local.

Pero recuerda:

- WAL permite lectores concurrentes, pero sigue habiendo un único escritor activo.
- Las transacciones largas pueden impedir checkpoints.
- Las consultas FTS5 deben estar limitadas.
- Evita ejecutar búsquedas costosas en cada pulsación sin debounce.
- Utiliza prepared statements.
- Configura y mide `busy_timeout`.

6\. No medir el Event Loop.

Una API puede responder bien en promedio mientras tiene pausas enormes ocasionales.

Usaría `monitorEventLoopDelay()`:

```
import {
  monitorEventLoopDelay
} from "node:perf_hooks";

const histogram = monitorEventLoopDelay({
  resolution: 20
});

histogram.enable();

setInterval(() => {
  console.log({
    p99EventLoopMs:
      histogram.percentile(99) / 1e6,

    maxEventLoopMs:
      histogram.max / 1e6
  });

  histogram.reset();
}, 5000);
```

En producción, añade métricas de memoria, RSS, heap, GC y utilización del Event Loop.

## 3.3. Pruebas de estrés que implementaría

No basta con comprobar que 20 usuarios pueden abrir capítulos.

KuraScroll necesita pruebas que reproduzcan patrones reales de lectura y fallos.

Utilizaría Autocannon para HTTP y k6 para escenarios de carga.

[Autocannon](https://github.com/mcollina/autocannon?utm_source=chatgpt.com) · [k6](https://grafana.com/docs/k6/latest/?utm_source=chatgpt.com)

Mi matriz de pruebas sería:

| Prueba             | Escenario                         |
| ------------------ | --------------------------------- |
| Lectura secuencial | 500 páginas consecutivas          |
| Lectura aleatoria  | 500 solicitudes aleatorias        |
| Cambio de capítulo | 50 cambios consecutivos           |
| Cache pressure     | 10 capítulos distintos            |
| Importación masiva | 100 CBZ simultáneos en cola       |
| FTS5               | 1000 búsquedas variadas           |
| Cancelaciones      | 100 solicitudes abortadas         |
| HDD saturado       | Lecturas concurrentes limitadas   |
| Recuperación       | Reiniciar API durante importación |

### Métricas que considero obligatorias

## Panel de rendimiento de KuraScroll

API · P95

# ≤ 150 ms

Objetivo inicial en caché caliente

Cache hit ratio

# ≥ 85%

Objetivo tras estabilizar el predictor

Event Loop P99

# ≤ 20 ms

Objetivo bajo carga normal

Errores de lectura

# 0

En corpus válido de regresión

Objetivos de ingeniería propuestos, no resultados medidos ni garantías. El P95 de lectura desde HDD debe medirse por separado y con caché fría.

Añadiría una distinción imprescindible:

- HDD cold-cache: primera lectura física.
- HDD warm-cache: lectura repetida.
- OS page cache: datos almacenados por el sistema operativo.
- Application cache: datos retenidos por KuraScroll.

Si no separas estas cuatro situaciones, puedes terminar optimizando una caché que ya estaba haciendo el trabajo por ti.

## 3.4. Otras trampas específicas de Fastify

Hay cinco detalles adicionales que revisaría:

1. `bodyLimit`: establece límites explícitos para las importaciones y endpoints que aceptan archivos.
2. Rate limiting: evita que una importación o búsqueda masiva monopolice los recursos.
3. HTTP caching: utiliza `ETag` o URLs versionadas y `Cache-Control: immutable` para imágenes WebP que no cambian.
4. Path traversal: resuelve rutas desde un directorio raíz controlado y comprueba que el resultado permanezca dentro de él.
5. Desconexiones: una petición cancelada no debería dejar una decodificación Sharp o una lectura de disco trabajando innecesariamente.

También separaría la importación de archivos del servidor HTTP mediante una cola de trabajos limitada. El servidor debe poder seguir atendiendo al lector mientras procesa una biblioteca.

# 4. Mi arquitectura final recomendada

Si estuviera revisando el diseño técnico de KuraScroll, propondría esta distribución:

## KuraScroll — Arquitectura propuesta

Frontend · React Reader

- Webtoon Virtualizer
- Manga RTL Engine
- Adaptive Prefetch Controller
- Image Decode Manager

Backend · Fastify

- Page Delivery
- Chapter Manifest API
- Import Queue
- Library API

Storage Engine

- HDD
- WebP
- CBZ originals
- Indexed manifests

Data Engine

- SQLite WAL
- FTS5
- Metadata
- Reading progress

Shared Resource Manager

- Byte-based LRU
- Disk I/O scheduler
- Import concurrency limits
- Memory monitoring

## 5. Prioridades de implementación

Mi orden sería este:

| Prioridad | Implementación                      | Importancia  |
| --------- | ----------------------------------- | ------------ |
| P0        | Caché LRU por bytes                 | Crítica      |
| P0        | Manifiestos con dimensiones         | Crítica      |
| P0        | Límites de seguridad CBZ            | Crítica      |
| P1        | Prefetch adaptativo cancelable      | Alta         |
| P1        | Virtualización con anclaje          | Alta         |
| P1        | Control de concurrencia Sharp       | Alta         |
| P2        | Métricas de HDD y Event Loop        | Alta         |
| P2        | Fuzzing automatizado                | Alta         |
| P3        | Contenedores de páginas por offsets | Experimental |

Una última recomendación: no implementaría todavía un formato de almacenamiento personalizado para reemplazar los WebP individuales. Primero construiría un benchmark que compare acceso aleatorio, lectura secuencial, caché caliente y caché fría. Un formato más complejo no garantiza un lector más rápido.

## 6. Tres preguntas técnicas para afinar la arquitectura

Antes de recomendar cambios más profundos, necesito conocer tres características:

1. ¿KuraScroll está pensado exclusivamente para Windows o debe funcionar también en Linux?
2. ¿Los 4 TB son un HDD de 5400 RPM, 7200 RPM o todavía no se ha definido?
3. ¿Las páginas WebP están almacenadas como miles de archivos individuales o ya existe algún sistema de agrupación?

Con esas respuestas podemos determinar si conviene optimizar el sistema de archivos, crear un scheduler de lecturas o concentrarnos en el navegador.

Mi conclusión: el mayor diferenciador de KuraScroll no debería ser simplemente mostrar imágenes rápido, sino conseguir que el usuario pueda saltar entre capítulos, recorrer cientos de paneles y regresar a páginas anteriores sin experimentar esperas perceptibles, incluso trabajando exclusivamente desde un HDD mecánico.
