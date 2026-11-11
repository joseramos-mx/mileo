-- AlterTable
ALTER TABLE "Caso" ADD COLUMN     "cotizacion" JSONB,
ADD COLUMN     "entregaRapida" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Tarifa" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioCentavos" INTEGER NOT NULL,
    "roles" "RolDeUnidad"[],
    "materiales" "Material"[],
    "sobreImplante" BOOLEAN,
    "retencion" "Retencion",
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "incluidaConOtroTrabajo" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "plazoClave" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "PlazoDeEntrega" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "diasEstandar" INTEGER NOT NULL,
    "diasEstandarMax" INTEGER,
    "diasRapido" INTEGER,
    "horaLimite" TEXT,
    "maxUnidadesPorPieza" INTEGER,
    "condicionRapida" TEXT,
    "diasPorPrueba" INTEGER,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlazoDeEntrega_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "DiaInhabil" (
    "fecha" DATE NOT NULL,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "DiaInhabil_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "AjustesDeCotizacion" (
    "id" TEXT NOT NULL DEFAULT 'unica',
    "recargoDiaSiguientePct" INTEGER NOT NULL DEFAULT 30,
    "recargoMismoDiaPct" INTEGER NOT NULL DEFAULT 50,
    "diasHabiles" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjustesDeCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarifa_plazoClave_idx" ON "Tarifa"("plazoClave");

-- AddForeignKey
ALTER TABLE "Tarifa" ADD CONSTRAINT "Tarifa_plazoClave_fkey" FOREIGN KEY ("plazoClave") REFERENCES "PlazoDeEntrega"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;
