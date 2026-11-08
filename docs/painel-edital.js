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
 *   · O DETALHE da disciplina abre NA MESMA TELA, com "← Todas as disciplinas" para voltar;
 *   · (19.105.0) A FILA "O QUE ESTUDAR AGORA": tópico a tópico, com o porquê de cada um e a ação que mais ajuda.
 *
 * A CONTA DA FILA (a mesma da ordem "mais urgente" e dos tópicos no detalhe), cada parcela à vista no item:
 *   pontos = (peso × gravidade  [× 1,5 se o ACERTO do bloco está abaixo do mínimo e o tópico é vermelho/amarelo]
 *             + corte)  × tempo
 *   · peso × gravidade: a fila do Domínio, folha a folha (vermelho 3, amarelo 2, nunca estudado 2, sem medida 1,5);
 *   · corte: o bloco com COBERTURA abaixo do mínimo — eliminatório — põe o que ainda não foi estudado dele na frente.
 *     Vale PE_K_CORTE pontos (como 10% da prova) vezes a fração do que falta ao bloco que este tópico cobre: num bloco
 *     pequeno, poucos tópicos tiram do corte e cada um pesa muito; num bloco grande, cada um ajuda pouco;
 *   · tempo: a disciplina abaixo do peso no período (ou sem nenhuma hora) × 1,25; a que já passa 10 pontos do peso × 0,8.
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
const PE_K_CORTE = 10;             /* tirar um bloco do corte vale como 10% da prova (a fração que o tópico cobre do que falta) */
const PE_AC_CORTE = 1.5;           /* o vermelho/amarelo de um bloco com ACERTO abaixo do mínimo */
const PE_TEMPO_MAIS = 1.25, PE_TEMPO_MENOS = 0.8;
const PE_FILA_PASSO = 8;
let peFiltro = "todos", peOrdem = "peso", pePeriodo = "14", peDisc = "", peCheia = false, peTopOrdem = "urgencia";
let peFilaN = PE_FILA_PASSO;
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
      /* as FOLHAS do Domínio: o próprio tópico, ou os ramos dele (os pulados ficam de fora) */
      const folhas = tp.ramos && tp.ramos.length ? tp.ramos.filter((x) => !x.pulado && PE_NIVEIS.indexOf(x.nivel) >= 0) : [tp];
      let pior = folhas[0] || tp;
      folhas.forEach((f) => { if (DOM_NIVEIS.indexOf(f.nivel) < DOM_NIVEIS.indexOf(pior.nivel)) pior = f; });
      return { nome: tp.nome, chave: tp.chave, nivel: tp.nivel, pesoPct: tp.pesoPct || 0, ordem: i, ramos: ht.ramos || [],
        estudoMin: ht.estudoMin || 0, revisaoMin: ht.revisaoMin || 0, feitas: ht.feitas || 0, unidades: ht.unidades || 1,
        /* peso × gravidade, folha a folha (a mesma conta da fila agrupada do Domínio) */
        base: folhas.reduce((a, f) => a + (f.pesoPct || 0) * fatorDe(f.nivel), 0),
        /* o peso ainda não estudado: é ele que sobe a cobertura do bloco */
        pesoFalta: folhas.filter((f) => f.nivel === "cinza").reduce((a, f) => a + (f.pesoPct || 0), 0),
        /* o porquê e o alvo da ação: os da folha mais fraca */
        motivos: pior.motivos || [], ramo: pior !== tp && pior.ramoId ? { id: pior.ramoId, nome: pior.ramoNome } : null,
        domRamos: (tp.ramos || []).map((x) => ({ id: x.ramoId, nome: x.ramoNome })),
        urgencia: 0, partes: null };
    });
    const tempoPct = totalMin ? (h.totalMin / totalMin) * 100 : 0;
    const bl = blocos.find((b) => (b.disciplinas || []).indexOf(h.nome) >= 0) || null;
    const bloco = bl ? { nome: bl.nome, minPct: bl.minPct, pct: bl.pct, abaixo: !!bl.abaixo, apertado: !!bl.apertado,
      acerto: bl.acerto === undefined ? null : bl.acerto, acertoAbaixo: !!bl.acertoAbaixo } : null;
    const tempoConta = totalMin >= PE_MIN_TEMPO;
    return { nome: h.nome, vale: h.pesoPct, dist, cont, n: tops.length, topicos, feitas: h.feitas, unidades: h.unidades,
      estudoMin: h.estudoMin, revisaoMin: h.revisaoMin, totalMin: h.totalMin, tempoPct, desvio: tempoPct - h.pesoPct,
      tempoConta, bloco, tempoMult: 1, urgencia: 0 };
  });

  /* (19.105.0) A FILA "O QUE ESTUDAR AGORA" — a conta está no cabeçalho do arquivo. "Mais urgente" (a ordem das
   * disciplinas) é a soma dos pontos dos tópicos dela, e os tópicos do detalhe seguem a mesma conta. */
  const valeBloco = {};
  disciplinas.forEach((d) => { if (d.bloco) valeBloco[d.bloco.nome] = (valeBloco[d.bloco.nome] || 0) + d.vale; });
  const folga = typeof ED_FOLGA_MINIMO === "number" ? ED_FOLGA_MINIMO : 1.25;
  const fila = [];
  disciplinas.forEach((d) => {
    const b = d.bloco;
    /* o que falta COBRIR para o bloco sair do corte com folga, em % da prova */
    const falta = b && b.abaixo && b.minPct ? Math.max(0, (Math.min(100, b.minPct * folga) - (b.pct || 0)) / 100) * (valeBloco[b.nome] || 0) : 0;
    const semHora = !d.totalMin && d.vale >= 1;
    d.tempoMult = !d.tempoConta ? 1 : (d.desvio <= -5 || semHora ? PE_TEMPO_MAIS : (d.desvio >= 10 ? PE_TEMPO_MENOS : 1));
    d.topicos.forEach((tp) => {
      const corte = falta > 0 && tp.pesoFalta > 0 ? PE_K_CORTE * Math.min(1, tp.pesoFalta / falta) : 0;
      const acMult = b && b.acertoAbaixo && (tp.nivel === "vermelho" || tp.nivel === "amarelo") ? PE_AC_CORTE : 1;
      tp.partes = { base: tp.base, corte, acMult, tempoMult: d.tempoMult };
      tp.urgencia = (tp.base * acMult + corte) * d.tempoMult;
      if (tp.urgencia > 0) fila.push({ d, tp });
    });
    d.urgencia = d.topicos.reduce((a, tp) => a + tp.urgencia, 0);
  });
  fila.sort((x, y) => (y.tp.urgencia - x.tp.urgencia) || (y.tp.pesoPct - x.tp.pesoPct)
    || (x.d.nome < y.d.nome ? -1 : (x.d.nome > y.d.nome ? 1 : 0)) || (x.tp.ordem - y.tp.ordem));
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
  return { disciplinas, filtros, urgencias, fila, total: hm.total, totalMin, periodo: o.periodo || "tudo",
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
        () => peDefinir({ ordem: "urgencia", filtro: "todos", foco: "fila" }), t("pe_u_corte_tip"));
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
  peFila(cx, dd);
}

/* ---------------------------------------------------------------------
 * (19.105.0) A FILA "O QUE ESTUDAR AGORA"
 * ------------------------------------------------------------------- */
function peNum(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ","); }
/* o porquê da COR, curto (o Domínio diz a frase inteira; aqui é um selo) */
function peMotivoCurto(m) {
  const c = m.cod;
  if (c === "nunca_estudado") return t("pe_m_nunca");
  if (c === "acerto_baixo" || c === "acerto_mediano") return t("pe_m_acerto", { pct: m.pct, n: m.n });
  if (c === "retencao_baixa" || c === "retencao_mediana") return t("pe_m_retencao", { pct: m.pct });
  if (c === "revisao_vencida") return t("pe_m_revisao", { dias: m.dias === null || m.dias === undefined ? "?" : m.dias });
  if (c === "nao_medido") return t("pe_m_naomedido");
  if (c === "inseguro") return t("pe_m_inseguro");
  return typeof domMotivoTxt === "function" ? domMotivoTxt(m) : "";
}
/* os selos de um item: a cor, o corte, quanto vale e o tempo */
function peMotivos(tp, d) {
  const out = [];
  const m = (tp.motivos || []).filter((x) => x && !/solid[ao]$/.test(x.cod) && x.cod !== "solido")[0];
  const txt = m ? peMotivoCurto(m) : "";
  if (txt) out.push({ cls: "nivel", txt });
  const p = tp.partes || {};
  if (p.corte > 0) out.push({ cls: "corte", txt: t("pe_mot_corte", { b: d.bloco.nome, p: Math.round(d.bloco.pct || 0), m: d.bloco.minPct }) });
  if (p.acMult > 1) out.push({ cls: "corte", txt: t("pe_mot_acerto_corte", { b: d.bloco.nome, p: d.bloco.acerto, m: d.bloco.minPct }) });
  out.push({ cls: "vale", txt: t("pe_mot_vale", { p: pctProva(tp.pesoPct) }) });
  if (p.tempoMult > 1) out.push({ cls: "tempo", txt: d.totalMin ? t("pe_mot_pouco_tempo", { t: Math.round(d.tempoPct), v: pctProva(d.vale) }) : t("pe_mot_zero_tempo") });
  if (p.tempoMult < 1) out.push({ cls: "muito", txt: t("pe_mot_muito_tempo", { t: Math.round(d.tempoPct), v: pctProva(d.vale) }) });
  return out;
}
/* a conta do item, por extenso (no balão) */
function peFilaConta(tp) {
  const p = tp.partes || { base: 0, corte: 0, acMult: 1, tempoMult: 1 };
  /* (peso × cor [× acerto do bloco] + corte) × tempo — com os parênteses só quando eles mudam a leitura */
  let x = t("pe_conta_base", { b: peNum(p.base) });
  if (p.acMult !== 1) x += t("pe_conta_ac", { m: peNum(p.acMult) });
  if (p.corte > 0) x += t("pe_conta_corte", { c: peNum(p.corte) });
  if (p.tempoMult !== 1) {
    if (p.corte > 0 || p.acMult !== 1) x = "(" + x + ")";
    x += t("pe_conta_tempo", { m: String(p.tempoMult).replace(".", ",") });
  }
  return t("pe_conta", { x, s: peNum(tp.urgencia) });
}
/* A AÇÃO QUE MAIS AJUDA NA COR (a mesma regra do Domínio): errou → refazer as erradas; estudou e não mediu → medir;
 * não estudou → o material (começar, ou preparar o que falta); o resto → rever. Sempre fecha o painel com a volta armada. */
function peAcaoDe(tp, d) {
  const ramo = tp.ramo;
  const edId = typeof editalAtual !== "undefined" ? editalAtual : "";
  const ficha = () => edAbrirFicha(d.nome, tp.nome, { ramos: tp.domRamos || [], ramo: ramo ? ramo.id : "", editalId: edId });
  let erradas = [];
  if ((tp.nivel === "vermelho" || tp.nivel === "amarelo") && typeof qsFiltrar === "function") {
    try { erradas = qsFiltrar(Object.assign({ chave: tp.chave, soErradas: true }, ramo ? { ramo: ramo.id } : {})); } catch (e) { erradas = []; }
    /* o ramo herda o acerto do tópico: sem erradas ligadas ao ramo, valem as do tópico */
    if (ramo && !erradas.length) { try { erradas = qsFiltrar({ chave: tp.chave, soErradas: true }); } catch (e) { erradas = []; } }
  }
  let mat = { vazio: true, questoes: 0 };
  try { if (typeof domMaterialDe === "function") mat = domMaterialDe(d.nome, tp.nome, tp.chave); } catch (e) {}
  if (erradas.length) return { cod: "erradas", txt: t("dom_ac1_erradas", { n: erradas.length }), tip: t("dom_ac1_erradas_tip"), ficha,
    fazer: () => qsUiResponderAbrir(erradas, null, "painel-erradas:" + tp.chave + (ramo ? "#" + ramo.id : "")) };
  if (tp.nivel === "azul") return { cod: mat.questoes ? "medir" : "criar_qs", txt: mat.questoes ? t("dom_ac1_medir", { n: mat.questoes }) : t("dom_ac1_criar_qs"),
    tip: t("dom_ac1_medir_tip"), ficha, fazer: () => qsUiResponderDireto(d.nome, tp.nome, ramo || undefined) };
  if (tp.nivel === "cinza") return { cod: mat.vazio ? "preparar" : "comecar", txt: t(mat.vazio ? "dom_ac1_preparar" : "dom_ac1_comecar"), tip: t("dom_ac1_ficha_tip"), ficha, fazer: ficha };
  return { cod: "rever", txt: t("dom_ac1_rever"), tip: t("dom_ac1_ficha_tip"), ficha, fazer: ficha };
}
function peFilaItem(x, i) {
  const tp = x.tp, d = x.d;
  const it = gerEl("div", "pe-fila-it");
  it.id = "peFi_" + i;
  it.title = peFilaConta(tp) + (tp.ramo ? " · " + t("pe_ramo_pior", { r: tp.ramo.nome }) : "");
  it.append(gerEl("span", "pe-fila-n", String(i + 1)), gerEl("i", "pe-dot dom-n-" + tp.nivel));
  const txt = gerEl("div", "pe-fila-txt");
  const nome = gerEl("div", "pe-fila-nome");
  nome.append(gerEl("span", "pe-fila-disc", d.nome + " › "), gerEl("b", "", tp.nome));
  if (tp.ramo) nome.append(gerEl("span", "pe-fila-disc", " › " + tp.ramo.nome));
  txt.append(nome);
  const mot = gerEl("div", "pe-fila-mot");
  peMotivos(tp, d).forEach((m) => mot.append(gerEl("span", "pe-mot pe-mot-" + m.cls, m.txt)));
  txt.append(mot);
  it.append(txt);
  const ac = peAcaoDe(tp, d);
  const caixa = gerEl("span", "pe-fila-acoes");
  const b1 = gerEl("button", "btn-min btn-min-ok pe-acao-1", ac.txt); b1.type = "button"; b1.title = ac.tip;
  b1.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); peFechar(); ac.fazer(); };
  caixa.append(b1);
  /* errou ou falta medir: o material do tópico também a um toque */
  if (ac.fazer !== ac.ficha) {
    const b2 = gerEl("button", "btn-min", t("ed_materiais_btn")); b2.type = "button"; b2.title = t("dom_ac1_ficha_tip");
    b2.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); peFechar(); ac.ficha(); };
    caixa.append(b2);
  }
  it.append(caixa);
  return it;
}
function peFila(cx, dd) {
  const box = gerEl("div", "pe-fila");
  box.id = "peFila";
  box.append(gerEl("h4", "pe-fila-tit", t("pe_fila_tit")), gerEl("p", "nota pe-fila-sub", t("pe_fila_sub", { per: pePeriodoTexto(dd.periodo) })));
  /* o filtro vale para a lista e para a fila */
  const itens = (dd.fila || []).filter((x) => peCasa(x.tp, peFiltro));
  if (peFiltro !== "todos") box.append(gerEl("p", "nota", t("pe_fila_filtro", { f: t("pe_f_" + peFiltro + "_nome") })));
  const lista = gerEl("div", "pe-fila-lista");
  lista.id = "peFilaLista";
  itens.slice(0, peFilaN).forEach((x, i) => lista.append(peFilaItem(x, i)));
  if (!itens.length) lista.append(gerEl("p", "nota", t(peFiltro === "todos" ? "pe_fila_vazia" : "pe_fila_vazia_filtro")));
  box.append(lista);
  if (itens.length > peFilaN) {
    const mais = gerEl("button", "btn-min pe-fila-mais", t("pe_fila_mais", { n: Math.min(PE_FILA_PASSO, itens.length - peFilaN), t: itens.length }));
    mais.type = "button"; mais.id = "btnPeFilaMais";
    mais.onclick = () => { peFilaN += PE_FILA_PASSO; peRender(); };
    box.append(mais);
  }
  cx.append(box);
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
  const y = cx.scrollTop || 0;
  cx.innerHTML = "";
  let dd = null;
  try { dd = peDados(peFonte(), { periodo: pePeriodo }); } catch (e) { dd = null; }
  peUltimo = dd;
  if (!dd || !dd.disciplinas.length) { cx.append(gerEl("p", "nota", t("pe_vazio"))); return dd; }
  cx.append(peKpi(dd), peUrgencias(dd));
  if (peDisc) peDetalhe(cx, dd); else peLista(cx, dd);
  cx.scrollTop = y;
  return dd;
}

/* trocar filtro, ordem, período ou a disciplina aberta (e lembrar o que é preferência) */
function peDefinir(m) {
  const x = m || {};
  if (x.filtro !== undefined && PE_FILTROS.indexOf(x.filtro) >= 0) { if (x.filtro !== peFiltro) peFilaN = PE_FILA_PASSO; peFiltro = x.filtro; }
  if (x.ordem !== undefined && PE_ORDENS.indexOf(x.ordem) >= 0) peOrdem = x.ordem;
  if (x.periodo !== undefined && PE_PERIODOS.indexOf(String(x.periodo)) >= 0) pePeriodo = String(x.periodo);
  if (x.disc !== undefined) peDisc = x.disc;
  if (x.ordem !== undefined || x.periodo !== undefined) pePrefGravar();
  const sel = $("pePeriodo");
  if (sel) sel.value = pePeriodo;
  const dd = peRender();
  const c = $("peCorpo");
  if (c && (x.disc !== undefined)) c.scrollTop = 0;
  /* o cartão do corte leva à fila */
  if (x.foco === "fila") { const f = $("peFila"); try { if (f && f.scrollIntoView) f.scrollIntoView({ block: "start" }); } catch (e) {} }
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
    peFiltro = "todos"; peDisc = o.disc || ""; peFilaN = PE_FILA_PASSO;
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
