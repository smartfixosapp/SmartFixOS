import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function PerformanceTab({ settings, onChange }) {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-white/10">
        <CardHeader>
          <CardTitle>Rendimiento</CardTitle>
          <CardDescription>Optimización y caché</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Intervalo de polling (ms)</Label>
            <Input
              type="number"
              min="1000"
              step="1000"
              value={settings.poll_interval_ms}
              onChange={(e) => onChange({ ...settings, poll_interval_ms: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="space-y-2">
            <Label>TTL de caché (segundos)</Label>
            <Input
              type="number"
              min="0"
              value={settings.cache_ttl_seconds}
              onChange={(e) => onChange({ ...settings, cache_ttl_seconds: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
            <div>
              <Label>Lazy load en listas</Label>
              <p className="text-xs text-gray-400">Cargar items bajo demanda</p>
            </div>
            <Switch
              checked={settings.lazy_load_lists}
              onCheckedChange={(v) => onChange({ ...settings, lazy_load_lists: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Umbral de virtual scroll</Label>
            <Input
              type="number"
              min="10"
              value={settings.virtual_scroll_threshold}
              onChange={(e) => onChange({ ...settings, virtual_scroll_threshold: Number(e.target.value) })}
              className="bg-black border-white/15"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
