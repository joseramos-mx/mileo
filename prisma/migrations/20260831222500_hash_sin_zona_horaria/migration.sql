-- El hash de la bitacora no puede depender de la zona horaria de la sesion.
--
-- La version anterior recibia la fecha como timestamptz y la formateaba con
-- `AT TIME ZONE 'UTC'`. Como "creadoEn" es un timestamp sin zona, Postgres hacia
-- una conversion implicita usando el TimeZone de la sesion: el mismo evento
-- daba hashes distintos segun quien lo leyera, y una restauracion en otra
-- sesion aparecia como cadena rota aunque los datos fueran correctos.
--
-- Ahora la fecha entra tal cual, como timestamp, y se formatea sin conversion.

DROP FUNCTION IF EXISTS mileo_bitacora_hash(
  text, text, bigint, text, text, text, text, text, text, text, text, timestamptz
);

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
  p_creado         timestamp
) RETURNS text
LANGUAGE sql
IMMUTABLE
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
          to_char(p_creado, 'YYYY-MM-DD HH24:MI:SS.US')
        ),
        'UTF8'
      )
    ),
    'hex'
  );
$$;
