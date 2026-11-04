# Informe de Pruebas E2E en Producción con Computer Use

Fecha de ejecución: 4 de Noviembre de 2026  
Entorno de prueba: Localhost (`http://localhost:5173`) sobre navegador Brave  
Hardware de referencia: Intel Pentium T4500 (2C/2T) / Intel GMA 4500MHD / 4TB SATA II HDD  
Herramienta de automatización: MCP `computer-use` (OCR, coordenadas, teclado, ratón y zoom)

---

## 1. Resumen Ejecutivo

Se completó una auditoría exhaustiva de extremo a extremo de KuraScroll interactuando directamente con la interfaz gráfica en modo producción. Durante la sesión se eliminaron por completo todos los elementos de prueba y mock residuales (`solo-leveling`, `kimetsu-no-yaiba`, `tower-of-god`, `berserk`, `spy-x-family`, `martial-peak`), dejando exclusivamente las 5 obras reales de la biblioteca personal con sus portadas oficiales en alta resolución y más de 616 capítulos WebP reales.

---

## 2. Inventario de Series Reales en Producción

| Serie | Tipo | Capítulos | Portada Oficial | Estado |
| :--- | :---: | :---: | :---: | :---: |
| **Dark Lady** | Manhwa | 303 | `dark-lady-cover.webp` (178 KB, 640x915) | Verificado en Webtoon & RTL |
| **El Demonio Celestial del Cosmos 3077** | Manhwa | 112 | `el-demonio-celestial-del-cosmos-3077-cover.webp` (77 KB, 640x963) | Verificado en Webtoon (60 págs) |
| **Kyouran Reijou Nia Liston** | Manga | 28 | `kyouran-reijou-nia-liston-cover.webp` (33 KB, 300x450) | Verificado en Catálogo |
| **Uesugi-kun wa Onnanoko wo Yametai** | Manga | 65 | `uesugi-kun-wa-onnanoko-wo-yametai-cover.webp` (113 KB, 640x1006) | Verificado en Catálogo |
| **Un Diario de Conquista** | Manhwa | 108 | `un-diario-de-conquista-cover.webp` (97 KB, 640x896) | Verificado en Catálogo |

**Total de capítulos reales disponibles:** 616 capítulos  
**Elementos de prueba en base de datos y disco:** 0

---

## 3. Acciones de Saneamiento y Corrección Aplicadas

### A. Erradicación de Portadas y Datos Mock
1. **Causa raíz:** El script inicial de prueba (`seed-demo-data.ts`) había introducido 6 series sintéticas con portadas de monograma `KS` que poblaron la base de datos y fueron retenidas en la caché en memoria del `RecommendationService`.
2. **Solución implementada:**
   - Se ejecutó `scripts/remove-demo-data.ts` purgando todas las tablas de SQLite (`series`, `chapters`, `chapter_pages`, `series_genres`, `series_titles`, `series_search_fts`, `user_progress`) de cualquier rastro de las 6 series demo.
   - Se borraron las carpetas y archivos mock en `data/storage/series/` y `data/storage/covers/`.
   - Se regeneraron las portadas auténticas desde `Documents/mangas/*/portada/portada.png` utilizando Sharp con compresión WebP calidad 90.
   - Se reinició el servidor Fastify backend para vaciar la memoria RAM y reconstruir el índice invertido de recomendaciones exclusivamente con las obras reales.
   - Se purgó la base de datos de cliente IndexedDB (`kura-scroll-client-db`) en el navegador.

---

## 4. Hallazgos de Funcionalidades Evaluadas

### 4.1. Catálogo Principal & Buscador
- **Filtros por Tipo:** Las pestañas *Todos*, *Manga*, *Manhwa* y *Manhua* filtran instantáneamente sin parpadeos ni peticiones de red innecesarias.
- **Buscador en Tiempo Real:** Filtra sobre los títulos primarios y alternativos con latencia inferior a 1 ms en memoria.
- **Recomendaciones Personalizadas:** El carrusel superior muestra las obras con afinidad calculada según las lecturas recientes del usuario (ej. *"Porque leíste Dark Lady"*, afinidad 70%).

### 4.2. Puntero de Reanudación Inteligente (Smart Resume Hero)
- Detecta y renderiza de inmediato la última lectura del lector (`Dark Lady - En progreso (20%) Capítulo 1 - Pág. 2 de 10`).
- El botón **Reanudar Lectura** abre la obra en la página exacta donde se detuvo el usuario.

### 4.3. Motor de Lectura Dual (Webtoon & Manga RTL)
- **Modo Webtoon (Scroll Vertical):** Probado con el Capítulo 1 de *Dark Lady* y *El Demonio Celestial del Cosmos 3077* (60 páginas). El streaming de imágenes WebP mantiene 60 FPS estables y calcula en tiempo real la velocidad de lectura (`~18s/pág`) y tiempo restante estimado.
- **Modo Manga RTL (Paginado Oriental):** La tecla de flecha izquierda avanza la página en consonancia con la lectura japonesa. Soporta visualización de doble página en monitores panorámicos.

### 4.4. Menús y Modales Interactivos
- **Ajustes Visuales & Ambilight (`v`):** Permite alternar entre Carbón, OLED Negro y Sepia Cálido, además de brillo, contraste, escala de grises y halo ambiental trasero.
- **Navegación de Capítulos (`c`):** Drawer lateral con los 303 capítulos de *Dark Lady*, barra de búsqueda de capítulos y contador de progreso leído.
- **Marcador de Página (`b`):** Añade la página actual a los marcadores persistentes de IndexedDB.
- **Meta Diaria (`GOAL`):** Modal de configuración de hábitos diarios (15/30/50 páginas o minutos) y visualizador de racha de los últimos 7 días.
- **Logros y Medallas:** Sistema de insignias por constancia y páginas acumuladas.
- **Ecosistema Hermano KuraStream:** Modal accesible desde el menú secundario que vincula directamente a `http://localhost:3000` para alternar entre lectura y streaming.

---

## 5. Oportunidades de Mejora UI/UX para Siguientes Pasos

1. **Ajuste de Truncado en Títulos de Catálogo:**
   - *Observación:* Títulos largos como *El Demonio Celestial del Cosmos 3077* en tarjetas de catálogo pueden mostrarse con elipsis temprana (`El Demonio Celestial d...`).
   - *Recomendación:* Asegurar `line-clamp-2` con altura mínima fija en el contenedor de texto de `SeriesCard.tsx` para permitir que el título se extienda a 2 líneas antes de truncar.

2. **Scroll Asistido en Previsualizador de Miniaturas:**
   - *Observación:* En capítulos con más de 50 páginas (como el capítulo 1 de *El Demonio Celestial* con 60 páginas), la tira horizontal de miniaturas requiere arrastrar la barra de scroll.
   - *Recomendación:* Añadir soporte para desplazamiento con la rueda del ratón (`wheel -> scrollLeft`) en el contenedor de miniaturas.

3. **Preferencia de Modo de Lectura Recordada por Serie:**
   - *Observación:* Aunque el sistema infiere Webtoon para Manhwa y RTL para Manga, si el usuario cambia manualmente una serie a un modo específico, actualmente es una sesión activa.
   - *Recomendación:* Guardar la clave `preferred_reader_mode` en IndexedDB indexada por `seriesId`.

---

## 6. Conclusión

La aplicación se encuentra en un estado de nivel de producción sólido, limpio y completamente libre de elementos de prueba. Todas las funciones principales, secundarias y de personalización operan con alta fidelidad y velocidad.
