// netlify/functions/reserve-trial.js
//
// Recibe la reserva de clase de prueba y la registra en Google Sheets.
// También envía un email de confirmación al cliente y un aviso a la escuela.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { nombre, email, telefono, clase, comoNosConocio } = data;

    if (!nombre || !email || !clase) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos obligatorios.' }),
      };
    }

   // 1) Registrar en Google Sheets
    try {
      console.log('Enviando a Sheets:', process.env.GOOGLE_SHEETS_WEBHOOK_URL ? 'URL ok' : 'URL no configurada');
      const sheetsRes = await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'reserva_prueba',
          datos: { nombre, email, telefono, clase, comoNosConocio },
        }),
      });
      const sheetsBody = await sheetsRes.text();
      console.log('Sheets response:', sheetsRes.status, sheetsBody);
    } catch (err) {
      console.error('Error registrando en Google Sheets:', err);
    }

    // 2) Email de confirmación al cliente
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
          subject: '¡Tu clase de prueba en Dicharm Dance está reservada! 🎉',
          html: `
            <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto;
                        padding:30px; background:#0e0a16; color:#ffffff; border-radius:16px;">
              <h1 style="background:linear-gradient(90deg,#ff2bd6,#8a2be2,#1e6bff);
                         -webkit-background-clip:text; background-clip:text;
                         color:transparent; font-size:26px;">
                ¡Hola, ${nombre}! 🎉
              </h1>
              <p>Hemos recibido tu solicitud de clase de prueba. En breve nos pondremos en contacto contigo para confirmar el día y hora.</p>

              <div style="background:rgba(255,255,255,.06); border-radius:12px;
                          padding:20px; margin:20px 0; line-height:1.9;">
                <p style="margin:4px 0;">💃 <strong>Clase elegida:</strong> ${clase}</p>
              </div>

              <p>Mientras tanto, si tienes alguna pregunta escríbenos a
                 <a href="mailto:dicharmdance@gmail.com" style="color:#ff2bd6;">dicharmdance@gmail.com</a>
                 o por WhatsApp al 614 028 688.</p>

              <p style="margin-top:24px;">¡Nos vemos pronto en la pista! 💃🕺</p>
              <p style="color:#b9b3c9; font-size:12px; margin-top:30px;">
                Dicharm Dance · Carrer d'Eusebi Güell 43, Sant Boi de Llobregat
              </p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('Error enviando email al cliente:', err);
    }

    // 3) Aviso a la escuela
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SCHOOL_EMAIL_FROM,
          to: 'dicharmdance@gmail.com',
          subject: '🆕 Nueva reserva de clase de prueba',
          html: `
            <div style="font-family:Arial,sans-serif; padding:20px;">
              <h2>Nueva reserva de clase de prueba</h2>
              <p><strong>Nombre:</strong> ${nombre}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Teléfono:</strong> ${telefono || 'No indicado'}</p>
              <p><strong>Clase:</strong> ${clase}</p>
              <p><strong>Cómo nos conoció:</strong> ${comoNosConocio || 'No indicado'}</p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('Error enviando aviso a la escuela:', err);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };

  } catch (err) {
    console.error('Error en reserve-trial:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno. Inténtalo de nuevo.' }),
    };
  }
};