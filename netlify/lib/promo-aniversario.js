// netlify/lib/promo-aniversario.js
//
// Configuración y utilidades compartidas de la PROMO ANIVERSARIO (diciembre 2026):
// grupos nuevos de iniciación de 21:30 a 22:30.
//   · Bachata → lunes   (30/11, 14/12, 21/12 — el 7/12 es festivo)
//   · Salsa   → jueves  (3/12, 10/12, 17/12)
// Precios (solo diciembre): 19 € un curso · 29 € los dos,
// más los gastos de gestión de Stripe, que paga el alumno (misma fórmula que create-checkout.js).
// 14 plazas por grupo. El combo ocupa plaza en los dos grupos.
//
// Las plazas se cuentan directamente en Stripe (sesiones de pago de esta promo),
// así no hace falta ninguna base de datos extra.

const PROMO_ID = 'aniversario-2026';
const PLAZAS_POR_GRUPO = 14;

// Cierre de inscripciones: domingo 29/11/2026 a las 23:59 (hora de Madrid)
const CIERRE = new Date('2026-11-29T23:59:59+01:00');

// Desde cuándo buscar pagos en Stripe (antes de lanzar la promo)
const INICIO_BUSQUEDA = Math.floor(new Date('2026-11-20T00:00:00+01:00').getTime() / 1000);

// Una sesión de pago abierta "reserva" la plaza durante 30 minutos
const MINUTOS_RESERVA = 30;

const GRUPOS = {
  bachata: {
    nombre: 'Bachata iniciación',
    dia: 'Lunes',
    hora: '21:30 a 22:30',
    fechas: ['Lunes 30 de noviembre', 'Lunes 14 de diciembre', 'Lunes 21 de diciembre'],
  },
  salsa: {
    nombre: 'Salsa iniciación',
    dia: 'Jueves',
    hora: '21:30 a 22:30',
    fechas: ['Jueves 3 de diciembre', 'Jueves 10 de diciembre', 'Jueves 17 de diciembre'],
  },
};

const OPCIONES = {
  bachata: { nombre: 'Bachata (lunes 21:30)',            grupos: ['bachata'],          precio: 19 },
  salsa:   { nombre: 'Salsa (jueves 21:30)',             grupos: ['salsa'],            precio: 19 },
  combo:   { nombre: 'Bachata + Salsa (lunes y jueves)', grupos: ['bachata', 'salsa'], precio: 29 },
};

// Igual que en create-checkout.js: el alumno paga lo justo para que, después de la
// comisión de Stripe (1,5 % + 0,25 €), la escuela reciba exactamente el precio base.
function calcularTotalConStripe(precioBase) {
  if (precioBase <= 0) return 0;
  return Math.ceil(((precioBase + 0.25) / (1 - 0.015)) * 100) / 100;
}

// Promo de diciembre ANULADA el 26/11/2026: no se aceptan más inscripciones.
const PROMO_ANULADA = true;

function promoCerrada(ahora = new Date()) {
  return PROMO_ANULADA || ahora.getTime() > CIERRE.getTime();
}

// Cuenta las plazas ocupadas por grupo a partir de las sesiones de Stripe:
//   · pagadas (status "complete")
//   · abiertas y recientes (alguien está pagando en este momento)
async function contarOcupadas(stripe) {
  const ocupadas = { salsa: 0, bachata: 0 };
  const ahora = Math.floor(Date.now() / 1000);

  const sumar = (session) => {
    const meta = session.metadata || {};
    if (meta.promo !== PROMO_ID) return;
    const opcion = OPCIONES[meta.opcion];
    if (!opcion) return;

    const pagada = session.status === 'complete' && session.payment_status === 'paid';
    const reservando = session.status === 'open' && (ahora - session.created) < MINUTOS_RESERVA * 60;
    if (!pagada && !reservando) return;

    opcion.grupos.forEach((g) => { ocupadas[g] += 1; });
  };

  for (const status of ['complete', 'open']) {
    await stripe.checkout.sessions
      .list({ created: { gte: INICIO_BUSQUEDA }, status, limit: 100 })
      .autoPagingEach((session) => { sumar(session); });
  }

  return ocupadas;
}

function plazasLibres(ocupadas) {
  return {
    salsa: Math.max(0, PLAZAS_POR_GRUPO - ocupadas.salsa),
    bachata: Math.max(0, PLAZAS_POR_GRUPO - ocupadas.bachata),
  };
}

function hayPlazaPara(opcionId, libres) {
  const opcion = OPCIONES[opcionId];
  return !!opcion && opcion.grupos.every((g) => libres[g] > 0);
}

function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  PROMO_ID,
  PLAZAS_POR_GRUPO,
  CIERRE,
  MINUTOS_RESERVA,
  GRUPOS,
  OPCIONES,
  promoCerrada,
  contarOcupadas,
  plazasLibres,
  hayPlazaPara,
  calcularTotalConStripe,
  escapeHtml,
};
