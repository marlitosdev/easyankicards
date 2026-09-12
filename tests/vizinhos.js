/* TRIAGEM SEMÂNTICA — ORDENA E ENCURTA, NÃO DECIDE.
 *
 * A proposta que originou isto vinha com uma régua: "similaridade acima
 * de 85% vira vínculo automático". É a única coisa que este aplicativo
 * não pode fazer, e o motivo não é cautela — é que o cosseno responde
 * OUTRA pergunta.
 *
 * Ele mede "estes dois textos falam do mesmo assunto?". A pergunta aqui
 * é "estudar um cobre o outro, para estes dois cargos?". A diferença
 * aparece justamente nos casos difíceis, e nos dois sentidos:
 *
 *   · "Improbidade administrativa" ≡ "Lei nº 8.429/1992" — mesma coisa,
 *     textos distantes. O automático PERDE.
 *   · "Responsabilidade Civil" ≠ "Responsabilidade Civil do Estado" —
 *     coisas diferentes, textos quase colados. O automático APROVA.
 *
 * E há um limite que nenhum modelo melhor resolve: o recorte depende do
 * CARGO, e o cargo não está escrito no nome do tópico.
 *
 * Por isso o teste central deste arquivo é uma negativa — nenhum score,
 * por mais alto que seja, cria vínculo. O resto mede o que ela de fato
 * entrega: caber num prompt.
 *
 * NENHUM TESTE AQUI CHAMA A INTERNET. A busca entra por parâmetro; um
 * teste que depende de chave, conexão e do humor de um servidor não é
 * um teste, é um aviso intermitente que se aprende a ignorar. */
const { rodar } = require("./fumaca.js");

/* vetores de mentira, construídos à mão para ter ângulo conhecido */
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

  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const a = api.edCriar("TCE", [
      "# TCE-PE Auditor | prova: " + daqui(60) + " | horas: 20",
      "@ Direito Financeiro :: 5",
      "+ Restos a pagar :: 5",
      "+ Receita pública :: 4",
      "@ Português :: 2",
      "+ Crase :: 3",
    ].join("\n"));
    const b = api.edCriar("SEFAZ", [
      "# SEFAZ-AL Auditor Fiscal | prova: " + daqui(200) + " | horas: 20",
      "@ Finanças Públicas :: 5",
      "+ Inscrição de despesas não pagas :: 5",
      "+ Ingressos públicos :: 4",
      "@ Português :: 2",
      "+ Crase :: 3",
    ].join("\n"));
    api.hubAbrirEdital(b.id);
    api.$("edProva").value = daqui(200);
    return { a, b };
  };

  /* uma rede de mentira: devolve vetores na ordem em que os textos
   * chegaram, escolhidos por palavra-chave */
  const redeFalsa = (mapa, espiao) => async (url, init) => {
    const corpo = JSON.parse(init.body);
    if (espiao) espiao(url, corpo);
    return {
      ok: true,
      json: async () => ({
        embeddings: corpo.requests.map((r) => {
          const txt = r.content.parts[0].text;
          const achou = Object.keys(mapa).filter((k) => txt.indexOf(k) >= 0)[0];
          return { values: (mapa[achou] || V(0, 0, 1)).slice() };
        }),
      }),
    };
  };

  /* ================================================================
   * Z1: 100% DE PROXIMIDADE NÃO CRIA VÍNCULO
   *
   * O teste que existe para nunca passar por acaso. Dois tópicos com o
   * MESMO vetor — cosseno 1, o caso mais forte possível — e o que sai é
   * uma dupla para perguntar, não um vínculo.
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.vzGuardarChave("chave-de-mentira");

    /* "Restos a pagar" e "Inscrição de despesas" com vetores idênticos */
    const mapa = {
      "Restos a pagar": V(1, 0, 0),
      "Inscrição de despesas": V(1, 0, 0),
      "Receita pública": V(0, 1, 0),
      "Ingressos públicos": V(0, 1, 0),
      "Crase": V(0, 0, 1),
    };

    /* PELO CAMINHO DO BOTÃO, e não por vzDuplas.
     *
     * A primeira versão deste bloco chamava a camada de baixo — e a
     * sabotagem provou o preço: uma linha de vkAplicar plantada dentro
     * de vzTriar criava vínculos automáticos acima de 0,85 e este
     * teste, o mais importante do arquivo, continuava verde. Testar a
     * camada que eu escolhi é testar a minha escolha; o que precisa
     * estar coberto é o que a pessoa aperta. */
    await conduzir(api, api.vzTriar({ chave: "x", buscar: redeFalsa(mapa) }));

    const r = { pares: api.vzDuplasAtuais };
    ok(r.pares.length >= 1
       && r.pares.some((p) => Math.abs(p.score - 1) < 1e-9),
       "Z1-pre o cenario nao produziu o par identico: "
       + JSON.stringify(r.pares.map((p) => p.score)));

    /* NENHUM VÍNCULO NASCEU. */
    ok(api.vkCarregar().length === 0,
       "Z1 a triagem criou vinculo sozinha: " + api.vkCarregar().length);
    /* E NADA FOI MARCADO COMO ESTUDADO. */
    const ch = api.matChave("Finanças Públicas",
                            "Inscrição de despesas não pagas");
    ok(!api.edProgresso[ch],
       "Z1b a triagem marcou o topico como estudado");
    ok((api.diarioAtual() || []).length === 0,
       "Z1c a triagem escreveu no diario");
  }

  /* ---- Z2: o cosseno, e os dois erros que ele comete ---- */
  {
    const { api } = rodar();
    /* iguais */
    ok(Math.abs(api.vzCos([1, 0, 0], [1, 0, 0]) - 1) < 1e-9,
       "Z2 vetores iguais nao deram 1");
    /* perpendiculares */
    ok(Math.abs(api.vzCos([1, 0, 0], [0, 1, 0])) < 1e-9,
       "Z2b vetores perpendiculares nao deram 0");
    /* NUNCA ACIMA DE 1. O arredondamento de ponto flutuante põe
     * 1.0000000002 de vez em quando, e "103% de proximidade" na tela
     * destrói a confiança na medida inteira. */
    const gr = new Array(400).fill(0.05);
    ok(api.vzCos(api.vzNormalizar(gr), api.vzNormalizar(gr)) <= 1,
       "Z2c o cosseno passou de 1 por arredondamento: "
       + api.vzCos(api.vzNormalizar(gr), api.vzNormalizar(gr)));
    /* tamanhos diferentes não podem devolver um número qualquer */
    ok(api.vzCos([1, 0], [1, 0, 0]) === 0,
       "Z2d comparou vetores de tamanhos diferentes");
  }

  /* ================================================================
   * Z3: O TEXTO QUE VIRA VETOR
   * ============================================================== */
  {
    const { api } = rodar();
    /* A DISCIPLINA ENTRA. Metade dos tópicos não significa nada
     * sozinha: "Conceito" aparece em seis matérias, e o vetor de
     * "Conceito" solto não fica perto de nada útil. */
    const t2 = api.vzTextoDoTopico("Direito Administrativo", "Conceito");
    ok(/Direito Administrativo/.test(t2) && /Conceito/.test(t2),
       "Z3 a disciplina nao entrou no texto embutido: " + t2);

    /* O CARGO NÃO ENTRA — e isto não é esquecimento. Ele é o mesmo para
     * todos os tópicos de um edital, então empurraria TODOS os pares na
     * mesma direção: o ruído subiria junto com o sinal e a ordenação,
     * que é a única coisa que se quer aqui, ficaria igual. */
    ok(!/Auditor|TCE|SEFAZ/i.test(t2),
       "Z3b o cargo entrou no texto embutido: " + t2);

    /* tópico sem disciplina não vira "undefined: x" nem " : x" */
    ok(api.vzTextoDoTopico("", "Crase") === "Crase",
       "Z3c topico sem disciplina virou texto sujo: "
       + JSON.stringify(api.vzTextoDoTopico("", "Crase")));
  }

  /* ================================================================
   * Z4: O CORTE E O TETO — o que a triagem existe para fazer
   * ============================================================== */
  {
    const { api } = rodar();
    const comVetor = (d, t2, v) => ({ disciplina: d, topico: t2, vetor: v });
    const a = [comVetor("D", "a1", [1, 0, 0]), comVetor("D", "a2", [0, 1, 0])];
    const b = [comVetor("E", "b1", [1, 0, 0]),
               comVetor("E", "b2", [0, 0, 1])];
    const r = api.vzCruzar(a, b, { corte: 0.6, teto: 10, porOrigem: 3 });
    ok(r.pares.length === 1 && r.pares[0].para.topico === "b1",
       "Z4 o corte deixou passar dupla distante: "
       + JSON.stringify(r.pares.map((p) => p.de.topico + ">" + p.para.topico)));

    /* O LIMITE POR ORIGEM. Um tópico genérico fica razoavelmente perto
     * de trinta outros; sem limite, ele sozinho ocuparia as vagas todas
     * e o resto do edital sumiria atrás de uma palavra vaga. */
    const muitos = [];
    for (let i = 0; i < 12; i++) muitos.push(comVetor("E", "b" + i, [1, 0.01 * i, 0]));
    const r2 = api.vzCruzar([comVetor("D", "generico", [1, 0, 0])], muitos,
                            { corte: 0.5, teto: 50, porOrigem: 3 });
    ok(r2.pares.length === 3,
       "Z4b um unico topico ocupou a lista inteira: " + r2.pares.length);
    /* e ficaram os TRÊS MAIS PRÓXIMOS, não os três primeiros da lista */
    ok(r2.pares[0].score >= r2.pares[2].score,
       "Z4c o limite por origem cortou sem ordenar");

    /* O TETO CONTA O QUE FICOU DE FORA. Cortar em silêncio faria a
     * pessoa concluir que o resto do edital não tem coincidência
     * nenhuma, quando o que houve foi falta de espaço. */
    const r3 = api.vzCruzar([comVetor("D", "x", [1, 0, 0]),
                             comVetor("D", "y", [1, 0, 0])],
                            [comVetor("E", "p", [1, 0, 0]),
                             comVetor("E", "q", [1, 0, 0])],
                            { corte: 0.5, teto: 2, porOrigem: 3 });
    ok(r3.pares.length === 2 && r3.cortados === 2,
       "Z4d o teto cortou em silencio: "
       + JSON.stringify({ n: r3.pares.length, c: r3.cortados }));

    /* AS FAIXAS SÃO DE LEITURA. Elas existem para dizer por onde começar
     * a ler o log — e nenhuma delas é "aceite isto". */
    ok(api.vzFaixa(0.95) === "forte" && api.vzFaixa(0.75) === "provavel"
       && api.vzFaixa(0.62) === "duvida",
       "Z4e as faixas de leitura mudaram de nome ou de corte");
  }

  /* ================================================================
   * Z5: A CHAMADA — lote, dimensão e o que se pede à API
   * ============================================================== */
  {
    const { api } = rodar();
    const chamadas = [];
    const textos = [];
    for (let i = 0; i < 200; i++) textos.push("t" + i);
    await api.vzVetores(textos, {
      chave: "x",
      buscar: redeFalsa({}, (url, corpo) => chamadas.push({ url, corpo })),
    });
    /* EM LOTES. A API não aceita duzentos numa chamada, e mandar tudo
     * de uma vez falharia só com o edital grande — que é o único caso
     * em que isto serve para alguma coisa. */
    ok(chamadas.length === 3,
       "Z5 os 200 textos nao foram divididos em lotes: " + chamadas.length);
    ok(chamadas[0].corpo.requests.length <= 100,
       "Z5b um lote passou do limite da API: "
       + chamadas[0].corpo.requests.length);

    const req = chamadas[0].corpo.requests[0];
    /* SEMANTIC_SIMILARITY e não RETRIEVAL: a pergunta é simétrica
     * ("parecidos entre si?"), não "qual documento responde a esta
     * busca?" — e os dois produzem geometrias diferentes. */
    ok(req.taskType === "SEMANTIC_SIMILARITY",
       "Z5c a tarefa pedida a API nao e a de similaridade: " + req.taskType);
    ok(req.outputDimensionality === 768,
       "Z5d a dimensao pedida mudou: " + req.outputDimensionality);
    /* A CHAVE VAI NA URL do Google, e não pode vazar para o corpo nem
     * para o registro. */
    ok(/key=/.test(chamadas[0].url),
       "Z5e a chave nao foi enviada");
    ok(!/chave|apiKey/i.test(JSON.stringify(chamadas[0].corpo)),
       "Z5f a chave apareceu no corpo da requisicao");
  }

  /* ---- Z6: falhar dizendo POR QUÊ ---- */
  {
    const { api } = rodar();
    const erroCom = async (status) => {
      try {
        await api.vzVetores(["a"], { chave: "x",
          buscar: async () => ({ ok: false, status, text: async () => "x" }) });
      } catch (e) { return e.message; }
      return "nao_lancou";
    };
    /* Chave recusada, cota estourada e rede caída pedem coisas
     * diferentes de quem está na frente da tela. "Falhou" manda tentar
     * de novo nos três casos, e só um deles melhora tentando de novo. */
    ok(await erroCom(403) === "chave_recusada",
       "Z6 chave recusada nao foi distinguida");
    ok(await erroCom(429) === "cota",
       "Z6b cota estourada nao foi distinguida");
    ok(await erroCom(500) === "rede",
       "Z6c falha do servidor virou erro de chave");

    /* sem chave nem tenta a rede */
    let tentou = false;
    try {
      await api.vzVetores(["a"], { chave: "",
        buscar: async () => { tentou = true; return { ok: true }; } });
    } catch (e) {
      ok(e.message === "sem_chave", "Z6d erro errado sem chave: " + e.message);
    }
    ok(!tentou, "Z6e chamou a rede sem chave nenhuma");

    /* RESPOSTA CURTA É ERRO, não meia medida. Vetores faltando
     * desalinham a lista inteira: o vetor do tópico 40 vira o do 39, e
     * o resultado é uma ordenação por nada — sem nenhum sinal na tela. */
    try {
      await api.vzVetores(["a", "b"], { chave: "x",
        buscar: async () => ({ ok: true,
          json: async () => ({ embeddings: [{ values: [1, 0] }] }) }) });
      ok(false, "Z6f resposta incompleta passou como boa");
    } catch (e) {
      ok(e.message === "resposta_incompleta",
         "Z6f erro errado para resposta incompleta: " + e.message);
    }
  }

  /* ================================================================
   * Z7: A CHAVE FICA NO APARELHO — e fora do backup
   * ============================================================== */
  {
    const { api } = rodar();
    api.vzGuardarChave("  AIzaSyABCDEFGH  ");
    ok(api.vzChaveApi() === "AIzaSyABCDEFGH",
       "Z7 a chave nao foi limpa de espacos: "
       + JSON.stringify(api.vzChaveApi()));

    /* O ESPAÇO NA URL, que é onde a apara decide alguma coisa.
     *
     * Colar uma chave do site traz espaço no fim mais vezes do que não
     * traz, e encodeURIComponent o transforma em "%20": uma chave
     * silenciosamente diferente, recusada com a mesma mensagem de uma
     * chave errada de verdade. A sabotagem mostrou que apará-la em dois
     * lugares equivale a não testar nenhum — as duas se cobriam. */
    let urlVista = "";
    await api.vzVetores(["a"], { chave: "  AIza x  ",
      buscar: async (u) => {
        urlVista = u;
        return { ok: true, json: async () => ({ embeddings: [{ values: [1] }] }) };
      } });
    ok(urlVista.indexOf("%20A") < 0 && !/%20\s*$/.test(urlVista),
       "Z7e a chave entrou na URL com espaco: " + urlVista.slice(-30));

    /* MOSTRAR SEM MOSTRAR: o suficiente para saber qual chave está ali,
     * pouco o bastante para uma captura de tela não entregá-la. */
    const res = api.vzChaveResumida();
    ok(res.indexOf("…") >= 0 && res.length < 14 && res !== "AIzaSyABCDEFGH",
       "Z7b o selo mostra a chave inteira: " + res);

    /* FORA DO BACKUP, DE PROPÓSITO. Um arquivo de backup circula por
     * nuvem e por e-mail; uma chave de API dentro dele vira cobrança na
     * fatura de quem a gerou. Perder a chave num backup custa dez
     * segundos; vazá-la custa dinheiro. */
    const grupos = JSON.stringify(api.gruposBackup || {});
    ok(grupos.indexOf("eac_chave_gemini") < 0,
       "Z7c a chave da API entrou no backup");

    /* apagar apaga */
    api.vzGuardarChave("");
    ok(api.vzChaveApi() === "" && api.vzChaveResumida() === "",
       "Z7d apagar a chave nao apagou");
  }

  /* ================================================================
   * Z8: TRIADO, O PROMPT MUDA DE NATUREZA
   *
   * Sem triagem manda-se duas listas e pede-se à IA que ache os pares —
   * 123.656 combinações implícitas numa resposta só. Com triagem chegam
   * duplas prontas e pergunta-se de cada uma "esta serve?".
   * ============================================================== */
  {
    const { api } = rodar();
    const duplas = [
      { de: { disciplina: "Direito Financeiro", topico: "Restos a pagar" },
        para: { disciplina: "Finanças Públicas",
                topico: "Inscrição de despesas não pagas" },
        score: 0.91, faixa: "forte" },
      { de: { disciplina: "Direito Civil", topico: "Responsabilidade Civil" },
        para: { disciplina: "Direito Administrativo",
                topico: "Responsabilidade Civil do Estado" },
        score: 0.94, faixa: "forte" },
    ];
    const p = api.vkPromptDuplas(duplas, "TCE-PE Auditor", "SEFAZ-AL Fiscal");

    ok(/TCE-PE Auditor/.test(p) && /SEFAZ-AL Fiscal/.test(p),
       "Z8 o prompt das duplas nao nomeia os dois cargos");
    ok(/Restos a pagar/.test(p) && /Inscrição de despesas/.test(p),
       "Z8b as duplas nao entraram no prompt");

    /* A SAÍDA "NAO" PRECISA EXISTIR.
     *
     * Quem escolheu os candidatos foi um cálculo que erra por
     * construção — e o exemplo está na própria lista: "Responsabilidade
     * Civil" e "Responsabilidade Civil do Estado" a 94%, assuntos
     * diferentes. Sem a porta de saída, a IA é empurrada a aprovar o
     * lixo que a triagem deixou passar. */
    /* a saída precisa estar DEFINIDA na lista de opções, e não só
     * mencionada de passagem numa frase — a sabotagem mostrou que
     * procurar a palavra solta encontrava o "ou NAO" da regra de ouro
     * mesmo depois de a opção ser removida do menu */
    ok(/NAO\s+—/.test(p),
       "Z8c a opcao NAO nao esta definida entre as respostas possiveis");
    ok(/erra muito|só de palavras|semelhança de PALAVRAS/i.test(p),
       "Z8d o prompt nao avisa que a triagem e por palavras e erra");
    ok(/RECUSE/i.test(p),
       "Z8e o prompt nao diz que se espera recusa de boa parte da lista");
  }

  /* ---- Z9: a recusa da IA é contada, e não vira vínculo ---- */
  {
    const { api } = rodar();
    const est = [{ chave: api.vkChave("D", "a"), disciplina: "D", topico: "a" }];
    const pend = [{ disciplina: "E", nome: "b" }];
    const r = api.vkLerResposta("~ a :: b :: NAO :: só o nome parece",
                                est, pend);
    ok(r.pares.length === 0,
       "Z9 uma dupla recusada pela IA virou vinculo");
    /* CONTADA, não jogada na pilha do que não deu para ler: "a IA
     * recusou 60 das 250" é a medida de quanto a triagem exagerou, e
     * misturá-la com erro de formato apaga essa informação. */
    ok((r.recusados || []).length === 1,
       "Z9b a recusa foi descartada em silencio: "
       + JSON.stringify({ i: r.ignoradas.length, r: (r.recusados || []).length }));
    ok(r.ignoradas.length === 0,
       "Z9c a recusa foi contada como linha ilegivel");
    /* com acento também */
    const r2 = api.vkLerResposta("~ a :: b :: NÃO :: x", est, pend);
    ok(r2.pares.length === 0 && (r2.recusados || []).length === 1,
       "Z9d 'NÃO' com acento nao foi reconhecido");
  }

  /* ================================================================
   * Z10: A TELA, DEPOIS DA TRIAGEM
   * ============================================================== */
  {
    const { api, janela } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");

    /* sem chave, o passo 0 aparece e diz que falta a chave */
    ok(api.$("vzPasso").hidden === false,
       "Z10 o passo da triagem nao aparece no modo dos dois editais");
    ok(/nenhuma chave/i.test(api.$("vzChaveSelo").textContent || ""),
       "Z10b sem chave guardada a tela nao avisa: "
       + api.$("vzChaveSelo").textContent);

    api.vzGuardarChave("x");
    api.vzPintarChave();
    ok(!/nenhuma chave/i.test(api.$("vzChaveSelo").textContent || ""),
       "Z10c com chave guardada a tela continua dizendo que falta");

    /* triado, o recorte por disciplina some: as duplas vieram do edital
     * inteiro, e deixar os seletores sugeriria que ainda mandam em
     * alguma coisa */
    api.vzDuplasPor([
      { de: { disciplina: "Direito Financeiro", topico: "Restos a pagar" },
        para: { disciplina: "Finanças Públicas",
                topico: "Inscrição de despesas não pagas" },
        score: 0.91, faixa: "forte" }]);
    api.vkPintarModo();
    api.vkPintarLados();
    ok(api.$("vkDiscs").hidden === true,
       "Z10d depois de triar, o recorte por disciplina continua na tela");
    ok(/duplas/i.test(api.$("vkResumo").textContent || ""),
       "Z10e o resumo nao passou a falar de duplas: "
       + api.$("vkResumo").textContent);

    /* O PROMPT PASSA A SER O DAS DUPLAS. */
    janela.__area = "";
    await conduzir(api, api.vkGerarPrompt());
    ok(/\bNAO\b/.test(janela.__area || ""),
       "Z10f o prompt copiado ainda e o das duas listas: "
       + String(janela.__area).slice(0, 60));
  }

  /* ---- Z11: o score aparece no log, e some quando não houve triagem ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.vzDuplasPor([
      { de: { disciplina: "Direito Financeiro", topico: "Restos a pagar" },
        para: { disciplina: "Finanças Públicas",
                topico: "Inscrição de despesas não pagas" },
        score: 0.91, faixa: "forte" }]);
    api.vkPintarLados();

    ok(Math.abs(api.vzScoreDe("Direito Financeiro", "Restos a pagar",
                              "Finanças Públicas",
                              "Inscrição de despesas não pagas") - 0.91) < 1e-9,
       "Z11 o score da dupla nao foi encontrado para o log");
    /* NA ORDEM INVERSA É A MESMA DUPLA — o vínculo não tem lado. */
    ok(api.vzScoreDe("Finanças Públicas", "Inscrição de despesas não pagas",
                     "Direito Financeiro", "Restos a pagar") !== null,
       "Z11b o score sumiu com os lados trocados");

    /* NULL, NÃO ZERO. "Não medi" e "medi e deu zero" viram a mesma
     * coisa se forem o mesmo valor — e a tela mostraria "0%" em toda
     * linha de quem nunca usou a triagem. */
    ok(api.vzScoreDe("X", "y", "Z", "w") === null,
       "Z11c dupla nao triada devolveu numero em vez de nada");
    api.vzEsquecer();
    ok(api.vzScoreDe("Direito Financeiro", "Restos a pagar",
                     "Finanças Públicas",
                     "Inscrição de despesas não pagas") === null,
       "Z11d esquecer a triagem nao apagou os scores");
  }

  /* ================================================================
   * Z12: TROCAR DE EDITAL JOGA FORA A TRIAGEM
   *
   * As duplas foram calculadas para UM par de editais. Mantê-las depois
   * de trocar um dos lados montaria um prompt sobre um concurso e uma
   * conferência sobre outro — e as duas telas continuariam com cara de
   * quem sabe o que está fazendo.
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    const c = api.edCriar("ISS", "# ISS Caruaru | prova: " + daqui(300)
      + " | horas: 10\n@ Tributário :: 5\n+ ISS :: 5");
    /* AS LIGAÇÕES DOS BOTÕES são feitas por um script embutido no
     * index.html, que o simulador não executa — então nenhuma delas
     * jamais foi exercida por teste. Aqui a ligação é chamada de
     * propósito, para poder perguntar se o seletor REAGE em vez de
     * chamar a função na mão e testar a minha própria chamada. */
    api.vkIniciarTela();
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.vzDuplasPor([
      { de: { disciplina: "Direito Financeiro", topico: "Restos a pagar" },
        para: { disciplina: "Finanças Públicas",
                topico: "Inscrição de despesas não pagas" },
        score: 0.91, faixa: "forte" }]);
    ok(api.vzDuplasAtuais.length === 1, "Z12-pre a triagem nao ficou posta");

    ok(typeof api.$("vkDeEdital").onchange === "function",
       "Z12-pre2 o seletor de edital nao tem reacao ligada");
    api.$("vkDeEdital").value = String(c.id);
    api.$("vkDeEdital").onchange();
    ok(api.vzDuplasAtuais.length === 0,
       "Z12 trocar de edital manteve as duplas do edital anterior: "
       + api.vzDuplasAtuais.length);
    ok(api.$("vkDiscs").hidden === false,
       "Z12b o recorte por disciplina nao voltou depois de esquecer a triagem");

    /* e voltar de modo também esquece */
    api.vzDuplasPor([{ de: { disciplina: "x", topico: "y" },
                       para: { disciplina: "z", topico: "w" }, score: 1 }]);
    api.vkTrocarModo("estudei");
    ok(api.vzDuplasAtuais.length === 0,
       "Z12c trocar de modo manteve a triagem do outro modo");
  }

  /* ---- Z13: sem chave, o caminho manual continua inteiro ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.vzGuardarChave("");

    /* A TRIAGEM É OPCIONAL. Quem não tem chave — ou não quer pôr uma
     * chave de API no navegador — precisa continuar conseguindo fazer
     * tudo, disciplina a disciplina. Uma comodidade que vira requisito
     * deixou de ser comodidade. */
    ok(api.$("vkDiscs").hidden === false,
       "Z13 sem chave, o recorte por disciplina sumiu da tela");
    api.$("vkDeDisc").value = "Direito Financeiro";
    api.$("vkParaDisc").value = "Finanças Públicas";
    api.vkPintarLados();
    await conduzir(api, api.vkGerarPrompt());
    ok(/SERVE/.test(api.vkPromptAmbos([], [], "a", "b", "c") + ""),
       "Z13b o prompt manual perdeu o vocabulario do modo");

    api.$("vkColarTexto").value =
      "~ Restos a pagar :: Inscrição de despesas não pagas :: SERVE :: igual";
    const r = api.vkConferirColagem();
    ok(r.pares.length === 1,
       "Z13c sem chave a conferencia manual parou de funcionar: "
       + JSON.stringify(r.ignoradas));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
