// Esquema Postgres. La API lo aplica sola la primera vez (CREATE ... IF NOT EXISTS),
// así que no hay que correr SQL a mano. `npm run schema` lo exporta a db/schema.sql.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tournaments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    TEXT        NOT NULL,
  name        VARCHAR(120) NOT NULL,
  game        VARCHAR(20)  NOT NULL DEFAULT 'Otro'
              CHECK (game IN ('Dota 2', 'CS2', 'Otro')),
  event_date  DATE        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS idx_tournaments_owner ON tournaments (owner_id)`,
  `CREATE TABLE IF NOT EXISTS bets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      TEXT        NOT NULL,
  tournament_id UUID        NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  description   VARCHAR(200) NOT NULL DEFAULT 'Sin descripción',
  period        VARCHAR(30)  NOT NULL DEFAULT 'Partido completo',
  stake         NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  odds          NUMERIC(8,2)  NOT NULL CHECK (odds >= 1),
  status        VARCHAR(10)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'won', 'lost', 'void')),
  bet_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Profit calculado por la base: ganada = stake*(cuota-1), perdida = -stake, resto = 0
  profit        NUMERIC(14,2) GENERATED ALWAYS AS (
                  CASE status
                    WHEN 'won'  THEN stake * (odds - 1)
                    WHEN 'lost' THEN -stake
                    ELSE 0
                  END
                ) STORED
)`,
  `CREATE INDEX IF NOT EXISTS idx_bets_owner_date ON bets (owner_id, bet_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_bets_tournament ON bets (tournament_id)`,
];
