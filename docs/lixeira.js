/* =====================================================================
 * LIXEIRA — o que você apaga vem para cá antes de sumir de vez
 *
 * POR QUE EXISTE. Apagar um cartão, uma questão, uma dica ou uma nota não tinha volta: o cartão
 * pedia duas confirmações e, passada a segunda, sumia; a questão ia embora com o histórico de
 * respostas; e a dica ou a nota simplesmente desapareciam quando se salvava o campo vazio — sem
 * pergunta nenhuma. Confirmar antes ajuda quem erra o clique, mas não quem só percebe depois.
 *
 * O QUE FAZ.
 *   · guarda o que foi apagado, por inteiro, com o lugar de onde saiu (o cartão de um tópico, a nota
 *     de um artigo de uma lei…), e o RISCO de ter apagado (alto: a questão com tentativas, o texto que
 *     cita artigo, prazo ou valor, a dica ou a nota longa);
 *   · logo depois de apagar, um aviso curto com "desfazer" (e "ver lixeira");
 *   · uma tela com tudo o que está guardado, para restaurar quando quiser ou apagar de vez, e
 *     "esvaziar" — que mostra o que se perde antes de perder;
 *   · e cada apagamento (e cada restauração) vai para o histórico de decisões (decisoes.js), com o
 *     risco e o texto: é daí que se aprende quais apagamentos a pessoa se arrepende de ter feito.
 *
 * Fica só neste aparelho. Guarda os últimos 300; o mais velho sai quando entra um novo. As funções
 * de dados (qsApagar, qsGravarDica, matGravarDica, leiNotaGuardar…) chamam lixJogar sozinhas, então
 * todo caminho que apaga passa por aqui, e não só o botão que alguém lembrou de ligar.
 * ===================================================================== */
const LIX_CHAVE = "eac_lixeira";
let lixMax = 300;               /* quantos itens ficam */
let lixMaxChars = 400000;       /* e quantos caracteres, no máximo, no armazenamento */
let lixLista = null;            /* o que está guardado (em memória, espelho do armazenamento) */
let lixSeq = 0;
let lixFiltro = "";
let lixUltimo = null;           /* o último que foi para a lixeira: é o que o "desfazer" traz de volta */
let lixTimer = null;

const LIX_TIPOS = ["cartao", "questao", "dica", "nota"];

function lixCarregar() {
  if (lixLista) return;
  try { lixLista = JSON.parse(localStorage.getItem(LIX_CHAVE) || "[]"); } catch (e) { lixLista = []; }
  if (!Array.isArray(lixLista)) lixLista = [];
}

function lixLer() { lixCarregar(); return lixLista; }

/* volta a ler do armazenamento (depois de restaurar um backup, por exemplo) */
function lixRecarregar() { lixLista = null; lixCarregar(); }

function lixCortar(s, n) { return String(s == null ? "" : s).replace(/\s+$/, "").slice(0, n); }

function lixGravar() {
  try { localStorage.setItem(LIX_CHAVE, JSON.stringify(lixLista)); return true; } catch (e) {}
  /* armazenamento cheio: solta um quarto do mais velho e tenta de novo, uma vez */
  try {
    lixLista.splice(0, Math.max(1, Math.floor(lixLista.length / 4)));
    localStorage.setItem(LIX_CHAVE, JSON.stringify(lixLista));
    return true;
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------------
 * O QUE FOI APAGADO: o texto, o risco
 * ------------------------------------------------------------------ */

/* o texto do item, para mostrar e para o histórico */
function lixTexto(item) {
  const d = (item && item.dados) || {};
  if (item.tipo === "cartao") return String(d.bloco || "");
  if (item.tipo === "questao") {
    const q = d.q || {};
    return String(q.enunciado || "") + (q.gabarito ? "\nGabarito: " + q.gabarito : "");
  }
  return String(d.texto || "");
}

/* O RISCO de ter apagado. Alto: o que carrega trabalho difícil de refazer — a questão com respostas
 * dadas, o texto que cita artigo, prazo ou valor, a dica ou nota longa (é sua, ninguém mais tem). */
function lixRisco(tipo, d) {
  d = d || {};
  if (tipo === "questao") return ((d.q && d.q.tentativas) || []).length ? "alto" : "medio";
  if (tipo === "cartao") return typeof decRiscoDoTexto === "function" ? decRiscoDoTexto([d.bloco]) : "baixo";
  const txt = String(d.texto || "");
  if (typeof decRiscoDoTexto === "function" && decRiscoDoTexto([txt]) === "alto") return "alto";
  return txt.length > 200 ? "alto" : "medio";
}

/* A frase de risco que acompanha a pergunta "apagar?": diz o que se perde e que dá para voltar. */
function lixAvisoRisco(tipo, d) {
  const risco = lixRisco(tipo, d);
  const n = tipo === "questao" ? ((d && d.q && d.q.tentativas) || []).length : 0;
  if (tipo === "questao" && n) return "\n\n" + t("lix_aviso_hist", { n });
  return "\n\n" + t(risco === "alto" ? "lix_aviso_alto" : "lix_aviso_padrao");
}

/* ---------------------------------------------------------------------
 * JOGAR NA LIXEIRA
 *
 * o = { tipo, via, rotulo, onde, dados, motivo }
 *   via:    de onde saiu (cartao: editor | material · questao: banco · dica: questao | material ·
 *           nota: artigo | trecho) — é o que diz a lixeira como restaurar
 *   motivo: "pedido" (a pessoa confirmou) ou "vazio" (salvou o campo vazio e o texto se foi)
 * ------------------------------------------------------------------ */
function lixJogar(o) {
  lixCarregar();
  const dados = (o && o.dados) || {};
  const item = {
    id: "x" + Date.now().toString(36) + (lixSeq++).toString(36) + Math.random().toString(36).slice(2, 5),
    q: new Date().toISOString(),
    v: typeof VERSAO !== "undefined" ? VERSAO : "",
    tipo: o.tipo, via: o.via || "",
    rotulo: lixCortar(o.rotulo, 90), onde: lixCortar(o.onde, 120),
    risco: o.risco || lixRisco(o.tipo, dados),
    motivo: o.motivo || "pedido",
    dados,
  };
  lixLista.push(item);
  while (lixLista.length > lixMax) lixLista.shift();
  let tam = lixLista.reduce((s, r) => s + JSON.stringify(r).length, 0);
  while (tam > lixMaxChars && lixLista.length > 1) tam -= JSON.stringify(lixLista.shift()).length;
  lixGravar();
  lixUltimo = item.id;
  lixDecApagar(item);
  lixAtualizarBotao();
  lixMostrar(t("lix_apagado", { o: lixNomeCurto(item) }), true);
  return item;
}

function lixNomeCurto(item) {
  return t("lix_tipo1_" + item.tipo) + (item.rotulo ? " “" + item.rotulo.slice(0, 50) + "”" : "");
}

/* O histórico de decisões (decisoes.js): o que foi apagado, com o risco e o texto. Nunca quebra o fluxo. */
function lixDecApagar(item) {
  try {
    if (typeof decRegistrar !== "function") return;
    decRegistrar({
      area: "apagar", regra: "apagar." + item.tipo, origem: "pessoa", lei: item.onde, ref: item.rotulo,
      motivo: t(item.motivo === "vazio" ? "lix_motivo_vazio" : "dec_apagar_motivo"),
      risco: item.risco, decisao: "aceitou", via: item.motivo === "vazio" ? "texto_vazio" : "pedido",
      proposta: { acao: t("lix_acao_" + item.tipo), amostra: lixTexto(item), n: 1, linhas: [] },
    });
  } catch (e) {}
}

/* a pessoa foi perguntada e disse NÃO: também é dado (a pergunta estava certa em avisar?) */
function lixRecusou(tipo, onde, rotulo, dados) {
  try {
    if (typeof decRegistrar !== "function") return;
    decRegistrar({
      area: "apagar", regra: "apagar." + tipo, origem: "pessoa", lei: lixCortar(onde, 120), ref: lixCortar(rotulo, 80),
      motivo: t("dec_apagar_motivo"), risco: lixRisco(tipo, dados), decisao: "recusou", via: "pedido",
      proposta: { acao: t("lix_acao_" + tipo), amostra: lixTexto({ tipo, dados }), n: 1, linhas: [] },
    });
  } catch (e) {}
}

/* ---------------------------------------------------------------------
 * RESTAURAR
 * ------------------------------------------------------------------ */

/* Põe um bloco de linhas de volta no texto, na linha de onde saiu (ou no fim, se o texto já mudou
 * demais). `sep` diz se havia linha em branco antes e depois dele quando estava lá ({antes, depois}):
 * cartões em linhas coladas voltam coladas, cartões separados por branco voltam separados. Sem `sep`,
 * separa dos dois lados. */
function lixInserirBloco(texto, bloco, linha, sep) {
  const base = String(texto || "");
  if (!base.trim()) return String(bloco);
  const brAntes = !sep || sep.antes !== false, brDepois = !sep || sep.depois !== false;
  const linhas = base.split("\n");
  const pos = linha > 0 && linha - 1 <= linhas.length ? linha - 1 : linhas.length;
  const antes = linhas.slice(0, pos), depois = linhas.slice(pos);
  const sai = antes.slice();
  if (brAntes && sai.length && String(sai[sai.length - 1]).trim()) sai.push("");
  String(bloco).split("\n").forEach((x) => sai.push(x));
  if (brDepois && depois.length && String(depois[0]).trim()) sai.push("");
  return sai.concat(depois).join("\n");
}

/* dica ou nota que já tem outro texto agora: o antigo NÃO sobrescreve — fica embaixo do novo */
function lixJuntar(atual, antigo) {
  const a = String(atual || "").trim(), o = String(antigo || "").trim();
  if (!a || a === o) return o;
  return a + "\n\n" + o;
}

/* cada um devolve { ok, msg } (msg = chave de texto) */
const LIX_REST = {
  "cartao/editor": (d) => {
    const ed = $("editor");
    if (!ed || typeof d.bloco !== "string") return { ok: false, msg: "lix_falha_generica" };
    const novo = lixInserirBloco(ed.value, d.bloco, d.linha, d.sep);
    try { colagemAnterior = { texto: ed.value }; } catch (e) {}
    ed.value = novo;
    const b = $("btnDesfazerColagem");
    if (b) b.disabled = false;
    try { autoSalvar(); preview(); } catch (e) {}
    return { ok: true };
  },
  "cartao/material": (d) => {
    if (typeof matGravarCartoes !== "function" || typeof d.bloco !== "string") return { ok: false, msg: "lix_falha_generica" };
    const atual = String((matResumos[d.chave] || {}).cartoes || "");
    matGravarCartoes(d.chave, lixInserirBloco(atual, d.bloco, d.linha, d.sep), { disciplina: d.disciplina, topico: d.topico });
    try { matReg("cartoes", "cartão restaurado da lixeira", String(d.bloco).slice(0, 60)); } catch (e) {}
    try { matCartoesVer(); } catch (e) {}
    try { matRender(); } catch (e) {}
    return { ok: true };
  },
  "questao/banco": (d) => {
    if (!d.q || !d.q.id) return { ok: false, msg: "lix_falha_generica" };
    if (qsBanco.some((x) => x.id === d.q.id)) return { ok: true, msg: "lix_ja_existe" };
    qsBanco.push(d.q);
    qsSalvar();
    try { qsUiPintarBotaoResumo(); qsUiRender(); } catch (e) {}
    return { ok: true };
  },
  "dica/questao": (d) => {
    const q = qsBanco.filter((x) => x.id === d.id)[0];
    if (!q) return { ok: false, msg: "lix_falha_questao" };
    qsGravarDica(d.id, lixJuntar(q.dica, d.texto));
    try { qsUiPintarSessao(); } catch (e) {}
    return { ok: true };
  },
  "dica/material": (d) => {
    if (typeof matResumos === "undefined" || !matResumos[d.chave]) return { ok: false, msg: "lix_falha_topico" };
    const ja = matDicaDe(d.chave, d.trecho);
    matGravarDica(d.chave, d.trecho, lixJuntar(ja && ja.texto, d.texto));
    try { matRender(); } catch (e) {}
    return { ok: true };
  },
  "nota/artigo": (d) => {
    const l = leiDe(d.lei);
    if (!l) return { ok: false, msg: "lix_falha_lei" };
    leiNotaGuardar(d.lei, d.num, lixJuntar(leiNotaDeEm(l, d.num), d.texto));
    try { leiPintarLeitura(); } catch (e) {}
    return { ok: true };
  },
  "nota/trecho": (d) => {
    const l = leiDe(d.lei);
    if (!l) return { ok: false, msg: "lix_falha_lei" };
    const ja = leiNotaTrechoDeEm(l, d.trecho);
    leiNotaTrechoGuardar(d.lei, d.trecho, lixJuntar(ja && ja.texto, d.texto));
    try { leiPintarLeitura(); } catch (e) {}
    return { ok: true };
  },
};

function lixRestaurar(id) {
  const item = lixLer().filter((x) => x.id === id)[0];
  if (!item) return { ok: false, msg: "lix_falha_generica" };
  const fn = LIX_REST[item.tipo + "/" + item.via];
  let r;
  try { r = fn ? fn(item.dados || {}) : { ok: false, msg: "lix_falha_generica" }; }
  catch (e) { r = { ok: false, msg: "lix_falha_generica" }; }
  if (!r.ok) return r;
  lixLista = lixLista.filter((x) => x.id !== id);
  lixGravar();
  if (lixUltimo === id) lixUltimo = null;
  try {
    if (typeof decRegistrar === "function") {
      decRegistrar({
        area: "apagar", regra: "apagar." + item.tipo, origem: "pessoa", lei: item.onde, ref: item.rotulo,
        motivo: t("lix_motivo_restaurado"), risco: item.risco, decisao: "mudou", via: "lixeira",
        proposta: { acao: t("lix_acao_restaurar"), amostra: lixTexto(item), n: 1, linhas: [] },
      });
    }
  } catch (e) {}
  lixAtualizarBotao();
  return { ok: true, msg: r.msg || "" };
}

/* o mesmo, para a tela: avisa se não deu */
function lixRestaurarUi(id) {
  const item = lixLer().filter((x) => x.id === id)[0];
  const r = lixRestaurar(id);
  if (!r.ok) { try { uiAlert(t(r.msg || "lix_falha_generica")); } catch (e) {} return r; }
  lixMostrar(t(r.msg || "lix_restaurado", { o: item ? lixNomeCurto(item) : "" }), false);
  try { lixPintar(); } catch (e) {}
  return r;
}

/* ---------------------------------------------------------------------
 * APAGAR DE VEZ, ESVAZIAR
 * ------------------------------------------------------------------ */
async function lixApagarDeVez(id) {
  const item = lixLer().filter((x) => x.id === id)[0];
  if (!item) return false;
  const ok = await uiConfirm(t("lix_vez_conf", { o: lixNomeCurto(item), r: t("dec_risco_" + item.risco) }));
  if (!ok) return false;
  lixLista = lixLista.filter((x) => x.id !== id);
  lixGravar();
  if (lixUltimo === id) lixUltimo = null;
  try {
    if (typeof decRegistrar === "function") {
      decRegistrar({ area: "apagar", regra: "apagar.definitivo", origem: "pessoa", lei: item.onde, ref: item.rotulo,
        motivo: t("lix_motivo_definitivo"), risco: item.risco, decisao: "aceitou", via: "lixeira",
        proposta: { acao: t("lix_acao_" + item.tipo), amostra: lixTexto(item), n: 1, linhas: [] } });
    }
  } catch (e) {}
  lixAtualizarBotao();
  lixPintar();
  return true;
}

function lixContar() {
  const c = { total: 0, alto: 0 };
  LIX_TIPOS.forEach((k) => { c[k] = 0; });
  lixLer().forEach((x) => { c.total++; if (c[x.tipo] !== undefined) c[x.tipo]++; if (x.risco === "alto") c.alto++; });
  return c;
}

/* ESVAZIAR É A EXCLUSÃO DEFINITIVA, e segue a regra do app: mostra o que se perde */
async function lixEsvaziar() {
  const c = lixContar();
  if (!c.total) return false;
  const ok = await uiConfirm(t("lix_esvaziar_conf", { n: c.total, c: c.cartao, q: c.questao, d: c.dica, nt: c.nota, a: c.alto }));
  if (!ok) return false;
  const tirados = lixLista.slice();
  lixLista = [];
  lixUltimo = null;
  lixGravar();
  try {
    if (typeof decRegistrar === "function") {
      decRegistrar({ area: "apagar", regra: "apagar.definitivo", origem: "pessoa", lei: "", ref: t("lix_esvaziar"),
        motivo: t("lix_motivo_definitivo"), risco: c.alto ? "alto" : "medio", decisao: "aceitou", via: "esvaziar",
        proposta: { acao: t("lix_esvaziar"), amostra: tirados.slice(0, 5).map((x) => lixNomeCurto(x)).join(" | "), n: c.total, linhas: [] } });
    }
  } catch (e) {}
  lixAtualizarBotao();
  lixPintar();
  return true;
}

/* ---------------------------------------------------------------------
 * O AVISO CURTO ("apagado — desfazer") e o botão do rodapé
 * ------------------------------------------------------------------ */
function lixEsconder() {
  const bar = $("barraLixeira");
  if (!bar) return;
  bar.hidden = true;
  try { if (bar.hidePopover) bar.hidePopover(); } catch (e) {}
}

/* A janela de cima que está aberta (ou nada). Uma janela modal deixa TUDO o que está fora dela inerte —
 * inclusive um aviso na página, que aparece mas não recebe o clique. Por isso o aviso mora dentro dela. */
function lixDialogoTopo() {
  let topo = null;
  try {
    /* o registro de abrirModal está na ordem de abertura: a última ainda aberta é a de cima */
    _modaisAbertos.forEach((d) => { if (d.open) topo = d; });
  } catch (e) {}
  return topo;
}

function lixMostrar(texto, comDesfazer) {
  const bar = $("barraLixeira");
  if (!bar) return;
  const dono = lixDialogoTopo() || document.body;
  if (bar.parentNode !== dono) {
    try { if (bar.parentNode && bar.parentNode.removeChild) bar.parentNode.removeChild(bar); } catch (e) {}
    dono.append(bar);
  }
  const tx = $("lixTxt");
  if (tx) tx.textContent = texto;
  const bd = $("btnLixDesfazer");
  if (bd) bd.hidden = !comDesfazer;
  bar.hidden = false;
  /* popover: fica na camada de cima, ACIMA de qualquer janela aberta (o cartão é apagado dentro de uma) */
  try { if (bar.showPopover) bar.showPopover(); } catch (e) {}
  if (typeof clearTimeout === "function") clearTimeout(lixTimer);
  if (typeof setTimeout === "function") {
    lixTimer = setTimeout(lixEsconder, 9000);
    if (lixTimer && lixTimer.unref) lixTimer.unref();
  }
}

function lixDesfazer() {
  if (!lixUltimo) { lixEsconder(); return false; }
  const r = lixRestaurarUi(lixUltimo);
  return !!r.ok;
}

function lixAtualizarBotao() {
  const b = $("btnLixeira");
  if (!b) return;
  const n = lixLer().length;
  b.textContent = n ? t("lix_botao_n", { n }) : t("lix_botao");
}

/* ---------------------------------------------------------------------
 * A TELA
 * ------------------------------------------------------------------ */
function lixDataCurta(iso) { return String(iso || "").slice(0, 16).replace("T", " "); }

function lixItemEl(it) {
  const el = document.createElement("div");
  el.className = "duv-item dec-item lix-item";
  const cab = document.createElement("div");
  cab.className = "duv-titulo";
  cab.textContent = lixDataCurta(it.q) + " · " + t("lix_tipo1_" + it.tipo) + (it.rotulo ? " · " + it.rotulo : "");
  const rk = document.createElement("span");
  rk.className = "dec-risco dec-risco-" + it.risco;
  rk.textContent = t("dec_risco_" + it.risco);
  cab.append(" ", rk);
  el.append(cab);
  const onde = document.createElement("div");
  onde.className = "nota";
  onde.textContent = [it.onde, it.motivo === "vazio" ? t("lix_veio_vazio") : ""].filter(Boolean).join(" · ");
  el.append(onde);
  const txt = lixTexto(it);
  if (txt) {
    const tr = document.createElement("div");
    tr.className = "dec-trecho";
    tr.textContent = txt.length > 400 ? txt.slice(0, 400) + "…" : txt;
    el.append(tr);
  }
  const acoes = document.createElement("div");
  acoes.className = "dec-acoes";
  const br = document.createElement("button");
  br.type = "button";
  br.className = "btn-min btn-min-ok lix-restaurar";
  br.textContent = t("lix_restaurar");
  br.onclick = () => lixRestaurarUi(it.id);
  const bv = document.createElement("button");
  bv.type = "button";
  bv.className = "btn-min btn-min-perigo lix-vez";
  bv.textContent = t("lix_apagar_vez");
  bv.onclick = () => lixApagarDeVez(it.id);
  acoes.append(br, bv);
  el.append(acoes);
  return el;
}

function lixPintar() {
  const cx = $("lixLista");
  if (!cx) return;
  const c = lixContar();
  $("lixResumo").textContent = c.total
    ? t("lix_resumo", { n: c.total, c: c.cartao, q: c.questao, d: c.dica, nt: c.nota, a: c.alto })
    : "";
  const fx = $("lixFiltros");
  fx.innerHTML = "";
  [""].concat(LIX_TIPOS).forEach((v) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min" + (lixFiltro === v ? " mat-ligado" : "");
    b.id = "btnLixF_" + (v || "todos");
    b.textContent = v ? t("lix_t_" + v) + " (" + c[v] + ")" : t("lix_f_todos");
    b.onclick = () => { lixFiltro = v; lixPintar(); };
    fx.append(b);
  });
  cx.innerHTML = "";
  const todas = lixLer().slice().reverse().filter((x) => !lixFiltro || x.tipo === lixFiltro);
  if (!todas.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = t(c.total ? "lix_vazio_filtro" : "lix_vazio");
    cx.append(p);
    return;
  }
  todas.slice(0, 100).forEach((x) => cx.append(lixItemEl(x)));
  if (todas.length > 100) {
    const m = document.createElement("p");
    m.className = "nota";
    m.textContent = t("lix_mais", { n: todas.length - 100 });
    cx.append(m);
  }
}

function lixAbrir() {
  if (!$("dlgLixeira")) return false;
  lixFiltro = "";
  lixEsconder();
  lixPintar();
  abrirModal("dlgLixeira");
  return true;
}

function lixLigar() {
  const liga = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  liga("btnLixeira", () => lixAbrir());
  liga("btnLixEsvaziar", () => lixEsvaziar());
  liga("btnLixFechar", () => $("dlgLixeira").close());
  liga("btnLixX", () => $("dlgLixeira").close());
  liga("btnLixDesfazer", () => lixDesfazer());
  liga("btnLixVer", () => { lixEsconder(); lixAbrir(); });
  lixAtualizarBotao();
}
lixLigar();
