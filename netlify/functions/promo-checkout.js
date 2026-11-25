// netlify/functions/promo-checkout.js
//
// Crea la sesión de pago de Stripe para la PROMO ANIVERSARIO.
// Precio base 19 € (un curso) o 29 € (los dos) + gastos de gestión de Stripe,
// que paga el alumno, igual que en las inscripciones normales.
//
// Usa las mismas variables de entorno que create-checkout.js:
//   STRIPE_SECRET_KEY, SITE_URL
//
// Después del pago, stripe-webhook.js envía el email de bienvenida,
// avisa a la escuela y registra la inscripción en Google Sheets.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const promo = require('../lib/promo-aniversario');

const respuesta = (statusCode, cuerpo) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
});

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const {
      opcion, nombre, email, telefono, dni,
      aceptaReglamento, aceptaRgpd, aceptaImagen, firma, comoNosConocio, fechaFirma,
    } = data;

    // 1) Validaciones
    if (promo.promoCerrada()) {
      return respuesta(400, { error: 'Las inscripciones de la promo ya están cerradas.' });
    }
    if (!promo.OPCIONES[opcion]) {
      return respuesta(400, { error: 'Elige Salsa, Bachata o las dos.' });
    }
    if (!nombre || !email || !telefono || !dni || !firma) {
      return respuesta(400, { error: 'Faltan datos obligatorios.' });
    }
    if (!aceptaReglamento || !aceptaRgpd) {
      return respuesta(400, { error: 'Debes aceptar el reglamento y la política de datos.' });
    }

    // 2) Comprobar plazas justo antes de cobrar
    const libres = promo.plazasLibres(await promo.contarOcupadas(stripe));
    if (!promo.hayPlazaPara(opcion, libres)) {
      return respuesta(409, { error: 'Lo sentimos, ya no quedan plazas para esta opción.', plazas: libres });
    }

    const elegida = promo.OPCIONES[opcion];
    const precioTotal = promo.calcularTotalConStripe(elegida.precio);
    const gastosGestion = +(precioTotal - elegida.precio).toFixed(2);
    const fechas = elegida.grupos.map((g) => `${promo.GRUPOS[g].nombre}: ${promo.GRUPOS[g].fechas.join(', ')}`).join(' · ');

    // 3) Sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      expires_at: Math.floor(Date.now() / 1000) + promo.MINUTOS_RESERVA * 60,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Dicharm Dance — Promo Aniversario: ${elegida.nombre}`,
              description: `Diciembre 2026, de 21:30 a 22:30. ${fechas}. Precio ${elegida.precio.toFixed(2)}€ + gastos de gestión Stripe ${gastosGestion.toFixed(2)}€.`,
            },
            unit_amount: Math.round(precioTotal * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        promo: promo.PROMO_ID,
        opcion,
        precio_base: String(elegida.precio),
        gastos_gestion: String(gastosGestion),
        nombre,
        telefono: telefono || '',
        dni: dni || '',
        acepta_reglamento: String(!!aceptaReglamento),
        acepta_rgpd: String(!!aceptaRgpd),
        acepta_imagen: String(!!aceptaImagen),
        firma: firma || '',
        fecha_firma: fechaFirma || new Date().toISOString(),
        como_nos_conocio: comoNosConocio || '',
      },
      success_url: `${process.env.SITE_URL}/gracias-aniversario.html?opcion=${opcion}`,
      cancel_url: `${process.env.SITE_URL}/aniversario.html`,
    });

    return respuesta(200, { url: session.url });
  } catch (err) {
    console.error('Error creando el pago de la promo:', err);
    return respuesta(500, { error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' });
  }
};
