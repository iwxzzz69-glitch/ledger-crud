import { ApiError, getId, route } from '../lib/http.js';
import { query } from '../lib/db.js';
import { LIMITS, betInput } from '../lib/validate.js';

const COLS = `id, tournament_id, description, period,
  stake::float8 AS stake, odds::float8 AS odds, status,
  to_char(bet_date, 'YYYY-MM-DD') AS bet_date, profit::float8 AS profit`;

export default route(['GET', 'POST', 'PUT', 'DELETE'], async (req, owner) => {
  switch (req.method) {
    case 'GET': {
      const rows = await query(
        `SELECT ${COLS} FROM bets WHERE owner_id = $1::text
         ORDER BY bet_date DESC, created_at DESC`,
        [owner]
      );
      return { body: rows };
    }

    case 'POST': {
      const b = betInput(req.body);
      const [{ count }] = await query(
        'SELECT count(*)::int AS count FROM bets WHERE owner_id = $1::text',
        [owner]
      );
      if (count >= LIMITS.bets) {
        throw new ApiError(409, `Llegaste al máximo de ${LIMITS.bets} apuestas del demo.`);
      }
      // INSERT ... SELECT: solo inserta si el torneo existe y es de este visitante.
      const rows = await query(
        `INSERT INTO bets (id, owner_id, tournament_id, description, period, stake, odds, status, bet_date)
         SELECT COALESCE($1::uuid, gen_random_uuid()), $2::text, t.id,
                COALESCE($4::varchar, 'Sin descripción'), COALESCE($5::varchar, 'Partido completo'),
                $6::numeric, $7::numeric, COALESCE($8::varchar, 'pending'),
                COALESCE($9::date, CURRENT_DATE)
           FROM tournaments t
          WHERE t.id = $3::uuid AND t.owner_id = $2::text
         RETURNING ${COLS}`,
        [b.id, owner, b.tournament_id, b.description, b.period, b.stake, b.odds, b.status, b.bet_date]
      );
      if (!rows.length) throw new ApiError(400, 'El torneo elegido no existe.');
      return { status: 201, body: rows[0] };
    }

    case 'PUT': {
      const id = getId(req);
      const b = betInput(req.body, true);
      const rows = await query(
        `UPDATE bets
            SET tournament_id = COALESCE($3::uuid, tournament_id),
                description = COALESCE($4::varchar, description),
                period = COALESCE($5::varchar, period),
                stake = COALESCE($6::numeric, stake),
                odds = COALESCE($7::numeric, odds),
                status = COALESCE($8::varchar, status),
                bet_date = COALESCE($9::date, bet_date),
                updated_at = now()
          WHERE id = $1::uuid AND owner_id = $2::text
            AND ($3::uuid IS NULL OR EXISTS (
                  SELECT 1 FROM tournaments t WHERE t.id = $3::uuid AND t.owner_id = $2::text))
          RETURNING ${COLS}`,
        [id, owner, b.tournament_id, b.description, b.period, b.stake, b.odds, b.status, b.bet_date]
      );
      if (!rows.length) throw new ApiError(404, 'Apuesta no encontrada.');
      return { body: rows[0] };
    }

    case 'DELETE': {
      const id = getId(req);
      const rows = await query(
        'DELETE FROM bets WHERE id = $1::uuid AND owner_id = $2::text RETURNING id',
        [id, owner]
      );
      if (!rows.length) throw new ApiError(404, 'Apuesta no encontrada.');
      return { body: { ok: true } };
    }
  }
});
