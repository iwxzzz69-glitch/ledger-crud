const OWNER_KEY = 'ledger:owner';

// Id anónimo por navegador: así cada visitante del demo tiene sus propios datos.
function ownerId() {
  let id = null;
  try { id = localStorage.getItem(OWNER_KEY); } catch {}
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    try { localStorage.setItem(OWNER_KEY, id); } catch {}
  }
  return id;
}

export class ApiError extends Error {}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      headers: { 'x-owner-id': ownerId(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
  }
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new ApiError(data?.error || `El servidor respondió con error ${response.status}.`);
  return data;
}

export const api = {
  listTournaments: () => request('tournaments'),
  createTournament: (body) => request('tournaments', { method: 'POST', body }),
  updateTournament: (id, body) => request(`tournaments?id=${id}`, { method: 'PUT', body }),
  deleteTournament: (id) => request(`tournaments?id=${id}`, { method: 'DELETE' }),

  listBets: () => request('bets'),
  createBet: (body) => request('bets', { method: 'POST', body }),
  updateBet: (id, body) => request(`bets?id=${id}`, { method: 'PUT', body }),
  deleteBet: (id) => request(`bets?id=${id}`, { method: 'DELETE' }),

  seed: (today) => request('seed', { method: 'POST', body: { today } }),
};
