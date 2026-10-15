'use strict';
/* ---------- 5. Vistas ---------- */
const TABS = [
  ['diary', '📒', 'Diario'], ['foods', '🥦', 'Alimentos'], ['meals', '🍱', 'Comidas'],
  ['week', '📊', 'Semana'], ['weight', '📈', 'Progreso'], ['settings', '⚙️', 'Ajustes']
];
const TITLES = { diary: 'Diario', foods: 'Alimentos', meals: 'Comidas guardadas', week: 'Resumen semanal', weight: 'Progreso', settings: 'Ajustes' };

function macroBar(label, val, target, cls, over) {
  const pct = target > 0 ? Math.min(100, val / target * 100) : 0;
  const isOver = over && target > 0 && val > target * 1.05;
  return `<div class="mrow"><div class="top"><span>${label}</span><span><b>${fmt(val)}</b> / ${fmt(target)} g</span></div>
    <div class="track"><div class="fill ${cls}${isOver ? ' over' : ''}" style="width:${pct}%"></div></div></div>`;
}
const macroLine = t => `P ${fmt(t.p)} · G ${fmt(t.f)} · C ${fmt(t.c)} · Fib ${fmt(t.fiber)}`;

function summaryHTML(key) {
  const T = dayTotals(key), ex = expenseOf(key), bi = balanceInfo(key), tg = state.profile.targets;
  const goal = ex.total - state.profile.deficitGoal, rem = goal - T.total.kcal, remP = tg.p - T.total.p;
  return `<section class="card" id="sumCard">
    <div class="nums">
      <div><div class="n">${fmt(T.total.kcal)}</div><div class="l">Ingesta kcal</div></div>
      <div><div class="n">${fmt(ex.total)}</div><div class="l">Gasto kcal</div></div>
      <div><div class="n">${bi.intake > 0 ? (bi.bal > 0 ? '+' : '−') + fmt(Math.abs(bi.bal)) : '—'}</div><div class="l">Balance</div></div>
    </div>
    <div class="bal ${bi.cls}">${esc(bi.txt)}${key === today() && bi.intake > 0 ? '<span class="sub" style="color:inherit;opacity:.8;font-weight:400">Provisional: el día no ha terminado</span>' : ''}</div>
    <div class="preview" style="text-align:left">🎯 <b>Objetivo de hoy: ${fmt(goal)} kcal</b>
      <span class="sub" style="display:inline">(${state.profile.deficitGoal < 0 ? `gasto ${fmt(ex.total)} + superávit ${fmt(-state.profile.deficitGoal)}` : `gasto ${fmt(ex.total)} − déficit ${fmt(state.profile.deficitGoal)}`})</span><br>
      ${rem >= 0 ? `Te quedan <b>${fmt(rem)} kcal</b>` : `Te has pasado <b style="color:var(--warn)">${fmt(-rem)} kcal</b>`} ·
      ${remP > 0 ? `faltan <b>${fmt(remP)} g</b> de proteína` : 'proteína cumplida ✓'}</div>
    <details style="margin-top:6px" ${ui.calcOpen ? 'open' : ''} data-keep="calcOpen"><summary>Cómo se calcula el gasto</summary>
      <div class="sub" style="font-size:14px">Metabolismo basal ${fmt(ex.bmr)} kcal (peso ${fmt(weightAt(key), 1)} kg) × actividad ${fmt(ex.activity, 2)} = ${fmt(ex.base)} kcal
      ${ex.train.total > 0 ? `<br>+ entrenamiento ${fmt(ex.train.total)} kcal${ex.train.legacy ? '' : ` (fuerza ${fmt(ex.train.strength)} + cinta ${fmt(ex.train.cardio)})`}` : ''}
      ${ex.extra > 0 ? `<br>+ actividad extra ${fmt(ex.extra)} kcal` : ''}</div></details>
    ${macroBar('Proteína', T.total.p, tg.p, 'p', false)}
    ${macroBar('Grasa', T.total.f, tg.f, 'f', true)}
    ${macroBar('Carbohidratos', T.total.c, tg.c, 'c', true)}
    ${macroBar('Fibra', T.total.fiber, tg.fiber, 'fi', false)}
  </section>`;
}
const trainSub = key => {
  const d = state.days[key];
  return d && d.train ? `+${fmt(trainParts(key).total)} kcal de gasto` : 'Actívalo para elegir rutina y calcular el gasto';
};
const trainKcalText = key => {
  const tr = trainParts(key);
  return `Fuerza <b>${fmt(tr.strength)}</b> kcal · Cinta <b>${fmt(tr.cardio)}</b> kcal<br><b>Total ${fmt(tr.total)} kcal</b>`;
};
/* Tarjeta "Hoy entreno": rutina elegible, minutos, intensidad, cinta y kilos de cada ejercicio */
function trainingHTML(key) {
  const d = state.days[key] || {}, on = !!d.train;
  let h = `<section class="card" id="trainCard"><div class="trainrow"><div><b>🏋️ Hoy entreno</b><span class="sub" id="trainSub">${esc(trainSub(key))}</span></div>
    <label class="switch"><input type="checkbox" data-a="train" ${on ? 'checked' : ''}><i></i></label></div>`;
  if (on) {
    const s = ensureSession(key), r = routineById(s.routineId);
    h += `<label class="lbl">Rutina de este día</label><select data-ses="routineId">
      ${state.routines.map(x => `<option value="${esc(x.id)}" ${x.id === s.routineId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
      <option value="" ${r ? '' : 'selected'}>Sin rutina (solo cardio u otra cosa)</option></select>
      <div class="grid2">
        <div><label class="lbl">Fuerza (min)</label><input data-ses="strengthMin" inputmode="decimal" value="${plain(s.strengthMin)}"></div>
        <div><label class="lbl">Intensidad</label><select data-ses="met">${INTENSITY.map(([n, m]) => `<option value="${m}" ${num(s.met) === m ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl">Cinta / andar (min)</label><input data-ses="cardioMin" inputmode="decimal" value="${plain(s.cardioMin)}"></div>
        <div><label class="lbl">Velocidad (km/h)</label><input data-ses="cardioSpeed" inputmode="decimal" value="${plain(s.cardioSpeed)}"></div>
      </div>
      <div class="preview" id="trainKcal">${trainKcalText(key)}</div>
      <p class="note">Estimación: (MET − 1) × tu peso × tiempo. Los kilos no cambian las kcal, pero quedan guardados para seguir tu progreso.</p>`;
    if (r) {
      let last = '';
      r.rows.forEach(row => {
        if (row.block !== last) { h += `<div class="exhead">${esc(row.block)}</div>`; last = row.block; }
        const prev = lastKg(r.id, row.id, key);
        h += `<div class="exrow2"><div class="grow"><b>${esc(row.name)}</b><span class="sub">${esc(row.sets)}${row.plan ? ' · Plan: ' + esc(row.plan) : ''}${prev ? ' · Última vez: ' + esc(prev) + ' kg' : ''}</span></div>
          <div class="kgbox"><input data-kg="${esc(row.id)}" inputmode="decimal" placeholder="kg" value="${esc(s.kg[row.id] || '')}"><em>kg</em></div></div>`;
      });
      if (r.rows.some(x => /molino/i.test(x.name))) h += `<details style="margin-top:8px"><summary style="min-height:40px;font-weight:600;font-size:14px">¿Cómo se hace el Molino de pared?</summary><ol class="steps">${MOLINO.map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>`;
      h += `<div class="row2"><button class="btn sm" data-a="copyLast">Copiar pesos de la última vez</button>
        <button class="btn sm" data-a="editRoutine" data-id="${esc(r.id)}">Editar rutina</button></div>`;
    }
  }
  return h + '</section>';
}
function extrasHTML(key) {
  const list = (state.days[key] || {}).activities || [];
  return `<section class="card" id="extraCard"><div class="bhead"><div><b>⚽ Actividad extra</b><span class="sub">Fútbol, pádel, bici, caminar…</span></div>
    <div class="kc">${fmt(extraKcal(key))} <span class="sub" style="display:inline">kcal</span></div></div>
    ${list.map(a => `<button class="entry" data-a="editAct" data-id="${esc(a.id)}"><span class="grow"><b>${esc(a.name)}</b>
      <span class="sub">${fmt(a.min)} min${num(a.kcalManual) > 0 ? ' · kcal de tu reloj' : ''}</span></span><span class="kc">${fmt(activityKcal(a, key))} kcal</span></button>`).join('')}
    <button class="btn sm block" data-a="addAct">＋ Añadir actividad</button></section>`;
}

function viewDiary() {
  const key = ui.date, d = state.days[key] || { alcohol: 0, entries: {} }, T = dayTotals(key), p = state.profile;
  let h = `<div class="datenav"><button class="iconbtn" data-a="dprev" aria-label="Día anterior">‹</button>
    <div class="datec"><div class="dlabel">${esc(dateLabel(key))}</div><input type="date" id="dateIn" value="${key}"></div>
    <button class="iconbtn" data-a="dnext" aria-label="Día siguiente">›</button></div>`;
  h += `<div class="center">${key !== today() ? '<button class="btn sm" data-a="dtoday">Ir a hoy</button> ' : ''}<button class="btn sm" data-a="copyDay">📋 Copiar de otro día</button></div>`;

  h += backupBannerHTML() + summaryHTML(key) + trainingHTML(key);

  // Bloques de comida
  MEALS.forEach(m => {
    const list = (d.entries && d.entries[m.id]) || [], t = T.meals[m.id];
    h += `<section class="card"><div class="bhead"><div><b>${m.icon} ${m.name}</b><span class="sub">${macroLine(t)}</span></div>
      <div class="kc">${fmt(t.kcal)} <span class="sub" style="display:inline">kcal</span></div></div>
      ${list.map(e => { const f = foodOf(e); return `<button class="entry" data-a="editEntry" data-meal="${m.id}" data-id="${e.id}">
        <span class="grow"><b>${esc(f ? f.name : 'Alimento eliminado')}</b><span class="sub">${esc(qtyText(e))}</span></span>
        <span class="kc">${fmt(macrosOf(e).kcal)} kcal</span></button>`; }).join('')}
      <div class="bactions"><button class="btn sm" data-a="addFood" data-meal="${m.id}">＋ Alimento</button>
      <button class="btn sm" data-a="useSaved" data-meal="${m.id}">★ Guardada</button>
      <button class="btn sm" data-a="saveBlock" data-meal="${m.id}" aria-label="Guardar como comida" ${list.length ? '' : 'disabled style="opacity:.4"'}>💾</button></div></section>`;
  });

  // Alcohol
  h += `<section class="card"><div class="trainrow"><div><b>🍺 Alcohol</b><span class="sub">Caña de 200 ml ≈ ${fmt(p.beerKcal)} kcal${d.alcohol ? ` · ${fmt(T.alcohol)} kcal` : ''}</span></div>
    <div class="stepper"><button class="iconbtn" data-a="alc" data-d="-1" aria-label="Quitar una caña">−</button>
    <div class="val">${d.alcohol || 0}</div><button class="iconbtn" data-a="alc" data-d="1" aria-label="Añadir una caña">+</button></div></div></section>`;

  return h + extrasHTML(key);
}

function viewFoods() {
  const t = norm(ui.foodQ.trim());
  let arr = state.foods.filter(f => (!t || norm(f.name).includes(t)) && (ui.foodFilter === 'all' || f.approx));
  arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const nApprox = state.foods.filter(f => f.approx).length;
  return `<section class="card"><input type="search" id="foodQ" placeholder="Buscar en tu base de alimentos…" value="${esc(ui.foodQ)}" autocomplete="off">
    <div class="chips"><button class="chip ${ui.foodFilter === 'all' ? 'on' : ''}" data-a="ffilter" data-v="all">Todos (${state.foods.length})</button>
    <button class="chip ${ui.foodFilter === 'approx' ? 'on' : ''}" data-a="ffilter" data-v="approx">Por revisar (${nApprox})</button></div>
    <div class="row3" style="margin-top:0"><button class="btn primary sm" data-a="newFood">＋ Nuevo</button>
    <button class="btn sm" data-a="onlineFood">🌐 Online</button><button class="btn sm" data-a="scanFood">📷 Escanear</button></div></section>
    <section class="card" id="foodList">${foodListHTML(arr, ui.foodQ)}</section>`;
}
function foodListHTML(arr, q = '') {
  const cat = q.trim() ? catalogSectionHTML(q) : '';
  if (!arr.length) return '<p class="empty">No hay alimentos tuyos que coincidan.</p>' + cat;
  return arr.map(f => `<button class="entry" data-a="editFood" data-id="${esc(f.id)}"><span class="grow"><b>${esc(f.name)}</b>
    <span class="sub">${fmt(f.kcal)} kcal · P ${fmt(f.p, 1)} · G ${fmt(f.f, 1)} · C ${fmt(f.c, 1)} · Fib ${fmt(f.fiber, 1)} (por 100 g)${f.unit ? ` · 1 ${esc(f.unit.name)} = ${fmt(f.unit.g)} g` : ''}</span></span>
    ${f.approx ? '<span class="badge">aprox.</span>' : ''}</button>`).join('') + cat;
}

function viewMeals() {
  let h = `<section class="card"><button class="btn primary block" style="margin-top:0" data-a="newMeal">＋ Nueva comida guardada</button>
    <p class="note">Crea una comida con varios alimentos y añádela al diario de un toque.</p></section>`;
  if (!state.meals.length) return h + '<p class="empty">Todavía no tienes comidas guardadas.<br>También puedes guardar un bloque del diario con el botón 💾.</p>';
  state.meals.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(m => {
    const t = mealTotals(m);
    h += `<section class="card"><div class="bhead"><div><b>${esc(m.name)}</b><span class="sub">${m.items.length} alimento(s) · ${macroLine(t)}</span></div>
      <div class="kc">${fmt(t.kcal)} <span class="sub" style="display:inline">kcal</span></div></div>
      <div class="row2"><button class="btn primary" data-a="useMeal" data-id="${m.id}">Añadir al diario</button>
      <button class="btn" data-a="editMeal" data-id="${m.id}">Editar</button></div></section>`;
  });
  return h;
}

function viewWeek() {
  const start = mondayOf(ui.weekRef), keys = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const tk = today(), hasToday = keys.includes(tk);
  const rows = keys.map(k => { const t = dayTotals(k).total; return { k, t, ex: expenseOf(k).total, logged: t.kcal > 0 }; });
  const L = rows.filter(r => r.logged && (ui.inclToday || r.k !== tk));
  const n = L.length, avg = fn => n ? L.reduce((s, r) => s + fn(r), 0) / n : 0;
  const defAvg = avg(r => r.ex - r.t.kcal), alarm = state.profile.alarm;
  const a = parseKey(start), z = parseKey(keys[6]);
  const lab = `${a.getDate()} ${a.toLocaleDateString('es-ES', { month: 'short' })} – ${z.getDate()} ${z.toLocaleDateString('es-ES', { month: 'short' })} ${z.getFullYear()}`;
  let h = `<div class="datenav"><button class="iconbtn" data-a="wprev">‹</button><div class="datec"><div class="dlabel">${esc(lab)}</div>
    <span class="sub">${n} día(s) con registro${hasToday && !ui.inclToday ? ' · hoy no cuenta' : ''}</span></div><button class="iconbtn" data-a="wnext">›</button></div>`;
  if (hasToday) h += `<div class="center"><button class="chip ${ui.inclToday ? 'on' : ''}" data-a="inclToday">Incluir hoy en las medias</button></div>`;
  if (!n) return h + '<p class="empty">No hay días con comidas registradas en esta semana.</p>' + weekList(rows);
  h += `<section class="card"><div class="stat">
    <div><div class="n">${fmt(avg(r => r.t.kcal))}</div><div class="l">kcal medias / día</div></div>
    <div><div class="n">${fmt(avg(r => r.ex))}</div><div class="l">gasto medio / día</div></div>
    <div class="${defAvg > alarm ? 'danger' : ''}"><div class="n">${defAvg >= 0 ? '' : '+'}${fmt(Math.abs(defAvg))}</div><div class="l">${defAvg >= 0 ? 'déficit medio' : 'superávit medio'} kcal</div></div>
    <div><div class="n">${fmt(avg(r => r.t.p))} g</div><div class="l">proteína media</div></div>
    <div><div class="n">${fmt(avg(r => r.t.fiber))} g</div><div class="l">fibra media</div></div>
    <div><div class="n">${fmt(avg(r => r.t.f))} / ${fmt(avg(r => r.t.c))} g</div><div class="l">grasa / carbos</div></div></div>
    <p class="note">Déficit acumulado: ${fmt(L.reduce((s, r) => s + r.ex - r.t.kcal, 0))} kcal (≈ ${fmt(L.reduce((s, r) => s + r.ex - r.t.kcal, 0) / 7700, 2)} kg de grasa, estimación orientativa).</p></section>`;
  return h + weekList(rows);
}
function weekList(rows) {
  const alarm = state.profile.alarm;
  return `<section class="card"><h2>Día a día</h2>${rows.map(r => {
    const dt = parseKey(r.k), dow = dt.toLocaleDateString('es-ES', { weekday: 'short' }) + ' ' + dt.getDate();
    if (!r.logged) return `<div class="dayrow dim"><div class="top"><span>${esc(cap(dow))}</span><span>sin registro</span></div></div>`;
    const bal = r.t.kcal - r.ex, def = -bal, color = def > alarm ? 'var(--danger)' : bal > 0 ? 'var(--warn)' : 'var(--accent)';
    return `<div class="dayrow"><div class="top"><span><b>${esc(cap(dow))}</b></span><span>${fmt(r.t.kcal)} / ${fmt(r.ex)} kcal · <b style="color:${color}">${bal > 0 ? '+' : '−'}${fmt(Math.abs(bal))}</b></span></div>
      <div class="track"><div class="fill" style="width:${Math.min(100, r.t.kcal / r.ex * 100)}%;background:${color}"></div></div></div>`;
  }).join('')}</section>`;
}

/* Gráfica de peso en SVG, sin librerías */
function weightChartSVG(pts) {
  if (!pts.length) return '<p class="empty">Aún no hay pesos en este periodo.</p>';
  const W = 360, H = 200, L = 40, R = 14, T = 16, B = 26;
  const xs = pts.map(p => parseKey(p.date).getTime()), ys = pts.map(p => p.kg);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(0.5, (y1 - y0) * 0.2);
  y0 = Math.floor((y0 - pad) * 2) / 2; y1 = Math.ceil((y1 + pad) * 2) / 2; if (y1 - y0 < 1) y1 = y0 + 1;
  const X = t => L + (t - x0) / (x1 - x0) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = y0 + (y1 - y0) * i / 4, y = Y(v).toFixed(1);
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${(+y + 3).toFixed(1)}" text-anchor="end">${fmt(v, 1)}</text>`;
  }
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)} ${Y(ys[i]).toFixed(1)}`).join('');
  const dots = pts.map((p, i) => `<circle class="dot" cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="${pts.length > 40 ? 2 : 3.5}"/>`).join('');
  const short = k => { const d = parseKey(k); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const lastX = X(xs[xs.length - 1]), lastY = Y(ys[ys.length - 1]);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de evolución del peso">${g}
    <path class="line" d="${path}"/>${dots}
    <text class="last" x="${Math.min(lastX, W - 24).toFixed(1)}" y="${(lastY - 9).toFixed(1)}" text-anchor="middle">${fmt(ys[ys.length - 1], 1)}</text>
    <text x="${L}" y="${H - 6}" text-anchor="start">${short(pts[0].date)}</text>
    <text x="${W - R}" y="${H - 6}" text-anchor="end">${short(pts[pts.length - 1].date)}</text></svg>`;
}
/* Ejercicios con kilos anotados y su evolución */
function loggedExercises() {
  const counts = {};
  Object.values(state.days).forEach(d => {
    const s = d.session; if (!s || !s.kg) return;
    Object.keys(s.kg).forEach(id => { if (num(s.kg[id]) > 0) counts[id] = (counts[id] || 0) + 1; });
  });
  const out = [];
  state.routines.forEach(r => r.rows.forEach(row => {
    if (counts[row.id]) out.push({ id: row.id, count: counts[row.id], label: `${row.name} (${r.name.split('·')[0].trim()})` });
  }));
  return out;
}
const exercisePoints = rowId => Object.keys(state.days).sort().map(k => {
  const s = state.days[k].session, v = s && s.kg ? num(s.kg[rowId]) : 0;
  return v > 0 ? { date: k, kg: v } : null;
}).filter(Boolean);
function gymProgressHTML() {
  const ex = loggedExercises(), head = '<section class="card"><h2>💪 Progreso en el gimnasio</h2>';
  if (!ex.length) return head + '<p class="empty">Anota los kilos de tus ejercicios en el diario (“Hoy entreno”) y aquí verás cómo evolucionan.</p></section>';
  if (!ex.some(e => e.id === ui.exId)) ui.exId = ex[0].id;
  const pts = exercisePoints(ui.exId), first = pts[0], last = pts[pts.length - 1], diff = last.kg - first.kg;
  return head + `<select id="exSel">${ex.map(e => `<option value="${esc(e.id)}" ${e.id === ui.exId ? 'selected' : ''}>${esc(e.label)} · ${e.count} sesión(es)</option>`).join('')}</select>
    ${weightChartSVG(pts)}
    <div class="stat" style="margin-top:12px"><div><div class="n">${fmt(last.kg, 1)} kg</div><div class="l">última vez</div></div>
    <div><div class="n">${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(Math.abs(diff), 1)} kg</div><div class="l">desde la primera</div></div>
    <div><div class="n">${fmt(Math.max(...pts.map(p => p.kg)), 1)} kg</div><div class="l">máximo</div></div></div></section>`;
}
function viewWeight() {
  const all = state.weights.slice().sort((a, b) => a.date.localeCompare(b.date));
  const from = ui.wRange ? addDays(today(), -ui.wRange) : '0000-00-00';
  const pts = all.filter(w => w.date >= from);
  let stats = '';
  if (pts.length) {
    const first = pts[0], last = pts[pts.length - 1], diff = last.kg - first.kg;
    const span = (parseKey(last.date) - parseKey(first.date)) / 864e5;
    const pace = span >= 7 ? diff / (span / 7) : null;
    stats = `<div class="stat" style="margin-top:12px"><div><div class="n">${fmt(last.kg, 1)} kg</div><div class="l">último (${last.date.split('-').reverse().join('/')})</div></div>
      <div><div class="n">${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(Math.abs(diff), 1)} kg</div><div class="l">en el periodo</div></div>
      ${pace !== null ? `<div><div class="n">${pace > 0 ? '+' : pace < 0 ? '−' : ''}${fmt(Math.abs(pace), 2)} kg</div><div class="l">por semana</div></div>` : ''}</div>`;
  }
  return `<section class="card"><h2>Registrar peso</h2><div class="grid2">
    <input type="date" id="wDate" value="${today()}"><input id="wKg" inputmode="decimal" placeholder="kg, ej. 83,5"></div>
    <button class="btn primary block" data-a="wsave">Guardar peso</button></section>
    <section class="card"><div class="chips" style="margin-top:0">${[[30, '30 días'], [90, '90 días'], [365, '1 año'], [0, 'Todo']].map(([v, l]) =>
      `<button class="chip ${ui.wRange === v ? 'on' : ''}" data-a="wrange" data-v="${v}">${l}</button>`).join('')}</div>
    ${weightChartSVG(pts)}${stats}</section>
    <section class="card"><h2>Historial</h2>${all.length ? all.slice().reverse().slice(0, 60).map(w => `<button class="entry" data-a="wdel" data-d="${w.date}">
      <span class="grow"><b>${w.date.split('-').reverse().join('/')}</b></span><span class="kc">${fmt(w.kg, 1)} kg</span><span class="sub" style="width:24px">✕</span></button>`).join('') : '<p class="empty">Sin registros todavía.</p>'}
    ${all.length ? '<p class="note">Toca un registro para borrarlo. El gasto de cada día usa el último peso registrado hasta esa fecha.</p>' : ''}</section>${gymProgressHTML()}`;
}

function fld(label, path, val, o = {}) {
  return `<label class="fld"><span>${label}</span><input ${o.text ? '' : 'data-num="1"'} ${o.min != null ? `data-min="${o.min}"` : ''}
    inputmode="${o.text ? 'text' : 'decimal'}" data-set="${path}" value="${esc(o.text ? val : plain(val))}">${o.suf ? `<em>${o.suf}</em>` : '<em></em>'}</label>`;
}
function calcNote() {
  const kg = weightAt(today()), q = profileAt(today()), bmr = bmrFor(kg, today()), rest = bmr * q.activity;
  return `Con ${fmt(kg, 1)} kg: metabolismo basal <b>${fmt(bmr)} kcal</b> · día sin entreno <b>${fmt(rest)} kcal</b>. El entrenamiento y la actividad extra se suman encima.`;
}
const DOW_LETTERS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
/* Ajustes: un menú de iconos; cada icono abre su sección (ui.setSec) */
const SET_SECS = [
  ['perfil', '👤', 'Perfil', 'Sexo, edad, altura, peso, actividad'],
  ['rutinas', '🏋️', 'Rutinas', 'Entrenamientos y ejercicios'],
  ['objetivos', '🎯', 'Objetivos', 'Macros diarios y caña'],
  ['tema', '🎨', 'Apariencia', 'Tema claro u oscuro'],
  ['copia', '💾', 'Copia de seguridad', 'Compartir, importar o borrar']
];
const SET_HTML = {
  perfil: () => { const p = state.profile, tg = p.targets, q = profileAt(today()); return `<section class="card"><h2>Perfil</h2>
    <p class="note" style="margin-top:0">Los cambios de peso, altura, edad, sexo o factor de actividad se aplican <b>desde hoy en adelante</b>: los días anteriores no se recalculan.</p>
    <label class="fld"><span>Sexo</span><select data-set="plog.sex"><option value="M" ${q.sex === 'M' ? 'selected' : ''}>Hombre</option><option value="F" ${q.sex === 'F' ? 'selected' : ''}>Mujer</option></select><em></em></label>
    <label class="fld"><span>Fecha de nacimiento</span><input type="date" data-set="profile.birth" value="${esc(p.birth || '')}" max="${today()}" style="width:160px"><em></em></label>
    ${/^\d{4}-\d{2}-\d{2}$/.test(p.birth || '')
      ? `<p class="note">Edad calculada: <b>${ageAt(today())} años</b>. Se actualiza sola cada cumpleaños.</p>`
      : fld('Edad (o pon tu fecha de nacimiento)', 'plog.age', q.age, { suf: 'años', min: 1 })}
    ${fld('Altura', 'plog.height', q.height, { suf: 'cm', min: 50 })}
    ${fld('Peso actual', 'weight.today', weightAt(today()), { suf: 'kg', min: 20 })}
    ${fld('Factor de actividad', 'plog.activity', q.activity, { min: 1 })}
    ${fld('Déficit diario (negativo = ganar)', 'profile.deficitGoal', p.deficitGoal, { suf: 'kcal', min: -1000 })}
    ${fld('Avisar si el déficit supera', 'profile.alarm', p.alarm, { suf: 'kcal', min: 0 })}
    <p class="note" id="calcNote">${calcNote()}</p></section>`; },
  rutinas: () => { const p = state.profile, tg = p.targets, q = profileAt(today()); return `<section class="card"><h2>Rutinas de entrenamiento</h2>
    <p class="note" style="margin-top:0">Se eligen al activar “Hoy entreno”. Cada rutina propone sus ejercicios, minutos, intensidad y cinta.</p>
    ${state.routines.map(r => `<button class="entry" data-a="editRoutine" data-id="${esc(r.id)}"><span class="grow"><b>${esc(r.name)}</b>
      <span class="sub">${fmt(r.strengthMin)} min de fuerza${r.cardioMin > 0 ? ` + ${fmt(r.cardioMin)} min a ${plain(r.cardioSpeed)} km/h` : ''} · ${(r.dows || []).length ? DOW_LETTERS.filter(([i]) => r.dows.includes(i)).map(x => x[1]).join(' ') : 'sin día fijo'}</span></span><span class="sub">✎</span></button>`).join('')}
    <button class="btn block" data-a="newRoutine">＋ Nueva rutina</button></section>`; },
  objetivos: () => { const p = state.profile, tg = p.targets, q = profileAt(today()); return `<section class="card"><h2>Objetivos diarios</h2>
    ${fld('Proteína', 'profile.targets.p', tg.p, { suf: 'g', min: 0 })}${fld('Grasa', 'profile.targets.f', tg.f, { suf: 'g', min: 0 })}
    ${fld('Carbohidratos', 'profile.targets.c', tg.c, { suf: 'g', min: 0 })}${fld('Fibra', 'profile.targets.fiber', tg.fiber, { suf: 'g', min: 0 })}
    ${fld('Caña de 200 ml', 'profile.beerKcal', p.beerKcal, { suf: 'kcal', min: 0 })}</section>`; },
  tema: () => { const p = state.profile, tg = p.targets, q = profileAt(today()); return `<section class="card"><h2>Apariencia</h2><label class="fld"><span>Tema</span><select data-set="theme">
      ${[['auto', 'Automático'], ['dark', 'Oscuro'], ['light', 'Claro']].map(([v, l]) => `<option value="${v}" ${state.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select><em></em></label></section>`; },
  copia: () => { const p = state.profile, tg = p.targets, q = profileAt(today()); return `<section class="card"><h2>Copia de seguridad</h2>
    <p class="note" style="margin-top:0">Tus datos viven solo en este móvil. Última copia: <b>${state.lastExport ? state.lastExport.split('-').reverse().join('/') : 'nunca'}</b>.</p>
    <button class="btn primary block" data-a="shareBackup">Compartir copia (Drive, WhatsApp…)</button>
    <button class="btn block" data-a="export">Descargar copia (JSON)</button>
    <button class="btn block" data-a="import">Importar copia</button>
    <button class="btn danger block" data-a="reset">Borrar todos los datos</button>
    <p class="note" id="swState"></p></section>`; }
};
function settingsTitle() { const s = SET_SECS.find(x => x[0] === ui.setSec); return s ? s[2] : TITLES.settings; }
function viewSettings() {
  if (!SET_HTML[ui.setSec]) {
    return `<div class="setgrid">${SET_SECS.map(([id, ic, name, sub]) => `<button class="settile" data-a="setSec" data-s="${id}"><span class="ic">${ic}</span><b>${name}</b><span class="sub">${sub}</span></button>`).join('')}</div>
      <p class="note" id="swState" style="margin:10px 16px"></p>`;
  }
  return `<div style="margin:0 12px 10px"><button class="btn sm" data-a="setSec" data-s="">← Ajustes</button></div>` + SET_HTML[ui.setSec]();
}

const VIEWS = { diary: viewDiary, foods: viewFoods, meals: viewMeals, week: viewWeek, weight: viewWeight, settings: viewSettings };
let lastTab = null;
function render() {
  const y = window.scrollY;
  $('#title').textContent = ui.tab === 'settings' ? settingsTitle() : TITLES[ui.tab];
  $('#view').innerHTML = VIEWS[ui.tab]();
  $('#tabsIn').innerHTML = TABS.map(([id, ic, lb]) => `<button class="${ui.tab === id ? 'on' : ''}" data-a="tab" data-t="${id}"><span>${ic}</span>${lb}</button>`).join('');
  window.scrollTo(0, lastTab === ui.tab ? y : 0);
  lastTab = ui.tab;
  const tb = { auto: '◐', dark: '🌙', light: '☀️' }; $('#themeBtn').textContent = tb[state.theme] || '◐';
  if (ui.tab === 'settings') updateSwState();
}

/* ---------- Bienvenida (usuario nuevo) ---------- */
function welcomeScreen() {
  if (state.onboarded) return;
  const el = document.createElement('div'); el.id = 'welcome';
  el.innerHTML = `<div class="in"><h1 style="margin:8px 0">👋 Bienvenido</h1>
    <p class="sub">Para calcular tu gasto de calorías necesito unos datos. Se guardan solo en este móvil y puedes cambiarlos luego en Ajustes.</p>
    <label class="lbl">Sexo</label><select id="w-sex"><option value="M">Hombre</option><option value="F">Mujer</option></select>
    <label class="lbl">Fecha de nacimiento</label><input type="date" id="w-birth">
    <div class="grid2"><div><label class="lbl">Altura (cm)</label><input id="w-h" inputmode="decimal" placeholder="175"></div>
    <div><label class="lbl">Peso (kg)</label><input id="w-w" inputmode="decimal" placeholder="70"></div></div>
    <label class="lbl">¿Cómo es tu día a día? (sin contar entrenar)</label>
    <select id="w-act"><option value="1.2">Casi todo el día sentado</option><option value="1.35" selected>Sentado, pero camino un poco cada día</option>
    <option value="1.5">Paso mucho tiempo de pie o andando</option><option value="1.65">Trabajo físico</option></select>
    <label class="lbl">¿Qué objetivo tienes?</label>
    <select id="w-def"><option value="500" selected>Perder grasa</option><option value="0">Mantener mi peso</option><option value="-300">Ganar músculo</option></select>
    <span class="sub">Si dudas, deja lo marcado: luego se puede cambiar en Ajustes.</span>
    <p class="sub" id="w-err" style="color:var(--danger)"></p>
    <button class="btn primary block" id="w-ok">Empezar</button></div>`;
  document.body.appendChild(el);
  $('#w-ok', el).onclick = () => {
    const birth = $('#w-birth', el).value, h = num($('#w-h', el).value), kg = num($('#w-w', el).value), def = +$('#w-def', el).value;
    const err = m => { $('#w-err', el).textContent = m; };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return err('Pon tu fecha de nacimiento.');
    if (h < 120 || h > 230) return err('Altura entre 120 y 230 cm.');
    if (kg < 30 || kg > 300) return err('Peso entre 30 y 300 kg.');
    const sex = $('#w-sex', el).value, act = +$('#w-act', el).value;
    Object.assign(state.profile, { sex, birth, height: h, weight: kg, activity: act, deficitGoal: def });
    const age = ageAt(today());
    state.profile.age = age;
    state.profileLog = [{ from: '0000-00-00', sex, age, height: h, activity: act }];
    state.weights = [{ date: today(), kg }];
    state.onboarded = true; state.created = today(); save(); el.remove(); render();
  };
}
/* ---------- Instalación (Android / iPhone) ---------- */
let installEvt = null;
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function updateInstallBtn() { $('#installBtn').hidden = isStandalone(); }
try {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', () => { installEvt = null; $('#installBtn').hidden = true; toast('App instalada'); });
} catch (e) {}
function sheetInstall() {
  const ios = isIOS();
  const b = openSheet(`<h3>Instalar app</h3>
    <span class="sub">Se añade a tu pantalla de inicio como una app y funciona sin internet.</span>
    <div class="row2" style="margin-top:10px"><button class="btn ${!ios ? 'primary' : ''}" id="i-and">🤖 Android</button><button class="btn ${ios ? 'primary' : ''}" id="i-ios">🍎 iPhone</button></div>
    <div id="i-body" style="margin-top:12px"></div><button class="btn block" id="i-close">Cerrar</button>`);
  const body = $('#i-body', b);
  const showAnd = () => {
    body.innerHTML = installEvt
      ? `<button class="btn primary block" id="i-go">Instalar ahora</button><span class="sub">Android te pedirá confirmar una vez.</span>`
      : `<p><b>En Chrome:</b></p><ol class="steps"><li>Toca los <b>tres puntitos ⋮</b> arriba a la derecha.</li><li>Elige <b>Instalar app</b> (o <b>Añadir a pantalla de inicio</b>).</li><li>Confirma.</li></ol>
         <span class="sub">Si ya la instalaste o abres esto desde otro navegador, puede que no aparezca el botón automático.</span>`;
    const go = $('#i-go', body);
    if (go) go.onclick = async () => { const ev = installEvt; installEvt = null; try { await ev.prompt(); await ev.userChoice; } catch (e) {} closeSheet(); };
  };
  const showIos = () => { body.innerHTML = `<p><b>En Safari:</b></p><ol class="steps"><li>Toca el botón <b>Compartir</b> (cuadrado con flecha ⬆︎, abajo o arriba).</li><li>Baja y elige <b>Añadir a pantalla de inicio</b>.</li><li>Toca <b>Añadir</b>.</li></ol>
    <span class="sub">Apple no permite instalar con un solo botón: hay que hacerlo desde el menú Compartir. Debe ser Safari (o Chrome/Edge con iOS reciente).</span>`; };
  $('#i-and', b).onclick = showAnd; $('#i-ios', b).onclick = showIos; $('#i-close', b).onclick = closeSheet;
  (ios ? showIos : showAnd)();
}
try { $('#installBtn').onclick = sheetInstall; } catch (e) {}
window.__p = (window.__p || 0) + 1;   // marca: este archivo se cargó entero
