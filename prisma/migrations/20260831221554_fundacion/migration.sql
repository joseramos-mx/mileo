-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DOCTOR', 'ASISTENTE', 'ADMISION', 'DISENO', 'MANUFACTURA', 'ACABADO', 'CALIDAD', 'DIRECCION');

-- CreateEnum
CREATE TYPE "Etapa" AS ENUM ('RECIBIDO', 'EN_REVISION', 'ACEPTADO', 'EN_DISENO', 'ESPERANDO_APROBACION', 'EN_FABRICACION', 'EN_CONTROL_DE_CALIDAD', 'LISTO_Y_EN_CAMINO', 'ENTREGADO', 'EN_PAUSA', 'REHACER');

-- CreateEnum
CREATE TYPE "Indicacion" AS ENUM ('CORONA_Y_PUENTE', 'SOBRE_IMPLANTE', 'INCRUSTACION_Y_CARILLA', 'PROVISIONAL', 'GUARDA_OCLUSAL', 'MODELO_3D');

-- CreateEnum
CREATE TYPE "TipoUnidad" AS ENUM ('CORONA', 'PILAR_DE_PUENTE', 'PONTICO', 'CORONA_SOBRE_IMPLANTE', 'ADITAMENTO', 'BARRA', 'INCRUSTACION_INLAY', 'INCRUSTACION_ONLAY', 'CARILLA', 'PROVISIONAL', 'GUARDA_OCLUSAL', 'MODELO');

-- CreateEnum
CREATE TYPE "Material" AS ENUM ('ZIRCONIO_MONOLITICO', 'ZIRCONIO_ESTRATIFICADO', 'DISILICATO_DE_LITIO', 'METAL_PORCELANA', 'CROMO_COBALTO', 'TITANIO', 'PMMA', 'RESINA_IMPRESION', 'CERA_CALCINABLE');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoArchivo" AS ENUM ('ESCANEO_PREPARACION', 'ESCANEO_ANTAGONISTA', 'REGISTRO_MORDIDA', 'FOTO_COLOR', 'DISENO', 'MALLA_LIGERA', 'FOTO_CALIDAD_AJUSTE', 'FOTO_CALIDAD_COLOR', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoArchivo" AS ENUM ('EN_PROCESO', 'COMPLETO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CASO_CREADO', 'CASO_ENVIADO', 'CASO_ACTUALIZADO', 'UNIDAD_AGREGADA', 'UNIDAD_MODIFICADA', 'UNIDAD_ELIMINADA', 'ETAPA_CAMBIADA', 'ARCHIVO_SUBIDO', 'ARCHIVO_ELIMINADO', 'DISENO_APROBADO', 'AJUSTE_SOLICITADO', 'MENSAJE_ENVIADO', 'RIESGO_MARCADO', 'FECHA_RECORRIDA', 'USUARIO_INVITADO', 'USUARIO_INGRESO', 'AVISO_PRIVACIDAD_ACEPTADO', 'RESPALDO_RESTAURADO');

-- CreateTable
CREATE TABLE "Clinica" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "telefono" TEXT,
    "hashContrasena" TEXT,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fotoUrl" TEXT,
    "clinicaId" TEXT,
    "avisoPrivacidadVersion" TEXT,
    "avisoPrivacidadAceptadoEn" TIMESTAMP(3),
    "avisoPorCorreo" BOOLEAN NOT NULL DEFAULT true,
    "avisoPorWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "invitadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitacion" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "clinicaId" TEXT,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "aceptadaEn" TIMESTAMP(3),
    "creadaPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "iniciales" TEXT NOT NULL,
    "nombreCompleto" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caso" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "tecnicoId" TEXT,
    "pacienteId" TEXT NOT NULL,
    "indicacion" "Indicacion" NOT NULL,
    "etapa" "Etapa" NOT NULL DEFAULT 'RECIBIDO',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'NORMAL',
    "notas" TEXT,
    "esBorrador" BOOLEAN NOT NULL DEFAULT true,
    "enviadoEn" TIMESTAMP(3),
    "aceptadoEn" TIMESTAMP(3),
    "fechaEntregaComprometida" TIMESTAMP(3),
    "entregadoEn" TIMESTAMP(3),
    "enRiesgo" BOOLEAN NOT NULL DEFAULT false,
    "motivoRiesgo" TEXT,
    "casoOrigenId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unidad" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "diente" INTEGER NOT NULL,
    "tipo" "TipoUnidad" NOT NULL,
    "material" "Material" NOT NULL,
    "color" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archivo" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoArchivo" NOT NULL,
    "extension" TEXT NOT NULL,
    "bytesTotales" BIGINT NOT NULL,
    "bytesRecibidos" BIGINT NOT NULL DEFAULT 0,
    "estado" "EstadoArchivo" NOT NULL DEFAULT 'EN_PROCESO',
    "rutaRelativa" TEXT NOT NULL,
    "sha256" TEXT,
    "subidoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoBitacora" (
    "id" TEXT NOT NULL,
    "secuencia" BIGSERIAL NOT NULL,
    "cadena" TEXT NOT NULL,
    "casoId" TEXT,
    "usuarioId" TEXT,
    "tipo" "TipoEvento" NOT NULL,
    "etapaAnterior" "Etapa",
    "etapaNueva" "Etapa",
    "resumen" TEXT NOT NULL,
    "datos" JSONB,
    "hashPrevio" TEXT NOT NULL DEFAULT '',
    "hash" TEXT NOT NULL DEFAULT '',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoBitacora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Usuario_clinicaId_idx" ON "Usuario"("clinicaId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_token_key" ON "Invitacion"("token");

-- CreateIndex
CREATE INDEX "Invitacion_correo_idx" ON "Invitacion"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_tokenHash_key" ON "Sesion"("tokenHash");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_clinicaId_folio_key" ON "Paciente"("clinicaId", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "Caso_folio_key" ON "Caso"("folio");

-- CreateIndex
CREATE INDEX "Caso_clinicaId_etapa_idx" ON "Caso"("clinicaId", "etapa");

-- CreateIndex
CREATE INDEX "Caso_doctorId_idx" ON "Caso"("doctorId");

-- CreateIndex
CREATE INDEX "Caso_fechaEntregaComprometida_idx" ON "Caso"("fechaEntregaComprometida");

-- CreateIndex
CREATE INDEX "Unidad_casoId_idx" ON "Unidad"("casoId");

-- CreateIndex
CREATE UNIQUE INDEX "Unidad_casoId_diente_key" ON "Unidad"("casoId", "diente");

-- CreateIndex
CREATE INDEX "Archivo_casoId_idx" ON "Archivo"("casoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoBitacora_secuencia_key" ON "EventoBitacora"("secuencia");

-- CreateIndex
CREATE INDEX "EventoBitacora_casoId_secuencia_idx" ON "EventoBitacora"("casoId", "secuencia");

-- CreateIndex
CREATE INDEX "EventoBitacora_cadena_secuencia_idx" ON "EventoBitacora"("cadena", "secuencia");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_invitadoPorId_fkey" FOREIGN KEY ("invitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitacion" ADD CONSTRAINT "Invitacion_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitacion" ADD CONSTRAINT "Invitacion_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "Clinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_casoOrigenId_fkey" FOREIGN KEY ("casoOrigenId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoBitacora" ADD CONSTRAINT "EventoBitacora_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoBitacora" ADD CONSTRAINT "EventoBitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
