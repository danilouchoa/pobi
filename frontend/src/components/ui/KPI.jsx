export default function KPI({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-2xl p-4 border bg-white ${highlight ? "shadow" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
