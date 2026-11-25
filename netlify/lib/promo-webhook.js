// netlify/lib/promo-webhook.js
//
// Qué pasa cuando alguien paga la PROMO ANIVERSARIO (lo llama stripe-webhook.js):
//   1) Email de bienvenida al alumno (Resend) con fechas, hora, qué llevar y dirección.
//   2) Aviso a la escuela con todos los datos.
//   3) Registro en Google Sheets (tipo "promo_aniversario").

const promo = require('./promo-aniversario');

const ESCUELA_EMAIL = 'dicharmdance@gmail.com';
const DIRECCION = "Carrer d'Eusebi Güell 43, Sant Boi de Llobregat";
const WHATSAPP = '614 028 688';
const REGLAMENTO_URL = 'https://drive.google.com/file/d/1YFlkvjvoDNfS4uCyC8qGU-zq53cAiJqa/view?usp=sharing';

async function enviarEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.SCHOOL_EMAIL_FROM, to, subject, html }),
  });
  const cuerpo = await res.json().catch(() => ({}));
  console.log('Resend (promo):', to, res.status, JSON.stringify(cuerpo));
  return res.ok;
}

function datosDesdeSesion(session) {
  const meta = session.metadata || {};
  const opcion = promo.OPCIONES[meta.opcion] || { nombre: meta.opcion, grupos: [] };
  return {
    nombre: meta.nombre || '',
    email: session.customer_email || (session.customer_details && session.customer_details.email) || '',
    telefono: meta.telefono || '',
    dni: meta.dni || '',
    opcionId: meta.opcion || '',
    opcion: opcion.nombre,
    grupos: opcion.grupos,
    importePagado: (session.amount_total / 100).toFixed(2),
    precioBase: meta.precio_base ? Number(meta.precio_base).toFixed(2) : '',
    gastosGestion: meta.gastos_gestion ? Number(meta.gastos_gestion).toFixed(2) : '',
    fechaPago: new Date().toISOString(),
    stripeSessionId: session.id,
    aceptaReglamento: meta.acepta_reglamento || '',
    aceptaRgpd: meta.acepta_rgpd || '',
    aceptaImagen: meta.acepta_imagen || '',
    firma: meta.firma || '',
    fechaFirma: meta.fecha_firma || '',
    comoNosConocio: meta.como_nos_conocio || '',
  };
}

function htmlBienvenida(a) {
  const e = promo.escapeHtml;
  const bloquesGrupos = a.grupos.map((g) => {
    const grupo = promo.GRUPOS[g];
    return `
      <div style="background:rgba(255,255,255,.06); border-radius:12px; padding:18px; margin:14px 0;">
        <p style="margin:0 0 8px; font-size:17px;"><strong>💃 ${e(grupo.nombre)}</strong></p>
        <p style="margin:4px 0;">🕘 ${e(grupo.dia)} de ${e(grupo.hora)}</p>
        <p style="margin:4px 0;">📅 ${grupo.fechas.map(e).join('<br>📅 ')}</p>
      </div>`;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; padding:30px; background:#0e0a16; color:#ffffff; border-radius:16px;">
      <h1 style="background:linear-gradient(90deg,#ff2bd6,#8a2be2,#1e6bff); -webkit-background-clip:text; background-clip:text; color:transparent; font-size:26px;">¡Bienvenido/a a Dicharm Dance! 🎉</h1>
      <p>Hola ${e(a.nombre)},</p>
      <p>Tu plaza en la <strong>Promo Aniversario</strong> está confirmada. ¡Gracias por celebrar nuestro primer año con nosotros!</p>

      ${bloquesGrupos}

      <p style="margin:4px 0;"><strong>Importe pagado:</strong> ${e(a.importePagado)} €${a.gastosGestion ? ` <span style="color:#b9b3c9; font-size:13px;">(${e(a.precioBase)} € + ${e(a.gastosGestion)} € de gestión)</span>` : ''}</p>

      <div style="background:rgba(255,255,255,.04); border-radius:12px; padding:18px; margin:20px 0; line-height:1.8;">
        <p style="margin:0 0 8px;"><strong>Para tu primera clase</strong></p>
        <p style="margin:2px 0;">👟 Ropa cómoda y calzado que no se quede pegado al suelo</p>
        <p style="margin:2px 0;">💧 Una botella de agua</p>
        <p style="margin:2px 0;">⏰ Llega 5–10 minutos antes</p>
        <p style="margin:2px 0;">🙌 No hace falta experiencia: empezamos desde cero</p>
      </div>

      <p>📍 <strong>Dónde:</strong> ${e(DIRECCION)}</p>
      <p>Si tienes cualquier duda, escríbenos por WhatsApp al <strong>${e(WHATSAPP)}</strong> o a
        <a href="mailto:${ESCUELA_EMAIL}" style="color:#ff2bd6;">${ESCUELA_EMAIL}</a>.</p>

      <p>📄 <a href="${REGLAMENTO_URL}" style="color:#ff2bd6;">Ver Reglamento de Régimen Interno</a></p>

      <p style="margin-top:24px;">¡Nos vemos en la pista! 💃🕺</p>
      <p style="color:#b9b3c9; font-size:12px; margin-top:30px;">Dicharm Dance · ${e(DIRECCION)}</p>
    </div>`;
}

function htmlAvisoEscuela(a) {
  const e = promo.escapeHtml;
  return `
    <div style="font-family:Arial,sans-serif; padding:20px;">
      <h2>🎉 Nueva inscripción — Promo Aniversario</h2>
      <p><strong>Opción:</strong> ${e(a.opcion)} (${e(a.importePagado)} €)</p>
      <p><strong>Nombre:</strong> ${e(a.nombre)}</p>
      <p><strong>Email:</strong> ${e(a.email)}</p>
      <p><strong>Teléfono:</strong> ${e(a.telefono)}</p>
      <p><strong>DNI:</strong> ${e(a.dni)}</p>
      <p><strong>Derechos de imagen:</strong> ${a.aceptaImagen === 'true' ? '✅ Consiente' : '❌ No consiente'}</p>
      <p><strong>Firma:</strong> ${e(a.firma)} (${e(a.fechaFirma)})</p>
      <p><strong>Cómo nos conoció:</strong> ${e(a.comoNosConocio || 'No indicado')}</p>
      <p style="color:#777; font-size:12px;">Stripe: ${e(a.stripeSessionId)}</p>
    </div>`;
}

async function gestionarPagoPromo(session) {
  const alumno = datosDesdeSesion(session);

  // 1) Email de bienvenida al alumno
  try {
    await enviarEmail({
      to: alumno.email,
      subject: '¡Tu plaza en la Promo Aniversario está confirmada! 🎉',
      html: htmlBienvenida(alumno),
    });
  } catch (err) {
    console.error('Error enviando bienvenida de la promo:', err);
  }

  // 2) Aviso a la escuela
  try {
    await enviarEmail({
      to: ESCUELA_EMAIL,
      subject: `🆕 Promo Aniversario — ${alumno.opcion} — ${alumno.nombre}`,
      html: htmlAvisoEscuela(alumno),
    });
  } catch (err) {
    console.error('Error enviando aviso de la promo a la escuela:', err);
  }

  // 3) Google Sheets
  try {
    const res = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'promo_aniversario', datos: { ...alumno, grupos: alumno.grupos.join(' + ') } }),
    });
    console.log('Google Sheets (promo):', res.status, await res.text());
  } catch (err) {
    console.error('Error registrando la promo en Google Sheets:', err);
  }
}

module.exports = { gestionarPagoPromo, htmlBienvenida, htmlAvisoEscuela, datosDesdeSesion };
