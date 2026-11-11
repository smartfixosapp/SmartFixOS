import { Icon } from "./Icon";
import { menuSections } from "../domain/transitions";
import { statusColorVar } from "../domain/statuses";

interface Props {
  current: string | null | undefined;
  sheet: boolean;
  busy: boolean;
  onPick: (key: string) => void;
  onClose: () => void;
}

export function StatusMenu({ current, sheet, busy, onPick, onClose }: Props) {
  const sections = menuSections(current);
  return (
    <>
      {sheet ? <div className="rb-scrim" onClick={onClose} /> : <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={onClose} />}
      <div className={`rb-smn ${sheet ? "sheet" : "pop"}`} role="menu" aria-label="Cambiar estatus">
        {sheet ? <div className="rb-grab" style={{ alignSelf: "center" }} /> : null}
        <div className="rb-smn-g">
          {sections.filter((s) => s.id !== "closed" && s.id !== "reopen").map((s) => (
            <div key={s.id}>
              <h6>{s.title}</h6>
              {s.items.map((it) => (
                <button key={it.key} type="button" role="menuitem" className="rb-mi" style={{ ["--c" as string]: statusColorVar(it.key) }} disabled={busy} onClick={() => onPick(it.key)}>
                  <u />
                  {it.label}
                </button>
              ))}
            </div>
          ))}
          {sections.filter((s) => s.id === "closed" || s.id === "reopen").map((s) => (
            <div key={s.id} className="cl">
              <h6>{s.title}</h6>
              {s.note ? <p>{s.note}</p> : null}
              <div>
                {s.items.map((it) => (
                  <button key={it.key} type="button" role="menuitem" className="rb-mi" style={{ ["--c" as string]: statusColorVar(it.key) }} disabled={busy} onClick={() => onPick(it.key)}>
                    <u />
                    {it.label}
                    {it.key === current ? <Icon name="check" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
