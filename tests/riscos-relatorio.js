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
  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
