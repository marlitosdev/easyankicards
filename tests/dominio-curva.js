/* (19.90.0) A CURVA ATÉ A PROVA (Domínio › Evolução)
 *
 *   DC1–DC5  os números: série diária (estudado = tudo menos o cinza), ritmo desde a referência, projeção na prova,
 *            ritmo necessário e "dá conta / não dá"
 *   DC6–DC7  sem data de prova (ou prova passada) e com um retrato só
 *   DC8      por disciplina, antes → agora, na ordem do peso
 *   DC9–DC11 a tela: os quatro números, a curva até a prova com as marcas, e o antes → agora
 */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test((e && e.className) || "");
  const attr = (e) => (e && e.getAttribute ? e.getAttribute("class") || "" : "");
  const { api: a } = rodar();
  const snap = (d, cinza, verde, verm, discs) => ({ d, ed: "e1", f: 1, dist: { verde, amarelo: 0, azul: 100 - cinza - verde - verm, vermelho: verm, cinza }, discs: discs || [] });
  const S = [snap("2026-10-01", 96, 2, 0), snap("2026-10-09", 95.7, 2.9, 0), snap("2026-10-20", 90, 6, 0), snap("2026-11-06", 80.3, 14.4, 0)];

  /* ---- os números ---- */
  {
    const C = a.domCurva(S, "e1", 1, "2026-11-06", "2026-11-29");
    ok(C.pts.length === 4 && C.pts[3].est === 19.7 && C.pts[3].dom === 14.4 && !C.pouca, "DC1 a série: estudado é tudo menos o cinza (19,7%), dominado é o verde");
    ok(C.ref && C.ref.d === "2026-10-09" && C.ritmoSem === 3.9, "DC2 o ritmo vem do retrato de ~4 semanas atrás: (19,7 − 4,3) em 28 dias = 3,9 pt/semana: " + JSON.stringify([C.ref, C.ritmoSem]));
    ok(C.diasProva === 23 && C.projecao === 32.5, "DC3 nesse ritmo, na prova (23 dias): ~32%: " + C.projecao);
    ok(C.necessario === 24.4 && C.emRitmo === false, "DC4 para cobrir 100% em 23 dias: 24,4 pt/semana, e o ritmo atual não dá conta: " + C.necessario);
    const C2 = a.domCurva(S, "e1", 1, "2026-11-06", "2027-12-31");
    ok(C2.emRitmo === true, "DC5 com prova longe, o mesmo ritmo dá conta");
    const C3 = a.domCurva(S, "e1", 1, "2026-11-06", null);
    const C4 = a.domCurva(S, "e1", 1, "2026-11-06", "2026-10-01");
    ok(C3.diasProva === null && C3.projecao === null && C3.necessario === null && C4.diasProva === null && C3.ritmoSem === 3.9, "DC6 sem data de prova (ou já passada): só o ritmo, sem projeção nem meta");
    ok(a.domCurva([S[0]], "e1", 1, "2026-10-01", "2026-11-29").pouca === true, "DC7 com um retrato só, não há curva");
    const ds = a.domDiscAntesDepois({ discs: [{ n: "A", p: 10, verde: 0, cinza: 100 }, { n: "B", p: 40, verde: 5, cinza: 90 }] },
      { discs: [{ n: "A", p: 10, verde: 0, cinza: 100 }, { n: "B", p: 40, verde: 30, cinza: 60 }, { n: "C", p: 5, verde: 0, cinza: 80 }] });
    ok(ds.map((x) => x.n).join() === "B,A,C" && ds[0].antes === 10 && ds[0].agora === 40 && ds[1].antes === 0 && ds[1].agora === 0 && ds[2].antes === null,
      "DC8 por disciplina, na ordem do peso: antes → agora (a disciplina nova não tem 'antes'): " + JSON.stringify(ds));
  }

  /* ---- a tela ---- */
  {
    a.matIniciar(); a.edIniciar();
    const em = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    const ed = a.edCriar("Curva", ["# Curva | prova: " + em(23) + " | horas: 20", "@ A :: 5", "+ x :: 5", "+ y :: 3", "@ B :: 2", "+ z :: 2"].join("\n"));
    const m = a.domDoEdital(ed, { fase: 1 });
    const hist = [[-28, 96], [-20, 92], [-10, 88]].map(([k, c]) => Object.assign(a.domSnapDe(m, ed.id, 1, em(k)), { dist: { verde: 100 - c, amarelo: 0, azul: 0, vermelho: 0, cinza: c } }));
    a.domSnapsSalvar(hist);
    a.domAbrir(ed.id);
    a.domAbaDefinir && a.domAbaDefinir("evo");
    const evo = achar(a.$("domCorpo"), (e) => cls(e, "dom-evo"))[0];
    const kpis = achar(evo, (e) => cls(e, "dom-evo-kpi"));
    ok(kpis.length === 4 && /Peso estudado hoje/.test(evo.textContent) && /Nesse ritmo, na prova/.test(evo.textContent) && /Para cobrir 100%/.test(evo.textContent),
      "DC9 os quatro números: estudado, ritmo, projeção e o necessário: " + kpis.map((k) => k.textContent).join(" | "));
    const svg = achar(evo, (e) => e.tag === "svg")[0];
    const marcas = svg ? achar(svg, (e) => /dom-curva-marca/.test(attr(e))) : [];
    const linhas = svg ? achar(svg, (e) => /dom-curva-(est|dom|proj|nec)\b/.test(attr(e))) : [];
    ok(svg && marcas.length >= 2 && linhas.length === 4 && /prova/.test(svg.textContent || achar(svg, () => true).map((x) => x.textContent || "").join(" ")),
      "DC10 a curva vai até a prova, com 'hoje' e 'prova' marcados e as quatro linhas (estudado, dominado, projeção, necessário): " + marcas.length + "/" + linhas.length);
    ok(achar(evo, (e) => cls(e, "dom-evo-dl")).length === 2, "DC11 o antes → agora, uma linha por disciplina");
    a.$("dlgDominio").close();
    a.edApagar(ed.id);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
