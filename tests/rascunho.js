/* RASCUNHO — o papel de lado da questão.
 *
 * O que precisa valer aqui não é "a função foi chamada", é o que a
 * pessoa vê: o quadro começa fechado, a caneta que ela escolheu é a cor
 * que sai, a borracha tira o risco e o desfazer traz de volta, o
 * desenho fica na SUA questão e não vaza para a seguinte, e nada é
 * guardado sem ela mandar. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const traco = (api, pontos) => {
    api.rsComecar({ clientX: pontos[0][0], clientY: pontos[0][1] });
    pontos.slice(1).forEach((p) => api.rsMover({ clientX: p[0], clientY: p[1] }));
    api.rsSoltar();
  };
  const riscos = (api) => {
    const av = api.$("rsAviso").textContent || "";
    const m = av.match(/^(\d+)/);
    return m ? Number(m[1]) : 0;
  };

  /* ---- R1: nasce fechado e vinculado à questão ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    ok(api.$("rsCaixa").hidden === true,
       "R1 sem questao aberta o rascunho nao devia estar na tela");
    api.rsPrepararPara("q1");
    ok(api.$("rsCaixa").hidden === false, "R1b com questao aberta falta a barra do rascunho");
    ok(api.$("rsCorpo").hidden === true,
       "R1c o quadro abriu sozinho — o pedido era ficar fechado por padrao");
    ok(/abrir/i.test(api.$("btnRsMin").textContent),
       "R1d o botao devia convidar a ABRIR: " + api.$("btnRsMin").textContent);

    /* recolhido nao aceita risco: caso contrario um toque na tela por
     * baixo do quadro fechado desenharia sem ninguem ver */
    traco(api, [[10, 10], [40, 40]]);
    ok(riscos(api) === 0, "R1e desenhou com o quadro fechado");

    api.$("btnRsMin").onclick();
    ok(api.$("rsCorpo").hidden === false, "R1f o botao nao abriu o quadro");
    ok(/recolher/i.test(api.$("btnRsMin").textContent),
       "R1g aberto, o botao devia oferecer recolher");
    traco(api, [[10, 10], [40, 40]]);
    ok(riscos(api) === 1, "R1h com o quadro aberto o traco nao entrou");
    api.$("btnRsMin").onclick();
    ok(api.$("rsCorpo").hidden === true, "R1i nao recolheu");
    ok(riscos(api) === 1, "R1j recolher APAGOU o desenho — recolher nao e limpar");
  }

  /* ---- R2: as quatro canetas pintam nas quatro cores ---- */
  {
    const { api } = rodar();
    api.rsIniciar(); api.rsPrepararPara("q1"); api.rsRecolher(false);
    const cv = api.$("rsTela");
    const cores = { preta: "#151515", azul: "#1a4fd6",
                    vermelha: "#d62828", verde: "#128a3a" };
    Object.keys(cores).forEach((nome) => {
      const b = api.rsFerramenta(nome);
      ok(!!b, "R2 falta a caneta " + nome);
      if (!b) return;
      b.onclick();
      ok(/rs-sel/.test(b.className || ""),
         "R2b a caneta " + nome + " nao se marca como escolhida");
      const antes = cv.getContext("2d").ops.length;
      traco(api, [[20, 20], [50, 50]]);
      const pintou = cv.getContext("2d").ops.slice(antes)
        .filter((o) => o[0] === "stroke");
      ok(pintou.length > 0, "R2c a caneta " + nome + " nao pintou nada na tela");
      /* cada repintura redesenha a folha inteira: o traco NOVO e o
       * ultimo de cada passada, e e ele que tem de sair na cor pedida */
      const ultima = pintou[pintou.length - 1];
      ok(ultima && ultima[1] === cores[nome],
         "R2d a caneta " + nome + " pintou de outra cor: "
         + JSON.stringify(ultima && ultima[1]));
    });
    ok(riscos(api) === 4, "R2e deviam ser 4 riscos, um por caneta");

    /* trocar de caneta nao repinta o que ja estava escrito */
    api.rsFerramenta("preta").onclick();
    const todas = cv.getContext("2d").ops.filter((o) => o[0] === "stroke")
      .slice(-4).map((o) => o[1]);
    ok(new Set(todas).size === 4,
       "R2f trocar de caneta reescreveu os tracos antigos na cor nova: "
       + JSON.stringify(todas));
  }

  /* ---- R3: borracha e desfazer ---- */
  {
    const { api } = rodar();
    api.rsIniciar(); api.rsPrepararPara("q1"); api.rsRecolher(false);
    traco(api, [[10, 10], [30, 30]]);
    traco(api, [[200, 200], [230, 230]]);
    ok(riscos(api) === 2, "R3 deviam existir 2 riscos");

    const bb = api.rsFerramenta("borracha");
    ok(!!bb, "R3b falta a borracha");
    bb.onclick();
    ok(/rs-sel/.test(bb.className || ""), "R3c a borracha nao mostra que esta ligada");
    /* encostar LONGE nao pode apagar nada */
    api.rsComecar({ clientX: 500, clientY: 400 }); api.rsSoltar();
    ok(riscos(api) === 2, "R3d a borracha apagou um risco em que nem encostou");
    /* encostar em cima do primeiro apaga so ele */
    api.rsComecar({ clientX: 12, clientY: 12 }); api.rsSoltar();
    ok(riscos(api) === 1, "R3e a borracha nao apagou o risco em que encostou");

    api.$("btnRsDesfazer").onclick();
    ok(riscos(api) === 2, "R3f desfazer nao trouxe de volta o que a borracha levou");

    /* limpar tudo pergunta antes, e o "nao" tem de valer */
    api.rsFerramenta("preta").onclick();
    const l1 = api.rsLimpar();
    ok(api.uiPerguntando() === true,
       "R3g limpar tudo nao perguntou nada antes de apagar");
    api.uiModalResponder(false);
    await l1;
    ok(riscos(api) === 2, "R3g2 respondi NAO e limpou assim mesmo");
    const l2 = api.rsLimpar();
    api.uiModalResponder(true);
    await l2;
    ok(riscos(api) === 0, "R3h respondi SIM e nao limpou");
    api.$("btnRsDesfazer").onclick();
    ok(riscos(api) === 2,
       "R3i limpar tudo virou perda definitiva — o desfazer tem de alcancar");
  }

  /* ---- R4: o rascunho e DA questao, e so entra nela se eu mandar ---- */
  {
    const { api } = rodar();
    api.rsIniciar(); api.rsPrepararPara("q1"); api.rsRecolher(false);
    traco(api, [[10, 10], [40, 40]]);
    ok(/ainda n/i.test(api.$("rsAviso").textContent || ""),
       "R4 o aviso devia deixar claro que nada foi guardado ainda");
    ok(api.rsQuantosSalvos() === 0,
       "R4b guardou sozinho — o pedido era guardar so a pedido do usuario");

    api.$("btnRsSalvar").onclick();
    api.uiModalResponder(true);   /* dispensa o aviso de "guardado" */
    ok(api.rsQuantosSalvos() === 1, "R4c mandei salvar e nao salvou");
    ok(!!api.rsDaQuestao("q1"), "R4d o salvo nao ficou na questao q1");
    ok(/guardado/i.test(api.$("rsAviso").textContent || ""),
       "R4e depois de salvar o aviso continua dizendo que nao salvou");

    /* DESENHAR DEPOIS DE SALVO volta a valer como pendente.
     * Sem isto o segundo desenho parecia guardado, ninguem perguntava
     * nada na saida, e ele sumia — a perda mais silenciosa possivel:
     * a tela dizia "guardado". */
    traco(api, [[100, 100], [140, 140]]);
    ok(/ainda n/i.test(api.$("rsAviso").textContent || ""),
       "R4e2 desenhei depois de salvar e a tela continuou dizendo 'guardado'");
    ok(api.rsPrecisaPerguntar() === true,
       "R4e3 o desenho novo sairia sem ninguem perguntar nada");
    const sv = api.rsGuardarSeSair();
    const pv = api.uiPerguntando();
    if (pv) api.uiModalResponder(true);
    await sv;
    api.uiModalResponder(true);
    ok(pv === true, "R4e4 sair depois de desenhar de novo nao perguntou");
    ok((api.rsDaQuestao("q1") || { tracos: [] }).tracos.length === 2,
       "R4e5 o segundo desenho nao entrou no guardado");
    api.rsApagarEm(110, 110);
    api.$("btnRsSalvar").onclick();
    api.uiModalResponder(true);

    /* trocar de questao troca o papel */
    api.rsPrepararPara("q2");
    ok(riscos(api) === 0,
       "R4f o desenho da q1 apareceu por cima da q2");
    ok(api.rsDaQuestao("q2") === null, "R4g a q2 ganhou um rascunho que nao e dela");

    /* voltar a q1 traz o dela de volta, mas ainda fechado */
    api.rsPrepararPara("q1");
    ok(riscos(api) === 1, "R4h voltei a q1 e o rascunho guardado nao voltou");
    ok(api.$("rsCorpo").hidden === true,
       "R4i o quadro abriu sozinho ao voltar — pode entregar o esquema da resposta");

    /* apagar o guardado, com confirmacao */
    api.rsRecolher(false);
    ok(api.$("btnRsApagarSalvo").hidden === false,
       "R4j falta a saida para apagar o rascunho guardado");
    const a1 = api.rsApagarSalvo();
    ok(api.uiPerguntando() === true, "R4k apagar o guardado nao pediu confirmacao");
    api.uiModalResponder(false);
    await a1;
    ok(api.rsQuantosSalvos() === 1, "R4k2 respondi NAO e apagou o guardado");
    const a2 = api.rsApagarSalvo();
    api.uiModalResponder(true);
    await a2;
    ok(api.rsQuantosSalvos() === 0, "R4l respondi SIM e o guardado ficou");
  }

  /* ---- R5: sair com rabisco na tela pergunta antes ---- */
  {
    const { api } = rodar();
    api.rsIniciar(); api.rsPrepararPara("q1"); api.rsRecolher(false);
    traco(api, [[10, 10], [40, 40]]);
    const s1 = api.rsGuardarSeSair();
    ok(api.uiPerguntando() === true,
       "R5 sair com desenho na tela nao perguntou nada — perder calado tambem e decidir por mim");
    api.uiModalResponder(false);
    await s1;
    ok(api.rsQuantosSalvos() === 0, "R5b disse para nao guardar e guardou");

    const s2 = api.rsGuardarSeSair();
    api.uiModalResponder(true);
    await s2;
    api.uiModalResponder(true);   /* aviso de guardado */
    ok(api.rsQuantosSalvos() === 1, "R5c disse para guardar e nao guardou");

    /* ja guardado: nao perguntar de novo a cada questao */
    /* NUNCA esperar por uma promessa que talvez nunca resolva: se ela
     * perguntar e ninguem responder, o teste TRAVA — e travado ele sai
     * calado, com codigo de sucesso. Descobri isto sabotando. */
    const s3 = api.rsGuardarSeSair();
    const p3 = api.uiPerguntando();
    if (p3) api.uiModalResponder(false);
    await s3;
    ok(p3 === false, "R5d perguntou de novo mesmo estando tudo guardado");

    /* quadro em branco tambem nao pergunta nada */
    api.rsPrepararPara("q9");
    const s4 = api.rsGuardarSeSair();
    const p4 = api.uiPerguntando();
    if (p4) api.uiModalResponder(false);
    await s4;
    ok(p4 === false, "R5e perguntou sobre um quadro vazio");
  }

  /* ---- R6: dentro da sessao de questoes ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const c6 = api.matChave("D", "T");
    api.matGravar(c6, "x", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.qsAplicar(api.qsLerResposta(
      "? CE :: FGV :: Primeira afirmacao da rodada.\n= C :: comentario um.\n"
      + "? CE :: FGV :: Segunda afirmacao da rodada.\n= E :: comentario dois.",
      { disciplina: "D", topico: "T", chave: c6 }).achados);
    ok(api.qsFiltrar({}).length === 2, "R6 as duas questoes nao entraram");
    api.qsUiResponderDoTopico();
    ok(api.$("rsCaixa").hidden === false,
       "R6b a sessao de questoes abriu sem o rascunho a mao");
    ok(api.$("rsCorpo").hidden === true, "R6c o rascunho abriu expandido na sessao");

    api.rsRecolher(false);
    traco(api, [[10, 10], [40, 40]]);
    ok(riscos(api) === 1, "R6d nao consegui desenhar dentro da sessao");

    /* responder repinta a tela: o rascunho da questao NAO pode sumir */
    api.$("qsSessCorpo").querySelectorAll(".qs-op")[0].onclick();
    ok(riscos(api) === 1,
       "R6e responder apagou o rascunho que serviu para resolver a questao");

    /* passar para a proxima pergunta sobre guardar, e depois zera */
    const pr = api.$("btnQsProxima").onclick();
    ok(api.uiPerguntando() === true,
       "R6f virei a questao com rabisco na tela e ninguem me perguntou nada");
    api.uiModalResponder(true);
    await pr;
    await new Promise((r) => setTimeout(r, 0));
    api.uiModalResponder(true);
    ok(api.rsQuantosSalvos() === 1,
       "R6f2 mandei guardar ao virar a questao e nao guardou");
    ok(riscos(api) === 0, "R6g o desenho da questao 1 seguiu para a questao 2");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "rascunho", 60000).then((r) => {
    const f = r;
    f.forEach((m) => console.log("  FALHA  " + m));
    console.log(f.length ? `\nrascunho: ${f.length} FALHA(S)\n`
      : `\nrascunho: o papel de lado ok (${f.quantas} verificacoes)\n`);
    process.exit(f.length ? 1 : 0);
  });
}
