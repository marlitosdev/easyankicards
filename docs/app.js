/* EasyAnkiCards PWA — camada de interface (v5.4).
 * Lógica de negócio em parser.js/anki.js; textos em i18n.js.
 * Novidades: múltipla escolha [MC], marcar/limpar lacunas cloze por
 * seleção, análise do texto com críticas e correções automáticas. */

const VERSAO = "5.7.0";
const $ = (id) => document.getElementById(id);
let excluidos = new Set();
let ultimoResult = null;
let previewTimer = null;
let editando = null;

/* ------------------------- textos estáticos ------------------------- */

function aplicarTextos() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $("versao").textContent = "v" + VERSAO;
  $("tags").placeholder = t("tags_placeholder");
  $("deck").placeholder = t("deck_placeholder");
  $("ajudaTexto").textContent = t("help_text");
  atualizarDestino();
}

/* --------------------------- destino Anki --------------------------- */

function nomeDeck() { return $("deck").value.trim() || "Deck"; }

function atualizarDestino() {
  const partes = nomeDeck().split("::").map((p) => p.trim()).filter(Boolean);
  $("destino").textContent = partes.length > 1
    ? t("dest_path", { path: partes.join("  >  "), last: partes[partes.length - 1] })
    : t("dest_root", { name: nomeDeck() });
}

/* ------------------- lacunas cloze por seleção ---------------------- */

function marcarLacuna(campo) {
  const ini = campo.selectionStart, fim = campo.selectionEnd;
  if (ini === fim) { alert(t("hint_mark_blank")); return; }
  const v = campo.value;
  const n = (v.match(/\{\{c(\d+)::/g) || [])
    .reduce((m, s) => Math.max(m, parseInt(s.slice(3), 10)), 0) + 1;
  campo.value = v.slice(0, ini) + "{{c" + n + "::" + v.slice(ini, fim) + "}}" + v.slice(fim);
  campo.focus();
}

function limparLacunas(campo) {
  campo.value = campo.value.replace(/\{\{c\d+::([\s\S]*?)\}\}/g, "$1");
}

function botoesLacuna(pai, campo) {
  const linha = document.createElement("div");
  linha.className = "acoes";
  const bM = document.createElement("button");
  bM.type = "button"; bM.className = "btn btn-ciano"; bM.textContent = t("btn_mark_blank");
  bM.title = t("hint_mark_blank");
  bM.onclick = () => marcarLacuna(campo);
  const bL = document.createElement("button");
  bL.type = "button"; bL.className = "btn btn-cinza"; bL.textContent = t("btn_clear_blanks");
  bL.onclick = () => limparLacunas(campo);
  const aj = document.createElement("button");
  aj.type = "button"; aj.className = "ic-ajuda"; aj.textContent = "?";
  aj.onclick = () => alert(t("hint_mark_blank"));
  linha.append(bM, bL, aj);
  pai.append(linha);
}


/* -------------- destaque de sintaxe e erros no editor --------------- */

let hlWarnLines = new Set();   // linhas ignoradas (vermelho)
let hlIssueLines = new Set();  // linhas de cartões VERIFICAR (laranja)

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function destacarTrecho(texto) {
  // separa lacunas cloze do resto para colorir sem conflito com '::'
  const partes = texto.split(/(\{\{c\d+::[\s\S]*?\}\})/g);
  return partes.map((p) => {
    if (/^\{\{c\d+::/.test(p)) return '<span class="hl-cloze">' + escHtml(p) + "</span>";
    return escHtml(p).replace(/::/g, '<span class="hl-delim">::</span>');
  }).join("");
}

function renderDestaque() {
  const linhas = $("editor").value.split("\n");
  const html = linhas.map((l, i) => {
    const n = i + 1;
    let corpo;
    if (l.trim().startsWith("#")) corpo = '<span class="hl-com">' + escHtml(l) + "</span>";
    else if (l.startsWith("[MC]"))
      corpo = '<span class="hl-mc">[MC]</span>' + destacarTrecho(l.slice(4));
    else corpo = destacarTrecho(l);
    const cls = hlWarnLines.has(n) ? "hl-err" : (hlIssueLines.has(n) ? "hl-warn" : "");
    return cls ? '<span class="' + cls + '">' + corpo + "</span>" : corpo;
  }).join("\n");
  $("editorHl").innerHTML = html + "\n";
  $("editorHl").scrollTop = $("editor").scrollTop;
}

/* ---------------- sugestões automáticas (sem botão) ----------------- */

function renderSugestoes(r, raw) {
  const box = $("sugestoes");
  box.innerHTML = "";
  const itens = [];
  if (r.warnings.length) itens.push({ dot: "dot-red", txt: t("sug_ignored", { n: r.warnings.length }) });
  if (r.nSuspicious) itens.push({ dot: "dot-org", txt: t("sug_verify", { n: r.nSuspicious }) });
  if (r.nPares) itens.push({ dot: "dot-blue", txt: t("sug_pairs", { n: r.nPares }) });
  const vistos = {};
  let longos = 0, dups = 0;
  r.cards.forEach((c) => {
    if ((c.front + c.back).length > 220 && longos < 2) { itens.push({ dot: "dot-org", txt: t("crit_long", { n: c.line }) }); longos++; }
    const k = c.front.toLowerCase().trim();
    if (vistos[k] && dups < 2) { itens.push({ dot: "dot-org", txt: t("crit_dup", { a: vistos[k], b: c.line }) }); dups++; }
    else if (!vistos[k]) vistos[k] = c.line;
  });
  if (temMarcadores(raw))
    itens.push({ dot: "dot-org", txt: t("crit_bullets"),
                 fixTxt: t("fix_bullets"), fix: removerMarcadoresTexto });
  if (!itens.length) itens.push({ dot: "dot-green", txt: t("sug_none") });

  itens.slice(0, 6).forEach((it) => {
    const div = document.createElement("div");
    div.className = "sug";
    const dot = document.createElement("span");
    dot.className = "dot " + it.dot;
    const sp = document.createElement("span");
    sp.textContent = it.txt;
    div.append(dot, sp);
    if (it.fix) {
      const b = document.createElement("button");
      b.className = "btn btn-azul"; b.textContent = it.fixTxt;
      b.onclick = () => {
        $("editor").value = it.fix($("editor").value);
        $("status").textContent = t("applied_status");
        preview();
      };
      div.append(b);
    }
    box.append(div);
  });
}


/* --------- renderizador de cartão com marcadores visuais ------------ */

/* Frente com chips: lacuna simples = chip azul com a resposta;
 * lacuna com alternativas ({{c1::certa::op/op}}) = chip roxo listando
 * as opções, com a CORRETA verde e sublinhada. */
function formatFrente(c) {
  const frag = document.createDocumentFragment();
  const partes = c.front.split(/(\{\{c\d+::[\s\S]*?\}\})/g);
  partes.forEach((p) => {
    const m = p.match(/^\{\{c\d+::([\s\S]*?)\}\}$/);
    if (!m) { frag.append(document.createTextNode(p)); return; }
    const inner = m[1].split("::");
    const ans = inner[0].trim(), hint = (inner[1] || "").trim();
    const chip = document.createElement("span");
    if (hint && hint.includes("/")) {
      chip.className = "chip-ops";
      const ops = hint.split("/").map((s) => s.trim()).filter(Boolean);
      ops.forEach((op, i) => {
        const so = document.createElement("span");
        so.textContent = op;
        if (op === ans) so.className = "certa";
        chip.append(so);
        if (i < ops.length - 1) chip.append(document.createTextNode(" / "));
      });
    } else {
      chip.className = "chip-cloze";
      chip.textContent = ans + (hint ? "  (" + hint + ")" : "");
    }
    frag.append(chip);
  });
  return frag;
}

/* Corpo do cartão (frente, alternativas, verso, tags, avisos) —
 * usado na lista de pré-visualização E no preview ao vivo do diálogo. */
function renderCorpoCartao(div, c) {
  const f = document.createElement("div");
  f.className = "frente"; f.append(formatFrente(c)); div.append(f);
  if (c.kind === "mc") {
    c.options.forEach((o, i) => {
      const li = document.createElement("div");
      li.className = "verso";
      li.textContent = letra(i) + ") " + o + (i === c.correct ? "  ✔" : "");
      if (i === c.correct) li.style.cssText = "color:var(--verde);font-weight:700";
      div.append(li);
    });
    if (c.back) { const v = document.createElement("div"); v.className = "tags"; v.textContent = c.back; div.append(v); }
  } else if (c.back) {
    const v = document.createElement("div"); v.className = "verso"; v.textContent = c.back; div.append(v);
  }
  if (c.tags.length) { const tg = document.createElement("div"); tg.className = "tags"; tg.textContent = t("tags_prefix") + c.tags.join(", "); div.append(tg); }
  c.issues.forEach((i) => { const e = document.createElement("div"); e.className = "issue"; e.textContent = "(!) " + i; div.append(e); });
  (c.infos || []).forEach((i) => { const e = document.createElement("div"); e.className = "info"; e.textContent = "ℹ " + i; div.append(e); });
}

/* ------------------------- pré-visualização ------------------------- */

function chave(c) { return c.line + "|" + c.front; }

function agendarPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, 500);
}

function parseAtual() {
  const globais = $("tags").value.trim() ? parseTags($("tags").value) : [];
  return parseText($("editor").value, globais);
}

function reescreverEditor(cards, warnings) {
  let texto = cards.map(cardToLine).join("\n\n");
  if (warnings && warnings.length)
    texto += "\n\n" + t("norm_ignored_header") + "\n" + warnings.map((w) => "# " + w).join("\n");
  $("editor").value = texto + "\n";
}

function tipoRotulo(c) {
  if (c.kind === "mc") return pm("p_mc");
  return t(c.kind === "cloze" ? "card_cloze" : "card_basic");
}

function preview() {
  previewTimer = null;
  const r = parseAtual();
  ultimoResult = r;
  const box = $("cartoes");
  box.innerHTML = "";

  r.cards.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "card" + (c.issues.length ? " suspeito" : "");
    const titulo = "#" + (idx + 1) + " · " + tipoRotulo(c) + " · " + t("card_line") + " " + c.line
      + (c.issues.length ? " — " + t("card_verify") : "");
    const cab = document.createElement("div");
    cab.className = "cab";
    const sp = document.createElement("span");
    sp.className = "titulo"; sp.textContent = titulo;
    const lbl = document.createElement("label");
    lbl.style.cssText = "display:flex;align-items:center;gap:4px;font-weight:400";
    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = !excluidos.has(chave(c));
    chk.onchange = () => {
      chk.checked ? excluidos.delete(chave(c)) : excluidos.add(chave(c));
      resumo(r);
    };
    lbl.append(chk, document.createTextNode(t("include_chk")));
    cab.append(sp, lbl);
    div.append(cab);

    if (editando === chave(c)) {
      c.kind === "mc" ? montarEdicaoMC(div, c, r, idx) : montarEdicao(div, c, r, idx);
    } else {
      renderCorpoCartao(div, c);
      const acoes = document.createElement("div");
      acoes.className = "acoes";
      const bEd = document.createElement("button");
      bEd.className = "btn btn-cinza"; bEd.textContent = t("edit_btn");
      bEd.onclick = () => { editando = chave(c); preview(); };
      acoes.append(bEd);
      div.append(acoes);
    }
    box.append(div);
  });

  r.warnings.forEach((w) => {
    const div = document.createElement("div");
    div.className = "card ignorado";
    div.textContent = t("ignored_prefix") + w;
    box.append(div);
  });
  resumo(r);

  // análise automática: cores no editor + faixa de sugestões
  hlWarnLines = new Set(r.warnLines || []);
  hlIssueLines = new Set(r.cards.filter((c) => c.issues.length).map((c) => c.line));
  renderDestaque();
  renderSugestoes(r, $("editor").value);
}

function selecionados(r) { return r.cards.filter((c) => !excluidos.has(chave(c))); }

function resumo(r) {
  let s = t("summary", { n: r.cards.length, b: r.nBasic, c: r.nCloze, sel: selecionados(r).length });
  if (r.nSuspicious) s += t("summary_verify", { n: r.nSuspicious });
  $("resumo").textContent = s;
  $("status").textContent = t("status_auto", { n: r.cards.length });
}

/* --------------------------- edição inline -------------------------- */

function campoEditavel(pai, rotuloKey, hintKey, valor, multiline) {
  const lbl = document.createElement("span");
  lbl.className = "mini-lbl";
  lbl.textContent = t(rotuloKey) + " ";
  const aj = document.createElement("button");
  aj.className = "ic-ajuda"; aj.type = "button"; aj.textContent = "?";
  const dica = document.createElement("div");
  dica.style.cssText = "display:none;font-size:11.5px;color:var(--sutil);margin-top:2px";
  dica.textContent = t(hintKey);
  aj.onclick = () => { dica.style.display = dica.style.display === "none" ? "block" : "none"; };
  lbl.append(aj);
  const campo = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) campo.type = "text";
  campo.value = valor;
  pai.append(lbl, dica, campo);
  return campo;
}

function botoesSalvar(div, salvar, r, idx) {
  const acoes = document.createElement("div");
  acoes.className = "acoes";
  const bS = document.createElement("button");
  bS.className = "btn btn-verde"; bS.textContent = t("save_btn");
  bS.onclick = salvar;
  const bC = document.createElement("button");
  bC.className = "btn btn-cinza"; bC.textContent = t("cancel_btn");
  bC.onclick = () => { editando = null; preview(); };
  const bX = document.createElement("button");
  bX.className = "btn"; bX.style.background = "#b91c1c"; bX.textContent = t("delete_btn");
  bX.onclick = () => {
    r.cards.splice(idx, 1);
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    $("status").textContent = t("deleted_status");
    preview();
  };
  acoes.append(bS, bC, bX);
  div.append(acoes);
}

function montarEdicao(div, c, r, idx) {
  const inFrente = campoEditavel(div, "field_front", "hint_front", c.front, true);
  botoesLacuna(div, inFrente);          // marcar/limpar {{c1::...}} na seleção
  const inVerso = campoEditavel(div, "field_back", "hint_back", c.back, true);
  const inTags = campoEditavel(div, "field_tags", "hint_tags", c.tags.join(", "), false);
  botoesSalvar(div, () => {
    const front = inFrente.value.trim();
    r.cards[idx] = Object.assign({}, c, {
      kind: CLOZE_RE.test(front) ? "cloze" : "basic",
      front, back: inVerso.value.trim(), tags: parseTags(inTags.value),
    });
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    $("status").textContent = t("edited_status");
    preview();
  }, r, idx);
}

function montarEdicaoMC(div, c, r, idx) {
  const inFrente = campoEditavel(div, "field_front", "hint_front", c.front, true);
  const lbl = document.createElement("span");
  lbl.className = "mini-lbl"; lbl.textContent = t("mc_options_label") + " ";
  const aj = document.createElement("button");
  aj.className = "ic-ajuda"; aj.type = "button"; aj.textContent = "?";
  aj.onclick = () => alert(t("hint_mc"));
  lbl.append(aj);
  div.append(lbl);

  const inputs = [];
  const ops = c.options.slice();
  while (ops.length < 4) ops.push("");
  ops.slice(0, 5).forEach((o) => {
    const i = document.createElement("input");
    i.type = "text"; i.value = o;
    div.append(i);
    inputs.push(i);
  });

  const selLbl = document.createElement("span");
  selLbl.className = "mini-lbl"; selLbl.textContent = t("mc_correct");
  const sel = document.createElement("select");
  sel.style.cssText = "width:100%;padding:6px;border-radius:6px;margin-top:2px";
  inputs.forEach((_, i) => {
    const op = document.createElement("option");
    op.value = i; op.textContent = letra(i);
    sel.append(op);
  });
  sel.value = c.correct;
  div.append(selLbl, sel);

  const inVerso = campoEditavel(div, "field_back", "hint_back", c.back, true);
  const inTags = campoEditavel(div, "field_tags", "hint_tags", c.tags.join(", "), false);

  botoesSalvar(div, () => {
    const options = inputs.map((i) => i.value.trim()).filter(Boolean);
    let correct = Math.min(parseInt(sel.value, 10), Math.max(options.length - 1, 0));
    r.cards[idx] = Object.assign({}, c, {
      front: inFrente.value.trim(), options, correct,
      back: inVerso.value.trim(), tags: parseTags(inTags.value),
    });
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    $("status").textContent = t("edited_status");
    preview();
  }, r, idx);
}

/* ----------------------- normalizar / analisar ---------------------- */

function normalizar() {
  const r = parseText($("editor").value, []);
  if (!r.cards.length && !r.warnings.length) return;
  reescreverEditor(r.cards, r.warnings);
  $("status").textContent = t("normalize_status", { n: r.cards.length });
  preview();
}

/* --------------------------- exportação ---------------------------- */

function validar() {
  const r = parseAtual();
  const sel = selecionados(r);
  if (!sel.length) { alert(t("none_msg")); return null; }
  const rSel = Object.assign({}, r, { cards: sel });
  rSel.nSuspicious = sel.filter((c) => c.issues.length).length;
  if (rSel.nSuspicious || r.warnings.length) {
    const itens = [];
    sel.forEach((c) => c.issues.forEach((i) => itens.push("• " + t("card_line") + " " + c.line + ": " + i)));
    r.warnings.forEach((w) => itens.push("• " + w));
    const ok = confirm(t("problems_msg", { resumo: itens.slice(0, 6).join("\n") }));
    if (!ok) { $("status").textContent = t("status_cancel"); return null; }
  }
  return rSel;
}

function nomeArquivo() {
  const partes = nomeDeck().split("::").map((p) => p.trim()).filter(Boolean);
  let n = (partes[partes.length - 1] || "deck").replace(/[\\/:*?"<>|]/g, "-");
  if (n.toLowerCase() === "collection") n = "deck";
  return n;
}

async function entregar(bytes, nome, mime) {
  const file = new File([bytes], nome, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportarTxt() {
  const r = validar(); if (!r) return;
  const txt = exportTxtString(r, nomeDeck());
  await entregar(new TextEncoder().encode(txt), nomeArquivo() + ".txt", "text/plain");
  $("status").textContent = t("status_saved", { f: nomeArquivo() + ".txt" });
  alert(t("txt_done_msg"));
}

async function exportarApkg() {
  const r = validar(); if (!r) return;
  $("status").textContent = "…";
  try {
    const bytes = await buildApkg(r.cards, nomeDeck());
    await entregar(bytes, nomeArquivo() + ".apkg", "application/octet-stream");
    $("status").textContent = t("status_saved", { f: nomeArquivo() + ".apkg" });
    const partes = nomeDeck().split("::").map((p) => p.trim()).filter(Boolean);
    alert(t("apkg_done_msg", { dest: partes.join("  >  ") }));
  } catch (e) {
    alert(t("apkg_err_title") + "\n\n" + e);
    $("status").textContent = "";
  }
}


/* ------------------------ modo revisão rápida ----------------------- */

let revIdx = 0, revMostra = false;

function clozeMascarado(texto, mostrar) {
  const frag = document.createElement("span");
  const partes = texto.split(/(\{\{c\d+::[\s\S]*?\}\})/g);
  partes.forEach((p) => {
    const m = p.match(/^\{\{c\d+::([\s\S]*?)\}\}$/);
    if (!m) { frag.append(document.createTextNode(p)); return; }
    const inner = m[1].split("::");            // [resposta, dica?]
    const sp = document.createElement("span");
    sp.className = mostrar ? "rev-certa" : "rev-mask";
    sp.textContent = mostrar ? inner[0] : (inner[1] ? "[ " + inner[1] + " ]" : "[...]");
    frag.append(sp);
  });
  return frag;
}

/* Alternativas embutidas numa lacuna nativa (para listar antes do flip). */
function opcoesLacuna(front) {
  const m = front.match(/\{\{c\d+::([\s\S]*?)::([\s\S]*?)\}\}/);
  if (!m || !m[2].includes("/")) return null;
  return { ans: m[1].trim(), ops: m[2].split("/").map((s) => s.trim()).filter(Boolean) };
}

function revRender() {
  const cards = ultimoResult ? selecionados(ultimoResult) : [];
  const alvo = $("revCartao");
  alvo.innerHTML = "";
  if (!cards.length) { alvo.textContent = t("review_empty"); $("revContador").textContent = ""; return; }
  revIdx = Math.max(0, Math.min(revIdx, cards.length - 1));
  const c = cards[revIdx];
  $("revContador").textContent = t("review_counter", { i: revIdx + 1, n: cards.length })
    + "  ·  " + tipoRotulo(c);

  const frente = document.createElement("div");
  frente.style.fontWeight = "700";
  frente.append(clozeMascarado(c.front, false));
  alvo.append(frente);
  // MC nativa (cloze com opções): alternativas visíveis antes do flip
  const mcx = c.kind !== "mc" ? opcoesLacuna(c.front) : null;
  if (mcx) {
    mcx.ops.forEach((o, i) => {
      const li = document.createElement("div");
      li.textContent = letra(i) + ") " + o;
      if (revMostra && o === mcx.ans) li.className = "rev-certa";
      alvo.append(li);
    });
  }
  if (c.kind === "mc") {
    c.options.forEach((o, i) => {
      const li = document.createElement("div");
      li.textContent = letra(i) + ") " + o;
      if (revMostra && i === c.correct) li.className = "rev-certa";
      alvo.append(li);
    });
  }
  if (revMostra) {
    const hr = document.createElement("hr");
    alvo.append(hr);
    if (CLOZE_RE.test(c.front)) {
      const resp = document.createElement("div");
      resp.append(clozeMascarado(c.front, true));
      alvo.append(resp);
    }
    if (c.kind === "mc") {
      const ok = document.createElement("div");
      ok.className = "rev-certa";
      ok.textContent = "✔ " + letra(c.correct) + ") " + (c.options[c.correct] || "");
      alvo.append(ok);
    }
    if (c.back) {
      const v = document.createElement("div");
      v.textContent = c.back;
      alvo.append(v);
    }
  }
}

$("btnRevisar").onclick = () => { revIdx = 0; revMostra = false; revRender(); $("dlgRevisao").showModal(); };
$("btnRevMostrar").onclick = () => { revMostra = true; revRender(); };
$("btnRevProx").onclick = () => { revIdx++; revMostra = false; revRender(); };
$("btnRevPrev").onclick = () => { revIdx--; revMostra = false; revRender(); };
$("btnRevFechar").onclick = () => $("dlgRevisao").close();

/* ------------------- novo cartão guiado (modelos) ------------------- */

const MODELOS = {
  qa:    { pt: ["O que é ... ?", "Resposta direta e curta.", "tema"],
           en: ["What is ... ?", "Short, direct answer.", "topic"] },
  def:   { pt: ["Defina: TERMO", "Definição clara em uma frase.", "definicao"],
           en: ["Define: TERM", "Clear one-sentence definition.", "definition"] },
  cloze: { pt: ["A {{c1::resposta}} completa esta frase.", "Observação opcional.", "tema"],
           en: ["The {{c1::answer}} completes this sentence.", "Optional note.", "topic"] },
  law:   { pt: ["O que diz o art. X da Lei Y?", "Núcleo do artigo, resumido com suas palavras.", "lei_y"],
           en: ["What does article X of Law Y say?", "Core of the article, in your own words.", "law_y"] },
  juris: { pt: ["Tema/Súmula N (STF/STJ): qual a tese?", "Tese firmada, em linguagem direta.", "jurisprudencia"],
           en: ["Case N (Supreme Court): what is the holding?", "The holding, in plain language.", "case_law"] },
  mc:    { pt: ["Qual alternativa está correta sobre ... ?", "Explicação da resposta (opcional).", "tema"],
           en: ["Which option is correct about ... ?", "Answer explanation (optional).", "topic"] },
  mc_cloze: { pt: ["A capital da França é Paris.", "", "geografia"],
              en: ["The capital of France is Paris.", "", "geography"] },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function aplicarModelo() {
  const chaveM = $("selModelo").value;
  const m = MODELOS[chaveM][LANG] || MODELOS[chaveM].en;
  $("novoFrente").value = m[0];
  $("novoVerso").value = m[1];
  $("novoTags").value = m[2];
  $("mcArea").style.display = chaveM === "mc" ? "" : "none";
  $("mcClozeArea").style.display = chaveM === "mc_cloze" ? "" : "none";
  $("lacunaArea").style.display = chaveM === "cloze" ? "" : "none";
  $("dicaCampo").textContent = chaveM === "mc" ? t("hint_mc")
    : (chaveM === "mc_cloze" ? t("hint_mc_cloze") : "");
  if (chaveM === "mc_cloze") {
    $("mcCerta").value = "Paris";
    $("mcErr0").value = LANG === "pt" ? "Lyon" : "Lyon";
    $("mcErr1").value = LANG === "pt" ? "Marselha" : "Marseille";
    $("mcErr2").value = ""; $("mcErr3").value = "";
  }
  atualizarNovoPreview();
}

function rotularModelos() {
  const nomes = { qa: "tpl_qa", def: "tpl_def", cloze: "tpl_cloze",
                  law: "tpl_law", juris: "tpl_juris", mc: "tpl_mc",
                  mc_cloze: "tpl_mc_cloze" };
  [...$("selModelo").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}

/* Monta a linha de texto que o diálogo vai inserir no editor.
 * Retorna {linha} ou {erro} — usada pelo preview ao vivo E pelo Inserir. */
function montarLinhaNovo() {
  const modelo = $("selModelo").value;
  const verso = $("novoVerso").value.trim();
  const tags = parseTags($("novoTags").value);

  if (modelo === "mc_cloze") {
    const frase = $("novoFrente").value;
    const certa = $("mcCerta").value.trim();
    const erradas = ["mcErr0", "mcErr1", "mcErr2", "mcErr3"]
      .map((id) => $(id).value.trim()).filter(Boolean);
    if (!certa || !frase.includes(certa)) return { erro: t("mc_term_missing") };
    // posição da correta é estável (hash) para o preview não "dançar"
    const ops = erradas.slice();
    ops.splice(hashStr(certa + "|" + erradas.join("|")) % (erradas.length + 1), 0, certa);
    const front = frase.replace(certa, "{{c1::" + certa + "::" + ops.join("/") + "}}");
    const campos = [front];
    if (verso) campos.push(verso);
    else if (tags.length) campos.push("");
    if (tags.length) campos.push(tags.join(", "));
    return { linha: campos.join(" :: ") };
  }

  if (modelo === "mc") {
    const ops = ["mcOp0", "mcOp1", "mcOp2", "mcOp3", "mcOp4"]
      .map((id) => $(id).value.trim()).filter(Boolean);
    const correta = Math.min(parseInt($("mcCorreta").value, 10), Math.max(ops.length - 1, 0));
    const card = { kind: "mc", front: $("novoFrente").value.trim(), options: ops,
                   correct: correta, back: verso, tags };
    return { linha: cardToLine(card) };
  }

  const campos = [$("novoFrente").value.trim()];
  if (verso || !CLOZE_RE.test(campos[0])) campos.push(verso);
  if (tags.length) campos.push(tags.join(", "));
  return { linha: campos.join(" :: ") };
}

/* Pré-visualização em tempo real dentro do diálogo. */
function atualizarNovoPreview() {
  const alvo = $("novoPreview");
  alvo.innerHTML = "";
  const res = montarLinhaNovo();
  if (res.erro) {
    const e = document.createElement("div");
    e.className = "card suspeito";
    e.style.padding = "8px 11px";
    e.textContent = "(!) " + res.erro;
    alvo.append(e);
    return;
  }
  const r = parseText(res.linha, []);
  if (!r.cards.length) return;
  const div = document.createElement("div");
  div.className = "card" + (r.cards[0].issues.length ? " suspeito" : "");
  div.style.padding = "8px 11px";
  renderCorpoCartao(div, r.cards[0]);
  alvo.append(div);
}

$("btnNovoCartao").onclick = () => { rotularModelos(); aplicarModelo(); $("dlgNovo").showModal(); };
$("selModelo").onchange = aplicarModelo;
$("btnNovoFechar").onclick = () => $("dlgNovo").close();
$("btnMarcarNovo").onclick = () => { marcarLacuna($("novoFrente")); atualizarNovoPreview(); };
$("btnLimparNovo").onclick = () => { limparLacunas($("novoFrente")); atualizarNovoPreview(); };
["novoFrente", "novoVerso", "novoTags", "mcCerta", "mcErr0", "mcErr1", "mcErr2", "mcErr3",
 "mcOp0", "mcOp1", "mcOp2", "mcOp3", "mcOp4"].forEach((id) => {
  $(id).addEventListener("input", atualizarNovoPreview);
});
$("mcCorreta").addEventListener("change", atualizarNovoPreview);
$("btnInserir").onclick = () => {
  const res = montarLinhaNovo();
  if (res.erro) { alert(res.erro); return; }
  const atual = $("editor").value.replace(/\s+$/, "");
  $("editor").value = (atual ? atual + "\n\n" : "") + res.linha + "\n";
  $("dlgNovo").close();
  preview();
};
document.querySelectorAll(".ic-ajuda[data-hint]").forEach((b) => {
  b.onclick = () => { $("dicaCampo").textContent = t(b.dataset.hint); };
});


/* -------------- prompt de IA na tela principal ---------------------- */

let promptAtivo = "prompt_full";

function mostrarPrompt(tipo) {
  promptAtivo = tipo;
  $("promptTexto").value = t(tipo);              // usuário VÊ o texto que copiará
  $("btnTabFull").classList.toggle("ativa", tipo === "prompt_full");
  $("btnTabMini").classList.toggle("ativa", tipo === "prompt_mini");
}

$("btnPromptIA").onclick = () => { mostrarPrompt(promptAtivo); $("dlgPrompt").showModal(); };
$("btnTabFull").onclick = () => mostrarPrompt("prompt_full");
$("btnTabMini").onclick = () => mostrarPrompt("prompt_mini");
$("btnPromptFechar").onclick = () => $("dlgPrompt").close();
$("btnPromptCopiar").onclick = async () => {
  await navigator.clipboard.writeText($("promptTexto").value);
  $("btnPromptCopiar").textContent = t("copied");
  setTimeout(() => { $("btnPromptCopiar").textContent = t("prompt_copy"); }, 2000);
  $("status").textContent = t("prompt_copied_status");
};

/* ------- embaralhar alternativas (a correta acompanha a troca) ------- */

$("btnEmbaralhar").onclick = () => {
  const ids = ["mcOp0", "mcOp1", "mcOp2", "mcOp3", "mcOp4"];
  const preenchidos = ids.map((id) => $(id).value.trim()).filter(Boolean);
  if (preenchidos.length < 2) return;
  const corretaTxt = preenchidos[Math.min(parseInt($("mcCorreta").value, 10),
                                          preenchidos.length - 1)];
  for (let i = preenchidos.length - 1; i > 0; i--) {   // Fisher-Yates
    const j = Math.floor(Math.random() * (i + 1));
    [preenchidos[i], preenchidos[j]] = [preenchidos[j], preenchidos[i]];
  }
  ids.forEach((id, i) => { $(id).value = preenchidos[i] || ""; });
  $("mcCorreta").value = preenchidos.indexOf(corretaTxt);   // segue a correta
  atualizarNovoPreview();
};

/* ----------------------------- eventos ----------------------------- */

$("selIdioma").value = LANG;
$("selIdioma").onchange = () => {
  const exemploAntigo = t("example").trim();
  setLanguage($("selIdioma").value);
  if ($("editor").value.trim() === exemploAntigo) $("editor").value = t("example");
  aplicarTextos(); preview();
};
$("deck").oninput = () => { atualizarDestino(); };
$("tags").oninput = agendarPreview;
$("editor").oninput = () => { renderDestaque(); agendarPreview(); };
$("editor").onscroll = () => { $("editorHl").scrollTop = $("editor").scrollTop; $("editorHl").scrollLeft = $("editor").scrollLeft; };
$("btnNormalizar").onclick = normalizar;
$("btnMCRapido").onclick = () => {
  rotularModelos();
  $("selModelo").value = "mc_cloze";
  aplicarModelo();
  $("dlgNovo").showModal();
};
$("btnTxt").onclick = exportarTxt;
$("btnApkg").onclick = exportarApkg;
$("btnAjuda").onclick = () => $("dlgAjuda").showModal();
$("btnFechar").onclick = () => $("dlgAjuda").close();
$("btnCaminho").onclick = async () => {
  await navigator.clipboard.writeText(nomeDeck());
  $("btnCaminho").textContent = t("copy_path_done");
  setTimeout(() => { $("btnCaminho").textContent = t("copy_path_btn"); }, 2000);
  $("status").textContent = t("copy_path_status");
};
function copiarPrompt(btn, key) {
  navigator.clipboard.writeText(t(key));
  const rotulo = btn.textContent;
  btn.textContent = t("copied");
  setTimeout(() => { btn.textContent = rotulo; }, 2000);
}
$("btnPromptFull").onclick = () => copiarPrompt($("btnPromptFull"), "prompt_full");
$("btnPromptMini").onclick = () => copiarPrompt($("btnPromptMini"), "prompt_mini");

/* ------------------------------ start ------------------------------ */

$("editor").value = t("example");
aplicarTextos();
preview();
