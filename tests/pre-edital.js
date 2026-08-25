/* =====================================================================
 * PRÉ-EDITAL → PÓS-EDITAL (v8.81)
 *
 * A regra que manda em tudo: estudo feito na fase de pré-edital NUNCA e
 * apagado. Se a disciplina sair do plano quando o edital sair, o registro
 * continua no diario, marcado como pre-edital. Ele e historico do que voce
 * fez; o plano e uma expectativa sobre o futuro. Reescrever o primeiro
 * porque o segundo mudou e apagar trabalho real por causa de um palpite.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const PRE = ["# TCE-CE | previsto: 2027-03..2027-06 | horas: 10",
  "@ Direito Constitucional :: 4 :: confirmada",
  "+ Controle de constitucionalidade :: 5 :: pq",
  "+ Poder Legislativo :: 4 :: pq",
  "@ Auditoria Governamental :: 5 :: provavel",
  "+ NBASP 100 :: 5 :: pq",
  "@ Analise de Dados :: 3 :: boato",
  "+ Mineracao de dados :: 3 :: pq",
  "+ Dados abertos :: 3 :: pq"].join("\n");

const POS = ["# TCE-CE | prova: 2027-05-16 | horas: 40",
  "@ Direito Constitucional :: 5",
  "+ Controle de constitucionalidade :: 5 :: pq",
  "+ Poder Legislativo :: 4 :: pq",
  "+ Poder Judiciario :: 3 :: pq",
  "@ Auditoria Governamental :: 5",
  "+ NBASP 100 :: 5 :: pq"].join("\n");

function diarioNovo() {
  return [
    { d: "2026-09-01", disc: "Analise de Dados", n: "Mineracao de dados",
      a: "feito", m: 180, cc: "TCE-CE" },
    { d: "2026-09-02", disc: "Direito Constitucional",
      n: "Controle de constitucionalidade", a: "feito", m: 240, cc: "TCE-CE" },
  ];
}

function testes() {
  const { falhas: carga, api } = rodar();
  const falhas = carga.slice();
  const ok = (c, m) => { if (!c) falhas.push(m); };

  /* ---- E1: a janela, e a borda mais proxima ---- */
  {
    ok(JSON.stringify(api.edJanela("2027-03..2027-06"))
       === JSON.stringify({ de: "2027-03-01", ate: "2027-06-30", meses: 3 }),
       "E1 janela de meses lida errado: " + JSON.stringify(api.edJanela("2027-03..2027-06")));
    const m = api.edJanela("2027-03");
    ok(m && m.de === "2027-03-01" && m.ate === "2027-03-31",
       "E1b mes solto devia virar o mes inteiro: " + JSON.stringify(m));
    ok(api.edJanela("") === null && api.edJanela("lixo") === null,
       "E1c janela invalida devia dar null, nao um objeto quebrado");

    /* a borda MAIS PROXIMA e a suposicao conservadora: se a prova sair em
     * marco e voce planejou para junho, voce e pego; o contrario so sobra
     * tempo */
    const cfg = api.lerEdital(PRE).cfg;
    ok(api.edDataPlanejada(cfg) === "2027-03-01",
       `E1d devia planejar pela borda mais proxima, usou ${api.edDataPlanejada(cfg)}`);
    ok(cfg.fase === "pre", `E1e o edital previsto nao foi marcado como pre: ${cfg.fase}`);
    /* e "prova:" continua mandando quando existe */
    const cfg2 = api.lerEdital("# X | prova: 2026-11-30 | horas: 10\n@ D :: 5\n+ t :: 5").cfg;
    ok(cfg2.fase === "pos" && api.edDataPlanejada(cfg2) === "2026-11-30",
       "E1f edital com data virou pre-edital sem motivo");
  }

  /* ---- E2: confianca por disciplina ---- */
  {
    const r = api.lerEdital(PRE);
    const porNome = {};
    r.disciplinas.forEach((d) => { porNome[d.nome] = d.confianca; });
    ok(porNome["Direito Constitucional"] === "confirmada",
       `E2 confianca 'confirmada' nao foi lida: ${porNome["Direito Constitucional"]}`);
    ok(porNome["Analise de Dados"] === "boato",
       `E2b confianca 'boato' nao foi lida: ${porNome["Analise de Dados"]}`);

    /* boato fica FORA da agenda por padrao: estudar por especulacao e o
     * desperdicio mais caro que existe num concurso */
    const boato = r.disciplinas.find((d) => d.confianca === "boato");
    ok(api.preNaAgenda(boato, []) === false,
       "E2c disciplina 'boato' entrou na agenda sem gesto explicito");
    ok(api.preNaAgenda(boato, ["analise de dados"]) === true,
       "E2d nao deu para forcar a disciplina 'boato' para dentro da agenda");
    const conf = r.disciplinas.find((d) => d.confianca === "confirmada");
    ok(api.preNaAgenda(conf, []) === true,
       "E2e disciplina confirmada ficou de fora da agenda");

    /* edital normal, sem confianca, entra normalmente */
    const semConf = api.lerEdital("# X | prova: 2026-11-30\n@ D :: 5\n+ t :: 5").disciplinas[0];
    ok(api.preNaAgenda(semConf, []) === true,
       "E2f disciplina de edital comum ficou de fora por nao ter confianca");
  }

  /* ---- E3: a virada, e o retrato antes de mudar nada ---- */
  {
    const prog = { "analise de dados›mineracao de dados": { e: "feito" },
                   "direito constitucional›controle de constitucionalidade": { e: "feito" } };
    const d = diarioNovo();
    const c = api.preComparar(PRE, POS, prog, d);

    ok(c.ficam.length === 3, `E3 esperava 3 topicos mantidos, veio ${c.ficam.length}`);
    ok(c.somem.length === 2, `E3b esperava 2 topicos que somem, veio ${c.somem.length}`);
    ok(c.surgem.length === 1, `E3c esperava 1 topico novo, veio ${c.surgem.length}`);

    /* a linha que importa: quanto do que voce ESTUDOU vai sair do plano */
    ok(c.estudadosQueSomem.length === 1
       && c.estudadosQueSomem[0].topico === "Mineracao de dados",
       `E3d nao identificou o estudo que sai do plano: ${JSON.stringify(c.estudadosQueSomem)}`);
    ok(c.minutosPerdidos === 180,
       `E3e as horas no que sai do plano estao erradas: ${c.minutosPerdidos}min`);

    ok(c.discSomem.length === 1 && c.discSomem[0].confianca === "boato",
       `E3f a disciplina que saiu nao foi identificada: ${JSON.stringify(c.discSomem)}`);
    ok(c.pesos.length === 1 && c.pesos[0].de === 4 && c.pesos[0].para === 5,
       `E3g mudanca de peso nao detectada: ${JSON.stringify(c.pesos)}`);
    ok(c.temData === true && c.prova === "2027-05-16",
       "E3h o edital publicado tem data e a comparacao nao viu");

    /* comparar NAO pode mexer em nada */
    ok(Object.keys(prog).length === 2, "E3i comparar mexeu no progresso");
    ok(d.length === 2 && !d[0].fase, "E3j comparar carimbou o diario sozinho");
  }

  /* ---- E4: O REGISTRO PRE-EDITAL NUNCA SOME ----
   * Esta e a invariante que o usuario pediu explicitamente, e a mais facil
   * de quebrar sem ninguem notar: a disciplina sai do plano e leva junto o
   * registro de que voce estudou. */
  {
    const d = diarioNovo();
    const antes = d.length;
    const n = api.preCarimbarDiario(d, "TCE-CE", "2027-01-20");
    ok(n === 2, `E4 esperava 2 registros carimbados, veio ${n}`);
    ok(d.length === antes, "E4b carimbar o diario mudou o numero de registros");
    ok(d.every((x) => x.fase === "pre"),
       "E4c registro sem a marca de pre-edital");
    ok(d[0].faseEdital === "TCE-CE" && d[0].faseAte === "2027-01-20",
       `E4d a marca nao diz de qual edital nem ate quando: ${JSON.stringify(d[0])}`);

    /* carimbar de novo nao reescreve o que ja tem marca */
    d.push({ d: "2027-02-01", disc: "Direito Constitucional", n: "Poder Judiciario",
             a: "feito", m: 60, cc: "TCE-CE" });
    const n2 = api.preCarimbarDiario(d, "TCE-CE", "2027-03-01");
    ok(n2 === 1, `E4e recarimbou registros que ja tinham marca (${n2})`);
    ok(d[0].faseAte === "2027-01-20",
       "E4f a marca antiga foi sobrescrita pela nova data");

    /* e o ORFAO — topico que nao existe mais — continua no diario */
    const orf = api.preOrfaos(d, POS);
    ok(orf.length === 1 && orf[0].n === "Mineracao de dados",
       `E4g o registro orfao nao foi identificado: ${JSON.stringify(orf.map((x) => x.n))}`);
    ok(d.length === 3, "E4h identificar orfaos removeu registros do diario");
    ok(orf[0].fase === "pre",
       "E4i o orfao perdeu a marca de pre-edital, e ninguem vai saber de onde ele veio");
  }

  /* ---- E5: aplicar preserva, nao apaga ---- */
  {
    const prog = { "analise de dados›mineracao de dados": { e: "feito" } };
    const d = diarioNovo();
    const c = api.preComparar(PRE, POS, prog, d);
    const r = api.preAplicar(POS, c);
    ok(r.texto === POS, "E5 aplicar devia devolver o edital publicado");
    ok(r.resumo.horasPreservadas === 3,
       `E5b o resumo devia dizer 3h preservadas, disse ${r.resumo.horasPreservadas}`);
    ok(Object.keys(prog).length === 1,
       "E5c aplicar apagou progresso — ele fica guardado pela chave, como na v8.73");
    ok(d.length === 2, "E5d aplicar apagou registros do diario");
  }

  /* ---- E6: material orfao e destinos (P5) ---- */
  {
    api.matIniciar();
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("Analise de Dados", "Mineracao de dados");
    api.matGravar(ch, "Resumo escrito antes do edital sair.",
      { disciplina: "Analise de Dados", topico: "Mineracao de dados" });
    api.matGravarCartoes(ch, "O que e mineracao? :: Extrair padroes :: tag",
      { disciplina: "Analise de Dados", topico: "Mineracao de dados" });

    const orf = api.preMaterialOrfao(mat, POS);
    ok(orf.length === 1 && orf[0].topico === "Mineracao de dados",
       `E6 material orfao nao identificado: ${JSON.stringify(orf)}`);
    ok(orf[0].cartoes === 1, `E6b a contagem de cartoes do orfao errou: ${orf[0].cartoes}`);

    /* material de topico VIVO nao pode ser listado como orfao */
    const chVivo = api.matChave("Direito Constitucional", "Controle de constitucionalidade");
    api.matGravar(chVivo, "Resumo de topico que continua no edital.",
      { disciplina: "Direito Constitucional", topico: "Controle de constitucionalidade" });
    ok(api.preMaterialOrfao(mat, POS).length === 1,
       "E6c material de topico que continua no edital foi tratado como orfao");

    const dest = api.preDestinos(POS);
    /* o POS tem 4 topicos: 2 de Constitucional + Poder Judiciario + NBASP.
     * A primeira versao deste teste disse 3 de cabeca, sem contar. */
    ok(dest.length === 4, `E6d esperava 4 destinos possiveis, veio ${dest.length}`);
    ok(dest.every((d) => d.disciplina && d.topico),
       "E6d2 destino sem disciplina ou sem topico na lista");

    /* remanejar JUNTA, nao sobrescreve — mesma regra do conserto de chaves */
    const alvoCh = api.matChave("Direito Constitucional", "Poder Judiciario");
    api.matGravar(alvoCh, "Ja existia aqui.",
      { disciplina: "Direito Constitucional", topico: "Poder Judiciario" });
    const r = api.preRemanejarMaterial(mat, ch, "Direito Constitucional",
      "Poder Judiciario", () => {});
    ok(r && r.para === alvoCh, `E6e remanejou para a chave errada: ${JSON.stringify(r)}`);
    ok(mat[alvoCh].texto === "Ja existia aqui.",
       "E6f o remanejo sobrescreveu o resumo que ja estava no destino");
    ok(/mineracao/i.test(mat[alvoCh].cartoes || ""),
       `E6g os cartoes do orfao nao chegaram ao destino: ${mat[alvoCh].cartoes}`);
    ok(!mat[ch], "E6h a gaveta de origem continuou existindo depois do remanejo");
    ok(mat[alvoCh].remanejadoDe === "Analise de Dados›Mineracao de dados",
       "E6i o destino nao registra de onde o material veio");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- E7: o estudo remanejado vira VÍNCULO, nao copia ----
   * Copiar o progresso faria o app afirmar "voce estudou isto" sobre um
   * topico em que voce nunca tocou. O vinculo diz de onde veio e desfazer
   * devolve tudo ao lugar sem ter reescrito nada. */
  {
    api.vkCarregar();
    const antesProg = Object.keys(api.edProgresso).length;
    const v = api.preRemanejarEstudo("Analise de Dados", "Mineracao de dados",
      "Direito Constitucional", "Poder Judiciario", "e1");
    ok(v && v.novos === 1, `E7 o vinculo nao foi criado: ${JSON.stringify(v)}`);
    ok(Object.keys(api.edProgresso).length === antesProg,
       "E7b remanejar o estudo escreveu progresso novo em vez de vincular");

    const h = api.vkHistorico("Direito Constitucional", "Poder Judiciario", null,
      [{ d: "2026-09-01", disc: "Analise de Dados", n: "Mineracao de dados",
         a: "feito", cc: "TCE-CE" }], "2026-09-10");
    ok(h.marca !== "sem_historico",
       `E7c o topico de destino nao herdou o historico: ${h.marca}`);
    ok(h.concurso === "TCE-CE",
       "E7d o historico nao diz de qual concurso o estudo veio");
  }

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "pre-edital", 60000).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\npre-edital: ${f.length} FALHA(S)\n`
    : "\npre-edital: janela, confianca, virada e registro que sobrevive ok (46 verificacoes)\n");
  process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
