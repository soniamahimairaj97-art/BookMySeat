import { T } from "../theme";

export default function CapacityRing({ occupied, capacity }) {
  const pct = capacity ? Math.min(occupied / capacity, 1) : 0;
  const r = 52, c = 2 * Math.PI * r;
  const full = occupied >= capacity;
  return (
    <div className="flex items-center gap-5">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke={T.navySoft} strokeWidth="12" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={full ? T.red : pct > 0.85 ? T.amber : T.green}
          strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms" }}
        />
        <text x="65" y="60" textAnchor="middle" fontSize="24" fontWeight="700" fill={T.ink} fontFamily="'Space Grotesk', sans-serif">
          {occupied}
        </text>
        <text x="65" y="80" textAnchor="middle" fontSize="11" fill={T.inkSoft}>
          of {capacity} WFO slots
        </text>
      </svg>
      <div>
        <div className="text-sm font-semibold" style={{ color: full ? T.red : T.ink }}>
          {full ? "Show Full — office at capacity" : `${capacity - occupied} WFO slots open`}
        </div>
        <div className="text-xs mt-1 max-w-[190px]" style={{ color: T.inkSoft }}>
          {full ? "Further WFO bookings are blocked. WFH / Leave are unaffected." : "Slots are auto-assigned — no seat selection needed."}
        </div>
      </div>
    </div>
  );
}
