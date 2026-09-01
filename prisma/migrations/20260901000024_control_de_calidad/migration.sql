-- CreateTable
CREATE TABLE "ControlDeCalidad" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "revisadoPorId" TEXT NOT NULL,
    "kit" JSONB NOT NULL,
    "numeroDeGuia" TEXT,
    "enlaceDeRastreo" TEXT,
    "autorizadoPorId" TEXT,
    "motivoDeAutorizacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlDeCalidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ControlDeCalidad_casoId_key" ON "ControlDeCalidad"("casoId");

-- CreateIndex
CREATE INDEX "ControlDeCalidad_revisadoPorId_idx" ON "ControlDeCalidad"("revisadoPorId");

-- AddForeignKey
ALTER TABLE "ControlDeCalidad" ADD CONSTRAINT "ControlDeCalidad_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlDeCalidad" ADD CONSTRAINT "ControlDeCalidad_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlDeCalidad" ADD CONSTRAINT "ControlDeCalidad_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
