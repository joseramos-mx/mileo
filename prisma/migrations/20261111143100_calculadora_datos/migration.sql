-- Calculadora de precios y fecha de entrega: RLS y datos iniciales.
--
-- Va después de la migración `calculadora`, que crea las tablas. Es seguro
-- correrlo dos veces: no pisa precios, plazos ni ajustes que ya se hayan editado.
-- Los cambios de precio de aquí en adelante se hacen en la tabla, no con otra
-- migración.

-- Supabase expone `public` por la API REST. Estas tablas sólo las lee la
-- aplicación con Prisma (que entra con un rol que se salta RLS), así que se
-- enciende RLS sin políticas: la API pública no ve nada.
ALTER TABLE "Tarifa"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlazoDeEntrega"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiaInhabil"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AjustesDeCotizacion" ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ ajustes
INSERT INTO "AjustesDeCotizacion" ("id") VALUES ('unica')
ON CONFLICT ("id") DO NOTHING;

-- ------------------------------------------------------------------- plazos
-- Días hábiles. 0 en `diasRapido` es el mismo día.
INSERT INTO "PlazoDeEntrega"
  ("clave", "nombre", "diasEstandar", "diasEstandarMax", "diasRapido",
   "horaLimite", "maxUnidadesPorPieza", "condicionRapida", "diasPorPrueba")
VALUES
  ('ZIRCONIO', 'Zirconia monolítica (corona o puente corto)',
   2, NULL, 1, '11:00', 3, 'El diseño se aprueba ese mismo día.', NULL),
  ('DISILICATO', 'Disilicato monolítico',
   1, NULL, 0, '10:00', NULL, NULL, NULL),
  ('IMPRESOS', 'Impresos (provisionales, guías, modelos)',
   1, NULL, 0, '12:00', NULL, NULL, NULL),
  ('PROTESIS_TOTAL_IMPRESA', 'Prótesis total impresa',
   2, NULL, 1, NULL, NULL, 'Sólo si se imprime en una sola pieza.', NULL),
  ('REMOVIBLE_METALICO', 'Removible metálico (titanio o cromo-cobalto)',
   4, 5, 3, NULL, NULL, NULL, 2)
ON CONFLICT ("clave") DO NOTHING;

-- ------------------------------------------------------------------ tarifas
-- Precios en centavos: 115000 = $1,150.
INSERT INTO "Tarifa"
  ("clave", "nombre", "precioCentavos", "roles", "materiales",
   "sobreImplante", "retencion", "prioridad", "incluidaConOtroTrabajo",
   "plazoClave")
VALUES
  -- Un puente de zirconia cobra cada unidad, pilar o póntico, como corona.
  ('ZIRCONIO_MONOLITICO', 'Zirconia monolítica', 115000,
   ARRAY['CORONA_ANATOMICA','PONTICO_ANATOMICO','PONTICO_REDUCIDO']::"RolDeUnidad"[],
   ARRAY['ZIRCONIO_MONOLITICO']::"Material"[],
   false, NULL, 0, false, 'ZIRCONIO'),

  ('ZIRCONIO_MULTICAPA', 'Zirconia multicapa', 135000,
   ARRAY['CORONA_ANATOMICA','PONTICO_ANATOMICO','PONTICO_REDUCIDO']::"RolDeUnidad"[],
   ARRAY['ZIRCONIO_ESTRATIFICADO']::"Material"[],
   false, NULL, 0, false, 'ZIRCONIO'),

  ('DISILICATO_CORONA', 'Disilicato monolítico, maquillada', 140000,
   ARRAY['CORONA_ANATOMICA']::"RolDeUnidad"[],
   ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   false, NULL, 0, false, 'DISILICATO'),

  ('DISILICATO_CARILLA_INCRUSTACION', 'Carilla o incrustación de disilicato', 155000,
   ARRAY['CARILLA','INCRUSTACION']::"RolDeUnidad"[],
   ARRAY['DISILICATO_DE_LITIO']::"Material"[],
   NULL, NULL, 0, false, 'DISILICATO'),

  -- Gana a la corona de zirconia cuando va sobre implante y atornillada.
  -- Incluye la ti-base genérica.
  ('CORONA_ATORNILLADA_SOBRE_IMPLANTE', 'Corona atornillada sobre implante (incluye ti-base genérica)', 230000,
   ARRAY['CORONA_ANATOMICA']::"RolDeUnidad"[],
   ARRAY['ZIRCONIO_MONOLITICO','ZIRCONIO_ESTRATIFICADO']::"Material"[],
   true, 'ATORNILLADA', 10, false, 'ZIRCONIO'),

  ('PROVISIONAL_IMPRESO', 'Provisional impreso', 35000,
   ARRAY['CORONA_ANATOMICA','PONTICO_ANATOMICO']::"RolDeUnidad"[],
   ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, 'IMPRESOS'),

  -- Va incluido con el caso; cuesta 300 por arcada sólo si se pide solo.
  ('MODELO_IMPRESO', 'Modelo impreso', 30000,
   ARRAY['MODELO']::"RolDeUnidad"[],
   ARRAY[]::"Material"[],
   NULL, NULL, 0, true, 'IMPRESOS'),

  ('GUARDA_OCLUSAL', 'Guarda oclusal', 95000,
   ARRAY['GUARDA_OCLUSAL']::"RolDeUnidad"[],
   ARRAY[]::"Material"[],
   NULL, NULL, 0, false, 'IMPRESOS'),

  ('PROTESIS_TOTAL_IMPRESA', 'Prótesis total impresa', 380000,
   ARRAY['PROTESIS_TOTAL']::"RolDeUnidad"[],
   ARRAY['RESINA_IMPRESION']::"Material"[],
   NULL, NULL, 0, false, 'PROTESIS_TOTAL_IMPRESA'),

  ('REMOVIBLE_CROMO_COBALTO', 'Removible con estructura de cromo-cobalto', 420000,
   ARRAY['PROTESIS_PARCIAL']::"RolDeUnidad"[],
   ARRAY['CROMO_COBALTO']::"Material"[],
   NULL, NULL, 0, false, 'REMOVIBLE_METALICO'),

  ('REMOVIBLE_TITANIO', 'Removible con estructura de titanio', 580000,
   ARRAY['PROTESIS_PARCIAL']::"RolDeUnidad"[],
   ARRAY['TITANIO']::"Material"[],
   NULL, NULL, 0, false, 'REMOVIBLE_METALICO')
ON CONFLICT ("clave") DO NOTHING;

-- ----------------------------------------------------------- días inhábiles
-- Feriados federales. Agregue aquí los cierres del laboratorio (vacaciones,
-- puentes) y la calculadora los salta al contar los días hábiles.
INSERT INTO "DiaInhabil" ("fecha", "motivo") VALUES
  ('2026-11-16', 'Aniversario de la Revolución'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-02-01', 'Día de la Constitución'),
  ('2027-03-15', 'Natalicio de Benito Juárez'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-09-16', 'Día de la Independencia'),
  ('2027-11-15', 'Aniversario de la Revolución'),
  ('2027-12-25', 'Navidad')
ON CONFLICT ("fecha") DO NOTHING;
