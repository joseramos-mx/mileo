# Mileo

Plataforma de casos de **RMS Zahnfacturing**, laboratorio dental digital en
Durango, México.

El dentista escanea con el equipo que ya tiene, sube los archivos a Mileo, sigue
su caso, aprueba el diseño en 3D y habla con su técnico. Por dentro, el
laboratorio corre su producción en la misma plataforma.

Mileo es agnóstico de marca: recibe STL, PLY, OBJ, DICOM y ZIP vengan de donde
vengan. Esa es su única ventaja estructural frente a 3Shape, Medit, Straumann y
Dandy.

El producto se construye siguiendo [`SKILL.md`](./SKILL.md), que manda sobre
cualquier cosa escrita aquí.

---

## Levantar el proyecto

```bash
npm install
```

### 1. La base de datos

La ruta canónica es Docker:

```bash
docker compose up -d           # Postgres 16 en localhost:5433
```

En equipos sin Docker, el mismo motor Postgres se levanta desde un binario
embebido, en el mismo puerto y con las mismas credenciales, de modo que
`DATABASE_URL` no cambia:

```bash
npm run bd:local               # se queda corriendo; Ctrl+C para apagar
```

### 2. Esquema, permisos y semilla

```bash
npm run bd:preparar
```

Eso hace tres cosas, en este orden:

1. `prisma migrate deploy` — crea el esquema.
2. `npm run bd:rol-aplicacion` — le da contraseña al rol `mileo_app`, con el que
   se conecta la aplicación. Ese rol **no puede modificar ni borrar la
   bitácora**.
3. `prisma db seed` — el equipo del laboratorio y, sólo en desarrollo, un caso
   de demostración de 3 unidades con materiales distintos.

### 3. La aplicación

```bash
npm run dev                    # http://localhost:3000
```

Cuentas de desarrollo, todas con la contraseña `mileo1234`:

| Correo | Quién es |
|---|---|
| `juan.valverde@prodental.mx` | Doctor |
| `recepcion@prodental.mx` | Asistente de la clínica |
| `admision@rmszahn.mx` | Admisión |
| `diseno@rmszahn.mx` | Diseño |
| `calidad@rmszahn.mx` | Control de calidad |
| `direccion@rmszahn.mx` | Dirección |

---

## Ambientes

Desarrollo y producción no comparten nada: base de datos, almacén de archivos y
secreto de sesión son distintos, y se eligen con `MILEO_AMBIENTE`.

| | Desarrollo | Producción |
|---|---|---|
| Variables | `.env.development` | `.env.production` (no se versiona) |
| Base | `mileo_dev` | `mileo_prod` |
| Archivos | `./almacen/archivos` | `MILEO_ALMACEN_ARCHIVOS` |
| Docker | `docker-compose.yml` (5433) | `docker-compose.prod.yml` (5434) |

```bash
cp .env.example .env.production          # y rellenar
MILEO_AMBIENTE=produccion npm run bd:preparar
npm run build
MILEO_AMBIENTE=produccion npm start
```

---

## Respaldo y restauración

El respaldo es lógico y va por el mismo controlador de Postgres que usa la
aplicación: no depende de que `pg_dump` esté instalado, así que se comporta
igual en Docker, en el Postgres embebido y en uno administrado.

```bash
npm run respaldo                                  # desarrollo
MILEO_AMBIENTE=produccion npm run respaldo        # producción
```

Cada respaldo es una carpeta con fecha que contiene los datos en NDJSON, una
copia de los archivos de paciente y un `manifiesto.json` con el sha256 de todo.

Restaurar comprueba lo que hizo: número de registros por tabla, sha256 de cada
archivo y la integridad de la cadena de hash de la bitácora.

```bash
npm run bd:desplegar                              # el esquema primero
npm run restaurar -- respaldos/desarrollo-20260831-235024
```

### Tareas que corren solas

Además del respaldo, hay dos guiones que se programan:

```cron
# Cada hora: marca casos en riesgo, recuerda aprobaciones, recorre fechas.
0 * * * * cd /srv/mileo && MILEO_AMBIENTE=produccion npm run vigilar

# Cada cinco minutos: entrega los avisos que estén en la cola.
*/5 * * * * cd /srv/mileo && MILEO_AMBIENTE=produccion npm run avisos
```

Los dos son idempotentes: correrlos de más no manda avisos repetidos.

### Respaldo diario automático

Linux (cron, 2 de la mañana):

```cron
0 2 * * * cd /srv/mileo && MILEO_AMBIENTE=produccion /usr/bin/npm run respaldo >> /var/log/mileo-respaldo.log 2>&1
```

Windows (Programador de tareas):

```powershell
schtasks /create /tn "Mileo respaldo diario" /tr "cmd /c cd /d C:\mileo && set MILEO_AMBIENTE=produccion && npm run respaldo" /sc daily /st 02:00
```

Los respaldos se quedan en disco local. **Copiarlos fuera del servidor es
responsabilidad del operador** y está pendiente de decidir con el Product Owner
(ver `ENTREGA.md`).

---

## Auditoría

`SKILL.md §10` exige correr la lista entera antes de dar por terminado cualquier
objetivo. Con el servidor de desarrollo corriendo:

```bash
npm run tipos        # TypeScript estricto
npm run lint
npm run auditar      # las cuatro pruebas, encadenadas
```

`npm run auditar` encadena cuatro pruebas:

| Guion | Qué prueba |
|---|---|
| `npm run medir:renders` | No es una prueba: mide cuánto ocupa el objeto dentro de cada render 3D. Corra esto cuando el equipo de diseño entregue renders nuevos y copie los números a `RENDERS_3D` en `src/lib/entrada.ts`. Así los renders se ven todos del mismo tamaño sin ajustarlos a ojo. |

| Guion | Qué prueba |
|---|---|
| `npm run verificar:bitacora` | La cadena de hash está íntegra y la aplicación no puede alterar la bitácora: intenta un UPDATE, un DELETE y un TRUNCATE, y los tres tienen que fallar. |
| `npm run prueba:avisos` | Un caso lleva 50 horas esperando aprobación: el vigilante lo marca en riesgo y encola los avisos **sin que nadie intervenga**, correrlo tres veces no repite ninguno, y ningún mensaje usa las palabras prohibidas de §8. |
| `npm run prueba:subida` | Sube 400 MB, corta la conexión a la mitad, reanuda desde el byte exacto y comprueba que el sha256 del servidor es idéntico al del original. |
| `npm run prueba:flujo` | Un caso completo en un navegador de verdad: alta desde el celular, lista de admisión, envío, aceptación, diseño, aprobación en el visor 3D, fabricación, control de calidad y envío. Corre **axe** en cada pantalla, en tema claro y oscuro, y comprueba el zoom al 200%. Deja capturas en `pruebas/capturas/`. |

Las pruebas no dejan ninguna puerta trasera en el código de producción: abren su
sesión escribiendo directo en la base, con las mismas reglas que la aplicación.

---

## Cómo está organizado

```
prisma/         esquema, migraciones y semilla
scripts/        ambiente, Postgres local, rol de aplicación, respaldo,
                restauración, vigilante de riesgos y entrega de avisos
pruebas/        recorrido completo, subida reanudable, riesgo y avisos
src/
  app/          pantallas y rutas de API (App Router)
  componentes/  los componentes base de SKILL.md §5.4
  lib/          vocabulario, fechas, etapas, admisión, calidad, almacén,
                malla, bitácora, avisos
```

Dos archivos mandan sobre el resto:

- **`src/lib/vocabulario.ts`** — el único lugar donde una clave de la base se
  convierte en algo que lee una persona. Las palabras fijas de `SKILL.md §8` se
  escriben igual aquí, en la base y en pantalla.
- **`src/app/globals.css`** — el sistema de diseño. La escala perceptual no
  genera utilidades: en las pantallas sólo se usan tokens por rol
  (`bg-superficie`, `text-secundario`, `bg-accion`), nunca `azul-600` ni un hex
  suelto.

---

## Qué falta

Ver [`ENTREGA.md`](./ENTREGA.md): estado de cada objetivo, los cambios que se le
hicieron al diseño entregado y con su porqué, y lo que está esperando decisión
del Product Owner.
