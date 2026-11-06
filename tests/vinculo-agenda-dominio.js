/* (19.87.0) O VÍNCULO PASSA A VALER FORA DA TELA DE COMPARAR.
 *
 * Antes, ligar dois tópicos só mudava o selo "também cai em X" e a oferta de marcar o gêmeo no registro. A agenda
 * punha os dois na mesma semana (18 pares com ISS e SEFAZ ativos), o Domínio lia cada edital sozinho (44 folhas cinza
 * com o gêmeo estudado) e o TJ PB entrou sem nenhum vínculo, com 14 tópicos de nome idêntico aos dos outros editais.
 *
 *   A1–A6  a agenda: o par ALTA vira UMA linha, com o selo do outro edital; MEDIA e arquivado não fundem; nada marcado
 *   K1–K2  a tradução única de chaves (material → vínculo)
 *   P1–P10 o Domínio lê o par pela regra ASSIMÉTRICA (o ruim vale inteiro sem medida daqui; o bom sobe só até azul)
 *   S1–S8  as sugestões: mesmo nome em disciplinas compatíveis, mesma lei com um tópico por edital, confirmação em lote
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  };
  const conduzir = async (api, promessa, sim) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(sim !== false); } catch (e) {}
    }
    return promessa;
  };
  const achar = (el, re, out) => {
    out = out || [];
    Array.from((el && el.children) || []).forEach((f) => { if (re.test(f.className || "")) out.push(f); achar(f, re, out); });
    return out;
  };
  const linhasDaAgenda = (api) => achar(api.$("edAgendaTopo"), /(^| )ed-item( |$)/);

  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const a = api.edCriar("ISS", [
      "# ISS Auditor | prova: " + daqui(60) + " | horas: 20",
      "@ Direito Financeiro :: 5",
      "+ Receita pública :: 5",
      "+ Restos a pagar :: 4",
      "@ Português :: 2",
      "+ Crase :: 3",
    ].join("\n"));
    const b = api.edCriar("SEFAZ", [
      "# SEFAZ Auditor | prova: " + daqui(90) + " | horas: 20",
      "@ Finanças Públicas :: 5",
      "+ Ingressos públicos :: 5",
      "+ Despesa pública :: 4",
      "@ Língua Portuguesa :: 2",
      "+ Pontuação :: 3",
    ].join("\n"));
    return { a, b };
  };
  const ligar = (api, edB, D, T, D2, T2, conf) => api.vkAplicar([{
    de: { chave: api.vkChave(D, T), disciplina: D, topico: T },
    para: { chave: api.vkChave(D2, T2), disciplina: D2, topico: T2 },
    conf: conf || "ALTA", sugestao: "SERVE" }], edB.id, "ambos");

  /* ---------------- K: a tradução única ---------------- */
  {
    const { api } = rodar();
    ok(api.vkDaChaveMat(api.matChave("Direito Financeiro", "Lei nº 4.320/1964")) === api.vkChave("Direito Financeiro", "Lei nº 4.320/1964"),
      "K1 a chave do material (com nº, ponto e barra) traduzida tem de ser a chave do vínculo: "
      + api.vkDaChaveMat(api.matChave("Direito Financeiro", "Lei nº 4.320/1964")) + " × " + api.vkChave("Direito Financeiro", "Lei nº 4.320/1964"));
    ok(api.vkDaChaveMat("Ética›Código de Ética") === api.vkChave("ETICA", "codigo de etica"),
      "K2 acento e caixa não separam a mesma chave");
  }

  /* ---------------- A: a agenda ---------------- */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    api.hubPintarAgenda();
    const antes = linhasDaAgenda(api).length;
    const metaAntes = api.hubUltimaAgendaAtual ? api.hubUltimaAgendaAtual().metaMin : null;
    ligar(api, b, "Direito Financeiro", "Receita pública", "Finanças Públicas", "Ingressos públicos");
    api.hubPintarAgenda();
    const depois = linhasDaAgenda(api);
    ok(depois.length === antes - 1, "A1 o par ALTA tem de virar UMA linha na agenda: " + antes + " → " + depois.length);
    const tambem = achar(api.$("edAgendaTopo"), /(^| )ed-selo-tambem( |$)/);
    ok(tambem.length === 1 && [api.edNomeCurtoConcurso("SEFAZ"), api.edNomeCurtoConcurso("ISS")].map((c) => api.t("hub_tambem_selo", { n: c })).indexOf(tambem[0].textContent) >= 0,
      "A2 a linha que ficou leva o selo '+ outro edital': " + tambem.map((x) => x.textContent).join(" | "));
    ok(tambem.length === 1 && /Ingressos públicos|Receita pública/.test(tambem[0].title), "A2b o balão do selo diz qual tópico do outro edital: " + (tambem[0] && tambem[0].title));
    const linhaJunta = depois.filter((li) => achar(li, /(^| )ed-selo-tambem( |$)/).length)[0];
    ok(linhaJunta && !achar(linhaJunta, /(^| )so-coincide( |$)/).length, "A2c a linha juntada não repete 'também cai em' ao lado do '+ outro edital'");
    const aviso = achar(api.$("edAgendaTopo"), /(^| )ed-ag-aviso( |$)/)[0];
    ok(aviso && aviso.textContent.indexOf(api.t("hub_ag_fundidos", { n: 1 })) >= 0, "A3 a agenda diz que um assunto ligado aparece uma vez só: " + (aviso && aviso.textContent));
    if (metaAntes !== null) {
      const metaDepois = api.hubUltimaAgendaAtual().metaMin;
      ok(metaDepois < metaAntes, "A3b o tempo do par conta UMA vez na meta: " + metaAntes + " → " + metaDepois);
    }
    ok(!Object.keys(a.progresso || {}).length && !Object.keys(b.progresso || {}).length, "A4 fundir na agenda não marca nada como estudado em nenhum dos editais");

    /* arquivar o vínculo desfaz a fusão */
    const v = api.vinculosAtual()[0];
    api.vkArquivar([v], true);
    api.hubPintarAgenda();
    ok(linhasDaAgenda(api).length === antes && !achar(api.$("edAgendaTopo"), /(^| )ed-selo-tambem( |$)/).length, "A5 vínculo arquivado não funde");
  }
  {
    const { api } = rodar();
    const { b } = montar(api);
    api.hubPintarAgenda();
    const antes = linhasDaAgenda(api).length;
    ligar(api, b, "Direito Financeiro", "Receita pública", "Finanças Públicas", "Ingressos públicos", "MEDIA");
    api.hubPintarAgenda();
    ok(linhasDaAgenda(api).length === antes, "A6 vínculo MEDIA ('provavelmente o mesmo') não tira linha da semana");
  }
  /* a função, direto: estudo não funde com revisão, e o mesmo edital nunca funde consigo */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    ligar(api, b, "Direito Financeiro", "Receita pública", "Finanças Públicas", "Ingressos públicos");
    const L = (ed, d, t, rev) => ({ edital: ed.id, editalNome: ed.nome, disciplina: d, nome: t, chave: (d + "›" + t).toLowerCase(), ehRevisao: !!rev });
    const l1 = [L(a, "Direito Financeiro", "Receita pública"), L(b, "Finanças Públicas", "Ingressos públicos", true)];
    ok(api.hubFundirVinculados(l1) === 0 && l1.length === 2, "A7 estudo e revisão do par ficam separados (são tarefas diferentes)");
    const l2 = [L(a, "Direito Financeiro", "Receita pública"), L(b, "Finanças Públicas", "Ingressos públicos")];
    ok(api.hubFundirVinculados(l2) === 1 && l2.length === 1 && l2[0].tambem[0].edital === b.id, "A8 o par do mesmo tipo funde, e a primeira linha guarda o outro edital");
  }

  /* ---------------- P: o Domínio lê o par (a regra, pura) ---------------- */
  {
    const { api } = rodar();
    const D = api.DOM;
    const acerto = (pct, n) => ({ n: n || 10, pct, valido: (n || 10) >= D.minQuestoes });
    const cinza = api.domNivel({ estudo: { estado: "nunca" } });
    const fonte = (x) => Object.assign({ ed: "ISS", conf: "ALTA", acerto: { valido: false }, retencao: { valido: false }, auto: null, estudo: { estado: "nunca" } }, x);

    const p1 = api.domAplicarPar(cinza, {}, [fonte({ acerto: acerto(40) })]);
    ok(p1.nivel === "vermelho" && p1.motivos[0].cod === "par_acerto_baixo" && p1.motivos[0].ed === "ISS" && p1.herdadoPar[0] === "ISS",
      "P1 acerto baixo lá, nada medido aqui: vermelho, com o motivo 'herdado de ISS': " + JSON.stringify(p1));
    ok(!p1.motivos.some((m) => m.cod === "nunca_estudado"), "P1b o vermelho herdado não diz ao mesmo tempo 'ainda não estudado'");

    const verdeAqui = api.domNivel({ estudo: { estado: "estudado" }, acerto: acerto(90) });
    const p2 = api.domAplicarPar(verdeAqui, { acerto: acerto(90) }, [fonte({ acerto: acerto(30) })]);
    ok(p2.nivel === "verde", "P2 o que foi MEDIDO aqui manda: acerto bom aqui não vira vermelho pelo de lá: " + p2.nivel);

    const p3 = api.domAplicarPar(cinza, {}, [fonte({ estudo: { estado: "estudado" }, acerto: acerto(95) })]);
    ok(p3.nivel === "azul" && p3.motivos[0].cod === "par_estudado", "P3 o bom de lá sobe só até AZUL (verde se ganha aqui): " + p3.nivel);

    const azulAqui = api.domNivel({ estudo: { estado: "estudado" } });
    const p4 = api.domAplicarPar(azulAqui, {}, [fonte({ estudo: { estado: "estudado" } })]);
    ok(p4.nivel === "azul" && !p4.herdadoPar, "P4 já estudado aqui: o par bom não muda nada (nem marca herdado)");

    const p5 = api.domAplicarPar(cinza, {}, [fonte({ conf: "MEDIA", acerto: acerto(20) })]);
    ok(p5.nivel === "cinza" && p5.motivos.some((m) => m.cod === "par_provavel" && m.ed === "ISS"), "P5 vínculo MEDIA não muda a cor: só a nota 'provável': " + JSON.stringify(p5));
    const p5b = api.domAplicarPar(cinza, {}, [fonte({ conf: "MEDIA", estudo: { estado: "estudado" } })]);
    ok(p5b.nivel === "cinza", "P5b MEDIA bom também não sobe");

    const p6 = api.domAplicarPar(cinza, {}, [fonte({ auto: { nivel: "alta", vencida: false } })]);
    ok(p6.nivel === "vermelho" && p6.motivos[0].cod === "par_inseguro", "P6 'difícil' lá vale aqui quando aqui não há autoavaliação");
    const p6b = api.domAplicarPar(cinza, {}, [fonte({ auto: { nivel: "baixa", vencida: false } })]);
    ok(p6b.nivel === "cinza", "P6b 'domino' lá NÃO sobe nada aqui (declarado não é medido)");

    const txt = api.domPorque(p1.motivos);
    ok(txt.indexOf("ISS") >= 0 && txt.indexOf("40%") >= 0, "P7 o porquê diz de onde veio a cor: " + txt);
  }
  /* o Domínio de verdade: dois editais, o par ALTA, o estudo e as questões de lá */
  {
    const { api } = rodar();
    const { a, b } = montar(api);
    ligar(api, b, "Direito Financeiro", "Receita pública", "Finanças Públicas", "Ingressos públicos");
    a.progresso = a.progresso || {};
    a.progresso[api.matChave("Direito Financeiro", "Receita pública")] = { e: "feito", d: daqui(-3) };
    a.progresso[api.matChave("Direito Financeiro", "Restos a pagar")] = { e: "feito", d: daqui(-3) };
    const fol = (m, top) => m.folhas.filter((f) => f.topico === top)[0];
    const m1 = api.domDoEdital(b);
    const f1 = fol(m1, "Ingressos públicos");
    ok(f1 && f1.nivel === "azul" && f1.motivos.some((x) => x.cod === "par_estudado" && x.ed === "ISS"),
      "P8 estudado no ISS e ligado: na SEFAZ sai de cinza para azul, herdado de ISS: " + JSON.stringify(f1 && { n: f1.nivel, m: f1.motivos }));
    ok(fol(m1, "Despesa pública").nivel === "cinza", "P8b o tópico sem vínculo continua cinza (Restos a pagar não está ligado a nada)");
    ok(m1.resumo.parN === 1, "P8c o resumo conta as folhas tiradas do par: " + m1.resumo.parN);
    /* as questões de lá, ruins, viram vermelho aqui */
    const Q = (id, ac) => ({ id, tipo: "ce", enunciado: "Q " + id, gabarito: "C", comentario: "", disciplina: "Direito Financeiro", topico: "Receita pública",
      chave: api.matChave("Direito Financeiro", "Receita pública"), tentativas: [{ q: "2026-10-0" + (id % 9 + 1), acertou: ac }] });
    for (let i = 0; i < 8; i++) api.qsTodas().push(Q(100 + i, i < 2));
    const f2 = fol(api.domDoEdital(b), "Ingressos públicos");
    ok(f2.nivel === "vermelho" && f2.motivos[0].cod === "par_acerto_baixo" && f2.motivos[0].ed === "ISS",
      "P9 acerto de 25% no ISS (sem questões na SEFAZ): vermelho herdado: " + JSON.stringify(f2 && { n: f2.nivel, m: f2.motivos }));
    /* o retrato marca, e a evolução avisa a virada */
    const snap = api.domSnapDe(api.domDoEdital(b), b.id, 1, "2026-11-06");
    ok(snap && snap.par === 1, "P10 o retrato guarda quantas folhas vieram do par: " + (snap && snap.par));
    const velhos = [{ d: "2026-10-20", ed: String(b.id), f: 1, dist: {} }, { d: "2026-10-27", ed: String(b.id), f: 1, dist: {} }];
    ok(api.domParVirada(velhos.concat([snap]), b.id, 1) === "2026-11-06", "P10b a evolução acha o dia em que a régua mudou");
    ok(api.domParVirada([snap], b.id, 1) === null, "P10c sem retrato antigo, não há virada a avisar");
  }

  /* ---------------- S: as sugestões ---------------- */
  {
    const { api } = rodar();
    const lista = [
      { id: 1, nome: "ISS", topicos: [{ disciplina: "Noções de Direito Administrativo", nome: "Atos administrativos" }, { disciplina: "Português", nome: "Concordância verbal" }, { disciplina: "Direito Tributário", nome: "Conceito" }, { disciplina: "AFO", nome: "Lei de Responsabilidade Fiscal" }] },
      { id: 2, nome: "TJ PB", topicos: [{ disciplina: "Direito Administrativo", nome: "Atos administrativos" }, { disciplina: "Raciocínio Lógico", nome: "Concordância verbal" }, { disciplina: "Direito Tributário", nome: "Conceito" }, { disciplina: "Direito Financeiro", nome: "Gestão fiscal" }] },
    ];
    const s1 = api.vkSugeridos(lista, []);
    ok(s1.length === 1 && s1[0].motivo === "nome" && s1[0].de.topico === "Atos administrativos",
      "S1 mesmo nome em disciplinas compatíveis entra; em disciplinas diferentes (Português × Raciocínio) e nome curto ('Conceito') não: " + JSON.stringify(s1.map((x) => x.de.disciplina + "›" + x.de.topico)));
    ok(api.vkDiscCompativeis("Noções de Direito Administrativo", "Direito Administrativo") && api.vkDiscCompativeis("Português", "Língua Portuguesa")
      && api.vkDiscCompativeis("Direito Tributário", "Legislação Tributária") && !api.vkDiscCompativeis("Direito Constitucional", "Direito Administrativo")
      && !api.vkDiscCompativeis("Direito", "Direito Penal"),
      "S1b disciplinas compatíveis pelo NÚCLEO do nome: o 'Direito' comum não faz Constitucional virar Administrativo");
    const leis = [{ id: "lrf", nome: "LRF", topicos: ["afo›lei de responsabilidade fiscal", "direito financeiro›gestão fiscal"] }];
    const s2 = api.vkSugeridos(lista, leis);
    ok(s2.some((x) => x.motivo === "lei" && x.lei === "LRF"), "S2 a mesma lei ligada a um tópico em cada edital sugere o par: " + JSON.stringify(s2.map((x) => x.motivo)));
    const leis2 = [{ id: "cf", nome: "CF", topicos: ["afo›lei de responsabilidade fiscal", "direito financeiro›gestão fiscal", "direito tributário›conceito"] }];
    ok(!api.vkSugeridos(lista, leis2).some((x) => x.motivo === "lei"), "S3 lei ligada a VÁRIOS tópicos de um edital não diz qual com qual: sem sugestão por lei");
    /* confirmar: marcados viram vínculo ALTA 'ambos'; desmarcados não voltam */
    const novos = api.vkSugConfirmar([s2.filter((x) => x.motivo === "nome")[0]], s2.filter((x) => x.motivo === "lei"));
    const v = api.vinculosAtual();
    ok(novos === 1 && v.length === 1 && v[0].conf === "ALTA" && v[0].modo === "ambos" && v[0].origem === "auto_nome", "S4 o marcado vira vínculo ALTA, modo ambos, origem auto_nome: " + JSON.stringify(v));
    ok(api.vkSugeridos(lista, leis).length === 0, "S5 o já ligado e o recusado não voltam a ser sugeridos");
    ok(api.gruposBackup.edital.indexOf("eac_vk_sug_recusados") >= 0, "S6 a lista de recusados vai no backup");
  }
  /* na agenda: o chip, a lista para conferir, e depois a fusão */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    api.edCriar("ISS", ["# ISS | prova: " + daqui(60) + " | horas: 20", "@ Direito Financeiro :: 5", "+ Receita pública orçamentária :: 5", "+ Crédito público :: 3"].join("\n"));
    api.edCriar("SEFAZ", ["# SEFAZ | prova: " + daqui(90) + " | horas: 20", "@ Noções de Direito Financeiro :: 5", "+ Receita pública orçamentária :: 5", "+ Dívida ativa :: 3"].join("\n"));
    api.hubPintarAgenda();
    const chip = achar(api.$("edAgendaTopo"), /(^| )hub-aviso-chip( |$)/).filter((c) => c.id === "hubAviso_vinc")[0];
    ok(chip && chip.textContent.indexOf(api.t("hub_av_vinc", { n: 1 })) === 0, "S7 a agenda mostra o chip de vínculos sugeridos: " + (chip && chip.textContent));
    const antes = linhasDaAgenda(api).length;
    await conduzir(api, api.hubVincRevisar(api.hubVinculosSugeridos(api.editaisLista())), true);
    ok(api.vinculosAtual().length === 1, "S8 confirmar a lista cria o vínculo: " + api.vinculosAtual().length);
    const depois = linhasDaAgenda(api).length;
    ok(depois === antes - 1 && !achar(api.$("edAgendaTopo"), /(^| )hub-aviso-chip( |$)/).some((c) => c.id === "hubAviso_vinc"), "S8b depois de ligar, o par vira uma linha e o chip some: " + antes + " → " + depois);
  }

  /* a MESMA chave nos dois editais: funde sem vínculo, o registro oferece o de lá, e o Domínio lê o estudo de lá */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const a = api.edCriar("ISS", ["# ISS | prova: " + daqui(60) + " | horas: 20", "@ Português :: 5", "+ Crase :: 5", "+ Regência :: 3"].join("\n"));
    const b = api.edCriar("SEFAZ", ["# SEFAZ | prova: " + daqui(90) + " | horas: 20", "@ Português :: 5", "+ Crase :: 5", "+ Pontuação :: 3"].join("\n"));
    api.hubPintarAgenda();
    const crase = linhasDaAgenda(api).filter((li) => /Crase/.test(li.textContent || ""));
    ok(crase.length === 1 && achar(api.$("edAgendaTopo"), /(^| )ed-selo-tambem( |$)/).length === 1, "I1 'Português › Crase' nos dois editais é UMA linha, sem vínculo nenhum: " + crase.length);
    ok(api.vkSugeridos([{ id: a.id, nome: "ISS", topicos: [{ disciplina: "Português", nome: "Crase" }] }, { id: b.id, nome: "SEFAZ", topicos: [{ disciplina: "Português", nome: "Crase" }] }], []).length === 0,
      "I2 a chave idêntica não precisa de vínculo: não é sugerida");
    ok(api.vkEspelhosDe("Português", "Crase", a.id, api.editaisLista()).map((d) => d.editalId).join() === String(b.id), "I3 o registro oferece marcar o de lá (desmarcado)");
    a.progresso = a.progresso || {};
    a.progresso[api.matChave("Português", "Crase")] = { e: "feito", d: daqui(-2) };
    const f = api.domDoEdital(b).folhas.filter((x) => x.topico === "Crase")[0];
    ok(f && f.nivel === "azul" && f.motivos.some((m) => m.cod === "par_estudado" && m.ed === "ISS"), "I4 estudado no ISS: na SEFAZ a mesma chave sai de cinza para azul, herdado de ISS: " + JSON.stringify(f && { n: f.nivel, m: f.motivos }));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
