import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { StatusPill } from "./StatusPill";
import { StatusMenu } from "./StatusMenu";
import { WhatsAppCard } from "./WhatsAppCard";
import { deviceTitle, money, moneyView, partLines, partsProfit, timelineOf } from "../domain/cards";
import { equipmentMeta, equipmentOf } from "../domain/equipment";
import { statusColorVar } from "../domain/statuses";
import type { OrderRow } from "../domain/types";

interface Props {
  order: OrderRow;
  canSeeCosts: boolean;
  wide: boolean;
  busy: boolean;
  onBack: () => void;
  onToggleList: () => void;
  onChangeStatus: (key: string) => void;
  onNote: (text: string) => Promise<void>;
  onPhotos: (files: FileList) => Promise<void>;
}

const phoneHref = (v: string | null | undefined) => String(v ?? "").replace(/[^\d+]/g, "");

export function DetailPane({ order, canSeeCosts, wide, busy, onBack, onToggleList, onChangeStatus, onNote, onPhotos }: Props) {
  const [menu, setMenu] = useState(false);
  const [msgMenu, setMsgMenu] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [wa, setWa] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const photos = Array.isArray(order.device_photos) ? order.device_photos : [];
  const lines = partLines(order, canSeeCosts);
  const money_ = moneyView(order);
  const profit = canSeeCosts ? partsProfit(lines, lines.reduce((s, l) => s + l.total, 0)) : null;
  const timeline = timelineOf(order);
  const phone = phoneHref(order.customer_phone);
  const eq = equipmentMeta(equipmentOf(order));
  const promised = order.promised_date ? new Date(order.promised_date) : null;

  const pick = (key: string) => {
    setMenu(false);
    onChangeStatus(key);
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onNote(note);
      setNote("");
      setNoteOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const client = (
    <section className="rb-card">
      <h3>Cliente y equipo</h3>
      <div className="rb-kv">
        <div><small>Cliente</small><b>{order.customer_name || "Sin cliente"}</b><span>{order.customer_phone || "Sin teléfono"}</span></div>
        <div><small>Equipo</small><b>{deviceTitle(order)}</b><span>{[order.device_brand, order.device_type].filter(Boolean).join(" · ") || eq.label}</span></div>
        <div><small>Promesa</small><b>{promised && !Number.isNaN(promised.getTime()) ? promised.toLocaleString("es-PR", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Sin fecha"}</b><span>{order.created_date ? `Recibido ${new Date(order.created_date).toLocaleDateString("es-PR", { day: "numeric", month: "short" })}` : ""}</span></div>
        <div><small>Técnico</small><b>{order.assigned_to_name || "Sin asignar"}</b><span>{order.service_type && order.service_type !== "workshop" ? "Visita o cita" : "En el taller"}</span></div>
      </div>
      <div className="rb-tags">
        {order.initial_problem ? <span className="rb-tag"><Icon name="alert" />{order.initial_problem}</span> : null}
        {order.liquid_damage ? <span className="rb-tag"><Icon name="drop" />Daño por líquido</span> : null}
        {order.warranty_claim ? <span className="rb-tag"><Icon name="shield" />Reclamo de garantía</span> : null}
      </div>
    </section>
  );

  const done = (
    <section className="rb-card">
      <h3>Lo que se ha hecho</h3>
      {timeline.length ? (
        <div className="rb-tl">
          {timeline.map((t) => (
            <div key={t.key}>
              <i style={{ ["--k" as string]: t.status ? statusColorVar(t.status) : "var(--repara-text3)" }}><Icon name={t.icon} /></i>
              <div><b>{t.title}</b>{t.detail ? <span>{t.detail}</span> : null}<small>{t.when}</small></div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rb-note">Todavía no hay movimientos en este boleto.</p>
      )}
    </section>
  );

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    await onPhotos(files);
  };

  const fotos = (
    <section className="rb-card">
      <h3>Fotos <em>{photos.length}</em></h3>
      <div className="rb-phs">
        {photos.map((u, i) => (
          <a key={u} className="rb-ph" href={u} target="_blank" rel="noreferrer" aria-label={`Foto ${i + 1}`}>
            <img src={u} alt={`Foto ${i + 1} del equipo`} loading="lazy" />
          </a>
        ))}
        <button type="button" className="rb-ph add wsp" onClick={() => setWa((v) => !v)} aria-expanded={wa}>
          <Icon name="wa" />
          <small>WhatsApp</small>
        </button>
        <button type="button" className="rb-ph add" onClick={() => camRef.current?.click()}>
          <Icon name="cam" />
          <small>Cámara</small>
        </button>
        <button type="button" className="rb-ph add" onClick={() => fileRef.current?.click()}>
          <Icon name="img" />
          <small>Galería</small>
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      {wa ? <WhatsAppCard /> : null}
    </section>
  );

  const piezas = (
    <section className="rb-card">
      <h3>Piezas <em>{lines.length ? `${lines.length} ${lines.length === 1 ? "línea" : "líneas"}` : ""}</em><Link to={`/Orders/${order.id}`} style={{ marginLeft: "auto", font: "600 13px var(--repara-font-body)", color: "var(--rb-btx)" }}>Añadir</Link></h3>
      {lines.length ? (
        <div className="rb-pz">
          {lines.map((l) => (
            <div key={l.id}>
              <b>{l.name}</b>
              <span className="rb-money">{money(l.total)}</span>
              <span>{[l.quantity > 1 ? `${l.quantity} x ${money(l.price)}` : "", l.supplier].filter(Boolean).join(" · ") || (l.isService ? "Servicio" : "")}</span>
              <small>{l.cost !== null ? `Costo ${money(l.cost)}` : ""}</small>
            </div>
          ))}
          {profit ? (
            <div>
              <span>Costo total {money(profit.cost)}</span>
              <small className="gain">Ganancia {money(profit.gain)}</small>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rb-note">Este boleto no tiene piezas ni servicios todavía.</p>
      )}
    </section>
  );

  const cobro = (
    <section className="rb-card">
      <h3>Cobro</h3>
      <div className="rb-cb2">
        <div><span>Piezas y servicio</span><b className="rb-money">{money(money_.subtotal)}</b></div>
        {money_.tax > 0 ? <div><span>Impuesto</span><b className="rb-money">{money(money_.tax)}</b></div> : null}
        <div><span>Total</span><b className="rb-money">{money(money_.total)}</b></div>
        {money_.paid > 0 ? <div><span>Pagado</span><b className="rb-money">-{money(money_.paid)}</b></div> : null}
        <div className="tot"><span>Saldo</span><b>{money(money_.balance)}</b></div>
      </div>
    </section>
  );

  return (
    <div className={`rb-dp${wide ? " enter" : ""}`}>
      <div className="rb-dh">
        {wide ? (
          <button type="button" className="rb-ib ghost" onClick={onToggleList} aria-label="Plegar o abrir la lista"><Icon name="side" /></button>
        ) : (
          <button type="button" className="rb-ib ghost" onClick={onBack} aria-label="Volver a la lista"><Icon name="left" /></button>
        )}
        <div className="rb-dh-n">
          <b className="rb-num">{order.order_number || "Boleto"}</b>
          <span>{[deviceTitle(order), order.customer_name].filter(Boolean).join(" · ")}</span>
        </div>
        <StatusPill status={order.status} big menu onClick={() => setMenu((v) => !v)} expanded={menu} />
      </div>
      {menu ? <StatusMenu current={order.status} sheet={!wide} busy={busy} onPick={pick} onClose={() => setMenu(false)} /> : null}
      <div className="rb-scroll">
        {wide ? (
          <div className="rb-dbody c2">
            <div className="rb-dcol">{client}{fotos}{piezas}</div>
            <div className="rb-dcol">{done}{cobro}</div>
          </div>
        ) : (
          <div className="rb-dbody">{client}{done}{fotos}{piezas}{cobro}</div>
        )}
      </div>
      <div className={`rb-acts${wide ? " wide" : ""}`}>
        <Link className="rb-btn pr" to={`/Orders/${order.id}`}><Icon name="dollar" />Cobrar</Link>
        <Link className="rb-btn" to={`/Orders/${order.id}`}><Icon name="box" />Piezas</Link>
        <button type="button" className="rb-btn" onClick={() => setNoteOpen(true)}><Icon name="note" />Nota</button>
        <button type="button" className="rb-btn" onClick={() => setMsgMenu(true)}><Icon name="msg" />Mensaje</button>
      </div>
      {msgMenu ? (
        <>
          <div className="rb-scrim" onClick={() => setMsgMenu(false)} />
          <div className="rb-smn sheet" role="menu" aria-label="Enviar mensaje">
            <div className="rb-grab" style={{ alignSelf: "center" }} />
            <h6>Contactar al cliente</h6>
            <a className="rb-mi" role="menuitem" href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone}><Icon name="phone" style={{ margin: 0, color: "var(--rb-tx2)" }} />Llamar</a>
            <a className="rb-mi" role="menuitem" href={phone ? `sms:${phone}` : undefined} aria-disabled={!phone}><Icon name="msg" style={{ margin: 0, color: "var(--rb-tx2)" }} />Mensaje de texto</a>
            <a className="rb-mi" role="menuitem" href={phone ? `https://wa.me/${phone.replace(/^\+/, "").length === 10 ? `1${phone.replace(/^\+/, "")}` : phone.replace(/^\+/, "")}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!phone}><Icon name="wa" style={{ margin: 0, color: "var(--rb-tx2)" }} />Abrir WhatsApp</a>
            <a className="rb-mi" role="menuitem" href={order.customer_email ? `mailto:${order.customer_email}` : undefined} aria-disabled={!order.customer_email}><Icon name="note" style={{ margin: 0, color: "var(--rb-tx2)" }} />Correo</a>
          </div>
        </>
      ) : null}
      {noteOpen ? (
        <div className="rb-modal" onClick={() => setNoteOpen(false)}>
          <div className="rb-modal-c" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Nota interna">
            <h3>Nota interna</h3>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe lo que hay que recordar de este boleto" autoFocus />
            <div className="row">
              <button type="button" className="rb-btn" onClick={() => setNoteOpen(false)}>Cancelar</button>
              <button type="button" className="rb-btn pr" disabled={saving || !note.trim()} onClick={saveNote}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
