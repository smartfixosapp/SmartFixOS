export function Skeleton({ width = "100%", height = 16, radius = 10, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ display: "block", width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCards({ count = 6, height = 214, min = 240 }) {
  return (
    <div role="status" aria-label="Cargando" style={{ display: "grid", gap: 10, gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))` }}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius={14} style={{ animationDelay: `${i * 80}ms` }} />)}
    </div>
  );
}

export function SkeletonRows({ count = 6, height = 64 }) {
  return (
    <div role="status" aria-label="Cargando" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius={14} style={{ animationDelay: `${i * 80}ms` }} />)}
    </div>
  );
}
