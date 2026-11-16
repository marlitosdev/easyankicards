/* =====================================================================
 * (19.149.0) ANÁLISE DO ESTUDO — a VISÃO GERAL
 *
 * O "Raio-X da recomendação" nasceu para explicar a conta da agenda e foi juntando outras coisas: desempenho por
 * disciplina, histórico do plano, até o armazenamento. Faltava o que nenhuma tela do app mostrava: olhar PARA TRÁS, no
 * tempo, e juntar tudo num lugar — como você estudou, como está rendendo e onde o plano e a execução não batem.
 *
 * A tela passa a se chamar "Análise do estudo". A conta da agenda continua dentro dela ("Como o plano decide"), o
 * desempenho por disciplina também ("Desempenho"), e o armazenamento foi para ⚙ Configurações.
 *
 * A VISÃO GERAL, de cima para baixo:
 *   · o PERÍODO (7, 30, 90 dias ou tudo), lembrado;
 *   · quatro INDICADORES, cada um comparado com o período anterior do mesmo tamanho: horas (contra a meta), dias
 *     estudados (e a sequência atual), acerto em questões e cartões (em revisão, atrasados, vencendo em 7 dias);
 *   · o MAPA DOS DIAS das últimas 13 semanas (a cor é o tempo do dia) — a constância num relance;
 *   · as HORAS POR SEMANA, estudo e revisão empilhados, com a linha da meta;
 *   · O QUE ESTÁ FORA DO LUGAR: alertas curtos, cada um levando à aba ou tela que explica.
 *
 * NADA É MEDIDO DE NOVO: as horas vêm do diário (o mesmo do ritmo e das horas por assunto), o acerto do banco de
 * questões e das contagens anotadas no diário (como em "Desempenho"), os cartões da agenda dos cartões, a fatia da prova
 * e o que não cabe do plano (montarPlano). Os gráficos são desenhados aqui (SVG e grade), sem biblioteca: o app
 * funciona sem internet e nos três temas.
 * ===================================================================== */
const AE_CH_PERIODO = "eac_ae_periodo";
const AE_PERIODOS = ["7", "30", "90", "tudo"];
const AE_SEMANAS = 13;
let aeRelogio = () => Date.now();
function aeRelogioDefinir(f) { aeRelogio = f || (() => Date.now()); }

function aePeriodoLer() {
  try { const p = localStorage.getItem(AE_CH_PERIODO); return AE_PERIODOS.indexOf(p) >= 0 ? p : "30"; } catch (e) { return "30"; }
}
function aePeriodoDefinir(p) {
  if (AE_PERIODOS.indexOf(String(p)) < 0) return aePeriodoLer();
  try { localStorage.setItem(AE_CH_PERIODO, String(p)); } catch (e) {}
  if (typeof plPintar === "function") plPintar();
  return String(p);
}

/* datas: tudo em dia LOCAL "AAAA-MM-DD" (o diário já grava assim; as tentativas de questão são ISO em UTC) */
function aeISO(dt) {
  const p = (n) => String(n).padStart(2, "0");
  return dt.getFullYear() + "-" + p(dt.getMonth() + 1) + "-" + p(dt.getDate());
}
function aeDiaDe(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? "" : aeISO(dt);
}
function aeSomarDias(iso, n) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return aeISO(new Date(a, m - 1, d + n));
}
function aeDiasEntre(de, ate) {
  const [a1, m1, d1] = String(de).split("-").map(Number), [a2, m2, d2] = String(ate).split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}
/* a segunda-feira da semana do dia */
function aeSegunda(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;
  return aeISO(new Date(a, m - 1, d - dow));
}
function aeHorasTxt(min) {
  const m = Math.round(Number(min) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  return h ? h + "h" + (r ? " " + String(r).padStart(2, "0") : "") : r + "min";
}
function aeFmt1(x) { return String(Math.round(x * 10) / 10).replace(".", ","); }

/* as fontes, com o que estiver disponível (a tela e os testes passam as suas) */
function aeFontes(opc) {
  const o = opc || {};
  const diario = o.diario || ((typeof edDiario !== "undefined" && edDiario) || []);
  let banco = o.banco;
  if (!banco) { try { banco = (typeof qsBanco !== "undefined" && qsBanco) || []; } catch (e) { banco = []; } }
  let regs = o.regs;
  if (!regs) {
    try { regs = (typeof estcRegs !== "undefined" && estcRegs && Object.keys(estcRegs).length) ? estcRegs : null; } catch (e) { regs = null; }
    if (!regs) { try { regs = JSON.parse(localStorage.getItem("eac_cartao_estudo") || "{}") || {}; } catch (e) { regs = {}; } }
  }
  let metaMin = o.metaMin;
  if (metaMin == null) { try { metaMin = typeof hubMetaMin === "function" ? hubMetaMin() : 0; } catch (e) { metaMin = 0; } }
  return { diario, banco, regs, metaMin };
}

/* ---------------------------------------------------------------------
 * O MODELO (função pura): recebe as fontes, o período e o plano (opcional) e devolve tudo o que a tela desenha.
 * --------------------------------------------------------------------- */
function aeModelo(opc) {
  const o = opc || {};
  const F = aeFontes(o);
  const agora = o.agora || aeRelogio();
  const hoje = aeDiaDe(agora);
  const periodo = AE_PERIODOS.indexOf(String(o.periodo)) >= 0 ? String(o.periodo) : aePeriodoLer();

  /* minutos por dia, separados em estudo e revisão; o "pendente" não é estudo feito */
  const porDia = {};
  F.diario.forEach((x) => {
    if (!x || x.a === "pendente") return;
    const d = aeDiaDe(x.d);
    if (!d || d > hoje) return;
    const m = Math.max(0, Number(x.m) || 0);
    const L = porDia[d] || (porDia[d] = { est: 0, rev: 0, n: 0 });
    if (x.a === "revisado") L.rev += m; else L.est += m;
    L.n++;
  });
  const dias = Object.keys(porDia).sort();
  const primeiro = dias[0] || hoje;

  const nDias = periodo === "tudo" ? Math.max(1, aeDiasEntre(primeiro, hoje) + 1) : Number(periodo);
  const ini = aeSomarDias(hoje, -(nDias - 1));
  const antFim = aeSomarDias(ini, -1), antIni = aeSomarDias(ini, -nDias);
  const dentro = (d, a, b) => d >= a && d <= b;
  const somaMin = (a, b) => dias.filter((d) => dentro(d, a, b)).reduce((s, d) => s + porDia[d].est + porDia[d].rev, 0);

  /* HORAS, contra a meta: a meta própria da agenda, ou o orçamento semanal do plano */
  const estP = dias.filter((d) => dentro(d, ini, hoje)).reduce((s, d) => s + porDia[d].est, 0);
  const revP = dias.filter((d) => dentro(d, ini, hoje)).reduce((s, d) => s + porDia[d].rev, 0);
  const metaSemana = F.metaMin > 0 ? F.metaMin : (o.plano && o.plano.porSemana) || 0;
  const horas = {
    min: estP + revP, estudo: estP, revisao: revP,
    minAnt: periodo === "tudo" ? null : somaMin(antIni, antFim),
    metaSemana, fonteMeta: F.metaMin > 0 ? "meta" : metaSemana ? "plano" : "",
    metaPeriodo: metaSemana ? Math.round(metaSemana * nDias / 7) : 0,
  };

  /* DIAS ESTUDADOS e a sequência (conta até hoje; se hoje ainda não teve estudo, até ontem) */
  const temDia = (d) => !!(porDia[d] && (porDia[d].est + porDia[d].rev > 0 || porDia[d].n));
  let seq = 0, cur = temDia(hoje) ? hoje : aeSomarDias(hoje, -1);
  while (temDia(cur)) { seq++; cur = aeSomarDias(cur, -1); }
  const estudados = dias.filter((d) => dentro(d, ini, hoje) && temDia(d)).length;
  const ultimo = dias.length ? dias[dias.length - 1] : "";
  const diasInfo = {
    estudados, total: nDias, sequencia: seq, ultimo,
    semEstudar: ultimo ? aeDiasEntre(ultimo, hoje) : null,
    estudadosAnt: periodo === "tudo" ? null : dias.filter((d) => dentro(d, antIni, antFim) && temDia(d)).length,
  };

  /* ACERTO: banco de questões (tentativa a tentativa) + as contagens anotadas no diário — as mesmas fontes de "Desempenho" */
  const acc = (a, b) => {
    let feitas = 0, certas = 0;
    F.banco.forEach((q) => (q.tentativas || []).forEach((tt) => {
      const d = aeDiaDe(tt && tt.q);
      if (!d || !dentro(d, a, b)) return;
      feitas++;
      certas += typeof qsValorAcerto === "function" ? qsValorAcerto(tt) : (tt.acertou ? 1 : 0);
    }));
    F.diario.forEach((x) => {
      if (!x || x.a === "pendente" || !x.q || !x.q.feitas) return;
      const d = aeDiaDe(x.d);
      if (!d || !dentro(d, a, b)) return;
      feitas += Number(x.q.feitas) || 0; certas += Number(x.q.certas) || 0;
    });
    return { feitas, certas: Math.round(certas), pct: feitas ? Math.round((certas / feitas) * 100) : null };
  };
  const acP = acc(ini, hoje);
  const acA = periodo === "tudo" ? null : acc(antIni, antFim);
  const acerto = { feitas: acP.feitas, certas: acP.certas, pct: acP.pct, pctAnt: acA ? acA.pct : null, feitasAnt: acA ? acA.feitas : null };

  /* CARTÕES: a MESMA régua da fila do player (agdFila): aprendendo vence na hora; revisão vale até o fim do dia.
   * "De dias anteriores" é a revisão que venceu antes de hoje começar. */
  const regs = Object.keys(F.regs || {}).map((k) => F.regs[k]).filter((r) => r && typeof r === "object");
  const dt = new Date(agora);
  const iniHoje = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const fimHoje = iniHoje + 86400000 - 1;
  const aprende = (r) => r.s === "learn" || r.s === "relearn";
  const cartoes = {
    total: regs.length,
    revisao: regs.filter((r) => r.s === "review").length,
    aprendendo: regs.filter(aprende).length,
    hoje: regs.filter((r) => r.due != null && (aprende(r) ? r.due <= agora : r.due <= fimHoje)).length,
    atrasados: regs.filter((r) => r.s === "review" && r.due != null && r.due < iniHoje).length,
    venceSemana: regs.filter((r) => r.s === "review" && r.due > fimHoje && r.due <= fimHoje + 7 * 86400000).length,
    lapsos: regs.reduce((a, r) => a + (Number(r.l) || 0), 0),
  };

  /* O MAPA: 13 semanas fechadas na segunda-feira, até hoje */
  const iniMapa = aeSomarDias(aeSegunda(hoje), -7 * (AE_SEMANAS - 1));
  const mapa = [];
  for (let d = iniMapa; d <= hoje; d = aeSomarDias(d, 1)) {
    const L = porDia[d];
    mapa.push({ d, min: L ? L.est + L.rev : 0 });
  }
  /* AS SEMANAS: estudo e revisão de cada uma */
  const semanas = [];
  for (let k = 0; k < AE_SEMANAS; k++) {
    const s = aeSomarDias(iniMapa, 7 * k), f = aeSomarDias(s, 6);
    let est = 0, rev = 0;
    dias.filter((d) => dentro(d, s, f)).forEach((d) => { est += porDia[d].est; rev += porDia[d].rev; });
    semanas.push({ ini: s, estudo: est, revisao: rev, atual: hoje >= s && hoje <= f });
  }

  const m = { periodo, nDias, ini, fim: hoje, antIni, antFim, horas, dias: diasInfo, acerto, cartoes, mapa, semanas, alertas: [] };
  m.alertas = aeAlertas(m, o.plano || null, o.r || null, F);
  return m;
}

/* O QUE ESTÁ FORA DO LUGAR — curto, com o número, e cada um leva aonde se entende ou se resolve.
 * nivel: "atencao" (algo a corrigir) ou "info" (para ler com cuidado). */
function aeAlertas(m, plano, r, F) {
  const out = [];
  const add = (nivel, chave, vars, ir) => out.push({ nivel, chave, txt: t(chave, vars || {}), ir: ir || null });
  if (m.horas.metaPeriodo && m.horas.min < 0.8 * m.horas.metaPeriodo) {
    add("atencao", "ae_al_horas", { f: aeHorasTxt(m.horas.min), meta: aeHorasTxt(m.horas.metaPeriodo),
      p: Math.round((1 - m.horas.min / m.horas.metaPeriodo) * 100) }, null);
  }
  if (m.dias.semEstudar != null && m.dias.semEstudar >= 3) add("atencao", "ae_al_parado", { n: m.dias.semEstudar }, null);
  if (plano) {
    let pd = [];
    try { pd = typeof plPorDisciplina === "function" ? plPorDisciplina(plano, r) : []; } catch (e) { pd = []; }
    const pior = pd.filter((x) => x.desvio != null && x.desvio <= -5).sort((a, b) => a.desvio - b.desvio)[0];
    if (pior) add("atencao", "ae_al_fatia", { d: pior.disciplina, p: pior.fatiaProva, tm: pior.fatiaTempo }, { aba: "disc" });
    const fora = (plano.fora || []).length;
    if (fora) add("atencao", "ae_al_fora", { n: fora }, { aba: "fila" });
  }
  if (m.acerto.pct != null && m.acerto.pctAnt != null && m.acerto.feitas >= 20 && (m.acerto.feitasAnt || 0) >= 20 && m.acerto.pct <= m.acerto.pctAnt - 5) {
    add("atencao", "ae_al_acerto", { p: m.acerto.pct, a: m.acerto.pctAnt }, { aba: "sinais" });
  }
  if (m.cartoes.atrasados) add("atencao", "ae_al_cartoes", { n: m.cartoes.atrasados }, null);
  if (plano) {
    let s = [];
    try { s = typeof plSinais === "function" ? plSinais(plano, F.diario, F.banco) : []; } catch (e) { s = []; }
    const poucas = s.filter((x) => (x.qFeitas || 0) < 10);
    if (poucas.length) add("info", "ae_al_poucas", { n: poucas.length, l: poucas.slice(0, 3).map((x) => x.disciplina).join(", ") + (poucas.length > 3 ? "…" : "") }, { aba: "sinais" });
  }
  /* o que é para corrigir vem antes do que é para ler com cuidado */
  return out.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "atencao" ? -1 : 1));
}

/* ---------------------------------------------------------------------
 * A TELA
 * --------------------------------------------------------------------- */
function aeEl(tag, cls, txt) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (txt != null) el.textContent = String(txt);
  return el;
}
/* a variação contra o período anterior: o sinal e a cor dizem para que lado foi */
function aeDelta(atual, ant, unidade, inverso) {
  if (atual == null || ant == null) return null;
  const dif = atual - ant;
  if (!dif) return { txt: t("ae_igual"), cls: "" };
  const bom = inverso ? dif < 0 : dif > 0;
  return { txt: (dif > 0 ? "+" : "−") + Math.abs(Math.round(dif)) + unidade + " " + t("ae_vs_antes"), cls: bom ? "ok" : "ruim" };
}

function aePintar(box, d) {
  const m = aeModelo({ plano: d && d.plano, r: d && d.r });
  box.dataset && (box.dataset.aePeriodo = m.periodo);
  /* o período (o mesmo nas três abas: Visão geral, Tempo e Desempenho) */
  box.append(aePeriodoBarra(m.periodo));

  /* os indicadores */
  const kpis = aeEl("div", "ae-kpis");
  const kpi = (id, rot, valor, sub, delta, ajuda) => {
    const c = aeEl("div", "ae-kpi");
    c.id = id;
    if (ajuda) c.title = ajuda;
    c.append(aeEl("div", "ae-kpi-rot", rot), aeEl("div", "ae-kpi-val", valor));
    if (sub) c.append(aeEl("div", "ae-kpi-sub", sub));
    if (delta) c.append(aeEl("div", "ae-kpi-delta " + delta.cls, delta.txt));
    kpis.append(c);
  };
  const H = m.horas;
  kpi("aeKpiHoras", t("ae_k_horas"), aeHorasTxt(H.min),
    H.metaPeriodo ? t(H.fonteMeta === "meta" ? "ae_k_horas_meta" : "ae_k_horas_plano", { m: aeHorasTxt(H.metaPeriodo), p: Math.round((H.min / H.metaPeriodo) * 100) }) : t("ae_k_horas_sem_meta"),
    H.minAnt == null ? null : aeDelta(Math.round(H.min / 60 * 10) / 10, Math.round(H.minAnt / 60 * 10) / 10, "h"),
    t("ae_k_horas_aj", { e: aeHorasTxt(H.estudo), r: aeHorasTxt(H.revisao) }));
  const D = m.dias;
  kpi("aeKpiDias", t("ae_k_dias"), t("ae_k_dias_val", { n: D.estudados, t: D.total }),
    t("ae_k_dias_seq", { n: D.sequencia }), D.estudadosAnt == null ? null : aeDelta(D.estudados, D.estudadosAnt, ""), t("ae_k_dias_aj"));
  const A = m.acerto;
  kpi("aeKpiAcerto", t("ae_k_acerto"), A.pct == null ? "—" : A.pct + "%",
    A.feitas ? t("ae_k_acerto_sub", { c: A.certas, f: A.feitas }) : t("ae_k_acerto_sem"),
    A.pct != null && A.pctAnt != null ? aeDelta(A.pct, A.pctAnt, " pp") : null, t("ae_k_acerto_aj"));
  const C = m.cartoes;
  kpi("aeKpiCartoes", t("ae_k_cartoes"), String(C.hoje),
    C.atrasados ? t("ae_k_cartoes_atras", { n: C.atrasados, s: C.venceSemana }) : t("ae_k_cartoes_sub", { s: C.venceSemana }),
    null, t("ae_k_cartoes_aj", { r: C.revisao, a: C.aprendendo, l: C.lapsos }));
  box.append(kpis);

  /* o mapa dos dias e as horas por semana, lado a lado (empilham no celular) */
  const graf = aeEl("div", "ae-graficos");
  graf.append(aePintarMapa(m), aePintarSemanas(m));
  box.append(graf);

  /* os alertas */
  const al = aeEl("div", "ae-cartao ae-alertas");
  al.id = "aeAlertas";
  al.append(aeEl("div", "ae-cartao-tit", t("ae_alertas_tit")));
  if (!m.alertas.length) al.append(aeEl("div", "ae-alerta vazio", t("ae_alertas_nada")));
  m.alertas.forEach((a, k) => {
    const li = aeEl("div", "ae-alerta " + a.nivel);
    li.append(aeEl("span", "ae-alerta-ic", a.nivel === "atencao" ? "⚠" : "ℹ"), aeEl("span", "ae-alerta-txt", a.txt));
    if (a.ir && a.ir.aba) {
      const b = aeEl("button", "btn-min ae-alerta-ir", t("ae_ver_" + a.ir.aba));
      b.type = "button";
      b.id = "btnAeIr_" + k;
      b.onclick = () => { if (typeof plAbaTrocar === "function") plAbaTrocar(a.ir.aba); };
      li.append(b);
    }
    al.append(li);
  });
  box.append(al);
  /* (19.151.0) depois do diagnóstico, o que fazer com ele — inclusive a discursiva */
  aePintarOrient(box, m, d);
  box.append(aeEl("p", "nota ae-fonte", t("ae_fonte")));
  return m;
}

/* O MAPA DOS DIAS: colunas = semanas (segunda no alto), a cor é o tempo do dia */
function aeNivel(min) { return !min ? 0 : min < 30 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4; }
function aePintarMapa(m) {
  const c = aeEl("div", "ae-cartao ae-mapa-cx");
  c.append(aeEl("div", "ae-cartao-tit", t("ae_mapa_tit")));
  const g = aeEl("div", "ae-mapa");
  g.id = "aeMapa";
  g.setAttribute("role", "img");
  const total = m.mapa.filter((x) => x.min > 0).length;
  g.setAttribute("aria-label", t("ae_mapa_aria", { n: total, s: AE_SEMANAS }));
  m.mapa.forEach((x) => {
    const q = aeEl("div", "ae-dia n" + aeNivel(x.min) + (x.d === m.fim ? " hoje" : ""));
    const [a, mm, dd] = x.d.split("-");
    q.title = dd + "/" + mm + "/" + a + ": " + (x.min ? aeHorasTxt(x.min) : t("ae_mapa_nada"));
    g.append(q);
  });
  c.append(g);
  const leg = aeEl("div", "ae-leg");
  leg.append(aeEl("span", "", t("ae_mapa_menos")));
  [0, 1, 2, 3, 4].forEach((n) => leg.append(aeEl("span", "ae-dia n" + n)));
  leg.append(aeEl("span", "", t("ae_mapa_mais")));
  c.append(leg);
  return c;
}

/* AS HORAS POR SEMANA: barras empilhadas (estudo embaixo, revisão em cima) e a linha da meta */
function aePintarSemanas(m) {
  const c = aeEl("div", "ae-cartao ae-sem-cx");
  c.append(aeEl("div", "ae-cartao-tit", t("ae_sem_tit")));
  const W = 320, Hh = 120, base = 104, topo = 10;
  const meta = m.horas.metaSemana || 0;
  const maxMin = Math.max(meta, ...m.semanas.map((s) => s.estudo + s.revisao), 60);
  const esc = (min) => (min / maxMin) * (base - topo);
  const ns = "http://www.w3.org/2000/svg";
  const mk = (tag, at) => { const e = document.createElementNS ? document.createElementNS(ns, tag) : document.createElement(tag); Object.keys(at).forEach((k) => e.setAttribute(k, at[k])); return e; };
  const svg = mk("svg", { viewBox: "0 0 " + W + " " + Hh, class: "ae-sem", role: "img", "aria-label": t("ae_sem_aria") });
  svg.id = "aeSemanas";
  const passo = W / m.semanas.length, larg = Math.min(16, passo - 6);
  svg.append(mk("line", { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, class: "ae-eixo" }));
  m.semanas.forEach((s, k) => {
    const x = k * passo + (passo - larg) / 2;
    const he = esc(s.estudo), hr = esc(s.revisao);
    const g = mk("g", { class: "ae-barra" + (s.atual ? " atual" : "") });
    const tit = mk("title", {});
    const [a, mm, dd] = s.ini.split("-");
    tit.textContent = t("ae_sem_barra", { d: dd + "/" + mm, e: aeHorasTxt(s.estudo), r: aeHorasTxt(s.revisao), t: aeHorasTxt(s.estudo + s.revisao) });
    g.append(tit);
    if (he > 0) g.append(mk("rect", { x: x.toFixed(1), y: (base - he).toFixed(1), width: larg.toFixed(1), height: he.toFixed(1), rx: 2, class: "ae-b-est" }));
    if (hr > 0) g.append(mk("rect", { x: x.toFixed(1), y: (base - he - hr - (he > 0 ? 1 : 0)).toFixed(1), width: larg.toFixed(1), height: hr.toFixed(1), rx: 2, class: "ae-b-rev" }));
    if (k === 0 || k === m.semanas.length - 1 || k % 4 === 0) {
      const tx = mk("text", { x: (x + larg / 2).toFixed(1), y: Hh - 2, "text-anchor": "middle", class: "ae-rot" });
      tx.textContent = dd + "/" + mm;
      g.append(tx);
    }
    svg.append(g);
  });
  if (meta) {
    const y = (base - esc(meta)).toFixed(1);
    svg.append(mk("line", { x1: 0, x2: W, y1: y, y2: y, class: "ae-meta" }));
    const tx = mk("text", { x: W - 2, y: Number(y) - 3, "text-anchor": "end", class: "ae-rot" });
    tx.textContent = t("ae_sem_meta", { m: aeHorasTxt(meta) });
    svg.append(tx);
  }
  c.append(svg);
  const leg = aeEl("div", "ae-leg");
  const it = (cls, txt) => { const s = aeEl("span", "ae-leg-it"); s.append(aeEl("span", "ae-leg-q " + cls), document.createTextNode(txt)); leg.append(s); };
  it("est", t("ae_leg_estudo"));
  it("rev", t("ae_leg_revisao"));
  if (meta) it("meta", t(m.horas.fonteMeta === "meta" ? "ae_leg_meta" : "ae_leg_meta_plano"));
  c.append(leg);
  return c;
}


/* =====================================================================
 * (19.150.0) AS ABAS "TEMPO" E "DESEMPENHO"
 *
 * TEMPO responde "para onde foi o meu tempo de verdade": o diário do período por disciplina, contra o quanto ela vale
 * na prova (a aba "Prova × tempo" compara o PLANO com a prova; aqui é o que você FEZ), separado em estudo e revisão;
 * as formas de estudo, com o quanto cada uma rendeu na sua avaliação; e os dias da semana em que você estuda.
 *
 * DESEMPENHO responde "estou acertando mais?": o acerto de cada disciplina semana a semana (com as linhas de 60% e
 * 85%, as mesmas que a agenda usa para subir ou descer um tópico), o chute contra a certeza, e os cartões — as
 * revisões dos próximos 30 dias e como você tem respondido (De novo · Difícil · Bom · Fácil). A tabela de antes
 * continua embaixo.
 *
 * Disciplina casa pelo nome sem acento e sem caixa: o diário, o banco de questões e o edital nem sempre escrevem igual.
 * ===================================================================== */
const AE_FORMAS = ["leitura", "videoaula", "questoes", "leiseca", "flashcards", "resumo", "mapa", "revisao", "juris"];
function aeChaveDisc(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
/* as disciplinas do plano em vista (nome, fatia da prova, fatia planejada), na ordem do peso */
function aeDiscDoPlano(plano, r) {
  if (!plano) return [];
  let pd = [];
  try { pd = typeof plPorDisciplina === "function" ? plPorDisciplina(plano, r) : []; } catch (e) { pd = []; }
  return pd.map((x) => ({ nome: x.disciplina, k: aeChaveDisc(x.disciplina), prova: x.fatiaProva, plano: x.fatiaTempo }));
}
/* o intervalo do período (o mesmo da visão geral) */
function aeIntervalo(periodo, agora, diario) {
  const hoje = aeDiaDe(agora);
  let primeiro = hoje;
  (diario || []).forEach((x) => { const d = aeDiaDe(x && x.d); if (d && d < primeiro) primeiro = d; });
  const nDias = periodo === "tudo" ? Math.max(1, aeDiasEntre(primeiro, hoje) + 1) : Number(periodo);
  const ini = aeSomarDias(hoje, -(nDias - 1));
  return { hoje, ini, nDias, antIni: aeSomarDias(ini, -nDias), antFim: aeSomarDias(ini, -1) };
}

/* ---------------- TEMPO ---------------- */
function aeTempoModelo(opc) {
  const o = opc || {};
  const F = aeFontes(o);
  const agora = o.agora || aeRelogio();
  const periodo = AE_PERIODOS.indexOf(String(o.periodo)) >= 0 ? String(o.periodo) : aePeriodoLer();
  const I = aeIntervalo(periodo, agora, F.diario);
  const base = aeDiscDoPlano(o.plano, o.r);
  const porK = {};
  base.forEach((b) => { porK[b.k] = { nome: b.nome, prova: b.prova, plano: b.plano, est: 0, rev: 0, n: 0, doPlano: true }; });
  const outros = { nome: t("ae_t_outros"), prova: null, plano: null, est: 0, rev: 0, n: 0, doPlano: false };
  const formas = {};
  AE_FORMAS.forEach((f) => { formas[f] = { forma: f, min: 0, n: 0, boa: 0, media: 0, ruim: 0 }; });
  const semana = [0, 0, 0, 0, 0, 0, 0];
  let total = 0, sessoes = 0;
  F.diario.forEach((x) => {
    if (!x || x.a === "pendente") return;
    const d = aeDiaDe(x.d);
    if (!d || d < I.ini || d > I.hoje) return;
    const m = Math.max(0, Number(x.m) || 0);
    const rev = x.a === "revisado";
    const k = aeChaveDisc(x.disc);
    const L = porK[k] || (base.length ? outros : (porK[k] = { nome: x.disc || "?", prova: null, plano: null, est: 0, rev: 0, n: 0, doPlano: false }));
    if (rev) L.rev += m; else L.est += m;
    L.n++;
    total += m; sessoes++;
    /* uma sessão com duas formas divide os minutos entre elas */
    const fs = (Array.isArray(x.f) ? x.f : []).filter((f) => formas[f]);
    const lista = fs.length ? fs : (rev ? ["revisao"] : []);
    lista.forEach((f) => {
      const F2 = formas[f];
      F2.min += m / lista.length; F2.n++;
      if (x.hu === "boa") F2.boa++; else if (x.hu === "ruim") F2.ruim++; else if (x.hu) F2.media++;
    });
    const [a, mm, dd] = d.split("-").map(Number);
    semana[(new Date(a, mm - 1, dd).getDay() + 6) % 7] += m;
  });
  const discs = Object.keys(porK).map((k) => porK[k]);
  /* "outros editais" só aparece se teve tempo (registro de 0 minuto não vira linha) */
  if (outros.est + outros.rev > 0) discs.push(outros);
  /* a fatia REAL é sobre o tempo das disciplinas do edital (é com a prova dele que se compara) */
  const totPlano = discs.filter((x) => x.doPlano).reduce((s, x) => s + x.est + x.rev, 0);
  discs.forEach((x) => {
    x.min = x.est + x.rev;
    x.real = x.doPlano && totPlano ? Math.round((x.min / totPlano) * 100) : null;
    x.desvio = x.real != null && x.prova != null ? x.real - x.prova : null;
  });
  discs.sort((a, b) => (b.doPlano - a.doPlano) || ((b.prova || 0) - (a.prova || 0)) || (b.min - a.min));
  /* a média de cada dia da semana: o total dividido por quantas vezes aquele dia apareceu no período */
  const vezes = [0, 0, 0, 0, 0, 0, 0];
  for (let d = I.ini; d <= I.hoje; d = aeSomarDias(d, 1)) {
    const [a, mm, dd] = d.split("-").map(Number);
    vezes[(new Date(a, mm - 1, dd).getDay() + 6) % 7]++;
  }
  return {
    periodo, total, sessoes, temPlano: base.length > 0, discs,
    formas: AE_FORMAS.map((f) => formas[f]).filter((f) => f.n).sort((a, b) => b.min - a.min),
    diaSemana: semana.map((m, i) => ({ i, media: vezes[i] ? Math.round(m / vezes[i]) : 0, total: Math.round(m) })),
  };
}

/* ---------------- DESEMPENHO ---------------- */
function aeDesempModelo(opc) {
  const o = opc || {};
  const F = aeFontes(o);
  const agora = o.agora || aeRelogio();
  const periodo = AE_PERIODOS.indexOf(String(o.periodo)) >= 0 ? String(o.periodo) : aePeriodoLer();
  const I = aeIntervalo(periodo, agora, F.diario);
  const hoje = I.hoje;
  const iniSem = aeSomarDias(aeSegunda(hoje), -7 * (AE_SEMANAS - 1));
  const base = aeDiscDoPlano(o.plano, o.r);
  const porK = {};
  const nova = (nome) => ({ nome, sem: Array.from({ length: AE_SEMANAS }, () => ({ f: 0, c: 0 })), f: 0, c: 0, fAnt: 0, cAnt: 0 });
  base.forEach((b) => { porK[b.k] = nova(b.nome); });
  const pega = (nome) => {
    const k = aeChaveDisc(nome);
    if (porK[k]) return porK[k];
    if (base.length) return null;          /* com edital: só as disciplinas dele */
    return (porK[k] = nova(nome || "?"));
  };
  const chute = { com: { f: 0, c: 0 }, sem: { f: 0, c: 0 } };
  const somar = (L, d, f, c) => {
    if (d >= I.ini && d <= hoje) { L.f += f; L.c += c; }
    else if (d >= I.antIni && d <= I.antFim) { L.fAnt += f; L.cAnt += c; }
    if (d >= iniSem && d <= hoje) { const k = Math.floor(aeDiasEntre(iniSem, d) / 7); if (L.sem[k]) { L.sem[k].f += f; L.sem[k].c += c; } }
  };
  F.banco.forEach((q) => {
    const L = pega(q.disciplina);
    (q.tentativas || []).forEach((tt) => {
      const d = aeDiaDe(tt && tt.q);
      if (!d || d > hoje) return;
      const v = typeof qsValorAcerto === "function" ? qsValorAcerto(tt) : (tt.acertou ? 1 : 0);
      if (L) somar(L, d, 1, v);
      /* no chute × certeza vale o ACERTOU OU NÃO (no acerto da disciplina, o chute certo vale o crédito parcial do app) */
      if (d >= I.ini) { const ch = tt.chute ? chute.com : chute.sem; ch.f++; ch.c += tt.acertou ? 1 : 0; }
    });
  });
  F.diario.forEach((x) => {
    if (!x || x.a === "pendente" || !x.q || !x.q.feitas) return;
    const d = aeDiaDe(x.d);
    const L = d && d <= hoje ? pega(x.disc) : null;
    if (L) somar(L, d, Number(x.q.feitas) || 0, Number(x.q.certas) || 0);
  });
  const pct = (c, f) => (f ? Math.round((c / f) * 100) : null);
  const discs = Object.keys(porK).map((k) => {
    const L = porK[k];
    return { nome: L.nome, feitas: L.f, certas: Math.round(L.c), pct: pct(L.c, L.f), pctAnt: periodo === "tudo" ? null : pct(L.cAnt, L.fAnt),
      sem: L.sem.map((s) => ({ f: s.f, pct: pct(s.c, s.f) })) };
  });
  /* com mais questões primeiro: é onde o número já diz alguma coisa */
  discs.sort((a, b) => b.feitas - a.feitas);

  /* os cartões: as revisões dos próximos 30 dias (o que já venceu entra em "hoje") e as notas dadas */
  const regs = Object.keys(F.regs || {}).map((k) => F.regs[k]).filter((r) => r && typeof r === "object");
  const dt = new Date(agora);
  const iniHoje = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const previsao = Array.from({ length: 30 }, (_, i) => ({ d: aeSomarDias(hoje, i), n: 0 }));
  regs.forEach((r) => {
    if (r.due == null) return;
    const i = r.due < iniHoje ? 0 : Math.floor((r.due - iniHoje) / 86400000);
    if (i >= 0 && i < 30) previsao[i].n++;
  });
  const notas = [0, 0, 0, 0];
  regs.forEach((r) => (Array.isArray(r.h) ? r.h : []).forEach((n) => { if (n >= 1 && n <= 4) notas[n - 1]++; }));
  const limiar = typeof ESTC_LEECH_LIMIAR !== "undefined" ? ESTC_LEECH_LIMIAR : 8;
  const cartoes = { total: regs.length, previsao, notas, respostas: notas.reduce((a, b) => a + b, 0),
    dificeis: regs.filter((r) => (Number(r.l) || 0) >= limiar).length, limiar };
  return { periodo, discs, chute: { com: { f: chute.com.f, pct: pct(chute.com.c, chute.com.f) }, sem: { f: chute.sem.f, pct: pct(chute.sem.c, chute.sem.f) } }, cartoes, iniSem };
}

/* ---------------- desenho ---------------- */
function aePeriodoBarra(periodo) {
  const per = aeEl("div", "ae-periodo");
  per.append(aeEl("span", "ae-periodo-rot", t("ae_periodo")));
  AE_PERIODOS.forEach((p) => {
    const b = aeEl("button", "ae-chip" + (p === periodo ? " ativo" : ""), t("ae_per_" + p));
    b.type = "button";
    b.id = "btnAePer_" + p;
    b.setAttribute("aria-pressed", p === periodo ? "true" : "false");
    b.onclick = () => aePeriodoDefinir(p);
    per.append(b);
  });
  return per;
}
function aeSvg(tag, at) {
  const e = document.createElementNS ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  Object.keys(at || {}).forEach((k) => e.setAttribute(k, at[k]));
  return e;
}
function aeCartao(tit, id) {
  const c = aeEl("div", "ae-cartao");
  if (id) c.id = id;
  c.append(aeEl("div", "ae-cartao-tit", tit));
  return c;
}

function aePintarTempo(box, d) {
  const m = aeTempoModelo({ plano: d && d.plano, r: d && d.r });
  box.append(aePeriodoBarra(m.periodo));
  if (!m.sessoes) { box.append(aeEl("div", "plog-vazio", t("ae_t_vazio"))); return m; }

  /* 1. por disciplina: a fatia real (estudo + revisão) e a marca da fatia da prova */
  const c1 = aeCartao(t(m.temPlano ? "ae_t_disc_tit" : "ae_t_disc_tit_sem"), "aeTempoDisc");
  const maxPct = Math.max(1, ...m.discs.map((x) => Math.max(x.real || 0, x.prova || 0, x.doPlano ? 0 : 0)));
  const maxMin = Math.max(1, ...m.discs.map((x) => x.min));
  m.discs.forEach((x, k) => {
    const li = aeEl("div", "ae-linha" + (x.doPlano ? "" : " fora"));
    li.id = "aeTd_" + k;
    li.append(aeEl("span", "ae-linha-nome", x.nome));
    const trilho = aeEl("span", "ae-trilho");
    const escala = (v) => Math.max(0, Math.min(100, x.doPlano ? (v / maxPct) * 100 : (v / maxMin) * 100));
    const tot = x.doPlano ? (x.real || 0) : x.min;
    const pE = x.min ? (x.est / x.min) : 0;
    const larg = escala(tot);
    const be = aeEl("span", "ae-seg est"), br = aeEl("span", "ae-seg rev");
    if (be.style) { be.style.width = (larg * pE).toFixed(1) + "%"; br.style.width = (larg * (1 - pE)).toFixed(1) + "%"; }
    trilho.append(be, br);
    if (x.prova != null) {
      const mk = aeEl("span", "ae-marca");
      if (mk.style) mk.style.left = escala(x.prova).toFixed(1) + "%";
      mk.title = t("ae_t_marca", { p: x.prova });
      trilho.append(mk);
    }
    li.append(trilho);
    const num = aeEl("span", "ae-linha-num", x.doPlano ? t("ae_t_real_prova", { r: x.real == null ? "—" : x.real, p: x.prova == null ? "—" : x.prova }) : aeHorasTxt(x.min));
    li.append(num);
    const dv = aeEl("span", "ae-linha-dv" + (x.desvio == null ? "" : x.desvio <= -5 ? " ruim" : x.desvio >= 5 ? " mais" : " ok"),
      x.desvio == null ? "" : (x.desvio > 0 ? "+" : x.desvio < 0 ? "−" : "") + Math.abs(x.desvio) + " pp");
    li.append(dv);
    li.title = t("ae_t_linha_aj", { d: x.nome, t: aeHorasTxt(x.min), e: aeHorasTxt(x.est), r: aeHorasTxt(x.rev), n: x.n });
    c1.append(li);
  });
  const leg = aeEl("div", "ae-leg");
  const it = (cls, txt) => { const s = aeEl("span", "ae-leg-it"); s.append(aeEl("span", "ae-leg-q " + cls), document.createTextNode(txt)); leg.append(s); };
  it("est", t("ae_leg_estudo")); it("rev", t("ae_leg_revisao"));
  if (m.temPlano) it("prova", t("ae_t_leg_prova"));
  c1.append(leg);
  box.append(c1);

  const lado = aeEl("div", "ae-graficos");
  /* 2. as formas de estudo e o quanto renderam */
  const c2 = aeCartao(t("ae_t_formas_tit"), "aeTempoFormas");
  const maxF = Math.max(1, ...m.formas.map((f) => f.min));
  m.formas.forEach((f) => {
    const li = aeEl("div", "ae-linha ae-linha-forma");
    const rot = t("ed_forma_" + f.forma);
    li.append(aeEl("span", "ae-linha-nome", rot.charAt(0).toUpperCase() + rot.slice(1)));
    const trilho = aeEl("span", "ae-trilho");
    const b = aeEl("span", "ae-seg est");
    if (b.style) b.style.width = ((f.min / maxF) * 100).toFixed(1) + "%";
    trilho.append(b);
    li.append(trilho, aeEl("span", "ae-linha-num", aeHorasTxt(f.min)));
    const aval = f.boa + f.media + f.ruim;
    li.append(aeEl("span", "ae-linha-dv" + (aval && f.ruim > f.boa ? " ruim" : ""), aval ? t("ae_t_rendeu", { b: Math.round((f.boa / aval) * 100) }) : ""));
    li.title = t("ae_t_forma_aj", { n: f.n, b: f.boa, m: f.media, r: f.ruim });
    c2.append(li);
  });
  c2.append(aeEl("p", "nota ae-fonte", t("ae_t_formas_nota")));
  /* 3. os dias da semana */
  const c3 = aeCartao(t("ae_t_dias_tit"), "aeTempoDias");
  const W = 280, H = 110, base = 92;
  const maxD = Math.max(30, ...m.diaSemana.map((x) => x.media));
  const svg = aeSvg("svg", { viewBox: "0 0 " + W + " " + H, class: "ae-sem", role: "img", "aria-label": t("ae_t_dias_aria") });
  const passo = W / 7, larg = Math.min(22, passo - 10);
  svg.append(aeSvg("line", { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, class: "ae-eixo" }));
  m.diaSemana.forEach((x) => {
    const h = (x.media / maxD) * (base - 14);
    const xx = x.i * passo + (passo - larg) / 2;
    const g = aeSvg("g", { class: "ae-barra" });
    const tit = aeSvg("title", {}); tit.textContent = t("ae_t_dia_barra", { d: t("ae_dia_" + x.i), m: aeHorasTxt(x.media), t: aeHorasTxt(x.total) });
    g.append(tit);
    if (h > 0) g.append(aeSvg("rect", { x: xx.toFixed(1), y: (base - h).toFixed(1), width: larg.toFixed(1), height: h.toFixed(1), rx: 2, class: "ae-b-est" }));
    const tx = aeSvg("text", { x: (xx + larg / 2).toFixed(1), y: H - 4, "text-anchor": "middle", class: "ae-rot" });
    tx.textContent = t("ae_dia_" + x.i);
    g.append(tx);
    if (x.media) { const v = aeSvg("text", { x: (xx + larg / 2).toFixed(1), y: (base - h - 3).toFixed(1), "text-anchor": "middle", class: "ae-rot" }); v.textContent = aeHorasTxt(x.media); g.append(v); }
    svg.append(g);
  });
  c3.append(svg, aeEl("p", "nota ae-fonte", t("ae_t_dias_nota")));
  lado.append(c2, c3);
  box.append(lado);
  box.append(aeEl("p", "nota ae-fonte", t("ae_t_fonte")));
  return m;
}

/* a linha do acerto de 13 semanas: pontos onde houve questão, as linhas de 60% e 85% ao fundo */
function aeFaisca(sem) {
  const W = 130, H = 34, pad = 3;
  const svg = aeSvg("svg", { viewBox: "0 0 " + W + " " + H, class: "ae-faisca", role: "img" });
  const y = (p) => (pad + (1 - p / 100) * (H - 2 * pad)).toFixed(1);
  const x = (i) => (pad + (i / (sem.length - 1)) * (W - 2 * pad)).toFixed(1);
  [60, 85].forEach((v) => svg.append(aeSvg("line", { x1: 0, x2: W, y1: y(v), y2: y(v), class: "ae-ref" })));
  const pts = sem.map((s, i) => (s.pct == null ? null : [x(i), y(s.pct), s])).filter(Boolean);
  if (pts.length > 1) svg.append(aeSvg("polyline", { points: pts.map((p) => p[0] + "," + p[1]).join(" "), class: "ae-pl" }));
  pts.forEach((p) => {
    const c = aeSvg("circle", { cx: p[0], cy: p[1], r: 2.6, class: "ae-ponto" });
    const tt = aeSvg("title", {}); tt.textContent = p[2].pct + "% (" + p[2].f + ")";
    c.append(tt);
    svg.append(c);
  });
  svg.setAttribute("aria-label", t("ae_d_faisca_aria", { n: pts.length }));
  return svg;
}

function aePintarDesemp(box, d) {
  const m = aeDesempModelo({ plano: d && d.plano, r: d && d.r });
  box.append(aePeriodoBarra(m.periodo));
  /* 1. acerto por disciplina, semana a semana */
  const c1 = aeCartao(t("ae_d_disc_tit"), "aeDesDisc");
  if (!m.discs.length) c1.append(aeEl("div", "ae-alerta vazio", t("ae_d_vazio")));
  m.discs.forEach((x, k) => {
    const li = aeEl("div", "ae-linha ae-linha-acerto" + (x.feitas < 10 ? " pouco" : ""));
    li.id = "aeDd_" + k;
    li.append(aeEl("span", "ae-linha-nome", x.nome), aeFaisca(x.sem));
    li.append(aeEl("span", "ae-linha-num", x.pct == null ? "—" : x.pct + "%"));
    const dl = x.pct != null && x.pctAnt != null ? x.pct - x.pctAnt : null;
    li.append(aeEl("span", "ae-linha-dv" + (dl == null ? "" : dl <= -5 ? " ruim" : dl >= 5 ? " ok" : ""),
      dl == null ? "" : (dl > 0 ? "+" : dl < 0 ? "−" : "") + Math.abs(dl) + " pp"));
    li.append(aeEl("span", "ae-linha-q", t("ae_d_q", { n: x.feitas })));
    li.title = x.feitas < 10 ? t("ae_d_pouco_aj") : t("ae_d_linha_aj", { c: x.certas, f: x.feitas });
    c1.append(li);
  });
  c1.append(aeEl("p", "nota ae-fonte", t("ae_d_disc_nota")));
  box.append(c1);

  const lado = aeEl("div", "ae-graficos");
  /* 2. os cartões: as revisões dos próximos 30 dias e as notas */
  const C = m.cartoes;
  const c2 = aeCartao(t("ae_d_cart_tit"), "aeDesCartoes");
  if (!C.total) c2.append(aeEl("div", "ae-alerta vazio", t("ae_d_cart_vazio")));
  else {
    const W = 300, H = 96, base = 80;
    const maxN = Math.max(5, ...C.previsao.map((x) => x.n));
    const svg = aeSvg("svg", { viewBox: "0 0 " + W + " " + H, class: "ae-sem", role: "img", "aria-label": t("ae_d_prev_aria") });
    svg.id = "aeDesPrev";
    const passo = W / 30, larg = Math.max(3, passo - 2);
    svg.append(aeSvg("line", { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, class: "ae-eixo" }));
    C.previsao.forEach((x, i) => {
      const h = (x.n / maxN) * (base - 10);
      const g = aeSvg("g", { class: "ae-barra" + (i === 0 ? " hoje" : "") });
      const [a, mm, dd] = x.d.split("-");
      const tt = aeSvg("title", {}); tt.textContent = (i === 0 ? t("ae_d_prev_hoje", { n: x.n }) : dd + "/" + mm + ": " + x.n);
      g.append(tt);
      if (h > 0) g.append(aeSvg("rect", { x: (i * passo + 1).toFixed(1), y: (base - h).toFixed(1), width: larg.toFixed(1), height: h.toFixed(1), rx: 1.5, class: i === 0 ? "ae-b-hoje" : "ae-b-est" }));
      if (i === 0 || i === 7 || i === 14 || i === 21 || i === 29) {
        const tx = aeSvg("text", { x: (i * passo + larg / 2 + 1).toFixed(1), y: H - 2, "text-anchor": i === 29 ? "end" : "start", class: "ae-rot" });
        tx.textContent = i === 0 ? t("ae_d_hoje") : dd + "/" + mm;
        g.append(tx);
      }
      svg.append(g);
    });
    c2.append(svg);
    c2.append(aeEl("p", "nota ae-fonte", t("ae_d_prev_nota", { n: C.previsao[0].n })));
    /* as notas dadas: uma barra só, em quatro partes */
    if (C.respostas) {
      const barra = aeEl("div", "ae-notas");
      barra.id = "aeDesNotas";
      ["n1", "n2", "n3", "n4"].forEach((cls, i) => {
        const pc = Math.round((C.notas[i] / C.respostas) * 100);
        const s = aeEl("span", "ae-nota " + cls);
        if (s.style) s.style.width = ((C.notas[i] / C.respostas) * 100).toFixed(1) + "%";
        s.title = t("ae_d_nota_" + (i + 1)) + ": " + C.notas[i] + " (" + pc + "%)";
        barra.append(s);
      });
      c2.append(aeEl("div", "ae-cartao-tit ae-sub-tit", t("ae_d_notas_tit", { n: C.respostas })), barra);
      const leg = aeEl("div", "ae-leg");
      ["n1", "n2", "n3", "n4"].forEach((cls, i) => {
        const s = aeEl("span", "ae-leg-it");
        s.append(aeEl("span", "ae-leg-q " + cls), document.createTextNode(t("ae_d_nota_" + (i + 1)) + " " + Math.round((C.notas[i] / C.respostas) * 100) + "%"));
        leg.append(s);
      });
      c2.append(leg);
    }
    if (C.dificeis) c2.append(aeEl("p", "nota ae-fonte", t("ae_d_dificeis", { n: C.dificeis, l: C.limiar })));
  }
  /* 3. o chute */
  const c3 = aeCartao(t("ae_d_chute_tit"), "aeDesChute");
  const ch = m.chute;
  if (!ch.com.f && !ch.sem.f) c3.append(aeEl("div", "ae-alerta vazio", t("ae_d_chute_vazio")));
  else {
    const linha = (rot, x) => {
      const li = aeEl("div", "ae-linha ae-linha-forma");
      li.append(aeEl("span", "ae-linha-nome", rot));
      const trilho = aeEl("span", "ae-trilho");
      const b = aeEl("span", "ae-seg est");
      if (b.style) b.style.width = (x.pct || 0) + "%";
      trilho.append(b);
      li.append(trilho, aeEl("span", "ae-linha-num", x.pct == null ? "—" : x.pct + "%"), aeEl("span", "ae-linha-q", t("ae_d_q", { n: x.f })));
      return li;
    };
    c3.append(linha(t("ae_d_chute_sem"), ch.sem), linha(t("ae_d_chute_com"), ch.com));
    c3.append(aeEl("p", "nota ae-fonte", t("ae_d_chute_nota")));
  }
  lado.append(c2, c3);
  box.append(lado);
  return m;
}

/* =====================================================================
 * (19.151.0) ORIENTAÇÕES — o que fazer com o diagnóstico
 *
 * "Junto com o diagnóstico do estudo, deve haver orientações para o estudante, inclusive quanto às discursivas."
 *
 * O diagnóstico diz o que está fora do lugar; a orientação diz O QUE FAZER, com o número que a justifica e um botão
 * para começar. As regras são poucas e explícitas (nada de "IA" escondida): reta final, ritmo contra a meta, tempo
 * contra o peso, acerto baixo, disciplina sem questão, revisões acumuladas, constância e a proporção de revisão.
 * No máximo cinco, da mais urgente à menos; sem nada a corrigir, uma só: "siga o plano".
 *
 * A DISCURSIVA usa a estratégia que a tela das discursivas já calcula (dsEstrategia): a fase (fundação, construção,
 * intensivo, reta final), a meta de redações por semana, quantas você fez nesta, a média das últimas contra o mínimo
 * e o próximo tema — uma linha por edital ativo que tem discursiva.
 * ===================================================================== */
const AE_ORIENT_MAX = 5;

/* a discursiva de cada edital ativo (o que a tela das discursivas mostra, resumido) */
function aeDiscursivasInfo(plano) {
  const out = [];
  if (typeof editais === "undefined" || !Array.isArray(editais) || typeof dsDiscursivaDe !== "function") return out;
  editais.forEach((e) => {
    try {
      if (typeof edSituacao === "function" && edSituacao(e).grupo === "encerrado") return;
      const { dc } = dsDiscursivaDe(e);
      if (!dc) return;
      const sit = dsDiasProva(e);
      if (sit.dias != null && sit.dias < 0) return;
      const res = dsRedacoesResumo(e.id, dc);
      const est = dsEstrategia(sit.dias, res, dc, sit);
      let tema = null;
      try { tema = dsProximoTema(e, plano, dc); } catch (err) { tema = null; }
      out.push({ id: e.id, nome: e.nome || "", est, feitas: dsFeitasSemana(e.id), res, tema, semFormato: !!dc.semFormato });
    } catch (err) {}
  });
  return out;
}

/* as orientações de estudo: { k, nivel ("agir" | "ajustar" | "manter"), tit, txt, ir } */
function aeOrientacoes(o) {
  const m = o.m, T = o.T || null, D = o.D || null;
  const out = [];
  const add = (k, nivel, vars, ir) => out.push({ k, nivel, tit: t("ae_o_" + k + "_tit", vars || {}), txt: t("ae_o_" + k, vars || {}), ir: ir || null });
  /* 1. reta final */
  if (o.diasProva != null && o.diasProva >= 0 && o.diasProva <= 21) add("reta", "agir", { n: o.diasProva }, { aba: "sinais" });
  /* 2. o ritmo contra a meta: a média das últimas 4 semanas fechadas */
  const fechadas = (m.semanas || []).filter((s) => !s.atual).slice(-4);
  const ritmo = fechadas.length ? Math.round(fechadas.reduce((a, s) => a + s.estudo + s.revisao, 0) / fechadas.length) : 0;
  if (m.horas.metaSemana && m.horas.metaPeriodo && m.horas.min < 0.8 * m.horas.metaPeriodo) {
    add("ritmo", "ajustar", { r: aeHorasTxt(ritmo), m: aeHorasTxt(m.horas.metaSemana) }, null);
  }
  /* 3. o tempo contra o peso: a mais esquecida e, se houver, a que leva tempo demais */
  if (T && T.temPlano) {
    const falta = T.discs.filter((x) => x.doPlano && x.desvio != null && x.desvio <= -8 && (x.prova || 0) >= 8).sort((a, b) => a.desvio - b.desvio)[0];
    const sobra = T.discs.filter((x) => x.doPlano && x.desvio != null && x.desvio >= 15).sort((a, b) => b.desvio - a.desvio)[0];
    if (falta) {
      const acS = sobra && D ? (D.discs.filter((y) => aeChaveDisc(y.nome) === aeChaveDisc(sobra.nome))[0] || {}).pct : null;
      if (sobra && acS != null && acS >= 85) add("trocar", "agir", { d: falta.nome, p: falta.prova, r: falta.real, s: sobra.nome, sr: sobra.real, sp: sobra.prova, a: acS }, { aba: "tempo" });
      else add("falta", "agir", { d: falta.nome, p: falta.prova, r: falta.real }, { aba: "tempo" });
    }
  }
  /* 4. acerto baixo: teoria antes de mais questões */
  if (D) {
    const baixo = D.discs.filter((x) => x.feitas >= 10 && x.pct != null && x.pct < 60).sort((a, b) => a.pct - b.pct)[0];
    if (baixo) add("acerto", "agir", { d: baixo.nome, p: baixo.pct, n: baixo.feitas }, { aba: "sinais" });
    /* 5. disciplina de peso sem questão */
    if (T && T.temPlano) {
      const pesos = {};
      T.discs.forEach((x) => { if (x.doPlano) pesos[aeChaveDisc(x.nome)] = x.prova || 0; });
      const sem = D.discs.filter((x) => x.feitas < 10 && (pesos[aeChaveDisc(x.nome)] || 0) >= 8);
      if (sem.length) add("questoes", "ajustar", { l: sem.slice(0, 3).map((x) => x.nome + " (" + pesos[aeChaveDisc(x.nome)] + "%)").join(", ") }, { aba: "sinais" });
    }
  }
  /* 6. revisões de cartões acumuladas */
  if (m.cartoes.hoje >= 40 || m.cartoes.atrasados >= 20) add("cartoes", "ajustar", { n: m.cartoes.hoje, a: m.cartoes.atrasados }, null);
  /* 7. constância */
  if (m.dias.total >= 7 && m.dias.estudados / m.dias.total < 0.5) {
    let fraco = "";
    if (T && T.diaSemana) { const f = T.diaSemana.slice().sort((a, b) => a.media - b.media)[0]; fraco = f ? t("ae_dia_" + f.i) : ""; }
    add("constancia", "ajustar", { n: m.dias.estudados, t: m.dias.total, d: fraco }, null);
  }
  /* 8. a proporção de revisão */
  if (m.horas.min >= 600) {
    const pr = Math.round((m.horas.revisao / m.horas.min) * 100);
    if (pr < 15) add("pouca_rev", "ajustar", { p: pr }, null);
    else if (pr > 50) add("muita_rev", "ajustar", { p: pr }, { aba: "fila" });
  }
  const ordem = { agir: 0, ajustar: 1, manter: 2 };
  out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  if (!out.length) add("seguir", "manter", {}, null);
  return out.slice(0, AE_ORIENT_MAX);
}

/* a orientação da discursiva de um edital, em frases */
function aeOrientDiscursiva(x) {
  const E = x.est;
  const linhas = [];
  linhas.push(t("ae_od_meta", { f: E.nome, m: E.meta, s: x.feitas }));
  /* a frase da fase traz a meta PADRÃO dela; quando a estratégia ajustou a meta (discursiva em data própria, notas
   * abaixo do mínimo), quem explica é o ajuste — a frase da fase contradiria o número logo acima */
  const PADRAO = { sem_data: 1, reta: 2, intensivo: 3, construcao: 2, fundacao: 1 };
  if (E.foco && PADRAO[E.fase] === E.meta) linhas.push(E.foco);
  (E.ajustes || []).slice(0, 1).forEach((a) => linhas.push(a));
  if (x.tema && x.tema.tema) linhas.push(t("ae_od_tema", { t: x.tema.tema, d: x.tema.disc ? " (" + x.tema.disc + ")" : "" }));
  if (x.semFormato) linhas.push(t("ae_od_formato"));
  return linhas;
}

function aePintarOrient(box, m, d) {
  let T = null, D = null;
  try { T = aeTempoModelo({ plano: d && d.plano, r: d && d.r, periodo: m.periodo }); } catch (e) { T = null; }
  try { D = aeDesempModelo({ plano: d && d.plano, r: d && d.r, periodo: m.periodo }); } catch (e) { D = null; }
  const prazo = d && d.plano && d.plano.prazo;
  const diasProva = prazo && /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? aeDiasEntre(m.fim, prazo) : null;
  const lista = aeOrientacoes({ m, T, D, diasProva });
  const c = aeCartao(t("ae_o_tit"), "aeOrient");
  lista.forEach((o, k) => {
    const li = aeEl("div", "ae-orient " + o.nivel);
    li.id = "aeOr_" + o.k;
    const tx = aeEl("div", "ae-orient-tx");
    tx.append(aeEl("div", "ae-orient-tit", (k + 1) + ". " + o.tit), aeEl("div", "ae-orient-txt", o.txt));
    li.append(tx);
    if (o.ir && o.ir.aba) {
      const b = aeEl("button", "btn-min", t("ae_ver_" + o.ir.aba));
      b.type = "button";
      b.onclick = () => { if (typeof plAbaTrocar === "function") plAbaTrocar(o.ir.aba); };
      li.append(b);
    }
    c.append(li);
  });
  /* a discursiva, por edital */
  const ds = aeDiscursivasInfo(d && d.plano);
  if (ds.length) {
    c.append(aeEl("div", "ae-cartao-tit ae-sub-tit", t("ae_od_tit")));
    ds.forEach((x) => {
      const li = aeEl("div", "ae-orient disc" + (x.feitas >= x.est.meta ? " ok" : ""));
      li.id = "aeOrDs_" + x.id;
      const tx = aeEl("div", "ae-orient-tx");
      tx.append(aeEl("div", "ae-orient-tit", x.nome + (x.est.dias != null ? " · " + t("ae_od_dias", { n: x.est.dias }) : "")));
      aeOrientDiscursiva(x).forEach((l) => tx.append(aeEl("div", "ae-orient-txt", l)));
      li.append(tx);
      const b = aeEl("button", "btn-min", t("ae_od_abrir"));
      b.type = "button";
      b.onclick = () => {
        try { const dl = document.getElementById("dlgPlanoLog"); if (dl && dl.open) dl.close(); } catch (e) {}
        if (typeof dsIrPara === "function") dsIrPara(x.id);
      };
      li.append(b);
      c.append(li);
    });
  }
  c.append(aeEl("p", "nota ae-fonte", t("ae_o_nota")));
  box.append(c);
  return { lista, ds };
}

/* =====================================================================
 * (19.153.0) A ABA "COBERTURA" — o quanto do edital já tem estudo, material e revisão, num lugar só
 *
 * Cada pergunta tinha a sua tela: o Domínio (quanto sei), a Cobertura de cartões (tenho cartão na proporção do peso),
 * as Leis do edital (o que falta ler), a leitura dos resumos (seções lidas) e o banco de questões. Aqui elas viram
 * COLUNAS de uma mesma tabela, uma linha por disciplina na ordem do peso, cada célula com a barra, o número e o atalho
 * para a tela que detalha. Em cima, o total do edital, ponderado pelo peso de cada disciplina na prova.
 *
 * NADA É MEDIDO DE NOVO: domDoEdital (o mesmo mapa do Domínio), covDoEdital (o da Cobertura de cartões), ledModelo (o
 * das Leis do edital), rlsSecoes/rlsResumo sobre o texto de cada resumo (a mesma conta do "lida / mudou") e as
 * tentativas do banco de questões.
 * ===================================================================== */
const AE_DOM_NIVEIS = ["verde", "azul", "amarelo", "vermelho", "cinza"];
let aeLeisPedidas = false;

function aeCoberturaModelo(e, opc) {
  const o = opc || {};
  if (!e) return null;
  const r = lerEdital(e.texto || "");
  const ativas = (r.disciplinas || []).filter((d) => !d.inativa);
  const linhas = {};
  const pega = (nome) => linhas[aeChaveDisc(nome)];
  ativas.forEach((d) => { linhas[aeChaveDisc(d.nome)] = { nome: d.nome, pesoPct: 0, dom: null, resumo: null, cartoes: null, leis: null, questoes: 0 }; });

  /* o domínio: a distribuição por nível, já pelo peso dos tópicos (e o peso da disciplina na prova) */
  let dom = o.dom;
  if (dom === undefined) { try { dom = typeof domDoEdital === "function" ? domDoEdital(e) : null; } catch (err) { dom = null; } }
  ((dom && dom.disciplinas) || []).forEach((D) => {
    const L = pega(D.nome);
    if (!L) return;
    L.pesoPct = D.pesoPct || 0;
    L.dom = Object.assign({}, D.distribuicao || {});
  });

  /* os cartões: a parte do peso de cada disciplina cujas folhas estão no alvo (ok ou excesso) */
  let cov = o.cov;
  if (cov === undefined) { try { cov = typeof covDoEdital === "function" ? covDoEdital(e, typeof cqLerBiblioteca === "function" ? cqLerBiblioteca() : []) : null; } catch (err) { cov = null; } }
  const covD = {};
  ((cov && cov.folhas) || []).forEach((f) => {
    const k = aeChaveDisc(f.disciplina);
    const c = covD[k] || (covD[k] = { peso: 0, ok: 0, cartoes: 0 });
    c.peso += f.pesoPct || 0;
    if (f.faixa === "ok" || f.faixa === "excesso") c.ok += f.pesoPct || 0;
    c.cartoes += f.cartoes || 0;
  });
  Object.keys(covD).forEach((k) => {
    const L = linhas[k];
    if (L) L.cartoes = { pct: covD[k].peso ? Math.round((covD[k].ok / covD[k].peso) * 100) : 0, n: covD[k].cartoes };
  });

  /* os resumos: a parte do peso dos tópicos que TEM resumo, e quanto dele foi lido (seções marcadas) */
  const res = o.resumos || (typeof matResumos !== "undefined" ? matResumos : {});
  ativas.forEach((d) => {
    const L = pega(d.nome);
    let soma = 0, com = 0, lido = 0, nCom = 0;
    (d.topicos || []).forEach((tp) => {
      const w = Number(tp.peso) || 1;
      soma += w;
      let ch = "";
      try { ch = typeof matChaveViva === "function" ? matChaveViva(d.nome, tp.nome) : matChave(d.nome, tp.nome); } catch (err) { ch = ""; }
      const txt = ch && res[ch] && res[ch].texto ? String(res[ch].texto) : "";
      if (!txt.trim()) return;
      com += w; nCom++;
      try {
        const R = typeof rlsResumo === "function" ? rlsResumo(rlsSecoes(txt), typeof rlsMarcasDe === "function" ? rlsMarcasDe(ch) : {}) : null;
        if (R && R.total) lido += w * (R.lidas / R.total);
      } catch (err) {}
    });
    L.resumo = { pct: soma ? Math.round((com / soma) * 100) : 0, lidoPct: soma ? Math.round((lido / soma) * 100) : 0, n: nCom };
  });

  /* as leis do edital: os artigos cobrados já lidos (só quando a biblioteca de leis já foi lida do IndexedDB) */
  let led = o.led;
  if (led === undefined) {
    let pronta = true;
    try { pronta = typeof _leisCache === "undefined" || _leisCache !== null; } catch (err) { pronta = true; }
    try { led = pronta && typeof ledModelo === "function" ? ledModelo(e.id) : null; } catch (err) { led = null; }
  }
  ((led && led.disciplinas) || []).forEach((D) => {
    const L = pega(D.nome);
    if (L && D.total) L.leis = { pct: D.pct, lidos: D.lidos, total: D.total };
  });

  /* as questões respondidas (todas, desde o começo) */
  (o.banco || (typeof qsBanco !== "undefined" && qsBanco) || []).forEach((q) => {
    const L = pega(q.disciplina);
    if (L) L.questoes += (q.tentativas || []).length;
  });

  const lista = Object.keys(linhas).map((k) => linhas[k]).sort((a, b) => b.pesoPct - a.pesoPct);
  /* o total do edital, pelo peso de cada disciplina na prova */
  const somaP = lista.reduce((a, x) => a + (x.pesoPct || 0), 0) || 1;
  const pond = (f) => {
    const com = lista.filter((x) => f(x) != null);
    const p = com.reduce((a, x) => a + (x.pesoPct || 0), 0);
    return com.length && p ? Math.round(com.reduce((a, x) => a + f(x) * (x.pesoPct || 0), 0) / p) : null;
  };
  const total = {
    dominado: pond((x) => (x.dom ? (x.dom.verde || 0) + (x.dom.azul || 0) : null)),
    resumo: pond((x) => (x.resumo ? x.resumo.pct : null)),
    lido: pond((x) => (x.resumo ? x.resumo.lidoPct : null)),
    cartoes: pond((x) => (x.cartoes ? x.cartoes.pct : null)),
    leis: led && led.total ? led.pct : null,
    leisN: led ? led.n : 0,
    questoes: lista.reduce((a, x) => a + x.questoes, 0),
  };
  return { edId: e.id, nome: e.nome || "", lista, total, somaP, ledPendente: led === null };
}

function aeBarrinha(pct, cls) {
  const tr = aeEl("span", "ae-trilho ae-cov-tr");
  const b = aeEl("span", "ae-seg " + (cls || "est"));
  if (b.style) b.style.width = Math.max(0, Math.min(100, pct || 0)) + "%";
  tr.append(b);
  return tr;
}
function aeDomBarra(dist) {
  const tr = aeEl("span", "ae-trilho ae-cov-tr ae-dom-tr");
  AE_DOM_NIVEIS.forEach((n) => {
    const v = (dist && dist[n]) || 0;
    if (!v) return;
    const s = aeEl("span", "ae-seg dom-" + n);
    if (s.style) s.style.width = v + "%";
    s.title = t("ae_c_dom_" + n) + ": " + Math.round(v) + "%";
    tr.append(s);
  });
  return tr;
}

function aePintarCobertura(box, d) {
  let e = null;
  try { e = d && typeof editais !== "undefined" ? editais.filter((x) => x.id === d.editalId)[0] : null; } catch (err) { e = null; }
  if (!e) { box.append(aeEl("div", "plog-vazio", t("plog_sem_edital"))); return null; }
  const m = aeCoberturaModelo(e);
  /* a biblioteca de leis ainda vindo do IndexedDB: a coluna fica "lendo…" e a aba se repinta quando ela chegar */
  /* UMA vez por sessão: se a leitura terminar sem a biblioteca (aparelho sem IndexedDB), repintar pediria de novo, sem fim */
  if (m.ledPendente && !aeLeisPedidas && typeof leisIdbMigrar === "function") {
    aeLeisPedidas = true;
    try { Promise.resolve(leisIdbMigrar()).then(() => { if (typeof plAba !== "undefined" && plAba === "cobertura" && typeof plPintar === "function") plPintar(); }); } catch (err) {}
  }
  const T = m.total;
  const kpis = aeEl("div", "ae-kpis");
  const kpi = (id, rot, v, sub, aj) => {
    const c = aeEl("div", "ae-kpi"); c.id = id; if (aj) c.title = aj;
    c.append(aeEl("div", "ae-kpi-rot", rot), aeEl("div", "ae-kpi-val", v == null ? "—" : v + "%"));
    if (sub) c.append(aeEl("div", "ae-kpi-sub", sub));
    kpis.append(c);
  };
  kpi("aeCobDom", t("ae_c_k_dom"), T.dominado, t("ae_c_k_dom_sub"), t("ae_c_k_dom_aj"));
  kpi("aeCobRes", t("ae_c_k_res"), T.resumo, T.lido == null ? "" : t("ae_c_k_res_sub", { l: T.lido }), t("ae_c_k_res_aj"));
  kpi("aeCobCart", t("ae_c_k_cart"), T.cartoes, t("ae_c_k_cart_sub"), t("ae_c_k_cart_aj"));
  kpi("aeCobLeis", t("ae_c_k_leis"), T.leis, m.ledPendente ? t("ae_c_lendo") : t("ae_c_k_leis_sub", { n: T.leisN }), t("ae_c_k_leis_aj"));
  box.append(kpis);

  const c = aeCartao(t("ae_c_tit"), "aeCobTab");
  const cab = aeEl("div", "ae-cov-linha ae-cov-cab");
  [t("ae_c_disc"), t("ae_c_dom"), t("ae_c_res"), t("ae_c_cart"), t("ae_c_leis"), t("ae_c_q")].forEach((x) => cab.append(aeEl("span", "", x)));
  c.append(cab);
  const ir = (txt, fn, id) => {
    const b = aeEl("button", "ae-cov-cel", "");
    b.type = "button";
    if (id) b.id = id;
    b.onclick = fn;
    return b;
  };
  m.lista.forEach((x, k) => {
    const li = aeEl("div", "ae-cov-linha");
    li.id = "aeCob_" + k;
    const nm = aeEl("span", "ae-cov-nome");
    nm.append(aeEl("b", "", x.nome), aeEl("span", "ae-cov-peso", t("ae_c_peso", { p: Math.round(x.pesoPct) })));
    li.append(nm);
    /* domínio */
    const cd = ir("", () => { if (typeof domAbrir === "function") domAbrir(m.edId, x.nome); }, "aeCobDom_" + k);
    const dom = x.dom || {};
    cd.append(aeDomBarra(dom), aeEl("span", "ae-cov-num", x.dom ? t("ae_c_dom_val", { p: Math.round((dom.verde || 0) + (dom.azul || 0)) }) : "—"));
    cd.title = t("ae_c_dom_aj", { d: x.nome });
    /* resumos */
    const cr = aeEl("span", "ae-cov-cel");
    cr.append(aeBarrinha(x.resumo ? x.resumo.pct : 0), aeEl("span", "ae-cov-num", x.resumo ? t("ae_c_res_val", { p: x.resumo.pct, l: x.resumo.lidoPct }) : "—"));
    cr.title = t("ae_c_res_aj", { n: x.resumo ? x.resumo.n : 0 });
    /* cartões */
    const cc = ir("", () => { if (typeof covAbrir === "function") covAbrir(m.edId, x.nome); }, "aeCobCart_" + k);
    cc.append(aeBarrinha(x.cartoes ? x.cartoes.pct : 0), aeEl("span", "ae-cov-num", x.cartoes ? t("ae_c_cart_val", { p: x.cartoes.pct, n: x.cartoes.n }) : "—"));
    cc.title = t("ae_c_cart_aj", { d: x.nome });
    /* leis */
    const cl = ir("", () => { if (typeof ledAbrir === "function") ledAbrir(m.edId, { disciplina: x.nome }); }, "aeCobLeis_" + k);
    cl.append(aeBarrinha(x.leis ? x.leis.pct : 0), aeEl("span", "ae-cov-num", x.leis ? t("ae_c_leis_val", { p: x.leis.pct, l: x.leis.lidos, t: x.leis.total }) : (m.ledPendente ? t("ae_c_lendo") : "—")));
    cl.title = x.leis ? t("ae_c_leis_aj", { d: x.nome }) : t("ae_c_leis_sem");
    const cq = aeEl("span", "ae-cov-q", String(x.questoes));
    cq.setAttribute("data-rot", t("ae_c_q") + ": ");
    li.append(cd, cr, cc, cl, cq);
    c.append(li);
  });
  const leg = aeEl("div", "ae-leg");
  AE_DOM_NIVEIS.forEach((n) => { const s = aeEl("span", "ae-leg-it"); s.append(aeEl("span", "ae-leg-q dom-" + n), document.createTextNode(t("ae_c_dom_" + n))); leg.append(s); });
  c.append(leg);
  c.append(aeEl("p", "nota ae-fonte", t("ae_c_nota")));
  box.append(c);
  return m;
}

/* =====================================================================
 * (19.154.0) PEDIR ANÁLISE À IA — o relatório da análise, por período e por seção
 *
 * "O objetivo é que o usuário consiga fazer análise centralizada de tudo e pedir opinião de uma IA ou analisar
 * gráficos e chegar a suas próprias conclusões."
 *
 * O "Copiar relatório" levava só a conta do plano. Agora a janela "🤖 Pedir análise à IA" monta o pedido com o que a
 * pessoa escolher — visão geral, orientações, tempo, desempenho, cobertura, discursiva e, se quiser, a conta do plano —
 * no período da análise, com uma pergunta própria opcional. Dá para COPIAR (para qualquer IA) ou, com a chave do Gemini
 * e a autorização desta tela ligada (⚙ Gemini, desligada por padrão), PERGUNTAR DIRETO: a resposta aparece na janela.
 *
 * O pedido diz à IA o que fazer com os dados e o que é estimativa; os números saem dos MESMOS modelos das abas.
 * ===================================================================== */
const AE_IA_SECOES = ["geral", "orient", "tempo", "desemp", "cob", "disc", "plano"];
const AE_IA_PADRAO = { geral: true, orient: true, tempo: true, desemp: true, cob: true, disc: true, plano: false };
const AE_IA_CH = "eac_ae_ia_secoes";
const AE_IA_DIRETA = "eac_ae_ia_direta";   /* "1": o Gemini direto pode ser usado aqui (opção da tela da chave) */
function aeIaLigada() { try { return localStorage.getItem(AE_IA_DIRETA) === "1"; } catch (e) { return false; } }
function aeIaLigar(sim) { try { if (sim) localStorage.setItem(AE_IA_DIRETA, "1"); else localStorage.removeItem(AE_IA_DIRETA); } catch (e) {} return aeIaLigada(); }
function aeIaPronta() { return aeIaLigada() && typeof jurIaPerguntar === "function" && typeof vzChaveApi === "function" && !!vzChaveApi(); }
function aeIaSecoesLer() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(AE_IA_CH) || "null"); } catch (e) { v = null; }
  const out = {};
  AE_IA_SECOES.forEach((k) => { out[k] = v && typeof v[k] === "boolean" ? v[k] : AE_IA_PADRAO[k]; });
  return out;
}
function aeIaSecoesGravar(s) { try { localStorage.setItem(AE_IA_CH, JSON.stringify(s)); } catch (e) {} }

/* O TEXTO. o: { d (plDados), periodo, secoes, pergunta, agora } */
function aeRelatorio(o) {
  const op = o || {};
  const d = op.d || null;
  const S = Object.assign({}, AE_IA_PADRAO, op.secoes || {});
  const periodo = AE_PERIODOS.indexOf(String(op.periodo)) >= 0 ? String(op.periodo) : aePeriodoLer();
  const base = { plano: d && d.plano, r: d && d.r, periodo, agora: op.agora };
  const L = [];
  const h = (min) => aeHorasTxt(min);
  const pct = (x) => (x == null ? "?" : x + "%");
  /* o pedido */
  L.push("PEDIDO: Voce e um orientador de estudos para concursos. Abaixo estao os dados do meu app de estudos (horas registradas, acerto em questoes, cartoes, cobertura do edital e o plano). Com eles:");
  L.push("1) diagnostique como estou estudando e se o tempo vai para o que mais vale na prova;");
  L.push("2) aponte problemas no PLANEJAMENTO (o que o plano pede) e na EXECUCAO (o que eu de fato fiz), separando os dois;");
  L.push("3) diga o que mudar nas proximas 2 semanas, de forma concreta (por disciplina, com horas), inclusive na discursiva;");
  L.push("4) diga quais dados estao faltando ou sao fracos (poucas questoes, estimativas) antes de tirar conclusoes.");
  L.push("Use os numeros daqui, sem inventar outros. Trate como SUPOSICAO o que estiver marcado como estimado. Responda em portugues, em topicos curtos.");
  const perg = String(op.pergunta || "").trim();
  if (perg) L.push("MINHA PERGUNTA: " + perg);
  L.push("");
  L.push("ANALISE DO ESTUDO — " + aeDiaDe(op.agora || aeRelogio()) + " | periodo: " + (periodo === "tudo" ? "tudo" : "ultimos " + periodo + " dias"));
  if (d && d.plano) L.push("edital em vista: " + (d.nome || "?") + " | prova: " + (d.plano.prazo || "?") + " | fase: " + (d.plano.fase ? d.plano.fase.n : 1)
    + " | fatia da prova: " + (d.plano.fatiaExata ? "exata (numeros do edital)" : "ESTIMADA (pesos 1-5)"));
  else L.push("edital em vista: nenhum");
  L.push("");

  let m = null;
  try { m = aeModelo(Object.assign({}, base)); } catch (e) { m = null; }
  if (S.geral && m) {
    L.push("== VISAO GERAL ==");
    L.push("horas estudadas: " + h(m.horas.min) + " (estudo " + h(m.horas.estudo) + ", revisao " + h(m.horas.revisao) + ")"
      + (m.horas.metaPeriodo ? " | previstas: " + h(m.horas.metaPeriodo) + " (" + (m.horas.fonteMeta === "meta" ? "meta propria" : "horas do plano") + ")" : " | sem meta")
      + (m.horas.minAnt != null ? " | periodo anterior: " + h(m.horas.minAnt) : ""));
    L.push("dias estudados: " + m.dias.estudados + " de " + m.dias.total + " | sequencia atual: " + m.dias.sequencia
      + (m.dias.semEstudar != null ? " | dias desde o ultimo registro: " + m.dias.semEstudar : ""));
    L.push("acerto em questoes: " + pct(m.acerto.pct) + " (" + m.acerto.certas + " de " + m.acerto.feitas + ")" + (m.acerto.pctAnt != null ? " | periodo anterior: " + pct(m.acerto.pctAnt) : ""));
    L.push("cartoes: " + m.cartoes.hoje + " a revisar hoje (" + m.cartoes.atrasados + " de dias anteriores) | " + m.cartoes.venceSemana + " nos proximos 7 dias | " + m.cartoes.revisao + " em revisao, " + m.cartoes.aprendendo + " aprendendo");
    L.push("horas por semana (13 semanas, estudo+revisao): " + m.semanas.map((s) => h(s.estudo + s.revisao)).join(", "));
    if (m.alertas.length) { L.push("alertas do app:"); m.alertas.forEach((a) => L.push("- " + a.txt)); }
    L.push("");
  }
  let T = null, D = null;
  try { T = aeTempoModelo(Object.assign({}, base)); } catch (e) { T = null; }
  try { D = aeDesempModelo(Object.assign({}, base)); } catch (e) { D = null; }
  if (S.orient && m) {
    let lista = [];
    try {
      const prazo = d && d.plano && d.plano.prazo;
      const diasProva = prazo && /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? aeDiasEntre(m.fim, prazo) : null;
      lista = aeOrientacoes({ m, T, D, diasProva });
    } catch (e) { lista = []; }
    if (lista.length) {
      L.push("== ORIENTACOES QUE O APP JA DEU (regras simples) ==");
      lista.forEach((x) => L.push("- " + x.tit + ": " + x.txt));
      L.push("");
    }
  }
  if (S.tempo && T) {
    L.push("== TEMPO REAL (diario) — disciplina | tempo | % do tempo | % da prova | desvio ==");
    T.discs.forEach((x) => L.push(x.nome + " | " + h(x.min) + " (estudo " + h(x.est) + ", revisao " + h(x.rev) + ") | " + pct(x.real) + " | " + pct(x.prova) + " | " + (x.desvio == null ? "-" : (x.desvio > 0 ? "+" : "") + x.desvio + "pp")));
    if (T.formas.length) L.push("formas de estudo: " + T.formas.map((f) => f.forma + " " + h(f.min) + (f.boa + f.media + f.ruim ? " (rendeu bem " + Math.round((f.boa / (f.boa + f.media + f.ruim)) * 100) + "%)" : "")).join("; "));
    L.push("media por dia da semana (seg..dom): " + T.diaSemana.map((x) => h(x.media)).join(", "));
    L.push("");
  }
  if (S.desemp && D) {
    L.push("== DESEMPENHO — disciplina | acerto no periodo | periodo anterior | questoes | acerto por semana (13 semanas, - = sem questao) ==");
    D.discs.forEach((x) => L.push(x.nome + " | " + pct(x.pct) + " | " + pct(x.pctAnt) + " | " + x.feitas + " | " + x.sem.map((s) => (s.pct == null ? "-" : s.pct)).join(",")));
    L.push("chute x certeza (banco): certeza " + pct(D.chute.sem.pct) + " em " + D.chute.sem.f + " | chute " + pct(D.chute.com.pct) + " em " + D.chute.com.f);
    const C = D.cartoes;
    if (C.total) {
      const prox7 = C.previsao.slice(0, 7).reduce((a, x) => a + x.n, 0), prox30 = C.previsao.reduce((a, x) => a + x.n, 0);
      L.push("cartoes: " + C.total + " na agenda | vencem hoje (com atrasados) " + C.previsao[0].n + ", em 7 dias " + prox7 + ", em 30 dias " + prox30
        + (C.respostas ? " | respostas: de novo " + Math.round((C.notas[0] / C.respostas) * 100) + "%, dificil " + Math.round((C.notas[1] / C.respostas) * 100) + "%, bom " + Math.round((C.notas[2] / C.respostas) * 100) + "%, facil " + Math.round((C.notas[3] / C.respostas) * 100) + "%" : "")
        + (C.dificeis ? " | esquecidos " + C.limiar + "+ vezes: " + C.dificeis : ""));
    }
    L.push("");
  }
  if (S.cob && d) {
    let cm = null;
    try {
      const e = typeof editais !== "undefined" ? editais.filter((x) => x.id === d.editalId)[0] : null;
      cm = e ? aeCoberturaModelo(e) : null;
    } catch (err) { cm = null; }
    if (cm) {
      L.push("== COBERTURA DO EDITAL — disciplina | % da prova | dominio verde/azul | com resumo (lido) | cartoes no alvo | leis lidas | questoes ==");
      cm.lista.forEach((x) => L.push(x.nome + " | " + Math.round(x.pesoPct) + "% | " + (x.dom ? Math.round((x.dom.verde || 0) + (x.dom.azul || 0)) + "%" : "-")
        + " | " + (x.resumo ? x.resumo.pct + "% (" + x.resumo.lidoPct + "%)" : "-") + " | " + (x.cartoes ? x.cartoes.pct + "%" : "-")
        + " | " + (x.leis ? x.leis.pct + "% (" + x.leis.lidos + "/" + x.leis.total + ")" : "-") + " | " + x.questoes));
      L.push("totais (pelo peso): dominio " + pct(cm.total.dominado) + " | com resumo " + pct(cm.total.resumo) + " | cartoes no alvo " + pct(cm.total.cartoes) + " | leis lidas " + pct(cm.total.leis));
      L.push("");
    }
  }
  if (S.disc) {
    let ds = [];
    try { ds = aeDiscursivasInfo(d && d.plano); } catch (e) { ds = [];
    }
    if (ds.length) {
      L.push("== DISCURSIVA (por edital) ==");
      ds.forEach((x) => {
        const res = x.res || {};
        L.push(x.nome + " | " + x.est.nome + (x.est.dias != null ? " | faltam " + x.est.dias + " dias" : "") + " | meta " + x.est.meta + " redacao(oes)/semana, feitas nesta semana " + x.feitas
          + " | redacoes registradas " + (res.n || 0) + (res.media5 != null ? ", media das ultimas " + res.media5 + "%" : "") + (res.minPct != null ? ", minimo " + res.minPct + "%" : "")
          + (x.tema && x.tema.tema ? " | proximo tema: " + x.tema.tema : ""));
      });
      L.push("");
    }
  }
  if (S.plano && d && d.plano) {
    try {
      const diario = (typeof edDiario !== "undefined" && edDiario) || [];
      const banco = (typeof qsBanco !== "undefined" && qsBanco) || [];
      const pr = plRelatorio(d.plano, d.r, diario, banco, d.cfg);
      /* sem o pedido do relatório do plano: o pedido é o de cima */
      const corpo = String(pr || "").split("\n");
      const ini = corpo.findIndex((l) => /^RAIO-X DA RECOMENDACAO/.test(l));
      L.push("== COMO O PLANO DECIDE (a conta da agenda) ==");
      (ini >= 0 ? corpo.slice(ini + 1) : corpo).forEach((l) => L.push(l));
      L.push("");
    } catch (e) {}
  }
  return L.join("\n");
}

/* ---------------- a janela ---------------- */
let aeIaResposta = "";
/* o relatório leva ~2 s para montar (o Domínio e a Cobertura são as contas pesadas): ele é montado UMA vez por escolha
 * de seções e período, e a pergunta só é encaixada — digitar não refaz a conta a cada letra */
let aeIaCache = { k: "", txt: "" };
function aeIaTexto() {
  const s = aeIaSecoesLer();
  const per = aePeriodoLer();
  const k = per + "|" + JSON.stringify(s);
  if (aeIaCache.k !== k) aeIaCache = { k, txt: aeRelatorio({ d: typeof plDados !== "undefined" ? plDados : null, periodo: per, secoes: s, pergunta: "" }) };
  const perg = String((($("aeIaPergunta") || {}).value) || "").trim();
  if (!perg) return aeIaCache.txt;
  const NL = String.fromCharCode(10);
  const i = aeIaCache.txt.indexOf(NL + NL);
  return i < 0 ? aeIaCache.txt + NL + "MINHA PERGUNTA: " + perg : aeIaCache.txt.slice(0, i) + NL + "MINHA PERGUNTA: " + perg + aeIaCache.txt.slice(i);
}
function aeIaPintar() {
  const box = $("aeIaSecoes");
  if (!box) return;
  const s = aeIaSecoesLer();
  box.innerHTML = "";
  AE_IA_SECOES.forEach((k) => {
    const lb = document.createElement("label");
    lb.className = "diag-op ae-ia-sec";
    const ck = document.createElement("input");
    ck.type = "checkbox"; ck.id = "chkAeIa_" + k; ck.checked = !!s[k];
    ck.onchange = () => { const v = aeIaSecoesLer(); v[k] = !!ck.checked; aeIaSecoesGravar(v); aeIaAtualizar(); };
    const sp = document.createElement("span");
    sp.textContent = t("ae_ia_s_" + k);
    lb.append(ck, sp);
    box.append(lb);
  });
  aeIaAtualizar();
}
function aeIaAtualizar() {
  const txt = aeIaTexto();
  if ($("aeIaPrevia")) $("aeIaPrevia").value = txt;
  const per = aePeriodoLer();
  if ($("aeIaInfo")) $("aeIaInfo").textContent = t("ae_ia_info", { p: t("ae_per_" + per), n: txt.length.toLocaleString() });
  const pronta = aeIaPronta();
  if ($("btnAeIaGemini")) $("btnAeIaGemini").hidden = !pronta;
  if ($("aeIaSemChave")) $("aeIaSemChave").hidden = pronta;
  return txt;
}
function aeIaAbrir() {
  if (!$("dlgAeIa")) return false;
  aeIaResposta = "";
  aeIaCache = { k: "", txt: "" };   /* os dados podem ter mudado desde a última abertura */
  if ($("aeIaResp")) { $("aeIaResp").value = ""; $("aeIaResp").hidden = true; }
  if ($("btnAeIaRespCopiar")) $("btnAeIaRespCopiar").hidden = true;
  if ($("aeIaMsg")) $("aeIaMsg").textContent = "";
  aeIaPintar();
  if (typeof abrirModal === "function") abrirModal("dlgAeIa");
  try { reg("ANALISE", "pedir análise à IA: janela aberta", "período " + aePeriodoLer()); } catch (e) {}
  return true;
}
function aeCopiarTexto(txt, aviso) {
  let ok = false;
  try { const p = navigator.clipboard && navigator.clipboard.writeText(String(txt)); ok = !!p; if (p && p.catch) p.catch(() => {}); } catch (e) { ok = false; }
  if (!ok) { try { const ta = $("aeIaPrevia"); if (ta) { ta.closest && ta.closest("details") && (ta.closest("details").open = true); ta.focus(); ta.select(); } } catch (e) {} }
  if ($("aeIaMsg")) $("aeIaMsg").textContent = ok ? t(aviso || "ae_ia_copiado") : t("ae_ia_copie_mao");
  return ok;
}
function aeIaCopiar() {
  const txt = aeIaAtualizar();
  try { reg("ANALISE", "pedir análise à IA: pedido copiado", txt.length + " caracteres"); } catch (e) {}
  return aeCopiarTexto(txt, "ae_ia_copiado");
}
async function aeIaGemini() {
  if (!aeIaPronta()) return null;
  const pedido = aeIaAtualizar();
  if ($("btnAeIaGemini")) $("btnAeIaGemini").disabled = true;
  if ($("aeIaMsg")) $("aeIaMsg").textContent = t("ae_ia_esperando");
  try { reg("ANALISE", "pedir análise à IA: Gemini direto", pedido.length + " caracteres"); } catch (e) {}
  try {
    const r = await jurIaPerguntar(pedido, { modulo: "ANALISE", tempo: 180000 });
    aeIaResposta = String(r.texto || "");
    if ($("aeIaResp")) { $("aeIaResp").value = aeIaResposta; $("aeIaResp").hidden = false; }
    if ($("btnAeIaRespCopiar")) $("btnAeIaRespCopiar").hidden = false;
    if ($("aeIaMsg")) $("aeIaMsg").textContent = t("ae_ia_respondeu", { m: r.modelo || "Gemini" });
    return r;
  } catch (e) {
    const cod = (e && e.codigo) || "rede";
    if ($("aeIaMsg")) $("aeIaMsg").textContent = t("jur_ia_erro_" + cod) + (e && e.detalhe && cod !== "cancelado" ? " (" + e.detalhe + ")" : "") + " " + t("ae_ia_copiar_ainda");
    try { reg("ANALISE", "pedir análise à IA: Gemini falhou", cod); } catch (x) {}
    return null;
  } finally {
    if ($("btnAeIaGemini")) $("btnAeIaGemini").disabled = false;
  }
}
function aeIaIniciar() {
  if (typeof document === "undefined" || !$("dlgAeIa")) return;
  const liga = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  liga("btnAeIaCopiar", aeIaCopiar);
  liga("btnAeIaGemini", aeIaGemini);
  liga("btnAeIaFechar", () => $("dlgAeIa").close());
  liga("btnAeIaRespCopiar", () => aeCopiarTexto(aeIaResposta, "ae_ia_resp_copiada"));
  liga("btnAeIaChave", () => { if (typeof vzAbrirChave === "function") vzAbrirChave(); });
  let tm = null;
  if ($("aeIaPergunta")) $("aeIaPergunta").oninput = () => { clearTimeout(tm); tm = setTimeout(aeIaAtualizar, 300); };
}

if (typeof document !== "undefined") { try { aeIaIniciar(); } catch (e) {} }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { aeRelatorio, aeIaAbrir, aeIaCopiar, aeIaGemini, aeIaLigar, aeIaLigada, aeIaPronta, aeIaSecoesLer, aeCoberturaModelo, aePintarCobertura, aeOrientacoes, aeDiscursivasInfo, aeOrientDiscursiva, aeModelo, aeAlertas, aePintar, aePeriodoLer, aePeriodoDefinir, aeDiaDe, aeSegunda, aeHorasTxt,
    aeTempoModelo, aeDesempModelo, aePintarTempo, aePintarDesemp, aeChaveDisc };
}
