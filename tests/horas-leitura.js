/* (19.213.0) HORAS POR ASSUNTO QUE SE LÊ CERTO — a barra é a cobertura, não o tempo
 *
 * O que originou: com 47h12 "de 51h20" a coluna de Tributário parecia quase toda estudada, com 55 de 134 assuntos (41%).
 * O "de" era só o tempo que FALTAVA (encolhia a cada ramo cumprido) e o corte virava horas, então passar da linha parecia
 * "passei do corte" quando era só "gastei metade das horas".
 *
 *   HL1  a barra é assuntos cumpridos ÷ todos (com "38%" e "3/8 assuntos" no topo)
 *   HL2  o orçamento é FIXO: cumprir ramos não encolhe o planejado (o "de" antigo encolhia)
 *   HL3  o corte do bloco fica na régua da cobertura (50% dos assuntos), com a cor do estado: abaixo, apertado, ok
 *   HL4  o ritmo é estudo novo de sempre ÷ assuntos cumpridos (o período não muda), só com 3 ou mais cumpridos
 *   HL5  a frase-diagnóstico de cada coluna: ritmo e o que falta, "ainda não começou", horas sem assunto marcado, tudo cumprido
 *   HL6  o resumo do topo: a cobertura primeiro, o tempo concentrado além do peso, o que vale prova e não teve hora
 *   HL7  "não cabe até a prova": o que falta no ritmo real contra o tempo que sobra para a disciplina
 *   HL8  as horas viram apoio: total, fatia do tempo e a tira de estudo novo × revisão; a legenda diz o que é a barra
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const todos = (el, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((f) => { acc.push(f); todos(f, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^| )" + c + "( |$)").test(e.className || "");
  const d = (k) => { const x = new Date(); x.setDate(x.getDate() + k); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar(); api.hubIniciar();
  (api.editaisLista() || []).slice().forEach((x) => api.edApagar(x.id));
  const TXT = ["# Fiscal | prova: " + d(40) + " | horas: 20",
    "& Específicos | minimo: 50%",
    "@ Tributário :: 3",
    "+ ISS :: 5", "++ Fato gerador :: 5", "++ Base de cálculo :: 4", "++ Contribuinte :: 3", "++ Alíquota :: 3",
    "+ ICMS :: 5", "++ Não cumulatividade :: 5", "++ Substituição :: 4", "++ Imunidades :: 3",
    "+ Obrigação :: 4",
    "& Básicos | minimo: 50%",
    "@ Português :: 5", "+ Crase :: 3", "+ Regência :: 3",
    "@ Informática :: 4", "+ Redes :: 2"].join("\n");
  const ed = api.edCriar("Fiscal", TXT);
  api.hubAbrirEdital(ed.id);
  api.edRender();
  const plano0 = api.horDoAberto().plano;
  const iss = plano0.itens.find((i) => i.nome === "ISS"), redes = plano0.itens.find((i) => i.nome === "Redes");
  const rid = (nome) => iss.ramos.find((r) => r.nome === nome).id;
  const marcar = (nomes) => nomes.forEach((nm) => { api.edProgresso[iss.chave + "›#" + rid(nm)] = { e: "feito", d: d(-5) }; });
  /* o diário: 10h de estudo novo e 2h de revisão no ISS, 45 min em Redes sem marcar nada */
  api.edDiarioDefinir([
    { d: d(-5), c: iss.chave, a: "feito", m: 600, rm: [{ id: rid("Fato gerador") }, { id: rid("Base de cálculo") }, { id: rid("Contribuinte") }], cc: "Fiscal" },
    { d: d(-4), c: iss.chave, a: "revisado", m: 120, cc: "Fiscal" },
    { d: d(-3), c: redes.chave, a: "feito", m: 45, cc: "Fiscal" },
  ]);
  const mapa = (opc) => { const x = api.horDoAberto(); return api.horMapa(x.plano, x.diario, Object.assign({ minSemana: x.minSemana, diasProva: 40 }, opc || {})); };
  const trib = (m) => m.disciplinas.find((x) => x.nome === "Tributário");

  /* ---- HL2 (antes de marcar) ---- */
  const antes = trib(mapa());
  const deAntigo = (pl) => pl.itens.filter((i) => i.disciplina === "Tributário").reduce((a, i) => a + (i.ehRevisao ? i.minutos * 2 : i.minutos), 0);
  const deAntes = deAntigo(api.horDoAberto().plano);
  marcar(["Fato gerador", "Base de cálculo", "Contribuinte"]);
  const tb = trib(mapa());
  ok(tb.orcamentoMin > 0 && Math.abs(tb.orcamentoMin - antes.orcamentoMin) < 1e-9 && tb.planejadoMin === tb.orcamentoMin,
    "HL2 o orçamento é fixo: cumprir 3 ramos não muda o planejado: " + antes.orcamentoMin + " → " + tb.orcamentoMin);
  ok(deAntigo(api.horDoAberto().plano) < deAntes, "HL2b (a conta antiga, i.minutos, encolhia: " + deAntes + " → " + deAntigo(api.horDoAberto().plano) + ")");

  /* ---- HL1 ---- */
  ok(tb.unidades === 8 && tb.feitas === 3 && Math.abs(tb.coberturaPct - 37.5) < 1e-9, "HL1 cobertura = 3 de 8 assuntos (4 + 3 ramos + 1 tópico): " + tb.feitas + "/" + tb.unidades);
  api.$("btnEdHoras").onclick();
  api.$("horPeriodo").value = "tudo"; api.$("horPeriodo").onchange();
  const cols = todos(api.$("horCorpo")).filter((e) => cls(e, "hor-col"));
  const colT = cols.find((c) => /Tributário/.test(c.textContent));
  const cob = todos(colT).find((e) => cls(e, "hor-cob"));
  const topo = todos(colT).find((e) => cls(e, "hor-topo"));
  ok(cob && cob.style.height === "37.50%" && /^38%3\/8 assuntos$/.test(topo.textContent), "HL1b a barra é a cobertura (37.50%) e o topo diz '38%' e '3/8 assuntos': " + (cob && cob.style.height) + " | " + topo.textContent);

  /* ---- HL3 ---- */
  const corte = todos(colT).find((e) => cls(e, "hor-corte")), seguro = todos(colT).find((e) => cls(e, "hor-seguro"));
  ok(tb.cortePct === 50 && tb.seguroPct === 62.5 && tb.estado === "abaixo" && corte.style.bottom === "50.00%" && seguro.style.bottom === "62.50%" && cls(cob, "hor-cob-abaixo") && cls(corte, "hor-corte-risco"),
    "HL3 o corte na régua da cobertura: linha em 50%, folga em 62,5%, barra vermelha abaixo: " + corte.style.bottom + " / " + seguro.style.bottom + " / " + cob.className);
  marcar(["Alíquota"]);
  ok(trib(mapa()).estado === "apertado", "HL3b 4 de 8 (50%): passou do corte, abaixo da folga = apertado");
  api.edProgresso[plano0.itens.find((i) => i.nome === "Obrigação").chave] = { e: "feito", d: d(-1) };
  ok(trib(mapa()).estado === "ok", "HL3c 5 de 8 (62,5%): com a folga = ok");
  delete api.edProgresso[plano0.itens.find((i) => i.nome === "Obrigação").chave];
  delete api.edProgresso[iss.chave + "›#" + rid("Alíquota")];

  /* ---- HL4 ---- */
  const t3 = trib(mapa());
  ok(t3.ritmoMin === 200 && t3.estudoTudoMin === 600 && t3.faltaRitmoMin === 200 * 5 && Math.abs(t3.previstoMin - t3.orcamentoMin / 8) < 1e-9,
    "HL4 ritmo = 600 min de estudo ÷ 3 assuntos = 200 min; faltam 5 × 200: " + t3.ritmoMin + " / " + t3.faltaRitmoMin);
  const tp = trib(mapa({ desde: d(-1), dias: 7 }));
  ok(tp.estudoMin === 0 && tp.ritmoMin === 200, "HL4b com um período sem registros, as horas zeram mas o ritmo (de sempre) continua: " + tp.estudoMin + " / " + tp.ritmoMin);
  delete api.edProgresso[iss.chave + "›#" + rid("Contribuinte")];
  ok(trib(mapa()).ritmoMin === null, "HL4c com 2 assuntos cumpridos o ritmo não aparece (média sem base)");
  marcar(["Contribuinte"]);

  /* ---- HL5 ---- */
  const m = mapa();
  const dg = (nome) => api.horDiagnostico(m.disciplinas.find((x) => x.nome === nome));
  ok(dg("Tributário") === "3h20 por assunto (plano: " + api.horTexto(t3.previstoMin) + ") · faltam ~16h40 nesse ritmo", "HL5 Tributário: ritmo contra o plano e o que falta: " + dg("Tributário"));
  ok(dg("Português") === "ainda não começou" && dg("Informática") === "45min de estudo e nenhum assunto marcado como cumprido", "HL5b sem nada: 'ainda não começou'; horas sem marcar: avisa: " + dg("Informática"));
  ok(api.horDiagnostico({ pendentes: 0 }) === "tudo cumprido", "HL5c tudo cumprido");
  const pt1 = Object.assign({}, m.disciplinas.find((x) => x.nome === "Português"), { feitas: 1, estudoTudoMin: 30, ritmoMin: null, faltaPlanoMin: 90 });
  ok(api.horDiagnostico(pt1) === "faltam ~1h30 pelo plano", "HL5d com poucos cumpridos, o que falta vem do plano");
  ok(todos(colT).find((e) => cls(e, "hor-diag")).textContent === dg("Tributário"), "HL5e a frase aparece na coluna");

  /* ---- HL6 ---- */
  api.$("horPeriodo").onchange();
  const res = todos(api.$("horCorpo")).find((e) => cls(e, "hor-resumo"));
  ok(/^Cumpridos 3 de 11 assuntos \(27%\)\. Total: 12h45\./.test(res.textContent), "HL6 o resumo começa pela cobertura e depois o tempo: " + res.textContent.slice(0, 70));
  ok(m.concentradas.length === 1 && m.concentradas[0].nome === "Tributário" && /Tributário levou 94% das suas horas e vale [\d,]+% da prova\./.test(res.textContent),
    "HL6b o tempo concentrado além do peso: " + m.concentradas.map((x) => x.nome + " " + Math.round(x.tempoPct) + "% × " + Math.round(x.pesoPct) + "%").join(", "));
  ok(m.semHoras.map((x) => x.nome).join() === "Português" && /Sem nenhuma hora: Português \([\d,]+%\)\./.test(res.textContent), "HL6c o que vale prova e não teve hora nenhuma");
  const pouco = api.horMapa(api.horDoAberto().plano, [{ d: d(-1), c: redes.chave, a: "feito", m: 100 }], { minSemana: 1200 });
  ok(pouco.concentradas.length === 0, "HL6d abaixo de 5h no total, não acusa concentração");

  /* ---- HL7 ---- */
  ok(m.naoCabem.length === 0 && trib(m).dispMin > trib(m).faltaRitmoMin, "HL7 40 dias a 20h/semana: o que falta cabe (" + Math.round(trib(m).dispMin) + " min livres × " + trib(m).faltaRitmoMin + ")");
  const x = api.horDoAberto();
  const apertado = api.horMapa(x.plano, x.diario, { minSemana: 60, diasProva: 7 });
  ok(trib(apertado).naoCabe === true && apertado.naoCabem.some((y) => y.nome === "Tributário"), "HL7b 1h/semana e 7 dias: não cabe");
  ok(api.t("hor_alerta_cabe") === "não cabe até a prova" && /não cabe até a prova: /.test(api.t("hor_res_nao_cabe", { l: "X" })), "HL7c os textos do aviso");

  /* ---- HL8 ---- */
  const horas = todos(colT).find((e) => cls(e, "hor-horas"));
  ok(horas.textContent === "12h · 94% do tempo", "HL8 as horas embaixo: total e fatia do tempo: " + horas.textContent);
  const tira = todos(colT).find((e) => cls(e, "hor-tira-in"));
  const est = todos(tira).find((e) => cls(e, "hor-est")), rev = todos(tira).find((e) => cls(e, "hor-rev"));
  ok(tira.style.width === "100.00%" && Math.abs(parseFloat(est.style.width) - 600 / 720 * 100) < 0.01 && Math.abs(parseFloat(rev.style.width) - 120 / 720 * 100) < 0.01,
    "HL8b a tira: a maior disciplina enche, dentro estudo novo × revisão: " + tira.style.width + " / " + est.style.width + " / " + rev.style.width);
  const leg = todos(api.$("horCorpo")).find((e) => cls(e, "hor-legenda")).textContent;
  ok(/assuntos cumpridos/.test(leg) && /corte do bloco \(% dos assuntos\)/.test(leg) && !/horas planejadas/.test(leg) && !/horas até o corte/.test(leg), "HL8c a legenda diz o que é a barra: " + leg);
  ok(/A barra é quanto do conteúdo você já cumpriu/.test(api.t("hor_sub")), "HL8d o texto de cima explica a barra");
  api.$("dlgHoras").close();
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
if (require.main === module) testes().then((falhas) => { console.log(falhas.quantas + " verificações, " + falhas.length + " falhas"); falhas.forEach((f) => console.log("  ✗ " + f)); process.exit(falhas.length ? 1 : 0); });
