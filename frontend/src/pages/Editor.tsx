import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { editorApi, ApiError, type PdfEditJob } from "../api/client";
import PdfLoadingBar from "../components/PdfLoadingBar";

const TIER_EDITOR = 2;
const TIER_ADVANCED = 3;

export default function Editor() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const [job, setJob] = useState<PdfEditJob | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [textForm, setTextForm] = useState({ page_number: 0, x: 50, y: 50, text: "", font_size: 14 });
  const [imageForm, setImageForm] = useState({ page_number: 0, x: 50, y: 50, width: 150, height: 150 });
  const [rotateForm, setRotateForm] = useState({ page_number: 0, degrees: 90 });
  const [splitForm, setSplitForm] = useState({ start_page: 0, end_page: 0 });
  const [reorderText, setReorderText] = useState("");
  const [formFieldsText, setFormFieldsText] = useState("");

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
    const { pages } = await editorApi.preview(jobId);
    setPages(pages);
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
            className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Elegir PDF
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{job.original_filename}</h1>
        <a
          href={editorApi.downloadUrl(job.id)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Descargar PDF
        </a>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {busy && <PdfLoadingBar active label="Aplicando cambios…" className="mb-4" />}

      <div className="mb-8 flex gap-3 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
        {pages.map((src, i) => (
          <div key={i} className="shrink-0 text-center">
            <img src={src} alt={`Página ${i + 1}`} className="h-64 rounded border border-slate-200" />
            <p className="mt-1 text-xs text-slate-400">Página {i}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-medium text-slate-800">Añadir texto</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input
              type="number"
              placeholder="Página"
              value={textForm.page_number}
              onChange={(e) => setTextForm({ ...textForm, page_number: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="Tamaño de letra"
              value={textForm.font_size}
              onChange={(e) => setTextForm({ ...textForm, font_size: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="X"
              value={textForm.x}
              onChange={(e) => setTextForm({ ...textForm, x: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="Y"
              value={textForm.y}
              onChange={(e) => setTextForm({ ...textForm, y: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              placeholder="Texto"
              value={textForm.text}
              onChange={(e) => setTextForm({ ...textForm, text: e.target.value })}
              className="col-span-2 rounded border border-slate-300 px-2 py-1"
            />
          </div>
          <button
            disabled={busy || !textForm.text}
            onClick={() => runAction(() => editorApi.addText(job.id, textForm))}
            className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Añadir
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-medium text-slate-800">Insertar imagen / firma</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input
              type="number"
              placeholder="Página"
              value={imageForm.page_number}
              onChange={(e) => setImageForm({ ...imageForm, page_number: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="X"
              value={imageForm.x}
              onChange={(e) => setImageForm({ ...imageForm, x: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="Y"
              value={imageForm.y}
              onChange={(e) => setImageForm({ ...imageForm, y: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="Ancho"
              value={imageForm.width}
              onChange={(e) => setImageForm({ ...imageForm, width: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <input
              type="number"
              placeholder="Alto"
              value={imageForm.height}
              onChange={(e) => setImageForm({ ...imageForm, height: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" className="mt-2 w-full text-sm" />
          <button
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                const file = imageInputRef.current?.files?.[0];
                if (!file) throw new ApiError("Elige una imagen primero", 400);
                await editorApi.addImage(job.id, imageForm, file);
              })
            }
            className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Insertar
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-medium text-slate-800">Rotar página</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input
              type="number"
              placeholder="Página"
              value={rotateForm.page_number}
              onChange={(e) => setRotateForm({ ...rotateForm, page_number: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            />
            <select
              value={rotateForm.degrees}
              onChange={(e) => setRotateForm({ ...rotateForm, degrees: Number(e.target.value) })}
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>
          <button
            disabled={busy}
            onClick={() => runAction(() => editorApi.rotate(job.id, rotateForm))}
            className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Rotar
          </button>
        </section>

        {isPremium && (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 font-medium text-slate-800">Unir otro PDF</h2>
              <input ref={mergeInputRef} type="file" accept=".pdf" className="w-full text-sm" />
              <button
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    const file = mergeInputRef.current?.files?.[0];
                    if (!file) throw new ApiError("Elige un PDF primero", 400);
                    await editorApi.merge(job.id, file);
                  })
                }
                className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Unir al final
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 font-medium text-slate-800">Dividir (extraer páginas)</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <input
                  type="number"
                  placeholder="Desde página"
                  value={splitForm.start_page}
                  onChange={(e) => setSplitForm({ ...splitForm, start_page: Number(e.target.value) })}
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Hasta página"
                  value={splitForm.end_page}
                  onChange={(e) => setSplitForm({ ...splitForm, end_page: Number(e.target.value) })}
                  className="rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  runAction(async () => {
                    const blob = await editorApi.split(job.id, splitForm);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "paginas_extraidas.pdf";
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                }
                className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Extraer y descargar
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 font-medium text-slate-800">Reordenar páginas</h2>
              <input
                placeholder="Ej: 2,0,1 (nuevo orden, empieza en 0)"
                value={reorderText}
                onChange={(e) => setReorderText(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                disabled={busy || !reorderText}
                onClick={() =>
                  runAction(async () => {
                    const order = reorderText.split(",").map((n) => Number(n.trim()));
                    await editorApi.reorder(job.id, order);
                  })
                }
                className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Reordenar
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 font-medium text-slate-800">Rellenar formulario</h2>
              <textarea
                placeholder={"nombre_campo=valor\notro_campo=otro valor"}
                value={formFieldsText}
                onChange={(e) => setFormFieldsText(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                disabled={busy || !formFieldsText}
                onClick={() =>
                  runAction(async () => {
                    const fields: Record<string, string> = {};
                    for (const line of formFieldsText.split("\n")) {
                      const [key, ...rest] = line.split("=");
                      if (key?.trim()) fields[key.trim()] = rest.join("=").trim();
                    }
                    await editorApi.fillForm(job.id, fields);
                  })
                }
                className="mt-3 w-full rounded-md border border-slate-300 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Rellenar
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
