/* EasyAnkiCards PWA — camada de interface.
 *
 * ┌── MAPA DO ARQUIVO (na ordem em que aparece) ─────────────────────┐
 * │ temas/cores          aplicarTema, aplicarCorLetra                │
 * │ avisos               toast(), attachTip() (dica por hover/toque) │
 * │ destino do baralho   nomeDeck, tituloCartao, atualizarDestino    │
 * │ destaque do editor   renderDestaque() pinta "::", cloze, [MC] e  │
 * │                      as linhas com erro (vermelho/laranja)       │
 * │ sugestões            renderSugestoes() + irParaLinha() (atalho   │
 * │                      "Ver no texto") + correções de um toque     │
 * │ pré-visualização     preview(), renderCorpoCartao(),             │
 * │                      renderCartaoEstilizado() ("como no Anki")   │
 * │ edição               montarEdicao / montarEdicaoMC, barraTipo    │
 * │                      (conversão entre tipos), painéis por lacuna │
 * │ criação              MODELOS + montarLinhaNovo + preview ao vivo │
 * │ revisão              revRender() (mini-Anki de conferência)      │
 * │ exportação           validar, exportarTxt, exportarApkg          │
 * │ atualização          faixa "nova versão" (service worker)        │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * REGRAS DE OURO ao mexer aqui:
 *  1. Nenhuma regra de negócio nesta camada — ela mora em parser.js
 *     e anki.js. Aqui é só tela.
 *  2. Todo texto visível vem de t("chave") no i18n.js, nos DOIS
 *     idiomas (há teste de paridade de chaves).
 *  3. Editar um cartão = reescrever o TEXTO do editor
 *     (reescreverEditor) e reprocessar; nunca manter estado paralelo.
 *  4. Ao criar um id novo no HTML, lembre que há verificação
 *     automática de que todo $("id") existe no index.html.
 */

const VERSAO = "8.53.0";
const $ = (id) => document.getElementById(id);
let ultimoResult = null;
let previewTimer = null;
let editando = null;
let cardDivs = [];            // [{line, div}] da última renderização
let respostasFechadas = new Set();  // por padrão TODOS mostram a resposta
let marcados = new Set();     // chaves de cartões marcados para revisão
let modoRevisao = false;      // barra de revisão visível
let revisaoSnapshot = null;   // texto do editor ao ENTRAR (para cancelar)
let revisados = new Set();     // frentes de cartões já revisados (verde, persistente)
let ocultosRevisao = 0;        // quantos o filtro "ocultar já revisados" escondeu

/* ===================================================================
 * GAVETA DE RECORTES  (v8.36)
 * Cartão do assunto errado no meio do baralho. Apagar perde o trabalho;
 * deixar mistura as matérias na exportação. A gaveta é o meio-termo: o
 * cartão sai do texto e fica guardado NO NAVEGADOR — sobrevive a fechar
 * o app — até você abrir o baralho certo e colá-lo lá.
 * Guarda o BLOCO inteiro (título "@", linha do cartão e explicações "+"),
 * porque um cartão sem o título e a explicação chega mutilado do outro lado.
 * =================================================================== */
let recortes = [];
try {
  const g = JSON.parse(localStorage.getItem("eac_recortes") || "[]");
  if (Array.isArray(g)) recortes = g.filter((x) => typeof x === "string");
} catch (e) {}

function salvarRecortes() {
  try { localStorage.setItem("eac_recortes", JSON.stringify(recortes)); } catch (e) {}
  atualizarBarraRecortes();
}

/* Texto do bloco de um cartão, do jeito que está escrito no editor. */
function blocoDoTexto(linhaCartao) {
  const linhas = $("editor").value.split("\n");
  const b = blocoDoCartao(linhas, linhaCartao);
  return linhas.slice(b.ini, b.fim + 1).join("\n");
}

/* Tira o bloco do editor. Guarda o texto anterior para o "Desfazer". */
function tirarBlocoDoEditor(linhaCartao) {
  colagemAnterior = { texto: $("editor").value };
  const linhas = $("editor").value.split("\n");
  removerBlocoCartao(linhas, linhaCartao);
  $("editor").value = linhas.join("\n")
    .replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
  $("btnDesfazerColagem").disabled = false;
  autoSalvar();
  preview();
}

function recortarCartao(c) {
  recortes.push(blocoDoTexto(c.line));
  reg("RECORTAR", "cartão da linha " + c.line, recortes.length + " na gaveta");
  tirarBlocoDoEditor(c.line);
  salvarRecortes();
  toast(t("toast_recortado", { n: recortes.length }));
}

async function excluirCartao(c) {
  const resumo = (c.front || "").slice(0, 70);
  if (!(await uiConfirm(t("confirm_excluir", { f: resumo })))) return;
  reg("EXCLUIR", "cartão da linha " + c.line, resumo);
  tirarBlocoDoEditor(c.line);
  toast("toast_excluido");
}

/* `quais` = índices a colar. Sem argumento, cola tudo (botão da barra). */
function colarRecortes(quais) {
  if (!recortes.length) return;
  const idx = (quais && quais.length) ? quais : recortes.map((_, i) => i);
  const blocos = idx.map((i) => recortes[i]).filter(Boolean);
  if (!blocos.length) return;
  const base = $("editor").value.replace(/\s+$/, "");
  colagemAnterior = { texto: $("editor").value };
  $("editor").value = (base ? base + "\n\n" : "") + blocos.join("\n\n") + "\n";
  linhaNovaColada = base ? base.split("\n").length + 2 : 1;
  const n = blocos.length;
  reg("COLAR-RECORTES", n + " cartão(ões) da bandeja");
  recortes = recortes.filter((_, i) => !idx.includes(i));
  salvarRecortes();
  $("btnDesfazerColagem").disabled = false;
  autoSalvar();
  preview();
  irParaLinha(linhaNovaColada);
  setTimeout(() => { linhaNovaColada = null; }, 2400);
  toast(t("toast_recortes_colados", { n }));
}

function atualizarBarraRecortes() {
  const barra = $("barraRecortes");
  if (!barra) return;
  barra.style.display = recortes.length ? "" : "none";
  const rot = $("recortesTexto");
  if (rot) rot.textContent = t("recortes_conta", { n: recortes.length });
}

/* ===================================================================
 * REGISTRO DE EVENTOS  (v8.27)
 * Um caderninho circular com as últimas 200 coisas que aconteceram:
 * ações do usuário, o antes/depois de cada correção e QUALQUER erro de
 * JavaScript. Fica só na memória e no navegador do próprio usuário —
 * nada é enviado a lugar nenhum. Serve para responder "o que você fez
 * antes do problema aparecer?" sem depender da memória de ninguém.
 * =================================================================== */
const REG_MAX = 200;
let registro = [];
try {
  const g = JSON.parse(localStorage.getItem("eac_registro") || "[]");
  if (Array.isArray(g)) registro = g.slice(-REG_MAX);
} catch (e) {}

/* Eventos raros valem mais que rotina: seis "[INICIO]" seguidos nao podem
 * empurrar para fora um "[ERRO]" de tres dias atras. Estes ficam. */
const REG_FIXOS = ["ERRO", "BLOQUEIO", "APAGAR", "RESTAURAR", "TEXTO"];

/* Com o PWA e o navegador abertos ao mesmo tempo, os eventos das duas
 * execucoes se intercalam no mesmo registro. Quatro caracteres bastam
 * para separar uma da outra na hora de ler. */
const SESSAO = Math.random().toString(36).slice(2, 6);

function podarRegistro() {
  if (registro.length <= REG_MAX) return;
  const fixos = registro.filter((r) => REG_FIXOS.includes(r.tipo));
  const comuns = registro.filter((r) => !REG_FIXOS.includes(r.tipo));
  const sobra = Math.max(0, REG_MAX - fixos.length);
  const mantidos = new Set(comuns.slice(-sobra));
  registro = registro.filter((r) => REG_FIXOS.includes(r.tipo) || mantidos.has(r));
  /* se ate' os fixos estourarem, ai' sim o mais antigo sai */
  if (registro.length > REG_MAX) registro = registro.slice(-REG_MAX);
}

function reg(tipo, msg, extra) {
  const agora = new Date();
  registro.push({
    h: agora.toISOString().slice(11, 19),
    d: agora.toISOString().slice(0, 10),
    s: SESSAO,
    tipo, msg: String(msg).slice(0, 300),
    extra: extra === undefined ? undefined : extra,
  });
  podarRegistro();
  try { localStorage.setItem("eac_registro", JSON.stringify(registro)); } catch (e) {}
}

/* Erro de JavaScript entra no registro sozinho — é o tipo de falha que o
 * usuário não sabe descrever e que some no console sem ninguém ver. */
window.addEventListener("error", (e) => {
  reg("ERRO", (e.message || "erro") + " @ "
    + String(e.filename || "").split("/").pop() + ":" + (e.lineno || "?"));
});
window.addEventListener("unhandledrejection", (e) => {
  reg("ERRO", "promessa rejeitada: " + ((e.reason && e.reason.message) || e.reason));
});

// a abertura entra ANTES de qualquer análise, senão o registro começa
// pelo meio da história
reg("INICIO", "aplicativo aberto", "v" + VERSAO);

function registroTexto() {
  if (!registro.length) return t("log_empty");
  return registro.map((r) => r.d + " " + r.h + " " + (r.s || "----")
    + "  [" + r.tipo + "] " + r.msg
    + (r.extra ? "  " + r.extra : "")).join("\n");
}
let colagemAnterior = null;   // {texto} do editor ANTES da última colagem
let linhaNovaColada = null;   // 1ª linha do texto recém-colado (brilho)
let flashLinha = null;        // linha do editor que deve piscar no painel direito




/* ------------------------------------------------------------------
 * DIÁLOGO ANIMADO (substitui alert/confirm nativos, que travam a aba)
 * uiAlert(texto)   -> Promise<void>  (só botão OK)
 * uiConfirm(texto) -> Promise<bool>  (Cancelar / OK)
 * Aparece e some com transição; fecha por OK, Cancelar, clique fora ou Esc.
 * ------------------------------------------------------------------ */

let _uiResolve = null;

function _uiFechar(valor) {
  const m = document.getElementById("uiModal");
  if (m.open) m.close();
  const r = _uiResolve; _uiResolve = null;
  if (r) r(valor);
}

function uiDialog(texto, comCancelar) {
  return new Promise((resolve) => {
    // se já houver um aberto, encerra o anterior sem valor
    if (_uiResolve) { const r = _uiResolve; _uiResolve = null; r(false); }
    _uiResolve = resolve;
    const m = document.getElementById("uiModal");
    document.getElementById("uiModalMsg").textContent = texto;
    document.getElementById("uiModalOk").textContent = "OK";
    const cancel = document.getElementById("uiModalCancel");
    cancel.textContent = t("cancel_btn");
    cancel.style.display = comCancelar ? "" : "none";
    // showModal() põe o aviso na camada de topo: ele aparece mesmo com
    // outro <dialog> aberto embaixo (bug do alerta invisível, v8.26)
    if (!m.open) m.showModal();
    document.getElementById("uiModalOk").focus();
  });
}

function uiAlert(texto) { return uiDialog(String(texto), false); }
function uiConfirm(texto) { return uiDialog(String(texto), true); }

// ligações dos botões do modal (uma vez)
document.getElementById("uiModalOk").onclick = () => _uiFechar(true);
document.getElementById("uiModalCancel").onclick = () => _uiFechar(false);
document.getElementById("uiModal").addEventListener("click", (e) => {
  if (e.target.id === "uiModal") _uiFechar(false);   // clique no fundo
});
// Esc fecha o <dialog> por conta própria: resolve a promessa junto
document.getElementById("uiModal").addEventListener("cancel", (e) => {
  e.preventDefault(); _uiFechar(false);
});
document.addEventListener("keydown", (e) => {
  if (!_uiResolve) return;
  if (e.key === "Escape") _uiFechar(false);
  else if (e.key === "Enter") _uiFechar(true);
});

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
  $("deckExp").placeholder = t("deck_placeholder");
  $("tituloExp").placeholder = t("title_ph");
  if ($("tituloExpNota")) $("tituloExpNota").textContent = t("export_title_reword");
  $("editor").placeholder = t("paste_here");
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
/* Título GERAL (único valor). Dois campos o editam — o do painel esquerdo
 * (sempre visível) e o do diálogo de exportar — mantidos em sincronia e
 * salvos em eac_titulo. Vazio = cartões sem título próprio ficam sem topo. */
function tituloGeral() {
  return (localStorage.getItem("eac_titulo") || "").trim();
}
function setTituloGeral(v) {
  v = (v || "").trim();
  localStorage.setItem("eac_titulo", v);
  if ($("tituloGeral").value !== v) $("tituloGeral").value = v;
  if ($("tituloExp") && $("tituloExp").value !== v) $("tituloExp").value = v;
}
function tituloCartao() { return tituloGeral(); }   // usado na exportação

function atualizarDestino() {
  const partes = nomeDeck().split("::").map((p) => p.trim()).filter(Boolean);
  $("destinoExp").textContent = partes.length > 1
    ? t("dest_path", { path: partes.join("  >  "), last: partes[partes.length - 1] })
    : t("dest_root", { name: nomeDeck() });
}

/* ------------------- lacunas cloze por seleção ---------------------- */

function marcarLacuna(campo) {
  const ini = campo.selectionStart, fim = campo.selectionEnd;
  if (ini === fim) { uiAlert(t("hint_mark_blank")); return; }
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
  aj.onclick = () => uiAlert(t("hint_mark_blank"));
  linha.append(bM, bL, aj);
  pai.append(linha);
}


/* -------------- destaque de sintaxe e erros no editor --------------- */

let hlWarnLines = new Set();   // linhas ignoradas (vermelho)
let hlIssueLines = new Set();  // linhas de cartões VERIFICAR (laranja)

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Pinta a ESTRUTURA, não o conteúdo. Antes a lacuna inteira levava fundo
 * azul — e como a lacuna costuma ser a maior parte da linha, metade do
 * editor ficava manchada, sem dizer nada. Agora só os marcadores
 * ("{{c1::" e "}}") têm fundo; o texto da lacuna leva um sublinhado fino,
 * que mostra a extensão sem competir com a leitura. */
function destacarTrecho(texto) {
  const partes = texto.split(/(\{\{c\d+::[\s\S]*?\}\})/g);
  return partes.map((p) => {
    if (/^\{\{c\d+::/.test(p)) {
      const m = p.match(/^(\{\{c\d+::)([\s\S]*?)(\}\})$/);
      if (!m) return '<span class="hl-cloze">' + escHtml(p) + "</span>";
      return '<span class="hl-cz-marca">' + escHtml(m[1]) + "</span>"
        + '<span class="hl-cz-txt">' + escHtml(m[2]) + "</span>"
        + '<span class="hl-cz-marca">' + escHtml(m[3]) + "</span>";
    }
    return escHtml(p).replace(/::/g, '<span class="hl-delim">::</span>');
  }).join("");
}

function renderNumeros(linhas, marcadas, avisadas) {
  const gutter = $("editorNums");
  const html = linhas.map((_, i) => {
    const n = i + 1;
    const cls = marcadas.has(n) ? "err" : (avisadas.has(n) ? "warn" : "");
    return '<div class="lnum ' + cls + '">' + n + "</div>";
  }).join("");
  gutter.innerHTML = html;
  gutter.scrollTop = $("editor").scrollTop;
}

/* Mede a barra de rolagem do campo e publica a largura como --calha, para
 * a camada colorida ter a MESMA largura útil. Sem isso as duas quebram as
 * linhas em pontos diferentes e as marcas escorregam pelo texto — era a
 * causa das "cores em lugar errado". Roda na abertura e a cada redimensão,
 * porque a barra some quando o texto cabe todo na tela. */
function medirCalha() {
  const ed = $("editor");
  if (!ed) return;
  const borda = 2;   /* 1px de cada lado, igual nos dois elementos */
  const calha = Math.max(0, ed.offsetWidth - ed.clientWidth - borda);
  document.documentElement.style.setProperty("--calha", calha + "px");
}
window.addEventListener("resize", medirCalha);

/* Ampliar a bancada: esconde a prévia e dá a largura toda ao editor.
 * Fica guardado, porque quem trabalha em texto longo trabalha assim a
 * sessão inteira e não quer reapertar o botão a cada abertura. */
let bancadaAmpla = false;   /* o estado mora aqui, nao na classe do <main> */
function aplicarAmpliar(ligado) {
  bancadaAmpla = !!ligado;
  document.querySelector("main").classList.toggle("bancada-ampla", ligado);
  const b = $("btnAmpliar");
  b.setAttribute("aria-pressed", ligado ? "true" : "false");
  b.textContent = t(ligado ? "bancada_restaurar" : "bancada_ampliar");
  localStorage.setItem("eac_ampliar", ligado ? "1" : "0");
  medirCalha();
  renderDestaque();
}

function renderDestaque() {
  medirCalha();
  const linhas = $("editor").value.split("\n");
  const html = linhas.map((l, i) => {
    const n = i + 1;
    let corpo;
    if (l.trim().startsWith("#")) corpo = '<span class="hl-com">' + escHtml(l) + "</span>";
    else if (l.startsWith("[MC]"))
      corpo = '<span class="hl-mc">[MC]</span>' + destacarTrecho(l.slice(4));
    else corpo = destacarTrecho(l);
    let cls = hlWarnLines.has(n) ? "hl-err" : (hlIssueLines.has(n) ? "hl-warn" : "");
    if (n === linhaNovaColada) cls = (cls ? cls + " " : "") + "hl-novo";
    return cls ? '<span class="' + cls + '">' + corpo + "</span>" : corpo;
  }).join("\n");
  $("editorHl").innerHTML = html + "\n";
  $("editorHl").scrollTop = $("editor").scrollTop;
  renderNumeros(linhas, hlWarnLines, hlIssueLines);
}


/* ------------------------------------------------------------------
 * NAVEGAÇÃO ATÉ O PROBLEMA
 * Leva o cursor do editor à linha com defeito, seleciona-a e rola a
 * caixa até ela — o usuário vê exatamente onde precisa mexer, sem
 * procurar. Usado pelos botões "Ver no texto" das sugestões e dos
 * cartões marcados como VERIFICAR.
 * ------------------------------------------------------------------ */

function irParaLinha(n) {
  const ed = $("editor");
  const linhas = ed.value.split("\n");
  if (n < 1 || n > linhas.length) return;
  let ini = 0;
  for (let i = 0; i < n - 1; i++) ini += linhas[i].length + 1;
  const fim = ini + linhas[n - 1].length;
  ed.focus();
  ed.setSelectionRange(ini, fim);
  // rola a caixa deixando a linha por volta do terço superior
  const alturaLinha = parseFloat(getComputedStyle(ed).lineHeight) || 19;
  ed.scrollTop = Math.max(0, (n - 3) * alturaLinha);
  renderDestaque();
  toast("toast_goto");
}

/* Botão pequeno reaproveitado nas sugestões e nos cartões. */
function botaoMini(rotuloKey, cor, acao, rotuloPronto) {
  const b = document.createElement("button");
  b.className = "btn " + cor;
  b.style.cssText = "padding:2px 8px;font-size:11px;margin-left:6px";
  b.textContent = rotuloPronto || t(rotuloKey);
  b.onclick = acao;
  return b;
}

/* Envolve qualquer correção automática numa rede de segurança: se o
 * resultado tiver MENOS cartões que o original, a mudança é descartada
 * (nenhuma correção deve apagar conteúdo do usuário). */
/* Rede de segurança das correções. Duas regras que NENHUMA correção pode
 * violar (as duas nasceram de bugs reais):
 *   1. não pode sobrar menos cartão do que entrou      (v8.19)
 *   2. não pode sobrar menos "Saiba mais" do que entrou (v8.22)
 *   3. não pode sobrar menos etiqueta do que entrou     (v8.23)
 * Guarda também o antes/depois para o relatório de diagnóstico. */
let ultimoAjuste = null;   // { acao, antes, depois } da última correção

/* `simular` = só quero ver o resultado, não estou aplicando. A janela de
 * revisão chamava esta função só para MOSTRAR o antes/depois, e cada
 * abertura deixava um [CORRIGIR] no registro — dois eventos idênticos por
 * operação, um da prévia e outro da aplicação. O registro passava a
 * impressão de que o botão rodava duas vezes (v8.35). */
function corrigirComSeguranca(fn, texto, simular) {
  if (!simular) guardarVersao("antes de " + (fn.name || "corrigir"), texto);
  const antes = resumoTexto(texto);
  const novo = fn(texto);
  const depois = resumoTexto(novo);
  if (simular) {
    // as travas continuam valendo: a prévia mostra o texto SEM a mudança
    // que seria bloqueada, para não prometer o que não vai acontecer
    if (fn.limpeza) return novo;
    if (depois.cartoes < antes.cartoes || depois.saibaMais < antes.saibaMais
        || depois.tags < antes.tags) return texto;
    return novo;
  }
  // correções marcadas como "limpeza" existem justamente para TIRAR coisa
  // (instrução do prompt que vazou, linha repetida): as três travas abaixo
  // as bloqueariam sempre
  if (fn.limpeza) {
    ultimoAjuste = { acao: fn.name || "limpeza", antes, depois };
    reg("LIMPAR", fn.name || "limpeza",
      antes.saibaMais + "→" + depois.saibaMais + " saiba+, "
      + antes.cartoes + "→" + depois.cartoes + " cartões");
    return novo;
  }
  ultimoAjuste = { acao: fn.name || "correcao", antes, depois };
  reg("CORRIGIR", fn.name || "correcao",
    antes.cartoes + "→" + depois.cartoes + " cartões, "
    + antes.saibaMais + "→" + depois.saibaMais + " saiba+, "
    + antes.tags + "→" + depois.tags + " tags");
  if (depois.cartoes < antes.cartoes) {
    uiAlert(t("fix_would_lose", { a: antes.cartoes, d: depois.cartoes }));
    ultimoAjuste.bloqueado = "cartoes";
    reg("BLOQUEIO", "correção cancelada: perderia cartões");
    return texto;
  }
  if (depois.saibaMais < antes.saibaMais) {
    uiAlert(t("fix_would_lose_more", { a: antes.saibaMais, d: depois.saibaMais }));
    ultimoAjuste.bloqueado = "saibaMais";
    reg("BLOQUEIO", "correção cancelada: perderia Saiba mais");
    return texto;
  }
  // 3. não pode sobrar menos etiqueta do que entrou   (v8.23)
  if (depois.tags < antes.tags) {
    uiAlert(t("fix_would_lose_tags", { a: antes.tags, d: depois.tags }));
    ultimoAjuste.bloqueado = "tags";
    reg("BLOQUEIO", "correção cancelada: perderia etiquetas");
    return texto;
  }
  return novo;
}

/* ---------------- sugestões automáticas (sem botão) ----------------- */

/* Guarda o ajuste estrutural detectado para o botão "Corrigir erros"
 * (o mesmo que as sugestões oferecem), ou null quando não há nada. */
let correcaoPendente = null;

/* Liga/desliga e destaca o botão conforme exista ou não algo a corrigir. */
function atualizarBotaoCorrigir(temAlgo) {
  const b = $("btnNormalizar");
  b.disabled = !temAlgo;
  b.classList.toggle("ativo", !!temAlgo);
  b.textContent = temAlgo ? t("normalize_btn") : t("normalize_none");
}

/* Correções que podem rodar TODAS de uma vez. Ficam de fora as que apagam
 * conteúdo de propósito (o prompt colado, o prompt vazado): remover texto
 * tem de continuar sendo uma decisão explícita, com o seu próprio botão. */
const CADEIA_SEGURA = [
  [temMaisRepetido, corrigirMaisRepetido],
  [temClozeRepetida, corrigirClozeRepetida],
  [temTagsNaExplicacao, corrigirTagsNaExplicacao],
  [temTituloGrudado, corrigirTituloGrudado],
  [temOrfaosExplicacao, corrigirOrfaosExplicacao],
  [temTagsQueSaoTexto, corrigirTagsQueSaoTexto],
  [temMarcadores, removerMarcadoresTexto],
  [temMarkdown, corrigirMarkdown],
  [temMaisJunto, corrigirMaisJunto],
  [temEspacosRuins, corrigirEspacos],
];

/* Antes, "Corrigir erros" devolvia UMA correção por clique: com quatro
 * defeitos no texto eram quatro cliques, e o usuário só descobria que
 * faltava mais quando o botão acendia de novo. Agora uma passada só, com
 * até três voltas — uma correção pode revelar outra (tirar o marcador
 * expõe o título grudado). O nome de cada uma vai para o registro. */
function correcaoDeTudo(raw) {
  const aplicadas = [];
  let txt = raw;
  for (let volta = 0; volta < 3; volta++) {
    let mexeu = false;
    CADEIA_SEGURA.forEach(([detecta, corrige]) => {
      if (!detecta(txt)) return;
      const novo = corrige(txt);
      if (novo === txt) return;              /* detectou mas não mudou nada */
      txt = novo; mexeu = true;
      if (!aplicadas.includes(corrige)) aplicadas.push(corrige);
    });
    if (!mexeu) break;
  }
  if (!aplicadas.length) return null;
  const tudo = (t0) => aplicadas.reduce((acc, f) => f(acc), t0);
  /* o nome aparece no registro e no diálogo de conferência */
  Object.defineProperty(tudo, "name",
    { value: aplicadas.map((f) => f.name).join(" + ") });
  return tudo;
}

function renderSugestoes(r, raw) {
  const box = $("sugestoes");
  box.innerHTML = "";
  const itens = [];
  /* Todo item precisa saber ONDE ele acontece. Os três avisos agregados
   * ("N linhas ignoradas", "N a verificar") não guardavam linha nenhuma e
   * por isso ficavam sem "Ver no texto" — justamente os que só a IA
   * resolve, ou seja, os que mais precisam ser encontrados no texto.
   * A linha do PRIMEIRO caso serve de porta de entrada. */
  const priLinha = (f) => { const c = r.cards.find(f); return c ? c.line : null; };
  if (r.warnings.length)
    itens.push({ dot: "dot-red", txt: t("sug_ignored", { n: r.warnings.length }),
                 linha: r.warnLines && r.warnLines[0] });
  if (r.nSuspicious)
    itens.push({ dot: "dot-org", txt: t("sug_verify", { n: r.nSuspicious }),
                 linha: priLinha((c) => c.issues && c.issues.length) });
  if (r.nPares)
    itens.push({ dot: "dot-blue", txt: t("sug_pairs", { n: r.nPares }),
                 linha: priLinha((c) => c.infos && c.infos.length) });
  const presos = cartoesDependentes(r);
  if (presos.length)
    itens.push({ dot: "dot-org", txt: t("crit_dependente", { n: presos.length }),
                 linha: presos[0].line });
  const vistos = {};
  let longos = 0, dups = 0;
  r.cards.forEach((c) => {
    if ((c.front + c.back).length > 220 && longos < 2) {
      itens.push({ dot: "dot-org", txt: t("crit_long", { n: c.line }), linha: c.line }); longos++;
    }
  });
  // frentes repetidas: um item por GRUPO, com todas as linhas. Antes o
  // aviso saía em pares e parava no segundo — um grupo de três cartões
  // aparecia como um par, e o resto ficava invisível.
  const grupos = gruposDuplicados(r);
  if (grupos.length) {
    // o resumo com a AÇÃO vem primeiro: era o item que sobrava de fora
    // quando a lista batia no limite de exibição
    const extras = grupos.reduce((s, g) => s + g.length - 1, 0);
    itens.push({ dot: "dot-org", txt: t("crit_dup_total", { g: grupos.length, n: extras }),
                 fixTxt: t("fix_dup_cut"), acao: () => recortarDuplicados(grupos) });
  }
  grupos.slice(0, 4).forEach((g) => {
    itens.push({
      dot: "dot-org", linha: g[0].line, grupo: true,
      txt: t("crit_dup", {
        n: g.length,
        linhas: g.map((c) => c.line).join(", "),
        f: g[0].front.replace(/\{\{c\d+::/g, "").replace(/\}\}/g, "").slice(0, 70),
      }),
    });
  });
  /* Correções disponíveis, uma por detector. Cada uma vira um item com o
   * seu próprio botão — o usuário vê O QUE está errado antes de decidir.
   * ATENÇÃO: esta lista some fácil numa reescrita da função (aconteceu na
   * v8.37). O teste "todo detector aceso oferece correção" existe por isso. */
  /* Primeiro item da lista, antes de qualquer detalhe de formato: se o que
   * está no editor é o prompt, nada mais importa. */
  if (temPromptColado(raw)) {
    const n = linhasDePrompt(raw).length;
    itens.unshift({ dot: "dot-red", txt: t("crit_prompt_colado", { n }),
                    fixTxt: t("fix_prompt_colado"), fix: limparPromptColado });
  }

  const CORRECOES_UI = [
    [temPromptVazado, "crit_prompt_leak", "fix_prompt_leak", corrigirPromptVazado, "dot-red"],
    [temMaisRepetido, "crit_mais_rep", "fix_mais_rep", corrigirMaisRepetido, "dot-org"],
    [temClozeRepetida, "crit_cloze_rep", "fix_cloze_rep", corrigirClozeRepetida, "dot-org"],
    [temTagsNaExplicacao, "crit_tags_in_more", "fix_tags_in_more", corrigirTagsNaExplicacao, "dot-org"],
    [temTituloGrudado, "crit_title_glued", "fix_title_glued", corrigirTituloGrudado, "dot-org"],
    [temTagsQueSaoTexto, "crit_pairs_tags", "fix_tags_text", corrigirTagsQueSaoTexto, "dot-org"],
    [temMarcadores, "crit_bullets", "fix_bullets", removerMarcadoresTexto, "dot-org"],
    [temMarkdown, "crit_markdown", "fix_markdown", corrigirMarkdown, "dot-org"],
    [temMaisJunto, "crit_mais_junto", "fix_mais_junto", corrigirMaisJunto, "dot-blue"],
    [temEspacosRuins, "crit_espacos", "fix_espacos", corrigirEspacos, "dot-blue"],
  ];
  CORRECOES_UI.forEach(([detector, critKey, fixKey, fix, dot]) => {
    if (detector(raw)) itens.push({ dot, txt: t(critKey), fixTxt: t(fixKey), fix });
  });

  if (!itens.length) itens.push({ dot: "dot-green", txt: t("sug_none") });

  // o botão só fica ativo se houver correção automática OU cartão/linha
  // com problema — evita o usuário clicar e não encontrar nada
  correcaoPendente = correcaoDeTudo(raw);
  // Ativa só o que "Corrigir erros" REALMENTE arruma:
  //  - uma correção estrutural detectada, ou
  //  - linhas ignoradas (podem virar comentário), ou
  //  - cartões fora da forma canônica (reformatação).
  // Cartão longo/duplicado é apenas AVISO — não acende o botão.
  const temProblema = !!correcaoPendente || r.warnings.length > 0 || precisaNormalizar(r);
  atualizarBotaoCorrigir(temProblema);
  /* Quando sobra trabalho que o app não faz, o caminho é o prompt — e o
   * botão passa a pedir passagem. Sem isso o usuário fica olhando para um
   * "Nada a corrigir" apagado e conclui que não há mais o que fazer. */
  const paraIA = itens.some((it) => !it.fix && !it.acao && it.dot !== "dot-green");
  $("btnPromptCorrigir").classList.toggle("pulsa", paraIA);

  itens.slice(0, 8).forEach((it) => {
    const div = document.createElement("div");
    div.className = "sug";
    const dot = document.createElement("span");
    dot.className = "dot " + it.dot;
    const sp = document.createElement("span");
    sp.textContent = it.txt;
    /* Quem resolve cada coisa. A lista misturava dois mundos: o que o app
     * arruma sozinho (formato) e o que só a IA arruma (dividir um cartão
     * longo, encurtar alternativa). Sem essa marca o usuário clica em
     * "Corrigir" esperando que resolva tudo — e conclui que está quebrado. */
    const daIA = !(it.fix || it.acao);
    const quem = document.createElement("span");
    quem.className = "sug-quem " + (daIA ? "quem-ia" : "quem-app");
    quem.textContent = t(daIA ? "quem_ia" : "quem_app");
    if (daIA) {
      /* O crachá diz QUEM resolve; o ícone diz COMO. Passar o mouse mostra
       * a dica; tocar (celular, onde não existe "passar o mouse") abre o
       * mesmo texto num aviso. */
      const info = document.createElement("button");
      info.className = "sug-info";
      info.type = "button";
      info.textContent = "?";
      info.title = t("quem_ia_dica");
      info.setAttribute("aria-label", t("quem_ia_dica"));
      info.onclick = (e) => { e.stopPropagation(); uiAlert(t("quem_ia_dica")); };
      quem.append(info);
    }
    div.append(dot, quem, sp);
    // Ações em linha própria (antes ficavam espremidas ao lado do texto)
    if (it.linha || it.fix) {
      const acoes = document.createElement("div");
      acoes.className = "sug-acao";
      if (it.linha)
        acoes.append(botaoMini("goto_error", "btn-cinza", () => abrirFoco(it.linha, it.txt)));
      if (it.acao) {
        acoes.append(botaoMini(it.fixTxt ? null : "fix_now", "btn-azul", it.acao, it.fixTxt));
      } else if (it.fix) {
        // NÃO corrige direto: abre o Normalizar, onde o usuário vê
        // antes/depois de cada mudança e escolhe o que aplicar.
        acoes.append(botaoMini(it.fixTxt ? null : "fix_now", "btn-azul",
                              () => abrirNormalizar(it.fix), it.fixTxt));
        const rot = document.createElement("span");
        rot.className = "rot";
        rot.textContent = t("use_normalize");
        acoes.append(rot);
      }
      div.append(acoes);
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

/* A marca "já revisado" precisa sobreviver a edições e ao recarregar a
 * página, então NÃO pode depender do número da linha: usa só a frente,
 * normalizada. É guardada no navegador (eac_revisados). */
function chaveRev(c) {
  return (c.front || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function carregarRevisados() {
  try {
    const g = JSON.parse(localStorage.getItem("eac_revisados") || "[]");
    return new Set(Array.isArray(g) ? g : []);
  } catch (e) { return new Set(); }
}
function salvarRevisados() {
  try { localStorage.setItem("eac_revisados", JSON.stringify([...revisados])); }
  catch (e) {}
}

/* ==================================================================
 * HISTÓRICO DO TEXTO — a rede que faltava
 *
 * Até a v8.44 o texto morava num único lugar: "eac_texto", sobrescrito
 * 400ms depois de qualquer digitação. Selecionar tudo e colar outra coisa
 * apagava horas de trabalho de forma definitiva e SILENCIOSA — nem o
 * registro guardava nota do que tinha acontecido, porque as duas ações
 * mais destrutivas do app (substituir o texto e "Apagar tudo") eram as
 * únicas que não geravam evento.
 *
 * Agora cada mudança grande deixa uma cópia. O histórico é curto de
 * propósito: o objetivo é desfazer um acidente das últimas horas, não
 * versionar o baralho. Para guardar de verdade, exporte o .apkg.
 * ================================================================== */
const HIST_MAX = 12;          /* versões guardadas */
const HIST_ORC = 1200000;     /* teto de caracteres, ~1,2 MB */
let historico = [];
let textoAnterior = "";

function carregarHistorico() {
  try { historico = JSON.parse(localStorage.getItem("eac_hist") || "[]"); }
  catch (e) { historico = []; }
  if (!Array.isArray(historico)) historico = [];
}

function salvarHistorico() {
  /* Sob pressão de espaço a versão MAIS ANTIGA sai primeiro: a de ontem
   * vale menos que a de cinco minutos atrás. E se nem assim couber, o
   * histórico cede lugar — ele nunca pode impedir de salvar o texto. */
  for (let tentativa = 0; tentativa < HIST_MAX + 1; tentativa++) {
    try { localStorage.setItem("eac_hist", JSON.stringify(historico)); return true; }
    catch (e) { historico.shift(); if (!historico.length) break; }
  }
  try { localStorage.removeItem("eac_hist"); } catch (e) {}
  return false;
}

/* Toda operação deliberada (corrigir, apagar, restaurar, aplicar) guarda
 * versão ANTES de mexer. A marca aqui deixa a vigia distinguir "o texto
 * sumiu" de "o usuário mandou tirar": sem ela, a barra vermelha acusava
 * acidente logo depois de a pessoa clicar em Corrigir, e alarme que toca
 * à toa é alarme que se aprende a ignorar.
 *
 * É um sinal, não um cronômetro. A primeira versão usava uma janela de
 * 1,5 segundo e teria engolido justamente o caso pior — colar por cima de
 * tudo nos primeiros instantes depois de abrir o app. O sinal vale para
 * UMA gravação e se apaga sozinho. */
let appMexendo = false;

function guardarVersao(motivo, texto) {
  if (motivo !== "ao abrir") appMexendo = true;
  const txt = texto === undefined ? $("editor").value : texto;
  if (!txt || !txt.trim()) return;
  const ultimo = historico[historico.length - 1];
  if (ultimo && ultimo.txt === txt) return;          /* nada mudou */
  historico.push({ t: Date.now(), m: motivo || "", txt });
  while (historico.length > HIST_MAX) historico.shift();
  let total = historico.reduce((s, v) => s + v.txt.length, 0);
  while (historico.length > 1 && total > HIST_ORC) {
    total -= historico.shift().txt.length;
  }
  salvarHistorico();
  atualizarBotaoHistorico();
}

function abrirHistorico() {
  const lista = $("histLista");
  lista.innerHTML = "";
  if (!historico.length) {
    const p = document.createElement("div");
    p.className = "nota"; p.textContent = t("hist_vazio");
    lista.append(p);
  }
  /* mais recente primeiro: é quase sempre a que se quer de volta */
  historico.slice().reverse().forEach((v, k) => {
    const i = historico.length - 1 - k;
    const div = document.createElement("div");
    div.className = "hist-item";
    const info = document.createElement("div");
    const n = (v.txt.match(/^[^\n]*::/gm) || []).length;
    info.innerHTML = "";
    const forte = document.createElement("b");
    forte.textContent = new Date(v.t).toLocaleString();
    const sub = document.createElement("div");
    sub.className = "nota";
    sub.textContent = t("hist_linha", { n, c: v.txt.length }) + (v.m ? " · " + v.m : "");
    info.append(forte, sub);
    const b = botaoMini("hist_restaurar", "btn-azul", () => {
      $("dlgHistorico").close(); restaurarVersao(i);   /* confirma dentro */
    });
    div.append(info, b);
    lista.append(div);
  });
  $("dlgHistorico").showModal();
}

function atualizarBotaoHistorico() {
  const b = $("btnHistorico");
  if (!b) return;
  b.disabled = !historico.length;
  b.textContent = t("hist_btn", { n: historico.length });
}

/* Encolhimento brusco: 137 cartões viram 1 sem nenhum aviso. Aqui a versão
 * de antes é guardada e uma barra de recuperação aparece — o acidente
 * continua possível, mas deixa de ser irreversível. */
const ENCOLHEU_MIN = 1500;    /* só vale a pena para texto de trabalho */
function vigiarEncolhimento(antes, depois) {
  if (appMexendo) { appMexendo = false; return; }   /* foi o app, a pedido */
  if (antes.length < ENCOLHEU_MIN) return;
  if (depois.length >= antes.length * 0.5) return;
  guardarVersao("antes de encolher", antes);
  reg("TEXTO", "texto encolheu muito",
      antes.length + " -> " + depois.length + " caracteres");
  mostrarBarraRecuperar(antes.length, depois.length);
}

function mostrarBarraRecuperar(de, para) {
  const bar = $("barraRecuperar");
  if (!bar) return;
  $("recuperarTxt").textContent = t("hist_shrunk", { de, para });
  bar.hidden = false;
}

/* Dispensar não confirma: confirmar um "não faça nada" ensina a clicar em
 * qualquer caixa sem ler. Em vez disso, o app avisa ONDE a cópia ficou —
 * que é a informação de que a pessoa vai precisar depois. */
function dispensarRecuperar() {
  esconderBarraRecuperar();
  uiAlert(t("hist_dispensado"));
  reg("TEXTO", "aviso de encolhimento dispensado pelo usuário");
}

function esconderBarraRecuperar() {
  const bar = $("barraRecuperar");
  if (bar) bar.hidden = true;
}

/* Restaurar SUBSTITUI o que está no editor. É destrutivo, então o app diz
 * exatamente o que vai acontecer, com os dois tamanhos na frente, antes de
 * fazer. E diz também que dá para desfazer — porque a versão atual é
 * guardada no mesmo movimento, e saber disso muda a decisão. */
async function restaurarVersao(i, confirmar) {
  const v = historico[i];
  if (!v) return;
  if (confirmar !== false) {
    const atual = $("editor").value.length;
    const ok = await uiConfirm(t("hist_confirma", {
      atual, novo: v.txt.length, quando: new Date(v.t).toLocaleString(),
    }));
    if (!ok) return;
  }
  guardarVersao("antes de restaurar");     /* o desfazer também é desfeito */
  $("editor").value = v.txt;
  textoAnterior = v.txt;
  esconderBarraRecuperar();
  autoSalvar();
  preview();
  reg("RESTAURAR", "versão de " + new Date(v.t).toLocaleString(),
      v.txt.length + " caracteres");
  toast("toast_restaurado");
}

let saveTimer = null;
function autoSalvar() {
  const atual = $("editor").value;
  vigiarEncolhimento(textoAnterior, atual);
  textoAnterior = atual;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem("eac_texto", atual); } catch (e) {}
  }, 400);
}

function agendarPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(preview, 500);
}

function parseAtual() {
  // Tags globais foram removidas: cada cartão usa apenas as PRÓPRIAS
  // tags (o 3º campo do texto). Isso elimina tags "fantasma" no topo.
  return parseText($("editor").value, []);
}

/* recupera as marcas de "já revisado" da sessão anterior */
revisados = carregarRevisados();

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
  box.classList.toggle("duas",
    $("chk2col").checked && matchMedia("(min-width:760px)").matches);

  const filtrando = $("chkFiltro") && $("chkFiltro").checked;
  const ocultandoRev = modoRevisao && $("chkOcultarRev") && $("chkOcultarRev").checked;
  ocultosRevisao = 0;
  r.cards.forEach((c, idx) => {
    if (filtrando && !marcados.has(chave(c))) return;   // mostra só marcados
    // esconde o que já passou por uma rodada de revisão (a marca verde),
    // para sobrar na tela apenas o que ainda não foi conferido
    if (ocultandoRev && revisados.has(chaveRev(c)) && !marcados.has(chave(c))) {
      ocultosRevisao++; return;
    }
    const div = document.createElement("div");
    div.className = "card" + (c.issues.length ? " suspeito" : "")
;
    const titulo = "#" + (idx + 1) + " · " + tipoRotulo(c) + " · " + t("card_line") + " " + c.line
      + (c.issues.length ? " — " + t("card_verify") : "");
    const cab = document.createElement("div");
    cab.className = "cab";
    const sp = document.createElement("span");
    sp.className = "titulo"; sp.textContent = titulo;
    cab.append(sp);
    // durante a revisão: checkbox "marcar" + selo de texto (só visual)
    if (modoRevisao) {
      const lblR = document.createElement("label");
      lblR.className = "chk-rev";
      const chkR = document.createElement("input");
      chkR.type = "checkbox"; chkR.checked = marcados.has(chave(c));
      chkR.onchange = () => {
        if (chkR.checked) { marcados.add(chave(c)); revisados.delete(chaveRev(c)); salvarRevisados(); }
        else marcados.delete(chave(c));
        atualizarContagemRevisao();
        preview();
      };
      lblR.append(chkR, document.createTextNode(t("review_mark")));
      cab.append(lblR);
    }
    div.append(cab);
    if (modoRevisao && (marcados.has(chave(c)) || revisados.has(chaveRev(c)))) {
      const rev = revisados.has(chaveRev(c));
      const selo = document.createElement("div");
      selo.className = "card-badge-rev " + (rev ? "card-badge-rev-ok" : "card-badge-sel");
      selo.textContent = "● " + t(rev ? "badge_reviewed" : "badge_selected");
      div.append(selo);
    }

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
      if (c.issues.length) acoes.append(botaoMini("goto_error", "btn-cinza", () => irParaLinha(c.line)));
      const bVer = document.createElement("button");
      const aberto = !respostasFechadas.has(chave(c));
      bVer.className = "btn btn-ciano";
      bVer.textContent = t(aberto ? "hide_answer_btn" : "show_answer_btn");
      bVer.onclick = () => {
        aberto ? respostasFechadas.add(chave(c)) : respostasFechadas.delete(chave(c));
        preview();
      };
      const bRec = document.createElement("button");
      bRec.className = "btn btn-cinza btn-min";
      bRec.textContent = t("cut_btn");
      bRec.title = t("tip_cut");
      bRec.onclick = () => recortarCartao(c);
      const bDel = document.createElement("button");
      bDel.className = "btn btn-min btn-del";
      bDel.textContent = t("del_btn");
      bDel.title = t("tip_del");
      bDel.onclick = () => excluirCartao(c);
      acoes.append(bEd, bVer, bRec, bDel);
      div.append(acoes);
    }
    box.append(div);
    cardDivs.push({ line: c.line, div });
  });

  (r.ignorados || []).forEach((ig) => box.append(cartaoIgnorado(ig, r)));
  // avisos que não são "linha ignorada com texto" (raros) continuam simples
  const linhasIgnoradas = new Set((r.ignorados || []).map((i) => i.line));
  r.warnings.forEach((w, idx) => {
    const nLinha = (r.warnLines || [])[idx];
    if (linhasIgnoradas.has(nLinha)) return;
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

function selecionados(r) { return r.cards; }   // "incluir" removido: exporta todos

function resumo(r) {
  let s = t("summary", { n: r.cards.length, b: r.nBasic, c: r.nCloze });
  if (r.nSuspicious) s += t("summary_verify", { n: r.nSuspicious });
  $("resumo").textContent = s;
  $("status").textContent = t("status_auto", { n: r.cards.length });
}


/* --------- prévia completa "como no Anki" (estilo escolhido) --------- */

function modoPrevia() { return "anki"; }   // sempre renderiza como no Anki

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

/* ===================================================================
 * BLOCO LONGO NA PRÉVIA  (v8.31)
 * Um cartão importado pode trazer um artigo inteiro na frente (2.000
 * caracteres não é raro em baralho vindo de PDF). Sem limite, ele sozinho
 * ocupa toda a área de prévia e esconde os outros cartões. Aqui o bloco
 * ganha altura máxima e um botão "mostrar tudo" — o conteúdo continua
 * inteiro no texto e no .apkg; o corte é só visual.
 * =================================================================== */
const PREV_MAX_PX = 170;
const PREV_LIMITE = 600;      // a partir daqui vale a pena cortar

function limitarAltura(el, texto, fundo) {
  if ((texto || "").length <= PREV_LIMITE) return null;
  el.style.maxHeight = PREV_MAX_PX + "px";
  el.style.overflow = "hidden";
  el.style.position = "relative";
  // véu no rodapé do bloco, deixando claro que há mais texto embaixo
  const veu = document.createElement("div");
  veu.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:34px;"
    + "pointer-events:none;background:linear-gradient(to bottom,transparent," + fundo + ")";
  el.append(veu);
  const bt = document.createElement("button");
  bt.type = "button";
  bt.className = "ver-tudo";
  bt.textContent = t("show_all", { n: (texto || "").length.toLocaleString() });
  bt.onclick = (e) => {
    e.stopPropagation();
    const aberto = el.style.maxHeight === "none";
    el.style.maxHeight = aberto ? PREV_MAX_PX + "px" : "none";
    veu.style.display = aberto ? "" : "none";
    bt.textContent = t(aberto ? "show_all" : "show_less",
      { n: (texto || "").length.toLocaleString() });
  };
  return bt;
}

function renderCartaoEstilizado(div, c, mostrarResposta) {
  const p = PALETAS[localStorage.getItem("eac_style") || "esquema"] || PALETAS.esquema;
  // a prévia tem de mostrar o MESMO alinhamento que vai para o .apkg
  const al = ($("selAlinha") && $("selAlinha").value) === "left" ? "left" : "justify";
  const wrap = document.createElement("div");
  wrap.style.cssText = "background:" + p.fundo + ";padding:10px;border-radius:10px;color:" + p.texto + ";max-width:100%;overflow-wrap:anywhere;box-sizing:border-box";
  const sombra = "box-shadow:1px 2px 4px rgba(0,0,0,.3);";
  const proprio = (c.titulo || "").trim();
  const geral = tituloGeral();
  const deckNome = proprio || geral;

  if (p.cab) {
    const pill = document.createElement("div");
    pill.className = "card-cab-edit" + (proprio ? "" : " card-cab-inherit");
    pill.textContent = deckNome || t("card_title_placeholder");
    pill.title = t("card_title_edit");
    pill.style.cssText = "background:" + p.cab + ";color:#fff;font-weight:700;" +
      "text-align:center;padding:6px 22px;border-radius:11px;font-size:13.5px;margin-bottom:4px;" + sombra;
    // clicar no cabeçalho cria/edita o título PRÓPRIO deste cartão
    pill.onclick = () => editarTituloCartao(c);
    wrap.append(pill);
  }
  // badge deixando claro de onde vem o título deste cartão
  const badge = document.createElement("div");
  if (proprio) { badge.className = "card-badge-titulo card-badge-own"; badge.textContent = "● " + t("card_own_title"); }
  else if (geral) { badge.className = "card-badge-titulo card-badge-gen"; badge.textContent = "● " + t("card_using_general", { t: geral }); }
  else { badge.className = "card-badge-titulo card-badge-none"; badge.textContent = "● " + t("card_using_general_none"); }
  wrap.append(badge);
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
    ";padding:12px;text-align:" + al + ";font-size:13.5px;" + sombra;
  textoClozeResolvido(frente, c.front, p.destaque, !mostrarResposta);
  if (c.kind === "mc") {
    c.options.forEach((o, i) => {
      const li = document.createElement("div");
      li.textContent = letra(i) + ") " + o;
      frente.append(document.createElement("br"), li);
    });
  }
  wrap.append(frente);
  const btF = limitarAltura(frente, c.front, p.caixa);
  if (btF) wrap.append(btF);

  if (!mostrarResposta) return;   // verso só quando o usuário pedir
  /* A prévia tem de mostrar a MESMA divisão do arquivo exportado; quando as
   * duas divergem, o usuário só descobre o problema depois de importar. */
  const emBlocos = (el, txt, cor) => {
    const linhas = String(txt || "").split(/<br\s*\/?>/i)
      .map((s) => s.trim()).filter(Boolean);
    const blocos = [];
    linhas.forEach((l) => {
      const itens = itensDaLista(l);
      if (itens) itens.forEach((i) => blocos.push(["item", i]));
      else blocos.push(["par", l]);
    });
    if (blocos.length < 2) { el.textContent = txt || ""; return; }
    blocos.forEach(([cls, txt2], i) => {
      const d = document.createElement("div");
      d.textContent = txt2;
      d.style.margin = "0 0 8px";
      if (i) {
        d.style.borderTop = "1px solid " + cor;
        d.style.opacity = "";
        d.style.paddingTop = "8px";
        if (cls === "par") d.style.borderTopColor = cor + "55";
      }
      el.append(d);
    });
  };

  const temVerso = c.kind === "mc" || (!CLOZE_RE.test(c.front) && c.back);
  const rot2 = document.createElement("div");
  rot2.className = "lado-rotulo"; rot2.textContent = t("lado_verso");
  rot2.style.color = p.texto;
  if (temVerso) wrap.append(rot2);
  const verso = document.createElement("div");
  const longa = (c.back || "").length > 90;
  verso.style.cssText = "background:" + p.caixa + ";padding:10px;" +
    "text-align:" + (longa ? al : "center") + ";" +
    "font-weight:" + (longa ? "600" : "700") + ";" +
    "font-size:" + (longa ? "13" : "14") + "px;color:" + p.destaque + ";" + sombra;
  if (c.kind === "mc") verso.textContent = "✔ " + letra(c.correct) + ") " + (c.options[c.correct] || "");
  else if (CLOZE_RE.test(c.front)) verso.textContent = "";
  else emBlocos(verso, c.back, p.texto);
  if (temVerso) {
    wrap.append(verso);
    const btV = limitarAltura(verso, c.back, p.caixa);
    if (btV) wrap.append(btV);
  }
  if (c.more) {
    const sm = document.createElement("div");
    sm.style.cssText = "background:" + (p.sub || p.caixa) + ";color:" + p.destaque +
      ";text-align:center;padding:8px;border-radius:20px;margin-top:10px;" +
      "font-weight:700;font-size:12px;letter-spacing:.5px;" + sombra;
    sm.textContent = "✚ " + t("more_label");
    const cont = document.createElement("div");
    cont.style.cssText = "background:" + p.caixa + ";color:" + p.texto +
      ";padding:10px;text-align:" + al + ";font-size:12px;margin-top:5px;border-radius:9px;" + sombra;
    // mesmo tratamento do .apkg: um conceito por bloco, termo em destaque
    c.more.split("<br>").map((s) => s.trim()).filter(Boolean).forEach((linha) => {
      if (/^-{2,}$/.test(linha)) {
        const hr = document.createElement("hr");
        hr.style.cssText = "border:0;border-top:1px dashed " + p.texto
          + ";opacity:.4;margin:8px 0";
        cont.append(hr); return;
      }
      const it = document.createElement("div");
      it.style.margin = "0 0 7px";
      const m = linha.match(/^([^—:]{2,60})\s+—\s+([\s\S]+)$/);
      if (m) {
        const b = document.createElement("b");
        b.textContent = m[1].trim(); b.style.color = p.destaque;
        it.append(b, document.createTextNode(" — " + m[2].trim()));
      } else it.textContent = linha;
      cont.append(it);
    });
    wrap.append(sm, cont);
    const btM = limitarAltura(cont, (c.more || "").replace(/<br>/g, " "), p.caixa);
    if (btM) wrap.append(btM);
  }
  if ((c.kind === "mc" || CLOZE_RE.test(c.front)) && c.back) {
    const just = document.createElement("div");
    just.style.cssText = "background:" + p.caixa + ";color:" + p.texto +
      ";padding:10px;text-align:" + al + ";font-size:12.5px;margin-top:6px;" +
      "border-radius:0 0 11px 11px;" + sombra;
    emBlocos(just, c.back, p.texto);
    wrap.append(just);
    const btJ = limitarAltura(just, c.back, p.caixa);
    if (btJ) wrap.append(btJ);
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
  aj.onclick = () => uiAlert(t("convert_hint"));
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
async function converterTipo(c, r, idx, destino, campos) {
  if (destino === tipoAtual(c)) return;
  const novo = Object.assign({}, c, campos);

  if (destino === "cloze") {
    // Múltipla escolha -> lacuna COM as alternativas embutidas:
    // {{c1::correta::op1/op2/op3}} — o aluno vê as opções na frente e,
    // ao virar, só a correta permanece (sintaxe nativa do Anki).
    if (novo.kind === "mc") {
      const ops = (novo.options || []).map((o) => (o || "").trim()).filter(Boolean);
      if (ops.length < 2) { uiAlert(t("conv_mc_need_ops")); return; }
      const certa = ops[Math.min(novo.correct || 0, ops.length - 1)];
      const lacuna = "{{c1::" + certa + "::" + ops.join(" / ") + "}}";
      const base = semLacunas(novo.front).trim();
      const frente = base.includes(certa)
        ? base.replace(certa, lacuna)
        : base.replace(/\s*[.?!]+\s*$/, "") + " " + lacuna + ".";
      if (!(await uiConfirm(t("conv_mc_to_cloze", { depois: frente })))) return;
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
      if (!resp) { uiAlert(t("conv_need_back")); return; }
      const antes = novo.front.trim() + "  ::  " + resp;
      const frente = novo.front.trim().replace(/\s*[.?!]+\s*$/, "") +
                     " {{c1::" + resp + "}}.";
      if (!(await uiConfirm(t("conv_to_cloze", { antes, depois: frente })))) return;
      novo.front = frente;
      novo.back = "";
    }
    novo.kind = "cloze";
    delete novo.options; delete novo.correct;

  } else if (destino === "mc") {
    const correta = novo.kind === "mc"
      ? ((novo.options || [])[novo.correct] || "")
      : ((novo.back || "").trim() || primeiraLacuna(novo.front));
    if (!correta) { uiAlert(t("conv_need_answer")); return; }
    if (!(await uiConfirm(t("conv_to_mc", { resposta: correta })))) return;
    novo.front = semLacunas(novo.front);
    novo.options = [correta, ""];
    novo.correct = 0;
    novo.back = "";
    novo.kind = "mc";

  } else {
    const explica = t(novo.kind === "mc" ? "conv_basic_from_mc" : "conv_basic_from_cloze");
    if (!(await uiConfirm(t("conv_to_basic", { explica })))) return;
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


/* Há cartões cuja escrita difere da forma canônica? (é o que o
 * "Corrigir erros" arruma além dos ajustes estruturais) */
function precisaNormalizar(r) {
  return r.cards.some((c) => (c.raw || "").replace(/\s+/g, " ").trim()
                          !== cardToLineBase(c).replace(/\s+/g, " ").trim());
}


/* -------- trecho IGNORADO: ver / editar (vira cartão) / excluir ------ */

function cartaoIgnorado(ig, r) {
  const div = document.createElement("div");
  div.className = "card ignorado";
  const txt = document.createElement("div");
  txt.textContent = t("ignored_prefix") + t("card_line") + " " + ig.line + " — " +
                    (ig.texto || "").slice(0, 80);
  div.append(txt);
  const acoes = document.createElement("div");
  acoes.className = "ig-acoes";
  acoes.append(botaoMini("goto_error", "btn-cinza", () => irParaLinha(ig.line)));
  acoes.append(botaoMini("ignored_view", "btn-azul", () => abrirIgnorado(ig)));
  acoes.append(botaoMini("ignored_delete", "btn-cinza", () => excluirLinha(ig.line)));
  acoes.querySelector(".btn:last-child").style.background = "#b91c1c";
  div.append(acoes);
  return div;
}

/* Remove a linha do editor (e as linhas @/+ imediatamente ligadas a ela). */
function excluirLinha(n) {
  const linhas = $("editor").value.split("\n");
  if (n >= 1 && n <= linhas.length) {
    linhas.splice(n - 1, 1);
    $("editor").value = linhas.join("\n");
    preview();
    toast("toast_ignored_deleted");
  }
}

/* Abre o trecho ignorado nos MESMOS campos da criação, pré-preenchendo
 * o que der para aproveitar. Salvar substitui a linha por um cartão. */
let ignoradoAlvo = null;
function abrirIgnorado(ig) {
  ignoradoAlvo = ig;
  rotularModelos();
  $("selModelo").value = "qa";
  aplicarModelo();
  // aproveita o conteúdo: se tiver "::", separa; senão joga tudo na frente
  const partes = (ig.texto || "").split("::").map((s) => s.trim());
  $("novoFrente").value = partes[0] || "";
  $("novoVerso").value = partes[1] || "";
  $("novoMais").value = "";
  $("novoTags").value = partes[2] || "";
  $("dicaCampo").textContent = t("ignored_help");
  atualizarNovoPreview();
  $("dlgNovo").showModal();
}


/* Cria/edita o título PRÓPRIO de um cartão a partir da visualização.
 * O valor é escrito como "@ título" no texto (fonte única), então persiste
 * e o cartão deixa de herdar o título geral. */
function editarTituloCartao(cardRef) {
  const atualTit = (cardRef.titulo || "");
  uiPrompt(t("field_title"), atualTit).then((val) => {
    if (val === null) return;
    aplicarTituloCirurgico(cardRef.line, val.trim());
  });
}

/* Altera o título de UM cartão mexendo apenas nas linhas dele, sem
 * reescrever o texto inteiro. Remove um "@" existente (acima OU abaixo,
 * cobrindo textos antigos) e insere "@ Título" ACIMA da linha do cartão.
 * Depois rola até a linha e a destaca. */
function aplicarTituloCirurgico(linhaCartao, novoTitulo) {
  const linhas = $("editor").value.split("\n");
  let idx = linhaCartao - 1;                 // linha principal do cartão (0-based)
  if (idx < 0 || idx >= linhas.length) return;

  const ehArroba = (l) => l != null && l.trim().startsWith("@");
  const ehCartaoLinha = (l) => {
    if (l == null) return false;
    const s = l.trim();
    return s.length > 0 && !s.startsWith("#") && !s.startsWith("+") && !s.startsWith("@")
      && (splitLine(s).length > 1 || CLOZE_START_RE.test(s) || s.startsWith("[MC]"));
  };

  // 1) remove o título atual deste cartão
  if (ehArroba(linhas[idx - 1])) {
    linhas.splice(idx - 1, 1); idx--;         // título estava ACIMA
  } else if (ehArroba(linhas[idx + 1]) && !ehCartaoLinha(linhas[idx + 2])) {
    linhas.splice(idx + 1, 1);                // título estava ABAIXO (formato antigo)
  }

  // 2) insere o novo título ACIMA (se não for vazio)
  let linhaDestaque = idx + 1;
  if (novoTitulo) {
    linhas.splice(idx, 0, "@ " + novoTitulo);
    linhaDestaque = idx + 1;                  // nº (1-based) da linha do título
  } else {
    linhaDestaque = idx + 1;                  // sem título: destaca a própria linha do cartão
  }

  $("editor").value = linhas.join("\n");
  linhaNovaColada = linhaDestaque;            // reaproveita o brilho da colagem
  preview();
  irParaLinha(linhaDestaque);
  setTimeout(() => { linhaNovaColada = null; }, 2400);
  toast("toast_title_set");
}

/* Diálogo com UMA caixa de texto (reaproveita o modal animado). */
function uiPrompt(rotulo, valorInicial) {
  return new Promise((resolve) => {
    if (_uiResolve) { const rr = _uiResolve; _uiResolve = null; rr(false); }
    const m = document.getElementById("uiModal");
    document.getElementById("uiModalMsg").textContent = rotulo;
    // injeta um input logo abaixo da mensagem
    let inp = document.getElementById("uiPromptInput");
    if (!inp) {
      inp = document.createElement("input");
      inp.id = "uiPromptInput"; inp.type = "text";
      inp.style.cssText = "width:100%;margin-top:8px;padding:8px;border-radius:8px;" +
        "border:1px solid var(--borda);background:var(--campo);color:var(--texto)";
      document.getElementById("uiModalMsg").after(inp);
    }
    inp.style.display = "";
    inp.value = valorInicial || "";
    document.getElementById("uiModalOk").textContent = "OK";
    const cancel = document.getElementById("uiModalCancel");
    cancel.textContent = t("cancel_btn"); cancel.style.display = "";
    _uiResolve = (ok) => { inp.style.display = "none"; resolve(ok ? inp.value : null); };
    m.classList.add("on");
    setTimeout(() => inp.focus(), 60);
  });
}


/* --------------------- revisão por marcação ------------------------- */

function atualizarContagemRevisao() {
  // link de limpar histórico: só aparece quando há histórico para limpar
  const lim = $("btnLimparRevisados");
  if (lim) lim.style.display = revisados.size ? "" : "none";
  const el = $("revContagem");
  if (!el) return;
  let txt = marcados.size ? t("marked_count", { n: marcados.size }) : t("marked_none");
  if (ocultosRevisao) txt += " · " + t("rev_hidden_count", { n: ocultosRevisao });
  el.textContent = txt;
}

/* Marca todos os cartões do resultado atual que atendem a um critério. */
function marcarPor(criterio) {
  if (!ultimoResult) return;
  ultimoResult.cards.forEach((c) => { if (criterio(c)) marcados.add(chave(c)); });
  atualizarContagemRevisao();
  preview();
}

// critérios objetivos (forma) + risco de conteúdo (números/datas/artigos)
const CRIT = {
  curtos:  (c) => (c.front + " " + (c.back || "")).replace(/\{\{c\d+::|\}\}/g, "").trim().length < 25,
  semResp: (c) => c.kind !== "cloze" && c.kind !== "mc" && !(c.back || "").trim(),
  semPerg: (c) => c.kind === "basic" && !/\?\s*$/.test((c.front || "").trim()),
  longos:  (c) => (c.front + (c.back || "")).length > 220,
  risco:   (c) => /\b(art\.?|artigo|s[úu]mula|lei|§|inciso)\b|\d{2,}|\d+\s*%|R\$|\b(19|20)\d{2}\b/i.test(c.front + " " + (c.back || "") + " " + (c.more || "")),
};

function marcarDuplicados() {
  if (!ultimoResult) return;
  const vistos = {};
  ultimoResult.cards.forEach((c) => {
    const k = c.front.toLowerCase().trim();
    if (vistos[k]) { marcados.add(chave(c)); marcados.add(vistos[k]); }
    else vistos[k] = chave(c);
  });
  atualizarContagemRevisao();
  preview();
}

/* Copia os cartões marcados no formato do texto (pronto para colar numa IA). */
/* Cartões marcados como texto (para embutir no prompt de revisão). */
function textoMarcados() {
  return ultimoResult.cards.filter((c) => marcados.has(chave(c)))
    .map(cardToLine).join("\n\n");
}

let revCopyTipo = "rev_prompt_full";
function montarRevCopy() {
  const cards = textoMarcados();
  $("revCopyTexto").value = t(revCopyTipo).replace("{cards}", cards);
  $("btnRevTabFull").classList.toggle("ativa", revCopyTipo === "rev_prompt_full");
  $("btnRevTabShort").classList.toggle("ativa", revCopyTipo === "rev_prompt_short");
  mostrarTamanho("revCopyTam", $("revCopyTexto").value);
  $("revCopyDone").textContent = "";
}

/* Abre a janela EDITÁVEL com o prompt + cartões marcados. */
function copiarMarcados() {
  if (!ultimoResult || !marcados.size) { uiAlert(t("marked_none")); return; }
  revCopyTipo = "rev_prompt_full";
  montarRevCopy();
  $("dlgRevCopiar").showModal();
}
$("btnRevTabFull").onclick = () => { revCopyTipo = "rev_prompt_full"; montarRevCopy(); };
$("btnRevTabShort").onclick = () => { revCopyTipo = "rev_prompt_short"; montarRevCopy(); };
$("btnRevCopyFechar").onclick = () => $("dlgRevCopiar").close();
$("btnRevCopyCopiar").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("revCopyTexto").value);
    $("revCopyDone").textContent = t("revcopy_done");   // mensagem: copiado + próximo passo
    toast("toast_copied_marked");
  } catch (e) { uiAlert(t("paste_denied")); }
};

// elementos que ficam TRAVADOS durante a revisão (só o painel de revisão fica ativo)
/* Travados durante a revisão: só o que ALTERA o conteúdo. Controles de
 * visualização (colunas, estilo) continuam livres — travá-los era um bug. */
const TRAVAR = ["btnNovoCartao","btnMCRapido","btnPromptIA","btnNormalizar",
  "btnColarMais","btnDesfazerColagem","btnSelecionarTudo","btnCopiarTudo",
  "btnApagarTudo","btnTxt","btnApkg","tituloGeral","btnApkgImport","btnImportar"];

function travarFuncoes(travar) {
  document.body.classList.toggle("em-revisao", travar);
  TRAVAR.forEach((id) => { const el = $(id); if (el) el.disabled = travar; });
  $("editor").readOnly = travar;   // editor só-leitura durante a revisão
}

function entrarRevisao() {
  modoRevisao = true;
  revisaoSnapshot = $("editor").value;   // ponto de restauração p/ cancelar
  marcados.clear();   // "já revisado" NÃO é apagado: é o histórico entre rodadas
  $("barraRevisao").style.display = "";
  $("btnRevisar").style.display = "none";
  $("btnRevFinalizar").style.display = "";
  $("btnRevCancelar").style.display = "";
  travarFuncoes(true);
  atualizarContagemRevisao();
  preview();
  // se já houve rodadas anteriores, avisa que dá para esconder o que já foi
  // conferido — é o que deixa a tela só com o que ainda falta
  const jaRev = parseAtual().cards.filter((c) => revisados.has(chaveRev(c))).length;
  toast(jaRev ? t("toast_review_started_hint", { n: jaRev }) : t("toast_review_started"));
}

function sairRevisao() {
  modoRevisao = false;
  revisaoSnapshot = null;
  marcados.clear();
  $("chkFiltro").checked = false;
  $("chkOcultarRev").checked = false;
  $("barraRevisao").style.display = "none";
  $("btnRevisar").style.display = "";
  $("btnRevFinalizar").style.display = "none";
  $("btnRevCancelar").style.display = "none";
  travarFuncoes(false);
  preview();
}

$("btnRevisar").onclick = entrarRevisao;
$("btnRevFinalizar").onclick = () => { sairRevisao(); toast("toast_review_finished"); };
$("btnRevCancelar").onclick = async () => {
  if (!(await uiConfirm(t("review_cancel_confirm")))) return;
  if (revisaoSnapshot !== null) { $("editor").value = revisaoSnapshot; autoSalvar(); }
  sairRevisao();
  toast("toast_review_cancelled");
};
$("selTodos").onclick = () => marcarPor(() => true);
$("selCurtos").onclick = () => marcarPor(CRIT.curtos);
$("selSemResp").onclick = () => marcarPor(CRIT.semResp);
$("selSemPerg").onclick = () => marcarPor(CRIT.semPerg);
$("selLongos").onclick = () => marcarPor(CRIT.longos);
$("selRisco").onclick = () => marcarPor(CRIT.risco);
$("selDup").onclick = marcarDuplicados;
$("selLimpar").onclick = () => { marcados.clear(); atualizarContagemRevisao(); preview(); };
$("chkFiltro").onchange = () => preview();
$("chkOcultarRev").onchange = () => { preview(); atualizarContagemRevisao(); };
$("btnLimparRevisados").onclick = async () => {
  if (!revisados.size) { uiAlert(t("rev_clear_none")); return; }
  if (!(await uiConfirm(t("rev_clear_confirm", { n: revisados.size })))) return;
  revisados.clear(); salvarRevisados();
  reg("REVISAO", "histórico de 'já revisado' apagado");
  $("chkOcultarRev").checked = false;
  preview(); atualizarContagemRevisao();
  toast("toast_rev_cleared");
};
$("btnCopiarMarcados").onclick = copiarMarcados;

/* Remove o BLOCO de um cartão (título @ acima + linha + explicação +)
 * do array de linhas, sem tocar nos vizinhos. */
function removerBlocoCartao(linhas, linhaCartao) {
  let idx = linhaCartao - 1;
  if (idx < 0 || idx >= linhas.length) return;
  let fim = idx;
  while (fim + 1 < linhas.length && linhas[fim + 1].trim().startsWith("+")) fim++;
  let ini = idx;
  if (ini - 1 >= 0 && linhas[ini - 1].trim().startsWith("@")) ini--;
  linhas.splice(ini, fim - ini + 1);
}

/* Fecha o ciclo com a IA: cola a correção, REMOVE os cartões marcados e
 * insere a versão corrigida no lugar — sem duplicar nem sobrar os antigos. */
async function substituirMarcados() {
  if (!ultimoResult || !marcados.size) { uiAlert(t("marked_none")); return; }
  // tenta pré-preencher com a área de transferência; se não der, abre vazio
  // para o usuário colar (Ctrl+V) e editar dentro do próprio painel.
  let correcao = "";
  try { correcao = await navigator.clipboard.readText(); } catch (e) { correcao = ""; }
  abrirColarRev(correcao || "");
}

/* Painel temporário: mostra a correção colada, faz as MESMAS críticas do
 * editor (linhas ignoradas, cartões a verificar, marcadores, título grudado,
 * tags que são texto), com "Ver no texto" e "Corrigir" — e só libera o
 * "Finalizar" quando o texto está sem erros. */
let colarRevMarcados = null;   // linhas dos marcados no editor (para remover)

function abrirColarRev(correcao) {
  colarRevMarcados = ultimoResult.cards
    .filter((c) => marcados.has(chave(c))).map((c) => c.line).sort((a, b) => b - a);
  $("colarRevTexto").value = correcao.replace(/^\s+/, "");
  $("colarRevTexto").placeholder = t("colarrev_ph");
  analisarColarRev();
  $("dlgColarRev").showModal();
  setTimeout(() => $("colarRevTexto").focus(), 60);
}

/* Corrige um trecho e reanalisa (usada pelos botões do painel). */
function corrigirColarRev(fn) {
  $("colarRevTexto").value = corrigirComSeguranca(fn, $("colarRevTexto").value);
  analisarColarRev();
  toast("toast_fixed");
}

/* Leva à linha dentro do textarea do painel. */
function irLinhaColarRev(n) {
  const ta = $("colarRevTexto");
  const linhas = ta.value.split("\n");
  if (n < 1 || n > linhas.length) return;
  let ini = 0; for (let i = 0; i < n - 1; i++) ini += linhas[i].length + 1;
  ta.focus(); ta.setSelectionRange(ini, ini + linhas[n - 1].length);
}

function renderNumsColarRev() {
  const ta = $("colarRevTexto"), nums = $("colarRevNums");
  if (!ta || !nums) return;
  const n = ta.value.split("\n").length;
  let html = "";
  for (let i = 1; i <= n; i++) html += i + "\n";
  nums.textContent = html;
  nums.scrollTop = ta.scrollTop;
}

function analisarColarRev() {
  renderNumsColarRev();
  const raw = $("colarRevTexto").value;
  const r = parseText(raw, []);
  const box = $("colarRevSug");
  box.innerHTML = "";
  const itens = [];
  (r.warnLines || []).forEach((n, i) =>
    itens.push({ dot: "dot-red", txt: r.warnings[i], linha: n }));
  r.cards.filter((c) => c.issues.length).forEach((c) => {
    const item = { dot: "dot-org", txt: t("card_line") + " " + c.line + ": " + c.issues[0], linha: c.line };
    // avisos de "alternativa longa na lacuna" têm correção automática
    if (temLacunaOpcoesLongas(cardToLine(c))) {
      item.fix = corrigirLacunaOpcoesLongas; item.fixTxt = t("fix_lacuna_ops");
    }
    itens.push(item);
  });
  let correcao = null, critTxt = t("crit_bullets");
  if (temPromptVazado(raw))
    itens.push({ dot: "dot-red", txt: t("crit_prompt_leak"),
                 fixTxt: t("fix_prompt_leak"), fix: corrigirPromptVazado });
  if (temMaisRepetido(raw))
    itens.push({ dot: "dot-org", txt: t("crit_mais_rep"),
                 fixTxt: t("fix_mais_rep"), fix: corrigirMaisRepetido });
  if (temPromptVazado(raw)) { correcao = corrigirPromptVazado; critTxt = t("crit_prompt_leak"); }
  else if (temMaisRepetido(raw)) { correcao = corrigirMaisRepetido; critTxt = t("crit_mais_rep"); }
  else if (temClozeRepetida(raw)) { correcao = corrigirClozeRepetida; critTxt = t("crit_cloze_rep"); }
  else if (temTagsNaExplicacao(raw)) { correcao = corrigirTagsNaExplicacao; critTxt = t("crit_tags_in_more"); }
  else if (temTituloGrudado(raw)) { correcao = corrigirTituloGrudado; critTxt = t("crit_title_glued"); }
  else if (temOrfaosExplicacao(raw)) { correcao = corrigirOrfaosExplicacao; critTxt = t("crit_orphans"); }
  else if (temLacunaOpcoesLongas(raw)) { correcao = corrigirLacunaOpcoesLongas; critTxt = t("crit_lacuna_ops"); }
  else if (temTagsQueSaoTexto(raw)) { correcao = corrigirTagsQueSaoTexto; critTxt = t("crit_pairs_tags"); }
  else if (temMarcadores(raw)) { correcao = removerMarcadoresTexto; critTxt = t("crit_bullets"); }
  if (correcao) itens.push({ dot: "dot-org", txt: critTxt, fixTxt: t("fix_now"), fix: correcao });

  itens.slice(0, 8).forEach((it) => {
    const div = document.createElement("div");
    div.className = "sug";
    const dot = document.createElement("span"); dot.className = "dot " + it.dot;
    const sp = document.createElement("span"); sp.textContent = it.txt;
    /* Quem resolve cada coisa. A lista misturava dois mundos: o que o app
     * arruma sozinho (formato) e o que só a IA arruma (dividir um cartão
     * longo, encurtar alternativa). Sem essa marca o usuário clica em
     * "Corrigir" esperando que resolva tudo — e conclui que está quebrado. */
    const daIA = !(it.fix || it.acao);
    const quem = document.createElement("span");
    quem.className = "sug-quem " + (daIA ? "quem-ia" : "quem-app");
    quem.textContent = t(daIA ? "quem_ia" : "quem_app");
    if (daIA) {
      /* O crachá diz QUEM resolve; o ícone diz COMO. Passar o mouse mostra
       * a dica; tocar (celular, onde não existe "passar o mouse") abre o
       * mesmo texto num aviso. */
      const info = document.createElement("button");
      info.className = "sug-info";
      info.type = "button";
      info.textContent = "?";
      info.title = t("quem_ia_dica");
      info.setAttribute("aria-label", t("quem_ia_dica"));
      info.onclick = (e) => { e.stopPropagation(); uiAlert(t("quem_ia_dica")); };
      quem.append(info);
    }
    div.append(dot, quem, sp);
    if (it.linha) div.append(botaoMini("goto_error", "btn-cinza", () => irLinhaColarRev(it.linha)));
    if (it.fix) div.append(botaoMini("fix_now", "btn-azul", () => corrigirColarRev(it.fix)));
    box.append(div);
  });

  // pode finalizar? (sem linhas ignoradas e sem cartões a verificar)
  const problemas = r.warnings.length + r.nSuspicious + (correcao ? 1 : 0);
  const podeFinalizar = problemas === 0 && r.cards.length > 0;
  $("btnColarRevFinalizar").disabled = !podeFinalizar;
  const st = $("colarRevStatus");
  st.textContent = podeFinalizar ? t("pastepanel_clean") : t("pastepanel_haserr", { n: problemas });
  st.style.color = podeFinalizar ? "var(--verde)" : "var(--laranja)";
}

/* Só ao finalizar: remove os marcados e insere a correção; marca os novos
 * cartões como "já revisado" (verde). */
function finalizarColarRev() {
  const correcao = $("colarRevTexto").value;
  const rNovo = parseText(correcao, []);
  colagemAnterior = { texto: $("editor").value };
  const linhas = $("editor").value.split("\n");
  (colarRevMarcados || []).forEach((ln) => removerBlocoCartao(linhas, ln));
  let base = linhas.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
  const juntado = base ? base + "\n\n" + correcao.replace(/^\s+/, "") : correcao.replace(/^\s+/, "");
  $("editor").value = juntado;

  const qtd = (colarRevMarcados || []).length;
  marcados.clear();
  // marca os cartões vindos da correção como "já revisado"
  parseAtual().cards.forEach((c) => {
    if (rNovo.cards.some((n) => n.front === c.front)) revisados.add(chaveRev(c));
  });
  salvarRevisados();
  $("btnDesfazerColagem").disabled = false;
  linhaNovaColada = base ? base.split("\n").length + 2 : 1;
  autoSalvar();
  $("dlgColarRev").close();
  atualizarContagemRevisao();
  preview();
  irParaLinha(linhaNovaColada);
  setTimeout(() => { linhaNovaColada = null; }, 2400);
  toast(t("toast_replaced", { n: qtd }));
}

$("colarRevTexto").addEventListener("input", analisarColarRev);
$("colarRevTexto").addEventListener("scroll", () => {
  $("colarRevNums").scrollTop = $("colarRevTexto").scrollTop;
});
$("btnColarRevExpandir").onclick = () => {
  const w = $("colarRevWrap");
  const exp = w.classList.toggle("expandido");
  $("btnColarRevExpandir").textContent = t(exp ? "panel_collapse" : "panel_expand");
};
attachTip($("btnColarRevExpandir"), "tip_panel_expand");
$("btnColarRevFinalizar").onclick = finalizarColarRev;
$("btnColarRevFechar").onclick = () => $("dlgColarRev").close();
/* Fecha o ciclo do "Prompt de correção": o usuário sai daqui com o prompt,
 * vai à IA e volta com o texto corrigido. Este botão troca o conteúdo do
 * painel pela resposta da IA sem precisar selecionar tudo à mão. */
$("btnColarRevColar").onclick = async () => {
  let novo = "";
  try { novo = await navigator.clipboard.readText(); }
  catch (e) { uiAlert(t("paste_denied_manual")); return; }
  if (!novo.trim()) { uiAlert(t("paste_empty")); return; }
  const atual = $("colarRevTexto").value.trim();
  if (atual && atual !== novo.trim()
      && !(await uiConfirm(t("pastepanel_replace_confirm")))) return;
  $("colarRevTexto").value = novo.replace(/^\s+/, "");
  analisarColarRev();
  $("colarRevTexto").focus();
  toast("toast_pasted_fix");
};
attachTip($("btnColarRevColar"), "tip_pastepanel_paste");

$("btnColarRevPrompt").onclick = () => abrirPromptCorrecao($("colarRevTexto").value);
attachTip($("btnColarRevPrompt"), "tip_fixprompt");
$("btnSubstituirMarcados").onclick = substituirMarcados;
attachTip($("btnRevisar"), "tip_review_btn");
attachTip($("selTodos"), "tip_sel_all");
attachTip($("selCurtos"), "tip_sel_short");
attachTip($("selSemResp"), "tip_sel_noanswer");
attachTip($("selSemPerg"), "tip_sel_noquestion");
attachTip($("selLongos"), "tip_sel_long");
attachTip($("selDup"), "tip_sel_dup");
attachTip($("selRisco"), "tip_sel_risky");
attachTip($("selLimpar"), "tip_sel_clear");
attachTip($("chkFiltro"), "tip_filter");
attachTip($("chkOcultarRev"), "tip_hide_reviewed");
attachTip($("btnLimparRevisados"), "tip_clear_reviewed");
attachTip($("btnCopiarMarcados"), "tip_copy_marked");
attachTip($("btnSubstituirMarcados"), "tip_replace_marked");

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

const CAMPO_CLASSE = {
  field_front: "campo-frente", field_back: "campo-verso",
  field_more: "campo-mais", field_title: "campo-titulo", field_tags: "campo-tags",
};

function campoEditavel(pai, rotuloKey, hintKey, valor, multiline, opcoes) {
  opcoes = opcoes || {};
  const paiReal = pai;
  // cada campo vive num "box" com faixa colorida à esquerda e etiqueta
  const box = document.createElement("div");
  box.className = "campo-box " + (CAMPO_CLASSE[rotuloKey] || "");
  pai = box;
  const lbl = document.createElement("span");
  lbl.className = "mini-lbl";
  const pino = document.createElement("span");
  pino.className = "pino";
  lbl.append(pino, document.createTextNode(t(rotuloKey) + " "));
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
  paiReal.append(box);
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
    aj.onclick = () => uiAlert(t("hint_mc_cloze"));
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
  aj.onclick = () => uiAlert(t("hint_mc"));
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
let normAjuste = null;   // ajuste estrutural pendente (título grudado etc.)

/* Devolve as primeiras linhas que diferem entre dois textos — é o que
 * o usuário precisa ver para decidir, sem despejar o texto inteiro. */
function primeiraDiferenca(a, b, querAntes) {
  const la = a.split("\n"), lb = b.split("\n");
  const saida = [];
  for (let i = 0, j = 0; i < la.length && saida.length < 4; i++, j++) {
    if (la[i] !== lb[j]) {
      saida.push(querAntes ? la[i] : (lb[j] || "") + (lb[j + 1] ? "\n" + lb[j + 1] : ""));
      if (!querAntes) j++;
    }
  }
  return saida.join("\n") || (querAntes ? a.slice(0, 160) : b.slice(0, 160));
}

/* ajusteEstrutural (opcional): função que reescreve o texto inteiro
 * (ex.: separar título grudado). Entra na lista como item revisável,
 * com antes/depois, e só é aplicada se ficar marcada. */
function abrirNormalizar(ajusteEstrutural) {
  normAjuste = null;
  if (typeof ajusteEstrutural === "function") {
    const antes = $("editor").value;
    const depois = ajusteEstrutural(antes, true);   // prévia: não registra
    if (depois !== antes) normAjuste = { antes, depois, fn: ajusteEstrutural, chk: null };
  }
  const r = parseText($("editor").value, []);
  const lista = $("normLista");
  lista.innerHTML = "";
  normPlano = [];
  let mudancas = 0;

  // primeiro item: ajuste de estrutura (quando houver), com antes/depois
  if (normAjuste) {
    mudancas++;
    const div = document.createElement("div");
    div.className = "norm-item";
    const cab = document.createElement("div");
    cab.className = "cab-n";
    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.checked = true;
    chk.style.cssText = "width:17px;height:17px";
    normAjuste.chk = chk;
    cab.append(chk, document.createTextNode(t("norm_struct_title")));
    const difA = document.createElement("div");
    difA.className = "antes";
    difA.textContent = primeiraDiferenca(normAjuste.antes, normAjuste.depois, true);
    const difB = document.createElement("div");
    difB.className = "depois";
    difB.textContent = primeiraDiferenca(normAjuste.antes, normAjuste.depois, false);
    div.append(cab, difA, difB);
    lista.append(div);
  }

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
  // ajuste estrutural primeiro (muda o texto todo) e reabre para revisão
  if (normAjuste && normAjuste.chk && normAjuste.chk.checked) {
    $("editor").value = normAjuste.fn($("editor").value, false);   // agora vale
    normAjuste = null;
    $("dlgNormalizar").close();
    preview();
    toast("toast_fixed");
    return;
  }
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

async function validar() {
  const r = parseAtual();
  const sel = selecionados(r);
  if (!sel.length) { uiAlert(t("none_msg")); return null; }
  const rSel = Object.assign({}, r, { cards: sel });
  rSel.nSuspicious = sel.filter((c) => c.issues.length).length;
  if (rSel.nSuspicious || r.warnings.length) {
    const itens = [];
    sel.forEach((c) => c.issues.forEach((i) => itens.push("• " + t("card_line") + " " + c.line + ": " + i)));
    r.warnings.forEach((w) => itens.push("• " + w));
    const ok = await uiConfirm(t("problems_msg", { resumo: itens.slice(0, 6).join("\n") }));
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
  const r = await validar(); if (!r) return;
  const txt = exportTxtString(r, nomeDeck());
  await entregar(new TextEncoder().encode(txt), nomeArquivo() + ".txt", "text/plain");
  $("status").textContent = t("status_saved", { f: nomeArquivo() + ".txt" });
  toast("toast_exported");
  uiAlert(t("txt_done_msg"));
}

async function exportarApkg() {
  const r = await validar(); if (!r) return;
  $("status").textContent = "…";
  try {
    const bytes = await buildApkg(r.cards, nomeDeck(), $("selEstilo").value,
                                  tituloCartao(), $("selAlinha").value);
    await entregar(bytes, nomeArquivo() + ".apkg", "application/octet-stream");
    $("status").textContent = t("status_saved", { f: nomeArquivo() + ".apkg" });
    /* Sem este evento eu nao conseguia responder a pergunta que mais
     * importava quando o texto sumiu: existia uma copia fora do app? */
    reg("EXPORTAR", nomeArquivo() + ".apkg",
        r.cards.length + " cartões, estilo " + $("selEstilo").value);
    toast("toast_exported");
    const partes = nomeDeck().split("::").map((p) => p.trim()).filter(Boolean);
    uiAlert(t("apkg_done_msg", { dest: partes.join("  >  ") }));
  } catch (e) {
    uiAlert(t("apkg_err_title") + "\n\n" + e);
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

$("btnInserir").onclick = async () => {
  const modelo = $("selModelo").value;
  // Sugestão ao finalizar: correta em 1º lugar? Oferece embaralhar.
  if (modelo === "mc") {
    const { options, correct } = lerAlternativas();
    if (options.length >= 2 && correct === 0 && await uiConfirm(t("shuffle_suggest")))
      $("btnEmbaralhar").onclick();
  } else if (modelo === "mc_cloze") {
    const { certa, ops } = opcoesCloze();
    if (ops.length >= 2 && ops[0] === certa && await uiConfirm(t("shuffle_suggest")))
      $("btnEmbaralharCloze").onclick();
  }
  const res = montarLinhaNovo();
  if (res.erro) { uiAlert(res.erro); return; }
  if (ignoradoAlvo) {
    // substitui a linha ignorada pelo cartão montado
    const linhas = $("editor").value.split("\n");
    if (ignoradoAlvo.line >= 1 && ignoradoAlvo.line <= linhas.length)
      linhas[ignoradoAlvo.line - 1] = res.linha;
    $("editor").value = linhas.join("\n");
    ignoradoAlvo = null;
    $("dlgNovo").close();
    preview();
    toast("toast_ignored_saved");
    return;
  }
  const atual = $("editor").value.replace(/\s+$/, "");
  $("editor").value = (atual ? atual + "\n\n" : "") + res.linha + "\n";
  $("dlgNovo").close();
  preview();
  toast("toast_added");
};
document.querySelectorAll(".ic-ajuda[data-hint]").forEach((b) => {
  b.onclick = () => { $("dicaCampo").textContent = t(b.dataset.hint); };
});

/* Limite prático do Gemini Notebook (referência: 10.000 caracteres do
 * limite documentado de personalização; acima disso costuma falhar). */
const LIMITE_NOTEBOOK = 10000;

function mostrarTamanho(idEl, texto) {
  const el = $(idEl);
  if (!el) return;
  const n = (texto || "").length;
  const grande = n > LIMITE_NOTEBOOK;
  el.textContent = t("size_label") + " " + t(grande ? "size_warn" : "size_ok",
    { n: n.toLocaleString() });
  el.style.color = grande ? "var(--laranja)" : "var(--sutil)";
  el.style.fontWeight = grande ? "700" : "400";
}

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
  mostrarTamanho("promptTam", $("promptTexto").value);
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
$("promptTexto").addEventListener("input", () => mostrarTamanho("promptTam", $("promptTexto").value));
$("revCopyTexto").addEventListener("input", () => mostrarTamanho("revCopyTam", $("revCopyTexto").value));
$("genTexto").addEventListener("input", () => mostrarTamanho("genTam", $("genTexto").value));
$("btnPromptCopiar").onclick = async () => {
  await navigator.clipboard.writeText($("promptTexto").value);
  toast("toast_copied");
  $("status").textContent = t("prompt_copied_status");
};


/* ------------------- colar mais texto / desfazer -------------------- */

async function colarMaisTexto() {
  let novo = "";
  try { novo = await navigator.clipboard.readText(); }
  catch (e) { uiAlert(t("paste_denied")); return; }
  if (!novo || !novo.trim()) { uiAlert(t("paste_empty")); return; }

  const ed = $("editor");
  colagemAnterior = { texto: ed.value };   // guarda para o "desfazer"
  const tinha = ed.value.replace(/\s+$/, "");
  // insere ao final (ou no início se estava vazio), com linha em branco
  // de separação para não colar no meio de um cartão existente
  const juntado = tinha ? tinha + "\n\n" + novo.replace(/^\s+/, "") : novo.replace(/^\s+/, "");
  ed.value = juntado;

  // 1ª linha do trecho novo (para rolar até lá e brilhar)
  linhaNovaColada = tinha ? tinha.split("\n").length + 2 : 1;
  $("btnDesfazerColagem").disabled = false;
  reg("COLAR-EDITOR", "texto colado no editor",
      (colagemAnterior ? colagemAnterior.texto.length : 0) + " -> "
      + $("editor").value.length + " caracteres");
  preview();
  irParaLinha(linhaNovaColada);
  ed.setSelectionRange(  // posiciona o cursor no início do novo texto
    juntado.length - novo.replace(/^\s+/, "").length,
    juntado.length - novo.replace(/^\s+/, "").length);
  toast("toast_pasted");
  // remove o brilho depois da animação, mas mantém o realce durante ela
  setTimeout(() => { linhaNovaColada = null; }, 2400);
}

function desfazerColagem() {
  if (!colagemAnterior) return;
  $("editor").value = colagemAnterior.texto;
  colagemAnterior = null;
  linhaNovaColada = null;
  $("btnDesfazerColagem").disabled = true;
  preview();
  toast("toast_paste_undone");
}

$("btnColarMais").onclick = colarMaisTexto;
$("btnDesfazerColagem").onclick = desfazerColagem;
attachTip($("btnColarMais"), "paste_more");
attachTip($("btnDesfazerColagem"), "undo_paste");


/* ---------------- Importar arquivo (gaveta retrátil) ---------------- */

/* Desktop (pywebview) expõe window.pywebview.api — inclusive quando a
 * interface é carregada do SITE (o pywebview injeta a ponte em qualquer
 * página). Então o MarkItDown funciona mesmo mostrando a versão da web. */
function ehDesktop() { return !!(window.pywebview && window.pywebview.api); }

let ultimosImportados = null;   // [{nome, tamIn, tamOut, texto}] do último import

function toggleGaveta(forcar) {
  const corpo = $("gavetaImportar");
  const aberto = forcar !== undefined ? forcar : corpo.hidden;
  corpo.hidden = !aberto;
  $("alcaImportar").setAttribute("aria-expanded", aberto ? "true" : "false");
  localStorage.setItem("eac_gaveta", aberto ? "1" : "0");
}
$("alcaImportar").onclick = () => toggleGaveta();

function configurarImportar() {
  const desktop = ehDesktop();
  $("alcaImportar").classList.toggle("desktop-ok", desktop);
  $("importAviso").textContent = desktop ? "" : t("import_notice");
  $("importAviso").style.display = desktop ? "none" : "";
}

/* Barra de progresso da conversão (arquivo a arquivo). */
function progresso(i, n, nome) {
  const box = $("importProgresso");
  if (i === null) { box.style.display = "none"; return; }
  box.style.display = "";
  $("importProgTxt").textContent = t("import_progress", { i, n, nome });
  $("importProgFill").style.width = Math.round((i / n) * 100) + "%";
}

$("btnImportar").onclick = async () => {
  if (!ehDesktop()) { uiAlert(t("import_notice")); return; }
  let caminhos = [];
  try { caminhos = await window.pywebview.api.escolher_arquivos(); }
  catch (e) { uiAlert(t("import_error") + "\n\n" + e); return; }
  if (!caminhos || !caminhos.length) return;

  const resultados = [];
  for (let i = 0; i < caminhos.length; i++) {
    const nome = caminhos[i].split(/[\\/]/).pop();
    progresso(i, caminhos.length, nome);       // barra 0→100%, arquivo por arquivo
    try {
      const r = await window.pywebview.api.converter_um(caminhos[i]);
      resultados.push(r && r.erro ? { nome, erro: r.erro } : r);
    } catch (e) { resultados.push({ nome, erro: String(e) }); }
  }
  progresso(caminhos.length, caminhos.length, "");
  setTimeout(() => progresso(null), 300);
  ultimosImportados = (ultimosImportados || []).concat(resultados);   // soma, não apaga
  $("btnImportarReabrir").style.display = "";
  abrirImportResultado(ultimosImportados);
};

$("btnImportarReabrir").onclick = () => {
  if (ultimosImportados) abrirImportResultado(ultimosImportados);
};

/* Janela de prompt editável para gerar cartões a partir de um texto.
 * Usa os prompts de geração já existentes (completo / curto Gemini). */
let genTipo = "prompt_full";
let genTextoBase = "";
function montarGen() {
  const p = t(genTipo).replace("[cole aqui o material de estudo]", genTextoBase)
    .replace("[paste your study material here]", genTextoBase);
  $("genTexto").value = p;
  $("btnGenFull").classList.toggle("ativa", genTipo === "prompt_full");
  $("btnGenShort").classList.toggle("ativa", genTipo === "prompt_mini");
  mostrarTamanho("genTam", $("genTexto").value);
  $("genDone").textContent = "";
}
function abrirGerar(texto) {
  genTextoBase = texto || "";
  genTipo = "prompt_full";
  montarGen();
  $("dlgGerar").showModal();
}
$("btnGenFull").onclick = () => { genTipo = "prompt_full"; montarGen(); };
$("btnGenShort").onclick = () => { genTipo = "prompt_mini"; montarGen(); };
/* Terminada a importacao, o proximo passo e' colar os cartoes — que
 * acontece na bancada. Voltar sozinho evita o usuario fechar a janela e
 * ficar olhando para a tela de ferramentas sem entender para onde ir. */
$("btnGenFechar").onclick = () => {
  $("dlgGerar").close();
  if (typeof modoAtual !== "undefined" && modoAtual === "ferramentas") trocarModo("cartoes");
};
$("btnGenCopiar").onclick = async () => {
  try { await navigator.clipboard.writeText($("genTexto").value);
    $("genDone").textContent = t("gen_copied"); toast("toast_import_gen"); }
  catch (e) { uiAlert(t("paste_denied")); }
};
attachTip($("btnImportar"), "tip_import_choose");

/* ---------- Importar baralho do Anki (.apkg) — web e desktop ---------- */
$("btnApkgImport").onclick = () => $("apkgFile").click();
attachTip($("btnApkgImport"), "tip_apkg_import");
$("apkgFile").onchange = async (ev) => {
  const arq = ev.target.files && ev.target.files[0];
  ev.target.value = "";                    // permite reimportar o mesmo arquivo
  if (!arq) return;
  toast("apkg_reading");
  let r;
  try { r = await lerApkg(await arq.arrayBuffer()); }
  catch (e) {
    const msg = String(e && e.message || e);
    if (msg.indexOf("ZSTD") >= 0 || msg.indexOf("SO_AVISO") >= 0) uiAlert(t("apkg_zstd"));
    else uiAlert(t("apkg_error") + "\n\n" + msg);
    return;
  }
  if (!r.cards.length) { uiAlert(t("apkg_none")); return; }
  const deck = r.deck || arq.name.replace(/\.apkg$/i, "");
  if (!(await uiConfirm(t("apkg_confirm", { n: r.cards.length, deck })))) return;

  // acrescenta ao final do texto (nada é apagado) e destaca o início
  colagemAnterior = { texto: $("editor").value };
  const novo = r.cards.map(cardToLine).join("\n\n");
  const base = $("editor").value.replace(/\s+$/, "");
  $("editor").value = (base ? base + "\n\n" : "") + novo + "\n";
  linhaNovaColada = base ? base.split("\n").length + 2 : 1;
  $("btnDesfazerColagem").disabled = false;
  if (deck && !$("deckExp").value.trim()) { $("deckExp").value = deck; atualizarDestino(); }
  autoSalvar();
  preview();
  irParaLinha(linhaNovaColada);
  setTimeout(() => { linhaNovaColada = null; }, 2400);
  toast(t("apkg_done", { n: r.cards.length, deck }));
};
attachTip($("btnImportarReabrir"), "tip_import_reopen");

function baixarArquivo(conteudo, nome, mime) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function nomeBase(nome) { return (nome || "documento").replace(/\.[^.]+$/, ""); }

/* Painel de resultado: cada arquivo isolado num bloco próprio, com sua
 * prévia editável e botões de copiar/salvar; + ações globais no rodapé. */
function abrirImportResultado(lista) {
  const box = $("importLista");
  box.innerHTML = "";
  lista.forEach((r, idx) => {
    const arq = document.createElement("div");
    arq.className = "imp-arq";
    const cab = document.createElement("div");
    cab.className = "imp-cab";
    const nome = document.createElement("span");
    nome.className = "imp-nome"; nome.textContent = "📄 " + (r.nome || "arquivo");
    const tam = document.createElement("span");
    tam.className = "imp-tam";
    tam.textContent = r.erro ? "erro" : t("import_size", { ina: r.tamIn || "", out: r.tamOut || "" });
    cab.append(nome, tam);
    arq.append(cab);
    const corpo = document.createElement("div");
    corpo.className = "imp-corpo";
    const rot = document.createElement("div");
    rot.style.cssText = "font-size:11px;color:var(--sutil);margin-bottom:3px";
    rot.textContent = r.nome || "";
    if (!r.erro) corpo.append(rot);
    if (r.erro) {
      const e = document.createElement("div");
      e.className = "issue"; e.textContent = "(!) " + t("import_error") + " " + r.erro;
      corpo.append(e);
    } else {
      const ta = document.createElement("textarea");
      ta.value = r.texto || "";
      r._el = ta;
      const acoes = document.createElement("div");
      acoes.className = "imp-acoes";
      const bC = document.createElement("button");
      bC.className = "btn btn-cinza"; bC.textContent = t("import_file_copy");
      bC.onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast("toast_copied_txt"); } catch (e) { uiAlert(t("paste_denied")); } };
      attachTip(bC, "tip_import_copy");
      const bM = document.createElement("button");
      bM.className = "btn btn-cinza"; bM.textContent = t("import_file_md");
      bM.onclick = () => { baixarArquivo(ta.value, nomeBase(r.nome) + ".md", "text/markdown"); toast("toast_saved_md"); };
      attachTip(bM, "tip_import_md");
      const bT = document.createElement("button");
      bT.className = "btn btn-cinza"; bT.textContent = t("import_file_txt");
      bT.onclick = () => { baixarArquivo(ta.value, nomeBase(r.nome) + ".txt", "text/plain"); toast("toast_saved_txt"); };
      attachTip(bT, "tip_import_txt");
      const bG = document.createElement("button");
      bG.className = "btn btn-azul"; bG.textContent = t("import_gen");
      bG.onclick = () => abrirGerar(ta.value);          // gerar cartões DESTE arquivo
      attachTip(bG, "tip_import_gen");
      acoes.append(bC, bM, bT, bG);
      corpo.append(ta, acoes);
    }
    arq.append(corpo);
    box.append(arq);
  });
  $("dlgImportar").showModal();
}

/* junta o texto de todos os arquivos válidos. */
function textoTodosImportados() {
  return (ultimosImportados || [])
    .filter((r) => !r.erro)
    .map((r) => "# " + (r.nome || "") + "\n" + (r._el ? r._el.value : r.texto || ""))
    .join("\n\n");
}

$("btnImpCopiarTudo").onclick = async () => {
  try { await navigator.clipboard.writeText(textoTodosImportados()); toast("toast_copied_txt"); }
  catch (e) { uiAlert(t("paste_denied")); }
};
$("btnImpGerarTudo").onclick = () => abrirGerar(textoTodosImportados());
$("btnImpLimpar").onclick = () => {
  ultimosImportados = null;
  $("btnImportarReabrir").style.display = "none";
  $("dlgImportar").close();
};
$("btnImpFechar").onclick = () => $("dlgImportar").close();
attachTip($("btnImpCopiarTudo"), "tip_import_copy_all");
attachTip($("btnImpGerarTudo"), "tip_import_gen_all");
attachTip($("btnImpLimpar"), "tip_import_clear");

// estado inicial: no desktop abre (recurso principal); no navegador fica fechada
configurarImportar();
const gavetaSalva = localStorage.getItem("eac_gaveta");
toggleGaveta(gavetaSalva !== null ? gavetaSalva === "1" : ehDesktop());
window.addEventListener("pywebviewready", () => {
  configurarImportar();
  if (localStorage.getItem("eac_gaveta") === null) toggleGaveta(true);
});


/* Dicas de funcionamento — cobertura completa dos botões visíveis. */
[["btnSelecionarTudo","select_all"],["btnCopiarTudo","copy_all"],["btnApagarTudo","clear_all"],
 ["btnColarMais","paste_more"],["btnDesfazerColagem","undo_paste"],["btnNovoCartao","tip_new"],
 ["btnMCRapido","tip_mc"],["btnPromptIA","tip_prompt"],["btnApkgImport","tip_apkg_import"],
 ["btnRevisar","tip_review_btn"],["btnNormalizar","normalize_tooltip"],
 ["btnTxt","export_txt_tooltip"],["btnApkg","export_apkg_tooltip"],["btnAjuda","help_tooltip"],
 ["chkDestaque","tip_highlight"],["selTema","tip_theme"],["corLetra","tip_textcolor"],
 ["btnCorReset","textcolor_reset"],["selIdioma","tip_lang"],["chk2col","tip_two_cols"],
 ["tituloGeral","gen_title_note"],["selEstiloPainel","style_hint"],
 ["selAlinha","align_hint"]
].forEach(([id, chave]) => { const el = $(id); if (el) attachTip(el, chave); });

/* ----------------------------- eventos ----------------------------- */

$("selIdioma").value = LANG;
$("selIdioma").onchange = () => {
  const exemploAntigo = t("example").trim();
  setLanguage($("selIdioma").value);
  if ($("editor").value.trim() === exemploAntigo) $("editor").value = t("example");
  aplicarTextos(); preview();
};
$("editor").oninput = () => {
  flashLinha = $("editor").value.slice(0, $("editor").selectionStart).split("\n").length;
  renderDestaque();
  agendarPreview();
  autoSalvar();
};
$("editor").onscroll = () => {
  const y = $("editor").scrollTop, x = $("editor").scrollLeft;
  $("editorHl").scrollTop = y; $("editorHl").scrollLeft = x;
  $("editorNums").scrollTop = y;
};
$("btnNormalizar").onclick = () => abrirNormalizar(
  correcaoPendente
    ? ((txt, simular) => corrigirComSeguranca(correcaoPendente, txt, simular))
    : null);
$("btnSelecionarTudo").onclick = () => {
  $("editor").focus();
  $("editor").select();
  toast("toast_selected");
};
$("btnApagarTudo").onclick = async () => {
  if (!$("editor").value.trim()) return;
  if (!(await uiConfirm(t("clear_confirm")))) return;
  guardarVersao("antes de apagar tudo");
  reg("APAGAR", "editor apagado pelo botão",
      $("editor").value.length + " caracteres");
  $("editor").value = "";
  textoAnterior = "";
  respostasFechadas.clear();
  marcados.clear();
  localStorage.removeItem("eac_texto");
  preview();
  toast("toast_cleared");
};
$("btnCopiarTudo").onclick = async () => {
  await navigator.clipboard.writeText($("editor").value);
  toast("toast_copied_all");
};
/* Destaque colorido opcional: sem ele o texto fica em cor única e a
 * seleção/cópia fica perfeitamente visível em qualquer navegador. */
function aplicarDestaque(ligado) {
  document.querySelector(".editor-wrap").classList.toggle("sem-destaque", !ligado);
  const leg = $("hlLegenda");
  if (leg) leg.style.display = ligado ? "" : "none";
  localStorage.setItem("eac_destaque", ligado ? "1" : "0");
  if (ligado) renderDestaque();
}
$("chkDestaque").checked = localStorage.getItem("eac_destaque") !== "0";
$("btnAmpliar").onclick = () => aplicarAmpliar(!bancadaAmpla);
aplicarAmpliar(localStorage.getItem("eac_ampliar") === "1");
attachTip($("btnAmpliar"), "tip_ampliar");
aplicarDestaque($("chkDestaque").checked);
$("chkDestaque").onchange = () => aplicarDestaque($("chkDestaque").checked);
attachTip($("chkDestaque"), "tip_highlight");
attachTip($("btnCopiarTudo"), "copy_all");
attachTip($("btnSelecionarTudo"), "select_all");
attachTip($("btnApagarTudo"), "clear_all");
attachTip($("btnNormalizar"), () => $("btnNormalizar").disabled
  ? t("tip_normalize_off") : t("normalize_tooltip"));
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
function rotularPrevia() {}   // seletor de modo removido: sempre "como no Anki"
/* Duas colunas: só faz efeito em telas largas (o CSS/grid cuida disso).
   O estado fica salvo; o contador do resumo mostra o total normalmente. */
function aplicar2col() {
  const ligado = $("chk2col").checked;
  $("cartoes").classList.toggle("duas", ligado && matchMedia("(min-width:760px)").matches);
  localStorage.setItem("eac_2col", ligado ? "1" : "0");
}
$("chk2col").checked = localStorage.getItem("eac_2col") === "1";
$("chk2col").onchange = () => { aplicar2col(); preview(); };
matchMedia("(min-width:760px)").addEventListener("change", aplicar2col);
attachTip($("chk2col"), "tip_two_cols");
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
  [...$("selAlinha").options].forEach((o) => { o.textContent = t("align_" + o.value); });
}

/* Mostra, em tempo real, o cabeçalho que será IMPRESSO em cada cartão:
 * a última parte do nome do baralho vira o título no topo. */
function atualizarAvisoTopo() {
  const estilo = $("selEstilo").value;
  const p = PALETAS[estilo] || PALETAS.esquema;
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
  if (p.sub) {
    const sub = document.createElement("div");
    sub.textContent = "tags";
    sub.style.cssText = "background:" + p.sub + ";color:" + p.texto +
      ";font-style:italic;text-align:center;font-size:10px;padding:4px;" +
      "border-radius:8px 8px 0 0;margin-top:4px";
    demo.append(sub);
  }
  $("avisoTopoTags").textContent = t("header_tags_note");
}

function previewEstilo() {
  const p = PALETAS[$("selEstilo").value] || PALETAS.esquema;
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
  localStorage.setItem("eac_style", $("selEstilo").value);
  localStorage.setItem("eac_titulo", tituloCartao());
  $("dlgExport").close();
  (exportTipo === "txt" ? exportarTxt : exportarApkg)();
};
$("deckExp").addEventListener("input", () => { atualizarDestino(); atualizarAvisoTopo(); });
$("tituloExp").addEventListener("input", () => {
  setTituloGeral($("tituloExp").value);
  atualizarAvisoTopo();
  if (modoPrevia() === "anki") preview();
});
$("btnTituloDeck").onclick = () => {
  const partes = nomeDeck().split("::").map((s) => s.trim()).filter(Boolean);
  setTituloGeral(partes.length ? partes[partes.length - 1] : "");
  atualizarAvisoTopo();
  if (modoPrevia() === "anki") preview();
};
$("ajudaTitulo").onclick = () => uiAlert(t("title_hint"));
attachTip($("tituloExp"), "title_hint");
$("btnCaminhoExp").onclick = async () => {
  await navigator.clipboard.writeText(nomeDeck());
  $("btnCaminhoExp").textContent = t("copy_path_done");
  setTimeout(() => { $("btnCaminhoExp").textContent = t("copy_path_btn"); }, 2000);
};
$("deckExp").value = localStorage.getItem("eac_deck") || "Meu Baralho";
// título geral aparece nos DOIS campos (esquerdo sempre visível + export)
$("tituloGeral").value = tituloGeral();
$("tituloGeral").placeholder = t("gen_title_ph");
$("tituloGeral").oninput = () => { setTituloGeral($("tituloGeral").value);
  atualizarAvisoTopo(); if (modoPrevia() === "anki") preview(); };
$("tituloExp").value = tituloGeral();
// "classic" foi removido: migra quem o tinha salvo
if ((localStorage.getItem("eac_style") || "") === "classic") localStorage.setItem("eac_style", "esquema");
$("selEstilo").value = localStorage.getItem("eac_style") || "esquema";
$("selEstiloPainel").value = $("selEstilo").value;
function aplicarEstilo(v) {
  localStorage.setItem("eac_style", v);
  $("selEstilo").value = v;
  $("selEstiloPainel").value = v;
  previewEstilo();
  preview();
  toast("toast_style");
}
$("selEstilo").onchange = () => aplicarEstilo($("selEstilo").value);
$("selEstiloPainel").onchange = () => aplicarEstilo($("selEstiloPainel").value);
// alinhamento: vale para a prévia e para o .apkg, e fica guardado
$("selAlinha").value = localStorage.getItem("eac_alinha") || "justify";
$("selAlinha").onchange = () => {
  localStorage.setItem("eac_alinha", $("selAlinha").value);
  reg("ESTILO", "alinhamento: " + $("selAlinha").value);
  preview();
};
$("ajudaEstilo").onclick = () => uiAlert(t("style_hint"));

$("btnAjuda").onclick = () => $("dlgAjuda").showModal();
$("btnFechar").onclick = () => $("dlgAjuda").close();

/* Dicas de funcionamento em TODOS os botões principais */
attachTip($("btnNovoCartao"), "tip_new");
attachTip($("btnMCRapido"), "tip_mc");
attachTip($("btnPromptIA"), "tip_prompt");
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

// recupera o último texto (auto-save); se não houver, usa o exemplo
/* Pede ao navegador para NÃO descartar os dados sob pressão de disco. É a
 * causa mais silenciosa de perda, e a única que se resolve com uma linha.
 * Não protege de limpeza manual — mas tira essa da mesa. */
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then((ja) => {
    if (ja) return;
    return navigator.storage.persist().then((ok) =>
      reg("ARMAZEN", "permanência " + (ok ? "concedida" : "negada pelo navegador")));
  }).catch(() => {});
}
carregarHistorico();
const textoSalvo = localStorage.getItem("eac_texto");
$("editor").value = (textoSalvo !== null && textoSalvo.trim()) ? textoSalvo : t("example");
/* O ponto de partida da vigilância é o texto que já estava salvo. Sem esta
 * linha, a primeira colagem da sessão compara contra "" e nunca dispara. */
textoAnterior = $("editor").value;
guardarVersao("ao abrir");
$("btnHistorico").onclick = abrirHistorico;
$("btnRecuperar").onclick = () => restaurarVersao(historico.length - 1);
$("btnRecuperarNao").onclick = dispensarRecuperar;
$("dlgHistFechar").onclick = () => $("dlgHistorico").close();
atualizarBotaoHistorico();
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

/* Pergunta a versão de um worker (com timeout). null se não responder. */
function pedirVersaoSW(worker) {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => resolve(e.data);
    try { worker.postMessage("GET_VERSION", [ch.port2]); }
    catch (e) { resolve(null); }
    setTimeout(() => resolve(null), 1200);
  });
}

/* Decide se mostra a faixa: SÓ quando o worker em espera tem versão
 * DIFERENTE da que está rodando. Se for a mesma (espera redundante,
 * causa do aviso repetido), ativa em silêncio sem incomodar. */
async function avaliarWaiting(worker) {
  if (!worker) return;
  const v = await pedirVersaoSW(worker);
  if (v && v !== VERSAO) mostrarBarraUpdate(worker);
  else worker.postMessage("SKIP_WAITING");   // redundante: ativa calado
}

function vigiarInstalacao(reg) {
  const novo = reg.installing;
  if (!novo) return;
  novo.addEventListener("statechange", () => {
    if (novo.state === "installed" && navigator.serviceWorker.controller)
      avaliarWaiting(novo);
  });
}

async function procurarAtualizacao(manual) {
  if (!swReg) return;
  if (manual) toast("update_checking");
  try {
    await swReg.update();
    setTimeout(() => {
      if (swReg.waiting) avaliarWaiting(swReg.waiting);
      else if (manual) toast("update_none");
    }, 1200);
  } catch (e) { /* offline: silencioso */ }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    swReg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) avaliarWaiting(reg.waiting);
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


/* ===================================================================
 * PROMPT DE CORREÇÃO  (v8.22)
 * O app conserta sozinho o que é seguro consertar. O resto — resposta
 * quebrada em várias linhas, cartão sem "::", conteúdo que só a IA sabe
 * reescrever — vira um prompt objetivo: cada problema com o número da
 * linha e o trecho literal, mais as regras e o texto numerado.
 * Fluxo: gerar -> copiar -> colar na IA -> trazer a resposta de volta.
 * =================================================================== */
let fixModo = "parcial";       // "parcial" (só os trechos) ou "inteiro"
let fixBlocos = [];            // blocos enviados no modo parcial (com âncora)
let fixOrigem = "editor";      // onde a correção será aplicada

/* Onde está o texto em foco: o painel de colagem, se aberto; senão o editor. */
function alvoDoTexto() {
  const noPainel = $("dlgColarRev") && $("dlgColarRev").open;
  return {
    onde: noPainel ? "colarRev" : "editor",
    el: noPainel ? $("colarRevTexto") : $("editor"),
  };
}

function montarFixPrompt() {
  const el = fixOrigem === "colarRev" ? $("colarRevTexto") : $("editor");
  const raw = (el.value || "").trim();
  const r = parseText(raw, []);
  if (fixModo === "parcial") {
    const { texto, blocos } = montarPromptCorrecaoParcial(raw, r);
    fixBlocos = blocos;
    $("fixPromptTexto").value = texto || "";
    if (!texto) $("fixPromptDone").textContent = t("fixpart_none");
  } else {
    fixBlocos = [];
    $("fixPromptTexto").value = montarPromptCorrecao(raw, r);
  }
  $("btnFixTabParcial").classList.toggle("ativa", fixModo === "parcial");
  $("btnFixTabInteiro").classList.toggle("ativa", fixModo === "inteiro");
  mostrarTamanho("fixPromptTam", $("fixPromptTexto").value);
}

function abrirPromptCorrecao() {
  const alvo = alvoDoTexto();
  const raw = (alvo.el.value || "").trim();
  if (!raw) { uiAlert(t("fixprompt_none")); return; }
  fixOrigem = alvo.onde;
  const r = parseText(raw, []);
  const { achados, gerais } = problemasDoTexto(raw, r);
  if (!achados.length && !gerais.length && !precisaNormalizar(r)) {
    uiAlert(t("fixprompt_none")); return;
  }
  // começa no modo parcial quando há blocos isoláveis; senão, texto inteiro
  fixModo = achados.length ? "parcial" : "inteiro";
  $("fixPromptDone").textContent = "";
  limparConferencia();
  reg("PROMPT", "prompt de correção aberto",
    achados.length + " problema(s), origem: " + fixOrigem);
  montarFixPrompt();
  $("dlgFixPrompt").showModal();
}

$("btnFixTabParcial").onclick = () => { fixModo = "parcial"; $("fixPromptDone").textContent = ""; limparConferencia(); montarFixPrompt(); };
$("btnFixTabInteiro").onclick = () => { fixModo = "inteiro"; $("fixPromptDone").textContent = ""; limparConferencia(); montarFixPrompt(); };
$("btnRecortesColar").onclick = () => colarRecortes();
$("btnRecortesVer").onclick = () => { renderRecortes(); $("dlgRecortes").showModal(); };
$("btnRecortesFechar").onclick = () => $("dlgRecortes").close();

/* Monta a bandeja: um cartão por linha, com caixa de seleção e as duas
 * ações que fazem sentido para UM cartão — copiar (para levar a outro
 * lugar) e excluir (quando não vale mais a pena). */
function renderRecortes() {
  const lista = $("recortesLista");
  lista.innerHTML = "";
  $("chkRecTodos").checked = false;
  if (!recortes.length) {
    const vazio = document.createElement("div");
    vazio.style.cssText = "color:var(--sutil);font-size:12.5px";
    vazio.textContent = t("recortes_vazio");
    lista.append(vazio);
    return;
  }
  recortes.forEach((bloco, i) => {
    const r = parseText(bloco, []);
    const c = r.cards[0] || {};
    const div = document.createElement("div");
    div.className = "rec-item";
    const chk = document.createElement("input");
    chk.type = "checkbox"; chk.dataset.i = String(i);
    const corpo = document.createElement("div");
    corpo.className = "rec-corpo";
    if (c.titulo) {
      const tt = document.createElement("span");
      tt.className = "rec-tit"; tt.textContent = c.titulo;
      corpo.append(tt);
    }
    corpo.append(document.createTextNode(
      (c.front || bloco).replace(/\{\{c\d+::/g, "").replace(/\}\}/g, "").slice(0, 130)));
    const meta = document.createElement("span");
    meta.className = "rec-meta";
    const nMais = (c.more || "").split("<br>").filter(Boolean).length;
    meta.textContent = t("recortes_meta", {
      tags: (c.ownTags || []).join(", ") || "—", n: nMais });
    corpo.append(meta);
    const acoes = document.createElement("div");
    acoes.className = "rec-acoes";
    const bCop = document.createElement("button");
    bCop.className = "btn btn-cinza"; bCop.textContent = t("recortes_copiar_um");
    bCop.onclick = async () => {
      try { await navigator.clipboard.writeText(bloco); toast("toast_copied_all"); }
      catch (e) { uiAlert(t("paste_denied")); }
    };
    const bDel = document.createElement("button");
    bDel.className = "btn btn-del"; bDel.textContent = t("del_btn");
    bDel.onclick = async () => {
      if (!(await uiConfirm(t("recortes_excluir_um")))) return;
      recortes.splice(i, 1);
      reg("RECORTES", "1 excluído da bandeja", recortes.length + " restantes");
      salvarRecortes(); renderRecortes();
      if (!recortes.length) $("dlgRecortes").close();
    };
    acoes.append(bCop, bDel);
    div.append(chk, corpo, acoes);
    lista.append(div);
  });
}

function recortesSelecionados() {
  return [...$("recortesLista").querySelectorAll("input[type=checkbox]")]
    .filter((c) => c.checked).map((c) => Number(c.dataset.i));
}

$("chkRecTodos").onchange = () => {
  const v = $("chkRecTodos").checked;
  [...$("recortesLista").querySelectorAll("input[type=checkbox]")]
    .forEach((c) => { c.checked = v; });
};

$("btnRecColarSel").onclick = () => {
  const sel = recortesSelecionados();
  if (!sel.length) { uiAlert(t("recortes_nada_sel")); return; }
  $("dlgRecortes").close();
  colarRecortes(sel);
};

$("btnRecCopiarSel").onclick = async () => {
  const sel = recortesSelecionados();
  const quais = sel.length ? sel : recortes.map((_, i) => i);
  try {
    await navigator.clipboard.writeText(quais.map((i) => recortes[i]).join("\n\n"));
    toast(t("recortes_copiados", { n: quais.length }));
  } catch (e) { uiAlert(t("paste_denied")); }
};

$("btnRecortesDescartar").onclick = async () => {
  const sel = recortesSelecionados();
  const quais = sel.length ? sel : recortes.map((_, i) => i);
  if (!(await uiConfirm(t("confirm_descartar", { n: quais.length })))) return;
  reg("RECORTES", quais.length + " descartado(s) da bandeja");
  recortes = recortes.filter((_, i) => !quais.includes(i));
  salvarRecortes();
  if (recortes.length) renderRecortes(); else $("dlgRecortes").close();
  toast("toast_recortes_descartados");
};
attachTip($("btnRecortesColar"), "tip_recortes_colar");
atualizarBarraRecortes();

$("btnPromptCorrigir").onclick = abrirPromptCorrecao;
$("btnPromptCorrigir").title = t("fixprompt_btn_tt");
attachTip($("btnPromptCorrigir"), "tip_fixprompt");
attachTip($("btnFixPromptColar"), "tip_fixpart_paste");
$("fixPromptTexto").addEventListener("input", () =>
  mostrarTamanho("fixPromptTam", $("fixPromptTexto").value));
$("btnFixPromptCopiar").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("fixPromptTexto").value);
    $("fixPromptDone").textContent = t("fixprompt_done");
    toast("toast_copied_marked");
  } catch (e) { uiAlert(t("paste_denied")); }
};

/* Recebe a resposta da IA e CONFERE dentro da própria janela: a lista de
 * avisos aparece ali mesmo e o botão verde "Aplicar" só então surge. Antes
 * havia uma confirmação por cima, que ficava escondida atrás desta janela.
 * Nada é alterado enquanto o usuário não clicar em Aplicar. */
let fixPendente = null;   // { aplicar, novo, a0, a1 } aguardando o Aplicar
let fixFaltando = [];     // termos do original que não voltaram na resposta

function limparConferencia() {
  fixFaltando = [];
  $("fixPromptConf").innerHTML = "";
  $("btnFixPromptAplicar").style.display = "none";
  fixPendente = null;
}

function mostrarConferencia(itens, cor) {
  const box = $("fixPromptConf");
  box.innerHTML = "";
  itens.forEach((it) => {
    const d = document.createElement("div");
    d.textContent = "• " + it;
    d.style.color = cor;
    box.append(d);
  });
}

$("btnFixPromptColar").onclick = async () => {
  let resp = "";
  try { resp = await navigator.clipboard.readText(); }
  catch (e) { uiAlert(t("paste_denied_manual")); return; }
  if (!resp.trim()) { uiAlert(t("paste_empty")); return; }
  const el = fixOrigem === "colarRev" ? $("colarRevTexto") : $("editor");
  limparConferencia();

  if (fixModo === "inteiro") {
    const a0 = resumoTexto(el.value), a1 = resumoTexto(resp);
    fixPendente = { aplicar: [], novo: resp.replace(/^\s+/, ""), a0, a1, trechos: 0 };
    mostrarConferencia([t("fixwhole_ready", { a: a0.cartoesReais, d: a1.cartoesReais })],
      "var(--texto)");
    $("btnFixPromptAplicar").style.display = "";
    reg("COLAR", "resposta da IA (texto inteiro)", a0.cartoesReais + "→" + a1.cartoesReais);
    return;
  }

  const { erros, avisos, aplicar } = conferirCorrecaoParcial(resp, fixBlocos);
  const linhas = [...erros, ...avisos];
  $("fixPromptDone").textContent =
    t("fixpart_check", { ok: aplicar.length, av: avisos.length, er: erros.length });
  $("fixPromptDone").style.color = erros.length ? "var(--laranja)" : "var(--verde)";
  reg("COLAR", "resposta da IA (parcial)",
    aplicar.length + " ok, " + avisos.length + " avisos, " + erros.length + " erros"
    + (aplicar.length ? ", cobertura "
       + Math.round(aplicar.reduce((s, x) => s + (x.cobertura ?? 100), 0) / aplicar.length)
       + "%" : ""));
  if (!aplicar.length) {
    mostrarConferencia(linhas.concat([t("fixpart_nothing")]), "var(--laranja)");
    return;
  }
  // cobertura do conjunto: quanto do texto original sobreviveu
  const cobs = aplicar.map((x) => x.cobertura).filter((x) => x !== undefined);
  const cobMedia = cobs.length
    ? Math.round(cobs.reduce((s, x) => s + x, 0) / cobs.length) : 100;
  linhas.push(t("cobertura_ok", { p: cobMedia }));
  // guarda os termos ausentes para o link "ver o que sumiu": mesmo com
  // cobertura boa, o usuário é quem sabe se o termo que faltou importava
  fixFaltando = [...new Set(aplicar.flatMap((x) => x.faltando || []))];
  const novoTexto = aplicarCorrecaoParcial(el.value, aplicar);
  const a0 = resumoTexto(el.value), a1 = resumoTexto(novoTexto);
  if (a1.cartoesReais > a0.cartoesReais)
    linhas.push(t("fixpart_grew", { a: a0.cartoesReais, d: a1.cartoesReais }));
  linhas.push(t("fixpart_confirm", { n: aplicar.length, a: a0.cartoesReais, d: a1.cartoesReais }));
  mostrarConferencia(linhas, erros.length ? "var(--laranja)" : "var(--texto)");
  if (fixFaltando.length) {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "ver-tudo";
    link.style.textAlign = "left";
    link.textContent = t("ver_sumiram", { n: fixFaltando.length });
    const lista = document.createElement("div");
    lista.style.cssText = "display:none;font-size:11.5px;color:var(--sutil);"
      + "margin:2px 0 4px;line-height:1.6";
    lista.textContent = fixFaltando.join(", ");
    link.onclick = () => {
      const aberto = lista.style.display !== "none";
      lista.style.display = aberto ? "none" : "";
      link.textContent = t(aberto ? "ver_sumiram" : "ocultar_sumiram",
        { n: fixFaltando.length });
    };
    $("fixPromptConf").append(link, lista);
  }
  fixPendente = { aplicar, novo: novoTexto, a0, a1, trechos: aplicar.length };
  $("btnFixPromptAplicar").style.display = "";
};

$("btnFixPromptAplicar").onclick = () => {
  if (!fixPendente) return;
  const el = fixOrigem === "colarRev" ? $("colarRevTexto") : $("editor");
  aplicarTextoCorrigido(el, fixPendente.novo, fixPendente.trechos);
  limparConferencia();
};

/* Grava o texto novo com a mesma rede de segurança das correções: se o
 * resultado perder cartões, nada é aplicado. */
function aplicarTextoCorrigido(el, novo, nTrechos) {
  const antes = resumoTexto(el.value), depois = resumoTexto(novo);
  // compara cartões REAIS: unir linhas de continuação diminui a contagem
  // bruta sem perder conteúdo — era exatamente o conserto pedido
  if (depois.cartoesReais < antes.cartoesReais) {
    uiAlert(t("fix_would_lose", { a: antes.cartoesReais, d: depois.cartoesReais }));
    return;
  }
  if (el.id === "editor") colagemAnterior = { texto: el.value };
  el.value = novo;
  if (el.id === "editor") {
    $("btnDesfazerColagem").disabled = false;
    autoSalvar(); preview();
  } else analisarColarRev();
  $("dlgFixPrompt").close();
  reg("APLICAR", nTrechos ? nTrechos + " trecho(s) substituído(s)" : "texto inteiro substituído",
    antes.cartoesReais + "→" + depois.cartoesReais + " cartões");
  toast(nTrechos ? t("fixpart_done", { n: nTrechos }) : t("toast_pasted_fix"));
}

$("btnFixPromptFechar").onclick = () => $("dlgFixPrompt").close();


/* ===================================================================
 * DIAGNÓSTICO  (v8.23)
 * Um clique gera o relatório que descreve o problema inteiro: versão,
 * ambiente, última correção aplicada (antes/depois), quais detectores
 * acenderam e o texto que estava na tela. Substitui print + explicação:
 * com esse bloco dá para reproduzir o caso e transformá-lo em teste.
 * =================================================================== */
const DIAG_MAX = 30000;   // texto muito grande vai cortado, com aviso

/* O diagnóstico olhava sempre a bancada de CARTÕES. Com o modo edital no
 * ar, isso virou mentira: quem relatava um problema do edital recebia de
 * volta o texto dos cartões e não tinha como perceber a troca. O foco
 * segue o modo. */
function textoEmFoco() {
  if ($("dlgColarRev") && $("dlgColarRev").open)
    return { onde: "painel de colagem", txt: $("colarRevTexto").value };
  if (typeof modoAtual !== "undefined" && modoAtual === "edital")
    return { onde: "bancada do edital", txt: $("editalTexto").value, edital: true };
  return { onde: "bancada de cartões", txt: $("editor").value };
}

/* Bloco próprio do edital: as contagens que respondem "veio completo?" —
 * quantas disciplinas, quantos tópicos, quantos pesos foram chutados e
 * quais linhas o app não entendeu. Sem isso, a única forma de saber era
 * contar à mão. */
function diagEdital(L) {
  const raw = ($("editalTexto") || {}).value || "";
  if (!raw.trim()) { L.push("Edital: vazio"); return; }
  const r = lerEdital(raw);
  const tops = r.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  const semPeso = r.disciplinas.reduce(
    (s, d) => s + d.topicos.filter((t) => t.herdado).length, 0);
  const ign = r.achados.filter((x) => x.tipo === "linha_ignorada");
  L.push("Edital: " + r.disciplinas.length + " disciplinas, " + tops + " tópicos, "
    + semPeso + " sem peso, " + ign.length + " linhas ignoradas, "
    + r.linhas + " linhas no total");
  L.push("  concurso: " + (r.cfg.concurso || "(sem nome)")
    + " | prova: " + (r.cfg.prova || "(sem data)")
    + " | horas/semana: " + r.cfg.horas
    + " | concluídos: " + Object.keys(edProgresso || {}).length);
  /* quantos tópicos por disciplina: é onde se vê o edital cortado no meio */
  r.disciplinas.slice(0, 12).forEach((d) =>
    L.push("  @ " + d.nome + " (peso " + d.peso + "): " + d.topicos.length + " tópicos"));
  if (r.disciplinas.length > 12)
    L.push("  ... e mais " + (r.disciplinas.length - 12) + " disciplinas");
  ign.slice(0, 5).forEach((x) => L.push("  ignorada L" + x.linha + ": " + x.txt));
  L.push("  detectores do edital: " + (edDetectores(raw).join(", ") || "nenhum"));
}

/* O dado que mais faltava no diagnostico, justamente no problema mais
 * grave que apareceu: quanto espaco esta em uso, se o navegador prometeu
 * NAO apagar, e quantas versoes do texto existem para recuperar. */
let estadoArmazen = "(não consultado)";
async function medirArmazenamento() {
  const p = [];
  try {
    const persistido = navigator.storage && navigator.storage.persisted
      ? await navigator.storage.persisted() : null;
    p.push("permanente: " + (persistido === null ? "não sei" : (persistido ? "sim" : "NÃO")));
  } catch (e) { p.push("permanente: erro"); }
  try {
    const e = navigator.storage && navigator.storage.estimate
      ? await navigator.storage.estimate() : null;
    if (e) p.push("uso: " + Math.round((e.usage || 0) / 1024) + " KB de "
      + Math.round((e.quota || 0) / 1048576) + " MB");
  } catch (e) { p.push("uso: erro"); }
  try {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++)
      n += (localStorage.getItem(localStorage.key(i)) || "").length;
    p.push("localStorage: " + Math.round(n / 1024) + " KB em " + localStorage.length + " chaves");
  } catch (e) { p.push("localStorage: sem acesso"); }
  p.push("histórico: " + (typeof historico !== "undefined" ? historico.length : "?") + " versões");
  estadoArmazen = p.join(" | ");
  return estadoArmazen;
}

/* Cada bloco entra dentro de um "tentar": se um deles explodir — e ele roda
 * exatamente quando as coisas estao quebradas — o relatorio sai com o buraco
 * anotado, em vez de nao sair. Antes, uma excecao aqui deixava o usuario sem
 * nada justamente no momento em que o diagnostico era a unica coisa que
 * restava. */
function bloco(L, fn) {
  try { fn(); } catch (e) { L.push("  [falhou ao montar: " + (e && e.message) + "]"); }
}

function montarDiagnostico() {
  const L = [];
  let raw = "", r = null;
  bloco(L, () => {
    const foco = textoEmFoco();
    raw = foco.txt || "";
    const nav = navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg|SamsungBrowser)\/[\d.]+/);
    const pwa = matchMedia("(display-mode: standalone)").matches ? "PWA instalado" : "navegador";
    L.push("EasyAnkiCards " + VERSAO + " | " + (LANG || "pt")
      + " | " + (nav ? nav[0] : navigator.platform) + " | " + pwa
      + " | sessão " + SESSAO);
    L.push("Onde: " + foco.onde);
  });
  L.push("Armazenamento: " + estadoArmazen);
  bloco(L, () => {
    if (ultimoAjuste) {
      const f = (s) => s.cartoes + " cartões, " + s.avisos + " avisos, "
        + s.suspeitos + " a verificar, " + s.saibaMais + " linhas de Saiba mais";
      L.push("Última correção: " + ultimoAjuste.acao);
      L.push("  antes:  " + f(ultimoAjuste.antes));
      L.push("  depois: " + f(ultimoAjuste.depois)
        + (ultimoAjuste.bloqueado ? "  [BLOQUEADA: perderia " + ultimoAjuste.bloqueado + "]" : ""));
    } else L.push("Última correção: nenhuma nesta sessão");
  });
  bloco(L, () => {
    L.push("Modo: " + (typeof modoAtual !== "undefined" ? modoAtual : "?"));
    diagEdital(L);
  });
  bloco(L, () => {
    if (textoEmFoco().edital) return;   /* já contado acima */
    r = resumoTexto(raw);
    L.push("Agora: " + r.cartoes + " cartões, " + r.avisos + " avisos, " + r.suspeitos
      + " a verificar, " + r.saibaMais + " linhas de Saiba mais, " + r.titulos
      + " títulos, " + r.tags + " tags");
  });
  bloco(L, () => {
    if (textoEmFoco().edital) return;
    const det = detectoresAtivos(raw);
    L.push("Detectores acesos: " + (det.length ? det.join(", ") : "nenhum"));
  });
  bloco(L, () => {
    if (textoEmFoco().edital) return;
    const p = parseText(raw, []);
    (p.warnings || []).slice(0, 6).forEach((w, i) =>
      L.push("  aviso L" + (p.warnLines || [])[i] + ": " + w));
    p.cards.filter((c) => c.issues.length).slice(0, 6).forEach((c) =>
      L.push("  cartão L" + c.line + ": " + c.issues[0]));
    const presos = cartoesDependentes(p);
    if (presos.length) L.push("  presos à prova de origem: " + presos.length
      + " (primeiro na L" + presos[0].line + ")");
  });
  L.push("");
  L.push("--- REGISTRO (" + registro.length + " eventos) ---");
  bloco(L, () => L.push(registroTexto()));
  L.push("");
  bloco(L, () => {
    L.push("--- TEXTO (" + raw.split(/\r?\n/).length + " linhas, " + raw.length + " caracteres) ---");
    L.push(raw.length > DIAG_MAX
      ? raw.slice(0, DIAG_MAX) + "\n[...cortado, " + (raw.length - DIAG_MAX) + " caracteres a mais]"
      : raw);
  });
  return L.join("\n");
}


/* ------------------------------------------------------------------
 * DIAGNÓSTICO — um botão só
 *
 * Eram dois links no rodapé ("Diagnóstico" e "Registro") que copiavam
 * cegamente para a área de transferência. Quem clicava não via o que
 * levava, e a diferença entre os dois não estava escrita em lugar nenhum.
 * Agora é um painel: explica cada bloco, MOSTRA o relatório antes de sair
 * da tela, e daí você copia ou baixa.
 * ------------------------------------------------------------------ */
let diagTexto = "";

function pintarDiagnostico(txt) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc(txt).split("\n").map((l) => {
    if (/^---.*---$/.test(l.trim())) return '<span class="d-sec">' + l + "</span>";
    if (/\[(ERRO|BLOQUEIO|APAGAR)\]|\[falhou ao montar/.test(l))
      return '<span class="d-err">' + l + "</span>";
    if (/^(EasyAnkiCards |Onde:|Armazenamento:|Agora:|Detectores|Última correção)/.test(l))
      return '<span class="d-cab">' + l + "</span>";
    return l;
  }).join("\n");
}

/* Feedback no próprio botão: o toast some rápido e, num diálogo cheio de
 * texto, passa despercebido. O rótulo confirma onde a mão estava. */
function confirmarBotao(id, chave) {
  const b = $(id);
  const antes = b.textContent;
  b.textContent = "✓ " + t(chave);
  b.disabled = true;
  setTimeout(() => { b.textContent = antes; b.disabled = false; }, 1800);
}

function montarPainelDiag() {
  const comTexto = $("chkDiagTexto").checked;
  let txt = montarDiagnostico();
  if (!comTexto) {
    const corte = txt.indexOf("\n--- TEXTO");
    if (corte > 0) txt = txt.slice(0, corte) + "\n--- TEXTO (não incluído a pedido) ---";
  }
  diagTexto = txt;
  $("diagPre").innerHTML = pintarDiagnostico(txt);

  /* Diz, em cima e por extenso, DE QUAL bancada é este relatório. */
  const foco = textoEmFoco();
  const alvo = $("diagAlvo");
  alvo.innerHTML = "";
  const rot = document.createElement("span");
  rot.textContent = t("diag_alvo_rot");
  const nome = document.createElement("b");
  nome.textContent = foco.onde;
  const conta = document.createElement("span");
  conta.className = "da-conta";
  conta.textContent = t("diag_alvo_conta", {
    l: (foco.txt || "").split(/\r?\n/).length,
    c: (foco.txt || "").length,
    e: registro.length,
  });
  alvo.append(rot, nome, conta);
}

async function abrirDiagnostico() {
  await medirArmazenamento();
  montarPainelDiag();
  reg("DIAGNOSTICO", "painel aberto",
      registro.length + " eventos, foco: " + textoEmFoco().onde);
  $("dlgDiagnostico").showModal();
}

$("btnDiagnostico").onclick = abrirDiagnostico;
$("chkDiagTexto").onchange = montarPainelDiag;
$("btnDiagFechar").onclick = () => $("dlgDiagnostico").close();
$("btnDiagCopiar").onclick = async () => {
  try {
    await navigator.clipboard.writeText(diagTexto);
    confirmarBotao("btnDiagCopiar", "diag_copiado");
    toast(textoEmFoco().edital ? "toast_diag_copied_ed" : "toast_diag_copied_cd");
  } catch (e) { uiAlert(t("toast_copy_fail")); }
};
$("btnDiagBaixar").onclick = () => {
  /* nome com data e hora: dois relatórios do mesmo dia não se sobrescrevem */
  const d = new Date();
  const car = (n) => String(n).padStart(2, "0");
  const nome = "easyankicards-diagnostico-" + d.getFullYear() + car(d.getMonth() + 1)
    + car(d.getDate()) + "-" + car(d.getHours()) + car(d.getMinutes()) + ".txt";
  const url = URL.createObjectURL(new Blob([diagTexto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  reg("DIAGNOSTICO", "baixado", nome + " (" + textoEmFoco().onde + ")");
  confirmarBotao("btnDiagBaixar", "diag_baixado");
  toast("toast_diag_saved");
};

/* Janela genérica de texto: título + caixa somente-leitura + copiar. Serve
 * a qualquer prompt novo sem precisar de um diálogo próprio para cada um. */
function abrirTextoSimples(titulo, texto) {
  $("dlgTextoTit").textContent = titulo;
  $("dlgTextoCorpo").value = texto;
  $("dlgTexto").showModal();
  $("dlgTextoCorpo").select();
}
$("btnDlgTextoFechar").onclick = () => $("dlgTexto").close();
$("btnDlgTextoCopiar").onclick = async () => {
  try { await navigator.clipboard.writeText($("dlgTextoCorpo").value); toast("toast_copied"); }
  catch (e) { uiAlert(t("toast_copy_fail")); }
};

attachTip($("btnDiagnostico"), "tip_diag");


/* Mantém a PRIMEIRA de cada grupo e manda as demais para a gaveta.
 * Não apaga: a repetida costuma ter uma explicação melhor que a primeira,
 * e quem decide qual fica é o usuário, olhando com calma depois. */
async function recortarDuplicados(grupos) {
  const extras = grupos.flatMap((g) => g.slice(1));
  if (!extras.length) return;
  if (!(await uiConfirm(t("confirm_dup_cut", { n: extras.length, g: grupos.length })))) return;
  // de baixo para cima: tirar um bloco muda a numeração dos de cima
  const ordenados = [...extras].sort((a, b) => b.line - a.line);
  colagemAnterior = { texto: $("editor").value };
  const linhas = $("editor").value.split("\n");
  ordenados.forEach((c) => {
    const b = blocoDoCartao(linhas, c.line);
    recortes.push(linhas.slice(b.ini, b.fim + 1).join("\n"));
    linhas.splice(b.ini, b.fim - b.ini + 1);
  });
  $("editor").value = linhas.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
  reg("RECORTAR", extras.length + " repetida(s) de " + grupos.length + " grupo(s)",
      recortes.length + " na gaveta");
  salvarRecortes();
  $("btnDesfazerColagem").disabled = false;
  autoSalvar();
  preview();
  toast(t("toast_dup_cut", { n: extras.length }));
}


/* ===================================================================
 * PAINEL DE FOCO  (v8.39)
 * "Ver no texto" só rolava o editor até a linha. Numa parede de 180
 * linhas isso é quase nada: você chega perto do problema e ainda tem de
 * achá-lo. Aqui o cartão inteiro é isolado ao lado do painel esquerdo,
 * com o TRECHO errado grifado, e dá para consertar sem sair dali.
 * Também navega entre os problemas — quase nunca há só um.
 * =================================================================== */
let focoLista = [];      // [{ linha, msg }] de todos os problemas
let focoAtual = -1;
let focoBloco = null;    // { ini, fim } do bloco no editor

/* Todos os problemas apontáveis, em ordem de linha. */
function problemasNavegaveis() {
  const r = ultimoResult || parseAtual();
  const raw = $("editor").value;
  const { achados } = problemasDoTexto(raw, r);
  const grupos = gruposDuplicados(r);
  const linhasDeGrupo = new Set(grupos.flatMap((g) => g.map((c) => c.line)));
  // linha que já é coberta por um grupo não vira item próprio: senão o
  // mesmo problema apareceria duas vezes na navegação
  const lista = achados.filter((p) => !linhasDeGrupo.has(p.n))
    .map((p) => ({ tipo: "linha", linha: p.n, msg: p.msg }));
  // frentes repetidas entram como GRUPO: no foco elas aparecem lado a lado,
  // porque a decisão ali é comparar e escolher qual fica
  grupos.forEach((g) => {
    lista.push({ tipo: "grupo", linha: g[0].line, fronts: g.map((c) => c.front),
      msg: t("crit_dup", { n: g.length, linhas: g.map((c) => c.line).join(", "),
        f: g[0].front.slice(0, 60) }) });
  });
  return lista.sort((a, b) => a.linha - b.linha);
}

function posicionarFoco() {
  const el = $("focoCartao");
  const esq = $("painelEsquerdo");
  if (!el || !esq || !esq.getBoundingClientRect) return;
  const r = esq.getBoundingClientRect();
  const largo = matchMedia("(min-width:761px)").matches;
  if (!largo) return;                       // no celular o CSS manda
  el.style.left = Math.round(r.right + 12) + "px";
  el.style.top = Math.round(Math.max(70, r.top)) + "px";
}

function escaparHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* O bloco com as marcas viradas em <mark>. */
function blocoMarcado(bloco) {
  const ms = marcasUnidas(bloco);
  if (!ms.length) return escaparHtml(bloco);
  let saida = "", pos = 0;
  ms.forEach((m) => {
    saida += escaparHtml(bloco.slice(pos, m.ini))
      + "<mark>" + escaparHtml(bloco.slice(m.ini, m.fim)) + "</mark>";
    pos = m.fim;
  });
  return saida + escaparHtml(bloco.slice(pos));
}

function abrirFoco(linha, msg) {
  focoLista = problemasNavegaveis();
  focoAtual = focoLista.findIndex((p) => p.linha === linha);
  if (focoAtual < 0) focoLista.unshift({ linha, msg: msg || "" }), focoAtual = 0;
  mostrarFoco();
}

function mostrarFoco() {
  const item = focoLista[focoAtual];
  if (!item) { fecharFoco(); return; }
  if (item.tipo === "grupo") { mostrarFocoGrupo(item); return; }
  const linhas = $("editor").value.split("\n");
  const r = parseAtual();
  // acha o cartão dono da linha; se não houver, mostra a linha sozinha
  const dono = r.cards.find((c) => {
    const b = blocoDoCartao(linhas, c.line);
    return item.linha - 1 >= b.ini && item.linha - 1 <= b.fim;
  });
  focoBloco = dono ? blocoDoCartao(linhas, dono.line)
                   : { ini: item.linha - 1, fim: item.linha - 1 };
  const bloco = linhas.slice(focoBloco.ini, focoBloco.fim + 1).join("\n");

  $("focoTitulo").textContent = t("foco_titulo", { n: item.linha });
  $("focoAviso").textContent = item.msg || "";
  $("focoMarcado").innerHTML = blocoMarcado(bloco);
  $("focoEditor").value = bloco;
  $("focoConta").textContent = (focoAtual + 1) + "/" + focoLista.length;
  $("btnFocoAnterior").disabled = focoAtual <= 0;
  $("btnFocoProximo").disabled = focoAtual >= focoLista.length - 1;
  verFoco(false);                       // começa em leitura
  $("focoCartao").style.display = "";
  posicionarFoco();
  irParaLinha(item.linha);              // o editor acompanha
}

/* alterna entre ler (com grifo) e editar (textarea) */
function verFoco(editando) {
  $("focoGrupo").style.display = "none";
  $("focoMarcado").style.display = editando ? "none" : "";
  $("focoEditor").style.display = editando ? "" : "none";
  $("btnFocoAplicar").style.display = editando ? "" : "none";
  $("btnFocoEditar").style.display = editando ? "none" : "";
  if (editando) $("focoEditor").focus();
}

function fecharFoco() {
  $("focoCartao").style.display = "none";
  focoBloco = null;
}

function aplicarFoco() {
  if (!focoBloco) return;
  const novo = $("focoEditor").value;
  const linhas = $("editor").value.split("\n");
  colagemAnterior = { texto: $("editor").value };
  linhas.splice(focoBloco.ini, focoBloco.fim - focoBloco.ini + 1, ...novo.split("\n"));
  $("editor").value = linhas.join("\n");
  $("btnDesfazerColagem").disabled = false;
  reg("FOCO", "cartão da linha " + (focoLista[focoAtual] || {}).linha + " editado no foco");
  autoSalvar();
  preview();
  // a lista de problemas mudou: recalcula e fica no mesmo lugar, se ainda houver
  const antes = focoAtual;
  focoLista = problemasNavegaveis();
  if (!focoLista.length) { fecharFoco(); toast("foco_resolvido"); return; }
  focoAtual = Math.min(antes, focoLista.length - 1);
  mostrarFoco();
  toast("foco_aplicado");
}

/* Modo grupo: as repetidas empilhadas, a primeira marcada como a que fica.
 * Cada uma tem Recortar (guarda na bandeja) e Excluir. A escolha é do
 * usuário: a repetição mais nova costuma ter a explicação melhor. */
function mostrarFocoGrupo(item) {
  const r = parseAtual();
  const grupo = gruposDuplicados(r)
    .find((g) => g.some((c) => item.fronts.includes(c.front)));
  if (!grupo) {                       // resolvido enquanto o painel estava aberto
    focoLista = problemasNavegaveis();
    if (!focoLista.length) { fecharFoco(); toast("foco_resolvido"); return; }
    focoAtual = Math.min(focoAtual, focoLista.length - 1);
    mostrarFoco();
    return;
  }
  item.fronts = grupo.map((c) => c.front);
  $("focoTitulo").textContent = t("foco_grupo_titulo", { n: grupo.length });
  $("focoAviso").textContent = item.msg;
  $("focoMarcado").style.display = "none";
  $("focoEditor").style.display = "none";
  $("btnFocoEditar").style.display = "none";
  $("btnFocoAplicar").style.display = "none";
  const box = $("focoGrupo");
  box.innerHTML = "";
  box.style.display = "";
  const linhas = $("editor").value.split("\n");
  grupo.forEach((c, i) => {
    const b = blocoDoCartao(linhas, c.line);
    const div = document.createElement("div");
    div.className = "foco-rep" + (i === 0 ? " fica" : "");
    const cab = document.createElement("div");
    cab.className = "cab-rep";
    const selo = document.createElement("span");
    selo.className = "selo " + (i === 0 ? "selo-fica" : "selo-rep");
    selo.textContent = t(i === 0 ? "foco_fica" : "foco_repetida");
    cab.append(selo, document.createTextNode(t("card_line") + " " + c.line));
    const pre = document.createElement("pre");
    pre.textContent = linhas.slice(b.ini, b.fim + 1).join("\n");
    const acoes = document.createElement("div");
    acoes.className = "acoes-rep";
    const bRec = document.createElement("button");
    bRec.className = "btn btn-cinza btn-min";
    bRec.textContent = t("cut_btn");
    bRec.onclick = () => { recortarCartao(c); aposMexerNoGrupo(); };
    const bDel = document.createElement("button");
    bDel.className = "btn btn-del btn-min";
    bDel.textContent = t("del_btn");
    bDel.onclick = async () => { await excluirCartao(c); aposMexerNoGrupo(); };
    acoes.append(bRec, bDel);
    div.append(cab, pre, acoes);
    box.append(div);
  });
  $("focoConta").textContent = (focoAtual + 1) + "/" + focoLista.length;
  $("btnFocoAnterior").disabled = focoAtual <= 0;
  $("btnFocoProximo").disabled = focoAtual >= focoLista.length - 1;
  $("focoCartao").style.display = "";
  posicionarFoco();
  irParaLinha(grupo[0].line);
}

function aposMexerNoGrupo() {
  const item = focoLista[focoAtual];
  if (item && item.tipo === "grupo") mostrarFocoGrupo(item);
  else mostrarFoco();
}

$("btnFocoFechar").onclick = fecharFoco;
$("btnFocoOk").onclick = fecharFoco;
$("btnFocoEditar").onclick = () => verFoco(true);
$("btnFocoAplicar").onclick = aplicarFoco;
$("btnFocoAnterior").onclick = () => { if (focoAtual > 0) { focoAtual--; mostrarFoco(); } };
$("btnFocoProximo").onclick = () => {
  if (focoAtual < focoLista.length - 1) { focoAtual++; mostrarFoco(); }
};
window.addEventListener("resize", () => {
  if ($("focoCartao").style.display !== "none") posicionarFoco();
});
