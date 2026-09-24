/* ===================================================================
 * RADAR DE REPETIÇÃO DOS CARTÕES
 *
 * Medido num baralho real de 955 notas: 62% dos cartões básicos eram
 * paráfrases uns dos outros ("prazo do dia 09" 20 vezes, "devedor
 * contumaz" 19), e 112 cartões de lacuna cobriam só 14 frases. A única
 * detecção que o app tinha (gruposDuplicados, parser.js) compara a frente
 * IDÊNTICA dentro de um único texto — não vê paráfrase e não vê entre
 * tópicos. Aqui se agrupa por semelhança, na biblioteca inteira, e se
 * deixa decidir grupo a grupo. Nada some sem passar pela lixeira.
 *
 * O núcleo (cq* sem UI) é puro: recebe cartões {front, back, more, kind}
 * e devolve grupos de índices. A tela e a aplicação ficam embaixo.
 * =================================================================== */
const CQ_LIM = {
  frente: 0.6,          // frentes com 60% das palavras em comum
  frenteMista: 0.45,    // ...ou 45% na frente E 50% no verso
  verso: 0.5,
  maxDfFrac: 0.25,      // palavra que está em >25% dos cartões não aproxima ninguém
  maxDfMin: 30,
  visiveis: 25,         // grupos desenhados por vez
};

const CQ_STOP = new Set(("de da do das dos a o as os e em no na nos nas um uma para por com que se ao aos sao ser "
  + "qual quais como quando onde segundo conforme art artigo ate").split(" "));

function cqNormal(s) {
  return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/* A frase de um cartão de lacuna com as respostas à vista: dois cartões que
 * escondem palavras diferentes da MESMA frase são o mesmo cartão. */
function cqRevelado(c) {
  const f = String((c && c.front) || "");
  return (c && c.kind === "cloze") || /\{\{c\d+::/.test(f)
    ? f.replace(/\{\{c\d+::([^}]*?)(?:::[^}]*)?\}\}/g, "$1") : f;
}

function cqTokens(s) {
  const r = new Set();
  cqNormal(s).split(" ").forEach((w) => { if (w.length > 2 && !CQ_STOP.has(w)) r.add(w); });
  return r;
}

function cqJaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let c = 0;
  a.forEach((w) => { if (b.has(w)) c++; });
  return c / (a.size + b.size - c);
}

/* Quanto de `a` já está em `b` (para saber se um verso não acrescenta nada). */
function cqContido(a, b) {
  if (!a.size) return 1;
  let c = 0;
  a.forEach((w) => { if (b.has(w)) c++; });
  return c / a.size;
}

function cqIguais(x, y) {
  return cqNormal(cqRevelado(x)) === cqNormal(cqRevelado(y)) && cqNormal(cqRevelado(x)) !== "";
}

/* Agrupa cartões parecidos. Devolve [[i, j, ...], ...] (só grupos com 2+),
 * do maior para o menor. Não compara todos com todos: um índice de palavras
 * só apresenta os cartões que dividem palavras raras, então milhares de
 * notas não custam milhões de comparações. */
function cqAgrupar(cards) {
  const N = (cards || []).length;
  const fr = cards.map((c) => cqTokens(cqRevelado(c)));
  const vs = cards.map((c) => cqTokens(c && c.back));
  const pai = cards.map((_, i) => i);
  const acha = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
  const une = (a, b) => { const ra = acha(a), rb = acha(b); if (ra !== rb) pai[Math.max(ra, rb)] = Math.min(ra, rb); };

  const df = new Map();
  fr.forEach((s) => s.forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const teto = Math.max(CQ_LIM.maxDfMin, Math.floor(N * CQ_LIM.maxDfFrac));

  const indice = new Map();
  const iguais = new Map();
  for (let i = 0; i < N; i++) {
    const k = cqNormal(cqRevelado(cards[i]));
    if (k) { if (iguais.has(k)) une(i, iguais.get(k)); else iguais.set(k, i); }
    const comum = new Map();
    fr[i].forEach((w) => {
      if ((df.get(w) || 0) > teto) return;
      (indice.get(w) || []).forEach((j) => comum.set(j, (comum.get(j) || 0) + 1));
    });
    comum.forEach((_, j) => {
      if (acha(i) === acha(j)) return;
      const jf = cqJaccard(fr[i], fr[j]);
      if (jf >= CQ_LIM.frente || (jf >= CQ_LIM.frenteMista && cqJaccard(vs[i], vs[j]) >= CQ_LIM.verso)) une(i, j);
    });
    fr[i].forEach((w) => {
      if ((df.get(w) || 0) > teto) return;
      if (!indice.has(w)) indice.set(w, []);
      indice.get(w).push(i);
    });
  }
  const g = new Map();
  cards.forEach((_, i) => { const r = acha(i); if (!g.has(r)) g.set(r, []); g.get(r).push(i); });
  return [...g.values()].filter((x) => x.length > 1).sort((a, b) => b.length - a.length || a[0] - b[0]);
}

/* Quanto o cartão ensina: resposta, explicação, artigo e literalidade. */
function cqPontuar(c) {
  const back = String((c && c.back) || ""), more = String((c && c.more) || "");
  const tudo = String((c && c.front) || "") + " " + back + " " + more;
  return Math.min(back.length, 500) + Math.min(more.length, 900) * 0.5
    + (/art(?:igo)?\.?\s*\d/i.test(tudo) ? 150 : 0) + (/literalidade/i.test(more) ? 100 : 0);
}

/* O índice (dentro do grupo) do cartão mais completo; empate fica com o mais antigo. */
function cqMelhor(cards, grupo) {
  let m = grupo[0], p = -1;
  grupo.forEach((i) => { const s = cqPontuar(cards[i]); if (s > p) { p = s; m = i; } });
  return m;
}

/* O que o `outro` sabe e o `fica` não: o verso (se acrescenta algo) e as linhas
 * do saiba mais que faltam. Devolve linhas "+ ..." prontas para gravar. */
function cqAcrescimos(fica, outro) {
  const um = (s) => String(s || "").replace(/\s*::\s*/g, " — ").replace(/\r?\n+/g, " ").trim();
  const linhas = [];
  const tenho = cqTokens(String(fica.back || "") + " " + String(fica.more || ""));
  const tenhoTxt = cqNormal(String(fica.more || ""));
  if (cqContido(cqTokens(outro.back), tenho) < 0.9 && um(outro.back)) linhas.push("+ Também cobrado — " + um(outro.back));
  String(outro.more || "").split(/<br\s*\/?>|\r?\n/i).forEach((l) => {
    const x = um(l).replace(/^[+*]\s*/, "");
    if (x && tenhoTxt.indexOf(cqNormal(x)) < 0 && cqContido(cqTokens(x), tenho) < 0.9) linhas.push("+ " + x);
  });
  return linhas;
}

/* Insere linhas "+" logo abaixo do cartão (depois do "+ saiba mais" que ele já tem). */
function cqInserirSaibaMais(bruto, c, novas) {
  if (!novas || !novas.length) return String(bruto || "");
  const linhas = String(bruto || "").split("\n");
  const raw = String((c && c.raw) || "").trim();
  let k = c && c.line ? c.line - 1 : -1;
  if (k < 0 || String(linhas[k] || "").trim() !== raw) k = linhas.findIndex((l) => l.trim() === raw);
  if (k < 0) return null;
  let ate = k;
  while (ate + 1 < linhas.length && /^\s*[+*]\s/.test(linhas[ate + 1])) ate++;
  linhas.splice(ate + 1, 0, ...novas);
  return linhas.join("\n");
}

/* ---- a biblioteca ---- */

/* Todos os cartões do material, cada um com o lugar de onde veio. */
function cqLerBiblioteca() {
  const notas = [];
  if (typeof matResumos !== "object") return notas;
  Object.keys(matResumos).forEach((chave) => {
    const r = matResumos[chave];
    if (!r || !String(r.cartoes || "").trim()) return;
    let cs = [];
    try { cs = parseText(String(r.cartoes)).cards; } catch (e) { return; }
    cs.forEach((c) => notas.push({ chave, disciplina: r.disciplina || "", topico: r.topico || "", card: c }));
  });
  return notas;
}

function cqRelatorio(notas) {
  const grupos = cqAgrupar(notas.map((x) => x.card)).map((g) => {
    const cards = notas.map((x) => x.card);
    return { itens: g, melhor: cqMelhor(cards, g) };
  });
  const redundantes = grupos.reduce((s, g) => s + g.itens.length - 1, 0);
  return { total: notas.length, grupos, redundantes,
           pct: notas.length ? Math.round(100 * redundantes / notas.length) : 0 };
}

/* Assinatura estável de um grupo, para lembrar "não é repetido". */
function cqAssinatura(notas, grupo) {
  const s = grupo.map((i) => cqNormal(cqRevelado(notas[i].card))).sort().join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + "." + grupo.length;
}

const CQ_CHAVE_IGNORADOS = "eac_cq_ignorados";
function cqIgnorados() {
  try { return new Set(JSON.parse(localStorage.getItem(CQ_CHAVE_IGNORADOS) || "[]")); } catch (e) { return new Set(); }
}
function cqIgnorar(sig) {
  try {
    const s = cqIgnorados(); s.add(sig);
    localStorage.setItem(CQ_CHAVE_IGNORADOS, JSON.stringify([...s].slice(-2000)));
  } catch (e) {}
}
function cqReexibirIgnorados() {
  try { localStorage.removeItem(CQ_CHAVE_IGNORADOS); } catch (e) {}
}

/* Resolve UM grupo: fica o cartão `manter`; os outros vão para a lixeira. Com
 * `mesclar`, o que os outros sabiam a mais entra no saiba mais do que fica,
 * ANTES de eles saírem — se a inserção falhar, nada é apagado. */
function cqResolverGrupo(notas, grupo, manter, mesclar) {
  const fica = notas[manter];
  let mesclados = 0, removidos = 0;
  const outros = grupo.filter((i) => i !== manter);
  if (mesclar) {
    const novas = [];
    outros.forEach((i) => cqAcrescimos(fica.card, notas[i].card).forEach((l) => { if (novas.indexOf(l) < 0) novas.push(l); }));
    if (novas.length) {
      const bruto = String((matResumos[fica.chave] || {}).cartoes || "");
      const novo = cqInserirSaibaMais(bruto, fica.card, novas);
      if (novo === null) return { removidos: 0, mesclados: 0, erro: "mesclar" };
      matGravarCartoes(fica.chave, novo, { disciplina: fica.disciplina, topico: fica.topico });
      mesclados = novas.length;
    }
  }
  outros.forEach((i) => {
    const n = notas[i];
    const bruto = String((matResumos[n.chave] || {}).cartoes || "");
    const saida = {};
    const novo = mcTextoSemCartao(bruto, n.card, saida);
    if (novo === null) return;
    matGravarCartoes(n.chave, novo, { disciplina: n.disciplina, topico: n.topico });
    removidos++;
    try {
      lixJogar({ tipo: "cartao", via: "material", motivo: "repetido",
        rotulo: String(n.card.front || "").slice(0, 90),
        onde: [n.disciplina, n.topico].filter(Boolean).join(" · "),
        dados: { chave: n.chave, disciplina: n.disciplina, topico: n.topico,
                 bloco: saida.bloco, linha: saida.linha, sep: saida.sep } });
    } catch (e) {}
  });
  try { matReg("cartoes", "repetidos resolvidos", removidos + " para a lixeira, " + mesclados + " linha(s) juntadas"); } catch (e) {}
  return { removidos, mesclados };
}

/* ---- a tela ---- */
let cqNotas = [], cqRel = null, cqMostrando = CQ_LIM.visiveis;

function cqEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function cqCalcular() {
  cqNotas = cqLerBiblioteca();
  const rel = cqRelatorio(cqNotas);
  const ign = cqIgnorados();
  const visiveis = [], ocultos = [];
  rel.grupos.forEach((g) => (ign.has(cqAssinatura(cqNotas, g.itens)) ? ocultos : visiveis).push(g));
  const redundantes = visiveis.reduce((s, g) => s + g.itens.length - 1, 0);
  cqRel = { total: rel.total, grupos: visiveis, ocultos: ocultos.length, redundantes,
            pct: rel.total ? Math.round(100 * redundantes / rel.total) : 0 };
  return cqRel;
}

function cqTrecho(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; }

function cqPintar() {
  const r = cqRel || cqCalcular();
  $("cqResumo").textContent = r.total
    ? t("cq_resumo", { n: r.total, g: r.grupos.length, r: r.redundantes, p: r.pct })
    : t("cq_sem_cartoes");
  const cx = $("cqLista");
  cx.innerHTML = "";
  if (r.total && !r.grupos.length) cx.append(cqEl("p", "nota", t("cq_nenhum")));
  r.grupos.slice(0, cqMostrando).forEach((g) => {
    const box = cqEl("div", "cq-grupo");
    box.append(cqEl("div", "cq-grupo-tit", t("cq_grupo", { n: g.itens.length })));
    g.itens.forEach((i) => {
      const n = cqNotas[i], sug = i === g.melhor;
      const lin = cqEl("div", "cq-item" + (sug ? " cq-sugerido" : ""));
      lin.append(cqEl("div", "cq-f", cqTrecho(cqRevelado(n.card), 160) + (sug ? "  ★ " + t("cq_mais_completo") : "")));
      lin.append(cqEl("div", "cq-v", cqTrecho(n.card.back, 200)));
      lin.append(cqEl("div", "cq-onde", [n.disciplina, n.topico].filter(Boolean).join(" · ")));
      const b = cqEl("button", "btn-min", t("cq_manter_este"));
      b.type = "button";
      b.onclick = () => cqAplicar(g, i, false);
      lin.append(b);
      box.append(lin);
    });
    const ac = cqEl("div", "qm-bts");
    const m = cqEl("button", "btn-min btn-min-ok", t("cq_mesclar"));
    m.type = "button"; m.title = t("cq_mesclar_aj");
    m.onclick = () => cqAplicar(g, g.melhor, true);
    const ig = cqEl("button", "btn-min", t("cq_ignorar"));
    ig.type = "button"; ig.title = t("cq_ignorar_aj");
    ig.onclick = () => { cqIgnorar(cqAssinatura(cqNotas, g.itens)); cqCalcular(); cqPintar(); };
    ac.append(m, ig);
    box.append(ac);
    cx.append(box);
  });
  $("btnCqMais").hidden = r.grupos.length <= cqMostrando;
  $("btnCqTudo").hidden = !r.grupos.length;
  $("btnCqReexibir").hidden = !r.ocultos;
  if (r.ocultos) $("btnCqReexibir").textContent = t("cq_reexibir", { n: r.ocultos });
}

async function cqAplicar(g, manter, mesclar) {
  const outros = g.itens.length - 1;
  const n = cqNotas[manter];
  if (!(await uiConfirm(t(mesclar ? "cq_conf_mesclar" : "cq_conf_manter", { n: outros, f: cqTrecho(cqRevelado(n.card), 100) })))) return;
  const r = cqResolverGrupo(cqNotas, g.itens, manter, mesclar);
  if (r.erro) { uiAlert(t("cq_erro_mesclar")); return; }
  cqCalcular(); cqPintar();
  try { matRender(); } catch (e) {}
}

async function cqAplicarTudo() {
  const r = cqRel || cqCalcular();
  if (!r.grupos.length) return;
  if (!(await uiConfirm(t("cq_conf_tudo", { g: r.grupos.length, r: r.redundantes })))) return;
  /* de trás para a frente do relatório: cada grupo lê o texto atual do tópico,
   * então a ordem não importa — o que importa é resolver todos com as notas
   * lidas uma vez, cada cartão por sua própria linha/raw */
  let tirados = 0, juntas = 0;
  r.grupos.forEach((g) => {
    const x = cqResolverGrupo(cqNotas, g.itens, g.melhor, true);
    tirados += x.removidos || 0; juntas += x.mesclados || 0;
  });
  cqCalcular(); cqPintar();
  try { matRender(); } catch (e) {}
  uiAlert(t("cq_feito", { n: tirados, m: juntas }));
}

function cqAbrir() {
  cqMostrando = CQ_LIM.visiveis;
  cqCalcular();
  cqPintar();
  abrirModal("dlgCartRep");
  try { matReg("cartoes", "radar de repetição aberto", (cqRel.total) + " cartões, " + cqRel.grupos.length + " grupos"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnCartRepetidos")) {
  $("btnCartRepetidos").onclick = cqAbrir;
  if ($("btnCqFechar")) $("btnCqFechar").onclick = () => $("dlgCartRep").close();
  if ($("btnCqMais")) $("btnCqMais").onclick = () => { cqMostrando += CQ_LIM.visiveis; cqPintar(); };
  if ($("btnCqTudo")) $("btnCqTudo").onclick = cqAplicarTudo;
  if ($("btnCqReexibir")) $("btnCqReexibir").onclick = () => { cqReexibirIgnorados(); cqCalcular(); cqPintar(); };
}
