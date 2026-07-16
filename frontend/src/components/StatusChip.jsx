import { STATUS, T } from "../theme";

export default function StatusChip({ code }) {
  const s = STATUS[code];
  if (!s)
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: T.navySoft, color: T.inkSoft }}>
        Not marked
      </span>
    );
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: s.soft, color: s.color }}>
      {s.icon} {s.code === "L" ? "Leave (A)" : s.code}
    </span>
  );
}
