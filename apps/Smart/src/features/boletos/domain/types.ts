export interface OrderItemRow {
  id?: string;
  type?: string;
  name?: string;
  quantity?: number | string;
  price?: number | string;
  total?: number | string;
  cost?: number | string;
  unit_cost?: number | string;
  supplier?: string | null;
  supplier_name?: string | null;
  status?: string | null;
}

export interface HistoryEntry {
  status?: string | null;
  timestamp?: string;
  changed_by?: string;
  note?: string;
  kind?: string;
  visible_to_customer?: boolean;
}

export interface OrderRow {
  id: string;
  tenant_id?: string | null;
  order_number?: string | null;
  created_date?: string | null;
  updated_date?: string | null;
  status?: string | null;
  status_history?: HistoryEntry[] | null;
  status_note?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  device_type?: string | null;
  device_brand?: string | null;
  device_family?: string | null;
  device_model?: string | null;
  device_serial?: string | null;
  initial_problem?: string | null;
  promised_date?: string | null;
  appointment_at?: string | null;
  service_type?: string | null;
  cost_estimate?: number | string | null;
  labor_cost?: number | string | null;
  amount_paid?: number | string | null;
  balance_due?: number | string | null;
  tax_rate?: number | string | null;
  priority?: string | null;
  warranty_claim?: boolean | null;
  liquid_damage?: boolean | null;
  assigned_to_name?: string | null;
  not_repairable_resolved_at?: string | null;
  device_photos?: string[] | null;
  order_items?: OrderItemRow[] | null;
  is_deleted?: boolean | null;
  is_quick_service?: boolean | null;
}

export type Vista = "citas" | "piezas" | "garantias" | "cerradas";

export type EquipmentId = "phones" | "tablets" | "computers" | "consoles" | "unlocks" | "other";

export interface FilterState {
  statuses: string[];
  equipos: EquipmentId[];
  vista: Vista | null;
  query: string;
}

export interface Chip {
  kind: "status" | "equipo" | "vista";
  key: string;
  label: string;
}
