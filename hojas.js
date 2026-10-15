'use strict';
/* ---------- 4. Hoja inferior (diálogos) ---------- */
let sheetOpen = false;
let sheetCleanup = null;   // se ejecuta al cambiar o cerrar la hoja (p. ej. para apagar la cámara)
const runCleanup = () => { if (sheetCleanup) { try { sheetCleanup(); } catch (e) {} sheetCleanup = null; } };
function openSheet(html) {
  runCleanup();
  const body = $('#sheetBody'); body.innerHTML = html;
  $('#sheet').classList.add('open'); body.scrollTop = 0;
  if (!sheetOpen) history.pushState({ sheet: 1 }, '');   // el botón "atrás" de Android cierra la hoja
  sheetOpen = true;
  return body;
}
function hideSheet() { runCleanup(); $('#sheet').classList.remove('open'); sheetOpen = false; }
function closeSheet() {
  if (!sheetOpen) return;
  if (history.state && history.state.sheet) history.back(); else hideSheet();
}
window.addEventListener('popstate', () => { if (sheetOpen) hideSheet(); });
$('#sheet').addEventListener('click', ev => { if (ev.target.id === 'sheet') closeSheet(); });

function confirmSheet(msg, okLabel, onOk, onCancel, danger = true) {
  const b = openSheet(`<h3>Confirmar</h3><p>${esc(msg)}</p>
    <button class="btn ${danger ? 'danger' : 'primary'} block" id="cok">${esc(okLabel)}</button>
    <button class="btn block" id="ccancel">Cancelar</button>`);
  $('#cok', b).onclick = onOk;
  $('#ccancel', b).onclick = () => onCancel ? onCancel() : closeSheet();
}

/* Cantidad: gramos o unidades (pieza/ración) con vista previa de macros */
function sheetQty({ food, grams, confirmLabel, onOk, onBack, onDelete }) {
  const u = food.unit;
  const isMult = u && u.g > 0 && Math.abs(grams / u.g * 2 - Math.round(grams / u.g * 2)) < 1e-6;
  let mode = isMult ? 'u' : 'g';
  const b = openSheet(`<h3>${esc(food.name)}</h3>
    <span class="sub">${fmt(food.kcal)} kcal / 100 g${food.approx ? ' · valores aproximados' : ''}</span>
    ${u ? `<div class="seg"><button data-m="g">Gramos</button><button data-m="u">${esc(cap(u.name))} (${fmt(u.g)} g)</button></div>` : ''}
    <label class="lbl" id="qlabel"></label>
    <input id="qin" type="text" inputmode="decimal" autocomplete="off">
    <div class="chips" id="qchips"></div>
    <div class="preview" id="qprev"></div>
    <button class="btn primary block" id="qok">${esc(confirmLabel)}</button>
    <div class="row2">
      ${onBack ? '<button class="btn" id="qback">Volver</button>' : '<button class="btn" id="qcancel">Cancelar</button>'}
      ${onDelete ? '<button class="btn danger" id="qdel">Eliminar</button>' : '<span></span>'}
    </div>`);
  const inp = $('#qin', b);
  const toGrams = () => mode === 'u' ? num(inp.value) * u.g : num(inp.value);
  const refresh = () => {
    $('#qlabel', b).textContent = mode === 'u' ? `Número de ${u.name}` : 'Gramos';
    b.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x.dataset.m === mode));
    const vals = mode === 'u' ? [0.5, 1, 2, 3] : [50, 100, 150, 200, 250];
    $('#qchips', b).innerHTML = vals.map(v => `<button class="chip" data-v="${v}">${plain(v)}${mode === 'u' ? '' : ' g'}</button>`).join('');
    preview();
  };
  const preview = () => {
    const g = toGrams(), k = g / 100;
    $('#qprev', b).innerHTML = g > 0
      ? `<b>${fmt(food.kcal * k)} kcal</b> · P ${fmt(food.p * k, 1)} · G ${fmt(food.f * k, 1)} · C ${fmt(food.c * k, 1)} · Fibra ${fmt(food.fiber * k, 1)}${mode === 'u' ? ` · ${fmt(g)} g` : ''}`
      : 'Indica una cantidad';
  };
  inp.value = plain(mode === 'u' ? grams / u.g : grams);
  inp.addEventListener('input', preview);
  b.addEventListener('click', ev => {
    const m = ev.target.closest('[data-m]');
    if (m && m.dataset.m !== mode) { const g = toGrams(); mode = m.dataset.m; inp.value = plain(mode === 'u' ? g / u.g : g); refresh(); }
    const c = ev.target.closest('.chip');
    if (c) { inp.value = plain(num(c.dataset.v)); preview(); }
  });
  $('#qok', b).onclick = () => { const g = toGrams(); if (!(g > 0)) return toast('Indica una cantidad'); onOk(g); };
  if (onBack) $('#qback', b).onclick = onBack; else $('#qcancel', b).onclick = closeSheet;
  if (onDelete) $('#qdel', b).onclick = onDelete;
  refresh();
}

/* Buscador de alimentos → cantidad → onPick(food, gramos) */
function sheetPicker({ title, onPick, onBack }) {
  const b = openSheet(`<h3>${esc(title)}</h3>
    <input type="search" id="pq" placeholder="Buscar alimento…" autocomplete="off">
    <div id="plist" class="list"></div>
    <div class="row3"><button class="btn sm" id="pnew">＋ Nuevo</button>
    <button class="btn sm" id="ponline">🌐 Online</button><button class="btn sm" id="pscan">📷 Escanear</button></div>
    <button class="btn block" id="pback">${onBack ? 'Volver' : 'Cerrar'}</button>`);
  const q = $('#pq', b), list = $('#plist', b);
  const rank = id => { const i = state.recent.indexOf(id); return i < 0 ? 999 : i; };
  const draw = () => {
    const t = norm(q.value.trim());
    let arr = state.foods.filter(f => !t || norm(f.name).includes(t));
    arr.sort((a, c) => (t ? 0 : rank(a.id) - rank(c.id)) || a.name.localeCompare(c.name, 'es'));
    let html = arr.map(f => `<button class="item" data-id="${esc(f.id)}"><span class="grow"><b>${esc(f.name)}</b>
      <span class="sub">${fmt(f.kcal)} kcal · P ${fmt(f.p, 1)} · G ${fmt(f.f, 1)} · C ${fmt(f.c, 1)} /100 g</span></span>
      ${f.approx ? '<span class="badge">aprox.</span>' : ''}</button>`).join('');
    if (t) {   // coincidencias del catálogo base que aún no están en tu base
      const idx = catalogMatches(q.value, 10);
      if (idx.length) html += '<span class="sub" style="margin-top:6px">Catálogo base</span>' + idx.map(i => { const c = CATALOG[i];
        return `<button class="item" data-cat="${i}"><span class="grow"><b>${esc(c[0])}</b>
        <span class="sub">${fmt(c[1])} kcal · P ${fmt(c[2], 1)} · G ${fmt(c[3], 1)} · C ${fmt(c[4], 1)} /100 g</span></span><span class="badge">catálogo</span></button>`; }).join('');
    }
    if (!html) html = '<p class="empty">Sin resultados. Crea el alimento, búscalo online o escanea su código.</p>';
    else if (!t) html += `<span class="sub" style="text-align:center;margin-top:6px">Escribe para buscar también en el catálogo base (${CATALOG.length} alimentos)</span>`;
    list.innerHTML = html;
  };
  q.addEventListener('input', draw); draw();
  const again = () => sheetPicker({ title, onPick, onBack });
  list.addEventListener('click', ev => {
    const it = ev.target.closest('.item'); if (!it) return;
    const food = it.dataset.cat !== undefined ? addCatalog(+it.dataset.cat) : foodById(it.dataset.id);
    sheetQty({ food, grams: state.lastGrams[food.id] || (food.unit ? food.unit.g : 100),
               confirmLabel: 'Añadir', onOk: g => onPick(food, g), onBack: again });
  });
  $('#pnew', b).onclick = () => openFoodForm(null, again);
  const afterSave = food => sheetQty({ food, grams: food.unit ? food.unit.g : 100, confirmLabel: 'Añadir', onOk: g => onPick(food, g), onBack: again });
  $('#ponline', b).onclick = () => sheetOnline({ onBack: again, onDone: afterSave });
  $('#pscan', b).onclick = () => sheetScan({ onBack: again, onDone: afterSave });
  $('#pback', b).onclick = () => onBack ? onBack() : closeSheet();
}

/* Formulario de alimento (alta / edición / borrado) */
function openFoodForm(food, onSaved, prefill) {
  const isNew = !food;   // con "prefill" se crea un alimento nuevo con esos datos ya rellenos
  const f = food || prefill || { name: '', kcal: '', p: '', f: '', c: '', fiber: '', approx: false, note: '', unit: null };
  const v = x => esc(x === '' ? '' : plain(x));
  const b = openSheet(`<h3>${isNew ? 'Nuevo alimento' : 'Editar alimento'}</h3>
    <span class="sub">Todos los valores por 100 g</span>
    <label class="lbl">Nombre</label><input id="fn" value="${esc(f.name)}" autocomplete="off">
    <div class="grid2">
      <div><label class="lbl">Calorías (kcal)</label><input id="fk" inputmode="decimal" value="${v(f.kcal)}"></div>
      <div><label class="lbl">Proteína (g)</label><input id="fp" inputmode="decimal" value="${v(f.p)}"></div>
      <div><label class="lbl">Grasa (g)</label><input id="ff" inputmode="decimal" value="${v(f.f)}"></div>
      <div><label class="lbl">Carbohidratos (g)</label><input id="fc" inputmode="decimal" value="${v(f.c)}"></div>
      <div><label class="lbl">Fibra (g)</label><input id="fi" inputmode="decimal" value="${v(f.fiber)}"></div>
    </div>
    <label class="check"><input type="checkbox" id="fa" ${f.approx ? 'checked' : ''}> Valores aproximados (revisar con la etiqueta)</label>
    <label class="lbl">Unidad opcional (pieza, ración, cucharada…) y su peso</label>
    <div class="grid2"><input id="fun" placeholder="pieza" value="${esc(f.unit ? f.unit.name : '')}">
    <input id="fug" inputmode="decimal" placeholder="peso en g" value="${f.unit ? plain(f.unit.g) : ''}"></div>
    <label class="lbl">Nota (opcional)</label><input id="fnote" value="${esc(f.note || '')}">
    <button class="btn primary block" id="fsave">Guardar</button>
    <div class="row2"><button class="btn" id="fcancel">Cancelar</button>
    ${isNew ? '<span></span>' : '<button class="btn danger" id="fdel">Eliminar</button>'}</div>`);
  $('#fcancel', b).onclick = () => onSaved ? onSaved() : closeSheet();
  $('#fsave', b).onclick = () => {
    const name = $('#fn', b).value.trim();
    if (!name) return toast('Escribe un nombre');
    if ($('#fk', b).value.trim() === '') return toast('Indica las kcal por 100 g');
    const un = $('#fun', b).value.trim(), ug = num($('#fug', b).value);
    if ((un && !(ug > 0)) || (!un && ug > 0)) return toast('La unidad necesita nombre y peso en gramos');
    const data = { name, kcal: num($('#fk', b).value), p: num($('#fp', b).value), f: num($('#ff', b).value),
      c: num($('#fc', b).value), fiber: num($('#fi', b).value), approx: $('#fa', b).checked,
      note: $('#fnote', b).value.trim(), unit: un ? { name: un, g: ug } : null };
    let saved;
    if (isNew) { saved = Object.assign({ id: uid() }, data); state.foods.push(saved); }
    else { saved = Object.assign(food, data); }
    save(); render(); toast('Alimento guardado');
    if (onSaved) onSaved(saved); else closeSheet();
  };
  if (!isNew) $('#fdel', b).onclick = () => confirmSheet(
    `¿Eliminar "${food.name}"? Se quitará de las comidas guardadas; el histórico del diario se conserva.`, 'Eliminar',
    () => {
      state.foods = state.foods.filter(x => x.id !== food.id);
      state.meals.forEach(m => { m.items = m.items.filter(i => i.foodId !== food.id); });
      state.recent = state.recent.filter(i => i !== food.id);
      save(); closeSheet(); render(); toast('Alimento eliminado');
    }, () => openFoodForm(food, onSaved));
}

/* ---- Búsqueda online en Open Food Facts (base abierta; requiere conexión) ----
   Los resultados se revisan en el formulario antes de guardarse; una vez guardados
   el alimento vive en tu base local y funciona sin internet. */
const onlineState = { q: '', results: null, msg: '' };
function offToFood(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;   // kJ → kcal
  const name = (p.product_name_es || p.product_name || '').trim();
  if (!name || kcal == null || !isFinite(+kcal)) return null;
  const brand = (p.brands || '').split(',')[0].trim();
  const missing = ['proteins_100g', 'fat_100g', 'carbohydrates_100g', 'fiber_100g']
    .filter(k => n[k] == null || !isFinite(+n[k]));
  const r1 = x => Math.round(num(x) * 10) / 10, sq = num(p.serving_quantity);
  return {
    name: brand && !norm(name).includes(norm(brand)) ? `${name} (${brand})` : name,
    kcal: Math.round(+kcal), p: r1(n.proteins_100g), f: r1(n.fat_100g), c: r1(n.carbohydrates_100g), fiber: r1(n.fiber_100g),
    approx: missing.length > 0,
    note: 'Fuente: Open Food Facts' + (p.code ? ` (${p.code})` : '') + (missing.length ? '. Faltan datos en su ficha: revisa la etiqueta.' : ''),
    unit: sq > 0 && sq < 1000 ? { name: 'porción', g: sq } : null,
    img: [p.image_front_small_url, p.image_small_url, p.image_thumb_url].find(u => /^https:\/\//.test(u || '')) || ''   // miniatura (solo https)
  };
}
async function searchOFF(q) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=30'
    + '&fields=code,product_name,product_name_es,brands,nutriments,serving_quantity,image_front_small_url,image_small_url,image_thumb_url&search_terms=' + encodeURIComponent(q);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j.products || []).map(offToFood).filter(Boolean);
  } finally { clearTimeout(timer); }
}
const OFF_FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity,image_front_small_url,image_small_url,image_thumb_url';
/* Consulta un producto por su código de barras en Open Food Facts → [] o [alimento] */
async function barcodeResults(code) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, { signal: ctl.signal });
    if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const f = j && j.status === 1 && j.product ? offToFood(Object.assign({ code }, j.product)) : null;
    return f ? [f] : [];
  } finally { clearTimeout(timer); }
}
/* Escáner: usa la cámara y BarcodeDetector (Chrome en Android). Sin cámara, se puede escribir el número. */
function sheetScan({ onDone, onBack, msg }) {
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  const b = openSheet(`<h3>Escanear código de barras</h3>
    ${canScan ? '<video id="sv" playsinline muted style="width:100%;border-radius:12px;background:#000;max-height:40vh;object-fit:cover"></video>' : ''}
    <p class="note" id="sst">${esc(msg || (canScan ? 'Apunta la cámara al código de barras del producto.' : 'Este navegador no puede escanear con la cámara. Escribe el número del código.'))}</p>
    <label class="lbl">O escribe el número del código</label>
    <div class="grid2" style="grid-template-columns:1fr auto"><input id="sc" inputmode="numeric" placeholder="8412345678901" autocomplete="off"><button class="btn primary" id="sgo">Buscar</button></div>
    <button class="btn block" id="sback">${onBack ? 'Volver' : 'Cerrar'}</button>`);
  let stream = null, stop = false;
  const status = t => { const s = $('#sst'); if (s) s.textContent = t; };
  const stopCam = () => { stop = true; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
  sheetCleanup = stopCam;    // la cámara se apaga al cerrar o cambiar de pantalla
  const again = m => sheetScan({ onDone, onBack, msg: m });
  const found = async code => {
    stopCam();
    if (!navigator.onLine) return again('Sin conexión. Inténtalo cuando tengas internet.');
    status('Buscando ' + code + '…');
    let res;
    try { res = await barcodeResults(code); } catch (e) { return again('No se pudo conectar con Open Food Facts. Inténtalo de nuevo.'); }
    if (!res.length) return again(`No hay datos útiles del código ${code}. Prueba con otro o crea el alimento a mano.`);
    openFoodForm(null, saved => saved ? onDone(saved) : sheetScan({ onDone, onBack }), res[0]);
  };
  $('#sgo', b).onclick = () => {
    const c = $('#sc', b).value.replace(/\D/g, '');
    if (c.length < 8 || c.length > 14) return toast('El código tiene entre 8 y 14 cifras');
    found(c);
  };
  $('#sback', b).onclick = () => onBack ? onBack() : closeSheet();
  if (canScan) (async () => {
    try {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (stop) { stopCam(); return; }
      const v = $('#sv'); if (!v) { stopCam(); return; }
      v.srcObject = stream; await v.play();
      const tick = async () => {
        if (stop) return;
        try { const r = await det.detect(v); if (r.length) return found(r[0].rawValue); } catch (e) {}
        setTimeout(tick, 250);
      };
      tick();
    } catch (e) { status('No se pudo usar la cámara' + (e && e.name === 'NotAllowedError' ? ' (permiso denegado)' : '') + '. Escribe el código.'); }
  })();
}
function sheetOnline({ onDone, onBack }) {
  const b = openSheet(`<h3>Buscar online</h3>
    <span class="sub">Open Food Facts · productos de supermercado. Revisa los datos antes de guardar.</span>
    <div class="grid2" style="grid-template-columns:1fr auto;margin-top:10px">
      <input type="search" id="oq" placeholder="Ej.: arroz basmati hacendado" value="${esc(onlineState.q)}" autocomplete="off">
      <button class="btn primary" id="ogo">Buscar</button></div>
    <button class="btn sm block" id="oscan" style="margin-top:8px">📷 Escanear código de barras</button>
    <div id="olist" class="list" style="max-height:50vh"></div>
    <button class="btn block" id="oback">${onBack ? 'Volver' : 'Cerrar'}</button>`);
  const list = $('#olist', b), q = $('#oq', b);
  const draw = () => {
    if (onlineState.msg) { list.innerHTML = `<p class="empty">${esc(onlineState.msg)}</p>`; return; }
    const res = onlineState.results;
    if (!res) { list.innerHTML = ''; return; }
    list.innerHTML = res.length ? res.map((f, i) => `<button class="item" data-i="${i}">${f.img ? `<img class="thumb" src="${esc(f.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="grow"><b>${esc(f.name)}</b>
      <span class="sub">${fmt(f.kcal)} kcal · P ${fmt(f.p, 1)} · G ${fmt(f.f, 1)} · C ${fmt(f.c, 1)} /100 g</span></span>
      ${f.approx ? '<span class="badge">incompleto</span>' : ''}</button>`).join('')
      : '<p class="empty">Sin resultados. Prueba con otras palabras (por ejemplo, la marca).</p>';
  };
  const go = async () => {
    const t = q.value.trim();
    if (t.length < 2) return toast('Escribe al menos 2 letras');
    onlineState.q = t; onlineState.msg = '';
    if (!navigator.onLine) { onlineState.results = null; onlineState.msg = 'Sin conexión. Inténtalo cuando tengas internet.'; draw(); return; }
    list.innerHTML = '<p class="empty">Buscando…</p>';
    try { onlineState.results = /^\d{8,14}$/.test(t) ? await barcodeResults(t) : await searchOFF(t); }   // un número largo = código de barras
    catch (e) { onlineState.results = null; onlineState.msg = 'No se pudo conectar con Open Food Facts. Inténtalo de nuevo en unos segundos.'; }
    if (list.isConnected) draw();
  };
  $('#ogo', b).onclick = go;
  $('#oscan', b).onclick = () => sheetScan({ onDone, onBack: () => sheetOnline({ onDone, onBack }) });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  list.addEventListener('click', ev => {
    const it = ev.target.closest('.item'); if (!it) return;
    const pre = onlineState.results[+it.dataset.i];
    openFoodForm(null, saved => saved ? onDone(saved) : sheetOnline({ onDone, onBack }), pre);
  });
  $('#oback', b).onclick = () => onBack ? onBack() : closeSheet();
  draw();
}

/* Editor de rutinas: nombre, minutos, intensidad, cinta, días propuestos y ejercicios.
   Los kilos ya anotados siguen unidos a cada ejercicio mientras no cambies su bloque y nombre. */
function openRoutineEditor(id) {
  const isNew = !id;
  const r = isNew ? { id: null, name: '', dows: [], strengthMin: 45, met: 5, cardioMin: 0, cardioSpeed: 5, rows: [] } : routineById(id);
  if (!r) return;
  const dows = new Set(r.dows || []);
  const b = openSheet(`<h3>${isNew ? 'Nueva rutina' : 'Editar rutina'}</h3>
    <label class="lbl">Nombre</label><input id="rn" value="${esc(r.name)}" placeholder="Ej.: Día 4 · Pierna" autocomplete="off">
    <div class="grid2">
      <div><label class="lbl">Fuerza (min)</label><input id="rs" inputmode="decimal" value="${plain(r.strengthMin)}"></div>
      <div><label class="lbl">Intensidad</label><select id="rm">${INTENSITY.map(([n, m]) => `<option value="${m}" ${m === r.met ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label class="lbl">Cinta / andar (min)</label><input id="rc" inputmode="decimal" value="${plain(r.cardioMin)}"></div>
      <div><label class="lbl">Velocidad (km/h)</label><input id="rv" inputmode="decimal" value="${plain(r.cardioSpeed)}"></div></div>
    <label class="lbl">Se propone estos días al activar “Hoy entreno”</label>
    <div class="chips" id="rd">${DOW_LETTERS.map(([i, l]) => `<button class="chip ${dows.has(i) ? 'on' : ''}" data-d="${i}">${l}</button>`).join('')}</div>
    <label class="lbl">Ejercicios · una línea cada uno: Bloque | Ejercicio | Series x reps | Plan de peso</label>
    <textarea id="rr" spellcheck="false" style="min-height:240px">${esc(r.rows.map(x => [x.block, x.name, x.sets, x.plan].join(' | ')).join('\n'))}</textarea>
    <button class="btn primary block" id="rok">Guardar</button>
    <div class="row2"><button class="btn" id="cl">Cancelar</button>${isNew ? '<span></span>' : '<button class="btn danger" id="rdel">Eliminar</button>'}</div>`);
  $('#rd', b).addEventListener('click', ev => { const c = ev.target.closest('.chip'); if (c) c.classList.toggle('on'); });
  $('#cl', b).onclick = closeSheet;
  $('#rok', b).onclick = () => {
    const name = $('#rn', b).value.trim();
    if (!name) return toast('Escribe un nombre');
    const oldIds = new Map(r.rows.map(x => [norm(x.block + '|' + x.name), x.id]));
    const rows = $('#rr', b).value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(c => c.some(Boolean))
      .map(c => c.length === 1 ? ['', c[0], '', ''] : [c[0] || '', c[1] || '', c[2] || '', c[3] || ''])
      .map(c => ({ id: oldIds.get(norm(c[0] + '|' + c[1])) || uid(), block: c[0], name: c[1], sets: c[2], plan: c[3] }));
    const out = { id: r.id || uid(), name, rows,
      dows: [...b.querySelectorAll('#rd .chip.on')].map(x => +x.dataset.d),
      strengthMin: num($('#rs', b).value), met: num($('#rm', b).value) || 5,
      cardioMin: num($('#rc', b).value), cardioSpeed: num($('#rv', b).value) || 5 };
    const i = state.routines.findIndex(x => x.id === out.id);
    if (i >= 0) state.routines[i] = out; else state.routines.push(out);
    save(); closeSheet(); render(); toast('Rutina guardada');
  };
  if (!isNew) $('#rdel', b).onclick = () => confirmSheet(`¿Eliminar la rutina "${r.name}"? Los días ya registrados conservan sus datos.`, 'Eliminar', () => {
    state.routines = state.routines.filter(x => x.id !== r.id); save(); closeSheet(); render(); toast('Rutina eliminada');
  }, () => openRoutineEditor(r.id));
}

/* Actividad extra del día (fútbol, pádel, caminar…): kcal netas = (MET − 1) × peso del día × horas,
   o las kcal de tu reloj si las indicas. */
function sheetActivity(act) {
  const key = ui.date, isNew = !act;
  const a = act || { id: null, name: 'Fútbol', min: 60, met: 7, kcalManual: 0, speed: 0 };
  let type = a.speed > 0 ? 'walk' : (SPORTS.some(s => s[0] === a.name) ? a.name : 'custom');
  if (isNew) type = 'Fútbol';
  const b = openSheet(`<h3>${isNew ? 'Añadir actividad' : 'Editar actividad'}</h3>
    <span class="sub">${esc(dateLabel(key))}</span>
    <label class="lbl">Actividad</label>
    <select id="at">${SPORTS.map(([n, m]) => `<option value="${esc(n)}" ${type === n ? 'selected' : ''}>${esc(n)} (MET ${plain(m)})</option>`).join('')}
      <option value="walk" ${type === 'walk' ? 'selected' : ''}>Caminar / correr (por velocidad)</option>
      <option value="custom" ${type === 'custom' ? 'selected' : ''}>Otra (indicar nombre y MET)</option></select>
    <div id="wWalk"><label class="lbl">Velocidad (km/h)</label><input id="asp" inputmode="decimal" value="${a.speed > 0 ? plain(a.speed) : '6'}"></div>
    <div id="wCustom" class="grid2"><div><label class="lbl">Nombre</label><input id="an" value="${esc(type === 'custom' ? a.name : '')}"></div>
      <div><label class="lbl">MET</label><input id="amet" inputmode="decimal" value="${plain(a.met || 5)}"></div></div>
    <label class="lbl">Duración (min)</label><input id="am" inputmode="decimal" value="${plain(a.min)}">
    <label class="lbl">kcal de tu reloj (opcional, sustituye al cálculo)</label>
    <input id="ak" inputmode="decimal" value="${num(a.kcalManual) > 0 ? plain(a.kcalManual) : ''}" placeholder="vacío = calcular">
    <div class="preview" id="ap"></div>
    <button class="btn primary block" id="aok">Guardar</button>
    <div class="row2"><button class="btn" id="cl">Cancelar</button>${isNew ? '<span></span>' : '<button class="btn danger" id="adel">Eliminar</button>'}</div>`);
  const sel = $('#at', b);
  const metNow = () => {
    const t = sel.value;
    if (t === 'walk') return metWalk(num($('#asp', b).value));
    if (t === 'custom') return num($('#amet', b).value);
    return SPORTS.find(s => s[0] === t)[1];
  };
  const calc = () => { const man = num($('#ak', b).value); return man > 0 ? man : netKcal(metNow(), weightAt(key), num($('#am', b).value)); };
  const upd = () => {
    $('#wWalk', b).style.display = sel.value === 'walk' ? '' : 'none';
    $('#wCustom', b).style.display = sel.value === 'custom' ? '' : 'none';
    const man = num($('#ak', b).value) > 0;
    $('#ap', b).innerHTML = `<b>≈ ${fmt(calc())} kcal</b>${man ? ' (valor de tu reloj)' : ` · MET ${fmt(metNow(), 1)} · peso ${fmt(weightAt(key), 1)} kg`}`;
  };
  b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
  $('#cl', b).onclick = closeSheet;
  $('#aok', b).onclick = () => {
    const min = num($('#am', b).value);
    if (!(min > 0)) return toast('Indica la duración');
    const t = sel.value; let name = t, speed = 0;
    if (t === 'walk') { speed = num($('#asp', b).value); if (!(speed > 0)) return toast('Indica la velocidad'); name = `Caminar/correr a ${plain(speed)} km/h`; }
    else if (t === 'custom') { name = $('#an', b).value.trim() || 'Actividad'; if (!(metNow() > 0)) return toast('Indica el MET'); }
    const obj = { id: a.id || uid(), name, min, met: metNow(), kcalManual: num($('#ak', b).value), speed };
    const d = ensureDay(key); d.activities = d.activities || [];
    const i = d.activities.findIndex(x => x.id === obj.id);
    if (i >= 0) d.activities[i] = obj; else d.activities.push(obj);
    save(); closeSheet(); render(); toast('Actividad guardada');
  };
  if (!isNew) $('#adel', b).onclick = () => {
    const d = ensureDay(key); d.activities = d.activities.filter(x => x.id !== a.id); save(); closeSheet(); render();
  };
}

/* Copiar comidas de otro día al día actual (se añaden a lo que ya haya) */
function sheetCopyDay() {
  let src = addDays(ui.date, -1);
  const b = openSheet(`<h3>Copiar de otro día</h3><span class="sub">Se añade a ${esc(dateLabel(ui.date))}</span>
    <label class="lbl">Copiar desde</label><input type="date" id="cd" value="${src}">
    <div id="cl2"></div>
    <button class="btn primary block" id="cok">Copiar</button><button class="btn block" id="cc">Cancelar</button>`);
  const draw = () => {
    const T = dayTotals(src), ents = (state.days[src] && state.days[src].entries) || {};
    $('#cl2', b).innerHTML = MEALS.map(m => { const n = (ents[m.id] || []).length;
      return `<label class="check"><input type="checkbox" data-m="${m.id}" ${n ? 'checked' : 'disabled'}><span>${m.icon} ${m.name}
        <span class="sub">${n} alimento(s) · ${fmt(T.meals[m.id].kcal)} kcal</span></span></label>`; }).join('');
  };
  $('#cd', b).addEventListener('change', e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { src = e.target.value; draw(); } });
  draw();
  $('#cc', b).onclick = closeSheet;
  $('#cok', b).onclick = () => {
    if (src === ui.date) return toast('Elige un día distinto');
    const sel = [...b.querySelectorAll('#cl2 input:checked')].map(x => x.dataset.m);
    if (!sel.length) return toast('No hay nada que copiar de ese día');
    const d = ensureDay(ui.date); let n = 0;
    sel.forEach(mid => (state.days[src].entries[mid] || []).forEach(e => {
      (d.entries[mid] = d.entries[mid] || []).push(Object.assign({}, e, { id: uid(), snap: e.snap ? Object.assign({}, e.snap) : e.snap })); n++;
    }));
    save(); closeSheet(); render(); toast(`Copiados ${n} alimentos`);
  };
}

/* Constructor de comidas guardadas */
let draft = null;
function openMealBuilder(meal) {
  draft = meal ? clone(meal) : { id: null, name: '', items: [] };
  renderBuilder();
}
function renderBuilder() {
  const t = mealTotals(draft);
  const b = openSheet(`<h3>${draft.id ? 'Editar comida' : 'Nueva comida guardada'}</h3>
    <label class="lbl">Nombre</label><input id="mn" value="${esc(draft.name)}" placeholder="Ej.: Bowl de arroz y pavo" autocomplete="off">
    <label class="lbl">Alimentos</label>
    <div>${draft.items.length ? draft.items.map((it, i) => {
      const f = foodById(it.foodId); if (!f) return '';
      return `<button class="entry" data-i="${i}"><span class="grow"><b>${esc(f.name)}</b><span class="sub">${esc(qtyText({ foodId: f.id, grams: it.grams }))}</span></span>
        <span class="kc">${fmt(macrosOf({ foodId: f.id, grams: it.grams }).kcal)} kcal</span></button>`;
    }).join('') : '<p class="empty">Aún no hay alimentos.</p>'}</div>
    <div class="preview"><b>${fmt(t.kcal)} kcal</b> · P ${fmt(t.p)} · G ${fmt(t.f)} · C ${fmt(t.c)} · Fibra ${fmt(t.fiber)}</div>
    <button class="btn block" id="madd">＋ Añadir alimento</button>
    <button class="btn primary block" id="msave">Guardar comida</button>
    <div class="row2"><button class="btn" id="mcancel">Cancelar</button>
    ${draft.id ? '<button class="btn danger" id="mdel">Eliminar</button>' : '<span></span>'}</div>`);
  const sync = () => { draft.name = $('#mn', b).value; };
  b.querySelectorAll('.entry').forEach(el => el.onclick = () => {
    sync();
    const i = +el.dataset.i, it = draft.items[i], f = foodById(it.foodId);
    sheetQty({ food: f, grams: it.grams, confirmLabel: 'Guardar',
      onOk: g => { it.grams = g; renderBuilder(); },
      onBack: renderBuilder,
      onDelete: () => { draft.items.splice(i, 1); renderBuilder(); } });
  });
  $('#madd', b).onclick = () => {
    sync();
    sheetPicker({ title: 'Añadir a la comida', onBack: renderBuilder,
      onPick: (food, g) => { draft.items.push({ foodId: food.id, grams: g }); renderBuilder(); } });
  };
  $('#mcancel', b).onclick = closeSheet;
  $('#msave', b).onclick = () => {
    sync();
    if (!draft.name.trim()) return toast('Escribe un nombre');
    if (!draft.items.length) return toast('Añade al menos un alimento');
    const m = { id: draft.id || uid(), name: draft.name.trim(), items: draft.items };
    const i = state.meals.findIndex(x => x.id === m.id);
    if (i >= 0) state.meals[i] = m; else state.meals.push(m);
    save(); closeSheet(); render(); toast('Comida guardada');
  };
  if (draft.id) $('#mdel', b).onclick = () => confirmSheet(`¿Eliminar la comida "${draft.name}"?`, 'Eliminar', () => {
    state.meals = state.meals.filter(x => x.id !== draft.id); save(); closeSheet(); render();
  }, renderBuilder);
}
window.__p = (window.__p || 0) + 1;   // marca: este archivo se cargó entero
