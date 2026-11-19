"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/autorizacion";
import { prisma } from "@/lib/prisma";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/servidor";
import { enviarCorreo } from "@/lib/correo/enviar";
import { RUTA_DE_ENTRADA, urlBase } from "@/lib/rutas-publicas";
import type { Rol } from "@/generated/prisma/enums";
import { plantillaCodigoDeAcceso } from "./plantilla-codigo";
import { ROLES_EN_ORDEN } from "./roles";

/**
 * Las acciones de /usuarios. Cada una vuelve a exigir admin: una acción de
 * servidor es un endpoint público, no basta con que la página esté protegida.
 *
 * Cómo entra alguien que da de alta la administración:
 *
 * 1. Se crea su cuenta en Supabase, confirmada y con una contraseña TEMPORAL
 *    generada al azar, y su usuario en Mileo con `debeCambiarContrasena: true`.
 * 2. La contraseña temporal le llega por correo (Resend).
 * 3. Entra por el login de siempre. `exigirUsuario` la manda a
 *    /cambiar-contrasena hasta que elija la suya; ahí deja de servir.
 */

export type EstadoDelFormulario = { ok?: boolean; error?: string };

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sin 0/O, 1/l/I: se lee en un correo y se teclea sin confundirse.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function contrasenaTemporal(largo = 12) {
    let clave = "";
    for (let i = 0; i < largo; i++) clave += ALFABETO[randomInt(ALFABETO.length)];
    return clave;
}

async function mandarAcceso(
    correo: string,
    nombreCompleto: string,
    contrasena: string,
) {
    await enviarCorreo({
        para: correo,
        ...plantillaCodigoDeAcceso({
            nombre: nombreCompleto.split(/\s+/)[0],
            correo,
            contrasena,
            enlaceEntrada: `${urlBase()}${RUTA_DE_ENTRADA}`,
        }),
    });
}

export async function crearUsuario(
    _previo: EstadoDelFormulario,
    datos: FormData,
): Promise<EstadoDelFormulario> {
    const admin = await exigirAdmin();

    const nombreCompleto = String(datos.get("nombreCompleto") ?? "").trim();
    const correo = String(datos.get("correo") ?? "")
        .trim()
        .toLowerCase();
    const rol = String(datos.get("rol") ?? "") as Rol;
    const clinicaId =
        rol === "CLINICA" ? String(datos.get("clinicaId") ?? "") || null : null;

    if (!nombreCompleto) return { error: "Escriba el nombre completo." };
    if (!CORREO_VALIDO.test(correo)) return { error: "El correo no es válido." };
    if (!ROLES_EN_ORDEN.includes(rol)) return { error: "Elija un rol." };

    const existente = await prisma.usuario.findUnique({ where: { correo } });
    if (existente) return { error: "Ya existe un usuario con ese correo." };

    const supabase = crearClienteSupabaseAdmin();
    const contrasena = contrasenaTemporal();

    const { data, error } = await supabase.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombreCompleto },
    });
    if (error || !data.user) {
        return { error: `No se pudo crear la cuenta: ${error?.message}` };
    }

    let creado: { id: string };
    try {
        creado = await prisma.usuario.create({
            data: {
                supabaseId: data.user.id,
                correo,
                nombreCompleto,
                rol,
                clinicaId,
                invitadoPorId: admin.id,
                debeCambiarContrasena: true,
            },
        });
    } catch {
        // Que no quede una cuenta de acceso sin usuario en Mileo.
        await supabase.auth.admin.deleteUser(data.user.id);
        return { error: "No se pudo crear el usuario. Intente de nuevo." };
    }

    try {
        await mandarAcceso(correo, nombreCompleto, contrasena);
    } catch (error) {
        // Sin correo no hay acceso: se deshace todo para poder reintentar.
        console.error("[usuarios] No salió el correo de acceso:", error);
        await prisma.usuario.delete({ where: { id: creado.id } });
        await supabase.auth.admin.deleteUser(data.user.id);
        return {
            error:
                "No pudimos mandar el correo con el acceso. Revise que esté bien escrito e inténtelo de nuevo.",
        };
    }

    revalidatePath("/usuarios");
    return { ok: true };
}

/** Para quien aún no entra: una contraseña temporal nueva (la anterior deja de servir). */
export async function reenviarAcceso(id: string): Promise<{ error?: string }> {
    await exigirAdmin();

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) return { error: "No encontramos a ese usuario." };
    if (!usuario.activo) return { error: "Primero hay que activar al usuario." };
    if (!usuario.debeCambiarContrasena || !usuario.supabaseId) {
        return { error: "Esa persona ya eligió su contraseña." };
    }

    const contrasena = contrasenaTemporal();
    const { error } = await crearClienteSupabaseAdmin().auth.admin.updateUserById(
        usuario.supabaseId,
        { password: contrasena },
    );
    if (error) {
        console.error("[usuarios] No se cambió la contraseña temporal:", error);
        return { error: "No pudimos generar el acceso. Intente de nuevo." };
    }

    try {
        await mandarAcceso(usuario.correo, usuario.nombreCompleto, contrasena);
    } catch (error) {
        console.error("[usuarios] No salió el correo de acceso:", error);
        return { error: "No pudimos mandar el correo. Intente de nuevo." };
    }
    return {};
}

export async function cambiarRol(
    id: string,
    rol: Rol,
): Promise<{ error?: string }> {
    const admin = await exigirAdmin();
    if (id === admin.id) return { error: "No puede cambiar su propio rol." };
    if (!ROLES_EN_ORDEN.includes(rol)) return { error: "Rol no válido." };

    await prisma.usuario.update({ where: { id }, data: { rol } });
    revalidatePath("/usuarios");
    return {};
}

export async function cambiarActivo(
    id: string,
    activo: boolean,
): Promise<{ error?: string }> {
    const admin = await exigirAdmin();
    if (id === admin.id) return { error: "No puede desactivarse a sí mismo." };

    const usuario = await prisma.usuario.update({
        where: { id },
        data: { activo },
    });

    // Desactivar también le cierra la puerta en Supabase, para que no pueda
    // iniciar sesión mientras esté inactivo.
    if (usuario.supabaseId) {
        await crearClienteSupabaseAdmin().auth.admin.updateUserById(
            usuario.supabaseId,
            { ban_duration: activo ? "none" : "876000h" },
        );
    }

    revalidatePath("/usuarios");
    return {};
}