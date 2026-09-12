/* JURISPRUDÊNCIA — o quinto material de um tópico.
 *
 * POR QUE NÃO É UMA LEI COM OUTRO NOME, nem uma questão.
 *
 * A lei seca é texto ARTICULADO: dividido em artigos, lido em ordem, e o
 * marcador é "parei no art. 35". Um julgado não tem artigos, não se lê em
 * ordem, e o que importa dele cabe em três linhas. Uma questão tem
 * gabarito e se responde. Uma tese se lê, se reconhece na prova e se
 * revisa. Três verbos diferentes — e este aplicativo erra pouco
 * justamente por não misturá-los.
 *
 * O QUE PRECISA SER VERDADE:
 *
 * 1. COLAR COM FORMATAÇÃO não pode apagar o que não entendeu. Um
 *    extrator que "limpa" o texto joga fora justamente o que era
 *    diferente — e diferente costuma ser importante.
 * 2. DESLIGAR DE UM TÓPICO NÃO APAGA O JULGADO. A mesma tese de
 *    repercussão geral encosta em meia dúzia de assuntos, e tirá-la de
 *    um deles não pode levá-la dos outros.
 * 3. O CAMINHO CURTO É O QUE IMPORTA: lendo o resumo, selecionar a frase
 *    que o tribunal decidiu e guardar. Sem isso, guardar jurisprudência
 *    exigiria sair da leitura e redigitar — e ninguém faz isso no meio
 *    de um estudo. */
const { rodar } = require("./fumaca.js");

/* um bloco como o site do STF entrega */
const EMENTA_STF = [
  "RE 574706 / PR - PARANÁ",
  "RECURSO EXTRAORDINÁRIO",
  "Relator(a): Min. CÁRMEN LÚCIA",
  "Julgamento: 15/03/2017     Publicação: 02/10/2017",
  "Órgão julgador: Tribunal Pleno",
  "",
  "Tese: O ICMS não compõe a base de cálculo para fins de incidência do",
  "PIS e da COFINS.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + daqui(120)
      + " | horas: 20\n@ Direito Tributário :: 5\n"
      + "+ Base de cálculo do PIS/COFINS :: 5 :: cai sempre\n"
      + "+ Imunidades :: 4 :: pq");
    api.hubAbrirEdital(e.id);
    api.$("edProva").value = daqui(120);
    return e;
  };

  /* ================================================================
   * J1: COLAR COM FORMATAÇÃO
   * ============================================================== */
  {
    const { api } = rodar();
    const a = api.jurIdentificar(EMENTA_STF);
    /* A SIGLA NÃO ESTÁ NO BLOCO — e não estar é o caso comum: ela fica
     * no cabeçalho do site, fora do que se seleciona. "RE" só existe no
     * Supremo, então dá para deduzir sem inventar. */
    ok(!/STF/.test(EMENTA_STF),
       "J1-pre o cenario tem a sigla escrita e nao testa a deducao");
    ok(a.tribunal === "STF",
       "J1 o tribunal nao foi deduzido da classe: " + a.tribunal);
    ok(a.tribunalDeduzido === true,
       "J1a a deducao nao ficou marcada como deducao");
    ok(a.classe === "RE" && a.numero === "574706",
       "J1b a classe e o numero nao saíram juntos: "
       + a.classe + " " + a.numero);
    /* A DATA DE JULGAMENTO, não a de publicação — são duas no mesmo
     * bloco, e o que se cita é a do julgamento. */
    ok(a.data === "2017-03-15",
       "J1c pegou a data errada (julgamento é 15/03, publicação 02/10): "
       + a.data);
    ok(/CÁRMEN LÚCIA/i.test(a.relator || ""),
       "J1d o relator nao foi reconhecido: " + a.relator);
    ok(/Tribunal Pleno/i.test(a.orgao || ""),
       "J1e o orgao julgador nao foi reconhecido: " + a.orgao);
    ok(/ICMS não compõe/.test(a.tese || ""),
       "J1f a tese nao foi separada: " + a.tese);
    /* A TESE VEM INTEIRA, sem a quebra de linha do site no meio. */
    ok(/PIS e da COFINS/.test(a.tese || ""),
       "J1g a tese foi cortada na quebra de linha: " + a.tese);

    /* A PUBLICAÇÃO VINDO PRIMEIRO.
     *
     * No bloco acima o julgamento aparece antes, e aí "a primeira data
     * do texto" e "a data rotulada como julgamento" dão o mesmo
     * resultado — a asserção J1c passava com as duas leituras. Há
     * páginas que imprimem a publicação primeiro, e é nelas que a
     * diferença aparece. */
    const inv = api.jurIdentificar(
      "REsp 1.111.111/SP\nPublicação: 02/10/2017\nJulgamento: 15/03/2017");
    ok(inv.data === "2017-03-15",
       "J1h com a publicacao escrita antes, pegou a data errada: "
       + inv.data);
  }

  /* ---- J2: as classes compostas antes das simples ---- */
  {
    const { api } = rodar();
    /* "AgRg no REsp" não pode virar "REsp": o agravo é outra peça, e
     * quem cita o agravo está falando de outra decisão. */
    const a = api.jurIdentificar("AgRg no REsp 1.234.567/SP, STJ, j. 10/05/2019");
    ok(a.classe === "AgRg no REsp",
       "J2 a classe composta virou a simples: " + a.classe);
    ok(a.numero === "1.234.567",
       "J2b o numero perdeu a formatacao ou levou o estado junto: "
       + a.numero);
    ok(a.tribunal === "STJ", "J2c o tribunal do STJ nao foi lido");
    /* AQUI A SIGLA ESTÁ ESCRITA: o que está no texto manda, e a
     * dedução não pode se apresentar como leitura. */
    ok(a.tribunalDeduzido === false,
       "J2e leu a sigla do texto e marcou como deducao");
    ok(a.data === "2019-05-10",
       "J2d a data abreviada (j. 10/05/2019) nao foi lida: " + a.data);
  }

  /* ---- J3: súmulas e temas, que não têm "processo" ---- */
  {
    const { api } = rodar();
    const s = api.jurIdentificar("Súmula Vinculante 8 do STF");
    ok(s.classe === "Súmula Vinculante" && s.numero === "8",
       "J3 sumula vinculante nao reconhecida: "
       + s.classe + " " + s.numero);
    const t2 = api.jurIdentificar("Tema 69 da repercussão geral (STF)");
    ok(t2.classe === "Tema" && t2.numero === "69",
       "J3b tema de repercussao geral nao reconhecido: "
       + t2.classe + " " + t2.numero);
  }

  /* ---- J4: o que não se reconhece fica em branco, não inventado ---- */
  {
    const { api } = rodar();
    const a = api.jurIdentificar("uma anotação minha sobre um julgado qualquer");
    ok(!a.tribunal && !a.classe && !a.numero,
       "J4 o extrator inventou campos num texto sem nada: "
       + JSON.stringify(a));
    /* SIGLA DENTRO DE PALAVRA NÃO É TRIBUNAL.
     *
     * A primeira versão usava "MANIFESTO" e "MOSTRA", que não contêm
     * sigla nenhuma — a asserção não tinha como falhar. "POSTMORTEM"
     * contém STM, é palavra de verdade e aparece em maiúsculas nos
     * cabeçalhos de ementa criminal, que é exatamente onde o extrator
     * lê. */
    ok(/STM/.test("POSTMORTEM"),
       "J4b-pre a palavra escolhida nao contem sigla de tribunal");
    const b = api.jurIdentificar("PERÍCIA POSTMORTEM. LAUDO CONCLUSIVO.");
    ok(!b.tribunal,
       "J4b achou tribunal dentro de uma palavra: " + b.tribunal);
  }

  /* ================================================================
   * J5: O TEXTO COLADO NUNCA SE PERDE
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.jurAbrir("Direito Tributário", "Base de cálculo do PIS/COFINS");
    api.$("jurColar").value = EMENTA_STF;
    api.jurColar();
    await conduzir(api, api.jurSalvar());

    const lista = api.jurDoTopico(
      api.matChave("Direito Tributário", "Base de cálculo do PIS/COFINS"));
    ok(lista.length === 1, "J5-pre o julgado nao foi guardado: " + lista.length);
    const j = lista[0];
    /* A EMENTA INTEIRA FICA. Um extrator que guarda só os campos que
     * entendeu apaga o resto — e o resto é onde está o raciocínio. */
    ok(/Publicação: 02\/10\/2017/.test(j.texto || ""),
       "J5 o texto colado foi podado ao que o extrator entendeu: "
       + String(j.texto).slice(0, 80));
    ok(j.tribunal === "STF" && j.numero === "574706",
       "J5b os campos reconhecidos nao foram gravados: "
       + j.tribunal + " " + j.numero);
    ok(/ICMS/.test(j.tese || ""), "J5c a tese nao foi gravada");
    ok(api.jurTitulo(j) === "STF RE 574706",
       "J5d o titulo curto saiu errado: " + api.jurTitulo(j));
  }

  /* ---- J6: sem tese e sem texto, não há o que guardar ---- */
  {
    const { api } = rodar();
    montar(api);
    api.jurAbrir("Direito Tributário", "Imunidades");
    api.$("jurTribunal").value = "STF";
    api.$("jurNumero").value = "123";
    await conduzir(api, api.jurSalvar());
    /* Um julgado só com o número é uma etiqueta que não se revisa. */
    ok(api.jurLista().length === 0,
       "J6 guardou um julgado sem tese e sem texto: "
       + JSON.stringify(api.jurLista().map((x) => api.jurTitulo(x))));
  }

  /* ================================================================
   * J7: DESLIGAR DE UM TÓPICO NÃO APAGA O JULGADO
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const chA = api.matChave("Direito Tributário", "Base de cálculo do PIS/COFINS");
    const chB = api.matChave("Direito Tributário", "Imunidades");
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "574706",
      tese: "O ICMS não compõe a base de cálculo do PIS e da COFINS.",
      topicos: [chA] });
    api.jurLigar(j.id, chB);

    ok(api.jurDoTopico(chA).length === 1 && api.jurDoTopico(chB).length === 1,
       "J7-pre o julgado nao ficou nos dois topicos");

    api.jurDesligar(j.id, chA);
    ok(api.jurDoTopico(chA).length === 0,
       "J7 desligar nao tirou do topico");
    /* E CONTINUA NO OUTRO. A mesma tese de repercussão geral encosta em
     * meia dúzia de assuntos; tirá-la de um não pode levá-la dos
     * outros. */
    ok(api.jurDoTopico(chB).length === 1,
       "J7b desligar de um topico apagou o julgado dos outros");
    ok(api.jurDe(j.id),
       "J7c desligar apagou o julgado do aplicativo");
  }

  /* ---- J8: a mesma comparação de chave da lei seca ---- */
  {
    const { api } = rodar();
    /* Um acento de diferença entre o que o edital escreveu e o que
     * ficou gravado abriria duas gavetas para o mesmo tópico. */
    ok(api.jurChaveComparavel("Direito Tributário›Imunidades")
       === api.jurChaveComparavel("direito tributario › imunidades")
         .replace(/\s+›\s+/, "›").replace(/\s+/g, " "),
       "J8-pre a comparacao de chave mudou de forma");
    const j = api.jurGravar({ tese: "x",
      topicos: ["Direito Tributário›Imunidades"] });
    ok(api.jurDoTopico("Direito Tributario›Imunidades").length === 1,
       "J8 um acento de diferenca abriu duas gavetas para o mesmo topico");
  }

  /* ================================================================
   * J9: O CAMINHO CURTO — do resumo, com o texto selecionado
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.matGravar(api.matChave("Direito Tributário", "Imunidades"),
      "O STF decidiu que o ICMS não compõe a base do PIS/COFINS.",
      { disciplina: "Direito Tributário", topico: "Imunidades" });
    api.matAbrirEditor({ disciplina: "Direito Tributário", nome: "Imunidades" },
                       "ler");
    api.jurIniciarTela();

    /* o material guarda a seleção; a jurisprudência a lê de lá em vez
     * de reimplementar a leitura — duas leituras da mesma coisa é como
     * duas telas passam a discordar */
    ok(typeof api.matAtualAtual === "function"
       && api.matAtualAtual() && api.matAtualAtual().topico === "Imunidades",
       "J9-pre o editor nao esta no topico esperado: "
       + JSON.stringify(api.matAtualAtual()));

    api.jurDaSelecao();
    ok(api.$("dlgJuris").open === true,
       "J9 o botao do resumo nao abriu a gaveta de jurisprudencia");
    const alvo = api.jurTopicoAtualAtual();
    ok(alvo && alvo.nome === "Imunidades",
       "J9b a gaveta abriu no topico errado: " + JSON.stringify(alvo));
  }

  /* ---- J10: a agenda e o material mostram o caminho ---- */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    /* DOIS julgados, e não um.
     *
     * Com um só, a tela usa a chave do singular ("1 julgado") e a
     * etiqueta do plural nunca é exercida — foi assim que uma sabotagem
     * no texto plural passou despercebida. */
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1",
      tese: "uma tese qualquer", topicos: [ch] });
    api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "2",
      tese: "outra tese", topicos: [ch] });
    api.edRender();
    api.hubRender();

    const achar = (el, cls, out) => {
      Array.from(el.children || []).forEach((f) => {
        if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) out.push(f);
        achar(f, cls, out);
      });
      return out;
    };
    const chips = achar(api.$("edAgendaTopo"), "ed-st-jur", [])
      .concat(achar(api.$("edTabela"), "ed-st-jur", []));
    ok(chips.length > 0,
       "J10 o julgado guardado nao aparece na agenda");
    /* o "|| {}" evita que a falha acima derrube o arquivo com
     * TypeError, levando junto as falhas ja coletadas */
    const chip = chips[0] || {};
    ok(/julgado/i.test(chip.textContent || ""),
       "J10b a etiqueta da agenda nao diz o que ela conta: "
       + chip.textContent);
    /* CONTAGEM, como nos outros materiais: "2 julgados" e não só "§". */
    ok(/2/.test(chip.textContent || ""),
       "J10c a etiqueta nao traz a contagem: " + chip.textContent);
  }

  /* ---- J11: entra no backup ---- */
  {
    const { api } = rodar();
    /* A jurisprudência é material do mesmo nível do resumo e da lei
     * seca: meses de teses copiadas dos tribunais, que não se
     * reconstituem de lugar nenhum. Ficar de fora do backup faria a
     * restauração apagá-la sem uma linha de aviso — como aconteceu com
     * os rascunhos e com os adiamentos. */
    const grupos = JSON.stringify(api.gruposBackup || {});
    ok(grupos.indexOf("eac_juris") >= 0,
       "J11 a jurisprudencia ficou de fora do backup");
  }

  /* ================================================================
   * J12: LER E INCLUIR SÃO DOIS GESTOS
   *
   * Clicar na etiqueta "2 julgados" é pedir para VER os dois. Um
   * formulário de sete campos no topo empurra as teses para fora da
   * tela — e a tela existe para lê-las. Sem julgado nenhum não há
   * leitura possível, e a única coisa a fazer é incluir.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");

    /* SEM NADA GUARDADO: abre no formulário. */
    api.jurAbrir("Direito Tributário", "Imunidades");
    ok(api.jurModoAtual === "incluir",
       "J12 topico vazio abriu em leitura, sem nada para ler");
    ok(api.$("jurForm").hidden === false,
       "J12a o formulario ficou escondido num topico sem julgado nenhum");
    ok(api.$("jurLerAcoes").hidden === true,
       "J12b ofereceu 'guardar mais um' antes de existir o primeiro");

    /* COM JULGADO GUARDADO: abre lendo. */
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "574706",
      tese: "O ICMS não compõe a base de cálculo do PIS e da COFINS.",
      texto: EMENTA_STF, topicos: [ch] });
    api.jurAbrir("Direito Tributário", "Imunidades");
    ok(api.jurModoAtual === "ler",
       "J12c com julgado guardado, abriu no formulario em vez de ler");
    ok(api.$("jurForm").hidden === true,
       "J12d o formulario continua ocupando o topo do modo leitura");
    ok(api.$("jurLerAcoes").hidden === false,
       "J12e nao ha caminho para guardar mais um a partir da leitura");
    /* O TÍTULO ACOMPANHA: "Guardar jurisprudência" enquanto se lê seria
     * a tela dizendo que faz uma coisa e fazendo outra. */
    ok(/guardad/i.test(api.$("jurTitulo").textContent || ""),
       "J12f o titulo nao mudou para o modo leitura: "
       + api.$("jurTitulo").textContent);

    /* O BOTÃO "+ GUARDAR MAIS UM" leva ao formulário — e o caminho de
     * volta existe, porque agora há o que ler. */
    api.jurTrocarModo("incluir");
    ok(api.$("jurForm").hidden === false,
       "J12g '+ guardar mais um' nao abriu o formulario");
    ok(api.$("btnJurVoltarLer").hidden === false,
       "J12h no formulario, faltou o caminho de volta para a leitura");
    api.jurTrocarModo("ler");
    ok(api.$("jurForm").hidden === true,
       "J12i 'voltar para a leitura' nao fechou o formulario");

    /* EDITAR É INCLUIR COM OS CAMPOS PREENCHIDOS. Sem trocar de modo, o
     * clique em ✏️ preencheria um formulário escondido e a tela não
     * mudaria — o pior tipo de botão: o que parece não funcionar. */
    const id = api.jurDoTopico(ch)[0].id;
    api.jurEditar(id);
    ok(api.$("jurForm").hidden === false,
       "J12j editar preencheu um formulario que continua escondido");
    ok(api.jurMetaAberta() === true,
       "J12k editar a mao deixou os campos detectados fechados");
  }

  /* ---- J13: guardar volta para a leitura ---- */
  {
    const { api } = rodar();
    montar(api);
    api.jurAbrir("Direito Tributário", "Imunidades");
    api.$("jurTese").value = "Uma tese qualquer para guardar.";
    await conduzir(api, api.jurSalvar());
    /* FICAR NO FORMULÁRIO VAZIO depois de salvar não mostra que salvou:
     * a tela fica idêntica à de antes de apertar o botão. */
    ok(api.jurModoAtual === "ler",
       "J13 depois de guardar, a tela continuou no formulario");
    ok(api.$("jurLista").children.length === 1,
       "J13a o julgado guardado nao apareceu na leitura");

    /* E TIRAR O ÚLTIMO volta para o formulário: não sobrou leitura. */
    const id = api.jurDoTopico(api.matChave("Direito Tributário", "Imunidades"))[0].id;
    await conduzir(api, api.jurTirar(id));
    ok(api.jurModoAtual === "incluir",
       "J13b tirou o ultimo julgado e a tela ficou em modo de leitura vazio");
  }

  /* ================================================================
   * J14: A PÍLULA DIZ OS VALORES, E OS CAMPOS FICAM ATRÁS DELA
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    /* ABRIR COM OS CAMPOS FECHADOS, e não "nascer" fechados.
     *
     * A primeira versão só abria a gaveta e conferia que a sanfona
     * estava recolhida — mas ela vem recolhida do HTML, e nada no
     * caminho a tinha aberto: a asserção não podia falhar, e sabotar
     * jurLimparForm para nunca fechá-la passava limpo. Agora a gaveta é
     * aberta uma vez COM os campos expostos, e o que se testa é se a
     * abertura seguinte os recolhe. */
    api.jurAbrir("Direito Tributário", "Imunidades");
    api.jurMeta(true);
    ok(api.jurMetaAberta() === true,
       "J14-pre nao consegui abrir os campos: o cenario nao testa nada");
    api.jurAbrir("Direito Tributário", "Imunidades");
    ok(api.jurMetaAberta() === false,
       "J14 os campos ficaram abertos da vez anterior, empurrando a tese");

    api.$("jurColar").value = EMENTA_STF;
    api.jurColar();
    const pil = api.$("jurColarAviso").textContent || "";
    /* OS VALORES, NÃO OS NOMES DOS CAMPOS. "5 campos: tribunal,
     * classe…" informa que houve leitura e nada sobre o que foi lido. */
    ok(/STF/.test(pil) && /574706/.test(pil),
       "J14a a pilula nao mostra o que foi lido, so quantos campos: " + pil);
    ok(/15\/03\/2017/.test(pil),
       "J14b a pilula nao traz a data reconhecida: " + pil);
    ok(!/Pleno/.test(EMENTA_STF.split("Tese:")[1] || ""),
       "J14b-pre o orgao aparece na tese e o teste nao separa as duas coisas");
    ok(/Pleno/.test(pil),
       "J14c a pilula nao traz o orgao julgador: " + pil);
    /* reconheceu: continuam fechados, porque não há o que corrigir */
    ok(api.jurMetaAberta() === false,
       "J14d reconheceu tudo e ainda assim abriu os seis campos");

    /* NÃO RECONHECEU NADA: aí não há o que conferir, há o que
     * preencher — e os campos precisam aparecer sozinhos. */
    api.jurLimparForm();
    api.$("jurColar").value = "uma anotação minha, sem processo nenhum";
    api.jurColar();
    ok(api.jurMetaAberta() === true,
       "J14e nao reconheceu nada e deixou os campos escondidos");
    ok(/reconhec/i.test(api.$("jurColarAviso").textContent || ""),
       "J14f nao avisou que nao reconheceu nada: "
       + api.$("jurColarAviso").textContent);
  }

  /* ================================================================
   * J15: DO JULGADO PARA O CARTÃO
   *
   * Guardar a tese é metade do trabalho; a outra é reencontrá-la sem
   * abrir esta gaveta.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "574706",
      tese: "O ICMS não compõe a base de cálculo do PIS e da COFINS.",
      texto: EMENTA_STF, topicos: [ch] });

    /* A PERGUNTA CITA O JULGADO e o assunto; a resposta é a tese, não a
     * ementa — um verso de trinta linhas não se responde. */
    const c = api.jurCartaoDe(j, "Imunidades");
    ok(/STF/.test(c.frente) && /574706/.test(c.frente),
       "J15 a pergunta do cartao nao cita o julgado: " + c.frente);
    ok(/Imunidades/.test(c.frente),
       "J15a a pergunta nao diz sobre que assunto e: " + c.frente);
    ok(c.verso === "O ICMS não compõe a base de cálculo do PIS e da COFINS.",
       "J15b o verso nao e a tese: " + c.verso);
    ok(c.verso.length < EMENTA_STF.length,
       "J15c o verso levou a ementa inteira junto");

    /* SEM TESE NÃO HÁ CARTÃO. */
    const mudo = api.jurGravar({ tribunal: "STJ", classe: "REsp",
      numero: "9", texto: "só a ementa, sem tese destacada", topicos: [ch] });
    ok(api.jurCartaoDe(mudo, "Imunidades") === null,
       "J15d gerou cartao de um julgado sem tese");

    /* GRAVA NO MATERIAL DO TÓPICO, no formato do app. */
    api.jurAbrir("Direito Tributário", "Imunidades");
    await conduzir(api, api.jurGerarCartao(j.id));
    const linhas = String((api.matResumosAtual()[ch] || {}).cartoes || "")
      .split("\n").filter((l) => l.trim());
    ok(linhas.length === 1,
       "J15e o cartao nao foi gravado no material do topico: "
       + linhas.length);
    const campos = linhas[0].split("::");
    ok(campos.length === 3,
       "J15f o cartao nao saiu no formato frente::verso::etiquetas: "
       + linhas[0]);
    ok(/jurisprudencia/.test(campos[2] || ""),
       "J15g o cartao nao leva a etiqueta que o identifica: " + campos[2]);
    ok(/STF/.test(campos[2] || ""),
       "J15h o cartao nao leva a etiqueta do tribunal: " + campos[2]);

    /* IDEMPOTENTE, como o resto do app: gerar duas vezes não duplica. */
    await conduzir(api, api.jurGerarCartao(j.id));
    const depois = String((api.matResumosAtual()[ch] || {}).cartoes || "")
      .split("\n").filter((l) => l.trim());
    ok(depois.length === 1,
       "J15i gerar o mesmo cartao duas vezes criou dois: " + depois.length);
  }

  /* ================================================================
   * J16: O QUE VEM COLADO DE UM MATERIAL DE ESTUDO
   *
   * O caso real: a pessoa colou um texto de resposta de IA, com
   * **negrito** de markdown, títulos "###", marcadores de lista, e a
   * data escrita só como "em 2019".
   * ============================================================== */
  {
    const { api } = rodar();
    const bloco = [
      /* O TÍTULO ENTRA NO MESMO PARÁGRAFO DA TESE.
       *
       * Na primeira versão o "###" estava num bloco LÁ EMBAIXO, que não
       * vira tese nenhuma — a asserção "o título não sobrou" não podia
       * falhar. Trazido para cima, ela pegou um buraco de verdade: o
       * texto era achatado antes da limpeza, e a regra do título, presa
       * ao início de linha, não encontrava mais nada. */
      "### ADI 2405/RS — Supremo Tribunal Federal",
      "No julgamento da **ADI 2405/RS**, em 2019, o Supremo Tribunal Federal",
      "(STF) decidiu que **não há reserva de Lei Complementar Federal** para",
      "tratar de novas hipóteses de suspensão e extinção de créditos.",
      "",
      "### 1. O impasse da Dação em Pagamento",
      "* **A restrição da ADI 1.917:** o fundamento foi a ofensa à licitação.",
    ].join("\n");
    const a = api.jurIdentificar(bloco);

    ok(a.classe === "ADI" && a.numero === "2405",
       "J16 a classe e o numero nao saíram: " + a.classe + " " + a.numero);

    /* OS ASTERISCOS NÃO PODEM SOBRAR NA TESE.
     *
     * O app não desenha markdown na citação da tese: "**ADI 2405/RS**"
     * aparecia com os asteriscos LITERAIS na tela, num texto que se vai
     * reler dezenas de vezes até a prova. */
    ok(/\*\*/.test(bloco),
       "J16-pre o bloco do cenario nao tem markdown, e o teste nao "
       + "mede limpeza nenhuma");
    ok(!/\*/.test(a.tese),
       "J16a os asteriscos do markdown sobraram na tese: " + a.tese);
    ok(/###/.test(bloco.split("\n\n")[0]),
       "J16b-pre o titulo ### nao esta no bloco que vira tese, e a "
       + "assercao abaixo nao pode falhar");
    ok(!/#/.test(a.tese),
       "J16b o titulo ### sobrou na tese: " + a.tese);
    /* E O TEXTO CONTINUA INTEIRO: limpar a tese não pode virar cortar
     * conteúdo — a frase toda tem de estar lá, sem as marcas. */
    ok(/não há reserva de Lei Complementar Federal/.test(a.tese),
       "J16c limpar o markdown levou junto o texto: " + a.tese);

    /* O ANO SOLTO. "em 2019" não vira dd/mm/aaaa, mas também não pode
     * sumir: a caixa de data fica vazia e a tela diz que viu o ano. */
    ok(a.data === "",
       "J16d inventou dia e mes a partir de um ano solto: " + a.data);
    ok(a.ano === "2019",
       "J16e o ano escrito no texto nao foi reconhecido: " + a.ano);

    /* E A PÍLULA CONTA. */
    api.matIniciar(); api.edIniciar();
    api.jurAbrir("Direito Tributário", "Princípios");
    api.$("jurColar").value = bloco;
    api.jurColar();
    const pil = api.$("jurColarAviso").textContent || "";
    ok(/2019/.test(pil),
       "J16f a pilula nao diz que viu o ano: " + pil);
    ok(/só o ano|so o ano/i.test(pil),
       "J16g a pilula mostra 2019 como se fosse data completa: " + pil);

    /* O OUTRO CAMINHO DA TESE: o bloco rotulado "Ementa:".
     *
     * O extrator tem dois ramos — o rotulado e o "primeira frase longa"
     * — e o cenário acima só passa pelo segundo. A sabotagem que
     * achatava o texto antes de limpar SÓ no ramo rotulado passou
     * limpo, porque nada exercia esse ramo. */
    const rotulado = [
      "REsp 1.234.567/SP",
      /* O "##" PRECISA ESTAR NUMA LINHA DEPOIS DA PRIMEIRA.
       *
       * Colado logo após "Ementa:", ele fica no começo do trecho
       * capturado — e aí a regra ancorada em ^ acerta mesmo com o texto
       * já achatado, porque a posição 0 continua sendo início. A
       * sabotagem só falha quando o título está numa linha do meio. */
      "Ementa: TRIBUTÁRIO. ICMS. PIS E COFINS.",
      "## O ponto decidido",
      "O **ICMS** não compõe a base de cálculo do PIS e da COFINS,",
      "conforme decidido pelo Plenário.",
    ].join("\n");
    const r = api.jurIdentificar(rotulado);
    ok(/ICMS não compõe/.test(r.tese),
       "J16h-pre o ramo rotulado nao extraiu a tese: " + r.tese);
    ok(!/#/.test(r.tese) && !/\*/.test(r.tese),
       "J16h a marcacao sobrou na tese vinda de 'Ementa:': " + r.tese);
  }

  /* ---- J17: o balão da ajuda não pode sair atrás da caixa ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.jurAbrir("Direito Tributário", "Princípios");
    const alvo = api.$("btnJurAjuda");
    ok(!!alvo, "J17-pre o (?) da jurisprudencia nao existe");

    const bal = api.dicaMostrar(alvo, "um texto de ajuda");
    /* UM <dialog> ABERTO POR showModal() VIVE NA TOP LAYER, acima de
     * toda a página independentemente de z-index. Pendurado no <body>,
     * o balão saía ATRÁS da própria caixa que o abriu — visível pela
     * borda e ilegível. Pendurado no diálogo, entra na top layer junto. */
    ok(bal.parentNode === api.$("dlgJuris"),
       "J17 o balao foi pendurado fora da caixa, e sai atras dela: "
       + ((bal.parentNode || {}).id || "body"));
  }

  /* ================================================================
   * J18: O MESMO JULGADO GUARDADO DUAS VEZES
   *
   * Aconteceu no uso real: "ADI 2405" e "ADI 2.405" viraram dois
   * cartões na mesma tela. É o mesmo processo — o que os separou foi o
   * ponto de milhar.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const a = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "2405",
      tese: "Não há reserva de lei complementar para novas hipóteses de "
        + "suspensão e extinção do crédito tributário.",
      texto: "ementa longa do primeiro", topicos: [ch] });
    const b = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "2.405",
      data: "2003-12-19",
      tese: "Distinção para provas: a dação em pagamento de bens móveis "
        + "genérica é inconstitucional.",
      texto: "ementa longa do segundo", topicos: [ch] });

    /* A PONTUAÇÃO NÃO FAZ DOIS PROCESSOS. E isto é aritmética: mandar
     * para uma IA decidir se "2405" e "2.405" são o mesmo número seria
     * pagar por uma resposta que a comparação de strings dá com
     * certeza. */
    ok(api.jurIdentidade(a) === api.jurIdentidade(b),
       "J18 o ponto de milhar fez dois processos diferentes: "
       + api.jurIdentidade(a) + " vs " + api.jurIdentidade(b));

    /* SEM CLASSE OU SEM NÚMERO NÃO HÁ IDENTIDADE — e vazio não casa com
     * vazio, senão todo julgado sem número viraria repetido de todos os
     * outros sem número. */
    const solto = api.jurGravar({ tribunal: "STJ",
      tese: "uma anotação sem processo nenhum", topicos: [ch] });
    const solto2 = api.jurGravar({ tribunal: "STJ",
      tese: "outra anotação sem processo nenhum", topicos: [ch] });
    ok(api.jurIdentidade(solto) === "",
       "J18a inventou identidade para um julgado sem classe nem numero");
    ok(api.jurIguaisA(solto).length === 0,
       "J18b dois julgados sem numero viraram repetidos um do outro");

    const pares = api.jurRepetidosDoTopico(ch);
    ok(pares.length === 1,
       "J18c a tela nao achou o par repetido (ou achou demais): "
       + pares.length);
    ok(api.jurDoTopico(ch).length === 4,
       "J18-pre o cenario nao tem os quatro julgados: "
       + api.jurDoTopico(ch).length);
  }

  /* ---- J19: unir não perde nada ---- */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const outro = api.matChave("Direito Tributário", "Base de cálculo do PIS/COFINS");
    const a = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "2405",
      tese: "A TESE QUE FICA", texto: "ementa do primeiro", topicos: [ch] });
    const b = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "2.405",
      data: "2003-12-19", orgao: "Tribunal Pleno",
      tese: "A TESE QUE SAI", texto: "ementa do segundo",
      topicos: [ch, outro] });

    const r = api.jurUnir(a.id, b.id);
    ok(!!r, "J19 unir devolveu nada");
    ok(api.jurDe(b.id) === null,
       "J19a o repetido continua guardado depois de unir");

    /* NADA SE PERDE. A tese que sai vai para o texto, com uma linha
     * dizendo de onde veio — este arquivo inteiro é construído sobre
     * "o extrator não joga fora o que não entendeu". */
    ok(/A TESE QUE SAI/.test(r.texto || ""),
       "J19b a tese do repetido foi jogada fora: " + r.texto);
    ok(/ementa do segundo/.test(r.texto || ""),
       "J19c a ementa do repetido foi jogada fora");
    ok(r.tese === "A TESE QUE FICA",
       "J19d a tese de quem fica foi trocada: " + r.tese);

    /* OS CAMPOS QUE FALTAVAM VÊM DO OUTRO: unir tem de somar. */
    ok(r.data === "2003-12-19",
       "J19e a data que so o repetido tinha se perdeu: " + r.data);
    ok(/Tribunal Pleno/.test(r.orgao || ""),
       "J19f o orgao que so o repetido tinha se perdeu");

    /* E OS TÓPICOS SE SOMAM: o repetido estava ligado a um tópico que o
     * outro não tinha, e perder essa ligação faria o julgado sumir de
     * uma tela em que ele aparecia. */
    ok((r.topicos || []).length === 2,
       "J19g os topicos dos dois nao se somaram: "
       + JSON.stringify(r.topicos));
    ok(api.jurContarDoTopico(outro) === 1,
       "J19h o julgado sumiu do topico que so o repetido tinha");
    ok(api.jurContarDoTopico(ch) === 1,
       "J19i sobrou mais de um no topico original: "
       + api.jurContarDoTopico(ch));
  }

  /* ---- J20: o prompt, para quando a aritmética não responde ---- */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "574706",
      tese: "O ICMS não compõe a base do PIS/COFINS.", topicos: [ch] });
    api.jurGravar({ tribunal: "STF", classe: "Tema", numero: "69",
      tese: "O ICMS não compõe a base de cálculo do PIS e da COFINS.",
      topicos: [ch] });

    /* NÚMEROS DIFERENTES, MESMA TESE. A aritmética diz que são dois
     * processos — e são —, mas para o estudo é uma coisa só: o
     * recurso e o tema de repercussão geral que dele nasceu. */
    const L = api.jurDoTopico(ch);
    ok(api.jurRepetidosDoTopico(ch).length === 0,
       "J20-pre a aritmetica ja resolveu este caso, e o prompt nao "
       + "seria necessario");
    const p = api.jurPromptComparar(L);
    ok(/574706/.test(p) && /Tema 69/.test(p),
       "J20 o prompt nao levou os dois julgados: " + p.slice(0, 200));
    ok(/ICMS não compõe a base do PIS/.test(p),
       "J20a o prompt levou o titulo mas nao a tese");
    /* ELE PEDE UM FORMATO QUE DÊ PARA LER, e avisa o que NÃO conta como
     * "a mesma coisa" — sem isso a IA junta tudo que fala do mesmo
     * assunto, e distinção é matéria de prova. */
    ok(/MESMO:/.test(p) && /DIFERENTE:/.test(p),
       "J20b o prompt nao pede um formato de resposta");
    ok(/exceção|DIFERENTES/.test(p),
       "J20c o prompt nao avisa o que nao conta como a mesma coisa");
    /* COM UM SÓ não há o que comparar. */
    ok(api.jurPromptComparar([L[0]]) === "",
       "J20d montou prompt de comparacao com um julgado so");
  }

  /* ---- J21: o negrito vira negrito, sem innerHTML ---- */
  {
    const { api } = rodar();
    /* um elemento qualquer da tela serve de tela em branco: o
     * simulador nao expoe document.createElement pela api */
    const el = api.$("jurLista");
    api.jurEscreverTese(el, "No julgamento da **ADI 2405/RS**, o STF decidiu.");
    /* O QUE FOI GUARDADO ANTES tem os asteriscos gravados no texto.
     * Desenhar resolve isso sem mexer no que está no armazenamento —
     * migrar dado por causa de aparência é trocar o certo pelo bonito. */
    const negritos = (el.children || []).filter((x) => x.tag === "b");
    ok(negritos.length === 1,
       "J21 o **negrito** nao virou <b>: " + negritos.length);
    ok(negritos[0].textContent === "ADI 2405/RS",
       "J21a o negrito saiu com os asteriscos dentro: "
       + negritos[0].textContent);
    ok(!/\*/.test(el.textContent || ""),
       "J21b sobraram asteriscos no texto desenhado: " + el.textContent);
    ok(/o STF decidiu/.test(el.textContent || ""),
       "J21c o texto depois do negrito se perdeu: " + el.textContent);
  }

  /* ================================================================
   * J22: JSON É ACEITO, MAS NÃO É EXIGIDO
   *
   * Uma proposta era o "ler e preencher" passar a EXIGIR JSON limpo.
   * Isso inverteria o valor do botão: hoje se copia da página do
   * tribunal e cola; exigindo JSON, seria copiar, pedir a uma IA que
   * converta, e só então colar — três passos onde havia um, e nenhum
   * possível sem chave de API. Aqui os dois caminhos convivem.
   * ============================================================== */
  {
    const { api } = rodar();
    const j = api.jurIdentificar(JSON.stringify({
      tribunal: "STF", classe: "ADI", numero: "2405",
      data_julgamento: "28/03/2019",
      tese_curta: "Não há reserva de lei complementar federal.",
      categoria: "CONTROLE CONCENTRADO",
    }));
    ok(j.classe === "ADI" && j.numero === "2405",
       "J22 o JSON nao foi lido: " + JSON.stringify(j));
    /* A DATA CHEGA NORMALIZADA: a caixa da tela é <input type="date"> e
     * só entende aaaa-mm-dd; devolver "28/03/2019" ali seria devolver
     * um campo vazio. */
    ok(j.data === "2019-03-28",
       "J22a a data do JSON nao foi normalizada: " + j.data);
    ok(/reserva de lei complementar/.test(j.tese || ""),
       "J22b a tese do JSON nao veio");

    /* OS DOIS NOMES DE CADA CAMPO: quem gera o JSON é uma IA seguindo
     * um exemplo, e exemplo nunca é seguido à risca. */
    const b = api.jurIdentificar(JSON.stringify({
      corte: "STJ", tipo: "REsp", processo: "1.234.567",
      tese: "Uma tese qualquer.", julgamento: "2020-05-10" }));
    ok(b.tribunal === "STJ" && b.classe === "REsp" && b.numero === "1.234.567",
       "J22c as grafias alternativas do JSON nao foram aceitas: "
       + JSON.stringify(b));
    ok(b.data === "2020-05-10", "J22d a data ja em ISO foi estragada: " + b.data);

    /* O CAMINHO DE TEXTO CONTINUA INTACTO — é o principal. */
    const t2 = api.jurIdentificar(EMENTA_STF);
    ok(t2.classe === "RE" && t2.numero === "574706",
       "J22e o extrator de texto parou de funcionar: " + JSON.stringify(t2));

    /* UM JSON QUE NÃO É DE JULGADO CAI NO EXTRATOR DE TEXTO.
     *
     * A primeira versão usava {"foo":1} e conferia que classe e número
     * ficavam vazios — o que é verdade também quando o JSON devolve um
     * registro todo em branco, e a asserção não podia falhar. O caso
     * que separa os dois é um JSON cujos CAMPOS não se reconhecem mas
     * cujo TEXTO tem um julgado dentro: com a recusa, o extrator de
     * texto o encontra; sem ela, some. */
    const nada = api.jurIdentificar(
      '{"observacao":"segundo o RE 574706, julgado em 15/03/2017"}');
    ok(nada.classe === "RE" && nada.numero === "574706",
       "J22f um JSON sem campos de julgado nao caiu no extrator de "
       + "texto, e o julgado que estava escrito dentro dele se perdeu: "
       + JSON.stringify(nada));
    /* e JSON quebrado também não derruba nada */
    ok(!!api.jurIdentificar('{"tribunal": "STF"'),
       "J22g um JSON malformado quebrou o extrator");

    /* ANO SOLTO no campo de data não vira 1º de janeiro. */
    const so = api.jurIdentificar(JSON.stringify({
      classe: "ADI", numero: "1", data: "2019", tese: "x" }));
    ok(so.data === "" && so.ano === "2019",
       "J22h um ano solto no JSON virou data inteira: " + so.data);
  }

  /* ---- J23: a categoria, deduzida da classe ---- */
  {
    const { api } = rodar();
    /* NÃO É ENFEITE: súmula vinculante se decora literal, tema
     * repetitivo se decora pela tese, acórdão isolado se lê pelo
     * raciocínio. O selo diz qual dos três está na tela. */
    ok(api.jurCategoria("Súmula Vinculante") === "SÚMULA VINCULANTE",
       "J23 a sumula vinculante nao foi classificada");
    ok(api.jurCategoria("Tema") === "REPETITIVO",
       "J23a o tema repetitivo nao foi classificado");
    ok(api.jurCategoria("ADI") === "CONTROLE CONCENTRADO",
       "J23b a ADI nao foi classificada");
    /* E O QUE NÃO TEM CATEGORIA PRÓPRIA fica sem selo, em vez de
     * receber um rótulo inventado. */
    ok(api.jurCategoria("REsp") === "",
       "J23c inventou categoria para um recurso comum: "
       + api.jurCategoria("REsp"));
    ok(api.jurCategoria("") === "", "J23d inventou categoria sem classe");

    /* o extrator de texto tambem classifica */
    const sv = api.jurIdentificar("Súmula Vinculante 8 do STF");
    ok(sv.categoria === "SÚMULA VINCULANTE",
       "J23e o texto foi lido mas nao classificado: " + sv.categoria);
  }

  /* ================================================================
   * J24: O RESUMO É OUTRO CAMPO, E NÃO OUTRA VERSÃO DA TESE
   *
   * É a decisão central deste pedaço. A tese é a proposição jurídica
   * como ela é: uma paráfrase que troque "lei complementar" por "lei
   * ordinária", ou que perca um "não", vira resposta errada
   * memorizada — e memorizada com a confiança de quem copiou do
   * tribunal. Explicação pode ser reescrita à vontade; tese não.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const TESE = "O ICMS não compõe a base de cálculo do PIS e da COFINS.";
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "574706",
      tese: TESE, resumo: "O Supremo separou faturamento de tributo.",
      topicos: [ch] });

    /* OS DOIS SOBREVIVEM, e separados. */
    ok(api.jurDe(j.id).tese === TESE,
       "J24 a tese guardada nao e a que foi escrita");
    ok(/separou faturamento/.test(api.jurDe(j.id).resumo || ""),
       "J24a o resumo nao foi guardado: " + api.jurDe(j.id).resumo);

    /* SEM RESUMO, O CAMPO EXISTE VAZIO — e não "undefined". É o que
     * faz um registro antigo, gravado antes deste campo, ler igual a um
     * novo: sem isso, metade dos julgados responderia undefined e a
     * comparação com "" falharia em lugares diferentes. */
    const semResumo = api.jurGravar({ tribunal: "STJ", classe: "REsp",
      numero: "9", tese: "outra", topicos: [ch] });
    ok(semResumo.resumo === "",
       "J24-pre um julgado sem resumo nao nasce com o campo vazio: "
       + JSON.stringify(semResumo.resumo));

    /* PELO FORMULÁRIO, que é o caminho que a pessoa usa. */
    api.jurAbrir("Direito Tributário", "Imunidades", "incluir");
    api.$("jurTese").value = "Uma tese digitada.";
    api.$("jurResumo").value = "Um resumo digitado.";
    await conduzir(api, api.jurSalvar());
    const doForm = api.jurDoTopico(ch)
      .filter((x) => /tese digitada/.test(x.tese || ""))[0];
    ok(doForm && /resumo digitado/.test(doForm.resumo || ""),
       "J24-pre2 o resumo escrito no formulario nao foi gravado: "
       + JSON.stringify(doForm && doForm.resumo));

    /* NA TELA, OS DOIS APARECEM — e a tese primeiro. */
    api.jurAbrir("Direito Tributário", "Imunidades");
    const cx = api.$("jurLista");
    ok(/ICMS não compõe/.test(cx.textContent || ""),
       "J24b a tese sumiu do cartao");
    ok(/separou faturamento/.test(cx.textContent || ""),
       "J24c o resumo nao aparece no cartao");
    const pos = (s2) => (cx.textContent || "").indexOf(s2);
    ok(pos("ICMS não compõe") < pos("separou faturamento"),
       "J24d o resumo veio antes da tese, e rouba a atencao da frase "
       + "que cai na prova");
  }

  /* ---- J25: o JSON traz o resumo, e a tese continua transcrita ---- */
  {
    const { api } = rodar();
    const j = api.jurIdentificar(JSON.stringify({
      classe: "ADI", numero: "2405",
      tese_curta: "Não há reserva de lei complementar federal.",
      resumo: "O Supremo reconheceu competência dos Estados.",
    }));
    ok(/reserva de lei complementar/.test(j.tese || ""),
       "J25 a tese do JSON nao veio");
    ok(/competência dos Estados/.test(j.resumo || ""),
       "J25a o resumo do JSON nao veio: " + j.resumo);
    /* SÃO CAMPOS DIFERENTES: um não pode virar o outro. */
    ok(j.tese !== j.resumo,
       "J25b tese e resumo chegaram com o mesmo conteudo");
  }

  /* ================================================================
   * J26: O PROMPT PROÍBE REESCREVER A TESE
   *
   * É a regra que o prompt existe para carregar. Sem ela, a IA
   * "melhora" a tese — e melhorar uma proposição jurídica é mudá-la.
   * ============================================================== */
  {
    const { api } = rodar();
    const p2 = api.jurPromptPreencher("Ementa longa qualquer do tribunal.",
      "Imunidades");
    ok(/Ementa longa qualquer/.test(p2),
       "J26-pre o texto do julgado nao entrou no prompt");
    ok(/Imunidades/.test(p2),
       "J26a o topico de estudo nao entrou no prompt");

    /* PEDE JSON, que é o formato que o app já sabe ler. */
    ok(/tese_curta/.test(p2) && /resumo/.test(p2),
       "J26b o prompt nao pede os dois campos separados");
    /* E DIZ, COM TODAS AS LETRAS, que a tese é transcrição.
     *
     * A primeira versão aceitava qualquer uma de três palavras em
     * qualquer lugar do texto — e por isso continuava passando quando a
     * instrução principal virava "reescreva com clareza", já que
     * "TRANSCRIÇÃO" sobrevivia noutra linha. As duas frases que de fato
     * carregam a regra são exigidas juntas. */
    ok(/é TRANSCRIÇÃO/.test(p2),
       "J26c o prompt nao declara que a tese e transcricao");
    ok(/[Cc]opie a frase do próprio texto/.test(p2),
       "J26c2 o prompt nao manda copiar a frase do texto");
    ok(/n[ãa]o parafraseie|nao parafraseie/i.test(p2),
       "J26d o prompt nao proibe parafrasear a tese: " + p2.slice(0, 200));
    /* o resumo, ao contrário, é explicitamente da IA */
    ok(/suas palavras/i.test(p2),
       "J26e o prompt nao diz que o resumo e escrito pela IA");

    /* SEM TEXTO não há pergunta a fazer. */
    ok(api.jurPromptPreencher("", "x") === "",
       "J26f montou prompt de leitura sem ementa nenhuma");
  }

  /* ================================================================
   * J27: O JSON NÃO PODE VIRAR A EMENTA
   *
   * O DEFEITO RELATADO: "ver ementa completa" mostrava o objeto JSON
   * cru, com chaves e aspas. O que ficasse na caixa de colar virava o
   * "texto" do julgado, e colando um JSON era o JSON que ficava.
   *
   * JSON é transporte; o que se lê é ementa.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const EMENTA = "TRIBUTÁRIO. Dação em pagamento de bens móveis. "
      + "Ofensa ao princípio da licitação. Inconstitucionalidade.";
    const JSONBRUTO = JSON.stringify({
      tribunal: "STF", classe: "ADI", numero: "1.917",
      data_julgamento: "2003-09-11", categoria: "CONTROLE CONCENTRADO",
      hashtags: ["#DaçãoEmPagamento", "#Licitação"],
      tese_curta: "É inconstitucional a lei local que preveja dação genérica.",
      resumo_prova: "A prática burla a obrigação de licitar.",
      ementa_limpa: EMENTA,
    });

    api.jurAbrir("Direito Tributário", "Imunidades", "incluir");
    api.$("jurColar").value = JSONBRUTO;
    api.jurColar();

    /* A CAIXA DEIXA DE MOSTRAR O JSON. É a correção na origem: o JSON
     * nunca chega ao armazenamento nem à tela, e a pessoa VÊ o que foi
     * extraído. */
    const naCaixa = api.$("jurColar").value || "";
    ok(naCaixa.trim()[0] !== "{",
       "J27 o JSON continuou na caixa e vai virar a ementa guardada: "
       + naCaixa.slice(0, 40));
    ok(/Dação em pagamento de bens móveis/.test(naCaixa),
       "J27a a ementa limpa nao substituiu o JSON: " + naCaixa.slice(0, 60));

    await conduzir(api, api.jurSalvar());
    const j = api.jurDoTopico(api.matChave("Direito Tributário", "Imunidades"))
      .filter((x) => x.numero === "1.917")[0];
    ok(j, "J27b-pre o julgado nao foi guardado");
    ok(String(j.texto || "").indexOf("{") < 0,
       "J27b o JSON foi guardado como ementa: " + String(j.texto).slice(0, 60));
    ok(/Ofensa ao princípio da licitação/.test(j.texto || ""),
       "J27c a ementa guardada nao e a limpa: " + String(j.texto).slice(0, 60));
    /* e os campos separados chegaram inteiros */
    ok(/inconstitucional a lei local/.test(j.tese || ""),
       "J27d a tese se perdeu");
    ok(/burla a obrigação de licitar/.test(j.resumo || ""),
       "J27e o resumo se perdeu");
    ok((j.tags || []).length === 2,
       "J27f as etiquetas nao foram guardadas: " + JSON.stringify(j.tags));
    /* GUARDADAS SEM O "#": guardar com e ler sem seriam duas
     * representações da mesma coisa. */
    ok((j.tags || []).every((x) => x[0] !== "#"),
       "J27g as etiquetas foram guardadas com o '#': "
       + JSON.stringify(j.tags));

    /* ================================================================
     * J27i: O JSON SEM "ementa_limpa" — o caso da tela
     *
     * O JSON que a IA devolveu não trazia ementa nenhuma. O guarda
     * anterior só trocava a caixa QUANDO havia ementa limpa, então o
     * JSON ficava lá — e ia virar o texto guardado, que é exatamente o
     * defeito que ele existia para impedir. Sem ementa, a caixa esvazia:
     * melhor vazio do que código.
     * ============================================================== */
    api.jurLimparForm();
    api.$("jurColar").value = JSON.stringify({
      tribunal: "STF", classe: "ADI", numero: "1.917",
      tese_curta: "A tese que veio no JSON.", resumo: "O resumo do JSON." });
    api.jurColar();
    ok(String(api.$("jurColar").value || "").trim()[0] !== "{",
       "J27i o JSON sem ementa ficou na caixa e vai virar o texto "
       + "guardado: " + String(api.$("jurColar").value).slice(0, 40));
    ok(/A tese que veio no JSON/.test(api.$("jurTese").value || ""),
       "J27j a tese do JSON nao chegou ao campo");

    /* ================================================================
     * J27k: O JSON SUBSTITUI O QUE JÁ ESTAVA ESCRITO
     *
     * Para texto solto, não sobrescrever é a regra certa: o extrator
     * adivinha, e adivinhação não apaga trabalho. Um JSON não adivinha
     * — traz campos nomeados, e quem o colou colou para que
     * substituíssem. Na tela, a tese ficou com um texto antigo enquanto
     * o JSON trazia a tese certa.
     * ============================================================== */
    api.jurLimparForm();
    api.$("jurTese").value = "UM TEXTO ANTIGO QUE ESTAVA AQUI";
    api.$("jurResumo").value = "UM RESUMO ANTIGO";
    api.$("jurColar").value = JSON.stringify({
      classe: "RE", numero: "9", tese_curta: "A TESE NOVA DO JSON.",
      resumo: "O RESUMO NOVO DO JSON." });
    api.jurColar();
    ok(/A TESE NOVA DO JSON/.test(api.$("jurTese").value || ""),
       "J27k o JSON nao substituiu a tese antiga: "
       + api.$("jurTese").value);
    ok(/O RESUMO NOVO DO JSON/.test(api.$("jurResumo").value || ""),
       "J27l o JSON nao substituiu o resumo antigo");

    /* MAS TEXTO SOLTO CONTINUA SEM SOBRESCREVER. É a outra metade da
     * regra, e sem ela colar uma ementa apagaria a tese que a pessoa
     * escreveu à mão. */
    api.jurLimparForm();
    api.$("jurTese").value = "A MINHA TESE, ESCRITA À MÃO";
    api.$("jurColar").value = EMENTA_STF;
    api.jurColar();
    ok(/A MINHA TESE, ESCRITA À MÃO/.test(api.$("jurTese").value || ""),
       "J27m colar uma ementa apagou a tese escrita a mao: "
       + api.$("jurTese").value);

    /* ---- J27n: o Guardar fica onde se acha ---- */
    const fs3 = require("fs"), path3 = require("path");
    const html3 = fs3.readFileSync(
      path3.join(__dirname, "..", "docs", "index.html"), "utf8");
    const gav = html3.slice(html3.indexOf('id="dlgJuris"'),
      html3.indexOf("</dialog>", html3.indexOf('id="dlgJuris"')));
    const rodape = gav.slice(gav.indexOf('class="dlg-rodape jur-rodape"'));
    /* Ele ficava depois de TRÊS caixas de texto altas, abaixo da dobra,
     * enquanto o "Fechar" — a ação menos importante — era o único preso
     * no rodapé. Quem terminava de escrever não via como salvar. */
    ok(/btnJurSalvar/.test(rodape),
       "J27n o botao de guardar nao esta na barra fixa, e volta a ficar "
       + "abaixo das tres caixas de texto");
    ok(rodape.indexOf("btnJurSalvar") < rodape.indexOf("btnJurFechar"),
       "J27o o 'Fechar' vem antes do 'Guardar' na barra fixa");

    /* UMA EMENTA COMUM não é tocada. */
    api.jurLimparForm();
    api.$("jurColar").value = EMENTA_STF;
    api.jurColar();
    ok(api.$("jurColar").value === EMENTA_STF,
       "J27h a colagem de texto comum foi alterada pelo caminho do JSON");
  }

  /* ================================================================
   * J28: AS ETIQUETAS CRUZAM TÓPICOS
   *
   * É o que elas fazem que a árvore do edital não faz: a mesma
   * etiqueta liga uma ADI estudada em Tributário a um repetitivo
   * estudado em Administrativo.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const a1 = api.matChave("Direito Tributário", "Imunidades");
    const b1 = api.matChave("Direito Tributário", "Base de cálculo do PIS/COFINS");
    api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "1917",
      tese: "t1", tags: ["Licitação", "DaçãoEmPagamento"], topicos: [a1] });
    api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "1",
      tese: "t2", tags: ["licitacao"], topicos: [b1] });
    api.jurGravar({ tribunal: "STF", classe: "RE", numero: "2",
      tese: "t3", tags: ["Imunidade"], topicos: [a1] });

    /* SEM ACENTO E SEM CAIXA: "Licitação" e "licitacao" são a mesma
     * etiqueta, e duas grafias fariam duas listas. */
    ok(api.jurTagNormal("#Licitação") === api.jurTagNormal("licitacao"),
       "J28 as duas grafias da mesma etiqueta nao se encontram");
    const porTag = api.jurPorTag("Licitação");
    ok(porTag.length === 2,
       "J28a a etiqueta nao cruzou os dois topicos: " + porTag.length);
    ok(porTag.some((x) => x.numero === "1917")
       && porTag.some((x) => x.numero === "1"),
       "J28b os dois julgados da etiqueta nao vieram");

    /* A LISTA DE TODAS, com quantos cada uma tem. */
    const todas = api.jurTagsTodas();
    const lic = todas.filter((x) => x.chave === "licitacao")[0];
    ok(lic && lic.n === 2,
       "J28c a contagem da etiqueta esta errada: " + JSON.stringify(lic));
    ok(todas[0].n >= todas[todas.length - 1].n,
       "J28d a lista de etiquetas nao veio da mais usada para a menos");

    /* O FILTRO NA TELA: clicar numa etiqueta mostra só os dela. */
    api.jurAbrir("Direito Tributário", "Imunidades");
    const cx = api.$("jurLista");
    const antes = (cx.children || []).filter((x) => /jur-item/.test(x.className || "")).length;
    ok(antes === 2, "J28e-pre o topico nao tem os dois julgados: " + antes);
    const tag = (cx.querySelectorAll ? cx.querySelectorAll(".jur-tag") : [])
      .filter((b) => /licita/i.test(b.textContent || ""))[0];
    ok(tag, "J28f nao ha etiqueta clicavel no cartao");
    tag.onclick({ stopPropagation() {} });
    const dep = (cx.children || []).filter((x) => /jur-item/.test(x.className || "")).length;
    ok(dep === 1, "J28g clicar na etiqueta nao filtrou a lista: " + dep);
    /* e clicar de novo devolve todos */
    const tag2 = (cx.querySelectorAll ? cx.querySelectorAll(".jur-tag") : [])
      .filter((b) => /licita/i.test(b.textContent || ""))[0];
    tag2.onclick({ stopPropagation() {} });
    ok((cx.children || []).filter((x) => /jur-item/.test(x.className || "")).length === 2,
       "J28h clicar de novo na etiqueta nao devolveu a lista inteira");
  }

  /* ---- J29: todo botão da gaveta explica o que faz ---- */
  {
    const { api } = rodar();
    /* Um julgado guardado errado é matéria estudada errada, e esta tela
     * tem botões que criam, apagam, copiam para fora e mandam texto
     * para uma IA. Nenhum pode depender de adivinhação. */
    const fs2 = require("fs"), path2 = require("path");
    const html = fs2.readFileSync(
      path2.join(__dirname, "..", "docs", "index.html"), "utf8");
    const gaveta = html.slice(html.indexOf('id="dlgJuris"'),
      html.indexOf("</dialog>", html.indexOf('id="dlgJuris"')));
    const botoes = [...gaveta.matchAll(/<button[^>]*id="(btnJur[^"]+)"[^>]*>/g)];
    ok(botoes.length >= 8,
       "J29-pre achei poucos botoes na gaveta: " + botoes.length);
    const mudos = botoes.filter((m) =>
      !/data-i18n-title=|title=/.test(m[0])).map((m) => m[1]);
    ok(mudos.length === 0,
       "J29 estes botoes da jurisprudencia nao explicam o que fazem: "
       + mudos.join(", "));
  }

  /* ================================================================
   * J30: O QUE JÁ FOI GUARDADO ERRADO TAMBÉM PRECISA SER CONSERTADO
   *
   * Corrigir a ENTRADA não conserta o que entrou antes dela. Os
   * julgados salvos enquanto o defeito existia têm o objeto JSON
   * gravado no campo do texto — e é ele que o "ver ementa completa"
   * mostra, com chaves e aspas, e que o botão de copiar exporta.
   *
   * Foi exatamente o que a tela do usuário mostrou depois da correção:
   * a colagem nova já entrava limpa, e o julgado antigo continuava
   * exibindo o JSON.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const EMENTA = "TRIBUTÁRIO. Dação em pagamento. Inconstitucionalidade.";

    /* um julgado como ficou gravado ANTES da correção: o JSON inteiro
     * dentro do campo do texto, e alguns campos vazios */
    const cru = api.jurGravar({
      tribunal: "STF", classe: "ADI", numero: "1.917",
      tese: "A tese que eu ja tinha corrigido a mao",
      resumo: "", data: "",
      texto: JSON.stringify({
        tribunal: "STF", classe: "ADI", numero: "1.917",
        data_julgamento: "2003-09-11", categoria: "CONTROLE CONCENTRADO",
        hashtags: ["#Licitação"],
        tese_curta: "A TESE QUE VEIO NO JSON",
        resumo: "O resumo que estava no JSON.",
        ementa_limpa: EMENTA }),
      topicos: [ch] });
    ok(api.jurEhJson(api.jurDe(cru.id).texto),
       "J30-pre o cenario nao reproduz o estado defeituoso");

    const n2 = api.jurRepararJson();
    ok(n2 === 1, "J30 o conserto nao encontrou o julgado com JSON: " + n2);
    const dep = api.jurDe(cru.id);

    /* O JSON SAI DO CAMPO DO TEXTO, e a ementa limpa entra. */
    ok(!api.jurEhJson(dep.texto),
       "J30a o JSON continua no campo do texto: "
       + String(dep.texto).slice(0, 40));
    ok(dep.texto === EMENTA,
       "J30b a ementa limpa nao substituiu o JSON: " + dep.texto);

    /* O QUE ESTAVA VAZIO É PREENCHIDO a partir do que o JSON trazia —
     * senão o conserto jogaria fora dado que só existia ali. */
    ok(dep.data === "2003-09-11",
       "J30c a data que so existia no JSON se perdeu: " + dep.data);
    ok(/resumo que estava no JSON/.test(dep.resumo || ""),
       "J30d o resumo que so existia no JSON se perdeu");
    ok((dep.tags || []).length === 1,
       "J30e as etiquetas que so existiam no JSON se perderam");
    ok(dep.categoria === "CONTROLE CONCENTRADO",
       "J30f a categoria do JSON se perdeu: " + dep.categoria);

    /* E O QUE JÁ TINHA CONTEÚDO NÃO É TOCADO. A tese é texto de
     * estudo: se a pessoa corrigiu, a correção dela vale mais que o
     * JSON, e um conserto silencioso não pode desfazê-la. */
    ok(dep.tese === "A tese que eu ja tinha corrigido a mao",
       "J30g o conserto sobrescreveu a tese que a pessoa tinha "
       + "corrigido: " + dep.tese);

    /* RODAR DE NOVO NÃO FAZ NADA: o conserto roda a cada arranque. */
    ok(api.jurRepararJson() === 0,
       "J30h o conserto se repete a cada abertura do aplicativo");

    /* E ELE RODA SOZINHO AO ABRIR O APLICATIVO — que é o único jeito
     * de o julgado antigo do usuário ser consertado sem que ele precise
     * fazer nada. Chamar a função na mão, como acima, não prova isso. */
    const outro = api.jurGravar({ tribunal: "STJ", classe: "REsp",
      numero: "77", tese: "t",
      texto: JSON.stringify({ classe: "REsp", numero: "77",
        tese_curta: "x", ementa_limpa: "Uma ementa de verdade." }),
      topicos: [ch] });
    ok(api.jurEhJson(api.jurDe(outro.id).texto),
       "J30h2-pre o segundo cenario nao ficou com JSON no texto");
    api.jurIniciarTela();
    ok(!api.jurEhJson(api.jurDe(outro.id).texto),
       "J30h3 abrir o aplicativo nao conserta o que ja estava guardado "
       + "errado, e o usuario continuaria vendo o JSON para sempre");
  }

  /* ---- J30b: o que não é JSON não é tocado ---- */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1",
      tese: "t", texto: EMENTA_STF, topicos: [ch] });
    ok(api.jurRepararJson() === 0,
       "J30i o conserto mexeu num julgado com ementa normal");
    ok(api.jurDe(j.id).texto === EMENTA_STF,
       "J30j a ementa normal foi alterada pelo conserto");

    /* E UM JSON QUE O EXTRATOR NÃO ENTENDE fica como está: pode ser
     * outra coisa colada de propósito, e apagá-la seria destruir sem
     * saber o quê. */
    const outro = api.jurGravar({ tribunal: "STJ", classe: "REsp",
      numero: "2", tese: "t", texto: '{"anotacao":"minha","n":3}',
      topicos: [ch] });
    api.jurRepararJson();
    ok(/anotacao/.test(api.jurDe(outro.id).texto || ""),
       "J30k um JSON que nao e de julgado foi apagado pelo conserto");
  }

  /* ================================================================
   * J31: A TELA DE GUARDAR COMEÇA COM UMA CAIXA SÓ
   *
   * Três caixas altas empilhadas — ementa, tese e resumo — enchiam a
   * tela de espaço vazio antes de haver o que escrever nele: na
   * prática, duas caixas de quinze linhas para conteúdo de duas.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.jurAbrir("Direito Tributário", "Imunidades", "incluir");

    /* COMEÇA COM UMA CAIXA: a de colar. */
    ok(api.$("jurConteudo").hidden === true,
       "J31 a tese e o resumo ja abrem ocupando a tela, antes de haver "
       + "o que escrever neles");
    ok(api.$("jurColar").hidden !== true,
       "J31a a caixa de colar, que e por onde se comeca, esta escondida");
    /* e há como escrever sem colar nada */
    ok(api.$("btnJurAMao").hidden === false,
       "J31b nao ha caminho para escrever a tese a mao");

    /* COLAR E MANDAR LER faz os campos aparecerem, já preenchidos. */
    api.$("jurColar").value = EMENTA_STF;
    api.jurColar();
    ok(api.$("jurConteudo").hidden === false,
       "J31c depois de ler e preencher, os campos continuam escondidos");
    ok(/ICMS não compõe/.test(api.$("jurTese").value || ""),
       "J31d os campos apareceram vazios");
    ok(api.$("btnJurAMao").hidden === true,
       "J31e o botao de escrever a mao continua na tela depois de os "
       + "campos aparecerem");

    /* ESCREVER À MÃO abre sem colar nada. */
    api.jurLimparForm();
    ok(api.$("jurConteudo").hidden === true,
       "J31f limpar o formulario nao recolheu os campos");
    api.jurConteudoVisivel(true);
    ok(api.$("jurConteudo").hidden === false,
       "J31g o botao de escrever a mao nao abre os campos");

    /* E NUNCA SE ESCONDEM COM CONTEÚDO DENTRO: esconder texto que a
     * pessoa escreveu seria perder trabalho aos olhos dela. */
    api.$("jurTese").value = "uma tese escrita a mao";
    api.jurConteudoVisivel(false);
    ok(api.$("jurConteudo").hidden === false,
       "J31h os campos se esconderam com texto escrito dentro");

    /* EDITAR abre com tudo à mostra. */
    api.jurLimparForm();
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1",
      tese: "t", topicos: [api.matChave("Direito Tributário", "Imunidades")] });
    api.jurEditar(j.id);
    ok(api.$("jurConteudo").hidden === false,
       "J31i editar um julgado abriu com os campos escondidos");
  }

  /* ================================================================
   * J32: A PÍLULA NÃO SOBREVIVE À PRÓXIMA LEITURA
   *
   * O DEFEITO, achado numa tela: a pílula dizia "Detectado: STF · ADI
   * 1.917" enquanto a caixa já estava com outro julgado — sobra da
   * leitura anterior. Um selo de sucesso que fala do que não está mais
   * na tela é pior que selo nenhum: ele afirma, e afirma errado.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.jurAbrir("Direito Tributário", "Imunidades", "incluir");

    api.$("jurColar").value = JSON.stringify({
      classe: "ADI", numero: "1.917", tese_curta: "t" });
    api.jurColar();
    ok(/1\.917/.test(api.$("jurColarAviso").textContent || ""),
       "J32-pre a primeira leitura nao encheu a pilula");

    /* SEGUNDA LEITURA, de outro julgado: a pílula fala do novo. */
    api.$("jurColar").value = EMENTA_STF;
    api.jurColar();
    const pil = api.$("jurColarAviso").textContent || "";
    ok(!/1\.917/.test(pil),
       "J32 a pilula ainda anuncia o julgado da leitura anterior: " + pil);
    ok(/574706/.test(pil),
       "J32a a pilula nao anuncia o julgado que esta na caixa: " + pil);

    /* E COM A CAIXA VAZIA, o selo some em vez de continuar afirmando.
     *
     * Este é o caso que a limpeza no início existe para cobrir: quando
     * há o que ler, a própria leitura reescreve a pílula; quando não há,
     * a função sai antes e o selo antigo ficaria na tela anunciando um
     * julgado que já não está em lugar nenhum. */
    api.$("jurColar").value = "";
    api.jurColar();
    ok(api.$("jurColarAviso").hidden === true,
       "J32c com a caixa vazia, o selo da leitura anterior continuou "
       + "anunciando: " + api.$("jurColarAviso").textContent);

    /* EDITAR OUTRO JULGADO também apaga o selo: ele era da leitura, e a
     * leitura não é mais essa. */
    const j = api.jurGravar({ tribunal: "STJ", classe: "REsp", numero: "5",
      tese: "t", topicos: [api.matChave("Direito Tributário", "Imunidades")] });
    api.jurEditar(j.id);
    ok(api.$("jurColarAviso").hidden === true,
       "J32b abrir outro julgado para editar deixou o selo da leitura "
       + "anterior na tela: " + api.$("jurColarAviso").textContent);
  }

  /* ================================================================
   * J33: AS ETIQUETAS SÃO EDITÁVEIS ANTES DE SALVAR
   *
   * A IA propõe; quem estuda decide. Uma etiqueta errada não é só um
   * selo feio: ela entra no filtro, e um julgado marcado com o assunto
   * errado some da busca em que deveria aparecer.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    api.jurAbrir("Direito Tributário", "Imunidades", "incluir");
    api.$("jurColar").value = JSON.stringify({
      classe: "ADI", numero: "1", tese_curta: "t",
      hashtags: ["#Licitação", "#DaçãoEmPagamento"] });
    api.jurColar();

    const cx = api.$("jurTagsForm");
    const pilulas = (cx.children || [])
      .filter((x) => /jur-tag-ed/.test(x.className || ""));
    ok(pilulas.length === 2,
       "J33 as etiquetas do JSON nao apareceram para conferencia: "
       + pilulas.length);
    ok((cx.children || []).some((x) => /jur-tag-add/.test(x.className || "")),
       "J33a nao ha como acrescentar um assunto a mao");

    /* TIRAR UMA delas antes de salvar. */
    const x = (pilulas[0].children || [])
      .filter((b) => /jur-tag-x/.test(b.className || ""))[0];
    ok(x, "J33b-pre a pilula nao tem o botao de tirar");
    x.onclick();
    ok(api.jurTagsColadasAtual().length === 1,
       "J33b tirar uma etiqueta nao mexeu na lista: "
       + JSON.stringify(api.jurTagsColadasAtual()));

    await conduzir(api, api.jurSalvar());
    const g = api.jurDoTopico(ch).filter((y) => y.numero === "1")[0];
    ok(g && (g.tags || []).length === 1,
       "J33c o julgado foi guardado com a etiqueta que eu tinha tirado: "
       + JSON.stringify(g && g.tags));

    /* E EDITAR TRAZ AS ETIQUETAS DE VOLTA para conferência. */
    api.jurEditar(g.id);
    ok(api.jurTagsColadasAtual().length === 1,
       "J33d editar um julgado nao trouxe as etiquetas dele: "
       + JSON.stringify(api.jurTagsColadasAtual()));
    /* e não as perde ao salvar de novo */
    await conduzir(api, api.jurSalvar());
    ok((api.jurDe(g.id).tags || []).length === 1,
       "J33e salvar depois de editar apagou as etiquetas");
  }

  /* ================================================================
   * J34: "+ GUARDAR MAIS UM" DEPOIS DE UMA EDIÇÃO CANCELADA
   *
   * O DEFEITO relatado: tocar em ✏️ editar, desistir com "voltar para a
   * leitura" e então tocar em "+ guardar mais um julgado" reabria o
   * formulário com a tese/o resumo do julgado anterior ainda dentro —
   * jurEditar preenche os campos direto, sem passar por jurTrocarModo,
   * então "voltar" não os limpava. Duas consequências: o texto novo (ou
   * melhorado) colado não aparecia, porque jurColar só escreve por cima
   * de um campo vazio; e salvar sobrescrevia o julgado ANTIGO, porque
   * jurEditando continuava apontando para ele.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const ch = api.matChave("Direito Tributário", "Imunidades");
    const a = api.jurGravar({ tribunal: "STF", classe: "ADI", numero: "1",
      tese: "tese do primeiro julgado", resumo: "resumo do primeiro",
      topicos: [ch] });

    api.jurAbrir("Direito Tributário", "Imunidades", "ler");
    api.jurEditar(a.id);
    ok(api.$("jurTese").value === "tese do primeiro julgado",
       "J34-pre editar nao preencheu a tese para o cenario fazer sentido");

    /* desiste, sem salvar nada */
    api.jurTrocarModo("ler");
    /* "+ guardar mais um julgado" */
    api.jurTrocarModo("incluir");

    ok(api.$("jurTese").value === "" && api.$("jurResumo").value === ""
       && api.$("jurColar").value === "",
       "J34 o formulario de '+ guardar mais um' reabriu com sobra da "
       + "edicao cancelada: tese=" + JSON.stringify(api.$("jurTese").value));

    /* o texto novo (aqui, o "melhorado") precisa aparecer — antes, um
     * campo nao-vazio bloqueava a sobrescrita */
    api.$("jurTese").value = "tese do segundo julgado, melhorada";
    api.$("jurResumo").value = "resumo do segundo, melhorado";
    api.$("jurNumero").value = "2";
    await conduzir(api, api.jurSalvar());

    const doTopico = api.jurDoTopico(ch);
    ok(doTopico.length === 2,
       "J34a devia haver 2 julgados guardados, vieram " + doTopico.length
       + " — salvar sobrescreveu o primeiro em vez de criar outro");
    const original = api.jurDe(a.id);
    ok(original && original.tese === "tese do primeiro julgado",
       "J34b o julgado original foi sobrescrito pelo '+ mais um': "
       + JSON.stringify(original && original.tese));
    const novo = doTopico.filter((j) => j.id !== a.id)[0];
    ok(novo && novo.tese === "tese do segundo julgado, melhorada",
       "J34c o julgado novo nao guardou o texto melhorado: "
       + JSON.stringify(novo && novo.tese));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
