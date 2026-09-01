-- CreateEnum
CREATE TYPE "CanalDeAviso" AS ENUM ('CORREO', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "EstadoDeAviso" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'OMITIDO');

-- CreateEnum
CREATE TYPE "TipoDeAviso" AS ENUM ('INVITACION', 'CASO_RECIBIDO', 'CAMBIO_DE_ETAPA', 'ESPERA_SU_APROBACION', 'RECORDATORIO_DE_APROBACION', 'RIESGO_DE_RETRASO', 'FECHA_RECORRIDA', 'CASO_ENTREGADO');

-- CreateTable
CREATE TABLE "Aviso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "casoId" TEXT,
    "tipo" "TipoDeAviso" NOT NULL,
    "canal" "CanalDeAviso" NOT NULL,
    "estado" "EstadoDeAviso" NOT NULL DEFAULT 'PENDIENTE',
    "clave" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "enviadoEn" TIMESTAMP(3),
    "ultimoError" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Aviso_clave_key" ON "Aviso"("clave");

-- CreateIndex
CREATE INDEX "Aviso_estado_creadoEn_idx" ON "Aviso"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "Aviso_casoId_idx" ON "Aviso"("casoId");

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aviso" ADD CONSTRAINT "Aviso_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
