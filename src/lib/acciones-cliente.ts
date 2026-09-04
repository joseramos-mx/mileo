/**
 * Llamar a una acción del servidor sin que la pantalla se caiga.
 *
 * Las acciones devuelven `{ error }` cuando dicen que no, y eso ya se pinta.
 * Lo que no estaba cubierto es que la llamada misma falle: la red se cayó a la
 * mitad, o —la que se ve de verdad— el doctor tenía Mileo abierto desde antes
 * de la última actualización. Cada acción del servidor viaja con un
 * identificador que cambia cuando cambia la acción; una pestaña vieja pide uno
 * que ya no existe y el navegador enseña un error en inglés con un enlace a la
 * documentación de Next.
 *
 * Eso no le sirve a nadie, y menos a un doctor a media aprobación. Aquí se
 * convierte en lo que sí puede hacer.
 */

/**
 * Lo que devuelven las acciones de Mileo. Cada una añade lo suyo —si hace
 * falta autorización, qué quedó guardado—, y todas pueden decir que no.
 */
type ConError = { error?: string };

const VERSION_VIEJA =
  "Mileo se actualizó mientras tenía esta pantalla abierta. " +
  "Actualícela y vuelva a intentarlo: no se perdió nada.";

const NO_LLEGO =
  "No pude comunicarme con Mileo. Revise su conexión y vuelva a intentarlo; " +
  "si insiste, actualice la pantalla.";

/**
 * Corre la acción y devuelve su resultado, o un error dicho en palabras.
 *
 * Nunca lanza: quien la llama pinta `error` y sigue con la pantalla puesta.
 */
export async function ejecutar<T extends ConError>(
  accion: () => Promise<T>,
): Promise<T> {
  try {
    return await accion();
  } catch (falla) {
    // El detalle es para la consola de quien lo tenga que arreglar.
    console.error("Falló la llamada a una acción del servidor:", falla);
    // Devuelve la misma forma que la acción para que quien la llama no tenga
    // que distinguir dos casos: un resultado con `error` puesto y lo demás
    // vacío es exactamente lo que devuelve una acción que dice que no.
    return {
      error: esDeVersionVieja(falla) ? VERSION_VIEJA : NO_LLEGO,
    } as T;
  }
}

/**
 * Si el fallo es una pestaña que quedó con la versión anterior.
 *
 * Se mira el nombre y el texto porque no hay una clase pública que comprobar:
 * Next lanza `UnrecognizedActionError` y escribe "was not found on the server".
 */
function esDeVersionVieja(falla: unknown) {
  if (!(falla instanceof Error)) return false;
  return (
    falla.name === "UnrecognizedActionError" ||
    /not found on the server|Failed to find Server Action/i.test(falla.message)
  );
}
