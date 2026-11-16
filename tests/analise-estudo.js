/* =====================================================================
 * ANÁLISE DO ESTUDO — A VISÃO GERAL (19.149.0)
 *
 * O RELATO: "o raio X da recomendação hoje está mostrando bem mais do que somente o sistema de recomendação. Esta parte
 * tem potencial para mostrar mais estatísticas do usuário… avalie o propósito comparado com outras coisas do aplicativo,
 * e renomeie."
 *
 * O QUE PRECISA SER VERDADE:
 *  G1. o modelo conta do diário as horas (estudo × revisão), os dias estudados e a sequência; o acerto vem do banco e
 *      das contagens do diário; os cartões, da agenda deles; tudo comparado ao período anterior do mesmo tamanho;
 *  G2. o mapa tem as 13 semanas até hoje (começando numa segunda) e as semanas somam o diário;
 *  G3. os alertas: abaixo da meta, dias parado, acerto caindo, cartões atrasados; com plano, a fatia e o que não cabe;
 *  G4. a tela: chama-se "Análise do estudo", abre na visão geral, o período é lembrado, e o alerta leva à aba;
 *  G5. "Como o plano decide" tem as três sub-abas; "Desempenho" é a antiga "Sinais não usados";
 *  G6. o armazenamento saiu das abas e abre por ⚙ Configurações; a conta do item vem arredondada.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const raiz = path.join(__dirname, "..", "docs");
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const hub = fs.readFileSync(path.join(raiz, "edital-hub.js"), "utf8");

  /* um "agora" fixo: quarta-feira, 18/11/2026, meio-dia (hora local) */
  const AGORA = new Date(2026, 10, 18, 12, 0, 0).getTime();
  const dia = (k) => { const d = new Date(2026, 10, 18 + k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const iso = (k) => new Date(2026, 10, 18 + k, 10, 0, 0).toISOString();
  const diario = [
    { d: dia(0), disc: "A", a: "feito", m: 60 },
    { d: dia(-1), disc: "A", a: "revisado", m: 30 },
    { d: dia(-2), disc: "B", a: "feito", m: 90, q: { feitas: 10, certas: 6 } },
    { d: dia(-5), disc: "B", a: "pendente", m: 999 },
    { d: dia(-10), disc: "A", a: "feito", m: 45 },
    { d: dia(-40), disc: "A", a: "feito", m: 120 },
  ];
  const banco = [
    { disciplina: "A", tentativas: [{ q: iso(-1), acertou: true }, { q: iso(-3), acertou: false }, { q: iso(-40), acertou: true }] },
  ];
  const H = 86400000;
  const regs = {
    a: { s: "review", due: AGORA + 3 * H, l: 1 },
    b: { s: "review", due: AGORA - 3 * H, l: 0 },
    c: { s: "learn", due: AGORA + 20 * H },
  };

  /* G1 + G2: o modelo */
  {
    const { api } = rodar();
    const m = api.aeModelo({ diario, banco, regs, metaMin: 600, agora: AGORA, periodo: "30" });
    ok(m.horas.min === 225 && m.horas.estudo === 195 && m.horas.revisao === 30, "G1a horas do período, sem o pendente: " + JSON.stringify(m.horas));
    ok(m.horas.minAnt === 120 && m.horas.metaPeriodo === Math.round(600 * 30 / 7) && m.horas.fonteMeta === "meta", "G1b o período anterior e a meta: " + JSON.stringify(m.horas));
    ok(m.dias.estudados === 4 && m.dias.sequencia === 3 && m.dias.total === 30 && m.dias.semEstudar === 0, "G1c dias estudados e a sequência (o pendente não conta): " + JSON.stringify(m.dias));
    ok(m.acerto.feitas === 12 && m.acerto.certas === 7 && m.acerto.pct === 58 && m.acerto.pctAnt === 100, "G1d acerto: banco + diário, e o anterior: " + JSON.stringify(m.acerto));
    ok(m.cartoes.revisao === 2 && m.cartoes.aprendendo === 1 && m.cartoes.hoje === 1 && m.cartoes.atrasados === 1 && m.cartoes.venceSemana === 1 && m.cartoes.lapsos === 1,
      "G1e cartões, com a régua da fila do player (aprendendo vence na hora; revisão até o fim do dia): " + JSON.stringify(m.cartoes));
    ok(m.mapa.length === 7 * 12 + 3 && m.mapa[0].d === api.aeSegunda(m.mapa[0].d) && m.mapa[m.mapa.length - 1].d === dia(0), "G2a o mapa vai da segunda de 12 semanas atrás até hoje: " + m.mapa.length + " · " + m.mapa[0].d);
    ok(m.semanas.length === 13 && m.semanas[12].atual && m.semanas[12].estudo === 150 && m.semanas[12].revisao === 30, "G2b a semana atual soma o diário: " + JSON.stringify(m.semanas[12]));
    const t7 = api.aeModelo({ diario, banco, regs, metaMin: 600, agora: AGORA, periodo: "tudo" });
    ok(t7.horas.minAnt === null && t7.horas.min === 345 && t7.nDias === 41, "G1f 'tudo' vai do primeiro registro, sem comparação: " + t7.nDias + " · " + t7.horas.min);
  }

  /* G3: os alertas */
  {
    const { api } = rodar();
    const parado = diario.map((x) => Object.assign({}, x, { d: x.d === dia(0) || x.d === dia(-1) || x.d === dia(-2) ? dia(-6) : x.d }));
    const banco2 = [{ disciplina: "A", tentativas: [] }];
    for (let k = 0; k < 20; k++) banco2[0].tentativas.push({ q: iso(-2), acertou: k < 10 });
    for (let k = 0; k < 20; k++) banco2[0].tentativas.push({ q: iso(-35), acertou: k < 18 });
    const m = api.aeModelo({ diario: parado, banco: banco2, regs, metaMin: 600, agora: AGORA, periodo: "30" });
    const ch = m.alertas.map((a) => a.chave);
    ok(ch.indexOf("ae_al_horas") >= 0 && ch.indexOf("ae_al_parado") >= 0 && ch.indexOf("ae_al_acerto") >= 0 && ch.indexOf("ae_al_cartoes") >= 0,
      "G3a abaixo da meta, dias parado, acerto caindo e cartões atrasados: " + ch.join(", "));
    ok(/6 dias sem registrar/.test(m.alertas.filter((a) => a.chave === "ae_al_parado")[0].txt), "G3b o alerta diz quantos dias");
    const plano = { porSemana: 600, fora: [{ disciplina: "A" }, { disciplina: "B" }],
      itens: [{ disciplina: "A", fatiaDisc: 70, disciplinaPeso: 5, chave: "a1" }, { disciplina: "B", fatiaDisc: 30, disciplinaPeso: 2, chave: "b1" }],
      fila: [{ disciplina: "A", minutos: 30 }, { disciplina: "B", minutos: 70 }] };
    const m2 = api.aeModelo({ diario, banco, regs, metaMin: 0, agora: AGORA, periodo: "30", plano });
    const a2 = m2.alertas;
    ok(a2.some((a) => a.chave === "ae_al_fatia" && /A vale 70% da prova e recebe 30%/.test(a.txt) && a.ir.aba === "disc"), "G3c com plano: a disciplina abaixo da fatia leva a Prova × tempo: " + a2.map((a) => a.txt).join(" | "));
    ok(a2.some((a) => a.chave === "ae_al_fora" && /2 tópico/.test(a.txt) && a.ir.aba === "fila"), "G3d o que não cabe leva à semana");
    ok(a2.some((a) => a.chave === "ae_al_poucas" && a.nivel === "info") && a2[a2.length - 1].nivel === "info", "G3e poucas questões é informação, e vem depois do que é para corrigir");
    ok(m2.horas.fonteMeta === "plano" && m2.horas.metaSemana === 600, "G3f sem meta própria, a meta é a do plano");
  }

  /* G4 + G5 + G6: a tela */
  {
    const { api } = rodar();
    api.plIniciar();
    ok(api.t("plog_titulo") === "Análise do estudo" && /data-i18n="plog_titulo"/.test(html), "G4a a tela se chama Análise do estudo");
    api.plAbrir({ aba: "geral" });
    const corpo = api.$("plogCorpo");
    ok(api.plAbaAtual() === "geral" && api.$("aeKpiHoras") && api.$("aeKpiDias") && api.$("aeKpiAcerto") && api.$("aeKpiCartoes") && api.$("aeMapa") && api.$("aeSemanas") && api.$("aeAlertas"),
      "G4b a visão geral desenha indicadores, mapa, semanas e alertas (mesmo sem edital)");
    ok(/ativa/.test(api.$("btnPlogAbaGeral").className), "G4c a aba Visão geral acende");
    api.$("btnAePer_7").onclick();
    ok(api.aePeriodoLer() === "7" && api.lojaLer("eac_ae_periodo") === "7" && /ativo/.test(api.$("btnAePer_7").className), "G4d o período é lembrado");
    ok(/Nada fora do lugar|fora do lugar/.test(corpo.textContent), "G4e os alertas aparecem (ou o 'nada fora do lugar')");
    /* a conta do plano precisa de um edital */
    const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("SEFAZ", ["# SEFAZ Auditor | prova: " + daqui(120) + " | horas: 20", "@ Direito Tributário :: 5", "+ Lançamento :: 5", "@ Português :: 2", "+ Crase :: 3"].join("\n"));
    api.hubAbrirEdital(e.id);
    api.plAbrir({ aba: "geral" });
    ok(!!api.$("aeAlertas"), "G4g com edital, a visão geral continua de pé");
    api.plAbaTrocar("plano");
    ok(api.plAbaAtual() === "disc" && !!api.$("btnPlogSub_fila") && !!api.$("btnPlogSub_disc") && !!api.$("btnPlogSub_hist") && /ativa/.test(api.$("btnPlogAbaPlano").className),
      "G5a 'Como o plano decide' abre em Prova × tempo, com as três sub-abas");
    ok(api.t("plog_aba_sinais") === "Desempenho" && /data-plog-aba="sinais"/.test(html) && !/data-plog-aba="armazem"/.test(html) && !/data-plog-aba="fila"/.test(html),
      "G5b as abas principais: Visão geral, Como o plano decide e Desempenho (a semana virou sub-aba; armazenamento saiu)");
    ok(/id="btnCfgArmazem"/.test(html) && /id="dlgArmazem"/.test(html), "G6a o armazenamento mora em ⚙ Configurações, numa janela própria");
    api.plAbaTrocar("armazem");
    ok(api.$("dlgArmazem").open && (api.$("armazemCorpo").textContent || "").length > 20 && api.plAbaAtual() !== "armazem", "G6b a aba antiga leva à janela do armazenamento");
    ok(api.plContaTxt({ pesoDisc: 5, pesoTop: 5, bruto: 25 }) === "5 × 5 = 25" && /^5 × 5 → 10,4 \(dividido entre os ramos\)$/.test(api.plContaTxt({ pesoDisc: 5, pesoTop: 5, bruto: 10.384615384615385 })),
      "G6c a conta do item vem arredondada e explicada: " + api.plContaTxt({ pesoDisc: 5, pesoTop: 5, bruto: 10.384615384615385 }));
    ok(/id = "btnAnaliseAbrir"/.test(hub) && /plAbrir\(\{ aba: "geral" \}\)/.test(hub) && /plAbrir\(\{ aba: "disc" \}\)/.test(hub), "G4f a agenda tem o botão da análise (visão geral) e o 'Por que isto?' (conta do plano)");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
