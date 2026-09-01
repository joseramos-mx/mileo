-- Bitacora inmutable (SKILL.md O-0).
--
-- Dos garantias, las dos dentro de la base de datos y no en el codigo de la
-- aplicacion, para que ningun camino -- ni la API, ni un script, ni psql --
-- pueda saltarselas:
--
--   1. UPDATE, DELETE y TRUNCATE sobre "EventoBitacora" fallan siempre.
--   2. Cada evento guarda el hash del evento anterior de su misma cadena, asi
--      que cualquier alteracion o hueco rompe la verificacion de forma visible.

-- ---------------------------------------------------------------- hash

CREATE OR REPLACE FUNCTION mileo_bitacora_hash(
  p_hash_previo    text,
  p_id             text,
  p_secuencia      bigint,
  p_cadena         text,
  p_tipo           text,
  p_caso           text,
  p_usuario        text,
  p_etapa_anterior text,
  p_etapa_nueva    text,
  p_resumen        text,
  p_datos          text,
  p_creado         timestamptz
) RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT encode(
    sha256(
      convert_to(
        concat_ws('|',
          coalesce(p_hash_previo, ''),
          coalesce(p_id, ''),
          coalesce(p_secuencia::text, ''),
          coalesce(p_cadena, ''),
          coalesce(p_tipo, ''),
          coalesce(p_caso, ''),
          coalesce(p_usuario, ''),
          coalesce(p_etapa_anterior, ''),
          coalesce(p_etapa_nueva, ''),
          coalesce(p_resumen, ''),
          coalesce(p_datos, ''),
          to_char(p_creado AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')
        ),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

-- ---------------------------------------------------------------- encadenado

CREATE OR REPLACE FUNCTION mileo_bitacora_encadenar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hash_previo text;
BEGIN
  -- Serializa las escrituras de una misma cadena para que dos eventos
  -- simultaneos no tomen el mismo eslabon anterior.
  PERFORM pg_advisory_xact_lock(hashtext(NEW."cadena"));

  SELECT e."hash" INTO hash_previo
  FROM "EventoBitacora" e
  WHERE e."cadena" = NEW."cadena"
  ORDER BY e."secuencia" DESC
  LIMIT 1;

  NEW."hashPrevio" := coalesce(hash_previo, repeat('0', 64));
  NEW."hash" := mileo_bitacora_hash(
    NEW."hashPrevio",
    NEW."id",
    NEW."secuencia",
    NEW."cadena",
    NEW."tipo"::text,
    NEW."casoId",
    NEW."usuarioId",
    NEW."etapaAnterior"::text,
    NEW."etapaNueva"::text,
    NEW."resumen",
    NEW."datos"::text,
    NEW."creadoEn"
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER bitacora_encadenar
  BEFORE INSERT ON "EventoBitacora"
  FOR EACH ROW EXECUTE FUNCTION mileo_bitacora_encadenar();

-- ---------------------------------------------------------------- inmutable

CREATE OR REPLACE FUNCTION mileo_bitacora_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'La bitacora de Mileo es inmutable: % no esta permitido sobre EventoBitacora',
    TG_OP
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER bitacora_sin_cambios
  BEFORE UPDATE OR DELETE ON "EventoBitacora"
  FOR EACH ROW EXECUTE FUNCTION mileo_bitacora_inmutable();

CREATE TRIGGER bitacora_sin_truncate
  BEFORE TRUNCATE ON "EventoBitacora"
  FOR EACH STATEMENT EXECUTE FUNCTION mileo_bitacora_inmutable();

-- ---------------------------------------------------------------- verificacion

-- Recorre la bitacora entera y devuelve un renglon por cada eslabon roto.
-- Sin resultados = bitacora integra.
CREATE OR REPLACE FUNCTION mileo_bitacora_verificar()
RETURNS TABLE (cadena text, secuencia bigint, evento text, motivo text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  r              record;
  cadena_actual  text := NULL;
  ultimo_hash    text := NULL;
  hash_esperado  text;
BEGIN
  FOR r IN
    SELECT * FROM "EventoBitacora" ORDER BY "cadena", "secuencia"
  LOOP
    IF cadena_actual IS DISTINCT FROM r."cadena" THEN
      cadena_actual := r."cadena";
      ultimo_hash := repeat('0', 64);
    END IF;

    hash_esperado := mileo_bitacora_hash(
      r."hashPrevio", r."id", r."secuencia", r."cadena", r."tipo"::text,
      r."casoId", r."usuarioId", r."etapaAnterior"::text, r."etapaNueva"::text,
      r."resumen", r."datos"::text, r."creadoEn"
    );

    IF r."hashPrevio" <> ultimo_hash THEN
      cadena := r."cadena";
      secuencia := r."secuencia";
      evento := r."id";
      motivo := 'el eslabon anterior no coincide: falta un evento o se altero';
      RETURN NEXT;
    ELSIF r."hash" <> hash_esperado THEN
      cadena := r."cadena";
      secuencia := r."secuencia";
      evento := r."id";
      motivo := 'el contenido del evento no corresponde a su hash';
      RETURN NEXT;
    END IF;

    ultimo_hash := r."hash";
  END LOOP;
END;
$$;
