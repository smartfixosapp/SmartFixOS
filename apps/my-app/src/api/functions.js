import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Configure functions for this app
const functionPaths = {
  "sendEmail": "/sendEmail",
  "uploadFile": "/uploadFile",
  "generateSequenceNumber": "/generateSequenceNumber",
  "getPortalOrder": "/getPortalOrder",
  "getRevenueByMethod": "/getRevenueByMethod",
  "getExpensesByCategory": "/getExpensesByCategory",
  "getKPIs": "/getKPIs",
  "notifyNewOrder": "/notifyNewOrder",
  "maintenanceJobs": "/maintenanceJobs",
  "salesList": "/salesList",
  "transactionsList": "/transactionsList",
  "cashRegisters": "/cashRegisters",
  "cashMovements": "/cashMovements",
  "getNeonSchema": "/getNeonSchema",
  "sendVerificationEmail": "/sendVerificationEmail",
  "verifyAndCreateAdmin": "/verifyAndCreateAdmin"
};

// Create client with function configuration
const functionsClient = createUnifiedClient({
  functions: functionPaths,
  functionsBaseUrl: import.meta.env.VITE_FUNCTION_URL
});

// Export individual functions for compatibility
export const sendEmail = functionsClient.functions.sendEmail;
export const uploadFile = functionsClient.functions.uploadFile;
export const generateSequenceNumber = functionsClient.functions.generateSequenceNumber;
export const getPortalOrder = functionsClient.functions.getPortalOrder;
export const getRevenueByMethod = functionsClient.functions.getRevenueByMethod;
export const getExpensesByCategory = functionsClient.functions.getExpensesByCategory;
export const getKPIs = functionsClient.functions.getKPIs;
export const notifyNewOrder = functionsClient.functions.notifyNewOrder;
export const maintenanceJobs = functionsClient.functions.maintenanceJobs;
export const salesList = functionsClient.functions.salesList;
export const transactionsList = functionsClient.functions.transactionsList;
export const cashRegisters = functionsClient.functions.cashRegisters;
export const cashMovements = functionsClient.functions.cashMovements;
export const getNeonSchema = functionsClient.functions.getNeonSchema;
export const sendVerificationEmail = functionsClient.functions.sendVerificationEmail;
export const verifyAndCreateAdmin = functionsClient.functions.verifyAndCreateAdmin;

// Export configured client
export default functionsClient;
