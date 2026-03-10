import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function UsefulLinksWidget() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "useful-links" });
      
      if (configs?.length > 0) {
        const payload = configs[0].payload;
        const linksData = Array.isArray(payload) ? payload : (payload?.links || []);
        setLinks(linksData);
      } else {
        setLinks([]);
      }
    } catch (error) {
      console.error("Error loading links:", error);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkClick = (url, name) => {
    window.open(url, '_blank');
    toast.success(`✅ Abriendo ${name}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="text-center py-8">
        <ExternalLink className="w-10 h-10 mx-auto text-gray-600 mb-3 opacity-50" />
        <p className="text-gray-400 text-sm">
          No hay enlaces configurados
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Ve a Configuración → Enlaces Útiles
        </p>
      </div>
    );
  }

  const gradients = [
    "from-purple-600 to-pink-600",
    "from-blue-600 to-cyan-600",
    "from-emerald-600 to-teal-600",
    "from-orange-600 to-red-600",
    "from-indigo-600 to-purple-600"
  ];

  return (
    <div className="grid grid-cols-1 gap-2">
      {links.map((link, idx) => (
        <button
          key={idx}
          onClick={() => handleLinkClick(link.url, link.name)}
          className={`
            relative overflow-hidden bg-gradient-to-r ${gradients[idx % gradients.length]} 
            text-white p-3 rounded-xl text-left transition-all 
            hover:scale-105 hover:shadow-lg active:scale-95
          `}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{link.name}</p>
              <p className="text-xs opacity-80 truncate">{link.url}</p>
            </div>
            <ExternalLink className="w-4 h-4 ml-2 flex-shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
}
