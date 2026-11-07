
CREATE TYPE "Rol_nuevo" AS ENUM ('ADMIN', 'LABORATORIO', 'CLINICA');

ALTER TABLE "Usuario"
  ALTER COLUMN "rol" TYPE "Rol_nuevo"
  USING (CASE "rol"::text
    WHEN 'DIRECCION' THEN 'ADMIN'
    WHEN 'DOCTOR'    THEN 'CLINICA'
    WHEN 'ASISTENTE' THEN 'CLINICA'
    ELSE 'LABORATORIO'
  END)::"Rol_nuevo";

ALTER TABLE "Invitacion"
  ALTER COLUMN "rol" TYPE "Rol_nuevo"
  USING (CASE "rol"::text
    WHEN 'DIRECCION' THEN 'ADMIN'
    WHEN 'DOCTOR'    THEN 'CLINICA'
    WHEN 'ASISTENTE' THEN 'CLINICA'
    ELSE 'LABORATORIO'
  END)::"Rol_nuevo";

DROP TYPE "Rol";
ALTER TYPE "Rol_nuevo" RENAME TO "Rol";

ALTER TABLE "Usuario"
  DROP COLUMN "hashContrasena",
  ADD COLUMN "supabaseId" UUID;

CREATE UNIQUE INDEX "Usuario_supabaseId_key" ON "Usuario"("supabaseId");

DROP TABLE "Sesion";

