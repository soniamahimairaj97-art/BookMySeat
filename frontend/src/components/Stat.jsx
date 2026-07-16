import { T } from "../theme";

export default function Stat({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl p-5 flex-1 min-w-0" style={{ background: T.panel, border: `1px solid ${T.line}` }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: T.inkSoft, letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold" style={{ color: accent || T.ink, fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: T.inkSoft }}>
          {sub}
        </div>
      )}
    </div>
  );
}
