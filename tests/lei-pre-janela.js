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
 *
 * (19.108.0) O TOPO ENXUTO
 *   JB1 três números (para decidir · avisos · aceitas) no lugar do parágrafo, do contador e dos atalhos; o "copiar
 *       relatório" continua no topo; "usar o texto original" vai para o rodapé
 *   JB2 a explicação longa a um toque ("ⓘ como funciona"), fechada   JB3 a de cada grupo no "ⓘ", fechada
 *   JB4 grupo de um item só não repete "aceitar/recusar todos"
 *   JB5 o mapa do texto: uma marca por sugestão; tocar leva à ocorrência certa
 *   JB6 a numeração logo abaixo do "como vai ficar", com a sequência em volta de cada ponto
 *   JB7 o anexo com a janela pintada: a fronteira, o "como fica" de separar, manter e descartar, e o relatório
 *   JB8 as limpezas seguras numa linha curta   JB9 os textos
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

  /* ======== (19.108.0) O TOPO ENXUTO, O MAPA, A NUMERAÇÃO E O ANEXO ======== */
  const fs = require("fs");
  const path = require("path");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const dlgHtml = html.slice(html.indexOf('<dialog id="dlgLeiPre"'), html.indexOf("</dialog>", html.indexOf('<dialog id="dlgLeiPre"')));
  /* ---- JB1 os três números ---- */
  abrir(P.join("\n"));
  const num = (id) => api.$(id) && api.$(id).textContent;
  ok(/^1para você decidir$/.test(num("btnLeiPreNumDecidir")) && /avisos? na estrutura$/.test(num("btnLeiPreNumAvisos")) && /^\d+aceitas de \d+$/.test(num("btnLeiPreNumAceitas")),
    "JB1 os três números no topo: " + [num("btnLeiPreNumDecidir"), num("btnLeiPreNumAvisos"), num("btnLeiPreNumAceitas")].join(" | "));
  ok(!/id="leiPreChips"/.test(dlgHtml) && /<div class="lei-pre-sticky">[\s\S]*id="btnLeiRelPre"[\s\S]*id="leiPreMapa"/.test(dlgHtml), "JB1a sem os atalhos por grupo; o 'copiar relatório' continua no topo, com o mapa");
  ok(/<div class="dlg-rodape">[\s\S]*id="btnLeiPreOriginal"/.test(dlgHtml), "JB1b 'usar o texto original' vai para o rodapé, junto das saídas");
  /* ---- JB2 a explicação a um toque ---- */
  ok(api.$("leiPreAjuda").hidden === true && /como funciona/.test(api.$("btnLeiPreAjudaVer").textContent), "JB2 a explicação longa começa fechada");
  api.$("btnLeiPreAjudaVer").onclick();
  ok(api.$("leiPreAjuda").hidden === false && /Texto copiado de PDF/.test(api.$("leiPreAjuda").textContent) && /fechar/.test(api.$("btnLeiPreAjudaVer").textContent), "JB2a um toque abre");
  api.$("btnLeiPreAjudaVer").onclick();
  /* ---- JB3 a explicação do grupo no ⓘ ---- */
  ok(api.$("leiPreAjuda_cabecalho").hidden === true && /Linhas iguais que se repetem/.test(api.$("leiPreAjuda_cabecalho").textContent), "JB3 a explicação do grupo fechada (mas lá)");
  api.$("btnLeiPreInfo_cabecalho").onclick();
  ok(api.$("leiPreAjuda_cabecalho").hidden === false && api.$("btnLeiPreInfo_cabecalho").getAttribute("aria-expanded") === "true", "JB3a o ⓘ abre");
  api.leiPrePintar();
  ok(api.$("leiPreAjuda_cabecalho").hidden === false, "JB3b e continua aberta ao repintar");
  /* ---- JB4 grupo de UM item: sem "aceitar/recusar todos" ---- */
  ok(!api.$("btnLeiPreTodos_cabecalho") || !achar(api.$("leiPreGrupo_cabecalho"), (c) => c.id === "btnLeiPreTodos_cabecalho").length, "JB4 com um item só, o grupo não repete 'aceitar todos'");
  /* ---- JB5 o mapa leva à ocorrência certa ---- */
  const mCab5 = api.leiPreCtxAtual().pre.mudancas.find((m) => m.grupo === "cabecalho");
  const alvoLinha = mCab5.linhas[3];
  const marca = achar(api.$("leiPreMapa"), (c) => c.title === "Cabeçalhos · linha " + alvoLinha)[0];
  ok(!!marca && /apaga/.test(marca.className), "JB5 uma marca vermelha por ocorrência do cabeçalho (a 4ª, linha " + alvoLinha + ")");
  if (marca) marca.onclick();
  ok(alvoN(api.$("leiPreItem_" + mCab5.id))[0] === String(alvoLinha), "JB5a tocar na marca leva à ocorrência certa: " + alvoN(api.$("leiPreItem_" + mCab5.id)));
  /* ---- JB6 a numeração, logo abaixo do 'como vai ficar', com a sequência ---- */
  ok(dlgHtml.indexOf('id="leiPreNumeracao"') > dlgHtml.indexOf('id="leiPreComo"') && dlgHtml.indexOf('id="leiPreNumeracao"') < dlgHtml.indexOf('id="leiPreLista"'), "JB6 a numeração mora logo abaixo do 'como a lei vai ficar'");
  abrir(["Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Três.", "Art. 4º Quatro.", "Art. 5º Cinco.", "Art. 6º Seis.", "Art. 7º Sete.", "Art. 90. Noventa.", "Art. 9º Nove.", "Art. 10. Dez."].join("\n"));
  const seqMal = achar(api.$("leiPreNumeracao"), (c) => /lei-pre-seq-n mal grave/.test(c.className || "")).map((c) => c.textContent);
  const falta = achar(api.$("leiPreNumeracao"), (c) => c.className === "lei-pre-seq-falta").map((c) => c.textContent);
  ok(seqMal.indexOf("90") >= 0 && falta.indexOf("faltam 8") >= 0, "JB6a cada ponto mostra a sequência, com o fora do lugar pintado e o que falta: " + [seqMal, falta]);
  const pecas = achar(api.$("leiPreResumo"), (c) => /(^| )lei-pre-num-t( |$)/.test(c.className || "")).map((c) => c.id + "=" + c.textContent);
  ok(pecas.length === 1 && /^btnLeiPreNumAvisos=1aviso na estrutura$/.test(pecas[0]), "JB6b só a numeração para conferir: só o número dos avisos, contando-a: " + pecas.join(" | "));
  /* ---- JB7 a janela do anexo ---- */
  const A = [];
  for (let k = 1; k <= 9; k++) A.push("Art. " + k + "º Texto do artigo " + k + " da lei de teste, com a redação completa.");
  A.push("ANEXO I", "TABELA DE ALÍQUOTAS POR PRODUTO", "Produto A 10%", "Produto B 12%", "Produto C 15%", "Produto D 18%");
  const preA = abrir(A.join("\n"));
  const mAx = preA.mudancas.find((m) => m.grupo === "anexo");
  const itA = () => api.$("leiPreItem_" + mAx.id);
  ok(!!mAx && pintadas(itA(), "anexo").join(" · ") === "ANEXO I · TABELA DE ALÍQUOTAS POR PRODUTO · Produto A 10%" && /e mais 3 linha\(s\) do anexo/.test(itA().textContent),
    "JB7 a fronteira do anexo pintada de azul, e o resto contado: " + (mAx && pintadas(itA(), "anexo")));
  ok(linhasJan(itA()).some((c) => !cls(c, "alvo") && /Art\. 9º/.test(c.textContent)), "JB7a com o fim do último artigo em cima");
  api.$("leiPreVista_" + mAx.id + "_fica").onclick();
  ok(/▤ daqui em diante: anexo à parte/.test(itA().textContent), "JB7b 'como fica' (separar): a fronteira do anexo à parte");
  achar(itA(), (c) => c.type === "radio" && c.value === "manter")[0].onchange();
  ok(/fica dentro do último artigo/.test(itA().textContent) && !/▤/.test(itA().textContent), "JB7c manter: fica dentro do último artigo");
  achar(itA(), (c) => c.type === "radio" && c.value === "descartar")[0].onchange();
  ok(/✂ 6 linha\(s\) tirada\(s\)/.test(itA().textContent), "JB7d descartar: as 6 linhas saem: " + itA().textContent.slice(0, 160));
  ok(/vira anexo à parte/.test(api.$("leiPreLegenda").textContent), "JB7e a cor do anexo na legenda");
  const relA = api.leiRelatorioFluxo("revisar a colagem");
  ok(/▸ \[#ANEXO I#\]/.test(relA), "JB7f o relatório traz a janela do anexo");
  /* ---- JB8 a linha das limpezas seguras ---- */
  abrir(P.join("\n"));
  const seg = api.$("leiPreSeguras");
  ok(seg && /^✓ Limpezas seguras: \d+ · \d+ aceitas · não mudam o conteúdo/.test(achar(seg, (c) => String(c.tag || c.tagName).toLowerCase() === "summary")[0].textContent), "JB8 as seguras numa linha curta, recolhida");
  /* ---- JB9 os textos ---- */
  ["lei_pre_como_funciona", "lei_pre_como_funciona_fechar", "lei_pre_num_decidir", "lei_pre_num_avisos", "lei_pre_num_avisos_1", "lei_pre_num_aceitas", "lei_pre_mapa_tit", "lei_pre_mapa_dica",
    "lei_pre_mapa_marca", "lei_pre_mapa_marca_n", "lei_pre_mapa_prot", "lei_pre_mapa_anexo", "lei_pre_info_tip", "lei_pre_leg_anexo", "lei_pre_jan_anexo_sep",
    "lei_pre_jan_anexo_dentro", "lei_pre_jan_mais_anexo", "lei_pre_seq_falta"].forEach((k) =>
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "JB9 falta " + k + " em " + l); }));
  api.setLanguage("pt");
  try { api.$("dlgLeiPre").close(); } catch (e) {}
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
