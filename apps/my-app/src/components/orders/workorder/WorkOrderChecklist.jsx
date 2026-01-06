import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, AlertTriangle, ListChecks } from 'lucide-react';

const statusConfig = {
  ok: { icon: Check, color: 'text-green-400', label: 'OK' },
  damaged: { icon: X, color: 'text-red-400', label: 'Daño' },
  not_tested: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Sin Probar' },
};

const nextStatus = {
  not_tested: 'ok',
  ok: 'damaged',
  damaged: 'not_tested',
};

const ChecklistItem = ({ item, onUpdate }) => {
  const { icon: Icon, color, label } = statusConfig[item.status || 'not_tested'];
  
  const handleClick = () => {
    const newStatus = nextStatus[item.status || 'not_tested'];
    onUpdate(item.id, newStatus);
  };

  return (
    <div 
        onClick={handleClick}
        className="p-2 bg-gray-800/60 border border-gray-700 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-700/80 transition-colors"
    >
      <span className="text-white text-sm">{item.label}</span>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
    </div>
  );
};

export default function WorkOrderChecklist({ order, onUpdate, user }) {
  const [checklist, setChecklist] = useState(order.checklist_items || []);

  const handleItemUpdate = (itemId, newStatus) => {
    setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
  };
  
  const handleSaveChanges = async () => {
      try {
          await base44.entities.Order.update(order.id, { checklist_items: checklist });
          await base44.entities.WorkOrderEvent.create({
              order_id: order.id,
              order_number: order.order_number,
              event_type: 'checklist_updated',
              description: 'Checklist de recepción actualizado.',
              user_id: user.id,
              user_name: user.full_name,
          });
          onUpdate();
          // Maybe show a success toast
      } catch (error) {
          console.error("Failed to update checklist:", error);
          // Maybe show an error toast
      }
  };

  const summary = useMemo(() => {
    const total = checklist.length;
    const ok = checklist.filter(i => i.status === 'ok').length;
    const damaged = checklist.filter(i => i.status === 'damaged').length;
    const pending = checklist.filter(i => i.status === 'not_tested').length;
    return { total, ok, damaged, pending };
  }, [checklist]);

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5 text-red-500" /> Checklist de Recepción</CardTitle>
        <Button size="sm" onClick={handleSaveChanges}>Guardar Cambios</Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400 mb-4 p-2 bg-gray-800/50 rounded-md">
            <span><span className="text-green-400 font-bold">{summary.ok}</span> OK</span>
            <span className="text-gray-600">|</span>
            <span><span className="text-red-400 font-bold">{summary.damaged}</span> con Daño</span>
            <span className="text-gray-600">|</span>
            <span><span className="text-yellow-400 font-bold">{summary.pending}</span> Pendientes</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {checklist.map(item => (
                <ChecklistItem key={item.id} item={item} onUpdate={handleItemUpdate} />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
