/**
 * Appwrite client for browser environment.
 * Equivalent to supabase-client.js but for Appwrite.
 * All Appwrite imports are centralized here so Vite can resolve "appwrite" correctly.
 *
 * Requires: pnpm add appwrite
 *
 * Env vars:
 *   VITE_APPWRITE_ENDPOINT - Appwrite API endpoint (e.g. https://cloud.appwrite.io/v1)
 *   VITE_APPWRITE_PROJECT_ID - Appwrite project ID
 */
import { Client, Account, Databases, Storage, Query, ID } from "appwrite";

const getEnvVar = (key, defaultValue) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return process?.env?.[key] || defaultValue;
};

const endpoint = getEnvVar("VITE_APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1");
const projectId = getEnvVar("VITE_APPWRITE_PROJECT_ID", "");

const client = new Client().setEndpoint(endpoint).setProject(projectId);

export const appwriteClient = client;
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export { Client, Account, Databases, Storage, Query, ID };
