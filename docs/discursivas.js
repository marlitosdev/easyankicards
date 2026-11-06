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

/* (19.76.0) A DISCURSIVA EM DATA PRÓPRIA. Concurso de duas fases (SEFAZ-AL: objetiva em dezembro, discursiva em janeiro)
 * cadastra a data da escrita na linha "# fase 2: … | prova: …" e marca com "!d" os tópicos que caem nela. Isso também é
 * discursiva: o formato (pontos, linhas, mínimo) vem da linha "# discursiva", quando houver; a DATA vem da fase 2. Sem a
 * linha "# discursiva", ela aparece igual, com o formato a cadastrar e as disciplinas dos tópicos "!d". */
function dsDiscursivaDe(e) {
  try {
    const r = lerEdital(e.texto || "");
    const cfg = r.cfg || {};
    const f2 = cfg.fase2 && cfg.fase2.prova ? cfg.fase2 : null;
    let dc = cfg.discursiva && cfg.discursiva.pontos > 0 ? Object.assign({}, cfg.discursiva) : null;
    if (!dc && f2) {
      const comD = [];
      (r.disciplinas || []).forEach((d) => { if (!d.inativa && d.topicos.some((tp) => tp.fase2) && comD.indexOf(d.nome) < 0) comD.push(d.nome); });
      dc = { pontos: 0, objetiva: 0, minimo: null, linhas: null, corrigida: 0, disciplinas: comD, semFormato: true };
    }
    if (dc && f2) dc.fase2 = { nome: f2.nome || "", prova: f2.prova, objetiva: cfg.prova || "" };
    return { r, dc };
  } catch (err) { return { r: null, dc: null }; }
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
  const linhas = edLinhasTxt(dc.linhas) || t("ds_p_linhas_livre");
  return t("ds_prompt", { c: e.nome || "", d: (dc.disciplinas || []).join("; ") || "-", l: linhas, p: dc.pontos || "?",
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
  /* (19.75.0) a proposta com o mesmo tema fica como escrita */
  try { if (typeof dsPropostaMarcarEscrita === "function") r.proposta = dsPropostaMarcarEscrita(id, tema); } catch (e) {}
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
  const fora = dc && dc.linhas && dc.linhas.max ? l.filter((x) => x.linhas && (x.linhas < (dc.linhas.min || 0) || x.linhas > dc.linhas.max)).length : 0;
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
    if (res.fora) al.push(t("ds_red_fora2", { n: res.fora, l: edLinhasTxt(dc.linhas) }));
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
  const iLin = campo(t("ds_red_linhas"), mk("number", "dsRedLinhas_" + e.id, edLinhasTxt(dc.linhas, true)));
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
      const foraTam = dc.linhas && dc.linhas.max && x.linhas && (x.linhas < (dc.linhas.min || 0) || x.linhas > dc.linhas.max);
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

/* =====================================================================
 * (19.75.0) A TELA COMPLETA DA DISCURSIVA
 *  · só os editais com discursiva, na ordem da prova mais próxima (os sem discursiva ficam recolhidos no fim);
 *  · critérios e cortes: as disciplinas em que ela cai, com o peso de cada uma DENTRO da discursiva, a cobertura e o
 *    corte do bloco; o mínimo da discursiva em pontos;
 *  · como é corrigida: os critérios mais usados pelas bancas, com os números deste edital;
 *  · editar a discursiva aqui mesmo — reescreve só a linha "# discursiva" do edital, com confirmação e desfazer;
 *  · sugestão de temas pelo que o edital exige: peso do tópico × peso da disciplina, "!d" (cai na discursiva) na
 *    frente, o que já foi escrito ou guardado vai para o fim;
 *  · criar propostas com a IA no formato desta prova, colar a resposta e guardar ("eac_disc_propostas");
 *  · a estratégia: fase pela distância da prova, meta de redações por semana, o método de cada redação e ajustes
 *    pelo histórico — a mesma meta e o mesmo próximo tema aparecem na agenda, com o atalho para cá.
 * ===================================================================== */

function dsNorm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
function dsHoje() { return typeof hubHoje === "function" ? hubHoje() : new Date().toISOString().slice(0, 10); }
function dsSemanaIni(d) { return typeof edSemanaCalendario === "function" ? edSemanaCalendario(d).ini : d; }
function dsDataBr(iso) { return String(iso || "").split("-").reverse().join("/"); }
/* dias até a prova: número (>= 0), -1 se já passou, null sem data */
function dsDiasProva(e) {
  /* a discursiva em data própria conta os dias até ELA, não até a objetiva */
  try {
    const cfg = lerEdital(e.texto || "").cfg || {};
    if (cfg.fase2 && cfg.fase2.prova) {
      const hoje = new Date(dsHoje() + "T00:00:00");
      const dias = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? Math.round((new Date(iso + "T00:00:00") - hoje) / 86400000) : null);
      const d2 = dias(cfg.fase2.prova), d1 = dias(cfg.prova);
      return { dias: d2 == null ? null : (d2 < 0 ? -1 : d2), prova: cfg.fase2.prova, separada: true, objetiva: cfg.prova || "", diasObjetiva: d1 };
    }
  } catch (err) {}
  try {
    const s = edSituacao(e);
    if (s.grupo === "encerrado") return { dias: -1, prova: s.prova || "" };
    return { dias: s.dias == null ? null : s.dias, prova: s.prova || "" };
  } catch (err) { return { dias: null, prova: "" }; }
}
function dsMinTxt(m) { return m ? (m.tipo === "pct" ? m.valor + "%" : m.valor + " " + t("ds_pontos_abrev")) : "—"; }
function dsMinPontos(dc) {
  if (!dc || !dc.minimo) return null;
  return dc.minimo.tipo === "pct" ? Math.round((dc.minimo.valor / 100) * dc.pontos * 10) / 10 : dc.minimo.valor;
}
function dsLinhasTxt(dc) { return (dc && edLinhasTxt(dc.linhas)) || t("ds_p_linhas_livre"); }

/* ---------------- as propostas guardadas ---------------- */
const DS_PROP_CHAVE = "eac_disc_propostas";
function dsPropostasTodas() {
  try { const v = JSON.parse(localStorage.getItem(DS_PROP_CHAVE) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
/* as abertas primeiro; dentro de cada grupo, a mais recente primeiro */
function dsPropostas(id) {
  return (dsPropostasTodas()[id] || []).slice().sort((a, b) => ((a.escrita ? 1 : 0) - (b.escrita ? 1 : 0)) || (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
}
function dsPropostasGravar(id, lista) {
  const v = dsPropostasTodas();
  v[id] = lista;
  try { localStorage.setItem(DS_PROP_CHAVE, JSON.stringify(v)); return true; } catch (e) { try { uiAlert(t("ds_red_sem_espaco")); } catch (e2) {} return false; }
}
function dsPropostaAdicionar(id, x) {
  const tema = String((x && x.tema) || "").trim();
  if (!tema) return { erro: t("ds_prop_falta_tema") };
  const lista = dsPropostasTodas()[id] || [];
  const enun = String(x.enunciado || "").trim();
  if (lista.some((p) => dsNorm(p.tema) === dsNorm(tema) && dsNorm(p.enunciado) === dsNorm(enun))) return { erro: t("ds_prop_repetida", { t: tema }) };
  const p = { id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), d: dsHoje(), tema: tema.slice(0, 200),
    disc: String(x.disc || "").slice(0, 120), enunciado: enun.slice(0, 4000), espelho: String(x.espelho || "").trim().slice(0, 6000),
    fonte: x.fonte === "ia" ? "ia" : "sugestao", escrita: false };
  if (!dsPropostasGravar(id, lista.concat([p]))) return { erro: t("ds_red_sem_espaco") };
  try { reg("DISCURSIVAS", "proposta guardada", tema.slice(0, 60) + " · " + p.fonte); } catch (e) {}
  return p;
}
function dsPropostaApagar(id, pid) { return dsPropostasGravar(id, (dsPropostasTodas()[id] || []).filter((p) => p.id !== pid)); }
/* escrever a redação de uma proposta a marca como escrita (pelo tema) */
function dsPropostaMarcarEscrita(id, tema) {
  const lista = dsPropostasTodas()[id] || [];
  const n = dsNorm(tema);
  const p = lista.find((x) => !x.escrita && dsNorm(x.tema) === n);
  if (!p) return null;
  p.escrita = true;
  dsPropostasGravar(id, lista);
  return p.id;
}

/* a disciplina que a IA escreveu, trazida para o nome do edital */
function dsAcharDisc(nome, lista) {
  const n = dsNorm(nome);
  if (!n) return "";
  return (lista || []).find((x) => dsNorm(x) === n) || (lista || []).find((x) => dsNorm(x).indexOf(n) >= 0 || n.indexOf(dsNorm(x)) >= 0) || String(nome).trim();
}

/* a resposta da IA: blocos com os rótulos TEMA / DISCIPLINA / ENUNCIADO / ESPELHO (com ou sem **, #, numeração) */
function dsPropostasLer(texto, disciplinas) {
  const rot = /^\s*(?:[#>*\-\d.)\s]*)\**\s*(tema|disciplina|enunciado|espelho(?:\s+de\s+corre[cç][aã]o)?)\s*\**\s*[:：]\s*\**\s*(.*)$/i;
  const out = [];
  let cur = null, campo = null;
  String(texto || "").replace(/\r/g, "").split("\n").forEach((ln) => {
    const m = ln.match(rot);
    if (m) {
      const k0 = dsNorm(m[1]);
      const k = k0.indexOf("espelho") === 0 ? "espelho" : k0 === "disciplina" ? "disc" : k0;
      if (k === "tema" || !cur) { cur = { tema: "", disc: "", enunciado: "", espelho: "" }; out.push(cur); }
      campo = k;
      const v = m[2].replace(/\*+\s*$/, "").trim();
      cur[campo] = cur[campo] ? cur[campo] + "\n" + v : v;
      return;
    }
    if (cur && campo) cur[campo] += "\n" + ln;
  });
  return out.map((p) => ({ tema: p.tema.trim().split("\n")[0].trim(), disc: dsAcharDisc(p.disc.trim().split("\n")[0], disciplinas),
    enunciado: p.enunciado.trim(), espelho: p.espelho.trim() })).filter((p) => p.tema && (p.enunciado || p.espelho));
}

/* ---------------- sugestão de temas pelo que o edital exige ---------------- */
function dsSugerirTemas(e, plano, dc, disc, n) {
  if (!plano || !plano.itens) return [];
  const alvo = ((dc && dc.disciplinas) || []).map(dsNorm);
  const quer = disc ? dsNorm(disc) : null;
  const ja = [].concat(dsRedacoes(e.id).map((x) => x.tema), dsPropostas(e.id).map((x) => x.tema)).map(dsNorm).filter(Boolean);
  const itens = plano.itens.filter((i) => {
    const d = dsNorm(i.disciplina);
    return (!alvo.length || alvo.indexOf(d) >= 0) && (!quer || d === quer);
  });
  const maxB = Math.max(1, ...itens.map((i) => i.bruto || 0));
  const lista = itens.map((i) => {
    const nm = dsNorm(i.nome);
    /* igual, ou um contém o outro quando o menor tem corpo (6+ letras): "Tema 30" não "contém" o tópico "a" */
    const treinado = ja.some((x) => x === nm || (Math.min(x.length, nm.length) >= 6 && (x.indexOf(nm) >= 0 || nm.indexOf(x) >= 0)));
    let score = ((i.bruto || 0) / maxB) * 100;
    if (i.fase2) score *= 1.5;
    if (i.faixa === "alta") score *= 1.2;
    if (treinado) score *= 0.35;
    const motivos = [];
    if (i.fase2) motivos.push(t("ds_sug_m_fase2"));
    if (i.peso >= 4) motivos.push(t("ds_sug_m_peso", { p: i.peso }));
    motivos.push(t(treinado ? "ds_sug_m_ja" : "ds_sug_m_novo"));
    if (!i.feito) motivos.push(t("ds_sug_m_estudar"));
    return { disc: i.disciplina, topico: i.nome, peso: i.peso, discPeso: i.disciplinaPeso, feito: !!i.feito, treinado, fase2: !!i.fase2, motivos, score: Math.round(score) };
  }).sort((a, b) => b.score - a.score || String(a.topico).localeCompare(String(b.topico)));
  if (quer) return lista.slice(0, n || 6);
  /* (19.79.0) RODÍZIO ENTRE AS DISCIPLINAS. Só pelo peso, as 6 sugestões do ISS Caruaru eram todas de Sistema Tributário
   * e Contabilidade, Constitucional e Administrativo — que também caem na discursiva — nunca apareciam. Agora vem o melhor
   * tema de cada disciplina, depois o segundo de cada, e assim por diante. Primeiro a disciplina com menos temas já
   * escritos ou guardados (a que você menos treinou); no empate, a do tema mais forte. */
  const porD = {};
  lista.forEach((x) => { (porD[x.disc] || (porD[x.disc] = [])).push(x); });
  const jaD = {};
  [].concat(dsRedacoes(e.id), dsPropostas(e.id)).forEach((x) => { if (x.disc) jaD[dsNorm(x.disc)] = (jaD[dsNorm(x.disc)] || 0) + 1; });
  const ordem = Object.keys(porD).sort((a, b) => (jaD[dsNorm(a)] || 0) - (jaD[dsNorm(b)] || 0) || porD[b][0].score - porD[a][0].score);
  const out = [];
  for (let k = 0; out.length < (n || 6) && ordem.some((d) => porD[d][k]); k++) {
    ordem.forEach((d) => { if (porD[d][k] && out.length < (n || 6)) out.push(porD[d][k]); });
  }
  return out;
}

/* ---------------- os pedidos à IA ---------------- */
function dsPromptProposta(e, dc, disc, temas, n) {
  const discs = disc ? [disc] : (dc.disciplinas || []);
  const lista = (temas || []).length ? temas.map((x) => "- " + x).join("\n") : t("ds_prompt_sem_temas");
  const extra = (dc.corrigida ? " " + t("ds_prompt_corrigida", { n: dc.corrigida }) : "")
    + (dc.fase2 ? " " + t("ds_prompt_f2", { d: dsDataBr(dc.fase2.prova), o: dsDataBr(dc.fase2.objetiva) }) : "");
  return t("ds_prompt_prop", { c: e.nome || "", p: dc.pontos || "?", m: dsMinTxt(dc.minimo), l: dsLinhasTxt(dc), d: discs.join("; ") || "-",
    temas: lista, n: n || 1, corr: extra });
}
function dsPromptCorrecao(e, dc, p) {
  return t("ds_prompt_corr", { c: e.nome || "", p: dc.pontos || "?", l: dsLinhasTxt(dc), m: dsMinTxt(dc.minimo), tema: p.tema,
    enun: p.enunciado || p.tema, esp: p.espelho || t("ds_prompt_sem_espelho") });
}
function dsCopiar(texto, aviso) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).catch(() => {}); } catch (err) {}
  try { toastMsg(aviso, 6000); } catch (err) {}
}

/* ---------------- a estratégia ---------------- */
function dsRedacoesNaSemana(id) { const ini = dsSemanaIni(dsHoje()); return dsRedacoes(id).filter((x) => dsSemanaIni(x.d) === ini).length; }
/* as redações desta semana; sem nenhuma registrada, o "treinei" marcado vale uma */
function dsFeitasSemana(id) { const n = dsRedacoesNaSemana(id); return n || (dsTreinos(id)[dsSemanaIni(dsHoje())] ? 1 : 0); }
function dsEstrategia(dias, res, dc, sit) {
  let fase, meta;
  if (dias == null) { fase = "sem_data"; meta = 1; }
  else if (dias < 0) { fase = "passou"; meta = 0; }
  else if (dias <= 21) { fase = "reta"; meta = 2; }
  else if (dias <= 60) { fase = "intensivo"; meta = 3; }
  else if (dias <= 120) { fase = "construcao"; meta = 2; }
  else { fase = "fundacao"; meta = 1; }
  const ajustes = [];
  /* (19.76.0) discursiva em data própria com a objetiva ainda pela frente: até a objetiva, 1 redação por semana para não
   * perder a mão; o grosso do treino fica para a janela entre as provas (a fase muda sozinha quando a objetiva passa) */
  if (fase !== "passou" && sit && sit.separada && sit.diasObjetiva != null && sit.diasObjetiva >= 0) {
    meta = 1;
    ajustes.push(t("ds_aj_separada", { o: dsDataBr(sit.objetiva), d: dsDataBr(sit.prova), n: dias - sit.diasObjetiva }));
  }
  if (fase !== "passou") {
    if (!res || !res.n) ajustes.push(t("ds_aj_primeira"));
    else {
      if (res.minPct != null && res.media5 != null && res.media5 < res.minPct + 10) {
        meta = Math.min(4, meta + 1);
        ajustes.push(t(res.media5 < res.minPct ? "ds_aj_abaixo" : "ds_aj_perto", { m: res.media5, c: res.minPct }));
      }
      if (res.fora) ajustes.push(t("ds_aj_tamanho", { n: res.fora }));
      if (res.tendencia === "caindo") ajustes.push(t("ds_aj_caindo"));
      if (res.tendencia === "subindo") ajustes.push(t("ds_aj_subindo"));
    }
    if (dc && dc.corrigida) ajustes.push(t("ds_aj_corrigida", { n: dc.corrigida }));
  }
  return { fase, meta, dias, nome: t("ds_fase_" + fase), foco: t("ds_fase_" + fase + "_foco"), passos: [1, 2, 3, 4, 5, 6].map((k) => t("ds_metodo_" + k)), ajustes };
}
/* o próximo tema: a proposta aberta mais recente; sem nenhuma, a primeira sugestão */
function dsProximoTema(e, plano, dc) {
  const ab = dsPropostas(e.id).filter((p) => !p.escrita);
  if (ab.length) return { tema: ab[0].tema, disc: ab[0].disc, proposta: true };
  const s = dsSugerirTemas(e, plano, dc, null, 1)[0];
  return s ? { tema: s.topico, disc: s.disc, proposta: false } : null;
}

/* ---------------- os critérios de correção ---------------- */
function dsCriterios(dc) {
  const out = [
    { k: "conteudo", tx: t("ds_crit_conteudo") },
    { k: "estrutura", tx: t("ds_crit_estrutura") },
    { k: "lingua", tx: t("ds_crit_lingua") },
    { k: "tamanho", tx: t("ds_crit_tamanho", { l: dsLinhasTxt(dc) }) },
    { k: "zero", tx: t("ds_crit_zero") },
  ];
  if (dc.minimo) out.push({ k: "corte", tx: t("ds_crit_corte", { m: dsMinTxt(dc.minimo), x: dsMinPontos(dc), p: dc.pontos }) });
  if (dc.corrigida) out.push({ k: "corrigida", tx: t("ds_crit_corrigida", { n: dc.corrigida }) });
  return out;
}

/* ---------------- critérios e cortes: as disciplinas da discursiva ---------------- */
function dsCortes(plano, dc) {
  if (!plano) return [];
  let pan = [];
  try { pan = panoramaDisciplinas(plano); } catch (e) { pan = []; }
  const nomes = (dc.disciplinas || []).length ? dc.disciplinas : pan.map((d) => d.nome);
  const linhas = nomes.map((nome) => {
    const d = pan.find((x) => dsNorm(x.nome) === dsNorm(nome));
    const b = (plano.blocos || []).find((x) => (x.disciplinas || []).some((y) => dsNorm(y) === dsNorm(nome)));
    return { nome: d ? d.nome : nome, existe: !!d, peso: d ? d.peso : null, fatia: d ? d.fatia || 0 : 0, cobertura: d ? d.pesoFeito : null,
      bloco: b && b.minPct != null ? { nome: b.nome, minPct: b.minPct, pct: b.pct, abaixo: b.abaixo, apertado: b.apertado } : null };
  });
  const soma = linhas.reduce((a, x) => a + x.fatia, 0) || 1;
  linhas.forEach((x) => { x.naDisc = Math.round((x.fatia / soma) * 100); });
  return linhas.sort((a, b) => b.naDisc - a.naDisc);
}

/* ---------------- editar a discursiva do edital ---------------- */
function dsValidarDiscursiva(d) {
  if (!d || !(d.pontos > 0)) return t("ds_ed_err_pontos");
  if (d.minimo) {
    if (!(d.minimo.valor > 0)) return t("ds_ed_err_min");
    if (d.minimo.tipo === "pct" && d.minimo.valor > 100) return t("ds_ed_err_min");
    if (d.minimo.tipo !== "pct" && d.minimo.valor > d.pontos) return t("ds_ed_err_min_pts", { p: d.pontos });
  }
  /* só o máximo também vale ("até 30 linhas"); com os dois, o mínimo não passa do máximo */
  if (d.linhas && (!(d.linhas.max > 0) || (d.linhas.min > 0 && d.linhas.max < d.linhas.min))) return t("ds_ed_err_linhas");
  if (!(d.disciplinas || []).length) return t("ds_ed_err_disc");
  return "";
}
/* troca só a linha "# discursiva" (d = null tira); os tópicos e o resto do texto ficam como estão */
function dsTextoComDiscursiva(texto, d) {
  const sem = String(texto || "").split("\n").filter((ln) => !/^\s*#\s*discursiva\s*(\||$)/i.test(ln));
  if (d) {
    const linha = edLinhaDiscursiva(d);
    const k = sem.findIndex((ln) => /^\s*#/.test(ln));
    let fim = k;
    while (fim >= 0 && fim + 1 < sem.length && /^\s*#/.test(sem[fim + 1])) fim++;
    if (k >= 0) sem.splice(fim + 1, 0, linha); else sem.unshift(linha);
  }
  return sem.join("\n");
}
function dsDiscursivaGravar(id, d) {
  const e = (typeof editais !== "undefined" ? editais : []).find((x) => x.id === id);
  if (!e) return { erro: "?" };
  if (d) { const f = dsValidarDiscursiva(d); if (f) return { erro: f }; }
  const antes = e.texto || "";
  const novo = dsTextoComDiscursiva(antes, d);
  const conta = (tx) => { const r = lerEdital(tx); return r.disciplinas.length + "|" + r.disciplinas.reduce((a, x) => a + x.topicos.length, 0); };
  if (conta(novo) !== conta(antes)) return { erro: t("ep_erro_conta") };
  e.texto = novo;
  edSalvarLista();
  try { if (typeof editalAtual !== "undefined" && editalAtual === id && document.getElementById("editalTexto")) document.getElementById("editalTexto").value = novo; } catch (err) {}
  try { reg("DISCURSIVAS", d ? "discursiva do edital atualizada" : "discursiva tirada do edital", (e.nome || id) + (d ? " · " + edLinhaDiscursiva(d) : "")); } catch (err) {}
  return { ok: true, antes, novo };
}
function dsDesfazerTexto(id, antes) {
  const e = editais.find((x) => x.id === id);
  if (!e) return;
  e.texto = antes;
  edSalvarLista();
  try { if (editalAtual === id && document.getElementById("editalTexto")) document.getElementById("editalTexto").value = antes; } catch (err) {}
  dsRender();
}

function dsPintarEditor(box, e, r, dc) {
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const d0 = dc || { pontos: 0, objetiva: 0, minimo: null, linhas: null, corrigida: 0, disciplinas: [] };
  const f = el("div", "ds-red-form ds-ed-form");
  const campo = (rot, inp, dica) => { const l = el("label", "ds-red-campo"); l.append(el("span", "", rot), inp); if (dica) l.title = dica; f.append(l); return inp; };
  const num = (id, v, ph) => { const x = document.createElement("input"); x.type = "number"; x.min = "0"; x.step = "any"; x.className = "ep-num"; x.id = id + "_" + e.id; if (v) x.value = v; if (ph) x.placeholder = ph; return x; };
  const iPts = campo(t("ds_ed_pontos"), num("dsEdPts", d0.pontos), t("ds_ed_pontos_dica"));
  const iObj = campo(t("ds_ed_objetiva"), num("dsEdObj", d0.objetiva), t("ds_ed_objetiva_dica"));
  const iMin = campo(t("ds_ed_minimo"), num("dsEdMin", d0.minimo ? d0.minimo.valor : ""), t("ds_ed_minimo_dica"));
  const sMin = document.createElement("select"); sMin.id = "dsEdMinTipo_" + e.id;
  [["pct", "%"], ["abs", t("ds_pontos_abrev")]].forEach(([v, tx]) => { const o = document.createElement("option"); o.value = v; o.textContent = tx; sMin.append(o); });
  sMin.value = d0.minimo && d0.minimo.tipo !== "pct" ? "abs" : "pct";
  campo(t("ds_ed_min_tipo"), sMin);
  const iLa = campo(t("ds_ed_lin_min"), num("dsEdLinA", d0.linhas ? d0.linhas.min : ""));
  const iLb = campo(t("ds_ed_lin_max"), num("dsEdLinB", d0.linhas ? d0.linhas.max : ""));
  const iCor = campo(t("ds_ed_corrigida"), num("dsEdCor", d0.corrigida), t("ds_ed_corrigida_dica"));
  box.append(f);
  /* as disciplinas: as do edital, marcadas as que já estão na discursiva */
  const nomes = ((r && r.disciplinas) || []).filter((x) => !x.inativa).map((x) => x.nome);
  (d0.disciplinas || []).forEach((x) => { if (!nomes.some((y) => dsNorm(y) === dsNorm(x))) nomes.push(x); });
  const dw = el("div", "ds-ed-discs");
  dw.append(el("div", "ds-red-campo", t("ds_ed_disciplinas")));
  const marcas = nomes.map((nome, k) => {
    const l = el("label", "ds-ed-disc");
    const ck = document.createElement("input"); ck.type = "checkbox"; ck.id = "dsEdDisc_" + e.id + "_" + k; ck.value = nome;
    ck.checked = (d0.disciplinas || []).some((x) => dsNorm(x) === dsNorm(nome));
    l.append(ck, el("span", "", nome));
    dw.append(l);
    return ck;
  });
  box.append(dw);
  const msg = el("p", "nota ds-red-msg");
  const bar = el("div", "ds-ia");
  const temFormato = !!(dc && dc.pontos > 0);
  const salvar = el("button", "btn-min btn-min-ok", t(temFormato ? "ds_ed_salvar" : "ds_ed_cadastrar"));
  salvar.type = "button"; salvar.id = "btnDsEdSalvar_" + e.id;
  const ler = () => {
    const n = (x) => (x.value === "" ? 0 : Number(String(x.value).replace(",", ".")));
    const d = { pontos: n(iPts), objetiva: n(iObj), minimo: n(iMin) > 0 ? { tipo: sMin.value === "abs" ? "abs" : "pct", valor: n(iMin) } : null,
      linhas: n(iLa) || n(iLb) ? { min: n(iLa), max: n(iLb) } : null, corrigida: n(iCor), disciplinas: marcas.filter((c) => c.checked).map((c) => c.value) };
    return d;
  };
  salvar.onclick = async () => {
    const d = ler();
    const falha = dsValidarDiscursiva(d);
    if (falha) { msg.textContent = falha; return; }
    const antesL = temFormato ? edLinhaDiscursiva(dc) : t("ds_ed_nenhuma");
    if (!(await uiConfirm(t("ds_ed_conf", { e: e.nome || "", a: antesL, d: edLinhaDiscursiva(d) }), { ok: t("ds_ed_conf_ok") }))) return;
    const res = dsDiscursivaGravar(e.id, d);
    if (res.erro) { msg.textContent = res.erro; return; }
    dsRender();
    try { toastDesfazer(t("ds_ed_ok"), () => dsDesfazerTexto(e.id, res.antes)); } catch (err) {}
    try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (err) {}
  };
  bar.append(salvar);
  if (temFormato) {
    const tirar = el("button", "btn-min", t("ds_ed_tirar"));
    tirar.type = "button";
    tirar.onclick = async () => {
      if (!(await uiConfirm(t("ds_ed_tirar_conf", { e: e.nome || "" }), { ok: t("ds_ed_tirar_ok"), perigo: true }))) return;
      const res = dsDiscursivaGravar(e.id, null);
      if (res.erro) { msg.textContent = res.erro; return; }
      dsRender();
      try { toastDesfazer(t("ds_ed_tirada"), () => dsDesfazerTexto(e.id, res.antes)); } catch (err) {}
    };
    bar.append(tirar);
  }
  box.append(bar, msg, el("p", "nota", t("ds_ed_ajuda")));
  if (dc && dc.fase2) box.append(el("p", "nota", t("ds_ed_ajuda_f2", { d: dsDataBr(dc.fase2.prova) })));
}

/* ---------------- os pedaços do cartão ---------------- */
function dsIrPara(id) {
  if (typeof trocarModo === "function") trocarModo("discursivas"); else dsRender();
  setTimeout(() => {
    const c = document.getElementById("dsCard_" + id);
    if (!c) return;
    try { c.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
    c.classList.add("ds-flash");
    setTimeout(() => c.classList.remove("ds-flash"), 1800);
  }, 0);
}
function dsAbrirEdital(id, depois) {
  if (typeof hubAbrirEdital === "function") hubAbrirEdital(id);
  if (typeof trocarModo === "function") trocarModo("edital");
  if (depois) setTimeout(depois, 0);
}
/* abre o registro de redação já com o tema e a disciplina */
function dsEscreverTema(id, tema, disc) {
  const det = document.getElementById("dsRed_" + id);
  if (det) det.open = true;
  const it = document.getElementById("dsRedTema_" + id);
  if (it) { it.value = tema; try { it.focus(); } catch (e) {} }
  const s = document.getElementById("dsRedDisc_" + id);
  if (s && disc) { const o = [...s.options].find((x) => dsNorm(x.value) === dsNorm(disc)); if (o) s.value = o.value; }
  try { toastMsg(t("ds_escrever_toast", { t: tema }), 6000); } catch (e) {}
}

function dsPintarEstrategia(card, e, dc, sit) {
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const res = dsRedacoesResumo(e.id, dc);
  const est = dsEstrategia(sit.dias, res, dc, sit);
  const feitas = dsFeitasSemana(e.id);
  const box = el("div", "ds-est ds-est-" + est.fase);
  box.id = "dsEst_" + e.id;
  box.append(el("div", "ds-sub-tit", t("ds_est_tit", { f: est.nome })));
  /* (19.86.0) A FASE NUMA LINHA DO TEMPO, não num parágrafo: as quatro, a de agora destacada */
  if (["fundacao", "construcao", "intensivo", "reta"].indexOf(est.fase) >= 0) {
    const tl = el("div", "ds-fases");
    ["fundacao", "construcao", "intensivo", "reta"].forEach((f) => {
      const c = el("span", "ds-fase" + (f === est.fase ? " atual" : ""));
      c.append(el("span", "ds-fase-n", t("ds_fase_curta_" + f)), el("span", "ds-fase-d", t("ds_fase_dias_" + f)));
      tl.append(c);
    });
    box.append(tl);
  }
  /* a meta da semana em bolinhas: ● feita, ○ por fazer */
  if (est.meta) {
    const meta = el("div", "ds-est-meta" + (feitas >= est.meta ? " ds-est-ok" : ""));
    const bol = el("span", "ds-bolas");
    for (let k = 0; k < Math.max(est.meta, feitas); k++) bol.append(el("span", "ds-bola" + (k < feitas ? " feita" : ""), k < feitas ? "●" : "○"));
    meta.append(bol, el("span", "", t(feitas >= est.meta ? "ds_est_meta_ok" : "ds_est_meta", { n: feitas, m: est.meta })));
    box.append(meta);
  }
  box.append(el("p", "ds-est-foco", est.foco));
  if (est.ajustes.length) {
    const aj = el("details", "ds-det ds-est-ajd");
    aj.append(el("summary", "", t("ds_est_ajustes", { n: est.ajustes.length })));
    const ul = el("ul", "ds-est-aj"); est.ajustes.forEach((a) => ul.append(el("li", "", a)));
    aj.append(ul);
    box.append(aj);
  }
  const met = el("details", "ds-det");
  met.append(el("summary", "", t("ds_metodo_tit")));
  const ol = el("ol", "ds-est-passos"); est.passos.forEach((p) => ol.append(el("li", "", p)));
  met.append(ol);
  box.append(met);
  card.append(box);
  return est;
}

function dsPintarTreino(card, e) {
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const tr = el("div", "ds-treino");
  tr.append(el("div", "ds-sub-tit", t("ds_treino_tit")));
  const sem8 = dsUltimasSemanas(8);
  const feitos = dsTreinos(e.id);
  /* (19.78.0) o mesmo mapa do diário: cada redação no dia em que foi escrita, com a cor da nota contra o corte; a coluna
   * da semana diz quantas redações (ou "treinou", quando só a semana foi marcada) */
  if (typeof mpMini === "function" && typeof edMapaDeCalor === "function") {
    const dc = dsDiscursivaDe(e).dc || {};
    const minPct = dc.minimo && dc.minimo.tipo === "pct" ? dc.minimo.valor : null;
    const porDia = {};
    dsRedacoes(e.id).forEach((x) => { (porDia[x.d] || (porDia[x.d] = [])).push(x); });
    const M = edMapaDeCalor(dsHoje(), typeof hubPref === "function" ? hubPref("dias", 5) : 5, [], { semanas: 8 });
    tr.append(mpMini(M, {
      celula: (d) => {
        const rs = porDia[d.iso];
        if (!rs) return { cls: "di-mp-n0", txt: "", tip: d.cod + " " + d.iso.split("-").reverse().join("/"), semFalta: true };
        const ps = rs.map(dsRedacaoPct).filter((p) => p != null);
        const p = ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length) : null;
        const cls = p == null || minPct == null ? "ds-mp-ok" : p < minPct ? "ds-mp-ruim" : p < minPct + 10 ? "ds-mp-apert" : "ds-mp-ok";
        return { cls, txt: p == null ? "✍" : p + "%", semFalta: true,
          tip: rs.map((x) => x.tema + " · " + x.nota + "/" + x.max).join("\n") };
      },
      total: (s) => {
        const n = s.dias.reduce((a, d) => a + (porDia[d.iso] ? porDia[d.iso].length : 0), 0);
        return { txt: n ? t("ds_mp_n", { n }) : feitos[s.ini] ? t("ds_mp_treinou") : "—", sub: "" };
      },
      onDia: (iso) => { if (porDia[iso]) { const det = document.getElementById("dsRed_" + e.id); if (det) { det.open = true; try { det.scrollIntoView({ block: "nearest" }); } catch (err) {} } } },
      legenda: t(minPct == null ? "ds_mp_leg_sem" : "ds_mp_leg", { m: minPct }),
    }));
  }
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
}


/* =====================================================================
 * (19.86.0) A TELA EM ABAS, O FLUXO DA IA EM TRÊS PASSOS, O TEXTO DA PROVA E AS PROPOSTAS COM FILTRO
 *
 * O RELATO: "cheio de texto, confusão, sem limites claros entre os editais, sem como reorganizar"; "os campos de copiar
 * e colar confundem — onde colo a resposta da IA?"; "quero saber rápido o modelo de texto que vou escrever no dia";
 * "nas propostas salvas, filtro por edital e disciplina e navegar fácil entre os temas"; "o peso da tabela é na nota
 * final ou na discursiva?". O que mudou:
 *  · UM EDITAL POR VEZ: abas no topo (na ordem da prova, com os dias que faltam); o cartão tem borda e cabeçalho próprios;
 *  · DENTRO DO EDITAL, SEÇÕES EM ABAS: Visão geral · O texto da prova · Temas · Propostas · Redações · Critérios · Editar
 *    (a escolha fica guardada); o resto continua montado, só escondido;
 *  · TODA IDA À IA É O MESMO BLOCO: ① copie o pedido (botão) → ② cole na IA → ③ cole a resposta AQUI (a caixa fica
 *    logo abaixo do botão que copiou) → guardar. Nada de caixa de colar longe do botão de copiar;
 *  · "O TEXTO DA PROVA": tamanho, tempo, a estrutura com as linhas de cada parte, as regras que tiram ponto e um exemplo
 *    de resposta modelo (o último guardado, ou o pedido para gerar um);
 *  · PROPOSTAS: filtro por edital, disciplina, situação e busca; lista curta; leitor com ◀ anterior · próxima ▶, a
 *    resposta modelo e a correção de cada uma;
 *  · A TABELA DO PESO diz o que mede: "parte na discursiva" (entre as disciplinas em que ela cai) e "na nota final".
 * ===================================================================== */
function dsEl(tag, cls, txt) { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }

/* ① ② ③ — o mesmo bloco para toda ida à IA */
function dsFluxoIA(o) {
  const box = dsEl("div", "ds-fluxo");
  if (o.id) box.id = o.id;
  if (o.titulo) box.append(dsEl("div", "ds-fluxo-tit", o.titulo));
  if (o.ajuda) box.append(dsEl("p", "nota", o.ajuda));
  const passo = (n, txt) => { const p = dsEl("div", "ds-passo"); p.append(dsEl("span", "ds-passo-n", n), dsEl("span", "ds-passo-tx", txt)); box.append(p); return p; };
  const p1 = passo("1", t("ds_f_p1"));
  const bc = dsEl("button", "btn-min btn-min-ok", o.copiarRot || t("ds_f_copiar"));
  bc.type = "button"; if (o.idCopiar) bc.id = o.idCopiar;
  p1.append(bc);
  passo("2", t("ds_f_p2"));
  const p3 = passo("3", o.colarRot || t("ds_f_p3"));
  const ta = document.createElement("textarea");
  ta.className = "ds-colar"; ta.rows = o.linhas || 5; if (o.idTa) ta.id = o.idTa;
  ta.placeholder = o.ph || t("ds_f_ph");
  const bl = dsEl("button", "btn-min btn-min-ok", o.lerRot || t("ds_f_ler"));
  bl.type = "button"; if (o.idLer) bl.id = o.idLer;
  const msg = dsEl("p", "nota ds-red-msg");
  bc.onclick = () => { dsCopiar(o.prompt(), o.aviso || t("ds_f_copiado")); box.classList.add("ds-fluxo-copiado"); try { ta.focus(); } catch (e) {} };
  bl.onclick = () => { const r = o.aoLer(String(ta.value || "")); if (r && r.erro) msg.textContent = r.erro; };
  box.append(ta, bl, msg);
  return box;
}

/* ---------------- a tabela do peso, dizendo o que mede ---------------- */
function dsPintarCortes(card, plano, dc, rd) {
  const el = dsEl;
  const box = el("div", "ds-cortes");
  box.append(el("div", "ds-sub-tit", t("ds_cortes_tit")));
  const res = [];
  if (dc.minimo) res.push(t("ds_cortes_min", { m: dsMinTxt(dc.minimo), x: dsMinPontos(dc), p: dc.pontos }));
  else res.push(t("ds_cortes_sem_min"));
  if (rd && rd.share != null) res.push(t("ds_cortes_share", { s: rd.share, o: dc.objetiva || "?" }));
  box.append(el("p", "nota", res.join(" ")));
  const linhas = dsCortes(plano, dc);
  if (linhas.length) {
    /* o corte do bloco: igual em todas as linhas → uma frase em cima, não a mesma frase vermelha em cada linha */
    const chaveB = (x) => (x.bloco ? x.bloco.nome + "|" + x.bloco.minPct : "");
    const mesmo = linhas.every((x) => chaveB(x) === chaveB(linhas[0])) && linhas[0].bloco;
    if (mesmo) {
      const b = linhas[0].bloco;
      box.append(el("p", "ds-cortes-comum" + (b.abaixo ? " ds-cortes-ruim" : b.apertado ? " ds-cortes-apert" : ""),
        t("ds_cortes_comum", { n: linhas.length }) + " " + t("ds_cortes_bloco", { b: b.nome, m: b.minPct, c: b.pct })));
    }
    const share = rd && rd.share != null ? rd.share : null;
    const cab = el("div", "ds-cortes-lin ds-cortes-cab" + (mesmo ? " ds-cortes-sem-b" : ""));
    [t("ds_cortes_c_disc"), t("ds_cortes_c_parte"), t("ds_cortes_c_final"), t("ds_cortes_c_cob")].concat(mesmo ? [] : [t("ds_cortes_c_bloco")])
      .forEach((x) => cab.append(el("span", "", x)));
    box.append(cab);
    linhas.forEach((x) => {
      const ln = el("div", "ds-cortes-lin" + (mesmo ? " ds-cortes-sem-b" : "") + (!mesmo && x.bloco && x.bloco.abaixo ? " ds-cortes-ruim" : !mesmo && x.bloco && x.bloco.apertado ? " ds-cortes-apert" : ""));
      ln.append(el("span", "ds-cortes-n", x.nome + (x.existe ? "" : " " + t("ds_cortes_nao_existe"))));
      ln.append(el("span", "ds-num", x.existe ? x.naDisc + "%" : "—"));
      ln.append(el("span", "ds-num", x.existe && share != null ? (Math.round(share * x.naDisc / 10) / 10).toString().replace(".", ",") + "%" : "—"));
      ln.append(el("span", "ds-num", x.cobertura == null ? "—" : x.cobertura + "%"));
      if (!mesmo) ln.append(el("span", "ds-cortes-b", x.bloco ? t("ds_cortes_bloco", { b: x.bloco.nome, m: x.bloco.minPct, c: x.bloco.pct }) : t("ds_cortes_sem_bloco")));
      box.append(ln);
    });
    const aj1 = el("details", "ds-info"); aj1.append(el("summary", "", "ⓘ " + t("ds_info_cortes")), el("p", "nota", t("ds_cortes_ajuda2", { s: share != null ? share : "?" }))); box.append(aj1);
  }
  card.append(box);
}

function dsPintarCriterios(card, dc) {
  const el = dsEl;
  const det = el("details", "ds-det ds-crit");
  det.open = true;
  det.append(el("summary", "", t("ds_crit_tit")));
  const ul = el("ul", "ds-crit-lista");
  dsCriterios(dc).forEach((c) => { const li = el("li", "ds-crit-" + c.k); li.append(el("strong", "", t("ds_crit_n_" + c.k) + ": "), document.createTextNode(c.tx)); ul.append(li); });
  det.append(ul, el("p", "nota", t("ds_crit_nota")));
  card.append(det);
}

/* ---------------- propostas: atualizar, modelo, correção ---------------- */
function dsPropostaAtualizar(id, pid, patch) {
  const lista = dsPropostasTodas()[id] || [];
  const p = lista.find((x) => x.id === pid);
  if (!p) return null;
  Object.assign(p, patch || {});
  dsPropostasGravar(id, lista);
  return p;
}
function dsPromptModelo(e, dc, tema, disc, enun) {
  return t("ds_prompt_modelo", { c: e.nome || "", p: dc.pontos || "?", l: dsLinhasTxt(dc), d: disc || (dc.disciplinas || []).join("; ") || "-", tema,
    q: enun ? t("ds_prompt_modelo_q", { e: enun }) : t("ds_prompt_modelo_sem_q") });
}
/* a resposta colada: "ENUNCIADO: …" (quando a IA criou a questão) e "LINHAS: n" saem do texto do modelo */
function dsModeloLer(txt) {
  let s = String(txt || "").replace(/\r/g, "").trim();
  let enun = "";
  const me = s.match(/^\s*\**\s*ENUNCIADO\s*\**\s*:\s*\**\s*([\s\S]*?)\n\s*\n/i);
  if (me) { enun = me[1].trim(); s = s.slice(me[0].length).trim(); }
  let linhas = null;
  const ml = s.match(/\n\s*\**\s*LINHAS\s*\**\s*:\s*\**\s*(\d+)[^\n]*\s*$/i);
  if (ml) { linhas = Number(ml[1]); s = s.slice(0, ml.index).trim(); }
  s = s.replace(/^\s*\**\s*(RESPOSTA(\s+MODELO)?|MODELO)\s*\**\s*:\s*\**\s*/i, "");
  return { modelo: s, enunciado: enun, linhas };
}
/* a nota da correção colada: "NOTA: 28/40" */
function dsNotaDaCorrecao(txt) {
  const m = String(txt || "").match(/NOTA\s*\**\s*:\s*\**\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/i);
  return m ? { nota: Number(m[1].replace(",", ".")), max: Number(m[2].replace(",", ".")) } : null;
}

/* ---------------- O TEXTO DA PROVA ---------------- */
function dsPintarTextoDaProva(box, e, dc, plano) {
  const el = dsEl;
  box.append(el("div", "ds-sub-tit", t("ds_tx_tit")));
  const aj2 = el("details", "ds-info"); aj2.append(el("summary", "", "ⓘ " + t("ds_info_tx")), el("p", "nota", t("ds_tx_aj"))); box.append(aj2);
  const max = dc.linhas && dc.linhas.max ? dc.linhas.max : 0;
  const g = el("div", "ds-tx-grade");
  const par = (k, v) => g.append(el("span", "ds-tx-k", k), el("span", "ds-tx-v", v));
  par(t("ds_tx_tam"), dsLinhasTxt(dc));
  if (dc.pontos) par(t("ds_tx_vale"), t("ds_chip_pontos", { p: dc.pontos }));
  if (dc.minimo) par(t("ds_tx_min"), dsMinTxt(dc.minimo) + (dc.pontos ? " (" + dsMinPontos(dc) + " " + t("ds_pontos_abrev") + ")" : ""));
  const tempo = Math.max(40, Math.round((max || 30) * 2));
  par(t("ds_tx_tempo"), t("ds_tx_tempo_v", { n: tempo, a: Math.round(tempo * 0.15), b: Math.round(tempo * 0.7), c: Math.round(tempo * 0.15) }));
  box.append(g);
  /* a estrutura, com as linhas de cada parte */
  const est = el("div", "ds-tx-est");
  est.append(el("div", "ds-tx-k", t("ds_tx_estrutura")));
  const ol = el("ol", "ds-tx-partes");
  const L = max || 30;
  const li = (k, n) => ol.append(el("li", "", t(k, n)));
  li("ds_tx_intro", { a: Math.max(3, Math.round(L * 0.13)), b: Math.max(4, Math.round(L * 0.17)) });
  li("ds_tx_desenv", { a: Math.round(L * 0.65), b: Math.round(L * 0.72), p: L >= 25 ? "2 a 3" : "1 a 2" });
  li("ds_tx_concl", { a: Math.max(2, Math.round(L * 0.1)), b: Math.max(3, Math.round(L * 0.15)) });
  est.append(ol);
  /* (19.86.0) as partes numa barra, do tamanho das linhas de cada uma */
  const barra = el("div", "ds-tx-barra");
  [["intro", 15, "ds_tx_b_intro"], ["desenv", 70, "ds_tx_b_desenv"], ["concl", 15, "ds_tx_b_concl"]].forEach(([k, pct, rot]) => {
    const s0 = el("span", "ds-tx-seg ds-tx-seg-" + k, t(rot, { n: Math.round(L * pct / 100) }));
    s0.style.flexGrow = String(pct);
    barra.append(s0);
  });
  est.append(barra);
  if (!max) est.append(el("p", "nota", t("ds_tx_sem_linhas")));
  box.append(est);
  const ru = el("ul", "ds-tx-regras");
  [1, 2, 3, 4, 5].forEach((k) => ru.append(el("li", "", t("ds_tx_regra_" + k))));
  box.append(el("div", "ds-tx-k", t("ds_tx_regras")), ru);
  /* o exemplo: o último modelo guardado, ou pedir um */
  const comModelo = dsPropostas(e.id).filter((p) => p.modelo).sort((a, b) => String(b.modeloEm || b.d).localeCompare(String(a.modeloEm || a.d)));
  const ex = el("div", "ds-tx-exemplo");
  ex.append(el("div", "ds-sub-tit", t("ds_tx_ex_tit")));
  if (comModelo.length) {
    const p = comModelo[0];
    ex.append(el("p", "nota", t("ds_tx_ex_de", { t: p.tema, n: comModelo.length })));
    if (p.enunciado) { const q = el("details", "ds-det"); q.append(el("summary", "", t("ds_prop_enunciado")), el("div", "ds-prop-enun", p.enunciado)); ex.append(q); }
    ex.append(el("div", "ds-modelo", p.modelo));
    if (p.modeloLinhas) ex.append(el("p", "nota", t("ds_modelo_linhas", { n: p.modeloLinhas })));
    const ir = el("button", "btn-min", t("ds_tx_ex_outros"));
    ir.type = "button"; ir.onclick = () => { dsPropSel[e.id] = p.id; dsSecaoIr("propostas"); };
    ex.append(ir);
  } else {
    const s0 = dsSugerirTemas(e, plano, dc, null, 1)[0];
    const tema = s0 ? s0.topico : (dc.disciplinas || [])[0] || e.nome;
    ex.append(el("p", "nota", t("ds_tx_ex_nenhum", { t: tema })));
    ex.append(dsFluxoIA({ id: "dsTxModelo_" + e.id, idTa: "dsTxModeloTx_" + e.id, idLer: "btnDsTxModelo_" + e.id,
      copiarRot: t("ds_f_copiar_modelo"), prompt: () => dsPromptModelo(e, dc, tema, s0 ? s0.disc : "", ""),
      colarRot: t("ds_f_p3_modelo"), lerRot: t("ds_f_guardar_modelo"), linhas: 8,
      aoLer: (txt) => {
        const m = dsModeloLer(txt);
        if (m.modelo.length < 40) return { erro: t("ds_modelo_curto") };
        const ja = dsPropostas(e.id).find((x) => dsNorm(x.tema) === dsNorm(tema));
        const pid = ja ? ja.id : (dsPropostaAdicionar(e.id, { tema, disc: s0 ? s0.disc : "", enunciado: m.enunciado, fonte: "ia" }) || {}).id;
        if (!pid) return { erro: "?" };
        dsPropostaAtualizar(e.id, pid, { modelo: m.modelo, modeloLinhas: m.linhas, modeloEm: dsHoje(), enunciado: (ja && ja.enunciado) || m.enunciado });
        try { toastMsg(t("ds_modelo_ok"), 4000); } catch (x) {}
        dsRender();
        return {};
      } }));
  }
  box.append(ex);
}

/* ---------------- TEMAS: sugestões + criar com a IA (o fluxo único) ---------------- */
const dsDiscEscolhida = {};
function dsPintarSugestoes(card, e, plano, dc) {
  const el = dsEl;
  const box = el("div", "ds-sug");
  box.id = "dsSug_" + e.id;
  box.append(el("div", "ds-sub-tit", t("ds_sug_tit")));
  const aj0 = el("details", "ds-info"); aj0.append(el("summary", "", "ⓘ " + t("ds_info_sug")), el("p", "nota", t("ds_sug_ajuda"))); box.append(aj0);
  const lin = el("div", "ds-ia");
  const sel = document.createElement("select"); sel.id = "dsSugDisc_" + e.id; sel.className = "ds-sel";
  [""].concat(dc.disciplinas || []).forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = n || t("ds_sug_todas"); sel.append(o); });
  sel.value = dsDiscEscolhida[e.id] || "";
  sel.onchange = () => { dsDiscEscolhida[e.id] = sel.value; dsRender(); };
  lin.append(sel);
  box.append(lin);
  const sug = dsSugerirTemas(e, plano, dc, sel.value || null, 6);
  /* o pedido do fluxo: 3 propostas dos temas sugeridos, ou 1 do tema escolhido na lista */
  let pedido = () => dsPromptProposta(e, dc, sel.value || null, sug.map((s) => s.topico + " (" + s.disc + ")"), 3);
  if (!sug.length) box.append(el("p", "nota", t("ds_sug_vazio")));
  sug.forEach((s, k) => {
    const ln = el("div", "ds-sug-lin" + (s.treinado ? " ds-sug-ja" : ""));
    const tx = el("div", "ds-sug-tx");
    tx.append(el("strong", "", (k + 1) + ". " + s.topico), el("span", "ds-sug-d", " · " + s.disc));
    tx.append(el("div", "ds-sug-m", s.motivos.join(" · ")));
    ln.append(tx);
    const b1 = el("button", "btn-min", t("ds_sug_ia_um"));
    b1.type = "button"; b1.title = t("ds_sug_ia_um_tip");
    b1.onclick = () => { pedido = () => dsPromptProposta(e, dc, s.disc, [s.topico], 1); dsCopiar(pedido(), t("ds_prop_copiado")); const ta = document.getElementById("dsColarTx_" + e.id); if (ta) try { ta.focus(); ta.scrollIntoView({ block: "center" }); } catch (x) {} };
    const b2 = el("button", "btn-min", t("ds_sug_guardar"));
    b2.type = "button"; b2.id = "btnDsSugGuardar_" + e.id + "_" + k;
    b2.onclick = () => {
      const r = dsPropostaAdicionar(e.id, { tema: s.topico, disc: s.disc, fonte: "sugestao" });
      if (r.erro) { try { toastMsg(r.erro, 4000); } catch (err) {} return; }
      dsRender();
    };
    ln.append(b1, b2);
    box.append(ln);
  });
  box.append(dsFluxoIA({ id: "dsColar_" + e.id, titulo: t("ds_f_tit_propostas"), idCopiar: "btnDsCriarIa_" + e.id, idTa: "dsColarTx_" + e.id, idLer: "btnDsColar_" + e.id,
    copiarRot: t("ds_sug_criar_ia"), prompt: () => pedido(), aviso: t("ds_prop_copiado"), colarRot: t("ds_f_p3_propostas"), ph: t("ds_colar_ph"), lerRot: t("ds_colar_ler"),
    aoLer: (txt) => {
      const lidas = dsPropostasLer(txt, dc.disciplinas || []);
      if (!lidas.length) return { erro: t("ds_colar_nada") };
      let ok = 0; const rep = [];
      lidas.forEach((p) => { const r = dsPropostaAdicionar(e.id, Object.assign({ fonte: "ia" }, p)); if (r.erro) rep.push(r.erro); else ok++; });
      try { toastMsg(t("ds_colar_ok", { n: ok }) + (rep.length ? " " + rep.join(" ") : ""), 6000); } catch (err) {}
      dsSecaoIr("propostas", true);
      return {};
    } }));
  card.append(box);
}
/* compatibilidade: a caixa de colar agora mora dentro de "Temas" */
function dsPintarColar() {}

/* ---------------- PROPOSTAS: filtro, lista e leitor ---------------- */
const dsPropSel = {};
const dsPropFiltro = { ed: "este", disc: "", st: "", q: "" };
function dsPropostasFiltradas(e, com) {
  const f = dsPropFiltro;
  const eds = f.ed === "todos" ? com.map((x) => x.e) : [e];
  let out = [];
  eds.forEach((ed) => dsPropostas(ed.id).forEach((p) => out.push({ ed, p })));
  if (f.disc) out = out.filter((x) => dsNorm(x.p.disc) === dsNorm(f.disc));
  if (f.st === "aberta") out = out.filter((x) => !x.p.escrita);
  if (f.st === "escrita") out = out.filter((x) => x.p.escrita);
  if (f.st === "modelo") out = out.filter((x) => x.p.modelo);
  const q = dsNorm(f.q);
  if (q) out = out.filter((x) => dsNorm(x.p.tema + " " + x.p.disc + " " + (x.p.enunciado || "")).indexOf(q) >= 0);
  return out;
}
function dsPintarPropostas(card, e, dc, com) {
  const el = dsEl;
  const todasDeste = dsPropostas(e.id);
  const box = el("div", "ds-props");
  box.id = "dsProps_" + e.id;
  box.append(el("div", "ds-sub-tit", t("ds_prop_tit", { n: todasDeste.length, a: todasDeste.filter((p) => !p.escrita).length })));
  const lista0 = com || [{ e, dc }];
  /* o filtro */
  const fb = el("div", "ds-filtros");
  const sel = (id, opcs, val, fn) => { const s = document.createElement("select"); s.id = id; s.className = "ds-sel"; opcs.forEach(([v, r]) => { const o = document.createElement("option"); o.value = v; o.textContent = r; s.append(o); }); s.value = val; s.onchange = () => { fn(s.value); dsRender(); }; fb.append(s); };
  sel("dsPropFEd_" + e.id, [["este", t("ds_pf_este")], ["todos", t("ds_pf_todos", { n: lista0.length })]], dsPropFiltro.ed, (v) => { dsPropFiltro.ed = v; });
  const discs = [];
  (dsPropFiltro.ed === "todos" ? lista0 : [{ e }]).forEach((x) => dsPropostas(x.e.id).forEach((p) => { if (p.disc && discs.indexOf(p.disc) < 0) discs.push(p.disc); }));
  sel("dsPropFDisc_" + e.id, [["", t("ds_pf_disc_todas")]].concat(discs.sort().map((d) => [d, d])), dsPropFiltro.disc, (v) => { dsPropFiltro.disc = v; });
  sel("dsPropFSt_" + e.id, [["", t("ds_pf_st_todas")], ["aberta", t("ds_pf_st_aberta")], ["escrita", t("ds_pf_st_escrita")], ["modelo", t("ds_pf_st_modelo")]], dsPropFiltro.st, (v) => { dsPropFiltro.st = v; });
  const q = document.createElement("input"); q.type = "search"; q.className = "ds-sel ds-pf-q"; q.id = "dsPropFQ_" + e.id; q.placeholder = t("ds_pf_busca"); q.value = dsPropFiltro.q;
  q.onchange = () => { dsPropFiltro.q = q.value; dsRender(); };
  fb.append(q);
  box.append(fb);
  const vis = dsPropostasFiltradas(e, lista0);
  if (!vis.length) { box.append(el("p", "nota", todasDeste.length ? t("ds_pf_nada") : t("ds_prop_vazio"))); card.append(box); return; }
  /* a lista curta */
  let atual = vis.findIndex((x) => x.p.id === dsPropSel[e.id]);
  if (atual < 0) atual = 0;
  const ul = el("div", "ds-prop-lista");
  vis.forEach((x, k) => {
    const b = el("button", "ds-prop-item" + (k === atual ? " sel" : "") + (x.p.escrita ? " escrita" : ""));
    b.type = "button";
    b.append(el("span", "ds-prop-item-t", (x.p.escrita ? "✓ " : "○ ") + x.p.tema));
    b.append(el("span", "ds-sug-d", [x.p.disc, dsPropFiltro.ed === "todos" ? x.ed.nome : ""].filter(Boolean).join(" · ") + (x.p.modelo ? " · " + t("ds_pf_tem_modelo") : "")));
    b.onclick = () => { dsPropSel[e.id] = x.p.id; dsRender(); };
    ul.append(b);
  });
  box.append(ul);
  /* o leitor */
  const cur = vis[atual], p = cur.p, edP = cur.ed, dcP = dsDiscursivaDe(edP).dc || dc;
  const rd = el("div", "ds-leitor");
  rd.id = "dsLeitor_" + e.id;
  const nav = el("div", "ds-leitor-nav");
  const ant = el("button", "btn-min", "◀ " + t("ds_pl_ant")); ant.type = "button"; ant.disabled = atual === 0;
  ant.onclick = () => { dsPropSel[e.id] = vis[atual - 1].p.id; dsRender(); };
  const prox = el("button", "btn-min", t("ds_pl_prox") + " ▶"); prox.type = "button"; prox.disabled = atual === vis.length - 1;
  prox.onclick = () => { dsPropSel[e.id] = vis[atual + 1].p.id; dsRender(); };
  nav.append(ant, el("span", "nota", t("ds_pl_pos", { a: atual + 1, n: vis.length })), prox);
  rd.append(nav);
  rd.append(el("div", "ds-leitor-tit", (p.escrita ? "✓ " : "") + p.tema));
  rd.append(el("div", "ds-sug-d", [p.disc, edP.nome, t(p.fonte === "ia" ? "ds_prop_fonte_ia" : "ds_prop_fonte_sug"), dsDataBr(p.d)].filter(Boolean).join(" · ")));
  if (p.enunciado) rd.append(el("div", "ds-prop-enun", p.enunciado));
  if (p.espelho) { const d = el("details", "ds-det"); d.append(el("summary", "", t("ds_prop_espelho")), el("div", "ds-prop-enun", p.espelho)); rd.append(d); }
  if (p.modelo) {
    const d = el("details", "ds-det ds-det-modelo"); d.open = true;
    d.append(el("summary", "", t("ds_pl_modelo") + (p.modeloLinhas ? " · " + t("ds_modelo_linhas", { n: p.modeloLinhas }) : "")), el("div", "ds-modelo", p.modelo));
    rd.append(d);
  }
  if (p.correcao) { const d = el("details", "ds-det"); d.append(el("summary", "", t("ds_pl_correcao") + (p.nota ? " · " + p.nota.nota + "/" + p.nota.max : "")), el("div", "ds-prop-enun", p.correcao)); rd.append(d); }
  const ac = el("div", "ds-ia");
  const w = el("button", "btn-min" + (p.escrita ? "" : " btn-min-ok"), t("ds_prop_escrever"));
  w.type = "button"; w.title = t("ds_prop_escrever_tip");
  w.onclick = () => { dsSecaoIr("redacoes"); dsEscreverTema(edP.id, p.tema, p.disc); };
  const x = el("button", "btn-min ds-red-del", "✕ " + t("ds_pl_apagar"));
  x.type = "button"; x.title = t("ds_prop_apagar_tip");
  x.onclick = async () => {
    if (!(await uiConfirm(t("ds_prop_apagar_conf", { t: p.tema }), { ok: t("ds_red_apagar_ok"), perigo: true }))) return;
    dsPropostaApagar(edP.id, p.id); delete dsPropSel[e.id]; dsRender();
  };
  ac.append(w, x);
  rd.append(ac);
  /* a resposta modelo e a correção: o mesmo bloco ①②③, com a caixa logo abaixo do botão que copia */
  const ab = el("div", "ds-pl-ia");
  ab.append(dsFluxoIA({ id: "dsModelo_" + p.id, titulo: t(p.modelo ? "ds_f_tit_modelo_outro" : "ds_f_tit_modelo"), idTa: "dsModeloTx_" + p.id, idLer: "btnDsModelo_" + p.id,
    copiarRot: t("ds_f_copiar_modelo"), prompt: () => dsPromptModelo(edP, dcP, p.tema, p.disc, p.enunciado), colarRot: t("ds_f_p3_modelo"), lerRot: t("ds_f_guardar_modelo"), linhas: 6,
    aoLer: (txt) => {
      const m = dsModeloLer(txt);
      if (m.modelo.length < 40) return { erro: t("ds_modelo_curto") };
      dsPropostaAtualizar(edP.id, p.id, { modelo: m.modelo, modeloLinhas: m.linhas, modeloEm: dsHoje(), enunciado: p.enunciado || m.enunciado });
      try { toastMsg(t("ds_modelo_ok"), 4000); } catch (e2) {}
      dsRender();
      return {};
    } }));
  if (p.enunciado) ab.append(dsFluxoIA({ id: "dsCorr_" + p.id, titulo: t("ds_f_tit_corr"), ajuda: t("ds_f_aj_corr"), idTa: "dsCorrTx_" + p.id, idLer: "btnDsCorr_" + p.id,
    copiarRot: t("ds_prop_corrigir"), prompt: () => dsPromptCorrecao(edP, dcP, p), aviso: t("ds_corr_copiado"), colarRot: t("ds_f_p3_corr"), lerRot: t("ds_f_guardar_corr"), linhas: 5,
    aoLer: (txt) => {
      if (String(txt).trim().length < 20) return { erro: t("ds_corr_curta") };
      const nota = dsNotaDaCorrecao(txt);
      dsPropostaAtualizar(edP.id, p.id, { correcao: String(txt).trim().slice(0, 6000), nota });
      if (nota && nota.max > 0 && nota.nota <= nota.max) {
        dsRedacaoAdicionar(edP.id, { tema: p.tema, disc: p.disc, nota: nota.nota, max: nota.max });
        try { toastMsg(t("ds_corr_ok_nota", { n: nota.nota, m: nota.max }), 5000); } catch (e2) {}
      } else { try { toastMsg(t("ds_corr_ok"), 4000); } catch (e2) {} }
      dsRender();
      return {};
    } }));
  rd.append(ab);
  box.append(rd);
  card.append(box);
}

/* ---------------- as abas ---------------- */
const DS_SECOES = ["geral", "texto", "temas", "propostas", "redacoes", "criterios", "editar"];
function dsSecaoAtual() { try { const v = localStorage.getItem("eac_ds_secao"); return DS_SECOES.indexOf(v) >= 0 ? v : "geral"; } catch (e) { return "geral"; } }
function dsSecaoIr(s, rolar) {
  try { localStorage.setItem("eac_ds_secao", s); } catch (e) {}
  dsRender();
  if (rolar) { try { const x = document.querySelector(".ds-card:not([hidden]) .ds-sec:not([hidden])"); if (x) x.scrollIntoView({ block: "start" }); } catch (e) {} }
}
function dsEditalAtual(com) {
  let v = "";
  try { v = localStorage.getItem("eac_ds_edital") || ""; } catch (e) {}
  if (v === "__sem") return v;
  return com.some((x) => x.e.id === v) ? v : (com[0] ? com[0].e.id : "__sem");
}

function dsRender() {
  const cx = document.getElementById("dsLista");
  if (!cx) return;
  const el = dsEl;
  cx.innerHTML = "";
  const lista = (typeof editais !== "undefined" ? editais : []) || [];
  if (!lista.length) { cx.append(el("p", "nota", t("ds_sem_editais"))); return; }
  const com = [], sem = [];
  lista.forEach((e) => { const x = dsDiscursivaDe(e); (x.dc ? com : sem).push(Object.assign({ e, sit: dsDiasProva(e) }, x)); });
  /* a prova mais próxima primeiro; sem data depois; as que já passaram por último */
  const chave = (s) => (s.dias == null ? 1e6 : s.dias < 0 ? 2e6 : s.dias);
  com.sort((a, b) => chave(a.sit) - chave(b.sit) || String(a.e.nome).localeCompare(String(b.e.nome)));
  const prox = com.find((x) => x.sit.dias != null && x.sit.dias >= 0);
  if (prox) cx.append(el("p", "ds-prox", t("ds_prox", { e: prox.e.nome || "?", n: prox.sit.dias, d: dsDataBr(prox.sit.prova) })));
  else if (!com.length) cx.append(el("p", "nota", t("ds_nenhum_com")));
  const selEd = dsEditalAtual(com);
  const secao = dsSecaoAtual();
  /* as abas dos editais */
  const abas = el("div", "ds-abas-ed");
  abas.setAttribute("role", "tablist");
  com.forEach(({ e, sit }) => {
    const b = el("button", "ds-aba-ed" + (selEd === e.id ? " sel" : ""));
    b.type = "button"; b.id = "dsAbaEd_" + e.id; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", selEd === e.id ? "true" : "false");
    b.append(el("span", "ds-aba-n", e.nome || "?"), el("span", "ds-aba-d", sit.dias == null ? t("ds_aba_sem_data") : sit.dias < 0 ? t("ds_aba_passou") : t("ds_aba_dias", { n: sit.dias })));
    b.onclick = () => { try { localStorage.setItem("eac_ds_edital", e.id); } catch (x) {} dsRender(); };
    abas.append(b);
  });
  if (sem.length) {
    const b = el("button", "ds-aba-ed ds-aba-sem" + (selEd === "__sem" ? " sel" : ""), t("ds_aba_sem", { n: sem.length }));
    b.type = "button"; b.onclick = () => { try { localStorage.setItem("eac_ds_edital", "__sem"); } catch (x) {} dsRender(); };
    abas.append(b);
  }
  cx.append(abas);

  com.forEach(({ e, r, dc, sit }) => {
    const card = el("div", "ed-caixa ds-card");
    card.id = "dsCard_" + e.id;
    card.hidden = selEd !== e.id;
    const topo = el("div", "ds-topo");
    const tt = el("div", "");
    tt.append(el("div", "ed-caixa-tit", e.nome || "?"));
    tt.append(el("span", "ds-data" + (sit.dias != null && sit.dias >= 0 && sit.dias <= 30 ? " ds-data-perto" : ""),
      sit.dias == null ? t("ds_data_sem") : sit.dias < 0 ? t("ds_data_passou", { d: dsDataBr(sit.prova) }) : t("ds_data", { d: dsDataBr(sit.prova), n: sit.dias })));
    if (sit.separada && sit.diasObjetiva != null && sit.diasObjetiva >= 0)
      tt.append(el("div", "ds-data ds-data-f2", t("ds_data_f2", { o: dsDataBr(sit.objetiva), n: sit.diasObjetiva })));
    topo.append(tt);
    const abrir = el("button", "btn-min", t("ds_abrir_edital"));
    abrir.type = "button";
    abrir.onclick = () => dsAbrirEdital(e.id);
    topo.append(abrir);
    card.append(topo);

    let plano = null, rd = null;
    try {
      plano = montarPlano(r, { horas: r.cfg.horas, prova: r.cfg.prova, feitos: e.progresso || {} });
      rd = typeof edRiscoDiscursiva === "function" ? edRiscoDiscursiva(plano, e.id) : null;
    } catch (err) { plano = null; rd = null; }
    const share = rd ? rd.share : (dc.objetiva ? Math.round(dc.pontos / (dc.objetiva + dc.pontos) * 100) : null);
    const chips = el("div", "dsc-chips");
    const chip = (tx, cls) => chips.append(el("span", "dsc-chip" + (cls ? " " + cls : ""), tx));
    if (dc.semFormato) chip(t("ds_chip_sem_formato"), "dsc-chip-fora");
    else chip(t("ds_chip_pontos", { p: dc.pontos }));
    if (share != null) chip(t("ds_chip_share", { s: share }));
    if (dc.minimo) chip(t("ds_chip_min", { m: dc.minimo.tipo === "pct" ? dc.minimo.valor + "%" : dc.minimo.valor }));
    if (dc.linhas && dc.linhas.max) chip(edLinhasTxt(dc.linhas));
    if (dc.corrigida) chip(t("ds_chip_corrigida", { n: dc.corrigida }), "dsc-chip-fora");
    card.append(chips);

    /* as abas das seções */
    const nProps = dsPropostas(e.id).length, nRed = dsRedacoes(e.id).length;
    const sabas = el("div", "ds-abas-sec");
    sabas.setAttribute("role", "tablist");
    DS_SECOES.forEach((s) => {
      const rot = t("ds_s_" + s) + (s === "propostas" && nProps ? " (" + nProps + ")" : s === "redacoes" && nRed ? " (" + nRed + ")" : "");
      const b = el("button", "ds-aba-sec" + (secao === s ? " sel" : ""), rot);
      b.type = "button"; b.id = "dsAbaSec_" + e.id + "_" + s; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", secao === s ? "true" : "false");
      b.onclick = () => dsSecaoIr(s);
      sabas.append(b);
    });
    card.append(sabas);
    const sec = (s) => { const d = el("div", "ds-sec ds-sec-" + s); d.id = "dsSec_" + e.id + "_" + s; d.hidden = secao !== s; card.append(d); return d; };

    /* visão geral */
    const g = sec("geral");
    g.append(el("p", "nota", t("ds_cai_em", { d: (dc.disciplinas || []).join(", ") || "—" })));
    if (dc.semFormato) g.append(el("p", "nota ds-red-alerta", t("ds_sem_formato")));
    dsPintarEstrategia(g, e, dc, sit);
    if (rd && rd.minPct !== null) {
      const rs = el("div", "ds-risco" + (rd.abaixo ? " ed-min-abaixo" : rd.apertado ? " ed-min-apertado" : ""));
      rs.append(el("div", "ds-risco-tit", rd.abaixo ? t("ds_risco_abaixo") : rd.apertado ? t("ds_risco_apertado") : t("ds_risco_ok")));
      const barra = el("div", "ed-min-barra");
      const fill = el("div", "ed-min-fill"); fill.style.width = Math.min(100, rd.cobertura) + "%";
      const corte = el("div", "ed-min-corte"); corte.style.left = Math.min(100, rd.minPct) + "%";
      barra.append(fill, corte);
      rs.append(barra, el("div", "ed-min-num", t("ds_risco_num", { c: rd.cobertura, m: rd.minPct })));
      g.append(rs);
    }
    if (dc.corrigida) g.append(el("p", "nota ed-min-disc-corr", t("ed_min_disc_corrigida", { n: dc.corrigida })));
    dsPintarTreino(g, e);
    /* o texto da prova */
    dsPintarTextoDaProva(sec("texto"), e, dc, plano);
    /* temas */
    dsPintarSugestoes(sec("temas"), e, plano, dc);
    /* propostas */
    dsPintarPropostas(sec("propostas"), e, dc, com);
    /* redações */
    const sr = sec("redacoes");
    dsPintarRedacoes(sr, e, dc);
    try { const d = sr.querySelector("#dsRed_" + e.id) || sr.querySelector("details"); if (d) d.open = true; } catch (x) {}
    /* critérios e cortes */
    const sc = sec("criterios");
    dsPintarCortes(sc, plano, dc, rd);
    dsPintarCriterios(sc, dc);
    /* editar */
    const se = sec("editar");
    const ed = el("details", "ds-det ds-editar");
    ed.id = "dsEditar_" + e.id;
    ed.open = true;
    ed.append(el("summary", "", t("ds_ed_tit")));
    dsPintarEditor(ed, e, r, dc);
    se.append(ed);
    const aj = el("button", "btn-min", t("ds_ajustar"));
    aj.type = "button";
    aj.onclick = () => dsAbrirEdital(e.id, () => { if (typeof epAbrir === "function") epAbrir(); });
    se.append(aj);
    cx.append(card);
  });

  if (sem.length) {
    const box = el("details", "ed-caixa ds-sem");
    box.open = true;
    box.hidden = !(selEd === "__sem" || !com.length);
    box.append(el("summary", "ed-caixa-tit", t("ds_sem_tit", { n: sem.length })));
    box.append(el("p", "nota", t("ds_sem_ajuda")));
    sem.forEach(({ e, r }) => {
      const ln = el("div", "ds-sem-lin");
      ln.append(el("span", "", e.nome || "?"));
      const b = el("button", "btn-min", t("ds_cadastrar"));
      b.type = "button"; b.id = "btnDsCadastrar_" + e.id;
      const area = el("div", "ds-sem-ed");
      area.hidden = true;
      b.onclick = () => { area.hidden = !area.hidden; if (!area.hidden && !area.childNodes.length) dsPintarEditor(area, e, r, null); };
      ln.append(b);
      box.append(ln, area);
    });
    cx.append(box);
  }
}
