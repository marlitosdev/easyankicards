/* =====================================================================
 * MELHORAR CARTÕES: A FILA FICA NO TÓPICO ESCOLHIDO (v19.13.0)
 *
 * O RELATO: "o tópico Administração tributária tinha 12 cartões; melhorei os 12; depois apareceram centenas de outros
 * que não estavam naquele tópico"; e "fechar não volta à Biblioteca".
 *
 * O QUE PRECISA SER VERDADE:
 *  1. aberto com cartões da Biblioteca, a rodada seguinte fica no MESMO tópico (os que ainda faltam ali);
 *  2. a faixa diz quantos faltam no tópico e que os outros fracos são de outros tópicos; acabou no tópico → "✓";
 *  3. "Continuar com outros tópicos" passa à fila larga, AGRUPADA por tópico (cabeçalhos); "← Só …" volta;
 *  4. fechar volta à Biblioteca, na mesma pasta;
 *  5. menos poluição: as opções (objetivo, quais cartões, busca, atalhos, explicação) ficam recolhidas.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const conduzir = async (api, promessa) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };
  const bom = (q, r2) => q + " :: " + r2 + " com uma explicacao bem mais completa para passar de cem caracteres e ensinar de verdade o assunto ao aluno estudando, conforme o art. 1º :: x" + NL + "+ Saiba mais — Art. 1º";

  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.$("editor").value = "";
  const chA = api.matChave("Tributário", "Administração tributária");
  const chB = api.matChave("Tributário", "Crédito tributário");
  const chC = api.matChave("Processo", "Recursos");
  api.matGravarCartoes(chA, ["Quem fiscaliza o ISS? :: O fisco", "O que é a fiscalização? :: Poder", "Quem lança o tributo? :: A autoridade"].join(NL + NL), { disciplina: "Tributário", topico: "Administração tributária" });
  api.matGravarCartoes(chB, ["O que é o crédito? :: Valor", "Quando nasce o crédito tributário? :: Com o lançamento feito pela autoridade administrativa competente, que verifica o fato gerador, calcula o montante e identifica o sujeito passivo da obrigação"].join(NL + NL), { disciplina: "Tributário", topico: "Crédito tributário" });
  api.matGravarCartoes(chC, ["Qual o prazo do recurso? :: 10 dias"].join(NL + NL), { disciplina: "Processo", topico: "Recursos" });
  const todas = api.cqLerBiblioteca();
  const doA = todas.filter((n) => n.chave === chA);
  const cLongo = todas.find((n) => /Quando nasce/.test(n.card.front));
  ok(cLongo && api.ceNivel(cLongo.card) === "fraco" && api.ceNota(cLongo.card) > api.ceNota(todas.find((n) => /prazo do recurso/.test(n.card.front)).card), "S0a um cartão do Crédito é fraco mas MELHOR que o de Recursos (a ordem só pela nota intercalaria os tópicos): " + (cLongo && api.ceNota(cLongo.card)));
  ok(doA.length === 3 && todas.length === 6, "S0 preparo: 3 cartões fracos no tópico A, 3 em outros tópicos: " + doA.length + "/" + todas.length + " " + todas.map((n) => n.chave).join("|"));

  /* ---- 1 e 2: escolhe 2 dos 3 do tópico A, aplica: a rodada 2 é o que falta no A ---- */
  const escolhidos = doA.slice(0, 2);
  api.ceAbrir({ notas: escolhidos, volta: { pasta: { chave: chA } } });
  ok(api.ceOrigemAtual() && api.ceOrigemAtual().nome === "Tributário › Administração tributária", "O1 a origem é o tópico dos cartões trazidos: " + (api.ceOrigemAtual() && api.ceOrigemAtual().nome));
  ok(api.$("ceOpcoes") && api.$("ceOpcoes").open !== true, "V1 as opções da fila ficam recolhidas (menos poluição)");
  api.$("btnCePrompt").onclick();
  const fr = [...api.ceSelAtual()].sort().map((i) => api.ceNotasAtual()[i].card);
  api.$("ceColar").value = "@@ 1" + NL + bom(fr[0].front, fr[0].back) + NL + NL + "@@ 2" + NL + bom(fr[1].front, fr[1].back);
  await conduzir(api, api.ceConferirColagem());
  if (!api.ceConfAtual() || !api.ceConfAtual().itens.every((x) => x.aceitar)) falhas.push("P0 a conferência devia aceitar respostas que mantêm o conteúdo: " + JSON.stringify(api.ceConfAtual() && api.ceConfAtual().itens.map((x) => x.avisos.map((a) => a.id))));
  await conduzir(api, api.$("btnCeAplicar").onclick());
  const notas2 = api.ceNotasAtual();
  ok(notas2.length === 1 && notas2[0].chave === chA, "O2 a rodada 2 fica no MESMO tópico: só o que falta ali (1), não os 3 de outros tópicos: " + notas2.map((n) => n.chave).join(" | "));
  const ori = () => api.$("ceOrigem").textContent;
  ok(!api.$("ceOrigem").hidden && /Administração tributária: 1 cartão\(ões\) ainda a melhorar/.test(ori()), "O3 a faixa diz quantos faltam no tópico: " + ori());
  ok(/outros 3 cartões fracos/.test(ori()) && /2 tópico/.test(ori()), "O4 e que os outros são de outros tópicos (3 em 2): " + ori());
  ok(api.$("ceResumo").hidden === true, "O5 o placar da biblioteca inteira some (só confundia)");
  ok(api.$("ceLista").querySelectorAll(".cq-onde").length === 0, "O5a no tópico escolhido, a linha de cada cartão não repete o tópico (a faixa já diz)");
  ok(/✓ Rodada 1 aplicada: 2 cartão\(ões\) melhorado/.test(api.$("ceMsg").textContent) && !/não encontrado/.test(api.$("ceMsg").textContent), "O6 a mensagem curta da rodada: " + api.$("ceMsg").textContent);

  /* ---- termina o tópico ---- */
  api.$("btnCePrompt").onclick();
  const f3 = api.ceNotasAtual()[0].card;
  api.$("ceColar").value = "@@ 1" + NL + bom(f3.front, f3.back);
  await conduzir(api, api.ceConferirColagem());
  await conduzir(api, api.$("btnCeAplicar").onclick());
  ok(api.ceNotasAtual().length === 0 && /✓ Tributário › Administração tributária: nenhum cartão fraco/.test(ori()), "T1 acabou no tópico: ✓ e a fila vazia (sem puxar os outros): " + ori());
  ok(!/pronta: 0/.test(api.$("ceMsg").textContent), "T1a acabou: a mensagem não anuncia uma rodada vazia: " + api.$("ceMsg").textContent);
  const bOutros = api.$("ceOrigem").querySelectorAll("button").filter((b) => b.id === "btnCeOutros")[0];
  ok(bOutros && /Continuar com outros tópicos \(3\)/.test(bOutros.textContent), "T2 o caminho para os outros tópicos é um botão, com a contagem");

  /* ---- 3: outros tópicos, agrupados ---- */
  if (!bOutros) return falhas;
  bOutros.onclick();
  ok(api.ceNotasAtual().length === 3 && /Todos os tópicos: 3 cartões fracos em 2 tópico/.test(ori()), "G1 a fila larga: 3 em 2 tópicos: " + ori());
  ok(api.$("ceResumo").hidden === true, "G1a nos outros tópicos, também sem o placar geral (a faixa diz quantos e em quantos tópicos)");
  const grupos = api.$("ceLista").querySelectorAll(".ce-grupo").map((g) => g.textContent);
  ok(grupos.length === 2 && grupos.some((g) => /Crédito tributário · 2/.test(g)) && grupos.some((g) => /Recursos · 1/.test(g)), "G2 com cabeçalho por tópico: " + grupos.join(" | "));
  const ch = api.ceNotasAtual().map((n) => n.chave);
  ok(ch.join() === [...ch].sort((a, b) => (a === b ? 0 : ch.indexOf(a) - ch.indexOf(b))).join() && ch.filter((x, i) => i && x !== ch[i - 1]).length === 1, "G3 os cartões do mesmo tópico ficam juntos: " + ch.join(" | "));
  /* o agrupamento em si: notas intercaladas entre tópicos; a origem sempre primeiro */
  const ag = api.ceAgrupar([{ chave: "b", nota: 15 }, { chave: "c", nota: 20 }, { chave: "b", nota: 30 }, { chave: chA, nota: 60 }]);
  ok(ag.map((n) => n.chave + n.nota).join() === chA + "60,b15,b30,c20", "G3a a origem primeiro; depois o tópico com o pior cartão, cada tópico junto: " + ag.map((n) => n.chave + n.nota).join());
  const bSo = api.$("ceOrigem").querySelectorAll("button").filter((b) => b.id === "btnCeSoOrigem")[0];
  ok(bSo && /Só Tributário › Administração tributária/.test(bSo.textContent), "G4 '← Só …' volta ao tópico escolhido");
  bSo.onclick();
  ok(api.ceNotasAtual().length === 0 && /nenhum cartão fraco/.test(ori()), "G5 de volta ao tópico");

  /* ---- 4: fechar volta à Biblioteca, na mesma pasta ---- */
  await conduzir(api, api.$("btnCeFechar").onclick());
  ok(!api.$("dlgCartElevar").open && api.$("dlgGerCartoes").open && api.gerPastaAtual() && api.gerPastaAtual().chave === chA, "F1 fechar volta à Biblioteca, na pasta do tópico");
  /* aberto sem vir da Biblioteca: fechar só fecha */
  api.$("dlgGerCartoes").close();
  api.ceAbrir();
  ok(api.$("ceOrigem").hidden === true && !api.ceOrigemAtual(), "F2 aberto pelo botão geral: sem faixa de origem");
  await conduzir(api, api.$("btnCeFechar").onclick());
  ok(!api.$("dlgCartElevar").open && !api.$("dlgGerCartoes").open, "F3 e fechar só fecha");

  /* ---- textos ---- */
  ["ce_bancada_nome", "ce_origem_n", "ce_ori_fila", "ce_ori_feito", "ce_ori_quase", "ce_ori_fora", "ce_ori_todos", "ce_b_outros", "ce_b_so_origem", "ce_b_voltar_bib",
    "ce_tip_outros", "ce_tip_so_origem", "ce_tip_voltar_bib", "ce_grupo_origem", "ce_opcoes", "ce_msg_aplicada2", "ce_msg_nao_achou"].forEach((k) =>
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
