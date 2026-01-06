// ============================================
// 👈 MIGRACIÓN: Neon Schema Generator
// Genera SQL idempotente para crear tablas en PostgreSQL
// Endpoint: GET /.netlify/functions/getNeonSchema
// ============================================

export async function getNeonSchemaHandler(req) {
  // 👈 MIGRACIÓN: SQL Schema completo e idempotente
  const schema = `-- ============================================
-- 👈 MIGRACIÓN: SmartFixOS - Neon PostgreSQL Schema
-- Schema idempotente con IF NOT EXISTS
-- Ejecutar en orden para evitar errores de dependencias
-- ============================================

-- ============================================
-- 1. TABLA: sales
-- ============================================

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT NOT NULL UNIQUE,
  customer_id UUID,
  customer_name TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) DEFAULT 0.00,
  tax_rate NUMERIC(5, 4) DEFAULT 0.1150,
  tax_amount NUMERIC(12, 2) DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) DEFAULT 0.00,
  deposit_credit NUMERIC(12, 2) DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL,
  amount_paid NUMERIC(12, 2) DEFAULT 0.00,
  amount_due NUMERIC(12, 2) DEFAULT 0.00,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'ath_movil', 'transfer', 'mixed')),
  payment_details JSONB DEFAULT '{}'::jsonb,
  employee TEXT,
  order_id UUID,
  order_number TEXT,
  voided BOOLEAN DEFAULT false,
  void_reason TEXT,
  voided_by TEXT,
  voided_at TIMESTAMPTZ,
  credit_note_id TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

-- 👈 MIGRACIÓN: Índices para optimizar queries comunes
CREATE INDEX IF NOT EXISTS idx_sales_created_date ON sales (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales (sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_voided ON sales (voided);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales (payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON sales (employee) WHERE employee IS NOT NULL;

-- 👈 MIGRACIÓN: Trigger para actualizar updated_date automáticamente
CREATE OR REPLACE FUNCTION update_sales_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_updated_date_trigger ON sales;
CREATE TRIGGER sales_updated_date_trigger
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_updated_date();

-- ============================================
-- 2. TABLA: transactions
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  order_number TEXT,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'refund')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'repair_payment', 'parts', 'supplies', 'other_expense', 'refund',
    'rent', 'utilities', 'payroll', 'insurance', 'taxes', 'marketing', 'maintenance'
  )),
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  recorded_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

-- 👈 MIGRACIÓN: Índices para optimizar queries comunes
CREATE INDEX IF NOT EXISTS idx_transactions_created_date ON transactions (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_recorded_by ON transactions (recorded_by) WHERE recorded_by IS NOT NULL;

-- 👈 MIGRACIÓN: Trigger para updated_date
CREATE OR REPLACE FUNCTION update_transactions_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_updated_date_trigger ON transactions;
CREATE TRIGGER transactions_updated_date_trigger
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transactions_updated_date();

-- ============================================
-- 3. TABLA: cash_registers
-- ============================================

CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  opening_balance NUMERIC(12, 2) DEFAULT 0.00 CHECK (opening_balance >= 0),
  closing_balance NUMERIC(12, 2) DEFAULT 0.00 CHECK (closing_balance >= 0),
  total_revenue NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_revenue >= 0),
  total_expenses NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_expenses >= 0),
  net_profit NUMERIC(12, 2) DEFAULT 0.00,
  estimated_tax NUMERIC(12, 2) DEFAULT 0.00 CHECK (estimated_tax >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  needs_recount BOOLEAN DEFAULT false,
  recount_reason TEXT,
  count_snapshot JSONB,
  final_count JSONB,
  opened_by TEXT,
  closed_by TEXT,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  last_movement_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  CONSTRAINT unique_date_per_register UNIQUE (date)
);

-- 👈 MIGRACIÓN: Índices para optimizar queries comunes
CREATE INDEX IF NOT EXISTS idx_cash_registers_created_date ON cash_registers (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_registers_date ON cash_registers (date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers (status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_by ON cash_registers (opened_by) WHERE opened_by IS NOT NULL;

-- 👈 MIGRACIÓN: Trigger para updated_date
CREATE OR REPLACE FUNCTION update_cash_registers_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cash_registers_updated_date_trigger ON cash_registers;
CREATE TRIGGER cash_registers_updated_date_trigger
  BEFORE UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_registers_updated_date();

-- ============================================
-- 4. TABLA: cash_drawer_movements
-- ============================================

CREATE TABLE IF NOT EXISTS cash_drawer_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawer_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('opening', 'sale', 'expense', 'deposit', 'withdrawal', 'closing')),
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  reference TEXT,
  employee TEXT,
  denominations JSONB DEFAULT '{}'::jsonb,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  CONSTRAINT fk_drawer_id FOREIGN KEY (drawer_id) 
    REFERENCES cash_registers(id) ON DELETE CASCADE
);

-- 👈 MIGRACIÓN: Índices para optimizar queries comunes
CREATE INDEX IF NOT EXISTS idx_cash_movements_created_date ON cash_drawer_movements (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_drawer_id ON cash_drawer_movements (drawer_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_drawer_movements (type);
CREATE INDEX IF NOT EXISTS idx_cash_movements_employee ON cash_drawer_movements (employee) WHERE employee IS NOT NULL;

-- 👈 MIGRACIÓN: Trigger para updated_date
CREATE OR REPLACE FUNCTION update_cash_movements_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cash_movements_updated_date_trigger ON cash_drawer_movements;
CREATE TRIGGER cash_movements_updated_date_trigger
  BEFORE UPDATE ON cash_drawer_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_movements_updated_date();

-- ============================================
-- 👈 MIGRACIÓN: Índices compuestos para queries complejas
-- ============================================

-- Para buscar ventas por fecha y estado
CREATE INDEX IF NOT EXISTS idx_sales_date_voided ON sales (created_date DESC, voided);

-- Para buscar transacciones por tipo y fecha
CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions (type, created_date DESC);

-- Para buscar movimientos por drawer y tipo
CREATE INDEX IF NOT EXISTS idx_movements_drawer_type ON cash_drawer_movements (drawer_id, type);

-- ============================================
-- 👈 MIGRACIÓN: Views útiles para reportes
-- ============================================

-- Vista de ventas válidas (no anuladas)
CREATE OR REPLACE VIEW valid_sales AS
SELECT * FROM sales
WHERE voided = false
ORDER BY created_date DESC;

-- Vista de ingresos totales por día
CREATE OR REPLACE VIEW daily_revenue AS
SELECT 
  DATE(created_date) as date,
  SUM(total) as total_revenue,
  COUNT(*) as sales_count
FROM sales
WHERE voided = false
GROUP BY DATE(created_date)
ORDER BY date DESC;

-- Vista de gastos por día
CREATE OR REPLACE VIEW daily_expenses AS
SELECT 
  DATE(created_date) as date,
  SUM(amount) as total_expenses,
  COUNT(*) as expense_count
FROM transactions
WHERE type = 'expense'
GROUP BY DATE(created_date)
ORDER BY date DESC;

-- ============================================
-- 👈 MIGRACIÓN: Grants (ajustar según tu usuario)
-- ============================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_neon_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO your_neon_user;

-- ============================================
-- FIN DEL SCHEMA
-- ============================================

-- 👈 MIGRACIÓN: Verificación de tablas creadas
SELECT 
  'sales' as table_name, 
  COUNT(*) as record_count 
FROM sales
UNION ALL
SELECT 
  'transactions', 
  COUNT(*) 
FROM transactions
UNION ALL
SELECT 
  'cash_registers', 
  COUNT(*) 
FROM cash_registers
UNION ALL
SELECT 
  'cash_drawer_movements', 
  COUNT(*) 
FROM cash_drawer_movements;
`;

  // 👈 MIGRACIÓN: Retornar SQL como texto plano
  return new Response(schema, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="neon-schema.sql"'
    }
  });
}
