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

  // o link de limpar histórico só existe quando há histórico
  api.entrarRevisao();
  ok(api.$("btnLimparRevisados").style.display === "",
     "T11b com histórico, o link de limpar devia aparecer");
  api.revisados.clear();
  api.atualizarContagemRevisao();
  ok(api.$("btnLimparRevisados").style.display === "none",
     "T11c sem histórico, o link de limpar devia sumir");
  api.sairRevisao();

  // cartão gigante (artigo inteiro importado) não pode ocupar a prévia toda
  {
    const artigo = "Artigo 145: " + "texto muito longo. ".repeat(120);
    api.$("editor").value = "Pergunta curta? :: " + artigo + " :: tag_l";
    api.preview();
    const cartao = api.$("cartoes").children[0];
    const achaBotao = (n) => (n.children || []).some((f) =>
      f.className === "ver-tudo" || achaBotao(f));
    ok(achaBotao(cartao), "T11d bloco longo não ganhou o botão 'mostrar tudo'");
  }

  // destaque: pinta a ESTRUTURA (marcadores), não o conteúdo da lacuna
  {
    api.$("editor").value = "P? :: {{c1::resposta longa da lacuna}} :: tag";
    api.preview();
    const hl = api.$("editorHl").innerHTML;
    const conta = (c) => (hl.match(new RegExp("hl-" + c, "g")) || []).length;
    ok(conta("cz-marca") === 2, "T11e devia pintar os 2 marcadores da lacuna");
    ok(conta("cz-txt") === 1, "T11f o conteúdo da lacuna devia levar sublinhado");
    ok(conta("cloze") === 0, "T11g voltou a pintar a lacuna inteira de fundo");
    ok(conta("delim") === 2, "T11h os separadores :: não foram destacados");
  }

  // uma operação de correção = UM evento no registro. A janela de revisão
  // chamava a correção só para montar a prévia, e isso deixava rastro —
  // parecia que o botão rodava duas vezes (v8.35).
  {
    api.$("editor").value = "@ Tema\nPergunta bem formada e clara? :: Resposta :: tag_a\nlinha solta que vira explicacao";
    api.preview();
    const conta = () => (api.registroTexto().match(/CORRIGIR/g) || []).length;
    const antes = conta();
    api.$("btnNormalizar").onclick();
    ok(conta() === antes, "T11i abrir a janela de revisão não pode registrar correção");
    api.$("btnNormAplicar").onclick();
    ok(conta() === antes + 1, "T11j aplicar devia registrar exatamente um evento");
  }

  // recortar e excluir cartão direto na prévia (v8.36)
  {
    api.$("editor").value = [
      "@ Tributário — Taxas",
      "Qual é o fato gerador das taxas? :: O exercício do poder de polícia :: tributario",
      "+ Base — art. 77 do CTN.",
      "",
      "@ Penal — Documento",
      "O que se equipara a documento público? :: O testamento particular :: penal",
      "+ Base — art. 297 do CP.",
      "",
      "@ Tributário — Impostos",
      "Imposto tem destinação específica? :: Não, é tributo não vinculado :: tributario",
    ].join("\n");
    api.preview();
    const cards = () => api.parseAtual().cards;
    ok(cards().length === 3, `R1 esperava 3 cartões, veio ${cards().length}`);

    const penal = cards().find((c) => /documento público/.test(c.front));
    api.recortarCartao(penal);
    ok(cards().length === 2, `R2 o cartão devia sair do texto, sobraram ${cards().length}`);
    ok(api.recortes.length === 1, "R3 o cartão não foi para a gaveta");
    // o bloco tem de ir INTEIRO: sem título e explicação ele chega mutilado
    ok(/@ Penal/.test(api.recortes[0]), "R4 o título não foi junto");
    ok(/art\. 297/.test(api.recortes[0]), "R5 a explicação não foi junto");
    ok(!/documento público/.test(api.$("editor").value),
       "R6 o cartão continuou no texto depois de recortado");
    ok(/Taxas/.test(api.$("editor").value) && /Impostos/.test(api.$("editor").value),
       "R7 recortar mexeu nos cartões vizinhos");
    ok(!api.$("btnDesfazerColagem").disabled, "R8 recortar devia habilitar o desfazer");

    // outro baralho: a gaveta atravessa
    api.$("editor").value = "@ Penal — Outro\nUma pergunta de penal? :: Uma resposta :: penal";
    api.preview();
    api.colarRecortes();
    ok(cards().length === 2, `R9 devia colar 1 cartão, ficaram ${cards().length}`);
    ok(api.recortes.length === 0, "R10 a gaveta devia esvaziar após colar");
    ok(/art\. 297/.test(api.$("editor").value), "R11 o cartão chegou sem a explicação");

    // frentes repetidas: grupos inteiros, e o recorte mantém a primeira
    {
      const fs2 = require("fs");
      const path2 = require("path");
      api.$("editor").value = fs2.readFileSync(
        path2.join(__dirname, "casos", "16-frentes-repetidas.txt"), "utf8");
      api.preview();
      const antesG = api.gruposDuplicados(api.parseAtual());
      ok(antesG.length === 4, `D1 esperava 4 grupos repetidos, veio ${antesG.length}`);
      ok(antesG.some((g) => g.length === 3), "D2 grupo de 3 não foi reconhecido como grupo");
      const antesN = cards().length, antesGav = api.recortes.length;
      const pd = api.recortarDuplicados(antesG);
      api._uiFechar(true);
      return Promise.resolve(pd).then(() => {
        ok(cards().length === antesN - 6, `D3 devia sobrar ${antesN - 6}, veio ${cards().length}`);
        ok(api.recortes.length === antesGav + 6, "D4 as repetidas não foram para a gaveta");
        ok(api.gruposDuplicados(api.parseAtual()).length === 0,
           "D5 sobrou frente repetida depois do recorte");
        ok(/^@ /.test(api.recortes[antesGav]), "D6 a repetida foi guardada sem o título");
        api.recortes.length = 0;
        return terceiraParte();
      });
    }

    function terceiraParte() {
    // excluir: confirma e some
    const antesEx = cards().length;
    const p = api.excluirCartao(cards()[0]);
    api._uiFechar(true);
    return Promise.resolve(p).then(() => {
      ok(cards().length === antesEx - 1,
         `R12 excluir devia tirar 1 cartão, ficaram ${cards().length}`);
      ok(api.recortes.length === 0, "R13 excluir não pode encher a gaveta");
      return segundaParte();
    });
    }
  }

  function segundaParte() {
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
    ok(log.startsWith(log.match(/^\S+ \S+  \[INICIO\]/m) ? log.split("\n")[0] : ""),
       "T27 a abertura devia ser o primeiro evento do registro");
    ok(/\[RECORTAR\]/.test(log), "T28 o registro não anotou o recorte");
    ok(/\[EXCLUIR\]/.test(log), "T29 o registro não anotou a exclusão");
    return falhas;
  });
  }
}

module.exports = { testes };

if (require.main === module) {
  Promise.resolve(testes()).then((falhas) => {
    falhas.forEach((f) => console.log("  FALHA  " + f));
    console.log(falhas.length
      ? `\ntela: ${falhas.length} FALHA(S)\n`
      : "\ntela: revisão, prompt de correção e recortes e repetidas ok (50 verificações)\n");
    process.exit(falhas.length ? 1 : 0);
  });
}
