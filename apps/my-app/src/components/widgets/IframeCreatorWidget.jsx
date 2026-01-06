import React, { useState } from 'react';
import { Plus, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function IframeCreatorWidget({ isMaximized, onCreateWidget }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    // Ensure URL has protocol
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    
    onCreateWidget({
      url: finalUrl,
      name: name.trim() || new URL(finalUrl).hostname
    });
    
    setUrl('');
    setName('');
  };

  return (
    <div className={cn("flex flex-col", isMaximized && "h-full justify-center max-w-md mx-auto")}>
      <div className="text-center mb-6">
        <div className={cn(
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-4",
          isMaximized ? "w-20 h-20" : "w-14 h-14"
        )}>
          <Globe className={cn("text-cyan-400", isMaximized ? "w-10 h-10" : "w-7 h-7")} />
        </div>
        <h3 className={cn("font-medium text-white/90", isMaximized ? "text-xl" : "text-sm")}>
          Create Iframe Widget
        </h3>
        <p className="text-white/50 text-sm mt-1">
          Embed any website as a widget
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL (e.g., example.com)"
            className={cn(
              "bg-white/10 border-white/10 text-white placeholder-white/30",
              "focus:border-cyan-500/50 focus:ring-cyan-500/20"
            )}
          />
        </div>
        <div>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Widget name (optional)"
            className={cn(
              "bg-white/10 border-white/10 text-white placeholder-white/30",
              "focus:border-cyan-500/50 focus:ring-cyan-500/20"
            )}
          />
        </div>
        <Button
          type="submit"
          disabled={!url.trim()}
          className={cn(
            "w-full bg-gradient-to-r from-cyan-500 to-blue-500",
            "hover:from-cyan-600 hover:to-blue-600",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Widget
        </Button>
      </form>
    </div>
  );
}
