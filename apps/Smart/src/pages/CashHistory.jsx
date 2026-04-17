import React, { useState, useEffect, useMemo } from "react";
import appClient from "@/api/appClient";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar, Search, Filter, ArrowUpRight, ArrowDownRight,
  DollarSign, CreditCard, Smartphone, Wallet, Eye, ChevronLeft,
  Printer, Download
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

export default function CashHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [registers, setRegisters] = useState([]);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [searchUser, setSearchUser] = useState("");
  const [selectedRegister, setSelectedRegister] = useState(null);

  useEffect(() => {
    loadRegisters();
  }, []);

  const loadRegisters = async () => {
    setLoading(true);
    try {
      // Fetch registers (limit to 500 for now, could be paginated)
      const data = await dataClient.entities.CashRegister.list("-date", 500);
      setRegisters(data || []);
    } catch (error) {
      console.error("Error loading registers:", error);
      toast.error("Error al cargar historial de caja");
    } finally {
      setLoading(false);
    }
  };

  const filteredRegisters = useMemo(() => {
    return registers.filter(reg => {
      // Date filter
      if (startDate && endDate) {
        try {
          const regDate = new Date(reg.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (regDate < start || regDate > end) return false;
        } catch (e) { return false; }
      }

      // User filter
      if (searchUser) {
        const user = (reg.opened_by || "") + (reg.closed_by || "");
        if (!user.toLowerCase().includes(searchUser.toLowerCase())) return false;
      }

      return true;
    });
  }, [registers, startDate, endDate, searchUser]);

  const exportCSV = () => {
    if (filteredRegisters.length === 0) return;

    const headers = "Fecha,Estado,Abierto Por,Cerrado Por,Inicio,Cierre,Ventas,Diferencia\n";
    const rows = filteredRegisters.map(r => {
      const diff = r.final_count?.difference || 0;
      return [
        r.date,
        r.status === 'open' ? 'Abierta' : 'Cerrada',
        r.opened_by || '-',
        r.closed_by || '-',
        r.opening_balance?.toFixed(2),
        r.closing_balance?.toFixed(2) || '0.00',
        r.total_revenue?.toFixed(2) || '0.00',
        diff.toFixed(2)
      ].join(",");
    }).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `historial_caja_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen apple-surface apple-type p-4 sm:p-6 pb-24">
      <div className="max-w-[1920px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="apple-btn apple-btn-plain apple-press"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-apple-sm bg-apple-green/15 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6 text-apple-green" />
              </div>
              <div>
                <h1 className="apple-text-large-title apple-label-primary">Historial de Caja</h1>
                <p className="apple-text-subheadline apple-label-secondary">Registro detallado de aperturas y cierres</p>
              </div>
            </div>
          </div>
          <Button onClick={exportCSV} className="apple-btn apple-btn-primary apple-press">
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="apple-card">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2 w-full sm:w-auto">
              <label className="apple-text-caption1 apple-label-secondary">Fecha Inicio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="apple-input"
              />
            </div>
            <div className="space-y-2 w-full sm:w-auto">
              <label className="apple-text-caption1 apple-label-secondary">Fecha Fin</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="apple-input"
              />
            </div>
            <div className="space-y-2 flex-1 w-full">
              <label className="apple-text-caption1 apple-label-secondary">Buscar Usuario</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
                <Input
                  placeholder="Nombre de empleado..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="apple-input pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div className="grid gap-4">
          {filteredRegisters.length === 0 ? (
            <div className="text-center py-12 apple-label-tertiary apple-card">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="apple-text-body">No se encontraron registros</p>
            </div>
          ) : (
            filteredRegisters.map((reg) => {
              const diff = reg.final_count?.difference || 0;
              const hasDiff = Math.abs(diff) > 0.05;

              return (
                <Card
                  key={reg.id}
                  className="apple-card apple-press cursor-pointer group transition-all"
                  onClick={() => setSelectedRegister(reg)}
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-apple-sm flex items-center justify-center shrink-0 ${
                        reg.status === 'open' ? 'bg-apple-blue/15 text-apple-blue' :
                        hasDiff ? 'bg-apple-red/15 text-apple-red' : 'bg-apple-green/15 text-apple-green'
                      }`}>
                        {reg.status === 'open' ? <Wallet className="w-6 h-6" /> :
                         hasDiff ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="apple-text-headline apple-label-primary">
                            {format(parseISO(reg.date), "dd MMMM yyyy", { locale: es })}
                          </h3>
                          <Badge className={
                            reg.status === 'open'
                              ? "bg-apple-blue/15 text-apple-blue apple-text-caption2 rounded-apple-xs px-2 py-0.5 border-0"
                              : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption2 rounded-apple-xs px-2 py-0.5 border-0"
                          }>
                            {reg.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </Badge>
                        </div>
                        <p className="apple-text-footnote apple-label-secondary flex items-center gap-2 flex-wrap">
                          <span className="bg-gray-sys6 dark:bg-gray-sys5 px-2 py-0.5 rounded-apple-xs apple-text-caption2">
                            Apertura: {reg.opened_by?.split(' ')[0]}
                          </span>
                          {reg.closed_by && (
                            <>
                              <span className="apple-label-tertiary">→</span>
                              <span className="bg-gray-sys6 dark:bg-gray-sys5 px-2 py-0.5 rounded-apple-xs apple-text-caption2">
                                Cierre: {reg.closed_by?.split(' ')[0]}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:gap-12 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="apple-text-caption1 apple-label-secondary mb-1">Ventas</p>
                        <p className="apple-text-title3 apple-label-primary tabular-nums">${(reg.total_revenue || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="apple-text-caption1 apple-label-secondary mb-1">Diferencia</p>
                        <p className={`apple-text-title3 tabular-nums ${
                          diff === 0 ? 'apple-label-secondary' :
                          diff > 0 ? 'text-apple-green' : 'text-apple-red'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                        <Button size="icon" aria-label="Ver detalle de cierre" className="apple-btn apple-btn-plain apple-press">
                          <Eye className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRegister} onOpenChange={() => setSelectedRegister(null)}>
        <DialogContent className="max-w-2xl apple-surface-elevated apple-label-primary">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 apple-text-title3 apple-label-primary">
              <Wallet className="w-5 h-5 text-apple-green" />
              Detalle de Cierre
            </DialogTitle>
          </DialogHeader>

          {selectedRegister && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="apple-surface-secondary p-4 rounded-apple-sm">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Apertura</p>
                  <p className="apple-text-title2 apple-label-primary tabular-nums">${selectedRegister.opening_balance?.toFixed(2)}</p>
                  <p className="apple-text-caption1 apple-label-secondary mt-1">{selectedRegister.opened_by}</p>
                </div>
                <div className="apple-surface-secondary p-4 rounded-apple-sm">
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Cierre</p>
                  <p className="apple-text-title2 apple-label-primary tabular-nums">${(selectedRegister.closing_balance || 0).toFixed(2)}</p>
                  <p className="apple-text-caption1 apple-label-secondary mt-1">{selectedRegister.closed_by || "Pendiente"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4
                  className="apple-text-headline apple-label-primary pb-2"
                  style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
                >
                  Resumen Financiero
                </h4>
                <div className="grid grid-cols-2 gap-y-2 apple-text-subheadline">
                  <span className="apple-label-secondary">Total Ventas (Sistema)</span>
                  <span className="text-right apple-label-primary tabular-nums">${(selectedRegister.total_revenue || 0).toFixed(2)}</span>

                  <span className="apple-label-secondary">Efectivo Esperado</span>
                  <span className="text-right apple-label-primary tabular-nums">
                    ${(selectedRegister.final_count?.expectedCash || 0).toFixed(2)}
                  </span>

                  <span className="apple-label-secondary">Efectivo Contado</span>
                  <span className="text-right apple-label-primary tabular-nums">
                    ${(selectedRegister.final_count?.total || 0).toFixed(2)}
                  </span>

                  <span className="apple-label-secondary pt-2 apple-text-headline">Diferencia</span>
                  <span className={`text-right apple-text-headline pt-2 tabular-nums ${
                    (selectedRegister.final_count?.difference || 0) < 0 ? "text-apple-red" : "text-apple-green"
                  }`}>
                    ${(selectedRegister.final_count?.difference || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {selectedRegister.final_count?.denominations && (
                <div className="apple-surface-secondary rounded-apple-sm p-4">
                  <h4 className="apple-text-headline apple-label-primary mb-3">Conteo de Efectivo</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {Object.entries(selectedRegister.final_count.denominations).map(([key, qty]) => {
                      if (qty === 0) return null;
                      const label = key.replace('bills_', '$').replace('coins_', '$').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01');
                      return (
                        <div key={key} className="apple-surface p-2 rounded-apple-xs text-center">
                          <div className="apple-text-caption2 apple-label-secondary tabular-nums">{label}</div>
                          <div className="apple-label-primary font-mono apple-text-footnote tabular-nums">x{qty}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
