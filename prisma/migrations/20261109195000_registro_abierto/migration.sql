-- Registro abierto de clínicas.

-- La bitácora anota cuando una cuenta nueva confirma su correo.
ALTER TYPE "TipoEvento" ADD VALUE IF NOT EXISTS 'USUARIO_REGISTRADO';

-- Dónde se entregan las piezas. Nace vacía: se completa en ajustes, antes de
-- enviar el primer caso, para no pedirla al registrarse.
ALTER TABLE "Clinica" ADD COLUMN "direccionEntrega" TEXT;
