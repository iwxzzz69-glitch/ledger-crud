import { money, parseISO, shortDate, longDate, toISO } from './format.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function niceTicks(min, max, count = 4) {
  if (min === max) max = min + 1;
  const rough = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function tickLabel(v) {
  const abs = Math.abs(v);
  const body = abs >= 10000 ? `${+(abs / 1000).toFixed(1)}K` : abs.toLocaleString('en-US');
  return `${v < 0 ? '−' : ''}$${body}`;
}

/* Serie diaria acumulada de las apuestas ya resueltas (las pendientes no mueven el profit). */
export function dailySeries(bets) {
  const byDay = new Map();
  for (const b of bets) {
    if (b.status === 'pending') continue;
    const d = byDay.get(b.bet_date) ?? { date: b.bet_date, day: 0, count: 0 };
    d.day += b.profit;
    d.count += 1;
    byDay.set(b.bet_date, d);
  }
  let cum = 0;
  return [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      cum += d.day;
      return { ...d, cum: Math.round(cum * 100) / 100 };
    });
}

/* Minilínea para las tarjetas de torneo. */
export function sparkline(bets) {
  const series = dailySeries(bets);
  if (series.length < 2) return '';
  const values = series.map((s) => s.cum);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const w = 220;
  const h = 34;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / range) * (h - 6)).toFixed(1)}`)
    .join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"/></svg>`;
}

export function createEquityChart(container) {
  let series = [];
  let animated = false;
  let loading = false;
  let frame = 0;

  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });
  observer.observe(container);

  function setData(next, { isLoading = false } = {}) {
    series = next;
    loading = isLoading;
    draw();
  }

  function draw() {
    const W = container.clientWidth;
    const H = container.clientHeight;
    container.innerHTML = '';
    container.classList.toggle('is-loading', loading);
    if (!W || !H) return;

    if (!series.length) {
      container.classList.remove('animate');
      const empty = document.createElement('div');
      empty.className = 'chart-empty';
      empty.textContent = loading
        ? 'Cargando tus apuestas…'
        : 'Todavía no hay apuestas resueltas. Marcá una como ganada o perdida y acá aparece tu curva de profit.';
      container.append(empty);
      return;
    }

    const shouldAnimate = !animated;
    animated = true;
    container.classList.toggle('animate', shouldAnimate);

    const m = { t: 16, r: 80, b: 28, l: 8 };
    const plotW = W - m.l - m.r;
    const plotH = H - m.t - m.b;

    // Punto de origen (día anterior, profit 0) para que la curva arranque desde cero.
    const first = parseISO(series[0].date);
    first.setDate(first.getDate() - 1);
    const points = [{ date: toISO(first), cum: 0, origin: true }, ...series];
    const times = points.map((p) => parseISO(p.date).getTime());
    const t0 = times[0];
    const t1 = times[times.length - 1];

    const cums = points.map((p) => p.cum);
    const ticks = niceTicks(Math.min(0, ...cums), Math.max(0, ...cums));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];

    const x = (i) => m.l + ((times[i] - t0) / (t1 - t0 || 1)) * plotW;
    const y = (v) => m.t + ((yMax - v) / (yMax - yMin || 1)) * plotH;

    const last = points[points.length - 1];
    const svg = el('svg', {
      width: W,
      height: H,
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      tabindex: '0',
      'aria-label': `Curva de profit acumulado: de ${money(0)} a ${money(last.cum)} entre el ${longDate(series[0].date)} y el ${longDate(last.date)}. Usá las flechas para recorrer los días. Todos los datos están en la tabla de apuestas.`,
    });

    for (const v of ticks) {
      svg.append(el('line', { class: v === 0 ? 'zero' : 'grid', x1: m.l, x2: m.l + plotW, y1: y(v), y2: y(v) }));
      svg.append(el('text', { class: 'axis', x: m.l, y: y(v) - 5 }, tickLabel(v)));
    }

    const labelCount = Math.max(2, Math.min(5, Math.floor(plotW / 120)));
    for (let k = 0; k < labelCount; k++) {
      const time = t0 + ((t1 - t0) * k) / (labelCount - 1);
      const anchor = k === 0 ? 'start' : k === labelCount - 1 ? 'end' : 'middle';
      const px = k === 0 ? m.l : k === labelCount - 1 ? m.l + plotW : m.l + (plotW * k) / (labelCount - 1);
      svg.append(el('text', { class: 'axis', x: px, y: H - 6, 'text-anchor': anchor }, shortDate(toISO(new Date(time)))));
    }

    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
    svg.append(el('path', { class: 'area', d: area }));
    svg.append(el('path', { class: 'line', d: line, pathLength: 1 }));

    const ex = x(points.length - 1);
    const ey = y(last.cum);
    svg.append(el('circle', { class: 'end-dot', cx: ex, cy: ey, r: 5 }));
    svg.append(el('text', { class: 'end-label', x: ex + 12, y: ey + 4.5 }, money(last.cum, { sign: true })));

    // Capa de interacción: cursor vertical + punto + tooltip.
    const cross = el('line', { class: 'cross', y1: m.t, y2: m.t + plotH });
    const dot = el('circle', { class: 'hover-dot', r: 5 });
    cross.style.display = dot.style.display = 'none';
    svg.append(cross, dot);

    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    const tipDate = document.createElement('span');
    tipDate.className = 'tip-date';
    const tipValue = document.createElement('span');
    tipValue.className = 'tip-value';
    const tipDay = document.createElement('span');
    tipDay.className = 'tip-day';
    tip.append(tipDate, tipValue, tipDay);

    let active = -1;

    function show(pointIndex) {
      active = pointIndex;
      const p = points[pointIndex];
      const px = x(pointIndex);
      cross.setAttribute('x1', px);
      cross.setAttribute('x2', px);
      dot.setAttribute('cx', px);
      dot.setAttribute('cy', y(p.cum));
      cross.style.display = dot.style.display = '';
      tipDate.textContent = longDate(p.date);
      tipValue.textContent = money(p.cum, { sign: true });
      tipDay.textContent = `Ese día: ${money(p.day, { sign: true })} en ${p.count} ${p.count === 1 ? 'apuesta' : 'apuestas'}`;
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = `${px + 14 + tw > W ? Math.max(0, px - tw - 14) : px + 14}px`;
    }

    function hide() {
      active = -1;
      cross.style.display = dot.style.display = 'none';
      tip.hidden = true;
    }

    function nearest(clientX) {
      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      let best = 1;
      for (let i = 1; i < points.length; i++) {
        if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
      }
      return best;
    }

    svg.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('focus', () => show(points.length - 1));
    svg.addEventListener('keydown', (e) => {
      const keys = { ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in keys) {
        e.preventDefault();
        show(Math.min(points.length - 1, Math.max(1, (active < 1 ? points.length - 1 : active) + keys[e.key])));
      } else if (e.key === 'Home') {
        e.preventDefault();
        show(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        show(points.length - 1);
      } else if (e.key === 'Escape') {
        hide();
      }
    });

    container.append(svg, tip);
  }

  return { setData };
}
