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
    `Realizado sempre D-1 · Dia útil ${calendario.dias_corridos} de ${calendario.dias_uteis} · ${calendario.dias_restantes} restante(s)`;

  const selGc = document.getElementById('fGc');
  const selDia = document.getElementById('fDia');
  const btn = document.getElementById('btnGerar');
  const status = document.getElementById('status');

  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const DIAS_UTEIS = DIAS.filter(d => d !== 'Dom');
  const hojeAbrev = DIAS[new Date().getDay()];

  const optTodosDia = document.createElement('option');
  optTodosDia.value = 'TODOS_DIA';
  optTodosDia.textContent = 'Todos os dias (separado por dia)';
  selDia.appendChild(optTodosDia);

  const optTodosClientes = document.createElement('option');
  optTodosClientes.value = 'TODOS_CLIENTES';
  optTodosClientes.textContent = 'Todos os clientes da rota (dia em coluna)';
  selDia.appendChild(optTodosClientes);

  DIAS_UTEIS.forEach(d => {
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
  const NAO_COMPRADO_BG = [250, 235, 235];
  const NAO_COMPRADO_TXT = [190, 60, 55];
  const OK_TXT = [20, 120, 60];
  const OK_BG_LEGENDA = [227, 246, 235];
  const MINI_LABEL_BG = [235, 236, 239];
  const MINI_BORDER = [205, 207, 212];

  // Pré-carrega as logos (Coca-Cola e IM) como <img> para uso com doc.addImage
  function preloadImg(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  const [logoCoca, logoIm] = await Promise.all([
    preloadImg('./assets/coca-cola-logo.png'),
    preloadImg('./assets/im-logo.png'),
  ]);

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

        const dias = dia === 'TODOS_DIA' ? DIAS_UTEIS : [dia];

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();

        let entradas = 0;
        for (const d of dias) {
          for (const item of rotas) {
            const desenhou = await desenharPaginaRota(doc, pageW, pageH, gc, item.sv, item.rota, d, entradas > 0);
            if (desenhou) entradas++;
          }
        }

        if (entradas === 0) {
          let msg;
          if (dia === 'TODOS_DIA') msg = 'Nenhum cliente com visita agendada nesta gerência.';
          else if (dia === 'TODOS_CLIENTES') msg = 'Nenhum cliente cadastrado nas rotas desta gerência.';
          else msg = `Nenhum cliente com visita agendada em ${dia} nesta gerência.`;
          status.textContent = msg;
          btn.disabled = false;
          return;
        }

        const totalPaginasPdf = doc.internal.getNumberOfPages();
        const nomeArquivo = `Caderno_Vendas_${gc.replace(/\W+/g, '_')}_${dia}_${calendario.gerado_em.slice(0, 10)}.pdf`;
        doc.save(nomeArquivo);
        const rotulo = dia === 'TODOS_DIA' ? `${entradas} rota-dia(s)` : `${entradas} rota(s)`;
        status.textContent = `PDF gerado — ${rotulo}, ${totalPaginasPdf} página(s) — ${nomeArquivo}`;
      } catch (e) {
        console.error(e);
        status.textContent = 'Erro ao gerar PDF: ' + e.message;
      } finally {
        btn.disabled = false;
      }
    }, 30);
  }

  // Desenha o pequeno quadro Rota/Vendedor · Supervisão/Supervisor · Gerência/Gerente
  // (letra pequena, para poupar espaço vertical para a tabela de clientes).
  function desenharMiniTabelaPessoas(doc, x, y, linhas) {
    const codW = 58, nomeW = 195, rowH = 10.5;
    const totalW = codW + nomeW;
    doc.setDrawColor(...MINI_BORDER);
    doc.setLineWidth(0.4);
    linhas.forEach((ln, i) => {
      const ry = y + i * rowH;
      doc.setFillColor(...MINI_LABEL_BG);
      doc.rect(x, ry, codW, rowH, 'F');
      doc.rect(x, ry, totalW, rowH, 'S');
      doc.line(x + codW, ry, x + codW, ry + rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(...DARK);
      doc.text(ln.code || '—', x + 4, ry + rowH - 3.3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(40, 40, 40);
      const nome = (ln.nome || '—').toUpperCase();
      doc.text(nome, x + codW + 5, ry + rowH - 3.3, { maxWidth: nomeW - 8 });
    });
    return y + linhas.length * rowH;
  }

  async function desenharPaginaRota(doc, pageW, pageH, gc, sv, rota, dia, jaTemPagina) {
    const margin = 22;
    const modoTodosClientes = dia === 'TODOS_CLIENTES';

    const rowsClienteRota = CadernoData.filterCliente({ gc, supervisao: sv, rota });
    const clientesHoje = (modoTodosClientes
      ? rowsClienteRota.slice()
      : rowsClienteRota.filter(c => clienteTemVisitaNoDia(c.dia_visita, dia))
    ).sort((a, b) => (a.nome_fantasia || '').localeCompare(b.nome_fantasia || ''));

    if (clientesHoje.length === 0) return false; // rota não atende nesse dia / não tem clientes

    if (jaTemPagina) doc.addPage();

    const rowsProduto = CadernoData.filterProduto({ gc, supervisao: sv, rota });

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

    const pessoas = CadernoData.getPessoas(rota);

    // ---- Cabeçalho (barra escura, uma única linha) ----
    const barH = 28;
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageW, barH, 'F');
    doc.setFillColor(...RED);
    doc.rect(0, barH, pageW, 3, 'F');

    let logoRight = margin;
    if (logoCoca) {
      const logoH = 14, logoW = logoH * (logoCoca.naturalWidth / logoCoca.naturalHeight || 3);
      doc.addImage(logoCoca, 'PNG', margin, 7, logoW, logoH);
      logoRight = margin + logoW;
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(13);
      doc.text('Coca-Cola', margin, 19);
      logoRight = margin + 60;
    }
    if (logoIm) {
      const imH = 18, imW = imH * (logoIm.naturalWidth / logoIm.naturalHeight || 1);
      doc.addImage(logoIm, 'PNG', logoRight + 12, (barH - imH) / 2, imW, imH);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(255, 255, 255);
    const tituloDia = modoTodosClientes ? 'TODOS OS CLIENTES' : dia.toUpperCase();
    doc.text(`ROTA ${rota}  ·  ${tituloDia}`, pageW - margin, 19, { align: 'right' });

    let y = barH + 3 + 8;

    // ---- Bloco de identificação (rota/vendedor · supervisão/supervisor · gerência/gerente) ----
    const miniTop = y;
    desenharMiniTabelaPessoas(doc, margin, miniTop, [
      { code: `ROTA ${rota}`, nome: pessoas.vendedor },
      { code: sv, nome: pessoas.supervisor },
      { code: gc, nome: pessoas.gerente },
    ]);

    // ---- Bloco de calendário + contagem (lado direito, alinhado ao bloco de pessoas) ----
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(`Dia útil ${calendario.dias_corridos} de ${calendario.dias_uteis}`, pageW - margin, miniTop + 9, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...GREY);
    doc.text(`${calendario.dias_restantes} dias úteis restantes`, pageW - margin, miniTop + 19, { align: 'right' });
    doc.text(`${clientesHoje.length} Quantidade de clientes`, pageW - margin, miniTop + 29, { align: 'right' });

    y = miniTop + 3 * 10.5 + 8;

    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.setTextColor(...DARK);
    const tituloFaixa = modoTodosClientes
      ? 'TODOS OS CLIENTES DA ROTA — REALIZADO (D-1) POR AGRUPADOR'
      : `CLIENTES COM VISITA HOJE (${dia.toUpperCase()}) — REALIZADO (D-1) POR AGRUPADOR`;
    doc.text(tituloFaixa, margin, y + 4.0);

    // ---- Legenda: "—" (não comprou) e "OK" (comprou) ----
    let lx = pageW - margin - 195;
    doc.setFillColor(...NAO_COMPRADO_BG);
    doc.rect(lx, y, 9, 6, 'F');
    doc.setDrawColor(...MINI_BORDER);
    doc.setLineWidth(0.3);
    doc.rect(lx, y, 9, 6, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.4);
    doc.setTextColor(...NAO_COMPRADO_TXT);
    doc.text('—', lx + 4.5, y + 4.4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(...GREY);
    doc.text('não comprou o agrupador', lx + 12, y + 4.5);

    lx = pageW - margin - 76;
    doc.setFillColor(...OK_BG_LEGENDA);
    doc.rect(lx, y, 9, 6, 'F');
    doc.rect(lx, y, 9, 6, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.4);
    doc.setTextColor(...OK_TXT);
    doc.text('OK', lx + 4.5, y + 4.4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.6);
    doc.setTextColor(...GREY);
    doc.text('comprou o agrupador', lx + 12, y + 4.5);

    y += 7;

    // ---- Matriz cliente x agrupador ----
    // O nº de agrupadores (colunas) varia conforme o cadastro de produtos —
    // a largura de cada coluna e o tamanho da fonte são recalculados aqui a
    // cada geração, então o caderno se adapta automaticamente se a lista de
    // agrupadores diminuir ou aumentar (mais colunas -> colunas mais estreitas
    // e fonte um pouco menor; menos colunas -> colunas mais largas).
    const diaColW = modoTodosClientes ? 40 : 0;
    const clienteColW = 122;
    const colOffset = modoTodosClientes ? 2 : 1; // nº de colunas não-produto antes das colunas de produto
    const usable = pageW - margin * 2 - clienteColW - diaColW;
    const nCols = Math.max(colunas.length, 1);
    // Sem piso artificial: a largura é sempre usable/nCols (com teto de 20pt
    // quando há poucos agrupadores), garantindo que a tabela nunca ultrapasse
    // a largura útil da página, seja qual for a quantidade de colunas.
    const prodColW = Math.min(20, usable / nCols);
    // Fonte dos cabeçalhos (rotacionados) acompanha a largura da coluna
    // (é ela que limita a espessura do texto girado 90°).
    const prodFontHead = Math.max(4.2, Math.min(6.2, prodColW * 0.46));
    // Padding lateral das células OK/— também acompanha a largura da coluna
    // (colunas estreitas ganham quase nenhum respiro), e a fonte é calculada
    // a partir do espaço realmente disponível (medido, não estimado) para
    // que "OK" sempre caiba sem cortar — mesmo com dezenas de agrupadores.
    const prodPadH = Math.max(0.3, Math.min(1.5, prodColW * 0.1));
    const prodContentW = Math.max(2, prodColW - 2 * prodPadH);
    const prodFontBody = Math.max(3.6, Math.min(6.4, prodContentW / 1.65));

    const headRow = modoTodosClientes ? ['Cliente', 'Dia', ...colunas.map(() => '')] : ['Cliente', ...colunas.map(() => '')];
    const body = clientesHoje.map(c => {
      const mapa = porCliente.get(c.cod_cliente);
      const row = [];
      row.push(`${c.cod_cliente}  ·  ${c.nome_fantasia || 'Cliente'}`);
      if (modoTodosClientes) row.push((c.dia_visita && c.dia_visita !== '--') ? c.dia_visita.replace(/\s*-\s*/g, '-').toUpperCase() : '—');
      colunas.forEach(col => {
        const v = mapa ? mapa.get(col.produto) : undefined;
        row.push((v !== undefined && v !== null && v > 0) ? 'OK' : '—');
      });
      return row;
    });

    const columnStyles = { 0: { cellWidth: clienteColW, fontStyle: 'normal', halign: 'left' } };
    if (modoTodosClientes) {
      columnStyles[1] = { cellWidth: diaColW, halign: 'center' };
    }
    colunas.forEach((_, i) => {
      columnStyles[colOffset + i] = {
        cellWidth: prodColW,
        halign: 'center',
        cellPadding: { top: 1.2, bottom: 1.2, left: prodPadH, right: prodPadH },
      };
    });

    // Altura do cabeçalho da tabela medida pela largura real do texto rotacionado
    // (em vez de uma estimativa por nº de caracteres) — evita reservar mais
    // espaço do que o necessário e permite caber mais clientes por página.
    // Usa a mesma fonte dinâmica (prodFontHead) que será desenhada depois,
    // então a medida acompanha corretamente qualquer nº de agrupadores.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(prodFontHead);
    let maiorLarguraProduto = 24;
    colunas.forEach(c => {
      const w = doc.getTextWidth(c.produto);
      if (w > maiorLarguraProduto) maiorLarguraProduto = w;
    });
    const headerRowHeight = Math.min(95, maiorLarguraProduto + 9);
    const bannerH = 18;

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin, bottom: 24, top: bannerH },
      head: [headRow],
      body,
      styles: { fontSize: 6.4, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, textColor: [30, 30, 30], overflow: 'ellipsize', lineColor: [225, 225, 228], lineWidth: 0.35 },
      headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'normal', fontSize: prodFontHead, minCellHeight: headerRowHeight, valign: 'bottom' },
      alternateRowStyles: { fillColor: [246, 246, 248] },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 0) {
          data.cell.styles.fontSize = 9.5;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
          data.cell.styles.valign = 'middle';
        }
        if (modoTodosClientes && data.section === 'head' && data.column.index === 1) {
          data.cell.styles.fontSize = 7;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
          data.cell.styles.valign = 'middle';
        }
        if (modoTodosClientes && data.section === 'body' && data.column.index === 1) {
          data.cell.styles.fontSize = 5.1;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = GREY;
        }
        if (data.section === 'body' && data.column.index >= colOffset) {
          data.cell.styles.fontSize = prodFontBody;
          const naoComprou = data.cell.raw === '—';
          if (naoComprou) {
            data.cell.styles.fillColor = NAO_COMPRADO_BG;
            data.cell.styles.textColor = NAO_COMPRADO_TXT;
          } else {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = OK_TXT;
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'head' && data.column.index >= colOffset) {
          const col = colunas[data.column.index - colOffset];
          if (!col) return;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(prodFontHead);
          doc.setTextColor(255, 255, 255);
          const x = data.cell.x + data.cell.width / 2 + 2;
          const yBase = data.cell.y + data.cell.height - 4;
          doc.text(col.produto, x, yBase, { angle: 90, align: 'left' });
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFillColor(...DARK);
          doc.rect(0, 0, pageW, bannerH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text(`ROTA ${rota} (continuação)  ·  ${sv}  ·  ${gc}  ·  ${tituloDia}`, margin, 12.5);
        }
      },
    });

    // ---- Rodapé com espaço de anotação manual ----
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageH - 20, pageW - margin, pageH - 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    const rodapeEsq = modoTodosClientes
      ? `Total de clientes da rota: ${clientesHoje.length}`
      : `Visitas realizadas: __________ / ${clientesHoje.length}`;
    doc.text(rodapeEsq, margin, pageH - 8);
    doc.text(`Rota ${rota} · ${sv} · ${gc} · Realizado D-1`, pageW - margin, pageH - 8, { align: 'right' });

    return true;
  }
})();
