-- =============================================================================
-- 015_catalog_models_fix.sql
-- Fix: emojis en categorías + modelos completos iPhone y Samsung
-- =============================================================================

-- ─── PASO 1: Emojis para todas las categorías ─────────────────────────────────
UPDATE "public"."device_category" SET icon = '📱'  WHERE id = '7aadc364-a188-42f1-8d1e-64e9918801ad';  -- Celular
UPDATE "public"."device_category" SET icon = '📱'  WHERE id = '0fe48747-6219-4a5d-bce4-4082102ec1fa';  -- Tableta
UPDATE "public"."device_category" SET icon = '💻'  WHERE id = '202603cat000000000000001';               -- Laptop
UPDATE "public"."device_category" SET icon = '🎮'  WHERE id = '202603cat000000000000002';               -- Consola
UPDATE "public"."device_category" SET icon = '🖥️'  WHERE id = '202604cat000000000001';                  -- iMac
UPDATE "public"."device_category" SET icon = '🖥️'  WHERE id = '202604cat000000000002';                  -- PC Torre
UPDATE "public"."device_category" SET icon = '🎧'  WHERE id = '202604cat000000000003';                  -- Audífonos
UPDATE "public"."device_category" SET icon = '⌚'  WHERE id = '202604cat000000000004';                  -- Smartwatch
UPDATE "public"."device_category" SET icon = '🖨️'  WHERE id = '202604cat000000000005';                  -- Impresora


-- =============================================================================
-- PASO 2: iPhone — borrar modelos viejos/incompletos e insertar lista completa
-- family_id : 4ff9267c-e1fc-4a3f-903e-2748bf51c0c7
-- brand_id  : de31f908-b1e3-4cba-bd0a-00ead9901bd9
-- category_id: 7aadc364-a188-42f1-8d1e-64e9918801ad
-- =============================================================================

DELETE FROM "public"."device_model"
WHERE family_id = '4ff9267c-e1fc-4a3f-903e-2748bf51c0c7';

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  ('202604iph001','iPhone 6',          'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 1, 'system','system'),
  ('202604iph002','iPhone 6 Plus',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 2, 'system','system'),
  ('202604iph003','iPhone 6s',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 3, 'system','system'),
  ('202604iph004','iPhone 6s Plus',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 4, 'system','system'),
  ('202604iph005','iPhone SE (1ª gen)','de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 5, 'system','system'),
  ('202604iph006','iPhone 7',          'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 6, 'system','system'),
  ('202604iph007','iPhone 7 Plus',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 7, 'system','system'),
  ('202604iph008','iPhone 8',          'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 8, 'system','system'),
  ('202604iph009','iPhone 8 Plus',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true, 9, 'system','system'),
  ('202604iph010','iPhone X',          'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,10, 'system','system'),
  ('202604iph011','iPhone XR',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,11, 'system','system'),
  ('202604iph012','iPhone XS',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,12, 'system','system'),
  ('202604iph013','iPhone XS Max',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,13, 'system','system'),
  ('202604iph014','iPhone SE (2ª gen)','de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,14, 'system','system'),
  ('202604iph015','iPhone 11',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,15, 'system','system'),
  ('202604iph016','iPhone 11 Pro',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,16, 'system','system'),
  ('202604iph017','iPhone 11 Pro Max', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,17, 'system','system'),
  ('202604iph018','iPhone 12',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,18, 'system','system'),
  ('202604iph019','iPhone 12 mini',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,19, 'system','system'),
  ('202604iph020','iPhone 12 Pro',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,20, 'system','system'),
  ('202604iph021','iPhone 12 Pro Max', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,21, 'system','system'),
  ('202604iph022','iPhone 13',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,22, 'system','system'),
  ('202604iph023','iPhone 13 mini',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,23, 'system','system'),
  ('202604iph024','iPhone 13 Pro',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,24, 'system','system'),
  ('202604iph025','iPhone 13 Pro Max', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,25, 'system','system'),
  ('202604iph026','iPhone SE (3ª gen)','de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,26, 'system','system'),
  ('202604iph027','iPhone 14',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,27, 'system','system'),
  ('202604iph028','iPhone 14 Plus',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,28, 'system','system'),
  ('202604iph029','iPhone 14 Pro',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,29, 'system','system'),
  ('202604iph030','iPhone 14 Pro Max', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,30, 'system','system'),
  ('202604iph031','iPhone 15',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,31, 'system','system'),
  ('202604iph032','iPhone 15 Plus',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,32, 'system','system'),
  ('202604iph033','iPhone 15 Pro',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,33, 'system','system'),
  ('202604iph034','iPhone 15 Pro Max', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,34, 'system','system'),
  ('202604iph035','iPhone 16',         'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,35, 'system','system'),
  ('202604iph036','iPhone 16 Plus',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,36, 'system','system'),
  ('202604iph037','iPhone 16 Pro',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,37, 'system','system'),
  ('202604iph038','iPhone 16 Pro Max', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,38, 'system','system'),
  ('202604iph039','iPhone 16e',        'de31f908-b1e3-4cba-bd0a-00ead9901bd9','7aadc364-a188-42f1-8d1e-64e9918801ad','4ff9267c-e1fc-4a3f-903e-2748bf51c0c7',true,39, 'system','system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 3: Samsung Galaxy S — reemplazar lista incompleta
-- family_id : 202603fam000000000000001
-- brand_id  : 3f53dcba-907d-41bb-960a-d7251c9ed14f
-- category_id: 7aadc364-a188-42f1-8d1e-64e9918801ad
-- =============================================================================

DELETE FROM "public"."device_model"
WHERE family_id = '202603fam000000000000001';

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  ('202604sgs001','Galaxy S10',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 1,'system','system'),
  ('202604sgs002','Galaxy S10+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 2,'system','system'),
  ('202604sgs003','Galaxy S10e',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 3,'system','system'),
  ('202604sgs004','Galaxy S20',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 4,'system','system'),
  ('202604sgs005','Galaxy S20+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 5,'system','system'),
  ('202604sgs006','Galaxy S20 Ultra','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 6,'system','system'),
  ('202604sgs007','Galaxy S20 FE',   '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 7,'system','system'),
  ('202604sgs008','Galaxy S21',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 8,'system','system'),
  ('202604sgs009','Galaxy S21+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true, 9,'system','system'),
  ('202604sgs010','Galaxy S21 Ultra','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,10,'system','system'),
  ('202604sgs011','Galaxy S21 FE',   '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,11,'system','system'),
  ('202604sgs012','Galaxy S22',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,12,'system','system'),
  ('202604sgs013','Galaxy S22+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,13,'system','system'),
  ('202604sgs014','Galaxy S22 Ultra','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,14,'system','system'),
  ('202604sgs015','Galaxy S23',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,15,'system','system'),
  ('202604sgs016','Galaxy S23+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,16,'system','system'),
  ('202604sgs017','Galaxy S23 Ultra','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,17,'system','system'),
  ('202604sgs018','Galaxy S23 FE',   '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,18,'system','system'),
  ('202604sgs019','Galaxy S24',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,19,'system','system'),
  ('202604sgs020','Galaxy S24+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,20,'system','system'),
  ('202604sgs021','Galaxy S24 Ultra','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,21,'system','system'),
  ('202604sgs022','Galaxy S24 FE',   '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,22,'system','system'),
  ('202604sgs023','Galaxy S25',      '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,23,'system','system'),
  ('202604sgs024','Galaxy S25+',     '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,24,'system','system'),
  ('202604sgs025','Galaxy S25 Ultra','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202603fam000000000000001',true,25,'system','system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 4: Samsung Galaxy A — limpiar y reemplazar con serie completa
-- Eliminar sub-familias redundantes Galaxy A13 / Galaxy A54
-- family_id principal: faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c
-- =============================================================================

-- Eliminar modelos de sub-familias y la sub-familia principal Galaxy A
DELETE FROM "public"."device_model"
WHERE family_id IN (
  'faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',  -- Galaxy A (principal)
  '80417fc3-cc39-44f6-8e1b-17cb0b0f260c',   -- Galaxy A13 (sub-familia)
  '44e8f161-50fa-427d-ac02-2fa6835be0ba'    -- Galaxy A54 (sub-familia)
);

-- Eliminar sub-familias redundantes
DELETE FROM "public"."device_family"
WHERE id IN (
  '80417fc3-cc39-44f6-8e1b-17cb0b0f260c',
  '44e8f161-50fa-427d-ac02-2fa6835be0ba'
);

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  ('202604sga001','Galaxy A03',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 1,'system','system'),
  ('202604sga002','Galaxy A03s',   '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 2,'system','system'),
  ('202604sga003','Galaxy A04',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 3,'system','system'),
  ('202604sga004','Galaxy A05',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 4,'system','system'),
  ('202604sga005','Galaxy A05s',   '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 5,'system','system'),
  ('202604sga006','Galaxy A12',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 6,'system','system'),
  ('202604sga007','Galaxy A13',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 7,'system','system'),
  ('202604sga008','Galaxy A13 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 8,'system','system'),
  ('202604sga009','Galaxy A14',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true, 9,'system','system'),
  ('202604sga010','Galaxy A14 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,10,'system','system'),
  ('202604sga011','Galaxy A15',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,11,'system','system'),
  ('202604sga012','Galaxy A15 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,12,'system','system'),
  ('202604sga013','Galaxy A22',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,13,'system','system'),
  ('202604sga014','Galaxy A22 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,14,'system','system'),
  ('202604sga015','Galaxy A23',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,15,'system','system'),
  ('202604sga016','Galaxy A23 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,16,'system','system'),
  ('202604sga017','Galaxy A24',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,17,'system','system'),
  ('202604sga018','Galaxy A25',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,18,'system','system'),
  ('202604sga019','Galaxy A25 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,19,'system','system'),
  ('202604sga020','Galaxy A32',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,20,'system','system'),
  ('202604sga021','Galaxy A32 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,21,'system','system'),
  ('202604sga022','Galaxy A33 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,22,'system','system'),
  ('202604sga023','Galaxy A34',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,23,'system','system'),
  ('202604sga024','Galaxy A34 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,24,'system','system'),
  ('202604sga025','Galaxy A35',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,25,'system','system'),
  ('202604sga026','Galaxy A35 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,26,'system','system'),
  ('202604sga027','Galaxy A51',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,27,'system','system'),
  ('202604sga028','Galaxy A52',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,28,'system','system'),
  ('202604sga029','Galaxy A52s 5G','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,29,'system','system'),
  ('202604sga030','Galaxy A53 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,30,'system','system'),
  ('202604sga031','Galaxy A54',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,31,'system','system'),
  ('202604sga032','Galaxy A55',    '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,32,'system','system'),
  ('202604sga033','Galaxy A55 5G', '3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','faa7f96a-cfd5-412d-84f9-cf8ecf1caf5c',true,33,'system','system')
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 5: Samsung Galaxy Z — familia nueva + modelos plegables
-- brand_id: 3f53dcba-907d-41bb-960a-d7251c9ed14f
-- =============================================================================

INSERT INTO "public"."device_family"
  (id, name, brand_id, active, "order", created_by_id, created_by)
VALUES
  ('202604fam_sgz','Galaxy Z','3f53dcba-907d-41bb-960a-d7251c9ed14f',true,3,'system','system')
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  ('202604sgz001','Galaxy Z Flip 3','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,1,'system','system'),
  ('202604sgz002','Galaxy Z Flip 4','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,2,'system','system'),
  ('202604sgz003','Galaxy Z Flip 5','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,3,'system','system'),
  ('202604sgz004','Galaxy Z Flip 6','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,4,'system','system'),
  ('202604sgz005','Galaxy Z Fold 3','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,5,'system','system'),
  ('202604sgz006','Galaxy Z Fold 4','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,6,'system','system'),
  ('202604sgz007','Galaxy Z Fold 5','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,7,'system','system'),
  ('202604sgz008','Galaxy Z Fold 6','3f53dcba-907d-41bb-960a-d7251c9ed14f','7aadc364-a188-42f1-8d1e-64e9918801ad','202604fam_sgz',true,8,'system','system')
ON CONFLICT DO NOTHING;
