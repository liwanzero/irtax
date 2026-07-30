import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import Editor from "./pages/Editor";
import PdfTools from "./pages/PdfTools";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Navbar />
          <div className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/precios" element={<Pricing />} />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/terminos" element={<Terms />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/facturacion"
              element={
                <ProtectedRoute>
                  <Billing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/editor"
              element={
                <ProtectedRoute>
                  <Editor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/herramientas"
              element={
                <ProtectedRoute>
                  <PdfTools />
                </ProtectedRoute>
              }
            />
          </Routes>
          </div>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
