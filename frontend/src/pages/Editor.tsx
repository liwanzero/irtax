import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { editorApi, ApiError, type PdfEditJob, type FormField } from "../api/client";
import PdfLoadingBar from "../components/PdfLoadingBar";

const TIER_EDITOR = 2;
const TIER_ADVANCED = 3;

type Mode = "view" | "text" | "image" | "rotate" | "reorder" | "split" | "merge" | "form";

interface PendingPlacement {
  page: number;
  xPt: number;
  yPt: number;
  leftPx: number;
  topPx: number;
}

const MODES: { key: Mode; label: string; tier: number }[] = [
  { key: "text", label: "Añadir texto", tier: TIER_EDITOR },
  { key: "image", label: "Insertar imagen", tier: TIER_EDITOR },
  { key: "rotate", label: "Rotar página", tier: TIER_EDITOR },
  { key: "reorder", label: "Reordenar", tier: TIER_ADVANCED },
  { key: "split", label: "Dividir", tier: TIER_ADVANCED },
  { key: "merge", label: "Unir PDF", tier: TIER_ADVANCED },
  { key: "form", label: "Rellenar formulario", tier: TIER_ADVANCED },
];

const MODE_HINTS: Record<Mode, string> = {
  view: "",
  text: "Haz clic en el punto de la página donde quieres escribir.",
  image: "Haz clic en el punto de la página donde quieres insertar la imagen o firma.",
  rotate: "Haz clic en una página para rotarla 90°. Puedes hacer clic varias veces.",
  reorder: "Arrastra una página y suéltala en la posición donde la quieres.",
  split: "Haz clic en la primera página del rango, luego en la última, y extrae.",
  merge: "Elige un PDF para agregarlo al final de este documento.",
  form: "Completa los campos detectados en el PDF y guarda.",
};

export default function Editor() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<PdfEditJob | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pointsPerPixel, setPointsPerPixel] = useState(0.72);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("view");

  const [pendingText, setPendingText] = useState<PendingPlacement | null>(null);
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState(14);

  const [pendingImage, setPendingImage] = useState<PendingPlacement | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const [splitRange, setSplitRange] = useState<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  });

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [formFields, setFormFields] = useState<FormField[] | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  if (!user || user.tier_level < TIER_EDITOR) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Editor de PDF</h1>
        <p className="mt-3 text-slate-600">
          Esta función está disponible desde el plan Pro (añadir texto, imágenes y rotar páginas) y el
          plan Premium (además unir, dividir, reordenar y rellenar formularios).
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

  const isPremium = user.tier_level >= TIER_ADVANCED;

  const refreshPreview = async (jobId: number) => {
    const data = await editorApi.preview(jobId);
    setPages(data.pages);
    setPointsPerPixel(data.points_per_pixel);
  };

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (job) await refreshPreview(job.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La acción falló");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const newJob = await editorApi.createJob(file);
      setJob(newJob);
      await refreshPreview(newJob.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (mode === "form" && job) {
      setFormFields(null);
      editorApi
        .formFields(job.id)
        .then((fields) => {
          setFormFields(fields);
          const initial: Record<string, string> = {};
          fields.forEach((f) => {
            if (f.name) initial[f.name] = f.value;
          });
          setFormValues(initial);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron leer los campos"));
    }
    setPendingText(null);
    setPendingImage(null);
    setSplitRange({ start: null, end: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handlePageClick = (
    pageIndex: number,
    e: React.MouseEvent<HTMLImageElement>
  ) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const leftPx = e.clientX - rect.left;
    const topPx = e.clientY - rect.top;
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const xPt = leftPx * scaleX * pointsPerPixel;
    const yPt = topPx * scaleY * pointsPerPixel;

    if (mode === "text") {
      setPendingImage(null);
      setPendingText({ page: pageIndex, xPt, yPt, leftPx, topPx });
      setTextValue("");
    } else if (mode === "image") {
      setPendingText(null);
      setPendingImage({ page: pageIndex, xPt, yPt, leftPx, topPx });
    } else if (mode === "rotate") {
      runAction(() => editorApi.rotate(job!.id, { page_number: pageIndex, degrees: 90 }));
    } else if (mode === "split") {
      setSplitRange((prev) => {
        if (prev.start === null) return { start: pageIndex, end: null };
        if (prev.end === null) {
          const start = Math.min(prev.start, pageIndex);
          const end = Math.max(prev.start, pageIndex);
          return { start, end };
        }
        return { start: pageIndex, end: null };
      });
    }
  };

  const confirmAddText = () => {
    if (!pendingText || !textValue.trim()) return;
    const placement = pendingText;
    runAction(() =>
      editorApi.addText(job!.id, {
        page_number: placement.page,
        x: placement.xPt,
        y: placement.yPt,
        text: textValue,
        font_size: fontSize,
      })
    ).then(() => {
      setPendingText(null);
      setTextValue("");
    });
  };

  const confirmAddImage = () => {
    const file = imageFileRef.current?.files?.[0];
    if (!pendingImage || !file) return;
    const placement = pendingImage;
    runAction(() =>
      editorApi.addImage(
        job!.id,
        { page_number: placement.page, x: placement.xPt, y: placement.yPt, width: 100, height: 100 },
        file
      )
    ).then(() => setPendingImage(null));
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const order = pages.map((_, i) => i);
    const [moved] = order.splice(dragIndex, 1);
    order.splice(targetIndex, 0, moved);
    setDragIndex(null);
    runAction(() => editorApi.reorder(job!.id, order));
  };

  const doSplit = async () => {
    if (splitRange.start === null || splitRange.end === null) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await editorApi.split(job!.id, { start_page: splitRange.start, end_page: splitRange.end });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "paginas_extraidas.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setSplitRange({ start: null, end: null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo dividir el PDF");
    } finally {
      setBusy(false);
    }
  };

  const saveForm = () => {
    runAction(() => editorApi.fillForm(job!.id, formValues));
  };

  if (!job) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Editor de PDF</h1>
        <p className="mt-3 text-slate-600">Sube un PDF para empezar a editarlo.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {busy ? (
          <PdfLoadingBar active className="mx-auto mt-6" />
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Elegir PDF
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{job.original_filename}</h1>
        <a
          href={editorApi.downloadUrl(job.id)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Descargar PDF
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setMode("view")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            mode === "view" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Ver
        </button>
        {MODES.filter((m) => m.tier <= (isPremium ? TIER_ADVANCED : TIER_EDITOR)).map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === m.key ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode !== "view" && (
        <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">{MODE_HINTS[mode]}</p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {busy && <PdfLoadingBar active label="Aplicando cambios…" className="mb-4" />}

      {mode === "merge" && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input ref={mergeInputRef} type="file" accept=".pdf" className="text-sm" />
          <button
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                const file = mergeInputRef.current?.files?.[0];
                if (!file) throw new ApiError("Elige un PDF primero", 400);
                await editorApi.merge(job.id, file);
              })
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Unir al final
          </button>
        </div>
      )}

      {mode === "split" && splitRange.start !== null && splitRange.end !== null && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <span className="text-sm text-slate-700">
            Páginas {splitRange.start} a {splitRange.end} seleccionadas
          </span>
          <button
            disabled={busy}
            onClick={doSplit}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Extraer y descargar
          </button>
        </div>
      )}

      {mode === "form" && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          {formFields === null ? (
            <p className="text-sm text-slate-500">Buscando campos…</p>
          ) : formFields.length === 0 ? (
            <p className="text-sm text-slate-500">No se detectaron campos de formulario en este PDF.</p>
          ) : (
            <div className="space-y-3">
              {formFields.map(
                (f) =>
                  f.name && (
                    <div key={f.name}>
                      <label className="block text-xs font-medium text-slate-500">
                        {f.name} (página {f.page})
                      </label>
                      <input
                        value={formValues[f.name] ?? ""}
                        onChange={(e) => setFormValues({ ...formValues, [f.name!]: e.target.value })}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                  )
              )}
              <button
                disabled={busy}
                onClick={saveForm}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {pages.map((src, i) => {
          const inSplitRange =
            splitRange.start !== null &&
            splitRange.end !== null &&
            i >= splitRange.start &&
            i <= splitRange.end;
          const isSplitStart = splitRange.start === i && splitRange.end === null;

          return (
            <div key={i} className="text-center">
              <div
                className={`relative inline-block rounded border-2 ${
                  inSplitRange || isSplitStart ? "border-emerald-500" : "border-slate-200"
                }`}
                draggable={mode === "reorder"}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => mode === "reorder" && e.preventDefault()}
                onDrop={() => mode === "reorder" && handleDrop(i)}
              >
                <img
                  src={src}
                  alt={`Página ${i + 1}`}
                  onClick={(e) => handlePageClick(i, e)}
                  className={`h-72 rounded ${
                    mode !== "view" ? "cursor-crosshair" : ""
                  } ${mode === "reorder" ? "cursor-move" : ""}`}
                />

                {pendingText && pendingText.page === i && (
                  <div
                    className="absolute z-10 w-56 rounded-md border border-slate-300 bg-white p-3 shadow-lg"
                    style={{ left: pendingText.leftPx, top: pendingText.topPx }}
                  >
                    <textarea
                      autoFocus
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      placeholder="Texto a insertar"
                      rows={2}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-16 rounded border border-slate-300 px-1 py-1 text-xs"
                      />
                      <button
                        onClick={confirmAddText}
                        className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        Añadir
                      </button>
                      <button
                        onClick={() => setPendingText(null)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {pendingImage && pendingImage.page === i && (
                  <div
                    className="absolute z-10 w-56 rounded-md border border-slate-300 bg-white p-3 shadow-lg"
                    style={{ left: pendingImage.leftPx, top: pendingImage.topPx }}
                  >
                    <input ref={imageFileRef} type="file" accept="image/*" className="w-full text-xs" />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={confirmAddImage}
                        className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                      >
                        Insertar
                      </button>
                      <button
                        onClick={() => setPendingImage(null)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">Página {i}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
