/* =====================================================================
 * O LIVRO DE FATOS (19.122.0)
 *
 * POR QUÊ: o que o app sabe sobre o seu desempenho morava em lugares que ENCOLHEM. Cada resposta ficava dentro da
 * própria questão (apagar a questão apagava o histórico dela), o histórico de rodadas guardava 120 blocos, o
 * registro geral 600 eventos, e a revisão de um cartão não deixava rastro nenhum — só a próxima data. Para mostrar
 * "como eu evoluí neste tópico", "onde perco pontos" ou um mapa do edital com linha do tempo, falta uma coisa só: um
 * lugar onde cada FATO do estudo entra uma vez e nunca sai.
 *
 * O QUE É UM FATO: uma resposta a uma questão ("q") ou a revisão de um cartão ("c"), com o instante, o dia, o tópico
 * e o resultado — o bastante para valer sozinho, mesmo que a questão ou o cartão deixem de existir. O tempo de
 * estudo continua no DIÁRIO, que já é um registro completo e editável; quem monta um painel lê os dois.
 *
 * COMO: IndexedDB próprio ("eac_idb_fatos"), UM REGISTRO POR FATO, pela identidade dele (questão + instante). Só
 * se acrescenta — nunca se regrava a gaveta inteira, e por isso gravar enquanto ela ainda carrega não apaga nada.
 * O mesmo fato escrito de novo cai na mesma chave: trazer o histórico antigo (as tentativas já guardadas nas
 * questões) pode rodar a cada abertura sem duplicar, e conserta o que tiver faltado. A leitura é síncrona, de uma
 * cópia na memória. Entra no backup ("eac_fatos"); 100% local.
 * ===================================================================== */
const FATOS_IDB = "eac_idb_fatos";
const FATOS_LOJA = "fatos";

let _fatos = new Map();          /* id -> fato (a cópia na memória) */
let _fatosCarregou = false;
let _fatosProntoP = null;
let _fatosGravando = null;       /* a última gravação em segundo plano (o backup espera por ela) */
let _fatosLoja = null;
let _fatosAvisou = false;

function fatosSuportado() {
  if (_fatosLoja) return true;
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; }
}

/* a loja: { lerTudo() -> [fatos], por([fatos]), apagar([ids]), limpar() } — trocável nos testes (fatosLojaDefinir) */
function fatosLoja() {
  if (_fatosLoja) return _fatosLoja;
  const abrir = () => new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(FATOS_IDB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(FATOS_LOJA)) db.createObjectStore(FATOS_LOJA); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("erro ao abrir o livro de fatos"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
  const tx = (modo, fn) => abrir().then((db) => new Promise((resolve, reject) => {
    const x = db.transaction([FATOS_LOJA], modo);
    let out;
    try { out = fn(x.objectStore(FATOS_LOJA)); } catch (e) { try { db.close(); } catch (y) {} reject(e); return; }
    x.oncomplete = () => { db.close(); resolve(typeof out === "function" ? out() : out); };
    x.onerror = () => { db.close(); reject(x.error || new Error("erro no livro de fatos")); };
    x.onabort = () => { db.close(); reject(x.error || new Error("gravação do livro de fatos abortada (sem espaço?)")); };
  }));
  _fatosLoja = {
    lerTudo: () => tx("readonly", (l) => {
      const out = [];
      const req = l.openCursor();
      req.onsuccess = () => { const cur = req.result; if (cur) { out.push(cur.value); cur.continue(); } };
      return () => out;
    }),
    por: (lista) => tx("readwrite", (l) => { (lista || []).forEach((f) => { if (f && f.id) l.put(f, f.id); }); return true; }),
    apagar: (ids) => tx("readwrite", (l) => { (ids || []).forEach((id) => l.delete(id)); return true; }),
    limpar: () => tx("readwrite", (l) => { l.clear(); return true; }),
  };
  return _fatosLoja;
}
function fatosLojaDefinir(l) { _fatosLoja = l; }

function fatosFalha(e) {
  try { reg("ERRO", "livro de fatos: gravação não feita", (e && e.message) || "?"); } catch (x) {}
  if (_fatosAvisou) return;
  _fatosAvisou = true;
  try { uiAlert(t("fatos_sem_espaco")); } catch (x) {}
}
function fatosNaFila(fn) {
  _fatosGravando = (_fatosGravando || Promise.resolve()).then(fn).catch(fatosFalha);
  return _fatosGravando;
}

/* traz a gaveta para a memória. O que já entrou na memória (uma resposta dada enquanto carregava) é o mais novo: fica. */
function fatosCarregar() {
  if (_fatosProntoP) return _fatosProntoP;
  if (!fatosSuportado()) { _fatosCarregou = true; _fatosProntoP = Promise.resolve(0); return _fatosProntoP; }
  const ler = () => fatosLoja().lerTudo().then((lista) => {
    (lista || []).forEach((f) => { if (f && f.id && !_fatos.has(f.id)) _fatos.set(f.id, f); });
    _fatosCarregou = true;
    return _fatos.size;
  });
  _fatosProntoP = (typeof idbGuardaComecar === "function" ? idbGuardaComecar("fatos", ler, false) : ler().catch(() => 0))
    .then(() => { _fatosCarregou = true; return _fatos.size; });
  return _fatosProntoP;
}
function fatosPronto() { return _fatosProntoP || fatosCarregar(); }

/* ACRESCENTA um fato (ou corrige o mesmo, pela mesma identidade). Síncrono para quem chama. */
function fatoGravar(f) {
  if (!f || !f.id || !f.k || !f.t) return false;
  _fatos.set(f.id, f);
  if (fatosSuportado()) fatosNaFila(() => fatosLoja().por([f]));
  return true;
}
function fatosGravarVarios(lista) {
  const novos = (lista || []).filter((f) => f && f.id && f.k && f.t);
  novos.forEach((f) => _fatos.set(f.id, f));
  if (novos.length && fatosSuportado()) fatosNaFila(() => fatosLoja().por(novos));
  return novos.length;
}
/* só para o "desfazer" imediato de uma nota de cartão dada por engano */
function fatoApagar(id) {
  if (!_fatos.has(id)) return false;
  _fatos.delete(id);
  if (fatosSuportado()) fatosNaFila(() => fatosLoja().apagar([id]));
  return true;
}

/* os fatos, do mais antigo ao mais novo. o: { tipo: "q"|"c", de: "AAAA-MM-DD", ate, chave } */
function fatosLista(o) {
  const f = o || {};
  const ch = f.chave ? fatoChave(f.chave) : "";
  const out = [];
  _fatos.forEach((x) => {
    if (f.tipo && x.k !== f.tipo) return;
    if (f.de && x.d < f.de) return;
    if (f.ate && x.d > f.ate) return;
    if (ch && x.ch !== ch) return;
    out.push(x);
  });
  return out.sort((a, b) => String(a.t).localeCompare(String(b.t)));
}
function fatosTotal() { return _fatos.size; }

/* ------------------------- o que é cada fato ------------------------- */
function fatoChave(ch) { return typeof qsChaveNormal === "function" ? qsChaveNormal(ch) : String(ch || "").toLowerCase(); }
function fatoDia(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
/* uma resposta: vale sozinha (tópico, ramo, banca, tipo e resultado vão junto) */
function fatoDeResposta(q, tent) {
  if (!q || !q.id || !tent || !tent.q) return null;
  const f = { id: "q|" + q.id + "|" + tent.q, k: "q", t: tent.q, d: fatoDia(tent.q), ch: fatoChave(q.chave),
    disc: q.disciplina || "", top: q.topico || "", qid: q.id, ok: !!tent.acertou, resp: tent.resp || "", gab: q.gabarito || "", tipo: q.tipo || "" };
  if (tent.chute) f.chute = true;
  if (q.ramo) f.ramo = q.ramo;
  if (q.banca) f.banca = q.banca;
  return f.d ? f : null;
}
/* a revisão de um cartão: a nota (1 de novo · 2 difícil · 3 bom · 4 fácil) */
function fatoDeCartao(u, nota, agoraMs, ctx) {
  if (!u || !u.id || !nota) return null;
  const t0 = new Date(agoraMs || Date.now()).toISOString();
  const c = ctx || {};
  return { id: "c|" + u.id + "|" + t0, k: "c", t: t0, d: fatoDia(t0), ch: fatoChave(c.chave || u.chave || ""),
    disc: c.disciplina || u.disciplina || "", top: c.topico || u.topico || "", cid: u.id, nota: Number(nota) || 0, ok: Number(nota) >= 3 };
}

/* O HISTÓRICO QUE JÁ EXISTE: cada tentativa guardada nas questões vira um fato (a mesma identidade — rodar de novo
 * não duplica). Devolve quantos entraram agora. */
function fatosRetroativo() {
  if (typeof qsTodas !== "function") return 0;
  const novos = [];
  (qsTodas() || []).forEach((q) => (q && q.tentativas || []).forEach((tt) => {
    const f = fatoDeResposta(q, tt);
    if (f && !_fatos.has(f.id)) novos.push(f);
  }));
  const n = fatosGravarVarios(novos);
  if (n) { try { reg("ARMAZEN", "livro de fatos: histórico das questões trazido", n + " resposta(s) · total " + _fatos.size); } catch (e) {} }
  return n;
}

/* no arranque: carrega o livro, espera as questões chegarem e traz o que faltar do histórico */
function fatosIniciar() {
  return fatosCarregar().then(() => (typeof qsPronto === "function" ? qsPronto() : null)).then(() => {
    let n = 0;
    try { n = fatosRetroativo(); } catch (e) { n = 0; }
    try { if (typeof fatosUiResumoLinha === "function") fatosUiResumoLinha(); } catch (e) {}
    return n;
  }).catch(() => 0);
}

/* ------------------------------ backup ------------------------------ */
function fatosParaBackup() {
  if (!_fatosCarregou) return null;
  return JSON.stringify(fatosLista());
}
/* restaurar: o livro passa a ser o do arquivo (como as outras gavetas) */
function fatosDefinirTudo(lista) {
  const m = new Map();
  (Array.isArray(lista) ? lista : []).forEach((f) => { if (f && f.id && f.k && f.t) m.set(f.id, f); });
  _fatos = m;
  _fatosCarregou = true;
  if (fatosSuportado()) {
    const tudo = [...m.values()];
    fatosNaFila(() => fatosLoja().limpar().then(() => fatosLoja().por(tudo)));
  }
  return true;
}

/* ----------------------------- as contas ----------------------------- */
/* o acerto honesto: certo de verdade vale 1; certo no chute vale 1/4 (a mesma regra do Domínio) */
function fatosPontos(lista) {
  const peso = typeof QS_PESO_CHUTE === "number" ? QS_PESO_CHUTE : 0.25;
  let p = 0, n = 0;
  (lista || []).forEach((f) => { if (f.k !== "q") return; n++; if (f.ok) p += f.chute ? peso : 1; });
  return { n, pontos: p, pct: n ? Math.round((p / n) * 100) : null };
}
function fatosResumo(lista) {
  const qs = (lista || []).filter((f) => f.k === "q"), cs = (lista || []).filter((f) => f.k === "c");
  const dias = new Set((lista || []).map((f) => f.d));
  const pt = fatosPontos(qs);
  return {
    respostas: qs.length, certas: qs.filter((f) => f.ok).length, chutes: qs.filter((f) => f.chute).length, pct: pt.pct,
    cartoes: cs.length, cartoesBons: cs.filter((f) => f.ok).length, dias: dias.size,
    desde: (lista && lista.length) ? lista[0].d : "", ate: (lista && lista.length) ? lista[lista.length - 1].d : "",
  };
}
/* por tópico, do mais respondido ao menos. minutosPorChave (opcional): { chave: minutos } vindos do diário */
function fatosPorTopico(lista, minutosPorChave) {
  const g = new Map();
  (lista || []).forEach((f) => {
    const k = f.ch || "(sem tópico)";
    let x = g.get(k);
    if (!x) { x = { ch: k, disc: f.disc || "", top: f.top || "", fatos: [], ultimo: "" }; g.set(k, x); }
    x.fatos.push(f);
    if (f.d > x.ultimo) x.ultimo = f.d;
    if (!x.top && f.top) { x.top = f.top; x.disc = f.disc || x.disc; }
  });
  const mins = minutosPorChave || {};
  return [...g.values()].map((x) => {
    const r = fatosResumo(x.fatos);
    return { ch: x.ch, disc: x.disc, top: x.top, respostas: r.respostas, certas: r.certas, chutes: r.chutes, pct: r.pct,
      cartoes: r.cartoes, ultimo: x.ultimo, minutos: mins[x.ch] || 0 };
  }).sort((a, b) => b.respostas - a.respostas || b.cartoes - a.cartoes || a.top.localeCompare(b.top));
}
/* os minutos do diário por tópico, no período (o diário é a fonte do tempo; "pendente" não é estudo) */
function fatosMinutosDoDiario(diario, de, ate) {
  const out = {};
  (diario || []).forEach((x) => {
    if (!x || !x.d || x.d === "?" || x.a === "pendente") return;
    if (de && x.d < de) return;
    if (ate && x.d > ate) return;
    const k = fatoChave(x.c || "");
    if (k) out[k] = (out[k] || 0) + (Number(x.m) || 0);
  });
  return out;
}

/* ------------------------------- a tela ------------------------------ */
let fatosUiPeriodo = 30;      /* dias; 0 = tudo */

function fatosUiDe(dias) {
  if (!dias) return "";
  const d = new Date(); d.setDate(d.getDate() - (dias - 1));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fatosUiData(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—"; }

/* a linha ao lado do botão: "1.842 respostas e 310 revisões desde 27/08/2026" */
function fatosUiResumoLinha() {
  const el = $("fatosResumoLinha");
  if (!el) return;
  const r = fatosResumo(fatosLista());
  el.textContent = (r.respostas + r.cartoes) ? t("fatos_linha", { q: r.respostas, c: r.cartoes, d: fatosUiData(r.desde) }) : t("fatos_linha_vazia");
}

function fatosUiPintar() {
  const cx = $("fatosCorpo");
  if (!cx) return;
  const de = fatosUiDe(fatosUiPeriodo);
  const lista = fatosLista(de ? { de } : {});
  const todos = fatosResumo(fatosLista());
  const r = fatosResumo(lista);
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const mins = fatosMinutosDoDiario(diario, de, "");
  const minTotal = Object.keys(mins).reduce((a, k) => a + mins[k], 0);
  cx.textContent = "";
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  /* de onde vêm os números — antes de qualquer número */
  cx.append(el("p", "fatos-fonte", (todos.respostas + todos.cartoes)
    ? t("fatos_fonte", { q: todos.respostas, c: todos.cartoes, d: fatosUiData(todos.desde) }) : t("fatos_fonte_vazia")));

  const per = el("div", "fatos-periodos");
  [[7, "fatos_p7"], [30, "fatos_p30"], [90, "fatos_p90"], [0, "fatos_ptudo"]].forEach(([n, k]) => {
    const b = el("button", "btn-min btn-p" + (fatosUiPeriodo === n ? " fatos-per-on" : ""), t(k));
    b.type = "button";
    b.setAttribute("aria-pressed", fatosUiPeriodo === n ? "true" : "false");
    b.onclick = () => { fatosUiPeriodo = n; fatosUiPintar(); };
    per.append(b);
  });
  cx.append(per);

  const chips = el("div", "mc-status");
  const chip = (txt, cls) => chips.append(el("span", "mc-chip " + (cls || "mc-chip-ok"), txt));
  chip(t("fatos_c_resp", { n: r.respostas }));
  if (r.respostas) chip(t("fatos_c_acerto", { p: r.pct, c: r.certas, k: r.chutes }));
  chip(t("fatos_c_cartoes", { n: r.cartoes }));
  chip(t("fatos_c_tempo", { h: typeof horasTexto === "function" ? horasTexto(minTotal) : minTotal + " min" }), "mc-chip-rep");
  chip(t("fatos_c_dias", { n: r.dias }), "mc-chip-rep");
  cx.append(chips);

  const linhas = fatosPorTopico(lista, mins);
  if (!linhas.length) { cx.append(el("p", "nota", t("fatos_nada_periodo"))); return; }
  const tab = el("table", "fatos-tab");
  const cab = el("tr");
  ["fatos_h_topico", "fatos_h_resp", "fatos_h_acerto", "fatos_h_cartoes", "fatos_h_tempo", "fatos_h_ultimo"].forEach((k, i) => {
    const th = el("th", i ? "fatos-num" : "", t(k)); cab.append(th);
  });
  const thead = el("thead"); thead.append(cab); tab.append(thead);
  const tb = el("tbody");
  linhas.forEach((x) => {
    const tr = el("tr");
    const c0 = el("td");
    c0.append(el("div", "fatos-top", x.top || x.ch), el("div", "fatos-disc", x.disc || ""));
    tr.append(c0);
    tr.append(el("td", "fatos-num", x.respostas ? String(x.respostas) : "—"));
    const ac = el("td", "fatos-num", x.respostas ? x.pct + "%" : "—");
    if (x.respostas) ac.title = t("fatos_acerto_tip", { c: x.certas, n: x.respostas, k: x.chutes });
    if (x.respostas && x.respostas < 5) { ac.classList.add("fatos-pouco"); ac.title += " · " + t("fatos_pouco"); }
    tr.append(ac);
    tr.append(el("td", "fatos-num", x.cartoes ? String(x.cartoes) : "—"));
    tr.append(el("td", "fatos-num", x.minutos ? (typeof horasTexto === "function" ? horasTexto(x.minutos) : x.minutos + " min") : "—"));
    tr.append(el("td", "fatos-num", fatosUiData(x.ultimo)));
    tb.append(tr);
  });
  tab.append(tb);
  const rol = el("div", "fatos-rol"); rol.append(tab);
  cx.append(rol);
  cx.append(el("p", "fatos-limite", t("fatos_limite")));
}

/* a tabela do período, para colar numa planilha */
function fatosUiCsv() {
  const de = fatosUiDe(fatosUiPeriodo);
  const diario = (typeof edDiario !== "undefined" && edDiario) || [];
  const linhas = fatosPorTopico(fatosLista(de ? { de } : {}), fatosMinutosDoDiario(diario, de, ""));
  const cel = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  const out = [["disciplina", "topico", "respostas", "certas", "chutes", "acerto_pct", "cartoes", "minutos", "ultimo"].join(";")];
  linhas.forEach((x) => out.push([cel(x.disc), cel(x.top || x.ch), x.respostas, x.certas, x.chutes, x.pct == null ? "" : x.pct, x.cartoes, x.minutos, x.ultimo].join(";")));
  return out.join("\n");
}

function fatosUiAbrir() {
  fatosUiPintar();
  if (typeof abrirModal === "function") abrirModal("dlgFatos"); else if ($("dlgFatos")) $("dlgFatos").showModal();
  try { reg("FATOS", "livro de fatos aberto", fatosTotal() + " fato(s)"); } catch (e) {}
}

function fatosUiIniciar() {
  if ($("btnFatosAbrir")) $("btnFatosAbrir").onclick = () => fatosUiAbrir();
  if ($("btnFatosFechar")) $("btnFatosFechar").onclick = () => $("dlgFatos").close();
  if ($("btnFatosX")) $("btnFatosX").onclick = () => $("dlgFatos").close();
  if ($("btnFatosCsv")) $("btnFatosCsv").onclick = () => {
    const txt = fatosUiCsv();
    try { navigator.clipboard.writeText(txt); } catch (e) {}
    try { toastMsg(t("fatos_csv_ok", { n: Math.max(0, txt.split("\n").length - 1) }), 3500); } catch (e) {}
  };
  fatosUiResumoLinha();
}
