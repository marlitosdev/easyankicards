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

  /* ---- R5: a tela nasce fechada e o erro se destaca ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: iso(10, 0), t: "erro", o: "Uncaught TypeError: x is not a function" },
    ]));
    api.rtIniciarTela();
    /* NASCE FECHADA: mostrá-la sempre empurraria o diagnóstico — que é
     * o que se copia — para baixo de quatrocentas linhas. */
    ok(api.$("rtLista").hidden === true,
       "R5 a linha do tempo ja abre estendida, empurrando o diagnostico");
    /* mas a aba de erros se anuncia */
    const abas = (api.$("rtAbas").children || []);
    const alerta = abas.filter((b) => /tem-erro/.test(b.className || ""));
    ok(alerta.length === 1,
       "R5a a aba de erros nao se destaca quando ha erro: " + alerta.length);
    ok(/1/.test(alerta[0].textContent || ""),
       "R5b a aba nao diz quantos erros ha: " + alerta[0].textContent);

    api.rtPorFiltro("erro");
    api.rtPintar();
    ok(api.$("rtLista").hidden === false,
       "R5c escolher um filtro nao abriu a lista");
    const linhas = (api.$("rtLista").children || [])
      .filter((x) => /rt-li/.test(x.className || ""));
    ok(linhas.length === 1, "R5d a lista nao mostrou o erro: " + linhas.length);
    ok(/n-erro/.test(linhas[0].className || ""),
       "R5e a linha de erro nao recebeu destaque proprio: "
       + linhas[0].className);
  }

  /* ---- R6: sem erro nenhum, a aba não grita ---- */
  {
    const { api } = rodar();
    api.loja.setItem("eac_mat_log", JSON.stringify([
      { q: iso(10, 0), t: "questao", o: "sessão iniciada" },
    ]));
    api.rtIniciarTela();
    const alerta = (api.$("rtAbas").children || [])
      .filter((b) => /tem-erro/.test(b.className || ""));
    ok(alerta.length === 0,
       "R6 a aba de erros se destaca mesmo sem erro nenhum");
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
   * ============================================================== */
  {
    const { api } = rodar();
    api.rtIniciarTela();
    ok(api.rtFiltroAtual() === "nenhum",
       "R8-pre o painel nao abre fechado por padrao: "
       + api.rtFiltroAtual());

    /* O PEDIDO DE FORA abre já no filtro certo. */
    api.rtPorFiltroExterno("erro");
    api.rtIniciarTela();
    ok(api.rtFiltroAtual() === "erro",
       "R8 quem chega pelo botao 'ver registro' cai no painel fechado e "
       + "tem de procurar a aba: " + api.rtFiltroAtual());

    /* E VALE UMA VEZ SÓ: guardar o pedido faria o painel abrir sempre
     * filtrado, escondendo o resto para sempre. */
    api.rtIniciarTela();
    ok(api.rtFiltroAtual() === "nenhum",
       "R8a o filtro pedido de fora ficou grudado nas aberturas "
       + "seguintes: " + api.rtFiltroAtual());
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

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
