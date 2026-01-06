import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";
import OrderChecklistBadges from "../../orders/OrderChecklistBadges";

export default function ChecklistSection({ order }) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5" />
          Checklist de Recepción
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.checklist_items?.length > 0 ? (
          <>
            <OrderChecklistBadges items={order.checklist_items} />
            
            {order.checklist_notes && (
              <div className="pt-4 border-t border-gray-800">
                <label className="text-sm text-gray-400 mb-2 block">Notas adicionales</label>
                <p className="text-white whitespace-pre-wrap bg-black/30 border border-gray-800 rounded-lg p-3">
                  {order.checklist_notes}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 text-sm">No se completó checklist de recepción</p>
        )}
      </CardContent>
    </Card>
  );
}
