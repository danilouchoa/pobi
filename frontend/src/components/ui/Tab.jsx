export default function Tab({ id, name, activeTab, setTab }) {
  return (
    <button
      onClick={() => setTab(id)}
      className={`px-3 py-2 rounded-xl border text-sm mr-2 mb-2 ${
        activeTab === id ? "bg-black text-white" : "bg-white hover:bg-gray-50"
      }`}
    >
      {name}
    </button>
  );
}
