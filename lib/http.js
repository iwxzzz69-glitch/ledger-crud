export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const OWNER_RE = /^[A-Za-z0-9_-]{16,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cada visitante tiene su propio id anónimo (generado en su navegador).
// Así el demo público es editable sin que unas personas pisen los datos de otras.
export function getOwner(req) {
  const owner = req.headers['x-owner-id'];
  if (typeof owner !== 'string' || !OWNER_RE.test(owner)) {
    throw new ApiError(400, 'Falta el identificador de visitante (cabecera x-owner-id).');
  }
  return owner;
}

export function getId(req) {
  const id = req.query?.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new ApiError(400, 'El parámetro id es inválido.');
  }
  return id;
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

// Envuelve un handler: método permitido, errores uniformes y sin caché.
export function route(methods, handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new ApiError(405, 'Método no permitido.');
      }
      const owner = getOwner(req);
      const result = await handler(req, owner);
      res.status(result.status ?? 200).json(result.body);
    } catch (err) {
      if (err instanceof ApiError) {
        res.status(err.status).json({ error: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor.' });
      }
    }
  };
}
