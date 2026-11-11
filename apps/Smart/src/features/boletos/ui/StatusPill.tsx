import { Icon } from "./Icon";
import { statusColorVar, statusLabel } from "../domain/statuses";

interface Props {
  status: string | null | undefined;
  big?: boolean;
  menu?: boolean;
  onClick?: () => void;
  expanded?: boolean;
}

export function StatusPill({ status, big, menu, onClick, expanded }: Props) {
  const style = { ["--c" as string]: statusColorVar(status) };
  const body = (
    <>
      <i />
      <span>{statusLabel(status)}</span>
      {menu ? <Icon name="down" /> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`rb-pill${big ? " big" : ""}`} style={style} onClick={onClick} aria-haspopup="menu" aria-expanded={!!expanded}>
        {body}
      </button>
    );
  }
  return (
    <span className={`rb-pill${big ? " big" : ""}`} style={style}>
      {body}
    </span>
  );
}
