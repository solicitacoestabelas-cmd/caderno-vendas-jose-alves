/* ============================================================
   Utilitários comuns de UI (filtros em cascata, cores, charts)
   ============================================================ */

const UI = (() => {
  function fillSelect(sel, values, placeholder) {
    const cur = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      values.map(v => `<option value="${v}">${v}</option>`).join('');
    if (values.includes(cur)) sel.value = cur;
  }

  function pctClass(pct) {
    if (pct === null || pct === undefined) return '';
    if (pct >= 0.95) return 'good';
    if (pct >= 0.8) return 'warn';
    return 'bad';
  }

  function pctPill(pct) {
    if (pct === null || pct === undefined) return `<span class="pill">—</span>`;
    const cls = pctClass(pct);
    return `<span class="pill ${cls}">${CadernoData.fmtPct(pct)}</span>`;
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#9aa1ad';
    Chart.defaults.borderColor = 'rgba(255,255,255,.08)';
    Chart.defaults.font.family = "'Inter', sans-serif";
  }

  const palette = {
    red: '#e30613',
    redDim: 'rgba(227,6,19,.35)',
    good: '#2ecc71',
    warn: '#f5a623',
    bad: '#e74c3c',
    grid: 'rgba(255,255,255,.06)',
    white: '#f2f3f5',
  };

  function barColorForPct(pct) {
    if (pct === null || pct === undefined) return '#454b58';
    if (pct >= 0.95) return palette.good;
    if (pct >= 0.8) return palette.warn;
    return palette.bad;
  }

  // ---- Blocos Volume / Cobertura (estilo SAP: Meta, Real+Online, Dif TT,
  // Meta Dia, Online, Dif Meta Dia, %) — usados nas tabelas de Grupos de
  // Produto e de Ranking, alternáveis por abas. ----
  function metricCols(kind) {
    if (kind === 'c') {
      return [
        { key: 'meta_c', label: 'Meta Cob.' },
        { key: 'real_online_c', label: 'Real+Online' },
        { key: 'dif_tt_c', label: 'Dif TT', signed: true },
        { key: 'meta_dia_c', label: 'Meta Dia' },
        { key: 'cobertura_online', label: 'Online' },
        { key: 'dif_meta_dia_c', label: 'Dif Meta Dia', signed: true },
        { key: 'pct_c', label: '%', pct: true },
      ];
    }
    return [
      { key: 'meta_v', label: 'Meta Vol.' },
      { key: 'real_online_v', label: 'Real+Online' },
      { key: 'dif_tt_v', label: 'Dif TT', signed: true },
      { key: 'meta_dia_v', label: 'Meta Dia' },
      { key: 'vol_online', label: 'Online' },
      { key: 'dif_meta_dia_v', label: 'Dif Meta Dia', signed: true },
      { key: 'pct_v', label: '%', pct: true },
    ];
  }
  function metricHeadHtml(kind, firstLabel, firstKey = 'key') {
    return `<th data-key="${firstKey}">${firstLabel}</th>` +
      metricCols(kind).map(c => `<th data-key="${c.key}" class="right">${c.label}</th>`).join('');
  }
  function metricRowHtml(r, kind) {
    return metricCols(kind).map(c => {
      const v = r[c.key];
      if (c.pct) return `<td class="right">${pctPill(v)}</td>`;
      if (c.signed) return `<td class="right mono ${(v || 0) < 0 ? 'tag-neg' : 'tag-pos'}">${CadernoData.fmtSigned(v, 0)}</td>`;
      return `<td class="right mono">${CadernoData.fmtInt(v)}</td>`;
    }).join('');
  }
  function viewToggleHtml(current, name) {
    return `<div class="view-toggle" data-toggle="${name}">
      <button class="btn sm ${current === 'v' ? '' : 'ghost'}" data-val="v">Volume</button>
      <button class="btn sm ${current === 'c' ? '' : 'ghost'}" data-val="c">Cobertura</button>
    </div>`;
  }
  function wireViewToggle(container, name, onChange) {
    container.querySelectorAll(`[data-toggle="${name}"] button`).forEach(btn => {
      btn.addEventListener('click', () => onChange(btn.dataset.val));
    });
  }

  function sortableTable(tableEl, getRows, renderRow, defaultSortKey, defaultDir = -1) {
    let sortKey = defaultSortKey;
    let dir = defaultDir;
    function draw() {
      const rows = getRows().slice().sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return av > bv ? dir : -dir;
      });
      const tbody = tableEl.querySelector('tbody');
      tbody.innerHTML = rows.map(renderRow).join('');
    }
    tableEl.querySelectorAll('th[data-key]').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        if (sortKey === k) dir = -dir; else { sortKey = k; dir = -1; }
        draw();
      });
    });
    return { draw, setSort: (k, d) => { sortKey = k; dir = d; draw(); } };
  }

  return {
    fillSelect, pctClass, pctPill, palette, barColorForPct, sortableTable,
    metricCols, metricHeadHtml, metricRowHtml, viewToggleHtml, wireViewToggle,
  };
})();
