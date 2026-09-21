/* ============================================================
   Dashboard de Gestão (Gerentes / Supervisores)
   ============================================================ */

(async function () {
  const app = document.getElementById('app');
  await CadernoData.loadAll();
  const { calendario } = CadernoData.get();

  document.getElementById('topMeta').innerHTML =
    `Dados gerados em <b>${new Date(calendario.gerado_em).toLocaleString('pt-BR')}</b><br>` +
    `Dia útil ${calendario.dias_uteis - calendario.dias_restantes} de ${calendario.dias_uteis} · ` +
    `${calendario.dias_corridos} dias corridos · ${calendario.dias_restantes} restantes`;

  const state = { gcAgrupada: '', gc: '', supervisao: '', rota: '', grupoEspecie: '', produto: '', viewMetric: 'v' };

  const selGcAgr = document.getElementById('fGcAgr');
  const selGc = document.getElementById('fGc');
  const selSv = document.getElementById('fSv');
  const selRota = document.getElementById('fRota');
  const selGrupoEspecie = document.getElementById('fGrupoEspecie');
  const selProduto = document.getElementById('fProduto');

  UI.fillSelect(selGcAgr, CadernoData.getGerenciasAgrupadas(), 'Todas');
  UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Todas');
  UI.fillSelect(selGrupoEspecie, CadernoData.getGrupoEspecieOptions(), 'Todos');
  refreshProdutoOptions();

  function refreshProdutoOptions() {
    const produtos = CadernoData.getProdutosOrdenados(state.grupoEspecie || undefined).map(p => p.produto);
    UI.fillSelect(selProduto, produtos, 'Todos');
  }

  function refreshDependentSelects() {
    if (state.gcAgrupada) {
      UI.fillSelect(selGc, CadernoData.getGerenciasCruas(state.gcAgrupada), 'Todas');
    } else {
      UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Todas');
    }
    if (state.gc) {
      UI.fillSelect(selSv, CadernoData.getSupervisoes(state.gc), 'Todas');
    } else {
      selSv.innerHTML = `<option value="">Todas</option>`;
    }
    if (state.supervisao) {
      UI.fillSelect(selRota, CadernoData.getRotas(state.supervisao), 'Todas');
    } else {
      selRota.innerHTML = `<option value="">Todas</option>`;
    }
  }

  selGcAgr.addEventListener('change', () => {
    state.gcAgrupada = selGcAgr.value; state.gc = ''; state.supervisao = ''; state.rota = '';
    refreshDependentSelects(); render();
  });
  selGc.addEventListener('change', () => {
    state.gc = selGc.value;
    if (state.gc) state.gcAgrupada = CadernoData.findGcAgrupadaOfCrua(state.gc) || state.gcAgrupada;
    selGcAgr.value = state.gcAgrupada || '';
    state.supervisao = ''; state.rota = '';
    refreshDependentSelects(); render();
  });
  selSv.addEventListener('change', () => {
    state.supervisao = selSv.value;
    state.rota = '';
    refreshDependentSelects(); render();
  });
  selRota.addEventListener('change', () => { state.rota = selRota.value; render(); });
  selGrupoEspecie.addEventListener('change', () => {
    state.grupoEspecie = selGrupoEspecie.value;
    state.produto = ''; selProduto.value = '';
    refreshProdutoOptions();
    render();
  });
  selProduto.addEventListener('change', () => { state.produto = selProduto.value; render(); });
  document.getElementById('btnClear').addEventListener('click', () => {
    state.gcAgrupada = state.gc = state.supervisao = state.rota = state.grupoEspecie = state.produto = '';
    selGcAgr.value = ''; selGrupoEspecie.value = ''; selProduto.value = '';
    refreshDependentSelects(); refreshProdutoOptions(); render();
  });

  function currentFilterLabel() {
    if (state.rota) return `Rota ${state.rota}`;
    if (state.supervisao) return state.supervisao;
    if (state.gc) return state.gc;
    if (state.gcAgrupada) return state.gcAgrupada;
    return 'Todas as Gerências';
  }

  function rankingLevel() {
    if (state.rota) return null; // no nível de rota, mostramos produto, não ranking de rota
    if (state.supervisao) return { field: 'rota', label: 'Rota', parentLabel: 'a Supervisão' };
    if (state.gc) return { field: 'supervisao', label: 'Supervisão', parentLabel: 'a Gerência' };
    if (state.gcAgrupada) return { field: 'gc', label: 'Gerência', parentLabel: 'a Gerência Agrupada' };
    return { field: 'gc_agrupada', label: 'Gerência', parentLabel: 'o total' };
  }

  // Identifica, dentro do nível filho selecionado, quem mais "puxa a média
  // para baixo" do nível pai — maior gap negativo de Real x Meta.
  function acharArrasto(rankingRows) {
    const candidatos = rankingRows.filter(r => r.meta_v > 0 && r.real_x_meta < 0);
    if (candidatos.length < 2) return null;
    return candidatos.slice().sort((a, b) => a.real_x_meta - b.real_x_meta)[0];
  }

  function render() {
    const rowsProduto = CadernoData.filterProduto(state);
    const rowsCliente = CadernoData.filterCliente(state);
    const agg = CadernoData.aggregate(rowsProduto);
    const cstats = CadernoData.clientStats(rowsCliente);

    const level = rankingLevel();
    let rankingRows = [];
    let arrasto = null;
    if (level) {
      const rowsForRanking = CadernoData.filterProduto({ ...state, produto: state.produto });
      rankingRows = CadernoData.aggregateByKey(rowsForRanking, r => r[level.field])
        .filter(r => r.key)
        .sort((a, b) => (a.pct_atingimento ?? -1) - (b.pct_atingimento ?? -1));
      arrasto = acharArrasto(rankingRows);
    }

    const porProduto = CadernoData.aggregateByKey(rowsProduto, r => r.produto)
      .filter(r => r.key)
      .sort((a, b) => (b.meta_v) - (a.meta_v));

    app.classList.remove('loading');
    app.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard('Meta do Mês (Vol.)', CadernoData.fmtNum(agg.meta_v), `${CadernoData.fmtInt(agg.qtd_rotas)} rota(s) · ${CadernoData.fmtInt(agg.qtd_produtos)} grupo(s)`)}
        ${kpiCard('Realizado + Online', CadernoData.fmtNum(agg.real_online_v), null, barPct(agg.pct_v))}
        ${kpiCard('Atingimento', CadernoData.fmtPct(agg.pct_v), signedSub(agg.dif_tt_v))}
        ${kpiCard('Tendência de Fechamento', CadernoData.fmtNum(agg.tendencia), pctSub(agg.pct_tendencia, 'da meta'))}
        ${kpiCard('Positivação (D-1)', `${CadernoData.fmtInt(cstats.positivadosReal)} / ${CadernoData.fmtInt(cstats.total)}`, pctSub(cstats.pctPositivacao, 'dos clientes'))}
        ${kpiCard('Giro Zero', CadernoData.fmtInt(cstats.giroZero), cstats.total ? CadernoData.fmtPct(cstats.giroZero / cstats.total) + ' da base' : null, null, true)}
        ${kpiCard('Meta de Cobertura', CadernoData.fmtInt(agg.meta_c), `Real+Online: ${CadernoData.fmtInt(agg.real_online_c)}`, barPct(agg.pct_c))}
        ${kpiCard('Dif. Meta Dia (Vol.)', CadernoData.fmtSigned(agg.dif_meta_dia_v, 0), `Online hoje: ${CadernoData.fmtNum(agg.vol_online, 0)}`)}
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3>${level ? `Ranking por ${level.label}` : 'Detalhamento por Grupo de Produto'} <span class="badge-count">${currentFilterLabel()}</span></h3>
          <div class="panel-sub">${level ? 'Ordenado do menor para o maior % de atingimento — prioridade de atenção' : 'Rota selecionada: detalhe direto por produto'}</div>
          <canvas id="chartRanking" height="${Math.max(220, (level ? rankingRows.length : porProduto.length) * 22)}"></canvas>
        </div>
        <div class="panel">
          <h3>Positivação de Clientes</h3>
          <div class="panel-sub">${currentFilterLabel()}</div>
          <canvas id="chartPositivacao" height="220"></canvas>
        </div>
      </div>

      ${arrasto ? `
      <div class="drag-callout">
        <span class="ico">⚠️</span>
        <div><b>${level.label} ${arrasto.key}</b> é quem mais puxa ${level.parentLabel} para baixo —
        ${CadernoData.fmtSigned(arrasto.real_x_meta, 0)} vs meta (${CadernoData.fmtPct(arrasto.pct_atingimento)} de atingimento).
        Vale cobrar prioridade aí.</div>
      </div>` : ''}

      <div class="panel" style="margin-bottom:16px">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px">
          <div>
            <h3 style="margin-bottom:2px">Grupos de Produto <span class="badge-count">${porProduto.length}</span></h3>
            <div class="panel-sub" style="margin-bottom:0">Clique nos cabeçalhos para ordenar</div>
          </div>
          ${UI.viewToggleHtml(state.viewMetric, 'produto')}
        </div>
        <div class="table-scroll" style="margin-top:12px">
          <table class="data" id="tblProduto">
            <thead><tr>${UI.metricHeadHtml(state.viewMetric, 'Grupo de Produto')}</tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      ${level ? `
      <div class="panel">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px">
          <div>
            <h3 style="margin-bottom:2px">${level.label} <span class="badge-count">${rankingRows.length}</span></h3>
            <div class="panel-sub" style="margin-bottom:0">Detalhe agregado do nível selecionado — clique nos cabeçalhos para ordenar</div>
          </div>
          ${UI.viewToggleHtml(state.viewMetric, 'ranking')}
        </div>
        <div class="table-scroll" style="margin-top:12px">
          <table class="data" id="tblRanking">
            <thead><tr>${UI.metricHeadHtml(state.viewMetric, level.label)}</tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>` : ''}
    `;

    UI.wireViewToggle(app, 'produto', (v) => { state.viewMetric = v; render(); });
    UI.wireViewToggle(app, 'ranking', (v) => { state.viewMetric = v; render(); });

    // ---- Ranking chart ----
    const RANK_CAP = 150;
    const rkLabels = level ? rankingRows.map(r => r.key) : porProduto.map(r => r.key);
    const rkReal = level ? rankingRows.map(r => (r.pct_atingimento ?? 0) * 100) : porProduto.map(r => (r.pct_atingimento ?? 0) * 100);
    const rkColors = level ? rankingRows.map(r => UI.barColorForPct(r.pct_atingimento)) : porProduto.map(r => UI.barColorForPct(r.pct_atingimento));
    new Chart(document.getElementById('chartRanking'), {
      type: 'bar',
      data: { labels: rkLabels, datasets: [{ label: '% Atingimento', data: rkReal.map(v => Math.min(v, RANK_CAP)), backgroundColor: rkColors, borderRadius: 4 }] },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => rkReal[c.dataIndex].toFixed(1) + '%' + (rkReal[c.dataIndex] > RANK_CAP ? ' (barra limitada em ' + RANK_CAP + '% para leitura)' : '') } }
        },
        scales: { x: { max: RANK_CAP, grid: { color: UI.palette.grid }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } },
      }
    });

    // ---- Positivação chart ----
    new Chart(document.getElementById('chartPositivacao'), {
      type: 'doughnut',
      data: {
        labels: ['Positivados', 'Giro Zero'],
        datasets: [{ data: [cstats.positivadosReal, cstats.giroZero], backgroundColor: [UI.palette.good, UI.palette.bad], borderWidth: 0 }]
      },
      options: {
        cutout: '70%',
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // ---- Tables ----
    const tblProduto = document.getElementById('tblProduto');
    UI.sortableTable(tblProduto, () => porProduto, r => rowMetric(r, state.viewMetric), 'meta_v').draw();

    if (level) {
      const tblRanking = document.getElementById('tblRanking');
      UI.sortableTable(tblRanking, () => rankingRows, r => rowMetric(r, state.viewMetric), 'pct_atingimento', 1).draw();
    }
  }

  function rowMetric(r, kind) {
    return `<tr><td>${r.key}</td>${UI.metricRowHtml(r, kind)}</tr>`;
  }

  function kpiCard(label, val, sub, barHtml, isAlert) {
    return `<div class="kpi-card">
      <div class="lbl">${label}</div>
      <div class="val" style="${isAlert ? 'color:var(--bad)' : ''}">${val}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
      ${barHtml || ''}
    </div>`;
  }
  function barPct(pct) {
    if (pct === null || pct === undefined) return '';
    const p = Math.min(100, Math.max(0, pct * 100));
    return `<div class="bar"><i style="width:${p}%; background:${UI.barColorForPct(pct)}"></i></div>`;
  }
  function signedSub(v) {
    const cls = v < 0 ? 'bad' : 'good';
    return `<span class="sub ${cls}">${CadernoData.fmtSigned(v)} vs meta</span>`;
  }
  function pctSub(pct, suffix) {
    if (pct === null || pct === undefined) return null;
    return `${CadernoData.fmtPct(pct)} ${suffix}`;
  }

  refreshDependentSelects();
  render();
})();
