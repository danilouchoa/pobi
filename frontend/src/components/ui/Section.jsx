export default function Section({ title, subtitle, right, children }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
