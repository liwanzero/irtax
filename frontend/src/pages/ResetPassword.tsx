import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi, ApiError } from "../api/client";
import { usePageMeta } from "../hooks/usePageMeta";

export default function ResetPassword() {
  usePageMeta({
    title: "Restablecer contraseña — irtax",
    description: "Elige una nueva contraseña para tu cuenta irtax.",
    noindex: true,
  });

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo salió mal, intenta de nuevo");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900">Enlace inválido</h1>
        <p className="text-sm text-slate-600">
          Este enlace de restablecimiento no es válido. Solicita uno nuevo.
        </p>
        <Link to="/olvide-password" className="mt-6 text-sm text-slate-500 hover:text-slate-900 hover:underline">
          Solicitar enlace
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Elige una nueva contraseña</h1>

      {done ? (
        <div className="w-full max-w-sm rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
          Contraseña actualizada. Redirigiendo a iniciar sesión...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nueva contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirmar contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Restablecer contraseña
          </button>
        </form>
      )}
    </div>
  );
}
