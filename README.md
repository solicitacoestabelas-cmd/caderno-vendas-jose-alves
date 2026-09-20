# Caderno de Vendas — Grupo José Alves (protótipo)

Site estático (HTML puro + JS + Chart.js/jsPDF, sem backend) com 3 visões:

- **index.html** — Dashboard de Gestão (Gerentes/Supervisores), filtros em cascata
  Gerência Agrupada → Gerência → Supervisão → Rota → Grupo de Produto.
- **consultor.html** — Visão do Consultor, mesmo motor mas focado na própria
  rota (Gerência crua → Supervisão → Rota), com lista de clientes em giro zero.
- **pdf.html** — Gera, no navegador, um PDF paisagem com Realizado (D-1),
  uma página por rota, para uma Gerência escolhida. Usa jsPDF + autotable
  (bibliotecas já embutidas em `/lib`, não depende de internet).

Toda a base de dados fica em `/data/*.json` — são os arquivos que mudam a
cada atualização (ver abaixo).

## Publicar no GitHub Pages (primeira vez)

1. Crie um repositório novo (pode ser privado) e suba **todo o conteúdo
   desta pasta `site/`** na raiz do repositório (não numa subpasta).
2. Em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`,
   pasta `/ (root)`.
3. O GitHub gera um link fixo do tipo
   `https://<usuario>.github.io/<repositorio>/` — esse link não muda mais,
   mesmo quando os dados forem atualizados.

## Atualizar os dados (rotina diária/8x ao dia)

Nesta fase 1 (protótipo/paliativo), a atualização é feita assim:

1. Você me envia os 5 arquivos (REAL, META, BASE_CLIENTES, ANÁLISE_REDES,
   CALENDÁRIO) atualizados.
2. Eu rodo o pipeline (`etl/build_dataset.py`) e te devolvo os 6 arquivos
   da pasta `data/` atualizados (`fato_produto.json`, `fato_cliente.json`,
   `fato_keyaccount.json`, `dim_hierarquia.json`, `calendario.json`,
   `resumo.json`).
3. Você substitui esses 6 arquivos dentro da pasta `data/` do repositório
   no GitHub (upload direto pela interface web do GitHub funciona — não
   precisa linha de comando) e comita.
4. O link não muda — quem já tiver a página aberta só precisa dar F5.

> Combinado: PDF sempre com Realizado D-1 (atualizado 1x/dia, de manhã).
> Os dois HTMLs (Gestão e Consultor) recebem Real + Online, atualizados
> nos horários 6:30, 10:00, 12:00, 14:00, 15:00, 16:00, 17:00 e 17:30.

## Estrutura de arquivos

```
site/
  index.html          Dashboard de Gestão
  consultor.html       Visão do Consultor
  pdf.html              Gerador de PDF por Gerência
  style.css             Tema visual (dark, IM + Coca-Cola)
  data.js               Camada de dados (fetch dos JSON + agregações)
  app-common.js         Utilitários de UI compartilhados
  app-gestao.js         Lógica específica do dashboard de gestão
  app-consultor.js      Lógica específica da visão do consultor
  app-pdf.js            Lógica de geração do PDF
  lib/                  Chart.js e jsPDF (vendorizados, sem depender de CDN)
  assets/               Logos (im-logo.png)
  data/                 Dados consolidados (o que muda a cada atualização)
```

## Placeholder do logo Coca-Cola

O wordmark "Coca-Cola" no topo é um texto estilizado (itálico/serifado
branco), **não é o logotipo oficial** — evitei redesenhar a marca
registrada. Assim que vocês me passarem o arquivo oficial em branco
(PNG/SVG do manual de marca), eu troco pelo componente de imagem.

## Sobre a Gerência Agrupada vs Crua

- 16 Gerências "cruas" (unidade operacional real).
- 12 Gerências "agrupadas" (nível de gerente — algumas juntam 2 unidades:
  Pa+Di, Gu+Po, It+Mo, Ur+Ri).
- Dashboard de Gestão (`index.html`): filtro por agrupada disponível no
  topo, com drill-down para a crua/supervisão/rota.
- Visão do Consultor (`consultor.html`) e PDF (`pdf.html`): sempre pela
  Gerência crua, como combinado.
