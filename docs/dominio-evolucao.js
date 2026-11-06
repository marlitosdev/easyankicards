/* =====================================================================
 * EVOLUÇÃO DO DOMÍNIO NO TEMPO
 *
 * O Domínio é uma FOTO de agora. Para ver a curva subindo (ou parada), o app guarda um RETRATO por dia e por edital:
 * quanto do peso da prova estava em cada nível (verde · amarelo · azul · vermelho · cinza), no total e por disciplina.
 * O retrato do dia é regravado (vale o último estado do dia) e é tirado sozinho, uma vez por dia, ao abrir o app — não
 * depende de você abrir a tela. A tela mostra uma coluna por SEMANA (o último retrato de cada semana).
 *
 * O retrato é pequeno de propósito (só percentuais): 16 disciplinas × 5 números por dia e por edital.
 * Funções PURAS (domSnapDe, domSnapsGravar, domSerie, domDelta) recebem tudo pronto; quem lê e grava o navegador é
 * domSnapsLer/domSnapsSalvar.
 * ===================================================================== */
const DOM_SNAP_CHAVE = "eac_dominio_snaps";
const DOM_SNAP_MAX = 800;          /* retratos guardados no total (todos os editais) */
const DOM_SEMANAS = 20;            /* colunas do gráfico */
const DOM_NIVEIS_ORDEM = ["verde", "azul", "amarelo", "vermelho", "cinza"];   /* de baixo para cima na coluna */

const domPct = (x) => Math.round(x * 10) / 10;

/* o RETRATO de um mapa de domínio (resultado de domMapa) */
function domSnapDe(m, edId, fase, hoje) {
  const tot = (m && m.resumo && m.resumo.total) || 0;
  if (!tot) return null;
  const dist = {};
  DOM_NIVEIS_ORDEM.forEach((k) => { dist[k] = domPct((m.resumo.distribuicao[k] / tot) * 100); });
  return {
    d: hoje, ed: String(edId), f: fase === 2 ? 2 : 1,
    dist,
    /* (19.87.0) quantas folhas tiveram a cor tirada do par (vínculo): marca a descontinuidade no gráfico */
    par: (m.resumo && m.resumo.parN) || 0,
    discs: m.disciplinas.map((d) => {
      const dd = d.distribuicao, ds = DOM_NIVEIS_ORDEM.reduce((x, k) => x + dd[k], 0) || 1;
      const o = { n: d.nome, p: domPct(d.pesoPct) };
      DOM_NIVEIS_ORDEM.forEach((k) => { o[k] = domPct((dd[k] / ds) * 100); });
      return o;
    }),
  };
}

/* Junta o retrato à lista: no máximo UM por dia, edital e fase (o do dia é substituído); mantém os mais recentes. */
function domSnapsGravar(lista, snap, max) {
  if (!snap) return (lista || []).slice();
  const out = (lista || []).filter((x) => !(x.d === snap.d && String(x.ed) === String(snap.ed) && (x.f || 1) === (snap.f || 1)));
  out.push(snap);
  out.sort((a, b) => (a.d < b.d ? -1 : (a.d > b.d ? 1 : 0)));
  while (out.length > (max || DOM_SNAP_MAX)) out.shift();
  return out;
}

/* a segunda-feira da semana de uma data ISO (a chave da semana) */
function domSegunda(iso) {
  const d = new Date(iso + "T00:00:00");
  const dia = (d.getDay() + 6) % 7;      /* segunda = 0 */
  d.setDate(d.getDate() - dia);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/* A SÉRIE SEMANAL de um edital e fase: o último retrato de cada semana, do mais antigo ao mais novo (até `semanas`). */
function domSerie(snaps, edId, fase, semanas) {
  const doEd = (snaps || []).filter((x) => String(x.ed) === String(edId) && (x.f || 1) === (fase === 2 ? 2 : 1));
  const porSemana = new Map();
  doEd.forEach((x) => { porSemana.set(domSegunda(x.d), x); });     /* já em ordem de data: o último de cada semana fica */
  return [...porSemana.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([sem, x]) => Object.assign({ sem }, x)).slice(-(semanas || DOM_SEMANAS));
}

/* O retrato de REFERÊNCIA para comparar: o mais recente que tenha pelo menos `dias` dias; se a história for mais curta,
 * o mais antigo, desde que tenha pelo menos 6 dias de diferença; senão nenhum. */
function domReferencia(snaps, edId, fase, hojeISO, dias) {
  const doEd = (snaps || []).filter((x) => String(x.ed) === String(edId) && (x.f || 1) === (fase === 2 ? 2 : 1) && x.d < hojeISO);
  if (!doEd.length) return null;
  const idade = (x) => Math.round((new Date(hojeISO + "T00:00:00") - new Date(x.d + "T00:00:00")) / 86400000);
  const velhos = doEd.filter((x) => idade(x) >= dias);
  if (velhos.length) return velhos[velhos.length - 1];
  const maisAntigo = doEd[0];
  return idade(maisAntigo) >= 6 ? maisAntigo : null;
}

/* A diferença, em PONTOS percentuais, entre o retrato de agora e o de referência (total e por disciplina). */
function domDelta(atual, antes) {
  if (!atual || !antes) return null;
  const dif = (a, b) => { const o = {}; DOM_NIVEIS_ORDEM.forEach((k) => { o[k] = domPct((a[k] || 0) - (b[k] || 0)); }); return o; };
  const porDisc = {};
  const antesMap = {}; (antes.discs || []).forEach((d) => { antesMap[d.n] = d; });
  (atual.discs || []).forEach((d) => { if (antesMap[d.n]) porDisc[d.n] = dif(d, antesMap[d.n]); });
  return { total: dif(atual.dist, antes.dist), disciplinas: porDisc, desde: antes.d };
}

/* ---- guardar no navegador ---- */
function domSnapsLer() {
  try { const j = JSON.parse(localStorage.getItem(DOM_SNAP_CHAVE) || "[]"); return Array.isArray(j) ? j : []; } catch (e) { return []; }
}
function domSnapsSalvar(lista) {
  const txt = JSON.stringify(lista);
  if (typeof guardar === "function") guardar(DOM_SNAP_CHAVE, txt);
  else { try { localStorage.setItem(DOM_SNAP_CHAVE, txt); } catch (e) {} }
}
function domHojeISO() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
/* tira e guarda o retrato de hoje de um mapa já calculado */
function domSnapGravarHoje(m, edId, fase) {
  const s = domSnapDe(m, edId, fase, domHojeISO());
  if (!s) return null;
  domSnapsSalvar(domSnapsGravar(domSnapsLer(), s));
  return s;
}
/* UMA VEZ POR DIA, sem abrir a tela: quem ainda não tem o retrato de hoje (1ª fase) ganha um. Editais encerrados ficam de fora. */
function domSnapGarantirTodos() {
  if (typeof editais === "undefined" || !Array.isArray(editais)) return 0;
  const hoje = domHojeISO();
  let n = 0;
  editais.forEach((ed) => {
    try {
      if (gerSituacaoEdital(ed).grupo === "encerrado") return;
      const tem = domSnapsLer().some((x) => x.d === hoje && String(x.ed) === String(ed.id) && (x.f || 1) === 1);
      if (tem) return;
      if (domSnapGravarHoje(domDoEdital(ed, { fase: 1 }), ed.id, 1)) n++;
    } catch (e) {}
  });
  return n;
}

/* =====================================================================
 * (19.90.0) A CURVA ATÉ A PROVA
 *
 * O gráfico era uma coluna por semana, empilhada pelos cinco níveis. No ISS (27/09 a 06/11) 80% a 95% de cada coluna era
 * cinza: o que interessa — o verde crescendo — virava uma lasca no pé, e a pergunta da pessoa ("vou cobrir o edital até
 * 29/11?") não tinha resposta (sem data da prova, sem meta, sem projeção). Agora:
 *  · QUATRO NÚMEROS: o peso estudado hoje; o ritmo (pontos por semana desde o retrato de referência, ~4 semanas); onde
 *    esse ritmo chega no dia da prova; e o ritmo necessário para cobrir 100%;
 *  · A CURVA ACUMULADA (burn-up), dia a dia: "estudado" (qualquer sinal: tudo menos o cinza) e "dominado" (verde), e "em
 *    risco" (vermelho) quando houver; o eixo vai ATÉ A PROVA, com a projeção do ritmo atual (tracejada) e o ritmo
 *    necessário (pontilhada); marcas de "hoje", "prova" e da mudança de régua (o Domínio passou a ler o par);
 *  · POR DISCIPLINA, antes → agora (o retrato de referência e hoje), na ordem do peso: mostra onde o avanço aconteceu e
 *    o que está parado.
 * A barra de composição do topo continua: ela responde bem "como está agora".
 * ===================================================================== */
function domDiasEntre(a, b) { return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000); }
function domR1(x) { return Math.round(x * 10) / 10; }
function domNumBr(x, casas) { return (casas === 0 ? String(Math.round(x)) : String(domR1(x))).replace(".", ","); }

/* a data da prova deste edital (na 2ª fase, a da discursiva / fase 2) */
function domProvaDe(edId, fase) {
  const ed = ((typeof editais !== "undefined" && editais) || []).find((e) => String(e.id) === String(edId));
  if (!ed) return null;
  try {
    const c = (lerEdital(ed.texto || "").cfg) || {};
    if (fase === 2 && c.fase2 && c.fase2.prova) return c.fase2.prova;
    const s = typeof edSituacao === "function" ? edSituacao(ed) : null;
    return (s && s.prova) || c.prova || null;
  } catch (e) { return null; }
}

/* os números da curva (pura): a série diária, o ritmo, a projeção e o ritmo necessário */
function domCurva(snaps, edId, fase, hojeISO, provaISO) {
  const doEd = (snaps || []).filter((x) => String(x.ed) === String(edId) && (x.f || 1) === (fase === 2 ? 2 : 1))
    .slice().sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const est = (x) => domR1(100 - ((x.dist && x.dist.cinza) || 0));
  const pts = doEd.map((x) => ({ d: x.d, est: est(x), dom: (x.dist && x.dist.verde) || 0, risco: (x.dist && x.dist.vermelho) || 0 }));
  const out = { pts, pouca: pts.length < 2, ult: pts[pts.length - 1] || null, ref: null, ritmoSem: null, diasProva: null,
    provaISO: provaISO || null, projecao: null, necessario: null, emRitmo: null, temRisco: pts.some((p) => p.risco > 0) };
  if (out.pouca) return out;
  const ult = out.ult;
  const refS = domReferencia(doEd, edId, fase, hojeISO > ult.d ? hojeISO : ult.d, 28);
  if (refS) {
    const dias = domDiasEntre(refS.d, ult.d);
    if (dias > 0) { out.ref = { d: refS.d, est: est(refS) }; out.ritmoSem = domR1(((ult.est - out.ref.est) / dias) * 7); }
  }
  if (provaISO && provaISO >= hojeISO) {
    out.diasProva = domDiasEntre(hojeISO, provaISO);
    const semanas = Math.max(1, out.diasProva) / 7;
    out.necessario = domR1(Math.max(0, 100 - ult.est) / semanas);
    if (out.ritmoSem != null) out.projecao = Math.min(100, domR1(ult.est + Math.max(0, out.ritmoSem) * (out.diasProva / 7)));
    if (out.ritmoSem != null) out.emRitmo = out.ritmoSem >= out.necessario;
  }
  return out;
}

/* por disciplina: estudado (tudo menos o cinza) e verde, no retrato de referência e no de agora, na ordem do peso */
function domDiscAntesDepois(ref, agora) {
  const antes = {};
  ((ref && ref.discs) || []).forEach((d) => { antes[d.n] = d; });
  return ((agora && agora.discs) || []).map((d) => {
    const a = antes[d.n];
    return { n: d.n, p: d.p || 0, antes: a ? domR1(100 - (a.cinza || 0)) : null, agora: domR1(100 - (d.cinza || 0)),
      domAntes: a ? (a.verde || 0) : null, domAgora: d.verde || 0 };
  }).sort((x, y) => y.p - x.p || String(x.n).localeCompare(String(y.n)));
}

/* o desenho (SVG, nas cores do app: claro e escuro) */
function domCurvaSvg(C, virada) {
  const NS = "http://www.w3.org/2000/svg";
  const W = 640, H = 230, ml = 36, mr = 12, mt = 12, mb = 26;
  const el = (tag, at, pai) => { const x = document.createElementNS(NS, tag); Object.keys(at || {}).forEach((k) => x.setAttribute(k, String(at[k]))); if (pai) pai.appendChild(x); return x; };
  const svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "dom-curva", role: "img", preserveAspectRatio: "xMidYMid meet" });
  el("title", {}, svg).textContent = t("dom_evo_aria", { e: domNumBr(C.ult.est), d: C.ult.d.split("-").reverse().join("/"), p: C.projecao != null ? domNumBr(C.projecao, 0) : "?" });
  const ini = C.pts[0].d;
  const fim = C.provaISO && C.provaISO > C.ult.d ? C.provaISO : C.ult.d;
  const span = Math.max(1, domDiasEntre(ini, fim));
  const X = (d) => ml + ((W - ml - mr) * domDiasEntre(ini, d)) / span;
  const Y = (v) => mt + (H - mt - mb) * (1 - Math.max(0, Math.min(100, v)) / 100);
  /* grade e eixo */
  [0, 25, 50, 75, 100].forEach((v) => {
    el("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), class: "dom-curva-grade" }, svg);
    el("text", { x: ml - 6, y: Y(v) + 4, "text-anchor": "end", class: "dom-curva-eixo" }, svg).textContent = v + "%";
  });
  const dm = (d) => d.slice(8) + "/" + d.slice(5, 7);
  const nTicks = 5;
  for (let k = 0; k <= nTicks; k++) {
    const dd = new Date(ini + "T00:00:00"); dd.setDate(dd.getDate() + Math.round((span * k) / nTicks));
    const iso = dd.getFullYear() + "-" + String(dd.getMonth() + 1).padStart(2, "0") + "-" + String(dd.getDate()).padStart(2, "0");
    el("text", { x: X(iso), y: H - 8, "text-anchor": k === 0 ? "start" : k === nTicks ? "end" : "middle", class: "dom-curva-eixo" }, svg).textContent = dm(iso);
  }
  /* marcas verticais: régua (par), hoje e prova */
  /* a "régua" desce uma linha: cai muitas vezes no mesmo dia que "hoje" e os rótulos se sobrepunham */
  const marca = (d, rot, cls, linha) => {
    el("line", { x1: X(d), x2: X(d), y1: mt, y2: H - mb, class: "dom-curva-marca " + cls }, svg);
    el("text", { x: X(d) - 3, y: mt + 10 + (linha || 0) * 13, "text-anchor": "end", class: "dom-curva-eixo " + cls }, svg).textContent = rot;
  };
  if (virada && virada > ini && virada <= C.ult.d) marca(virada, t("dom_evo_virada"), "dom-curva-m-regua", 1);
  if (fim > C.ult.d) { marca(C.ult.d, t("dom_evo_hoje"), "dom-curva-m-hoje"); marca(fim, t("dom_evo_prova"), "dom-curva-m-prova"); }
  /* as linhas */
  const linha = (campo) => C.pts.map((p, i) => (i ? "L" : "M") + X(p.d).toFixed(1) + " " + Y(p[campo]).toFixed(1)).join(" ");
  const base = Y(0).toFixed(1);
  el("path", { d: linha("est") + " L" + X(C.ult.d).toFixed(1) + " " + base + " L" + X(ini).toFixed(1) + " " + base + " Z", class: "dom-curva-area" }, svg);
  if (C.necessario != null && fim > C.ult.d) el("path", { d: "M" + X(C.ult.d).toFixed(1) + " " + Y(C.ult.est).toFixed(1) + " L" + X(fim).toFixed(1) + " " + Y(100).toFixed(1), class: "dom-curva-nec" }, svg);
  if (C.projecao != null && fim > C.ult.d) el("path", { d: "M" + X(C.ult.d).toFixed(1) + " " + Y(C.ult.est).toFixed(1) + " L" + X(fim).toFixed(1) + " " + Y(C.projecao).toFixed(1), class: "dom-curva-proj" }, svg);
  if (C.temRisco) el("path", { d: linha("risco"), class: "dom-curva-risco" }, svg);
  el("path", { d: linha("dom"), class: "dom-curva-dom" }, svg);
  el("path", { d: linha("est"), class: "dom-curva-est" }, svg);
  /* o ponto de hoje e a projeção no dia da prova, com o valor escrito */
  el("circle", { cx: X(C.ult.d), cy: Y(C.ult.est), r: 4, class: "dom-curva-ponto" }, svg);
  if (C.projecao != null && fim > C.ult.d) {
    el("circle", { cx: X(fim), cy: Y(C.projecao), r: 3.5, class: "dom-curva-ponto-proj" }, svg);
    el("text", { x: X(fim) - 6, y: Y(C.projecao) - 7, "text-anchor": "end", class: "dom-curva-val" }, svg).textContent = "~" + domNumBr(C.projecao, 0) + "%";
  }
  /* cada dia com o seu balão (title): hover no computador, toque longo no celular */
  C.pts.forEach((p) => {
    const c = el("circle", { cx: X(p.d), cy: Y(p.est), r: 6, class: "dom-curva-alvo" }, svg);
    el("title", {}, c).textContent = t("dom_evo_ponto", { d: dm(p.d), e: domNumBr(p.est), v: domNumBr(p.dom), r: domNumBr(p.risco) });
  });
  return svg;
}

function domEvolucaoPintar(cx, m, edId, fase) {
  const sec = gerEl("div", "dom-evo");
  sec.append(gerEl("h4", "", t("dom_evo_tit2")));
  const hoje = domHojeISO();
  const snapAgora = domSnapDe(m, edId, fase, hoje);
  domSnapGravarHoje(m, edId, fase);
  const snaps = domSnapsLer();
  const C = domCurva(snaps, edId, fase, hoje, domProvaDe(edId, fase));
  if (C.pouca) {
    sec.append(gerEl("p", "nota", t("dom_evo_pouca")));
    cx.append(sec);
    return null;
  }
  const ref = domReferencia(snaps, edId, fase, hoje, 28);
  const dl = ref ? domDelta(snapAgora, ref) : null;
  /* os quatro números */
  const kp = gerEl("div", "dom-evo-kpis");
  const kpi = (rot, val, sub, cls) => { const b = gerEl("div", "dom-evo-kpi" + (cls ? " " + cls : "")); b.append(gerEl("div", "dom-evo-kpi-r", rot), gerEl("div", "dom-evo-kpi-v", val)); if (sub) b.append(gerEl("div", "dom-evo-kpi-s", sub)); kp.append(b); return b; };
  kpi(t("dom_evo_k_est"), domNumBr(C.ult.est) + "%", t("dom_evo_k_est_sub", { v: domNumBr(C.ult.dom) }));
  kpi(C.ref ? t("dom_evo_k_ritmo", { d: C.ref.d.split("-").reverse().join("/").slice(0, 5) }) : t("dom_evo_k_ritmo0"),
    C.ritmoSem != null ? (C.ritmoSem > 0 ? "+" : "") + domNumBr(C.ritmoSem) + " " + t("dom_evo_pt_sem") : "—", C.ritmoSem == null ? t("dom_evo_k_ritmo_pouca") : "");
  if (C.diasProva != null) {
    kpi(t("dom_evo_k_proj"), C.projecao != null ? "~" + domNumBr(C.projecao, 0) + "%" : "—", t("dom_evo_k_proj_sub", { d: C.provaISO.split("-").reverse().join("/").slice(0, 5), n: C.diasProva }));
    kpi(t("dom_evo_k_nec"), C.ult.est >= 100 ? "✓" : "+" + domNumBr(C.necessario) + " " + t("dom_evo_pt_sem"),
      C.emRitmo == null ? "" : C.emRitmo ? t("dom_evo_k_nec_ok") : t("dom_evo_k_nec_falta", { x: C.ritmoSem > 0 ? domNumBr(C.necessario / C.ritmoSem) : "∞" }),
      C.emRitmo === false ? "dom-evo-kpi-alerta" : C.emRitmo ? "dom-evo-kpi-ok" : "");
  } else kpi(t("dom_evo_k_proj"), "—", t("dom_evo_k_sem_prova"));
  sec.append(kp);
  if (dl) {
    const pts = (k) => (dl.total[k] > 0 ? "+" : "") + String(dl.total[k]).replace(".", ",") + " pt";
    sec.append(gerEl("p", "dom-evo-resumo", t("dom_evo_desde", { d: dl.desde.split("-").reverse().join("/") }) + " " +
      ["verde", "vermelho", "cinza"].map((k) => t("dom_n_" + k) + " " + pts(k)).join(" · ")));
  }
  /* a legenda e a curva */
  const leg = gerEl("div", "dom-evo-leg");
  const it = (cls, k) => { const s = gerEl("span", "dom-evo-leg-i"); s.append(gerEl("span", "dom-evo-leg-l " + cls), gerEl("span", "", t(k))); leg.append(s); };
  it("est", "dom_evo_l_est"); it("dom", "dom_evo_l_dom");
  if (C.temRisco) it("risco", "dom_evo_l_risco");
  if (C.projecao != null) it("proj", "dom_evo_l_proj");
  if (C.necessario != null) it("nec", "dom_evo_l_nec");
  sec.append(leg);
  const virada = typeof domParVirada === "function" ? domParVirada(snaps, edId, fase) : null;
  const gw = gerEl("div", "dom-evo-graf");
  gw.append(domCurvaSvg(C, virada));
  sec.append(gw);
  /* por disciplina, antes → agora */
  if (ref) {
    const ds = domDiscAntesDepois(ref, snapAgora);
    if (ds.length) {
      const bx = gerEl("div", "dom-evo-discs");
      bx.append(gerEl("div", "dom-evo-discs-tit", t("dom_evo_disc_tit", { d: ref.d.split("-").reverse().join("/").slice(0, 5) })));
      ds.forEach((d) => {
        const ln = gerEl("div", "dom-evo-dl");
        ln.title = t("dom_evo_disc_tip", { n: d.n, a: d.antes == null ? "—" : domNumBr(d.antes), b: domNumBr(d.agora), va: d.domAntes == null ? "—" : domNumBr(d.domAntes), vb: domNumBr(d.domAgora) });
        ln.append(gerEl("span", "dom-evo-dl-n", d.n + " · " + domNumBr(d.p) + "%"));
        const tr = gerEl("span", "dom-evo-dl-tr");
        const a = d.antes == null ? d.agora : d.antes;
        const seg = gerEl("span", "dom-evo-dl-seg"); seg.style.left = Math.min(a, d.agora) + "%"; seg.style.width = Math.abs(d.agora - a) + "%";
        const p1 = gerEl("span", "dom-evo-dl-p antes"); p1.style.left = a + "%";
        const p2 = gerEl("span", "dom-evo-dl-p agora"); p2.style.left = d.agora + "%";
        tr.append(seg, p1, p2);
        ln.append(tr);
        const dv = domR1(d.agora - a);
        ln.append(gerEl("span", "dom-evo-dl-v" + (dv > 0 ? " sobe" : dv < 0 ? " desce" : ""), dv ? (dv > 0 ? "+" : "") + domNumBr(dv) + " pt" : t("dom_evo_disc_parado")));
        bx.append(ln);
      });
      sec.append(bx);
    }
  }
  if (virada) sec.append(gerEl("p", "nota dom-evo-par", t("dom_evo_par", { d: virada.split("-").reverse().join("/") })));
  cx.append(sec);
  return dl;
}

/* o dia do primeiro retrato que leu o par, se antes dele houver retrato sem essa leitura (senão, nada a avisar) */
function domParVirada(snaps, edId, fase) {
  const doEd = (snaps || []).filter((x) => String(x.ed) === String(edId) && (x.f || 1) === (fase === 2 ? 2 : 1));
  let viuSem = false;
  for (const x of doEd) {
    if (x.par === undefined) { viuSem = true; continue; }
    if (x.par > 0) return viuSem ? x.d : null;
  }
  return null;
}

if (typeof document !== "undefined" && typeof setTimeout === "function") {
  /* depois que o app terminou de subir (o cálculo lê os cartões e o plano) */
  setTimeout(() => { try { domSnapGarantirTodos(); } catch (e) {} }, 4000);
}
