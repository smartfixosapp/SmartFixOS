import React from 'react';
import { cn } from '@/lib/utils';

export default function IframeWidget({ isMaximized, src }) {
  return (
    <div className={cn("flex flex-col", isMaximized ? "h-full" : "h-64")}>
      <iframe
        src={src}
        className="w-full h-full rounded-lg border border-white/10"
        title="Embedded Content"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
