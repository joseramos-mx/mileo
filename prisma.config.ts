import path from "node:path";
import { config as cargarEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no carga los .env solo. Se elige el ambiente de forma explicita
// para que desarrollo y produccion nunca compartan base de datos (O-0).
const ambiente = process.env.MILEO_AMBIENTE ?? "desarrollo";
cargarEnv({
  path: path.resolve(
    process.cwd(),
    ambiente === "produccion" ? ".env.production" : ".env.development",
  ),
  quiet: true,
});

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.MILEO_BD_URL_ADMIN ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/semilla.mts",
  },
});
