-- Con que se fabrica cada pieza. El laboratorio lo necesita para saber a que
-- maquina va: no es lo mismo fresar zirconio que imprimir una guarda.
--
-- Nace vacio a proposito: los casos que ya estaban capturados no dicen con que
-- se iban a hacer, y ponerles "fresado" de oficio seria inventar un dato que
-- nadie escogio. La pantalla lo pide al abrir el diente.
CREATE TYPE "MetodoDeFabricacion" AS ENUM (
  'FRESADO', 'IMPRESO_3D', 'PRENSADO', 'COLADO', 'TERMOFORMADO'
);

ALTER TABLE "Unidad" ADD COLUMN "metodo" "MetodoDeFabricacion";
