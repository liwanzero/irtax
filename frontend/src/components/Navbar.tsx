import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo-navbar.png";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="irtax" className="h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link to="/precios" className="hover:text-slate-900">
            Precios
          </Link>
          {user ? (
            <>
              <Link to="/dashboard" className="hover:text-slate-900">
                Mis conversiones
              </Link>
              <Link to="/editor" className="hover:text-slate-900">
                Editor de PDF
              </Link>
              <Link to="/facturacion" className="hover:text-slate-900">
                Facturación
              </Link>
              <span className="text-slate-400">{user.email}</span>
              <button
                onClick={async () => {
                  await logout();
                  navigate("/");
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-slate-900">
                Iniciar sesión
              </Link>
              <Link
                to="/registro"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700"
              >
                Registrarse
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
