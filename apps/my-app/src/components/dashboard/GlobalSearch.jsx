import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { debounce } from 'lodash';
import { createPageUrl } from '@/components/utils/helpers';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (searchQuery.length < 3) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const normalizedQuery = searchQuery.toLowerCase().replace(/[- ]/g, '');

      const orders = await base44.entities.Order.list('-created_date', 100);

      const filtered = orders.filter((order) =>
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone?.replace(/\D/g, '').includes(normalizedQuery) ||
      order.customer_email && order.customer_email.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8);

      setResults(filtered);
      setLoading(false);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleSelect = (orderId) => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    navigate(createPageUrl(`Orders?order=${orderId}`), { state: { fromDashboard: true } });
  };

  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Buscar orden, cliente, teléfono..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)} className="bg-gray-900 text-slate-50 pl-10 px-3 py-2 text-lg rounded-md flex w-full border ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-12 border-gray-700" />


        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 animate-spin" />}
      </div>

      {isOpen && (query.length > 2 || results.length > 0) &&
      <div className="absolute top-full mt-2 w-full bg-[#2B2B2B] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          {results.length > 0 ?
        <ul className="divide-y divide-gray-700">
              {results.map((order) =>
          <li
            key={order.id}
            onMouseDown={() => handleSelect(order.id)} // onMouseDown fires before onBlur
            className="p-3 hover:bg-red-900/30 cursor-pointer">

                  <p className="font-bold text-white">{order.order_number}</p>
                  <p className="text-sm text-gray-300">{order.customer_name}</p>
                  <p className="text-xs text-gray-500">{order.device_brand} {order.device_model}</p>
                </li>
          )}
            </ul> :

        !loading && query.length > 2 && <p className="p-4 text-gray-400">Sin coincidencias.</p>
        }
        </div>
      }
    </div>);

}
