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

  /* ================= ETAPA 2 (19.150.0): TEMPO e DESEMPENHO ================= */
  /* T1: o tempo de verdade, por disciplina, contra a prova */
  {
    const { api } = rodar();
    const dT = [
      { d: dia(0), disc: "A", a: "feito", m: 60, f: ["leitura", "questoes"], hu: "boa" },
      { d: dia(-1), disc: "a", a: "revisado", m: 30 },
      { d: dia(-2), disc: "B", a: "feito", m: 90, f: ["videoaula"], hu: "ruim" },
      { d: dia(-3), disc: "Z", a: "feito", m: 15 },
      { d: dia(-4), disc: "A", a: "pendente", m: 500 },
    ];
    const plano = { porSemana: 600, fora: [],
      itens: [{ disciplina: "A", fatiaDisc: 70, disciplinaPeso: 5, chave: "a1" }, { disciplina: "B", fatiaDisc: 30, disciplinaPeso: 2, chave: "b1" }],
      fila: [{ disciplina: "A", minutos: 30 }, { disciplina: "B", minutos: 70 }] };
    const m = api.aeTempoModelo({ diario: dT, banco: [], regs: {}, agora: AGORA, periodo: "7", plano });
    const A = m.discs.filter((x) => x.nome === "A")[0], B = m.discs.filter((x) => x.nome === "B")[0], O = m.discs.filter((x) => !x.doPlano)[0];
    ok(A && A.min === 90 && A.est === 60 && A.rev === 30 && A.real === 50 && A.prova === 70 && A.desvio === -20, "T1a A: o nome casa sem caixa, estudo × revisão, 50% real contra 70% da prova: " + JSON.stringify(A));
    ok(B && B.real === 50 && B.desvio === 20 && O && O.min === 15 && O.real === null && m.discs[m.discs.length - 1] === O, "T1b B e 'outros editais' (fora da conta da fatia, por último)");
    const f = (k) => m.formas.filter((x) => x.forma === k)[0];
    ok(f("leitura").min === 30 && f("questoes").min === 30 && f("videoaula").min === 90 && f("revisao").min === 30 && f("leitura").boa === 1 && f("videoaula").ruim === 1,
      "T1c as formas dividem os minutos e guardam o rendimento; revisão sem forma conta como revisão: " + JSON.stringify(m.formas));
    ok(m.diaSemana[2].media === 60 && m.diaSemana[1].media === 30 && m.diaSemana[0].media === 90 && m.diaSemana[6].media === 15 && m.diaSemana[3].media === 0,
      "T1d a média de cada dia da semana: " + m.diaSemana.map((x) => x.media).join(","));
    const semPlano = api.aeTempoModelo({ diario: dT, banco: [], regs: {}, agora: AGORA, periodo: "7" });
    ok(!semPlano.temPlano && semPlano.discs.length === 3 && semPlano.discs.every((x) => x.real === null), "T1e sem edital: só os minutos por disciplina");
  }

  /* D1: o acerto semana a semana, o chute e os cartões */
  {
    const { api } = rodar();
    const bD = [{ disciplina: "A", tentativas: [{ q: iso(-1), acertou: true }, { q: iso(-3), acertou: false }, { q: iso(-40), acertou: true }, { q: iso(-1), acertou: true, chute: true }] }];
    const rD = {
      a: { s: "review", due: AGORA + 3 * H, l: 1, h: [3, 4] },
      b: { s: "review", due: AGORA - 3 * H, l: 0, h: [1, 3] },
      c: { s: "learn", due: AGORA + 20 * H },
      d: { s: "review", due: AGORA + 10 * H, l: 9 },
    };
    const m = api.aeDesempModelo({ diario, banco: bD, regs: rD, agora: AGORA, periodo: "30" });
    const A = m.discs.filter((x) => x.nome === "A")[0], B = m.discs.filter((x) => x.nome === "B")[0];
    ok(A && A.feitas === 3 && A.pct === 42 && A.pctAnt === 100, "D1a A: o período e o anterior (o chute certo vale o crédito parcial do app, 0,25): " + JSON.stringify(A && { f: A.feitas, p: A.pct, a: A.pctAnt }));
    ok(B && B.feitas === 10 && B.pct === 60 && m.discs[0] === B, "D1b B vem das contagens do diário, e quem tem mais questões vem primeiro");
    ok(A.sem.length === 13 && A.sem[12].f === 2 && A.sem[12].pct === 63 && A.sem[11].f === 1 && A.sem[11].pct === 0, "D1c as semanas: domingo é da semana anterior: " + JSON.stringify(A.sem.slice(11)));
    ok(m.chute.com.f === 1 && m.chute.com.pct === 100 && m.chute.sem.f === 2 && m.chute.sem.pct === 50, "D1d chute × certeza: " + JSON.stringify(m.chute));
    const P = m.cartoes.previsao;
    ok(P.length === 30 && P[0].n === 1 && P[3].n === 1 && P[10].n === 1 && P[20].n === 1 && P.reduce((a, x) => a + x.n, 0) === 4, "D1e a previsão: o atrasado entra em hoje: " + P.map((x) => x.n).join(","));
    ok(m.cartoes.respostas === 4 && m.cartoes.notas.join(",") === "1,0,2,1" && m.cartoes.dificeis === 1, "D1f as notas dadas e os cartões esquecidos muitas vezes: " + JSON.stringify(m.cartoes.notas));
    ok(api.aeChaveDisc("Noções de DIREITO  Tributário") === "nocoes de direito tributario", "D1g a disciplina casa sem acento, caixa e espaço duplo");
  }

  /* T2 + D2: as abas na tela */
  {
    const { api } = rodar();
    api.plIniciar();
    api.plAbrir({ aba: "tempo" });
    ok(api.plAbaAtual() === "tempo" && /ativa/.test(api.$("btnPlogAbaTempo").className) && !!api.$("btnAePer_30"), "T2a a aba Tempo abre (sem edital: o aviso do diário vazio)");
    api.plAbaTrocar("sinais");
    ok(!!api.$("aeDesDisc") && !!api.$("aeDesCartoes") && !!api.$("aeDesChute") && /ativa/.test(api.$("btnPlogAbaSinais").className), "D2a Desempenho desenha acerto, cartões e chute");
    ok(/data-plog-aba="tempo"/.test(html) && html.indexOf('id="btnPlogAbaTempo"') < html.indexOf('id="btnPlogAbaSinais"') && html.indexOf('id="btnPlogAbaSinais"') < html.indexOf('id="btnPlogAbaPlano"'),
      "D2b a ordem das abas: Visão geral, Tempo, Desempenho, Como o plano decide");
  }

  /* ================= 19.151.0: ORIENTAÇÕES ================= */
  {
    const { api } = rodar();
    const m = api.aeModelo({ diario, banco, regs, metaMin: 600, agora: AGORA, periodo: "30" });
    const T = { temPlano: true, discs: [
      { nome: "A", doPlano: true, prova: 70, real: 50, desvio: -20 },
      { nome: "B", doPlano: true, prova: 20, real: 45, desvio: 25 },
      { nome: "C", doPlano: true, prova: 10, real: 5, desvio: -5 },
    ], diaSemana: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ i, media: i === 4 ? 5 : 60 })) };
    const D = { discs: [
      { nome: "A", feitas: 12, pct: 50 }, { nome: "B", feitas: 40, pct: 90 }, { nome: "C", feitas: 3, pct: 100 },
    ] };
    const o = api.aeOrientacoes({ m, T, D, diasProva: 10 });
    const ks = o.map((x) => x.k);
    ok(ks[0] === "reta" && /faltam 10 dias/.test(o[0].tit), "O1 a reta final vem primeiro: " + ks.join(","));
    ok(ks.indexOf("trocar") >= 0 && /Passe tempo de B para A/.test(o.filter((x) => x.k === "trocar")[0].tit), "O2 a que sobra (com 85%+ de acerto) cede tempo à que falta");
    ok(ks.indexOf("acerto") >= 0 && /Reforce a teoria de A/.test(o.filter((x) => x.k === "acerto")[0].tit), "O3 acerto baixo pede teoria antes de mais questões");
    ok(o.length <= 5 && o.every((x, i) => i === 0 || ({ agir: 0, ajustar: 1, manter: 2 })[o[i - 1].nivel] <= ({ agir: 0, ajustar: 1, manter: 2 })[x.nivel]), "O4 no máximo cinco, do agir ao ajustar: " + o.map((x) => x.nivel).join(","));
    const o2 = api.aeOrientacoes({ m, T, D: { discs: [{ nome: "A", feitas: 12, pct: 70 }, { nome: "B", feitas: 40, pct: 70 }, { nome: "C", feitas: 3, pct: 100 }] }, diasProva: 90 });
    ok(o2.some((x) => x.k === "falta" && /Dê mais tempo a A/.test(x.tit)) && o2.some((x) => x.k === "questoes" && /C \(10%\)/.test(x.txt)) && o2.some((x) => x.k === "ritmo"),
      "O5 sem acerto alto na que sobra: só 'dê mais tempo'; disciplina de peso sem questão; ritmo abaixo da meta: " + o2.map((x) => x.k).join(","));
    const mOk = api.aeModelo({ diario: [], banco: [], regs: {}, metaMin: 0, agora: AGORA, periodo: "30" });
    mOk.dias = Object.assign({}, mOk.dias, { estudados: 30 });
    const o3 = api.aeOrientacoes({ m: mOk, T: null, D: null, diasProva: null });
    ok(o3.length === 1 && o3[0].k === "seguir" && o3[0].nivel === "manter", "O6 sem nada a corrigir: siga o plano");
    const L = api.aeOrientDiscursiva({ est: { fase: "intensivo", nome: "Intensivo (22 a 60 dias)", meta: 3, foco: "3 redações por semana.", ajustes: ["aj1", "aj2", "aj3"] }, feitas: 1,
      tema: { tema: "ICMS e substituição", disc: "Tributário" }, semFormato: true });
    ok(/Fase: Intensivo.*Meta: 3 redação\(ões\) por semana — nesta semana, 1/.test(L[0]) && L.indexOf("3 redações por semana.") >= 0 && L.indexOf("aj1") >= 0 && L.indexOf("aj2") < 0 && L.some((l) => /Próximo tema: ICMS e substituição \(Tributário\)/.test(l)) && L.some((l) => /formato da prova/.test(l)),
      "O7 a discursiva: fase, meta da semana, o que fez, um ajuste, o próximo tema e o formato a cadastrar: " + L.join(" | "));
    const L2 = api.aeOrientDiscursiva({ est: { fase: "intensivo", nome: "Intensivo", meta: 1, foco: "3 redações por semana.", ajustes: ["até a objetiva, 1 por semana"] }, feitas: 0, tema: null });
    ok(L2.indexOf("3 redações por semana.") < 0 && L2.indexOf("até a objetiva, 1 por semana") >= 0, "O7b meta ajustada: a frase padrão da fase sai, o ajuste explica");
    ["reta", "falta", "trocar", "acerto", "questoes", "muita_rev"].forEach((k) => {
      const o9 = { reta: "sinais", falta: "tempo", trocar: "tempo", acerto: "sinais", questoes: "sinais", muita_rev: "fila" }[k];
      ok(api.t("ae_ver_" + o9) !== "ae_ver_" + o9, "O9 o botão de '" + k + "' tem texto: ae_ver_" + o9);
    });
    api.plIniciar();
    api.plAbrir({ aba: "geral" });
    ok(!!api.$("aeOrient") && !!api.$("aeOr_seguir") || !!api.$("aeOrient") && api.$("aeOrient").children.length > 1, "O8 a visão geral desenha as orientações");
  }

  /* ================= 19.153.0: COBERTURA ================= */
  {
    const { api } = rodar();
    const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    const texto = ["# Cob | prova: " + daqui(90) + " | horas: 10", "@ A :: 5", "+ Tema um :: 5", "+ Tema dois :: 4", "@ B :: 3", "+ Tema três :: 3"].join("\n");
    const e = { id: "cobx", nome: "Cob", texto };
    const dom = { disciplinas: [
      { nome: "A", pesoPct: 70, distribuicao: { verde: 50, azul: 10, amarelo: 20, vermelho: 0, cinza: 20 } },
      { nome: "B", pesoPct: 30, distribuicao: { verde: 0, azul: 0, amarelo: 0, vermelho: 0, cinza: 100 } } ] };
    const cov = { folhas: [
      { disciplina: "A", pesoPct: 40, faixa: "ok", cartoes: 10 }, { disciplina: "A", pesoPct: 30, faixa: "vazio", cartoes: 0 },
      { disciplina: "B", pesoPct: 30, faixa: "pouco", cartoes: 2 } ] };
    const led = { disciplinas: [{ nome: "A", total: 10, lidos: 4, pct: 40 }], total: 10, lidos: 4, pct: 40, n: 1 };
    const resumos = {};
    resumos[api.matChave("A", "Tema um")] = { texto: "# Parte 1\nabc\n# Parte 2\ndef" };
    const banco = [{ disciplina: "a", tentativas: [{}, {}] }];
    const m = api.aeCoberturaModelo(e, { dom, cov, led, resumos, banco });
    const A = m.lista[0], B = m.lista[1];
    ok(A.nome === "A" && B.nome === "B" && A.pesoPct === 70, "C1a uma linha por disciplina, na ordem do peso");
    ok(A.dom.verde === 50 && A.cartoes.pct === 57 && A.cartoes.n === 10 && B.cartoes.pct === 0, "C1b domínio e cartões no alvo pelo peso das folhas: " + JSON.stringify(A.cartoes));
    ok(A.resumo.pct === 56 && A.resumo.n === 1 && A.resumo.lidoPct === 0 && B.resumo.pct === 0, "C1c resumo pelo peso dos tópicos (5 de 9): " + JSON.stringify(A.resumo));
    ok(A.leis.pct === 40 && A.leis.lidos === 4 && B.leis === null && A.questoes === 2, "C1d leis lidas e questões (o nome casa sem caixa)");
    ok(m.total.dominado === 42 && m.total.cartoes === 40 && m.total.resumo === 39 && m.total.leis === 40 && m.total.questoes === 2,
      "C1e os totais, ponderados pelo peso da disciplina na prova: " + JSON.stringify(m.total));
    /* na tela, com um edital de verdade */
    api.matIniciar(); api.edIniciar();
    const ee = api.edCriar("Cob tela", texto);
    api.hubAbrirEdital(ee.id);
    api.plIniciar();
    api.plAbrir({ aba: "cobertura" });
    ok(api.plAbaAtual() === "cobertura" && !!api.$("aeCobTab") && !!api.$("aeCob_0") && !!api.$("aeCob_1") && !api.$("aeCob_2") && /ativa/.test(api.$("btnPlogAbaCob").className),
      "C2a a aba Cobertura desenha uma linha por disciplina do edital");
    ok(!!api.$("aeCobDom_0") && !!api.$("aeCobCart_0") && !!api.$("aeCobLeis_0") && !!api.$("aeCobDom") && !!api.$("aeCobLeis"), "C2b cada coluna leva ao detalhe; os totais em cima");
    api.$("aeCobDom_0").onclick();
    ok(api.$("dlgDominio").open === true, "C2c tocar no domínio abre o Domínio daquela disciplina");
    ok(/data-plog-aba="cobertura"/.test(html) && html.indexOf('id="btnPlogAbaCob"') < html.indexOf('id="btnPlogAbaPlano"'), "C2d a aba fica antes de 'Como o plano decide'");
  }

  /* ================= 19.154.0: PEDIR ANÁLISE À IA ================= */
  {
    const { api, janela } = rodar();
    const daqui = (d) => { const x = new Date(Date.now() + d * 86400000); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    api.matIniciar(); api.edIniciar();
    const ee = api.edCriar("IA tela", ["# IA | prova: " + daqui(60) + " | horas: 10", "# discursiva | pontos: 30 | objetiva: 70 | linhas: 20-30 | disciplinas: A", "@ A :: 5", "+ Tema um :: 5", "@ B :: 3", "+ Tema três :: 3"].join("\n"));
    api.hubAbrirEdital(ee.id);
    const d = api.plContexto();
    const rel = api.aeRelatorio({ d, periodo: "30" });
    ok(/^PEDIDO: /.test(rel) && /PLANEJAMENTO.*EXECUCAO/.test(rel) && /proximas 2 semanas/.test(rel), "I1a o relatório começa pelo pedido: planejamento × execução e as próximas 2 semanas");
    ok(/== VISAO GERAL ==/.test(rel) && /== TEMPO REAL/.test(rel) && /== DESEMPENHO/.test(rel) && /== COBERTURA DO EDITAL/.test(rel) && /== DISCURSIVA/.test(rel) && !/COMO O PLANO DECIDE/.test(rel),
      "I1b as seções padrão (a conta do plano, longa, fica de fora)");
    ok(/edital em vista: IA( tela)? \| prova: /.test(rel) && /periodo: ultimos 30 dias/.test(rel), "I1c o contexto: edital e período");
    const rel2 = api.aeRelatorio({ d, periodo: "7", secoes: { geral: false, plano: true }, pergunta: "Largo Informática?" });
    ok(!/== VISAO GERAL ==/.test(rel2) && /== COMO O PLANO DECIDE/.test(rel2) && /MINHA PERGUNTA: Largo Informática\?/.test(rel2) && /ultimos 7 dias/.test(rel2) && (rel2.match(/^PEDIDO:/gm) || []).length === 1,
      "I1d escolher seções e período; a pergunta vai junto; o pedido aparece uma vez só");
    /* a janela */
    api.plIniciar();
    api.plAbrir({ aba: "geral" });
    api.$("btnPlogCopiar").onclick();
    ok(api.$("dlgAeIa").open && api.t("plog_copiar") === "🤖 Pedir análise à IA", "I2a o botão do cabeçalho abre 'Pedir análise à IA'");
    ok(["geral", "orient", "tempo", "desemp", "cob", "disc", "plano"].every((k) => !!api.$("chkAeIa_" + k)) && api.$("chkAeIa_plano").checked === false && api.$("chkAeIa_geral").checked === true,
      "I2b as sete seções, com a conta do plano desmarcada");
    ok(/^PEDIDO: /.test(api.$("aeIaPrevia").value) && /caracteres/.test(api.$("aeIaInfo").textContent), "I2c a prévia e o tamanho");
    const chk = api.$("chkAeIa_tempo");
    chk.checked = false; chk.onchange();
    ok(api.aeIaSecoesLer().tempo === false && !/== TEMPO REAL/.test(api.$("aeIaPrevia").value), "I2d desmarcar uma seção tira do pedido e fica lembrado");
    api.$("aeIaPergunta").value = "Vale largar B?";
    api.$("aeIaPergunta").oninput();
    const pv = api.$("aeIaPrevia").value;
    ok(/\nMINHA PERGUNTA: Vale largar B\?\n\nANALISE DO ESTUDO/.test(pv) && (pv.match(/MINHA PERGUNTA/g) || []).length === 1, "I2g a pergunta entra logo depois do pedido, uma vez só (sem refazer as contas)");
    api.$("btnAeIaCopiar").onclick();
    ok(janela.__area === api.$("aeIaPrevia").value && /Pedido copiado/.test(api.$("aeIaMsg").textContent), "I2e copiar leva o pedido inteiro");
    ok(api.$("btnAeIaGemini").hidden === true && api.$("aeIaSemChave").hidden === false, "I2f sem chave e sem autorização: só copiar, e o aviso de como ligar");
    /* com a chave e a autorização: o Gemini responde na janela */
    api.vzGuardarChave("AIzaTESTE123456"); api.aeIaLigar(true);
    let corpo = null;
    janela.fetch = async (url, op) => { corpo = JSON.parse(op.body); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "Diagnóstico: estude mais A." }] } }] }) }; };
    api.aeIaAbrir();
    ok(api.$("btnAeIaGemini").hidden === false, "I3a com a chave e a autorização, aparece 'Perguntar ao Gemini'");
    await api.aeIaGemini();
    ok(corpo && /^PEDIDO: /.test(corpo.contents[0].parts[0].text) && api.$("aeIaResp").hidden === false && /estude mais A/.test(api.$("aeIaResp").value) && api.$("btnAeIaRespCopiar").hidden === false,
      "I3b o pedido vai ao Gemini e a resposta aparece, com 'copiar a resposta'");
    ok((api.registroAtual() || []).some((e) => e.tipo === "ANALISE" && /Gemini direto/.test(e.msg)), "I3c a consulta fica no registro (sem o texto)");
    ok(/id="chkVzAeIa"/.test(html), "I3d a autorização mora na tela da chave, como as outras");
    api.vzGuardarChave(""); api.aeIaLigar(false);
  }

  /* R1: o registro para relatar — botão no cabeçalho, a aba vista no registro, e a aba que falha diz onde está o erro */
  {
    const { api } = rodar();
    api.plIniciar();
    api.plAbrir({ aba: "tempo" });
    const regs = () => api.registroAtual() || [];
    ok(regs().some((e) => e.tipo === "ANALISE" && /aberta/.test(e.msg) && /tempo/.test(String(e.extra))), "R1a abrir a análise fica no registro, com a aba");
    api.plAbaTrocar("sinais");
    ok(regs().some((e) => e.tipo === "ANALISE" && /aba da análise/.test(e.msg) && e.extra === "sinais"), "R1b trocar de aba também");
    ok(/id="btnPlogRegistro"/.test(html) && api.t("plog_registro") === "🩺 Registro", "R1c o botão do registro no cabeçalho");
    api.$("btnPlogRegistro").onclick();
    for (let i = 0; i < 20 && !api.$("dlgDiagnostico").open; i++) await new Promise((r) => setImmediate(r));
    ok(api.$("dlgDiagnostico").open === true, "R1d o botão abre o Diagnóstico e registro (de onde se copia para relatar)");
    const box = api.$("plogCorpo");
    box.innerHTML = "";
    const r = api.plRede(box, () => { throw new Error("número estranho"); });
    ok(r === false && regs().some((e) => e.tipo === "ERRO" && /análise do estudo/.test(e.msg) && /número estranho/.test(String(e.extra))), "R1e a aba que falha deixa o erro no registro");
    ok(/não conseguiu se desenhar/.test(box.textContent) && /número estranho/.test(box.textContent) && /Registro/.test(box.textContent), "R1f e diz o que houve, com o botão do registro");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
