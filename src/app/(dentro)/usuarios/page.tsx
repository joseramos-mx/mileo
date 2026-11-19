import { exigirAdmin } from "@/lib/autorizacion";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utilidades";
import { ControlesDeUsuario } from "./ControlesDeUsuario";
import { NuevoUsuario } from "./NuevoUsuario";
import { ETIQUETAS_DE_ROL } from "./roles";

/**
 * Configuración de usuarios: solo la administración. El laboratorio no entra
 * aquí; `exigirAdmin` lo devuelve al inicio.
 */
export default async function PaginaDeUsuarios() {
    const yo = await exigirAdmin();

    const [usuarios, clinicas] = await Promise.all([
        prisma.usuario.findMany({
            orderBy: [{ activo: "desc" }, { nombreCompleto: "asc" }],
            include: { clinica: { select: { nombre: true } } },
        }),
        prisma.clinica.findMany({
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true },
        }),
    ]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-primario">Usuarios</h1>
                    <p className="text-menor text-secundario">
                        {usuarios.length} en total. Aquí se invita, se cambia el rol y se
                        desactiva el acceso.
                    </p>
                </div>
                <NuevoUsuario clinicas={clinicas} />
            </div>

            <ul className="vidrio flex flex-col divide-y divide-borde rounded-contenedor">
                {usuarios.map((u) => (
                    <li
                        key={u.id}
                        className={cn(
                            "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                            !u.activo && "opacity-60",
                        )}
                    >
                        <div className="min-w-0">
                            <p className="truncate text-cuerpo font-semibold text-primario">
                                {u.nombreCompleto}
                                {u.id === yo.id ? " (usted)" : ""}
                            </p>
                            <p className="truncate text-menor text-secundario">{u.correo}</p>
                            <p className="text-menor text-secundario">
                                {ETIQUETAS_DE_ROL[u.rol]}
                                {u.clinica ? ` · ${u.clinica.nombre}` : ""}
                                {!u.activo ? " · Inactivo" : ""}
                                {u.activo && u.debeCambiarContrasena
                                    ? " · Aún no elige su contraseña"
                                    : ""}
                            </p>
                        </div>
                        <ControlesDeUsuario
                            id={u.id}
                            nombre={u.nombreCompleto}
                            rol={u.rol}
                            activo={u.activo}
                            pendiente={u.debeCambiarContrasena}
                            esYo={u.id === yo.id}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}