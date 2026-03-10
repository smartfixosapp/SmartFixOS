import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

export async function createStripeCheckoutHandler(req) {
  console.log("🦕 createStripeCheckout called");
  try {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, amount } = await req.json();

    if (!orderId) {
        return Response.json({ error: 'Order ID required' }, { status: 400 });
    }

    // Get the order
    const order = await base44.entities.Order.get(orderId);
    if (!order) {
        return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

    // Calculate amount (if not provided, use balance due)
    const finalAmount = amount ? parseFloat(amount) : (order.balance_due || order.total || 0);
    
    if (finalAmount <= 0) {
        return Response.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Orden de Reparación #${order.order_number}`,
              description: `${order.device_brand || ''} ${order.device_model || ''} - ${order.customer_name}`,
            },
            unit_amount: Math.round(finalAmount * 100), // cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get("origin")}/Orders?order=${order.id}&payment_success=true`,
      cancel_url: `${req.headers.get("origin")}/Orders?order=${order.id}&payment_cancel=true`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id
      },
      customer_email: order.customer_email || undefined,
    });

    return Response.json({ url: session.url });

  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
