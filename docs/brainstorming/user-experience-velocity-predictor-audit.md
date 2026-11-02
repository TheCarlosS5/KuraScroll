# Auditoría UX: Predictor Dinámico de Velocidad de Lectura (Sprint 53)

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del predictor de velocidad de lectura y tiempo estimado de finalización desde la perspectiva de lectores de manga y manhwa.

---

## 1. Ansiedad vs. Motivación en el Tiempo Estimado de Lectura
Ver un reloj o un temporizador estimando el tiempo restante puede transformar un pasatiempo relajante en una carrera contra el reloj.
* **El Riesgo de Estrés:** Para el lector casual o contemplativo, frases como *"Quedan 45 minutos para terminar el volumen"* generan presión y fatiga psicológica, convirtiendo la lectura en una obligación laboral.
* **Solución Ergonómica (Control Total):** 
  - El predictor de velocidad debe ser **opcional por defecto**.
  - En la configuración de lectura, debe existir un interruptor claro: `[ ] Mostrar estimación de tiempo de lectura`. Si el usuario prefiere leer sin métricas de tiempo, la interfaz se mantiene limpia y relajada.

---

## 2. Gestión de Páginas Dobles / Splash Art (Manejo de Outliers)
En el manga, un lector puede pasar 45 segundos o un minuto completo contemplando una página doble de arte épico (*splash art* o doble página de combate), a diferencia de los 5 segundos que dedica a un panel de diálogo rápido.
* **El Problema del Outlier:** Si el algoritmo calcula la velocidad promediando ciegamente ese pico de 45 segundos como una lectura lenta estándar, distorsionará por completo todas las estimaciones de los capítulos siguientes.
* **Solución Algorítmica / UX:** El sistema debe aplicar un filtro estadístico de recorte (*trimmed mean* o umbral máximo de ponderación por página, ej. tope de 15 segundos por página para el cálculo de velocidad) para que la contemplación artística no desconfigure el reloj dinámico.

---

## 3. Valor de las Estimaciones: Nivel de Capítulo vs. Nivel de Volumen
* **Nivel de Capítulo (Altamente Útil):** Saber que *"Faltan 3 minutos para terminar el capítulo"* ayuda a tomar decisiones cotidianas (*"Leo este capítulo antes de bajar del autobús y cierro"*). Es la granularidad ideal.
* **Nivel de Volumen / Serie (Riesgo de Abrumación):** Ver que faltan 8 horas para terminar una obra larga abruma. Si se muestra a nivel de volumen, debe presentarse en formato de hitos amigables (ej. *"Aprox. 2 capítulos más para cerrar este tomo"*) en lugar de un contador de horas absolutas.

---

## Conclusión
El predictor de velocidad de lectura del Sprint 53 es una herramienta útil siempre y cuando se mantenga como una opción desactivada por defecto, maneje inteligentemente los picos de lectura en arte complejo y priorice la estimación a nivel de capítulo.
