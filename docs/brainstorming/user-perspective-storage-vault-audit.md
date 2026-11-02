# Auditoría UX: Motor de Cuota y Evicción Inteligente de Capítulos Offline (Storage Vault & Quota Arbiter) (Sprint 72)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación del sistema de gestión de almacenamiento offline, políticas de evicción automática (*LRU*), blindaje de capítulos activos y controles de fijación (*Pinning*).

---

## 1. Tranquilidad Mental y el Blindaje del Capítulo Activo
Para un lector offline (en el metro o sin conexión), el peor desastre es abrir la app y descubrir que el sistema de limpieza automática eliminó el capítulo exacto que estaba a punto de leer.
* **La Invariante Sagrada de KuraScroll:** El capítulo activo actual y los últimos 2 capítulos leídos **están blindados permanentemente** contra cualquier purga o evicción automática del sistema de almacenamiento, garantizando tranquilidad absoluta al usuario.

---

## 2. Claridad en el Estado Offline (Indicadores Visuales)
El lector debe saber con absoluta certeza qué contenido está disponible sin conexión antes de embarcarse en un viaje o salir de casa.
* **Badges de Disponibilidad:** Cada capítulo en la lista de la serie muestra un indicador claro y minimalista:
  - 📥 *Descargado y disponible offline*
  - 📌 *Fijado permanentemente (Pinned)*
  - ☁️ *Requiere conexión*
* **Gestor de Almacenamiento (Storage Vault View):** Un panel limpio en los ajustes que muestra cuánto espacio ocupa la biblioteca, el porcentaje de cuota utilizado y una barra de desglose por series.

---

## 3. Control Absoluto del Usuario (Pinning / Fijar Capítulos)
* **La Última Palabra:** Aunque el sistema utilice un algoritmo LRU (*Least Recently Used*) para limpiar capítulos antiguos cuando la cuota de almacenamiento local esté al límite, **el botón de fijar (Pin 📌)** otorga al usuario inmunidad total sobre sus mangas favoritos. Ningún capítulo fijado será borrado jamás sin una orden manual explícita de descarte.

---

## Conclusión
El sistema de cuotas y evicción del Sprint 72 protege la tranquilidad del lector mediante reglas de blindaje estrictas, indicadores offline transparentes y el poder absoluto del Pinning de usuario.
