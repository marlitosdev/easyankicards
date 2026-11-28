/* =====================================================================
 * A TELA: "Domínio" (aberta pela biblioteca de cartões e pelo cabeçalho do edital)
 *
 * Manchete + BARRA DE DISTRIBUIÇÃO do peso da prova por nível; uma faixa por disciplina (ordem do peso) dividida em
 * segmentos por tópico; tocar num tópico abre o DETALHE dele (o nível, o MOTIVO, os quatro sinais e os ramos). O ramo
 * com acerto herdado do tópico leva contorno tracejado. Ao lado, "o que reforçar primeiro" (19.193.0: mestre-detalhe).
 * (A regra do nível e os números estão em dominio-assunto.js; aqui só se desenha.)
 * ===================================================================== */
let domEditalId = "", domDiscAberta = "", domFiltro = "todos";
/* (v18.86.0) TRÊS VISÕES em vez de uma rolagem só: o que fazer agora (prioridades), o mapa (disciplinas) e a evolução.
 * A barra do peso por nível fica presa no topo do corpo, à vista nas três. A visão escolhida é lembrada.
 * (19.215.0) O DOMÍNIO É DIAGNÓSTICO: sem escolha lembrada, abre no MAPA (Disciplinas). O que estudar a seguir é da
 * agenda da semana; a fila do reforço continua a um toque, na aba dela. */
const DOM_ABAS = ["prior", "disc", "evo"];
const DOM_CH_ABA = "eac_dom_aba";
const DOM_ABA_PADRAO = "disc";
let domAba = DOM_ABA_PADRAO;
/* (v18.88.0) a barra de cada disciplina: na ordem do edital ou POR COR (vermelho → amarelo → azul → verde → não estudado);
 * tocar num pedaço abre aquele tópico no mapa */
const DOM_CH_ORDEM = "eac_dom_ordem";
const DOM_ORDEM_COR = ["vermelho", "amarelo", "azul", "verde", "cinza", "pulado"];
function domOrdemLer() { try { return localStorage.getItem(DOM_CH_ORDEM) === "cor" ? "cor" : "edital"; } catch (e) { return "edital"; } }
function domOrdemDefinir(o) { try { localStorage.setItem(DOM_CH_ORDEM, o === "cor" ? "cor" : "edital"); } catch (e) {} domPintar(); }
/* (19.193.0) IR A UM TÓPICO (o pedaço da barra, a linha do mapa, o selo da agenda, o próximo passo): ele vira o
 * escolhido e o DETALHE dele aparece (na tela estreita, no lugar da lista; o "← Voltar" leva de volta), piscando; a
 * disciplina fica aberta no mapa */
function domIrAoTopico(disciplina, chave) {
  domDiscAberta = disciplina || "";
  if (!domDuas() && domAba === "evo") domAbaDefinir("disc", true);
  if (chave) { domSel = { chave, ramoId: "" }; domSelAuto = false; }
  domDetAberto = !!(chave && !domDuas());
  if (domDetAberto) { try { domRolagemLista = $("domCorpo").scrollTop || 0; } catch (e) {} }
  domPintar();
  const el = domCtx && domCtx.detEl;
  if (el) {
    try { if (domDuas()) domCtx.pDet.scrollTop = 0; else $("domCorpo").scrollTop = 0; } catch (e) {}
    el.classList.add("dom-piscando");
    setTimeout(() => { try { el.classList.remove("dom-piscando"); } catch (e) {} }, 2600);
    /* na tela larga, o tópico também fica à vista no mapa */
    const tl = domCtx.tls[chave];
    if (tl && domDuas()) { try { if (tl.scrollIntoView) tl.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  }
  return el;
}
function domAbaLer() { try { const v = localStorage.getItem(DOM_CH_ABA); return DOM_ABAS.indexOf(v) >= 0 ? v : DOM_ABA_PADRAO; } catch (e) { return DOM_ABA_PADRAO; } }
function domAbaDefinir(a, calado) {
  domAba = DOM_ABAS.indexOf(a) >= 0 ? a : "prior";
  /* trocar de aba fecha o detalhe (na tela estreita ele ocupa o lugar da lista) */
  domDetAberto = false;
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
/* (19.193.0) todas as cores (os chips são também a legenda) e a revisão vencida; os vazios não aparecem */
const DOM_FILTROS = ["todos", "vermelho", "vencida", "amarelo", "azul", "verde", "cinza"];

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
    domFechar();
    abrirRegistro(it, ramoId ? { ramo: ramoId } : undefined);
  };
  pai.append(rg);
}

function domMotivoTxt(m) {
  return t("dom_m_" + m.cod, { pct: m.pct, n: m.n, dias: m.dias === null || m.dias === undefined ? "?" : m.dias, ed: m.ed || "?" });
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
  if (a && a.chutes) chip(t("dom_ac_chutes", { n: a.chutes, p: Math.round(a.pctSemChute) }), "dom-chip-chute", t("dom_ac_chutes_tip"));
  const fr = domFragil(f);
  if (fr) chip(t("dom_fragil_" + fr), "dom-chip-fragil", t("dom_fragil_tip"));
  const r = s.retencao;
  chip(r && r.valido ? t("dom_rt", { p: Math.round(r.pct), n: r.respostas }) : t("dom_rt_sem"), r && r.valido ? "" : "dom-chip-fraco");
  const au = s.auto;
  if (au && au.nivel && au.nivel !== "media") chip(t(au.nivel === "alta" ? "dom_auto_alta" : "dom_auto_baixa") + (au.vencida ? " · " + t("dom_auto_venc") : ""), au.vencida ? "dom-chip-fraco" : "");
}

/* (v18.87.0) VERDE FRÁGIL: verde, mas com pouca prova — o acerto da janela dependeu de chute, ou a única medida é a
 * amostra mínima (menos de 8 questões, sem cartões que contem; ou menos de 15 respostas de cartões, sem questões). */
const DOM_FRAGIL = { questoes: 8, respostas: 15 };
function domFragil(f) {
  if (!f || f.nivel !== "verde" || !f.sinais) return "";
  const a = f.sinais.acerto, r = f.sinais.retencao;
  const ac = a && a.valido, rt = r && r.valido;
  if (ac && a.chutes) return "chute";
  if (ac && !rt && a.n < DOM_FRAGIL.questoes) return "amostra";
  if (rt && !ac && r.respostas < DOM_FRAGIL.respostas) return "amostra";
  return "";
}
/* o material que o tópico já tem, em selos (para saber se dá para começar agora ou se é preciso preparar antes) */
function domMaterialDe(disciplina, topico, chave) {
  let x = null;
  try { x = (typeof matObter === "function" && matObter(chave)) || null; } catch (e) { x = null; }
  const base = Object.assign({ chave, disciplina, topico, texto: "", cartoes: "" }, x || {});
  let inf = { temR: false, nCart: 0, temL: false, nJul: 0 };
  try { if (typeof matInfoTopico === "function") inf = matInfoTopico(base); } catch (e) {}
  let nQs = 0;
  try { nQs = typeof qsFiltrar === "function" ? qsFiltrar({ chave }).length : 0; } catch (e) { nQs = 0; }
  return { resumo: !!inf.temR, cartoes: inf.nCart || 0, lei: !!inf.temL, julgados: inf.nJul || 0, questoes: nQs,
    vazio: !inf.temR && !inf.nCart && !inf.temL && !inf.nJul && !nQs };
}
/* a ação que mais ajuda na cor: errou → refazer as erradas; estudou e não mediu → medir com questões (ou criá-las);
 * não estudou → o material do tópico (começar por ele, ou preparar o que falta). Devolve { txt, tip, fazer }. */
function domAcaoPrincipal(f, mat, ramos) {
  const ramo = f.tipo === "ramo" ? { id: f.ramoId, nome: f.ramoNome } : null;
  let erradas = [];
  try { erradas = typeof qsFiltrar === "function" ? qsFiltrar(Object.assign({ chave: f.chave, soErradas: true }, ramo ? { ramo: ramo.id } : {})) : []; } catch (e) { erradas = []; }
  /* o ramo HERDA o acerto do tópico: sem erradas ligadas ao ramo, valem as do tópico (são elas que dão a cor) */
  if (ramo && !erradas.length) { try { erradas = qsFiltrar({ chave: f.chave, soErradas: true }); } catch (e) { erradas = []; } }
  const ficha = () => { domFechar(); edAbrirFicha(f.disciplina, f.topico, { ramos, ramo: ramo ? ramo.id : "", editalId: domEditalId }); };
  if ((f.nivel === "vermelho" || f.nivel === "amarelo") && erradas.length) {
    return { cod: "erradas", txt: t("dom_ac1_erradas", { n: erradas.length }), tip: t("dom_ac1_erradas_tip"),
      fazer: () => { domFechar(); qsUiResponderAbrir(erradas, null, "dominio-erradas:" + f.chave + (ramo ? "#" + ramo.id : "")); } };
  }
  if (f.nivel === "azul") {
    return { cod: mat.questoes ? "medir" : "criar_qs", txt: mat.questoes ? t("dom_ac1_medir", { n: mat.questoes }) : t("dom_ac1_criar_qs"), tip: t("dom_ac1_medir_tip"),
      fazer: () => { domFechar(); qsUiResponderDireto(f.disciplina, f.topico, ramo); } };
  }
  if (f.nivel === "cinza") {
    return { cod: mat.vazio ? "preparar" : "comecar", txt: t(mat.vazio ? "dom_ac1_preparar" : "dom_ac1_comecar"), tip: t("dom_ac1_ficha_tip"), fazer: ficha };
  }
  return { cod: "rever", txt: t("dom_ac1_rever"), tip: t("dom_ac1_ficha_tip"), fazer: ficha };
}
/* (v18.89.0) A FILA AGRUPADA POR TÓPICO. Cada ramo entrava sozinho, com só uma FATIA do peso do tópico — e por isso
 * quase nunca chegava entre os primeiros, mesmo quando o tópico inteiro precisava de reforço. Agrupados, os ramos do
 * mesmo tópico viram UM item: o peso e a urgência são a soma dos deles (o tópico inteiro, como os sem ramos), a cor e
 * o motivo são os do ramo mais fraco, e o item diz quais ramos estão na fila. "Um por um" volta ao jeito antigo. */
const DOM_CH_AGRUPAR = "eac_dom_agrupar";
function domAgruparLer() { try { return localStorage.getItem(DOM_CH_AGRUPAR) !== "0"; } catch (e) { return true; } }
function domAgruparDefinir(sim) { try { localStorage.setItem(DOM_CH_AGRUPAR, sim ? "1" : "0"); } catch (e) {} if ($("dlgDominio") && $("dlgDominio").open) domPintar(); }
function domFilaAgrupada(fila) {
  const grupos = {};
  const out = [];
  (fila || []).forEach((f) => {
    if (f.tipo !== "ramo") { out.push(f); return; }
    let g = grupos[f.chave];
    if (!g) {
      g = grupos[f.chave] = { tipo: "grupo", disciplina: f.disciplina, topico: f.topico, chave: f.chave, cartoes: f.cartoes,
        pesoPct: 0, urgencia: 0, ramosFila: [], nivel: f.nivel, motivos: f.motivos, sinais: f.sinais, pior: f };
      out.push(g);
    }
    g.pesoPct += f.pesoPct || 0;
    g.urgencia += f.urgencia || 0;
    g.ramosFila.push(f);
    if (DOM_NIVEIS.indexOf(f.nivel) < DOM_NIVEIS.indexOf(g.nivel)) { g.nivel = f.nivel; g.motivos = f.motivos; g.sinais = f.sinais; g.pior = f; }
  });
  return out.sort((a, b) => (b.urgencia - a.urgencia) || (b.pesoPct - a.pesoPct));
}
/* (19.191.0) UMA RESPOSTA SÓ PARA "O QUE ESTUDO AGORA?". O "o que reforçar primeiro" do Domínio ordenava só por
 * peso × cor, e a fila "O que estudar agora" do Painel do edital junta também o risco de corte e o tempo: duas listas
 * diferentes para a mesma pergunta. Agora, com o mesmo edital (o aberto) e a mesma fase, o Domínio segue a ORDEM da fila
 * do Painel (a mesma conta, no mesmo período escolhido lá) e continua desenhando os itens dele (os ramos, os sinais, as
 * ações). Fora disso (outro edital, outra fase), fica a ordem por peso × cor, como antes, e a nota diz qual vale.
 * Devolve Map chave do tópico → posição na fila do Painel, ou null quando não se aplica. */
function domRankPainel(ed, fase) {
  try {
    if (!ed || typeof peDados !== "function" || typeof peFonte !== "function") return null;
    if (typeof editalAtual === "undefined" || String(editalAtual) !== String(ed.id)) return null;
    const fonte = peFonte();
    if (!fonte || !fonte.plano) return null;
    const faseP = fonte.plano.fase && fonte.plano.fase.n === 2 ? 2 : 1;
    if (faseP !== (fase || 1)) return null;
    const per = typeof pePeriodo !== "undefined" ? pePeriodo : "14";
    const dd = peDados(fonte, { periodo: per });
    const rank = new Map();
    (dd.fila || []).forEach((x, i) => { if (x && x.tp && !rank.has(x.tp.chave)) rank.set(x.tp.chave, i); });
    return rank.size ? rank : null;
  } catch (e) { return null; }
}
/* a fila do Domínio na ordem do Painel: os tópicos que a fila do Painel tem, na posição dela; os outros depois, na ordem
 * de antes (a ordenação é estável) */
function domOrdenarPeloPainel(fila, rank) {
  if (!rank) return fila;
  return (fila || []).map((f, i) => ({ f, i, r: rank.has(f.chave) ? rank.get(f.chave) : Infinity }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i)).map((x) => x.f);
}
/* UM ITEM DA FILA: o que é, o porquê, os sinais (com os chutes), os ramos do tópico coloridos, o material e as ações
 * (a principal, conforme a cor, primeiro) */
function domItemFila(f, tp, semRamos) {
  const nv = domNv(f.nivel);
  const l = gerEl("div", "cov-item dom-item dom-b-" + nv);
  l.append(gerEl("span", "dom-nivel dom-n-" + nv, domNivelTxt(f.nivel)),
    gerEl("span", "cov-item-nome", f.disciplina + " › " + f.topico + (f.ramoNome ? " › " + f.ramoNome : "")),
    /* fora da fila (verde, pulado: aberto pelo mapa ou pela busca) não há a conta da urgência, só o peso */
    gerEl("span", "cov-item-n", f.foraDaFila ? t("cov_vale", { p: pctProva(f.pesoPct || 0) }) : f.tipo === "grupo" ? t("dom_urg_grupo", { p: f.pesoPct.toFixed(1), f: f.pesoPct ? Math.round((f.urgencia / f.pesoPct) * 10) / 10 : 0, n: f.ramosFila.length }) : t("dom_urg", { p: f.pesoPct.toFixed(1), f: DOM.fatores[f.nivel] })));
  /* o PORQUÊ à vista (antes, só no balão do mouse), antes dos botões: primeiro o motivo, depois o que fazer */
  const pq = domPorque(f.motivos);
  const pqTxt = f.tipo === "grupo" && f.ramosFila.length > 1 ? t("dom_grupo_pior", { r: f.pior.ramoNome }) + (pq ? " · " + pq : "") : pq;
  if (pqTxt) { l.title = pqTxt; l.append(gerEl("div", "dom-porque dom-item-porque", pqTxt)); }
  if (f.sinais) { const ch = gerEl("div", "dom-chips dom-item-linha"); domChips(ch, f); l.append(ch); }
  /* os ramos do tópico, cada um com a sua cor: qual parte puxa o tópico para baixo, e um toque leva ao ramo */
  const ramosDoTop = (tp && tp.ramos) || [];
  const ramosFicha = ramosDoTop.map((r) => ({ id: r.ramoId, nome: r.ramoNome }));
  /* vários ramos do MESMO tópico na fila: a lista de ramos só no primeiro deles (repetida, vira ruído) */
  if (ramosDoTop.length && !semRamos) {
    const rl = gerEl("div", "dom-item-ramos dom-item-linha");
    rl.append(gerEl("span", "dom-item-rot", t("dom_item_ramos")));
    ramosDoTop.forEach((r) => {
      const nv = r.nivel === "pulado" ? "cinza" : r.nivel;
      const naFila = f.tipo === "grupo" && f.ramosFila.some((x) => x.ramoId === r.ramoId);
      const b = gerEl("button", "dom-ramo-chip dom-b-" + nv + ((f.tipo === "ramo" && r.ramoId === f.ramoId) || (f.tipo === "grupo" && f.pior && r.ramoId === f.pior.ramoId) ? " atual" : "") + (naFila ? " na-fila" : "") + (r.pulado ? " hor-ramo-pulado" : ""));
      b.append(gerEl("i", "dom-leg-i dom-n-" + nv), document.createTextNode(r.ramoNome));
      b.type = "button";
      b.title = t("dom_ramo_chip_tip", { r: r.ramoNome, n: r.nivel === "pulado" ? "—" : t("dom_n_" + r.nivel) }) + (domPorque(r.motivos) ? " · " + domPorque(r.motivos) : "");
      b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); domFechar(); edAbrirFicha(f.disciplina, f.topico, { ramos: ramosFicha, ramo: r.ramoId, editalId: domEditalId }); };
      rl.append(b);
    });
    l.append(rl);
  }
  /* o material que já existe (ou o aviso de que não há nada) */
  const mat = domMaterialDe(f.disciplina, f.topico, f.chave);
  const ml = gerEl("div", "dom-item-mat dom-item-linha");
  ml.append(gerEl("span", "dom-item-rot", t("dom_item_mat")));
  if (mat.vazio) ml.append(gerEl("span", "dom-mat-falta", t("dom_mat_nada")));
  else {
    if (mat.resumo) ml.append(gerEl("span", "dom-mat", "📄 " + t("dom_mat_resumo")));
    if (mat.cartoes) ml.append(gerEl("span", "dom-mat", "🃏 " + mat.cartoes));
    if (mat.lei) ml.append(gerEl("span", "dom-mat", "§ " + t("dom_mat_lei")));
    if (mat.julgados) ml.append(gerEl("span", "dom-mat", "⚖ " + mat.julgados));
    if (mat.questoes) ml.append(gerEl("span", "dom-mat", "❓ " + mat.questoes));
    if (!mat.resumo) ml.append(gerEl("span", "dom-mat-falta", t("dom_mat_sem_resumo")));
  }
  l.append(ml);
  /* as ações: a principal (conforme a cor) primeiro, depois as de sempre */
  const ac1 = domAcaoPrincipal(f, mat, ramosFicha);
  const linhaAc = gerEl("div", "dom-item-acoes dom-item-linha");
  const p = gerEl("button", "btn-min dom-acao-1 dom-acao-" + ac1.cod, ac1.txt); p.type = "button"; p.title = ac1.tip;
  p.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); ac1.fazer(); };
  /* (19.215.0) UMA AÇÃO À VISTA: a que mais ajuda na cor; abrir, cartões, questões e registrar ficam no "⋯" (como na
   * linha da fila). Eram cinco botões lado a lado no detalhe, competindo com a agenda. */
  const mais = gerEl("button", "btn-min dom-mais", "⋯"); mais.type = "button";
  mais.title = t("dom_mais_tip"); mais.setAttribute("aria-label", t("dom_mais_tip")); mais.setAttribute("aria-expanded", "false");
  const menu = gerEl("div", "dom-linha-menu dom-det-menu"); menu.hidden = true;
  domLinhaAcoes(menu, f.disciplina, f.topico, f.cartoes, f.tipo === "ramo" ? { id: f.ramoId, nome: f.ramoNome } : null);
  menu.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
  mais.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); domMenuTrocar(menu, mais); };
  linhaAc.append(p, mais, menu);
  l.append(linhaAc);
  return l;
}

function domLinhaAcoes(pai, disciplina, topico, cartoes, ramo) {
  const ac = gerEl("span", "cov-acoes");
  const ab = gerEl("button", "btn-min", t("cov_abrir")); ab.type = "button";
  ab.onclick = () => { domFechar(); gerAbrirNoTopico(disciplina, topico); };
  ac.append(ab);
  const go = gerEl("button", "btn-min btn-min-ok", cartoes ? t("hor_estudar", { n: cartoes }) : t("hor_criar")); go.type = "button";
  go.onclick = () => { domFechar(); if (cartoes) estcEstudarTopico(disciplina, topico); else bancAlvoDefinir(disciplina, topico); };
  ac.append(go);
  const qu = gerEl("button", "btn-min", t("dom_questoes")); qu.type = "button";
  qu.onclick = () => { domFechar(); qsUiResponderDireto(disciplina, topico, ramo || undefined); };
  ac.append(qu);
  domBotaoRegistrar(ac, disciplina, topico, ramo ? ramo.id : "");
  pai.append(ac);
}

/* =====================================================================
 * (19.193.0) A NAVEGAÇÃO MESTRE-DETALHE
 *
 * A fila e o mapa traziam TUDO de cada item à vista (os sinais, os ramos, o material e cinco botões), e decidir o
 * próximo assunto pedia rolar por cartões enormes. Agora:
 *  - a FILA é uma lista compacta: uma linha por item (a posição, a cor na borda, o nome, o porquê curto e o peso), só a
 *    ação principal à vista e o resto no "⋯"; tocar na linha abre o DETALHE (tudo o que o cartão tinha, a minha
 *    avaliação e os ramos);
 *  - o MAPA é a visão geral: uma linha por disciplina (o nome e o peso · a barra dos tópicos · o verde e a mudança).
 *    O pedaço diz mais do que a cor: o NÚMERO da posição na fila (os 5 primeiros), LISTRAS para medida incerta, um RISCO
 *    no alto para revisão vencida e uma FAIXA FINA embaixo com as cores dos ramos; o balão diz o tópico, o motivo e os
 *    ramos; tocar (ou Enter) abre o detalhe; ←→ andam na barra, ↑↓ trocam de disciplina. Os ramos moram no detalhe;
 *  - tela larga: o mapa em cima e a fila embaixo, à esquerda; o detalhe à direita. Tela estreita: lista → detalhe, com
 *    "← Voltar" (e o Esc), e ‹ › para passar ao vizinho da fila;
 *  - a BUSCA procura em todos os tópicos e ramos (não só nos da fila); os FILTROS acendem no mapa o que casa e apagam o
 *    resto, sem esconder nada (na fila, recortam); teclado: ↑↓ andam na fila, Enter abre, Esc volta, "/" vai à busca.
 * ===================================================================== */
const DOM_LINHAS = 20;
/* (19.215.0) ONDE O TÓPICO ESTÁ NA AGENDA DA SEMANA. O Domínio mostrava "nº 1 de 126 na fila do que reforçar" e o
 * número no pedaço do mapa: uma segunda lista de tarefas, com outra ordem, ao lado da agenda. Agora ele diz o que a
 * AGENDA diz. A lista vem da última pintura da agenda (hubUltimaAgenda), sem recalcular: o plano da agenda usa a meta,
 * o ritmo real e a reserva da discursiva, que o Domínio não conhece — uma conta própria daria outra semana.
 * Devolve { mapa: chave → { pos, n, hoje }, n } do edital, ou null se ele não está na agenda (ou não há agenda). */
function domAgendaDoEdital(edId) {
  let a = null;
  try {
    if (typeof hubUltimaAgenda !== "undefined") {
      if (!hubUltimaAgenda && typeof hubPintarAgenda === "function") { try { hubPintarAgenda(); } catch (e) {} }
      a = hubUltimaAgenda;
    }
  } catch (e) { a = null; }
  const ed = String(edId || "");
  if (!a || !Array.isArray(a.itens) || !Array.isArray(a.editais) || a.editais.indexOf(ed) < 0) return null;
  const mapa = new Map();
  const n = a.itens.length, nHoje = a.nHoje || 0;
  a.itens.forEach((x, i) => {
    /* a linha fundida de dois editais vinculados vale para os dois */
    [x].concat(x.tambem || []).forEach((y) => {
      if (String(y.edital) !== ed) return;
      const info = { pos: i + 1, n, hoje: i < nHoje };
      [y.chave, (y.disciplina || "") + "\u0001" + (y.nome || "")].forEach((k) => { if (k && !mapa.has(k)) mapa.set(k, info); });
    });
  });
  return { mapa, n };
}
/* o tópico na agenda: { pos, n, hoje }; { fora: true } quando o edital está na agenda e o tópico não; null sem agenda */
function domNaAgenda(ag, disciplina, tp) {
  if (!ag || !tp) return null;
  return ag.mapa.get(tp.chave) || ag.mapa.get(String(disciplina || "") + "\u0001" + (tp.nome || "")) || { fora: true };
}
function domAgendaTxt(x) {
  if (!x) return "";
  return x.fora ? t("dom_det_ag_fora") : t(x.hoje ? "dom_det_ag_hoje" : "dom_det_ag_semana", { i: x.pos, n: x.n });
}
let domSel = null, domSelAuto = false, domDetAberto = false, domBusca = "", domLimite = DOM_LINHAS;
let domCtx = null, domMenu = null, domRolagemLista = 0, domEscTratado = 0, domBuscaT = null, domBalaoEl = null;

function domNorm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ +/g, " ").trim(); }
function domSelK(s) { return s && s.chave ? s.chave + "|" + (s.ramoId || "") : ""; }
function domNv(n) { return n === "pulado" || !n ? "cinza" : n; }
function domNivelTxt(n) { return n === "pulado" ? "—" : t("dom_n_" + n); }
/* o tópico passa pelo filtro (com ramos: algum ramo passa) */
function domCasaTopico(tp) { return tp.ramos && tp.ramos.length ? tp.ramos.some(domCasa) : domCasa(tp); }
/* o tópico casa com a busca? cada palavra tem de aparecer no nome da disciplina, do tópico ou de um ramo */
function domBuscaCasa(d, tp) {
  const q = domNorm(domBusca);
  if (!q) return true;
  const alvo = domNorm([d && d.nome, tp && tp.nome].concat(((tp && tp.ramos) || []).map((r) => r.ramoNome)).join(" "));
  return q.split(" ").every((p) => alvo.indexOf(p) >= 0);
}
/* um item "de fila" montado do próprio tópico: o que está fora da fila (verde, pulado) também aparece na busca e no detalhe */
function domItemDoTopico(d, tp) {
  const pior = tp.ramos && tp.ramos.length ? (tp.ramos.filter((r) => r.nivel === tp.nivel)[0] || tp.ramos[0]) : null;
  return { tipo: "topico", disciplina: d.nome, topico: tp.nome, chave: tp.chave, cartoes: tp.cartoes, nivel: tp.nivel,
    motivos: tp.motivos || (pior && pior.motivos) || [], sinais: tp.sinais || (pior && pior.sinais) || null, pesoPct: tp.pesoPct || 0, urgencia: 0, foraDaFila: true };
}
/* o primeiro descendente com a classe (o DOM de teste não tem querySelector) */
function domAchar(el, c) {
  if (!el) return null;
  const filhos = Array.from(el.children || []);
  for (let i = 0; i < filhos.length; i++) {
    if ((" " + String(filhos[i].className || "") + " ").indexOf(" " + c + " ") >= 0) return filhos[i];
    const x = domAchar(filhos[i], c);
    if (x) return x;
  }
  return null;
}
/* o que o pedaço do tópico mostra além da cor */
function domMarcasDoTopico(tp) {
  const folhas = tp.ramos && tp.ramos.length ? tp.ramos.filter((r) => !r.pulado) : [tp];
  const venc = folhas.some((x) => (x.motivos || []).some((mm) => mm.cod === "revisao_vencida"));
  const incerto = tp.nivel === "azul" || (tp.nivel === "verde" && folhas.some((x) => !!domFragil(x)));
  const cores = tp.ramos && tp.ramos.length > 1 ? tp.ramos.map((r) => domNv(r.nivel)) : [];
  return { venc, incerto, mistos: cores.length > 1 && cores.some((x) => x !== cores[0]) };
}
/* o texto do balão do pedaço (uma linha por item) */
function domSegLinhas(d, tp, agTxt, pq) {
  const out = [d.nome + " › " + tp.nome];
  out.push(domNivelTxt(tp.nivel) + " · " + t("cov_vale", { p: pctProva(tp.pesoPct || 0) }));
  if (pq) out.push(pq);
  if (agTxt) out.push(agTxt);
  if (tp.ramos && tp.ramos.length) {
    const cont = {}, ordem = [];
    tp.ramos.forEach((r) => { const k = r.nivel === "pulado" ? t("dom_n_pulado") : t("dom_n_" + r.nivel); if (!cont[k]) { cont[k] = 0; ordem.push(k); } cont[k]++; });
    out.push(t("dom_seg_ramos", { r: ordem.map((k) => cont[k] + " " + k).join(", ") }));
  }
  out.push(t("dom_seg_abrir"));
  return out;
}
/* o balão do pedaço: ao passar o mouse ou focar (o title do navegador não aparece no toque nem no teclado) */
function domSegBalao(seg, linhas) {
  domSegBalaoFechar();
  const dlg = $("dlgDominio");
  if (!dlg || !seg) return null;
  const b = document.createElement("div");
  b.className = "dom-seg-balao";
  b.setAttribute("role", "tooltip");
  (linhas || []).forEach((l, i) => b.append(gerEl("div", i === 0 ? "dom-balao-tit" : (i === linhas.length - 1 ? "dom-balao-pe" : "dom-balao-l"), l)));
  /* dentro do diálogo: ele mora na camada de cima do navegador, e o balão tem de entrar junto */
  dlg.append(b);
  domBalaoEl = b;
  try {
    const r = seg.getBoundingClientRect ? seg.getBoundingClientRect() : null;
    if (r) {
      const jan = (typeof window !== "undefined" && window.innerWidth) || 360;
      const alto = (typeof window !== "undefined" && window.innerHeight) || 800;
      const larg = Math.min(300, jan - 16), h = b.offsetHeight || 96;
      b.style.left = Math.max(8, Math.min(r.left + r.width / 2 - larg / 2, jan - larg - 8)) + "px";
      b.style.top = (r.bottom + 8 + h > alto ? Math.max(8, r.top - 8 - h) : r.bottom + 8) + "px";
    }
  } catch (e) {}
  return b;
}
function domSegBalaoFechar() {
  try { if (domBalaoEl && domBalaoEl.parentNode) domBalaoEl.parentNode.removeChild(domBalaoEl); } catch (e) {}
  domBalaoEl = null;
}
/* a amostra da legenda "como ler a barra" */
function domLegAmostra(cor, cls, txt, chave) {
  const it = gerEl("span", "dom-leg-item");
  it.title = t(chave + "_tip");
  const a = gerEl("span", "dom-leg-amostra dom-n-" + cor + (cls ? " " + cls : ""), txt || "");
  if (cls === "dom-seg-mistos") { const sub = gerEl("span", "dom-seg-sub"); sub.append(gerEl("i", "dom-n-vermelho"), gerEl("i", "dom-n-cinza"), gerEl("i", "dom-n-verde")); a.append(sub); }
  it.append(a, document.createTextNode(" " + t(chave)));
  return it;
}

/* UMA LINHA DA FILA (compacta): a posição, a cor (na borda), o nome, o nível com o porquê curto e o peso; a ação
 * principal e o "⋯" com as outras. Tocar na linha abre o detalhe. */
function domLinhaFila(f, i, tp) {
  const nv = domNv(f.nivel);
  const sel = { chave: f.chave, ramoId: f.tipo === "ramo" ? f.ramoId : "" };
  const l = gerEl("div", "dom-linha dom-b-" + nv + (f.foraDaFila ? " dom-linha-fora" : ""));
  l.tabIndex = 0;
  l.setAttribute("aria-current", "false");
  const txt = gerEl("span", "dom-linha-txt");
  txt.append(gerEl("span", "dom-linha-nome", f.disciplina + " › " + f.topico + (f.ramoNome ? " › " + f.ramoNome : "")));
  const pq = domPorque(f.motivos);
  const pqTxt = f.tipo === "grupo" && f.ramosFila.length > 1 ? t("dom_grupo_pior", { r: f.pior.ramoNome }) + (pq ? " · " + pq : "") : pq;
  txt.append(gerEl("span", "dom-linha-pq", domNivelTxt(f.nivel) + (pqTxt ? " · " + pqTxt : "")));
  const peso = gerEl("span", "dom-linha-peso", pctProva(f.pesoPct || 0) + "%");
  peso.title = t("cov_vale", { p: pctProva(f.pesoPct || 0) });
  const mat = domMaterialDe(f.disciplina, f.topico, f.chave);
  const ramosFicha = ((tp && tp.ramos) || []).map((r) => ({ id: r.ramoId, nome: r.ramoNome }));
  const ac1 = domAcaoPrincipal(f, mat, ramosFicha);
  const p = gerEl("button", "btn-min dom-acao-1 dom-acao-" + ac1.cod, ac1.txt); p.type = "button"; p.title = ac1.tip;
  p.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); ac1.fazer(); };
  const mais = gerEl("button", "btn-min dom-mais", "⋯"); mais.type = "button";
  mais.title = t("dom_mais_tip"); mais.setAttribute("aria-label", t("dom_mais_tip")); mais.setAttribute("aria-expanded", "false");
  const menu = gerEl("div", "dom-linha-menu"); menu.hidden = true;
  domLinhaAcoes(menu, f.disciplina, f.topico, f.cartoes, f.tipo === "ramo" ? { id: f.ramoId, nome: f.ramoNome } : null);
  menu.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
  mais.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); domMenuTrocar(menu, mais); };
  l.append(gerEl("span", "dom-linha-pos", i >= 0 ? String(i + 1) : "·"), txt, peso, p, mais, menu);
  l.onclick = () => domSelecionar(sel, true);
  return { el: l, sel, k: domSelK(sel), chave: f.chave };
}
/* o "⋯": um aberto por vez */
function domMenuTrocar(menu, bt) {
  const abrir = !!menu.hidden;
  if (domMenu && domMenu.menu !== menu) { domMenu.menu.hidden = true; domMenu.bt.setAttribute("aria-expanded", "false"); }
  menu.hidden = !abrir;
  bt.setAttribute("aria-expanded", abrir ? "true" : "false");
  domMenu = abrir ? { menu, bt } : null;
  return abrir;
}

function domPintar() {
  const cx = $("domCorpo");
  cx.innerHTML = "";
  domCtx = null; domMenu = null;
  domSegBalaoFechar();
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
  /* ---- o topo: a manchete e a barra do peso por nível NUMA LINHA; a legenda das cores são os próprios filtros ---- */
  const fixo = gerEl("div", "dom-fixo");
  const vencidas = m.folhas.filter((x) => (x.motivos || []).some((mm) => mm.cod === "revisao_vencida")).length;
  /* VERMELHO SÓ PARA O QUE ESTÁ RUIM: muito ainda não estudado é o começo natural de um edital, não um erro */
  const tom = (dist.vermelho > 0 || vencidas) ? " cov-manchete-alerta" : (pct("cinza") >= 20 ? " dom-manchete-info" : "");
  const man = gerEl("div", "cov-manchete dom-manchete" + tom);
  man.append(gerEl("b", "", t("dom_manchete", { s: Math.round(pct("cinza")), v: Math.round(pct("vermelho")) })));
  if (vencidas) man.append(document.createTextNode(" " + t("dom_manchete_venc", { n: vencidas })));
  /* a barra de distribuição: o peso da prova por nível; tocar numa cor acende só ela (o mesmo que o filtro) */
  const barra = gerEl("div", "dom-dist");
  const corFiltro = ["verde", "amarelo", "azul", "vermelho", "cinza"].indexOf(domFiltro) >= 0;
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    const p = pct(k);
    if (p <= 0) return;
    const seg = gerEl("div", "dom-seg dom-n-" + k + (corFiltro && domFiltro !== k ? " dom-apagado" : ""), p >= 7 ? Math.round(p) + "%" : "");
    seg.style.width = p.toFixed(2) + "%";
    seg.title = t("dom_n_" + k) + ": " + p.toFixed(1) + "% " + t("dom_do_peso") + " — " + t(domFiltro === k ? "dom_dist_tip_off" : "dom_dist_tip");
    seg.onclick = () => domFiltroDefinir(domFiltro === k ? "todos" : k);
    barra.append(seg);
  });
  fixo.append(man, barra);
  cx.append(fixo);
  const duas = domDuas();
  const painel = (aba) => { const p = gerEl("div", "dom-painel dom-painel-" + aba); cx.append(p); return p; };
  const pDisc = painel("disc"), pPrior = painel("prior"), pDet = painel("det"), pEvo = painel("evo");
  const c = domCtx = { m, ed, fase, fixo, pDisc, pPrior, pDet, pEvo, linhas: [], segs: {}, tls: {}, tiras: [],
    topPorChave: Object.create(null), discDoTop: Object.create(null), filaTudo: [], posFila: Object.create(null), nFila: 0, detEl: null,
    agenda: domAgendaDoEdital(ed.id) };
  domPintarLegenda();
  m.disciplinas.forEach((d) => d.topicos.forEach((tp) => { c.topPorChave[tp.chave] = tp; c.discDoTop[tp.chave] = d; }));
  if (domSel && !c.topPorChave[domSel.chave]) { domSel = null; domSelAuto = false; domDetAberto = false; }
  /* ---- evolução (calculada sempre: a diferença de cada disciplina aparece no mapa) ---- */
  const dlt = domEvolucaoPintar(pEvo, m, ed.id, fase);
  pEvo.append(gerEl("p", "nota cov-base", t(m.base === "questoes" ? "dom_base_questoes" : (m.base === "fase2" ? "cov_base_fase2" : (m.base === "plano" ? "dom_base_plano" : "dom_base_estimado")))));
  /* ---- a fila: o que reforçar primeiro (com o filtro escolhido) ---- */
  const agrupar = domAgruparLer();
  const rankP = domRankPainel(ed, fase);
  const filaFolhas = m.reforcar.filter(domCasa);
  const fila = domOrdenarPeloPainel(agrupar ? domFilaAgrupada(filaFolhas) : filaFolhas, rankP);
  /* a fila inteira (sem o filtro): a posição de cada TÓPICO nela vai para o número no mapa e para o detalhe */
  c.filaTudo = domFiltro === "todos" ? fila : domOrdenarPeloPainel(agrupar ? domFilaAgrupada(m.reforcar) : m.reforcar, rankP);
  c.filaTudo.forEach((f) => { if (!c.posFila[f.chave]) c.posFila[f.chave] = ++c.nFila; });
  /* com busca ou filtro, a lista mostra TODOS os tópicos que casam: os da fila primeiro, na ordem dela; os outros
   * (verdes, por exemplo) depois, pelo peso */
  let lista = fila;
  if (domBusca || domFiltro !== "todos") {
    if (domBusca) lista = fila.filter((f) => domBuscaCasa(c.discDoTop[f.chave], c.topPorChave[f.chave]));
    const ja = Object.create(null);
    lista.forEach((f) => { ja[f.chave] = 1; });
    const outros = [];
    m.disciplinas.forEach((d) => d.topicos.forEach((tp) => { if (!ja[tp.chave] && tp.nivel !== "pulado" && domCasaTopico(tp) && domBuscaCasa(d, tp)) outros.push(domItemDoTopico(d, tp)); }));
    lista = lista.concat(outros.sort((a, b) => b.pesoPct - a.pesoPct));
  }
  const posItem = new Map();
  fila.forEach((f, i) => posItem.set(f, i));
  /* o cabeçalho da fila em DUAS linhas curtas (a fila é o que decide a próxima sessão: o espaço é dela): o título com
   * "agrupar por tópico | um por um"; a ordem em uso (com o Painel) e o ganho dos 5 primeiros — o texto inteiro no balão */
  const s = gerEl("div", "cov-bloco dom-lista-bloco");
  const cabL = gerEl("div", "dom-lista-cab");
  cabL.append(gerEl("h4", "", domBusca ? t("dom_busca_tit", { n: lista.length }) : t("dom_reforcar")));
  if (!domBusca && filaFolhas.some((f) => f.tipo === "ramo")) {
    const lg = gerEl("div", "dom-ordem dom-agrupar");
    lg.append(gerEl("span", "dom-item-rot", t("dom_agrupar_rot")));
    [[true, "dom_agrupar_sim"], [false, "dom_agrupar_nao"]].forEach(([v, k]) => {
      const b = gerEl("button", "dom-filtro dom-agrupar-b" + (agrupar === v ? " ativa" : ""), t(k)); b.type = "button";
      b.setAttribute("aria-pressed", agrupar === v ? "true" : "false");
      b.onclick = () => domAgruparDefinir(v);
      lg.append(b);
    });
    cabL.append(lg);
  }
  s.append(cabL);
  if (!domBusca) {
    const sub = gerEl("div", "dom-lista-sub");
    /* (19.191.0) com a ordem do Painel em uso, a nota diz isso e leva ao Painel; senão, a de antes (só peso × cor) */
    const notaOrdem = gerEl("p", "nota dom-ordem-painel", t(rankP ? "dom_ordem_painel_curta" : "dom_ordem_peso_curta"));
    notaOrdem.id = "domOrdemPainel";
    notaOrdem.title = t(rankP ? "dom_reforcar_painel_igual" : "dom_reforcar_painel");
    if (rankP && typeof peAbrir === "function") {
      const bp = gerEl("button", "btn-min dom-ir-painel", t("dom_ir_painel"));
      bp.type = "button"; bp.id = "btnDomIrPainel";
      bp.onclick = () => { try { domFechar(); } catch (e) {} peAbrir(); };
      notaOrdem.append(document.createTextNode(" "), bp);
    }
    sub.append(notaOrdem);
    if (fila.length && domFiltro === "todos") {
      const topo = fila.slice(0, 5);
      const ganho = (topo.reduce((x, f) => x + (f.pesoPct || 0), 0) / tot) * 100;
      const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
      const par = { n: topo.length, g: fmt(ganho), a: fmt(pct("verde")), b: fmt(Math.min(100, pct("verde") + ganho)) };
      const gp = gerEl("p", "dom-ganho", t("dom_ganho_curto", par));
      gp.title = t("dom_ganho", par);
      sub.append(gp);
    }
    s.append(sub);
  }
  if (!lista.length) s.append(gerEl("p", "nota", t(domBusca ? "dom_busca_vazio" : "dom_reforcar_vazio")));
  const ul = gerEl("div", "dom-lista");
  lista.slice(0, domLimite).forEach((f) => {
    const ln = domLinhaFila(f, posItem.has(f) ? posItem.get(f) : -1, c.topPorChave[f.chave]);
    c.linhas.push(ln);
    ul.append(ln.el);
  });
  s.append(ul);
  if (lista.length > domLimite) {
    const mais = gerEl("button", "btn-min dom-mais-linhas", t("dom_mais_linhas", { n: Math.min(DOM_LINHAS, lista.length - domLimite), t: lista.length }));
    mais.type = "button";
    mais.onclick = () => { domLimite += DOM_LINHAS; domPintar(); };
    s.append(mais);
  }
  if (!domBusca) s.append(gerEl("p", "nota dom-lista-pe", t("dom_reforcar_sub")));
  pPrior.append(s);
  /* na tela larga o detalhe nunca fica vazio: sem escolha da pessoa, o primeiro da lista (e ele acompanha o filtro) */
  if (duas && (!domSel || domSelAuto)) {
    if (c.linhas.length) { domSel = c.linhas[0].sel; domSelAuto = true; }
    else if (domSelAuto) domSel = null;
  }
  /* ---- o mapa: uma linha por disciplina — as que já têm estudo primeiro; as sem nada estudado recolhidas no fim ---- */
  const ordem = m.disciplinas.slice().sort((a, b) => (b.pesoPct - a.pesoPct) || (a.nome < b.nome ? -1 : 1));
  const ordemCor = domOrdemLer() === "cor";
  const filtrando = domFiltro !== "todos" || !!domBusca;
  const linOrd = gerEl("div", "dom-ordem");
  linOrd.append(gerEl("span", "dom-item-rot", t("dom_ordem_rot")));
  [["edital", "dom_ordem_edital"], ["cor", "dom_ordem_cor"]].forEach(([v, k]) => {
    const b = gerEl("button", "dom-filtro dom-ordem-b" + ((ordemCor ? "cor" : "edital") === v ? " ativa" : ""), t(k)); b.type = "button";
    b.setAttribute("aria-pressed", (ordemCor ? "cor" : "edital") === v ? "true" : "false");
    b.onclick = () => domOrdemDefinir(v);
    linOrd.append(b);
  });
  /* (19.215.0) "como ler a barra" mora no ⓘ (domPintarLegenda): era a segunda faixa de chips antes do mapa */
  pDisc.append(linOrd);
  const listaD = gerEl("div", "cov-lista dom-mapa");
  const semEstudo = gerEl("details", "dom-sem-estudo");
  const semLista = gerEl("div", "cov-lista dom-mapa");
  let nSem = 0, pesoSem = 0, abrirSem = false;
  const semNomes = [];
  ordem.forEach((d) => {
    const casaT = (tp) => domCasaTopico(tp) && domBuscaCasa(d, tp);
    const casaD = d.topicos.some(casaT);
    const abertaAqui = domDiscAberta === d.nome || (!!domBusca && casaD);
    const linha = gerEl("div", "cov-disc dom-disc" + (abertaAqui ? " cov-aberta" : ""));
    const cab = gerEl("div", "cov-disc-cab");
    cab.tabIndex = 0;
    cab.setAttribute("role", "button");
    cab.setAttribute("aria-expanded", abertaAqui ? "true" : "false");
    const dd = d.distribuicao, ds = Object.keys(dd).reduce((x, k) => x + dd[k], 0) || 1;
    const seta = gerEl("span", "dom-disc-seta", abertaAqui ? "▾" : "▸");
    cab.append(seta, gerEl("b", "cov-nome", d.nome), gerEl("span", "cov-peso", pctProva(d.pesoPct) + "%"));
    cab.title = t("cov_vale", { p: pctProva(d.pesoPct) }) + " · " + t("dom_disc_n", { v: Math.round((dd.verde / ds) * 100), r: Math.round((dd.vermelho / ds) * 100), c: Math.round((dd.cinza / ds) * 100) }) + " — " + t("dom_disc_tip");
    linha.append(cab);
    /* a barra dos tópicos: largura = peso; cor = nível; e as marcas (número, listras, risco, ramos) */
    const tira = gerEl("div", "cov-tira dom-tira");
    const somaTop = d.topicos.reduce((x, tp) => x + tp.pesoPct, 0) || 1;
    const segs = ordemCor ? d.topicos.slice().sort((x, y) => (DOM_ORDEM_COR.indexOf(x.nivel) - DOM_ORDEM_COR.indexOf(y.nivel)) || (y.pesoPct - x.pesoPct)) : d.topicos;
    const daTira = { d, segs: [] };
    segs.forEach((tp) => {
      const mc = domMarcasDoTopico(tp);
      const ag = domNaAgenda(c.agenda, d.nome, tp);
      const seg = gerEl("div", "cov-seg dom-n-" + domNv(tp.nivel) + (mc.incerto ? " dom-seg-incerto" : "") + (mc.venc ? " dom-seg-venc" : "") + (filtrando && !casaT(tp) ? " dom-apagado" : ""));
      seg.style.width = ((tp.pesoPct / somaTop) * 100).toFixed(2) + "%";
      /* (19.215.0) sem o número da fila no pedaço: um canal a menos na barra (a posição que vale é a da agenda, no balão) */
      if (mc.mistos) {
        const sub = gerEl("span", "dom-seg-sub");
        const somaR = tp.ramos.reduce((x, r) => x + (r.pesoPct || 0), 0) || 1;
        tp.ramos.forEach((r) => { const ri = gerEl("i", "dom-n-" + domNv(r.nivel)); ri.style.width = (((r.pesoPct || 0) / somaR) * 100).toFixed(2) + "%"; sub.append(ri); });
        seg.append(sub);
      }
      /* o pior ramo explica a cor do tópico com ramos */
      const pior = tp.ramos.length ? tp.ramos.filter((r) => r.nivel === tp.nivel)[0] : null;
      const linhasB = domSegLinhas(d, tp, ag && !ag.fora ? domAgendaTxt(ag) : "", domPorque(tp.motivos || (pior && pior.motivos) || []));
      seg.tabIndex = -1;
      seg.setAttribute("role", "button");
      seg.setAttribute("aria-label", linhasB.slice(0, -1).join(" · "));
      seg.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); domIrAoTopico(d.nome, tp.chave); };
      seg.onmouseenter = () => domSegBalao(seg, linhasB);
      seg.onmouseleave = () => domSegBalaoFechar();
      seg.onfocus = () => domSegBalao(seg, linhasB);
      seg.onblur = () => domSegBalaoFechar();
      c.segs[tp.chave] = seg;
      daTira.segs.push({ el: seg, tp });
      tira.append(seg);
    });
    if (daTira.segs.length) daTira.segs[0].el.tabIndex = 0;
    c.tiras.push(daTira);
    linha.append(tira);
    /* no fim da linha: quanto dela está verde e a mudança */
    const fim = gerEl("span", "dom-disc-fim");
    const verde = Math.round((dd.verde / ds) * 100);
    const vv = gerEl("span", "dom-disc-verde", "✓ " + verde + "%");
    vv.title = t("dom_disc_verde_tip", { v: verde });
    fim.append(vv);
    const dd2 = dlt && dlt.disciplinas[d.nome];
    if (dd2 && dd2.verde !== 0) {
      const ev = gerEl("span", "dom-evo-disc" + (dd2.verde > 0 ? " dom-evo-sobe" : " dom-evo-desce"), (dd2.verde > 0 ? "▲" : "▼") + String(Math.abs(dd2.verde)).replace(".", ","));
      ev.title = t("dom_evo_disc", { v: (dd2.verde > 0 ? "+" : "") + String(dd2.verde).replace(".", ",") }) + " " + t("dom_evo_disc_mud");
      fim.append(ev);
    }
    linha.append(fim);
    /* os tópicos, aberta a disciplina: uma linha curta cada (os ramos e os sinais estão no detalhe) */
    const det = gerEl("div", "cov-det dom-tops"); det.hidden = !abertaAqui;
    d.topicos.forEach((tp) => {
      const r = gerEl("div", "dom-tl dom-b-" + domNv(tp.nivel) + (filtrando && !casaT(tp) ? " dom-apagado" : ""));
      r.tabIndex = 0;
      if (tp.chave && r.dataset) r.dataset.chave = tp.chave;
      r.append(gerEl("span", "dom-nivel dom-n-" + domNv(tp.nivel), domNivelTxt(tp.nivel)), gerEl("span", "dom-tl-nome", tp.nome));
      /* (19.215.0) o selo diz se o tópico está na agenda (hoje ou nesta semana), não a posição na fila do reforço */
      const agT = domNaAgenda(c.agenda, d.nome, tp);
      if (agT && !agT.fora) {
        const sa = gerEl("span", "dom-tl-n dom-tl-ag", t(agT.hoje ? "dom_tl_ag_hoje" : "dom_tl_ag_semana"));
        sa.title = domAgendaTxt(agT);
        r.append(sa);
      }
      if (tp.ramos.length) r.append(gerEl("span", "dom-tl-ramos", t("dom_tl_ramos", { n: tp.ramos.length })));
      if (tp.fase2 && m.fase === 1) r.append(gerEl("span", "cov-f2", t("cov_f2_tag")));
      const pior = tp.ramos.length ? tp.ramos.filter((x) => x.nivel === tp.nivel)[0] : null;
      r.title = domPorque(tp.motivos || (pior && pior.motivos) || []) || tp.nome;
      r.onclick = () => domIrAoTopico(d.nome, tp.chave);
      c.tls[tp.chave] = r;
      det.append(r);
    });
    cab.onclick = () => {
      det.hidden = !det.hidden;
      domDiscAberta = det.hidden ? "" : d.nome;
      linha.classList.toggle("cov-aberta", !det.hidden);
      seta.textContent = det.hidden ? "▸" : "▾";
      cab.setAttribute("aria-expanded", det.hidden ? "false" : "true");
    };
    linha.append(det);
    /* "nada estudado" = todo o peso dela está em não estudado (com filtro ou busca não se agrupa: eles já recortam) */
    const nada = domFiltro === "todos" && !domBusca && dd.cinza >= ds - 1e-9;
    if (nada) { semLista.append(linha); nSem++; pesoSem += d.pesoPct; semNomes.push({ nome: d.nome, p: d.pesoPct }); if (domDiscAberta === d.nome) abrirSem = true; }
    else listaD.append(linha);
  });
  pDisc.append(listaD);
  if (nSem) {
    semEstudo.open = abrirSem || !listaD.children.length;
    /* as maiores entre as não iniciadas, pelo nome, no próprio título do grupo */
    const maiores = semNomes.slice(0, 3).map((x) => x.nome + " " + x.p.toFixed(1).replace(".", ",") + "%").join(", ") + (semNomes.length > 3 ? "…" : "");
    semEstudo.append(gerEl("summary", "", t("dom_sem_estudo", { n: nSem, p: pesoSem.toFixed(1).replace(".", ",") }) + (maiores ? " — " + maiores : "")), semLista);
    pDisc.append(semEstudo);
  }
  domPintarDetalhe();
  domMarcarSel();
  domVisibilidade();
}

/* o DETALHE do item escolhido: onde ele está na fila, o cartão inteiro (porquê, sinais, ramos, material e as ações), a
 * minha avaliação do tópico e, recolhidos, os ramos um a um (o motivo, os sinais, a avaliação e o registro de cada) */
function domPintarDetalhe() {
  const c = domCtx;
  if (!c) return null;
  const p = c.pDet;
  p.innerHTML = "";
  c.detEl = null;
  if (!domDuas()) {
    const nav = gerEl("div", "dom-det-nav");
    const bv = gerEl("button", "btn-min dom-det-voltar", t("dom_det_voltar")); bv.type = "button"; bv.id = "btnDomDetVoltar";
    bv.onclick = () => domDetFechar();
    nav.append(bv);
    const i = domLinhaIdx();
    if (i >= 0 && c.linhas.length > 1) {
      const ant = gerEl("button", "btn-min dom-det-ant", "‹"); ant.type = "button"; ant.title = t("dom_det_ant"); ant.setAttribute("aria-label", t("dom_det_ant"));
      ant.disabled = i === 0; ant.onclick = () => domMover(-1);
      const prox = gerEl("button", "btn-min dom-det-prox", "›"); prox.type = "button"; prox.title = t("dom_det_prox"); prox.setAttribute("aria-label", t("dom_det_prox"));
      prox.disabled = i === c.linhas.length - 1; prox.onclick = () => domMover(1);
      nav.append(ant, gerEl("span", "dom-det-pos", t("dom_det_pos", { i: i + 1, n: c.linhas.length })), prox);
    }
    p.append(nav);
  }
  const tp = domSel && c.topPorChave[domSel.chave];
  if (!tp) { p.append(gerEl("p", "nota dom-det-vazio", t("dom_det_vazio"))); return null; }
  const d = c.discDoTop[domSel.chave];
  /* o item da fila desse tópico (ou do ramo escolhido); no modo "um por um", os ramos dele agrupados; fora da fila, um
   * item montado do próprio tópico */
  const ft = c.filaTudo;
  let f = null;
  if (domSel.ramoId) f = ft.find((x) => x.chave === domSel.chave && x.tipo === "ramo" && x.ramoId === domSel.ramoId) || null;
  if (!f) f = ft.find((x) => x.chave === domSel.chave && x.tipo !== "ramo") || null;
  if (!f) { const rs = ft.filter((x) => x.chave === domSel.chave); if (rs.length) f = rs.length > 1 ? domFilaAgrupada(rs)[0] : rs[0]; }
  if (!f) f = domItemDoTopico(d, tp);
  const box = gerEl("div", "dom-top dom-det dom-b-" + domNv(tp.nivel));
  if (tp.chave && box.dataset) box.dataset.chave = tp.chave;
  /* (19.215.0) ONDE ELE ESTÁ: na agenda da semana (a ordem que vale para estudar); a posição na fila do reforço fica no
   * balão. Sem agenda para este edital, a fila, como antes. */
  const n = c.posFila[tp.chave] || 0;
  const filaTxt = n ? t("dom_det_na_fila", { n, t: c.nFila }) : t("dom_det_fora");
  const ag = domNaAgenda(c.agenda, d.nome, tp);
  const onde = gerEl("div", "dom-det-onde" + (ag && !ag.fora ? " dom-det-agenda" : ""), ag ? domAgendaTxt(ag) : filaTxt);
  if (ag) onde.title = filaTxt;
  box.append(onde);
  box.append(domItemFila(f, tp, false));
  if (tp.fase2 && c.m.fase === 1) box.append(gerEl("span", "cov-f2", t("cov_f2_tag")));
  domAutoWidget(box, d.nome, tp.nome, false);
  if (tp.ramos.length) {
    const rs = gerEl("details", "dom-det-ramos");
    rs.open = !!domSel.ramoId;
    rs.append(gerEl("summary", "", t("dom_det_ramos", { n: tp.ramos.length })));
    tp.ramos.forEach((rm) => {
      const rl = gerEl("div", "dom-ramo dom-b-" + rm.nivel + (rm.pulado ? " hor-ramo-pulado" : "") + (domSel.ramoId === rm.ramoId ? " dom-ramo-atual" : "") + (domFiltro !== "todos" && !domCasa(rm) ? " dom-apagado" : ""));
      const rc = gerEl("div", "dom-top-cab");
      rc.append(gerEl("span", "dom-nivel dom-n-" + domNv(rm.nivel), domNivelTxt(rm.nivel)), gerEl("span", "cov-top-nome", "↳ " + rm.ramoNome));
      rl.append(rc);
      if (!rm.pulado) {
        const pq = domPorque(rm.motivos); if (pq) rl.append(gerEl("div", "dom-porque", pq));
        const ch = gerEl("div", "dom-chips"); domChips(ch, rm); rl.append(ch);
        domAutoWidget(rl, d.nome, domChaveAuto(tp.nome, rm.ramoId), true);
        const bt = gerEl("div", "cov-acoes"); domBotaoRegistrar(bt, d.nome, tp.nome, rm.ramoId); if (bt.children.length) rl.append(bt);
      }
      rs.append(rl);
    });
    box.append(rs);
  }
  p.append(box);
  c.detEl = box;
  return box;
}
/* a linha da fila que corresponde ao escolhido (a exata; senão, a primeira do mesmo tópico) */
function domLinhaIdx() {
  const c = domCtx;
  if (!c || !domSel) return -1;
  const k = domSelK(domSel);
  let i = c.linhas.findIndex((x) => x.k === k);
  if (i < 0) i = c.linhas.findIndex((x) => x.chave === domSel.chave);
  return i;
}
/* o destaque do escolhido na fila, na barra e na lista do mapa (sem repintar a tela) */
function domMarcarSel() {
  const c = domCtx;
  if (!c) return;
  const i = domLinhaIdx();
  c.linhas.forEach((x, j) => { x.el.classList.toggle("dom-linha-sel", j === i); x.el.setAttribute("aria-current", j === i ? "true" : "false"); });
  Object.keys(c.segs).forEach((ch) => c.segs[ch].classList.toggle("dom-seg-sel", !!domSel && ch === domSel.chave));
  Object.keys(c.tls).forEach((ch) => c.tls[ch].classList.toggle("dom-tl-sel", !!domSel && ch === domSel.chave));
}
/* que painel aparece: tela larga, mapa + fila + detalhe; estreita, a aba escolhida OU o detalhe (no lugar dela) */
function domVisibilidade() {
  const c = domCtx;
  if (!c) return false;
  const duas = domDuas(), evo = domAba === "evo";
  const so = !duas && !evo && domDetAberto && !!domSel;
  c.pEvo.hidden = !evo;
  c.pDisc.hidden = evo || so || (!duas && domAba !== "disc");
  c.pPrior.hidden = evo || so || (!duas && domAba !== "prior");
  c.pDet.hidden = evo || !(duas || so);
  c.fixo.hidden = so;
  if ($("domFiltros")) $("domFiltros").hidden = evo || so;
  return so;
}
/* escolher um item: o detalhe passa a ser o dele (na tela estreita, "abrir" mostra o detalhe no lugar da lista) */
function domSelecionar(sel, abrir) {
  const antes = domDetAberto;
  domSel = sel && sel.chave ? { chave: sel.chave, ramoId: sel.ramoId || "" } : null;
  domSelAuto = false;
  if (abrir !== undefined && !domDuas()) domDetAberto = !!(abrir && domSel);
  const c = domCtx;
  if (!c) return domSel;
  if (domMenu) { domMenu.menu.hidden = true; domMenu.bt.setAttribute("aria-expanded", "false"); domMenu = null; }
  if (!antes && domDetAberto) { try { domRolagemLista = $("domCorpo").scrollTop || 0; } catch (e) {} }
  domMarcarSel();
  domPintarDetalhe();
  const so = domVisibilidade();
  try { if (so) $("domCorpo").scrollTop = 0; else if (c.pDet) c.pDet.scrollTop = 0; } catch (e) {}
  return domSel;
}
/* "← Voltar" (e o Esc): da tela do detalhe de volta à lista, onde estava */
function domDetFechar() {
  domDetAberto = false;
  domVisibilidade();
  try { $("domCorpo").scrollTop = domRolagemLista || 0; } catch (e) {}
  const c = domCtx, i = domLinhaIdx();
  const el = c && (domAba === "disc" ? (domSel && c.tls[domSel.chave]) : (i >= 0 ? c.linhas[i].el : null));
  try { if (el && el.focus) el.focus(); } catch (e) {}
  return true;
}
/* ↑↓: o vizinho na fila (com o detalhe aberto, ele passa a ser o do vizinho) */
function domMover(passo) {
  const c = domCtx;
  if (!c || !c.linhas.length) return null;
  let i = domLinhaIdx();
  i = i < 0 ? (passo > 0 ? 0 : c.linhas.length - 1) : Math.max(0, Math.min(c.linhas.length - 1, i + passo));
  const alvo = c.linhas[i];
  domSelecionar(alvo.sel, domDetAberto ? true : undefined);
  if (!domDetAberto) { try { alvo.el.focus(); if (alvo.el.scrollIntoView) alvo.el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  return alvo;
}
/* o foco na ação principal do detalhe (Enter numa linha da tela larga: o segundo Enter já faz) */
function domFocarAcao() {
  const b = domAchar(domCtx && domCtx.detEl, "dom-acao-1");
  try { if (b && b.focus) b.focus(); } catch (e) {}
  return b;
}
/* um pedaço da barra recebe o foco (um só por barra fica na ordem do Tab) */
function domFocarSeg(tira, el) {
  tira.segs.forEach((x) => { x.el.tabIndex = x.el === el ? 0 : -1; });
  try { if (el.focus) el.focus(); } catch (e) {}
  return el;
}
function domTeclaSeg(alvo, k, parar) {
  const c = domCtx;
  const ti = c.tiras.findIndex((x) => x.segs.some((s) => s.el === alvo));
  if (ti < 0) return false;
  const tr = c.tiras[ti], si = tr.segs.findIndex((s) => s.el === alvo);
  let prox = null, trProx = tr;
  if (k === "ArrowRight") prox = tr.segs[Math.min(tr.segs.length - 1, si + 1)];
  else if (k === "ArrowLeft") prox = tr.segs[Math.max(0, si - 1)];
  else if (k === "Home") prox = tr.segs[0];
  else if (k === "End") prox = tr.segs[tr.segs.length - 1];
  else if (k === "ArrowDown" || k === "ArrowUp") {
    trProx = c.tiras[ti + (k === "ArrowDown" ? 1 : -1)];
    if (trProx && trProx.segs.length) prox = trProx.segs[Math.min(trProx.segs.length - 1, Math.round((si * (trProx.segs.length - 1)) / Math.max(1, tr.segs.length - 1)))];
    else { parar(); return true; }
  } else if (k === "Enter" || k === " ") { parar(); alvo.onclick({ stopPropagation() {} }); domFocarAcao(); return true; }
  if (!prox) return false;
  parar();
  domFocarSeg(trProx, prox.el);
  return true;
}
/* o teclado do Domínio */
function domTecla(ev) {
  const dlg = $("dlgDominio");
  if (!ev || !dlg || !dlg.open) return false;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  const alvo = ev.target || {};
  const tag = String(alvo.tagName || "").toUpperCase();
  const k = ev.key;
  const parar = () => { if (ev.preventDefault) ev.preventDefault(); };
  if (alvo.id === "domBusca") {
    if (k === "Escape" && (domBusca || alvo.value)) { parar(); domEscTratado = Date.now(); domBuscaDefinir(""); return true; }
    if ((k === "ArrowDown" || k === "Enter") && domCtx && domCtx.linhas.length) {
      parar();
      const l0 = domCtx.linhas[0];
      domSelecionar(l0.sel, k === "Enter" ? true : undefined);
      try { if (!domDetAberto && l0.el.focus) l0.el.focus(); } catch (e) {}
      return true;
    }
    return false;
  }
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return false;
  if (k === "/") { parar(); try { $("domBusca").focus(); } catch (e) {} return true; }
  if (domAba === "evo" || !domCtx) return false;
  const cl = " " + String(alvo.className || "") + " ";
  if (cl.indexOf(" cov-seg ") >= 0) return domTeclaSeg(alvo, k, parar);
  if (k === "ArrowDown" || k === "ArrowUp") {
    if (!domDuas() && domAba !== "prior" && !domDetAberto) return false;
    parar();
    domMover(k === "ArrowDown" ? 1 : -1);
    return true;
  }
  if ((k === "Enter" || k === " ") && tag !== "BUTTON" && tag !== "A" && tag !== "SUMMARY") {
    if (cl.indexOf(" dom-linha ") >= 0 || cl.indexOf(" dom-tl ") >= 0 || cl.indexOf(" cov-disc-cab ") >= 0) {
      parar();
      if (typeof alvo.onclick === "function") alvo.onclick({ stopPropagation() {} });
      if (cl.indexOf(" cov-disc-cab ") < 0) domFocarAcao();
      return true;
    }
  }
  return false;
}
/* o filtro (os chips e as cores da barra do topo): tocar no ativo apaga, volta a "todos" */
function domFiltroDefinir(f) {
  domFiltro = DOM_FILTROS.indexOf(f) >= 0 ? f : "todos";
  domLimite = DOM_LINHAS;
  domPintar();
  return domFiltro;
}
/* a busca: em todos os tópicos e ramos */
function domBuscaDefinir(v) {
  const novo = String(v || "");
  domBusca = novo.trim() ? novo : "";
  const inp = $("domBusca");
  if (inp && inp.value !== novo) inp.value = novo;
  domLimite = DOM_LINHAS;
  if (domAba === "evo") domAbaDefinir("prior", true);
  domDetAberto = false;
  domPintar();
  return domBusca;
}

/* os filtros: chips com a cor (são também a legenda) e a contagem de folhas (tópicos sem ramo ou ramos) de cada situação;
 * os vazios somem (menos "todos" e o ativo) */
function domPintarFiltros(m) {
  const cx = $("domFiltros");
  cx.innerHTML = "";
  const tot = m.resumo.total || 1, dist = m.resumo.distribuicao || {};
  DOM_FILTROS.forEach((f) => {
    const n = f === "todos" ? m.folhas.length : m.folhas.filter((x) => (f === "vencida" ? (x.motivos || []).some((mm) => mm.cod === "revisao_vencida") : x.nivel === f)).length;
    if (!n && f !== "todos" && domFiltro !== f) return;
    const cor = f !== "todos" && f !== "vencida";
    const b = gerEl("button", "dom-filtro" + (domFiltro === f ? " ativa" : "")); b.type = "button";
    if (cor) b.append(gerEl("i", "dom-leg-i dom-n-" + f));
    b.append(document.createTextNode((f === "vencida" ? "⏰ " : "") + t("dom_f_" + f) + " (" + n + ")"));
    b.setAttribute("aria-pressed", domFiltro === f ? "true" : "false");
    b.title = cor ? t("dom_ajuda_" + f) + " — " + Math.round(((dist[f] || 0) / tot) * 100) + "% " + t("dom_do_peso") : t(f === "todos" ? "dom_f_todos_tip" : "dom_f_vencida_tip");
    b.onclick = () => domFiltroDefinir(domFiltro === f ? "todos" : f);
    cx.append(b);
  });
}

/* (19.215.0) COMO LER A BARRA, no ⓘ: o que o pedaço diz além da cor (largura, listras, risco, faixa dos ramos) */
function domPintarLegenda() {
  const cx = $("domLegCx");
  if (!cx) return null;
  cx.innerHTML = "";
  cx.append(gerEl("span", "dom-leg-item", t("dom_leg_largura")),
    domLegAmostra("azul", "dom-seg-incerto", "", "dom_leg_incerto"),
    domLegAmostra("amarelo", "dom-seg-venc", "", "dom_leg_venc"),
    domLegAmostra("vermelho", "dom-seg-mistos", "", "dom_leg_ramos"));
  return cx;
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
  /* (19.193.0) os cortes do semáforo moram junto da explicação, no ⓘ (o topo fica mais curto) */
  if ($("domAjustesCx")) $("domAjustesCx").hidden = p.hidden;
  /* (19.215.0) e também "como ler a barra" e o teclado */
  if ($("domLegCx")) $("domLegCx").hidden = p.hidden;
  if ($("domTeclas")) $("domTeclas").hidden = p.hidden;
  if ($("btnDomAjuda")) $("btnDomAjuda").setAttribute("aria-expanded", p.hidden ? "false" : "true");
  return !p.hidden;
}
function domSalvarCortes() {
  domLimitesGravar({ acertoRisco: $("domAcRisco").value, acertoSeguro: $("domAcSeguro").value, retencaoRisco: $("domRtRisco").value, retencaoSeguro: $("domRtSeguro").value });
  domPintar();
}

/* =====================================================================
 * (v18.88.0) O DOMÍNIO FORA DA JANELA
 * O nível de cada tópico, calculado uma vez e guardado enquanto as entradas não mudam (a agenda pinta dezenas de linhas
 * de uma vez; refazer o mapa custa ~40 ms por edital). A ASSINATURA resume tudo o que o Domínio lê: o texto e o
 * progresso do edital, as respostas às questões, os cartões da biblioteca e as revisões deles, as autoavaliações, os
 * cortes e o dia (revisão vence com o tempo). Usado pelo selo da linha da agenda e pelo termômetro do edital.
 * ===================================================================== */
let domCacheNiveis = {};
function domHash(str) { let h = 5381; const s0 = String(str || ""); for (let i = 0; i < s0.length; i++) h = ((h << 5) + h + s0.charCodeAt(i)) | 0; return h; }
function domAssinatura(ed) {
  const ls = (k) => { try { return domHash(localStorage.getItem(k) || ""); } catch (e) { return 0; } };
  let q = 0;
  try { (typeof qsTodas === "function" ? qsTodas() : []).forEach((x) => { const ts = x.tentativas || []; const u = ts[ts.length - 1]; q = (q * 31 + ts.length * 7 + (u && u.acertou ? 3 : 1) + (u && u.chute ? 11 : 0) + String(x.chave || "").length) | 0; }); } catch (e) {}
  let c = 0;
  try { Object.keys(typeof matResumos !== "undefined" ? matResumos : {}).forEach((k) => { c = (c * 31 + domHash((matResumos[k] || {}).cartoes || "")) | 0; }); } catch (e) {}
  return [domHash(ed.texto), domHash(JSON.stringify(ed.progresso || {})), q, c,
    ls(typeof ESTC_CH_REGS !== "undefined" ? ESTC_CH_REGS : ""), ls(typeof DIF_CHAVE !== "undefined" ? DIF_CHAVE : ""), ls(DOM_CH_LIM),
    typeof hojeISO === "function" ? hojeISO() : ""].join("|");
}
function domChaveNome(d, tp) {
  return String((d || "") + "›" + (tp || "")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function domNiveisDoEdital(edId, forcar) {
  const ed = (typeof editais !== "undefined" ? editais : []).find((e) => String(e.id) === String(edId));
  if (!ed) return null;
  const c = domCacheNiveis[ed.id];
  const sig = domAssinatura(ed);
  if (!forcar && c && c.sig === sig) return c;
  let m = null;
  try { m = domDoEdital(ed); } catch (e) { return null; }
  const porTopico = {};
  m.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
    const pior = tp.ramos.length ? tp.ramos.filter((r) => r.nivel === tp.nivel)[0] : null;
    porTopico[domChaveNome(d.nome, tp.nome)] = { nivel: tp.nivel, disciplina: d.nome, topico: tp.nome, chave: tp.chave,
      motivos: tp.motivos || (pior && pior.motivos) || [], pior: pior ? pior.ramoNome : "",
      ramos: tp.ramos.reduce((acc, r) => { acc[r.ramoId] = r.nivel; return acc; }, {}) };
  }));
  const tot = m.resumo.total || 1, dist = m.resumo.distribuicao;
  const pct = {};
  DOM_NIVEIS.forEach((k) => { pct[k] = (dist[k] / tot) * 100; });
  const out = { sig, porTopico, pct, folhas: m.resumo.folhas };
  domCacheNiveis[ed.id] = out;
  return out;
}
function domNivelDoTopico(edId, disciplina, topico) {
  const n = domNiveisDoEdital(edId);
  return n ? (n.porTopico[domChaveNome(disciplina, topico)] || null) : null;
}
/* (19.110.0) A COR DO TÓPICO E A DE CADA RAMO, para a lista de ramos da ficha: { nivel, ramos: { ramoId: nivel } }.
 * O edital: o que a ficha recebeu, senão o do tópico, senão o aberto (como o próximo passo). */
function domNiveisDosRamos(disciplina, topico, chave, edId) {
  const ed = edId || (typeof ramEditalDoTopico === "function" ? ramEditalDoTopico(chave, "") : "") || (typeof editalAtual !== "undefined" ? editalAtual : "");
  const n = ed ? domNivelDoTopico(ed, disciplina, topico) : null;
  return { nivel: n ? n.nivel : null, ramos: (n && n.ramos) || {} };
}
/* o selo da linha da agenda: só para o que já foi estudado (não estudado é o normal e já se vê na própria linha) */
function domSeloDaLinha(i) {
  if (!i || !i.disciplina) return null;
  const edId = i.edital || (typeof editalAtual !== "undefined" ? editalAtual : "");
  const n = domNivelDoTopico(edId, i.disciplina, i.nome || i.titulo);
  if (!n || n.nivel === "cinza" || n.nivel === "pulado") return null;
  const b = gerEl("button", "dom-selo-linha dom-n-" + n.nivel, t("dom_curto_" + n.nivel));
  b.type = "button";
  b.title = t("dom_selo_linha_tip", { n: t("dom_n_" + n.nivel) });
  b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); domAbrir(edId, n.disciplina); domIrAoTopico(n.disciplina, n.chave); };
  return b;
}
/* (v18.91.0) O PRÓXIMO PASSO, na ficha do tópico: a cor do domínio, o porquê e — quando há — a ação que mais ajuda nela
 * (a mesma da fila do Domínio). Na ficha, "começar/rever o material" é a própria ficha: aí só a cor e o motivo. */
function domProximoPasso(disciplina, topico, chave, edId) {
  const ed = edId || (typeof ramEditalDoTopico === "function" ? ramEditalDoTopico(chave, "") : "") || (typeof editalAtual !== "undefined" ? editalAtual : "");
  const n = ed ? domNivelDoTopico(ed, disciplina, topico) : null;
  if (!n || n.nivel === "pulado") return null;
  const f = { nivel: n.nivel, tipo: "topico", chave: n.chave || chave, disciplina, topico, motivos: n.motivos };
  const mat = domMaterialDe(disciplina, topico, f.chave);
  const ac = domAcaoPrincipal(f, mat, []);
  const comAcao = ["erradas", "medir", "criar_qs"].indexOf(ac.cod) >= 0;
  return { nivel: n.nivel, edital: ed, pior: n.pior, porque: domPorque(n.motivos), acao: comAcao ? ac : null, ramos: n.ramos || {} };
}
function domPassoPintar(box, disciplina, topico, chave, edId, aoAgir) {
  if (!box) return null;
  box.innerHTML = "";
  let p = null;
  try { p = domProximoPasso(disciplina, topico, chave, edId); } catch (e) { p = null; }
  box.hidden = !p;
  if (!p) return null;
  box.className = "dom-passo dom-b-" + p.nivel;
  const nv = gerEl("button", "dom-nivel dom-n-" + p.nivel, t("dom_n_" + p.nivel));
  nv.type = "button";
  nv.title = t("dom_passo_ver_tip");
  nv.onclick = () => { if (typeof aoAgir === "function") aoAgir(); domAbrir(p.edital, disciplina); const k = domNivelDoTopico(p.edital, disciplina, topico); if (k) domIrAoTopico(disciplina, k.chave); };
  box.append(gerEl("span", "dom-item-rot", t("dom_passo_rot")), nv);
  /* (19.111.0) sem repetir o que a cor já diz: "não estudado" dispensa "porque: ainda não estudado", e "ramo mais fraco"
   * só quando os ramos NÃO estão todos na mesma cor (senão o "mais fraco" é só o primeiro da lista) */
  const iguais = Object.keys(p.ramos || {}).every((k) => p.ramos[k] === p.nivel);
  const pq = p.nivel === "cinza" ? "" : (p.porque || "");
  const txt = (p.pior && !iguais ? t("dom_grupo_pior", { r: p.pior }) + (pq ? " · " : "") : "") + pq;
  box.title = txt;
  if (txt) box.append(gerEl("span", "dom-passo-pq", txt));
  if (p.acao) {
    const b = gerEl("button", "btn-min dom-acao-1 dom-acao-" + p.acao.cod, p.acao.txt);
    b.type = "button"; b.title = p.acao.tip;
    b.onclick = () => { if (typeof aoAgir === "function") aoAgir(); p.acao.fazer(); };
    box.append(b);
  }
  return p;
}

/* o termômetro do edital aberto, ao lado do botão do Domínio: uma barrinha do peso por nível + o verde em número */
function domTermoPintar(edId) {
  const box = $("edDomTermo");
  if (!box) return null;
  box.innerHTML = "";
  const n = edId ? domNiveisDoEdital(edId, true) : null;
  box.hidden = !n || !n.folhas;
  if (box.hidden) return null;
  const barra = gerEl("span", "dom-termo-barra");
  ["verde", "amarelo", "azul", "vermelho", "cinza"].forEach((k) => {
    if (n.pct[k] <= 0) return;
    const s = gerEl("span", "dom-termo-seg dom-n-" + k);
    s.style.width = n.pct[k].toFixed(2) + "%";
    barra.append(s);
  });
  const r = (k) => Math.round(n.pct[k]);
  box.append(barra, gerEl("span", "dom-termo-txt", t("dom_termo_txt", { v: r("verde"), r: r("vermelho") })));
  box.title = t("dom_termo_tip", { v: r("verde"), a: r("amarelo"), z: r("azul"), r: r("vermelho"), c: r("cinza") });
  /* (19.104.0) o termômetro do edital aberto abre o PAINEL do edital (o Domínio inteiro fica a um toque lá dentro) */
  box.onclick = () => { if (typeof peAbrir === "function" && $("dlgPainel") && typeof editalAtual !== "undefined" && String(edId) === String(editalAtual)) peAbrir(); else domAbrir(edId); };
  return n;
}

/* (19.103.0) fechar o Domínio para abrir outra coisa deixa a volta armada: ao fechar o que foi aberto, ele volta igual */
function domFechar() {
  const rolagens = ["dom-painel-disc", "dom-painel-prior", "dom-painel-det", "cov-corpo"].map((c) => {
    let el = null;
    try { el = c === "cov-corpo" ? $("domCorpo") : document.querySelector("#domCorpo ." + c); } catch (e) { el = null; }
    return { c, y: el ? el.scrollTop : 0 };
  });
  const estado = { ed: domEditalId, disc: domDiscAberta, filtro: domFiltro, aba: domAba, fase: ($("domFase") || {}).value || "1",
    sel: domSel, auto: domSelAuto, det: domDetAberto, busca: domBusca };
  painelArmar("dlgDominio", t("dom_titulo"), () => {
    domAbrir(estado.ed, estado.disc, { manter: estado });
    rolagens.forEach((r) => { try { const el = r.c === "cov-corpo" ? $("domCorpo") : document.querySelector("#domCorpo ." + r.c); if (el) el.scrollTop = r.y; } catch (e) {} });
  });
}

function domAbrir(editalId, disciplina, opc) {
  const manter = opc && opc.manter;
  if (!manter && typeof voltarLimpar === "function") voltarLimpar("dlgDominio");
  domDiscAberta = disciplina || "";
  domFiltro = manter ? (manter.filtro || "todos") : "todos";
  /* (19.193.0) o escolhido, o detalhe aberto e a busca: de novo do zero, ou como estavam (na volta de outra tela) */
  domSel = manter ? (manter.sel || null) : null;
  domSelAuto = manter ? !!manter.auto : false;
  domDetAberto = manter ? !!manter.det : false;
  domBusca = manter ? (manter.busca || "") : "";
  domLimite = DOM_LINHAS;
  if ($("domBusca")) {
    $("domBusca").value = domBusca;
    $("domBusca").placeholder = t("dom_busca_ph");
    $("domBusca").setAttribute("aria-label", t("dom_busca_ph"));
  }
  /* aberto numa disciplina: vai direto ao mapa; senão, a visão lembrada */
  domAba = manter ? (manter.aba || domAbaLer()) : (disciplina ? "disc" : domAbaLer());
  let visto = false;
  try { visto = !!localStorage.getItem(DOM_CH_SUB); localStorage.setItem(DOM_CH_SUB, "1"); } catch (e) {}
  domAjudaTrocar(!visto);
  const eds = covEditaisOrdenados();
  const sel = $("domEdital");
  sel.innerHTML = "";
  eds.forEach((e) => { const op = gerEl("option", "", e.nome || "—"); op.value = String(e.id); sel.append(op); });
  domEditalId = editalId ? String(editalId) : (eds[0] ? String(eds[0].id) : "");
  sel.value = domEditalId;
  $("domFase").value = manter ? (manter.fase || "1") : "1";
  domPintar();
  dicasDosBotoes({ btnGerDominio: "dom_tip_abrir", btnEdDominio: "dom_tip_abrir", btnDomX: "cov_tip_x", domEdital: "cov_tip_edital", domFase: "cov_tip_fase", btnDomCheia: "dom_cheia_tip", domBusca: "dom_busca_tip" });
  abrirModal("dlgDominio");
  /* aberto pelo toque da pessoa (o navegador só concede a tela cheia dentro de um gesto) */
  domCheiaTrocar(domCheiaPreferida(), false);
}

if (typeof document !== "undefined" && $("dlgDominio")) {
  $("btnGerDominio").onclick = () => domAbrir();
  $("btnEdDominio").onclick = () => domAbrir(editalAtual);
  $("btnDomX").onclick = () => $("dlgDominio").close();
  $("domEdital").onchange = () => { domEditalId = $("domEdital").value; $("domFase").value = "1"; domSel = null; domSelAuto = false; domDetAberto = false; domLimite = DOM_LINHAS; domPintar(); };
  /* (19.193.0) a busca (com uma pausa curta: não refaz a tela a cada letra), o teclado e o Esc do detalhe */
  if ($("domBusca")) $("domBusca").oninput = () => { try { clearTimeout(domBuscaT); } catch (e) {} domBuscaT = setTimeout(() => domBuscaDefinir($("domBusca").value), 150); };
  if ($("dlgDominio").addEventListener) {
    $("dlgDominio").addEventListener("keydown", (ev) => { try { domTecla(ev); } catch (e) {} });
    $("dlgDominio").addEventListener("cancel", (ev) => {
      /* o Esc que limpou a busca não fecha a janela; com o detalhe aberto (tela estreita), ele volta à lista */
      if (domEscTratado && Date.now() - domEscTratado < 400) { domEscTratado = 0; if (ev && ev.preventDefault) ev.preventDefault(); return; }
      if (domDetAberto && domSel && !domDuas() && domAba !== "evo") { if (ev && ev.preventDefault) ev.preventDefault(); domDetFechar(); }
    });
    $("dlgDominio").addEventListener("close", () => domSegBalaoFechar());
  }
  $("domFase").onchange = domPintar;
  ["domAcRisco", "domAcSeguro", "domRtRisco", "domRtSeguro"].forEach((id) => { $(id).onchange = domSalvarCortes; });
  $("btnDomPadrao").onclick = () => { try { localStorage.removeItem(DOM_CH_LIM); } catch (e) {} domPintar(); };
  if ($("btnDomAjuda")) $("btnDomAjuda").onclick = () => domAjudaTrocar();
  if ($("btnDomCheia")) $("btnDomCheia").onclick = () => domCheiaTrocar(undefined, true);
  if ($("dlgDominio").addEventListener) $("dlgDominio").addEventListener("close", () => { try { if (typeof editalAtual !== "undefined" && editalAtual) domTermoPintar(editalAtual); } catch (e) {} });
  if ($("dlgDominio").addEventListener) $("dlgDominio").addEventListener("close", () => { if (domCheia) { domCheia = false; $("dlgDominio").classList.remove("dom-cheia"); if (typeof telaCheiaSair === "function") telaCheiaSair("dominio"); } });
  try {
    const mq = window.matchMedia && window.matchMedia("(min-width: " + DOM_LARGO_MIN + "px)");
    if (mq && mq.addEventListener) mq.addEventListener("change", () => { if ($("dlgDominio").open) domPintar(); });
  } catch (e) {}
  [["btnDomAbaPrior", "prior"], ["btnDomAbaDisc", "disc"], ["btnDomAbaEvo", "evo"]].forEach(([id, a]) => { if ($(id)) $(id).onclick = () => domAbaDefinir(a); });
}
