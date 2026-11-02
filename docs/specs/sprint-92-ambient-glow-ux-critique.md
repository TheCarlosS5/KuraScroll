# Auditoría UX: Motor de Dispersión de Brillo Ambiental Adaptativo y Sangrado de Luz Perimetral (Sprint 92)

**Fecha:** 2 de Noviembre de 2026  
**Author:** Auditor Jefe de Experiencia de Usuario (KuraScroll)  
**Contexto:** Evaluación de la inmersión del sangrado de luz perimetral (*border bleed*), la transición dinámica entre escenas diurnas y nocturnas, la prevención de distracciones en los diálogos y la optimización del modo `dark_monochrome_dim` para manga en blanco y negro (*Berserk*, *Tokyo Ghoul*).

---

## 1. Transiciones Dinámicas: De Páginas Diurnas a Cielos Nocturnos en Manhwa
El sangrado de luz perimetral (*Ambient Glow*) extiende sutilmente los colores dominantes de los bordes de la página hacia el marco de la pantalla, creando un efecto de pantalla ambilight integrada.
* **Impacto en la Transición:** Cuando el lector pasa de una viñeta diurna muy luminosa a una escena nocturna o de mazmorra oscura, el resplandor perimetral se desvanece suavemente a un tono azul oscuro o negro carbón. Esto evita el contraste violento entre el monitor y la oscuridad de la habitación, haciendo que la transición narrativa se sienta viva y envolvente.

---

## 2. Prevención de Distracción y Fatiga en Habitaciones a Oscuras
* **Protección del Foco de Lectura:** El brillo perimetral nunca debe ser intrusivo ni competir con los globos de diálogo centrales. 
* **Regla Ergonómica:** El motor limita la intensidad máxima del brillo ambiental y aplica un desenfoque (*blur*) profundo, asegurando que la luz circundante actúe como un cojín óptico relajante y no como un foco molesto en la visión periférica.

---

## 3. Evaluación del Modo `dark_monochrome_dim` para Manga Clásico (*Berserk*, *Tokyo Ghoul*)
En obras monocromáticas de fantasía oscura con abundante tinta negra, un resplandor ambiental de colores vivos rompería por completo la atmósfera lúgubre.
* **El Modo Monocromático:** El perfil `dark_monochrome_dim` restringe el sangrado perimetral a tonos grises neutros muy atenuados o carbón, armonizando a la perfección con el estilo sombrío y tétrico de estas obras maestras sin generar distracciones innecesarias.

---

## Conclusión
El motor de dispersión de brillo ambiental del Sprint 92 aporta una capa inmersiva de cine en casa al visor de KuraScroll, calibrada con precisión para proteger la vista a oscuras y respetar la estética de las obras en blanco y negro.
