import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="mt-16 text-center text-slate-400">Cargando…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
