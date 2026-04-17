import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, AlertTriangle, BarChart3, Download } from "lucide-react";

export default function SystemAuditPanel() {
  const [auditResults, setAuditResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runFullAudit = async () => {
    setLoading(true);
    const results = {
      timestamp: new Date().toISOString(),
      orders: { total: 0, issues: [], warnings: [] },
      sales: { total: 0, issues: [], warnings: [] },
      transactions: { total: 0, issues: [], warnings: [] },
      customers: { total: 0, issues: [], warnings: [] },
      products: { total: 0, issues: [], warnings: [] },
      summary: {}
    };

    try {
      // 1. AUDITAR ÓRDENES
      const orders = await dataClient.entities.Order.list("-created_date", 500);
      results.orders.total = orders.length;

      const orderNumbers = new Set();
      const deletedOrders = [];
      const incompleteteOrders = [];
      const duplicateNumbers = [];

      orders.forEach(order => {
        if (orderNumbers.has(order.order_number)) {
          duplicateNumbers.push(order.order_number);
        }
        orderNumbers.add(order.order_number);

        if (!order.customer_id || !order.customer_name || !order.device_type) {
          incompleteteOrders.push(`${order.order_number}: Missing ${!order.customer_id ? 'customer_id' : !order.customer_name ? 'customer_name' : 'device_type'}`);
        }

        if (order.is_deleted) {
          deletedOrders.push(order.order_number);
        }
      });

      if (incompleteteOrders.length > 0) {
        results.orders.issues.push(`${incompleteteOrders.length} órdenes con datos incompletos`);
      }
      if (deletedOrders.length > 0) {
        results.orders.warnings.push(`${deletedOrders.length} órdenes marcadas como eliminadas`);
      }
      if (duplicateNumbers.length > 0) {
        results.orders.issues.push(`Números de orden duplicados: ${[...new Set(duplicateNumbers)].join(', ')}`);
      }

      // 2. AUDITAR VENTAS (SALES)
      const sales = await dataClient.entities.Sale.list("-created_date", 500);
      results.sales.total = sales.length;

      const saleNumbers = new Set();
      const salesDuplicate = [];
      const invalidSales = [];

      sales.forEach(sale => {
        if (saleNumbers.has(sale.sale_number)) {
          salesDuplicate.push(sale.sale_number);
        }
        saleNumbers.add(sale.sale_number);

        if (!Array.isArray(sale.items) || sale.items.length === 0) {
          invalidSales.push(`${sale.sale_number}: sin items`);
        }
        if (!sale.payment_method) {
          invalidSales.push(`${sale.sale_number}: sin método de pago`);
        }
      });

      if (invalidSales.length > 0) {
        results.sales.issues.push(`${invalidSales.length} ventas con datos inválidos`);
      }
      if (salesDuplicate.length > 0) {
        results.sales.issues.push(`Números de venta duplicados: ${[...new Set(salesDuplicate)].join(', ')}`);
      }

      // 3. AUDITAR TRANSACCIONES
      const transactions = await dataClient.entities.Transaction.list("-created_date", 500);
      results.transactions.total = transactions.length;

      const orphanedTx = [];
      const invalidAmounts = [];

      transactions.forEach(tx => {
        if (!tx.order_number && !tx.order_id) {
          orphanedTx.push(tx.id.substring(0, 8));
        }
        if (tx.amount < 0) {
          invalidAmounts.push(`${tx.order_number}: cantidad negativa $${tx.amount}`);
        }
      });

      if (orphanedTx.length > 0) {
        results.transactions.issues.push(`${orphanedTx.length} transacciones sin orden asociada`);
      }
      if (invalidAmounts.length > 0) {
        results.transactions.issues.push(`${invalidAmounts.length} transacciones con montos inválidos`);
      }

      // 4. AUDITAR CLIENTES
      const customers = await dataClient.entities.Customer.list("-created_date", 500);
      results.customers.total = customers.length;

      const invalidContacts = [];
      const duplicatePhone = new Map();

      customers.forEach(customer => {
        if (!customer.phone && !customer.email) {
          invalidContacts.push(`${customer.name}: sin teléfono ni email`);
        }
        if (customer.phone) {
          if (duplicatePhone.has(customer.phone)) {
            duplicatePhone.set(customer.phone, [...(duplicatePhone.get(customer.phone) || []), customer.name]);
          } else {
            duplicatePhone.set(customer.phone, [customer.name]);
          }
        }
      });

      if (invalidContacts.length > 0) {
        results.customers.issues.push(`${invalidContacts.length} clientes sin contacto válido`);
      }

      const duplicates = Array.from(duplicatePhone.entries()).filter(([_, names]) => names.length > 1);
      if (duplicates.length > 0) {
        results.customers.warnings.push(`Teléfonos duplicados: ${duplicates.map(([phone]) => phone).join(', ')}`);
      }

      // 5. AUDITAR PRODUCTOS
      const products = await dataClient.entities.Product.list("-created_date", 500);
      results.products.total = products.length;

      const lowStock = [];
      const noPricing = [];

      products.forEach(product => {
        if (product.stock < product.min_stock) {
          lowStock.push(`${product.name}: ${product.stock}/${product.min_stock}`);
        }
        if (!product.price || product.price <= 0) {
          noPricing.push(product.name);
        }
      });

      if (lowStock.length > 0) {
        results.products.warnings.push(`${lowStock.length} productos con stock bajo`);
      }
      if (noPricing.length > 0) {
        results.products.issues.push(`${noPricing.length} productos sin precio válido`);
      }

      // RESUMEN
      const totalIssues = Object.values(results).reduce((acc, entity) => acc + entity.issues?.length || 0, 0);
      const totalWarnings = Object.values(results).reduce((acc, entity) => acc + entity.warnings?.length || 0, 0);

      results.summary = {
        totalIssues,
        totalWarnings,
        criticalStatus: totalIssues > 0 ? 'CRÍTICO' : totalWarnings > 0 ? 'ADVERTENCIAS' : 'OK',
        auditDate: new Date().toLocaleString('es-PR')
      };

      setAuditResults(results);
      toast.success(`Auditoría completada: ${totalIssues} problemas, ${totalWarnings} advertencias`);
    } catch (error) {
      console.error("Error en auditoría:", error);
      toast.error("Error al ejecutar auditoría: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!auditResults) return;
    const report = JSON.stringify(auditResults, null, 2);
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(report));
    element.setAttribute('download', `audit_${new Date().toISOString().split('T')[0]}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="apple-type space-y-6">
      {/* HEADER */}
      <div className="bg-apple-blue/12 rounded-apple-lg p-6">
        <div className="flex items-start gap-3">
          <BarChart3 className="w-6 h-6 text-apple-blue flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="apple-text-title2 apple-label-primary">Auditoría Completa del Sistema</h2>
            <p className="apple-text-subheadline apple-label-secondary mt-1">
              Analiza integridad de datos, duplicados, inconsistencias y validaciones
            </p>
          </div>
          <Button
            onClick={runFullAudit}
            disabled={loading}
            className="apple-btn apple-btn-primary apple-press"
          >
            {loading ? "Ejecutando..." : "Iniciar Auditoría"}
          </Button>
        </div>
      </div>

      {/* RESULTADOS */}
      {auditResults && (
        <div className="space-y-4">
          {/* RESUMEN */}
          <div className={`rounded-apple-md p-6 ${
            auditResults.summary.criticalStatus === 'OK'
              ? 'bg-apple-green/12'
              : auditResults.summary.criticalStatus === 'ADVERTENCIAS'
              ? 'bg-apple-yellow/12'
              : 'bg-apple-red/12'
          }`}>
            <div className="flex items-start gap-4">
              <div>
                {auditResults.summary.criticalStatus === 'OK' ? (
                  <CheckCircle2 className="w-8 h-8 text-apple-green" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-apple-orange" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="apple-text-title3 apple-label-primary mb-2">
                  Estado: {auditResults.summary.criticalStatus}
                </h3>
                <div className="grid grid-cols-3 gap-4 apple-text-subheadline">
                  <div>
                    <p className="apple-label-tertiary">Problemas Críticos</p>
                    <p className="apple-text-title2 text-apple-red tabular-nums">{auditResults.summary.totalIssues}</p>
                  </div>
                  <div>
                    <p className="apple-label-tertiary">Advertencias</p>
                    <p className="apple-text-title2 text-apple-yellow tabular-nums">{auditResults.summary.totalWarnings}</p>
                  </div>
                  <div>
                    <p className="apple-label-tertiary">Auditoría</p>
                    <p className="apple-text-subheadline apple-label-primary tabular-nums">{auditResults.summary.auditDate}</p>
                  </div>
                </div>
              </div>
              <Button
                onClick={downloadReport}
                variant="outline"
                className="apple-btn apple-btn-secondary apple-press"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
            </div>
          </div>

          {/* DETALLES POR ENTIDAD */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(auditResults).map(([key, data]) => {
              if (key === 'timestamp' || key === 'summary') return null;
              const hasIssues = data.issues?.length > 0 || data.warnings?.length > 0;

              return (
                <div key={key} className="rounded-apple-md p-4 apple-surface-elevated">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="apple-label-primary apple-text-headline capitalize">{key}</h4>
                    <span className="apple-text-title3 text-apple-blue tabular-nums">{data.total}</span>
                  </div>

                  {hasIssues ? (
                    <div className="space-y-2">
                      {data.issues?.map((issue, i) => (
                        <div key={i} className="flex gap-2 apple-text-subheadline">
                          <AlertCircle className="w-4 h-4 text-apple-red flex-shrink-0 mt-0.5" />
                          <span className="text-apple-red">{issue}</span>
                        </div>
                      ))}
                      {data.warnings?.map((warning, i) => (
                        <div key={i} className="flex gap-2 apple-text-subheadline">
                          <AlertTriangle className="w-4 h-4 text-apple-yellow flex-shrink-0 mt-0.5" />
                          <span className="text-apple-yellow">{warning}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2 apple-text-subheadline text-apple-green">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Sin problemas detectados</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
