// netlify/functions/confirm-transfer.js
//
// Se invoca cuando un alumno elige "Transferencia" y envía el formulario.
// Hace dos cosas:
//   1) Envía un email al alumno con los datos bancarios y el importe exacto.
//   2) Registra la pre-inscripción en Google Sheets como "Pendiente de pago".
//
// VARIABLES DE ENTORNO (Netlify → Site settings → Environment variables):
//   RESEND_API_KEY            → clave de Resend (resend.com)
//   SCHOOL_EMAIL_FROM         → email remitente verificado en Resend
//   GOOGLE_SHEETS_WEBHOOK_URL → URL del Google Apps Script publicado
//   BANK_HOLDER               → Titular de la cuenta bancaria
//   BANK_IBAN                 → IBAN completo
//
// SEGURIDAD: BANK_HOLDER y BANK_IBAN se leen aquí en el servidor y se
// incluyen únicamente en el email al alumno. NUNCA se devuelven al navegador.

// Tabla de precios (debe estar sincronizada con create-checkout.js y el HTML)
function calcularPrecioBase(horasSemanales) {
  if (horasSemanales <= 0) return 0;
  if (horasSemanales === 1) return 35;
  if (horasSemanales === 2) return 60;
  if (horasSemanales === 3) return 80;
  return 80 + (horasSemanales - 3) * 20;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { nombre, email, telefono, edad, clasesSeleccionadas, horasSemanales } = data;

    if (!nombre || !email || !horasSemanales) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos obligatorios.' }),
      };
    }

    const precioBase = calcularPrecioBase(Number(horasSemanales));

    // Datos bancarios — solo viven en el servidor
    const titular = process.env.BANK_HOLDER || '[Titular no configurado]';
    const iban    = process.env.BANK_IBAN    || '[IBAN no configurado]';

    // 1) Email al alumno con los datos de transferencia
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SCHOOL_EMAIL_FROM,
          to: email,
          subject: 'Datos para completar tu inscripción en Dicharm Dance 🏦',
          html: `
            <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto;
                        padding:30px; background:#0e0a16; color:#ffffff; border-radius:16px;">
              <h1 style="background:linear-gradient(90deg,#ff2bd6,#8a2be2,#1e6bff);
                         -webkit-background-clip:text; background-clip:text;
                         color:transparent; font-size:26px;">
                ¡Casi lo tienes, ${nombre}!
              </h1>
              <p>Hemos recibido tu solicitud de plaza. Para confirmarla, realiza la transferencia
                 en los próximos <strong>3 días laborables</strong>:</p>

              <div style="background:rgba(255,255,255,.06); border-radius:12px;
                          padding:20px; margin:20px 0; line-height:1.8;">
                <p style="margin:4px 0;"><strong>Titular:</strong> ${titular}</p>
                <p style="margin:4px 0;"><strong>IBAN:</strong> <code style="letter-spacing:.05em;">${iban}</code></p>
                <p style="margin:4px 0;"><strong>Importe:</strong> ${precioBase}€</p>
                <p style="margin:4px 0;"><strong>Concepto:</strong> Inscripción Septiembre – ${nombre}</p>
              </div>

              <p style="font-size:13px; color:#b9b3c9;">
                ⚠️ Incluye tu nombre completo en el concepto para que podamos identificar
                el pago fácilmente.
              </p>

              <div style="background:rgba(255,255,255,.04); border-radius:10px;
                          padding:16px; margin:20px 0; font-size:13px;">
                <p style="margin:4px 0;"><strong>Clases reservadas:</strong> ${clasesSeleccionadas}</p>
                <p style="margin:4px 0;"><strong>Horas semanales:</strong> ${horasSemanales}h</p>
              </div>

              <p>Una vez confirmemos la recepción del ingreso (24-48h laborables),
                 recibirás otro email con la confirmación definitiva de tu plaza.</p>

              <p>¿Tienes alguna duda? Escríbenos a
                 <a href="mailto:dicharmdance@gmail.com"
                    style="color:#ff2bd6;">dicharmdance@gmail.com</a>
                 o por WhatsApp.</p>

              <p style="margin-top:24px;">¡Nos vemos en la pista! 💃🕺</p>
              <p style="color:#b9b3c9; font-size:12px; margin-top:30px;">
                Dicharm Dance · Carrer d'Eusebi Güell 43, Sant Boi de Llobregat
              </p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('Error enviando email de transferencia:', err);
      // No interrumpimos el flujo — igual registramos en Sheets
    }

    // 2) Registrar en Google Sheets como "Pendiente de pago"
    try {
      await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'nueva_inscripcion',
          datos: {
            nombre,
            email,
            telefono:        telefono || '',
            edad:            edad || '',
            clases:          clasesSeleccionadas,
            horas_semanales: String(horasSemanales),
            precio_base:     String(precioBase),
            forma_pago:      'Transferencia',
            estado:          'Pendiente de pago',
            fechaInscripcion: new Date().toISOString(),
          },
        }),
      });
    } catch (err) {
      console.error('Error registrando transferencia en Google Sheets:', err);
    }

    // Solo confirmamos que el proceso arrancó bien.
    // Los datos bancarios NO se incluyen en esta respuesta.
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };

  } catch (err) {
    console.error('Error en confirm-transfer:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno. Inténtalo de nuevo o contáctanos.' }),
    };
  }
};
