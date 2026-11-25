// netlify/functions/promo-plazas.js
//
// Devuelve las plazas libres de la promo aniversario para mostrarlas en el formulario.
// GET /.netlify/functions/promo-plazas → { cerrada, plazas: { salsa, bachata }, total }

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const promo = require('../lib/promo-aniversario');

exports.handler = async function () {
  try {
    const ocupadas = await promo.contarOcupadas(stripe);
    const libres = promo.plazasLibres(ocupadas);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        cerrada: promo.promoCerrada(),
        cierre: promo.CIERRE.toISOString(),
        plazas: libres,
        total: promo.PLAZAS_POR_GRUPO,
      }),
    };
  } catch (err) {
    console.error('Error contando plazas de la promo:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudieron consultar las plazas.' }),
    };
  }
};
