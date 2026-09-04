// netlify/functions/openday-register.js
//
// Registra la matrícula del Open Day en Google Sheets y envía:
// 1) Email de confirmación al alumno con reglamento y resguardo de imagen
// 2) Aviso a la escuela con todos los datos

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      nombre, email, telefono, dni, fechaNacimiento, edad, clases,
      aceptaReglamento, aceptaRgpd, aceptaImagen, firma, comoNosConocio,
      tutor1Nombre, tutor1Tel, tutor1Email, tutor1Relacion, tutor1Dni,
      tutor2Nombre, tutor2Tel, tutor2Email, tutor2Relacion, tutor2Dni,
      fechaFirma,
    } = data;

    if (!nombre || !email || !clases) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos obligatorios.' }),
      };
    }

    const fechaFormateada = new Date(fechaFirma).toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    // 1) Registrar en Google Sheets
    try {
      await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'openday_matricula',
          datos: {
            nombre, email, telefono, dni, fechaNacimiento, edad, clases,
            aceptaReglamento, aceptaRgpd, aceptaImagen, firma, comoNosConocio,
            tutor1Nombre, tutor1Tel, tutor1Email, tutor1Relacion, tutor1Dni,
            tutor2Nombre, tutor2Tel, tutor2Email, tutor2Relacion, tutor2Dni,
            fechaFirma,
          },
        }),
      });
    } catch (err) {
      console.error('Error registrando en Google Sheets:', err);
    }

    // 2) Email de confirmación al alumno
    const resguardoImagen = aceptaImagen
      ? `<div style="background:rgba(255,43,214,.08); border:1px solid rgba(255,43,214,.3); border-radius:12px; padding:20px; margin:20px 0;">
          <h3 style="color:#ff2bd6; margin-bottom:12px;">📸 Resguardo de Consentimiento de Derechos de Imagen</h3>
          <p style="font-size:13px; line-height:1.7;">
            <strong>Alumno/a:</strong> ${nombre}<br>
            <strong>DNI/NIE:</strong> ${dni}<br>
            <strong>Fecha y hora:</strong> ${fechaFormateada}<br>
            <strong>Firma digital:</strong> ${firma}<br><br>
            La persona indicada <strong>CONSIENTE</strong> expresamente el uso de su imagen y/o la de su tutorizado/a
            con fines promocionales de <strong>Dicharm Dance</strong>, incluyendo fotografías y vídeos en redes sociales,
            web y material publicitario. Este consentimiento puede ser revocado en cualquier momento
            contactando con dicharmdance@gmail.com.
          </p>
        </div>`
      : `<div style="background:rgba(255,255,255,.04); border-radius:12px; padding:16px; margin:20px 0;">
          <p style="font-size:13px; color:#b9b3c9;">📸 Derechos de imagen: <strong>No consiente</strong> (${fechaFormateada})</p>
        </div>`;

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
          subject: '¡Matrícula completada en Dicharm Dance! 🎉',
          html: `
            <div style="font-family:Arial,sans-serif; max-width:580px; margin:0 auto;
                        padding:30px; background:#0e0a16; color:#ffffff; border-radius:16px;">
              <h1 style="background:linear-gradient(90deg,#ff2bd6,#8a2be2);
                         -webkit-background-clip:text; background-clip:text;
                         color:transparent; font-size:26px;">
                ¡Bienvenido/a, ${nombre}! 🎉
              </h1>
              <p>Tu matrícula en Dicharm Dance está <strong>completada</strong>. Guarda este email como justificante.</p>

              <div style="background:rgba(255,255,255,.06); border-radius:12px; padding:20px; margin:20px 0; line-height:1.9;">
                <p style="margin:4px 0;">📚 <strong>Clases:</strong> ${clases}</p>
                <p style="margin:4px 0;">📅 <strong>Inicio:</strong> Septiembre 2025</p>
                <p style="margin:4px 0;">📍 <strong>Dirección:</strong> Carrer d'Eusebi Güell 43, Sant Boi de Llobregat</p>
              </div>

              <div style="background:rgba(255,255,255,.04); border-radius:12px; padding:16px; margin:20px 0;">
                <h3 style="font-size:14px; margin-bottom:8px;">📋 Resumen de consentimientos</h3>
                <p style="font-size:13px; color:#b9b3c9; margin:4px 0;">✅ Reglamento de Régimen Interno: Aceptado</p>
                <p style="font-size:13px; color:#b9b3c9; margin:4px 0;">✅ Política de Protección de Datos: Aceptada</p>
                <p style="font-size:13px; color:#b9b3c9; margin:4px 0;">📸 Derechos de imagen: ${aceptaImagen ? 'Consiente' : 'No consiente'}</p>
                <p style="font-size:13px; color:#b9b3c9; margin:4px 0;">✍️ Firma digital: ${firma}</p>
                <p style="font-size:13px; color:#b9b3c9; margin:4px 0;">🕐 Fecha y hora: ${fechaFormateada}</p>
              </div>

              ${resguardoImagen}

              <p>📄 <a href="https://drive.google.com/file/d/1YFlkvjvoDNfS4uCyC8qGU-zq53cAiJqa/view?usp=sharing"
                 style="color:#ff2bd6;">Ver Reglamento de Régimen Interno</a></p>

              <p style="margin-top:24px;">¡Nos vemos en la pista! 💃🕺</p>
              <p style="color:#b9b3c9; font-size:12px; margin-top:30px;">
                Dicharm Dance · Carrer d'Eusebi Güell 43, Sant Boi de Llobregat · dicharmdance@gmail.com
              </p>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('Error enviando email al alumno:', err);
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
          subject: `🆕 Nueva matrícula Open Day — ${nombre}`,
          html: `
            <div style="font-family:Arial,sans-serif; padding:20px;">
              <h2>Nueva matrícula Open Day</h2>
              <p><strong>Nombre:</strong> ${nombre}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Teléfono:</strong> ${telefono}</p>
              <p><strong>DNI:</strong> ${dni}</p>
              <p><strong>Fecha nacimiento:</strong> ${fechaNacimiento}</p>
              <p><strong>Edad:</strong> ${edad}</p>
              <p><strong>Clases:</strong> ${clases}</p>
              <p><strong>Derechos de imagen:</strong> ${aceptaImagen ? '✅ Consiente' : '❌ No consiente'}</p>
              <p><strong>Firma:</strong> ${firma}</p>
              <p><strong>Fecha firma:</strong> ${fechaFormateada}</p>
              <p><strong>Cómo nos conoció:</strong> ${comoNosConocio || 'No indicado'}</p>
              ${tutor1Nombre ? `<hr><h3>Tutor principal</h3>
              <p>${tutor1Nombre} · ${tutor1Relacion} · ${tutor1Tel} · ${tutor1Email} · DNI: ${tutor1Dni}</p>` : ''}
              ${tutor2Nombre ? `<h3>Tutor secundario</h3>
              <p>${tutor2Nombre} · ${tutor2Relacion} · ${tutor2Tel} · ${tutor2Email} · DNI: ${tutor2Dni}</p>` : ''}
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
    console.error('Error en openday-register:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno. Inténtalo de nuevo.' }),
    };
  }
};