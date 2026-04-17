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
      className="apple-type rounded-apple-sm bg-apple-yellow/15 text-apple-yellow apple-text-caption1 font-semibold flex items-center gap-1.5 flex-shrink-0 border-0"
      variant="outline"
      title="Esta orden pasó por garantía"
    >
      <Star className="w-3 h-3 fill-current text-apple-yellow" />
      Garantía
    </Badge>
  );
}
