import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle } from "lucide-react";

export default function StockWarningBadge({ product, requestedQty = 1 }) {
  if (!product || typeof product.stock !== 'number') {
    return null;
  }

  const stock = Number(product.stock || 0);
  const minStock = Number(product.min_stock || 0);

  // Out of stock
  if (stock === 0) {
    return (
      <Badge className="bg-red-600/20 text-red-300 border-red-600/30 text-xs flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Agotado
      </Badge>
    );
  }

  // Insufficient stock for request
  if (stock < requestedQty) {
    return (
      <Badge className="bg-orange-600/20 text-orange-300 border-orange-600/30 text-xs flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Solo {stock}
      </Badge>
    );
  }

  // Low stock warning
  if (stock <= minStock) {
    return (
      <Badge className="bg-yellow-600/20 text-yellow-300 border-yellow-600/30 text-xs flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Stock bajo ({stock})
      </Badge>
    );
  }

  // Good stock
  return (
    <span className="text-xs text-gray-500">
      {stock} disponibles
    </span>
  );
}

export function canAddToCart(product, requestedQty = 1, qtyInCart = 0) {
  if (!product) return { allowed: false, message: "Producto no encontrado" };

  const stock = Number(product.stock || 0);
  const totalRequested = qtyInCart + requestedQty;

  if (stock === 0) {
    return {
      allowed: false,
      message: `⛔ ${product.name} está AGOTADO`
    };
  }

  if (totalRequested > stock) {
    return {
      allowed: false,
      message: `⚠️ Stock insuficiente de ${product.name}. Disponible: ${stock}, en carrito: ${qtyInCart}`
    };
  }

  return { allowed: true };
}
