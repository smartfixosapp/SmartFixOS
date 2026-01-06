import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Servicio para exportar reportes a CSV y PDF
 */
class ExportService {
  /**
   * Exporta datos a CSV
   */
  static exportToCSV(data, filename = "reporte") {
    if (!data || data.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escapar comillas y envolver en comillas si contiene comas
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${format(new Date(), "yyyy-MM-dd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Exporta datos a PDF usando HTML
   */
  static exportToPDF({ title, subtitle, headers, data, filename = "reporte", summary = null }) {
    if (!data || data.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: white;
      color: #1a1a1a;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #FF0000;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #FF0000;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .meta-item {
      font-size: 12px;
      color: #666;
    }
    .meta-item strong {
      color: #1a1a1a;
      display: block;
      margin-bottom: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    thead {
      background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);
      color: white;
    }
    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 13px;
    }
    tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    tbody tr:hover {
      background-color: #f0f0f0;
    }
    .summary {
      margin-top: 30px;
      padding: 20px;
      background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
      border-left: 4px solid #FF0000;
      border-radius: 5px;
    }
    .summary-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #1a1a1a;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
    .summary-item {
      background: white;
      padding: 12px;
      border-radius: 5px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .summary-value {
      font-size: 20px;
      font-weight: bold;
      color: #FF0000;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
    .numeric {
      text-align: right;
      font-weight: 500;
    }
    .currency {
      color: #008000;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">911 SmartFix</div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle || ""}</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <strong>Fecha de generación:</strong>
      ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
    </div>
    <div class="meta-item">
      <strong>Total de registros:</strong>
      ${data.length}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${h.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${data.map(row => `
        <tr>
          ${headers.map(h => {
            const value = row[h.key];
            const className = h.numeric ? "numeric" : "";
            const currencyClass = h.currency ? "currency" : "";
            return `<td class="${className} ${currencyClass}">${this.formatValue(value, h)}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>

  ${summary ? `
    <div class="summary">
      <div class="summary-title">Resumen</div>
      <div class="summary-grid">
        ${Object.entries(summary).map(([key, value]) => `
          <div class="summary-item">
            <div class="summary-label">${key}</div>
            <div class="summary-value">${value}</div>
          </div>
        `).join("")}
      </div>
    </div>
  ` : ""}

  <div class="footer">
    <p>911 SmartFix - Sistema de Gestión de Reparaciones</p>
    <p>Generado automáticamente el ${format(new Date(), "dd/MM/yyyy HH:mm")}</p>
  </div>

  <script>
    window.onload = function() {
      window.print();
      setTimeout(() => window.close(), 500);
    };
  </script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) {
      alert("Por favor habilita ventanas emergentes para generar el PDF");
      return;
    }
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  /**
   * Formatea un valor según su tipo
   */
  static formatValue(value, header) {
    if (value === null || value === undefined) return "—";
    
    if (header.currency) {
      return `$${Number(value).toFixed(2)}`;
    }
    
    if (header.date) {
      try {
        return format(new Date(value), "dd/MM/yyyy");
      } catch {
        return value;
      }
    }
    
    if (header.datetime) {
      try {
        return format(new Date(value), "dd/MM/yyyy HH:mm");
      } catch {
        return value;
      }
    }
    
    if (typeof value === "boolean") {
      return value ? "Sí" : "No";
    }
    
    return value;
  }

  /**
   * Exporta un reporte de ventas
   */
  static exportSalesReport(sales, dateRange, format = "csv") {
    const data = sales.map(sale => ({
      "Número de Venta": sale.sale_number,
      "Fecha": sale.created_date,
      "Cliente": sale.customer_name || "—",
      "Total": sale.total,
      "IVU": sale.tax_amount,
      "Método de Pago": sale.payment_method,
      "Empleado": sale.employee || "—",
      "Estado": sale.voided ? "Anulada" : "Completada"
    }));

    const total = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const tax = sales.reduce((sum, s) => sum + (s.tax_amount || 0), 0);

    if (format === "csv") {
      this.exportToCSV(data, "reporte_ventas");
    } else {
      this.exportToPDF({
        title: "Reporte de Ventas",
        subtitle: dateRange,
        headers: [
          { key: "Número de Venta", label: "N° Venta" },
          { key: "Fecha", label: "Fecha", datetime: true },
          { key: "Cliente", label: "Cliente" },
          { key: "Total", label: "Total", numeric: true, currency: true },
          { key: "IVU", label: "IVU", numeric: true, currency: true },
          { key: "Método de Pago", label: "Pago" },
          { key: "Empleado", label: "Empleado" }
        ],
        data,
        filename: "reporte_ventas",
        summary: {
          "Total Ventas": sales.length,
          "Ingresos Totales": `$${total.toFixed(2)}`,
          "Total IVU": `$${tax.toFixed(2)}`,
          "Promedio por Venta": `$${(total / sales.length || 0).toFixed(2)}`
        }
      });
    }
  }

  /**
   * Exporta un reporte de inventario
   */
  static exportInventoryReport(products, format = "csv") {
    const data = products.map(p => ({
      "SKU": p.sku || "—",
      "Nombre": p.name,
      "Categoría": p.category || "—",
      "Stock": p.stock || 0,
      "Stock Mínimo": p.min_stock || 0,
      "Precio": p.price,
      "Costo": p.cost,
      "Margen": ((p.price - p.cost) / p.price * 100).toFixed(1) + "%",
      "Estado": p.stock <= 0 ? "Agotado" : p.stock <= p.min_stock ? "Bajo" : "OK"
    }));

    const totalValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0);
    const lowStock = products.filter(p => p.stock <= p.min_stock).length;

    if (format === "csv") {
      this.exportToCSV(data, "reporte_inventario");
    } else {
      this.exportToPDF({
        title: "Reporte de Inventario",
        subtitle: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es }),
        headers: [
          { key: "SKU", label: "SKU" },
          { key: "Nombre", label: "Producto" },
          { key: "Categoría", label: "Categoría" },
          { key: "Stock", label: "Stock", numeric: true },
          { key: "Stock Mínimo", label: "Mín.", numeric: true },
          { key: "Precio", label: "Precio", numeric: true, currency: true },
          { key: "Costo", label: "Costo", numeric: true, currency: true },
          { key: "Margen", label: "Margen", numeric: true },
          { key: "Estado", label: "Estado" }
        ],
        data,
        filename: "reporte_inventario",
        summary: {
          "Total Productos": products.length,
          "Valor Inventario": `$${totalValue.toFixed(2)}`,
          "Productos Bajo Stock": lowStock,
          "Stock Total": products.reduce((sum, p) => sum + (p.stock || 0), 0)
        }
      });
    }
  }

  /**
   * Exporta un reporte de actividad de clientes
   */
  static exportCustomerActivityReport(customers, orders, format = "csv") {
    const data = customers.map(c => {
      const customerOrders = orders.filter(o => o.customer_id === c.id);
      const totalSpent = customerOrders.reduce((sum, o) => sum + (o.amount_paid || 0), 0);
      const avgOrder = customerOrders.length > 0 ? totalSpent / customerOrders.length : 0;
      const lastOrder = customerOrders.length > 0 
        ? customerOrders.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]
        : null;

      return {
        "Cliente": c.name,
        "Teléfono": c.phone,
        "Email": c.email || "—",
        "Total Órdenes": customerOrders.length,
        "Total Gastado": totalSpent,
        "Promedio por Orden": avgOrder,
        "Última Orden": lastOrder ? lastOrder.created_date : "—",
        "Estado": customerOrders.length === 0 ? "Inactivo" : customerOrders.length >= 5 ? "VIP" : "Activo"
      };
    });

    const totalOrders = data.reduce((sum, d) => sum + d["Total Órdenes"], 0);
    const totalRevenue = data.reduce((sum, d) => sum + d["Total Gastado"], 0);

    if (format === "csv") {
      this.exportToCSV(data, "reporte_clientes");
    } else {
      this.exportToPDF({
        title: "Reporte de Actividad de Clientes",
        subtitle: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es }),
        headers: [
          { key: "Cliente", label: "Cliente" },
          { key: "Teléfono", label: "Teléfono" },
          { key: "Email", label: "Email" },
          { key: "Total Órdenes", label: "Órdenes", numeric: true },
          { key: "Total Gastado", label: "Total Gastado", numeric: true, currency: true },
          { key: "Promedio por Orden", label: "Promedio", numeric: true, currency: true },
          { key: "Última Orden", label: "Última Orden", date: true },
          { key: "Estado", label: "Estado" }
        ],
        data,
        filename: "reporte_clientes",
        summary: {
          "Total Clientes": customers.length,
          "Total Órdenes": totalOrders,
          "Ingresos Totales": `$${totalRevenue.toFixed(2)}`,
          "Promedio por Cliente": `$${(totalRevenue / customers.length || 0).toFixed(2)}`
        }
      });
    }
  }
}

export default ExportService;
