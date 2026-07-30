import AuthForm from "../components/AuthForm";
import { usePageMeta } from "../hooks/usePageMeta";

export default function Register() {
  usePageMeta({
    title: "Crea tu cuenta gratis — irtax",
    description:
      "Regístrate gratis en irtax y empieza a convertir PDF a Word, Word a PDF y editar tus documentos en línea.",
  });

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Crea tu cuenta gratis</h1>
      <AuthForm mode="register" />
    </div>
  );
}
