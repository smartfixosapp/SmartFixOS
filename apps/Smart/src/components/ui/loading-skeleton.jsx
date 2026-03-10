import React from "react";
import { motion } from "framer-motion";

export function OrderCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-6 shadow-xl relative overflow-hidden">
      {/* Shimmer animation */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      <div className="flex items-start gap-4 relative z-10">
        <div className="w-14 h-14 rounded-[20px] bg-white/10 animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-white/10 rounded-lg w-2/3 animate-pulse" />
          <div className="h-4 bg-white/10 rounded-lg w-1/2 animate-pulse" />
          <div className="h-4 bg-white/10 rounded-lg w-3/4 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-7 shadow-xl relative overflow-hidden aspect-[1.4/1]">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="flex justify-between">
          <div className="w-12 h-12 rounded-[18px] bg-white/10 animate-pulse" />
          <div className="w-12 h-8 bg-white/10 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-white/10 rounded-lg w-2/3 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function WidgetCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-[28px] p-6 backdrop-blur-xl shadow-xl relative overflow-hidden min-h-[150px]">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent"
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          <div className="h-4 bg-white/10 rounded w-24 animate-pulse" />
        </div>
        <div className="h-10 bg-white/10 rounded-lg w-32 animate-pulse" />
        <div className="h-3 bg-white/10 rounded w-20 animate-pulse" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}
