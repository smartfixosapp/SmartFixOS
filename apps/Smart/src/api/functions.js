import { createUnifiedClient } from '../../../../lib/unified-custom-sdk-supabase.js';

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
  "sendVerificationEmail": "/sendVerificationEmail",
  "verifyAndCreateAdmin": "/verifyAndCreateAdmin",
  "createFirstAdmin": "/createFirstAdmin",
  "createStripeCheckout": "/createStripeCheckout",
  "createStripeSubscription": "/createStripeSubscription",
  "registerTenant": "/registerTenant",
  "manageTenant": "/manageTenant",
  "checkPlanLimits": "/checkPlanLimits",
  "notifyCashRegister": "/notifyCashRegister",
  "populateInventory": "/populateInventory",
  "handleOrderStatusChange": "/handleOrderStatusChange",
  "notifyPickupReminder": "/notifyPickupReminder",
  "notifyWarrantyCheck": "/notifyWarrantyCheck",
  "updateOrderCountdowns": "/updateOrderCountdowns",
  "aiAnalytics": "/aiAnalytics",
  "migrateOrderNumbers": "/migrateOrderNumbers",
  "processRecurringPayments": "/processRecurringPayments",
  "processPayment": "/processPayment",
  "trialNotificationService": "/trialNotificationService",
  "validateTrialStatus": "/validateTrialStatus",
  "createTenant": "/createTenant",
  "handleWarrantyTransition": "/handleWarrantyTransition",
  "resetSequenceCounters": "/resetSequenceCounters",
  "registerRefund": "/registerRefund",
  "deleteTransaction": "/deleteTransaction",
  "deleteOrder": "/deleteOrder",
  "resetTransactions": "/resetTransactions",
  "sendTemplatedEmail": "/sendTemplatedEmail",
  "processPayroll": "/processPayroll"
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
export const sendVerificationEmail = functionsClient.functions.sendVerificationEmail;
export const verifyAndCreateAdmin = functionsClient.functions.verifyAndCreateAdmin;
export const webmanifest = functionsClient.functions.webmanifest;
export const createFirstAdmin = functionsClient.functions.createFirstAdmin;
export const createStripeCheckout = functionsClient.functions.createStripeCheckout;
export const createStripeSubscription = functionsClient.functions.createStripeSubscription;
export const registerTenant = functionsClient.functions.registerTenant;
export const manageTenant = functionsClient.functions.manageTenant;
export const checkPlanLimits = functionsClient.functions.checkPlanLimits;
export const notifyCashRegister = functionsClient.functions.notifyCashRegister;
export const populateInventory = functionsClient.functions.populateInventory;
export const handleOrderStatusChange = functionsClient.functions.handleOrderStatusChange;
export const notifyPickupReminder = functionsClient.functions.notifyPickupReminder;
export const notifyWarrantyCheck = functionsClient.functions.notifyWarrantyCheck;
export const updateOrderCountdowns = functionsClient.functions.updateOrderCountdowns;
export const aiAnalytics = functionsClient.functions.aiAnalytics;
export const migrateOrderNumbers = functionsClient.functions.migrateOrderNumbers;
export const processRecurringPayments = functionsClient.functions.processRecurringPayments;
export const processPayment = functionsClient.functions.processPayment;
export const trialNotificationService = functionsClient.functions.trialNotificationService;
export const validateTrialStatus = functionsClient.functions.validateTrialStatus;
export const createTenant = functionsClient.functions.createTenant;
export const handleWarrantyTransition = functionsClient.functions.handleWarrantyTransition;
export const resetSequenceCounters = functionsClient.functions.resetSequenceCounters;
export const registerRefund = functionsClient.functions.registerRefund;
export const deleteTransaction = functionsClient.functions.deleteTransaction;
export const deleteOrder = functionsClient.functions.deleteOrder;
export const resetTransactions = functionsClient.functions.resetTransactions;
// sendTemplatedEmail — llama al servidor Deno en VITE_FUNCTION_URL/sendTemplatedEmail
// (antes llamaba a /api/send-email de Vercel que no existe en desarrollo local)
export const sendTemplatedEmail = functionsClient.functions.sendTemplatedEmail;

// Export configured client
export default functionsClient;
