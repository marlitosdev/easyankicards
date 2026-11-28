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
 *  (19.193.0) MESTRE-DETALHE: a fila em linhas compactas (só a ação principal e o ⋯), o cartão inteiro no DETALHE; o
 *  mapa em uma linha por disciplina, com marcas além da cor (posição na fila, listras, risco, ramos) e balão; os filtros
 *  acendem no mapa sem esconder; a busca em todos os tópicos; o teclado (↑↓, Enter, Esc, ←→ na barra).
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
  const montar = (aba) => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    if (aba !== null) a.domAbaDefinir(aba || "prior", true);
    const ed = a.edCriar("ISS Caruaru Auditor", EDITAL);
    return { a, ed };
  };
  const pain = (a, aba) => achar(a.$("domCorpo"), (e) => cls(e, "dom-painel-" + aba))[0];

  /* ---- 1, 2, 3: abrir, visões, topo, "?" e o tom da manchete ---- */
  {
    const { a, ed } = montar(null);
    a.domAbrir(ed.id);
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(["dom-fixo", "dom-ajuda", "dom-aj-par", "dom-manchete-info", "dom-ganho", "dom-item-porque", "dom-sem-estudo", "dom-linha", "dom-linha-sel", "dom-linha-menu", "dom-tl", "dom-busca",
      "dom-det", "dom-det-nav", "dom-seg-balao", "dom-seg-incerto", "dom-seg-venc", "dom-seg-sub", "dom-mapa-leg", "dom-ajuda-leg", "dom-det-menu", "dom-det-agenda", "dom-tl-ag", "dom-apagado", "dom-disc-fim"].every((c) => html.indexOf("." + c) >= 0), "D0 as classes novas têm CSS");
    ok(a.$("dlgDominio").open === true && pain(a, "disc").hidden === false && pain(a, "prior").hidden === true && pain(a, "evo").hidden === true && pain(a, "det").hidden === true
      && a.$("btnDomAbaDisc").getAttribute("aria-selected") === "true", "D1 (19.215.0) sem escolha lembrada, abre no mapa (Disciplinas): o Domínio é diagnóstico");
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
    ok(a.$("domSub").hidden === false && a.$("btnDomAjuda").getAttribute("aria-expanded") === "true" && a.$("domAjustesCx").hidden === false, "D2c o 'ⓘ' mostra a explicação e os cortes do semáforo");
    a.$("btnDomAjuda").onclick();
    ok(a.$("domAjustesCx").hidden === true, "D2d fechado o 'ⓘ', os cortes saem do topo junto");
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
    const linhas = achar(p, (e) => cls(e, "dom-linha"));
    const filaG = a.domFilaAgrupada(m.reforcar);
    ok(linhas.length === Math.min(a.DOM_LINHAS, filaG.length) && filaG.length < m.reforcar.length
      && linhas.every((l) => achar(l, (e) => cls(e, "dom-linha-pq")).length === 1 && achar(l, (e) => cls(e, "dom-acao-1")).length === 1 && achar(l, (e) => cls(e, "dom-mais")).length === 1),
      "D4 a fila em linhas compactas: cada uma com o porquê curto, a ação principal e o ⋯");
    ok(!achar(p, (e) => cls(e, "dom-item")).length, "D4e o cartão inteiro de cada item não fica mais na fila (mora no detalhe)");
    const tot = m.resumo.total;
    const g = filaG.slice(0, 5).reduce((x, f) => x + f.pesoPct, 0) / tot * 100;
    const ganho = achar(p, (e) => cls(e, "dom-ganho"))[0];
    const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
    ok(ganho && ganho.textContent.indexOf("+" + fmt(g) + "%") >= 0, "D4a o ganho dos 5 primeiros: +" + fmt(g) + "% — " + (ganho && ganho.textContent));
    const verm = achar(a.$("domFiltros"), (e) => cls(e, "dom-filtro")).find((b) => /^vermelho/.test(b.textContent));
    verm.onclick();
    const p2 = pain(a, "prior");
    const it2 = achar(p2, (e) => cls(e, "dom-linha"));
    ok(it2.length >= 1 && it2.every((l) => cls(l, "dom-b-vermelho")) && !achar(p2, (e) => cls(e, "dom-ganho")).length && p2.hidden === false,
      "D4b o filtro vale para a fila (só os vermelhos; sem a frase do ganho)");
    ok(!achar(a.$("domFiltros"), (e) => cls(e, "dom-filtro")).some((b) => /^não medido/.test(b.textContent)), "D4f o filtro sem ninguém (azul) nem aparece");
    a.domFiltroDefinir("azul");
    ok(achar(pain(a, "prior"), (e) => cls(e, "dom-linha")).length === 0 && pain(a, "prior").textContent.indexOf(a.t("dom_reforcar_vazio")) >= 0, "D4c filtro sem ninguém: diz que não há o que reforçar");
    a.domFiltroDefinir("todos");
    /* tocar numa linha: o detalhe no lugar da lista (tela estreita); "← Voltar" volta */
    const l0 = achar(pain(a, "prior"), (e) => cls(e, "dom-linha"))[0];
    const nome0 = achar(l0, (e) => cls(e, "dom-linha-nome"))[0].textContent;
    l0.onclick();
    const itD = achar(pain(a, "det"), (e) => cls(e, "dom-item"))[0];
    ok(a.domDetAtual() === true && pain(a, "det").hidden === false && pain(a, "prior").hidden === true && itD && achar(itD, (e) => cls(e, "cov-item-nome"))[0].textContent === nome0
      && achar(itD, (e) => cls(e, "dom-item-porque")).length === 1 && achar(pain(a, "det"), (e) => cls(e, "dom-auto")).length >= 1,
      "D4g tocar na linha abre o DETALHE no lugar da lista: o cartão inteiro (porquê, sinais, ações) e a minha avaliação: " + nome0);
    achar(pain(a, "det"), (e) => e.id === "btnDomDetVoltar")[0].onclick();
    ok(a.domDetAtual() === false && pain(a, "det").hidden === true && pain(a, "prior").hidden === false && cls(achar(pain(a, "prior"), (e) => cls(e, "dom-linha"))[0], "dom-linha-sel"),
      "D4h '← Voltar' volta à lista, com a linha escolhida marcada");
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
    const g = a.domFilaAgrupada(m.reforcar).slice(0, 5).reduce((x, f) => x + f.pesoPct, 0) / m.resumo.total * 100;
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
    ok(cls(corpo, "dom-duas") && cls(a.$("dlgDominio"), "dom-largo") && pDisc.hidden === false && pPrior.hidden === false && pain(a, "det").hidden === false && pain(a, "evo").hidden === true && ordem.join() === "disc,prior,det,evo",
      "L1 tela larga: mapa e fila (esquerda) e o detalhe (direita) visíveis ao mesmo tempo, a evolução escondida: " + ordem.join());
    const linL = achar(pPrior, (e) => cls(e, "dom-linha"));
    const nomeDet = () => (achar(achar(pain(a, "det"), (e) => cls(e, "dom-item"))[0], (e) => cls(e, "cov-item-nome"))[0] || {}).textContent;
    const nomeLin = (l) => achar(l, (e) => cls(e, "dom-linha-nome"))[0].textContent;
    ok(linL.length >= 2 && cls(linL[0], "dom-linha-sel") && nomeDet() === nomeLin(linL[0]) && !achar(pain(a, "det"), (e) => e.id === "btnDomDetVoltar").length,
      "L1b na tela larga o detalhe nunca fica vazio: o primeiro da fila, já escolhido (sem o '← Voltar')");
    a.domTecla({ key: "ArrowDown", target: {}, preventDefault() {} });
    const linL2 = achar(pain(a, "prior"), (e) => cls(e, "dom-linha"));
    ok(cls(linL2[1], "dom-linha-sel") && nomeDet() === nomeLin(linL2[1]), "L1c ↓ passa ao segundo e o detalhe acompanha: " + nomeDet());
    ok(a.$("btnDomAbaDisc").hidden === true && a.$("btnDomAbaPrior").textContent === a.t("dom_aba_painel") && a.$("btnDomAbaPrior").getAttribute("aria-selected") === "true",
      "L1a as abas viram duas: 'Mapa e prioridades' e 'Evolução'");
    a.$("btnDomAbaEvo").onclick();
    ok(!cls(a.$("domCorpo"), "dom-duas") && pain(a, "evo").hidden === false && pain(a, "disc").hidden === true && pain(a, "prior").hidden === true && pain(a, "det").hidden === true, "L2 na Evolução, uma coluna só");
    a.$("btnDomAbaPrior").onclick();
    ok(cls(a.$("domCorpo"), "dom-duas") && pain(a, "disc").hidden === false, "L2a volta ao lado a lado");
    a.domAbaDefinir("disc");
    ok(pain(a, "prior").hidden === false, "L2b lembrado 'disciplinas' (do celular): na tela larga, as duas colunas do mesmo jeito");
    a.domLargoForcar(false);
    a.domPintar();
    ok(!cls(a.$("domCorpo"), "dom-duas") && a.$("btnDomAbaDisc").hidden === false && pain(a, "prior").hidden === true && pain(a, "disc").hidden === false && pain(a, "det").hidden === true, "L3 de volta à tela estreita: três abas, uma visão por vez (o detalhe só quando se abre um item)");
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
    a.domAgruparDefinir(false);   /* estes casos olham um ramo por item (o modo "um por um") */
    a.domAbrir(ed.id);
    const linhas = () => achar(pain(a, "prior"), (e) => cls(e, "dom-linha"));
    const linhaDe = (nome) => linhas().find((l) => achar(l, (e) => cls(e, "dom-linha-nome"))[0].textContent.indexOf("› " + nome) >= 0);
    const detItem = () => achar(pain(a, "det"), (e) => cls(e, "dom-item"))[0];
    const lm = linhaDe("Modalidades");
    ok(lm && cls(lm, "dom-b-vermelho"), "Q0 o ramo herda o acerto baixo do tópico (2,25 de 6): vermelho");
    lm.onclick();
    const it = detItem();
    ok(it && cls(it, "dom-b-vermelho") && /› Modalidades$/.test(achar(it, (e) => cls(e, "cov-item-nome"))[0].textContent), "Q0a a linha abre o detalhe do ramo");
    const chips = achar(it, (e) => cls(e, "dom-chip")).map((e) => e.textContent);
    ok(chips.some((c) => c === a.t("dom_ac_chutes", { n: 1, p: 33 })), "Q1 os sinais dizem o chute e o acerto sem ele (2 de 6 = 33%): " + chips.join(" | "));
    const rchips = achar(it, (e) => cls(e, "dom-ramo-chip"));
    ok(rchips.length === 2 && rchips.some((b) => cls(b, "atual") && /Modalidades/.test(b.textContent)) && rchips.every((b) => /dom-b-/.test(b.className)),
      "Q2 os ramos do tópico aparecem coloridos, o do item marcado");
    const mat = achar(it, (e) => cls(e, "dom-mat")).map((e) => e.textContent);
    ok(mat.indexOf("📄 " + a.t("dom_mat_resumo")) >= 0 && mat.indexOf("❓ 6") >= 0, "Q3 o material do tópico: resumo e 6 questões: " + mat.join(" | "));
    const ac1 = achar(lm, (e) => cls(e, "dom-acao-1"))[0];
    ok(ac1 && ac1.textContent === a.t("dom_ac1_erradas", { n: 4 }) && achar(it, (e) => cls(e, "dom-acao-1"))[0].textContent === ac1.textContent,
      "Q4 vermelho com erradas: a ação principal (na linha e no detalhe) é refazer as 4 (3 erradas + 1 no chute): " + (ac1 && ac1.textContent));
    ac1.onclick();
    ok(a.$("dlgDominio").open === false && a.$("dlgQsResponder").open === true && a.qsSessaoAtual().fila.length === 4, "Q4a refazer abre uma rodada só com as 4");
    a.$("dlgQsResponder").close();
    /* o ramo pela cor do chip: abre a ficha no ramo */
    a.domAbrir(ed.id);
    linhaDe("Fase preparatória").onclick();
    const itFase = detItem();
    ok(itFase && achar(itFase, (e) => cls(e, "dom-ramo-chip")).length === 2 && achar(itFase, (e) => cls(e, "dom-ramo-chip")).some((b) => cls(b, "atual") && /Fase preparatória/.test(b.textContent)),
      "Q2a o detalhe de outro ramo do MESMO tópico: os ramos do tópico, com ele marcado");
    const rdet = achar(pain(a, "det"), (e) => cls(e, "dom-det-ramos"))[0];
    ok(rdet && rdet.open === true && achar(rdet, (e) => cls(e, "dom-ramo-atual")).some((x) => /Fase preparatória/.test(x.textContent)), "Q2b aberto por um ramo, a lista dos ramos vem aberta, com ele em destaque");
    achar(itFase, (e) => cls(e, "dom-ramo-chip")).find((b) => /Fase preparatória/.test(b.textContent)).onclick();
    ok(a.$("dlgDominio").open === false && a.$("dlgMatFicha").open === true && a.matFichaEscopoAtual() === "fase_preparatoria", "Q5 tocar num ramo abre a ficha já nesse ramo");
    a.$("dlgMatFicha").close();
    /* não estudado e sem nada: preparar o material */
    a.domAbrir(ed.id);
    const lconv = linhaDe("Convênios");
    lconv.onclick();
    const conv = detItem();
    ok(conv && achar(conv, (e) => cls(e, "dom-mat-falta")).some((e) => e.textContent === a.t("dom_mat_nada")) && achar(conv, (e) => cls(e, "dom-acao-1"))[0].textContent === a.t("dom_ac1_preparar")
      && achar(lconv, (e) => cls(e, "dom-acao-1"))[0].textContent === a.t("dom_ac1_preparar") && !achar(conv, (e) => cls(e, "dom-ramo-chip")).length,
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
    const rot = segsLic()[1].getAttribute("aria-label") || "";
    ok(/^Licitações › Convênios · vermelho · vale [\d,]+% da prova/.test(rot) && /Porque:/.test(rot),
      "B2 o pedaço diz (a quem não vê a cor) o tópico, o nível, o peso e o motivo: " + rot);
    segsLic()[1].onmouseenter();
    const bal = a.domSegBalaoAtual();
    ok(bal && /Licitações › Convênios/.test(bal.textContent) && /Porque:/.test(bal.textContent) && achar(a.$("dlgDominio"), (e) => e === bal).length === 1,
      "B2a passar o mouse (ou focar) mostra o balão do pedaço, dentro da janela");
    segsLic()[1].onmouseleave();
    ok(!a.domSegBalaoAtual(), "B2b e ele some ao sair");
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
    const alvo = achar(pain(a, "det"), (e) => cls(e, "dom-top"))[0];
    ok(pain(a, "det").hidden === false && a.domDetAtual() === true && det.hidden === false && alvo && /Convênios/.test(alvo.textContent) && cls(alvo, "dom-piscando")
      && cls(segsLic().find((x) => /dom-n-vermelho/.test(x.className)), "dom-seg-sel"),
      "B4 tocar no pedaço abre o DETALHE do tópico (piscando), a disciplina aberta no mapa e o pedaço marcado");
    /* fora da janela: o selo da linha da agenda */
    a.soltarAdiados();
    a.$("dlgDominio").close();
    const selo = a.domSeloDaLinha({ disciplina: "Licitações", nome: "Convênios", edital: ed.id });
    ok(selo && selo.textContent === a.t("dom_curto_vermelho") && /dom-n-vermelho/.test(selo.className), "B5 o selo da linha da agenda diz a cor do domínio");
    ok(a.domSeloDaLinha({ disciplina: "Licitações", nome: "Lei 14.133", edital: ed.id }) === null, "B5a tópico não estudado: sem selo (é o normal, a linha já diz)");
    a.segurarAdiados();
    selo.onclick({ stopPropagation() {} });
    const alvo2 = achar(pain(a, "det"), (e) => cls(e, "dom-top"))[0];
    ok(a.$("dlgDominio").open === true && alvo2 && /Convênios/.test(alvo2.textContent) && cls(alvo2, "dom-piscando") && pain(a, "det").hidden === false, "B5b tocar no selo abre o Domínio já no detalhe do tópico");
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
  /* ---- 13 (v18.89.0): a fila agrupada por tópico ---- */
  {
    const { a, ed } = montar();
    /* Fase preparatória vermelha (marcada difícil); Modalidades sem marca: não estudado */
    const chLei = a.matChave("Licitações", "Lei 14.133");
    a.difDefinir("Licitações", "Lei 14.133›#fase_preparatoria", "alta", "declarada");
    const m = a.domDoEdital(ed);
    const ramosNaFila = m.reforcar.filter((f) => f.chave === chLei);
    const g = a.domFilaAgrupada(m.reforcar);
    const gl = g.find((x) => x.chave === chLei);
    ok(ramosNaFila.length === 2 && gl && gl.tipo === "grupo" && gl.ramosFila.length === 2 && g.filter((x) => x.chave === chLei).length === 1,
      "G1 os 2 ramos de Lei 14.133 viram UM item: " + ramosNaFila.map((f) => f.ramoNome + ":" + f.nivel).join(", "));
    ok(Math.abs(gl.pesoPct - ramosNaFila.reduce((x, f) => x + f.pesoPct, 0)) < 1e-9 && Math.abs(gl.urgencia - ramosNaFila.reduce((x, f) => x + f.urgencia, 0)) < 1e-9,
      "G2 peso e urgência do grupo = a soma dos ramos (o tópico inteiro)");
    ok(gl.nivel === "vermelho" && gl.pior.ramoNome === "Fase preparatória", "G3 a cor e o motivo vêm do ramo mais fraco");
    ok(g.every((x, i) => i === 0 || g[i - 1].urgencia >= x.urgencia) && g[0] === gl, "G4 a fila reordena pela urgência do grupo: o tópico inteiro passa à frente");
    a.domAbrir(ed.id);
    const itens = () => achar(pain(a, "prior"), (e) => cls(e, "dom-linha"));
    const lin = itens().find((l) => /Lei 14\.133/.test(l.textContent));
    ok(lin && achar(lin, (e) => cls(e, "dom-linha-nome"))[0].textContent === "Licitações › Lei 14.133" && achar(lin, (e) => cls(e, "dom-linha-pq"))[0].textContent.indexOf(a.t("dom_grupo_pior", { r: "Fase preparatória" })) >= 0,
      "G5 a linha do grupo: o tópico e o ramo mais fraco no porquê");
    lin.onclick();
    const it = achar(pain(a, "det"), (e) => cls(e, "dom-item"))[0];
    ok(it && achar(it, (e) => cls(e, "cov-item-n"))[0].textContent === a.t("dom_urg_grupo", { p: gl.pesoPct.toFixed(1), f: Math.round((gl.urgencia / gl.pesoPct) * 10) / 10, n: 2 })
      && achar(it, (e) => cls(e, "dom-item-porque"))[0].textContent.indexOf(a.t("dom_grupo_pior", { r: "Fase preparatória" })) === 0,
      "G5a o detalhe do grupo: o peso com os ramos na fila e o ramo mais fraco no porquê");
    const chips = achar(it, (e) => cls(e, "dom-ramo-chip"));
    ok(chips.length === 2 && chips.every((b) => cls(b, "na-fila")) && chips.some((b) => cls(b, "atual") && /Fase/.test(b.textContent)), "G6 os ramos da fila marcados, o mais fraco em destaque");
    const bts = achar(pain(a, "prior"), (e) => cls(e, "dom-agrupar-b"));
    ok(bts.length === 2 && cls(bts[0], "ativa"), "G7 a escolha 'agrupar por tópico | um por um', agrupado por padrão");
    bts[1].onclick();
    ok(itens().filter((l) => /Lei 14\.133/.test(l.textContent)).length === 2, "G8 'um por um': cada ramo volta a ser um item (e fica lembrado)");
    a.$("dlgDominio").close(); a.domAbrir(ed.id);
    ok(itens().filter((l) => /Lei 14\.133/.test(l.textContent)).length === 2, "G8a lembrado ao reabrir");
    achar(pain(a, "prior"), (e) => cls(e, "dom-agrupar-b"))[0].onclick();
    ok(itens().filter((l) => /Lei 14\.133/.test(l.textContent)).length === 1, "G8b de volta ao agrupado");
  }
  /* ---- 14 (19.193.0): o mapa em linhas, as marcas além da cor, os filtros que acendem, a busca e o teclado ---- */
  {
    const { a, ed } = montar();
    const chRec = a.matChave("Direito Financeiro", "Receita Pública");
    for (let i = 0; i < 6; i++) a.qsTodas().push({ id: "r" + i, tipo: "ce", enunciado: "Q" + i, gabarito: "C", comentario: "", disciplina: "Direito Financeiro", topico: "Receita Pública", chave: chRec, tentativas: [{ acertou: true, chute: false, q: "2026-11-1" + i }] });
    a.difDefinir("Licitações", "Convênios", "alta", "declarada");
    a.domAbrir(ed.id);
    const rec = a.domDoEdital(ed).disciplinas.find((d) => d.nome === "Direito Financeiro").topicos[0];
    ok(rec.nivel === "verde", "M0 preparo: Receita Pública verde (6 de 6): " + rec.nivel);
    const discs = () => achar(pain(a, "disc"), (e) => cls(e, "dom-disc"));
    const d0 = discs()[0];
    const kids = Array.from(d0.children).map((e) => String(e.className).split(" ")[0]);
    ok(kids.join() === "cov-disc-cab,cov-tira,dom-disc-fim,cov-det" && /✓ \d+%/.test(achar(d0, (e) => cls(e, "dom-disc-verde"))[0].textContent),
      "M1 uma linha por disciplina: o nome e o peso, a barra e o verde no fim (os tópicos recolhidos embaixo): " + kids.join());
    ok(!achar(pain(a, "disc"), (e) => cls(e, "dom-ramo")).length && achar(pain(a, "disc"), (e) => cls(e, "dom-tl")).length === 3, "M1a no mapa, uma linha curta por tópico; os ramos moram no detalhe");
    const segDe = (nome) => { const c = a.domCtxAtual(); const tp = Object.values(c.topPorChave).find((x) => x.nome === nome); return c.segs[tp.chave]; };
    const sRec = segDe("Receita Pública"), sConv = segDe("Convênios");
    ok(cls(sRec, "dom-seg-incerto") && !cls(sConv, "dom-seg-incerto"), "M2 o verde com amostra pequena (6 questões) vem listrado: medida incerta");
    const nConv = a.domCtxAtual().posFila[a.matChave("Licitações", "Convênios")];
    ok(nConv >= 1 && !achar(pain(a, "disc"), (e) => cls(e, "dom-seg-n")).length,
      "M2a (19.215.0) o pedaço não traz mais o número da fila (um canal a menos na barra): " + nConv);
    ok(/Receita Pública/.test(sRec.getAttribute("aria-label")) && /vale [\d,]+% da prova/.test(sRec.getAttribute("aria-label")), "M2b o pedaço diz o que é a quem não vê a cor");
    a.difDefinir("Licitações", a.domChaveAuto("Lei 14.133", "modalidades"), "alta", "declarada");
    a.domPintar();
    const sub = achar(segDe("Lei 14.133"), (e) => cls(e, "dom-seg-sub"))[0];
    ok(sub && sub.children.length === 2 && cls(sub.children[0], "dom-n-vermelho") && cls(sub.children[1], "dom-n-cinza"), "M2c ramos de cores diferentes: a faixa fina embaixo mostra a cor de cada um");
    ok(!achar(pain(a, "disc"), (e) => cls(e, "dom-mapa-leg")).length && achar(a.$("domLegCx"), (e) => cls(e, "dom-leg-amostra")).length === 3,
      "M2d (19.215.0) 'como ler a barra' mora no ⓘ, com as três marcas (listras, risco, ramos), e não antes do mapa");
    /* os filtros acendem */
    const nDisc = discs().length;
    a.domFiltroDefinir("vermelho");
    ok(discs().length === nDisc && cls(segDe("Receita Pública"), "dom-apagado") && !cls(segDe("Convênios"), "dom-apagado") && !cls(segDe("Lei 14.133"), "dom-apagado"),
      "M3 filtro vermelho: o mapa continua inteiro; só o que tem vermelho fica aceso");
    const filtros = achar(a.$("domFiltros"), (e) => cls(e, "dom-filtro"));
    const fv = filtros.find((b) => /^vermelho/.test(b.textContent));
    ok(fv && cls(fv, "ativa") && achar(fv, (e) => cls(e, "dom-n-vermelho")).length === 1 && !filtros.some((b) => /^amarelo/.test(b.textContent)), "M3a os chips têm a cor (são a legenda); os vazios (amarelo) não aparecem");
    fv.onclick();
    ok(a.domFiltroAtual() === "todos", "M3b tocar de novo no filtro ativo apaga o filtro");
    achar(achar(a.$("domCorpo"), (e) => cls(e, "dom-dist"))[0], (e) => cls(e, "dom-n-verde"))[0].onclick();
    ok(a.domFiltroAtual() === "verde" && achar(pain(a, "prior"), (e) => cls(e, "dom-linha")).some((l) => /Receita Pública/.test(l.textContent) && cls(l, "dom-linha-fora")),
      "M3c tocar numa cor da barra do topo filtra por ela; o verde (fora da fila) aparece na lista");
    a.domFiltroDefinir("todos");
    /* a busca */
    a.domBuscaDefinir("receita");
    const lin = achar(pain(a, "prior"), (e) => cls(e, "dom-linha"));
    ok(lin.length === 1 && /Direito Financeiro › Receita Pública/.test(lin[0].textContent) && pain(a, "prior").textContent.indexOf(a.t("dom_busca_tit", { n: 1 })) >= 0 && a.$("domBusca").value === "receita",
      "M4 a busca acha também o que está fora da fila (o verde)");
    ok(cls(segDe("Convênios"), "dom-apagado") && !cls(segDe("Receita Pública"), "dom-apagado") && achar(discs().find((d) => /Direito Financeiro/.test(d.textContent)), (e) => cls(e, "cov-det"))[0].hidden === false,
      "M4a no mapa, a busca acende o tópico e abre a disciplina dele");
    a.domBuscaDefinir("licitacoes modal");
    const lin2 = achar(pain(a, "prior"), (e) => cls(e, "dom-linha"));
    ok(lin2.length === 1 && /Lei 14\.133/.test(lin2[0].textContent), "M4b sem acento e por pedaços (até pelo nome do ramo)");
    a.domBuscaDefinir("");
    /* o teclado */
    const ev = (key, target) => ({ key, target: target || {}, preventDefault() { this.p = true; } });
    const linhas = () => achar(pain(a, "prior"), (e) => cls(e, "dom-linha"));
    a.domSelecionar(null);
    const e1 = ev("ArrowDown");
    a.domTecla(e1);
    ok(e1.p && a.domSelAtual() && a.domSelAtual().chave === a.domCtxAtual().linhas[0].chave && cls(linhas()[0], "dom-linha-sel") && a.domDetAtual() === false,
      "T1 ↓ escolhe a primeira linha (na tela estreita o detalhe não abre sozinho)");
    a.domTecla(ev("ArrowDown"));
    ok(cls(linhas()[1], "dom-linha-sel") && !cls(linhas()[0], "dom-linha-sel"), "T1a ↓ de novo: a segunda");
    a.domTecla(ev("Enter", linhas()[1]));
    ok(a.domDetAtual() === true && pain(a, "det").hidden === false && pain(a, "prior").hidden === true, "T2 Enter abre o detalhe no lugar da lista");
    a.domTecla(ev("ArrowUp"));
    ok(a.domSelAtual().chave === a.domCtxAtual().linhas[0].chave && pain(a, "det").hidden === false, "T2a com o detalhe aberto, ↑ passa ao vizinho sem fechar");
    ok(/1 de \d+/.test(achar(pain(a, "det"), (e) => cls(e, "dom-det-pos"))[0].textContent) && achar(pain(a, "det"), (e) => cls(e, "dom-det-ant"))[0].disabled === true, "T2b o detalhe diz a posição e tem ‹ ›");
    const dlg = a.$("dlgDominio");
    const ec = { preventDefault() { this.p = true; } };
    ((dlg._ouv && dlg._ouv.cancel) || []).forEach((f) => f(ec));
    ok(ec.p && a.domDetAtual() === false && pain(a, "prior").hidden === false && dlg.open === true, "T3 Esc volta do detalhe à lista (sem fechar a janela)");
    const ec2 = { preventDefault() { this.p = true; } };
    ((dlg._ouv && dlg._ouv.cancel) || []).forEach((f) => f(ec2));
    ok(!ec2.p, "T3a na lista, o Esc segue o normal (fecha a janela)");
    const e5 = ev("/");
    a.domTecla(e5);
    ok(e5.p, "T4 '/' vai à busca");
    /* o ⋯ */
    const l0 = linhas()[0], l1 = linhas()[1];
    const m0 = achar(l0, (e) => cls(e, "dom-linha-menu"))[0], m1 = achar(l1, (e) => cls(e, "dom-linha-menu"))[0];
    achar(l0, (e) => cls(e, "dom-mais"))[0].onclick({ stopPropagation() {} });
    const bts = achar(m0, (e) => e.tag === "button").map((b) => b.textContent);
    ok(m0.hidden === false && bts.some((x) => /Abrir/.test(x)) && bts.some((x) => /Questões/.test(x)) && bts.some((x) => /Criar|Estudar/.test(x)), "T5 o ⋯ mostra as outras ações: " + bts.join(" | "));
    achar(l1, (e) => cls(e, "dom-mais"))[0].onclick({ stopPropagation() {} });
    ok(m0.hidden === true && m1.hidden === false, "T5a um ⋯ aberto por vez");
    /* ←→ e Enter na barra */
    const tira0 = a.domCtxAtual().tiras[0];
    const e6 = ev("ArrowRight", tira0.segs[0].el);
    a.domTecla(e6);
    ok(e6.p && tira0.segs[1].el.tabIndex === 0 && tira0.segs[0].el.tabIndex === -1, "T6 →: o próximo pedaço da barra fica com o foco (um só por barra na ordem do Tab)");
    const tp1 = tira0.segs[1].tp;
    a.domTecla(ev("Enter", tira0.segs[1].el));
    ok(a.domDetAtual() === true && a.domSelAtual().chave === tp1.chave && /›/.test(achar(pain(a, "det"), (e) => cls(e, "cov-item-nome"))[0].textContent), "T6a Enter no pedaço abre o detalhe do tópico: " + tp1.nome);
    /* Esc na busca: limpa a busca, e o cancel do mesmo Esc não fecha a janela */
    a.domBuscaDefinir("receita");
    const eb = { key: "Escape", target: a.$("domBusca"), preventDefault() { this.p = true; } };
    a.domTecla(eb);
    const ec3 = { preventDefault() { this.p = true; } };
    ((dlg._ouv && dlg._ouv.cancel) || []).forEach((f) => f(ec3));
    ok(eb.p && ec3.p && a.$("domBusca").value === "" && achar(pain(a, "prior"), (e) => cls(e, "dom-linha")).length >= 2, "M4c Esc na busca limpa a busca (e não fecha a janela)");
  }
  /* ---- (19.215.0) VERSÃO ENXUTA: o ⓘ, uma ação no detalhe e a posição na AGENDA ---- */
  {
    const { a, ed } = montar(null);
    a.domAbrir(ed.id);
    ok(a.$("domLegCx").hidden === false && a.$("domTeclas").hidden === false && a.$("domSub").hidden === false, "E1 na primeira vez, o ⓘ aberto mostra a explicação, a legenda e o teclado");
    ok(a.t("dom_sub").length < 260 && a.t("dom_sub").indexOf("agenda") >= 0, "E1a a explicação é curta e diz que o que estudar é a agenda: " + a.t("dom_sub").length);
    a.$("btnDomAjuda").onclick();
    ok(a.$("domLegCx").hidden === true && a.$("domTeclas").hidden === true, "E1b fechado o ⓘ, a legenda e o teclado saem do topo");
    /* a agenda desenhada é a fonte: a mesma lista, na mesma ordem */
    a.hubPintarAgenda();
    const ag = a.hubUltimaAgendaAtual();
    const meus = (ag.itens || []).filter((x) => x.edital === String(ed.id));
    ok(meus.length >= 1 && ag.editais.indexOf(String(ed.id)) >= 0 && typeof ag.nHoje === "number", "E2 a agenda guarda a lista da semana, os editais e quantas são de hoje: " + meus.length);
    a.domPintar();
    const c = a.domCtxAtual();
    const x0 = meus[0];
    const tp0 = Object.values(c.topPorChave).find((tp) => tp.chave === x0.chave);
    const tl0 = tp0 && c.tls[tp0.chave];
    ok(tp0 && tl0 && achar(tl0, (e) => cls(e, "dom-tl-ag")).length === 1, "E3 no mapa, o tópico da agenda leva o selo 📅 (hoje ou nesta semana): " + x0.nome);
    const nSelos = achar(pain(a, "disc"), (e) => cls(e, "dom-tl-ag")).length;
    ok(nSelos === meus.length, "E3a um selo por tópico da agenda deste edital: " + nSelos + " de " + meus.length);
    a.domIrAoTopico(c.discDoTop[tp0.chave].nome, tp0.chave);
    const onde = achar(pain(a, "det"), (e) => cls(e, "dom-det-onde"))[0];
    const esperado = a.t(ag.nHoje >= 1 ? "dom_det_ag_hoje" : "dom_det_ag_semana", { i: 1, n: ag.itens.length });
    ok(onde && onde.textContent === esperado && cls(onde, "dom-det-agenda") && /fila do que reforçar|Fora da fila/.test(onde.title || ""),
      "E4 o detalhe diz onde o tópico está na agenda (a fila do reforço fica no balão): " + (onde && onde.textContent));
    /* uma ação à vista no detalhe; o resto no ⋯ */
    const det = pain(a, "det");
    const acoes = achar(det, (e) => cls(e, "dom-item-acoes"))[0];
    const menu = achar(acoes, (e) => cls(e, "dom-det-menu"))[0];
    ok(achar(acoes, (e) => cls(e, "dom-acao-1")).length === 1 && achar(acoes, (e) => cls(e, "dom-mais")).length === 1 && menu && menu.hidden === true
      && achar(menu, (e) => cls(e, "cov-acoes")).length === 1 && !Array.from(acoes.children).some((e) => cls(e, "cov-acoes")),
      "E5 o detalhe mostra uma ação (a que mais ajuda na cor) e o ⋯; abrir, cartões, questões e registrar ficam no menu");
    achar(acoes, (e) => cls(e, "dom-mais"))[0].onclick({ stopPropagation() {} });
    ok(menu.hidden === false, "E5a o ⋯ abre o menu das outras ações");
    /* sem agenda para o edital: a fila do reforço, como antes; tópico fora da agenda: diz isso */
    ok(a.domNaAgenda(null, "X", { chave: "k", nome: "k" }) === null, "E6 sem agenda, nada a dizer (o detalhe volta à fila do reforço)");
    ok(a.domNaAgenda({ mapa: new Map(), n: 3 }, "X", { chave: "k", nome: "k" }).fora === true && a.domAgendaTxt({ fora: true }) === a.t("dom_det_ag_fora"), "E6a edital na agenda e tópico não: 'não está na agenda desta semana'");
    ok(a.domAgendaDoEdital("edital-que-nao-existe") === null, "E6b edital fora da agenda: null");
  }
  return falhas;
}

module.exports = { testes };
