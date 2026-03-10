import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Image as ImageIcon } from "lucide-react";
import OrderPhotosGallery from "../../orders/OrderPhotosGallery";

export default function ProblemSection({ order }) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Problema Reportado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Descripción</label>
          <p className="text-white whitespace-pre-wrap">
            {order.initial_problem || "Sin descripción"}
          </p>
        </div>

        {order.photos_metadata?.length > 0 && (
          <div className="pt-4 border-t border-gray-800">
            <label className="text-sm text-gray-400 mb-3 block flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Fotos del equipo ({order.photos_metadata.length})
            </label>
            <OrderPhotosGallery photos={order.photos_metadata} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
