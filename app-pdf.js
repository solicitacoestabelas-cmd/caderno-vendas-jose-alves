/* ============================================================
   Geração de PDF (Realizado D-1) por Gerência -> uma página por Rota
   Matriz Cliente x Agrupador de Produto, somente clientes com visita
   agendada no dia selecionado.
   ============================================================ */

(async function () {
  const { jsPDF } = window.jspdf;
  await CadernoData.loadAll();
  const { calendario } = CadernoData.get();

  document.getElementById('topMeta').innerHTML =
    `Dados gerados em <b>${new Date(calendario.gerado_em).toLocaleString('pt-BR')}</b><br>` +
    `Realizado sempre D-1 · ${calendario.dias_corridos} dias corridos de ${calendario.dias_uteis} úteis`;

  const selGc = document.getElementById('fGc');
  const selDia = document.getElementById('fDia');
  const btn = document.getElementById('btnGerar');
  const status = document.getElementById('status');

  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const hojeAbrev = DIAS[new Date().getDay()];
  DIAS.filter(d => d !== 'Dom').forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d === hojeAbrev ? `${d} (hoje)` : d;
    if (d === hojeAbrev) opt.selected = true;
    selDia.appendChild(opt);
  });

  UI.fillSelect(selGc, CadernoData.getAllGerenciasCruas(), 'Selecione a gerência');
  selGc.addEventListener('change', () => { btn.disabled = !selGc.value; });
  btn.addEventListener('click', () => gerarPdf(selGc.value, selDia.value));

  const RED = [227, 6, 19];
  const DARK = [17, 19, 23];
  const GREY = [110, 118, 130];
  const GOOD = [46, 204, 113];
  const WARN = [245, 166, 35];
  const BAD = [231, 76, 60];
  const NAO_COMPRADO_BG = [250, 235, 235];
  const NAO_COMPRADO_TXT = [190, 60, 55];

  function corPct(pct) {
    if (pct === null || pct === undefined) return GREY;
    if (pct >= 0.95) return GOOD;
    if (pct >= 0.8) return WARN;
    return BAD;
  }

  // Pré-carrega a logo da Coca-Cola como <img> para uso com doc.addImage
  const logoCoca = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = './assets/coca-cola-logo.png';
  });

  function clienteTemVisitaNoDia(diaVisita, dia) {
    if (!diaVisita || diaVisita === '--') return false;
    return diaVisita.split(' - ').map(s => s.trim()).includes(dia);
  }

  async function gerarPdf(gc, dia) {
    status.textContent = 'Montando o documento…';
    btn.disabled = true;
    setTimeout(async () => {
      try {
        const rotas = CadernoData.getSupervisoes(gc).flatMap(sv => CadernoData.getRotas(sv).map(r => ({ sv, rota: r })));
        rotas.sort((a, b) => a.rota.localeCompare(b.rota));

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        let paginas = 0;
        for (const item of rotas) {
          const desenhou = await desenharPaginaRota(doc, pageW, pageH, gc, item.sv, item.rota, dia, paginas > 0);
          if (desenhou) paginas++;
        }

        if (paginas === 0) {
          status.textContent = `Nenhum cliente com visita agendada em ${dia} nesta gerência.`;
          btn.disabled = false;
          return;
        }

        const totalPaginasPdf = doc.internal.getNumberOfPages();
        const nomeArquivo = `Caderno_Vendas_${gc.replace(/\W+/g, '_')}_${dia}_${calendario.gerado_em.slice(0, 10)}.pdf`;
        doc.save(nomeArquivo);
        status.textContent = `PDF gerado — ${paginas} rota(s), ${totalPaginasPdf} página(s) — ${nomeArquivo}`;
      } catch (e) {
        console.error(e);
        status.textContent = 'Erro ao gerar PDF: ' + e.message;
      } finally {
        btn.disabled = false;
      }
    }, 30);
  }

  async function desenharPaginaRota(doc, pageW, pageH, gc, sv, rota, dia, jaTemPagina) {
    const margin = 26;

    const rowsProduto = CadernoData.filterProduto({ gc, supervisao: sv, rota });
    const rowsClienteRota = CadernoData.filterCliente({ gc, supervisao: sv, rota });
    const clientesHoje = rowsClienteRota
      .filter(c => clienteTemVisitaNoDia(c.dia_visita, dia))
      .sort((a, b) => (a.nome_fantasia || '').localeCompare(b.nome_fantasia || ''));

    if (clientesHoje.length === 0) return false; // rota não atende nesse dia

    if (jaTemPagina) doc.addPage();

    const agg = CadernoData.aggregate(rowsProduto);

    // Colunas: agrupadores realmente presentes nessa rota, na ordem de faturamento
    const produtosRota = new Set(rowsProduto.map(r => r.produto).filter(Boolean));
    const colunas = CadernoData.getProdutosOrdenados().filter(p => produtosRota.has(p.produto));

    // Dados cliente x produto da rota (carregado sob demanda)
    const cpRows = await CadernoData.loadClienteProdutoDaRota(rota);
    const porCliente = new Map();
    for (const r of cpRows) {
      if (!porCliente.has(r.cod_cliente)) porCliente.set(r.cod_cliente, new Map());
      porCliente.get(r.cod_cliente).set(r.produto, r.vol_real);
    }

    // ---- Cabeçalho ----
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageW, 60, 'F');
    doc.setFillColor(...RED);
    doc.rect(0, 56, pageW, 4, 'F');

    if (logoCoca) {
      const logoH = 22, logoW = logoH * (logoCoca.naturalWidth / logoCoca.naturalHeight || 3);
      doc.addImage(logoCoca, 'PNG', margin, 10, logoW, logoH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 200, 200);
      doc.text('Grupo José Alves · Caderno de Vendas', margin, 42);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(18);
      doc.text('Coca-Cola', margin, 26);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 200, 200);
      doc.text('Grupo José Alves · Caderno de Vendas', margin, 42);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(`ROTA ${rota}  ·  ${dia.toUpperCase()}`, pageW - margin, 26, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(200, 200, 200);
    doc.text(`${gc}  ·  ${sv}  ·  ${clientesHoje.length} cliente(s) agendado(s)`, pageW - margin, 42, { align: 'right' });

    let y = 78;

    // ---- KPIs em destaque (mês / rota inteira) ----
    const kpis = [
      { l: 'Meta do Mês', v: CadernoData.fmtNum(agg.meta_v) },
      { l: 'Realizado', v: CadernoData.fmtNum(agg.real_v) },
      { l: 'Real x Meta', v: CadernoData.fmtSigned(agg.real_x_meta), cor: agg.real_x_meta < 0 ? BAD : GOOD },
      { l: '% Atingimento', v: CadernoData.fmtPct(agg.pct_atingimento), cor: corPct(agg.pct_atingimento) },
      { l: 'Tendência Fech.', v: CadernoData.fmtNum(agg.tendencia) },
    ];
    const kpiW = (pageW - margin * 2) / kpis.length;
    kpis.forEach((k, i) => {
      const x = margin + i * kpiW;
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      if (i > 0) doc.line(x, y - 12, x, y + 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text(k.l, x + 8, y - 1);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...(k.cor || DARK));
      doc.text(k.v, x + 8, y + 15);
    });

    y += 34;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`CLIENTES COM VISITA HOJE (${dia.toUpperCase()}) — VOLUME REALIZADO (D-1) POR AGRUPADOR`, margin, y + 9);

    // legenda rápida
    doc.setFillColor(...NAO_COMPRADO_BG);
    doc.rect(pageW - margin - 150, y + 1, 9, 9, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text('não comprou o agrupador', pageW - margin - 138, y + 9);

    y += 16;

    // ---- Matriz cliente x agrupador ----
    const clienteColW = 120;
    const usable = pageW - margin * 2 - clienteColW;
    const nCols = Math.max(colunas.length, 1);
    const prodColW = Math.max(13, Math.min(20, usable / nCols));

    const headRow = ['Cliente', ...colunas.map(() => '')];
    const body = clientesHoje.map(c => {
      const mapa = porCliente.get(c.cod_cliente);
      return [
        c.nome_fantasia || c.cod_cliente,
        ...colunas.map(col => {
          const v = mapa ? mapa.get(col.produto) : undefined;
          if (v === undefined || v === null) return '—';
          if (v < 10) return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
          return String(Math.round(v)); // sem separador de milhar, para caber na coluna estreita
        }),
      ];
    });

    const columnStyles = { 0: { cellWidth: clienteColW, fontStyle: 'normal', halign: 'left' } };
    colunas.forEach((_, i) => { columnStyles[i + 1] = { cellWidth: prodColW, halign: 'center' }; });

    const maiorNomeProduto = Math.max(...colunas.map(c => c.produto.length), 6);
    const headerRowHeight = Math.min(140, Math.max(50, 10 + maiorNomeProduto * 4.9));

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin, bottom: 36, top: 34 },
      head: [headRow],
      body,
      styles: { fontSize: 6.3, cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 }, textColor: [30, 30, 30], overflow: 'ellipsize', lineColor: [225, 225, 228], lineWidth: 0.4 },
      headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold', fontSize: 6.6, minCellHeight: headerRowHeight, valign: 'bottom' },
      alternateRowStyles: { fillColor: [246, 246, 248] },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const naoComprou = data.cell.raw === '—';
          if (naoComprou) {
            data.cell.styles.fillColor = NAO_COMPRADO_BG;
            data.cell.styles.textColor = NAO_COMPRADO_TXT;
          } else {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [20, 90, 40];
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'head' && data.column.index > 0) {
          const col = colunas[data.column.index - 1];
          if (!col) return;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.4);
          doc.setTextColor(255, 255, 255);
          const x = data.cell.x + data.cell.width / 2 + 2;
          const yBase = data.cell.y + data.cell.height - 5;
          doc.text(col.produto, x, yBase, { angle: 90, align: 'left' });
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFillColor(...DARK);
          doc.rect(0, 0, pageW, 26, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.setTextColor(255, 255, 255);
          doc.text(`ROTA ${rota} (continuação)  ·  ${sv}  ·  ${gc}  ·  ${dia.toUpperCase()}`, margin, 17);
        }
      },
    });

    // ---- Rodapé com espaço de anotação manual ----
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageH - 26, pageW - margin, pageH - 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`Visitas realizadas: __________ / ${clientesHoje.length}`, margin, pageH - 12);
    doc.text(`Rota ${rota} · ${sv} · ${gc} · Realizado D-1`, pageW - margin, pageH - 12, { align: 'right' });

    return true;
  }
})();
