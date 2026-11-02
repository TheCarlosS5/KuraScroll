# Auditoría UX: Búsqueda Híbrida (FTS5 + Int8 Vector Search) y Descubrimiento Semántico

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la calidad de búsqueda y descubrimiento en el catálogo usando búsqueda híbrida (texto exacto FTS5 + embeddings vectoriales Int8 cuantizados) para consultas vagas o temáticas (ej. *"manga donde cocinan en una mazmorra"*).

---

## 1. Resolución de Consultas Vagas vs. Precisión de Títulos Exactos
Los lectores suelen buscar series de dos formas totalmente distintas: por título exacto o recordando únicamente la premisa.

* **El Reto de la Sinopsis Vaga:** Si Carlos escribe *"manga donde el protagonista cocina en una mazmorra"*, un buscador tradicional basado solo en palabras clave fallaría o arrojaría resultados irrelevantes. La búsqueda híbrida vectorial (Int8) entiende la **intención semántica** y relaciona la consulta directamente con obras como *Delicious in Dungeon (Dungeon Meshi)*.
* **Preservación del Rango de Título Exacto (Zero-Displacement):** Si el usuario introduce el título exacto de una obra famosa (ej. *"Bleach"*), el motor FTS5 debe tener prioridad absoluta o un factor de ponderación superior para garantizar que *Bleach* aparezca en la posición **#1**, evitando que resultados puramente vectoriales desplacen al título buscado.

---

## 2. Explicabilidad del Resultado (Explainability) para Evitar Frustración
Cuando un motor semántico devuelve obras que no tienen el título exacto que el usuario tecleó, puede surgir confusión si no hay transparencia en el motivo de la coincidencia.

* **Etiquetas de Contexto Semántico:** Debajo de las miniaturas de las obras encontradas mediante búsqueda vectorial vaga, se debe incluir una pequeña pastilla explicativa:
  > *`💡 Coincidencia temática por sinopsis: Dungeons & Cooking`*
* **Por qué es vital:** Esto le da feedback instantáneo a Carlos de que la app entendió su premisa, generando una experiencia de descubrimiento mágica en lugar de frustración por un resultado inesperado.

---

## Conclusión
La combinación híbrida de FTS5 (precisión léxica) e Int8 Vector Search (comprensión semántica) posiciona a KuraScroll con un buscador de nivel superior, capaz de interpretar tanto títulos exactos como recuerdos vagos de tramas sin sacrificar la exactitud.
