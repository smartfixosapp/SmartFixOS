export function tenantBrandName(fallback = "nuestro taller") {
  try {
    return localStorage.getItem("smartfix_tenant_name") || fallback;
  } catch {
    return fallback;
  }
}
