-- El catalogo de trabajos crece al que ya usan los tecnicos en exocad: 29
-- tipos agrupados en ocho categorias, cada uno con su color.
--
-- Lo capturado no se pierde: se traduce al tipo equivalente antes de tirar el
-- enum viejo. "Pilar" deja de ser un tipo propio, porque en un puente el papel
-- de cada pieza lo manda su lugar, no lo que se escogio: un pilar es la corona
-- que va en la punta. Se convierte en corona anatomica y el puente lo vuelve a
-- deducir.

CREATE TYPE "RolDeUnidad_nuevo" AS ENUM (
  'CORONA_ANATOMICA', 'COFIA', 'CORONA_PRENSADA', 'CORONA_CASCARON',
  'COFIA_CON_ALIVIO', 'MOCKUP',
  'PONTICO_ANATOMICO', 'PONTICO_REDUCIDO', 'PONTICO_PRENSADO', 'PONTICO_CASCARON',
  'INCRUSTACION', 'INCRUSTACION_CON_ALIVIO', 'CARILLA',
  'ENCERADO_ANATOMICO', 'ENCERADO_REDUCIDO', 'ENCERADO_DE_PONTICO',
  'PROTESIS_TOTAL', 'PROTESIS_PARCIAL', 'GUARDA_OCLUSAL',
  'TELESCOPICA_PRIMARIA', 'TELESCOPICA_SECUNDARIA', 'ADITAMENTO',
  'PILAR_DE_BARRA', 'SEGMENTO_DE_BARRA', 'SUBESTRUCTURA_CON_ALIVIO',
  'MODELO',
  'ANTAGONISTA', 'DIENTE_VECINO', 'OMITIR_EN_PUENTE'
);

ALTER TABLE "Unidad"
  ALTER COLUMN "rol" TYPE "RolDeUnidad_nuevo"
  USING (CASE "rol"::text
    WHEN 'CORONA'        THEN 'CORONA_ANATOMICA'
    WHEN 'PILAR'         THEN 'CORONA_ANATOMICA'
    WHEN 'PONTICO'       THEN 'PONTICO_ANATOMICO'
    WHEN 'CARILLA'       THEN 'CARILLA'
    WHEN 'INCRUSTACION'  THEN 'INCRUSTACION'
    WHEN 'ADITAMENTO'    THEN 'ADITAMENTO'
    -- El provisional que se fresaba en PMMA es la corona cascaron del catalogo.
    WHEN 'PROVISIONAL'   THEN 'CORONA_CASCARON'
    WHEN 'GUARDA_OCLUSAL' THEN 'GUARDA_OCLUSAL'
    WHEN 'MODELO'        THEN 'MODELO'
    WHEN 'BARRA'         THEN 'SEGMENTO_DE_BARRA'
    ELSE 'CORONA_ANATOMICA'
  END)::"RolDeUnidad_nuevo";

DROP TYPE "RolDeUnidad";
ALTER TYPE "RolDeUnidad_nuevo" RENAME TO "RolDeUnidad";
