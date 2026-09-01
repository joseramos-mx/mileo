/**
 * Orden de las tablas de Mileo para volcar y restaurar.
 *
 * Se listan de padres a hijos: al restaurar se recorre en este orden y al
 * vaciar se recorre al reves, de modo que las llaves foraneas nunca se rompen.
 */
export const TABLAS = [
  "Clinica",
  "Usuario",
  "Invitacion",
  "Sesion",
  "Paciente",
  "Caso",
  "Unidad",
  "Archivo",
  "EventoBitacora",
];

/**
 * Columnas que apuntan a la misma tabla. Se insertan en blanco y se rellenan en
 * una segunda pasada, para no depender del orden de los renglones.
 */
export const LLAVES_A_SI_MISMA = {
  Usuario: ["invitadoPorId"],
  Caso: ["casoOrigenId"],
};

/** Columnas jsonb: hay que mandarlas como texto y dejar que Postgres las lea. */
export const COLUMNAS_JSON = {
  EventoBitacora: ["datos"],
};
