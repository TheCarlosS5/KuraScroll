# Auditoría UX: Flujo de Lectura Offline, Mutaciones en Outbox y Replay en KuraScroll

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto de la Prueba:** Escenario de Carlos leyendo en el metro con conexión intermitente (Pentium T4500 / Hardware Legacy / Offline-First PWA).

---

## 1. Feedback Visual durante la Lectura Sin Conexión (Metro / Sin Internet)
Cuando Carlos entra a una zona sin cobertura (como el metro) y continúa leyendo manga en KuraScroll, el sistema debe mantener una **inmersión absoluta y cero ansiedad**.

* **Indicador de Estado Discreto (Network Pill):** En la barra superior (Navbar), un icono minimalista de nube con una barra oblicua (`☁️⚡ Offline`) aparece de forma no intrusiva al perder la conexión, sin bloquear la pantalla ni interrumpir la lectura.
* **Indicador de Descarga Local:** Los capítulos descargados previamente muestran un pequeño badge verde de disponibilidad offline (`📥 Local`), dando al lector la seguridad de que su lectura no se interrumpirá.
* **Cero Alertas Bloqueantes:** Está estrictamente prohibido mostrar modales emergentes o popups de "Sin conexión a Internet" al pasar página o marcar capítulos. La app asume el modo offline de forma nativa.

---

## 2. Optimistic UI en la Marcación de Marcapáginas (Bookmarks)
Cuando Carlos marca una página épica estando offline, **la respuesta debe ser inmediata**.

* **Comportamiento Optimista:** El icono de marcapáginas cambia de estado y color al instante (`0ms de latencia percibida`), acompañado de una micro-animación de resorte y un toast flotante discreto (`📌 Página marcada`).
* **Encolado en Outbox:** La mutación se registra de manera silenciosa en la cola local (`Outbox Store`), esperando a que se restablezca la conexión con el servidor sin comprometer la fluidez de la interfaz.

---

## 3. Comportamiento del Puntero de Progreso al Reconectar
Una de las peores experiencias en apps de lectura es que, al recuperar la señal WiFi, la barra de progreso o la página actual "salte" o parpadee debido a una sincronización agresiva.

* **Reconexión Suave (Conflict Resolution sin Saltos):** El puntero de lectura local mantiene la autoridad absoluta durante la sesión. Al reconectar y ejecutar el *background replay*, el cliente compara el estado local con el servidor mediante marcas de tiempo (Last-Write-Wins). 
* **Cero Parpadeos (No-Flash Guarantee):** La sincronización en segundo plano actualiza los metadatos globales sin refrescar la vista activa del lector ni reposicionar el scroll del Webtoon o el número de página del Manga, evitando cualquier salto visual molesto.

---

## 4. Interacción entre el Modo Ahorro de Batería y el Sincronizador Offline
En hardware legacy (como el Pentium T4500 o laptops con batería degradada), el motor de sincronización en segundo plano no debe competir por los recursos del sistema.

* **Estrategia de Sincronización Adaptativa:**
  - Cuando el **Modo Ahorro de Batería** está activo, el intervalo de reintento del Outbox se relaja (backoff prolongado, ej. cada 5 minutos o únicamente al cambiar de capítulo) para evitar desperdiciar ciclos de CPU y batería.
  - Las operaciones de sincronización en lote se agrupan (*batching*) para despertar al cliente de red el menor número de veces posible.
* **Transparencia Térmica:** Si el sistema detecta alta temperatura o bajo nivel de energía, el indicador offline/sync muestra un tono ámbar tenue, recordando al usuario que el rendimiento energético está optimizado.

---

## Conclusión y Directrices de Implementación
El flujo offline en KuraScroll cumple con los estándares más altos de las aplicaciones modernas *offline-first* (estilo Tachiyomi/Mihon). La combinación de **Optimistic UI**, **Outbox Replay silencioso** y **respeto por los recursos de hardware** garantiza una experiencia impecable y libre de fricciones para Carlos y cualquier lector apasionado.
