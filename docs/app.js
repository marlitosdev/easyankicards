/* EasyAnkiCards PWA — camada de interface (v5.4).
 * Lógica de negócio em parser.js/anki.js; textos em i18n.js.
 * Novidades: múltipla escolha [MC], marcar/limpar lacunas cloze por
 * seleção, análise do texto com críticas e correções automáticas. */

const VERSAO = "7.4.0";
const $ = (id) => document.getElementById(id);
let excluidos = new Set();
let ultimoResult = null;
let previewTimer = null;
let editando = null;
let cardDivs = [];            // [{line, div}] da última renderização
let respostasFechadas = new Set();  // por padrão TODOS mostram a resposta
let flashLinha = null;        // linha do editor que deve piscar no painel direito



/* --------------- aviso curto de confirmação (toast) ----------------- */

let toastTimer = null;

function toast(chave) {
  const el = $("toast");
  el.textContent = t(chave);
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 1800);
}

/* ------------- balão de dica universal (hover / toque longo) -------- */

let tipBox = null;

function tipShow(el, texto) {
  tipHide();
  tipBox = document.createElement("div");
  tipBox.className = "tipbox";
  tipBox.textContent = texto();
  document.body.append(tipBox);
  const r = el.getBoundingClientRect();
  const top = r.bottom + 8 + tipBox.offsetHeight > innerHeight
    ? r.top - tipBox.offsetHeight - 8 : r.bottom + 8;
  tipBox.style.top = Math.max(6, top) + "px";
  tipBox.style.left = Math.max(6, Math.min(r.left, innerWidth - tipBox.offsetWidth - 8)) + "px";
}

function tipHide() { if (tipBox) { tipBox.remove(); tipBox = null; } }

function attachTip(el, keyOrFn) {
  const texto = typeof keyOrFn === "function" ? keyOrFn : () => t(keyOrFn);
  let hoverTimer = null, pressTimer = null;
  el.addEventListener("mouseenter", () => {
    hoverTimer = setTimeout(() => tipShow(el, texto), 420);
  });
  el.addEventListener("mouseleave", () => { clearTimeout(hoverTimer); tipHide(); });
  el.addEventListener("mousedown", () => { clearTimeout(hoverTimer); tipHide(); });
  el.addEventListener("touchstart", () => {
    pressTimer = setTimeout(() => tipShow(el, texto), 500);
  }, { passive: true });
  el.addEventListener("touchend", () => {
    clearTimeout(pressTimer);
    setTimeout(tipHide, 1600);
  });
}


/* ------------------------------ temas ------------------------------- */

function aplicarTema(v) {
  if (v === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = v;
  localStorage.setItem("eac_theme", v);
  aplicarCorLetra(localStorage.getItem("eac_cor") || "");   // preserva a escolha
}

/* Cor da letra definida pelo usuário: sobrepõe a cor do tema em todo o
 * app (inclusive na camada colorida do editor, que herda --texto). */
function aplicarCorLetra(cor) {
  if (cor) document.documentElement.style.setProperty("--texto", cor);
  else document.documentElement.style.removeProperty("--texto");
}

function rotularTemas() {
  const nomes = { auto: "theme_auto", light: "theme_light",
                  dark: "theme_dark", black: "theme_black" };
  [...$("selTema").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}

/* ------------------------- textos estáticos ------------------------- */

function aplicarTextos() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $("versao").textContent = "v" + VERSAO;
  $("tagsExp").placeholder = t("tags_placeholder");
  $("deckExp").placeholder = t("deck_placeholder");
  $("tituloExp").placeholder = t("title_ph");
  $("ajudaTexto").textContent = t("help_text");
  rotularTemas();
  rotularPrevia();
  rotularEstilos();
  atualizarDestino();
}

/* --------------------------- destino Anki --------------------------- */

function nomeDeck() { return $("deckExp").value.trim() || "Meu Baralho"; }

/* Título impresso no topo dos cartões. Vazio = sem cabeçalho.
 * Não herda o nome do baralho: quem quiser usá-lo tem o botão
 * "Usar o nome do baralho" ao lado do campo. */
function tituloCartao() {
  return $("tituloExp").value.trim();
}

function atualizarDestino() {
  const partes = nomeDeck().split("::").map((p) => p.trim()).filter(Boolean);
  $("destinoExp").textContent = partes.length > 1
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
    const etiqueta = document.createElement("span");
    etiqueta.className = "chip-tag";
    if (hint && hint.includes("/")) {
      chip.className = "chip-ops";
      chip.title = t("chip_options_title");
      etiqueta.textContent = t("chip_options") + ":";
      chip.append(etiqueta);
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
      chip.title = t("chip_hidden_title");
      etiqueta.textContent = t("chip_hidden") + ":";
      chip.append(etiqueta, document.createTextNode(ans + (hint ? "  (" + hint + ")" : "")));
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
  } else if (c.back && (!c.ocultarVerso)) {
    const v = document.createElement("div"); v.className = "verso"; v.textContent = c.back; div.append(v);
  }
  if (c.tags.length) { const tg = document.createElement("div"); tg.className = "tags"; tg.textContent = t("tags_prefix") + c.tags.join(", "); div.append(tg); }
  if (c.more) {
    const m = document.createElement("div");
    m.className = "mais";
    const cab = document.createElement("div");
    cab.className = "mais-cab"; cab.textContent = t("more_label");
    const txt = document.createElement("div");
    txt.textContent = c.more.replace(/<br>/g, "  ");
    m.append(cab, txt);
    div.append(m);
  }
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
  const globais = $("tagsExp").value.trim() ? parseTags($("tagsExp").value) : [];
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
  cardDivs = [];

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
    chk.title = t("tip_incluir");
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
      if (modoPrevia() === "anki") {
        renderCartaoEstilizado(div, c, !respostasFechadas.has(chave(c)));
        c.issues.forEach((i) => { const e = document.createElement("div"); e.className = "issue"; e.textContent = "(!) " + i; div.append(e); });
      } else {
        c.ocultarVerso = respostasFechadas.has(chave(c));
        renderCorpoCartao(div, c);
        delete c.ocultarVerso;
      }
      const acoes = document.createElement("div");
      acoes.className = "acoes";
      const bEd = document.createElement("button");
      bEd.className = "btn btn-cinza"; bEd.textContent = t("edit_btn");
      bEd.title = t("tip_editar");
      bEd.onclick = () => { editando = chave(c); preview(); };
      const bVer = document.createElement("button");
      const aberto = !respostasFechadas.has(chave(c));
      bVer.className = "btn btn-ciano";
      bVer.textContent = t(aberto ? "hide_answer_btn" : "show_answer_btn");
      bVer.onclick = () => {
        aberto ? respostasFechadas.add(chave(c)) : respostasFechadas.delete(chave(c));
        preview();
      };
      acoes.append(bEd, bVer);
      div.append(acoes);
    }
    box.append(div);
    cardDivs.push({ line: c.line, div });
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

  // pisca o cartão correspondente à posição de edição, para o usuário
  // ver imediatamente como a alteração ficou
  if (flashLinha !== null) {
    let alvo = null, alvoCard = null;
    cardDivs.forEach((cd) => { if (cd.line <= flashLinha) alvo = cd; });
    r.cards.forEach((c) => { if (c.line <= flashLinha) alvoCard = c; });
    if (alvo) {
      // rola apenas a barra de cartões (a página e o editor ficam parados)
      alvo.div.classList.add("flash");
      const cont = $("cartoes");
      cont.scrollTo({ top: Math.max(0, alvo.div.offsetTop - 24), behavior: "smooth" });
      setTimeout(() => alvo.div.classList.remove("flash"), 1900);
    }
    flashLinha = null;
  }
}

function selecionados(r) { return r.cards.filter((c) => !excluidos.has(chave(c))); }

function resumo(r) {
  let s = t("summary", { n: r.cards.length, b: r.nBasic, c: r.nCloze, sel: selecionados(r).length });
  if (r.nSuspicious) s += t("summary_verify", { n: r.nSuspicious });
  $("resumo").textContent = s;
  $("status").textContent = t("status_auto", { n: r.cards.length });
}


/* --------- prévia completa "como no Anki" (estilo escolhido) --------- */

function modoPrevia() { return localStorage.getItem("eac_previa") || "app"; }

function textoClozeResolvido(pai, texto, cor, mascarar) {
  const partes = texto.split(/(\{\{c\d+::[\s\S]*?\}\})/g);
  partes.forEach((p) => {
    const m = p.match(/^\{\{c\d+::([\s\S]*?)\}\}$/);
    if (!m) { pai.append(document.createTextNode(p)); return; }
    const inner = m[1].split("::");
    const ans = inner[0].trim(), dica = (inner[1] || "").trim();
    const opcoes = dica.includes("/")
      ? dica.split("/").map((s) => s.trim()).filter(Boolean) : null;

    // Lacuna COM alternativas: mostra todas as opções (como no Anki).
    // Ao revelar a resposta, a correta fica destacada e as outras apagadas.
    if (opcoes) {
      // alternativas longas ficam ilegíveis em linha: viram lista A) B) C)
      const longas = opcoes.some((o) => o.length > 24);
      const cx = document.createElement(longas ? "div" : "span");
      cx.style.cssText = longas
        ? "border:1px dashed " + cor + ";border-radius:6px;padding:5px 8px;margin:4px 0"
        : "border:1px dashed " + cor + ";border-radius:6px;padding:1px 5px;margin:0 2px;white-space:normal";
      opcoes.forEach((op, i) => {
        const so = document.createElement(longas ? "div" : "span");
        so.textContent = (longas ? letra(i) + ") " : "") + op;
        if (mascarar) so.style.color = cor;
        else if (op === ans) so.style.cssText = "color:" + cor + ";font-weight:800;text-decoration:underline";
        else so.style.cssText = "opacity:.35;text-decoration:line-through";
        cx.append(so);
        if (!longas && i < opcoes.length - 1) cx.append(document.createTextNode("  /  "));
      });
      pai.append(cx);
      return;
    }

    const b = document.createElement("b");
    b.style.color = cor;
    b.textContent = mascarar ? (dica ? "[" + dica + "]" : "[...]") : ans;
    pai.append(b);
  });
}

function renderCartaoEstilizado(div, c, mostrarResposta) {
  const p = PALETAS[localStorage.getItem("eac_style") || "classic"] || PALETAS.classic;
  const wrap = document.createElement("div");
  wrap.style.cssText = "background:" + p.fundo + ";padding:10px;border-radius:10px;color:" + p.texto;
  const sombra = "box-shadow:1px 2px 4px rgba(0,0,0,.3);";
  const deckNome = c.titulo || (localStorage.getItem("eac_titulo") || "");

  if (p.cab && deckNome) {
    const pill = document.createElement("div");
    pill.textContent = deckNome;
    pill.style.cssText = "background:" + p.cab + ";color:#fff;font-weight:700;" +
      "text-align:center;padding:6px;border-radius:11px;font-size:13.5px;margin-bottom:6px;" + sombra;
    wrap.append(pill);
  }
  if (p.sub && c.tags.length) {
    const sub = document.createElement("div");
    sub.textContent = c.tags.join("  ·  ");
    sub.style.cssText = "background:" + p.sub + ";color:" + p.texto +
      ";font-style:italic;text-align:center;font-size:10.5px;padding:4px;" +
      "border-radius:" + (deckNome ? "9px 9px 0 0" : "9px") + ";" + sombra;
    wrap.append(sub);
  }

  const rot1 = document.createElement("div");
  rot1.className = "lado-rotulo"; rot1.textContent = t("lado_frente");
  rot1.style.color = p.texto;
  wrap.append(rot1);
  const frente = document.createElement("div");
  frente.style.cssText = "background:" + p.caixa + ";color:" + p.texto +
    ";padding:12px;text-align:justify;font-size:13.5px;" + sombra;
  textoClozeResolvido(frente, c.front, p.destaque, !mostrarResposta);
  if (c.kind === "mc") {
    c.options.forEach((o, i) => {
      const li = document.createElement("div");
      li.textContent = letra(i) + ") " + o;
      frente.append(document.createElement("br"), li);
    });
  }
  wrap.append(frente);

  if (!mostrarResposta) return;   // verso só quando o usuário pedir
  const temVerso = c.kind === "mc" || (!CLOZE_RE.test(c.front) && c.back);
  const rot2 = document.createElement("div");
  rot2.className = "lado-rotulo"; rot2.textContent = t("lado_verso");
  rot2.style.color = p.texto;
  if (temVerso) wrap.append(rot2);
  const verso = document.createElement("div");
  verso.style.cssText = "background:" + p.caixa + ";padding:10px;text-align:center;" +
    "font-weight:700;font-size:14px;color:" + p.destaque + ";" + sombra;
  if (c.kind === "mc") verso.textContent = "✔ " + letra(c.correct) + ") " + (c.options[c.correct] || "");
  else if (CLOZE_RE.test(c.front)) verso.textContent = "";
  else verso.textContent = c.back;
  if (temVerso) wrap.append(verso);
  if (c.more) {
    const sm = document.createElement("div");
    sm.style.cssText = "background:" + (p.sub || p.caixa) + ";color:" + p.destaque +
      ";text-align:center;padding:8px;border-radius:20px;margin-top:10px;" +
      "font-weight:700;font-size:12px;letter-spacing:.5px;" + sombra;
    sm.textContent = "✚ " + t("more_label");
    const cont = document.createElement("div");
    cont.style.cssText = "background:" + p.caixa + ";color:" + p.texto +
      ";padding:10px;text-align:justify;font-size:12px;margin-top:5px;border-radius:9px;" + sombra;
    cont.textContent = c.more.replace(/<br>/g, "  ");
    wrap.append(sm, cont);
  }
  if ((c.kind === "mc" || CLOZE_RE.test(c.front)) && c.back) {
    const just = document.createElement("div");
    just.style.cssText = "background:" + p.caixa + ";color:" + p.texto +
      ";padding:10px;text-align:justify;font-size:12.5px;margin-top:6px;" +
      "border-radius:0 0 11px 11px;" + sombra;
    just.textContent = c.back;
    wrap.append(just);
  }
  div.append(wrap);
}


/* ---------------- conversão de tipo durante a edição ---------------- */

/* Mostra os três tipos como botões; o atual fica destacado. Trocar
 * converte o cartão na hora, aproveitando o texto já escrito, e reabre
 * o editor no formato novo (o texto do editor continua sendo a fonte). */
function barraTipo(div, c, r, idx, lerCampos) {
  const lbl = document.createElement("span");
  lbl.className = "mini-lbl";
  lbl.textContent = t("convert_label") + " ";
  const aj = document.createElement("button");
  aj.className = "ic-ajuda"; aj.type = "button"; aj.textContent = "?";
  aj.onclick = () => alert(t("convert_hint"));
  lbl.append(aj);
  const linha = document.createElement("div");
  linha.className = "tipo-linha";
  [["basic", "type_basic", "btn-cinza"], ["cloze", "type_cloze", "btn-azul"],
   ["mc", "type_mc", "btn-roxo"]].forEach(([tipo, chaveRot, cor]) => {
    const b = document.createElement("button");
    b.className = "btn " + cor + (tipoAtual(c) === tipo ? " ativa" : "");
    b.textContent = t(chaveRot);
    b.onclick = () => converterTipo(c, r, idx, tipo, lerCampos());
    linha.append(b);
  });
  div.append(lbl, linha);
}

function tipoAtual(c) {
  if (c.kind === "mc") return "mc";
  return CLOZE_RE.test(c.front) ? "cloze" : "basic";
}

function semLacunas(txt) {
  return txt.replace(/\{\{c\d+::([\s\S]*?)\}\}/g, (m, i) => i.split("::")[0]);
}

function primeiraLacuna(txt) {
  const m = txt.match(/\{\{c\d+::([\s\S]*?)\}\}/);
  return m ? m[1].split("::")[0].trim() : "";
}

/* Conversão entre tipos: mostra em palavras simples o que vai acontecer
 * (com o antes/depois quando cabe) e só converte após confirmação. */
function converterTipo(c, r, idx, destino, campos) {
  if (destino === tipoAtual(c)) return;
  const novo = Object.assign({}, c, campos);

  if (destino === "cloze") {
    // Múltipla escolha -> lacuna COM as alternativas embutidas:
    // {{c1::correta::op1/op2/op3}} — o aluno vê as opções na frente e,
    // ao virar, só a correta permanece (sintaxe nativa do Anki).
    if (novo.kind === "mc") {
      const ops = (novo.options || []).map((o) => (o || "").trim()).filter(Boolean);
      if (ops.length < 2) { alert(t("conv_mc_need_ops")); return; }
      const certa = ops[Math.min(novo.correct || 0, ops.length - 1)];
      const lacuna = "{{c1::" + certa + "::" + ops.join(" / ") + "}}";
      const base = semLacunas(novo.front).trim();
      const frente = base.includes(certa)
        ? base.replace(certa, lacuna)
        : base.replace(/\s*[.?!]+\s*$/, "") + " " + lacuna + ".";
      if (!confirm(t("conv_mc_to_cloze", { depois: frente }))) return;
      novo.front = frente;
      novo.back = novo.back || "";
      novo.kind = "cloze";
      delete novo.options; delete novo.correct;
      r.cards[idx] = novo;
      reescreverEditor(r.cards, r.warnings);
      reabrirEditor(idx);
      toast("toast_converted");
      return;
    }
    if (!CLOZE_RE.test(novo.front)) {
      const resp = (novo.back || "").trim();
      if (!resp) { alert(t("conv_need_back")); return; }
      const antes = novo.front.trim() + "  ::  " + resp;
      const frente = novo.front.trim().replace(/\s*[.?!]+\s*$/, "") +
                     " {{c1::" + resp + "}}.";
      if (!confirm(t("conv_to_cloze", { antes, depois: frente }))) return;
      novo.front = frente;
      novo.back = "";
    }
    novo.kind = "cloze";
    delete novo.options; delete novo.correct;

  } else if (destino === "mc") {
    const correta = novo.kind === "mc"
      ? ((novo.options || [])[novo.correct] || "")
      : ((novo.back || "").trim() || primeiraLacuna(novo.front));
    if (!correta) { alert(t("conv_need_answer")); return; }
    if (!confirm(t("conv_to_mc", { resposta: correta }))) return;
    novo.front = semLacunas(novo.front);
    novo.options = [correta, ""];
    novo.correct = 0;
    novo.back = "";
    novo.kind = "mc";

  } else {
    const explica = t(novo.kind === "mc" ? "conv_basic_from_mc" : "conv_basic_from_cloze");
    if (!confirm(t("conv_to_basic", { explica }))) return;
    if (novo.kind === "mc") {
      novo.back = (novo.options || [])[novo.correct] || novo.back || "";
    } else if (CLOZE_RE.test(novo.front)) {
      if (!novo.back) novo.back = primeiraLacuna(novo.front);
      novo.front = semLacunas(novo.front);
    }
    novo.kind = "basic";
    delete novo.options; delete novo.correct;
  }

  r.cards[idx] = novo;
  reescreverEditor(r.cards, r.warnings);
  reabrirEditor(idx);
  toast("toast_converted");
}

/* Reabre o editor no mesmo cartão depois que o texto foi reescrito. */
function reabrirEditor(idx) {
  const novoR = parseAtual();
  editando = novoR.cards[idx] ? chave(novoR.cards[idx]) : null;
  preview();
}


/* Agrupa campos secundários num bloco recolhível — o editor cabe na tela
 * sem rolagem; o estado (aberto/fechado) fica lembrado. */
function grupoRecolhivel(div, temConteudo) {
  const cab = document.createElement("button");
  cab.type = "button";
  cab.className = "btn btn-cinza grupo-tog";
  const cont = document.createElement("div");
  const salvo = localStorage.getItem("eac_maisCampos");
  let aberto = salvo === null ? !!temConteudo : salvo === "1";
  const pintar = () => {
    cont.style.display = aberto ? "" : "none";
    cab.textContent = (aberto ? "▾  " : "▸  ") + t("more_fields");
  };
  cab.onclick = () => {
    aberto = !aberto;
    localStorage.setItem("eac_maisCampos", aberto ? "1" : "0");
    pintar();
  };
  pintar();
  div.append(cab, cont);
  return cont;
}

/* --------------------------- edição inline -------------------------- */

/* Faz o campo crescer conforme o usuário escreve, sempre com uma linha
 * de folga — começa compacto e nunca precisa de barra de rolagem. */
function autoCrescer(el) {
  const ajustar = () => {
    el.style.height = "auto";
    el.style.height = (el.scrollHeight + 22) + "px";   // ~1 linha de margem
  };
  el.addEventListener("input", ajustar);
  requestAnimationFrame(ajustar);
  return el;
}

function campoEditavel(pai, rotuloKey, hintKey, valor, multiline, opcoes) {
  opcoes = opcoes || {};
  const lbl = document.createElement("span");
  lbl.className = "mini-lbl";
  lbl.textContent = t(rotuloKey) + " ";
  const aj = document.createElement("button");
  aj.className = "ic-ajuda"; aj.type = "button"; aj.textContent = "?";
  const dica = document.createElement("div");
  // dicaVisivel: recursos menos óbvios (ex.: "Saiba mais") explicam-se sozinhos
  dica.style.cssText = "display:" + (opcoes.dicaVisivel ? "block" : "none") +
    ";font-size:11.5px;color:var(--sutil);margin-top:2px;line-height:1.35";
  dica.textContent = t(hintKey);
  aj.onclick = () => { dica.style.display = dica.style.display === "none" ? "block" : "none"; };
  lbl.append(aj);
  const campo = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) campo.type = "text";
  campo.value = valor;
  if (opcoes.grande) campo.classList.add("campo-grande");
  pai.append(lbl, dica, campo);
  if (multiline) autoCrescer(campo);
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
    toast("toast_deleted");
  };
  acoes.append(bS, bC, bX);
  div.append(acoes);
}

/* Lista as lacunas {{cN::...}} presentes num texto (uma entrada por N). */
function listarLacunas(txt) {
  const out = [];
  const re = /\{\{c(\d+)::([\s\S]*?)\}\}/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (out.some((l) => l.n === m[1])) continue;
    const inner = m[2].split("::");
    out.push({ n: m[1], ans: (inner[0] || "").trim(), hint: (inner[1] || "").trim() });
  }
  return out;
}

function montarEdicao(div, c, r, idx) {
  barraTipo(div, c, r, idx, () => ({
    front: inFrente.value.trim(), back: inVerso.value.trim(),
    more: inMais.value.trim().replace(/\n+/g, "<br>"),
    ownTags: parseTags(inTags.value), tags: parseTags(inTags.value),
    titulo: inTitulo.value.trim(),
  }));
  const inFrente = campoEditavel(div, "field_front", "hint_front", c.front, true);
  botoesLacuna(div, inFrente);          // marcar/limpar {{c1::...}} na seleção

  /* ---- Editor estruturado de lacunas: UM painel por cN ----
     Cada painel tem a resposta correta (editável) e o comportamento:
     ocultação simples OU múltipla escolha (com campos das erradas).
     Os painéis se reconstroem quando o texto da frente muda; o que o
     usuário digitou em cada painel é preservado pelo número da lacuna. */
  const estado = {};        // n -> {ans, mode, wrongs[], tocado}
  const lacWrap = document.createElement("div");
  div.append(lacWrap);
  let lacTimer = null;

  function construirPaineis() {
    lacWrap.innerHTML = "";
    const lacs = listarLacunas(inFrente.value);
    if (!lacs.length) return;
    const cab = document.createElement("span");
    cab.className = "mini-lbl";
    cab.textContent = t("edit_mc_label") + " ";
    const aj = document.createElement("button");
    aj.className = "ic-ajuda"; aj.type = "button"; aj.textContent = "?";
    aj.onclick = () => alert(t("hint_mc_cloze"));
    cab.append(aj);
    lacWrap.append(cab);

    lacs.forEach((l) => {
      let st = estado[l.n];
      if (!st || !st.tocado) {
        const ops = l.hint ? l.hint.split("/").map((s) => s.trim()).filter(Boolean) : [];
        st = estado[l.n] = {
          ans: l.ans,
          mode: l.hint.includes("/") ? "mc" : "occ",
          wrongs: ops.filter((o) => o !== l.ans),
          // posição da correta PRESERVADA (antes era re-sorteada a cada
          // gravação, mudando a ordem sem o usuário pedir)
          pos: Math.max(0, ops.indexOf(l.ans)),
          tocado: st ? st.tocado : false,
        };
      }
      const box = document.createElement("div");
      box.className = "lac-box";
      const tit = document.createElement("div");
      tit.className = "titulo-lac";
      tit.textContent = t("lacuna_label", { n: l.n });
      box.append(tit);

      const lblAns = document.createElement("span");
      lblAns.className = "mini-lbl";
      lblAns.textContent = t("lacuna_answer");
      const inAns = document.createElement("input");
      inAns.type = "text"; inAns.value = st.ans;
      inAns.oninput = () => { st.ans = inAns.value; st.tocado = true; };
      box.append(lblAns, inAns);

      const lblModo = document.createElement("span");
      lblModo.className = "mini-lbl";
      lblModo.textContent = t("lacuna_mode");
      const sel = document.createElement("select");
      sel.style.cssText = "width:100%;padding:6px;border-radius:6px;margin-top:2px";
      [["occ", t("mode_occ")], ["mc", t("mode_mc")]].forEach(([v, rot]) => {
        const op = document.createElement("option");
        op.value = v; op.textContent = rot;
        sel.append(op);
      });
      sel.value = st.mode;
      box.append(lblModo, sel);

      const wrongsDiv = document.createElement("div");
      wrongsDiv.style.display = st.mode === "mc" ? "" : "none";
      for (let i = 0; i < 4; i++) {
        const inp = document.createElement("input");
        inp.type = "text"; inp.placeholder = (i + 1);
        inp.value = st.wrongs[i] || "";
        inp.oninput = () => { st.wrongs[i] = inp.value; st.tocado = true; montarPos(); };
        wrongsDiv.append(inp);
      }
      // escolha explícita de onde a resposta correta aparece — com o
      // TEXTO real das alternativas, atualizando conforme o usuário digita
      const posLbl = document.createElement("span");
      posLbl.className = "mini-lbl"; posLbl.textContent = t("lac_pos");
      const posSel = document.createElement("select");
      posSel.style.cssText = "width:100%;padding:6px;border-radius:6px;margin-top:2px";
      const ordemPrev = document.createElement("div");
      ordemPrev.className = "lac-ordem";

      const montarPos = () => {
        const wr = st.wrongs.map((w) => (w || "").trim()).filter(Boolean);
        const total = wr.length + 1;
        st.pos = Math.max(0, Math.min(st.pos || 0, total - 1));
        posSel.innerHTML = "";
        for (let i = 0; i < total; i++) {
          const op = document.createElement("option");
          op.value = i;
          op.textContent = i === 0
            ? t("lac_pos_first", { op: wr[0] || "…" })
            : t("lac_pos_after", { n: i + 1, op: wr[i - 1] || "…" });
          posSel.append(op);
        }
        posSel.value = st.pos;
        // prévia da ordem final, com a correta destacada
        const lista = wr.slice();
        lista.splice(st.pos, 0, "\u0000");
        ordemPrev.innerHTML = "";
        ordemPrev.append(document.createTextNode(t("lac_pos_preview") + " "));
        lista.forEach((o, i) => {
          if (o === "\u0000") {
            const b = document.createElement("b");
            b.textContent = (st.ans || "…");
            ordemPrev.append(b);
          } else ordemPrev.append(document.createTextNode(o));
          if (i < lista.length - 1) ordemPrev.append(document.createTextNode("  /  "));
        });
      };

      posSel.onchange = () => { st.pos = parseInt(posSel.value, 10); st.tocado = true; montarPos(); };
      const bSort = document.createElement("button");
      bSort.type = "button"; bSort.className = "btn btn-ciano";
      bSort.style.cssText = "margin-top:5px;padding:4px 9px;font-size:11px";
      bSort.textContent = t("lac_shuffle");
      bSort.onclick = () => {
        const total = st.wrongs.filter(Boolean).length + 1;
        st.pos = Math.floor(Math.random() * total);
        st.tocado = true;
        montarPos();
        toast("toast_shuffled");
      };
      wrongsDiv.append(posLbl, posSel, bSort, ordemPrev);
      montarPos();
      box.append(wrongsDiv);

      // aviso de tamanho — recalculado a cada tecla digitada na resposta
      const aviso = document.createElement("div");
      aviso.className = "lac-aviso";
      const atualizarAviso = () => {
        const n = (st.ans || "").length;
        if (st.mode !== "mc") { aviso.style.display = "none"; return; }
        aviso.style.display = "";
        if (n > 60) { aviso.className = "lac-aviso bad"; aviso.textContent = "(!) " + t("lac_long_warn", { n }); }
        else if (n > 40) { aviso.className = "lac-aviso mid"; aviso.textContent = "(!) " + t("lac_warn_mid", { n }); }
        else { aviso.className = "lac-aviso ok"; aviso.textContent = "✓ " + t("lac_ok", { n }); }
      };
      box.insertBefore(aviso, wrongsDiv);
      atualizarAviso();
      inAns.addEventListener("input", () => { st.ans = inAns.value; atualizarAviso(); montarPos(); });
      st.atualizarAviso = atualizarAviso;
      sel.onchange = () => {
        st.mode = sel.value; st.tocado = true;
        wrongsDiv.style.display = st.mode === "mc" ? "" : "none";
        if (st.atualizarAviso) st.atualizarAviso();
      };
      lacWrap.append(box);
    });
  }
  construirPaineis();
  inFrente.addEventListener("input", () => {
    clearTimeout(lacTimer);
    lacTimer = setTimeout(construirPaineis, 500);
  });

  const sec = grupoRecolhivel(div,
    c.back || c.more || c.titulo || (c.ownTags !== undefined ? c.ownTags : c.tags).length);
  const inVerso = campoEditavel(sec, "field_back", "hint_back", c.back, true);
  const inMais = campoEditavel(sec, "field_more", "hint_more",
    (c.more || "").replace(/<br>/g, "\n"), true, { dicaVisivel: true, grande: true });
  const inTitulo = campoEditavel(sec, "field_title", "hint_title", c.titulo || "", false);
  // tags PRÓPRIAS (as globais entram na exportação, não são editadas aqui)
  const inTags = campoEditavel(sec, "field_tags", "hint_tags",
    (c.ownTags !== undefined ? c.ownTags : c.tags).join(", "), false);

  botoesSalvar(div, () => {
    let front = inFrente.value.trim();
    // reescreve CADA lacuna conforme o painel correspondente
    front = front.replace(/\{\{c(\d+)::([\s\S]*?)\}\}/g, (m0, n, inner) => {
      const st = estado[n];
      if (!st) return m0;
      const ans = (st.ans || inner.split("::")[0]).trim();
      if (!ans) return m0;
      if (st.mode === "mc") {
        const wr = (st.wrongs || []).map((w) => (w || "").trim())
          .filter((w) => w && w !== ans);
        if (wr.length) {
          // insere a correta exatamente na posição escolhida pelo usuário
          const lista = wr.slice();
          const pos = Math.max(0, Math.min(st.pos || 0, lista.length));
          lista.splice(pos, 0, ans);
          return "{{c" + n + "::" + ans + "::" + lista.join(" / ") + "}}";
        }
      }
      return "{{c" + n + "::" + ans + "}}";
    });
    r.cards[idx] = Object.assign({}, c, {
      kind: CLOZE_RE.test(front) ? "cloze" : "basic",
      front, back: inVerso.value.trim(),
      ownTags: parseTags(inTags.value), tags: parseTags(inTags.value),
      more: inMais.value.trim().replace(/\n+/g, "<br>"),
      titulo: inTitulo.value.trim(),
    });
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    flashLinha = 10 ** 9;   // será limitado ao último cartão <= linha
    flashLinha = r.cards[Math.min(idx, r.cards.length - 1)]
      ? r.cards[Math.min(idx, r.cards.length - 1)].line : null;
    $("status").textContent = t("edited_status");
    preview();
    toast("toast_edited");
  }, r, idx);
}

function montarEdicaoMC(div, c, r, idx) {
  barraTipo(div, c, r, idx, () => ({
    front: inFrente.value.trim(), back: inVerso.value.trim(),
    more: inMais.value.trim().replace(/\n+/g, "<br>"),
    ownTags: parseTags(inTags.value), tags: parseTags(inTags.value),
    titulo: inTitulo.value.trim(),
    options: inputs.map((i) => i.value.trim()).filter(Boolean),
    correct: (() => {
      let k = 0, achou = 0;
      inputs.forEach((inp, i) => {
        if (!inp.value.trim()) return;
        if (radios[i].checked) achou = k;
        k++;
      });
      return achou;
    })(),
  }));
  const inFrente = campoEditavel(div, "field_front", "hint_front", c.front, true);
  const lbl = document.createElement("span");
  lbl.className = "mini-lbl"; lbl.textContent = t("mc_mark_correct_inline") + " ";
  const aj = document.createElement("button");
  aj.className = "ic-ajuda"; aj.type = "button"; aj.textContent = "?";
  aj.onclick = () => alert(t("hint_mc"));
  lbl.append(aj);
  div.append(lbl);

  /* Marcador ⦿ ao lado de cada alternativa: quem cria aponta a correta
     no próprio campo, sem seletor separado (evita descompasso). */
  const inputs = [];
  const radios = [];
  const grupo = "mcr" + idx + "_" + Date.now();
  const ops = c.options.slice();
  while (ops.length < 4) ops.push("");
  ops.slice(0, 5).forEach((o, i) => {
    const linha = document.createElement("div");
    linha.className = "mc-row";
    const rd = document.createElement("input");
    rd.type = "radio"; rd.name = grupo;
    rd.checked = i === (c.correct || 0);
    rd.title = t("mc_correct");
    const tx = document.createElement("input");
    tx.type = "text"; tx.value = o; tx.placeholder = letra(i);
    linha.append(rd, tx);
    div.append(linha);
    inputs.push(tx);
    radios.push(rd);
  });
  const sel = {   // compatível com o restante do código
    get value() { const i = radios.findIndex((rd) => rd.checked); return i < 0 ? 0 : i; },
  };

  const sec = grupoRecolhivel(div,
    c.back || c.more || c.titulo || (c.ownTags !== undefined ? c.ownTags : c.tags).length);
  const inVerso = campoEditavel(sec, "field_back", "hint_back", c.back, true);
  const inMais = campoEditavel(sec, "field_more", "hint_more",
    (c.more || "").replace(/<br>/g, "\n"), true, { dicaVisivel: true, grande: true });
  const inTitulo = campoEditavel(sec, "field_title", "hint_title", c.titulo || "", false);
  // tags PRÓPRIAS (as globais entram na exportação, não são editadas aqui)
  const inTags = campoEditavel(sec, "field_tags", "hint_tags",
    (c.ownTags !== undefined ? c.ownTags : c.tags).join(", "), false);

  botoesSalvar(div, () => {
    // índice da correta considerando apenas as alternativas preenchidas
    const preenchidas = [];
    let correct = 0;
    inputs.forEach((inp, i) => {
      const v = inp.value.trim();
      if (!v) return;
      if (radios[i].checked) correct = preenchidas.length;
      preenchidas.push(v);
    });
    const options = preenchidas;
    r.cards[idx] = Object.assign({}, c, {
      front: inFrente.value.trim(), options, correct,
      back: inVerso.value.trim(),
      ownTags: parseTags(inTags.value), tags: parseTags(inTags.value),
      more: inMais.value.trim().replace(/\n+/g, "<br>"),
      titulo: inTitulo.value.trim(),
    });
    editando = null;
    reescreverEditor(r.cards, r.warnings);
    $("status").textContent = t("edited_status");
    preview();
    toast("toast_edited");
  }, r, idx);
}

/* ----------------------- normalizar / analisar ---------------------- */

/* Normalizar v6.1: PROPÕE as mudanças com antes/depois e o usuário
 * marca o que quer aplicar — nada muda sem decisão explícita. */
let normPlano = [];   // [{card, canon, mudou, chk}]

function abrirNormalizar() {
  const r = parseText($("editor").value, []);
  const lista = $("normLista");
  lista.innerHTML = "";
  normPlano = [];
  let mudancas = 0;

  r.cards.forEach((c) => {
    const canon = cardToLine(c);
    const mudou = (c.raw || "").replace(/\s+/g, " ").trim()
               !== canon.replace(/\s+/g, " ").trim();
    const item = { card: c, canon, mudou, chk: null };
    normPlano.push(item);
    if (!mudou) return;
    mudancas++;
    const div = document.createElement("div");
    div.className = "norm-item";
    const cab = document.createElement("div");
    cab.className = "cab-n";
    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = true;
    chk.style.cssText = "width:17px;height:17px";
    item.chk = chk;
    cab.append(chk, document.createTextNode(
      t("card_line") + " " + c.line));
    div.append(cab);
    const r1 = document.createElement("div");
    r1.className = "rot"; r1.textContent = t("norm_before");
    const antes = document.createElement("div");
    antes.className = "antes"; antes.textContent = c.raw || "";
    const r2 = document.createElement("div");
    r2.className = "rot"; r2.textContent = t("norm_after");
    const depois = document.createElement("div");
    depois.className = "depois"; depois.textContent = canon;
    div.append(r1, antes, r2, depois);
    lista.append(div);
  });

  normIgnorados = r.ignorados || [];
  if (!mudancas && !normIgnorados.length) {
    const ok = document.createElement("div");
    ok.style.cssText = "color:var(--sutil);font-size:13px";
    ok.textContent = t("norm_none");
    lista.append(ok);
  }
  $("dlgNormalizar").showModal();
}

let normIgnorados = [];

function aplicarNormalizacao() {
  const blocos = normPlano.map((it) =>
    (it.mudou && it.chk && it.chk.checked) ? it.canon : (it.card.raw || it.canon));
  let texto = blocos.join("\n\n");
  if (normIgnorados.length) {
    const comentar = $("chkNormWarn").checked;
    texto += "\n\n" + (comentar ? t("norm_ignored_header") + "\n" : "")
      + normIgnorados.map((i) => (comentar ? "# " : "") + i.texto).join("\n");
  }
  $("editor").value = texto + "\n";
  $("dlgNormalizar").close();
  $("status").textContent = t("applied_status");
  preview();
  toast("toast_normalized");
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
  toast("toast_exported");
  alert(t("txt_done_msg"));
}

async function exportarApkg() {
  const r = validar(); if (!r) return;
  $("status").textContent = "…";
  try {
    const bytes = await buildApkg(r.cards, nomeDeck(), $("selEstilo").value, tituloCartao());
    await entregar(bytes, nomeArquivo() + ".apkg", "application/octet-stream");
    $("status").textContent = t("status_saved", { f: nomeArquivo() + ".apkg" });
    toast("toast_exported");
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
  mc_cloze: { pt: ["A capital da França é ___.", "", "geografia"],
              en: ["The capital of France is ___.", "", "geography"] },
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* Embaralhamento com semente: a ordem só muda quando o usuário pede. */
let mcClozeSeed = 0;

function shuffleSeeded(arr, seed) {
  const a = arr.slice();
  let s = (seed >>> 0) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function aplicarModelo() {
  const chaveM = $("selModelo").value;
  const m = MODELOS[chaveM][LANG] || MODELOS[chaveM].en;
  $("novoFrente").value = m[0];
  $("novoVerso").value = m[1];
  $("novoTags").value = m[2];
  $("novoMais").value = "";
  $("mcArea").style.display = chaveM === "mc" ? "" : "none";
  $("mcClozeArea").style.display = chaveM === "mc_cloze" ? "" : "none";
  $("lacunaArea").style.display = chaveM === "cloze" ? "" : "none";
  $("lblFrente").textContent = chaveM === "mc_cloze" ? t("mc_sentence_label") : t("field_front");
  $("dicaCampo").textContent = chaveM === "mc" ? t("hint_mc")
    : (chaveM === "mc_cloze" ? t("hint_mc_cloze") : "");
  if (chaveM === "mc_cloze") {
    $("mcCerta").value = "Paris";
    $("mcErr0").value = "Lyon";
    $("mcErr1").value = LANG === "pt" ? "Marselha" : "Marseille";
    $("mcErr2").value = ""; $("mcErr3").value = "";
    mcClozeSeed = 0;
  }
  if (chaveM === "mc") { $("mcR0").checked = true; }
  atualizarNovoPreview();
}

function rotularModelos() {
  const nomes = { qa: "tpl_qa", def: "tpl_def", cloze: "tpl_cloze",
                  law: "tpl_law", juris: "tpl_juris", mc: "tpl_mc",
                  mc_cloze: "tpl_mc_cloze" };
  [...$("selModelo").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}

/* Alternativas preenchidas da lista + índice da marcada como correta. */
function lerAlternativas() {
  const preench = [];
  let correct = 0;
  for (let i = 0; i < 5; i++) {
    const v = $("mcOp" + i).value.trim();
    if (!v) continue;
    if ($("mcR" + i).checked) correct = preench.length;
    preench.push(v);
  }
  return { options: preench, correct };
}

/* Ordem das opções da MC na frase (correta + erradas, semeada). */
function opcoesCloze() {
  const certa = $("mcCerta").value.trim();
  const erradas = ["mcErr0", "mcErr1", "mcErr2", "mcErr3"]
    .map((id) => $(id).value.trim()).filter(Boolean);
  const seed = mcClozeSeed || hashStr(certa + "|" + erradas.join("|"));
  return { certa, erradas, ops: shuffleSeeded([certa].concat(erradas), seed) };
}

function montarLinhaNovo() {
  const modelo = $("selModelo").value;
  const verso = $("novoVerso").value.trim();
  const tags = parseTags($("novoTags").value);
  const mais = $("novoMais").value.trim().replace(/\n+/g, "<br>");
  const comMais = (linha) => mais ? linha + "\n+ " + mais.replace(/<br>/g, "\n+ ") : linha;

  if (modelo === "mc_cloze") {
    const frase = $("novoFrente").value;
    const { certa, ops } = opcoesCloze();
    if (!certa) return { erro: t("mc_term_missing") };
    const lacuna = "{{c1::" + certa + "::" + ops.join("/") + "}}";
    let front;
    if (frase.includes("___")) front = frase.replace("___", lacuna);
    else if (frase.includes(certa)) front = frase.replace(certa, lacuna);
    else return { erro: t("mc_term_missing") };
    const campos = [front];
    if (verso) campos.push(verso);
    else if (tags.length) campos.push("");
    if (tags.length) campos.push(tags.join(", "));
    return { linha: comMais(campos.join(" :: ")) };
  }

  if (modelo === "mc") {
    const { options, correct } = lerAlternativas();
    const card = { kind: "mc", front: $("novoFrente").value.trim(), options,
                   correct, back: verso, tags };
    return { linha: comMais(cardToLineBase(card)) };
  }

  const campos = [$("novoFrente").value.trim()];
  if (verso || !CLOZE_RE.test(campos[0])) campos.push(verso);
  if (tags.length) campos.push(tags.join(", "));
  return { linha: comMais(campos.join(" :: ")) };
}

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

/* Embaralhar (lista): valores trocam de campo e o rádio segue a correta. */
$("btnEmbaralhar").onclick = () => {
  const { options, correct } = lerAlternativas();
  if (options.length < 2) return;
  const corretaTxt = options[correct];
  const novaOrdem = shuffleSeeded(options, (Math.random() * 2 ** 31) | 0);
  for (let i = 0; i < 5; i++) {
    $("mcOp" + i).value = novaOrdem[i] || "";
    $("mcR" + i).checked = novaOrdem[i] === corretaTxt;
  }
  atualizarNovoPreview();
  toast("toast_shuffled");
};

/* Embaralhar (MC na frase): troca a semente da ordem das opções. */
$("btnEmbaralharCloze").onclick = () => {
  mcClozeSeed = (Math.random() * 2 ** 31) | 0;
  atualizarNovoPreview();
  toast("toast_shuffled");
};

["novoFrente", "novoVerso", "novoMais"].forEach((id) => autoCrescer($(id)));
$("btnNovoCartao").onclick = () => {
  rotularModelos(); aplicarModelo(); $("dlgNovo").showModal();
  ["novoFrente", "novoVerso", "novoMais"].forEach((id) => {
    const el = $(id); el.style.height = "auto"; el.style.height = (el.scrollHeight + 22) + "px";
  });
};
$("selModelo").onchange = aplicarModelo;
$("btnNovoFechar").onclick = () => $("dlgNovo").close();
$("btnMarcarNovo").onclick = () => { marcarLacuna($("novoFrente")); atualizarNovoPreview(); toast("toast_blank"); };
$("btnLimparNovo").onclick = () => { limparLacunas($("novoFrente")); atualizarNovoPreview(); toast("toast_blank_clear"); };
["novoFrente", "novoVerso", "novoTags", "novoMais", "mcCerta", "mcErr0", "mcErr1", "mcErr2", "mcErr3",
 "mcOp0", "mcOp1", "mcOp2", "mcOp3", "mcOp4"].forEach((id) => {
  $(id).addEventListener("input", atualizarNovoPreview);
});
for (let i = 0; i < 5; i++) $("mcR" + i).addEventListener("change", atualizarNovoPreview);

$("btnInserir").onclick = () => {
  const modelo = $("selModelo").value;
  // Sugestão ao finalizar: correta em 1º lugar? Oferece embaralhar.
  if (modelo === "mc") {
    const { options, correct } = lerAlternativas();
    if (options.length >= 2 && correct === 0 && confirm(t("shuffle_suggest")))
      $("btnEmbaralhar").onclick();
  } else if (modelo === "mc_cloze") {
    const { certa, ops } = opcoesCloze();
    if (ops.length >= 2 && ops[0] === certa && confirm(t("shuffle_suggest")))
      $("btnEmbaralharCloze").onclick();
  }
  const res = montarLinhaNovo();
  if (res.erro) { alert(res.erro); return; }
  const atual = $("editor").value.replace(/\s+$/, "");
  $("editor").value = (atual ? atual + "\n\n" : "") + res.linha + "\n";
  $("dlgNovo").close();
  preview();
  toast("toast_added");
};
document.querySelectorAll(".ic-ajuda[data-hint]").forEach((b) => {
  b.onclick = () => { $("dicaCampo").textContent = t(b.dataset.hint); };
});

/* -------------- prompt de IA na tela principal ---------------------- */

let promptAtivo = "prompt_full";

/* Os dois prompts são EDITÁVEIS. Se houver versão salva do usuário,
 * ela é carregada; "Restaurar" volta ao texto original do app. */
function chaveSalva(tipo) { return "eac_prompt_" + tipo; }

function mostrarPrompt(tipo) {
  promptAtivo = tipo;
  const salvo = localStorage.getItem(chaveSalva(tipo));
  $("promptTexto").value = salvo || t(tipo);
  $("promptDica").textContent = t("prompt_edit_hint")
    + (salvo ? "  (" + t("prompt_saved_badge") + ")" : "");
  $("btnPromptRestaurar").style.display = salvo ? "" : "none";
  $("btnTabFull").classList.toggle("ativa", tipo === "prompt_full");
  $("btnTabMini").classList.toggle("ativa", tipo === "prompt_mini");
}

$("btnPromptIA").onclick = () => { mostrarPrompt(promptAtivo); $("dlgPrompt").showModal(); };
$("btnTabFull").onclick = () => mostrarPrompt("prompt_full");
$("btnTabMini").onclick = () => mostrarPrompt("prompt_mini");
$("btnPromptSalvar").onclick = () => {
  localStorage.setItem(chaveSalva(promptAtivo), $("promptTexto").value);
  mostrarPrompt(promptAtivo);
  toast("toast_saved");
};
$("btnPromptRestaurar").onclick = () => {
  localStorage.removeItem(chaveSalva(promptAtivo));
  mostrarPrompt(promptAtivo);
  toast("toast_restored");
};
$("btnPromptFechar").onclick = () => $("dlgPrompt").close();
$("btnPromptCopiar").onclick = async () => {
  await navigator.clipboard.writeText($("promptTexto").value);
  toast("toast_copied");
  $("status").textContent = t("prompt_copied_status");
};

/* ----------------------------- eventos ----------------------------- */

$("selIdioma").value = LANG;
$("selIdioma").onchange = () => {
  const exemploAntigo = t("example").trim();
  setLanguage($("selIdioma").value);
  if ($("editor").value.trim() === exemploAntigo) $("editor").value = t("example");
  aplicarTextos(); preview();
};
$("tagsExp").addEventListener("input", agendarPreview);
$("editor").oninput = () => {
  flashLinha = $("editor").value.slice(0, $("editor").selectionStart).split("\n").length;
  renderDestaque();
  agendarPreview();
};
$("editor").onscroll = () => { $("editorHl").scrollTop = $("editor").scrollTop; $("editorHl").scrollLeft = $("editor").scrollLeft; };
$("btnNormalizar").onclick = abrirNormalizar;
$("btnNormAplicar").onclick = aplicarNormalizacao;
$("btnNormFechar").onclick = () => $("dlgNormalizar").close();
const temaSalvo = localStorage.getItem("eac_theme") || "auto";
aplicarTema(temaSalvo);
$("selTema").value = temaSalvo;
$("selTema").onchange = () => { aplicarTema($("selTema").value); toast("toast_theme"); };

const corSalva = localStorage.getItem("eac_cor") || "";
if (corSalva) { aplicarCorLetra(corSalva); $("corLetra").value = corSalva; }
else {
  // mostra no seletor a cor atual do tema, para o usuário partir dela
  $("corLetra").value = getComputedStyle(document.documentElement)
    .getPropertyValue("--texto").trim() || "#000000";
}
$("corLetra").oninput = () => {
  localStorage.setItem("eac_cor", $("corLetra").value);
  aplicarCorLetra($("corLetra").value);
};
$("corLetra").onchange = () => toast("toast_textcolor");
$("btnCorReset").onclick = () => {
  localStorage.removeItem("eac_cor");
  aplicarCorLetra("");
  $("corLetra").value = getComputedStyle(document.documentElement)
    .getPropertyValue("--texto").trim() || "#000000";
  toast("toast_textcolor_reset");
};
attachTip($("corLetra"), "tip_textcolor");
attachTip($("btnCorReset"), "textcolor_reset");
function rotularPrevia() {
  const nomes = { app: "preview_simple", anki: "preview_anki" };
  [...$("selPrevia").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}
$("selPrevia").value = modoPrevia();
$("selPrevia").onchange = () => {
  localStorage.setItem("eac_previa", $("selPrevia").value);
  preview();
};
attachTip($("selPrevia"), "preview_anki_hint");
attachTip($("selTema"), "tip_theme");
$("btnMCRapido").onclick = () => {
  rotularModelos();
  $("selModelo").value = "mc_cloze";
  aplicarModelo();
  $("dlgNovo").showModal();
};
/* Baralho e tags são pedidos NA HORA de exportar (diálogo), e lembrados. */
let exportTipo = "apkg";

/* Paletas dos estilos (apenas para o mini-preview dentro do diálogo). */
const PALETAS = {
  classic: { fundo: "#fdfdfd", texto: "#1a1a2e", cab: null, caixa: "#fdfdfd", destaque: "#0b6bcb", sub: null },
  esquema: { fundo: "#f2f3f6", texto: "#26344f", cab: "#26344f", caixa: "#ffffff", destaque: "#4eaed9", sub: "#d9d9d9" },
  dark:    { fundo: "#14161b", texto: "#e9ebf0", cab: "#3350a5", caixa: "#1f232b", destaque: "#7cc4ff", sub: "#2a2e37" },
  paper:   { fundo: "#f4ecd8", texto: "#3b2f1d", cab: "#8b5e34", caixa: "#fffaf0", destaque: "#b45309", sub: "#e7dcc3" },
};

function rotularEstilos() {
  const nomes = { classic: "style_classic", esquema: "style_esquema",
                  dark: "style_dark", paper: "style_paper" };
  [...$("selEstilo").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
  [...$("selEstiloPainel").options].forEach((o) => { o.textContent = t(nomes[o.value]); });
}

/* Mostra, em tempo real, o cabeçalho que será IMPRESSO em cada cartão:
 * a última parte do nome do baralho vira o título no topo. */
function atualizarAvisoTopo() {
  const estilo = $("selEstilo").value;
  const p = PALETAS[estilo] || PALETAS.classic;
  const titulo = tituloCartao();
  const box = $("avisoTopo");

  if (!p.cab) {   // estilo Clássico: não imprime cabeçalho
    $("avisoTopoTitulo").textContent = "";
    $("avisoTopoTexto").textContent = t("header_no_style");
    $("avisoTopoDemoLbl").textContent = "";
    $("avisoTopoDemo").innerHTML = "";
    $("avisoTopoTags").textContent = "";
    box.style.borderColor = "var(--borda)";
    box.style.background = "transparent";
    return;
  }

  box.style.borderColor = "var(--laranja-borda)";
  box.style.background = "var(--laranja-claro)";
  $("avisoTopoTitulo").textContent = t("header_warn_title");
  $("avisoTopoTexto").textContent = t("header_warn_text");
  $("avisoTopoDemoLbl").textContent = t("header_demo_label");

  const demo = $("avisoTopoDemo");
  demo.innerHTML = "";
  demo.style.cssText = "background:" + p.fundo + ";padding:8px;border-radius:8px";
  const pill = document.createElement("div");
  pill.textContent = titulo || t("header_empty");
  if (!titulo) pill.style.opacity = ".55";
  pill.style.cssText = "background:" + p.cab + ";color:#fff;font-weight:700;" +
    "text-align:center;padding:6px;border-radius:10px;font-size:13px;" +
    "box-shadow:1px 2px 3px rgba(0,0,0,.3);word-break:break-word";
  demo.append(pill);
  const tagsTxt = $("tagsExp").value.trim();
  if (p.sub) {
    const sub = document.createElement("div");
    sub.textContent = tagsTxt ? parseTags(tagsTxt).join("  ·  ") : "tags";
    sub.style.cssText = "background:" + p.sub + ";color:" + p.texto +
      ";font-style:italic;text-align:center;font-size:10px;padding:4px;" +
      "border-radius:8px 8px 0 0;margin-top:4px";
    demo.append(sub);
  }
  $("avisoTopoTags").textContent = t("header_tags_note");
}

function previewEstilo() {
  const p = PALETAS[$("selEstilo").value] || PALETAS.classic;
  const box = $("stylePreview");
  box.style.background = p.fundo;
  box.innerHTML = "";
  const mk = (txt, css) => {
    const d = document.createElement("div");
    d.textContent = txt;
    d.style.cssText = css;
    box.append(d);
  };
  if (p.cab && tituloCartao()) mk(tituloCartao(),
    "background:" + p.cab + ";color:#fff;font-weight:700;text-align:center;" +
    "padding:5px;border-radius:9px;font-size:13px;margin-bottom:5px;");
  if (p.sub) mk("tags", "background:" + p.sub + ";color:" + p.texto +
    ";font-style:italic;text-align:center;font-size:10px;padding:3px;" +
    "border-radius:8px 8px 0 0;");
  const frase = document.createElement("div");
  frase.style.cssText = "background:" + p.caixa + ";color:" + p.texto +
    ";padding:9px;font-size:12.5px;box-shadow:1px 2px 3px rgba(0,0,0,.25);";
  frase.append(document.createTextNode("A capital da França é "));
  const lac = document.createElement("b");
  lac.textContent = "[...]";
  lac.style.color = p.destaque;
  frase.append(lac, document.createTextNode("."));
  box.append(frase);
  $("styleHintTxt").textContent = t("style_hint");
  atualizarAvisoTopo();
}

function abrirExport(tipo) {
  exportTipo = tipo;
  atualizarDestino();
  rotularEstilos();
  previewEstilo();
  $("dlgExport").showModal();
}

$("btnTxt").onclick = () => abrirExport("txt");
$("btnApkg").onclick = () => abrirExport("apkg");
$("btnExportFechar").onclick = () => $("dlgExport").close();
$("btnExportConfirm").onclick = () => {
  localStorage.setItem("eac_deck", $("deckExp").value);
  localStorage.setItem("eac_tags", $("tagsExp").value);
  localStorage.setItem("eac_style", $("selEstilo").value);
  localStorage.setItem("eac_titulo", tituloCartao());
  $("dlgExport").close();
  (exportTipo === "txt" ? exportarTxt : exportarApkg)();
};
$("deckExp").addEventListener("input", () => { atualizarDestino(); atualizarAvisoTopo(); });
$("tagsExp").addEventListener("input", atualizarAvisoTopo);
$("tituloExp").addEventListener("input", () => {
  localStorage.setItem("eac_titulo", $("tituloExp").value.trim());
  atualizarAvisoTopo();
  if (modoPrevia() === "anki") preview();
});
$("btnTituloDeck").onclick = () => {
  const partes = nomeDeck().split("::").map((s) => s.trim()).filter(Boolean);
  $("tituloExp").value = partes.length ? partes[partes.length - 1] : "";
  localStorage.setItem("eac_titulo", $("tituloExp").value);
  atualizarAvisoTopo();
  if (modoPrevia() === "anki") preview();
};
$("ajudaTitulo").onclick = () => alert(t("title_hint"));
attachTip($("tituloExp"), "title_hint");
$("btnCaminhoExp").onclick = async () => {
  await navigator.clipboard.writeText(nomeDeck());
  $("btnCaminhoExp").textContent = t("copy_path_done");
  setTimeout(() => { $("btnCaminhoExp").textContent = t("copy_path_btn"); }, 2000);
};
$("deckExp").value = localStorage.getItem("eac_deck") || "Meu Baralho";
$("tagsExp").value = localStorage.getItem("eac_tags") || "";
const tituloSalvo = localStorage.getItem("eac_titulo");
if (tituloSalvo !== null) $("tituloExp").value = tituloSalvo;
$("selEstilo").value = localStorage.getItem("eac_style") || "classic";
$("selEstiloPainel").value = $("selEstilo").value;
function aplicarEstilo(v) {
  localStorage.setItem("eac_style", v);
  $("selEstilo").value = v;
  $("selEstiloPainel").value = v;
  // O estilo só é visível na prévia "Como no Anki" — troca sozinho para
  // que a escolha tenha efeito imediato (antes parecia não funcionar).
  if (v !== "classic" && modoPrevia() !== "anki") {
    localStorage.setItem("eac_previa", "anki");
    $("selPrevia").value = "anki";
  }
  previewEstilo();
  preview();
  toast("toast_style");
}
$("selEstilo").onchange = () => aplicarEstilo($("selEstilo").value);
$("selEstiloPainel").onchange = () => aplicarEstilo($("selEstiloPainel").value);
$("ajudaEstilo").onclick = () => alert(t("style_hint"));

$("btnAjuda").onclick = () => $("dlgAjuda").showModal();
$("btnFechar").onclick = () => $("dlgAjuda").close();

/* Dicas de funcionamento em TODOS os botões principais */
attachTip($("btnNovoCartao"), "tip_new");
attachTip($("btnMCRapido"), "tip_mc");
attachTip($("btnPromptIA"), "tip_prompt");
attachTip($("btnRevisar"), "tip_review");
attachTip($("btnNormalizar"), "normalize_tooltip");
attachTip($("btnTxt"), "export_txt_tooltip");
attachTip($("btnApkg"), "export_apkg_tooltip");
attachTip($("btnAjuda"), "help_tooltip");
attachTip($("selIdioma"), "tip_lang");
attachTip($("btnCaminhoExp"), "copy_path_tooltip");
attachTip($("btnEmbaralhar"), "shuffle_hint");
attachTip($("btnEmbaralharCloze"), "shuffle_hint");
attachTip($("btnMarcarNovo"), "hint_mark_blank");
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


/* ==================================================================
 * ATUALIZAÇÃO DO APLICATIVO (PWA instalada)
 * Detecta que uma versão nova foi publicada, avisa o usuário numa
 * faixa no topo e só troca quando ele confirmar — assim ninguém perde
 * o texto que está escrevendo. Verifica ao abrir, ao voltar para o
 * app e a cada 30 minutos.
 * ================================================================== */

let swReg = null;
let swEsperando = null;

function mostrarBarraUpdate(worker) {
  swEsperando = worker;
  $("updTitulo").textContent = t("update_title");
  $("updTexto").textContent = t("update_text");
  $("btnAtualizar").textContent = t("update_btn");
  $("btnDepois").textContent = t("update_later");
  $("barraUpdate").classList.add("on");
}

$("btnAtualizar").onclick = () => {
  $("barraUpdate").classList.remove("on");
  if (swEsperando) swEsperando.postMessage("SKIP_WAITING");
  else location.reload();
};
$("btnDepois").onclick = () => $("barraUpdate").classList.remove("on");

function vigiarInstalacao(reg) {
  const novo = reg.installing;
  if (!novo) return;
  novo.addEventListener("statechange", () => {
    // "installed" com controller existente = atualização pronta e esperando
    if (novo.state === "installed" && navigator.serviceWorker.controller)
      mostrarBarraUpdate(novo);
  });
}

async function procurarAtualizacao(manual) {
  if (!swReg) return;
  if (manual) toast("update_checking");
  try {
    await swReg.update();
    setTimeout(() => {
      if (swReg.waiting) mostrarBarraUpdate(swReg.waiting);
      else if (manual) toast("update_none");
    }, 1200);
  } catch (e) { /* offline: silencioso */ }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) mostrarBarraUpdate(reg.waiting);
    vigiarInstalacao(reg);
    reg.addEventListener("updatefound", () => vigiarInstalacao(reg));
    setInterval(() => procurarAtualizacao(false), 30 * 60 * 1000);
  }).catch(() => {});

  // troca concluída: recarrega uma única vez para carregar a versão nova
  let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });

  // ao voltar para o app (muito comum na PWA instalada), confere de novo
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") procurarAtualizacao(false);
  });
}

$("btnCheckUpdate").onclick = () => procurarAtualizacao(true);
