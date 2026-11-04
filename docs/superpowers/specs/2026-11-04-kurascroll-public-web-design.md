# Diseño: KuraScroll web pública, ingesta local y comunidad

- **Proyecto:** KuraScroll
- **Responsable:** Carlos
- **Fecha:** 2026-11-04
- **Estado:** Diseño acordado en conversación; ejecución autónoma autorizada por el usuario
- **Primera fase:** Web
- **Fase posterior:** Aplicación Android nativa en Kotlin

## 1. Objetivo

Permitir que varias personas utilicen una instalación pública de KuraScroll sin hacer que el servidor Pentium ejecute la conversión de imágenes de cada capítulo. La persona que aporta un capítulo lo prepara en su navegador, lo envía ya optimizado y recibe su publicación en una biblioteca compartida. Las cuentas guardan el avance y las rachas de lectura en SQLite. Cada serie tendrá una conversación previa a la lectura y cada cuenta tendrá un perfil público básico.

El servidor continúa siendo la fuente de verdad para el catálogo y los archivos compartidos. El navegador se encarga de abrir el archivo fuente, convertir sus páginas y enviar el resultado. Android reutilizará los contratos de API en una fase posterior.

## 2. Contexto del repositorio

- El backend usa Fastify, TypeScript y SQLite; el frontend usa React, Vite y TypeScript.
- El servicio actual de ingesta de capítulo extrae archivos y usa Sharp para generar WebP. La nueva ruta web no debe llamar a Sharp ni a otro decodificador/transcodificador del servidor.
- Los endpoints de progreso y rachas existen, pero las llamadas actuales usan el identificador fijo local_user. No hay cuentas, sesiones ni perfiles registrados.
- No hay una ruta web de subida de capítulos. La ingesta actual es local por CLI, daemon o scripts.
- SeriesDetailPage.tsx ya funciona como pantalla de información entre el catálogo y el lector. Ahí se incorporará la conversación por serie.
- app.ts exige un API_TOKEN para todas las solicitudes cuando el backend se expone fuera de loopback. Ese modelo no sirve para una aplicación web con cuentas públicas porque el secreto no se puede entregar al navegador.
- docs/reports/backend-security-audit.md identifica rutas con userId arbitrario y operaciones administrativas pendientes de una política de autorización común. La fase web debe resolver esa brecha antes de exponer las rutas a Internet.

## 3. Decisiones aprobadas

1. La primera entrega es la web; Android Kotlin queda para una segunda fase.
2. Se permite registro público mediante correo y contraseña.
3. La biblioteca y sus capítulos publicados son compartidos por todas las cuentas.
4. Las subidas se publican al terminar una carga válida. Se pueden reportar; su autor puede retirarlas y un administrador puede ocultarlas o retirarlas.
5. La subida acepta material que KuraScroll pueda leer: archivos CBZ/ZIP, PDF y conjuntos de imágenes.
6. El avance y las rachas son privados por defecto. El perfil público expone nombre y biografía, no el historial de lectura.
7. La pantalla existente de serie es la superficie de comentarios antes de comenzar a leer. Los comentarios pueden marcarse como spoilers.
8. El correo saliente se configura por SMTP al desplegar. No se pondrán credenciales en el repositorio.
9. La ejecución de agy será visible en una terminal interactiva. La implementación usará subagentes internos de agy para las áreas independientes y revisará su integración.
10. Si no hay una sesión válida, al iniciar la aplicación se muestra acceso, registro y el botón Omitir. Omitir está disponible con y sin conexión.

## 4. Alcance de la primera fase

### Incluido

- Registro, verificación de correo, inicio y cierre de sesión, cambio de contraseña y restablecimiento por correo.
- Pantalla de entrada para cuentas con Omitir visible siempre que no exista una sesión válida.
- Perfiles públicos con identificador único, nombre visible y biografía corta.
- Sesión autenticada ligada a las llamadas de progreso, rachas y preferencias existentes.
- Aislamiento de las cuentas frente a userId falsificado enviado en query o body.
- Flujo web para preparar y subir un capítulo desde CBZ, ZIP, PDF o varias imágenes.
- Creación de una serie básica o elección de una serie existente.
- Biblioteca compartida con publicación inmediata al finalizar la carga.
- Carga por página a un área temporal, reintento de una página fallida, validación final y publicación atómica.
- Comentarios públicos por serie, marca de spoiler, enlaces a perfiles y reportes.
- Herramientas mínimas de administración para revisar reportes y ocultar o retirar aportes.
- Límites configurables de tamaño, frecuencia y almacenamiento por cuenta.
- Configuración y guía de despliegue detrás de un proxy HTTPS.
- Migraciones de base de datos que preservan los datos existentes.

### Fuera de alcance

- Implementar la app Android nativa en esta fase.
- Aceptar archivos arbitrarios que KuraScroll no pueda mostrar.
- Procesar imágenes con Sharp o con otra biblioteca en el camino HTTP.
- Exponer rachas o historial de lectura en perfiles públicos.
- Inicio de sesión con OAuth o proveedores sociales.
- Reemplazar capítulos existentes automáticamente.
- Almacenamiento en nube o CDN externo.
- Funciones sociales no solicitadas como votos, calificaciones o mensajes privados.

## 5. Experiencia y flujo de ingesta

### 5.0 Entrada y modo invitado

Al iniciar KuraScroll sin una sesión autenticada, se muestra una pantalla con inicio de sesión, registro y el botón Omitir. El botón se presenta sin depender de navigator.onLine y abre el catálogo como invitado tanto si hay conexión como si no. Con conexión, el invitado puede consultar el catálogo y los capítulos públicos; sin conexión, puede abrir el shell y el contenido que el service worker ya haya guardado. Una instalación que nunca haya cargado KuraScroll necesita conexión para obtener el shell inicial.

El avance invitado permanece en IndexedDB. Al crear o iniciar sesión en una cuenta, la aplicación ofrece una acción explícita para importar ese avance; no lo mezcla silenciosamente con el usuario local legado. La subida y los comentarios siguen requiriendo cuenta verificada y conexión.

### 5.1 Archivos y metadatos

Un trabajo representa un capítulo. La persona puede:

- Seleccionar un archivo CBZ o ZIP que contenga las páginas.
- Seleccionar un PDF de un capítulo.
- Seleccionar varias imágenes para formar un capítulo. Se ordenan naturalmente por nombre de archivo.
- Elegir una serie existente o crear una ficha básica con título y tipo.
- Indicar el número del capítulo y, opcionalmente, el título y volumen.

Una serie nueva se crea solo si la carga termina correctamente. Una serie o capítulo duplicado produce un conflicto visible y no reemplaza los datos existentes.

### 5.2 Procesamiento en el dispositivo

Un worker del navegador procesa una página a la vez. Evita guardar el capítulo completo descomprimido en memoria. Para imágenes y páginas de PDF, el resultado objetivo es WebP de hasta 1440 píxeles de ancho, con calidad aproximada de 82, que coincide con la política actual del servicio de imágenes. Las tiras verticales que excedan las dimensiones admitidas por WebP se deben dividir en segmentos consecutivos, conservando el orden.

El procesamiento informa la página actual, el avance y el tamaño estimado. La persona puede cancelar. El cliente detecta explícitamente si la conversión solicitada devolvió WebP; no puede poner extensión .webp a un PNG o JPEG de fallback. Si el navegador no puede producir WebP, muestra un error antes de publicar el capítulo.

PDF.js se usa en la web para leer y renderizar páginas de PDF con su worker. La documentación de PDF.js describe la API de visualización y el uso del worker ([PDF.js: Getting Started](https://mozilla.github.io/pdf.js/getting_started/)). Canvas permite solicitar WebP y calidad, pero el tipo real puede depender del navegador; por eso se valida el MIME del Blob devuelto ([MDN: HTMLCanvasElement.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)).

### 5.3 Subida y publicación

1. El backend crea un identificador aleatorio de carga, asociado al usuario autenticado y a la serie/capítulo elegidos.
2. El cliente procesa una página y la envía como una solicitud independiente con su número, tamaño, dimensiones, MIME y hash.
3. El servidor transmite cada página al directorio temporal de esa carga sin convertir ni cargar el archivo completo a memoria.
4. El estado de carga devuelve qué páginas fueron confirmadas. El navegador guarda el identificador y la huella del archivo en IndexedDB; si se interrumpe la red, reintenta solo las páginas no confirmadas. Los trabajos incompletos caducan en 24 horas y sus archivos temporales se eliminan.
5. El cliente envía el manifiesto final. El servidor verifica propietario, cantidad, secuencia, sumas de comprobación, firmas básicas, cuota y ausencia de duplicado.
6. El servicio guarda el estado final de carga, registra la serie si es nueva, y mueve el directorio preparado a la ruta final en el mismo volumen de almacenamiento. Luego registra el capítulo/manifiesto como publicado.
7. Solo después de completar la publicación el capítulo aparece en el catálogo. Si el proceso se reinicia durante el movimiento o el commit de SQLite, una rutina de inicio reconcilia la carga y termina la publicación o elimina el directorio huérfano.
8. Un reintento de finalizar una carga ya completada devuelve el resultado existente en vez de crear otra copia.

El servidor puede calcular SHA-256 mientras transmite, validar encabezados y límites, y escribir registros SQLite. No descomprime, decodifica, reescala ni vuelve a codificar las páginas.

### 5.4 Límites iniciales

La validación del navegador y del servidor se basa en los límites actuales del backend:

- Archivo fuente CBZ/ZIP o PDF: máximo 250 MiB.
- Archivo de imagen dentro de un archivo: máximo 50 MiB.
- Expansión total: máximo 1 GiB.
- Entradas en ZIP: máximo 10 000.
- Relación de compresión máxima: 200:1.
- Páginas publicadas por capítulo: máximo 5 000.
- Bytes de salida por capítulo: máximo 1 GiB.
- Cuota de almacenamiento por cuenta: configurable; valor inicial propuesto de 10 GiB.

Los límites se aplican también en el servidor a las páginas procesadas. Las validaciones del navegador no son controles de seguridad.

## 6. Identidad, perfiles y datos de lectura

### 6.1 Cuentas y sesiones

- El correo normalizado y el identificador público son únicos.
- El registro solicita correo, contraseña e identificador público.
- El correo se verifica con un enlace de un solo uso enviado por SMTP. El restablecimiento de contraseña usa un token de un solo uso con expiración.
- La contraseña se guarda con un hash de contraseña lento y sal única; nunca se guarda ni se registra en texto plano.
- La sesión usa un token aleatorio opaco. La base guarda su hash, cuenta, vencimiento y revocación.
- La web guarda la sesión en una cookie HttpOnly, Secure y SameSite=Lax. Las escrituras también comprueban origen/CSRF.
- El entorno local usa un transport de desarrollo que muestra el enlace en la consola. El registro público de producción requiere la configuración SMTP.
- Un comando local crea el primer administrador antes de publicar el sitio. No se concede el rol administrador automáticamente a la primera cuenta pública.

### 6.2 Perfiles y privacidad

El perfil público contiene el identificador, el nombre visible, una biografía corta y la fecha de creación. No muestra correo, avance, rachas ni actividad diaria. Los comentarios públicos enlazan a ese perfil. La visibilidad de estadísticas queda fuera de esta fase.

### 6.3 Progreso y datos legados

Las rutas de progreso, rachas, historial, bibliotecas personales y preferencias obtienen el identificador de la sesión. Si una solicitud incluye un userId, el servidor lo ignora o rechaza; nunca lo usa como identidad.

El modo invitado mantiene el progreso local en IndexedDB. Los registros existentes asociados a local_user no se asignan a la primera cuenta pública. El administrador puede reclamarlos explícitamente para la cuenta propietaria durante la configuración inicial; la operación se registra y no se ejecuta por defecto.

El service worker solo puede cachear catálogo, perfiles públicos, comentarios públicos, manifiestos públicos y páginas/imágenes compartidas. Respuestas de sesión o datos personales usan Cache-Control: no-store y nunca entran a Cache API. El estado local de invitado se mantiene separado de cualquier identidad de cuenta; cerrar sesión elimina cualquier copia personal temporal del cliente sin borrar el avance invitado.

## 7. Comentarios y moderación

- Los comentarios pertenecen a una serie, autor y fecha; se muestran con paginación y texto plano.
- Un comentario puede marcarse como spoiler. El contenido aparece oculto hasta que el lector elija mostrarlo.
- Leer comentarios es público. Escribir, retirar el propio comentario y reportar requiere una cuenta verificada.
- El autor puede retirar su comentario o aporte. El administrador puede ocultar, restaurar o retirar contenido reportado.
- El reporte conserva tipo, motivo, autor, fecha y estado de resolución.
- Cuentas, comentarios y reportes tienen límites de frecuencia configurables. Los errores no confirman si un correo registrado pertenece a otra cuenta.

## 8. Componentes y responsabilidades

### Frontend

- Flujo de registro, verificación, sesión, cierre y recuperación.
- Estado de autenticación con identidad devuelta por el servidor; ningún componente decide el userId.
- Asistente de subida con selección de serie, metadatos, estado de proceso, avance, cancelación y reintento.
- Worker para ZIP, PDF e imágenes. ZIP y páginas se procesan de forma secuencial y la salida se envía por página.
- Perfil público y sección de comentarios en la ficha de serie previa al lector.
- Panel de reportes visible solo para el rol administrador.

### Backend

- Servicio de autenticación y sesiones.
- Resolución de identidad a partir de cookies y política común de acceso por ruta.
- Servicio de subida procesada que escribe en staging y publica sin Sharp.
- Rutas de perfil, comentarios, reportes y administración.
- Validación de límites, cuotas, expiración y limpieza de cargas incompletas.
- Migraciones versionadas de SQLite para cuentas, sesiones, perfiles, propiedad de aportes, comentarios, reportes y cargas temporales.

### Datos persistentes

Se añaden tablas para cuentas, sesiones, perfil, carga temporal, comentarios y reportes. Las series y capítulos registran quién los creó/aportó. El progreso, las rachas y preferencias mantienen su estructura funcional existente, pero las escrituras obtienen un ID de cuenta. Las migraciones son transaccionales y conservan los registros anteriores.

## 9. Política de acceso

| Superficie | Acceso |
| --- | --- |
| Salud, catálogo, ficha, capítulos publicados, imágenes y lectura | Público |
| Registro, login, verificación, recuperación de contraseña | Público con límites de frecuencia |
| Avance, rachas, preferencias, marcadores y biblioteca personal | Cuenta autenticada; solo sus propios datos |
| Perfil público, lista y lectura de comentarios | Público |
| Escribir/retirar comentario, reportar, subir o retirar el propio aporte | Cuenta autenticada y correo verificado |
| Revisar reportes, ocultar contenido, suspender cuenta, backup, mantenimiento e importación | Administrador |
| Ruta no inventariada o no clasificada | Denegada hasta que tenga una política explícita |

El API_TOKEN no se incluye en JavaScript. Si se mantiene para automatizaciones máquina a máquina, no sustituye a la sesión de usuario y se limita a esas integraciones.

## 10. Despliegue y protección de recursos

- El backend mantiene 127.0.0.1 como host predeterminado. La publicación se hace a través de un proxy HTTPS configurado para la aplicación.
- Se permiten únicamente los orígenes configurados. No se usa CORS abierto.
- Se documentan los ajustes de dominio, URL pública, SMTP y cuota; los secretos permanecen en variables de entorno.
- Se aplica límite de frecuencia por IP/cuenta a registro, login, comentario, reporte y subida.
- Se limita el número de cargas activas por cuenta y se limpia staging caducado al iniciar y mediante una tarea periódica de bajo impacto.
- Las operaciones administrativas y las escrituras de archivos no aceptan rutas de filesystem enviadas por el cliente.
- Una denegación, cuota excedida, capítulo duplicado, formato inválido, archivo demasiado grande o falta de disco produce un error claro y deja la biblioteca consistente.

## 11. Criterios de aceptación

1. Una cuenta puede registrarse, verificar el correo, entrar, salir y restablecer la contraseña con SMTP configurado.
2. Una persona invitada puede consultar el catálogo y leer; su progreso local no se mezcla con cuentas.
3. El botón Omitir aparece en la entrada tanto online como offline cuando no hay sesión. Offline, el shell precargado abre el modo invitado y muestra el contenido disponible en caché.
4. Dos cuentas no pueden leer ni cambiar el avance, las rachas, preferencias o bibliotecas personales de la otra alterando un userId.
5. Un usuario autenticado puede preparar y publicar un capítulo CBZ/ZIP, PDF o conjunto de imágenes desde el navegador.
6. El camino HTTP de carga no llama a Sharp ni realiza transcodificación en el servidor.
7. El capítulo no es visible hasta validar y publicar todas sus páginas; al fallar o cancelar no se registra una publicación parcial.
8. Una carga duplicada no reemplaza un capítulo existente y se puede reintentar tras un conflicto de red sin volver a cargar las páginas confirmadas.
9. Los límites de página, expansión, bytes, frecuencia y cuota se aplican aunque un cliente omita la validación del navegador.
10. Una persona puede leer comentarios antes de entrar al lector, abrir perfiles, publicar texto, marcar spoilers y reportar contenido.
11. Un administrador creado localmente puede resolver reportes y retirar contenido; ninguna cuenta pública obtiene privilegios por orden de registro.
12. Las rutas tienen una clasificación de acceso explícita antes de que el servidor se publique en Internet.
13. Los cambios preservan los edits locales que ya están en el árbol de trabajo.

## 12. Revisión y verificación de la implementación

La revisión de Codex comprobará el inventario de rutas y sus roles, que el identificador personal provenga de la sesión, que el flujo de carga no use Sharp, que los archivos se publiquen desde staging de forma consistente y que los límites no dependan solo del navegador. Se ejecutará la compilación de producción y se hará una revisión manual del flujo web online y offline y de los mensajes de error.

Antes de que el dueño abra el acceso público deberá configurar SMTP, dominio/proxy TLS, orígenes permitidos, cuota de almacenamiento y primer administrador.

## 13. Fase Android

Android Kotlin queda para un diseño y plan separados, después de estabilizar la API web. La app reutilizará registro/sesión, identidad, biblioteca, subida, perfiles, comentarios, progreso y rachas. El procesamiento y la codificación WebP se ejecutarán en el teléfono; no se trasladará al backend.
