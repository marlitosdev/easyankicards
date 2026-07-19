/* EasyAnkiCards PWA — camada de interface.
 * Toda a lógica de negócio vive em parser.js/anki.js; textos em i18n.js. */

const VERSAO = "5.3.0";
const $ = (id) => document.getElementById(id);
let excluidos = new Set();          // chaves "linha|frente" desmarcadas
let ultimoResult = null;
let previewTimer = null;
let editando = null;                 // chave do cartão em edição inline

/* Reescreve TODO o editor a partir da lista de cartões (fonte única de
 * verdade continua sendo o texto). Usado ao salvar edição/excluir cartão. */
function reescreverEditor(cards, warnings) {
  const blocos = cards.map((c) => {
    const campos = [c.front];
    if (c.back || c.kind === "basic") campos.push(c.back);
    if (c.tags.length) campos.push(c.tags.join(", "));
    return campos.join(" :: ");
  });
  let texto = blocos.join("\n\n");
  if (warnings && warnings.length)
    texto += "\n\n" + t("norm_ignored_header") + "\n" + warnings.map((w) => "# " + w).join("\n");
  $("editor").value = texto + "\n";
}

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

function preview() {
  const r = parseAtual();
  ultimoResult = r;
  const box = $("cartoes");
  box.innerHTML = "";

  r.cards.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "card" + (c.issues.length ? " suspeito" : "");
    const titulo = "#" + (idx + 1) + " · " + t(c.kind === "cloze" ? "card_cloze" : "card_basic")
      + " · " + t("card_line") + " " + c.line
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
      montarEdicao(div, c, r, idx);
    } else {
      const f = document.createElement("div");
      f.className = "frente"; f.textContent = c.front; div.append(f);
      if (c.back) { const v = document.createElement("div"); v.className = "verso"; v.textContent = c.back; div.append(v); }
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

function montarEdicao(div, c, r, idx) {
  const inFrente = campoEditavel(div, "field_front", "hint_front", c.front, true);
  const inVerso  = campoEditavel(div, "field_back", "hint_back", c.back, true);
  const inTags   = campoEditavel(div, "field_tags", "hint_tags", c.tags.join(", "), false);

  const acoes = document.createElement("div");
  acoes.className = "acoes";
  const bSalvar = document.createElement("button");
  bSalvar.className = "btn btn-verde"; bSalvar.textContent = t("save_btn");
  bSalvar.onclick = () => {
    r.cards[idx] = Object.assign({}, c, {
      front: inFrente.value.trim(),
      back: inVerso.value.trim(),
      tags: parseTags(inTags.value),
    });
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    $("status").textContent = t("edited_status");
    preview();
  };
  const bCancelar = document.createElement("button");
  bCancelar.className = "btn btn-cinza"; bCancelar.textContent = t("cancel_btn");
  bCancelar.onclick = () => { editando = null; preview(); };
  const bExcluir = document.createElement("button");
  bExcluir.className = "btn"; bExcluir.style.background = "#b91c1c";
  bExcluir.textContent = t("delete_btn");
  bExcluir.onclick = () => {
    r.cards.splice(idx, 1);
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    $("status").textContent = t("deleted_status");
    preview();
  };
  acoes.append(bSalvar, bCancelar, bExcluir);
  div.append(acoes);
}

/* --------------------------- normalizar ---------------------------- */

function normalizar() {
  const r = parseText($("editor").value, []);   // sem tags globais: não gravar no texto
  if (!r.cards.length && !r.warnings.length) return;
  const blocos = r.cards.map((c) => {
    const campos = [c.front];
    if (c.back || c.kind === "basic") campos.push(c.back);
    if (c.tags.length) campos.push(c.tags.join(", "));
    return campos.join(" :: ");
  });
  let texto = blocos.join("\n\n");
  if (r.warnings.length)
    texto += "\n\n" + t("norm_ignored_header") + "\n" + r.warnings.map((w) => "# " + w).join("\n");
  $("editor").value = texto + "\n";
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
  if (n.toLowerCase() === "collection") n = "deck";   // nome reservado do Anki
  return n;
}

async function entregar(bytes, nome, mime) {
  const file = new File([bytes], nome, { type: mime });
  // Celular: folha de compartilhamento (abrir direto no AnkiDroid)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  // Desktop/fallback: download
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
  juris: { pt: ["Tema/Súmula N (STF/STJ): qual a tese?", "Tese firmada, em linguagem direta. Ex.: 'É constitucional...'", "jurisprudencia"],
           en: ["Case N (Supreme Court): what is the holding?", "The holding, in plain language.", "case_law"] },
};

function aplicarModelo() {
  const m = MODELOS[$("selModelo").value][LANG] || MODELOS[$("selModelo").value].en;
  $("novoFrente").value = m[0];
  $("novoVerso").value = m[1];
  $("novoTags").value = m[2];
}

function rotularModelos() {
  const nomes = { qa: "tpl_qa", def: "tpl_def", cloze: "tpl_cloze", law: "tpl_law", juris: "tpl_juris" };
  [...$("selModelo").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}

$("btnNovoCartao").onclick = () => { rotularModelos(); aplicarModelo(); $("dlgNovo").showModal(); };
$("selModelo").onchange = aplicarModelo;
$("btnNovoFechar").onclick = () => $("dlgNovo").close();
$("btnInserir").onclick = () => {
  const campos = [$("novoFrente").value.trim()];
  const verso = $("novoVerso").value.trim();
  const tags = parseTags($("novoTags").value);
  if (verso || !CLOZE_RE.test(campos[0])) campos.push(verso);
  if (tags.length) campos.push(tags.join(", "));
  const linha = campos.join(" :: ");
  const atual = $("editor").value.replace(/\s+$/, "");
  $("editor").value = (atual ? atual + "\n\n" : "") + linha + "\n";
  $("dlgNovo").close();
  preview();
};
document.querySelectorAll(".ic-ajuda[data-hint]").forEach((b) => {
  b.onclick = () => { $("dicaCampo").textContent = t(b.dataset.hint); };
});

/* ------------------------------ start ------------------------------ */

$("editor").value = t("example");
aplicarTextos();
preview();
