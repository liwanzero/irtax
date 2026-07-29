import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { conversionsApi, type ConversionJob, ApiError } from "../api/client";
import PdfLoadingBar from "../components/PdfLoadingBar";

const STATUS_LABELS: Record<ConversionJob["status"], string> = {
  queued: "En cola",
  processing: "Procesando",
  done: "Listo",
  error: "Error",
};

const STATUS_STYLES: Record<ConversionJob["status"], string> = {
  queued: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadJobs = async () => {
    try {
      const data = await conversionsApi.list();
      setJobs(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las conversiones");
    }
  };

  useEffect(() => {
    loadJobs();
    const hasPending = () => jobs.some((j) => j.status === "queued" || j.status === "processing");
    const interval = setInterval(() => {
      if (hasPending()) loadJobs();
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.map((j) => j.status).join(",")]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setNeedsUpgrade(false);
    const direction = file.name.toLowerCase().endsWith(".pdf") ? "pdf2word" : "word2pdf";
    try {
      await conversionsApi.create(direction, file);
      await loadJobs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la conversión");
      setNeedsUpgrade(err instanceof ApiError && err.status === 402);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Mis conversiones</h1>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {uploading ? "Subiendo…" : "Nueva conversión"}
          </button>
        </div>
      </div>

      {uploading && <PdfLoadingBar active className="mb-6" />}

      {error && (
        <p className="mb-4 text-sm text-red-600">
          {error}
          {needsUpgrade && (
            <>
              {" "}
              <Link to="/precios" className="underline">
                Ver planes
              </Link>
            </>
          )}
        </p>
      )}

      {jobs.length === 0 ? (
        <p className="text-slate-500">Todavía no has convertido ningún documento.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{job.original_filename}</p>
                <p className="text-xs text-slate-400">
                  {job.direction === "pdf2word" ? "PDF → Word" : "Word → PDF"} ·{" "}
                  {new Date(job.created_at).toLocaleString()}
                </p>
                {job.status === "error" && job.error_message && (
                  <p className="mt-1 text-xs text-red-600">{job.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                  {STATUS_LABELS[job.status]}
                </span>
                {job.status === "done" && (
                  <a
                    href={conversionsApi.downloadUrl(job.id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Descargar
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
