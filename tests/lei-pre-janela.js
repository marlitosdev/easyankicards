/* =====================================================================
 * (19.107.0) A JANELA DO TEXTO EM CADA SUGESTÃO DA LIMPEZA
 *
 * Cada sugestão mostra o trecho do texto onde ela age, com as linhas de cima e de baixo e a parte afetada PINTADA
 * (sai · entra · junta à linha de cima · trecho de outra lei), a alternância "marcado / como fica" e dois botões com
 * o nome da ação no lugar da caixa de marcar.
 *
 *   JA1 cabeçalho de página: a ocorrência pintada de "sai", o artigo onde está e "junto do nº da página"; os botões
 *       "Tirar as N" / "Manter"; trocar a ocorrência (1, 2, 3…) troca a linha
 *   JA2 "como fica": a linha tirada vira "✂ 1 linha(s) tirada(s)"; com "Manter", a linha volta sem pintura e "fica
 *       como veio"
 *   JA3 a linha repetida SEM número de página perto diz isso (a prova de que talvez não seja cabeçalho)
 *   JA4 grafia: o que sai e o que entra, só a parte que muda
 *   JA5 remissão: a linha que sobe pintada de "junta"; "como fica" mostra a frase inteira numa linha
 *   JA6 o trecho de outra lei que aparece na janela vem pintado de roxo (protegido)
 *   JA7 caractere invisível aparece como "◌" pintado de "sai"; "como fica" sem ele
 *   JA8 a legenda só traz as cores que aparecem nesta revisão
 *   JA9 o relatório traz a janela de cada sugestão com as mesmas marcas
 *   JA10 os textos novos existem em português e em inglês
 * ===================================================================== */
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
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const abrir = (texto) => { const pre = api.leiPreprocessar(texto); api.leiRevisarColagemAbrir({ modo: "criar", texto, pre, aoConfirmar: () => {} }); return pre; };
  const pintadas = (el, k) => achar(el, (c) => c.className === "lei-pre-" + k).map((c) => c.textContent);
  const linhasJan = (el) => achar(el, (c) => /^lei-pre-jan-l( alvo)?$/.test(c.className || ""));
  const alvoN = (el) => linhasJan(el).filter((c) => cls(c, "alvo")).map((c) => achar(c, (x) => x.className === "lei-pre-jan-n")[0].textContent);

  /* ---- JA1 / JA2 cabeçalho junto do número da página ---- */
  const CAB = "PREFEITURA MUNICIPAL DE TESTE — GABINETE DO PREFEITO";
  const P = [];
  let art = 0;
  for (let pg = 1; pg <= 6; pg++) {
    P.push(CAB, String(pg));
    for (let k = 0; k < 3; k++) { art++; P.push("Art. " + art + (art < 10 ? "º" : ".") + " Texto do artigo " + art + ", com conteúdo suficiente para formar uma linha comum desta lei de teste."); }
  }
  const pre1 = abrir(P.join("\n"));
  const mCab = pre1.mudancas.find((m) => m.grupo === "cabecalho" && m.antes === CAB);
  ok(!!mCab && mCab.linhas.length === 6, "JA0 (o teste tem o cabeçalho repetido 6 vezes): " + (mCab && mCab.linhas.length));
  const it1 = () => api.$("leiPreItem_" + mCab.id);
  ok(pintadas(it1(), "sai")[0] === CAB && alvoN(it1())[0] === String(mCab.linhas[0]), "JA1 a 1ª ocorrência pintada de 'sai', na linha dela: " + alvoN(it1()));
  ok(linhasJan(it1()).filter((c) => !cls(c, "alvo")).length >= 1, "JA1a com linhas de contexto em volta");
  const provas = achar(it1(), (c) => /^lei-pre-prova/.test(c.className || "")).map((c) => c.textContent);
  ok(provas.indexOf("junto do nº da página") >= 0, "JA1b a prova: junto do nº da página: " + provas.join(" | "));
  const oc = achar(it1(), (c) => cls(c, "lei-pre-ocor"));
  ok(oc.length === 6 && cls(oc[0], "on"), "JA1c uma bolinha por ocorrência (6), a 1ª ligada");
  oc[2].onclick();
  ok(alvoN(it1())[0] === String(mCab.linhas[2]) && cls(achar(it1(), (c) => cls(c, "lei-pre-ocor"))[2], "on"), "JA1d trocar a ocorrência troca a linha: " + alvoN(it1()));
  const provas3 = achar(it1(), (c) => /^lei-pre-prova/.test(c.className || "")).map((c) => c.textContent);
  ok(provas3.some((x) => /^dentro do Art\. 6/.test(x)), "JA1e o artigo onde está a 3ª ocorrência: " + provas3.join(" | "));
  const sim = api.$("leiPreSim_" + mCab.id), nao = api.$("leiPreNao_" + mCab.id);
  ok(sim.textContent === "Tirar as 6" && nao.textContent === "Manter" && cls(sim, "on") && !cls(nao, "on"), "JA1f os botões com o nome da ação: " + [sim.textContent, nao.textContent]);
  api.$("leiPreVista_" + mCab.id + "_fica").onclick();
  ok(/✂ 1 linha\(s\) tirada\(s\)/.test(it1().textContent) && !pintadas(it1(), "sai").length, "JA2 'como fica': a linha tirada: " + it1().textContent.slice(0, 160));
  api.$("leiPreNao_" + mCab.id).onclick();
  ok(api.leiPreCtxAtual().decisoes[mCab.id] === false && /fica como veio/.test(it1().textContent) && it1().textContent.indexOf(CAB) >= 0 && !pintadas(it1(), "sai").length,
    "JA2a com 'Manter', 'como fica' mostra a linha sem pintura e 'fica como veio' (e a vista continua a mesma depois de repintar)");
  ok(cls(api.$("leiPreNao_" + mCab.id), "on") && /off/.test(it1().className), "JA2b o botão 'Manter' fica ligado");

  /* ---- JA3 a linha repetida sem número de página perto ---- */
  const TOPO = "Diário Oficial do Município de Teste - Edição Extra nº 12";
  const Q = [];
  for (let k = 1; k <= 14; k++) {
    Q.push("Seção de teste " + k, "Art. " + (100 + k) + ". Disposição de teste número " + k + " com um texto comum da lei:", "Parágrafo de complemento número " + k + " com mais texto.");
    if (k % 3 === 0) Q.push(TOPO);
  }
  const pre3 = abrir(Q.join("\n"));
  const mTopo = pre3.mudancas.find((m) => m.grupo === "cabecalho" && m.antes === TOPO);
  const prov3 = mTopo ? achar(api.$("leiPreItem_" + mTopo.id), (c) => /^lei-pre-prova/.test(c.className || "")).map((c) => c.textContent) : [];
  ok(!!mTopo && prov3.indexOf("sem nº de página perto") >= 0, "JA3 sem nº de página perto, a prova diz isso: " + prov3.join(" | "));

  /* ---- JA4 grafia ---- */
  const pre4 = abrir(["Art. 1º. Um.", "Art . 2 Dois.", "Art. 3º. Três."].join("\n"));
  const mGra = pre4.mudancas.find((m) => m.grupo === "grafia");
  const it4 = api.$("leiPreItem_" + mGra.id);
  ok(pintadas(it4, "sai")[0] === "Art ." && pintadas(it4, "entra")[0] === "Art." && /Dois\./.test(it4.textContent), "JA4 grafia: só a parte que muda: " + [pintadas(it4, "sai"), pintadas(it4, "entra")]);
  ok(api.$("leiPreSim_" + mGra.id).textContent === "Corrigir" && api.$("leiPreNao_" + mGra.id).textContent === "Deixar como veio", "JA4a os botões da grafia");

  /* ---- JA5 remissão ---- */
  const tx5 = "Art. 1º. Texto do primeiro artigo que remete ao\nart. 5º desta Lei, conforme previsto.\nArt. 2º. Segundo.";
  const pre5 = abrir(tx5);
  const mRem = pre5.mudancas.find((m) => m.grupo === "remissao");
  const it5 = () => api.$("leiPreItem_" + mRem.id);
  ok(pintadas(it5(), "junta")[0] === "art. 5º desta Lei, conforme previsto." && api.$("leiPreSim_" + mRem.id).textContent === "Juntar à linha de cima", "JA5 a linha que sobe, pintada de 'junta': " + pintadas(it5(), "junta"));
  api.$("leiPreVista_" + mRem.id + "_fica").onclick();
  const unida = linhasJan(it5()).map((c) => c.textContent).find((x) => /remete ao art\. 5º desta Lei/.test(x));
  ok(!!unida && pintadas(it5(), "junta")[0] === "art. 5º desta Lei, conforme previsto.", "JA5a 'como fica': a frase inteira numa linha, com a parte que subiu marcada: " + unida);

  /* ---- JA6 o trecho de outra lei, protegido ---- */
  const tx6 = ["Art. 1º Primeiro.", "Art . 2 Segundo com grafia a corrigir.", "Art. 3º A Lei nº 1.234, de 1º de janeiro de 2000, passa a vigorar com as seguintes alterações:",
    "“Art. 9º O texto novo do artigo nove.” (NR)", "Art. 4º Quarto."].join("\n");
  const pre6 = abrir(tx6);
  const mGra6 = pre6.mudancas.find((m) => m.grupo === "grafia");
  const it6 = api.$("leiPreItem_" + mGra6.id);
  ok(pintadas(it6, "prot").some((x) => /Art\. 9º O texto novo/.test(x)), "JA6 a linha citada de outra lei aparece pintada de roxo: " + pintadas(it6, "prot"));

  /* ---- JA7 caractere invisível ---- */
  const tx7 = ["Art. 1º O con­trato é válido.", "Art. 2º Segundo."].join("\n");
  const pre7 = abrir(tx7);
  const mInv = pre7.mudancas.find((m) => m.grupo === "invisiveis");
  const it7 = () => api.$("leiPreItem_" + mInv.id);
  ok(!!mInv && pintadas(it7(), "sai").indexOf("◌") >= 0, "JA7 o caractere invisível aparece como '◌': " + (mInv && pintadas(it7(), "sai")));
  api.$("leiPreVista_" + mInv.id + "_fica").onclick();
  ok(/O contrato é válido\./.test(it7().textContent) && !/◌/.test(it7().textContent), "JA7a 'como fica' sem ele: " + it7().textContent.slice(0, 120));

  /* ---- JA8 a legenda ---- */
  abrir(["Art. 1º. Um.", "Art . 2 Dois.", "Art. 3º. Três."].join("\n"));
  const leg = api.$("leiPreLegenda");
  ok(leg && leg.hidden === false && /sai do texto/.test(leg.textContent) && /entra/.test(leg.textContent) && !/junta à linha de cima/.test(leg.textContent) && !/outra lei/.test(leg.textContent),
    "JA8 só as cores desta revisão (grafia: sai e entra): " + (leg && leg.textContent));
  abrir(tx6);
  ok(/outra lei/.test(api.$("leiPreLegenda").textContent), "JA8a com trecho citado, a cor dele entra na legenda");

  /* ---- JA9 o relatório ---- */
  abrir(P.join("\n"));
  const rel = api.leiRelatorioFluxo("revisar a colagem");
  ok(/janelas do texto: \[-sai-\] \[\+entra\+\] \[\^junta à linha de cima\^\] \{trecho de outra lei\}/.test(rel), "JA9 o relatório explica as marcas");
  ok(rel.split("\n").some((l) => /▸ \[-PREFEITURA MUNICIPAL DE TESTE — GABINETE DO PREFEITO-\]/.test(l)) && /· escolha: aceita/.test(rel), "JA9a e traz a janela de cada sugestão, com a escolha: "
    + rel.split("\n").filter((l) => /▸/.test(l)).slice(0, 2).join(" || "));

  /* ---- JA10 os textos ---- */
  ["lei_pre_leg_sai", "lei_pre_leg_entra", "lei_pre_leg_junta", "lei_pre_leg_prot", "lei_pre_vista_marcado", "lei_pre_vista_fica", "lei_pre_vista_tip",
    "lei_pre_ocor_tip", "lei_pre_prova_pagina", "lei_pre_prova_sem_pagina", "lei_pre_prova_art", "lei_pre_prova_inicio", "lei_pre_jan_corte",
    "lei_pre_jan_mais", "lei_pre_jan_igual", "lei_pre_op_sim_cabecalho_n", "lei_pre_op_nao_cadeia", "lei_pre_op_sim_tachado"].forEach((k) =>
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "JA10 falta " + k + " em " + l); }));
  api.setLanguage("pt");
  try { api.$("dlgLeiPre").close(); } catch (e) {}
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
