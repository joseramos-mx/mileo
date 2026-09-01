-- Rol de aplicacion con el minimo de permisos (SKILL.md O-0).
--
-- Las migraciones corren con el rol dueno (mileo). La aplicacion se conecta con
-- "mileo_app", que puede leer y escribir todo menos alterar la bitacora: sobre
-- "EventoBitacora" solo tiene SELECT e INSERT. Asi la inmutabilidad no depende
-- unicamente de los triggers, sino tambien de los permisos: aunque alguien
-- lograra ejecutar SQL arbitrario con las credenciales de la aplicacion, no
-- podria borrar ni editar un evento.
--
-- El rol nace sin contrasena y sin LOGIN. Cada ambiente le asigna la suya con
-- `npm run bd:rol-aplicacion`, leyendo MILEO_BD_CONTRASENA_APP.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mileo_app') THEN
    CREATE ROLE mileo_app NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO mileo_app;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO mileo_app;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO mileo_app;

-- Las tablas que creen las migraciones futuras heredan estos permisos.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mileo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mileo_app;

-- La bitacora solo se lee y se agrega.
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoBitacora" FROM mileo_app;

-- El historial de migraciones tampoco lo toca la aplicacion.
-- La base espejo que usa Prisma para comparar el esquema no tiene esa tabla,
-- asi que se revoca solo si existe.
DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    REVOKE ALL ON "_prisma_migrations" FROM mileo_app;
  END IF;
END
$$;
