import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-400 sm:flex-row">
        <p>© {new Date().getFullYear()} irtax</p>
        <div className="flex gap-4">
          <Link to="/privacidad" className="hover:text-slate-600">
            Política de Privacidad
          </Link>
          <Link to="/terminos" className="hover:text-slate-600">
            Términos de Servicio
          </Link>
        </div>
      </div>
    </footer>
  );
}
