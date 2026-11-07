import { ApiError, route } from '../lib/http.js';
import { query } from '../lib/db.js';

// Las fechas del ejemplo son relativas a "hoy" (el navegador manda su fecha local,
// así los filtros de "Hoy" o "30 días" siempre muestran datos).
const makeDaysAgo = (today) => (n) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const TOURNAMENTS = [
  { name: 'The International 2026', game: 'Dota 2', ago: 40 },
  { name: 'IEM Cologne 2026', game: 'CS2', ago: 18 },
  { name: 'Roland Garros 2026', game: 'Otro', ago: 5 },
];

// [torneo, descripción, tiempo, stake, cuota, estado, hace N días]
const BETS = [
  [0, 'Team Spirit ML', 'Partido completo', 20, 1.65, 'won', 38],
  [0, 'OG +1.5 mapas', 'Partido completo', 15, 1.4, 'won', 37],
  [0, 'Tundra ML', 'Mapa 1', 20, 2.1, 'lost', 36],
  [0, 'Falcons ML', 'Partido completo', 30, 1.8, 'won', 34],
  [0, 'Gaimin Gladiators ML', 'Mapa 2', 20, 2.3, 'won', 33],
  [0, 'Liquid -1.5', 'Partido completo', 25, 2.45, 'lost', 31],
  [1, 'NAVI ML', 'Partido completo', 25, 1.7, 'won', 17],
  [1, 'FaZe -1.5 mapas', 'Partido completo', 20, 2.2, 'lost', 16],
  [1, 'Vitality ML', 'Mapa 1', 30, 1.55, 'won', 15],
  [1, 'G2 ML', 'Mapa 2', 20, 2.0, 'won', 13],
  [1, 'MOUZ +1.5', 'Partido completo', 15, 1.35, 'won', 12],
  [1, 'Spirit ML', 'En vivo', 25, 1.9, 'lost', 10],
  [2, 'Alcaraz ML', 'Partido completo', 40, 1.45, 'won', 4],
  [2, 'Sinner -1.5 sets', 'Partido completo', 20, 2.6, 'lost', 3],
  [2, 'Djokovic ML', 'En vivo', 30, 1.85, 'pending', 1],
  [1, 'NAVI vs Vitality ML', 'Mapa 1', 20, 2.1, 'pending', 0],
];

export default route(['POST'], async (req, owner) => {
  const requested = req.body?.today;
  const today = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? '') ? requested : new Date().toISOString().slice(0, 10);
  const daysAgo = makeDaysAgo(today);

  const [{ count }] = await query(
    'SELECT count(*)::int AS count FROM tournaments WHERE owner_id = $1::text',
    [owner]
  );
  if (count > 0) throw new ApiError(409, 'Ya tenés datos. Borrá tus torneos para cargar el ejemplo.');

  const tParams = [owner];
  const tValues = TOURNAMENTS.map((t) => {
    tParams.push(t.name, t.game, daysAgo(t.ago));
    const i = tParams.length;
    return `($1::text, $${i - 2}::varchar, $${i - 1}::varchar, $${i}::date)`;
  });
  const created = await query(
    `INSERT INTO tournaments (owner_id, name, game, event_date)
     VALUES ${tValues.join(', ')} RETURNING id, name`,
    tParams
  );
  const idByName = Object.fromEntries(created.map((r) => [r.name, r.id]));

  const bParams = [owner];
  const bValues = BETS.map(([t, desc, period, stake, odds, status, ago]) => {
    bParams.push(idByName[TOURNAMENTS[t].name], desc, period, stake, odds, status, daysAgo(ago));
    const i = bParams.length;
    return `($1::text, $${i - 6}::uuid, $${i - 5}::varchar, $${i - 4}::varchar,
             $${i - 3}::numeric, $${i - 2}::numeric, $${i - 1}::varchar, $${i}::date)`;
  });
  await query(
    `INSERT INTO bets (owner_id, tournament_id, description, period, stake, odds, status, bet_date)
     VALUES ${bValues.join(', ')}`,
    bParams
  );

  return { status: 201, body: { tournaments: TOURNAMENTS.length, bets: BETS.length } };
});
