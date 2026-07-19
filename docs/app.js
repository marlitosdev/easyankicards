/* EasyAnkiCards PWA — camada de interface (v5.4).
 * Lógica de negócio em parser.js/anki.js; textos em i18n.js.
 * Novidades: múltipla escolha [MC], marcar/limpar lacunas cloze por
 * seleção, análise do texto com críticas e correções automáticas. */

const VERSAO = "5.4.0";
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
      const f = document.createElement("div");
      f.className = "frente"; f.textContent = c.front; div.append(f);
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

function analisar() {
  const raw = $("editor").value;
  const r = parseAtual();
  const crit = [];
  r.warnings.forEach((w) => crit.push("• " + w));
  const vistos = {};
  r.cards.forEach((c) => {
    if ((c.front + c.back).length > 220) crit.push("• " + t("crit_long", { n: c.line }));
    const k = c.front.toLowerCase().trim();
    if (vistos[k]) crit.push("• " + t("crit_dup", { a: vistos[k], b: c.line }));
    else vistos[k] = c.line;
    c.issues.forEach((i) => crit.push("• " + t("card_line") + " " + c.line + ": " + i));
  });
  if (temMarcadores(raw)) crit.push("• " + t("crit_bullets"));
  if (temParesSoltos(raw)) crit.push("• " + t("crit_pairs"));

  $("analiseLista").textContent = crit.length ? crit.join("\n\n") : t("analyze_ok");
  $("btnFixBullets").style.display = temMarcadores(raw) ? "" : "none";
  $("btnFixPairs").style.display = temParesSoltos(raw) ? "" : "none";
  $("dlgAnalise").showModal();
}

function aplicarFix(fn) {
  $("editor").value = fn($("editor").value);
  $("status").textContent = t("applied_status");
  preview();
  analisar();   // reabre com a situação atualizada
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
};

function aplicarModelo() {
  const chaveM = $("selModelo").value;
  const m = MODELOS[chaveM][LANG] || MODELOS[chaveM].en;
  $("novoFrente").value = m[0];
  $("novoVerso").value = m[1];
  $("novoTags").value = m[2];
  $("mcArea").style.display = chaveM === "mc" ? "" : "none";
  $("lacunaArea").style.display = chaveM === "cloze" ? "" : "none";
  $("dicaCampo").textContent = chaveM === "mc" ? t("hint_mc") : "";
}

function rotularModelos() {
  const nomes = { qa: "tpl_qa", def: "tpl_def", cloze: "tpl_cloze",
                  law: "tpl_law", juris: "tpl_juris", mc: "tpl_mc" };
  [...$("selModelo").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}

$("btnNovoCartao").onclick = () => { rotularModelos(); aplicarModelo(); $("dlgNovo").showModal(); };
$("selModelo").onchange = aplicarModelo;
$("btnNovoFechar").onclick = () => $("dlgNovo").close();
$("btnMarcarNovo").onclick = () => marcarLacuna($("novoFrente"));
$("btnLimparNovo").onclick = () => limparLacunas($("novoFrente"));
$("btnInserir").onclick = () => {
  let linha;
  if ($("selModelo").value === "mc") {
    const ops = ["mcOp0", "mcOp1", "mcOp2", "mcOp3", "mcOp4"]
      .map((id) => $(id).value.trim()).filter(Boolean);
    const correta = Math.min(parseInt($("mcCorreta").value, 10), Math.max(ops.length - 1, 0));
    const card = { kind: "mc", front: $("novoFrente").value.trim(), options: ops,
                   correct: correta, back: $("novoVerso").value.trim(),
                   tags: parseTags($("novoTags").value) };
    linha = cardToLine(card);
  } else {
    const campos = [$("novoFrente").value.trim()];
    const verso = $("novoVerso").value.trim();
    const tags = parseTags($("novoTags").value);
    if (verso || !CLOZE_RE.test(campos[0])) campos.push(verso);
    if (tags.length) campos.push(tags.join(", "));
    linha = campos.join(" :: ");
  }
  const atual = $("editor").value.replace(/\s+$/, "");
  $("editor").value = (atual ? atual + "\n\n" : "") + linha + "\n";
  $("dlgNovo").close();
  preview();
};
document.querySelectorAll(".ic-ajuda[data-hint]").forEach((b) => {
  b.onclick = () => { $("dicaCampo").textContent = t(b.dataset.hint); };
});

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
$("editor").oninput = agendarPreview;
$("btnNormalizar").onclick = normalizar;
$("btnAnalisar").onclick = analisar;
$("btnAnaliseFechar").onclick = () => $("dlgAnalise").close();
$("btnFixBullets").onclick = () => aplicarFix(removerMarcadoresTexto);
$("btnFixPairs").onclick = () => aplicarFix(emparelharTexto);
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
