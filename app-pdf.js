/* ============================================================
   Geração de PDF (Realizado D-1) por Gerência -> uma página por Rota
   ============================================================ */

(async function () {
  const { jsPDF } = window.jspdf;
  await CadernoData.loadAll();
  const { calendario } = CadernoData.get();

  document.getElementById('topMeta').innerHTML =
    `Dados gerados em <b>${new Date(calendario.gerado_em).toLocaleString('pt-BR')}</b><br>` +
    `Realizado sempre D-1 · ${calendario.dias_corridos} dias corridos de ${calendario.dias_uteis} úteis`;

  const selGc = document.getElementById('fGc');
  const btn = document.getElementById('btnGerar');
  const status = document.getElementById('status');

  UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Selecione a gerência');
  selGc.addEventListener('change', () => { btn.disabled = !selGc.value; });
  btn.addEventListener('click', () => gerarPdf(selGc.value));

  const RED = [227, 6, 19];
  const DARK = [17, 19, 23];
  const GREY = [110, 118, 130];
  const GOOD = [46, 204, 113];
  const WARN = [245, 166, 35];
  const BAD = [231, 76, 60];

  function corPct(pct) {
    if (pct === null || pct === undefined) return GREY;
    if (pct >= 0.95) return GOOD;
    if (pct >= 0.8) return WARN;
    return BAD;
  }

  function gerarPdf(gc) {
    status.textContent = 'Montando o documento…';
    btn.disabled = true;
    setTimeout(() => {
      try {
        const rotas = CadernoData.getSupervisoes(gc).flatMap(sv => CadernoData.getRotas(sv).map(r => ({ sv, rota: r })));
        rotas.sort((a, b) => a.rota.localeCompare(b.rota));

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        rotas.forEach((item, idx) => {
          if (idx > 0) doc.addPage();
          desenharPaginaRota(doc, pageW, pageH, gc, item.sv, item.rota);
        });

        const nomeArquivo = `Caderno_Vendas_${gc.replace(/\W+/g, '_')}_${calendario.gerado_em.slice(0, 10)}.pdf`;
        doc.save(nomeArquivo);
        status.textContent = `PDF gerado com ${rotas.length} página(s) — ${nomeArquivo}`;
      } catch (e) {
        console.error(e);
        status.textContent = 'Erro ao gerar PDF: ' + e.message;
      } finally {
        btn.disabled = false;
      }
    }, 30);
  }

  function desenharPaginaRota(doc, pageW, pageH, gc, sv, rota) {
    const margin = 28;

    const rowsProduto = CadernoData.filterProduto({ gc, supervisao: sv, rota });
    const rowsCliente = CadernoData.filterCliente({ gc, supervisao: sv, rota });
    const agg = CadernoData.aggregate(rowsProduto);
    const cstats = CadernoData.clientStats(rowsCliente);

    // ---- Cabeçalho ----
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageW, 64, 'F');
    doc.setFillColor(...RED);
    doc.rect(0, 60, pageW, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(18);
    doc.text('Coca-Cola', margin, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text('Grupo José Alves · Caderno de Vendas', margin, 44);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(`ROTA ${rota}`, pageW - margin, 28, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`${gc}  ·  ${sv}`, pageW - margin, 44, { align: 'right' });

    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Realizado D-1 · gerado em ${new Date(calendario.gerado_em).toLocaleString('pt-BR')} · ${calendario.dias_corridos}/${calendario.dias_uteis} dias úteis`, margin, 58);

    let y = 90;

    // ---- KPIs em destaque ----
    const kpis = [
      { l: 'Meta do Mês', v: CadernoData.fmtNum(agg.meta_v) },
      { l: 'Realizado', v: CadernoData.fmtNum(agg.real_v) },
      { l: 'Real x Meta', v: CadernoData.fmtSigned(agg.real_x_meta), cor: agg.real_x_meta < 0 ? BAD : GOOD },
      { l: '% Atingimento', v: CadernoData.fmtPct(agg.pct_atingimento), cor: corPct(agg.pct_atingimento) },
      { l: 'Tendência Fech.', v: CadernoData.fmtNum(agg.tendencia) },
      { l: 'Positivação', v: `${cstats.positivadosReal}/${cstats.total}`, cor: corPct(cstats.pctPositivacao) },
      { l: 'Giro Zero', v: String(cstats.giroZero), cor: cstats.giroZero > 0 ? BAD : GOOD },
    ];
    const kpiW = (pageW - margin * 2) / kpis.length;
    kpis.forEach((k, i) => {
      const x = margin + i * kpiW;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      if (i > 0) doc.line(x, y - 14, x, y + 26);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(k.l, x + 8, y - 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(...(k.cor || DARK));
      doc.text(k.v, x + 8, y + 18);
    });

    y += 44;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    // ---- Tabela de produtos, em 2 colunas compactas (cabe tudo numa página) ----
    const porProduto = CadernoData.aggregateByKey(rowsProduto, r => r.produto)
      .filter(r => r.key)
      .sort((a, b) => (a.pct_atingimento ?? -1) - (b.pct_atingimento ?? -1));

    const clientCol = 210;
    const gap = 10;
    const prodAreaW = pageW - margin * 2 - clientCol - gap;
    const prodColW = (prodAreaW - gap) / 2;
    const half = Math.ceil(porProduto.length / 2);
    const prodCol1 = porProduto.slice(0, half);
    const prodCol2 = porProduto.slice(half);

    function tabelaProduto(rows, x, w) {
      doc.autoTable({
        startY: y,
        margin: { left: x, right: pageW - x - w },
        tableWidth: w,
        head: [['Grupo de Produto', 'Meta', 'Real', '%']],
        body: rows.map(r => [
          r.key,
          CadernoData.fmtNum(r.meta_v, 0),
          CadernoData.fmtNum(r.real_v, 0),
          CadernoData.fmtPct(r.pct_atingimento, 0),
        ]),
        styles: { fontSize: 6.8, cellPadding: 2, textColor: [30, 30, 30], overflow: 'ellipsize' },
        headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold', fontSize: 6.8 },
        alternateRowStyles: { fillColor: [245, 245, 247] },
        columnStyles: { 0: { cellWidth: w - 30 - 26 - 34 }, 1: { cellWidth: 30, halign: 'right' }, 2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 34, halign: 'right', overflow: 'visible' } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            data.cell.styles.textColor = corPct(rows[data.row.index].pct_atingimento);
            data.cell.styles.fontStyle = 'bold';
          }
        },
        pageBreak: 'avoid',
      });
    }
    tabelaProduto(prodCol1, margin, prodColW);
    tabelaProduto(prodCol2, margin + prodColW + gap, prodColW);

    // ---- Lacunas de cobertura: só clientes em giro zero (D-1) ----
    const xClientes = margin + prodAreaW + gap;
    const giroZero = rowsCliente.filter(c => !c.positivado_real)
      .sort((a, b) => (a.nome_fantasia || '').localeCompare(b.nome_fantasia || ''));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text('LACUNAS DE COBERTURA (D-1)', xClientes, y - 4);

    if (giroZero.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GOOD);
      doc.text('Nenhuma lacuna — 100% da carteira', xClientes, y + 12);
    } else {
      doc.autoTable({
        startY: y + 4,
        margin: { left: xClientes, right: margin },
        tableWidth: clientCol,
        head: [['Cliente', 'Visita']],
        body: giroZero.map(c => [c.nome_fantasia || c.cod_cliente, c.dia_visita || '—']),
        styles: { fontSize: 6.8, cellPadding: 2, textColor: [30, 30, 30], overflow: 'ellipsize' },
        headStyles: { fillColor: [122, 10, 16], textColor: 255, fontStyle: 'bold', fontSize: 6.8 },
        alternateRowStyles: { fillColor: [250, 235, 235] },
        columnStyles: { 0: { cellWidth: clientCol - 46 }, 1: { cellWidth: 46, halign: 'center' } },
        pageBreak: 'avoid',
      });
    }

    // ---- Rodapé com espaço de anotação manual ----
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text('Meta Dia: __________     Plan Dia: __________     Real Dia (Online): __________     Visitas realizadas: __________ / ' + cstats.total, margin, pageH - 30);
    doc.text(`Rota ${rota} · ${sv} · ${gc}`, pageW - margin, pageH - 30, { align: 'right' });
  }
})();
