import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

/**
 * Encuentra pg_dump / pg_restore / psql.
 *
 * 1. MILEO_PG_BIN, si el operador la define (util con Docker o con una
 *    instalacion propia de Postgres).
 * 2. Los binarios del Postgres embebido que usa el desarrollo sin Docker.
 * 3. El PATH del sistema.
 */
export function binarioPostgres(nombre) {
  const ejecutable = process.platform === "win32" ? `${nombre}.exe` : nombre;

  if (process.env.MILEO_PG_BIN) {
    const ruta = path.join(process.env.MILEO_PG_BIN, ejecutable);
    if (fs.existsSync(ruta)) return ruta;
  }

  for (const paquete of [
    "@embedded-postgres/windows-x64",
    "@embedded-postgres/linux-x64",
    "@embedded-postgres/darwin-arm64",
    "@embedded-postgres/darwin-x64",
  ]) {
    try {
      const raiz = path.dirname(require_.resolve(`${paquete}/package.json`));
      const ruta = path.join(raiz, "native", "bin", ejecutable);
      if (fs.existsSync(ruta)) return ruta;
    } catch {
      // El paquete de esta plataforma no esta instalado; se sigue buscando.
    }
  }

  return ejecutable;
}
