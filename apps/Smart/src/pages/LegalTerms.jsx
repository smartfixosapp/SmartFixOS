import React from "react";
import LegalLayout from "@/components/LegalLayout";

/**
 * /legal/terms · Términos y Condiciones
 *
 * Draft estándar para SaaS B2B operando desde Puerto Rico (US territory).
 * Cubre: acceso, suscripción, contenido del cliente, propiedad intelectual,
 * prohibiciones, limitación de responsabilidad, cancelación, modificaciones,
 * ley aplicable, contacto.
 *
 * NO es un documento legal certificado por abogado — es base sensata para
 * lanzar. Antes de App Store público, idealmente revisado por abogado PR.
 */
export default function LegalTerms() {
  return (
    <LegalLayout title="Términos y Condiciones" eyebrow="Legal" lastUpdated="23 mayo 2026">
      <p>
        Bienvenido a SmartFixOS. Estos Términos y Condiciones ("Términos") rigen el uso
        de la aplicación SmartFixOS, los sitios web smartfixos.com y www.smartfixos.com,
        y cualquier servicio relacionado ("Servicio") operados por <strong>Archilla Studios</strong>{" "}
        (en adelante "nosotros", "nuestro" o "SmartFixOS").
      </p>
      <p>
        Al crear una cuenta, instalar la aplicación o usar cualquier parte del Servicio,
        aceptas estos Términos. <strong>Si no estás de acuerdo, no uses el Servicio.</strong>
      </p>

      <h2>1. Descripción del Servicio</h2>
      <p>
        SmartFixOS es un sistema operativo para talleres de reparación: gestión de
        órdenes de trabajo, punto de venta, inventario, finanzas, clientes y empleados,
        accesible desde dispositivos iOS y Android.
      </p>

      <h2>2. Cuenta del Cliente</h2>
      <ul>
        <li>Debes tener al menos 18 años para crear una cuenta.</li>
        <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
        <li>Eres responsable de toda actividad que ocurra bajo tu cuenta.</li>
        <li>Te comprometes a proporcionar información veraz, exacta y actualizada al registrarte.</li>
        <li>Una cuenta corresponde a un (1) taller. Para múltiples sucursales, contáctanos.</li>
      </ul>

      <h2>3. Planes y Suscripción</h2>
      <p>
        SmartFixOS ofrece los siguientes planes de suscripción mensual:
      </p>
      <ul>
        <li><strong>Plan Solo</strong> — $19 USD/mes. Para el técnico independiente.</li>
        <li><strong>Plan Equipo</strong> — $49 USD/mes. Hasta 5 empleados, multi-device, chat interno.</li>
      </ul>
      <p>
        Toda suscripción incluye un período de prueba de <strong>14 días sin tarjeta de crédito</strong>.
        Al finalizar el trial, si no activas un plan pagado, la cuenta queda inactiva
        pero la data permanece almacenada por 90 días.
      </p>
      <p>
        Los pagos se procesan a través de <strong>Stripe, Inc.</strong> Aceptamos las tarjetas
        de crédito y débito compatibles con Stripe. La facturación es <strong>mensual y se renueva
        automáticamente</strong> hasta que canceles.
      </p>

      <h2>4. Cancelación</h2>
      <p>
        Puedes cancelar tu suscripción en cualquier momento desde
        www.smartfixos.com (sección "Manejar Suscripción") o escribiendo a
        archillastudios@gmail.com.
      </p>
      <ul>
        <li>
          <strong>La cancelación es efectiva al final del período pagado.</strong> Mantienes
          acceso completo hasta esa fecha.
        </li>
        <li>No emitimos reembolsos prorrateados por períodos parcialmente usados.</li>
        <li>Para nuestra política completa de reembolsos, ver <a href="/legal/refunds">/legal/refunds</a>.</li>
      </ul>

      <h2>5. Contenido del Cliente</h2>
      <p>
        Tú conservas la propiedad de toda la data que introduces en SmartFixOS:
        clientes, órdenes, productos, fotos, facturas, configuraciones, etc.
        ("Contenido del Cliente").
      </p>
      <p>
        Al usar el Servicio, nos otorgas una licencia limitada para procesar,
        almacenar y mostrar el Contenido del Cliente <strong>únicamente</strong> con el
        propósito de operar el Servicio para ti.
      </p>
      <p>
        Puedes exportar todo tu Contenido del Cliente en cualquier momento a Excel o
        PDF directamente desde la app. Si cancelas tu cuenta, conservamos tu data
        por 90 días para que puedas exportarla, después es eliminada permanentemente.
      </p>

      <h2>6. Propiedad Intelectual</h2>
      <p>
        El software SmartFixOS, su código, diseño, marca, logos, y toda propiedad
        intelectual relacionada son propiedad exclusiva de Archilla Studios. Te
        otorgamos una licencia limitada, no exclusiva e intransferible para usar el
        Servicio según estos Términos.
      </p>
      <p>
        <strong>Está prohibido:</strong>
      </p>
      <ul>
        <li>Copiar, modificar, redistribuir o crear obras derivadas del software.</li>
        <li>Realizar ingeniería inversa o intentar acceder al código fuente.</li>
        <li>Revender, sublicenciar o transferir tu cuenta a un tercero sin autorización.</li>
        <li>Usar el Servicio para actividades ilegales, fraudulentas o que dañen a terceros.</li>
        <li>Intentar evadir limitaciones técnicas del Servicio (ej. limites del plan).</li>
      </ul>

      <h2>7. Limitación de Responsabilidad</h2>
      <p>
        El Servicio se ofrece <strong>"tal como está"</strong> y "según disponibilidad",
        sin garantías expresas o implícitas. SmartFixOS hace esfuerzos razonables para
        mantener el Servicio operativo y los datos seguros, pero no garantizamos:
      </p>
      <ul>
        <li>Disponibilidad ininterrumpida del Servicio.</li>
        <li>Que el Servicio cumplirá con requisitos específicos de tu negocio.</li>
        <li>Que estará libre de errores o vulnerabilidades.</li>
      </ul>
      <p>
        <strong>En ningún caso</strong> Archilla Studios será responsable por daños
        indirectos, incidentales, especiales, consecuentes o punitivos, incluyendo
        pero no limitándose a pérdida de ganancias, ingresos, data, o uso. Nuestra
        responsabilidad total agregada, bajo cualquier teoría legal, no excederá el
        monto que pagaste por el Servicio durante los <strong>12 meses anteriores</strong> al
        evento que dé lugar al reclamo.
      </p>

      <h2>8. Indemnización</h2>
      <p>
        Te comprometes a indemnizar y mantener libre de responsabilidad a Archilla
        Studios frente a cualquier reclamo, daño o gasto derivado de: (a) tu violación
        de estos Términos, (b) tu uso indebido del Servicio, o (c) tu violación de
        derechos de terceros.
      </p>

      <h2>9. Terminación por nuestra parte</h2>
      <p>
        Podemos suspender o terminar tu cuenta inmediatamente, sin previo aviso ni
        reembolso, si:
      </p>
      <ul>
        <li>Violas estos Términos.</li>
        <li>Tu pago falla y no es corregido en 7 días después de notificación.</li>
        <li>Usamos el Servicio detectamos fraude, abuso, o actividad ilegal.</li>
      </ul>

      <h2>10. Modificaciones a estos Términos</h2>
      <p>
        Podemos modificar estos Términos. Si los cambios son materiales, te
        notificaremos por email al menos 30 días antes de que entren en vigor. El
        uso continuado del Servicio después de los cambios constituye aceptación.
      </p>

      <h2>11. Ley Aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes del <strong>Estado Libre Asociado de
        Puerto Rico</strong>, sin considerar conflictos de ley. Cualquier disputa será
        resuelta exclusivamente en los tribunales competentes de San Juan, Puerto Rico.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Si tienes preguntas sobre estos Términos, escríbenos:
      </p>
      <ul>
        <li><strong>Email:</strong> <a href="mailto:archillastudios@gmail.com">archillastudios@gmail.com</a></li>
        <li><strong>Operador:</strong> Archilla Studios, San Juan, Puerto Rico</li>
      </ul>
    </LegalLayout>
  );
}
