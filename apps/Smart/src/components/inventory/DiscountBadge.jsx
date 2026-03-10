import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tag, Zap } from 'lucide-react';

export default function DiscountBadge({ product, showLabel = true }) {
  if (!product.discount_active || !product.discount_percentage) {
    return null;
  }

  // Verificar si el descuento expiró
  if (product.discount_end_date) {
    const endDate = new Date(product.discount_end_date);
    if (endDate < new Date()) {
      return null;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className="bg-gradient-to-r from-red-600 to-orange-600 text-white border-red-500/30 animate-pulse">
        <Zap className="w-3 h-3 mr-1" />
        -{product.discount_percentage}%
      </Badge>
      {showLabel && product.discount_label && (
        <Badge variant="outline" className="text-xs text-orange-300 border-orange-500/30">
          <Tag className="w-3 h-3 mr-1" />
          {product.discount_label}
        </Badge>
      )}
    </div>
  );
}

export function calculateDiscountedPrice(product) {
  if (!product.discount_active || !product.discount_percentage) {
    return product.price;
  }

  // Verificar expiración
  if (product.discount_end_date) {
    const endDate = new Date(product.discount_end_date);
    if (endDate < new Date()) {
      return product.price;
    }
  }

  const discount = (product.price * product.discount_percentage) / 100;
  return product.price - discount;
}

export function formatPriceWithDiscount(product) {
  const hasActiveDiscount = product.discount_active && 
    product.discount_percentage > 0 && 
    (!product.discount_end_date || new Date(product.discount_end_date) >= new Date());

  if (!hasActiveDiscount) {
    return {
      finalPrice: product.price,
      originalPrice: null,
      savings: 0
    };
  }

  const finalPrice = calculateDiscountedPrice(product);
  const savings = product.price - finalPrice;

  return {
    finalPrice,
    originalPrice: product.price,
    savings
  };
}
