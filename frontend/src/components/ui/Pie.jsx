export default function Pie({ data }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="flex flex-wrap gap-2 items-end">
      {data
        .sort((a, b) => b.value - a.value)
        .map((d, i) => (
          <div key={i} className="flex-1 min-w-[120px]">
            <div className="h-3 rounded bg-gray-200 overflow-hidden">
              <div className="h-3 bg-black" style={{ width: `${(d.value / total) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="truncate max-w-[70%]" title={d.name}>
                {d.name}
              </span>
              <span>{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      {data.length === 0 && <div className="text-gray-400 text-sm">Sem dados.</div>}
    </div>
  );
}
