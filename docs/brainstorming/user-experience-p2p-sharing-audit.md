# Auditoría UX: Compartir Capítulos Localmente P2P (WebRTC DataChannels) y Sincronización Offline Mesh

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de transferencia directa de capítulos entre dispositivos sin conexión a internet (en el metro, aviones o zonas sin cobertura) usando WebRTC DataChannels, códigos QR / PIN y descubrimiento P2P.

---

## 1. Emparejamiento: Código QR / PIN de 6 Dígitos vs. Descubrimiento mDNS
En entornos offline (como el metro o un vagón de tren), la confiabilidad es clave.

* **Descubrimiento Automático (mDNS / Broadcast local):** Si bien es mágico cuando funciona, suele fallar o demorarse debido a restricciones de seguridad de redes corporativas, routers públicos o aislamiento de clientes en ciertos puntos de acceso Wi-Fi. Depender exclusivamente de él genera frustración.
* **El Estándar Híbrido Ganador (QR & PIN de 6 dígitos):** 
  - **Código QR:** Escanear el código QR que muestra el dispositivo emisor en la pantalla de su laptop o tablet es **extremadamente rápido, visual y a prueba de errores** (ideal para compartir con un amigo al lado).
  - **PIN de 6 Dígitos / Enlace Directo:** Alternativa robusta para dispositivos sin cámara o cuando el escaneo físico no es viable.
  * **Recomendación UX:** Ofrecer ambos métodos en un modal claro: *"Compartir Capítulo (Modo P2P Sin Conexión)"* con la opción de mostrar QR o introducir PIN.

---

## 2. Seguridad y Prevención de Archivos Maliciosos (Fricciones Necesarias)
Permitir que cualquier dispositivo envíe datos a una laptop o tablet abre la puerta a vectores de abuso o archivos basura si se aceptan conexiones a ciegas.

* **El Protocolo de Doble Confirmación (Handshake Seguro):**
  1. **Aceptación de Entrada:** Cuando el dispositivo B escanea el QR del dispositivo A, aparece un diálogo explícito en la pantalla del receptor: *"El dispositivo [Nombre/ID Aleatorio] quiere enviarte el capítulo 14 de Solo Leveling (18.4 MB). ¿Aceptar transferencia?"*
  2. **Validación de Integridad:** KuraScroll valida mediante hash interno que los archivos recibidos pertenezcan estrictamente al formato esperado (.cbz, .zip o carpetas de imágenes WebP válidas), bloqueando cualquier carga maliciosa de scripts o binarios ejecutables.
* **Fricción Saludable:** Esta pequeña confirmación de un clic previene transferencias accidentales o no deseadas en lugares públicos concurridos.

---

## 3. Estado de Recepción e Integración Inmediata en la Biblioteca Local
Una vez completada la transferencia P2P, la transición del archivo recibido al lector debe ser totalmente transparente y satisfactoria.

* **Barra de Progreso Clara:** Durante la transferencia mediante WebRTC DataChannels, un widget flotante en la esquina inferior muestra el progreso en tiempo real (`⚡ Recibiendo Cap. 14... 84% (15.2 MB / 18.4 MB)`), con una estimación precisa del tiempo restante.
* **Integración Instantánea:** Al llegar al 100%, el archivo se descomprime o indexa en la base de datos local SQLite de forma silenciosa y se actualiza la biblioteca con un badge de notificación discreto:
  > *`✅ ¡Capítulo recibido con éxito! Ya disponible offline en tu biblioteca.`*
* **Acción de Apertura Directa:** El toast de éxito incluye un botón directo *"Leer Ahora"*, permitiendo a Carlos saltar inmediatamente a la lectura sin tener que buscar el capítulo manualmente en el catálogo.

---

## Conclusión
El módulo P2P del Sprint 44 resuelve magistralmente la lectura colaborativa y el intercambio sin internet, combinando la velocidad de WebRTC con una interfaz segura, validada y libre de fricciones técnicas innecesarias.
