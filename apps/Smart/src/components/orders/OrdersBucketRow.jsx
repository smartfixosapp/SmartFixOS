import { LayoutGrid } from "lucide-react";
import { DEVICE_BUCKETS } from "@/lib/deviceBucket";
import { BUCKET_STYLE } from "@/components/orders/orderBits";
import { tint } from "@/components/orderDetail/ui";

const BRAND = "#F2662E";

function BucketTile({ Icon, color, label, count, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={selected}
      className="apple-press"
      style={{
        display: "flex", alignItems: "center", gap: 8, minWidth: 0, height: 52, padding: "0 10px", borderRadius: 12,
        background: selected ? tint(color, 0.14) : "#1C1C1E",
        border: `${selected ? 1.5 : 1}px solid ${tint(color, selected ? 0.7 : 0.12)}`,
        opacity: count === 0 && !selected ? 0.5 : 1,
      }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 8, background: tint(color, selected ? 0.28 : 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-4 h-4" />
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, lineHeight: 1.15 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{count}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </span>
    </button>
  );
}

export default function OrdersBucketRow({ bucket, counts, total, onSelect }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, paddingBottom: 18 }}>
      <BucketTile Icon={LayoutGrid} color={BRAND} label="Todos" count={total} selected={!bucket} onClick={() => onSelect(null)} />
      {DEVICE_BUCKETS.map((b) => {
        const { Icon, color } = BUCKET_STYLE[b.id];
        return (
          <BucketTile key={b.id} Icon={Icon} color={color} label={b.label} count={counts[b.id] || 0} selected={bucket === b.id} onClick={() => onSelect(bucket === b.id ? null : b.id)} />
        );
      })}
    </div>
  );
}
