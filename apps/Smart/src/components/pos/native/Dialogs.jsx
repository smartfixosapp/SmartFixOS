import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, UserPlus, UserX, Crown, Building2, Check, Loader2, PauseCircle, Users, Trash2 } from "lucide-react";
import { P, tint, Dialog, TextAction, ErrorBanner, Toggle } from "./posUi";
import { usd, parseMoney, effectivePrice, customerDisplayName, initials, isVIP, lineTotalWithTax } from "@/lib/posLogic";
import { listCustomers, createCustomer } from "@/lib/posApi";

const field = { width: "100%", padding: "12px 14px", background: "transparent", color: P.text, fontSize: 16, border: "none", outline: "none" };

function Group({ header, footer, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      {header && <p style={{ fontSize: 12, color: P.sub, textTransform: "uppercase", margin: "0 4px 6px" }}>{header}</p>}
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{children}</div>
      {footer && <p style={{ fontSize: 12, color: P.sub, margin: "6px 4px 0" }}>{footer}</p>}
    </div>
  );
}

function Sep() {
  return <div style={{ height: 0.5, background: P.sep, marginLeft: 14 }} />;
}

export function ManualItemDialog({ open, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [taxable, setTaxable] = useState(true);
  useEffect(() => { if (open) { setName(""); setPrice(""); setQty(1); setTaxable(true); } }, [open]);
  const parsed = parseMoney(price);
  const valid = name.trim() && parsed !== null && parsed > 0;
  const add = () => {
    if (!valid) return;
    onAdd({ name: name.trim(), price: parsed, quantity: qty, taxable });
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Item manual" width={460} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!valid} onClick={add}>Añadir</TextAction>}>
      <Group header="Item">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Descripción" style={field} />
        <Sep />
        <div className="flex items-center" style={{ paddingLeft: 14 }}>
          <span style={{ color: P.sub }}>$</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio unitario" inputMode="decimal" style={field}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        </div>
        <Sep />
        <div className="flex items-center justify-between" style={{ padding: "8px 14px" }}>
          <span style={{ fontSize: 16 }}>Cantidad</span>
          <span className="flex items-center gap-3">
            <span style={{ color: P.sub }}>{qty}</span>
            <span className="flex" style={{ borderRadius: 8, background: "#3A3A3C", overflow: "hidden" }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Menos" className="disabled:opacity-30" style={{ padding: "6px 14px" }}><Minus className="w-4 h-4" /></button>
              <span style={{ width: 0.5, background: P.sep }} />
              <button onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99} aria-label="Más" className="disabled:opacity-30" style={{ padding: "6px 14px" }}><Plus className="w-4 h-4" /></button>
            </span>
          </span>
        </div>
      </Group>
      <Group header="Impuesto">
        <div style={{ padding: "4px 14px" }}><Toggle on={taxable} onChange={setTaxable} label="Cobrar IVU sobre este item" /></div>
      </Group>
      {parsed !== null && parsed > 0 && (
        <Group header="Resumen">
          <div className="flex items-center justify-between" style={{ padding: "12px 14px" }}>
            <span style={{ color: P.sub }}>Total línea</span>
            <span style={{ fontWeight: 600 }}>{usd(parsed * qty)}</span>
          </div>
        </Group>
      )}
    </Dialog>
  );
}

export function VariantPickerDialog({ product, variants, onClose, onPick }) {
  return (
    <Dialog open={!!product} onClose={onClose} title={product?.name} width={460} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={null}>
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden", marginTop: 8 }}>
        {(variants || []).map((v, i) => {
          const stock = Number(v.stock) || 0;
          const price = v.price !== null && v.price !== undefined && v.price !== "" ? Number(v.price) : effectivePrice(product);
          return (
            <button key={v.id} onClick={() => { onPick(v); onClose(); }} className="w-full flex items-center justify-between text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${P.sep}` : "none" }}>
              <span>
                <span className="block" style={{ fontSize: 16, fontWeight: 600 }}>{v.label}</span>
                <span className="block" style={{ fontSize: 12, color: stock > 0 ? P.sub : P.danger }}>{stock > 0 ? `${Math.trunc(stock)} disponibles` : "Sin stock"}</span>
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: P.brand }}>{usd(price)}</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

function NewCustomerDialog({ open, tenantId, onClose, onSaved }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lang, setLang] = useState("es");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setFirst(""); setLast(""); setPhone(""); setEmail(""); setLang("es"); setError(null); setSaving(false); } }, [open]);
  const valid = !!first.trim();
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const c = await createCustomer({ tenantId, firstName: first, lastName: last, phone, email, language: lang });
      onSaved(c);
      onClose();
    } catch (e) {
      setError(e?.message || "No se pudo guardar el cliente.");
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo cliente" width={460} leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={saving ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: P.sub }} /> : <TextAction bold disabled={!valid} onClick={save}>Guardar</TextAction>}>
      <Group header="Datos del cliente">
        <input autoFocus value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Nombre *" autoComplete="given-name" style={field} />
        <Sep />
        <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Apellido (opcional)" autoComplete="family-name" style={field} />
      </Group>
      <Group header="Contacto" footer="Con teléfono o email podrás enviar el recibo por WhatsApp o correo.">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" inputMode="tel" autoComplete="tel" style={field} />
        <Sep />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opcional)" inputMode="email" autoComplete="email" autoCapitalize="none" style={field} />
      </Group>
      <Group header="Idioma" footer="El recibo por correo y los correos de sus órdenes saldrán en este idioma.">
        <div className="grid grid-cols-2" style={{ padding: 3, gap: 3 }}>
          {[["es", "Español"], ["en", "English"]].map(([k, l]) => (
            <button key={k} onClick={() => setLang(k)} style={{ padding: "7px 0", borderRadius: 8, fontSize: 14, fontWeight: 600, background: lang === k ? "#636366" : "transparent" }}>{l}</button>
          ))}
        </div>
      </Group>
      {error && <p style={{ marginTop: 12, fontSize: 13, color: P.danger }}>{error}</p>}
    </Dialog>
  );
}

export function CustomerSelectorDialog({ open, tenantId, selected, onClose, onSelect }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await listCustomers(tenantId));
    } catch (e) {
      setError(e?.message || String(e));
    }
    setLoading(false);
  };
  useEffect(() => { if (open) { setQ(""); load(); } }, [open]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => String(c.name || "").toLowerCase().includes(s) || String(c.company_name || "").toLowerCase().includes(s) || String(c.phone || "").includes(q) || String(c.email || "").toLowerCase().includes(s));
  }, [customers, q]);
  return (
    <>
      <Dialog open={open && !adding} onClose={onClose} title="Asignar cliente" width={560} height="80dvh"
        leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
        trailing={<button onClick={() => setAdding(true)} aria-label="Nuevo cliente" className="apple-press" style={{ color: P.brand }}><UserPlus className="w-5 h-5" /></button>}>
        <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 10, background: "#2C2C2E", marginTop: 4 }}>
          <Search className="w-4 h-4" style={{ color: P.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, teléfono, email" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: P.text, fontSize: 16 }} />
        </div>
        {loading ? (
          <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: P.sub }} /></div>
        ) : error ? (
          <div style={{ marginTop: 16 }}><ErrorBanner message={error} onDismiss={load} /></div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ padding: 40, gap: 8 }}>
            <Users className="w-10 h-10" style={{ color: P.ter }} />
            <p style={{ fontSize: 17, fontWeight: 600 }}>Sin clientes</p>
            <p style={{ fontSize: 14, color: P.sub }}>Agrega un cliente con el botón +.</p>
          </div>
        ) : (
          <>
            {selected && (
              <button onClick={() => { onSelect(null); onClose(); }} className="w-full flex items-center gap-2" style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "#2C2C2E", color: "#FF453A", fontSize: 16 }}>
                <UserX className="w-5 h-5" /> Quitar cliente asignado
              </button>
            )}
            <div style={{ marginTop: 16, borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>
              {filtered.map((c, i) => {
                const vip = isVIP(c);
                return (
                  <button key={c.id} onClick={() => { onSelect(c); onClose(); }} className="w-full flex items-center gap-3 text-left" style={{ padding: "10px 14px", borderTop: i ? `0.5px solid ${P.sep}` : "none" }}>
                    <span style={{ width: 40, height: 40, borderRadius: 999, background: vip ? "rgba(255,214,10,0.18)" : tint(P.brand, 0.12), color: vip ? "#FF9F0A" : P.brand, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(c.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5" style={{ fontSize: 15, fontWeight: 500 }}>
                        <span className="truncate">{customerDisplayName(c)}</span>
                        {vip && <Crown className="w-3 h-3" style={{ color: "#FFD60A" }} />}
                        {c.is_b2b === true && <Building2 className="w-3 h-3" style={{ color: P.info }} />}
                      </span>
                      {(c.phone || c.email) && <span className="block truncate" style={{ fontSize: 12, color: P.sub }}>{c.phone || c.email}</span>}
                    </span>
                    {selected?.id === c.id && <Check className="w-4 h-4" style={{ color: P.brand }} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Dialog>
      <NewCustomerDialog open={open && adding} tenantId={tenantId} onClose={() => setAdding(false)}
        onSaved={(c) => { setCustomers((list) => [c, ...list]); onSelect(c); setAdding(false); onClose(); }} />
    </>
  );
}

function relative(date) {
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return `${h} h`;
}

export function HeldCartsDialog({ open, heldCarts, onClose, onResume, onDiscard }) {
  return (
    <Dialog open={open} onClose={onClose} title="Carritos en pausa" width={520} leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={null}>
      {heldCarts.length === 0 ? (
        <div className="flex flex-col items-center text-center" style={{ padding: 40, gap: 8 }}>
          <PauseCircle className="w-10 h-10" style={{ color: P.ter }} />
          <p style={{ fontSize: 17, fontWeight: 600 }}>Sin carritos en pausa</p>
          <p style={{ fontSize: 14, color: P.sub }}>{'Usa "Poner carrito en pausa" para guardar un carrito temporalmente'}</p>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 8, borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>
            {heldCarts.map((h, i) => {
              const label = h.customer ? customerDisplayName(h.customer) : `${h.items.length} item${h.items.length === 1 ? "" : "s"}`;
              const total = h.items.reduce((s, it) => s + lineTotalWithTax(it), 0);
              return (
                <div key={h.id} className="flex items-center gap-3" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${P.sep}` : "none" }}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{label}</p>
                    <p className="flex items-center gap-1" style={{ fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: P.brand }}>{usd(total)}</span>
                      <span style={{ color: P.ter }}>·</span>
                      <span style={{ color: P.sub }}>{h.items.length} item{h.items.length === 1 ? "" : "s"}</span>
                      <span style={{ color: P.ter }}>·</span>
                      <span style={{ color: P.sub }}>{relative(h.savedAt)}</span>
                    </p>
                  </div>
                  <button onClick={() => onDiscard(h)} aria-label="Descartar" title="Descartar" className="apple-press" style={{ color: P.danger, padding: 6 }}><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => onResume(h)} className="apple-press" style={{ padding: "5px 10px", borderRadius: 999, background: tint(P.brand, 0.12), color: P.brand, fontSize: 12, fontWeight: 600 }}>Reanudar</button>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: P.sub, margin: "6px 4px 0" }}>Máximo 3 carritos en pausa. Al reanudar uno, tu carrito actual se pausa automáticamente.</p>
        </>
      )}
    </Dialog>
  );
}
