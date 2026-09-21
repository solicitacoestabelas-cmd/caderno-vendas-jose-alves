/* ============================================================
   Visão do Consultor (Vendedor) — foco na própria rota
   ============================================================ */

(async function () {
  const app = document.getElementById('app');
  await CadernoData.loadAll();
  const { calendario } = CadernoData.get();

  document.getElementById('topMeta').innerHTML =
    `Dados gerados em <b>${new Date(calendario.gerado_em).toLocaleString('pt-BR')}</b><br>` +
    `Dia útil ${calendario.dias_uteis - calendario.dias_restantes} de ${calendario.dias_uteis} · ` +
    `${calendario.dias_corridos} dias corridos · ${calendario.dias_restantes} restantes`;

  const state = { gc: '', supervisao: '', rota: '', grupoEspecie: '', produto: '', viewMetric: 'v' };

  const selGc = document.getElementById('fGc');
  const selSv = document.getElementById('fSv');
  const selRota = document.getElementById('fRota');
  const selGrupoEspecie = document.getElementById('fGrupoEspecie');
  const selProduto = document.getElementById('fProduto');

  UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Selecione');
  UI.fillSelect(selGrupoEspecie, CadernoData.getGrupoEspecieOptions(), 'Todos');
  refreshProdutoOptions();

  function refreshProdutoOptions() {
    const produtos = CadernoData.getProdutosOrdenados(state.grupoEspecie || undefined).map(p => p.produto);
    UI.fillSelect(selProduto, produtos, 'Todos');
  }

  function refreshDependentSelects() {
    if (state.gc) UI.fillSelect(selSv, CadernoData.getSupervisoes(state.gc), 'Selecione');
    else selSv.innerHTML = `<option value="">Selecione</option>`;
    if (state.supervisao) UI.fillSelect(selRota, CadernoData.getRotas(state.supervisao), 'Selecione');
    else selRota.innerHTML = `<option value="">Selecione</option>`;
  }

  selGc.addEventListener('change', () => {
    state.gc = selGc.value; state.supervisao = ''; state.rota = '';
    refreshDependentSelects(); render();
  });
  selSv.addEventListener('change', () => {
    state.supervisao = selSv.value; state.rota = '';
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
    state.gc = state.supervisao = state.rota = state.grupoEspecie = state.produto = '';
    selGrupoEspecie.value = ''; selProduto.value = '';
    refreshDependentSelects(); refreshProdutoOptions(); render();
  });

  // Quando o Consultor está vendo a Supervisão inteira (todas as rotas dela),
  // mostra qual Rota está puxando a média para baixo — mesmo espírito do
  // dashboard de Gestão, só que na escala do consultor.
  function acharArrasto(rows) {
    const candidatos = rows.filter(r => r.meta_v > 0 && r.real_x_meta < 0);
    if (candidatos.length < 2) return null;
    return candidatos.slice().sort((a, b) => a.real_x_meta - b.real_x_meta)[0];
  }

  function render() {
    if (!state.rota && !state.supervisao && !state.gc) {
      app.classList.add('loading');
      app.innerHTML = 'Selecione a sua Gerência, Supervisão e Rota acima.';
      return;
    }
    app.classList.remove('loading');

    const rowsProduto = CadernoData.filterProduto(state);
    const rowsCliente = CadernoData.filterCliente(state);
    const agg = CadernoData.aggregate(rowsProduto);
    const cstats = CadernoData.clientStats(rowsCliente);

    const porProduto = CadernoData.aggregateByKey(rowsProduto, r => r.produto)
      .filter(r => r.key)
      .sort((a, b) => (a.pct_atingimento ?? -1) - (b.pct_atingimento ?? -1));

    const label = state.rota ? `Rota ${state.rota}` : (state.supervisao || state.gc);

    // Ranking por rota só faz sentido quando não há uma rota específica escolhida
    let rankingRotas = [];
    let arrasto = null;
    if (!state.rota) {
      const campoAgrup = state.supervisao ? 'rota' : 'supervisao';
      const rowsBase = CadernoData.filterProduto({ gc: state.gc, supervisao: state.supervisao, grupoEspecie: state.grupoEspecie, produto: state.produto });
      rankingRotas = CadernoData.aggregateByKey(rowsBase, r => r[campoAgrup])
        .filter(r => r.key)
        .sort((a, b) => (a.pct_atingimento ?? -1) - (b.pct_atingimento ?? -1));
      arrasto = acharArrasto(rankingRotas);
    }

    app.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard('Meta do Mês (Vol.)', CadernoData.fmtNum(agg.meta_v), `${CadernoData.fmtInt(agg.qtd_rotas)} rota(s)`)}
        ${kpiCard('Realizado + Online', CadernoData.fmtNum(agg.real_online_v), null, barPct(agg.pct_v))}
        ${kpiCard('Atingimento', CadernoData.fmtPct(agg.pct_v), signedSub(agg.dif_tt_v))}
        ${kpiCard('Tendência de Fechamento', CadernoData.fmtNum(agg.tendencia), pctSub(agg.pct_tendencia, 'da meta'))}
        ${kpiCard('Venda Online (hoje)', CadernoData.fmtNum(agg.vol_online, 0), `Meta dia: ${CadernoData.fmtNum(agg.meta_dia_v, 0)}`)}
        ${kpiCard('Positivação (D-1)', `${CadernoData.fmtInt(cstats.positivadosReal)} / ${CadernoData.fmtInt(cstats.total)}`, pctSub(cstats.pctPositivacao, 'da carteira'))}
        ${kpiCard('Giro Zero', CadernoData.fmtInt(cstats.giroZero), cstats.total ? CadernoData.fmtPct(cstats.giroZero / cstats.total) + ' da carteira' : null, null, true)}
        ${kpiCard('Meta de Cobertura', CadernoData.fmtInt(agg.meta_c), `Real+Online: ${CadernoData.fmtInt(agg.real_online_c)}`, barPct(agg.pct_c))}
      </div>

      ${arrasto ? `
      <div class="drag-callout">
        <span class="ico">⚠️</span>
        <div><b>${state.supervisao ? 'Rota' : 'Supervisão'} ${arrasto.key}</b> é quem mais puxa
        ${state.supervisao ? 'a Supervisão' : 'a Gerência'} para baixo —
        ${CadernoData.fmtSigned(arrasto.real_x_meta, 0)} vs meta (${CadernoData.fmtPct(arrasto.pct_atingimento)} de atingimento).</div>
      </div>` : ''}

      <div class="grid-2">
        <div class="panel">
          <h3>Onde está a lacuna por Grupo de Produto <span class="badge-count">${label}</span></h3>
          <div class="panel-sub">Ordenado do menor % de atingimento para o maior</div>
          <canvas id="chartGap" height="${Math.max(220, porProduto.length * 22)}"></canvas>
        </div>
        <div class="panel">
          <h3>Cobertura da Carteira</h3>
          <div class="panel-sub">${label}</div>
          <canvas id="chartCobertura" height="220"></canvas>
        </div>
      </div>

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

      <div class="panel">
        <h3>Clientes da Carteira <span class="badge-count">${rowsCliente.length}</span></h3>
        <div class="panel-sub">Clientes em giro zero aparecem primeiro — priorize a visita</div>
        <div class="table-scroll">
          <table class="data" id="tblClientes">
            <thead><tr>
              <th data-key="nome_fantasia">Cliente</th>
              <th data-key="segmento">Segmento</th>
              <th data-key="dia_visita">Dia de Visita</th>
              <th data-key="positivado_real" class="center">Positivou (D-1)?</th>
              <th data-key="positivado_online" class="center">Vendeu Hoje?</th>
              <th data-key="qtd_grupos_positivados" class="right">Grupos Positivados</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;

    UI.wireViewToggle(app, 'produto', (v) => { state.viewMetric = v; render(); });

    const GAP_CAP = 150;
    const gapReal = porProduto.map(r => (r.pct_atingimento ?? 0) * 100);
    new Chart(document.getElementById('chartGap'), {
      type: 'bar',
      data: {
        labels: porProduto.map(r => r.key),
        datasets: [{ label: '% Atingimento', data: gapReal.map(v => Math.min(v, GAP_CAP)), backgroundColor: porProduto.map(r => UI.barColorForPct(r.pct_atingimento)), borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => gapReal[c.dataIndex].toFixed(1) + '%' + (gapReal[c.dataIndex] > GAP_CAP ? ' (barra limitada em ' + GAP_CAP + '% para leitura)' : '') } }
        },
        scales: { x: { max: GAP_CAP, grid: { color: UI.palette.grid }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } },
      }
    });

    new Chart(document.getElementById('chartCobertura'), {
      type: 'doughnut',
      data: {
        labels: ['Positivados', 'Giro Zero'],
        datasets: [{ data: [cstats.positivadosReal, cstats.giroZero], backgroundColor: [UI.palette.good, UI.palette.bad], borderWidth: 0 }]
      },
      options: { cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });

    const tblProduto = document.getElementById('tblProduto');
    UI.sortableTable(tblProduto, () => porProduto, r => rowMetric(r, state.viewMetric), 'pct_atingimento', 1).draw();

    const tblClientes = document.getElementById('tblClientes');
    const clientesOrdenados = rowsCliente.slice().sort((a, b) => Number(a.positivado_real) - Number(b.positivado_real));
    UI.sortableTable(tblClientes, () => clientesOrdenados, rowCliente, 'positivado_real', 1).draw();
  }

  function rowMetric(r, kind) {
    return `<tr><td>${r.key}</td>${UI.metricRowHtml(r, kind)}</tr>`;
  }
  function rowCliente(c) {
    return `<tr>
      <td>${c.nome_fantasia || c.cod_cliente}</td>
      <td>${c.segmento || '—'}</td>
      <td>${c.dia_visita || '—'}</td>
      <td class="center">${c.positivado_real ? '<span class="pill good">Sim</span>' : '<span class="pill bad">Não</span>'}</td>
      <td class="center">${c.positivado_online ? '<span class="pill good">Sim</span>' : '<span class="pill">—</span>'}</td>
      <td class="right mono">${c.qtd_grupos_positivados}</td>
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
})();
