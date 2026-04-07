import React from "react";

// CSS shimmer animation (no framer-motion = mucho mas barato en GPU)
const shimmerStyle = `
  @keyframes skeletonShimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .skeleton-shimmer { animation: skeletonShimmer 1.8s ease-in-out infinite; }
`;

function ShimmerOverlay({ via = "white/5" }) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-${via} to-transparent skeleton-shimmer`} />
    </>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[28px] p-6 shadow-xl relative overflow-hidden">
      <ShimmerOverlay />
      <div className="flex items-start gap-4 relative z-10">
        <div className="w-14 h-14 rounded-[20px] bg-white/10" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-white/10 rounded-lg w-2/3" />
          <div className="h-4 bg-white/10 rounded-lg w-1/2" />
          <div className="h-4 bg-white/10 rounded-lg w-3/4" />
        </div>
      </div>
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[28px] p-7 shadow-xl relative overflow-hidden aspect-[1.4/1]">
      <ShimmerOverlay />
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="flex justify-between">
          <div className="w-12 h-12 rounded-[18px] bg-white/10" />
          <div className="w-12 h-8 bg-white/10 rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-white/10 rounded-lg w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function WidgetCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-[28px] p-6 shadow-xl relative overflow-hidden min-h-[150px]">
      <ShimmerOverlay via="cyan-500/10" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="h-4 bg-white/10 rounded w-24" />
        </div>
        <div className="h-10 bg-white/10 rounded-lg w-32" />
        <div className="h-3 bg-white/10 rounded w-20" />
      </div>
    </div>
  );
}
