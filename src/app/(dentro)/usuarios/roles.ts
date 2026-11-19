import type { Rol } from "@/generated/prisma/enums";

/** Cómo se llama cada rol en pantalla. */
export const ETIQUETAS_DE_ROL: Record<Rol, string> = {
    ADMIN: "Administración",
    LABORATORIO: "Laboratorio",
    CLINICA: "Clínica",
};

export const ROLES_EN_ORDEN: Rol[] = ["ADMIN", "LABORATORIO", "CLINICA"];