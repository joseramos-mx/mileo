---
name: mileo-platform
description: Construir e iterar la plataforma Mileo, el software de gestión de casos de RMS Zahnfacturing para laboratorio dental digital. Úsala siempre que se trabaje en cualquier pantalla, componente, endpoint o flujo de Mileo, o cuando se mencione portal del doctor, alta de casos, aprobación de diseño 3D, tablero de producción, comodato de escáner o puntos del mes, aunque no se nombre "Mileo" explícitamente. Contiene los objetivos de producto, el sistema de diseño, el stack, las reglas de UX y accesibilidad, y el loop de iteración que se repite hasta que cada objetivo pasa sus criterios de aceptación.
---

# Mileo — plataforma de casos

Mileo es el producto de software de **RMS Zahnfacturing**, un laboratorio dental digital en Durango, México. El dentista escanea con el equipo que ya tiene, sube los archivos a Mileo, sigue su caso, aprueba el diseño en 3D y habla con su técnico. Por dentro, el laboratorio corre su producción en la misma plataforma.

Mileo **no** compite con software de escaneo. Es agnóstico de marca: recibe STL, PLY, OBJ, DICOM y ZIP vengan de donde vengan. Esa es su única ventaja estructural frente a 3Shape, Medit, Straumann y Dandy.

---

## 0. Cómo trabajar con esta skill

Se trabaja en loop. No se avanza al siguiente objetivo hasta que el actual pasa **todos** sus criterios de aceptación.

```
1. LEER      El objetivo actual (§3) y sus criterios de aceptación.
2. PLANEAR   Escribir en 5 líneas qué se va a construir y qué pantallas toca.
3. CONSTRUIR Implementar con el stack (§4) y el sistema de diseño (§5).
4. AUDITAR   Correr la lista de §10 punto por punto. Sin saltarse ninguno.
5. CORREGIR  Arreglar todo lo que falló.
6. REPETIR   Volver al paso 4 hasta que la auditoría salga limpia.
7. ENTREGAR  Marcar el objetivo como cumplido y pasar al siguiente.
```

Reglas del loop:

- **Nunca se declara terminado un objetivo con criterios pendientes.** Si un criterio no se puede cumplir, se escribe por qué y se escala al Product Owner. No se omite en silencio.
- **Máximo 3 vueltas de auditoría por objetivo.** Si a la tercera sigue fallando lo mismo, el problema es de diseño, no de código: parar y escalar.
- **Cada objetivo termina con algo que un doctor real puede usar.** Nada de trabajo invisible acumulado.
- Si se detecta una mejora al diseño entregado, **proponerla e implementarla**, dejando nota de qué cambió y por qué. El diseño inicial es punto de partida, no contrato.

---

## 1. Quiénes usan Mileo

| Rol | Qué viene a hacer | Dispositivo real |
|---|---|---|
| **Doctor** | Ver si algo lo espera, aprobar diseños, saber qué día llega su caso | Celular entre pacientes |
| **Asistente de la clínica** | Dar de alta el caso y subir archivos | Celular, de pie, a veces con guantes |
| **Admisión (lab)** | Revisar que el caso venga completo y aceptarlo | Escritorio |
| **Diseño / Manufactura / Acabado** | Su bandeja de pendientes del día | Escritorio o pantalla de taller |
| **Calidad** | Fotos de verificación y checklist de empaque | Celular |
| **Dirección** | Entregas a tiempo, rehacer, rentabilidad por doctor | Escritorio |

El equipo del laboratorio son **4 personas** que rotan de rol. Los permisos deben existir desde el inicio aunque hoy no se usen.

---

## 2. Las tres verdades del producto

Todo lo que se construya debe servir a una de estas:

1. **El doctor debe saber en 5 segundos qué le toca a él y qué día llega su caso.** Si necesita abrir algo para averiguarlo, la pantalla está mal.
2. **Nada se fabrica sin aprobación registrada del doctor.** Es la protección legal y comercial del laboratorio.
3. **Avisar un retraso antes de que ocurra vale más que evitarlo.** Es la queja número uno de la industria y la conversión más barata de falla en confianza.

---

## 3. Objetivos de producto

### MVP — no se lanza piloto sin esto completo

**O-0 · Fundación**
- Ambientes de desarrollo y producción separados.
- Modelo de datos donde un **caso** contiene múltiples **unidades**, cada una con tipo, material y número de diente.
- Cada cambio de estado se registra con usuario y timestamp, en bitácora inmutable.
- Respaldo diario automático, con una restauración probada antes de cerrar.

*Aceptación:* se puede crear un caso de 3 unidades con materiales distintos; la bitácora muestra cada cambio; una restauración de respaldo recupera archivos.

**O-1 · Cuentas y acceso**
- Alta **solo por invitación** del laboratorio. No existe registro abierto.
- El doctor puede invitar asistentes. La asistente sube y consulta pero no aprueba diseños ni ve facturación.
- Roles internos diferenciados (admisión, diseño, manufactura, acabado, calidad, dirección).
- Aviso de privacidad aceptado al primer ingreso, con fecha y versión registradas.

*Aceptación:* un doctor no ve casos de otro; una asistente no puede aprobar; el aviso queda registrado.

**O-2 · Alta de caso**
- Formulario en cascada: **indicación → diente → tipo → material → color**. Ese orden exacto.
- Odontograma clickeable. Nunca campo de texto libre para el diente.
- Paciente por folio e iniciales obligatorio; nombre completo opcional.
- Subida arrastrando: STL, PLY, OBJ, DICOM, ZIP. Barra de progreso por archivo y **reanudación** si falla, nunca reinicio.
- Checklist de admisión que bloquea el envío si falta antagonista, registro de mordida o el tipo de trabajo.
- Enlace visible a la guía de exportación de la marca de escáner del doctor.
- Guardado automático de borrador.

*Aceptación:* una asistente sube 400 MB de DICOM desde un celular, pierde señal a la mitad, y la subida se reanuda sin perder lo capturado.

**O-3 · Seguimiento y avisos**
- Estados visibles: Recibido, En revisión, Aceptado, En diseño, Esperando su aprobación, En fabricación, En control de calidad, Listo y en camino, Entregado. Más dos de excepción: En pausa y Rehacer.
- Todo el detalle interno (anidado, fresado, sinterizado) se colapsa en **En fabricación**.
- El reloj de la fecha comprometida arranca al **aceptar**, no al subir.
- Notificación por correo y WhatsApp en cada cambio, máximo una por etapa, configurable por el doctor.
- **Aviso automático de riesgo de retraso** con nueva fecha y motivo, antes de la fecha comprometida.

*Aceptación:* al exceder el tiempo estándar de una etapa, el caso se marca en riesgo y sale el aviso sin intervención humana.

**O-4 · Aprobación de diseño (pantalla estrella)**
- Visor 3D en navegador, sin instalar nada, que **abre en menos de 10 segundos en celular**.
- Se sirve una malla ligera derivada, nunca el archivo original.
- Dos botones: aprobar y solicitar ajuste. Comentario obligatorio al solicitar ajuste.
- **Bloqueo duro:** el caso no puede pasar a fabricación sin aprobación registrada.
- Recordatorio a las 24 y 48 h; si no hay respuesta, el caso se marca en riesgo y la fecha se recorre con aviso.
- Chat anclado al caso, con adjuntos de imagen y el técnico asignado visible con nombre y foto.

*Aceptación:* en un celular de gama media con red móvil, el visor carga bajo 10 s y gira con el dedo sin trabarse.

**O-5 · Producción interna**
- Tablero por etapas con arrastre entre columnas, filtros por doctor, fecha y prioridad.
- Asignación por etapa y persona; cada quien tiene su bandeja del día ordenada por urgencia, con un solo botón de terminar etapa.
- Vista **"requiere atención"** que cruza fecha comprometida contra etapa actual. Es la primera pantalla de la mañana.

*Aceptación:* mover una tarjeta en el tablero actualiza en tiempo real el estado que ve el doctor.

**O-6 · Calidad y envío**
- Mínimo 2 fotos obligatorias antes de enviar: ajuste y color. Sin fotos, no se puede marcar como enviado.
- Checklist de kit completo configurable por tipo de trabajo (pieza, tornillo, desarmador, análogo, hoja de caso).
- El sistema **impide** que el mismo usuario cierre diseño y calidad del mismo caso; saltarlo requiere autorización de dirección y queda registrado.
- Número de guía y enlace de rastreo en el caso.

*Aceptación:* intentar enviar sin fotos o con el checklist incompleto es imposible desde la interfaz y desde la API.

**→ Aquí se lanza el piloto con 3 doctores. No se construye más hasta tener sus comentarios.**

### Después del piloto

**O-7 · Rehacer y capacidad** — Rehacer como caso hijo ligado al original, con causa raíz clasificada (escaneo, diseño, manufactura, acabado, envío, criterio del doctor), prioridad máxima en cola y costo estimado. Capacidad configurable por etapa en unidades/día; el sistema propone fecha según cola y alerta al superar 90%.

**O-8 · Comodato y precios** — Puntos en tiempo real con barra de avance, meta y días restantes, más la frase de qué caso completaría la meta. Tabla de puntos editable calibrada por margen, con tope de 25% desde categorías de bajo valor. Avisos el día 15 y 22. Listas de precios por doctor y precio visible **antes** de enviar el caso.

**O-9 · Dinero y escala** — Estado de cuenta mensual que incluye el desempeño del laboratorio con ese doctor (% a tiempo, rehacer). Un adeudo **nunca** detiene casos ni genera bloqueo automático: solo alerta a dirección. Rentabilidad por comodato. Entrada de casos por WhatsApp que aterriza en la plataforma.

**O-10 · Diferenciación** — Perfil de preferencias de diseño por doctor (anatomía, contactos, oclusión, espesor, color habitual) visible al abrir el caso. Compartir con el paciente por PIN temporal, solo lectura, sin cuenta. Políticas de retención y borrado de archivos de paciente. Capacidad por etapa para dirección.

**O-11 · Automatización** — Revisión automática del escaneo al subir: mallas cerradas, antagonista presente, unidades correctas, conteo de triángulos. Avisa al doctor en minutos, en lenguaje clínico simple. Agente de WhatsApp para admisión y cotización 24/7. Detección de doctores inactivos a 45 días.

---

## 4. Stack

| Capa | Herramienta | Notas |
|---|---|---|
| Framework | **Next.js** (App Router, Server Components por defecto) | `'use client'` solo donde haya interacción real |
| Estilos | **Tailwind CSS** | Tokens semánticos, nunca hex sueltos en el JSX |
| Tipografía | **Plus Jakarta Sans** | Vía `next/font`, self-hosted |
| Iconos | **Phosphor Icons** | Peso `regular` en UI, `fill` solo en estado activo |
| Animación | **GSAP** | Ver §5.5. Sutil o nada |
| 3D | **Three.js** (vía react-three-fiber) | Ver §9 |
| Componentes | **Sileo** ⚠️ | *El PO debe confirmar a qué librería se refiere; no corresponde a un paquete conocido. Hasta que se confirme, usar componentes propios sobre Tailwind, o shadcn/ui si el PO lo aprueba.* |

Reglas: TypeScript estricto. Validación de esquemas en el borde (entrada de formularios y API). Nada de estado global si `useState` y props resuelven. Subidas grandes por partes con reintento.

---

## 5. Sistema de diseño

### 5.1 Color

Escala perceptual generada desde el azul de marca, tono fijo 259°.

```
--azul-50  #F0F6FF   --azul-500 #4B91FF   --azul-900 #003A8B
--azul-100 #E0ECFF   --azul-600 #1975F9 ← marca
--azul-200 #C3DBFF   --azul-700 #005FDB   --azul-950 #012661
--azul-300 #A0C5FF   --azul-800 #004DB4
--azul-400 #77ACFF

--neutro-50  #F7FAFF   --neutro-500 #8F949D   --neutro-900  #1D2126
--neutro-100 #E7EBF2   --neutro-600 #787E86   --neutro-950  #161A1F
--neutro-200 #D5D9E0   --neutro-700 #646971   --neutro-975  #090C11
--neutro-300 #C0C4CA   --neutro-850 #3C4148
--neutro-400 #A8ACB2
```

Los neutros llevan una pizca del mismo tono. No sustituir por grises puros.

**Tokens por rol** (así se nombran en el código, nunca `azul-600`):

| Token | Oscuro | Claro |
|---|---|---|
| `bg-app` | neutro-975 | neutro-50 |
| `surface` | neutro-950 | blanco |
| `border` | neutro-900 | neutro-200 |
| `text-primary` | neutro-100 | neutro-900 |
| `text-secondary` | neutro-400 | neutro-600 |
| `action-primary` | azul-600 | azul-700 |
| `text-accent` (enlaces) | **azul-400** | azul-700 |

⚠️ El azul-600 **solo** como relleno con texto blanco encima. Para texto o enlaces sobre fondo oscuro, azul-400. El azul de marca sobre negro no alcanza contraste de texto.

**Semánticos, solo dos:** ámbar `#F5A623` = le toca al doctor. Verde `#34C759` = terminado. **No se agregan más colores.** La sensación de limpieza viene de los colores que no están.

**Temas:** claro por defecto, oscuro como interruptor del usuario. Excepción no negociable: **toda pantalla donde se juzgue color o se vea una foto de la pieza va sobre fondo neutro claro**, sin importar el tema activo. El visor 3D y las fotos de calidad siempre claros.

### 5.2 Tipografía
Plus Jakarta Sans. Escala: 24/19/17/15/13/12 px. Pesos 400, 500, 600. Nunca más de 3 tamaños en una misma pantalla.

### 5.3 Espaciado y forma
Múltiplos de 4. Radios: 8 px controles, 12 px tarjetas, 16 px contenedores. Bordes de 1 px con `border`, nunca sombras pesadas.

### 5.4 Componentes base (construir primero, antes de más pantallas)
`CaseCard`, `StatusChip`, `Button`, `Field`, `FileDropzone`, `EmptyState`, `ImagePlaceholder`, `ToothChart`, `Viewer3D`.

Una sola versión de cada uno en todo el sistema. Si una pantalla necesita una variante, se agrega como prop, no como copia.

### 5.5 Movimiento (GSAP)
- 150–250 ms. Nada más lento.
- Solo para: entrada de listas escalonada, cambio de estado de una tarjeta, apertura de paneles, progreso de subida.
- **Nunca** animar el texto de la interfaz, ni los datos clínicos, ni la carga de un caso.
- Respetar `prefers-reduced-motion`: con esa preferencia activa, todo aparece sin transición.
- Si una animación retrasa que el doctor vea su información, se elimina.

---

## 6. Reglas de UX

1. **Una acción principal por pantalla.** Un solo elemento con relleno azul. Todo lo demás es texto o borde.
2. **Celular primero en tres pantallas:** alta de caso, aprobación de diseño y calidad. Se usan de pie, con prisa, a veces con guantes. El resto puede ser escritorio primero.
3. **La fecha siempre a la vista**, en formato doble: día exacto más días restantes ("Jue 3 sep · en 3 días").
4. **Cero jerga interna** frente al doctor. Nada de anidado, sinterizado, malla, triángulos, upload, status o preview.
5. **Errores que dicen qué hacer.** No "archivo inválido", sino "falta el escaneo del antagonista, súbalo aquí".
6. **Nunca perder trabajo.** Borradores automáticos y subidas reanudables.
7. **Estados vacíos que enseñan.** La primera vez que entra un doctor no tiene casos: esa pantalla debe enseñarle a subir el primero con la guía de su escáner a la mano. Nunca "sin resultados".
8. **Confirmación visible** después de subir, aprobar y enviar. La duda genera llamadas.
9. **Salidas siempre disponibles:** salir, regresar, ayuda y chat. Nadie se siente atrapado a media captura.
10. **El home no es un tablero**, es una bandeja de pendientes. Métricas de vanidad fuera; lo que requiere acción del doctor arriba.
11. **Consistencia sobre creatividad.** El doctor aprende un patrón de tarjeta una sola vez.

**Prueba de jerarquía:** una captura en escala de grises debe seguir dejando claro qué es botón, qué es chip de estado y qué es texto secundario. Si se aplana, hay demasiada información cargada en el color.

---

## 7. Accesibilidad — obligatoria, no opcional

Los usuarios incluyen dentistas mayores con presbicia y astigmatismo, en consultorios con mucha luz.

- **WCAG 2.2 nivel AA.** Contraste mínimo 4.5:1 texto normal, 3:1 texto grande y elementos de interfaz.
- Área táctil mínima **44×44 px**.
- Todo operable con teclado, en orden lógico, con foco **visible** (anillo de 2 px con `azul-400`).
- HTML semántico y landmarks. Los iconos de Phosphor llevan `aria-hidden` cuando son decorativos y etiqueta accesible cuando son el único contenido de un botón.
- El color **nunca** es el único portador de información: cada chip de estado lleva texto.
- Formularios con `<label>` real asociado; errores anunciados con `aria-live`.
- Cambios de estado del caso anunciados en región `aria-live="polite"`.
- El visor 3D necesita alternativa: descripción textual del caso y descarga del archivo.
- Zoom hasta 200% sin romper el layout.
- Respetar `prefers-reduced-motion` y `prefers-color-scheme`.

Auditar con axe o Lighthouse en cada objetivo. Cero violaciones críticas o serias antes de dar por terminado.

---

## 8. Voz y contenido

- Todo en **español de México**. Ni una etiqueta en inglés en la interfaz. Revisar acentos ("escáner", "estándar").
- **De usted** al doctor. Frases cortas para que no suene acartonado.
- Mileo habla en primera persona en avisos del sistema ("Ya recibí su caso"). Las personas firman con su nombre y foto. **Mileo nunca finge ser una persona.**
- Vocabulario fijo: **caso**, **unidad**, **etapa**, **mi bandeja**, **aprobación**, **solicitar ajuste**, **rehacer**, **control de calidad**, **kit**, **meta del mes**, **puntos**, **fecha de entrega**. Estas palabras van igual en el código, en la base de datos y en pantalla.
- Prohibido: orden, pedido, estatus, cola, rechazar, remake, ETA, cuota, mínimo.
- Cada mensaje dice qué sigue y cuándo, con fecha concreta. Nada de "pronto" ni "a la brevedad".
- Nunca culpar al doctor: "me falta el antagonista", no "usted no subió el antagonista".
- Botones con verbo: "Entrar", "Crear caso", "Aprobar". Nunca "Enviar" genérico ni "Submit".

---

## 9. Imágenes y 3D

**Regla dura: no se recrean imágenes con CSS, HTML ni SVG.** Nada de dientes, coronas, escáneres o guías dibujados a mano en código. Se usa el componente `ImagePlaceholder`, que recibe proporción y una etiqueta describiendo qué va ahí, y renderiza un bloque neutro con borde punteado:

```tsx
<ImagePlaceholder ratio="1/1" label="Render de corona de zirconio" />
```

El equipo de diseño reemplaza esos bloques con renders reales generados desde los STL del laboratorio. Hasta entonces, el placeholder se queda visible.

**Visor 3D:**
- Fondo **neutro claro siempre**, sin importar el tema.
- Malla ligera derivada, no el archivo original.
- Presupuesto: primer render bajo 10 s en celular de gama media con red móvil.
- Controles de órbita con inercia suave; nada de auto-rotación permanente.
- Estado de carga con progreso real, no un giro indeterminado.
- Liberar geometrías y texturas al desmontar.

---

## 10. Auditoría antes de dar por terminado

Correr entera, sin saltarse puntos, en cada vuelta del loop.

- [ ] Todos los criterios de aceptación del objetivo pasan.
- [ ] Probado con un caso real del laboratorio de principio a fin.
- [ ] Funciona en celular, incluidas las tres pantallas críticas.
- [ ] Cero violaciones críticas o serias de accesibilidad (axe o Lighthouse).
- [ ] Contraste verificado en tema claro **y** oscuro.
- [ ] Navegable completo con teclado, con foco visible.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Cero texto en inglés y cero jerga interna en la interfaz.
- [ ] Vocabulario de §8 respetado en pantalla, código y base de datos.
- [ ] Ningún hex suelto: solo tokens semánticos.
- [ ] Ninguna imagen recreada con CSS o SVG; placeholders donde falten assets.
- [ ] Estados vacío, de carga y de error diseñados, no improvisados.
- [ ] Sin regresiones en objetivos anteriores.
- [ ] Desplegado en producción. Una historia que solo vive en desarrollo no está terminada.

---

## 11. Antipatrones

- Construir O-7 en adelante antes de que el piloto de 3 doctores dé comentarios.
- Dashboards con métricas que el doctor no puede accionar.
- Un cuarto color "porque se ve bien".
- Recrear fotos de producto en CSS.
- Notificar diez veces por caso hasta que el doctor apaga los avisos.
- Exponer etapas internas de manufactura al doctor.
- Bloquear casos por temas de facturación.
- Suponer que el doctor tiene computadora abierta. Tiene un celular y un paciente esperando.
- Dejar el visor 3D sobre fondo oscuro.
- Copiar componentes en lugar de agregar variantes.

---

## 12. Pendientes para el Product Owner

Preguntar antes de asumir:

1. ¿A qué librería se refiere **"Sileo"** en el stack?
2. ¿Backend y base de datos elegidos? ¿Dónde viven los archivos de paciente y bajo qué política de retención?
3. ¿Proveedor de WhatsApp Business API?
4. ¿Tabla de puntos definitiva por producto y meta mensual del comodato?
5. ¿Tiempos estándar por etapa, para calcular fechas comprometidas y disparar avisos de riesgo?
6. ¿Marcas de escáner a cubrir en las guías de exportación del primer día?
