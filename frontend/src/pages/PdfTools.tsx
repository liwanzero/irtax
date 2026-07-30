import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { pdfToolsApi, ApiError, type PageDiff } from "../api/client";
import PdfLoadingBar from "../components/PdfLoadingBar";
import { usePageMeta } from "../hooks/usePageMeta";

const TIER_ADVANCED = 3;

type Tool = "unlock" | "protect" | "compare";

export default function PdfTools() {
  usePageMeta({
    title: "Herramientas de PDF — irtax",
    description: "Desbloquea, protege y compara tus documentos PDF.",
    noindex: true,
  });

  const { user } = useAuth();
  const [tool, setTool] = useState<Tool>("unlock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [unlockPassword, setUnlockPassword] = useState("");
  const unlockFileRef = useRef<HTMLInputElement>(null);

  const [protectPassword, setProtectPassword] = useState("");
  const protectFileRef = useRef<HTMLInputElement>(null);

  const compareARef = useRef<HTMLInputElement>(null);
  const compareBRef = useRef<HTMLInputElement>(null);
  const [diff, setDiff] = useState<PageDiff[] | null>(null);

  if (!user || user.tier_level < TIER_ADVANCED) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Herramientas de PDF</h1>
        <p className="mt-3 text-slate-600">
          Desbloquear, proteger y comparar PDFs está disponible en el plan Premium.
        </p>
        <Link
          to="/precios"
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Ver planes
        </Link>
      </div>
    );
  }

  const runUnlock = async () => {
    const file = unlockFileRef.current?.files?.[0];
    if (!file) {
      setError("Elige un archivo PDF primero");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await pdfToolsApi.unlock(file, unlockPassword);
      setSuccess("Listo, tu archivo sin contraseña se está descargando.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desbloquear el archivo");
    } finally {
      setBusy(false);
    }
  };

  const runProtect = async () => {
    const file = protectFileRef.current?.files?.[0];
    if (!file) {
      setError("Elige un archivo PDF primero");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await pdfToolsApi.protect(file, protectPassword);
      setSuccess("Listo, tu archivo protegido se está descargando.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo proteger el archivo");
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    const fileA = compareARef.current?.files?.[0];
    const fileB = compareBRef.current?.files?.[0];
    if (!fileA || !fileB) {
      setError("Elige los dos archivos PDF a comparar");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    setDiff(null);
    try {
      const result = await pdfToolsApi.compare(fileA, fileB);
      setDiff(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron comparar los archivos");
    } finally {
      setBusy(false);
    }
  };

  const switchTool = (t: Tool) => {
    setTool(t);
    setError(null);
    setSuccess(null);
    setDiff(null);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Herramientas de PDF</h1>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => switchTool("unlock")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            tool === "unlock" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
          }`}
        >
          Desbloquear PDF
        </button>
        <button
          onClick={() => switchTool("protect")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            tool === "protect" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
          }`}
        >
          Proteger PDF
        </button>
        <button
          onClick={() => switchTool("compare")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            tool === "compare" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
          }`}
        >
          Comparar PDF
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-4 text-sm text-emerald-700">{success}</p>}
      {busy && <PdfLoadingBar active className="mt-4" />}

      {tool === "unlock" && (
        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Quita la contraseña de un PDF (necesitas saber la contraseña actual).
          </p>
          <input ref={unlockFileRef} type="file" accept=".pdf" className="w-full text-sm" />
          <input
            type="password"
            placeholder="Contraseña actual del PDF"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={runUnlock}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Desbloquear y descargar
          </button>
        </div>
      )}

      {tool === "protect" && (
        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">Añade una contraseña para abrir el PDF.</p>
          <input ref={protectFileRef} type="file" accept=".pdf" className="w-full text-sm" />
          <input
            type="password"
            placeholder="Nueva contraseña (mínimo 4 caracteres)"
            value={protectPassword}
            onChange={(e) => setProtectPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={runProtect}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Proteger y descargar
          </button>
        </div>
      )}

      {tool === "compare" && (
        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Compara el texto de dos PDFs y marca qué cambió, página por página.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-500">Documento original</label>
            <input ref={compareARef} type="file" accept=".pdf" className="mt-1 w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Documento nuevo</label>
            <input ref={compareBRef} type="file" accept=".pdf" className="mt-1 w-full text-sm" />
          </div>
          <button
            onClick={runCompare}
            disabled={busy}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Comparar
          </button>

          {diff && diff.length === 0 && (
            <p className="text-sm text-slate-500">No se encontraron diferencias de texto entre los documentos.</p>
          )}

          {diff && diff.length > 0 && (
            <div className="space-y-4">
              {diff.map((d) => (
                <div key={d.page} className="rounded border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">Página {d.page + 1}</p>
                  {d.removed.map((line, i) => (
                    <p key={`r-${i}`} className="rounded bg-red-50 px-2 py-1 text-sm text-red-700 line-through">
                      {line}
                    </p>
                  ))}
                  {d.added.map((line, i) => (
                    <p key={`a-${i}`} className="rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-700">
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
