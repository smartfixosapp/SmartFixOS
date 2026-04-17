import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export default function PerformanceTab({ settings, onChange }) {
  return (
    <div className="apple-type space-y-6">
      <Card className="apple-card border-0">
        <CardHeader>
          <CardTitle className="apple-text-title3 apple-label-primary">Rendimiento</CardTitle>
          <CardDescription className="apple-text-subheadline apple-label-secondary">Optimización y caché</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Intervalo de polling (ms)</Label>
            <Input
              type="number"
              min="1000"
              step="1000"
              value={settings.poll_interval_ms}
              onChange={(e) => onChange({ ...settings, poll_interval_ms: Number(e.target.value) })}
              className="apple-input tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">TTL de caché (segundos)</Label>
            <Input
              type="number"
              min="0"
              value={settings.cache_ttl_seconds}
              onChange={(e) => onChange({ ...settings, cache_ttl_seconds: Number(e.target.value) })}
              className="apple-input tabular-nums"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            <div>
              <Label className="apple-text-body apple-label-primary">Lazy load en listas</Label>
              <p className="apple-text-caption1 apple-label-tertiary">Cargar items bajo demanda</p>
            </div>
            <Switch
              checked={settings.lazy_load_lists}
              onCheckedChange={(v) => onChange({ ...settings, lazy_load_lists: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary">Umbral de virtual scroll</Label>
            <Input
              type="number"
              min="10"
              value={settings.virtual_scroll_threshold}
              onChange={(e) => onChange({ ...settings, virtual_scroll_threshold: Number(e.target.value) })}
              className="apple-input tabular-nums"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
