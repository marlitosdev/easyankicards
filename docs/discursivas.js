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
