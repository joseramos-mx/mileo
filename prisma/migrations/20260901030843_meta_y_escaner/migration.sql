-- CreateEnum
CREATE TYPE "EstadoDelEscaner" AS ENUM ('LISTO', 'REQUIERE_REVISION', 'SIN_CONEXION');

-- AlterTable
ALTER TABLE "Clinica" ADD COLUMN     "metaMensual" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "Escaner" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "estado" "EstadoDelEscaner" NOT NULL DEFAULT 'LISTO',
    "licenciaVenceEn" TIMESTAMP(3),
    "fotoUrl" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escaner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Escaner_clinicaId_key" ON "Escaner"("clinicaId");

-- AddForeignKey
ALTER TABLE "Escaner" ADD CONSTRAINT "Escaner_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;
