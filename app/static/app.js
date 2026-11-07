const $ = s => document.querySelector(s);
const canvas = new fabric.Canvas('c', {preserveObjectStacking: true, backgroundColor: '#ffffff'});
let W = 1080, H = 1080, designId = null, history = [], hIdx = -1, lock = false;
const PALETTE = ['#ffffff', '#16181d', '#2f3bff', '#ff5a36', '#ffd23f', '#1fb68a', '#f3e9dc', '#e8d5ff'];

const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); };

/* ---- sizing: logical size stays W×H, view is scaled to fit ---- */
function fit() {
  const s = Math.min(($('#stage').clientWidth - 56) / W, ($('#stage').clientHeight - 56) / H, 1);
  canvas.setDimensions({width: W * s, height: H * s}, {cssOnly: false});
  canvas.setZoom(s);
  canvas.requestRenderAll();
}
function setSize(w, h) { W = w; H = h; fit(); }
window.addEventListener('resize', fit);
$('#size').onchange = e => { const [w, h] = e.target.value.split('x').map(Number); setSize(w, h); snapshot(); };

/* ---- history ---- */
const state = () => JSON.stringify(canvas.toJSON(['id']));
function snapshot() {
  if (lock) return;
  history = history.slice(0, hIdx + 1); history.push(state()); hIdx = history.length - 1;
}
function restore(i) {
  if (i < 0 || i >= history.length) return;
  lock = true; hIdx = i;
  canvas.loadFromJSON(history[i], () => { canvas.renderAll(); lock = false; sync(); });
}
$('#undo').onclick = () => restore(hIdx - 1);
$('#redo').onclick = () => restore(hIdx + 1);
['object:added', 'object:modified', 'object:removed'].forEach(e => canvas.on(e, snapshot));

/* ---- adding objects ---- */
const center = o => { o.set({left: W / 2, top: H / 2, originX: 'center', originY: 'center'}); return o; };
function add(kind) {
  let o;
  if (kind === 'headline') o = new fabric.Textbox('Your headline here', {width: W * .8, fontSize: Math.round(W / 11), fontFamily: 'Fraunces', fontWeight: '800', fill: '#16181d', textAlign: 'center'});
  if (kind === 'body') o = new fabric.Textbox('Add a short supporting line.', {width: W * .7, fontSize: Math.round(W / 26), fontFamily: 'Archivo', fill: '#16181d', textAlign: 'center'});
  if (kind === 'rect') o = new fabric.Rect({width: W * .5, height: H * .25, fill: '#2f3bff', rx: 12, ry: 12});
  if (kind === 'circle') o = new fabric.Circle({radius: W * .15, fill: '#ff5a36'});
  if (kind === 'line') o = new fabric.Rect({width: W * .4, height: 8, fill: '#16181d'});
  canvas.add(center(o)); canvas.setActiveObject(o); canvas.requestRenderAll();
}
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => add(b.dataset.add));

$('#file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const fd = new FormData(); fd.append('file', f);
  const r = await fetch('/api/upload', {method: 'POST', body: fd}); const j = await r.json();
  if (!r.ok) return toast(j.error);
  fabric.Image.fromURL(j.url, img => {
    img.scaleToWidth(Math.min(W * .8, img.width)); canvas.add(center(img)); canvas.setActiveObject(img);
  }, {crossOrigin: 'anonymous'});
  e.target.value = '';
};

/* ---- background ---- */
$('#bgSwatches').innerHTML = PALETTE.map(c => `<i tabindex="0" style="background:${c}" data-c="${c}" aria-label="${c}"></i>`).join('');
const setBg = c => { canvas.setBackgroundColor(c, () => { canvas.renderAll(); snapshot(); }); $('#bg').value = c; };
$('#bgSwatches').onclick = e => e.target.dataset.c && setBg(e.target.dataset.c);
$('#bg').onchange = e => setBg(e.target.value);

/* ---- properties panel ---- */
const active = () => canvas.getActiveObject();
const isText = o => o && o.type === 'textbox';
function sync() {
  const o = active(); $('#props').hidden = !o; if (!o) return;
  $('#textProps').style.display = isText(o) ? '' : 'none';
  $('#fill').value = typeof o.fill === 'string' && o.fill.startsWith('#') ? o.fill : '#000000';
  $('#opacity').value = o.opacity;
  if (isText(o)) { $('#font').value = o.fontFamily; $('#fsize').value = Math.round(o.fontSize * (o.scaleY || 1)); }
}
['selection:created', 'selection:updated', 'selection:cleared'].forEach(e => canvas.on(e, sync));
const edit = (k, v) => { const o = active(); if (!o) return; o.set(k, v); canvas.requestRenderAll(); snapshot(); };
$('#fill').oninput = e => edit('fill', e.target.value);
$('#opacity').oninput = e => edit('opacity', +e.target.value);
$('#font').onchange = e => edit('fontFamily', e.target.value);
$('#fsize').onchange = e => { const o = active(); o.set({fontSize: +e.target.value, scaleX: 1, scaleY: 1}); canvas.requestRenderAll(); snapshot(); };
$('#bold').onclick = () => { const o = active(); if (isText(o)) edit('fontWeight', o.fontWeight === '800' ? 'normal' : '800'); };
$('#italic').onclick = () => { const o = active(); if (isText(o)) edit('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic'); };
document.querySelectorAll('[data-align]').forEach(b => b.onclick = () => isText(active()) && edit('textAlign', b.dataset.align));
$('#front').onclick = () => { active()?.bringForward(); canvas.requestRenderAll(); snapshot(); };
$('#back').onclick = () => { active()?.sendBackwards(); canvas.requestRenderAll(); snapshot(); };
$('#del').onclick = () => { const o = active(); if (o) { canvas.remove(o); canvas.discardActiveObject(); } };
$('#dup').onclick = () => active()?.clone(c => { c.set({left: c.left + 30, top: c.top + 30}); canvas.add(c); canvas.setActiveObject(c); });

document.addEventListener('keydown', e => {
  if (e.target.matches('input,select') || active()?.isEditing) return;
  const k = e.key.toLowerCase();
  if (k === 'delete' || k === 'backspace') $('#del').click();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); restore(hIdx + (e.shiftKey ? 1 : -1)); }
  if ((e.ctrlKey || e.metaKey) && k === 'y') restore(hIdx + 1);
  if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); $('#dup').click(); }
});

/* ---- export: render at full logical resolution ---- */
$('#export').onclick = () => {
  canvas.discardActiveObject(); canvas.renderAll();
  const url = canvas.toDataURL({format: 'png', multiplier: 1 / canvas.getZoom()});
  const a = document.createElement('a'); a.href = url; a.download = ($('#name').value || 'post') + '.png'; a.click();
};

/* ---- save / load ---- */
async function refreshList() {
  const list = await (await fetch('/api/designs')).json();
  $('#designs').innerHTML = list.map(d => `<li><button data-open="${d.id}" title="${d.name}">${d.name}</button><button data-rm="${d.id}" aria-label="Delete ${d.name}">×</button></li>`).join('') || '<li>Nothing saved yet.</li>';
}
$('#save').onclick = async () => {
  canvas.discardActiveObject();
  const r = await fetch('/api/designs', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id: designId, name: $('#name').value, width: W, height: H, data: JSON.parse(state())})});
  designId = (await r.json()).id; toast('Saved'); refreshList();
};
$('#designs').onclick = async e => {
  const open = e.target.dataset.open, rm = e.target.dataset.rm;
  if (open) {
    const d = await (await fetch('/api/designs/' + open)).json();
    designId = d.id; $('#name').value = d.name; $('#size').value = d.width + 'x' + d.height; setSize(d.width, d.height);
    lock = true; canvas.loadFromJSON(d.data, () => { lock = false; canvas.renderAll(); history = []; hIdx = -1; snapshot(); sync(); });
  }
  if (rm && confirm('Delete this design?')) { await fetch('/api/designs/' + rm, {method: 'DELETE'}); if (rm === designId) designId = null; refreshList(); }
};
$('#new').onclick = () => { designId = null; $('#name').value = 'Untitled post'; canvas.clear(); setBg('#ffffff'); history = []; hIdx = -1; snapshot(); };

fit(); snapshot(); refreshList(); add('headline');
