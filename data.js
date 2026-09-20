/* ============================================================
   Caderno de Vendas - Grupo José Alves / IM
   Camada de dados compartilhada entre os HTMLs (Gestão e Consultor)
   ============================================================ */

const DATA_BASE = "./data";

const CadernoData = (() => {
  let _hierarquia = null;
  let _fatoProduto = null;
  let _fatoCliente = null;
  let _fatoKA = null;
  let _calendario = null;
  let _resumo = null;

  async function loadAll() {
    const [hier, fp, fc, ka, cal, res] = await Promise.all([
      fetch(`${DATA_BASE}/dim_hierarquia.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/fato_produto.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/fato_cliente.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/fato_keyaccount.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/calendario.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/resumo.json`).then(r => r.json()),
    ]);
    _hierarquia = hier; _fatoProduto = fp; _fatoCliente = fc;
    _fatoKA = ka; _calendario = cal; _resumo = res;
    return { hier, fp, fc, ka, cal, res };
  }

  const get = () => ({
    hierarquia: _hierarquia,
    fatoProduto: _fatoProduto,
    fatoCliente: _fatoCliente,
    fatoKA: _fatoKA,
    calendario: _calendario,
    resumo: _resumo,
  });

  // -------- Formatação PT-BR --------
  const fmtInt = n => Math.round(n || 0).toLocaleString('pt-BR');
  const fmtNum = (n, d = 1) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (n, d = 1) => (n === null || n === undefined) ? '—' : (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  const fmtMoney = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmtSigned = (n, d = 1) => {
    const v = (n || 0);
    const s = v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return v > 0 ? `+${s}` : s;
  };

  // -------- Filtros em cascata --------
  function getGerenciasAgrupadas() {
    return _hierarquia.map(g => g.gc_agrupada).sort();
  }
  function getGerenciasCruas(gcAgrupada) {
    const grp = _hierarquia.find(g => g.gc_agrupada === gcAgrupada);
    if (!grp) return _hierarquia.flatMap(g => g.gerencias.map(x => x.gc)).sort();
    return grp.gerencias.map(x => x.gc).sort();
  }
  function getAllGerenciasCruas() {
    return _hierarquia.flatMap(g => g.gerencias.map(x => x.gc)).sort();
  }
  function getSupervisoes(gcCrua) {
    for (const grp of _hierarquia) {
      const g = grp.gerencias.find(x => x.gc === gcCrua);
      if (g) return g.supervisoes.map(s => s.supervisao).sort();
    }
    return [];
  }
  function getRotas(supervisao) {
    for (const grp of _hierarquia) {
      for (const g of grp.gerencias) {
        const s = g.supervisoes.find(x => x.supervisao === supervisao);
        if (s) return s.rotas.slice().sort();
      }
    }
    return [];
  }
  function findGcAgrupadaOfCrua(gcCrua) {
    const grp = _hierarquia.find(g => g.gerencias.some(x => x.gc === gcCrua));
    return grp ? grp.gc_agrupada : null;
  }
  function findGcCruaOfSupervisao(sv) {
    for (const grp of _hierarquia) {
      for (const g of grp.gerencias) {
        if (g.supervisoes.some(s => s.supervisao === sv)) return g.gc;
      }
    }
    return null;
  }
  function findSupervisaoOfRota(rota) {
    for (const grp of _hierarquia) {
      for (const g of grp.gerencias) {
        for (const s of g.supervisoes) {
          if (s.rotas.includes(rota)) return s.supervisao;
        }
      }
    }
    return null;
  }

  // -------- Filtragem do fato_produto --------
  function filterProduto({ gcAgrupada, gc, supervisao, rota, produto } = {}) {
    return _fatoProduto.filter(r => {
      if (gcAgrupada && r.gc_agrupada !== gcAgrupada) return false;
      if (gc && r.gc !== gc) return false;
      if (supervisao && r.supervisao !== supervisao) return false;
      if (rota && r.rota !== rota) return false;
      if (produto && r.produto !== produto) return false;
      return true;
    });
  }

  function filterCliente({ gcAgrupada, gc, supervisao, rota } = {}) {
    return _fatoCliente.filter(r => {
      if (gcAgrupada && r.gc_agrupada !== gcAgrupada) return false;
      if (gc && r.gc !== gc) return false;
      if (supervisao && r.supervisao !== supervisao) return false;
      if (rota && r.rota !== rota) return false;
      return true;
    });
  }

  // -------- Agregação --------
  function aggregate(rows) {
    const out = {
      meta_v: 0, real_v: 0, tendencia: 0, fat_real: 0, fat_online: 0,
      vol_online: 0, cobertura_real: 0, cobertura_online: 0, meta_c: 0,
      n_rotas: new Set(), n_produtos: new Set(),
    };
    for (const r of rows) {
      out.meta_v += r.meta_v || 0;
      out.real_v += r.real_v || 0;
      out.tendencia += r.tendencia || 0;
      out.fat_real += r.fat_real || 0;
      out.fat_online += r.fat_online || 0;
      out.vol_online += r.vol_online || 0;
      out.cobertura_real += r.cobertura_real || 0;
      out.cobertura_online += r.cobertura_online || 0;
      out.meta_c += r.meta_c || 0;
      out.n_rotas.add(r.rota);
      out.n_produtos.add(r.produto);
    }
    out.pct_atingimento = out.meta_v ? out.real_v / out.meta_v : null;
    out.pct_tendencia = out.meta_v ? out.tendencia / out.meta_v : null;
    out.real_x_meta = out.real_v - out.meta_v;
    out.qtd_rotas = out.n_rotas.size;
    out.qtd_produtos = out.n_produtos.size;
    return out;
  }

  function aggregateByKey(rows, keyFn) {
    const map = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    const out = [];
    for (const [k, rs] of map) {
      out.push({ key: k, ...aggregate(rs) });
    }
    return out;
  }

  function clientStats(rows) {
    const total = rows.length;
    const positivadosReal = rows.filter(r => r.positivado_real).length;
    const positivadosOnline = rows.filter(r => r.positivado_online).length;
    const naoVisitados = total - positivadosReal - rows.filter(r => !r.positivado_real && r.positivado_online).length;
    return {
      total, positivadosReal, positivadosOnline,
      pctPositivacao: total ? positivadosReal / total : null,
      giroZero: total - positivadosReal,
    };
  }

  return {
    loadAll, get,
    fmtInt, fmtNum, fmtPct, fmtMoney, fmtSigned,
    getGerenciasAgrupadas, getGerenciasCruas, getAllGerenciasCruas,
    getSupervisoes, getRotas,
    findGcAgrupadaOfCrua, findGcCruaOfSupervisao, findSupervisaoOfRota,
    filterProduto, filterCliente,
    aggregate, aggregateByKey, clientStats,
  };
})();
