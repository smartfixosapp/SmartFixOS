import { customClient } from "../../../../lib/custom-sdk.js";

export const base44 = customClient({
    functionsBaseUrl: import.meta.env.VITE_FUNCTION_URL
  });