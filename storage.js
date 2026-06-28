// storage.js — camada de persistência via localStorage

const Storage = (() => {
  const KEY_STATE = 'myfinance_state_v2';

  // id especial fixo da categoria "Outros" — usada como destino automático
  // de gastos quando a categoria original deles é excluída pelo usuário.
  const OUTROS_ID = '__outros__';

  // Categorias que o app sempre teve, antes da tela "Gerenciar Categorias"
  // existir. IMPORTANTE: aqui o id é IGUAL ao nome original. Isso é o que
  // garante que gastos/transações já salvos (de versões antigas do app,
  // que guardavam só o nome como string) continuem casando certinho com a
  // categoria certa depois da migração para o novo modelo baseado em id.
  const LEGACY_CATEGORIES = [
    { id: 'Moradia & Contas', name: 'Moradia & Contas', emoji: '🏠', color: '#5BB5D5' },
    { id: 'Mercado & Rotina', name: 'Mercado & Rotina', emoji: '🛒', color: '#26C6A6' },
    { id: 'Transporte',       name: 'Transporte',       emoji: '🚗', color: '#9C27B0' },
    { id: 'Compras & Estilo', name: 'Compras & Estilo', emoji: '🛍️', color: '#E91E63' },
    { id: 'Lazer & Saídas',   name: 'Lazer & Saídas',   emoji: '🎉', color: '#F44336' },
    { id: 'Saúde',            name: 'Saúde',            emoji: '💊', color: '#00BCD4' },
  ];

  const CATS_DEFAULT = () => {
    const o = {};
    LEGACY_CATEGORIES.forEach(c => { o[c.id] = 0; });
    return o;
  };

  const DEFAULT = () => ({
    saldo: 0,
    renda: 0,
    reserva: 0,
    transacoes: [],      // { id, tipo:'gasto'|'entrada', valor, categoria:<id>, data, mesAno:'2025-06' }
    categorias: LEGACY_CATEGORIES.map(c => ({ ...c })), // [{ id, name, emoji, color }]
    limites: CATS_DEFAULT(),             // { <categoriaId>: cents }
    gastosPorCategoria: CATS_DEFAULT(),  // { <categoriaId>: cents }
    historicoMeses: [],  // [{ mesAno:'2025-06', totalGasto, totalLimite, porCategoria:{...}, limites:{...} }]
  });

  // ===== MIGRAÇÃO =====
  // Roda toda vez que o estado é carregado. Garante que:
  // 1) sempre exista um array `categorias` (celulares com versão antiga
  //    do app não tinham esse campo);
  // 2) qualquer id encontrado em `limites`, `gastosPorCategoria` ou em
  //    `transacoes[].categoria` que não esteja no array `categorias`
  //    receba uma entrada automática — assim nada quebra mesmo que o
  //    dado salvo seja de uma versão mais antiga do app.
  function migrarCategorias(state) {
    if (!Array.isArray(state.categorias) || state.categorias.length === 0) {
      state.categorias = LEGACY_CATEGORIES.map(c => ({ ...c }));
    }

    const idsConhecidos = new Set(state.categorias.map(c => c.id));
    const idsFaltantes = new Set();

    Object.keys(state.limites || {}).forEach(id => {
      if (!idsConhecidos.has(id)) idsFaltantes.add(id);
    });
    Object.keys(state.gastosPorCategoria || {}).forEach(id => {
      if (!idsConhecidos.has(id)) idsFaltantes.add(id);
    });
    (state.transacoes || []).forEach(t => {
      if (t.categoria && !idsConhecidos.has(t.categoria)) idsFaltantes.add(t.categoria);
    });

    idsFaltantes.forEach(id => {
      const legacy = LEGACY_CATEGORIES.find(c => c.id === id);
      if (legacy) {
        state.categorias.push({ ...legacy });
      } else if (id === OUTROS_ID) {
        state.categorias.push({ id: OUTROS_ID, name: 'Outros', emoji: '📦', color: '#9E9E9E' });
      } else {
        // categoria desconhecida (ex: dado corrompido/manual) — recupera
        // mostrando o próprio id como nome, em vez de sumir com o gasto.
        state.categorias.push({ id, name: id, emoji: '🏷️', color: '#9E9E9E' });
      }
      idsConhecidos.add(id);
    });

    return state;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY_STATE);
      if (!raw) return DEFAULT();
      const p = JSON.parse(raw);
      const d = DEFAULT();
      // IMPORTANTE: só cai pros valores padrão (`d.limites`/`d.gastosPorCategoria`,
      // com os 6 nomes legados) quando o campo nem existe no dado salvo
      // (estado muito antigo). Se `p.limites`/`p.gastosPorCategoria` já
      // existem, usamos exatamente o que está salvo — sem mesclar de volta
      // ids de categorias legadas que o usuário já excluiu. Misturar os
      // defaults aqui faria uma categoria excluída "reaparecer" sozinha no
      // próximo carregamento.
      const merged = {
        ...d, ...p,
        limites:            p.limites            || { ...d.limites },
        gastosPorCategoria: p.gastosPorCategoria || { ...d.gastosPorCategoria },
        historicoMeses:     p.historicoMeses || [],
        transacoes:         p.transacoes || [],
        categorias:         Array.isArray(p.categorias) ? p.categorias : undefined,
      };
      return migrarCategorias(merged);
    } catch { return DEFAULT(); }
  }

  function save(state) {
    localStorage.setItem(KEY_STATE, JSON.stringify(state));
  }

  return { load, save, OUTROS_ID, LEGACY_CATEGORIES };
})();