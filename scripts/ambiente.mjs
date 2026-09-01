import path from "node:path";
import { config as cargarEnv } from "dotenv";

/**
 * Desarrollo y produccion nunca comparten base de datos ni almacen de archivos
 * (SKILL.md O-0). El ambiente se elige de forma explicita con MILEO_AMBIENTE y
 * cada uno carga su propio archivo de variables.
 *
 *   MILEO_AMBIENTE=produccion npm run respaldo
 */
export function cargarAmbiente() {
  const ambiente =
    process.env.MILEO_AMBIENTE === "produccion" ? "produccion" : "desarrollo";

  cargarEnv({
    path: path.resolve(
      process.cwd(),
      ambiente === "produccion" ? ".env.production" : ".env.development",
    ),
    quiet: true,
  });

  if (!process.env.DATABASE_URL) {
    throw new Error(
      `Falta DATABASE_URL para el ambiente de ${ambiente}. ` +
        `Revise el archivo .env.${ambiente === "produccion" ? "production" : "development"}.`,
    );
  }

  return ambiente;
}
