import { Icon } from "./Icon";
import { WHATSAPP_DISCONNECTED } from "../domain/newTicket";

export function WhatsAppCard() {
  const s = WHATSAPP_DISCONNECTED;
  return (
    <div className="rb-wa" role="status">
      <div className="rb-wa-h">
        <i><Icon name="wa" /></i>
        <div>
          <b>WhatsApp</b>
          <span>{s.label}</span>
        </div>
        <span className="rb-switch" role="switch" aria-checked="false" aria-disabled="true" aria-label="WhatsApp apagado" />
      </div>
      <div className="rb-wa-e">
        <i><Icon name="alert" /></i>
        <b>{s.title}</b>
        <p>{s.detail}</p>
      </div>
    </div>
  );
}
