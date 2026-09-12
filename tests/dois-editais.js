/* DUAS PROVAS AO MESMO TEMPO.
 *
 * A ferramenta de aproveitamento sabia responder uma pergunta só: "o que
 * eu já estudei que cai de novo aqui?". A origem era o DIÁRIO, e por
 * isso ela era cega justamente para a situação de quem estuda para dois
 * concursos simultâneos — nenhum dos dois lados foi estudado ainda, e
 * não há nada no diário para comparar. A coincidência entre as duas
 * provas só apareceria depois, quando já não adianta.
 *
 * O segundo modo troca a lista da esquerda pelos tópicos PENDENTES do
 * outro edital, e nada mais. O vínculo é o mesmo objeto; o que muda é a
 * pergunta e o momento em que ela é feita.
 *
 * TRÊS COISAS PRECISAM SER VERDADE AO MESMO TEMPO:
 *
 *   1. o vínculo continua não marcando nada como estudado — a regra que
 *      organiza esta ferramenta inteira, e que aqui é ainda mais fácil
 *      de violar, porque agora se liga o que nunca foi estudado;
 *   2. a agenda avisa antes, e muda de frase sozinha depois: "também
 *      cai em X" enquanto não há estudo, "já estudei" quando houver
 *      material do outro lado. É o mesmo vínculo, lido em três momentos;
 *   3. a comparação é POR DISCIPLINA. Tudo contra tudo seriam 533 × 232
 *      combinações e uma lista de 765 linhas num prompt só: a IA perde o
 *      fio no meio e a resposta não dá para conferir. Um prompt que não
 *      cabe é um prompt que mente com jeito de resposta.
 *
 * E o erro perigoso deste modo é o INVERSO do outro. Lá, um vínculo
 * errado fazia pular um assunto. Aqui, faz estudar a matéria certa pelo
 * ângulo errado — e o buraco só aparece na prova. Por isso o vocabulário
 * da resposta muda junto: não é "pular ou revisar", é "serve para os
 * dois" ou "recorte diferente". */
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

  /* DOIS EDITAIS ABERTOS, NENHUM ESTUDADO. Disciplinas de nomes
   * diferentes para a mesma matéria — que é o caso real: "Direito
   * Financeiro" no TCE e "Finanças Públicas" na SEFAZ. */
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const a = api.edCriar("TCE", [
      "# TCE-PE Auditor | prova: " + daqui(60) + " | horas: 20",
      "@ Direito Financeiro :: 5",
      "+ Restos a pagar :: 5 :: cai sempre",
      "+ Receita pública :: 4",
      "@ Português :: 2",
      "+ Crase :: 3",
    ].join("\n"));
    const b = api.edCriar("SEFAZ", [
      "# SEFAZ-AL Auditor Fiscal | prova: " + daqui(200) + " | horas: 20",
      "@ Finanças Públicas :: 5",
      "+ Inscrição de despesas não pagas :: 5 :: recorrente",
      "+ Ingressos públicos :: 4",
      "@ Português :: 2",
      "+ Crase :: 3",
    ].join("\n"));
    api.hubAbrirEdital(b.id);
    api.$("edProva").value = daqui(200);
    return { a, b };
  };

  /* ================================================================
   * D1: A ORIGEM MUDA DE LUGAR — e só ela
   * ============================================================== */
  {
    const { api } = rodar();
    const { a } = montar(api);

    /* No modo antigo, um edital sem nenhum registro no diário não tem
     * nada para oferecer: a ferramenta fica muda exatamente onde este
     * modo precisa falar. */
    const est = api.vkEstudadosDe(a.id);
    ok(est.length === 0,
       "D1-pre o diario nao esta vazio, o cenario nao vale: " + est.length);

    const pend = api.vkComoOrigem(api.vkPendentesDe(a.id));
    ok(pend.length === 3,
       "D1 os pendentes do outro edital nao viraram lista de origem: "
       + JSON.stringify(pend.map((x) => x.topico)));

    /* SEM DATA E SEM CONCURSO. É o detalhe que impede a mentira: um
     * tópico nunca estudado não pode chegar à agenda com uma data de
     * estudo, porque a agenda usaria essa data para dizer "há N dias". */
    const um = pend[0];
    ok(um.data === "" && um.concurso === "" && um.acao === "",
       "D1b um pendente virou origem com data ou concurso inventados: "
       + JSON.stringify(um));
    ok(um.chave === api.vkChave(um.disciplina, um.topico),
       "D1c a chave da origem nao bate com a do vinculo: " + um.chave);
  }

  /* ---- D2: uma disciplina por vez ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    const pa = api.vkPendentesDe(a.id);
    const discs = api.vkDisciplinasDe(pa);
    ok(discs.length === 2 && discs[0] === "Direito Financeiro",
       "D2 as disciplinas do edital de origem vieram erradas: "
       + JSON.stringify(discs));

    /* O RECORTE É O QUE TORNA O PROMPT POSSÍVEL. Sem ele o prompt leva
     * o edital inteiro contra o edital inteiro. */
    const so = api.vkSoDaDisciplina(pa, "Direito Financeiro");
    ok(so.length === 2 && !so.some((x) => x.disciplina === "Português"),
       "D2b o recorte por disciplina deixou passar outra materia: "
       + JSON.stringify(so.map((x) => x.disciplina)));

    /* O PAR PROVÁVEL, quando os nomes coincidem. */
    const dB = api.vkDisciplinasDe(api.vkPendentesDe(b.id));
    ok(api.vkParDisciplina("Português", dB) === "Português",
       "D2c o par obvio de disciplinas nao foi encontrado");
    /* E O SILÊNCIO quando não coincidem: "Direito Financeiro" e
     * "Finanças Públicas" são a mesma matéria e não têm palavra em
     * comum. Chutar aqui seria pior que não responder — montaria um
     * prompt comparando duas matérias diferentes, e a IA responderia
     * alguma coisa. */
    ok(api.vkParDisciplina("Direito Financeiro", dB) === "",
       "D2d o app chutou um par de disciplinas sem parentesco: "
       + api.vkParDisciplina("Direito Financeiro", dB));
  }

  /* ================================================================
   * D3: O PROMPT DO SEGUNDO MODO
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    const la = api.vkSoDaDisciplina(api.vkComoOrigem(api.vkPendentesDe(a.id)),
                                    "Direito Financeiro");
    const lb = api.vkSoDaDisciplina(api.vkPendentesDe(b.id),
                                    "Finanças Públicas");
    const p = api.vkPromptAmbos(la, lb, api.vkNomeDoEdital(a.id),
                                api.vkNomeDoEdital(b.id), "Direito Financeiro");

    /* OS DOIS CARGOS. É o que decide se dois nomes iguais são a mesma
     * coisa: auditor de controle externo lê a lei orgânica do tribunal,
     * auditor fiscal lê o regulamento do imposto estadual. */
    ok(/TCE-PE Auditor/.test(p) && /SEFAZ-AL Auditor Fiscal/.test(p),
       "D3 o prompt nao nomeia os dois cargos");
    /* O VOCABULÁRIO É OUTRO. "Pular" não faz sentido aqui: não há nada
     * estudado para pular. */
    ok(/SERVE/.test(p) && /RECORTE/.test(p),
       "D3b o prompt do segundo modo nao pede SERVE/RECORTE");
    ok(!/\bPULAR\b/.test(p),
       "D3c o prompt do segundo modo pede PULAR, que pressupoe estudo feito");
    /* A REGRA DE OURO INVERTIDA. No outro modo, a dúvida manda NÃO
     * relacionar. Aqui, a dúvida manda dizer RECORTE — e essa inversão
     * é a diferença entre os dois riscos. */
    ok(/na dúvida[^.]*RECORTE/i.test(p),
       "D3d a regra de ouro nao aponta para o erro perigoso deste modo");
    /* AS DUAS LISTAS, inteiras. */
    ok(/Restos a pagar/.test(p) && /Inscrição de despesas/.test(p),
       "D3e uma das listas nao entrou no prompt");
    ok(!/Crase/.test(p),
       "D3f o prompt levou outra disciplina junto — o recorte nao valeu");
  }

  /* ---- D4: a resposta em SERVE/RECORTE é lida ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    const la = api.vkComoOrigem(api.vkPendentesDe(a.id));
    const lb = api.vkPendentesDe(b.id);
    const r = api.vkLerResposta([
      "~ Restos a pagar :: Inscrição de despesas não pagas :: SERVE :: mesma matéria",
      "~ Receita pública :: Ingressos públicos :: RECORTE :: ente diferente",
    ].join("\n"), la, lb);

    ok(r.pares.length === 2,
       "D4 a resposta em SERVE/RECORTE nao foi reconhecida: "
       + JSON.stringify(r.ignoradas));
    /* O TOKEN FICA COMO VEIO. Traduzir SERVE em PULAR perderia a
     * diferença: "pular" é veredito sobre estudo feito, "serve para os
     * dois" é previsão sobre estudo que ainda vai acontecer — e a
     * agenda precisa saber qual das duas frases dizer. */
    ok(r.pares[0].sugestao === "SERVE" && r.pares[1].sugestao === "RECORTE",
       "D4b o vocabulario do segundo modo foi traduzido no do primeiro: "
       + JSON.stringify(r.pares.map((x) => x.sugestao)));
    ok(r.pares[0].conf === "ALTA" && r.pares[1].conf === "MEDIA",
       "D4c a forca do par nao acompanhou a sugestao: "
       + JSON.stringify(r.pares.map((x) => x.conf)));

    /* E O FORMATO ANTIGO CONTINUA VALENDO: quem tiver um prompt salvo,
     * ou uma IA que respondeu PULAR, não fica sem resposta. */
    const velho = api.vkLerResposta(
      "~ Restos a pagar :: Inscrição de despesas não pagas :: PULAR :: x",
      la, lb);
    ok(velho.pares.length === 1 && velho.pares[0].sugestao === "PULAR",
       "D4d o formato antigo deixou de ser lido");
  }

  /* ================================================================
   * D5: VINCULAR ANTES DE ESTUDAR TAMBÉM NÃO MARCA NADA
   *
   * A regra da ferramenta inteira, no caso em que é mais fácil violá-la:
   * aqui se liga o que NUNCA foi estudado, e um tópico dado como feito
   * some da agenda.
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAplicar([{
      de: { chave: api.vkChave("Direito Financeiro", "Restos a pagar"),
            disciplina: "Direito Financeiro", topico: "Restos a pagar" },
      para: { chave: api.vkChave("Finanças Públicas",
                                 "Inscrição de despesas não pagas"),
              disciplina: "Finanças Públicas",
              topico: "Inscrição de despesas não pagas" },
      conf: "ALTA", sugestao: "SERVE", por: "mesma matéria" }], b.id, "ambos");

    const ch = api.matChave("Finanças Públicas",
                            "Inscrição de despesas não pagas");
    ok(!api.edProgresso[ch],
       "D5 vincular no modo dos dois editais marcou o topico como estudado: "
       + JSON.stringify(api.edProgresso[ch]));

    const r = api.lerEdital(api.$("editalTexto").value);
    const p = api.montarPlano(r, { horas: 20, prova: daqui(200),
      feitos: api.edProgresso, fatores: {}, acertos: {} });
    ok(p.fila.some((i) => /Inscrição de despesas/.test(i.nome)),
       "D5b o topico vinculado sumiu da fila de estudo");

    /* O OUTRO LADO TAMBÉM CONTINUA PENDENTE. O vínculo é simétrico, e
     * seria simétrico também no estrago. */
    const chA = api.matChave("Direito Financeiro", "Restos a pagar");
    ok(!api.edProgresso[chA],
       "D5c o lado de origem foi marcado como estudado");

    /* DE QUAL PERGUNTA O VÍNCULO NASCEU fica guardado: sem isso a tela
     * teria de adivinhar qual frase dizer na agenda. */
    ok(api.vkCarregar()[0].modo === "ambos",
       "D5d o vinculo nao guardou de qual modo veio: "
       + JSON.stringify(api.vkCarregar()[0].modo));
  }

  /* ================================================================
   * D6: TRÊS MOMENTOS, TRÊS FRASES
   *
   * O mesmo vínculo atravessa três estados, e a agenda diz coisas
   * diferentes em cada um. Antes havia uma resposta só ("tem material?"),
   * e por isso um vínculo criado ANTES de qualquer estudo não aparecia
   * em lugar nenhum — justo no momento em que ele mais vale.
   * ============================================================== */
  {
    const { api } = rodar();
    const { b } = montar(api);
    const D = "Direito Financeiro", T = "Restos a pagar";
    const D2 = "Finanças Públicas", T2 = "Inscrição de despesas não pagas";

    /* momento zero: nem vínculo */
    const nada = api.vkAcervoDoTopico(D2, T2);
    ok(nada.temVinculo === false && nada.temAlgo === false
       && nada.temEstudo === false,
       "D6 um topico sem vinculo nenhum se diz vinculado: "
       + JSON.stringify(nada));

    api.vkAplicar([{
      de: { chave: api.vkChave(D, T), disciplina: D, topico: T },
      para: { chave: api.vkChave(D2, T2), disciplina: D2, topico: T2 },
      conf: "ALTA", sugestao: "SERVE" }], b.id, "ambos");

    /* MOMENTO 1 — só a coincidência. Nada estudado, nada escrito. */
    const so = api.vkAcervoDoTopico(D2, T2);
    ok(so.temVinculo === true,
       "D6b o vinculo criado antes do estudo nao aparece no acervo");
    ok(so.temEstudo === false && so.temAlgo === false,
       "D6c o acervo inventou estudo ou material onde nao ha nenhum: "
       + JSON.stringify({ e: so.temEstudo, a: so.temAlgo }));
    /* DE QUAL EDITAL É O TÓPICO DO OUTRO LADO — e isto NÃO é "estudado".
     *
     * Os dois moravam no mesmo campo, e o resultado foi o aplicativo
     * afirmando estudo que nunca houve: um tópico que apenas CONSTA de
     * outro edital aparecia na gaveta como "Estudado para X", com dois
     * editais marcando 0% estudado. Agora são dois campos, e este
     * bloco cobra os dois ao mesmo tempo. */
    ok(so.itens[0].ondeConsta === "TCE-PE Auditor",
       "D6d o acervo nao sabe de qual edital e o topico ligado: "
       + so.itens[0].ondeConsta);
    ok(so.itens[0].estudado === false && so.itens[0].concurso === "",
       "D6d2 um topico sem uma linha no diario se diz estudado: "
       + JSON.stringify({ e: so.itens[0].estudado, c: so.itens[0].concurso }));

    /* MOMENTO 2 — o diário registra o outro lado. A frase muda sozinha:
     * ninguém tocou no vínculo. */
    api.diarioPor([{ d: daqui(-2), c: api.matChave(D, T), n: T, disc: D,
                     a: "feito", m: 50, cc: "TCE-PE Auditor" }]);
    const dep = api.vkAcervoDoTopico(D2, T2);
    ok(dep.temEstudo === true,
       "D6e estudar um lado nao mudou o estado do vinculo do outro");
    ok(dep.temAlgo === false,
       "D6f o acervo diz ter material sem resumo, cartao, lei nem questao");
    ok(dep.itens[0].data === daqui(-2),
       "D6g a data do estudo nao chegou ao outro lado: " + dep.itens[0].data);

    /* MOMENTO 3 — o resumo escrito de um lado aparece do outro. É o
     * "ir gerando material" enquanto se estuda os dois: o texto fica
     * onde foi escrito, e o outro edital consulta. */
    api.matGravar(api.matChave(D, T), "o resumo que escrevi para o TCE-PE",
      { disciplina: D, topico: T, concurso: "TCE-PE Auditor" });
    const fim = api.vkAcervoDoTopico(D2, T2);
    ok(fim.temAlgo === true,
       "D6h o resumo escrito de um lado nao chegou ao outro");
    ok(fim.itens[0].resumoChars > 10,
       "D6i o resumo chegou vazio: " + fim.itens[0].resumoChars);

    /* E O MATERIAL DESTE EDITAL CONTINUA VAZIO E LIVRE. Ter material do
     * outro concurso é consulta, não substituição. */
    ok(!api.matResumosAtual()[api.matChave(D2, T2)],
       "D6j o vinculo criou material no topico deste edital");
  }

  /* ---- D7: o selo na agenda diz a frase do momento certo ---- */
  {
    const { api } = rodar();
    const { b } = montar(api);
    const D = "Direito Financeiro", T = "Restos a pagar";
    const D2 = "Finanças Públicas", T2 = "Inscrição de despesas não pagas";
    api.vkAplicar([{
      de: { chave: api.vkChave(D, T), disciplina: D, topico: T },
      para: { chave: api.vkChave(D2, T2), disciplina: D2, topico: T2 },
      conf: "ALTA", sugestao: "SERVE" }], b.id, "ambos");
    api.edRender(); api.hubRender();

    const achar = (el, out) => {
      Array.from(el.children || []).forEach((f) => {
        if (/(^| )ed-item-jaestudei( |$)/.test(f.className || "")) out.push(f);
        achar(f, out);
      });
      return out;
    };
    const selos = achar(api.$("edAgendaTopo"), [])
      .concat(achar(api.$("edTabela"), []));
    ok(selos.length > 0,
       "D7 o vinculo sem material nao pos selo nenhum na tela — era "
       + "exatamente o buraco: avisar DEPOIS de estudar nao serve");
    ok(selos.every((s) => /so-coincide/.test(s.className || "")),
       "D7b algum selo de coincidencia veio com a cara do selo de "
       + "material: " + JSON.stringify(selos.map((s) => s.className)));

    /* O SELO NOMEIA O OUTRO CONCURSO, E O VÍNCULO É SIMÉTRICO.
     *
     * "Também cai em outro lugar" não ajuda a decidir nada; "também cai
     * no TCE-PE" ajuda. E a agenda atravessa editais de propósito: as
     * duas provas estão sendo estudadas ao mesmo tempo, então as duas
     * linhas precisam do aviso — cada uma apontando para a OUTRA. Um
     * selo que aponta para o próprio concurso seria o app avisando que
     * o assunto cai onde a pessoa já está olhando. */
    const textos = selos.map((s) => s.textContent || "");
    ok(textos.some((x) => /TCE-PE/.test(x)),
       "D7c nenhum selo avisa que o assunto tambem cai no TCE-PE: "
       + JSON.stringify(textos));
    ok(textos.some((x) => /SEFAZ-AL/.test(x)),
       "D7d o aviso so apareceu de um lado — o vinculo e simetrico: "
       + JSON.stringify(textos));
  }

  /* ================================================================
   * D8: A TELA TROCA DE MODO INTEIRA
   *
   * Rótulo, explicação e passos falando do outro modo seria a tela
   * dizendo uma coisa e fazendo outra — o defeito mais caro desta
   * ferramenta, porque ela existe para produzir uma decisão.
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    ok(api.vkModoAtual() === "estudei",
       "D8-pre a ferramenta nao abre no modo de sempre");
    ok(api.$("vkDiscs").hidden === true,
       "D8 a faixa de disciplinas aparece no modo em que nao se usa");

    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");

    ok(api.vkModoAtual() === "ambos", "D8b o modo nao trocou");
    ok(api.$("vkDiscs").hidden === false,
       "D8c a faixa de disciplinas nao apareceu no modo dos dois editais");
    ok(/vk-modo-on/.test(api.$("btnVkModoAmbos").className || ""),
       "D8d o botao do modo escolhido nao ficou marcado");
    ok(!/vk-modo-on/.test(api.$("btnVkModoEstudei").className || ""),
       "D8e os dois modos aparecem escolhidos ao mesmo tempo");

    /* A EXPLICAÇÃO E OS RÓTULOS ACOMPANHAM. */
    ok(/pendentes/i.test(api.$("vkExplica").textContent || ""),
       "D8f a explicacao continua falando do modo antigo: "
       + (api.$("vkExplica").textContent || "").slice(0, 60));
    ok(!/JÁ ESTUDEI EM/i.test(api.$("vkRotDe").textContent || ""),
       "D8g o rotulo do lado esquerdo ainda diz 'ja estudei em'");

    /* O ATALHO DOS NOMES IDÊNTICOS É DO OUTRO MODO: ali ele compara o
     * que foi estudado, e aqui não há nada estudado para comparar. */
    ok(api.$("vkAtalho").hidden === true,
       "D8h o atalho dos identicos sobrou no modo dos dois editais");

    /* E VOLTAR TAMBÉM DESFAZ TUDO. */
    api.vkTrocarModo("estudei");
    ok(api.$("vkDiscs").hidden === true,
       "D8i voltar ao modo antigo deixou a faixa de disciplinas na tela");
  }

  /* ---- D9: as disciplinas dos dois lados, com o par sugerido ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");

    const sel = api.$("vkDeDisc");
    ok(sel.value === "Direito Financeiro",
       "D9 a primeira disciplina do lado esquerdo veio errada: " + sel.value);

    /* TROCAR A ESQUERDA RE-SUGERE A DIREITA. Deixar a direita parada
     * montaria um prompt comparando duas matérias sem relação — e a IA
     * responderia alguma coisa. */
    api.$("vkDeDisc").value = "Português";
    api.vkPintarDiscs();
    ok(api.$("vkParaDisc").value === "Português",
       "D9b trocar a disciplina da esquerda nao acompanhou a direita: "
       + api.$("vkParaDisc").value);

    /* O RESUMO CONTA OS DOIS LADOS DA DISCIPLINA ESCOLHIDA, não do
     * edital inteiro: é o tamanho do que vai no prompt. */
    api.vkPintarLados();
    const txt = api.$("vkResumo").textContent || "";
    ok(/\b1\b/.test(txt) && /Portugu/.test(txt),
       "D9c o resumo nao conta a disciplina escolhida: " + txt);
  }

  /* ================================================================
   * D10: O PROMPT COPIA DE VERDADE E DIZ O QUE COPIOU
   *
   * Era um toast de dois segundos. Ficava a dúvida de sempre: copiou?
   * copiou o quê? — e a resposta só aparecia na hora de colar, longe
   * dali.
   * ============================================================== */
  {
    const { api, janela } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.$("vkDeDisc").value = "Direito Financeiro";
    api.$("vkParaDisc").value = "Finanças Públicas";
    api.vkPintarLados();

    janela.__area = "";
    await conduzir(api, api.vkGerarPrompt());
    ok(/SERVE/.test(janela.__area || ""),
       "D10 o prompt do segundo modo nao foi para a area de transferencia: "
       + String(janela.__area).slice(0, 40));
    ok(/Restos a pagar/.test(janela.__area)
       && /Inscrição de despesas/.test(janela.__area),
       "D10b o prompt copiado nao leva as duas listas");
    ok(!/Crase/.test(janela.__area),
       "D10c o prompt copiado furou o recorte por disciplina");
  }

  /* ---- D11: a conferência usa a lista que foi ao prompt ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.$("vkDeDisc").value = "Direito Financeiro";
    api.$("vkParaDisc").value = "Finanças Públicas";
    api.vkPintarLados();
    await conduzir(api, api.vkGerarPrompt());

    /* TROCAR A DISCIPLINA DEPOIS DE COPIAR não pode invalidar a
     * resposta.
     *
     * É o gesto normal de quem trabalha disciplina a disciplina: copia o
     * prompt de Direito Financeiro, vai colar numa IA, volta — e no
     * caminho o seletor já está na próxima matéria. A resposta foi
     * escrita contra a lista antiga; recalcular sozinho faria a colagem
     * descartar tudo dizendo "não achei nenhum destes".
     *
     * O repintar é obrigatório aqui: sem ele as listas ficam paradas e a
     * asserção não mede nada — é exatamente o que a sabotagem revelou na
     * primeira versão deste bloco. */
    api.$("vkDeDisc").value = "Português";
    api.$("vkParaDisc").value = "Português";
    api.vkPintarLados();
    ok(api.vkPendentesDe(b.id).length > 0,
       "D11-pre o cenario perdeu os pendentes, o teste nao vale");

    api.$("vkColarTexto").value =
      "~ Restos a pagar :: Inscrição de despesas não pagas :: SERVE :: igual";
    const r = api.vkConferirColagem();
    ok(r.pares.length === 1,
       "D11 trocar a disciplina depois do prompt fez a resposta ser "
       + "descartada: " + JSON.stringify(r.ignoradas));

    /* O LOG MOSTRA A PALAVRA DO MODO CERTO. */
    const par = api.vkParesAtual[0];
    ok(par && par.sugestao === "SERVE",
       "D11b o log traduziu SERVE em outra coisa: "
       + JSON.stringify(par && par.sugestao));
  }

  /* ---- D12: aplicar cria o vínculo e nada além dele ---- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.$("vkDeDisc").value = "Direito Financeiro";
    api.$("vkParaDisc").value = "Finanças Públicas";
    api.vkPintarLados();
    await conduzir(api, api.vkGerarPrompt());
    api.$("vkColarTexto").value =
      "~ Restos a pagar :: Inscrição de despesas não pagas :: SERVE :: igual";
    api.vkConferirColagem();
    await conduzir(api, api.vkAplicarColagem());

    ok(api.vkCarregar().length === 1,
       "D12 o vinculo nao foi criado: " + api.vkCarregar().length);
    /* sem o "|| {}" uma falha em D12 derruba o arquivo inteiro com
     * TypeError, e as falhas já coletadas se perdem no caminho — foi o
     * que aconteceu ao sabotar a conferência */
    ok((api.vkCarregar()[0] || {}).modo === "ambos",
       "D12b o vinculo aplicado pela tela nao guardou o modo");
    const ch = api.matChave("Finanças Públicas",
                            "Inscrição de despesas não pagas");
    ok(!api.edProgresso[ch],
       "D12c aplicar pela tela marcou o topico como estudado");
    ok((api.diarioAtual() || []).length === 0,
       "D12d aplicar escreveu no diario: "
       + JSON.stringify(api.diarioAtual()));
  }

  /* ================================================================
   * D13: RECUSAR A SEGUNDA CONFIRMAÇÃO NÃO CRIA NADA
   *
   * A confirmação existe para poder ser negada. Um teste que só olha se
   * a promessa terminou não mede nada — mede que a função rodou.
   * ============================================================== */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.vkAbrir();
    api.$("vkDeEdital").value = String(a.id);
    api.$("vkParaEdital").value = String(b.id);
    api.vkTrocarModo("ambos");
    api.$("vkDeDisc").value = "Direito Financeiro";
    api.$("vkParaDisc").value = "Finanças Públicas";
    api.vkPintarLados();
    await conduzir(api, api.vkGerarPrompt());
    api.$("vkColarTexto").value =
      "~ Restos a pagar :: Inscrição de despesas não pagas :: SERVE :: igual";
    api.vkConferirColagem();

    /* NÃO */
    let pronto = false;
    const pr = api.vkAplicarColagem();
    pr.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(false); } catch (e) {}
    }
    await pr;
    ok(api.vkCarregar().length === 0,
       "D13 recusar a confirmacao criou vinculo assim mesmo: "
       + api.vkCarregar().length);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
