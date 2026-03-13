import appClient from "./appClient";

export { entitySchemas } from "./entitySchemas";
export { appClient };

// Compatibility shim while the app migrates away from Base44 naming.
export const base44 = appClient;

export default appClient;
