/* =====================================================================
 * A LIXEIRA — apagar não é mais para sempre
 *
 * Antes: o cartão pedia duas confirmações e, passadas elas, sumia; a questão ia embora com o histórico
 * de respostas; e a dica ou a nota desapareciam quando se salvava o campo vazio, SEM pergunta nenhuma.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Todo caminho que apaga um cartão (do editor e do tópico), uma questão, uma dica (da questão e do
 *     resumo) ou uma nota (do artigo e do trecho) guarda o que apagou na lixeira, por inteiro e com o
 *     lugar de onde saiu — e o risco: alto para a questão com tentativas, para o texto que cita artigo,
 *     prazo ou valor, e para a dica ou nota longa.
 *  2. Restaurar devolve no MESMO lugar, do MESMO jeito (cartões colados voltam colados). Dica e nota que
 *     já têm texto novo NÃO são sobrescritas: o antigo fica embaixo. Se o lugar não existe mais, avisa e
 *     o item continua na lixeira.
 *  3. Editar (texto não vazio) ou salvar vazio o que já estava vazio não vai para a lixeira.
 *  4. Logo depois de apagar aparece o aviso com "desfazer", que restaura o último.
 *  5. A pergunta "apagar?" mostra o risco e diz que dá para restaurar; dizer NÃO também fica no histórico.
 *  6. A tela: lista, filtros por tipo com contagem, restaurar, apagar de vez (pergunta, mostrando o que
 *     é) e esvaziar (pergunta, mostrando o que se perde). Guarda os últimos 300, sem perder o resto.
 *  7. Tudo vai para o histórico de decisões: apagou, restaurou, apagou de vez, disse não.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const tick = () => new Promise((r) => setImmediate(r));
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const novo = () => {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar(); api.leiIniciar();
    return api;
  };
  const ultimo = (api) => api.lixLer().slice(-1)[0];
  const dec = (api) => api.decLer();

  /* ==============================================================
   * A: as funções puras
   * ============================================================== */
  {
    const api = novo();
    const T = "A\n\nB\n\nC";
    ok(api.lixInserirBloco(T, "X", 3) === "A\n\nX\n\nB\n\nC", "A1 no meio, separado por branco dos dois lados: " + JSON.stringify(api.lixInserirBloco(T, "X", 3)));
    ok(api.lixInserirBloco("P1\nP3", "P2", 2, { antes: false, depois: false }) === "P1\nP2\nP3", "A2 cartoes colados voltam colados (sem branco nenhum)");
    ok(api.lixInserirBloco("A\n\nC", "B", 3, { antes: true, depois: true }) === "A\n\nB\n\nC", "A3 com branco dos dois lados o branco volta");
    ok(api.lixInserirBloco("A\nB", "X", 99) === "A\nB\n\nX", "A4 a linha nao existe mais: vai para o fim");
    ok(api.lixInserirBloco("", "X", 5) === "X" && api.lixInserirBloco("  \n ", "X", 1) === "X", "A5 texto vazio: so' o bloco");
    ok(api.lixInserirBloco("A", "X", 1) === "X\n\nA", "A6 no comeco");
    ok(api.lixJuntar("", "velho") === "velho" && api.lixJuntar("novo", "velho") === "novo\n\nvelho" && api.lixJuntar("igual", "igual") === "igual" && api.lixJuntar("  ", "velho") === "velho",
      "A7 dica ou nota que ja tem texto: o antigo fica embaixo; igual nao duplica");
    const q0 = { enunciado: "E", tentativas: [] }, q1 = { enunciado: "E", tentativas: [{ ok: true }, { ok: false }] };
    ok(api.lixRisco("questao", { q: q0 }) === "medio" && api.lixRisco("questao", { q: q1 }) === "alto", "A8 questao com tentativas: risco alto; sem: medio");
    ok(api.lixRisco("cartao", { bloco: "Prazo :: 30 dias" }) === "alto" && api.lixRisco("cartao", { bloco: "Capital :: Brasília" }) === "baixo" && api.lixRisco("cartao", { bloco: "Art. 5º :: x" }) === "alto",
      "A9 cartao que cita prazo ou artigo: alto; comum: baixo");
    ok(api.lixRisco("dica", { texto: "macete curto" }) === "medio" && api.lixRisco("nota", { texto: "x".repeat(250) }) === "alto" && api.lixRisco("nota", { texto: "cuidado com o §2º" }) === "alto",
      "A10 dica/nota: medio; longa ou citando artigo/paragrafo: alto");
    ok(/2 tentativa/.test(api.lixAvisoRisco("questao", { q: q1 })) && /Risco alto/.test(api.lixAvisoRisco("questao", { q: q1 })), "A11 o aviso da questao diz quantas tentativas vao junto: " + api.lixAvisoRisco("questao", { q: q1 }));
    ok(/Risco alto.*artigo/.test(api.lixAvisoRisco("cartao", { bloco: "Art. 5º" })) && /^\n\nVai para a lixeira e dá para restaurar\.$/.test(api.lixAvisoRisco("cartao", { bloco: "Capital" })), "A12 o aviso de risco alto e o padrao");
  }

  /* ==============================================================
   * B: lixJogar — o item, a persistencia, o limite, o historico, o aviso
   * ============================================================== */
  {
    const api = novo();
    api.segurarAdiados();          /* o setTimeout do simulador roda na hora: segura, para ver o aviso na tela */
    const it = api.lixJogar({ tipo: "dica", via: "questao", motivo: "vazio", rotulo: "macete", onde: "Q1", dados: { id: "q1", texto: "macete" } });
    ok(it.id && it.q && it.tipo === "dica" && it.via === "questao" && it.motivo === "vazio" && it.rotulo === "macete" && it.onde === "Q1" && it.risco === "medio" && it.v,
      "B1 o item: id, quando, tipo, de onde, motivo, risco e a versao: " + JSON.stringify(it).slice(0, 160));
    api.lixRecarregar();
    ok(api.lixLer().length === 1 && api.lixLer()[0].id === it.id, "B2 fica no armazenamento (sobrevive a recarregar)");
    const d = dec(api).slice(-1)[0];
    ok(d.area === "apagar" && d.regra === "apagar.dica" && d.decisao === "aceitou" && d.via === "texto_vazio" && d.origem === "pessoa" && d.lei === "Q1" && d.risco === "medio" && /macete/.test(d.proposta.amostra) && /vazio/.test(d.motivo),
      "B3 vai para o historico de decisoes, com a via 'texto_vazio': " + JSON.stringify([d.regra, d.decisao, d.via, d.risco]));
    const bar = api.$("barraLixeira");
    ok(bar.hidden === false && /Dica “macete” foi para a lixeira\./.test(api.$("lixTxt").textContent) && api.$("btnLixDesfazer").hidden === false, "B4 aparece o aviso com 'desfazer': " + api.$("lixTxt").textContent);
    ok(api.$("btnLixeira").textContent === "lixeira (1)", "B5 o botao do rodape conta: " + api.$("btnLixeira").textContent);
    api.soltarAdiados();
    ok(bar.hidden === true, "B5a passados os segundos, o aviso some sozinho");
    const it2 = api.lixJogar({ tipo: "cartao", via: "editor", rotulo: "c", onde: "ed", dados: { bloco: "F :: V" } });
    const d2 = dec(api).slice(-1)[0];
    ok(d2.via === "pedido" && d2.regra === "apagar.cartao" && /Pedido por você/.test(d2.motivo), "B6 apagar pedido pela pessoa: via 'pedido'");
    /* limite */
    api.lixLimites(3, 400000);
    for (let i = 0; i < 5; i++) api.lixJogar({ tipo: "nota", via: "artigo", rotulo: "n" + i, onde: "L", dados: { lei: "x", num: String(i), texto: "t" + i } });
    ok(api.lixLer().length === 3 && api.lixLer().map((x) => x.rotulo).join(",") === "n2,n3,n4", "B7 guarda so' os N mais recentes (o mais velho sai): " + api.lixLer().map((x) => x.rotulo));
    api.lixLimites(300, 700);
    api.lixJogar({ tipo: "nota", via: "artigo", rotulo: "grande", onde: "L", dados: { lei: "x", num: "9", texto: "g".repeat(400) } });
    ok(api.lixLer().length < 4 && api.lixLer().slice(-1)[0].rotulo === "grande", "B8 o limite de caracteres tambem poda (o novo fica): " + api.lixLer().length);
    api.lixLimites(300, 400000);
  }

  /* ==============================================================
   * C: a questao
   * ============================================================== */
  {
    const api = novo();
    api.qsAplicar([
      { tipo: "ce", enunciado: "Receita é ingresso definitivo.", gabarito: "C", disciplina: "Direito Financeiro", topico: "Receita pública", chave: "df|rp" },
      { tipo: "ce", enunciado: "Crase é a fusão de duas vogais.", gabarito: "C", disciplina: "Português", topico: "Crase", chave: "pt|cr" },
    ]);
    const q = api.qsTodas()[0];
    q.tentativas = [{ ok: true, em: "2026-09-01T10:00:00Z" }, { ok: false, em: "2026-09-02T10:00:00Z" }];
    q.dica = "lembre do ingresso";
    const id = q.id;
    ok(api.qsApagar(id) === 1 && api.qsTodas().length === 1, "C1 apagou do banco");
    const it = ultimo(api);
    ok(it.tipo === "questao" && it.via === "banco" && it.risco === "alto" && it.onde === "Direito Financeiro · Receita pública" && /Receita/.test(it.rotulo) && it.dados.q.tentativas.length === 2 && it.dados.q.dica === "lembre do ingresso",
      "C2 a questao inteira (com as tentativas e a dica) vai para a lixeira, risco alto: " + JSON.stringify([it.risco, it.onde]));
    ok(dec(api).slice(-1)[0].risco === "alto" && dec(api).slice(-1)[0].regra === "apagar.questao", "C3 e o historico sabe que era de risco alto");
    ok(api.qsApagar("nao-existe") === 0 && api.lixLer().length === 1, "C4 apagar o que nao existe nao cria item");
    const r = api.lixRestaurar(it.id);
    const volta = api.qsTodas().filter((x) => x.id === id)[0];
    ok(r.ok && volta && volta.tentativas.length === 2 && volta.dica === "lembre do ingresso" && volta.enunciado === "Receita é ingresso definitivo." && api.lixLer().length === 0,
      "C5 restaurar devolve a questao com o historico de respostas e a dica, e tira da lixeira");
    const d = dec(api).slice(-1)[0];
    ok(d.decisao === "mudou" && d.via === "lixeira" && d.regra === "apagar.questao" && /mudou de ideia/.test(d.motivo), "C6 restaurar fica no historico como 'mudou' (via lixeira)");
    /* restaurar duas vezes / com o id ja no banco */
    api.qsApagar(id);
    const it2 = ultimo(api);
    api.qsTodas().push(JSON.parse(JSON.stringify(it2.dados.q)));
    const r2 = api.lixRestaurar(it2.id);
    ok(r2.ok && r2.msg === "lix_ja_existe" && api.qsTodas().filter((x) => x.id === id).length === 1 && api.lixLer().length === 0, "C7 se a questao ja esta no banco nao duplica");
    ok(api.lixRestaurar("nao-existe").ok === false, "C8 restaurar item que nao existe: falha");
  }
  {
    /* a pergunta na tela: risco visivel; "nao" fica no historico */
    const api = novo();
    api.qsAplicar([{ tipo: "ce", enunciado: "Receita é ingresso definitivo.", gabarito: "C", disciplina: "DF", topico: "RP", chave: "df|rp" }]);
    api.qsTodas()[0].tentativas = [{ ok: true }, { ok: false }, { ok: false }];
    api.qsUiRender();
    const li = achar(api.$("qsLista"), (c) => cls(c, "qs-item-mais"))[0];
    ok(!!li, "C9 (a lista de questoes desenha o menu '⋮')");
    if (li) {
      li.onclick();
      const bDel = achar(api.$("qsLista"), (c) => cls(c, "btn-perigo"))[0];
      const p = bDel.onclick();
      await tick();
      const msg = api.$("uiModalMsg").textContent;
      ok(/Apagar esta questão do banco/.test(msg) && /Risco alto/.test(msg) && /3 tentativa/.test(msg) && /lixeira/.test(msg), "C10 a pergunta mostra o risco e diz que da para restaurar: " + msg.replace(/\n/g, "|"));
      api.uiModalResponder(false);
      await p;
      ok(api.qsTodas().length === 1 && api.lixLer().length === 0, "C11 'nao': a questao fica e nada vai para a lixeira");
      const d = dec(api).slice(-1)[0];
      ok(d.regra === "apagar.questao" && d.decisao === "recusou" && d.risco === "alto", "C12 dizer NAO tambem fica no historico (recusou, risco alto): " + JSON.stringify(d && [d.regra, d.decisao, d.risco]));
      const p2 = achar(api.$("qsLista"), (c) => cls(c, "btn-perigo"))[0].onclick();
      await tick();
      api.uiModalResponder(true);
      await p2;
      ok(api.qsTodas().length === 0 && api.lixLer().length === 1 && api.lixLer()[0].tipo === "questao", "C13 'sim': apagou e foi para a lixeira");
    }
  }

  /* ==============================================================
   * D: a dica (da questao e do resumo)
   * ============================================================== */
  {
    const api = novo();
    api.qsAplicar([{ tipo: "ce", enunciado: "Receita é ingresso definitivo.", gabarito: "C", disciplina: "DF", topico: "RP", chave: "df|rp" }]);
    const id = api.qsTodas()[0].id;
    api.qsGravarDica(id, "macete: ingresso é definitivo");
    ok(api.lixLer().length === 0, "D1 escrever uma dica nao vai para a lixeira");
    api.qsGravarDica(id, "macete: ingresso é definitivo, ok?");
    ok(api.lixLer().length === 0, "D1a editar (texto nao vazio) tambem nao");
    api.qsGravarDica(id, "");
    const it = ultimo(api);
    ok(it && it.tipo === "dica" && it.via === "questao" && it.motivo === "vazio" && it.dados.texto === "macete: ingresso é definitivo, ok?" && it.dados.id === id && api.qsDicaDeQuestao(id) === "",
      "D2 salvar vazio APAGA a dica: o texto que havia vai para a lixeira");
    const d = dec(api).slice(-1)[0];
    ok(d.via === "texto_vazio" && d.regra === "apagar.dica" && d.decisao === "aceitou", "D3 e o historico diz que foi por campo salvo vazio");
    api.qsGravarDica(id, "");
    ok(api.lixLer().length === 1, "D4 salvar vazio o que ja estava vazio nao cria item");
    ok(api.lixRestaurar(it.id).ok && api.qsDicaDeQuestao(id) === "macete: ingresso é definitivo, ok?" && api.lixLer().length === 0, "D5 restaurar devolve a dica");
    /* ja escreveu outra: nao sobrescreve */
    api.qsGravarDica(id, ""); const it2 = ultimo(api);
    api.qsGravarDica(id, "dica nova");
    ok(api.lixRestaurar(it2.id).ok && api.qsDicaDeQuestao(id) === "dica nova\n\nmacete: ingresso é definitivo, ok?", "D6 se ja ha uma dica nova, a antiga fica embaixo (nao sobrescreve): " + JSON.stringify(api.qsDicaDeQuestao(id)));
    /* a questao nao existe mais */
    api.qsGravarDica(id, ""); const it3 = ultimo(api);
    api.qsApagar(id);
    const r = api.lixRestaurar(it3.id);
    ok(r.ok === false && r.msg === "lix_falha_questao" && api.lixLer().some((x) => x.id === it3.id), "D7 a questao sumiu: avisa e a dica continua na lixeira");
  }
  {
    const api = novo();
    const ch = api.matChave("Direito", "Tributos");
    api.matGravar(ch, "Resumo do tributo.", { disciplina: "Direito", topico: "Tributos" });
    api.matGravarDica(ch, "tributo é prestação pecuniária", "não é multa");
    ok(api.lixLer().length === 0, "D8 dica de resumo: escrever nao vai para a lixeira");
    api.matGravarDica(ch, "tributo é prestação pecuniária", "não é multa, é prestação");
    ok(api.lixLer().length === 0, "D8a editar (texto nao vazio) uma dica de resumo tambem nao vai para a lixeira");
    api.matGravarDica(ch, "tributo é prestação pecuniária", "");
    const it = ultimo(api);
    ok(it && it.tipo === "dica" && it.via === "material" && it.dados.texto === "não é multa, é prestação" && /Direito|Tributos/.test(it.onde) && !api.matDicaDe(ch, "tributo é prestação pecuniária"),
      "D9 apagar a dica de um trecho do resumo: vai para a lixeira, com o trecho e o topico: " + JSON.stringify(it && it.onde));
    api.matGravarDica(ch, "outro trecho", "");
    ok(api.lixLer().length === 1, "D10 salvar vazio um trecho que nao tinha dica nao cria item");
    ok(api.lixRestaurar(it.id).ok && api.matDicaDe(ch, "tributo é prestação pecuniária").texto === "não é multa, é prestação" && api.lixLer().length === 0, "D11 restaurar devolve a dica ao trecho");
    api.matGravarDica(ch, "tributo é prestação pecuniária", ""); const itB = ultimo(api);
    api.matGravarDica(ch, "tributo é prestação pecuniária", "dica nova do trecho");
    ok(api.lixRestaurar(itB.id).ok && api.matDicaDe(ch, "tributo é prestação pecuniária").texto === "dica nova do trecho\n\nnão é multa, é prestação",
      "D12 se o trecho ja tem uma dica nova, a antiga fica embaixo (nao sobrescreve): " + JSON.stringify(api.matDicaDe(ch, "tributo é prestação pecuniária").texto));
  }

  /* ==============================================================
   * E: a nota (do artigo e do trecho)
   * ============================================================== */
  {
    const api = novo();
    const l = api.leiGuardar({ id: "lei_n", nome: "Lei N", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Três." });
    api.leiNotaGuardar("lei_n", "2", "cuidado: o §2º muda o prazo de 30 dias");
    ok(api.lixLer().length === 0, "E1 escrever nota nao vai para a lixeira");
    api.leiNotaGuardar("lei_n", "2", "");
    const it = ultimo(api);
    ok(it && it.tipo === "nota" && it.via === "artigo" && it.risco === "alto" && it.dados.texto === "cuidado: o §2º muda o prazo de 30 dias" && /Lei N/.test(it.onde) && api.leiNotaDe("lei_n", "2") === "",
      "E2 salvar vazio apaga a nota do artigo e ela vai para a lixeira (risco alto: cita paragrafo e prazo): " + JSON.stringify(it && [it.risco, it.onde]));
    api.leiNotaGuardar("lei_n", "3", "");
    ok(api.lixLer().length === 1, "E3 salvar vazio um artigo sem nota nao cria item");
    ok(api.lixRestaurar(it.id).ok && api.leiNotaDe("lei_n", "2") === "cuidado: o §2º muda o prazo de 30 dias", "E4 restaurar devolve a nota ao artigo");
    api.leiNotaGuardar("lei_n", "2", ""); const it2 = ultimo(api);
    api.leiNotaGuardar("lei_n", "2", "nota nova");
    ok(api.lixRestaurar(it2.id).ok && api.leiNotaDe("lei_n", "2") === "nota nova\n\ncuidado: o §2º muda o prazo de 30 dias", "E5 nota nova + antiga: a antiga fica embaixo");
    api.leiNotaGuardar("lei_n", "2", ""); const it3 = ultimo(api);
    api.leiApagar("lei_n");
    const r = api.lixRestaurar(it3.id);
    ok(r.ok === false && r.msg === "lix_falha_lei" && api.lixLer().some((x) => x.id === it3.id), "E6 a lei nao existe mais: avisa e a nota continua na lixeira");
  }
  {
    const api = novo();
    api.leiGuardar({ id: "lei_t", nome: "Lei T", texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiNotaTrechoGuardar("lei_t", "prazo de trinta dias", "pense no dia útil");
    api.leiNotaTrechoGuardar("lei_t", "prazo de trinta dias", "");
    const it = ultimo(api);
    ok(it && it.tipo === "nota" && it.via === "trecho" && it.dados.texto === "pense no dia útil" && it.dados.trecho === "prazo de trinta dias" && !api.leiNotaTrechoDe("lei_t", "prazo de trinta dias"),
      "E7 nota de trecho apagada vai para a lixeira, com o trecho");
    api.leiNotaTrechoGuardar("lei_t", "outro trecho", "");
    ok(api.lixLer().length === 1, "E8 salvar vazio trecho sem nota nao cria item");
    ok(api.lixRestaurar(it.id).ok && api.leiNotaTrechoDe("lei_t", "prazo de trinta dias").texto === "pense no dia útil", "E9 restaurar devolve a nota ao trecho");
    api.leiNotaTrechoGuardar("lei_t", "prazo de trinta dias", ""); const itT = ultimo(api);
    api.leiNotaTrechoGuardar("lei_t", "prazo de trinta dias", "nota nova do trecho");
    ok(api.lixRestaurar(itT.id).ok && api.leiNotaTrechoDe("lei_t", "prazo de trinta dias").texto === "nota nova do trecho\n\npense no dia útil",
      "E10 se o trecho ja tem uma nota nova, a antiga fica embaixo (nao sobrescreve)");
  }

  /* ==============================================================
   * F: o cartao do topico (material) e o do editor
   * ============================================================== */
  {
    const api = novo();
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    api.mcEstudoIniciar();
    const ch = api.matChave("Direito Financeiro", "Restos a pagar");
    api.matGravar(ch, "Resumo.", { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
    const CART = ["P1 :: R1 :: fin", "P2 :: Prazo de 30 dias :: fin", "P3 :: R3 :: fin"].join("\n");
    api.matGravarCartoes(ch, CART, { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
    api.$("dlgMaterial").close();
    api.mcEstudarDireto("Direito Financeiro", "Restos a pagar");
    const p = api.mcApagarCartao(1);
    await tick();
    const m1 = api.$("uiModalMsg").textContent;
    ok(/P2/.test(m1) && /Risco alto/.test(m1) && /lixeira/.test(m1), "F1 a 1ª pergunta do cartao mostra o risco (o verso cita prazo) e a lixeira: " + m1.replace(/\n/g, "|"));
    api.uiModalResponder(true);
    await tick();
    ok(/lixeira/.test(api.$("uiModalMsg").textContent) && !/não dá para desfazer/.test(api.$("uiModalMsg").textContent), "F1a a 2ª pergunta nao diz mais que 'nao da para desfazer': " + api.$("uiModalMsg").textContent.replace(/\n/g, "|"));
    api.uiModalResponder(true);
    await p;
    const it = ultimo(api);
    ok(it && it.tipo === "cartao" && it.via === "material" && it.risco === "alto" && it.dados.bloco === "P2 :: Prazo de 30 dias :: fin" && it.dados.linha === 2 && /Restos a pagar/.test(it.onde),
      "F2 o cartao apagado do topico vai para a lixeira: o bloco, a linha e o topico: " + JSON.stringify(it && [it.dados.bloco, it.dados.linha, it.onde]));
    ok(String(api.matResumosAtual()[ch].cartoes) === "P1 :: R1 :: fin\nP3 :: R3 :: fin", "F3 (o cartao saiu do topico)");
    ok(api.lixRestaurar(it.id).ok && String(api.matResumosAtual()[ch].cartoes) === CART, "F4 restaurar devolve o cartao no MESMO lugar, colado como estava: " + JSON.stringify(api.matResumosAtual()[ch].cartoes));
    ok(api.matContarCartoes(ch) === 3, "F5 e os tres contam de novo");
    /* nao: nada vai para a lixeira, e fica no historico */
    const antes = api.lixLer().length;
    const p2 = api.mcApagarCartao(0);
    api.uiModalResponder(false);
    await p2;
    const d = dec(api).slice(-1)[0];
    ok(api.lixLer().length === antes && d.regra === "apagar.cartao" && d.decisao === "recusou", "F6 dizer NAO na 1ª pergunta: nada vai para a lixeira e o historico guarda: " + JSON.stringify(d && [d.regra, d.decisao]));
    const nDec = dec(api).length;
    const p3 = api.mcApagarCartao(0);
    api.uiModalResponder(true); await tick(); api.uiModalResponder(false);
    await p3;
    ok(api.lixLer().length === antes && dec(api).length === nDec + 1 && dec(api).slice(-1)[0].decisao === "recusou" && api.matContarCartoes(ch) === 3, "F7 dizer NAO na 2ª pergunta tambem gera um registro novo no historico");
    Object.keys(api.matResumosAtual()).forEach((k) => delete api.matResumosAtual()[k]);
  }
  {
    /* cartoes separados por linha em branco voltam separados */
    const api = novo();
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    api.mcEstudoIniciar();
    const ch = api.matChave("Direito", "Cartões");
    api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Cartões" });
    const CART = ["A :: 1 :: t", "", "B :: 2 :: t", "", "C :: 3 :: t"].join("\n");
    api.matGravarCartoes(ch, CART, { disciplina: "Direito", topico: "Cartões" });
    api.$("dlgMaterial").close();
    api.mcEstudarDireto("Direito", "Cartões");
    const p = api.mcApagarCartao(1);
    api.uiModalResponder(true); await tick(); api.uiModalResponder(true);
    await p;
    const it = ultimo(api);
    ok(it.dados.sep && it.dados.sep.antes === true && it.dados.sep.depois === true, "F8 o cartao guarda se havia branco de cada lado: " + JSON.stringify(it.dados.sep));
    ok(api.lixRestaurar(it.id).ok && String(api.matResumosAtual()[ch].cartoes) === CART, "F9 cartoes separados por branco voltam separados: " + JSON.stringify(api.matResumosAtual()[ch].cartoes));
    Object.keys(api.matResumosAtual()).forEach((k) => delete api.matResumosAtual()[k]);
  }
  {
    /* o cartao do editor */
    const api = novo();
    const ed = api.$("editor");
    const EDIT = "@ Título\nFrente :: Verso\n+ mais\n\nOutro :: Cartão :: t";
    ed.value = EDIT;
    const p = api.excluirCartao({ front: "Frente", line: 2 });
    await tick();
    const msg = api.$("uiModalMsg").textContent;
    ok(/Excluir este cartão/.test(msg) && /lixeira/.test(msg), "F10 a pergunta do editor diz que vai para a lixeira: " + msg.replace(/\n/g, "|"));
    api.uiModalResponder(true);
    await p;
    const it = ultimo(api);
    ok(it && it.tipo === "cartao" && it.via === "editor" && it.dados.bloco === "@ Título\nFrente :: Verso\n+ mais" && it.dados.linha === 1 && ed.value === "Outro :: Cartão :: t",
      "F11 o cartao do editor sai com o titulo e a continuacao, e o bloco inteiro vai para a lixeira: " + JSON.stringify(it && it.dados));
    ok(api.lixRestaurar(it.id).ok && ed.value === EDIT, "F12 restaurar devolve o bloco exatamente onde estava: " + JSON.stringify(ed.value));
    ok(api.$("btnDesfazerColagem").disabled === false, "F13 (e o 'desfazer' do editor continua a valer)");
    const p2 = api.excluirCartao({ front: "Frente", line: 2 });
    api.uiModalResponder(false);
    await p2;
    ok(ed.value === EDIT && api.lixLer().length === 0 && dec(api).slice(-1)[0].decisao === "recusou", "F14 dizer NAO: o cartao fica, nada na lixeira, e o historico guarda");
  }
  {
    /* o cartao do editor volta EXATAMENTE como estava, com ou sem linha em branco de cada lado */
    const api = novo();
    const ed = api.$("editor");
    const casos = [
      ["colados", "A :: 1 :: t\nB :: 2 :: t\nC :: 3 :: t", 2],
      ["branco so' depois", "A :: 1 :: t\nB :: 2 :: t\n\nC :: 3 :: t", 2],
      ["branco so' antes", "A :: 1 :: t\n\nB :: 2 :: t\nC :: 3 :: t", 3],
      ["branco dos dois lados", "A :: 1 :: t\n\nB :: 2 :: t\n\nC :: 3 :: t", 3],
    ];
    for (const [nome, EDIT, linha] of casos) {
      ed.value = EDIT;
      const p = api.excluirCartao({ front: "B", line: linha });
      api.uiModalResponder(true);
      await p;
      const it = ultimo(api);
      ok(!/B :: 2/.test(ed.value), "F15 (" + nome + ") o cartao saiu do editor");
      ok(api.lixRestaurar(it.id).ok && ed.value === EDIT, "F15a cartao do editor, " + nome + ": volta exatamente como estava: " + JSON.stringify(ed.value));
    }
  }

  /* ==============================================================
   * G: o "desfazer" logo depois de apagar
   * ============================================================== */
  {
    const api = novo();
    api.segurarAdiados();
    api.leiGuardar({ id: "lei_d", nome: "Lei D", texto: "Art. 1º Um." });
    api.leiNotaGuardar("lei_d", "1", "minha nota");
    api.leiNotaGuardar("lei_d", "1", "");
    ok(api.$("barraLixeira").hidden === false && api.$("btnLixDesfazer").hidden === false, "G1 o aviso com 'desfazer' aparece");
    ok(api.lixDesfazer() === true && api.leiNotaDe("lei_d", "1") === "minha nota" && api.lixLer().length === 0, "G2 'desfazer' restaura o ultimo");
    ok(/Restaurado: Nota/.test(api.$("lixTxt").textContent) && api.$("btnLixDesfazer").hidden === true, "G3 e o aviso diz que restaurou (sem 'desfazer' de novo): " + api.$("lixTxt").textContent);
    ok(api.lixDesfazer() === false, "G4 sem nada para desfazer: falso");
    ok(!api.$("uiModal").open, "G4a e sem abrir alerta nenhum (o 'ultimo' foi zerado ao restaurar)");
    api.leiNotaGuardar("lei_d", "1", "a");   /* a nota volta a existir */
    api.leiNotaGuardar("lei_d", "1", "");
    api.leiNotaGuardar("lei_d", "1", "b");
    api.leiNotaGuardar("lei_d", "1", "");
    ok(api.lixLer().length === 2, "G5 dois apagamentos seguidos: os dois ficam");
    api.lixDesfazer();
    ok(api.leiNotaDe("lei_d", "1") === "b" && api.lixLer().length === 1 && api.lixLer()[0].dados.texto === "a", "G6 'desfazer' traz o ULTIMO; o anterior continua na lixeira");
    api.soltarAdiados();           /* quem segura tem de soltar: o estado e' do processo e vale para os testes seguintes */
  }

  /* ==============================================================
   * K: o aviso mora DENTRO da janela aberta
   *
   * Uma janela modal deixa tudo o que esta fora dela inerte. O aviso "apagado — desfazer" aparecia por cima
   * (era um popover), mas o clique em "desfazer" nao chegava nele. Agora ele e' movido para dentro da janela
   * que foi aberta por ULTIMO; sem janela aberta, fica na pagina.
   * ============================================================== */
  {
    const api = novo();
    api.segurarAdiados();
    const bar = api.$("barraLixeira");
    const jogar = () => api.lixJogar({ tipo: "dica", via: "questao", motivo: "vazio", rotulo: "d", onde: "q", dados: { id: "z", texto: "d" } });
    const dono = () => (bar.parentNode && bar.parentNode.id) || "";
    jogar();
    ok(!/^dlg/.test(dono()), "K1 sem janela aberta o aviso fica na pagina: " + dono());
    /* dlgMaterial vem ANTES de dlgMcEstudo no HTML */
    api.abrirModal("dlgMaterial"); api.abrirModal("dlgMcEstudo");
    jogar();
    ok(dono() === "dlgMcEstudo", "K2 com duas janelas abertas o aviso vai para a de cima (a aberta por ultimo): " + dono());
    api.$("dlgMcEstudo").close(); api.$("dlgMaterial").close();
    api.abrirModal("dlgMcEstudo"); api.abrirModal("dlgMaterial");
    jogar();
    ok(dono() === "dlgMaterial", "K3 a de cima e' a aberta por ultimo, mesmo vindo antes no HTML: " + dono());
    api.$("dlgMcEstudo").close(); api.$("dlgMaterial").close();
    jogar();
    ok(!/^dlg/.test(dono()), "K4 fechadas as janelas, o aviso volta para a pagina: " + dono());
    ok(api.$("btnLixDesfazer").onclick !== null && bar.hidden === false, "K5 (o botao continua ligado depois de mudar de lugar)");
    api.soltarAdiados();
  }

  /* ==============================================================
   * H: a tela
   * ============================================================== */
  {
    const api = novo();
    api.leiGuardar({ id: "lei_h", nome: "Lei H", texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiNotaGuardar("lei_h", "1", "nota um"); api.leiNotaGuardar("lei_h", "1", "");
    api.leiNotaGuardar("lei_h", "2", "nota dois com prazo de 5 dias"); api.leiNotaGuardar("lei_h", "2", "");
    api.lixJogar({ tipo: "cartao", via: "editor", rotulo: "cartao x", onde: "editor", dados: { bloco: "X :: Y" } });
    ok(api.lixAbrir() === true && api.$("dlgLixeira").open, "H1 a tela abre");
    const cx = api.$("lixLista");
    const itens = achar(cx, (c) => cls(c, "lix-item"));
    ok(itens.length === 3 && /Cartão/.test(itens[0].textContent) && /Nota/.test(itens[2].textContent), "H2 os tres itens, do mais novo para o mais velho: " + itens.map((x) => x.children[0].textContent.slice(17, 30)));
    ok(/3 item\(ns\) · 1 cartão\(ões\) · 0 questão\(ões\) · 0 dica\(s\) · 2 nota\(s\) · 1 de risco alto/.test(api.$("lixResumo").textContent), "H3 o resumo conta por tipo e o risco alto: " + api.$("lixResumo").textContent);
    ok(api.$("btnLixF_nota").textContent === "notas (2)" && api.$("btnLixF_cartao").textContent === "cartões (1)" && api.$("btnLixF_questao").textContent === "questões (0)", "H4 filtros por tipo com contagem");
    api.$("btnLixF_nota").onclick();
    ok(achar(api.$("lixLista"), (c) => cls(c, "lix-item")).length === 2, "H5 o filtro mostra so' as notas");
    api.$("btnLixF_questao").onclick();
    ok(/Nada deste tipo/.test(api.$("lixLista").textContent), "H6 filtro sem itens: diz que nao ha");
    api.$("btnLixF_todos").onclick();
    ok(itens[0].textContent.indexOf("X :: Y") >= 0 && achar(api.$("lixLista"), (c) => cls(c, "dec-risco-alto")).length === 1
      && achar(api.$("lixLista"), (c) => cls(c, "dec-risco-alto"))[0].textContent === "risco alto", "H7 mostra o texto apagado e o risco (por escrito)");
    /* restaurar pela tela */
    achar(api.$("lixLista"), (c) => cls(c, "lix-restaurar"))[2].onclick();
    ok(api.leiNotaDe("lei_h", "1") === "nota um" && api.lixLer().length === 2 && achar(api.$("lixLista"), (c) => cls(c, "lix-item")).length === 2, "H8 'restaurar' devolve e a lista se repinta");
    ok(api.$("btnLixeira").textContent === "lixeira (2)", "H9 o botao do rodape se atualiza: " + api.$("btnLixeira").textContent);
    /* apagar de vez: pergunta e mostra o que e' */
    const p = api.lixApagarDeVez(api.lixLer()[0].id);
    await tick();
    ok(/Apagar de vez\?/.test(api.$("uiModalMsg").textContent) && /Nota “nota dois/.test(api.$("uiModalMsg").textContent) && /risco alto/.test(api.$("uiModalMsg").textContent), "H10 a pergunta mostra o que sera apagado e o risco: " + api.$("uiModalMsg").textContent.replace(/\n/g, "|"));
    api.uiModalResponder(false);
    ok((await p) === false && api.lixLer().length === 2, "H11 'nao': continua na lixeira");
    const p2 = api.lixApagarDeVez(api.lixLer()[0].id);
    await tick();
    api.uiModalResponder(true);
    ok((await p2) === true && api.lixLer().length === 1, "H12 'sim': sai de vez");
    const d = dec(api).slice(-1)[0];
    ok(d.regra === "apagar.definitivo" && d.decisao === "aceitou" && d.via === "lixeira" && d.risco === "alto", "H13 apagar de vez fica no historico: " + JSON.stringify([d.regra, d.via, d.risco]));
    /* esvaziar */
    api.lixJogar({ tipo: "questao", via: "banco", rotulo: "q", onde: "d", dados: { q: { id: "z", enunciado: "Q?", tentativas: [{ ok: false }] } } });
    const p3 = api.lixEsvaziar();
    await tick();
    const m = api.$("uiModalMsg").textContent;
    ok(/Esvaziar a lixeira\?/.test(m) && /2 item\(ns\): 1 cartão\(ões\), 1 questão\(ões\), 0 dica\(s\), 0 nota\(s\)\. 1 de risco alto/.test(m), "H14 esvaziar mostra o que se perde, por tipo e o risco alto: " + m.replace(/\n/g, "|"));
    api.uiModalResponder(false);
    ok((await p3) === false && api.lixLer().length === 2, "H15 'nao': nada se perde");
    const p4 = api.lixEsvaziar();
    await tick();
    api.uiModalResponder(true);
    ok((await p4) === true && api.lixLer().length === 0 && api.$("btnLixeira").textContent === "lixeira", "H16 'sim': esvazia e o botao volta a 'lixeira'");
    const d2 = dec(api).slice(-1)[0];
    ok(d2.regra === "apagar.definitivo" && d2.via === "esvaziar" && d2.proposta.n === 2, "H17 esvaziar fica no historico com quantos itens: " + JSON.stringify([d2.via, d2.proposta.n]));
    ok((await api.lixEsvaziar()) === false, "H18 esvaziar uma lixeira vazia: nada");
    api.lixPintar();
    ok(/A lixeira está vazia/.test(api.$("lixLista").textContent), "H19 vazia: diz como ela enche");
  }
  {
    /* uma restauracao que falha avisa e o item fica */
    const api = novo();
    api.lixJogar({ tipo: "dica", via: "questao", motivo: "vazio", rotulo: "d", onde: "q", dados: { id: "sumiu", texto: "d" } });
    const id = ultimo(api).id;
    const p = Promise.resolve(api.lixRestaurarUi(id));
    await tick();
    ok(/não existe mais/.test(api.$("uiModalMsg").textContent) && api.lixLer().length === 1, "H20 restaurar sem ter para onde: avisa e o item continua: " + api.$("uiModalMsg").textContent);
    api.uiModalResponder(true);
    await p;
  }

  /* ==============================================================
   * I: HTML, backup, textos
   * ============================================================== */
  {
    const { api } = rodar();
    const pos = (s) => html.indexOf(s);
    ok(/id="btnLixeira"/.test(html) && /<dialog id="dlgLixeira"/.test(html) && /id="barraLixeira" popover="manual" hidden/.test(html), "I1 o botao, a janela e o aviso (popover, para ficar acima das janelas) existem");
    ok(pos('<script src="decisoes.js"></script>') < pos('<script src="lixeira.js"></script>'), "I2 lixeira.js carrega depois de decisoes.js");
    ok(/\.lix-barra\{position:fixed/.test(html), "I3 CSS do aviso");
    ok(/"eac_lixeira"/.test(fs.readFileSync(path.join(__dirname, "..", "docs", "backup.js"), "utf8")), "I4 a lixeira entra no backup");
    ok(/"lixeira\.js"/.test(fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8")), "I5 e no service worker");
    const chaves = ["lix_botao", "lix_botao_n", "lix_botao_aj", "lix_titulo", "lix_ajuda", "lix_resumo", "lix_vazio", "lix_vazio_filtro", "lix_mais", "lix_f_todos", "lix_restaurar", "lix_apagar_vez", "lix_esvaziar",
      "lix_desfazer", "lix_ver", "lix_apagado", "lix_restaurado", "lix_ja_existe", "lix_falha_generica", "lix_falha_questao", "lix_falha_lei", "lix_falha_topico", "lix_veio_vazio", "lix_onde_editor",
      "lix_vez_conf", "lix_esvaziar_conf", "lix_aviso_padrao", "lix_aviso_alto", "lix_aviso_hist", "lix_acao_restaurar", "lix_motivo_vazio", "lix_motivo_restaurado", "lix_motivo_definitivo", "dec_r_apagar_definitivo"]
      .concat(["cartao", "questao", "dica", "nota"].flatMap((k) => ["lix_t_" + k, "lix_tipo1_" + k, "lix_acao_" + k, "dec_r_apagar_" + k]));
    const conta = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": ", "g")) || []).length;
    const semPar = chaves.filter((k) => conta(k) !== 2);
    ok(semPar.length === 0, "I6 todas as chaves existem em portugues E em ingles: " + semPar.join(","));
    ok(api.decTituloDaRegra("apagar.cartao") === "Apagar cartão" && api.decTituloDaRegra("apagar.definitivo") === "Apagar de vez da lixeira", "I7 cada regra nova tem titulo legivel no historico de decisoes");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
