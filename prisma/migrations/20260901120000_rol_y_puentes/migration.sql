-- La unidad pasa de "tipo" a "rol", y aparecen los puentes.
--
-- Un puente es un grupo de unidades conectadas: los extremos son PILAR y lo de
-- en medio, PONTICO. Con eso un puente 14-17 queda sin ambiguedad: cuatro
-- unidades con el mismo puenteId, 14 y 17 pilares, 15 y 16 ponticos.
--
-- Los casos que ya existen NO se pierden: la columna vieja se convierte antes
-- de borrarse. Un caso de un doctor es su historia clinica; no se tira por un
-- cambio de nombre de un campo.

CREATE TYPE "RolDeUnidad" AS ENUM (
  'CORONA', 'PILAR', 'PONTICO', 'CARILLA', 'INCRUSTACION', 'ADITAMENTO',
  'PROVISIONAL', 'GUARDA_OCLUSAL', 'MODELO', 'BARRA'
);

ALTER TABLE "Unidad"
  ADD COLUMN "notas"    TEXT,
  ADD COLUMN "puenteId" TEXT,
  ADD COLUMN "rol"      "RolDeUnidad";

-- Se traduce lo que ya estaba capturado.
UPDATE "Unidad" SET "rol" = CASE "tipo"::text
  WHEN 'CORONA'                 THEN 'CORONA'
  WHEN 'PILAR_DE_PUENTE'        THEN 'PILAR'
  WHEN 'PONTICO'                THEN 'PONTICO'
  -- La corona sobre implante sigue siendo una corona; que va sobre implante lo
  -- dice la indicacion del caso, no el rol de la unidad.
  WHEN 'CORONA_SOBRE_IMPLANTE'  THEN 'CORONA'
  WHEN 'ADITAMENTO'             THEN 'ADITAMENTO'
  WHEN 'BARRA'                  THEN 'BARRA'
  WHEN 'INCRUSTACION_INLAY'     THEN 'INCRUSTACION'
  WHEN 'INCRUSTACION_ONLAY'     THEN 'INCRUSTACION'
  WHEN 'CARILLA'                THEN 'CARILLA'
  WHEN 'PROVISIONAL'            THEN 'PROVISIONAL'
  WHEN 'GUARDA_OCLUSAL'         THEN 'GUARDA_OCLUSAL'
  WHEN 'MODELO'                 THEN 'MODELO'
  ELSE 'CORONA'
END::"RolDeUnidad";

ALTER TABLE "Unidad" ALTER COLUMN "rol" SET NOT NULL;
ALTER TABLE "Unidad" DROP COLUMN "tipo";
DROP TYPE "TipoUnidad";

CREATE TABLE "Puente" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Puente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Puente_casoId_idx" ON "Puente"("casoId");
CREATE INDEX "Unidad_puenteId_idx" ON "Unidad"("puenteId");

ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_puenteId_fkey"
  FOREIGN KEY ("puenteId") REFERENCES "Puente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Puente" ADD CONSTRAINT "Puente_casoId_fkey"
  FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
