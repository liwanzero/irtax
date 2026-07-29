import AuthForm from "../components/AuthForm";

export default function Login() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Inicia sesión</h1>
      <AuthForm mode="login" />
    </div>
  );
}
