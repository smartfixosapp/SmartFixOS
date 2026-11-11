import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { StatusPill } from "./StatusPill";
import { EQUIPMENT } from "../domain/equipment";
import {
  activeChips, applyFilters, clearAll, equipmentCounts, FILTER_PANEL_STATUS_GROUPS, groupByStatus, removeChip,
  statusCounts, toggleIn, toggleVista, vistaCounts, VISTAS,
} from "../domain/filters";
import { money, sortByUpdated, summarize, toCard } from "../domain/cards";
import { STATUSES, statusColorVar } from "../domain/statuses";
import type { CardView } from "../domain/cards";
import type { EquipmentId, FilterState, OrderRow } from "../domain/types";

const FLAG_COLOR: Record<string, string> = { alert: "var(--repara-danger)", drop: "var(--repara-info)", shield: "var(--repara-vip)", bolt: "var(--repara-warning)" };

function TicketCard({ card, selected, onOpen }: { card: CardView; selected: boolean; onOpen: () => void }) {
  return (
    <button type="button" className={`rb-tk${selected ? " sel" : ""}`} style={{ ["--c" as string]: statusColorVar(card.status) }} onClick={onOpen} aria-label={`${card.number} ${card.title}`}>
      <div className="rb-tk-a">
        <Icon name={card.icon} />
        <b className="rb-num">{card.number}</b>
        <span className="rb-sp" />
        <span className={card.late ? "late" : undefined}>{card.late ? `Atrasado · ${card.age}` : card.age}</span>
      </div>
      <div className="rb-tk-b">
        <span>{card.title}</span>
        <span className="rb-sp" />
        {card.amount ? <span className="rb-money">{card.amount}</span> : null}
      </div>
      <span className="rb-tk-c">{card.customer}</span>
      <span className="rb-tk-d">{card.problem}</span>
      <div className="rb-tk-e">
        <StatusPill status={card.status} />
        {card.flags.map((f) => (
          <span key={f} className="rb-fg" style={{ ["--k" as string]: FLAG_COLOR[f] }}>
            <Icon name={f} />
          </span>
        ))}
        <span className="rb-sp" />
        {card.tech ? <span className="rb-tav">{card.tech}</span> : <span className="rb-tav no"><Icon name="user" /></span>}
      </div>
    </button>
  );
}

type PanelKind = "statuses" | "equipos";

interface PanelProps {
  kind: PanelKind;
  orders: readonly OrderRow[];
  filters: FilterState;
  sheet: boolean;
  onApply: (next: FilterState) => void;
  onClose: () => void;
}

function FilterPanel({ kind, orders, filters, sheet, onApply, onClose }: PanelProps) {
  const [draft, setDraft] = useState<string[]>(kind === "statuses" ? filters.statuses : filters.equipos);
  const next: FilterState = kind === "statuses" ? { ...filters, statuses: draft } : { ...filters, equipos: draft as EquipmentId[] };
  const sCounts = useMemo(() => statusCounts(orders, filters), [orders, filters]);
  const eCounts = useMemo(() => equipmentCounts(orders, filters), [orders, filters]);
  const resultCount = useMemo(() => applyFilters(orders, next).length, [orders, next]);
  const row = (key: string, label: string, count: number, extra: React.ReactNode, color?: string) => (
    <button key={key} type="button" className={`rb-ck${draft.includes(key) ? " on" : ""}`} style={color ? { ["--c" as string]: color } : undefined} onClick={() => setDraft((d) => toggleIn(d, key))} aria-pressed={draft.includes(key)}>
      <i><Icon name="check" /></i>
      {extra}
      {label}
      <em>{count}</em>
    </button>
  );
  return (
    <>
      {sheet ? <div className="rb-scrim" onClick={onClose} /> : <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={onClose} />}
      <div className={`rb-fp ${sheet ? "sheet" : "pop"}`} role="dialog" aria-label={kind === "statuses" ? "Estatus" : "Equipos"}>
        {sheet ? <div className="rb-grab" /> : null}
        <div className="rb-fp-h">
          <b>{kind === "statuses" ? "Estatus" : "Equipos"}</b>
          <span>Selección múltiple · {draft.length} marcados</span>
        </div>
        <div className="rb-fp-b">
          {kind === "statuses"
            ? FILTER_PANEL_STATUS_GROUPS.map((g) => (
                <div key={g.id}>
                  <div className="rb-fp-g">{g.title}</div>
                  {STATUSES.filter((s) => s.group === g.id).map((s) => row(s.key, s.label, sCounts[s.key] ?? 0, <u />, statusColorVar(s.key)))}
                </div>
              ))
            : EQUIPMENT.map((e) => row(e.id, e.label, eCounts[e.id] ?? 0, <Icon name={e.icon} />))}
        </div>
        <div className="rb-fp-f">
          <button type="button" className="rb-btn gh" onClick={() => { onApply(kind === "statuses" ? { ...filters, statuses: [] } : { ...filters, equipos: [] }); onClose(); }}>Limpiar</button>
          <button type="button" className="rb-btn pr" onClick={() => { onApply(next); onClose(); }}>Aplicar · {resultCount} boletos</button>
        </div>
      </div>
    </>
  );
}

interface Props {
  orders: OrderRow[];
  visible: OrderRow[];
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  selectedId: string | null;
  stacked: boolean;
  loading: boolean;
  error: string;
  closedFull: boolean;
  onLoadMoreClosed: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function ListPane({ orders, visible, filters, setFilters, selectedId, stacked, loading, error, closedFull, onLoadMoreClosed, onOpen, onNew }: Props) {
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const vc = useMemo(() => vistaCounts(orders, filters.query), [orders, filters.query]);
  const chips = useMemo(() => activeChips(filters), [filters]);
  const groups = useMemo(() => groupByStatus(sortByUpdated(visible)), [visible]);
  const sum = useMemo(() => summarize(filters.vista === "cerradas" ? [] : visible), [visible, filters.vista]);
  const now = Date.now();
  const sub = filters.vista === "cerradas"
    ? `${visible.length} cerrados`
    : `${sum.active} ${sum.active === 1 ? "activo" : "activos"}`;
  const bubble = (n: number, grey: boolean) => (n > 0 ? <b className={`rb-bub${grey ? " q" : ""}`}>{n}</b> : null);
  const filterBtn = (kind: PanelKind, icon: string, label: string, n: number) => (
    <button type="button" className={`rb-fi${n ? " on" : ""}`} onClick={() => setPanel(panel === kind ? null : kind)} aria-label={label} aria-expanded={panel === kind}>
      <span><Icon name={icon} />{bubble(n, false)}</span>
      {label}
    </button>
  );
  const vistaBtn = (id: (typeof VISTAS)[number]["id"]) => {
    const v = VISTAS.find((x) => x.id === id)!;
    const on = filters.vista === id;
    return (
      <button key={id} type="button" className={`rb-fi vw${on ? " on" : ""}`} onClick={() => setFilters(toggleVista(filters, id))} aria-pressed={on} aria-label={v.label}>
        <span><Icon name={v.icon} />{id === "cerradas" ? null : bubble(vc[id], true)}</span>
        {stacked ? v.shortLabel : v.label}
      </button>
    );
  };
  return (
    <div className="rb-list">
      <div className={`rb-lh${stacked ? " stk" : ""}`}>
        <div className="rb-lh-t">
          <div>
            <h1>Boletos</h1>
            <p>
              {sub}
              {sum.late > 0 && filters.vista !== "cerradas" ? <> · <em>{sum.late} {sum.late === 1 ? "atrasado" : "atrasados"}</em></> : null}
              {sum.toCollect > 0 && filters.vista !== "cerradas" ? <> · por cobrar {money(sum.toCollect)}</> : null}
            </p>
          </div>
          <span className="rb-sp" />
          {stacked ? (
            <button type="button" className="rb-ib br" onClick={onNew} aria-label="Nuevo boleto"><Icon name="plus" /></button>
          ) : (
            <button type="button" className="rb-btn pr" onClick={onNew}><Icon name="plus" />Nuevo boleto</button>
          )}
        </div>
        <div className="rb-lh-r">
          <label className="rb-search">
            <Icon name="search" />
            <input value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} placeholder="Buscar cliente, equipo, teléfono o número" aria-label="Buscar boletos" />
          </label>
          <div className="rb-fis">
            {filterBtn("statuses", "status", "Estatus", filters.statuses.length)}
            {filterBtn("equipos", "devices", "Equipos", filters.equipos.length)}
            <u />
            {VISTAS.map((v) => vistaBtn(v.id))}
          </div>
        </div>
        {chips.length ? (
          <div className="rb-aps">
            {chips.map((c) => (
              <span key={`${c.kind}-${c.key}`} className="rb-chp">
                {c.label}
                <button type="button" aria-label={`Quitar ${c.label}`} onClick={() => setFilters(removeChip(filters, c))}><Icon name="x" /></button>
              </span>
            ))}
            <button type="button" className="rb-chp cl" onClick={() => setFilters(clearAll(filters))}>Limpiar todo</button>
          </div>
        ) : null}
        {panel ? (
          <FilterPanel key={panel} kind={panel} orders={orders} filters={filters} sheet={stacked} onApply={setFilters} onClose={() => setPanel(null)} />
        ) : null}
      </div>
      <div className="rb-scroll">
        <div className={`rb-grid${stacked ? " one" : ""}`}>
          {loading ? <div className="rb-empty">Cargando boletos...</div> : null}
          {error && !orders.length ? <div className="rb-empty">{error}</div> : null}
          {!loading && !error && !groups.length ? <div className="rb-empty">No hay boletos con estos filtros.</div> : null}
          {groups.map((g) => (
            <GroupBlock key={g.status} status={g.status} label={g.label} orders={g.orders} selectedId={selectedId} onOpen={onOpen} now={now} />
          ))}
          {filters.vista === "cerradas" && !closedFull ? (
            <div className="rb-more"><button type="button" className="rb-btn sm" onClick={onLoadMoreClosed}>Cargar más</button></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GroupBlock({ status, label, orders, selectedId, onOpen, now }: { status: string; label: string; orders: OrderRow[]; selectedId: string | null; onOpen: (id: string) => void; now: number }) {
  return (
    <>
      <div className="rb-shd" style={{ ["--c" as string]: statusColorVar(status) }}>
        <i />
        {label} <em>{orders.length}</em>
      </div>
      {orders.map((o) => (
        <TicketCard key={o.id} card={toCard(o, now)} selected={o.id === selectedId} onOpen={() => onOpen(o.id)} />
      ))}
    </>
  );
}
