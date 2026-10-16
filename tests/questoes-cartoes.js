/* =====================================================================
 * OS CARTÕES QUE NASCERAM DE UMA QUESTÃO (v18.57.0)
 *
 * O pedido: "criar forma de saber se uma questão já teve cartões criados
 * a partir dela e visualizar os cartões gerados dela". O "virar em
 * cartões" grava cada cartão com a etiqueta da questão (qs_<id>); a
 * questão mostra "ver os N cartões" (resolução) e o selo 🃏 N (lista), e a
 * janela lista os cartões, com "abrir na Biblioteca" já filtrado.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 20 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };
  const DISC = "Tributário", TOP = "Obrigação tributária";
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.matGravar(ch, "Resumo do tópico.", { disciplina: DISC, topico: TOP });
    api.qsAplicar(api.qsLerResposta([
      "[QUESTAO] ENUNCIADO: O lançamento é ato privativo da autoridade administrativa. GABARITO: C COMENTARIO: art. 142 do CTN.",
      "[QUESTAO] ENUNCIADO: Outra questão sem cartões. GABARITO: E COMENTARIO: c.",
    ].join("\n"), { disciplina: DISC, topico: TOP, chave: ch }).achados);
    return { api, ch };
  };
  const salvarCartoes = async (api, texto) => {
    api.$("mcTexto").value = texto;
    if (typeof api.matCartoesConferir === "function") api.matCartoesConferir();
    await conduzir(api, api.matCartoesSalvar());
  };

  {
    const { api, ch } = montar();
    const [q, q2] = api.qsFiltrar({ chave: ch });
    ok(api.qsCartoesDaQuestao(q).length === 0, "C0 antes: nenhuma questão tem cartões");
    /* virar em cartões a partir da questão */
    api.qsUiResponderAbrir([q], "aba", "t");
    api.qsUiCartoesDaQuestao(q);
    ok(api.$("dlgMatCartoes").open === true, "C1 'virar em cartões' abre o painel de cartões do tópico");
    await salvarCartoes(api, "Quem faz o lançamento? :: A autoridade administrativa (art. 142 do CTN).\nO lançamento é vinculado? :: Sim, atividade vinculada e obrigatória.");
    const txt = String((api.matResumosAtual ? api.matResumosAtual()[ch] : {}).cartoes || "");
    const tag = api.qsEtiquetaDaQuestao(q.id);
    const cs = api.qsCartoesDaQuestao(q);
    ok(cs.length === 2 && cs[0].frente === "Quem faz o lançamento?" && /autoridade administrativa/.test(cs[0].verso), "C2 os cartões gravados ficam ligados à questão: " + JSON.stringify(cs.map((c) => c.frente)));
    ok(api.qsCartoesDaQuestao(q2).length === 0, "C2a a outra questão continua sem cartões");
    ok(!txt || txt.split("\n").filter((l) => l.indexOf(tag) >= 0).length === 2, "C2b a ligação é a etiqueta qs_<id> em cada cartão");
    /* cartões do resumo (não de questão): sem a etiqueta */
    api.matCartoesAbrir();
    await salvarCartoes(api, "Cartão do resumo :: sem questão nenhuma.");
    ok(api.qsCartoesDaQuestao(q).length === 2, "C3 cartões criados pelo resumo não entram na conta da questão");
    const idx = api.qsCartoesIndice();
    ok(Object.keys(idx).length === 1 && (idx[tag] || []).length === 2, "C3a o índice só tem a questão de onde vieram cartões");

    /* na resolução: 'ver os 2 cartões' */
    api.$("dlgMatCartoes").close();
    api.qsUiResponderAbrir([q], "aba", "t2");
    api.qsResponder("C"); api.qsUiPintarSessao();
    const bv = api.$("qsSessCorpo").querySelectorAll("#btnQsCartoesVer")[0] || api.$("btnQsCartoesVer");
    ok(bv && /ver os 2 cartões/.test(bv.textContent), "C4 depois de responder, a questão mostra 'ver os 2 cartões': " + (bv && bv.textContent));
    bv.onclick();
    const itens = (api.$("qsCartoesLista").children || []).filter((x) => /qs-cartao-item/.test(x.className || ""));
    ok(api.$("dlgQsCartoes").open === true && itens.length === 2 && /Cartões desta questão \(2\)/.test(api.$("qsCartoesTit").textContent), "C5 a janela lista os 2 cartões");
    ok(/no tópico: Obrigação tributária/.test(itens[0].textContent), "C5a cada cartão diz em que tópico está");
    api.$("btnQsCartoesBib").onclick();
    ok(api.$("dlgQsCartoes").open === false && api.$("dlgGerCartoes").open === true && api.$("gerBusca").value === tag, "C6 'abrir na Biblioteca' abre a Biblioteca já filtrada pela questão");
    api.$("dlgGerCartoes").close();
    /* a outra questão: sem o botão */
    api.qsUiResponderAbrir([q2], "aba", "t3");
    api.qsResponder("E"); api.qsUiPintarSessao();
    const minis = api.$("qsSessCorpo").querySelectorAll(".qs-bt-mini");
    ok(minis.length >= 2 && !minis.some((b) => b.id === "btnQsCartoesVer" || /ver os/.test(b.textContent || "")), "C7 questão sem cartões não mostra o 'ver': " + minis.map((b) => b.textContent).join(" | "));
    api.$("dlgQsResponder").close();
    /* na lista: o selo */
    api.qsUiRender();
    const selos = api.$("qsLista").querySelectorAll(".qs-item-cartoes");
    ok(selos.length === 1 && selos[0].textContent === "🃏 2", "C8 na lista, só a questão com cartões ganha o selo 🃏 2");
    selos[0].onclick();
    ok(api.$("dlgQsCartoes").open === true, "C8a tocar no selo mostra os cartões");
    api.$("dlgQsCartoes").close();
    /* a questão movida continua achando os cartões (estão no tópico velho) */
    api.edCriar("ISS", "# ISS\n@ Financeiro :: 3\n+ Receita pública :: 3");
    api.qsMover([q.id], { disciplina: "Financeiro", topico: "Receita pública" });
    ok(api.qsCartoesDaQuestao(api.qsTodas().find((x) => x.id === q.id)).length === 2, "C9 a questão movida continua achando os cartões dela");
    /* a mesma etiqueta duas vezes na linha (colada à mão) conta um cartão só */
    const ch2 = api.matChave("Financeiro", "Receita pública");
    api.matGravarCartoes(ch2, "Frente X :: Verso X :: " + api.qsEtiquetaDaQuestao(q2.id) + " " + api.qsEtiquetaDaQuestao(q2.id), { disciplina: "Financeiro", topico: "Receita pública" });
    ok(api.qsCartoesDaQuestao(q2).length === 1, "C9a etiqueta repetida na mesma linha conta um cartão só: " + api.qsCartoesDaQuestao(q2).length);
  }
  {
    const { api } = rodar();
    ["qs_cartoes_tit", "qs_cartoes_ver", "qs_cartoes_selo", "qs_cartoes_bib", "qs_cartoes_nenhum", "qs_cartoes_onde"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "C10 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
