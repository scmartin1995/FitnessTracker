import { DB } from './db.js';

// Simple state
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Tabs
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $('#tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ===== Timer =====
let timer = { remaining: 0, running: false, handle: null, startAt: 0 };
const screen = $('#timerScreen');
const soundEnabled = $('#soundEnabled');

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2,'0');
  const s = Math.floor(sec % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function beep() {
  if (!soundEnabled.checked) return;
  // WebAudio beep
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = 880;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  g.gain.setValueAtTime(0.001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  o.stop(ctx.currentTime + 0.45);
}

function tick() {
  if (!timer.running) return;
  const now = Date.now();
  const elapsed = Math.floor((now - timer.startAt) / 1000);
  const left = Math.max(0, timer.remaining - elapsed);
  screen.textContent = fmt(left);
  if (left <= 0) {
    clearInterval(timer.handle);
    timer.running = false;
    beep();
  }
}

function startTimer(seconds) {
  timer.remaining = seconds;
  timer.startAt = Date.now();
  timer.running = true;
  clearInterval(timer.handle);
  timer.handle = setInterval(tick, 250);
  tick();
}

$$('.preset').forEach(b => b.addEventListener('click', () => {
  startTimer(Number(b.dataset.sec));
}));

$('#btnStart').addEventListener('click', () => {
  const custom = Number($('#customSec').value || 0);
  const current = screen.textContent.split(':').reduce((m,s)=>Number(m)*60+Number(s));
  const toStart = custom > 0 ? custom : (current > 0 ? current : 60);
  startTimer(toStart);
});
$('#btnPause').addEventListener('click', () => {
  if (!timer.running) return;
  const now = Date.now();
  const elapsed = Math.floor((now - timer.startAt) / 1000);
  timer.remaining = Math.max(0, timer.remaining - elapsed);
  timer.running = false;
  clearInterval(timer.handle);
});
$('#btnReset').addEventListener('click', () => {
  timer.running = false;
  clearInterval(timer.handle);
  timer.remaining = 0;
  screen.textContent = '00:00';
});

// ===== Programs, Weeks, Days, Exercises =====
async function refreshProgramSelectors() {
  const programs = await DB.all('programs');
  const selProgram = $('#selProgram');
  selProgram.innerHTML = programs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  await refreshWeeks();
}

async function refreshWeeks() {
  const programId = $('#selProgram').value;
  const weeks = programId ? await DB.indexGetAll('weeks','by_program', programId) : [];
  $('#selWeek').innerHTML = weeks.map(w => `<option value="${w.id}">${w.label}</option>`).join('');
  await refreshDays();
  renderWeeksList(weeks);
}

async function refreshDays() {
  const weekId = $('#selWeek').value;
  const days = weekId ? await DB.indexGetAll('days','by_week', weekId) : [];
  $('#selDay').innerHTML = days.map(d => `<option value="${d.id}">${d.label}</option>`).join('');
  renderDaysList(days);
  renderDayExercises();
  renderSessionExercisePicker(days);
}

function renderWeeksList(weeks) {
  const el = $('#weeksList');
  if (!weeks.length) return el.innerHTML = `<p class="small">No weeks yet.</p>`;
  el.innerHTML = weeks.map(w => `<div class="list-item"><div>${w.label}</div><div class="small">order ${w.order ?? 0}</div></div>`).join('');
}

function renderDaysList(days) {
  const el = $('#daysList');
  if (!days.length) return el.innerHTML = `<p class="small">No days yet.</p>`;
  el.innerHTML = days.map(d => `<div class="list-item"><div>${d.label}</div><div class="small">${(d.exerciseIds||[]).length} exercises</div></div>`).join('');
}

async function renderExerciseLibrary() {
  const lib = await DB.all('exercises');
  const el = $('#exerciseLibrary');
  if (!lib.length) return el.innerHTML = `<p class="small">No exercises in library.</p>`;
  el.innerHTML = lib.map(x => `<div class="list-item">
    <div>
      <div>${x.name} ${x.notes ? `<span class="badge">notes</span>`:''}</div>
      <div class="small">${x.notes || ''}</div>
    </div>
    <button data-ex="${x.id}" class="ghost add-to-day">Add to Day</button>
  </div>`).join('');
  $$('.add-to-day').forEach(b => b.addEventListener('click', async () => {
    const dayId = $('#selDay').value;
    if (!dayId) return alert('Select a Day first.');
    const day = await DB.get('days', dayId);
    day.exerciseIds = day.exerciseIds || [];
    if (!day.exerciseIds.includes(b.dataset.ex)) day.exerciseIds.push(b.dataset.ex);
    await DB.put('days', day);
    renderDayExercises();
    renderSessionExercisePicker([day]);
  }));
}

async function renderDayExercises() {
  const dayId = $('#selDay').value;
  const wrap = $('#dayExercises');
  if (!dayId) return wrap.innerHTML = `<p class="small">Select a Day.</p>`;
  const day = await DB.get('days', dayId);
  const lib = await DB.all('exercises');
  const arr = (day.exerciseIds || []).map(id => lib.find(x=>x.id===id)).filter(Boolean);
  if (!arr.length) return wrap.innerHTML = `<p class="small">No exercises in this day.</p>`;
  wrap.innerHTML = arr.map(x => `<div class="list-item">
     <div>
       <div>${x.name}</div>
       <div class="small">${x.notes||''}</div>
     </div>
     <button class="ghost remove-ex" data-id="${x.id}">Remove</button>
  </div>`).join('');
  $$('.remove-ex').forEach(b => b.addEventListener('click', async () => {
    const day = await DB.get('days', dayId);
    day.exerciseIds = (day.exerciseIds || []).filter(id => id !== b.dataset.id);
    await DB.put('days', day);
    renderDayExercises();
  }));
}

async function renderSessionExercisePicker(days) {
  const dayId = $('#selDay').value;
  if (!dayId) return $('#sessionExercisePicker').innerHTML = '';
  const day = await DB.get('days', dayId);
  const lib = await DB.all('exercises');
  const arr = (day.exerciseIds || []).map(id => lib.find(x=>x.id===id)).filter(Boolean);
  const options = arr.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
  $('#sessionExercisePicker').innerHTML = `
    <div class="grid g3">
      <select id="selSessionExercise">${options}</select>
      <input id="inpReps" type="number" min="1" placeholder="Reps"/>
      <input id="inpWeight" type="number" min="0" step="0.5" placeholder="Weight"/>
    </div>
    <div class="grid g3">
      <button id="btnAddSet" class="secondary">+ Add Set</button>
      <div id="lastWeightHint" class="small"></div>
    </div>
    <div id="setsTable"></div>
  `;
  $('#btnAddSet').addEventListener('click', addSetToSession);
  $('#selSessionExercise').addEventListener('change', showLastWeightHint);
  showLastWeightHint();
  renderSessionSetsTable();
}

async function showLastWeightHint() {
  const exId = $('#selSessionExercise')?.value;
  if (!exId) return;
  const last = await DB.get('lastWeight', exId);
  let msg = 'No history yet.';
  if (last && typeof last.weight === 'number') {
    const suggestion = Math.round((last.weight * 1.025)*100)/100; // +2.5%
    msg = `Last: ${last.weight}. Suggested next: ${suggestion}`;
  }
  $('#lastWeightHint').textContent = msg;
}

let currentSession = { id: null, sets: [] };

function ensureSession() {
  if (!currentSession.id) {
    currentSession.id = DB.uid('sess');
    currentSession.dateISO = new Date().toISOString();
    currentSession.programId = $('#selProgram').value || null;
    currentSession.weekId = $('#selWeek').value || null;
    currentSession.dayId = $('#selDay').value || null;
  }
}

async function addSetToSession() {
  ensureSession();
  const exId = $('#selSessionExercise').value;
  const reps = Number($('#inpReps').value);
  const weight = Number($('#inpWeight').value);
  if (!exId || !reps) return alert('Choose exercise and reps.');
  const set = { id: DB.uid('set'), sessionId: currentSession.id, exerciseId: exId, reps, weight, timestamp: Date.now() };
  currentSession.sets.push(set);
  await DB.put('sets', set);
  // update lastWeight
  if (!isNaN(weight) && weight>0) {
    await DB.put('lastWeight', { exerciseId: exId, weight });
  }
  $('#inpReps').value = '';
  $('#inpWeight').value = '';
  renderSessionSetsTable();
  showLastWeightHint();
}

async function renderSessionSetsTable() {
  const sets = currentSession.sets;
  if (!sets.length) return $('#setsTable').innerHTML = '';
  const lib = await DB.all('exercises');
  const rows = await Promise.all(sets.map(async s => {
    const ex = lib.find(e=>e.id===s.exerciseId);
    return `<tr><td>${new Date(s.timestamp).toLocaleTimeString()}</td><td>${ex?.name||''}</td><td>${s.reps}</td><td>${s.weight||0}</td></tr>`;
  }));
  $('#setsTable').innerHTML = `
    <table>
      <thead><tr><th>Time</th><th>Exercise</th><th>Reps</th><th>Weight</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

$('#btnSaveSession').addEventListener('click', async () => {
  if (!currentSession.id) return alert('No sets yet.');
  await DB.put('sessions', { id: currentSession.id, dateISO: currentSession.dateISO, programId: currentSession.programId, weekId: currentSession.weekId, dayId: currentSession.dayId });
  alert('Session saved!');
  currentSession = { id:null, sets:[] };
  renderSessionSetsTable();
});

// Create Program
$('#btnCreateProgram').addEventListener('click', async () => {
  const name = $('#programName').value.trim() || 'New Program';
  const notes = $('#programNotes').value.trim();
  const p = { id: DB.uid('prog'), name, notes, createdAt: Date.now() };
  await DB.add('programs', p);
  $('#programName').value = '';
  $('#programNotes').value = '';
  await refreshProgramSelectors();
});

$('#btnRenameProgram').addEventListener('click', async () => {
  const id = $('#selProgram').value;
  if (!id) return alert('Select a program first.');
  const p = await DB.get('programs', id);
  const name = prompt('Rename program', p.name);
  if (!name) return;
  p.name = name;
  await DB.put('programs', p);
  await refreshProgramSelectors();
});

$('#btnDeleteProgram').addEventListener('click', async () => {
  const id = $('#selProgram').value;
  if (!id) return;
  if (!confirm('Delete program and its weeks/days?')) return;
  const weeks = await DB.indexGetAll('weeks','by_program', id);
  for (const w of weeks) {
    const days = await DB.indexGetAll('days','by_week', w.id);
    for (const d of days) await DB.del('days', d.id);
    await DB.del('weeks', w.id);
  }
  await DB.del('programs', id);
  await refreshProgramSelectors();
});

// Weeks
$('#btnAddWeek').addEventListener('click', async () => {
  const programId = $('#selProgram').value;
  if (!programId) return alert('Create/select a program first.');
  const label = $('#weekLabel').value.trim() || 'Week';
  const week = { id: DB.uid('week'), programId, label, order: Date.now() };
  await DB.add('weeks', week);
  $('#weekLabel').value='';
  await refreshWeeks();
});

// Days
$('#btnAddDay').addEventListener('click', async () => {
  const weekId = $('#selWeek').value;
  if (!weekId) return alert('Create/select a week first.');
  const label = $('#dayLabel').value.trim() || 'Day';
  const day = { id: DB.uid('day'), weekId, label, order: Date.now(), exerciseIds: [] };
  await DB.add('days', day);
  $('#dayLabel').value='';
  await refreshDays();
});

// Exercises
$('#btnAddExercise').addEventListener('click', async () => {
  const name = $('#exName').value.trim();
  if (!name) return;
  const notes = $('#exNotes').value.trim();
  const ex = { id: DB.uid('ex'), name, notes };
  await DB.add('exercises', ex);
  $('#exName').value='';
  $('#exNotes').value='';
  renderExerciseLibrary();
});

$('#btnAddExerciseToDay')?.addEventListener('click', () => {
  // scroll to library
  document.getElementById('tab-programs').scrollIntoView({behavior:'smooth'});
});

// Export / Import
$('#btnExport').addEventListener('click', async () => {
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'fitness-app-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

$('#btnImport').addEventListener('click', async () => {
  const f = $('#importFile').files?.[0];
  if (!f) return;
  const text = await f.text();
  try {
    const json = JSON.parse(text);
    await DB.importAll(json);
    alert('Import complete.');
    await refreshProgramSelectors();
    renderExerciseLibrary();
  } catch (e) {
    alert('Import failed: ' + e.message);
  }
});

// Initial load
(async function init() {
  await DB.all('programs'); // ensure DB open
  await refreshProgramSelectors();
  renderExerciseLibrary();
})();
