export default function MiniModalJugador({ titulo, jugadores, onGuardar, onCancelar }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-4 w-full max-w-sm">
        <h4 className="font-semibold mb-3">{titulo}</h4>
        <select
          className="border p-2 rounded w-full"
          onChange={(e) => {
            if (!e.target.value) return;
            onGuardar(e.target.value);
          }}
        >
          <option value="">Selecciona un jugador</option>
          {jugadores.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancelar} className="px-3 py-2 bg-slate-200 rounded">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
