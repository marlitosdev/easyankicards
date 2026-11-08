/* =====================================================================
 * (19.104.0) PAINEL DO EDITAL — "Horas por assunto" e "Domínio" numa tela só
 *
 * As duas telas respondiam metade da pergunta cada uma: as horas diziam ONDE o tempo foi (e não o quanto se sabe), o
 * Domínio dizia o QUANTO se sabe (e não o tempo, nem o risco de corte). E a decisão — "o que estudar agora?" — precisa
 * das duas juntas, mais o que nenhuma mostrava: o bloco abaixo do mínimo e a disciplina que vale muito e não recebe tempo.
 *
 * O PAINEL, de cima para baixo:
 *   · uma linha com a prova, as horas por semana, o que já é verde e o que foi registrado no período;
 *   · AS URGÊNCIAS: risco de corte (bloco abaixo do mínimo), tempo fora do peso, o que nunca foi estudado, o vermelho;
 *   · OS FILTROS, cada um com quantos tópicos e quanto da prova ("nunca estudado · 130 · 79% da prova");
 *   · UMA LINHA POR DISCIPLINA, na ordem escolhida (quanto vale · mais urgente · tempo abaixo do peso · menos dominada):
 *     quanto vale, o domínio (a cor de cada nível, pelo peso), os assuntos cumpridos e o seu tempo contra o peso;
 *   · O DETALHE da disciplina abre NA MESMA TELA, com "← Todas as disciplinas" para voltar.
 *
 * NADA É MEDIDO DE NOVO: a fatia vem do plano (montarPlano), as horas das horas por assunto (horMapa), as cores do
 * Domínio (domDoEdital), os cortes dos blocos do plano. O mapa completo do Domínio e as horas em colunas continuam a um
 * toque, no cabeçalho.
 * ===================================================================== */
const PE_PERIODOS = ["7", "14", "30", "90", "tudo"];
const PE_FILTROS = ["todos", "atencao", "nunca", "naomedido", "dominado"];
const PE_NIVEIS_FILTRO = { atencao: ["vermelho", "amarelo"], nunca: ["cinza"], naomedido: ["azul"], dominado: ["verde"] };
const PE_ORDENS = ["peso", "urgencia", "tempo", "dominio"];
const PE_NIVEIS = ["verde", "amarelo", "azul", "vermelho", "cinza"];
const PE_MIN_TEMPO = 120;          /* minutos no período abaixo dos quais "tempo × peso" não diz nada */
const PE_CH = "eac_pe_pref";
let peFiltro = "todos", peOrdem = "peso", pePeriodo = "14", peDisc = "", peCheia = false, peTopOrdem = "urgencia";
let peUltimo = null;

function pePrefLer() { try { return JSON.parse(localStorage.getItem(PE_CH) || "{}") || {}; } catch (e) { return {}; } }
function pePrefGravar() {
  try { localStorage.setItem(PE_CH, JSON.stringify({ ordem: peOrdem, periodo: pePeriodo, cheia: peCheia })); } catch (e) {}
}
function peDesde(dias) {
  const d = new Date(); d.setDate(d.getDate() - Number(dias));
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function pePeriodoTexto(p) { return t("pe_p_" + (p || "tudo")); }

/* o edital aberto na tela do edital: o texto de agora, o progresso, o diário deste concurso */
function peFonte() {
  const h = horDoAberto();
  return Object.assign({ texto: ($("editalTexto") || {}).value || "", progresso: typeof edProgresso !== "undefined" ? edProgresso : {} }, h);
}

/* OS DADOS DO PAINEL (sem tela): fonte = { r, plano, diario, minSemana, texto, progresso }; opc = { periodo } */
function peDados(fonte, opc) {
  const o = opc || {};
  const { r, plano, diario, minSemana } = fonte;
  const fase = plano.fase && plano.fase.n === 2 ? 2 : 1;
  const per = o.periodo && o.periodo !== "tudo" ? { desde: peDesde(o.periodo), dias: Number(o.periodo), minSemana } : {};
  const hm = horMapa(plano, diario, per);
  let dm = null;
  try { dm = domDoEdital({ texto: fonte.texto, progresso: fonte.progresso }, { fase }); } catch (e) { dm = null; }
  const domDe = new Map((dm ? dm.disciplinas : []).map((d) => [d.nome, d]));
  const totalMin = hm.total.totalMin;
  const fatorDe = (n) => (typeof DOM !== "undefined" && DOM.fatores[n] != null ? DOM.fatores[n] : 0);
  const blocos = (plano.blocos || []).filter((b) => b.minPct !== null && b.minPct !== undefined);
  const contG = {};
  PE_NIVEIS.forEach((k) => { contG[k] = 0; });
  const disciplinas = hm.disciplinas.map((h) => {
    const dd = domDe.get(h.nome);
    const tops = dd ? dd.topicos.filter((tp) => PE_NIVEIS.indexOf(tp.nivel) >= 0) : [];
    const cont = {};
    PE_NIVEIS.forEach((k) => { cont[k] = 0; });
    tops.forEach((tp) => { cont[tp.nivel]++; contG[tp.nivel]++; });
    /* a cor de cada nível PELO PESO (a mesma distribuição do Domínio), em % da própria disciplina */
    const dist = {};
    const soma = dd ? PE_NIVEIS.reduce((a, k) => a + (dd.distribuicao[k] || 0), 0) : 0;
    PE_NIVEIS.forEach((k) => { dist[k] = soma ? ((dd.distribuicao[k] || 0) / soma) * 100 : (k === "cinza" ? 100 : 0); });
    const horasTop = new Map(h.topicos.map((tp) => [tp.nome, tp]));
    const topicos = tops.map((tp, i) => {
      const ht = horasTop.get(tp.nome) || {};
      return { nome: tp.nome, chave: tp.chave, nivel: tp.nivel, pesoPct: tp.pesoPct || 0, ordem: i, ramos: ht.ramos || [],
        estudoMin: ht.estudoMin || 0, revisaoMin: ht.revisaoMin || 0, feitas: ht.feitas || 0, unidades: ht.unidades || 1,
        urgencia: (tp.pesoPct || 0) * fatorDe(tp.nivel) };
    });
    const tempoPct = totalMin ? (h.totalMin / totalMin) * 100 : 0;
    const bl = blocos.find((b) => (b.disciplinas || []).indexOf(h.nome) >= 0) || null;
    const bloco = bl ? { nome: bl.nome, minPct: bl.minPct, pct: bl.pct, abaixo: !!bl.abaixo, apertado: !!bl.apertado } : null;
    const tempoConta = totalMin >= PE_MIN_TEMPO;
    /* "mais urgente": o peso do que falta × a gravidade (os mesmos fatores do Domínio), + o risco de corte, + o tempo que
     * falta para o peso — cada parcela à vista no detalhe */
    const urgencia = topicos.reduce((a, tp) => a + tp.urgencia, 0)
      + (bloco && bloco.abaixo ? h.pesoPct * 0.5 : 0)
      + (tempoConta && tempoPct - h.pesoPct < -5 ? (h.pesoPct - tempoPct) * 0.5 : 0);
    return { nome: h.nome, vale: h.pesoPct, dist, cont, n: tops.length, topicos, feitas: h.feitas, unidades: h.unidades,
      estudoMin: h.estudoMin, revisaoMin: h.revisaoMin, totalMin: h.totalMin, tempoPct, desvio: tempoPct - h.pesoPct,
      tempoConta, bloco, urgencia };
  });
  const totalTop = PE_NIVEIS.reduce((a, k) => a + contG[k], 0);
  const distG = (dm && dm.resumo && dm.resumo.distribuicao) || {};
  const pctG = (ks) => ks.reduce((a, k) => a + (distG[k] || 0), 0);
  const filtros = { todos: { n: totalTop, pct: 100 } };
  Object.keys(PE_NIVEIS_FILTRO).forEach((f) => {
    filtros[f] = { n: PE_NIVEIS_FILTRO[f].reduce((a, k) => a + contG[k], 0), pct: pctG(PE_NIVEIS_FILTRO[f]) };
  });

  /* AS URGÊNCIAS, na ordem do que custa mais caro */
  const urgencias = [];
  const corte = blocos.filter((b) => b.abaixo);
  if (corte.length) urgencias.push({ tipo: "corte", grau: "perigo", blocos: corte.map((b) => ({ nome: b.nome, pct: b.pct || 0, minPct: b.minPct })) });
  if (totalMin >= PE_MIN_TEMPO && disciplinas.length > 1) {
    const mais = disciplinas.slice().sort((a, b) => b.desvio - a.desvio)[0];
    const sem = disciplinas.filter((d) => d.vale >= 5 && d.tempoPct < d.vale / 3).sort((a, b) => b.vale - a.vale);
    if (mais && mais.desvio >= 15) urgencias.push({ tipo: "tempo", grau: "atencao", disc: mais.nome, tempo: mais.tempoPct, vale: mais.vale, sem: sem.map((d) => d.nome) });
    else if (sem.length) urgencias.push({ tipo: "sem", grau: "atencao", sem: sem.map((d) => d.nome), vale: sem.reduce((a, d) => a + d.vale, 0) });
  }
  if ((distG.vermelho || 0) >= 2) urgencias.push({ tipo: "vermelho", grau: "perigo", pct: distG.vermelho, n: contG.vermelho });
  if (dm && dm.resumo.semEstudoPct >= 20) urgencias.push({ tipo: "nunca", grau: "neutro", pct: dm.resumo.semEstudoPct, n: contG.cinza, total: totalTop });

  /* a prova: a data, ou a borda da janela prevista */
  const cfg = r.cfg || {};
  const prova = cfg.prova || (typeof edDataPlanejada === "function" ? edDataPlanejada(cfg) : "");
  let dias = null;
  if (prova) {
    const h0 = new Date(); h0.setHours(0, 0, 0, 0);
    dias = Math.round((new Date(prova + "T00:00:00") - h0) / 86400000);
  }
  return { disciplinas, filtros, urgencias, total: hm.total, totalMin, periodo: o.periodo || "tudo",
    prova, previsto: !cfg.prova && !!cfg.previsto, previstoTxt: cfg.previsto || "", dias, horasSemana: minSemana / 60,
    verdePct: distG.verde || 0, base: dm ? dm.base : "" };
}

/* o selo do bloco com mínimo: o número é do BLOCO inteiro — quando ele junta várias disciplinas, o nome dele vai junto */
function peBlocoTexto(d) {
  const b = d.bloco;
  if (!b) return "";
  const k = b.abaixo ? "risco" : (b.apertado ? "apertado" : "ok");
  const v = { p: Math.round(b.pct || 0), m: b.minPct, b: b.nome };
  return b.nome && b.nome !== d.nome ? t("pe_bloco_" + k + "_de", v) : t("pe_bloco_" + k, v);
}

/* a ordem das disciplinas */
function peOrdenar(lista, ordem) {
  const L = lista.slice();
  const porVale = (a, b) => b.vale - a.vale || (a.nome < b.nome ? -1 : 1);
  if (ordem === "urgencia") L.sort((a, b) => b.urgencia - a.urgencia || porVale(a, b));
  else if (ordem === "tempo") L.sort((a, b) => a.desvio - b.desvio || porVale(a, b));
  else if (ordem === "dominio") L.sort((a, b) => a.dist.verde - b.dist.verde || b.dist.cinza - a.dist.cinza || porVale(a, b));
  else L.sort(porVale);
  return L;
}
/* o filtro: as disciplinas com algum tópico naquele estado (e os tópicos dele, no detalhe) */
function peCasa(tp, filtro) { return filtro === "todos" || (PE_NIVEIS_FILTRO[filtro] || []).indexOf(tp.nivel) >= 0; }
function peDiscNoFiltro(d, filtro) { return filtro === "todos" || d.topicos.some((tp) => peCasa(tp, filtro)); }

/* ---------------------------------------------------------------------
 * A TELA
 * ------------------------------------------------------------------- */
function peBarra(pct, cls) {
  const b = gerEl("div", "pe-mini");
  const i = gerEl("i", cls || "");
  i.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%";
  b.append(i);
  return b;
}
function peDist(dist) {
  const b = gerEl("div", "dom-dist pe-dist");
  PE_NIVEIS.forEach((k) => {
    if (!(dist[k] > 0)) return;
    const s = gerEl("span", "dom-seg dom-n-" + k);
    s.style.width = dist[k].toFixed(2) + "%";
    s.title = t("dom_n_" + k) + ": " + Math.round(dist[k]) + "%";
    b.append(s);
  });
  return b;
}
function peDesvioTexto(d) {
  if (!d.tempoConta) return { txt: t("pe_tempo_pouco"), cls: "pe-t-pouco" };
  /* nenhuma hora não é "no peso", por menor que seja a disciplina */
  if (!d.totalMin && d.vale >= 1) return { txt: t("pe_tempo_zero"), cls: "pe-t-abaixo" };
  const v = Math.round(d.desvio);
  if (v >= 10) return { txt: t("pe_tempo_acima", { d: v }), cls: "pe-t-acima" };
  if (v <= -5) return { txt: t("pe_tempo_abaixo", { d: v }), cls: "pe-t-abaixo" };
  return { txt: t("pe_tempo_ok"), cls: "pe-t-ok" };
}

function peKpi(dd) {
  const k = gerEl("div", "pe-kpi");
  const fmt = (iso) => String(iso).split("-").reverse().join("/");
  const partes = [];
  if (dd.previsto) partes.push(t("pe_kpi_prev", { j: typeof edPrevistoTexto === "function" ? edPrevistoTexto(dd.previstoTxt) : dd.previstoTxt }));
  else if (dd.dias === null) partes.push(t("pe_kpi_sem_prova"));
  else if (dd.dias < 0) partes.push(t("pe_kpi_passou", { d: -dd.dias }));
  else partes.push(t("pe_kpi_prova", { d: dd.dias, data: fmt(dd.prova) }));
  if (dd.horasSemana) partes.push(t("pe_kpi_horas", { h: Math.round(dd.horasSemana * 10) / 10 }));
  partes.push(t("pe_kpi_verde", { p: Math.round(dd.verdePct) }));
  partes.push(t("pe_kpi_reg", { per: pePeriodoTexto(dd.periodo), t: horTexto(dd.total.totalMin), e: horTexto(dd.total.estudoMin), r: horTexto(dd.total.revisaoMin) }));
  k.textContent = partes.join(" · ");
  return k;
}

function peUrgencias(dd) {
  const box = gerEl("div", "pe-urg");
  box.id = "peUrg";
  const card = (u, tit, sub, faz, dica) => {
    const b = gerEl("button", "pe-u pe-u-" + u.grau);
    b.type = "button"; b.id = "peU_" + u.tipo;
    b.append(gerEl("b", "pe-u-tit", tit), gerEl("span", "pe-u-sub", sub));
    if (dica) b.title = dica;
    b.onclick = faz;
    box.append(b);
  };
  const per = pePeriodoTexto(dd.periodo);
  dd.urgencias.forEach((u) => {
    if (u.tipo === "corte") {
      card(u, t("pe_u_corte_tit", { n: u.blocos.length }),
        u.blocos.map((b) => t("pe_u_corte_item", { b: b.nome, p: Math.round(b.pct), m: b.minPct })).join(" · "),
        () => peDefinir({ ordem: "urgencia", filtro: "todos" }), t("pe_u_corte_tip"));
    } else if (u.tipo === "tempo") {
      card(u, t("pe_u_tempo_tit"), t("pe_u_tempo_sub", { t: Math.round(u.tempo), per, d: u.disc, v: pctProva(u.vale) })
        + (u.sem.length ? " " + t("pe_u_tempo_sem", { l: u.sem.slice(0, 3).join(", ") }) : ""),
        () => peDefinir({ ordem: "tempo", filtro: "todos" }), t("pe_u_tempo_tip"));
    } else if (u.tipo === "sem") {
      card(u, t("pe_u_sem_tit"), t("pe_u_sem_sub", { l: u.sem.slice(0, 3).join(", "), v: pctProva(u.vale), per }),
        () => peDefinir({ ordem: "tempo", filtro: "todos" }), t("pe_u_tempo_tip"));
    } else if (u.tipo === "vermelho") {
      card(u, t("pe_u_vermelho_tit", { p: Math.round(u.pct) }), t("pe_u_vermelho_sub", { n: u.n }),
        () => peDefinir({ filtro: "atencao", ordem: "urgencia" }));
    } else if (u.tipo === "nunca") {
      card(u, t("pe_u_nunca_tit", { p: Math.round(u.pct) }), t("pe_u_nunca_sub", { n: u.n, t: u.total }),
        () => peDefinir({ filtro: "nunca", ordem: "peso" }));
    }
  });
  if (!dd.urgencias.length) {
    const ok = gerEl("div", "pe-u pe-u-ok");
    ok.append(gerEl("b", "pe-u-tit", t("pe_u_ok_tit")), gerEl("span", "pe-u-sub", t("pe_u_ok_sub")));
    box.append(ok);
  }
  return box;
}

function peFiltrosBarra(dd) {
  const barra = gerEl("div", "pe-barra");
  barra.append(gerEl("span", "nota", t("pe_mostrar")));
  PE_FILTROS.forEach((f) => {
    const x = dd.filtros[f];
    const b = gerEl("button", "pe-chip" + (peFiltro === f ? " ativa" : ""),
      f === "todos" ? t("pe_f_todos", { n: x.n }) : t("pe_f_" + f, { n: x.n, p: pctProva(x.pct) }));
    b.type = "button"; b.id = "peF_" + f;
    b.setAttribute("aria-pressed", peFiltro === f ? "true" : "false");
    b.title = t("pe_f_" + f + "_tip");
    b.onclick = () => peDefinir({ filtro: f });
    barra.append(b);
  });
  const fim = gerEl("span", "pe-barra-fim");
  fim.append(gerEl("label", "nota", t("pe_ordem")));
  const sel = gerEl("select", "pe-ordem"); sel.id = "peOrdem";
  PE_ORDENS.forEach((o) => { const op = gerEl("option", "", t("pe_o_" + o)); op.value = o; sel.append(op); });
  sel.value = peOrdem;
  sel.onchange = () => peDefinir({ ordem: sel.value });
  fim.append(sel);
  barra.append(fim);
  return barra;
}

function peLinha(d, i) {
  const lin = gerEl("div", "pe-lin");
  lin.id = "peLin_" + i;
  lin.setAttribute("role", "button");
  lin.tabIndex = 0;
  const nome = gerEl("div", "pe-c-nome");
  nome.append(gerEl("b", "", d.nome));
  if (d.bloco && (d.bloco.abaixo || d.bloco.apertado)) {
    nome.append(gerEl("span", "pe-bloco" + (d.bloco.abaixo ? " pe-bloco-risco" : ""), peBlocoTexto(d)));
  }
  if (peFiltro !== "todos") {
    const n = d.topicos.filter((tp) => peCasa(tp, peFiltro)).length;
    nome.append(gerEl("span", "pe-aqui", t("pe_n_aqui", { n })));
  }
  const vale = gerEl("div", "pe-c-vale");
  vale.append(gerEl("b", "", pctProva(d.vale) + "%"), peBarra(d.vale, "pe-i-vale"));
  const dom = gerEl("div", "pe-c-dom");
  dom.append(peDist(d.dist));
  const un = gerEl("div", "pe-c-un", d.feitas + "/" + d.unidades);
  un.title = t("hor_un", { a: d.feitas, n: d.unidades });
  const tempo = gerEl("div", "pe-c-tempo");
  const dv = peDesvioTexto(d);
  tempo.append(peBarra(d.tempoPct, "pe-i-tempo"), peBarra(d.vale, "pe-i-peso"), gerEl("span", "pe-t " + dv.cls, dv.txt));
  tempo.title = t("pe_tempo_tip", { t: Math.round(d.tempoPct), per: pePeriodoTexto(pePeriodo), v: pctProva(d.vale), h: horTexto(d.totalMin) });
  lin.append(nome, vale, dom, un, tempo, gerEl("span", "pe-c-seta", "›"));
  const abrir = () => peDefinir({ disc: d.nome });
  lin.onclick = abrir;
  lin.onkeydown = (ev) => { if (ev && (ev.key === "Enter" || ev.key === " ")) { if (ev.preventDefault) ev.preventDefault(); abrir(); } };
  return lin;
}

function peLista(cx, dd) {
  cx.append(peFiltrosBarra(dd));
  const cab = gerEl("div", "pe-lin pe-lin-cab");
  ["pe_h_disc", "pe_h_vale", "pe_h_dom", "pe_h_un", "pe_h_tempo"].forEach((k) => cab.append(gerEl("span", "", t(k))));
  cab.append(gerEl("span", "", ""));
  cx.append(cab);
  const lista = gerEl("div", "pe-lista"); lista.id = "peLista";
  const ds = peOrdenar(dd.disciplinas, peOrdem).filter((d) => peDiscNoFiltro(d, peFiltro));
  ds.forEach((d, i) => lista.append(peLinha(d, i)));
  if (!ds.length) lista.append(gerEl("p", "nota", t("pe_lista_vazia")));
  cx.append(lista);
  const leg = gerEl("div", "pe-leg");
  PE_NIVEIS.forEach((k) => { const s = gerEl("span", ""); s.append(gerEl("i", "pe-leg-i dom-n-" + k), document.createTextNode(" " + t("dom_n_" + k))); leg.append(s); });
  const lt = gerEl("span", ""); lt.append(gerEl("i", "pe-leg-l pe-i-tempo"), document.createTextNode(" " + t("pe_leg_tempo", { per: pePeriodoTexto(pePeriodo) })));
  const lv = gerEl("span", ""); lv.append(gerEl("i", "pe-leg-l pe-i-peso"), document.createTextNode(" " + t("pe_leg_vale")));
  leg.append(lt, lv);
  cx.append(leg);
  if (dd.base) cx.append(gerEl("p", "nota pe-base", t(dd.base === "questoes" ? "dom_base_questoes" : (dd.base === "plano" ? "dom_base_plano" : (dd.base === "fase2" ? "cov_base_fase2" : "dom_base_estimado")))));
}

function peDetalhe(cx, dd) {
  const d = dd.disciplinas.find((x) => x.nome === peDisc);
  if (!d) { peDisc = ""; peLista(cx, dd); return; }
  const cab = gerEl("div", "pe-det-cab");
  const volta = gerEl("button", "btn-min", t("pe_voltar")); volta.type = "button"; volta.id = "btnPeVoltar";
  volta.onclick = () => peDefinir({ disc: "" });
  cab.append(volta, gerEl("h4", "pe-det-nome", d.nome));
  cx.append(cab);
  const sub = [t("pe_det_sub", { v: pctProva(d.vale), f: d.feitas, t: d.unidades, e: horTexto(d.estudoMin), r: horTexto(d.revisaoMin), per: pePeriodoTexto(pePeriodo) })];
  if (d.bloco) sub.push(peBlocoTexto(d));
  if (d.tempoConta) sub.push(peDesvioTexto(d).txt);
  cx.append(gerEl("p", "nota pe-det-sub", sub.join(" · ")));
  cx.append(peDist(d.dist));
  /* a ordem dos tópicos: o que mais pesa × a gravidade primeiro (o que estudar), ou a do edital (para achar) */
  const ord = gerEl("div", "pe-barra");
  ord.append(gerEl("span", "nota", t("pe_ordem")));
  ["urgencia", "edital"].forEach((o) => {
    const b = gerEl("button", "pe-chip" + (peTopOrdem === o ? " ativa" : ""), t("pe_top_" + o)); b.type = "button"; b.id = "peTop_" + o;
    b.onclick = () => { peTopOrdem = o; peRender(); };
    ord.append(b);
  });
  cx.append(ord);
  let tops = d.topicos.filter((tp) => peCasa(tp, peFiltro));
  if (peFiltro !== "todos") {
    const p = gerEl("p", "nota pe-parcial");
    p.append(document.createTextNode(t("pe_filtro_parcial", { n: tops.length, t: d.topicos.length, f: t("pe_f_" + peFiltro + "_nome") }) + " "));
    const tudo = gerEl("button", "btn-min", t("pe_filtro_todos")); tudo.type = "button"; tudo.id = "btnPeTodos";
    tudo.onclick = () => peDefinir({ filtro: "todos" });
    p.append(tudo);
    cx.append(p);
  }
  tops = tops.slice().sort(peTopOrdem === "edital" ? (a, b) => a.ordem - b.ordem : (a, b) => b.urgencia - a.urgencia || a.ordem - b.ordem);
  const lista = gerEl("div", "pe-tops"); lista.id = "peTops";
  tops.forEach((tp) => {
    const tl = gerEl("div", "pe-top");
    tl.append(gerEl("i", "pe-dot dom-n-" + tp.nivel), gerEl("span", "pe-top-nome", tp.nome), gerEl("span", "pe-top-niv", t("dom_n_" + tp.nivel)),
      gerEl("span", "pe-top-h", t("pe_top_h", { e: horTexto(tp.estudoMin), r: horTexto(tp.revisaoMin), a: tp.feitas, n: tp.unidades })));
    /* estudar e os materiais: os MESMOS da Agenda (edMontarStatusEMenu); abrir um deles deixa a volta armada */
    try {
      const rr = edRecursosDoTopico(d.nome, tp.nome);
      const { estudar, mais } = edMontarStatusEMenu(gerEl("div", ""), d.nome, tp.nome, tp.ramos, typeof editalAtual !== "undefined" ? editalAtual : "", rr);
      [estudar, mais].forEach((b) => {
        if (!b) return;
        const orig = b.onclick;
        b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); peFechar(); if (orig) orig(ev); };
      });
      const ac = gerEl("span", "pe-top-acoes");
      if (estudar) ac.append(estudar);
      if (mais) ac.append(mais);
      tl.append(ac);
    } catch (e) {}
    lista.append(tl);
  });
  if (!tops.length) lista.append(gerEl("p", "nota", t("ed_busca_vazia")));
  cx.append(lista);
}

function peRender() {
  const cx = $("peCorpo");
  if (!cx) return null;
  cx.innerHTML = "";
  let dd = null;
  try { dd = peDados(peFonte(), { periodo: pePeriodo }); } catch (e) { dd = null; }
  peUltimo = dd;
  if (!dd || !dd.disciplinas.length) { cx.append(gerEl("p", "nota", t("pe_vazio"))); return dd; }
  cx.append(peKpi(dd), peUrgencias(dd));
  if (peDisc) peDetalhe(cx, dd); else peLista(cx, dd);
  return dd;
}

/* trocar filtro, ordem, período ou a disciplina aberta (e lembrar o que é preferência) */
function peDefinir(m) {
  const x = m || {};
  if (x.filtro !== undefined && PE_FILTROS.indexOf(x.filtro) >= 0) peFiltro = x.filtro;
  if (x.ordem !== undefined && PE_ORDENS.indexOf(x.ordem) >= 0) peOrdem = x.ordem;
  if (x.periodo !== undefined && PE_PERIODOS.indexOf(String(x.periodo)) >= 0) pePeriodo = String(x.periodo);
  if (x.disc !== undefined) peDisc = x.disc;
  if (x.ordem !== undefined || x.periodo !== undefined) pePrefGravar();
  const sel = $("pePeriodo");
  if (sel) sel.value = pePeriodo;
  const dd = peRender();
  const c = $("peCorpo");
  if (c && (x.disc !== undefined)) c.scrollTop = 0;
  try { reg("PAINEL", "painel do edital", JSON.stringify(x)); } catch (e) {}
  return dd;
}

/* TELA CHEIA, como o Domínio e as horas (lembrada; padrão: cheia) */
function peCheiaTrocar(sim, lembrar) {
  peCheia = sim === undefined ? !peCheia : !!sim;
  const dlg = $("dlgPainel");
  if (dlg) dlg.classList.toggle("pe-cheia", peCheia);
  const b = $("btnPeCheia");
  if (b) { b.textContent = t(peCheia ? "dom_cheia_sair" : "dom_cheia"); b.setAttribute("aria-pressed", peCheia ? "true" : "false"); }
  if (peCheia) { if (typeof telaCheiaPedir === "function") telaCheiaPedir("painel", () => { if (peCheia) peCheiaTrocar(false, false); }); }
  else if (typeof telaCheiaSair === "function") telaCheiaSair("painel");
  if (lembrar) pePrefGravar();
  return peCheia;
}

/* abrir algo a partir do painel deixa a volta armada (19.103.0): ao fechar, o painel volta igual */
function peFechar() {
  const c = $("peCorpo");
  const y = c ? c.scrollTop : 0;
  painelArmar("dlgPainel", t("pe_titulo"), () => {
    peAbrir({ manter: true });
    const c2 = $("peCorpo");
    if (c2) c2.scrollTop = y;
  });
}

function peAbrir(opc) {
  const o = opc || {};
  if (!o.manter) {
    const p = pePrefLer();
    peFiltro = "todos"; peDisc = o.disc || "";
    peOrdem = PE_ORDENS.indexOf(o.ordem || p.ordem) >= 0 ? (o.ordem || p.ordem) : "peso";
    pePeriodo = PE_PERIODOS.indexOf(String(p.periodo)) >= 0 ? String(p.periodo) : "14";
    peCheia = p.cheia === undefined ? true : !!p.cheia;
    if (typeof voltarLimpar === "function") voltarLimpar("dlgPainel");
  }
  const sel = $("pePeriodo");
  if (sel) {
    sel.innerHTML = "";
    PE_PERIODOS.forEach((v) => { const op = gerEl("option", "", pePeriodoTexto(v)); op.value = v; sel.append(op); });
    sel.value = pePeriodo;
  }
  const ed = typeof edAberto === "function" ? edAberto() : null;
  const tit = $("peEdNome");
  if (tit) tit.textContent = ed ? (ed.nome || "") : "";
  peRender();
  abrirModal("dlgPainel");
  peCheiaTrocar(peCheia, false);
  try { reg("PAINEL", "painel do edital aberto", ed ? ed.nome : ""); } catch (e) {}
}

if (typeof document !== "undefined" && $("dlgPainel")) {
  if ($("btnEdPainel")) $("btnEdPainel").onclick = () => peAbrir();
  $("btnPeX").onclick = () => $("dlgPainel").close();
  $("btnPeCheia").onclick = () => peCheiaTrocar(undefined, true);
  $("pePeriodo").onchange = () => peDefinir({ periodo: $("pePeriodo").value });
  $("btnPeMapa").onclick = () => { peFechar(); domAbrir(typeof editalAtual !== "undefined" ? editalAtual : ""); };
  $("btnPeColunas").onclick = () => { peFechar(); horAbrir(); };
  if ($("dlgPainel").addEventListener) $("dlgPainel").addEventListener("close", () => {
    if (peCheia) { $("dlgPainel").classList.remove("pe-cheia"); if (typeof telaCheiaSair === "function") telaCheiaSair("painel"); }
  });
}
