# KuraGames: biblioteca local de juegos — diseño

Fecha: 2026-11-04  
Estado: Diseño para implementación posterior a KuraScroll Web y Android

## Objetivo

Crear KuraGames, una aplicación de escritorio para organizar y abrir juegos que el usuario ya tiene guardados en su PC, USB o disco externo. La experiencia tomará como referencia la organización de un catálogo de juegos —búsqueda, géneros, novedades y fichas— y usará la identidad visual de KuraStream y KuraScroll.

KuraGames será útil sin conexión. Como no habrá enlaces ni un servidor de descargas, importar un juego significa copiarlo desde una ubicación local disponible a la biblioteca administrada. Sin un disco, USB o carpeta local que ya contenga el juego, la aplicación no puede obtenerlo estando desconectada.

## Usuarios y recorrido principal

1. El usuario abre KuraGames y ve su biblioteca local, incluso sin Internet.
2. Selecciona **Importar juego**, elige una carpeta o un archivo ZIP local y completa los metadatos básicos.
3. La app comprueba el espacio disponible, copia los archivos a la biblioteca y muestra el progreso. Puede cancelar y reanudar o limpiar la importación parcial.
4. El usuario organiza la colección por nombre, género, plataforma y estado; puede buscar y filtrar sin red.
5. Desde la ficha del juego, el usuario elige el ejecutable que ya está dentro de la carpeta administrada y pulsa **Jugar**.

## Alcance de la primera versión

- Aplicación de escritorio para Windows, con shell Tauri 2 y frontend React/TypeScript independiente en `kuragames/`.
- Catálogo local persistente: nombre, descripción, género, plataforma, año opcional, estado, ruta administrada, ejecutable seleccionado, imagen de portada local y fechas de importación/último uso.
- Importación desde una carpeta o un ZIP elegido explícitamente mediante el selector del sistema. No rastrea discos ni indexa carpetas del usuario sin consentimiento.
- Copia a una biblioteca administrada configurable, progreso, cancelación, prevención de duplicados por ruta y resumen de espacio ocupado. Las operaciones de copia deben ser recuperables ante cierre inesperado.
- Extracción ZIP segura: normalización de rutas, rechazo de traversal/symlinks, límites configurables de tamaño y número de entradas, detección de colisiones y limpieza de staging cancelado.
- Fichas, lista y cuadrícula, búsqueda local, filtros por plataforma/género/estado, favoritos, orden por nombre/fecha/último uso, y edición o retirada de una entrada.
- Selector explícito del ejecutable dentro de la carpeta del juego. Abrirlo solo después de una acción del usuario, verificar que la ruta canónica sigue dentro de la biblioteca, usar argumentos vacíos y no invocar un shell ni pedir elevación. Nunca ejecutar instaladores automáticamente.
- Copia de seguridad y restauración del catálogo y sus metadatos; los archivos de juego no se duplican durante un respaldo de metadatos.
- Accesibilidad de teclado, estados vacíos útiles y mensajes claros para desconexión, falta de espacio, archivos dañados y permisos insuficientes.
- Idioma inicial español. Los textos deben ser directos y de producto, sin explicaciones técnicas en la interfaz.

## Fuera de alcance

- Descubrir, alojar o descargar juegos desde Internet, enlaces de terceros, sitios de intercambio o servidores remotos.
- Incluir juegos, ROMs, cracks, seriales, ejecutables, instaladores o contenido comercial de terceros.
- Eludir DRM, licencias, protecciones, antivirus o permisos del sistema.
- Instalar automáticamente paquetes, ejecutar scripts de importación, aplicar parches o actualizar juegos.
- Tienda, cuentas, perfiles públicos, comentarios, telemetría, publicidad o funciones en la nube.
- Sincronización por LAN en la primera entrega. Una futura transferencia entre equipos debe ser una función explícita y autenticada, distinta del modo completamente local.
- Versión Android; administrar y lanzar ejecutables de PC es una función de escritorio.

## Interfaz e identidad visual

- Mantener el fondo nocturno compartido (`#080A10` / carbón-azul), superficies oscuras y texto claro.
- Tomar índigo (`#818CF8`) como acento principal de KuraStream; usar el menta/teal (`#5ED8C6`) en estados secundarios y el cian (`#00E5FF`) de KuraScroll solo para resaltados puntuales. Reservar violeta (`#8B5CF6`) para un detalle ocasional. No poner los cuatro acentos en una misma vista.
- La portada del catálogo debe priorizar biblioteca, búsqueda y filtros; mostrar una sección de actividad reciente solo cuando haya datos.
- Las fichas deben dar protagonismo a la portada local y al título, con acciones **Jugar**, **Editar** y **Quitar de la biblioteca** visibles y claras.
- Diseñar con ritmo editorial y densidad de catálogo: encabezados compactos, metadatos legibles y una cuadrícula que se adapte al ancho. Evitar fondos de gradiente genéricos, efectos de brillo, animaciones constantes, tarjetas repetidas sin jerarquía y cifras inventadas.
- Portadas elegidas desde archivos locales. No descargar imágenes ni mostrar enlaces externos.
- Respetar movimiento reducido y el modo de ahorro de recursos; usar carga diferida de portadas y evitar efectos costosos.

## Arquitectura y privacidad

- App autocontenida: interfaz React/TypeScript y shell Tauri 2; SQLite local para catálogo y preferencias. Sin backend HTTP.
- La aplicación debe iniciar y cumplir las tareas centrales en modo avión. No emitir analítica ni realizar solicitudes de red en tiempo de ejecución.
- Separar la biblioteca administrada, staging temporal y base de datos. Al cambiar de unidad, ofrecer localizar la biblioteca; no borrar entradas automáticamente.
- Permisos de Tauri con alcance mínimo: leer solo el origen elegido mediante diálogo del sistema; escribir solo dentro de la carpeta de biblioteca administrada y el directorio de configuración; ninguna ruta arbitraria desde la interfaz.
- Operaciones nativas pequeñas y tipadas. La interfaz no puede invocar shell, PowerShell, comandos arbitrarios ni argumentos de proceso.
- Al lanzar un juego, resolver la ruta real, comprobar que pertenece a la carpeta administrada del juego y comprobar que es un ejecutable seleccionado. No aceptar rutas aportadas por URL ni por metadatos importados.
- Los metadatos importados son datos no confiables; mostrarlos como texto escapado y no usar HTML ejecutable.
- No asociar extensiones de archivo globalmente ni alterar asociaciones del sistema.
- Mantener la app, el catálogo y el almacenamiento de juegos separados de los datos de KuraScroll Web.

## Decisiones de plataforma

Tauri 2 es la opción propuesta para evitar empaquetar otro Chromium completo: en Windows renderiza con WebView2 y permite configurar permisos de filesystem con rutas limitadas. La instalación final debe declarar claramente la versión de Windows soportada y verificar la disponibilidad del runtime. Si el PC de destino no cumple ese requisito, revisar el empaquetado del runtime antes de cambiar de framework.

El instalador de KuraGames solo distribuirá la aplicación vacía. Los juegos se agregan desde medios elegidos por el usuario y no se incluyen en el instalador.

## Criterios de aceptación

- La app abre y permite navegar el catálogo en modo avión.
- Una carpeta local puede importarse a la biblioteca administrada con avance visible, cancelación y manejo de falta de espacio.
- Un ZIP con entradas peligrosas o límites superados se rechaza sin escribir fuera de la biblioteca.
- Los datos del catálogo y las portadas locales persisten después de reiniciar la app.
- Una entrada duplicada se detecta sin sobrescribir archivos existentes.
- No se ejecuta ningún archivo hasta que el usuario selecciona un ejecutable de la carpeta administrada y pulsa **Jugar**.
- Una ruta manipulada fuera de la biblioteca no se ejecuta y no puede ampliar el acceso del proceso.
- Buscar, filtrar, editar, quitar una entrada y restaurar un respaldo de metadatos funcionan sin red.
- Los cambios visuales se revisan junto a KuraScroll y KuraStream y se mantienen ligeros en el perfil de recursos.

## Referencias

- Guía de prerrequisitos y WebView2 de Tauri 2: https://v2.tauri.app/start/prerequisites/
- Permisos del plugin de filesystem de Tauri: https://v2.tauri.app/learn/security/using-plugin-permissions/
- Diseño de KuraScroll: `frontend/src/index.css` y `docs/superpowers/specs/2026-11-01-kura-scroll-design.md`.
- KuraStream local: revisar `../KuraStream/frontend/css/tokens.css` y componentes del catálogo durante la implementación visual; reutilizar solo patrones propios y tokens de marca.
