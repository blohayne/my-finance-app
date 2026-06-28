// app.js — MyFinanceApp

// ===== ESTADO =====
let state = Storage.load();

// ===== CATEGORIAS =====
const CATEGORIES = [
  { name: 'Moradia & Contas',  emoji: '🏠', color: '#5BB5D5' },
  { name: 'Mercado & Rotina',  emoji: '🛒', color: '#26C6A6' },
  { name: 'Transporte',        emoji: '🚗', color: '#9C27B0' },
  { name: 'Compras & Estilo',  emoji: '🛍️', color: '#E91E63' },
  { name: 'Lazer & Saídas',    emoji: '🎉', color: '#F44336' },
  { name: 'Saúde',             emoji: '💊', color: '#00BCD4' },
];

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
  CATEGORIES.forEach(c => { state.gastosPorCategoria[c.name] = 0; });
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

  CATEGORIES.forEach(cat => {
    const gasto  = state.gastosPorCategoria[cat.name] || 0;
    const limite = state.limites[cat.name] || 0;
    const rawPct = limite > 0 ? (gasto / limite) * 100 : 0;
    const pct    = Math.min(Math.round(rawPct), 100); // barra max 100%
    const estourou = rawPct > 100;
    const excesso  = gasto - limite;
    const barColor = getProgressColor(rawPct);
    const pctLabel = Math.round(rawPct); // pode passar de 100 no texto

    const row = document.createElement('div');
    row.className = 'category-row';
    row.dataset.cat = cat.name;

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

    row.addEventListener('click', () => openLancamentos(cat.name));
    list.appendChild(row);
  });
}

// ===== CATEGORY CHIPS =====
let selectedCategory = null;

function renderCategoryChips(containerId) {
  selectedCategory = null;
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'cat-chip';
    chip.dataset.cat = cat.name;
    chip.innerHTML = `<span class="cat-chip-dot" style="background:${cat.color}"></span><span>${cat.emoji} ${cat.name}</span>`;
    chip.addEventListener('click', () => {
      container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedCategory = cat.name;
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

// ===== LIMITE INPUT =====
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

function openLancamentos(catName) {
  lancCatAtual = catName;
  const cat    = CATEGORIES.find(c => c.name === catName);
  const gasto  = state.gastosPorCategoria[catName] || 0;
  const limite = state.limites[catName] || 0;
  const pct    = limite > 0 ? Math.round((gasto / limite) * 100) : 0;

  document.getElementById('lanc-cat-title').textContent = `${cat.emoji} ${catName}`;

  document.getElementById('lanc-summary').innerHTML = `
    <strong>R$ ${formatCents(gasto)}</strong> gastos de R$ ${formatCents(limite)} (${pct}%)
  `;

  const mesAtual = getMesAno();
  const transacoes = state.transacoes.filter(
    t => t.tipo === 'gasto' && t.categoria === catName && t.mesAno === mesAtual
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

// ===== INPUTS GLOBAIS =====
let gastoInput, entradaInput, reservaInput, rendaInput;
let pendingGasto = null;
let reservaMode  = null;
let limiteControllers = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  checkViradaMes();

  // --- FAB ---
  document.getElementById('btn-fab').addEventListener('click', () => showScreen('menu'));
  document.getElementById('overlay-menu').addEventListener('click', () => showScreen('dashboard'));

  // --- Header ---
  document.getElementById('btn-historico').addEventListener('click', () => {
    renderHistorico();
    showScreen('historico');
  });
  document.getElementById('btn-config').addEventListener('click', () => {
    buildLimitesScreen();
    showScreen('limites');
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

    // Alerta: compromete Moradia & Contas?
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

  // ===== CONFIGURAR LIMITES =====
  function buildLimitesScreen() {
    const list = document.getElementById('limites-list');
    list.innerHTML = '';
    limiteControllers = {};

    CATEGORIES.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'limite-row';
      const safeName = cat.name.replace(/[^a-zA-Z0-9]/g, '_');
      row.innerHTML = `
        <div class="limite-row-name">
          <span class="limite-dot" style="background:${cat.color}"></span>
          <span>${cat.emoji} ${cat.name}</span>
        </div>
        <div class="limite-input-wrap">
          <span class="limite-currency">R$</span>
          <span class="limite-display" id="ld-${safeName}">0,00</span>
          <input type="tel" id="lh-${safeName}" class="limite-hidden" inputmode="numeric" />
        </div>
      `;
      list.appendChild(row);
      const ctrl = setupLimiteInput(row.querySelector('.limite-display'), row.querySelector(`#lh-${safeName}`));
      ctrl.setVal(state.limites[cat.name] || 0);
      limiteControllers[cat.name] = ctrl;
    });
  }

  document.getElementById('limites-cancel').addEventListener('click', () => { renderDashboard(); showScreen('dashboard'); });
  document.getElementById('limites-save').addEventListener('click', () => {
    CATEGORIES.forEach(cat => { state.limites[cat.name] = limiteControllers[cat.name]?.getCents() || 0; });
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