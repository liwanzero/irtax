import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/client";
import { usePageMeta } from "../hooks/usePageMeta";

export default function ForgotPassword() {
  usePageMeta({
    title: "Recuperar contraseña — irtax",
    description: "Restablece la contraseña de tu cuenta irtax.",
    noindex: true,
  });

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Recuperar contraseña</h1>
      <p className="mb-6 text-center text-sm text-slate-600">
        Escribe tu correo y, si tienes una cuenta con contraseña, te enviaremos un enlace para
        restablecerla.
      </p>

      {sent ? (
        <div className="w-full max-w-sm rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Si ese correo tiene una cuenta, te enviamos un enlace para restablecer la contraseña.
          Revisa tu bandeja de entrada (y spam).
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Enviar enlace de recuperación
          </button>
        </form>
      )}

      <Link to="/login" className="mt-6 text-sm text-slate-500 hover:text-slate-900 hover:underline">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
