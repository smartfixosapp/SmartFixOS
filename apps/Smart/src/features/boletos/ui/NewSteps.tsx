import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { WhatsAppCard } from "./WhatsAppCard";
import { AmountChips, Chips, Field, OptionCard, SignaturePad } from "./NewParts";
import { EQUIPMENT } from "../domain/equipment";
import { MODES } from "../domain/guided";
import { checkCounts, checklistItems, checklistSummary, cycleCheck, markAllOk, statusOf } from "../domain/checklist";
import { DEPOSIT_METHODS, depositCents, depositOptions, estimateCents, ESTIMATE_AMOUNTS } from "../domain/quote";
import { formatCents } from "../domain/money";
import { deviceClassOf, optionalSections, sectionOn } from "../domain/newTicket";
import type { NewTicketDraft, OptionalSection } from "../domain/newTicket";
import { problemOptions } from "../domain/problems";
import { CARRIERS, OTHER_CARRIER, RECHARGE_AMOUNTS, UNLOCK_AMOUNTS, UNLOCK_TYPES } from "../domain/services";
import { autoPickTechnician, orderTechnicians } from "../domain/technicians";
import type { Technician } from "../domain/technicians";
import type { RegisterState, DepositMethod } from "../domain/quote";
import { toggleIn } from "../domain/filters";
import { searchExistingCustomers, activeTenantId } from "../data/api";
import type { CustomerHit } from "../data/api";
import { findDuplicateByPhone } from "@/lib/wizard/api";

export type SetDraft = (patch: Partial<NewTicketDraft>) => void;

export interface PhotoApi {
  files: File[];
  previews: string[];
  add: (list: FileList | null) => void;
  remove: (index: number) => void;
}

interface Match {
  id: string;
  name: string;
  phone: string;
  email: string;
  isB2b: boolean;
  company: string;
}

export function CustomerStep({ draft, set, onMode }: { draft: NewTicketDraft; set: SetDraft; onMode: (m: NewTicketDraft["mode"]) => void }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const digits = draft.phone.replace(/\D/g, "");
    const tenant = activeTenantId();
    if (digits.length < 10 || !tenant || draft.customerId) {
      setMatch(null);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(() => {
      findDuplicateByPhone(tenant, draft.phone)
        .then((c: Record<string, unknown> | null) => {
          if (alive) setMatch(c ? { id: String(c.id), name: String(c.name ?? ""), phone: String(c.phone ?? ""), email: String(c.email ?? ""), isB2b: c.is_b2b === true, company: String(c.company_name ?? "") } : null);
        })
        .catch(() => {});
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [draft.phone, draft.customerId]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setHits([]);
      return undefined;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchExistingCustomers(query)
        .then((rows) => alive && setHits(rows))
        .catch(() => alive && setHits([]))
        .finally(() => alive && setSearching(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const pick = (c: Match | CustomerHit) => {
    const parts = c.name.trim().split(/\s+/);
    set({
      customerId: c.id,
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      phone: c.phone || draft.phone,
      email: c.email || draft.email,
      business: c.isB2b ? { ...draft.business, enabled: true, companyName: c.company } : draft.business,
    });
    setMatch(null);
    setHits([]);
    setQuery("");
  };

  const biz = draft.business;
  const setBiz = (patch: Partial<NewTicketDraft["business"]>) => set({ business: { ...biz, ...patch } });

  return (
    <>
      <h2>¿Qué servicio es y para quién?</h2>
      <p>Toca una tarjeta. El modo cambia los pasos que siguen.</p>
      <div className="rb-ocs m4">
        {MODES.map((m) => <OptionCard key={m.id} icon={m.icon} title={m.label} hint={m.hint} on={draft.mode === m.id} onClick={() => onMode(m.id)} />)}
      </div>
      <h4>Buscar cliente</h4>
      <div className="rb-fld" style={{ ["--fc" as string]: 1 }}>
        <Field label="Nombre, teléfono o correo de un cliente existente" value={query} onChange={setQuery} />
      </div>
      {query.trim().length >= 3 && !hits.length ? <div className="rb-hit"><div><span>{searching ? "Buscando..." : "No hay clientes con esa búsqueda. Llena los datos de abajo para crear uno nuevo."}</span></div></div> : null}
      {hits.map((h) => (
        <div key={h.id} className="rb-hit">
          <div><b>{h.company ? `${h.company} · ${h.name}` : h.name}</b><span>{[h.phone, h.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span></div>
          <button type="button" className="rb-btn sm sf" onClick={() => pick(h)}>Usar</button>
        </div>
      ))}
      <h4>Tipo de cliente</h4>
      <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
        <OptionCard icon="user" title="Individual" on={!biz.enabled} onClick={() => setBiz({ enabled: false })} />
        <OptionCard icon="bld" title="Empresa" on={biz.enabled} onClick={() => setBiz({ enabled: true })} />
      </div>
      {biz.enabled ? (
        <div className="rb-fld" style={{ ["--fc" as string]: 2, marginTop: 8 }}>
          <Field label="Nombre de la empresa" value={biz.companyName} onChange={(v) => setBiz({ companyName: v })} wide />
          <Field label="Identificación fiscal (opcional)" value={biz.taxId} onChange={(v) => setBiz({ taxId: v })} />
          <Field label="Correo de facturación (opcional)" value={biz.billingEmail} onChange={(v) => setBiz({ billingEmail: v })} type="email" />
        </div>
      ) : null}
      <h4>{biz.enabled ? "Contacto" : "Datos"}</h4>
      <div className="rb-fld" style={{ ["--fc" as string]: 2 }}>
        <Field label="Teléfono" value={draft.phone} onChange={(v) => set({ phone: v, customerId: null })} type="tel" inputMode="tel" wide />
        <Field label="Nombre" value={draft.firstName} onChange={(v) => set({ firstName: v })} />
        <Field label="Apellido" value={draft.lastName} onChange={(v) => set({ lastName: v })} />
        <Field label="Correo" value={draft.email} onChange={(v) => set({ email: v })} type="email" inputMode="email" wide />
      </div>
      {match ? (
        <div className="rb-hit">
          <div><b>{match.name}</b><span>Ya existe un cliente con este teléfono</span></div>
          <button type="button" className="rb-btn sm sf" onClick={() => pick(match)}>Usar este cliente</button>
        </div>
      ) : null}
      {draft.customerId ? <div className="rb-hit"><div><b>Cliente existente</b><span>El boleto se guardará a su nombre. Si cambias el teléfono se crea otro cliente.</span></div></div> : null}
    </>
  );
}

export function EquipmentStep({ draft, set, photos, analysis, analyzing, onReference }: {
  draft: NewTicketDraft;
  set: SetDraft;
  photos: PhotoApi;
  analysis: string;
  analyzing: boolean;
  onReference: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <h2>¿Qué equipo es?</h2>
      <p>Toma una foto de referencia y Repara OS marca primero los problemas que ve. Tú confirmas.</p>
      <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
        <OptionCard icon="spark" title="Foto de referencia" hint={analyzing ? "Analizando..." : photos.files.length ? "Foto añadida al boleto" : "Cámara o galería"} on={false} onClick={() => ref.current?.click()} />
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onReference(f); e.target.value = ""; }} />
      {analysis ? <div className="rb-hit"><div><b>Foto analizada</b><span>{analysis}</span></div></div> : null}
      <h4>Tipo de equipo</h4>
      <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
        {EQUIPMENT.filter((e) => e.id !== "unlocks").map((e) => <OptionCard key={e.id} icon={e.icon} title={e.label} on={draft.equipment === e.id} onClick={() => set({ equipment: e.id })} />)}
      </div>
      <h4>Datos del equipo</h4>
      <div className="rb-fld" style={{ ["--fc" as string]: 2 }}>
        <Field label="Marca" value={draft.brand} onChange={(v) => set({ brand: v })} />
        <Field label="Modelo" value={draft.model} onChange={(v) => set({ model: v })} />
        <Field label="Color (opcional)" value={draft.color} onChange={(v) => set({ color: v })} />
        <Field label="Serie o IMEI (opcional)" value={draft.serial} onChange={(v) => set({ serial: v })} />
      </div>
    </>
  );
}

export function ProblemStep({ draft, set }: { draft: NewTicketDraft; set: SetDraft }) {
  const options = problemOptions(deviceClassOf(draft), draft.hints);
  return (
    <>
      <h2>¿Qué problema tiene?</h2>
      <p>Marca todos los que apliquen. Lo que se ve en la foto sale primero.</p>
      <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
        {options.map((p) => <OptionCard key={p.id} icon={p.icon} title={p.label} hint={p.hint} multi on={draft.problems.includes(p.id)} onClick={() => set({ problems: toggleIn(draft.problems, p.id) })} />)}
      </div>
      <h4>Detalle</h4>
      <div className="rb-fld" style={{ ["--fc" as string]: 1 }}>
        <label><small>Describe el problema</small><textarea rows={3} value={draft.problemText} onChange={(e) => set({ problemText: e.target.value })} /></label>
      </div>
    </>
  );
}

export function PhotosStep({ photos }: { photos: PhotoApi }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  return (
    <>
      <h2>Fotos del equipo</h2>
      <p>Añade fotos desde la cámara o la galería.</p>
      <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
        <OptionCard icon="cam" title="Cámara" hint={photos.files.length ? `${photos.files.length} en el boleto` : "Tomar foto"} on={false} onClick={() => cam.current?.click()} />
        <OptionCard icon="img" title="Galería" hint="Elegir de la galería" on={false} onClick={() => gal.current?.click()} />
        <OptionCard icon="wa" title="WhatsApp" hint="Sin conectar" on={false} disabled onClick={() => {}} />
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { photos.add(e.target.files); e.target.value = ""; }} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => { photos.add(e.target.files); e.target.value = ""; }} />
      {photos.previews.length ? (
        <div className="rb-prev">
          {photos.previews.map((u, i) => (
            <div key={u} className="rb-ph"><img src={u} alt={`Foto ${i + 1}`} /><button type="button" className="rb-ib ghost rb-x" aria-label="Quitar foto" onClick={() => photos.remove(i)}><Icon name="x" /></button></div>
          ))}
        </div>
      ) : null}
      <h4>Bandeja de WhatsApp</h4>
      <WhatsAppCard />
    </>
  );
}

const SECTION_META: Record<OptionalSection, { icon: string; title: string }> = {
  checklist: { icon: "list", title: "Revisión del equipo" },
  quote: { icon: "dollar", title: "Cotización y depósito" },
  technician: { icon: "user", title: "Técnico" },
  signature: { icon: "pen", title: "Firma del cliente" },
};

export function OptionalStep({ draft, set, techs, employeeId, employeeName, methods, register, onSignature }: {
  draft: NewTicketDraft;
  set: SetDraft;
  techs: Technician[];
  employeeId?: string;
  employeeName: string;
  methods: DepositMethod[];
  register: RegisterState;
  onSignature: (blob: Blob | null) => void;
}) {
  const sections = optionalSections(draft.mode);
  const items = checklistItems(deviceClassOf(draft));
  const counts = checkCounts(items, draft.checklist);
  const est = estimateCents(draft);
  const dep = depositCents(draft);
  const ordered = orderTechnicians(techs, employeeId, employeeName);

  const hint = (s: OptionalSection): string => {
    if (!sectionOn(draft, s)) return s === "signature" ? "Pasa el equipo al cliente" : "Se puede completar después";
    if (s === "checklist") return checklistSummary(items, draft.checklist) ?? `${items.length} puntos`;
    if (s === "quote") return est !== null ? `Estimado ${formatCents(est)}${dep > 0 ? ` · depósito ${formatCents(dep)}` : ""}` : "Sin estimado";
    if (s === "technician") return draft.technician?.name ?? "Sin asignar";
    return draft.signed ? "Firmada" : "Falta la firma";
  };

  const toggle = (s: OptionalSection) => {
    if (s === "checklist") set({ checklistOn: !draft.checklistOn });
    if (s === "quote") set({ quoteOn: !draft.quoteOn });
    if (s === "signature") set({ signatureOn: !draft.signatureOn });
    if (s === "technician") {
      const turningOn = !draft.techOn;
      set({ techOn: turningOn, technician: turningOn && !draft.technician ? autoPickTechnician(techs, employeeId, employeeName) : draft.technician });
    }
  };

  return (
    <>
      <h2>Pasos opcionales</h2>
      <p>Activa solo los que hagan falta. Se pueden completar después desde el boleto.</p>
      {sections.length ? (
        <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
          {sections.map((s) => <OptionCard key={s} icon={SECTION_META[s].icon} title={SECTION_META[s].title} hint={hint(s)} multi on={sectionOn(draft, s)} onClick={() => toggle(s)} />)}
        </div>
      ) : null}
      {sectionOn(draft, "checklist") ? (
        <>
          <h4>Revisión del equipo · {counts.damaged} dañados, {counts.ok} funcionan</h4>
          <div className="rb-chk">
            {items.map((i) => {
              const st = statusOf(draft.checklist, i.id);
              return (
                <button key={i.id} type="button" className={st} onClick={() => set({ checklist: cycleCheck(draft.checklist, i.id) })}>
                  <span>{i.label}</span>
                  <em>{st === "ok" ? "Funciona" : st === "damaged" ? "Dañado" : "No probado"}</em>
                </button>
              );
            })}
          </div>
          <div className="rb-tags"><button type="button" className="rb-op" onClick={() => set({ checklist: markAllOk(items, draft.checklist) })}>Marcar lo no probado como funciona</button></div>
        </>
      ) : null}
      {sectionOn(draft, "quote") ? (
        <>
          <h4>Estimado</h4>
          <AmountChips value={draft.estimate} amounts={ESTIMATE_AMOUNTS} onChange={(v) => set({ estimate: v })} noneLabel="Sin estimado" />
          <h4>Depósito</h4>
          <Chips items={depositOptions(draft)} value={draft.deposit} onChange={(v) => set({ deposit: v })} />
          <div className="rb-fld" style={{ ["--fc" as string]: 1, marginTop: 8 }}>
            <Field label="Otro depósito" value={draft.deposit === "half" || depositOptions(draft).some((o) => o.id === draft.deposit) ? "" : draft.deposit} onChange={(v) => set({ deposit: v })} placeholder="0.00" inputMode="decimal" />
          </div>
          {dep > 0 ? (
            <>
              <h4>Método del depósito</h4>
              <Chips items={DEPOSIT_METHODS.filter((m) => methods.includes(m.id)).map((m) => ({ id: m.id, label: m.label }))} value={draft.depositMethod} onChange={(v) => set({ depositMethod: v as DepositMethod })} />
              {register !== "open" ? <div className="rb-hit"><div><b>{register === "closed" ? "La caja está cerrada" : "No se pudo verificar la caja"}</b><span>El boleto se crea igual y el depósito de {formatCents(dep)} queda pendiente hasta que abras la caja.</span></div></div> : null}
            </>
          ) : null}
        </>
      ) : null}
      {sectionOn(draft, "technician") ? (
        <>
          <h4>¿Quién se encarga?</h4>
          <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
            {ordered.map((t) => <OptionCard key={t.id} icon="user" title={t.name} hint={t.openOrders > 0 ? `${t.openOrders} abiertas` : "Libre"} on={draft.technician?.id === t.id} onClick={() => set({ technician: { id: t.id, name: t.name, auto: false } })} />)}
            <OptionCard icon="users" title="Sin asignar" on={!draft.technician} onClick={() => set({ technician: null })} />
          </div>
        </>
      ) : null}
      {sectionOn(draft, "signature") ? (
        <>
          <h4>Firma</h4>
          <SignaturePad signed={draft.signed} onChange={(b) => { onSignature(b); set({ signed: !!b }); }} />
        </>
      ) : null}
      {sections.length ? (
        <>
          <h4>Otros datos</h4>
          <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
            <OptionCard icon="alert" title="Prioridad alta" hint="Pasa al frente de la fila" multi on={draft.highPriority} onClick={() => set({ highPriority: !draft.highPriority })} />
            <OptionCard icon="drop" title="Daño por líquido" hint="Se avisa al cliente" multi on={draft.liquidDamage} onClick={() => set({ liquidDamage: !draft.liquidDamage })} />
          </div>
        </>
      ) : null}
    </>
  );
}

export function RechargeStep({ draft, set }: { draft: NewTicketDraft; set: SetDraft }) {
  const r = draft.recharge;
  const setR = (patch: Partial<NewTicketDraft["recharge"]>) => set({ recharge: { ...r, ...patch } });
  return (
    <>
      <h2>Recarga</h2>
      <p>Elige la operadora, el número y el monto.</p>
      <h4>Operadora</h4>
      <Chips items={[...CARRIERS, OTHER_CARRIER].map((c) => ({ id: c, label: c }))} value={r.carrier} onChange={(v) => setR({ carrier: v })} />
      {r.carrier === OTHER_CARRIER ? (
        <div className="rb-fld" style={{ ["--fc" as string]: 1, marginTop: 8 }}>
          <Field label="Nombre de la operadora" value={r.carrierOther} onChange={(v) => setR({ carrierOther: v })} />
        </div>
      ) : null}
      <h4>Número a recargar</h4>
      <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
        <OptionCard icon="phone" title="El del cliente" hint={draft.phone || "Escribe el teléfono en el primer paso"} on={r.sameNumber} onClick={() => setR({ sameNumber: true })} />
        <OptionCard icon="sim" title="Otro número" on={!r.sameNumber} onClick={() => setR({ sameNumber: false })} />
      </div>
      {!r.sameNumber ? (
        <div className="rb-fld" style={{ ["--fc" as string]: 1, marginTop: 8 }}>
          <Field label="Número" value={r.phone} onChange={(v) => setR({ phone: v })} type="tel" inputMode="tel" />
        </div>
      ) : null}
      <h4>Monto</h4>
      <AmountChips value={r.amount} amounts={RECHARGE_AMOUNTS} onChange={(v) => setR({ amount: v })} />
    </>
  );
}

export function UnlockStep({ draft, set }: { draft: NewTicketDraft; set: SetDraft }) {
  const u = draft.unlock;
  const setU = (patch: Partial<NewTicketDraft["unlock"]>) => set({ unlock: { ...u, ...patch } });
  return (
    <>
      <h2>Desbloqueo</h2>
      <p>Elige el trabajo y anota los datos del equipo.</p>
      <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
        {UNLOCK_TYPES.map((t) => <OptionCard key={t.id} icon="unlock" title={t.label} hint={t.hint} on={u.type === t.id} onClick={() => setU({ type: t.id })} />)}
      </div>
      <h4>Equipo</h4>
      <div className="rb-fld" style={{ ["--fc" as string]: 2 }}>
        <Field label="Marca" value={u.brand} onChange={(v) => setU({ brand: v })} />
        <Field label="Modelo" value={u.model} onChange={(v) => setU({ model: v })} />
        <Field label="Operadora (opcional)" value={u.carrier} onChange={(v) => setU({ carrier: v })} />
        <Field label="IMEI (opcional, 15 dígitos)" value={u.imei} onChange={(v) => setU({ imei: v })} inputMode="numeric" />
      </div>
      <h4>Monto del servicio</h4>
      <AmountChips value={u.amount} amounts={UNLOCK_AMOUNTS} onChange={(v) => setU({ amount: v })} />
    </>
  );
}
