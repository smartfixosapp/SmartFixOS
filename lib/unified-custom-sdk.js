// Unified Custom SDK for both Browser and Deno environments
// Detects environment and handles Supabase operations accordingly
// This is the merged version of custom-sdk.js and unified-custom-sdk.js

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

// Configuration
const supabaseUrl = getEnvVar("VITE_SUPABASE_URL", "http://localhost:8000");
const supabaseAnonKey = getEnvVar(
  "VITE_SUPABASE_ANON_KEY", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJMcpNJV12fYQA8LGm8MQvOG0R2jCFPe0"
);
const supabaseServiceKey = getEnvVar(
  "SUPABASE_SERVICE_ROLE_KEY",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"
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
const API_BASE_URL = getEnvVar("VITE_API_URL", "http://localhost:4500")
// Functions base URL - single server approach
const FUNCTIONS_BASE_URL = getEnvVar("VITE_FUNCTION_URL", "http://localhost:8585");

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
  
  if (isDeno && accessToken && !useServiceRole) {
    // Use the provided access token to create a user-scoped client
    key = supabaseAnonKey; // Use anon key, but with the user's token
    actualUseServiceRole = false;
  }
  
  const options = actualUseServiceRole ? {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: dbSchema,
    },
  } : {
    auth: {
      autoRefreshToken: !isDeno, // Don't auto-refresh in Deno (no session storage)
      persistSession: !isDeno, // Don't persist in Deno
    },
    db: {
      schema: dbSchema,
    },
  };

  if (isDeno) {
    console.log(`🔧 Using database schema: ${dbSchema}`);
    // Note: accessToken is no longer used here - token validation happens in UnifiedUserEntity.me()
  }

  const client = createClient(supabaseUrl, key, options);
  
  // Note: We don't set the session here anymore when we have an accessToken
  // Instead, token validation happens in UnifiedUserEntity.me() via REST API
  // and we use service role client for database operations after validation
  // This avoids the "Auth session missing!" error from setSession()
  
  // Test the connection
  if (isDeno && useServiceRole) {
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
  }
  
  return client;
}

const fieldNameToOriginalByTable = new Map();
console.log("🦕 fieldNameToOriginalByTable", fieldNameToOriginalByTable);
function getFieldNameToOriginalByTable(tableName) {
  return fieldNameToOriginalByTable.get(tableName) || {};
}
function setFieldNameToOriginalByTable(tableName, fieldNameToOriginal) {
  fieldNameToOriginalByTable.set(tableName, fieldNameToOriginal);
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

  async getClient() {
    // In Deno, even if we have a token, we use service role for database operations
    // Token validation happens separately in UnifiedUserEntity.me() via REST API
    // This avoids session-related errors
    if (isDeno) {
      // Always use service role in Deno for database operations
      // The token is validated separately and we know the user is authenticated
      if (!this._client) {
        console.log(`🔧 Initializing Supabase client for ${this.tableName} (serviceRole: true in Deno)`);
        this._client = await initializeSupabaseClient(true, null); // Always use service role in Deno
        this._cachedToken = null;
      }
      return this._client;
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
      // Fallback to creating a new client
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

  async list(orderBy = "created_at", limit = null) {
    const client = await this.getClient();
    let query = client.from(this.tableName).select("*");

    if (orderBy) {
      if (orderBy.startsWith("-")) {
        const field = this.mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = this.mapFieldName(orderBy);
        query = query.order(field, { ascending: true });
      }
    }

    if (limit) {
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

  async filter(conditions = {}, orderBy = "created_at", limit = null) {
    const client = await this.getClient();
    let query = client.from(this.tableName).select("*");

    Object.entries(conditions).forEach(([key, value]) => {
      const mappedKey = this.mapFieldName(key);
      if (Array.isArray(value)) {
        query = query.in(mappedKey, value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([operator, operand]) => {
          switch (operator) {
            case '$in':
              query = query.in(mappedKey, operand);
              break;
            case '$ne':
              if (Array.isArray(operand) && operand.length === 0) {
                query = query.not(mappedKey, 'eq', '[]');
              } else {
                query = query.neq(mappedKey, operand);
              }
              break;
            case '$exists':
              if (operand) {
                query = query.not(mappedKey, 'is', null);
              } else {
                query = query.is(mappedKey, null);
              }
              break;
            default:
              console.warn(`Unsupported operator "${operator}" in filter. Treating as equality.`);
              query = query.eq(mappedKey, value);
              break;
          }
        });
      } else {
        query = query.eq(mappedKey, value);
      }
    });

    if (orderBy) {
      if (orderBy.startsWith("-")) {
        const field = this.mapFieldName(orderBy.substring(1));
        query = query.order(field, { ascending: false });
      } else {
        const field = this.mapFieldName(orderBy);
        query = query.order(field, { ascending: true });
      }
    }

    if (limit) {
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
      if (isDeno) {
        console.log(`🔧 Getting record from ${this.tableName} with id: ${id}`);
      }
      
      const client = await this.getClient();
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        if (isDeno) {
          console.error(`❌ Database error for ${this.tableName}.get(${id}):`, error);
        }
        
        if (error.code === "PGRST205" && error.message.includes("Could not find the table")) {
          console.warn(`Table ${this.tableName} does not exist, returning null`);
          return null;
        }
        throw error;
      }

      if (isDeno) {
        console.log(`✅ Retrieved record from ${this.tableName}:`, data ? 'found' : 'not found');
      }

      return data ? this.mapResultFields(data) : null;
    } catch (error) {
      if (isDeno) {
        console.error(`💥 Exception in ${this.tableName}.get(${id}):`, error.message);
      }
      throw error;
    }
  }

  async create(data) {
    const client = await this.getClient();
    const mappedData = this.mapDataFields(data);

    // Add user info if in browser environment and not using service role
    if (isBrowser && !this.useServiceRole) {
      try {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          mappedData['created_by_id'] = user.id;
          mappedData['created_by'] = user.email;
        }
      } catch {
        // Ignore auth errors in create
      }
    }

    const { data: result, error } = await client
      .from(this.tableName)
      .insert(mappedData)
      .select()
      .single();

    if (error) {
      throw error;
    }
    return this.mapResultFields(result);
  }

  async update(id, data) {
    const client = await this.getClient();
    const mappedData = this.mapDataFields(data);
    mappedData.updated_at = new Date().toISOString();

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
    const { error } = await client
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
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
      
      if (!accessToken) {
        // No token provided, return service user (fallback)
        await this.getClient();
        console.log("🔧 Deno: No auth token, using service user");
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
        console.log(`🔧 Deno: Validating token with Supabase at ${cleanSupabaseUrl}/auth/v1/user`);
        
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
          console.warn("🔧 Deno: Token validation failed:", userResponse.status, errorData);
          console.warn(`🔧 Deno: Supabase URL: ${supabaseUrl}, Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
          return {
            id: "service-user",
            email: "service@ownmy.app",
            role: "admin"
          };
        }
        
        const authUser = await userResponse.json();
        
        if (!authUser || !authUser.id) {
          console.warn("🔧 Deno: Invalid user data from token:", authUser);
          return {
            id: "service-user",
            email: "service@ownmy.app",
            role: "admin"
          };
        }
        
        console.log(`🔧 Deno: Token validated successfully, user: ${authUser.email} (${authUser.id})`);
        
        // Use service role client for database operations since we've already validated the token
        // This avoids the setSession() issue and we know the user is authenticated
        const client = await initializeSupabaseClient(true); // Use service role for DB queries
        
        // Get user from database using service role (bypasses RLS)
        const { data, error } = await client
          .from(USERS_TABLE_NAME)
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();
        
        if (error) {
          console.error("Error fetching user:", error);
          // Fallback to service user on error
          return {
            id: "service-user",
            email: "service@ownmy.app",
            role: "admin"
          };
        }
        
        // If user doesn't exist in users table, create from auth user
        if (!data) {
          const newUser = {
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email,
            role: authUser.email === "dev@localhost.com" ? "admin" : "user",
          };
          
          // Use the same service role client to create user
          const { data: createdUser, error: createError } = await client
            .from(USERS_TABLE_NAME)
            .insert(newUser)
            .select()
            .single();
          
          if (createError) {
            console.error("Error creating user:", createError);
            return this.mapResultFields(newUser); // Return what we have
          }
          return this.mapResultFields(createdUser);
        }
        
        return this.mapResultFields(data);
      } catch (error) {
        console.error("Error in Deno me():", error);
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

      // Use service role client for database operations to bypass RLS
      const client = await this.getClient();
      const { data, error } = await client
        .from(USERS_TABLE_NAME)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user:", error);
        throw error;
      }

      // If user doesn't exist in users table, create from auth user
      if (!data) {
        const newUser = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          role: user.email === "dev@localhost.com" ? "admin" : "user",
        };

        const { data: createdUser, error: createError } = await client
          .from(USERS_TABLE_NAME)
          .insert(newUser)
          .select()
          .single();

        if (createError) {
          console.error("Error creating user:", createError);
          throw createError;
        }
        return this.mapResultFields(createdUser);
      }

      // Ensure dev user is always an admin
      if (user.email === "dev@localhost.com" && data.role !== "admin") {
        const { data: updatedUser, error: updateError } = await client
          .from(USERS_TABLE_NAME)
          .update({ role: "admin" })
          .eq("id", user.id)
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
      .eq("id", user.id)
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
  async login(provider = "dev", devEmail = "dev@localhost.com", devPassword = "dev123456") {
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
        window.location.reload();
      } catch (error) {
        console.error("Email login failed:", error);
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
  async logout() {
    if (!isBrowser) {
      throw new Error("logout is only available in browser environment");
    }
    
    const browserSupabase = await getSupabaseClient();
    if (!browserSupabase) {
      throw new Error("Could not initialize Supabase client");
    }
    
    const { error } = await browserSupabase.auth.signOut();
    if (error) throw error;
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
    
    // Store the redirect URL in sessionStorage
    if (redirectUrl) {
      sessionStorage.setItem("redirectAfterLogin", redirectUrl);
    } else {
      // If no redirect URL provided, use current URL
      sessionStorage.setItem("redirectAfterLogin", window.location.href);
    }
    // Redirect to returnlogin page
    window.location.href = "/returnlogin";
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
 * @param {string} entitiesPath - Path to Entities folder (e.g. path to dir containing AwsStatus.json, ...)
 * @returns {Record<string, { name?: string, properties: Record<string, unknown> }>}
 */
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
        if (schema && typeof schema === "object" && schema.properties) {
          schemas[entityName] = schema;
        }
      }
    }
  } catch (err) {
    if (isDeno) console.warn("⚠️ Could not load entity schemas from path:", entitiesPath, err.message);
  }
  return schemas;
}

/**
 * Build fieldNameToOriginalByTable from entity schemas and set it once at init.
 * Each schema.properties key (field name as in JSON) is mapped: dbColumn -> fieldName.
 * @param {Record<string, { name?: string, properties: Record<string, unknown> }>} entitySchemas
 */
function loadFieldMapsFromEntitySchemas(entitySchemas) {
  if (!entitySchemas || typeof entitySchemas !== "object") return;
  for (const [entityName, schema] of Object.entries(entitySchemas)) {
    if (!schema || !schema.properties || typeof schema.properties !== "object") continue;
    const tableName = entityNameToTableName(entityName);
    const map = {};

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
    }
    setFieldNameToOriginalByTable(tableName, map);
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
  const serviceRoleEntities = [
    "user", "transaction", "usermembership", "payment", "order", 
    "subscription", "admin", "audit", "log",
  ];
  return serviceRoleEntities.some((pattern) =>
    entityName.toLowerCase().includes(pattern)
  );
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
      
      if (isDeno) {
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

  // Build field maps once at init from entity JSON (avoids get/set on every API call)
  if (entitySchemas && typeof entitySchemas === "object") {
    loadFieldMapsFromEntitySchemas(entitySchemas);
  } else if (entitiesPath && isDeno) {
    const schemas = loadEntitySchemasFromPath(entitiesPath);
    loadFieldMapsFromEntitySchemas(schemas);
  }
  console.log("🦕 fieldNameToOriginalByTable", fieldNameToOriginalByTable);
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
  async function getAuthToken() {
    if (!isBrowser) return null;
    try {
      // Try to get token from window.supabase if available (some apps set this)
      if (window.supabase && typeof window.supabase.auth?.getSession === 'function') {
        const { data: { session } } = await window.supabase.auth.getSession();
        return session?.access_token || null;
      }
      
      // Use the imported supabase client from supabase-client.js
      // This is the same client used throughout the app
      const browserSupabase = await getSupabaseClient();
      if (browserSupabase) {
        const { data: { session }, error } = await browserSupabase.auth.getSession();
        if (error) {
          console.warn("Could not get session from supabase client:", error);
          return null;
        }
        return session?.access_token || null;
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
        console.warn("Could not get session:", error);
        return null;
      }
      return session?.access_token || null;
    } catch (error) {
      console.warn("Could not get auth token:", error);
      return null;
    }
  }

  // Create dynamic functions based on configuration
  const functions = {
    invoke: async (functionName, payload) => {
      const headers = { 'Content-Type': 'application/json' };
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      return await response.json();
    }
  };
  
  Object.entries(customFunctions).forEach(([name, path]) => {
    functions[name] = async (payload) => {
      try {
        const url = `${functionsBaseUrl}${path}`;
        if (isDeno) {
          console.log(`🔧 Calling function ${name} at ${url}`);
        }
        
        const headers = { 'Content-Type': 'application/json' };
        const token = await getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`Function ${name} failed: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error calling function ${name}:`, error);
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
        from_name = "Peace Adventures",
        from_email = null,
        provider = "resend", // Default to resend, can be 'resend', 'mailjet', or 'mailgun'
      }) => {
        console.log("SendEmail called with:", {
          to,
          subject,
          body,
          from_name,
          from_email,
          provider,
        });

        try {
          const response = await fetch(`${FUNCTIONS_BASE_URL}/sendEmailInternal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              to,
              subject,
              body,
              from_name,
              from_email,
              provider,
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Email sending failed: ${errorData.error || response.statusText}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error('Error sending email:', error);
          throw error;
        }
      },

      UploadFile: async ({ file }) => {
        console.warn(
          "UploadFile called with file:",
          file?.name,
          file?.size,
          file?.type
        );

        // TODO: Replace with Supabase Storage upload
        // Example implementation:
        if (!isBrowser) {
          throw new Error("UploadFile is only available in browser environment");
        }
        
        const browserSupabase = await getSupabaseClient();
        if (!browserSupabase) {
          throw new Error("Could not initialize Supabase client for file upload");
        }
        
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await browserSupabase.storage
          .from('uploads')
          .upload(fileName, file);
        
        if (error) throw error;
        
        const { data: { publicUrl } } = browserSupabase.storage
          .from('uploads')
          .getPublicUrl(fileName);
        
        return { file_url: publicUrl };

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
