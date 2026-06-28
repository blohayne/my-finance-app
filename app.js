// app.js — MyFinanceApp

// ===== ESTADO =====
let state = Storage.load();

// Paleta usada para colorir categorias novas criadas pelo usuário
// (categorias antigas/legadas já têm sua própria cor fixa).
const CATEGORIA_COLORS = ['#5BB5D5', '#26C6A6', '#9C27B0', '#E91E63', '#F44336', '#00BCD4', '#FF9800', '#3F51B5', '#8BC34A', '#795548'];

// ===== HELPERS =====

function formatCents(cents) {
  const abs = Math.abs(cents);
  const str = String(abs).padStart(3, '0');
  const dec = str.slice(-2);
  let int = str.slice(0, -2).replace(/^0+/, '') || '0';
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${int},${dec}`;
}

function digitsToDisplay(digits) {
  if (!digits || digits === '0') return '0,00';
  const padded = digits.padStart(3, '0');
  const dec = padded.slice(-2);
  let int = padded.slice(0, -2).replace(/^0+/, '') || '0';
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${int},${dec}`;
}

function getMesAno() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nomeMes(mesAno) {
  const [y, m] = mesAno.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getProgressColor(pct) {
  if (pct > 90) return '#E53935';
  if (pct > 70) return '#FFC107';
  return '#4CAF50';
}

// Usado só para inserir o nome da categoria dentro do atributo value="" do
// input de edição — evita que aspas no nome quebrem o HTML da linha.
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== VIRADA DE MÊS =====
function checkViradaMes() {
  const mesAtual = getMesAno();
  if (!state.ultimoMes) { state.ultimoMes = mesAtual; Storage.save(state); return; }
  if (state.ultimoMes === mesAtual) return;

  // Arquiva o mês fechado
  const totalGasto  = Object.values(state.gastosPorCategoria).reduce((a, b) => a + b, 0);
  const totalLimite = Object.values(state.limites).reduce((a, b) => a + b, 0);
  state.historicoMeses.unshift({
    mesAno: state.ultimoMes,
    totalGasto,
    totalLimite,
    porCategoria: { ...state.gastosPorCategoria },
    limites:      { ...state.limites },
  });

  // Zera gastos do mês
  state.categorias.forEach(c => { state.gastosPorCategoria[c.id] = 0; });
  // Remove transações do mês fechado do array principal (mantém só o mês atual)
  state.transacoes = state.transacoes.filter(t => t.mesAno === mesAtual);
  state.ultimoMes = mesAtual;
  Storage.save(state);
}

// ===== NAVEGAÇÃO =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${id}`);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  document.getElementById('dash-saldo').textContent   = `R$ ${formatCents(state.saldo)}`;
  document.getElementById('dash-reserva').textContent = `Reserva Poupança: R$ ${formatCents(state.reserva)}`;

  const list = document.getElementById('categories-list');
  list.innerHTML = '';

  state.categorias.forEach(cat => {
    const gasto  = state.gastosPorCategoria[cat.id] || 0;
    const limite = state.limites[cat.id] || 0;
    const rawPct = limite > 0 ? (gasto / limite) * 100 : 0;
    const pct    = Math.min(Math.round(rawPct), 100); // barra max 100%
    const estourou = rawPct > 100;
    const excesso  = gasto - limite;
    const barColor = getProgressColor(rawPct);
    const pctLabel = Math.round(rawPct); // pode passar de 100 no texto

    const row = document.createElement('div');
    row.className = 'category-row';
    row.dataset.cat = cat.id;

    row.innerHTML = `
      <div class="cat-header">
        <span class="cat-name"><span>${cat.emoji}</span> ${cat.name}</span>
        <span class="cat-percent" style="color:${rawPct > 90 ? '#E53935' : '#1A1A1A'}">${pctLabel}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
      <div class="cat-sub">
        <span class="cat-values">R$ ${formatCents(gasto)} de R$ ${formatCents(limite)}</span>
        ${estourou ? `<span class="cat-over-label">+R$ ${formatCents(excesso)} acima</span>` : ''}
      </div>
    `;

    row.addEventListener('click', () => openLancamentos(cat.id));
    list.appendChild(row);
  });
}

// ===== CATEGORY CHIPS (tela "Novo gasto") =====
let selectedCategory = null;

function renderCategoryChips(containerId) {
  selectedCategory = null;
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  state.categorias.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'cat-chip';
    chip.dataset.cat = cat.id;
    chip.innerHTML = `<span class="cat-chip-dot" style="background:${cat.color}"></span><span>${cat.emoji} ${cat.name}</span>`;
    chip.addEventListener('click', () => {
      container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedCategory = cat.id;
    });
    container.appendChild(chip);
  });
}

// ===== VALUE INPUT =====
function setupValueInput({ wrapperId, displayId, hiddenInputId }) {
  const wrapper = document.getElementById(wrapperId);
  const display = document.getElementById(displayId);
  const hidden  = document.getElementById(hiddenInputId);
  let digits = '';

  function upd() { display.textContent = digitsToDisplay(digits); }

  wrapper.addEventListener('click', () => hidden.focus());
  hidden.addEventListener('input', e => {
    const raw = e.target.value.replace(/\D/g, '');
    e.target.value = '';
    if (!raw) return;
    digits += raw;
    if (digits.length > 9) digits = digits.slice(-9);
    upd();
  });
  hidden.addEventListener('keydown', e => {
    if (e.key === 'Backspace') { digits = digits.slice(0, -1); upd(); }
  });

  upd();
  return {
    reset()    { digits = ''; upd(); },
    getCents() { return digits ? parseInt(digits, 10) : 0; },
    setVal(v)  { digits = v > 0 ? String(v) : ''; upd(); },
  };
}

// ===== LIMITE INPUT (campo numérico de teto, usado na tela de categorias) =====
function setupLimiteInput(displayEl, hiddenEl) {
  let digits = '';
  function upd() { displayEl.textContent = digitsToDisplay(digits); }
  displayEl.parentElement.addEventListener('click', () => hiddenEl.focus());
  hiddenEl.addEventListener('input', e => {
    const raw = e.target.value.replace(/\D/g, '');
    e.target.value = '';
    if (!raw) return;
    digits += raw;
    if (digits.length > 9) digits = digits.slice(-9);
    upd();
  });
  hiddenEl.addEventListener('keydown', e => {
    if (e.key === 'Backspace') { digits = digits.slice(0, -1); upd(); }
  });
  upd();
  return {
    getCents() { return digits ? parseInt(digits, 10) : 0; },
    setVal(v)  { digits = v > 0 ? String(v) : ''; upd(); },
  };
}

// ===== LANÇAMENTOS DA CATEGORIA =====
let lancCatAtual = null;

function openLancamentos(catId) {
  lancCatAtual = catId;
  const cat    = state.categorias.find(c => c.id === catId);
  const gasto  = state.gastosPorCategoria[catId] || 0;
  const limite = state.limites[catId] || 0;
  const pct    = limite > 0 ? Math.round((gasto / limite) * 100) : 0;

  document.getElementById('lanc-cat-title').textContent = cat ? `${cat.emoji} ${cat.name}` : 'Categoria';

  document.getElementById('lanc-summary').innerHTML = `
    <strong>R$ ${formatCents(gasto)}</strong> gastos de R$ ${formatCents(limite)} (${pct}%)
  `;

  const mesAtual = getMesAno();
  const transacoes = state.transacoes.filter(
    t => t.tipo === 'gasto' && t.categoria === catId && t.mesAno === mesAtual
  ).sort((a, b) => b.id - a.id);

  const listEl = document.getElementById('lanc-list');
  listEl.innerHTML = '';

  if (transacoes.length === 0) {
    listEl.innerHTML = '<p class="lanc-empty">Nenhum lançamento neste mês.</p>';
  } else {
    transacoes.forEach(t => {
      const item = document.createElement('div');
      item.className = 'lanc-item';
      item.innerHTML = `
        <div class="lanc-info">
          <div class="lanc-date">${formatDate(t.data)}</div>
          <div class="lanc-valor">R$ ${formatCents(t.valor)}</div>
        </div>
        <div class="lanc-actions">
          <button class="btn-lanc-action btn-lanc-edit" data-id="${t.id}">Editar</button>
          <button class="btn-lanc-action btn-lanc-del"  data-id="${t.id}">Excluir</button>
        </div>
      `;
      listEl.appendChild(item);
    });

    listEl.querySelectorAll('.btn-lanc-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        excluirLancamento(id);
      });
    });

    listEl.querySelectorAll('.btn-lanc-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        abrirEditar(id);
      });
    });
  }

  showScreen('lancamentos');
}

function excluirLancamento(id) {
  const t = state.transacoes.find(x => x.id === id);
  if (!t) return;
  state.saldo += t.valor;
  state.gastosPorCategoria[t.categoria] = Math.max(0, (state.gastosPorCategoria[t.categoria] || 0) - t.valor);
  state.transacoes = state.transacoes.filter(x => x.id !== id);
  Storage.save(state);
  openLancamentos(lancCatAtual); // re-renderiza
}

// ===== EDITAR LANÇAMENTO =====
let editarInput;
let editandoId = null;

function abrirEditar(id) {
  const t = state.transacoes.find(x => x.id === id);
  if (!t) return;
  editandoId = id;
  editarInput.setVal(t.valor);
  showScreen('editar');
}

// ===== HISTÓRICO =====
function renderHistorico() {
  const list = document.getElementById('historico-list');
  list.innerHTML = '';

  if (state.historicoMeses.length === 0) {
    list.innerHTML = '<p class="hist-empty">Nenhum mês fechado ainda.<br>O histórico aparece a partir do mês seguinte.</p>';
    return;
  }

  state.historicoMeses.forEach(h => {
    const pct      = h.totalLimite > 0 ? Math.min(Math.round((h.totalGasto / h.totalLimite) * 100), 100) : 0;
    const barColor = getProgressColor(pct * 1.0);

    const card = document.createElement('div');
    card.className = 'hist-month-card';
    card.innerHTML = `
      <div class="hist-month-title">${nomeMes(h.mesAno)}</div>
      <div class="hist-row">
        <span>Total gasto</span>
        <strong>R$ ${formatCents(h.totalGasto)}</strong>
      </div>
      <div class="hist-row">
        <span>Orçamento previsto</span>
        <strong>R$ ${formatCents(h.totalLimite)}</strong>
      </div>
      <div class="hist-progress-track">
        <div class="hist-progress-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
    `;
    list.appendChild(card);
  });
}

// ===== GERENCIAR CATEGORIAS =====
// Estado de trabalho da tela — só é gravado em `state` quando o usuário
// toca em "Salvar". Cancelar simplesmente descarta tudo isso.
let categoriaLimiteControllers = {};
let categoriasRemovidasIds = [];

function buildCategoriasScreen() {
  const list = document.getElementById('categorias-list');
  list.innerHTML = '';
  categoriaLimiteControllers = {};
  categoriasRemovidasIds = [];

  state.categorias.forEach(cat => {
    const row = criarLinhaCategoria(cat, state.limites[cat.id] || 0, false);
    list.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-add-categoria';
  addBtn.id = 'btn-add-categoria';
  addBtn.textContent = '+ Adicionar Categoria';
  addBtn.addEventListener('click', () => {
    const novoId = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const cor = CATEGORIA_COLORS[list.querySelectorAll('.categoria-row').length % CATEGORIA_COLORS.length];
    const row = criarLinhaCategoria({ id: novoId, name: 'Nova Categoria', emoji: '🏷️', color: cor }, 0, true);
    list.insertBefore(row, addBtn);
    const input = row.querySelector('.categoria-name-input');
    input.focus();
    input.select();
    row.scrollIntoView({ block: 'nearest' });
  });
  list.appendChild(addBtn);
}

function criarLinhaCategoria(cat, limiteCents, isNova) {
  const row = document.createElement('div');
  row.className = 'categoria-row';
  row.dataset.id = cat.id;

  row.innerHTML = `
    <input type="text" class="categoria-emoji-input" value="${escapeAttr(cat.emoji || '🏷️')}" maxlength="8" aria-label="Ícone da categoria" />
    <input type="text" class="categoria-name-input" value="${escapeAttr(cat.name)}" placeholder="Nome da categoria" maxlength="30" />
    <div class="categoria-limite-wrap">
      <span class="categoria-limite-currency">R$</span>
      <span class="categoria-limite-display">0,00</span>
      <input type="tel" class="categoria-limite-hidden" inputmode="numeric" />
    </div>
    <button type="button" class="btn-categoria-del" aria-label="Excluir categoria" title="Excluir categoria">🗑️</button>
  `;

  // Ao tocar no campo de emoji, seleciona o conteúdo atual — assim, ao
  // abrir o teclado de emoji do celular e tocar num novo, ele substitui
  // o antigo em vez de ficar acumulando emojis ao lado.
  const emojiInput = row.querySelector('.categoria-emoji-input');
  emojiInput.addEventListener('focus', () => emojiInput.select());

  const ctrl = setupLimiteInput(
    row.querySelector('.categoria-limite-display'),
    row.querySelector('.categoria-limite-hidden')
  );
  ctrl.setVal(limiteCents);
  categoriaLimiteControllers[cat.id] = ctrl;

  row.querySelector('.btn-categoria-del').addEventListener('click', () => {
    const gasto = state.gastosPorCategoria[cat.id] || 0;

    if (cat.id === Storage.OUTROS_ID && gasto > 0) {
      alert('Não é possível excluir "Outros" enquanto houver gastos registrados nela.');
      return;
    }

    const nomeAtual = row.querySelector('.categoria-name-input').value.trim() || cat.name;
    const msg = gasto > 0
      ? `Excluir "${nomeAtual}"? Os R$ ${formatCents(gasto)} já gastos nessa categoria serão movidos para "Outros".`
      : `Excluir "${nomeAtual}"?`;
    if (!confirm(msg)) return;

    row.remove();
    delete categoriaLimiteControllers[cat.id];
    if (!isNova) categoriasRemovidasIds.push(cat.id);
  });

  return row;
}

function ensureOutros(categoriasFinal) {
  if (categoriasFinal.some(c => c.id === Storage.OUTROS_ID)) return;
  categoriasFinal.push({ id: Storage.OUTROS_ID, name: 'Outros', emoji: '📦', color: '#9E9E9E' });
}

// ===== SERVICE WORKER & ATUALIZAÇÃO =====
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let registration = null;

  navigator.serviceWorker.register('sw.js').then(reg => {
    registration = reg;

    // Já existe uma versão instalada esperando (ex: usuário tinha fechado
    // o app antes de confirmar uma atualização anterior).
    if (reg.waiting) showUpdateBanner(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const novoWorker = reg.installing;
      if (!novoWorker) return;
      novoWorker.addEventListener('statechange', () => {
        // "installed" + já existe um controller ativo = é uma ATUALIZAÇÃO
        // (não a primeira instalação do app).
        if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(novoWorker);
        }
      });
    });
  }).catch(() => {});

  // IMPORTANTE: quando o app é aberto pela tela inicial (PWA instalado),
  // o sistema às vezes só "retoma" a página que já estava aberta em
  // segundo plano, em vez de recarregar do zero — e nesse caso o
  // navegador não checa sozinho se existe uma versão nova no servidor.
  // Por isso, toda vez que o app volta a ficar visível, forçamos essa
  // checagem manualmente.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && registration) {
      registration.update().catch(() => {});
    }
  });

  // Também checa periodicamente enquanto o app fica aberto (a cada 30
  // minutos), cobrindo o caso de alguém que deixa o app aberto por muito
  // tempo sem nunca minimizar/reabrir.
  setInterval(() => {
    if (registration) registration.update().catch(() => {});
  }, 30 * 60 * 1000);

  // Depois que o usuário confirma e o novo SW assume o controle,
  // recarrega a página automaticamente para já usar a versão nova.
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

function showUpdateBanner(worker) {
  const banner = document.getElementById('update-banner');
  const btn    = document.getElementById('update-banner-btn');
  if (!banner || !btn) return;
  banner.style.display = 'flex';
  btn.onclick = () => {
    worker.postMessage('skipWaiting');
    banner.style.display = 'none';
  };
}

// ===== INPUTS GLOBAIS =====
let gastoInput, entradaInput, reservaInput, rendaInput;
let pendingGasto = null;
let reservaMode  = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  checkViradaMes();
  registerServiceWorker();

  // --- FAB ---
  document.getElementById('btn-fab').addEventListener('click', () => showScreen('menu'));
  document.getElementById('overlay-menu').addEventListener('click', () => showScreen('dashboard'));

  // --- Header ---
  document.getElementById('btn-historico').addEventListener('click', () => {
    renderHistorico();
    showScreen('historico');
  });
  document.getElementById('btn-config').addEventListener('click', () => {
    buildCategoriasScreen();
    showScreen('categorias');
  });

  // --- Backs ---
  document.getElementById('lanc-back').addEventListener('click', () => {
    renderDashboard();
    showScreen('dashboard');
  });
  document.getElementById('hist-back').addEventListener('click', () => showScreen('dashboard'));

  // ===== MENU OPÇÕES =====
  document.getElementById('btn-novo-gasto').addEventListener('click', () => {
    renderCategoryChips('gasto-categories');
    gastoInput.reset();
    showScreen('novo-gasto');
  });
  document.getElementById('btn-nova-entrada').addEventListener('click', () => {
    entradaInput.reset();
    showScreen('nova-entrada');
  });
  document.getElementById('btn-ajustar-reserva').addEventListener('click', () => {
    reservaInput.reset();
    reservaMode = null;
    document.querySelectorAll('.btn-reserva-action').forEach(b => b.classList.remove('selected'));
    document.getElementById('reserva-atual-label').textContent = `R$ ${formatCents(state.reserva)}`;
    document.getElementById('rendimento-wrap').style.display = 'none';
    document.getElementById('check-rendimento').checked = false;
    showScreen('reserva');
  });

  // ===== NOVO GASTO =====
  gastoInput = setupValueInput({
    wrapperId: 'gasto-value-wrapper', displayId: 'gasto-display', hiddenInputId: 'gasto-input',
  });

  document.getElementById('gasto-cancel').addEventListener('click', () => { renderDashboard(); showScreen('dashboard'); });

  document.getElementById('gasto-save').addEventListener('click', () => {
    const valor = gastoInput.getCents();
    if (valor <= 0)        { alert('Informe um valor maior que zero.'); return; }
    if (!selectedCategory) { alert('Selecione uma categoria.'); return; }

    // Alerta: compromete Moradia & Contas? (id fixo legado — se a
    // categoria for renomeada o alerta continua valendo, pois o id não
    // muda; se ela for excluída, o limite fica 0 e o alerta simplesmente
    // não dispara mais, sem quebrar nada.)
    const limFix   = state.limites['Moradia & Contas'] || 0;
    const gastoFix = state.gastosPorCategoria['Moradia & Contas'] || 0;
    const falta    = limFix - gastoFix;

    if (limFix > 0 && falta > 0 && (state.saldo - valor) < falta && selectedCategory !== 'Moradia & Contas') {
      pendingGasto = { valor, categoria: selectedCategory };
      document.getElementById('alerta-valor').textContent = formatCents(valor);
      document.getElementById('alerta-msg').textContent =
        `Este gasto de R$ ${formatCents(valor)} compromete o pagamento da sua Moradia & Contas (faltam R$ ${formatCents(falta)}). Deseja continuar?`;
      showScreen('alerta');
      return;
    }
    commitGasto(valor, selectedCategory);
  });

  // ===== ALERTA =====
  document.getElementById('alerta-cancelar-gasto').addEventListener('click', () => {
    pendingGasto = null;
    renderDashboard();
    showScreen('dashboard');
  });
  document.getElementById('alerta-ignorar').addEventListener('click', () => {
    if (pendingGasto) { commitGasto(pendingGasto.valor, pendingGasto.categoria); pendingGasto = null; }
  });

  function commitGasto(valor, categoria) {
    const mesAno = getMesAno();
    state.saldo -= valor;
    state.gastosPorCategoria[categoria] = (state.gastosPorCategoria[categoria] || 0) + valor;
    state.transacoes.push({ id: Date.now(), tipo: 'gasto', valor, categoria, data: new Date().toISOString(), mesAno });
    Storage.save(state);
    renderDashboard();
    showScreen('dashboard');
  }

  // ===== NOVA ENTRADA =====
  entradaInput = setupValueInput({
    wrapperId: 'entrada-value-wrapper', displayId: 'entrada-display', hiddenInputId: 'entrada-input',
  });
  document.getElementById('entrada-cancel').addEventListener('click', () => { renderDashboard(); showScreen('dashboard'); });
  document.getElementById('entrada-save').addEventListener('click', () => {
    const valor = entradaInput.getCents();
    if (valor <= 0) { alert('Informe um valor maior que zero.'); return; }
    state.saldo += valor;
    state.renda  = valor;
    state.transacoes.push({ id: Date.now(), tipo: 'entrada', valor, categoria: null, data: new Date().toISOString(), mesAno: getMesAno() });
    Storage.save(state);
    renderDashboard();
    showScreen('dashboard');
  });

  // ===== AJUSTAR RESERVA =====
  reservaInput = setupValueInput({
    wrapperId: 'reserva-value-wrapper', displayId: 'reserva-display', hiddenInputId: 'reserva-input',
  });
  document.getElementById('btn-guardar').addEventListener('click', function() {
    reservaMode = 'guardar';
    document.querySelectorAll('.btn-reserva-action').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    document.getElementById('rendimento-wrap').style.display = 'flex';
  });
  document.getElementById('btn-resgatar').addEventListener('click', function() {
    reservaMode = 'resgatar';
    document.querySelectorAll('.btn-reserva-action').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    document.getElementById('rendimento-wrap').style.display = 'none';
    document.getElementById('check-rendimento').checked = false;
  });
  document.getElementById('reserva-cancel').addEventListener('click', () => { renderDashboard(); showScreen('dashboard'); });
  document.getElementById('reserva-save').addEventListener('click', () => {
    const valor = reservaInput.getCents();
    if (valor <= 0)   { alert('Informe um valor.'); return; }
    if (!reservaMode) { alert('Escolha Guardar ou Resgatar.'); return; }
    if (reservaMode === 'guardar') {
      const apenasRendimento = document.getElementById('check-rendimento').checked;
      if (apenasRendimento) {
        // só atualiza a reserva, saldo intacto
        state.reserva += valor;
      } else {
        if (valor > state.saldo) { alert('Saldo insuficiente.'); return; }
        state.saldo -= valor; state.reserva += valor;
      }
    } else {
      if (valor > state.reserva) { alert('Reserva insuficiente.'); return; }
      state.reserva -= valor; state.saldo += valor;
    }
    Storage.save(state);
    renderDashboard();
    showScreen('dashboard');
  });

  // ===== GERENCIAR CATEGORIAS =====
  document.getElementById('categorias-cancel').addEventListener('click', () => { renderDashboard(); showScreen('dashboard'); });

  document.getElementById('categorias-save').addEventListener('click', () => {
    const rows = [...document.querySelectorAll('#categorias-list .categoria-row')];
    if (rows.length === 0) { alert('Adicione ao menos uma categoria.'); return; }

    const categoriasFinal = [];
    const idsFinal = new Set();

    for (const row of rows) {
      const id = row.dataset.id;
      const nameInput = row.querySelector('.categoria-name-input');
      const emojiInput = row.querySelector('.categoria-emoji-input');
      const nome = nameInput.value.trim();
      if (!nome) { alert('Toda categoria precisa de um nome.'); nameInput.focus(); return; }
      const emoji = emojiInput.value.trim() || '🏷️';

      const original = state.categorias.find(c => c.id === id);
      categoriasFinal.push({
        id,
        name: nome,
        emoji,
        color: original ? original.color : CATEGORIA_COLORS[categoriasFinal.length % CATEGORIA_COLORS.length],
      });
      state.limites[id] = categoriaLimiteControllers[id] ? categoriaLimiteControllers[id].getCents() : 0;
      if (!(id in state.gastosPorCategoria)) state.gastosPorCategoria[id] = 0;
      idsFinal.add(id);
    }

    // Categorias excluídas nesta sessão: se tinham gasto, o gasto vai
    // para "Outros" (criando-a se ainda não existir) e as transações
    // antigas passam a apontar para o id de "Outros".
    categoriasRemovidasIds.forEach(id => {
      if (idsFinal.has(id)) return;
      const gasto = state.gastosPorCategoria[id] || 0;

      if (gasto > 0 && id !== Storage.OUTROS_ID) {
        ensureOutros(categoriasFinal);
        idsFinal.add(Storage.OUTROS_ID);
        if (!(Storage.OUTROS_ID in state.limites)) state.limites[Storage.OUTROS_ID] = 0;
        state.gastosPorCategoria[Storage.OUTROS_ID] = (state.gastosPorCategoria[Storage.OUTROS_ID] || 0) + gasto;
        state.transacoes.forEach(t => { if (t.categoria === id) t.categoria = Storage.OUTROS_ID; });
      }

      delete state.limites[id];
      delete state.gastosPorCategoria[id];
    });

    state.categorias = categoriasFinal;
    Storage.save(state);
    renderDashboard();
    showScreen('dashboard');
  });

  // ===== EDITAR LANÇAMENTO =====
  editarInput = setupValueInput({
    wrapperId: 'editar-value-wrapper', displayId: 'editar-display', hiddenInputId: 'editar-input',
  });
  document.getElementById('editar-cancel').addEventListener('click', () => {
    editandoId = null;
    openLancamentos(lancCatAtual);
  });
  document.getElementById('editar-save').addEventListener('click', () => {
    const novoValor = editarInput.getCents();
    if (novoValor <= 0) { alert('Informe um valor.'); return; }
    const t = state.transacoes.find(x => x.id === editandoId);
    if (!t) return;
    const diff = novoValor - t.valor;
    state.saldo -= diff;
    state.gastosPorCategoria[t.categoria] = Math.max(0, (state.gastosPorCategoria[t.categoria] || 0) + diff);
    t.valor = novoValor;
    editandoId = null;
    Storage.save(state);
    openLancamentos(lancCatAtual);
  });

  // ===== INIT =====
  renderDashboard();
});