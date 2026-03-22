-- =============================================================================
-- 011_catalog_data.sql
-- Seed de datos del catálogo de equipos: Catálogo > Marca > Familia > Modelo
--
-- IMPORTANTE: Este archivo usa los IDs REALES de la base de datos en producción.
--   Los IDs del archivo 004_data.sql NO coinciden con el live DB.
--   Este archivo fue generado consultando el live DB directamente.
--
-- CRITERIOS:
--   • ON CONFLICT DO NOTHING — idempotente, se puede re-ejecutar sin riesgo
--   • Se reutilizan los IDs vivos de categorías/marcas/familias ya existentes
--   • Solo se insertan registros nuevos cuando no existe el equivalente en la DB
--
-- IDs de categorías en el LIVE DB:
--   SmartPhone  → 7aadc364-a188-42f1-8d1e-64e9918801ad  (existente)
--   Tablet      → 0fe48747-6219-4a5d-bce4-4082102ec1fa  (existente)
--   Laptop      → 202603cat000000000000001              (nuevo)
--   Consola     → 202603cat000000000000002              (nuevo)
--
-- IDs de marcas en el LIVE DB:
--   Apple  / SmartPhone  → de31f908-b1e3-4cba-bd0a-00ead9901bd9  (existente)
--   Samsung/ SmartPhone  → 3f53dcba-907d-41bb-960a-d7251c9ed14f  (existente)
--   Apple  / Tablet      → 3c019563-10c6-416f-990b-221240873e85  (existente)
--   Resto   → IDs nuevos (202603brd...)
--
-- IDs de familias en el LIVE DB:
--   iPhone   / Apple-SmartPhone   → 4ff9267c-e1fc-4a3f-903e-2748bf51c0c7  (existente)
--   Galaxy A / Samsung-SmartPhone → faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c  (existente)
--   iPad     / Apple-Tablet       → 7ec254d5-f0c3-42a2-aa74-3b2151b2d148  (existente)
--   Resto   → IDs nuevos (202603fam...)
-- =============================================================================


-- =============================================================================
-- PASO 1: CATEGORÍAS NUEVAS
-- (SmartPhone y Tablet ya existen en el live DB)
-- =============================================================================

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202603cat000000000000001','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Laptop',NULL,NULL,true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202603cat000000000000002','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Consola de juegos',NULL,NULL,true,4)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 2: MARCAS NUEVAS
-- (Apple/SmartPhone, Samsung/SmartPhone, Apple/Tablet ya existen)
-- =============================================================================

-- Samsung / Tablet  (Tablet = 0fe48747-6219-4a5d-bce4-4082102ec1fa)
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000004','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Samsung','0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

-- Apple / Laptop  (Laptop = 202603cat000000000000001)
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000001','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Apple','202603cat000000000000001',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

-- HP / Laptop
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000002','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'HP','202603cat000000000000001',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

-- Dell / Laptop
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000003','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Dell','202603cat000000000000001',NULL,NULL,true,3)
ON CONFLICT DO NOTHING;

-- Sony / Consola  (Consola = 202603cat000000000000002)
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000005','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Sony','202603cat000000000000002',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

-- Microsoft / Consola
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000006','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Microsoft','202603cat000000000000002',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

-- Nintendo / Consola
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202603brd000000000000007','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Nintendo','202603cat000000000000002',NULL,NULL,true,3)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 3: FAMILIAS NUEVAS
-- (iPhone, Galaxy A, iPad ya existen con los IDs del live DB)
-- Familias existentes que SE REUTILIZAN (no se insertan aquí):
--   iPhone   → 4ff9267c-e1fc-4a3f-903e-2748bf51c0c7
--   Galaxy A → faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c
--   iPad     → 7ec254d5-f0c3-42a2-aa74-3b2151b2d148
-- =============================================================================

-- Galaxy S / Samsung-SmartPhone  (brand: 3f53dcba-907d-41bb-960a-d7251c9ed14f)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000001','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Galaxy S','3f53dcba-907d-41bb-960a-d7251c9ed14f',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- Galaxy Tab / Samsung-Tablet  (brand: 202603brd000000000000004)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000002','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Galaxy Tab','202603brd000000000000004',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- MacBook / Apple-Laptop  (brand: 202603brd000000000000001)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000003','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'MacBook','202603brd000000000000001',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- Pavilion / HP-Laptop  (brand: 202603brd000000000000002)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000004','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Pavilion','202603brd000000000000002',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- Inspiron / Dell-Laptop  (brand: 202603brd000000000000003)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000005','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Inspiron','202603brd000000000000003',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- PlayStation / Sony-Consola  (brand: 202603brd000000000000005)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000006','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'PlayStation','202603brd000000000000005',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- Xbox / Microsoft-Consola  (brand: 202603brd000000000000006)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000007','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Xbox','202603brd000000000000006',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- Switch / Nintendo-Consola  (brand: 202603brd000000000000007)
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202603fam000000000000008','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,'Switch','202603brd000000000000007',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 4: MODELOS
-- Columnas: id, created_at, updated_at, created_by_id, created_by, is_sample,
--           name, brand_id, brand, category_id, subcategory_id, family_id,
--           alias, icon_url, icon_svg, common_problems, suggested_parts,
--           active, order
-- =============================================================================

-- ── iPhone (family: 4ff9267c-e1fc-4a3f-903e-2748bf51c0c7) ───────────────────
-- brand_id: de31f908-b1e3-4cba-bd0a-00ead9901bd9 (Apple/SmartPhone)
-- category_id: 7aadc364-a188-42f1-8d1e-64e9918801ad (SmartPhone)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000001','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPhone X',
   'de31f908-b1e3-4cba-bd0a-00ead9901bd9','Apple',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla OLED rota","Face ID no funciona","Cámara borrosa"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000002','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPhone 11',
   'de31f908-b1e3-4cba-bd0a-00ead9901bd9','Apple',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla LCD rota","Face ID no funciona","Micrófono dañado"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000003','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPhone 12',
   'de31f908-b1e3-4cba-bd0a-00ead9901bd9','Apple',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla OLED rota","Antena 5G dañada","Face ID no funciona"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000004','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPhone 13',
   'de31f908-b1e3-4cba-bd0a-00ead9901bd9','Apple',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla OLED rota","Cámara dañada","Altavoz bajo"]',
   '[]',true,4)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000005','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPhone 14',
   'de31f908-b1e3-4cba-bd0a-00ead9901bd9','Apple',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla OLED rota","Dynamic Island dañado","Cámara principal dañada"]',
   '[]',true,5)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000006','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPhone 15',
   'de31f908-b1e3-4cba-bd0a-00ead9901bd9','Apple',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla OLED rota","Puerto USB-C dañado","Cámara principal dañada"]',
   '[]',true,6)
ON CONFLICT DO NOTHING;

-- ── Galaxy S (family: 202603fam000000000000001) ──────────────────────────────
-- brand_id: 3f53dcba-907d-41bb-960a-d7251c9ed14f (Samsung/SmartPhone)
-- category_id: 7aadc364-a188-42f1-8d1e-64e9918801ad (SmartPhone)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000007','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy S21',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '202603fam000000000000001',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Cámara trasera dañada","Puerto de carga dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000008','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy S22',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '202603fam000000000000001',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Sensor de huellas dañado","Cámara dañada"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603mod000000000000009','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy S23',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '202603fam000000000000001',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Sensor de huellas dañado","Cámara principal dañada"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000000a','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy S24',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   '202603fam000000000000001',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Sensor de huellas bajo pantalla dañado","Sobrecalentamiento"]',
   '[]',true,4)
ON CONFLICT DO NOTHING;

-- ── Galaxy A (family: faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c) ──────────────────
-- brand_id: 3f53dcba-907d-41bb-960a-d7251c9ed14f (Samsung/SmartPhone)
-- category_id: 7aadc364-a188-42f1-8d1e-64e9918801ad (SmartPhone)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000000b','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy A13',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   'faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Puerto de carga dañado","Altavoz dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000000c','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy A14',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   'faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Puerto de carga dañado","Cámara dañada"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000000d','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy A15',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   'faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Sensor de huellas dañado","Micrófono dañado"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000000e','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy A54',
   '3f53dcba-907d-41bb-960a-d7251c9ed14f','Samsung',
   '7aadc364-a188-42f1-8d1e-64e9918801ad',NULL,
   'faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Sensor de huellas bajo pantalla dañado","Cámara dañada"]',
   '[]',true,4)
ON CONFLICT DO NOTHING;

-- ── iPad (family: 7ec254d5-f0c3-42a2-aa74-3b2151b2d148) ──────────────────────
-- brand_id: 3c019563-10c6-416f-990b-221240873e85 (Apple/Tablet)
-- category_id: 0fe48747-6219-4a5d-bce4-4082102ec1fa (Tablet)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000000f','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPad 9na Gen',
   '3c019563-10c6-416f-990b-221240873e85','Apple',
   '0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,
   '7ec254d5-f0c3-42a2-aa74-3b2151b2d148',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Puerto Lightning dañado","Conector de audífonos dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000010','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPad 10ma Gen',
   '3c019563-10c6-416f-990b-221240873e85','Apple',
   '0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,
   '7ec254d5-f0c3-42a2-aa74-3b2151b2d148',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Puerto USB-C dañado","Face ID no funciona"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000011','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPad Air',
   '3c019563-10c6-416f-990b-221240873e85','Apple',
   '0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,
   '7ec254d5-f0c3-42a2-aa74-3b2151b2d148',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Sensor Touch ID dañado","Puerto USB-C dañado"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000012','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'iPad Pro',
   '3c019563-10c6-416f-990b-221240873e85','Apple',
   '0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,
   '7ec254d5-f0c3-42a2-aa74-3b2151b2d148',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla mini-LED rota","Face ID no funciona","Puerto Thunderbolt dañado"]',
   '[]',true,4)
ON CONFLICT DO NOTHING;

-- ── Galaxy Tab (family: 202603fam000000000000002) ────────────────────────────
-- brand_id: 202603brd000000000000004 (Samsung/Tablet)
-- category_id: 0fe48747-6219-4a5d-bce4-4082102ec1fa (Tablet)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000013','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy Tab S8',
   '202603brd000000000000004','Samsung',
   '0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,
   '202603fam000000000000002',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Puerto USB-C dañado","S Pen dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000014','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Galaxy Tab S9',
   '202603brd000000000000004','Samsung',
   '0fe48747-6219-4a5d-bce4-4082102ec1fa',NULL,
   '202603fam000000000000002',
   NULL,NULL,NULL,
   '["Batería agotada","Pantalla rota","Puerto USB-C dañado","Lector S Pen dañado"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

-- ── MacBook (family: 202603fam000000000000003) ───────────────────────────────
-- brand_id: 202603brd000000000000001 (Apple/Laptop)
-- category_id: 202603cat000000000000001 (Laptop)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000015','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'MacBook Air M1',
   '202603brd000000000000001','Apple',
   '202603cat000000000000001',NULL,
   '202603fam000000000000003',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla rota","Puerto USB-C dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000016','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'MacBook Air M2',
   '202603brd000000000000001','Apple',
   '202603cat000000000000001',NULL,
   '202603fam000000000000003',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla rota","Sobrecalentamiento"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000017','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'MacBook Pro 14"',
   '202603brd000000000000001','Apple',
   '202603cat000000000000001',NULL,
   '202603fam000000000000003',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla mini-LED rota","Puerto Thunderbolt dañado"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000018','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'MacBook Pro 16"',
   '202603brd000000000000001','Apple',
   '202603cat000000000000001',NULL,
   '202603fam000000000000003',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla mini-LED rota","Sobrecalentamiento"]',
   '[]',true,4)
ON CONFLICT DO NOTHING;

-- ── HP Pavilion (family: 202603fam000000000000004) ───────────────────────────
-- brand_id: 202603brd000000000000002 (HP/Laptop)
-- category_id: 202603cat000000000000001 (Laptop)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000019','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Pavilion 14',
   '202603brd000000000000002','HP',
   '202603cat000000000000001',NULL,
   '202603fam000000000000004',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla rota","Ventilador ruidoso"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000001a','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Pavilion 15',
   '202603brd000000000000002','HP',
   '202603cat000000000000001',NULL,
   '202603fam000000000000004',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla rota","Puerto USB-A dañado"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Dell Inspiron (family: 202603fam000000000000005) ─────────────────────────
-- brand_id: 202603brd000000000000003 (Dell/Laptop)
-- category_id: 202603cat000000000000001 (Laptop)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000001b','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Inspiron 14',
   '202603brd000000000000003','Dell',
   '202603cat000000000000001',NULL,
   '202603fam000000000000005',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla rota","Ventilador defectuoso"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000001c','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Inspiron 15',
   '202603brd000000000000003','Dell',
   '202603cat000000000000001',NULL,
   '202603fam000000000000005',
   NULL,NULL,NULL,
   '["Batería agotada","Teclado dañado","Pantalla rota","Puerto de carga dañado"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

-- ── PlayStation (family: 202603fam000000000000006) ───────────────────────────
-- brand_id: 202603brd000000000000005 (Sony/Consola)
-- category_id: 202603cat000000000000002 (Consola de juegos)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000001d','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'PS4',
   '202603brd000000000000005','Sony',
   '202603cat000000000000002',NULL,
   '202603fam000000000000006',
   NULL,NULL,NULL,
   '["Disco duro dañado","Lector de disco dañado","Ventilador ruidoso","Puerto HDMI dañado","Error CE-34878-0"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000001e','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'PS4 Slim',
   '202603brd000000000000005','Sony',
   '202603cat000000000000002',NULL,
   '202603fam000000000000006',
   NULL,NULL,NULL,
   '["Disco duro dañado","Lector de disco dañado","Ventilador defectuoso","Puerto HDMI dañado"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('20260303000000000000001f','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'PS4 Pro',
   '202603brd000000000000005','Sony',
   '202603cat000000000000002',NULL,
   '202603fam000000000000006',
   NULL,NULL,NULL,
   '["Disco duro dañado","Lector de disco dañado","Sobrecalentamiento","Puerto HDMI dañado"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000020','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'PS5',
   '202603brd000000000000005','Sony',
   '202603cat000000000000002',NULL,
   '202603fam000000000000006',
   NULL,NULL,NULL,
   '["Error WS-116522-7","Lector de disco dañado","Problema de arranque","Puerto HDMI dañado","Sobrecalentamiento"]',
   '[]',true,4)
ON CONFLICT DO NOTHING;

-- ── Xbox (family: 202603fam000000000000007) ──────────────────────────────────
-- brand_id: 202603brd000000000000006 (Microsoft/Consola)
-- category_id: 202603cat000000000000002 (Consola de juegos)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000021','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Xbox One',
   '202603brd000000000000006','Microsoft',
   '202603cat000000000000002',NULL,
   '202603fam000000000000007',
   NULL,NULL,NULL,
   '["Lector de disco dañado","Disco duro dañado","Ventilador ruidoso","Puerto HDMI dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000022','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Xbox Series S',
   '202603brd000000000000006','Microsoft',
   '202603cat000000000000002',NULL,
   '202603fam000000000000007',
   NULL,NULL,NULL,
   '["Error E102","SSD dañado","Puerto HDMI dañado","Problema de arranque"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000023','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Xbox Series X',
   '202603brd000000000000006','Microsoft',
   '202603cat000000000000002',NULL,
   '202603fam000000000000007',
   NULL,NULL,NULL,
   '["Error E102","Lector de disco dañado","SSD dañado","Puerto HDMI dañado","Sobrecalentamiento"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;

-- ── Switch (family: 202603fam000000000000008) ────────────────────────────────
-- brand_id: 202603brd000000000000007 (Nintendo/Consola)
-- category_id: 202603cat000000000000002 (Consola de juegos)

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000024','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Nintendo Switch',
   '202603brd000000000000007','Nintendo',
   '202603cat000000000000002',NULL,
   '202603fam000000000000008',
   NULL,NULL,NULL,
   '["Joy-Con drift","Puerto USB-C de carga dañado","Pantalla rota","Lector de cartuchos dañado"]',
   '[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000025','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Nintendo Switch OLED',
   '202603brd000000000000007','Nintendo',
   '202603cat000000000000002',NULL,
   '202603fam000000000000008',
   NULL,NULL,NULL,
   '["Joy-Con drift","Puerto USB-C de carga dañado","Pantalla OLED rota","Lector de cartuchos dañado"]',
   '[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202603030000000000000026','2026-03-22T00:00:00.000000','2026-03-22T00:00:00.000000','system','system',false,
   'Nintendo Switch Lite',
   '202603brd000000000000007','Nintendo',
   '202603cat000000000000002',NULL,
   '202603fam000000000000008',
   NULL,NULL,NULL,
   '["Joy-Con drift (no extraíbles)","Puerto USB-C de carga dañado","Pantalla rota","Lector de cartuchos dañado"]',
   '[]',true,3)
ON CONFLICT DO NOTHING;
