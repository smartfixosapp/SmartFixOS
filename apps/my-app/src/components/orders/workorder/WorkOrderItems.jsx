import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, Check, Link as LinkIcon, Briefcase, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const currency = (n) => `$${Number(n || 0).toFixed(2)}`;

const PartCard = ({ item, onRemove, onMarkAsReceived }) => {
  const isFromWizard = item.source === 'wizard';
  const waitingForSupplier = item.status === 'waiting_supplier';

  return (
    <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-2">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-bold text-white flex items-center gap-2">
            {isFromWizard ? <LinkIcon className="w-4 h-4 text-purple-400" /> : <Briefcase className="w-4 h-4 text-blue-400" />}
            {item.name}
          </p>
          <p className="text-lg font-semibold text-green-400">
            {currency(item.price)}
          </p>
          {typeof item.cost === 'number' && (
            <p className="text-xs text-gray-400">Costo: {currency(item.cost)}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-sm text-gray-300">Cant: {item.quantity}</p>
          <Badge
            variant={isFromWizard ? 'secondary' : 'outline'}
            className={
              isFromWizard
                ? 'border-purple-500/50 bg-purple-900/50 text-purple-300'
                : 'border-blue-500/50 bg-blue-900/50 text-blue-300'
            }
          >
            {isFromWizard ? 'Desde Wizard' : (item.source === 'inventory' ? 'Inventario' : 'Manual')}
          </Badge>
        </div>
      </div>

      {waitingForSupplier && (
        <div className="text-xs text-orange-400/90 border-t border-orange-800 pt-2">
          <p>
            Esperando suplidor: <span className="font-semibold">{item.supplier}</span>
          </p>
          {item.trackingNumber && <p>Tracking: {item.trackingNumber}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
        {waitingForSupplier && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onMarkAsReceived(item.id)}>
            <Check className="w-3 h-3 mr-1" />
            Marcar Recibida
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-slate-50 px-3 text-xs font-medium h-7">
          <Edit className="w-3 h-3 mr-1" />
          Editar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => onRemove(item.id)}>
          <Trash2 className="w-3 h-3 mr-1" />
          Eliminar
        </Button>
      </div>
    </div>
  );
};

// Buscador de inventario (agarra precio/costo del producto)
function InventoryPicker({ onPick }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        // Ajusta a tu endpoint real (ej: Product.search(query) o Product.list con filtros)
        const res = (await base44.entities.Product.search?.(q)) || [];
        setItems(Array.isArray(res) ? res : []);
      } catch (e) {
        console.error('Inventario search error', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-white/70" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en inventario (SKU, nombre, compatibilidad)…"
          className="bg-transparent text-sm flex-1 outline-none placeholder:text-white/40"
        />
      </div>

      <div className="mt-3 max-h-56 overflow-y-auto app-scroll space-y-2">
        {loading && <div className="text-xs text-white/50">Buscando…</div>}
        {!loading &&
          items.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                onPick?.({
                  id: p.id,
                  name: p.name,
                  price: p.retail_price ?? p.price ?? 0,
                  cost: p.cost ?? 0,
                  sku: p.sku,
                  stock: p.stock,
                })
              }
              className="w-full text-left rounded-lg border border-white/10 bg-black/30 hover:bg-black/40 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-white/50 truncate">{p.sku || p.brand}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{currency(p.retail_price ?? p.price)}</p>
                  {typeof p.stock === 'number' && (
                    <p className="text-[11px] text-white/50">Stock: {p.stock}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        {!loading && q && items.length === 0 && (
          <div className="text-xs text-white/40">Sin resultados.</div>
        )}
      </div>
    </div>
  );
}

export default function WorkOrderItems({ order, onUpdate, user }) {
  const [items, setItems] = useState(order.parts_needed || []);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, cost: 0, price: 0, supplier: '' });

  useEffect(() => {
    setItems(order.parts_needed || []);
  }, [order]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0),
    [items]
  );
  const tax = subtotal * 0.115;
  const total = subtotal + tax;

  const persistItems = async (next) => {
    const write = base44.entities.Order.patch || base44.entities.Order.update;
    await write(order.id, { parts_needed: next });
  };

  const handleAddItem = async () => {
    const updatedItems = [
      ...items,
      { ...newItem, id: `manual-${Date.now()}`, type: 'product', source: 'manual' },
    ];
    try {
      await persistItems(updatedItems);
      // Log
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: 'item_added',
        description: `Añadido manualmente: ${newItem.name} (x${newItem.quantity})`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email,
      });
      setItems(updatedItems);
      setShowAddDialog(false);
      setNewItem({ name: '', quantity: 1, cost: 0, price: 0, supplier: '' });
      onUpdate?.();
    } catch (e) {
      console.error('Failed to add item', e);
      alert('No se pudo añadir el item');
    }
  };

  const handleRemoveItem = async (itemId) => {
    const itemToRemove = items.find((i) => i.id === itemId);
    const updatedItems = items.filter((i) => i.id !== itemId);
    try {
      await persistItems(updatedItems);
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: 'item_removed',
        description: `Eliminado: ${itemToRemove?.name}`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email,
      });
      setItems(updatedItems);
      onUpdate?.();
    } catch (e) {
      console.error('Failed to remove item', e);
    }
  };

  const handleMarkAsReceived = async (itemId) => {
    const next = items.map((i) => (i.id === itemId ? { ...i, status: 'received' } : i));
    try {
      await persistItems(next);
      setItems(next);
      onUpdate?.();
    } catch (e) {
      console.error('Failed to mark as received', e);
    }
  };

  // Nueva: añadir desde inventario (coge price/cost del producto)
  const addFromInventory = async (p) => {
    const line = {
      id: `inv-${p.id}-${Date.now()}`,
      type: 'product',
      source: 'inventory',
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      quantity: 1,
      price: Number(p.price ?? 0),
      cost: Number(p.cost ?? 0),
    };
    const updated = [...items, line];
    try {
      await persistItems(updated);
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: 'item_added',
        description: `Inventario: ${p.name} (x1) - ${currency(p.price)}`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email,
      });
      setItems(updated);
      onUpdate?.();
    } catch (e) {
      console.error('Inventario add error', e);
      alert('No se pudo agregar desde inventario');
    }
  };

  const wizardPartsCount = useMemo(() => items.filter((i) => i.source === 'wizard').length, [items]);
  const invPartsCount = useMemo(() => items.filter((i) => i.source === 'inventory').length, [items]);

  return (
    <>
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-slate-50 text-2xl font-semibold tracking-tight leading-none">
              Piezas y Servicios
            </CardTitle>
            {wizardPartsCount > 0 && (
              <Badge variant="secondary" className="border-purple-500/50 bg-purple-900/50 text-purple-300">
                {wizardPartsCount} desde Wizard
              </Badge>
            )}
            {invPartsCount > 0 && (
              <Badge variant="outline" className="border-blue-500/50 bg-blue-900/30 text-blue-300">
                {invPartsCount} inventario
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Añadir Manual
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Picker inventario */}
          <InventoryPicker
            onPick={(prod) =>
              addFromInventory({
                id: prod.id,
                name: prod.name,
                price: prod.price ?? prod.retail_price ?? 0,
                cost: prod.cost ?? 0,
                sku: prod.sku,
                stock: prod.stock,
              })
            }
          />

          {/* Lista */}
          {items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <PartCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemoveItem}
                  onMarkAsReceived={handleMarkAsReceived}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay piezas o servicios añadidos.</p>
          )}

          {/* Totales */}
          <div className="mt-2 pt-4 border-t border-gray-700 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal:</span>
                <span className="text-white">{currency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IVU (11.5%):</span>
                <span className="text-white">{currency(tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span className="text-gray-200">Total Estimado:</span>
                <span className="text-green-400">{currency(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Añadir Manual */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>Añadir Pieza/Servicio Manualmente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Nombre de la pieza o servicio"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="Cantidad"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value, 10) || 1 })}
              />
              <Input
                type="number"
                placeholder="Costo"
                value={newItem.cost}
                onChange={(e) => setNewItem({ ...newItem, cost: parseFloat(e.target.value) || 0 })}
              />
              <Input
                type="number"
                placeholder="Precio"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddItem} disabled={!newItem.name || !newItem.price}>
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
