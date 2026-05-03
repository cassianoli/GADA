// =============================================================
// Google Advanced Data Analytics — Portfolio Dashboard
// Carrega data/projects.json e renderiza KPIs, colunas por cenario,
// filtros, busca e modal de detalhes.
// Cada deliverable tem driveUrl (Drive) e/ou filePath (local relativo).
// Prioridade: driveUrl > filePath. Sem nenhum, o badge fica desabilitado.
// =============================================================

const STATE = {
  data: null,
  filters: { scenario: 'all', status: 'all', course: 'all' },
  search: ''
};

const STATUS_LABELS = {
  'completed': 'Completed',
  'in-progress': 'In Progress',
  'pending': 'Pending',
  'review': 'Review'
};

// -------------------- BOOT --------------------
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch('data/projects.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    STATE.data = await res.json();
  } catch (err) {
    showLoadError(err);
    return;
  }
  bindFilters();
  bindSearch();
  bindModal();
  render();
}

// Resolve a URL alvo: prefere driveUrl, senao filePath (URL-encoded).
function resolveUrl(d) {
  if (d.driveUrl) return d.driveUrl;
  if (d.filePath) return encodeURI(d.filePath);
  return '';
}

function showLoadError(err) {
  document.querySelector('main.container').innerHTML = `
    <div class="empty-global">
      <strong>Nao foi possivel carregar data/projects.json</strong><br/>
      ${String(err)}<br/><br/>
      Se voce abriu este arquivo com duplo clique, alguns navegadores bloqueiam fetch local.
      Rode um servidor local na pasta Capstone, por exemplo:
      <br/><code>python -m http.server 8000</code>
      <br/>e acesse <code>http://localhost:8000</code>.
    </div>
  `;
}

// -------------------- FILTROS --------------------
function bindFilters() {
  document.querySelectorAll('.chip-group').forEach(group => {
    group.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const filter = btn.dataset.filter;
      const value = btn.dataset.value;
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      STATE.filters[filter] = value;
      render();
    });
  });
}

function bindSearch() {
  const input = document.getElementById('search');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      STATE.search = input.value.trim().toLowerCase();
      render();
    }, 120);
  });
}

function setCourseFilter(num) {
  STATE.filters.course = String(num);
  document.querySelectorAll('#filter-course .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === String(num));
  });
  render();
}

// -------------------- FILTRAGEM --------------------
function applyFilters(items) {
  return items.filter(d => {
    if (STATE.filters.scenario !== 'all' && d.scenario !== STATE.filters.scenario) return false;
    if (STATE.filters.status !== 'all' && d.status !== STATE.filters.status) return false;
    if (STATE.filters.course !== 'all' && String(d.courseNumber) !== STATE.filters.course) return false;
    if (STATE.search) {
      const hay = [
        d.title, d.deliverableType, d.description,
        ...(d.tools || []), ...(d.skills || [])
      ].join(' ').toLowerCase();
      if (!hay.includes(STATE.search)) return false;
    }
    return true;
  });
}

// -------------------- RENDER --------------------
function render() {
  const filtered = applyFilters(STATE.data.deliverables);
  renderKpis(STATE.data.deliverables);
  renderScenarios(filtered);
  document.getElementById('empty-global').classList.toggle('hidden', filtered.length > 0);
}

// -------------------- KPIs --------------------
function renderKpis(allItems) {
  const total = allItems.length;
  const done = allItems.filter(d => d.status === 'completed').length;
  const inProg = allItems.filter(d => d.status === 'in-progress').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const byScenario = STATE.data.scenarios.map(s => {
    const items = allItems.filter(d => d.scenario === s.id);
    const completed = items.filter(d => d.status === 'completed').length;
    return { name: s.name, completed, total: items.length };
  });

  const root = document.getElementById('kpis');
  root.innerHTML = `
    <div class="kpi">
      <div class="kpi-label">Overall progress</div>
      <div class="kpi-value">${pct}% <small>${done}/${total} completed</small></div>
      <div class="kpi-bar"><span style="width:${pct}%"></span></div>
    </div>
    <div class="kpi">
      <div class="kpi-label">In progress</div>
      <div class="kpi-value">${inProg}<small>entregaveis ativos</small></div>
    </div>
    ${byScenario.map(s => {
      const p = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
      return `
        <div class="kpi">
          <div class="kpi-label">${s.name}</div>
          <div class="kpi-value">${p}% <small>${s.completed}/${s.total}</small></div>
          <div class="kpi-bar"><span style="width:${p}%"></span></div>
        </div>
      `;
    }).join('')}
  `;
}

// -------------------- SCENARIOS --------------------
function renderScenarios(filteredItems) {
  const root = document.getElementById('scenarios-grid');
  // se um filtro de cenario esta ativo, mostra so aquela coluna
  const scenarios = STATE.filters.scenario === 'all'
    ? STATE.data.scenarios
    : STATE.data.scenarios.filter(s => s.id === STATE.filters.scenario);

  root.innerHTML = scenarios.map(scenario => {
    const allOfScenario = STATE.data.deliverables.filter(d => d.scenario === scenario.id);
    const completedOfScenario = allOfScenario.filter(d => d.status === 'completed').length;
    const pct = allOfScenario.length === 0 ? 0 : Math.round(completedOfScenario / allOfScenario.length * 100);

    const byCourse = STATE.data.courses.map(c => {
      const items = filteredItems.filter(d => d.scenario === scenario.id && d.courseNumber === c.number);
      return { course: c, items };
    }).filter(group => group.items.length > 0 || STATE.filters.course === 'all');

    return `
      <div class="scenario-col">
        <div class="scenario-head">
          <h3>${escapeHtml(scenario.name)}</h3>
          <span class="scenario-sub">${escapeHtml(scenario.subtitle)}</span>
          <p class="scenario-goal">${escapeHtml(scenario.goal)}</p>
        </div>
        <div class="scenario-progress">
          <span>${completedOfScenario}/${allOfScenario.length}</span>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <span>${pct}%</span>
        </div>
        <div class="scenario-body">
          ${byCourse.map(g => renderCourseGroup(scenario, g.course, g.items)).join('')}
        </div>
      </div>
    `;
  }).join('');

  // bind clique: badge abre o arquivo direto; resto abre modal
  root.querySelectorAll('.deliverable').forEach(el => {
    el.addEventListener('click', e => {
      const id = el.dataset.id;
      const d = STATE.data.deliverables.find(x => x.id === id);
      if (!d) return;
      if (e.target.closest('[data-action="open"]')) {
        e.stopPropagation();
        const url = resolveUrl(d);
        if (url) window.open(url, '_blank', 'noopener');
        return;
      }
      openModal(id);
    });
  });
}

function renderCourseGroup(scenario, course, items) {
  return `
    <div class="scenario-course">
      <div class="scenario-course-head">
        <span><span class="cnum">C${course.number}</span> · ${escapeHtml(course.shortName)}</span>
      </div>
      ${items.length === 0
        ? `<div class="empty-course">Sem entregaveis correspondentes.</div>`
        : items.map(d => renderDeliverable(d)).join('')
      }
    </div>
  `;
}

function renderDeliverable(d) {
  const hasLink = !!(d.driveUrl || d.filePath);
  const badgeAction = hasLink
    ? `data-action="open" title="${d.driveUrl ? 'Open on Drive' : 'Open local file'}"`
    : 'title="No link available"';
  return `
    <div class="deliverable" data-id="${d.id}" tabindex="0" role="button">
      <div class="d-main">
        <div class="d-type">${escapeHtml(d.deliverableType)}</div>
        <div class="d-title">${escapeHtml(d.title)}</div>
      </div>
      <div class="d-meta">
        ${d.isExemplar ? `<span class="badge exemplar">Exemplar</span>` : ''}
        <span class="badge ${hasLink ? 'clickable' : 'disabled'} ${d.status}" ${badgeAction}>${STATUS_LABELS[d.status] || d.status}</span>
        ${!hasLink ? `<span class="badge no-file">No link</span>` : ''}
      </div>
    </div>
  `;
}

// -------------------- MODAL --------------------
function bindModal() {
  document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(id) {
  const d = STATE.data.deliverables.find(x => x.id === id);
  if (!d) return;
  const scenario = STATE.data.scenarios.find(s => s.id === d.scenario);
  const course = STATE.data.courses.find(c => c.number === d.courseNumber);

  document.getElementById('modal-eyebrow').textContent =
    `${scenario.name} · Course ${course.number} — ${course.shortName}`;
  document.getElementById('modal-title').textContent = d.title;

  document.getElementById('modal-badges').innerHTML = `
    <span class="badge ${d.status}">${STATUS_LABELS[d.status] || d.status}</span>
    <span class="badge pending" style="background:var(--accent-soft);color:var(--accent-strong)">${escapeHtml(d.deliverableType)}</span>
    ${d.isExemplar ? `<span class="badge exemplar">Exemplar</span>` : ''}
  `;

  const fields = [
    ['Project goal', d.projectGoal || scenario.goal],
    ['Business question', d.businessQuestion || scenario.businessQuestion],
    ['Description', d.description],
    ['Tools', renderTags(d.tools)],
    ['Skills', renderTags(d.skills)],
    ['Drive URL', d.driveUrl || ''],
    ['Local path', d.filePath || ''],
    ['Next action', d.nextAction],
    ['Portfolio note', d.portfolioNote]
  ];

  document.getElementById('modal-body').innerHTML = fields.map(([label, value]) => {
    const isEmpty = !value || value === '';
    const isHtml = typeof value === 'string' && value.startsWith('<');
    return `
      <div class="modal-field">
        <span class="label">${label}</span>
        <span class="value ${isEmpty ? 'empty' : ''}">${isEmpty ? '(em branco)' : (isHtml ? value : escapeHtml(value))}</span>
      </div>
    `;
  }).join('');

  // botao Open file
  const openBtn = document.getElementById('modal-open');
  const url = resolveUrl(d);
  if (url) {
    openBtn.href = url;
    openBtn.removeAttribute('aria-disabled');
    openBtn.textContent = d.driveUrl ? 'Open on Drive' : 'Open local file';
  } else {
    openBtn.href = '#';
    openBtn.setAttribute('aria-disabled', 'true');
    openBtn.textContent = 'No link';
  }

  // memorize id atual
  document.getElementById('modal').dataset.currentId = id;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function renderTags(arr) {
  if (!arr || arr.length === 0) return '';
  return `<div class="tag-list">${arr.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`;
}

// -------------------- HELPERS --------------------
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
