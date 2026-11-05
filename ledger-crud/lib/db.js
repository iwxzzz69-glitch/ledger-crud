import { SCHEMA } from './schema.js';
import { ApiError } from './http.js';

let connection;
let schemaReady;

async function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (url) {
    // Producción: Neon Postgres por HTTP (ideal para funciones serverless).
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    return {
      async query(text, params = []) {
        const result = await sql.query(text, params);
        return Array.isArray(result) ? result : result.rows;
      },
    };
  }

  if (process.env.VERCEL) {
    throw new ApiError(
      500,
      'Falta la variable DATABASE_URL. Conectá una base Postgres desde Storage en Vercel y volvé a desplegar.'
    );
  }

  // Desarrollo local sin configurar nada: Postgres embebido (PGlite).
  // El nombre del módulo se arma en runtime para que Vercel no lo empaquete en la función.
  const moduleName = ['@electric-sql', 'pglite'].join('/');
  const { PGlite } = await import(moduleName);
  const pg = new PGlite(process.env.PGLITE_DIR || undefined);
  return {
    async query(text, params = []) {
      const result = await pg.query(text, params);
      return result.rows;
    },
  };
}

export async function query(text, params = []) {
  connection ??= connect().catch((err) => {
    connection = undefined;
    throw err;
  });
  const db = await connection;

  schemaReady ??= (async () => {
    for (const statement of SCHEMA) await db.query(statement, []);
  })().catch((err) => {
    schemaReady = undefined;
    throw err;
  });
  await schemaReady;

  return db.query(text, params);
}
