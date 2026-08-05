import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html_body: str) -> None:
    if not settings.smtp_enabled:
        logger.warning("SMTP no configurado, no se envió el correo a %s: %s", to, subject)
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg.set_content("Este correo requiere un cliente compatible con HTML.")
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


def render_email(
    preheader: str,
    heading: str,
    body_html: str,
    cta_text: str | None = None,
    cta_url: str | None = None,
) -> str:
    """Wraps content in irtax's branded transactional-email template (logo, colors, footer)."""
    logo_url = f"{settings.frontend_url}/email-logo.png"
    site_label = settings.frontend_url.replace("https://", "").replace("http://", "")

    cta_block = ""
    if cta_text and cta_url:
        cta_block = f"""
        <tr>
          <td style="padding:8px 40px 8px;">
            <a href="{cta_url}"
               style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;
                      font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">
              {cta_text}
            </a>
          </td>
        </tr>
        """

    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#f1f5f9;">{preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0"
                 style="background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;max-width:480px;width:100%;">
            <tr>
              <td style="padding:32px 40px 8px;text-align:center;">
                <img src="{logo_url}" alt="irtax" width="150" style="display:block;margin:0 auto;border:0;">
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 0;">
                <h1 style="margin:0 0 12px;font-size:19px;color:#0f172a;">{heading}</h1>
                <div style="font-size:14px;line-height:1.6;color:#334155;">{body_html}</div>
              </td>
            </tr>
            {cta_block}
            <tr>
              <td style="padding:28px 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;color:#94a3b8;">
                  © 2026 irtax · <a href="{settings.frontend_url}" style="color:#94a3b8;">{site_label}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
