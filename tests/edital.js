/* =====================================================================
 * TESTES DO EDITAL
 * Mesma ideia dos testes de texto dos cartões: invariantes que valem para
 * QUALQUER edital, mais casos concretos. As três primeiras existem porque
 * o plano de estudo é a saída — se ela mentir, a pessoa estuda a coisa
 * errada durante meses e não tem como perceber.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");

function carregar() {
  const src = fs.readFileSync(path.join(__dirname, "..", "docs", "edital.js"), "utf8");
  return new Function(src + "; return {lerEdital,priorizar,montarPlano,semanaAtual,horasTexto,"
    + "semanasAte,edDetectores,edCorrecaoDeTudo,edParaTexto,temNumeracaoEdital,temPesosIguais,"
    + "diagnosticoPlano,ritmoDoPlano,agendar,panoramaDisciplinas,lacunasCriticas,"
    + "tirarNumeracaoEdital,temMarcadorTorto,normalizarMarcadores};")();
}

const BASE = [
  "# TCE-PE | prova: 2026-08-30 | horas: 12",
  "@ Auditoria Governamental :: 5",
  "+ 2.1 Achado de auditoria :: 5 :: cai em quase toda prova",
  "- Papéis de trabalho :: 3",
  "+ Amostragem",
  "@ Direito Constitucional :: 3",
  "+ Princípios fundamentais :: 4",
].join("\n");

function testes() {
  const E = carregar();
  const f = [];
  const ok = (c, m) => { if (!c) f.push(m); };
  const nTop = (r) => r.disciplinas.reduce((s, d) => s + d.topicos.length, 0);

  const r = E.lerEdital(BASE);
  ok(r.cfg.concurso === "TCE-PE", "E1 não leu o nome do concurso");
  ok(r.cfg.prova === "2026-08-30", "E2 não leu a data da prova");
  ok(r.cfg.horas === 12, "E3 não leu as horas por semana");
  ok(r.disciplinas.length === 2, `E4 esperava 2 disciplinas, veio ${r.disciplinas.length}`);
  ok(nTop(r) === 4, `E5 esperava 4 tópicos, veio ${nTop(r)}`);

  /* "-" tem de ser aceito na ENTRADA: é o que a pessoa digita naturalmente */
  ok(r.disciplinas[0].topicos.some((t) => t.nome === "Papéis de trabalho"),
     "E6 o tópico com '-' não foi lido");
  /* peso ausente entra com 3 e fica MARCADO como herdado, para a tela poder
     avisar — um peso chutado que se disfarça de escolhido é pior que nenhum */
  const amost = r.disciplinas[0].topicos.find((t) => t.nome === "Amostragem");
  ok(amost && amost.peso === 3 && amost.herdado === true,
     "E7 peso ausente devia entrar como 3 e marcado como herdado");

  /* ---- invariantes das correções ---- */
  const corr = E.edCorrecaoDeTudo(BASE);
  ok(typeof corr === "function", "E8 não detectou correção no caso base");
  const limpo = corr(BASE);
  ok(nTop(E.lerEdital(limpo)) === nTop(r), "I-E1 a correção perdeu tópico");
  ok(E.lerEdital(limpo).disciplinas.length === r.disciplinas.length,
     "I-E2 a correção perdeu disciplina");
  ok(corr(limpo) === limpo, "I-E3 corrigir duas vezes ≠ corrigir uma (idempotência)");
  ok(E.edDetectores(limpo).filter((x) => x !== "peso_faltando").length === 0,
     "I-E4 sobrou detector aceso depois de um clique");
  ok(!/2\.1/.test(limpo), "E9 a numeração do edital não saiu do nome");

  /* ---- prioridade, faixas e a fila até a prova ---- */
  const P = (txt, o) => E.montarPlano(E.lerEdital(txt), o);
  const p1 = P(limpo, { horas: 12, prova: "2026-12-30", hoje: "2026-08-14", feitos: {} });
  ok(p1.itens[0].nome === "Achado de auditoria",
     "E10 o topo da lista não é o de maior peso × peso da disciplina");
  ok(p1.itens[0].prioridade === 100, "E11 o primeiro devia ancorar em 100");
  ok(p1.itens.every((i) => i.prioridade >= 1 && i.prioridade <= 100),
     "E12 prioridade fora da faixa 1..100");
  ok(p1.itens.every((i) => ["alta", "media", "baixa"].includes(i.faixa)),
     "E12b todo item precisa de uma faixa nomeada");
  for (let i = 1; i < p1.itens.length; i++)
    ok(p1.itens[i - 1].bruto >= p1.itens[i].bruto,
       "E13 a lista não está em ordem de prioridade");

  /* D-A — o plano NUNCA pode pedir mais tempo do que existe. Nasceu do
   * edital real: 231 tópicos viraram 77h por semana contra as 12h
   * informadas, e o número passou dias parecendo legítimo. */
  const GRANDE2 = ["@ Única :: 3"].concat(
    Array.from({ length: 231 }, (_, i) => "+ Tópico " + (i + 1) + " :: " + (1 + (i % 5)))
  ).join("\n");
  const pg = P(GRANDE2, { horas: 12, prova: "2026-10-16", hoje: "2026-08-14", feitos: {} });
  ok(pg.semanas === 9, `D-A0 esperava 9 semanas, veio ${pg.semanas}`);
  const somaFila = pg.fila.reduce((a, i) => a + i.minutos, 0);
  ok(somaFila <= pg.orcamento,
     `D-A a fila (${somaFila}min) estourou o orçamento (${pg.orcamento}min)`);
  const porSem = {};
  pg.fila.forEach((i) => { porSem[i.semana] = (porSem[i.semana] || 0) + i.minutos; });
  Object.keys(porSem).forEach((k) => ok(porSem[k] <= 12 * 60,
    `D-A2 a semana ${k} recebeu ${porSem[k]}min, acima das 12h`));

  /* D-B — o que não cabe é CONTADO e NOMEADO, nunca escondido */
  ok(pg.fora.length > 0, "D-B 231 tópicos em 9 semanas deviam deixar gente de fora");
  ok(pg.fila.length + pg.fora.length === 231,
     `D-B1 a soma não fecha: ${pg.fila.length} + ${pg.fora.length} ≠ 231`);
  ok(pg.fora.every((i) => i.prioridade <= pg.fila[pg.fila.length - 1].prioridade),
     "D-B2 ficou de fora alguém com prioridade MAIOR que quem entrou");
  ok(pg.horasNecessarias > 12,
     "D-B3 devia dizer quantas horas cobririam tudo, e o número tem de ser maior");

  /* D-H — a régua do PESO. Contar tópicos trata Direito Penal (3 tópicos) e
   * Direito Constitucional (26) como iguais. Quem estuda os leves e quem
   * estuda os pesados veem a mesma porcentagem, e é a diferença entre as
   * duas medidas que diz se o esforço foi para o lugar certo. */
  const DOIS = ["@ Pesada :: 5", "+ A :: 5", "+ B :: 5",
                "@ Leve :: 1", "+ C :: 1", "+ D :: 1", "+ E :: 1", "+ F :: 1"].join("\n");
  const leves = P(DOIS, { horas: 12, prova: "2026-12-30", hoje: "2026-08-14",
    feitos: { "leve›c": "feito", "leve›d": "feito", "leve›e": "feito", "leve›f": "feito" } });
  const pesados = P(DOIS, { horas: 12, prova: "2026-12-30", hoje: "2026-08-14",
    feitos: { "pesada›a": "revisado", "pesada›b": "feito" } });
  ok(leves.feitos === 4 && pesados.feitos === 2, "D-H0 contagem de estudados errada");
  ok(leves.peso.pctFeito < 15,
     `D-H 4 tópicos leves não deviam valer ${leves.peso.pctFeito}% do peso`);
  ok(pesados.peso.pctFeito > 85,
     `D-H1 2 tópicos pesados deviam valer mais de 85%, deram ${pesados.peso.pctFeito}%`);
  ok(pesados.peso.pctFeito > leves.peso.pctFeito,
     "D-H2 estudar o pesado tem de render mais peso que estudar o leve");
  /* a inversão é o ponto: MENOS tópicos, MAIS prova coberta */
  ok(pesados.feitos < leves.feitos && pesados.peso.feito > leves.peso.feito,
     "D-H3 a régua do peso não inverteu a leitura da contagem");

  /* D-I — revisado é SUBCONJUNTO de estudado, nunca uma soma à parte */
  ok(pesados.revisados === 1, "D-I não contou o revisado");
  ok(pesados.revisados <= pesados.feitos, "D-I1 revisado passou de estudado");
  ok(pesados.peso.revisado <= pesados.peso.feito,
     "D-I2 o peso revisado passou do peso estudado");
  /* e o formato antigo (true) continua valendo: ninguém perde progresso */
  const velho = P(DOIS, { horas: 12, prova: "2026-12-30", hoje: "2026-08-14",
    feitos: { "pesada›a": true } });
  ok(velho.feitos === 1 && velho.revisados === 0,
     "D-I3 o progresso salvo no formato antigo se perdeu");

  /* D-J — o diagnóstico do PLANEJAMENTO. Não procura defeito de formato: um
   * edital pode estar impecavelmente escrito e ainda descrever um plano que
   * não decide nada, que foi o caso real das 17 disciplinas empatadas. */
  const dg = E.diagnosticoPlano(E.lerEdital(DOIS),
    P(DOIS, { horas: 1, prova: "2026-08-20", hoje: "2026-08-14", feitos: {} }));
  const ids = dg.map((a) => a.id);
  ok(dg.length > 0, "D-J o diagnóstico do plano não achou nada num plano ruim");
  ok(dg.every((a) => a.msg && a.msg.length > 20),
     "D-J1 achado sem mensagem legível não ajuda ninguém");
  ok(ids.includes("sem_motivo"), "D-J2 não notou a falta de motivo nos pesos");
  /* plano sem data é grave: sem ela não há como saber o que cabe */
  const semData = E.diagnosticoPlano(E.lerEdital("@ A :: 3\n+ x :: 3 :: pq"),
    P("@ A :: 3\n+ x :: 3 :: pq", { horas: 10, feitos: {} }));
  ok(semData.some((a) => a.id === "sem_data" && a.grave),
     "D-J3 plano sem data da prova devia ser apontado como grave");
  /* e um plano bem-feito não pode gerar alarme falso */
  const bom = "# X | prova: 2027-12-30 | horas: 20\n@ A :: 5\n+ x :: 5 :: cai sempre\n"
    + "+ y :: 3 :: cai as vezes\n@ B :: 2\n+ z :: 2 :: raro\n+ w :: 1 :: quase nunca";
  const limpo2 = E.diagnosticoPlano(E.lerEdital(bom),
    P(bom, { horas: 20, prova: "2027-12-30", hoje: "2026-08-14", feitos: {} }));
  ok(limpo2.filter((a) => a.grave).length === 0,
     "D-J4 plano bem-feito não pode acusar problema grave: "
     + limpo2.filter((a) => a.grave).map((a) => a.id).join(", "));

  /* D-K — o motivo GENÉRICO. No edital real, 139 de 232 tópicos voltaram com
   * "não localizei em provas anteriores" — a frase que o PRÓPRIO PROMPT
   * oferecia como saída. Pior que o campo vazio: silencia o detector de
   * motivo faltando e finge que a informação existe. */
  const GEN = ["# X | prova: 2026-12-30 | horas: 10", "@ A :: 5"]
    .concat(Array.from({ length: 8 }, (_, k) =>
      "+ t" + k + " :: 3 :: nao localizei em provas anteriores"))
    .concat(["+ bom :: 5 :: caiu na ultima prova do tce pe"]).join("\n");
  const dgen = E.diagnosticoPlano(E.lerEdital(GEN),
    P(GEN, { horas: 10, prova: "2026-12-30", hoje: "2026-08-14", feitos: {} }));
  const ach = dgen.find((a) => a.id === "motivo_generico");
  ok(!!ach, "D-K não detectou a justificativa genérica em massa");
  ok(/8 de 9/.test(ach.msg),
     `D-K1 a contagem pegou o tópico legítimo junto: "${ach.msg.slice(0, 60)}"`);
  /* o padrão curto "n/a" chegou a casar com o "na" de "caiu NA última prova" */
  ok(!/9 de 9/.test(ach.msg), "D-K2 o padrão voltou a ser curto demais");

  /* D-L — RITMO. O veredito "121 ficam de fora" encerra o assunto; ritmo
   * observado ao lado do necessário mostra o tamanho do ajuste, e sobre isso
   * dá para agir. */
  const RIT = ["# X | prova: 2026-10-16 | horas: 12", "@ A :: 5"]
    .concat(Array.from({ length: 100 }, (_, k) => "+ t" + k + " :: 4 :: pq")).join("\n");
  const pr = P(RIT, { horas: 12, prova: "2026-10-16", hoje: "2026-08-15", feitos: {} });
  const semDiario = E.ritmoDoPlano(pr, []);
  ok(semDiario.observadoMin === 0 && semDiario.semanasComRegistro === 0,
     "D-L sem diário não pode inventar ritmo observado");
  ok(semDiario.necessarioMin > 0 && semDiario.necessarioTop > 0,
     "D-L1 o ritmo necessário tem de existir mesmo sem histórico");
  const comDiario = E.ritmoDoPlano(pr, [
    { d: "2026-08-10", m: 60, a: "feito" }, { d: "2026-08-11", m: 120, a: "feito" },
    { d: "2026-08-14", m: 90, a: "revisado" },
    { d: "?", m: 999, a: "feito" },            /* backfill sem data: ignorado */
    { d: "2026-08-12", m: 999, a: "pendente" }, /* desmarcar não é estudo */
  ]);
  ok(comDiario.observadoMin > 0, "D-L2 não calculou o ritmo observado");
  ok(comDiario.observadoMin < 400,
     `D-L3 contou registro sem data ou desmarcação como estudo (${comDiario.observadoMin})`);
  ok(comDiario.razao < 1, "D-L4 a razão devia mostrar que o ritmo está abaixo");

  /* D-M — agenda: cada item da semana ganha dia e hora */
  const ag = E.agendar(E.semanaAtual(pr).slice(0, 6), { dias: 3, inicio: "19:00" });
  ok(ag.every((i) => i.dia && /^\d\d:\d\d$/.test(i.hora)),
     "D-M item da semana sem dia ou hora sugerida");
  ok(new Set(ag.map((i) => i.dia)).size > 1,
     "D-M1 tudo caiu no mesmo dia: a agenda não distribuiu");
  ok(ag[0].hora === "19:00", `D-M2 o primeiro devia começar às 19:00 (${ag[0].hora})`);

  /* D-N — o panorama por disciplina. Progresso médio esconde o que decide a
   * prova: 33% dos tópicos feitos pode ser 11% do peso, se os feitos forem
   * todos da matéria leve. A ordenação é pela FATIA AINDA NÃO ESTUDADA. */
  const PAN = ["# X | prova: 2026-12-30 | horas: 12", "@ Financeiro :: 5"]
    .concat(Array.from({ length: 10 }, (_, k) => "+ FIN" + k + " :: 5 :: pq"))
    .concat(["@ Civil :: 2"])
    .concat(Array.from({ length: 5 }, (_, k) => "+ CIV" + k + " :: 3 :: pq")).join("\n");
  const fz = {};
  for (let k = 0; k < 5; k++) fz["civil›civ" + k] = { e: "revisado", d: "2026-08-10" };
  const pp = P(PAN, { horas: 12, prova: "2026-12-30", hoje: "2026-08-15", feitos: fz });
  const pan = E.panoramaDisciplinas(pp);
  ok(pan[0].nome === "Financeiro",
     `D-N o topo devia ser a maior lacuna, veio "${pan[0].nome}"`);
  ok(pan[0].lacuna > pan[1].lacuna, "D-N1 a ordenação não seguiu a lacuna");

  /* O caso que separa "maior fatia" de "maior lacuna": a disciplina GRANDE
   * já está pronta e a PEQUENA está intocada. Ordenar por tamanho colocaria
   * a pronta em primeiro — que é exatamente a informação inútil. */
  const INV = ["# X | prova: 2026-12-30 | horas: 12", "@ Grande :: 5"]
    .concat(Array.from({ length: 12 }, (_, k) => "+ G" + k + " :: 5 :: pq"))
    .concat(["@ Pequena :: 3"])
    .concat(Array.from({ length: 3 }, (_, k) => "+ P" + k + " :: 4 :: pq")).join("\n");
  const fz2 = {};
  for (let k = 0; k < 12; k++) fz2["grande›g" + k] = { e: "feito", d: "2026-08-10" };
  const panInv = E.panoramaDisciplinas(
    P(INV, { horas: 12, prova: "2026-12-30", hoje: "2026-08-15", feitos: fz2 }));
  ok(panInv[0].nome === "Pequena",
     `D-N1b a disciplina pronta ficou em primeiro ("${panInv[0].nome}") — `
     + "a ordenação voltou a ser por tamanho");
  ok(panInv[0].fatia < panInv[1].fatia,
     "D-N1c o caso não está invertendo fatia e lacuna como devia");
  ok(pan.find((d) => d.nome === "Civil").lacuna === 0,
     "D-N2 disciplina 100% feita ainda aparece com lacuna");
  ok(pan[0].altaIntocada === 10, "D-N3 não contou os de alta prioridade parados");
  /* a inversão que justifica o painel: muitos tópicos feitos, pouco peso */
  ok(pp.feitos / pp.total > 0.3 && pp.peso.pctFeito < 0.2 * 100,
     "D-N4 o caso devia mostrar contagem alta e peso baixo");

  const crit = E.lacunasCriticas(pp, 5);
  ok(crit.length === 5 && crit.every((i) => !i.feito && i.faixa === "alta"),
     "D-N5 lacunas críticas trouxe item já feito ou de faixa baixa");
  ok(crit[0].bruto >= crit[4].bruto, "D-N6 as críticas não vieram por peso");

  /* D-C — tópico feito sai da fila */
  const feitoUm = {};
  feitoUm["única›tópico 1"] = true;
  const pf = P(GRANDE2, { horas: 12, prova: "2026-10-16", hoje: "2026-08-14", feitos: feitoUm });
  ok(pf.feitos === 1, `D-C não contou o tópico concluído (${pf.feitos})`);
  ok(!pf.fila.some((i) => i.nome === "Tópico 1"), "D-C1 o tópico feito continua na fila");

  /* D-F — todas as disciplinas com o mesmo peso é ausência de priorização */
  ok(E.temPesosIguais("@ A :: 3\n+ x :: 2\n@ B :: 3\n+ y :: 2\n@ C :: 3\n+ z :: 1"),
     "D-F não detectou que nenhuma disciplina foi diferenciada");
  ok(!E.temPesosIguais("@ A :: 5\n+ x :: 2\n@ B :: 3\n+ y :: 2\n@ C :: 3\n+ z :: 1"),
     "D-F1 acusou pesos iguais quando havia diferença");

  /* ---- ida e volta: texto -> estrutura -> texto ---- */
  const volta = E.edParaTexto(E.lerEdital(limpo));
  const r2 = E.lerEdital(volta);
  ok(nTop(r2) === nTop(r), "I-E7 ida e volta perdeu tópico");
  ok(r2.cfg.prova === r.cfg.prova, "I-E8 ida e volta perdeu a data da prova");
  ok(E.edParaTexto(r2) === volta, "I-E9 ida e volta não é estável na segunda passada");

  /* ---- semanas até a prova ---- */
  const s = E.semanasAte("2026-08-30", "2026-08-13");
  ok(s.dias === 17 && s.semanas === 2, `E14 contagem errada: ${JSON.stringify(s)}`);
  ok(E.semanasAte("") === null, "E15 sem data devia devolver null");
  ok(E.semanasAte("2020-01-01", "2026-08-13").semanas === 0,
     "E16 prova no passado devia dar 0 semanas, nunca negativo");

  /* ---- degenerados: a tela não pode quebrar ---- */
  ["", "   ", "@", "+", "::", "@ :: 9", "+ x :: abc", "# prova: banana"]
    .forEach((txt, i) => {
      let bateu = false;
      try {
        const rr = E.lerEdital(txt);
        E.montarPlano(rr, { horas: 10, prova: "2026-12-30", feitos: {} });
        E.edParaTexto(rr);
        bateu = true;
      } catch (e) { bateu = false; }
      ok(bateu, `E17.${i} quebrou com entrada degenerada: ${JSON.stringify(txt)}`);
    });

  /* peso fora da faixa é preso, não descartado */
  const forca = E.lerEdital("@ X :: 9\n+ Y :: 0");
  ok(forca.disciplinas[0].peso === 5, "E18 peso 9 devia ser preso em 5");
  ok(forca.disciplinas[0].topicos[0].peso === 1, "E19 peso 0 devia ser preso em 1");
  ok(forca.achados.filter((a) => a.tipo === "peso_fora").length === 2,
     "E20 o peso fora da faixa devia virar achado");

  return f;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "edital", 60000).then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\nedital: ${f.length} FALHA(S)\n`
    : "\nedital: leitura, pesos, prioridade e horas ok\n");
  process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
