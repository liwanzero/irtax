# irtax — Conversor PDF ⇄ Word con OCR

Aplicación web para convertir PDF a Word y Word a PDF (con OCR para documentos escaneados),
con registro por email/contraseña o Google, y suscripciones mensuales vía Stripe (plan Free
$0/mes incluido).

## Requisitos

- Docker Desktop

## Primer arranque

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (docs interactivas en http://localhost:8000/docs)

Con `.env` recién copiado, `GOOGLE_CLIENT_ID` y `STRIPE_SECRET_KEY` están vacíos: la app
funciona igual (registro por email/contraseña, conversión de documentos, plan Free), pero
el botón de Google y el checkout de Stripe quedan ocultos/deshabilitados hasta que rellenes
esas variables.

## Añadir Google OAuth

1. Crea un proyecto en https://console.cloud.google.com/
2. "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" (tipo
   "Web application").
3. En "Authorized redirect URIs" añade: `http://localhost:8000/auth/google/callback`
4. Copia el Client ID y Client Secret a `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. `docker compose restart backend`

## Añadir Stripe

1. Crea una cuenta en https://dashboard.stripe.com/register
2. En modo de prueba, copia la clave secreta y la publicable a `.env`
   (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`).
3. Crea un producto/precio recurrente mensual en el Dashboard de Stripe para cada plan de
   pago que quieras ofrecer, y añade una fila en la tabla `plans` con su `stripe_price_id`
   (el plan `free` ya existe y no necesita precio de Stripe).
4. Para probar webhooks en local:
   ```bash
   stripe listen --forward-to localhost:8000/webhooks/stripe
   ```
   Copia el `whsec_...` que te da a `STRIPE_WEBHOOK_SECRET` en `.env`.
5. `docker compose restart backend`

## Estructura

Ver `backend/app` (FastAPI) y `frontend/src` (React + Vite + Tailwind). Los jobs de
conversión se procesan en background por un worker de RQ (`docker compose logs -f worker`).
