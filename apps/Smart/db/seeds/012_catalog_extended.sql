-- =============================================================================
-- 012_catalog_extended.sql
-- Nuevas categorías: iMac, PC Torre, Audífonos, Smartwatch, Impresora
--
-- CRITERIOS:
--   • ON CONFLICT DO NOTHING — idempotente, re-ejecutable sin riesgo
--   • IDs con prefijo 202604 para no colisionar con 011_catalog_data.sql (202603)
--
-- Categorías existentes (no se tocan):
--   SmartPhone  → 7aadc364-a188-42f1-8d1e-64e9918801ad  (order 1)
--   Tablet      → 0fe48747-6219-4a5d-bce4-4082102ec1fa  (order 2)
--   Laptop      → 202603cat000000000000001              (order 3)
--   Consola     → 202603cat000000000000002              (order 4)
-- =============================================================================


-- =============================================================================
-- PASO 1: CATEGORÍAS NUEVAS (orders 5-9)
-- =============================================================================

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202604cat000000000001','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'iMac',NULL,NULL,true,5)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202604cat000000000002','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'PC Torre / Desktop',NULL,NULL,true,6)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202604cat000000000003','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Audífonos / Headphones',NULL,NULL,true,7)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202604cat000000000004','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Smartwatch',NULL,NULL,true,8)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_category"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","icon","icon_url","active","order")
VALUES
  ('202604cat000000000005','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Impresora',NULL,NULL,true,9)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 2: MARCAS
-- =============================================================================

-- ── iMac ──────────────────────────────────────────────────────────────────────
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000001','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Apple','202604cat000000000001',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Desktop ────────────────────────────────────────────────────────
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000002','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Dell','202604cat000000000002',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000003','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'HP','202604cat000000000002',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000004','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Lenovo','202604cat000000000002',NULL,NULL,true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000005','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'ASUS','202604cat000000000002',NULL,NULL,true,4)
ON CONFLICT DO NOTHING;

-- ── Audífonos ─────────────────────────────────────────────────────────────────
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000006','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Apple','202604cat000000000003',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000007','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Sony','202604cat000000000003',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000008','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Beats','202604cat000000000003',NULL,NULL,true,3)
ON CONFLICT DO NOTHING;

-- ── Smartwatch ────────────────────────────────────────────────────────────────
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000009','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Apple','202604cat000000000004',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000010','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Samsung','202604cat000000000004',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

-- ── Impresora ─────────────────────────────────────────────────────────────────
INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000011','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Epson','202604cat000000000005',NULL,NULL,true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000012','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'HP','202604cat000000000005',NULL,NULL,true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000013','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Canon','202604cat000000000005',NULL,NULL,true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."brand"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","category_id","icon_url","icon_svg","active","order")
VALUES
  ('202604brd000000000014','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Brother','202604cat000000000005',NULL,NULL,true,4)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 3: FAMILIAS
-- Columnas: id, created_at, updated_at, created_by_id, created_by, is_sample,
--           name, brand_id, icon_url, icon_svg, active, order, subcategory_id
-- =============================================================================

-- ── iMac / Apple ──────────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000001','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'iMac','202604brd000000000001',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Dell ───────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000002','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'OptiPlex','202604brd000000000002',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000003','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Inspiron Desktop','202604brd000000000002',NULL,NULL,true,2,NULL)
ON CONFLICT DO NOTHING;

-- ── PC Torre / HP ─────────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000004','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'ProDesk','202604brd000000000003',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Lenovo ─────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000005','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'IdeaCentre','202604brd000000000004',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000006','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'ThinkCentre','202604brd000000000004',NULL,NULL,true,2,NULL)
ON CONFLICT DO NOTHING;

-- ── PC Torre / ASUS ───────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000007','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'VivoPC','202604brd000000000005',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Apple ─────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000008','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'AirPods','202604brd000000000006',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Sony ──────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000009','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'WH Series','202604brd000000000007',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000010','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'WF Series','202604brd000000000007',NULL,NULL,true,2,NULL)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Beats ─────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000011','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Beats Studio','202604brd000000000008',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000012','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Beats Fit / PowerBeats','202604brd000000000008',NULL,NULL,true,2,NULL)
ON CONFLICT DO NOTHING;

-- ── Smartwatch / Apple ────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000013','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Apple Watch','202604brd000000000009',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── Smartwatch / Samsung ──────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000014','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'Galaxy Watch','202604brd000000000010',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── Impresora / Epson ─────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000015','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'EcoTank','202604brd000000000011',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── Impresora / HP ────────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000016','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'LaserJet','202604brd000000000012',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000017','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'OfficeJet','202604brd000000000012',NULL,NULL,true,2,NULL)
ON CONFLICT DO NOTHING;

-- ── Impresora / Canon ─────────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000018','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'PIXMA','202604brd000000000013',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

-- ── Impresora / Brother ───────────────────────────────────────────────────────
INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000019','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'HL','202604brd000000000014',NULL,NULL,true,1,NULL)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_family"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","icon_url","icon_svg","active","order","subcategory_id")
VALUES
  ('202604fam000000000020','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,'MFC','202604brd000000000014',NULL,NULL,true,2,NULL)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASO 4: MODELOS
-- Columnas: id, created_at, updated_at, created_by_id, created_by, is_sample,
--           name, brand_id, brand, category_id, subcategory_id, family_id,
--           alias, icon_url, icon_svg, common_problems, suggested_parts, active, order
-- =============================================================================

-- ── iMac (cat: 202604cat000000000001, brand: 202604brd000000000001, fam: 202604fam000000000001) ──
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000001','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'iMac 21.5" (Intel)','202604brd000000000001','Apple','202604cat000000000001',NULL,'202604fam000000000001',
   NULL,NULL,NULL,'["Pantalla con manchas","Sobrecalentamiento","HDD lento"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000002','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'iMac 24" M1','202604brd000000000001','Apple','202604cat000000000001',NULL,'202604fam000000000001',
   NULL,NULL,NULL,'["No enciende","Pantalla con rayas","Puerto USB-C dañado"]','[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000003','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'iMac 24" M3','202604brd000000000001','Apple','202604cat000000000001',NULL,'202604fam000000000001',
   NULL,NULL,NULL,'["No enciende","Puerto USB-C dañado","Cámara FaceTime falla"]','[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000004','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'iMac 27" (Intel)','202604brd000000000001','Apple','202604cat000000000001',NULL,'202604fam000000000001',
   NULL,NULL,NULL,'["Pantalla con backlight roto","HDD/Fusion Drive falla","Ventilador ruidoso"]','[]',true,4)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000005','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'iMac Pro','202604brd000000000001','Apple','202604cat000000000001',NULL,'202604fam000000000001',
   NULL,NULL,NULL,'["Sobrecalentamiento","Pantalla Retina dañada","RAM soldada falla"]','[]',true,5)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Dell OptiPlex (fam: 202604fam000000000002) ────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000006','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'OptiPlex 3000','202604brd000000000002','Dell','202604cat000000000002',NULL,'202604fam000000000002',
   NULL,NULL,NULL,'["No enciende","Fuente de poder quemada","RAM dañada"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000007','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'OptiPlex 5000','202604brd000000000002','Dell','202604cat000000000002',NULL,'202604fam000000000002',
   NULL,NULL,NULL,'["No enciende","Fuente de poder quemada","Placa madre dañada"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Dell Inspiron Desktop (fam: 202604fam000000000003) ─────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000008','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Inspiron Desktop 3910','202604brd000000000002','Dell','202604cat000000000002',NULL,'202604fam000000000003',
   NULL,NULL,NULL,'["No enciende","HDD falla","Ventilador ruidoso"]','[]',true,1)
ON CONFLICT DO NOTHING;

-- ── PC Torre / HP ProDesk (fam: 202604fam000000000004) ───────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000009','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'ProDesk 400 G9','202604brd000000000003','HP','202604cat000000000002',NULL,'202604fam000000000004',
   NULL,NULL,NULL,'["No enciende","Fuente de poder falla","Puerto USB roto"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000010','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'ProDesk 600 G6','202604brd000000000003','HP','202604cat000000000002',NULL,'202604fam000000000004',
   NULL,NULL,NULL,'["No enciende","RAM falla","Sobrecalentamiento"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Lenovo IdeaCentre (fam: 202604fam000000000005) ────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000011','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'IdeaCentre 5','202604brd000000000004','Lenovo','202604cat000000000002',NULL,'202604fam000000000005',
   NULL,NULL,NULL,'["No enciende","HDD falla","Ventilador ruidoso"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000012','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'IdeaCentre 3','202604brd000000000004','Lenovo','202604cat000000000002',NULL,'202604fam000000000005',
   NULL,NULL,NULL,'["No enciende","RAM falla","Puerto USB roto"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── PC Torre / Lenovo ThinkCentre (fam: 202604fam000000000006) ───────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000013','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'ThinkCentre M70s','202604brd000000000004','Lenovo','202604cat000000000002',NULL,'202604fam000000000006',
   NULL,NULL,NULL,'["No enciende","Fuente de poder falla","BIOS corrupto"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000014','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'ThinkCentre M90n','202604brd000000000004','Lenovo','202604cat000000000002',NULL,'202604fam000000000006',
   NULL,NULL,NULL,'["No enciende","RAM falla","Sobrecalentamiento"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── PC Torre / ASUS VivoPC (fam: 202604fam000000000007) ──────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000015','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'VivoPC M90MB','202604brd000000000005','ASUS','202604cat000000000002',NULL,'202604fam000000000007',
   NULL,NULL,NULL,'["No enciende","HDD falla","Sobrecalentamiento"]','[]',true,1)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Apple AirPods (fam: 202604fam000000000008) ───────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000016','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'AirPods (3ra generación)','202604brd000000000006','Apple','202604cat000000000003',NULL,'202604fam000000000008',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","No conecta por Bluetooth"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000017','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'AirPods Pro (2da generación)','202604brd000000000006','Apple','202604cat000000000003',NULL,'202604fam000000000008',
   NULL,NULL,NULL,'["ANC no funciona","Batería agotada","Silicona dañada","No conecta"]','[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000018','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'AirPods Max','202604brd000000000006','Apple','202604cat000000000003',NULL,'202604fam000000000008',
   NULL,NULL,NULL,'["ANC falla","Batería agotada","Diadema dañada","Sin sonido"]','[]',true,3)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Sony WH (fam: 202604fam000000000009) ─────────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000019','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'WH-1000XM5','202604brd000000000007','Sony','202604cat000000000003',NULL,'202604fam000000000009',
   NULL,NULL,NULL,'["ANC falla","Batería agotada","Bluetooth inestable","Diadema rota"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000020','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'WH-CH720N','202604brd000000000007','Sony','202604cat000000000003',NULL,'202604fam000000000009',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","Puerto de carga roto"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Sony WF (fam: 202604fam000000000010) ─────────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000021','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'WF-1000XM5','202604brd000000000007','Sony','202604cat000000000003',NULL,'202604fam000000000010',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","ANC falla","Estuche no carga"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000022','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'WF-C700N','202604brd000000000007','Sony','202604cat000000000003',NULL,'202604fam000000000010',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","No conecta Bluetooth"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Beats Studio (fam: 202604fam000000000011) ────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000023','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Beats Studio Pro','202604brd000000000008','Beats','202604cat000000000003',NULL,'202604fam000000000011',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","Bluetooth inestable"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000024','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Beats Studio Buds+','202604brd000000000008','Beats','202604cat000000000003',NULL,'202604fam000000000011',
   NULL,NULL,NULL,'["Sin sonido en un oído","Estuche no carga","ANC débil"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Audífonos / Beats Fit (fam: 202604fam000000000012) ───────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000025','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Beats Fit Pro','202604brd000000000008','Beats','202604cat000000000003',NULL,'202604fam000000000012',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","No conecta"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000026','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'PowerBeats Pro','202604brd000000000008','Beats','202604cat000000000003',NULL,'202604fam000000000012',
   NULL,NULL,NULL,'["Sin sonido en un oído","Batería agotada","Estuche no carga"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Smartwatch / Apple Watch (fam: 202604fam000000000013) ────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000027','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Apple Watch SE (2da gen)','202604brd000000000009','Apple','202604cat000000000004',NULL,'202604fam000000000013',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Cargador magnético falla"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000028','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Apple Watch Series 8','202604brd000000000009','Apple','202604cat000000000004',NULL,'202604fam000000000013',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Sensor cardíaco falla"]','[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000029','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Apple Watch Series 9','202604brd000000000009','Apple','202604cat000000000004',NULL,'202604fam000000000013',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Cargador magnético falla"]','[]',true,3)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000030','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Apple Watch Ultra 2','202604brd000000000009','Apple','202604cat000000000004',NULL,'202604fam000000000013',
   NULL,NULL,NULL,'["Pantalla rota","Cargador magnético falla","Corona Digital dañada"]','[]',true,4)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000031','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Apple Watch Series 10','202604brd000000000009','Apple','202604cat000000000004',NULL,'202604fam000000000013',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Cargador magnético falla"]','[]',true,5)
ON CONFLICT DO NOTHING;

-- ── Smartwatch / Samsung Galaxy Watch (fam: 202604fam000000000014) ────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000032','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Galaxy Watch 6','202604brd000000000010','Samsung','202604cat000000000004',NULL,'202604fam000000000014',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Sensor cardíaco falla"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000033','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Galaxy Watch 7','202604brd000000000010','Samsung','202604cat000000000004',NULL,'202604fam000000000014',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Cargador falla"]','[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000034','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'Galaxy Watch Ultra','202604brd000000000010','Samsung','202604cat000000000004',NULL,'202604fam000000000014',
   NULL,NULL,NULL,'["Pantalla rota","Batería agotada","Corona giratoria dañada"]','[]',true,3)
ON CONFLICT DO NOTHING;

-- ── Impresora / Epson EcoTank (fam: 202604fam000000000015) ───────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000035','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'EcoTank L3150','202604brd000000000011','Epson','202604cat000000000005',NULL,'202604fam000000000015',
   NULL,NULL,NULL,'["Cabezal tapado","Papel atascado","No conecta Wi-Fi"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000036','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'EcoTank L3250','202604brd000000000011','Epson','202604cat000000000005',NULL,'202604fam000000000015',
   NULL,NULL,NULL,'["Cabezal tapado","Papel atascado","Impresión con rayas"]','[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000037','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'EcoTank ET-4850','202604brd000000000011','Epson','202604cat000000000005',NULL,'202604fam000000000015',
   NULL,NULL,NULL,'["Cabezal tapado","Escáner falla","No conecta Wi-Fi"]','[]',true,3)
ON CONFLICT DO NOTHING;

-- ── Impresora / HP LaserJet (fam: 202604fam000000000016) ─────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000038','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'LaserJet Pro M404dn','202604brd000000000012','HP','202604cat000000000005',NULL,'202604fam000000000016',
   NULL,NULL,NULL,'["Fusor quemado","Papel atascado","Rodillo dañado","Tóner gasta"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000039','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'LaserJet Pro M428fdw','202604brd000000000012','HP','202604cat000000000005',NULL,'202604fam000000000016',
   NULL,NULL,NULL,'["Fusor quemado","Escáner falla","Papel atascado"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Impresora / HP OfficeJet (fam: 202604fam000000000017) ────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000040','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'OfficeJet Pro 9015e','202604brd000000000012','HP','202604cat000000000005',NULL,'202604fam000000000017',
   NULL,NULL,NULL,'["Cabezal tapado","Papel atascado","No conecta Wi-Fi"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000041','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'OfficeJet Pro 9025e','202604brd000000000012','HP','202604cat000000000005',NULL,'202604fam000000000017',
   NULL,NULL,NULL,'["Cabezal tapado","Escáner falla","Papel atascado"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Impresora / Canon PIXMA (fam: 202604fam000000000018) ─────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000042','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'PIXMA MG3620','202604brd000000000013','Canon','202604cat000000000005',NULL,'202604fam000000000018',
   NULL,NULL,NULL,'["Cabezal tapado","Papel atascado","No conecta Wi-Fi"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000043','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'PIXMA TR4720','202604brd000000000013','Canon','202604cat000000000005',NULL,'202604fam000000000018',
   NULL,NULL,NULL,'["Cabezal tapado","Escáner falla","Papel atascado"]','[]',true,2)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000044','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'PIXMA TS8320','202604brd000000000013','Canon','202604cat000000000005',NULL,'202604fam000000000018',
   NULL,NULL,NULL,'["Cabezal tapado","Impresión con rayas","No conecta Wi-Fi"]','[]',true,3)
ON CONFLICT DO NOTHING;

-- ── Impresora / Brother HL (fam: 202604fam000000000019) ──────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000045','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'HL-L2350DW','202604brd000000000014','Brother','202604cat000000000005',NULL,'202604fam000000000019',
   NULL,NULL,NULL,'["Fusor quemado","Papel atascado","Rodillo dañado"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000046','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'HL-L2395DW','202604brd000000000014','Brother','202604cat000000000005',NULL,'202604fam000000000019',
   NULL,NULL,NULL,'["Fusor quemado","Papel atascado","Tóner gasta rápido"]','[]',true,2)
ON CONFLICT DO NOTHING;

-- ── Impresora / Brother MFC (fam: 202604fam000000000020) ─────────────────────
INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000047','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'MFC-L2750DW','202604brd000000000014','Brother','202604cat000000000005',NULL,'202604fam000000000020',
   NULL,NULL,NULL,'["Fusor quemado","Escáner falla","Papel atascado"]','[]',true,1)
ON CONFLICT DO NOTHING;

INSERT INTO "public"."device_model"
  ("id","created_at","updated_at","created_by_id","created_by","is_sample","name","brand_id","brand","category_id","subcategory_id","family_id","alias","icon_url","icon_svg","common_problems","suggested_parts","active","order")
VALUES
  ('202604mod000000000048','2026-04-01T00:00:00.000000','2026-04-01T00:00:00.000000','system','system',false,
   'MFC-J1010DW','202604brd000000000014','Brother','202604cat000000000005',NULL,'202604fam000000000020',
   NULL,NULL,NULL,'["Cabezal tapado","Escáner falla","Papel atascado"]','[]',true,2)
ON CONFLICT DO NOTHING;
