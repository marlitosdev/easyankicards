/* =====================================================================
 * A DISCURSIVA NA AGENDA DA SEMANA (19.152.0)
 *
 * O RELATO: "como as etapas de estudar as discursivas podem ser incluídas na agenda da semana… calendário próprio, não
 * ligado aos pesos, mas aparecer lá para facilitar a interpretação do caminho a seguir".
 *
 * O QUE PRECISA SER VERDADE:
 *  A1. a escrita dura pelo tamanho da prova (~2 min por linha, de 30 a 90 min);
 *  A2. a semana reserva (preparar + escrever + corrigir) × meta + reescrever (meta ≥ 2) — a meta é a da estratégia;
 *  A3. a reserva sai das horas do plano das objetivas (agenda e análise do estudo), e o medidor diz quanto foi;
 *  A4. a faixa fica dentro da semana, fora dos avisos, com as etapas; marcar uma etapa conta, e a conta é uma só
 *      (as redações marcadas valem para a estratégia e para as orientações);
 *  A5. com a prova escrita passada não há faixa nem reserva; as marcas vão no backup.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const texto = (dias, disc) => [
    "# Teste D | prova: " + daqui(dias) + " | horas: 10",
    disc === false ? "" : "# discursiva | pontos: 30 | objetiva: 70 | linhas: 20-30 | disciplinas: A",
    "@ A :: 5", "+ Tema um :: 5", "+ Tema dois :: 4", "@ B :: 3", "+ Tema três :: 3",
  ].filter(Boolean).join("\n");

  /* A1 */
  {
    const { api } = rodar();
    ok(api.dagMinEscrita({ linhas: { min: 20, max: 30 } }) === 60 && api.dagMinEscrita({ linhas: { max: 20 } }) === 40 && api.dagMinEscrita({}) === 60
      && api.dagMinEscrita({ linhas: { max: 60 } }) === 90 && api.dagMinEscrita({ linhas: { max: 10 } }) === 30, "A1 a escrita pelo tamanho da prova");
  }

  /* A2 + A3 + A4 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("Reta", texto(10));
    const res = api.dagReservaMin(e);
    ok(res === 2 * (15 + 60 + 20 + 5) + 30, "A2 reta final (meta 2): 2 × (15 + 60 + 20 + 5 do esqueleto) + 30 = 230 min: " + res);
    const semDisc = api.edCriar("Sem", texto(10, false));
    ok(api.dagReservaMin(semDisc) === 0, "A2b sem discursiva, sem reserva");
    api.edApagar(semDisc.id);
    api.hubAbrirEdital(e.id);
    const ctx = api.plContexto();
    ok(ctx && Math.round(ctx.plano.porSemana) === 600 - 230, "A3a a análise do estudo planeja com as horas menos a reserva: " + (ctx && ctx.plano.porSemana));
    api.hubPintarAgenda();
    const topo = api.$("edAgendaTopo");
    const fx = achar(topo, (x) => x.id === "hubDiscTreino_" + e.id)[0];
    ok(fx && /(^| )dag( |$)/.test(fx.className) && !achar(topo, (x) => x.id === "hubAviso_disc")[0], "A4a a faixa está na semana, não nos avisos");
    ok(/0 de 2 redação\(ões\) nesta semana · reserva 3h50/.test(fx.textContent), "A4b a faixa diz a meta da estratégia e a reserva: " + fx.textContent.slice(0, 160));
    const med = achar(topo, (x) => /(^| )ag-med-rot( |$)/.test(x.className || ""))[0];
    ok(med && /discursiva: 3h50 reservadas à parte/.test(med.textContent), "A3b o medidor diz quanto a discursiva reservou: " + (med && med.textContent));
    const ets = achar(fx, (x) => /(^| )dag-etapa( |$)/.test(x.className || ""));
    ok(ets.length === 7 && /Preparar os temas/.test(ets[0].textContent) && /Esqueleto de cabeça \(0\/2\)/.test(ets[1].textContent) && /Escrever a redação 1/.test(ets[2].textContent) && /Corrigir a 1/.test(ets[3].textContent) && /Reescrever a pior/.test(ets[6].textContent),
      "A4c as etapas, em ordem: preparar, escrever e corrigir cada uma, reescrever: " + ets.map((b) => b.textContent).join(" | "));
    ets[2].onclick();
    ok(api.dagMarcas(e.id).esc_1 === true && api.dsFeitasSemana(e.id) === 1 && api.dagEscritasSemana(e.id) === 1, "A4d marcar 'escrever' conta como redação da semana (uma conta só)");
    const fx2 = achar(api.$("edAgendaTopo"), (x) => x.id === "hubDiscTreino_" + e.id)[0];
    ok(/1 de 2 redação\(ões\)/.test(fx2.textContent) && /✓ Escrever a redação 1/.test(fx2.textContent), "A4e a faixa repinta com a etapa feita");
    const s = api.dagSemana(e, ctx.plano);
    ok(s.feitoMin === 60 && s.reservaMin === 230 && s.reservaMin === api.dagReservaMin(e), "A4f o tempo feito acompanha, e a faixa reserva o mesmo que a agenda desconta: " + s.feitoMin + " de " + s.reservaMin);
    achar(fx2, (x) => x.id === "dagEt_" + e.id + "_esc_1")[0].onclick();
    ok(!api.dagMarcas(e.id).esc_1 && api.dagEscritasSemana(e.id) === 0, "A4g tocar de novo desmarca");
    api.edApagar(e.id);
  }

  /* A5 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("Passou", texto(-3));
    ok(api.dagReservaMin(e) === 0 && !api.dagSemana(e, null), "A5a prova escrita passada: sem reserva nem faixa");
    const todas = [];
    Object.keys(api.BK_CHAVES).forEach((g) => api.BK_CHAVES[g].forEach((k) => todas.push(k)));
    ok(todas.indexOf("eac_ds_etapas") >= 0, "A5b as etapas marcadas vão no backup");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
