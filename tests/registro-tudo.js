/* TODOS OS REGISTROS NUMA LINHA DO TEMPO SÓ
 *
 * POR QUE ISTO EXISTE. Investigar um defeito é perguntar "o que
 * aconteceu antes disto?", e a resposta quase nunca está toda numa
 * fonte. O edital que foi gravado por cima do outro é o exemplo: a
 * pista estava no arquivo de backup, o horário no registro geral, e a
 * atividade da hora no registro do material — três lugares, três
 * formatos, três relógios, um deles em UTC.
 *
 * O QUE PRECISA SER VERDADE:
 *
 * 1. NÃO GUARDA NADA. Lê as fontes e junta. Um sexto registro seria
 *    mais uma coisa para sincronizar, e o defeito que ele introduziria
 *    seria do mesmo tipo que ele existe para achar.
 * 2. ORDEM ÚNICA, apesar de cada fonte guardar o instante num formato
 *    diferente.
 * 3. O ERRO SE ACHA. É por isso que se abre este painel.
 * 4. A CHAVE DA IA NÃO SAI DAQUI. Este é o único texto do aplicativo
 *    cujo destino é ser copiado e mandado para outra pessoa. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const iso = (h, m2) => {
    const d = new Date();
    d.setHours(h, m2, 0, 0);
    return d.toISOString();
  };

  /* ---- R1: os quatro níveis, deduzidos do que já está gravado ---- */
  {
    const { api } = rodar();
    ok(api.rtNivel("ERRO", "Uncaught TypeError: x is not a function") === "erro",
       "R1 uma excecao nao foi classificada como erro");
    ok(api.rtNivel("INICIO", "falha ao iniciar hubIniciar: x is not defined") === "erro",
       "R1a uma falha de inicializacao nao foi classificada como erro");
    ok(api.rtNivel("EDITAL", "gravacao recusada (outro-concurso)") === "aviso",
       "R1b uma gravacao recusada nao virou aviso");
    ok(api.rtNivel("MODO", "modo edital") === "detalhe",
       "R1c trocar de modo nao e detalhe");
    ok(api.rtNivel("MATERIAL-SALVAR", "resumo salvo") === "info",
       "R1d salvar um resumo nao e info");
    /* O NÍVEL É DEDUZIDO, e não carimbado em cada chamada: carimbar
     * exigiria mexer nas duzentas chamadas de reg() para ganhar um
     * filtro. */
    ok(api.RT_NIVEIS.length === 4,
       "R1e a escala cresceu; escalas de sete niveis nao sao usadas, "
       + "sao adivinhadas: " + api.RT_NIVEIS.join(","));
  }

  /* ================================================================
   * R2: A CHAVE DA IA NÃO SAI DAQUI
   * ============================================================== */
  {
    const { api } = rodar();
    const chave = "AIzaSyD9x1kQm2ZpL4vNb7RtWs3EfGhJkLmNoPq";
    const saida = api.rtMascarar("erro ao chamar a API com key=" + chave + " ontem");

    ok(saida.indexOf(chave) < 0,
       "R2 a chave inteira ficou no texto que vai ser copiado: " + saida);
    /* AS PRIMEIRAS LETRAS FICAM: é o que permite conferir "é a minha
     * chave mesmo?" sem entregá-la. */
    ok(/AIzaSy/.test(saida),
       "R2a mascarou tudo, e agora nao da para reconhecer qual chave era");
    ok(/\*\*\*\*/.test(saida), "R2b nao ficou visivel que houve mascaramento");
    ok(/ontem/.test(saida) && /erro ao chamar/.test(saida),
       "R2c o mascaramento comeu o resto do texto: " + saida);

    /* OUTROS FORMATOS, porque a chave vazada pode ser de outro serviço
     * — colada num prompt, num campo de teste. */
    ok(api.rtMascarar("sk-ant-api03-abcdefghijklmnop").indexOf("abcdefghijklmnop") < 0,
       "R2d uma chave de outro formato passou inteira");
    ok(api.rtMascarar("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6").indexOf("eyJhbGciOiJIUzI1NiIsInR5cCI6") < 0,
       "R2e um token Bearer passou inteiro");

    /* E O QUE NÃO É CHAVE não pode ser estragado. */
    const normal = "resumo salvo: Os princípios constitucionais tributários";
    ok(api.rtMascarar(normal) === normal,
       "R2f o mascaramento mexeu num texto comum: " + api.rtMascarar(normal));
  }

  /* ---- R2b: a chave guardada, mesmo sem formato conhecido ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_chave_gemini", "minha-chave-esquisita-123456");
    const saida = api.rtMascarar("colei minha-chave-esquisita-123456 aqui");
    ok(saida.indexOf("minha-chave-esquisita-123456") < 0,
       "R2g a chave guardada neste aparelho passou inteira: " + saida);
  }

  /* ================================================================
   * R3: AS FONTES VIRAM UMA LINHA DO TEMPO
   * ============================================================== */
  {
    const { api } = rodar();
    /* três fontes, três formatos de instante, em ordem trocada */
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: iso(9, 0), t: "questao", o: "sessão iniciada", d: "12 questões" },
    ]));
    api.loja.setItem("eac_ger_log", JSON.stringify([
      { q: iso(14, 0), t: "geracao", o: "prompt copiado", d: "1327 caracteres" },
    ]));
    api.loja.setItem("eac_vinculo_log", JSON.stringify([
      { q: iso(11, 0), e: "triagem", n: { duplas: 250, cortados: 149 } },
    ]));

    const L = api.rtTudo({});
    const fontes = L.map((x) => x.fonte);
    ok(fontes.indexOf("material") >= 0 && fontes.indexOf("geracao") >= 0
       && fontes.indexOf("vinculo") >= 0,
       "R3 alguma fonte ficou de fora: " + JSON.stringify(fontes));

    /* MAIS NOVO PRIMEIRO: investigar é olhar para trás a partir de
     * agora. E a ordem tem de valer ENTRE fontes, que é o ponto. */
    const so3 = L.filter((x) => ["material", "geracao", "vinculo"].indexOf(x.fonte) >= 0);
    ok(so3.length === 3,
       "R3-pre o cenario nao produziu um evento de cada fonte: " + so3.length);
    ok(so3[0].fonte === "geracao" && so3[2].fonte === "material",
       "R3a as fontes nao foram ordenadas entre si pelo instante: "
       + so3.map((x) => x.fonte).join(" > "));

    /* O DETALHE DE CADA FONTE CHEGA JUNTO: sem ele a linha do tempo diz
     * que algo aconteceu e não o quê. */
    const vin = so3.filter((x) => x.fonte === "vinculo")[0];
    ok(/duplas=250/.test(vin.extra || ""),
       "R3b os numeros da vinculacao nao vieram: " + vin.extra);
  }

  /* ---- R4: o filtro por nível e por fonte ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: iso(9, 0), t: "questao", o: "sessão iniciada" },
      { q: iso(10, 0), t: "erro", o: "Uncaught TypeError: x is not a function" },
    ]));
    api.loja.setItem("eac_ger_log", JSON.stringify([
      { q: iso(11, 0), t: "geracao", o: "prompt copiado" },
    ]));

    const erros = api.rtTudo({ nivel: "erro" });
    ok(erros.length >= 1 && erros.every((x) => x.nivel === "erro"),
       "R4 o filtro de erro trouxe o que nao e erro: "
       + JSON.stringify(erros.map((x) => x.nivel)));
    ok(erros.length < api.rtTudo({}).length,
       "R4a o filtro de erro nao filtrou nada");

    const so = api.rtTudo({ fonte: "geracao" });
    ok(so.length >= 1 && so.every((x) => x.fonte === "geracao"),
       "R4b o filtro por fonte trouxe outra fonte");

    /* O FILTRO DE NÍVEL É CUMULATIVO: pedir "aviso" traz os erros
     * também, porque quem procura problema quer os dois. */
    const av = api.rtTudo({ nivel: "aviso" });
    ok(av.some((x) => x.nivel === "erro"),
       "R4c pedir avisos escondeu os erros, que sao mais graves");
  }

  /* ---- R5: a linha do tempo nasce fechada e o erro se destaca ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: iso(10, 0), t: "erro", o: "Uncaught TypeError: x is not a function" },
    ]));
    api.$("diagTempo").open = false;
    api.rtIniciarTela();
    /* NASCE FECHADA: desenhá-la sempre empurraria o relatório — que é o
     * que se copia — para baixo de quatrocentas linhas. Fechada, nem
     * desenha (são até 400 nós). */
    ok((api.$("rtLista").children || []).length === 0,
       "R5 a linha do tempo desenhou as linhas com a gaveta fechada");
    /* mas o botão "só erros e avisos" se anuncia, com a contagem */
    const chips = (api.$("diagGravidade").children || []);
    const alerta = chips.filter((b) => /tem-erro/.test(b.className || ""));
    ok(alerta.length === 1,
       "R5a o chip de erros e avisos nao se destaca quando ha erro: " + alerta.length);
    ok(/1/.test(alerta[0].textContent || ""),
       "R5b o chip nao diz quantos erros e avisos ha: " + alerta[0].textContent);

    /* abrir a gaveta desenha, com o erro destacado */
    api.$("diagTempo").open = true;
    api.rtPintar();
    const linhas = (api.$("rtLista").children || [])
      .filter((x) => /rt-li/.test(x.className || ""));
    ok(linhas.length >= 1, "R5d a lista nao mostrou o erro: " + linhas.length);
    ok(linhas.some((l) => /n-erro/.test(l.className || "")),
       "R5e a linha de erro nao recebeu destaque proprio: "
       + linhas.map((l) => l.className).join("|"));
  }

  /* ---- R6: sem erro nenhum, o chip não grita ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: iso(10, 0), t: "questao", o: "sessão iniciada" },
    ]));
    api.rtIniciarTela();
    const alerta = (api.$("diagGravidade").children || [])
      .filter((b) => /tem-erro/.test(b.className || ""));
    ok(alerta.length === 0,
       "R6 o chip de erros se destaca mesmo sem erro nenhum");
  }

  /* ================================================================
   * R7: O RELATÓRIO QUE SE COPIA SAI MASCARADO
   *
   * Este é o único texto do aplicativo cujo destino é sair daqui: o
   * botão existe para mandá-lo a outra pessoa. Mascarar só na tela não
   * bastaria — quem copia e quem baixa leem a variável.
   * ============================================================== */
  {
    const { api } = rodar();
    const chave = "AIzaSyD9x1kQm2ZpL4vNb7RtWs3EfGhJkLmNoPq";
    api.reg("TESTE", "chamada de rede falhou", "key=" + chave);
    api.montarPainelDiag();
    const txt = api.diagTextoAtual();
    ok(/chamada de rede falhou/.test(txt),
       "R7-pre o evento nao entrou no relatorio, e o teste nao mede "
       + "mascaramento nenhum");
    ok(txt.indexOf(chave) < 0,
       "R7 a chave inteira foi para o texto que o botao copia");
    ok(/AIzaSy/.test(txt),
       "R7a mascarou a ponto de nao dar para reconhecer qual chave era");
  }

  /* ================================================================
   * R8: CHEGAR AO REGISTRO DE DENTRO DA SESSÃO DE QUESTÕES
   *
   * Ele sempre existiu, mas só se chegava nele pelo rodapé do
   * aplicativo, com a sessão fechada. Quem está respondendo e vê algo
   * estranho não vai fechar a sessão para procurar o registro: vai
   * desistir e concluir que o app quebrou. Foi o que aconteceu com o
   * grifo — três relatos, e o registro a duas telas de distância.
   * Agora quem chega por um botão "ver registro" cai já no ASSUNTO
   * certo (Questões, Leis e vínculos), não no "tudo".
   * ============================================================== */
  {
    const { api } = rodar();
    api.rtIniciarTela();
    ok(api.diagAssunto === "tudo" && api.diagGravidade === "tudo",
       "R8-pre o painel nao abre em 'tudo' por padrao: "
       + api.diagAssunto + "/" + api.diagGravidade);

    /* O PEDIDO DE FORA abre já no assunto certo. */
    api.rtIniciarTela({ assunto: "questoes" });
    ok(api.diagAssunto === "questoes",
       "R8 quem chega pelo botao 'ver registro' cai no assunto errado: "
       + api.diagAssunto);

    /* E VALE UMA VEZ SÓ: guardar o pedido faria o painel abrir sempre
     * filtrado, escondendo o resto para sempre. */
    api.rtIniciarTela();
    ok(api.diagAssunto === "tudo",
       "R8a o assunto pedido de fora ficou grudado nas aberturas "
       + "seguintes: " + api.diagAssunto);

    /* um assunto que nao existe cai em 'tudo', nao numa lista vazia */
    api.rtIniciarTela({ assunto: "lixo" });
    ok(api.diagAssunto === "tudo",
       "R8b um assunto invalido deixou o painel sem nada: " + api.diagAssunto);
  }

  /* ==============================================================
   * R9: FATO QUE NÃO MUDA NÃO PODE OCUPAR 24 LINHAS
   *
   * O diagnóstico que o usuário mandou tinha 24 eventos
   * [EDITAL-TEXTO], um por abertura, todos idênticos. O filtro por
   * edital ficou inútil (24 de 24 eventos eram a mesma frase) e as 24
   * comeram 12% do caderninho de 200.
   *
   * O guard antigo era uma variável de módulo: zerava a cada recarga,
   * então protegia contra digitar e não contra abrir. Quem tem de
   * segurar isso é o próprio registro, que atravessa as sessões.
   * ============================================================== */
  {
    const { api } = rodar();
    const conta = (tag) =>
      (api.registroTexto().match(new RegExp("\\[" + tag + "\\]", "g")) || []).length;

    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    const base = conta("EDITAL-TEXTO");
    ok(base >= 1, "R9-pre o primeiro evento nao foi anotado");

    /* três "aberturas" seguintes, tudo igual */
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    ok(conta("EDITAL-TEXTO") === base,
       "R9 abrir o app com o mesmo edital continua gerando uma linha por "
       + "abertura: " + conta("EDITAL-TEXTO") + " linhas");

    /* mas a repetição não some: ela vira contagem visível */
    ok(/×4/.test(api.registroTexto()),
       "R9a a repeticao foi engolida em silencio — quem le nao sabe se o "
       + "fato continua valendo ou se so aconteceu uma vez: "
       + api.registroTexto().split("\n").filter((l) => /EDITAL-TEXTO/.test(l)).join(" | "));

    /* e a linha guarda a hora da PRIMEIRA vez, para não pular de lugar */
    const linha = api.registroTexto().split("\n")
      .filter((l) => /EDITAL-TEXTO/.test(l))[0] || "";
    ok(/até \d\d:\d\d:\d\d/.test(linha),
       "R9b a contagem nao diz ate' quando o fato se repetiu: " + linha);

    /* MUDOU DE VERDADE -> linha nova. Este é o evento que o registro
     * existe para mostrar: o edital encolhendo sem ninguém mandar. */
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 61 tópicos", "0 ignoradas");
    ok(conta("EDITAL-TEXTO") === base + 1,
       "R9c o edital encolheu de 133 para 61 topicos e a linha nova foi "
       + "confundida com repeticao: " + conta("EDITAL-TEXTO") + " linhas");

    /* e voltar ao valor anterior é UM TERCEIRO evento, não a repetição
     * do primeiro: ida e volta são duas coisas que aconteceram */
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    ok(conta("EDITAL-TEXTO") === base + 2,
       "R9d o valor voltou ao de antes e a volta foi somada a' linha "
       + "antiga, como se nada tivesse acontecido no meio: "
       + conta("EDITAL-TEXTO") + " linhas");
  }

  /* ---- R10: a contagem chega inteira na linha do tempo unificada ---- */
  {
    const { api } = rodar();
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    api.regSeMudou("EDITAL-TEXTO", "7 disciplinas, 133 tópicos", "0 ignoradas");
    const linha = api.rtTudo().filter((x) => x.tag === "EDITAL-TEXTO")[0];
    ok(linha && /×2/.test(linha.extra || ""),
       "R10 o painel unificado mostra o mesmo evento sem a contagem que o "
       + "painel antigo mostra — dois lugares, duas verdades: "
       + JSON.stringify(linha && linha.extra));
  }

  /* ==============================================================
   * R11: "uso: 0 KB" não pode parecer "perdi tudo"
   *
   * navigator.storage.estimate() mede CacheStorage + IndexedDB e NÃO
   * conta o localStorage. Depois de uma limpeza de cache ela devolve
   * 0, e no diagnóstico do usuário "uso: 0 KB de 10240 MB" apareceu
   * logo acima de "localStorage: 1780 KB em 60 chaves". Os 1780 KB de
   * material estavam intactos; a linha de cima é que não dizia o que
   * tinha medido.
   * ============================================================== */
  {
    const { api } = rodar();
    api.navegador.storage = {
      persisted: async () => true,
      estimate: async () => ({ usage: 0, quota: 10737418240 }),
    };
    await api.medirArmazenamento();
    const txt = api.estadoArmazenamento();
    /* a asserção tem de olhar o PEDAÇO que mostra o 0 KB, não o texto
     * inteiro: "localStorage" aparece de qualquer jeito na linha
     * seguinte, e uma busca no todo passaria sem nada ter mudado */
    const pedaco = txt.split(/\s*\|\s*|\n/)
      .filter((x) => /0 KB de 10240 MB/.test(x))[0] || "";
    ok(/cache/i.test(pedaco) && /IndexedDB/i.test(pedaco),
       "R11 o 0 KB aparece sem dizer O QUE foi medido: " + pedaco);
    ok(/localStorage/.test(pedaco),
       "R11a o 0 KB nao aponta para onde o material realmente esta': " + pedaco);
    ok(!/^\s*uso:/.test(pedaco),
       "R11b sobrou o rotulo 'uso:', que e' justamente o que fez o 0 KB "
       + "parecer 'perdi tudo': " + pedaco);
  }

  /* ==============================================================
   * R12: LIMPAR ERROS — SÓ ERROS, SÓ COM CONFIRMAÇÃO, E SÓ QUEM É ERRO
   *
   * POR QUE ISTO EXISTE. ERRO está em REG_FIXOS (app.js): a rotação
   * normal do registro nunca o descarta, de propósito — é o que garante
   * que um defeito raro não suma antes de alguém notar. Só que isso tem
   * um preço: um erro já corrigido há semanas (o caso real que originou
   * este botão) fica poluindo o painel para sempre, sem nenhum jeito de
   * tirá-lo. Este botão é o oposto da rotação automática: um gesto do
   * usuário, visível, que pede confirmação antes de agir — nunca um
   * descarte silencioso.
   * ============================================================== */
  const conduzir = async (api, promessa, aceitar) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(aceitar); } catch (e) {}
    }
    return promessa;
  };

  {
    const { api } = rodar();
    api.reg("ERRO", "Uncaught ReferenceError: copiar is not defined");
    api.reg("ERRO", "falha ao iniciar gerLogIniciar");
    api.reg("EDITAL", "bancada recolhida");
    api.rtPintar();
    ok(api.$("btnRtLimparErros").hidden === false,
       "R12-pre o botao de limpar erros nao aparece havendo erro no registro");
    ok(/2/.test(api.$("btnRtLimparErros").textContent || ""),
       "R12a o botao nao diz quantos erros vai remover: "
       + api.$("btnRtLimparErros").textContent);

    /* ---- RECUSAR a confirmação não apaga nada ---- */
    await conduzir(api, api.rtLimparErros(), false);
    ok(api.rtTudo({ nivel: "erro" }).length === 2,
       "R12b recusar a confirmacao removeu os erros mesmo assim");

    /* ---- ACEITAR remove só os ERRO, preserva o resto ---- */
    await conduzir(api, api.rtLimparErros(), true);
    ok(api.rtTudo({ nivel: "erro" }).length === 0,
       "R12c aceitar a confirmacao nao removeu os erros: "
       + JSON.stringify(api.rtTudo({ nivel: "erro" })));
    ok(api.rtTudo({}).some((x) => x.tag === "EDITAL"),
       "R12d limpar erros levou junto um evento que nao era erro");

    /* a própria limpeza fica registrada — não é um sumiço sem rastro */
    ok(api.rtTudo({}).some((x) => x.tag === "REGISTRO"
       && /erro/i.test(x.msg || "")),
       "R12e a limpeza dos erros nao deixou rastro no proprio registro");

    /* e o botão some de novo, não há mais erro para limpar */
    api.rtPintar();
    ok(api.$("btnRtLimparErros").hidden === true,
       "R12f o botao continuou visivel depois de nao sobrar erro nenhum");
  }

  /* ---- R12g: sem erro nenhum, o botão nasce escondido ---- */
  {
    const { api } = rodar();
    api.reg("EDITAL", "bancada recolhida");
    api.rtPintar();
    ok(api.$("btnRtLimparErros").hidden === true,
       "R12g o botao de limpar erros apareceu sem nenhum erro no registro");
  }

  /* ================================================================
   * A: UM SÓ MODELO DE FILTRO — assunto × período × gravidade
   *
   * POR QUE ISTO EXISTE. O diálogo tinha dois filtros que fingiam ser um:
   * botões que mudavam o texto COPIADO e abas que só mudavam o que se
   * VIA. E "modo" só conhecia edital e cartões: em Questões e Leis o
   * cabeçalho dizia "bancada de cartões" e, com o filtro ligado, até os
   * erros sumiam. Agora o que está na prévia é exatamente o que se copia.
   * ============================================================== */
  const tags = (L) => L.map((x) => x.tag);

  /* ---- A1: cada assunto pega as tags certas ---- */
  {
    const { api } = rodar();
    api.reg("QUESTOES", "sessão iniciada", "12 questões");
    api.reg("LEI", "lei aberta", "CF/88");
    api.reg("EDITAL", "edital gravado", "7 disciplinas");
    api.reg("CORRIGIR", "cartão corrigido", "x");
    api.reg("MATERIAL-RESUMO", "resumo salvo", "y");
    const so = (a) => tags(api.rtTudo({ assunto: a }));
    ok(so("questoes").indexOf("QUESTOES") >= 0 && so("questoes").indexOf("LEI") < 0
       && so("questoes").indexOf("EDITAL") < 0 && so("questoes").indexOf("CORRIGIR") < 0,
       "A1 o assunto Questoes trouxe o que nao e de questoes (ou nao trouxe o que e): "
       + so("questoes").join(","));
    ok(so("leis").indexOf("LEI") >= 0 && so("leis").indexOf("QUESTOES") < 0
       && so("leis").indexOf("EDITAL") < 0,
       "A1a o assunto Leis errou: " + so("leis").join(","));
    ok(so("edital").indexOf("EDITAL") >= 0 && so("edital").indexOf("LEI") < 0
       && so("edital").indexOf("CORRIGIR") < 0,
       "A1b o assunto Edital errou: " + so("edital").join(","));
    ok(so("cartoes").indexOf("CORRIGIR") >= 0 && so("cartoes").indexOf("EDITAL") < 0,
       "A1c o assunto Cartoes errou: " + so("cartoes").join(","));
    ok(so("material").indexOf("MATERIAL-RESUMO") >= 0 && so("material").indexOf("LEI") < 0,
       "A1d o assunto Material errou: " + so("material").join(","));
    ok(so("tudo").length >= 5,
       "A1e 'tudo' deixou eventos de fora: " + so("tudo").join(","));
  }

  /* ---- A2: erro e bloqueio entram em QUALQUER assunto ---- */
  {
    const { api } = rodar();
    api.reg("ERRO", "Uncaught TypeError: x is not a function");
    api.reg("BLOQUEIO", "gravacao recusada");
    for (const a of ["questoes", "leis", "material", "cartoes", "edital"]) {
      const t2 = tags(api.rtTudo({ assunto: a }));
      ok(t2.indexOf("ERRO") >= 0 && t2.indexOf("BLOQUEIO") >= 0,
         "A2 o assunto " + a + " escondeu erro/bloqueio (a legenda promete que "
         + "nunca sao descartados): " + t2.join(","));
    }
  }

  /* ---- A3: uma linha de citação/vínculo é de Questões E de Leis ---- */
  {
    const { api } = rodar();
    api.reg("QUESTOES", "citação não resolvida", "CF/88 · nenhuma lei da biblioteca casa");
    api.reg("QUESTOES", "resposta registrada", "questão 3");
    const q = api.rtTudo({ assunto: "questoes" }).map((x) => x.msg);
    const l = api.rtTudo({ assunto: "leis" }).map((x) => x.msg);
    ok(q.indexOf("citação não resolvida") >= 0 && q.indexOf("resposta registrada") >= 0,
       "A3 Questoes perdeu linhas: " + q.join("|"));
    ok(l.indexOf("citação não resolvida") >= 0,
       "A3a a citacao que nao virou link nao aparece em Leis e vinculos, "
       + "que e' onde se procura: " + l.join("|"));
    ok(l.indexOf("resposta registrada") < 0,
       "A3b Leis trouxe uma linha de questao que nada tem a ver com lei");
  }

  /* ---- A4: o log da lei entra no relatório, com lei e artigo ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_lei_log", JSON.stringify([
      { q: new Date().toISOString(), t: "abrir", o: "lei aberta", d: "art. 145",
        lei: "CF/88", top: "Tributário" },
    ]));
    const L = api.rtTudo({ assunto: "leis" });
    const x = L.filter((e) => e.fonte === "lei")[0];
    ok(!!x, "A4 o log da lei nao entrou na linha do tempo: " + JSON.stringify(L.map((e) => e.fonte)));
    ok(x && /CF\/88/.test(x.extra) && /art\. 145/.test(x.extra),
       "A4a a linha da lei chegou sem o nome da lei/artigo: " + (x && x.extra));
    ok(/CF\/88/.test(api.rtRelatorio({ assunto: "leis" }).texto),
       "A4b o TEXTO do relatorio nao traz a lei");
  }

  /* ---- A5: o mesmo evento espelhado em dois registros aparece UMA vez ---- */
  {
    const { api } = rodar();
    const agora = new Date().toISOString();
    api.reg("MATERIAL-LEI", "lei aberta: CTN", "");
    api.loja.setItem("eac_lei_log", JSON.stringify([
      { q: agora, t: "lei", o: "lei aberta: CTN", d: "", lei: "CTN", top: "" },
    ]));
    const com = api.rtTudo({ semRepetidos: true })
      .filter((x) => x.msg === "lei aberta: CTN");
    ok(com.length === 1 && com[0].fonte === "lei",
       "A5 o espelho continua duplicando (ou ficou a copia mais pobre): "
       + JSON.stringify(com.map((x) => x.fonte)));
    const sem = api.rtTudo({}).filter((x) => x.msg === "lei aberta: CTN");
    ok(sem.length >= 2, "A5a o teste nao mede nada: sem 'semRepetidos' devia haver 2+, veio " + sem.length);
    /* mas DOIS eventos iguais da MESMA fonte sao dois eventos */
    api.loja.setItem("eac_lei_log", JSON.stringify([
      { q: agora, t: "lei", o: "abriu", lei: "A" },
      { q: agora, t: "lei", o: "abriu", lei: "A" },
    ]));
    ok(api.rtTudo({ semRepetidos: true }).filter((x) => x.msg === "abriu").length === 2,
       "A5b eventos iguais da mesma fonte foram fundidos: eram dois fatos");
  }

  /* ---- A6: período e gravidade ---- */
  {
    const { api } = rodar();
    const velho = new Date(Date.now() - 10 * 86400000).toISOString();
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: velho, t: "questao", o: "sessão antiga" },
      { q: new Date().toISOString(), t: "questao", o: "sessão de hoje" },
    ]));
    const msgs = (o) => api.rtTudo(o).map((x) => x.msg);
    ok(msgs({}).indexOf("sessão antiga") >= 0, "A6-pre o evento antigo nao existe");
    ok(msgs({ dias: 1 }).indexOf("sessão antiga") < 0 && msgs({ dias: 1 }).indexOf("sessão de hoje") >= 0,
       "A6 o periodo 'hoje' nao separou hoje de dez dias atras");
    ok(msgs({ dias: 7 }).indexOf("sessão antiga") < 0 && msgs({ dias: 30 }).indexOf("sessão antiga") >= 0,
       "A6a 7 e 30 dias erraram a fronteira");
    api.reg("ERRO", "Uncaught x");
    api.reg("AVISO-X", "aviso qualquer");
    const prob = api.rtTudo({ gravidade: "problemas" });
    ok(prob.length >= 1 && prob.every((x) => x.nivel === "erro" || x.nivel === "aviso"),
       "A6b 'so erros e avisos' trouxe andamento normal: "
       + JSON.stringify(prob.map((x) => x.nivel)));
  }

  /* ---- A6c: a contagem do chip "só erros e avisos" é a do ASSUNTO escolhido ---- */
  {
    const { api } = rodar();
    api.reg("ERRO", "Uncaught A");
    api.reg("EDITAL", "gravacao recusada (outro-concurso)");
    api.rtIniciarTela({ assunto: "material" });
    const chip = (api.$("diagGravidade").children || [])[1];
    ok(chip && /\(1\)/.test(chip.textContent || ""),
       "A6c a contagem de 'erros e avisos' nao acompanha o assunto (so o erro fixo "
       + "entra em Material; o aviso do edital nao): " + (chip && chip.textContent));
  }

  /* ---- A6d: o número de cada botão de assunto é o do relatório que ele gera ---- */
  {
    const { api } = rodar();
    api.reg("ERRO", "Uncaught A");
    api.reg("QUESTOES", "sessão iniciada", "12");
    api.reg("LEI", "lei aberta", "CTN");
    api.rtIniciarTela({ assunto: "tudo" });
    const chips = (api.$("diagAssuntos").children || []);
    const num = (t2) => Number((/\((\d+)\)/.exec(t2 || "") || [])[1]);
    api.RT_ASSUNTOS.forEach((id, i) => {
      const n2 = api.rtRelatorio({ assunto: id, semRepetidos: true }).n;
      ok(num(chips[i] && chips[i].textContent) === n2,
         "A6d o botao '" + id + "' diz " + num(chips[i] && chips[i].textContent)
         + " mas o relatorio dele tem " + n2);
    });
  }

  /* ---- A7: o texto COPIADO é o da prévia, do mesmo filtro ---- */
  {
    const { api } = rodar();
    api.reg("QUESTOES", "sessão iniciada", "12 questões");
    api.reg("EDITAL", "edital gravado", "7 disciplinas");
    api.rtIniciarTela({ assunto: "questoes" });
    api.montarPainelDiag();
    const txt = api.diagTextoAtual();
    ok(/sessão iniciada/.test(txt) && !/edital gravado/.test(txt),
       "A7 o assunto escolhido nao governa o texto copiado: "
       + txt.split("\n").filter((l) => /QUESTOES|EDITAL/.test(l)).join(" | "));
    ok(/assunto: Questões/.test(txt),
       "A7a o cabecalho nao diz o assunto (dizia 'bancada de cartoes'): "
       + txt.split("\n").filter((l) => /REGISTRO/.test(l)).join(" | "));
    ok(!/bancada de cartões/.test((api.$("diagAlvo").textContent || "")),
       "A7b o topo ainda diz 'bancada de cartoes' num relatorio de questoes");
    ok(/Questões/.test(api.$("diagAlvo").textContent || ""),
       "A7c o topo nao diz o assunto do relatorio: " + api.$("diagAlvo").textContent);
    /* cada linha do texto do relatório sai da prévia (rtRelatorio) */
    const rel = api.rtRelatorio(api.rtOpcoesAtuais());
    ok(rel.texto && txt.indexOf(rel.texto) >= 0,
       "A7d o texto copiado nao contem exatamente o que a previa mostra");
    /* "Onde: bancada de ..." so faz sentido onde ha bancada (tudo/cartoes/
     * edital); num relatorio de Questoes so confunde */
    ok(!/Onde:/.test(txt), "A7g o relatorio de Questoes ainda diz 'Onde: bancada de ...'");
    ok(!/--- TEXTO/.test(txt),
       "A7i o relatorio de Questoes traz o bloco 'TEXTO (nao incluido a pedido)' de uma caixa que nem aparece");
    api.rtIniciarTela({ assunto: "tudo" });
    api.montarPainelDiag();
    ok(/--- TEXTO/.test(api.diagTextoAtual()),
       "A7j o relatorio geral perdeu o bloco TEXTO/o aviso de que foi omitido");
    api.rtIniciarTela({ assunto: "tudo" });
    ok(/Onde:/.test(api.montarDiagnostico()), "A7h o relatorio geral perdeu a linha 'Onde:'");
    api.rtIniciarTela({ assunto: "questoes" });
    /* sem nada no assunto, diz que nao ha nada (nao some o bloco) */
    api.rtIniciarTela({ assunto: "material" });
    api.montarPainelDiag();
    ok(/nada registrado sobre/.test(api.diagTextoAtual()),
       "A7e assunto vazio devia dizer que nao ha nada, nao calar");
    /* e o erro do assunto errado continua indo */
    api.reg("ERRO", "Uncaught TypeError: boom");
    api.rtIniciarTela({ assunto: "material" });
    api.montarPainelDiag();
    ok(/Uncaught TypeError: boom/.test(api.diagTextoAtual()),
       "A7f o erro sumiu do relatorio de outro assunto (era o defeito do "
       + "filtro por modo)");
  }

  /* ---- A8: "dados do aparelho" desmarcado corta o bloco do aparelho ---- */
  {
    const { api } = rodar();
    api.rtIniciarTela({ assunto: "tudo" });
    api.montarPainelDiag();
    const cheio = api.diagTextoAtual();
    api.$("chkDiagAparelho").checked = false;
    api.montarPainelDiag();
    const magro = api.diagTextoAtual();
    ok(magro.length < cheio.length && /não incluídos a pedido/.test(magro),
       "A8 desmarcar os dados do aparelho nao os tirou do relatorio");
    ok(/--- REGISTRO/.test(magro), "A8a tirou o registro junto com o aparelho");
    api.$("chkDiagAparelho").checked = true;
  }

  /* ---- A9: trocar o período só refiltra: não reabre nem remede ---- */
  {
    const { api } = rodar();
    await api.abrirDiagnostico();
    const aberturas = () => (api.registroTexto().match(/painel aberto/g) || []).length;
    const antes = aberturas();
    const botoes = api.$("diagPeriodos").children || [];
    ok(botoes.length === 4, "A9-pre esperava 4 botoes de periodo: " + botoes.length);
    botoes[1].onclick();
    /* deixa correr o que um clique pudesse ter disparado (a abertura do
     * dialogo e' assincrona) antes de contar */
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    ok(api.regPeriodo === 1, "A9 o botao 'hoje' nao mudou o periodo: " + api.regPeriodo);
    ok(aberturas() === antes,
       "A9a trocar o periodo reabriu o dialogo (gravou outro 'painel aberto')");
    ok(/período: /.test(api.diagTextoAtual()),
       "A9b o relatorio nao acompanhou o periodo");
    api.definirPeriodo(0);
  }

  /* ---- A10: Copiar/Baixar/Compartilhar ficam ACIMA da prévia ---- */
  {
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const d = html.slice(html.indexOf('<dialog id="dlgDiagnostico"'));
    const dlg = d.slice(0, d.indexOf("</dialog>"));
    const pos = (id) => dlg.indexOf('id="' + id + '"');
    ok(pos("btnDiagCopiar") > 0 && pos("btnDiagCopiar") < pos("diagPre"),
       "A10 o botao Copiar continua abaixo do relatorio (quem nao rola nao o ve)");
    ok(pos("btnDiagBaixar") > 0 && pos("btnDiagBaixar") < pos("diagPre"),
       "A10a o botao Baixar continua abaixo do relatorio");
    ok(pos("btnDiagCompartilhar") > 0 && pos("btnDiagCompartilhar") < pos("diagPre"),
       "A10b nao ha 'Compartilhar' acima do relatorio");
    ok(/\.diag-acoes\{[^}]*position:sticky/.test(html),
       "A10c a barra de acoes nao acompanha a rolagem");
    ok(pos("chkDiagModo") < 0, "A10d a caixa antiga 'so o modo' continua no dialogo");
  }

  /* ---- A11: Compartilhar só existe onde há navigator.share ---- */
  {
    const { api } = rodar();
    api.navegador.share = undefined;
    await api.abrirDiagnostico();
    ok(api.$("btnDiagCompartilhar").hidden === true,
       "A11 o botao Compartilhar aparece num aparelho sem folha de compartilhamento");

    const { api: b } = rodar();
    let dado = null;
    b.navegador.share = async (d) => { dado = d; };
    await b.abrirDiagnostico();
    ok(b.$("btnDiagCompartilhar").hidden === false,
       "A11a com navigator.share o botao Compartilhar nao apareceu");
    await b.$("btnDiagCompartilhar").onclick();
    ok(!!dado && ((dado.files && dado.files.length) || dado.text),
       "A11b o clique nao chamou navigator.share com o relatorio");
    ok(!dado || dado.files || dado.text === b.diagTextoAtual(),
       "A11c o texto compartilhado nao e' o da previa");
  }

  /* ---- A12: de onde se vem decide o assunto; o clique do botão não é pedido ---- */
  {
    const { api } = rodar();
    ok(api.diagAssuntoPadrao() === "tudo", "A12-pre o padrao nao e' 'tudo': " + api.diagAssuntoPadrao());
    api.$("dlgQsResponder").open = true;
    ok(api.diagAssuntoPadrao() === "questoes",
       "A12 abrindo de dentro das questoes o assunto nao e' Questoes");
    api.$("dlgLeiSeca").open = true;
    ok(api.diagAssuntoPadrao() === "leis",
       "A12a abrindo de dentro da lei o assunto nao e' Leis e vinculos");
    api.$("dlgLeiSeca").open = false;
    api.$("dlgQsResponder").open = false;

    /* o botao do rodape passa o EVENTO; isso nao pode virar "assunto" */
    await api.abrirDiagnostico({ type: "click", target: {} });
    ok(api.diagAssunto === "tudo", "A12b o evento de clique foi tomado como pedido: " + api.diagAssunto);
    await api.abrirDiagnostico({ assunto: "leis" });
    ok(api.diagAssunto === "leis", "A12c o pedido explicito nao valeu: " + api.diagAssunto);
  }

  /* ---- A13: o botão "enviar relatório" do visor da lei abre em Leis ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const b = api.$("btnLeiLogEnviar");
    ok(!!b && typeof b.onclick === "function",
       "A13-pre o botao 'enviar relatorio' nao foi ligado no visor da lei");
    if (b && b.onclick) {
      b.onclick();
      for (let i = 0; i < 20; i++) await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      ok(api.diagAssunto === "leis",
         "A13 o botao do visor da lei nao abriu o relatorio em Leis e vinculos: " + api.diagAssunto);
    }
  }

  /* ---- A14: o "ver registro desta sessão" do ⋮ das questões abre em Questões ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const c = api.matChave("D", "T");
    api.matGravar(c, "x", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.qsAplicar(api.qsLerResposta(
      "[QUESTAO] TIPO: ME ENUNCIADO: p1? A) a. B) b. GABARITO: A COMENTARIO: c.",
      { disciplina: "D", topico: "T", chave: c }).achados);
    api.qsUiResponderDoTopico();
    const botoes = api.$("qsSessCorpo").querySelectorAll("button");
    const ver = botoes.filter((b) => /registro/i.test(b.textContent || ""))[0];
    ok(!!ver, "A14-pre nao achei o item 'ver registro' no menu das questoes");
    if (ver) {
      /* com o dialogo das questoes fechado, o assunto padrao seria "tudo":
       * so o pedido explicito do botao leva a Questoes */
      api.$("dlgQsResponder").open = false;
      ver.onclick({ stopPropagation: () => {} });
      for (let i = 0; i < 20; i++) await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      ok(api.diagAssunto === "questoes",
         "A14 'ver registro desta sessao' nao abriu o relatorio em Questoes: " + api.diagAssunto);
    }
  }

  /* ---- A15: os relógios e os campos das fontes chegam certos ---- */
  {
    const { api } = rodar();
    /* o registro geral grava em UTC (reg() usa toISOString); o instante
     * do evento tem de bater com o da hora em que ele foi gravado */
    api.reg("TESTE", "agora");
    const x = api.rtTudo({}).filter((e) => e.tag === "TESTE")[0];
    ok(x && Math.abs(x.quando - Date.now()) < 120000,
       "A15 o evento do registro geral caiu fora do lugar na linha do tempo "
       + "(hora UTC lida como local?): " + (x && (x.quando - Date.now())) + " ms");
    /* geração: o log escreve tp/e, não t/tipo */
    api.loja.setItem("eac_ger_log", JSON.stringify([
      { q: new Date().toISOString(), tp: "prompt", o: "prompt copiado", d: "1327 caracteres", disc: "Tributário" },
    ]));
    const g = api.rtTudo({}).filter((e) => e.fonte === "geracao")[0];
    ok(g && g.tag === "PROMPT" && /Tributário/.test(g.extra) && /1327/.test(g.extra),
       "A15a a linha de geracao chegou sem a etiqueta/os detalhes: " + JSON.stringify(g));
    /* vinculação: os números estão em d */
    api.loja.setItem("eac_vinculo_log", JSON.stringify([
      { q: new Date().toISOString(), e: "triagem", d: { duplas: 250 }, a: [] },
    ]));
    const v = api.rtTudo({}).filter((e) => e.fonte === "vinculo")[0];
    ok(v && /duplas=250/.test(v.extra), "A15b os numeros da vinculacao nao vieram: " + JSON.stringify(v));
  }

  /* ---- A16: o bloco "VINCULAÇÃO ENTRE EDITAIS" obedece ao período e à gravidade ---- */
  {
    /* O RELATÓRIO REAL: "período: só de hoje" e o bloco da vinculação
     * trazia etapas de 03 e 04/09 — ele nasceu antes dos filtros e
     * imprimia sempre tudo. */
    const { api } = rodar();
    const agora = new Date().toISOString();
    const velho = new Date(Date.now() - 10 * 86400000).toISOString();
    api.loja.setItem("eac_vinculo_log", JSON.stringify([
      { q: velho, e: "faxina-apagar", d: { apagados: 246 }, a: [] },
      { q: agora, e: "triagem-de-hoje", d: { duplas: 250 }, a: [] },
    ]));
    const rel = () => { api.rtIniciarTela({ assunto: "tudo" }); api.montarPainelDiag(); return api.diagTextoAtual(); };

    api.definirPeriodo(0);
    let r = rel();
    ok(/VINCULAÇÃO ENTRE EDITAIS \(2 etapas registradas\)/.test(r) && /faxina-apagar/.test(r) && /triagem-de-hoje/.test(r),
       "A16-pre sem periodo o bloco devia trazer as duas etapas: " + (r.match(/VINCULAÇÃO[^\n]*/) || [])[0]);

    api.definirPeriodo(1);
    r = rel();
    ok(/triagem-de-hoje/.test(r) && !/faxina-apagar/.test(r),
       "A16 'so de hoje' continua trazendo etapa de dias atras: " + (r.match(/faxina-apagar/) || ["(nao trouxe)"])[0]);
    ok(/1 etapas no período, de 2 registradas/.test(r),
       "A16a o cabecalho nao diz quantas etapas ha no periodo e no total: " + (r.match(/VINCULAÇÃO[^\n]*/) || [])[0]);

    /* nenhuma etapa no período: o bloco some, sem cabeçalho vazio */
    api.loja.setItem("eac_vinculo_log", JSON.stringify([{ q: velho, e: "faxina-apagar", d: {}, a: [] }]));
    ok(!/VINCULAÇÃO ENTRE EDITAIS/.test(rel()), "A16b bloco sem nenhuma etapa no periodo ainda aparece");

    /* "só erros e avisos": etapa de vinculação é andamento, não problema */
    api.loja.setItem("eac_vinculo_log", JSON.stringify([{ q: agora, e: "triagem-de-hoje", d: {}, a: [] }]));
    api.definirPeriodo(0);
    api.rtIniciarTela({ assunto: "tudo", gravidade: "problemas" });
    api.montarPainelDiag();
    ok(!/VINCULAÇÃO ENTRE EDITAIS/.test(api.diagTextoAtual()),
       "A16c 'so erros e avisos' ainda traz o bloco de vinculacao (andamento normal)");
    api.definirPeriodo(0);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
