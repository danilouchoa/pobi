export default function Field({ label, id, children, hint }) {
  return (
    <label htmlFor={id} className="block mb-3">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </label>
  );
}
