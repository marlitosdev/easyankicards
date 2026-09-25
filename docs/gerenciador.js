/* ===================================================================
 * GERENCIADOR DE CARTÕES
 *
 * Os cartões moram em vários lugares (o texto de cada tópico do material,
 * a bancada, a bandeja de recortes) e cada tela mostra um pedaço, um por
 * vez: "N cartões" de um tópico, o estudo de uma pilha, a lista do que
 * acabou de ser colado. Nenhuma deixava ver a biblioteca inteira, buscar,
 * filtrar por defeito ou repetição, e agir em vários cartões de uma vez.
 *
 * Aqui: uma árvore de pastas (disciplina › tópico, como os baralhos do
 * Anki), busca, filtros, prévia do cartão como ele vai ficar, e ações em
 * lote — mover, apagar (lixeira), editar e melhorar. Sem armazenamento
 * novo: tudo é lido e gravado no texto de cada tópico, pelas mesmas
 * funções do resto do app, e a última ação pode ser desfeita.
 * Esta versão cobre o material. (A bancada tem exportação própria.)
 * =================================================================== */
const GER_LIM = { visiveis: 60 };
const GER_FILTROS = ["todos", "abaixo", "repetidos", "sem_artigo", "basico", "cloze", "mc"];
const GER_CHAVE_RECIBO = "eac_ger_recibo";

/* Árvore disciplina › tópico, com contagem. */
function gerArvore(notas) {
  const d = new Map();
  (notas || []).forEach((n) => {
    const nd = n.disciplina || "—", nt = n.topico || "—";
    if (!d.has(nd)) d.set(nd, { disciplina: nd, total: 0, topicos: new Map() });
    const x = d.get(nd); x.total++;
    if (!x.topicos.has(n.chave)) x.topicos.set(n.chave, { topico: nt, chave: n.chave, total: 0 });
    x.topicos.get(n.chave).total++;
  });
  const cmp = (a, b) => String(a).localeCompare(String(b), "pt");
  return [...d.values()].sort((a, b) => cmp(a.disciplina, b.disciplina)).map((x) => ({
    disciplina: x.disciplina, total: x.total,
    topicos: [...x.topicos.values()].sort((a, b) => cmp(a.topico, b.topico)),
  }));
}

/* Quais cartões (índices) passam pela pasta, pela busca e pelo filtro.
 * `pasta`: null (tudo) | { disciplina } | { chave }. */
function gerFiltrar(notas, o) {
  const opc = o || {};
  const q = cqNormal(opc.busca || "");
  const filtro = opc.filtro || "todos";
  let rep = null;
  if (filtro === "repetidos") {
    rep = new Set();
    cqAgrupar(notas.map((n) => n.card)).forEach((g) => g.forEach((i) => rep.add(i)));
  }
  const saida = [];
  notas.forEach((n, i) => {
    const p = opc.pasta;
    if (p && p.chave && n.chave !== p.chave) return;
    if (p && !p.chave && p.disciplina && (n.disciplina || "—") !== p.disciplina) return;
    const c = n.card;
    if (filtro === "abaixo" && !ceAbaixo(c)) return;
    if (filtro === "repetidos" && !rep.has(i)) return;
    if (filtro === "sem_artigo" && ceDefeitos(c).indexOf("sem_artigo") < 0) return;
    if (filtro === "basico" && c.kind !== "basic") return;
    if (filtro === "cloze" && c.kind !== "cloze") return;
    if (filtro === "mc" && c.kind !== "mc") return;
    if (q) {
      const hay = cqNormal([c.front, c.back, c.more, (c.ownTags || []).join(" "), n.disciplina, n.topico].join(" "));
      if (hay.indexOf(q) < 0) return;
    }
    saida.push(i);
  });
  return saida;
}

/* ---- ações (puras em relação à tela) ---- */

function gerTexto(chave) { return cqTexto(chave); }

/* Guarda o texto de antes/depois dos tópicos tocados: é o que permite desfazer. */
function gerRegistrar(antes) {
  const itens = Object.keys(antes).filter((ch) => antes[ch] !== gerTexto(ch)).map((ch) => ({
    chave: ch, antes: antes[ch], depois: gerTexto(ch),
    disciplina: (matResumos[ch] || {}).disciplina, topico: (matResumos[ch] || {}).topico }));
  try {
    if (itens.length) localStorage.setItem(GER_CHAVE_RECIBO, JSON.stringify({ quando: new Date().toISOString(), itens }));
  } catch (e) {}
  return itens.length;
}

function gerRecibo() {
  try { return JSON.parse(localStorage.getItem(GER_CHAVE_RECIBO) || "null"); } catch (e) { return null; }
}

/* Só desfaz o tópico que continua como a ação o deixou. */
function gerDesfazerUltima() {
  const rec = gerRecibo();
  if (!rec || !rec.itens) return { desfeitos: 0, pulados: 0 };
  let desfeitos = 0, pulados = 0;
  rec.itens.forEach((it) => {
    if (gerTexto(it.chave) !== it.depois) { pulados++; return; }
    cqVersaoBancada("antes de desfazer a última ação", [it.chave]);
    cqGravar(it.chave, it.antes, { disciplina: it.disciplina, topico: it.topico });
    desfeitos++;
  });
  if (!pulados) { try { localStorage.removeItem(GER_CHAVE_RECIBO); } catch (e) {} }
  try { matReg("cartoes", "gerenciador: última ação desfeita", desfeitos + " tópico(s), " + pulados + " pulado(s)"); } catch (e) {}
  return { desfeitos, pulados };
}

function gerFrenteChave(linha) { return cmNormal(String(linha).split("::")[0]); }

/* Move os cartões para o tópico `destChave`. O bloco (com @ e +) vai como
 * está; pergunta que o destino já tem NÃO é duplicada — o cartão fica onde
 * estava e é contado à parte. Devolve { movidos, repetidos, naoAchou }. */
function gerMover(notas, destChave) {
  const dest = matResumos[destChave];
  const r = { movidos: 0, repetidos: 0, naoAchou: 0 };
  if (!dest) return r;
  const antes = {};
  const guarda = (ch) => { if (!(ch in antes)) { antes[ch] = gerTexto(ch); cqVersaoBancada("antes de mover cartões", [ch]); } };
  guarda(destChave);
  notas.forEach((n) => {
    if (n.chave === destChave) return;
    guarda(n.chave);
    const jaTem = new Set(gerTexto(destChave).split("\n").filter((l) => !/^\s*[@+*]/.test(l)).map(gerFrenteChave).filter(Boolean));
    if (jaTem.has(gerFrenteChave(n.card.raw || n.card.front))) { r.repetidos++; return; }
    const saida = {};
    const novo = mcTextoSemCartao(gerTexto(n.chave), n.card, saida);
    if (novo === null) { r.naoAchou++; return; }
    cqGravar(n.chave, novo, { disciplina: n.disciplina, topico: n.topico });
    const at = gerTexto(destChave).replace(/\s*$/, "");
    matGravarCartoes(destChave, (at ? at + "\n" : "") + saida.bloco, { disciplina: dest.disciplina, topico: dest.topico });
    r.movidos++;
  });
  gerRegistrar(antes);
  try { matReg("cartoes", "gerenciador: cartões movidos", r.movidos + " para " + (dest.topico || destChave) + ", " + r.repetidos + " repetido(s)"); } catch (e) {}
  return r;
}

/* Apaga (para a lixeira, que restaura no mesmo lugar). */
function gerApagar(notas) {
  const antes = {};
  let apagados = 0, naoAchou = 0;
  notas.forEach((n) => {
    if (!(n.chave in antes)) { antes[n.chave] = gerTexto(n.chave); cqVersaoBancada("antes de apagar cartões", [n.chave]); }
    const saida = {};
    const novo = mcTextoSemCartao(gerTexto(n.chave), n.card, saida);
    if (novo === null) { naoAchou++; return; }
    cqGravar(n.chave, novo, { disciplina: n.disciplina, topico: n.topico });
    apagados++;
    try {
      lixJogar({ tipo: "cartao", via: cqViaLixeira(n.chave), rotulo: String(n.card.front || "").slice(0, 90),
        onde: [n.disciplina, n.topico].filter(Boolean).join(" · "),
        dados: { chave: n.chave, disciplina: n.disciplina, topico: n.topico, bloco: saida.bloco, linha: saida.linha, sep: saida.sep } });
    } catch (e) {}
  });
  gerRegistrar(antes);
  try { matReg("cartoes", "gerenciador: cartões apagados", apagados + " para a lixeira"); } catch (e) {}
  return { apagados, naoAchou };
}

/* Troca o texto do cartão (com @ e +). Recusa texto que não vira cartão. */
function gerEditar(nota, texto) {
  let cs = [];
  try { cs = parseText(String(texto || ""), []).cards; } catch (e) {}
  if (!cs.length) return { ok: false, motivo: "sem_cartao" };
  const antes = { [nota.chave]: gerTexto(nota.chave) };
  const novo = ceSubstituir(antes[nota.chave], nota.card, texto);
  if (novo === null) return { ok: false, motivo: "nao_achou" };
  cqVersaoBancada("antes de editar um cartão", [nota.chave]);
  cqGravar(nota.chave, novo, { disciplina: nota.disciplina, topico: nota.topico });
  gerRegistrar(antes);
  try { matReg("cartoes", "gerenciador: cartão editado", String(nota.card.front || "").slice(0, 60)); } catch (e) {}
  return { ok: true, cartoes: cs.length };
}

/* ---- a tela ---- */
let gerNotas = [], gerVis = [], gerPasta = null, gerSel = new Set(), gerFoco = -1,
  gerMostrando = GER_LIM.visiveis, gerFechados = new Set(), gerEditando = false;
const GER_CHAVE_GRANDE = "eac_ger_grande";

function gerEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function gerCalcular() {
  gerNotas = cqLerBiblioteca();
  gerRefiltrar();
}

/* A marcação e o foco são por POSIÇÃO na lista de agora: qualquer mudança da lista (pasta, busca,
 * filtro, depois de uma ação) zera a marcação — senão as marcas apontariam para OUTROS cartões.
 * O foco vai para o primeiro cartão, para a prévia nunca ficar em branco. */
function gerRefiltrar() {
  gerVis = gerFiltrar(gerNotas, { pasta: gerPasta, busca: $("gerBusca").value, filtro: $("gerFiltro").value });
  gerMostrando = GER_LIM.visiveis;
  gerSel = new Set(); gerEditando = false;
  gerFoco = gerVis.length ? 0 : -1;
}

function gerPintarArvore() {
  const cx = $("gerArvore");
  cx.innerHTML = "";
  const tudo = gerEl("div", "ger-pasta" + (!gerPasta ? " ger-atual" : ""), t("ger_todos", { n: gerNotas.length }));
  tudo.onclick = () => { gerPasta = null; gerRefiltrar(); gerPintar(); };
  cx.append(tudo);
  gerArvore(gerNotas).forEach((d) => {
    const aberto = !gerFechados.has(d.disciplina);
    const ativa = gerPasta && !gerPasta.chave && gerPasta.disciplina === d.disciplina;
    const cab = gerEl("div", "ger-pasta ger-disc" + (ativa ? " ger-atual" : ""));
    const seta = gerEl("span", "ger-seta", aberto ? "▾" : "▸");
    seta.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); aberto ? gerFechados.add(d.disciplina) : gerFechados.delete(d.disciplina); gerPintarArvore(); };
    cab.append(seta, gerEl("span", "", " " + d.disciplina + " (" + d.total + ")"));
    cab.onclick = () => { gerPasta = { disciplina: d.disciplina }; gerRefiltrar(); gerPintar(); };
    cx.append(cab);
    if (aberto) d.topicos.forEach((tp) => {
      const li = gerEl("div", "ger-pasta ger-top" + (gerPasta && gerPasta.chave === tp.chave ? " ger-atual" : ""), tp.topico + " (" + tp.total + ")");
      li.onclick = () => { gerPasta = { chave: tp.chave }; gerRefiltrar(); gerPintar(); };
      cx.append(li);
    });
  });
}

function gerPintarLista() {
  const cx = $("gerLista");
  cx.innerHTML = "";
  $("gerResumo").textContent = gerNotas.length
    ? t("ger_resumo", { v: gerVis.length, n: gerNotas.length }) : t("cq_sem_cartoes");
  if (gerNotas.length && !gerVis.length) cx.append(gerEl("p", "nota", t("ger_nenhum")));
  gerVis.slice(0, gerMostrando).forEach((idx, pos) => {
    const n = gerNotas[idx];
    const lin = gerEl("div", "ger-item" + (pos === gerFoco ? " ger-foco" : ""));
    const ck = gerEl("input"); ck.type = "checkbox"; ck.checked = gerSel.has(pos);
    ck.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
    ck.onchange = () => { ck.checked ? gerSel.add(pos) : gerSel.delete(pos); gerPintarAcoes(); };
    const corpo = gerEl("div", "ger-corpo");
    corpo.append(gerEl("div", "ger-f", cqTrecho(cqRevelado(n.card), 140)));
    corpo.append(gerEl("div", "ger-v", cqTrecho(n.card.back, 120)));
    const onde = gerEl("div", "cq-onde");
    onde.append(ceSelo(ceNivel(n.card)), document.createTextNode(" " + [n.disciplina, n.topico].filter(Boolean).join(" · ")));
    corpo.append(onde);
    lin.append(ck, corpo);
    lin.onclick = () => { gerFoco = pos; gerEditando = false; gerPintar(); };
    cx.append(lin);
  });
  $("btnGerMais").hidden = gerVis.length <= gerMostrando;
}

function gerPintarPrevia() {
  const cx = $("gerPrevia");
  cx.innerHTML = "";
  const idx = gerFoco >= 0 ? gerVis[gerFoco] : undefined;
  const n = idx === undefined ? null : gerNotas[idx];
  $("gerEditorCx").hidden = !(n && gerEditando);
  $("gerPreAcoes").hidden = !n;
  if (!n) { cx.append(gerEl("p", "nota", t("ger_previa_vazia"))); return; }
  try { renderCartaoEstilizado(cx, n.card, true, { estudo: false }); } catch (e) { cx.append(gerEl("pre", "", cardToLine(n.card))); }
  const def = ceDefeitos(n.card);
  const nivel = gerEl("div", "cq-onde");
  nivel.append(ceSelo(ceNivel(n.card)));
  if (def.length) nivel.append(document.createTextNode(" " + t("ce_falta", { x: def.map((d) => t("ce_def_" + d)).join(" · ") })));
  cx.append(nivel);
}

/* Duas barras: com NADA marcado, um rodapé fino (total e desfazer); com cartões marcados, a barra
 * de ações sobe (mover, apagar, elevar). Antes o seletor de destino ocupava o rodapé o tempo todo. */
function gerPintarAcoes() {
  const k = gerSel.size;
  $("gerSel").textContent = t("ger_sel", { n: k });
  ["btnGerApagar", "btnGerMover", "btnGerMelhorar"].forEach((id) => { $(id).disabled = !k; });
  $("btnGerMelhorar").textContent = k > CE_LIM.lote ? t("ger_elevar_de", { n: CE_LIM.lote, k }) : t("ger_elevar", { n: k });
  $("gerAcoes").hidden = !k;
  $("gerTotal").textContent = t("ger_total", { n: gerNotas.length });
  $("btnGerEditar").disabled = gerFoco < 0;
  $("btnGerPreApagar").disabled = gerFoco < 0;
  const rec = gerRecibo();
  const tem = !!(rec && rec.itens && rec.itens.length);
  $("btnGerDesfazer").hidden = !tem;
  if (!tem) $("btnGerMsgDesfazer").hidden = true;
  if (!k) gerFecharDestinos();
}

/* O aviso do que acabou de acontecer, com "desfazer" ao lado (a mesma última ação do rodapé). */
function gerAviso(texto, comDesfazer) {
  $("gerMsg").textContent = texto || "";
  $("gerMsgCx").hidden = !texto;
  const rec = gerRecibo();
  $("btnGerMsgDesfazer").hidden = !(comDesfazer && rec && rec.itens && rec.itens.length);
}

/* ---- destino: um seletor com busca (o <select> nativo estourava a tela) ---- */
function gerDestinosLista() {
  return Object.keys(matResumos).map((ch) => ({ ch, r: matResumos[ch] })).filter((x) => x.r && (x.r.disciplina || x.r.topico))
    .sort((a, b) => String((a.r.disciplina || "") + (a.r.topico || "")).localeCompare(String((b.r.disciplina || "") + (b.r.topico || "")), "pt"))
    .map((x) => ({ ch: x.ch, nome: [x.r.disciplina, x.r.topico].filter(Boolean).join(" › ") }));
}

function gerFecharDestinos() {
  const p = $("gerPop");
  if (p) p.hidden = true;
}

function gerPintarDestinosLista() {
  const q = cqNormal($("gerPopBusca").value || "");
  const cx = $("gerPopLista");
  cx.innerHTML = "";
  const itens = gerDestinosLista().filter((d) => !q || cqNormal(d.nome).indexOf(q) >= 0);
  if (!itens.length) cx.append(gerEl("p", "nota", t("ger_pop_vazio")));
  itens.slice(0, 80).forEach((d) => {
    const b = gerEl("div", "ger-pop-item", d.nome);
    b.setAttribute("role", "option");
    b.onclick = () => gerEscolherDestino(d.ch);
    cx.append(b);
  });
  if (itens.length > 80) cx.append(gerEl("p", "nota", t("ger_pop_mais", { n: itens.length - 80 })));
  return itens;
}

function gerAbrirDestinos() {
  if (!gerSel.size) return;
  const p = $("gerPop");
  if (!p.hidden) { gerFecharDestinos(); return; }
  $("gerPopBusca").value = "";
  gerPintarDestinosLista();
  p.hidden = false;
  try { $("gerPopBusca").focus(); } catch (e) {}
}

/* Escolheu o destino na lista: já pergunta e move. */
function gerEscolherDestino(ch) {
  $("gerDestino").value = ch;
  gerFecharDestinos();
  return gerAcaoMover();
}

function gerPintarDestinos() {
  const sel = $("gerDestino");
  sel.innerHTML = "";
  Object.keys(matResumos).map((ch) => ({ ch, r: matResumos[ch] })).filter((x) => x.r && (x.r.disciplina || x.r.topico))
    .sort((a, b) => String((a.r.disciplina || "") + (a.r.topico || "")).localeCompare(String((b.r.disciplina || "") + (b.r.topico || "")), "pt"))
    .forEach((x) => {
      const o = document.createElement("option");
      o.value = x.ch; o.textContent = [x.r.disciplina, x.r.topico].filter(Boolean).join(" › ");
      sel.append(o);
    });
}

function gerPintar() { gerPintarArvore(); gerPintarLista(); gerPintarPrevia(); gerPintarAcoes(); }

function gerMarcados() { return [...gerSel].sort((a, b) => a - b).map((pos) => gerNotas[gerVis[pos]]).filter(Boolean); }

async function gerAcaoApagar(lista) {
  const ms = Array.isArray(lista) ? lista : gerMarcados();
  if (!ms.length) return;
  if (!(await uiConfirm(t("ger_conf_apagar", { n: ms.length })))) return;
  const r = gerApagar(ms);
  gerCalcular(); gerPintarDestinos(); gerPintar();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_feito_apagar", { n: r.apagados, m: r.naoAchou }), true);
}

/* o botão "lixeira" da prévia: só o cartão aberto */
function gerAcaoApagarAberto() {
  const idx = gerFoco >= 0 ? gerVis[gerFoco] : undefined;
  if (idx === undefined) return Promise.resolve();
  return gerAcaoApagar([gerNotas[idx]]);
}

async function gerAcaoMover() {
  const ms = gerMarcados();
  const dest = $("gerDestino").value;
  if (!ms.length || !dest) return;
  const nome = ($("gerDestino").options && $("gerDestino").selectedOptions && $("gerDestino").selectedOptions[0])
    ? $("gerDestino").selectedOptions[0].textContent : [matResumos[dest].disciplina, matResumos[dest].topico].join(" › ");
  if (!(await uiConfirm(t("ger_conf_mover", { n: ms.length, d: nome })))) return;
  const r = gerMover(ms, dest);
  gerCalcular(); gerPintar();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_feito_mover", { n: r.movidos, m: r.repetidos, k: r.naoAchou }), true);
}

function gerAcaoEditar() {
  if (gerFoco < 0) return;
  const idx = gerVis[gerFoco];
  gerEditando = true;
  $("gerEditor").value = cardToLine(gerNotas[idx].card);
  gerPintarPrevia();
}

function gerAcaoSalvarEdicao() {
  const idx = gerFoco >= 0 ? gerVis[gerFoco] : undefined;
  if (idx === undefined) return;
  const r = gerEditar(gerNotas[idx], $("gerEditor").value);
  if (!r.ok) { uiAlert(t(r.motivo === "sem_cartao" ? "ger_edit_sem_cartao" : "ger_edit_nao_achou")); return; }
  gerCalcular(); gerPintar();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_feito_editar"), true);
}

function gerAcaoMelhorar() {
  const ms = gerMarcados();
  if (!ms.length) return;
  $("dlgGerCartoes").close();
  ceAbrir({ notas: ms.slice(0, CE_LIM.lote) });
}

async function gerAcaoDesfazer() {
  if (!(await uiConfirm(t("ger_conf_desfazer")))) return;
  const r = gerDesfazerUltima();
  gerCalcular(); gerPintarDestinos(); gerPintar();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_desfeito", { n: r.desfeitos, m: r.pulados }), false);
}

/* Janela maior: o botão alterna entre o tamanho normal e quase a tela toda, e a escolha fica
 * lembrada. (O canto da janela também dá para arrastar.) */
function gerGrandeLer() {
  try { return localStorage.getItem(GER_CHAVE_GRANDE) === "1"; } catch (e) { return false; }
}
function gerAplicarTamanho(grande) {
  const d = $("dlgGerCartoes");
  d.classList.toggle("ger-grande", !!grande);
  if (!grande) { try { d.style.width = ""; d.style.height = ""; } catch (e) {} }
  $("btnGerAmpliar").textContent = t(grande ? "ger_reduzir" : "ger_ampliar");
  $("btnGerAmpliar").setAttribute("aria-pressed", grande ? "true" : "false");
}
function gerAmpliar() {
  const grande = !$("dlgGerCartoes").classList.contains("ger-grande");
  try { localStorage.setItem(GER_CHAVE_GRANDE, grande ? "1" : "0"); } catch (e) {}
  gerAplicarTamanho(grande);
}

function gerAbrir() {
  gerPasta = null; gerFechados = new Set();
  $("gerBusca").value = ""; $("gerFiltro").value = "todos"; gerAviso("", false);
  gerFecharDestinos();
  gerCalcular(); gerPintarDestinos(); gerPintar();
  gerAplicarTamanho(gerGrandeLer());
  abrirModal("dlgGerCartoes");
  try { matReg("cartoes", "gerenciador aberto", gerNotas.length + " cartões"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnGerCartoes")) {
  $("btnGerCartoes").onclick = gerAbrir;
  if ($("btnBancaGer")) $("btnBancaGer").onclick = gerAbrir;
  $("btnGerFechar").onclick = () => $("dlgGerCartoes").close();
  $("gerBusca").oninput = () => { gerRefiltrar(); gerPintar(); };
  $("gerFiltro").onchange = () => { gerRefiltrar(); gerPintar(); };
  $("btnGerMais").onclick = () => { gerMostrando += GER_LIM.visiveis; gerPintarLista(); };
  $("btnGerMarcar").onclick = () => { gerSel = new Set(gerVis.slice(0, gerMostrando).map((_, i) => i)); gerPintarLista(); gerPintarAcoes(); };
  $("btnGerLimpar").onclick = () => { gerSel = new Set(); gerPintarLista(); gerPintarAcoes(); };
  $("btnGerApagar").onclick = gerAcaoApagar;
  $("btnGerMover").onclick = gerAbrirDestinos;
  $("gerPopBusca").oninput = gerPintarDestinosLista;
  $("gerPopBusca").onkeydown = (ev) => {
    if (!ev) return;
    if (ev.key === "Escape") { ev.stopPropagation && ev.stopPropagation(); ev.preventDefault && ev.preventDefault(); gerFecharDestinos(); }
    else if (ev.key === "Enter") { ev.preventDefault && ev.preventDefault(); const it = gerPintarDestinosLista(); if (it.length) gerEscolherDestino(it[0].ch); }
  };
  $("btnGerAmpliar").onclick = gerAmpliar;
  $("btnGerPreApagar").onclick = gerAcaoApagarAberto;
  $("btnGerMsgDesfazer").onclick = gerAcaoDesfazer;
  if (typeof document.addEventListener === "function") {
    document.addEventListener("mousedown", (ev) => {
      const p = $("gerPop");
      if (!p || p.hidden) return;
      const alvo = ev && ev.target;
      const dentro = (e) => { for (let x = e; x; x = x.parentNode) { if (x === p || x === $("btnGerMover")) return true; } return false; };
      if (!dentro(alvo)) gerFecharDestinos();
    });
  }
  $("btnGerEditar").onclick = gerAcaoEditar;
  $("btnGerEditSalvar").onclick = gerAcaoSalvarEdicao;
  $("btnGerEditCancelar").onclick = () => { gerEditando = false; gerPintarPrevia(); };
  $("btnGerMelhorar").onclick = gerAcaoMelhorar;
  $("btnGerDesfazer").onclick = gerAcaoDesfazer;
}
