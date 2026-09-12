/* =====================================================================
 * A RODADA TERMINADA NÃO PODE SUMIR ANTES DE SER REGISTRADA
 *
 * O DEFEITO, relatado com a rodada inteira perdida: respondidas as 32
 * de 32, a tela apagava a sessão guardada — "já terminou, não há o que
 * retomar". Quem fechasse sem tocar em "registrar" perdia o placar, e
 * ao reabrir era jogado numa rodada NOVA, do zero, sem nenhum caminho
 * de volta para lançar a hora estudada.
 *
 * O ERRO DE PROJETO está em confundir duas perguntas:
 *   · "sobrou questão para responder?"      → continuar de onde parei
 *   · "esta rodada já virou estudo lançado?" → registrar
 *
 * Enquanto a resposta à segunda for não, a rodada continua existindo —
 * mesmo com tudo respondido.
 *
 * O QUE PRECISA SER VERDADE:
 * 1. Terminada e não registrada, a rodada SOBREVIVE ao fechamento.
 * 2. Ao reabrir, o que se oferece é REGISTRAR, não "continuar" — não há
 *    o que continuar.
 * 3. Registrada, ela some: reabrir não pode pedir um segundo
 *    lançamento das mesmas horas.
 * 4. E o registro só conta depois de CONFIRMADO no formulário.
 * 5. Andar para trás não mexe no placar: andar não é responder.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* Uma rodada de três questões, todas do mesmo tópico — o registro
   * exige tópico único, e misturar não é o que está sob teste aqui. */
  const montar = (api) => {
    const qs = [1, 2, 3].map((k) => ({
      id: "q" + k, enunciado: "enunciado " + k, tipo: "ce",
      gabarito: "C", opcoes: null,
      disciplina: "Direito Tributário", topico: "Princípios",
      chave: api.matChave("Direito Tributário", "Princípios"),
    }));
    api.qsBancoPor(qs);
    return qs;
  };

  const responderTudo = (api) => {
    for (let k = 0; k < 3; k++) {
      api.qsResponder(k === 0 ? "C" : "E");
      api.qsAndar(1);
    }
  };

  /* ==============================================================
   * R1: TERMINADA E NÃO REGISTRADA, A RODADA SOBREVIVE
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    responderTudo(api);

    ok(api.qsPendentes().length === 0,
       "R1-pre a rodada não terminou: " + api.qsPendentes().length);
    const r = api.qsSessaoRetomavel("teste");
    ok(!!r,
       "R1 a rodada terminada foi apagada: quem fechou sem registrar "
       + "perdeu o placar, e reabrir começa do zero sem nenhum caminho "
       + "de volta para lançar a hora estudada");
    ok(r && r.terminada === true,
       "R1a a rodada terminada se anuncia como se ainda houvesse "
       + "questão pendente — e 'continuar de onde parei' não quer dizer "
       + "nada quando não sobrou nenhuma: " + JSON.stringify(r));
    ok(r && r.feitas === 3 && r.total === 3,
       "R1b o placar guardado não bate com o que foi respondido: "
       + JSON.stringify(r));
  }

  /* ==============================================================
   * R2: REGISTRADA, ELA SOME
   *
   * Oferecer de novo pediria um SEGUNDO lançamento das mesmas horas —
   * e horas contadas duas vezes desmontam a cobertura da disciplina
   * tanto quanto horas perdidas.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    responderTudo(api);
    api.qsSessaoRegistrada();
    ok(api.qsSessaoRetomavel("teste") === null,
       "R2 a rodada JÁ REGISTRADA continua sendo oferecida: aceitar "
       + "lançaria as mesmas horas uma segunda vez");
  }

  /* ---- R2a: e a marca sobrevive a uma gravação seguinte ----
   * Sem o campo em qsSessaoGravar, qualquer gravação posterior
   * (embaralhar, responder mais uma) apagaria a marca em silêncio. */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    responderTudo(api);
    api.qsSessaoRegistrada();
    api.qsAndar(-1);            /* qualquer gesto que regrave a sessão */
    ok(api.qsSessaoRetomavel("teste") === null,
       "R2a a marca de 'já registrada' foi apagada pela gravação "
       + "seguinte, e a rodada voltou a pedir lançamento");
  }

  /* ---- R3: rodada nem começada não é oferecida ----
   * Perguntar "quer continuar?" sobre uma rodada de zero respostas é
   * ruído: não há nada a continuar nem a registrar. */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    ok(api.qsSessaoRetomavel("teste") === null,
       "R3 uma rodada sem nenhuma resposta é oferecida para retomar");
  }

  /* ---- R4: pela metade continua sendo 'continuar', não 'registrar' ---- */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    api.qsResponder("C");
    const r = api.qsSessaoRetomavel("teste");
    ok(r && r.terminada === false,
       "R4 uma rodada pela metade se anuncia como terminada, e a tela "
       + "vai oferecer registrar em vez de continuar: " + JSON.stringify(r));
  }

  /* ==============================================================
   * R5: O REGISTRO SÓ CONTA DEPOIS DE CONFIRMADO
   *
   * Marcar na ABERTURA do formulário repetiria o defeito por outro
   * caminho: quem fechasse sem gravar teria a rodada dada por lançada
   * tendo registrado nada.
   * ============================================================== */
  {
    const { api } = rodar();
    try { api.edIniciar(); } catch (e) {}
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    responderTudo(api);
    api.qsUiRegistrarEstudo();
    ok(api.$("dlgRegistro").open === true,
       "R5-pre o formulário de registro não abriu");
    api.$("btnRegFechar").onclick();
    ok(api.qsSessaoRetomavel("teste") !== null,
       "R5 fechar o formulário sem gravar deu a rodada por registrada: "
       + "o placar some e nada foi lançado no diário");
  }

  /* ---- R5a: confirmando, ela é dada por lançada ---- */
  {
    const { api } = rodar();
    try { api.edIniciar(); } catch (e) {}
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    responderTudo(api);
    api.qsUiRegistrarEstudo();
    api.confirmarRegistro("feito");
    ok(api.qsSessaoRetomavel("teste") === null,
       "R5a depois de registrada e confirmada, a rodada continua sendo "
       + "oferecida — e aceitar lançaria as horas de novo");
  }

  /* ==============================================================
   * R6: ANDAR PARA TRÁS NÃO É RESPONDER
   *
   * "Pular" sempre existiu e vai para a frente. Faltava reler a
   * anterior — e o único jeito era encerrar a rodada.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    api.qsResponder("C");
    api.qsAndar(1);
    const antes = api.qsPlacar();
    api.qsAndar(-1);
    const dep = api.qsPlacar();
    ok(dep.feitas === antes.feitas && dep.certas === antes.certas,
       "R6 voltar uma questão mexeu no placar: andar não é responder — "
       + JSON.stringify(antes) + " virou " + JSON.stringify(dep));
    ok(api.qsAtual() && api.qsAtual().id === "q1",
       "R6a voltar não levou para a questão anterior: "
       + (api.qsAtual() && api.qsAtual().id));
  }

  /* ---- R6b: e o botão só aparece quando há para onde voltar ---- */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    api.qsUiPintarSessao();
    /* O BOTÃO PODE NÃO EXISTIR, e o teste tem de dizer isso em vez de
     * estourar: a sabotagem que o removia do HTML derrubava este arquivo
     * com "reading 'hidden' of null" — uma falha de teste disfarçada de
     * falha do app. O app trata a ausência certo (if ($(...))); era só o
     * teste que assumia presença. */
    const bV = () => api.$("btnQsVoltar");
    ok(bV() && bV().hidden === true,
       "R6b o botão de voltar aparece na PRIMEIRA questão, onde ele não "
       + "tem para onde ir (ou nem existe): " + JSON.stringify(!!bV()));
    api.qsResponder("C");
    api.qsAndar(1);
    api.qsUiPintarSessao();
    ok(bV() && bV().hidden === false,
       "R6c da segunda questão em diante o botão de voltar continua "
       + "escondido (ou nem existe), e reler a anterior exige encerrar a "
       + "rodada: " + JSON.stringify(!!bV()));
  }

  /* ==============================================================
   * R7: O CABEÇALHO DIZ ONDE VOCÊ ESTÁ, e não só quanto já fez
   *
   * O RELATO: "1 de 32 não se altera ao pular ou voltar". A conta era
   * respondidas+1 — progresso disfarçado de posição. Com zero
   * respondidas ele dizia "1 de 32" estivesse você na primeira questão
   * ou na décima, e pular, que é o gesto de andar SEM responder, não
   * mexia em nada.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    ok(api.qsPosicao().pos === 1,
       "R7-pre a rodada não começa na primeira: " + api.qsPosicao().pos);

    api.qsPular();
    ok(api.qsPosicao().pos === 2,
       "R7 pular não mudou a posição: o cabeçalho continua dizendo que "
       + "você está na primeira questão enquanto lê a segunda — "
       + api.qsPosicao().pos);
    /* e pular NÃO conta como resposta */
    ok(api.qsPlacar().feitas === 0,
       "R7a pular entrou no placar como resposta: pular não é errar nem "
       + "acertar — " + JSON.stringify(api.qsPlacar()));

    api.qsAndar(-1);
    ok(api.qsPosicao().pos === 1,
       "R7b voltar não mudou a posição: " + api.qsPosicao().pos);
    ok(api.qsPlacar().feitas === 0,
       "R7c voltar mexeu no placar: " + JSON.stringify(api.qsPlacar()));
  }

  /* ---- R7d: e a tela escreve a posição, não a contagem ---- */
  {
    const { api } = rodar();
    montar(api);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "teste" });
    api.qsUiPintarSessao();
    const um = String(api.$("qsSessPlacar").textContent || "");
    api.qsPular();
    api.qsUiPintarSessao();
    const dois = String(api.$("qsSessPlacar").textContent || "");
    ok(um !== dois,
       "R7d o cabeçalho não mudou ao pular — é a queixa literal: “"
       + um + "” continuou igual");
    ok(/2/.test(dois),
       "R7e o cabeçalho não diz que você está na segunda: “" + dois + "”");
    ok(/0/.test(dois),
       "R7f o cabeçalho perdeu a contagem de respondidas: as duas "
       + "informações importam, e uma não substitui a outra: “" + dois + "”");
  }

  /* ---- R8: a fila de andar tem o passo principal no meio ----
   * ◀ anterior · PRÓXIMA · pular ▶ — o que anda para trás à esquerda, o
   * que anda para a frente à direita. Separados em duas faixas, os dois
   * ficavam perdidos entre "abrir rascunho" e "melhorar esta questão",
   * que não têm nada a ver com mudar de questão. */
  {
    const fs2 = require("fs"), path2 = require("path");
    const html = fs2.readFileSync(
      path2.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i = html.indexOf('class="qs-barra qs-barra-principal"');
    const fim = html.indexOf("</div>", i);
    const faixa = html.slice(i, fim);
    const iV = faixa.indexOf('id="btnQsVoltar"');
    const iP = faixa.indexOf('id="btnQsProxima"');
    const iS = faixa.indexOf('id="btnQsPular"');
    ok(iV >= 0 && iP >= 0 && iS >= 0,
       "R8 os três botões de andar não estão na mesma faixa: "
       + JSON.stringify({ voltar: iV, proxima: iP, pular: iS }));
    ok(iV >= 0 && iP >= 0 && iS >= 0 && iV < iP && iP < iS,
       "R8a a ordem não é anterior · próxima · pular: "
       + JSON.stringify({ voltar: iV, proxima: iP, pular: iS }));
  }

  /* ==============================================================
   * R9: OS BOTÕES DE DIFICULDADE
   *
   * O RELATO: "não estão funcionando". Do lado de dentro funcionavam —
   * o clique trocava o estado e a repintura acontecia. O que faltava
   * era a tela DIZER isso: só havia estilo para ".reg-humor.ativa"
   * combinado com as três classes do HUMOR, e os de dificuldade usam
   * "dif-alta/dif-media/dif-baixa". A classe entrava e não pintava.
   *
   * E o efeito colateral é pior que a aparência: tocar no botão já
   * aceso DESMARCA. Quem toca, não vê reação e toca de novo, apaga a
   * avaliação que acabou de dar — e sai da tela achando que declarou
   * "inseguro" quando não declarou nada.
   *
   * AO QUE ISTO ESTÁ LIGADO, e por que mexer aqui é delicado: o nível
   * vira FATOR (alta 1.5 · media 1.0 · baixa 0.7), o fator multiplica o
   * "bruto" e produz o "brutoOrdem", e é o brutoOrdem que ordena a
   * agenda e calcula a faixa de prioridade. O "bruto" cru continua
   * intocado — é ele que alimenta a cobertura e os mínimos por bloco.
   * Essa separação é o que impede que uma opinião sobre dificuldade
   * mexa no cumprimento de mínimos do edital.
   * ============================================================== */
  {
    const { api } = rodar();
    try { api.edIniciar(); } catch (e) {}
    const item = { nome: "Princípios", disciplina: "Direito Tributário",
                   chave: api.matChave("Direito Tributário", "Princípios"),
                   minutos: 30 };
    api.abrirRegistro(item);

    const botoes = () => Array.from(api.$("regDificuldade").children || [])
      .filter((b) => (b.tag || "") === "button");
    ok(botoes().length === 3,
       "R9-pre a fileira de dificuldade não tem os três níveis: "
       + botoes().length);

    const alta = botoes().filter((b) => /dif-alta/.test(b.className || ""))[0];
    ok(!!alta && typeof alta.onclick === "function",
       "R9 o botão de dificuldade não tem ação ligada");
    /* GUARDA CONTRA CRASH — E ELA MESMA FOI UM DEFEITO.
     *
     * A primeira versão fazia "return" daqui, e "return" dentro de
     * testes() ABANDONA O ARQUIVO INTEIRO: as asserções escritas
     * depois deixaram de rodar, e cinco sabotagens seguidas passaram
     * verdes porque não havia mais teste nenhum para falhar. Foi a
     * própria sabotagem que denunciou — cinco "PASSOU (VÁCUO!)" em
     * fila não são cinco acasos.
     *
     * O certo é PULAR este bloco e seguir; "return" faz outra coisa
     * muito parecida, e a diferença só aparece nas asserções de
     * baixo — que é onde ela não pode ser vista. */
    if (alta && typeof alta.onclick === "function") {
    alta.onclick();

    const dep = botoes().filter((b) => /dif-alta/.test(b.className || ""))[0];
    ok(dep && /(^| )ativa( |$)/.test(dep.className || ""),
       "R9a tocar no nível não o deixou aceso: " + (dep && dep.className));

    /* ---- R9b: e só UM aceso por vez ----
     * Dois níveis marcados ao mesmo tempo não querem dizer nada, e o que
     * seria gravado dependeria da ordem do laço. */
    const acesos = botoes().filter((b) => /(^| )ativa( |$)/.test(b.className || ""));
    ok(acesos.length === 1,
       "R9b " + acesos.length + " níveis acesos ao mesmo tempo: o que "
       + "for gravado passa a depender da ordem do laço");

    /* ---- R9c: e o nível chega ao mapa de dificuldade ao confirmar ---- */
    api.confirmarRegistro("feito");
    const nv = api.difDe("Direito Tributário", "Princípios");
    ok(nv && nv.nivel === "alta",
       "R9c a dificuldade declarada não foi gravada: a agenda continua "
       + "tratando o tópico como se você não tivesse dito nada — "
       + JSON.stringify(nv));
    ok(nv && nv.origem === "declarada",
       "R9d a dificuldade foi gravada como PALPITE (origem 'sessao') e "
       + "não como declaração sua: um palpite vence e é substituído pelo "
       + "humor da próxima sessão — " + JSON.stringify(nv && nv.origem));
    }
  }

  /* ---- R9e: tocar de novo desmarca, e isso é intencional ----
   * É como se tira uma opinião sem ter de escolher outra. Só faz
   * sentido se o aceso for visível; sem isso, é o segundo toque de quem
   * achou que o primeiro não funcionou. */
  {
    const { api } = rodar();
    try { api.edIniciar(); } catch (e) {}
    api.abrirRegistro({ nome: "T", disciplina: "D",
                        chave: api.matChave("D", "T"), minutos: 30 });
    const pega = () => Array.from(api.$("regDificuldade").children || [])
      .filter((b) => /dif-alta/.test(b.className || ""))[0];
    pega().onclick();
    pega().onclick();
    const acesos = Array.from(api.$("regDificuldade").children || [])
      .filter((b) => /(^| )ativa( |$)/.test(b.className || ""));
    ok(acesos.length === 0,
       "R9e tocar duas vezes no mesmo nível não desmarcou: não há como "
       + "tirar uma opinião sem escolher outra");
  }

  /* ==============================================================
   * R10: A DIFICULDADE MEXE NA ORDEM, E NÃO NOS MÍNIMOS
   *
   * É a rede que protege o resto do motor. O fator multiplica o
   * "brutoOrdem" (que ordena a agenda); o "bruto" cru continua sendo o
   * peso do edital, e é ele que alimenta a cobertura e os mínimos por
   * bloco. Sem essa separação, dizer "domino" sobre um tópico
   * encolheria a obrigação da disciplina inteira — uma opinião sobre
   * dificuldade apagando uma regra do edital.
   * ============================================================== */
  {
    const { api } = rodar();
    /* O FORMATO DO EDITAL É "@ disciplina :: peso" e "+ tópico :: peso".
     * A primeira versão deste teste usou "Direito Tributário (peso 3)",
     * que o leitor ignora inteiro — e o plano saiu com ZERO itens. As
     * duas asserções abaixo falharam por falta de dado, não por defeito
     * no motor: um falso vermelho, que gasta o mesmo tempo de
     * investigação de um verdadeiro. */
    const r = api.lerEdital([
      "# Teste | prova: 2026-12-01 | horas: 10",
      "@ Direito Tributário :: 3",
      "+ Princípios :: 4",
      "+ Imunidades :: 4",
    ].join("\n"));
    const semFator = api.montarPlano(r, { fatores: {}, acertos: {} });
    const comFator = api.montarPlano(r, {
      fatores: { [api.matChave("Direito Tributário", "Princípios")]: 1.5 },
      acertos: {},
    });
    const acha = (p, nome) => p.itens.filter((x) => x.nome === nome)[0];
    const a1 = acha(semFator, "Princípios");
    const a2 = acha(comFator, "Princípios");
    ok(a1 && a2 && a2.bruto === a1.bruto,
       "R10 o fator de dificuldade mexeu no BRUTO — que é o peso do "
       + "edital e alimenta a cobertura e os mínimos por bloco. Dizer "
       + "'domino' passaria a encolher a obrigação da disciplina: "
       + JSON.stringify({ sem: a1 && a1.bruto, com: a2 && a2.bruto }));
    ok(a1 && a2 && a2.brutoOrdem > a1.brutoOrdem,
       "R10a o fator NÃO mexeu na ordem — então declarar 'inseguro' não "
       + "faz o tópico subir na agenda, que é a única coisa que o botão "
       + "promete: " + JSON.stringify({ sem: a1 && a1.brutoOrdem,
                                        com: a2 && a2.brutoOrdem }));
  }

  /* ==============================================================
   * R11: OS TRÊS BOTÕES DE QUESTÃO DO RESUMO
   *
   * O RELATO: "não sei informar se existem ou não questões". Os três
   * começavam com ❓ e tinham a mesma forma, mas fazem coisas
   * diferentes: um RESPONDE o que já existe, dois CRIAM (de origens
   * diferentes). Pior: o de responder ficava aceso mesmo com zero
   * questões, e clicá-lo só abria um alerta dizendo que não havia
   * nenhuma — então ele parecia um terceiro jeito de criar que falhava.
   * ============================================================== */
  {
    const { api } = rodar();
    api.qsBancoPor([]);
    api.matGravar(api.matChave("D", "T"), "um resumo qualquer",
      { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.qsUiPintarBotaoResumo();

    const bResp = api.$("btnMatQuestoes");
    ok(bResp && bResp.hidden === true,
       "R11 sem nenhuma questão guardada, o botão de RESPONDER continua "
       + "na fila: com dois botões de criar ao lado, ele vira um "
       + "terceiro caminho para o mesmo lugar, com o rótulo errado");

    const rot = (id) => String((api.$(id) || {}).textContent || "");
    ok(!/^\s*❓/.test(rot("btnMatQstTrecho")),
       "R11a os botões continuam começando com o mesmo ícone do de "
       + "responder, e a fila se lê como variações de um só: "
       + rot("btnMatQstTrecho"));
    ok(rot("btnMatQstTrecho").indexOf("criar") >= 0
       && rot("btnMatQstResumo").indexOf("criar") >= 0,
       "R11b os dois botões que CRIAM não dizem o verbo: "
       + rot("btnMatQstTrecho") + " | " + rot("btnMatQstResumo"));
    api.qsBancoPor([{ id: "q9", enunciado: "e", tipo: "ce", gabarito: "C",
                      disciplina: "D", topico: "T",
                      chave: api.matChave("D", "T") }]);
    api.qsUiPintarBotaoResumo();
    ok(rot("btnMatQuestoes").indexOf("criar") < 0
       && /responder/i.test(rot("btnMatQuestoes")),
       "R11c o botão de RESPONDER não diz o verbo dele, ou diz 'criar' "
       + "como os outros dois: " + rot("btnMatQuestoes"));
  }

  /* ---- R11d: com questões guardadas, o de responder acende ---- */
  {
    const { api } = rodar();
    api.qsBancoPor([{ id: "q1", enunciado: "e", tipo: "ce", gabarito: "C",
                      disciplina: "D", topico: "T",
                      chave: api.matChave("D", "T") }]);
    api.matGravar(api.matChave("D", "T"), "resumo", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.qsUiPintarBotaoResumo();
    ok(api.$("btnMatQuestoes").disabled === false,
       "R11d com questão guardada o botão de responder continua "
       + "desabilitado");
  }

  /* ==============================================================
   * R12: TRECHO CURTO DEMAIS NÃO VIRA QUESTÃO
   *
   * O relato veio com "31 caracteres" no rótulo do botão — um título,
   * meia frase. O prompt sai sem contexto e a IA devolve questões sobre
   * coisa nenhuma, que entram no banco e semanas depois são respondidas
   * como se valessem. O erro não aparece na hora em que é cometido.
   * ============================================================== */
  {
    const { api } = rodar();
    api.qsBancoPor([]);
    api.matGravar(api.matChave("D", "T"), "um resumo bem mais longo do que "
      + "o trecho, com muitas palavras para servir de material",
      { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.matSelGuardadaPor("um trecho de 31 caracteres!");
    api.qsUiPintarBotaoResumo();
    const bt = api.$("btnMatQstTrecho");
    ok(bt && bt.disabled === true,
       "R12 um trecho de 27 caracteres é aceito: o prompt vai sem "
       + "contexto e a IA devolve questão sobre coisa nenhuma, que "
       + "depois fica no banco e é respondida como se valesse");
    ok(bt && /caracteres/.test(bt.textContent || ""),
       "R12a o botão não diz por que está fora de alcance: "
       + (bt && bt.textContent));

    api.matSelGuardadaPor("A".repeat(200));
    api.qsUiPintarBotaoResumo();
    ok(api.$("btnMatQstTrecho").disabled === false,
       "R12b um trecho de 200 caracteres foi recusado: o mínimo virou "
       + "uma barreira em vez de uma rede");
  }

  /* ==============================================================
   * R13: O CABEÇALHO DO RESUMO ACOMPANHA O QUE FOI SALVO
   *
   * O RELATO: "Sistema Tributário Brasileiro · ainda sem material" no
   * alto da tela, com o botão ao lado dizendo "criar questões do resumo
   * inteiro (12837 caracteres)". Duas frases sobre a mesma coisa, na
   * mesma tela, uma delas mentindo. O subtítulo era escrito uma vez, ao
   * abrir, e nunca mais.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matAbrirEditor({ disciplina: "D", nome: "T" });
    ok(/sem material/i.test(api.$("matSub").textContent || ""),
       "R13-pre um tópico em branco não se anuncia como novo: "
       + api.$("matSub").textContent);
    api.$("matTexto").value = "agora existe um resumo escrito aqui dentro";
    api.matSalvarEstado();
    ok(!/sem material/i.test(api.$("matSub").textContent || ""),
       "R13 depois de salvar, o cabeçalho continua dizendo “ainda sem "
       + "material” — ao lado de um botão que conta os caracteres do "
       + "resumo que ele diz não existir: " + api.$("matSub").textContent);
  }

  /* ==============================================================
   * R14: CONSULTAR A LEI SEM SAIR DA QUESTÃO
   *
   * Metade das questões de Direito se resolve lendo o artigo, e até
   * aqui isso exigia ENCERRAR a rodada, achar o tópico no material,
   * abrir a lei e voltar — quatro telas, com o rascunho e os grifos da
   * questão perdidos no meio.
   *
   * A regra é a mesma do botão de julgados: a gaveta sobe POR CIMA da
   * sessão e fechá-la descobre a mesma questão. Consultar não é sair.
   * ============================================================== */
  {
    const { api } = rodar();
    const q = { id: "q1", disciplina: "Direito Tributário",
                topico: "Princípios", enunciado: "e", gabarito: "C",
                tipo: "ce" };
    api.$("dlgQsResponder").open = true;
    api.qsUiLei(q);
    ok(api.$("dlgQsResponder").open === true,
       "R14 a sessão de questões foi FECHADA para abrir a lei: com ela "
       + "vão embora o rascunho, os grifos e a rolagem da questão que a "
       + "pessoa estava lendo");
    ok(api.$("dlgLeiSeca").open === true,
       "R14a a gaveta da lei não abriu");
    const alvo = api.leiAtualAtual ? api.leiAtualAtual() : null;
    ok(!alvo || /princ/i.test(alvo.topico || ""),
       "R14b a lei abriu em outro tópico que não o da questão: "
       + JSON.stringify(alvo && alvo.topico));
  }

  /* ---- R14c: e fechar a lei repinta a tela de trás ----
   * O botão da sessão diz se há lei ligada; colar uma agora e voltar
   * com o rótulo velho seria a tela mentindo sobre o que acabou de
   * acontecer. */
  {
    const { api } = rodar();
    let voltou = 0;
    api.leiVoltaParaPor(() => { voltou++; });
    await api.leiFechar();
    ok(voltou === 1,
       "R14c fechar a lei não avisou a tela de trás: o botão da questão "
       + "continuaria dizendo “colar a lei” depois de a lei ter sido "
       + "colada");
    await api.leiFechar();
    ok(voltou === 1,
       "R14d a volta foi disparada duas vezes pelo mesmo fechamento — na "
       + "segunda, com o estado já mudado");
  }

  /* ---- R14e: o botão diz se há o que consultar ---- */
  {
    const { api } = rodar();
    api.qsBancoPor([{ id: "q1", enunciado: "e", tipo: "ce", gabarito: "C",
                      disciplina: "D", topico: "T",
                      chave: api.matChave("D", "T") }]);
    api.qsSessaoIniciar(api.qsBancoAtual(), { escopo: "t" });
    api.qsUiPintarSessao();
    const rot1 = String(api.$("btnQsLei").textContent || "");
    ok(api.$("btnQsLei").hidden === false,
       "R14e o botão da lei não aparece numa questão com tópico");
    ok(/colar/i.test(rot1),
       "R14f sem lei ligada, o botão promete consultar o que não existe: "
       + rot1);

    /* liga uma lei ao tópico e repinta */
    api.leiGuardar({ nome: "Lei X", texto: "Art. 1º Teste.",
                     topicos: [api.matChave("D", "T")] });
    api.qsUiPintarSessao();
    const rot2 = String(api.$("btnQsLei").textContent || "");
    ok(/consultar/i.test(rot2),
       "R14g com lei ligada o botão continua oferecendo colar: " + rot2);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
