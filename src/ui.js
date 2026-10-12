// DOM panels: toolbar, live stats, toast, result / level-select modals, saved progress.
import { TOOLS, FORCES } from './tools.js';

const $ = (id) => document.getElementById(id);
const STORE = 'michelangelo-progress-v1';

export const progress = {
  load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } },
  save(p) { localStorage.setItem(STORE, JSON.stringify(p)); },
  record(levelId, result) {
    const p = this.load();
    const prev = p[levelId];
    if (!prev || result.value > prev.value) p[levelId] = { value: result.value, grade: result.grade, stars: result.stars };
    this.save(p);
    return p;
  },
};

/** Level n unlocks once level n-1 has at least one star. */
export const unlocked = (levels, p, i) => i === 0 || (p[levels[i - 1].id]?.stars ?? 0) >= 1;

export function buildToolbar(handlers) {
  const bar = $('toolbar');
  bar.innerHTML = '<h3>工具</h3>' +
    TOOLS.map((t) => `<button data-tool="${t.id}" title="${t.desc}" aria-pressed="false"><span>${t.name}</span><kbd>${t.key}</kbd></button>`).join('') +
    '<h3>力度 <small>(Z / X / C)</small></h3><div class="row">' +
    FORCES.map((f) => `<button data-force="${f.id}" aria-pressed="false">${f.name}</button>`).join('') + '</div>' +
    '<h3>视图</h3>' +
    '<button data-act="guides" aria-pressed="true"><span>指示线</span><kbd>G</kbd></button>' +
    '<div class="row"><button data-act="rotL" title="转台左转">⟲ A</button><button data-act="rotR" title="转台右转">D ⟳</button></div>' +
    '<label>音量<input type="range" min="0" max="1" step="0.05" value="0.5" data-act="volume" /></label>' +
    '<h3>作品</h3>' +
    '<button data-act="appraise"><span>完成并估价</span><kbd>Enter</kbd></button>' +
    '<button data-act="restart"><span>换新石料重来</span><kbd>R</kbd></button>' +
    '<button data-act="levels"><span>关卡选择</span><kbd>Esc</kbd></button>' +
    '<p style="font-size:12px;margin:4px 0 0;line-height:1.5">左键：敲击 / 按住连续<br>右键拖动：环绕视角<br>滚轮：缩放</p>';
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) handlers.tool(b.dataset.tool);
    else if (b.dataset.force) handlers.force(b.dataset.force);
    else if (b.dataset.act) handlers[b.dataset.act]?.();
  });
  bar.querySelector('[data-act="volume"]').addEventListener('input', (e) => handlers.volume(+e.target.value));
}

export function setPressed(attr, value) {
  for (const b of document.querySelectorAll(`#toolbar [data-${attr}]`)) b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
}
export const setGuidesPressed = (on) => document.querySelector('#toolbar [data-act="guides"]').setAttribute('aria-pressed', String(on));

const meter = (v, danger) => `<span class="meter${danger ? ' danger' : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></span>`;

export function renderStats(s) {
  $('stats').innerHTML =
    `<span>粗坯 ${meter(s.completion)} <b>${pct(s.completion)}</b></span>` +
    `<span>保形 ${meter(s.fidelity, s.fidelity < 0.85)} <b>${pct(s.fidelity)}</b></span>` +
    `<span>打磨 ${meter(s.polish)} <b>${pct(s.polish)}</b></span>` +
    `<span>石膏 <b>${s.plasterLeft.toFixed(2)} L</b></span>` +
    `<span>裂损 <b>${s.cracks}</b></span>` +
    `<span>估价 <b>${s.value.toLocaleString()} 弗罗林</b></span>`;
}
const pct = (v) => `${Math.round(v * 100)}%`;

let toastTimer = 0;
export function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function setDraftInfo(level) {
  $('draft-title').textContent = `${level.name}`;
  $('draft-meta').textContent = `${level.artist} · ${level.year} · 石料：${level.stone}`;
  $('draft-tip').textContent = level.tip;
}

function openModal(html, bind) {
  const ov = $('overlay'), modal = $('modal');
  modal.innerHTML = html;
  ov.hidden = false;
  modal.querySelector('button')?.focus();
  modal.onclick = (e) => {
    const b = e.target.closest('button[data-go]'); if (!b || b.disabled) return;
    ov.hidden = true;
    bind(b.dataset.go);
  };
}
export const closeModal = () => { $('overlay').hidden = true; };
export const modalOpen = () => !$('overlay').hidden;

export function showLevelSelect(levels, p, onPick) {
  const cards = levels.map((l, i) => {
    const best = p[l.id];
    const open = unlocked(levels, p, i);
    const stars = best ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : '☆☆☆';
    return `<button data-go="${i}" ${open ? '' : 'disabled'}><b>${i + 1}. ${l.name}</b><br>` +
      `<small>${l.artist}</small><br>${open ? stars : '🔒 未解锁'}` +
      `${best ? `<br><small>最佳 ${best.value.toLocaleString()} · ${best.grade}</small>` : ''}</button>`;
  }).join('');
  openModal(`<h1>米开朗基罗的工坊</h1>
    <p>“我在大理石中看见了天使，于是不停地雕刻，直到将他释放。”</p>
    <p>每关提供一块大理石与全套工具。按照草稿与粉笔指示线去除余料，避免在细薄处重击导致断裂。
    雕过头可用有限的石膏修补，但会降低估价。获得一星即可解锁下一件名作。</p>
    <div class="levels">${cards}</div>`, (go) => onPick(+go));
}

export function showResult(level, m, r, { ruined, hasNext }) {
  const f = r.factors;
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  openModal(`<h1>${ruined ? '作品损毁' : '鉴定报告'} · ${level.name}</h1>
    ${ruined ? '<p>雕像主体缺损过多，已无法修复。换一块新石料再试吧。</p>' : ''}
    <div class="price">${r.value.toLocaleString()} 弗罗林 · 评级 ${r.grade} ${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div>
    <table>
      ${row('粗坯完成度', `${pct(m.completion)} → ×${f.roughFactor.toFixed(2)}`)}
      ${row('形体保真度', `${pct(m.fidelity)} → ×${f.fidelityFactor.toFixed(2)}`)}
      ${row('石膏修补占比', `${(m.plasterShare * 100).toFixed(1)}% → ×${f.plasterFactor.toFixed(2)}`)}
      ${row('表面打磨', `${pct(m.polish)} → ×${f.finishFactor.toFixed(2)}`)}
      ${row('裂损事件', `${Math.round(Math.log(f.crackFactor) / Math.log(0.93))} 次 → ×${f.crackFactor.toFixed(2)}`)}
      ${row('敲击次数', r.strikes)}
      ${row('满分估价', `${level.baseValue.toLocaleString()} 弗罗林`)}
    </table>
    <div class="actions">
      ${ruined ? '' : '<button data-go="continue">继续雕刻</button>'}
      <button data-go="restart">重来</button>
      <button data-go="levels">关卡选择</button>
      ${hasNext && r.stars >= 1 && !ruined ? '<button class="primary" data-go="next">下一件名作 →</button>' : ''}
    </div>`, (go) => showResult.onAction?.(go));
}
