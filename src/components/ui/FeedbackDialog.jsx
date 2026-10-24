'use client';

import { AlertCircle, CheckCircle2, CircleHelp } from 'lucide-react';

const variants = {
  success: {
    icon: CheckCircle2,
    iconClass: 'bg-amber-100 text-amber-700',
    actionClass: 'bg-amber-500 hover:bg-amber-600',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'bg-rose-100 text-rose-600',
    actionClass: 'bg-slate-900 hover:bg-slate-800',
  },
  confirm: {
    icon: CircleHelp,
    iconClass: 'bg-amber-100 text-amber-700',
    actionClass: 'bg-amber-500 hover:bg-amber-600',
  },
};

export default function FeedbackDialog({
  open,
  variant = 'success',
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onAction,
  onClose,
}) {
  if (!open) return null;

  const config = variants[variant] || variants.success;
  const Icon = config.icon;
  const isConfirm = variant === 'confirm';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        aria-describedby="feedback-dialog-description"
        className="w-full max-w-md animate-[dialog-in_180ms_ease-out] rounded-3xl border border-slate-200 bg-white px-7 py-8 text-center shadow-2xl sm:px-9"
      >
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] ${config.iconClass}`}>
          <Icon size={42} strokeWidth={1.8} />
        </div>
        <h2 id="feedback-dialog-title" className="mt-6 text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p id="feedback-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>
        <div className={`mt-7 flex gap-3 ${isConfirm ? 'flex-col-reverse sm:flex-row' : ''}`}>
          {isConfirm && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={isConfirm ? onConfirm : (onAction || onClose)}
            className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-slate-200 ${config.actionClass}`}
          >
            {confirmLabel || (isConfirm ? 'Continue' : 'Got it')}
          </button>
        </div>
      </section>
      <style jsx>{`
        @keyframes dialog-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
