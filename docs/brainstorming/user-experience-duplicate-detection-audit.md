# Auditoría UX: Detección Automática de Duplicados, Fuzzy Matching Jaro-Winkler y Reconciliador de Scanlation Cross-Scanlation

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de riesgos de fusiones automáticas de series en bibliotecas de manga (ej. secuelas, spin-offs y variaciones de nombres de scanlation) y propuesta de salvaguardas ergonómicas.

---

## 1. El Riesgo Crítico de Falsos Positivos en Fusiones Ciegues
Para un coleccionista de manga, la biblioteca es sagrada. Una fusión incorrecta o destructiva destruye el orden de lectura y confunde arcos argumentales enteros.

* **El Peligro de las Secuelas y Spin-offs:** Algoritmos basados puramente en similitud de texto (Jaro-Winkler) caen fácilmente en trampas comunes al comparar títulos como:
  - *Fairy Tail* vs. *Fairy Tail: 100 Years Quest*
  - *Tokyo Ghoul* vs. *Tokyo Ghoul:re*
  - *Naruto* vs. *Naruto Gaiden* o *Boruto*
* **Impacto al Usuario:** Si el sistema fusiona automáticamente una secuela directa como si fuera el mismo manga, los capítulos nuevos se mezclan con los viejos, arruinando el índice de volúmenes, el conteo de progreso y la experiencia de lectura ininterrumpida. **Una fusión 100% ciega/destructiva es inaceptable.**

---

## 2. Salvaguardas Ergonómicas y Prevención de Desastres

Para proteger al usuario sin sacrificar la potencia de la desduplicación inteligente, se establecen las siguientes reglas de interacción:

### A. Umbrales de Confianza y Confirmación Explícita
* **Similitud Alta (> 0.95):** Candidato ultra-seguro (ej. variaciones menores de espacios o acentos, como *"Shingeki No Kyojin"* vs *"Shingeki no Kyojin"*). Puede agruparse o sugerirse con un badge de aprobación rápida.
* **Similitud Moderada (0.82 - 0.94 - Zona de Riesgo/Secuelas):** Aquí entran casos como *Tokyo Ghoul* y *Tokyo Ghoul:re*. El sistema **nunca debe fusionarlos automáticamente**. Debe presentarlos en una bandeja de revisión con una tarjeta de advertencia visual: 
  > *"⚠️ Encontramos series con nombres similares (Posible secuela o spin-off). ¿Deseas fusionarlas o mantenerlas separadas?"*
* **Similitud Baja (< 0.82):** Se ignoran por completo para evitar falsos positivos.

### B. Registro de Auditoría y Botón de Reversión (`duplicate_merge_history`)
* **Paz Mental Garantizada:** Cada fusión realizada debe registrarse en una tabla de auditoría local (`duplicate_merge_history`) que almacene los metadatos originales de ambas series.
* **UI de Desvinculación (Undo / Unlink):** En la vista de detalles de la serie, el usuario debe encontrar un botón accesible en el menú de configuración avanzado: *"Desvincular capítulos importados por error"*, permitiendo deshacer cualquier fusión accidental en un solo clic.

---

## 3. Recomendaciones Finales
1. **Priorizar el criterio del lector:** El algoritmo debe actuar como un asistente inteligente que **sugiere**, no como un dictador que altera archivos sin permiso.
2. **Prevención de pérdida de datos:** Ningún archivo físico ni registro de progreso debe eliminarse al fusionar; la operación debe ser meramente relacional (agrupación lógica de scanlations y volúmenes bajo una misma ficha maestra).
