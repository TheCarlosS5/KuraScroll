# KuraScroll Android — diseño de aplicación Kotlin

Fecha: 2026-11-04  
Estado: Diseño aprobado para iniciar después de terminar la fase web

## Objetivo

Ofrecer KuraScroll como aplicación Android nativa, conectada al backend público de KuraScroll. Permitirá leer el catálogo compartido, mantener progreso y rachas por cuenta, usar el modo invitado sin conexión y preparar subidas CBZ/ZIP, PDF e imágenes directamente en el teléfono.

## Decisiones

- App Android nativa en Kotlin con Jetpack Compose; no empaquetar la web completa en un WebView.
- El backend web es fuente de verdad para cuentas, catálogo compartido, publicaciones, perfiles y comentarios.
- El teléfono hace el procesamiento y la codificación de páginas. El backend recibe páginas listas y no decodifica archivos fuente.
- Sin sesión válida, mostrar la pantalla de acceso con **Iniciar sesión**, **Crear cuenta** y **Omitir**. Omitir aparece siempre, con o sin Internet.
- La primera instalación necesita Internet para autenticar o descargar catálogo; después el contenido guardado localmente y el modo invitado funcionan sin conexión.
- Android no recibe `API_TOKEN`. La autenticación móvil debe usar sesiones opacas revocables mediante `Authorization: Bearer`, separadas del mecanismo cookie del navegador. Guardar el token cifrado con una clave respaldada por Android Keystore; no registrarlo ni guardarlo en texto claro. El servidor guarda solo hashes y asocia toda operación con la sesión, nunca con un `userId` del cuerpo.
- Para archivos, usar Storage Access Framework (SAF) y permisos persistibles solo sobre URIs que el usuario seleccionó; no pedir acceso general al almacenamiento.
- Room conserva catálogo cacheado, capítulos marcados para leer, progreso invitado, progreso por cuenta, preferencias y cola de sincronización. Aislar los datos autenticados por identidad y mantener el progreso invitado aparte.
- Procesamiento intensivo en primer plano mientras se muestran páginas/progreso; las cargas preparadas pueden reintentarse con WorkManager y restricciones de red. No mantener un servicio permanente.

## Recorridos

### Entrada, sesión y Omitir

- Mostrar entrada al iniciar si no se ha restaurado una sesión válida.
- Registro con correo, handle y contraseña; login, verificación, cierre y recuperación usan contratos de la web.
- Omitir entra directamente al catálogo invitado aunque el dispositivo esté sin red.
- El progreso del invitado permanece en almacenamiento local propio. Al iniciar sesión, ofrecer una acción explícita para importar el progreso; nunca mezclarlo automáticamente.
- Al cerrar sesión, retirar credenciales y caché privada de la cuenta activa, preservando el modo invitado y los archivos públicos cacheados.

### Catálogo y lectura

- Buscar y filtrar el catálogo público; mostrar caché cuando no haya red.
- Pantalla de serie antes del lector con sinopsis, capítulos, perfil del autor y comentarios con indicador de spoiler.
- Lector de página vertical con selección de modo de lectura y memoria de capítulo/página/posición.
- Guardar progreso y racha localmente primero. Sin cuenta, queda local; con cuenta, se sincroniza y se reintenta al volver la conexión.
- Descargar capítulos para lectura sin conexión solo como caché de contenido publicado disponible en el servicio. No crear una fuente remota de archivos ajena a KuraScroll.

### Aporte desde el teléfono

- Requiere sesión verificada y red para publicar.
- SAF permite escoger un CBZ/ZIP, un PDF o imágenes seleccionadas; la persona crea o elige serie, número y título de capítulo.
- Worker Kotlin procesa una página a la vez, conserva el orden y convierte a WebP hasta 1440 px de ancho/calidad cercana a 82, con segmentación segura de tiras largas. No mantener un capítulo completo en RAM.
- Mostrar avance, tamaño estimado, cancelación y reintento. Validar el tipo real de salida y no publicar si no se produjo WebP.
- Usar una cola reanudable por páginas hacia el contrato de carga de la web. El backend valida hash, cuota, identidad y propiedad; la publicación final es atómica.
- Mostrar errores claros de archivo ilegible, permiso SAF revocado, espacio, red, límite de cuota o duplicado.

### Comunidad y cuenta

- Perfil propio editable y perfiles públicos de otros lectores.
- Comentarios por serie, protección visual de spoilers y reportes según las reglas de la web.
- Cualquier operación moderadora queda reservada al administrador del servidor, no al cliente móvil.

## Seguridad y privacidad

- HTTPS obligatorio para el servicio público; no permitir tráfico en claro.
- Token móvil opaco y revocable, con expiración; hash del lado servidor, almacenamiento cifrado con Android Keystore, rotación de credencial renovable y no guardar contraseñas tras login.
- Ningún `userId` enviado por la app define identidad; el backend usa la sesión validada.
- No incluir API_TOKEN, SMTP ni credenciales administrativas en APK, configuración, logs o recursos.
- SAF limita el acceso a los archivos elegidos. Persistir permiso solo cuando sea necesario para reanudar una carga y liberar al terminar.
- ZIP: rechazar rutas absolutas, traversal (`..`), enlaces, duplicados normalizados, entradas y tamaño descomprimido excesivos; procesar streaming y cancelar limpiamente.
- Desactivar logging de cuerpos, contraseñas, tokens, datos privados y contenido de capítulos.
- El service worker de la web y Room de Android guardan solo catálogo/contenido público en caché pública; datos personales se particionan por cuenta y se eliminan del área temporal al cerrar sesión.
- Sin analítica de terceros ni permisos de almacenamiento amplios.

## Identidad visual y recursos

- Reutilizar la base nocturna compartida. Priorizar índigo como acento de KuraStream, teal/menta en estados secundarios y cian de KuraScroll en resaltados puntuales; no saturar pantallas con varios colores de marca a la vez.
- UI táctil con botones amplios, jerarquía editorial y densidad de catálogo legible.
- Evitar pantallas de plantilla genérica, gradientes intensos, blur costoso y animaciones decorativas permanentes.
- Admitir ahorro de batería, movimiento reducido, carga diferida de portadas y decodificación acotada.

## Criterios de aceptación

- Build de depuración instalable en un emulador Android y navegación manual de entrada/catálogo/serie/lector.
- Omitir aparece y permite entrar en modo invitado online y en modo avión; progreso invitado persiste después de cerrar y abrir la app.
- Inicio de sesión restaura la cuenta y sincroniza avance sin filtrar progreso entre cuentas; cerrar sesión deja el invitado intacto.
- Contenido público visto previamente abre desde caché sin red; una instalación sin caché explica que todavía necesita conexión.
- Seleccionar CBZ/ZIP, PDF e imágenes con SAF no requiere permiso global y produce WebP secuencial antes de la carga.
- Una carga reanudable se conserva al salir de pantalla y maneja cancelación, expiración, reintento y desconexión sin publicar páginas parciales.
- Comentarios/spoilers y edición de perfil se reflejan según permisos del servidor.
- Verificar mediante revisión de APK/configuración que no contiene `API_TOKEN`, credenciales, hosts de desarrollo ni logging de secretos.

## Referencias técnicas

- Android Storage Access Framework: https://developer.android.com/training/data-storage/shared/documents-files
- WorkManager y trabajo persistente: https://developer.android.com/develop/background-work/background-tasks/persistent
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- PdfRenderer: https://developer.android.com/reference/android/graphics/pdf/PdfRenderer
- Diseño web/API: `docs/superpowers/specs/2026-11-04-kurascroll-public-web-design.md`.
