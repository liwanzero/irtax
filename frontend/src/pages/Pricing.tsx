import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { billingApi, type Plan, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";

function formatPrice(cents: number): string {
  if (cents === 0) return "Gratis";
  return `$${(cents / 100).toFixed(0)}/mes`;
}

const FEATURES: Record<number, string[]> = {
  0: ["Conversión PDF ↔ Word (documentos con texto)", "5 conversiones al mes"],
  1: ["Todo lo del plan Free", "OCR para PDFs escaneados", "Conversiones ilimitadas"],
  2: ["Todo lo del plan Básico", "Editor de PDF: texto, imágenes y firmas", "Rotar páginas"],
  3: [
    "Todo lo del plan Pro",
    "Unir, dividir y reordenar páginas",
    "Rellenar formularios de PDF",
    "Censurar contenido sensible",
    "Desbloquear y proteger con contraseña",
    "Comparar dos versiones de un PDF",
    "Archivos de hasta 100MB",
  ],
};

export default function Pricing() {
  usePageMeta({
    title: "Planes y precios — irtax",
    description:
      "Planes desde gratis hasta $20/mes para convertir PDF a Word, Word a PDF con OCR, y editar tus documentos PDF en línea. 1 día de prueba gratis en los planes de pago.",
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi.plans().then(setPlans).catch(() => setError("No se pudieron cargar los planes"));
    billingApi
      .config()
      .then((c) => setStripeEnabled(c.stripe_enabled))
      .catch(() => {});
  }, []);

  const subscribe = async (plan: Plan) => {
    if (!user) {
      navigate("/registro");
      return;
    }
    try {
      const { url } = await billingApi.checkout(plan.id);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar el pago");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-slate-900">Planes</h1>
      <p className="mt-2 text-center text-slate-600">
        Suscripciones mensuales, cancela cuando quieras. 1 día de prueba gratis en todos los planes de pago.
      </p>

      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatPrice(plan.price_cents)}</p>
            {plan.price_cents > 0 && (
              <p className="mt-1 text-xs font-medium text-emerald-600">1 día de prueba gratis</p>
            )}

            <ul className="mt-4 flex-1 space-y-2 text-left text-sm text-slate-600">
              {(FEATURES[plan.tier_level] ?? []).map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => subscribe(plan)}
              disabled={plan.price_cents > 0 && !stripeEnabled}
              className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {plan.price_cents === 0 ? "Empezar gratis" : stripeEnabled ? "Probar 1 día gratis" : "Próximamente"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
