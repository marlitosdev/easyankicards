/* =====================================================================
 * A TELA: "Domínio" (aberta pela biblioteca de cartões e pelo cabeçalho do edital)
 *
 * Manchete + BARRA DE DISTRIBUIÇÃO do peso da prova por nível; uma faixa por disciplina (ordem do peso) dividida em
 * segmentos por tópico; ao abrir, cada tópico e ramo mostra o nível, o MOTIVO e os quatro sinais. O ramo com acerto
 * herdado do tópico leva contorno tracejado. Embaixo, "o que reforçar primeiro".
 * (A regra do nível e os números estão em dominio-assunto.js; aqui só se desenha.)
 * ===================================================================== */
let domEditalId = "", domDiscAberta = "", domFiltro = "todos";
/* (v18.86.0) TRÊS VISÕES em vez de uma rolagem só: o que fazer agora (prioridades), o mapa (disciplinas) e a evolução.
 * A barra do peso por nível fica presa no topo do corpo, à vista nas três. A visão escolhida é lembrada. */
const DOM_ABAS = ["prior", "disc", "evo"];
const DOM_CH_ABA = "eac_dom_aba";
let domAba = "prior";
function domAbaLer() { try { const v = localStorage.getItem(DOM_CH_ABA); return DOM_ABAS.indexOf(v) >= 0 ? v : "prior"; } catch (e) { return "prior"; } }
function domAbaDefinir(a, calado) {
  domAba = DOM_ABAS.indexOf(a) >= 0 ? a : "prior";
  try { localStorage.setItem(DOM_CH_ABA, domAba); } catch (e) {}
  if (!calado) domPintar();
  return domAba;
}
/* TELA CHEIA EM PRIMEIRO LUGAR (pedido de 2026-10-19): o Domínio abre ocupando a tela inteira — a página pede a tela
 * cheia ao navegador (telaCheiaPedir, app.js, a mesma dos leitores) e a janela ocupa tudo. O botão do cabeçalho volta à
 * janela; a escolha é lembrada (padrão: tela cheia). Sair pelo Esc do navegador não muda a preferência. */
const DOM_CH_CHEIA = "eac_dom_cheia";
let domCheia = false;
function domCheiaPreferida() { try { return localStorage.getItem(DOM_CH_CHEIA) !== "0"; } catch (e) { return true; } }
function domCheiaTrocar(sim, lembrar) {
  domCheia = sim === undefined ? !domCheia : !!sim;
  const dlg = $("dlgDominio");
  if (dlg) dlg.classList.toggle("dom-cheia", domCheia);
  const b = $("btnDomCheia");
  if (b) { b.textContent = t(domCheia ? "dom_cheia_sair" : "dom_cheia"); b.setAttribute("aria-pressed", String(domCheia)); }
  if (domCheia) { if (typeof telaCheiaPedir === "function") telaCheiaPedir("dominio", () => { if (domCheia) domCheiaTrocar(false, false); }); }
  else if (typeof telaCheiaSair === "function") telaCheiaSair("dominio");
  if (lembrar) { try { localStorage.setItem(DOM_CH_CHEIA, domCheia ? "1" : "0"); } catch (e) {} }
  /* o tamanho muda: o lado a lado (tela larga) é decidido de novo */
  if (dlg && dlg.open) domPintar();
  return domCheia;
}
/* TELA LARGA (computador): o mapa e a fila LADO A LADO — mapa à esquerda, o que reforçar à direita —, como a Biblioteca
 * de cartões. As abas viram duas: "Mapa e prioridades" e "Evolução". Na tela estreita, as três abas. */
const DOM_LARGO_MIN = 900;
let domLargoTeste = null;
function domLargo() {
  if (domLargoTeste !== null) return domLargoTeste;
  try { return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(min-width: " + DOM_LARGO_MIN + "px)").matches); } catch (e) { return false; }
}
function domDuas() { return domLargo() && domAba !== "evo"; }
function domPintarAbas() {
  const largo = domLargo();
  [["btnDomAbaPrior", "prior"], ["btnDomAbaDisc", "disc"], ["btnDomAbaEvo", "evo"]].forEach(([id, a]) => {
    if ($(id)) $(id).setAttribute("aria-selected", (largo && a !== "evo" ? domAba !== "evo" : domAba === a) ? "true" : "false");
  });
  if ($("btnDomAbaDisc")) $("btnDomAbaDisc").hidden = largo;
  if ($("btnDomAbaPrior")) $("btnDomAbaPrior").textContent = t(largo ? "dom_aba_painel" : "dom_aba_prior");
  if ($("dlgDominio")) $("dlgDominio").classList.toggle("dom-largo", largo);
  if ($("domCorpo")) $("domCorpo").classList.toggle("dom-duas", domDuas());
  /* os filtros valem para as prioridades e o mapa; na evolução não há o que filtrar */
  if ($("domFiltros")) $("domFiltros").hidden = domAba === "evo";
}
const DOM_FILTROS = ["todos", "vermelho", "vencida", "azul", "cinza"];

/* a folha passa pelo filtro escolhido? */
function domCasa(x) {
  if (domFiltro === "todos") return true;
  if (domFiltro === "vencida") return (x.motivos || []).some((m) => m.cod === "revisao_vencida");
  return x.nivel === domFiltro;
}

/* MINHA AVALIAÇÃO: inseguro · médio · domino (e limpar). No tópico vale para o plano também; no ramo, só para o Domínio. */
function domAutoWidget(pai, disciplina, nomeGuardado, ehRamo) {
  const atual = difDe(disciplina, nomeGuardado);
  const box = gerEl("div", "dom-auto");
  box.append(gerEl("span", "dom-minha", t("dom_minha") + (atual.vencida ? " (" + t("dom_auto_venc") + ")" : "")));
  [["alta", "dom_auto_b_alta"], ["media", "dom_auto_b_media"], ["baixa", "dom_auto_b_baixa"]].forEach(([n, chave]) => {
    const b = gerEl("button", "dom-auto-b" + (atual.nivel === n ? " ativa" : ""), t(chave)); b.type = "button";
    b.title = t(ehRamo ? "dom_tip_auto_ramo" : "dom_tip_auto_topico");
    b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); difDefinir(disciplina, nomeGuardado, n, "declarada"); domPintar(); };
    box.append(b);
  });
  if (atual.nivel) {
    const l = gerEl("button", "dom-auto-b", t("dom_auto_limpar")); l.type = "button";
    l.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); difApagar(disciplina, nomeGuardado); domPintar(); };
    box.append(l);
  }
  pai.append(box);
}

/* "Registrar" estudo ou revisão: só quando o edital do Domínio é o que está aberto na tela do edital (o registro grava lá) */
function domBotaoRegistrar(pai, disciplina, topico, ramoId) {
  if (String(domEditalId) !== String(editalAtual)) return;
  const rg = gerEl("button", "btn-min", t("dom_registrar")); rg.type = "button";
  rg.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const it = edItemDoPlano(disciplina, topico);
    if (!it) return;
    $("dlgDominio").close();
    abrirRegistro(it, ramoId ? { ramo: ramoId } : undefined);
  };
  pai.append(rg);
}

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
  const qu = gerEl("button", "btn-min", t("dom_questoes")); qu.type = "button";
  qu.onclick = () => { $("dlgDominio").close(); qsUiResponderDireto(disciplina, topico); };
  ac.append(qu);
  domBotaoRegistrar(ac, disciplina, topico, "");
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
  domPintarFiltros(m);
  domPreencherCortes();
  domPintarAbas();
  const dist = m.resumo.distribuicao, tot = m.resumo.total || 1;
  const pct = (k) => (dist[k] / tot) * 100;
  /* ---- o topo preso: manchete curta + barra do peso por nível + legenda ---- */
  const fixo = gerEl("div", "dom-fixo");
  const vencidas = m.folhas.filter((x) => (x.motivos || []).some((mm) => mm.cod === "revisao_vencida")).length;
  /* VERMELHO SÓ PARA O QUE ESTÁ RUIM: muito ainda não estudado é o começo natural de um edital, não um erro */
  const tom = (dist.vermelho > 0 || vencidas) ? " cov-manchete-alerta" : (pct("cinza") >= 20 ? " dom-manchete-info" : "");
  const man = gerEl("div", "cov-manchete dom-manchete" + tom);
  man.append(gerEl("b", "", t("dom_manchete", { s: Math.round(pct("cinza")), v: Math.round(pct("vermelho")) })));
  if (vencidas) man.append(document.createTextNode(" " + t("dom_manchete_venc", { n: vencidas })));
  fixo.append(man);
  /* a barra de distribuição: o peso da prova por nível */
  const barra = gerEl("div", "dom-dist");
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    const p = pct(k);
    if (p <= 0) return;
    const seg = gerEl("div", "dom-seg dom-n-" + k, p >= 7 ? Math.round(p) + "%" : "");
    seg.style.width = p.toFixed(2) + "%";
    seg.title = t("dom_n_" + k) + ": " + p.toFixed(1) + "% " + t("dom_do_peso");
    barra.append(seg);
  });
  fixo.append(barra);
  const leg = gerEl("div", "cov-legenda");
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    const it = gerEl("span", "cov-leg"); it.title = t("dom_ajuda_" + k);
    it.append(gerEl("i", "dom-leg-i dom-n-" + k), document.createTextNode(" " + t("dom_n_" + k) + " " + Math.round(pct(k)) + "%"));
    leg.append(it);
  });
  fixo.append(leg);
  cx.append(fixo);
  const duas = domDuas();
  const painel = (aba) => { const p = gerEl("div", "dom-painel dom-painel-" + aba); p.hidden = duas ? aba === "evo" : domAba !== aba; cx.append(p); return p; };
  /* lado a lado, o mapa vem primeiro (coluna da esquerda) */
  const pDisc = duas ? painel("disc") : null;
  const pPrior = painel("prior");
  const pDisc2 = pDisc || painel("disc");
  const pEvo = painel("evo");
  /* ---- evolução (calculada sempre: a diferença de cada disciplina aparece no mapa) ---- */
  const dlt = domEvolucaoPintar(pEvo, m, ed.id, fase);
  pEvo.append(gerEl("p", "nota cov-base", t(m.base === "questoes" ? "dom_base_questoes" : (m.base === "fase2" ? "cov_base_fase2" : "dom_base_estimado"))));
  /* ---- prioridades: o que reforçar primeiro (com o filtro escolhido), o porquê à vista e o ganho dos primeiros ---- */
  const fila = m.reforcar.filter(domCasa);
  const s = gerEl("div", "cov-bloco");
  s.append(gerEl("h4", "", t("dom_reforcar")));
  if (fila.length && domFiltro === "todos") {
    const topo = fila.slice(0, 5);
    const ganho = (topo.reduce((x, f) => x + (f.pesoPct || 0), 0) / tot) * 100;
    const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
    s.append(gerEl("p", "dom-ganho", t("dom_ganho", { n: topo.length, g: fmt(ganho), a: fmt(pct("verde")), b: fmt(Math.min(100, pct("verde") + ganho)) })));
  }
  if (!fila.length) s.append(gerEl("p", "nota", t("dom_reforcar_vazio")));
  fila.slice(0, 15).forEach((f) => {
    const l = gerEl("div", "cov-item dom-item dom-b-" + f.nivel);
    l.append(gerEl("span", "dom-nivel dom-n-" + f.nivel, t("dom_n_" + f.nivel)),
      gerEl("span", "cov-item-nome", f.disciplina + " › " + f.topico + (f.ramoNome ? " › " + f.ramoNome : "")),
      gerEl("span", "cov-item-n", t("dom_urg", { p: f.pesoPct.toFixed(1), f: DOM.fatores[f.nivel] })));
    /* o PORQUÊ à vista (antes, só no balão do mouse), antes dos botões: primeiro o motivo, depois o que fazer */
    const pq = domPorque(f.motivos);
    if (pq) { l.title = pq; l.append(gerEl("div", "dom-porque dom-item-porque", pq)); }
    domLinhaAcoes(l, f.disciplina, f.topico, f.cartoes);
    s.append(l);
  });
  s.append(gerEl("p", "nota", t("dom_reforcar_sub")));
  pPrior.append(s);
  /* ---- disciplinas: as que já têm estudo primeiro; as ainda sem nada estudado recolhidas no fim ---- */
  const ordem = m.disciplinas.slice().sort((a, b) => (b.pesoPct - a.pesoPct) || (a.nome < b.nome ? -1 : 1));
  const lista = gerEl("div", "cov-lista");
  const semEstudo = gerEl("details", "dom-sem-estudo");
  const semLista = gerEl("div", "cov-lista");
  let nSem = 0, pesoSem = 0, abrirSem = false;
  const semNomes = [];
  ordem.forEach((d) => {
    const casaTopo = (tp) => (tp.ramos.length ? tp.ramos.some(domCasa) : domCasa(tp));
    if (domFiltro !== "todos" && !d.topicos.some(casaTopo)) return;
    const abertaAqui = domDiscAberta === d.nome || domFiltro !== "todos";
    const linha = gerEl("div", "cov-disc" + (abertaAqui ? " cov-aberta" : ""));
    const cab = gerEl("div", "cov-disc-cab");
    const dd = d.distribuicao, ds = Object.keys(dd).reduce((x, k) => x + dd[k], 0) || 1;
    cab.append(gerEl("b", "cov-nome", d.nome), gerEl("span", "cov-peso", t("cov_peso", { p: d.pesoPct.toFixed(1) })),
      gerEl("span", "cov-n" + (dd.vermelho ? " cov-n-alerta" : ""), t("dom_disc_n", { v: Math.round((dd.verde / ds) * 100), r: Math.round((dd.vermelho / ds) * 100), c: Math.round((dd.cinza / ds) * 100) })));
    const dd2 = dlt && dlt.disciplinas[d.nome];
    if (dd2 && dd2.verde !== 0) cab.append(gerEl("span", "dom-evo-disc" + (dd2.verde > 0 ? " dom-evo-sobe" : " dom-evo-desce"), t("dom_evo_disc", { v: (dd2.verde > 0 ? "+" : "") + String(dd2.verde).replace(".", ",") })));
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
    const det = gerEl("div", "cov-det"); det.hidden = !abertaAqui;
    d.topicos.forEach((tp) => {
      if (domFiltro !== "todos" && !casaTopo(tp)) return;
      const tl = gerEl("div", "dom-top dom-b-" + tp.nivel);
      const topo = gerEl("div", "dom-top-cab");
      topo.append(gerEl("span", "dom-nivel dom-n-" + tp.nivel, tp.nivel === "pulado" ? "—" : t("dom_n_" + tp.nivel)), gerEl("span", "cov-top-nome", tp.nome));
      if (tp.fase2 && m.fase === 1) topo.append(gerEl("span", "cov-f2", t("cov_f2_tag")));
      domLinhaAcoes(topo, d.nome, tp.nome, tp.cartoes);
      tl.append(topo);
      domAutoWidget(tl, d.nome, tp.nome, false);
      if (!tp.ramos.length && tp.sinais) {
        const pq = domPorque(tp.motivos); if (pq) tl.append(gerEl("div", "dom-porque", pq));
        const ch = gerEl("div", "dom-chips"); domChips(ch, tp); tl.append(ch);
      }
      tp.ramos.forEach((rm) => {
        if (domFiltro !== "todos" && !domCasa(rm)) return;
        const rl = gerEl("div", "dom-ramo dom-b-" + rm.nivel + (rm.pulado ? " hor-ramo-pulado" : ""));
        const rc = gerEl("div", "dom-top-cab");
        rc.append(gerEl("span", "dom-nivel dom-n-" + rm.nivel, rm.nivel === "pulado" ? "—" : t("dom_n_" + rm.nivel)), gerEl("span", "cov-top-nome", "↳ " + rm.ramoNome));
        rl.append(rc);
        if (!rm.pulado) {
          const pq = domPorque(rm.motivos); if (pq) rl.append(gerEl("div", "dom-porque", pq));
          const ch = gerEl("div", "dom-chips"); domChips(ch, rm); rl.append(ch);
          domAutoWidget(rl, d.nome, domChaveAuto(tp.nome, rm.ramoId), true);
          const bt = gerEl("div", "cov-acoes"); domBotaoRegistrar(bt, d.nome, tp.nome, rm.ramoId); if (bt.children.length) rl.append(bt);
        }
        tl.append(rl);
      });
      det.append(tl);
    });
    cab.onclick = () => { det.hidden = !det.hidden; domDiscAberta = det.hidden ? "" : d.nome; linha.className = "cov-disc" + (det.hidden ? "" : " cov-aberta"); };
    linha.append(det);
    /* "nada estudado" = todo o peso dela está em não estudado (com filtro ativo não se agrupa: o filtro já recorta) */
    const nada = domFiltro === "todos" && dd.cinza >= ds - 1e-9;
    if (nada) { semLista.append(linha); nSem++; pesoSem += d.pesoPct; semNomes.push({ nome: d.nome, p: d.pesoPct }); if (domDiscAberta === d.nome) abrirSem = true; }
    else lista.append(linha);
  });
  pDisc2.append(lista);
  if (nSem) {
    semEstudo.open = abrirSem || !lista.children.length;
    /* as maiores entre as não iniciadas, pelo nome, no próprio título do grupo */
    const maiores = semNomes.slice(0, 3).map((x) => x.nome + " " + x.p.toFixed(1).replace(".", ",") + "%").join(", ") + (semNomes.length > 3 ? "…" : "");
    semEstudo.append(gerEl("summary", "", t("dom_sem_estudo", { n: nSem, p: pesoSem.toFixed(1).replace(".", ",") }) + (maiores ? " — " + maiores : "")), semLista);
    pDisc2.append(semEstudo);
  }
}

/* os filtros: chips com a contagem de folhas (tópicos sem ramo ou ramos) de cada situação */
function domPintarFiltros(m) {
  const cx = $("domFiltros");
  cx.innerHTML = "";
  DOM_FILTROS.forEach((f) => {
    const n = f === "todos" ? m.folhas.length : m.folhas.filter((x) => (f === "vencida" ? (x.motivos || []).some((mm) => mm.cod === "revisao_vencida") : x.nivel === f)).length;
    const b = gerEl("button", "dom-filtro" + (domFiltro === f ? " ativa" : ""), t("dom_f_" + f) + " (" + n + ")"); b.type = "button";
    b.onclick = () => { domFiltro = f; domPintar(); };
    cx.append(b);
  });
}

/* os cortes do semáforo */
function domPreencherCortes() {
  const l = domLimitesLer();
  $("domAcRisco").value = String(l.acertoRisco); $("domAcSeguro").value = String(l.acertoSeguro);
  $("domRtRisco").value = String(l.retencaoRisco); $("domRtSeguro").value = String(l.retencaoSeguro);
  /* os cortes em vigor ficam à vista no próprio título (sem precisar abrir) */
  if ($("domAjustesSum")) $("domAjustesSum").textContent = t("dom_ajustes_v", { a: l.acertoRisco, b: l.acertoSeguro, c: l.retencaoRisco, d: l.retencaoSeguro });
}
/* a explicação da tela: aberta na primeira vez; depois, recolhida no "?" */
const DOM_CH_SUB = "eac_dom_sub_visto";
function domAjudaTrocar(sim) {
  const p = $("domSub");
  if (!p) return false;
  p.hidden = sim === undefined ? !p.hidden : !sim;
  if ($("btnDomAjuda")) $("btnDomAjuda").setAttribute("aria-expanded", p.hidden ? "false" : "true");
  return !p.hidden;
}
function domSalvarCortes() {
  domLimitesGravar({ acertoRisco: $("domAcRisco").value, acertoSeguro: $("domAcSeguro").value, retencaoRisco: $("domRtRisco").value, retencaoSeguro: $("domRtSeguro").value });
  domPintar();
}

function domAbrir(editalId, disciplina) {
  domDiscAberta = disciplina || "";
  domFiltro = "todos";
  /* aberto numa disciplina: vai direto ao mapa; senão, a visão lembrada */
  domAba = disciplina ? "disc" : domAbaLer();
  let visto = false;
  try { visto = !!localStorage.getItem(DOM_CH_SUB); localStorage.setItem(DOM_CH_SUB, "1"); } catch (e) {}
  domAjudaTrocar(!visto);
  const eds = covEditaisOrdenados();
  const sel = $("domEdital");
  sel.innerHTML = "";
  eds.forEach((e) => { const op = gerEl("option", "", e.nome || "—"); op.value = String(e.id); sel.append(op); });
  domEditalId = editalId ? String(editalId) : (eds[0] ? String(eds[0].id) : "");
  sel.value = domEditalId;
  $("domFase").value = "1";
  domPintar();
  dicasDosBotoes({ btnGerDominio: "dom_tip_abrir", btnEdDominio: "dom_tip_abrir", btnDomX: "cov_tip_x", domEdital: "cov_tip_edital", domFase: "cov_tip_fase", btnDomCheia: "dom_cheia_tip" });
  abrirModal("dlgDominio");
  /* aberto pelo toque da pessoa (o navegador só concede a tela cheia dentro de um gesto) */
  domCheiaTrocar(domCheiaPreferida(), false);
}

if (typeof document !== "undefined" && $("dlgDominio")) {
  $("btnGerDominio").onclick = () => domAbrir();
  $("btnEdDominio").onclick = () => domAbrir(editalAtual);
  $("btnDomX").onclick = () => $("dlgDominio").close();
  $("domEdital").onchange = () => { domEditalId = $("domEdital").value; $("domFase").value = "1"; domPintar(); };
  $("domFase").onchange = domPintar;
  ["domAcRisco", "domAcSeguro", "domRtRisco", "domRtSeguro"].forEach((id) => { $(id).onchange = domSalvarCortes; });
  $("btnDomPadrao").onclick = () => { try { localStorage.removeItem(DOM_CH_LIM); } catch (e) {} domPintar(); };
  if ($("btnDomAjuda")) $("btnDomAjuda").onclick = () => domAjudaTrocar();
  if ($("btnDomCheia")) $("btnDomCheia").onclick = () => domCheiaTrocar(undefined, true);
  if ($("dlgDominio").addEventListener) $("dlgDominio").addEventListener("close", () => { if (domCheia) { domCheia = false; $("dlgDominio").classList.remove("dom-cheia"); if (typeof telaCheiaSair === "function") telaCheiaSair("dominio"); } });
  try {
    const mq = window.matchMedia && window.matchMedia("(min-width: " + DOM_LARGO_MIN + "px)");
    if (mq && mq.addEventListener) mq.addEventListener("change", () => { if ($("dlgDominio").open) domPintar(); });
  } catch (e) {}
  [["btnDomAbaPrior", "prior"], ["btnDomAbaDisc", "disc"], ["btnDomAbaEvo", "evo"]].forEach(([id, a]) => { if ($(id)) $(id).onclick = () => domAbaDefinir(a); });
}
