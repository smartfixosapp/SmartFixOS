// Unified Custom SDK for both Browser and Deno environments
// Detects environment and handles Supabase operations accordingly
// This is the merged version of custom-sdk.js and unified-custom-sdk.js

// Detect environment
const isDeno = typeof Deno !== "undefined";
const isBrowser = typeof window !== "undefined";

// Tables that should NOT be filtered by tenant_id (global catalogs / shared data)
const TENANT_EXEMPT_TABLES = new Set([
  'tenant', 'system_config', 'subscription',
  'device_category', 'brand', 'device_model', 'device_subcategory',
  'device_family', 'part_type', 'accessory_category',
  'work_order_wizard_config',
]);

// Handle environment variables for all environments
const getEnvVar = (key, defaultValue) => {
  if (isDeno) {
    return Deno.env.get(key) || defaultValue;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
};

// Performance: Check if we're in production mode
const isProduction = getEnvVar("DENO_ENV", "") === "production" || getEnvVar("NODE_ENV", "") === "production";

// Global client cache to avoid creating multiple Supabase clients
const globalClientCache = new Map();
function getClientCacheKey(useServiceRole, schema) {
  return `${useServiceRole ? 'service' : 'anon'}_${schema || 'public'}`;
}

// CRITICAL: Cache entity schemas by path to avoid reading from disk on every request
const entitySchemasCache = new Map();
const fieldMapsLoadedCache = new Set();

// Performance: Cache auth tokens to avoid repeated getSession calls
const authTokenCache = new Map();
let authTokenCacheTimeout = null;
const AUTH_TOKEN_CACHE_TTL = 30000; // 30 seconds

// Clear auth token cache periodically
if (isBrowser && typeof setInterval !== 'undefined') {
  if (authTokenCacheTimeout) clearInterval(authTokenCacheTimeout);
  authTokenCacheTimeout = setInterval(() => {
    authTokenCache.clear();
  }, AUTH_TOKEN_CACHE_TTL);
}

// Configuration
const PROD_SUPABASE_URL = "https://idntuvtabecwubzswpwi.supabase.co";
const PROD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbnR1dnRhYmVjd3VienN3cHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDY2NDIsImV4cCI6MjA4ODY4MjY0Mn0.X2Ewcx-mds_Ua51XKy8zEFEA0fgUfHwmfuxMXu8ye_w";
const PROD_API_BASE_URL = "https://smartfixos-api.onrender.com";
const PROD_FUNCTIONS_BASE_URL = "https://smartfixos-api.onrender.com";

const supabaseUrl = getEnvVar("VITE_SUPABASE_URL", PROD_SUPABASE_URL);
const supabaseAnonKey = getEnvVar(
  "VITE_SUPABASE_ANON_KEY", 
  PROD_SUPABASE_ANON_KEY
);
const supabaseServiceKey = getEnvVar(
  "SUPABASE_SERVICE_ROLE_KEY",
  null
);

// Import supabase client for browser (from supabase-client.js) - lazy loaded
let supabase = null;
async function getSupabaseClient() {
  if (isBrowser && !supabase) {
    try {
      // Dynamic import for browser - will be handled by bundler
      const supabaseModule = await import("./supabase-client.js");
      supabase = supabaseModule.supabase;
    } catch (error) {
      // Fallback if import fails - create client dynamically
      console.warn("Could not import supabase-client.js, will create client dynamically");
      const { createClient } = await import("@supabase/supabase-js");
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabase;
}

// API Base URL - different for browser vs Deno
const API_BASE_URL = getEnvVar("VITE_API_URL", PROD_API_BASE_URL)
// Functions base URL - single server approach
const FUNCTIONS_BASE_URL = getEnvVar("VITE_FUNCTION_URL", PROD_FUNCTIONS_BASE_URL);

// App-specific schema for multi-tenant staging/production
// Format: app_<app_id> (e.g., app_6940046c78c813d8fc0389a1)
// If not set, defaults to 'public' schema
const APP_SCHEMA = getEnvVar("VITE_DB_SCHEMA", getEnvVar("DB_SCHEMA", "public"));

/**
 * Get the schema name for Supabase queries.
 * In staging/prod multi-tenant mode, each app uses its own schema.
 */
function getDbSchema() {
  return APP_SCHEMA;
}

/**
 * Request-scoped auth token storage for Deno functions.
 * Set by server.js from Authorization header, used by UnifiedUserEntity.me()
 */
let currentRequestAuthToken = null;

/**
 * Set the auth token for the current request (Deno only).
 * Called by server.js when processing requests.
 */
export function setRequestAuthToken(token) {
  if (isDeno) {
    currentRequestAuthToken = token;
  }
}

/**
 * Get the auth token for the current request (Deno only).
 */
function getRequestAuthToken() {
  return isDeno ? currentRequestAuthToken : null;
}

/**
 * Clear the auth token after request processing (Deno only).
 */
export function clearRequestAuthToken() {
  if (isDeno) {
    currentRequestAuthToken = null;
  }
}

/**
 * Decode JWT to extract user info (for Deno session setup).
 * Returns minimal user object or null if decode fails.
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return {
      id: payload.sub || payload.user_id,
      email: payload.email,
      user_metadata: payload.user_metadata || {},
      app_metadata: payload.app_metadata || {},
      aud: payload.aud || 'authenticated',
      role: payload.role || 'authenticated'
    };
  } catch (error) {
    console.warn("Could not decode JWT:", error);
    return null;
  }
}

/**
 * Initialize Supabase client based on environment and options.
 * In Deno, if accessToken is provided, uses it to create a user-scoped client.
 */
async function initializeSupabaseClient(useServiceRole = false, accessToken = null) {
  let createClient;
  
  if (isDeno) {
    // Dynamic import for Deno
    const { createClient: denoCreateClient } = await import("npm:@supabase/supabase-js@2.45.4");
    createClient = denoCreateClient;
  } else {
    // Static import for browser/Node (bundler will handle this)
    if (isBrowser && window.supabase) {
      createClient = window.supabase.createClient;
    } else if (isBrowser && supabase) {
      // Use the imported supabase client's createClient method
      const { createClient: supabaseCreateClient } = await import("@supabase/supabase-js");
      createClient = supabaseCreateClient;
    } else {
      // This will be handled by bundler in browser environment
      const module = await import("@supabase/supabase-js");
      createClient = module.createClient;
    }
  }

  const dbSchema = getDbSchema();
  
  // In Deno, if we have an access token, use it instead of service role
  // This allows Deno functions to use the frontend user's session
  let key = useServiceRole ? supabaseServiceKey : supabaseAnonKey;
  let actualUseServiceRole = useServiceRole;

  if (useServiceRole && !supabaseServiceKey) {
    key = supabaseAnonKey;
    actualUseServiceRole = false;
  }
  
  if (isDeno && accessToken && !useServiceRole) {
    // Use the provided access token to create a user-scoped client
    key = supabaseAnonKey; // Use anon key, but with the user's token
    actualUseServiceRole = false;
  }
  
  // Performance: Configure Supabase client with optimal settings for connection reuse
  const options = actualUseServiceRole ? {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: dbSchema,
    },
    // Performance: Use global fetch with keepalive for connection reuse (Deno only)
    global: isDeno ? {
      fetch: (url, options = {}) => {
        // Add keepalive for connection reuse in Deno
        const fetchOptions = {
          ...options,
          keepalive: true,
        };
        return fetch(url, fetchOptions);
      }
    } : undefined,
  } : {
    auth: {
      autoRefreshToken: !isDeno, // Don't auto-refresh in Deno (no session storage)
      persistSession: !isDeno, // Don't persist in Deno
    },
    db: {
      schema: dbSchema,
    },
    // Performance: Use global fetch with keepalive for connection reuse (Deno only)
    global: isDeno ? {
      fetch: (url, options = {}) => {
        // Add keepalive for connection reuse in Deno
        const fetchOptions = {
          ...options,
          keepalive: true,
        };
        return fetch(url, fetchOptions);
      }
    } : undefined,
  };

  if (isDeno && !isProduction) {
    console.log(`🔧 Using database schema: ${dbSchema}`);
    // Note: accessToken is no longer used here - token validation happens in UnifiedUserEntity.me()
  }

  // Performance: Use global client cache to reuse connections
  const cacheKey = getClientCacheKey(actualUseServiceRole, dbSchema);
  if (globalClientCache.has(cacheKey)) {
    return globalClientCache.get(cacheKey);
  }

  const client = createClient(supabaseUrl, key, options);
  
  // Note: We don't set the session here anymore when we have an accessToken
  // Instead, token validation happens in UnifiedUserEntity.me() via REST API
  // and we use service role client for database operations after validation
  // This avoids the "Auth session missing!" error from setSession()
  
  // Test the connection only once in development
  if (isDeno && useServiceRole && !isProduction) {
    // Only test connection in dev mode, and only once per client type
    const testCacheKey = `tested_${cacheKey}`;
    if (!globalClientCache.has(testCacheKey)) {
      console.log("🔧 Testing Supabase connection with service role...");
      try {
        const { data, error } = await client.from(USERS_TABLE_NAME).select("id").limit(1);
        if (error && !error.message?.includes("Could not find the table")) {
          console.warn("⚠️ Supabase service role connection issue:", error.message);
        } else {
          console.log("✅ Supabase service role connection successful");
        }
      } catch (err) {
        console.warn("⚠️ Supabase connection test failed:", err.message);
      }
      globalClientCache.set(testCacheKey, true);
    }
  }
  
  // Cache the client for reuse
  globalClientCache.set(cacheKey, client);
  return client;
}

const fieldNameToOriginalByTable = new Map();
function getFieldNameToOriginalByTable(tableName) {
  return fieldNameToOriginalByTable.get(tableName) || {};
}
function setFieldNameToOriginalByTable(tableName, fieldNameToOriginal) {
  fieldNameToOriginalByTable.set(tableName, fieldNameToOriginal);
}

const columnTypeByTable = new Map();
function getColumnTypesByTable(tableName) {
  return columnTypeByTable.get(tableName) || {};
}
function setColumnTypesByTable(tableName, colTypes) {
  columnTypeByTable.set(tableName, colTypes);
}

/**
 * Coerce payload values to match schema types so Supabase (strict types) does not fail.
 * Uses entity schema types: empty/invalid for number|integer -> null; string that parses as number -> number; etc.
 */
function coerceDataForSupabase(tableName, data) {
  if (!data || typeof data !== "object") return;
  const types = getColumnTypesByTable(tableName);
  for (const [key, value] of Object.entries(data)) {
    const expectedType = types[key];
    if (value === "" || value === undefined) {
      if (expectedType === "number" || expectedType === "integer") {
        data[key] = null;
      } else if (expectedType === "boolean") {
        data[key] = null;
      }
      continue;
    }
    if (expectedType === "number" || expectedType === "integer") {
      if (typeof value === "string") {
        const n = expectedType === "integer" ? parseInt(value, 10) : parseFloat(value);
        data[key] = Number.isNaN(n) ? null : (expectedType === "integer" ? Math.floor(n) : n);
      }
    } else if (expectedType === "boolean") {
      if (typeof value === "string") {
        const lower = value.toLowerCase();
        if (lower === "true" || lower === "1") data[key] = true;
        else if (lower === "false" || lower === "0" || lower === "") data[key] = false;
      }
    }
  }
}

/**
 * Base Entity class that provides CRUD operations
 * Also exported as CustomEntity for backward compatibility
 */
export class UnifiedEntity {
  constructor(tableName, useServiceRole = false) {
    this.tableName = tableName;
    this.useServiceRole = useServiceRole;
    this._client = null;
    this._cachedToken = null; // Track the token used for cached client
  }

  /**
   * Bridge for RLS: ensure the next Supabase request sends the JWT
   * This is consumed by the customized fetch in supabase-client.js
   */
  async _bridgeRlsToken(client) {
    if (isBrowser && !this.useServiceRole && typeof window !== 'undefined') {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.access_token) {
          window.__SUPABASE_NEXT_REQUEST_TOKEN = session.access_token;
        }
      } catch (_) {
        // no-op: ignore session errors, will run as anon
      }
    }
  }

  async getClient() {
    // Performance: Use global cached client instead of per-instance client
    // In Deno, even if we have a token, we use service role for database operations
    // Token validation happens separately in UnifiedUserEntity.me() via REST API
    // This avoids session-related errors
    if (isDeno) {
      // Always use service role in Deno for database operations
      // The token is validated separately and we know the user is authenticated
      // Use global cache instead of instance cache for better connection reuse
      const schema = getDbSchema();
      const cacheKey = getClientCacheKey(true, schema);
      if (globalClientCache.has(cacheKey)) {
        return globalClientCache.get(cacheKey);
      }
      if (!isProduction) {
        console.log(`🔧 Initializing Supabase client for ${this.tableName} (serviceRole: true in Deno)`);
      }
      const client = await initializeSupabaseClient(true, null); // Always use service role in Deno
      return client; // initializeSupabaseClient now handles caching
    }
    
    // For browser, use supabase client from supabase-client.js if available, otherwise create one
    if (!this._client) {
      // Try to use the imported supabase client for browser (non-service role)
      if (!this.useServiceRole) {
        const browserSupabase = await getSupabaseClient();
        if (browserSupabase) {
          this._client = browserSupabase;
          this._cachedToken = null;
          return this._client;
        }
      }
      // Fallback to creating a new client (will use global cache)
      this._client = await initializeSupabaseClient(this.useServiceRole, null);
      this._cachedToken = null;
    }
    return this._client;
  }

  static snakeToCamel(str) {
    if (typeof str !== "string") return str;
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  mapFieldName(field) {
    const fieldMappings = {
      created_date: "created_at",
      updated_date: "updated_at",
      created_by_id: "created_by_id",
      created_by: "created_by",
    };
    let mappedKey;
    if (fieldMappings[field]) {
      mappedKey = fieldMappings[field];
    } else {
      let s1 = field.replace(/(.)([A-Z][a-z]+)/g, "$1_$2");
      let s2 = s1.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
      let s3 = s2.replace(/-/g, "_").replace(/\s+/g, "_");
      mappedKey = s3.toLowerCase();
  }
    return mappedKey;
  }

  mapDataFields(data) {
    if (!data || typeof data !== "object") return data;
    const mapped = {};
    Object.entries(data).forEach(([key, value]) => {
      const mappedKey = this.mapFieldName(key);
      mapped[mappedKey] = value;
    });
    return mapped;
  }

  mapResultFields(data) {
    if (!data) return data;
    const reverseFieldMappings = {
      created_at: "created_date",
      updated_at: "updated_date",
      created_by_id: "created_by_id",
      created_by: "created_by",
    };
    // console.log("🦕 this.tableName", this.tableName);
    // console.log("🦕 this.fieldNameToOriginal", getFieldNameToOriginalByTable(this.tableName) ?? {});

    const mapObject = (obj) => {
      const mapped = {};
      for (const [key, value] of Object.entries(obj)) {
        // 1) Explicit mapping, 2) client-seen key (from mapDataFields/filter/orderBy), 3) snake_to_camel fallback
        const mappedKey = key in reverseFieldMappings
          ? reverseFieldMappings[key]
          : (getFieldNameToOriginalByTable(this.tableName)[key] ?? key);
        mapped[mappedKey] = value;
      }
      return mapped;
    };

    if (Array.isArray(data)) {
      return data.map(mapObject);
    } else {
      return mapObject(data);
    }
  }

  /**
   * List entities with optional sort, limit, skip, and field selection.
   * @param {string} orderBy - Sort field (prefix "-" for descending)
   * @param {number|null} limit - Max records
   * @param {number|null} skip - Number of records to skip (pagination)
   * @param {string[]|null} fields - Optional list of field names to return (client-side names)
   */
  async list(orderBy = "-created_at", limit = null, skip = null, fields = null) {
    const client = await this.getClient();
    const selectCols = fields != null
      ? (Array.isArray(fields) ? fields : [fields]).map((f) => this.mapFieldName(f)).join(",")
      : "*";
    let query = client.from(this.tableName).select(selectCols);

    // Auto-inject tenant_id for browser queries to enforce tenant isolation
    if (isBrowser && !this.useServiceRole && !TENANT_EXEMPT_TABLES.has(this.tableName)) {
      const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('smartfix_tenant_id') : null;
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
    }

    if (orderBy) {
      if (orderBy.startsWith("-")) {
        const field = this.mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = this.mapFieldName(orderBy);
        query = query.order(field, { ascending: true });
      }
    }

    if (skip != null && skip > 0) {
      const end = limit != null ? skip + limit - 1 : skip + 999999;
      query = query.range(skip, end);
    } else if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205" && error.message.includes("Could not find the table")) {
        console.warn(`Table ${this.tableName} does not exist, returning empty array`);
        return [];
      }
      throw error;
    }
    return this.mapResultFields(data) || [];
  }

  /**
   * Format an array as a PostgREST tuple string for use with .not(column, 'in', ...).
   * Strings are double-quoted and escaped; numbers/booleans passed through.
   */
  _formatInTuple(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '()';
    const parts = arr.map((v) => {
      if (v === null) return 'null';
      if (typeof v === 'string') return `"${String(v).replace(/"/g, '""')}"`;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
    });
    return `(${parts.join(',')})`;
  }

  /**
   * Format a value for use inside a PostgREST .or() filter string.
   */
  _formatValueForOrString(v) {
    if (v === null) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return /[,\s()]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
    return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
  }

  /**
   * Convert one condition object to a PostgREST filter string piece (for .or()).
   * e.g. { status: 'a', type: { $gt: 5 } } -> "status.eq.a,type.gt.5"
   */
  _oneConditionToPostgrestPiece(cond) {
    const parts = [];
    for (const [key, value] of Object.entries(cond)) {
      const mappedKey = this.mapFieldName(key);
      if (Array.isArray(value)) {
        parts.push(`${mappedKey}.in.${this._formatInTuple(value)}`);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [op, operand] of Object.entries(value)) {
          const pgOp = { $eq: 'eq', $ne: 'neq', $gt: 'gt', $gte: 'gte', $lt: 'lt', $lte: 'lte', $in: 'in', $nin: 'not.in', $exists: 'is', $like: 'like', $ilike: 'ilike', $regex: 'ilike' }[op];
          if (op === '$nin' && Array.isArray(operand) && operand.length > 0) {
            parts.push(`${mappedKey}.not.in.${this._formatInTuple(operand)}`);
          } else if (op === '$exists') {
            parts.push(operand ? `${mappedKey}.not.is.null` : `${mappedKey}.is.null`);
          } else if (pgOp && op !== '$nin') {
            const val = op === '$in' ? this._formatInTuple(operand) : this._formatValueForOrString(operand);
            parts.push(`${mappedKey}.${pgOp}.${val}`);
          }
        }
      } else {
        parts.push(`${mappedKey}.eq.${this._formatValueForOrString(value)}`);
      }
    }
    return parts.join(',');
  }

  /**
   * Apply a single field condition to the query (used by filter and $and).
   */
  _applyOneCondition(query, mappedKey, value) {
    if (Array.isArray(value)) {
      return query.in(mappedKey, value);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [operator, operand] of Object.entries(value)) {
        switch (operator) {
          case '$in':
            query = query.in(mappedKey, operand);
            break;
          case '$nin':
            if (Array.isArray(operand) && operand.length > 0) {
              query = query.not(mappedKey, 'in', this._formatInTuple(operand));
            }
            break;
          case '$ne':
            if (Array.isArray(operand) && operand.length === 0) {
              query = query.not(mappedKey, 'eq', '[]');
            } else {
              query = query.neq(mappedKey, operand);
            }
            break;
          case '$eq':
            query = query.eq(mappedKey, operand);
            break;
          case '$gt':
            query = query.gt(mappedKey, operand);
            break;
          case '$gte':
            query = query.gte(mappedKey, operand);
            break;
          case '$lt':
            query = query.lt(mappedKey, operand);
            break;
          case '$lte':
            query = query.lte(mappedKey, operand);
            break;
          case '$exists':
            if (operand) {
              query = query.not(mappedKey, 'is', null);
            } else {
              query = query.is(mappedKey, null);
            }
            break;
          case '$null':
            if (operand) {
              query = query.is(mappedKey, null);
            } else {
              query = query.not(mappedKey, 'is', null);
            }
            break;
          case '$like':
            query = query.like(mappedKey, operand);
            break;
          case '$ilike':
            query = query.ilike(mappedKey, operand);
            break;
          case '$regex':
            query = query.ilike(mappedKey, operand);
            break;
          case '$contains':
            query = query.contains(mappedKey, operand);
            break;
          case '$containedBy':
            query = query.containedBy(mappedKey, operand);
            break;
          case '$not': {
            const inner = operand && typeof operand === 'object' ? operand : { $eq: operand };
            const [innerOp, innerVal] = Object.entries(inner)[0] || [];
            if (innerOp === '$in') {
              query = query.not(mappedKey, 'in', this._formatInTuple(innerVal));
            } else if (innerOp === '$eq') {
              query = query.neq(mappedKey, innerVal);
            } else if (innerOp === '$ne') {
              query = query.eq(mappedKey, innerVal);
            } else if (innerOp === '$gt') {
              query = query.lte(mappedKey, innerVal);
            } else if (innerOp === '$gte') {
              query = query.lt(mappedKey, innerVal);
            } else if (innerOp === '$lt') {
              query = query.gte(mappedKey, innerVal);
            } else if (innerOp === '$lte') {
              query = query.gt(mappedKey, innerVal);
            } else if (innerOp === '$exists') {
              query = innerVal ? query.is(mappedKey, null) : query.not(mappedKey, 'is', null);
            } else {
              console.warn(`$not with operator "${innerOp}" treated as neq.`);
              query = query.neq(mappedKey, innerVal);
            }
            break;
          }
          case '$type': {
            const t = typeof operand === 'number' ? { 1: 'number', 2: 'string', 3: 'object', 4: 'array', 8: 'boolean', 9: 'object', 10: 'null', 16: 'number' }[operand] : operand;
            if (t === 'null' || t === null || operand === 10) {
              query = query.is(mappedKey, null);
            } else {
              console.warn(`$type "${t}" (${operand}) not fully supported in SQL filter; use RPC for strict type checks.`);
            }
            break;
          }
          case '$mod':
            console.warn('$mod (modulo) is not supported by PostgREST filter; use RPC or raw SQL.');
            break;
          case '$text':
            if (typeof operand === 'string') {
              try {
                query = query.textSearch(mappedKey, operand);
              } catch (_) {
                query = query.ilike(mappedKey, `%${operand}%`);
              }
            } else if (operand && typeof operand === 'object' && operand.query) {
              try {
                query = query.textSearch(mappedKey, operand.query, operand.config || {});
              } catch (_) {
                query = query.ilike(mappedKey, `%${operand.query}%`);
              }
            }
            break;
          case '$elemMatch':
            if (operand && typeof operand === 'object') {
              if ('$eq' in operand) {
                query = query.contains(mappedKey, [operand.$eq]);
              } else if ('$in' in operand) {
                query = query.overlaps(mappedKey, operand.$in);
              } else {
                console.warn('$elemMatch with complex condition not fully supported; use simple $eq or $in.');
              }
            }
            break;
          case '$where':
            console.warn('$where (arbitrary JS) cannot be translated to SQL; condition ignored.');
            break;
          case '$expr':
            console.warn('$expr (field expressions) not supported in PostgREST filter; use RPC.');
            break;
          case '$jsonSchema':
            console.warn('$jsonSchema not supported in PostgREST filter; use jsonb_path_match RPC.');
            break;
          default:
            console.warn(`Unsupported operator "${operator}" in filter. Treating as equality.`);
            query = query.eq(mappedKey, value);
            break;
        }
      }
      return query;
    }
    return query.eq(mappedKey, value);
  }

  /**
   * Apply a full conditions object to the query (handles $or, $and, and normal keys).
   */
  _applyConditionsToQuery(query, conditions) {
    for (const [key, value] of Object.entries(conditions)) {
      if (key === '$or') {
        if (Array.isArray(value) && value.length > 0) {
          const orParts = value.map((cond) => this._oneConditionToPostgrestPiece(cond)).filter(Boolean);
          if (orParts.length > 0) {
            query = query.or(orParts.join(','));
          }
        }
        continue;
      }
      if (key === '$and') {
        if (Array.isArray(value)) {
          for (const clause of value) {
            query = this._applyConditionsToQuery(query, clause);
          }
        }
        continue;
      }
      const mappedKey = this.mapFieldName(key);
      query = this._applyOneCondition(query, mappedKey, value);
    }
    return query;
  }

  /**
   * Filter entities with optional sort, limit, skip, and field selection.
   * @param {Object} conditions - Filter conditions (supports $or, $and, operators)
   * @param {string} orderBy - Sort field (prefix "-" for descending)
   * @param {number|null} limit - Max records
   * @param {number|null} skip - Number of records to skip (pagination)
   * @param {string[]|null} fields - Optional list of field names to return (client-side names)
   */
  async filter(conditions = {}, orderBy = "created_at", limit = null, skip = null, fields = null) {
    const client = await this.getClient();
    const selectCols = fields != null
      ? (Array.isArray(fields) ? fields : [fields]).map((f) => this.mapFieldName(f)).join(",")
      : "*";
    
    await this._bridgeRlsToken(client);

    let query = client.from(this.tableName).select(selectCols);
    query = this._applyConditionsToQuery(query, conditions);

    // Auto-inject tenant_id for browser queries when not already in conditions
    if (isBrowser && !this.useServiceRole && !TENANT_EXEMPT_TABLES.has(this.tableName)) {
      const hasTenantCondition = conditions && (
        'tenant_id' in conditions ||
        ('$and' in conditions && Array.isArray(conditions.$and) && conditions.$and.some(c => 'tenant_id' in c))
      );
      if (!hasTenantCondition) {
        const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('smartfix_tenant_id') : null;
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
      }
    }

    if (orderBy) {
      if (orderBy.startsWith("-")) {
        const field = this.mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = this.mapFieldName(orderBy);
        query = query.order(field, { ascending: true });
      }
    }

    if (skip != null && skip > 0) {
      const end = limit != null ? skip + limit - 1 : skip + 999999;
      query = query.range(skip, end);
    } else if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205" && error.message.includes("Could not find the table")) {
        console.warn(`Table ${this.tableName} does not exist, returning empty array`);
        return [];
      }
      throw error;
    }
    return this.mapResultFields(data) || [];
  }

  async get(id) {
    try {
      if (isDeno && !isProduction) {
        console.log(`🔧 Getting record from ${this.tableName} with id: ${id}`);
      }
      
      const client = await this.getClient();
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        if (isDeno && !isProduction) {
          console.error(`❌ Database error for ${this.tableName}.get(${id}):`, error);
        }
        
        if (error.code === "PGRST205" && error.message.includes("Could not find the table")) {
          if (!isProduction) {
            console.warn(`Table ${this.tableName} does not exist, returning null`);
          }
          return null;
        }
        throw error;
      }

      if (isDeno && !isProduction) {
        console.log(`✅ Retrieved record from ${this.tableName}:`, data ? 'found' : 'not found');
      }

      return data ? this.mapResultFields(data) : null;
    } catch (error) {
      if (isDeno && !isProduction) {
        console.error(`💥 Exception in ${this.tableName}.get(${id}):`, error.message);
      }
      throw error;
    }
  }

  async create(data) {
    const client = await this.getClient();
    const mappedData = this.mapDataFields(data);

    // Add user info if in browser environment and not using service role
    let sessionState = { hasSession: false, userId: null, email: null };
    if (isBrowser && !this.useServiceRole) {
      try {
        const { data: { session } } = await client.auth.getSession();
        sessionState = {
          hasSession: !!session?.access_token,
          userId: session?.user?.id ?? null,
          email: session?.user?.email ?? null,
        };
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          mappedData['created_by_id'] = user.id;
          mappedData['created_by'] = user.email;
        }
      } catch (e) {
        sessionState.getUserError = String(e?.message || e);
      }
    }

    // Auto-inject tenant_id on create (same logic as list/filter)
    if (isBrowser && !this.useServiceRole && !TENANT_EXEMPT_TABLES.has(this.tableName)) {
      const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('smartfix_tenant_id') : null;
      if (tenantId && !mappedData['tenant_id']) {
        mappedData['tenant_id'] = tenantId;
      }
    }

    coerceDataForSupabase(this.tableName, mappedData);

    await this._bridgeRlsToken(client);

    const { data: result, error } = await client
      .from(this.tableName)
      .insert(mappedData)
      .select()
      .single();

    if (error) {
      const isRlsError = /row-level security|RLS|policy|violates.*policy/i.test(String(error.message || error));
      console.log("[RLS debug] create error:", error.message || error, "code:", error.code, "details:", error.details);
      if (isRlsError && isBrowser && !this.useServiceRole) {
        try {
          const { data: rlsCtx } = await client.rpc("debug_rls_context");
          console.log("[RLS debug] create failed – what Postgres sees (debug_rls_context):", rlsCtx);
          if (rlsCtx?.campaign_policies?.length) {
            const insertPolicies =
  (rlsCtx?.campaign_policies ?? []).filter(
    p => p.cmd === 'INSERT' || p.cmd === 'ALL'
  );

console.log("[RLS debug] campaign INSERT policies (with_check):",
  insertPolicies.map(p => ({ name: p.name, with_check: p.with_check }))
);
          }
        } catch (rpcErr) {
          console.warn("[RLS debug] debug_rls_context call failed:", rpcErr?.message || rpcErr);
        }

      }

      console.log("INSERT error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      
      throw error;
    }
    return this.mapResultFields(result);
  }

  async bulkCreate(dataList) {
    if (!Array.isArray(dataList)) {
      throw new Error('bulkCreate expects an array of rows');
    }
    const results = [];
    for (const row of dataList) {
      const created = await this.create(row);
      results.push(created);
    }
    return results;
  }

  async update(id, data) {
    const client = await this.getClient();
    const mappedData = this.mapDataFields(data);
    mappedData.updated_at = new Date().toISOString();

    coerceDataForSupabase(this.tableName, mappedData);

    await this._bridgeRlsToken(client);

    const { data: result, error } = await client
      .from(this.tableName)
      .update(mappedData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!result) {
      return null;
    }

    return this.mapResultFields(result);
  }

  async delete(id) {
    const client = await this.getClient();
    await this._bridgeRlsToken(client);
    const { error } = await client
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  /**
   * Delete multiple entities matching the given query/conditions.
   * @param {Object} query - Filter conditions (same shape as filter())
   * @returns {Promise<{ deletedCount: number }>}
   */
  async deleteMany(query = {}) {
    const client = await this.getClient();
    let q = client.from(this.tableName).delete();
    q = this._applyConditionsToQuery(q, query);
    const { count, error } = await q.select("*", { count: "exact", head: true });
    if (error) throw error;
    return { deletedCount: count ?? 0 };
  }

  /**
   * Import entities from a File (CSV or JSON). Parses the file and bulk-inserts rows.
   * @param {File} file - Browser File or (Deno) file object with name and arrayBuffer/text
   * @returns {Promise<{ imported: number, errors?: Array<{ row?: number, message: string }> }>}
   */
  async importEntities(file) {
    if (!file || (typeof File !== "undefined" && !(file instanceof File)) && typeof file?.arrayBuffer !== "function" && typeof file?.text !== "function") {
      throw new Error("importEntities expects a File or object with arrayBuffer/text");
    }
    const raw = typeof file.text === "function" ? await file.text() : await (await file.arrayBuffer()).then((ab) => new TextDecoder().decode(ab));
    const name = (file.name || "").toLowerCase();
    let rows = [];
    if (name.endsWith(".json") || raw.trim().startsWith("[")) {
      const parsed = JSON.parse(raw);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      const lines = raw.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) return { imported: 0 };
      const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row = {};
        header.forEach((k, j) => { row[k] = values[j] ?? ""; });
        rows.push(row);
      }
    }
    const results = [];
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const created = await this.create(rows[i]);
        results.push(created);
      } catch (e) {
        errors.push({ row: i + 1, message: e?.message || String(e) });
      }
    }
    return { imported: results.length, errors: errors.length ? errors : undefined };
  }

  /**
   * Subscribe to realtime changes on this entity table. Calls callback with { type, data, id, timestamp }.
   * @param {Function} callback - (event: { type: 'INSERT'|'UPDATE'|'DELETE', data: T, id?: string, timestamp: string }) => void
   * @returns {() => void} Unsubscribe function
   */
  subscribe(callback) {
    const ref = { channel: null };
    const schema = getDbSchema();
    const table = this.tableName;
    (async () => {
      try {
        const client = await this.getClient();
        ref.channel = client.channel(`entity:${schema}:${table}`);
        ref.channel.on(
          "postgres_changes",
          { event: "*", schema, table },
          (payload) => {
            const eventType = payload.eventType;
            const record = payload.new ?? payload.old;
            const mapped = record ? this.mapResultFields(record) : record;
            try {
              callback({
                type: eventType,
                data: mapped,
                id: record?.id,
                timestamp: new Date().toISOString(),
              });
            } catch (err) {
              console.error("[UnifiedEntity] subscribe callback error:", err);
            }
          }
        );
        await ref.channel.subscribe();
      } catch (err) {
        console.error("[UnifiedEntity] subscribe setup error:", err);
      }
    })();
    return () => {
      if (ref.channel) ref.channel.unsubscribe();
    };
  }
}


function normalizeToRelativePath(input) {
  try {
    // If it's already relative, use a dummy base
    const url = new URL(input, "http://dummy-base.com");
    return url.pathname + url.search + url.hash;
  } catch (err) {
    console.error("Invalid URL:", input);
    return null;
  }
}


/**
 * User Entity with authentication methods
 * Also exported as UserEntity for backward compatibility
 */
export class UnifiedUserEntity extends UnifiedEntity {
  constructor() {
    super(USERS_TABLE_NAME, true); // Always use service role for user operations
  }

  async me() {
    if (isDeno) {
      // For Deno functions, try to use the frontend user's auth token
      const accessToken = getRequestAuthToken();
      
      // Performance: Cache user data per token to avoid redundant API calls
      const userCacheKey = `user_${accessToken?.substring(0, 20)}`;
      const cachedUser = globalClientCache.get(userCacheKey);
      if (cachedUser && cachedUser.cachedAt > Date.now() - 60000) { // Cache for 60 seconds
        return cachedUser.data;
      }

      if (!accessToken) {
        // No token provided, return service user (fallback)
        await this.getClient();
        if (!isProduction) {
          console.log("🔧 Deno: No auth token, using service user");
        }
        return {
          id: "service-user",
          email: "service@ownmy.app",
          role: "admin"
        };
      }
      
      // We have a token, use it to get the actual user
      try {
        // First, validate the token and get user info directly from Supabase REST API
        // This is more reliable than using setSession with a manually created session
        // Ensure supabaseUrl doesn't have trailing slash
        const cleanSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
        if (!isProduction) {
          console.log(`🔧 Deno: Validating token with Supabase at ${cleanSupabaseUrl}/auth/v1/user`);
        }
        
        const userResponse = await fetch(`${cleanSupabaseUrl}/auth/v1/user`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': supabaseAnonKey
          }
        });
        
        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          if (!isProduction) {
            console.warn("🔧 Deno: Token validation failed:", userResponse.status, errorData);
            console.warn(`🔧 Deno: Supabase URL: ${supabaseUrl}, Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
          }
          return {
            id: "service-user",
            email: "service@ownmy.app",
            role: "admin"
          };
        }
        
        const authUser = await userResponse.json();
        
        if (!authUser || !authUser.id) {
          if (!isProduction) {
            console.warn("🔧 Deno: Invalid user data from token:", authUser);
          }
          return {
            id: "service-user",
            email: "service@ownmy.app",
            role: "admin"
          };
        }
        
        if (!isProduction) {
          console.log(`🔧 Deno: Token validated successfully, user: ${authUser.email} (${authUser.id})`);
        }
        
        // Use service role client for database operations since we've already validated the token
        const client = await initializeSupabaseClient(true); 

        // Robust User Resolution Logic for Deno
        // 1. Try finding by auth_id
        let { data, error } = await client
          .from(USERS_TABLE_NAME)
          .select("*")
          .eq("auth_id", authUser.id)
          .maybeSingle();

        // 2. If not found by auth_id, try by id (legacy/migration)
        if (!data && !error) {
          const { data: idData, error: idError } = await client
            .from(USERS_TABLE_NAME)
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();
          data = idData;
          error = idError;
        }

        // 3. If still not found, try by email (final fallback)
        if (!data && !error) {
          const { data: emailData, error: emailError } = await client
            .from(USERS_TABLE_NAME)
            .select("*")
            .eq("email", authUser.email)
            .maybeSingle();
          data = emailData;
          error = emailError;
        }

        if (error) {
          console.error("Error fetching user in Deno:", error);
          return { id: "service-user", email: "service@ownmy.app", role: "admin" };
        }

        // 4. If user found via fallback (2 or 3) but auth_id is missing, sync it
        if (data && !data.auth_id) {
          const { data: updatedUserData, error: syncError } = await client
            .from(USERS_TABLE_NAME)
            .update({ auth_id: authUser.id })
            .eq("id", data.id)
            .select()
            .single();
          
          if (!syncError) {
            data = updatedUserData;
          }
        }

        if (!data) {
          // If user doesn't exist, create from auth user
          const newUser = {
            auth_id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email,
            role: authUser.email === "dev@localhost.com" ? "admin" : "user",
          };

          const { data: createdUser, error: createError } = await client
            .from(USERS_TABLE_NAME)
            .insert(newUser)
            .select()
            .single();

          if (createError) {
            if (createError.code === "23505") { // Unique constraint violation (email)
              // This shouldn't happen with the email fallback above, but let's be safe
              const { data: retryData } = await client.from(USERS_TABLE_NAME).select("*").eq("email", authUser.email).maybeSingle();
              if (retryData) data = retryData;
            } else {
              console.error("Error creating user in Deno:", createError);
              return this.mapResultFields(newUser);
            }
          } else {
            data = createdUser;
          }
        }

        const mappedUser = this.mapResultFields(data);
        globalClientCache.set(userCacheKey, { data: mappedUser, cachedAt: Date.now() });
        return mappedUser;
      } catch (error) {
        if (!isProduction) {
          console.error("Error in Deno me():", error);
        }
        // Fallback to service user
        return {
          id: "service-user",
          email: "service@ownmy.app",
          role: "admin"
        };
      }
    }

    // For browser, get actual user
    try {
      // Use supabase client from supabase-client.js for auth in browser
      let authClient;
      if (isBrowser) {
        authClient = await getSupabaseClient();
        if (!authClient) {
          authClient = await this.getClient();
        }
      } else {
        authClient = await this.getClient();
      }
      
      const { data: { user }, error: authError } = await authClient.auth.getUser();

      if (authError) {
        // Handle specific auth errors more gracefully
        if (
          authError.message?.includes(
            "User from sub claim in JWT does not exist"
          )
        ) {
          // Clear the invalid session and throw not authenticated
          if (isBrowser && supabase) {
            await supabase.auth.signOut();
          }
          throw new Error("Not authenticated");
        }
        // Only log unexpected auth errors, not session missing errors
        if (!authError.message?.includes("Auth session missing")) {
          console.error("Auth error:", authError);
        }
        throw new Error("Not authenticated");
      }

      if (!user) throw new Error("Not authenticated");

      // CRITICAL: Always use service role client (initializeSupabaseClient(true))
      // to bypass RLS for user lookups. Using the anon client can cause RLS
      // to block the email lookup, causing a fake "user not found" and triggering
      // a duplicate insert that crashes with 23505.
      const client = await initializeSupabaseClient(true);
      
      // Robust User Resolution Logic for Browser
      // 1. Try finding by auth_id
      let { data, error } = await client
        .from(USERS_TABLE_NAME)
        .select("*")
        .eq("auth_id", user.id)
        .maybeSingle();

      // 2. If not found by auth_id, try by id (legacy/migration)
      if (!data && !error) {
        const { data: idData, error: idError } = await client
          .from(USERS_TABLE_NAME)
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        data = idData;
        error = idError;
      }

      // 3. If still not found, try by email (final fallback)
      if (!data && !error) {
        const { data: emailData, error: emailError } = await client
          .from(USERS_TABLE_NAME)
          .select("*")
          .eq("email", user.email)
          .maybeSingle();
        data = emailData;
        error = emailError;
      }

      if (error) {
        console.error("Error fetching user in Browser:", error);
        throw error;
      }

      // 4. If user found via fallback but auth_id is missing, sync it silently
      if (data && !data.auth_id) {
        try {
          const { data: updatedUserData } = await client
            .from(USERS_TABLE_NAME)
            .update({ auth_id: user.id })
            .eq("id", data.id)
            .select()
            .single();
          
          if (updatedUserData) {
            data = updatedUserData;
          }
        } catch (syncErr) {
          // Non-fatal: log but keep existing data
          console.warn("Could not sync auth_id:", syncErr?.message);
        }
      }

      if (!data) {
        // If user genuinely doesn't exist anywhere, create from auth user
        const newUser = {
          auth_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          role: user.email === "dev@localhost.com" ? "admin" : "user",
        };

        try {
          const { data: createdUser, error: createError } = await client
            .from(USERS_TABLE_NAME)
            .insert(newUser)
            .select()
            .single();

          if (createError) {
            // On any insert error (including 23505), try once more to find the user
            const { data: retryData } = await client.from(USERS_TABLE_NAME).select("*").eq("email", user.email).maybeSingle();
            if (retryData) {
              data = retryData;
            } else {
              console.error("Failed to create or find user in Browser:", createError);
              throw createError; // Only throw if we truly can't resolve the user
            }
          } else {
            data = createdUser;
          }
        } catch (insertErr) {
          // Last resort: try to find user by email before giving up
          const { data: lastResortData } = await client.from(USERS_TABLE_NAME).select("*").eq("email", user.email).maybeSingle();
          if (lastResortData) {
            data = lastResortData;
          } else {
            console.warn("Could not find or create user in DB due to RLS/Constraint. Returning auth object.", insertErr);
            data = newUser; // Fallback to mock object so the app doesn't crash
          }
        }
      }

      // Ensure dev user is always an admin
      if (user.email === "dev@localhost.com" && data.role !== "admin") {
        const { data: updatedUser, error: updateError } = await client
          .from(USERS_TABLE_NAME)
          .update({ role: "admin" })
          .eq("auth_id", user.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating dev user to admin:", updateError);
        } else {
          console.log("Updated dev user to admin role");
          return this.mapResultFields(updatedUser);
        }
      }

      return this.mapResultFields(data);
    } catch (error) {
      // Handle various auth-related errors gracefully
      if (
        error.message?.includes("403") ||
        error.message?.includes("Forbidden") ||
        error.message?.includes("User from sub claim in JWT does not exist") ||
        error.message?.includes("AuthApiError") ||
        error.message === "Not authenticated"
      ) {
        // Clear any invalid session
        if (isBrowser) {
          try {
            const browserSupabase = await getSupabaseClient();
            if (browserSupabase) {
              await browserSupabase.auth.signOut();
            }
          } catch {
            // Ignore sign out errors
          }
        }
        throw new Error("Not authenticated");
      }
      console.error("Error in me():", error);
      throw error;
    }
  }

  /**
   * Get a user by ID using service role (bypasses RLS)
   * @param {string} id - User ID
   * @returns {Promise<Object>} User data
   */
  async get(id) {
    const client = await this.getClient();
    const { data, error } = await client
      .from(USERS_TABLE_NAME)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user by ID:", error);
      throw error;
    }

    return data ? this.mapResultFields(data) : null;
  }

  /**
   * Update current user's data (browser only)
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} Updated user data
   */
  async updateMyUserData(userData) {
    if (!isBrowser) {
      throw new Error("updateMyUserData is only available in browser environment");
    }
    
    // Use supabase client for auth, but service role client for database operations
    const authClient = await getSupabaseClient() || await this.getClient();
    
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const client = await this.getClient();
    const { data, error } = await client
      .from(USERS_TABLE_NAME)
      .update({ ...userData, updated_at: new Date().toISOString() })
      .eq("auth_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error updating user:", error);
      throw error;
    }

    // If no rows were updated, return null
    if (!data) {
      return null;
    }

    return this.mapResultFields(data);
  }

  async updateMe(userData) {
    if (!isBrowser) {
      throw new Error("updateMyUserData is only available in browser environment");
    }
    
    // Use supabase client for auth, but service role client for database operations
    const authClient = await getSupabaseClient() || await this.getClient();
    
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const client = await this.getClient();
    const { data, error } = await client
      .from(USERS_TABLE_NAME)
      .update({ ...userData, updated_at: new Date().toISOString() })
      .eq("auth_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error updating user:", error);
      throw error;
    }

    // If no rows were updated, return null
    if (!data) {
      return null;
    }

    return this.mapResultFields(data);
  }

  /**
   * Sign in with OAuth provider or development mode (browser only)
   * @param {string} provider - OAuth provider (google, github, etc.) or 'dev' for development
   * @param {string} devEmail - Email for dev mode
   * @param {string} devPassword - Password for dev mode
   * @returns {Promise<void>}
   */
  async login(provider = "dev", devEmail = "dev@localhost.com", devPassword = "dev123456", redirectTo = '/') {
    if (!isBrowser) {
      throw new Error("login is only available in browser environment");
    }
    
    const browserSupabase = await getSupabaseClient();
    if (!browserSupabase) {
      throw new Error("Could not initialize Supabase client");
    }
    
    // For local development, use a simple email/password flow
    if (provider === "dev") {
      try {
        // Try to sign in first
        const { data: signInData, error: signInError } =
          await browserSupabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

        if (signInError) {
          console.log(
            "Sign in failed, attempting to create user:",
            signInError.message
          );

          // User doesn't exist, create it
          const { data: signUpData, error: signUpError } =
            await browserSupabase.auth.signUp({
              email: devEmail,
              password: devPassword,
              options: {
                data: {
                  full_name: "Development User",
                  role: "admin",
                },
              },
            });

          if (signUpError) {
            console.error("Sign up failed:", signUpError);
            throw signUpError;
          }

          console.log("User created successfully:", signUpData);

          if (signUpData.user && !signUpData.user.email_confirmed_at) {
            console.log(
              "User created but not confirmed. In production, check email for confirmation."
            );
          }

          // Try to sign in again after signup
          const { data: signInAfterSignUpData, error: signInAfterSignUpError } =
            await supabase.auth.signInWithPassword({
              email: devEmail,
              password: devPassword,
            });

          if (signInAfterSignUpError) {
            console.error(
              "Sign in after signup failed:",
              signInAfterSignUpError
            );
            throw signInAfterSignUpError;
          }

          console.log(
            "Successfully signed in after signup:",
            signInAfterSignUpData
          );
        } else {
          console.log("Successfully signed in:", signInData);
          return signInData;
        }
        // Refresh the page to ensure authentication state is properly loaded
        window.location.reload();
      } catch (error) {
        console.error("Development login failed:", error);
        throw error;
      }
      return;
    }

    if (provider === "email") {
      try {
        const { data: signInData, error: signInError } =
          await browserSupabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

        if (signInError) {
          console.error("Sign in failed:", signInError);
          throw signInError;
        }

        console.log("Successfully signed in:", signInData);
        return signInData;
        window.location.reload();
      } catch (error) {
        console.error("Email login failed:", error);
        throw error;
      }
      return;
    }

    const { data, error } = await browserSupabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:window.location.origin+redirectTo,
      },
    });
    if (error) throw error;
    return data;
  }

  /**
   * Sign up with email (browser only)
   * @param {string} provider - Provider type (email)
   * @param {string} devEmail - Email for signup
   * @param {string} devPassword - Password for signup
   * @param {string} name - Full name
   * @returns {Promise<void>}
   */
  async signUp(provider = "email", devEmail = "dev@localhost.com", devPassword = "dev123456", name = "Development User") {
    if (!isBrowser) {
      throw new Error("signUp is only available in browser environment");
    }
    
    const browserSupabase = await getSupabaseClient();
    if (!browserSupabase) {
      throw new Error("Could not initialize Supabase client");
    }
    
    // For local development, use a simple email/password flow
    if (provider === "email") {
      try {
        // Try to sign in first
        const { data: signInData, error: signInError } =
          await browserSupabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });

        if (signInError) {
          console.log(
            "Sign in failed, attempting to create user:",
            signInError.message
          );

          // User doesn't exist, create it
          const { data: signUpData, error: signUpError } =
            await browserSupabase.auth.signUp({
              email: devEmail,
              password: devPassword,
              options: {
                data: {
                  full_name: name,
                  role: "admin",
                },
              },
            });

          if (signUpError) {
            console.error("Sign up failed:", signUpError);
            throw signUpError;
          }

          console.log("User created successfully:", signUpData);

          if (signUpData.user && !signUpData.user.email_confirmed_at) {
            console.log(
              "User created but not confirmed. In production, check email for confirmation."
            );
          }

          // Try to sign in again after signup
          const { data: signInAfterSignUpData, error: signInAfterSignUpError } =
            await supabase.auth.signInWithPassword({
              email: devEmail,
              password: devPassword,
            });

          if (signInAfterSignUpError) {
            console.error(
              "Sign in after signup failed:",
              signInAfterSignUpError
            );
            throw signInAfterSignUpError;
          }

          console.log(
            "Successfully signed in after signup:",
            signInAfterSignUpData
          );
        } else {
          console.log("Successfully signed in:", signInData);
        }

        // Refresh the page to ensure authentication state is properly loaded
        window.location.reload();
      } catch (error) {
        console.error("Development signup failed:", error);
        throw error;
      }
      return;
    }

    const { error } = await browserSupabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:window.location.origin,
      },
    });
    if (error) throw error;
  }

  /**
   * Sign out current user (browser only)
   * @returns {Promise<void>}
   */
  async logout(returnUrl = '/') {
    if (!isBrowser) {
      throw new Error("logout is only available in browser environment");
    }
    
    const browserSupabase = await getSupabaseClient();
    if (!browserSupabase) {
      throw new Error("Could not initialize Supabase client");
    }
    
    const { error } = await browserSupabase.auth.signOut();

    if (error) throw error;
    console.log("Logging out, redirecting to:", returnUrl);
    window.location.href = returnUrl;
    // window.location.reload();

  }

  /**
   * Check if user is authenticated (browser only)
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    if (!isBrowser) {
      // In Deno, check if we have a token
      return getRequestAuthToken() !== null;
    }
    
    const browserSupabase = await getSupabaseClient();
    if (!browserSupabase) {
      return false;
    }
    
    try {
      const {
        data: { user },
        error: authError,
      } = await browserSupabase.auth.getUser();

      if (authError) {
        // Clear invalid session if needed
        if (
          authError.message?.includes(
            "User from sub claim in JWT does not exist"
          )
        ) {
          await browserSupabase.auth.signOut();
        }
        return false;
      }

      return !!user;
    } catch {
      return false;
    }
  }

  /**
   * Get current user data if authenticated, null if not (browser only)
   * @returns {Promise<Object|null>} Current user data or null
   */
  async getCurrentUser() {
    try {
      return await this.me();
    } catch (error) {
      if (error.message === "Not authenticated") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Redirect to login page (browser only)
   * @param {string} redirectUrl - URL to redirect to after login
   */


  redirectToLogin(redirectUrl = null) {

    
    if (!isBrowser) {
      throw new Error("redirectToLogin is only available in browser environment");
    }
    const normalizedRedirectUrl = normalizeToRelativePath(redirectUrl ?? (window.location.pathname + window.location.search + window.location.hash));

    // Store the redirect URL in sessionStorage
    if (redirectUrl) {
      sessionStorage.setItem("redirectAfterLogin", normalizedRedirectUrl);
    } else {
      // If no redirect URL provided, use current URL
      sessionStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
    }
    // Redirect to returnlogin page
    window.location.href = "/returnlogin?redirectTo="+ normalizedRedirectUrl ;
  }

  /**
   * List all users (admin function using service role)
   * @param {string} orderBy - Field to order by
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of users
   */
  async list(orderBy = "created_at", limit = null) {
    return super.list(orderBy, limit);
  }

  /**
   * Filter users (admin function using service role)
   * @param {Object} conditions - Filter conditions
   * @param {string} orderBy - Field to order by
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of filtered users
   */
  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    return super.filter(conditions, orderBy, limit);
  }
}

/** Canonical table name for User entity (user table does not exist). */
const USERS_TABLE_NAME = "users";

/**
 * Convert entity name to snake_case table name. Matches schema generator (sql_helpers.snake_case):
 * - Insert _ before [A-Z][a-z]+ (capital + rest of word), and between [a-z0-9] and [A-Z].
 * - So DSR_Request -> dsr__request, SSCVendorScorecard -> ssc_vendor_scorecard.
 */
function entityNameToTableName(entityName) {
  if (typeof entityName !== "string") return "";
  if (entityName.trim().toLowerCase() === "user") return USERS_TABLE_NAME;
  const s1 = entityName.replace(/(.)([A-Z][a-z]+)/g, "$1_$2");
  const s2 = s1.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const s3 = s2.replace(/-/g, "_").replace(/\s+/g, "_");
  return s3.toLowerCase();
}

/**
 * Load entity JSON schemas from a directory (Deno only).
 * CRITICAL: Cached to avoid reading from disk on every request.
 * @param {string} entitiesPath - Path to Entities folder (e.g. path to dir containing AwsStatus.json, ...)
 * @returns {Record<string, { name?: string, properties: Record<string, unknown> }>}
 */
function loadEntitySchemasFromPath(entitiesPath) {
  if (!isDeno || !entitiesPath) return {};
  
  // CRITICAL: Return cached schemas if already loaded
  if (entitySchemasCache.has(entitiesPath)) {
    return entitySchemasCache.get(entitiesPath);
  }
  
  const schemas = {};
  try {
    for (const entry of Deno.readDirSync(entitiesPath)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const entityName = entry.name.replace(/\.json$/i, "");
        const fullPath = entitiesPath.endsWith("/") ? entitiesPath + entry.name : entitiesPath + "/" + entry.name;
        const content = Deno.readTextFileSync(fullPath);
        const schema = JSON.parse(content);
        if (schema && typeof schema === "object" && schema.properties) {
          schemas[entityName] = schema;
        }
      }
    }
    // CRITICAL: Cache the loaded schemas
    entitySchemasCache.set(entitiesPath, schemas);
    if (!isProduction) {
      console.log(`✅ Loaded and cached ${Object.keys(schemas).length} entity schemas from ${entitiesPath}`);
    }
  } catch (err) {
    if (isDeno && !isProduction) {
      console.warn("⚠️ Could not load entity schemas from path:", entitiesPath, err.message);
    }
  }
  return schemas;
}

/**
 * Build fieldNameToOriginalByTable from entity schemas and set it once at init.
 * CRITICAL: Only processes schemas once to avoid rebuilding field maps on every request.
 * Each schema.properties key (field name as in JSON) is mapped: dbColumn -> fieldName.
 * @param {Record<string, { name?: string, properties: Record<string, unknown> }>} entitySchemas
 * @param {string} cacheKey - Optional cache key to track if already processed
 */
function loadFieldMapsFromEntitySchemas(entitySchemas, cacheKey = null) {
  if (!entitySchemas || typeof entitySchemas !== "object") return;
  
  // CRITICAL: Check if we've already loaded these field maps
  if (cacheKey && fieldMapsLoadedCache.has(cacheKey)) {
    return; // Already processed, skip
  }
  
  for (const [entityName, schema] of Object.entries(entitySchemas)) {
    if (!schema || !schema.properties || typeof schema.properties !== "object") continue;
    const tableName = entityNameToTableName(entityName);
    
    // CRITICAL: Check if field maps for this table already exist
    if (getFieldNameToOriginalByTable(tableName) && Object.keys(getFieldNameToOriginalByTable(tableName)).length > 0) {
      continue; // Already loaded, skip
    }
    
    const map = {};
    const colTypes = {};

    const fieldMappings = {
      created_date: "created_at",
      updated_date: "updated_at",
      created_by_id: "created_by_id",
      created_by: "created_by",
    };
    for (const fieldName of Object.keys(schema.properties)) {
      let dbColumn;
      if (fieldMappings[fieldName]) {
        dbColumn = fieldMappings[fieldName];
      } else {
        let s1 = fieldName.replace(/(.)([A-Z][a-z]+)/g, "$1_$2");
        let s2 = s1.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
        let s3 = s2.replace(/-/g, "_").replace(/\s+/g, "_");
        dbColumn = s3.toLowerCase();
      }
      map[dbColumn] = fieldName;
      const prop = schema.properties[fieldName];
      if (prop && typeof prop === "object" && prop.type) {
        colTypes[dbColumn] = prop.type;
      }
    }
    setFieldNameToOriginalByTable(tableName, map);
    setColumnTypesByTable(tableName, colTypes);
  }
  
  // CRITICAL: Mark as loaded if cache key provided
  if (cacheKey) {
    fieldMapsLoadedCache.add(cacheKey);
  }
}

/**
 * Determine if an entity should use service role based on environment and patterns.
 * In Deno, if we have a request auth token, prefer user token over service role.
 */
function shouldUseServiceRole(entityName) {

  if (isDeno) {
    const token = getRequestAuthToken();
    if (token) {
      return false;
    }
    return true;
  }
  
  // In browser environment, only use service role for sensitive entities
  const serviceRoleEntities = new Set([
    "user", "transaction", "usermembership", "payment",
    "subscription", "admin", "audit", "log",
  ]);
  return serviceRoleEntities.has(String(entityName || "").toLowerCase());
}

/**
 * Create entities proxy
 */
function createEntitiesProxy(forceServiceRole = false) {
  const entityCache = new Map();

  return new Proxy({}, {
    get(_, entityName) {
      if (typeof entityName !== "string") return undefined;
      
      // Handle special proxy methods
      if (entityName === 'inspect' || entityName === 'valueOf' || entityName === 'toString') {
        return undefined;
      }

      if (entityCache.has(entityName)) {
        return entityCache.get(entityName);
      }

      const tableName = entityNameToTableName(entityName);
      const useServiceRole = forceServiceRole || shouldUseServiceRole(entityName);
      const entity = new UnifiedEntity(tableName, useServiceRole);

      entityCache.set(entityName, entity);
      
      if (isDeno && !isProduction) {
        console.log(`🔧 Created entity: ${entityName} -> ${tableName} (serviceRole: ${useServiceRole})`);
      }
      
      return entity;
    },

    has(_, entityName) {
      return typeof entityName === "string" && entityName !== 'inspect' && entityName !== 'valueOf' && entityName !== 'toString';
    },

    ownKeys() {
      return Array.from(entityCache.keys());
    },
    
    getOwnPropertyDescriptor(_, entityName) {
      if (typeof entityName === "string" && entityName !== 'inspect' && entityName !== 'valueOf' && entityName !== 'toString') {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    }
  });
}


export function createClientFromRequest(request, options = {}) {
  if (!isDeno) {
    throw new Error("createClientFromRequest can only be used in Deno environment");
  }
  
  // Extract auth token from Authorization header (matches base44 pattern)
  const authHeader = request.headers.get("Authorization");
  let userToken = null;
  
  if (authHeader) {
    if (!authHeader.startsWith("Bearer ") || authHeader.split(" ").length !== 2) {
      throw new Error('Invalid authorization header format. Expected "Bearer <token>"');
    }
    userToken = authHeader.split(" ")[1];
  }
  
  // Set the token for this request (used by UnifiedEntity and UnifiedUserEntity)
  if (userToken) {
    setRequestAuthToken(userToken);
  }
  
  // Merge options with default functionsBaseUrl from environment
  const finalOptions = {
    functionsBaseUrl: options.functionsBaseUrl || getEnvVar('VITE_FUNCTION_URL', FUNCTIONS_BASE_URL),
    functions: options.functions || {},
    ...options
  };
  
  // Create client with the token from request
  return createUnifiedClient(finalOptions);
}

/**
 * Create unified custom client
 * @param {Object} options - Configuration options
 * @param {Object} options.functions - Dynamic function definitions
 * @param {string} options.functionsBaseUrl - Base URL for functions server
 * @param {string} options.token - Optional user token (for explicit token passing)
 * @param {string} options.entitiesPath - (Deno only) Path to Entities folder; used to build field maps at init
 * @param {Record<string, { name?: string, properties: Record<string, unknown> }>} options.entitySchemas - Entity JSON schemas (browser/Deno); used to build field maps at init so all entity fields are translated without per-call get/set
 */
export function createUnifiedClient(options = {}) {
  const {
    functions: customFunctions = {},
    functionsBaseUrl = FUNCTIONS_BASE_URL,
    token: explicitToken = null, // Allow explicit token passing
    entitiesPath = null,
    entitySchemas = null,
  } = options;

  // CRITICAL: Build field maps once at init from entity JSON (avoids get/set on every API call)
  // Use cache keys to avoid reprocessing on every client creation
  if (entitySchemas && typeof entitySchemas === "object") {
    // Create a cache key from entity schema keys (sorted for consistency)
    const schemaCacheKey = `schemas_${Object.keys(entitySchemas).sort().join(',')}`;
    loadFieldMapsFromEntitySchemas(entitySchemas, schemaCacheKey);
  } else if (entitiesPath && isDeno) {
    // CRITICAL: Use entitiesPath as cache key - schemas are already cached by path
    const schemas = loadEntitySchemasFromPath(entitiesPath);
    loadFieldMapsFromEntitySchemas(schemas, entitiesPath);
  }
  // If explicit token provided (e.g., from createClientFromRequest), set it
  if (isDeno && explicitToken) {
    setRequestAuthToken(explicitToken);
  }

  // Debug logging (uncomment for debugging)
  // if (isDeno) {
  //   console.log("🔧 Creating unified client in Deno environment");
  //   console.log(`🔧 Functions base URL: ${functionsBaseUrl}`);
  //   console.log(`🔧 Custom functions:`, Object.keys(customFunctions));
  // }

  // Helper to get auth token from browser Supabase session
  // Performance: Cache token to avoid repeated getSession calls
  async function getAuthToken() {
    if (!isBrowser) return null;
    
    // Performance: Check cache first
    const cacheKey = 'auth_token';
    if (authTokenCache.has(cacheKey)) {
      const cached = authTokenCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.token;
      }
      authTokenCache.delete(cacheKey);
    }
    
    try {
      // Try to get token from window.supabase if available (some apps set this)
      if (window.supabase && typeof window.supabase.auth?.getSession === 'function') {
        const { data: { session } } = await window.supabase.auth.getSession();
        const token = session?.access_token || null;
        if (token) {
          authTokenCache.set(cacheKey, { token, expires: Date.now() + AUTH_TOKEN_CACHE_TTL });
        }
        return token;
      }
      
      // Use the imported supabase client from supabase-client.js
      // This is the same client used throughout the app
      const browserSupabase = await getSupabaseClient();
      if (browserSupabase) {
        const { data: { session }, error } = await browserSupabase.auth.getSession();
        if (error) {
          if (!isProduction) {
            console.warn("Could not get session from supabase client:", error);
          }
          return null;
        }
        const token = session?.access_token || null;
        if (token) {
          authTokenCache.set(cacheKey, { token, expires: Date.now() + AUTH_TOKEN_CACHE_TTL });
        }
        return token;
      }
      
      // Fallback: Create a temporary client to get the session
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { 
          persistSession: true, 
          autoRefreshToken: true,
          storage: window.localStorage
        }
      });
      const { data: { session }, error } = await tempClient.auth.getSession();
      if (error) {
        if (!isProduction) {
          console.warn("Could not get session:", error);
        }
        return null;
      }
      const token = session?.access_token || null;
      if (token) {
        authTokenCache.set(cacheKey, { token, expires: Date.now() + AUTH_TOKEN_CACHE_TTL });
      }
      return token;
    } catch (error) {
      if (!isProduction) {
        console.warn("Could not get auth token:", error);
      }
      return null;
    }
  }

  // Create dynamic functions based on configuration
  // Performance: Use keepalive for HTTP connection reuse
  const functions = {
    invoke: async (functionName, payload) => {
      const headers = { 'Content-Type': 'application/json' };
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Performance: Use keepalive for connection reuse
      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        keepalive: true, // Reuse HTTP connections
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || response.statusText };
        }
        throw new Error(errorData.error || `Function ${functionName} failed: ${response.statusText}`);
      }
      
      return await response.json();
    }
  };
  
  Object.entries(customFunctions).forEach(([name, path]) => {
    functions[name] = async (payload) => {
      try {
        const url = `${functionsBaseUrl}${path}`;
        if (isDeno && !isProduction) {
          console.log(`🔧 Calling function ${name} at ${url}`);
        }
        
        const headers = { 'Content-Type': 'application/json' };
        const token = await getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Performance: Use keepalive for connection reuse
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          keepalive: true, // Reuse HTTP connections
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || response.statusText };
          }
          throw new Error(errorData.error || `Function ${name} failed: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        if (!isProduction) {
          console.error(`Error calling function ${name}:`, error);
        }
        throw error;
      }
    };
  });

  const integrationsModule = {
    Core: {
      InvokeLLM: async ({
        prompt,
        add_context_from_internet = false,
        response_json_schema = null,
        file_urls = null,
      }) => {
        console.log("InvokeLLM called with:", {
          prompt,
          add_context_from_internet,
          response_json_schema,
          file_urls,
        });

        try {
          const response = await fetch(`${FUNCTIONS_BASE_URL}/ai/invoke`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt,
              add_context_from_internet,
              response_json_schema,
              file_urls
            })
          });

          if (!response.ok) {
            throw new Error(`LLM invocation failed: ${response.statusText}`);
          }

          const data = await response.json();
          if (response_json_schema) {
            return data.data.message;
          }
          return data.response ? data.response : data;
        } catch (error) {
          console.error('Error invoking LLM:', error);
          throw error;
        }
      },
      SendEmail: async ({
        to,
        subject,
        body,
        html,
        from_name = "SmartFixOS",
        from_email = null,
        provider = "resend",
      }) => {
        // Route through Vercel /api/send-raw-email (replaces dead Deno /sendEmailInternal)
        try {
          const response = await fetch('/api/send-raw-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, subject, body: html || body, from_name }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Email sending failed: ${errorData.error || response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          console.error('Error sending email:', error);
          throw error;
        }
      },

      UploadFile: async ({ file }) => {
        if (!isBrowser) {
          throw new Error("UploadFile is only available in browser environment");
        }

        const browserSupabase = await getSupabaseClient();
        if (!browserSupabase) {
          throw new Error("Could not initialize Supabase client for file upload");
        }

        const safeName = (file.name || "file")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .replace(/_+/g, "_") || "file";
        const storagePath = `${Date.now()}_${safeName}`;

        const { error } = await browserSupabase.storage
          .from("uploads")
          .upload(storagePath, file, {
            upsert: true,
            contentType: file.type || "application/octet-stream",
          });

        if (error) {
          throw error;
        }

        const { data: publicUrlData } = browserSupabase.storage
          .from("uploads")
          .getPublicUrl(storagePath);

        return { file_url: publicUrlData?.publicUrl };

        // // Mock response for now
        // const mockUrl = `https://mock-storage.supabase.co/uploads/${Date.now()}_${
        //   file?.name || "file"
        // }`;
        // return {
        //   file_url: mockUrl,
        //   note: "File upload integration not yet implemented - this is a mock URL",
        // };


//         try {
//   // Create a FormData object to send the file
//   const formData = new FormData();
//   formData.append('file', file);

//   const response = await fetch(`${FUNCTIONS_BASE_URL}/files/upload`, {
//     method: 'POST',
//     headers: {
//       'api_key': API_KEY,
//       // Don't set Content-Type here, it will be set automatically with the boundary
//     },
//     body: formData
//   });

//   if (!response.ok) {
//     throw new Error(`File upload failed: ${response.statusText}`);
//   }

//   return await response.json();
// } catch (error) {
//   console.error('Error uploading file:', error);
//   throw error;
// }

      },

      GenerateImage: async ({ prompt }) => {
        console.log("GenerateImage called with prompt:", prompt);

        try {
          const response = await fetch(`${FUNCTIONS_BASE_URL}/ai/generate-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt
            })
          });

          if (!response.ok) {
            throw new Error(`Image generation failed: ${response.statusText}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error generating image:', error);
          throw error;
        }
      },
      OCRFile: async ({ file_url, json_schema }) => {
        console.warn("OCRUPloadedFile called with:", {
          file_url,
          json_schema,
        });


        let finalFileUrl = file_url;

// 🔹 If file_url starts with "uploads/", prepend SUPABASE_URL
if (file_url.startsWith("uploads/")) {
finalFileUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${file_url.replace(/^\//, "")}`;
}

  try {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/extract_file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
   body: JSON.stringify({ file_url:finalFileUrl, file_format: "pdf" })
  });

  if (!response.ok) {
    throw new Error(`Data extraction failed: ${response.statusText}`);
  }
  return await response.json();
} catch (error) {
  console.error('Error extracting data from file:', error);
  throw error;
}

},

      ExtractDataFromUploadedFile: async ({ file_url, json_schema }) => {
        console.warn("ExtractDataFromUploadedFile called with:", {
          file_url,
          json_schema,
        });


        // TODO: Replace with actual OCR/document processing service
        // Example with AWS Textract or custom OCR solution:
        const textract = new AWS.Textract();
        const result = await textract.analyzeDocument({
          Document: { S3Object: { Bucket: bucket, Name: key } },
          FeatureTypes: ['TABLES', 'FORMS']
        }).promise();
        
        // Process and structure the result according to json_schema

        // Mock response for now
        return {
          status: "success",
          details: null,
          output: json_schema?.type === "array" ? [] : {},
          note: "File data extraction integration not yet implemented - this is a mock response",
        };
      },
    },
  }
  const client = {
    entities: createEntitiesProxy(),
    auth: new UnifiedUserEntity(),
    asServiceRole: {
      entities: createEntitiesProxy(true), // Force service role
      functions: functions,
      integrations: integrationsModule, // Add integrations to asServiceRole (matches base44)
    },
    functions,
    integrations: integrationsModule,
  };
  return client;
}

// Default client for PI App functions (backward compatibility) - pre-configured instance
export const customClientPI = createUnifiedClient({
  functions: {
    processMedicalChronology: "/processMedicalChronology",
    generateDraftSection: "/generateDraftSection", 
    processDocumentPages: "/processDocumentPages",
    processDocumentComprehensive: "/processDocumentComprehensive",
    qualityControlCheck: "/qualityControlCheck",
    enhancedQualityControl: "/enhancedQualityControl"
  }
});

// Export customClient as the function (for backward compatibility with base44Client.js)
// This allows: const base44 = customClient({ functionsBaseUrl: ... })
export const customClient = createCustomClient;

/**
 * Create custom client - alias for createUnifiedClient for backward compatibility
 * This allows existing code using createCustomClient to continue working
 */
export function createCustomClient(options = {}) {
  return createUnifiedClient(options);
}

// Export aliases for backward compatibility
export const CustomEntity = UnifiedEntity;
export const UserEntity = UnifiedUserEntity;

// Export main creation function
export default createUnifiedClient;
