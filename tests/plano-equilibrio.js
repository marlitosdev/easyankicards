/* =====================================================================
 * O RODÍZIO COM MEMÓRIA E O RITMO DE VERDADE (19.47.0)
 *
 * O RELATO (30/10): "ao terminar um assunto de tributário, o sistema me joga outro, atrapalhando as outras
 * disciplinas". O raio-X: Tributário com 2.507 min, todas as outras com zero; plano com 25h/semana, diário com ~10h30.
 *
 * O QUE PRECISA SER VERDADE:
 *  E1 sem estudo recente (ou menos de 1h), o rodízio abre pela maior fatia da prova, como sempre;
 *  E2 com estudo recente, a rodada abre pela disciplina mais atrasada (fatia da prova − fatia do tempo);
 *  E3 a disciplina estudada HOJE não abre a rodada seguinte, mesmo sendo a mais atrasada;
 *  E4 edTempoRecente lê o diário dos últimos 14 dias, só das disciplinas do edital, sem "pendente";
 *  E5 a revisão vencida (com data) vem primeiro DENTRO da disciplina; na agenda ela não fura o rodízio;
 *  E6 o ritmo real: média das últimas semanas fechadas; abaixo de 75% do plano a agenda avisa e oferece planejar com ele;
 *  E7 o raio-X mostra o equilíbrio e diz se ele ordena o rodízio.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const HOJE = "2026-10-30";
  const EDITAL = "# Teste | prova: 2026-11-29 | horas: 25\n@ Tributário :: 5\n+ Fato gerador :: 5\n+ Lançamento :: 5\n+ Crédito :: 4\n@ Português :: 4\n+ Leitura :: 5\n+ Conectivos :: 4\n@ Administrativo :: 4\n+ Atos :: 5\n+ Licitações :: 4";
  const { api } = rodar();
  const r = api.lerEdital(EDITAL);
  const base = { horas: 25, prova: "2026-11-29", hoje: HOJE, feitos: {}, andamento: {}, acertosTopico: null, acertos: null };
  const disc0 = (p) => p.fila[0] && p.fila[0].disciplina;

  /* ---- E1 ---- */
  const p0 = api.montarPlano(r, Object.assign({}, base, { tempoRecente: null }));
  ok(disc0(p0) === "Tributário", "E1 sem estudo recente, abre pela maior fatia: " + disc0(p0));
  const p0b = api.montarPlano(r, Object.assign({}, base, { tempoRecente: { min: { "Tributário": 30 }, total: 30, hoje: "", dias: 14 } }));
  ok(disc0(p0b) === "Tributário", "E1b menos de 1h registrada nao e amostra: o rodizio fica como era");

  /* ---- E2 ---- */
  const so = { min: { "Tributário": 2507, "Português": 0, "Administrativo": 0 }, total: 2507, hoje: "", dias: 14 };
  const p1 = api.montarPlano(r, Object.assign({}, base, { tempoRecente: so }));
  const ordemR1 = p1.fila.filter((i) => i.rodada === 1).map((i) => i.disciplina);
  ok(ordemR1[0] === "Português" && ordemR1[ordemR1.length - 1] === "Tributário", "E2 so Tributario estudado: a rodada abre por Portugues e Tributario vai para o fim: " + ordemR1.join(" > "));
  ok(p1.equilibrio[0].disciplina === "Português" && p1.equilibrio.find((x) => x.disciplina === "Tributário").tempo === 100, "E2b o equilibrio vem do mais atrasado para o mais adiantado: " + JSON.stringify(p1.equilibrio.map((x) => [x.disciplina, x.prova, x.tempo])));
  ok(p1.fila[0].equilibrio && p1.fila[0].equilibrio.desvio < 0, "E2c o item leva o equilibrio da disciplina (para a tela dizer por que veio agora)");

  /* ---- E3 ---- */
  const p2 = api.montarPlano(r, Object.assign({}, base, { tempoRecente: Object.assign({}, so, { hoje: "Português" }) }));
  ok(disc0(p2) === "Administrativo" && p2.fila[1].disciplina === "Português", "E3 a disciplina de hoje nao abre a rodada seguinte: " + p2.fila.slice(0, 3).map((i) => i.disciplina).join(" > "));

  /* ---- E4 ---- */
  const diario = [
    { d: "2026-10-30", disc: "Tributário", m: 120 },
    { d: "2026-10-20", disc: "tributário", m: 60 },
    { d: "2026-10-10", disc: "Tributário", m: 500 },          /* fora dos 14 dias */
    { d: "2026-10-29", disc: "Português", m: 45, a: "pendente" },
    { d: "2026-10-29", disc: "Química", m: 90 },              /* outro edital */
  ];
  const tr = api.edTempoRecente(diario, ["Tributário", "Português", "Administrativo"], HOJE);
  ok(tr.total === 180 && tr.min["Tributário"] === 180 && tr.min["Português"] === 0 && tr.hoje === "Tributário", "E4 o diario dos ultimos 14 dias, so deste edital: " + JSON.stringify(tr));

  /* ---- E5 ---- */
  const feitos = { "tributário›fato gerador": { e: "feito", d: "2026-10-01" } };
  const p3 = api.montarPlano(r, Object.assign({}, base, { feitos, tempoRecente: null }));
  const trib = p3.fila.filter((i) => i.disciplina === "Tributário");
  ok(trib[0] && trib[0].ehRevisao && trib[0].nome === "Fato gerador", "E5 a revisao vencida vem primeiro dentro da disciplina: " + trib.map((i) => i.nome + (i.ehRevisao ? "(rev)" : "")).join(", "));
  const L = [{ nome: "nova", ordemFila: 1, ordem: 9 }, { nome: "rev", ehRevisao: true, ordemFila: 4, ordem: 5 }];
  ok(L.sort(api.hubOrdemAgenda).map((x) => x.nome).join(",") === "nova,rev", "E5b na agenda a revisao nao fura o rodizio");

  /* ---- E6 ---- */
  {
    const semanas = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"].map((d) => ({ d, disc: "Tributário", m: 600, a: "estudou" }));
    const { api: a2 } = rodar({ lojaInicial: { eac_edital_diario: JSON.stringify(semanas.concat([{ d: "2026-10-30", disc: "Tributário", m: 30, a: "estudou" }])) } });
    a2.carregarDiario();
    const rt = a2.hubRitmoReal();
    ok(rt.semanas >= 2 && rt.min > 0, "E6 o ritmo real sai das semanas fechadas do diario: " + JSON.stringify(rt));
    ok(a2.hubRitmoRealLigado() === false, "E6a por padrao o plano usa as horas do edital");
    a2.hubRitmoRealDefinir(true);
    ok(a2.hubRitmoRealLigado() === true && a2.loja.getItem("eac_ag_ritmo_real") === "1", "E6b a escolha de planejar com o ritmo real fica guardada");
  }

  /* ---- E7 ---- */
  const rel = api.plRelatorio(p1, r, [], [], { concurso: "Teste" });
  ok(/EQUILIBRIO PROVA x TEMPO/.test(rel) && /ORDENA O RODIZIO/.test(rel) && /Português \| \d+% \| 0%/.test(rel), "E7 o raio-X mostra o equilibrio e diz que ele ordena o rodizio");

  /* ---- M: o modo de estudo (19.48.0) ---- */
  {
    ok(api.edModoAuto(120) === "avancar" && api.edModoAuto(45) === "equilibrado" && api.edModoAuto(20) === "consolidar" && api.edModoAuto(null) === "equilibrado",
      "M1 automatico segue a data: >90 avancar, 30-90 equilibrado, <30 consolidar");
    /* Tributário: Fato gerador feito há 10 dias (revisão vencida, sem estar MUITO atrasada), Lançamento e Crédito novos */
    const fe = { "tributário›fato gerador": { e: "feito", d: "2026-10-20" } };
    const trib = (p) => p.fila.filter((i) => i.disciplina === "Tributário").map((i) => i.nome + (i.ehRevisao ? "(rev)" : ""));
    const pA = api.montarPlano(r, Object.assign({}, base, { feitos: fe, tempoRecente: null, modos: { geral: "avancar", disc: {} } }));
    ok(trib(pA)[0] === "Fato gerador(rev)" || trib(pA).indexOf("Fato gerador(rev)") >= 0, "M2 avancar: a revisao continua na fila, pelo peso: " + trib(pA).join(", "));
    const pE = api.montarPlano(r, Object.assign({}, base, { feitos: fe, tempoRecente: null, modos: { geral: "equilibrado", disc: {} } }));
    ok(trib(pE).join(",") === "Lançamento,Crédito,Fato gerador(rev)", "M3 equilibrado: dois novos, depois a revisao: " + trib(pE).join(", "));
    const pC = api.montarPlano(r, Object.assign({}, base, { feitos: fe, tempoRecente: null, modos: { geral: "consolidar", disc: {} } }));
    ok(trib(pC)[0] === "Fato gerador(rev)", "M4 consolidar: a revisao primeiro: " + trib(pC).join(", "));
    const lanc = pC.fila.find((i) => i.nome === "Lançamento");
    ok(lanc && lanc.minutosAntesModo && lanc.minutos < lanc.minutosAntesModo, "M5 consolidar: o novo de peso alto entra com sessao mais curta");
    const pD = api.montarPlano(r, Object.assign({}, base, { feitos: fe, tempoRecente: null, modos: { geral: "consolidar", disc: { "Tributário": "avancar" } } }));
    ok(pD.modos["Tributário"].modo === "avancar" && !pD.modos["Tributário"].auto && pD.modos["Português"].modo === "consolidar", "M6 o modo por disciplina vence o geral");
    const pAuto = api.montarPlano(r, Object.assign({}, base, { feitos: fe, tempoRecente: null, modos: { geral: "auto", disc: {} } }));
    ok(pAuto.modoSugerido === "consolidar" && pAuto.modos["Tributário"].modo === "consolidar" && pAuto.modos["Tributário"].auto, "M7 a 30 dias da prova o automatico consolida: " + pAuto.modoSugerido);
    /* a trava: revisão MUITO atrasada vem antes mesmo no avançar */
    const velho = { "tributário›crédito": { e: "feito", d: "2026-08-01" } };
    const pT = api.montarPlano(r, Object.assign({}, base, { feitos: velho, tempoRecente: null, modos: { geral: "avancar", disc: {} } }));
    ok(trib(pT)[0] === "Crédito(rev)", "M8 revisao muito atrasada fura a vez em qualquer modo: " + trib(pT).join(", "));
    const pSem = api.montarPlano(r, Object.assign({}, base, { feitos: fe, tempoRecente: null }));
    ok(pSem.modos === null && !pSem.fila.some((i) => i.modoRitmo), "M9 sem o.modos, a ordem e a de sempre");
    /* a escolha fica guardada */
    api.hubModoDefinir("", "consolidar"); api.hubModoDefinir("Português", "avancar");
    const g = api.hubModosLer();
    ok(g.geral === "consolidar" && g.disc["Português"] === "avancar", "M10 o modo escolhido fica guardado (geral e por disciplina)");
    api.hubModoDefinir("Português", "geral");
    ok(!api.hubModosLer().disc["Português"], "M11 'como o geral' tira o modo proprio da disciplina");
  }

  /* textos */
  ["hub_modo_rot", "hub_modo_auto", "hub_modo_avancar", "hub_modo_equilibrado", "hub_modo_consolidar", "hub_modo_tip_avancar", "hub_modo_tip_equilibrado", "hub_modo_tip_consolidar", "hub_modo_por_disc", "hub_modo_como_geral", "hub_modo_selo_rev", "hub_modo_selo_curta", "hub_ritmo_aviso", "hub_ritmo_usar", "hub_ritmo_usando", "hub_ritmo_voltar", "hub_ritmo_tip", "hub_equil_rot", "hub_equil_item", "hub_equil_tip", "hub_atraso_sinal", "hub_atraso_tip"].forEach((k) => {
    ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
  });
  api.setLanguage("pt");

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
