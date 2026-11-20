import { Info } from "lucide-react";

export function DemoNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <strong>Modo demonstração.</strong> Os dados são fictícios e ficam apenas na memória desta
        sessão. Nenhuma conta, mensagem ou integração real está ativa.
      </p>
    </div>
  );
}
