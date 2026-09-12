/* COLAR UM PLANO REVISADO — "107 tópicos somem" não é uma informação.
 *
 * A conferência comparava nomes exatos, e por isso as duas coisas mais
 * DIFERENTES que uma revisão pode fazer apareciam idênticas:
 *
 *   · "Cassação, anulação, revogação e convalidação" virar quatro linhas
 *     — o nome antigo some, e nada se perdeu; ao contrário, agora dá
 *     para pesar cada uma;
 *   · "Improbidade administrativa" simplesmente não estar mais lá.
 *
 * As duas contavam como "some", e a tela mostrava só o total. Diante de
 * "107 somem" não há decisão possível: aceitar arrisca perder conteúdo,
 * recusar joga fora a revisão inteira. Um número sem a lista transforma
 * uma conferência num impasse — e o botão fica ali, esperando um palpite.
 *
 * Agora cada sumiço procura um herdeiro na mesma disciplina, a tela
 * separa os dois grupos, e há um conserto mecânico para o que não tem
 * herdeiro nenhum. */
const { rodar } = require("./fumaca.js");

const ANTES = [
  "# X | prova: 2027-06-01 | horas: 20",
  "@ Direito Administrativo :: 5",
  "+ Cassação, anulação, revogação e convalidação :: 4 :: caem sempre",
  "+ Conceito :: 2",
  "+ Improbidade administrativa :: 5 :: lei muito cobrada",
  "+ Poder de polícia :: 5 :: cai em quase toda prova",
  "@ Português :: 2",
  "+ Crase :: 4 :: pega muita gente",
].join("\n");

/* a revisão: divide a linha composta, desambigua o nome genérico,
 * mantém o poder de polícia — e ESQUECE a improbidade */
const DEPOIS = [
  "# X | prova: 2027-06-01 | horas: 20",
  "@ Direito Administrativo :: 5",
  "+ Cassação :: 3",
  "+ Anulação :: 4 :: efeitos retroativos",
  "+ Revogação :: 4",
  "+ Convalidação :: 4",
  "+ Conceito de ato administrativo :: 2",
  "+ Poder de polícia :: 5 :: cai em quase toda prova",
  "@ Português :: 2",
  "+ Crase :: 4 :: pega muita gente",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  /* SEGUNDA CONFIRMAÇÃO. Todos os botões desta caixa perguntam antes de
   * agir; sem alguém respondendo, a promessa nunca se resolve e o teste
   * fica pendurado em silêncio — que foi o que aconteceu na primeira
   * versão deste bloco. */
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };

  /* ================================================================
   * C1: DIVIDIR NÃO É PERDER
   * ============================================================== */
  {
    const { api } = rodar();
    const c = api.edCompararColagem(ANTES, DEPOIS, {});
    ok(c.somem.length === 3,
       "C1-pre o cenario mudou: " + JSON.stringify(c.somem.map((x) => x.t)));

    const nomes = (l) => (l || []).map((x) => x.t).sort();
    /* A LINHA COMPOSTA e o nome genérico têm para onde ter ido. */
    ok(JSON.stringify(nomes(c.herdados))
       === JSON.stringify(["Cassação, anulação, revogação e convalidação",
                           "Conceito"]),
       "C1 a divisao e a desambiguacao nao foram reconhecidas como heranca: "
       + JSON.stringify(nomes(c.herdados)));
    /* E A IMPROBIDADE NÃO TEM. É o único item sobre o qual há decisão. */
    ok(nomes(c.semHerdeiro).join() === "Improbidade administrativa",
       "C1b o topico realmente perdido nao foi isolado: "
       + JSON.stringify(nomes(c.semHerdeiro)));

    const cass = c.herdados.filter((x) => /Cassação,/.test(x.t))[0];
    ok(cass && cass.herdeiros.length >= 3,
       "C1c a linha composta nao apontou as partes dela: "
       + JSON.stringify(cass && cass.herdeiros.map((h) => h.nome)));
    const conc = c.herdados.filter((x) => x.t === "Conceito")[0];
    ok(conc && conc.herdeiros[0].nome === "Conceito de ato administrativo",
       "C1d o nome desambiguado nao foi ligado ao generico: "
       + JSON.stringify(conc && conc.herdeiros));
  }

  /* ---- C2: o herdeiro só vale dentro da MESMA disciplina ---- */
  {
    const { api } = rodar();
    /* "Crase" sai de Português e aparece em Direito Administrativo:
     * é uma linha perdida na disciplina certa, não uma herança. Aceitar
     * herdeiro de outra disciplina faria o app garantir que nada se
     * perdeu quando o tópico mudou de dono. */
    const d2 = DEPOIS.replace("+ Poder de polícia :: 5 :: cai em quase toda prova",
      "+ Poder de polícia :: 5 :: cai em quase toda prova\n+ Crase :: 4")
      .replace("@ Português :: 2\n+ Crase :: 4 :: pega muita gente",
        "@ Português :: 2\n+ Concordância :: 3");
    const c = api.edCompararColagem(ANTES, d2, {});
    const perdidos = c.semHerdeiro.map((x) => x.d + "›" + x.t);
    ok(perdidos.indexOf("Português›Crase") >= 0,
       "C2 achou herdeiro para Crase em OUTRA disciplina: "
       + JSON.stringify(perdidos));
  }

  /* ---- C3: o herdeiro só pode ser um tópico que SURGIU ---- */
  {
    const { api } = rodar();
    /* "Poder de polícia" existe nos dois planos e não é herdeiro de
     * ninguém. Procurar entre TODOS os tópicos novos acharia parentesco
     * em linhas que já estavam lá e não têm relação nenhuma. */
    const antes2 = ANTES.replace("+ Improbidade administrativa :: 5 :: lei muito cobrada",
      "+ Poder de polícia e poder disciplinar :: 5");
    const c = api.edCompararColagem(antes2, DEPOIS, {});
    const pp = c.somemDetalhe.filter((x) => /poder de pol/i.test(x.t))[0];
    ok(pp && pp.herdeiros.length === 0,
       "C3 um topico que ja existia antes virou 'herdeiro': "
       + JSON.stringify(pp && pp.herdeiros));
  }

  /* ================================================================
   * C4: O CONSERTO MECÂNICO devolve o que não tem herdeiro
   * ============================================================== */
  {
    const { api } = rodar();
    const c = api.edCompararColagem(ANTES, DEPOIS, {});
    const r = api.edRecolocarPerdidos(DEPOIS, c.semHerdeiro, ANTES);
    ok(r.postos === 1, "C4 nao devolveu o topico perdido: " + r.postos);

    const volta = api.lerEdital(r.texto);
    const da = volta.disciplinas.filter((d) => /Administrativo/.test(d.nome))[0];
    const imp = da.topicos.filter((tp) => /Improbidade/.test(tp.nome))[0];
    ok(!!imp, "C4b a improbidade nao voltou");
    /* VOLTA INTEIRA: peso e motivo originais. Recolocar só o nome
     * perderia o julgamento que estava na linha — e o motivo é
     * justamente o que permite conferir o peso depois. */
    ok(imp && imp.peso === 5,
       "C4c voltou sem o peso original: " + JSON.stringify(imp && imp.peso));
    ok(imp && /muito cobrada/.test(imp.motivo || ""),
       "C4d voltou sem o motivo original: " + JSON.stringify(imp && imp.motivo));

    /* E NA DISCIPLINA CERTA — provado com um perdido que NÃO está na
     * primeira disciplina.
     *
     * A primeira versão desta asserção usava só a improbidade, que é de
     * Direito Administrativo, a disciplina de cima. Aí o teste sobrevivia
     * a qualquer ordem de despejo: os itens da primeira disciplina caem
     * dentro dela por sorte, seja qual for o momento em que o código os
     * solta. O erro real é atualizar a disciplina atual ANTES de
     * despejar, o que joga os tópicos ACIMA do próprio cabeçalho — e
     * isso só aparece a partir da segunda disciplina. */
    const pt = volta.disciplinas.filter((d) => /Portugu/.test(d.nome))[0];
    ok(!pt.topicos.some((tp) => /Improbidade/.test(tp.nome)),
       "C4e o topico foi devolvido na disciplina errada");

    const semCrase = DEPOIS.replace("+ Crase :: 4 :: pega muita gente",
      "+ Concordância :: 3");
    const c9 = api.edCompararColagem(ANTES, semCrase, {});
    const r9 = api.edRecolocarPerdidos(semCrase, c9.semHerdeiro, ANTES);
    const v9 = api.lerEdital(r9.texto);
    const pt9 = v9.disciplinas.filter((d) => /Portugu/.test(d.nome))[0];
    const da9 = v9.disciplinas.filter((d) => /Administrativo/.test(d.nome))[0];
    ok(pt9 && pt9.topicos.some((tp) => tp.nome === "Crase"),
       "C4e2 o topico da SEGUNDA disciplina nao voltou para ela: "
       + JSON.stringify(pt9 && pt9.topicos.map((tp) => tp.nome)));
    ok(!da9.topicos.some((tp) => tp.nome === "Crase"),
       "C4e3 o topico caiu na disciplina de cima — despejo antes do "
       + "cabecalho proprio");

    /* e o que já estava certo não se mexeu */
    ok(da.topicos.some((tp) => tp.nome === "Cassação")
       && da.topicos.some((tp) => tp.nome === "Convalidação"),
       "C4f o conserto desfez a divisao que estava correta");

    /* depois de recolocar, não sobra nada sem herdeiro */
    const c2 = api.edCompararColagem(ANTES, r.texto, {});
    ok(c2.semHerdeiro.length === 0,
       "C4g depois do conserto ainda ha topico sem correspondencia: "
       + JSON.stringify(c2.semHerdeiro.map((x) => x.t)));
  }

  /* ---- C5: disciplina que não existe mais não é inventada ---- */
  {
    const { api } = rodar();
    /* Português inteiro sai do plano novo. O tópico não tem onde voltar,
     * e criar a disciplina seria decidir por quem cola — o app avisa e
     * devolve a lista em vez de fingir que resolveu. */
    const semPt = DEPOIS.split("@ Português")[0];
    const c = api.edCompararColagem(ANTES, semPt, {});
    const r = api.edRecolocarPerdidos(semPt, c.semHerdeiro, ANTES);
    ok(r.semDisciplina.length === 1 && r.semDisciplina[0].t === "Crase",
       "C5 nao avisou que a disciplina do topico sumiu: "
       + JSON.stringify(r.semDisciplina));
    ok(!/Português/.test(r.texto),
       "C5b o conserto criou uma disciplina que o plano novo nao tem");
  }

  /* ---- C6: o que estava marcado como estudado aparece marcado ---- */
  {
    const { api } = rodar();
    const prog = { "direito administrativo›improbidade administrativa":
                   { e: "feito", d: "2026-08-01" } };
    const c = api.edCompararColagem(ANTES, DEPOIS, prog);
    const imp = c.semHerdeiro.filter((x) => /Improbidade/.test(x.t))[0];
    /* SOME A LINHA E SOME JUNTO A PROVA de que você passou por ela: é o
     * item da lista que não se desfaz colando de novo. */
    ok(imp && imp.marcado === true,
       "C6 a lista nao diz que o topico perdido estava estudado");
    ok(c.orfaos.length === 1,
       "C6b o progresso orfao nao foi contado: " + c.orfaos.length);
  }

  /* ---- C7: a tela mostra a lista, não só o número ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("X", ANTES);
    api.hubAbrirEdital(ed.id);
    api.$("edColarTexto").value = DEPOIS;
    api.edConferirColagem();

    const cx = api.$("edColarListaCx");
    ok(cx && cx.hidden === false, "C7 a lista continua escondida");
    const txt = (api.$("edColarLista") || {}).textContent || "";
    ok(/Improbidade/.test(txt),
       "C7b o topico perdido nao esta na lista: " + txt.slice(0, 80));
    ok(/Cassação/.test(txt),
       "C7c os divididos nao aparecem na lista");
    /* e o botão de conserto só existe quando há o que consertar */
    const b = api.$("btnEdColarRecolocar");
    ok(b && b.hidden === false, "C7d o botao de trazer de volta nao apareceu");
    ok(/1/.test(b.textContent || ""),
       "C7e o botao nao diz quantos vai trazer: " + b.textContent);

    /* sem perda nenhuma, nada disso aparece */
    api.$("edColarTexto").value = ANTES;
    api.edConferirColagem();
    ok(api.$("btnEdColarRecolocar").hidden === true,
       "C7f o botao de conserto aparece num plano identico");

    /* A EXPLICAÇÃO NÃO PODE FICAR ÓRFÃ. Esconder só o botão deixava a
     * frase que o descreve sozinha na tela, explicando uma ação que não
     * existe naquele momento. */
    ok(api.$("edColarAcaoRecolocar").hidden === true,
       "C7g o botao sumiu e a explicacao dele ficou na tela");
    ok(api.$("edColarAcaoPrompt").hidden === true,
       "C7h o mesmo com a explicacao do prompt");
  }

  /* ================================================================
   * C8: O CASADOR RECONHECE A DIVISÃO DE UMA LISTA
   *
   * A primeira versão media a semelhança contra o NOME ANTIGO: quantas
   * palavras dele reaparecem no novo. Isso identifica renomeação e é
   * cego para divisão — um pedaço de uma lista de sete itens cobre um
   * sétimo do nome antigo e cai fora de qualquer limiar.
   *
   * Estes quatro vieram do plano real da SEFAZ-AL, e os quatro eram
   * acusados de "sem correspondência" com as partes deles a três linhas
   * de distância na mesma disciplina.
   * ============================================================== */
  {
    const { api } = rodar();
    const casos = [
      /* plural na cabeça da frase: "Taxas" contra "Taxa" */
      ["Taxas de juros nominal, efetiva, equivalente, real e aparente",
       ["Taxa de juros nominal", "Taxa de juros efetiva", "Taxas equivalentes"]],
      /* a lista virou itens com um prefixo novo */
      ["Conceito, requisitos, atributos, classificação e espécies",
       ["Ato administrativo: conceito e requisitos",
        "Ato administrativo: atributos"]],
      /* adjetivos soltos que ganharam o substantivo */
      ["Hierárquico, disciplinar, regulamentar e de polícia",
       ["Poder hierárquico", "Poder disciplinar", "Poder de polícia"]],
      /* item da lista virou frase inteira, com só uma palavra em comum */
      ["Concessão, permissão e autorização",
       ["Concessão de serviço público", "Autorização de serviço público"]],
    ];
    casos.forEach(([velho, novos]) => {
      const h = api.edHerdeirosDe(velho, novos);
      ok(h.length > 0,
         "C8 nao reconheceu a divisao de \"" + velho.slice(0, 44)
         + "...\" nas partes " + JSON.stringify(novos.slice(0, 2)));
    });

    /* E NÃO PODE VIRAR UM CASADOR QUE ACHA TUDO. Se qualquer coisa
     * casasse, a lista de "sem correspondência" ficaria sempre vazia e
     * o painel voltaria a esconder a perda — pelo lado oposto. */
    ok(api.edHerdeirosDe("Improbidade administrativa",
        ["Poder de polícia", "Autarquias", "Crase"]).length === 0,
       "C8b o casador aceita qualquer coisa como herdeiro");
    ok(api.edHerdeirosDe("Súmula vinculante",
        ["Reclamação constitucional", "Ordem econômica e financeira"]).length === 0,
       "C8c dois temas diferentes viraram parentes");
  }

  /* ---- C8b: herdeiro fraco ao lado de forte é ruído ---- */
  {
    const { api } = rodar();
    /* "Finanças públicas" trazia três: a linha certa e mais duas que só
     * compartilham a palavra "públicas". Numa lista de cem, cada linha
     * dessas faz duvidar do acerto ao lado. */
    const h = api.edHerdeirosDe("Finanças públicas",
      ["Finanças públicas na Constituição", "Advocacia pública",
       "Defensoria Pública"]);
    ok(h.length === 1 && /Constituição/.test(h[0].nome),
       "C8d o ruido de palavra comum continua na lista: "
       + JSON.stringify(h.map((x) => x.nome)));

    const h2 = api.edHerdeirosDe(
      "Processo legislativo federal: conceito, espécies normativas, modalidades, fases",
      ["Processo legislativo federal: conceito e espécies normativas",
       "Processo legislativo federal: modalidades e fases", "Distrito Federal"]);
    ok(h2.length === 2,
       "C8e 'Distrito Federal' entrou como parente por causa de 'federal': "
       + JSON.stringify(h2.map((x) => x.nome)));

    /* MAS AS PARTES DE VERDADE FICAM TODAS. Cortar por número fixo
     * esconderia metade de uma divisão legítima. */
    const h3 = api.edHerdeirosDe("Cassação, anulação, revogação e convalidação",
      ["Cassação", "Anulação", "Revogação", "Convalidação"]);
    ok(h3.length === 3,
       "C8f o corte comeu partes reais da divisao: "
       + JSON.stringify(h3.map((x) => x.nome)));

    /* e quando SÓ há candidatos fracos, eles ficam: são a única pista */
    const h4 = api.edHerdeirosDe("Dinâmica e instituições",
      ["Mercado financeiro: dinâmica e instituições"]);
    ok(h4.length === 1,
       "C8g sem candidato forte, o fraco tambem sumiu: "
       + JSON.stringify(h4));
  }

  /* ---- C9: o plural não separa duas palavras iguais ---- */
  {
    const { api } = rodar();
    ok(api.edPalavras("Taxas de juros")[0] === api.edPalavras("Taxa de juros")[0],
       "C9 'Taxas' e 'Taxa' continuam sendo palavras diferentes: "
       + JSON.stringify([api.edPalavras("Taxas de juros"),
                         api.edPalavras("Taxa de juros")]));
    /* mas o corte é grosseiro de propósito e não pode comer palavra
     * curta: "Bens" e "Ben" não são a mesma coisa */
    ok(api.edPalavras("Bens")[0] === "bens",
       "C9b o corte do plural comeu uma palavra curta: "
       + JSON.stringify(api.edPalavras("Bens")));
  }

  /* ---- C10: limpar a caixa para colar outra versão ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("X", ANTES);
    api.hubAbrirEdital(ed.id);
    api.$("edColarTexto").value = DEPOIS;
    api.edConferirColagem();
    ok((api.$("edColarLista").textContent || "").length > 0,
       "C10-pre a lista nao foi montada");

    await conduzir(api, api.edColarLimpar());
    ok(api.$("edColarTexto").value === "",
       "C10 a caixa nao foi limpa: "
       + String(api.$("edColarTexto").value).slice(0, 40));
    /* E O PLANO NÃO É TOCADO. Limpar a caixa é desfazer a colagem, não
     * apagar o edital — confundir os dois seria o pior erro possível
     * num botão chamado "limpar". */
    const r = api.lerEdital(api.$("editalTexto").value);
    let tops = 0;
    r.disciplinas.forEach((d) => { tops += d.topicos.length; });
    ok(tops === 5,
       "C10b limpar a caixa mexeu no plano: " + tops + " topicos");
    /* e a conferência se refaz: os avisos do texto velho não podem
     * continuar na tela descrevendo um texto que já não existe */
    ok(api.$("edColarListaCx").hidden === true,
       "C10c a lista do texto apagado continua na tela");
  }

  /* ================================================================
   * C11: TODO BOTÃO EXPLICA E PERGUNTA
   *
   * A caixa tem seis botões, e um deles troca um plano inteiro. Antes,
   * a explicação morava no atributo "title" — um balão que só aparece
   * se o ponteiro parar em cima, e que no telefone não existe. E a
   * confirmação final só vinha quando havia perda: sem perda, a única
   * ação irreversível era a mais fácil de disparar.
   * ============================================================== */
  {
    const fs2 = require("fs");
    const path2 = require("path");
    const html = fs2.readFileSync(
      path2.join(__dirname, "..", "docs", "index.html"), "utf8");
    const bloco = html.slice(html.indexOf('id="dlgEdColar"'),
      html.indexOf("</dialog>", html.indexOf('id="dlgEdColar"')));

    /* cada botão tem uma explicação VISÍVEL ao lado, não um title */
    ["ed_colar_aplicar_exp", "ed_colar_limpar_exp", "ed_colar_fechar_exp",
     "ed_colar_recolocar_exp", "ed_colar_prompt_exp", "ed_colar_copiar_exp"]
      .forEach((k) => {
        ok(bloco.indexOf('data-i18n="' + k + '"') >= 0,
           "C11 falta a explicacao visivel de " + k);
      });

    const { api } = rodar();
    ["ed_colar_aplicar_exp", "ed_colar_limpar_exp", "ed_colar_fechar_exp"]
      .forEach((k) => {
        const txt = api.t(k);
        ok(txt && txt !== k && txt.length > 20,
           "C11b a explicacao de " + k + " esta vazia ou generica: " + txt);
      });

    /* e cada confirmação diz o que acontece, não só "tem certeza?" */
    ["ed_colar_conf_aplicar", "ed_colar_conf_limpar",
     "ed_colar_conf_recolocar", "ed_colar_conf_prompt",
     "ed_colar_conf_copiar"].forEach((k) => {
      const txt = api.t(k);
      ok(txt && txt !== k && txt.length > 40,
         "C11c a confirmacao de " + k + " nao explica o que vai ocorrer: "
         + txt);
    });
  }

  /* ---- C12: substituir pergunta mesmo sem perda nenhuma ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("X", ANTES);
    api.hubAbrirEdital(ed.id);
    /* NADA SOME, só ACRESCENTA: nenhuma das confirmações em degraus
     * dispara, porque todas elas cuidam de perda. É exatamente o caso em
     * que a única ação irreversível da caixa era a mais fácil de
     * disparar — um clique, sem pergunta. */
    const maisUm = ANTES + "\n+ Licitações :: 4 :: nova lei";
    api.$("edColarTexto").value = maisUm;
    const c = api.edCompararColagem(ANTES, maisUm, {});
    ok(c.somem.length === 0 && c.orfaos.length === 0
       && c.pesosMudam.length === 0 && c.discSomem.length === 0,
       "C12-pre o cenario tem perda e nao serve para este teste: "
       + JSON.stringify({ s: c.somem.length, o: c.orfaos.length }));

    /* RECUSANDO a pergunta, o plano não pode mudar. A asserção mede o
     * EFEITO, não o fato de a promessa ter terminado: sem pergunta
     * nenhuma a promessa também termina, e a primeira versão deste
     * teste passava com a confirmação arrancada. */
    const antesDoTexto = api.$("editalTexto").value;
    let pronto = false;
    const pr = api.edAplicarColagem();
    pr.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(false); } catch (e) {}   /* responde NÃO */
    }
    await pr;
    ok(api.$("editalTexto").value === antesDoTexto,
       "C12 o plano foi substituido mesmo com a confirmacao recusada — "
       + "ou nao houve confirmacao nenhuma");

    /* e ACEITANDO, muda */
    let p2 = false;
    const pr2 = api.edAplicarColagem();
    pr2.then(() => { p2 = true; }, () => { p2 = true; });
    for (let i = 0; i < 12 && !p2; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    await pr2;
    ok(/Licitações/.test(api.$("editalTexto").value),
       "C12b aceitar a confirmacao nao aplicou a colagem");
  }

  /* ================================================================
   * C13: O ALARME FALSO
   *
   * "107 tópicos somem" descrevia uma revisão em que NADA se perdeu.
   * Dividir "Cassação, anulação, revogação e convalidação" em quatro
   * linhas faz o nome antigo deixar de existir — isso não é perda, é o
   * objetivo da revisão.
   *
   * O custo do alarme falso não é o susto: é que ele ensina a ignorar o
   * alarme. Quem lê "107 somem" três vezes e descobre que estava tudo
   * bem vai clicar em "substituir" sem ler na quarta — inclusive no dia
   * em que houver perda de verdade.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    /* uma revisão em que só há divisão: nada se perde */
    const soDivide = [
      "# X | prova: 2027-06-01 | horas: 20",
      "@ Direito Administrativo :: 5",
      "+ Cassação :: 3",
      "+ Anulação :: 4",
      "+ Revogação :: 4",
      "+ Convalidação :: 4",
      "+ Conceito de ato administrativo :: 2",
      "+ Improbidade administrativa :: 5 :: lei muito cobrada",
      "+ Poder de polícia :: 5 :: cai em quase toda prova",
      "@ Português :: 2",
      "+ Crase :: 4 :: pega muita gente",
    ].join("\n");
    const ed = api.edCriar("X", ANTES);
    api.hubAbrirEdital(ed.id);
    api.$("edColarTexto").value = soDivide;
    const c = api.edConferirColagem();
    ok(c && c.semHerdeiro.length === 0 && c.herdados.length === 2,
       "C13-pre o cenario nao e' de divisao pura: "
       + JSON.stringify({ s: c && c.semHerdeiro.length,
                          h: c && c.herdados.length }));

    const av = (api.$("edColarAviso").textContent || "");
    /* A PALAVRA "SOMEM" fica reservada para o que some de verdade. */
    ok(!/somem/i.test(av),
       "C13 uma revisao sem perda nenhuma ainda diz que topicos 'somem': "
       + av.slice(0, 120));
    ok(/mudaram de nome/i.test(av),
       "C13b o aviso nao diz o que de fato aconteceu: " + av.slice(0, 120));

    /* e nenhuma linha do aviso está marcada como perigo ou aviso */
    const classes = [];
    const anda = (el) => Array.from(el.children || []).forEach((f) => {
      classes.push(f.className || ""); anda(f);
    });
    anda(api.$("edColarAviso"));
    ok(!classes.some((k) => /perigo|aviso/.test(k)),
       "C13c a divisao pura foi pintada como risco: "
       + JSON.stringify(classes));

    /* O GRUPO EXPLICA O MOTIVO. Cem nomes desaparecendo sob um título
     * seco ainda parecem um problema. */
    const lista = api.$("edColarLista").textContent || "";
    ok(/nome antigo deixar de existir/i.test(lista),
       "C13d a lista nao explica por que o nome antigo some: "
       + lista.slice(0, 150));
  }

  /* ---- C14: mas o alarme VERDADEIRO continua alto ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("X", ANTES);
    api.hubAbrirEdital(ed.id);
    api.$("edColarTexto").value = DEPOIS;   /* aqui a improbidade sai */
    api.edConferirColagem();
    const av = api.$("edColarAviso").textContent || "";
    ok(/somem/i.test(av),
       "C14 a perda de verdade deixou de ser anunciada: " + av.slice(0, 120));

    /* E O RISCO QUE UMA RENOMEAÇÃO CRIA: a marca de estudado é guardada
     * pelo nome, e não acompanha a troca. É o único dano de uma divisão,
     * e tem de aparecer quando existir. */
    const { api: api2 } = rodar();
    api2.matIniciar(); api2.edIniciar();
    const ed2 = api2.edCriar("Y", ANTES);
    api2.hubAbrirEdital(ed2.id);
    api2.edProgressoPor({
      "direito administrativo›cassação, anulação, revogação e convalidação":
        { e: "feito", d: "2026-08-01" },
    });
    api2.$("edColarTexto").value = DEPOIS;
    const c2 = api2.edConferirColagem();
    const marc = (c2.somemDetalhe || []).filter((x) => x.marcado).length;
    ok(marc === 1,
       "C14b o topico estudado que mudou de nome nao foi sinalizado: " + marc);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
