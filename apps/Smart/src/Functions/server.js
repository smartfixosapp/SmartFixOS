// Unified Functions Server
// Routes all function calls through a single server with different paths
import { extractFileHandler } from './extractFile.js';
import { generateImageHandler } from './generateImage.js';
import { invokeLLMHandler } from './invokeLLM.js';
import { sendEmailInternalHandler } from './sendEmailInternal.js';
import { runScheduledFnTriggersHandler } from './runScheduledFnTriggers.js';
import { onEntityFnTriggerHandler } from './onEntityFnTrigger.js';
import { processFnTriggerEventsHandler } from './processFnTriggerEvents.js';
import { sendEmailHandler } from './sendEmail.js';
import { uploadFileHandler } from './uploadFile.js';
import { generateSequenceNumberHandler } from './generateSequenceNumber.js';
import { getPortalOrderHandler } from './getPortalOrder.js';
import { getRevenueByMethodHandler } from './getRevenueByMethod.js';
import { getExpensesByCategoryHandler } from './getExpensesByCategory.js';
import { getKPIsHandler } from './getKPIs.js';
import { notifyNewOrderHandler } from './notifyNewOrder.js';
import { maintenanceJobsHandler } from './maintenanceJobs.js';
import { salesListHandler } from './salesList.js';
import { transactionsListHandler } from './transactionsList.js';
import { cashRegistersHandler } from './cashRegisters.js';
import { cashMovementsHandler } from './cashMovements.js';
import { getNeonSchemaHandler } from './getNeonSchema.js';
import { sendVerificationEmailHandler } from './sendVerificationEmail.js';
import { verifyAndCreateAdminHandler } from './verifyAndCreateAdmin.js';
import { createFirstAdminHandler } from './createFirstAdmin.js';
import { createStripeCheckoutHandler } from './createStripeCheckout.js';
import { createStripeSubscriptionHandler } from './createStripeSubscription.js';
import { stripeWebhookHandler } from './stripeWebhook.js';
import { registerTenantHandler } from './registerTenant.js';
import { manageTenantHandler } from './manageTenant.js';
import { notifyCashRegisterHandler } from './notifyCashRegister.js';
import { handleOrderStatusChangeHandler } from './handleOrderStatusChange.js';
import { notifyPickupReminderHandler } from './notifyPickupReminder.js';
import { notifyWarrantyCheckHandler } from './notifyWarrantyCheck.js';
import { updateOrderCountdownsHandler } from './updateOrderCountdowns.js';
import { aiAnalyticsHandler } from './aiAnalytics.js';
import { migrateOrderNumbersHandler } from './migrateOrderNumbers.js';
import { processRecurringPaymentsHandler } from './processRecurringPayments.js';
import { processPaymentHandler } from './processPayment.js';
import { trialNotificationServiceHandler } from './trialNotificationService.js';
import { validateTrialStatusHandler } from './validateTrialStatus.js';
import { createTenantHandler } from './createTenant.js';
import { handleWarrantyTransitionHandler } from './handleWarrantyTransition.js';
import { resetSequenceCountersHandler } from './resetSequenceCounters.js';
import { registerRefundHandler } from './registerRefund.js';
import { deleteTransactionHandler } from './deleteTransaction.js';
import { deleteOrderHandler } from './deleteOrder.js';
import { resetTransactionsHandler } from './resetTransactions.js';
import { sendTemplatedEmailHandler } from './sendTemplatedEmail.js';
import { sendAdminOtpHandler } from './sendAdminOtp.js';
import { processPayrollHandler } from './processPayroll.js';
import { verifyAdminOtpHandler } from './verifyAdminOtp.js';
import { trackParcelHandler } from './trackParcel.js';
import { setRequestAuthToken, clearRequestAuthToken } from '../../../../lib/unified-custom-sdk-supabase.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Routes that should return unwrapped responses (to match Python backend API)
const unwrappedRoutes = new Set([
  '/extract_file',
  '/ai/invoke',
  '/ai/generate-image',
  '/sendEmailInternal',
  '/stripeWebhook',     // Stripe espera respuesta directa sin wrapper
  '/registerTenant',    // Maneja su propio JSON — el wrapper rompe el error handling del SDK
  '/sendAdminOtp',      // Mismo motivo
  '/verifyAdminOtp',    // Mismo motivo
  '/trackParcel',       // Respuesta directa con datos de tracking
]);

// Route handlers
const routes = {
'/extract_file': extractFileHandler,
'/ai/invoke': invokeLLMHandler,
'/ai/generate-image': generateImageHandler,
'/sendEmailInternal': sendEmailInternalHandler,
'/runScheduledFnTriggers': runScheduledFnTriggersHandler,
'/onEntityFnTrigger': onEntityFnTriggerHandler,
'/processFnTriggerEvents': processFnTriggerEventsHandler,
  '/sendEmail': sendEmailHandler,
  '/uploadFile': uploadFileHandler,
  '/generateSequenceNumber': generateSequenceNumberHandler,
  '/getPortalOrder': getPortalOrderHandler,
  '/getRevenueByMethod': getRevenueByMethodHandler,
  '/getExpensesByCategory': getExpensesByCategoryHandler,
  '/getKPIs': getKPIsHandler,
  '/notifyNewOrder': notifyNewOrderHandler,
  '/maintenanceJobs': maintenanceJobsHandler,
  '/salesList': salesListHandler,
  '/transactionsList': transactionsListHandler,
  '/cashRegisters': cashRegistersHandler,
  '/cashMovements': cashMovementsHandler,
  '/getNeonSchema': getNeonSchemaHandler,
  '/sendVerificationEmail': sendVerificationEmailHandler,
  '/verifyAndCreateAdmin': verifyAndCreateAdminHandler,
  '/createFirstAdmin': createFirstAdminHandler,
  '/createStripeCheckout': createStripeCheckoutHandler,
  '/createStripeSubscription': createStripeSubscriptionHandler,
  '/stripeWebhook': stripeWebhookHandler,
  '/registerTenant': registerTenantHandler,
  '/sendAdminOtp': sendAdminOtpHandler,
  '/verifyAdminOtp': verifyAdminOtpHandler,
  '/manageTenant': manageTenantHandler,
  '/notifyCashRegister': notifyCashRegisterHandler,
  '/handleOrderStatusChange': handleOrderStatusChangeHandler,
  '/notifyPickupReminder': notifyPickupReminderHandler,
  '/notifyWarrantyCheck': notifyWarrantyCheckHandler,
  '/updateOrderCountdowns': updateOrderCountdownsHandler,
  '/aiAnalytics': aiAnalyticsHandler,
  '/migrateOrderNumbers': migrateOrderNumbersHandler,
  '/processRecurringPayments': processRecurringPaymentsHandler,
  '/processPayment': processPaymentHandler,
  '/trialNotificationService': trialNotificationServiceHandler,
  '/validateTrialStatus': validateTrialStatusHandler,
  '/createTenant': createTenantHandler,
  '/handleWarrantyTransition': handleWarrantyTransitionHandler,
  '/resetSequenceCounters': resetSequenceCountersHandler,
  '/registerRefund': registerRefundHandler,
  '/deleteTransaction': deleteTransactionHandler,
  '/deleteOrder': deleteOrderHandler,
  '/resetTransactions': resetTransactionsHandler,
  '/processPayroll': processPayrollHandler,
  '/sendTemplatedEmail': sendTemplatedEmailHandler,
  '/trackParcel': trackParcelHandler,
};
const port = parseInt(Deno.env.get("FUNCTIONS_PORT") || "8686");
console.log(`🌐 Functions server port is ${port}`);
Deno.serve({ port, hostname: "::" }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

const isDev = Deno.env.get("DENO_ENV") !== "production";
  if (isDev) {
    console.log(`🌐 ${req.method} ${path}`);
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Extract auth token from Authorization header for unified auth
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    setRequestAuthToken(authHeader.substring(7));
  }

  // Find and call the appropriate handler
  const handler = routes[path];
  if (handler) {
    try {
      const response = await handler(req);
      
      // Add CORS headers to the response
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      // Some routes (like Python backend API endpoints) return unwrapped responses
      if (unwrappedRoutes.has(path)) {
        // Return response directly without wrapping
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const responseData = await response.json();
        const wrappedResponse = { data: responseData };
        return new Response(JSON.stringify(wrappedResponse), {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }

      const responseText = await response.text();
      const wrappedResponse = { data: responseText };

      return new Response(JSON.stringify(wrappedResponse), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
    } catch (error) {
      if (isDev) {
        console.error(`💥 Error in handler ${path}:`, error);
      }
      return new Response(
        JSON.stringify({ data:{ error: error.message }}), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } finally {
      // Clear auth token after request processing
      clearRequestAuthToken();
    }
  }

  // Health check (Render requires 2xx on healthCheckPath)
  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'SmartFixOS Functions' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ data:{ error: `Route ${path} not found` }}), 
    { 
      status: 404, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});

console.log(` Functions server started on http://localhost:${port}` );
console.log("📋 Available routes:");
console.log(`   🔧 /sendEmail: http://localhost:$${port}/sendEmail` );
console.log(`   🔧 /uploadFile: http://localhost:$${port}/uploadFile` );
console.log(`   🔧 /generateSequenceNumber: http://localhost:$${port}/generateSequenceNumber` );
console.log(`   🔧 /getPortalOrder: http://localhost:$${port}/getPortalOrder` );
console.log(`   🔧 /getRevenueByMethod: http://localhost:$${port}/getRevenueByMethod` );
console.log(`   🔧 /getExpensesByCategory: http://localhost:$${port}/getExpensesByCategory` );
console.log(`   🔧 /getKPIs: http://localhost:$${port}/getKPIs` );
console.log(`   🔧 /notifyNewOrder: http://localhost:$${port}/notifyNewOrder` );
console.log(`   🔧 /maintenanceJobs: http://localhost:$${port}/maintenanceJobs` );
console.log(`   🔧 /salesList: http://localhost:$${port}/salesList` );
console.log(`   🔧 /transactionsList: http://localhost:$${port}/transactionsList` );
console.log(`   🔧 /cashRegisters: http://localhost:$${port}/cashRegisters` );
console.log(`   🔧 /cashMovements: http://localhost:$${port}/cashMovements` );
console.log(`   🔧 /getNeonSchema: http://localhost:$${port}/getNeonSchema` );
console.log(`   🔧 /sendVerificationEmail: http://localhost:$${port}/sendVerificationEmail` );
console.log(`   🔧 /verifyAndCreateAdmin: http://localhost:$${port}/verifyAndCreateAdmin` );
console.log(`   🔧 /webmanifest: http://localhost:$${port}/webmanifest` );
console.log(`   🔧 /createFirstAdmin: http://localhost:$${port}/createFirstAdmin` );
console.log(`   🔧 /createStripeCheckout: http://localhost:$${port}/createStripeCheckout` );
console.log(`   🔧 /createStripeSubscription: http://localhost:$${port}/createStripeSubscription` );
console.log(`   🔧 /stripeWebhook: http://localhost:$${port}/stripeWebhook` );
console.log(`   🔧 /registerTenant: http://localhost:$${port}/registerTenant` );
console.log(`   🔧 /notifyCashRegister: http://localhost:$${port}/notifyCashRegister` );
console.log(`   🔧 /populateInventory: http://localhost:$${port}/populateInventory` );
console.log(`   🔧 /handleOrderStatusChange: http://localhost:$${port}/handleOrderStatusChange` );
console.log(`   🔧 /notifyPickupReminder: http://localhost:$${port}/notifyPickupReminder` );
console.log(`   🔧 /notifyWarrantyCheck: http://localhost:$${port}/notifyWarrantyCheck` );
console.log(`   🔧 /updateOrderCountdowns: http://localhost:$${port}/updateOrderCountdowns` );
console.log(`   🔧 /aiAnalytics: http://localhost:$${port}/aiAnalytics` );
console.log(`   🔧 /migrateOrderNumbers: http://localhost:$${port}/migrateOrderNumbers` );
console.log(`   🔧 /processRecurringPayments: http://localhost:$${port}/processRecurringPayments` );
console.log(`   🔧 /processPayment: http://localhost:$${port}/processPayment` );
console.log(`   🔧 /trialNotificationService: http://localhost:$${port}/trialNotificationService` );
console.log(`   🔧 /validateTrialStatus: http://localhost:$${port}/validateTrialStatus` );
console.log(`   🔧 /createTenant: http://localhost:$${port}/createTenant` );
console.log(`   🔧 /handleWarrantyTransition: http://localhost:$${port}/handleWarrantyTransition` );
console.log(`   🔧 /resetSequenceCounters: http://localhost:$${port}/resetSequenceCounters` );
console.log(`   🔧 /registerRefund: http://localhost:$${port}/registerRefund` );
console.log(`   🔧 /deleteTransaction: http://localhost:$${port}/deleteTransaction` );
console.log(`   🔧 /deleteOrder: http://localhost:$${port}/deleteOrder` );
console.log(`   🔧 /resetTransactions: http://localhost:$${port}/resetTransactions` );
console.log(`   🔧 /sendTemplatedEmail: http://localhost:$${port}/sendTemplatedEmail` );
console.log(`   📄 /extract_file: http://localhost:${port}/extract_file` );
console.log(`   🤖 /ai/invoke: http://localhost:${port}/ai/invoke` );
console.log(`   🎨 /ai/generate-image: http://localhost:${port}/ai/generate-image` );
console.log(`   📧 /sendEmail: http://localhost:${port}/sendEmail` );
console.log(`   ⏰ /runScheduledFnTriggers: http://localhost:${port}/runScheduledFnTriggers` );
console.log(`   📬 /onEntityFnTrigger: http://localhost:${port}/onEntityFnTrigger` );
console.log(`   📋 /processFnTriggerEvents: http://localhost:${port}/processFnTriggerEvents` );
