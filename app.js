'use strict';
/* ---------- 6. Eventos ---------- */
function applyTheme() {
  let t = state.theme || 'auto';
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  $('meta[name=theme-color]').setAttribute('content', bg || '#0f1115');
}
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); }); } catch (e) {}
$('#themeBtn').onclick = () => {
  state.theme = { auto: 'dark', dark: 'light', light: 'auto' }[state.theme || 'auto'];
  save(); applyTheme(); render(); toast('Tema: ' + { auto: 'automático', dark: 'oscuro', light: 'claro' }[state.theme]);
};

/* Genera el JSON de la copia y anota la fecha (dentro de la propia copia) */
function backupText() {
  state.lastExport = today(); save();
  return JSON.stringify({ app: 'kcal-macros', version: 2, exported: new Date().toISOString(), data: state }, null, 2);
}
function exportData() {
  const blob = new Blob([backupText()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `kcal-copia-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Copia descargada'); render();
}
/* Compartir la copia con el menú del móvil (Drive, WhatsApp, correo…); si no se puede, se descarga */
async function shareBackup() {
  const prev = state.lastExport, text = backupText();
  for (const type of ['application/json', 'text/plain']) {
    const file = new File([text], `kcal-copia-${today()}.json`, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Copia de seguridad · Calorías y macros' }); toast('Copia compartida'); render(); return; }
      catch (e) { if (e && e.name === 'AbortError') { state.lastExport = prev; save(); return; } }
    }
  }
  exportData();
}
function backupBannerHTML() {
  const last = state.lastExport || state.created || today();
  const days = Math.floor((parseKey(today()) - parseKey(last)) / 864e5);
  if (days < 14 || (state.snooze && state.snooze > today())) return '';
  return `<section class="card" style="border-color:var(--warn)"><b>💾 Haz una copia de seguridad</b>
    <span class="sub">${state.lastExport ? `Hace ${days} días de tu última copia.` : `Aún no has hecho ninguna copia (usas la app desde hace ${days} días).`}
    Si borras los datos del navegador o cambias de móvil, se pierden.</span>
    <div class="row2"><button class="btn primary sm" data-a="shareBackup">Compartir copia</button><button class="btn sm" data-a="snooze">Más tarde</button></div></section>`;
}
function importData(text) {
  let obj; try { obj = JSON.parse(text); } catch (e) { return toast('El archivo no es un JSON válido'); }
  const data = obj && obj.data ? obj.data : obj;
  if (!data || typeof data !== 'object' || !Array.isArray(data.foods) || typeof data.days !== 'object' || !data.days)
    return toast('No parece una copia de esta app');
  confirmSheet(`Se reemplazarán tus datos actuales por la copia: ${data.foods.length} alimentos, ${Object.keys(data.days).length} días y ${(data.weights || []).length} pesos. ¿Continuar?`,
    'Importar copia', () => { state = normalize(data); save(); applyTheme(); closeSheet(); render(); toast('Copia importada'); }, null, false);
}

function curValue(path) {
  if (path[0] === 'plog') return profileAt(today())[path[1]];
  if (path[0] === 'weight') return weightAt(today());
  return getPath(path);
}
function setWeightToday(kg) {
  const t = today(), w = state.weights.find(x => x.date === t);
  if (w) w.kg = kg; else state.weights.push({ date: t, kg });
}
function setSetting(t) {
  const path = t.dataset.set.split('.');
  let v = t.value;
  if (t.dataset.num) {
    v = num(v);
    const min = t.dataset.min !== undefined ? parseFloat(t.dataset.min) : 0;
    if (v < min || (t.value.trim() === '')) { toast('Valor no válido'); t.value = plain(curValue(path)); return; }
  }
  if (t.dataset.set === 'profile.birth') {                       // fecha de nacimiento: dato fijo, no necesita historial
    if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > today() || v < '1900-01-01')) { toast('Fecha no válida'); t.value = state.profile.birth || ''; return; }
    state.profile.birth = v; save(); render(); toast(v ? `Edad calculada: ${ageAt(today())} años` : 'Fecha borrada'); return;
  }
  if (path[0] === 'plog') setProfileField(path[1], v);          // perfil con fecha: solo afecta de hoy en adelante
  else if (path[0] === 'weight') setWeightToday(v);             // peso actual = registro de peso de hoy
  else { let o = state; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = v; }
  save();
  if (t.dataset.set === 'theme') { applyTheme(); render(); return; }
  const n = $('#calcNote'); if (n) n.innerHTML = calcNote();
  toast(path[0] === 'plog' || path[0] === 'weight' ? 'Guardado desde hoy' : 'Guardado');
}
/* Cambio de un campo del entrenamiento del día: se guarda sin repintar todo (no cierra el teclado) */
function onSessionField(t) {
  const s = ensureSession(ui.date), f = t.dataset.ses;
  if (f === 'routineId') {
    const r = routineById(t.value);
    s.routineId = r ? r.id : null;
    if (r) { s.strengthMin = r.strengthMin; s.met = r.met; s.cardioMin = r.cardioMin; s.cardioSpeed = r.cardioSpeed; }
    save(); render(); return;
  }
  if (f === 'met') s.met = num(t.value) || 5;
  else {
    const v = num(t.value);
    if (t.value.trim() === '' || v < 0) { toast('Valor no válido'); t.value = plain(num(s[f])); return; }
    s[f] = v;
  }
  save(); refreshTraining();
}
function refreshTraining() {
  const k = ui.date;
  const s = $('#sumCard'); if (s) s.outerHTML = summaryHTML(k);
  const a = $('#trainKcal'); if (a) a.innerHTML = trainKcalText(k);
  const b = $('#trainSub'); if (b) b.textContent = trainSub(k);
}
const getPath = p => p.reduce((o, k) => o[k], state);

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id, meal = el.dataset.meal;
  switch (a) {
    case 'tab': ui.tab = el.dataset.t; render(); break;
    case 'dprev': ui.date = addDays(ui.date, -1); render(); break;
    case 'dnext': ui.date = addDays(ui.date, 1); render(); break;
    case 'dtoday': ui.date = today(); render(); break;
    case 'alc': { const d = ensureDay(ui.date); d.alcohol = Math.max(0, (d.alcohol || 0) + num(el.dataset.d)); save(); render(); break; }
    case 'addFood':
      sheetPicker({ title: 'Añadir a ' + MEALS.find(m => m.id === meal).name,
        onPick: (food, g) => { addEntry(ui.date, meal, food, g); save(); closeSheet(); render(); toast('Añadido: ' + food.name); } });
      break;
    case 'editEntry': {
      const list = state.days[ui.date].entries[meal], i = list.findIndex(e => e.id === id), e = list[i], f = foodOf(e);
      if (!f) { list.splice(i, 1); save(); render(); break; }
      sheetQty({ food: f, grams: e.grams, confirmLabel: 'Guardar',
        onOk: g => { e.grams = g; save(); closeSheet(); render(); },
        onDelete: () => { list.splice(i, 1); save(); closeSheet(); render(); toast('Eliminado') } });
      break;
    }
    case 'useSaved': {
      if (!state.meals.length) {
        const b = openSheet(`<h3>Comidas guardadas</h3><p class="empty">Aún no tienes ninguna.</p>
          <button class="btn primary block" id="mk">Crear una comida</button><button class="btn block" id="cl">Cerrar</button>`);
        $('#mk', b).onclick = () => { ui.tab = 'meals'; closeSheet(); render(); };
        $('#cl', b).onclick = closeSheet; break;
      }
      const b = openSheet(`<h3>Añadir a ${esc(MEALS.find(m => m.id === meal).name)}</h3><span class="sub">Ración</span>${multBar()}
        <div class="list" id="mlist"></div><button class="btn block" id="cl">Cerrar</button>`);
      const draw = (k = 1) => { $('#mlist', b).innerHTML = state.meals.map(m => { const t = mealTotals(m);
        return `<button class="item" data-id="${m.id}"><span class="grow"><b>${esc(m.name)}</b><span class="sub">${macroLine({ p: t.p * k, f: t.f * k, c: t.c * k, fiber: t.fiber * k })}</span></span><b>${fmt(t.kcal * k)} kcal</b></button>`; }).join(''); };
      const getM = bindMult(b, draw); draw();
      $('#mlist', b).onclick = e2 => {
        const it = e2.target.closest('.item'); if (!it) return;
        const m = state.meals.find(x => x.id === it.dataset.id), k = getM(); closeSheet(); addMealToDay(m, meal, ui.date, k);
      };
      $('#cl', b).onclick = closeSheet; break;
    }
    case 'saveBlock': {
      const list = (state.days[ui.date].entries[meal] || []).filter(e => foodById(e.foodId));
      if (!list.length) break;
      const b = openSheet(`<h3>Guardar como comida</h3><span class="sub">${list.length} alimento(s) de ${esc(MEALS.find(m => m.id === meal).name)}</span>
        <label class="lbl">Nombre</label><input id="sn" placeholder="Ej.: Desayuno de siempre" autocomplete="off">
        <button class="btn primary block" id="sok">Guardar</button><button class="btn block" id="cl">Cancelar</button>`);
      $('#sok', b).onclick = () => {
        const name = $('#sn', b).value.trim(); if (!name) return toast('Escribe un nombre');
        state.meals.push({ id: uid(), name, items: list.map(e => ({ foodId: e.foodId, grams: e.grams })) });
        save(); closeSheet(); render(); toast('Comida guardada');
      };
      $('#cl', b).onclick = closeSheet; break;
    }
    case 'editRoutine': openRoutineEditor(id); break;
    case 'newRoutine': openRoutineEditor(null); break;
    case 'addAct': sheetActivity(null); break;
    case 'editAct': sheetActivity(((state.days[ui.date] || {}).activities || []).find(x => x.id === id)); break;
    case 'copyLast': {
      const s = ensureSession(ui.date), r = routineById(s.routineId); if (!r) break;
      let n = 0;
      r.rows.forEach(row => { if (!s.kg[row.id]) { const v = lastKg(r.id, row.id, ui.date); if (v) { s.kg[row.id] = v; n++; } } });
      save(); render(); toast(n ? `Copiados ${n} pesos de la última vez` : 'No hay pesos anteriores que copiar'); break;
    }
    case 'ffilter': ui.foodFilter = el.dataset.v; render(); break;
    case 'newFood': openFoodForm(null); break;
    case 'onlineFood': sheetOnline({ onDone: () => closeSheet() }); break;
    case 'editFood': openFoodForm(foodById(id)); break;
    case 'newMeal': openMealBuilder(null); break;
    case 'editMeal': openMealBuilder(state.meals.find(m => m.id === id)); break;
    case 'useMeal': {
      const m = state.meals.find(x => x.id === id);
      const b = openSheet(`<h3>Añadir "${esc(m.name)}"</h3><span class="sub">${esc(dateLabel(ui.date))} · ración</span>${multBar()}
        ${MEALS.map(x => `<button class="btn block" data-b="${x.id}">${x.icon} ${x.name}</button>`).join('')}
        <button class="btn block" id="cl" style="margin-top:16px">Cancelar</button>`);
      const getM = bindMult(b);
      b.onclick = e2 => { const t = e2.target.closest('[data-b]'); if (t) { const k = getM(); closeSheet(); addMealToDay(m, t.dataset.b, ui.date, k); } };
      $('#cl', b).onclick = closeSheet; break;
    }
    case 'wprev': ui.weekRef = addDays(mondayOf(ui.weekRef), -7); render(); break;
    case 'wnext': ui.weekRef = addDays(mondayOf(ui.weekRef), 7); render(); break;
    case 'inclToday': ui.inclToday = !ui.inclToday; render(); break;
    case 'wrange': ui.wRange = num(el.dataset.v); render(); break;
    case 'wsave': {
      const date = $('#wDate').value, kg = num($('#wKg').value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Elige una fecha');
      if (!(kg >= 20 && kg <= 400)) return toast('Indica un peso válido en kg');
      const w = state.weights.find(x => x.date === date);
      if (w) w.kg = kg; else state.weights.push({ date, kg });
      save(); render(); toast('Peso guardado'); break;
    }
    case 'wdel': confirmSheet(`¿Borrar el peso del ${el.dataset.d.split('-').reverse().join('/')}?`, 'Borrar', () => {
      state.weights = state.weights.filter(x => x.date !== el.dataset.d); save(); closeSheet(); render(); }); break;
    case 'export': exportData(); break;
    case 'shareBackup': shareBackup(); break;
    case 'snooze': state.snooze = addDays(today(), 3); save(); render(); toast('Te lo recordaré en 3 días'); break;
    case 'copyDay': sheetCopyDay(); break;
    case 'catAdd': { const f = addCatalog(+el.dataset.i); render(); toast('Añadido a tu base: ' + f.name); break; }
    case 'scanFood': sheetScan({ onDone: () => closeSheet() }); break;
    case 'import': $('#fileIn').click(); break;
    case 'reset': confirmSheet('Se borrarán alimentos, comidas, diario y pesos de este móvil. Esta acción no se puede deshacer. ¿Has exportado una copia?', 'Borrar todo', () => {
      state = defaults(); save(); applyTheme(); closeSheet(); render(); toast('Datos restablecidos'); }); break;
  }
});
document.addEventListener('change', ev => {
  const t = ev.target, ds = t.dataset;
  if (ds.a === 'train') { ensureDay(ui.date).train = t.checked; if (t.checked) ensureSession(ui.date); save(); render(); }
  else if (ds.ses) onSessionField(t);
  else if (ds.kg) { const s = ensureSession(ui.date); s.kg[ds.kg] = t.value.trim(); save(); }
  else if (t.id === 'dateIn') { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { ui.date = t.value; render(); } }
  else if (t.id === 'exSel') { ui.exId = t.value; render(); }
  else if (ds.set) setSetting(t);
  else if (t.id === 'fileIn') {
    const f = t.files[0]; t.value = ''; if (!f) return;
    const rd = new FileReader(); rd.onload = () => importData(String(rd.result)); rd.readAsText(f);
  }
});
/* Buscador de la pestaña Alimentos: solo repinta la lista para conservar el teclado */
document.addEventListener('input', ev => {
  if (ev.target.id !== 'foodQ') return;
  ui.foodQ = ev.target.value;
  const t = norm(ui.foodQ.trim());
  const arr = state.foods.filter(f => (!t || norm(f.name).includes(t)) && (ui.foodFilter === 'all' || f.approx))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  $('#foodList').innerHTML = foodListHTML(arr, ui.foodQ);
});
/* Recuerda si los <details> están abiertos entre repintados */
document.addEventListener('toggle', ev => { const k = ev.target.dataset && ev.target.dataset.keep; if (k) ui[k] = ev.target.open; }, true);

/* ---------- 7. Arranque, offline e instalación ---------- */
function updateSwState() {
  const el = $('#swState'); if (!el) return;
  const online = navigator.onLine ? 'con conexión' : 'sin conexión';
  if (!('serviceWorker' in navigator)) { el.textContent = `Versión v14 · Estado: ${online}. Este navegador no admite modo offline.`; return; }
  navigator.serviceWorker.getRegistration().then(r => {
    el.textContent = `Versión v14 · Estado: ${online}. Modo offline: ${r && r.active ? 'activo ✓' : 'se activará tras la primera carga'}.`;
  }).catch(() => { el.textContent = `Versión v14 · Estado: ${online}.`; });
}
window.addEventListener('online', updateSwState); window.addEventListener('offline', updateSwState);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(updateSwState).catch(() => {}));
}
/* Pide al navegador que no borre los datos por falta de espacio */
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

applyTheme();
render();
/* Lo opcional va al final y protegido: si algo de aquí falla, la app ya está pintada y funciona igual */
try { welcomeScreen(); } catch (e) { try { state.onboarded = true; save(); } catch (e2) {} }
window.__p = (window.__p || 0) + 1;   // marca: este archivo se cargó entero
