import AuthForm from "../components/AuthForm";

export default function Register() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Crea tu cuenta gratis</h1>
      <AuthForm mode="register" />
    </div>
  );
}
