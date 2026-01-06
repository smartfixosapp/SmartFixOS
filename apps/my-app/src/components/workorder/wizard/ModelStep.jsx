import React from "react";
import BrandIconGrid from "./BrandIconGrid";
import FamilyIconGrid from "./FamilyIconGrid";

export default function ModelStep(props) {
  const { formData } = props;

  // 1. Si no hay categoría, algo salió mal
  if (!formData.device_category) {
    return <div className="text-center py-12 text-gray-400">Primero selecciona una categoría</div>;
  }

  // 2. Si no hay marca, mostrar marcas
  if (!formData.device_brand) {
    return <BrandIconGrid {...props} />;
  }
  
  // 3. Si hay marca, mostrar familias (como "Modelos")
  return <FamilyIconGrid {...props} />;
}
