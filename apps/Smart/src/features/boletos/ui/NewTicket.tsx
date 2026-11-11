import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { WhatsAppCard } from "./WhatsAppCard";
import { EQUIPMENT } from "../domain/equipment";
import {
  allStepsValid, canAdvance, customerFullName, DEVICE_TYPE_LABEL, emptyDraft, NEW_TICKET_STEPS, PROBLEM_OPTIONS,
  problemSummary, stepErrors,
} from "../domain/newTicket";
import type { NewTicketDraft, NewTicketStep } from "../domain/newTicket";
import { toggleIn } from "../domain/filters";
import { createTicket } from "../data/api";
import type { SessionInfo } from "../data/api";
import type { OrderRow } from "../domain/types";
import { activeTenantId } from "../data/api";
import { findDuplicateByPhone } from "@/lib/wizard/api";

interface Props {
  session: SessionInfo;
  onClose: () => void;
  onCreated: (order: OrderRow) => void;
}

interface OptionCardProps {
  icon: string;
  title: string;
  hint?: string;
  on: boolean;
  multi?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function OptionCard({ icon, title, hint, on, multi, disabled, onClick }: OptionCardProps) {
  return (
    <button type="button" className={`rb-oc${on ? " on" : ""}${multi ? " multi" : ""}${disabled ? " dis" : ""}`} onClick={onClick} aria-pressed={on} disabled={disabled}>
      <i><Icon name={icon} /></i>
      <b>{title}</b>
      {hint ? <small>{hint}</small> : null}
      <u><Icon name="check" /></u>
    </button>
  );
}

function Field({ label, value, onChange, wide, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean; type?: string; placeholder?: string }) {
  return (
    <label className={wide ? "w2" : undefined}>
      <small>{label}</small>
      <input value={value} type={type ?? "text"} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function NewTicket({ session, onClose, onCreated }: Props) {
  const [draft, setDraft] = useState<NewTicketDraft>(() => emptyDraft());
  const [step, setStep] = useState<NewTicketStep>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false);
  const [match, setMatch] = useState<{ id: string; name: string; phone: string; email: string } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const set = (patch: Partial<NewTicketDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    set({ photoCount: files.length });
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    const digits = draft.phone.replace(/\D/g, "");
    const tenant = activeTenantId();
    if (digits.length < 10 || !tenant || draft.customerId) return undefined;
    let alive = true;
    const t = setTimeout(() => {
      findDuplicateByPhone(tenant, draft.phone)
        .then((c: Record<string, string> | null) => {
          if (alive) setMatch(c ? { id: c.id, name: c.name, phone: c.phone, email: c.email ?? "" } : null);
        })
        .catch(() => {});
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [draft.phone, draft.customerId]);

  const errors = stepErrors(step, draft);
  const last = step === 5;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const next = () => {
    if (!canAdvance(step, draft)) {
      setShown(true);
      return;
    }
    setShown(false);
    setStep((s) => Math.min(5, s + 1) as NewTicketStep);
  };

  const create = async () => {
    if (!allStepsValid(draftRef.current)) {
      setShown(true);
      setError("Faltan datos obligatorios. Revisa los pasos marcados.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await createTicket(draftRef.current, files, session, (p) => setDraft((d) => ({ ...d, ...(p.customerId ? { customerId: p.customerId } : {}), ...(p.orderNumber ? { orderNumber: p.orderNumber } : {}) })));
      onCreated(result.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el boleto.");
    } finally {
      setBusy(false);
    }
  };

  const useMatch = () => {
    if (!match) return;
    const parts = match.name.trim().split(/\s+/);
    set({ customerId: match.id, firstName: parts[0] ?? "", lastName: parts.slice(1).join(" "), phone: match.phone || draft.phone, email: match.email || draft.email });
    setMatch(null);
  };

  const summaryRow = (idx: NewTicketStep, icon: string, label: string, title: string, sub: string, pending: boolean) =>
    pending ? (
      <div key={label} className="pd"><i><Icon name={icon} /></i><div><small>{label}</small><b>Pendiente</b></div></div>
    ) : (
      <button key={label} type="button" onClick={() => setStep(idx)}>
        <i><Icon name={icon} /></i>
        <div><small>{label}</small><b>{title}</b>{sub ? <span>{sub}</span> : null}</div>
      </button>
    );

  const summary = (
    <div className="rb-sm3">
      <h3>Resumen del boleto</h3>
      {summaryRow(0, "user", "Cliente", customerFullName(draft), [draft.phone, draft.customerId ? "Cliente existente" : "Cliente nuevo"].filter(Boolean).join(" · "), !customerFullName(draft))}
      {summaryRow(1, "phone", "Equipo", [draft.brand, draft.model].filter(Boolean).join(" ") || DEVICE_TYPE_LABEL[draft.equipment], DEVICE_TYPE_LABEL[draft.equipment], !draft.brand.trim() && !draft.model.trim())}
      {summaryRow(2, "alert", "Problema", problemSummary(draft) || "Sin describir", "", !problemSummary(draft))}
      {summaryRow(3, "img", "Fotos", `${files.length} ${files.length === 1 ? "foto" : "fotos"}`, "De la cámara o la galería", files.length === 0 && step < 3)}
      {summaryRow(4, "dollar", "Cotización", draft.estimate.trim() ? `$${draft.estimate.trim()} estimado` : "Sin estimado", draft.highPriority ? "Prioridad alta" : "", step < 4)}
    </div>
  );

  const content = useMemo(() => {
    if (step === 0) {
      return (
        <>
          <h2>¿Para quién es el boleto?</h2>
          <p>Escribe el teléfono y Repara OS busca si el cliente ya existe.</p>
          <div className="rb-fld" style={{ ["--fc" as string]: 2 }}>
            <Field label="Teléfono" value={draft.phone} onChange={(v) => set({ phone: v, customerId: null })} type="tel" wide />
            <Field label="Nombre" value={draft.firstName} onChange={(v) => set({ firstName: v })} />
            <Field label="Apellido" value={draft.lastName} onChange={(v) => set({ lastName: v })} />
            <Field label="Correo" value={draft.email} onChange={(v) => set({ email: v })} type="email" wide />
          </div>
          {match ? (
            <div className="rb-hit">
              <div><b>{match.name}</b><span>Ya existe un cliente con este teléfono</span></div>
              <button type="button" className="rb-btn sm sf" onClick={useMatch}>Usar este cliente</button>
            </div>
          ) : null}
          {draft.customerId ? <div className="rb-hit"><div><b>Cliente existente</b><span>El boleto se guardará a su nombre</span></div></div> : null}
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <h2>¿Qué equipo es?</h2>
          <p>Elige el tipo y escribe marca y modelo.</p>
          <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
            {EQUIPMENT.map((e) => <OptionCard key={e.id} icon={e.icon} title={e.label} on={draft.equipment === e.id} onClick={() => set({ equipment: e.id })} />)}
          </div>
          <h4>Datos del equipo</h4>
          <div className="rb-fld" style={{ ["--fc" as string]: 2 }}>
            <Field label="Marca" value={draft.brand} onChange={(v) => set({ brand: v })} />
            <Field label="Modelo" value={draft.model} onChange={(v) => set({ model: v })} />
            <Field label="Serie o IMEI (opcional)" value={draft.serial} onChange={(v) => set({ serial: v })} wide />
          </div>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <h2>¿Qué problema tiene?</h2>
          <p>Marca todos los que apliquen.</p>
          <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
            {PROBLEM_OPTIONS.map((p) => <OptionCard key={p.id} icon={p.icon} title={p.label} multi on={draft.problems.includes(p.id)} onClick={() => set({ problems: toggleIn(draft.problems, p.id) })} />)}
          </div>
          <h4>Detalle</h4>
          <div className="rb-fld" style={{ ["--fc" as string]: 1 }}>
            <label><small>Describe el problema</small><textarea rows={3} value={draft.problemText} onChange={(e) => set({ problemText: e.target.value })} /></label>
          </div>
        </>
      );
    }
    if (step === 3) {
      return (
        <>
          <h2>Fotos del equipo</h2>
          <p>Añade fotos desde la cámara o la galería.</p>
          <div className="rb-ocs" style={{ ["--oc" as string]: 3 }}>
            <OptionCard icon="cam" title="Cámara" hint={files.length ? `${files.length} en el boleto` : "Tomar foto"} on={false} onClick={() => camRef.current?.click()} />
            <OptionCard icon="img" title="Galería" hint="Elegir de la galería" on={false} onClick={() => galRef.current?.click()} />
            <OptionCard icon="wa" title="WhatsApp" hint="Sin conectar" on={false} disabled onClick={() => {}} />
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {previews.length ? (
            <div className="rb-prev">
              {previews.map((u, i) => (
                <div key={u} className="rb-ph"><img src={u} alt={`Foto ${i + 1}`} /><button type="button" className="rb-ib ghost" style={{ position: "absolute", right: 0, top: 0, width: 28, height: 28, color: "#fff", background: "rgba(0,0,0,.45)", borderRadius: "50%" }} aria-label="Quitar foto" onClick={() => setFiles((f) => f.filter((_, k) => k !== i))}><Icon name="x" /></button></div>
              ))}
            </div>
          ) : null}
          <h4>Bandeja de WhatsApp</h4>
          <WhatsAppCard />
        </>
      );
    }
    if (step === 4) {
      return (
        <>
          <h2>Pasos opcionales</h2>
          <p>Se pueden completar después desde el boleto.</p>
          <div className="rb-ocs" style={{ ["--oc" as string]: 2 }}>
            <OptionCard icon="bolt" title="Servicio rápido" hint="Se hace mientras el cliente espera" multi on={draft.quick} onClick={() => set({ quick: !draft.quick })} />
            <OptionCard icon="alert" title="Prioridad alta" hint="Pasa al frente de la fila" multi on={draft.highPriority} onClick={() => set({ highPriority: !draft.highPriority })} />
            <OptionCard icon="drop" title="Daño por líquido" hint="Se avisa al cliente" multi on={draft.liquidDamage} onClick={() => set({ liquidDamage: !draft.liquidDamage })} />
          </div>
          <h4>Estimado</h4>
          <div className="rb-tags">
            {["", "50", "100", "150", "200"].map((v) => (
              <button key={v || "none"} type="button" className={`rb-op${draft.estimate === v ? " on" : ""}`} onClick={() => set({ estimate: v })}>{v ? `$${v}` : "Sin estimado"}</button>
            ))}
          </div>
          <div className="rb-fld" style={{ ["--fc" as string]: 1, marginTop: 8 }}>
            <Field label="Otro monto" value={draft.estimate} onChange={(v) => set({ estimate: v })} placeholder="0.00" />
          </div>
        </>
      );
    }
    return (
      <>
        <h2>Revisa y crea</h2>
        <p>Toca cualquier bloque para corregirlo sin perder lo demás.</p>
        {summary}
      </>
    );
  }, [step, draft, files, previews, match]);

  return (
    <div className="rb-wz" role="dialog" aria-label="Nuevo boleto">
      <div className="rb-wz-h">
        <button type="button" className="rb-ib ghost" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        <h1>Nuevo boleto</h1>
      </div>
      <div className="rb-wz-p">
        {NEW_TICKET_STEPS.map((s, i) => (
          <div key={s} className={i < step ? "dn" : i === step ? "on" : undefined}>{s}</div>
        ))}
      </div>
      <div className="rb-wz-b">
        <div className="rb-wz-m">
          {content}
          {shown && errors.length ? <div className="rb-err" role="alert">{errors.map((e) => <div key={e}>{e}</div>)}</div> : null}
          {error ? <div className="rb-err" role="alert">{error}</div> : null}
        </div>
        <aside className="rb-wz-s">{summary}</aside>
      </div>
      <div className="rb-wz-f">
        {step > 0 ? <button type="button" className="rb-btn" onClick={() => { setShown(false); setStep((s) => Math.max(0, s - 1) as NewTicketStep); }} disabled={busy}>Atrás</button> : null}
        <small>Paso {step + 1} de 6 · {NEW_TICKET_STEPS[step]}</small>
        <span className="rb-sp" />
        {last ? (
          <button type="button" className="rb-btn pr" onClick={create} disabled={busy}><Icon name="check" />{busy ? "Creando..." : "Crear boleto"}</button>
        ) : (
          <button type="button" className="rb-btn pr" onClick={next}>Continuar<Icon name="right" /></button>
        )}
      </div>
    </div>
  );
}
