import { usePageMeta } from "../hooks/usePageMeta";

export default function Terms() {
  usePageMeta({
    title: "Términos de Servicio — irtax",
    description: "Condiciones de uso, planes de pago y política de cancelación del servicio irtax.",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-900">Términos de Servicio</h1>
      <p className="mt-2 text-sm text-slate-400">Última actualización: julio de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">1. El servicio</h2>
          <p className="mt-2">
            irtax es un servicio en línea para convertir documentos PDF a Word y viceversa (incluyendo
            reconocimiento óptico de caracteres, OCR, para documentos escaneados) y para editar
            documentos PDF. Se ofrece "tal cual", y hacemos nuestro mejor esfuerzo para que las
            conversiones y ediciones sean precisas, pero no podemos garantizar un resultado perfecto en
            el 100% de los documentos, especialmente en escaneos de baja calidad o formularios PDF poco
            comunes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">2. Cuentas</h2>
          <p className="mt-2">
            Eres responsable de mantener segura tu contraseña y de la actividad que ocurra en tu
            cuenta. Debes darnos un correo electrónico válido y verdadero al registrarte.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Planes y pagos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>El plan Free es gratuito y no requiere tarjeta de pago.</li>
            <li>
              Los planes de pago (Básico, Pro, Premium) se cobran <strong>mensualmente</strong> y
              todos incluyen <strong>30 días de prueba gratis</strong>. Al terminar la prueba, se
              cobra automáticamente el precio del plan salvo que canceles antes.
            </li>
            <li>
              Puedes cancelar tu suscripción en cualquier momento desde "Facturación" dentro de la
              app; la cancelación aplica al final del periodo ya pagado.
            </li>
            <li>Los pagos se procesan de forma segura a través de Stripe.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">4. Uso aceptable</h2>
          <p className="mt-2">
            No puedes usar irtax para procesar documentos ilegales, que infrinjan derechos de autor de
            terceros, o con el fin de dañar el servicio (por ejemplo, intentar sobrecargarlo o
            acceder a cuentas de otros usuarios). Nos reservamos el derecho de suspender cuentas que
            violen estas condiciones.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">5. Tus documentos</h2>
          <p className="mt-2">
            Los documentos que subes siguen siendo tuyos. Los usamos únicamente para procesarlos y
            devolvértelos, y se eliminan automáticamente de nuestros servidores 24 horas después.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">6. Límite de responsabilidad</h2>
          <p className="mt-2">
            En la medida permitida por la ley, irtax no se hace responsable de pérdidas indirectas
            derivadas del uso del servicio. Te recomendamos conservar siempre una copia de tus
            documentos originales.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">7. Cambios y contacto</h2>
          <p className="mt-2">
            Podemos actualizar estos términos ocasionalmente; publicaremos la fecha de la última
            actualización arriba. Preguntas a{" "}
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
