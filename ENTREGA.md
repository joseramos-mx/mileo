# Entrega de Mileo

Estado del MVP frente a [`SKILL.md`](./SKILL.md), qué se le cambió al diseño
entregado y por qué, y qué está esperando decisión suya.

Todo lo que dice "cumplido" tiene una prueba que lo demuestra y que usted puede
volver a correr con `npm run auditar`.

---

## 1. Los objetivos

### O-0 · Fundación — **cumplido**

| Lo que pedía | Cómo quedó |
|---|---|
| Ambientes separados | `mileo_dev` y `mileo_prod`: base, almacén de archivos y secreto de sesión distintos, elegidos con `MILEO_AMBIENTE` |
| Un caso con varias unidades | `Caso` → `Unidad` con diente, tipo y material |
| Bitácora inmutable con usuario y fecha | La base **rechaza** UPDATE, DELETE y TRUNCATE sobre `EventoBitacora`, y el rol de la aplicación ni siquiera tiene esos permisos. Cada evento se encadena por hash con el anterior |
| Respaldo diario con restauración probada | `npm run respaldo` / `npm run restaurar`, con manifiesto de sha256 |

**La prueba:** se borró la base entera y todos los archivos, y se restauró: 183
registros en 9 tablas, 40 archivos con el mismo sha256 y la cadena de hash
íntegra. `npm run verificar:bitacora` además intenta un UPDATE, un DELETE y un
TRUNCATE, y comprueba que los tres fallan.

### O-1 · Cuentas y acceso — **cumplido**

Alta sólo por invitación: no existe registro abierto. La invitación se genera,
se encola para su envío y se acepta en `/invitacion/<token>`, donde nace la
cuenta; el vale se marca usado en la misma transacción, así que no sirve dos
veces. El doctor invita asistentes; la asistente sube y consulta pero no aprueba
diseños ni ve facturación. Los seis roles internos existen desde el inicio. El
aviso de privacidad se acepta al primer ingreso y queda con fecha y versión.

> Falta que el correo **salga de verdad**: ver §12.3 abajo. Mientras tanto, la
> pantalla le muestra el enlace de la invitación para que usted se lo pase.

### O-2 · Alta de caso — **cumplido**

Cascada en el orden exacto: diente → tipo de trabajo → material → método →
color. La indicación ya no se pregunta al dar de alta el caso: era pedirle al
doctor que resumiera por adelantado lo que iba a capturar diente por diente, y
podía quedar en desacuerdo con lo capturado. Se deduce de las unidades, que son
el dato de verdad, y de ella sale el kit que va en la caja (§O-6). El
diente se escoge en el odontograma, nunca escribiéndolo. Paciente por folio e
iniciales; el nombre completo es opcional. Borrador guardado solo. Lista de
admisión que bloquea el envío si falta el antagonista, el registro de mordida o
el tipo de trabajo. Enlace a la guía de exportación por marca de escáner.

**La prueba (`npm run prueba:subida`):** 400 MB de DICOM, se corta la conexión a
la mitad, se reanuda desde el byte 210 763 776 —a media parte, no en el borde— y
el sha256 del archivo en el servidor es idéntico al del original. Ni un byte
perdido, ni uno repetido.

### O-3 · Seguimiento y avisos — **cumplido**, menos la entrega real

Las nueve etapas más las dos de excepción. Todo el detalle interno se colapsa en
"En fabricación": el doctor nunca ve anidado, fresado ni sinterizado. El reloj de
la fecha arranca al **aceptar**, no al subir.

`npm run vigilar` corre solo cada hora: marca en riesgo lo que se tardó más de su
tiempo estándar, recorre la fecha cuando el retraso ya es un hecho y encola el
aviso con la fecha nueva y el motivo. Máximo un aviso por etapa, garantizado por
una clave única: correrlo diez veces no manda diez mensajes.

**La prueba (`npm run prueba:avisos`):** un caso lleva 50 horas esperando
aprobación; sin que nadie toque nada, queda marcado en riesgo, salen el aviso y
los recordatorios de 24 y 48 horas, correr el vigilante tres veces no repite
ninguno, y ningún mensaje usa las palabras prohibidas de §8.

> **Lo que falta:** que el correo y el WhatsApp salgan. Ver §12.3.

### O-4 · Aprobación de diseño — **cumplido**

Visor 3D en el navegador, sin instalar nada. Se sirve una **malla ligera
derivada**, nunca el archivo original: Mileo lee el STL, une los vértices
repetidos, reduce sólo si hace falta y cuantiza las posiciones a 16 bits. Fondo
neutro claro siempre, aunque el doctor tenga el tema oscuro. Progreso real de
carga, órbita con inercia, sin rotación automática, y se libera la geometría al
salir. Alternativa para quien no pueda usarlo: la descripción del caso en texto y
la descarga del archivo.

Dos botones y nada más: aprobar y solicitar ajuste, con comentario obligatorio.
**Bloqueo duro:** sin aprobación registrada no se fabrica, ni desde la pantalla
ni desde la API. Recordatorios a las 24 y 48 horas. Chat anclado al caso.

Sencilla, con dos seguros. **Nadie aprueba lo que no vio:** hasta que el visor
no logra enseñar el diseño, el botón de aprobar está apagado y la pantalla dice
por qué. Si el visor no puede —un celular viejo, WebGL apagado— no se le cierra
la puerta: descarga el diseño, lo abre en su programa y lo dice con una casilla,
porque bloquearlo del todo dejaría sin aprobar a quien no puede usar el visor
(§7). Y **nadie aprueba un diseño que ya cambió:** la pantalla manda cuál está
mirando, y si el laboratorio mandó otro mientras tanto, el servidor se niega y
le pide volver a verlo.

**El retrato del diseño.** La misma pieza, dibujada una vez en el servidor y
servida como PNG, aparece en cada lugar donde se lista un caso: en la tarjeta
del inicio y en la miniatura de cada caso. Se dibuja sin GPU y sin biblioteca
—proyección, buffer de profundidad y normales por vértice, con la misma cámara,
la misma luz y el mismo color del visor—, en dos tamaños. Abrir un contexto
WebGL por tarjeta no era opción: el navegador tiene un tope de contextos vivos,
los tira cuando lo pasa, y una lista de doce casos acababa con cuadros en
blanco; además gastaba batería pintando algo que nadie iba a girar (§5.5). Con
el retrato, la lista de cien casos baja 246 kB en total.

**La prueba:** el visor abre en 1.9 s en un celular simulado, sobre fondo de
luminancia 0.98; sin aprobación el laboratorio no tiene a dónde mandar a
fabricar; el retrato se sirve como PNG y no se entrega sin sesión; y con la
malla cortada a propósito, el botón de aprobar no se puede pulsar hasta que el
doctor dice que lo revisó en su programa.

> Falta: adjuntar imágenes en el chat. El texto funciona.

### O-5 · Producción interna — **cumplido**

Tablero por etapas con arrastre entre columnas y filtros por doctor, fecha y
prioridad, que viven en la dirección de la pantalla para poder guardarla o
pasarla. "Mi bandeja" con un solo botón para terminar la etapa. "Requiere
atención" como primera pantalla de la mañana del laboratorio.

Mover una tarjeta actualiza en el momento lo que ve el doctor: el navegador del
doctor escucha los cambios de la bitácora y refresca solo. Y nunca lo hace
mientras alguien tiene un campo con el foco puesto: la pantalla no se mueve
debajo del dedo de quien está capturando.

> Falta: asignar un caso a una persona a mano. Hoy el técnico se asigna solo,
> cuando manda el diseño a aprobación.

### O-6 · Calidad y envío — **cumplido**

Dos fotos obligatorias antes de enviar: ajuste y color. Checklist de kit por tipo
de trabajo. Número de guía y enlace de rastreo. **El mismo usuario no puede
cerrar diseño y calidad del mismo caso**; saltárselo requiere el correo de
dirección y un motivo, y los dos quedan en la bitácora.

**La prueba:** sin fotos el botón está apagado; con fotos pero sin kit sigue
apagado; y mover la etapa a "Listo y en camino" no se ofrece siquiera mientras no
haya control de calidad cerrado —el servidor lo rechaza igual—. Quien diseñó el
caso intenta cerrar su propia calidad y se le impide; dirección lo autoriza, el
caso sale, y la autorización queda escrita con su motivo.

---

## 2. Lo que la auditoría encontró y se corrigió

Cuatro fallas reales que no se veían leyendo el código:

1. **El botón principal tenía el texto casi ilegible.** `tailwind-merge` no
   conocía nuestra escala, confundía `text-sobre-accion` (un color) con
   `text-cuerpo` (un tamaño) y borraba uno de los dos. El botón azul quedaba con
   texto oscuro encima: 2.8:1, muy por debajo del 4.5:1 que exige §7. Se le
   enseñaron las escalas a `tailwind-merge` (`src/lib/utilidades.ts`).

2. **El respaldo rompía la bitácora al restaurarla.** Las fechas pasaban por
   `Date` de JavaScript y se corrían por la diferencia horaria, y la función de
   hash dependía de la zona horaria de la sesión de Postgres. Un mismo evento
   daba hashes distintos según quién lo leyera. Se corrigieron las dos cosas y la
   restauración vuelve a dar la cadena íntegra.

3. **La barra de navegación de abajo tapaba contenido tocable.** Estaba pegada al
   pie y se encimaba sobre enlaces. Ahora el contenido tiene su propio
   desplazamiento dentro de la envolvente y la barra nunca se le encima.

4. **El formulario de calidad se vaciaba solo.** React reinicia el formulario
   después de una acción; si el servidor rechazaba el envío por falta de
   autorización, quien revisaba perdía las casillas del kit y la guía que ya
   había escrito. Ahora todo vive en estado y la acción recibe datos, no el
   formulario (§6.6, nunca perder trabajo).

---

## 3. Cambios al diseño entregado

`SKILL.md §0` pide proponer e implementar las mejoras, dejando nota de qué cambió
y por qué. Esto es lo que se cambió:

| Qué | Antes | Ahora | Por qué |
|---|---|---|---|
| Tema por omisión | claro | **oscuro** | El diseño entregado es oscuro. El claro queda como interruptor, y las pantallas donde se juzga color siguen forzadas a claro (§5.1) |
| `text-secondary` en tema claro | neutro-600 | **neutro-700** | Sobre blanco, neutro-600 da 4.1:1. §7 exige 4.5:1 |
| Relleno de acción en tema oscuro | azul-600 | **azul-700** | Blanco sobre azul-600 da 4.23:1. Con azul-700 son 5.7:1, y el botón sigue destacando 3.4:1 contra el fondo |
| Navegación en celular | barra pegada al pie | envolvente con desplazamiento propio | La barra pegada tapaba a medias los enlaces del final |
| Secciones de la navegación | Meta y Facturación | fuera | Son O-8 y O-9: después del piloto (§11) |
| Nombres de los componentes | `CaseCard`, `StatusChip`… | `TarjetaDeCaso`, `ChipDeEtapa`… | §8 manda que las palabras fijas se escriban igual en el código, la base y la pantalla |
| Chip de etapa | una sola línea | se parte | Con el texto al 200%, "Esperando su aprobación" desbordaba |
| Odontograma | arcada cortada | línea media y "deslice para ver el resto" | En el celular no cabe entera y parecía que faltaban dientes |

Y una decisión de comportamiento: la pantalla **no se actualiza sola mientras
alguien tiene un campo con el foco puesto**. La novedad se guarda y se aplica en
cuanto suelta el campo.

---

## 3.1 · La portada y el inicio, según el diseño entregado

El Product Owner entregó el diseño de las dos pantallas y las dos se
reconstruyeron para que coincidan.

**La portada** es una sola pantalla sin desplazamiento: el formulario a la
izquierda sobre fondo oscuro y, a la derecha, **un solo panel recortado** —
redondeado del lado izquierdo, a ras del borde derecho — con el carrusel de
fotos arriba y las marcas de escáner compatibles abajo, sobre blanco. Las
flechas del carrusel son botones de verdad: funcionan con teclado y anuncian el
cambio.

**El inicio** lleva la barra lateral negra con la marca, las seis secciones, los
enlaces de apoyo y la ficha del usuario al pie; arriba, la meta del mes, la
búsqueda y "Nuevo caso"; después el panel de bienvenida con el titular grande y
las tarjetas de categoría; y abajo, separada por una raya, la columna del
escáner y los diseños, y la columna de los casos en curso.

Tres cosas se hicieron distinto del dibujo, y aquí está el porqué:

| En el diseño | En Mileo | Por qué |
|---|---|---|
| Botón "Sign In" oscuro sobre fondo oscuro | Botón azul de acción | §6.1 pide una sola acción principal por pantalla, con relleno azul. Además, oscuro sobre oscuro no se lee como botón. Volverlo al dibujo es una línea |
| "Editar / Cancelar / Rehacer" en la tarjeta de diseño | "Ver el caso / Escribirle a su técnico" | Rehacer es O-7 y va después del piloto (§11). No se pinta un botón que no haría nada |
| "Meta" y "Facturación" con datos | Están en la navegación, y la pantalla dice que llegan después del piloto | Son O-8 y O-9. La barra de meta del mes sí es real: cuenta casos entregados contra la meta de la clínica |

### Los colores de estado

El diseño pide **un color por etapa** en los mosaicos del inicio —avión celeste
para "en camino", caja verde para "entregado", lupa para "en revisión"— y
**magenta** para separar "le mandé este diseño" de "aprobó este diseño".

§5.1 dice que sólo hay dos colores semánticos y §11 llama antipatrón a agregar
un cuarto "porque se ve bien". Éstos no son por gusto: distinguen estados y el
Product Owner los pidió expresamente. Se implementaron con una condición que sí
es de §7: **el color nunca va solo.** Cada tarjeta lleva, además del mosaico, la
pastilla con el nombre de la etapa escrito, y el mosaico va marcado como
decorativo para que un lector de pantalla no lo lea dos veces. Los colores viven
en `--mosaico-*` dentro de `globals.css`, en un solo lugar.

### El catálogo de trabajos, con 29 colores

El Product Owner pidió el catálogo con la misma estructura que exocad, el
programa con el que los técnicos ya trabajan: ocho categorías, veintinueve
tipos, y **cada tipo de su color** para que el diente se ilumine distinto según
lo que se le va a hacer.

Es la desviación más grande de §5.1, que sólo admite dos colores semánticos. Se
implementó porque el catálogo no es decoración: es el vocabulario del taller, y
obligar al técnico a traducirlo a "corona / póntico / carilla" cada vez que
captura un caso le mete errores. La condición, otra vez, es §7: **el color nunca
va solo.**

- Cada diente lleva su número escrito encima y un `aria-label` que dice el tipo
  completo: "Diente 15, segundo premolar superior derecho: póntico anatómico de
  disilicato de litio color A2".
- La pastilla escogida se marca con `aria-pressed`, no sólo con el relleno.
- La leyenda de abajo nombra por escrito cada color que el caso usa. Sólo los
  que usa: veintinueve renglones no los lee nadie.
- El diente se rellena con el color **rebajado** y se contornea con el color
  entero, para que el número siga leyéndose encima.

Los colores viven en `src/lib/trabajos.ts`, en una tabla, no en `globals.css`:
son un dato del catálogo, no roles de la interfaz. El rebajado no se guarda: se
mezcla contra el diente con `color-mix`, así que en tema claro sale un tinte
pálido y en oscuro uno profundo, del mismo dato. El guion que la genera
—`python scripts/generar-catalogo.py`— **se niega a escribir un color que no
llegue a 4.5:1** con el número en los dos temas, y `npm run prueba:odontograma`
lo vuelve a medir en pantalla con los colores que devuelve el navegador. Cuatro de los colores de exocad no
alcanzaban y se oscurecieron; en las pastillas sin escoger el color va en el
borde y en un cuadrito, nunca en la letra.

### No todo se asigna a un diente

Cada tipo de trabajo dice sobre qué va, y de eso depende cómo se captura:

| Alcance | Cómo se captura | Trabajos |
|---|---|---|
| Por diente | Un toque en el odontograma | Coronas, cofias, pónticos, incrustaciones, carillas, encerados, aditamentos, telescópicas, pilar de barra, mockup |
| Por tramo | Se unen dos o más dientes vecinos en el riel | Segmento de barra, subestructura con alivio, y el puente mismo |
| Por arcada | Un botón aparte, no un diente | Prótesis total, prótesis parcial, guarda oclusal, modelo |
| Contexto | Marca en el odontograma, sin unidad | Antagonista, diente vecino, omitir en el puente |

Es la razón por la que `Unidad.diente` dejó de ser obligatorio y apareció
`arcada`. Si todo se capturara con un toque en un diente, una guarda oclusal
acabaría colgada de un premolar cualquiera y el taller la fabricaría creyendo
que va ahí.

Por lo mismo, `Puente` pasó a llamarse `Tramo`: un puente es sólo uno de los
tres trabajos que van sobre dos o más dientes unidos.

### El paso 2, en dos pestañas

El odontograma y las arcadas **siguen el tema**. La excepción de §5.1 —fondo
claro pase lo que pase— es para donde se juzga color: el visor 3D y las fotos de
control de calidad, que siguen forzados. Aquí el tono se escoge de una lista de
Vita, no a ojo, y un dibujo blanco sobre negro deslumbra al capturar de noche en
el consultorio. Los valores del tema oscuro son el espejo de los del claro: cada
par guarda la misma razón de contraste o mejor, y la prueba mide las dos.

**Dientes** lleva el odontograma: lo que se pone diente por diente y los tramos.
**Arcadas** lleva el dibujo de maxilar y mandíbula que entregó diseño
(`public/mandibles.svg`) y lo que va sobre una arcada entera: prótesis total,
prótesis parcial, guarda oclusal, modelo y la marca del antagonista.

Cambiar de pestaña no borra nada: los dos paneles se quedan montados y el estado
de las unidades es uno solo, arriba de las dos. Cada pestaña dice cuántas
lleva —"Dientes (7)"—, y la tabla de abajo las junta todas.

En Arcadas, los dientes que ya llevan trabajo se pintan en gris. No es adorno:
son los que el doctor ya resolvió en la otra pestaña, y verlos evita que pida
una prótesis total sobre una arcada donde acaba de pedir cuatro coronas.

Con teclado son una parada de tabulador y las flechas; en pantalla angosta las
pestañas se vuelven un selector segmentado, nunca un menú desplegable: esconder
una de dos opciones detrás de un menú le cobra un toque de más a quien captura
de pie y con prisa (§6.2).

**El antagonista cambió de alcance.** Se marcaba diente por diente y ahora se
marca por arcada: es la arcada opuesta entera lo que se escanea, y pedirlo
catorce veces para decir una cosa no tenía sentido. Sigue siendo una anotación
—no se fabrica, no se cotiza, no suma puntos—, lo que prueba que el alcance y
"ser una pieza" son dos cosas distintas: en el catálogo son dos campos.

**Una limitación del dibujo, dicha y no escondida.** De frente no se ven los
terceros molares, así que `mandibles.svg` trae siete dientes por cuadrante. Si
el caso lleva trabajo en un 18, 28, 38 o 48, la pantalla lo dice con palabras
debajo del dibujo en vez de callarlo.

### Cada trabajo pregunta lo suyo

El catálogo dice qué campos abre cada tipo, y **un campo que no aplica no se
enseña apagado: no se enseña** (§6.5). Enseñar un "Color" gris en una cofia, que
va cubierta, es prometerle al doctor una decisión que no existe.

| Campo | Cuándo aparece |
|---|---|
| `material` | Casi siempre, con las opciones del tipo |
| `metodo` | Sale del material. Apagado si el material sólo admite uno |
| `color` | Sólo si la pieza se ve en boca |
| `sistemaImplante`, `retencion` | Sólo sobre implante |
| `espesorAlivioMm` | Sólo los trabajos "con alivio" |
| `grosorMm` | Sólo la guarda oclusal |
| `colorBase`, `colorDientes` | Sólo las prótesis |
| `troqueles` | Sólo el modelo |
| `notas` | Siempre, opcional |

El color trae la guía Vita clásica, la 3D-Master, el blanqueamiento y **"Según
la foto que adjunté"**: en un caso estético el doctor manda la foto con la guía
en boca, y obligarlo a escoger una clave que no representa lo que quiere es
empujarlo a mentir en el formulario.

### La lista corta del doctor

Veintinueve opciones paralizan a un dentista y los errores de captura los paga
el laboratorio. Por omisión el doctor ve **once**: corona, cofia, provisional,
póntico, incrustación, carilla, aditamento, prótesis total, prótesis parcial,
guarda y modelo, más las tres anotaciones. El laboratorio ve el catálogo entero
y afina el tipo al diseñar.

El modelo de datos guarda **siempre el tipo exacto**; lo único que cambia es
quién lo escoge. Un doctor que quiera el catálogo completo lo enciende desde la
misma pantalla y se le queda encendido en su perfil (`Usuario.catalogoCompleto`).

Una desviación de lo que pidió el Product Owner, y por qué: su lista corta traía
diez, con "prótesis" como una sola entrada. Se partió en total y parcial. Las
demás cosas que el laboratorio afina son variantes de fabricación —prensada,
reducida, con alivio, encerados—, pero total contra parcial no lo es: el doctor
sabe cuál es, y guardar "prótesis total" para una parcial sería escribir en el
caso un dato falso.

### La dentición restante no cuenta como unidad

"Antagonista", "Diente vecino" y "Omitir en el puente" se capturan porque el
técnico necesita saber que esos dientes se escanearon, pero **no se fabrican**.
No cuentan en "2 unidades", no llevan material —la columna es opcional en la
base— y no entran en el resumen del caso. Contarlas diría que un caso lleva
cinco piezas cuando lleva cuatro, y eso acaba en una cuenta mal hecha.

### Las imágenes

Lo que ya entregó el equipo de diseño está en uso:

| Archivo | Dónde se ve |
|---|---|
| `public/logo.svg` | La marca, en la portada y en la barra lateral. Se pinta en línea para que la palabra siga al tema y el asterisco conserve el azul; la forma no se toca |
| `public/iconos 3d/corona.png`, `caso de implante.png`, `modelo.png` | Las tarjetas de categoría del inicio y la miniatura de cada caso, según su indicación |
| `public/escaners/trios 5.png` | La tarjeta del escáner |

Lo que todavía falta va como marco con la descripción de lo que debe ir ahí,
porque §9 prohíbe recrear imágenes en código. En cuanto dejen los archivos, la
pantalla los toma sola, **sin tocar una línea**:

| Carpeta | Qué va | Dónde se ve |
|---|---|---|
| `public/entrada/` | `laboratorio.jpg`, `diseno.jpg`, `entrega.jpg` | El carrusel de la portada |
| `public/marcas/` | `3shape.svg`, `medit.svg`, `straumann.svg`, `dental-wings.svg`, `carestream.svg`, `planmeca.svg` | La banda de marcas compatibles |

El servidor comprueba si el archivo existe antes de pintar, así que nunca se ve
una imagen rota ni hay parpadeo. Los nombres con espacios se usan tal cual: se
codifican al pintar, no se renombra nada.

### La vista del diseño no es una imagen

El recuadro de cada tarjeta del inicio **no es un archivo**: es un cuadro de la
malla ligera de ese caso, la misma que el doctor gira en la pantalla de
aprobación. Se pinta una sola vez y se queda quieto, así que no gasta batería ni
distrae. Si el caso todavía no tiene diseño, ahí va el marco.

El lector de la malla vive en `src/lib/malla-cliente.ts` y lo usan las dos
pantallas, para que las dos enseñen exactamente la misma geometría.

### Cuatro fallas más que encontró la auditoría en esta vuelta

1. **El titular del inicio era invisible.** `portada` existía como color y como
   tamaño de texto a la vez; las dos familias comparten el prefijo `text-` y
   Tailwind resolvió `text-portada` como color: azul marino sobre azul marino.
   El tamaño se renombró a `titular`.
2. **El panel de bienvenida se perdía en tema claro.** Es oscuro en los dos
   temas, pero su texto seguía al tema. Ahora es una isla `siempre-oscuro`.
3. **La barra de navegación de abajo empujaba la página a lo ancho al 200%.**
   Cada renglón tenía ancho mínimo de 44 px y seis renglones no caben. El ancho
   mínimo se quitó donde el contenedor ya manda el ancho; el alto de 44 px se
   queda.
4. **La tarjeta del escáner se comía su propio texto al 200%**, por usar anchos
   fijos en rem. Ahora van en proporción.

---

## 4. Sobre el stack

**"Sileo" → shadcn/ui.** Usted eligió shadcn/ui y esto es lo que se hizo, para
que lo confirme o lo corrija:

Los nueve componentes base de §5.4 están construidos a mano sobre Tailwind, con
los tokens de §5.1, usando `class-variance-authority` y `tailwind-merge` — las
mismas piezas sobre las que está hecho shadcn/ui. **No se instaló shadcn/ui.**
Tres razones:

1. §5.4 pide una sola versión de cada componente, con variantes por prop y nunca
   por copia. shadcn/ui entrega copias que uno adopta, así que el trabajo de
   mantenerlas es el mismo.
2. shadcn/ui trae iconos de lucide, y §4 manda Phosphor.
3. Sus componentes traen sus propios nombres de color (`bg-background`,
   `text-muted-foreground`), que habría que remapear uno por uno a los roles de
   §5.1.

Hasta ahora ninguna pantalla ha necesitado un primitivo de los que shadcn/ui
resuelve bien (diálogo, popover, combobox): los formularios usan controles
nativos, que en el celular abren la rueda del sistema y son más rápidos y más
accesibles. **Si quiere shadcn/ui de todas formas, entra sin fricción**: la base
es la misma y sólo hay que mapear sus tokens. Dígamelo y lo hago.

**Docker.** Usted eligió Postgres en Docker desde el día uno. Docker no está
instalado en esta máquina, así que se dejó `docker-compose.yml` como la ruta
canónica y además un Postgres embebido —el mismo motor, mismo puerto, mismas
credenciales— para poder trabajar y probar hoy. `DATABASE_URL` no cambia entre
los dos caminos.

---

## 5. Lo que falta y espera decisión suya

| # | Qué | Por qué está detenido | Qué pasa mientras tanto |
|---|---|---|---|
| 1 | **Proveedor de correo y de WhatsApp** (§12.3) | Falta elegirlo | Los avisos se encolan y **no se pierde ninguno**. Mileo no finge que los mandó: el guion de entrega dice cuántos están esperando proveedor. Conectar uno es llenar cuatro variables de ambiente |
| 2 | **Servidor de producción y dominio** | Falta host | Producción corre y se probó, pero en esta máquina (`localhost:3100`), no en un servidor de RMS. Es lo único de la lista de §10 que no se puede marcar |
| 3 | **Respaldo fuera del servidor** | Falta destino | El respaldo diario funciona y deja las carpetas en disco local. Copiarlas afuera es del operador |
| 4 | **Tiempos estándar por etapa** (§12.5) | Falta calibrar | Están puestos con criterio de laboratorio chico en `src/lib/etapas.ts`. De ahí salen la fecha de entrega y los avisos de riesgo: si están mal, Mileo promete mal |
| 5 | **Qué va en cada kit** (§12.4 del laboratorio) | Falta confirmar | En `src/lib/calidad.ts`, repartido por indicación a partir de lo que menciona O-6 |
| 6 | **Marcas de escáner del primer día** (§12.6) | Falta confirmar | Hay guías para 3Shape, Medit, Straumann y un grupo general |
| 7 | Asignar casos a personas a mano (O-5) | — | El técnico se asigna solo al mandar el diseño |
| 8 | Adjuntar imágenes en el chat (O-4) | — | El chat de texto funciona |
| 9 | Política de retención y borrado de archivos (§12.2) | Falta definirla | El aviso de privacidad dice "mientras el caso esté activo y durante la garantía". Falta que el sistema lo aplique solo |
| 10 | **Las fotos y los logotipos del diseño** | Falta entregarlos | Ver la tabla de §3.1. Mientras tanto se ve el marco con la descripción; en cuanto lleguen los archivos, la pantalla los toma sola |

Además, una nota de seguridad para cuando haya servidor: la aplicación se conecta
con el rol `mileo_app`, que **no puede alterar la bitácora**. Las migraciones y
los respaldos usan el rol dueño. Mantenga esa separación al desplegar.

---

## 6. Lo que sigue

Según `SKILL.md`, aquí se lanza el piloto con 3 doctores y **no se construye más
hasta tener sus comentarios**. O-7 en adelante quedan sin empezar a propósito.

Para arrancar el piloto hacen falta, en este orden: el proveedor de avisos (#1),
el servidor (#2), los tiempos por etapa (#4) y el contenido de los kits (#5).
Los cuatro son decisiones suyas, no trabajo de programación.
