/* =====================================================================
 * TESTES DE TELA
 * Usam o DOM mínimo do fumaca.js para exercitar comportamento de
 * interface — o que os testes de texto (rodar.js) não alcançam.
 * Hoje cobrem o fluxo de revisão de conteúdo: marcar, ocultar os já
 * revisados e limpar o histórico.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const TEXTO = [
  "@ Cartão um",
  "Qual é a primeira pergunta do baralho? :: A primeira resposta :: tag_a, tag_b",
  "",
  "@ Cartão dois",
  "Qual é a segunda pergunta do baralho? :: A segunda resposta :: tag_a",
  "",
  "@ Cartão três",
  "Qual é a terceira pergunta do baralho? :: A terceira resposta :: tag_c",
].join("\n");

function testes() {
  const { falhas: erroCarga, api, janela } = rodar();
  const falhas = [...erroCarga];
  if (!api) return falhas;

  const ok = (cond, msg) => { if (!cond) falhas.push(msg); };
  const naTela = () => api.$("cartoes").children.length;

  api.$("editor").value = TEXTO;
  api.preview();
  ok(naTela() === 3, `T1 esperava 3 cartões na tela, veio ${naTela()}`);

  api.entrarRevisao();
  ok(api.modoRevisao, "T2 não entrou no modo de revisão");
  api.preview();
  ok(naTela() === 3, `T3 na revisão, esperava 3 cartões, veio ${naTela()}`);

  // marca os dois primeiros como JÁ REVISADOS (é o que acontece depois de
  // uma rodada com a IA) e liga o filtro
  const cards = api.parseAtual().cards;
  api.revisados.add(api.chaveRev(cards[0]));
  api.revisados.add(api.chaveRev(cards[1]));

  api.$("chkOcultarRev").checked = false;
  api.preview();
  ok(naTela() === 3, `T4 filtro desligado deve mostrar tudo, veio ${naTela()}`);
  ok(api.ocultos === 0, `T5 filtro desligado não esconde nada, ocultos=${api.ocultos}`);

  api.$("chkOcultarRev").checked = true;
  api.preview();
  ok(naTela() === 1, `T6 filtro ligado devia sobrar 1 cartão, veio ${naTela()}`);
  ok(api.ocultos === 2, `T7 devia contar 2 ocultos, veio ${api.ocultos}`);

  // a marca é por FRENTE: mexer no texto (mudando os números de linha) não
  // pode fazer os cartões já revisados reaparecerem
  api.$("editor").value = "# comentário novo no topo\n\n" + TEXTO;
  api.preview();
  ok(naTela() === 1, `T8 após editar o texto, ainda devia sobrar 1, veio ${naTela()}`);

  // fora do modo de revisão o filtro não vale: nada some do baralho
  api.sairRevisao();
  api.preview();
  ok(naTela() === 3, `T9 fora da revisão deve mostrar tudo, veio ${naTela()}`);
  ok(api.$("chkOcultarRev").checked === false, "T10 sair da revisão deve desmarcar o filtro");

  // sair da revisão NÃO apaga o histórico: é ele que sustenta a próxima rodada
  ok(api.revisados.size === 2, `T11 histórico devia sobreviver, tem ${api.revisados.size}`);

  // --- prompt de correção: a conferência acontece DENTRO da janela ---
  // (antes havia uma confirmação por cima, invisível atrás do diálogo)
  api.$("editor").value = [
    "@ Cartão com markdown",
    "Qual conceito **importante** aparece? :: A **resposta** destacada :: tag_m",
  ].join("\n");
  api.preview();
  api.abrirPromptCorrecao();
  ok(api.$("dlgFixPrompt").open, "T12 a janela do prompt não abriu");
  ok(api.fixModo === "parcial", "T13 devia abrir no modo parcial");
  ok(api.fixBlocos.length === 1, `T14 esperava 1 âncora, veio ${api.fixBlocos.length}`);

  const antesDoColar = api.$("editor").value;
  janela.__area = "@@ " + api.fixBlocos[0].id + "\n@ Cartão corrigido\n"
    + "Qual conceito <b>importante</b> aparece? :: A <b>resposta</b> destacada :: tag_m";
  return Promise.resolve(api.$("btnFixPromptColar").onclick()).then(() => {
    ok(api.$("fixPromptConf").children.length > 0,
       "T15 a conferência não apareceu dentro da janela");
    ok(!!api.fixPendente, "T16 não ficou nada pendente para aplicar");
    ok(api.$("btnFixPromptAplicar").style.display === "",
       "T17 o botão Aplicar continuou escondido");
    ok(api.$("editor").value === antesDoColar,
       "T18 o texto mudou ANTES de o usuário clicar em Aplicar");

    api.$("btnFixPromptAplicar").onclick();
    ok(api.$("editor").value.includes("<b>importante</b>"),
       "T19 a correção não foi aplicada ao clicar em Aplicar");
    ok(!api.$("editor").value.includes("@@"), "T20 sobrou âncora no texto");
    ok(!api.$("dlgFixPrompt").open, "T21 a janela devia fechar após aplicar");
    ok(!api.fixPendente, "T22 sobrou pendência depois de aplicar");

    // --- registro ---
    const log = api.registroTexto();
    ok(/\[INICIO\]/.test(log), "T23 o registro não anotou a abertura do app");
    ok(/\[PROMPT\]/.test(log), "T24 o registro não anotou o prompt de correção");
    ok(/\[COLAR\]/.test(log), "T25 o registro não anotou a colagem");
    ok(/\[APLICAR\]/.test(log), "T26 o registro não anotou a aplicação");
    return falhas;
  });
}

module.exports = { testes };

if (require.main === module) {
  Promise.resolve(testes()).then((falhas) => {
    falhas.forEach((f) => console.log("  FALHA  " + f));
    console.log(falhas.length
      ? `\ntela: ${falhas.length} FALHA(S)\n`
      : "\ntela: revisão, prompt de correção e registro ok (26 verificações)\n");
    process.exit(falhas.length ? 1 : 0);
  });
}
