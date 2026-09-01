import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * El cliente de Postgres de Mileo.
 *
 * Se conecta la primera vez que alguien lo usa, no al importarlo: compilar la
 * aplicación no debe exigir credenciales de base de datos, y así el error de
 * configuración sale en la petición que lo necesita, con contexto, en vez de
 * tumbar el arranque entero.
 */

// En desarrollo el guardado global evita abrir una conexión nueva en cada
// recarga en caliente. En producción basta con el módulo, que se carga una vez.
const global_ = globalThis as unknown as { prismaMileo?: PrismaClient };

let cliente: PrismaClient | undefined = global_.prismaMileo;

function obtenerCliente(): PrismaClient {
  if (cliente) return cliente;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Revise .env.development o .env.production.",
    );
  }

  cliente = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  if (process.env.NODE_ENV !== "production") global_.prismaMileo = cliente;
  return cliente;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_objetivo, propiedad, receptor) {
    const real = obtenerCliente();
    const valor = Reflect.get(real, propiedad, receptor);
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
});
