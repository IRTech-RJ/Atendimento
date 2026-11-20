import { X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

interface ModalProps {
  title: string;
  description: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel: string;
}

export function Modal({ title, description, onClose, onSubmit, children, submitLabel }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
        onSubmit={onSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-7 flex justify-end gap-3">
          <button type="button" className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
