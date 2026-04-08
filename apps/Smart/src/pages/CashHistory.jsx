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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] p-4 sm:p-6 pb-24">
      <div className="max-w-[1920px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Volver"
              className="text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Wallet className="w-8 h-8 text-emerald-500" />
                Historial de Caja
              </h1>
              <p className="text-gray-400">Registro detallado de aperturas y cierres</p>
            </div>
          </div>
          <Button onClick={exportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-xs text-gray-400">Fecha Inicio</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-black/20 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-xs text-gray-400">Fecha Fin</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-black/20 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2 flex-1 w-full">
              <label className="text-xs text-gray-400">Buscar Usuario</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input 
                  placeholder="Nombre de empleado..." 
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="bg-black/20 border-white/10 text-white pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div className="grid gap-4">
          {filteredRegisters.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white/5 rounded-2xl border border-white/5 border-dashed">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron registros</p>
            </div>
          ) : (
            filteredRegisters.map((reg) => {
              const diff = reg.final_count?.difference || 0;
              const hasDiff = Math.abs(diff) > 0.05;
              
              return (
                <Card 
                  key={reg.id} 
                  className="bg-white/5 hover:bg-white/10 border-white/5 transition-all cursor-pointer group"
                  onClick={() => setSelectedRegister(reg)}
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        reg.status === 'open' ? 'bg-blue-500/20 text-blue-400' : 
                        hasDiff ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {reg.status === 'open' ? <Wallet className="w-6 h-6" /> : 
                         hasDiff ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-bold text-lg">
                            {format(parseISO(reg.date), "dd MMMM yyyy", { locale: es })}
                          </h3>
                          <Badge variant={reg.status === 'open' ? "default" : "secondary"} className={
                            reg.status === 'open' ? "bg-blue-500/20 text-blue-300" : "bg-zinc-700 text-zinc-300"
                          }>
                            {reg.status === 'open' ? 'Abierta' : 'Cerrada'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                          <span className="bg-white/10 px-2 py-0.5 rounded text-xs">
                            Apertura: {reg.opened_by?.split(' ')[0]}
                          </span>
                          {reg.closed_by && (
                            <>
                              <span className="text-gray-600">→</span>
                              <span className="bg-white/10 px-2 py-0.5 rounded text-xs">
                                Cierre: {reg.closed_by?.split(' ')[0]}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:gap-12 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ventas</p>
                        <p className="text-xl font-bold text-white">${(reg.total_revenue || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Diferencia</p>
                        <p className={`text-xl font-bold ${
                          diff === 0 ? 'text-gray-400' :
                          diff > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                        <Button variant="ghost" size="icon" aria-label="Ver detalle de cierre" className="text-gray-400 hover:text-white">
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
        <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-5 h-5 text-emerald-500" />
              Detalle de Cierre
            </DialogTitle>
          </DialogHeader>
          
          {selectedRegister && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Apertura</p>
                  <p className="text-2xl font-bold text-white">${selectedRegister.opening_balance?.toFixed(2)}</p>
                  <p className="text-xs text-zinc-400 mt-1">{selectedRegister.opened_by}</p>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase mb-1">Cierre</p>
                  <p className="text-2xl font-bold text-white">${(selectedRegister.closing_balance || 0).toFixed(2)}</p>
                  <p className="text-xs text-zinc-400 mt-1">{selectedRegister.closed_by || "Pendiente"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-zinc-300 border-b border-zinc-800 pb-2">Resumen Financiero</h4>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-zinc-400">Total Ventas (Sistema)</span>
                  <span className="text-right text-white font-medium">${(selectedRegister.total_revenue || 0).toFixed(2)}</span>
                  
                  <span className="text-zinc-400">Efectivo Esperado</span>
                  <span className="text-right text-white font-medium">
                    ${(selectedRegister.final_count?.expectedCash || 0).toFixed(2)}
                  </span>
                  
                  <span className="text-zinc-400">Efectivo Contado</span>
                  <span className="text-right text-white font-medium">
                    ${(selectedRegister.final_count?.total || 0).toFixed(2)}
                  </span>

                  <span className="text-zinc-400 pt-2 font-bold">Diferencia</span>
                  <span className={`text-right font-bold pt-2 ${
                    (selectedRegister.final_count?.difference || 0) < 0 ? "text-red-400" : "text-emerald-400"
                  }`}>
                    ${(selectedRegister.final_count?.difference || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {selectedRegister.final_count?.denominations && (
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                  <h4 className="font-semibold text-zinc-300 text-sm mb-3">Conteo de Efectivo</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                    {Object.entries(selectedRegister.final_count.denominations).map(([key, qty]) => {
                      if (qty === 0) return null;
                      const label = key.replace('bills_', '$').replace('coins_', '$').replace('050', '0.50').replace('025', '0.25').replace('010', '0.10').replace('005', '0.05').replace('001', '0.01');
                      return (
                        <div key={key} className="bg-zinc-950 p-2 rounded text-center border border-zinc-800">
                          <div className="text-zinc-500">{label}</div>
                          <div className="text-white font-mono">x{qty}</div>
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
