# Auditoría UX: Motor de Navegación Guiada Boustrophedon y Encuadre Cinemático de Viñetas (Sprint 68)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la experiencia de lectura guiada viñeta a viñeta (*panel-by-panel / Boustrophedon*), prevención de cinetosis, usabilidad en pantallas 1366x768 y modo de lectura manos libres.

---

## 1. Prevención de Mareo Cinético (Motion Sickness)
Cuando un visor web realiza acercamientos, paneos y saltos automáticos de una viñeta a otra, existe un riesgo real de causar fatiga visual y mareo si las transiciones son abruptas.
* **Curvas de Aceleración Suaves:** El motor Boustrophedon y el encuadre cinemático deben evitar saltos lineales o cortes secos. Se requiere el uso de curvas de interpolación amortiguadas (*easeInOutCubic* o *GSAP power2.inOut*) con duraciones óptimas (aprox. 350-500ms) para que el ojo humano acompañe el paneo de forma natural sin desorientarse.

---

## 2. Experiencia en Pantallas Pequeñas (1366x768 / Pentium T4500)
En portátiles compactas, el tamaño físico de la pantalla limita la visibilidad simultánea de los detalles del manga.
* **Encuadre Dinámico:** El modo guiado maximiza automáticamente la viñeta activa para ocupar el alto o ancho útil del monitor, permitiendo leer los bocadillos de diálogo más pequeños con total nitidez sin necesidad de realizar zoom manual constante.

---

## 3. Flujo "Manos Libres" (Auto-Pacing para Lectura Activa/Descanso)
* **Utilidad:** Ideal para lectores que disfrutan de un aperitivo o realizan estiramientos/ejercicio mientras leen.
* **Ergonomía:** El avance automático basado en temporizadores adaptativos (calculados según la cantidad de texto OCR en la viñeta actual) permite una lectura fluida y sin tocar el teclado ni el ratón. Un indicador sutil de progreso circular en una esquina avisa cuándo cambiará la viñeta.

---

## 4. Transiciones Entre Páginas y Fin de Capítulo
* **El Reto:** Al llegar a la última viñeta de una página, el salto a la página siguiente puede romper la continuidad si el usuario no recibe aviso.
* **Solución UX:** Un indicador visual translúcido o una animación de pulso sutil en el borde de la viñeta final indica claramente: *"Próxima viñeta: Siguiente página / Capítulo"*, preparando mentalmente al lector para el cambio de lienzo.
