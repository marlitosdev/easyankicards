/* =====================================================================
 * RAMOS QUE "SUMIAM" DA AGENDA E DO RESUMO (v18.92.0) — o caso real de 19/10
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o tópico com ramos não perde a vez na fila por resíduo de arredondamento (12 partes de 1/12 = 1, não 0,999…);
 *  2. o tópico com ramos que não cabe inteiro no resto da semana entra com os ramos que cabem; o resto vai adiante;
 *  3. o resumo aberto passa a ter os ramos assim que eles são salvos; e acha os ramos em qualquer edital;
 *  4. a lista de ramos que chega para um tópico que já tem ramos diferentes PERGUNTA: manter e acrescentar, substituir
 *     ou cancelar; sem diferença, nada é perguntado.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const tique = () => new Promise((r) => setImmediate(r));
  const NL = String.fromCharCode(10);
  /* os pesos dos 12 ramos de "Lançamento" no backup de 19/10: somadas, as partes dão 0,9999999999999998 */
  const PESOS = [5, 4, 5, 4, 5, 5, 4, 4, 3, 4, 5, 4];
  const doze = PESOS.map((p, k) => "++ Ramo " + (k + 1) + " :: " + p).join(NL);

  /* ---- 1: a vez na fila ---- */
  {
    const { api: a } = rodar();
    const ED = ["# X | prova: 2027-06-01 | horas: 20", "@ D :: 5", "+ Com ramos :: 5", doze, "+ Sem ramos A :: 5", "+ Sem ramos B :: 5"].join(NL);
    const p = a.montarPlano(a.lerEdital(ED), { horas: 20, prova: "2027-06-01", hoje: "2026-10-19", feitos: {} });
    const it = p.itens.find((i) => i.nome === "Com ramos");
    ok(it.ramos.reduce((x, r) => x + r.share, 0) !== 1 && a.edRestante(it) === 1 && it.brutoOrdem === p.itens.find((i) => i.nome === "Sem ramos A").brutoOrdem,
      "L1 12 ramos pendentes somam EXATAMENTE 1: o tópico vale o mesmo que os irmãos de mesmo peso: " + a.edRestante(it));
    ok(p.fila[0].nome === "Com ramos", "L1a no empate de peso vale a ordem do edital: o tópico com ramos (o 1º do edital) é o 1º da fila: " + p.fila.slice(0, 3).map((i) => i.nome).join(", "));
    const terco = { ramos: [{ share: 1 / 3 }, { share: 1 / 3, feito: true }, { share: 1 / 3, feito: true }] };
    ok(Math.abs(a.edRestante(terco) - 1 / 3) < 1e-15, "L1b frações de verdade (1/3) não são arredondadas");
  }

  /* ---- 2: a parte da semana ---- */
  {
    const { api: a } = rodar();
    const ED = ["# X | prova: 2027-06-01 | horas: 3", "@ D :: 5", "+ Primeiro :: 5", "+ Com ramos :: 4", doze, "@ E :: 4", "+ Outro :: 4"].join(NL);
    const p = a.montarPlano(a.lerEdital(ED), { horas: 3, prova: "2027-06-01", hoje: "2026-10-19", feitos: {} });
    const it = p.fila.find((i) => i.nome === "Com ramos");
    const sem1 = a.semanaAtual(p);
    ok(it && it.semana === 1 && it.minutosSemana > 0 && it.minutosSemana < it.minutos && it.ramosSemana.length >= 1 && it.ramosSemana.length < 12,
      "L2 não cabe inteiro na semana (180 min): entra com os ramos que cabem: " + JSON.stringify({ sem: it && it.semana, ms: it && it.minutosSemana, m: it && it.minutos, n: it && it.ramosSemana && it.ramosSemana.length }));
    const total = sem1.reduce((x, i) => x + a.edMinSemana(i), 0);
    ok(total <= 180, "L2a a semana não passa do orçamento (180 min): " + total);
    a.agendar(sem1, { dias: 5 });
    ok(sem1.every((i) => i.dia), "L2b a agenda distribui pelos dias usando a parte da semana");
    const sem = (txt) => a.montarPlano(a.lerEdital(txt), { horas: 3, prova: "2027-06-01", hoje: "2026-10-19", feitos: {} });
    const semRamos = sem(ED.replace(doze + NL, ""));
    ok(semRamos.fila.every((i) => !i.minutosSemana), "L2c sem ramos, nada muda (nenhum item fica partido)");
    /* sobra menos que um ramo na semana: o tópico vai inteiro para a seguinte (nunca entra com 0 minutos) */
    let partes = 0, vazias = 0;
    [1, 2, 3, 4].forEach((h) => [1, 2, 3, 4, 5].forEach((pp) => {
      const q = a.montarPlano(a.lerEdital(["# X | prova: 2027-06-01 | horas: " + h, "@ D :: 5", "+ Primeiro :: " + pp, "+ Com ramos :: 4", doze].join(NL)), { horas: h, prova: "2027-06-01", hoje: "2026-10-19", feitos: {} });
      q.fila.forEach((i) => { if (i.ramosSemana) { partes++; if (!i.ramosSemana.length || !i.minutosSemana) vazias++; } });
    }));
    const it3 = { minutos: 100, ramos: [{ id: "a", minutos: 25 }, { id: "b", minutos: 25 }, { id: "c", minutos: 25, feito: true }, { id: "d", minutos: 50 }] };
    ok(a.edParteDaSemana(it3, 10) === null && a.edParteDaSemana(it3, 0) === null && a.edParteDaSemana(it3, 200) === null
      && JSON.stringify(a.edParteDaSemana(it3, 60)) === JSON.stringify({ minutos: 50, ids: ["a", "b"] }),
      "L2e a parte: nem o primeiro ramo cabe (10 min) = nada; cabe tudo = nada (vai inteiro); 60 min = os 2 primeiros pendentes (o feito não conta)");
    ok(partes > 0 && vazias === 0, "L2d em 20 combinações, nenhum tópico entra na semana com 0 ramos: " + partes + " partes, " + vazias + " vazias");
  }

  /* ---- 3: o resumo aberto vê os ramos salvos; e acha os ramos em qualquer edital ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const ed = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Tributário :: 5", "+ Lançamento :: 5"].join(NL));
    const ch = a.matChave("Tributário", "Lançamento");
    a.matGravar(ch, "Resumo do lançamento.", { disciplina: "Tributário", topico: "Lançamento" });
    a.matAbrirEditor({ disciplina: "Tributário", nome: "Lançamento" }, "ler");
    ok(a.matRamosDoAtual().length === 0, "L3 antes: o resumo aberto, sem ramos");
    a.ramAbrirEditor({ editalId: ed.id, disciplina: "Tributário", topico: "Lançamento", chave: ch });
    a.$("ramColar").value = ["++ Lançamento de ofício :: 5", "++ Lançamento por declaração :: 4"].join(NL);
    a.ramConferirIA("acrescentar");
    a.ramSalvar();
    ok(a.$("dlgMaterial").open === true && a.matRamosDoAtual().length === 2, "L3a salvos os ramos, o resumo aberto passa a tê-los na hora: " + a.matRamosDoAtual().length);
    a.$("dlgMaterial").close();
    a.matAbrirEditor({ disciplina: "Tributário", nome: "Lançamento" }, "ler");
    ok(a.matRamosDoAtual().length === 2, "L3b reaberto (sem edital aberto na tela do edital), acha os ramos pelos editais");
    /* ramos mudados por outro caminho (ex.: o texto do edital) com o resumo JÁ aberto: abrir de novo relê */
    a.ramAplicar({ editalId: ed.id, disciplina: "Tributário", topico: "Lançamento", chave: ch }, [{ nome: "Lançamento de ofício", peso: "5", nota: "", idOrig: "lancamento_de_oficio" }, { nome: "Lançamento por declaração", peso: "4", nota: "", idOrig: "lancamento_por_declaracao" }, { nome: "Homologação", peso: "3", nota: "" }]);
    a.matAbrirEditor({ disciplina: "Tributário", nome: "Lançamento" }, "ler");
    ok(a.matRamosDoAtual().length === 3, "L3c com a janela já aberta, abrir de novo relê os ramos (3, não os 2 de antes)");
  }

  /* ---- 4: a pergunta ao chegar uma lista ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const ed = a.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20", "@ Tributário :: 5", "+ Lançamento :: 5", "++ Antigo A", "++ Antigo B", "++ Comum"].join(NL));
    const ch = a.matChave("Tributário", "Lançamento");
    const abrir = () => a.ramAbrirEditor({ editalId: ed.id, disciplina: "Tributário", topico: "Lançamento", chave: ch });
    const nomes = () => a.ramLinhasAtual().map((l) => l.nome).join(",");
    /* só acréscimo: sem pergunta */
    abrir();
    a.$("ramColar").value = ["++ Antigo A", "++ Antigo B", "++ Comum", "++ Novo 1"].join(NL);
    const r0 = a.$("btnRamConferir").onclick();
    ok(r0 && !r0.then && nomes() === "Antigo A,Antigo B,Comum,Novo 1", "L4 a lista só acrescenta (nenhum atual fica de fora): sem pergunta, entra direto");
    /* lista diferente: pergunta */
    abrir();
    a.$("ramColar").value = ["++ Comum", "++ Novo 1", "++ Novo 2"].join(NL);
    const p1 = a.$("btnRamConferir").onclick();
    await tique();
    ok(p1 && typeof p1.then === "function" && a.$("uiModal").open === true && a.$("uiModalMsg").textContent === a.t("ram_lista_pergunta", { n: 3, m: 3, s: 2, k: 2 }),
      "L5 dois atuais ficariam de fora: pergunta antes, dizendo quantos entram e quantos saem: " + a.$("uiModalMsg").textContent);
    ok(a.$("uiModalOk").textContent === a.t("ram_lista_acrescentar", { k: 2 }) && a.$("uiModalCancel").textContent === a.t("ram_lista_substituir", { s: 2 }), "L5a as opções: manter e acrescentar / substituir / cancelar");
    a.uiModalResponder("substituir");
    await p1;
    ok(nomes() === "Comum,Novo 1,Novo 2" && a.$("ramMsg").textContent === a.t("ram_lista_substituida", { n: 3, s: 2 }), "L5b substituir: fica só a lista nova: " + nomes());
    const comum = a.ramLinhasAtual().find((l) => l.nome === "Comum");
    ok(comum && comum.idOrig === "comum", "L5c o ramo de mesmo nome continua sendo o mesmo (leva o que era dele)");
    /* manter e acrescentar */
    abrir();
    a.$("ramColar").value = ["++ Comum", "++ Novo 1"].join(NL);
    const p2 = a.$("btnRamConferir").onclick();
    await tique(); a.uiModalResponder("acrescentar"); await p2;
    ok(nomes() === "Antigo A,Antigo B,Comum,Novo 1", "L6 manter: os atuais ficam e o novo entra no fim: " + nomes());
    /* cancelar */
    abrir();
    a.$("ramColar").value = ["++ Novo 9"].join(NL);
    const p3 = a.$("btnRamConferir").onclick();
    await tique(); a.uiModalResponder("cancelar"); await p3;
    ok(nomes() === "Antigo A,Antigo B,Comum" && a.$("ramMsg").textContent === a.t("ram_lista_cancelado"), "L7 cancelar: nada muda");
    /* pela caixa do resumo (ramAbrirComLista): a mesma pergunta */
    a.$("dlgRamos").close();
    const p4 = a.ramAbrirComLista({ editalId: ed.id, disciplina: "Tributário", topico: "Lançamento", chave: ch }, ["++ Só este"].join(NL));
    await tique();
    ok(a.$("uiModal").open === true, "L8 a lista colada na caixa do resumo também pergunta");
    a.uiModalResponder("substituir"); await p4;
    ok(nomes() === "Só este", "L8a e substitui");
  }
  return falhas;
}

module.exports = { testes };
