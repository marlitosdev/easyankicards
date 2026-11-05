/* =====================================================================
 * RISCOS DE CORTE E O RELATÓRIO DE DIAGNÓSTICO (19.71.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  R1 o painel se chama "Acompanhamento dos riscos de corte deste edital" e diz o estado logo abaixo;
 *  R2 a discursiva entra no painel: cobertura das disciplinas dela × mínimo, treino de escrita, "só os N primeiros";
 *  R3 edital só com discursiva (sem blocos) também ganha o painel;
 *  D1 o relatório do Raio-X começa com o pedido à IA;
 *  D2 ele leva pontuação (exata/híbrida/estimada e discursiva), riscos de corte, buracos, tempo real, deixado de lado,
 *     revisões, materiais e o que ainda é estimativa.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const prova = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();
  const T = ["# Riscos | prova: " + prova + " | horas: 10",
    "# discursiva | pontos: 40 | objetiva: 90 | minimo: 50% | linhas: 25-30 | corrigida: 50 | disciplinas: Tributário",
    "& Específicos | minimo: 50%", "@ Tributário :: 5", "+ a :: 5", "+ b :: 4", "@ Administrativo :: 4", "+ c :: 4",
    "& Português | minimo: 50%", "@ Português :: 20p", "+ d :: 3", "@ Lógica :: 5p", "+ e :: 3"].join("\n");
  const r = api.lerEdital(T);
  const p = api.montarPlano(r, { horas: 10, feitos: { "tributário›a": "feito" } });

  const rd = api.edRiscoDiscursiva(p, "x");
  ok(rd && rd.pontos === 40 && rd.minPct === 50 && rd.corrigida === 50 && rd.disciplinas.join() === "Tributário", "R2a o risco da discursiva é calculado: " + JSON.stringify(rd));
  ok(rd.cobertura > 0 && rd.cobertura < 100 && rd.abaixo === (rd.cobertura < 50) && rd.semTreino === true, "R2b cobertura das disciplinas dela e treino zerado: " + rd.cobertura);

  const cx = api.edPintarBlocos(p);
  const txt = (cx && cx.textContent) || "";
  ok(/Acompanhamento dos riscos de corte deste edital/.test(txt), "R1 o painel tem o nome novo: " + txt.slice(0, 120));
  ok(/de 3 corte\(s\) acompanhados|Todos os 3 corte/.test(txt), "R1b o estado conta blocos e discursiva: " + txt.slice(0, 200));
  ok(/Discursiva/.test(txt) && /vale 31% da nota final/.test(txt) && /Nenhum treino de escrita/.test(txt) && /Só os 50 primeiros/.test(txt), "R2c a linha da discursiva no painel: " + txt.slice(-400));

  const T2 = ["# So disc | prova: " + prova + " | horas: 10", "# discursiva | pontos: 30 | objetiva: 70 | minimo: 40% | disciplinas: A", "@ A :: 5", "+ x :: 5", "@ B :: 3", "+ y :: 3"].join("\n");
  const cx2 = api.edPintarBlocos(api.montarPlano(api.lerEdital(T2), { horas: 10, feitos: {} }));
  ok(cx2 && /Discursiva/.test(cx2.textContent || ""), "R3 sem blocos, só com a discursiva, o painel aparece");

  const rel = api.plRelatorio(p, r, [], [], r.cfg);
  ok(/^PEDIDO: Voce e um orientador de estudos/.test(rel) && /o que estou deixando de lado/.test(rel), "D1 o relatório começa com o pedido à IA");
  ok(/== PONTUACAO ==/.test(rel) && /HIBRIDA/.test(rel) && /Português \| 20 pontos/.test(rel) && /discursiva: 40 pontos \(objetiva 90\)/.test(rel) && /corrigida so para os 50 primeiros/.test(rel), "D2a pontuação, híbrida e discursiva");
  ok(/== RISCOS DE CORTE/.test(rel) && /bloco Específicos \| corte 50%/.test(rel) && /- Tributário: cobertura/.test(rel) && /discursiva \| corte 50%/.test(rel), "D2b riscos de corte (blocos e discursiva)");
  ok(/== BURACOS/.test(rel) && /Tributário \| \d+% \| \d+% \| \d+%/.test(rel), "D2c buracos por disciplina");
  ok(/== TEMPO REAL/.test(rel) && /== DEIXADO DE LADO ==/.test(rel) && /ramos pulados/.test(rel) && /tirados da agenda por voce/.test(rel), "D2d tempo real e deixado de lado");
  ok(/== REVISOES ==/.test(rel) && /== MATERIAIS POR DISCIPLINA ==/.test(rel) && /== O QUE AINDA E ESTIMATIVA/.test(rel), "D2e revisões, materiais e o que é estimativa");
  ok(/== POR DISCIPLINA ==/.test(rel) && /== SEMANA 1, NA ORDEM ==/.test(rel), "D2f o que já existia continua");
  /* ---- (19.73.0) S: a tela das Discursivas e a ordem do menu ---- */
  {
    const ids = api.MODOS.map((m) => m.id);
    ok(ids.slice(0, 4).join() === "edital,cartoes,discursivas,questoes" && !!api.$("secDiscursivas"), "S1 menu: edital, cartões, discursivas, questões; a seção existe");
    const e1 = api.edCriar("Com discursiva", T);
    const e2 = api.edCriar("Sem discursiva", ["# Sem | prova: " + prova + " | horas: 5", "@ A :: 3", "+ x :: 3"].join("\n"));
    api.trocarModo("discursivas");
    const txt = String(api.$("dsLista").textContent || "");
    ok(/Com discursiva/.test(txt) && /vale 40 pontos/.test(txt) && /31% da nota final/.test(txt) && /25 a 30 linhas/.test(txt) && /corrigida só para os 50 primeiros/.test(txt), "S2 o cartão do edital mostra como a discursiva pontua: " + txt.slice(0, 300));
    ok(/Treino de escrita/.test(txt) && /Nenhum treino nas últimas 4 semanas/.test(txt), "S3 treino de escrita das últimas semanas");
    ok(/Editais sem discursiva cadastrada \(1\)/.test(txt) && /Sem discursiva/.test(txt), "S4 o edital sem discursiva aparece com o atalho para cadastrar");
    const ck = api.$("dsTreino_" + e1.id);
    ck.checked = true; ck.onchange();
    ok(/Treinou em 1 das últimas 4 semanas/.test(String(api.$("dsLista").textContent || "")), "S5 marcar o treino da semana conta");
    const pr = api.dsPromptTemas(e1, api.dsDiscursivaDe(e1).dc);
    ok(/3 temas prováveis/.test(pr) && /ESPELHO DE CORREÇÃO/.test(pr) && /25 a 30 linhas/.test(pr) && /Tributário/.test(pr), "S6 o pedido de temas à IA leva o formato desta prova");
    /* ---- (19.74.0) o registro das redações ---- */
    const dc = api.dsDiscursivaDe(e1).dc;
    ok(api.dsRedacaoAdicionar(e1.id, { tema: "", nota: 10, max: 40 }).erro && api.dsRedacaoAdicionar(e1.id, { tema: "x", nota: 50, max: 40 }).erro, "S7 sem tema ou com nota acima da máxima não grava");
    const hoje = new Date();
    const dia = (k) => { const d = new Date(hoje); d.setDate(d.getDate() - k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    [[30, 12, 26], [24, 16, 31], [17, 18, 28], [10, 24, 27], [3, 28, 40], [0, 30, 29]].forEach(([k, nota, lin]) => api.dsRedacaoAdicionar(e1.id, { d: dia(k), tema: "Tema " + k, nota, max: 40, linhas: lin, disc: "Tributário" }));
    const rr = api.dsRedacoesResumo(e1.id, dc);
    ok(rr.n === 6 && rr.media5 === 58 && rr.tendencia === "subindo", "S8 média das últimas 5 e tendência: " + JSON.stringify(rr));
    ok(rr.abaixo === 3 && rr.fora === 2 && rr.ultima.tema === "Tema 0", "S9 abaixo do mínimo, fora do tamanho e a última: " + JSON.stringify(rr));
    ok(JSON.parse(api.loja.getItem("eac_disc_treino") || "{}")[e1.id] && Object.keys(JSON.parse(api.loja.getItem("eac_disc_treino"))[e1.id]).length >= 5, "S10 registrar a redação marca a semana como treinada");
    api.dsRender();
    const tx2 = String(api.$("dsLista").textContent || "");
    ok(/Redações escritas \(6\)/.test(tx2) && /média das últimas 5: 58%/.test(tx2) && /3 redação\(ões\) abaixo do mínimo/.test(tx2) && /2 fora do tamanho/.test(tx2), "S11 a tela mostra o histórico e os alertas");
    api.dsRedacaoApagar(e1.id, api.dsRedacoes(e1.id)[0].id);
    ok(api.dsRedacoes(e1.id).length === 5, "S12 apagar tira do registro");
    const relD = api.plRelatorio(api.montarPlano(api.lerEdital(T), { horas: 10, feitos: {} }), api.lerEdital(T), [], [], api.lerEdital(T).cfg);
    ok(/redacoes escritas: 0|redacoes escritas:/.test(relD), "S13 o Raio-X tem a linha das redações");
    const todas = [];
    Object.keys(api.BK_CHAVES).forEach((g) => api.BK_CHAVES[g].forEach((k) => todas.push(k)));
    ok(["eac_disc_treino", "eac_disc_redacoes", "eac_ed_conferencia", "eac_ag_modo", "eac_ag_meta_min", "eac_ger_pastas"].every((k) => todas.indexOf(k) >= 0), "S14 o backup leva o treino, as redações e as decisões do plano");
    api.edApagar(e1.id); api.edApagar(e2.id);
  }
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
