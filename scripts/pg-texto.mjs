import pg from "pg";

/**
 * Hace que el controlador de Postgres devuelva fechas y json como el texto
 * exacto que guarda la base, sin convertirlos a objetos de JavaScript.
 *
 * Sin esto, un respaldo pierde informacion: `Date` de JavaScript no distingue
 * si un timestamp venia sin zona horaria, y al volver a guardarlo la fecha se
 * corre por la diferencia horaria del equipo. Un solo milisegundo de diferencia
 * rompe la cadena de hash de la bitacora, que es justo lo que el respaldo tiene
 * que preservar intacto.
 *
 * Se llama al inicio de respaldo.mts y restaurar.mts, antes de conectar.
 */
export function usarTextoCrudo() {
  const tipos = [
    1082, // date
    1114, // timestamp sin zona
    1184, // timestamptz
    114, // json
    3802, // jsonb
  ];
  for (const oid of tipos) {
    pg.types.setTypeParser(oid, (valor) => valor);
  }
}
