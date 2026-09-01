/**
 * La fecha siempre a la vista, en formato doble (SKILL.md §6.3):
 * "Jue 3 sep · en 3 días".
 *
 * Nunca "pronto" ni "a la brevedad": cada mensaje dice qué sigue y cuándo, con
 * fecha concreta (SKILL.md §8).
 */

const ZONA = "America/Monterrey";

const formatoCorto = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: ZONA,
});

const formatoLargo = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONA,
});

const formatoEnPalabras = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  timeZone: ZONA,
});

const formatoConHora = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA,
});

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Jue 3 sep" */
export function fechaCorta(fecha: Date) {
  return capitalizar(formatoCorto.format(fecha).replaceAll(".", ""));
}

/** "jueves, 3 de septiembre de 2026" — para lectores de pantalla y detalles. */
export function fechaLarga(fecha: Date) {
  return formatoLargo.format(fecha);
}

/** "3 de septiembre" — para leerlo completo, sin abreviar, en un aria-label. */
export function fechaEnPalabras(fecha: Date) {
  return formatoEnPalabras.format(fecha);
}

/** "3 sep, 14:30" — para la bitácora. */
export function fechaConHora(fecha: Date) {
  return formatoConHora.format(fecha).replaceAll(".", "");
}

/** Días entre hoy y la fecha, contando días de calendario, no horas. */
export function diasFaltantes(fecha: Date, desde = new Date()) {
  const aMedianoche = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (aMedianoche(fecha) - aMedianoche(desde)) / (24 * 60 * 60 * 1000),
  );
}

/** "en 3 días", "hoy", "mañana", "hace 2 días" */
export function cuandoFalta(fecha: Date, desde = new Date()) {
  const dias = diasFaltantes(fecha, desde);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "ayer";
  if (dias > 1) return `en ${dias} días`;
  return `hace ${Math.abs(dias)} días`;
}

/**
 * "hace un momento", "hace 2 horas", "ayer", "hace 5 días".
 * Para lo que ya pasó, donde la hora exacta no aporta nada.
 */
export function haceCuanto(fecha: Date, desde = new Date()) {
  const minutos = Math.round((desde.getTime() - fecha.getTime()) / 60000);
  if (minutos < 2) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} minutos`;

  const horas = Math.round(minutos / 60);
  if (horas === 1) return "hace 1 hora";
  if (horas < 24) return `hace ${horas} horas`;

  const dias = Math.abs(diasFaltantes(fecha, desde));
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  return fechaCorta(fecha);
}

/** "Jue 3 sep · en 3 días" — el formato doble de §6.3. */
export function fechaDoble(fecha: Date, desde = new Date()) {
  return `${fechaCorta(fecha)} · ${cuandoFalta(fecha, desde)}`;
}

/** Para el atributo dateTime de <time>. */
export function paraMaquina(fecha: Date) {
  return fecha.toISOString();
}
