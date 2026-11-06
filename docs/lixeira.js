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

/* VÁRIOS DE UMA VEZ.
 * lixJogar grava a lixeira inteira no armazenamento, pesa o que já tem e avisa na tela a CADA
 * item — bom para um cartão, desastroso para 900: era o que travava o app ao resolver os
 * cartões repetidos de um baralho grande (181 ms por cartão, mais de dois minutos no total).
 * Aqui entra tudo de uma vez: um corte, uma gravação, um registro no histórico de decisões e
 * UM aviso. O limite (últimos 300) é o mesmo — por isso quem chama guarda o seu próprio recibo
 * para desfazer o lote inteiro. Devolve os ids dos itens que ficaram guardados. */
function lixJogarLote(lista, onde) {
  lixCarregar();
  const agora = new Date().toISOString();
  const ids = [];
  /* (19.92.0) a marca do lote: a tela mostra junto e oferece "restaurar o lote" */
  const lote = "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  (lista || []).forEach((o) => {
    const dados = (o && o.dados) || {};
    const item = {
      id: "x" + Date.now().toString(36) + (lixSeq++).toString(36) + Math.random().toString(36).slice(2, 5),
      q: agora, v: typeof VERSAO !== "undefined" ? VERSAO : "",
      tipo: o.tipo, via: o.via || "", rotulo: lixCortar(o.rotulo, 90), onde: lixCortar(o.onde, 120),
      risco: o.risco || lixRisco(o.tipo, dados), motivo: o.motivo || "pedido", dados,
      lote, loteOnde: lixCortar(onde || "", 60),
    };
    lixLista.push(item); ids.push(item.id);
  });
  while (lixLista.length > lixMax) lixLista.shift();
  const pesos = lixLista.map((r) => JSON.stringify(r).length);
  let tam = pesos.reduce((s, x) => s + x, 0), corte = 0;
  while (tam > lixMaxChars && corte < lixLista.length - 1) tam -= pesos[corte++];
  if (corte) lixLista.splice(0, corte);
  lixGravar();
  const vivos = new Set(lixLista.map((x) => x.id));
  const ficaram = ids.filter((id) => vivos.has(id));
  if (ficaram.length) lixUltimo = ficaram[ficaram.length - 1];
  try {
    if (typeof decRegistrar === "function") {
      decRegistrar({ area: "apagar", regra: "apagar.cartao", origem: "pessoa", lei: lixCortar(onde || "", 120),
        ref: (lista || []).length + " cartões", motivo: t("dec_apagar_motivo"), risco: "medio", decisao: "aceitou", via: "pedido",
        proposta: { acao: t("lix_acao_cartao"), amostra: (lista || []).slice(0, 3).map((o) => lixCortar(o.rotulo, 60)).join(" | "), n: (lista || []).length, linhas: [] } });
    }
  } catch (e) {}
  lixAtualizarBotao();
  lixMostrar(t("lix_lote_msg", { n: (lista || []).length, max: lixMax }), false);
  return ficaram;
}

/* tira da lixeira os ids dados (o desfazer de um lote não pode deixar cópia para trás) */
function lixRemoverIds(ids) {
  lixCarregar();
  const fora = new Set(ids || []);
  const antes = lixLista.length;
  lixLista = lixLista.filter((x) => !fora.has(x.id));
  if (lixLista.length !== antes) { lixGravar(); lixAtualizarBotao(); }
  return antes - lixLista.length;
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
  if (!r.ok) { try { lixPlanoB(item, r); } catch (e) { try { uiAlert(t(r.msg || "lix_falha_generica")); } catch (e2) {} } return r; }
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
 *
 * (19.92.0) O QUE MUDOU, pelo relato e pelas práticas das lixeiras (Gmail, Drive, Notion):
 *  · o cartão aparece COMO CARTÃO (frente, verso com a lacuna em destaque, etiquetas, caminho), não em texto cru com
 *    "{{c1::…}}" e "::"; o texto original fica numa gaveta;
 *  · a data diz "hoje / ontem / há N dias", e a lista vem agrupada por dia;
 *  · "restaurar em …" diz PARA ONDE volta; quando o lugar não existe mais, há plano B (cartão: na bancada; qualquer
 *    um: copiar o texto) — nada se perde por falta de destino;
 *  · busca, seleção de vários (restaurar ou apagar de vez juntos) e o LOTE: o que saiu de uma vez ("Cartões
 *    repetidos") aparece junto, com "restaurar o lote";
 *  · o resumo só conta o que existe (sem "0 questão(ões)"), os filtros vazios somem, o selo "risco baixo" saiu (só
 *    médio e alto) e o resumo diz quantos cabem antes de o mais antigo sair;
 *  · um só fechar (o ✖ no canto); "esvaziar" sozinho no rodapé, longe dele.
 * ------------------------------------------------------------------ */
function lixDataCurta(iso) { return String(iso || "").slice(0, 16).replace("T", " "); }
let lixBusca = "";
const lixSel = new Set();
function lixEl(tag, cls, txt) { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }
function lixNorm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

/* os dias de calendário entre o apagamento e hoje (no fuso de quem usa) */
function lixDiasAtras(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const h = new Date(); h.setHours(0, 0, 0, 0);
  const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
  return Math.round((h - d0) / 86400000);
}
function lixQuando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return lixDataCurta(iso);
  const n = lixDiasAtras(iso);
  const p2 = (x) => String(x).padStart(2, "0");
  const rel = n <= 0 ? t("lix_hoje") : n === 1 ? t("lix_ontem") : t("lix_ha_dias", { n });
  return rel + " · " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
}
function lixGrupoDia(iso) {
  const n = lixDiasAtras(iso);
  if (n == null) return "antes";
  return n <= 0 ? "hoje" : n === 1 ? "ontem" : n <= 7 ? "semana" : n <= 31 ? "mes" : "antes";
}

/* o cartão em partes: "@ caminho", "frente :: verso :: etiquetas", "+ extra" (o "::" dentro de {{c1::…}} não divide) */
function lixDividir(txt) {
  const partes = [];
  let cur = "", prof = 0;
  for (let i = 0; i < txt.length; i++) {
    const a = txt[i], b = txt[i + 1];
    if (a === "{" && b === "{") { prof++; cur += "{{"; i++; continue; }
    if (a === "}" && b === "}") { prof = Math.max(0, prof - 1); cur += "}}"; i++; continue; }
    if (!prof && a === ":" && b === ":") { partes.push(cur); cur = ""; i++; continue; }
    cur += a;
  }
  partes.push(cur);
  return partes.map((s) => s.trim());
}
function lixCartaoPartes(bloco) {
  let caminho = "";
  const corpo = [], extra = [];
  String(bloco || "").split("\n").forEach((l) => {
    const s = l.trim();
    if (!s) return;
    if (s[0] === "@" && !caminho && !corpo.length) caminho = s.slice(1).trim();
    else if (s[0] === "+" && corpo.length) extra.push(s.slice(1).trim());
    else corpo.push(s);
  });
  const p = lixDividir(corpo.join("\n"));
  /* etiquetas separadas por espaço OU vírgula ("imunidade, obrigacao_acessoria" aparece nos cartões guardados) */
  return { caminho, frente: p[0] || "", verso: p[1] || "", tags: String(p[2] || "").split(/[\s,;]+/).filter(Boolean), extra: extra.join("\n") };
}
/* o texto com as lacunas {{cN::termo(::dica)}} em destaque */
function lixComLacunas(el, txt) {
  const re = /\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g;
  let i = 0, m;
  const s = String(txt || "");
  while ((m = re.exec(s))) {
    if (m.index > i) el.append(document.createTextNode(s.slice(i, m.index)));
    el.append(lixEl("span", "lix-lac", m[1]));
    i = re.lastIndex;
  }
  if (i < s.length) el.append(document.createTextNode(s.slice(i)));
  return el;
}
/* texto longo: o começo e "ver tudo" */
function lixTextoEl(txt, cls) {
  const s = String(txt || "");
  if (s.length <= 320) return lixEl("div", cls || "dec-trecho", s);
  const box = lixEl("div", cls || "dec-trecho");
  box.append(document.createTextNode(s.slice(0, 320) + "… "));
  const d = lixEl("details", "lix-mais");
  d.append(lixEl("summary", "", t("lix_ver_tudo")), lixEl("div", "lix-tudo", s));
  box.append(d);
  return box;
}
function lixConteudoEl(it) {
  const d = it.dados || {};
  if (it.tipo === "cartao") {
    const p = lixCartaoPartes(d.bloco);
    if (!p.frente) return lixTextoEl(lixTexto(it));
    const box = lixEl("div", "lix-cartao");
    if (p.caminho) box.append(lixEl("div", "lix-caminho", p.caminho));
    const fr = lixEl("div", "lix-lado"); fr.append(lixEl("b", "", t("lix_frente"))); lixComLacunas(fr, p.frente); box.append(fr);
    if (p.verso) { const vs = lixEl("div", "lix-lado"); vs.append(lixEl("b", "", t("lix_verso"))); lixComLacunas(vs, p.verso.length > 400 ? p.verso.slice(0, 400) + "…" : p.verso); box.append(vs); }
    if (p.tags.length) { const tg = lixEl("div", "lix-tags"); p.tags.slice(0, 8).forEach((x) => tg.append(lixEl("span", "lix-tag", x))); box.append(tg); }
    /* o original, como estava (o "+ esquema", o "@", tudo) */
    const og = lixEl("details", "lix-orig");
    og.append(lixEl("summary", "", t("lix_original")), lixEl("pre", "", String(d.bloco || "")));
    box.append(og);
    return box;
  }
  if (it.tipo === "questao") {
    const q = d.q || {};
    const box = lixEl("div", "");
    box.append(lixTextoEl(String(q.enunciado || "")));
    const inf = [];
    if (q.gabarito) inf.push(t("lix_gabarito", { g: q.gabarito }));
    const n = (q.tentativas || []).length;
    if (n) inf.push(t("lix_tentativas", { n }));
    if (inf.length) box.append(lixEl("div", "nota", inf.join(" · ")));
    return box;
  }
  return lixTextoEl(lixTexto(it));
}
/* para onde volta (o último pedaço do "onde", que é o tópico, a questão ou a lei) */
function lixDestino(it) {
  const v = it.tipo + "/" + it.via;
  if (v === "cartao/editor") return t("lix_dest_bancada");
  if (v === "questao/banco") return t("lix_dest_banco");
  if (v === "dica/questao") return t("lix_dest_questao");
  const partes = String(it.onde || "").split("·").map((s) => s.trim()).filter(Boolean);
  return partes.length ? t("lix_dest_em", { o: partes[partes.length - 1] }) : t("lix_dest_lugar");
}

function lixItemEl(it) {
  const el = lixEl("div", "duv-item dec-item lix-item" + (lixSel.has(it.id) ? " sel" : ""));
  const cab = lixEl("div", "duv-titulo lix-cab");
  const ck = document.createElement("input");
  ck.type = "checkbox"; ck.className = "lix-ck"; ck.checked = lixSel.has(it.id);
  ck.setAttribute("aria-label", t("lix_sel_um", { o: lixNomeCurto(it) }));
  ck.onchange = () => { if (ck.checked) lixSel.add(it.id); else lixSel.delete(it.id); el.classList.toggle("sel", ck.checked); lixPintarSel(); };
  cab.append(ck, lixEl("span", "lix-tipo", t("lix_tipo1_" + it.tipo)), lixEl("span", "lix-quando", lixQuando(it.q)));
  /* o selo de risco só quando conta: "risco baixo" em todo item era ruído */
  if (it.risco === "alto" || it.risco === "medio") cab.append(lixEl("span", "dec-risco dec-risco-" + it.risco, t("dec_risco_" + it.risco)));
  el.append(cab);
  const onde = [it.onde ? t("lix_de", { o: it.onde }) : "", it.motivo === "vazio" ? t("lix_veio_vazio") : ""].filter(Boolean).join(" · ");
  if (onde) el.append(lixEl("div", "nota lix-onde", onde));
  el.append(lixConteudoEl(it));
  const acoes = lixEl("div", "dec-acoes");
  const dest = lixDestino(it);
  const br = lixEl("button", "btn-min btn-min-ok lix-restaurar", t("lix_restaurar_em", { o: dest.length > 42 ? dest.slice(0, 40) + "…" : dest }));
  br.type = "button"; br.title = t("lix_restaurar_em", { o: dest });
  br.onclick = () => lixRestaurarUi(it.id);
  const bv = lixEl("button", "btn-min btn-min-perigo lix-vez", t("lix_apagar_vez"));
  bv.type = "button";
  bv.onclick = () => lixApagarDeVez(it.id);
  acoes.append(br, bv);
  el.append(acoes);
  return el;
}

/* o lote: o que saiu de uma vez fica junto, com "restaurar o lote" */
function lixLoteEl(lote, membros) {
  const box = lixEl("div", "lix-lote");
  const cab = lixEl("div", "lix-lote-cab");
  const um = membros[0];
  const origem = um.loteOnde === "repetidos" ? t("lix_lote_repetidos") : (um.loteOnde || um.onde || "");
  cab.append(lixEl("span", "", t("lix_lote_tit", { n: membros.length, o: origem, q: lixQuando(um.q) })));
  const br = lixEl("button", "btn-min btn-min-ok lix-lote-rest", t("lix_lote_rest", { n: membros.length }));
  br.type = "button"; br.onclick = () => lixRestaurarVarios(membros.map((x) => x.id));
  const sel = lixEl("button", "btn-min", t("lix_lote_sel"));
  sel.type = "button"; sel.onclick = () => { membros.forEach((x) => lixSel.add(x.id)); lixPintar(); };
  cab.append(br, sel);
  box.append(cab);
  const d = lixEl("details", "lix-lote-itens");
  d.append(lixEl("summary", "", t("lix_lote_ver", { n: membros.length })));
  membros.slice(0, 60).forEach((x) => d.append(lixItemEl(x)));
  box.append(d);
  return box;
}

function lixVisiveis() {
  const q = lixNorm(lixBusca).trim();
  return lixLer().slice().reverse().filter((x) => !lixFiltro || x.tipo === lixFiltro)
    .filter((x) => !q || q.split(/\s+/).every((w) => lixNorm([lixTexto(x), x.rotulo, x.onde].join(" ")).indexOf(w) >= 0));
}

/* a barra da seleção: quantos, restaurar, apagar de vez, limpar; sem nada marcado, "marcar todos os visíveis" */
function lixPintarSel() {
  const bar = $("lixSelBar");
  if (!bar) return;
  bar.innerHTML = "";
  const vivos = new Set(lixLer().map((x) => x.id));
  Array.from(lixSel).forEach((id) => { if (!vivos.has(id)) lixSel.delete(id); });
  const bt = (cls, txt, fn, id) => { const b = lixEl("button", "btn-min" + (cls ? " " + cls : ""), txt); b.type = "button"; if (id) b.id = id; b.onclick = fn; bar.append(b); return b; };
  if (lixSel.size) {
    bar.append(lixEl("span", "lix-sel-n", t("lix_sel_n", { n: lixSel.size })));
    bt("btn-min-ok", t("lix_sel_rest"), () => lixRestaurarVarios(Array.from(lixSel)), "btnLixSelRest");
    bt("btn-min-perigo", t("lix_sel_vez"), () => lixApagarVariosDeVez(Array.from(lixSel)), "btnLixSelVez");
    bt("", t("lix_sel_limpar"), () => { lixSel.clear(); lixPintar(); }, "btnLixSelLimpar");
  } else {
    const vis = lixVisiveis();
    if (vis.length > 1) bt("", t("lix_sel_todos", { n: Math.min(vis.length, 150) }), () => { vis.slice(0, 150).forEach((x) => lixSel.add(x.id)); lixPintar(); }, "btnLixSelTodos");
  }
}

function lixPintar() {
  const cx = $("lixLista");
  if (!cx) return;
  const c = lixContar();
  /* o resumo: só o que existe, e quantos cabem antes de o mais antigo sair */
  if (c.total) {
    const partes = [t("lix_r_total", { n: c.total })];
    LIX_TIPOS.forEach((k) => { if (c[k]) partes.push(t("lix_r_" + k, { n: c[k] })); });
    if (c.alto) partes.push(t("lix_r_alto", { n: c.alto }));
    $("lixResumo").textContent = partes.join(" · ") + ". " + t("lix_r_cabem", { n: Math.max(0, lixMax - c.total), m: lixMax });
  } else $("lixResumo").textContent = "";
  const fx = $("lixFiltros");
  fx.innerHTML = "";
  if (lixFiltro && !c[lixFiltro]) lixFiltro = "";
  [""].concat(LIX_TIPOS).forEach((v) => {
    if (v && !c[v]) return;      /* filtro vazio é botão que não leva a nada */
    const b = lixEl("button", "btn-min" + (lixFiltro === v ? " mat-ligado" : ""), v ? t("lix_t_" + v) + " (" + c[v] + ")" : t("lix_f_todos"));
    b.type = "button";
    b.id = "btnLixF_" + (v || "todos");
    b.onclick = () => { lixFiltro = v; lixPintar(); };
    fx.append(b);
  });
  if ($("lixBusca")) $("lixBusca").hidden = c.total < 2;
  lixPintarLista();
}

function lixPintarLista() {
  const cx = $("lixLista");
  if (!cx) return;
  cx.innerHTML = "";
  const c = lixContar();
  const todas = lixVisiveis();
  lixPintarSel();
  if (!todas.length) {
    cx.append(lixEl("p", "nota", t(!c.total ? "lix_vazio" : lixBusca.trim() ? "lix_busca_nada" : "lix_vazio_filtro")));
    return;
  }
  let dia = null;
  const lotesVistos = new Set();
  todas.slice(0, 150).forEach((x) => {
    const g = lixGrupoDia(x.q);
    if (g !== dia) { dia = g; cx.append(lixEl("div", "lix-dia", t("lix_dia_" + g))); }
    if (x.lote) {
      if (lotesVistos.has(x.lote)) return;
      lotesVistos.add(x.lote);
      const membros = todas.filter((y) => y.lote === x.lote);
      if (membros.length > 1) { cx.append(lixLoteEl(x.lote, membros)); return; }
    }
    cx.append(lixItemEl(x));
  });
  if (todas.length > 150) cx.append(lixEl("p", "nota", t("lix_mais", { n: todas.length - 150 })));
}

/* VÁRIOS DE UMA VEZ (a seleção ou um lote): cada um pelo caminho de sempre; o que não tem para onde voltar fica */
function lixRestaurarVarios(ids) {
  let ok = 0, falha = 0;
  (ids || []).forEach((id) => { const r = lixRestaurar(id); if (r.ok) ok++; else falha++; });
  lixSel.clear();
  try { reg("LIXEIRA", "restaurados de uma vez", ok + " ok · " + falha + " sem destino"); } catch (e) {}
  lixMostrar(t(falha ? "lix_rest_varios_falha" : "lix_rest_varios", { n: ok, f: falha }), false);
  lixPintar();
  return { ok, falha };
}
async function lixApagarVariosDeVez(ids) {
  const itens = lixLer().filter((x) => (ids || []).indexOf(x.id) >= 0);
  if (!itens.length) return false;
  const altos = itens.filter((x) => x.risco === "alto").length;
  if (!(await uiConfirm(t("lix_vez_varios_conf", { n: itens.length, a: altos })))) return false;
  const fora = new Set(itens.map((x) => x.id));
  lixLista = lixLista.filter((x) => !fora.has(x.id));
  lixGravar();
  if (lixUltimo && fora.has(lixUltimo)) lixUltimo = null;
  try {
    if (typeof decRegistrar === "function") {
      decRegistrar({ area: "apagar", regra: "apagar.definitivo", origem: "pessoa", lei: "", ref: t("lix_sel_vez"),
        motivo: t("lix_motivo_definitivo"), risco: altos ? "alto" : "medio", decisao: "aceitou", via: "lixeira",
        proposta: { acao: t("lix_sel_vez"), amostra: itens.slice(0, 5).map((x) => lixNomeCurto(x)).join(" | "), n: itens.length, linhas: [] } });
    }
  } catch (e) {}
  lixSel.clear();
  lixAtualizarBotao();
  lixPintar();
  return true;
}

/* PLANO B: o lugar de onde o item saiu não existe mais (o tópico, a questão, a lei). O cartão pode voltar para a
 * bancada; qualquer item pode ter o texto copiado. O item continua na lixeira até a pessoa escolher. */
function lixPlanoB(item, r) {
  const opcoes = [];
  const podeBancada = item && item.tipo === "cartao" && item.dados && typeof item.dados.bloco === "string" && item.via !== "editor";
  if (podeBancada) opcoes.push({ valor: "bancada", rot: t("lix_pb_bancada"), classe: "btn-verde" });
  if (item) opcoes.push({ valor: "copiar", rot: t("lix_pb_copiar"), classe: podeBancada ? "" : "btn-verde" });
  opcoes.push({ valor: "ok", rot: t("help_close") });
  return uiEscolha(t(r.msg || "lix_falha_generica") + (item ? "\n\n" + t("lix_pb_tx") : ""), opcoes).then((v) => {
    if (v === "bancada") {
      const rr = LIX_REST["cartao/editor"](item.dados);
      if (rr.ok) {
        lixLista = lixLista.filter((x) => x.id !== item.id);
        lixGravar();
        if (lixUltimo === item.id) lixUltimo = null;
        lixAtualizarBotao();
        lixMostrar(t("lix_pb_bancada_ok", { o: lixNomeCurto(item) }), false);
        try { lixPintar(); } catch (e) {}
      }
    } else if (v === "copiar") {
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lixTexto(item)).catch(() => {}); } catch (e) {}
      try { toastMsg(t("lix_pb_copiado"), 3000); } catch (e) {}
    }
    return v;
  });
}

function lixAbrir() {
  if (!$("dlgLixeira")) return false;
  lixFiltro = "";
  lixBusca = "";
  lixSel.clear();
  if ($("lixBusca")) $("lixBusca").value = "";
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
  if ($("lixBusca")) $("lixBusca").oninput = () => { lixBusca = $("lixBusca").value || ""; lixPintarLista(); };
  lixAtualizarBotao();
}
lixLigar();
