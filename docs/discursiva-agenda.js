/* =====================================================================
 * (19.152.0) A DISCURSIVA NA AGENDA DA SEMANA — calendário próprio
 *
 * "Avalie como as etapas de estudar as discursivas podem ser incluídas na agenda da semana… devem seguir calendário
 * próprio, não ligado aos pesos, mas aparecer lá para facilitar a interpretação do caminho a seguir."
 *
 * Antes, a discursiva era um aviso recolhido na faixa de avisos ("✍ Discursivas: 0 de 1 tema(s)"), ao lado do ritmo e
 * dos vínculos — e contava TEMAS, enquanto a estratégia da tela das Discursivas conta REDAÇÕES. Quem olhava a agenda
 * não via o caminho.
 *
 * AGORA, uma FAIXA por edital com discursiva, dentro da semana, fora da lista por peso:
 *  · o CALENDÁRIO é o da estratégia (dsEstrategia): a fase pela distância da prova escrita (ou da fase 2, em data
 *    própria), a meta de redações por semana, ajustada pelas notas — nada do rodízio nem do peso das disciplinas;
 *  · as ETAPAS da semana: ① preparar os temas (a cobertura das disciplinas, do Painel das Discursivas), ② escrever cada
 *    redação no tamanho da prova, ③ corrigir pelo espelho, ④ reescrever a pior (com duas ou mais na semana). O que já
 *    é registrado nas Discursivas marca sozinho; o resto se marca tocando;
 *  · o TEMPO: cada etapa tem duração (a escrita pelo número de linhas da prova: ~2 min por linha, de 30 a 90 min) e a
 *    soma é RESERVADA — sai das horas da semana do plano das objetivas, às claras ("reserva 3h40, já descontada").
 *    Sem isso a agenda prometeria horas que não existem.
 * ===================================================================== */
const DAG_CH = "eac_ds_etapas";            /* {edital: {segunda ISO: {esc_1: true, cor_1: true, reesc: true}}} */
const DAG_MIN = { prep: 15, cor: 20, reesc: 30 };

function dagSemanaIni() { return typeof dsSemanaIni === "function" ? dsSemanaIni(dsHoje()) : ""; }
/* a escrita no tamanho da prova: ~2 minutos por linha, entre 30 e 90 minutos (60 sem o número de linhas) */
function dagMinEscrita(dc) {
  const l = dc && dc.linhas && dc.linhas.max;
  return l ? Math.max(30, Math.min(90, Math.round(l * 2 / 5) * 5)) : 60;
}
/* a estratégia da semana de um edital (sem precisar do plano): null sem discursiva ou com a prova escrita já passada */
function dagEstrategia(e) {
  try {
    if (typeof dsDiscursivaDe !== "function") return null;
    const { dc } = dsDiscursivaDe(e);
    if (!dc) return null;
    const sit = dsDiasProva(e);
    if (sit.dias != null && sit.dias < 0) return null;
    const res = dsRedacoesResumo(e.id, dc);
    const est = dsEstrategia(sit.dias, res, dc, sit);
    if (!est.meta) return null;
    return { dc, sit, res, est };
  } catch (err) { return null; }
}
/* quanto a semana da discursiva reserva, em minutos: (preparar + escrever + corrigir) × meta + reescrever (meta ≥ 2) */
function dagReservaMin(e) {
  const x = dagEstrategia(e);
  if (!x) return 0;
  const m = x.est.meta;
  return m * (DAG_MIN.prep + dagMinEscrita(x.dc) + DAG_MIN.cor) + (m >= 2 ? DAG_MIN.reesc : 0);
}

function dagMarcasTodas() { try { return JSON.parse(localStorage.getItem(DAG_CH) || "{}") || {}; } catch (e) { return {}; } }
function dagMarcas(id) { const v = dagMarcasTodas()[id] || {}; return Object.assign({}, v[dagSemanaIni()] || {}); }
function dagMarcar(id, k, sim) {
  const v = dagMarcasTodas();
  const sem = dagSemanaIni();
  v[id] = Object.assign({}, v[id] || {});
  const s = Object.assign({}, v[id][sem] || {});
  if (sim) s[k] = true; else delete s[k];
  v[id][sem] = s;
  /* só as últimas 26 semanas de cada edital */
  const ks = Object.keys(v[id]).sort();
  while (ks.length > 26) delete v[id][ks.shift()];
  try { localStorage.setItem(DAG_CH, JSON.stringify(v)); } catch (e) {}
  try { reg("EDITAL", "discursiva: etapa " + (sim ? "feita" : "desmarcada"), id + " · " + k + " · " + sem); } catch (e) {}
  return s;
}
/* quantas redações a semana tem: as registradas nas Discursivas ou as marcadas aqui (o maior dos dois) */
function dagEscritasSemana(id) {
  const reg0 = typeof dsRedacoesNaSemana === "function" ? dsRedacoesNaSemana(id) : 0;
  const m = dagMarcas(id);
  const marcadas = Object.keys(m).filter((k) => /^esc_\d+$/.test(k) && m[k]).length;
  return Math.max(reg0, marcadas);
}

/* O MODELO DA SEMANA de um edital: as etapas, o que já foi feito (sozinho ou marcado) e o tempo */
function dagSemana(e, plano) {
  const x = dagEstrategia(e);
  if (!x) return null;
  const id = e.id, meta = x.est.meta, minEsc = dagMinEscrita(x.dc);
  const marcas = dagMarcas(id);
  const ini = dagSemanaIni();
  const daSemana = (typeof dsRedacoes === "function" ? dsRedacoes(id) : []).filter((r) => dsSemanaIni(r.d) === ini)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  let P = null, passo = null;
  try { if (typeof dsPainel === "function") { P = dsPainel(e, plano, x.dc, x.sit); passo = dsProximoPasso(e, plano, x.dc, x.sit, P); } } catch (err) { P = null; }
  const etapas = [];
  /* ① preparar os temas: a meta do Painel (cobre as disciplinas até a prova), ou um tema por redação */
  const temasMeta = P ? Math.max(1, P.meta) : meta;
  const temasFeitos = P ? Math.min(P.feitas, temasMeta) : (marcas.prep ? temasMeta : 0);
  etapas.push({ k: "prep", tipo: "prep", n: temasMeta, feitos: temasFeitos, feito: temasFeitos >= temasMeta || !!marcas.prep,
    /* o tempo da preparação acompanha as REDAÇÕES da semana (um tema por redação), o mesmo que a agenda desconta antes de
     * montar o plano (dagReservaMin) — a contagem de temas do Painel diz o que preparar, não quanto tempo reservar */
    auto: !!(P && P.feitas >= temasMeta), min: DAG_MIN.prep * meta });
  /* ② escrever e ③ corrigir, por redação */
  for (let k = 1; k <= meta; k++) {
    const r = daSemana[k - 1] || null;
    const autoE = !!r, autoC = !!(r && r.max > 0 && r.nota >= 0);
    etapas.push({ k: "esc_" + k, tipo: "esc", i: k, feito: autoE || !!marcas["esc_" + k], auto: autoE, min: minEsc });
    etapas.push({ k: "cor_" + k, tipo: "cor", i: k, feito: autoC || !!marcas["cor_" + k], auto: autoC, min: DAG_MIN.cor });
  }
  /* ④ reescrever a pior, com duas ou mais na semana */
  if (meta >= 2) etapas.push({ k: "reesc", tipo: "reesc", feito: !!marcas.reesc, auto: false, min: DAG_MIN.reesc });
  const reservaMin = etapas.reduce((a, s) => a + s.min, 0);
  const feitoMin = etapas.reduce((a, s) => a + (s.feito ? s.min : 0), 0);
  const escritas = etapas.filter((s) => s.tipo === "esc" && s.feito).length;
  return { id, nome: e.nome || "", e, est: x.est, sit: x.sit, dc: x.dc, meta, minEsc, etapas, reservaMin, feitoMin, escritas,
    P, passo, pend: P ? P.cont.vermelho + P.cont.amarelo : 0, urgente: !!(P && P.cont.vermelho && x.sit.dias != null && x.sit.dias <= 30) };
}

function dagRotulo(s) {
  if (s.tipo === "prep") return t("dag_prep", { f: s.feitos, n: s.n });
  if (s.tipo === "esc") return t("dag_esc", { i: s.i });
  if (s.tipo === "cor") return t("dag_cor", { i: s.i });
  return t("dag_reesc");
}

/* A FAIXA, dentro da semana da agenda. aoMudar: repinta a agenda */
function dagPintar(S, aoMudar, aberta) {
  const det = document.createElement("details");
  det.className = "dag" + (S.urgente ? " alerta" : "") + (S.escritas >= S.meta ? " ok" : "");
  det.id = "hubDiscTreino_" + S.id;
  if (aberta) det.open = true;
  const sm = document.createElement("summary");
  sm.className = "dag-cab";
  const tit = document.createElement("b");
  tit.textContent = t("dag_tit", { e: S.nome });
  const res = document.createElement("span");
  res.className = "dag-res";
  res.textContent = t("dag_res", { f: S.est.nome, n: S.escritas, m: S.meta, h: horasTexto(S.reservaMin) })
    + (S.sit && S.sit.separada && S.sit.prova ? " · " + t("hub_disc_data_f2", { d: S.sit.prova.split("-").reverse().join("/"), n: S.sit.dias }) : "");
  sm.append(tit, res);
  det.append(sm);

  /* as bolinhas das disciplinas (temas preparados × alvo) e o passo de agora, como no Painel das Discursivas */
  const top = document.createElement("div");
  top.className = "dag-top";
  if (S.P && S.P.discs.length) {
    const pt = document.createElement("span");
    pt.className = "hub-disc-pontos";
    S.P.discs.forEach((d) => {
      const b0 = document.createElement("span");
      b0.className = "ds-pn-dot ds-pn-" + d.nivel;
      b0.title = t("hub_disc_dot_tip", { d: d.nome, n: d.temas, a: d.alvo });
      pt.append(b0);
    });
    top.append(pt);
  }
  const agir = !!(S.passo && S.passo.cod !== "em_dia");
  if (agir) { const ps = document.createElement("span"); ps.className = "dag-passo"; ps.textContent = t("hub_disc_passo", { p: dsPassoTexto(S.passo) }); top.append(ps); }
  const ir = document.createElement("button");
  ir.type = "button"; ir.className = "btn-min" + (agir ? " btn-min-ok" : "");
  ir.id = "btnHubDisc_" + S.id;
  ir.textContent = t(agir ? "hub_disc_fazer" : "hub_disc_ir");
  ir.onclick = () => { if (typeof dsIrPara === "function") dsIrPara(S.id); };
  top.append(ir);
  if (S.pend) {
    const vp = document.createElement("button");
    vp.type = "button"; vp.className = "btn-min hub-disc-falta";
    vp.id = "btnHubDiscFalta_" + S.id;
    vp.textContent = t("hub_disc_ver_falta", { n: S.pend });
    vp.onclick = () => { if (typeof dsIrPara === "function") dsIrPara(S.id, { pend: true }); };
    top.append(vp);
  }
  det.append(top);

  /* as etapas da semana, em ordem: tocar marca/desmarca; o que veio das Discursivas fica marcado sozinho */
  const lista = document.createElement("div");
  lista.className = "dag-etapas";
  S.etapas.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dag-etapa " + s.tipo + (s.feito ? " feita" : "") + (s.auto ? " auto" : "");
    b.id = "dagEt_" + S.id + "_" + s.k;
    b.setAttribute("aria-pressed", s.feito ? "true" : "false");
    b.textContent = (s.feito ? "✓ " : "○ ") + dagRotulo(s) + " · " + horasTexto(s.min);
    b.title = s.auto ? t("dag_auto_aj") : t(s.feito ? "dag_desmarcar_aj" : "dag_marcar_aj");
    b.onclick = () => {
      if (s.auto) { if (typeof dsIrPara === "function") dsIrPara(S.id); return; }
      if (s.tipo === "prep" && S.P) { if (typeof dsIrPara === "function") dsIrPara(S.id); return; }
      dagMarcar(S.id, s.k, !s.feito);
      if (typeof aoMudar === "function") aoMudar();
    };
    lista.append(b);
  });
  det.append(lista);
  const nota = document.createElement("p");
  nota.className = "nota dag-nota";
  nota.textContent = t(S.feitoMin ? "dag_nota" : "dag_nota0", { h: horasTexto(S.reservaMin), f: horasTexto(S.feitoMin), e: horasTexto(S.minEsc) });
  det.append(nota);
  det.addEventListener && det.addEventListener("toggle", () => { try { localStorage.setItem("eac_dag_aberta_" + S.id, det.open ? "1" : "0"); } catch (e) {} });
  return det;
}
/* aberta: o que a pessoa deixou da última vez; sem escolha, abre a da prova escrita mais próxima */
function dagAberta(id, primeira) {
  try { const v = localStorage.getItem("eac_dag_aberta_" + id); if (v === "1") return true; if (v === "0") return false; } catch (e) {}
  return !!primeira;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { dagMinEscrita, dagEstrategia, dagReservaMin, dagSemana, dagMarcar, dagMarcas, dagEscritasSemana, dagPintar };
}
