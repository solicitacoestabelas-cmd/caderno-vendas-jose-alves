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
  let _grupoEspecieOrder = null;
  const _clienteProdutoCache = new Map();

  async function loadAll() {
    const [hier, fp, fc1, fc2, ka, cal, res, ge] = await Promise.all([
      fetch(`${DATA_BASE}/dim_hierarquia.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/fato_produto.json`).then(r => r.json()),
      // fato_cliente.json é dividido em 2 partes (limite de tamanho de upload) —
      // sempre carregadas juntas e concatenadas aqui.
      fetch(`${DATA_BASE}/fato_cliente_1.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/fato_cliente_2.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/fato_keyaccount.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/calendario.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/resumo.json`).then(r => r.json()),
      fetch(`${DATA_BASE}/dim_grupo_especie.json`).then(r => r.json()),
    ]);
    const fc = fc1.concat(fc2);
    _hierarquia = hier; _fatoProduto = fp; _fatoCliente = fc;
    _fatoKA = ka; _calendario = cal; _resumo = res; _grupoEspecieOrder = ge;
    return { hier, fp, fc, ka, cal, res, ge };
  }

  // Carrega sob demanda a matriz esparsa cliente x produto de UMA rota
  // (usada só pelo gerador de PDF). Resultado fica em cache na sessão.
  async function loadClienteProdutoDaRota(rota) {
    if (_clienteProdutoCache.has(rota)) return _clienteProdutoCache.get(rota);
    const safe = encodeURIComponent(rota);
    let rows = [];
    try {
      const r = await fetch(`${DATA_BASE}/cliente_produto/${safe}.json`);
      if (r.ok) rows = await r.json();
    } catch (e) { rows = []; }
    _clienteProdutoCache.set(rota, rows);
    return rows;
  }

  const get = () => ({
    hierarquia: _hierarquia,
    fatoProduto: _fatoProduto,
    fatoCliente: _fatoCliente,
    fatoKA: _fatoKA,
    calendario: _calendario,
    resumo: _resumo,
    grupoEspecieOrder: _grupoEspecieOrder,
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
  function filterProduto({ gcAgrupada, gc, supervisao, rota, produto, grupoEspecie } = {}) {
    return _fatoProduto.filter(r => {
      if (gcAgrupada && r.gc_agrupada !== gcAgrupada) return false;
      if (gc && r.gc !== gc) return false;
      if (supervisao && r.supervisao !== supervisao) return false;
      if (rota && r.rota !== rota) return false;
      if (produto && r.produto !== produto) return false;
      if (grupoEspecie && r.grupo_especie !== grupoEspecie) return false;
      return true;
    });
  }

  // Lista de Agrupador Produto na ordem fixa de Grupo Espécie (ordem de faturamento),
  // e alfabética dentro de cada grupo. Opcionalmente restrita a um Grupo Espécie.
  function getProdutosOrdenados(grupoEspecie) {
    const porProduto = new Map();
    for (const r of _fatoProduto) {
      if (!r.produto) continue;
      if (grupoEspecie && r.grupo_especie !== grupoEspecie) continue;
      if (!porProduto.has(r.produto)) porProduto.set(r.produto, r.grupo_especie || 'Outros');
    }
    const ordem = _grupoEspecieOrder || [];
    const rank = g => { const i = ordem.indexOf(g); return i === -1 ? ordem.length : i; };
    return [...porProduto.entries()]
      .sort((a, b) => rank(a[1]) - rank(b[1]) || a[0].localeCompare(b[0]))
      .map(([produto, grupo]) => ({ produto, grupo_especie: grupo }));
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
      meta_dia_v: 0, meta_dia_c: 0,
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
      out.meta_dia_v += r.meta_dia_v || 0;
      out.meta_dia_c += r.meta_dia_c || 0;
      out.n_rotas.add(r.rota);
      out.n_produtos.add(r.produto);
    }
    out.pct_atingimento = out.meta_v ? out.real_v / out.meta_v : null;
    out.pct_tendencia = out.meta_v ? out.tendencia / out.meta_v : null;
    out.real_x_meta = out.real_v - out.meta_v;
    out.qtd_rotas = out.n_rotas.size;
    out.qtd_produtos = out.n_produtos.size;

    // ---- Blocos estilo SAP: Volume e Cobertura, cada um com
    // Meta / Real+Online / Dif TT / Meta Dia / Online / Dif Meta Dia / % ----
    out.real_online_v = out.real_v + out.vol_online;
    out.dif_tt_v = out.real_online_v - out.meta_v;
    out.dif_meta_dia_v = out.vol_online - out.meta_dia_v;
    out.pct_v = out.meta_v ? out.real_online_v / out.meta_v : null;

    out.real_online_c = out.cobertura_real + out.cobertura_online;
    out.dif_tt_c = out.real_online_c - out.meta_c;
    out.dif_meta_dia_c = out.cobertura_online - out.meta_dia_c;
    out.pct_c = out.meta_c ? out.real_online_c / out.meta_c : null;

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

  function getGrupoEspecieOptions() {
    const presentes = new Set(_fatoProduto.map(r => r.grupo_especie).filter(Boolean));
    const ordem = _grupoEspecieOrder || [];
    const emOrdem = ordem.filter(g => presentes.has(g));
    const extras = [...presentes].filter(g => !ordem.includes(g)).sort();
    return [...emOrdem, ...extras];
  }

  return {
    loadAll, get, loadClienteProdutoDaRota,
    fmtInt, fmtNum, fmtPct, fmtMoney, fmtSigned,
    getGerenciasAgrupadas, getGerenciasCruas, getAllGerenciasCruas,
    getSupervisoes, getRotas, getProdutosOrdenados, getGrupoEspecieOptions,
    findGcAgrupadaOfCrua, findGcCruaOfSupervisao, findSupervisaoOfRota,
    filterProduto, filterCliente,
    aggregate, aggregateByKey, clientStats,
  };
})();
