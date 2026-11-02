# Blueprint Senior ChatGPT: Sprint 65 - Motor de Sincronización Multi-Pestaña y Elección de Líder Efímero

> [!IMPORTANT]
> Consulta arquitectónica senior realizada a ChatGPT vía MCP Brave en la sesión activa.
> Diseñado para **Intel Pentium T4500 (Penryn 2C/2T, $\le$ 512MB V8 heap)**, **Intel GMA 4500MHD (CERO blur, CLS = 0)** y **HDD Mecánico de 4TB (cero polling masivo para proteger el bus SATA II y reducir IOPS)**.

---

## 1. Principio de Coordinación: Un Solo Líder de Escritura

Cuando el usuario abre varios mangas en distintas pestañas del navegador:
- **Problema:** Si 4 pestañas hacen polling continuo y transacciones a SQLite / IndexedDB, compiten por el cerrojo WAL de la base de datos y generan I/O innecesaria en el disco de 4TB.
- **Solución Senior:** **Algoritmo de Elección de Líder Efímero sobre HTML5 `BroadcastChannel('kura_tab_bus')`**.
  - Una sola pestaña asume el rol de **Líder**. Es la única que ejecuta sincronizaciones de fondo y polling al servidor Fastify.
  - Las demás pestañas son **Workers**: reciben de inmediato por el canal los cambios de lectura, modificaciones de marcadores y selecciones de tinte de papel (`PaperTone`), con **0% de consumo de red** y latencia sub-milisegundo.

---

## 2. Tipos de Mensajes del Bus Efímero (`kura_tab_bus`)

```typescript
export type TabMessageType =
  | 'LEADER_HEARTBEAT'
  | 'LEADER_CLAIM'
  | 'LEADER_RESIGN'
  | 'TAB_PING'
  | 'TAB_PONG'
  | 'SYNC_READING_PROGRESS'
  | 'SYNC_PAPER_TONE'
  | 'SYNC_BOOKMARK';

export interface TabBusMessage<T = any> {
  id: string;
  type: TabMessageType;
  senderTabId: string;
  senderEpoch: number;
  timestamp: number;
  payload?: T;
}
```

---

## 3. Prevención de Split-Brain & Throttling de Temporizadores

- En Chrome/Edge/Brave, las pestañas inactivas en segundo plano sufren **Timer Throttling** (intervalos fijados a 1000ms o más).
- **Parámetros del Lease:**
  - Intervalo de Heartbeat del Líder: `1500 ms`.
  - Expiración de Lease (Timeout): `4000 ms` (permite saltarse 2 ticks throttling sin perder liderazgo falsamente).
  - Cesión explícita (`LEADER_RESIGN`): Enviada en `window.addEventListener('beforeunload')` y `onpagehide`, permitiendo que otra pestaña asuma el liderazgo en $< 50\text{ ms}$ sin esperar los 4000ms.
- **Resolución de Conflicto:** Si dos pestañas creen ser líderes al mismo tiempo, gana la que tenga mayor `epoch` o, a igual `epoch`, la de menor `tabId` lexicográfico.

---

## 4. Backend Fastify & SQLite en RAM

- Para no fragmentar el disco mecánico de 4TB con registros efímeros que cambian cada segundo:
  - Las sesiones activas de pestañas se rastrean en memoria dentro de Fastify en `Map<string, TabSessionRecord>` con TTL de 15 segundos.
  - Tabla opcional en SQLite `ephemeral_tab_sessions` creada en el esquema con eliminación automática o sobre `PRAGMA temp_store = MEMORY`.

---

## 5. Requerimiento SLA 29
- **SLA 29:** Latencia de serialización y despacho de eventos en el bus cross-tab $< 0.02\text{ ms}$ (20 µs).
