/* Questões pela TELA: do resumo até responder, e a aba.
 * O que se testa aqui é o caminho do clique — as funções por baixo já têm
 * o seu próprio arquivo. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* os atalhos sairam da linha e foram para o "⋮": quatro icones por
   * linha, dez linhas na semana, quarenta alvos sem palavra nenhuma.
   * Dentro do menu cabe escrever o que cada um faz. */
  const noMenu = (linha, re) => {
    let mais = null;
    const anda = (x) => (x.children || []).forEach((f) => {
      if ((f.className || "").split(/\s+/).includes("ed-mais") && !mais) mais = f;
      anda(f);
    });
    anda(linha);
    if (!mais) return null;
    mais.onclick({ stopPropagation() {} });
    let alvo = null;
    const anda2 = (x) => (x.children || []).forEach((f) => {
      if (/ed-menu-item/.test(f.className || "") && re.test(f.textContent || "")
          && !alvo) alvo = f;
      anda2(f);
    });
    anda2(linha);
    return alvo;
  };


  const { api } = rodar();
  api.matIniciar(); api.qsUiIniciar();
  const ch = api.matChave("Direito Financeiro", "Leis Orcamentarias");
  api.matGravar(ch, "Questao 2 (Cebraspe): A vedacao de inscricao e valida?",
    { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias", concurso: "TCE-PE" });
  api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");

  /* U1 — sem questão, o botão diz isso e não engana */
  ok(api.$("btnMatQuestoes").hidden === false, "U1 o botao de questoes sumiu do resumo");
  ok(/sem quest/.test(api.$("btnMatQuestoes").textContent),
     "U1b sem questoes, o botao devia dizer que nao ha");
  /* botao vivo mesmo com zero: leva a CRIAR, em vez de ser um beco */
  ok(api.$("btnMatQuestoes").disabled === false,
     "U1c botao sem questoes ficou morto em vez de levar a criar");

  /* U2 — virar seleção em questão monta o prompt com o contexto */
  api.matPorSelecao("A vedacao de inscricao e valida?");
  api.qsUiVirarSelecao();
  ok(api.$("dlgQsCriar").open === true, "U2 a janela de criar nao abriu");
  const pr = api.$("qsCriarPrompt").value;
  ok(/Direito Financeiro/.test(pr), "U2b o prompt nao diz a disciplina");
  ok(/Leis Orcamentarias/.test(pr), "U2c o prompt nao diz o topico");
  ok(/vedacao de inscricao/.test(pr), "U2d o prompt nao leva o trecho selecionado");
  ok(/\[QUESTAO\]/.test(pr) && /GABARITO:/.test(pr) && /COMENTARIO:/.test(pr),
     "U2e o prompt nao ensina o formato de campos nomeados");
  ok(/TIPO: CE/.test(pr) && /ME = m/.test(pr),
     "U2e2 o prompt nao explica o que e CE e o que e ME");
  /* este texto nao tem questao escrita, entao nao ha o que gravar ainda */
  ok(api.$("btnQsCriarAplicar").disabled === true,
     "U2f o botao de gravar nasce liberado, sem nada conferido");
  ok(api.$("qsIA").open === true,
     "U2g sem questao no texto, o bloco da IA devia nascer aberto");

  /* U3 — conferir mostra o que entendeu E o que recusou */
  api.$("qsCriarResposta").value = [
    "? CE :: Cebraspe :: A vedacao de inscricao em restos a pagar e valida.",
    "= E :: O modelo federal preve a inscricao (ADI 7493).",
    "? ME :: FGV :: Qual o fundamento do STF?",
    "A) PPA", "B) Transparencia", "C) TCU",
    "= B :: Postulados republicanos.",
    "",
    "? ME :: FGV :: Questao quebrada, gabarito fora das opcoes",
    "A) uma", "B) outra",
    "= D :: nada",
  ].join("\n");
  api.qsUiConferir();
  ok(api.$("qsCriarConf").querySelectorAll(".qs-conf").length === 3,
     "U3 a conferencia nao listou tudo");
  ok(api.$("qsCriarConf").querySelectorAll(".qs-conf-ruim").length === 1,
     "U3b a questao quebrada nao apareceu como recusada");
  ok(/gabarito/.test(api.$("qsCriarConf").querySelector(".qs-conf-ruim").textContent),
     "U3c a recusa nao diz o motivo");
  ok(api.$("btnQsCriarAplicar").disabled === false,
     "U3d depois de conferir, gravar continua bloqueado");

  /* U4 — gravar, e o resumo passa a saber */
  api.qsUiAplicar();
  ok(api.qsTodas().length === 2, `U4 gravou ${api.qsTodas().length} em vez de 2`);
  ok(api.qsTodas().every((q) => q.chave === ch && q.concurso !== undefined),
     "U4b a questao nao guardou de qual topico veio");
  api.qsUiPintarBotaoResumo();
  ok(/2/.test(api.$("btnMatQuestoes").textContent),
     "U4c o botao do resumo nao mostrou a contagem");
  ok(api.$("btnMatQuestoes").disabled === false, "U4d o botao continuou desabilitado");
  ok(api.$("qsDesfazer").hidden === false, "U4e nao ofereceu desfazer");

  /* U5 — responder pelo resumo: gabarito só depois de escolher */
  api.qsUiResponderDoTopico();
  ok(api.$("dlgQsResponder").open === true, "U5 a sessao nao abriu");
  ok(api.$("qsSessCorpo").querySelectorAll(".qs-gab").length === 0,
     "U5b o gabarito apareceu ANTES de responder");
  ok(api.$("btnQsProxima").disabled === true,
     "U5c deu para pular sem responder");
  const ops = api.$("qsSessCorpo").querySelectorAll(".qs-op");
  ok(ops.length >= 2, "U5d a questao veio sem opcoes para escolher");
  ops[0].onclick();
  ok(api.$("qsSessCorpo").querySelectorAll(".qs-gab").length === 1,
     "U5e o gabarito nao apareceu depois de responder");
  ok(api.$("qsSessCorpo").querySelectorAll(".qs-op").every((b) => b.disabled),
     "U5f depois de responder ainda dava para trocar a resposta");
  ok(api.$("btnQsProxima").disabled === false, "U5g nao liberou a proxima");
  ok(api.$("qsSessCorpo").querySelectorAll(".qs-op-certa").length === 1,
     "U5h nao marcou qual era a certa");

  /* U6 — a sequência anda e termina */
  api.$("btnQsProxima").onclick();
  ok(api.$("qsSessCorpo").querySelectorAll(".qs-enunciado").length === 1,
     "U6 nao foi para a segunda questao");
  api.$("qsSessCorpo").querySelectorAll(".qs-op")[0].onclick();
  api.$("btnQsProxima").onclick();
  ok(api.$("qsSessCorpo").querySelectorAll(".qs-fim").length === 1,
     "U6b a sessao nao mostrou o resultado no fim");
  ok(api.$("btnQsProxima").hidden === true, "U6c continuou oferecendo proxima no fim");

  /* U7 — a aba lista, filtra e conta */
  api.qsUiRender();
  ok(api.$("qsLista").querySelectorAll(".qs-item").length === 2,
     "U7 a aba nao listou as questoes");
  ok(/2 de 2/.test(api.$("qsResumo").textContent), "U7b o resumo da aba errou a conta");
  ok(api.$("qsLista").querySelectorAll(".qs-item-hist").length === 2,
     "U7c a aba nao mostra o historico de quem ja respondeu");
  api.$("qsFTipo").value = "ce";
  api.qsUiLerFiltros();
  ok(api.$("qsLista").querySelectorAll(".qs-item").length === 1,
     "U7d o filtro por tipo nao funcionou");
  api.$("qsFTipo").value = "";
  api.$("qsFErradas").checked = true;
  api.qsUiLerFiltros();
  const nErradas = api.$("qsLista").querySelectorAll(".qs-item").length;
  ok(nErradas >= 0 && nErradas <= 2, "U7e o filtro de erradas devolveu coisa impossivel");
  api.$("qsFErradas").checked = false;
  api.qsUiLerFiltros();

  /* U8 — desfazer tira o que acabou de entrar */
  api.qsUiDesfazer();
  ok(api.qsTodas().length === 0, "U8 desfazer nao tirou as questoes");
  api.qsUiPintarBotaoResumo();
  ok(/sem quest/.test(api.$("btnMatQuestoes").textContent),
     "U8b o botao do resumo nao voltou a dizer que nao ha questoes");

  /* ---- D2/D3 pela tela: modo prova e importacao ---- */
  {
    const { api: a2 } = rodar();
    a2.matIniciar(); a2.qsUiIniciar();
    const c2 = a2.matChave("Direito Financeiro", "Leis Orcamentarias");
    const T = [
      "**Questao 2 (Cebraspe - Procurador):** A vedacao de inscricao e valida?",
      "- **Resposta: Nao.** O modelo federal preve a possibilidade (ADI 7493).",
      "",
      "**Questao 3 (FGV - Juiz):** Qual o fundamento? A) PPA. B) Transparencia. C) TCU.",
      "",
      "* **Resposta: B.** O argumento central da Ministra Rosa Weber.",
      "",
      "Texto comum que fica como esta.",
    ].join("\n");
    a2.matGravar(c2, T, { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
    a2.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");

    /* P1 — desligado, o resumo e o de sempre */
    ok(a2.$("btnMatProva").hidden === false, "P1 o botao do modo prova nao apareceu");
    ok(/2/.test(a2.$("btnMatProva").textContent),
       "P1b o botao nao diz quantas questoes ha no texto");
    ok(a2.$("matLeitura").querySelectorAll(".qp").length === 0,
       "P1c desligado, ja desenhou cartao de questao");
    ok(/Resposta: Nao/.test(a2.$("matLeitura").textContent),
       "P1d desligado, a resposta devia estar a vista");

    /* P2 — ligado, esconde o gabarito e mantem o resto do texto */
    a2.matAlternarProva();
    const L = a2.$("matLeitura");
    ok(L.querySelectorAll(".qp").length === 2, "P2 nao desenhou os dois cartoes");
    ok(!/Resposta: Nao/.test(L.textContent) && !/ADI 7493/.test(L.textContent),
       "P2b o gabarito e o comentario continuaram a vista");
    ok(/Texto comum que fica como esta/.test(L.textContent),
       "P2c o texto que nao e questao sumiu junto");
    ok(L.querySelectorAll(".qp-op").length === 5,
       "P2d faltaram botoes de resposta (2 do CE + 3 do ME)");
    ok(L.querySelectorAll(".qp-gab").length === 0,
       "P2e mostrou o gabarito antes de responder");

    /* P3 — responder revela, com o comentario RECOLHIDO */
    a2.matProvaResponder(0, "C");
    const L2 = a2.$("matLeitura");
    ok(L2.querySelectorAll(".qp-gab").length === 1, "P3 nao revelou o gabarito");
    ok(/Errou/.test(L2.querySelector(".qp-gab").textContent),
       "P3b respondi errado e ele nao disse");
    ok(L2.querySelectorAll(".qp-certa").length === 1, "P3c nao marcou a certa");
    ok(L2.querySelectorAll(".qp-errada").length === 1, "P3d nao marcou a minha");
    const cm = L2.querySelector(".qp-cm");
    ok(!!cm && !cm.open, "P3e o comentario devia vir RECOLHIDO");
    ok(/ADI 7493/.test(cm.textContent), "P3f o comentario ficou de fora do bloco");
    ok(L2.querySelectorAll(".qp-op").every((b) => b.disabled || !b.dataset || b.dataset.qp !== "0"),
       "P3g depois de responder ainda dava para trocar");

    /* P4 — desligar devolve o texto, e o texto nunca foi alterado */
    a2.matAlternarProva();
    ok(/Resposta: Nao/.test(a2.$("matLeitura").textContent),
       "P4 desligar nao devolveu o resumo como estava");
    ok(a2.matResumosAtual()[c2].texto === T,
       "P4b o modo prova ALTEROU o texto guardado");

    /* P5 — UMA porta so: abrir a criacao ja traz o que esta no texto */
    ok(a2.qsTodas().length === 0, "P5 o banco devia estar vazio antes");
    a2.matPorSelecao("");
    a2.qsUiVirarSelecao();
    ok(a2.$("dlgQsCriar").open === true, "P5b a criacao nao abriu");
    ok(a2.$("qsCriarConf").querySelectorAll(".qs-conf").length === 2,
       "P5c as questoes ja escritas no texto nao vieram prontas");
    ok(/2/.test(a2.$("qsDoTextoAviso").textContent),
       "P5d nao avisou quantas achou no proprio texto");
    ok(a2.$("qsIA").open === false,
       "P5e com questoes prontas, o bloco da IA devia nascer fechado");
    ok(a2.$("qsCriarPrompt").value.length > 50,
       "P5f o prompt da IA nao ficou pronto para quem quiser mais");
    ok(a2.$("btnQsCriarAplicar").disabled === false,
       "P5g o botao de gravar devia estar liberado, ja ha o que gravar");
    a2.qsUiAplicar();
    ok(a2.qsTodas().length === 2, "P5h nao gravou as duas");
    ok(a2.qsTodas().every((q) => q.origem === "texto"),
       "P5i nao marcou que vieram do texto");
    a2.qsUiVirarSelecao(); a2.qsUiAplicar();
    ok(a2.qsTodas().length === 2, "P5j abrir e gravar de novo duplicou o banco");

    /* P6 — a IA SOMA as suas as do texto, sem apagar nem duplicar */
    a2.qsUiVirarSelecao();
    a2.$("qsCriarResposta").value = [
      "? CE :: Cebraspe :: A vedacao de inscricao e valida?",
      "= E :: repetida, ja esta no texto.",
      "? CE :: FGV :: Uma questao inteiramente nova sobre outro ponto.",
      "= C :: comentario novo.",
    ].join("\n");
    a2.qsUiConferir();
    ok(a2.$("qsCriarConf").querySelectorAll(".qs-conf").length === 3,
       "P6 a IA devia SOMAR a nova as duas do texto, sem repetir a igual");

    /* P7 — sem questao no topico, o botao leva a criar em vez de nao fazer nada */
    const { api: a3 } = rodar();
    a3.matIniciar(); a3.qsUiIniciar();
    a3.matGravar(a3.matChave("D", "Vazio"), "Texto qualquer sem questao nenhuma.",
      { disciplina: "D", topico: "Vazio" });
    a3.matAbrirEditor({ disciplina: "D", nome: "Vazio" }, "ler");
    ok(a3.$("btnMatQuestoes").disabled === false,
       "P7 o botao de questoes ficou morto quando nao ha questao");
    a3.qsUiResponderDoTopico();
    ok(a3.$("dlgQsCriar").open === true,
       "P7b sem questoes, o botao devia levar a criar");
    ok(a3.$("qsIA").open === true,
       "P7c sem nada no texto, o bloco da IA devia nascer ABERTO");
  }

  /* ---- T1: nenhum texto do app pode ter barra-n LITERAL ----
   * Escrito "\\\\n" no arquivo, o JS guarda os dois caracteres em vez de uma
   * quebra de linha: o prompt virava uma linha unica gigante e as
   * confirmacoes mostravam "\\n" na cara do usuario. Havia 20 assim.
   * A verificacao e sobre o valor EM TEMPO DE EXECUCAO, que e o que a
   * pessoa le — no arquivo, o certo e o errado se parecem demais. */
  {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const chaves = [...src.matchAll(/^\s*"([\w_]+)":\s*"/gm)].map((m) => m[1]);
    ok(chaves.length > 100, "T1 nao consegui listar as chaves de texto");
    const ruins = [];
    chaves.forEach((k) => {
      let v = "";
      try { v = api.t(k, { n: 1, c: 1, e: "x", texto: "y", disciplina: "d",
                           topico: "t", concurso: "c", g: "C", tp: "x" }); }
      catch (e) { return; }
      if (String(v).indexOf("\\n") >= 0) ruins.push(k);
    });
    ok(ruins.length === 0, "T1b textos com barra-n literal: " + ruins.join(", "));
  }

  /* ---- F1: de onde a IA parte — resumo ou material externo ---- */
  {
    const { api: a4 } = rodar();
    a4.matIniciar(); a4.qsUiIniciar();
    const c4 = a4.matChave("Direito Financeiro", "Leis Orcamentarias");
    a4.matGravar(c4, "Texto do resumo sobre emendas parlamentares.",
      { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
    a4.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
    a4.matPorSelecao("");
    a4.qsUiVirarSelecao();

    ok(a4.$("qsFonteResumo").checked === true, "F1 a fonte padrao devia ser o resumo");
    ok(a4.$("qsCriarFonte").hidden === true,
       "F1b a caixa de material externo devia comecar escondida");
    ok(/emendas parlamentares/.test(a4.$("qsCriarPrompt").value),
       "F1c o prompt nao usou o texto do resumo");

    a4.$("qsFonteResumo").checked = false;
    a4.$("qsFonteOutro").checked = true;
    a4.$("qsFonteOutro").onchange();
    /* material de fora NAO passa pelo app: o que se copia sao as
     * INSTRUCOES, e a pessoa junta com o material onde ele ja esta */
    ok(a4.$("qsCriarFonte").hidden === true,
       "F1d material externo nao devia pedir colagem dentro do app");
    ok(a4.$("qsFonteNota").hidden === false,
       "F1e faltou explicar que so as instrucoes sao copiadas");
    ok(a4.$("btnQsCopiarPrompt").disabled === false,
       "F1f copiar as instrucoes devia estar sempre liberado");
    const p = a4.$("qsCriarPrompt").value;
    ok(!/emendas parlamentares/.test(p),
       "F1g as instrucoes levaram junto o texto do resumo");
    ok(/cole aqui o material/i.test(p),
       "F1h as instrucoes nao dizem onde o material entra");
    ok(/Direito Financeiro/.test(p) && /Leis Orcamentarias/.test(p),
       "F1i perdeu disciplina e topico ao trocar de fonte");
    ok(!!a4.$("btnQsColar"), "F1j falta o botao de colar a resposta da IA");

    /* F1j — o VINCULO nao depende da fonte: material de fora, mesma gaveta.
     * E disto que dependem os filtros da aba de questoes depois. */
    ok(/Direito Financeiro/.test(a4.$("qsCriarDe").textContent),
       "F1j a tela nao diz onde as questoes vao ficar guardadas");
    a4.$("qsCriarResposta").value = [
      "? CE :: FGV :: Questao vinda de material externo.",
      "= C :: comentario.",
    ].join("\n");
    a4.qsUiConferir();
    a4.qsUiAplicar();
    const nova = a4.qsTodas().filter((q) => /material externo/.test(q.enunciado))[0];
    ok(!!nova, "F1k a questao do material externo nao foi gravada");
    ok(nova.chave === c4, "F1l perdeu o topico por vir de fora");
    ok(nova.disciplina === "Direito Financeiro", "F1m perdeu a disciplina");
    ok(nova.topico === "Leis Orcamentarias", "F1n perdeu o nome do topico");
    /* e os filtros da aba encontram */
    ok(a4.qsFiltrar({ disciplina: "Direito Financeiro" }).length >= 1,
       "F1o o filtro por disciplina nao acha a questao de material externo");
    ok(a4.qsFiltrar({ chave: c4 }).length >= 1,
       "F1p o filtro por topico nao acha");
    ok(a4.qsFiltrar({ banca: "FGV" }).length >= 1, "F1q o filtro por banca nao acha");
  }

  /* ---- F2: o botao do gabarito diz COMO ESTA, nao so o que faz ---- */
  {
    const { api: a5 } = rodar();
    a5.matIniciar(); a5.qsUiIniciar();
    const c5 = a5.matChave("D", "T");
    a5.matGravar(c5, ["**Questao 1 (FGV):** Enunciado qualquer?",
                      "* **Resposta: Sim.** Comentario."].join("\n"),
      { disciplina: "D", topico: "T" });
    a5.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");

    const off = a5.$("btnMatProva");
    ok(off.hidden === false, "F2 o botao sumiu mesmo havendo questao no texto");
    ok(/vista/.test(off.textContent),
       "F2b desligado, o rotulo devia dizer que o gabarito esta a vista: "
       + off.textContent);
    ok(off.getAttribute("aria-pressed") === "false", "F2c aria-pressed errado quando off");
    ok(!off.classList.contains("mat-ligado"), "F2d pintou de ligado estando desligado");

    a5.matAlternarProva();
    const on = a5.$("btnMatProva");
    ok(/oculto/.test(on.textContent),
       "F2e ligado, o rotulo devia dizer que o gabarito esta OCULTO: " + on.textContent);
    ok(on.getAttribute("aria-pressed") === "true", "F2f aria-pressed errado quando on");
    ok(on.classList.contains("mat-ligado"), "F2g ligado, mas sem marca visual");
    ok(a5.$("matLeitura").querySelectorAll(".qp-op").length === 2,
       "F2h ligado, a questao devia estar no formato de responder");
  }

  /* ---- G1: a dica do usuario na questao ---- */
  {
    const { api: a6 } = rodar();
    a6.matIniciar(); a6.qsUiIniciar();
    const c6 = a6.matChave("D", "T");
    a6.matGravar(c6, "x", { disciplina: "D", topico: "T" });
    a6.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    a6.qsAplicar(a6.qsLerResposta(
      "? CE :: FGV :: Afirmacao para responder.\n= C :: comentario da questao.",
      { disciplina: "D", topico: "T", chave: c6 }).achados);
    a6.qsUiResponderDoTopico();

    /* antes de responder: nem gabarito, nem comentario, nem botao de dica —
     * dica antes da escolha e gabarito disfarcado */
    ok(a6.$("qsSessCorpo").querySelectorAll(".qs-bt-dica").length === 0,
       "G1 o botao de dica apareceu ANTES de responder");
    a6.$("qsSessCorpo").querySelectorAll(".qs-op")[0].onclick();

    /* por RÓTULO, não por posição: um botão novo antes dele mudaria o
     * índice e o teste passaria a clicar em outra coisa sem avisar */
    const bd = a6.$("qsSessCorpo").querySelectorAll("button")
      .filter((b) => /dica/i.test(b.textContent))[0];
    ok(!!bd, "G1b depois de responder, faltou o botao de incluir dica");
    ok(/incluir/.test(bd.textContent), "G1c sem dica ainda, devia dizer incluir");

    const p = bd.onclick();
    a6.$("txtLivreCampo").value = "Macete: 70% capital, 30% custeio.";
    a6.$("btnTxtLivreOk").onclick();
    await Promise.resolve(p).then(() => {
      const q0 = a6.qsTodas()[0];
      ok(q0.dica === "Macete: 70% capital, 30% custeio.",
         "G1d a dica nao ficou guardada na questao");
      const cx = a6.$("qsSessCorpo").querySelector(".qs-minha-dica");
      ok(!!cx && /Macete/.test(cx.textContent),
         "G1e a dica nao aparece na tela depois de responder");
      const bdEd = a6.$("qsSessCorpo").querySelectorAll("button")
        .filter((b) => /dica/i.test(b.textContent))[0];
      ok(/editar/.test(bdEd.textContent),
         "G1f com dica guardada, o botao devia dizer editar: " + bdEd.textContent);
      /* e a dica NAO substitui o comentario da questao */
      ok(/comentario da questao/.test(a6.$("qsSessCorpo").textContent),
         "G1g a dica do usuario apagou o comentario da questao");
      /* sobrevive a fechar e reabrir a sessao */
      a6.$("btnQsSessFechar").onclick();
      a6.qsUiResponderDoTopico();
      a6.$("qsSessCorpo").querySelectorAll(".qs-op")[0].onclick();
      ok(/Macete/.test(a6.$("qsSessCorpo").textContent),
         "G1h a dica sumiu ao reabrir a sessao");
    });
  }

  /* ---- R1: repetidas aparecem ANTES de gravar, com a outra ao lado ----
   * O registro dizia "9 novas · 6 repetidas": seis sumiram na gravacao,
   * depois da conferencia, sem passar por ninguem. Perder trabalho em
   * silencio e pior que gravar duplicata — duplicata da para apagar, o que
   * sumiu ninguem procura. */
  {
    const { api: a7 } = rodar();
    a7.matIniciar(); a7.qsUiIniciar();
    const c7 = a7.matChave("D", "T");
    a7.matGravar(c7, "Texto.", { disciplina: "D", topico: "T" });
    a7.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const EN = "A vedacao de inscricao em restos a pagar para emendas impositivas e valida.";
    a7.qsAplicar(a7.qsLerResposta(
      "[QUESTAO]\nENUNCIADO: " + EN + "\nGABARITO: E\nCOMENTARIO: simetria.\n[/QUESTAO]",
      { disciplina: "D", topico: "T", chave: c7 }).achados);
    ok(a7.qsTodas().length === 1, "R1 preparo: devia haver uma no banco");

    a7.matPorSelecao("");
    a7.qsUiVirarSelecao();
    a7.$("qsCriarResposta").value = [
      "[QUESTAO]", "ENUNCIADO: " + EN, "GABARITO: E", "COMENTARIO: identica.", "[/QUESTAO]",
      "[QUESTAO]", "ENUNCIADO: A vedacao de inscricao em restos a pagar para emendas parlamentares impositivas e valida.",
      "GABARITO: E", "COMENTARIO: quase igual.", "[/QUESTAO]",
      "[QUESTAO]", "ENUNCIADO: As emendas Pix integram a receita para fins de reparticao com outros entes.",
      "GABARITO: E", "COMENTARIO: nova.", "[/QUESTAO]",
      "[QUESTAO]", "ENUNCIADO: Quebrada sem gabarito nenhum.", "[/QUESTAO]",
    ].join("\n");
    a7.qsUiConferir();

    const itens = a7.$("qsCriarConf").querySelectorAll(".qs-conf");
    ok(itens.length === 4,
       `R1b a conferencia devia listar as 3 lidas E a recusada, veio ${itens.length}`);
    const reps = a7.$("qsCriarConf").querySelectorAll(".qs-conf-rep");
    ok(reps.length === 2, `R1c devia apontar 2 repetidas, apontou ${reps.length}`);
    ok(/J[ÁA] EXISTE/i.test(reps[0].querySelector(".qs-conf-aviso").textContent),
       "R1d a identica nao foi avisada como ja existente");
    ok(/PARECIDA/i.test(reps[1].querySelector(".qs-conf-aviso").textContent),
       "R1e a quase-igual nao foi avisada como parecida");
    ok(reps.every((el) => !!el.querySelector(".qs-conf-ja")),
       "R1f avisou que repete mas nao mostrou contra o que");
    ok(reps.every((el) => el.querySelectorAll("input")[0].checked === false),
       "R1g repetida devia vir DESMARCADA, para a pessoa decidir");
    const novas = itens.filter((el) => el.className.indexOf("qs-conf-rep") < 0
      && el.className.indexOf("qs-conf-ruim") < 0);
    ok(novas.length === 1 && novas[0].querySelectorAll("input")[0].checked === true,
       "R1h a questao nova devia vir marcada");
    ok(a7.$("qsCriarConf").querySelectorAll(".qs-conf-ruim").length === 1,
       "R1i a que nao virou questao sumiu da conferencia");
    ok(/sem gabarito/i.test(a7.$("qsCriarConf").querySelector(".qs-conf-ruim").textContent),
       "R1j a recusada nao diz o motivo");
    ok(/1 de 3/.test(a7.$("qsCriarResumo").textContent),
       "R1k o resumo nao diz quantas serao gravadas: " + a7.$("qsCriarResumo").textContent);

    /* grava so o marcado */
    a7.qsUiAplicar();
    /* e o REGISTRO tem de dizer o que ficou de fora, nao so quantas.
     * "6 repetidas" e um numero sem cara: nao da para conferir depois se a
     * decisao foi boa. */
    const ev = a7.matLogAtual().filter((x) => /questões gravadas/.test(x.o || ""))[0];
    ok(!!ev, "R1l0 nao registrou a gravacao");
    ok(/deixadas de fora/.test(ev.d || ""),
       "R1l1 o registro nao diz quantas ficaram de fora: " + (ev && ev.d));
    /* o registro corta o enunciado em 60 caracteres: a verificacao tem de
     * caber nesse pedaco, senao ela reprova um registro que esta certo */
    ok(/vedacao de inscricao em restos a pagar/.test(ev.d || ""),
       "R1l2 o registro nao diz QUAIS ficaram de fora: " + (ev && ev.d));
    ok(/\[igual\]|\[parecida\]/.test(ev.d || ""),
       "R1l3 o registro nao diz por que cada uma ficou de fora");
    ok(a7.qsTodas().length === 2, `R1l devia gravar so a nova, ficou com ${a7.qsTodas().length}`);

    /* e se a pessoa MARCAR uma repetida, a decisao dela vale */
    a7.matPorSelecao("");
    a7.qsUiVirarSelecao();
    a7.$("qsCriarResposta").value =
      "[QUESTAO]\nENUNCIADO: " + EN + "\nGABARITO: E\nCOMENTARIO: quero mesmo assim.\n[/QUESTAO]";
    a7.qsUiConferir();
    const rep = a7.$("qsCriarConf").querySelectorAll(".qs-conf-rep")[0];
    ok(!!rep, "R1m devia continuar apontando a repetida");
    rep.querySelectorAll("input")[0].checked = true;
    rep.querySelectorAll("input")[0].onchange();
    ok(a7.$("btnQsCriarAplicar").disabled === false, "R1n marcar nao liberou gravar");
    a7.qsUiAplicar();
    ok(a7.qsTodas().length === 3,
       "R1o marquei para gravar apesar de repetida e a regra automatica desfez minha escolha");
  }

  /* ---- S1: fim da sessao — rever os erros e registrar o estudo ---- */
  {
    const { api: a8 } = rodar();
    a8.matIniciar(); a8.qsUiIniciar();
    const c8 = a8.matChave("Direito Financeiro", "Leis Orcamentarias");
    a8.matGravar(c8, "Texto.",
      { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
    a8.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Leis Orcamentarias" }, "ler");
    a8.qsAplicar(a8.qsLerResposta([
      "[QUESTAO]", "ENUNCIADO: Integrara a LOA o anexo de agregados fiscais.",
      "GABARITO: E", "COMENTARIO: Esse anexo integra a LDO.", "[/QUESTAO]",
      "[QUESTAO]", "ENUNCIADO: As emendas Pix dispensam convenio.",
      "GABARITO: C", "COMENTARIO: Art. 166-A.", "[/QUESTAO]",
    ].join("\n"), { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias",
                     chave: c8 }).achados);

    a8.qsUiResponderDoTopico();
    /* erra a primeira da fila, acerta a segunda */
    const erradaEn = a8.qsAtual().enunciado;
    a8.qsResponder(a8.qsAtual().gabarito === "C" ? "E" : "C");
    a8.qsUiPintarSessao();
    a8.$("btnQsProxima").onclick();
    a8.qsResponder(a8.qsAtual().gabarito);
    a8.qsUiPintarSessao();
    a8.$("btnQsProxima").onclick();

    ok(a8.$("qsSessCorpo").querySelectorAll(".qs-fim").length === 1,
       "S1 o fim da sessao nao mostrou o resultado");
    const revs = a8.$("qsSessCorpo").querySelectorAll(".qs-rev");
    ok(revs.length === 1, `S1b devia rever 1 erro, reviu ${revs.length}`);
    ok(revs[0].querySelector(".qs-rev-en").textContent === erradaEn,
       "S1c reviu uma questao que nao foi a errada");
    ok(/respondeu/.test(revs[0].querySelector(".qs-rev-gab").textContent),
       "S1d nao diz o que eu respondi e qual era o gabarito");
    ok(!!revs[0].querySelector(".qs-coment"),
       "S1e o gabarito comentado nao aparece na revisao");
    ok(a8.$("qsSessCorpo").querySelectorAll(".qs-rev").length
       < a8.qsPlacar().feitas,
       "S1f a revisao esta mostrando tambem as que eu acertei");

    /* dica escrita na revisao fica NA QUESTAO */
    const bd = revs[0].querySelectorAll("button")
      .filter((b) => /dica/i.test(b.textContent))[0];
    ok(!!bd && /incluir dica/.test(bd.textContent),
       "S1g falta o botao de incluir dica na revisao");
    ok(revs[0].querySelectorAll("button")
       .filter((b) => /cart/i.test(b.textContent)).length === 1,
       "S1g2 falta o botao de virar em cartoes na revisao dos erros");
    const p = bd.onclick();
    a8.$("txtLivreCampo").value = "Anexo de agregados fiscais e da LDO.";
    a8.$("btnTxtLivreOk").onclick();
    await Promise.resolve(p);
    const alvo = a8.qsTodas().filter((x) => x.enunciado === erradaEn)[0];
    ok(!!alvo && /agregados fiscais e da LDO/.test(alvo.dica || ""),
       "S1h a dica escrita na revisao nao ficou guardada na questao");
    ok(!!a8.$("qsSessCorpo").querySelector(".qs-minha-dica"),
       "S1i a dica nao aparece de volta na revisao");

    /* registrar o estudo: preenchido, mas so gravado depois da confirmacao */
    const br = a8.$("qsSessCorpo").querySelector(".qs-bt-registrar");
    ok(!!br, "S1j falta o botao de registrar o estudo");
    const antesDiario = a8.diarioTamanho ? a8.diarioTamanho() : null;
    br.onclick();
    ok(a8.$("dlgQsResponder").open === false, "S1k a sessao nao fechou ao registrar");
    ok(a8.$("dlgRegistro").open === true, "S1l o registro de estudo nao abriu");
    ok(a8.$("regTitulo").textContent === "Leis Orcamentarias",
       "S1m o registro abriu no topico errado");
    ok(a8.$("regQFeitas").value === "2",
       `S1n questoes feitas nao foram preenchidas: ${a8.$("regQFeitas").value}`);
    ok(a8.$("regQCertas").value === "1",
       `S1o acertos nao foram preenchidos: ${a8.$("regQCertas").value}`);
    ok(Number(a8.$("regMinutos").value) >= 1,
       "S1p o tempo da sessao nao foi sugerido");
    const ativas = a8.$("regFormas").querySelectorAll("button")
      .filter((b) => b.className.indexOf("ativa") >= 0).map((b) => b.textContent);
    ok(ativas.length === 1 && /Quest/i.test(ativas[0]),
       "S1q a forma de estudo devia vir marcada como Questoes: " + ativas.join(","));
    /* e o que a TELA mostra tem de ser o que vai para o DIARIO: sao duas
     * coisas diferentes, e sao elas que divergem quando se pinta o botao
     * por um rotulo em vez de pelo dado */
    ok(a8.regFormasAtual().length === 1 && a8.regFormasAtual()[0] === "questoes",
       "S1q2 a forma que sera GRAVADA nao e questoes: "
       + a8.regFormasAtual().join(","));
    /* e os campos sao EDITAVEIS: sugestao, nao imposicao */
    a8.$("regQCertas").value = "2";
    ok(a8.$("regQCertas").value === "2", "S1r os campos preenchidos nao podem ser travados");
  }

  /* ---- T2: a dica colada chega FORMATADA, nao crua ----
   * Colar de uma pagina trazia "**", "###", "---" e LaTeX a mostra dentro
   * da caixa "SUA DICA" — mais dificil de ler que o texto original. */
  {
    const { api: a9 } = rodar();
    a9.matIniciar(); a9.qsUiIniciar();
    const sujo = [
      "### **1. A Regra do Bolo Global (50% para a Saude)**",
      "",
      "* **Pelo menos 50%** do valor total deve ir para **ASPS**.",
      "---",
      "* O calculo e: \\[\\text{Minimo} = 70\\% \\text{ de R\\$ 6.000.000,00}\\]",
      "* **A pegadinha:** a vinculacao incide sobre o _somatorio geral_.",
    ].join("\n");
    const limpo = a9.matDicaLimparColagem(sujo);

    ok(limpo.indexOf("###") < 0, "T2 o titulo com ### ficou no texto");
    ok(limpo.indexOf("---") < 0, "T2b a linha de separacao ficou");
    ok(limpo.indexOf("\\[") < 0 && limpo.indexOf("\\text") < 0,
       "T2c o LaTeX ficou a mostra: " + limpo);
    ok(/R\$ 6\.000\.000,00/.test(limpo),
       "T2d o escape do LaTeX deixou 'R\\$' no texto: " + limpo);
    ok(/70% de/.test(limpo), "T2e o percentual escapado nao voltou ao normal");
    /* LaTeX chega com UMA barra ou com DUAS — markdown escapa a barra.
     * O caso acima tem barra simples; este tem a dupla, que e a que
     * aparece de verdade quando se copia de um chat. */
    const dupla = a9.matDicaLimparColagem(
      "O calculo: \\\\[\\\\text{Minimo} = 70\\\\% de R\\\\$ 6.000,00\\\\]");
    /* NENHUMA barra pode sobrar — nem uma. Procurar por duas deixava
     * passar o resto de uma barra solta, que e exatamente o que aparece na
     * tela quando a limpeza so trata metade do caso. */
    ok(!/\\/.test(dupla) && dupla.indexOf("text{") < 0,
       "T2e2 LaTeX de barra dupla ficou a mostra: " + dupla);
    ok(/70% de R\$ 6\.000,00/.test(dupla),
       "T2e3 o conteudo da formula se perdeu na limpeza: " + dupla);
    ok((limpo.match(/\*\*/g) || []).length >= 6,
       "T2f a limpeza comeu o negrito, que e o que a leitura desenha");

    /* e o desenho: negrito vira <b>, italico vira <i> */
    const cx = a9.qsUiCaixaDica(limpo);
    const html = cx.innerHTML || "";
    ok(/<b>Pelo menos 50%<\/b>/.test(html), "T2g o negrito nao virou <b>");
    ok(/<i>somatorio geral<\/i>/.test(html), "T2h o italico nao virou <i>");
    ok(html.indexOf("**") < 0, "T2i sobrou ** na tela");
    ok(cx.className === "qs-minha-dica", "T2j a caixa perdeu a marca de SUA DICA");
    ok(/Bolo Global/.test(cx.textContent || ""),
       "T2k o conteudo da dica sumiu no caminho");
  }

  /* ---- U9: colar de novo ACRESCENTA, nao apaga ----
   * Uma tanda de questoes raramente vem numa resposta so. Substituindo, o
   * que foi colado antes sumia sem aviso — e a conferencia mostrava menos
   * questoes do que a pessoa tinha trazido. */
  {
    const { api: aA, janela: jA } = rodar();
    aA.matIniciar(); aA.qsUiIniciar();
    const cA = aA.matChave("D", "T");
    aA.matGravar(cA, "Texto.", { disciplina: "D", topico: "T" });
    aA.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aA.matPorSelecao("");
    aA.qsUiVirarSelecao();

    /* primeira colagem, na mao */
    aA.$("qsCriarResposta").value =
      "[QUESTAO]\nENUNCIADO: Primeira questao da primeira tanda.\nGABARITO: C\nCOMENTARIO: um.\n[/QUESTAO]";
    aA.qsUiConferir();
    ok(aA.$("qsCriarConf").querySelectorAll(".qs-conf").length === 1,
       "U9 a primeira tanda nao foi conferida");

    /* segunda colagem PELO BOTAO, com a area de transferencia de mentira
     * que o ambiente de teste oferece — exercita o caminho de verdade, em
     * vez de imitar o que o botao deveria fazer */
    jA.__area =
      "[QUESTAO]\nENUNCIADO: Segunda questao, de outra tanda.\nGABARITO: E\nCOMENTARIO: dois.\n[/QUESTAO]";
    await Promise.resolve(aA.$("btnQsColar").onclick());
    await Promise.resolve();
    const itens = aA.$("qsCriarConf").querySelectorAll(".qs-conf");
    ok(itens.length === 2,
       `U9b depois da segunda colagem deviam existir 2 questoes, ha ${itens.length}`);
    ok(/Primeira questao/.test(aA.$("qsCriarResposta").value),
       "U9c a primeira colagem foi apagada pela segunda");
    ok(/Segunda questao/.test(aA.$("qsCriarResposta").value),
       "U9d a segunda colagem nao entrou");
    ok(aA.$("qsCriarResposta").value.indexOf("Primeira")
       < aA.$("qsCriarResposta").value.indexOf("Segunda"),
       "U9e a nova colagem devia entrar NO FIM, nao no comeco");

    /* uma terceira, para garantir que nao e coincidencia de duas */
    jA.__area =
      "[QUESTAO]\nENUNCIADO: Terceira questao, da terceira tanda.\nGABARITO: C\nCOMENTARIO: tres.\n[/QUESTAO]";
    await Promise.resolve(aA.$("btnQsColar").onclick());
    await Promise.resolve();
    ok(aA.$("qsCriarConf").querySelectorAll(".qs-conf").length === 3,
       "U9f a terceira colagem nao somou as anteriores");
    ok(/Primeira questao/.test(aA.$("qsCriarResposta").value),
       "U9g a primeira sumiu depois da terceira colagem");
  }

  /* ---- C1: questao -> cartoes, pelo caminho que ja existe ---- */
  {
    const { api: aB, janela: jB } = rodar();
    aB.matIniciar(); aB.qsUiIniciar();
    const cB = aB.matChave("Direito Financeiro", "Leis Orcamentarias");
    aB.matGravar(cB, "Resumo do topico.",
      { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias",
        concurso: "TCE-PE" });
    aB.matAbrirEditor({ disciplina: "Direito Financeiro",
                        nome: "Leis Orcamentarias" }, "ler");
    aB.qsAplicar(aB.qsLerResposta(
      "[QUESTAO] TIPO: ME BANCA: FGV ENUNCIADO: Qual o limite? A) 1%. B) 2% da RCL."
      + " C) 3%. GABARITO: B COMENTARIO: Art. 166, 9o.",
      { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias",
        chave: cB, concurso: "TCE-PE" }).achados);

    aB.qsUiResponderDoTopico();
    ok(aB.$("qsSessCorpo").querySelectorAll("button")
       .filter((b) => /cart/i.test(b.textContent)).length === 0,
       "C1 o botao de cartoes apareceu ANTES de responder");
    aB.qsResponder("B");
    aB.qsUiPintarSessao();
    const bt = aB.$("qsSessCorpo").querySelectorAll("button")
      .filter((b) => /cart/i.test(b.textContent))[0];
    ok(!!bt, "C1b falta o botao de virar a questao em cartoes");

    bt.onclick();
    ok(aB.$("dlgMatCartoes").open === true, "C1c o painel de cartoes nao abriu");
    ok(aB.matResumosAtual()[cB].texto === "Resumo do topico.",
       "C1d abrir o painel de fora sobrescreveu o resumo do topico");

    aB.matCartoesPrompt();
    const p = jB.__area || "";
    ok(/Qual o limite/.test(p), "C1e o prompt nao leva o enunciado");
    ok(/B\) 2% da RCL/.test(p), "C1f o prompt nao leva as alternativas");
    ok(/GABARITO: B/.test(p), "C1g o prompt nao leva o gabarito");
    ok(/Art\. 166/.test(p), "C1h o prompt nao leva o comentario");
    ok(/top_Leis_Orcamentarias/.test(p) && /concurso_TCE_PE/.test(p),
       "C1i o prompt nao manda usar as etiquetas do topico");
    ok(/de_questao/.test(p), "C1j a etiqueta de procedencia devia ser de_questao");
    ok(/N[ÃA]O copie a quest/i.test(p),
       "C1k o prompt nao avisa que cartao nao e copia da questao");
    ok(/pergunta :: resposta :: etiquetas/.test(p),
       "C1l o prompt nao ensina o formato dos cartoes do app");

    /* colar, conferir e gravar: os cartoes tem de cair na lista do topico */
    aB.$("mcTexto").value = [
      "Qual o limite das emendas individuais? :: 2% da RCL do exercicio anterior",
      "Quanto do limite vai para saude? :: metade, em ASPS",
    ].join("\n");
    aB.matCartoesConferir();
    ok(/2 cart/.test(aB.$("mcAviso").textContent),
       "C1m a conferencia nao leu os dois cartoes");
    const pv = aB.matCartoesSalvar();
    for (let k = 0; k < 6; k++) { aB._uiFechar(true); await Promise.resolve(); }
    await Promise.race([pv, new Promise((r) => setTimeout(r, 0))]);

    ok(aB.matContarCartoes(cB) === 2,
       `C1n os cartoes nao entraram na lista do topico (${aB.matContarCartoes(cB)})`);
    const guardado = aB.matResumosAtual()[cB].cartoes || "";
    ok(/de_questao/.test(guardado),
       "C1o o cartao gravado nao guarda que veio de uma questao");
    ok(/top_Leis_Orcamentarias/.test(guardado),
       "C1p o cartao gravado perdeu a etiqueta do topico");
    ok(guardado.split("\n").every((l) => (l.match(/ :: /g) || []).length === 2),
       "C1q o cartao gravado nao esta no formato de tres campos do app");
    ok(aB.matResumosAtual()[cB].texto === "Resumo do topico.",
       "C1r gravar cartoes de uma questao mexeu no resumo");

    /* C1s — O PERIGO DE VERDADE: questao de OUTRO topico.
     * Abrir o painel de cartoes salvando "o que esta na caixa" so parece
     * inofensivo quando a caixa e do mesmo topico. Vindo de uma questao de
     * outro assunto, aquilo gravaria o texto do topico A dentro do topico
     * B — e o resumo de B sumiria sem aviso. */
    const cOutro = aB.matChave("Direito Financeiro", "Restos a pagar");
    aB.matGravar(cOutro, "RESUMO DE RESTOS A PAGAR, que nao pode sumir.",
      { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
    aB.qsAplicar(aB.qsLerResposta(
      "[QUESTAO] ENUNCIADO: Questao de restos a pagar. GABARITO: C COMENTARIO: x.",
      { disciplina: "Direito Financeiro", topico: "Restos a pagar",
        chave: cOutro }).achados);
    /* o resumo aberto na tela continua sendo o de Leis Orcamentarias */
    aB.matAbrirEditor({ disciplina: "Direito Financeiro",
                        nome: "Leis Orcamentarias" }, "ler");
    const qOutra = aB.qsFiltrar({ chave: cOutro })[0];
    aB.qsUiCartoesDaQuestao(qOutra);
    ok(aB.matResumosAtual()[cOutro].texto === "RESUMO DE RESTOS A PAGAR, que nao pode sumir.",
       "C1s abrir cartoes de uma questao de OUTRO topico sobrescreveu o resumo dele: "
       + JSON.stringify(aB.matResumosAtual()[cOutro].texto));
    ok(aB.matResumosAtual()[cB].texto === "Resumo do topico.",
       "C1t e o resumo que estava aberto tambem nao pode ter mudado");
  }

  /* ---- C2: o formato dos cartoes aguenta o que vem de uma questao ----
   * Enunciado de prova tem dois-pontos, numeros e citacao de artigo. O
   * leitor do app precisa AVISAR quando algo nao cabe, em vez de deformar
   * calado — silencio aqui vira cartao errado revisado por meses. */
  {
    const { api: aC } = rodar();
    aC.matIniciar();
    const caso = (txt) => aC.parseText(txt, []);

    const doisPontos = caso("Art. 166 :: qual o limite? :: 2% da RCL");
    ok(doisPontos.cards.length === 1, "C2 linha com tres campos virou zero cartoes");
    ok((doisPontos.cards[0].issues || []).length > 0,
       "C2b '::' a mais no texto passou sem aviso nenhum");

    const quatro = caso("Pergunta :: Resposta :: Extra :: tag1 tag2");
    ok(quatro.cards.length === 1, "C2c quatro campos derrubaram o cartao");
    ok((quatro.cards[0].issues || []).length > 0,
       "C2d quatro campos foram reorganizados em silencio");

    const clozeVerso = caso("Qual o limite? :: {{c1::2%}} da RCL");
    ok(/\{\{c1::/.test(clozeVerso.cards[0].front),
       "C2e cloze no verso devia ser movido para a frente, senao o Anki nao gera cartao");

    const duasLinhas = caso("Qual o limite?\n2% da RCL");
    ok(duasLinhas.cards.length === 1
       && duasLinhas.cards[0].back === "2% da RCL",
       "C2f pergunta e resposta em duas linhas deviam virar um cartao");

    const solta = caso("Frase solta sem separador");
    ok(solta.cards.length === 0, "C2g frase sem separador virou cartao do nada");

    /* e a gravacao neutraliza o '::' que sobrar, para o arquivo do topico
     * nunca guardar uma linha que se leria diferente na proxima abertura */
    const ch2 = aC.matChave("D", "T");
    aC.matGravar(ch2, "x", { disciplina: "D", topico: "T" });
    aC.mcApontarTopico("D", "T");
    aC.$("mcTexto").value = "Frente com :: dentro :: verso";
    aC.matCartoesConferir();
    const lidos = aC.matCartoesLer();
    ok(lidos.cards.length === 1, "C2h nao leu o cartao com ':: ' a mais");
  }

  /* ---- E1: a rodada sobrevive a fechar a janela ---- */
  {
    const { api: aD } = rodar();
    aD.matIniciar(); aD.qsUiIniciar();
    const cD = aD.matChave("D", "T");
    aD.matGravar(cD, "x", { disciplina: "D", topico: "T" });
    aD.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aD.qsAplicar(aD.qsLerResposta([1, 2, 3, 4, 5].map((i) =>
      "[QUESTAO] ENUNCIADO: Questao " + i + ". GABARITO: C COMENTARIO: c.").join("\n"),
      { disciplina: "D", topico: "T", chave: cD }).achados);

    await aD.qsUiResponderDoTopico();
    /* a rodada e gravada JA AO COMECAR: se o app fechar antes da primeira
     * resposta, ainda ha de onde retomar */
    const g0 = aD.qsSessaoLer();
    ok(!!g0 && g0.ids.length === 5 && g0.i === 0,
       "E1a0 a rodada nao foi guardada ao comecar");
    aD.qsResponder("C");
    const g1 = aD.qsSessaoLer();
    ok(!!g1 && (g1.respondidas || []).length === 1,
       "E1a1 responder nao atualizou a rodada guardada");
    aD.qsAndar(1);
    ok((aD.qsSessaoLer() || {}).i === 1,
       "E1a2 andar nao atualizou a posicao guardada");
    aD.qsResponder("E"); aD.qsAndar(1);
    const antes = aD.qsPlacar();
    ok(antes.feitas === 2, "E1 preparo: deviam existir 2 respostas");

    aD.$("btnQsSessFechar").onclick();
    ok(!!aD.qsSessaoLer(), "E1b fechar a janela jogou a rodada fora");
    const ret = aD.qsSessaoRetomavel("topico:" + cD);
    ok(!!ret && ret.feitas === 2 && ret.total === 5,
       "E1c a rodada guardada nao bate com o que foi feito");

    /* as TENTATIVAS nunca se perderam — isto e o historico, e e outra coisa */
    ok(aD.qsDesempenho().feitas === 2,
       "E1d o historico de acertos da questao se perdeu");

    /* reabrir PERGUNTA: continuar ou recomecar. Nunca decide sozinho. */
    const p = aD.qsUiResponderDoTopico();
    await Promise.resolve();
    ok(/pela metade/.test(aD.$("uiModalMsg").textContent || ""),
       "E1e reabrir nao perguntou o que fazer com a rodada pela metade");
    aD._uiFechar("continuar");
    await p;
    ok(aD.qsPlacar().feitas === 2,
       `E1f retomar perdeu o que ja tinha sido feito (${aD.qsPlacar().feitas})`);
    ok(aD.qsJaRespondida() === null,
       "E1g retomar caiu numa questao que ja tinha sido respondida");
    ok(aD.qsPendentes().length === 3, "E1h a conta de pendentes errou");

    /* E1h2 — responder e FECHAR SEM AVANCAR. Ao retomar, a posicao
     * guardada aponta para uma questao ja respondida; cair nela mostraria
     * o gabarito de cara e faria parecer que a rodada travou. */
    aD.qsResponder("C");
    ok(aD.qsJaRespondida() !== null, "E1h3 preparo: esta devia estar respondida");
    aD.$("btnQsSessFechar").onclick();
    const p3 = aD.qsUiResponderDoTopico();
    await Promise.resolve();
    aD._uiFechar("continuar");
    await p3;
    ok(aD.qsJaRespondida() === null,
       "E1h4 retomar caiu numa questao ja respondida em vez da proxima pendente");

    /* recomecar do zero tambem tem de funcionar */
    const histAntes = aD.qsDesempenho().feitas;
    aD.$("btnQsSessFechar").onclick();
    const p2 = aD.qsUiResponderDoTopico();
    await Promise.resolve();
    aD._uiFechar("recomecar");
    await p2;
    ok(aD.qsPlacar().feitas === 0, "E1i recomecar manteve as respostas antigas");
    /* numero RELATIVO, nao fixo: uma resposta a mais em qualquer teste
     * acima quebraria a assercao sem que nada estivesse errado */
    ok(aD.qsDesempenho().feitas === histAntes,
       `E1j recomecar a RODADA apagou o HISTORICO da questao (${histAntes} → ${aD.qsDesempenho().feitas})`);
  }

  /* ---- E2: pular, embaralhar e incluir novas ---- */
  {
    const { api: aE } = rodar();
    aE.matIniciar(); aE.qsUiIniciar();
    const cE = aE.matChave("D", "T");
    aE.matGravar(cE, "x", { disciplina: "D", topico: "T" });
    aE.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aE.qsAplicar(aE.qsLerResposta([1, 2, 3, 4, 5].map((i) =>
      "[QUESTAO] ENUNCIADO: Q" + i + ". GABARITO: C COMENTARIO: c.").join("\n"),
      { disciplina: "D", topico: "T", chave: cE }).achados);
    await aE.qsUiResponderDoTopico();

    /* PULAR: anda sem responder e a questao continua pendente */
    const pulada = aE.qsAtual().enunciado;
    ok(aE.$("btnQsPular").hidden === false, "E2 o botao de pular nao aparece");
    aE.$("btnQsPular").onclick();
    ok(aE.qsAtual() && aE.qsAtual().enunciado !== pulada,
       "E2b pular nao avancou");
    ok(aE.qsPlacar().feitas === 0, "E2c pular contou como resposta");
    ok(aE.qsPendentes().some((x) => x.enunciado === pulada),
       "E2d a questao pulada saiu das pendentes");

    /* EMBARALHAR: muda so o que falta */
    aE.qsResponder("C");
    const feitasAntes = aE.qsPlacar().feitas;
    const ordem1 = aE.qsPendentes().map((x) => x.enunciado).join("|");
    const n = aE.qsEmbaralharRestantes(() => 0);
    ok(n >= 2, "E2e embaralhar nao encontrou pendentes");
    const ordem2 = aE.qsPendentes().map((x) => x.enunciado).join("|");
    ok(ordem1 !== ordem2, "E2f a ordem das pendentes nao mudou");
    ok(ordem1.split("|").sort().join() === ordem2.split("|").sort().join(),
       "E2g embaralhar perdeu ou inventou questao");
    ok(aE.qsPlacar().feitas === feitasAntes,
       "E2h embaralhar mexeu no que ja tinha sido respondido");

    /* INCLUIR NOVAS sem recomecar */
    const totalAntes = aE.qsPlacar().total;
    aE.qsAplicar(aE.qsLerResposta(
      "[QUESTAO] ENUNCIADO: Q6 criada depois. GABARITO: C COMENTARIO: c.",
      { disciplina: "D", topico: "T", chave: cE }).achados);
    const somadas = aE.qsSessaoAcrescentar(aE.qsFiltrar({ chave: cE }));
    ok(somadas === 1, `E2i devia somar 1 questao nova, somou ${somadas}`);
    ok(aE.qsPlacar().total === totalAntes + 1, "E2j o total da rodada nao subiu");
    ok(aE.qsPlacar().feitas === feitasAntes,
       "E2k incluir novas mexeu no que ja tinha sido feito");
    ok(aE.qsSessaoAcrescentar(aE.qsFiltrar({ chave: cE })) === 0,
       "E2l somou de novo as mesmas questoes");
  }

  /* ---- E3: historico da questao aparece ANTES, sem entregar o gabarito ---- */
  {
    const { api: aF } = rodar();
    aF.matIniciar(); aF.qsUiIniciar();
    const cF = aF.matChave("D", "T");
    aF.matGravar(cF, "x", { disciplina: "D", topico: "T" });
    aF.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aF.qsAplicar(aF.qsLerResposta(
      "[QUESTAO] ENUNCIADO: Uma afirmacao. GABARITO: C COMENTARIO: comentario secreto.",
      { disciplina: "D", topico: "T", chave: cF }).achados);
    const qF = aF.qsTodas()[0];
    qF.tentativas = [
      { q: new Date(Date.now() - 5 * 86400000).toISOString(), resp: "E", acertou: false },
      { q: new Date(Date.now() - 2 * 86400000).toISOString(), resp: "C", acertou: true },
    ];
    aF.qsSessaoIniciar([qF], { escopo: "x" });
    aF.qsUiPintarSessao();

    const hs = aF.$("qsSessCorpo").querySelector(".qs-hist");
    ok(!!hs, "E3 o historico da questao nao aparece antes de responder");
    ok(/2/.test(hs.textContent) && /1/.test(hs.textContent),
       "E3b o historico nao diz quantas vezes e quantas certas");
    /* e NAO pode contar o gabarito */
    const corpo = aF.$("qsSessCorpo").textContent || "";
    ok(corpo.indexOf("comentario secreto") < 0,
       "E3c o comentario apareceu antes de responder");
    ok(aF.$("qsSessCorpo").querySelectorAll(".qs-gab").length === 0,
       "E3d o gabarito apareceu antes de responder");
    ok(!/gabarito/i.test(hs.textContent),
       "E3e o proprio historico entregou o gabarito");
    /* nem a letra: numa questao de certo/errado, dizer "ultima resposta: C"
     * e contar o gabarito para quem lembra do que marcou */
    ok(!/\b(C|E|Certo|Errado)\b/.test(hs.textContent),
       "E3e2 o historico mostrou a alternativa marcada: " + hs.textContent);
    /* questao inedita nao mostra historico nenhum */
    const qNova = { id: "zz", tipo: "ce", enunciado: "Inedita.", opcoes: [],
                    gabarito: "C", comentario: "x", tentativas: [] };
    aF.qsSessaoIniciar([qNova], { escopo: "y" });
    aF.qsUiPintarSessao();
    ok(!aF.$("qsSessCorpo").querySelector(".qs-hist"),
       "E3f questao nunca respondida mostrou historico do nada");
  }

  /* ---- H1: NENHUM BOTAO DE ESCOLHA PODE FICAR EM BRANCO ----
   * A pergunta "continuar ou recomecar" saiu com tres retangulos cinzas
   * sem texto: quem chama passou "rotulo" e uiEscolha lia "rot". Nome de
   * campo suposto em vez de conferido — o mesmo erro que ja tinha
   * acontecido com a ordem dos argumentos de ok(). */
  {
    const { api: aG } = rodar();
    const ids = ["uiModalOk", "uiModalCancel", "uiModalTerceiro"];

    aG.uiEscolha("Pergunta?", [
      { valor: "a", rot: "Com rot" },
      { valor: "b", rotulo: "Com rotulo" },
      { valor: "c" },
    ]);
    const vis = ids.map((id) => aG.$(id)).filter((b) => b && !b.hidden);
    ok(vis.length === 3, `H1 deviam aparecer 3 botoes, apareceram ${vis.length}`);
    ok(vis.every((b) => String(b.textContent || "").trim().length > 0),
       "H1b algum botao de escolha ficou SEM TEXTO: "
       + JSON.stringify(vis.map((b) => b.textContent)));
    ok(aG.$("uiModalOk").textContent === "Com rot", "H1c o campo 'rot' parou de valer");
    ok(aG.$("uiModalCancel").textContent === "Com rotulo",
       "H1d o campo 'rotulo' nao foi aceito");
    ok(aG.$("uiModalTerceiro").textContent === "c",
       "H1e sem rotulo nenhum, devia cair no valor em vez de ficar vazio");
    aG._uiFechar("a");

    /* e a pergunta de retomar, que foi onde apareceu */
    const { api: aH } = rodar();
    aH.matIniciar(); aH.qsUiIniciar();
    const cH = aH.matChave("D", "T");
    aH.matGravar(cH, "x", { disciplina: "D", topico: "T" });
    aH.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aH.qsAplicar(aH.qsLerResposta([1, 2, 3].map((i) =>
      "[QUESTAO] ENUNCIADO: Q" + i + ". GABARITO: C COMENTARIO: c.").join("\n"),
      { disciplina: "D", topico: "T", chave: cH }).achados);
    await aH.qsUiResponderDoTopico();
    aH.qsResponder("C"); aH.qsAndar(1);
    aH.$("btnQsSessFechar").onclick();
    const pH = aH.qsUiResponderDoTopico();
    await Promise.resolve();
    const visH = ids.map((id) => aH.$(id)).filter((b) => b && !b.hidden);
    ok(visH.length === 3, "H1f a pergunta de retomar nao ofereceu as tres saidas");
    ok(visH.every((b) => String(b.textContent || "").trim().length > 0),
       "H1g a pergunta de retomar tem botao em branco: "
       + JSON.stringify(visH.map((b) => b.textContent)));
    /* compara com o TEXTO DE VERDADE, nao com "contem a palavra".
     * A rede de seguranca do uiEscolha mostra o valor cru quando falta
     * rotulo — "continuar" —, entao uma busca frouxa passaria por cima
     * justamente do erro que a rede esta escondendo. */
    ok(aH.$("uiModalOk").textContent === aH.t("qs_retomar_sim"),
       "H1h o primeiro botao nao esta com o rotulo escrito para ele: "
       + JSON.stringify(aH.$("uiModalOk").textContent));
    ok(aH.$("uiModalCancel").textContent === aH.t("qs_retomar_nao"),
       "H1i o segundo botao nao esta com o rotulo de recomecar: "
       + JSON.stringify(aH.$("uiModalCancel").textContent));
    aH._uiFechar("continuar");
    await pH;
  }

  /* ---- I1: NINGUEM PODE FICAR PRESO NUM AVISO ----
   * Os botoes OK e Cancelar sao compartilhados por uiAlert, uiConfirm e
   * uiEscolha. As ligacoes padrao eram feitas UMA VEZ no carregamento, e
   * uiEscolhaLimpar as ANULAVA: depois de qualquer pergunta de tres
   * saidas, o proximo aviso vinha com o OK morto e nao havia como sair do
   * app a nao ser recarregando a pagina. */
  {
    const { api: aI } = rodar();

    const p1 = aI.uiEscolha("Escolha?", [
      { valor: "a", rot: "A" }, { valor: "b", rot: "B" }, { valor: "c", rot: "C" },
    ]);
    aI.$("uiModalOk").onclick();
    ok(await p1 === "a", "I1 a escolha nao devolveu o valor do botao apertado");

    /* AGORA o aviso simples, que era o que travava */
    ok(typeof aI.$("uiModalOk").onclick === "function",
       "I1b depois de uma escolha, o OK ficou SEM manipulador");
    let saiu = false;
    const p2 = aI.uiAlert("Nenhum cartao reconhecido.");
    p2.then(() => { saiu = true; });
    aI.$("uiModalOk").onclick();
    await Promise.resolve(); await Promise.resolve();
    ok(saiu === true, "I1c o aviso nao fechou ao apertar OK — app preso");
    ok(aI.$("uiModal").open === false, "I1d o dialogo continuou aberto");
    ok(!!aI.$("uiModalTerceiro").hidden,
       "I1e o terceiro botao ficou aceso num aviso simples");

    /* e o confirm tambem */
    let v = null;
    const p3 = aI.uiConfirm("Confirma?");
    p3.then((x) => { v = x; });
    aI.$("uiModalCancel").onclick();
    await Promise.resolve(); await Promise.resolve();
    ok(v === false, "I1f o Cancelar do confirm parou de funcionar");

    /* I1f2 — O CASO EXATO QUE PRENDEU: responder "continuar" na pergunta
     * de retomar e, depois, tentar SALVAR cartoes. O confirm de gravacao
     * aparecia com o OK morto: dava para cancelar, nunca para salvar. */
    let vOk = null;
    const p3b = aI.uiConfirm("Salvar 2 cartoes?");
    p3b.then((x) => { vOk = x; });
    ok(typeof aI.$("uiModalOk").onclick === "function",
       "I1f3 o OK do confirm de gravacao ficou sem manipulador");
    aI.$("uiModalOk").onclick();
    await Promise.resolve(); await Promise.resolve();
    ok(vOk === true,
       "I1f4 nao deu para CONFIRMAR a gravacao — so cancelar, que e perder o trabalho");

    /* e mesmo se alguem limpar por fora, o aviso seguinte tem de abrir vivo */
    aI.uiEscolhaLimpar();
    let saiu2 = false;
    const p4 = aI.uiAlert("Outro aviso.");
    p4.then(() => { saiu2 = true; });
    aI.$("uiModalOk").onclick();
    await Promise.resolve(); await Promise.resolve();
    ok(saiu2 === true, "I1g depois de uiEscolhaLimpar, o aviso voltou a travar");

    /* I1h — A REDE DE SEGURANCA, testada por fora.
     * Consertar uiEscolhaLimpar resolve o caminho conhecido. Mas os botoes
     * sao compartilhados: qualquer codigo futuro pode zera-los. Abrir um
     * aviso tem de RELIGAR, aconteca o que acontecer antes — ficar preso
     * num aviso e o unico defeito do qual nem da para relatar o problema. */
    aI.$("uiModalOk").onclick = null;
    aI.$("uiModalCancel").onclick = null;
    let saiu3 = false;
    const p5 = aI.uiAlert("Aviso depois de alguem zerar os botoes.");
    p5.then(() => { saiu3 = true; });
    ok(typeof aI.$("uiModalOk").onclick === "function",
       "I1h abrir um aviso nao religou o OK que alguem tinha zerado");
    aI.$("uiModalOk").onclick();
    await Promise.resolve(); await Promise.resolve();
    ok(saiu3 === true, "I1i o aviso ficou sem saida");

    /* I1j — e o terceiro botao nao pode sobrar aceso num aviso simples */
    aI.$("uiModalTerceiro").hidden = false;
    let saiu4 = false;
    const p6 = aI.uiAlert("Mais um aviso.");
    p6.then(() => { saiu4 = true; });
    ok(!!aI.$("uiModalTerceiro").hidden,
       "I1j o terceiro botao de uma escolha anterior ficou aceso no aviso");
    aI.$("uiModalOk").onclick();
    await Promise.resolve(); await Promise.resolve();
    ok(saiu4 === true, "I1k o aviso com terceiro botao aceso nao fechou");
  }

  /* ---- I2: o prompt de cartoes diz que copiou e mostra o que copiou ---- */
  {
    const { api: aJ, janela: jJ } = rodar();
    aJ.matIniciar();
    const cJ = aJ.matChave("D", "T");
    aJ.matGravar(cJ, "Texto do resumo.", { disciplina: "D", topico: "T" });
    aJ.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aJ.matCartoesAbrir();
    ok(aJ.$("mcPromptVer").hidden === true,
       "I2 o bloco do prompt ja aparece antes de gerar");

    aJ.segurarAdiados();
    aJ.matCartoesPrompt();
    ok(/copiado/i.test(aJ.$("btnMcPrompt").textContent),
       "I2b o botao nao confirma que copiou: " + aJ.$("btnMcPrompt").textContent);
    ok(aJ.$("btnMcPrompt").classList.contains("btn-salvo"),
       "I2c faltou a marca visual de que copiou");
    ok(aJ.$("mcPromptVer").hidden === false,
       "I2d nao da para ver o texto que foi copiado");
    ok(/Texto do resumo/.test(aJ.$("mcPromptTexto").value),
       "I2e o texto a mostra nao e o que foi copiado");
    ok(/Texto do resumo/.test(jJ.__area || ""),
       "I2f nao foi para a area de transferencia");
    ok(aJ.adiadosPresos() >= 1, "I2g a confirmacao ficou permanente");
    aJ.soltarAdiados();
    ok(String(aJ.$("btnMcPrompt").textContent || "").trim().length > 0,
       "I2h o rotulo do botao sumiu depois do aviso");
  }

  /* ---- I3: voltar leva de volta para onde se veio ---- */
  {
    const { api: aK } = rodar();
    aK.matIniciar(); aK.qsUiIniciar();
    const cK = aK.matChave("D", "T");
    aK.matGravar(cK, "Resumo.", { disciplina: "D", topico: "T" });
    aK.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aK.qsAplicar(aK.qsLerResposta(
      "[QUESTAO] ENUNCIADO: Uma afirmacao. GABARITO: C COMENTARIO: c.",
      { disciplina: "D", topico: "T", chave: cK }).achados);
    await aK.qsUiResponderDoTopico();
    aK.qsResponder("C"); aK.qsUiPintarSessao();
    aK.$("qsSessCorpo").querySelectorAll("button")
      .filter((b) => /cart/i.test(b.textContent))[0].onclick();
    ok(/quest/i.test(aK.$("btnMcFechar").textContent),
       "I3 vindo de uma questao, o voltar devia dizer questoes: "
       + aK.$("btnMcFechar").textContent);
    aK.$("btnMcFechar").onclick();
    ok(aK.$("dlgMatCartoes").open === false, "I3b o painel nao fechou");
    ok(aK.$("dlgQsResponder").open === true,
       "I3c voltar nao devolveu para a rodada de questoes");
    ok(aK.qsPlacar().feitas === 1, "I3d a rodada perdeu o que ja tinha sido feito");

    /* vindo do resumo, continua sendo o resumo */
    aK.$("btnQsSessFechar").onclick();
    aK.matCartoesAbrir();
    ok(/resumo/i.test(aK.$("btnMcFechar").textContent),
       "I3e vindo do resumo, o voltar mudou de rotulo sem motivo");
    aK.$("btnMcFechar").onclick();
    ok(aK.$("dlgQsResponder").open === false,
       "I3f voltar do resumo abriu a rodada de questoes do nada");
  }

  /* ---- K1: cartao nao precisa passar pelo resumo ---- */
  {
    const { api: aL } = rodar();
    aL.matIniciar(); aL.qsUiIniciar(); aL.leiIniciar();
    const cL = aL.matChave("Direito Financeiro", "Leis Orcamentarias");
    aL.matGravar(cL, "Resumo.",
      { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });
    aL.matGravarCartoes(cL, ["Pergunta A :: Resposta A", "Pergunta B :: Resposta B"].join("\n"),
      { disciplina: "Direito Financeiro", topico: "Leis Orcamentarias" });

    const li = aL.edLinhaAgendaTeste({ disciplina: "Direito Financeiro",
      nome: "Leis Orcamentarias", chave: cL });
    const bc = noMenu(li, /cart/i);
    ok(!!bc, "K1 o menu da agenda perdeu o atalho dos cartoes");
    if (!bc) { falhas.quantas = n; return falhas; }
    bc.onclick({ stopPropagation() {} });
    ok(aL.$("dlgMcEstudo").open === true,
       "K1b o atalho da agenda nao abriu o leitor de cartoes");
    ok(aL.$("dlgMaterial").open === false,
       "K1c o atalho abriu o RESUMO no caminho, que nao tem a ver com o gesto");
    ok(aL.mcEstMostraAtual() === false,
       "K1d o leitor abriu com a resposta a mostra — assim nao e teste, e leitura");

    /* criar mais cartoes DAQUI */
    ok(aL.$("btnMcEstCriar").hidden === false, "K1e falta o botao de criar mais cartoes");
    aL.$("btnMcEstCriar").onclick();
    ok(aL.$("dlgMatCartoes").open === true, "K1f criar mais nao abriu a criacao");
    ok(aL.$("dlgMaterial").open === false,
       "K1g criar mais passou pelo resumo");
    ok(aL.matResumosAtual()[cL].texto === "Resumo.",
       "K1h abrir a criacao daqui sobrescreveu o resumo");
    ok(/cart/i.test(aL.$("btnMcFechar").textContent),
       "K1i o voltar devia levar de volta aos cartoes: " + aL.$("btnMcFechar").textContent);
    aL.$("btnMcFechar").onclick();
    ok(aL.$("dlgMcEstudo").open === true, "K1j voltar nao devolveu ao leitor");

    /* topico SEM cartao nenhum: vai direto para a criacao */
    const cVazio = aL.matChave("Direito Financeiro", "Sem cartoes");
    aL.matGravar(cVazio, "y", { disciplina: "Direito Financeiro", topico: "Sem cartoes" });
    aL.$("dlgMcEstudo").close();
    const li2 = aL.edLinhaAgendaTeste({ disciplina: "Direito Financeiro",
      nome: "Sem cartoes", chave: cVazio });
    const bc2 = noMenu(li2, /cart/i);
    ok(!!bc2, "K1k2 sem cartoes o menu tem de oferecer criar");
    if (bc2) bc2.onclick({ stopPropagation() {} });
    ok(aL.$("dlgMatCartoes").open === true,
       "K1k topico sem cartoes devia levar direto a criacao");
    ok(aL.$("dlgMaterial").open === false, "K1l e ainda assim sem abrir o resumo");
  }

  /* ---- K2: conferir nao e estudar ----
   * "Ampliar" indexava nos cartoes JA SALVOS: ampliar o terceiro colado
   * abria o terceiro ANTIGO do topico, outro cartao, sem aviso. E abria
   * com a resposta escondida, quando ali a pessoa esta justamente julgando
   * o cartao inteiro. */
  {
    const { api: aM } = rodar();
    aM.matIniciar();
    const cM = aM.matChave("D", "T");
    aM.matGravar(cM, "x", { disciplina: "D", topico: "T" });
    aM.matGravarCartoes(cM, ["ANTIGO 1 :: velho 1", "ANTIGO 2 :: velho 2",
      "ANTIGO 3 :: velho 3"].join("\n"), { disciplina: "D", topico: "T" });
    aM.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aM.matCartoesAbrir();
    aM.$("mcTexto").value = ["NOVO 1 :: resposta 1", "NOVO 2 :: resposta 2",
      "NOVO 3 :: resposta 3"].join("\n");
    aM.matCartoesConferir();

    const cards = aM.$("mcPreview").querySelectorAll(".mc-card");
    ok(cards.length === 3, `K2 a conferencia devia listar 3, listou ${cards.length}`);
    const amp = cards[2].querySelectorAll("button")
      .filter((b) => /ampliar/i.test(b.textContent))[0];
    ok(!!amp, "K2b falta o botao de ampliar na conferencia");
    amp.onclick();
    const visto = aM.$("mcEstCartao").textContent || "";
    ok(/NOVO 3/.test(visto),
       "K2c ampliar mostrou outro cartao que nao o que eu pedi: " + visto.slice(0, 50));
    ok(!/ANTIGO/.test(visto),
       "K2d ampliar foi buscar nos cartoes ja salvos em vez dos que estao na conferencia");
    ok(aM.mcEstMostraAtual() === true,
       "K2e ao conferir, a resposta tem de estar a vista — nao se julga metade do cartao");
    ok(/resposta 3/.test(visto), "K2f a resposta nao apareceu no cartao ampliado");
    ok(aM.$("btnMcEstCriar").hidden === true,
       "K2g o botao de criar apareceu no meio de uma conferencia");
    aM.$("btnMcEstFechar").onclick();
    ok(aM.$("dlgMatCartoes").open === true,
       "K2h fechar o ampliado nao devolveu para a conferencia");

    /* e ESTUDAR continua escondendo */
    aM.mcEstudarAbrir(0);
    ok(aM.mcEstMostraAtual() === false,
       "K2i estudar em tela abriu com a resposta a mostra");
    ok(/ANTIGO 1/.test(aM.$("mcEstCartao").textContent || ""),
       "K2j estudar em tela devia mostrar os cartoes SALVOS");
    ok(/ANTIGO 1/.test(aM.$("mcEstCartao").textContent || ""),
       "K2k com o gabarito oculto a FRENTE tem de estar visivel — "
       + "cartao em branco ate virar nao e cartao");
    ok(!/velho 1/.test(aM.$("mcEstCartao").textContent || ""),
       "K2l o verso vazou antes de eu pedir");
    aM.$("btnMcEstVirar").onclick();
    ok(/velho 1/.test(aM.$("mcEstCartao").textContent || ""),
       "K2m virar nao trouxe o verso");
  }

  /* ---- K3: a agenda leva direto as questoes ---- */
  {
    const { api: aN } = rodar();
    aN.matIniciar(); aN.qsUiIniciar();
    const cN = aN.matChave("D", "T");
    aN.matGravar(cN, "Texto do resumo deste topico.", { disciplina: "D", topico: "T" });
    aN.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aN.qsAplicar(aN.qsLerResposta(
      "? CE :: FGV :: Afirmacao da agenda.\n= C :: coment.",
      { disciplina: "D", topico: "T", chave: cN }).achados);
    aN.$("dlgMaterial").close();

    const acha = (li, cls) => {
      const r = [];
      const anda = (x) => (x.children || []).forEach((f) => {
        if ((f.className || "").split(/\s+/).includes(cls)) r.push(f);
        anda(f);
      });
      anda(li); return r;
    };
    const li = aN.edLinhaAgendaTeste({ disciplina: "D", nome: "T", chave: cN });
    const marca = acha(li, "ed-qst")[0];
    ok(!!marca, "K3 a linha nao mostra que o topico tem questoes");
    ok(/tem/.test((marca && marca.className) || ""),
       "K3b a etiqueta de questoes apareceu apagada");
    const bq = noMenu(li, /quest/i);
    ok(!!bq, "K3b2 o menu nao oferece as questoes do topico");
    if (bq) bq.onclick({ stopPropagation() {} });
    ok(aN.$("dlgQsResponder").open === true,
       "K3c o atalho da agenda nao abriu a resolucao");
    ok(aN.$("dlgMaterial").open === false,
       "K3d o atalho abriu o RESUMO no caminho — quem clica em ❓ quer responder");
  }

  /* ---- K4: sem questao nenhuma, o botao convida a criar ---- */
  {
    const { api: aO } = rodar();
    aO.matIniciar(); aO.qsUiIniciar();
    const cO = aO.matChave("D", "Vazio");
    aO.matGravar(cO, "Materia-prima para as questoes.", { disciplina: "D", topico: "Vazio" });
    const li = aO.edLinhaAgendaTeste({ disciplina: "D", nome: "Vazio", chave: cO });
    const bq0 = noMenu(li, /quest/i);
    ok(!!bq0, "K4-pre o menu nao oferece criar questoes");
    if (!bq0) { falhas.quantas = n; return falhas; }
    bq0.onclick({ stopPropagation() {} });
    ok(aO.$("dlgQsCriar").open === true,
       "K4 sem questoes o atalho virou beco em vez de levar a criar");
    ok(aO.$("dlgMaterial").open === false, "K4b e ainda assim sem abrir o resumo");
    ok(/Materia-prima/.test(aO.$("qsCriarPrompt").value || ""),
       "K4c o prompt saiu sem o texto do resumo do topico");
  }

  /* ---- K5: a LAMPADA responde pelo topico, nao pela grafia ----
   * Um acento de diferenca entre o nome no edital e o nome com que o
   * resumo foi salvo criava duas gavetas: a agenda procurava na vazia e
   * apagava os indicadores, com o material inteiro do lado. */
  {
    const { api: aP } = rodar();
    aP.matIniciar(); aP.qsUiIniciar();
    const disc = "Direito Financeiro";
    const top = "Processo legislativo e emendas ao Orçamento";
    const variante = "direito financeiro›processo legislativo e emendas ao orcamento";
    ok(aP.matChave(disc, top) !== variante,
       "K5 o exemplo nao discrimina: as duas grafias deram a mesma chave");
    aP.matGravar(variante, "Resumo guardado na variante.",
      { disciplina: disc, topico: top });
    aP.matGravarCartoes(variante, "P :: R", { disciplina: disc, topico: top });

    const li = aP.edLinhaAgendaTeste({ disciplina: disc, nome: top,
      chave: aP.matChave(disc, top) });
    const acesa = (cls) => {
      let achou = false;
      const anda = (x) => (x.children || []).forEach((f) => {
        const c = (f.className || "").split(/\s+/);
        if (c.includes(cls) && c.includes("tem")) achou = true;
        anda(f);
      });
      anda(li); return achou;
    };
    ok(acesa("ed-doc"), "K5b a lampada do resumo ficou apagada com o resumo existindo");
    ok(acesa("ed-crt"), "K5c a lampada dos cartoes ficou apagada com cartao existindo");
    ok(aP.matChaveViva(disc, top) === variante,
       "K5d a chave viva nao encontrou a gaveta que tem o material");
  }

  /* ---- K6: marcar o trecho e gerar o prompt SO dele ---- */
  {
    const { api: aQ } = rodar();
    aQ.matIniciar(); aQ.qsUiIniciar();
    const cQ = aQ.matChave("D", "T");
    const texto = "Primeiro paragrafo, que nao interessa.\n\n"
      + "TRECHO ALVO com a materia das questoes.\n\n"
      + "Ultimo paragrafo, tambem fora.";
    aQ.matGravar(cQ, texto, { disciplina: "D", topico: "T" });
    aQ.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");

    /* DOIS BOTOES, UM POR ORIGEM: um botao so, que trocava de rotulo
     * conforme houvesse selecao, obrigava a ler para saber o que ia
     * acontecer — e "trecho marcado" ainda se confundia com as marcas
     * coloridas da mesma barra. */
    const bv = aQ.$("btnMatQstTrecho");
    const brz = aQ.$("btnMatQstResumo");
    ok(!!bv, "K6 sumiu o botao de criar questoes do trecho selecionado");
    ok(!!brz, "K6a sumiu o botao de criar questoes do resumo inteiro");
    if (bv && brz) {
    ok(bv.hidden === false, "K6b o botao existe mas nasceu escondido");
    ok(bv.disabled === true,
       "K6c sem selecao o botao do trecho tinha de estar apagado — e assim "
       + "que se ve, sem ler, que falta selecionar");
    ok(/selecionado/i.test(bv.textContent || ""),
       "K6c2 o rotulo nao fala em SELECAO: " + bv.textContent);
    ok(!/marcado/i.test(bv.textContent || ""),
       "K6c3 o rotulo voltou a dizer 'marcado', que e o nome das marcas coloridas");

    aQ.matPorSelecao("TRECHO ALVO com a materia das questoes.");
    aQ.qsUiPintarBotaoResumo();
    ok(bv.disabled === false, "K6d com trecho selecionado o botao continua apagado");
    ok(/caracteres/.test(bv.textContent || ""),
       "K6e o botao nao diz o tamanho do trecho, que e como se confere antes");
    ok(/caracteres/.test(brz.textContent || ""),
       "K6e2 o botao do resumo nao diz o tamanho — sem os dois numeros nao "
       + "da para comparar os caminhos");

    bv.onclick();
    const pr = aQ.$("qsCriarPrompt").value || "";
    ok(aQ.$("dlgQsCriar").open === true, "K6f nao abriu a criacao");
    ok(/TRECHO ALVO/.test(pr), "K6g o prompt saiu sem o trecho marcado");
    ok(!/Ultimo paragrafo/.test(pr),
       "K6h o prompt levou o resumo INTEIRO apesar do trecho marcado");
    ok(!/Primeiro paragrafo/.test(pr),
       "K6i o prompt levou texto de antes do trecho selecionado");

    /* e o botao do resumo leva TUDO, mesmo com trecho selecionado */
    aQ.$("dlgQsCriar").close();
    aQ.matPorSelecao("TRECHO ALVO com a materia das questoes.");
    brz.onclick();
    const pr2 = aQ.$("qsCriarPrompt").value || "";
    ok(/TRECHO ALVO/.test(pr2) && /Ultimo paragrafo/.test(pr2),
       "K6j o botao do resumo inteiro obedeceu a selecao em vez de levar tudo");
    }
  }

  /* ---- K7: so as que errei, ligando e desligando no meio ---- */
  {
    const { api: aR } = rodar();
    aR.matIniciar(); aR.qsUiIniciar();
    const cR = aR.matChave("D", "T");
    aR.matGravar(cR, "x", { disciplina: "D", topico: "T" });
    aR.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const blocos = [];
    for (let k = 1; k <= 4; k++) {
      blocos.push(`? CE :: FGV :: Afirmacao numero ${k}.\n= ${k % 2 ? "C" : "E"} :: coment ${k}.`);
    }
    aR.qsAplicar(aR.qsLerResposta(blocos.join("\n"),
      { disciplina: "D", topico: "T", chave: cR }).achados);
    aR.qsUiResponderDoTopico();

    const bf = aR.$("btnQsSoFalhas");
    ok(!!bf, "K7 falta o botao de filtrar as erradas");
    ok(bf.hidden === true,
       "K7b o filtro apareceu antes da primeira resposta, quando nao tem o que filtrar");

    /* responde TODAS marcando sempre "C": as de gabarito E ficam erradas */
    const num = (q) => (q ? q.enunciado.replace(/\D+/g, "") : "");
    for (let k = 0; k < 4; k++) {
      const ops = aR.$("qsSessCorpo").querySelectorAll(".qs-op");
      (ops.filter((o) => /^C\)/.test(o.textContent))[0] || ops[0]).onclick();
      aR.$("btnQsProxima").onclick();
    }
    const ses = aR.qsSessaoAtual();
    const erradas = ses.fila
      .filter((q) => { const r = ses.respondidas.filter((x) => x.id === q.id)[0];
                       return r && !r.acertou; })
      .map(num).sort().join(",");
    ok(erradas === "2,4", `K7c o exemplo devia deixar 2 erradas, deixou ${erradas}`);

    ok(bf.hidden === false, "K7d acabou a rodada e o filtro sumiu — e dali que se volta");
    ok(/2/.test(bf.textContent || ""),
       "K7e o botao nao diz quantas interessam: " + bf.textContent);

    bf.onclick();
    ok(aR.qsFiltroFalhasLigado() === true, "K7f o filtro nao ligou");
    ok(/✓/.test(aR.$("btnQsSoFalhas").textContent || ""),
       "K7g ligado, o botao nao mostra que esta ligado");

    const vistas = [];
    for (let g = 0; g < 6 && aR.qsAtual(); g++) {
      vistas.push(num(aR.qsAtual()));
      aR.$("btnQsProxima").onclick();
    }
    ok(vistas.sort().join(",") === "2,4",
       `K7h com o filtro passei por ${vistas.join(",")} — deviam ser so as erradas`);

    /* desligar devolve a rodada inteira, sem ter perdido nada */
    aR.$("btnQsSoFalhas").onclick();
    ok(aR.qsFiltroFalhasLigado() === false, "K7i o filtro nao desligou");
    ok(aR.qsSessaoAtual().fila.length === 4,
       "K7j o filtro RECORTOU a fila em vez de so pular — desligar nao devolveu tudo");
    ok(aR.qsPlacar().feitas === 4,
       "K7k ligar o filtro estragou o placar da rodada");
  }

  /* ---- K8: registrar so o percentual ---- */
  {
    const { api: aS } = rodar();
    aS.matIniciar(); aS.edIniciar();
    aS.abrirRegistro({ disciplina: "D", nome: "T",
      chave: aS.matChave("D", "T"), minutos: 30, feito: false });

    /* o cabecalho nao pode imprimir moldura vazia quando falta o plano */
    const sub = aS.$("regSub").textContent || "";
    ok(!/undefined/.test(sub), "K8 o cabecalho do registro mostrou 'undefined': " + sub);
    ok(!/peso ,/.test(sub), "K8b o cabecalho mostrou 'peso ,' — campo com cara de dado e sem dado");

    aS.regDeQuestoes(31, 27, 240);
    ok(aS.$("regQFeitas").value === "31", "K8c o fim da sessao nao pre-preencheu as feitas");
    ok(aS.$("regQCertas").value === "27", "K8d o fim da sessao nao pre-preencheu os acertos");

    const bp = aS.$("btnRegQSoPct");
    ok(!!bp, "K8e falta o marcador de registrar so o percentual");
    ok(aS.$("regQContagem").hidden === false && aS.$("regQSoPctCx").hidden === true,
       "K8f o registro nao comeca pela contagem exata");

    bp.onclick();
    ok(aS.$("regQContagem").hidden === true, "K8g ligar o percentual nao escondeu as contagens");
    ok(aS.$("regQSoPctCx").hidden === false, "K8h o campo de percentual nao apareceu");
    ok(aS.$("regQPctCampo").value === "87",
       "K8i o percentual devia vir calculado do que ja estava preenchido, veio "
       + aS.$("regQPctCampo").value);

    /* o que vai para o diario: percentual, sem contagem inventada */
    const d = aS.regQuestoesDoFormulario();
    ok(d && d.pct === 87, "K8j o registro nao levou o percentual");
    ok(d && d.feitas == null,
       "K8k inventou uma contagem que eu disse nao lembrar");
    ok(d && d.semContagem === true,
       "K8l o registro nao marca que a contagem nao foi informada");

    /* voltar atras nao apaga o que ja estava digitado */
    aS.$("btnRegQSoPct").onclick();
    ok(aS.$("regQFeitas").value === "31",
       "K8m voltar para a contagem exata apagou o que ja estava la");
    const d2 = aS.regQuestoesDoFormulario();
    ok(d2 && d2.feitas === 31 && d2.certas === 27,
       "K8n de volta na contagem, o registro nao leva os numeros");

    /* percentual em branco nao vira zero */
    aS.$("btnRegQSoPct").onclick();
    aS.$("regQPctCampo").value = "";
    ok(aS.regQuestoesDoFormulario() === null,
       "K8o campo vazio virou 0% — 'nao informei' e '0%' sao coisas diferentes");
  }

  /* ---- K9: encerrar a rodada com o placar que estiver ----
   * Antes so havia duas saidas: responder todas ou fechar a janela — e
   * fechar nao registrava nada, entao uma hora de estudo evaporava. */
  {
    const { api: aT } = rodar();
    aT.matIniciar(); aT.edIniciar(); aT.qsUiIniciar();
    const cT = aT.matChave("D", "T");
    aT.matGravar(cT, "x", { disciplina: "D", topico: "T" });
    aT.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const bl = [];
    for (let k = 1; k <= 5; k++) bl.push(`? CE :: FGV :: Afirmacao ${k}.\n= C :: coment.`);
    aT.qsAplicar(aT.qsLerResposta(bl.join("\n"),
      { disciplina: "D", topico: "T", chave: cT }).achados);
    aT.qsUiResponderDoTopico();

    const be = aT.$("btnQsEncerrar");
    ok(!!be, "K9 falta o botao de encerrar com o placar atual");
    ok(be.hidden === true,
       "K9b o encerrar apareceu antes da primeira resposta, sem placar nenhum");

    const resp = () => {
      const ops = aT.$("qsSessCorpo").querySelectorAll(".qs-op");
      (ops.filter((o) => /^C\)/.test(o.textContent))[0] || ops[0]).onclick();
    };
    resp(); aT.$("btnQsProxima").onclick(); resp();
    ok(aT.$("btnQsEncerrar").hidden === false, "K9c o encerrar nao apareceu");
    ok(/2/.test(aT.$("btnQsEncerrar").textContent || ""),
       "K9d o botao nao mostra o placar que vai levar: " + aT.$("btnQsEncerrar").textContent);

    /* DUAS perguntas: a rodada acaba e as pendentes voltam a ser pendentes */
    const p1 = aT.qsUiEncerrarComPlacar();
    ok(aT.uiPerguntando() === true, "K9e encerrou sem perguntar nada");
    ok(/3/.test(aT.$("uiModalMsg").textContent || ""),
       "K9f a pergunta nao diz quantas ficam pendentes: "
       + (aT.$("uiModalMsg").textContent || "").slice(0, 70));
    aT.uiModalResponder(false);
    await p1;
    ok(aT.$("dlgQsResponder").open === true,
       "K9g respondi NAO na primeira pergunta e a rodada acabou assim mesmo");

    const p2 = aT.qsUiEncerrarComPlacar();
    aT.uiModalResponder(true);
    await new Promise((r) => setTimeout(r, 0));
    ok(aT.uiPerguntando() === true,
       "K9h faltou a SEGUNDA confirmacao — o gesto e irreversivel para a rodada");
    aT.uiModalResponder(false);
    await p2;
    ok(aT.$("dlgQsResponder").open === true,
       "K9i respondi NAO na segunda pergunta e a rodada acabou assim mesmo");
    ok(aT.qsPlacar().feitas === 2, "K9j o placar mudou por causa de um cancelamento");

    const p3 = aT.qsUiEncerrarComPlacar();
    aT.uiModalResponder(true);
    await new Promise((r) => setTimeout(r, 0));
    aT.uiModalResponder(true);
    await p3;
    ok(aT.$("dlgQsResponder").open === false, "K9k a rodada nao encerrou");
    ok(aT.$("dlgRegistro").open === true,
       "K9l encerrar nao levou ao registro de estudo — que e o motivo do botao");
    ok(aT.$("regQFeitas").value === "2",
       "K9m o registro nao veio com o placar parcial: " + aT.$("regQFeitas").value);
    ok(aT.$("regQCertas").value === "2",
       "K9n o registro nao veio com os acertos: " + aT.$("regQCertas").value);
  }

  /* ---- K10: melhorar uma questao torta ----
   * O caso de referencia e real: veio com a RESOLUCAO dentro do
   * enunciado, conversa da IA no meio, cabecalho de simulado, markdown
   * cru e emoji. Cinco defeitos numa questao so. */
  {
    const { api: aU } = rodar();
    aU.matIniciar(); aU.edIniciar(); aU.qsUiIniciar();
    const cU = aU.matChave("Direito Financeiro", "Financas Publicas");
    aU.matGravar(cU, "x", { disciplina: "Direito Financeiro", topico: "Financas Publicas" });
    aU.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Financas Publicas" }, "ler");

    const torta = "? CE :: FGV :: * *Contexto*: O Municipio Alfa aprovou lei "
      + "majorando o ISS. * *Resolucao*: A vinculacao e inconstitucional, viola "
      + "o Art. 167, IV. --- Que tal criarmos um simulado das pegadinhas da FGV? "
      + "Excelente! Preparei um Simulado Seletivo. --- SIMULADO DE FINANCAS "
      + "PUBLICAS: ART. 167\n= C :: coment.";
    aU.qsAplicar(aU.qsLerResposta(torta,
      { disciplina: "Direito Financeiro", topico: "Financas Publicas", chave: cU }).achados);
    aU.qsUiResponderDoTopico();

    const original = aU.qsFiltrar({})[0];
    const defeitos = aU.qsDefeitos(original).map((d) => d.id);
    ok(defeitos.indexOf("resolucao") >= 0,
       "K10 nao viu que a RESPOSTA esta dentro do enunciado — o defeito que "
       + "faz a questao se responder sozinha. Achou: " + JSON.stringify(defeitos));
    ok(defeitos.indexOf("conversa") >= 0,
       "K10b nao viu a conversa da IA no meio do enunciado");
    ok(defeitos.indexOf("markdown") >= 0, "K10c nao viu o markdown cru");

    const bm = aU.$("btnQsMelhorar");
    ok(!!bm && bm.hidden === false, "K10d falta o botao de melhorar a questao");
    ok(/\d/.test(bm.textContent || ""),
       "K10e o botao nao avisa quantos problemas tem: " + bm.textContent);
    ok(/qm-alerta/.test(bm.className || ""),
       "K10f questao com defeito nao se anuncia — a pessoa teria de desconfiar sozinha");

    bm.onclick();
    ok(aU.$("dlgQsMelhorar").open === true, "K10g a janela de correcao nao abriu");
    ok(aU.$("qmDefeitos").querySelectorAll(".qm-def").length >= 3,
       "K10h a janela nao lista os defeitos encontrados");
    const pr = aU.$("qmPrompt").value || "";
    ok(/\[QUESTAO\]/.test(pr), "K10i o prompt nao ensina o formato de volta");
    ok(/TIPO: CE/.test(pr), "K10j o prompt nao fixa o tipo da questao original");
    ok(/n[aã]o pode conter a resposta/i.test(pr),
       "K10k o prompt nao proibe a resposta dentro do enunciado, que era o "
       + "defeito principal do caso real");
    ok(!/\{tipo\}|\{defeitos\}|\{atual\}/.test(pr),
       "K10l sobrou marcador de substituicao no prompt");

    /* responder ANTES de corrigir, para provar que o historico sobrevive */
    aU.$("dlgQsMelhorar").close();
    aU.$("qsSessCorpo").querySelectorAll(".qs-op")[0].onclick();
    const tentativas = (aU.qsFiltrar({})[0].tentativas || []).length;
    ok(tentativas === 1, "K10m a resposta nao entrou no historico");

    aU.$("btnQsMelhorar").onclick();
    /* colagem que nao e questao nao pode virar questao */
    aU.$("qmColar").value = "desculpe, nao entendi seu pedido";
    aU.$("btnQmConferir").onclick();
    aU.uiModalResponder(true);
    ok(aU.$("btnQmAplicar").hidden === true,
       "K10n resposta que nao e questao habilitou o aplicar");

    aU.$("qmColar").value = ["[QUESTAO]", "TIPO: CE", "BANCA: FGV",
      "ENUNCIADO: O Municipio Alfa vinculou a receita adicional do ISS a "
      + "habitacoes populares. Nesse caso, a vinculacao e constitucional.",
      "GABARITO: E", "COMENTARIO: Viola o art. 167, IV, da CF.", "[/QUESTAO]"].join("\n");
    aU.$("btnQmConferir").onclick();
    ok(aU.$("qmComparar").hidden === false,
       "K10o nao mostrou o antes e o depois — aplicar as cegas e confiar na "
       + "IA justamente onde ela ja errou");
    const lados = aU.$("qmComparar").querySelectorAll(".qm-lado");
    ok(lados.length === 2, `K10p deviam ser dois lados, sao ${lados.length}`);
    ok(/Resolucao/.test(lados[0].textContent || ""),
       "K10q o lado 'como esta' nao mostra a questao atual");
    ok(/vinculou a receita/.test(lados[1].textContent || ""),
       "K10r o lado 'como ficaria' nao mostra a versao nova");
    ok(aU.$("btnQmAplicar").hidden === false, "K10s o aplicar nao apareceu");

    aU.$("btnQmAplicar").onclick();
    aU.uiModalResponder(true);
    const dep = aU.qsFiltrar({})[0];
    ok(dep.id === original.id,
       "K10t a correcao criou uma questao NOVA em vez de consertar a mesma");
    ok((dep.tentativas || []).length === tentativas,
       "K10u a correcao apagou o historico de respostas da questao");
    ok(/vinculou a receita/.test(dep.enunciado || ""),
       "K10v o enunciado nao foi trocado");
    ok(dep.gabarito === "E", "K10w o gabarito corrigido nao entrou: " + dep.gabarito);
    ok(aU.qsDefeitos(dep).length === 0,
       "K10x a versao aplicada ainda tem defeito: "
       + JSON.stringify(aU.qsDefeitos(dep).map((d) => d.id)));
    ok(aU.$("dlgQsMelhorar").open === false, "K10y a janela nao fechou depois de aplicar");
  }

  /* ---- K11: acao destrutiva fora da linha de frente ----
   * "Apagar" em vermelho ao lado de "responder" atraia mais o olho que
   * a acao principal — e o alvo errado num toque de celular leva junto
   * o historico da questao. */
  {
    const { api: aV } = rodar();
    aV.matIniciar(); aV.qsUiIniciar();
    const cV = aV.matChave("D", "T");
    aV.matGravar(cV, "x", { disciplina: "D", topico: "T" });
    aV.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    aV.qsAplicar(aV.qsLerResposta("? CE :: FGV :: Uma afirmacao qualquer.\n= C :: c.",
      { disciplina: "D", topico: "T", chave: cV }).achados);
    aV.qsUiRender();

    const item = aV.$("qsLista").querySelectorAll(".qs-item")[0];
    ok(!!item, "K11 a questao nao apareceu na lista");
    const acha = (cls) => {
      let r = null;
      const anda = (x) => (x.children || []).forEach((f) => {
        if ((f.className || "").split(/\s+/).includes(cls)) r = f;
        anda(f);
      });
      anda(item); return r;
    };
    const rotulos = () => {
      const L = [];
      const anda = (x) => (x.children || []).forEach((f) => {
        if (/btn/.test(f.className || "")) L.push(f.textContent);
        anda(f);
      });
      anda(item); return L;
    };

    const antes = rotulos();
    ok(!antes.some((x) => /apagar/i.test(x)),
       "K11b o apagar continua exposto ao lado do responder: " + JSON.stringify(antes));
    ok(antes.some((x) => /responder/i.test(x)),
       "K11c sumiu o responder junto com a limpeza");
    ok(!!acha("qs-item-mais"), "K11d falta o menu ⋮ que guarda o apagar");

    acha("qs-item-mais").onclick();
    const depois = rotulos();
    ok(depois.some((x) => /apagar/i.test(x)),
       "K11e o apagar nao esta alcancavel pelo ⋮ — esconder nao pode virar sumir");

    /* e continua pedindo confirmacao mostrando o que se perde */
    const bDel = (() => {
      let r = null;
      const anda = (x) => (x.children || []).forEach((f) => {
        if (/apagar/i.test(f.textContent || "") && /btn/.test(f.className || "")) r = f;
        anda(f);
      });
      anda(item); return r;
    })();
    const pd = bDel.onclick();
    ok(aV.uiPerguntando() === true, "K11f apagou sem perguntar");
    ok(/afirmacao qualquer/.test(aV.$("uiModalMsg").textContent || ""),
       "K11g a pergunta nao mostra QUAL questao vai sumir");
    aV.uiModalResponder(false);
    await pd;
    ok(aV.qsFiltrar({}).length === 1, "K11h respondi NAO e apagou assim mesmo");
  }

  /* ---- K12: hierarquia do card de questao ----
   * A lista parecia um muro: tipo, banca, disciplina, topico e concurso
   * na mesma linha de texto miudo, disputando com o enunciado — que e a
   * unica coisa que se le para decidir se vale responder. */
  {
    const { api: aW } = rodar();
    aW.matIniciar(); aW.qsUiIniciar();
    const cW = aW.matChave("Direito Financeiro", "Restos a pagar");
    aW.matGravar(cW, "x", { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
    aW.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Restos a pagar" }, "ler");
    aW.qsAplicar(aW.qsLerResposta("? CE :: FGV :: Afirmacao para julgar.\n= C :: c.",
      { disciplina: "Direito Financeiro", topico: "Restos a pagar", chave: cW }).achados);
    aW.qsUiRender();

    const item = aW.$("qsLista").querySelectorAll(".qs-item")[0];
    ok(!!item, "K12 a questao nao apareceu na lista");
    const camadas = () => {
      const L = [];
      const anda = (x) => (x.children || []).forEach((f) => {
        const c = (f.className || "").split(/\s+/);
        ["qs-item-cab", "qs-item-en", "qs-item-acoes", "qs-item-hist"]
          .forEach((k) => { if (c.includes(k)) L.push(k); });
        anda(f);
      });
      anda(item); return L;
    };
    const ordem = camadas();
    ok(ordem.indexOf("qs-item-cab") === 0,
       "K12b as etiquetas nao estao no topo: " + ordem.join(","));
    ok(ordem.indexOf("qs-item-en") === 1,
       "K12c o enunciado nao vem logo depois das etiquetas: " + ordem.join(","));

    const tags = item.querySelectorAll(".qs-tag").map((x) => x.textContent);
    ok(tags.length >= 2,
       "K12d o cabecalho nao virou etiquetas: " + JSON.stringify(tags));
    ok(tags.indexOf("FGV") >= 0, "K12e a banca saiu das etiquetas");
    ok(!tags.join(" ").includes("Restos a pagar"),
       "K12f o topico continua ocupando a linha de cima; ele e contexto, "
       + "e o lugar dele e a dica");
    const cab = item.querySelectorAll(".qs-item-cab")[0];
    ok(/Restos a pagar/.test((cab && cab.title) || ""),
       "K12g o topico sumiu de vez — sair da tela nao pode virar sair do app");

    /* historico vai para a BASE, depois das acoes */
    aW.qsUiResponderAbrir(aW.qsFiltrar({}), "aba", "t");
    aW.$("qsSessCorpo").querySelectorAll(".qs-op")[0].onclick();
    aW.$("dlgQsResponder").close();
    aW.qsUiRender();
    const item2 = aW.$("qsLista").querySelectorAll(".qs-item")[0];
    const L2 = [];
    const anda2 = (x) => (x.children || []).forEach((f) => {
      const c = (f.className || "").split(/\s+/);
      ["qs-item-en", "qs-item-acoes", "qs-item-hist"]
        .forEach((k) => { if (c.includes(k)) L2.push(k); });
      anda2(f);
    });
    anda2(item2);
    ok(L2.indexOf("qs-item-hist") === L2.length - 1,
       "K12h a estatistica de acerto nao esta na base do card: " + L2.join(","));
    ok(L2.indexOf("qs-item-hist") > L2.indexOf("qs-item-en"),
       "K12i a estatistica ficou antes do enunciado");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  Promise.resolve(testes()).then((f) => {
    f.forEach((x) => console.log("  FALHA  " + x));
    console.log(f.length ? `\nquestoes-ui: ${f.length} FALHA(S)\n`
      : `\nquestoes-ui: criar, responder e a aba ok (${f.quantas} verificacoes)\n`);
    process.exit(f.length ? 1 : 0);
  });
}
