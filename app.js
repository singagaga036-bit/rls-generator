// app.js — логика генератора: анимация радара и карточка станции
const stations = window.STATIONS || [];

let lastIndex = -1;
let shownCount = 0;
const el = id => document.getElementById(id);

function pad2(n) { return String(n).padStart(2, '0'); }

// ===== Цели на индикаторе =====
const NS = 'http://www.w3.org/2000/svg';
const svg = el('radar');
const targets = [];
let nextTrack = 0;
const DEAD_R = 5.3; // радиус мёртвой воронки (на 1/3 меньше прежнего)

function bearingOf(t) {
  return (Math.atan2(t.x - 50, 50 - t.y) * 180 / Math.PI + 360) % 360;
}

function draw(t) {
  t.dot.setAttribute('cx', t.x.toFixed(2));
  t.dot.setAttribute('cy', t.y.toFixed(2));
  const r = t.heading * Math.PI / 180;
  t.ray.setAttribute('x1', t.x.toFixed(2));
  t.ray.setAttribute('y1', t.y.toFixed(2));
  t.ray.setAttribute('x2', (t.x + Math.cos(r) * 5).toFixed(2));
  t.ray.setAttribute('y2', (t.y + Math.sin(r) * 5).toFixed(2));
  t.label.setAttribute('x', (t.x + 1.8).toFixed(2));
  t.label.setAttribute('y', (t.y - 1.5).toFixed(2));
  let pts = '';
  for (let i = 0; i < t.trail.length; i++) {
    pts += t.trail[i][0].toFixed(2) + ',' + t.trail[i][1].toFixed(2) + ' ';
  }
  pts += t.x.toFixed(2) + ',' + t.y.toFixed(2);
  t.poly.setAttribute('points', pts);
}

function addTarget() {
  nextTrack++;
  const num = pad2(((nextTrack - 1) % 50) + 1);
  // цель появляется в любой точке радара, но вне мёртвой воронки
  const ang = Math.random() * Math.PI * 2;
  const rad = DEAD_R + 2 + Math.random() * 37;
  const t = {
    x: 50 + rad * Math.cos(ang),
    y: 50 + rad * Math.sin(ang),
    heading: Math.random() * 360,
    speed: 1.6 + Math.random() * 1.4,
    trail: [],
    num: num,
    bearing: 0,
    coolUntil: 0,
    pending: true // белая, пока луч её не пройдёт
  };
  t.bearing = bearingOf(t);

  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'pending');
  const poly = document.createElementNS(NS, 'polyline');
  poly.setAttribute('class', 'trail');
  const ray = document.createElementNS(NS, 'line');
  ray.setAttribute('class', 'course');
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('class', 'dot');
  dot.setAttribute('r', '0.75');
  const label = document.createElementNS(NS, 'text');
  label.setAttribute('class', 'tnum');
  label.textContent = num;
  g.appendChild(poly);
  g.appendChild(ray);
  g.appendChild(dot);
  g.appendChild(label);
  svg.appendChild(g);

  t.g = g;
  t.poly = poly;
  t.ray = ray;
  t.dot = dot;
  t.label = label;
  targets.push(t);
  draw(t);

  while (targets.length > 12) {
    const old = targets.shift();
    old.g.parentNode.removeChild(old.g);
  }
  return num;
}

function step(t) {
  t.trail.push([t.x, t.y]);
  t.heading += (Math.random() - 0.5) * 26;
  const r = t.heading * Math.PI / 180;
  t.x += Math.cos(r) * t.speed;
  t.y += Math.sin(r) * t.speed;
  const dx = t.x - 50;
  const dy = t.y - 50;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 44) {
    t.heading = Math.atan2(-dy, -dx) * 180 / Math.PI + (Math.random() - 0.5) * 40;
  } else if (d < DEAD_R + 2) {
    // не залетать в мёртвую воронку
    t.heading = Math.atan2(dy, dx) * 180 / Math.PI + (Math.random() - 0.5) * 40;
  }
  t.bearing = bearingOf(t);
  draw(t);
}

// ===== Развёртка: белая палка-луч из центра, оборот за 10 секунд (6 об/мин) =====
const beamEl = document.querySelector('.beam');
const PERIOD = 10000;
const COOLDOWN = 8000;
let lastAngle = 0;
const t0 = performance.now();

function frame(now) {
  const angle = (((now - t0) % PERIOD) / PERIOD) * 360;
  beamEl.style.transform = 'rotate(' + angle.toFixed(2) + 'deg)';
  const delta = (angle - lastAngle + 360) % 360;
  if (delta > 0 && delta < 90) {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (now < t.coolUntil) continue;
      const relPrev = (lastAngle - t.bearing + 360) % 360;
      if (relPrev <= delta) {
        if (t.pending) {
          t.pending = false;
          t.g.classList.remove('pending'); // луч прошёл — цель стала жёлтой
        }
        step(t);
        t.coolUntil = now + COOLDOWN;
      }
    }
  }
  lastAngle = angle;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ===== Табличка тактико-технических характеристик =====
function renderTtx(s) {
  const ttx = el('ttx');
  ttx.innerHTML = '';
  const rows = s.ttx || [];
  if (rows.length === 0) {
    ttx.hidden = true;
    return;
  }
  ttx.hidden = false;
  for (let i = 0; i < rows.length; i++) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = rows[i][0];
    const td = document.createElement('td');
    td.textContent = rows[i][1];
    tr.appendChild(th);
    tr.appendChild(td);
    ttx.appendChild(tr);
  }
}

// ===== Карточка станции =====
function generate() {
  if (stations.length === 0) return;
  let i = Math.floor(Math.random() * stations.length);
  if (stations.length > 1) {
    while (i === lastIndex) {
      i = Math.floor(Math.random() * stations.length);
    }
  }
  lastIndex = i;
  shownCount++;
  const s = stations[i];
  el('name').textContent = s.name;
  el('year').textContent = 'Год создания: ' + s.year;
  const nato = el('nato');
  if (s.nato) {
    nato.textContent = 'НАТО: ' + s.nato;
    nato.hidden = false;
  } else {
    nato.textContent = '';
    nato.hidden = true;
  }
  el('desc').textContent = s.desc || '';
  renderTtx(s);
  const num = addTarget();
  el('trackChip').textContent = 'Трасса № ' + num;
  const card = el('card');
  card.hidden = false;
  card.classList.remove('reveal');
  void card.offsetWidth;
  card.classList.add('reveal');
  el('counter').textContent = 'В базе станций: ' + stations.length + ' · Показано: ' + shownCount + ' · На экране: ' + targets.length + ' / 12';
}

el('genBtn').addEventListener('click', generate);
el('counter').textContent = 'В базе станций: ' + stations.length;
