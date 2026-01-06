
import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X, Box, Search, Wrench, Clock, Check, Truck, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Import stage-specific content components
import WorkOrderChecklist from './WorkOrderChecklist';
import WorkOrderComments from './WorkOrderComments';
import WorkOrderPayments from './WorkOrderPayments';
import WaitingStageDetails from './stages/WaitingStageDetails';

const stagesConfig = {
  intake: { label: 'Recepción', icon: Box },
  diagnosing: { label: 'Diagnóstico', icon: Search },
  in_progress: { label: 'En Reparación', icon: Wrench },
  waiting_parts: { label: 'Esperando Pieza', icon: Clock },
  ready_for_pickup: { label: 'Listo para Recoger', icon: Check },
  checkout: { label: 'Para Cobrar', icon: ShoppingCart },
  picked_up: { label: 'Entregado', icon: Truck },
};

const stageIdToStatusMap = {
  intake: 'intake',
  diagnosing: 'diagnosing',
  in_progress: 'in_progress',
  waiting_parts: 'waiting_parts',
  ready_for_pickup: 'ready_for_pickup',
  checkout: 'checkout',
  picked_up: 'picked_up',
};

export default function StageDetailDrawer({ open, onClose, stageId, order, onUpdate, user }) {
  const [currentStageConfig, setCurrentStageConfig] = useState(null);
  const [stageHistory, setStageHistory] = useState(null);

  useEffect(() => {
    if (stageId && order) {
      const config = Object.values(stagesConfig).find((s, i) => {
        const key = Object.keys(stagesConfig)[i];
        return key === stageId;
      });
      setCurrentStageConfig(config);

      const relevantStatus = stageIdToStatusMap[stageId];
      const historyEntry = (order.status_history || [])
        .filter(h => h.status === relevantStatus)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      setStageHistory(historyEntry);
    } else {
      setCurrentStageConfig(null);
      setStageHistory(null);
    }
  }, [stageId, order]);

  const renderStageContent = () => {
    if (!stageId) return null;

    switch (stageId) {
      case 'intake':
        return <WorkOrderChecklist order={order} onUpdate={onUpdate} user={user} />;
      case 'diagnosing':
        return <WorkOrderComments title="Notas de Diagnóstico" context="diagnosing" order={order} onUpdate={onUpdate} user={user} />;
      case 'in_progress':
        return <WorkOrderComments title="Actividad de Reparación" context="all" order={order} onUpdate={onUpdate} user={user} />;
      case 'waiting_parts':
        return <WaitingStageDetails order={order} onUpdate={onUpdate} user={user} />;
      case 'ready_for_pickup':
      case 'checkout':
        return <WorkOrderPayments order={order} onUpdate={onUpdate} user={user} />;
      case 'picked_up':
        return (
          <div className="p-4">
            <h4 className="font-semibold text-white mb-2">Confirmación de Entrega</h4>
            {order.customer_signature ? (
              <div>
                <p className="text-gray-300 mb-2">Firma del cliente:</p>
                <img src={order.customer_signature} alt="Firma" className="bg-white rounded-md" />
              </div>
            ) : (
              <p className="text-gray-400">No se registró firma de entrega.</p>
            )}
          </div>
        );
      default:
        return <p className="p-4 text-gray-400">No hay detalles específicos para esta etapa.</p>;
    }
  };

  const Icon = currentStageConfig?.icon || Box;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-2/3 lg:w-1/2 xl:w-1/3 bg-gradient-to-br from-[#1a1a1a] to-black border-l-red-900/30 text-white flex flex-col p-0">
        {currentStageConfig && (
          <>
            <SheetHeader className="p-4 border-b border-gray-800 bg-black/50 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div>
                  <SheetTitle className="text-2xl font-bold text-white flex items-center gap-3">
                    <Icon className="w-7 h-7 text-red-500" />
                    {currentStageConfig.label}
                  </SheetTitle>
                  {stageHistory && (
                    <SheetDescription className="text-gray-400 text-xs mt-2">
                      Alcanzada el {format(new Date(stageHistory.timestamp), "d MMM yyyy, hh:mm a", { locale: es })} por {stageHistory.changed_by}
                    </SheetDescription>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-red-900/30">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {renderStageContent()}
            </div>
            <SheetFooter className="p-4 border-t border-gray-800 bg-black/50">
              <Button onClick={onClose} variant="outline" className="w-full border-gray-700">Cerrar</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
