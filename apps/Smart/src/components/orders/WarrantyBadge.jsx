import React from "react";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

/**
 * Badge permanente que indica que una orden pasó por garantía
 * No se puede editar ni remover - es un marcador histórico
 */
export default function WarrantyBadge({ passed_warranty }) {
  if (!passed_warranty) return null;

  return (
    <Badge 
      className="border-amber-400/35 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(217,119,6,0.18))] text-amber-100 text-xs flex items-center gap-1.5 flex-shrink-0 shadow-[0_0_16px_rgba(251,191,36,0.18)]"
      variant="outline"
      title="Esta orden pasó por garantía"
    >
      <Star className="w-3 h-3 fill-current text-amber-300" />
      Garantía
    </Badge>
  );
}
