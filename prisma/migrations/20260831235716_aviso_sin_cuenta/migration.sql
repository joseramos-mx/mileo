-- AlterTable
ALTER TABLE "Aviso" ADD COLUMN     "destinoCorreo" TEXT,
ADD COLUMN     "destinoTelefono" TEXT,
ALTER COLUMN "usuarioId" DROP NOT NULL;
