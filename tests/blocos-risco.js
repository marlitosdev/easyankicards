/* O BLOCO QUE ELIMINA — E A TRAVA QUE NÃO PODE VIRAR ARMADILHA.
 *
 * COBERTURA NÃO É ACERTO. O mínimo do edital é de ACERTOS; o que o app
 * sempre soube medir é COBERTURA. São grandezas diferentes e o painel
 * agora mostra as duas — o risco aqui é somá-las, porque a média de
 * "cobri 100%" com "acerto 40%" dá 70% e descreve alguém que não existe.
 * Cada número tem a sua linha e o seu nome.
 *
 * A TRAVA. Uma disciplina abaixo da margem num bloco com corte ganha
 * DUAS vagas por rodada. A regra mais óbvia seria "fura a fila até sair
 * do risco", e ela é um laço sem saída garantida: acerto sobe devagar, a
 * disciplina monopolizaria o rodízio por semanas, e como o bloco vizinho
 * também tem corte, o remédio criaria a doença do outro lado. Seria o
 * mesmo defeito de concentração que a agenda tinha por acidente — agora
 * escrito de propósito.
 *
 * Então os testes daqui medem o TETO, não só o efeito. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# X | prova: 2027-06-01 | horas: 12",
  "& Básicos | minimo: 50%",
  "@ Português :: 3", "+ p1 :: 5", "+ p2 :: 5", "+ p3 :: 5", "+ p4 :: 5",
  "@ RLM :: 3", "+ r1 :: 5", "+ r2 :: 5", "+ r3 :: 5", "+ r4 :: 5",
  "& Específicos | minimo: 60%",
  "@ Tributário :: 5", "+ t1 :: 5", "+ t2 :: 5", "+ t3 :: 5", "+ t4 :: 5",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const texto = () => EDITAL.replace("2027-06-01", daqui(300));
  const plano = (api, o) => api.montarPlano(api.lerEdital(texto()),
    Object.assign({ horas: 12, prova: daqui(300), fatores: {}, acertos: {} },
      o || {}));
  const conta = (fila) => {
    const c = {};
    fila.forEach((i) => { c[i.disciplina] = (c[i.disciplina] || 0) + 1; });
    return c;
  };

  /* ================================================================
   * B1: COBERTURA E ACERTO NÃO SE MISTURAM
   * ============================================================== */
  {
    const { api } = rodar();
    /* Português: tudo estudado, mas acertando mal. É o caso que a
     * cobertura sozinha esconde — e o único em que o painel velho
     * diria "tudo certo" sobre alguém prestes a ser cortado. */
    const feitos = {};
    ["p1", "p2", "p3", "p4"].forEach((k) => {
      feitos["português›" + k] = { e: "feito", d: daqui(-2) };
    });
    const p = plano(api, { feitos, acertos: {
      "Português": { feitas: 100, certas: 35, pct: 35, amostra: 100,
                     pctAnotado: null },
    } });
    const basicos = p.blocos.filter((b) => /Básicos/.test(b.nome))[0];
    const pt = basicos.linhas.filter((L) => L.nome === "Português")[0];

    ok(pt.cobertura === 100,
       "B1-pre a cobertura de Portugues nao esta cheia: " + pt.cobertura);
    ok(pt.acerto === 35,
       "B1 o acerto medido nao chegou a linha: " + pt.acerto);
    /* O NÚMERO QUE DECIDE ELIMINAÇÃO é o acerto, e ele está abaixo do
     * corte enquanto a cobertura diz 100%. Somar os dois daria 67% e
     * esconderia exatamente isto. */
    ok(pt.acertoAbaixo === true,
       "B1b acerto de 35% com corte de 50% nao foi marcado como abaixo");
    ok(pt.cobertura !== pt.acerto,
       "B1c cobertura e acerto viraram o mesmo numero");
    ok(basicos.pct === 50,
       "B1d a cobertura do BLOCO mudou por causa do acerto: " + basicos.pct);
  }

  /* ---- B2: sem amostra, o acerto não é número, é ausência ---- */
  {
    const { api } = rodar();
    const p = plano(api, { acertos: {
      /* 3 de 5 dá 60% e não diz nada sobre a disciplina */
      "RLM": { feitas: 5, certas: 3, pct: 60, amostra: 5, pctAnotado: null },
    } });
    const b = p.blocos.filter((x) => /Básicos/.test(x.nome))[0];
    const rlm = b.linhas.filter((L) => L.nome === "RLM")[0];
    /* REORGANIZAR A SEMANA POR CAUSA DE CINCO QUESTÕES seria deixar a
     * agenda balançar ao sabor de uma tarde. */
    ok(rlm.acerto === null,
       "B2 cinco questoes viraram um percentual que decide: " + rlm.acerto);
    ok(rlm.acertoAmostra === 5,
       "B2b a amostra sumiu junto com o percentual: " + rlm.acertoAmostra);
    ok(rlm.acertoAbaixo === false && rlm.acertoApertado === false,
       "B2c uma amostra insuficiente virou risco");
  }

  /* ---- B3: o anotado de cabeça fica à parte ---- */
  {
    const { api } = rodar();
    const ac = api.edAcertos(
      [{ d: daqui(-1), disc: "Português", n: "p1", a: "feito",
         q: { feitas: 40, certas: 20 } },
       { d: daqui(-2), disc: "Português", n: "p2", a: "feito",
         q: { pct: 90 } }],
      []);
    const pt = ac["Português"];
    ok(pt.feitas === 40 && pt.pct === 50,
       "B3 o percentual anotado entrou na contagem: "
       + JSON.stringify({ f: pt.feitas, p: pt.pct }));
    ok(pt.pctAnotado === 90,
       "B3b o percentual anotado se perdeu: " + pt.pctAnotado);
  }

  /* ---- B4: uma conta só para o acerto ---- */
  {
    const { api } = rodar();
    /* duas funções contando a mesma coisa com regras diferentes foi o
     * defeito que mais voltou neste app; o raio-X e o painel de blocos
     * têm de chegar ao mesmo número */
    const diario = [{ d: daqui(-1), disc: "Tributário", n: "t1", a: "feito",
                      m: 60, q: { feitas: 50, certas: 30 } }];
    const doEdital = api.edAcertos(diario, [])["Tributário"];
    const p = plano(api, { acertos: api.edAcertos(diario, []) });
    const doPainel = api.plSinais(p, diario, [])
      .filter((x) => x.disciplina === "Tributário")[0];
    ok(doEdital.pct === 60, "B4-pre a conta base saiu errada: " + doEdital.pct);
    ok(doPainel && doPainel.pct === doEdital.pct,
       "B4 o raio-X e o painel de blocos discordam sobre o acerto: "
       + (doPainel && doPainel.pct) + " vs " + doEdital.pct);
  }

  /* ================================================================
   * B5: A TRAVA ATUA — E TEM TETO
   * ============================================================== */
  {
    const { api } = rodar();
    /* Português e Tributário cobertos; RLM não. Só RLM em risco. */
    const feitos = {};
    ["p1", "p2", "p3", "p4"].forEach((k) => {
      feitos["português›" + k] = { e: "revisado", d: daqui(-1) };
    });
    ["t1", "t2", "t3", "t4"].forEach((k) => {
      feitos["tributário›" + k] = { e: "revisado", d: daqui(-1) };
    });
    const p = plano(api, { feitos });
    const risco = api.edDiscEmRisco(p.blocos).map((x) => x.disciplina);
    ok(risco.length === 1 && risco[0] === "RLM",
       "B5-pre o risco nao ficou so em RLM: " + JSON.stringify(risco));

    const s1 = p.fila.filter((i) => i.semana === 1);
    ok(s1.every((i) => i.disciplina === "RLM"),
       "B5-pre2 sobrou fila de outra disciplina para o teste comparar");
    /* e a linha DIZ que veio pela trava */
    ok(s1.length && s1[0].trava === "cobertura",
       "B5 a linha nao registra que a trava atuou: " + (s1[0] || {}).trava);
    ok(s1[0].travaBloco === "Básicos",
       "B5b a linha nao diz de qual bloco veio o risco: " + s1[0].travaBloco);
  }

  /* ---- B6: O TETO. Duas vagas, nunca a fila inteira ---- */
  {
    const { api } = rodar();
    /* RLM em risco (nada estudado), as outras duas cobertas o bastante
     * para sair do risco mas ainda com fila pendente */
    const feitos = {};
    ["p1", "p2", "p3"].forEach((k) => {
      feitos["português›" + k] = { e: "feito", d: daqui(-1) };
    });
    ["t1", "t2", "t3"].forEach((k) => {
      feitos["tributário›" + k] = { e: "feito", d: daqui(-1) };
    });
    const p = plano(api, { feitos });

    /* O TETO SE MEDE POR RODADA, não pelo total da semana.
     *
     * A primeira versão deste teste comparava os totais e falhava por um
     * motivo que não era o defeito: as outras duas disciplinas tinham só
     * um tópico pendente cada, esgotavam a fila na rodada 1 e RLM
     * continuava sozinha — 4 contra 1, sem a trava ter furado teto
     * nenhum. Contar por rodada mede o mecanismo em vez do resultado. */
    const porRodada = {};
    p.fila.forEach((i) => {
      const r2 = porRodada[i.rodada] || (porRodada[i.rodada] = {});
      r2[i.disciplina] = (r2[i.disciplina] || 0) + 1;
    });
    let maiorRisco = 0, maiorOutra = 0;
    Object.keys(porRodada).forEach((k) => {
      const r2 = porRodada[k];
      Object.keys(r2).forEach((d) => {
        if (d === "RLM") maiorRisco = Math.max(maiorRisco, r2[d]);
        else maiorOutra = Math.max(maiorOutra, r2[d]);
      });
    });
    ok(maiorRisco === 2,
       "B6 a disciplina em risco nao recebeu exatamente duas vagas por "
       + "rodada: " + maiorRisco + " — " + JSON.stringify(porRodada));
    /* E AS OUTRAS CONTINUAM COM A SUA. Se a trava tirasse a vaga delas
     * em vez de acrescentar uma, o efeito seria o mesmo monopólio por
     * outro caminho. */
    ok(maiorOutra === 1,
       "B6b a trava tirou vaga das outras em vez de acrescentar a sua: "
       + maiorOutra);
    /* nas rodadas em que TODAS ainda têm fila, a razão é exatamente 2:1 */
    const r1 = porRodada[1] || {};
    ok(r1.RLM === 2 && r1["Português"] === 1 && r1["Tributário"] === 1,
       "B6c a primeira rodada nao saiu 2:1:1: " + JSON.stringify(r1));
  }

  /* ---- B7: com todas em risco, a proporção volta ao normal ---- */
  {
    const { api } = rodar();
    /* nada estudado: as três estão abaixo do mínimo de cobertura */
    const p = plano(api, {});
    const risco = api.edDiscEmRisco(p.blocos);
    ok(risco.length === 3,
       "B7-pre nem todas entraram em risco: " + risco.length);
    const c = conta(p.fila.filter((i) => i.semana === 1));
    const vals = Object.keys(c).map((k) => c[k]);
    /* SE TODAS TÊM DUAS VAGAS, ninguém tem vantagem — e é o
     * comportamento certo, porque não há de quem tirar tempo. */
    ok(Math.max.apply(null, vals) - Math.min.apply(null, vals) <= 1,
       "B7 com todas em risco a semana saiu desequilibrada: "
       + JSON.stringify(c));
  }

  /* ---- B8: sem bloco com mínimo, não há trava ---- */
  {
    const { api } = rodar();
    const semBloco = texto().replace(/^& .*$/gm, "");
    const p = api.montarPlano(api.lerEdital(semBloco),
      { horas: 12, prova: daqui(300), fatores: {}, acertos: {} });
    ok((p.blocos || []).length === 0,
       "B8-pre o edital sem '&' criou blocos: " + (p.blocos || []).length);
    ok(p.fila.every((i) => !i.trava),
       "B8 a trava atuou num edital sem nota minima — sem corte no edital "
       + "nao ha eliminacao por bloco, e tratar todo mundo como risco "
       + "tornaria a trava inutil por excesso");

    /* O CASO QUE FALTAVA: bloco que EXISTE e não tem mínimo.
     *
     * "& Nome" sem "| minimo:" é legítimo — é agrupamento, e o leitor
     * até avisa que provavelmente foi esquecimento. Sem blocos nenhum a
     * guarda nunca é exercida (a lista vem vazia), e a primeira versão
     * deste teste sobreviveu a arrancar a guarda inteira. Aqui há bloco,
     * há disciplina descoberta, e mesmo assim não pode haver trava:
     * onde não há corte, não há eliminação por bloco.
     *
     * Nota honesta: isto está protegido DUAS vezes — pela guarda
     * explícita do minPct nulo e porque as comparações com nulo já dão
     * falso. Arrancar uma das duas não quebra este teste; arrancar as
     * duas, sim. É defesa em profundidade deliberada: a regra "sem
     * corte, sem risco" é barata de escrever duas vezes e cara de
     * perder, porque tratar "sem mínimo" como "mínimo 100%" poria o
     * edital inteiro em risco permanente e a trava viraria ruído. */
    const semMin = texto()
      .replace("& Básicos | minimo: 50%", "& Básicos")
      .replace("& Específicos | minimo: 60%", "& Específicos");
    const p2 = api.montarPlano(api.lerEdital(semMin),
      { horas: 12, prova: daqui(300), fatores: {}, acertos: {} });
    ok((p2.blocos || []).length === 2,
       "B8b-pre os blocos sem minimo se perderam: " + (p2.blocos || []).length);
    ok(p2.blocos.every((b) => b.minPct === null),
       "B8c-pre um bloco sem minimo ganhou um minimo do nada: "
       + JSON.stringify(p2.blocos.map((b) => b.minPct)));
    ok(p2.fila.every((i) => !i.trava),
       "B8d a trava atuou num bloco SEM nota minima — agrupar disciplinas "
       + "nao cria risco de eliminacao");
  }

  /* ---- B9: o acerto também aciona a trava ---- */
  {
    const { api } = rodar();
    /* tudo coberto: pela cobertura, ninguém em risco. Mas Tributário
     * acerta 55% com corte de 60% — é a situação que a cobertura
     * sozinha não enxerga. */
    const feitos = {};
    ["p1", "p2", "p3", "p4"].forEach((k) => {
      feitos["português›" + k] = { e: "feito", d: daqui(-1) };
    });
    ["r1", "r2", "r3", "r4"].forEach((k) => {
      feitos["rlm›" + k] = { e: "feito", d: daqui(-1) };
    });
    ["t1", "t2"].forEach((k) => {
      feitos["tributário›" + k] = { e: "feito", d: daqui(-1) };
    });
    const p = plano(api, { feitos, acertos: {
      "Tributário": { feitas: 200, certas: 110, pct: 55, amostra: 200,
                      pctAnotado: null },
      "Português": { feitas: 200, certas: 180, pct: 90, amostra: 200,
                     pctAnotado: null },
      "RLM": { feitas: 200, certas: 180, pct: 90, amostra: 200,
               pctAnotado: null },
    } });
    const risco = api.edDiscEmRisco(p.blocos);
    const trib = risco.filter((x) => x.disciplina === "Tributário")[0];
    ok(!!trib, "B9 acerto de 55% com corte de 60% nao acionou a trava: "
       + JSON.stringify(risco.map((x) => x.disciplina)));
    ok(/acerto/.test(trib.motivo),
       "B9b o motivo registrado nao e o acerto: " + trib.motivo);
    /* e quem acerta 90% com corte de 50% não é risco */
    ok(!risco.some((x) => x.disciplina === "Português"),
       "B9c quem acerta 90% com corte de 50% entrou como risco");
  }

  /* ---- B10: a margem de segurança também conta ---- */
  {
    const { api } = rodar();
    const feitos = {};
    ["p1", "p2", "p3", "p4"].forEach((k) => {
      feitos["português›" + k] = { e: "feito", d: daqui(-1) };
    });
    /* 55% com corte de 50%: acima da linha, dentro da margem de 10 pontos.
     * ESTAR ACIMA DO CORTE POR CINCO PONTOS não é estar seguro — é a
     * distância que uma prova ruim cobre sozinha. */
    const p = plano(api, { feitos, acertos: {
      "Português": { feitas: 200, certas: 110, pct: 55, amostra: 200,
                     pctAnotado: null },
    } });
    const b = p.blocos.filter((x) => /Básicos/.test(x.nome))[0];
    const pt = b.linhas.filter((L) => L.nome === "Português")[0];
    ok(pt.acertoAbaixo === false && pt.acertoApertado === true,
       "B10 55% com corte de 50% nao foi marcado como apertado: "
       + JSON.stringify({ ab: pt.acertoAbaixo, ap: pt.acertoApertado }));
    ok(pt.seguro === false,
       "B10b um acerto dentro da margem foi declarado seguro");
    ok(b.metaAcerto === 60,
       "B10c a meta de seguranca nao e o corte mais a margem: " + b.metaAcerto);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
