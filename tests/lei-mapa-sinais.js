/* =====================================================================
 * O MAPA DA LEI COM TRÊS SINAIS (v18.82.0)
 *
 * Antes cada artigo tinha UMA borda — erro, prova ou "parei" — e só uma
 * vencia. O QUE PRECISA SER VERDADE:
 *  1. o FUNDO diz o domínio real pelas questões que citam o artigo
 *     (acerto no chute vale 1/4): ≥ 80% verde, ≥ 55% amarelo, abaixo
 *     vermelho; sem resposta, fundo nenhum;
 *  2. a BARRINHA de baixo diz o quanto o artigo cai (questões + 2 × caiu
 *     na prova), relativa ao que mais cai na lei;
 *  3. 🎲 no selo de questões quando houve acerto no chute; o balão diz o
 *     domínio, os chutes e as questões por banca;
 *  4. a borda continua: parei / prova / erra mais; a legenda explica.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };

  /* ---- 1 e 2: as contas ---- */
  {
    const { api: a } = rodar();
    ok(a.leiIrDominio(null) === null && a.leiIrDominio({ acertos: 0, acertosN: 0, chutes: 0, erros: 0 }) === null, "S1 sem resposta, sem domínio");
    ok(a.leiIrDominio({ acertos: 4, acertosN: 4, chutes: 0, erros: 1 }).faixa === "verde", "S1a 4 de 5 = 80%: verde");
    ok(a.leiIrDominio({ acertos: 3.25, acertosN: 3, chutes: 1, erros: 1 }).faixa === "amarelo", "S1b 3 firmes + 1 chute + 1 erro = 65%: amarelo (sem o chute seria verde)");
    ok(a.leiIrDominio({ acertos: 0.5, acertosN: 0, chutes: 2, erros: 1 }).faixa === "vermelho", "S1c 2 chutes e 1 erro = 17%: vermelho");
    ok(a.leiIrCalor({ questoes: 4, prova: 1 }, 6) === 100 && a.leiIrCalor({ questoes: 3, prova: 0 }, 6) === 50 && a.leiIrCalor({ questoes: 0, prova: 0 }, 6) === 0 && a.leiIrCalor({ questoes: 1, prova: 0 }, 100) === 8,
      "S2 a barrinha: questões + 2×prova sobre o que mais cai (mínimo visível 8%)");
  }

  /* ---- 3 e 4: na tela ---- */
  {
    const { api: b } = rodar();
    b.matIniciar(); b.leiIniciar();
    const ch = b.matChave("Direito Tributário", "Tributo");
    b.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", especie: "Lei", numero: "5172", ano: "1966",
      texto: "Art. 1º Regula.\nArt. 3º Tributo é prestação.\nArt. 4º A natureza.\nArt. 5º Espécies.", topicos: [ch] });
    const Q = (id, en, ts, banca) => ({ id, tipo: "ce", enunciado: en, gabarito: "C", comentario: "", chave: ch, banca: banca || "", tentativas: ts });
    [Q("a", "Art. 3º do CTN.", [{ acertou: true }], "FGV"), Q("b", "Art. 3º do CTN, de novo.", [{ acertou: true }], "FGV"),
     Q("c", "Art. 3º do CTN, outra.", [{ acertou: true, chute: true }], "IBAM"), Q("d", "Art. 3º do CTN e mais.", [], ""),
     Q("e", "Art. 4º do CTN.", [{ acertou: false }, { acertou: false }], "FGV"),
     Q("f", "Art. 5º do CTN.", [{ acertou: true }, { acertou: true }, { acertou: true }, { acertou: true }, { acertou: true }], "")].forEach((q) => b.qsTodas().push(q));
    b.leiAbrir("Direito Tributário", "Tributo", "lei_ctn");
    b.leiIrAbrir();
    const cel = (n) => achar(b.$("leiIrGrade"), (c) => /(^|\s)lei-ir-cel(\s|$)/.test(c.className || "") && c.children[0] && c.children[0].textContent === n)[0];
    const c3 = cel("3º"), c4 = cel("4º"), c5 = cel("5º"), c1 = cel("1º");
    ok(/lei-ir-dom-amarelo/.test(c3.className), "T1 art. 3º: 2 firmes + 1 chute = 75% → amarelo: " + c3.className);
    ok(/lei-ir-dom-vermelho/.test(c4.className) && /lei-ir-cel-erro/.test(c4.className), "T1a art. 4º: só erros → vermelho (e a borda de 'erra mais' continua)");
    ok(/lei-ir-dom-verde/.test(c5.className) && !/lei-ir-dom-/.test(c1.className), "T1b art. 5º: 100% → verde; art. 1º sem questão, sem fundo");
    const bar3 = achar(c3, (e) => /lei-ir-calor/.test(e.className || ""))[0], bar5 = achar(c5, (e) => /lei-ir-calor/.test(e.className || ""))[0];
    ok(bar3 && bar3.style.width === "100%" && bar5 && bar5.style.width === "25%" && !achar(c1, (e) => /lei-ir-calor/.test(e.className || "")).length,
       "T2 a barrinha: o art. 3º (4 questões) é o que mais cai = 100%; o 5º (1) = 25%; o 1º, nenhuma: " + (bar3 && bar3.style.width) + " " + (bar5 && bar5.style.width));
    const q3 = achar(c3, (e) => /lei-ir-q/.test(e.className || ""))[0];
    ok(q3.textContent === "4 🎲" && /🎲 1/.test(q3.title), "T3 o selo do art. 3º: '4 🎲' (houve chute): " + q3.textContent);
    const tip = c3.children[0].title;
    ok(tip.indexOf(b.t("lei_ir_dica_dom", { p: 75, n: 3 })) >= 0 && tip.indexOf(b.t("lei_ir_dica_bancas", { b: "FGV 2, IBAM 1" })) >= 0,
       "T3a o balão: domínio real, chutes e as questões por banca (a sem banca não entra): " + tip);
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const leg = html.slice(html.indexOf("id=\"leiIrLegenda\""), html.indexOf("</div>", html.indexOf("id=\"leiIrLegenda\"")));
    ok(leg.indexOf("lei_ir_leg_dom") >= 0 && leg.indexOf("lei_ir_leg_calor") >= 0 && b.t("lei_ir_leg_dom") !== "lei_ir_leg_dom", "T4 a legenda explica o fundo e a barrinha");
  }
  return falhas;
}

module.exports = { testes };
