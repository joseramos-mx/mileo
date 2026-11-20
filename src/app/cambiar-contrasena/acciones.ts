"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteSupabaseServidor } from "@/lib/supabase/servidor";

export type ResultadoContrasena = { error?: string };

const esquema = z
    .object({
        contrasena: z
            .string()
            .min(8, "La contraseña necesita al menos 8 caracteres.")
            .max(72, "La contraseña es demasiado larga (máximo 72 caracteres).")
            .regex(/\p{Lu}/u, "Agregue al menos una letra mayúscula.")
            .regex(/\p{Ll}/u, "Agregue al menos una letra minúscula.")
            .regex(/\d/, "Agregue al menos un número.")
            .regex(
                /[^\p{L}\p{N}\s]/u,
                "Agregue al menos un símbolo, como ! @ # $ % o *.",
            ),
        confirmacion: z.string(),
    })
    .refine((v) => v.contrasena === v.confirmacion, {
        message: "Las dos contraseñas no coinciden.",
        path: ["confirmacion"],
    });

/**
 * La primera vez que entra con la contraseña temporal que le mandó la administración, la
 * persona elige su contraseña. Con eso la temporal deja de servir.
 *
 * Usa `usuarioActual` y no `exigirUsuario`: ese guarda mandaría de vuelta aquí
 * a quien aún debe cambiarla, y daría vueltas sin fin.
 */
export async function elegirContrasena(
    _previo: ResultadoContrasena,
    datos: FormData,
): Promise<ResultadoContrasena> {
    const usuario = await usuarioActual();
    if (!usuario) redirect("/entrar");

    // Sólo quien entró con la temporal y aún no elige su contraseña puede usar esta
    // acción: no se pide la anterior, así que no debe servir para cualquiera.
    const fila = await prisma.usuario.findUnique({
        where: { id: usuario.id },
        select: { debeCambiarContrasena: true },
    });
    if (!fila?.debeCambiarContrasena) redirect("/");

    const leido = esquema.safeParse({
        contrasena: String(datos.get("contrasena") ?? ""),
        confirmacion: String(datos.get("confirmacion") ?? ""),
    });
    if (!leido.success) return { error: leido.error.issues[0].message };

    // Con la sesión de la propia persona, no con la llave de administración.
    const supabase = await crearClienteSupabaseServidor();
    const { error } = await supabase.auth.updateUser({
        password: leido.data.contrasena,
    });

    if (error) {
        if (error.code === "same_password") {
            return { error: "Elija una contraseña distinta a la temporal que recibió." };
        }
        if (error.code === "weak_password") {
            return {
                error: "Esa contraseña es muy fácil de adivinar. Pruebe con otra.",
            };
        }
        console.error("[contrasena] Supabase no la cambió:", error);
        return { error: "No pudimos guardar su contraseña. Intente de nuevo." };
    }

    await prisma.usuario.update({
        where: { id: usuario.id },
        data: { debeCambiarContrasena: false },
    });

    redirect("/");
}