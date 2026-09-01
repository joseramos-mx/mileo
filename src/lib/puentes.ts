import type { Material, RolDeUnidad } from "@/generated/prisma/enums";
import { DIENTES_SUPERIORES, DIENTES_INFERIORES } from "@/lib/vocabulario";
import { TRABAJOS, esPontico, puedeSerPilar } from "@/lib/trabajos";

/**
 * Los puentes del caso, en reglas puras.
 *
 * Un puente es un grupo de unidades vecinas: los extremos se apoyan en un
 * diente preparado —son pilares— y lo de en medio cuelga entre ellos —son
 * pónticos—. Eso es lo que hace que un puente 14-17 se lea sin ambigüedad:
 * cuatro unidades con el mismo puente, 14 y 17 pilares, 15 y 16 pónticos.
 *
 * Como el rol de cada unidad de un puente se deduce de su posición, aquí no
 * hay nada que el doctor pueda dejar a medias: si conecta, el modelo queda
 * completo solo. Si separa, cada unidad recupera su rol suelto.
 *
 * Todo esto vive fuera del componente a propósito: son las reglas del caso, no
 * de la pantalla.
 */

export type UnidadDelCaso = {
  diente: number;
  rol: RolDeUnidad;
  /** Vacío en las anotaciones: un antagonista no se fabrica. */
  material: Material | null;
  color: string | null;
  notas: string | null;
  /** Todas las unidades de un mismo puente comparten esta clave. */
  puenteId: string | null;
};

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
export function puentesDe(unidades: UnidadDelCaso[]) {
  const puentes = new Map<string, UnidadDelCaso[]>();
  for (const unidad of unidades) {
    if (!unidad.puenteId) continue;
    const grupo = puentes.get(unidad.puenteId) ?? [];
    grupo.push(unidad);
    puentes.set(unidad.puenteId, grupo);
  }

  for (const [id, grupo] of puentes) {
    const arcada = arcadaDe(grupo[0].diente) ?? [];
    grupo.sort((a, b) => arcada.indexOf(a.diente) - arcada.indexOf(b.diente));
    puentes.set(id, grupo);
  }

  return puentes;
}

/** El puente al que pertenece un diente, si pertenece a alguno. */
export function puenteDe(unidades: UnidadDelCaso[], diente: number) {
  const unidad = unidades.find((u) => u.diente === diente);
  if (!unidad?.puenteId) return null;
  return puentesDe(unidades).get(unidad.puenteId) ?? null;
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
export function ordenarRolesDePuentes(
  unidades: UnidadDelCaso[],
): UnidadDelCaso[] {
  const puentes = puentesDe(unidades);
  const rolDe = new Map<number, RolDeUnidad>();

  for (const grupo of puentes.values()) {
    // Un puente de una sola unidad no es un puente: se deshace solo.
    if (grupo.length < 2) continue;
    grupo.forEach((u, i) => {
      rolDe.set(u.diente, rolEnElPuente(u.rol, i, grupo.length));
    });
  }

  return unidades.map((unidad) => {
    if (!unidad.puenteId) return unidad;

    const grupo = puentes.get(unidad.puenteId);
    if (!grupo || grupo.length < 2) return { ...unidad, puenteId: null };

    const rol = rolDe.get(unidad.diente);
    if (!rol || rol === unidad.rol) return unidad;
    return { ...unidad, ...conMaterialValido(rol, unidad) };
  });
}

/**
 * Al cambiar de tipo, el material y el color tienen que seguir teniendo
 * sentido. Si el que traía sigue sirviendo, se respeta; si no, se pone el
 * primero que aplica. Una anotación se queda sin material: no hay pieza.
 */
export function conMaterialValido(
  rol: RolDeUnidad,
  unidad: Pick<UnidadDelCaso, "material" | "color">,
) {
  const tipo = TRABAJOS[rol];
  const permitidos = tipo.materiales;

  return {
    rol,
    material:
      permitidos.length === 0
        ? null
        : unidad.material && permitidos.includes(unidad.material)
          ? unidad.material
          : permitidos[0],
    color: tipo.llevaColorVita ? (unidad.color ?? "A2") : null,
  };
}

/** Una unidad nueva, con lo que corresponde a su tipo. */
export function unidadNueva(diente: number, rol: RolDeUnidad): UnidadDelCaso {
  return {
    diente,
    notas: null,
    puenteId: null,
    ...conMaterialValido(rol, { material: null, color: null }),
  };
}

/** Si estos dos dientes van unidos en el mismo puente. */
export function estanUnidos(
  unidades: UnidadDelCaso[],
  diente: number,
  vecino: number,
) {
  const uno = unidades.find((u) => u.diente === diente)?.puenteId;
  const otro = unidades.find((u) => u.diente === vecino)?.puenteId;
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
    .map((d) => conVecino.find((u) => u.diente === d)?.puenteId)
    .filter((c): c is string => Boolean(c));

  const clave = claves[0] ?? nuevaClave;
  const aFundir = new Set(claves);

  const unidos = conVecino.map((unidad) => {
    const esDeLosDos = unidad.diente === diente || unidad.diente === vecino;
    const eraDeUnPuenteFundido =
      unidad.puenteId !== null && aFundir.has(unidad.puenteId);
    if (!esDeLosDos && !eraDeUnPuenteFundido) return unidad;
    return { ...unidad, puenteId: clave };
  });

  return ordenarRolesDePuentes(ordenarPorBoca(unidos));
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

  const grupo = puenteDe(unidades, diente);
  if (!grupo) return unidades;

  // El grupo viene en el orden del dibujo. Lo que queda del lado del segundo
  // se lleva la clave nueva.
  const corte = Math.max(
    grupo.findIndex((u) => u.diente === diente),
    grupo.findIndex((u) => u.diente === vecino),
  );
  const delOtroLado = new Set(grupo.slice(corte).map((u) => u.diente));

  return ordenarRolesDePuentes(
    unidades.map((unidad) =>
      delOtroLado.has(unidad.diente)
        ? { ...unidad, puenteId: nuevaClave }
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
  const grupo = puenteDe(unidades, diente);
  if (!grupo) return unidades;

  const posicion = grupo.findIndex((u) => u.diente === diente);
  const derecha = new Set(grupo.slice(posicion + 1).map((u) => u.diente));

  const sueltos = unidades.map((unidad) => {
    if (unidad.diente === diente) return { ...unidad, puenteId: null };
    if (derecha.has(unidad.diente)) return { ...unidad, puenteId: nuevaClave };
    return unidad;
  });

  return ordenarRolesDePuentes(sueltos);
}

/** Quita un diente del caso, deshaciendo el puente que lo tuviera. */
export function quitar(unidades: UnidadDelCaso[], diente: number) {
  const grupo = puenteDe(unidades, diente);
  const sinEl = unidades.filter((u) => u.diente !== diente);

  // Si el que se va partía el puente en dos, lo que queda a un lado y otro ya
  // no está conectado: se sueltan todos y el doctor vuelve a conectar.
  if (grupo && grupo.length > 2) {
    const clave = grupo[0].puenteId;
    return ordenarRolesDePuentes(
      sinEl.map((u) => (u.puenteId === clave ? { ...u, puenteId: null } : u)),
    );
  }

  return ordenarRolesDePuentes(sinEl);
}

/** Las unidades en el orden en que están en la boca, arriba primero. */
export function ordenarPorBoca(unidades: UnidadDelCaso[]) {
  const orden = [...DIENTES_SUPERIORES, ...DIENTES_INFERIORES];
  return [...unidades].sort(
    (a, b) => orden.indexOf(a.diente) - orden.indexOf(b.diente),
  );
}

/**
 * "14 a 17" — como se nombra un puente cuando se le habla al doctor.
 *
 * El grupo viene en el orden del dibujo, que en el cuadrante superior derecho
 * va del 18 al 11: nombrarlo así daría "17 a 14", que nadie dice. Se nombra por
 * número, de menor a mayor.
 */
export function nombreDelPuente(grupo: { diente: number }[]) {
  if (grupo.length === 0) return "";
  const [uno, otro] = [grupo[0].diente, grupo[grupo.length - 1].diente].sort(
    (a, b) => a - b,
  );
  return `${uno} a ${otro}`;
}
