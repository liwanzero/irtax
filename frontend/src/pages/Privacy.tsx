import { usePageMeta } from "../hooks/usePageMeta";

export default function Privacy() {
  usePageMeta({
    title: "Política de Privacidad — irtax",
    description: "Cómo irtax recoge, usa y protege tus datos al convertir y editar documentos PDF y Word.",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-900">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-slate-400">Última actualización: julio de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. Qué datos recogemos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Datos de cuenta:</strong> correo electrónico y contraseña (guardada de forma
              cifrada, nunca en texto plano), o tu correo y nombre de Google si te registras con
              Google.
            </li>
            <li>
              <strong>Documentos que subes:</strong> los archivos PDF o Word que conviertes o editas
              se guardan temporalmente en nuestros servidores para procesarlos, y{" "}
              <strong>se eliminan automáticamente 24 horas después</strong> de generarse.
            </li>
            <li>
              <strong>Datos de pago:</strong> no almacenamos números de tarjeta ni datos bancarios en
              ningún momento. Los pagos y suscripciones los procesa Stripe directamente; nosotros solo
              guardamos el identificador de tu suscripción y su estado (activa, en prueba, cancelada).
            </li>
            <li>
              <strong>Historial de uso:</strong> nombre de archivo, fecha y estado de cada conversión o
              edición que realizas, para mostrarte tu historial.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Para qué usamos tus datos</h2>
          <p className="mt-2">
            Únicamente para operar el servicio: autenticarte, procesar tus conversiones y ediciones,
            gestionar tu suscripción y cobrar cuando corresponda, y responder si nos contactas. No
            vendemos tus datos ni los usamos para publicidad de terceros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Con quién compartimos datos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Stripe</strong> (procesamiento de pagos) — recibe tu correo y los datos de pago
              que introduces directamente en su formulario, nunca en el nuestro.
            </li>
            <li>
              <strong>Google</strong> (si eliges iniciar sesión con Google) — recibe solo la solicitud
              de autenticación estándar de OAuth.
            </li>
          </ul>
          <p className="mt-2">No compartimos tus documentos con nadie más.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Cuánto tiempo guardamos tus datos</h2>
          <p className="mt-2">
            Los archivos subidos y convertidos se borran automáticamente 24 horas después de
            procesarse. Los datos de tu cuenta se conservan mientras la cuenta exista; puedes pedir
            que la eliminemos por completo en cualquier momento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Tus derechos</h2>
          <p className="mt-2">
            Puedes pedirnos acceder a tus datos, corregirlos, o eliminarlos por completo (incluyendo
            tu cuenta y suscripción) escribiéndonos por correo. Responderemos en un plazo razonable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Contacto</h2>
          <p className="mt-2">
            Para cualquier duda sobre privacidad, escríbenos a{" "}
            <a href="mailto:soporte@irtax.serveirc.com" className="underline">
              soporte@irtax.serveirc.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
