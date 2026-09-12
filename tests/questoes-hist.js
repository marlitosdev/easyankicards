/* HISTÓRICO DOS BLOCOS DE QUESTÕES.
 *
 * A sessão já era guardada — mas só para poder ser RETOMADA. Terminada,
 * ela desaparecia: o placar aparecia uma vez, na tela do fim, e depois
 * não havia como responder "quantos blocos fiz esta semana?", "como fui
 * em Receita Pública da última vez?" ou "quero refazer aquele recorte".
 *
 * O que precisa valer aqui: o bloco é registrado ao COMEÇAR (rodada
 * abandonada é informação, não lixo); o FILTRO vai junto, porque é ele
 * que permite refazer; e o caminho de entrada — agenda ou aba — produz
 * o mesmo item, só com a origem anotada. */
const { rodar } = require("./fumaca.js");

const QUESTOES = [
  { tipo: "ce", enunciado: "Receita é ingresso definitivo de recursos.",
    gabarito: "C", disciplina: "Direito Financeiro", topico: "Receita pública",
    chave: "direito financeiro›receita pública" },
  { tipo: "ce", enunciado: "Receita corrente inclui operações de crédito.",
    gabarito: "E", disciplina: "Direito Financeiro", topico: "Receita pública",
    chave: "direito financeiro›receita pública" },
  { tipo: "ce", enunciado: "Restos a pagar são despesas empenhadas e não pagas.",
    gabarito: "C", disciplina: "Direito Financeiro", topico: "Restos a pagar",
    chave: "direito financeiro›restos a pagar" },
  { tipo: "ce", enunciado: "Crase é a fusão de duas vogais idênticas.",
    gabarito: "C", disciplina: "Português", topico: "Crase",
    chave: "português›crase" },
];

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const acharClasse = (el, cls, saida) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) saida.push(f);
      acharClasse(f, cls, saida);
    });
    return saida;
  };
  const preparar = (api) => {
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    api.qsAplicar(QUESTOES.map((q) => Object.assign({}, q)));
    api.qhCarregar();
    return api.qsTodas();
  };

  /* ---- H1: o bloco entra ao COMEÇAR ---- */
  {
    const { api } = rodar();
    const todas = preparar(api);
    ok(api.qhTodos().length === 0, "H1 o historico ja comecou com itens");

    api.qhIniciar(todas, { origem: "aba", escopo: "" });
    /* ROD ADA ABANDONADA É INFORMAÇÃO — talvez a mais útil, porque diz
     * onde o estudo emperra. Guardar so o que termina produziria um
     * historico que so mostra sucesso. */
    ok(api.qhTodos().length === 1,
       "H1b o bloco nao foi registrado ao comecar");
    const h = api.qhTodos()[0] || {};
    ok(h.total === 4, "H1c o bloco nao anotou quantas questoes tinha: " + h.total);
    ok(h.feitas === 0 && h.fim === "",
       "H1d bloco recem-aberto ja aparece terminado");
    ok(!!h.q, "H1e o bloco nao anotou quando comecou");
    ok(!!api.qhEmAndamento(), "H1f o bloco aberto nao consta como em andamento");
  }

  /* ---- H2: o rótulo diz DE QUE foi o bloco ---- */
  {
    const { api } = rodar();
    const todas = preparar(api);
    /* "20 questoes" nao distingue um bloco de Receita Publica de um de
     * Crase. O rotulo tenta, na ordem: o topico, a disciplina, o edital. */
    const soReceita = todas.filter((q) => /Receita/.test(q.topico));
    ok(api.qhRotulo(soReceita, {}) === "Receita pública",
       "H2 bloco de um topico so nao levou o nome dele: "
       + api.qhRotulo(soReceita, {}));

    const soDisc = todas.filter((q) => q.disciplina === "Direito Financeiro");
    ok(/Direito Financeiro/.test(api.qhRotulo(soDisc, {})),
       "H2b bloco de uma disciplina nao levou o nome dela: "
       + api.qhRotulo(soDisc, {}));

    /* misturado, cai no nome do edital — e sem ele, em nada, o que a
     * tela resolve mostrando a contagem */
    ok(api.qhRotulo(todas, { editalNome: "SEFAZ-AL" }) === "SEFAZ-AL",
       "H2c bloco misturado nao caiu no nome do edital: "
       + api.qhRotulo(todas, { editalNome: "SEFAZ-AL" }));
  }

  /* ---- H3: o placar acompanha, e o abandono fica registrado ---- */
  {
    const { api } = rodar();
    const todas = preparar(api);
    api.qsSessaoIniciar(todas);
    api.qhIniciar(todas, { origem: "aba" });

    api.qsResponder("C");        /* acerta a primeira */
    let h = api.qhTodos()[0] || {};
    ok(h.feitas === 1 && h.certas === 1,
       "H3 a resposta nao chegou ao bloco: " + h.feitas + "/" + h.certas);
    ok(h.pct === 100, "H3b o percentual do bloco saiu errado: " + h.pct);

    api.qsAndar(1);
    api.qsResponder("C");        /* erra a segunda (gabarito E) */
    h = api.qhTodos()[0] || {};
    ok(h.feitas === 2 && h.certas === 1,
       "H3c a segunda resposta nao chegou: " + h.feitas + "/" + h.certas);
    ok(h.pct === 50, "H3d o percentual nao acompanhou: " + h.pct);

    /* ABANDONAR NO MEIO guarda o que chegou a ser feito, em vez de
     * zerar. Sem isso, "parei na metade" viraria "nao fiz nada". */
    ok(!h.fim, "H3e o bloco se deu por terminado sozinho");
    ok(h.feitas < h.total, "H3f premissa: o bloco esta pela metade");
    const r = api.qhResumo(7);
    ok(r.abandonados === 1,
       "H3g o bloco interrompido nao aparece como tal: " + r.abandonados);
    ok(r.feitas === 2 && r.certas === 1,
       "H3h o resumo da semana nao somou o bloco interrompido: "
       + JSON.stringify(r));

    api.qhAtualizar(api.qsPlacar(), { fechar: true });
    h = api.qhTodos()[0] || {};
    ok(!!h.fim, "H3i fechar o bloco nao marcou o fim");
    ok(api.qhEmAndamento() === null,
       "H3j depois de fechado ainda consta um bloco em andamento");
  }

  /* ---- H4: o mesmo item venha de onde vier ---- */
  {
    const { api } = rodar();
    const todas = preparar(api);
    api.qhIniciar(todas.slice(0, 2), { origem: "agenda", escopo: "topico:x" });
    api.qhAtualizar({ feitas: 2, certas: 2 }, { fechar: true });
    api.qhIniciar(todas.slice(3), { origem: "aba", escopo: "" });

    const todos = api.qhTodos();
    ok(todos.length === 2, "H4 deviam ser 2 blocos, sao " + todos.length);
    /* DOIS FORMATOS PARA O MESMO GESTO seriam duas listas que nunca
     * somam. A origem e anotada; a forma do item e a mesma. */
    const campos = (x) => Object.keys(x || {}).sort().join(",");
    ok(campos(todos[0]) === campos(todos[1]),
       "H4b os blocos da agenda e da aba tem formatos diferentes:\\n"
       + campos(todos[0]) + "\\n" + campos(todos[1]));
    ok(todos.some((x) => x.origem === "agenda")
       && todos.some((x) => x.origem === "aba"),
       "H4c a origem do bloco nao foi anotada: "
       + JSON.stringify(todos.map((x) => x.origem)));
    /* o mais recente vem primeiro: é o que se procura */
    ok((todos[0] || {}).origem === "aba",
       "H4d o historico nao esta com o mais recente na frente");
  }

  /* ---- H5: o filtro vai junto, e é o que permite refazer ---- */
  {
    const { api } = rodar();
    preparar(api);
    api.$("qsFDisc").value = "Direito Financeiro";
    api.qsUiLerFiltros();
    ok(api.qsUiListaFiltrada().length === 3,
       "H5-pre o filtro de disciplina nao pegou: "
       + api.qsUiListaFiltrada().length);

    await api.qsUiResponderAbrir(api.qsUiListaFiltrada(), "aba", "");
    const h = api.qhTodos()[0] || {};
    ok(!!h.id, "H5 abrir a sessao pela aba nao registrou o bloco");
    /* UM ITEM SEM O FILTRO é um numero solto que nao leva a lugar
     * nenhum. Com ele, "refazer" reconstroi o mesmo recorte — e e isso
     * que transforma o historico numa ferramenta em vez de um placar. */
    ok(!!h.filtro, "H5b o bloco foi guardado sem o filtro usado");
    ok(h.filtro && h.filtro.disciplina === "Direito Financeiro",
       "H5c o filtro guardado nao e o que estava na tela: "
       + JSON.stringify(h.filtro));
    ok(h.total === 3,
       "H5d o bloco registrou " + h.total + " questoes; o filtro deixava 3");

    /* refazer devolve o mesmo recorte */
    api.$("qsFDisc").value = "";
    api.qsUiLerFiltros();
    ok(api.qsUiListaFiltrada().length === 4, "H5e premissa: filtro limpo");
    api.qsUiHistRefazer(h.id);
    ok(api.qsUiListaFiltrada().length === 3,
       "H5f refazer nao reconstruiu o recorte do bloco: "
       + api.qsUiListaFiltrada().length);
  }

  /* ---- H6: a tela do histórico ---- */
  {
    const { api } = rodar();
    const todas = preparar(api);
    api.qsUiHistRender();
    /* DIZER POR QUE ESTÁ VAZIO, e o que fazer para deixar de estar */
    ok(/Nenhum bloco/.test(api.$("qsHistLista").textContent || ""),
       "H6 o historico vazio nao explica nada: "
       + api.$("qsHistLista").textContent);

    api.qhIniciar(todas.filter((q) => /Receita/.test(q.topico)),
      { origem: "aba", filtro: { disciplina: "Direito Financeiro" } });
    api.qhAtualizar({ feitas: 2, certas: 1 }, { fechar: true });
    api.qsUiHistRender();

    const itens = acharClasse(api.$("qsHistLista"), "qs-hist-item", []);
    ok(itens.length === 1, "H6b o bloco nao apareceu na lista: " + itens.length);
    const txt = (itens[0] || {}).textContent || "";
    /* TRÊS COISAS, nesta ordem: de que foi, como voce foi, e o caminho
     * para refazer. A terceira e a que separa historico de placar. */
    ok(/Receita pública/.test(txt), "H6c a linha nao diz de que foi o bloco: " + txt);
    ok(/2/.test(txt) && /50%/.test(txt),
       "H6d a linha nao diz como voce foi: " + txt);
    const bts = itens[0] ? itens[0].querySelectorAll("button") : [];
    ok(bts.some((b) => /refazer/i.test(b.textContent || "")),
       "H6e falta o botao de refazer");
    ok(bts.some((b) => /×/.test(b.textContent || "")),
       "H6f falta o caminho para tirar um bloco do historico");

    /* o resumo da semana no cabecalho */
    ok(/1 bloco/.test(api.$("qsHistResumo").textContent || ""),
       "H6g o cabecalho nao resume a semana: " + api.$("qsHistResumo").textContent);

    /* apagar um bloco tira da lista */
    const alvo = (api.qhTodos()[0] || {}).id;
    api.qhApagar(alvo);
    api.qsUiHistRender();
    ok(acharClasse(api.$("qsHistLista"), "qs-hist-item", []).length === 0,
       "H6h apagar o bloco nao tirou da lista");
    /* e NAO mexe nas questoes nem no desempenho delas */
    ok(api.qsTodas().length === 4,
       "H6i apagar um bloco do historico apagou questoes: "
       + api.qsTodas().length);
  }

  /* ---- H7: o histórico entra no backup ---- */
  {
    const { api } = rodar();
    const chaves = [];
    Object.keys(api.BK_CHAVES || {}).forEach((g) => {
      (api.BK_CHAVES[g] || []).forEach((k) => chaves.push(k));
    });
    /* Um historico fora do backup se perde na primeira restauracao, e a
     * perda so aparece semanas depois — foi assim com os rascunhos e os
     * adiamentos. */
    ok(chaves.indexOf("eac_qs_hist") >= 0,
       "H7 o historico dos blocos ficou de fora do backup: "
       + JSON.stringify(chaves));
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
