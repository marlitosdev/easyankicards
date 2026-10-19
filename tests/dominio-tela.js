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
  return falhas;
}

module.exports = { testes };
