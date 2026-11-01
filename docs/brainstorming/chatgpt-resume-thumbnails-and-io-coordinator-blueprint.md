¡Vro, esto ya está tomando forma de un lector bastante serio! Y hay algo importante: con los 11 SLA del Pentium T4500 superados, el Sprint 27 y 28 deberían enfocarse menos en conseguir velocidad bruta y más en evitar que las funciones secundarias interfieran con la experiencia de lectura.

Mi recomendación como arquitectura senior es separar dos responsabilidades:

- Sprint 27: el progreso de lectura se consulta rápidamente; las miniaturas son recursos secundarios, independientes y diferidos.
- Sprint 28: todo trabajo que acceda al HDD pasa por un coordinador común. Las lecturas interactivas tienen prioridad y las tareas de fondo deben poder ceder el disco de forma cooperativa.

Hay una limitación que debemos dejar clara desde el principio: Node.js no puede suspender de forma instantánea y segura cualquier operación de disco que ya esté ejecutándose. Podemos conseguir una respuesta casi inmediata en los puntos de cooperación, pero no interrumpir mágicamente una operación síncrona o una llamada del sistema que ya está en curso.

# Sprint 27 — Smart Reading Bookmarks & Resume Pointer

## 1. Arquitectura: separar progreso y miniaturas

No haría que `GET /api/v1/progress/recent` genere, lea o procese imágenes.

El endpoint debe devolver exclusivamente los datos necesarios para construir la lista de lectura reciente.

## Flujo recomendado

React 19 — Recent Reading

GET /api/v1/progress/recent

SQLite: consulta ligera de progreso y metadatos. Sin lectura de imágenes.

Respuesta inmediata

Título, capítulo, página, porcentaje, fecha y URLs de miniaturas.

Carga diferida

Portada y última página leída mediante solicitudes independientes.

Image Cache + Thumbnail Service

Solo entrega miniaturas existentes. Si falta alguna, agenda su generación con prioridad baja.

La regla de oro: consultar el progreso nunca debe esperar a que se genere una miniatura.

## 2. Endpoint GET /api/v1/progress/recent

Propondría una respuesta como esta:

```
{
  "items": [
    {
      "mangaId": "manga_102",
      "title": "Example Manga",
      "chapterId": "chapter_018",
      "chapterTitle": "Chapter 18",
      "pageIndex": 42,
      "totalPages": 186,
      "progress": 22.58,
      "updatedAt": "2026-11-01T15:30:00.000Z",
      "resume": {
        "direction": "LTR",
        "scrollOffset": 0,
        "pageIndex": 42
      },
      "thumbnails": {
        "cover": "/api/v1/thumbnails/manga_102/cover",
        "lastRead": "/api/v1/thumbnails/chapter_018/page_42",
        "coverAvailable": true,
        "lastReadAvailable": true
      }
    }
  ],
  "nextCursor": null
}
```

No enviaría imágenes en Base64, blobs, rutas absolutas del HDD ni buffers serializados.

¿Por qué?

- El JSON se mantiene pequeño.
- Fastify no consume memoria innecesariamente.
- React puede renderizar los datos sin esperar al HDD.
- Las imágenes pueden cargarse, cancelarse y almacenarse en caché independientemente.

### SQL recomendado

La consulta debería usar una tabla de progreso indexada:

```
CREATE INDEX IF NOT EXISTS idx_reading_progress_recent
ON reading_progress(updated_at DESC, manga_id);
```

Ejemplo de consulta:

```
SELECT
    rp.manga_id,
    rp.chapter_id,
    rp.page_index,
    rp.scroll_offset,
    rp.updated_at,
    m.title,
    c.title AS chapter_title,
    c.total_pages
FROM reading_progress rp
JOIN manga m
    ON m.id = rp.manga_id
JOIN chapters c
    ON c.id = rp.chapter_id
ORDER BY rp.updated_at DESC
LIMIT ?;
```

Usaría un límite inicial de 10–15 elementos. Si la biblioteca es enorme, implementaría paginación por cursor, no `OFFSET` creciente.

El índice debe ajustarse al esquema real y comprobarse con `EXPLAIN QUERY PLAN`; si los JOIN o el ordenamiento fuerzan búsquedas adicionales, hay que medirlo antes de darlo por optimizado.

## 3. Miniaturas: no leer el original durante la navegación

Aquí está uno de los puntos más importantes para el HDD de 4 TB.

Supongamos que el usuario abre la pantalla de lectura reciente y aparecen 12 mangas. Si cargas inmediatamente portada y última página de los 12, puedes provocar hasta 24 solicitudes de imagen.

En un HDD de 5400 RPM, eso puede convertirse en una sucesión de lecturas aleatorias.

Mi propuesta:

| Recurso                            | Prioridad  | Comportamiento |
| ---------------------------------- | ---------- | -------------- |
| Progreso JSON                      | HIGH       | Inmediato      |
| Portadas visibles                  | MEDIUM     | Lazy loading   |
| Última página visible              | LOW        | Lazy loading   |
| Miniaturas fuera de pantalla       | LOW        | No cargar      |
| Generación de miniaturas faltantes | BACKGROUND | Diferida       |

Una miniatura faltante nunca debe generarse dentro de la solicitud HTTP que está mostrando la biblioteca.

En su lugar:

1. El endpoint de miniaturas comprueba si existe la versión reducida.
2. Si existe, la entrega.
3. Si no existe, devuelve `202 Accepted` o un placeholder.
4. Registra un trabajo de generación en la cola BACKGROUND.
5. El coordinador de I/O decide cuándo ejecutarlo.

Esto también evita que Sharp empiece a decodificar imágenes grandes mientras el usuario intenta leer.

## 4. React 19: evitar CLS y parpadeos

Para el Pentium T4500 y la GMA 4500MHD, usaría un renderizado sencillo: dimensiones reservadas, imágenes normales y transiciones mínimas.

[Futon | F-Droid - Free and Open Source Android App Repository](https://images.openai.com/static-rsc-4/nbX3Dncn0QArmt2VrNWUmoYlWpn9ZZsdm8hQg4Ab8iKo9-NOetTFKv6eKjHVDR6guA8Z-lUaJ5KC4Pjdd8XK--kBBCqZdBg6dgjiL4StxIihSFyHsG8nksFpIr9-Ihqs6ZWZDMFhMs2ce0oNGc_gj7N80f30vUNTg73jlir0PMA?purpose=inline)

[fdroid.gitlab.io](https://fdroid.gitlab.io/jekyll-fdroid/packages/io.github.landwarderer.futon/?utm_source=chatgpt.com)

### Componente de miniatura

```
type ThumbnailProps = {
  src?: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
};

function Thumbnail({
  src,
  alt,
  width,
  height,
  priority = false
}: ThumbnailProps) {
  const [failed, setFailed] = React.useState(false);

  return (
    <div
      className="thumbnail"
      style={{
        width,
        aspectRatio: `${width} / ${height}`
      }}
    >
      {!src || failed ? (
        <div className="thumbnail-placeholder" />
      ) : (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
```

CSS:

```
.thumbnail {
  position: relative;
  overflow: hidden;
  background: #181818;
  contain: layout paint;
}

.thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  position: absolute;
  inset: 0;
  background: #202020;
}
```

Puntos importantes:

- Reservar dimensiones desde el primer render evita que la tarjeta cambie de tamaño.
- `decoding="async"` evita exigir la decodificación durante el renderizado visual.
- `loading="lazy"` evita descargar imágenes que todavía no son necesarias.
- No animar `width`, `height`, `margin` ni `top`.
- Evitar filtros, blur, sombras enormes y transiciones de gradientes en la GMA.
- No utilizar una librería de animación para algo que se resuelve con CSS estático.

### Carga escalonada de las imágenes

No cargaría portada y última página al mismo tiempo.

Para empezar:

1. Primero aparece la tarjeta con su placeholder.
2. Se carga la portada de las tarjetas visibles.
3. Se carga la última página solo cuando la tarjeta está cerca del viewport.
4. Las tarjetas fuera de pantalla no realizan solicitudes.

También limitaría la concurrencia de descargas a 1–2 imágenes durante la primera prueba física. Si el Sprint 26 demostró que puede tolerar más, se ajusta con mediciones.

### Una decisión adicional: separar las miniaturas

No necesitas una única imagen para representar el manga.

- Portada: referencia visual del manga.
- Última página: contexto exacto del punto de reanudación.

Mantendría dos recursos independientes, pero utilizaría una caché LRU pequeña en memoria para no leerlos repetidamente.

Criterios de aceptación del Sprint 27

- El JSON de progreso se renderiza antes de que terminen las solicitudes de imágenes.
- Ninguna miniatura se genera dentro de un GET interactivo.
- Las tarjetas no cambian de dimensiones durante la carga.
- Las imágenes fuera del viewport no se solicitan anticipadamente.
- Una imagen corrupta no rompe el componente ni el listado.
- El usuario puede reanudar la lectura incluso si todas las miniaturas fallan.

# Sprint 28 — I/O Concurrency Coordinator

Este es el sprint arquitectónicamente más importante.

Yo implementaría un Priority-Aware Cooperative I/O Scheduler.

No lo plantearía como un semáforo convencional que solamente limita el número de operaciones simultáneas. Lo plantearía como un coordinador con:

1. Cola de prioridades.
2. Permisos de ejecución.
3. Pausa cooperativa.
4. Cancelación.
5. Reanudación.
6. Control de concurrencia.
7. Métricas de latencia y tiempo de espera.

## 1. Prioridades

Propongo cuatro niveles:

| Prioridad  | Valor | Ejemplos                                      |
| ---------- | ----- | --------------------------------------------- |
| CRITICAL   | 0     | Entrega de página que el usuario está leyendo |
| HIGH       | 1     | Reanudar lectura, cargar página siguiente     |
| NORMAL     | 2     | Consultas y navegación de biblioteca          |
| BACKGROUND | 3     | Backup, integridad, auto-curación             |

Un detalle: no todas las solicitudes HTTP deben considerarse iguales. Una petición de página del lector tiene prioridad superior a una petición de estadísticas o historial.

Tampoco dejaría que una cola BACKGROUND bloquee una HIGH simplemente porque obtuvo primero un permiso.

## 2. Arquitectura

CRITICAL / HIGH

Lectura de páginas · Reanudación · Recursos visibles

Shared I/O Coordinator

Priority Queue · Permit Manager · Pause Gate · Cancellation

Interactive I/O

Fast path

Background I/O

Cooperative path

Shared SATA II HDD

4 TB · 5400 RPM

La condición fundamental: ningún módulo debe realizar operaciones pesadas sobre el HDD sin pasar por el coordinador.

Esto incluye:

- Integrity Scanner.
- Differential Backup.
- Auto-Healing.
- Sharp Thumbnail Generation.
- Deep Image Verification.
- Library Scanner.
- Snapshot Executor.
- Cualquier tarea de mantenimiento.

## 3. No confundir AbortSignal con pausa

Esto merece especial atención.

`AbortSignal` cancela una operación. No significa pausar y continuar desde el mismo punto.

Por eso usaría dos mecanismos diferentes:

| Mecanismo     | Propósito                                                     |
| ------------- | ------------------------------------------------------------- |
| `AbortSignal` | Cancelar un trabajo o una operación que ya no debe continuar  |
| `PauseGate`   | Detener cooperativamente el trabajo y permitir su reanudación |

Por ejemplo, si el escáner está procesando el archivo número 1200 y entra una lectura interactiva:

- Se solicita pausa.
- El escáner termina el bloque actual.
- Guarda su checkpoint.
- Libera el permiso de I/O.
- La lectura obtiene prioridad.
- Cuando no hay trabajo interactivo pendiente, el escáner continúa desde el checkpoint.

No cancelaría todo el escaneo y lo reiniciaría desde cero.

## 4. Implementación de PauseGate

Este es el núcleo de la pausa cooperativa:

```
class PauseGate {
  private paused = false;
  private waiters: Array<() => void> = [];

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;

    const waiters = this.waiters;
    this.waiters = [];

    for (const resolve of waiters) {
      resolve();
    }
  }

  async checkpoint(signal?: AbortSignal) {
    signal?.throwIfAborted();

    while (this.paused) {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          signal?.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
          cleanup();
          reject(signal?.reason);
        };

        this.waiters.push(() => {
          cleanup();
          resolve();
        });

        signal?.addEventListener("abort", onAbort, {
          once: true
        });

        if (signal?.aborted) {
          onAbort();
        }
      });

      signal?.throwIfAborted();
    }
  }
}
```

Esta versión sirve como punto de partida, pero para producción añadiría eliminación de waiters al cancelar y protección contra listeners duplicados. También haría que el coordinador garantice que cada pausa tenga una reanudación correspondiente.

## 5. Priority Queue y permisos

No usaría un `Semaphore` genérico sin prioridad.

Necesitamos que los permisos se asignen según la prioridad y que los trabajos de fondo no se queden ocupando todos los slots.

Para el Pentium T4500 empezaría con:

```
const IO_CONFIG = {
  maxConcurrentInteractive: 2,
  maxConcurrentBackground: 1,

  backgroundChunkSize: 64 * 1024,

  backgroundInitialRate: 2 * 1024 * 1024,

  interactivePreemption: true,

  backgroundYieldOnInteractive: true
};
```

Valores iniciales de experimentación, no límites universales ni resultados garantizados. Ajustar con los SLA físicos del Sprint 26.

Una política que me gusta:

- Máximo una operación BACKGROUND activa.
- Si llega una solicitud HIGH, el trabajo BACKGROUND recibe una señal de pausa.
- El trabajo de fondo cede en su siguiente checkpoint.
- La HIGH obtiene el siguiente permiso.
- Cuando la cola interactiva queda vacía, se reanuda el trabajo de fondo.

### Interfaz del coordinador

```
type IOPriority =
  | "CRITICAL"
  | "HIGH"
  | "NORMAL"
  | "BACKGROUND";

interface IOJobOptions {
  priority: IOPriority;
  signal?: AbortSignal;
  label: string;
}

interface IOContext {
  signal: AbortSignal;
  checkpoint(): Promise<void>;
  yieldIfInteractive(): Promise<void>;
}

interface IIOCoordinator {
  run<T>(
    options: IOJobOptions,
    task: (context: IOContext) => Promise<T>
  ): Promise<T>;

  pauseBackground(): void;
  resumeBackground(): void;

  getMetrics(): IOMetrics;
}
```

La función `run()` debería:

1. Crear un trabajo.
2. Insertarlo en la cola correspondiente.
3. Solicitar pausa a trabajos BACKGROUND si llega CRITICAL/HIGH.
4. Esperar un permiso.
5. Ejecutar el trabajo.
6. Liberar el permiso en un `finally`.
7. Revisar qué trabajo puede ejecutarse después.

Para la cola usaría un heap o una priority queue con desempate FIFO, no un simple array ordenado en cada inserción.

También implementaría aging: un trabajo NORMAL no debe quedarse esperando eternamente si existe actividad HIGH constante. Sin embargo, la lectura CRITICAL nunca debe perder prioridad por aging.

## 6. Streaming cooperativo: la parte crítica

Este es el punto donde más cuidado tendría.

No basta con hacer:

```
source.pause();
```

Eso detiene la emisión de datos del stream, pero no garantiza que el HDD quede inmediatamente libre. Puede haber datos pendientes en buffers, operaciones ya iniciadas y otros procesos leyendo el mismo disco.

Para un backup diferencial, utilizaría bloques pequeños y checkpoints persistentes:

```
import {
  createReadStream,
  createWriteStream
} from "node:fs";
import { pipeline } from "node:stream/promises";

async function copyWithCooperation(
  source: string,
  destination: string,
  context: IOContext
) {
  const input = createReadStream(source, {
    highWaterMark: 64 * 1024
  });

  const output = createWriteStream(destination, {
    highWaterMark: 64 * 1024
  });

  try {
    await pipeline(
      input,
      async function* (chunks) {
        for await (const chunk of chunks) {
          await context.checkpoint();

          yield chunk;
        }
      },
      output,
      { signal: context.signal }
    );
  } catch (error) {
    input.destroy();
    output.destroy();
    throw error;
  }
}
```

Este ejemplo demuestra la cooperación entre streaming y pausa, pero tiene una limitación importante: mantiene abierto el archivo mientras está pausado. No es la estrategia que elegiría para las tareas más largas sobre tu HDD.

Para backup y escaneo de integridad usaría un enfoque de bloques con checkpoint real:

```
1. Abrir archivo.
2. Leer un bloque de 64 KB.
3. Procesar/escribir el bloque.
4. Comprobar si hay una solicitud interactiva.
5. Si la hay:
   - Guardar offset.
   - Cerrar handles.
   - Liberar permiso de I/O.
   - Esperar.
6. Reabrir desde el offset guardado.
7. Continuar.
```

Esto permite liberar recursos del sistema y dar prioridad a las lecturas del usuario.

Ojo: para garantizar que el archivo no cambió entre bloques, guarda su fingerprint inicial (`size`, `mtimeMs` y, cuando corresponda, identidad del archivo) y vuelve a comprobarlo antes de continuar. Si cambió, invalida o reinicia ese trabajo de forma controlada.

Para el scanner de integridad, el checkpoint puede guardar el último archivo procesado. Para un backup, debe guardar el archivo, el offset y el estado de publicación del destino.

## 7. El coordinador debe ser realmente compartido

No crearía un coordinador independiente para el backup, otro para Sharp y otro para el escáner.

Eso produciría tres colas que creen tener prioridad, pero que siguen compitiendo por el mismo HDD.

Estructura recomendada:

```
src/storage/io/
├── domain/
│   ├── IOPriority.ts
│   ├── IOJob.ts
│   └── IOJobState.ts
│
├── scheduler/
│   ├── PriorityQueue.ts
│   ├── PermitManager.ts
│   ├── IOCoordinator.ts
│   └── FairnessPolicy.ts
│
├── control/
│   ├── PauseGate.ts
│   ├── CancellationManager.ts
│   └── CooperativeCheckpoint.ts
│
├── monitoring/
│   ├── IOMetrics.ts
│   ├── LatencyMonitor.ts
│   └── AdaptiveThrottle.ts
│
└── integration/
    ├── FastifyIOAdapter.ts
    ├── SharpIOAdapter.ts
    ├── BackupIOAdapter.ts
    ├── IntegrityIOAdapter.ts
    └── AutoHealingIOAdapter.ts
```

Todos los adaptadores utilizan la misma instancia singleton de `IOCoordinator`.

Si alguna operación se ejecuta en un Worker Thread o proceso separado, recuerda que un singleton de Node.js no coordina automáticamente esos procesos. En ese escenario necesitarás un coordinador externo al proceso, o un mecanismo explícito de comunicación y asignación de permisos.

# 8. La integración con SQLite

El coordinador debe trabajar junto con el diseño de SQLite de los sprints anteriores, no sustituirlo.

Mantendría:

- Una cola lógica de escritura.
- Conexiones de lectura reutilizadas.
- WAL.
- Transacciones cortas.
- Checkpoints controlados.
- `VACUUM INTO` bajo prioridad BACKGROUND.
- Sin mantenimiento pesado concurrente.

Y añadiría una distinción:

No toda consulta de SQLite necesita el mismo permiso de I/O.

Una consulta que lee el progreso de lectura debe poder ejecutarse con prioridad alta. Una consulta de mantenimiento o reconciliación debe pasar por el camino de fondo.

Tampoco mantendría una transacción SQLite abierta mientras se espera un `PauseGate`: podría prolongar bloqueos, retener snapshots y retrasar checkpoints WAL.

El orden correcto es:

1. Completar una unidad de trabajo.
2. Confirmar la transacción.
3. Guardar checkpoint del trabajo.
4. Ceder el permiso.
5. Esperar a que haya disponibilidad.
6. Iniciar una nueva transacción cuando corresponda.

# 9. Métricas y pruebas del Sprint 28

No daría por terminado este sprint simplemente porque el código de pausa funciona.

Necesitas demostrar que las operaciones de fondo ceden realmente ante una solicitud de lectura.

Mediría:

| Métrica                       | Qué demuestra                             |
| ----------------------------- | ----------------------------------------- |
| `interactive_wait_ms`         | Cuánto espera el usuario para obtener I/O |
| `background_pause_latency_ms` | Cuánto tarda el trabajo de fondo en ceder |
| `background_resume_count`     | Cuántas veces se pausa y reanuda          |
| `background_bytes_per_sec`    | Velocidad real del mantenimiento          |
| `io_queue_depth`              | Acumulación de solicitudes                |
| `disk_read_latency_ms`        | Tiempo de lectura                         |
| `sqlite_busy_count`           | Contención SQLite                         |
| `checkpoint_duration_ms`      | Coste de los checkpoints WAL              |
| `aborted_jobs`                | Trabajos cancelados                       |
| `checkpoint_recovery_count`   | Recuperaciones después de interrupciones  |

### Matriz de pruebas

| Escenario                         | Resultado esperado                               |
| --------------------------------- | ------------------------------------------------ |
| Backup activo + abrir manga       | Backup cede y la lectura tiene prioridad         |
| Scanner activo + siguiente página | Scanner pausa en el próximo checkpoint           |
| Auto-healing + navegación         | Auto-healing cede                                |
| Backup + scanner                  | Solo uno ejecuta I/O pesado                      |
| Lecturas continuas                | BACKGROUND permanece pausado                     |
| Cancelación de backup             | No deja archivos publicados incompletos          |
| Reanudación después de pausa      | Continúa desde el checkpoint correcto            |
| Reinicio inesperado               | Recuperación sin corromper manifiestos           |
| WAL checkpoint + lectura          | No produce bloqueos prolongados                  |
| 60 minutos de soak test           | Sin crecimiento descontrolado de memoria o colas |

Un objetivo inicial razonable para validar sería que un trabajo BACKGROUND ceda en menos de 100–200 ms cuando llega una solicitud HIGH, siempre que esté ejecutando una unidad de trabajo cooperativa. No lo presentaría como garantía hasta medirlo en el T4500 físico.

# 10. Cómo conectaría ambos sprints

Esta sería mi secuencia de implementación:

1. Sprint 27.1 — Progress API

   Endpoint JSON, consultas indexadas, paginación y persistencia del resume pointer.
2. Sprint 27.2 — Thumbnail Service

   Caché, generación diferida, placeholder y miniaturas independientes.
3. Sprint 27.3 — React Recent Reading

   Lazy loading, dimensiones reservadas, carga escalonada y pruebas de CLS.
4. Sprint 28.1 — Scheduler Core

   Priority Queue, permisos, FIFO, cancelación y métricas.
5. Sprint 28.2 — Cooperative Execution

   PauseGate, checkpoints persistentes, pausa y reanudación.
6. Sprint 28.3 — Service Integration

   Backup, Integrity Scanner, Auto-Healing, Sharp y SQLite.
7. Sprint 28.4 — Long-Session Soak Test

   Lectura continua y tareas de fondo concurrentes durante 60–120 minutos en el Pentium T4500.

## Mi recomendación final

Hay tres decisiones que no negociaría:

1. Las miniaturas jamás deben bloquear el progreso de lectura. El usuario puede reanudar incluso si el HDD está ocupado o las miniaturas todavía no existen.
2. Una única autoridad de I/O. No permitas que cada módulo tenga su propio semáforo independiente.
3. Pausa cooperativa con checkpoint, no cancelación indiscriminada. El backup, el scanner y la auto-curación deben poder detenerse y continuar sin perder consistencia.

Y añadiría una cuarta: no intentaría prometer que el SATA II nunca se saturará. El objetivo realista es controlar la concurrencia, limitar la presión de fondo y garantizar que las operaciones interactivas reciban el siguiente acceso disponible al disco.

La prueba que más me interesa para cerrar el Sprint 28: mantener una lectura Webtoon continua durante 60 minutos, mientras se ejecutan backup diferencial, verificación de integridad y generación de miniaturas. Las tres tareas deben ceder ante la lectura, reanudarse correctamente y no provocar un crecimiento sostenido de latencia, RAM o WAL.

Con esa prueba superada en el hardware físico, tendrían una base bastante sólida para llamar a KuraScroll un lector background-aware, diseñado realmente alrededor de las limitaciones de su hardware.
