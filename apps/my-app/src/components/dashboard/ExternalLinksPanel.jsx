import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Smartphone, Package, Wrench, Globe } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/utils/i18n";

export default function ExternalLinksPanel() {
  const { t } = useI18n();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setError(false);
      const settings = await base44.entities.AppSettings.filter({ slug: "useful-links" });
      if (settings?.length) {
        const payload = settings[0].payload;
        const linksData = Array.isArray(payload) ? payload : (payload?.links || []);
        setLinks(linksData);
      } else {
        setLinks([]);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading links:", err);
      setError(true);
      setLoading(false);
      setLinks([]);
    }
  };

  const openLink = (link) => {
    window.open(link.url, "_blank", "noopener,noreferrer");
    toast.success(`Abriendo ${link.name}`);
  };

  const getCategoryColor = (index) => {
    const colors = [
      "from-purple-600/20 to-purple-800/20 border-purple-500/30 text-purple-300",
      "from-blue-600/20 to-blue-800/20 border-blue-500/30 text-blue-300",
      "from-green-600/20 to-green-800/20 border-green-500/30 text-green-300",
      "from-emerald-600/20 to-emerald-800/20 border-emerald-500/30 text-emerald-300",
      "from-teal-600/20 to-teal-800/20 border-teal-500/30 text-teal-300"
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <CardContent className="py-8">
          <div className="text-center text-gray-400">{t('loading')}</div>
        </CardContent>
      </Card>
    );
  }

  if (error || links.length === 0) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-red-500" />
            {t('usefulLinks')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Globe className="w-12 h-12 mx-auto mb-3 text-gray-600 opacity-50" />
            <p className="text-gray-400 text-sm">
              {error ? t('couldNotLoadLinks') : t('noLinksConfigured')}
            </p>
            {!error && (
              <p className="text-gray-500 text-xs mt-1">{t('addInSettings')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // AI FIX: b2b customer support - Improved responsive layout for links
  return (
    <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] theme-light:bg-white theme-light:border-gray-200">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
          <ExternalLink className="w-5 h-5 text-red-500 theme-light:text-red-600" />
          {t('usefulLinks')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid grid-cols-1 gap-3 ${links.length > 5 ? 'max-h-[400px] overflow-y-auto scrollbar-thin' : ''}`}>
          {links.map((link, index) => {
            const colorClass = getCategoryColor(index);
            
            return (
              <button
                key={index}
                onClick={() => openLink(link)}
                className={`group relative p-4 rounded-xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg bg-gradient-to-br ${colorClass} backdrop-blur-sm theme-light:shadow-md`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center flex-shrink-0 theme-light:bg-white/80">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-white truncate theme-light:text-gray-900">
                      {link.name}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5 truncate theme-light:text-gray-600">
                      {link.url}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
