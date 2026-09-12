/* O RAIO-X DA RECOMENDAÇÃO — e as duas coisas que ele revelou.
 *
 * 1. A AGENDA DESFAZIA O RODÍZIO. montarPlano intercala as disciplinas
 *    de propósito (uma vaga para cada, por rodada), e a tela do topo
 *    reordenava tudo por "bruto × urgência" antes de pintar. Ordenar por
 *    peso AGRUPA POR DISCIPLINA: num edital com Direito Financeiro
 *    pesado, as oito primeiras linhas eram cinco de Financeiro e três de
 *    Controle Externo — nenhuma das outras três disciplinas. Quem estuda
 *    de cima para baixo passava a semana numa matéria só.
 *
 *    Duas ordenações da mesma lista, uma desfazendo a outra, e nenhuma
 *    tela mostrava as duas juntas para a contradição aparecer.
 *
 * 2. A FATIA DA PROVA NÃO MOVE NADA. O app calcula quanto cada
 *    disciplina vale na prova, exibe esse número no motivo de cada item,
 *    e o rodízio distribui o tempo em partes iguais. 40 questões contra
 *    5 dão 50% e 50% do tempo.
 *
 * O painel existe para pôr números que discordam na mesma linha. Então
 * é justo que os testes dele afirmem exatamente isso. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# TCE-PE | prova: 2027-06-01 | horas: 20",
  "@ Direito Financeiro :: 5",
  "+ DF t1 :: 5", "+ DF t2 :: 5", "+ DF t3 :: 5", "+ DF t4 :: 5",
  "+ DF t5 :: 5", "+ DF t6 :: 5", "+ DF t7 :: 3", "+ DF t8 :: 3",
  "@ Controle Externo :: 5",
  "+ CE t1 :: 5", "+ CE t2 :: 3", "+ CE t3 :: 3", "+ CE t4 :: 3",
  "@ Contabilidade :: 4",
  "+ CT t1 :: 5", "+ CT t2 :: 3", "+ CT t3 :: 3", "+ CT t4 :: 3",
  "@ Português :: 2",
  "+ PT t1 :: 5", "+ PT t2 :: 3", "+ PT t3 :: 3", "+ PT t4 :: 3",
].join("\n");

/* maior sequência de linhas seguidas da mesma disciplina */
function corrida(nomes) {
  let maior = 1, atual = 1;
  for (let i = 1; i < nomes.length; i++) {
    atual = nomes[i] === nomes[i - 1] ? atual + 1 : 1;
    if (atual > maior) maior = atual;
  }
  return nomes.length ? maior : 0;
}

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const itens = (el, out) => {
    Array.from(el.children || []).forEach((f) => {
      if (/(^| )ed-item( |$)/.test(f.className || "")) out.push(f);
      itens(f, out);
    });
    return out;
  };
  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const txt = EDITAL.replace("2027-06-01", daqui(280));
    const ed = api.edCriar("TCE-PE", txt);
    api.hubAbrirEdital(ed.id);
    api.$("edProva").value = daqui(280);
    api.edRender(); api.hubRender();
    return { ed, r: api.lerEdital(txt) };
  };
  const plano = (api, r) => api.montarPlano(r,
    { horas: 20, prova: daqui(280), hoje: undefined });

  /* ================================================================
   * R1: O RODÍZIO CHEGA À TELA
   * ============================================================== */
  {
    const { api } = rodar();
    const { r } = montar(api);
    const p = plano(api, r);
    const s1 = p.fila.filter((i) => i.semana === 1);
    ok(s1.length >= 8, "R1-pre a semana ficou curta demais para o teste: " + s1.length);

    /* o plano intercala: nunca duas da mesma disciplina em seguida
     * enquanto houver outra com fila */
    /* a corrida vale enquanto TODAS as disciplinas ainda tem fila: no
     * fim da semana a que sobrou aparece sozinha, e isso e correto —
     * nao ha com o que intercalar. */
    ok(corrida(s1.slice(0, 8).map((i) => i.disciplina)) === 1,
       "R1 o proprio plano ja saiu agrupado: "
       + s1.slice(0, 10).map((i) => i.disciplina).join(", "));

    /* e a AGENDA, que é o que a pessoa vê, precisa manter isso.
     * Ler da tela, não recalcular: era exatamente entre o cálculo e a
     * tela que a ordem se perdia. */
    const linhas = itens(api.$("edAgendaTopo"), []);
    const discNaTela = linhas.map((li) => {
      const t = li.textContent || "";
      if (/Financeiro/.test(t)) return "DF";
      if (/Controle/.test(t)) return "CE";
      if (/Contabilidade/.test(t)) return "CT";
      if (/Portugu/.test(t)) return "PT";
      return "?";
    }).filter((x) => x !== "?");
    ok(discNaTela.length >= 6,
       "R1b-pre a agenda na tela veio curta demais: " + discNaTela.length);
    ok(corrida(discNaTela.slice(0, 6)) === 1,
       "R1b a agenda agrupa por disciplina — o rodizio foi desfeito ao pintar: "
       + discNaTela.slice(0, 12).join(" "));

    /* AS PRIMEIRAS DA LISTA. É a régua concreta: quem estuda de cima
     * para baixo faz essas. Com quatro disciplinas, todas têm de
     * aparecer — foi a ausência de três delas que motivou tudo isto. */
    const oito = {};
    discNaTela.slice(0, 6).forEach((d) => { oito[d] = (oito[d] || 0) + 1; });
    ok(Object.keys(oito).length === 4,
       "R1c as oito primeiras da agenda nao cobrem as quatro disciplinas: "
       + JSON.stringify(oito));
  }

  /* ---- R2: a marca do rodízio não colide com a da agenda ---- */
  {
    const { api } = rodar();
    const { r } = montar(api);
    const p = plano(api, r);
    const i0 = p.fila.filter((x) => x.semana === 1)[0];
    /* "ordem" JÁ EXISTIA na agenda, com outro significado (bruto ×
     * urgência) e sobrescrita ao juntar os editais. Se a posição no
     * rodízio morasse nesse nome, o raio-X mostraria um número que não
     * é o dele, sem nenhum sinal da troca. */
    ok(i0.ordemFila === 1,
       "R2 a posicao no rodizio nao esta em ordemFila: " + i0.ordemFila);
    ok(i0.rodada === 1, "R2b a rodada nao foi anotada: " + i0.rodada);
    const conta = api.plItemConta(i0);
    ok(conta.ordem === 1 && conta.rodada === 1,
       "R2c o raio-X leu a posicao errada: " + JSON.stringify(conta));
    ok(conta.pesoDisc * conta.pesoTop === conta.bruto,
       "R2d a conta exibida nao fecha: " + conta.pesoDisc + "x"
       + conta.pesoTop + " != " + conta.bruto);
  }

  /* ================================================================
   * R3: PROVA × TEMPO, O NÚMERO QUE O PAINEL VEIO DAR
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    /* 40 questões contra 5: oito para um na prova */
    const L = ["# X | prova: " + daqui(300) + " | horas: 10"];
    ["Tributario:40", "Portugues:5"].forEach((x) => {
      const [d, q] = x.split(":");
      L.push("@ " + d + " :: " + q + "q");
      for (let i = 1; i <= 12; i++) L.push("+ " + d + " t" + i + " :: 5");
    });
    const r = api.lerEdital(L.join("\n"));
    const p = api.montarPlano(r, { horas: 10, prova: daqui(300) });
    const linhas = api.plPorDisciplina(p, r);
    const trib = linhas.filter((x) => x.disciplina === "Tributario")[0];
    const port = linhas.filter((x) => x.disciplina === "Portugues")[0];

    ok(trib && trib.fatiaProva === 89,
       "R3-pre a fatia da prova nao saiu do numero do edital: "
       + JSON.stringify(trib && trib.fatiaProva));
    /* O ACHADO, E O QUE MUDOU DEPOIS.
     *
     * Quando este teste nasceu, o tempo saía 50/50 para 40q contra 5q: o
     * peso da disciplina era 3 fixo em todo edital escrito no formato
     * exato, e a fatia da prova não movia nada.
     *
     * Corrigido isso, o peso passa a sair do número de questões (5 e 1
     * aqui), entra no bruto, e o bruto decide a FAIXA — que decide os
     * minutos de cada sessão. O tempo passou a 67/33.
     *
     * Mas não a 89/11, que é a fatia real: o rodízio continua dando UMA
     * vaga por disciplina por rodada, então a correção vem só pela
     * duração das sessões, não pela quantidade delas. Sobra um desvio de
     * 22 pontos — menor que os 39 de antes, e ainda assim real. É esta
     * verdade parcial que o painel tem de contar. */
    ok(trib && trib.fatiaTempo === 67 && port && port.fatiaTempo === 33,
       "R3 o tempo nao segue mais a proporcao esperada (o motor mudou; "
       + "reveja o aviso do painel): " + JSON.stringify([trib && trib.fatiaTempo,
                                                port && port.fatiaTempo]));
    ok(trib && trib.desvio === -22,
       "R3b o desvio nao mede tempo menos prova: "
       + JSON.stringify(trib && trib.desvio));
    ok(port && port.desvio === +22,
       "R3c o desvio do lado leve nao e o espelho: "
       + JSON.stringify(port && port.desvio));
    /* A CORREÇÃO É PARCIAL, e isso precisa continuar verdadeiro: se o
     * desvio zerasse, o aviso do painel viraria mentira ao contrário. */
    ok(Math.abs(trib.desvio) > 0,
       "R3c2 o desvio zerou — o painel ainda avisa que sobra diferenca");

    /* e o painel PRECISA dizer isso em palavras, não só na coluna */
    ok(/rod[íi]zio/i.test(api.t("plog_desvio_txt")),
       "R3d o aviso nao explica de onde vem a diferenca que sobra");
  }

  /* ---- R4: sem os números do edital, a fatia é estimada e diz que é ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);
    const p = api.montarPlano(r, { horas: 20, prova: daqui(280) });
    ok(p.fatiaExata === false,
       "R4 um edital sem numeros se declarou exato");
    /* MISTURAR ESCALAS É PIOR QUE ESTIMAR. Uma disciplina com número e
     * outra sem produziria uma soma sem sentido; a regra é tudo ou nada. */
    const meio = api.lerEdital(EDITAL.replace("@ Português :: 2",
      "@ Português :: 10q"));
    const pm = api.montarPlano(meio, { horas: 20, prova: daqui(280) });
    ok(pm.fatiaExata === false,
       "R4b bastou UMA disciplina com numero para o app se dizer exato");
  }

  /* ================================================================
   * R5: SINAIS MEDIDOS QUE NÃO ENTRAM NO CÁLCULO
   * ============================================================== */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);
    const p = api.montarPlano(r, { horas: 20, prova: daqui(280) });
    const diario = [
      { d: daqui(-3), disc: "Direito Financeiro", n: "DF t1", a: "feito",
        m: 60, hu: "ruim", q: { feitas: 20, certas: 8 } },
      { d: daqui(-2), disc: "Direito Financeiro", n: "DF t2", a: "feito",
        m: 45, hu: "ruim", q: { pct: 55 } },
      { d: daqui(-1), disc: "Português", n: "PT t1", a: "feito",
        m: 30, hu: "boa", q: { feitas: 10, certas: 9 } },
      /* de outro edital: não pode entrar na conta desta disciplina */
      { d: daqui(-1), disc: "Direito Penal", n: "X", a: "feito", m: 90 },
    ];
    const s = api.plSinais(p, diario, []);
    const df = s.filter((x) => x.disciplina === "Direito Financeiro")[0];
    const pt = s.filter((x) => x.disciplina === "Português")[0];
    ok(df && df.pct === 40,
       "R5 o acerto contado saiu errado: " + JSON.stringify(df && df.pct));
    /* PERCENTUAL ANOTADO NÃO SE MISTURA COM CONTAGEM: não se sabe de
     * quantas questões ele fala, então não tem peso para entrar na média. */
    ok(df && df.pctAnotado === 55,
       "R5b o percentual anotado sumiu ou foi somado ao contado: "
       + JSON.stringify(df && { p: df.pct, a: df.pctAnotado }));
    ok(df && df.qFeitas === 20,
       "R5c o anotado entrou na contagem de questoes: "
       + JSON.stringify(df && df.qFeitas));
    ok(df && df.humorRuim === 2 && df.humorBom === 0,
       "R5d o humor das sessoes nao foi somado: " + JSON.stringify(df));
    ok(!s.some((x) => x.disciplina === "Direito Penal"),
       "R5e disciplina de outro edital entrou na conta");
    /* pior primeiro: é a ordem de quem procura dificuldade */
    ok(s[0] && s[0].disciplina === "Direito Financeiro",
       "R5f a lista nao veio do pior desempenho para o melhor: "
       + s.map((x) => x.disciplina + ":" + x.pct).join(", "));
    ok(pt && pt.pct === 90, "R5g o acerto de Portugues saiu errado");

    /* e o teste que dá nome ao painel: NADA disso mudou a prioridade */
    const antes = p.itens.map((i) => i.bruto).join(",");
    const p2 = api.montarPlano(r, { horas: 20, prova: daqui(280) });
    ok(p2.itens.map((i) => i.bruto).join(",") === antes,
       "R5h o desempenho passou a mexer no plano — atualize este teste "
       + "e o aviso da aba de sinais, que dizem o contrario");
  }

  /* ================================================================
   * R6: INSTANTÂNEOS — um por dia, por edital
   * ============================================================== */
  {
    const { api, janela } = rodar();
    const r = api.lerEdital(EDITAL);
    const p = api.montarPlano(r, { horas: 20, prova: daqui(280) });
    ok(api.plSnapGravar(p, r.cfg, "ed1") === true, "R6 nao gravou o primeiro");
    /* GRAVAR DE NOVO NO MESMO DIA NÃO EMPILHA: o plano se remonta a cada
     * render, e uma cópia por render deixaria a série ilegível e o
     * armazenamento cheio de fotos do mesmo minuto. */
    api.plSnapGravar(p, r.cfg, "ed1");
    api.plSnapGravar(p, r.cfg, "ed1");
    ok(api.plSnapsDoEdital("ed1").length === 1,
       "R6b tres gravacoes no mesmo dia viraram tres registros: "
       + api.plSnapsDoEdital("ed1").length);
    /* outro edital tem série própria */
    api.plSnapGravar(p, r.cfg, "ed2");
    ok(api.plSnapsDoEdital("ed1").length === 1
       && api.plSnapsDoEdital("ed2").length === 1,
       "R6c os editais compartilharam a mesma serie");

    /* e sobrevive ao F5 — do ARMAZENAMENTO, não da memória */
    const bruto = janela.localStorage.getItem("eac_plano_snaps");
    ok(bruto && JSON.parse(bruto).length === 2,
       "R6d o instantaneo nao foi gravado: " + String(bruto).slice(0, 60));

    /* a diferença entre dois dias: quem entrou, quem saiu */
    const a = { itens: [{ c: "x", disc: "D", n: "A" }, { c: "y", disc: "D", n: "B" }] };
    const b = { itens: [{ c: "y", disc: "D", n: "B" }, { c: "z", disc: "D", n: "C" }] };
    const dif = api.plSnapDiferenca(a, b);
    ok(dif.entraram.length === 1 && /C/.test(dif.entraram[0]),
       "R6e nao viu quem entrou: " + JSON.stringify(dif));
    ok(dif.sairam.length === 1 && /A/.test(dif.sairam[0]),
       "R6f nao viu quem saiu: " + JSON.stringify(dif));
    ok(dif.ficaram.length === 1, "R6g nao viu quem ficou");
  }

  /* ================================================================
   * R7: ARMAZENAMENTO — o que pode sair e o que jamais
   * ============================================================== */
  {
    const { api, janela } = rodar();
    janela.localStorage.setItem("eac_ger_log",
      JSON.stringify([{ q: "2026-01-01", o: "x".repeat(500) }]));
    janela.localStorage.setItem("eac_edital_diario",
      JSON.stringify([{ d: "2026-01-01", n: "t", m: 60 }]));

    const a = api.plArmazenamento();
    const log = a.linhas.filter((x) => x.chave === "eac_ger_log")[0];
    const dia = a.linhas.filter((x) => x.chave === "eac_edital_diario")[0];
    ok(log && log.bytes > 900,
       "R7 a medicao nao conta dois bytes por caractere: "
       + JSON.stringify(log && log.bytes));
    /* A CLASSE É O QUE AUTORIZA O BOTÃO. Um log é diagnóstico e pode
     * sair inteiro; o diário é a única prova do que você estudou. */
    ok(log && log.classe === "diag",
       "R7b o log de geracao nao esta classificado como diagnostico");
    ok(dia && dia.classe === "testemunho",
       "R7c o DIARIO nao esta protegido como testemunho: "
       + JSON.stringify(dia && dia.classe));

    /* nenhuma poda pode oferecer testemunho */
    const podas = api.plPodasDisponiveis();
    ok(podas.length >= 3, "R7d as podas sumiram: " + podas.length);

    /* CALCULAR NÃO É APAGAR. O botão promete um número exato antes de
     * agir; se a conta já apagasse, a promessa seria feita depois. */
    const so = api.plPodaLogs(false);
    ok(so.bytes > 900, "R7e a poda nao calculou o tamanho: " + so.bytes);
    ok(janela.localStorage.getItem("eac_ger_log") !== null,
       "R7f apenas CALCULAR o tamanho ja apagou o log");

    api.plPodaLogs(true);
    ok(janela.localStorage.getItem("eac_ger_log") === null,
       "R7g a poda nao apagou o log");
    /* E O DIÁRIO CONTINUA LÁ. É a asserção que faz este painel poder
     * existir: limpar espaço nunca toca no que não se reconstitui. */
    ok(janela.localStorage.getItem("eac_edital_diario") !== null,
       "R7h a limpeza levou o diario de estudo junto");
  }

  /* ---- R8: rascunho só sai se a questão já foi respondida, e há tempo ---- */
  {
    const { api, janela } = rodar();
    const velha = new Date(Date.now() - 200 * 86400000).toISOString();
    const nova = new Date(Date.now() - 3 * 86400000).toISOString();
    janela.localStorage.setItem("eac_rascunhos", JSON.stringify({
      q1: { tracos: [[[1, 2]]], texto: "a".repeat(400) },   /* respondida ha muito */
      q2: { tracos: [[[1, 2]]], texto: "b".repeat(400) },   /* respondida ontem */
      q3: { tracos: [[[1, 2]]], texto: "c".repeat(400) },   /* NUNCA respondida */
    }));
    const banco = [
      { id: "q1", tentativas: [{ q: velha, acertou: true }] },
      { id: "q2", tentativas: [{ q: nova, acertou: false }] },
      { id: "q3", tentativas: [] },
    ];
    const prev = api.plPodaRascunhos(90, false, banco);
    ok(prev.itens === 1,
       "R8 a poda nao escolheu exatamente o rascunho velho: " + prev.itens);
    api.plPodaRascunhos(90, true, banco);
    const ficou = JSON.parse(janela.localStorage.getItem("eac_rascunhos"));
    ok(!ficou.q1, "R8b o rascunho velho continua la");
    ok(ficou.q2, "R8c levou junto o rascunho de uma questao de ontem");
    /* TRABALHO EM CURSO NUNCA SAI. Rascunho de questão ainda não
     * respondida é uma conta pela metade, não um resto do passado —
     * e não tem data de resposta para se defender. */
    ok(ficou.q3,
       "R8d apagou o rascunho de uma questao que nunca foi respondida");
  }

  /* ---- R9: o relatório de texto leva os números, não o desenho ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);
    const p = api.montarPlano(r, { horas: 20, prova: daqui(280) });
    const txt = api.plRelatorio(p, r, [], [], r.cfg);
    ["POR DISCIPLINA", "SEMANA 1", "NAO ENTRAM NO CALCULO"].forEach((x) => {
      ok(txt.indexOf(x) >= 0, "R9 falta a secao " + x + " no relatorio");
    });
    ok(/Direito Financeiro/.test(txt),
       "R9b o relatorio nao nomeia as disciplinas");
    /* a conta desmontada tem de estar no texto: é o que se cola numa
     * conversa quando se quer discutir a fórmula */
    ok(/\d+x\d+=\d+/.test(txt),
       "R9c o relatorio nao mostra pesoD x pesoT = bruto");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
