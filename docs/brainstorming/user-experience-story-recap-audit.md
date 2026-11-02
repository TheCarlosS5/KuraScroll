# Auditoría UX: Story Recap Engine y Cajón Catch-Up

**Fecha:** 2 de Noviembre de 2026  
**Autor:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de usuario en el motor de resúmenes argumentales automáticos (`Story Recap Engine`) y el cajón de puesta al día (`Catch-Up Drawer`).

---

## 1. El Dilema del Recap: ¿Cuándo es bienvenido y cuándo arruina la inmersión?
Para un lector de manga y manhwa, la continuidad narrativa es sagrada. Un resumen inoportuno puede romper por completo el ritmo de lectura.

* **El Escenario Molesto (Binge Reading / Maratón):** Si Carlos está leyendo 20 capítulos seguidos en una sola tarde, mostrarle un resumen al abrir el capítulo siguiente es **altamente molesto e intrusivo**, ya que él ya tiene todo el contexto fresco en la memoria.
* **El Escenario Salvavidas (Regreso tras ausencia):** Si Carlos abre una serie que no leía desde hace 2 semanas o más, ha olvidado detalles clave de la trama (quién era el antagonista actual, en qué estado quedó el protagonista). Aquí, un resumen conciso es un **salvavidas indispensable**.

---

## 2. Gobernanza de la Lógica de Activación (Trigger Logic)
Para evitar falsos positivos molestos, el motor de recapitulación no debe ser agresivo.

* **Condición Temporal Automática:** El recap automático **solo** debe dispararse si la última sesión de lectura de esa serie ocurrió hace **más de 14 días (2 semanas)**.
* **Acceso Manual Garantizado:** Independientemente del tiempo transcurrido, debe haber un botón discreto en el menú HUD del lector: *"📜 Ver Resumen de la Historia (Catch-Up)"*, para que el usuario pueda consultarlo voluntariamente en cualquier momento si se siente perdido.

---

## 3. Control Absoluto del Usuario (Configuración y Notificaciones)
Cada lector tiene preferencias distintas sobre cómo quiere recibir los resúmenes.

* **Interruptor Maestro:** Opción clara en la configuración de lectura: `[X] Mostrar resúmenes automáticos de historia tras ausencias prolongadas`.
* **Modo de Notificación (Auto-Open vs. Badge Discreto):**
  - *Evitar modales bloqueantes:* En lugar de abrir una ventana emergente que obligue al usuario a hacer clic para cerrar, el cajón Catch-Up debe desplegarse suavemente como una barra lateral o tarjeta colapsable en la parte superior, o bien mostrar un badge sutil en el HUD: `💡 Resumen disponible (hace 15 días)`. El lector decide si lo lee o lo ignora deslizando hacia abajo.

---

## Conclusión y Recomendación
El Story Recap Engine es una característica excelente para obras con tramas complejas (como seiyus, fantasía épica o misterio), siempre que su activación esté estrictamente gobernada por el umbral de tiempo (14+ días) y se entregue mediante un cajón lateral no intrusivo y opcional.
