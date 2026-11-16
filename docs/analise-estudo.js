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
  /* o período */
  const per = aeEl("div", "ae-periodo");
  per.append(aeEl("span", "ae-periodo-rot", t("ae_periodo")));
  AE_PERIODOS.forEach((p) => {
    const b = aeEl("button", "ae-chip" + (p === m.periodo ? " ativo" : ""), t("ae_per_" + p));
    b.type = "button";
    b.id = "btnAePer_" + p;
    b.setAttribute("aria-pressed", p === m.periodo ? "true" : "false");
    b.onclick = () => aePeriodoDefinir(p);
    per.append(b);
  });
  box.append(per);

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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { aeModelo, aeAlertas, aePintar, aePeriodoLer, aePeriodoDefinir, aeDiaDe, aeSegunda, aeHorasTxt };
}
