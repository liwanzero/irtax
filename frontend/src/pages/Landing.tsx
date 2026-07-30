import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { conversionsApi, ApiError, type ConversionJob } from "../api/client";
import AuthModal from "../components/AuthModal";
import PdfLoadingBar from "../components/PdfLoadingBar";
import logoFull from "../assets/logo-full.png";
import { usePageMeta } from "../hooks/usePageMeta";

type Direction = "pdf2word" | "word2pdf";

function directionForFile(file: File): Direction {
  return file.name.toLowerCase().endsWith(".pdf") ? "pdf2word" : "word2pdf";
}

export default function Landing() {
  usePageMeta({
    title: "irtax — Convierte PDF a Word y Word a PDF gratis, con OCR",
    description:
      "Convierte PDF a Word y Word a PDF en segundos, con reconocimiento OCR para documentos escaneados. Edita tus PDF en línea. Regístrate gratis, sin descargar nada.",
  });

  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [direction, setDirection] = useState<Direction>("pdf2word");
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<ConversionJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);

  const pickFile = (f: File) => {
    setFile(f);
    setDirection(directionForFile(f));
    setError(null);
    setJob(null);
  };

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    const interval = setInterval(async () => {
      try {
        const updated = await conversionsApi.get(job.id);
        setJob(updated);
      } catch {
        // transient network hiccup, next tick will retry
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [job]);

  const startConversion = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setNeedsUpgrade(false);
    setNeedsAccount(false);
    try {
      const created = await conversionsApi.create(direction, file);
      setJob(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(err.message);
        setNeedsAccount(true);
      } else if (err instanceof ApiError && err.status === 402) {
        setError(err.message);
        setNeedsUpgrade(true);
      } else {
        setError(err instanceof ApiError ? err.message : "No se pudo iniciar la conversión");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertClick = () => {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    startConversion();
  };

  const resetForm = () => {
    setFile(null);
    setJob(null);
    setError(null);
    setNeedsUpgrade(false);
    setNeedsAccount(false);
  };

  const jobInProgress = job && job.status !== "done" && job.status !== "error";
  const jobDone = job?.status === "done";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <img src={logoFull} alt="irtax — Edición inteligente, trámites al instante" className="mx-auto h-24 w-auto" />
      <h1 className="mt-8 text-4xl font-bold text-slate-900">Convierte PDF y Word en segundos</h1>
      <p className="mt-3 text-lg text-slate-600">
        Incluye reconocimiento OCR para documentos escaneados. Tu primera conversión es gratis, sin
        registrarte — solo necesitas una cuenta para descargar el resultado.
      </p>

      {!job && (
        <div
          className="mt-10 rounded-xl border-2 border-dashed border-slate-300 bg-white p-10"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) pickFile(dropped);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) pickFile(selected);
            }}
          />

          {file ? (
            <div className="space-y-4">
              <p className="text-slate-800">
                <span className="font-medium">{file.name}</span>
              </p>
              <div className="flex justify-center gap-2 text-sm">
                <button
                  onClick={() => setDirection("pdf2word")}
                  className={`rounded-md px-3 py-1.5 ${
                    direction === "pdf2word" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
                  }`}
                >
                  PDF → Word
                </button>
                <button
                  onClick={() => setDirection("word2pdf")}
                  className={`rounded-md px-3 py-1.5 ${
                    direction === "word2pdf" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
                  }`}
                >
                  Word → PDF
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Arrastra tu archivo aquí, o haz clic en el botón para elegirlo</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600">
          {error}
          {needsUpgrade && (
            <>
              {" "}
              <Link to="/precios" className="underline">
                Ver planes
              </Link>
            </>
          )}
          {needsAccount && (
            <>
              {" "}
              <button onClick={() => setShowAuth(true)} className="underline">
                Registrarme
              </button>
            </>
          )}
        </p>
      )}

      {submitting && <PdfLoadingBar active className="mt-6 mx-auto" />}

      {jobInProgress && (
        <PdfLoadingBar active label={job.status === "queued" ? "En cola…" : "Convirtiendo…"} className="mt-6 mx-auto" />
      )}

      {job?.status === "error" && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {job.error_message || "La conversión falló."}
          <div className="mt-3">
            <button onClick={resetForm} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700">
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}

      {jobDone && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <p className="font-medium text-emerald-800">¡Tu documento está listo!</p>
          {user ? (
            <a
              href={conversionsApi.downloadUrl(job.id)}
              className="mt-4 inline-block rounded-md bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-700"
            >
              Descargar
            </a>
          ) : (
            <>
              <p className="mt-1 text-sm text-emerald-700">
                Regístrate gratis para descargarlo (toma menos de un minuto).
              </p>
              <button
                onClick={() => setShowAuth(true)}
                className="mt-4 rounded-md bg-slate-900 px-6 py-2.5 text-white font-medium hover:bg-slate-700"
              >
                Registrarme y descargar
              </button>
            </>
          )}
          <div className="mt-3">
            <button onClick={resetForm} className="text-sm text-slate-500 underline">
              Convertir otro documento
            </button>
          </div>
        </div>
      )}

      {!job && !submitting && (
        <button
          onClick={handleConvertClick}
          className="mt-6 rounded-md bg-slate-900 px-6 py-3 text-white font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {!file ? "Elegir archivo" : "Convertir"}
        </button>
      )}

      {!job && (
        <p className="mt-3 text-xs text-slate-400">
          Tu primera conversión es gratis sin cuenta. Para descargar el resultado (o seguir
          convirtiendo después) necesitas registrarte gratis.
        </p>
      )}

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
          }}
        />
      )}

      <section className="mt-20 grid gap-8 text-left sm:grid-cols-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Convertir PDF a Word</h2>
          <p className="mt-2 text-sm text-slate-600">
            Convierte cualquier PDF a un documento de Word totalmente editable, conservando el texto
            y el formato del original.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Convertir Word a PDF</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pasa tus documentos de Word a PDF en segundos, listos para compartir o imprimir sin
            perder el diseño.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">OCR para PDFs escaneados</h2>
          <p className="mt-2 text-sm text-slate-600">
            Reconocimiento óptico de caracteres para documentos escaneados o fotografiados, para que
            también los puedas convertir y editar.
          </p>
        </div>
      </section>
    </div>
  );
}
