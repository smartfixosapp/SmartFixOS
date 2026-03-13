// Unified Custom SDK for both Browser and Deno environments
// Uses Appwrite instead of Supabase for Database and Auth
// Same API surface as unified-custom-sdk.js for drop-in replacement

// Detect environment
const isDeno = typeof Deno !== "undefined";
const isBrowser = typeof window !== "undefined";

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

// Appwrite configuration
const appwriteEndpoint = getEnvVar("VITE_APPWRITE_ENDPOINT", getEnvVar("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1"));
const appwriteProjectId = getEnvVar("VITE_APPWRITE_PROJECT_ID", getEnvVar("APPWRITE_PROJECT_ID", ""));
const appwriteApiKey = getEnvVar("VITE_APPWRITE_API_KEY", getEnvVar("APPWRITE_API_KEY", ""));
const appwriteDatabaseId = getEnvVar("VITE_APPWRITE_DATABASE_ID", getEnvVar("APPWRITE_DATABASE_ID", "main"));

// Functions base URL
const FUNCTIONS_BASE_URL = getEnvVar("VITE_FUNCTION_URL", "http://localhost:8686");

// Lazy-loaded Appwrite modules
let appwriteClient = null;
let appwriteAccount = null;
let appwriteDatabases = null;
let appwriteStorage = null;
let appwriteQuery = null;
let appwriteId = null;

async function loadAppwriteBrowser() {
  if (!appwriteClient) {
    const appwriteModule = await import("./appwrite-client.js");
    appwriteClient = appwriteModule.appwriteClient;
    appwriteAccount = appwriteModule.account;
    appwriteDatabases = appwriteModule.databases;
    appwriteStorage = appwriteModule.storage;
    appwriteQuery = appwriteModule.Query;
    appwriteId = appwriteModule.ID;
  }
  return { client: appwriteClient, account: appwriteAccount, databases: appwriteDatabases, storage: appwriteStorage, Query: appwriteQuery, ID: appwriteId };
}

async function loadAppwriteDeno(useApiKey = true, jwt = null) {
  const { Client, Account, Databases, Query, ID } = await import("npm:node-appwrite@14.0.0");
  const client = new Client()
    .setEndpoint(appwriteEndpoint)
    .setProject(appwriteProjectId);
  if (useApiKey && appwriteApiKey) {
    client.setKey(appwriteApiKey);
  }
  if (jwt) {
    client.setJWT(jwt);
  }
  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    Query,
    ID,
  };
}

/**
 * Get Appwrite Databases + Query + ID for entity operations.
 * In Deno: always uses API key (admin) - token validation is separate in me().
 * In Browser: uses session (user-scoped) or API key if useServiceRole.
 */
async function getAppwriteForEntity(useServiceRole = false) {
  if (isDeno) {
    return loadAppwriteDeno(true, null);
  }
  // Browser: Client SDK has no setKey() - that's server-only. Always use user-scoped client.
  // Collection permissions must allow users to read their own docs.
  return loadAppwriteBrowser();
}

// Request-scoped auth token for Deno
let currentRequestAuthToken = null;

export function setRequestAuthToken(token) {
  if (isDeno) {
    currentRequestAuthToken = token;
  }
}

function getRequestAuthToken() {
  return isDeno ? currentRequestAuthToken : null;
}

export function clearRequestAuthToken() {
  if (isDeno) {
    currentRequestAuthToken = null;
  }
}

// Field mapping (same as Supabase SDK)
const fieldNameToOriginalByTable = new Map();

function getFieldNameToOriginalByTable(tableName) {
  return fieldNameToOriginalByTable.get(tableName) || {};
}

function setFieldNameToOriginalByTable(tableName, fieldNameToOriginal) {
  fieldNameToOriginalByTable.set(tableName, fieldNameToOriginal);
}

/** Map collection/table name to entity name (order -> Order). Used for automation entity events. */
function tableNameToEntityName(tableName) {
  if (!tableName || typeof tableName !== "string") return "";
  return tableName
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
}

/** Config for firing entity events to /onEntityEvent after create/update/delete (Appwrite has no DB triggers). */
let entityEventConfig = null;

export function setEntityEventConfig(config) {
  entityEventConfig = config;
}

function fireEntityEventIfEnabled(entityName, eventType, data, oldData = null) {
  const base = entityEventConfig?.functionsBaseUrl;
  if (!entityEventConfig?.fireEntityEventOnMutation || !base) return;
  const path = entityEventConfig?.onEntityEventPath || "/onEntityFnTrigger";
  const url = `${base.replace(/\/$/, "")}${path}`;
  const payload = JSON.stringify({
    entity_name: entityName,
    event_type: eventType,
    data: data ?? null,
    old_data: oldData ?? null,
  });
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  }).catch((err) => console.warn("[Automation] onEntityEvent fire failed:", err.message));
}

/**
 * Build Supabase-compatible user from Appwrite auth user (for when users collection is unavailable)
 */
function authUserToUser(authUser) {
  if (!authUser || !authUser.$id) return null;
  const role = authUser.email === "dev@localhost.com" ? "admin" : "user";
  return {
    id: authUser.$id,
    email: authUser.email,
    full_name: authUser.name || authUser.email,
    role,
    user_metadata: { role },
  };
}

/**
 * Map Appwrite document to our API format.
 * Appwrite: $id, $createdAt, $updatedAt -> id, created_at, updated_at
 */
function appwriteDocToResult(doc, tableName) {
  if (!doc) return null;
  const result = { ...doc };
  if (result.$id !== undefined) {
    result.id = result.$id;
    delete result.$id;
  }
  if (result.$createdAt !== undefined) {
    result.created_at = result.$createdAt;
    delete result.$createdAt;
  }
  if (result.$updatedAt !== undefined) {
    result.updated_at = result.$updatedAt;
    delete result.$updatedAt;
  }
  if (result.$permissions !== undefined) delete result.$permissions;
  if (result.$collectionId !== undefined) delete result.$collectionId;
  if (result.$databaseId !== undefined) delete result.$databaseId;

  // Apply reverse field mapping (db column -> client field name)
  const reverseFieldMappings = {
    created_at: "created_date",
    updated_at: "updated_date",
    created_by_id: "created_by_id",
    created_by: "created_by",
  };
  const mapObject = (obj) => {
    const mapped = {};
    for (const [key, value] of Object.entries(obj)) {
      const mappedKey =
        key in reverseFieldMappings
          ? reverseFieldMappings[key]
          : getFieldNameToOriginalByTable(tableName)[key] ?? key;
      mapped[mappedKey] = value;
    }
    return mapped;
  };
  return mapObject(result);
}

function mapResultFields(data, tableName) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map((d) => appwriteDocToResult(d, tableName));
  }
  return appwriteDocToResult(data, tableName);
}


function inferType(value) {
  if (value === null || value === undefined) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "float";
  if (typeof value === "string") {
    // naive ISO datetime check
    const d = new Date(value);
    if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value)) return "datetime";
    return "string";
  }
  // arrays / objects
  return "json-string";
}

async function ensureAttribute(db, databaseId, collectionId, key, sampleValue) {
  const t = inferType(sampleValue);

  // IMPORTANT: Appwrite attribute keys must match naming rules; sanitize if needed.
  // Also: choose sizes sensibly for strings.
  if (t === "boolean") {
    await db.createBooleanAttribute(databaseId, collectionId, key, false);
    return;
  }
  if (t === "integer") {
    // min/max optional; keep broad if unknown
    await db.createIntegerAttribute(databaseId, collectionId, key, false);
    return;
  }
  if (t === "float") {
    await db.createFloatAttribute(databaseId, collectionId, key, false);
    return;
  }
  if (t === "datetime") {
    await db.createDatetimeAttribute(databaseId, collectionId, key, false);
    return;
  }

  // string or json-string
  // Store objects/arrays as JSON string
  await db.createStringAttribute(databaseId, collectionId, key, 65535, false);
}

async function listAttributeKeys(db,databaseId, collectionId){
  const res = await db.listAttributes(databaseId, collectionId);
  return new Set(res.attributes.map((a) => a.key));
}

function splitUnknowns(payload, allowed) {
  const unknown= {};
  for (const [k, v] of Object.entries(payload)) {
    if (!allowed.has(k)) unknown[k] = v;
  }
  return unknown;
}

function normalizePayload(payload, allowed) {
  // Convert object/array values to JSON strings *only for fields that exist and are string attributes*
  // (If you don’t want filtering, you still need normalization for json-string inferred fields.)
  // For now, stringify object/array always to avoid schema/type mismatch.
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "object" && v !== null) out[k] = JSON.stringify(v);
    else out[k] = v;
  }
  return out;
}

async function createDocWithAutoSchema(
  db,
  databaseId,
  collectionId,
  documentId,
  payload,
  maxNewAttributesPerRequest = 20
) {
  // 1) Get current schema
  let allowed = await listAttributeKeys(db, databaseId, collectionId);

  // 2) Create missing attrs (based on current payload) BEFORE insert
  const unknown = splitUnknowns(payload, allowed);
  const unknownKeys = Object.keys(unknown).slice(0, maxNewAttributesPerRequest);

  for (const key of unknownKeys) {
    // Double-check in case of races
    if (!allowed.has(key)) {
      await ensureAttribute(db, databaseId, collectionId, key, unknown[key]);
      allowed.add(key);
    }
  }

  // 3) Small delay because attributes can take a moment to become active
  // (You can replace with polling listAttributes until present.)
  if (unknownKeys.length) await new Promise(r => setTimeout(r, 800));

  // 4) Insert
  const normalized = normalizePayload(payload, allowed);
  return db.createDocument(databaseId, collectionId, documentId, normalized);
}
/**
 * Base Entity class - Appwrite-backed CRUD
 */
export class UnifiedEntity {
  constructor(tableName, useServiceRole = false) {
    this.tableName = tableName;
    this.collectionId = tableName; // Appwrite collection ID = table name
    this.useServiceRole = useServiceRole;
    this._appwrite = null;
  }

  async getAppwrite() {
    if (!this._appwrite) {
      this._appwrite = await getAppwriteForEntity(this.useServiceRole);
    }
    return this._appwrite;
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
    if (fieldMappings[field]) return fieldMappings[field];
    const s1 = field.replace(/(.)([A-Z][a-z]+)/g, "$1_$2");
    const s2 = s1.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
    const s3 = s2.replace(/-/g, "_").replace(/\s+/g, "_");
    return s3.toLowerCase();
  }

  mapDataFields(data) {
    if (!data || typeof data !== "object") return data;
    const mapped = {};
    Object.entries(data).forEach(([key, value]) => {
      mapped[this.mapFieldName(key)] = value;
    });
    return mapped;
  }

  mapResultFields(data) {
    return mapResultFields(data, this.tableName);
  }

  async list(orderBy = "created_at", limit = null) {
    const { databases, Query } = await this.getAppwrite();
    const queries = [];
    if (orderBy) {
      const field = this.mapFieldName(orderBy.startsWith("-") ? orderBy.substring(1) : orderBy);
      if (orderBy.startsWith("-")) {
        queries.push(Query.orderDesc(field));
      } else {
        queries.push(Query.orderAsc(field));
      }
    }
    if (limit) queries.push(Query.limit(limit));

    try {
      const response = await databases.listDocuments(
        appwriteDatabaseId,
        this.collectionId,
        queries.length ? queries : undefined
      );
      const docs = response.documents || [];
      return this.mapResultFields(docs);
    } catch (error) {
      if (error.code === 404 || error.message?.includes("Collection") || error.message?.includes("not found")) {
        console.warn(`Collection ${this.collectionId} does not exist, returning empty array`);
        return [];
      }
      throw error;
    }
  }

  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    const { databases, Query } = await this.getAppwrite();
    const queries = [];

    Object.entries(conditions).forEach(([key, value]) => {
      const mappedKey = this.mapFieldName(key);
      if (Array.isArray(value)) {
        queries.push(Query.in(mappedKey, value));
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.entries(value).forEach(([operator, operand]) => {
          switch (operator) {
            case "$in":
              queries.push(Query.in(mappedKey, operand));
              break;
            case "$ne":
              queries.push(Query.notEqual(mappedKey, operand));
              break;
            case "$exists":
              if (operand) {
                queries.push(Query.isNotNull(mappedKey));
              } else {
                queries.push(Query.isNull(mappedKey));
              }
              break;
            default:
              queries.push(Query.equal(mappedKey, operand));
          }
        });
      } else {
        queries.push(Query.equal(mappedKey, value));
      }
    });

    if (orderBy) {
      const field = this.mapFieldName(orderBy.startsWith("-") ? orderBy.substring(1) : orderBy);
      queries.push(orderBy.startsWith("-") ? Query.orderDesc(field) : Query.orderAsc(field));
    }
    if (limit) queries.push(Query.limit(limit));

    try {
      const response = await databases.listDocuments(
        appwriteDatabaseId,
        this.collectionId,
        queries
      );
      const docs = response.documents || [];
      return this.mapResultFields(docs);
    } catch (error) {
      if (error.code === 404 || error.message?.includes("Collection") || error.message?.includes("not found")) {
        console.warn(`Collection ${this.collectionId} does not exist, returning empty array`);
        return [];
      }
      throw error;
    }
  }

  async get(id) {
    const { databases } = await this.getAppwrite();
    try {
      const doc = await databases.getDocument(
        appwriteDatabaseId,
        this.collectionId,
        id
      );
      return this.mapResultFields(doc);
    } catch (error) {
      if (error.code === 404 || error.message?.includes("not found")) {
        return null;
      }
      throw error;
    }
  }

  async create(data) {
    const { databases, ID } = await this.getAppwrite();
    const mappedData = this.mapDataFields(data);

    // Add created_by if in browser and we have user
    if (isBrowser && !this.useServiceRole) {
      try {
        const { account } = await getAppwriteForEntity(false);
        const user = await account.get();
        if (user) {
          mappedData.created_by_id = user.$id;
          mappedData.created_by = user.email;
        }
      } catch {
        // Ignore auth errors
      }
    }

    const docId = mappedData.id || ID.unique();
    if (mappedData.id) delete mappedData.id;

    const doc = await createDocWithAutoSchema(
      databases,
      appwriteDatabaseId,
      this.collectionId,
      docId,
      mappedData
    );
    const result = this.mapResultFields(doc);
    fireEntityEventIfEnabled(tableNameToEntityName(this.collectionId), "create", result, null);
    return result;
  }

  async update(id, data) {
    const { databases } = await this.getAppwrite();
    const mappedData = this.mapDataFields(data);
    delete mappedData.id;
    mappedData.updated_at = new Date().toISOString();

    try {
      const doc = await databases.updateDocument(
        appwriteDatabaseId,
        this.collectionId,
        id,
        mappedData
      );
      const result = this.mapResultFields(doc);
      fireEntityEventIfEnabled(tableNameToEntityName(this.collectionId), "update", result, null);
      return result;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async delete(id) {
    const { databases } = await this.getAppwrite();
    await databases.deleteDocument(
      appwriteDatabaseId,
      this.collectionId,
      id
    );
    fireEntityEventIfEnabled(tableNameToEntityName(this.collectionId), "delete", { id }, null);
  }
}

const USERS_TABLE_NAME = "users";

/**
 * User Entity with Appwrite Account auth
 */
export class UnifiedUserEntity extends UnifiedEntity {
  constructor() {
    super(USERS_TABLE_NAME, true);
  }

  async me() {
    if (isDeno) {
      const accessToken = getRequestAuthToken();
      if (!accessToken) {
        return {
          id: "service-user",
          email: "service@ownmy.app",
          role: "admin",
        };
      }

      try {
        const { account, databases, ID } = await loadAppwriteDeno(false, accessToken);
        const authUser = await account.get();

        if (!authUser || !authUser.$id) {
          console.warn("Deno: Invalid user from token");
          return { id: "service-user", email: "service@ownmy.app", role: "admin" };
        }

        const { databases: adminDb } = await loadAppwriteDeno(true);
        let doc;
        try {
          doc = await adminDb.getDocument(
            appwriteDatabaseId,
            USERS_TABLE_NAME,
            authUser.$id
          );
        } catch {
          doc = null;
        }

        if (!doc) {
          const newUser = {
            email: authUser.email,
            full_name: authUser.name || authUser.email,
            role: authUser.email === "dev@localhost.com" ? "admin" : "user",
          };
          try {
            const created = await createDocWithAutoSchema(
              adminDb,
              appwriteDatabaseId,
              USERS_TABLE_NAME,
              authUser.$id,
              newUser
            );
            return this.mapResultFields(created);
          } catch (createError) {
            console.error("Error creating user:", createError);
            return this.mapResultFields({ $id: authUser.$id, ...newUser });
          }
        }
        return this.mapResultFields(doc);
      } catch (error) {
        console.error("Error in Deno me():", error);
        return { id: "service-user", email: "service@ownmy.app", role: "admin" };
      }
    }

    // Browser - same pattern as Supabase: auth from user client (session), DB from admin client
    try {
      const { account } = await loadAppwriteBrowser();
      const authUser = await account.get();
      if (!authUser || !authUser.$id) throw new Error("Not authenticated");

      const { databases } = await getAppwriteForEntity(true);
      let doc;
      try {
        doc = await databases.getDocument(
          appwriteDatabaseId,
          USERS_TABLE_NAME,
          authUser.$id
        );
      } catch (dbErr) {
        doc = null;
      }

      if (!doc) {
        const newUser = {
          email: authUser.email,
          full_name: authUser.name || authUser.email,
          role: authUser.email === "dev@localhost.com" ? "admin" : "user",
        };
        try {
          const created = await createDocWithAutoSchema(
            databases,
            appwriteDatabaseId,
            USERS_TABLE_NAME,
            authUser.$id,
            newUser
          );
          const mapped = this.mapResultFields(created);
          return { ...mapped, user_metadata: { role: mapped.role ?? newUser.role } };
        } catch (createErr) {
          return authUserToUser(authUser);
        }
      }

      if (authUser.email === "dev@localhost.com" && doc.role !== "admin") {
        try {
          const updated = await databases.updateDocument(
            appwriteDatabaseId,
            USERS_TABLE_NAME,
            authUser.$id,
            { role: "admin" }
          );
          const mapped = this.mapResultFields(updated);
          return { ...mapped, user_metadata: { role: "admin" } };
        } catch {
          return this.mapResultFields(doc);
        }
      }
      const mapped = this.mapResultFields(doc);
      return { ...mapped, user_metadata: { role: mapped.role ?? doc.role } };
    } catch (error) {
      if (
        error.code === 401 ||
        error.message?.includes("Unauthorized") ||
        error.message === "Not authenticated"
      ) {
        throw new Error("Not authenticated");
      }
      throw error;
    }
  }

  async get(id) {
    const { databases } = await this.getAppwrite();
    try {
      const doc = await databases.getDocument(
        appwriteDatabaseId,
        USERS_TABLE_NAME,
        id
      );
      return this.mapResultFields(doc);
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateMyUserData(userData) {
    if (!isBrowser) throw new Error("updateMyUserData is only available in browser");
    const { account } = await loadAppwriteBrowser();
    if (!authUser) throw new Error("Not authenticated");
    const { databases } = await getAppwriteForEntity(true);
    const updated = await databases.updateDocument(
      appwriteDatabaseId,
      USERS_TABLE_NAME,
      authUser.$id,
      { ...userData, updated_at: new Date().toISOString() }
    );
    return this.mapResultFields(updated);
  }

  async login(provider = "dev", devEmail = "dev@localhost.com", devPassword = "dev123456") {
    if (!isBrowser) throw new Error("login is only available in browser");

    const { account, ID } = await loadAppwriteBrowser();

    if (provider === "dev" || provider === "email") {
      // Supabase-compatible: check if already authenticated first.
      // Appwrite blocks creating a session when one exists; Supabase allows signInWithPassword regardless.
      try {
        const currentUser = await account.get();
        if (currentUser) {
          window.location.reload();
          return;
        }
      } catch {
        // No session - proceed to create one
      }

      try {
        await account.createEmailPasswordSession(devEmail, devPassword);
      } catch (signInError) {
        if (signInError.code === 401 && signInError.type === "user_session_already_exists") {
          window.location.reload();
          return;
        }
        // User may not exist, try sign up
        try {
          await account.create(ID.unique(), devEmail, devPassword, provider === "dev" ? "Development User" : devEmail);
          await account.createEmailPasswordSession(devEmail, devPassword);
        } catch (signUpError) {
          if (signUpError.code === 409) {
            await account.createEmailPasswordSession(devEmail, devPassword);
          } else {
            throw signUpError;
          }
        }
      }
      window.location.reload();
      return;
    }

    throw new Error(`OAuth provider "${provider}" - configure Appwrite OAuth and use account.createOAuth2Token()`);
  }

  async signUp(provider = "email", devEmail = "dev@localhost.com", devPassword = "dev123456", name = "Development User") {
    if (!isBrowser) throw new Error("signUp is only available in browser");

    const { account, ID } = await loadAppwriteBrowser();

    if (provider === "email") {
      // Supabase-compatible: if already authenticated, treat as success
      try {
        const currentUser = await account.get();
        if (currentUser) {
          window.location.reload();
          return;
        }
      } catch {
        // No session - proceed
      }

      try {
        await account.create(ID.unique(), devEmail, devPassword, name);
        await account.createEmailPasswordSession(devEmail, devPassword);
      } catch (error) {
        if (error.code === 409) {
          await account.createEmailPasswordSession(devEmail, devPassword);
        } else if (error.code === 401 && error.type === "user_session_already_exists") {
          window.location.reload();
          return;
        } else {
          throw error;
        }
      }
      window.location.reload();
      return;
    }

    throw new Error(`OAuth provider "${provider}" - configure Appwrite OAuth`);
  }

  async logout() {
    if (!isBrowser) throw new Error("logout is only available in browser");
    const { account } = await loadAppwriteBrowser();
    await account.deleteSession("current");
  }

  async isAuthenticated() {
    if (!isBrowser) return getRequestAuthToken() !== null;

    try {
      const { account } = await loadAppwriteBrowser();
      const user = await account.get();
      return !!user;
    } catch {
      return false;
    }
  }

  async getCurrentUser() {
    try {
      return await this.me();
    } catch (error) {
      if (error.message === "Not authenticated") return null;
      throw error;
    }
  }

  redirectToLogin(redirectUrl = null) {
    if (!isBrowser) throw new Error("redirectToLogin is only available in browser");
    if (redirectUrl) {
      sessionStorage.setItem("redirectAfterLogin", redirectUrl);
    } else {
      sessionStorage.setItem("redirectAfterLogin", window.location.href);
    }
    window.location.href = "/returnlogin";
  }

  async list(orderBy = "created_at", limit = null) {
    return super.list(orderBy, limit);
  }

  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    return super.filter(conditions, orderBy, limit);
  }
}

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

function loadEntitySchemasFromPath(entitiesPath) {
  if (!isDeno || !entitiesPath) return {};
  const schemas = {};
  try {
    for (const entry of Deno.readDirSync(entitiesPath)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const entityName = entry.name.replace(/\.json$/i, "");
        const fullPath = entitiesPath.endsWith("/") ? entitiesPath + entry.name : entitiesPath + "/" + entry.name;
        const content = Deno.readTextFileSync(fullPath);
        const schema = JSON.parse(content);
        if (schema?.properties) schemas[entityName] = schema;
      }
    }
  } catch (err) {
    if (isDeno) console.warn("Could not load entity schemas:", entitiesPath, err.message);
  }
  return schemas;
}

function loadFieldMapsFromEntitySchemas(entitySchemas) {
  if (!entitySchemas || typeof entitySchemas !== "object") return;
  const fieldMappings = {
    created_date: "created_at",
    updated_date: "updated_at",
    created_by_id: "created_by_id",
    created_by: "created_by",
  };
  for (const [entityName, schema] of Object.entries(entitySchemas)) {
    if (!schema?.properties) continue;
    const tableName = entityNameToTableName(entityName);
    const map = {};
    for (const fieldName of Object.keys(schema.properties)) {
      const dbColumn = fieldMappings[fieldName]
        ? fieldMappings[fieldName]
        : fieldName
            .replace(/(.)([A-Z][a-z]+)/g, "$1_$2")
            .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
            .replace(/-/g, "_")
            .replace(/\s+/g, "_")
            .toLowerCase();
      map[dbColumn] = fieldName;
    }
    setFieldNameToOriginalByTable(tableName, map);
  }
}

function shouldUseServiceRole(entityName) {
  if (isDeno) return !getRequestAuthToken();
  const serviceRoleEntities = [
    "user", "transaction", "usermembership", "payment", "order",
    "subscription", "admin", "audit", "log",
  ];
  return serviceRoleEntities.some((p) => entityName.toLowerCase().includes(p));
}

function createEntitiesProxy(forceServiceRole = false) {
  const entityCache = new Map();
  return new Proxy(
    {},
    {
      get(_, entityName) {
        if (typeof entityName !== "string") return undefined;
        if (["inspect", "valueOf", "toString"].includes(entityName)) return undefined;
        if (entityCache.has(entityName)) return entityCache.get(entityName);
        const tableName = entityNameToTableName(entityName);
        const useServiceRole = forceServiceRole || shouldUseServiceRole(entityName);
        const entity = new UnifiedEntity(tableName, useServiceRole);
        entityCache.set(entityName, entity);
        return entity;
      },
      has(_, entityName) {
        return typeof entityName === "string" && !["inspect", "valueOf", "toString"].includes(entityName);
      },
      ownKeys() {
        return Array.from(entityCache.keys());
      },
      getOwnPropertyDescriptor(_, entityName) {
        if (typeof entityName === "string" && !["inspect", "valueOf", "toString"].includes(entityName)) {
          return { enumerable: true, configurable: true };
        }
        return undefined;
      },
    }
  );
}

export function createClientFromRequest(request, options = {}) {
  if (!isDeno) throw new Error("createClientFromRequest can only be used in Deno environment");

  const authHeader = request.headers.get("Authorization");
  let userToken = null;
  if (authHeader?.startsWith("Bearer ") && authHeader.split(" ").length === 2) {
    userToken = authHeader.split(" ")[1];
  }
  if (userToken) setRequestAuthToken(userToken);

  const finalOptions = {
    functionsBaseUrl: options.functionsBaseUrl || getEnvVar("VITE_FUNCTION_URL", FUNCTIONS_BASE_URL),
    functions: options.functions || {},
    ...options,
  };
  return createUnifiedClient(finalOptions);
}

async function getAuthToken() {
  if (!isBrowser) return getRequestAuthToken();
  try {
    const { account } = await loadAppwriteBrowser();
    // Appwrite: createJWT() returns a JWT string for passing to backend
    if (typeof account.createJWT === "function") {
      const jwt = await account.createJWT();
      return jwt?.jwt ?? jwt ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function createUnifiedClient(options = {}) {
  const {
    functions: customFunctions = {},
    functionsBaseUrl = FUNCTIONS_BASE_URL,
    token: explicitToken = null,
    entitiesPath = null,
    entitySchemas = null,
    fireEntityEventOnMutation = false,
  } = options;

  if (functionsBaseUrl && fireEntityEventOnMutation) {
    setEntityEventConfig({ functionsBaseUrl, fireEntityEventOnMutation: true });
  }

  if (entitySchemas && typeof entitySchemas === "object") {
    loadFieldMapsFromEntitySchemas(entitySchemas);
  } else if (entitiesPath && isDeno) {
    loadFieldMapsFromEntitySchemas(loadEntitySchemasFromPath(entitiesPath));
  }
  if (isDeno && explicitToken) setRequestAuthToken(explicitToken);

  const functions = {
    invoke: async (functionName, payload) => {
      const headers = { "Content-Type": "application/json" };
      const token = await getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      return response.json();
    },
  };

  Object.entries(customFunctions).forEach(([name, path]) => {
    functions[name] = async (payload) => {
      const headers = { "Content-Type": "application/json" };
      const token = await getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch(`${functionsBaseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Function ${name} failed: ${response.statusText}`);
      return response.json();
    };
  });

  const integrationsModule = {
    Core: {
      InvokeLLM: async ({ prompt, add_context_from_internet = false, response_json_schema = null, file_urls = null }) => {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/ai/invoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, add_context_from_internet, response_json_schema, file_urls }),
        });
        if (!response.ok) throw new Error(`LLM invocation failed: ${response.statusText}`);
        const data = await response.json();
        return response_json_schema ? data.data?.message : data.response ?? data;
      },
      SendEmail: async ({ to, subject, body, from_name = "Peace Adventures", from_email = null, provider = "resend" }) => {
        const response = await fetch(`/api/send-raw-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, body, from_name, from_email }),
        });
        if (!response.ok) throw new Error(`Email sending failed: ${response.statusText}`);
        return response.json();
      },
      UploadFile: async ({ file }) => {
        if (!isBrowser) throw new Error("UploadFile is only available in browser");
        const bucketId = getEnvVar("VITE_APPWRITE_BUCKET_ID", getEnvVar("APPWRITE_BUCKET_ID", "uploads"));
        const { storage, ID } = await loadAppwriteBrowser();
        const fileName = `${Date.now()}_${file?.name || "file"}`;
        const fileId = ID.unique();
        await storage.createFile(bucketId, fileId, file);
        const base = appwriteEndpoint.replace(/\/?$/, "");
        const fileUrl = `${base}/storage/buckets/${bucketId}/files/${fileId}/view?project=${appwriteProjectId}`;
        return { file_url: fileUrl };
      },
      GenerateImage: async ({ prompt }) => {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/ai/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!response.ok) throw new Error(`Image generation failed: ${response.statusText}`);
        return response.json();
      },
      OCRFile: async ({ file_url, json_schema }) => {
        let finalFileUrl = file_url;
        if (file_url && !file_url.startsWith("http")) {
          const bucketId = getEnvVar("VITE_APPWRITE_BUCKET_ID", getEnvVar("APPWRITE_BUCKET_ID", "uploads"));
          const base = appwriteEndpoint.replace(/\/?$/, "");
          const pathPart = file_url.replace(/^uploads\/?/, "");
          finalFileUrl = `${base}/storage/buckets/${bucketId}/files/${pathPart}/view?project=${appwriteProjectId}`;
        }
        const response = await fetch(`${FUNCTIONS_BASE_URL}/extract_file`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_url: finalFileUrl, file_format: "pdf" }),
        });
        if (!response.ok) throw new Error(`Data extraction failed: ${response.statusText}`);
        const data = await response.json();
        return json_schema ? (data.data?.message ?? data) : data;
      },
      ExtractDataFromUploadedFile: async ({ file_url, json_schema }) => {
        return { status: "success", details: null, output: json_schema?.type === "array" ? [] : {} };
      },
    },
  };

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
