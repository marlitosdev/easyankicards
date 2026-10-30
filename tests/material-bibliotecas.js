/* =====================================================================
 * AS BIBLIOTECAS DO MATERIAL DE ESTUDO (19.38.0)
 *
 * Na tela do Material, só a aba Cartões tinha o botão grande da sua biblioteca. As abas Lei seca e Julgados tinham
 * um botão pequeno com um parágrafo ao lado, e Resumos e Questões só um parágrafo — e o "Continuar" usava o mesmo
 * contorno dos botões de material, tudo virava uma fileira de pílulas parecidas.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada aba (Lei seca, Julgados, Resumos, Questões) tem UM botão grande no modelo do de Cartões: nome e, embaixo,
 *     o que se faz lá; a explicação antiga virou a dica do botão.
 *  2. Existe uma biblioteca de RESUMOS: lista só o que tem resumo escrito, procura no tópico e no texto (com o trecho
 *     achado), filtra por edital, disciplina, dúvida e tamanho, ordena e abre o resumo para ler.
 *  3. O botão da aba Questões leva à tela de Questões (a biblioteca, com o filtro por tópico).
 *  4. O "Continuar" é uma faixa à parte, com links discretos — não botões iguais aos de material.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const bloco = (id) => { const i = html.indexOf('id="' + id + '"'); return html.slice(i, html.indexOf("</div>", i)); };

  /* ---- 1: um botão grande por aba ---- */
  [["matFerrCartoes", "btnGerCartoes"], ["matFerrLei", "btnMatLeis"], ["matFerrJuris", "btnMatJurBib"],
   ["matFerrResumo", "btnMatResDuvidas"], ["matFerrQuestoes", "btnMatQsBanco"]].forEach(([faixa, bt]) => {
    const b = bloco(faixa);
    ok(new RegExp('class="btn btn-azul btn-biblioteca" id="' + bt + '"').test(b) && /bib-tit/.test(b) && /bib-sub/.test(b),
      "B1 a aba " + faixa + " tem o botao grande (titulo + subtitulo) como o de Cartoes");
  });
  ok(!/<span class="nota" data-i18n="mat_ferr_(lei|juris)_exp">/.test(html), "B2 o paragrafo solto ao lado do botao saiu (virou a dica)");
  const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": ", "g")) || []).length;
  ok(["mat_bib_lei", "mat_bib_lei_sub", "mat_bib_juris", "mat_bib_juris_sub", "mat_bib_resumo", "mat_bib_resumo_sub", "mat_bib_questoes",
    "mat_bib_questoes_sub", "res_bib_tit", "res_bib_conta", "res_bib_vazia", "res_bib_nada"].every((k) => linhas(k) === 2), "B3 os textos novos existem em pt e en");

  /* ---- 2 e 3: a biblioteca de resumos e o botão de questões ---- */
  {
    const r = rodar(); const api = r.api; api.matIniciar(); api.leiIniciar();
    const longo = "palavra ".repeat(200) + "O princípio da anterioridade nonagesimal impede a cobrança.";
    api.matGravar(api.matChave("Tributário", "Princípios"), longo, { disciplina: "Tributário", topico: "Princípios", concurso: "ISS Caruaru" });
    api.matGravar(api.matChave("Financeiro", "Orçamento"), longo.replace("nonagesimal", "anual"), { disciplina: "Financeiro", topico: "Orçamento", concurso: "Outro edital" });
    api.matGravarCartoes(api.matChave("Financeiro", "Só cartões"), "P :: R", { disciplina: "Financeiro", topico: "Só cartões" });
    api.matGravar(api.matChave("Tributário", "Imunidades"), "Curto demais.", { disciplina: "Tributário", topico: "Imunidades", concurso: "ISS Caruaru" });
    ok(api.resBibAbrir() === true && api.$("dlgResBib").open === true, "R1 a biblioteca de resumos abre");
    const itens = () => api.$("resBibLista").querySelectorAll(".res-bib-item");
    ok(itens().length === 3, "R2 lista so' o que tem resumo escrito (o topico so' com cartoes fica de fora): " + itens().length);
    ok(/3 resumo\(s\) em 2 disciplina/.test(api.$("resBibConta").textContent), "R3 conta resumos e disciplinas: " + api.$("resBibConta").textContent);
    api.resBibDefinir({ busca: "nonagesimal" });
    ok(itens().length === 1 && /Princípios/.test(itens()[0].textContent) && itens()[0].querySelectorAll("mark").length === 1,
      "R4 a busca acha no TEXTO e mostra o trecho marcado: " + itens().map((x) => x.textContent.slice(0, 40)));
    api.resBibDefinir({ busca: "", sit: "curtos" });
    ok(itens().length === 1 && /Imunidades/.test(itens()[0].textContent), "R5 'curtos' mostra o esboco");
    api.resBibDefinir({ sit: "", disc: "Financeiro" });
    ok(itens().length === 1 && /Orçamento/.test(itens()[0].textContent), "R6 filtra pela disciplina");
    api.resBibDefinir({ disc: "", ordem: "recente" });
    ok(/Imunidades/.test(itens()[0].textContent), "R7 'mudados por ultimo' poe o mais recente em cima");
    itens()[0].onclick();
    ok(api.$("dlgResBib").open !== true, "R8 tocar fecha a biblioteca e abre o resumo");
  }
  {
    const r = rodar(); const api = r.api; api.matIniciar();
    ok(typeof api.$("btnMatQsBanco").onclick === "function", "Q1 o botao da aba Questoes esta ligado");
    /* (19.38.1) o botão chamava o "trocarModo" LOCAL do resumo (ler/editar) e quebrava sem resumo aberto */
    let erro = null;
    try { api.$("btnMatQsBanco").onclick(); } catch (e) { erro = e; }
    ok(!erro && api.$("secQuestoes").hidden === false, "Q2 tocar abre a tela de Questoes (sem erro): " + (erro && erro.message));
  }

  /* ---- 19.39.0: a biblioteca de questões lista as com e sem tópico, e filtra por tópico sem escolher edital ---- */
  {
    const r = rodar(); const api = r.api; api.matIniciar();
    const q = (id, chave, disc, top) => ({ id, chave, disciplina: disc, topico: top, tipo: "ce", enunciado: "Enunciado " + id, gabarito: "C", tentativas: [] });
    api.qsBancoForcar([q("a", "tributário›princípios", "Tributário", "Princípios"), q("b", "tributário›princípios", "Tributário", "Princípios"),
      q("c", "financeiro›orçamento", "Financeiro", "Orçamento"), q("d", "", "", "")]);
    api.trocarModo("questoes");
    ok(/4/.test(api.$("qsResumo").textContent) && !/Nenhuma questão ainda/.test(api.$("qsLista").textContent),
      "Q3 abrir a tela de Questoes mostra o banco (com e sem topico): " + api.$("qsResumo").textContent);
    const sel = api.$("qsFTopico");
    const opts = sel.querySelectorAll("option").map((o) => o.textContent);
    ok(sel.hidden === false && opts.some((x) => /sem tópico \(1\)/.test(x)) && opts.some((x) => /Princípios \(2\)/.test(x)) && opts.some((x) => /Orçamento \(1\)/.test(x)),
      "Q4 sem edital escolhido, a lista de topicos vem das questoes, com 'sem topico': " + opts.join(" | "));
    ok(api.qsFiltrar({ chave: "__sem_topico__" }).map((x) => x.id).join() === "d", "Q5 o filtro 'sem topico' mostra so' as sem topico");
  }

  /* ---- 19.41.0: os filtros da biblioteca de questões conversam entre si ---- */
  {
    const r = rodar(); const api = r.api; api.matIniciar();
    api.qsUiIniciar();
    const q = (id, chave, disc, top, banca, tipo) => ({ id, chave, disciplina: disc, topico: top, banca: banca || "", tipo: tipo || "ce", enunciado: "Enunciado " + id, gabarito: "C", tentativas: [] });
    api.qsBancoForcar([q("a", "tributário›princípios", "Tributário", "Princípios", "FGV"), q("b", "tributário›imunidades", "Tributário", "Imunidades", "FGV", "me"),
      q("c", "financeiro›orçamento", "Financeiro", "Orçamento", "Cebraspe"), q("d", "", "Financeiro", "")]);
    api.trocarModo("questoes");
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(["qs_f_edital", "qs_f_disc", "qs_f_topico", "qs_f_banca", "qs_f_tipo", "qs_f_situacao", "qs_f_busca"].every((k) => html.indexOf('data-i18n="' + k + '"') > 0),
      "F1 cada campo de filtro tem rotulo");
    const textos = (id) => api.qsUiOpcoesDoSelect(api.$(id)).map((o) => o.textContent);
    ok(textos("qsFDisc").some((x) => /^Tributário \(2\)$/.test(x)) && textos("qsFDisc").some((x) => /^Financeiro \(2\)$/.test(x)), "F2 as disciplinas mostram quantas questoes tem: " + textos("qsFDisc").join(" | "));
    api.$("qsFDisc").value = "Financeiro"; api.qsUiLerFiltros();
    const tops = textos("qsFTopico");
    ok(tops.some((x) => /Orçamento \(1\)/.test(x)) && !tops.some((x) => /Princípios|Imunidades/.test(x)) && tops.some((x) => /sem tópico \(1\)/.test(x)),
      "F3 escolher a disciplina limita os topicos aos dela: " + tops.join(" | "));
    ok(textos("qsFBanca").join("|") === "todas as bancas|Cebraspe (1)", "F4 a banca tambem so' mostra o que existe dentro da disciplina: " + textos("qsFBanca").join("|"));
    /* tópico de outra disciplina é desmarcado sozinho */
    api.$("qsFDisc").value = ""; api.qsUiLerFiltros();
    api.$("qsFTopico").value = "tributário›princípios"; api.qsUiLerFiltros();
    api.$("qsFDisc").value = "Financeiro"; api.qsUiLerFiltros();
    ok(api.qsUiListaFiltrada().length === 2, "F5 trocar para uma disciplina que nao tem o topico escolhido desmarca o topico: " + api.qsUiListaFiltrada().length);
    const chips = () => api.$("qsChips").querySelectorAll(".qs-chip");
    ok(api.$("qsChips").hidden === false && chips().length === 1 && /Disciplina:Financeiro/.test(chips()[0].textContent.replace(/\s+/g, "")), "F6 os filtros ativos aparecem em etiquetas: " + chips().map((c) => c.textContent).join(" | "));
    chips()[0].querySelectorAll(".qs-chip-x")[0].onclick();
    ok(api.qsUiListaFiltrada().length === 4 && api.$("qsChips").hidden === true, "F7 o ✕ da etiqueta tira o filtro");
    api.$("qsFTipo").value = "me"; api.qsUiLerFiltros();
    api.$("qsFBanca").value = "Cebraspe"; api.qsUiLerFiltros();
    ok(/Nenhuma questão passa/.test(api.$("qsLista").textContent) && api.$("qsLista").querySelectorAll(".qs-vazio-limpar").length === 1, "F8 lista vazia por causa dos filtros oferece 'limpar os filtros'");
    api.$("btnQsLimparFiltros").onclick();
    ok(api.qsUiListaFiltrada().length === 4 && api.$("btnQsLimparFiltros").hidden === true, "F9 'limpar' tira todos os filtros");
  }

  /* ---- 4: o "Continuar" à parte, em links ---- */
  ok(/\.mat-recentes\{[^}]*border:1px dashed/.test(html) && /\.mat-rec-link\{[^}]*background:none;border:0/.test(html),
    "C1 o 'Continuar' e' uma faixa a parte, com links sem contorno de botao");
  const mjs = fs.readFileSync(path.join(__dirname, "..", "docs", "material.js"), "utf8");
  ok(/b\.className = "mat-rec mat-rec-link rec-"/.test(mjs) && !/b\.className = "mat-slot mat-rec/.test(mjs), "C2 os itens do 'Continuar' nao usam mais a classe dos botoes de material");

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
