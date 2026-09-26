/* =====================================================================
 * A TELA: "Domínio" (aberta pela biblioteca de cartões e pelo cabeçalho do edital)
 *
 * Manchete + BARRA DE DISTRIBUIÇÃO do peso da prova por nível; uma faixa por disciplina (ordem do peso) dividida em
 * segmentos por tópico; ao abrir, cada tópico e ramo mostra o nível, o MOTIVO e os quatro sinais. O ramo com acerto
 * herdado do tópico leva contorno tracejado. Embaixo, "o que reforçar primeiro".
 * (A regra do nível e os números estão em dominio-assunto.js; aqui só se desenha.)
 * ===================================================================== */
let domEditalId = "", domDiscAberta = "";

function domMotivoTxt(m) {
  return t("dom_m_" + m.cod, { pct: m.pct, n: m.n, dias: m.dias === null || m.dias === undefined ? "?" : m.dias });
}
function domPorque(motivos) {
  const ms = (motivos || []).filter((m) => m.cod !== "solido");
  return ms.length ? t("dom_porque", { m: ms.map(domMotivoTxt).join(" · ") }) : "";
}

/* os chips dos quatro sinais de uma folha */
function domChips(pai, f) {
  const s = f.sinais || {};
  const chip = (txt, cls, tip) => { const c = gerEl("span", "dom-chip" + (cls ? " " + cls : ""), txt); if (tip) c.title = tip; pai.append(c); };
  const e = s.estudo || { estado: "nunca" };
  const dias = e.dias === null || e.dias === undefined ? "?" : e.dias;
  if (e.venceu) chip(t("dom_est_venceu", { d: dias }), "dom-chip-alerta");
  else if (e.estado === "nunca") chip(t("dom_est_nunca"), "");
  else chip(t(e.estado === "revisado" ? "dom_est_revisado" : "dom_est_estudado", { d: dias }), "");
  const a = s.acerto;
  if (a && a.n) {
    chip(a.valido ? t("dom_ac", { p: Math.round(a.pct), n: a.n }) : t("dom_ac_sem", { n: a.n }), (f.herdadoAcerto ? "dom-herdado " : "") + (a.valido ? "" : "dom-chip-fraco"),
      (f.herdadoAcerto ? t("dom_herdado") + " · " : "") + t("dom_ac_hist", { p: Math.round(a.historicoPct), n: a.historicoN }));
  } else chip(t("dom_ac_nenhuma"), "dom-chip-fraco");
  const r = s.retencao;
  chip(r && r.valido ? t("dom_rt", { p: Math.round(r.pct), n: r.respostas }) : t("dom_rt_sem"), r && r.valido ? "" : "dom-chip-fraco");
  const au = s.auto;
  if (au && au.nivel && au.nivel !== "media") chip(t(au.nivel === "alta" ? "dom_auto_alta" : "dom_auto_baixa") + (au.vencida ? " · " + t("dom_auto_venc") : ""), au.vencida ? "dom-chip-fraco" : "");
}

function domLinhaAcoes(pai, disciplina, topico, cartoes) {
  const ac = gerEl("span", "cov-acoes");
  const ab = gerEl("button", "btn-min", t("cov_abrir")); ab.type = "button";
  ab.onclick = () => { $("dlgDominio").close(); gerAbrirNoTopico(disciplina, topico); };
  ac.append(ab);
  const go = gerEl("button", "btn-min btn-min-ok", cartoes ? t("hor_estudar", { n: cartoes }) : t("hor_criar")); go.type = "button";
  go.onclick = () => { $("dlgDominio").close(); if (cartoes) estcEstudarTopico(disciplina, topico); else bancAlvoDefinir(disciplina, topico); };
  ac.append(go);
  pai.append(ac);
}

function domPintar() {
  const cx = $("domCorpo");
  cx.innerHTML = "";
  const ed = (editais || []).find((e) => String(e.id) === String(domEditalId));
  if (!ed) { cx.append(gerEl("p", "nota", t("cov_sem_edital"))); return; }
  const temF2 = covTemFase2(ed);
  $("domFase").hidden = !temF2;
  const fase = temF2 && $("domFase").value === "2" ? 2 : 1;
  const m = domDoEdital(ed, { fase });
  if (!m.resumo.folhas) { cx.append(gerEl("p", "nota", t("cov_sem_topicos"))); return; }
  const dist = m.resumo.distribuicao, tot = m.resumo.total || 1;
  const man = gerEl("div", "cov-manchete" + (dist.cinza + dist.vermelho >= 20 ? " cov-manchete-alerta" : ""));
  man.append(gerEl("b", "", t("dom_manchete", { s: Math.round((dist.cinza / tot) * 100), v: Math.round((dist.vermelho / tot) * 100) })));
  cx.append(man);
  /* a barra de distribuição: o peso da prova por nível */
  const barra = gerEl("div", "dom-dist");
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    const pct = (dist[k] / tot) * 100;
    if (pct <= 0) return;
    const seg = gerEl("div", "dom-seg dom-n-" + k, pct >= 7 ? Math.round(pct) + "%" : "");
    seg.style.width = pct.toFixed(2) + "%";
    seg.title = t("dom_n_" + k) + ": " + pct.toFixed(1) + "% " + t("dom_do_peso");
    barra.append(seg);
  });
  cx.append(barra);
  const leg = gerEl("div", "cov-legenda");
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    const it = gerEl("span", "cov-leg"); it.title = t("dom_ajuda_" + k);
    it.append(gerEl("i", "dom-leg-i dom-n-" + k), document.createTextNode(" " + t("dom_n_" + k) + " " + Math.round((dist[k] / tot) * 100) + "%"));
    leg.append(it);
  });
  cx.append(leg);
  cx.append(gerEl("p", "nota cov-base", t(m.base === "questoes" ? "dom_base_questoes" : (m.base === "fase2" ? "cov_base_fase2" : "dom_base_estimado"))));
  /* as disciplinas, na ordem do peso */
  const ordem = m.disciplinas.slice().sort((a, b) => (b.pesoPct - a.pesoPct) || (a.nome < b.nome ? -1 : 1));
  const lista = gerEl("div", "cov-lista");
  ordem.forEach((d) => {
    const linha = gerEl("div", "cov-disc" + (domDiscAberta === d.nome ? " cov-aberta" : ""));
    const cab = gerEl("div", "cov-disc-cab");
    const dd = d.distribuicao, ds = Object.keys(dd).reduce((x, k) => x + dd[k], 0) || 1;
    cab.append(gerEl("b", "cov-nome", d.nome), gerEl("span", "cov-peso", t("cov_peso", { p: d.pesoPct.toFixed(1) })),
      gerEl("span", "cov-n" + (dd.vermelho ? " cov-n-alerta" : ""), t("dom_disc_n", { v: Math.round((dd.verde / ds) * 100), r: Math.round((dd.vermelho / ds) * 100), c: Math.round((dd.cinza / ds) * 100) })));
    linha.append(cab);
    const tira = gerEl("div", "cov-tira");
    const somaTop = d.topicos.reduce((x, tp) => x + tp.pesoPct, 0) || 1;
    d.topicos.forEach((tp) => {
      const seg = gerEl("div", "cov-seg dom-n-" + (tp.nivel === "pulado" ? "cinza" : tp.nivel));
      seg.style.width = ((tp.pesoPct / somaTop) * 100).toFixed(2) + "%";
      seg.title = tp.nome + (tp.nivel === "pulado" ? "" : " — " + t("dom_n_" + tp.nivel));
      tira.append(seg);
    });
    linha.append(tira);
    const det = gerEl("div", "cov-det"); det.hidden = domDiscAberta !== d.nome;
    d.topicos.forEach((tp) => {
      const tl = gerEl("div", "dom-top dom-b-" + tp.nivel);
      const topo = gerEl("div", "dom-top-cab");
      topo.append(gerEl("span", "dom-nivel dom-n-" + tp.nivel, tp.nivel === "pulado" ? "—" : t("dom_n_" + tp.nivel)), gerEl("span", "cov-top-nome", tp.nome));
      if (tp.fase2 && m.fase === 1) topo.append(gerEl("span", "cov-f2", t("cov_f2_tag")));
      domLinhaAcoes(topo, d.nome, tp.nome, tp.cartoes);
      tl.append(topo);
      if (!tp.ramos.length && tp.sinais) {
        const pq = domPorque(tp.motivos); if (pq) tl.append(gerEl("div", "dom-porque", pq));
        const ch = gerEl("div", "dom-chips"); domChips(ch, tp); tl.append(ch);
      }
      tp.ramos.forEach((rm) => {
        const rl = gerEl("div", "dom-ramo dom-b-" + rm.nivel + (rm.pulado ? " hor-ramo-pulado" : ""));
        const rc = gerEl("div", "dom-top-cab");
        rc.append(gerEl("span", "dom-nivel dom-n-" + rm.nivel, rm.nivel === "pulado" ? "—" : t("dom_n_" + rm.nivel)), gerEl("span", "cov-top-nome", "↳ " + rm.ramoNome));
        rl.append(rc);
        if (!rm.pulado) {
          const pq = domPorque(rm.motivos); if (pq) rl.append(gerEl("div", "dom-porque", pq));
          const ch = gerEl("div", "dom-chips"); domChips(ch, rm); rl.append(ch);
        }
        tl.append(rl);
      });
      det.append(tl);
    });
    cab.onclick = () => { det.hidden = !det.hidden; domDiscAberta = det.hidden ? "" : d.nome; linha.className = "cov-disc" + (det.hidden ? "" : " cov-aberta"); };
    linha.append(det);
    lista.append(linha);
  });
  cx.append(lista);
  /* o que reforçar primeiro */
  if (m.reforcar.length) {
    const s = gerEl("div", "cov-bloco");
    s.append(gerEl("h4", "", t("dom_reforcar")), gerEl("p", "nota", t("dom_reforcar_sub")));
    m.reforcar.slice(0, 15).forEach((f) => {
      const l = gerEl("div", "cov-item dom-b-" + f.nivel);
      l.append(gerEl("span", "dom-nivel dom-n-" + f.nivel, t("dom_n_" + f.nivel)),
        gerEl("span", "cov-item-nome", f.disciplina + " › " + f.topico + (f.ramoNome ? " › " + f.ramoNome : "")),
        gerEl("span", "cov-item-n", t("dom_urg", { p: f.pesoPct.toFixed(1), f: DOM.fatores[f.nivel] })));
      const pq = domPorque(f.motivos); if (pq) l.title = pq;
      domLinhaAcoes(l, f.disciplina, f.topico, f.cartoes);
      s.append(l);
    });
    cx.append(s);
  }
}

function domAbrir(editalId, disciplina) {
  domDiscAberta = disciplina || "";
  const eds = covEditaisOrdenados();
  const sel = $("domEdital");
  sel.innerHTML = "";
  eds.forEach((e) => { const op = gerEl("option", "", e.nome || "—"); op.value = String(e.id); sel.append(op); });
  domEditalId = editalId ? String(editalId) : (eds[0] ? String(eds[0].id) : "");
  sel.value = domEditalId;
  $("domFase").value = "1";
  domPintar();
  dicasDosBotoes({ btnGerDominio: "dom_tip_abrir", btnEdDominio: "dom_tip_abrir", btnDomX: "cov_tip_x", domEdital: "cov_tip_edital", domFase: "cov_tip_fase" });
  abrirModal("dlgDominio");
}

if (typeof document !== "undefined" && $("dlgDominio")) {
  $("btnGerDominio").onclick = () => domAbrir();
  $("btnEdDominio").onclick = () => domAbrir(editalAtual);
  $("btnDomX").onclick = () => $("dlgDominio").close();
  $("domEdital").onchange = () => { domEditalId = $("domEdital").value; $("domFase").value = "1"; domPintar(); };
  $("domFase").onchange = domPintar;
}
