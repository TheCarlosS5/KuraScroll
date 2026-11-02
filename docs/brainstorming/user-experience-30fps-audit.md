# Auditoría UX: Experiencia de Lectura bajo Bloqueo a 30 FPS (Sprint 54)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura de manga y webtoons con limitación estricta a 30 FPS para ahorro energético y control térmico (enfocado en hardware legacy como Intel GMA 4500MHD y Pentium T4500).

---

## 1. Lectura de Manga Estático a 30 FPS
Para el manga tradicional (páginas estáticas con paso horizontal), **30 FPS es perfectamente aceptable y prácticamente imperceptible como limitación**.
* **Motivo:** Como el lector pasa el 95% del tiempo con la vista fija en una página estática leyendo los diálogos, la tasa de refresco durante la lectura inmóvil es irrelevante. Las animaciones de transición o paso de página (aprox. 300ms) se ejecutan con suavidad suficiente a 30 FPS, garantizando cero impacto en la inmersión.

---

## 2. Continuidad del Scroll en Webtoons: 30 FPS vs. 60 FPS
A diferencia del manga estático, el formato webtoon depende de un **scroll vertical continuo**.
* **Sensación a 30 FPS:** En hardware moderado o moderno, bajar a 30 FPS en un scroll vertical rápido puede sentirse ligeramente menos fluido (*choppy*), con un leve desenfoque de movimiento (*motion blur* natural del panel).
* **El Balance para Hardware Legacy:** En equipos como el Pentium T4500 o netbooks antiguos, intentar forzar 60 FPS provoca caídas de frames abruptas (*stuttering* y tirones de CPU), lo cual es infinitamente más molesto que un scroll estable y constante a 30 FPS. Por lo tanto, el bloqueo a 30 FPS es una compensación técnica más que justificada para priorizar la estabilidad.

---

## 3. Notificaciones Discretas del Pacer Térmico
Cuando el sistema activa el limitador térmico o de tasa de refresco para proteger la batería o evitar el sobrecalentamiento, el usuario **nunca debe ser alarmado** con alertas agresivas.
* **Directriz UX:** Cero modales bloqueantes. Se utiliza únicamente un indicador visual muy sutil en la barra de estado (un icono de temperatura o hoja verde/ámbar con una pastilla flotante de 2 segundos: `🔋 Ahorro de energía activo (30 FPS)`). El lector continúa su sesión sin interrupciones.

---

## Conclusión
El bloqueo a 30 FPS del Sprint 54 es una excelente solución de ingeniería para hardware legacy, siendo imperceptible en manga y una alternativa estable y fluida frente al stuttering en webtoons, respaldada por un sistema de notificaciones totalmente no intrusivo.
