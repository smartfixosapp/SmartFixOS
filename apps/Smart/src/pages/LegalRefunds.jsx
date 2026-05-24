import React from "react";
import LegalLayout from "@/components/LegalLayout";

/**
 * /legal/refunds · Política de Reembolsos
 *
 * Política simple: no refunds prorrateados, cancela cuando quieras, mantienes
 * acceso hasta fin del período pagado. Excepciones: cargos duplicados, errores
 * técnicos por nuestra parte, ventana de 14 días después del primer pago para
 * cancelar y obtener reembolso completo del PRIMER MES (cubre cambios de
 * opinión post-trial).
 *
 * Stripe exige una política de refunds visible y accesible cuando salgas
 * de TEST mode a LIVE.
 */
export default function LegalRefunds() {
  return (
    <LegalLayout title="Política de Reembolsos" eyebrow="Legal" lastUpdated="23 mayo 2026">
      <p>
        Queremos que estés contento con SmartFixOS. Esta política explica cómo
        manejamos cancelaciones y reembolsos de manera <strong>simple, honesta y
        rápida</strong>.
      </p>

      <h2>Lo que necesitas saber en 60 segundos</h2>
      <ul>
        <li>
          <strong>Trial gratis de 14 días</strong> — sin tarjeta requerida. Si no te
          gusta, no pagas nada, no haces nada.
        </li>
        <li>
          <strong>Cancela cuando quieras</strong> — desde www.smartfixos.com o
          escribiéndonos. La cancelación es efectiva al final del período pagado;
          mantienes acceso hasta esa fecha.
        </li>
        <li>
          <strong>No emitimos reembolsos prorrateados</strong> por meses parcialmente
          usados. Si cancelas a mitad de mes, sigues usando el Servicio hasta que se
          acabe el período.
        </li>
        <li>
          <strong>Ventana de 14 días en el primer mes pagado</strong> — si después
          del trial te suscribiste y cambias de opinión dentro de los primeros 14 días,
          reembolsamos completo. Una sola vez por cuenta.
        </li>
      </ul>

      <h2>1. Trial gratis</h2>
      <p>
        Los primeros <strong>14 días</strong> de cualquier plan son completamente gratis.
        No solicitamos tarjeta de crédito para iniciar el trial. Si no activas un plan
        pagado al finalizar el trial, tu cuenta queda inactiva pero tu data permanece
        almacenada por 90 días para que puedas reactivar.
      </p>

      <h2>2. Cancelación regular</h2>
      <p>
        Puedes cancelar tu suscripción en cualquier momento:
      </p>
      <ul>
        <li>
          Desde la app SmartFixOS → Ajustes → Suscripción → "Manejar suscripción" →
          Cancelar (te lleva al portal de Stripe)
        </li>
        <li>
          Directo en <a href="https://www.smartfixos.com/dashboard/billing">www.smartfixos.com/dashboard/billing</a>
        </li>
        <li>
          Escribiendo a <a href="mailto:archillastudios@gmail.com">archillastudios@gmail.com</a> y respondemos en 24h hábiles.
        </li>
      </ul>
      <p>
        La cancelación es <strong>efectiva al final del período de facturación
        actual</strong>. No emitimos reembolso prorrateado por días no usados — esto
        nos permite mantener precios bajos para todos.
      </p>

      <h2>3. Garantía de satisfacción (14 días post-trial)</h2>
      <p>
        Reconocemos que el trial de 14 días puede no ser suficiente para evaluar el
        Servicio en todos los casos. Por eso, si después de activar tu plan pagado
        cambias de opinión dentro de los <strong>primeros 14 días</strong> del primer
        cobro, te reembolsamos el monto completo del primer mes.
      </p>
      <p>
        Condiciones:
      </p>
      <ul>
        <li>Aplica solo al <strong>primer cobro</strong> de la cuenta.</li>
        <li>
          Solicítalo por email a <a href="mailto:archillastudios@gmail.com">archillastudios@gmail.com</a>{" "}
          con asunto <em>"Reembolso primer mes"</em> dentro de los primeros 14 días del cargo.
        </li>
        <li>Procesamos en 5-7 días hábiles vía la tarjeta original.</li>
        <li>La cuenta queda cancelada al recibir el reembolso.</li>
      </ul>

      <h2>4. Casos especiales (siempre reembolsamos)</h2>
      <p>
        Independientemente de las reglas anteriores, <strong>siempre</strong> reembolsamos
        en los siguientes casos:
      </p>
      <ul>
        <li>
          <strong>Cargos duplicados</strong> — si Stripe te cobró dos veces el mismo mes
          por error técnico, devolvemos el duplicado de inmediato (1-3 días hábiles).
        </li>
        <li>
          <strong>Fraude de tarjeta</strong> — si tu tarjeta fue usada sin tu autorización
          para suscribirte a SmartFixOS, cancelamos y reembolsamos. Reporta también
          a tu banco.
        </li>
        <li>
          <strong>Falla técnica continuada por nuestra parte</strong> — si el Servicio
          sufre interrupciones documentadas que impiden su uso normal por más de 72
          horas continuas dentro de un mes pagado, reembolsamos el mes completo.
        </li>
      </ul>

      <h2>5. Lo que NO reembolsamos</h2>
      <ul>
        <li>Meses parcialmente usados (después del período de garantía de 14 días).</li>
        <li>Cargos correctamente facturados según el plan que tenías activo.</li>
        <li>
          Cargos por suscripciones que olvidaste cancelar — te recomendamos
          configurar recordatorios. Te mandamos email recordatorio antes de cada
          renovación.
        </li>
        <li>
          Costos asociados a integraciones externas (Twilio, WhatsApp Business,
          servicios de SMS, etc.) — esos los cobran las plataformas respectivas,
          no nosotros.
        </li>
      </ul>

      <h2>6. Disputas vía banco / chargebacks</h2>
      <p>
        Si tienes una disputa, <strong>contáctanos primero</strong>. Resolvemos casi
        cualquier cosa en menos de 48 horas hábiles. Iniciar un chargeback con tu
        banco sin habernos contactado puede resultar en suspensión inmediata de la
        cuenta y bloqueo para futuros pedidos.
      </p>

      <h2>7. Tiempo de respuesta</h2>
      <ul>
        <li><strong>Confirmación de solicitud:</strong> menos de 24 horas hábiles.</li>
        <li><strong>Procesamiento del reembolso:</strong> 5-7 días hábiles vía Stripe.</li>
        <li><strong>Reflejo en tu estado de cuenta:</strong> 3-10 días según tu banco.</li>
      </ul>

      <h2>8. Cómo solicitar un reembolso</h2>
      <p>
        Envía un email a <a href="mailto:archillastudios@gmail.com">archillastudios@gmail.com</a> con:
      </p>
      <ul>
        <li>Asunto: "Solicitud de reembolso"</li>
        <li>Email asociado a tu cuenta SmartFixOS</li>
        <li>Nombre de tu taller</li>
        <li>Motivo del reembolso (breve, una línea está bien)</li>
        <li>Fecha aproximada del cargo si aplica</li>
      </ul>
      <p>
        Te confirmamos en menos de 24h hábiles si procede.
      </p>

      <h2>9. Contacto</h2>
      <p>
        Para cualquier pregunta sobre esta política o un caso específico:
        <br />
        <strong>Email:</strong> <a href="mailto:archillastudios@gmail.com">archillastudios@gmail.com</a>
      </p>
    </LegalLayout>
  );
}
