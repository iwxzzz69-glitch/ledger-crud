import { api } from './api.js';
import { createEquityChart, dailySeries, sparkline } from './chart.js';
import { esc, longDate, money, pct, smartDate, todayISO, toISO } from './format.js';
import { icons } from './icons.js';

const $ = (selector, root = document) => root.querySelector(selector);

const STATUS = {
  pending: { label: 'Pendiente', icon: 'clock' },
  won: { label: 'Ganada', icon: 'check' },
  lost: { label: 'Perdida', icon: 'x' },
  void: { label: 'Anulada', icon: 'ban' },
};
const GAMES = ['Dota 2', 'CS2', 'Otro'];
const TIMES = ['Partido completo', 'Mapa 1', 'Mapa 2', 'Mapa 3', 'En vivo', 'Otro'];
const STAKES = [10, 20, 50, 100];
const ODDS = [1.5, 1.8, 2, 2.5];
const PERIODS = [
  ['all', 'Todo'],
  ['today', 'Hoy'],
  ['7d', '7 días'],
  ['30d', '30 días'],
  ['month', 'Este mes'],
  ['custom', 'Personalizado'],
];
const UNITS = { days: ['día', 'días'], weeks: ['semana', 'semanas'], months: ['mes', 'meses'] };
const PAGE = 25;

const state = {
  tournaments: [],
  bets: [],
  loading: true,
  period: 'all',
  custom: { amount: 30, unit: 'days' },
  tournamentId: null,
  search: '',
  sort: { key: 'date', dir: 'desc' },
  visible: PAGE,
};

const chart = createEquityChart($('#chart'));

/* ---------------------------------------------------------------- datos */

const round2 = (n) => Math.round(n * 100) / 100;

function computeProfit(bet) {
  if (bet.status === 'won') return round2(bet.stake * (bet.odds - 1));
  if (bet.status === 'lost') return -bet.stake;
  return 0;
}

function stats(list) {
  let profit = 0, stake = 0, wins = 0, losses = 0, pending = 0;
  for (const b of list) {
    profit += b.profit;
    if (b.status === 'won') { wins++; stake += b.stake; }
    else if (b.status === 'lost') { losses++; stake += b.stake; }
    else if (b.status === 'pending') pending++;
  }
  const resolved = wins + losses;
  return {
    count: list.length,
    profit: round2(profit),
    stake,
    pending,
    resolved,
    winRate: resolved ? (wins / resolved) * 100 : 0,
    roi: stake ? (profit / stake) * 100 : 0,
  };
}

function periodStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch (state.period) {
    case 'today': return toISO(d);
    case '7d': d.setDate(d.getDate() - 6); return toISO(d);
    case '30d': d.setDate(d.getDate() - 29); return toISO(d);
    case 'month': return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
    case 'custom': {
      const n = Math.min(999, Math.max(1, Number(state.custom.amount) || 1));
      if (state.custom.unit === 'months') { d.setMonth(d.getMonth() - n); d.setDate(d.getDate() + 1); }
      else d.setDate(d.getDate() - (state.custom.unit === 'weeks' ? n * 7 : n) + 1);
      return toISO(d);
    }
    default: return null;
  }
}

const tournamentById = (id) => state.tournaments.find((t) => t.id === id);

function derive() {
  const start = periodStart();
  const inPeriod = state.bets.filter((b) => !start || b.bet_date >= start);
  const scoped = state.tournamentId ? inPeriod.filter((b) => b.tournament_id === state.tournamentId) : inPeriod;

  const q = state.search.trim().toLowerCase();
  const rows = (q
    ? scoped.filter((b) =>
        [b.description, b.period, tournamentById(b.tournament_id)?.name ?? ''].some((s) => s.toLowerCase().includes(q)))
    : scoped.slice());

  const { key, dir } = state.sort;
  const factor = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) =>
    factor * (key === 'date' ? a.bet_date.localeCompare(b.bet_date) : a[key === 'stake' ? 'stake' : key === 'odds' ? 'odds' : 'profit'] - b[key === 'stake' ? 'stake' : key === 'odds' ? 'odds' : 'profit']));

  return { inPeriod, scoped, rows };
}

/* ---------------------------------------------------------------- render */

function render() {
  if (state.tournamentId && !tournamentById(state.tournamentId)) state.tournamentId = null;
  const d = derive();
  renderPeriod();
  renderHero(d);
  renderTournaments(d);
  renderBets(d);
}

function renderPeriod() {
  $('#period-chips').innerHTML = PERIODS.map(
    ([key, label]) =>
      `<button class="chip" type="button" data-action="set-period" data-period="${key}" aria-pressed="${state.period === key}">${label}</button>`
  ).join('');
  $('#custom-period').hidden = state.period !== 'custom';
}

function whenText() {
  switch (state.period) {
    case 'today': return ' hoy';
    case '7d': return ' en los últimos 7 días';
    case '30d': return ' en los últimos 30 días';
    case 'month': return ' este mes';
    case 'custom': {
      const n = Math.min(999, Math.max(1, Number(state.custom.amount) || 1));
      const [one, many] = UNITS[state.custom.unit];
      const feminine = state.custom.unit === 'weeks';
      if (n === 1) return feminine ? ` en la última ${one}` : ` en el último ${one}`;
      return ` en ${feminine ? 'las últimas' : 'los últimos'} ${n} ${many}`;
    }
    default: return '';
  }
}

function renderHero({ scoped }) {
  const s = stats(scoped);
  const t = tournamentById(state.tournamentId);

  $('#hero-number').textContent = state.loading ? '—' : money(s.profit, { sign: true });

  let sentence = `${s.count} ${s.count === 1 ? 'apuesta' : 'apuestas'}`;
  if (t) sentence += ` de ${t.name}`;
  sentence += whenText();
  if (s.pending) sentence += `, ${s.pending} ${s.pending === 1 ? 'pendiente' : 'pendientes'}`;
  $('#hero-sub').innerHTML =
    `<span>${state.loading ? 'Cargando…' : esc(sentence)}</span>` +
    (t ? `<button class="link-btn" type="button" data-action="clear-tournament">Quitar filtro de torneo</button>` : '');

  const kpi = (label, value) => `<div class="kpi"><dt>${label}</dt><dd>${value}</dd></div>`;
  $('#kpis').innerHTML =
    kpi('Apuestas', s.count) +
    kpi('Monto apostado', money(s.stake)) +
    kpi('Efectividad', s.resolved ? pct(s.winRate) : '—') +
    kpi('Retorno (ROI)', s.stake ? `${s.roi > 0 ? '+' : s.roi < 0 ? '−' : ''}${pct(Math.abs(s.roi))}` : '—');

  chart.setData(dailySeries(scoped), { isLoading: state.loading });
}

function renderTournaments({ inPeriod }) {
  const host = $('#tournaments');
  if (state.loading) { host.innerHTML = ''; return; }

  if (!state.tournaments.length) {
    host.innerHTML = `
      <div class="empty">
        <h3>Empezá con tu primer torneo</h3>
        <p>Un torneo agrupa tus apuestas y te muestra cuánto ganás o perdés en cada uno. Probá la app con datos de ejemplo o creá el tuyo.</p>
        <div class="actions">
          <button class="btn btn-primary" type="button" data-action="seed">Cargar datos de ejemplo</button>
          <button class="btn btn-ghost" type="button" data-action="new-tournament">Crear mi primer torneo</button>
        </div>
      </div>`;
    return;
  }

  host.innerHTML = state.tournaments.map((t) => {
    const list = inPeriod.filter((b) => b.tournament_id === t.id);
    const s = stats(list);
    const selected = state.tournamentId === t.id;
    const tone = s.profit > 0 ? 'is-gain' : s.profit < 0 ? 'is-loss' : 'muted';
    const tag = t.game === 'Dota 2' ? 'dota' : t.game === 'CS2' ? 'cs2' : '';
    return `
      <article class="t-card" data-id="${t.id}" data-selected="${selected}">
        <div class="t-top">
          <span class="tag ${tag}">${esc(t.game)}</span>
          <div class="t-actions">
            <button class="icon-btn sm" type="button" data-action="edit-tournament" data-id="${t.id}" aria-label="Editar torneo ${esc(t.name)}">${icons.pencil}</button>
            <button class="icon-btn sm danger" type="button" data-action="delete-tournament" data-id="${t.id}" aria-label="Eliminar torneo ${esc(t.name)}">${icons.trash}</button>
          </div>
        </div>
        <button class="t-name" type="button" data-action="toggle-tournament" data-id="${t.id}" aria-pressed="${selected}">${esc(t.name)}</button>
        <span class="t-date">${longDate(t.event_date)}</span>
        <span class="t-profit ${tone}">${money(s.profit, { sign: true })}</span>
        ${sparkline(list)}
        <span class="t-meta">${s.count} ${s.count === 1 ? 'apuesta' : 'apuestas'}</span>
      </article>`;
  }).join('');
}

function renderBets({ rows }) {
  const host = $('#bets');

  if (state.loading) { host.innerHTML = '<div class="empty">Cargando apuestas…</div>'; return; }

  if (!state.tournaments.length) {
    host.innerHTML = '<div class="empty"><p>Las apuestas que registres van a aparecer acá.</p></div>';
    return;
  }
  if (!state.bets.length) {
    host.innerHTML = `
      <div class="empty">
        <h3>Todavía no registraste apuestas</h3>
        <p>Anotá la primera: elegís el torneo, el monto y la cuota, y el profit se calcula solo.</p>
        <div class="actions"><button class="btn btn-primary" type="button" data-action="new-bet">${icons.plus}Nueva apuesta</button></div>
      </div>`;
    return;
  }
  if (!rows.length) {
    host.innerHTML = `
      <div class="empty">
        <h3>No hay apuestas con estos filtros</h3>
        <p>Probá con otro período, otro torneo o una búsqueda distinta.</p>
        <div class="actions"><button class="btn btn-ghost" type="button" data-action="clear-filters">Quitar filtros</button></div>
      </div>`;
    return;
  }

  const th = (key, label, cls = '') => {
    const active = state.sort.key === key;
    const aria = active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = active ? icons[state.sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'] : '';
    return `<th class="${cls}" aria-sort="${aria}"><button type="button" data-action="sort" data-key="${key}">${label}${arrow}</button></th>`;
  };

  const shown = rows.slice(0, state.visible);
  const body = shown.map((b) => {
    const t = tournamentById(b.tournament_id);
    const profit =
      b.status === 'pending' ? '<span class="muted">—</span>'
      : b.status === 'void' ? `<span class="muted">${money(0)}</span>`
      : `<span class="${b.profit > 0 ? 'is-gain' : 'is-loss'}">${money(b.profit, { sign: true })}</span>`;
    const buttons = Object.entries(STATUS).map(([key, meta]) =>
      `<button class="sbtn ${key}" type="button" data-action="set-status" data-id="${b.id}" data-status="${key}" aria-pressed="${b.status === key}" aria-label="Marcar como ${meta.label.toLowerCase()}" title="${meta.label}">${icons[meta.icon]}</button>`
    ).join('');
    return `
      <tr>
        <td class="c-date">${smartDate(b.bet_date)}</td>
        <td class="c-desc"><span class="desc">${esc(b.description)}</span><span class="sub">${esc(b.period)} en ${esc(t?.name ?? 'torneo eliminado')}</span></td>
        <td class="num c-stake" data-label="Monto">${money(b.stake)}</td>
        <td class="num c-odds" data-label="Cuota">${b.odds.toFixed(2)}</td>
        <td class="c-status"><div class="status" role="group" aria-label="Estado de la apuesta">${buttons}</div></td>
        <td class="num c-profit">${profit}</td>
        <td class="c-actions">
          <button class="icon-btn sm" type="button" data-action="edit-bet" data-id="${b.id}" aria-label="Editar apuesta ${esc(b.description)}">${icons.pencil}</button>
          <button class="icon-btn sm danger" type="button" data-action="delete-bet" data-id="${b.id}" aria-label="Eliminar apuesta ${esc(b.description)}">${icons.trash}</button>
        </td>
      </tr>`;
  }).join('');

  const rest = rows.length - shown.length;
  host.innerHTML = `
    <table>
      <thead><tr>
        ${th('date', 'Fecha')}
        <th>Apuesta</th>
        ${th('stake', 'Monto', 'num')}
        ${th('odds', 'Cuota', 'num')}
        <th>Estado</th>
        ${th('profit', 'Profit', 'num')}
        <th><span class="sr-only">Acciones</span></th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${rest > 0 ? `<div class="more"><button class="btn btn-ghost" type="button" data-action="show-more">Mostrar ${Math.min(rest, PAGE)} más (${rest} sin mostrar)</button></div>` : ''}`;
}

/* ---------------------------------------------------------------- avisos */

function toast(message, { error = false, action, onAction, duration = 6500 } = {}) {
  const host = $('#toasts');
  while (host.children.length >= 3) host.firstElementChild.remove();
  const node = document.createElement('div');
  node.className = `toast${error ? ' is-error' : ''}`;
  const text = document.createElement('span');
  text.textContent = message;
  node.append(text);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action;
    button.addEventListener('click', () => { node.remove(); onAction(); });
    node.append(button);
  }
  host.append(node);
  setTimeout(() => node.remove(), duration);
}

function showBanner(message) {
  const banner = $('#banner');
  banner.hidden = false;
  banner.innerHTML = `<span>${esc(message)}</span><button class="btn btn-ghost" type="button" data-action="retry">Reintentar</button>`;
}

/* ---------------------------------------------------------------- acciones (CRUD) */

async function loadAll() {
  state.loading = true;
  $('#banner').hidden = true;
  render();
  try {
    const [tournaments, bets] = await Promise.all([api.listTournaments(), api.listBets()]);
    state.tournaments = tournaments;
    state.bets = bets;
  } catch (err) {
    showBanner(err.message);
  } finally {
    state.loading = false;
    render();
  }
}

const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.unshift(item);
};
const sortTournaments = () => state.tournaments.sort((a, b) => b.event_date.localeCompare(a.event_date));

async function setStatus(id, status) {
  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status === status) return;
  const previous = { status: bet.status, profit: bet.profit };
  bet.status = status; // optimista: se ve al instante y se revierte si falla
  bet.profit = computeProfit(bet);
  render();
  try {
    Object.assign(bet, await api.updateBet(id, { status }));
  } catch (err) {
    Object.assign(bet, previous);
    toast(err.message, { error: true });
  }
  render();
}

async function deleteBet(id) {
  const bet = state.bets.find((b) => b.id === id);
  if (!bet) return;
  try {
    await api.deleteBet(id);
  } catch (err) {
    toast(err.message, { error: true });
    return;
  }
  state.bets = state.bets.filter((b) => b.id !== id);
  render();
  toast('Apuesta eliminada', {
    action: 'Deshacer',
    onAction: async () => {
      try {
        const { profit, ...fields } = bet;
        state.bets.push(await api.createBet(fields));
        render();
      } catch (err) {
        toast(err.message, { error: true });
      }
    },
  });
}

async function deleteTournament(id) {
  const tournament = tournamentById(id);
  if (!tournament) return;
  const removedBets = state.bets.filter((b) => b.tournament_id === id);
  try {
    await api.deleteTournament(id);
  } catch (err) {
    toast(err.message, { error: true });
    return;
  }
  state.tournaments = state.tournaments.filter((t) => t.id !== id);
  state.bets = state.bets.filter((b) => b.tournament_id !== id);
  render();
  const n = removedBets.length;
  toast(`Torneo eliminado${n ? ` con ${n} ${n === 1 ? 'apuesta' : 'apuestas'}` : ''}`, {
    action: 'Deshacer',
    onAction: async () => {
      try {
        await api.createTournament({ id: tournament.id, name: tournament.name, game: tournament.game, event_date: tournament.event_date });
        for (const { profit, ...fields } of removedBets) await api.createBet(fields);
        await loadAll();
      } catch (err) {
        toast(err.message, { error: true });
        await loadAll();
      }
    },
  });
}

async function seedDemo(button) {
  button.disabled = true;
  try {
    await api.seed(todayISO());
    await loadAll();
    toast('Cargué datos de ejemplo para que explores la app.');
  } catch (err) {
    toast(err.message, { error: true });
    button.disabled = false;
  }
}

/* ---------------------------------------------------------------- diálogos */

function closeButtons(dialog) {
  dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
}

function openTournamentDialog(tournament = null) {
  const dialog = $('#tournament-dialog');
  const editing = Boolean(tournament);
  const game = tournament?.game ?? 'Otro';
  dialog.innerHTML = `
    <form novalidate>
      <div class="sheet-head">
        <h3 id="t-dialog-title">${editing ? 'Editar torneo' : 'Nuevo torneo'}</h3>
        <button class="icon-btn sm" type="button" data-close aria-label="Cerrar">${icons.x}</button>
      </div>
      <div class="field">
        <label for="t-name">Nombre</label>
        <input id="t-name" name="name" maxlength="120" required autocomplete="off" placeholder="Ej. The International 2026" value="${esc(tournament?.name ?? '')}">
      </div>
      <div class="field-row">
        <fieldset class="field">
          <legend>Juego</legend>
          <div class="choices">${GAMES.map((g) => `<label class="choice"><input type="radio" name="game" value="${g}" ${g === game ? 'checked' : ''}><span>${g}</span></label>`).join('')}</div>
        </fieldset>
        <div class="field">
          <label for="t-date">Fecha del torneo</label>
          <input id="t-date" name="event_date" type="date" required value="${tournament?.event_date ?? todayISO()}">
        </div>
      </div>
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn-primary" type="submit">${editing ? 'Guardar cambios' : 'Crear torneo'}</button>
      </div>
    </form>`;
  closeButtons(dialog);

  const form = $('form', dialog);
  const error = $('.form-error', form);
  const submit = $('[type=submit]', form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const body = { name: String(data.get('name')).trim(), game: data.get('game'), event_date: data.get('event_date') };
    if (!body.name) { error.textContent = 'Escribí el nombre del torneo.'; form.elements.name.focus(); return; }
    if (!body.event_date) { error.textContent = 'Elegí la fecha del torneo.'; form.elements.event_date.focus(); return; }
    submit.disabled = true;
    error.textContent = '';
    try {
      const saved = editing ? await api.updateTournament(tournament.id, body) : await api.createTournament(body);
      upsert(state.tournaments, saved);
      sortTournaments();
      dialog.close();
      render();
      toast(editing ? 'Torneo actualizado' : 'Torneo creado');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });

  dialog.showModal();
  form.elements.name.focus();
}

function openBetDialog(bet = null) {
  if (!state.tournaments.length) {
    toast('Creá un torneo primero para poder registrar apuestas.');
    openTournamentDialog();
    return;
  }
  const dialog = $('#bet-dialog');
  const editing = Boolean(bet);
  const tournamentId = bet?.tournament_id ?? state.tournamentId ?? state.tournaments[0].id;
  const period = bet?.period ?? 'Partido completo';
  const times = TIMES.includes(period) ? TIMES : [...TIMES, period];
  const status = bet?.status ?? 'pending';

  const radios = (name, items, selected) =>
    items.map(([value, label]) => `<label class="choice"><input type="radio" name="${name}" value="${esc(value)}" ${value === selected ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('');

  const quick = (field, values, format) =>
    values.map((v) => `<button class="qfill" type="button" data-fill="${field}" data-value="${v}" aria-pressed="false">${format(v)}</button>`).join('');

  dialog.innerHTML = `
    <form novalidate>
      <div class="sheet-head">
        <h3 id="bet-dialog-title">${editing ? 'Editar apuesta' : 'Nueva apuesta'}</h3>
        <button class="icon-btn sm" type="button" data-close aria-label="Cerrar">${icons.x}</button>
      </div>
      <fieldset class="field">
        <legend>Torneo</legend>
        <div class="choices">${radios('tournament_id', state.tournaments.map((t) => [t.id, t.name]), tournamentId)}</div>
      </fieldset>
      <div class="field">
        <label for="b-desc">Descripción</label>
        <input id="b-desc" name="description" maxlength="200" autocomplete="off" placeholder="Ej. Team Spirit ML" value="${esc(bet?.description ?? '')}">
      </div>
      <fieldset class="field">
        <legend>Tiempo</legend>
        <div class="choices">${radios('period', times.map((t) => [t, t]), period)}</div>
      </fieldset>
      <div class="field-row">
        <div class="field input-with-chips">
          <label for="b-stake">Monto</label>
          <input id="b-stake" name="stake" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0.00" required value="${bet?.stake ?? ''}">
          <div class="choices">${quick('stake', STAKES, (v) => `$${v}`)}</div>
        </div>
        <div class="field input-with-chips">
          <label for="b-odds">Cuota</label>
          <input id="b-odds" name="odds" type="number" inputmode="decimal" step="0.01" min="1" placeholder="1.00" required value="${bet?.odds ?? ''}">
          <div class="choices">${quick('odds', ODDS, (v) => v.toFixed(2))}</div>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="b-date">Fecha</label>
          <input id="b-date" name="bet_date" type="date" required value="${bet?.bet_date ?? todayISO()}">
        </div>
        <fieldset class="field">
          <legend>Estado</legend>
          <div class="choices">${radios('status', Object.entries(STATUS).map(([k, v]) => [k, v.label]), status)}</div>
        </fieldset>
      </div>
      <div class="preview" aria-live="polite">
        <span>Si gana: <strong data-win>—</strong></span>
        <span>Si pierde: <strong data-lose>—</strong></span>
      </div>
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn btn-ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn-primary" type="submit">${editing ? 'Guardar cambios' : 'Guardar apuesta'}</button>
      </div>
    </form>`;
  closeButtons(dialog);

  const form = $('form', dialog);
  const error = $('.form-error', form);
  const submit = $('[type=submit]', form);

  const sync = () => {
    form.querySelectorAll('.qfill').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(form.elements[b.dataset.fill].value) === Number(b.dataset.value)));
    });
    const stake = Number(form.elements.stake.value);
    const odds = Number(form.elements.odds.value);
    $('[data-win]', form).textContent = stake > 0 && odds >= 1 ? money(stake * (odds - 1), { sign: true }) : '—';
    $('[data-lose]', form).textContent = stake > 0 ? money(-stake) : '—';
  };
  form.addEventListener('input', sync);
  form.querySelectorAll('.qfill').forEach((b) =>
    b.addEventListener('click', () => { form.elements[b.dataset.fill].value = b.dataset.value; sync(); })
  );
  sync();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const body = {
      tournament_id: data.get('tournament_id'),
      description: String(data.get('description')).trim() || 'Sin descripción',
      period: data.get('period'),
      stake: Number(data.get('stake')),
      odds: Number(data.get('odds')),
      status: data.get('status'),
      bet_date: data.get('bet_date'),
    };
    if (!(body.stake > 0)) { error.textContent = 'Ingresá un monto mayor a cero.'; form.elements.stake.focus(); return; }
    if (!(body.odds >= 1)) { error.textContent = 'La cuota debe ser 1.00 o mayor.'; form.elements.odds.focus(); return; }
    if (!body.bet_date) { error.textContent = 'Elegí la fecha de la apuesta.'; form.elements.bet_date.focus(); return; }
    submit.disabled = true;
    error.textContent = '';
    try {
      const saved = editing ? await api.updateBet(bet.id, body) : await api.createBet(body);
      upsert(state.bets, saved);
      dialog.close();
      render();
      toast(editing ? 'Apuesta actualizada' : 'Apuesta guardada');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });

  dialog.showModal();
  form.elements[editing ? 'description' : 'stake'].focus();
}

/* ---------------------------------------------------------------- exportar */

function exportCsv() {
  const { rows } = derive();
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Fecha', 'Torneo', 'Descripción', 'Tiempo', 'Monto', 'Cuota', 'Estado', 'Profit'];
  const lines = rows.map((b) => [
    b.bet_date, tournamentById(b.tournament_id)?.name, b.description, b.period,
    b.stake.toFixed(2), b.odds.toFixed(2), STATUS[b.status].label, b.profit.toFixed(2),
  ]);
  const csv = [header, ...lines].map((r) => r.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `apuestas-${todayISO()}.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------- tema */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('ledger:theme', theme); } catch {}
  $('#theme-btn').innerHTML = theme === 'dark' ? icons.sun : icons.moon;
}

/* ---------------------------------------------------------------- eventos */

function toggleTournament(id) {
  state.tournamentId = state.tournamentId === id ? null : id;
  state.visible = PAGE;
  render();
}

const actions = {
  'toggle-theme': () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
  'set-period': (el) => { state.period = el.dataset.period; state.visible = PAGE; render(); },
  'toggle-tournament': (el) => toggleTournament(el.dataset.id),
  'clear-tournament': () => { state.tournamentId = null; render(); },
  'clear-filters': () => {
    Object.assign(state, { period: 'all', tournamentId: null, search: '', visible: PAGE });
    $('#search').value = '';
    render();
  },
  'new-tournament': () => openTournamentDialog(),
  'edit-tournament': (el) => openTournamentDialog(tournamentById(el.dataset.id)),
  'delete-tournament': (el) => deleteTournament(el.dataset.id),
  'new-bet': () => openBetDialog(),
  'edit-bet': (el) => openBetDialog(state.bets.find((b) => b.id === el.dataset.id)),
  'delete-bet': (el) => deleteBet(el.dataset.id),
  'set-status': (el) => setStatus(el.dataset.id, el.dataset.status),
  sort: (el) => {
    const key = el.dataset.key;
    state.sort = state.sort.key === key
      ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'date' || key === 'profit' ? 'desc' : 'asc' };
    state.visible = PAGE;
    renderBets(derive());
  },
  'show-more': () => { state.visible += PAGE; renderBets(derive()); },
  export: () => exportCsv(),
  seed: (el) => seedDemo(el),
  retry: () => loadAll(),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) { actions[el.dataset.action]?.(el); return; }
  const card = e.target.closest('.t-card');
  if (card && !e.target.closest('button')) toggleTournament(card.dataset.id);
});

$('#search').addEventListener('input', (e) => {
  state.search = e.target.value;
  state.visible = PAGE;
  renderBets(derive());
});

$('#custom-amount').addEventListener('input', (e) => {
  state.custom.amount = e.target.value;
  state.visible = PAGE;
  render();
});
$('#custom-unit').addEventListener('change', (e) => {
  state.custom.unit = e.target.value;
  state.visible = PAGE;
  render();
});

for (const dialog of document.querySelectorAll('dialog.sheet')) {
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}

/* ---------------------------------------------------------------- inicio */

$('#new-bet-btn').innerHTML = `${icons.plus}<span class="btn-label">Nueva apuesta</span>`;
$('#new-t-btn').innerHTML = `${icons.plus}Nuevo torneo`;
$('#export-btn').innerHTML = `${icons.download}Exportar CSV`;
$('#search-icon').innerHTML = icons.search;
applyTheme(document.documentElement.dataset.theme || 'dark');
loadAll();
