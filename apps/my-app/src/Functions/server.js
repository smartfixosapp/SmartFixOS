// Unified Functions Server
// Routes all function calls through a single server with different paths

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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Route handlers
const routes = {
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
};
const port = Deno.env.get("FUNCTIONS_PORT");
console.log(`🌐 Functions server port is ${port}`);
Deno.serve({ port: port }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`🌐 ${req.method} ${path}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
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

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }
      const wrappedResponse = { data: responseData };

      return new Response(JSON.stringify(wrappedResponse), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
    } catch (error) {
      console.error(`💥 Error in handler ${path}:`, error);
      return new Response(
        JSON.stringify({ data:{ error: error.message }}), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
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
