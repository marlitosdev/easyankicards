/* =====================================================================
 * DISCURSIVAS — RELER EM INTERVALOS, REESCRITA LIGADA E O FORMATO DO ESPELHO (19.160.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  R1. o tema lido volta para releitura em 3, 7, 15, 30 e depois 60 dias, contados do contato mais recente (leitura,
 *      releitura, treino de esqueleto, redação do tema); nunca lido não é releitura;
 *  R2. na tela: o aviso "N para reler hoje", o 🔁 na lista, o filtro "para reler hoje" e, no leitor, "🔁 Reli ·
 *      próximo" (com desfazer);
 *  R3. na agenda: a etapa "Reler os temas" da semana, 5 min cada, somada à reserva; tocar abre a lista dos vencidos;
 *  W1. a redação pode ser reescrita de outra (a reescrita da reescrita aponta para a primeira versão); o tema igual
 *      sugere a original; "↻ reescrever" preenche o formulário;
 *  W2. a média e a tendência contam só as primeiras versões; a reescrita mostra de onde veio e quanto subiu;
 *  W3. na agenda: a reescrita não ocupa vaga de redação nova e marca sozinha "reescrever a pior", que traz o tema;
 *  P1. os três pedidos à IA fixam o espelho em itens numerados com pontos, e esse formato vira itens no treino.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const NL = String.fromCharCode(10);
  const ESP = ["1. Conceito de tributo (20 pontos)", "* Art. 3º do CTN", "2. Espécies tributárias (20 pontos)", "Descontos:", "* Erros de língua"].join(NL);

  /* R1 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const hoje = daqui(0);
    ok(api.dsReleitura({ tema: "x" }, []) === null, "R1a nunca lido: não é releitura");
    let R = api.dsReleitura({ tema: "x", lida: daqui(-4) }, []);
    ok(R && R.k === 0 && R.int === 3 && R.devida && R.ha === 4 && R.prox === daqui(-1), "R1b lido há 4 dias: venceu (3 dias): " + JSON.stringify(R));
    R = api.dsReleitura({ tema: "x", lida: daqui(-2) }, []);
    ok(R && !R.devida && R.prox === daqui(1), "R1c lido há 2 dias: ainda não");
    R = api.dsReleitura({ tema: "x", lida: daqui(-30), reler: [daqui(-20), daqui(-8)] }, []);
    ok(R && R.k === 2 && R.int === 15 && !R.devida, "R1d duas releituras: o degrau é 15 dias");
    R = api.dsReleitura({ tema: "x", lida: daqui(-90), reler: [daqui(-80), daqui(-70), daqui(-60), daqui(-50), daqui(-61)] }, []);
    ok(R && R.int === 60, "R1e depois do 4º degrau, a cada 60 dias");
    R = api.dsReleitura({ tema: "x", lida: daqui(-10), esq: [{ d: daqui(-1), pts: 1, max: 2 }] }, []);
    ok(R && R.ultima === daqui(-1) && !R.devida, "R1f o treino de esqueleto conta como contato");
    R = api.dsReleitura({ tema: "Tema X", escrita: true }, [{ tema: "tema x", d: daqui(-5) }]);
    ok(R && R.ultima === daqui(-5) && R.devida, "R1g a redação escrita do tema conta como contato");
    void hoje;
  }

  /* R2 + R3 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("Treino", ["# Treino | prova: " + daqui(40) + " | horas: 10", "# discursiva | pontos: 40 | objetiva: 60 | minimo: 50% | linhas: 25-30 | disciplinas: A", "@ A :: 5", "+ Tema um :: 5"].join(NL));
    const p1 = api.dsPropostaAdicionar(e.id, { tema: "Vencido", disc: "A", enunciado: "E1.", espelho: ESP, fonte: "ia" });
    const p2 = api.dsPropostaAdicionar(e.id, { tema: "Recente", disc: "A", enunciado: "E2.", espelho: ESP, fonte: "ia" });
    const p3 = api.dsPropostaAdicionar(e.id, { tema: "Nunca lido", disc: "A", enunciado: "E3.", espelho: ESP, fonte: "ia" });
    const p4 = api.dsPropostaAdicionar(e.id, { tema: "Outro vencido", disc: "A", enunciado: "E4.", espelho: ESP, fonte: "ia" });
    api.dsPropostaAtualizar(e.id, p1.id, { lida: daqui(-5) });
    api.dsPropostaAtualizar(e.id, p2.id, { lida: daqui(0) });
    api.dsPropostaAtualizar(e.id, p4.id, { lida: daqui(-9) });
    ok(api.dsRelerDevidas(e.id).map((x) => x.p.tema).join() === "Outro vencido,Vencido", "R2a vencidos, o mais antigo primeiro: " + api.dsRelerDevidas(e.id).map((x) => x.p.tema).join());
    api.loja.setItem("eac_ds_edital", e.id); api.loja.setItem("eac_ds_secao", "propostas");
    api.dsPropSel[e.id] = p1.id;
    api.dsRender();
    ok(api.$("dsRelerAviso_" + e.id) && /2 tema\(s\) para reler hoje/.test(api.$("dsRelerAviso_" + e.id).textContent), "R2b o aviso dos vencidos");
    ok(/🔁 Vencido/.test(api.$("dsPropIt_" + p1.id).textContent) && !/🔁/.test(api.$("dsPropIt_" + p2.id).textContent) && !/🔁/.test(api.$("dsPropIt_" + p3.id).textContent), "R2c o 🔁 só nos vencidos");
    ok(api.$("dsReler_" + p1.id) && /há 5 dia\(s\)/.test(api.$("dsReler_" + p1.id).textContent) && /próximo/.test(api.$("btnDsReler_" + p1.id).textContent), "R2d o leitor do vencido: 'Reli · próximo'");
    /* a agenda antes */
    let S = api.dagSemana(e, null);
    let rl = S.etapas.filter((s) => s.tipo === "reler")[0];
    ok(rl && rl.n >= 2 && rl.feitos === 0 && rl.min === 5 * rl.n && S.reservaMin === api.dagReservaMin(e), "R3a a etapa da semana, 5 min cada, somada à reserva: " + JSON.stringify(rl));
    api.$("btnDsReler_" + p1.id).onclick();
    const g1 = api.dsPropostas(e.id).filter((p) => p.id === p1.id)[0];
    ok(g1.reler && g1.reler.join() === daqui(0) && api.dsPropSel[e.id] === p4.id, "R2e reler grava hoje e vai para o próximo vencido");
    api.dsPropSel[e.id] = p1.id; api.dsRender();
    ok(api.$("btnDsRelerDesf_" + p1.id) && /próxima releitura fica para/.test(api.$("dsReler_" + p1.id).textContent), "R2f relido hoje: a data da próxima e o desfazer");
    S = api.dagSemana(e, null);
    rl = S.etapas.filter((s) => s.tipo === "reler")[0];
    ok(rl && rl.feitos === 1, "R3b a releitura conta na semana");
    api.$("btnDsRelerDesf_" + p1.id).onclick();
    ok(!api.dsPropostas(e.id).filter((p) => p.id === p1.id)[0].reler, "R2g desfazer tira a releitura");
    ok(api.dsAgendaSujaAtual() === true, "R3d mexer nas Discursivas deixa a agenda para refazer");
    api.trocarModo("edital");
    ok(api.dsAgendaSujaAtual() === false, "R3e abrir o Edital refaz a agenda (a faixa da discursiva em dia)");
    /* o filtro e o atalho da agenda */
    api.dsIrPara(e.id, { secao: "propostas", reler: true });
    const vis = api.dsPropostasFiltradas(e, [{ e }]).map((x) => x.p.tema).join();
    ok(api.dsPropSel[e.id] === p4.id && vis === "Vencido,Outro vencido" || vis === "Outro vencido,Vencido", "R3c a etapa abre a lista só com os vencidos: " + vis);
    api.dsRender();
    ok(api.$("dsPropFSt_" + e.id).value === "reler" && !/tema\(s\) para reler hoje/.test(api.$("dsLista").textContent), "R2h o filtro 'para reler hoje' (sem o aviso repetido): " + api.$("dsPropFSt_" + e.id).value + " / " + !!api.$("dsRelerAviso_" + e.id));
    const bt = api.$("dagEt_" + e.id + "_reler");
    void bt;
  }

  /* W1 + W2 + W3 */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("Treino", ["# Treino | prova: " + daqui(40) + " | horas: 10", "# discursiva | pontos: 40 | objetiva: 60 | minimo: 50% | linhas: 25-30 | disciplinas: A", "@ A :: 5", "+ Tema um :: 5"].join(NL));
    const r1 = api.dsRedacaoAdicionar(e.id, { d: daqui(0), tema: "Imunidades", disc: "A", nota: 20, max: 40 });
    const r2 = api.dsRedacaoAdicionar(e.id, { d: daqui(0), tema: "Lançamento", disc: "A", nota: 30, max: 40 });
    let S = api.dagSemana(e, null);
    const meta = S.meta;
    const re0 = S.etapas.filter((s) => s.tipo === "reesc")[0];
    ok(meta < 2 || (re0 && !re0.feito && re0.tema === "Imunidades" && /Reescrever a pior da semana: Imunidades/.test(api.dagPintar(S, null, true).textContent)),
      "W3a a etapa 'reescrever a pior' traz o tema da pior (meta " + meta + "): " + JSON.stringify(re0));
    const w1 = api.dsRedacaoAdicionar(e.id, { d: daqui(0), tema: "Imunidades", disc: "A", nota: 29, max: 40, orig: r1.id });
    const w2 = api.dsRedacaoAdicionar(e.id, { d: daqui(0), tema: "Imunidades", disc: "A", nota: 33, max: 40, orig: w1.id });
    ok(w1.orig === r1.id && w2.orig === r1.id, "W1a a reescrita aponta para a primeira versão (também a reescrita da reescrita)");
    ok(api.dsRedacaoAdicionar(e.id, { d: daqui(0), tema: "Z", nota: 1, max: 40, orig: "nao-existe" }).orig === undefined, "W1b original que não existe é ignorada");
    const res = api.dsRedacoesResumo(e.id, api.dsDiscursivaDe(e).dc);
    ok(res.n === 5 && res.media5 === Math.round((50 + 75 + 3) / 3) && res.reesc.n === 2 && res.reesc.ganhoMedio === Math.round((23 + 33) / 2),
      "W2a a média conta só as primeiras versões; as reescritas e o ganho à parte: " + JSON.stringify({ n: res.n, m: res.media5, r: res.reesc.n, g: res.reesc.ganhoMedio }));
    ok(api.dsRedacoesNaSemana(e.id) === 3, "W3b a reescrita não conta como redação nova da semana");
    S = api.dagSemana(e, null);
    const re1 = S.etapas.filter((s) => s.tipo === "reesc")[0];
    ok(meta < 2 || (re1 && re1.feito && re1.auto), "W3c a reescrita registrada marca 'reescrever' sozinha");
    /* a tela das redações */
    api.loja.setItem("eac_ds_edital", e.id); api.loja.setItem("eac_ds_secao", "redacoes");
    api.dsRender();
    const lista = api.$("dsRed_" + e.id).textContent;
    ok(/↻ reescrita de .*: 50% → 73% \(\+9 pts\)/.test(lista) && /↻ reescrita de .*: 50% → 83% \(\+13 pts\)/.test(lista), "W2b a linha da reescrita mostra de onde veio e quanto subiu: " + lista.slice(0, 400));
    ok(/Reescritas: 2 · ganho médio de \+28 pontos percentuais/.test(lista), "W2c o resumo das reescritas");
    ok(api.$("btnDsRedReesc_" + r2.id) && !api.$("btnDsRedReesc_" + w1.id), "W1c '↻ reescrever' só nas primeiras versões");
    api.$("btnDsRedReesc_" + r2.id).onclick();
    ok(api.$("dsRedTema_" + e.id).value === "Lançamento" && api.$("dsRedOrig_" + e.id).value === r2.id && api.$("dsRedNota_" + e.id).value === "", "W1d '↻ reescrever' preenche o tema e a ligação");
    api.$("dsRedOrig_" + e.id).value = "";
    api.$("dsRedTema_" + e.id).value = "imunidades";
    api.$("dsRedTema_" + e.id).onchange();
    ok(api.$("dsRedOrig_" + e.id).value === r1.id, "W1e o tema igual sugere a primeira versão dele");
  }

  /* P1 */
  {
    const { api } = rodar();
    const dc = { pontos: 40, minimo: { tipo: "pct", valor: 50 }, linhas: { min: 25, max: 30 }, disciplinas: ["A"] };
    const e = { nome: "X" };
    const ps = [api.dsPromptPacote(e, dc, "A", "completos", 2, []), api.dsPromptPacote(e, dc, "A", "ideias", 2, []), api.dsPromptProposta(e, dc, "A", [], 1)];
    ok(ps.every((p) => /um item por linha, numerado, no formato “1\. o que a resposta precisa conter \(X pontos\)”/.test(p) && /“Descontos:”/.test(p)), "P1a os três pedidos fixam o formato do espelho");
    const E = api.dsEspelhoItens(["1. Conceito de tributo (20 pontos)", "* Art. 3º do CTN", "* Compulsoriedade", "2. Espécies tributárias (20 pontos)", "Descontos:", "* Erros de língua", "* Fuga ao tema"].join(NL));
    ok(E.itens.length === 2 && E.total === 40 && E.itens[0].sub.length === 2 && E.descontos.length === 2, "P1b esse formato vira itens no treino de esqueleto");
    ["ds_reler_aviso", "ds_reler_ver", "ds_reler_devida", "ds_reler_bt", "ds_reler_bt_prox", "ds_reler_tip", "ds_reler_feito", "ds_reler_desf", "ds_reler_prox", "ds_pf_st_reler", "ds_pi_reler",
      "dag_reler", "dag_reesc_tema", "ds_red_orig", "ds_red_orig_nao", "ds_red_reesc_de", "ds_red_reesc_bt", "ds_red_reesc_tip", "ds_red_reesc_res"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "P2 falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
