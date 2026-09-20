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

  const state = { gc: '', supervisao: '', rota: '', produto: '' };

  const selGc = document.getElementById('fGc');
  const selSv = document.getElementById('fSv');
  const selRota = document.getElementById('fRota');
  const selProduto = document.getElementById('fProduto');

  UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Selecione');
  const produtos = [...new Set(CadernoData.get().fatoProduto.map(r => r.produto))].sort();
  UI.fillSelect(selProduto, produtos, 'Todos');

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
  selProduto.addEventListener('change', () => { state.produto = selProduto.value; render(); });
  document.getElementById('btnClear').addEventListener('click', () => {
    state.gc = state.supervisao = state.rota = state.produto = '';
    selProduto.value = '';
    refreshDependentSelects(); render();
  });

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

    app.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard('Meta do Mês (Vol.)', CadernoData.fmtNum(agg.meta_v), `${CadernoData.fmtInt(agg.qtd_rotas)} rota(s)`)}
        ${kpiCard('Realizado (D-1)', CadernoData.fmtNum(agg.real_v), null, barPct(agg.pct_atingimento))}
        ${kpiCard('Atingimento', CadernoData.fmtPct(agg.pct_atingimento), signedSub(agg.real_x_meta))}
        ${kpiCard('Tendência de Fechamento', CadernoData.fmtNum(agg.tendencia), pctSub(agg.pct_tendencia, 'da meta'))}
        ${kpiCard('Venda Online (hoje)', CadernoData.fmtNum(agg.vol_online), CadernoData.fmtMoney(agg.fat_online))}
        ${kpiCard('Positivação (D-1)', `${CadernoData.fmtInt(cstats.positivadosReal)} / ${CadernoData.fmtInt(cstats.total)}`, pctSub(cstats.pctPositivacao, 'da carteira'))}
        ${kpiCard('Giro Zero', CadernoData.fmtInt(cstats.giroZero), cstats.total ? CadernoData.fmtPct(cstats.giroZero / cstats.total) + ' da carteira' : null, null, true)}
        ${kpiCard('Meta de Cobertura', CadernoData.fmtInt(agg.meta_c), `Real: ${CadernoData.fmtInt(agg.cobertura_real)}`)}
      </div>

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
        <h3>Grupos de Produto <span class="badge-count">${porProduto.length}</span></h3>
        <div class="table-scroll">
          <table class="data" id="tblProduto">
            <thead><tr>
              <th data-key="key">Grupo de Produto</th>
              <th data-key="meta_v" class="right">Meta</th>
              <th data-key="real_v" class="right">Real</th>
              <th data-key="real_x_meta" class="right">Real x Meta</th>
              <th data-key="pct_atingimento" class="right">%</th>
              <th data-key="tendencia" class="right">Tendência</th>
              <th data-key="cobertura_real" class="right">Cobertura</th>
            </tr></thead>
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
    UI.sortableTable(tblProduto, () => porProduto, rowProduto, 'pct_atingimento', 1).draw();

    const tblClientes = document.getElementById('tblClientes');
    const clientesOrdenados = rowsCliente.slice().sort((a, b) => Number(a.positivado_real) - Number(b.positivado_real));
    UI.sortableTable(tblClientes, () => clientesOrdenados, rowCliente, 'positivado_real', 1).draw();
  }

  function rowProduto(r) {
    return `<tr>
      <td>${r.key}</td>
      <td class="right mono">${CadernoData.fmtNum(r.meta_v)}</td>
      <td class="right mono">${CadernoData.fmtNum(r.real_v)}</td>
      <td class="right mono ${r.real_x_meta < 0 ? 'tag-neg' : 'tag-pos'}">${CadernoData.fmtSigned(r.real_x_meta)}</td>
      <td class="right">${UI.pctPill(r.pct_atingimento)}</td>
      <td class="right mono">${CadernoData.fmtNum(r.tendencia)}</td>
      <td class="right mono">${CadernoData.fmtInt(r.cobertura_real)}</td>
    </tr>`;
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
