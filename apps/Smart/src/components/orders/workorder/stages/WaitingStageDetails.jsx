import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

const suggestedNotes = [
  "Esperando pantalla",
  "Esperando batería",
  "Esperando board para microsoldadura",
  "Equipo en taller de re-manufacturación",
  "Pendiente diagnóstico avanzado",
  "Esperando aprobación de cliente"
];

export default function WaitingStageDetails({ order, onUpdate, user }) {
  const [note, setNote] = useState(order.status_note || '');
  const [visibleToCustomer, setVisibleToCustomer] = useState(order.status_note_visible_to_customer || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Order.update(order.id, {
        status_note: note,
        status_note_visible_to_customer: visibleToCustomer
      });

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: 'status_change',
        description: `Nota de estado 'Esperando Pieza' actualizada.`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email,
        user_role: user?.role,
        metadata: {
          note: note,
          visible_to_customer: visibleToCustomer,
          previous_value: order.status_note,
          new_value: note,
        }
      });
      
      onUpdate();
      alert('✓ Nota guardada.');
    } catch (error) {
      console.error('Error saving status note:', error);
      alert('Error al guardar la nota.');
    }
    setSaving(false);
  };

  return (
    <div className="p-4 space-y-4">
      <h4 className="font-semibold text-white">Motivo / Nota del Estado</h4>
      
      <div className="flex flex-wrap gap-2">
        {suggestedNotes.map(suggestion => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300"
            onClick={() => setNote(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Escribe el motivo o detalles..."
        className="bg-black border-gray-700 text-white min-h-[120px]"
      />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="visibleToCustomer"
          checked={visibleToCustomer}
          onCheckedChange={setVisibleToCustomer}
          className="border-gray-600 data-[state=checked]:bg-red-600"
        />
        <Label htmlFor="visibleToCustomer" className="text-gray-300">
          Mostrar nota al cliente en el portal
        </Label>
      </div>
      
      <Button onClick={handleSave} disabled={saving} className="w-full bg-red-600 hover:bg-red-700">
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Guardando...' : 'Guardar Nota'}
      </Button>
    </div>
  );
}
