// netlify/functions/create-checkout.js
//
// Crea una sesión de pago en Stripe Checkout.
// Calcula el precio según las horas semanales y aplica la fórmula correcta
// de Stripe para que los gastos de gestión queden cubiertos exactamente:
//   total_cliente = (precioBase + 0,25€) / (1 - 0,015)
//
// VARIABLES DE ENTORNO (Netlify → Site settings → Environment variables):
//   STRIPE_SECRET_KEY   → clave secreta de Stripe (sk_live_... o sk_test_...)
//   SITE_URL            → URL pública del sitio (ej: https://dicharmdance.netlify.app)
//   BANK_HOLDER         → Nombre del titular de la cuenta bancaria
//   BANK_IBAN           → IBAN completo para transferencias
//
// NOTA SEGURIDAD: BANK_HOLDER y BANK_IBAN solo se usan para incluirlos en el
// email de confirmación enviado al alumno. NUNCA se devuelven al navegador.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Tabla de precios (mensualidad según horas/semana)
function calcularPrecioBase(horasSemanales) {
  if (horasSemanales <= 0) return 0;
  if (horasSemanales === 1) return 35;
  if (horasSemanales === 2) return 60;
  if (horasSemanales === 3) return 80;
  // Más de 3h/semana: 80€ + 20€ por cada hora adicional
  return 80 + (horasSemanales - 3) * 20;
}

// Fórmula correcta de Stripe: el cliente paga lo justo para que,
// después de que Stripe descuente su comisión (1,5% + 0,25€),
// la escuela reciba exactamente el precioBase.
function calcularTotalConStripe(precioBase) {
  if (precioBase <= 0) return 0;
  return Math.ceil(((precioBase + 0.25) / (1 - 0.015)) * 100) / 100;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { nombre, email, telefono, edad, clasesSeleccionadas, horasSemanales,
        dni, fechaNacimiento,
        tutor1Nombre, tutor1Telefono, tutor1Email, tutor1Relacion, tutor1Dni,
        tutor2Nombre, tutor2Telefono, tutor2Email, tutor2Relacion, tutor2Dni,
       aceptaReglamento, aceptaRgpd, aceptaImagen, firma } = data;
    if (!nombre || !email || !horasSemanales) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos obligatorios.' }),
      };
    }

    const precioBase   = calcularPrecioBase(Number(horasSemanales));
    const precioTotal  = calcularTotalConStripe(precioBase);
    const gastosGestion = +(precioTotal - precioBase).toFixed(2);

    // Stripe trabaja en céntimos (entero)
    const importeCentimos = Math.round(precioTotal * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Dicharm Dance — Reserva de plaza (Septiembre)',
              description: `${clasesSeleccionadas} · ${horasSemanales}h/semana. Gastos de gestión Stripe: ${gastosGestion.toFixed(2)}€.`,
            },
            unit_amount: importeCentimos,
          },
          quantity: 1,
        },
      ],
     metadata: {
        nombre,
        telefono:          telefono || '',
        edad:              edad || '',
        clases:            clasesSeleccionadas,
        horas_semanales:   String(horasSemanales),
        precio_base:       String(precioBase),
        gastos_gestion:    String(gastosGestion),
        dni:               dni || '',
        fecha_nacimiento:  fechaNacimiento || '',
        tutor1_nombre:     tutor1Nombre || '',
        tutor1_telefono:   tutor1Telefono || '',
        tutor1_email:      tutor1Email || '',
        tutor1_relacion:   tutor1Relacion || '',
        tutor1_dni:        tutor1Dni || '',
        tutor2_nombre:     tutor2Nombre || '',
        tutor2_telefono:   tutor2Telefono || '',
        tutor2_email:      tutor2Email || '',
        tutor2_relacion:   tutor2Relacion || '',
        tutor2_dni:        tutor2Dni || '',
 tutor2_dni:        tutor2Dni || '',
        acepta_reglamento: String(aceptaReglamento || false),
        acepta_rgpd:       String(aceptaRgpd || false),
        acepta_imagen:     String(aceptaImagen || false),
      },

        acepta_reglamento: String(aceptaReglamento || false),
        acepta_rgpd:       String(aceptaRgpd || false),
        acepta_imagen:     String(aceptaImagen || false),
      },
      success_url: `${process.env.SITE_URL}/gracias.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.SITE_URL}/#inscripcion`,
    });

    // SEGURIDAD: solo devolvemos la URL de Stripe al navegador.
    // El IBAN/titular se usan únicamente en stripe-webhook.js para el email,
    // nunca viajan al cliente.
    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Error creando sesión de Stripe:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }),
    };
  }
};
