-- =============================================================================
-- 016_catalog_additions.sql
-- Add Mac mini, iMac, and complete iPad models for Apple
-- =============================================================================

-- ─── IDs de Referencia (Live DB) ─────────────────────────────────────────────
-- Apple Brand ID: de31f908-b1e3-4cba-bd0a-00ead9901bd9
-- Category Tableta: 0fe48747-6219-4a5d-bce4-4082102ec1fa
-- Category iMac/Desktop: 202604cat000000000001
-- Family iPad: 7ec254d5-f0c3-42a2-aa74-3b2151b2d148
-- =============================================================================

-- =============================================================================
-- PASO 1: Familias Mac mini e iMac (si no existen)
-- =============================================================================

INSERT INTO "public"."device_family"
  (id, name, brand_id, active, "order", created_by_id, created_by)
VALUES
  ('202604fam_macmini', 'Mac mini', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', true, 10, 'system', 'system'),
  ('202604fam_imac',    'iMac',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', true, 11, 'system', 'system')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PASO 2: Modelos Mac mini
-- =============================================================================

DELETE FROM "public"."device_model" WHERE family_id = '202604fam_macmini';

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  ('202604mm001', 'Mac mini (M4 Pro, 2024)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 1, 'system', 'system'),
  ('202604mm002', 'Mac mini (M4, 2024)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 2, 'system', 'system'),
  ('202604mm003', 'Mac mini (M2 Pro, 2023)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 3, 'system', 'system'),
  ('202604mm004', 'Mac mini (M2, 2023)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 4, 'system', 'system'),
  ('202604mm005', 'Mac mini (M1, 2020)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 5, 'system', 'system'),
  ('202604mm006', 'Mac mini (Intel, 2020)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 6, 'system', 'system'),
  ('202604mm007', 'Mac mini (Intel, 2018)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_macmini', true, 7, 'system', 'system')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PASO 3: Modelos iMac
-- =============================================================================

DELETE FROM "public"."device_model" WHERE family_id = '202604fam_imac';

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  ('202604im001', 'iMac 24" (M4 Pro, 2024)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 1, 'system', 'system'),
  ('202604im002', 'iMac 24" (M4, 2024)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 2, 'system', 'system'),
  ('202604im003', 'iMac 24" (M3, 2023)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 3, 'system', 'system'),
  ('202604im004', 'iMac 24" (M1, 2021)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 4, 'system', 'system'),
  ('202604im005', 'iMac 27" (5K, 2020)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 5, 'system', 'system'),
  ('202604im006', 'iMac 27" (5K, 2019)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 6, 'system', 'system'),
  ('202604im007', 'iMac 21.5" (4K, 2019)',   'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 7, 'system', 'system'),
  ('202604im008', 'iMac 21.5" (2017)',      'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '202604cat000000000001', '202604fam_imac', true, 8, 'system', 'system')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PASO 4: Modelos iPad (Completos)
-- =============================================================================

DELETE FROM "public"."device_model" WHERE family_id = '7ec254d5-f0c3-42a2-aa74-3b2151b2d148';

INSERT INTO "public"."device_model"
  (id, name, brand_id, category_id, family_id, active, "order", created_by_id, created_by)
VALUES
  -- iPad Base
  ('202604ipd010', 'iPad (10ma gen)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 1, 'system', 'system'),
  ('202604ipd009', 'iPad (9na gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 2, 'system', 'system'),
  ('202604ipd008', 'iPad (8va gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 3, 'system', 'system'),
  ('202604ipd007', 'iPad (7ma gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 4, 'system', 'system'),
  ('202604ipd006', 'iPad (6ta gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 5, 'system', 'system'),
  ('202604ipd005', 'iPad (5ta gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 6, 'system', 'system'),
  ('202604ipd004', 'iPad (4ta gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 7, 'system', 'system'),
  ('202604ipd003', 'iPad (3ra gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 8, 'system', 'system'),
  ('202604ipd002', 'iPad (2da gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 9, 'system', 'system'),
  ('202604ipd001', 'iPad (1ra gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 10, 'system', 'system'),
  
  -- iPad Air
  ('202604ia13', 'iPad Air 13" (M2, 2024)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 11, 'system', 'system'),
  ('202604ia11', 'iPad Air 11" (M2, 2024)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 12, 'system', 'system'),
  ('202604ia05', 'iPad Air (5ta gen)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 13, 'system', 'system'),
  ('202604ia04', 'iPad Air (4ta gen)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 14, 'system', 'system'),
  ('202604ia03', 'iPad Air (3ra gen)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 15, 'system', 'system'),
  ('202604ia02', 'iPad Air (2da gen)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 16, 'system', 'system'),
  ('202604ia01', 'iPad Air (1ra gen)',     'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 17, 'system', 'system'),

  -- iPad Pro 11"
  ('202604ip11m4', 'iPad Pro 11" (M4, 2024)',   'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 18, 'system', 'system'),
  ('202604ip11g4', 'iPad Pro 11" (4ta gen)',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 19, 'system', 'system'),
  ('202604ip11g3', 'iPad Pro 11" (3ra gen)',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 20, 'system', 'system'),
  ('202604ip11g2', 'iPad Pro 11" (2da gen)',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 21, 'system', 'system'),
  ('202604ip11g1', 'iPad Pro 11" (1ra gen)',    'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 22, 'system', 'system'),

  -- iPad Pro 12.9" / 13"
  ('202604ip13m4', 'iPad Pro 13" (M4, 2024)',   'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 23, 'system', 'system'),
  ('202604ip12g6', 'iPad Pro 12.9" (6ta gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 24, 'system', 'system'),
  ('202604ip12g5', 'iPad Pro 12.9" (5ta gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 25, 'system', 'system'),
  ('202604ip12g4', 'iPad Pro 12.9" (4ta gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 26, 'system', 'system'),
  ('202604ip12g3', 'iPad Pro 12.9" (3ra gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 27, 'system', 'system'),
  ('202604ip12g2', 'iPad Pro 12.9" (2da gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 28, 'system', 'system'),
  ('202604ip12g1', 'iPad Pro 12.9" (1ra gen)',  'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 29, 'system', 'system'),

  -- iPad mini
  ('202604im07', 'iPad mini (7ma gen, 2024)', 'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 30, 'system', 'system'),
  ('202604im06', 'iPad mini (6ta gen)',       'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 31, 'system', 'system'),
  ('202604im05', 'iPad mini (5ta gen)',       'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 32, 'system', 'system'),
  ('202604im04', 'iPad mini (4ta gen)',       'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 33, 'system', 'system'),
  ('202604im03', 'iPad mini (3ra gen)',       'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 34, 'system', 'system'),
  ('202604im02', 'iPad mini (2da gen)',       'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 35, 'system', 'system'),
  ('202604im01', 'iPad mini (1ra gen)',       'de31f908-b1e3-4cba-bd0a-00ead9901bd9', '0fe48747-6219-4a5d-bce4-4082102ec1fa', '7ec254d5-f0c3-42a2-aa74-3b2151b2d148', true, 36, 'system', 'system')
ON CONFLICT DO NOTHING;
