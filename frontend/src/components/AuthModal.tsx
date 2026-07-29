import { useState } from "react";
import AuthForm from "./AuthForm";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("register");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "register" ? "Crea tu cuenta gratis" : "Inicia sesión"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Necesitas una cuenta para descargar el documento convertido. El plan Free no cuesta nada.
        </p>
        <AuthForm mode={mode} onSuccess={onSuccess} />
        <button
          onClick={() => setMode(mode === "register" ? "login" : "register")}
          className="mt-4 text-sm text-slate-500 hover:text-slate-700"
        >
          {mode === "register" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
        </button>
      </div>
    </div>
  );
}
