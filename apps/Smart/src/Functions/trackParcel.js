// trackParcel.js — Tracking en tiempo real via TrackingMore API v4
// Docs: https://www.trackingmore.com/docs/trackingmore/overview

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json"
};

const BASE_URL = "https://api.trackingmore.com/v4";

// Carrier nombre → código TrackingMore
const CARRIER_CODES = {
  "UPS":    "ups",
  "FedEx":  "fedex",
  "USPS":   "usps",
  "DHL":    "dhl",
  "Amazon": "amazon",
};

// Estado TrackingMore → texto legible en español
const STATUS_LABELS = {
  notfound:    "Sin información aún",
  transit:     "En tránsito",
  pickup:      "Listo para recoger",
  undelivered: "Intento de entrega fallido",
  delivered:   "Entregado",
  expired:     "Tracking expirado",
  pending:     "Pendiente de actualización",
};

export async function trackParcelHandler(req) {
  try {
    const body = await req.json();
    const { trackingNumber, carrier } = body;

    if (!trackingNumber) {
      return new Response(JSON.stringify({ error: "trackingNumber requerido" }), { status: 400, headers: CORS_HEADERS });
    }

    const apiKey = Deno.env.get("TRACKINGMORE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TRACKINGMORE_API_KEY no configurado" }), { status: 500, headers: CORS_HEADERS });
    }

    const headers = {
      "Content-Type": "application/json",
      "Tracking-Api-Key": apiKey
    };

    const carrierCode = CARRIER_CODES[carrier] || null;

    // Paso 1: Intentar crear el tracking (idempotente si ya existe)
    const createBody = { tracking_number: trackingNumber };
    if (carrierCode) createBody.carrier_code = carrierCode;

    await fetch(`${BASE_URL}/trackings`, {
      method: "POST",
      headers,
      body: JSON.stringify(createBody)
    });

    // Paso 2: Obtener datos actuales (siempre usar query params — el endpoint por path falla si el tracking no estaba pre-registrado)
    const getUrl = `${BASE_URL}/trackings?tracking_numbers=${encodeURIComponent(trackingNumber)}&limit=1`;

    const res  = await fetch(getUrl, { headers });
    const data = await res.json();

    if (!res.ok || (data.meta && data.meta.code !== 200)) {
      return new Response(
        JSON.stringify({ error: "Error de API TrackingMore", detail: data?.meta?.message || data }),
        { status: 502, headers: CORS_HEADERS }
      );
    }

    // Normalizar: puede ser objeto directo o array según endpoint usado
    const raw = Array.isArray(data.data) ? data.data[0] : data.data;

    if (!raw) {
      return new Response(
        JSON.stringify({ error: "Tracking no encontrado o aún sin datos. Intenta en unos minutos." }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Extraer eventos del tracking
    const allEvents = [];
    try {
      const providers = raw.tracking?.providers_hash || [];
      for (const provider of providers) {
        for (const ev of (provider.events || [])) {
          allEvents.push({
            date:     ev.time_utc || ev.time_iso || "",
            location: ev.location || "",
            status:   ev.description || ev.status || "",
          });
        }
      }
    } catch { /* sin eventos */ }

    // Si no hay eventos del proveedor, usar origin_info / destination_info
    if (allEvents.length === 0) {
      try {
        const originTrack = raw.origin_info?.trackinfo || [];
        for (const ev of originTrack) {
          allEvents.push({
            date:     ev.Date || "",
            location: ev.Details || "",
            status:   ev.StatusDescription || "",
          });
        }
      } catch { /* silent */ }
    }

    // Ordenar: más reciente primero
    allEvents.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date) - new Date(a.date);
    });

    const statusKey    = raw.status || "notfound";
    const currentStage = STATUS_LABELS[statusKey] || statusKey;
    const latestInfo   = raw.latest_event_info || {};
    const timeMetrics  = raw.time_metrics || {};

    // ETA: puede estar en different campos según carrier
    const etaFrom = timeMetrics?.estimated_delivery_date?.from || raw.expected_delivery || "";
    const etaTo   = timeMetrics?.estimated_delivery_date?.to   || "";
    const eta     = etaFrom ? (etaTo && etaTo !== etaFrom ? `${etaFrom} – ${etaTo}` : etaFrom) : "";

    // Primer evento = fecha de salida
    const firstEvent = allEvents[allEvents.length - 1] || {};

    const result = {
      trackingNumber,
      carrier:           raw.carrier_code || carrier || "",
      currentStage,
      currentLocation:   latestInfo.location || allEvents[0]?.location || "",
      lastUpdate:        latestInfo.time_utc  || allEvents[0]?.date     || "",
      eta,
      departureDate:     firstEvent.date     || raw.origin_info?.ItemReceived || "",
      departureLocation: firstEvent.location || "",
      delivered:         statusKey === "delivered",
      events:            allEvents.slice(0, 15),
    };

    return new Response(JSON.stringify(result), { status: 200, headers: CORS_HEADERS });

  } catch (err) {
    console.error("[trackParcel] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
}
