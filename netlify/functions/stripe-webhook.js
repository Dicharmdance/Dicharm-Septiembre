// netlify/functions/stripe-webhook.js
//
// Este webhook escucha los eventos de Stripe. Cuando detecta un pago
// completado (checkout.session.completed):
//   1) Envía un email de confirmación automático al cliente (vía Resend).
//   2) Envía los datos a Google Sheets para registrar al alumno y el pago
//      automáticamente en las pestañas "Alumnos Activos" y "Pagos".
//
// CONFIGURACIÓN NECESARIA (Netlify → Site settings → Environment variables):
//   STRIPE_SECRET_KEY         → tu clave secreta de Stripe
//   STRIPE_WEBHOOK_SECRET     → clave del endpoint del webhook (whsec_...)
//   RESEND_API_KEY            → clave de Resend (resend.com, capa gratuita 100 emails/día)
//   GOOGLE_SHEETS_WEBHOOK_URL → URL del Google Apps Script publicado (ver guía)
//   SCHOOL_EMAIL_FROM         → email remitente verificado en Resend, ej: noreply@dicharmdance.com

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
console.log('Webhook recibido', event.httpMethod);
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const meta = session.metadata || {};

    const cliente = {
      nombre: meta.nombre || '',
      email: session.customer_email || '',
      telefono: meta.telefono || '',
      edad: meta.edad || '',
      clases: meta.clases || '',
      horasSemanales: meta.horas_semanales || '',
      precioBase: meta.precio_base || '',
      importePagado: (session.amount_total / 100).toFixed(2),
      fechaPago: new Date().toISOString(),
      stripeSessionId: session.id,
      dni: meta.dni || '',
      fechaNacimiento: meta.fecha_nacimiento || '',
      tutor1Nombre: meta.tutor1_nombre || '',
      tutor1Telefono: meta.tutor1_telefono || '',
      tutor1Email: meta.tutor1_email || '',
      tutor1Relacion: meta.tutor1_relacion || '',
      tutor1Dni: meta.tutor1_dni || '',
      tutor2Nombre: meta.tutor2_nombre || '',
      tutor2Telefono: meta.tutor2_telefono || '',
      tutor2Email: meta.tutor2_email || '',
      tutor2Relacion: meta.tutor2_relacion || '',
      tutor2Dni: meta.tutor2_dni || '',
firma: meta.firma || '',
      aceptaReglamento: meta.acepta_reglamento || '',
      aceptaRgpd: meta.acepta_rgpd || '',
      aceptaImagen: meta.acepta_imagen || '',
    };

    // 1) Enviar email de confirmación automático
    try {
     console.log('Intentando enviar email a:', cliente.email);
 const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },



        body: JSON.stringify({
          from: process.env.SCHOOL_EMAIL_FROM,
          to: cliente.email,
          subject: '¡Tu plaza en Dicharm Dance está confirmada! 🎉',
          html: `
            <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; padding:30px; background:#0e0a16; color:#ffffff; border-radius:16px;">
              <h1 style="background:linear-gradient(90deg,#ff2bd6,#8a2be2,#1e6bff); -webkit-background-clip:text; background-clip:text; color:transparent; font-size:26px;">¡Bienvenido/a a Dicharm Dance!</h1>
              <p>Hola ${cliente.nombre},</p>
              <p>Tu reserva de plaza para <strong>Septiembre</strong> ha sido confirmada correctamente.</p>
              <div style="background:rgba(255,255,255,.06); border-radius:12px; padding:18px; margin:20px 0;">
                <p style="margin:4px 0;"><strong>Clases:</strong> ${cliente.clases}</p>
                <p style="margin:4px 0;"><strong>Horas semanales:</strong> ${cliente.horasSemanales}h</p>
                <p style="margin:4px 0;"><strong>Importe pagado:</strong> ${cliente.importePagado}€</p>
              </div>
              <p>Nos pondremos en contacto contigo antes del inicio de curso con toda la información práctica (vestuario, punto de encuentro, etc.).</p>
<div style="background:rgba(255,255,255,.04); border-radius:12px; padding:20px; margin:20px 0; text-align:center;">
  <p style="margin-bottom:12px; font-size:14px;">📄 Aquí tienes una copia del Reglamento de Régimen Interno:</p>
  <a href="https://drive.google.com/file/d/1YFlkvjvoDNfS4uCyC8qGU-zq53cAiJqa/view?usp=sharing" 
     target="_blank"
     style="display:inline-block; background:linear-gradient(90deg,#ff2bd6,#8a2be2); color:#fff; padding:12px 24px; border-radius:50px; text-decoration:none; font-weight:bold; font-size:14px;">
    📥 Ver Reglamento
  </a>
</div>
              <p style="margin-top:24px;">¡Nos vemos en la pista! 💃🕺</p>
              <p style="color:#b9b3c9; font-size:12px; margin-top:30px;">Dicharm Dance · Sant Boi de Llobregat</p>
            </div>
          `,
        }),
      });
const resendBody = await emailRes.json();
console.log('Resend status:', emailRes.status, JSON.stringify(resendBody));
    } catch (err) {
      console.error('Error enviando email de confirmación:', err);
    }

    // 2) Registrar al cliente y el pago en Google Sheets
    try {
console.log('Datos cliente:', JSON.stringify(cliente));
console.log('Enviando a Google Sheets:', process.env.GOOGLE_SHEETS_WEBHOOK_URL ? 'URL configurada' : 'URL NO configurada');
            const sheetsRes = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'nueva_inscripcion', datos: cliente }),
      });
      const sheetsBody = await sheetsRes.text();
      console.log('Google Sheets response:', sheetsRes.status, sheetsBody);
    } catch (err) {
      console.error('Error registrando en Google Sheets:', err);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
