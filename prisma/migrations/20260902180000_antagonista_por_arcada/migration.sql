-- El antagonista se marca por arcada, no diente por diente.
--
-- Es la arcada opuesta entera lo que se escanea para ajustar la oclusion:
-- marcarlo diente por diente era pedir catorce toques para decir una cosa.
-- Pasa a ser de alcance por arcada, sin dejar de ser una anotacion: no se
-- fabrica, no se cotiza y no cuenta para los puntos.
--
-- Lo capturado se convierte: cada antagonista suelto se vuelve la marca de su
-- arcada. Si un caso tenia varios de la misma arcada, quedan en uno solo.

UPDATE "Unidad"
   SET arcada = CASE WHEN diente BETWEEN 11 AND 28 THEN 'SUPERIOR'::"Arcada"
                     ELSE 'INFERIOR'::"Arcada" END,
       diente = NULL
 WHERE rol = 'ANTAGONISTA'
   AND diente IS NOT NULL
   -- Si ya existiera la marca de esa arcada, este renglon se borra abajo.
   AND NOT EXISTS (
     SELECT 1 FROM "Unidad" otra
      WHERE otra."casoId" = "Unidad"."casoId"
        AND otra.rol = 'ANTAGONISTA'
        AND otra.diente IS NULL
        AND otra.arcada = CASE WHEN "Unidad".diente BETWEEN 11 AND 28
                               THEN 'SUPERIOR'::"Arcada" ELSE 'INFERIOR'::"Arcada" END
   );

DELETE FROM "Unidad" WHERE rol = 'ANTAGONISTA' AND diente IS NOT NULL;
