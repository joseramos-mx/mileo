-- El catalogo crece a lo que de verdad hace el laboratorio.
--
-- Tres cosas cambian de raiz:
--
-- 1. No todo se asigna a un diente. Una guarda oclusal, una protesis y un
--    modelo van sobre una arcada entera, asi que "diente" deja de ser
--    obligatorio y aparece "arcada". Lo que ya estaba capturado tiene diente,
--    asi que nada se pierde.
-- 2. "Puente" pasa a "Tramo". Un puente es solo uno de los trabajos que van
--    sobre dos o mas dientes unidos: tambien van ahi el segmento de barra y la
--    subestructura con alivio. El nombre tenia que decir la verdad de los tres.
-- 3. Cada trabajo pregunta lo suyo. Un aditamento pide sistema de implante, una
--    guarda pide grosor, una protesis pide color de encia y de dientes. Antes
--    todos preguntaban lo mismo y esos datos se escribian en las notas.

-- ------------------------------------------------------ materiales y metodos
ALTER TYPE "Material" ADD VALUE 'ZIRCONIO_ULTRAFINO';
ALTER TYPE "Material" ADD VALUE 'ZIRCONIO_SOBRE_TITANIO';
ALTER TYPE "Material" ADD VALUE 'CERAMICA_PRENSADA';
ALTER TYPE "Material" ADD VALUE 'PMMA_TRANSPARENTE';
ALTER TYPE "Material" ADD VALUE 'RESINA_TERMOPOLIMERIZABLE';
ALTER TYPE "Material" ADD VALUE 'RESINA_FLEXIBLE';
ALTER TYPE "MetodoDeFabricacion" ADD VALUE 'SINTERIZADO_LASER';

CREATE TYPE "Arcada" AS ENUM ('SUPERIOR', 'INFERIOR');
CREATE TYPE "Retencion" AS ENUM ('ATORNILLADA', 'CEMENTADA');

-- ----------------------------------------------------------- puente -> tramo
ALTER TABLE "Puente" RENAME TO "Tramo";
ALTER TABLE "Tramo" RENAME CONSTRAINT "Puente_pkey" TO "Tramo_pkey";
ALTER TABLE "Tramo" RENAME CONSTRAINT "Puente_casoId_fkey" TO "Tramo_casoId_fkey";
ALTER INDEX "Puente_casoId_idx" RENAME TO "Tramo_casoId_idx";

ALTER TABLE "Unidad" RENAME COLUMN "puenteId" TO "tramoId";
ALTER TABLE "Unidad" RENAME CONSTRAINT "Unidad_puenteId_fkey" TO "Unidad_tramoId_fkey";
ALTER INDEX "Unidad_puenteId_idx" RENAME TO "Unidad_tramoId_idx";

-- ------------------------------------------------------- alcance y campos
ALTER TABLE "Unidad" ALTER COLUMN "diente" DROP NOT NULL;

ALTER TABLE "Unidad"
  ADD COLUMN "arcada"          "Arcada",
  ADD COLUMN "esImplante"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sistemaImplante" TEXT,
  ADD COLUMN "retencion"       "Retencion",
  ADD COLUMN "espesorAlivioMm" DOUBLE PRECISION,
  ADD COLUMN "grosorMm"        DOUBLE PRECISION,
  ADD COLUMN "colorBase"       TEXT,
  ADD COLUMN "colorDientes"    TEXT,
  ADD COLUMN "troqueles"       BOOLEAN NOT NULL DEFAULT false;

-- De cada trabajo de arcada, uno por arcada: no hay dos guardas de arriba.
-- Las unidades por diente traen arcada nula, y en Postgres los nulos no chocan
-- entre si, asi que esta llave no las toca.
CREATE UNIQUE INDEX "Unidad_casoId_rol_arcada_key"
  ON "Unidad"("casoId", "rol", "arcada");

-- --------------------------------------------------------- catalogo completo
ALTER TABLE "Usuario"
  ADD COLUMN "catalogoCompleto" BOOLEAN NOT NULL DEFAULT false;
