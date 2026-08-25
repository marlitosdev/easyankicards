/* =====================================================================
 * TESTES DE TELA
 * Usam o DOM mínimo do fumaca.js para exercitar comportamento de
 * interface — o que os testes de texto (rodar.js) não alcançam.
 * Hoje cobrem o fluxo de revisão de conteúdo: marcar, ocultar os já
 * revisados e limpar o histórico.
 * ===================================================================== */
const { rodar, diasAtras, emDias } = require("./fumaca.js");

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

async function testes() {
  const { falhas: erroCarga, api, janela, doc } = rodar();
  const falhas = [...erroCarga];
  if (!api) return falhas;

  const ok = (cond, msg) => { if (!cond) falhas.push(msg); };
  const naTela = () => api.$("cartoes").children.length;

  /* Desde a v8.70 a agenda vive no topo e só desenha editais CADASTRADOS na
   * lista — escrever no campo e chamar edRender() já não é o caminho que o
   * usuário percorre. Este ajudante cadastra, abre e pinta, que é o que
   * acontece de verdade. */
  const abrirEditalTeste = (nome, texto, prova) => {
    (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
    const e = api.edCriar(nome, texto);
    api.hubAbrirEdital(e.id);
    if (prova) api.$("edProva").value = prova;
    api.edRender();
    api.hubRender();
    return e;
  };

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

    // bandeja: seleção, colagem parcial e exclusão individual (v8.38)
    {
      api.$("editor").value = ["@ Física", "Velocidade da luz? :: 300.000 km/s :: fisica",
        "+ Nota — no vácuo.", "", "@ Penal", "Documento público? :: Testamento :: penal",
        "", "@ Civil", "Prazo prescricional? :: Dez anos :: civil"].join("\n");
      api.preview();
      [0, 1, 2].forEach(() => api.recortarCartao(api.parseAtual().cards[0]));
      ok(api.recortes.length === 3, `B1 esperava 3 na bandeja, veio ${api.recortes.length}`);
      api.renderRecortes();
      const chks = api.$("recortesLista").querySelectorAll("input[type=checkbox]");
      ok(chks.length === 3, `B2 a bandeja devia listar 3 cartões, listou ${chks.length}`);
      chks[0].checked = true;
      api.$("btnRecColarSel").onclick();
      ok(api.recortes.length === 2, "B3 colar selecionado devia tirar só 1 da bandeja");
      ok(/300\.000/.test(api.$("editor").value), "B4 colou o cartão errado");
      ok(api.recortes.every((b) => !/300\.000/.test(b)),
         "B5 o cartão colado continuou na bandeja");
      api.recortes.length = 0;
      api.$("editor").value = "";
      api.preview();
    }

    // painel de foco: grifa o trecho errado e permite consertar ali (v8.39)
    {
      api.$("editor").value = [
        "@ NBASP — Opinião",
        "Emite {{c1::opinião modificada}}? :: Quando constatar {{c1::distorções}} , com **destaque** :: nbasp",
      ].join("\n");
      api.preview();
      const lista = api.problemasNavegaveis();
      ok(lista.length >= 1, "F1 nenhum problema navegável foi encontrado");
      api.abrirFoco(2, "teste");
      ok(api.$("focoCartao").style.display !== "none", "F2 o painel de foco não abriu");
      const html = api.$("focoMarcado").innerHTML;
      const marcas = (html.match(/<mark>/g) || []).length;
      ok(marcas >= 3, `F3 esperava 3+ trechos grifados, veio ${marcas}`);
      ok(/<mark>\{\{c1::<\/mark>/.test(html), "F4 a lacuna repetida não foi grifada");
      ok(/<mark>\*\*destaque\*\*<\/mark>/.test(html), "F5 o markdown não foi grifado");
      // editar e aplicar dali mesmo
      api.$("btnFocoEditar").onclick();
      api.$("focoEditor").value = "@ NBASP — Opinião\nEmite {{c1::opinião modificada}}? :: Quando constatar {{c2::distorções}} :: nbasp";
      api.$("btnFocoAplicar").onclick();
      ok(/\{\{c2::/.test(api.$("editor").value), "F6 a edição do foco não chegou ao texto");
      ok(!/\*\*destaque\*\*/.test(api.$("editor").value), "F7 o markdown continuou no texto");
      api.fecharFoco();
    }

    // foco em GRUPO: as repetidas lado a lado, com ações por cartão
    {
      api.$("editor").value = [
        "@ Repetido A", "Qual a regra geral? :: Separar itens distintos :: tag_c",
        "", "@ Repetido B", "Qual a regra geral? :: Separar por natureza :: tag_d",
        "", "@ Repetido C", "Qual a regra geral? :: Separar por função :: tag_e",
      ].join("\n");
      api.preview();
      const lst = api.problemasNavegaveis();
      ok(lst.length === 1 && lst[0].tipo === "grupo",
         `F8 o grupo devia ser UM item, veio ${lst.length}`);
      api.abrirFoco(lst[0].linha, lst[0].msg);
      const reps = api.$("focoGrupo").children;
      ok(reps.length === 3, `F9 esperava 3 repetidas no foco, veio ${reps.length}`);
      const acoes = (i) => reps[i].children.find((x) => x.className === "acoes-rep");
      ok(acoes(0).children.length === 2, "F10 faltam as ações por cartão");
      const pEx = acoes(2).children[1].onclick();
      api._uiFechar(true);
      return Promise.resolve(pEx).then(() => {
        ok(cards().length === 2, `F11 excluir no foco devia deixar 2, veio ${cards().length}`);
        ok(api.$("focoGrupo").children.length === 2, "F12 o foco não se atualizou após excluir");
        acoes(1).children[0].onclick();
        ok(api.recortes.length === 1, "F13 recortar no foco não encheu a bandeja");
        ok(api.$("focoCartao").style.display === "none",
           "F14 resolvido o grupo, o foco devia fechar");
        api.recortes.length = 0;
        return quartaParte();
      });
    }

    function quartaParte() {
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
  return Promise.resolve(api.$("btnFixPromptColar").onclick()).then(async () => {
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

    /* o innerHTML do DOM de mentira sempre volta vazio: percorre os nos */
    const temAzul = (el) =>
      (el.children || []).some(
        (f) => /btn-azul/.test(f.className || "") || temAzul(f));
    /* ── C: todo detector aceso oferece o seu proprio botao de correcao ──────
     * Na v8.37 uma reescrita do bloco de duplicadas apagou, sem ninguem notar,
     * TODOS os itens de correcao da lista de sugestoes. O botao geral
     * "Corrigir" continuou funcionando, entao nenhum teste caiu — e o usuario
     * ficou sem ver O QUE estava errado. Esta verificacao fecha esse buraco. */
    const CASOS_DET = [
      ["mais_junto", "P :: R\n+ um conceito bem comprido aqui / outro conceito bem comprido ali"],
      ["markdown", "P :: R\n+ isto tem **negrito** de markdown que o Anki nao entende"],
      ["espacos", "Pergunta  ::  Resposta com   espaco duplo no meio"],
      ["cloze_rep", "O {{c1::prazo}} do {{c1::prazo}} vence hoje sem falta"],
      ["tags_in_more", "P :: R\n+ direito, constitucional, administrativo"],
      ["bullets", "- Pergunta com marcador :: Resposta dela"],
      ["prompt_leak", "P :: R\nAqui esta o seu material de estudo conforme solicitado:"],
      ["prompt_colado", "+ b) TITULO: a linha fica SOZINHA, ACIMA do cartao.\n+ CARTOES:"],
    ];
    for (const [nome, txt] of CASOS_DET) {
      if (!api.detectoresAtivos(txt).includes(nome)) continue;  // nao acende
      api.$("editor").value = txt;
      api.renderSugestoes(api.parseAtual(), txt);
      ok(temAzul(api.$("sugestoes")),
         `C-${nome} detector aceso mas a lista nao oferece correcao`);
    }

    /* E — a bancada: nome proprio e o botao de ampliar que volta atras.
     * O DOM de mentira nao guarda atributos nem localStorage, entao a
     * verificacao se apoia no que e' observavel: o rotulo do botao, que
     * tem de ALTERNAR, e a existencia do nome nos dois idiomas. */
    /* L — o diagnostico. Ele roda exatamente quando as coisas estao
     * quebradas, e ate' a v8.47 nao tinha UM teste sequer. Um relatorio de
     * defeito que falha junto com o defeito e' pior do que nenhum. */
    ["", "   ", "{{c1::sem fechar", " :: ", "[MC] P? :: :: tag",
     "a".repeat(5000)].forEach((txt, i) => {
      api.$("editor").value = txt;
      let saiu = null;
      try { saiu = api.montarDiagnostico(); } catch (e) { saiu = null; }
      ok(typeof saiu === "string" && saiu.length > 40,
         `L1.${i} o diagnostico nao sobreviveu a uma entrada degenerada`);
    });
    api.$("editor").value = TEXTO;
    const diag = api.montarDiagnostico();
    ["EasyAnkiCards", "Armazenamento:", "--- REGISTRO", "--- TEXTO", "sessão"]
      .forEach((peca) => ok(diag.includes(peca), `L2 falta "${peca}" no diagnostico`));

    /* sem o texto: o bloco tem de sumir, e o resto tem de continuar */
    api.$("chkDiagTexto").checked = false;
    api.montarPainelDiag();
    ok(!api.diagTexto.includes(TEXTO.split("\n")[1]),
       "L3 desmarcar 'incluir o texto' nao tirou o texto");
    ok(api.diagTexto.includes("--- REGISTRO"), "L4 tirou o registro junto");
    api.$("chkDiagTexto").checked = true;
    api.montarPainelDiag();
    ok(api.diagTexto.includes("--- TEXTO"), "L5 remarcar nao trouxe o texto de volta");

    /* eventos raros nao podem ser descartados pela rotina */
    api.reg("ERRO", "erro de mentira para o teste");
    for (let i = 0; i < 260; i++) api.reg("INICIO", "ruido " + i);
    ok(api.registroTexto().includes("erro de mentira"),
       "L6 o descarte comeu um [ERRO] para caber mais rotina");

    /* M — a tela do edital. Espelha a bancada de cartões, então as mesmas
     * garantias valem: a lista de sugestões oferece correção, a linha
     * ignorada é localizável, e marcar progresso não mexe no texto. */
    const ED = ["# TCE-PE | prova: " + emDias(131) + " | horas: 12",
      "@ Auditoria Governamental :: 5",
      "+ 2.1 Achado de auditoria :: 5 :: cai muito",
      "- Papéis de trabalho :: 3",
      "@ Direito Constitucional :: 3",
      "+ Princípios fundamentais :: 4",
      "Anexo I do edital de abertura"].join("\n");
    api.$("editalTexto").value = ED;
    api.edRender();
    ok(api.$("edTabela").children.length === 3,
       `M1 esperava 3 tópicos na tabela, veio ${api.$("edTabela").children.length}`);
    ok(/semanas/.test(api.$("edRestam").textContent || ""),
       "M2 não mostrou o tempo até a prova");
    ok(!api.$("btnEditalCorrigir").disabled,
       "M3 havia numeração e marcador tortos e o botão ficou apagado");
    const temM = (el, cls) => (el.children || []).some(
      (fx) => new RegExp(cls).test(fx.className || "") || temM(fx, cls));
    ok(temM(api.$("editalSug"), "btn-azul"),
       "M4 a lista do edital não oferece nenhuma correção");
    ok(temM(api.$("editalSug"), "btn-cinza"),
       "M5 a linha ignorada ficou sem \"Ver no texto\"");

    /* M7 — o aviso de "não cabe" tem de aparecer na tela, não só existir
     * no cálculo. O modelo antigo espalhava minutos até fechar a conta e a
     * impossibilidade só se revelava depois de semanas seguindo o plano. */
    const MUITOS = ["# X | prova: " + emDias(56) + " | horas: 2", "@ Única :: 3"]
      .concat(Array.from({ length: 120 }, (_, k) => "+ Tópico " + (k + 1) + " :: 5"))
      .join("\n");
    api.$("editalTexto").value = MUITOS;
    api.$("edHoras").value = 2;
    api.$("edProva").value = emDias(56);
    api.edRender();
    /* o veredito "N ficam de fora" virou o painel de RITMO: a informação
     * continua lá, mas ao lado do que se pode fazer a respeito */
    ok(!api.$("edRitmo").hidden, "M7 120 tópicos em 2h/semana e nenhum painel de ritmo");
    const textoRitmo = (el) => {
      let s = "";
      const anda = (e) => (e.children || []).forEach((f) => {
        s += " " + (f.textContent || ""); anda(f);
      });
      anda(el); return s;
    };
    const rt = textoRitmo(api.$("edRitmo"));
    ok(/não cabem|do not fit/.test(rt),
       "M7b o painel não diz quantos tópicos não cabem no prazo");
    /* M7c mudou de sinal na v8.71. Antes cobrava que o painel mostrasse
     * "para cobrir tudo: N h/semana". Esse número e so
     * "minutos pendentes ÷ semanas": o MESMO edital pede 164h/semana com a
     * prova em 13 dias e 5h/semana com a prova em 6 meses. Ele descrevia a
     * distancia ate a prova, nao o estudo — e ocupava a barra maior da
     * tela, repetido tres vezes. Agora o teste cobra o contrario: que ele
     * NAO volte a ser apresentado como meta. */
    ok(!/h por semana|h per week/.test(rt),
       "M7c 'cobrir tudo pediria N h/semana' voltou a ser exibido como meta");
    /* e cobra o que faltava: a projecao, a unica linha que responde
     * "vale a pena manter este ritmo?" */
    ok(/chega a|reach|projetar|project/.test(rt),
       "M7d o painel não diz onde o ritmo atual leva no dia da prova");
    api.$("editalTexto").value = ED;
    api.edRender();

    /* M6 — a rede: correção que perderia tópico é recusada, igual à dos
     * cartões. Aqui perder um tópico é perder meses de estudo dirigido. */
    const antesTop = api.priorizar(api.lerEdital(ED)).length;
    const dep = api.edCorrecaoDeTudo(ED);
    ok(api.priorizar(api.lerEdital(dep(ED))).length === antesTop,
       "M6 a correção automática do edital perdeu tópico");

    /* N — o diagnóstico tem de seguir o MODO. Ele olhava sempre a bancada
     * de cartões: quem relatasse um problema do edital receberia de volta
     * o texto dos cartões, sem nenhum sinal da troca. O usuário perguntou
     * "o edital veio completo?" e a resposta não estava no relatório. */
    api.trocarModo("edital");
    api.$("editalTexto").value = ED;
    api.edRender();
    const dEd = api.montarDiagnostico();
    ok(/Onde: bancada do edital/.test(dEd), "N1 o diagnóstico não seguiu o modo");
    ok(/Modo: edital/.test(dEd), "N2 falta a linha do modo atual");
    ok(/Edital: 2 disciplinas, 3 tópicos/.test(dEd),
       "N3 falta a contagem que responde 'veio completo?'");
    ok(/ignorada L7/.test(dEd), "N4 a linha não entendida não aparece no relatório");
    ok(dEd.includes("Auditoria Governamental :: 5"),
       "N5 o bloco de TEXTO não trouxe o edital");
    ok(!/Agora: \d+ cartões/.test(dEd),
       "N6 o relatório do edital ainda conta cartões");
    /* N8 — o painel tem de DIZER de qual bancada é o relatório. Com dois
     * modos, copiar o do lado errado e mandar para quem vai ajudar é erro
     * fácil e caro: o relatório parece certo e descreve outra coisa. */
    api.montarPainelDiag();
    const rotulo = (api.$("diagAlvo").children || []).map((c) => c.textContent).join(" ");
    ok(/edital/.test(rotulo), `N8 o painel não diz que o relatório é do edital: "${rotulo}"`);

    /* e volta a olhar os cartões quando o modo volta */
    api.trocarModo("cartoes");
    ok(/Onde: bancada de cartões/.test(api.montarDiagnostico()),
       "N7 voltar para cartões não devolveu o foco");
    api.montarPainelDiag();
    const rot2 = (api.$("diagAlvo").children || []).map((c) => c.textContent).join(" ");
    ok(/cart/.test(rot2), `N9 o rótulo não acompanhou a volta aos cartões: "${rot2}"`);

    /* O — o painel. A tabela de 231 linhas responde "qual a ordem?", que se
     * pergunta uma vez; o painel responde "e agora?", que se pergunta todo
     * dia. Aqui verifico que ele existe, agrupa por disciplina e mostra o
     * progresso — que era exatamente o que faltava. */
    const ED2 = ["# TCE-PE | prova: " + emDias(131) + " | horas: 12",
      "@ Auditoria :: 5", "+ Achado :: 5", "+ Papéis :: 3", "+ Amostragem :: 2",
      "@ Constitucional :: 3", "+ Princípios :: 4", "+ Ordem social :: 1"].join("\n");
    abrirEditalTeste("Painel O2", ED2, emDias(131));
    api.$("edHoras").value = 12;
    api.edRender(); api.hubRender();
    const conta = (el, cls) => {
      let n = 0;
      const anda = (e) => (e.children || []).forEach((fx) => {
        if ((fx.className || "").split(/\s+/).includes(cls)) n++;
        anda(fx);
      });
      anda(el); return n;
    };
    ok(conta(api.$("edPainel"), "ed-card") === 2,
       `O1 esperava 2 cartões de disciplina, veio ${conta(api.$("edPainel"), "ed-card")}`);
    /* a barra do topo saiu do painel na v8.71 (era o mesmo numero do bloco
     * de acompanhamento, em outro formato); as das disciplinas ficam */
    ok(conta(api.$("edPainel"), "ed-barra-fill") >= 2,
       "O2 faltam as barras de progresso das disciplinas");
    ok(conta(api.$("edPainel"), "ed-peso") === 2,
       "O3 o peso da disciplina não é editável no cartão");
    /* a agenda subiu para o topo na v8.70 — as linhas nascem lá */
    api.hubRender();
    ok(conta(api.$("edAgendaTopo"), "ed-item") + conta(api.$("edPainel"), "ed-item") > 0,
       "O4 a lista de \"Esta semana\" está vazia");

    /* O5 — as DUAS réguas. Marcar o tópico de maior peso tem de mover muito
     * mais o "% do peso" do que o "% dos tópicos": é a diferença entre as
     * duas que diz se o esforço foi para o lugar certo. */
    api.edProgresso["auditoria›achado"] = "feito";
    api.edRender();
    const res = api.$("edResumo").textContent || "";
    ok(/1 estudado|1 studied/.test(res), `O5 o resumo não contou o estudado: "${res}"`);
    const pctPeso = Number((res.match(/(\d+)% do peso|(\d+)% of weight/) || [])
      .slice(1).find(Boolean));
    ok(pctPeso > 20,
       `O5b o tópico de maior peso mexeu só ${pctPeso}% da régua do peso`);

    /* O5c — estudado e revisado são estados distintos, e revisado é o
     * subconjunto. O usuário marca os dois; o painel conta os dois. */
    api.edProgresso["auditoria›achado"] = "revisado";
    api.edRender();
    const pl = api.montarPlano(api.lerEdital(api.$("editalTexto").value),
      { horas: 12, prova: emDias(131), feitos: api.edProgresso });
    ok(pl.revisados === 1 && pl.feitos === 1,
       `O5c revisado devia contar como estudado também (${pl.feitos}/${pl.revisados})`);
    ok(pl.peso.pctRevisado === pl.peso.pctFeito,
       "O5d com um único tópico e ele revisado, as duas réguas do peso deviam bater");

    /* O6 — mudar o peso no cartão reescreve o TEXTO. Enquanto tela e texto
     * puderem divergir, uma das duas está mentindo e o usuário não sabe qual. */
    const disc = api.lerEdital(api.$("editalTexto").value).disciplinas[1];
    api.edMudarPeso(disc, 5);
    const depois = api.lerEdital(api.$("editalTexto").value).disciplinas[1];
    ok(depois.peso === 5, `O6 o peso não foi para o texto (veio ${depois.peso})`);
    ok(depois.nome === disc.nome, "O6b mudar o peso corrompeu o nome da disciplina");

    /* O7 — o registro do edital dá para achar sozinho */
    const soEd = api.registroTexto("edital");
    ok(/EDITAL/.test(soEd), "O7 o filtro do registro por modo não trouxe nada");
    ok(!/\[CORRIGIR\]/.test(soEd), "O7b o filtro do edital deixou passar evento de cartões");

    /* P — os cartões vêm ordenados pelo PESO TOTAL NA PROVA, não pelo 1-5
     * da disciplina nem pela ordem do edital. Duas disciplinas de peso 3
     * podem representar fatias muito diferentes do que a prova cobra: o que
     * conta é a soma de (peso disc × peso tópico) de todos os tópicos. */
    api.trocarModo("edital");
    const FATIAS = ["# X | prova: " + emDias(131) + " | horas: 12",
      "@ Penal :: 3", "+ P1 :: 5", "+ P2 :: 5", "@ Constitucional :: 3"]
      .concat(Array.from({ length: 6 }, (_, k) => "+ C" + (k + 1) + " :: 4")).join("\n");
    api.$("editalTexto").value = FATIAS;
    api.$("edHoras").value = 12;
    api.$("edProva").value = emDias(131);
    api.edRender();
    const colher = (cls) => {
      const out = [];
      const anda = (e) => (e.children || []).forEach((fx) => {
        if ((fx.className || "").split(/\s+/).includes(cls)) out.push(fx.textContent);
        anda(fx);
      });
      anda(api.$("edPainel")); return out;
    };
    const ordem = colher("ed-card-nome");
    ok(ordem[0] === "Constitucional",
       `P1 o primeiro cartão devia ser o de maior fatia da prova, veio "${ordem[0]}"`);
    /* A FATIA SAIU DA CAPA DO CARD.
     * Fechado, o card responde "e agora?" — nome, uma barra e o próximo
     * tópico. A fatia da prova, a contagem e as bolinhas das faixas
     * continuam existindo, dentro de "números e tópicos". Medir na capa
     * seria medir a tela antiga. */
    ["Constitucional", "Penal"].forEach((nome) => {
      const bt = (() => {
        let r = null;
        const anda = (e) => (e.children || []).forEach((fx) => {
          if ((fx.className || "").split(/\s+/).includes("ed-card-nome")
              && fx.textContent === nome) r = fx;
          anda(fx);
        });
        anda(api.$("edPainel")); return r;
      })();
      if (bt) bt.onclick();
    });
    const fatias = colher("ed-fatia");
    ok(fatias.length === 2, "P2 os cartões não mostram a fatia da prova");
    ok(/71/.test(fatias[0]) && /29/.test(fatias[1]),
       `P3 as fatias não batem com o cálculo: ${fatias.join(" / ")}`);

    /* P4 — o rodapé de exportar é da bancada de cartões e some no edital */
    ok(api.$("rodapeExportar").hidden === true,
       "P4 os botões de exportar .txt/.apkg aparecem no modo edital");
    api.trocarModo("cartoes");
    ok(api.$("rodapeExportar").hidden === false,
       "P5 os botões de exportar sumiram do modo a que pertencem");
    api.trocarModo("edital");

    /* Q — o outro lado da ponte. O app gerava o prompt e não dizia para onde
     * a resposta volta; agora volta com CONFERÊNCIA, porque resumir um edital
     * de 231 linhas é exatamente o que a IA faz quando o pedido é longo. */
    api.trocarModo("edital");
    const PLANO3 = ["# X | prova: " + emDias(131) + " | horas: 12", "@ A :: 5",
      "+ a1 :: 5 :: pq", "+ a2 :: 4 :: pq", "@ B :: 2", "+ b1 :: 3 :: pq"].join("\n");
    api.$("editalTexto").value = PLANO3;
    api.$("edProva").value = emDias(131);
    api.$("edHoras").value = 12;
    api.edRender();

    /* colagem que PERDE tópicos tem de ser acusada antes de aplicar */
    api.$("edColarTexto").value = ["# X | prova: " + emDias(131) + " | horas: 12",
      "@ A :: 5", "+ a1 :: 5 :: pq"].join("\n");
    const conf = api.edConferirColagem();
    ok(conf && conf.topicosAntes === 3 && conf.topicosDepois === 1,
       `Q1 a conferência não contou certo (${conf && conf.topicosAntes}→${conf && conf.topicosDepois})`);
    ok(!api.$("edColarAviso").hidden, "Q2 perdeu 2 tópicos e não avisou");
    /* dos 3 tópicos, só "a1" sobrevive: somem 2 e não entra nenhum novo */
    ok(conf.somem.length === 2 && conf.surgem.length === 0,
       `Q3 a conferência não lista o que sai e o que entra (${conf.somem.length}/${conf.surgem.length})`);

    /* Q4/Q5 — mudar o PESO de uma disciplina passou a exigir confirmação:
     * peso é o que decide a ordem de estudo do plano inteiro, e trocar isso
     * calado é mudar a prioridade de tudo sem a pessoa saber. */
    api.$("edColarTexto").value = PLANO3.replace("@ B :: 2", "@ B :: 4");
    const conf2 = api.edConferirColagem();
    ok(conf2.topicosAntes === conf2.topicosDepois && conf2.orfaos.length === 0,
       "Q4 acusou perda de tópico ou de progresso numa colagem íntegra");
    ok(conf2.pesosMudam.length === 1,
       "Q4b a mudança de peso não foi detectada na conferência");
    const aplicando = api.edAplicarColagem();
    api.uiModalResponder(true);          /* usuário confirma a troca de peso */
    await aplicando;
    ok(api.lerEdital(api.$("editalTexto").value).disciplinas[1].peso === 4,
       "Q5 a colagem confirmada não foi aplicada");

    /* Q6 — o simulador responde enquanto se arrasta */
    api.$("editalTexto").value = ["# X | prova: " + emDias(15) + " | horas: 2", "@ A :: 5"]
      .concat(Array.from({ length: 40 }, (_, k) => "+ t" + k + " :: 5 :: pq")).join("\n");
    api.$("edProva").value = emDias(15);
    api.$("edHorasSlider").value = 2;
    api.edSimular();
    /* o DOM de mentira nao compoe textContent a partir dos filhos */
    const textoDe = (el) => ((el.children || []).map((c) => c.textContent).join(" ")
      || el.textContent || "");
    const pouco = textoDe(api.$("edSimTxt"));
    api.$("edHorasSlider").value = 40;
    api.edSimular();
    const muito = textoDe(api.$("edSimTxt"));
    ok(pouco !== muito, "Q6 mudar as horas no controle não mudou a resposta");
    ok(/fora|left out/.test(pouco), "Q7 com 2h/semana devia sobrar gente de fora");
    ok(/cabem|fit/.test(muito), "Q8 com 40h/semana devia caber tudo");

    /* R — os quatro defeitos que o usuário relatou de uma vez. */
    api.trocarModo("edital");
    const PL = ["# X | prova: " + emDias(131) + " | horas: 6", "@ Pesada :: 5",
      "+ A :: 5 :: pq", "+ B :: 5 :: pq", "@ Leve :: 1", "+ C :: 2 :: pq"].join("\n");
    api.$("editalTexto").value = PL;
    api.$("edProva").value = emDias(131);
    api.edRender();

    /* R1 — arrastar as horas TEM de mudar o valor de verdade. Antes o
     * controle mexia só no campo e o edRender seguinte lia a linha "#" do
     * texto e devolvia o número antigo. */
    api.edMudarHoras(25);
    ok(Number(api.$("edHoras").value) === 25, "R1 o campo não acompanhou");
    ok(api.lerEdital(api.$("editalTexto").value).cfg.horas === 25,
       "R1b as horas não foram para o texto, então voltariam no próximo render");

    /* R2 — marcar e DESMARCAR. A linha era um <label> com a caixa dentro:
     * clicar em qualquer lugar alternava, e desfazer parecia não funcionar. */
    const P2 = () => api.montarPlano(api.lerEdital(api.$("editalTexto").value),
      { horas: 25, prova: emDias(131), feitos: api.edProgresso });
    api.edMarcar(P2().itens[0], "feito");
    ok(P2().feitos === 1, "R2 marcar não contou");
    api.edMarcar(P2().itens[0], null);
    ok(P2().feitos === 0, "R2b desmarcar não desfez");

    /* R3 — o diário registra e permite apagar um clique errado */
    const antesD = api.edDiario.length;
    api.edMarcar(P2().itens[0], "feito");
    ok(api.edDiario.length === antesD + 1, "R3 o diário não registrou a marca");
    api.apagarDoDiario(api.edDiario.length - 1);
    ok(P2().feitos === 0, "R3b apagar o último registro não desfez a marca");

    /* R4 — todo item da semana explica POR QUE está sendo recomendado */
    const pq = api.edPorque(P2().itens[0]);
    ok(pq && pq.length > 15, "R4 o item não traz a justificativa");
    ok(/peso|weight/.test(pq) && /%/.test(pq),
       `R4b a justificativa devia citar peso e fatia da prova: "${pq}"`);

    /* S — os defeitos da rodada anterior, agora com teste. */
    api.trocarModo("edital");
    /* S1 — o rodapé de exportar tinha "display:flex" EMBUTIDO, que vence a
     * regra [hidden]{display:none} do navegador: o elemento ficava escondido
     * no papel e visível na tela. Sobreviveu a duas correções por isso. */
    const CSS2 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const tagRodape = (CSS2.match(/<div[^>]*id="rodapeExportar"[^>]*>/) || [""])[0];
    ok(!/style="[^"]*display/.test(tagRodape),
       "S1 o rodapé voltou a ter display embutido, que anula o hidden");

    /* S2 — o diário não pode contradizer o contador. Quem já tinha progresso
     * marcado antes de o diário existir via 8 estudados e o diário vazio. */
    const PL2 = ["# X | prova: " + emDias(131) + " | horas: 12", "@ A :: 5",
      "+ a1 :: 5 :: pq", "+ a2 :: 4 :: pq"].join("\n");
    api.$("editalTexto").value = PL2;
    api.$("edProva").value = emDias(131);
    api.edProgresso["a›a1"] = "feito";        /* marca do formato antigo */
    api.edDiario.length = 0;
    api.edRender();
    ok(api.edDiario.length >= 1,
       "S2 marca antiga não virou registro: contador e diário se contradizem");

    /* S3 — a semana intercala disciplinas. Ordenar só por peso agrupava
     * sete horas seguidas de Direito Administrativo, que ninguém estuda. */
    const MIX = ["# X | prova: " + emDias(131) + " | horas: 9", "@ Adm :: 5"]
      .concat(Array.from({ length: 6 }, (_, k) => "+ ADM" + k + " :: 5 :: pq"))
      .concat(["@ Fin :: 5"])
      .concat(Array.from({ length: 6 }, (_, k) => "+ FIN" + k + " :: 5 :: pq")).join("\n");
    const pm = api.montarPlano(api.lerEdital(MIX),
      { horas: 9, prova: emDias(131), feitos: {} });
    const semana = api.semanaAtual(pm).map((i) => i.disciplina);
    let seguidas = 1, pior = 1;
    for (let k = 1; k < semana.length; k++) {
      seguidas = semana[k] === semana[k - 1] ? seguidas + 1 : 1;
      pior = Math.max(pior, seguidas);
    }
    ok(pior <= 2, `S3 ${pior} tópicos seguidos da mesma disciplina na semana`);

    /* T — clicar na disciplina, na agenda, abre a disciplina. Era texto
     * morto: o gesto óbvio de quem quer ver o resto da matéria não fazia
     * nada, e o único caminho era procurar o cartão certo entre dezessete. */
    api.trocarModo("edital");
    const DSC = ["# X | prova: " + emDias(131) + " | horas: 12", "@ Financeiro :: 5",
      "+ F1 :: 5 :: pq", "+ F2 :: 4 :: pq", "@ Civil :: 2", "+ C1 :: 3 :: pq"].join("\n");
    /* passa pelo hub: desde a v8.70 a agenda vive no topo e só existe para
     * editais cadastrados na lista — carregar o texto direto no campo já
     * não é o caminho que o usuário percorre */
    /* isolado: a agenda do topo junta TODOS os editais ativos, entao um
     * edital deixado por outro bloco poria linhas de outra disciplina na
     * frente e o clique abriria o panorama errado */
    abrirEditalTeste("Panorama T", DSC, emDias(131));
    const acha = (el, cls, out) => {
      out = out || [];
      (el.children || []).forEach((f) => {
        if ((f.className || "").split(/\s+/).includes(cls)) out.push(f);
        acha(f, cls, out);
      });
      return out;
    };
    /* A agenda saiu do painel e subiu para o topo na v8.70 (eram DUAS
     * agendas com o mesmo nome e números diferentes). O link da disciplina
     * continua tendo de existir e abrir o panorama — só que agora ele mora
     * nas linhas da agenda de cima. */
    api.hubRender();
    const links = acha(api.$("edAgendaTopo"), "ed-item-disc-link")
      .concat(acha(api.$("edPainel"), "ed-item-disc-link"));
    ok(links.length > 0, "T1 o nome da disciplina na agenda não é clicável");
    ok(acha(api.$("edPainel"), "ed-card-lista").length === 0,
       "T2 a disciplina já estava aberta antes do clique");
    links[0].onclick({ stopPropagation() {} });
    /* abre uma JANELA com o panorama, em vez de rolar a página até o cartão:
     * rolar fazia o usuário perder o lugar onde estava e ainda procurar o
     * que tinha aberto */
    ok((api.$("dscTitulo").textContent || "").length > 0,
       "T3 clicar na disciplina não abriu o panorama dela");
    ok((api.$("dscResumo").children || []).length === 4,
       "T3b o panorama não trouxe os quatro números");
    ok((api.$("dscLista").children || []).length > 0,
       "T3c o panorama veio sem a lista de tópicos");

    /* U — o diagnóstico do plano oferece três saídas, não uma. Nem toda
     * cópia é para a IA: às vezes é para guardar ou mandar para alguém, e
     * obrigar a passar pelo prompt faz o usuário editar à mão o que o app
     * já tinha pronto. E ver antes de copiar 250 linhas é o mínimo. */
    api.trocarModo("edital");
    const PLN = ["# X | prova: " + emDias(131) + " | horas: 12", "@ A :: 5",
      "+ a1 :: 5 :: pq", "+ a2 :: 3 :: pq"].join("\n");
    api.$("editalTexto").value = PLN;
    api.$("edProva").value = emDias(131);
    api.edRender();
    ["btnDpVer", "btnDpCopiar", "btnDpPrompt"].forEach((id) =>
      ok(!!api.$(id), `U1 falta o botão ${id} no diagnóstico do plano`));

    /* ver o plano abre a janela de texto com o plano DENTRO, não com o
     * prompt: são coisas diferentes e vinham confundidas */
    api.verPlano();
    ok((api.$("dlgTextoCorpo").value || "").includes("@ A :: 5"),
       "U2 'Ver o plano' não mostrou o plano");
    ok(!/REGRAS|WHAT TO RETURN/.test(api.$("dlgTextoCorpo").value || ""),
       "U3 'Ver o plano' trouxe o prompt junto");

    /* já o prompt tem de trazer o plano E o pedido */
    api.abrirDiagPlano();
    api.gerarPromptDoDiag();
    const pr = api.$("dlgTextoCorpo").value || "";
    ok(pr.includes("@ A :: 5") && /PLANO ATUAL/.test(pr),
       "U4 o prompt não embrulhou o plano");

    /* V — backup: um arquivo, tudo dentro, e ida e volta sem perda. */
    api.matIniciar();
    api.bkIniciar();
    api.trocarModo("edital");
    /* bloco isolado: o resumo do backup passou a somar TODOS os editais da
     * lista, então um edital deixado por um teste anterior entraria na
     * conta e faria este número variar conforme a ordem dos blocos */
    (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
    api.edAbrir(null);
    const BKED = ["# X | prova: " + emDias(131) + " | horas: 12", "@ Financeiro :: 5",
      "+ Receita Pública :: 5 :: pq", "+ Despesa :: 4 :: pq"].join("\n");
    api.$("editalTexto").value = BKED;
    api.$("edProva").value = emDias(131);
    api.edRender();
    api.matGravar(api.matChave("Financeiro", "Receita Pública"), "ingresso definitivo",
      { disciplina: "Financeiro", topico: "Receita Pública" });
    api.$("editor").value = "P1 :: R1 :: t\n\nP2 :: R2 :: t";
    api.autoSalvar();

    const bk = api.montarBackup();
    ok(bk.formato === "backup/1", "V1 backup sem formato versionado");
    ok(bk.resumo.topicos === 2 && bk.resumo.resumos === 1,
       `V2 o resumo do backup não bate: ${JSON.stringify(bk.resumo)}`);
    ok(Object.keys(bk.dados).length === 4,
       "V3 o backup não cobre os quatro grupos (cartões, edital, material, prefs)");

    /* V4 — a conferência tem de acusar o que vai ENCOLHER, antes de mexer */
    const menor = JSON.parse(JSON.stringify(bk));
    menor.dados.edital.eac_edital_texto = "@ Financeiro :: 5\n+ Receita Pública :: 5 :: pq";
    menor.resumo = null;
    const cmp = api.compararBackup(menor);
    ok(cmp.perdeAlgo, "V4 restaurar um backup menor não foi acusado como perda");
    ok(cmp.linhas.some((l) => l.chave === "topicos" && l.perde),
       "V4b a linha de tópicos devia estar marcada como perda");

    /* V5 — ida e volta: restaurar o próprio backup não muda nada */
    const estAntes = JSON.stringify(api.resumoAtual());
    api.restaurarBackup(bk);
    ok(JSON.stringify(api.resumoAtual()) === estAntes,
       "V5 restaurar o próprio backup alterou o estado");

    /* V6 — lixo não passa, e o app diz por quê */
    ok(!!api.validarBackup({ app: "outro" }), "V6 aceitou arquivo de outro app");
    ok(!!api.validarBackup(null), "V6b aceitou nulo");
    let quebrou = false;
    try { api.restaurarBackup({ app: "EasyAnkiCards", dados: {} }); }
    catch (e) { quebrou = true; }
    ok(quebrou, "V6c restaurou um backup vazio em vez de recusar");

    /* W — material de estudo ligado ao edital pela MESMA chave */
    const ch = api.matChave("Financeiro", "Receita Pública");
    ok(api.matTem(ch), "W1 o resumo não foi guardado");
    ok(ch === "financeiro›receita pública",
       `W1b a chave divergiu da do progresso: "${ch}"`);
    abrirEditalTeste("Material W", api.$("editalTexto").value, api.$("edProva").value);
    const achaW = (el, cls, out) => {
      out = out || [];
      (el.children || []).forEach((f) => {
        if ((f.className || "").split(/\s+/).includes(cls)) out.push(f);
        achaW(f, cls, out);
      });
      return out;
    };
    api.hubRender();
    const docs = achaW(api.$("edAgendaTopo"), "ed-doc")
      .concat(achaW(api.$("edPainel"), "ed-doc"));
    /* O INDICADOR VIROU ETIQUETA DE STATUS, EM PALAVRAS.
     * Antes era um ícone sempre presente, aceso ou apagado. Agora a
     * etiqueta só existe quando há material — a AUSÊNCIA é a informação,
     * e ícone apagado em toda linha era parte do ruído. Por isso a
     * segunda verificação mudou de "existe um apagado" para "a linha sem
     * material não tem etiqueta nenhuma". */
    ok(docs.length >= 1, "W2 nenhum tópico mostra que tem resumo");
    ok(docs.every((d) => /tem/.test(d.className || "")),
       "W3 há etiqueta de resumo apagada — etiqueta só existe quando há material");
    const linhasW = achaW(api.$("edAgendaTopo"), "ed-item")
      .concat(achaW(api.$("edPainel"), "ed-item"));
    ok(linhasW.length > docs.length,
       "W3b toda linha ganhou etiqueta de resumo, inclusive quem não tem");
    /* W5 — PARA QUAL CONCURSO. Sem esta marca, o dia em que existirem dois
     * planos os históricos se misturam, e informação que não foi gravada na
     * hora não se recupera depois. */
    api.$("editalTexto").value =
      "# TCE-PE Auditor | prova: " + emDias(131) + " | horas: 12\n@ Financeiro :: 5\n+ Receita :: 5 :: pq";
    api.edRender();
    const pW = api.montarPlano(api.lerEdital(api.$("editalTexto").value),
      { horas: 12, prova: emDias(131), feitos: {} });
    api.edMarcar(pW.itens[0], "feito", { minutos: 60, formas: ["leitura"], humor: "boa" });
    const ult = api.edDiario[api.edDiario.length - 1];
    ok(ult.cc === "TCE-PE Auditor",
       `W5 o registro não gravou o concurso (${JSON.stringify(ult.cc)})`);
    ok(Array.isArray(ult.f) && ult.hu,
       "W5b o registro perdeu a forma de estudo ou a produtividade");
    const chW = api.matChave("Financeiro", "Receita");
    api.matGravar(chW, "texto", { disciplina: "Financeiro", topico: "Receita" });
    ok(api.matObter(chW).concurso === "TCE-PE Auditor",
       "W6 o resumo não gravou de qual concurso nasceu");

    api.matGravar(ch, "   ");
    ok(!api.matTem(ch), "W4 esvaziar o texto devia apagar o resumo");

    /* X — o material: formatação, leitura e registro de leitura. */
    api.matIniciar();
    /* X1 — o que se guarda é TEXTO. Guardar HTML amarraria o material ao
     * navegador de hoje e abriria porta para o que for colado de fora. */
    const html = api.matParaHtml(
      "# Titulo\n\nA receita **publica** e _definitiva_.\n\n- um\n- dois\n\n"
      + "==destaque== e <script>alugar()</script>");
    ok(/<h3>Titulo<\/h3>/.test(html), "X1 título não virou cabeçalho");
    ok(/<b>publica<\/b>/.test(html) && /<i>definitiva<\/i>/.test(html),
       "X1b negrito ou itálico não converteram");
    ok((html.match(/<li>/g) || []).length === 2, "X1c a lista não virou lista");
    ok(/<mark[^>]*>destaque<\/mark>/.test(html), "X1d o destaque não converteu");
    ok(!/<script>/.test(html) && /&lt;script&gt;/.test(html),
       "X2 HTML de fora passou sem ser escapado");

    /* X3 — agrupamento concurso → disciplina → tópico */
    [["TCE-PE", "Financeiro", "Receita"], ["TCE-PE", "Financeiro", "Despesa"],
     ["TCU", "Auditoria", "NBASP"]].forEach(([cc, d, tp]) =>
      api.matGravar(api.matChave(d, tp), "conteudo de " + tp,
        { disciplina: d, topico: tp, concurso: cc }));
    const arv = api.matAgrupado("");
    ok(arv.size === 2, `X3 esperava 2 concursos, veio ${arv.size}`);
    ok(arv.get("TCE-PE").get("Financeiro").length === 2,
       "X3b a disciplina não agrupou os dois tópicos");

    /* X4 — o filtro procura em tudo, inclusive no conteúdo */
    ok(api.matAgrupado("nbasp").size === 1, "X4 o filtro por tópico falhou");
    ok(api.matAgrupado("conteudo de Receita").size === 1,
       "X4b o filtro não olha o conteúdo do resumo");
    ok(api.matAgrupado("xyz").size === 0, "X4c o filtro devolveu o que não existe");

    /* X5 — ler é estudar: registrar a leitura entra no diário */
    api.trocarModo("edital");
    api.$("editalTexto").value =
      "# TCE-PE | prova: " + emDias(131) + " | horas: 12\n@ Financeiro :: 5\n+ Receita :: 5 :: pq";
    api.edRender();
    const nAntes = api.edDiario.length;
    api.matAbrirEditor({ disciplina: "Financeiro", nome: "Receita" }, "ler");
    api.matRegistrarLeitura();
    /* X5 — LER É ESTUDAR, MAS QUEM DIZ QUANTO TEMPO É QUEM LEU.
     * Antes isto gravava direto no diário com um tempo ESTIMADO pelo
     * tamanho do texto, e dava o tópico por concluído: 13 mil caracteres
     * viravam "9 minutos" e fechavam um assunto planejado para uma hora.
     * Agora abre o registro de sempre, preenchido, e espera confirmação. */
    ok(api.edDiario.length === nAntes,
       "X5 registrar a leitura escreveu no diário sem confirmação");
    ok(api.$("dlgRegistro").open === true,
       "X5b registrar a leitura não abriu o registro de estudo");
    ok(api.$("regTitulo").textContent === "Receita",
       "X5c o registro abriu no tópico errado");
    ok(api.regFormasAtual().length === 1 && api.regFormasAtual()[0] === "resumo",
       "X5d a forma não veio marcada como leitura de resumo");
    ok(Number(api.$("regMinutos").value) >= 5,
       "X5e o tempo sugerido devia ter piso de 5 minutos");
    /* e confirmando, aí sim entra no diário */
    api.confirmarRegistroTeste({ preventDefault() {} });
    ok(api.edDiario.length === nAntes + 1,
       "X5f confirmando, o registro devia entrar no diário");
    const regUlt = api.edDiario[api.edDiario.length - 1];
    ok(regUlt.f && regUlt.f.includes("resumo"),
       "X5g o registro não guardou que a forma foi leitura de resumo");

    /* Y — colagem de fora. O NotebookLM devolve markdown com hábitos
     * próprios e referências numeradas que só fazem sentido dentro dele.
     * Converter na COLAGEM, e não na exibição, deixa o material guardado no
     * formato do app em vez de carregar para sempre a sintaxe de origem. */
    const NB = ["### Achado de auditoria", "", "O achado é a constatação [1].", "",
      "* Elemento **crítico**", "* Outro item [2, 3]", "",
      "| Campo | Valor |", "|---|---|", "| Critério | a norma |", "",
      "Texto com *ênfase* e __negrito__ [4]."].join("\n");
    const limpo2 = api.matLimparColagem(NB);
    ok(/^## Achado/m.test(limpo2), "Y1 título de nível 3 não virou o nível do app");
    ok(!/\[1\]|\[2, 3\]|\[4\]/.test(limpo2),
       "Y2 as referências numeradas do NotebookLM sobreviveram");
    ok(/^- Elemento \*\*crítico\*\*/m.test(limpo2),
       "Y3 a lista com asterisco não virou lista do app");
    ok(/_ênfase_/.test(limpo2) && /\*\*negrito\*\*/.test(limpo2),
       "Y4 itálico ou negrito não foram convertidos");
    ok(/Critério — a norma/.test(limpo2) && !/\|---\|/.test(limpo2),
       "Y5 a tabela não virou linha legível");
    /* e o negrito legítimo não pode ser comido pela regra do itálico */
    ok(api.matLimparColagem("um **negrito** aqui").includes("**negrito**"),
       "Y6 a conversão de itálico destruiu o negrito");

    /* Z — cartões arquivados no material, pela origem que veio junto */
    api.matGravar(api.matChave("Financeiro", "Receita"), "resumo",
      { disciplina: "Financeiro", topico: "Receita", concurso: "TCE-PE" });
    api.abrirGerar("texto base", { disciplina: "Financeiro", topico: "Receita" });
    api.$("genTexto").value = "O que é receita? :: Ingresso :: fin\nE despesa? :: Saída :: fin";
    api.guardarCartoesNoMaterial();
    const chZ = api.matChave("Financeiro", "Receita");
    ok(api.matContarCartoes(chZ) === 2,
       `Z1 esperava 2 cartões guardados, veio ${api.matContarCartoes(chZ)}`);
    ok(api.matObter(chZ).texto === "resumo",
       "Z2 guardar os cartões apagou o resumo do tópico");
    ok(api.matObter(chZ).concurso === "TCE-PE",
       "Z3 os cartões perderam o concurso de origem");
    /* e o app recusa quando o que está na caixa é o prompt, não a resposta */
    api.$("genTexto").value = "Gere flashcards a partir do texto abaixo";
    const antesZ = api.matContarCartoes(chZ);
    api.guardarCartoesNoMaterial();
    ok(api.matContarCartoes(chZ) === antesZ,
       "Z4 guardou o prompt como se fossem cartões");

    /* AA — o indicador da agenda. Ele nascia apagado mesmo havendo material:
     * matCarregar() só rodava dentro de matIniciar(), que executa DEPOIS do
     * edIniciar() — a agenda era desenhada com a lista de resumos vazia. */
    api.trocarModo("edital");
    api.$("editalTexto").value = ["# TCE-PE | prova: " + emDias(131) + " | horas: 12",
      /* nomes próprios deste bloco: os blocos anteriores já criaram material
       * para Receita e Despesa, e reaproveitá-los mediria o teste, não o app */
      "@ Orcamentario :: 5", "+ Ciclo AA :: 5 :: pq", "+ Vedacao AA :: 4 :: pq"].join("\n");
    api.matGravar(api.matChave("Orcamentario", "Ciclo AA"), "conteudo",
      { disciplina: "Orcamentario", topico: "Ciclo AA" });
    abrirEditalTeste("Indicador AA", api.$("editalTexto").value, emDias(131));
    const achaAA = (el, cls, out) => {
      out = out || [];
      (el.children || []).forEach((f) => {
        if ((f.className || "").split(/\s+/).includes(cls)) out.push(f);
        achaAA(f, cls, out);
      });
      return out;
    };
    /* os indicadores viajam com a agenda, e a agenda subiu para o topo na
     * v8.70. Procurar só no painel é procurar onde ela não está mais. */
    api.hubRender();
    const achaAg = (cls) => achaAA(api.$("edAgendaTopo"), cls)
      .concat(achaAA(api.$("edPainel"), cls));
    const docsAA = achaAg("ed-doc");
    ok(docsAA.length >= 1, "AA1 o indicador de material não apareceu na agenda");
    ok(docsAA.every((d) => /\btem\b/.test(d.className || "")),
       "AA1b apareceu etiqueta de material para quem não tem material");

    /* AA2 — e distingue "tem resumo" de "tem cartões guardados" */
    api.matGravarCartoes(api.matChave("Orcamentario", "Vedacao AA"),
      "O que é vedação? :: Limite :: fin\nE empenho? :: Fase :: fin",
      { disciplina: "Orcamentario", topico: "Vedacao AA" });
    api.edRender(); api.hubRender();
    api.hubRender();
    const comCards = achaAg("ed-crt");
    ok(comCards.length === 1,
       `AA2 esperava 1 indicador de cartões, veio ${comCards.length}`);
    ok(achaAg("ed-doc-n").length === 1,
       "AA3 falta o número de cartões no indicador");

    /* K — a barra de modos. O que precisa ser verdade desde o esqueleto:
     * trocar de modo esconde uma secao e mostra a outra, e — o que mais
     * importa — NAO encosta no texto do editor. Um modo novo que apague o
     * trabalho do outro seria a repeticao do acidente dos 137 cartoes. */
    api.montarBarraModos();
    const GUARDADO = "Uma pergunta qualquer :: Uma resposta :: tag_z";
    api.$("editor").value = GUARDADO;
    ok(api.MODOS.length >= 4, "K1 esperava pelo menos quatro modos no registro");
    ok(api.MODOS.some((m) => m.id === "ferramentas"),
       "K1b faltou o modo de ferramentas");
    /* a importacao de arquivo mudou de casa: tem de estar DENTRO do modo
     * ferramentas, senao volta a poluir a bancada */
    ok(!!api.$("btnImportar"), "K1c o botao de importar sumiu");
    ok(api.MODOS[0].id === "cartoes", "K2 o modo de cartoes devia ser o primeiro");
    api.trocarModo("edital");
    ok(api.modoAtual === "edital", "K3 nao trocou para o modo edital");
    /* sem a guarda abaixo, um modo apontando para secao inexistente estoura
     * aqui com "cannot read hidden of null" — que nao diz a ninguem qual
     * modo esta errado. Reportar vale mais que quebrar. */
    const semSecao = api.MODOS.filter((m) => !api.$(m.secao)).map((m) => m.secao);
    ok(semSecao.length === 0, "K3b modo apontando para secao inexistente: " + semSecao.join(", "));
    const vis = api.MODOS.filter((m) => api.$(m.secao) && !api.$(m.secao).hidden).map((m) => m.id);
    ok(vis.length === 1 && vis[0] === "edital",
       `K4 devia estar visivel so o edital, esta: ${vis.join(",") || "nenhum"}`);
    api.trocarModo("cartoes");
    ok(api.$("editor").value === GUARDADO,
       "K5 trocar de modo mexeu no texto do editor");
    api.trocarModo("inexistente");
    ok(api.modoAtual === "cartoes", "K6 modo desconhecido devia cair em cartoes");

    /* J — o cartao preso a prova de origem. Formato impecavel, conteudo
     * nulo: pergunta ONDE estava a resposta. O detector existe porque a
     * regra nos prompts e' um PEDIDO — e a IA obedeceu ao pedido errado,
     * preservando com fidelidade o andaime da prova. */
    const PRESO = [
      "Qual a ordem correta das definicoes da Questao 17? A ordem e a Letra A. :: pol",
      /* segundo caso real: nao cita numero de questao nem "Letra X", e o
       * "Gabarito" esta no TITULO — escapou da primeira versao do detector */
      "@ Metodos Preditivos — Gabarito da Questao\nQual alternativa indica a caracteristica dos metodos preditivos? A alternativa correta e a D) planejamento completo. :: gp",
      "O que se decide na formulacao da agenda? :: Quais problemas entram na pauta :: pol",
      /* dois falsos positivos que NAO podem ser marcados */
      "O que e a Letra Financeira do Tesouro? :: Titulo publico pos-fixado a Selic :: fin",
      "Qual costuma ser a alternativa mais barata de financiamento? :: O capital proprio retido :: fin",
    ].join("\n\n");
    api.$("editor").value = PRESO;
    const rP = api.parseAtual();
    const presos = api.cartoesDependentes(rP);
    ok(presos.length === 2, `J1 esperava 2 cartoes presos, veio ${presos.length}`);
    ok(/Questao 17/.test(presos[0].front || ""), "J2 apontou o cartao errado");
    api.renderSugestoes(rP, PRESO);
    const temJ = (el, cls) => (el.children || []).some(
      (f) => new RegExp(cls).test(f.className || "") || temJ(f, cls));
    const item = (api.$("sugestoes").children || []).find(
      (s) => temJ(s, "quem-ia") && temJ(s, "btn-cinza"));
    ok(!!item, "J3 o aviso do cartao preso ficou sem \"Ver no texto\"");

    /* a regra tem de estar em TODOS os prompts, e ANTES do material */
    ["prompt_full", "prompt_mini", "rev_prompt_full", "rev_prompt_short",
     "fix_prompt", "fix_prompt_partial"].forEach((k) => {
      const v = api.t(k) || "";
      ok(/REGRA DE OURO|GOLDEN RULE/.test(v), `J4 ${k} sem a regra de ouro`);
    });

    /* H — um clique tem de bastar. O usuario apertava "Corrigir erros"
     * quatro vezes seguidas porque a cadeia devolvia UMA correcao por vez
     * (da para ver no registro: corrigirTagsQueSaoTexto, depois
     * corrigirEspacos, depois...). */
    const SUJO = [
      "- Uma pergunta com marcador :: A resposta :: tag_a",
      "+ tem **negrito** de markdown aqui",
      "Outra  pergunta  ::  Resposta com   espaco duplo :: tag_b",
    ].join("\n");
    api.$("editor").value = SUJO;
    api.renderSugestoes(api.parseAtual(), SUJO);
    const corrige = api.correcaoPendente;
    ok(typeof corrige === "function", "H1 nao detectou correcao nenhuma");
    const limpo = corrige(SUJO);
    const LIMPEZA = ["prompt_colado", "prompt_leak", "mais_rep"];
    const sobra = api.detectoresAtivos(limpo).filter((x) => !LIMPEZA.includes(x));
    ok(sobra.length === 0, `H2 sobrou apos um clique: ${sobra.join(", ")}`);
    ok((corrige.name || "").includes("+"),
       "H3 o registro nao vai dizer QUAIS correcoes rodaram");

    /* I — o historico: a rede que faltava quando 137 cartoes viraram 1 */
    const GRANDE = ("Pergunta numero X :: Resposta X :: tag\n".repeat(80));
    api.$("editor").value = GRANDE;
    api.autoSalvar();
    const antes = api.historico.length;
    api.$("editor").value = "so isto sobrou";
    api.autoSalvar();
    ok(api.historico.length > antes,
       "I1 encolher o texto nao guardou a versao anterior");
    ok(api.historico[api.historico.length - 1].txt === GRANDE,
       "I2 a versao guardada nao e' a de antes do encolhimento");
    api.restaurarVersao(api.historico.length - 1, false);   /* sem perguntar */
    ok(api.$("editor").value === GRANDE, "I3 restaurar nao devolveu o texto");

    /* I3b — por padrao TEM de perguntar antes de substituir. O que da'
     * para verificar sem simular clique: a troca NAO pode acontecer de
     * imediato, porque o app fica esperando a resposta do usuario. */
    const INTOCADO = "algo que nao quero perder sem ser avisado";
    api.$("editor").value = INTOCADO;
    api.restaurarVersao(api.historico.length - 1);      /* sem o "false" */
    ok(api.$("editor").value === INTOCADO,
       "I3b restaurou por cima do editor sem esperar confirmacao");

    /* I4/I5 — a barra so' acusa o que o app NAO mandou fazer. Sem isso ela
     * gritava "acidente" logo depois de o usuario clicar em Corrigir, e o
     * aviso vira ruido que se aprende a ignorar. */
    api.$("editor").value = GRANDE; api.autoSalvar();
    api.$("barraRecuperar").hidden = true;
    api.$("editor").value = "colado por cima de tudo"; api.autoSalvar();
    ok(!api.$("barraRecuperar").hidden, "I4 acidente nao levantou a barra");

    api.$("editor").value = GRANDE; api.autoSalvar();
    api.$("barraRecuperar").hidden = true;
    api.guardarVersao("antes de corrigir");
    api.$("editor").value = "resultado curto"; api.autoSalvar();
    ok(api.$("barraRecuperar").hidden,
       "I5 a barra acusou acidente numa reducao que o proprio app fez");

    /* G — todo item "precisa da IA" tem de dizer ONDE, e o caminho de
     * saida tem de ficar visivel. Sem isto o usuario ve um aviso que nao
     * consegue localizar e um botao apagado, e conclui que travou. */
    const LONGO = "@ Tema\n" + ("Uma pergunta bem comprida ".repeat(6))
      + "? :: " + ("uma resposta igualmente comprida ".repeat(6)) + ":: tag_a"
      /* segunda linha: cai em "a verificar", que e' outro item de IA e o
       * que faltava para o teste cobrir os avisos AGREGADOS, sem linha
       * propria — os que ficavam sem "Ver no texto" */
      + "\n\nA capital e {{c1::Paris::uma alternativa bem comprida com mais de quarenta letras / Paris}}. :: obs :: tag_b";
    api.$("editor").value = LONGO;
    api.renderSugestoes(api.parseAtual(), LONGO);
    const sugs = (api.$("sugestoes").children || []);
    let iaSemLinha = 0, iaTotal = 0;
    const tem = (el, cls) => (el.children || []).some(
      (f) => new RegExp(cls).test(f.className || "") || tem(f, cls));
    sugs.forEach((s) => {
      if (!tem(s, "quem-ia")) return;
      iaTotal++;
      if (!tem(s, "btn-cinza")) iaSemLinha++;
    });
    ok(iaTotal > 0, "G1 o caso longo devia gerar item de IA");
    ok(iaSemLinha === 0, `G2 ${iaSemLinha} item(ns) de IA sem "Ver no texto"`);
    ok(tem(sugs[0] || { children: [] }, "sug-info") || iaTotal === 0,
       "G3 o cracha da IA esta sem o icone de ajuda");
    ok(api.$("btnPromptCorrigir").classList.contains("pulsa"),
       "G4 o botao do prompt devia pulsar quando ha trabalho para a IA");

    const LIMPO = "Qual e a pergunta? :: A resposta :: tag_a";
    api.$("editor").value = LIMPO;
    api.renderSugestoes(api.parseAtual(), LIMPO);
    ok(!api.$("btnPromptCorrigir").classList.contains("pulsa"),
       "G5 o botao continua pulsando sem nada para a IA");

    /* F — a calha. A camada colorida e o campo tem de ter a MESMA largura
     * util; quando divergem, as marcas escorregam pelo texto (foi o bug
     * das "cores em lugar errado"). O CSS nao pode voltar a cancelar a
     * reserva da barra de rolagem sem alguem perceber. */
    const CSS = require("fs").readFileSync(
      require("path").join(__dirname, "..", "docs", "index.html"), "utf8");

    /* AB — IDENTIDADE NO HTML.
     * Na 8.68 encontrei tres secoes duplicadas: secFerramentas, secEdital e
     * secResumos apareciam duas vezes cada. getElementById devolve a
     * PRIMEIRA, entao o JS escrevia numa copia enquanto o navegador
     * desenhava as duas — foi isto que apareceu como "corte no texto abaixo
     * do painel". HTML com id repetido nao acusa erro em lugar nenhum. */
    {
      const todos = (CSS.match(/\sid="([A-Za-z0-9_-]+)"/g) || [])
        .map((s) => s.replace(/[\s\S]*id="/, "").replace(/"/, ""));
      const vistos = {}, repetidos = [];
      todos.forEach((i) => {
        if (vistos[i] && repetidos.indexOf(i) < 0) repetidos.push(i);
        vistos[i] = 1;
      });
      ok(repetidos.length === 0, "AB1 id repetido no index.html: " + repetidos.join(", "));
      ok((CSS.match(/<section/g) || []).length === (CSS.match(/<\/section>/g) || []).length,
         "AB2 tem <section> sem fechar");

      const modosSrc = require("fs").readFileSync(
        require("path").join(__dirname, "..", "docs", "modos.js"), "utf8");
      const decl = (modosSrc.match(/secao:\s*"(\w+)"/g) || [])
        .map((s) => s.replace(/[\s\S]*"(\w+)"/, "$1"));
      const erradas = decl.filter((s) =>
        (CSS.match(new RegExp('id="' + s + '"', "g")) || []).length !== 1);
      ok(decl.length > 0 && erradas.length === 0,
         "AB3 modo sem secao unica no HTML: " + erradas.join(", "));
    }

    /* AC — HUB E BANCADA: um de cada vez, e a agenda sempre.
     * O modo edital passou a ter duas telas. O erro que isso permite é
     * mostrar as duas juntas (ou nenhuma), e foi exatamente o que aconteceu
     * com os botões de exportar, que sobreviveram a duas correções. */
    {
      api.hubIniciar();
      /* bloco independente: um teste anterior pode ter deixado um edital
       * aberto, e a lista do hub só é pintada quando NÃO há nenhum. Foi
       * assim que o AA1b passou a falhar por estado de outro bloco. */
      api.edAbrir(null);
      (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
      api.hubRender();
      /* conta quantos blocos se chamam "agenda da semana" na tela inteira do
       * modo edital — topo + painel + lista */
      /* O DOM de mentira nao monta arvore a partir do id, entao a contagem
       * percorre os DOIS lugares onde uma agenda pode nascer: o bloco do
       * topo e o painel do edital. Se as duas pintarem, o usuario ve duas
       * "Agenda da semana" com numeros diferentes — foi o defeito da 8.68. */
      const t0Agenda = () => {
        const nomes = [api.t("hub_agenda_tit").toLowerCase().trim(),
                       api.t("ed_esta_semana").toLowerCase().trim()];
        let n = 0;
        const anda = (el) => {
          if (!el) return;
          if (nomes.includes((el._texto || "").toLowerCase().trim())) n++;
          (el.children || []).forEach(anda);
        };
        [api.$("edAgendaTopo"), api.$("edPainel")].forEach(anda);
        return n;
      };
      const hub = () => !api.$("edHub").hidden;
      const banc = () => !api.$("edBancada").hidden;
      ok(hub() && !banc(), "AC1 sem edital aberto devia aparecer o hub, nao a bancada");

      const e1 = api.edCriar("Prova A",
        "# Prova A | prova: " + emDias(20) + " | horas: 12\n@ Financeiro :: 5\n+ Receita AC :: 5 :: cai sempre");
      const e2 = api.edCriar("Prova B",
        "# Prova B | prova: " + emDias(60) + " | horas: 8\n@ Auditoria :: 4\n+ NBASP AC :: 5 :: cai sempre");
      api.hubRender();
      ok(api.$("hubLista").children.length > 0, "AC2 a lista de editais veio vazia com dois cadastrados");

      api.hubAbrirEdital(e1.id);
      ok(!hub() && banc(), "AC3 abrir um edital devia trocar o hub pela bancada");
      ok(api.$("edNomeAberto").textContent === "Prova A",
         "AC4 a bancada nao diz qual edital esta aberto");
      ok(/Prova A/.test(api.$("editalTexto").value),
         "AC5 o texto do edital aberto nao chegou na bancada");

      /* editar na bancada e trocar de edital NAO pode vazar de um para o
       * outro — foi a troca de contexto sem salvar que custou 137 cartoes */
      api.$("editalTexto").value += "\n+ Extra AC :: 4 :: teste";
      api.edRender();
      api.hubAbrirEdital(e2.id);
      ok(!/Extra AC/.test(api.$("editalTexto").value),
         "AC6 o texto do edital A vazou para o edital B");
      api.hubAbrirEdital(e1.id);
      ok(/Extra AC/.test(api.$("editalTexto").value),
         "AC7 a edicao feita no edital A se perdeu ao ir e voltar");

      /* AC7b — o progresso e POR EDITAL. Marcar um topico no A nao pode
       * aparecer marcado no B: as estatisticas de peso cumprido passariam a
       * mentir nos dois, e a pessoa so descobre na prova. */
      api.hubAbrirEdital(e1.id);
      api.edMarcar(0, "feito");
      const marcadosA = Object.keys(api.edProgressoAtual()).length;
      api.hubAbrirEdital(e2.id);
      const marcadosB = Object.keys(api.edProgressoAtual()).length;
      ok(marcadosA > 0, "AC7b marcar um topico nao registrou nada");
      ok(marcadosB === 0,
         `AC7b2 o progresso do edital A vazou para o B (B tem ${marcadosB} marcados)`);
      api.hubAbrirEdital(e1.id);
      ok(Object.keys(api.edProgressoAtual()).length === marcadosA,
         "AC7b3 o progresso do edital A se perdeu ao ir e voltar");

      /* AC8b — a bancada recolhe. Depois de colado, o edital é uma caixa de
       * texto que não muda mais e empurra para baixo o painel que se usa
       * todo dia. Recolher não pode esconder o essencial: o resumo fica. */
      api.hubAbrirEdital(e1.id);
      ok(api.$("edBancCorpo").hidden,
         "AC8b edital que já tem conteúdo devia abrir com a bancada recolhida");
      ok(!api.$("edBancResumo").hidden && (api.$("edBancResumo").textContent || "").length > 0,
         "AC8c recolhida e sem resumo: a informação sumiu de vez");
      api.bancAlternar();
      ok(!api.$("edBancCorpo").hidden && api.$("edBancResumo").hidden,
         "AC8d expandir não trouxe o corpo da bancada de volta");
      api.bancAlternar();

      api.hubVoltar();
      ok(hub() && !banc(), "AC8 voltar devia mostrar o hub de novo");

      /* a agenda vive fora das duas telas: e a pergunta das 7h da manha, e
       * some justamente na hora errada se depender da bancada estar aberta */
      ok(api.$("edAgendaTopo").children.length > 0,
         "AC9 a agenda de topo sumiu com editais ativos cadastrados");
      /* esvazia ANTES de abrir: sem isto o teste passa lendo o desenho
       * antigo que ficou na tela, e nao verifica repintura nenhuma */
      api.$("edAgendaTopo").innerHTML = "";
      api.hubAbrirEdital(e1.id);
      ok(api.$("edAgendaTopo").children.length > 0,
         "AC10 a agenda nao foi repintada ao abrir um edital");
      api.hubVoltar();

      /* AC10b — UMA agenda, nao duas.
       * Na 8.68 eu criei a agenda do topo e esqueci de remover a que ficava
       * dentro do painel do edital. O resultado eram duas listas com o
       * mesmo titulo e numeros diferentes — a de cima somava os topicos de
       * todos os concursos, a de baixo so os do edital aberto. Quem olha
       * nao tem como saber qual esta certa, e passa a nao confiar em
       * nenhuma. Nenhum teste pegou: os dois blocos eram validos sozinhos. */
      api.hubAbrirEdital(e1.id);
      const tituloAgenda = t0Agenda();
      ok(tituloAgenda === 1,
         `AC10b a "agenda da semana" aparece ${tituloAgenda} vezes na tela do edital`);

      /* AC11 — a agenda do topo tem de sair AGENDADA. Ao subir de dentro do
       * painel para o topo, a chamada de agendar() ficou para tras e cada
       * linha vinha sem dia nem hora — uma agenda sem horario e uma lista. */
      api.hubRender();
      const cxAg = api.$("edAgendaTopo");
      const txtAg = (cxAg.textContent || "");
      /* AC11 — NENHUM HORARIO NA AGENDA.
       * O app sugeria "seg 05:40" porque uma divisao deu nisso. Ninguem
       * estuda naquele horario por causa da conta, e o numero dava ao plano
       * uma precisao que ele nao tem. Fica o dia e o quanto. */
      ok(!/\d\d:\d\d/.test(txtAg),
         "AC11 a agenda ainda mostra horario de inicio, que foi removido");
      ok(/seg|ter|qua|qui|sex|s[áa]b|dom/i.test(txtAg),
         "AC11b a agenda deixou de mostrar o dia da semana");

      /* AC12 — HORAS POR SEMANA, SO PARA VER.
       * Quem manda nas horas e o planejamento de cada edital. A agenda
       * mostra o total para dar contexto, mas nao edita: dois lugares
       * editando o mesmo numero e como nascem os numeros que discordam. */
      api.hubPintarAgenda();
      const cfgAg = api.$("edAgendaTopo").querySelector(".ed-agenda-horas");
      ok(!!cfgAg, "AC12 a agenda nao mostra as horas por semana");
      ok(/h\/semana/.test(cfgAg.textContent || ""),
         "AC12b o rotulo das horas por semana esta errado: " + cfgAg.textContent);
      ok(cfgAg.querySelectorAll("input").length === 0,
         "AC13 as horas por semana viraram campo editavel na agenda");
      ok(/\d/.test(cfgAg.textContent || ""),
         "AC14 as horas por semana aparecem sem numero");

      /* AC15 — H-A: NENHUM NÚMERO APARECE EM DOIS BLOCOS.
       * Este é o teste que faltava. Duas "Agenda da semana" conviveram por
       * duas versões sem ninguém notar, e o painel repetia "cobrir tudo"
       * três vezes. Cada bloco válido sozinho; o defeito só existe na soma.
       * Aqui a checagem é sobre percentuais e contagens visíveis: se o
       * mesmo par (rótulo, número) nasce em dois blocos, alguém vai ver os
       * dois divergirem um dia. */
      api.hubAbrirEdital(e1.id);
      api.edRender(); api.hubRender();
      const textoDe = (el) => {
        let s = "";
        const anda = (e) => (e.children || []).forEach((f) => {
          s += " " + (f._texto || ""); anda(f);
        });
        anda(el); return s;
      };
      const blocos = {
        acompanhamento: textoDe(api.$("edRitmo")),
        painel: textoDe(api.$("edPainel")),
        agenda: textoDe(api.$("edAgendaTopo")),
      };
      /* "esta semana: N tópicos" nascia no topo do painel E no cabeçalho da
       * agenda, com escopos diferentes (um edital contra todos) */
      const semanaEm = Object.keys(blocos)
        .filter((k) => /esta semana|this week/i.test(blocos[k]));
      ok(semanaEm.length <= 1,
         "AC15 \"esta semana\" aparece em mais de um bloco: " + semanaEm.join(", "));
      /* AC15b — a cobertura DA PROVA nasce uma vez só.
       * Por texto isto dava falso positivo: cada cartão de disciplina também
       * diz "% do peso", e isso é outro dado (a fatia daquela matéria), não
       * repetição. A contagem por classe distingue os dois: ".ed-medidas" é
       * o par de medidores de nível-prova, que existia no topo do painel E
       * no bloco de acompanhamento. */
      const contaCls = (el, cls) => {
        let n = 0;
        const anda = (e) => (e.children || []).forEach((f) => {
          if ((f.className || "").split(/\s+/).includes(cls)) n++;
          anda(f);
        });
        anda(el); return n;
      };
      const medidores = contaCls(api.$("edRitmo"), "ed-medidas")
        + contaCls(api.$("edPainel"), "ed-medidas")
        + contaCls(api.$("edRitmo"), "ac-barra") + contaCls(api.$("edPainel"), "ac-barra");
      ok(medidores <= 1,
         `AC15b a cobertura da prova aparece ${medidores} vezes na tela do edital`);

      /* AC16 — H5: "Buscar tópico" (era "Lista completa").
       * Tudo que a tabela mostrava já existia na agenda e no panorama. O
       * que só ela faz é achar um tópico pelo nome e marcar vários de uma
       * vez — quem chega com meio edital já estudado não vai clicar cem
       * vezes na agenda. */
      api.hubAbrirEdital(e1.id);
      api.trocarVistaTeste("lista");
      /* conta só linhas de TÓPICO: quando o filtro não acha nada, a tabela
       * desenha uma linha de aviso, e contá-la como resultado quebrava a
       * conta de partição (1 + 2 ≠ 2 no caso normal) */
      const linhas = () => (api.$("edTabela").children || []).filter((tr) =>
        !(tr.children || []).some((td) =>
          (td.className || "").split(/\s+/).includes("esq-vazio"))).length;
      const linhasComAviso = () => (api.$("edTabela").children || []).length;
      api.buscarTeste("");
      const todas = linhas();
      ok(todas >= 1, "AC16 a tabela de busca veio vazia com edital carregado");

      api.buscarTeste("Receita");
      ok(linhas() < todas && linhas() >= 1,
         `AC16b a busca não filtrou (${linhas()} de ${todas})`);
      api.buscarTeste("zzzznaoexiste");
      ok(linhas() === 0 && linhasComAviso() === 1,
         "AC16c busca sem resultado devia mostrar uma linha de aviso e nenhum tópico");
      api.buscarTeste("");

      /* AC16d — a invariante real: estudados + pendentes = tudo.
       * Duas armadilhas que este teste me pregou antes de morder:
       *  1. comparar só "um é diferente do outro" passa com o filtro
       *     desligado, porque basta as contagens diferirem por acaso;
       *  2. com NADA marcado, "só estudados" e "só pendentes" dão 0 e N
       *     tanto com o filtro ligado quanto desligado. Precisa haver ao
       *     menos um tópico de cada lado. */
      api.selecionarTeste(1);
      const marcando = api.edLoteAplicar(true);
      api.uiModalResponder(true);
      await marcando;
      api.filtroTeste("feitos");
      const soFeitos = linhas();
      api.filtroTeste("pendentes");
      const soPend = linhas();
      api.filtroTeste("tudo");
      const tudo = linhas();
      ok(soFeitos > 0 && soPend > 0,
         `AC16d-pre o cenário precisa de tópicos dos dois lados (${soFeitos}/${soPend})`);
      ok(soFeitos + soPend === tudo,
         `AC16d os filtros não particionam a lista: ${soFeitos} + ${soPend} ≠ ${tudo}`);

      /* marcação em lote: muda progresso, então pergunta antes */
      api.limparProgressoTeste();
      const antesFeitos = Object.keys(api.edProgressoAtual()).length;
      api.selecionarTeste(2);
      const aplicando = api.edLoteAplicar(true);
      api.uiModalResponder(true);
      await aplicando;
      const depois = Object.keys(api.edProgressoAtual()).length;
      ok(depois > antesFeitos,
         `AC16e a marcação em lote não marcou nada (${antesFeitos} → ${depois})`);

      /* AC16f — o "não" tem de não marcar, senão a pergunta é decorativa.
       * Zera o progresso antes: selecionar os mesmos tópicos já marcados
       * fazia a contagem não mudar de qualquer jeito, e o teste passava
       * mesmo com a confirmação removida. */
      api.limparProgressoTeste();
      api.selecionarTeste(2);
      const negando = api.edLoteAplicar(true);
      api.uiModalResponder(false);
      await negando;
      ok(Object.keys(api.edProgressoAtual()).length === 0,
         `AC16f responder 'não' marcou assim mesmo `
         + `(${Object.keys(api.edProgressoAtual()).length} marcados)`);

      /* AD — "O que eu já estudei disto?"
       * O erro que este recurso pode causar é o pior do app: dizer que você
       * já estudou algo que não estudou faz PULAR um assunto, e o erro só
       * aparece na prova. Por isso NADA é aplicado sozinho — nem nome
       * idêntico, que engana quando muda a disciplina ou o ente. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const L = ["# ISS | prova: " + emDias(131) + " | horas: 20", "@ Financas Publicas :: 5",
          "+ Restos a pagar :: 5 :: pq", "+ Crase :: 2 :: pq",
          "@ Direito Administrativo :: 4", "+ Responsabilidade Civil :: 4 :: pq"].join("\n");
        const eISS = api.edCriar("ISS", L);
        api.hubAbrirEdital(eISS.id);
        api.edRender();

        /* sem diário, o botão não tem o que comparar */
        api.diarioPor([]);
        api.vkAbrir();
        ok(!api.$("dlgJaEstudei").open,
           "AD1 com o diário vazio a triagem devia recusar abrir e explicar");

        api.diarioPor([
          { d: diasAtras(11), disc: "Direito Financeiro", n: "Restos a pagar", a: "feito", cc: "TCE-PE" },
          { d: diasAtras(9), disc: "Direito Civil", n: "Responsabilidade Civil", a: "revisado", cc: "TCE-PE" },
        ]);
        api.vkAbrir();
        const tri = api.vkTriagemAtual();
        ok(tri.length === 2, `AD2 esperava 2 nomes idênticos, veio ${tri.length}`);
        ok(tri.every((c) => c.escolha === "ia"),
           "AD3 o padrão da triagem devia ser 'perguntar à IA', não 'é o mesmo'");
        ok(tri.every((c) => c.mesmaDisciplina === false),
           "AD4 a triagem não sinalizou que as disciplinas diferem");

        /* nada aplicado até a pessoa decidir */
        const marca = (d, n) => api.vkHistorico(d, n, null, api.diarioAtual(), diasAtras(5)).marca;
        ok(marca("Financas Publicas", "Restos a pagar") === "sem_historico",
           "AD5 a triagem criou vínculo antes de qualquer decisão");

        /* aceita UM e deixa o outro para a IA: com todos marcados como
         * "igual", o teste não distinguiria "aplica os marcados" de
         * "aplica tudo" — e essa diferença é a razão da triagem existir */
        api.vkTriagemAtual().forEach((c) => {
          c.escolha = c.para.topico === "Restos a pagar" ? "igual" : "ia";
        });
        api.vkAplicarTriagem();
        ok(marca("Financas Publicas", "Restos a pagar") === "ja_visto",
           "AD6 aceitar como igual não gerou a marca de histórico");
        ok(marca("Direito Administrativo", "Responsabilidade Civil") === "sem_historico",
           "AD6b aplicou também o par que estava marcado para ir à IA");
        ok(marca("Financas Publicas", "Crase") === "sem_historico",
           "AD7 tópico sem par ganhou marca por tabela");

        /* e a marca aparece na linha da agenda, no lugar da fatia da
         * disciplina — que é a informação mais fraca ali */
        api.edRender(); api.hubRender();
        const txtAg = api.$("edAgendaTopo").textContent || "";
        ok(/já visto|seen in/.test(txtAg),
           "AD8 a marca de histórico não chegou na linha da agenda");

        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        api.diarioPor([]);
      }

      /* AE — "Salvar no material de estudo".
       * O botão precisa estar LIGADO: já embarquei um botão morto (o de
       * incluir disciplina, na v8.70), e a tela não denuncia isso. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        api.limparMaterialTeste();
        const eC = api.edCriar("TCE-PE", ["# TCE-PE | prova: " + emDias(131) + " | horas: 40",
          "@ Direito Financeiro :: 5", "+ Restos a pagar :: 5 :: pq",
          "@ Controle Externo :: 5", "+ Lei Organica :: 5 :: pq"].join("\n"));
        /* o edital NÃO é aberto de propósito: quem exporta cartões costuma
         * estar no modo cartões, com o edital fechado — e era exatamente
         * aí que o select ficava vazio e tudo vinha "sem pista" */
        api.cmIniciarTela();
        ok(typeof api.$("btnSalvarMaterial").onclick === "function",
           "AE1 cmIniciarTela não ligou o botão de salvar no material");
        ok(/cmIniciarTela\s*\(/.test(
             require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8")),
           "AE1b o index.html não chama cmIniciarTela: o botão nasce morto no app real");

        api.$("editor").value = [
          "O que sao restos a pagar? :: Despesas empenhadas :: Direito_Financeiro Restos_a_pagar",
          "Quantos conselheiros? :: Sete",
        ].join("\n");
        const abrindo = api.cmAbrir();
        api.uiModalResponder(true);
        await abrindo;
        ok(api.$("dlgCartaoMat").open, "AE2 a conferência não abriu");

        const itens = api.cmItensAtuais();
        ok(itens.length === 2, `AE3 esperava 2 cartões, veio ${itens.length}`);
        /* AE4 mudou de sinal na v8.78. Antes cobrava que a etiqueta
         * PREENCHESSE o destino. Com 843 cartões reais isso pôs perguntas
         * de Orçamento Base Zero em Língua Portuguesa: a etiqueta acerta
         * quando o tópico tem nome longo e erra em silêncio quando é curto.
         * Agora ela sugere, e o teste cobra que NÃO aplique. */
        ok(itens.every((x) => !x.destino),
           "AE4 a classificação por etiqueta voltou a aplicar destino sozinha");
        ok(itens[0].sugestao && itens[0].sugestao.topico === "Restos a pagar",
           `AE4b a etiqueta não virou sugestão: ${JSON.stringify(itens[0].sugestao)}`);
        ok(!itens[1].sugestao, "AE5 cartão sem pista ganhou sugestão do nada");

        /* aceitar a sugestão é um gesto seu, e ele pergunta antes — o "não"
         * tem de não aplicar, senão a pergunta é decorativa */
        const recusando = api.cmUsarSugestoes();
        api.uiModalResponder(false);
        await recusando;
        ok(!itens[0].destino,
           "AE5b responder 'não' às sugestões aplicou-as assim mesmo");

        const aceitando = api.cmUsarSugestoes();
        api.uiModalResponder(true);
        await aceitando;
        ok(itens[0].destino && itens[0].destino.topico === "Restos a pagar",
           "AE5c aceitar as sugestões não preencheu o destino");

        /* AE5d — "jogar nos gerais" precisa da disciplina ESCOLHIDA.
         * Sem seleção, não pode mover nada: era daqui que saíam as
         * perguntas de Orçamento Base Zero em Língua Portuguesa. */
        api.cmLimpar();
        api.$("cmDiscGeral").value = "";
        api.cmTudoGeral();
        ok(api.cmItensAtuais().every((x) => !x.destino),
           "AE5d mandou cartões para os gerais sem disciplina escolhida");
        api.$("cmDiscGeral").value = "Controle Externo";
        api.cmTudoGeral();
        ok(api.cmItensAtuais().every((x) => x.destino
             && x.destino.disciplina === "Controle Externo"),
           "AE5e escolhi a disciplina e os cartões não foram para ela");
        api.cmLimpar();
        const aceitando2 = api.cmUsarSugestoes();
        api.uiModalResponder(true);
        await aceitando2;

        /* gravar pergunta antes, e o "não" não pode gravar */
        const negando = api.cmGravarTudo();
        api.uiModalResponder(false);
        await negando;
        const mat = api.matResumosAtual();
        ok(!Object.keys(mat).some((k) => mat[k] && mat[k].cartoes),
           "AE6 responder 'não' gravou os cartões assim mesmo");

        /* gravar pergunta E DEPOIS avisa. Responder os dois no mesmo
         * instante não funciona: o aviso só nasce depois que a pergunta
         * resolve, e o segundo "sim" caía no vazio — a promessa ficava
         * pendurada e o arquivo de teste terminava sem imprimir nada. */
        const gravando = api.cmGravarTudo();
        api.uiModalResponder(true);
        await new Promise((r) => setImmediate(r));
        api.uiModalResponder(true);
        await gravando;
        const mat2 = api.matResumosAtual();
        const comCartoes = Object.keys(mat2).filter((k) => mat2[k] && mat2[k].cartoes);
        ok(comCartoes.length === 1,
           `AE7 esperava 1 tópico com cartões, veio ${comCartoes.length}`);
        ok(/concurso_TCE-PE/.test(mat2[comCartoes[0]].cartoes),
           "AE8 o cartão salvo não ficou marcado com o concurso");

        /* AE9 — DESFAZER. Sem isto o primeiro erro é permanente, e foi
         * exatamente o que aconteceu com 843 cartões no uso real. */
        ok(api.$("btnCmDesfazer").hidden === false,
           "AE9 o botão de desfazer não apareceu depois de gravar");
        ok(typeof api.$("btnCmDesfazer").onclick === "function",
           "AE9a o botão de desfazer não está ligado a nada");
        const desfazendo = api.cmDesfazerUltimo();
        api.uiModalResponder(true);
        await new Promise((r) => setImmediate(r));
        api.uiModalResponder(true);
        await desfazendo;
        const mat3 = api.matResumosAtual();
        ok(!Object.keys(mat3).some((k) => mat3[k] && (mat3[k].cartoes || "").trim()),
           "AE9b desfazer não retirou os cartões do material");

        api.edApagar(eC.id);
      }

      /* AF — O DIÁRIO PRECISA TER PORTA, E A PORTA PRECISA LEVAR DE VOLTA.
       * Ele tinha duas entradas e as duas eram condicionais: a linha
       * "últimos 7 dias" (só aparece se houve estudo no período) e os
       * medidores ESTUDADO/REVISADO — que eu mesmo removi do painel na
       * v8.71. Quem passou uma semana sem registrar não tinha COMO abrir o
       * próprio diário. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const eD = api.edCriar("TCE-PE", ["# TCE-PE | prova: " + emDias(131) + " | horas: 40",
          "@ Direito Financeiro :: 5", "+ Restos a pagar :: 5 :: pq"].join("\n"));
        api.hubAbrirEdital(eD.id);
        api.diarioPor([]);
        api.edRender();

        api.edIniciar();
        ok(typeof api.$("btnDiarioTopo").onclick === "function",
           "AF1 edIniciar não ligou o botão fixo do diário");
        ok(/edIniciar\s*\(/.test(require("fs").readFileSync(
             require("path").join(__dirname, "..", "docs", "index.html"), "utf8")),
           "AF1b o index.html não chama edIniciar: o botão nasce morto no app real");
        /* e ele nao pode depender de ter havido estudo recente */
        api.abrirDiario();
        ok(api.$("dlgDiario").open,
           "AF2 o diário não abre quando não há estudo registrado");
        api.$("dlgDiario").close();

        /* "faz pouco tempo", não uma data fixa: com diasAtras(7) este teste
         * caiu fora da janela de 7 dias assim que o calendário virou. */
        api.diarioPor([{ d: diasAtras(2), c: "direito financeiro›restos a pagar",
          disc: "Direito Financeiro", n: "Restos a pagar", a: "feito",
          cc: "TCE-PE", m: 60, p: 25 }]);
        api.abrirDiario();
        const txtD = (el) => {
          let s = "";
          const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
          anda(el); return s;
        };
        const linha = txtD(api.$("diarioLista"));
        /* a linha registrava o que voce fez e so oferecia APAGAR: quem marca
         * "estudei Restos a pagar" e tres dias depois quer reler o resumo
         * tinha de sair do diario e cacar o topico na mao */
        ok(/material|escrever/i.test(linha),
           "AF3 a linha do diário não leva de volta ao material: " + linha.slice(0, 90));
        ok(/disciplina|subject/i.test(linha),
           "AF4 a linha do diário não leva ao panorama da disciplina");

        /* AF5 — o registro é EMPILHADO e os botões ficam numa faixa
         * horizontal ABAIXO dele. Com tudo numa linha só (display:flex), os
         * três botões dividiam a largura com o texto e viravam uma letra
         * por linha, com o resto atrás de uma barra de rolagem lateral.
         * A v8.79 tentou consertar isto na classe errada (.di-item, que não
         * existe): quem manda é .diario-item. */
        const li0 = api.$("diarioLista").children[0];
        const faixas = (li0.children || []).map((c) => c.className);
        ok(faixas.join(",") === "di-cima,di-meio,di-acoes",
           "AF5 o registro do diário não está em três faixas: " + faixas.join(","));
        const acoes = (li0.children || []).find((c) => c.className === "di-acoes");
        ok(acoes && (acoes.children || []).length === 3,
           `AF5b a faixa de botões devia ter 3 botões, tem ${acoes && (acoes.children || []).length}`);
        /* e a regra de estilo tem de existir para a classe CERTA */
        const css = require("fs").readFileSync(
          require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
        ok(/\.diario-item\{[^}]*display:block/.test(css),
           "AF5c .diario-item continua em display:flex — os botões voltam a espremer");
        ok(/\.di-acoes\{[^}]*flex-direction:row/.test(css),
           "AF5d os botões do diário não estão dispostos na horizontal");

        api.edApagar(eD.id);
        api.diarioPor([]);
      }

      /* AG — o item sai da agenda MOSTRANDO para onde foi.
       * Ele sumia no mesmo instante em que o diálogo fechava, e sumia
       * calado: parecia que tinha se perdido, não que tinha sido guardado. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        api.diarioPor([]);
        const eG = api.edCriar("TCE-PE", ["# TCE-PE | prova: " + emDias(131) + " | horas: 40",
          "@ Direito Financeiro :: 5", "+ Restos a pagar :: 5 :: pq",
          "+ Receita Publica :: 4 :: pq"].join("\n"));
        api.hubAbrirEdital(eG.id);
        api.edRender(); api.hubRender();

        const item = api.semanaAtualTeste()[0];
        ok(!!item, "AG1-pre a agenda precisa ter ao menos um item");
        api.abrirRegistro(item);
        api.confirmarRegistroTeste("feito");

        /* o registro tem de chegar ao diário — a animação é enfeite, o dado
         * é o que importa e não pode depender dela */
        ok(api.diarioAtual().length === 1,
           `AG1 o registro não chegou ao diário (${api.diarioAtual().length})`);
        ok(api.diarioAtual()[0].n === item.nome,
           "AG2 o registro que chegou ao diário é de outro tópico");

        /* e a tela precisa ter dito para onde foi */
        const reg = api.registroTexto();
        ok(/saiu da agenda para o diário/.test(reg),
           "AG3 a saída do item não deixou rastro no registro");

        /* AG4 — quando NÃO há linha para animar (painel fechado, item fora
         * da tela), o redesenho tem de acontecer na hora. Deixar tudo por
         * conta do temporizador da animação faz a agenda ficar mostrando um
         * item já registrado até alguém mexer na tela. */
        const txtAg = (el) => {
          let s = "";
          const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
          anda(el); return s;
        };
        ok(txtAg(api.$("edAgendaTopo")).indexOf(item.nome) < 0,
           "AG4 o item registrado continua desenhado na agenda");

        /* AG5 — a animação PRECISA ter acontecido.
         * Contar elementos com a classe depois do fato não serve: a agenda
         * é redesenhada e os elementos animados deixam de existir. Por isso
         * a despedida registra quantas linhas marcou — instrumentação de
         * verdade, em vez de supor pelo efeito colateral. */
        const item2 = api.semanaAtualTeste()[0];
        api.abrirRegistro(item2);
        api.confirmarRegistroTeste("feito");
        ok(api.ultimaDespedida() >= 1,
           "AG5 nenhuma linha foi animada: edMarcar redesenhou a agenda antes "
           + "e a linha que ia sair já não existia");

        api.edApagar(eG.id);
        api.diarioPor([]);
      }

      /* AH — O RITUAL DA VIRADA (P4/P5).
       * É o momento em que se ganha ou se perde meses de estudo. A regra
       * que manda: nada é apagado. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        api.limparMaterialTeste();
        api.diarioPor([]);
        api.matIniciar(); api.vkCarregar();

        const PRE2 = ["# TCE-CE | previsto: 2027-03..2027-06 | horas: 10",
          "@ Analise de Dados :: 3 :: boato",
          "+ Mineracao de dados :: 3 :: pq", "+ Dados abertos :: 3 :: pq",
          "@ Direito Constitucional :: 4 :: confirmada",
          "+ Controle de constitucionalidade :: 5 :: pq"].join("\n");
        const eV = api.edCriar("TCE-CE", PRE2);
        api.hubAbrirEdital(eV.id);
        api.edRender();
        api.vrIniciar();

        ok(api.$("btnVirada").hidden === false,
           "AH1 o botão da virada não aparece num edital previsto");
        ok(typeof api.$("btnVirada").onclick === "function",
           "AH1b o botão da virada não está ligado a nada");

        /* estudo e material no tópico que vai morrer */
        api.edProgresso["analise de dados›mineracao de dados"] = { e: "feito", d: emDias(11) };
        api.diarioPor([{ d: emDias(11), c: "analise de dados›mineracao de dados",
          disc: "Analise de Dados", n: "Mineracao de dados", a: "feito",
          m: 180, cc: "TCE-CE" }]);
        const chV = api.matChave("Analise de Dados", "Mineracao de dados");
        api.matGravar(chV, "Resumo escrito antes do edital sair.",
          { disciplina: "Analise de Dados", topico: "Mineracao de dados" });

        api.vrAbrir();
        api.$("vrTexto").value = ["# TCE-CE | prova: " + emDias(268) + " | horas: 40",
          "@ Direito Constitucional :: 5",
          "+ Controle de constitucionalidade :: 5 :: pq",
          "+ Tratamento de dados :: 4 :: pq"].join("\n");
        api.vrConferir();

        const txtV = (el) => {
          let s = "";
          const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
          anda(el); return s;
        };
        const aviso = txtV(api.$("vrAviso"));
        /* a linha que evita a leitura "perdi 3 horas" */
        ok(/já estudou|already studied/i.test(aviso),
           "AH2 a virada não avisa que há estudo nos tópicos que saem: " + aviso.slice(0, 100));
        ok(/3 h|3\.0 h/.test(aviso),
           "AH2b a virada não diz QUANTAS horas estão nos tópicos que saem");

        /* os dois órfãos aparecem para remanejo: o estudo e o material */
        const orf = api.vrOrfaosAtuais();
        ok(orf.length === 2, `AH3 esperava 2 órfãos, veio ${orf.length}`);
        ok(orf.some((o) => o.tipo === "estudo") && orf.some((o) => o.tipo === "material"),
           "AH3b faltou o órfão de estudo ou o de material");

        /* escolhe destino só para o material e aplica */
        orf.find((o) => o.tipo === "material").destino =
          { disciplina: "Direito Constitucional", topico: "Tratamento de dados" };
        /* AH3c — o "não" tem de não aplicar. Sem isto a confirmação é
         * decorativa, e aqui ela guarda o texto do edital inteiro. */
        const negando = api.vrAplicar();
        api.uiModalResponder(false);
        await negando;
        ok(/previsto: 2027-03/.test(api.$("editalTexto").value),
           "AH3c responder 'não' aplicou o edital assim mesmo");
        ok(!api.diarioAtual()[0].fase,
           "AH3d responder 'não' carimbou o diário assim mesmo");

        const aplicando = api.vrAplicar();
        api.uiModalResponder(true);
        await new Promise((r) => setImmediate(r));
        api.uiModalResponder(true);
        await aplicando;

        /* NADA foi apagado */
        ok(api.diarioAtual().length === 1,
           "AH4 a virada apagou registro do diário");
        ok(api.diarioAtual()[0].fase === "pre",
           "AH4b o registro não foi carimbado como pré-edital");
        ok(api.edProgresso["analise de dados›mineracao de dados"],
           "AH4c a virada apagou o progresso do tópico que saiu do plano");

        /* o material foi para o destino escolhido */
        const mat = api.matResumosAtual();
        const destCh = api.matChave("Direito Constitucional", "Tratamento de dados");
        ok(mat[destCh] && /antes do edital sair/.test(mat[destCh].texto || ""),
           "AH5 o material órfão não chegou ao destino escolhido");
        ok(!mat[chV], "AH5b a gaveta antiga do material continuou existindo");

        /* e o edital agora tem data */
        /* a data vem de emDias, então a verificação também tem de vir:
         * escrita à mão, ela deixava de casar assim que o dia virava. */
        ok(api.$("editalTexto").value.indexOf("prova: " + emDias(268)) >= 0,
           "AH6 o texto do edital não foi substituído pelo publicado");
        ok(api.vrEhPrevisto() === false,
           "AH6b o edital continua marcado como previsto depois da virada");

        api.edApagar(eV.id);
        api.limparMaterialTeste();
        api.diarioPor([]);
      }

      /* AI — CARTÕES direto da agenda, como já era com o resumo.
       * Antes, para fazer um cartão era preciso abrir o material, entrar no
       * painel e voltar. E o indicador precisa dizer, sem clique, se já há
       * cartão salvo naquele tópico. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        api.limparMaterialTeste();
        const eI = api.edCriar("TCE-PE", ["# TCE-PE | prova: " + emDias(131) + " | horas: 40",
          "@ Direito Financeiro :: 5", "+ Restos a pagar :: 5 :: pq",
          "+ Receita Publica :: 4 :: pq"].join("\n"));
        api.hubAbrirEdital(eI.id);
        /* um dos dois tem cartões salvos */
        const chI = api.matChave("Direito Financeiro", "Restos a pagar");
        api.matGravarCartoes(chI, "P :: R :: tag",
          { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
        api.edRender(); api.hubRender();

        const conta = (el, cls) => {
          let n = 0;
          const anda = (x) => (x.children || []).forEach((f) => {
            if ((f.className || "").split(/\s+/).includes(cls)) n++;
            anda(f);
          });
          anda(el); return n;
        };
        ok(conta(api.$("edAgendaTopo"), "ed-crt") >= 1,
           "AI1 nenhuma linha mostra que tem cartões");
        ok(conta(api.$("edAgendaTopo"), "ed-item")
           > conta(api.$("edAgendaTopo"), "ed-crt"),
           "AI1-pre o cenário precisa de linhas com e sem cartões");
        /* o indicador acende só onde há cartão */
        let acesos = 0;
        const anda2 = (x) => (x.children || []).forEach((f) => {
          const c = (f.className || "").split(/\s+/);
          if (c.includes("ed-crt") && c.includes("tem")) acesos++;
          anda2(f);
        });
        anda2(api.$("edAgendaTopo"));
        ok(acesos === 1,
           `AI2 o indicador de cartões devia acender em 1 linha, acendeu em ${acesos}`);

        /* OS CARTÕES SAÍRAM DA LINHA E FORAM PARA O "⋮".
         * A linha tinha seis alvos e quatro deles eram ícones; com dez
         * linhas na semana, sessenta alvos na mesma tela. Agora a linha
         * tem "estudar" e um menu, e é dentro do menu que cabe a palavra
         * escrita por extenso. O teste segue o caminho novo. */
        const acharNa = (raiz, cls) => {
          let achado = null;
          const anda = (x) => (x.children || []).forEach((f) => {
            if ((f.className || "").split(/\s+/).includes(cls) && !achado) achado = f;
            anda(f);
          });
          anda(raiz);
          return achado;
        };
        const btMais = acharNa(api.$("edAgendaTopo"), "ed-mais");
        ok(!!btMais, "AI3 a linha da agenda perdeu o menu ⋮");
        if (btMais) btMais.onclick({ stopPropagation() {} });
        let alvoBtn = null;
        const anda3 = (x) => (x.children || []).forEach((f) => {
          const txt = f.textContent || "";
          if (/cart/i.test(txt) && /ed-menu-item/.test(f.className || "") && !alvoBtn) {
            alvoBtn = f;
          }
          anda3(f);
        });
        anda3(api.$("edAgendaTopo"));
        ok(alvoBtn && typeof alvoBtn.onclick === "function",
           "AI3b o menu da agenda não oferece os cartões do tópico");
        if (!alvoBtn) return falhas;
        /* AI5 mede a MUDANÇA, não o valor absoluto: blocos anteriores
         * deixam o app noutro modo, e comparar com "edital" fazia o teste
         * falhar por herança em vez de por defeito. */
        const modoAntes = api.modoAtual;
        /* O QUE SE MEDE É O GESTO, NÃO O ESTADO HERDADO.
         * Este bloco roda depois de outros que deixam o resumo aberto —
         * e desde que "registrar leitura" parou de fechá-lo, ele chega
         * aqui aberto por herança. Sem zerar antes, AI4b acusaria o
         * clique de algo que já estava feito. */
        api.$("dlgMaterial").close();
        alvoBtn.onclick({ stopPropagation() {} });
        /* O atalho da agenda leva a VER os cartões, não a editá-los: o
         * gesto ali é "quero revisar", e o caminho antigo abria o resumo
         * em modo edição antes de mostrar cartão nenhum. */
        ok(api.$("dlgMcEstudo").open,
           "AI4 o atalho da agenda não abriu o leitor de cartões");
        ok(api.$("dlgMaterial").open !== true,
           "AI4b o atalho passou pelo resumo no caminho");
        ok(api.modoAtual === modoAntes,
           `AI5 abrir os cartões trocou o modo do app: ${modoAntes} → ${api.modoAtual}`);
        api.$("dlgMcEstudo").close();
        api.$("dlgMatCartoes").close();
        api.$("dlgMaterial").close();

        api.edApagar(eI.id);
        api.limparMaterialTeste();
      }

      /* AJ — ORDEM DE INICIALIZAÇÃO: o dado antes de quem lê o dado.
       * A agenda e o painel desenham os ícones de resumo e de cartões
       * consultando matResumos. Enquanto matIniciar() vinha por último, a
       * agenda era pintada com matResumos VAZIO: todo tópico aparecia sem
       * material, mesmo tendo, e nada repintava depois. */
      {
        const html = require("fs").readFileSync(
          require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
        const iMat = html.indexOf("try { matIniciar(); }");
        const iEd = html.indexOf("try { edIniciar(); }");
        const iHub = html.indexOf("try { hubIniciar(); }");
        ok(iMat > 0 && iEd > 0 && iHub > 0,
           "AJ1-pre não achei as três chamadas de inicialização no HTML");
        ok(iMat < iEd,
           "AJ1 matIniciar vem depois de edIniciar: a agenda nasce sem os ícones");
        ok(iMat < iHub,
           "AJ1b matIniciar vem depois de hubIniciar: o hub nasce sem os ícones");
      }

      /* AK — guardar cartões da bancada guarda SÓ os cartões.
       * A função contava as linhas com "::" para validar e gravava a CAIXA
       * INTEIRA — prompt junto. Um tópico ficou com 155 linhas, 17 cartões. */
      {
        api.limparMaterialTeste();
        api.$("genTexto").value = ["Gere flashcards para Anki a partir do texto abaixo.",
          "REGRAS DE FORMATO (siga exatamente):",
          "O que e exercicio financeiro? :: Periodo de 12 meses :: fin",
          "Quando comeca? :: 1 de janeiro :: fin",
          "Espero ter ajudado!"].join("\n");
        api.genOrigemTeste({ disciplina: "Direito Financeiro", topico: "Lei 4.320" });
        api.guardarCartoesNoMaterial();
        const ch = api.matChave("Direito Financeiro", "Lei 4.320");
        const guardado = String((api.matResumosAtual()[ch] || {}).cartoes || "");
        ok(guardado, "AK1 nada foi guardado no material");
        ok(!/Gere flashcards/.test(guardado),
           `AK2 o prompt foi guardado junto com os cartões: ${guardado.slice(0, 80)}`);
        ok(guardado.split("\n").filter(Boolean).length === 2,
           `AK3 esperava 2 cartões guardados, veio `
           + guardado.split("\n").filter(Boolean).length);
        ok(/exercicio financeiro/.test(guardado),
           "AK4 o conteúdo dos cartões se perdeu");
        api.limparMaterialTeste();
      }

      /* AL — GRAVAR E DESENHAR SÃO COISAS DIFERENTES.
       * edSalvar() morava dentro de edRender(). Quando a v8.81 passou a
       * pular o redesenho para animar a saída do item, pulou a GRAVAÇÃO
       * junto: o progresso ficava só na memória do edital aberto, e a
       * agenda do topo — que lê "progresso" do registro de cada edital na
       * lista — continuava mostrando o tópico já estudado. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        api.diarioPor([]);
        const eL = api.edCriar("TCE-PE", ["# TCE-PE | prova: " + emDias(131) + " | horas: 60",
          "@ Direito Financeiro :: 5", "+ Principios orcamentarios :: 5 :: pq",
          "+ Leis Orcamentarias :: 5 :: pq", "+ Receita Publica :: 5 :: pq"].join("\n"));
        api.hubAbrirEdital(eL.id);
        api.edRender(); api.hubRender();

        const txtL = (el) => {
          let s = "";
          const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
          anda(el); return s;
        };
        ok(txtL(api.$("edAgendaTopo")).indexOf("Principios") >= 0,
           "AL1-pre o tópico precisa estar na agenda antes de ser marcado");

        const itL = api.semanaAtualTeste().find((x) => /Principios/.test(x.nome));
        api.abrirRegistro(itL);
        api.confirmarRegistroTeste("feito");

        /* o registro do edital NA LISTA tem de refletir a marca IMEDIATAMENTE:
         * é dele que a agenda do topo lê, e é ele que sobrevive ao recarregar */
        const guardado = (api.editaisLista().find((x) => x.id === eL.id) || {}).progresso || {};
        ok(Object.keys(guardado).length === 1,
           `AL1 a marca não foi gravada no registro do edital (${Object.keys(guardado).length}) — `
           + "ela some ao recarregar e a agenda do topo continua mostrando o tópico");

        api.hubPintarAgenda();
        ok(txtL(api.$("edAgendaTopo")).indexOf("Principios") < 0,
           "AL2 o tópico registrado continua na agenda da semana");

        /* AL3 — a invariante, direto: marcar SEM redesenhar tem de gravar
         * do mesmo jeito. É o caminho que a animação usa, e foi por ele que
         * o defeito entrou. O teste chama edMarcar com semRender=true
         * porque no ambiente de teste a animação não chega a ser acionada. */
        const it2 = api.semanaAtualTeste().find((x) => /Leis/.test(x.nome));
        api.edMarcarTeste(it2, "feito", { minutos: 60, formas: ["leitura"], humor: "media" }, true);
        const g2 = (api.editaisLista().find((x) => x.id === eL.id) || {}).progresso || {};
        /* Em memória isto sempre passa: edSalvar faz "alvo.progresso =
         * edProgresso", então os dois viram o MESMO objeto e qualquer
         * mutação aparece nos dois lados. O que se perde de verdade é a
         * gravação em disco — e é ela que decide se a marca sobrevive ao
         * recarregar. Por isso a verificação é no armazenamento. */
        ok(Object.keys(g2).length === 2,
           `AL3 marcar sem redesenhar não registrou: ${Object.keys(g2).length} de 2`);
        const noDisco = JSON.parse(api.lojaLer("eac_edital_progresso") || "{}");
        ok(Object.keys(noDisco).length === 2,
           `AL4 a marca não foi GRAVADA (${Object.keys(noDisco).length} de 2 no `
           + "armazenamento) — ela some ao recarregar, e a agenda volta a "
           + "mostrar o tópico já estudado");

        api.edApagar(eL.id);
        api.diarioPor([]);
      }

      /* AM — medidor de horas da semana: feito contra planejado.
       * "63h45 desta semana" é uma cobrança sem resposta; a barra diz se
       * você está em dia. E conta TEMPO do diário, não tópicos marcados —
       * marcar um tópico não diz quanto tempo levou. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const eM = api.edCriar("X", ["# X | prova: " + emDias(131) + " | horas: 20",
          "@ D :: 5", "+ t1 :: 5 :: pq", "+ t2 :: 5 :: pq", "+ t3 :: 4 :: pq"].join("\n"));
        api.hubAbrirEdital(eM.id);
        const hojeM = new Date().toISOString().slice(0, 10);
        api.diarioPor([{ d: hojeM, disc: "D", n: "t1", a: "feito", m: 90, cc: "X" },
                       { d: hojeM, disc: "D", n: "t2", a: "feito", m: 45, cc: "X" }]);
        api.edRender(); api.hubRender();

        const txtM = (el) => {
          let s = "";
          const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
          anda(el); return s;
        };
        const naTela = txtM(api.$("edAgendaTopo"));
        ok(/2h15/.test(naTela),
           "AM1 o medidor não soma as horas registradas na semana: " + naTela.slice(0, 90));
        ok(/registradas|logged/.test(naTela),
           "AM2 o medidor não aparece na agenda");

        /* registro de OUTRA semana não pode entrar na conta */
        api.diarioPor([{ d: "2020-01-01", disc: "D", n: "t1", a: "feito", m: 600, cc: "X" }]);
        api.hubRender();
        /* olha o MEDIDOR, não a agenda inteira: a barra de cada tópico conta
         * todo o tempo daquele tópico (o que é certo), e o texto dela também
         * tem horas. Procurar "10h" no bloco todo confundia as duas coisas. */
        const medidor = (api.$("edAgendaTopo").children || [])
          .filter((c) => (c.className || "").indexOf("ag-medidor") >= 0)
          .map((c) => txtM(c)).join(" ");
        ok(!/10h/.test(medidor),
           `AM3 registro de semana antiga entrou na conta desta semana: ${medidor}`);

        api.edApagar(eM.id);
        api.diarioPor([]);
      }

      /* AN — barra por TÓPICO na agenda, e horas claras no diário.
       * A agenda dizia quanto o tópico pede e nunca quanto você já pôs
       * nele; o diário escondia as horas no meio de "7 tópicos · 0
       * revisões · 1h30 · 3 registros" — um número sem nome. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const eN = api.edCriar("X", ["# X | prova: " + emDias(131) + " | horas: 20",
          "@ D :: 5", "+ t1 :: 5 :: pq", "+ t2 :: 5 :: pq"].join("\n"));
        api.hubAbrirEdital(eN.id);
        const hojeN = new Date().toISOString().slice(0, 10);
        api.diarioPor([{ d: hojeN, c: "d›t1", disc: "D", n: "t1", a: "feito", m: 45, cc: "X" }]);
        api.edRender(); api.hubRender();

        const fills = [];
        const anda = (x) => (x.children || []).forEach((f) => {
          if ((f.className || "").indexOf("it-fill") >= 0)
            fills.push({ cls: f.className, w: (f.style || {}).width });
          anda(f);
        });
        anda(api.$("edAgendaTopo"));
        ok(fills.length === 2, `AN1 esperava 1 barra por tópico (2), veio ${fills.length}`);
        const comProgresso = fills.filter((f) => f.w && f.w !== "0%");
        ok(comProgresso.length === 1,
           `AN2 só o tópico estudado devia ter barra preenchida, veio ${comProgresso.length}`);
        ok(comProgresso[0].w === "75%",
           `AN3 45min de 1h deviam dar 75%, deu ${comProgresso[0].w}`);

        /* o diário lidera com as HORAS, e o número tem nome */
        api.abrirDiario();
        const cab = api.$("diarioResumo").textContent || "";
        ok(/^45min|^0h45/.test(cab.trim()),
           `AN4 o diário não começa pelas horas estudadas: ${cab.slice(0, 60)}`);
        ok(/estudadas|studied/.test(cab),
           "AN5 as horas do diário continuam sem rótulo");
        api.$("dlgDiario").close();

        /* AN6 — diário com MUITOS registros não pode montar tudo de uma vez:
         * milhares de linhas travam a abertura da janela. */
        const muitos = [];
        for (let k = 0; k < 200; k++)
          muitos.push({ d: hojeN, c: "d›t" + k, disc: "D" + (k % 3),
                        n: "Topico " + k, a: "feito", m: 30, cc: "X" });
        api.diarioPor(muitos);
        api.abrirDiario();
        const linhas = (api.$("diarioLista").children || []).length;
        ok(linhas < 100,
           `AN6 o diário desenhou ${linhas} linhas de uma vez — com meses de `
           + "registro isso trava a abertura");
        ok(/60 de 200|60 of 200/.test(api.$("diarioConta").textContent || ""),
           `AN7 o diário não diz quantos está mostrando: ${api.$("diarioConta").textContent}`);
        ok((api.$("diarioLista").children || []).some((c) => /mostrar mais|show .* more/i.test(c._texto || "")),
           "AN8 não há como ver os registros restantes");
        api.$("dlgDiario").close();

        api.edApagar(eN.id);
        api.diarioPor([]);
      }

      /* AO — o modal de registro completo.
       * Campos de questão só quando "questões" está marcado; atalhos de
       * tempo que somam; onde parou; anotação. E várias formas na mesma
       * sessão, que é como sessão real acontece. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const eO = api.edCriar("X", ["# X | prova: " + emDias(131) + " | horas: 20",
          "@ D :: 5", "+ t1 :: 5 :: pq"].join("\n"));
        api.hubAbrirEdital(eO.id);
        api.diarioPor([]);
        api.edRender();
        const itO = api.semanaAtualTeste()[0];
        api.abrirRegistro(itO);

        const formas = (api.$("regFormas").children || []).map((b) => (b._texto || "").toLowerCase());
        ok(formas.some((f) => /lei seca|raw law/.test(f)),
           "AO1 falta a forma “lei seca”");
        ok(formas.some((f) => /flashcard/.test(f)),
           "AO2 falta a forma “flashcards”");

        /* questões só aparecem quando escolhidas */
        ok(api.$("regQuestoesBloco").hidden,
           "AO3 os campos de questão aparecem antes de a forma ser escolhida");
        const bq = (api.$("regFormas").children || []).find((b) => /quest/i.test(b._texto || ""));
        bq.onclick();
        ok(!api.$("regQuestoesBloco").hidden,
           "AO4 marcar “questões” não revelou os campos");

        /* atalhos SOMAM ao valor atual */
        const antes = Number(api.$("regMinutos").value);
        (api.$("regAtalhos").children || [])[1].onclick();
        ok(Number(api.$("regMinutos").value) === antes + 30,
           `AO5 o atalho +30m devia somar: ${antes} → ${api.$("regMinutos").value}`);

        api.$("regQFeitas").value = 20;
        api.$("regQCertas").value = 17;
        api.$("regOnde").value = "PDF pag. 15-40";
        api.$("regObs").value = "Pegadinha do prazo.";
        api.confirmarRegistroTeste("feito");

        const r = api.diarioAtual()[0] || {};
        ok(r.q && r.q.feitas === 20 && r.q.certas === 17,
           `AO6 as questões não foram gravadas: ${JSON.stringify(r.q)}`);
        ok(r.onde === "PDF pag. 15-40", "AO7 “onde parou” não foi gravado");
        ok(/Pegadinha/.test(r.obs || ""), "AO8 a anotação não foi gravada");
        /* várias formas na mesma sessão */
        ok((r.f || []).length === 2 && r.f.indexOf("questoes") >= 0,
           `AO9 a sessão devia guardar as duas formas: ${JSON.stringify(r.f)}`);

        /* campo de questão vazio NÃO vira zero: "0 de 0" e "não fiz
         * questões" são coisas diferentes na conta de acerto */
        api.abrirRegistro(itO);
        api.confirmarRegistroTeste("feito");
        ok(api.diarioAtual()[1] && api.diarioAtual()[1].q === null,
           "AO10 sessão sem questões gravou um zero que vira 0% de acerto depois");

        api.edApagar(eO.id);
        api.diarioPor([]);
      }

      /* AP — apagar registro esvazia a barra E grava; e o número aparece
       * ao lado da barra. apagarDoDiario chamava edRender() mas não
       * edSalvar() nem hubPintarAgenda(): a mudança não sobrevivia ao
       * recarregar e a barra do tópico continuava cheia, porque a agenda do
       * topo é montada por outra função. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const eP = api.edCriar("X", ["# X | prova: " + emDias(131) + " | horas: 20",
          "@ D :: 5", "+ Principios :: 5 :: pq", "+ Leis :: 5 :: pq"].join("\n"));
        api.hubAbrirEdital(eP.id);
        const hojeP = new Date().toISOString().slice(0, 10);
        api.diarioPor([{ d: hojeP, c: "d›principios", disc: "D", n: "Principios",
                         a: "feito", m: 25, cc: "X" }]);
        /* NÃO marca como feito: item feito sai da agenda e deixa de ter
         * linha — e é a linha que carrega a barra e o número. A primeira
         * versão deste teste marcava, e depois cobrava um número numa
         * linha que ela mesma tinha feito desaparecer. */
        api.edRender(); api.hubRender();

        const txtP = (el) => {
          let s = "";
          const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
          anda(el); return s;
        };
        /* o NÚMERO ao lado da barra: barra sozinha se lê "mais ou menos pela
         * metade", e 25min de 1h é decisão diferente de 50min de 1h */
        ok(/25min de 1h · 42%|25min of 1h · 42%/.test(txtP(api.$("edAgendaTopo"))),
           "AP1 falta o número de horas/percentual ao lado da barra");

        api.abrirDiario();
        api.apagarDoDiario(0);
        const larguras = [];
        const anda2 = (x) => (x.children || []).forEach((f) => {
          if ((f.className || "").indexOf("it-fill") >= 0)
            larguras.push((f.style || {}).width);
          anda2(f);
        });
        anda2(api.$("edAgendaTopo"));
        ok(larguras.every((w) => !w || w === "0%"),
           `AP2 a barra continuou cheia depois de apagar o registro: ${JSON.stringify(larguras)}`);
        /* olha o ARMAZENAMENTO: em memória "progresso" e edProgresso são o
         * mesmo objeto, então a mudança aparece nos dois lados sem gravar.
         * O que se perde é a escrita — e é ela que sobrevive ao recarregar.
         * Mesma lição da v8.88. */
        const discoP = JSON.parse(api.lojaLer("eac_edital_progresso") || "{}");
        ok(Object.keys(discoP).length === 0,
           `AP3 apagar o registro não GRAVOU a volta do progresso `
           + `(${Object.keys(discoP).length} no armazenamento) — some ao recarregar`);
        api.$("dlgDiario").close();

        api.edApagar(eP.id);
        api.diarioPor([]);
      }

      /* AQ — revisão se distingue de estudo novo na agenda.
       * A regra existia mas era verde a 7% — invisível, e verde é a cor de
       * "feito", que é outra coisa. Cor sozinha também não basta: quem
       * imprime em preto e branco não vê nada. */
      {
        (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
        const eQ = api.edCriar("X", ["# X | prova: " + emDias(131) + " | horas: 40",
          "@ D :: 5", "+ t1 :: 5 :: pq", "+ t2 :: 5 :: pq"].join("\n"));
        api.hubAbrirEdital(eQ.id);
        api.edProgresso["d›t1"] = { e: "feito", d: diasAtras(51) };
        api.diarioPor([]);
        api.edRender(); api.hubRender();

        const classes = [];
        const anda = (x) => (x.children || []).forEach((f) => {
          if ((f.className || "").split(/\s+/).includes("ed-item")) classes.push(f.className);
          anda(f);
        });
        anda(api.$("edAgendaTopo"));
        ok(classes.some((c) => c.indexOf("ehrev") >= 0),
           `AQ1 nenhuma linha marcada como revisão: ${JSON.stringify(classes)}`);
        ok(classes.some((c) => c.indexOf("ehrev") < 0),
           "AQ1-pre o cenário precisa de uma linha de estudo novo também");

        const txtQ = (el) => {
          let s = "";
          const a2 = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); a2(f); });
          a2(el); return s;
        };
        ok(/revis/i.test(txtQ(api.$("edAgendaTopo"))),
           "AQ2 falta o selo de revisão — cor sozinha não serve a quem não a distingue");

        /* a regra de estilo tem de existir e NÃO ser da família do verde */
        const css = require("fs").readFileSync(
          require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
        const mm = css.match(/\.ed-item\.ehrev\{[^}]*\}/);
        ok(mm && /59,130,246|#3b82f6/.test(mm[0]),
           `AQ3 a revisão não tem cor própria distinta de "feito": ${mm && mm[0]}`);

        api.edApagar(eQ.id);
      }

      api.edApagar(e1.id); api.edApagar(e2.id);
      api.hubRender();
    }

    const bloco = (CSS.match(/#editorHl\{[^}]*\}/) || [""])[0];
    ok(/padding-right:calc\(10px \+ var\(--calha/.test(bloco),
       "F1 a camada colorida nao reserva a largura da barra de rolagem");
    ok(!/scrollbar-width:\s*none/.test(bloco),
       "F2 scrollbar-width:none volta a cancelar a reserva da calha");

    /* F5 — a regua da bancada do edital tem de ficar NA FRENTE do campo.
     * O bloco usa "editor-wrap ed-wrap" ao mesmo tempo: ".editor-wrap
     * textarea" da z-index:1 ao campo e ".ed-wrap textarea", que vem
     * depois, devolve fundo opaco. Sem z-index na regua, ela e desenhada,
     * fica atras e some — foi o "a bancada do edital nao tem linhas
     * numeradas". Nem o HTML nem o console acusam nada. */
    {
      /* Ha mais de uma regra citando #editalNums (uma compartilhada com o
       * textarea, outra so da regua) e ainda comentarios pelo meio. Regex
       * sobre CSS erra facil — este teste ja me deu dois falsos negativos.
       * Aqui a leitura e boba e correta: corta o CSS nos "}", e de cada
       * pedaco separa o seletor do corpo. */
      const cssBruto = (CSS.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join("\n");
      const regras = cssBruto.replace(/\/\*[\s\S]*?\*\//g, "").split("}")
        .map((p) => {
          const k = p.indexOf("{");
          return k < 0 ? null : { sel: p.slice(0, k), corpo: p.slice(k + 1) };
        }).filter(Boolean);
      const zDe = (frag) => regras
        .filter((r) => r.sel.includes(frag))
        .reduce((m, r) => Math.max(m, Number((r.corpo.match(/z-index:\s*(\d+)/) || [, 0])[1])), 0);
      const zTa = zDe(".editor-wrap textarea");
      const zNum = zDe("#editalNums");
      ok(zNum > zTa,
         `F5 a regua do edital (z-index ${zNum}) fica atras do campo (${zTa}) e some`);
      /* a regua dos CARTOES corre o mesmo risco e nao tinha guarda nenhuma:
       * descobri isso sabotando a regra errada e vendo o teste passar */
      const zCart = zDe("#editorNums");
      ok(zCart > zTa,
         `F5b a regua dos cartoes (z-index ${zCart}) fica atras do campo (${zTa})`);
      ok(/#editalNums \.lnum|,#editalNums \.lnum/.test(CSS),
         "F6 as linhas do edital nao tem metrica propria e desalinham do texto");
    }

    /* F4 — classe usada no HTML sem regra de CSS não dá erro em lugar
     * nenhum: o elemento simplesmente aparece cru. Foi assim que o painel
     * de diagnóstico perdeu TODO o estilo na v8.59, quando a reescrita do
     * CSS dos modos cortou um intervalo que continha esse bloco. */
    const estilos = (CSS.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join("\n");
    const usadas = new Set();
    (CSS.match(/class="[^"]+"/g) || []).forEach((m) => {
      m.slice(7, -1).split(/\s+/).forEach((c) => { if (c) usadas.add(c); });
    });
    /* estas três são posicionadas por id ou por seletor composto */
    const TOLERADAS = ["rotulo", "sugestoes", "ui-box"];
    const orfas = [...usadas].filter((c) =>
      !TOLERADAS.includes(c) && !estilos.includes("." + c));
    ok(orfas.length === 0,
       `F4 classe(s) sem regra de CSS: ${orfas.slice(0, 6).join(", ")}`);
    /* e as do diagnóstico por nome, porque foram as que já se perderam */
    ["diag-pre", "diag-legenda", "diag-alvo", "diag-modal"].forEach((c) =>
      ok(estilos.includes("." + c), `F4b o CSS de .${c} sumiu de novo`));

    /* F3 — todo botao tem de declarar fundo E cor. Quando ".btn-min" so'
     * dizia tamanho, o botao caia no estilo padrao do navegador (fundo
     * claro) e o texto herdava o claro do tema escuro: claro sobre claro,
     * ilegivel. Nao da' para testar contraste sem renderizar, mas da' para
     * exigir que a cor seja DECLARADA em vez de sorteada. */
    const CSSTXT = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    /* a lista cresce a cada botão novo que nasce sem cor: .ed-card-nome
     * virou <button> na v8.58 e repetiu o defeito de .btn-min */
    ["\\.btn-min", "\\.modo-btn", "\\.bancada-nome", "\\.barra-recuperar",
     "\\.ed-card-nome", "\\.ed-reg", "\\.reg-forma", "\\.ed-aba"].forEach((sel) => {
      const re = new RegExp(sel + "\\{[^}]*\\}");
      const m = CSSTXT.match(re);
      ok(!!m, `F3 nao achei a regra ${sel}`);
      if (!m) return;
      const temFundo = /background/.test(m[0]);
      const temCor = /(^|[;{])\s*color:/.test(m[0]);
      ok(temCor, `F3 ${sel} nao declara a cor do texto`);
      const semFundo = ["\\.bancada-nome", "\\.ed-card-nome"];
      if (!semFundo.includes(sel)) ok(temFundo, `F3 ${sel} nao declara o fundo`);
    });

    ok(!!api.$("bancadaNome"), "E1 a bancada nao tem elemento de nome");
    ok((api.t("bancada_cartoes") || "").trim().length > 2,
       "E2 a bancada esta sem nome traduzido");
    const b = api.$("btnAmpliar");
    const r0 = b.textContent;
    b.onclick();
    const r1 = b.textContent;
    b.onclick();
    ok(r0 !== r1, "E3 o rotulo nao mudou ao ampliar");
    ok(b.textContent === r0, "E4 o botao nao voltou ao rotulo original");

    api.$("editor").value = TEXTO;   // devolve o editor como estava

    return falhas;
  });
  }
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "tela", 60000).then((falhas) => {
    falhas.forEach((f) => console.log("  FALHA  " + f));
    console.log(falhas.length
      ? `\ntela: ${falhas.length} FALHA(S)\n`
      : "\ntela: revisão, prompt de correção e foco, recortes, bandeja e repetidas ok (213 verificações)\n");
    process.exit(falhas.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
