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
    <div className="bg-white/5 border border-white/10 rounded-[24px] p-6 backdrop-blur-xl shadow-lg mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
            <Check className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Checklist de Recepción</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="bg-white/5 border-white/10 text-white/60 text-[10px] h-5">{summary.total} condiciones</Badge>
            </div>
          </div>
        </div>
        <Button 
          size="sm" 
          onClick={handleSaveChanges}
          className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl"
        >
          Guardar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {checklist.map(item => (
          <div 
            key={item.id}
            onClick={() => handleItemUpdate(item.id, nextStatus[item.status || 'not_tested'])}
            className={`
              relative p-4 rounded-[16px] border transition-all duration-200 cursor-pointer group select-none
              ${item.status === 'ok' ? 'bg-green-500/10 border-green-500/30' : 
                item.status === 'damaged' ? 'bg-red-900/20 border-red-500/30' : 
                'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'}
            `}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${item.status === 'not_tested' ? 'text-white/60' : 'text-white'}`}>
                {item.label}
              </span>
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center transition-all
                ${item.status === 'ok' ? 'bg-green-500 text-black' : 
                  item.status === 'damaged' ? 'bg-red-500 text-white' : 
                  'bg-white/10 text-white/20'}
              `}>
                {statusConfig[item.status || 'not_tested'].icon({ className: "w-3.5 h-3.5" })}
              </div>
            </div>
            
            {item.status === 'damaged' && (
              <p className="text-[10px] text-red-400 mt-2 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Daño reportado
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
