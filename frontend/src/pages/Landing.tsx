import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { conversionsApi, ApiError } from "../api/client";
import AuthModal from "../components/AuthModal";
import PdfLoadingBar from "../components/PdfLoadingBar";
import logoFull from "../assets/logo-full.png";

type Direction = "pdf2word" | "word2pdf";

function directionForFile(file: File): Direction {
  return file.name.toLowerCase().endsWith(".pdf") ? "pdf2word" : "word2pdf";
}

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [direction, setDirection] = useState<Direction>("pdf2word");
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const pickFile = (f: File) => {
    setFile(f);
    setDirection(directionForFile(f));
    setError(null);
  };

  const startConversion = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setNeedsUpgrade(false);
    try {
      await conversionsApi.create(direction, file);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la conversión");
      setNeedsUpgrade(err instanceof ApiError && err.status === 402);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertClick = () => {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    if (!user) {
      setShowAuth(true);
      return;
    }
    startConversion();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <img src={logoFull} alt="irtax — Edición inteligente, trámites al instante" className="mx-auto h-24 w-auto" />
      <h1 className="mt-8 text-4xl font-bold text-slate-900">Convierte PDF y Word en segundos</h1>
      <p className="mt-3 text-lg text-slate-600">
        Incluye reconocimiento OCR para documentos escaneados. Sube tu archivo, regístrate gratis y
        descarga el resultado.
      </p>

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
        </p>
      )}

      {submitting ? (
        <PdfLoadingBar active className="mt-6" />
      ) : (
        <button
          onClick={handleConvertClick}
          className="mt-6 rounded-md bg-slate-900 px-6 py-3 text-white font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {!file ? "Elegir archivo" : "Convertir"}
        </button>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Puedes elegir tu archivo sin registrarte, pero necesitas una cuenta gratuita para descargar el
        resultado.
      </p>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            startConversion();
          }}
        />
      )}
    </div>
  );
}
