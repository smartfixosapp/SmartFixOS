import React, { useState } from "react";
import { Transaction } from "@/api/entities";
import { CashRegister } from "@/api/entities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";

const COLORS = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function FinancialReportDialog({ open, onClose, transactions, register }) {
  const [exporting, setExporting] = useState(false);

  // Sales by tender type
  const salesByTender = transactions
    .filter(t => t.type === 'revenue')
    .reduce((acc, t) => {
      const method = t.payment_method;
      acc[method] = (acc[method] || 0) + t.amount;
      return acc;
    }, {});

  const tenderData = Object.entries(salesByTender).map(([name, value]) => ({
    name: name === 'cash' ? 'Cash' : name === 'card' ? 'Card' : 'ATH Móvil',
    value: value
  }));

  // Sales by employee
  const salesByEmployee = transactions
    .filter(t => t.type === 'revenue')
    .reduce((acc, t) => {
      const employee = t.recorded_by || 'Unknown';
      acc[employee] = (acc[employee] || 0) + t.amount;
      return acc;
    }, {});

  const employeeData = Object.entries(salesByEmployee).map(([name, value]) => ({
    name,
    sales: value
  }));

  const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const estimatedTax = netProfit * 0.115;

  const handleExport = () => {
    setExporting(true);
    
    // Create a simple HTML report
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Report - ${format(new Date(), 'MMM d, yyyy')}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #0891b2; }
          .summary { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .metric { margin: 10px 0; }
          .metric-label { font-weight: bold; }
          .metric-value { float: right; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #0891b2; color: white; }
          .positive { color: #10b981; }
          .negative { color: #ef4444; }
        </style>
      </head>
      <body>
        <h1>Financial Report</h1>
        <p>Date: ${format(new Date(), 'MMMM d, yyyy')}</p>
        
        <div class="summary">
          <h2>Summary</h2>
          <div class="metric">
            <span class="metric-label">Total Revenue:</span>
            <span class="metric-value positive">$${totalRevenue.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Expenses:</span>
            <span class="metric-value negative">$${totalExpenses.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Net Profit:</span>
            <span class="metric-value ${netProfit >= 0 ? 'positive' : 'negative'}">$${netProfit.toFixed(2)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Estimated Tax (11.5%):</span>
            <span class="metric-value">$${estimatedTax.toFixed(2)}</span>
          </div>
        </div>

        <h2>Sales by Payment Method</h2>
        <table>
          <tr><th>Method</th><th>Amount</th></tr>
          ${tenderData.map(item => `<tr><td>${item.name}</td><td>$${item.value.toFixed(2)}</td></tr>`).join('')}
        </table>

        <h2>Sales by Employee</h2>
        <table>
          <tr><th>Employee</th><th>Sales</th></tr>
          ${employeeData.map(item => `<tr><td>${item.name}</td><td>$${item.sales.toFixed(2)}</td></tr>`).join('')}
        </table>

        ${register ? `
        <h2>Cash Register</h2>
        <div class="summary">
          <div class="metric">
            <span class="metric-label">Opening Balance:</span>
            <span class="metric-value">$${register.opening_balance.toFixed(2)}</span>
          </div>
          ${register.closing_balance ? `
          <div class="metric">
            <span class="metric-label">Closing Balance:</span>
            <span class="metric-value">$${register.closing_balance.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}
      </body>
      </html>
    `;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    
    setExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Financial Report</DialogTitle>
            <Button onClick={handleExport} disabled={exporting} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-500">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-500">Net Profit</p>
                  <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
                    ${netProfit.toFixed(2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-500">Est. Tax (11.5%)</p>
                  <p className="text-2xl font-bold text-amber-600">${estimatedTax.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Sales by Payment Method</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tenderData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {tenderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-4">Sales by Employee</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={employeeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="sales" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
