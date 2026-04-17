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
      <Badge className="apple-type bg-apple-red/15 text-apple-red border-0 apple-text-caption1 flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Agotado
      </Badge>
    );
  }

  // Insufficient stock for request
  if (stock < requestedQty) {
    return (
      <Badge className="apple-type bg-apple-orange/15 text-apple-orange border-0 apple-text-caption1 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Solo {stock}
      </Badge>
    );
  }

  // Low stock warning
  if (stock <= minStock) {
    return (
      <Badge className="apple-type bg-apple-yellow/15 text-apple-yellow border-0 apple-text-caption1 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Stock bajo ({stock})
      </Badge>
    );
  }

  // Good stock
  return (
    <span className="apple-type apple-text-caption1 apple-label-tertiary tabular-nums">
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
