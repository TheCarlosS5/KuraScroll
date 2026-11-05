# KuraGames: plan de implementación de biblioteca local

> Orquestación: Antigravity (`agy`) implementa y coordina sus propios subagentes. Codex prepara el plan y revisa integración, seguridad y experiencia visual. No usar subagentes nativos de Codex para este proyecto.

## Objetivo y secuencia

Entregar una aplicación Windows ligera para importar, catalogar y abrir juegos locales sin conexión. Esta fase empieza solo después de que KuraScroll Web quede integrada y revisada y que la aplicación Android Kotlin haya sido implementada y comprobada en emulador. KuraGames es un producto de escritorio separado; no cambiará el servidor público de KuraScroll.

## Documentos de referencia

- Especificación: `docs/superpowers/specs/2026-11-04-kuragames-local-library-design.md`.
- Diseño de KuraScroll: `docs/superpowers/specs/2026-11-01-kura-scroll-design.md`.
- Tokens existentes: `frontend/src/index.css`.

## Arquitectura prevista

- `kuragames/`: app React/TypeScript con Vite.
- `kuragames/src-tauri/`: shell Tauri 2, comandos Rust acotados, configuración de capacidades y empaquetado Windows.
- SQLite local para el catálogo; carpetas administradas para biblioteca y staging.
- Sin listener HTTP, sin servicios en segundo plano, sin llamadas de red en runtime y sin acceso a rutas globales.
- Todos los diálogos de importación/origen/portada/ejecutable los abre la app nativa; la interfaz recibe identificadores y resultados tipados.

## Límites invariables

- No incluir ni buscar juegos en Internet, enlaces, cracks, ROMs, seriales, instaladores o contenido de terceros.
- No ejecutar instaladores, scripts ni comandos importados. No elevar privilegios, desactivar controles del sistema o evadir DRM.
- No aceptar ruta de ejecutable desde URL, archivo de metadatos o campo libre sin pasar por un diálogo nativo y una validación de contención.
- No permitir shell, PowerShell ni un comando genérico en la IPC de Tauri.
- No agregar telemetría, perfiles remotos, comentarios ni una API pública.
- No modificar ni borrar los cambios previos del usuario en KuraScroll.

## Trabajo por etapas

### 0. Preparación y revisión de marca

- [ ] Confirmar que la fase web y Android quedó integrada antes de modificar archivos de aplicación.
- [ ] Revisar `git status` y `git diff`; aislar los cambios de KuraGames bajo `kuragames/` y los documentos aprobados.
- [ ] Leer los tokens de KuraScroll y revisar el repositorio local de KuraStream para reconocer su jerarquía de navegación, tipografía y espaciado.
- [ ] Crear un artifact de tarea de Agy con fases, límites y revisión.
- [ ] Delegar en subagentes internos de Agy: uno para arquitectura Tauri/IPC y amenazas, uno para modelo de datos/importación local y uno para UI/identidad visual. El agente principal conserva la integración de configuración y contratos compartidos.

### 1. Base de escritorio

- [ ] Crear app React/TypeScript independiente en `kuragames/`; fijar versiones compatibles y comandos de desarrollo/build.
- [ ] Inicializar Tauri 2 en Windows y configurar bundle con WebView2/runtime según el soporte elegido.
- [ ] Crear capacidades de Tauri con scopes mínimos para diálogos y acceso a la carpeta administrada.
- [ ] Establecer preferencias locales: ubicación de la biblioteca, idioma, modo reducido y última vista.
- [ ] Confirmar por inspección que el bundle de ejecución no registra plugins HTTP, actualización web, analítica ni shell genérico.

### 2. Catálogo local y biblioteca

- [ ] Definir migraciones SQLite versionadas para juegos, metadatos, rutas relativas, imagen local y estado de importación.
- [ ] Diseñar el layout de almacenamiento con archivos temporales y renombre atómico después de completar una importación.
- [ ] Implementar operaciones tipadas para listar, crear, actualizar, quitar y buscar juegos.
- [ ] Mantener rutas relativas bajo la raíz gestionada; validar canonicalización y límites del directorio antes de leer/escribir.
- [ ] Implementar detección de duplicados y entradas faltantes al desconectar un disco externo.

### 3. Importación local robusta

- [ ] Añadir selector nativo para carpetas y ZIP locales; no escanear medios por cuenta propia.
- [ ] Comprobar espacio libre y validar tamaño/archivos antes de copiar.
- [ ] Copiar a staging con progreso, cancelación y limpieza segura; permitir retomar solo cuando el manifiesto temporal sea válido.
- [ ] Para ZIP: bloquear traversal, symlinks, rutas absolutas, colisiones normalizadas, expansión excesiva y cantidad/tamaño máximos configurables.
- [ ] Permitir metadatos mínimos manuales y una imagen elegida localmente; tratar archivos de metadatos como texto no confiable.
- [ ] No ejecutar contenido durante ni después de la importación.

### 4. Interfaz de catálogo

- [ ] Construir shell de navegación, catálogo vacío, tarjetas compactas, búsqueda y filtros usando tokens de KuraScroll.
- [ ] Crear ficha con portada local, título, metadatos, tamaño aproximado y botones **Jugar**, **Editar** y **Quitar**.
- [ ] Añadir importación con estado visible y mensajes claros de copia, cancelación, error y falta de espacio.
- [ ] Añadir favoritos, estados, orden y actividad reciente solo con actividad real.
- [ ] Revisar teclado, foco, contraste, movimiento reducido, carga diferida y consumo visual de CPU/GPU.

### 5. Apertura segura y copias

- [ ] Añadir selector nativo del ejecutable dentro del directorio de juego administrado.
- [ ] Antes de lanzar, resolver ruta canónica y verificar pertenencia al directorio esperado; pasar lista vacía de argumentos y no usar shell.
- [ ] Lanzar solo por acción explícita **Jugar** y mostrar errores del sistema sin ejecutar automáticamente.
- [ ] Implementar respaldo/restauración de base de datos y metadatos; validar el respaldo antes de aplicar cambios.
- [ ] Permitir quitar del catálogo y distinguir claramente entre retirar entrada y borrar archivos de forma permanente. Nunca borrar archivos por cascada al retirar una ficha.

### 6. Revisión integrada

- [ ] Revisar todos los diffs de Agy y resolver defectos antes del cierre.
- [ ] Compilar la aplicación de escritorio en Windows y revisar manualmente la instalación/arranque.
- [ ] Comprobar con modo avión que catálogo, búsqueda, edición, importación desde una carpeta local y portadas funcionan sin red.
- [ ] Probar manualmente ZIP válido, ZIP malicioso de traversal, cancelación, falta de espacio simulada, duplicado, USB ausente/restaurado y ruta de ejecutable fuera de la biblioteca.
- [ ] Confirmar que **Jugar** abre solo el ejecutable elegido y que no hay ejecución automática ni shell.
- [ ] Hacer revisión visual en varias anchuras, junto a KuraScroll/KuraStream, con foco en una interfaz de producto coherente y no genérica.
- [ ] Confirmar que el runtime no hace solicitudes de red y que no se añadieron dependencias de descarga/telemetría.
- [ ] Informar resultado, artefacto de instalación, comandos de compilación y límites del modo completamente local.

## Verificación

La verificación es compilación más revisión manual de los recorridos críticos anteriores. No agregar ni ejecutar suites automatizadas o benchmarks salvo que el usuario lo pida después. No publicar el instalador ni abrir puertos desde esta tarea.

## Condición de cierre

KuraGames se considera terminado cuando los criterios de aceptación de la especificación se observan en un build de Windows, el flujo local se revisa sin conexión, la validación de rutas y extracción resiste los casos adversos descritos y los cambios ajenos al alcance no entran en el diff.
