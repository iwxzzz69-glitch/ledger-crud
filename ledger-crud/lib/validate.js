import { ApiError, isUuid } from './http.js';

export const GAMES = ['Dota 2', 'CS2', 'Otro'];
export const STATUSES = ['pending', 'won', 'lost', 'void'];

export const LIMITS = { tournaments: 30, bets: 300 };

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} es obligatorio.`);
  }
  const clean = value.trim();
  if (clean.length > max) throw new ApiError(400, `${field} admite hasta ${max} caracteres.`);
  return clean;
}

function date(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${field} debe tener formato AAAA-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${field} no es una fecha válida.`);
  }
  return value;
}

function number(value, field, min, max) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
    throw new ApiError(400, `${field} debe ser un número entre ${min} y ${max}.`);
  }
  return Math.round(n * 100) / 100;
}

function oneOf(value, field, options) {
  if (!options.includes(value)) {
    throw new ApiError(400, `${field} debe ser uno de: ${options.join(', ')}.`);
  }
  return value;
}

function optionalId(value) {
  if (value === undefined || value === null) return null;
  if (!isUuid(value)) throw new ApiError(400, 'id inválido.');
  return value;
}

// partial = true en PUT: solo se validan los campos que llegan; el resto queda en null (no se toca).
function pick(body, partial, fields) {
  const out = {};
  for (const [key, check] of Object.entries(fields)) {
    if (body[key] === undefined) {
      if (!partial && check.required) throw new ApiError(400, `${check.label} es obligatorio.`);
      out[key] = null;
    } else {
      out[key] = check.fn(body[key]);
    }
  }
  return out;
}

export function tournamentInput(body, partial = false) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'El cuerpo de la petición es inválido.');
  return {
    id: optionalId(body.id),
    ...pick(body, partial, {
      name: { required: true, label: 'El nombre', fn: (v) => text(v, 'El nombre', 120) },
      game: { required: false, label: 'El juego', fn: (v) => oneOf(v, 'El juego', GAMES) },
      event_date: { required: true, label: 'La fecha', fn: (v) => date(v, 'La fecha') },
    }),
  };
}

export function betInput(body, partial = false) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'El cuerpo de la petición es inválido.');
  const out = {
    id: optionalId(body.id),
    ...pick(body, partial, {
      tournament_id: {
        required: true,
        label: 'El torneo',
        fn: (v) => {
          if (!isUuid(v)) throw new ApiError(400, 'El torneo es inválido.');
          return v;
        },
      },
      description: { required: false, label: 'La descripción', fn: (v) => text(v, 'La descripción', 200) },
      period: { required: false, label: 'El tiempo', fn: (v) => text(v, 'El tiempo', 30) },
      stake: { required: true, label: 'El monto', fn: (v) => number(v, 'El monto', 0.01, 1000000) },
      odds: { required: true, label: 'La cuota', fn: (v) => number(v, 'La cuota', 1, 1000) },
      status: { required: false, label: 'El estado', fn: (v) => oneOf(v, 'El estado', STATUSES) },
      bet_date: { required: false, label: 'La fecha', fn: (v) => date(v, 'La fecha') },
    }),
  };
  return out;
}
