import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function aiAnalyticsHandler(req) {
  console.log("🦕 aiAnalytics called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, startDate, endDate, category, limit = 10 } = await req.json();

    // Top productos por venta
    if (action === 'topProducts') {
      const sales = await base44.entities.Sale.filter({}, '-created_date', 1000);
      const inventory = await base44.entities.Product.list('-stock', 100);
      
      const productMap = {};
      sales.forEach(sale => {
        sale.items?.forEach(item => {
          if (!productMap[item.id]) {
            productMap[item.id] = { name: item.name, qty: 0, revenue: 0 };
          }
          productMap[item.id].qty += item.quantity || 1;
          productMap[item.id].revenue += item.total || 0;
        });
      });

      const top = Object.entries(productMap)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, limit)
        .map(([id, data]) => ({
          id,
          name: data.name,
          unitsSold: data.qty,
          revenue: data.revenue,
          avgPrice: (data.revenue / data.qty).toFixed(2)
        }));

      return Response.json({ top, total: Object.keys(productMap).length });
    }

    // Stock bajo
    if (action === 'lowStock') {
      const products = await base44.entities.Product.filter({ active: true }, '-stock');
      const low = products
        .filter(p => p.stock <= p.min_stock)
        .slice(0, limit)
        .map(p => ({
          id: p.id,
          name: p.name,
          current: p.stock,
          minimum: p.min_stock,
          deficit: p.min_stock - p.stock,
          cost: p.cost,
          estimatedCost: (p.min_stock - p.stock) * p.cost
        }));

      const totalInvestment = low.reduce((sum, p) => sum + p.estimatedCost, 0);
      return Response.json({ low, totalInvestment });
    }

    // Rentabilidad por producto
    if (action === 'profitability') {
      const products = await base44.entities.Product.filter({ active: true }, '-price');
      const profit = products
        .filter(p => p.price && p.cost)
        .map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          cost: p.cost,
          margin: ((p.price - p.cost) / p.price * 100).toFixed(1),
          marginAmount: (p.price - p.cost).toFixed(2),
          stock: p.stock
        }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, limit);

      return Response.json({ profit });
    }

    // Rotación de inventario
    if (action === 'turnover') {
      const movements = await base44.entities.InventoryMovement.filter({}, '-created_date', 5000);
      const productMap = {};

      movements.forEach(m => {
        if (!productMap[m.product_id]) {
          productMap[m.product_id] = { name: m.product_name, sold: 0, cost: 0 };
        }
        if (m.movement_type === 'sale') {
          productMap[m.product_id].sold += m.quantity;
        }
      });

      const turnover = Object.entries(productMap)
        .filter(([_, p]) => p.sold > 0)
        .map(([id, p]) => ({
          id,
          name: p.name,
          unitsSold: p.sold,
          turnoverRate: 'High'
        }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, limit);

      return Response.json({ turnover });
    }

    // Clientes inactivos
    if (action === 'inactiveCustomers') {
      const customers = await base44.entities.Customer.list('-updated_date', 500);
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const inactive = customers
        .filter(c => {
          const lastUpdate = new Date(c.updated_date);
          return lastUpdate < thirtyDaysAgo && c.total_orders > 0;
        })
        .slice(0, limit)
        .map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          lastUpdate: c.updated_date,
          totalOrders: c.total_orders,
          totalSpent: c.total_spent
        }));

      return Response.json({ inactive });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
