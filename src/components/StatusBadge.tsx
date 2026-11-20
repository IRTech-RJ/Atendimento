import { useApiHealth } from "../hooks/useApiHealth";

export function StatusBadge() {
  const isOnline = useApiHealth();
  const label = isOnline === null ? "Conectando" : isOnline ? "API conectada" : "API indisponível";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
      <span
        className={`size-2 rounded-full ${
          isOnline === null ? "animate-pulse bg-amber-400" : isOnline ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      {label}
    </span>
  );
}
