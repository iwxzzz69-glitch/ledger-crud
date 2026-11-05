import { ApiError, getId, route } from '../lib/http.js';
import { query } from '../lib/db.js';
import { LIMITS, tournamentInput } from '../lib/validate.js';

const COLS = `id, name, game, to_char(event_date, 'YYYY-MM-DD') AS event_date`;

export default route(['GET', 'POST', 'PUT', 'DELETE'], async (req, owner) => {
  switch (req.method) {
    case 'GET': {
      const rows = await query(
        `SELECT ${COLS} FROM tournaments WHERE owner_id = $1::text
         ORDER BY event_date DESC, created_at DESC`,
        [owner]
      );
      return { body: rows };
    }

    case 'POST': {
      const t = tournamentInput(req.body);
      const [{ count }] = await query(
        'SELECT count(*)::int AS count FROM tournaments WHERE owner_id = $1::text',
        [owner]
      );
      if (count >= LIMITS.tournaments) {
        throw new ApiError(409, `Llegaste al máximo de ${LIMITS.tournaments} torneos del demo.`);
      }
      const rows = await query(
        `INSERT INTO tournaments (id, owner_id, name, game, event_date)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2::text, $3::varchar,
                 COALESCE($4::varchar, 'Otro'), $5::date)
         RETURNING ${COLS}`,
        [t.id, owner, t.name, t.game, t.event_date]
      );
      return { status: 201, body: rows[0] };
    }

    case 'PUT': {
      const id = getId(req);
      const t = tournamentInput(req.body, true);
      const rows = await query(
        `UPDATE tournaments
            SET name = COALESCE($3::varchar, name),
                game = COALESCE($4::varchar, game),
                event_date = COALESCE($5::date, event_date),
                updated_at = now()
          WHERE id = $1::uuid AND owner_id = $2::text
          RETURNING ${COLS}`,
        [id, owner, t.name, t.game, t.event_date]
      );
      if (!rows.length) throw new ApiError(404, 'Torneo no encontrado.');
      return { body: rows[0] };
    }

    case 'DELETE': {
      const id = getId(req);
      const rows = await query(
        'DELETE FROM tournaments WHERE id = $1::uuid AND owner_id = $2::text RETURNING id',
        [id, owner]
      );
      if (!rows.length) throw new ApiError(404, 'Torneo no encontrado.');
      return { body: { ok: true } };
    }
  }
});
