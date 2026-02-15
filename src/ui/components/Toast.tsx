import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Info, X } from "lucide-react";

import { useToast } from "../contexts/ToastContext";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md max-w-[420px] min-w-[300px] ${
              toast.level === "error"
                ? "bg-red-950/80 border-red-500/30 text-red-200"
                : "bg-[#1a2332]/80 border-teal-500/30 text-teal-200"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.level === "error" ? (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              ) : (
                <Info className="w-4 h-4 text-teal-400" />
              )}
            </div>
            <p className="flex-1 text-xs leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className={`flex-shrink-0 p-0.5 rounded-md transition-colors ${
                toast.level === "error"
                  ? "hover:bg-red-500/20 text-red-400/60 hover:text-red-300"
                  : "hover:bg-teal-500/20 text-teal-400/60 hover:text-teal-300"
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
