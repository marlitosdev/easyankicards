/* QUANDO UMA DISCIPLINA JÁ PODE CEDER TEMPO
 *
 * O CONTRÁRIO DA TRAVA, e de propósito apoiado em DADO CERTO.
 *
 * A trava reage a risco, e risco pode ser estimado. Ceder tempo TIRA
 * minutos de uma disciplina — e tirar minutos com base em estimativa é
 * o que pode custar a prova. Por isso a régua aqui é cobertura e
 * revisão, que o app sabe de fato, e não acerto, que é sinal derivado:
 * você só responde questão do que o plano mandou estudar, então o
 * número existe justamente onde o plano já investiu.
 *
 * E 90% DE ACERTO EM 10% DA DISCIPLINA não é motivo para nada — amostra
 * grande em pedaço pequeno continua sendo pedaço pequeno. A régua é a
 * fração da DISCIPLINA.
 *
 * O QUE NÃO PODE ACONTECER, EM HIPÓTESE NENHUMA: a liberação mexer no
 * "bruto". É dele que saem a cobertura e o cumprimento dos mínimos — um
 * fator ali faria a trava anti-eliminação ler uma cobertura que não
 * existe e se desligar sozinha, sem sinal nenhum na tela. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* itens de uma disciplina: quantos cobertos, quantos revisados */
  const disc = (nome, total, feitos, revisados) => {
    const L = [];
    for (let k = 0; k < total; k++) {
      L.push({ disciplina: nome, nome: nome + " t" + k, bruto: 10,
               feito: k < feitos, revisado: k < revisados });
    }
    return L;
  };
  const bloco = (nome, minPct, discs) => ({
    nome, minPct, linhas: discs.map((d) => ({ nome: d })),
  });

  /* ================================================================
   * C1: AS TRÊS CONDIÇÕES SÃO TODAS NECESSÁRIAS
   * ============================================================== */
  {
    const { api } = rodar();
    const B = [bloco("Específicos", 60, ["Tributário"])];
    const alvo = Math.round(60 * api.ED_FOLGA_MINIMO);   /* 75% */

    /* COBERTURA SUFICIENTE E REVISÃO EM DIA: cede. */
    let itens = disc("Tributário", 100, 80, 60);
    let r = api.edDiscComFolga(B, itens, {});
    ok(r.length === 1, "C1 disciplina coberta e revisada nao cedeu: "
       + JSON.stringify(r));
    ok(r[0].alvo === alvo,
       "C1a a regua nao e o minimo com a folga de 25%: " + r[0].alvo
       + " em vez de " + alvo);

    /* COBERTURA ABAIXO DA RÉGUA: não cede, mesmo revisando tudo. */
    itens = disc("Tributário", 100, 70, 70);
    ok(api.edDiscComFolga(B, itens, {}).length === 0,
       "C1b cedeu com cobertura abaixo da folga do minimo");

    /* COBERTA MAS POUCO REVISADA: não cede. Estudar fixa menos que
     * revisar, e ceder tempo do que ainda vai embora é ceder errado. */
    itens = disc("Tributário", 100, 90, 20);
    ok(api.edDiscComFolga(B, itens, {}).length === 0,
       "C1c cedeu com a maior parte do coberto ainda sem revisao");

    /* EM RISCO DE CORTE: não cede, aconteça o que acontecer. É a
     * condição que impede o caso pior — e a trava ja testa cobertura
     * abaixo do minimo, entao ela sozinha cobre o pior cenario. */
    itens = disc("Tributário", 100, 95, 95);
    ok(api.edDiscComFolga(B, itens, { "Tributário": { motivo: "acerto" } }).length === 0,
       "C1d uma disciplina em risco de corte cedeu tempo");
  }

  /* ---- C2: a revisão é do COBERTO, não do total ---- */
  {
    const { api } = rodar();
    const B = [bloco("Específicos", 60, ["Tributário"])];
    /* cobriu 80, revisou 60 desses 80 = 75% do coberto: cede. */
    ok(api.edDiscComFolga(B, disc("Tributário", 100, 80, 60), {}).length === 1,
       "C2 75% do coberto revisado nao bastou");
    /* os mesmos 60 revisados sobre 100 seriam 60% do TOTAL — e a conta
     * sobre o total daria outro resultado neste caso: cobriu 100,
     * revisou 45. Sobre o total: 45%. Sobre o coberto: 45%. Igual.
     * Entao o caso que separa e outro: cobriu 80, revisou 45 = 56% do
     * coberto (cede) e 45% do total (nao cederia). */
    const so = api.edDiscComFolga(B, disc("Tributário", 100, 80, 45), {});
    ok(so.length === 1,
       "C2a a revisao foi medida sobre o total em vez de sobre o "
       + "coberto: " + JSON.stringify(so));
    ok(so[0].revisao >= 50 && so[0].revisao < 60,
       "C2b a taxa de revisao devolvida nao e a do coberto: "
       + (so[0] && so[0].revisao));
  }

  /* ---- C3: sem mínimo declarado, a régua é a própria disciplina ---- */
  {
    const { api } = rodar();
    /* Sem corte no edital não há eliminação, e "×1,25 do mínimo" não
     * tem âncora. A régua vira "quase fechada". */
    const r = api.edDiscComFolga([], disc("Português", 100, 85, 60), {});
    ok(r.length === 1 && r[0].comMinimo === false,
       "C3 disciplina sem minimo, quase fechada, nao cedeu: "
       + JSON.stringify(r));
    ok(r[0].alvo === api.ED_CEDE_SEM_MINIMO,
       "C3a a regua sem minimo nao e a da disciplina: " + r[0].alvo);
    /* e quem mal comecou nao cede, mesmo sem minimo nenhum */
    ok(api.edDiscComFolga([], disc("Português", 100, 40, 40), {}).length === 0,
       "C3b uma disciplina pela metade cedeu tempo por nao ter minimo");
  }

  /* ================================================================
   * C4: O DEGRAU É NA DURAÇÃO, E SÓ NELA
   * ============================================================== */
  {
    const { api } = rodar();
    api.edIniciar();
    /* Uma disciplina grande de peso máximo: a cauda dela continua em
     * faixa alta por causa do peso, e é exatamente onde ceder tempo
     * rende. */
    const linhas = ["# Teste | prova: " + (() => {
      const d = new Date(Date.now() + 120 * 86400000);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
        + "-" + String(d.getDate()).padStart(2, "0");
    })() + " | horas: 40", "@ Tributário :: 5"];
    for (let k = 0; k < 20; k++) linhas.push("+ T" + k + " :: 5 :: pq");
    linhas.push("@ Português :: 4");
    for (let k = 0; k < 10; k++) linhas.push("+ P" + k + " :: 4 :: pq");
    const r = api.lerEdital(linhas.join("\n"));

    /* SEM NADA ESTUDADO: ninguém cede, e a cauda de Tributário está na
     * faixa mais alta. */
    let plano = api.montarPlano(r, { horas: 40, prova: r.cfg.prova });
    const antes = plano.itens.filter((x) => x.disciplina === "Tributário");
    ok(antes.length === 20, "C4-pre o cenario nao montou a disciplina: "
       + antes.length);
    ok(antes.every((x) => x.faixa === "alta"),
       "C4-pre2 a cauda ja nao esta na faixa alta, e o teste nao tem o "
       + "que ver descer: " + antes.map((x) => x.faixa).join(","));
    ok(antes.every((x) => !x.cedeu),
       "C4 cedeu tempo sem nada estudado");

    /* AGORA COBERTA E REVISADA: cede um degrau. */
    const prog = {};
    for (let k = 0; k < 17; k++) {
      prog[("Tributário›T" + k).toLowerCase()] = { e: "revisado", d: "2026-01-01" };
    }
    plano = api.montarPlano(r, { horas: 40, prova: r.cfg.prova,
      feitos: prog });
    const dep = plano.itens.filter((x) => x.disciplina === "Tributário" && !x.feito);
    ok(dep.length === 3, "C4a-pre sobraram outros pendentes: " + dep.length);
    ok(dep.every((x) => x.cedeu),
       "C4a os pendentes da disciplina coberta e revisada nao cederam");
    ok(dep.every((x) => x.faixa === "media" && x.minutos === 45),
       "C4b o degrau nao foi de um: "
       + dep.map((x) => x.faixa + "/" + x.minutos).join(", "));

    /* UM DEGRAU, NÃO DOIS. */
    ok(dep.every((x) => x.faixaAntes === "alta"),
       "C4c a faixa anterior nao ficou registrada para a tela explicar");

    /* E A OUTRA DISCIPLINA NÃO FOI TOCADA. */
    const pt = plano.itens.filter((x) => x.disciplina === "Português");
    ok(pt.every((x) => !x.cedeu),
       "C4d a liberacao respingou numa disciplina que nao cumpriu as "
       + "condicoes");
  }

  /* ================================================================
   * C5: A COBERTURA E OS MÍNIMOS NÃO PODEM MUDAR
   *
   * É a garantia central. Se a liberação encostasse em "bruto", a trava
   * anti-eliminação passaria a ler uma cobertura que não existe.
   * ============================================================== */
  {
    const { api } = rodar();
    api.edIniciar();
    const d = new Date(Date.now() + 120 * 86400000);
    const prova = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
      + "-" + String(d.getDate()).padStart(2, "0");
    const linhas = ["# Teste | prova: " + prova + " | horas: 40",
      "& Específicos | minimo: 60%", "@ Tributário :: 5"];
    for (let k = 0; k < 20; k++) linhas.push("+ T" + k + " :: 5 :: pq");
    const r = api.lerEdital(linhas.join("\n"));
    const prog = {};
    for (let k = 0; k < 18; k++) {
      prog[("Tributário›T" + k).toLowerCase()] = { e: "revisado", d: "2026-01-01" };
    }
    const plano = api.montarPlano(r, { horas: 40, prova, feitos: prog });

    const cederam = plano.itens.filter((x) => x.cedeu);
    ok(cederam.length > 0,
       "C5-pre ninguem cedeu, e o teste abaixo nao mede protecao nenhuma");

    /* O PESO DA PROVA NÃO MUDOU. */
    ok(plano.itens.every((x) => x.bruto === 25),
       "C5 a liberacao encostou no 'bruto', que e de onde saem a "
       + "cobertura e os minimos: "
       + JSON.stringify(plano.itens.map((x) => x.bruto).slice(0, 5)));

    /* E O CUMPRIMENTO DO BLOCO CONTINUA LENDO O EDITAL DE VERDADE. */
    const b = api.edCumprimentoBlocos(r, plano.itens, {});
    ok(b.length === 1, "C5a-pre o bloco com minimo nao foi lido");
    ok(b[0].linhas[0].cobertura === 90,
       "C5b a cobertura do bloco mudou por causa da liberacao: "
       + b[0].linhas[0].cobertura + "% (18 de 20 = 90%)");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
