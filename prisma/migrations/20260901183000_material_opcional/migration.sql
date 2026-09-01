-- El antagonista, el diente vecino y el "omitir en el puente" no se fabrican:
-- son anotaciones sobre ese diente. No tienen material porque no hay pieza que
-- hacer, y guardarles uno de mentiras seria escribir en el caso algo que no es.
ALTER TABLE "Unidad" ALTER COLUMN "material" DROP NOT NULL;
