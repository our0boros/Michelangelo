import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { StoneGrid } from './grid.js';
import { StoneMesh } from './stoneMesh.js';
import { createMarbleMaterial } from './marble.js';
import { Workshop } from './scene.js';
import { TOOLS, FORCES, toolRadius } from './tools.js';
import { strike, assessStrike } from './fracture.js';
import { baseline, measure, appraise, isRuined, tolerance } from './scoring.js';
import { buildDraft, drawDraft } from './sketch.js';
import { mulberry32 } from './noise.js';
import { sfx, setVolume } from './audio.js';
import * as ui from './ui.js';

const canvas = document.getElementById('view');
const sketchCtx = document.getElementById('sketch').getContext('2d');
const shop = new Workshop(canvas);
const debrisMat = createMarbleMaterial({ veinSeed: 2 });
debrisMat.userData.uniforms.uGuide.value = 0;

const state = {
  levelIndex: 0, level: null, grid: null, stone: null, mat: null, base: null, draft: null,
  tool: TOOLS[1], force: FORCES[1], guides: true, rng: mulberry32(1),
  cracks: 0, strikes: 0, plasterLeft: 0, plasterPerPoint: 0,
  pointer: { x: 0, y: 0, inside: false, down: false }, lastStrike: 0, hover: null,
  statsDirty: true, sketchDirty: true, lastSketch: 0, finished: false,
};

function loadLevel(i) {
  state.levelIndex = i;
  const level = LEVELS[i];
  state.level = level;
  if (state.stone) { shop.turntable.remove(state.stone.group); state.stone.dispose(); state.mat.dispose(); }
  shop.clearDebris();
  const seed = (Math.random() * 1e6) | 0;
  state.rng = mulberry32(seed);
  state.grid = new StoneGrid(level, seed);
  state.mat = createMarbleMaterial({ veinSeed: (seed % 97) / 7 });
  state.mat.userData.uniforms.uTol.value = tolerance(state.grid);
  state.mat.userData.uniforms.uSpacing.value = Math.max(0.012, level.size[0] / 14);
  state.mat.userData.uniforms.uGuide.value = state.guides ? 1 : 0;
  state.stone = new StoneMesh(state.grid, state.mat);
  shop.turntable.rotation.y = 0;
  shop.turntable.add(state.stone.group);
  shop.frame(level.size[1]);
  state.base = baseline(state.grid);
  state.draft = buildDraft(state.grid);
  state.cracks = 0; state.strikes = 0; state.finished = false;
  state.plasterLeft = level.plaster;
  state.plasterPerPoint = Math.pow(state.grid.v, 3) * 1000; // litres per grid cell
  state.statsDirty = state.sketchDirty = true;
  ui.setDraftInfo(level);
  ui.toast(`第 ${i + 1} 关 · ${level.name}`);
}

function stats() {
  const m = measure(state.grid, state.base);
  const r = appraise(state.level, m, { cracks: state.cracks, strikes: state.strikes });
  return { m, r };
}

function refreshStats() {
  const { m, r } = stats();
  ui.renderStats({ ...m, plasterLeft: state.plasterLeft, cracks: state.cracks, value: r.value });
  state.statsDirty = false;
  if (!state.finished && isRuined(m)) finish(true);
}

function finish(ruined = false) {
  const { m, r } = stats();
  state.finished = true;
  state.pointer.down = false;
  if (!ruined) { ui.progress.record(state.level.id, r); if (r.stars >= 1) sfx.fanfare(); }
  ui.showResult(state.level, m, r, { ruined, hasNext: state.levelIndex < LEVELS.length - 1 });
}

ui.showResult.onAction = (go) => {
  if (go === 'continue') state.finished = false;
  else if (go === 'restart') loadLevel(state.levelIndex);
  else if (go === 'next') loadLevel(state.levelIndex + 1);
  else if (go === 'levels') openLevels();
};

function openLevels() {
  ui.showLevelSelect(LEVELS, ui.progress.load(), (i) => loadLevel(i));
}

// --- Picking -------------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const inv = new THREE.Matrix4();

function pick() {
  if (!state.pointer.inside) return null;
  ndc.set((state.pointer.x / window.innerWidth) * 2 - 1, -(state.pointer.y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, shop.camera);
  shop.turntable.updateMatrixWorld();
  inv.copy(shop.turntable.matrixWorld).invert();
  const o = raycaster.ray.origin.clone().applyMatrix4(inv);
  const d = raycaster.ray.direction.clone().transformDirection(inv);
  return state.grid.raycast([o.x, o.y, o.z], [d.x, d.y, d.z]);
}

function updateHover() {
  const hit = pick();
  state.hover = hit;
  if (!hit || state.finished) { shop.setCursor(null); return; }
  const r = toolRadius(state.tool, state.force.f);
  const risk = state.tool.impact ? assessStrike(state.grid, hit, state.tool, state.force.f, state.level).chance : 0;
  shop.setCursor(hit, r, Math.min(1, risk * 2.5));
}

// --- Striking ------------------------------------------------------------------------------
function doStrike() {
  const hit = state.hover;
  if (!hit || state.finished) return;
  const tool = state.tool, f = state.force.f;
  if (tool.mode === 'plaster' && state.plasterLeft <= 0) { ui.toast('石膏已用完'); return; }
  const budget = tool.mode === 'plaster' ? Math.floor(state.plasterLeft / state.plasterPerPoint) : Infinity;
  const ev = strike(state.grid, hit, tool, f, state.level, state.rng, budget);
  state.strikes++;
  if (tool.mode === 'plaster') state.plasterLeft = Math.max(0, state.plasterLeft - ev.added * state.plasterPerPoint);

  if (tool.mode === 'carve' || tool.mode === 'pitch') { sfx.strike(f); shop.puff(hit, 6 + (ev.removed >> 4), f); }
  else if (tool.mode === 'rasp') { sfx.rasp(); if (ev.removed) shop.puff(hit, 2, 0.5); }
  else if (tool.mode === 'polish') sfx.polish();
  else sfx.plaster();

  if (ev.crack === 'snap' || ev.crack === 'spall') sfx.crack(ev.crack === 'snap');
  if (ev.crack === 'no-edge') ui.toast('劈石凿需要靠近棱角才能劈下石块');
  if (ev.lostTarget > 20 || (ev.crack === 'spall' && ev.removedTarget > 10)) {
    state.cracks++;
    ui.toast(ev.crack === 'snap' ? '咔嚓！细薄处断裂了' : '石料崩裂，伤到了雕像');
  } else if (ev.crack === 'snap' || ev.crack === 'spall') {
    ui.toast('崩落了一块余料');
  }
  for (const frag of ev.fragments) {
    const out = [hit.normal[0] * 0.6, 0.3, hit.normal[2] * 0.6];
    shop.spawnDebris(frag, debrisMat, out);
  }
  state.stone.update();
  state.statsDirty = state.sketchDirty = true;
}

// --- Input ---------------------------------------------------------------------------------
canvas.addEventListener('pointermove', (e) => { Object.assign(state.pointer, { x: e.clientX, y: e.clientY, inside: true }); });
canvas.addEventListener('pointerleave', () => { state.pointer.inside = false; state.pointer.down = false; });
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || ui.modalOpen()) return;
  state.pointer.down = true;
  canvas.setPointerCapture(e.pointerId);
  updateHover();
  doStrike();
  state.lastStrike = performance.now();
});
canvas.addEventListener('pointerup', (e) => { if (e.button === 0) state.pointer.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const setTool = (id) => { state.tool = TOOLS.find((t) => t.id === id); ui.setPressed('tool', id); ui.toast(`${state.tool.name}：${state.tool.desc}`, 2600); };
const setForce = (id) => { state.force = FORCES.find((f) => f.id === id); ui.setPressed('force', id); };
const toggleGuides = () => {
  state.guides = !state.guides;
  state.mat.userData.uniforms.uGuide.value = state.guides ? 1 : 0;
  ui.setGuidesPressed(state.guides);
};
const rotate = (dir) => { shop.turntable.rotation.y += dir * Math.PI / 8; };

ui.buildToolbar({
  tool: setTool, force: setForce, guides: toggleGuides,
  rotL: () => rotate(-1), rotR: () => rotate(1), volume: setVolume,
  appraise: () => finish(false), restart: () => loadLevel(state.levelIndex), levels: openLevels,
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (ui.modalOpen()) { if (e.key === 'Escape' && !state.finished) ui.closeModal(); return; }
  const t = TOOLS.find((x) => x.key === e.key);
  if (t) return setTool(t.id);
  const k = e.key.toLowerCase();
  if (k === 'z') setForce('light');
  else if (k === 'x') setForce('medium');
  else if (k === 'c') setForce('heavy');
  else if (k === 'g') toggleGuides();
  else if (k === 'a') rotate(-1);
  else if (k === 'd') rotate(1);
  else if (k === 'r') loadLevel(state.levelIndex);
  else if (e.key === 'Enter') { e.preventDefault(); finish(false); }
  else if (e.key === 'Escape') { e.preventDefault(); openLevels(); }
});

// --- Loop ----------------------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateHover();
  if (state.pointer.down && !state.finished && now - state.lastStrike >= state.tool.repeat) {
    state.lastStrike = now;
    doStrike();
  }
  shop.step(dt, (mass) => sfx.thud(Math.min(1, mass / 3000)));
  if (state.statsDirty) refreshStats();
  if (state.sketchDirty && now - state.lastSketch > 600) {
    drawDraft(sketchCtx, state.grid, state.draft);
    state.sketchDirty = false;
    state.lastSketch = now;
  }
  shop.render();
  requestAnimationFrame(loop);
}

setTool('point');
setForce('medium');
loadLevel(0);
openLevels();
requestAnimationFrame(loop);

// Debug/test hook for automated smoke runs.
window.__game = { state, loadLevel, finish, doStrike, shop, LEVELS };