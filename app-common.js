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

  return { fillSelect, pctClass, pctPill, palette, barColorForPct, sortableTable };
})();
