import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { CustomerStep, EquipmentStep, OptionalStep, PhotosStep, ProblemStep, RechargeStep, UnlockStep } from "./NewSteps";
import type { PhotoApi } from "./NewSteps";
import { advance, back, goTo, missingSteps, readyToCreate, selectMode, STEP_LABEL, stepErrors, stepsFor } from "../domain/guided";
import { checklistItems, checklistSummary } from "../domain/checklist";
import {
  customerFullName, DEVICE_TYPE_LABEL, effectiveDepositCents, effectiveEstimateCents, effectiveTechnician, emptyDraft, problemSummary, sectionOn,
} from "../domain/newTicket";
import type { GuidedMode, NewTicketDraft, StepId } from "../domain/newTicket";
import { deviceClassOf } from "../domain/newTicket";
import { DEPOSIT_METHODS } from "../domain/quote";
import type { DepositMethod, RegisterState } from "../domain/quote";
import { formatCents } from "../domain/money";
import { rechargeCarrierName, rechargeNumber, unlockTypeLabel } from "../domain/services";
import type { Technician } from "../domain/technicians";
import { analyzeReference, createTicket, loadPaymentMethods, loadTechnicianList, registerState } from "../data/api";
import type { SessionInfo } from "../data/api";
import type { OrderRow } from "../domain/types";

interface Props {
  session: SessionInfo;
  onClose: () => void;
  onCreated: (order: OrderRow) => void;
}

interface Row {
  step: StepId;
  icon: string;
  label: string;
  title: string;
  sub: string;
  pending: boolean;
}

export function NewTicket({ session, onClose, onCreated }: Props) {
  const [draft, setDraft] = useState<NewTicketDraft>(() => emptyDraft());
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(false);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [methods, setMethods] = useState<DepositMethod[]>(["cash"]);
  const [register, setRegister] = useState<RegisterState>("unknown");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState<{ order: OrderRow; warnings: string[] } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const signatureRef = useRef<Blob | null>(null);

  const set = (patch: Partial<NewTicketDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    setDraft((d) => ({ ...d, photoCount: files.length }));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    let alive = true;
    loadTechnicianList().then((l) => alive && setTechs(l)).catch(() => {});
    loadPaymentMethods(session.tenant).then((m) => alive && setMethods(m)).catch(() => {});
    registerState().then((r) => alive && setRegister(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [session.tenant]);

  const step = draft.step;
  const steps = stepsFor(draft.mode);
  const index = steps.indexOf(step);
  const errors = stepErrors(step, draft);
  const last = step === "summary";

  const photos: PhotoApi = {
    files,
    previews,
    add: (list) => list && setFiles((prev) => [...prev, ...Array.from(list)]),
    remove: (i) => setFiles((f) => f.filter((_, k) => k !== i)),
  };

  const onReference = (file: File) => {
    setFiles((prev) => [...prev, file]);
    setAnalyzing(true);
    setAnalysis("");
    const d = draftRef.current;
    analyzeReference(file, [d.brand, d.model].filter(Boolean).join(" "))
      .then((r) => {
        setDraft((cur) => ({ ...cur, hints: r.hints }));
        setAnalysis(r.diagnosis);
      })
      .catch(() => setAnalysis("No se pudo analizar la foto. Escribe los datos del equipo."))
      .finally(() => setAnalyzing(false));
  };

  const next = () => {
    if (errors.length) {
      setShown(true);
      return;
    }
    setShown(false);
    setDraft((d) => advance(d));
  };

  const create = async () => {
    const cur = draftRef.current;
    if (!readyToCreate(cur)) {
      setShown(true);
      setError(`Faltan datos obligatorios en: ${missingSteps(cur).map((s) => STEP_LABEL[s]).join(", ")}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const sendFiles = cur.mode === "repair" || cur.mode === "quick" ? files : [];
      const result = await createTicket(
        cur,
        sendFiles,
        session,
        (p) => setDraft((d) => ({ ...d, ...(p.customerId ? { customerId: p.customerId } : {}), ...(p.orderNumber ? { orderNumber: p.orderNumber } : {}) })),
        signatureRef.current,
      );
      if (result.warnings.length) setDone({ order: result.order, warnings: result.warnings });
      else onCreated(result.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el boleto.");
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo((): Row[] => {
    const list: Row[] = [];
    const name = customerFullName(draft);
    const kind = draft.business.enabled ? `Empresa${draft.business.companyName ? ` · ${draft.business.companyName}` : ""}` : "Individual";
    list.push({ step: "customer", icon: "user", label: "Cliente", title: name, sub: [kind, draft.phone, draft.customerId ? "Cliente existente" : "Cliente nuevo"].filter(Boolean).join(" · "), pending: !name });
    if (draft.mode === "repair" || draft.mode === "quick") {
      const eq = [draft.brand, draft.model].filter(Boolean).join(" ");
      list.push({ step: "equipment", icon: "phone", label: "Equipo", title: eq || DEVICE_TYPE_LABEL[draft.equipment], sub: [DEVICE_TYPE_LABEL[draft.equipment], draft.color].filter(Boolean).join(" · "), pending: !eq });
      list.push({ step: "problem", icon: "alert", label: "Problema", title: problemSummary(draft) || "Sin describir", sub: "", pending: !problemSummary(draft) });
    }
    if (draft.mode === "repair") {
      list.push({ step: "photos", icon: "img", label: "Fotos", title: `${files.length} ${files.length === 1 ? "foto" : "fotos"}`, sub: "De la cámara o la galería", pending: false });
    }
    if (draft.mode === "recharge") {
      const amount = effectiveEstimateCents(draft);
      list.push({ step: "recharge", icon: "sim", label: "Recarga", title: amount ? formatCents(amount) : "Sin monto", sub: [rechargeCarrierName(draft.recharge), rechargeNumber(draft.recharge, draft.phone)].filter(Boolean).join(" · "), pending: !amount });
    }
    if (draft.mode === "unlock") {
      const amount = effectiveEstimateCents(draft);
      list.push({ step: "unlock", icon: "unlock", label: "Desbloqueo", title: unlockTypeLabel(draft.unlock) || "Sin tipo", sub: [[draft.unlock.brand, draft.unlock.model].filter(Boolean).join(" "), amount ? formatCents(amount) : ""].filter(Boolean).join(" · "), pending: !draft.unlock.type });
    }
    if (draft.mode === "repair" || draft.mode === "quick") {
      const est = effectiveEstimateCents(draft);
      const dep = effectiveDepositCents(draft);
      const method = DEPOSIT_METHODS.find((m) => m.id === draft.depositMethod)?.label ?? "";
      const extras = [
        est ? `Estimado ${formatCents(est)}` : "Sin estimado",
        dep > 0 ? `Depósito ${formatCents(dep)} · ${method}` : "",
        effectiveTechnician(draft) ? `Técnico ${effectiveTechnician(draft)?.name}` : "",
        sectionOn(draft, "checklist") ? `Revisión: ${checklistSummary(checklistItems(deviceClassOf(draft)), draft.checklist) ?? "sin marcar"}` : "",
        sectionOn(draft, "signature") && draft.signed ? "Firmada" : "",
        draft.highPriority ? "Prioridad alta" : "",
      ].filter(Boolean);
      list.push({ step: "optional", icon: "dollar", label: "Cotización y extras", title: extras[0] ?? "", sub: extras.slice(1).join(" · "), pending: !draft.completed.includes("optional") && step !== "summary" });
    }
    return list;
  }, [draft, files.length, step, steps]);

  const summary = (
    <div className="rb-sm3">
      <h3>Resumen del boleto</h3>
      {rows.map((r) =>
        r.pending ? (
          <div key={r.label} className="pd"><i><Icon name={r.icon} /></i><div><small>{r.label}</small><b>Pendiente</b></div></div>
        ) : (
          <button key={r.label} type="button" onClick={() => setDraft((d) => goTo(d, r.step))}>
            <i><Icon name={r.icon} /></i>
            <div><small>{r.label}</small><b>{r.title}</b>{r.sub ? <span>{r.sub}</span> : null}</div>
          </button>
        ),
      )}
    </div>
  );

  const depositNote = (() => {
    const dep = effectiveDepositCents(draft);
    if (dep <= 0) return null;
    const method = DEPOSIT_METHODS.find((m) => m.id === draft.depositMethod)?.label ?? "";
    return register === "open"
      ? { title: `Se cobrará el depósito de ${formatCents(dep)}`, sub: `${method} · justo después de crear el boleto` }
      : { title: `El depósito de ${formatCents(dep)} quedará pendiente`, sub: register === "closed" ? "La caja está cerrada. Ábrela y cóbralo desde el boleto." : "No se pudo verificar la caja. Cóbralo desde el boleto." };
  })();

  const content = (() => {
    if (step === "customer") return <CustomerStep draft={draft} set={set} onMode={(m: GuidedMode) => setDraft((d) => selectMode(d, m))} />;
    if (step === "equipment") return <EquipmentStep draft={draft} set={set} photos={photos} analysis={analysis} analyzing={analyzing} onReference={onReference} />;
    if (step === "problem") return <ProblemStep draft={draft} set={set} />;
    if (step === "photos") return <PhotosStep photos={photos} />;
    if (step === "optional") return <OptionalStep draft={draft} set={set} techs={techs} employeeId={session.employeeId} employeeName={session.employeeName} methods={methods} register={register} onSignature={(b) => { signatureRef.current = b; }} />;
    if (step === "recharge") return <RechargeStep draft={draft} set={set} />;
    if (step === "unlock") return <UnlockStep draft={draft} set={set} />;
    return (
      <>
        <h2>Revisa y crea</h2>
        <p>Toca cualquier bloque para corregirlo sin perder lo demás.</p>
        {summary}
        {depositNote ? <div className="rb-hit"><i><Icon name="dollar" /></i><div><b>{depositNote.title}</b><span>{depositNote.sub}</span></div></div> : null}
      </>
    );
  })();

  if (done) {
    return (
      <div className="rb-wz" role="dialog" aria-label="Boleto creado">
        <div className="rb-wz-h"><h1>Boleto {done.order.order_number ?? ""} creado</h1></div>
        <div className="rb-wz-b">
          <div className="rb-wz-m">
            <h2>El boleto se creó, pero revisa esto</h2>
            <p>Estos pasos no se completaron. Puedes terminarlos desde el boleto.</p>
            {done.warnings.map((w) => <div key={w} className="rb-hit"><i><Icon name="alert" /></i><div><span>{w}</span></div></div>)}
          </div>
        </div>
        <div className="rb-wz-f"><span className="rb-sp" /><button type="button" className="rb-btn pr" onClick={() => onCreated(done.order)}>Abrir boleto<Icon name="right" /></button></div>
      </div>
    );
  }

  const dep = effectiveDepositCents(draft);

  return (
    <div className="rb-wz" role="dialog" aria-label="Nuevo boleto">
      <div className="rb-wz-h">
        <button type="button" className="rb-ib ghost" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        <h1>Nuevo boleto</h1>
      </div>
      <div className="rb-wz-p">
        {steps.map((s, i) => (
          <div key={s} className={i < index ? "dn" : i === index ? "on" : undefined}>{STEP_LABEL[s]}</div>
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
        {index > 0 ? <button type="button" className="rb-btn" onClick={() => { setShown(false); setDraft((d) => back(d)); }} disabled={busy}>Atrás</button> : null}
        <small>Paso {index + 1} de {steps.length} · {STEP_LABEL[step]}</small>
        <span className="rb-sp" />
        {last ? (
          <button type="button" className="rb-btn pr" onClick={create} disabled={busy}><Icon name="check" />{busy ? "Creando..." : dep > 0 ? "Crear y cobrar depósito" : "Crear boleto"}</button>
        ) : (
          <button type="button" className="rb-btn pr" onClick={next}>Continuar<Icon name="right" /></button>
        )}
      </div>
    </div>
  );
}
