/* =====================================================================
 * TÓPICO EM ANDAMENTO NÃO SOME DA AGENDA (v19.28.0)
 *
 * O RELATO (27/10): "uma disciplina desapareceu da agenda da semana. Estava fazendo questões ontem mas não terminei.
 * Também li parte do resumo. Hoje a disciplina não apareceu e tem duas revisões do lugar dela." No backup:
 * "Administração tributária municipal" com 4/35 questões numa rodada aberta e 7 seções do resumo lidas em 25–26/10,
 * nada no diário; duas revisões de Sistema Tributário venceram e o tópico caiu para a 3ª rodada.
 *
 * O QUE PRECISA SER VERDADE:
 *  A1 edAndamentoPorTopico conta a última rodada de questões (com respostas) e as seções lidas dos últimos 7 dias;
 *     o que é velho, futuro ou sem resposta não conta;
 *  A2 no plano, o tópico em andamento vem PRIMEIRO na disciplina dele, antes das revisões vencidas; sem andamento,
 *     a ordem de antes (revisão primeiro);
 *  A3 tópico já registrado como estudado não vira "em andamento";
 *  A4 na agenda ele vem antes das revisões e mostra o selo com o que já foi feito; o Raio-X diz "(em andamento)".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api } = rodar();
  const HOJE = "2026-10-27";
  const K = "sistema tributário brasileiro›administração tributária municipal";

  /* ---- A1 ---- */
  const hist = [
    { q: "2026-10-24T09:00:00.000Z", fim: "2026-10-24T09:30:00.000Z", filtro: { chave: K }, feitas: 2, total: 10 },
    { q: "2026-10-26T15:25:06.697Z", fim: "", filtro: { chave: K }, escopo: "topico:" + K, feitas: 4, total: 35 },
    { q: "2026-10-26T13:35:51.948Z", fim: "2026-10-26T14:00:00Z", filtro: { chave: "sistema tributário brasileiro›crédito tributário" }, feitas: 27, total: 27 },
    { q: "2026-10-10T10:00:00Z", fim: "", filtro: { chave: "português›crase" }, feitas: 5, total: 20 },
    { q: "2026-10-26T10:00:00Z", fim: "", escopo: "topico:português›conectivos", feitas: 0, total: 20 },
  ];
  const lidas = {
    [K]: { "ramo a#1": { em: "2026-10-25" }, "ramo b#1": { em: "2026-10-26" }, "ramo c#1": { em: "2026-09-01" } },
    "português›regência verbal e nominal": { "x#1": { em: "2026-10-29" } },
  };
  const and = api.edAndamentoPorTopico(hist, lidas, HOJE);
  ok(and[K] && and[K].qFeitas === 4 && and[K].qTotal === 35 && and[K].qAberta === true && and[K].secoes === 2 && and[K].ultimo === "2026-10-26",
    "A1 rodada aberta + seções recentes: " + JSON.stringify(and[K]));
  ok(!and["português›crase"], "A1a rodada de 17 dias atrás não conta");
  ok(!and["português›conectivos"], "A1b rodada sem nenhuma resposta não conta");
  ok(!and["português›regência verbal e nominal"], "A1c data no futuro não conta");
  ok(and["sistema tributário brasileiro›crédito tributário"] && and["sistema tributário brasileiro›crédito tributário"].qAberta === false, "A1d rodada terminada também conta (o plano decide pelo registro)");
  /* registrado no diário no dia da atividade (ou depois): resolvido, não é "em andamento" — o caso de "Lançamento" */
  const comDiario = api.edAndamentoPorTopico(hist, lidas, HOJE, [
    { d: "2026-10-26", c: "sistema tributário brasileiro›crédito tributário", a: "revisado" },
    { d: "2026-10-25", c: K, a: "feito" }]);
  ok(!comDiario["sistema tributário brasileiro›crédito tributário"], "A1e registrado no mesmo dia: sai do andamento");
  ok(comDiario[K] && comDiario[K].qFeitas === 4, "A1f registro ANTERIOR à última atividade: continua em andamento");

  /* ---- A2–A3: uma miniatura do edital ---- */
  const EDITAL = ["# ISS teste | prova: 2026-11-29 | horas: 25",
    "@ Sistema Tributário Brasileiro :: 5",
    "+ Suspensão, extinção e exclusão do crédito tributário :: 5",
    "+ Limitações ao poder de tributar :: 5",
    "+ Administração tributária municipal :: 5",
    "+ Processo administrativo fiscal :: 5",
    "@ Português :: 4",
    "+ Crase :: 5"].join("\n");
  const r = api.lerEdital(EDITAL);
  const feitos = {
    "sistema tributário brasileiro›suspensão, extinção e exclusão do crédito tributário": { e: "feito", d: "2026-10-10" },
    "sistema tributário brasileiro›limitações ao poder de tributar": { e: "feito", d: "2026-10-01" },
  };
  const stb = (p) => p.fila.filter((i) => i.disciplina === "Sistema Tributário Brasileiro").map((i) => i.nome + (i.ehRevisao ? "↻" : "") + (i.andamento ? "▶" : ""));
  const base = { horas: 25, prova: "2026-11-29", feitos, fatores: {} };
  const sem = api.montarPlano(r, Object.assign({}, base, { andamento: {} }));
  ok(/↻$/.test(stb(sem)[0]) && /↻$/.test(stb(sem)[1]) && stb(sem).indexOf("Administração tributária municipal") > 1,
    "A2 sem andamento: as revisões vencidas primeiro (o comportamento de antes): " + stb(sem).join(" > "));
  const com = api.montarPlano(r, Object.assign({}, base, { andamento: and }));
  ok(stb(com)[0] === "Administração tributária municipal▶", "A2a em andamento: primeiro da disciplina, antes das revisões: " + stb(com).join(" > "));
  const iA = com.fila.filter((i) => i.nome === "Administração tributária municipal")[0];
  ok(iA.andamento && iA.andamento.qFeitas === 4 && (iA.rodada === 1 || com.fila.indexOf(iA) === 0), "A2b leva o que já foi feito e entra na 1ª rodada");
  const reg = api.montarPlano(r, Object.assign({}, base, { andamento: and,
    feitos: Object.assign({}, feitos, { [K]: { e: "feito", d: "2026-10-27" } }) }));
  ok(!reg.fila.some((i) => i.andamento), "A3 registrado como estudado: nada em andamento");
  /* já estudado, com revisão vencida e atividade nesta semana: continua REVISÃO (não vira "em andamento") */
  const KS = "sistema tributário brasileiro›suspensão, extinção e exclusão do crédito tributário";
  const comRev = api.montarPlano(r, Object.assign({}, base, { andamento: { [KS]: { qFeitas: 3, qTotal: 10, secoes: 0 } } }));
  const iS = comRev.fila.filter((i) => i.topicoChave === KS)[0];
  ok(iS && iS.ehRevisao && !iS.andamento, "A3a estudado com revisão vencida não vira em andamento: " + JSON.stringify(iS && { rev: iS.ehRevisao, and: iS.andamento }));

  /* ---- A5: o plano lê sozinho o histórico GRAVADO (a aba de questões não precisa ter sido aberta) ---- */
  {
    const { api: a2 } = rodar({ lojaInicial: { eac_qs_hist: JSON.stringify(hist), eac_mat_lidas: JSON.stringify(lidas) } });
    ok(a2.qhLerGravado().length === 5, "A5 o histórico gravado é lido sem abrir a aba");
    const p = a2.montarPlano(a2.lerEdital(EDITAL), Object.assign({}, base, { hoje: HOJE }));
    const it = p.fila.filter((i) => i.nome === "Administração tributária municipal")[0];
    ok(it && it.andamento && it.andamento.qFeitas === 4 && it.andamento.secoes === 2, "A5a sem passar nada, o plano acha o andamento no que está gravado: " + JSON.stringify(it && it.andamento));
  }
  /* ---- A5b: com o registro do mesmo tópico no diário gravado, o plano (sozinho) não o põe em andamento ---- */
  {
    const diario = [{ d: "2026-10-27", c: K, n: "Administração tributária municipal", disc: "Sistema Tributário Brasileiro", m: 60, a: "feito" }];
    const { api: a3 } = rodar({ lojaInicial: { eac_qs_hist: JSON.stringify(hist), eac_mat_lidas: JSON.stringify(lidas), eac_edital_diario: JSON.stringify(diario) } });
    a3.carregarDiario();
    const p = a3.montarPlano(a3.lerEdital(EDITAL), Object.assign({}, base, { hoje: HOJE }));
    const it = p.fila.filter((i) => i.nome === "Administração tributária municipal")[0];
    ok(it && !it.andamento, "A5b registrado hoje no diário: o plano não o põe em andamento: " + JSON.stringify(it && it.andamento));
  }
  /* ---- A6: a ordem da agenda — em andamento, depois revisão, depois o rodízio ---- */
  {
    const L = [{ nome: "nova", ordemFila: 1, ordem: 9 }, { nome: "rev", ehRevisao: true, ordemFila: 2, ordem: 5 },
      { nome: "andamento", andamento: { qFeitas: 4 }, ordemFila: 15, ordem: 1 }, { nome: "rev2", ehRevisao: true, ordemFila: 8, ordem: 5 }];
    ok(L.slice().sort(api.hubOrdemAgenda).map((x) => x.nome).join(",") === "andamento,rev,rev2,nova", "A6 agenda: em andamento antes das revisões: " + L.slice().sort(api.hubOrdemAgenda).map((x) => x.nome).join(","));
  }

  /* ---- A4: o selo na linha e o Raio-X ---- */
  const li = api.edLinhaTopico(iA);
  const selo = (function ach(e) { if ((e.className || "") === "ed-selo-andamento") return e; for (const c of Array.from(e.children || [])) { const x = ach(c); if (x) return x; } return null; })(li);
  api.setLanguage("pt");
  ok(selo && /em andamento · 4\/35 questões · 2 seção\(ões\) do resumo lida\(s\)/.test(selo.textContent), "A4 o selo diz o que já foi feito: " + (selo && selo.textContent));
  ok(api.plItemConta(iA).andamento === true, "A4a o Raio-X sabe que está em andamento");
  ["ed_selo_andamento", "ed_andamento_q", "ed_andamento_s", "ed_selo_andamento_ajuda"].forEach((k) =>
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
