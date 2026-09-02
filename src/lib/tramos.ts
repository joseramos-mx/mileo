import type {
  Arcada,
  Material,
  MetodoDeFabricacion,
  Retencion,
  RolDeUnidad,
} from "@/generated/prisma/enums";
import {
  DIENTES_SUPERIORES,
  DIENTES_INFERIORES,
  METODOS_POR_MATERIAL,
} from "@/lib/vocabulario";
import { TRABAJOS, esPontico, pregunta, puedeSerPilar } from "@/lib/trabajos";

/**
 * Los tramos del caso, en reglas puras.
 *
 * Un tramo es un grupo de unidades vecinas unidas entre sí: los extremos se
 * apoyan en un diente preparado —son pilares— y lo de en medio cuelga entre
 * ellos. Eso es lo que hace que un puente 14-17 se lea sin ambigüedad: cuatro
 * unidades con el mismo tramo, 14 y 17 pilares, 15 y 16 pónticos. Sobre un
 * tramo van también el segmento de barra y la subestructura con alivio.
 *
 * Como el papel de cada unidad de un tramo se deduce de su posición, aquí no
 * hay nada que el doctor pueda dejar a medias: si conecta, el modelo queda
 * completo solo. Si separa, cada unidad recupera su papel suelto.
 *
 * Todo esto vive fuera del componente a propósito: son las reglas del caso, no
 * de la pantalla.
 */

export type UnidadDelCaso = {
  /** Vacío en los trabajos que van sobre una arcada entera. */
  diente: number | null;
  /** Sobre qué arcada va, cuando el trabajo es de arcada. */
  arcada: Arcada | null;
  rol: RolDeUnidad;
  /** Vacío en las anotaciones: un antagonista no se fabrica. */
  material: Material | null;
  /** Con qué se hace. Sale del material: el zirconio se fresa, la resina se imprime. */
  metodo: MetodoDeFabricacion | null;
  color: string | null;
  notas: string | null;

  /** Este diente lleva implante, no diente preparado. */
  esImplante: boolean;
  sistemaImplante: string | null;
  retencion: Retencion | null;
  espesorAlivioMm: number | null;
  grosorMm: number | null;
  colorBase: string | null;
  colorDientes: string | null;
  troqueles: boolean;

  /** Todas las unidades de un mismo tramo comparten esta clave. */
  tramoId: string | null;
};

/**
 * Una unidad tal como sale de la base, sin los campos que sólo le importan a
 * la base. Se pasa por aquí para no repetir la lista de campos en cada
 * pantalla y para que agregar uno nuevo se note en un solo lugar.
 */
export function desdeLaBase(u: UnidadDelCaso & Record<string, unknown>) {
  return {
    diente: u.diente,
    arcada: u.arcada,
    rol: u.rol,
    material: u.material,
    metodo: u.metodo,
    color: u.color,
    notas: u.notas,
    esImplante: u.esImplante,
    sistemaImplante: u.sistemaImplante,
    retencion: u.retencion,
    espesorAlivioMm: u.espesorAlivioMm,
    grosorMm: u.grosorMm,
    colorBase: u.colorBase,
    colorDientes: u.colorDientes,
    troqueles: u.troqueles,
    tramoId: u.tramoId,
  } satisfies UnidadDelCaso;
}

/** Una unidad que sí va sobre un diente. */
export type UnidadConDiente = UnidadDelCaso & { diente: number };

/** Sólo las que van en un diente. Las de arcada no entran en el odontograma. */
export function conDiente(unidades: UnidadDelCaso[]): UnidadConDiente[] {
  return unidades.filter((u): u is UnidadConDiente => u.diente !== null);
}

/** El orden real de la boca. Los números FDI no son consecutivos. */
export const ARCADAS = [DIENTES_SUPERIORES, DIENTES_INFERIORES];

export function arcadaDe(diente: number) {
  return ARCADAS.find((arcada) => arcada.includes(diente)) ?? null;
}

export function esSuperior(diente: number) {
  return DIENTES_SUPERIORES.includes(diente);
}

/** Los dientes pegados a éste, en el orden en que están en la boca. */
export function vecinosDe(diente: number): number[] {
  const arcada = arcadaDe(diente);
  if (!arcada) return [];
  const i = arcada.indexOf(diente);
  return [arcada[i - 1], arcada[i + 1]].filter(
    (d): d is number => d !== undefined,
  );
}

/** Las unidades de cada puente, ordenadas como están en la boca. */
export function tramosDe(unidades: UnidadDelCaso[]) {
  const tramos = new Map<string, UnidadConDiente[]>();
  for (const unidad of conDiente(unidades)) {
    if (!unidad.tramoId) continue;
    const grupo = tramos.get(unidad.tramoId) ?? [];
    grupo.push(unidad);
    tramos.set(unidad.tramoId, grupo);
  }

  for (const [id, grupo] of tramos) {
    const arcada = arcadaDe(grupo[0].diente) ?? [];
    grupo.sort((a, b) => arcada.indexOf(a.diente) - arcada.indexOf(b.diente));
    tramos.set(id, grupo);
  }

  return tramos;
}

/** El puente al que pertenece un diente, si pertenece a alguno. */
export function tramoDe(unidades: UnidadDelCaso[], diente: number) {
  const unidad = unidades.find((u) => u.diente === diente);
  if (!unidad?.tramoId) return null;
  return tramosDe(unidades).get(unidad.tramoId) ?? null;
}

/**
 * Dentro de un puente el papel de cada pieza lo manda su lugar.
 *
 * En las puntas va algo que se apoya en un diente preparado —una corona, una
 * cofia, un encerado anatómico— y en medio, algo que cuelga: un póntico. Lo que
 * el doctor sí escoge es cuál de todos: si su corona ya era prensada, se queda
 * prensada. Sólo se corrige la que no puede ir en ese lugar.
 */
function rolEnElPuente(
  actual: RolDeUnidad,
  posicion: number,
  cuantas: number,
): RolDeUnidad {
  const enLaPunta = posicion === 0 || posicion === cuantas - 1;
  if (enLaPunta) return puedeSerPilar(actual) ? actual : "CORONA_ANATOMICA";
  return esPontico(actual) ? actual : "PONTICO_ANATOMICO";
}

/** Deja cada unidad de cada puente con el rol que le toca por su posición. */
export function ordenarRolesDeTramos(
  unidades: UnidadDelCaso[],
): UnidadDelCaso[] {
  const tramos = tramosDe(unidades);
  const rolDe = new Map<number, RolDeUnidad>();

  for (const grupo of tramos.values()) {
    // Un puente de una sola unidad no es un puente: se deshace solo.
    if (grupo.length < 2) continue;
    grupo.forEach((u, i) => {
      rolDe.set(u.diente, rolEnElPuente(u.rol, i, grupo.length));
    });
  }

  return unidades.map((unidad) => {
    if (!unidad.tramoId) return unidad;

    const grupo = tramos.get(unidad.tramoId);
    if (!grupo || grupo.length < 2) return { ...unidad, tramoId: null };

    const rol = unidad.diente === null ? null : rolDe.get(unidad.diente);
    if (!rol || rol === unidad.rol) return unidad;
    return { ...unidad, ...conCamposValidos(rol, unidad) };
  });
}

/**
 * Al cambiar de tipo, lo capturado que siga sirviendo se conserva y lo que ya
 * no aplica se borra.
 *
 * No se pierde trabajo: si el material anterior también le queda al tipo nuevo,
 * se queda; las notas nunca se tocan. Pero un campo que el tipo nuevo no
 * pregunta no puede quedarse guardado a escondidas —un espesor de alivio en una
 * corona anatómica sería un dato que nadie escogió y que el taller leería.
 */
export function conCamposValidos(
  rol: RolDeUnidad,
  unidad: Partial<UnidadDelCaso>,
): Partial<UnidadDelCaso> & { rol: RolDeUnidad } {
  const permitidos = TRABAJOS[rol].materiales;

  const material =
    permitidos.length === 0
      ? null
      : unidad.material && permitidos.includes(unidad.material)
        ? unidad.material
        : permitidos[0];

  const puesto = (campo: Parameters<typeof pregunta>[1]) =>
    pregunta(rol, campo);

  return {
    rol,
    material,
    ...conMetodoValido(material, unidad.metodo ?? null),
    color: puesto("color") ? (unidad.color ?? "A2") : null,
    sistemaImplante: puesto("sistemaImplante")
      ? (unidad.sistemaImplante ?? null)
      : null,
    // La retención no está en `campos`: se pregunta cuando el diente lleva
    // implante, sea cual sea el tipo de corona que va encima.
    retencion:
      unidad.esImplante || puesto("sistemaImplante")
        ? (unidad.retencion ?? "ATORNILLADA")
        : null,
    espesorAlivioMm: puesto("espesorAlivio")
      ? (unidad.espesorAlivioMm ?? 0.5)
      : null,
    grosorMm: puesto("grosor") ? (unidad.grosorMm ?? 2) : null,
    colorBase: puesto("colorBase") ? (unidad.colorBase ?? "Rosa") : null,
    colorDientes: puesto("colorDientes") ? (unidad.colorDientes ?? "A2") : null,
    troqueles: puesto("troqueles") ? (unidad.troqueles ?? true) : false,
  };
}

/**
 * El método sigue al material. Si el que traía ya no se puede con el material
 * nuevo, se pone el primero que sí: nunca queda un "colado" sobre una resina
 * que sólo se imprime.
 */
export function conMetodoValido(
  material: Material | null,
  metodo: MetodoDeFabricacion | null,
) {
  if (!material) return { metodo: null };
  const permitidos = METODOS_POR_MATERIAL[material];
  return {
    metodo: metodo && permitidos.includes(metodo) ? metodo : permitidos[0],
  };
}

/** Lo que trae una unidad recién creada, antes de saber su tipo. */
const EN_BLANCO = {
  diente: null,
  arcada: null,
  material: null,
  metodo: null,
  color: null,
  notas: null,
  esImplante: false,
  sistemaImplante: null,
  retencion: null,
  espesorAlivioMm: null,
  grosorMm: null,
  colorBase: null,
  colorDientes: null,
  troqueles: false,
  tramoId: null,
} satisfies Omit<UnidadDelCaso, "rol">;

/** Una unidad nueva sobre un diente. */
export function unidadNueva(diente: number, rol: RolDeUnidad): UnidadDelCaso {
  return { ...EN_BLANCO, ...conCamposValidos(rol, EN_BLANCO), diente };
}

/**
 * Una unidad nueva sobre una arcada entera: una guarda, una prótesis, un
 * modelo. No va en ningún diente, así que no se toca el odontograma para
 * agregarla.
 */
export function unidadDeArcada(
  arcada: Arcada,
  rol: RolDeUnidad,
): UnidadDelCaso {
  return { ...EN_BLANCO, ...conCamposValidos(rol, EN_BLANCO), arcada };
}

/** Si estos dos dientes van unidos en el mismo puente. */
export function estanUnidos(
  unidades: UnidadDelCaso[],
  diente: number,
  vecino: number,
) {
  const uno = unidades.find((u) => u.diente === diente)?.tramoId;
  const otro = unidades.find((u) => u.diente === vecino)?.tramoId;
  return Boolean(uno) && uno === otro;
}

/**
 * Une dos dientes vecinos en un puente.
 *
 * El que falte se crea: al doctor que arma un 14-17 no se le pide capturar el
 * 15 y el 16 por separado para después unirlos. Si cada uno ya venía de un
 * puente distinto, los dos se funden en uno.
 *
 * `nuevaClave` viene de afuera para que esta función no dependa del reloj ni
 * del azar y se pueda probar.
 */
export function conectar(
  unidades: UnidadDelCaso[],
  diente: number,
  vecino: number,
  nuevaClave: string,
): UnidadDelCaso[] {
  if (!vecinosDe(diente).includes(vecino)) return unidades;

  let conVecino = unidades;
  for (const cual of [diente, vecino]) {
    if (!conVecino.some((u) => u.diente === cual)) {
      conVecino = [...conVecino, unidadNueva(cual, "PONTICO_ANATOMICO")];
    }
  }

  const claves = [diente, vecino]
    .map((d) => conVecino.find((u) => u.diente === d)?.tramoId)
    .filter((c): c is string => Boolean(c));

  const clave = claves[0] ?? nuevaClave;
  const aFundir = new Set(claves);

  const unidos = conVecino.map((unidad) => {
    const esDeLosDos = unidad.diente === diente || unidad.diente === vecino;
    const eraDeUnPuenteFundido =
      unidad.tramoId !== null && aFundir.has(unidad.tramoId);
    if (!esDeLosDos && !eraDeUnPuenteFundido) return unidad;
    return { ...unidad, tramoId: clave };
  });

  return ordenarRolesDeTramos(ordenarPorBoca(unidos));
}

/**
 * Corta la unión entre dos dientes vecinos.
 *
 * El puente se parte en dos por ahí: lo que quede de cada lado sigue siendo
 * puente sólo si le quedan dos unidades o más. Las unidades no se borran; lo
 * que se deshace es la unión.
 */
export function desunir(
  unidades: UnidadDelCaso[],
  diente: number,
  vecino: number,
  nuevaClave: string,
): UnidadDelCaso[] {
  if (!estanUnidos(unidades, diente, vecino)) return unidades;

  const grupo = tramoDe(unidades, diente);
  if (!grupo) return unidades;

  // El grupo viene en el orden del dibujo. Lo que queda del lado del segundo
  // se lleva la clave nueva.
  const corte = Math.max(
    grupo.findIndex((u) => u.diente === diente),
    grupo.findIndex((u) => u.diente === vecino),
  );
  const delOtroLado = new Set(grupo.slice(corte).map((u) => u.diente));

  return ordenarRolesDeTramos(
    unidades.map((unidad) =>
      unidad.diente !== null && delOtroLado.has(unidad.diente)
        ? { ...unidad, tramoId: nuevaClave }
        : unidad,
    ),
  );
}

/**
 * Saca un diente de su puente.
 *
 * Si estaba en medio, el puente se parte en dos: lo que queda de cada lado
 * sigue siendo un puente sólo si le quedan dos unidades o más.
 */
export function separar(
  unidades: UnidadDelCaso[],
  diente: number,
  nuevaClave: string,
): UnidadDelCaso[] {
  const grupo = tramoDe(unidades, diente);
  if (!grupo) return unidades;

  const posicion = grupo.findIndex((u) => u.diente === diente);
  const derecha = new Set(grupo.slice(posicion + 1).map((u) => u.diente));

  const sueltos = unidades.map((unidad) => {
    if (unidad.diente === diente) return { ...unidad, tramoId: null };
    if (unidad.diente !== null && derecha.has(unidad.diente)) {
      return { ...unidad, tramoId: nuevaClave };
    }
    return unidad;
  });

  return ordenarRolesDeTramos(sueltos);
}

/** Quita un diente del caso, deshaciendo el puente que lo tuviera. */
export function quitar(unidades: UnidadDelCaso[], diente: number) {
  const grupo = tramoDe(unidades, diente);
  const sinEl = unidades.filter((u) => u.diente !== diente);

  // Si el que se va partía el puente en dos, lo que queda a un lado y otro ya
  // no está conectado: se sueltan todos y el doctor vuelve a conectar.
  if (grupo && grupo.length > 2) {
    const clave = grupo[0].tramoId;
    return ordenarRolesDeTramos(
      sinEl.map((u) => (u.tramoId === clave ? { ...u, tramoId: null } : u)),
    );
  }

  return ordenarRolesDeTramos(sinEl);
}

/**
 * Las unidades en el orden en que están en la boca, arriba primero.
 *
 * Las de arcada no van en ningún diente, así que se van al final: son el
 * trabajo que envuelve a todo lo demás.
 */
export function ordenarPorBoca(unidades: UnidadDelCaso[]) {
  const orden = [...DIENTES_SUPERIORES, ...DIENTES_INFERIORES];
  const lugar = (u: UnidadDelCaso) =>
    u.diente === null ? orden.length : orden.indexOf(u.diente);
  return [...unidades].sort((a, b) => lugar(a) - lugar(b));
}

/**
 * "14 a 17" — como se nombra un puente cuando se le habla al doctor.
 *
 * El grupo viene en el orden del dibujo, que en el cuadrante superior derecho
 * va del 18 al 11: nombrarlo así daría "17 a 14", que nadie dice. Se nombra por
 * número, de menor a mayor.
 */
export function nombreDelTramo(grupo: { diente: number }[]) {
  if (grupo.length === 0) return "";
  const [uno, otro] = [grupo[0].diente, grupo[grupo.length - 1].diente].sort(
    (a, b) => a - b,
  );
  return `${uno} a ${otro}`;
}

/**
 * Quita una unidad del caso, sea de diente o de arcada.
 *
 * Las de diente pasan por `quitar`, que además deshace el tramo si el que se va
 * lo partía en dos. Las de arcada no están en ningún tramo, así que basta con
 * sacarlas.
 */
export function quitarUnidad(
  unidades: UnidadDelCaso[],
  cual: UnidadDelCaso,
): UnidadDelCaso[] {
  if (cual.diente !== null) return quitar(unidades, cual.diente);
  return unidades.filter(
    (u) => !(u.diente === null && u.arcada === cual.arcada && u.rol === cual.rol),
  );
}
