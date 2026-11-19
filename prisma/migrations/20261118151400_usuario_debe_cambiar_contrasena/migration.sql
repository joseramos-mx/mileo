-- Quien da de alta la administración entra con una contraseña temporal y debe
-- elegir la suya antes de usar Mileo. Las cuentas que ya existen no cambian.
ALTER TABLE "Usuario" ADD COLUMN "debeCambiarContrasena" BOOLEAN NOT NULL DEFAULT false;
