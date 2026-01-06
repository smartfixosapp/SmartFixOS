import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, DollarSign, ListFilter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PriceListPanel() {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [productsData, servicesData] = await Promise.all([
        base44.entities.Product.filter({ active: true }),
        base44.entities.Service.filter({ active: true })
      ]);
      
      setProducts(productsData);
      setServices(servicesData);
    } catch (error) {
      console.error("Error loading items:", error);
    }
    setLoading(false);
  };

  const getStockBadge = (product) => {
    if (product.stock === 0) {
      return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">🔴 Agotado</Badge>;
    }
    if (product.stock <= product.min_stock) {
      return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">🟡 Bajo</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">🟢 OK</Badge>;
  };

  const allItems = [
    ...products.map(p => ({ ...p, type: 'product' })),
    ...services.map(s => ({ ...s, type: 'service' }))
  ];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (categoryFilter === "all") return matchesSearch;
    if (categoryFilter === "products") return matchesSearch && item.type === 'product';
    if (categoryFilter === "services") return matchesSearch && item.type === 'service';
    return matchesSearch && item.category === categoryFilter;
  });

  return (
    <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <ListFilter className="w-5 h-5 text-[#FF0000]" />
          Lista de Precios
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="pl-10 bg-black border-gray-700 text-white"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 bg-black border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="products">Productos</SelectItem>
              <SelectItem value="services">Servicios</SelectItem>
              <SelectItem value="screen">Pantallas</SelectItem>
              <SelectItem value="battery">Baterías</SelectItem>
              <SelectItem value="charger">Cargadores</SelectItem>
              <SelectItem value="case">Fundas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No hay resultados</div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-[#FF0000]/50 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.type === 'product' ? (
                        <Package className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      ) : (
                        <DollarSign className="w-4 h-4 text-green-400 flex-shrink-0" />
                      )}
                      <p className="text-white font-medium truncate text-sm">{item.name}</p>
                    </div>
                    
                    {item.compatibility && (
                      <p className="text-xs text-gray-500 truncate mb-2">
                        {item.compatibility}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        ${item.price.toFixed(2)}
                      </Badge>
                      {item.type === 'product' && getStockBadge(item)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
