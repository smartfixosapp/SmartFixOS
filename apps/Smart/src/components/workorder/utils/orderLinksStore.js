import { base44 } from "@/api/base44Client";

const COMMENT_PREFIX = "[[LINK_V2]]";
const LOCAL_STORAGE_PREFIX = "wo_links_v2_";

function getLocalStorageKey(orderId) {
  return `${LOCAL_STORAGE_PREFIX}${orderId}`;
}

function readLocalLinks(orderId) {
  if (!orderId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getLocalStorageKey(orderId));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalLinks(orderId, links) {
  if (!orderId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getLocalStorageKey(orderId), JSON.stringify(Array.isArray(links) ? links : []));
  } catch {}
}

function sanitizePrice(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
}

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createLinkId(partName) {
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slugify(partName)}`;
}

function linkFingerprint(link) {
  return [
    String(link?.partName || "").trim().toLowerCase(),
    String(link?.url || "").trim().toLowerCase(),
    sanitizePrice(link?.price).toFixed(2),
  ].join("|");
}

function normalizeLink(input = {}) {
  const partName = String(input.partName || input.part || input.name || "").trim();
  const url = String(input.url || input.link || input.href || "").trim();
  const price = sanitizePrice(input.price);
  if (!partName || !url) return null;

  return {
    id: String(input.id || createLinkId(partName)),
    partName,
    url,
    price,
    createdAt: input.createdAt || input.created_at || input.created_date || new Date().toISOString(),
    author: String(input.author || input.user_name || input.user || "Sistema"),
  };
}

function buildCommentText(link) {
  return `${COMMENT_PREFIX}${JSON.stringify({
    id: link.id,
    partName: link.partName,
    url: link.url,
    price: sanitizePrice(link.price),
    createdAt: link.createdAt,
    author: link.author || "Sistema",
  })}`;
}

function parseLinkFromComment(comment) {
  if (!comment) return null;
  const text = String(comment.text || "");
  const prefixIndex = text.indexOf(COMMENT_PREFIX);
  if (prefixIndex >= 0) {
    try {
      const payload = JSON.parse(text.slice(prefixIndex + COMMENT_PREFIX.length));
      return normalizeLink({
        ...payload,
        author: comment.author || payload.author,
        createdAt: comment.timestamp || payload.createdAt,
      });
    } catch {}
  }

  const legacyMatch = text.match(/(?:🔗\s*)?(?:Link para\s*)?(.*?):\s*(https?:\/\/\S+)(?:\s*\|\s*Precio:\s*\$?([\d.,]+))?/i);
  if (!legacyMatch) return null;

  return normalizeLink({
    id: comment.id,
    partName: legacyMatch[1],
    url: legacyMatch[2],
    price: legacyMatch[3],
    createdAt: comment.timestamp,
    author: comment.author,
  });
}

function parseLinkFromLegacyEntry(entry = {}) {
  return normalizeLink({
    id: entry.id,
    partName: entry.partName || entry.part || entry.name,
    url: entry.link || entry.url || entry.href || entry.link_url,
    price: entry.price,
    createdAt: entry.created_at || entry.createdAt || entry.created_date,
    author: entry.author || entry.user_name,
  });
}

function parseLinkFromEvent(event = {}) {
  const meta = event.metadata || {};
  const normalized = normalizeLink({
    id: event.id,
    partName: meta.partName || meta.part || meta.name,
    url: meta.link || meta.url || meta.href,
    price: meta.price,
    createdAt: event.created_at || event.created_date,
    author: event.user_name,
  });
  if (normalized) return normalized;

  const desc = String(event.description || "");
  const legacyMatch = desc.match(/(?:🔗\s*)?(?:Link para\s*)?(.*?):\s*(https?:\/\/\S+)(?:\s*\|\s*Precio:\s*\$?([\d.,]+))?/i);
  if (!legacyMatch) return null;

  return normalizeLink({
    id: event.id,
    partName: legacyMatch[1],
    url: legacyMatch[2],
    price: legacyMatch[3],
    createdAt: event.created_at || event.created_date,
    author: event.user_name,
  });
}

function dedupeLinks(entries = []) {
  const seen = new Map();
  for (const entry of entries) {
    const normalized = normalizeLink(entry);
    if (!normalized) continue;
    const key = linkFingerprint(normalized);
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return Array.from(seen.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function buildCommentsArray(links, existingComments = []) {
  const preservedComments = (Array.isArray(existingComments) ? existingComments : []).filter(
    (comment) => !parseLinkFromComment(comment)
  );

  const linkComments = links.map((link) => ({
    id: link.id,
    text: buildCommentText(link),
    author: link.author || "Sistema",
    timestamp: link.createdAt,
    internal: true,
    attachments: [],
  }));

  return [...linkComments, ...preservedComments];
}

function buildLegacyRegistry(links) {
  return links.map((link) => ({
    id: link.id,
    partName: link.partName,
    link: link.url,
    price: sanitizePrice(link.price),
    created_at: link.createdAt,
  }));
}

function syncOrderItems(orderItems = [], links = []) {
  const safeItems = Array.isArray(orderItems) ? orderItems : [];
  const linkMap = new Map(links.map((link) => [link.id, link]));

  const preservedItems = safeItems.filter((item) => {
    if (!item) return false;
    if (!item.link_ref_id) return true;
    return linkMap.has(item.link_ref_id);
  });

  const existingByLinkRef = new Map(
    preservedItems.filter((item) => item?.link_ref_id).map((item) => [item.link_ref_id, item])
  );

  for (const link of links) {
    if (existingByLinkRef.has(link.id)) continue;
    preservedItems.push({
      id: `manual-link-${link.id}`,
      __kind: "manual",
      type: "product",
      source: "manual",
      is_manual: true,
      name: link.partName,
      price: sanitizePrice(link.price),
      qty: 1,
      taxable: true,
      discount_percentage: 0,
      total: sanitizePrice(link.price),
      link_url: link.url,
      link_ref_id: link.id,
    });
  }

  return preservedItems.map((item) => {
    const basePrice = sanitizePrice(item.price);
    const qty = Math.max(1, Number(item.qty || 1));
    const discount = Math.max(0, Number(item.discount_percentage || item.discount_percent || 0));
    const discountedPrice = basePrice - (basePrice * discount / 100);
    return {
      ...item,
      price: basePrice,
      qty,
      discount_percentage: discount,
      taxable: item.taxable !== false,
      total: Number((discountedPrice * qty).toFixed(2)),
    };
  });
}

function buildTotals(order, orderItems) {
  const safeItems = Array.isArray(orderItems) ? orderItems : [];
  const subtotal = safeItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const taxRate = Number(order?.tax_rate || 0.115);
  const taxableAmount = safeItems.reduce(
    (sum, item) => sum + (item.taxable !== false ? Number(item.total || 0) : 0),
    0
  );
  const tax = taxableAmount * taxRate;
  const total = Number((subtotal + tax).toFixed(2));
  const paid = Number(order?.total_paid || order?.amount_paid || order?.deposit_amount || 0);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    total,
    taxRate,
    balanceDue: Math.max(0, Number((total - paid).toFixed(2))),
  };
}

async function readRawLinks(order) {
  if (!order?.id) return { order: order || null, links: [] };

  const freshOrder = await base44.entities.Order.get(order.id).catch(() => order);

  const commentLinks = (Array.isArray(freshOrder?.comments) ? freshOrder.comments : [])
    .map(parseLinkFromComment)
    .filter(Boolean);

  const partsLinks = (Array.isArray(freshOrder?.parts_links) ? freshOrder.parts_links : [])
    .map(parseLinkFromLegacyEntry)
    .filter(Boolean);

  const itemsLinks = (Array.isArray(freshOrder?.order_items) ? freshOrder.order_items : [])
    .filter((item) => typeof item?.link_url === "string" && item.link_url.trim())
    .map((item) => parseLinkFromLegacyEntry({
      id: item.link_ref_id || item.id,
      partName: item.name,
      url: item.link_url,
      price: item.price,
      createdAt: item.created_at || item.updated_at || freshOrder?.updated_date,
    }))
    .filter(Boolean);

  const statusLinks = (Array.isArray(freshOrder?.status_metadata?.links_registry)
    ? freshOrder.status_metadata.links_registry
    : [])
    .map(parseLinkFromLegacyEntry)
    .filter(Boolean);

  const localLinks = readLocalLinks(freshOrder?.id)
    .map(parseLinkFromLegacyEntry)
    .filter(Boolean);

  let eventLinks = [];
  try {
    const events = await base44.entities.WorkOrderEvent.filter({ order_id: freshOrder.id }, "-created_date", 300);
    eventLinks = (Array.isArray(events) ? events : [])
      .map(parseLinkFromEvent)
      .filter(Boolean);
  } catch {}

  // Filter out links that were explicitly deleted (tracked in status_metadata.deleted_link_ids)
  const deletedIds = new Set(
    Array.isArray(freshOrder?.status_metadata?.deleted_link_ids)
      ? freshOrder.status_metadata.deleted_link_ids
      : []
  );
  const filteredEventLinks = deletedIds.size > 0
    ? eventLinks.filter((l) => !deletedIds.has(l.id))
    : eventLinks;

  const links = dedupeLinks([...commentLinks, ...partsLinks, ...itemsLinks, ...statusLinks, ...localLinks, ...filteredEventLinks]);
  return { order: freshOrder, links, commentLinks };
}

async function persistOrderLinks(order, links, options = {}) {
  const freshOrder = order?.id ? await base44.entities.Order.get(order.id).catch(() => order) : order;
  const normalizedLinks = dedupeLinks(links);
  const comments = buildCommentsArray(normalizedLinks, freshOrder?.comments || []);
  const statusMeta = freshOrder?.status_metadata && typeof freshOrder.status_metadata === "object"
    ? freshOrder.status_metadata
    : {};

  // Preserve existing deleted_link_ids so they survive future saves
  const existingDeletedIds = Array.isArray(statusMeta.deleted_link_ids) ? statusMeta.deleted_link_ids : [];
  // Also add any from options (set by deleteOrderLink)
  const newDeletedIds = Array.isArray(options.addDeletedIds) ? options.addDeletedIds : [];
  const deletedLinkIds = [...new Set([...existingDeletedIds, ...newDeletedIds])];

  const updatePayload = {
    comments,
    parts_links: buildLegacyRegistry(normalizedLinks),
    status_metadata: {
      ...statusMeta,
      links_registry: buildLegacyRegistry(normalizedLinks),
      ...(deletedLinkIds.length > 0 ? { deleted_link_ids: deletedLinkIds } : {}),
    },
  };

  if (options.syncItems !== false) {
    const orderItems = syncOrderItems(freshOrder?.order_items || [], normalizedLinks);
    const totals = buildTotals(freshOrder, orderItems);
    updatePayload.order_items = orderItems;
    updatePayload.total = totals.total;
    updatePayload.cost_estimate = totals.total;
    updatePayload.balance_due = totals.balanceDue;
    updatePayload.tax_rate = totals.taxRate;
  }

  writeLocalLinks(freshOrder.id, normalizedLinks);
  try {
    const updatedOrder = await base44.entities.Order.update(freshOrder.id, updatePayload);
    return { order: updatedOrder, links: normalizedLinks, synced: true };
  } catch (error) {
    console.warn("persistOrderLinks fallback to local cache:", error);
    return {
      order: {
        ...(freshOrder || {}),
        ...updatePayload,
      },
      links: normalizedLinks,
      synced: false,
    };
  }
}

export async function loadOrderLinks(order) {
  try {
    const { order: freshOrder, links } = await readRawLinks(order);
    writeLocalLinks(freshOrder?.id, links);
    return { order: freshOrder, links };
  } catch (error) {
    console.warn("loadOrderLinks fallback:", error);
    const fallbackLinks = readLocalLinks(order?.id)
      .map(parseLinkFromLegacyEntry)
      .filter(Boolean);
    return {
      order: order || null,
      links: dedupeLinks(fallbackLinks),
    };
  }
}

export async function saveOrderLink({ order, partName, url, price, user }) {
  const normalized = normalizeLink({
    partName,
    url,
    price,
    author: user?.full_name || user?.email || "Sistema",
  });

  if (!normalized) {
    throw new Error("invalid_link_payload");
  }

  const { order: freshOrder, links } = await readRawLinks(order);
  const merged = dedupeLinks([{ ...normalized, id: createLinkId(normalized.partName) }, ...links]);
  const persisted = await persistOrderLinks(freshOrder, merged, { syncItems: true });

  if (persisted?.synced !== false) {
    try {
    const me = await base44.auth.me().catch(() => null);
    await base44.entities.WorkOrderEvent.create({
      order_id: freshOrder.id,
      order_number: freshOrder.order_number,
      event_type: "note_added",
      description: `🔗 Link para ${normalized.partName}: ${normalized.url} | Precio: $${sanitizePrice(normalized.price).toFixed(2)}`,
      user_name: user?.full_name || me?.full_name || me?.email || "Sistema",
      user_id: user?.id || me?.id || null,
      metadata: {
        entry_kind: "link_added",
        is_link: true,
        partName: normalized.partName,
        link: normalized.url,
        price: sanitizePrice(normalized.price),
      },
    });
    } catch {}
  }

  return persisted;
}

export async function deleteOrderLink({ order, linkId }) {
  if (!order?.id || !linkId) return loadOrderLinks(order);
  const { order: freshOrder, links } = await readRawLinks(order);
  const remaining = links.filter((link) => link.id !== linkId);
  return persistOrderLinks(freshOrder, remaining, { syncItems: true, addDeletedIds: [linkId] });
}
