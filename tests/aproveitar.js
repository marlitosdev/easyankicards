/* APROVEITAR O QUE JÁ FOI ESTUDADO EM OUTRO CONCURSO.
 *
 * A regra que organiza tudo aqui cabe numa frase: VINCULAR NÃO É
 * MARCAR COMO ESTUDADO.
 *
 * "Já vi isto no TCE-PE" e "não preciso mais estudar isto para a SEFAZ"
 * são afirmações diferentes, e a distância entre elas só existe na
 * memória de quem estudou: o recorte muda, a banca muda, e seis meses
 * passaram. Marcar sozinho seria o app decidindo o que ele não tem como
 * saber — e o erro custaria um assunto inteiro na prova, porque um
 * tópico dado como feito some da agenda.
 *
 * O que o vínculo faz é abrir a porta: o resumo, os cartões, as leis e
 * as questões do outro concurso ficam a um toque, com a data e o nome
 * do concurso ao lado. Você olha e decide.
 *
 * E o material desta prova continua vazio, esperando o seu resumo.
 * Adotar o antigo misturaria o recorte de dois concursos num texto só,
 * e ninguém saberia depois qual parte foi escrita para qual banca. */
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

  /* monta os dois concursos: o antigo, com material e diário; o novo,
   * com o mesmo assunto sob outro nome */
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const chA = api.matChave("Direito Financeiro", "Receita Pública");
    api.matGravar(chA, "o resumo que eu escrevi para o TCE-PE, com texto",
      { disciplina: "Direito Financeiro", topico: "Receita Pública",
        concurso: "TCE-PE" });
    api.matGravarCartoes(chA, "P1? :: R1. :: tag_x\nP2? :: R2. :: tag_x",
      { disciplina: "Direito Financeiro", topico: "Receita Pública" });
    api.diarioPor([{ d: daqui(-40), c: chA, n: "Receita Pública",
      disc: "Direito Financeiro", a: "feito", m: 60, cc: "TCE-PE" }]);

    const velho = api.edCriar("TCE-PE",
      "# TCE-PE | prova: " + daqui(-5) + " | horas: 20\n"
      + "@ Direito Financeiro :: 5\n+ Receita Pública :: 5 :: pq");
    const novo = api.edCriar("SEFAZ",
      "# SEFAZ-AL | prova: " + daqui(200) + " | horas: 20\n"
      + "@ Direito Financeiro :: 5\n"
      + "+ Receita pública e seus estágios :: 5 :: cai sempre");
    api.hubAbrirEdital(novo.id);
    api.$("edProva").value = daqui(200);
    return { velho, novo, chA };
  };
  const ligar = (api, novoId) => api.vkAplicar([{
    de: { chave: api.vkChave("Direito Financeiro", "Receita Pública"),
          disciplina: "Direito Financeiro", topico: "Receita Pública" },
    para: { chave: api.vkChave("Direito Financeiro",
                               "Receita pública e seus estágios"),
            disciplina: "Direito Financeiro",
            topico: "Receita pública e seus estágios" },
    conf: "ALTA", sugestao: "PULAR", por: "mesma matéria" }], novoId);

  /* ================================================================
   * A1: VINCULAR NÃO MARCA NADA
   * ============================================================== */
  {
    const { api } = rodar();
    const { novo } = montar(api);
    const chNova = api.matChave("Direito Financeiro",
                                "Receita pública e seus estágios");
    ligar(api, novo.id);

    /* O TÓPICO CONTINUA PENDENTE. Se o vínculo marcasse, ele sumiria da
     * agenda — e você chegaria à prova sem ter estudado o recorte novo,
     * convencido pelo app de que já tinha estudado. */
    ok(!api.edProgresso[chNova],
       "A1 vincular marcou o topico como estudado: "
       + JSON.stringify(api.edProgresso[chNova]));

    const r = api.lerEdital(api.$("editalTexto").value);
    const p = api.montarPlano(r, { horas: 20, prova: daqui(200),
      feitos: api.edProgresso, fatores: {}, acertos: {} });
    const item = p.itens.filter((i) => /estágios/.test(i.nome))[0];
    ok(item && item.feito === false,
       "A1b o plano deu o topico como feito por causa do vinculo");
    ok(p.fila.some((i) => /estágios/.test(i.nome)),
       "A1c o topico vinculado sumiu da fila de estudo");
  }

  /* ---- A2: o acervo do outro concurso chega inteiro ---- */
  {
    const { api } = rodar();
    const { novo } = montar(api);
    ligar(api, novo.id);
    const ac = api.vkAcervoDoTopico("Direito Financeiro",
                                    "Receita pública e seus estágios");
    ok(ac.temAlgo === true, "A2 o acervo veio vazio");
    const x = ac.itens[0];
    /* QUANDO E PARA QUEM: é o par que decide. "Estudei há 40 dias para o
     * TCE-PE" e "estudei há dois anos" pedem coisas diferentes. */
    ok(x.concurso === "TCE-PE",
       "A2b o acervo nao diz para qual concurso foi estudado: " + x.concurso);
    ok(x.data === daqui(-40),
       "A2c o acervo nao diz quando foi estudado: " + x.data);
    ok(x.resumoChars > 20, "A2d o resumo antigo nao foi encontrado");
    ok(x.cartoes === 2,
       "A2e os cartoes antigos nao foram contados: " + x.cartoes);
  }

  /* ================================================================
   * A3: O MATERIAL DESTA PROVA CONTINUA VAZIO E LIVRE
   * ============================================================== */
  {
    const { api } = rodar();
    const { novo } = montar(api);
    ligar(api, novo.id);
    const chNova = api.matChave("Direito Financeiro",
                                "Receita pública e seus estágios");

    /* O vínculo não escreve nada na gaveta deste tópico. */
    ok(!api.matResumosAtual()[chNova],
       "A3 vincular criou material no topico novo — o resumo desta prova "
       + "tem de nascer vazio, esperando o texto desta banca");

    /* E ESCREVER O PRÓPRIO CONTINUA POSSÍVEL, sem que o acervo antigo
     * atrapalhe. Ter material de outro concurso é consulta, não
     * substituição. */
    api.matGravar(chNova, "meu resumo novo, escrito para a SEFAZ",
      { disciplina: "Direito Financeiro",
        topico: "Receita pública e seus estágios", concurso: "SEFAZ-AL" });
    const meu = api.matResumosAtual()[chNova];
    ok(meu && /SEFAZ/.test(meu.texto),
       "A3b nao consegui escrever resumo proprio no topico vinculado");

    /* e o do outro concurso não foi tocado */
    const velho = api.matResumosAtual()[
      api.matChave("Direito Financeiro", "Receita Pública")];
    ok(velho && /TCE-PE/.test(velho.texto),
       "A3c escrever o resumo novo alterou o resumo do outro concurso");

    /* o acervo continua apontando para o antigo, não para o novo */
    const ac = api.vkAcervoDoTopico("Direito Financeiro",
                                    "Receita pública e seus estágios");
    ok(ac.itens[0].chave !== chNova,
       "A3d o acervo passou a apontar para o proprio topico");
  }

  /* ---- A4: o selo aparece na agenda, com o que basta para decidir ---- */
  {
    const { api } = rodar();
    const { novo } = montar(api);
    ligar(api, novo.id);
    api.edRender(); api.hubRender();
    const achar = (el, out) => {
      Array.from(el.children || []).forEach((f) => {
        if (/(^| )ed-item( |$)/.test(f.className || "")) out.push(f);
        achar(f, out);
      });
      return out;
    };
    const li = achar(api.$("edAgendaTopo"), [])
      .filter((x) => /estágios/.test(x.textContent || ""))[0];
    ok(!!li, "A4-pre a linha nao esta na agenda");
    ok(/já estudei/i.test(li.textContent || ""),
       "A4 a linha nao mostra que ha material de outro concurso: "
       + (li.textContent || "").slice(0, 70));

    /* e a gaveta diz o concurso e a data — sem isso o selo seria só um
     * "existe algo", que não ajuda ninguém a decidir */
    api.vkaAbrir("Direito Financeiro", "Receita pública e seus estágios");
    const g = api.$("vkaLista").textContent || "";
    ok(/TCE-PE/.test(g), "A4b a gaveta nao nomeia o concurso: " + g.slice(0, 80));
    ok(/40/.test(g), "A4c a gaveta nao diz ha quantos dias: " + g.slice(0, 90));
    /* e avisa, com todas as letras, que não marcou nada */
    const aviso = api.t("vka_aviso");
    ok(/não marca|nao marca/i.test(aviso),
       "A4d o aviso da gaveta nao diz que nada foi marcado");
  }

  /* ================================================================
   * A5: O LOG DA VINCULAÇÃO, ANTES DE EFETIVAR
   * ============================================================== */
  {
    const { api } = rodar();
    const { velho, novo } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = velho.id;
    api.$("vkParaEdital").value = novo.id;
    api.vkPintarLados();

    api.$("vkColarTexto").value =
      "~ Direito Financeiro > Receita Pública :: Direito Financeiro > "
      + "Receita pública e seus estágios :: PULAR :: mesma matéria\n"
      + "lixo que a IA escreveu fora do formato";
    api.vkConferirColagem();

    const pares = api.vkParesAtual;
    ok(pares.length === 1,
       "A5-pre o par nao foi lido: " + JSON.stringify(pares.length));
    /* A SUGESTÃO É O QUE SE DECIDE, não a confiança. "PULAR" e "REVISAR"
     * dizem o que fazer; "ALTA/MEDIA" dizia só o quanto a IA acreditava. */
    ok(pares[0].sugestao === "PULAR",
       "A5 a sugestao nao foi lida: " + pares[0].sugestao);
    ok(/mesma matéria/.test(pares[0].por || ""),
       "A5b o motivo dado pela IA se perdeu");

    /* O LOG ESTÁ NA TELA, par a par, antes de qualquer coisa acontecer. */
    ok(api.$("vkParesCx").hidden === false, "A5c o log nao apareceu");
    const txt = api.$("vkPares").textContent || "";
    ok(/Receita Pública/.test(txt) && /estágios/.test(txt),
       "A5d o log nao mostra o par: " + txt.slice(0, 80));
    ok(/pular/i.test(txt), "A5e o log nao mostra a sugestao");

    /* e NADA foi criado ainda */
    ok(api.vkLigadosDe("Direito Financeiro",
                       "Receita pública e seus estágios").length === 0,
       "A5f conferir ja criou o vinculo — o log existe para ser lido antes");
  }

  /* ---- A6: só entra o que você marcou ---- */
  {
    const { api } = rodar();
    const { velho, novo } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = velho.id;
    api.$("vkParaEdital").value = novo.id;
    api.vkPintarLados();
    api.$("vkColarTexto").value =
      "~ Direito Financeiro > Receita Pública :: Direito Financeiro > "
      + "Receita pública e seus estágios :: PULAR :: mesma matéria";
    api.vkConferirColagem();

    /* DESMARCAR TUDO e aplicar não pode criar nada. É a diferença entre
     * um log que se lê e um log que se olha. */
    api.vkMarcarTodos(false);
    await conduzir(api, api.vkAplicarColagem());
    ok(api.vkLigadosDe("Direito Financeiro",
                       "Receita pública e seus estágios").length === 0,
       "A6 aplicou um par que estava desmarcado");

    api.vkMarcarTodos(true);
    await conduzir(api, api.vkAplicarColagem());
    ok(api.vkLigadosDe("Direito Financeiro",
                       "Receita pública e seus estágios").length === 1,
       "A6b marcar e aplicar nao criou o vinculo");
    /* e mesmo aplicando, nada foi marcado como estudado */
    ok(!api.edProgresso[api.matChave("Direito Financeiro",
                                     "Receita pública e seus estágios")],
       "A6c aplicar o vinculo marcou o topico como estudado");
  }

  /* ---- A7: o prompt nomeia os dois concursos ---- */
  {
    const { api } = rodar();
    montar(api);
    const p = api.vkPrompt(
      [{ disciplina: "Direito Financeiro", topico: "Receita Pública" }],
      [{ disciplina: "Direito Financeiro",
         nome: "Receita pública e seus estágios" }],
      "SEFAZ-AL Auditor Fiscal", "TCE-PE Auditor de Controle Externo");
    /* SEM OS DOIS CARGOS a IA compara dois nomes soltos: "Controle
     * interno e externo" num tribunal e numa secretaria de fazenda são
     * normas diferentes, e é o cargo que revela isso. */
    ok(/TCE-PE Auditor de Controle Externo/.test(p),
       "A7 o prompt nao diz de qual concurso vem o que ja foi estudado");
    ok(/SEFAZ-AL Auditor Fiscal/.test(p),
       "A7b o prompt nao diz para qual concurso e o aproveitamento");
    /* e pede a decisão, não a confiança */
    ok(/PULAR/.test(p) && /REVISAR/.test(p),
       "A7c o prompt nao pede a sugestao de pular ou revisar");
    ok(/na dúvida, NÃO relacione/i.test(p),
       "A7d a regra de ouro saiu do prompt — o erro para mais faz pular "
       + "assunto na prova, e o erro para menos so custa reler");
  }

  /* ---- A8: um edital contra ele mesmo não produz nada ---- */
  {
    const { api } = rodar();
    const { novo } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = novo.id;
    api.$("vkParaEdital").value = novo.id;
    api.vkPintarLados();
    ok(/dois editais diferentes/i.test(api.$("vkResumo").textContent || ""),
       "A8 comparar um edital com ele mesmo nao foi recusado: "
       + (api.$("vkResumo").textContent || "").slice(0, 60));
    ok(api.$("vkAtalho").hidden === true,
       "A8b o atalho aparece numa comparacao que nao existe");
  }

  /* ================================================================
   * A9: A CADEIA — A→B, depois B→C
   *
   * É a sequência natural: cada concurso novo você compara com o
   * anterior. Com um salto só, ela quebrava exatamente onde importa —
   * C enxergava B, B estava vazio, e o material que existe (em A) ficava
   * inalcançável. Na agenda do terceiro concurso o selo nem aparecia.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const chA = api.matChave("Direito Financeiro", "Receita Pública");
    api.matGravar(chA, "o resumo que existe, e so existe aqui",
      { disciplina: "Direito Financeiro", topico: "Receita Pública" });
    api.diarioPor([{ d: daqui(-100), c: chA, n: "Receita Pública",
      disc: "Direito Financeiro", a: "feito", m: 60, cc: "TCE-PE" }]);

    const A = api.edCriar("TCE", "# TCE-PE | prova: " + daqui(-5)
      + " | horas: 20\n@ Direito Financeiro :: 5\n+ Receita Pública :: 5 :: pq");
    const B = api.edCriar("ISS", "# ISS Caruaru | prova: " + daqui(100)
      + " | horas: 20\n@ Direito Financeiro :: 5\n"
      + "+ Receita pública e seus estágios :: 5 :: pq");
    const C = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + daqui(200)
      + " | horas: 20\n@ Direito Financeiro :: 5\n"
      + "+ Estágios da receita :: 5 :: pq");
    const kk = (t2) => api.vkChave("Direito Financeiro", t2);
    const lig = (deT, paraT, ed) => api.vkAplicar([{
      de: { chave: kk(deT), disciplina: "Direito Financeiro", topico: deT },
      para: { chave: kk(paraT), disciplina: "Direito Financeiro",
              topico: paraT }, conf: "ALTA" }], ed);
    lig("Receita Pública", "Receita pública e seus estágios", B.id);
    lig("Receita pública e seus estágios", "Estágios da receita", C.id);

    /* =============================================================
     * A CADEIA NÃO ATRAVESSA SOZINHA — e é assim que tem de ser
     * =============================================================
     *
     * Este bloco pedia o contrário: que C alcançasse A por dois elos.
     * O argumento era razoável — o material existe em A e ficaria
     * inalcançável — e o uso real mostrou o preço. Um tópico com dois
     * vínculos diretos aparecia com OITO na gaveta, porque cada um
     * puxava a vizinhança da vizinhança, e o painel que responde "o que
     * eu já tenho sobre isto?" respondia com meio banco de dados.
     *
     * E o mesmo argumento que sustentava os três saltos os derruba:
     * VÍNCULO NÃO É IGUALDADE. Cada elo aceita uma diferença de
     * recorte; dois elos somam duas, e o que chega na ponta não é "o
     * mesmo assunto", é um primo. Guardar o número de saltos e mostrá-lo
     * não resolvia: ninguém lê "2 saltos" e desconta confiança.
     *
     * Então o padrão é UM SALTO: o vínculo que a pessoa afirmou. */
    const acC = api.vkAcervoDoTopico("Direito Financeiro",
                                     "Estágios da receita");
    const doA = acC.itens.filter((x) => x.topico === "Receita Pública")[0];
    ok(!doA,
       "A9 o terceiro concurso alcancou o primeiro por transitividade — "
       + "e' assim que dois vinculos viram oito na tela: "
       + JSON.stringify(acC.itens.map((x) => x.topico)));

    const doB = acC.itens.filter((x) =>
      /^Receita pública e seus estágios$/.test(x.topico))[0];
    ok(doB && doB.saltos === 1,
       "A9b o vizinho DIRETO nao aparece — o vinculo que a pessoa "
       + "afirmou e' o que sempre tem de valer");

    /* O CAMINHO LONGO CONTINUA CALCULÁVEL, a pedido. É o que permite à
     * revisão de vínculos desenhar a rede inteira quando a rede é o
     * assunto — sem impor isso a quem só quer estudar. */
    ok(api.vkLigadosDe("Direito Financeiro", "Estágios da receita", 3)
       .length === 2,
       "A9c pedindo tres saltos a cadeia deixou de ser alcancavel: "
       + api.vkLigadosDe("Direito Financeiro", "Estágios da receita", 3).length);
    ok(api.vkLigadosDe("Direito Financeiro", "Estágios da receita").length
       === 1,
       "A9d o padrao deixou de ser um salto");

    /* CADA TÓPICO COM O CONCURSO CERTO — e "concurso" agora só existe
     * quando houve estudo registrado. O campo que diz de qual edital o
     * tópico é chama-se "ondeConsta", e a confusão entre os dois é o
     * que fazia o app afirmar estudo que nunca houve. */
    ok(doB && doB.ondeConsta === "ISS Caruaru",
       "A9e o topico do segundo concurso foi rotulado com o nome errado: "
       + JSON.stringify(doB && doB.ondeConsta));
    ok(doB && doB.estudado === false && doB.concurso === "",
       "A9f um topico sem registro no diario se diz estudado: "
       + JSON.stringify(doB && { e: doB.estudado, c: doB.concurso }));
    ok(acC.itens.every((x) => !/^em[a-z0-9]{8,}$/i.test(x.ondeConsta || "")),
       "A9g um id interno apareceu como nome de concurso: "
       + JSON.stringify(acC.itens.map((x) => x.ondeConsta)));

    /* ---- APAGAR UM EDITAL NÃO APAGA O QUE VOCÊ SOUBE ----
     * O vínculo registra um julgamento seu, e ele continua verdadeiro
     * depois que o edital sai da lista. */
    api.edApagar(B.id);
    ok(api.vkLigadosDe("Direito Financeiro", "Estágios da receita", 3).length
       === 2,
       "A9h apagar um edital apagou vinculos: "
       + api.vkLigadosDe("Direito Financeiro", "Estágios da receita", 3).length);
    ok(!!A && !!C, "A9-pre");
  }

  /* ================================================================
   * A10: LIGAR DE NOVO, LIGAR AO CONTRÁRIO, E FECHAR O CICLO
   *
   * Três coisas que a pessoa faz sem pensar e que quebrariam um grafo
   * ingênuo: repetir o mesmo par, escrevê-lo na ordem inversa, e fechar
   * A→B→C→A. A travessia percorre a cadeia, então um ciclo seria um
   * laço infinito se ninguém guardasse por onde já passou.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const chA = api.matChave("DF", "A");
    api.matGravar(chA, "resumo do A", { disciplina: "DF", topico: "A" });
    api.diarioPor([{ d: daqui(-50), c: chA, n: "A", disc: "DF",
      a: "feito", m: 60, cc: "TCE" }]);
    const eA = api.edCriar("TCE", "# TCE | prova: " + daqui(-5)
      + " | horas: 20\n@ DF :: 5\n+ A :: 5 :: pq");
    const eB = api.edCriar("ISS", "# ISS | prova: " + daqui(100)
      + " | horas: 20\n@ DF :: 5\n+ B :: 5 :: pq");
    const eC = api.edCriar("SEFAZ", "# SEFAZ | prova: " + daqui(200)
      + " | horas: 20\n@ DF :: 5\n+ C :: 5 :: pq");
    const kk = (t2) => api.vkChave("DF", t2);
    const lig = (x, y, ed) => api.vkAplicar([{
      de: { chave: kk(x), disciplina: "DF", topico: x },
      para: { chave: kk(y), disciplina: "DF", topico: y },
      conf: "ALTA" }], ed);

    /* REPETIR O MESMO PAR não duplica. Este botão vai ser apertado de
     * novo todo mês, com a resposta inteira da IA — e a maior parte dela
     * já vai estar aplicada. */
    ok(lig("A", "B", eB.id).novos === 1, "A10-pre o primeiro nao entrou");
    const r2 = lig("A", "B", eB.id);
    ok(r2.novos === 0 && r2.repetidos === 1,
       "A10 ligar o mesmo par de novo criou um vinculo repetido: "
       + JSON.stringify(r2));
    ok(api.vkCarregar().length === 1,
       "A10b sobrou vinculo duplicado guardado: " + api.vkCarregar().length);

    /* NA ORDEM INVERSA é o mesmo vínculo. "A é como B" e "B é como A"
     * são a mesma afirmação, e guardá-las duas vezes faria o acervo
     * mostrar o mesmo tópico duplicado. */
    const inv = lig("B", "A", eB.id);
    ok(inv.novos === 0 && inv.repetidos === 1,
       "A10c o par invertido virou um vinculo novo: " + JSON.stringify(inv));

    /* O CICLO A→B→C→A não pode virar laço infinito na travessia. */
    lig("B", "C", eC.id);
    lig("C", "A", eA.id);
    ok(api.vkCarregar().length === 3,
       "A10d o ciclo criou vinculos a mais: " + api.vkCarregar().length);

    const deC = api.vkLigadosDe("DF", "C");
    ok(deC.length === 2,
       "A10e a travessia repetiu nos no ciclo: "
       + JSON.stringify(deC.map((x) => x.chave)));
    /* cada um aparece UMA vez, e o acervo também */
    const ac = api.vkAcervoDoTopico("DF", "C");
    ok(ac.itens.length === 2,
       "A10f o acervo duplicou itens por causa do ciclo: " + ac.itens.length);

    /* E O CICLO ENCURTA A DISTÂNCIA, o que está certo: antes de fechar
     * C+A, o app sabia que A estava a dois elos de C e podia dizê-lo;
     * depois que VOCÊ afirmou que C e A são o mesmo, passa a um elo. */
    /* O NOME COMO ESTÁ NO EDITAL, não a chave em minúsculas: a gaveta
     * mostra "Receita Pública", não "receita publica". */
    ok(ac.itens.some((x) => x.topico === "A"),
       "A10g-pre o nome do topico veio da chave e nao do edital: "
       + JSON.stringify(ac.itens.map((x) => x.topico)));
    const doA = ac.itens.filter((x) => x.topico === "A")[0];
    ok(doA && doA.saltos === 1,
       "A10g fechar o ciclo nao encurtou o caminho: "
       + JSON.stringify(doA && doA.saltos));
    ok(doA && doA.resumoChars > 0,
       "A10h o material do A nao chegou em C pelo ciclo");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
