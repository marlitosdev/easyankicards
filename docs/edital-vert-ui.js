/* =====================================================================
 * EDITAL VERTICALIZADO — a TELA e a impressão.
 *
 * O motor (edital-vert.js) decide o que entra e em que ordem; aqui se desenha a folha — uma faixa
 * preta por disciplina e, abaixo, a tabela Nº | CONTEÚDO | TEORIA | QUESTÕES | ACERTOS | REV. 1 | REV. 2 —
 * e se manda imprimir. O PDF é o do próprio navegador ("Salvar como PDF" na janela de impressão):
 * funciona offline e sem biblioteca. A mesma função desenha a prévia (dentro do diálogo) e a folha
 * de impressão (#edVertImpressao, filha direta do body, que o CSS de impressão deixa sozinha na página).
 * ===================================================================== */

const EV_CH = "eac_vert_opc";
const EV_PADRAO = { ordem: "peso", ramos: true, motivo: false, progresso: false, faixa: true, soFase2: false, ocultarOptativas: false };

function evOpcSalvas() {
  try { return Object.assign({}, EV_PADRAO, JSON.parse(localStorage.getItem(EV_CH) || "{}")); } catch (e) { return Object.assign({}, EV_PADRAO); }
}

/* as opções como estão na tela (e guardadas para a próxima vez) */
function evLerOpc() {
  const op = {
    ordem: $("evOrdem").value === "edital" ? "edital" : "peso",
    ramos: $("evRamos").checked, motivo: $("evMotivo").checked, progresso: $("evProgresso").checked,
    faixa: $("evFaixa").checked, soFase2: !$("evFase2Cx").hidden && $("evFase2").checked,
    ocultarOptativas: !!($("evOptOcultar") && $("evOptOcultar").checked),
  };
  try { localStorage.setItem(EV_CH, JSON.stringify({ ordem: op.ordem, ramos: op.ramos, motivo: op.motivo, progresso: op.progresso, faixa: op.faixa, soFase2: $("evFase2").checked, ocultarOptativas: op.ocultarOptativas,
    modo: typeof evvModo === "function" ? evvModo() : "viva" })); } catch (e) {}
  return op;
}

/* o edital ABERTO (o texto da bancada) já verticalizado com as opções dadas */
function evMontar(op) {
  const r = lerEdital(($("editalTexto") || {}).value || "");
  const v = edVerticalizar(r, {
    ordem: op.ordem, ramos: op.ramos, motivo: op.motivo, soFase2: op.soFase2, ocultarOptativas: op.ocultarOptativas,
    marcaDe: op.progresso ? (c) => (typeof edProgresso !== "undefined" && edProgresso[c]) || null : null,
  });
  const ab = typeof edAberto === "function" ? edAberto() : null;
  if (!v.titulo && ab) v.titulo = ab.nome || "";
  return v;
}

function evData(iso) {
  const p = String(iso || "").split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : "";
}

function evMinimoTexto(m) {
  if (!m) return "";
  return t("vert_minimo", { m: m.tipo === "pct" ? m.valor + "%" : t("vert_minimo_abs", { n: m.valor }) });
}

/* o texto à direita da faixa preta: o grupo (e o mínimo dele) e, se pedido, o tamanho da disciplina na prova */
function evTagDaFaixa(d, op, exata) {
  const partes = [];
  /* a OPTATIVA diz o que é na própria faixa: "escolha 1 de 2", a escolhida, ou "não escolhida" */
  if (d.optativa) partes.push(t("vert_opt_" + d.optativa, { n: d.optativaDe }));
  if (d.grupo) partes.push(d.grupo + (d.minimo ? " (" + evMinimoTexto(d.minimo) + ")" : ""));
  if (op.faixa) {
    /* A FATIA VEM ANTES DO PESO. "peso 3 · 2% da prova" era lido (por quem extrai o texto do PDF) como "32%": o último dígito
     * do peso colava no primeiro da fatia. Com a fatia primeiro e o peso dito "de 5", os dois números nunca ficam lado a lado.
     * E a fatia sem número de questões é ESTIMADA (peso × peso do tópico) — a folha diz isso. */
    if (d.abs) partes.push(t(d.unidade === "p" ? "vert_pontos" : "vert_questoes", { n: d.abs }));
    if (d.fatia != null) partes.push(t(exata ? "vert_fatia" : "vert_fatia_est", { n: d.fatia }));
    if (!d.abs) partes.push(t("vert_peso", { n: d.peso }));
  }
  return partes.join(" · ");
}

/* desenha a folha inteira dentro de `destino` */
function evFolha(v, op, destino) {
  destino.innerHTML = "";
  const folha = gerEl("div", "ev-folha");
  const cab = gerEl("div", "ev-cab");
  cab.append(gerEl("h1", "ev-tit", v.titulo || t("vert_sem_titulo")));
  const sub = [t("vert_edital")];
  if (v.prova) sub.push(t("vert_prova", { d: evData(v.prova) }));
  sub.push(t(v.ordem === "peso" ? "vert_ordem_peso" : "vert_ordem_edital"));
  if (v.soFase2) sub.push(t("vert_so_fase2"));
  sub.push(t("vert_resumo", { d: v.resumo.disciplinas, t: v.resumo.topicos, r: v.resumo.ramos }));
  /* o edital tem 2ª fase: a data dela e a legenda da marca (só quando a folha mostra todos os tópicos) */
  const f2 = v.fase2 && v.fase2.prova ? v.fase2 : null;
  if (f2) sub.push(t("vert_fase2_info", { nome: f2.nome || t("vert_f2_marca"), d: evData(f2.prova) }));
  if (f2 && !v.soFase2) sub.push(t("vert_f2_legenda"));
  if (v.temOptativa) sub.push(t("vert_opt_legenda"));
  /* (19.91.0) o número em vermelho não dizia o que era */
  if (v.disciplinas.some((d) => d.linhas.some((l) => l.pai))) sub.push(t("vert_pai_legenda"));
  cab.append(gerEl("div", "ev-sub", sub.join(" · ")));
  folha.append(cab);

  v.disciplinas.forEach((d) => {
    const sec = gerEl("section", "ev-disc" + (d.inativa ? " ev-inativa" : ""));
    const faixa = gerEl("div", "ev-faixa");
    faixa.append(gerEl("span", "ev-faixa-nome", d.nome), gerEl("span", "ev-faixa-tag", evTagDaFaixa(d, op, v.exata)));
    sec.append(faixa);
    const tab = gerEl("table", "ev-tab");
    const cabTr = gerEl("tr", "");
    [["ev-n", "vert_col_n"], ["ev-c", "vert_col_conteudo"], ["ev-k", "vert_col_teoria"], ["ev-k", "vert_col_questoes"],
      ["ev-k", "vert_col_acertos"], ["ev-k", "vert_col_rev1"], ["ev-k", "vert_col_rev2"]].forEach(([c, k]) => cabTr.append(gerEl("th", c, t(k))));
    const thead = gerEl("thead", ""); thead.append(cabTr);
    const tbody = gerEl("tbody", "");
    d.linhas.forEach((l) => {
      const tr = gerEl("tr", "ev-lin" + (l.pai ? " ev-pai" : "") + (l.nivel ? " ev-ramo" : "") + (l.pulado ? " ev-pulado" : ""));
      tr.append(gerEl("td", "ev-n", l.num));
      const c = gerEl("td", "ev-c", l.texto);
      if (l.motivo) c.append(gerEl("span", "ev-motivo", l.motivo));
      if (f2 && !v.soFase2 && l.fase2) c.append(gerEl("span", "ev-f2", t("vert_f2_marca")));
      tr.append(c);
      /* teoria, questões, acertos (em branco), rev. 1, rev. 2 */
      [l.teoria, false, null, l.rev1, l.rev2].forEach((marca) => {
        const td = gerEl("td", "ev-k");
        if (marca !== null) td.append(gerEl("span", "ev-cx" + (marca ? " ev-cx-ok" : ""), marca ? "✓" : ""));
        if (l.pulado) td.textContent = "—";
        tr.append(td);
      });
      tbody.append(tr);
    });
    tab.append(thead, tbody);
    sec.append(tab);
    folha.append(sec);
  });
  folha.append(gerEl("div", "ev-rodape", t("vert_gerado", { d: new Date().toLocaleDateString() })));
  destino.append(folha);
}

function evPintar() {
  const op = evLerOpc();
  const v = evMontar(op);
  /* "só a 2ª fase" só existe se o edital tiver tópico marcado para ela */
  const tem2 = (lerEdital(($("editalTexto") || {}).value || "").disciplinas || []).some((d) => d.topicos.some((x) => x.fase2));
  $("evFase2Cx").hidden = !tem2;
  const vazio = !v.disciplinas.length;
  $("evResumo").textContent = vazio ? t("vert_vazio") : t("vert_resumo", { d: v.resumo.disciplinas, t: v.resumo.topicos, r: v.resumo.ramos });
  $("btnEdVertImprimir").disabled = vazio;
  evFolha(v, op, $("evPrevia"));
  /* (19.91.0) a versão viva acompanha as mesmas opções */
  try { evvPintar(); } catch (e) { try { reg("ERRO", "verticalizado: versão viva", String(e && e.message)); } catch (e2) {} }
  evvAplicarModo();
  return v;
}

function evAbrir() {
  const s = evOpcSalvas();
  $("evOrdem").value = s.ordem; $("evRamos").checked = !!s.ramos; $("evMotivo").checked = !!s.motivo;
  $("evProgresso").checked = !!s.progresso; $("evFaixa").checked = !!s.faixa; $("evFase2").checked = !!s.soFase2;
  if ($("evOptOcultar")) $("evOptOcultar").checked = !!s.ocultarOptativas;
  evPintar();
  try { evvCheiaTrocar(localStorage.getItem(EV_CH_CHEIA) === "1", false); } catch (e) {}
  dicasDosBotoes({ btnEdVert: "vert_tip_abrir", btnEdVertImprimir: "vert_tip_imprimir", btnEdVertX: "cov_tip_x", evOrdem: "vert_tip_ordem",
    evRamos: "vert_tip_ramos", evMotivo: "vert_tip_motivo", evProgresso: "vert_tip_progresso", evFaixa: "vert_tip_faixa", evFase2: "vert_tip_fase2", evOptOcultar: "vert_tip_optocultar" });
  abrirModal("dlgEdVert");
}

/* a folha vai para #edVertImpressao e o CSS de impressão esconde todo o resto; depois da impressão, tudo volta */
function evImprimir() {
  const op = evLerOpc();
  const v = evMontar(op);
  if (!v.disciplinas.length) return false;
  const alvo = $("edVertImpressao");
  evFolha(v, op, alvo);
  document.body.classList.add("eac-imprimindo");
  const fim = () => {
    document.body.classList.remove("eac-imprimindo");
    alvo.innerHTML = "";
    if (typeof window.removeEventListener === "function") window.removeEventListener("afterprint", fim);
  };
  if (typeof window.addEventListener === "function") window.addEventListener("afterprint", fim);
  if (typeof window.print === "function") window.print(); else fim();
  return true;
}

/* =====================================================================
 * (19.91.0) A VERSÃO VIVA
 *
 * A folha era só para imprimir: as caixinhas não faziam nada na tela, "Questões" e "Acertos" saíam em branco e não havia
 * como ver de relance o que falta. A versão viva é a MESMA lista (mesma ordem, numeração e ramificações da folha), ligada
 * ao app:
 *  · ESTUDADO: marcar grava no plano e no diário (edMarcar, o mesmo caminho da lista do edital); o assunto com
 *    ramificações fica estudado quando todas estiverem; desmarcar pergunta antes;
 *  · REVISÃO: revisado (com a data), vencida ou em dia, pela conta do plano;
 *  · QUESTÕES: as respostas do seu banco e o acerto, na cor dos cortes do Domínio; CARTÕES: quantos o tópico tem;
 *  · a BOLINHA de cada linha é a cor do Domínio;
 *  · filtros (pendentes, revisão vencida, fracos, uma disciplina), a faixa da disciplina com o progresso, o cabeçalho
 *    preso no alto ao rolar, e a planilha (CSV) para quem usa Excel.
 * A folha de imprimir continua igual e é a outra aba.
 * ===================================================================== */
let evvFiltro = { mostrar: "todos", disc: "" };
let evvMudou = false;

function evvNorm(c) { return typeof matChaveNormal === "function" ? matChaveNormal(c) : String(c || "").toLowerCase(); }

/* o que o app sabe de cada linha: o plano (estudo, revisão), as questões, os cartões e o Domínio */
function evvDados() {
  const r = lerEdital(($("editalTexto") || {}).value || "");
  let plano = null;
  try {
    plano = montarPlano(r, { horas: Number(($("edHoras") || {}).value) || r.cfg.horas, prova: ($("edProva") || {}).value || r.cfg.prova,
      feitos: typeof edProgresso !== "undefined" ? edProgresso : {} });
  } catch (e) { plano = null; }
  const porChave = {};
  ((plano && plano.itens) || []).forEach((i) => { porChave[evvNorm(i.chave)] = i; });
  const qs = {};
  ((typeof qsTodas === "function" && qsTodas()) || []).forEach((q) => {
    if (!q || !q.disciplina || !q.topico) return;
    const k = evvNorm(matChave(q.disciplina, q.topico));
    (qs[k] = qs[k] || []).push(...(q.tentativas || []));
  });
  const dom = {};
  try {
    const ab = typeof edAberto === "function" ? edAberto() : null;
    if (ab && typeof domDoEdital === "function") {
      domDoEdital(ab).disciplinas.forEach((d) => d.topicos.forEach((tp) => {
        const k = evvNorm(tp.chave);
        dom[k] = tp.nivel;
        (tp.ramos || []).forEach((rm) => { if (rm.ramoId) dom[k + "›#" + rm.ramoId] = rm.nivel; });
      }));
    }
  } catch (e) {}
  let lim = { acertoRisco: 60, acertoSeguro: 75 };
  try { if (typeof domLimitesLer === "function") lim = domLimitesLer(); } catch (e) {}
  return { porChave, qs, dom, lim };
}

/* uma linha da folha com o que o app sabe dela */
function evvLinha(l, d, D) {
  const k = evvNorm(l.chave);
  const base = l.nivel ? k.slice(0, k.indexOf("›#")) : k;
  const item = D.porChave[base] || null;
  let est = null;
  if (l.nivel && item) est = (item.ramos || []).find((x) => k === base + "›#" + String(x.id).toLowerCase() || evvNorm(item.chave + "›#" + x.id) === k) || null;
  else est = item;
  const estado = !est ? "nunca" : est.pulado ? "pulado" : est.revisado ? "revisado" : est.feito ? "feito" : "nunca";
  const tent = l.nivel ? [] : (D.qs[k] || []);
  const ac = tent.length && typeof domAcerto === "function" ? domAcerto(tent) : null;
  const cart = !l.nivel && typeof matContarCartoes === "function" ? (() => { try { return matContarCartoes(matChaveViva(d.nome, l.texto)); } catch (e) { return 0; } })() : null;
  return { l, d, item, ramoId: l.nivel ? String(l.chave).split("›#")[1] : "", estado, quando: est ? (est.quando || "") : "", venceu: !!(est && est.venceu),
    n: tent.length, pct: ac && ac.historicoPct != null ? Math.round(ac.historicoPct) : null, cart, dom: D.dom[k] || (l.nivel ? D.dom[base] : "") || "" };
}

function evvPassa(x) {
  const f = evvFiltro.mostrar;
  if (f === "pend") return x.estado === "nunca";
  if (f === "venc") return x.venceu && x.estado !== "pulado";
  if (f === "fracos") return x.dom === "vermelho" || x.dom === "amarelo";
  return true;
}

/* marcar/desmarcar estudado, pelo caminho do edital */
async function evvMarcar(x, marcar) {
  const it = typeof edItemDoPlano === "function" ? edItemDoPlano(x.d.nome, x.l.nivel ? x.item && x.item.nome : x.l.texto) : x.item;
  if (!it) return false;
  if (!marcar) {
    const ok = await uiConfirm(t("vert_v_desmarcar", { t: x.l.texto }));
    if (!ok) { evvPintar(); return false; }
    if (x.l.nivel) {
      /* a marca era do TÓPICO (as ramificações herdavam): as irmãs ficam com ela; só esta sai */
      const P = typeof edProgresso !== "undefined" ? edProgresso : {};
      const topo = P[it.chave];
      if (topo) {
        (it.ramos || []).forEach((rm) => { const kr = it.chave + "›#" + rm.id; if (String(rm.id) !== String(x.ramoId) && P[kr] === undefined) P[kr] = Object.assign({}, topo); });
        delete P[it.chave];
      }
      delete P[it.chave + "›#" + x.ramoId];
      if (typeof edSalvar === "function") edSalvar();
    } else edMarcar(it, null, { via: "verticalizado" }, true);
  } else if (x.l.nivel) edMarcar(Object.assign({}, it, { ramosEscolhidos: [x.ramoId] }), "feito", { via: "verticalizado" }, true);
  else edMarcar(it, "feito", { via: "verticalizado" }, true);
  evvMudou = true;
  try { reg("VERTICALIZADO", marcar ? "marcado estudado na versão viva" : "desmarcado na versão viva", x.l.texto.slice(0, 60)); } catch (e) {}
  evvPintar();
  return true;
}

function evvDataCurta(iso) { const p = String(iso || "").slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] : ""; }

function evvPintar() {
  const cx = $("evViva");
  if (!cx) return null;
  cx.innerHTML = "";
  const op = evLerOpc();
  const v = evMontar(Object.assign({}, op, { progresso: false }));
  if (!v.disciplinas.length) { cx.append(gerEl("p", "nota", t("vert_vazio"))); return v; }
  const D = evvDados();
  const linhas = [];
  v.disciplinas.forEach((d) => d.linhas.forEach((l) => linhas.push(evvLinha(l, d, D))));
  /* o resumo do edital */
  const tops = linhas.filter((x) => !x.l.nivel && !x.d.inativa && x.estado !== "pulado");
  const nEst = tops.filter((x) => x.estado !== "nunca").length;
  const nVenc = linhas.filter((x) => x.venceu && x.estado !== "pulado" && !x.d.inativa).length;
  const nFracos = tops.filter((x) => x.dom === "vermelho" || x.dom === "amarelo").length;
  cx.append(gerEl("p", "evv-resumo", t("vert_v_resumo", { e: nEst, t: tops.length, p: tops.length ? Math.round((nEst / tops.length) * 100) : 0, v: nVenc, f: nFracos })));
  /* os filtros */
  const fx = gerEl("div", "evv-filtros");
  [["todos", "vert_f_todos"], ["pend", "vert_f_pend"], ["venc", "vert_f_venc"], ["fracos", "vert_f_fracos"]].forEach(([k, rot]) => {
    const b = gerEl("button", "btn-min" + (evvFiltro.mostrar === k ? " mat-ligado" : ""), t(rot));
    b.type = "button"; b.id = "evvF_" + k; b.setAttribute("aria-pressed", evvFiltro.mostrar === k ? "true" : "false");
    b.onclick = () => { evvFiltro.mostrar = k; evvPintar(); };
    fx.append(b);
  });
  const sd = document.createElement("select"); sd.id = "evvDisc"; sd.className = "evv-sel";
  [["", t("vert_f_disc_todas")]].concat(v.disciplinas.map((d) => [d.nome, d.nome])).forEach(([val, rot]) => { const o = document.createElement("option"); o.value = val; o.textContent = rot; sd.append(o); });
  sd.value = evvFiltro.disc && v.disciplinas.some((d) => d.nome === evvFiltro.disc) ? evvFiltro.disc : "";
  sd.onchange = () => { evvFiltro.disc = sd.value; evvPintar(); };
  fx.append(sd);
  const csv = gerEl("button", "btn-min evv-csv", t("vert_csv"));
  csv.type = "button"; csv.id = "btnEvvCsv";
  csv.onclick = () => evvCsv(v, linhas);
  fx.append(csv);
  cx.append(fx, gerEl("p", "nota evv-leg", t("vert_v_leg")));
  /* as disciplinas */
  const rol = gerEl("div", "evv-rol");
  rol.id = "evvRol";
  let algum = false;
  v.disciplinas.forEach((d) => {
    if (evvFiltro.disc && d.nome !== evvFiltro.disc) return;
    const doD = linhas.filter((x) => x.d === d);
    /* a linha-mãe aparece quando ela ou uma ramificação dela passa no filtro */
    const vis = doD.filter((x, k) => {
      if (evvPassa(x)) return true;
      if (x.l.pai) { for (let j = k + 1; j < doD.length && doD[j].l.nivel; j++) if (evvPassa(doD[j])) return true; }
      return false;
    });
    if (!vis.length) return;
    algum = true;
    const sec = gerEl("section", "evv-disc" + (d.inativa ? " ev-inativa" : ""));
    const tp = doD.filter((x) => !x.l.nivel && x.estado !== "pulado");
    const e0 = tp.filter((x) => x.estado !== "nunca").length;
    const fx2 = gerEl("div", "evv-faixa");
    const pct = tp.length ? Math.round((e0 / tp.length) * 100) : 0;
    const barra = gerEl("span", "evv-faixa-barra"); const f0 = gerEl("span", "evv-faixa-fill"); f0.style.width = pct + "%"; barra.append(f0);
    fx2.append(gerEl("span", "evv-faixa-nome", d.nome), gerEl("span", "evv-faixa-tag", [evTagDaFaixa(d, op, v.exata), t("vert_v_faixa", { e: e0, t: tp.length })].filter(Boolean).join(" · ")), barra);
    sec.append(fx2);
    const tab = gerEl("table", "evv-tab");
    const th = gerEl("tr", "");
    [["evv-n", "vert_col_n"], ["evv-c", "vert_col_conteudo"], ["evv-k", "vert_v_col_estudado"], ["evv-k", "vert_v_col_rev"], ["evv-k", "vert_v_col_q"], ["evv-k evv-kc", "vert_v_col_cart"]]
      .forEach(([c, kk]) => th.append(gerEl("th", c, t(kk))));
    const thead = gerEl("thead", ""); thead.append(th);
    const tb = gerEl("tbody", "");
    vis.forEach((x) => {
      const l = x.l;
      const tr = gerEl("tr", "evv-lin" + (l.pai ? " ev-pai" : "") + (l.nivel ? " ev-ramo" : "") + (x.estado === "pulado" ? " ev-pulado" : ""));
      tr.append(gerEl("td", "evv-n", l.num));
      const c = gerEl("td", "evv-c");
      const dot = gerEl("span", "evv-dot" + (x.dom ? " dom-n-" + x.dom : ""));
      dot.title = x.dom ? t("dom_n_" + x.dom) : t("vert_v_sem_dom");
      c.append(dot, gerEl("span", "evv-tx", l.texto));
      if (l.motivo) c.append(gerEl("span", "ev-motivo", l.motivo));
      tr.append(c);
      /* estudado */
      const te = gerEl("td", "evv-k");
      if (x.estado === "pulado") te.textContent = t("vert_v_pulado");
      else {
        const lb = gerEl("label", "evv-ck");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.id = "evvCk_" + evvNorm(l.chave).replace(/[^a-z0-9]+/g, "_").slice(0, 80);
        cb.checked = x.estado !== "nunca";
        if (l.pai) { cb.disabled = true; lb.title = t("vert_v_ramos_tip"); }
        else cb.onchange = () => evvMarcar(x, cb.checked);
        lb.append(cb);
        if (x.quando && x.estado !== "nunca") lb.append(gerEl("span", "evv-data", evvDataCurta(x.quando)));
        te.append(lb);
      }
      tr.append(te);
      /* revisão */
      const tv = gerEl("td", "evv-k");
      if (x.estado === "revisado") tv.append(gerEl("span", "evv-rev-ok", "✓ " + evvDataCurta(x.quando)));
      else if (x.estado === "feito" && x.venceu) tv.append(gerEl("span", "evv-rev-venc", t("vert_v_rev_venc")));
      else if (x.estado === "feito") tv.append(gerEl("span", "evv-rev-dia", t("vert_v_rev_ok")));
      else tv.textContent = "—";
      tr.append(tv);
      /* questões */
      const tq = gerEl("td", "evv-k");
      if (x.n) {
        const s = gerEl("span", "evv-q" + (x.pct == null ? "" : x.pct < D.lim.acertoRisco ? " ruim" : x.pct < D.lim.acertoSeguro ? " meio" : " bom"), x.n + " · " + (x.pct == null ? "—" : x.pct + "%"));
        s.title = t("vert_v_q_tip", { n: x.n, p: x.pct == null ? "—" : x.pct });
        tq.append(s);
      } else tq.textContent = l.nivel ? "" : "—";
      tr.append(tq);
      tr.append(gerEl("td", "evv-k evv-kc", x.cart == null ? "" : x.cart ? String(x.cart) : "—"));
      tb.append(tr);
    });
    tab.append(thead, tb);
    sec.append(tab);
    rol.append(sec);
  });
  if (!algum) rol.append(gerEl("p", "nota", t("vert_v_nada")));
  cx.append(rol);
  return v;
}

/* a planilha: uma linha por assunto e ramificação, com o que a versão viva mostra (";" e BOM, para o Excel em português) */
function evvCsvTexto(v, linhas) {
  const q = (s) => { const x = String(s == null ? "" : s); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const cab = ["disciplina", "n", "conteudo", "estudado", "estudado_em", "revisao", "questoes", "acerto_pct", "cartoes", "dominio"];
  const rot = (x) => x.estado === "revisado" ? "revisado" : x.estado === "feito" ? (x.venceu ? "vencida" : "em dia") : x.estado === "pulado" ? "pulado" : "";
  const corpo = linhas.map((x) => [x.d.nome, x.l.num, x.l.texto, x.estado === "nunca" ? "não" : x.estado === "pulado" ? "pulado" : "sim", x.quando || "", rot(x),
    x.n || "", x.pct == null ? "" : x.pct, x.cart == null ? "" : x.cart, x.dom || ""].map(q).join(";"));
  return "﻿" + [cab.join(";")].concat(corpo).join("\r\n");
}
function evvCsv(v, linhas) {
  const txt = evvCsvTexto(v, linhas);
  const nome = "edital-verticalizado-" + String(v.titulo || "edital").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".csv";
  try { if (typeof baixarArquivo === "function") baixarArquivo(txt, nome, "text/csv;charset=utf-8"); } catch (e) {}
  try { reg("VERTICALIZADO", "planilha exportada", nome + " · " + linhas.length + " linha(s)"); } catch (e) {}
  return txt;
}

/* tela cheia: a lista viva tem 133 assuntos e 111 ramificações — numa janela pequena sobrava pouco para ela */
const EV_CH_CHEIA = "eac_vert_cheia";
function evvCheiaTrocar(sim, lembrar) {
  const dlg = $("dlgEdVert");
  if (!dlg) return false;
  const quer = sim === undefined ? !dlg.classList.contains("ev-cheia") : !!sim;
  dlg.classList.toggle("ev-cheia", quer);
  const b = $("btnEvCheia");
  if (b) { b.textContent = t(quer ? "dom_cheia_sair" : "dom_cheia"); if (b.setAttribute) b.setAttribute("aria-pressed", String(quer)); }
  if (quer) { if (lembrar && typeof telaCheiaPedir === "function") telaCheiaPedir("vert", () => { if (dlg.classList.contains("ev-cheia")) evvCheiaTrocar(false, false); }); }
  else if (typeof telaCheiaSair === "function") telaCheiaSair("vert");
  if (lembrar) { try { localStorage.setItem(EV_CH_CHEIA, quer ? "1" : "0"); } catch (e) {} }
  return quer;
}

/* as duas abas: a versão viva e a folha de imprimir (a escolha fica guardada) */
function evvModo() { try { return (JSON.parse(localStorage.getItem(EV_CH) || "{}").modo === "folha") ? "folha" : "viva"; } catch (e) { return "viva"; } }
function evvModoDefinir(m) {
  try { const o = JSON.parse(localStorage.getItem(EV_CH) || "{}") || {}; o.modo = m === "folha" ? "folha" : "viva"; localStorage.setItem(EV_CH, JSON.stringify(o)); } catch (e) {}
  evvAplicarModo();
}
function evvAplicarModo() {
  const m = evvModo();
  const viva = m === "viva";
  if ($("evViva")) $("evViva").hidden = !viva;
  if ($("evPrevia")) $("evPrevia").hidden = viva;
  if ($("evProgressoCx")) $("evProgressoCx").hidden = viva;
  /* na viva, o resumo de cima repetia o da lista: sai, e a lista ganha a linha */
  if ($("evResumo")) $("evResumo").hidden = viva;
  [["btnEvModoViva", viva], ["btnEvModoFolha", !viva]].forEach(([id, on]) => {
    const b = $(id); if (!b) return;
    b.classList.toggle("sel", on); b.setAttribute("aria-selected", on ? "true" : "false");
  });
  if ($("evModoAj")) $("evModoAj").textContent = t(viva ? "vert_viva_aj" : "vert_folha_aj");
  return m;
}

if (typeof document !== "undefined" && $("dlgEdVert")) {
  $("btnEdVert").onclick = evAbrir;
  if ($("btnEvModoViva")) $("btnEvModoViva").onclick = () => evvModoDefinir("viva");
  if ($("btnEvCheia")) $("btnEvCheia").onclick = () => evvCheiaTrocar(undefined, true);
  if ($("btnEvModoFolha")) $("btnEvModoFolha").onclick = () => evvModoDefinir("folha");
  /* fechar depois de marcar na versão viva: a tela do edital e a agenda se atualizam */
  if ($("dlgEdVert").addEventListener) $("dlgEdVert").addEventListener("close", () => {
    if (typeof telaCheiaSair === "function") telaCheiaSair("vert");
    if (!evvMudou) return;
    evvMudou = false;
    try { if (typeof edRender === "function") edRender(); } catch (e) {}
    try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
  });
  $("btnEdVertX").onclick = () => $("dlgEdVert").close();
  $("btnEdVertFechar").onclick = () => $("dlgEdVert").close();
  ["evOrdem", "evRamos", "evMotivo", "evProgresso", "evFaixa", "evFase2", "evOptOcultar"].forEach((id) => { if ($(id)) $(id).onchange = evPintar; });
  $("btnEdVertImprimir").onclick = evImprimir;
}
