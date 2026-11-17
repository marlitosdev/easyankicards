/* =====================================================================
 * (19.162.0) CORREÇÕES SUAS NA REVISÃO DA COLAGEM — "✎ corrigir aqui"
 *
 * Erros de leitura sempre vão aparecer: o link fora do riscado (art. 53 do Estatuto da Cidade), uma linha partida, dois
 * artigos colados. Até agora cada um esperava uma versão nova do leitor. Agora a pessoa corrige NO LUGAR em que vê:
 *  · ✎ em cada linha das janelas do texto: reescreve a linha (Ctrl+Enter grava, Esc cancela);
 *  · selecionar um trecho numa janela mostra, logo abaixo dela, "Riscar · Tirar o risco · Separar aqui · Juntar com a
 *    de cima" — na própria janela, e não flutuando: no celular a barra flutuante briga com o menu nativo da seleção;
 *  · "Ir para uma linha" (número ou texto) abre uma janela em qualquer ponto do texto, mesmo sem sugestão ali.
 *
 * COMO FUNCIONA POR DENTRO (sem destruir nada):
 *  · o texto colado fica guardado como veio (c.textoOrig); as correções são uma LISTA de operações aplicadas em ordem
 *    por cima dele — c.texto é sempre o resultado. Cada operação guarda o que a linha ERA ("de") e o que vira ("para");
 *    ao reaplicar, a linha é achada pelo conteúdo (perto do número), e por isso dá para desfazer qualquer uma, não só a
 *    última. A que não acha mais a sua linha fica marcada "não aplicada" em vez de mexer no lugar errado;
 *  · depois de cada correção a análise inteira se refaz (as sugestões, a numeração, o "como vai ficar") — o riscado
 *    novo vira um card de tachado, o artigo separado aparece na contagem;
 *  · as escolhas que a pessoa já fez continuam: são reconhecidas pelo grupo e pelo texto da linha, não pelo número
 *    (que muda quando uma correção separa uma linha em duas);
 *  · tudo entra no registro e no "copiar relatório desta tela", com o antes e o depois.
 * ===================================================================== */
const LEI_CORR_BUSCA = 300;          /* até quantas linhas para cima/baixo procurar a linha de uma correção */
let leiCorrSeq = 0;

/* ---------------- o núcleo (sem tela) ---------------- */
/* a linha sem as marcas de riscado, com o riscado de cada letra */
function leiCorrLimpo(raw) {
  const s = String(raw == null ? "" : raw);
  let txt = "";
  const flag = [];
  let k = 0;
  const re = /~~([^~\n]+?)~~/g;
  let m;
  while ((m = re.exec(s))) {
    for (let i = k; i < m.index; i++) { txt += s[i]; flag.push(false); }
    for (let i = 0; i < m[1].length; i++) { txt += m[1][i]; flag.push(true); }
    k = m.index + m[0].length;
  }
  for (let i = k; i < s.length; i++) { txt += s[i]; flag.push(false); }
  return { txt, flag };
}
/* de volta para a linha com ~~: trechos riscados vizinhos separados só por espaço viram um só (como na leitura do HTML) */
function leiCorrSerializar(txt, flag) {
  const runs = [];
  let i = 0;
  while (i < txt.length) {
    if (!flag[i] || /\s/.test(txt[i])) { i++; continue; }
    let j = i;
    while (j < txt.length && (flag[j] || /\s/.test(txt[j]))) j++;
    let f = j;
    while (f > i && /\s/.test(txt[f - 1])) f--;
    const ult = runs[runs.length - 1];
    if (ult && /^\s*$/.test(txt.slice(ult[1], i))) ult[1] = f; else runs.push([i, f]);
    i = j;
  }
  let out = "", k = 0;
  runs.forEach(([a, b]) => { out += txt.slice(k, a) + "~~" + txt.slice(a, b) + "~~"; k = b; });
  return out + txt.slice(k);
}
/* risca (sim) ou tira o risco (não) das letras [a, b) do texto limpo */
function leiCorrRiscar(raw, a, b, sim) {
  const L = leiCorrLimpo(raw);
  for (let i = Math.max(0, a); i < Math.min(L.txt.length, b); i++) L.flag[i] = !!sim;
  return leiCorrSerializar(L.txt, L.flag);
}
/* onde está, no texto de agora, a linha que a correção conhecia (pelo conteúdo, a partir do número) */
function leiCorrAchar(L, n, de) {
  const i0 = Math.max(0, Math.min(L.length - 1, n - 1));
  if (L[i0] === de) return i0;
  for (let d = 1; d <= LEI_CORR_BUSCA; d++) {
    if (i0 - d >= 0 && L[i0 - d] === de) return i0 - d;
    if (i0 + d < L.length && L[i0 + d] === de) return i0 + d;
  }
  return -1;
}
/* o texto colado com as correções, em ordem → { texto, falhas: [ids não aplicadas] } */
function leiCorrAplicar(textoOrig, correcoes) {
  let L = String(textoOrig == null ? "" : textoOrig).split("\n");
  const falhas = [];
  (correcoes || []).forEach((op) => {
    const pos = op.alvo.map((a) => leiCorrAchar(L, a.n, a.de));
    if (pos.some((p) => p < 0) || new Set(pos).size !== pos.length) { falhas.push(op.id); return; }
    op.alvo.map((a, k) => ({ a, p: pos[k] })).sort((x, y) => y.p - x.p)
      .forEach(({ a, p }) => { L.splice(p, 1, ...String(a.para).split("\n")); });
  });
  return { texto: L.join("\n"), falhas };
}
function leiCorrNova(tipo, alvo, extra) {
  return Object.assign({ id: "co" + (++leiCorrSeq) + Date.now().toString(36).slice(-4), tipo, alvo, em: new Date().toISOString() }, extra || {});
}
/* as operações, montadas sobre as linhas de AGORA (L) e o número de linha que a pessoa vê (n, a partir de 1) */
function leiCorrOpEditar(L, n, novo) {
  const de = L[n - 1];
  if (de === undefined || String(novo) === de) return null;
  return leiCorrNova("editar", [{ n, de, para: String(novo).replace(/\r\n?/g, "\n") }]);
}
function leiCorrOpRiscar(L, n, a, b, sim) {
  const de = L[n - 1];
  if (de === undefined || !(b > a)) return null;
  const para = leiCorrRiscar(de, a, b, sim);
  return para === de ? null : leiCorrNova(sim ? "riscar" : "tirar_risco", [{ n, de, para }]);
}
function leiCorrOpJuntar(L, n) {
  const de = L[n - 1];
  if (de === undefined || !String(de).trim()) return null;
  let k = n - 2;
  while (k >= 0 && !String(L[k]).trim()) k--;
  if (k < 0) return null;
  const alvo = [{ n: k + 1, de: L[k], para: String(L[k]).replace(/\s+$/, "") + " " + String(de).trim() }, { n, de, para: "" }];
  return leiCorrNova("juntar", alvo);
}
/* separa a linha antes da letra a do texto limpo (o riscado de cada lado continua riscado) */
function leiCorrOpSeparar(L, n, a) {
  const de = L[n - 1];
  if (de === undefined) return null;
  const C = leiCorrLimpo(de);
  const esq = leiCorrSerializar(C.txt.slice(0, a), C.flag.slice(0, a)).replace(/\s+$/, "");
  const dir = leiCorrSerializar(C.txt.slice(a), C.flag.slice(a)).replace(/^\s+/, "");
  if (!esq.trim() || !dir.trim()) return null;
  return leiCorrNova("separar", [{ n, de, para: esq + "\n" + dir }]);
}
/* onde está o trecho selecionado no texto limpo da linha: a ocorrência mais perto de onde a seleção começou na tela */
function leiCorrLocalizar(raw, sel, ini) {
  const txt = leiCorrLimpo(raw).txt;
  const s = String(sel || "").replace(/…/g, "");
  if (!s.trim()) return -1;
  const achados = [];
  let i = txt.indexOf(s);
  while (i >= 0) { achados.push(i); i = txt.indexOf(s, i + 1); }
  if (!achados.length) return -1;
  const alvo = ini >= 0 ? ini : 0;
  return achados.sort((x, y) => Math.abs(x - alvo) - Math.abs(y - alvo))[0];
}
/* uma correção, em frase curta (lista, registro e relatório) */
function leiCorrResumo(op) {
  const limpo = (s) => leiCorrLimpo(s).txt.replace(/\s+/g, " ").trim();
  const corta = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const a = op.alvo[op.alvo.length - 1];
  if (op.tipo === "juntar") return corta(limpo(op.alvo[0].de), 60) + " ⟵ " + corta(limpo(a.de), 60);
  if (op.tipo === "separar") return corta(limpo(a.para).replace(/\n/g, " ⏎ "), 140);
  if (op.tipo === "riscar" || op.tipo === "tirar_risco") return corta(String(a.para).replace(/\s+/g, " "), 140);
  return corta(limpo(a.de), 70) + " → " + corta(limpo(a.para).replace(/\n/g, " ⏎ "), 70);
}

/* ---------------- a revisão com as correções ---------------- */
function leiCorrIniciar(c) {
  if (!c) return c;
  if (c.textoOrig === undefined) c.textoOrig = c.texto;
  if (!c.correcoes) c.correcoes = [];
  return c;
}
/* a assinatura de uma sugestão que não depende do número da linha */
function leiCorrAssinatura(c, m) {
  const L = leiPreLinhasDaColagem(c);
  const n = (m.linhas || [])[0];
  return m.grupo + "|" + (n ? leiPreLinhaLimpa(L[n - 1]).replace(/\s+/g, " ").trim() : m.id) + "|" + ((m.linhas || []).length);
}
/* reaplica as correções sobre o texto colado e refaz a análise, mantendo as escolhas já feitas */
function leiCorrRecalcular(c) {
  leiCorrIniciar(c);
  const antes = {};
  try { (c.pre.mudancas || []).forEach((m) => { if (c.decisoes && c.decisoes[m.id] !== undefined) antes[leiCorrAssinatura(c, m)] = c.decisoes[m.id]; }); } catch (e) {}
  const r = leiCorrAplicar(c.textoOrig, c.correcoes);
  c.texto = r.texto;
  c.corrFalhas = r.falhas;
  c._linhas = null;
  c.pre = leiPreprocessar(c.texto, c.opcPre);
  leiPreSugestoes();
  c.pre.mudancas.forEach((m) => { const k = leiCorrAssinatura(c, m); if (antes[k] !== undefined) c.decisoes[m.id] = antes[k]; });
  return r;
}
function leiCorrAdicionar(op) {
  const c = leiPreCtx;
  if (!c || !op) return false;
  leiCorrIniciar(c);
  c.correcoes.push(op);
  leiCorrRecalcular(c);
  c.corrAberto = true;
  c.corrSel = null;
  /* (19.165.0) os casos parecidos com esta correção, para oferecer de uma vez */
  try { if (!op.lote) leiCorrOferecerParecidos(c, op); } catch (e) { c.corrParecidos = null; }
  try { leiReg(c.modo === "atualizar" ? "atualizacao" : "gravar", "correção à mão: " + op.tipo, "linha " + op.alvo[op.alvo.length - 1].n + " · " + leiCorrResumo(op)); } catch (e) {}
  leiPreAvisar(t("lei_corr_feita", { l: op.alvo[op.alvo.length - 1].n }));
  leiPrePintar();
  return true;
}
function leiCorrDesfazer(id) {
  const c = leiPreCtx;
  if (!c || !c.correcoes) return false;
  const op = c.correcoes.find((x) => x.id === id);
  c.correcoes = id === "*" ? [] : c.correcoes.filter((x) => x.id !== id);
  c.corrParecidos = null;
  leiCorrRecalcular(c);
  try { leiReg(c.modo === "atualizar" ? "atualizacao" : "gravar", id === "*" ? "correções à mão: todas desfeitas" : "correção à mão desfeita", op ? op.tipo + " · " + leiCorrResumo(op) : ""); } catch (e) {}
  leiPreAvisar(t(id === "*" ? "lei_corr_desfeitas" : "lei_corr_desfeita"));
  leiPrePintar();
  return true;
}
/* as ações da seleção: info = { n, txt, ini } (linha que a pessoa vê, o trecho selecionado, onde ele começa na tela) */
function leiCorrSelecaoAgir(acao, info) {
  const c = leiPreCtx;
  if (!c || !info) return false;
  const L = leiPreLinhasDaColagem(c);
  const raw = L[info.n - 1];
  if (acao === "juntar") return leiCorrAdicionar(leiCorrOpJuntar(L, info.n)) || (leiPreAvisar(t("lei_corr_nao_juntar")), false);
  if (acao === "editar") { leiCorrEditarAbrir(info.n, info.onde); return true; }
  const a = leiCorrLocalizar(raw, info.txt, info.ini);
  if (a < 0) { leiPreAvisar(t("lei_corr_nao_achei")); return false; }
  const b = a + String(info.txt).replace(/…/g, "").length;
  let op = null;
  if (acao === "riscar") op = leiCorrOpRiscar(L, info.n, a, b, true);
  else if (acao === "tirar") op = leiCorrOpRiscar(L, info.n, a, b, false);
  else if (acao === "separar") op = leiCorrOpSeparar(L, info.n, a);
  if (!op) { leiPreAvisar(t("lei_corr_nada_" + acao)); return false; }
  return leiCorrAdicionar(op);
}

/* ---------------- a tela ---------------- */
/* ✎ numa linha: a caixa de edição logo abaixo dela (uma por vez) */
function leiCorrEditarAbrir(n, onde) {
  const c = leiPreCtx;
  if (!c) return false;
  c.corrEd = n;
  c.corrEdOnde = onde || "leiCorrJan";
  c.corrAberto = true;
  /* na janela "ir para", a linha tem de estar nela: senão a janela passa a ser em volta dela */
  if (c.corrEdOnde === "leiCorrJan" && !(c.corrVer && c.corrVer.n && Math.abs(c.corrVer.n - n) <= 3)) c.corrVer = { n, q: String(n) };
  leiPrePintar();
  const ta = $("leiCorrEdTa");
  try { if (ta) { ta.focus(); leiPreRolarAte(ta); } } catch (e) {}
  return true;
}
function leiCorrEditorEl(c, n) {
  const L = leiPreLinhasDaColagem(c);
  const raw = L[n - 1];
  const box = leiPreEl("div", "lei-corr-ed");
  box.id = "leiCorrEd";
  box.append(leiPreEl("div", "lei-corr-ed-tit", t("lei_corr_ed_tit", { l: n })));
  const ta = document.createElement("textarea");
  ta.id = "leiCorrEdTa";
  ta.className = "lei-corr-ed-ta";
  ta.rows = Math.min(8, Math.max(2, Math.ceil(String(raw || "").length / 90)));
  ta.value = leiCorrLimpo(raw).txt;
  box.append(ta);
  if (String(raw).indexOf("~~") >= 0) box.append(leiPreEl("p", "nota", t("lei_corr_ed_riscado")));
  box.append(leiPreEl("p", "nota", t("lei_corr_ed_dica")));
  const ac = leiPreEl("div", "lei-corr-ed-ac");
  const gravar = () => {
    const op = leiCorrOpEditar(leiPreLinhasDaColagem(c), n, ta.value);
    c.corrEd = null;
    if (!op) { leiPrePintar(); return false; }
    return leiCorrAdicionar(op);
  };
  const g = leiPreEl("button", "btn-min btn-min-ok", t("lei_corr_ed_gravar"));
  g.type = "button"; g.id = "btnLeiCorrGravar"; g.onclick = gravar;
  const j = leiPreEl("button", "btn-min", t("lei_corr_juntar"));
  j.type = "button"; j.id = "btnLeiCorrEdJuntar"; j.title = t("lei_corr_juntar_tip");
  j.onclick = () => { c.corrEd = null; leiCorrSelecaoAgir("juntar", { n }); };
  const x = leiPreEl("button", "btn-min", t("lei_corr_ed_cancelar"));
  x.type = "button"; x.id = "btnLeiCorrCancelar";
  x.onclick = () => { c.corrEd = null; leiPrePintar(); };
  ta.onkeydown = (ev) => {
    if (ev && ev.key === "Escape") { if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); x.onclick(); }
    else if (ev && ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { if (ev.preventDefault) ev.preventDefault(); gravar(); }
  };
  ac.append(g, j, x);
  box.append(ac);
  return box;
}
/* nas janelas do texto: o ✎ de cada linha e a caixa de edição aberta (chamado por leiPreJanelaEl) */
function leiCorrLinhaEl(c, l, n, corpo, onde) {
  l._n = n;
  const b = leiPreEl("button", "lei-corr-ed-bt", "✎");
  b.type = "button";
  b.title = t("lei_corr_ed_bt_tip", { l: n });
  b.setAttribute("aria-label", t("lei_corr_ed_bt_tip", { l: n }));
  b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); leiCorrEditarAbrir(n, onde); };
  l.append(b);
  corpo.append(l);
  if (c.corrEd === n && c.corrEdOnde === onde) corpo.append(leiCorrEditorEl(c, n));
}
/* a barra da seleção, abaixo da janela onde está o trecho selecionado */
function leiCorrBarraSelEl(c, box) {
  const bar = leiPreEl("div", "lei-corr-sel");
  bar.hidden = true;
  box.append(bar);
  box._corrBarra = bar;
  return bar;
}
function leiCorrBarraMostrar(bar, info) {
  bar.innerHTML = "";
  if (!info) { bar.hidden = true; return; }
  const prev = String(info.txt).replace(/\s+/g, " ").trim();
  bar.append(leiPreEl("span", "lei-corr-sel-t", t("lei_corr_sel", { l: info.n, s: prev.length > 50 ? prev.slice(0, 49) + "…" : prev })));
  [["riscar", "lei_corr_riscar"], ["tirar", "lei_corr_tirar"], ["separar", "lei_corr_separar"], ["juntar", "lei_corr_juntar"], ["editar", "lei_corr_editar"]].forEach(([a, k]) => {
    const b = leiPreEl("button", "btn-min", t(k));
    b.type = "button";
    b.id = "btnLeiCorrSel_" + a;
    b.title = t(k + "_tip");
    /* o toque no botão desfaz a seleção no celular: a informação já está guardada */
    b.onmousedown = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); };
    b.onclick = () => leiCorrSelecaoAgir(a, info);
    bar.append(b);
  });
  const x = leiPreEl("button", "btn-min lei-corr-sel-x", "✕");
  x.type = "button"; x.id = "btnLeiCorrSelX"; x.title = t("lei_corr_sel_fechar");
  x.onclick = () => { bar.hidden = true; bar.innerHTML = ""; if (leiPreCtx) leiPreCtx.corrSel = null; };
  bar.append(x);
  bar.hidden = false;
}
/* a posição (no texto da tela) onde a seleção começa dentro da linha, sem o número nem o ✎ */
function leiCorrOffsetNaLinha(lin, no, off) {
  let tot = 0, achou = false;
  const andar = (x) => {
    if (achou) return;
    if (x === no) {
      if (x.nodeType === 3) tot += off;
      else Array.from(x.childNodes || []).slice(0, off).forEach((y) => { tot += String(y.textContent || "").length; });
      achou = true;
      return;
    }
    if (x.nodeType === 3) { tot += String(x.textContent || "").length; return; }
    if (x.classList && (x.classList.contains("lei-pre-jan-n") || x.classList.contains("lei-corr-ed-bt"))) return;
    Array.from(x.childNodes || []).forEach(andar);
  };
  andar(lin);
  return achou ? tot : -1;
}
function leiCorrLinhaDe(no) {
  for (let x = no; x; x = x.parentNode) if (x._n) return x;
  return null;
}
/* a seleção mudou: mostra a barra na janela certa (e esconde nas outras) */
function leiCorrSelecaoMudou() {
  const c = leiPreCtx;
  const dlg = typeof $ === "function" ? $("dlgLeiPre") : null;
  if (!c || !dlg || !dlg.open || typeof window === "undefined" || !window.getSelection) return;
  const sel = window.getSelection();
  let info = null, box = null;
  if (sel && !sel.isCollapsed && sel.rangeCount) {
    const l1 = leiCorrLinhaDe(sel.anchorNode), l2 = leiCorrLinhaDe(sel.focusNode);
    const txt = String(sel.toString() || "");
    if (l1 && l1 === l2 && txt.trim() && txt.indexOf("\n") < 0) {
      const r = sel.getRangeAt(0);
      const ini = leiCorrOffsetNaLinha(l1, r.startContainer, r.startOffset);
      for (let x = l1; x; x = x.parentNode) if (x._corrBarra) { box = x; break; }
      info = { n: l1._n, txt, ini, onde: box ? box.id : "" };
    }
  }
  /* A BARRA FICA quando a seleção some: no celular (e às vezes no computador) tocar no botão desfaz a seleção ANTES do
   * clique — se a barra sumisse junto, o toque caía no vazio. Ela só troca com uma seleção nova e fecha no ✕ ou na ação. */
  if (!box || !info) return;
  dlg.querySelectorAll(".lei-corr-sel").forEach((b) => { if (b !== box._corrBarra) { b.hidden = true; b.innerHTML = ""; } });
  c.corrSel = info;
  leiCorrBarraMostrar(box._corrBarra, info);
}
if (typeof document !== "undefined" && document.addEventListener) {
  try { document.addEventListener("selectionchange", () => { try { leiCorrSelecaoMudou(); } catch (e) {} }); } catch (e) {}
}
/* uma janela do texto em qualquer linha (o "ir para uma linha"): ±3 linhas com texto */
function leiCorrJanelaLivreEl(c, n) {
  const L = leiPreLinhasDaColagem(c);
  const box = leiPreEl("div", "lei-pre-jan lei-corr-jan");
  box.id = "leiCorrJan";
  const corpo = leiPreEl("div", "lei-pre-jan-txt");
  const nums = leiPreVizinhas(L, n, -1, 3).concat(String(L[n - 1] || "").trim() ? [n] : []).concat(leiPreVizinhas(L, n, 1, 3));
  nums.forEach((k) => {
    const l = leiPreEl("span", "lei-pre-jan-l" + (k === n ? " alvo" : ""));
    l.append(leiPreEl("span", "lei-pre-jan-n", String(k)));
    leiPrePartesRiscado(L[k - 1]).forEach((p) => { if (!p.t) return; if (!p.k) l.append(document.createTextNode(p.t)); else l.append(leiPreEl("span", "lei-pre-" + p.k, p.t)); });
    leiCorrLinhaEl(c, l, k, corpo, box.id);
  });
  box.append(corpo);
  leiCorrBarraSelEl(c, box);
  return box;
}
/* "ir para": número da linha, ou um pedaço do texto (a próxima ocorrência depois da última vista) */
function leiCorrIrPara(q) {
  const c = leiPreCtx;
  if (!c) return 0;
  const L = leiPreLinhasDaColagem(c);
  const s = String(q || "").trim();
  if (!s) return 0;
  let n = 0;
  if (/^\d+$/.test(s)) n = Math.max(1, Math.min(L.length, Number(s)));
  else {
    const low = s.toLowerCase();
    const de = c.corrVer && c.corrVer.q === s ? c.corrVer.n : 0;
    const achar = (ini) => { for (let i = ini; i < L.length; i++) if (leiCorrLimpo(L[i]).txt.toLowerCase().indexOf(low) >= 0) return i + 1; return 0; };
    n = achar(de) || achar(0);
  }
  c.corrVer = { n, q: s };
  c.corrAberto = true;
  if (!n) leiPreAvisar(t("lei_corr_ir_nada", { q: s }));
  leiPrePintar();
  return n;
}
/* o painel "✎ Corrigir o texto à mão" (no alto da lista) */
function leiCorrPainelEl(c) {
  leiCorrIniciar(c);
  const det = document.createElement("details");
  det.className = "lei-corr";
  det.id = "leiCorr";
  det.open = !!c.corrAberto || c.correcoes.length > 0;
  det.ontoggle = () => { c.corrAberto = det.open; };
  const sm = document.createElement("summary");
  sm.textContent = t("lei_corr_tit") + (c.correcoes.length ? " · " + t("lei_corr_n", { n: c.correcoes.length }) : "");
  det.append(sm);
  det.append(leiPreEl("p", "nota", t("lei_corr_como")));
  const ir = leiPreEl("div", "lei-corr-ir");
  const inp = document.createElement("input");
  inp.type = "search";
  inp.id = "leiCorrIrQ";
  inp.className = "lei-corr-ir-q";
  inp.placeholder = t("lei_corr_ir_ph");
  inp.value = (c.corrVer && c.corrVer.q) || "";
  const bi = leiPreEl("button", "btn-min", t("lei_corr_ir"));
  bi.type = "button"; bi.id = "btnLeiCorrIr";
  bi.onclick = () => leiCorrIrPara(inp.value);
  inp.onkeydown = (ev) => { if (ev && ev.key === "Enter") { if (ev.preventDefault) ev.preventDefault(); bi.onclick(); } };
  ir.append(inp, bi);
  det.append(ir);
  /* (19.165.0) os parecidos com a última correção */
  const par = leiCorrParecidosEl(c);
  if (par) { det.append(par); det.open = true; }
  if (c.corrVer && c.corrVer.n) det.append(leiCorrJanelaLivreEl(c, c.corrVer.n));
  /* a lista das correções, a mais nova primeiro */
  if (c.correcoes.length) {
    const ul = leiPreEl("div", "lei-corr-lista");
    c.correcoes.slice().reverse().forEach((op) => {
      const falhou = (c.corrFalhas || []).indexOf(op.id) >= 0;
      const lin = leiPreEl("div", "lei-corr-item" + (falhou ? " falhou" : ""));
      lin.id = "leiCorrIt_" + op.id;
      lin.append(leiPreEl("span", "lei-corr-tipo", t("lei_corr_tipo_" + op.tipo) + " · " + (op.lote ? t("lei_corr_lote", { n: op.alvo.filter((a) => a.para !== "").length || op.alvo.length }) : t("lei_corr_linha", { l: op.alvo[op.alvo.length - 1].n }))));
      /* riscar / tirar o risco: a linha como fica, com o riscado pintado (e não as marcas ~~) */
      if (op.tipo === "riscar" || op.tipo === "tirar_risco") lin.append(leiCorrPartesEl(op.alvo[op.alvo.length - 1].para));
      else lin.append(leiPreEl("span", "lei-corr-res", leiCorrResumo(op)));
      if (falhou) lin.append(leiPreEl("span", "lei-corr-falhou", t("lei_corr_falhou")));
      const d = leiPreEl("button", "btn-min", t("lei_corr_desfazer"));
      d.type = "button"; d.id = "btnLeiCorrDesf_" + op.id;
      d.onclick = () => leiCorrDesfazer(op.id);
      lin.append(d);
      ul.append(lin);
    });
    det.append(ul);
    const rod = leiPreEl("div", "lei-corr-ed-ac");
    if (c.correcoes.length > 1) {
      const da = leiPreEl("button", "btn-min", t("lei_corr_desfazer_todas"));
      da.type = "button"; da.id = "btnLeiCorrDesfTodas";
      da.onclick = () => leiCorrDesfazer("*");
      rod.append(da);
    }
    /* (19.165.0) o caso de teste: o antes, o depois e o trecho do HTML de origem, para relatar */
    const cs = leiPreEl("button", "btn-min", t("lei_corr_caso_bt"));
    cs.type = "button"; cs.id = "btnLeiCorrCaso"; cs.title = t("lei_corr_caso_tip");
    cs.onclick = () => leiCorrCopiarCaso();
    rod.append(cs);
    det.append(rod);
  }
  return det;
}
/* para o relatório e o registro */
function leiCorrRelatorio(c) {
  if (!c || !(c.correcoes || []).length) return ["  correções à mão: nenhuma"];
  return ["  correções à mão: " + c.correcoes.length + ((c.corrFalhas || []).length ? " (" + c.corrFalhas.length + " não aplicada(s))" : "")]
    .concat(...c.correcoes.map((op) => {
      const lin = ["      " + op.tipo + (op.lote ? " (lote de " + op.alvo.length + ")" : "") + " · linha " + op.alvo[op.alvo.length - 1].n + " · " + leiCorrResumo(op)
        + ((c.corrFalhas || []).indexOf(op.id) >= 0 ? " · NÃO APLICADA" : "")];
      /* (19.165.0) o trecho do HTML de origem, quando houver: é o que vira teste do leitor */
      const tr = typeof leiHtmlUltimo !== "undefined" && leiHtmlUltimo ? leiCorrTrechoHtml(leiHtmlUltimo, op.alvo[0].de) : "";
      if (tr) lin.push("        html: " + tr.slice(0, 600));
      return lin;
    }));
}

/* =====================================================================
 * (19.162.0) AS CORREÇÕES FICAM NA LEI — e o "Mapa e conferência" mostra as decisões tomadas
 *
 * A revisão da colagem termina antes de a lei ser gravada (e, na atualização, antes da comparação). As correções da
 * revisão confirmada ficam PENDENTES e entram na lei quando ela é gravada (l.correcoes: tipo, linha, antes e depois,
 * fase e data). Também vão para o histórico de decisões (decisoes.js), como as outras escolhas da colagem.
 *
 * No mapa, um grupo recolhido "Decisões tomadas": as suas correções (com "ver no texto") e o que a limpeza do texto
 * colado fez, por tipo — aceitas e recusadas, com as recusadas à vista (é onde a pessoa discordou do app).
 * ===================================================================== */
let leiCorrPendente = null;      /* { lista, modo, idLei, em } — da revisão confirmada até a lei ser gravada */
const LEI_CORR_PEND_MS = 30 * 60 * 1000;
function leiCorrCompactas(c) {
  const em = new Date().toISOString();
  return ((c && c.correcoes) || []).filter((op) => (c.corrFalhas || []).indexOf(op.id) < 0).map((op) => {
    const ult = op.alvo[op.alvo.length - 1];
    const antes = op.tipo === "juntar" ? op.alvo.map((a) => a.de).join("\n") : ult.de;
    const depois = op.tipo === "juntar" ? op.alvo[0].para : ult.para;
    return { tipo: op.tipo, linha: ult.n, antes: String(antes).slice(0, 1500), depois: String(depois).slice(0, 1500), em };
  });
}
/* a revisão foi confirmada: as correções esperam a lei ser gravada (e vão já para o histórico de decisões) */
function leiCorrConfirmadas(c) {
  const lista = leiCorrCompactas(c);
  leiCorrPendente = lista.length ? { lista, modo: c.modo, idLei: (typeof leiIdAtual !== "undefined" && leiIdAtual) || "", em: Date.now() } : null;
  if (lista.length && typeof decRegistrarLote === "function") {
    try {
      const nome = (typeof leiDecNomeAtual === "function" && leiDecNomeAtual()) || t("dec_lei_nova");
      decRegistrarLote(lista.map((x) => ({ area: "colagem", regra: "colagem.correcao", origem: "voce", lei: nome,
        ref: t("dec_linha", { l: x.linha }), motivo: t("lei_corr_tipo_" + x.tipo), risco: "baixo", decisao: "mudou", via: "manual",
        proposta: { acao: x.tipo, amostra: leiCorrLimpo(x.antes).txt, depois: leiCorrLimpo(x.depois).txt, n: 1, linhas: [] } })));
    } catch (e) {}
  }
  return lista;
}
function leiCorrGravarNaLei(idLei, lista, fase) {
  const l = typeof leiDe === "function" ? leiDe(idLei) : null;
  if (!l || !(lista || []).length) return 0;
  const nova = (l.correcoes || []).concat(lista.map((x) => Object.assign({ fase }, x))).slice(-200);
  leiGuardar({ id: idLei, correcoes: nova });
  try { leiReg(fase === "atualizar" ? "atualizacao" : "gravar", "correções à mão guardadas na lei", l.nome + " · " + lista.length); } catch (e) {}
  return lista.length;
}
/* chamada depois que a lei é gravada: na inclusão (leiGravar) ou na atualização (leiAtualizarAplicar) */
function leiCorrGravarPendentes(idLei, modo) {
  const p = leiCorrPendente;
  if (!p || p.modo !== modo || Date.now() - p.em > LEI_CORR_PEND_MS) return 0;
  if (modo === "atualizar" && p.idLei && p.idLei !== idLei) return 0;
  leiCorrPendente = null;
  return leiCorrGravarNaLei(idLei, p.lista, modo);
}

/* onde a correção está na lei de agora: o artigo da linha que tem o texto corrigido */
function leiCorrArtigoNaLei(l, x, arts) {
  if (x.num) {
    const idx = (arts || []).findIndex((y) => y.num === x.num);
    return { num: x.num, numCru: String(x.rotulo || x.num).replace(/^Art(?:igo)?\.?\s*/i, "").replace(/\.$/, ""), indice: idx >= 0 ? idx : undefined };
  }
  const chave = leiTirarTachado(String(x.depois || ""), true).split("\n").map((s) => s.trim()).filter((s) => s.length >= 8)[0];
  if (!chave) return null;
  const L = String(l.texto || "").split("\n");
  const alvo = chave.slice(0, 60);
  const i = L.findIndex((s) => s.indexOf(alvo) >= 0);
  if (i < 0) return null;
  for (let k = i; k >= 0; k--) {
    const a = leiCasarArtigo(String(L[k]).replace(/^\s+/, ""));
    if (!a) continue;
    const num = leiNumNormal(a[1]);
    const idx = (arts || []).findIndex((y) => y.num === num);
    return { num, numCru: a[1], indice: idx >= 0 ? idx : undefined };
  }
  return null;
}
function leiCorrPartesEl(raw) {
  const s = leiPreEl("span", "lei-corr-res");
  leiPrePartesRiscado(String(raw || "").replace(/\n/g, " ⏎ ")).forEach((p) => {
    if (!p.t) return;
    if (!p.k) s.append(document.createTextNode(p.t)); else s.append(leiPreEl("span", "lei-pre-" + p.k, p.t));
  });
  return s;
}
/* o grupo "Decisões tomadas" do mapa (null quando não há nenhuma) */
function leiCorrMapaEl(l, arts) {
  const corr = (l && l.correcoes) || [];
  const decs = (typeof decLer === "function" ? decLer() : []).filter((d) => d.area === "colagem" && d.lei === l.nome && d.regra !== "colagem.correcao");
  if (!corr.length && !decs.length) return null;
  const det = document.createElement("details");
  det.className = "lei-mapa-dec";
  det.id = "leiMapaDec";
  const rec = decs.filter((d) => d.decisao === "recusou" || d.decisao === "mudou");
  const sm = document.createElement("summary");
  sm.textContent = t("lei_mapa_dec_tit") + " · " + [corr.length ? t("lei_mapa_dec_n_corr", { n: corr.length }) : "",
    decs.length ? t("lei_mapa_dec_n_limpeza", { n: decs.length, r: rec.length }) : ""].filter(Boolean).join(" · ");
  det.append(sm);
  det.append(leiPreEl("p", "nota", t("lei_mapa_dec_expl")));
  if (corr.length) {
    det.append(leiPreEl("div", "lei-mapa-dec-sub", t("lei_mapa_dec_corr_tit", { n: corr.length })));
    corr.slice().reverse().forEach((x, k) => {
      const lin = leiPreEl("div", "lei-corr-item");
      lin.id = "leiMapaCorr_" + k;
      const dt = String(x.em || "").slice(0, 10).split("-").reverse().join("/");
      lin.append(leiPreEl("span", "lei-corr-tipo", t("lei_corr_tipo_" + x.tipo) + (x.rotulo ? " " + x.rotulo : "") + (x.lote ? " · " + t("lei_mapa_dec_lote") : "") + " · "
        + t(x.fase === "leitor" ? "lei_mapa_dec_fase_leitor" : x.fase === "atualizar" ? "lei_mapa_dec_fase_upd" : "lei_mapa_dec_fase_criar", { d: dt })));
      /* o estado de uma correção do leitor: desfeita, ficou para trás numa versão nova ou reaplicada */
      if (x.desfeita) lin.append(leiPreEl("span", "lei-corr-st", t("lei_mapa_dec_st_desfeita")));
      else if (x.atras) lin.append(leiPreEl("span", "lei-corr-st", t("lei_mapa_dec_st_atras")));
      else if (x.reaplicada) lin.append(leiPreEl("span", "lei-corr-st ok", t("lei_mapa_dec_st_reaplicada", { n: x.reaplicada })));
      const bloco = leiPreEl("span", "lei-mapa-dec-ad");
      if (x.fase === "leitor") {
        /* o artigo inteiro é longo: só o pedaço que mudou, com um pouco de contexto */
        const d = leiPreDiff(x.antes, x.depois);
        const ctxA = d.pre.length > 70 ? "…" + d.pre.slice(-70) : d.pre, ctxD = d.suf.length > 70 ? d.suf.slice(0, 70) + "…" : d.suf;
        const parte = (meio, k) => { const s = leiPreEl("span", "lei-corr-res"); s.append(document.createTextNode(ctxA)); if (meio) s.append(leiPreEl("span", "lei-pre-" + k, meio)); s.append(document.createTextNode(ctxD)); return s; };
        bloco.append(leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_antes")), parte(d.a, "sai"),
          leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_depois")), parte(d.b, "entra"));
      } else {
        bloco.append(leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_antes")), leiCorrPartesEl(x.antes),
          leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_depois")), leiCorrPartesEl(x.depois));
      }
      lin.append(bloco);
      if (x.fase === "leitor" && !x.desfeita && !x.atras) {
        const u = leiPreEl("button", "btn-min", t("lei_corr_desfazer"));
        u.type = "button"; u.id = "btnLeiMapaCorrDesf_" + k;
        u.onclick = () => {
          const r = leiCorrArtigoDesfazer(l.id, x.id);
          if (r.erro) { uiAlert(r.erro); return; }
          try { toastMsg(t("lei_corr_art_desfeita", { a: x.rotulo }), 4000); } catch (e) {}
          if (typeof leiPintar === "function") leiPintar();
          leiMapaAbrir(true);
          const dd = $("leiMapaDec"); if (dd) dd.open = true;
        };
        lin.append(u);
      }
      const onde = leiCorrArtigoNaLei(l, x, arts);
      if (onde) {
        const b = leiPreEl("button", "btn-min", t("lei_mapa_dec_ver", { a: onde.numCru }));
        b.type = "button"; b.id = "btnLeiMapaCorrVer_" + k;
        b.onclick = () => leiMapaIr(onde.num, onde.indice);
        lin.append(b);
      } else lin.append(leiPreEl("span", "nota", t("lei_mapa_dec_sem_art")));
      det.append(lin);
    });
  }
  if (decs.length) {
    det.append(leiPreEl("div", "lei-mapa-dec-sub", t("lei_mapa_dec_limpeza_tit")));
    const porRegra = {};
    decs.forEach((d) => {
      const g = porRegra[d.regra] = porRegra[d.regra] || { ace: 0, rec: 0, itens: [] };
      if (d.decisao === "aceitou") g.ace++; else { g.rec++; g.itens.push(d); }
    });
    Object.keys(porRegra).forEach((rg) => {
      const g = porRegra[rg];
      const grupo = rg.replace(/^colagem\./, "");
      const nomeG = t("lei_pre_g_" + grupo);
      const lin = leiPreEl("div", "lei-corr-item");
      lin.append(leiPreEl("span", "lei-corr-tipo", nomeG === "lei_pre_g_" + grupo ? grupo : nomeG));
      lin.append(leiPreEl("span", "lei-corr-res", t("lei_mapa_dec_contas", { a: g.ace, r: g.rec })));
      det.append(lin);
      g.itens.slice(0, 8).forEach((d) => {
        const r = leiPreEl("div", "lei-mapa-dec-rec");
        r.textContent = "✗ " + [d.ref, String((d.proposta && d.proposta.amostra) || "").replace(/\s+/g, " ").slice(0, 140)].filter(Boolean).join(" · ");
        det.append(r);
      });
      if (g.itens.length > 8) det.append(leiPreEl("p", "nota", t("lei_mapa_dec_mais", { n: g.itens.length - 8 })));
    });
    if (typeof decAbrir === "function") {
      const b = leiPreEl("button", "btn-min", t("lei_mapa_dec_hist"));
      b.type = "button"; b.id = "btnLeiMapaDecHist";
      b.onclick = () => decAbrir();
      det.append(b);
    }
  }
  return det;
}
/* para o relatório do mapa */
function leiCorrMapaTexto(l) {
  const corr = (l && l.correcoes) || [];
  if (!corr.length) return [];
  return ["Correções à mão guardadas na lei: " + corr.length].concat(corr.slice(-20).map((x) => "  " + x.tipo + " · " + (x.fase || "") + " · linha " + x.linha + " · "
    + leiCorrLimpo(x.antes).txt.replace(/\s+/g, " ").slice(0, 80) + " → " + leiCorrLimpo(x.depois).txt.replace(/\s+/g, " ").slice(0, 80)));
}

/* (19.162.0) A LEI NOVA SÓ GANHA NOME AO SER GRAVADA: as decisões da colagem dela ficavam como "(lei nova)" e o mapa
 * nunca as achava. Ao nascer, as da última meia hora com esse nome passam a ter o nome dela. */
function leiDecBatizar(nome) {
  if (!nome || typeof decLer !== "function") return 0;
  const sem = [t("dec_lei_nova"), "(lei nova)", "(new law)"];
  const desde = new Date(Date.now() - LEI_CORR_PEND_MS).toISOString();
  let n = 0;
  decLer().forEach((d) => { if (sem.indexOf(d.lei) >= 0 && String(d.q || "") >= desde) { d.lei = String(nome).slice(0, 120); n++; } });
  if (n && typeof decGravar === "function") decGravar();
  return n;
}

/* =====================================================================
 * (19.163.0) FASE 2 — CORRIGIR A LEITURA DE UM ARTIGO DEPOIS QUE A LEI JÁ EXISTE
 *
 * O "editar" do artigo, numa lei gravada, grava uma ALTERAÇÃO DA LEI (camada, com a norma e o selo "alterado por…").
 * Para um erro de leitura isso mente: o artigo não foi alterado por norma nenhuma — o texto veio errado da fonte. Agora
 * a janela do artigo pergunta o que é a mudança, e "✎" no leitor já abre como correção de leitura:
 *  · a correção vai para ONDE o texto do artigo mora hoje: a redação da camada, quando o artigo tem uma (a correção não
 *    tira a norma nem a data dela), ou o texto-base; o número continua o mesmo, então nota, marcas, "onde parei" e
 *    cartões continuam ligados a ele;
 *  · fica na lei (l.correcoes, fase "leitor"), com o que era e o que ficou: o leitor mostra "✎ corrigido" (ver e
 *    desfazer) e o mapa lista em "Decisões tomadas";
 *  · ATUALIZAR A LEI NÃO PERDE A CORREÇÃO: se a versão nova trouxe o MESMO texto errado, a correção é reaplicada; se o
 *    artigo ganhou redação nova, ela fica marcada "ficou para trás" (e o mapa avisa) — nunca é aplicada às cegas sobre
 *    um texto que ela não conhece.
 * ===================================================================== */
function leiCorrNormArt(s) { return String(s == null ? "" : s).replace(/\s+$/, ""); }
/* o texto do artigo onde ele mora agora: { onde: "alteracao" | "base", texto } ou null */
function leiCorrOndeMora(l, num) {
  const alvo = leiNumNormal(num);
  const alt = l && l.alteracoes && l.alteracoes[alvo];
  if (alt && !alt.revogado && String(alt.texto || "").trim()) return { onde: "alteracao", texto: leiCorrNormArt(alt.texto) };
  const a = l ? leiArtigo(l.texto, alvo) : null;
  return a ? { onde: "base", texto: leiCorrNormArt(a.texto) } : null;
}
/* troca o texto do artigo onde ele mora (devolve false se não deu) */
function leiCorrTrocarArt(l, num, onde, novo) {
  const alvo = leiNumNormal(num);
  if (onde === "alteracao") {
    const alt = Object.assign({}, l.alteracoes || {});
    if (!alt[alvo]) return false;
    alt[alvo] = Object.assign({}, alt[alvo], { texto: leiCorrNormArt(novo) });
    return !!leiGuardar({ id: l.id, alteracoes: alt });
  }
  /* as linhas em branco que separam o artigo do próximo ficam: a troca é só do texto dele (19.165.0 — antes, o
   * artigo corrigido grudava no seguinte) */
  const a0 = leiArtigo(l.texto, alvo);
  let cauda = 0;
  if (a0) {
    const bloco = String(l.texto || "").split("\n").slice(a0.linha - 1, a0.linhaFim);
    while (cauda < bloco.length - 1 && !String(bloco[bloco.length - 1 - cauda]).trim()) cauda++;
  }
  if (!a0) return false;
  /* a troca direto nas linhas: leiSubstituirArtigo tira as linhas em branco do fim do texto novo */
  const linhasL = String(l.texto || "").split("\n");
  linhasL.splice(a0.linha - 1, a0.linhaFim - a0.linha + 1, ...leiCorrNormArt(novo).split("\n"), ...new Array(cauda).fill(""));
  const final = linhasL.join("\n");
  const ok = !!leiGuardar({ id: l.id, texto: final });
  /* O CAMPO DO TEXTO DA LEI ABERTA ACOMPANHA: o leitor pinta a partir dele, e outras gravações (os grifos, por
   * leiGravar) o gravam de volta — desatualizado, ele desfaria a correção sem ninguém ver */
  try { if (ok && typeof leiIdAtual !== "undefined" && leiIdAtual === l.id && $("leiTexto")) $("leiTexto").value = final; } catch (e) {}
  return ok;
}
/* a correção de leitura de um artigo → { ok, num, entrada } | { erro } */
function leiCorrArtigoSalvar(idLei, num, novo) {
  const l = leiDe(idLei);
  if (!l) return { erro: "sem_lei" };
  const alvo = leiNumNormal(num);
  const M = leiCorrOndeMora(l, alvo);
  if (!M) return { erro: t("lei_art_nao_achou") };
  const depois = leiCorrNormArt(novo);
  if (depois === M.texto) return { erro: t("lei_corr_art_igual") };
  const lido = leiArtigos(depois)[0];
  if (!lido || lido.linha !== 1) return { erro: t("lei_art_sem_numero") };
  /* a correção não renumera: o número é a âncora da nota, das marcas e dos cartões */
  if (lido.num !== alvo) return { erro: t("lei_corr_art_numero", { a: lido.numCru, b: alvo }) };
  if (!leiCorrTrocarArt(l, alvo, M.onde, depois)) return { erro: t("lei_art_nao_achou") };
  const entrada = { id: "cl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fase: "leitor", tipo: "artigo", num: alvo,
    rotulo: lido.rotulo || ("Art. " + lido.numCru), onde: M.onde, antes: M.texto.slice(0, 6000), depois: depois.slice(0, 6000), em: new Date().toISOString() };
  const l2 = leiDe(idLei);
  leiGuardar({ id: idLei, correcoes: (l2.correcoes || []).concat([entrada]).slice(-200) });
  try { leiReg("editar", "correção de leitura no artigo", entrada.rotulo + " · " + (M.onde === "alteracao" ? "na redação da camada" : "no texto-base")); } catch (e) {}
  if (typeof decRegistrar === "function") {
    try {
      decRegistrar({ area: "colagem", regra: "colagem.correcao", origem: "voce", lei: l.nome, ref: entrada.rotulo, motivo: t("lei_corr_tipo_artigo"),
        risco: "baixo", decisao: "mudou", via: "manual", proposta: { acao: "corrigir", amostra: entrada.antes, depois: entrada.depois, n: 1, linhas: [] } });
    } catch (e) {}
  }
  return { ok: true, num: alvo, entrada };
}
/* a correção ativa (a última, não desfeita) de um artigo, feita no leitor */
function leiCorrDoArtigo(l, num) {
  const alvo = leiNumNormal(num);
  const xs = ((l && l.correcoes) || []).filter((x) => x.fase === "leitor" && x.num === alvo && !x.desfeita);
  return xs[xs.length - 1] || null;
}
function leiCorrArtigoDesfazer(idLei, cid) {
  const l = leiDe(idLei);
  if (!l) return { erro: "sem_lei" };
  const lista = (l.correcoes || []).slice();
  const i = lista.findIndex((x) => x.id === cid);
  if (i < 0) return { erro: "sem_correcao" };
  const x = lista[i];
  const M = leiCorrOndeMora(l, x.num);
  if (!M || M.texto !== leiCorrNormArt(x.depois)) return { erro: t("lei_corr_art_nao_desf", { a: x.rotulo }) };
  if (!leiCorrTrocarArt(l, x.num, M.onde, x.antes)) return { erro: t("lei_corr_art_nao_desf", { a: x.rotulo }) };
  lista[i] = Object.assign({}, x, { desfeita: new Date().toISOString() });
  leiGuardar({ id: idLei, correcoes: lista });
  try { leiReg("editar", "correção de leitura desfeita", x.rotulo); } catch (e) {}
  return { ok: true, entrada: lista[i] };
}
/* depois de uma atualização: reaplica onde o mesmo texto errado voltou; marca "ficou para trás" onde o artigo mudou */
function leiCorrReaplicar(idLei) {
  const l = leiDe(idLei);
  const out = { reaplicadas: 0, atras: 0 };
  if (!l || !(l.correcoes || []).some((x) => x.fase === "leitor" && !x.desfeita)) return out;
  const lista = (l.correcoes || []).slice();
  lista.forEach((x, i) => {
    if (x.fase !== "leitor" || x.desfeita || x.atras) return;
    const M = leiCorrOndeMora(leiDe(idLei), x.num);
    if (!M) { lista[i] = Object.assign({}, x, { atras: new Date().toISOString() }); out.atras++; return; }
    if (M.texto === leiCorrNormArt(x.depois)) return;
    if (M.texto === leiCorrNormArt(x.antes) && leiCorrTrocarArt(leiDe(idLei), x.num, M.onde, x.depois)) {
      lista[i] = Object.assign({}, x, { onde: M.onde, reaplicada: (x.reaplicada || 0) + 1 });
      out.reaplicadas++;
      return;
    }
    lista[i] = Object.assign({}, x, { atras: new Date().toISOString() });
    out.atras++;
  });
  if (out.reaplicadas || out.atras) {
    leiGuardar({ id: idLei, correcoes: lista });
    try { leiReg("atualizacao", "correções de leitura depois da versão nova", out.reaplicadas + " reaplicada(s) · " + out.atras + " ficou(aram) para trás"); } catch (e) {}
  }
  return out;
}
/* o selo "✎ corrigido" no cabeçalho do artigo, no leitor (null sem correção ativa) */
function leiCorrSeloEl(l, a) {
  const x = leiCorrDoArtigo(l, a.num);
  if (!x) return null;
  const d = String(x.em || "").slice(0, 10).split("-").reverse().join("/");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lei-selo-alt lei-selo-corr" + (x.atras ? " lei-selo-corr-atras" : "");
  b.textContent = t(x.atras ? "lei_corr_selo_atras" : "lei_corr_selo");
  b.title = t("lei_corr_selo_tip", { d });
  b.onclick = async () => {
    const corta = (s) => (String(s).length > 1500 ? String(s).slice(0, 1499) + "…" : String(s));
    const sim = await uiConfirm(t("lei_corr_selo_ver", { a: x.rotulo, d, x: corta(x.antes), y: corta(x.depois) }), { ok: t("lei_corr_selo_desf") });
    if (!sim) return;
    const r = leiCorrArtigoDesfazer(l.id, x.id);
    if (r.erro) { uiAlert(r.erro); return; }
    try { toastMsg(t("lei_corr_art_desfeita", { a: x.rotulo }), 4000); } catch (e) {}
    if (typeof leiPintar === "function") leiPintar();
  };
  return b;
}

/* =====================================================================
 * (19.165.0) FASE 3 — APRENDER COM AS CORREÇÕES
 *
 *  · APLICAR AOS PARECIDOS: depois de uma correção, o app procura no mesmo texto os casos iguais e oferece corrigir
 *    todos de uma vez — sempre com a lista à vista e a confirmação da pessoa, nunca sozinho. "Iguais" é estrito, por
 *    tipo: riscar/tirar o risco = o mesmo trecho na mesma situação (entre riscados, ou a linha inteira); reescrever = a
 *    mesma linha, ou a mesma troca de palavra(s) curta; juntar = linha que começa minúscula depois de linha sem ponto
 *    final; separar = o mesmo começo ("Art. N", "§", "I -", "a)") colado no meio de outra linha. O lote vira UMA
 *    correção (um "desfazer" desfaz todas);
 *  · no LEITOR, a correção de um artigo oferece a mesma troca nos outros artigos da lei que têm o mesmo trecho;
 *  · O CASO DE TESTE: a correção com o antes, o depois e o trecho do HTML de origem (quando a lei veio de arquivo ou de
 *    colagem com formatação), pronto para relatar — vira teste do leitor, como o art. 53 do Estatuto da Cidade.
 * ===================================================================== */
const LEI_CORR_PAR_MAX = 200;
/* a troca de palavra(s) entre antes e depois, sem a pontuação que as duas versões têm em comum nas pontas
 * ("leitrua." → "leitura." é a troca "leitrua" → "leitura", que também vale em "leitrua também") */
function leiCorrTroca(antes, depois) {
  const d = leiPreDiff(antes, depois);
  let x = d.a, y = d.b;
  const pont = (ch) => /[^0-9A-Za-zÀ-ú]/.test(ch);
  while (x && y && x[x.length - 1] === y[y.length - 1] && pont(x[x.length - 1])) { x = x.slice(0, -1); y = y.slice(0, -1); }
  while (x && y && x[0] === y[0] && pont(x[0])) { x = x.slice(1); y = y.slice(1); }
  return { x, y };
}
/* a parte que mudou entre a linha antes e depois de riscar/tirar o risco: { a, b, txt } (posições no texto limpo) */
function leiCorrTrechoMudado(de, para) {
  const A = leiCorrLimpo(de), B = leiCorrLimpo(para);
  if (A.txt !== B.txt) return null;
  let a = -1, b = -1;
  for (let i = 0; i < A.txt.length; i++) if (A.flag[i] !== B.flag[i]) { if (a < 0) a = i; b = i + 1; }
  if (a < 0) return null;
  return { a, b, txt: A.txt.slice(a, b), A };
}
/* a situação de um trecho na linha: riscado logo antes e logo depois (ignorando espaço), ou a linha inteira */
function leiCorrSituacao(C, a, b) {
  let i = a - 1; while (i >= 0 && /\s/.test(C.txt[i])) i--;
  let j = b; while (j < C.txt.length && /\s/.test(C.txt[j])) j++;
  return { antes: i >= 0 && !!C.flag[i], depois: j < C.txt.length && !!C.flag[j], toda: !C.txt.slice(0, a).trim() && !C.txt.slice(b).trim() };
}
const LEI_CORR_RE_CABECA = [/^Art(?:igo)?\.?\s*\d/i, /^§/, /^Par[áa]grafo\s+[úu]nico/i, /^[IVXLCDM]{1,7}\s*[-–—]/, /^[a-z]\)/];
/* os casos parecidos com a correção op, no texto de agora (L) → [{ n, de, para }] (sem as linhas da própria op) */
function leiCorrParecidos(L, op) {
  const out = [];
  if (!op || op.lote) return out;
  const proprias = new Set(op.alvo.map((x) => x.n));
  const a0 = op.alvo[op.alvo.length - 1];
  const vale = (k) => !proprias.has(k + 1) && L[k] !== undefined;
  if (op.tipo === "riscar" || op.tipo === "tirar_risco") {
    const M = leiCorrTrechoMudado(a0.de, a0.para);
    if (!M || !M.txt.trim()) return out;
    const sim = op.tipo === "riscar";
    const S = leiCorrSituacao(M.A, M.a, M.b);
    for (let k = 0; k < L.length && out.length < LEI_CORR_PAR_MAX; k++) {
      if (!vale(k) || L[k].indexOf(M.txt.trim().slice(0, 12)) < 0 && leiCorrLimpo(L[k]).txt.indexOf(M.txt) < 0) continue;
      const C = leiCorrLimpo(L[k]);
      let p = C.txt.indexOf(M.txt);
      while (p >= 0) {
        const q = p + M.txt.length;
        const ja = C.flag.slice(p, q).every((f) => !!f === sim);
        const s = leiCorrSituacao(C, p, q);
        const ok = !ja && (S.toda ? s.toda : ((!S.antes || s.antes) && (!S.depois || s.depois)));
        if (ok) { out.push({ n: k + 1, de: L[k], para: leiCorrRiscar(L[k], p, q, sim) }); break; }
        p = C.txt.indexOf(M.txt, p + 1);
      }
    }
    return out;
  }
  if (op.tipo === "editar") {
    const de = a0.de, para = a0.para;
    /* a mesma linha, inteira */
    for (let k = 0; k < L.length && out.length < LEI_CORR_PAR_MAX; k++) if (vale(k) && L[k] === de) out.push({ n: k + 1, de: L[k], para });
    if (out.length || para.indexOf("\n") >= 0) return out;
    /* a mesma troca curta ("leitrua" → "leitura") em outras linhas */
    const { x, y } = leiCorrTroca(de, para);
    if (!x.trim() || x.length > 60 || x.trim().length < 2 || x.indexOf("~~") >= 0 || y.indexOf("~~") >= 0) return out;
    for (let k = 0; k < L.length && out.length < LEI_CORR_PAR_MAX; k++) {
      if (!vale(k) || L[k].indexOf(x) < 0) continue;
      out.push({ n: k + 1, de: L[k], para: L[k].split(x).join(y) });
    }
    return out;
  }
  if (op.tipo === "juntar") {
    /* a frase quebrada: começa minúscula e a linha com texto de cima não termina em pontuação de fim */
    let acum = null;
    const prox = (k) => { let j = k - 1; while (j >= 0 && !String(L[j]).trim()) j--; return j; };
    const quebrada = (k) => {
      const s = leiCorrLimpo(L[k]).txt.trim();
      if (!/^[a-zà-ú]/.test(s)) return false;
      const j = prox(k);
      if (j < 0) return false;
      const ant = leiCorrLimpo(L[j]).txt.trim();
      return !!ant && !/[.;:!?)\]"”]$/.test(ant);
    };
    const alvo = {};
    for (let k = 0; k < L.length; k++) {
      if (!vale(k) || !String(L[k]).trim() || !quebrada(k)) continue;
      const j = prox(k);
      if (proprias.has(j + 1)) continue;
      /* encadeia: a de cima já foi juntada a outra → junta nesta outra */
      const base = acum && acum.ultimaVazia === j ? acum.base : j;
      if (!alvo[base]) alvo[base] = { n: base + 1, de: L[base], para: String(L[base]).replace(/\s+$/, "") };
      alvo[base].para += " " + String(L[k]).trim();
      alvo[k] = { n: k + 1, de: L[k], para: "" };
      acum = { base, ultimaVazia: k };
      if (Object.keys(alvo).length >= LEI_CORR_PAR_MAX) break;
    }
    return Object.keys(alvo).map((k) => alvo[k]).sort((p, q) => p.n - q.n);
  }
  if (op.tipo === "separar") {
    const dir = String(a0.para).split("\n")[1] || "";
    const cab = LEI_CORR_RE_CABECA.find((re) => re.test(leiCorrLimpo(dir).txt.trim()));
    if (!cab) return out;
    const meio = new RegExp("([.;:])\\s+(" + cab.source.replace(/^\^/, "") + ")", cab.flags.replace("g", ""));
    for (let k = 0; k < L.length && out.length < LEI_CORR_PAR_MAX; k++) {
      if (!vale(k)) continue;
      const C = leiCorrLimpo(L[k]);
      const m = C.txt.match(meio);
      if (!m) continue;
      const pos = m.index + m[1].length + (m[0].length - m[1].length - m[2].length);
      const o = leiCorrOpSeparar(L, k + 1, pos);
      if (o) out.push({ n: k + 1, de: L[k], para: o.alvo[0].para });
    }
    return out;
  }
  return out;
}
/* depois de uma correção na revisão: guarda os parecidos para oferecer (chamado por leiCorrAdicionar) */
function leiCorrOferecerParecidos(c, op) {
  if (!c || !op || op.lote) return 0;
  const itens = leiCorrParecidos(leiPreLinhasDaColagem(c), op);
  c.corrParecidos = itens.length ? { op: op.id, tipo: op.tipo, itens, marcados: itens.map(() => true) } : null;
  return itens.length;
}
function leiCorrAplicarParecidos() {
  const c = leiPreCtx;
  const P = c && c.corrParecidos;
  if (!P) return false;
  const alvo = P.itens.filter((x, i) => P.marcados[i]);
  c.corrParecidos = null;
  if (!alvo.length) { leiPrePintar(); return false; }
  const op = leiCorrNova(P.tipo, alvo, { lote: true, origem: P.op });
  return leiCorrAdicionar(op);
}
function leiCorrParecidosEl(c) {
  const P = c.corrParecidos;
  if (!P || !P.itens.length) return null;
  const box = leiPreEl("div", "lei-corr-par");
  box.id = "leiCorrPar";
  box.append(leiPreEl("div", "lei-corr-par-tit", t("lei_corr_par_tit", { n: P.itens.length })));
  box.append(leiPreEl("p", "nota", t("lei_corr_par_expl_" + P.tipo)));
  const lista = leiPreEl("div", "lei-corr-par-lista");
  P.itens.slice(0, 60).forEach((x, i) => {
    const lb = leiPreEl("label", "lei-corr-par-it");
    const ck = document.createElement("input");
    ck.type = "checkbox"; ck.id = "leiCorrPar_" + i; ck.checked = !!P.marcados[i];
    ck.onchange = () => { P.marcados[i] = ck.checked; const b = $("btnLeiCorrParAplicar"); if (b) b.textContent = t("lei_corr_par_aplicar", { n: P.marcados.filter(Boolean).length }); };
    lb.append(ck, leiPreEl("span", "lei-corr-tipo", t("lei_corr_linha", { l: x.n })));
    if (P.tipo === "riscar" || P.tipo === "tirar_risco") lb.append(leiCorrPartesEl(x.para));
    else lb.append(leiPreEl("span", "lei-corr-res", leiCorrLimpo(x.de).txt.replace(/\s+/g, " ").slice(0, 70) + " → " + leiCorrLimpo(x.para).txt.replace(/\n/g, " ⏎ ").replace(/\s+/g, " ").slice(0, 70)));
    lista.append(lb);
  });
  if (P.itens.length > 60) lista.append(leiPreEl("p", "nota", t("lei_corr_par_mais", { n: P.itens.length - 60 })));
  box.append(lista);
  const ac = leiPreEl("div", "lei-corr-ed-ac");
  const ap = leiPreEl("button", "btn-min btn-min-ok", t("lei_corr_par_aplicar", { n: P.marcados.filter(Boolean).length }));
  ap.type = "button"; ap.id = "btnLeiCorrParAplicar";
  ap.onclick = () => leiCorrAplicarParecidos();
  const no = leiPreEl("button", "btn-min", t("lei_corr_par_nao"));
  no.type = "button"; no.id = "btnLeiCorrParNao";
  no.onclick = () => { c.corrParecidos = null; leiPrePintar(); };
  ac.append(ap, no);
  box.append(ac);
  return box;
}

/* ---------------- no leitor: a mesma troca nos outros artigos ---------------- */
function leiCorrArtigoParecidos(idLei, entrada) {
  const l = leiDe(idLei);
  if (!l || !entrada) return [];
  const { x, y } = leiCorrTroca(entrada.antes, entrada.depois);
  if (!x.trim() || x.trim().length < 2 || x.length > 60 || x.indexOf("\n") >= 0 || y.indexOf("\n") >= 0) return [];
  const nums = new Set();
  leiArtigos(l.texto).forEach((a) => nums.add(a.num));
  Object.keys(l.alteracoes || {}).forEach((n) => nums.add(n));
  const out = [];
  nums.forEach((num) => {
    if (num === entrada.num) return;
    const M = leiCorrOndeMora(l, num);
    if (!M || M.texto.indexOf(x) < 0) return;
    const a = leiArtigo(M.onde === "base" ? l.texto : M.texto, num);
    out.push({ num, rotulo: (a && a.rotulo) || ("Art. " + num), novo: M.texto.split(x).join(y) });
  });
  return out.slice(0, LEI_CORR_PAR_MAX);
}
function leiCorrArtigoAplicarParecidos(idLei, lista, origem) {
  let n = 0;
  (lista || []).forEach((x) => {
    const r = leiCorrArtigoSalvar(idLei, x.num, x.novo);
    if (r.ok) {
      n++;
      const l = leiDe(idLei);
      const cs = (l.correcoes || []).slice();
      const i = cs.findIndex((y) => y.id === r.entrada.id);
      if (i >= 0) { cs[i] = Object.assign({}, cs[i], { lote: true, origem: origem || "" }); leiGuardar({ id: idLei, correcoes: cs }); }
    }
  });
  return n;
}
/* oferece, depois da correção de um artigo no leitor (leiEdSalvar), a mesma troca nos outros artigos */
async function leiCorrArtigoOferecer(idLei, entrada) {
  const par = leiCorrArtigoParecidos(idLei, entrada);
  if (!par.length) return 0;
  const d = leiCorrTroca(entrada.antes, entrada.depois);
  const sim = await uiConfirm(t("lei_corr_par_art", { n: par.length, a: d.x.trim(), b: d.y.trim(),
    l: par.slice(0, 8).map((x) => x.rotulo).join(", ") + (par.length > 8 ? "…" : "") }), { ok: t("lei_corr_par_art_ok", { n: par.length }) });
  if (!sim) return 0;
  const n = leiCorrArtigoAplicarParecidos(idLei, par, entrada.id);
  try { toastMsg(t("lei_corr_par_art_feito", { n }), 4500); } catch (e) {}
  if (typeof leiPintar === "function") leiPintar();
  return n;
}

/* ---------------- o caso de teste ---------------- */
/* o trecho do HTML de origem em volta do texto da linha (a palavra longa mais rara da linha, que aparece no HTML) */
function leiCorrTrechoHtml(html, linha) {
  const h = String(html || "");
  if (!h) return "";
  const ws = (leiCorrLimpo(linha).txt.match(/[A-Za-z]{6,}/g) || []);
  let melhor = null;
  ws.forEach((w) => {
    let n = 0, i = h.indexOf(w), pos = i;
    while (i >= 0 && n < 50) { n++; i = h.indexOf(w, i + 1); }
    if (pos >= 0 && (!melhor || n < melhor.n)) melhor = { w, n, pos };
  });
  if (!melhor) return "";
  return h.slice(Math.max(0, melhor.pos - 500), melhor.pos + 700).replace(/\s+/g, " ");
}
function leiCorrCasoDeTeste(c) {
  if (!c || !(c.correcoes || []).length) return "";
  const html = typeof leiHtmlUltimo !== "undefined" ? leiHtmlUltimo : "";
  const L = ["=== CASO DE TESTE · EasyAnkiCards " + (typeof VERSAO !== "undefined" ? VERSAO : "") + " · correções à mão na revisão da colagem ===",
    "(o texto de leis é público; nada pessoal vai aqui)"];
  c.correcoes.forEach((op, k) => {
    L.push("", "--- " + (k + 1) + ". " + op.tipo + (op.lote ? " (lote de " + op.alvo.length + ")" : "") + " · linha " + op.alvo[op.alvo.length - 1].n);
    op.alvo.slice(0, op.lote ? 3 : 4).forEach((a) => {
      L.push("ANTES (como o leitor deixou):", a.de, "DEPOIS (como deve ficar):", a.para);
    });
    if (op.lote && op.alvo.length > 3) L.push("… e mais " + (op.alvo.length - 3) + " linha(s) iguais");
    const tr = leiCorrTrechoHtml(html, op.alvo[0].de);
    if (tr) L.push("HTML DE ORIGEM (trecho):", tr);
  });
  return L.join("\n");
}
async function leiCorrCopiarCaso() {
  const txt = leiCorrCasoDeTeste(leiPreCtx);
  if (!txt) return false;
  try { await navigator.clipboard.writeText(txt); toastMsg(t("lei_corr_caso_ok"), 4000); }
  catch (e) { if (typeof leiRelatorioMostrar === "function") leiRelatorioMostrar(txt); }
  try { leiReg("gravar", "caso de teste das correções copiado", (leiPreCtx.correcoes || []).length + " correção(ões)"); } catch (e) {}
  return true;
}
