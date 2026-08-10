import { useState, type FormEvent } from "react";
import { adminApi, ApiError, type AdminLookup, type CheckoutAttempt, type CheckoutAttemptFields } from "../api/client";
import { usePageMeta } from "../hooks/usePageMeta";

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
}

function buildEvidenceText(data: AdminLookup): string {
  const lines: string[] = [];
  lines.push(`Cliente: ${data.email} (usuario #${data.user_id}, registrado el ${fmt(data.created_at)})`);
  if (data.subscription) {
    lines.push(
      `Suscripción: plan ${data.subscription.plan_name} (${data.subscription.plan_code}), estado ${data.subscription.status}, ID ${data.subscription.stripe_subscription_id ?? "—"}`
    );
  }
  lines.push("");
  lines.push("Intentos de checkout:");
  if (data.checkout_attempts.length === 0) {
    lines.push("  (ninguno registrado)");
  }
  for (const a of data.checkout_attempts) {
    const tag = a.is_manual ? " (agregado manualmente)" : "";
    lines.push(`  - ${fmt(a.created_at)} | sesión ${a.stripe_checkout_session_id}${tag}`);
    lines.push(`    IP: ${a.ip_address ?? "—"} | User-Agent: ${a.user_agent ?? "—"}`);
    lines.push(
      `    3DS: ${a.three_ds_result ?? "—"} | CVC: ${a.cvc_check ?? "—"} | AVS línea: ${a.avs_line1_check ?? "—"} | AVS código postal: ${a.avs_postal_check ?? "—"}`
    );
    lines.push(`    Cargo: ${a.stripe_charge_id ?? "—"} | Completado: ${fmt(a.completed_at)}`);
    if (a.notes) lines.push(`    Notas: ${a.notes}`);
  }
  lines.push("");
  lines.push("Uso del producto (¿descargó algo?):");
  if (data.jobs.length === 0) {
    lines.push("  (sin trabajos)");
  }
  for (const j of data.jobs) {
    lines.push(
      `  - [${j.kind === "conversion" ? "conversión" : "edición"}] ${j.original_filename} — creado ${fmt(j.created_at)}, descargado: ${j.downloaded_at ? fmt(j.downloaded_at) : "nunca"}`
    );
  }
  return lines.join("\n");
}

const EMPTY_FIELDS: CheckoutAttemptFields = {
  stripe_charge_id: "",
  ip_address: "",
  user_agent: "",
  three_ds_result: "",
  cvc_check: "",
  avs_line1_check: "",
  avs_postal_check: "",
  notes: "",
};

function fieldsFromAttempt(a: CheckoutAttempt): CheckoutAttemptFields {
  return {
    stripe_charge_id: a.stripe_charge_id ?? "",
    ip_address: a.ip_address ?? "",
    user_agent: a.user_agent ?? "",
    three_ds_result: a.three_ds_result ?? "",
    cvc_check: a.cvc_check ?? "",
    avs_line1_check: a.avs_line1_check ?? "",
    avs_postal_check: a.avs_postal_check ?? "",
    notes: a.notes ?? "",
  };
}

interface AttemptFormProps {
  initial: CheckoutAttemptFields;
  onCancel: () => void;
  onSave: (fields: CheckoutAttemptFields) => Promise<void>;
}

function AttemptForm({ initial, onCancel, onSave }: AttemptFormProps) {
  const [fields, setFields] = useState(initial);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof CheckoutAttemptFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const inputCls = "rounded border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none";

  return (
    <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500">3DS</label>
          <input className={`${inputCls} w-full`} value={fields.three_ds_result ?? ""} onChange={set("three_ds_result")} placeholder="authenticated" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">CVC</label>
          <input className={`${inputCls} w-full`} value={fields.cvc_check ?? ""} onChange={set("cvc_check")} placeholder="pass" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">AVS línea</label>
          <input className={`${inputCls} w-full`} value={fields.avs_line1_check ?? ""} onChange={set("avs_line1_check")} placeholder="pass" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">AVS código postal</label>
          <input className={`${inputCls} w-full`} value={fields.avs_postal_check ?? ""} onChange={set("avs_postal_check")} placeholder="pass" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">IP</label>
          <input className={`${inputCls} w-full`} value={fields.ip_address ?? ""} onChange={set("ip_address")} />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">ID del cargo en Stripe</label>
          <input className={`${inputCls} w-full`} value={fields.stripe_charge_id ?? ""} onChange={set("stripe_charge_id")} placeholder="ch_..." />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] text-slate-500">User-Agent</label>
          <input className={`${inputCls} w-full`} value={fields.user_agent ?? ""} onChange={set("user_agent")} />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] text-slate-500">Notas</label>
          <textarea className={`${inputCls} w-full`} rows={2} value={fields.notes ?? ""} onChange={set("notes")} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(fields);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-white">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  usePageMeta({ title: "Admin — irtax", description: "Panel interno.", noindex: true });

  const [email, setEmail] = useState("");
  const [data, setData] = useState<AdminLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingManual, setAddingManual] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setData(null);
    setCopied(false);
    setEditingId(null);
    setAddingManual(false);
    setLoading(true);
    try {
      const result = await adminApi.lookup(email.trim());
      setData(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("No tienes acceso a esta página.");
      } else if (err instanceof ApiError && err.status === 404) {
        setError("No hay ningún usuario registrado con ese correo.");
      } else {
        setError(err instanceof ApiError ? err.message : "Algo salió mal");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyEvidence = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(buildEvidenceText(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveEdit = async (attemptId: number, fields: CheckoutAttemptFields) => {
    const updated = await adminApi.updateCheckoutAttempt(attemptId, fields);
    setData((prev) =>
      prev
        ? { ...prev, checkout_attempts: prev.checkout_attempts.map((a) => (a.id === attemptId ? updated : a)) }
        : prev
    );
    setEditingId(null);
  };

  const saveManual = async (fields: CheckoutAttemptFields) => {
    if (!data) return;
    const created = await adminApi.createCheckoutAttempt(data.email, fields);
    setData((prev) => (prev ? { ...prev, checkout_attempts: [created, ...prev.checkout_attempts] } : prev));
    setAddingManual(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Evidencia para disputas</h1>
      <p className="mt-1 text-sm text-slate-500">
        Busca por el correo del cliente para ver sus intentos de pago (IP, 3DS, CVC, AVS) y si usó el producto.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          type="email"
          required
          placeholder="correo@cliente.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {data && (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{data.email}</p>
                <p className="text-xs text-slate-500">
                  Usuario #{data.user_id} · registrado {fmt(data.created_at)}
                </p>
                {data.subscription && (
                  <p className="mt-1 text-sm text-slate-700">
                    Plan <strong>{data.subscription.plan_name}</strong> — {data.subscription.status}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={copyEvidence}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copied ? "¡Copiado!" : "Copiar evidencia"}
                </button>
                <a
                  href={adminApi.lookupPdfUrl(data.email)}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                >
                  Descargar PDF
                </a>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Intentos de checkout</h2>
              {!addingManual && (
                <button
                  onClick={() => setAddingManual(true)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                >
                  + Agregar manualmente
                </button>
              )}
            </div>

            {addingManual && (
              <div className="mb-3">
                <AttemptForm initial={EMPTY_FIELDS} onCancel={() => setAddingManual(false)} onSave={saveManual} />
              </div>
            )}

            {data.checkout_attempts.length === 0 && !addingManual ? (
              <p className="text-sm text-slate-500">No hay intentos de checkout registrados.</p>
            ) : (
              <div className="space-y-3">
                {data.checkout_attempts.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex items-start justify-between">
                      <p className="text-xs text-slate-400">
                        {fmt(a.created_at)}
                        {a.is_manual && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">manual</span>}
                      </p>
                      {editingId !== a.id && (
                        <button
                          onClick={() => setEditingId(a.id)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline"
                        >
                          Editar
                        </button>
                      )}
                    </div>

                    {editingId === a.id ? (
                      <AttemptForm
                        initial={fieldsFromAttempt(a)}
                        onCancel={() => setEditingId(null)}
                        onSave={(fields) => saveEdit(a.id, fields)}
                      />
                    ) : (
                      <>
                        <p className="mt-1">
                          IP: <span className="font-mono">{a.ip_address ?? "—"}</span>
                        </p>
                        <p className="truncate text-xs text-slate-500">{a.user_agent ?? "—"}</p>
                        <p className="mt-1">
                          3DS: <strong>{a.three_ds_result ?? "—"}</strong> · CVC:{" "}
                          <strong>{a.cvc_check ?? "—"}</strong> · AVS línea:{" "}
                          <strong>{a.avs_line1_check ?? "—"}</strong> · AVS CP:{" "}
                          <strong>{a.avs_postal_check ?? "—"}</strong>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Completado: {a.completed_at ? fmt(a.completed_at) : "no completado"}
                        </p>
                        {a.notes && <p className="mt-1 text-xs text-slate-600">Notas: {a.notes}</p>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Uso del producto</h2>
            {data.jobs.length === 0 ? (
              <p className="text-sm text-slate-500">Este usuario no ha convertido ni editado nada.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Archivo</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Creado</th>
                      <th className="px-3 py-2">Descargado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.map((j) => (
                      <tr key={`${j.kind}-${j.id}`} className="border-t border-slate-100">
                        <td className="px-3 py-2">{j.original_filename}</td>
                        <td className="px-3 py-2">{j.kind === "conversion" ? "Conversión" : "Edición"}</td>
                        <td className="px-3 py-2">{fmt(j.created_at)}</td>
                        <td className="px-3 py-2">
                          {j.downloaded_at ? (
                            <span className="text-emerald-700">{fmt(j.downloaded_at)}</span>
                          ) : (
                            <span className="text-slate-400">nunca</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
