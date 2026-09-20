/* ============================================================
   Dashboard de Gestão (Gerentes / Supervisores)
   ============================================================ */

(async function () {
  const app = document.getElementById('app');
  await CadernoData.loadAll();
  const { calendario, resumo } = CadernoData.get();

  document.getElementById('topMeta').innerHTML =
    `Dados gerados em <b>${new Date(calendario.gerado_em).toLocaleString('pt-BR')}</b><br>` +
    `Dia útil ${calendario.dias_uteis - calendario.dias_restantes} de ${calendario.dias_uteis} · ` +
    `${calendario.dias_corridos} dias corridos · ${calendario.dias_restantes} restantes`;

  const state = { gcAgrupada: '', gc: '', supervisao: '', rota: '', produto: '' };

  const selGcAgr = document.getElementById('fGcAgr');
  const selGc = document.getElementById('fGc');
  const selSv = document.getElementById('fSv');
  const selRota = document.getElementById('fRota');
  const selProduto = document.getElementById('fProduto');

  UI.fillSelect(selGcAgr, CadernoData.getGerenciasAgrupadas(), 'Todas');
  UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Todas');
  const produtos = [...new Set(CadernoData.get().fatoProduto.map(r => r.produto))].sort();
  UI.fillSelect(selProduto, produtos, 'Todos');

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
  selProduto.addEventListener('change', () => { state.produto = selProduto.value; render(); });
  document.getElementById('btnClear').addEventListener('click', () => {
    state.gcAgrupada = state.gc = state.supervisao = state.rota = state.produto = '';
    selGcAgr.value = ''; selProduto.value = '';
    refreshDependentSelects(); render();
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
    if (state.supervisao) return { field: 'rota', label: 'Rota' };
    if (state.gc) return { field: 'supervisao', label: 'Supervisão' };
    if (state.gcAgrupada) return { field: 'gc', label: 'Gerência' };
    return { field: 'gc_agrupada', label: 'Gerência' };
  }

  function render() {
    const rowsProduto = CadernoData.filterProduto(state);
    const rowsCliente = CadernoData.filterCliente(state);
    const agg = CadernoData.aggregate(rowsProduto);
    const cstats = CadernoData.clientStats(rowsCliente);

    const level = rankingLevel();
    let rankingRows = [];
    if (level) {
      const rowsForRanking = CadernoData.filterProduto({ ...state, produto: state.produto });
      rankingRows = CadernoData.aggregateByKey(rowsForRanking, r => r[level.field])
        .filter(r => r.key)
        .sort((a, b) => (a.pct_atingimento ?? -1) - (b.pct_atingimento ?? -1));
    }

    const porProduto = CadernoData.aggregateByKey(rowsProduto, r => r.produto)
      .filter(r => r.key)
      .sort((a, b) => (b.meta_v) - (a.meta_v));

    app.classList.remove('loading');
    app.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard('Meta do Mês (Vol.)', CadernoData.fmtNum(agg.meta_v), `${CadernoData.fmtInt(agg.qtd_rotas)} rota(s) · ${CadernoData.fmtInt(agg.qtd_produtos)} grupo(s)`)}
        ${kpiCard('Realizado (D-1)', CadernoData.fmtNum(agg.real_v), null, barPct(agg.pct_atingimento))}
        ${kpiCard('Atingimento', CadernoData.fmtPct(agg.pct_atingimento), signedSub(agg.real_x_meta))}
        ${kpiCard('Tendência de Fechamento', CadernoData.fmtNum(agg.tendencia), pctSub(agg.pct_tendencia, 'da meta'))}
        ${kpiCard('Faturamento Real', CadernoData.fmtMoney(agg.fat_real), `Online (dia): ${CadernoData.fmtMoney(agg.fat_online)}`)}
        ${kpiCard('Positivação (D-1)', `${CadernoData.fmtInt(cstats.positivadosReal)} / ${CadernoData.fmtInt(cstats.total)}`, pctSub(cstats.pctPositivacao, 'dos clientes'))}
        ${kpiCard('Giro Zero', CadernoData.fmtInt(cstats.giroZero), cstats.total ? CadernoData.fmtPct(cstats.giroZero / cstats.total) + ' da base' : null, null, true)}
        ${kpiCard('Meta de Cobertura', CadernoData.fmtInt(agg.meta_c), `Real: ${CadernoData.fmtInt(agg.cobertura_real)}`)}
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

      <div class="panel" style="margin-bottom:16px">
        <h3>Grupos de Produto <span class="badge-count">${porProduto.length}</span></h3>
        <div class="panel-sub">Clique nos cabeçalhos para ordenar</div>
        <div class="table-scroll">
          <table class="data" id="tblProduto">
            <thead><tr>
              <th data-key="key">Grupo de Produto</th>
              <th data-key="meta_v" class="right">Meta</th>
              <th data-key="real_v" class="right">Real</th>
              <th data-key="real_x_meta" class="right">Real x Meta</th>
              <th data-key="pct_atingimento" class="right">%</th>
              <th data-key="tendencia" class="right">Tendência</th>
              <th data-key="pct_tendencia" class="right">% Tend.</th>
              <th data-key="cobertura_real" class="right">Cobertura</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      ${level ? `
      <div class="panel">
        <h3>${level.label} <span class="badge-count">${rankingRows.length}</span></h3>
        <div class="panel-sub">Detalhe agregado do nível selecionado — clique nos cabeçalhos para ordenar</div>
        <div class="table-scroll">
          <table class="data" id="tblRanking">
            <thead><tr>
              <th data-key="key">${level.label}</th>
              <th data-key="meta_v" class="right">Meta</th>
              <th data-key="real_v" class="right">Real</th>
              <th data-key="pct_atingimento" class="right">%</th>
              <th data-key="pct_tendencia" class="right">% Tend.</th>
              <th data-key="meta_c" class="right">Meta Cobertura</th>
              <th data-key="cobertura_real" class="right">Cobertura Real</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>` : ''}
    `;

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
    UI.sortableTable(tblProduto, () => porProduto, rowProduto, 'meta_v').draw();

    if (level) {
      const tblRanking = document.getElementById('tblRanking');
      UI.sortableTable(tblRanking, () => rankingRows, rowRanking, 'pct_atingimento', 1).draw();
    }
  }

  function rowProduto(r) {
    return `<tr>
      <td>${r.key}</td>
      <td class="right mono">${CadernoData.fmtNum(r.meta_v)}</td>
      <td class="right mono">${CadernoData.fmtNum(r.real_v)}</td>
      <td class="right mono ${r.real_x_meta < 0 ? 'tag-neg' : 'tag-pos'}">${CadernoData.fmtSigned(r.real_x_meta)}</td>
      <td class="right">${UI.pctPill(r.pct_atingimento)}</td>
      <td class="right mono">${CadernoData.fmtNum(r.tendencia)}</td>
      <td class="right">${UI.pctPill(r.pct_tendencia)}</td>
      <td class="right mono">${CadernoData.fmtInt(r.cobertura_real)}</td>
    </tr>`;
  }
  function rowRanking(r) {
    return `<tr>
      <td>${r.key}</td>
      <td class="right mono">${CadernoData.fmtNum(r.meta_v)}</td>
      <td class="right mono">${CadernoData.fmtNum(r.real_v)}</td>
      <td class="right">${UI.pctPill(r.pct_atingimento)}</td>
      <td class="right">${UI.pctPill(r.pct_tendencia)}</td>
      <td class="right mono">${CadernoData.fmtInt(r.meta_c)}</td>
      <td class="right mono">${CadernoData.fmtInt(r.cobertura_real)}</td>
    </tr>`;
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
