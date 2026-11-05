/* =====================================================================
 * DISCURSIVAS (19.73.0) — o lugar da prova escrita
 *
 * Até aqui a discursiva vivia espalhada: a linha "# discursiva" no edital, a pergunta 3 de "⚖ Pontuação e cortes", o
 * treino semanal na agenda, a linha no painel de riscos. Esta tela junta tudo, por edital:
 *  · como ela pontua (pontos, % da nota final, mínimo, linhas, "só os N primeiros", disciplinas em que cai);
 *  · o risco de corte (a cobertura das disciplinas dela × o mínimo — edRiscoDiscursiva);
 *  · o treino de escrita: marcar a semana e ver as últimas 8;
 *  · pedir à IA temas prováveis com o espelho de correção, no formato desta prova;
 *  · e, para o edital que ainda não a cadastrou, o atalho para cadastrar.
 * ===================================================================== */

function dsDiscursivaDe(e) {
  try { const r = lerEdital(e.texto || ""); return { r, dc: r.cfg && r.cfg.discursiva && r.cfg.discursiva.pontos > 0 ? r.cfg.discursiva : null }; }
  catch (err) { return { r: null, dc: null }; }
}

/* as segundas-feiras (ISO) das últimas n semanas, da mais antiga à atual */
function dsUltimasSemanas(n) {
  const out = [];
  const hoje = new Date();
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 7 * k);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    out.push(typeof edSemanaCalendario === "function" ? edSemanaCalendario(iso).ini : iso);
  }
  return out;
}
function dsTreinos(id) {
  try { const v = JSON.parse(localStorage.getItem("eac_disc_treino") || "{}") || {}; return v[id] || {}; } catch (e) { return {}; }
}

/* o pedido à IA: temas prováveis no formato desta discursiva, com o espelho de correção */
function dsPromptTemas(e, dc) {
  const linhas = dc.linhas && dc.linhas.min ? dc.linhas.min + " a " + dc.linhas.max + " linhas" : t("ds_p_linhas_livre");
  return t("ds_prompt", { c: e.nome || "", d: (dc.disciplinas || []).join("; ") || "-", l: linhas, p: dc.pontos,
    m: dc.minimo ? (dc.minimo.tipo === "pct" ? dc.minimo.valor + "%" : dc.minimo.valor) : "-" });
}

/* =====================================================================
 * (19.74.0) O REGISTRO DAS REDAÇÕES
 * Cada redação escrita: data, tema, disciplina, linhas e a nota pelo espelho (nota e nota máxima). Por edital, em
 * "eac_disc_redacoes" = { editalId: [ {id, d, tema, disc, linhas, nota, max, obs} ] }. Registrar uma redação marca a
 * semana dela como treinada. O resumo diz a média das últimas 5, a tendência, quantas ficaram abaixo do mínimo e
 * quantas fora do tamanho — o que o Raio-X também leva para a IA.
 * ===================================================================== */
const DS_RED_CHAVE = "eac_disc_redacoes";
function dsRedacoesTodas() {
  try { const v = JSON.parse(localStorage.getItem(DS_RED_CHAVE) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
function dsRedacoes(id) { return (dsRedacoesTodas()[id] || []).slice().sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)); }
function dsRedacoesGravar(id, lista) {
  const v = dsRedacoesTodas();
  v[id] = lista;
  try { localStorage.setItem(DS_RED_CHAVE, JSON.stringify(v)); return true; } catch (e) { try { uiAlert(t("ds_red_sem_espaco")); } catch (e2) {} return false; }
}
function dsRedacaoPct(x) { return x && x.max > 0 && x.nota >= 0 ? Math.round((x.nota / x.max) * 100) : null; }
/* a redação nova: valida e grava; devolve o registro ou { erro } */
function dsRedacaoAdicionar(id, x) {
  const tema = String((x && x.tema) || "").trim();
  const nota = Number(x && x.nota), max = Number(x && x.max);
  if (!tema) return { erro: t("ds_red_falta_tema") };
  if (!(max > 0) || !(nota >= 0) || nota > max) return { erro: t("ds_red_falta_nota") };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(x.d || "")) ? x.d : (typeof hubHoje === "function" ? hubHoje() : new Date().toISOString().slice(0, 10));
  const r = { id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), d, tema: tema.slice(0, 200),
    disc: String(x.disc || "").slice(0, 120), linhas: Number(x.linhas) > 0 ? Math.round(Number(x.linhas)) : null, nota, max, obs: String(x.obs || "").slice(0, 500) };
  const lista = (dsRedacoesTodas()[id] || []).concat([r]);
  if (!dsRedacoesGravar(id, lista)) return { erro: t("ds_red_sem_espaco") };
  /* escrever uma redação É treinar: a semana dela fica marcada */
  try {
    const v = JSON.parse(localStorage.getItem("eac_disc_treino") || "{}") || {};
    const sem = typeof edSemanaCalendario === "function" ? edSemanaCalendario(d).ini : d;
    v[id] = Object.assign({}, v[id] || {}, { [sem]: true });
    localStorage.setItem("eac_disc_treino", JSON.stringify(v));
  } catch (e) {}
  try { reg("DISCURSIVAS", "redação registrada", tema.slice(0, 60) + " · " + nota + "/" + max); } catch (e) {}
  return r;
}
function dsRedacaoApagar(id, rid) {
  const lista = (dsRedacoesTodas()[id] || []).filter((x) => x.id !== rid);
  return dsRedacoesGravar(id, lista);
}
/* o resumo do histórico: n, média das últimas 5, tendência, abaixo do mínimo, fora do tamanho */
function dsRedacoesResumo(id, dc) {
  const l = dsRedacoes(id);
  const pcts = l.map(dsRedacaoPct).filter((x) => x != null);
  const media = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const ult5 = media(pcts.slice(0, 5));
  const ult3 = media(pcts.slice(0, 3)), ant3 = media(pcts.slice(3, 6));
  const tendencia = ult3 != null && ant3 != null ? (ult3 > ant3 + 5 ? "subindo" : ult3 < ant3 - 5 ? "caindo" : "estavel") : null;
  const minPct = dc && dc.minimo && dc.minimo.tipo === "pct" ? dc.minimo.valor : null;
  const abaixo = minPct == null ? 0 : pcts.filter((p) => p < minPct).length;
  const fora = dc && dc.linhas && dc.linhas.min ? l.filter((x) => x.linhas && (x.linhas < dc.linhas.min || x.linhas > dc.linhas.max)).length : 0;
  return { n: l.length, media5: ult5, tendencia, abaixo, fora, minPct, ultima: l[0] || null };
}

function dsPintarRedacoes(card, e, dc) {
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const box = el("details", "ds-red");
  box.id = "dsRed_" + e.id;
  const res = dsRedacoesResumo(e.id, dc);
  const sum = el("summary", "", t("ds_red_tit", { n: res.n }));
  if (res.n) sum.append(el("span", "dsc-mat-cont", t("ds_red_cont", { m: res.media5 == null ? "—" : res.media5 + "%", t: t("ds_tend_" + (res.tendencia || "nd")) })));
  box.append(sum);
  if (res.n) {
    const al = [];
    if (res.abaixo) al.push(t("ds_red_abaixo", { n: res.abaixo, m: res.minPct }));
    if (res.fora) al.push(t("ds_red_fora", { n: res.fora, a: dc.linhas.min, b: dc.linhas.max }));
    if (al.length) box.append(el("p", "ds-red-alerta", al.join(" ")));
  }
  /* o formulário */
  const f = el("div", "ds-red-form");
  const campo = (rot, inp) => { const l = el("label", "ds-red-campo"); l.append(el("span", "", rot), inp); f.append(l); return inp; };
  const mk = (type, id, ph) => { const x = document.createElement("input"); x.type = type; x.id = id; if (ph) x.placeholder = ph; return x; };
  const iData = campo(t("ds_red_data"), mk("date", "dsRedData_" + e.id));
  iData.value = typeof hubHoje === "function" ? hubHoje() : new Date().toISOString().slice(0, 10);
  const iTema = campo(t("ds_red_tema"), mk("text", "dsRedTema_" + e.id, t("ds_red_tema_ph")));
  iTema.className = "ds-red-tema";
  const sel = document.createElement("select");
  sel.id = "dsRedDisc_" + e.id;
  [""].concat(dc.disciplinas || []).forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = n || t("ds_red_disc_qualquer"); sel.append(o); });
  campo(t("ds_red_disc"), sel);
  const iLin = campo(t("ds_red_linhas"), mk("number", "dsRedLinhas_" + e.id, dc.linhas && dc.linhas.min ? dc.linhas.min + "–" + dc.linhas.max : ""));
  const iNota = campo(t("ds_red_nota"), mk("number", "dsRedNota_" + e.id, "ex.: 32"));
  const iMax = campo(t("ds_red_max"), mk("number", "dsRedMax_" + e.id));
  iMax.value = dc.pontos || 100;
  [iLin, iNota, iMax].forEach((x) => { x.min = "0"; x.step = "any"; x.className = "ep-num"; });
  const msg = el("p", "nota ds-red-msg");
  const bt = el("button", "btn-min btn-min-ok", t("ds_red_add"));
  bt.type = "button"; bt.id = "btnDsRedAdd_" + e.id;
  bt.onclick = () => {
    const r = dsRedacaoAdicionar(e.id, { d: iData.value, tema: iTema.value, disc: sel.value, linhas: iLin.value, nota: iNota.value === "" ? NaN : iNota.value, max: iMax.value });
    if (r.erro) { msg.textContent = r.erro; return; }
    try { toastMsg(t("ds_red_ok", { p: dsRedacaoPct(r) }), 4000); } catch (err) {}
    dsRender();
    const novo = document.getElementById("dsRed_" + e.id); if (novo) novo.open = true;
  };
  f.append(bt);
  box.append(f, msg);
  /* a lista, a mais recente primeiro */
  const lista = dsRedacoes(e.id);
  if (lista.length) {
    const ul = el("div", "ds-red-lista");
    lista.slice(0, 30).forEach((x) => {
      const p = dsRedacaoPct(x);
      const ln = el("div", "ds-red-lin" + (res.minPct != null && p != null && p < res.minPct ? " ds-red-ruim" : ""));
      ln.append(el("span", "ds-red-d", x.d.split("-").reverse().join("/")), el("span", "ds-red-t", x.tema + (x.disc ? " · " + x.disc : "")));
      const foraTam = dc.linhas && dc.linhas.min && x.linhas && (x.linhas < dc.linhas.min || x.linhas > dc.linhas.max);
      ln.append(el("span", "ds-red-l" + (foraTam ? " ds-red-ruim-t" : ""), x.linhas ? t("ds_red_l", { n: x.linhas }) : ""));
      ln.append(el("strong", "ds-red-n", (x.nota + "/" + x.max) + (p != null ? " · " + p + "%" : "")));
      const del = el("button", "btn-min ds-red-del", "✕");
      del.type = "button"; del.title = t("ds_red_apagar_tip");
      del.onclick = async () => {
        if (!(await uiConfirm(t("ds_red_apagar_conf", { t: x.tema }), { ok: t("ds_red_apagar_ok"), perigo: true }))) return;
        dsRedacaoApagar(e.id, x.id);
        dsRender();
        const novo = document.getElementById("dsRed_" + e.id); if (novo) novo.open = true;
      };
      ln.append(del);
      ul.append(ln);
    });
    box.append(ul);
  }
  card.append(box);
}

function dsAbrirEdital(id, depois) {
  if (typeof hubAbrirEdital === "function") hubAbrirEdital(id);
  if (typeof trocarModo === "function") trocarModo("edital");
  if (depois) setTimeout(depois, 0);
}

function dsRender() {
  const cx = document.getElementById("dsLista");
  if (!cx) return;
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  cx.innerHTML = "";
  const lista = (typeof editais !== "undefined" ? editais : []) || [];
  const com = [], sem = [];
  lista.forEach((e) => { const x = dsDiscursivaDe(e); (x.dc ? com : sem).push(Object.assign({ e }, x)); });
  if (!lista.length) { cx.append(el("p", "nota", t("ds_sem_editais"))); return; }

  com.forEach(({ e, r, dc }) => {
    const card = el("div", "ed-caixa ds-card");
    card.id = "dsCard_" + e.id;
    const topo = el("div", "ds-topo");
    topo.append(el("div", "ed-caixa-tit", e.nome || "?"));
    const abrir = el("button", "btn-min", t("ds_abrir_edital"));
    abrir.type = "button";
    abrir.onclick = () => dsAbrirEdital(e.id);
    topo.append(abrir);
    card.append(topo);

    /* como pontua */
    let plano = null, rd = null;
    try {
      plano = montarPlano(r, { horas: r.cfg.horas, prova: r.cfg.prova, feitos: e.progresso || {} });
      rd = typeof edRiscoDiscursiva === "function" ? edRiscoDiscursiva(plano, e.id) : null;
    } catch (err) { plano = null; rd = null; }
    const share = rd ? rd.share : (dc.objetiva ? Math.round(dc.pontos / (dc.objetiva + dc.pontos) * 100) : null);
    const chips = el("div", "dsc-chips");
    const chip = (tx, cls) => chips.append(el("span", "dsc-chip" + (cls ? " " + cls : ""), tx));
    chip(t("ds_chip_pontos", { p: dc.pontos }));
    if (share != null) chip(t("ds_chip_share", { s: share }));
    if (dc.minimo) chip(t("ds_chip_min", { m: dc.minimo.tipo === "pct" ? dc.minimo.valor + "%" : dc.minimo.valor }));
    if (dc.linhas && dc.linhas.min) chip(t("ds_chip_linhas", { a: dc.linhas.min, b: dc.linhas.max }));
    if (dc.corrigida) chip(t("ds_chip_corrigida", { n: dc.corrigida }), "dsc-chip-fora");
    card.append(chips);
    card.append(el("p", "nota", t("ds_cai_em", { d: (dc.disciplinas || []).join(", ") || "—" })));

    /* o risco de corte, com a barra e a linha do corte (a mesma do painel de riscos) */
    if (rd && rd.minPct !== null) {
      const rs = el("div", "ds-risco" + (rd.abaixo ? " ed-min-abaixo" : rd.apertado ? " ed-min-apertado" : ""));
      rs.append(el("div", "ds-risco-tit", rd.abaixo ? t("ds_risco_abaixo") : rd.apertado ? t("ds_risco_apertado") : t("ds_risco_ok")));
      const barra = el("div", "ed-min-barra");
      const fill = el("div", "ed-min-fill"); fill.style.width = Math.min(100, rd.cobertura) + "%";
      const corte = el("div", "ed-min-corte"); corte.style.left = Math.min(100, rd.minPct) + "%";
      barra.append(fill, corte);
      rs.append(barra, el("div", "ed-min-num", t("ds_risco_num", { c: rd.cobertura, m: rd.minPct })));
      card.append(rs);
    }
    if (dc.corrigida) card.append(el("p", "nota ed-min-disc-corr", t("ed_min_disc_corrigida", { n: dc.corrigida })));

    /* o treino de escrita: esta semana + as últimas 8 */
    const tr = el("div", "ds-treino");
    tr.append(el("div", "ds-sub-tit", t("ds_treino_tit")));
    const sem8 = dsUltimasSemanas(8);
    const feitos = dsTreinos(e.id);
    const tira = el("div", "ds-semanas");
    sem8.forEach((s, k) => {
      const b = el("span", "ds-semana" + (feitos[s] ? " ds-feita" : "") + (k === sem8.length - 1 ? " ds-atual" : ""), feitos[s] ? "✓" : "·");
      b.title = t(feitos[s] ? "ds_semana_feita" : "ds_semana_vazia", { s });
      tira.append(b);
    });
    tr.append(tira);
    const n4 = sem8.slice(-4).filter((s) => feitos[s]).length;
    tr.append(el("p", "nota", t(n4 ? "ds_treino_n" : "ds_treino_zero", { n: n4 })));
    const lab = el("label", "ds-marcar");
    const ck = document.createElement("input");
    ck.type = "checkbox"; ck.id = "dsTreino_" + e.id;
    ck.checked = !!feitos[sem8[sem8.length - 1]];
    ck.onchange = () => {
      if (typeof hubDiscTreinoMarcar === "function") hubDiscTreinoMarcar(e.id, ck.checked);
      dsRender();
      if (typeof hubPintarAgenda === "function") { try { hubPintarAgenda(); } catch (err) {} }
    };
    lab.append(ck, el("span", "", t("ds_marcar")));
    tr.append(lab);
    card.append(tr);

    /* (19.74.0) as redações escritas */
    dsPintarRedacoes(card, e, dc);

    /* temas prováveis com a IA */
    const ia = el("div", "ds-ia");
    const bt = el("button", "btn-min btn-min-ok", t("ds_ia_btn"));
    bt.type = "button"; bt.id = "btnDsIa_" + e.id;
    bt.title = t("ds_ia_tip");
    bt.onclick = () => {
      const p = dsPromptTemas(e, dc);
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p).catch(() => {}); } catch (err) {}
      try { toastMsg(t("ds_ia_copiado"), 5000); } catch (err) {}
      try { reg("DISCURSIVAS", "pedido de temas copiado", e.nome || e.id); } catch (err) {}
    };
    const aj = el("button", "btn-min", t("ds_ajustar"));
    aj.type = "button";
    aj.onclick = () => dsAbrirEdital(e.id, () => { if (typeof epAbrir === "function") epAbrir(); });
    ia.append(bt, aj);
    card.append(ia);
    cx.append(card);
  });

  if (sem.length) {
    const box = el("div", "ed-caixa ds-sem");
    box.append(el("div", "ed-caixa-tit", t("ds_sem_tit", { n: sem.length })));
    box.append(el("p", "nota", t("ds_sem_ajuda")));
    sem.forEach(({ e }) => {
      const ln = el("div", "ds-sem-lin");
      ln.append(el("span", "", e.nome || "?"));
      const b = el("button", "btn-min", t("ds_cadastrar"));
      b.type = "button";
      b.onclick = () => dsAbrirEdital(e.id, () => { if (typeof epAbrir === "function") epAbrir(); });
      ln.append(b);
      box.append(ln);
    });
    cx.append(box);
  }
}
