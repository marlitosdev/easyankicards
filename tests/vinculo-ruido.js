/* O APLICATIVO NÃO PODE AFIRMAR UM ESTUDO QUE NUNCA HOUVE.
 *
 * Dois editais marcando "0% estudado" na lista, e a gaveta de um tópico
 * deles listando OITO estudos — "Estudado para SEFAZ Alagoas",
 * "Estudado para ISS Caruaru". Nada tinha sido estudado.
 *
 * Não havia contradição no dado. Havia uma frase colada no dado errado:
 *
 *   concurso: (est && est.concurso)                 // o diário: é fato
 *          || editalDoTopico[chave]                 // "existe neste edital"
 *
 * O segundo campo responde "de onde é este tópico?". A frase em volta
 * dele dizia "Estudado para X". Um tópico que apenas CONSTA de outro
 * edital virava um tópico estudado — e essa é a pior categoria de erro
 * que este aplicativo pode cometer, porque parece informação, ninguém
 * desconfia de informação, e a conclusão que ela produz é "não preciso
 * estudar isto".
 *
 * O EXCESSO tinha outra causa: a travessia ia a três saltos. A cadeia
 * A→B→C fazia cada tópico puxar a vizinhança da vizinhança, e dois
 * vínculos diretos viravam oito linhas na tela.
 *
 * E há uma terceira: de um concurso que JÁ PASSOU, o registro de "eu
 * estudei isto" não decide nada hoje — só o material decide. Vínculo
 * sem material e sem estudo, para um edital encerrado, é uma linha que
 * não responde pergunta nenhuma e afoga as que respondem. */
const { rodar } = require("./fumaca.js");

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

  /* O CENÁRIO REAL, reduzido: um concurso encerrado (TCE-PE) e dois
   * ainda por vir (ISS e SEFAZ), nada estudado em lugar nenhum. */
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    api.diarioPor([]);
    const tce = api.edCriar("TCE", "# TCE-PE Auditor | prova: " + daqui(-30)
      + " | horas: 20\n@ Direito Constitucional :: 5\n"
      + "+ Sistema Tributário Nacional :: 5 :: pq");
    const iss = api.edCriar("ISS", "# ISS Caruaru Auditor | prova: " + daqui(88)
      + " | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n"
      + "+ Os princípios constitucionais tributários :: 5 :: pq\n"
      + "+ Limitações ao poder de tributar :: 4 :: pq");
    const sefaz = api.edCriar("SEFAZ", "# SEFAZ-AL Auditor | prova: "
      + daqui(109) + " | horas: 20\n@ Direito Tributário :: 5\n"
      + "+ Princípios gerais tributários :: 5 :: pq");
    api.hubAbrirEdital(iss.id);
    api.$("edProva").value = daqui(88);
    return { tce, iss, sefaz };
  };
  const k = (d, t2) => ({ chave: null, disciplina: d, topico: t2 });
  const ligar = (api, a, b, ed) => api.vkAplicar([{
    de: Object.assign(k(a[0], a[1]), { chave: api.vkChave(a[0], a[1]) }),
    para: Object.assign(k(b[0], b[1]), { chave: api.vkChave(b[0], b[1]) }),
    conf: "ALTA" }], ed, "ambos");

  const ISS = ["Sistema Tributário Brasileiro",
               "Os princípios constitucionais tributários"];
  const TCE = ["Direito Constitucional", "Sistema Tributário Nacional"];
  const SEF = ["Direito Tributário", "Princípios gerais tributários"];

  /* ================================================================
   * R1: SEM LINHA NO DIÁRIO, NINGUÉM DIZ "ESTUDEI"
   *
   * A asserção central deste arquivo. Ela existe para nunca mais passar
   * por acaso: o app pode esconder, agrupar, ordenar — mas não pode
   * afirmar um estudo que não aconteceu.
   * ============================================================== */
  {
    const { api } = rodar();
    const { iss, sefaz } = montar(api);
    ligar(api, ISS, SEF, sefaz.id);

    ok((api.diarioAtual() || []).length === 0,
       "R1-pre o diario nao esta vazio, o cenario nao vale");

    const ac = api.vkAcervoDoTopico(ISS[0], ISS[1]);
    ok(ac.itens.length === 1,
       "R1-pre2 o vinculo nao chegou ao acervo: " + ac.itens.length);

    const x = ac.itens[0];
    ok(x.estudado === false,
       "R1 um topico sem uma linha no diario se diz estudado");
    ok(x.concurso === "",
       "R1b o nome do concurso do ESTUDO foi preenchido sem estudo: "
       + JSON.stringify(x.concurso));
    ok(x.data === "",
       "R1c apareceu data de estudo onde nao houve estudo: " + x.data);
    /* e o app CONTINUA sabendo de onde o tópico é — o que se perdeu foi
     * a mistura, não a informação */
    ok(x.ondeConsta === "SEFAZ-AL Auditor",
       "R1d o app perdeu de qual edital o topico ligado e: " + x.ondeConsta);
    ok(ac.temEstudo === false,
       "R1e o acervo inteiro se diz estudado sem nenhum estudo");
    ok(iss && true, "R1-pre3");
  }

  /* ---- R2: a frase da gaveta segue o dado ---- */
  {
    const { api } = rodar();
    const { sefaz } = montar(api);
    ligar(api, ISS, SEF, sefaz.id);
    api.vkaAbrir(ISS[0], ISS[1]);
    const txt = (api.$("vkaLista").textContent || "");

    /* A PALAVRA "ESTUDADO" NÃO PODE APARECER. É literal de propósito:
     * era exatamente ela, na tela, que fazia a afirmação falsa. */
    ok(!/Estudado para/i.test(txt),
       "R2 a gaveta diz 'Estudado para' sem nenhum estudo registrado: "
       + txt.slice(0, 120));
    /* O outro edital ainda vai acontecer: a frase certa é a do aviso. */
    ok(/Também cai em/i.test(txt),
       "R2b a gaveta nao avisa que o assunto tambem cai no outro "
       + "concurso: " + txt.slice(0, 120));
    ok(/SEFAZ-AL Auditor/.test(txt),
       "R2c o aviso nao nomeia o outro concurso: " + txt.slice(0, 120));
    /* e "foi estudado, mas não sobrou material" é uma frase que só pode
     * ser dita de um tópico que foi mesmo estudado */
    ok(!/foi estudado, mas/i.test(txt),
       "R2d a gaveta afirma estudo na frase do material ausente: "
       + txt.slice(0, 160));
  }

  /* ---- R3: com registro no diário, aí sim ---- */
  {
    const { api } = rodar();
    const { sefaz } = montar(api);
    ligar(api, ISS, SEF, sefaz.id);
    api.diarioPor([{ d: daqui(-3), c: api.matChave(SEF[0], SEF[1]),
      n: SEF[1], disc: SEF[0], a: "feito", m: 50, cc: "SEFAZ-AL Auditor" }]);

    const ac = api.vkAcervoDoTopico(ISS[0], ISS[1]);
    ok(ac.itens[0].estudado === true,
       "R3 com uma linha no diario o acervo continua dizendo que nao "
       + "houve estudo");
    ok(ac.itens[0].concurso === "SEFAZ-AL Auditor",
       "R3b o concurso do estudo nao veio do diario: " + ac.itens[0].concurso);
    api.vkaAbrir(ISS[0], ISS[1]);
    ok(/Estudado para/i.test(api.$("vkaLista").textContent || ""),
       "R3c houve estudo e a gaveta nao diz: "
       + (api.$("vkaLista").textContent || "").slice(0, 120));
  }

  /* ================================================================
   * R4: UM SALTO — dois vínculos não viram oito linhas
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce, iss, sefaz } = montar(api);
    ligar(api, ISS, SEF, sefaz.id);
    ligar(api, SEF, TCE, tce.id);

    const ac = api.vkAcervoDoTopico(ISS[0], ISS[1]);
    ok(ac.itens.length <= 1,
       "R4 a travessia trouxe a vizinhanca da vizinhanca: "
       + JSON.stringify(ac.itens.map((x) => x.topico)));
    ok(api.vkLigadosDe(ISS[0], ISS[1]).length === 1,
       "R4b o padrao deixou de ser um salto: "
       + api.vkLigadosDe(ISS[0], ISS[1]).length);
    /* o caminho longo continua calculável a pedido — é o que permite à
     * revisão desenhar a rede quando a rede é o assunto */
    ok(api.vkLigadosDe(ISS[0], ISS[1], 3).length === 2,
       "R4c pedindo tres saltos a cadeia sumiu");
    ok(iss && true, "R4-pre");
  }

  /* ================================================================
   * R5: DE UM CONCURSO ENCERRADO, SÓ O MATERIAL FALA
   *
   * O registro de "estudei isto para o TCE-PE" não decide nada hoje: a
   * prova passou e o recorte era outro. O resumo que ficou de lá, sim.
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce } = montar(api);
    ligar(api, ISS, TCE, tce.id);

    /* sem material e sem estudo, num edital encerrado: linha muda */
    const vazio = api.vkAcervoDoTopico(ISS[0], ISS[1]);
    ok(vazio.itens.length === 0,
       "R5 uma ligacao com um concurso encerrado, sem material e sem "
       + "estudo, ocupou a tela: "
       + JSON.stringify(vazio.itens.map((x) => x.topico)));
    ok(vazio.temVinculo === false,
       "R5b a agenda poria selo para um vinculo que nao tem o que dizer");
    /* MAS ELE CONTINUA GUARDADO. Esconder é decisão de tela; apagar é
     * decisão de quem estuda, e tem lugar próprio. */
    ok(api.vkCarregar().length === 1,
       "R5c esconder virou apagar: " + api.vkCarregar().length);
    ok(vazio.mudos === 1,
       "R5d o numero de vinculos mudos nao foi contado: " + vazio.mudos);

    /* ESCREVA UM RESUMO LÁ, e a linha volta a falar sozinha. */
    api.matGravar(api.matChave(TCE[0], TCE[1]),
      "o resumo que sobrou do TCE-PE, com texto de verdade",
      { disciplina: TCE[0], topico: TCE[1] });
    const cheio = api.vkAcervoDoTopico(ISS[0], ISS[1]);
    ok(cheio.itens.length === 1 && cheio.temAlgo === true,
       "R5e o material escrito no concurso encerrado nao reapareceu");
    ok(cheio.itens[0].estudado === false,
       "R5f ter material virou ter estudado");
  }

  /* ---- R6: de um concurso que ainda vem, a coincidência já fala ---- */
  {
    const { api } = rodar();
    const { sefaz } = montar(api);
    ligar(api, ISS, SEF, sefaz.id);
    const ac = api.vkAcervoDoTopico(ISS[0], ISS[1]);
    /* AQUI o vínculo vale mesmo sem material e sem estudo: é o aviso de
     * que você vai estudar o mesmo assunto duas vezes — e ele só serve
     * ANTES, o que é a razão de existir do modo "vou estudar os dois". */
    ok(ac.itens.length === 1 && ac.temCoincidencia === true,
       "R6 a coincidencia entre dois editais ativos foi escondida junto "
       + "com o ruido: " + JSON.stringify(ac));
    ok(ac.itens[0].ativo === true,
       "R6b o app nao sabe que o outro edital ainda vai acontecer");
  }

  /* ================================================================
   * R7: A FAXINA — o app conta, quem apaga é você
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce, sefaz } = montar(api);
    ligar(api, ISS, TCE, tce.id);
    ligar(api, ISS, SEF, sefaz.id);

    const r = api.vkRevisao(api.vkRevFontes());
    ok(r.total === 2, "R7-pre nem todos os vinculos entraram: " + r.total);
    ok(r.grupos.length === 2,
       "R7 os vinculos nao foram agrupados por par de editais: "
       + JSON.stringify(r.grupos.map((g) => g.par)));
    /* AGRUPADO POR PAR, e o par tem ordem estável: A↔B e B↔A são o
     * mesmo par, e dois grupos para a mesma coisa dobrariam a lista. */
    ok(r.grupos.every((g) => /↔/.test(g.par)),
       "R7b o rotulo do grupo nao nomeia os dois editais: "
       + JSON.stringify(r.grupos.map((g) => g.par)));
    /* UM, e não dois — e é aqui que a tela quase mandou apagar o
     * trabalho todo.
     *
     * ISS↔TCE é mudo: o TCE já passou, não tem material e ninguém mais
     * estuda para ele. ISS↔SEFAZ NÃO é: os dois concursos ainda vão
     * acontecer, e a coincidência entre eles é o próprio aviso.
     *
     * A regra existia em dois lugares — a gaveta considerava "o outro
     * edital ainda vai acontecer" e a revisão não —, e na tela real
     * isso virou "502 de 513 vínculos não levam a nada" sobre um par de
     * concursos futuros, com um botão de marcar todos eles logo acima.
     * Agora a regra é uma função só, e este número é a prova. */
    ok(r.mudos === 1,
       "R7c a revisao e a gaveta discordam sobre o que e' um vinculo "
       + "mudo — a revisao esta contando como inutil a coincidencia "
       + "entre dois concursos futuros: " + r.mudos);

    /* APAGAR SÓ O QUE FOI ESCOLHIDO.
     * O "|| {}" não é preciosismo: sem ele, uma falha no agrupamento
     * derruba o arquivo inteiro com TypeError e as falhas já coletadas
     * se perdem no caminho — foi o que a sabotagem revelou. */
    const grupoTce = r.grupos.filter((g) => /TCE/.test(g.par))[0] || { itens: [] };
    const alvo = grupoTce.itens[0] || { a: "", b: "" };
    const quantos = api.vkApagarPares([{ a: alvo.a, b: alvo.b }]);
    ok(quantos === 1, "R7d apagar nao apagou: " + quantos);
    ok(api.vkCarregar().length === 1,
       "R7e apagar um levou o outro junto: " + api.vkCarregar().length);

    /* E NÃO TOCA EM MAIS NADA. É o que permite apagar sem medo — e é a
     * promessa escrita na segunda confirmação. */
    ok((api.diarioAtual() || []).length === 0,
       "R7f apagar vinculo mexeu no diario");
    ok(Object.keys(api.edProgresso || {}).length === 0,
       "R7g apagar vinculo mexeu no progresso");
  }

  /* ---- R8: a faxina na tela, e a confirmação que pode ser negada ---- */
  {
    const { api } = rodar();
    const { tce, sefaz } = montar(api);
    ligar(api, ISS, TCE, tce.id);
    ligar(api, ISS, SEF, sefaz.id);
    api.vkIniciarTela();
    api.vkRevAbrir();

    ok(/2 vínculo/.test(api.$("vkRevResumo").textContent || ""),
       "R8 o resumo da faxina nao conta os vinculos: "
       + api.$("vkRevResumo").textContent);
    ok(/sem hist[óo]rico/i.test(api.$("vkRevResumo").textContent || ""),
       "R8b a faxina nao diz quantos estao sem historico: "
       + api.$("vkRevResumo").textContent);

    /* A FAXINA VIROU DOIS GESTOS: escolher a aba "sem historico" e marcar
     * o que ela mostra. Antes um botao so varria a base inteira e marcava
     * coisas fora da vista. */
    api.vkRevAbaTrocar("mudos");
    api.vkRevMarcarVisiveis();
    /* marca SÓ o mudo de verdade (ISS↔TCE), não a coincidência entre os
     * dois concursos futuros */
    ok(Object.keys(api.vkRevMarcadosAtual()).length === 1,
       "R8c marcar os mudos marcou vinculo que tem o que dizer: "
       + Object.keys(api.vkRevMarcadosAtual()).length);

    /* RECUSAR A CONFIRMAÇÃO NÃO APAGA NADA. A confirmação existe para
     * poder ser negada; um teste que só olha se a promessa terminou
     * mede que a função rodou, não o que ela fez. */
    let pronto = false;
    const pr = api.vkRevApagar();
    pr.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(false); } catch (e) {}
    }
    await pr;
    ok(api.vkCarregar().length === 2,
       "R8d recusar a confirmacao apagou assim mesmo: "
       + api.vkCarregar().length);

    /* aceitando, apaga */
    await conduzir(api, api.vkRevApagar());
    ok(api.vkCarregar().length === 1,
       "R8e aceitar a confirmacao apagou o numero errado de vinculos "
       + "(o util tinha de ficar): " + api.vkCarregar().length);
  }

  /* ================================================================
   * R9: O MAPA — qual edital encosta em qual, e por quantos assuntos
   * ============================================================== */
  {
    const { api } = rodar();
    const { tce, sefaz, iss: iss2 } = montar(api);
    ligar(api, ISS, SEF, sefaz.id);
    ligar(api, ISS, TCE, tce.id);

    /* UM VÍNCULO DENTRO DO MESMO EDITAL não pode virar uma linha do
     * edital para ele mesmo. Acontece de verdade: dois tópicos irmãos
     * do mesmo concurso, ligados numa passada da IA. Sem este caso no
     * cenário, a asserção "nenhuma aresta liga um edital a si mesmo"
     * não mede nada — não havia como ela falhar. */
    api.vkAplicar([{
      de: { chave: api.vkChave(ISS[0], ISS[1]) },
      para: { chave: api.vkChave(ISS[0], "Limitações ao poder de tributar") },
      conf: "ALTA" }], iss2.id, "ambos");

    const m = api.vkMapaDados();
    ok(m.arestas.length === 2,
       "R9 o mapa nao achou as duas ligacoes entre editais: "
       + JSON.stringify(m.arestas));
    ok(m.arestas.every((e) => e.a && e.b && e.a !== e.b),
       "R9b uma aresta liga um edital a ele mesmo: "
       + JSON.stringify(m.arestas));
    ok(m.arestas.every((e) => e.ligacoes >= 1),
       "R9c o mapa nao conta quantas ligacoes existem entre os dois "
       + "editais: " + JSON.stringify(m.arestas.map((e) => e.ligacoes)));
    /* NOMES, não identificadores: o mapa é para ler. */
    ok(m.arestas.some((e) => /ISS Caruaru/.test(e.a + e.b)),
       "R9d o mapa nao usa o nome do concurso: " + JSON.stringify(m.arestas));

    /* e o desenho aparece NA LISTA — que é onde ele mora. Com um
     * edital aberto a lista está escondida, e pintar o mapa ali seria
     * desenhar atrás de uma tela fechada. */
    api.hubVoltar();
    api.hubRender();
    ok(api.$("hubMapa").hidden === false,
       "R9e o mapa nao apareceu na lista de editais");
    /* HTML, e não SVG: em SVG o texto não quebra nem corta, e os nomes
     * longos dos concursos passavam por cima da etiqueta do meio. */
    const filhos = Array.from(api.$("hubMapa").children || []);
    /* pelos BOTÕES, e não por prefixo de classe: "hub-par-off" — a
     * linha do concurso encerrado — casa com "hub-par-", e o filtro
     * anterior a excluía justamente por ser a que mudou de aparência. */
    const linhas = filhos.filter((x) => x.tag === "button");
    ok(linhas.length === 2,
       "R9f o mapa nao desenhou uma linha por par: " + linhas.length);
    ok(linhas.every((x) => x.tag === "button"),
       "R9g a linha do mapa nao e clicavel: "
       + JSON.stringify(linhas.map((x) => x.tag)));
  }

  /* ---- R10: sem vínculo nenhum, o mapa não ocupa espaço ---- */
  {
    const { api } = rodar();
    montar(api);
    api.hubVoltar();
    api.hubRender();
    ok(api.$("hubMapa").hidden === true,
       "R10 o mapa vazio ficou na tela ocupando espaco");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
