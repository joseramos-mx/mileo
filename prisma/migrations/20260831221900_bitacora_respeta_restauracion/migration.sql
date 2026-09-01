-- Que una restauracion de respaldo no reescriba la bitacora (SKILL.md O-0).
--
-- Al restaurar, pg_restore inserta los eventos con su hash original. El trigger
-- de encadenado los recalculaba y podia romper la cadena si el orden fisico del
-- volcado no coincidia con el de la secuencia.
--
-- Ahora: si el evento ya trae hash y quien inserta NO es el rol de aplicacion
-- (es decir, es una restauracion hecha por el dueno de la base), se respeta el
-- hash original. La aplicacion nunca puede traer el suyo: se le recalcula
-- siempre, asi que no puede fabricar eslabones.

CREATE OR REPLACE FUNCTION mileo_bitacora_encadenar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  hash_previo text;
BEGIN
  IF current_user <> 'mileo_app'
     AND NEW."hash" IS NOT NULL
     AND NEW."hash" <> '' THEN
    RETURN NEW;
  END IF;

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
