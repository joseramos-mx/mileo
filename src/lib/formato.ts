/**
 * Formatos que se usan igual en el servidor y en el navegador.
 * Sin dependencias de Node: este modulo viaja al cliente.
 */

/** "1.4 MB", "412 KB" — para ensenarle al doctor cuanto lleva subido. */
export function enTamano(bytes: number | bigint) {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
