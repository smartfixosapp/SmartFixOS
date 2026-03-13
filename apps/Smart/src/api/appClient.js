import { customClient } from "../../../../lib/unified-custom-sdk-supabase.js";
import { entitySchemas } from "./entitySchemas";

export const appClient = customClient({
  functionsBaseUrl: import.meta.env.VITE_FUNCTION_URL,
  entitySchemas,
});

export default appClient;
