import * as x509 from "npm:@peculiar/x509@1.12.3";

x509.cryptoProvider.set(crypto as unknown as Crypto);

const APPLE_ROOT_G3_B64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

const SOLO = "com.archillastudios.SmartFixOS.solo.monthly1";
const TEAM = "com.archillastudios.SmartFixOS.team.monthly";

const EXPIRE_TYPES = ["EXPIRED", "GRACE_PERIOD_EXPIRED", "REVOKE", "REFUND"];
const ACTIVE_TYPES = ["SUBSCRIBED", "DID_RENEW", "OFFER_REDEEMED", "DID_CHANGE_RENEWAL_PREF", "RENEWAL_EXTENDED"];

function b64urlToBytes(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function decodeSeg(seg: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg)));
}

async function verifyAppleJWS(jws: string): Promise<Record<string, unknown>> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("malformed jws");
  const header = decodeSeg(parts[0]) as { x5c?: string[] };
  const x5c = header.x5c;
  if (!x5c || x5c.length < 2) throw new Error("missing x5c chain");

  const certs = x5c.map((b64) => new x509.X509Certificate(b64));
  const appleRoot = new x509.X509Certificate(APPLE_ROOT_G3_B64);

  for (let i = 0; i < certs.length - 1; i++) {
    const ok = await certs[i].verify({ publicKey: certs[i + 1].publicKey, signatureOnly: true });
    if (!ok) throw new Error("invalid chain link " + i);
  }
  const last = certs[certs.length - 1];
  if (abToB64(last.rawData) !== APPLE_ROOT_G3_B64) {
    const ok = await last.verify({ publicKey: appleRoot.publicKey, signatureOnly: true });
    if (!ok) throw new Error("chain not rooted at Apple Root CA G3");
  }

  const leafKey = await certs[0].publicKey.export(crypto as unknown as Crypto);
  const signingInput = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const sig = b64urlToBytes(parts[2]);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    leafKey,
    sig,
    signingInput,
  );
  if (!valid) throw new Error("signature verification failed");

  return decodeSeg(parts[1]);
}

function planFor(productId: unknown): string | null {
  if (productId === SOLO) return "solo";
  if (productId === TEAM) return "team";
  return null;
}

async function patchTenant(id: string, updates: Record<string, unknown>): Promise<void> {
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${base}/rest/v1/tenant?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error("tenant update failed: " + (await r.text()));
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  try {
    const body = await req.json().catch(() => ({}));
    const signedPayload = body.signedPayload;
    if (!signedPayload) return json({ error: "missing signedPayload" }, 400);

    const note = await verifyAppleJWS(signedPayload);
    const type = String(note.notificationType ?? "");
    const subtype = String(note.subtype ?? "");

    if (type === "TEST") return json({ ok: true, test: true });

    const data = (note.data ?? {}) as Record<string, unknown>;
    const txInfo = data.signedTransactionInfo as string | undefined;
    if (!txInfo) return json({ ok: true, ignored: type });

    const tx = await verifyAppleJWS(txInfo);
    const tenantId = tx.appAccountToken as string | undefined;
    const plan = planFor(tx.productId);
    if (!tenantId || !plan) return json({ ok: true, ignored: "no-tenant-or-product" });

    const expiresMs = Number(tx.expiresDate ?? 0);
    const activeByDate = expiresMs ? expiresMs > Date.now() : true;

    let active = activeByDate;
    let status = "active";

    if (EXPIRE_TYPES.includes(type)) {
      active = false;
      status = "expired";
    } else if (ACTIVE_TYPES.includes(type)) {
      active = true;
      status = "active";
    } else if (type === "DID_FAIL_TO_RENEW") {
      if (subtype === "GRACE_PERIOD") {
        active = true;
        status = "past_due";
      } else {
        active = activeByDate;
        status = activeByDate ? "active" : "expired";
      }
    } else if (type === "DID_CHANGE_RENEWAL_STATUS") {
      active = activeByDate;
      status = "active";
    }

    await patchTenant(tenantId, {
      plan: active ? plan : "expired",
      subscription_status: active ? status : "expired",
      billing_source: "apple",
      apple_original_transaction_id: String(tx.originalTransactionId ?? ""),
      apple_product_id: tx.productId,
      next_billing_date: expiresMs ? new Date(expiresMs).toISOString() : null,
    });

    return json({ ok: true, type, plan: active ? plan : "expired" });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 400);
  }
});
