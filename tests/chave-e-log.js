/* A CHAVE NUM LUGAR SÓ, O REGISTRO DO PROCESSO, E A MEDIDA QUE ORDENA
 * SEM DECIDIR.
 *
 * Três coisas que nasceram do mesmo uso real:
 *
 * 1. A CHAVE estava escondida dentro de uma ferramenta. Quem a
 *    guardasse lá não tinha como saber que ela vale para o aplicativo
 *    inteiro, e cada recurso novo pediria de novo. Agora ela mora no
 *    rodapé, junto das informações do app, e o ESTADO é a informação
 *    principal — ligado ou desligado, sem abrir nada.
 *
 * 2. O REGISTRO. Este processo tem cinco etapas, roda sobre centenas de
 *    itens e falha de maneiras específicas: "a IA devolveu quarenta
 *    linhas e oito foram reconhecidas" é uma pergunta que nenhuma linha
 *    de log solta responde. Ela precisa do número de ENTRADA e do de
 *    SAÍDA lado a lado, porque o defeito mora sempre na diferença.
 *
 * 3. A MEDIDA da faxina. Quinhentos vínculos a olho não acontece — mas
 *    apagar sozinho abaixo de um corte destruiria justamente os
 *    vínculos valiosos, os que ligam nomes diferentes para a mesma
 *    matéria ("Improbidade administrativa" e "Lei nº 8.429/1992" ficam
 *    longe, e são a mesma coisa). Ela ordena e pré-marca; quem apaga
 *    continua sendo quem estuda. */
const { rodar } = require("./fumaca.js");

const V = (a, b, c) => [a, b, c];

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const redeFalsa = (mapa) => async (url, init) => {
    const corpo = JSON.parse(init.body);
    return { ok: true, json: async () => ({
      embeddings: corpo.requests.map((r) => {
        const txt = r.content.parts[0].text;
        const achou = Object.keys(mapa).filter((k) => txt.indexOf(k) >= 0)[0];
        return { values: (mapa[achou] || V(0, 0, 1)).slice() };
      }) }) };
  };

  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    api.diarioPor([]);
    const a = api.edCriar("ISS", "# ISS Caruaru | prova: " + daqui(88)
      + " | horas: 20\n@ Tributario :: 5\n"
      + "+ Improbidade administrativa :: 5 :: pq\n"
      + "+ Responsabilidade Civil :: 4 :: pq");
    const b = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + daqui(109)
      + " | horas: 20\n@ Administrativo :: 5\n"
      + "+ Lei nº 8.429/1992 :: 5 :: pq\n"
      + "+ Responsabilidade Civil do Estado :: 4 :: pq");
    api.hubAbrirEdital(a.id);
    api.$("edProva").value = daqui(88);
    return { a, b };
  };
  const ligar = (api, da, ta, db, tb, ed) => api.vkAplicar([{
    de: { chave: api.vkChave(da, ta), disciplina: da, topico: ta },
    para: { chave: api.vkChave(db, tb), disciplina: db, topico: tb },
    conf: "ALTA" }], ed, "ambos");

  /* ================================================================
   * C1: O INTERRUPTOR DIZ EM QUAL ESTADO ESTÁ
   * ============================================================== */
  {
    const { api } = rodar();
    api.vzGuardarChave("");
    api.vkIniciarTela();
    const b = api.$("btnChaveIA");
    ok(b, "C1-pre o interruptor da chave nao existe no rodape");
    ok(/chave-off/.test(b.className || ""),
       "C1 sem chave guardada o interruptor nao aparece desligado: "
       + b.className);
    ok(/DESLIGADA/i.test(api.$("chaveIaTxt").textContent || ""),
       "C1b o interruptor nao escreve o estado: "
       + api.$("chaveIaTxt").textContent);

    api.vzGuardarChave("AIzaTeste");
    api.vkChavePintar();
    ok(/chave-on/.test(b.className || "") && !/chave-off/.test(b.className || ""),
       "C1c com chave guardada o interruptor continua desligado: "
       + b.className);
    ok(/LIGADA/i.test(api.$("chaveIaTxt").textContent || ""),
       "C1d o texto nao acompanhou o estado: "
       + api.$("chaveIaTxt").textContent);

    /* A EXPLICAÇÃO EM LINGUAGEM SIMPLES. Quem lê isto pode nunca ter
     * ouvido falar em API — e "chave de API" não explica nada a quem
     * está estudando para concurso. */
    const aj = api.t("chave_ia_off_aj");
    ok(!/\bAPI\b/.test(aj) || /gratuita/i.test(aj),
       "C1e a explicacao do desligado fala em jargao sem dizer o que e: "
       + aj);
    ok(aj.length > 80 && /IA|Google/i.test(aj),
       "C1f a explicacao nao diz para que serve: " + aj);
  }

  /* ---- C2: quem precisa da chave confere antes de pedir ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vzGuardarChave("");
    api.vkIniciarTela();
    api.vkRevAbrir();

    /* SEM CHAVE, medir ABRE A CAIXA DA CHAVE em vez de tentar e falhar.
     *
     * A primeira versão disto olhava para os scores e concluía "não
     * mediu" — mas sem chave a rede do simulador falha de qualquer
     * jeito, e a asserção passava com ou sem a verificação. Ela media a
     * ausência de rede, não o cuidado do aplicativo. O que se quer aqui
     * é a REAÇÃO: pedir a chave, uma vez, em vez de deixar o botão
     * falhar em silêncio. */
    api.$("dlgVzChave").open = false;
    await conduzir(api, api.vkRevMedir());
    ok(api.$("dlgVzChave").open === true,
       "C2 sem chave o botao tentou medir em vez de pedir a chave");
    ok(Object.keys(api.vkRevScoresAtual()).length === 0,
       "C2b mediu sem chave nenhuma");

    /* COM CHAVE, não pergunta de novo — é o ponto do interruptor
     * global: guardar uma vez vale para o aplicativo inteiro. */
    api.vzGuardarChave("x");
    ligar(api, "Tributario", "Improbidade administrativa",
          "Administrativo", "Lei nº 8.429/1992", b.id);
    api.vkRevAbrir();
    await conduzir(api, api.vkRevMedir({}));
    ok(a && b, "C2-pre");
  }

  /* ================================================================
   * C3: MEDIR ORDENA E PRÉ-MARCA — e não apaga nada
   * ============================================================== */
  {
    const { api, janela } = rodar();
    const { b } = montar(api);
    api.vzGuardarChave("x");
    /* dois vínculos: um com nomes parecidos (Responsabilidade Civil) e
     * um com nomes distantes que são a MESMA coisa (Improbidade /
     * Lei 8.429). É o par que desmonta a ideia de apagar por corte. */
    ligar(api, "Tributario", "Improbidade administrativa",
          "Administrativo", "Lei nº 8.429/1992", b.id);
    ligar(api, "Tributario", "Responsabilidade Civil",
          "Administrativo", "Responsabilidade Civil do Estado", b.id);
    /* O MESMO TÓPICO EM DOIS VÍNCULOS. Sem este caso, a deduplicação
     * dos textos não tem efeito nenhum e a asserção sobre ela não mede
     * nada: com quatro tópicos distintos em dois pares, embutir "cada
     * um uma vez" e "cada par os seus dois" dá o mesmo número. */
    ligar(api, "Tributario", "Improbidade administrativa",
          "Administrativo", "Responsabilidade Civil do Estado", b.id);
    api.vkIniciarTela();
    api.vkRevAbrir();

    let textosPedidos = 0;
    const mapa = {
      "Improbidade administrativa": V(1, 0, 0),
      "Lei nº 8.429/1992": V(0, 1, 0),           /* longe, e é a mesma coisa */
      "Responsabilidade Civil do Estado": V(0, 0, 1),
      "Responsabilidade Civil": V(0.02, 0, 0.999), /* colado, e é outra coisa */
    };
    janela.__area = "";
    await conduzir(api, api.vkRevMedir({ chave: "x", buscar: async (u, i) => {
      textosPedidos += JSON.parse(i.body).requests.length;
      return redeFalsa(mapa)(u, i);
    } }));

    const scores = api.vkRevScoresAtual();
    ok(Object.keys(scores).length === 3,
       "C3 nem todos os vinculos foram medidos: "
       + Object.keys(scores).length);
    /* CADA TÓPICO UMA VEZ. São três vínculos e quatro tópicos
     * distintos; pagar por seis seria jogar fora metade do dinheiro e
     * do tempo — e com quinhentos vínculos a diferença deixa de ser
     * detalhe. */
    ok(textosPedidos === 4,
       "C3-dedup o mesmo topico foi embutido mais de uma vez: "
       + textosPedidos + " textos para 4 topicos distintos");

    /* NADA FOI APAGADO. A medida ordena; apagar continua sendo um gesto
     * separado, com confirmação. */
    ok(api.vkCarregar().length === 3,
       "C3b medir apagou vinculo: " + api.vkCarregar().length);

    /* O FROUXO FICA PRÉ-MARCADO, o firme não. */
    const marcados = api.vkRevMarcadosAtual();
    ok(Object.keys(marcados).length === 2,
       "C3c a pre-marcacao pegou o numero errado de vinculos: "
       + Object.keys(marcados).length);
    const nomes = Object.keys(marcados).map((k2) => marcados[k2].nomeA).join(" ");
    ok(/improbidade/i.test(nomes),
       "C3d marcou o par colado em vez do distante: " + nomes);

    /* E O DISTANTE MARCADO É JUSTAMENTE UM BOM VÍNCULO — por isso a
     * marca é só marca. Apagar sozinho aqui destruiria a ligação entre
     * "Improbidade administrativa" e a lei que a define, que é o tipo
     * de vínculo que dá trabalho reconhecer e que esta ferramenta
     * existe para guardar. */
    ok(api.vkCarregar().length === 3,
       "C3e a pre-marcacao virou exclusao automatica");
  }

  /* ---- C4: a ordem da tela passa a ser a da medida ---- */
  {
    const { api } = rodar();
    const { b } = montar(api);
    api.vzGuardarChave("x");
    ligar(api, "Tributario", "Responsabilidade Civil",
          "Administrativo", "Responsabilidade Civil do Estado", b.id);
    ligar(api, "Tributario", "Improbidade administrativa",
          "Administrativo", "Lei nº 8.429/1992", b.id);
    api.vkIniciarTela();
    api.vkRevAbrir();
    const mapa = {
      "Improbidade administrativa": V(1, 0, 0),
      "Lei nº 8.429/1992": V(0, 1, 0),
      "Responsabilidade Civil do Estado": V(0, 0, 1),
      "Responsabilidade Civil": V(0.02, 0, 0.999),
    };
    await conduzir(api, api.vkRevMedir({ chave: "x", buscar: redeFalsa(mapa) }));

    /* SEM ORDENAR, o número apareceria em cada linha e a pessoa teria
     * de procurar os baixos a olho — que é o trabalho manual que se foi
     * eliminar. */
    const g = api.vkRevisao(api.vkRevFontes()).grupos[0];
    ok(g, "C4-pre a revisao nao tem grupo");
    const primeiro = api.$("vkRevLista").textContent || "";
    const iImp = primeiro.indexOf("Improbidade");
    const iResp = primeiro.indexOf("Responsabilidade Civil ");
    ok(iImp >= 0 && iResp >= 0 && iImp < iResp,
       "C4 o mais frouxo nao subiu para o topo da lista: imp=" + iImp
       + " resp=" + iResp);
    /* e o número aparece na linha */
    ok(/%/.test(primeiro),
       "C4b a proximidade medida nao aparece na linha: "
       + primeiro.slice(0, 100));

    /* A MEDIDA JÁ DEVOLVE ORDENADA, do mais frouxo para o mais firme.
     *
     * A asserção acima olha a tela, que reordena por conta própria — e
     * por isso ela não provava nada sobre a função. Com quinhentos
     * vínculos, quem cansar no meio da leitura precisa ter tirado o
     * pior; é a ordem que faz a faxina valer a pena. */
    const rr = await api.vzMedirVinculos([
      { nomeA: "Tributario›Improbidade administrativa",
        nomeB: "Administrativo›Lei nº 8.429/1992" },
      { nomeA: "Tributario›Responsabilidade Civil",
        nomeB: "Administrativo›Responsabilidade Civil do Estado" },
    ], { chave: "x", buscar: redeFalsa(mapa) });
    ok(rr.medidos.length === 2 && rr.medidos[0].score < rr.medidos[1].score,
       "C4c a medida nao devolve do mais frouxo para o mais firme: "
       + JSON.stringify(rr.medidos.map((m) => Math.round(m.score * 100))));
  }

  /* ================================================================
   * C5: O REGISTRO GUARDA ENTRADA E SAÍDA DE CADA ETAPA
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vzLogLimpar();
    api.vkIniciarTela();
    api.vkAbrir();
    api.$("vkDeEdital").value = String(b.id);
    api.$("vkParaEdital").value = String(a.id);
    api.vkTrocarModo("ambos");
    api.vkPintarLados();

    api.$("vkColarTexto").value = [
      "~ Lei nº 8.429/1992 :: Improbidade administrativa :: SERVE :: mesma lei",
      "~ Assunto que nao existe :: Outro que nao existe :: SERVE :: x",
      "linha solta que a IA escreveu por fora do formato",
    ].join("\n");
    api.vkConferirColagem();

    const L = api.vzLogLer();
    const conf = L.filter((x) => x.e === "conferir-colagem")[0];
    ok(conf, "C5 a conferencia da colagem nao foi registrada");
    /* O NÚMERO DE ENTRADA E O DE SAÍDA. É a diferença entre eles que
     * responde "por que a IA devolveu quarenta e só oito entraram?". */
    ok(conf && conf.d.linhas === 3,
       "C5b o registro nao guarda quantas linhas entraram: "
       + JSON.stringify(conf && conf.d));
    ok(conf && conf.d.pares === 1,
       "C5c o registro nao guarda quantos pares sairam: "
       + JSON.stringify(conf && conf.d));
    ok(conf && conf.d.ignoradas === 2,
       "C5d o registro nao conta as linhas descartadas: "
       + JSON.stringify(conf && conf.d));
    /* A AMOSTRA é o que transforma número em diagnóstico: as linhas que
     * não foram reconhecidas dizem QUAL é o problema. */
    ok(conf && (conf.a || []).length === 2,
       "C5e o registro guarda o numero mas nao mostra nenhuma linha "
       + "descartada: " + JSON.stringify(conf && conf.a));
    ok(conf && /nao existe|não existe|linha solta/i.test((conf.a || []).join(" ")),
       "C5f a amostra nao traz o texto que foi descartado: "
       + JSON.stringify(conf && conf.a));
  }

  /* ---- C6: a faxina registra o que apagou ---- */
  {
    const { api } = rodar();
    montar(api);
    api.vzLogLimpar();
    /* UM CONCURSO QUE JÁ PASSOU, sem material e sem estudo: é o único
     * vínculo que o app classifica como mudo.
     *
     * Sem ele no cenário, "marcar os que não levam a nada" não marcava
     * nada, o bloco inteiro caía no ramo "pulado" e as três asserções
     * sobre o registro da faxina passavam sem testar coisa alguma. */
    const velho = api.edCriar("TCE", "# TCE-PE | prova: " + daqui(-40)
      + " | horas: 20\n@ Antigo :: 5\n+ Assunto encerrado :: 5 :: pq");
    ligar(api, "Tributario", "Improbidade administrativa",
          "Antigo", "Assunto encerrado", velho.id);
    api.vkIniciarTela();
    api.vkRevAbrir();
    /* A FAXINA VIROU DOIS GESTOS: escolher a aba "sem historico" e marcar
     * o que ela mostra. Antes um botao so varria a base inteira e marcava
     * coisas fora da vista. */
    api.vkRevAbaTrocar("mudos");
    api.vkRevMarcarVisiveis();
    const havia = Object.keys(api.vkRevMarcadosAtual()).length;
    ok(havia === 1,
       "C6-pre o cenario nao produziu vinculo mudo, e sem ele este "
       + "bloco inteiro nao testa nada: " + havia);
    if (havia) await conduzir(api, api.vkRevApagar());

    const L = api.vzLogLer();
    const fx = L.filter((x) => x.e === "faxina-apagar")[0];
    if (havia) {
      ok(fx, "C6 apagar vinculos na faxina nao foi registrado");
      /* QUAIS ERAM. É a única operação irreversível desta ferramenta;
       * sem o registro, "por que sumiu o selo daquele tópico?" fica sem
       * resposta possível. */
      ok(fx && (fx.a || []).length > 0,
         "C6b o registro diz quantos apagou e nao diz quais: "
         + JSON.stringify(fx && fx.a));
      ok(fx && fx.d.antes > fx.d.depois,
         "C6c o registro nao guarda o total antes e depois: "
         + JSON.stringify(fx && fx.d));
    } else {
      ok(true, "C6-pulado nao havia vinculo mudo neste cenario");
      ok(true, "C6b-pulado");
      ok(true, "C6c-pulado");
    }
  }

  /* ---- C7: o registro tem teto e vira texto ---- */
  {
    const { api } = rodar();
    api.vzLogLimpar();
    for (let i = 0; i < 80; i++) api.vzLogGravar("teste", { i }, ["x" + i]);
    /* TETO. Este registro é diagnóstico e não pode competir por espaço
     * com o diário de estudo, que é a única prova do que foi feito. */
    ok(api.vzLogLer().length <= 60,
       "C7 o registro cresce sem limite: " + api.vzLogLer().length);
    ok(api.vzLogLer()[0].d.i > 0,
       "C7b o teto jogou fora os registros novos em vez dos velhos");

    const txt = api.vzLogTexto();
    ok(/teste/.test(txt) && /i=/.test(txt),
       "C7c o relatorio em texto nao traz etapa e numeros: "
       + txt.slice(0, 80));
    api.vzLogLimpar();
    ok(!/teste/.test(api.vzLogTexto()),
       "C7d limpar o registro nao limpou");
  }

  /* ================================================================
   * C8: A REGRA DO VÍNCULO ÚTIL É UMA SÓ
   *
   * Ela já existiu em dois lugares e eles discordaram no primeiro uso
   * real: a gaveta considerava "o outro edital ainda vai acontecer" e a
   * revisão não. Na tela virou "502 de 513 vínculos não levam a nada"
   * sobre um par de concursos futuros — com um botão de marcar todos
   * eles logo acima.
   * ============================================================== */
  {
    const { api } = rodar();
    const vazio = { material: false, estudado: false, ativo: false };
    const ativo = { material: false, estudado: false, ativo: true };
    const comMat = { material: true, estudado: false, ativo: false };
    const estud = { material: false, estudado: true, ativo: false };

    /* dois concursos futuros: a coincidência é o próprio aviso */
    ok(api.vkVinculoUtil(ativo, ativo) === true,
       "C8 a coincidencia entre dois editais futuros foi dada como inutil");
    /* concurso encerrado e vazio: não tem o que emprestar */
    ok(api.vkVinculoUtil(ativo, vazio) === false,
       "C8b um vinculo com um concurso encerrado e vazio foi dado como util");
    /* encerrado, mas com material: é exatamente para isto que serve */
    ok(api.vkVinculoUtil(ativo, comMat) === true,
       "C8c o material de um concurso encerrado deixou de valer");
    ok(api.vkVinculoUtil(ativo, estud) === true,
       "C8d um estudo registrado do outro lado deixou de valer");
    /* dois encerrados: ninguém está estudando, ninguém precisa do aviso */
    ok(api.vkVinculoUtil(comMat, comMat) === false,
       "C8e dois concursos encerrados continuam avisando um ao outro");

    /* E A ORDEM NÃO IMPORTA: o vínculo não tem lado. */
    ok(api.vkVinculoUtil(vazio, ativo) === api.vkVinculoUtil(ativo, vazio),
       "C8f a regra da um resultado diferente com os lados trocados");
    ok(api.vkVinculoUtil(comMat, ativo) === true,
       "C8g com os lados trocados o material parou de valer");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
