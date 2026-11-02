# Sprint 44 — Direct Local P2P Sharing & Offline Mesh Sync

Vro, aquí hay una decisión que define toda la arquitectura: Fastify debe ayudar a los dispositivos a encontrarse, pero no transportar los capítulos. Una vez establecido WebRTC, las imágenes y los archivos viajan directamente entre los peers.

Así el Pentium T4500 no se convierte en un servidor de retransmisión, no duplica el tráfico y no necesita cargar archivos completos en RAM.

Arquitectura recomendada

Fastify — señalización LAN

WebSocket local · pairing · intercambio SDP / ICE

Peer A

KuraScroll / navegador

Peer B

KuraScroll / móvil

WebRTC DataChannel directo · Sin servidor de archivos intermedio

Funciones separadas:

- DataChannel: capítulos, imágenes y eventos de sincronización.
- IndexedDB / OPFS: almacenamiento local y reanudación.
- Fastify: señalización y, opcionalmente, archivado en el HDD.
- `SyncCoordinator` existente: reconciliación del progreso y mutations.

Mis decisiones principales serían:

1. LAN sin Internet: `iceServers: []`, usando candidatos locales, sin STUN/TURN externo.
2. Transferencia binaria: chunks de 16 KiB inicialmente, hasta 64 KiB después de medir.
3. Backpressure: límite de `bufferedAmount` y confirmaciones de bloques persistidos.
4. Progreso offline: secuencias por dispositivo y resolución causal; no confiar únicamente en timestamps ISO.
5. T4500: una transferencia activa cuando él participe como peer; el resto del tiempo actúa como señalizador.

## 1. Conectar dos dispositivos sin Internet

### 1.1. Qué necesita realmente WebRTC

WebRTC no necesita que ambos peers tengan Internet. Necesita que exista una ruta de red entre ellos y que intercambien los datos de negociación.

En una misma LAN, los candidatos ICE de tipo `host` normalmente permiten una conexión directa, sin STUN ni TURN.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://webrtc.org\&sz=32)

WebRTC+1



La configuración inicial:

```
const peer = new RTCPeerConnection({
  iceServers: [],
  iceCandidatePoolSize: 0,
  bundlePolicy: "max-bundle"
});
```

Esto indica que KuraScroll no debe recurrir a servidores STUN o TURN. No garantiza conectividad: el aislamiento entre clientes del Wi-Fi, los firewalls y las VLAN diferentes pueden impedir que los dispositivos se comuniquen.

El objetivo de este sprint es soportar:

Misma Wi-Fi / misma subred

Hotspot local sin conexión a Internet

Direcciones IP estáticas en una red local

Wi-Fi con aislamiento AP/clientes: puede impedir la conexión directa

Dispositivos sin ninguna ruta de red entre ellos: WebRTC no puede resolverlo

Sobre la ausencia de DHCP: no es un problema de WebRTC por sí solo. Pero los dispositivos necesitan direcciones IP compatibles y una ruta entre ambos. Una alternativa práctica es utilizar el hotspot de un móvil, que normalmente proporciona DHCP local. Otra es asignar direcciones estáticas dentro de la misma subred.

### 1.2. Una advertencia importante sobre navegadores en 2026

No diseñaría esta función suponiendo que cualquier PWA servida por HTTP desde una IP local podrá conectarse libremente a todos los dispositivos.

Los navegadores modernos están incorporando controles de Local Network Access. La documentación actual de Chrome incluye conexiones WebRTC y WebSocket dentro de los accesos a red local y exige contextos seguros para las solicitudes sujetas a estos controles.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.chrome.com\&sz=32)

Chrome for Developers+1



Por tanto:

- Sirve la aplicación con HTTPS.
- Utiliza WSS para la señalización cuando la página se sirve por HTTPS.
- Prepara un certificado local confiable o una CA local instalada en los dispositivos.
- Gestiona el permiso de acceso a la red local cuando el navegador lo solicite.
- Prueba Chrome Android, Chrome escritorio y Safari móvil por separado.

`localhost` puede beneficiarse de excepciones de contexto seguro en la misma máquina, pero visitar `http://192.168.x.x` desde otro dispositivo no equivale a visitar `localhost`.

## 2. Dos mecanismos de señalización: WebSocket y QR/SDP

Implementaría ambos, pero empezaría por WebSocket.

### 2.1. Modo principal: Fastify + WebSocket LAN

Endpoint:

```
wss://kura.local/ws/signaling
```

El servidor solo tiene que reenviar mensajes de negociación. No tiene que almacenar imágenes ni chunks.

Flujo:

1\. Peer A solicita emparejamiento

2\. Fastify genera una sala temporal y código de emparejamiento

3\. Peer B introduce o escanea el código

4\. Offer / Answer / ICE Candidates

5\. ICE conectado → DataChannel abierto

6\. Fastify deja de intervenir en la transferencia

Mensajes pequeños para el WebSocket:

```
type SignalingMessage =
  | {
      type: "join";
      roomId: string;
      pairingToken: string;
      deviceId: string;
    }
  | {
      type: "offer" | "answer";
      roomId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "ice";
      roomId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: "leave";
      roomId: string;
    };
```

El servidor debe validar cada mensaje y reenviarlo únicamente al peer autorizado de la sala.

Código conceptual con `@fastify/websocket`:

```
fastify.get(
  "/ws/signaling",
  { websocket: true },
  (socket, request) => {
    const session = signalingService.createSession(request);

    socket.on("message", (raw) => {
      try {
        if (raw.byteLength > 64 * 1024) {
          socket.close(1009, "Message too large");
          return;
        }

        const message = parseAndValidateSignal(raw);

        signalingService.handle(session, message);
      } catch {
        socket.close(1008, "Invalid signaling message");
      }
    });

    socket.on("close", () => {
      signalingService.removeSession(session.id);
    });
  }
);
```

`signalingService` debe verificar la sala, token temporal, emisor y destinatario. No aceptes un `roomId` como autorización suficiente.

Para mantener bajo el consumo del T4500:

- No guardar mensajes de señalización indefinidamente.
- TTL de sala de unos pocos minutos.
- Máximo de dos peers por sala de transferencia.
- Límite del tamaño de SDP.
- Cerrar sesiones desconectadas.
- No registrar SDP completo ni credenciales ICE en logs.

### 2.2. Modo alternativo: intercambio manual de SDP mediante QR

Este modo sirve cuando no quieres depender del servicio WebSocket, aunque sigue siendo necesario que ambos dispositivos tengan conectividad IP local.

Flujo:

1. Peer A crea el DataChannel y genera un Offer.
2. Espera a que ICE termine de recopilar candidatos.
3. Muestra el SDP como QR o texto exportable.
4. Peer B escanea el Offer y crea un Answer.
5. Peer B muestra su SDP mediante un segundo QR.
6. Peer A lo escanea y aplica la respuesta.
7. Ambos esperan que la conexión ICE se establezca y que el DataChannel abra.

Código guía para esperar la recopilación ICE:

```
function waitForIceGathering(
  pc: RTCPeerConnection
): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener(
          "icegatheringstatechange",
          onChange
        );
        resolve();
      }
    };

    pc.addEventListener(
      "icegatheringstatechange",
      onChange
    );
  });
}
```

Offer:

```
async function createManualOffer(
  pc: RTCPeerConnection
): Promise<string> {
  const offer = await pc.createOffer();

  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);

  if (!pc.localDescription) {
    throw new Error("SDP offer unavailable");
  }

  return JSON.stringify(pc.localDescription);
}
```

Aplicación de una oferta y generación de respuesta:

```
async function createManualAnswer(
  pc: RTCPeerConnection,
  offerJson: string
): Promise<string> {
  const offer = JSON.parse(offerJson) as RTCSessionDescriptionInit;

  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);

  if (!pc.localDescription) {
    throw new Error("SDP answer unavailable");
  }

  return JSON.stringify(pc.localDescription);
}
```

El iniciador termina con:

```
await pc.setRemoteDescription(
  JSON.parse(answerJson) as RTCSessionDescriptionInit
);
```

Limitaciones que debes contemplar:

- El SDP puede resultar demasiado grande para un único QR. Ofrece copiar/pegar o QR por fragmentos con numeración y checksum.

- La oferta y respuesta contienen credenciales de negociación temporales. Expiran y deben tratarse como secretos de emparejamiento.

- Si los navegadores generan candidatos ICE con nombres mDNS `.local`, ambos dispositivos deben poder resolverlos. Algunas redes filtran multicast o mDNS, y la conexión puede fallar aunque estén conectados al mismo Wi-Fi.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://rtcweb-wg.github.io\&sz=32)

  RTCWeb Working Group+1

- Si se intercambian los SDP antes de terminar ICE gathering, necesitarás también un mecanismo para enviar los candidatos ICE restantes. Para la primera implementación, es más sencillo esperar a que termine la recopilación en ambos lados.

No intentaría implementar un sistema sofisticado de fragmentación de QR en el primer incremento. Primero termina WebSocket; QR puede ser el mecanismo de contingencia.

## 3. RTCDataChannel: transporte binario con memoria acotada

La transferencia de páginas debe ser binaria, no Base64. Base64 incrementa el tamaño aproximadamente un tercio y obliga a crear representaciones de texto adicionales.

### 3.1. Canal recomendado

```
const dc = peer.createDataChannel("kura-transfer", {
  ordered: true
});

dc.binaryType = "arraybuffer";
dc.bufferedAmountLowThreshold = 64 * 1024;
```

Para archivos, conservaría las opciones fiables y ordenadas por defecto. No usaría `maxRetransmits` ni `maxPacketLifeTime`, porque perder un chunk de CBZ o de una imagen puede invalidar el archivo.

La propiedad `bufferedAmount` permite conocer los bytes pendientes en la cola local y `bufferedAmountLowThreshold` dispara `bufferedamountlow` cuando esta cola desciende al umbral configurado. Esto es precisamente lo que necesitamos para regular la producción.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+2



### 3.2. ¿16 KB o 64 KB?

Mi elección inicial:

| Configuración                       | Valor   |
| ----------------------------------- | ------- |
| Chunk inicial                       | 16 KiB  |
| Chunk experimental                  | 64 KiB  |
| Umbral bajo                         | 64 KiB  |
| Límite de cola normal               | 256 KiB |
| Chunks sin confirmar                | 8       |
| Transferencias simultáneas por peer | 1       |

¿Por qué empezar en 16 KiB?

- Menor coste de cada asignación temporal.
- Menos memoria pendiente.
- Mejor capacidad de alternar datos y mensajes de control.
- Menor impacto cuando la transferencia se cancela.
- Mayor compatibilidad que depender de mensajes grandes.

MDN advierte que deben tenerse en cuenta los límites de tamaño de SCTP y que los mensajes grandes pueden causar bloqueo de cabecera si no existe intercalación de mensajes. La propiedad `pc.sctp.maxMessageSize` proporciona el máximo negociado que puede enviarse.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



Por ello, el tamaño efectivo debe ser:

```
function resolveChunkSize(
  pc: RTCPeerConnection
): number {
  const MAX_CHUNK = 16 * 1024;
  const HEADER_SIZE = 8;

  const negotiated = pc.sctp?.maxMessageSize ?? 0;

  // 0 significa que no se anuncia un límite efectivo.
  const available = negotiated > 0
    ? negotiated - HEADER_SIZE
    : MAX_CHUNK;

  return Math.max(
    1024,
    Math.min(MAX_CHUNK, available)
  );
}
```

Si en las pruebas reales el T4500 y los dispositivos móviles mantienen un buffer estable, puedes habilitar 64 KiB como perfil rápido.

### 3.3. Protocolo binario

No mandaría un mensaje JSON por cada página o chunk. Utilizaría JSON pequeño para el control y frames binarios para los datos.

Protocolo de referencia:

```
CONTROL:
  HELLO
  TRANSFER_MANIFEST
  ACCEPT
  RESUME_FROM
  CHUNK_ACK
  TRANSFER_COMPLETE
  CANCEL

BINARY FRAME:
  fileIndex       uint32
  chunkIndex      uint32
  payload         bytes
```

El `transferId` se establece durante el intercambio del manifiesto y se mantiene como contexto de la sesión.

Así puedes enviar un capítulo como CBZ o como un conjunto de recursos WebP enumerados por un manifiesto.

### 3.4. Backpressure real

La regla es no seguir leyendo archivos del disco ni crear chunks nuevos cuando la cola ya está llena.

```
const HIGH_WATER = 256 * 1024;
const LOW_WATER = 64 * 1024;

function waitForBufferedLow(
  dc: RTCDataChannel,
  signal: AbortSignal
): Promise<void> {
  if (dc.readyState !== "open") {
    return Promise.reject(
      new Error("DataChannel is not open")
    );
  }

  if (dc.bufferedAmount <= LOW_WATER) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      dc.removeEventListener(
        "bufferedamountlow",
        onLow
      );
      dc.removeEventListener("close", onClose);
      signal.removeEventListener("abort", onAbort);
    };

    const onLow = () => {
      cleanup();
      resolve();
    };

    const onClose = () => {
      cleanup();
      reject(new Error("DataChannel closed"));
    };

    const onAbort = () => {
      cleanup();
      reject(new Error("Transfer cancelled"));
    };

    dc.addEventListener(
      "bufferedamountlow",
      onLow
    );
    dc.addEventListener("close", onClose);
    signal.addEventListener("abort", onAbort);

    // Evita perder el evento entre la primera comprobación
    // y la instalación del listener.
    if (dc.bufferedAmount <= LOW_WATER) {
      onLow();
    }
  });
}
```

Emisor de ejemplo:

```
async function sendBlob(
  dc: RTCDataChannel,
  peer: RTCPeerConnection,
  fileIndex: number,
  blob: Blob,
  signal: AbortSignal
): Promise<void> {
  const chunkSize = resolveChunkSize(peer);
  const headerSize = 8;

  for (
    let offset = 0, chunkIndex = 0;
    offset < blob.size;
    offset += chunkSize, chunkIndex++
  ) {
    if (signal.aborted) {
      throw new Error("Transfer cancelled");
    }

    const end = Math.min(
      offset + chunkSize,
      blob.size
    );

    const payload = await blob
      .slice(offset, end)
      .arrayBuffer();

    const frame = new Uint8Array(
      headerSize + payload.byteLength
    );

    const view = new DataView(frame.buffer);

    view.setUint32(0, fileIndex, false);
    view.setUint32(4, chunkIndex, false);

    frame.set(new Uint8Array(payload), headerSize);

    if (
      dc.bufferedAmount + frame.byteLength >
      HIGH_WATER
    ) {
      await waitForBufferedLow(dc, signal);
    }

    if (dc.readyState !== "open") {
      throw new Error("DataChannel unavailable");
    }

    dc.send(frame);
  }
}
```

Este emisor limita la cola local, pero no basta por sí solo para garantizar que el receptor haya escrito cada chunk a almacenamiento. Para eso añadiremos confirmaciones de aplicación.

Regla de recepción: procesa secuencialmente, confirma cada ocho chunks después de persistirlos y limita los chunks recibidos que permanecen pendientes de escritura. De esta forma evitamos que un móvil con poca memoria acumule cientos de mensajes.

## 4. Almacenamiento de capítulos recibidos

Aquí separaría tres destinos. No todos tienen la misma finalidad.

| Destino       | Uso recomendado                                         | Consideración                                        |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| OPFS          | Archivos CBZ grandes, escritura secuencial              | Preferido cuando está disponible                     |
| IndexedDB     | Manifiestos, eventos y chunks recuperables              | Adecuado para reanudación                            |
| Cache Storage | Recursos HTTP terminados que el lector consulta por URL | No usar como almacén principal de archivos recibidos |

OPFS permite escribir archivos de forma directa dentro del almacenamiento privado del origen y está disponible en contextos seguros. IndexedDB y Cache Storage, por su parte, tienen cuotas administradas por el navegador y sus datos pueden ser eliminados bajo presión de almacenamiento.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



### 4.1. Primera opción: OPFS

Para un CBZ de 200 MB no acumules un array de todos los chunks y luego lo conviertas en un `Blob`.

Escribe cada chunk a un archivo `.part`:

```
async function createIncomingFile(
  transferId: string
): Promise<{
  writer: FileSystemWritableFileStream;
}> {
  const root = await navigator.storage.getDirectory();

  const incoming = await root.getDirectoryHandle(
    "incoming",
    { create: true }
  );

  const handle = await incoming.getFileHandle(
    `${transferId}.part`,
    { create: true }
  );

  const writer = await handle.createWritable();

  return { writer };
}
```

En cada evento binario, extrae el payload y escribe secuencialmente:

```
await writer.write(payload);
```

Al acabar:

```
await writer.close();
```

Después valida el archivo y cambia su estado en el manifiesto local. No lo marques como capítulo disponible antes de completar la verificación.

### 4.2. Fallback: IndexedDB

En navegadores donde no puedas usar OPFS, guarda los chunks con una clave compuesta:

```
received_chunks
  ├── transferId
  ├── fileIndex
  ├── chunkIndex
  ├── byteLength
  ├── checksum
  └── payload
```

Haz una transacción pequeña por cada grupo de ocho chunks confirmados. La confirmación se envía al emisor después del commit de IndexedDB, no antes.

Así, si el móvil se queda sin batería, solo tiene que solicitar los bloques que todavía no confirmó.

### 4.3. No abuses de Cache Storage

Cache Storage es apropiado para recursos que KuraScroll consume como respuestas HTTP, por ejemplo miniaturas descargadas o imágenes generadas con una URL estable.

No convertiría un CBZ grande en una respuesta HTTP reconstruida con todos los chunks en memoria. Eso elimina buena parte de las ventajas del streaming.

Comprueba el espacio estimado y trata los errores de cuota:

```
async function checkStorageCapacity(
  requiredBytes: number
): Promise<boolean> {
  const estimate = await navigator.storage.estimate();

  if (
    estimate.quota === undefined ||
    estimate.usage === undefined
  ) {
    return false;
  }

  const available = estimate.quota - estimate.usage;

  return available >= requiredBytes * 1.15;
}
```

El resultado es orientativo, no una garantía de escritura. Solicita persistencia cuando tenga sentido y captura siempre `QuotaExceededError`. La propia API de almacenamiento recomienda consultar las estimaciones, pero advierte que son aproximadas.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



### 4.4. Cuando el destino final es el HDD de 4 TB

Por defecto, el envío P2P debe quedarse entre los dos peers. El T4500 no tiene que recibir una copia de todos los bytes.

Pero cuando el usuario elija Archivar en el servidor local, puedes convertir el navegador receptor en un puente hacia Fastify:

```
Móvil emisor
    │
    │ RTCDataChannel directo
    ▼
Navegador receptor en el host
    │
    │ HTTP streaming local
    ▼
Fastify
    │
    ▼
incoming/<transferId>.part
    │
    ▼
Validación / CRC / tamaño
    │
    ▼
storage/originals/<archive>.cbz
```

Endpoint sugerido:

```
POST /api/v1/p2p/imports
PUT  /api/v1/p2p/imports/:id/content
POST /api/v1/p2p/imports/:id/finalize
GET  /api/v1/p2p/imports/:id
```

El backend debe usar un `Writable` de archivos con `highWaterMark` limitado, por ejemplo 64 KiB, y `pipeline()` para que el backpressure llegue al flujo HTTP. No recibas el cuerpo completo mediante `request.body` como un `Buffer` gigante.

La importación debe tener estados persistentes:

```
RECEIVING → RECEIVED → VALIDATING → VERIFIED → COMMITTED
                            │
                            └── REJECTED
```

El archivo físico y SQLite no pueden confirmarse en una misma transacción atómica. Por eso utiliza un estado intermedio recuperable, registra el manifiesto y finaliza el cambio de nombre solo después de verificar el contenido.

Nunca importes automáticamente un CBZ recibido sin validarlo. Comprueba tamaño, nombres, cantidad de entradas, CRC y restricciones contra ZIP Slip y ZIP bombs. Pide al usuario confirmar la incorporación a su biblioteca.

## 5. Offline Mesh Sync: vector clocks frente a Last-Write-Wins

Esta es la parte más delicada del sprint.

Un timestamp ISO 8601 es útil para mostrar fechas:

```
2026-11-02T10:45:00-05:00
```

Pero no demuestra cuál dispositivo escribió después. Un teléfono puede tener el reloj adelantado cinco minutos y otro retrasado tres.

Un Last-Write-Wins basado exclusivamente en hora local podría reemplazar un progreso correcto con uno más antiguo.

### 5.1. Comparación

| Enfoque               | Ventajas                                       | Desventajas                                              |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| LWW con timestamp ISO | Muy sencillo                                   | Relojes desincronizados, pérdida de cambios concurrentes |
| Vector clocks         | Detecta causalidad y concurrencia              | Más metadatos y lógica de resolución                     |
| Lamport counter       | Orden lógico determinista                      | No distingue por sí solo causalidad completa             |
| Híbrido               | Distingue eventos, ordena y resuelve por campo | Requiere un contrato de sincronización claro             |

Mi recomendación: vector clocks para detectar concurrencia, secuencias por dispositivo para deduplicación y Lamport para desempatar posiciones concurrentes.

No utilizaría el timestamp ISO como autoridad para resolver conflictos.

### 5.2. Identidad y secuencia de cada dispositivo

Cada instalación genera una identidad estable:

```
interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  schemaVersion: number;
}
```

Cada evento lleva:

```
interface ProgressEvent {
  eventId: string;
  deviceId: string;
  deviceSeq: number;
  lamport: number;

  chapterId: number;
  variantId?: number;

  lastPageIndex: number;
  furthestPageIndex: number;

  completed: boolean;
  occurredAt: string;
}
```

- `deviceSeq`: contador creciente y persistente por dispositivo.
- `lamport`: reloj lógico.
- `occurredAt`: fecha informativa.
- `eventId`: identificador idempotente.

Los eventos se almacenan en el `Offline Mutation Outbox` que ya existe en KuraScroll. No añadas otro outbox ni otro `SyncCoordinator`.

El par `(deviceId, deviceSeq)` permite saber si el receptor ya procesó un evento.

### 5.3. Ejemplo de vector clock

Supón dos dispositivos:

```
Laptop A: { A: 4, B: 2 }
Móvil B:  { A: 3, B: 3 }
```

Los vectores son concurrentes:

- A tiene una versión más avanzada de sus propios eventos.
- B también tiene una versión más avanzada de los suyos.
- Ninguno contiene completamente al otro.

Por eso no podemos afirmar que la laptop tenga la versión más reciente solo porque su reloj físico marque una hora posterior.

En el intercambio, los dispositivos envían sus marcas de agua por dispositivo, identifican los eventos que faltan y los intercambian sin reenviar todo el historial.

Para el tamaño normal de una biblioteca personal, el vector suele ser pequeño. Limita los dispositivos registrados y compacta periódicamente los eventos ya incluidos en snapshots.

### 5.4. La política correcta para el progreso de lectura

No todos los campos deben resolverse de la misma manera:

| Dato                    | Regla de fusión                                             |
| ----------------------- | ----------------------------------------------------------- |
| Máxima página alcanzada | `MAX`, si las versiones comparten el mismo mapa de páginas  |
| Última página abierta   | Causalidad; si son concurrentes, Lamport + deviceId         |
| Capítulo completado     | Semántica monotónica, con operación explícita para deshacer |
| Historial de sesiones   | Unión de eventos únicos                                     |
| Bookmarks nuevos        | Add-wins con identificador estable                          |
| Bookmarks eliminados    | Tombstones                                                  |
| Preferencias            | LWW por campo con Lamport                                   |

Este punto merece especial atención:

`lastPageIndex` no debe fusionarse usando `MAX`.

Un usuario puede regresar a la página 3 porque quiere releer una escena. También puedes recibir un evento retrasado de otro dispositivo.

Por eso conservaría una tabla auxiliar por dispositivo:

```
CREATE TABLE IF NOT EXISTS user_chapter_device_progress (
    user_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,

    variant_id INTEGER,
    last_page_index INTEGER NOT NULL DEFAULT 0,
    furthest_page_index INTEGER NOT NULL DEFAULT 0,

    lamport INTEGER NOT NULL DEFAULT 0,
    device_seq INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(user_id, chapter_id, device_id)
) WITHOUT ROWID;
```

Cada dispositivo mantiene su última posición. La aplicación puede mostrar como posición general la ganadora de la política de resolución, pero no pierde la posición guardada por otro dispositivo.

Además, si las variantes de scanlation tienen páginas diferentes, el `MAX` de la página alcanzada solo tiene sentido dentro de la misma variante o tras una correspondencia de páginas verificada.

### 5.5. Reutilizar el mecanismo de sincronización existente

```
Offline Mutation Outbox
          │
          ▼
   SyncCoordinator
          │
          ├── Transporte HTTP existente
          │
          └── Transporte P2P nuevo
                    │
                    ▼
             RTCDataChannel
                    │
                    ▼
            Peer remoto
                    │
                    ▼
         Validación / deduplicación
                    │
                    ▼
          Estado local actualizado
```

El nuevo componente debe ser un adaptador:

```
interface SyncTransport {
  connect(): Promise<void>;
  exchangeState(): Promise<void>;
  sendEvents(events: ProgressEvent[]): Promise<void>;
  close(): Promise<void>;
}
```

Implementaciones:

```
HttpSyncTransport
P2PSyncTransport
```

Ambas reutilizan el mismo formato de eventos, identificadores idempotentes y reglas de conflicto.

El servidor mantiene la deduplicación que ya existe en `processed_mutations`. Si una mutation ya fue aplicada por HTTP y luego llega mediante P2P, no debe aplicarse dos veces.

## 6. Protocolo de sincronización Mesh

No montaría un mesh completo con todos los dispositivos enviando datos continuamente. En una biblioteca personal, es suficiente una red oportunista de conexiones directas.

Por ejemplo, con tres dispositivos:

```
       Laptop A
        /    \
       /      \
  Móvil B --- PC C
```

Pero el comportamiento real será por rondas: se conecta un dispositivo, intercambia los eventos pendientes, confirma y libera la conexión. Luego puede conectarse otro.

Para el T4500 recomiendo que no mantenga conexiones de datos permanentes con todos los dispositivos.

### 6.1. Handshake

Al abrir un DataChannel, los peers intercambian:

```
{
  "type": "HELLO",
  "protocolVersion": 1,
  "deviceId": "device-a",
  "deviceName": "Laptop",
  "schemaVersion": 44,
  "vector": {
    "device-a": 18,
    "device-b": 7
  },
  "capabilities": {
    "chapterTransfer": true,
    "progressSync": true,
    "resumeTransfer": true
  }
}
```

El receptor responde con las marcas de agua que conoce.

A partir de ellas:

1. Cada peer identifica los eventos que le faltan.
2. Intercambian lotes pequeños de eventos.
3. Deduplican por `eventId`.
4. Aplican las reglas de fusión por campo.
5. Persisten los cambios.
6. Confirman los eventos aplicados.
7. Actualizan los vectores y las marcas de agua.

Mensajes principales:

| Mensaje             | Función                            |
| ------------------- | ---------------------------------- |
| `HELLO`             | Identidad, versiones y capacidades |
| `SYNC_STATE`        | Estado causal y marcas de agua     |
| `EVENT_BATCH`       | Mutaciones pendientes              |
| `EVENT_ACK`         | Eventos persistidos                |
| `TRANSFER_MANIFEST` | Metadatos del capítulo             |
| `CHUNK`             | Bloque binario                     |
| `CHUNK_ACK`         | Confirmación de escritura          |
| `RESUME`            | Reanudar desde bloques pendientes  |
| `COMPLETE`          | Transferencia validada             |
| `CANCEL`            | Cancelación                        |

La sincronización debe ser idempotente. Si un teléfono pierde conexión después de recibir un lote pero antes de recibir el ACK, puede volver a enviarlo sin generar duplicados.

### 6.2. Reanudación de capítulos

Conserva en IndexedDB u OPFS:

```
interface TransferState {
  transferId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  acknowledgedChunk: number;
  status: "receiving" | "paused" | "completed" | "failed";
}
```

Para una primera versión secuencial, guarda el último índice confirmado y continúa desde el siguiente. Si posteriormente permites bloques fuera de orden, necesitarás mantener un conjunto o bitmap de bloques confirmados.

No confundas `bufferedamountlow` con confirmación de persistencia: ese evento indica que bajó la cola del emisor, no que el receptor haya guardado los datos.

### 6.3. Seguridad de la sincronización

WebRTC DataChannels ya utilizan DTLS para cifrar los datos transmitidos. Eso protege el transporte, pero no sustituye la autenticación de la identidad del peer ni la autorización de las operaciones.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



Añadiría:

- Código temporal de emparejamiento de un solo uso.
- Confirmación visible del nombre del dispositivo remoto.
- Autorización para compartir capítulos.
- Autorización separada para recibir cambios de progreso.
- Límite de tamaño y número de archivos.
- Validación de manifiestos, nombres y hashes.
- Expiración de sesiones y tokens.
- Botón de cancelación en ambos dispositivos.

Nunca aceptaría automáticamente un archivo porque alguien está conectado a la misma Wi-Fi.

## 7. Rendimiento: restricciones del Pentium T4500

Aquí hay que distinguir dos modos de uso.

### Modo A — El T4500 solo señaliza

Modo preferido

El T4500:

- Mantiene las conexiones WebSocket.
- Reenvía Offer, Answer e ICE.
- No recibe ni retransmite bytes de capítulos.
- No hace hashing de imágenes durante la negociación.
- No necesita cargar un archivo completo para compartirlo.

La conexión de datos va directamente entre los navegadores.

### Modo B — El T4500 también es peer

En este escenario sí consume recursos de CPU, memoria, red y disco.

Mi recomendación:

| Recurso                                      | Límite recomendado |
| -------------------------------------------- | ------------------ |
| Peers WebSocket señalizados                  | 8                  |
| Peers por sala de transferencia              | 2                  |
| Negociaciones simultáneas                    | 2                  |
| Conexiones RTC activas en el T4500 como peer | 1                  |
| Transferencias pesadas simultáneas           | 1                  |
| Chunks por adelantado sin ACK                | 8                  |
| Tamaño de chunk inicial                      | 16 KiB             |
| Cola de salida inicial                       | 256 KiB            |

Los ocho peers WebSocket son un límite operativo conservador, no una capacidad máxima técnica del hardware. La prioridad es evitar las transferencias concurrentes que consumen recursos, no limitar innecesariamente los anuncios de presencia.

### 7.1. Evitar trabajo innecesario

- Solo canales de datos, sin `getUserMedia()` ni pistas de audio/vídeo.
- `iceCandidatePoolSize: 0`.
- Sin STUN/TURN externos.
- Sin generación de thumbnails durante la transferencia.
- Sin recomprimir WebP.
- Sin `Promise.all()` para todos los archivos del capítulo.
- No realizar hashes completos de 200 MB en una única asignación.
- No hacer polling constante de `getStats()`.
- Evitar mantener peers inactivos indefinidamente.

El hash de cada chunk puede calcularse sobre buffers pequeños mediante Web Crypto; el hash final de un archivo grande puede verificarse por streaming en el backend, o mediante un manifiesto de hashes de bloques.

### 7.2. Mobile y suspensión de la aplicación

No prometas transferencias ininterrumpidas cuando un dispositivo móvil bloquea la pantalla o suspende la PWA. El navegador y el sistema operativo pueden ralentizar o suspender las conexiones en segundo plano.

Para esta primera versión:

- Recomienda mantener la aplicación abierta durante transferencias grandes.
- Guarda el progreso de transferencia periódicamente.
- Detecta `connectionState` y `dataChannel.readyState`.
- Reanuda después de una desconexión.
- No pierdas los chunks ya confirmados.

## 8. Arquitectura de módulos y endpoints

Distribución sugerida:

```
src/
├── modules/
│   ├── p2p/
│   │   ├── SignalingService.ts
│   │   ├── PairingService.ts
│   │   ├── PeerSession.ts
│   │   ├── TransferManifest.ts
│   │   ├── ChunkProtocol.ts
│   │   ├── TransferCoordinator.ts
│   │   └── P2PImportService.ts
│   │
│   └── sync/
│       ├── P2PSyncTransport.ts
│       ├── DeviceIdentity.ts
│       ├── VersionVector.ts
│       ├── LamportClock.ts
│       ├── ProgressConflictResolver.ts
│       └── SyncEventRepository.ts
```

No introduciría un nuevo `SyncCoordinator`: la implementación P2P debe ser un transporte adicional del que ya existe.

### REST API Fastify

| Método | Endpoint                           | Objetivo                         |
| ------ | ---------------------------------- | -------------------------------- |
| POST   | `/api/v1/p2p/pairings`             | Crear emparejamiento             |
| DELETE | `/api/v1/p2p/pairings/:id`         | Revocar emparejamiento           |
| GET    | `/ws/signaling`                    | Negociar WebRTC                  |
| GET    | `/api/v1/p2p/devices`              | Ver dispositivos conocidos       |
| POST   | `/api/v1/p2p/imports`              | Crear importación en el HDD      |
| PUT    | `/api/v1/p2p/imports/:id/content`  | Recibir stream del archivo       |
| POST   | `/api/v1/p2p/imports/:id/finalize` | Validar y archivar               |
| GET    | `/api/v1/p2p/imports/:id`          | Estado de la importación         |
| GET    | `/api/v1/sync/mesh/state`          | Obtener estado de sincronización |

Los mensajes `EVENT_BATCH`, `EVENT_ACK` y `SYNC_STATE` deben viajar por el DataChannel durante la sesión P2P. No necesitas convertir cada intercambio en una petición HTTP.

## 9. Pruebas y SLA de Sprint 44

Los valores siguientes son límites iniciales de diseño. Deben medirse en el T4500 y en dispositivos móviles reales.

| Métrica                                    | Objetivo    |
| ------------------------------------------ | ----------- |
| Librerías pesadas adicionales              | 0           |
| Servidor de retransmisión de capítulos     | 0           |
| Chunk inicial                              | 16 KiB      |
| Cola de salida                             | ≤256 KiB    |
| Chunks sin confirmar                       | ≤8          |
| Transferencias activas del T4500           | 1           |
| Transferencia completa en RAM              | 0           |
| Eventos de progreso duplicados aplicados   | 0           |
| Archivos aceptados sin verificación        | 0           |
| Pérdida de progreso causalmente confirmado | 0           |
| Reanudación desde chunks persistidos       | Obligatoria |

### Matriz de pruebas obligatorias

A. Conectividad

- Dos navegadores en la misma LAN sin Internet.
- Conexión mediante hotspot móvil.
- Direcciones estáticas sin DHCP.
- Señalización mediante WebSocket local.
- Offer/Answer mediante QR.
- Candidatos mDNS.
- Cliente Wi-Fi aislado y diagnóstico de fallo.
- Navegadores con permiso de red local denegado.

B. Transferencia

- Archivo WebP pequeño.
- Capítulo CBZ de más de 200 MB.
- Transferencia con chunks de 16 KiB.
- Perfil experimental de 64 KiB.
- Cliente receptor lento.
- `bufferedAmount` no supera el límite operativo.
- Desconexión en mitad de un chunk.
- Reinicio y reanudación de bloques confirmados.
- Hash incorrecto y archivo corrupto.

C. Offline Mesh Sync

- Dos dispositivos modifican el mismo capítulo offline.
- Relojes físicos desincronizados.
- Última posición distinta y progreso máximo mayor.
- Duplicación de eventos.
- Eventos fuera de orden.
- Bookmarks creados y eliminados en dispositivos diferentes.
- Reconciliación de una versión de capítulos con páginas distintas.

D. Hardware

- T4500 únicamente como señalizador.
- T4500 como emisor.
- T4500 como receptor.
- Una transferencia mientras el lector está activo.
- Cancelación y liberación de memoria.
- Consumo durante períodos prolongados.

## 10. Distribución entre agentes

| Agente               | Responsabilidad                                  | Resultado              |
| -------------------- | ------------------------------------------------ | ---------------------- |
| A — WebRTC Signaling | Fastify WebSocket, pairing y QR                  | Conexión LAN           |
| B — Transfer Engine  | DataChannel, chunks y backpressure               | Transporte binario     |
| C — Storage          | OPFS, IndexedDB y archivo local                  | Recepción recuperable  |
| D — Mesh Sync        | Device IDs, vector clocks y resolver de progreso | Sincronización offline |
| E — QA / Integración | Android, navegador, LAN sin Internet y T4500     | Suite completa         |

Orden recomendado:

1. Probar dos dispositivos conectados a la misma LAN sin Internet.
2. Implementar señalización WebSocket.
3. Establecer DataChannel y transmitir un WebP pequeño.
4. Añadir chunks, límites de buffer y ACK.
5. Implementar almacenamiento OPFS e IndexedDB.
6. Añadir transferencia CBZ y reanudación.
7. Integrar el protocolo de eventos de progreso.
8. Añadir vector clocks y resolución de concurrencia.
9. Integrar archivo en HDD mediante Fastify.
10. Ejecutar pruebas sobre el hardware objetivo.

## Veredicto de arquitecto

# WebRTC Direct + Bounded Transfer + Hybrid Sync

La arquitectura que elegiría:

- Señalización: Fastify WebSocket local y modo QR de contingencia.
- Conectividad: ICE local sin STUN/TURN externos.
- Transferencia: RTCDataChannel reliable/ordered, chunks de 16 KiB.
- Flujo: bufferedAmount + ACK después de persistir.
- Almacenamiento: OPFS primero, IndexedDB como alternativa.
- Mesh Sync: device sequence + vector clocks + Lamport.
- Backend: archivar solo cuando el usuario lo solicite.
- T4500: señalizador por defecto y un único peer de datos activo.

La decisión más importante de todo Sprint 44 es esta: no conviertas el T4500 en el intermediario de los datos P2P. Que los móviles hablen directamente entre sí; que el servidor solo facilite el encuentro, y que la sincronización de lectura viaje como eventos pequeños, idempotentes y recuperables.

Con eso tienes una arquitectura que puede funcionar sin Internet externo, aprovecha el almacenamiento local de cada dispositivo y no hace que el Pentium tenga que procesar el tráfico de toda la red.

Referencias técnicas: [WebRTC — Peer Connections](https://webrtc.org/getting-started/peer-connections?utm_source=chatgpt.com) · [MDN — Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels?utm_source=chatgpt.com) · [Chrome — Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access?hl=en\&utm_source=chatgpt.com) · [MDN — OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system?utm_source=chatgpt.com).

El siguiente paso sería preparar el plan de ejecución de los cinco agentes con el protocolo binario congelado, los contratos de eventos y una prueba LAN sin Internet como primer criterio de aceptación.

Revisar avances del Sprint 44 cada domingo
