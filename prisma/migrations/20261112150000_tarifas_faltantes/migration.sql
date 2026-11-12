-- Tarifas que faltaban: una fila por cada combinación de trabajo y material que
-- el catálogo (src/lib/trabajos.ts) permite y que todavía no tenía precio.
--
-- Nacen APAGADAS (activa = false) y con precio 0: mientras estén así no cobran
-- nada, y la pantalla sigue diciendo "Se cotiza aparte". Para ponerle precio a
-- una, en el Table Editor de Supabase: llena precioCentavos (en centavos: 1,150
-- pesos = 115000), revisa plazoClave y enciende activa.
--
-- plazoClave es el plazo más cercano por material y hay que revisarlo: los
-- metales y las resinas de mufla quedaron en REMOVIBLE_METALICO (4 a 5 días)
-- porque prometer de más es mejor que prometer de menos. Las combinaciones que
-- el laboratorio no vende se pueden borrar.
--
-- Es seguro correrla dos veces: no pisa precios ni ediciones que ya hayas hecho.

INSERT INTO "Tarifa"
  ("clave", "nombre", "precioCentavos", "roles", "materiales",
   "sobreImplante", "retencion", "prioridad", "incluidaConOtroTrabajo",
   "activa", "plazoClave")
VALUES

  -- Corona anatómica (por diente)
  ('CORONA_ANATOMICA__PMMA', 'Corona anatómica · PMMA', 0,
   ARRAY['CORONA_ANATOMICA']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('CORONA_ANATOMICA__METAL_PORCELANA', 'Corona anatómica · Metal-cerámica', 0,
   ARRAY['CORONA_ANATOMICA']::"RolDeUnidad"[], ARRAY['METAL_PORCELANA']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('CORONA_ANATOMICA__TITANIO', 'Corona anatómica · Titanio grado 5', 0,
   ARRAY['CORONA_ANATOMICA']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Cofia (por diente)
  ('COFIA__ZIRCONIO_MONOLITICO', 'Cofia · Zirconio monolítico', 0,
   ARRAY['COFIA']::"RolDeUnidad"[], ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),
  ('COFIA__DISILICATO_DE_LITIO', 'Cofia · Disilicato de litio', 0,
   ARRAY['COFIA']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('COFIA__CROMO_COBALTO', 'Cofia · Cobalto-cromo', 0,
   ARRAY['COFIA']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('COFIA__TITANIO', 'Cofia · Titanio grado 5', 0,
   ARRAY['COFIA']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Corona prensada (por diente)
  ('CORONA_PRENSADA__DISILICATO_DE_LITIO', 'Corona prensada · Disilicato de litio', 0,
   ARRAY['CORONA_PRENSADA']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('CORONA_PRENSADA__CERAMICA_PRENSADA', 'Corona prensada · Cerámica prensada', 0,
   ARRAY['CORONA_PRENSADA']::"RolDeUnidad"[], ARRAY['CERAMICA_PRENSADA']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),

  -- Corona cascarón (provisional) (por diente)
  ('CORONA_CASCARON__PMMA', 'Corona cascarón (provisional) · PMMA', 0,
   ARRAY['CORONA_CASCARON']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Cofia con alivio (por diente)
  ('COFIA_CON_ALIVIO__ZIRCONIO_MONOLITICO', 'Cofia con alivio · Zirconio monolítico', 0,
   ARRAY['COFIA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),
  ('COFIA_CON_ALIVIO__DISILICATO_DE_LITIO', 'Cofia con alivio · Disilicato de litio', 0,
   ARRAY['COFIA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('COFIA_CON_ALIVIO__CROMO_COBALTO', 'Cofia con alivio · Cobalto-cromo', 0,
   ARRAY['COFIA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('COFIA_CON_ALIVIO__TITANIO', 'Cofia con alivio · Titanio grado 5', 0,
   ARRAY['COFIA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Mockup (por diente)
  ('MOCKUP__PMMA', 'Mockup · PMMA', 0,
   ARRAY['MOCKUP']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('MOCKUP__RESINA_IMPRESION', 'Mockup · Resina impresa', 0,
   ARRAY['MOCKUP']::"RolDeUnidad"[], ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('MOCKUP__CERA_CALCINABLE', 'Mockup · Cera', 0,
   ARRAY['MOCKUP']::"RolDeUnidad"[], ARRAY['CERA_CALCINABLE']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Póntico anatómico (por diente)
  ('PONTICO_ANATOMICO__DISILICATO_DE_LITIO', 'Póntico anatómico · Disilicato de litio', 0,
   ARRAY['PONTICO_ANATOMICO']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('PONTICO_ANATOMICO__PMMA', 'Póntico anatómico · PMMA', 0,
   ARRAY['PONTICO_ANATOMICO']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('PONTICO_ANATOMICO__METAL_PORCELANA', 'Póntico anatómico · Metal-cerámica', 0,
   ARRAY['PONTICO_ANATOMICO']::"RolDeUnidad"[], ARRAY['METAL_PORCELANA']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('PONTICO_ANATOMICO__TITANIO', 'Póntico anatómico · Titanio grado 5', 0,
   ARRAY['PONTICO_ANATOMICO']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Póntico reducido (por diente)
  ('PONTICO_REDUCIDO__DISILICATO_DE_LITIO', 'Póntico reducido · Disilicato de litio', 0,
   ARRAY['PONTICO_REDUCIDO']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('PONTICO_REDUCIDO__CROMO_COBALTO', 'Póntico reducido · Cobalto-cromo', 0,
   ARRAY['PONTICO_REDUCIDO']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Póntico prensado (por diente)
  ('PONTICO_PRENSADO__DISILICATO_DE_LITIO', 'Póntico prensado · Disilicato de litio', 0,
   ARRAY['PONTICO_PRENSADO']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('PONTICO_PRENSADO__CERAMICA_PRENSADA', 'Póntico prensado · Cerámica prensada', 0,
   ARRAY['PONTICO_PRENSADO']::"RolDeUnidad"[], ARRAY['CERAMICA_PRENSADA']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),

  -- Póntico cascarón (provisional) (por diente)
  ('PONTICO_CASCARON__PMMA', 'Póntico cascarón (provisional) · PMMA', 0,
   ARRAY['PONTICO_CASCARON']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Incrustación inlay u onlay (por diente)
  ('INCRUSTACION__ZIRCONIO_MONOLITICO', 'Incrustación inlay u onlay · Zirconio monolítico', 0,
   ARRAY['INCRUSTACION']::"RolDeUnidad"[], ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),
  ('INCRUSTACION__RESINA_IMPRESION', 'Incrustación inlay u onlay · Resina impresa', 0,
   ARRAY['INCRUSTACION']::"RolDeUnidad"[], ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Incrustación con alivio (por diente)
  ('INCRUSTACION_CON_ALIVIO__DISILICATO_DE_LITIO', 'Incrustación con alivio · Disilicato de litio', 0,
   ARRAY['INCRUSTACION_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, false, 'DISILICATO'),
  ('INCRUSTACION_CON_ALIVIO__ZIRCONIO_MONOLITICO', 'Incrustación con alivio · Zirconio monolítico', 0,
   ARRAY['INCRUSTACION_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),

  -- Carilla (por diente)
  ('CARILLA__ZIRCONIO_ULTRAFINO', 'Carilla · Zirconio ultrafino', 0,
   ARRAY['CARILLA']::"RolDeUnidad"[], ARRAY['ZIRCONIO_ULTRAFINO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),
  ('CARILLA__RESINA_IMPRESION', 'Carilla · Resina impresa', 0,
   ARRAY['CARILLA']::"RolDeUnidad"[], ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Encerado anatómico (por diente)
  ('ENCERADO_ANATOMICO__CERA_CALCINABLE', 'Encerado anatómico · Cera', 0,
   ARRAY['ENCERADO_ANATOMICO']::"RolDeUnidad"[], ARRAY['CERA_CALCINABLE']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('ENCERADO_ANATOMICO__PMMA', 'Encerado anatómico · PMMA', 0,
   ARRAY['ENCERADO_ANATOMICO']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('ENCERADO_ANATOMICO__RESINA_IMPRESION', 'Encerado anatómico · Resina impresa', 0,
   ARRAY['ENCERADO_ANATOMICO']::"RolDeUnidad"[], ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Encerado reducido (por diente)
  ('ENCERADO_REDUCIDO__CERA_CALCINABLE', 'Encerado reducido · Cera', 0,
   ARRAY['ENCERADO_REDUCIDO']::"RolDeUnidad"[], ARRAY['CERA_CALCINABLE']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('ENCERADO_REDUCIDO__PMMA', 'Encerado reducido · PMMA', 0,
   ARRAY['ENCERADO_REDUCIDO']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('ENCERADO_REDUCIDO__RESINA_IMPRESION', 'Encerado reducido · Resina impresa', 0,
   ARRAY['ENCERADO_REDUCIDO']::"RolDeUnidad"[], ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Encerado de póntico (por diente)
  ('ENCERADO_DE_PONTICO__CERA_CALCINABLE', 'Encerado de póntico · Cera', 0,
   ARRAY['ENCERADO_DE_PONTICO']::"RolDeUnidad"[], ARRAY['CERA_CALCINABLE']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('ENCERADO_DE_PONTICO__PMMA', 'Encerado de póntico · PMMA', 0,
   ARRAY['ENCERADO_DE_PONTICO']::"RolDeUnidad"[], ARRAY['PMMA']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),
  ('ENCERADO_DE_PONTICO__RESINA_IMPRESION', 'Encerado de póntico · Resina impresa', 0,
   ARRAY['ENCERADO_DE_PONTICO']::"RolDeUnidad"[], ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, false, 'IMPRESOS'),

  -- Aditamento (por diente)
  ('ADITAMENTO__TITANIO', 'Aditamento · Titanio grado 5', 0,
   ARRAY['ADITAMENTO']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('ADITAMENTO__ZIRCONIO_SOBRE_TITANIO', 'Aditamento · Zirconio sobre base de titanio', 0,
   ARRAY['ADITAMENTO']::"RolDeUnidad"[], ARRAY['ZIRCONIO_SOBRE_TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),

  -- Pilar de barra (por diente)
  ('PILAR_DE_BARRA__TITANIO', 'Pilar de barra · Titanio grado 5', 0,
   ARRAY['PILAR_DE_BARRA']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('PILAR_DE_BARRA__CROMO_COBALTO', 'Pilar de barra · Cobalto-cromo', 0,
   ARRAY['PILAR_DE_BARRA']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Segmento de barra (por diente del tramo)
  ('SEGMENTO_DE_BARRA__TITANIO', 'Segmento de barra · Titanio grado 5', 0,
   ARRAY['SEGMENTO_DE_BARRA']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('SEGMENTO_DE_BARRA__CROMO_COBALTO', 'Segmento de barra · Cobalto-cromo', 0,
   ARRAY['SEGMENTO_DE_BARRA']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Subestructura con alivio (por diente del tramo)
  ('SUBESTRUCTURA_CON_ALIVIO__ZIRCONIO_MONOLITICO', 'Subestructura con alivio · Zirconio monolítico', 0,
   ARRAY['SUBESTRUCTURA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),
  ('SUBESTRUCTURA_CON_ALIVIO__CROMO_COBALTO', 'Subestructura con alivio · Cobalto-cromo', 0,
   ARRAY['SUBESTRUCTURA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('SUBESTRUCTURA_CON_ALIVIO__TITANIO', 'Subestructura con alivio · Titanio grado 5', 0,
   ARRAY['SUBESTRUCTURA_CON_ALIVIO']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Prótesis total (por arcada)
  ('PROTESIS_TOTAL__RESINA_TERMOPOLIMERIZABLE', 'Prótesis total · Resina termopolimerizable', 0,
   ARRAY['PROTESIS_TOTAL']::"RolDeUnidad"[], ARRAY['RESINA_TERMOPOLIMERIZABLE']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Prótesis parcial (por arcada)
  ('PROTESIS_PARCIAL__RESINA_FLEXIBLE', 'Prótesis parcial · Resina flexible', 0,
   ARRAY['PROTESIS_PARCIAL']::"RolDeUnidad"[], ARRAY['RESINA_FLEXIBLE']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),

  -- Corona telescópica primaria (por diente)
  ('TELESCOPICA_PRIMARIA__TITANIO', 'Corona telescópica primaria · Titanio grado 5', 0,
   ARRAY['TELESCOPICA_PRIMARIA']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('TELESCOPICA_PRIMARIA__CROMO_COBALTO', 'Corona telescópica primaria · Cobalto-cromo', 0,
   ARRAY['TELESCOPICA_PRIMARIA']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('TELESCOPICA_PRIMARIA__ZIRCONIO_MONOLITICO', 'Corona telescópica primaria · Zirconio monolítico', 0,
   ARRAY['TELESCOPICA_PRIMARIA']::"RolDeUnidad"[], ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   NULL, NULL, 0, false, false, 'ZIRCONIO'),

  -- Corona telescópica secundaria (por diente)
  ('TELESCOPICA_SECUNDARIA__CROMO_COBALTO', 'Corona telescópica secundaria · Cobalto-cromo', 0,
   ARRAY['TELESCOPICA_SECUNDARIA']::"RolDeUnidad"[], ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO'),
  ('TELESCOPICA_SECUNDARIA__TITANIO', 'Corona telescópica secundaria · Titanio grado 5', 0,
   ARRAY['TELESCOPICA_SECUNDARIA']::"RolDeUnidad"[], ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, false, 'REMOVIBLE_METALICO')
ON CONFLICT ("clave") DO NOTHING;

-- Corona cascarón y póntico cascarón en resina impresa son el provisional
-- impreso de la lista de precios ($350 por unidad): entran a esa tarifa en vez
-- de quedarse sin precio. Si no es así, quítalos de "roles" en esa fila.
UPDATE "Tarifa"
SET "roles" = ARRAY(
      SELECT DISTINCT unnest("roles" || ARRAY['CORONA_CASCARON','PONTICO_CASCARON']::"RolDeUnidad"[])
    ),
    "actualizadoEn" = CURRENT_TIMESTAMP
WHERE "clave" = 'PROVISIONAL_IMPRESO';
