// Unified Custom SDK for both Browser and Deno environments
// Detects environment and handles Supabase operations accordingly

// Detect environment
const isDeno = typeof Deno !== "undefined";
const isBrowser = typeof window !== "undefined";

// Handle environment variables for all environments
const getEnvVar = (key) => {
  if (isDeno) {
    return Deno.env.get(key);
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

// TODO: Configure production Supabase and API URLs before deploying to Cloudflare Pages
// These environment variables MUST be set in your deployment environment

// Configuration
const supabaseUrl = getEnvVar("VITE_SUPABASE_URL");
const supabaseAnonKey = getEnvVar("VITE_SUPABASE_ANON_KEY");
const supabaseServiceKey = getEnvVar("VITE_SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(
    "Missing required Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_SUPABASE_SERVICE_ROLE_KEY must be configured",
  );
}

// API Base URL - different for browser vs Deno
const API_BASE_URL = getEnvVar("VITE_API_URL");
// Functions base URL - single server approach
const FUNCTIONS_BASE_URL = getEnvVar("VITE_FUNCTION_URL");

if (!API_BASE_URL || !FUNCTIONS_BASE_URL) {
  throw new Error(
    "Missing required API environment variables: VITE_API_URL and VITE_FUNCTION_URL must be configured",
  );
}

/**
 * Initialize Supabase client based on environment and options
 */
async function initializeSupabaseClient(useServiceRole = false) {
  let createClient;

  if (isDeno) {
    // Dynamic import for Deno
    const { createClient: denoCreateClient } =
      await import("npm:@supabase/supabase-js@2.45.4");
    createClient = denoCreateClient;
  } else {
    // Static import for browser/Node (bundler will handle this)
    if (isBrowser && window.supabase) {
      createClient = window.supabase.createClient;
    } else {
      // This will be handled by bundler in browser environment
      const module = await import("@supabase/supabase-js");
      createClient = module.createClient;
    }
  }

  const key = useServiceRole ? supabaseServiceKey : supabaseAnonKey;
  const options = useServiceRole
    ? {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: "public",
        },
      }
    : {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      };

  const client = createClient(supabaseUrl, key, options);

  // Test the connection
  if (isDeno && useServiceRole) {
    console.log("🔧 Testing Supabase connection with service role...");
    try {
      const { data, error } = await client.from("users").select("id").limit(1);
      if (error && !error.message?.includes("Could not find the table")) {
        console.warn(
          "⚠️ Supabase service role connection issue:",
          error.message,
        );
      } else {
        console.log("✅ Supabase service role connection successful");
      }
    } catch (err) {
      console.warn("⚠️ Supabase connection test failed:", err.message);
    }
  }

  return client;
}

/**
 * Base Entity class that provides CRUD operations
 */
export class UnifiedEntity {
  constructor(tableName, useServiceRole = false) {
    this.tableName = tableName;
    this.useServiceRole = useServiceRole;
    this._client = null;
  }

  async getClient() {
    if (!this._client) {
      if (isDeno) {
        console.log(
          `🔧 Initializing Supabase client for ${this.tableName} (serviceRole: ${this.useServiceRole})`,
        );
      }
      this._client = await initializeSupabaseClient(this.useServiceRole);
    }
    return this._client;
  }

  mapFieldName(field) {
    const fieldMappings = {
      created_date: "created_at",
      updated_date: "updated_at",
      created_by_id: "created_by_id",
      created_by: "created_by",
    };
    return fieldMappings[field] || field;
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

    const mapObject = (obj) => {
      const mapped = {};
      for (const [key, value] of Object.entries(obj)) {
        const mappedKey = reverseFieldMappings[key] || key;
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
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, returning empty array`,
        );
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
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.entries(value).forEach(([operator, operand]) => {
          switch (operator) {
            case "$in":
              query = query.in(mappedKey, operand);
              break;
            case "$ne":
              if (Array.isArray(operand) && operand.length === 0) {
                query = query.not(mappedKey, "eq", "[]");
              } else {
                query = query.neq(mappedKey, operand);
              }
              break;
            case "$exists":
              if (operand) {
                query = query.not(mappedKey, "is", null);
              } else {
                query = query.is(mappedKey, null);
              }
              break;
            default:
              console.warn(
                `Unsupported operator "${operator}" in filter. Treating as equality.`,
              );
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
      if (
        error.code === "PGRST205" &&
        error.message.includes("Could not find the table")
      ) {
        console.warn(
          `Table ${this.tableName} does not exist, returning empty array`,
        );
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
          console.error(
            `❌ Database error for ${this.tableName}.get(${id}):`,
            error,
          );
        }

        if (
          error.code === "PGRST205" &&
          error.message.includes("Could not find the table")
        ) {
          console.warn(
            `Table ${this.tableName} does not exist, returning null`,
          );
          return null;
        }
        throw error;
      }

      if (isDeno) {
        console.log(
          `✅ Retrieved record from ${this.tableName}:`,
          data ? "found" : "not found",
        );
      }

      return data ? this.mapResultFields(data) : null;
    } catch (error) {
      if (isDeno) {
        console.error(
          `💥 Exception in ${this.tableName}.get(${id}):`,
          error.message,
        );
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
        const {
          data: { user },
        } = await client.auth.getUser();
        if (user) {
          mappedData["created_by_id"] = user.id;
          mappedData["created_by"] = user.email;
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
    const { error } = await client.from(this.tableName).delete().eq("id", id);

    if (error) {
      throw error;
    }
  }
}

/**
 * User Entity with authentication methods
 */
export class UnifiedUserEntity extends UnifiedEntity {
  constructor() {
    super("users", true); // Always use service role for user operations
  }

  async me() {
    if (isDeno) {
      // For Deno functions, return a service user and ensure client is initialized
      await this.getClient(); // This will initialize the service role client
      console.log("🔧 Deno service user authenticated");
      return {
        id: "service-user",
        email: "service@ownmy.app",
        role: "admin",
      };
    }

    // For browser, get actual user
    try {
      const client = await this.getClient();
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();

      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      // Get user data from database
      const { data, error } = await client
        .from("users")
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
          email_verified: user.email_confirmed_at ? true : false,
          role: user.email === "dev@localhost.com" ? "admin" : "user",
        };

        const { data: createdUser, error: createError } = await client
          .from("users")
          .insert(newUser)
          .select()
          .single();

        if (createError) {
          console.error("Error creating user:", createError);
          throw createError;
        }
        return this.mapResultFields(createdUser);
      }

      return this.mapResultFields(data);
    } catch (error) {
      if (error.message === "Not authenticated") {
        throw error;
      }
      console.error("Error in me():", error);
      throw new Error("Authentication error");
    }
  }
}

/**
 * Convert PascalCase entity name to snake_case table name
 */
function entityNameToTableName(entityName) {
  return entityName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Determine if an entity should use service role based on environment and patterns
 */
function shouldUseServiceRole(entityName) {
  // In Deno environment, always use service role since there's no browser user
  if (isDeno) {
    return true;
  }

  // In browser environment, only use service role for sensitive entities
  const serviceRoleEntities = [
    "user",
    "transaction",
    "usermembership",
    "payment",
    "order",
    "subscription",
    "admin",
    "audit",
    "log",
  ];
  return serviceRoleEntities.some((pattern) =>
    entityName.toLowerCase().includes(pattern),
  );
}

/**
 * Create entities proxy
 */
function createEntitiesProxy(forceServiceRole = false) {
  const entityCache = new Map();

  return new Proxy(
    {},
    {
      get(_, entityName) {
        if (typeof entityName !== "string") return undefined;

        // Handle special proxy methods
        if (
          entityName === "inspect" ||
          entityName === "valueOf" ||
          entityName === "toString"
        ) {
          return undefined;
        }

        if (entityCache.has(entityName)) {
          return entityCache.get(entityName);
        }

        const tableName = entityNameToTableName(entityName);
        const useServiceRole =
          forceServiceRole || shouldUseServiceRole(entityName);
        const entity = new UnifiedEntity(tableName, useServiceRole);

        entityCache.set(entityName, entity);

        if (isDeno) {
          console.log(
            `🔧 Created entity: ${entityName} -> ${tableName} (serviceRole: ${useServiceRole})`,
          );
        }

        return entity;
      },

      has(_, entityName) {
        return (
          typeof entityName === "string" &&
          entityName !== "inspect" &&
          entityName !== "valueOf" &&
          entityName !== "toString"
        );
      },

      ownKeys() {
        return Array.from(entityCache.keys());
      },

      getOwnPropertyDescriptor(_, entityName) {
        if (
          typeof entityName === "string" &&
          entityName !== "inspect" &&
          entityName !== "valueOf" &&
          entityName !== "toString"
        ) {
          return { enumerable: true, configurable: true };
        }
        return undefined;
      },
    },
  );
}

/**
 * Create unified custom client
 * @param {Object} options - Configuration options
 * @param {Object} options.functions - Dynamic function definitions
 * @param {string} options.functionsBaseUrl - Base URL for functions server
 */
export function createUnifiedClient(options = {}) {
  const {
    functions: customFunctions = {},
    functionsBaseUrl = FUNCTIONS_BASE_URL,
  } = options;

  // Debug logging (uncomment for debugging)
  // if (isDeno) {
  //   console.log("🔧 Creating unified client in Deno environment");
  //   console.log(`🔧 Functions base URL: ${functionsBaseUrl}`);
  //   console.log(`🔧 Custom functions:`, Object.keys(customFunctions));
  // }

  // Create dynamic functions based on configuration
  const functions = {
    invoke: async (functionName, payload) => {
      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await response.json();
    },
  };

  Object.entries(customFunctions).forEach(([name, path]) => {
    functions[name] = async (payload) => {
      try {
        const url = `${functionsBaseUrl}${path}`;
        if (isDeno) {
          console.log(`🔧 Calling function ${name} at ${url}`);
        }

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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

  const client = {
    entities: createEntitiesProxy(),
    auth: new UnifiedUserEntity(),
    asServiceRole: {
      entities: createEntitiesProxy(true), // Force service role
      functions: functions,
    },
    functions,
    integrations: {
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
            const response = await fetch(`${API_BASE_URL}/ai/invoke`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt,
                add_context_from_internet,
                response_json_schema,
                file_urls,
              }),
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
            console.error("Error invoking LLM:", error);
            throw error;
          }
        },
        SendEmail: async ({
          to,
          subject,
          body,
          from_name = "Peace Adventures",
        }) => {
          console.warn("SendEmail called with:", {
            to,
            subject,
            body,
            from_name,
          });

          // TODO: Replace with actual email service (Resend, SendGrid, etc.)
          // Example with Resend:
          // const resend = new Resend(import.meta.env.RESEND_API_KEY);
          // const result = await resend.emails.send({
          //   from: `${from_name} <noreply@yourdomain.com>`,
          //   to: [to],
          //   subject: subject,
          //   html: body
          // });

          return {
            status: "sent",
            message_id: `mock_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 11)}`,
            note: "Email integration not yet implemented - email would have been sent",
          };
        },

        UploadFile: async ({ file }) => {
          console.warn(
            "UploadFile called with file:",
            file?.name,
            file?.size,
            file?.type,
          );

          // TODO: Replace with Supabase Storage upload
          // Example implementation:
          const fileName = `${Date.now()}_${file.name}`;
          const { data, error } = await supabase.storage
            .from("uploads")
            .upload(fileName, file);

          if (error) throw error;

          const {
            data: { publicUrl },
          } = supabase.storage.from("uploads").getPublicUrl(fileName);

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

          //   const response = await fetch(`${API_BASE_URL}/files/upload`, {
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
            const response = await fetch(`${API_BASE_URL}/ai/generate-image`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                prompt,
              }),
            });

            if (!response.ok) {
              throw new Error(
                `Image generation failed: ${response.statusText}`,
              );
            }

            const data = await response.json();
            return data;
          } catch (error) {
            console.error("Error generating image:", error);
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
            const response = await fetch(`${API_BASE_URL}/extract_file`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                file_url: finalFileUrl,
                file_format: "pdf",
              }),
            });

            if (!response.ok) {
              throw new Error(`Data extraction failed: ${response.statusText}`);
            }
            return await response.json();
          } catch (error) {
            console.error("Error extracting data from file:", error);
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
          const result = await textract
            .analyzeDocument({
              Document: { S3Object: { Bucket: bucket, Name: key } },
              FeatureTypes: ["TABLES", "FORMS"],
            })
            .promise();

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
    },
  };
  return client;
}

// Default client for PI App functions (backward compatibility)
export const customClient = createUnifiedClient({
  functions: {
    processMedicalChronology: "/processMedicalChronology",
    generateDraftSection: "/generateDraftSection",
    processDocumentPages: "/processDocumentPages",
    processDocumentComprehensive: "/processDocumentComprehensive",
    qualityControlCheck: "/qualityControlCheck",
    enhancedQualityControl: "/enhancedQualityControl",
  },
});

// Export main creation function
export default createUnifiedClient;
