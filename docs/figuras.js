/* =====================================================================
 * (19.133.0) FIGURAS NAS QUESTÕES
 *
 * O PEDIDO: questão de estatística, de contabilidade, de raciocínio lógico depende de gráfico, histograma, diagrama —
 * e o app só guardava texto. No PDF de referência, 7 das 44 questões citam uma figura que a leitura do texto perde.
 *
 * COMO:
 *  · a figura entra por três portas, na mesma janela (⋮ da questão → "figura"): COLAR (Ctrl+V de um recorte de tela),
 *    ESCOLHER uma imagem, ou ABRIR O PDF e recortar da página — o app já desenha páginas de PDF para as leis;
 *  · em qualquer uma dá para arrastar um retângulo e ficar só com o recorte;
 *  · a imagem é reduzida (largura máxima de 1100 px) e comprimida antes de guardar;
 *  · mora no IndexedDB deste aparelho ("eac_idb_figuras"), com a cópia na memória — o localStorage não aguentaria;
 *  · a questão guarda só os códigos (q.figs = ["f…"]); a figura aparece debaixo do enunciado, e um toque amplia;
 *  · entra no backup ("eac_figuras") e volta na restauração, como o livro de fatos.
 * O QUE FICA DE FORA: figura em resumo e em cartão; e a limpeza das figuras de questões apagadas (a lixeira pode
 * devolver a questão, então a figura fica).
 * ===================================================================== */
const FIG_IDB = "eac_idb_figuras";
const FIG_LOJA = "figuras";
const FIG_LARGURA_MAX = 1100;
const FIG_POR_QUESTAO = 4;

let _figs = new Map();           /* id -> { id, d (data URL), w, h, t, nome, pag } */
let _figsCarregou = false;
let _figsProntoP = null;
let _figsGravando = null;
let _figsLoja = null;
let _figsAvisou = false;

function figSuportado() {
  if (_figsLoja) return true;
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; }
}
/* a loja: { lerTudo(), por([figs]), apagar([ids]), limpar() } — trocável nos testes (figLojaDefinir) */
function figLoja() {
  if (_figsLoja) return _figsLoja;
  const abrir = () => new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(FIG_IDB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(FIG_LOJA)) db.createObjectStore(FIG_LOJA); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("erro ao abrir as figuras"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
  const tx = (modo, fn) => abrir().then((db) => new Promise((resolve, reject) => {
    const x = db.transaction([FIG_LOJA], modo);
    let out;
    try { out = fn(x.objectStore(FIG_LOJA)); } catch (e) { try { db.close(); } catch (y) {} reject(e); return; }
    x.oncomplete = () => { db.close(); resolve(typeof out === "function" ? out() : out); };
    x.onerror = () => { db.close(); reject(x.error || new Error("erro nas figuras")); };
    x.onabort = () => { db.close(); reject(x.error || new Error("gravação da figura abortada (sem espaço?)")); };
  }));
  _figsLoja = {
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
  return _figsLoja;
}
function figLojaDefinir(l) { _figsLoja = l; }
function figFalha(e) {
  try { reg("ERRO", "figuras: gravação não feita", (e && e.message) || "?"); } catch (x) {}
  if (_figsAvisou) return;
  _figsAvisou = true;
  try { uiAlert(t("fig_sem_espaco")); } catch (x) {}
}
function figNaFila(fn) {
  _figsGravando = (_figsGravando || Promise.resolve()).then(fn).catch(figFalha);
  return _figsGravando;
}
function figCarregar() {
  if (_figsProntoP) return _figsProntoP;
  if (!figSuportado()) { _figsCarregou = true; _figsProntoP = Promise.resolve(0); return _figsProntoP; }
  const ler = () => figLoja().lerTudo().then((lista) => {
    (lista || []).forEach((f) => { if (f && f.id && !_figs.has(f.id)) _figs.set(f.id, f); });
    _figsCarregou = true;
    return _figs.size;
  });
  _figsProntoP = (typeof idbGuardaComecar === "function" ? idbGuardaComecar("figuras", ler, false) : ler().catch(() => 0))
    .then(() => { _figsCarregou = true; return _figs.size; });
  return _figsProntoP;
}
function figPronto() { return _figsProntoP || figCarregar(); }
function figValida(f) { return !!(f && f.id && typeof f.d === "string" && /^data:image\//.test(f.d)); }
function figNovoId() { return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function figGravar(f) {
  if (!figValida(f)) return false;
  _figs.set(f.id, f);
  if (figSuportado()) figNaFila(() => figLoja().por([f]));
  return true;
}
function figApagar(id) {
  if (!_figs.has(id)) return false;
  _figs.delete(id);
  if (figSuportado()) figNaFila(() => figLoja().apagar([id]));
  return true;
}
function figDe(id) { return _figs.get(id) || null; }
function figTotal() { return _figs.size; }
function figBytes() { let n = 0; _figs.forEach((f) => { n += String(f.d || "").length; }); return Math.round(n * 0.75); }

/* ------------------------------ backup ------------------------------ */
function figsParaBackup() {
  if (!_figsCarregou) return null;
  return JSON.stringify([..._figs.values()]);
}
function figsDefinirTudo(lista) {
  const m = new Map();
  (Array.isArray(lista) ? lista : []).forEach((f) => { if (figValida(f)) m.set(f.id, f); });
  _figs = m;
  _figsCarregou = true;
  if (figSuportado()) {
    const tudo = [...m.values()];
    figNaFila(() => figLoja().limpar().then(() => figLoja().por(tudo)));
  }
  return true;
}

/* ------------------------- a figura e a questão ------------------------- */
function figQuestao(qid) { return (typeof qsBanco !== "undefined" ? qsBanco : []).filter((x) => x && x.id === qid)[0] || null; }
function figsDaQuestao(q) { return ((q && q.figs) || []).map(figDe).filter(Boolean); }
/* anexa: { ok, id } ou { ok:false, motivo } */
function figAnexar(qid, fig, gravar) {
  const q = figQuestao(qid);
  if (!q) return { ok: false, motivo: "sem_questao" };
  if ((q.figs || []).length >= FIG_POR_QUESTAO) return { ok: false, motivo: "cheio" };
  const f = Object.assign({ id: figNovoId(), t: new Date().toISOString() }, fig);
  if (!figGravar(f)) return { ok: false, motivo: "invalida" };
  q.figs = (q.figs || []).concat([f.id]);
  q.tocado = new Date().toISOString();
  qsSalvar(gravar);
  try { reg("QUESTOES", "figura anexada à questão", (f.nome || "imagem") + (f.pag ? " · pág. " + f.pag : "") + " · " + f.w + "×" + f.h + " · " + Math.round(String(f.d).length * 0.75 / 1024) + " KB"); } catch (e) {}
  return { ok: true, id: f.id };
}
function figDesanexar(qid, id, gravar) {
  const q = figQuestao(qid);
  if (!q || (q.figs || []).indexOf(id) < 0) return false;
  q.figs = q.figs.filter((x) => x !== id);
  if (!q.figs.length) delete q.figs;
  q.tocado = new Date().toISOString();
  qsSalvar(gravar);
  /* a mesma figura pode estar em outra questão (cópia): só sai da gaveta se ninguém mais usa */
  const usada = (typeof qsBanco !== "undefined" ? qsBanco : []).some((x) => x && (x.figs || []).indexOf(id) >= 0);
  if (!usada) figApagar(id);
  try { reg("QUESTOES", "figura tirada da questão", id); } catch (e) {}
  return true;
}

/* --------------------------- as contas do recorte --------------------------- */
/* o retângulo arrastado na tela (em px de tela, relativo ao palco) → em px da imagem. Sem seleção, a imagem toda. */
function figRecortePx(sel, palco, img) {
  const W = img.w, H = img.h;
  if (!sel || !palco || !palco.w || !palco.h || sel.w < 8 || sel.h < 8) return { x: 0, y: 0, w: W, h: H };
  const fx = W / palco.w, fy = H / palco.h;
  const x = Math.max(0, Math.min(W - 1, Math.round(sel.x * fx))), y = Math.max(0, Math.min(H - 1, Math.round(sel.y * fy)));
  return { x, y, w: Math.max(1, Math.min(W - x, Math.round(sel.w * fx))), h: Math.max(1, Math.min(H - y, Math.round(sel.h * fy))) };
}
/* o tamanho final: nunca mais larga que FIG_LARGURA_MAX, sem ampliar o que é pequeno */
function figTamanhoFinal(w, h) {
  const k = Math.min(1, FIG_LARGURA_MAX / Math.max(1, w));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
/* do palco (um canvas) para a figura pronta: recorta, reduz, põe fundo branco e comprime */
function figDoCanvas(canvas, rec) {
  const r = rec || { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const tm = figTamanhoFinal(r.w, r.h);
  const c = document.createElement("canvas");
  c.width = tm.w; c.height = tm.h;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, tm.w, tm.h);
  g.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, tm.w, tm.h);
  let d = "";
  try { d = c.toDataURL("image/webp", 0.9); } catch (e) { d = ""; }
  if (!/^data:image\/webp/.test(d)) d = c.toDataURL("image/jpeg", 0.9);
  return { d, w: tm.w, h: tm.h };
}

/* ------------------------------ na questão ------------------------------ */
/* as figuras debaixo do enunciado; um toque amplia (e outro volta) */
function figPintarNaQuestao(q) {
  const L = figsDaQuestao(q);
  if (!L.length) return null;
  const cx = document.createElement("div");
  cx.className = "qs-figs";
  L.forEach((f, k) => {
    const im = document.createElement("img");
    im.className = "qs-fig";
    im.src = f.d;
    im.alt = t("fig_alt", { n: k + 1 });
    im.title = t("fig_ampliar");
    im.loading = "lazy";
    im.onclick = () => { im.className = /qs-fig-grande/.test(im.className) ? "qs-fig" : "qs-fig qs-fig-grande"; };
    cx.append(im);
  });
  return cx;
}
function figBotaoDoMenu(q) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-min";
  const n = ((q && q.figs) || []).length;
  b.textContent = "🖼 " + t(n ? "fig_menu_n" : "fig_menu", { n });
  b.title = t("fig_menu_tip");
  b.onclick = () => { try { if (typeof qsFerFechar === "function") qsFerFechar(); } catch (e) {} figAbrir(q.id); };
  return b;
}

/* ------------------------------ a janela ------------------------------ */
let figAlvo = "";            /* a questão que está recebendo a figura */
let figPdf = null;           /* { doc, nome, paginas, pag } — fica aberto na sessão: a questão seguinte continua na mesma página */
let figPalcoOrigem = null;   /* { nome, pag } do que está no palco */
let figSel = null;           /* a seleção, em px de tela relativos ao palco */

function figMsg(s, erro) { const m = $("figMsg"); if (m) { m.textContent = s || ""; m.hidden = !s; m.className = "prep-msg" + (erro ? " prep-msg-erro" : ""); } }
function figPintarLista() {
  const cx = $("figLista");
  if (!cx) return;
  cx.textContent = "";
  const q = figQuestao(figAlvo);
  const L = figsDaQuestao(q);
  cx.hidden = !L.length;
  L.forEach((f) => {
    const it = document.createElement("div");
    it.className = "fig-item";
    const im = document.createElement("img");
    im.className = "fig-mini"; im.src = f.d; im.alt = "";
    const inf = document.createElement("span");
    inf.className = "fig-item-inf";
    inf.textContent = (f.nome || t("fig_colada")) + (f.pag ? " · pág. " + f.pag : "") + " · " + f.w + "×" + f.h;
    const bx = document.createElement("button");
    bx.type = "button"; bx.className = "btn-min btn-min-perigo"; bx.textContent = t("fig_tirar");
    bx.onclick = () => { figDesanexar(figAlvo, f.id); figPintarLista(); figRepintarQuestao(); };
    it.append(im, inf, bx);
    cx.append(it);
  });
}
function figRepintarQuestao() { try { if (typeof qsUiPintarSessao === "function" && typeof qsSessao !== "undefined" && qsSessao) qsUiPintarSessao(); } catch (e) {} }
function figSelPintar() {
  const s = $("figSel");
  if (!s) return;
  s.hidden = !figSel;
  if (!figSel) return;
  s.style.left = figSel.x + "px"; s.style.top = figSel.y + "px"; s.style.width = figSel.w + "px"; s.style.height = figSel.h + "px";
}
function figPalcoMostrar(tem) {
  if ($("figPalcoCx")) $("figPalcoCx").hidden = !tem;
  if ($("btnFigAnexar")) $("btnFigAnexar").disabled = !tem;
  if ($("figPdfNav")) $("figPdfNav").hidden = !(tem && figPdf && figPalcoOrigem && figPalcoOrigem.pag);
  figSel = null;
  figSelPintar();
}
/* uma imagem (colada ou escolhida) vai para o palco */
function figImagemNoPalco(blob, nome) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => {
      const c = $("figPalco");
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext("2d").drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
      figPalcoOrigem = { nome: nome || "", pag: 0 };
      figPalcoMostrar(true);
      figMsg(t("fig_pronta_recortar"));
      resolve(true);
    };
    im.onerror = () => { URL.revokeObjectURL(url); figMsg(t("fig_imagem_invalida"), true); resolve(false); };
    im.src = url;
  });
}
async function figPdfPagina(n) {
  if (!figPdf) return false;
  const p = Math.max(1, Math.min(figPdf.paginas, Number(n) || 1));
  figPdf.pag = p;
  figMsg(t("fig_desenhando", { p, n: figPdf.paginas }));
  try {
    const pg = await figPdf.doc.getPage(p);
    const vp = pg.getViewport({ scale: 1.8 });
    /* DESENHA NUM CANVAS À PARTE, NO MODO "print", e só depois copia para o palco:
     *  · no modo de tela o PDF.js espera o próximo quadro da janela — com a janela em segundo plano (ou a aba sem
     *    foco) o desenho nunca terminava, e a página ficava em "Desenhando…" para sempre;
     *  · dois desenhos no MESMO canvas (trocar de página antes de a anterior acabar) são recusados pelo PDF.js. */
    const tmp = document.createElement("canvas");
    tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
    const g0 = tmp.getContext("2d");
    g0.fillStyle = "#fff";
    g0.fillRect(0, 0, tmp.width, tmp.height);
    await pg.render({ canvasContext: g0, viewport: vp, intent: "print" }).promise;
    if (figPdf.pag !== p) return false;      /* a pessoa já pediu outra página */
    const c = $("figPalco");
    c.width = tmp.width; c.height = tmp.height;
    c.getContext("2d").drawImage(tmp, 0, 0);
  } catch (e) { figMsg(t("fig_pdf_erro", { e: (e && e.message) || "?" }), true); return false; }
  figPalcoOrigem = { nome: figPdf.nome, pag: p };
  figPalcoMostrar(true);
  if ($("figPdfPag")) $("figPdfPag").value = String(p);
  if ($("figPdfDe")) $("figPdfDe").textContent = t("fig_pdf_de", { n: figPdf.paginas });
  figMsg(t("fig_pronta_recortar"));
  return true;
}
async function figAbrirPdf(arquivo) {
  if (!arquivo) return false;
  figMsg(t("fig_abrindo_pdf"));
  try {
    const lib = await leiPdfCarregarLib();
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tarefa = lib.getDocument({ data: bytes });
    const doc = await (tarefa.promise || tarefa);
    figPdf = { doc, nome: arquivo.name || "PDF", paginas: doc.numPages, pag: 1 };
  } catch (e) { figPdf = null; figMsg(t("fig_pdf_erro", { e: (e && e.message) || "?" }), true); return false; }
  return figPdfPagina(1);
}
function figAnexarDoPalco() {
  const c = $("figPalco");
  if (!c || !c.width || !figAlvo) return null;
  const r = c.getBoundingClientRect();
  const rec = figRecortePx(figSel, { w: r.width, h: r.height }, { w: c.width, h: c.height });
  let fig;
  try { fig = figDoCanvas(c, rec); } catch (e) { figMsg(t("fig_imagem_invalida"), true); return null; }
  const res = figAnexar(figAlvo, Object.assign(fig, { nome: (figPalcoOrigem && figPalcoOrigem.nome) || "", pag: (figPalcoOrigem && figPalcoOrigem.pag) || 0 }));
  if (!res.ok) { figMsg(t(res.motivo === "cheio" ? "fig_cheio" : "fig_imagem_invalida", { n: FIG_POR_QUESTAO }), true); return res; }
  figMsg(t("fig_anexada", { k: Math.round(String(fig.d).length * 0.75 / 1024) }));
  figSel = null; figSelPintar();
  figPintarLista();
  figRepintarQuestao();
  return res;
}
function figAbrir(qid) {
  if (!$("dlgFigura") || !figQuestao(qid)) return false;
  figAlvo = qid;
  figMsg("");
  figPintarLista();
  /* o PDF da questão anterior continua aberto, na página em que ficou */
  if (figPdf) figPdfPagina(figPdf.pag); else figPalcoMostrar(false);
  abrirModal("dlgFigura");
  return true;
}
function figIniciarTela() {
  if (typeof document === "undefined" || !$("dlgFigura")) return;
  const liga = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  liga("btnFigFechar", () => $("dlgFigura").close());
  liga("btnFigX", () => $("dlgFigura").close());
  liga("btnFigImagem", () => $("figArqImagem").click());
  liga("btnFigPdf", () => $("figArqPdf").click());
  liga("btnFigAnexar", () => figAnexarDoPalco());
  liga("btnFigAntes", () => figPdf && figPdfPagina(figPdf.pag - 1));
  liga("btnFigDepois", () => figPdf && figPdfPagina(figPdf.pag + 1));
  liga("btnFigTudo", () => { figSel = null; figSelPintar(); });
  if ($("figPdfPag")) $("figPdfPag").onchange = () => figPdfPagina($("figPdfPag").value);
  if ($("figArqImagem")) $("figArqImagem").onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) figImagemNoPalco(f, f.name); };
  if ($("figArqPdf")) $("figArqPdf").onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) figAbrirPdf(f); };
  /* colar: só com a janela aberta */
  document.addEventListener("paste", (ev) => {
    if (!$("dlgFigura").open) return;
    const itens = (ev.clipboardData && ev.clipboardData.items) || [];
    for (let i = 0; i < itens.length; i++) {
      if (itens[i].kind === "file" && /^image\//.test(itens[i].type)) {
        const b = itens[i].getAsFile();
        if (b) { ev.preventDefault(); figImagemNoPalco(b, ""); return; }
      }
    }
  });
  /* arrastar no palco = escolher o recorte */
  const palco = $("figPalcoArea");
  if (palco && palco.addEventListener) {
    let ini = null;
    const pos = (ev) => { const r = $("figPalco").getBoundingClientRect(); return { x: Math.max(0, Math.min(r.width, ev.clientX - r.left)), y: Math.max(0, Math.min(r.height, ev.clientY - r.top)) }; };
    palco.addEventListener("pointerdown", (ev) => { ini = pos(ev); figSel = { x: ini.x, y: ini.y, w: 0, h: 0 }; figSelPintar(); try { palco.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault(); });
    palco.addEventListener("pointermove", (ev) => {
      if (!ini) return;
      const p = pos(ev);
      figSel = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.abs(p.x - ini.x), h: Math.abs(p.y - ini.y) };
      figSelPintar();
    });
    const fim = () => { if (!ini) return; ini = null; if (figSel && (figSel.w < 8 || figSel.h < 8)) { figSel = null; figSelPintar(); } };
    palco.addEventListener("pointerup", fim);
    palco.addEventListener("pointercancel", fim);
  }
}
function figIniciar() {
  try { figIniciarTela(); } catch (e) {}
  return figCarregar().catch(() => 0);
}
