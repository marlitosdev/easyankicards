/* =====================================================================
 * DOMÍNIO DOS ASSUNTOS: TRÊS VISÕES E TOPO ENXUTO (v18.86.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. três visões (Prioridades · Disciplinas · Evolução), a escolhida é lembrada; aberto numa disciplina, vai ao mapa;
 *  2. a barra do peso por nível fica no topo preso, fora das visões; a explicação mora no "?" (aberta só na 1ª vez);
 *  3. a manchete só é vermelha com algo vermelho ou revisão vencida — muito não estudado é tom neutro;
 *  4. Prioridades: a fila vem primeiro, com o PORQUÊ à vista e o ganho dos 5 primeiros; respeita o filtro;
 *  5. Disciplinas: as sem nada estudado ficam recolhidas no fim (abertas se for o pedido ou se não houver outras);
 *  6. os cortes em vigor no título dos ajustes; os pares de campos não se partem.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test(e.className || "");
  const EDITAL = ["# ISS | prova: 2027-06-01 | horas: 20", "@ Licitações :: 5", "+ Lei 14.133 :: 5", "++ Modalidades :: 5", "++ Fase preparatória",
    "+ Convênios :: 2", "@ Direito Financeiro :: 4", "+ Receita Pública :: 4"].join("\n");
  const montar = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const ed = a.edCriar("ISS Caruaru Auditor", EDITAL);
    return { a, ed };
  };
  const pain = (a, aba) => achar(a.$("domCorpo"), (e) => cls(e, "dom-painel-" + aba))[0];

  /* ---- 1, 2, 3: abrir, visões, topo, "?" e o tom da manchete ---- */
  {
    const { a, ed } = montar();
    a.domAbrir(ed.id);
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(["dom-fixo", "dom-ajuda", "dom-aj-par", "dom-manchete-info", "dom-ganho", "dom-item-porque", "dom-sem-estudo"].every((c) => html.indexOf("." + c) >= 0), "D0 as classes novas têm CSS");
    ok(a.$("dlgDominio").open === true && pain(a, "prior").hidden === false && pain(a, "disc").hidden === true && pain(a, "evo").hidden === true
      && a.$("btnDomAbaPrior").getAttribute("aria-selected") === "true", "D1 abre em Prioridades (só aquela visão à mostra)");
    const fixo = achar(a.$("domCorpo"), (e) => cls(e, "dom-fixo"))[0];
    ok(fixo && achar(fixo, (e) => cls(e, "dom-dist")).length === 1 && achar(fixo, (e) => cls(e, "cov-manchete")).length === 1 && !achar(pain(a, "prior"), (e) => cls(e, "dom-dist")).length,
      "D2 a manchete e a barra do peso ficam no topo preso, fora das visões");
    ok(a.$("domSub").hidden === false, "D2a na primeira vez, a explicação aparece");
    const man = achar(fixo, (e) => cls(e, "cov-manchete"))[0];
    ok(cls(man, "dom-manchete-info") && !cls(man, "cov-manchete-alerta"), "D3 nada vermelho, tudo por estudar: manchete em tom neutro, não de alerta");
    a.$("dlgDominio").close();
    a.domAbrir(ed.id);
    ok(a.$("domSub").hidden === true, "D2b depois, a explicação fica recolhida no '?'");
    a.$("btnDomAjuda").onclick();
    ok(a.$("domSub").hidden === false && a.$("btnDomAjuda").getAttribute("aria-expanded") === "true", "D2c o '?' mostra a explicação");
    a.difDefinir("Licitações", "Lei 14.133", "alta", "declarada");
    a.domPintar();
    const man2 = achar(a.$("domCorpo"), (e) => cls(e, "cov-manchete"))[0];
    ok(cls(man2, "cov-manchete-alerta"), "D3a com algo vermelho, a manchete vira alerta");
  }

  /* ---- 4: Prioridades ---- */
  {
    const { a, ed } = montar();
    a.difDefinir("Licitações", "Lei 14.133", "alta", "declarada");
    a.domAbrir(ed.id);
    const m = a.domDoEdital(ed);
    const p = pain(a, "prior");
    const itens = achar(p, (e) => cls(e, "dom-item"));
    ok(itens.length === Math.min(15, m.reforcar.length) && itens.every((l) => achar(l, (e) => cls(e, "dom-item-porque")).length === 1),
      "D4 a fila inteira, cada item com o PORQUÊ à vista");
    const tot = m.resumo.total;
    const g = m.reforcar.slice(0, 5).reduce((x, f) => x + f.pesoPct, 0) / tot * 100;
    const ganho = achar(p, (e) => cls(e, "dom-ganho"))[0];
    const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
    ok(ganho && ganho.textContent.indexOf("+" + fmt(g) + "%") >= 0, "D4a o ganho dos 5 primeiros: +" + fmt(g) + "% — " + (ganho && ganho.textContent));
    const verm = achar(a.$("domFiltros"), (e) => cls(e, "dom-filtro"))[1];
    verm.onclick();
    const p2 = pain(a, "prior");
    const it2 = achar(p2, (e) => cls(e, "dom-item"));
    ok(it2.length >= 1 && it2.every((l) => cls(l, "dom-b-vermelho")) && !achar(p2, (e) => cls(e, "dom-ganho")).length && p2.hidden === false,
      "D4b o filtro vale para a fila (só os vermelhos; sem a frase do ganho)");
    achar(a.$("domFiltros"), (e) => cls(e, "dom-filtro"))[3].onclick();   /* azul: ninguém */
    ok(achar(pain(a, "prior"), (e) => cls(e, "dom-item")).length === 0 && pain(a, "prior").textContent.indexOf(a.t("dom_reforcar_vazio")) >= 0, "D4c filtro sem ninguém: diz que não há o que reforçar");
  }

  /* ---- 4d: com um ramo PULADO o total do peso fica abaixo de 100 — o ganho é sobre o que conta ---- */
  {
    const { a, ed } = montar();
    ed.progresso = ed.progresso || {};
    const chs = Object.keys(a.domDoEdital(ed).folhas.reduce((o, f) => { o[f.chave] = 1; return o; }, {}));
    const chLei = chs.find((c) => /14\.133/.test(c));
    ed.progresso[chLei + "›#fase_preparatoria"] = { e: "pulado", d: "2026-10-01" };
    a.domAbrir(ed.id);
    const m = a.domDoEdital(ed);
    const g = m.reforcar.slice(0, 5).reduce((x, f) => x + f.pesoPct, 0) / m.resumo.total * 100;
    const ganho = achar(pain(a, "prior"), (e) => cls(e, "dom-ganho"))[0];
    const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
    ok(m.resumo.total < 99.9 && ganho && ganho.textContent.indexOf("+" + fmt(g) + "%") >= 0, "D4d com um ramo pulado (total " + m.resumo.total.toFixed(1) + "), o ganho é relativo ao que conta: " + (ganho && ganho.textContent));
  }

  /* ---- 5: Disciplinas ---- */
  {
    const { a, ed } = montar();
    a.domAbrir(ed.id);
    /* nada estudado: tudo recolhido — e aberto, porque não há outra coisa para ver */
    a.$("btnDomAbaDisc").onclick();
    let det = achar(pain(a, "disc"), (e) => cls(e, "dom-sem-estudo"))[0];
    ok(pain(a, "disc").hidden === false && pain(a, "prior").hidden === true && det && det.open === true && achar(det, (e) => cls(e, "cov-disc")).length === 2,
      "D5 nada estudado: as 2 disciplinas no grupo 'sem nada estudado', aberto");
    a.difDefinir("Licitações", "Lei 14.133", "alta", "declarada");
    a.domPintar();
    det = achar(pain(a, "disc"), (e) => cls(e, "dom-sem-estudo"))[0];
    const fora = achar(pain(a, "disc"), (e) => cls(e, "cov-disc")).filter((e) => !achar(det, (x) => x === e).length);
    ok(det.open === false && achar(det, (e) => cls(e, "cov-disc")).length === 1 && /Direito Financeiro/.test(det.textContent) && fora.length === 1 && /Licitações/.test(fora[0].textContent)
      && /1 disciplina/.test(achar(det, (e) => e.tagName === "SUMMARY")[0].textContent),
      "D5a quem já tem estudo vem primeiro; a sem estudo fica recolhida no fim, com a contagem");
    a.$("dlgDominio").close();
    a.domAbrir(ed.id);
    ok(pain(a, "disc").hidden === false, "D5b a visão escolhida é lembrada");
    a.$("btnDomAbaPrior").onclick();
    a.$("dlgDominio").close();
    a.domAbrir(ed.id, "Direito Financeiro");
    det = achar(pain(a, "disc"), (e) => cls(e, "dom-sem-estudo"))[0];
    ok(pain(a, "disc").hidden === false && det.open === true, "D5c aberto numa disciplina sem estudo: vai ao mapa e abre o grupo onde ela está");
    /* 6: evolução e cortes */
    a.$("btnDomAbaEvo").onclick();
    ok(pain(a, "evo").hidden === false && a.$("domFiltros").hidden === true && achar(pain(a, "evo"), (e) => cls(e, "dom-evo")).length === 1, "D6 Evolução: o gráfico na sua visão, sem os filtros");
    a.$("btnDomAbaDisc").onclick();
    ok(a.$("domFiltros").hidden === false, "D6a os filtros voltam no mapa");
    ok(a.$("domAjustesSum").textContent === a.t("dom_ajustes_v", { a: 60, b: 75, c: 70, d: 85 }), "D7 os cortes em vigor no título: " + a.$("domAjustesSum").textContent);
  }
  /* ---- 8: tela larga — mapa e fila lado a lado; Evolução na sua aba ---- */
  {
    const { a, ed } = montar();
    a.difDefinir("Licitações", "Lei 14.133", "alta", "declarada");
    a.domLargoForcar(true);
    a.domAbrir(ed.id);
    const corpo = a.$("domCorpo");
    const pDisc = pain(a, "disc"), pPrior = pain(a, "prior");
    const ordem = Array.from(corpo.children).map((e) => (/dom-painel-(\w+)/.exec(e.className || "") || [])[1]).filter(Boolean);
    ok(cls(corpo, "dom-duas") && cls(a.$("dlgDominio"), "dom-largo") && pDisc.hidden === false && pPrior.hidden === false && pain(a, "evo").hidden === true && ordem.join() === "disc,prior,evo",
      "L1 tela larga: mapa (esquerda) e fila (direita) visíveis ao mesmo tempo, a evolução escondida: " + ordem.join());
    ok(a.$("btnDomAbaDisc").hidden === true && a.$("btnDomAbaPrior").textContent === a.t("dom_aba_painel") && a.$("btnDomAbaPrior").getAttribute("aria-selected") === "true",
      "L1a as abas viram duas: 'Mapa e prioridades' e 'Evolução'");
    a.$("btnDomAbaEvo").onclick();
    ok(!cls(a.$("domCorpo"), "dom-duas") && pain(a, "evo").hidden === false && pain(a, "disc").hidden === true && pain(a, "prior").hidden === true, "L2 na Evolução, uma coluna só");
    a.$("btnDomAbaPrior").onclick();
    ok(cls(a.$("domCorpo"), "dom-duas") && pain(a, "disc").hidden === false, "L2a volta ao lado a lado");
    a.domAbaDefinir("disc");
    ok(pain(a, "prior").hidden === false, "L2b lembrado 'disciplinas' (do celular): na tela larga, as duas colunas do mesmo jeito");
    a.domLargoForcar(false);
    a.domPintar();
    ok(!cls(a.$("domCorpo"), "dom-duas") && a.$("btnDomAbaDisc").hidden === false && pain(a, "prior").hidden === true && pain(a, "disc").hidden === false, "L3 de volta à tela estreita: três abas, uma visão por vez");
    const sum = achar(pain(a, "disc"), (e) => e.tagName === "SUMMARY")[0];
    ok(sum && /Direito Financeiro \d/.test(sum.textContent), "L4 o grupo das não iniciadas diz as maiores pelo nome e peso: " + (sum && sum.textContent));
  }
  /* ---- 9: tela cheia é o padrão; o botão alterna e a escolha é lembrada; fechar sai da tela cheia ---- */
  {
    const { a, ed } = montar();
    const dlg = a.$("dlgDominio");
    a.domAbrir(ed.id);
    ok(cls(dlg, "dom-cheia") && a.$("btnDomCheia").textContent === a.t("dom_cheia_sair") && a.$("btnDomCheia").getAttribute("aria-pressed") === "true",
      "F1 o Domínio abre em tela cheia (padrão), e o botão oferece voltar à janela");
    a.$("btnDomCheia").onclick();
    ok(!cls(dlg, "dom-cheia") && a.$("btnDomCheia").textContent === a.t("dom_cheia"), "F2 o botão volta à janela");
    dlg.close(); ((dlg._ouv && dlg._ouv.close) || []).forEach((f) => f({}));
    a.domAbrir(ed.id);
    ok(!cls(dlg, "dom-cheia"), "F3 a escolha 'janela' é lembrada ao reabrir");
    a.$("btnDomCheia").onclick();
    ok(cls(dlg, "dom-cheia"), "F4 e o botão leva de novo à tela cheia");
    dlg.close(); ((dlg._ouv && dlg._ouv.close) || []).forEach((f) => f({}));
    ok(!cls(dlg, "dom-cheia"), "F5 fechar a janela sai da tela cheia");
    a.domAbrir(ed.id);
    ok(cls(dlg, "dom-cheia"), "F6 reabrir volta à tela cheia (a escolha lembrada)");
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/#dlgDominio\.dom-cheia\[open\]\{width:100vw/.test(html), "F7 a regra da tela cheia ocupa a tela toda (pelo id, vence a largura da janela)");
  }
  /* ---- 10 (v18.87.0): o item da fila — sinais com chute, ramos coloridos, material e a ação principal pela cor ---- */
  {
    const { a, ed } = montar();
    const chLei = a.matChave("Licitações", "Lei 14.133");
    const Q = (id, ts) => ({ id, tipo: "ce", enunciado: "Questão " + id, gabarito: "C", comentario: "", disciplina: "Licitações", topico: "Lei 14.133", chave: chLei, tentativas: ts });
    const t0 = (ok2, chute, d) => [{ acertou: ok2, chute: !!chute, q: "2026-10-1" + d }];
    [Q("a", t0(false, 0, 1)), Q("b", t0(false, 0, 2)), Q("c", t0(false, 0, 3)), Q("d", t0(true, 0, 4)), Q("e", t0(true, 0, 5)), Q("f", t0(true, 1, 6))].forEach((q) => a.qsTodas().push(q));
    a.matGravar(chLei, "Resumo da lei.", { disciplina: "Licitações", topico: "Lei 14.133" });
    a.domAbrir(ed.id);
    const p = pain(a, "prior");
    const itens = achar(p, (e) => cls(e, "dom-item"));
    const doRamo = (nome) => itens.find((l) => achar(l, (e) => cls(e, "cov-item-nome"))[0].textContent.indexOf("› " + nome) >= 0);
    const it = doRamo("Modalidades");
    ok(it && cls(it, "dom-b-vermelho"), "Q0 o ramo herda o acerto baixo do tópico (2,25 de 6): vermelho");
    const chips = achar(it, (e) => cls(e, "dom-chip")).map((e) => e.textContent);
    ok(chips.some((c) => c === a.t("dom_ac_chutes", { n: 1, p: 33 })), "Q1 os sinais dizem o chute e o acerto sem ele (2 de 6 = 33%): " + chips.join(" | "));
    const rchips = achar(it, (e) => cls(e, "dom-ramo-chip"));
    ok(rchips.length === 2 && rchips.some((b) => cls(b, "atual") && /Modalidades/.test(b.textContent)) && rchips.every((b) => /dom-b-/.test(b.className)),
      "Q2 os ramos do tópico aparecem coloridos, o do item marcado");
    const mat = achar(it, (e) => cls(e, "dom-mat")).map((e) => e.textContent);
    ok(mat.indexOf("📄 " + a.t("dom_mat_resumo")) >= 0 && mat.indexOf("❓ 6") >= 0, "Q3 o material do tópico: resumo e 6 questões: " + mat.join(" | "));
    const ac1 = achar(it, (e) => cls(e, "dom-acao-1"))[0];
    ok(ac1 && ac1.textContent === a.t("dom_ac1_erradas", { n: 4 }), "Q4 vermelho com erradas: a ação principal é refazer as 4 (3 erradas + 1 no chute): " + (ac1 && ac1.textContent));
    ac1.onclick();
    ok(a.$("dlgDominio").open === false && a.$("dlgQsResponder").open === true && a.qsSessaoAtual().fila.length === 4, "Q4a refazer abre uma rodada só com as 4");
    a.$("dlgQsResponder").close();
    /* o ramo pela cor do chip: abre a ficha no ramo */
    a.domAbrir(ed.id);
    const itensB = achar(pain(a, "prior"), (e) => cls(e, "dom-item"));
    const itFase = itensB.find((l) => /› Fase preparatória/.test(l.textContent));
    const itMod = itensB.find((l) => /› Modalidades/.test(l.textContent));
    ok(itFase && !achar(itFase, (e) => cls(e, "dom-ramo-chip")).length && achar(itMod, (e) => cls(e, "dom-ramo-chip")).length === 2,
      "Q2a outro ramo do MESMO tópico na fila: a lista de ramos aparece só no primeiro (sem repetir)");
    achar(itMod, (e) => cls(e, "dom-ramo-chip")).find((b) => /Fase preparatória/.test(b.textContent)).onclick();
    ok(a.$("dlgDominio").open === false && a.$("dlgMatFicha").open === true && a.matFichaEscopoAtual() === "fase_preparatoria", "Q5 tocar num ramo abre a ficha já nesse ramo");
    a.$("dlgMatFicha").close();
    /* não estudado e sem nada: preparar o material */
    a.domAbrir(ed.id);
    const conv = achar(pain(a, "prior"), (e) => cls(e, "dom-item")).find((l) => /› Convênios/.test(l.textContent));
    ok(conv && achar(conv, (e) => cls(e, "dom-mat-falta")).some((e) => e.textContent === a.t("dom_mat_nada")) && achar(conv, (e) => cls(e, "dom-acao-1"))[0].textContent === a.t("dom_ac1_preparar")
      && !achar(conv, (e) => cls(e, "dom-ramo-chip")).length,
      "Q6 não estudado e sem material: 'nada preparado' e a ação 'Preparar o material' (sem ramos, sem linha de ramos)");
    achar(conv, (e) => cls(e, "dom-acao-1"))[0].onclick();
    ok(a.$("dlgMatFicha").open === true, "Q6a preparar abre a ficha do tópico");
    a.$("dlgMatFicha").close();
  }
  /* ---- 11: verde frágil (puro) e azul sem questões ---- */
  {
    const { a } = montar();
    const V = (ac, rt) => ({ nivel: "verde", sinais: { acerto: ac, retencao: rt } });
    ok(a.domFragil(V({ valido: true, n: 10, chutes: 1 }, null)) === "chute", "Q7 verde com chute na janela: frágil (chute)");
    ok(a.domFragil(V({ valido: true, n: 6, chutes: 0 }, null)) === "amostra" && a.domFragil(V({ valido: true, n: 6, chutes: 0 }, { valido: true, respostas: 20 })) === "", "Q7a 6 questões sem cartões: amostra pequena; com cartões que contam, firme");
    ok(a.domFragil(V({ valido: false, n: 2 }, { valido: true, respostas: 12 })) === "amostra" && a.domFragil(V({ valido: true, n: 10, chutes: 0 }, null)) === "" && a.domFragil({ nivel: "amarelo", sinais: { acerto: { valido: true, n: 10, chutes: 2 } } }) === "",
      "Q7b só cartões, poucas respostas: frágil; 10 questões sem chute: firme; só vale para o verde");
    const f = { nivel: "azul", tipo: "topico", chave: "x›y", disciplina: "X", topico: "Y" };
    const r0 = a.domAcaoPrincipal(f, { questoes: 0, vazio: true }, []);
    const r1 = a.domAcaoPrincipal(f, { questoes: 7, vazio: false }, []);
    ok(r0.cod === "criar_qs" && r1.cod === "medir" && r1.txt === a.t("dom_ac1_medir", { n: 7 }), "Q8 azul: medir com as questões que há — ou criá-las");
    ok(a.domAcaoPrincipal(Object.assign({}, f, { nivel: "cinza" }), { vazio: true }, []).cod === "preparar" && a.domAcaoPrincipal(Object.assign({}, f, { nivel: "cinza" }), { vazio: false }, []).cod === "comecar" && a.domAcaoPrincipal(Object.assign({}, f, { nivel: "amarelo" }), { vazio: false }, []).cod === "rever",
      "Q8a não estudado com material: começar por ele; amarelo sem erradas: rever o material");
  }
  /* ---- 12 (v18.88.0): barra interativa, ordem por cor, selo na agenda, termômetro do edital ---- */
  {
    const { a, ed } = montar();
    a.difDefinir("Licitações", "Convênios", "alta", "declarada");   /* Convênios vermelho; Lei 14.133 segue não estudado */
    a.domAbrir(ed.id);
    const discLic = () => achar(pain(a, "disc"), (e) => cls(e, "cov-disc")).find((e) => /Licitações/.test(e.textContent));
    const segsLic = () => achar(achar(discLic(), (e) => cls(e, "cov-tira"))[0], (e) => cls(e, "cov-seg"));
    ok(segsLic().length === 2 && /dom-n-cinza/.test(segsLic()[0].className) && /dom-n-vermelho/.test(segsLic()[1].className), "B1 na ordem do edital: Lei 14.133 (não estudado), depois Convênios (vermelho)");
    ok(segsLic()[1].title.indexOf(a.t("dom_seg_tip", { t: "Convênios", p: "2.0", n: a.t("dom_n_vermelho") }).replace("2.0", "").split("%")[1]) >= 0 && /^Convênios · peso/.test(segsLic()[1].title) && /Porque:/.test(segsLic()[1].title),
      "B2 o pedaço diz o tópico, o peso, o nível e o motivo: " + segsLic()[1].title);
    const bCor = achar(pain(a, "disc"), (e) => cls(e, "dom-ordem-b")).find((b) => b.textContent === a.t("dom_ordem_cor"));
    bCor.onclick();
    ok(/dom-n-vermelho/.test(segsLic()[0].className) && /dom-n-cinza/.test(segsLic()[1].className) && a.$("btnDomAbaDisc").getAttribute("aria-selected") !== null,
      "B3 por cor: o vermelho vem primeiro (e a escolha fica)");
    a.$("dlgDominio").close();
    a.domAbrir(ed.id);
    ok(/dom-n-vermelho/.test(segsLic()[0].className), "B3a a ordem por cor é lembrada");
    achar(pain(a, "disc"), (e) => cls(e, "dom-ordem-b")).find((b) => b.textContent === a.t("dom_ordem_edital")).onclick();
    /* tocar no pedaço: abre a disciplina e marca o tópico */
    a.$("btnDomAbaPrior").onclick();
    const segConv = segsLic().find((s) => /dom-n-vermelho/.test(s.className));
    a.segurarAdiados();
    segConv.onclick({ stopPropagation() {} });
    const det = achar(discLic(), (e) => cls(e, "cov-det"))[0];
    const alvo = achar(det, (e) => cls(e, "dom-top")).find((e) => /Convênios/.test(e.textContent));
    ok(pain(a, "disc").hidden === false && det.hidden === false && alvo && cls(alvo, "dom-piscando"), "B4 tocar no pedaço abre o mapa, a disciplina e faz o tópico piscar");
    /* fora da janela: o selo da linha da agenda */
    a.soltarAdiados();
    a.$("dlgDominio").close();
    const selo = a.domSeloDaLinha({ disciplina: "Licitações", nome: "Convênios", edital: ed.id });
    ok(selo && selo.textContent === a.t("dom_curto_vermelho") && /dom-n-vermelho/.test(selo.className), "B5 o selo da linha da agenda diz a cor do domínio");
    ok(a.domSeloDaLinha({ disciplina: "Licitações", nome: "Lei 14.133", edital: ed.id }) === null, "B5a tópico não estudado: sem selo (é o normal, a linha já diz)");
    a.segurarAdiados();
    selo.onclick({ stopPropagation() {} });
    const alvo2 = achar(pain(a, "disc"), (e) => cls(e, "dom-top")).find((e) => /Convênios/.test(e.textContent));
    ok(a.$("dlgDominio").open === true && alvo2 && cls(alvo2, "dom-piscando"), "B5b tocar no selo abre o Domínio já no tópico");
    a.soltarAdiados();
    a.$("dlgDominio").close();
    /* o termômetro do edital */
    const n = a.domTermoPintar(ed.id);
    const termo = a.$("edDomTermo");
    ok(termo.hidden === false && achar(termo, (e) => cls(e, "dom-termo-seg")).length >= 2 && termo.textContent === a.t("dom_termo_txt", { v: 0, r: Math.round(n.pct.vermelho) }),
      "B6 o termômetro mostra a barrinha do peso por nível e o verde/vermelho: " + termo.textContent);
    termo.onclick();
    ok(a.$("dlgDominio").open === true, "B6a tocar no termômetro abre o Domínio");
    a.$("dlgDominio").close();
    ok(a.domTermoPintar("") === null && termo.hidden === true, "B6b sem edital aberto, o termômetro some");
    /* a memória curta: o mesmo objeto dentro de 2 s; forçar recalcula */
    const c1 = a.domNiveisDoEdital(ed.id), c2 = a.domNiveisDoEdital(ed.id), c3 = a.domNiveisDoEdital(ed.id, true);
    ok(c1 === c2 && c3 !== c1, "B7 a agenda reaproveita o cálculo enquanto nada muda (não refaz o mapa a cada linha)");
    a.difDefinir("Direito Financeiro", "Receita Pública", "alta", "declarada");
    const c4 = a.domNiveisDoEdital(ed.id);
    ok(c4 !== c3 && Object.values(c4.porTopico).some((x) => x.topico === "Receita Pública" && x.nivel === "vermelho"), "B7a mudou uma entrada (autoavaliação): recalcula na hora");
    a.qsTodas().push({ id: "qq", tipo: "ce", enunciado: "x", gabarito: "C", comentario: "", disciplina: "Licitações", topico: "Lei 14.133", chave: a.matChave("Licitações", "Lei 14.133"), tentativas: [{ acertou: true }] });
    ok(a.domNiveisDoEdital(ed.id) !== c4, "B7b uma resposta nova a uma questão também recalcula");
    /* a linha de verdade da agenda (edLinhaTopico) traz o selo */
    a.hubAbrirEdital(ed.id);
    a.$("editalTexto").value = ed.texto; a.$("edProva").value = "2027-06-01"; a.$("edHoras").value = "20";
    const item = a.edItemDoPlano("Licitações", "Convênios");
    const li = item ? a.edLinhaTopico(item) : null;
    ok(li && achar(li, (e) => cls(e, "dom-selo-linha")).length === 1 && termo.hidden === false, "B8 a linha da agenda mostra o selo do domínio, e abrir o edital pinta o termômetro");
    const itLei = a.edItemDoPlano("Licitações", "Lei 14.133");
    ok(itLei && !achar(a.edLinhaTopico(itLei), (e) => cls(e, "dom-selo-linha")).length, "B8a a linha do não estudado fica sem selo");
  }
  return falhas;
}

module.exports = { testes };
