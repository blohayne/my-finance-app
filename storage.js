// storage.js — camada de persistência via localStorage

const Storage = (() => {
  const KEY_STATE = 'myfinance_state_v2';

  const CATS_DEFAULT = () => ({
    'Moradia & Contas': 0,
    'Mercado & Rotina': 0,
    'Transporte':       0,
    'Compras & Estilo': 0,
    'Lazer & Saídas':   0,
    'Saúde':            0,
  });

  const DEFAULT = () => ({
    saldo: 0,
    renda: 0,
    reserva: 0,
    transacoes: [],      // { id, tipo:'gasto'|'entrada', valor, categoria, data, mesAno:'2025-06' }
    limites: CATS_DEFAULT(),
    gastosPorCategoria: CATS_DEFAULT(),
    historicoMeses: [],  // [{ mesAno:'2025-06', totalGasto, totalLimite, porCategoria:{...} }]
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY_STATE);
      if (!raw) return DEFAULT();
      const p = JSON.parse(raw);
      const d = DEFAULT();
      return {
        ...d, ...p,
        limites:            { ...d.limites,            ...(p.limites || {}) },
        gastosPorCategoria: { ...d.gastosPorCategoria, ...(p.gastosPorCategoria || {}) },
        historicoMeses:     p.historicoMeses || [],
        transacoes:         p.transacoes || [],
      };
    } catch { return DEFAULT(); }
  }

  function save(state) {
    localStorage.setItem(KEY_STATE, JSON.stringify(state));
  }

  return { load, save };
})();