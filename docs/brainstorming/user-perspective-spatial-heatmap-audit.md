# Auditoría UX: Mapa de Calor Espacial de Lectura en Memoria y Analizador de Foco Cinético (Sprint 61)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del mapa de calor espacial de lectura en memoria y el análisis de foco cinético (*dwell time*) en páginas de manga y webtoons.

---

## 1. El Atractivo para el Lector Otaku (Dwell Time y Arte Detallado)
A los lectores apasionados les encanta reflexionar sobre sus hábitos de lectura y el impacto visual de las obras maestras.
* **Redescubriendo el Arte y la Trama:** Ver en un mapa de calor dónde el usuario pasó más tiempo (*dwell time*) permite revivir momentos clave: desde la contemplación de arte hiperdetallado (estilo Kentaro Miura en *Berserk* o Yusuke Murata en *One-Punch Man*) hasta la lectura de páginas con diálogos densos (estilo *Hunter x Hunter*) o giros emocionales inesperados.
* **Tarjetas de Atención ("Reading Density Cards"):** La posibilidad de generar un resumen visual de la sesión de lectura (estilo Spotify Wrapped pero enfocado en el manga) con gráficos de densidad de atención genera un fuerte sentido de conexión y orgullo otaku, ideal para compartir entre la comunidad.

---

## 2. Prevención de Distracción Cognitiva y Privacidad de la Experiencia
Un mapa de calor superpuesto por defecto destruiría la pureza artística de la página de manga.
* **Modo Opt-In Estricto (Nunca Impuesto):** El mapa de calor de atención **jamás** debe mostrarse durante la lectura activa predeterminada. 
* **Métodos de Acceso Ergonómicos:** 
  - **Atajo de Teclado `'H'`:** Presionar la tecla `H` en el visor activa un toggle rápido para alternar la visualización del mapa de calor sobre la página actual.
  - **Menú de Analíticas / Historial:** También es accesible al finalizar un capítulo o volumen desde el panel de estadísticas de lectura.

---

## Conclusión
El sistema de mapas de calor espaciales del Sprint 61 añade una capa de autoconocimiento y apreciación artística fascinante para el lector, gobernada con rigor ergonómico mediante accesos Opt-In (`'H'`) para preservar la inmersión visual.
