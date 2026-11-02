# Auditoría UX: Sincronización Multi-Pestaña y Elección de Líder Efímero (Sprint 65)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura al abrir múltiples series o capítulos en distintas pestañas del navegador, utilizando `BroadcastChannel` y elección de pestaña líder (*Tab Leader Election*).

---

## 1. Experiencia al Leer en Múltiples Pestañas Simultáneamente
Es muy común que un lector abra varias series a la vez (ej. una pestaña con *One Piece* y otra con *Jujutsu Kaisen*), o tenga dos pestañas de la misma obra en puntos distintos.
* **El Peligro del Conflicto de Estado:** Si una pestaña actualiza el progreso o cambia la configuración de lectura, una sincronización agresiva podría forzar a la otra pestaña a saltar de página o capítulo de forma inesperada, arruinando la sesión de lectura activa.
* **La Solución (Sync Inteligente sin Saltos Forzados):** La sincronización entre pestañas debe actualizar los metadatos globales (estado de leídos, marcapáginas globales, estadísticas diarias y preferencias de tema) **de forma silenciosa en segundo plano**, sin modificar jamás el scroll ni la página activa de una pestaña que se encuentre en pleno proceso de lectura.

---

## 2. Notificación No Intrusiva de Cambios Externos (`MultiTabSyncHUD`)
Cuando una pestaña en segundo plano recibe una actualización importante (ej. se marcó un capítulo como leído desde otro dispositivo o pestaña sincronizada), el usuario merece enterarse sin que la interfaz le interrumpa.
* **El Widget `MultiTabSyncHUD`:** Un indicador flotante translúcido y ultra-discreto en la esquina superior derecha que muestra un micro-mensaje temporal (ej. `🔄 Progreso sincronizado desde otra pestaña` o `📌 Marcapáginas actualizado`) durante 2 segundos y se desvanece con una animación suave de GSAP.
* **Cero Modales Bloqueantes:** Está prohibido mostrar alertas modales o confirmaciones que requieran clics del usuario para aceptar cambios de estado internos entre pestañas.

---

## 3. Recomendaciones Ergonómicas
1. **Pestaña Líder (Tab Leader):** La elección de pestaña líder gestiona las operaciones de escritura pesada hacia IndexedDB/SQLite para evitar colisiones de concurrencia en la base de datos local, manteniendo a las pestañas secundarias en modo de solo lectura optimizada.
2. **Indicador de Sincronización Global:** Añadir un diminuto punto indicador de color (verde/azul) en el icono de la app o barra superior que parpadee suavemente al sincronizar datos con el servidor o pestañas gemelas.
