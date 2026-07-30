import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { billingApi, ApiError } from "../api/client";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Billing() {
  usePageMeta({
    title: "Facturación — irtax",
    description: "Gestiona tu plan y suscripción de irtax.",
    noindex: true,
  });

  const { user } = useAuth();
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi
      .config()
      .then((c) => setStripeEnabled(c.stripe_enabled))
      .catch(() => {});
  }, []);

  const openPortal = async () => {
    try {
      const { url } = await billingApi.portal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el portal de facturación");
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Facturación</h1>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Plan actual</p>
        <p className="text-lg font-medium capitalize text-slate-900">{user.plan_code}</p>
        <p className="mt-1 text-sm text-slate-500">Estado: {user.subscription_status}</p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={openPortal}
          disabled={!stripeEnabled}
          className="mt-6 w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
        >
          {stripeEnabled ? "Gestionar suscripción" : "Facturación próximamente"}
        </button>
      </div>
    </div>
  );
}
