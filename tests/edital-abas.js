/* (19.95.0) AS ABAS DO EDITAL — fase 3: Agenda · Plano · Diagnóstico
 *
 *   AB1  as abas existem, com papéis de abas, e a seção abre na Agenda
 *   AB2  sem edital escolhido: "Seus editais" (a lista) e nada de Diagnóstico
 *   AB3  escolher um edital no seletor, estando na Agenda, leva ao Plano dele
 *   AB4  o Diagnóstico junta o painel (riscos, conferência, buracos) e o acompanhamento, com o atalho do Domínio
 *   AB5  o número de cortes em risco aparece na aba Diagnóstico
 *   AB6  "conferir no edital" (pela agenda) abre o Diagnóstico
 *   AB7  "todos os editais" estando no Diagnóstico volta para a lista
 *   AB8  setas do teclado andam entre as abas
 *   AB9  o CSS esconde por data-aba, e o Plano só divide em duas colunas quando cabem
 *   AB10 a barra do topo não usa mais a classe do cabeçalho do painel (ed-topo)
 */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };

  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  const e1 = api.edCriar("Prova A", "# Prova A | prova: " + d(60) + " | horas: 10\n& Específicos | minimo: 60%\n@ Financeiro :: 10q\n+ Receita :: 5\n+ Despesa :: 4\n@ Auditoria :: 5q\n+ NBASP :: 5");
  const e2 = api.edCriar("Prova B", "# Prova B | prova: " + d(90) + " | horas: 10\n@ Controle :: 4\n+ TCU :: 5");
  api.edAbaForcar("agenda");
  api.hubVoltar();
  const sec = api.$("secEdital");
  const aba = () => sec.getAttribute("data-aba");
  const bt = (id) => api.$(id);

  ok(/<section id="secEdital" data-modo="edital" data-aba="agenda"/.test(html) && aba() === "agenda"
    && /<div class="ed-abas" id="edAbas" role="tablist"/.test(html) && ["btnEdAbaAgenda", "btnEdAbaPlano", "btnEdAbaDiag"].every((id) => new RegExp('id="' + id + '" role="tab"').test(html))
    && bt("btnEdAbaAgenda").getAttribute("aria-selected") === "true", "AB1 três abas com papel de aba; a seção abre na Agenda");
  ok(bt("btnEdAbaPlano").textContent === "Seus editais" && bt("btnEdAbaDiag").hidden === true, "AB2 sem edital: 'Seus editais' e sem Diagnóstico: " + bt("btnEdAbaPlano").textContent);
  bt("btnEdAbaPlano").onclick();
  ok(aba() === "plano" && !api.$("edHub").hidden && bt("btnEdAbaPlano").getAttribute("aria-selected") === "true" && bt("btnEdAbaAgenda").getAttribute("aria-selected") === "false",
    "AB2b a aba 'Seus editais' mostra a lista");

  api.edAbaDefinir("agenda");
  const sel = api.$("edSel");
  sel.value = e1.id; sel.onchange();
  ok(aba() === "plano" && api.edAberto().id === e1.id && bt("btnEdAbaPlano").textContent === "Plano" && bt("btnEdAbaDiag").hidden === false,
    "AB3 escolher um edital estando na Agenda leva ao Plano dele (e o Diagnóstico aparece)");

  /* o simulador não monta a árvore do HTML estático: a estrutura se confere no texto */
  const trecho = (ini, fim) => html.slice(html.indexOf(ini), html.indexOf(fim, html.indexOf(ini)));
  const tDiag = trecho('id="edDiag"', "<!-- /edDiag -->"), tPlano = trecho('id="edPlano"', "<!-- /edPlano -->");
  ok(/id="edPainel"/.test(tDiag) && /id="edRitmo"/.test(tDiag) && /id="btnEdDiagDominio"/.test(tDiag)
    && !/id="edPainel"/.test(tPlano) && /id="painelEdital"/.test(tPlano) && /id="edProva"/.test(tPlano) && /id="edHoras"/.test(tPlano),
    "AB4 o Diagnóstico tem o painel, o acompanhamento e o atalho do Domínio; o Plano tem a bancada e as horas");
  bt("btnEdAbaDiag").onclick();
  ok(aba() === "diag", "AB4b a aba Diagnóstico abre");
  bt("btnEdDiagDominio").onclick();
  ok(api.$("dlgDominio").open === true, "AB4c o atalho abre o Domínio");
  api.$("dlgDominio").close();

  /* o corte em risco: Financeiro tem mínimo de 60% e nada estudado */
  api.edRender();
  const nRisco = api.edDiagRiscosAtual();
  const selo = todos(bt("btnEdAbaDiag")).find((f) => /(^| )ed-aba-n( |$)/.test(f.className || ""));
  ok(nRisco >= 1 && selo && selo.textContent === String(nRisco) && /em risco/.test(bt("btnEdAbaDiag").getAttribute("aria-label") || ""),
    "AB5 a aba Diagnóstico mostra quantos cortes estão em risco: " + nRisco);

  api.edAbaDefinir("agenda");
  api.hubConferir(e2.id);
  ok(aba() === "diag" && api.edAberto().id === e2.id, "AB6 'conferir no edital' abre o edital no Diagnóstico");

  sel.value = ""; sel.onchange();
  ok(aba() === "plano" && !api.$("edHub").hidden && bt("btnEdAbaDiag").hidden === true, "AB7 'Todos os editais' no Diagnóstico volta para a lista");

  api.hubAbrirEdital(e1.id);
  api.edAbaDefinir("agenda");
  api.edAbasTecla({ key: "ArrowRight", preventDefault() {} });
  const a1 = aba();
  api.edAbasTecla({ key: "End", preventDefault() {} });
  const a2 = aba();
  api.edAbasTecla({ key: "ArrowRight", preventDefault() {} });
  ok(a1 === "plano" && a2 === "diag" && aba() === "agenda", "AB8 as setas andam entre as abas (e dão a volta): " + [a1, a2, aba()].join(","));

  ok(/#secEdital\[data-aba="agenda"\] #edHub,#secEdital\[data-aba="agenda"\] #edBancada,/.test(html) && /#secEdital\[data-aba="diag"\] #edPlano\{display:none !important\}/.test(html)
    && /\.ed-plano\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,360px\),1fr\)\)/.test(html) && !/<div class="duas-colunas">\s*<div class="grupo" id="painelEdital">/.test(html),
    "AB9 o CSS esconde por data-aba e o Plano só divide quando cabem duas colunas de 360 px");
  /* (19.95.1) "ed-barra" também já existia (a barrinha de progresso, 6 px com overflow:hidden) e cortava a barra do topo */
  const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  ok(/<div class="edsel" id="edTopo">/.test(html) && !/class="ed-(topo|barra)-(sel|ferr|fim|mais)"/.test(html)
    && (css.match(/(^|[\s,}])\.edsel\{/g) || []).length === 1 && !/\.edsel\{[^}]*(height|overflow)/.test(css),
    "AB10 a barra do topo tem classe que nenhuma outra regra usa (ed-topo e ed-barra já eram de outros elementos)");

  api.edApagar(e1.id); api.edApagar(e2.id);
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
