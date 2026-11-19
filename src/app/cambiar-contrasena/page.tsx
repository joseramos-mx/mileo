import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { RUTA_DE_ENTRADA } from "@/lib/rutas-publicas";
import { FormularioDeContrasena } from "./FormularioDeContrasena";

/**
 * Primera contraseña propia. Va FUERA del layout que llama a `exigirUsuario`
 * (junto a /aviso-de-privacidad): `exigirUsuario` manda aquí, y si esta página
 * estuviera dentro de ese layout se redirigiría a sí misma sin fin.
 */
export default async function PaginaDeCambiarContrasena() {
    const sesion = await usuarioActual();
    if (!sesion) redirect(RUTA_DE_ENTRADA);

    const fila = await prisma.usuario.findUnique({
        where: { id: sesion.id },
        select: { debeCambiarContrasena: true },
    });
    if (!fila?.debeCambiarContrasena) redirect("/");

    return (
        <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-6 p-4">
            <div>
                <h1 className="text-2xl font-semibold text-primario">
                    Cree su contraseña
                </h1>
                <p className="mt-1 text-menor text-secundario">
                    La usará la próxima vez que entre a Mileo.
                </p>
            </div>
            <FormularioDeContrasena />
        </main>
    );
}