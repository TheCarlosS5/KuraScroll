# Auditoría UX: Sintetizador Dinámico de Diálogos por Voz (Dynamic Dialogue TTS Synthesizer) (Sprint 75)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura auditiva mediante síntesis de voz (*TTS*), ergonomía de uso manos libres, pronunciación de sufijos honoríficos (*-san*, *-kun*, *hyung*, *oppa*), sincronización visual y accesibilidad para personas con discapacidad visual.

---

## 1. Ergonomía de Lectura Manos Libres
* **Casos de Uso Principales:** Escuchar capítulos mientras se cocina, se realiza ejercicio o se descansa en la cama con los ojos cerrados.
* **Control de Reproducción:** Controles flotantes minimalistas y accesibles mediante atajos de teclado (`Space` para Pausa/Play, `← / →` para saltar de bocadillo/diálogo), permitiendo una gestión cómoda sin necesidad de mirar la pantalla constantemente.

---

## 2. Pronunciación de Sufijos Honoríficos (Japonés y Coreano)
* **El Desafío:** Los sintetizadores de voz estándar suelen masacrar los sufijos culturales (`-san`, `-kun`, `-chan`, `-senpai`, `hyung`, `oppa`, `unnie`), pronunciándolos de forma occidentalizada o robótica.
* **Solución de Diccionario Fonético:** El motor TTS de KuraScroll integra un diccionario fonético local especializado en manga/manhwa que ajusta la entonación y pronunciación correcta de los honoríficos y nombres propios asiáticos, logrando una experiencia auditiva natural y respetuosa con la obra original.

---

## 3. Sincronización Visual y Resaltado de Bocadillos
* **Highlight Sin Desplazamientos:** Mientras la voz sintetiza el diálogo actual, el bocadillo correspondiente en la página se enmarca con un sutil halo luminoso o borde translúcido.
* **Cero Saltos de Layout:** El resaltado debe ser puramente gráfico (capa superpuesta sin *reflow* de DOM), evitando tirones o desplazamientos molestos en la vista del lector.

---

## 4. Accesibilidad para Lectores con Discapacidad Visual
* **Inclusión Total:** La integración de un TTS de alta calidad con lectura de onomatopeyas y descripciones de viñetas abre KuraScroll a usuarios con baja visión o ceguera total, permitiéndoles disfrutar de las grandes historias del manga en igualdad de condiciones.
