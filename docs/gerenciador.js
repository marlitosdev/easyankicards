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
const GER_CHAVE_PASTAS = "eac_ger_pastas";

/* A explicação de CADA controle das duas janelas (o gerenciador e a de nova pasta): id → chave do texto.
 * O teste confere que todo botão do HTML está aqui, para botão novo nunca nascer sem explicação. */
const GER_DICAS = {
  btnGerAmpliar: "ger_tip_ampliar", btnGerNovaPasta: "ger_tip_nova_pasta", gerFiltro: "ger_tip_filtro",
  btnGerMarcar: "ger_tip_marcar", btnGerLimpar: "ger_tip_limpar", btnGerMarcarTodos: "ger_tip_marcar_todos",
  btnGerMais: "ger_tip_mais", btnGerEditar: "ger_tip_editar", btnGerPreApagar: "ger_tip_lixeira",
  btnGerEditSalvar: "ger_tip_edit_salvar", btnGerEditCancelar: "ger_tip_edit_cancelar",
  btnGerMsgDesfazer: "ger_tip_msg_desfazer", btnGerMover: "ger_tip_mover", btnGerApagar: "ger_tip_apagar",
  btnGerMelhorar: "ger_tip_melhorar", btnGerDesfazer: "ger_tip_desfazer", btnGerFechar: "ger_tip_fechar",
  btnGerNpOk: "ger_tip_np_ok", btnGerNpCancelar: "ger_tip_np_cancelar",
};

/* Árvore disciplina › tópico, com contagem. */
/* `vazias`: pastas criadas aqui que ainda não têm cartão — sem elas a árvore (montada só dos cartões)
 * nunca mostraria uma pasta nova. */
function gerArvore(notas, vazias) {
  const d = new Map();
  (notas || []).forEach((n) => {
    const nd = n.disciplina || "—", nt = n.topico || "—";
    if (!d.has(nd)) d.set(nd, { disciplina: nd, total: 0, topicos: new Map() });
    const x = d.get(nd); x.total++;
    if (!x.topicos.has(n.chave)) x.topicos.set(n.chave, { topico: nt, chave: n.chave, total: 0 });
    x.topicos.get(n.chave).total++;
  });
  (vazias || []).forEach((p) => {
    const nd = p.disciplina || "—";
    if (!d.has(nd)) d.set(nd, { disciplina: nd, total: 0, topicos: new Map() });
    const x = d.get(nd);
    if (!x.topicos.has(p.chave)) x.topicos.set(p.chave, { topico: p.topico || "—", chave: p.chave, total: 0, vazia: true });
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

/* ---- pastas criadas aqui ----
 * Um tópico do material só existe quando tem texto ou cartão. Para a pessoa poder criar a pasta ANTES de
 * ter o que pôr nela, as pastas novas ficam numa lista própria (eac_ger_pastas) e aparecem na árvore
 * como vazias; quando o primeiro cartão chega, o tópico nasce no material (o mesmo que "Salvar no
 * material" já faz com disciplina e tópico livres). Nada do edital é tocado. */
function gerPastasCriadas() {
  try {
    const l = JSON.parse(localStorage.getItem(GER_CHAVE_PASTAS) || "[]");
    return Array.isArray(l) ? l.filter((x) => x && x.chave && x.topico) : [];
  } catch (e) { return []; }
}
function gerPastasGravar(l) {
  try { localStorage.setItem(GER_CHAVE_PASTAS, JSON.stringify(l.slice(-300))); } catch (e) {}
}
/* as criadas aqui que NÃO têm cartão agora (as com cartão já aparecem sozinhas) */
function gerPastasVazias(notas) {
  const com = new Set((notas || []).map((n) => n.chave));
  return gerPastasCriadas().filter((p) => !com.has(p.chave));
}

/* De onde vêm disciplina e tópico de um destino: Bancada, tópico do material ou pasta criada aqui. */
function gerPastaInfo(ch) {
  if (cqEhBancada(ch)) return { disciplina: t("cq_bancada_disc"), topico: t("cq_bancada_top") };
  const r = matResumos[ch];
  if (r) return { disciplina: r.disciplina, topico: r.topico };
  const p = gerPastasCriadas().find((x) => x.chave === ch);
  return p ? { disciplina: p.disciplina, topico: p.topico } : null;
}

/* Nomes: espaços arrumados; "›" trocado (é o separador da chave) e "::" (é nível de baralho no Anki). */
function gerLimparNome(s) {
  return String(s || "").replace(/›/g, "-").replace(/\s*::\s*/g, " - ").replace(/\s+/g, " ").trim();
}

/* Cria a pasta (só o registro): devolve { ok, chave, nome, existe } ou { ok:false, motivo }. */
function gerCriarPasta(disciplina, topico) {
  const d = gerLimparNome(disciplina), tp = gerLimparNome(topico);
  if (!d || !tp) return { ok: false, motivo: "vazia" };
  if (d.length > 80 || tp.length > 120) return { ok: false, motivo: "longa" };
  const alvo = matChaveNormal(matChave(d, tp));
  const criadas = gerPastasCriadas();
  const jaCriada = criadas.find((x) => matChaveNormal(x.chave) === alvo);
  const viva = matChaveViva(d, tp);
  const noMaterial = !!matResumos[viva];
  const chave = jaCriada ? jaCriada.chave : viva;
  const nome = d + " › " + tp;
  /* já visível na árvore: tem cartão, ou já foi criada aqui */
  const comCartao = noMaterial && String(matResumos[viva].cartoes || "").trim();
  if (jaCriada || comCartao) return { ok: true, existe: true, chave, nome };
  criadas.push({ chave, disciplina: noMaterial ? (matResumos[viva].disciplina || d) : d, topico: noMaterial ? (matResumos[viva].topico || tp) : tp, criada: new Date().toISOString() });
  gerPastasGravar(criadas);
  try { matReg("cartoes", "gerenciador: pasta criada", nome); } catch (e) {}
  return { ok: true, existe: false, chave, nome };
}

/* Só remove pasta VAZIA criada aqui (nunca mexe em cartão nem em tópico do material). */
function gerRemoverPastaVazia(chave) {
  const tem = cqLerBiblioteca().some((n) => n.chave === chave);
  if (tem) return false;
  const l = gerPastasCriadas();
  const nova = l.filter((x) => x.chave !== chave);
  if (nova.length === l.length) return false;
  gerPastasGravar(nova);
  try { matReg("cartoes", "gerenciador: pasta vazia removida", chave); } catch (e) {}
  return true;
}

/* Move os cartões para o tópico `destChave`. O bloco (com @ e +) vai como
 * está; pergunta que o destino já tem NÃO é duplicada — o cartão fica onde
 * estava e é contado à parte. Devolve { movidos, repetidos, naoAchou }. */
function gerMover(notas, destChave) {
  const dest = gerPastaInfo(destChave);
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
    cqGravar(destChave, (at ? at + "\n" : "") + saida.bloco, { disciplina: dest.disciplina, topico: dest.topico });
    r.movidos++;
  });
  gerRegistrar(antes);
  try { matReg("cartoes", "gerenciador: cartões movidos", r.movidos + " para " + (dest.topico || destChave) + ", " + r.repetidos + " repetido(s)"); } catch (e) {}
  return r;
}

/* O que o mover vai fazer, ANTES de fazer: quantos vão de fato, quantos o destino já tem (esses ficam
 * onde estão) e quantos já estão na pasta de destino. */
function gerPrevisaoMover(notas, destChave) {
  const validos = (notas || []).filter((n) => n.chave !== destChave);
  const jaTem = new Set(gerTexto(destChave).split("\n").filter((l) => !/^\s*[@+*]/.test(l)).map(gerFrenteChave).filter(Boolean));
  const repetidos = validos.filter((n) => jaTem.has(gerFrenteChave(n.card.raw || n.card.front))).length;
  return { validos, repetidos, vao: validos.length - repetidos, jaNoDestino: (notas || []).length - validos.length };
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
  gerArvore(gerNotas, gerPastasVazias(gerNotas)).forEach((d) => {
    const aberto = !gerFechados.has(d.disciplina);
    const ativa = gerPasta && !gerPasta.chave && gerPasta.disciplina === d.disciplina;
    const cab = gerEl("div", "ger-pasta ger-disc" + (ativa ? " ger-atual" : ""));
    const seta = gerEl("span", "ger-seta", aberto ? "▾" : "▸");
    seta.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); aberto ? gerFechados.add(d.disciplina) : gerFechados.delete(d.disciplina); gerPintarArvore(); };
    cab.append(seta, gerEl("span", "", " " + d.disciplina + " (" + d.total + ")"));
    cab.title = t("ger_tip_disciplina");
    seta.title = t("ger_tip_seta");
    cab.onclick = () => { gerPasta = { disciplina: d.disciplina }; gerRefiltrar(); gerPintar(); };
    cab.ondragover = (ev) => { gerSobreDisciplina(ev, d.disciplina); };
    cab.ondragleave = () => { if (gerHoverTimer) { clearTimeout(gerHoverTimer); gerHoverTimer = null; } };
    cx.append(cab);
    if (aberto) d.topicos.forEach((tp) => {
      const li = gerEl("div", "ger-pasta ger-top" + (tp.vazia ? " ger-vazia" : "") + (gerPasta && gerPasta.chave === tp.chave ? " ger-atual" : ""), tp.topico + " (" + tp.total + ")");
      li.onclick = () => { gerPasta = { chave: tp.chave }; gerRefiltrar(); gerPintar(); };
      li.title = t(tp.vazia ? "ger_tip_pasta_vazia" : "ger_tip_pasta");
      if (tp.vazia) {
        const x = gerEl("span", "ger-x", " ✕");
        x.title = t("ger_pasta_remover");
        x.setAttribute("role", "button");
        x.onclick = (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          gerRemoverPastaVazia(tp.chave);
          if (gerPasta && gerPasta.chave === tp.chave) gerPasta = null;
          gerRefiltrar(); gerPintar(); gerPintarDestinos();
        };
        li.append(x);
      } else {
        /* a pasta inteira é arrastável: leva todos os cartões dela */
        li.draggable = true;
        li.ondragstart = (ev) => gerIniciarArrastoPasta(ev, tp.chave);
        li.ondragend = gerFimArrasto;
      }
      li.ondragover = (ev) => gerSobreAlvo(ev, tp.chave, li);
      li.ondragleave = () => gerSaiuAlvo(li);
      li.ondrop = (ev) => gerSoltar(ev, tp.chave);
      cx.append(li);
    });
  });
}

function gerPintarLista() {
  const cx = $("gerLista");
  cx.innerHTML = "";
  $("gerResumo").textContent = gerNotas.length
    ? t("ger_resumo", { v: gerVis.length, n: gerNotas.length }) : t("cq_sem_cartoes");
  $("btnGerMarcarTodos").textContent = t("ger_marcar_todos", { n: gerVis.length });
  $("btnGerMarcarTodos").hidden = gerVis.length <= 1;
  const pastaVazia = !!(gerPasta && gerPasta.chave && !gerNotas.some((n) => n.chave === gerPasta.chave));
  if (pastaVazia) cx.append(gerEl("p", "nota", t("ger_pasta_vazia")));
  else if (gerNotas.length && !gerVis.length) cx.append(gerEl("p", "nota", t("ger_nenhum")));
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
    lin.draggable = true;
    lin.title = t("ger_tip_linha");
    ck.title = t("ger_tip_caixa");
    lin.ondragstart = (ev) => gerIniciarArrasto(ev, pos);
    lin.ondragend = gerFimArrasto;
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
  const banca = { ch: CQ_BANCADA, nome: [t("cq_bancada_disc"), t("cq_bancada_top")].join(" › ") };
  const vivos = Object.keys(matResumos).map((ch) => ({ ch, r: matResumos[ch] })).filter((x) => x.r && (x.r.disciplina || x.r.topico));
  const tem = new Set(vivos.map((x) => x.ch));
  gerPastasCriadas().forEach((p) => { if (!tem.has(p.chave)) vivos.push({ ch: p.chave, r: { disciplina: p.disciplina, topico: p.topico } }); });
  return [banca].concat(vivos
    .sort((a, b) => String((a.r.disciplina || "") + (a.r.topico || "")).localeCompare(String((b.r.disciplina || "") + (b.r.topico || "")), "pt"))
    .map((x) => ({ ch: x.ch, nome: [x.r.disciplina, x.r.topico].filter(Boolean).join(" › ") })));
}
function gerNomeDestino(ch) {
  const d = gerDestinosLista().find((x) => x.ch === ch);
  return d ? d.nome : String(ch);
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
    b.title = t("ger_tip_destino", { d: d.nome });
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
  gerDestinosLista().forEach((x) => {
    const o = document.createElement("option");
    o.value = x.ch; o.textContent = x.nome;
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

/* Mover {ms} para {dest}: mostra o que vai acontecer (quantos vão, quantos o destino já tem) e só
 * move se você confirmar. É o que o botão "Mover para…" e o arrastar-e-soltar chamam. */
async function gerConfirmarMover(ms, dest) {
  if (!ms || !ms.length || !dest) return;
  const prev = gerPrevisaoMover(ms, dest);
  if (!prev.validos.length) { gerAviso(t("ger_mover_mesmo"), false); return; }
  const msg = t("ger_conf_mover", { n: prev.validos.length, d: gerNomeDestino(dest) })
    + (prev.repetidos ? "\n\n" + t("ger_conf_mover_rep", { r: prev.repetidos }) : "");
  if (!(await uiConfirm(msg))) return;
  const r = gerMover(prev.validos, dest);
  gerCalcular(); gerPintar();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_feito_mover", { n: r.movidos, m: r.repetidos, k: r.naoAchou }), true);
}

async function gerAcaoMover() {
  return gerConfirmarMover(gerMarcados(), $("gerDestino").value);
}

/* ---- arrastar e soltar (mouse) ----
 * Arrastar um cartão MARCADO leva todos os marcados; um não marcado leva só ele. Soltar numa pasta da
 * árvore pergunta e move (o mesmo mover do botão, com o mesmo desfazer). Em tela de toque o navegador
 * não arrasta: lá vale o botão "Mover para…". */
let gerArrasto = null, gerHoverTimer = null, gerGhost = null;

function gerNotasDoArrasto(pos) {
  if (gerSel.has(pos)) return gerMarcados();
  const n = gerNotas[gerVis[pos]];
  return n ? [n] : [];
}

function gerIniciarArrasto(ev, pos) {
  return gerComecarArrasto(ev, gerNotasDoArrasto(pos), pos);
}

/* Arrastar uma PASTA (linha da árvore) leva todos os cartões dela, com ou sem filtro na lista. */
function gerIniciarArrastoPasta(ev, chave) {
  return gerComecarArrasto(ev, gerNotas.filter((n) => n.chave === chave), -1);
}

function gerComecarArrasto(ev, ms, pos) {
  if (!ms.length) { if (ev && ev.preventDefault) ev.preventDefault(); return; }
  gerArrasto = { notas: ms, pos };
  const texto = ms.length === 1 ? t("ger_arrastando_1") : t("ger_arrastando", { n: ms.length });
  try {
    const dt = ev.dataTransfer;
    dt.effectAllowed = "move";
    dt.setData("text/plain", texto);
    /* a pílula que acompanha o ponteiro: quantos cartões estão indo */
    const g = document.createElement("div");
    g.className = "ger-ghost"; g.textContent = texto;
    document.body.append(g);
    gerGhost = g;
    if (dt.setDragImage) dt.setDragImage(g, 14, 14);
  } catch (e) {}
  try { $("dlgGerCartoes").classList.add("ger-arrastando"); } catch (e) {}
  gerPintarMarcaArrasto(true);
}

/* as linhas que estão sendo arrastadas ficam esmaecidas */
function gerPintarMarcaArrasto(ligar) {
  const cx = $("gerLista");
  Array.from(cx.children || []).forEach((el, i) => {
    if (el.classList) el.classList.toggle("ger-indo", !!ligar && !!gerArrasto && gerArrasto.notas.some((n) => n === gerNotas[gerVis[i]]));
  });
}

function gerFimArrasto() {
  gerArrasto = null;
  if (gerHoverTimer) { clearTimeout(gerHoverTimer); gerHoverTimer = null; }
  try { if (gerGhost && gerGhost.parentNode) gerGhost.parentNode.removeChild(gerGhost); } catch (e) {}
  gerGhost = null;
  try { $("dlgGerCartoes").classList.remove("ger-arrastando"); } catch (e) {}
  gerPintarMarcaArrasto(false);
  const filhos = Array.from($("gerArvore").children || []);
  filhos.forEach((el) => { if (el.classList) el.classList.remove("ger-alvo", "ger-alvo-no"); });
}

/* só é alvo uma pasta que receba ALGUM dos cartões (soltar na própria pasta não faz nada) */
function gerAlvoValido(chave) {
  return !!gerArrasto && !!chave && gerArrasto.notas.some((n) => n.chave !== chave);
}

function gerSobreAlvo(ev, chave, el) {
  if (!gerArrasto) return;
  const ok = gerAlvoValido(chave);
  if (ok && ev && ev.preventDefault) ev.preventDefault();    /* é o preventDefault que permite soltar */
  try { if (ev && ev.dataTransfer) ev.dataTransfer.dropEffect = ok ? "move" : "none"; } catch (e) {}
  if (el && el.classList) { el.classList.toggle("ger-alvo", ok); el.classList.toggle("ger-alvo-no", !ok); }
}

function gerSaiuAlvo(el) {
  if (el && el.classList) el.classList.remove("ger-alvo", "ger-alvo-no");
}

/* Disciplina fechada não mostra os tópicos: segurando o cartão em cima dela por um instante, ela abre. */
function gerSobreDisciplina(ev, disc) {
  if (!gerArrasto || !gerFechados.has(disc)) return;
  if (ev && ev.preventDefault) ev.preventDefault();
  if (gerHoverTimer) clearTimeout(gerHoverTimer);
  gerHoverTimer = setTimeout(() => { gerHoverTimer = null; gerFechados.delete(disc); gerPintarArvore(); }, 600);
}

function gerSoltar(ev, chave) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const ms = gerArrasto && gerArrasto.notas;
  gerFimArrasto();
  if (!ms || !chave) return Promise.resolve();
  return gerConfirmarMover(ms, chave);
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

/* "＋ Nova pasta": uma janelinha com a disciplina (já preenchida com a da pasta aberta, com as existentes
 * como sugestão) e o nome da pasta. Erro de nome aparece DENTRO dela, sem fechar. (O uiPrompt antigo não
 * usa showModal e ficava invisível por baixo do gerenciador.) */
function gerAbrirNovaPasta() {
  const atual = gerPasta && gerPasta.chave ? gerPastaInfo(gerPasta.chave) : (gerPasta ? { disciplina: gerPasta.disciplina } : null);
  const banca = t("cq_bancada_disc");
  $("gerNpDisc").value = (atual && atual.disciplina && atual.disciplina !== banca) ? atual.disciplina : "";
  $("gerNpTop").value = "";
  $("gerNpErro").textContent = "";
  const dl = $("gerNpDiscLista");
  dl.innerHTML = "";
  gerArvore(gerNotas, gerPastasVazias(gerNotas)).map((d) => d.disciplina).filter((d) => d && d !== "—" && d !== banca).forEach((d) => {
    const o = document.createElement("option");
    o.value = d;
    dl.append(o);
  });
  abrirModal("dlgGerNovaPasta");
  try { ($("gerNpDisc").value ? $("gerNpTop") : $("gerNpDisc")).focus(); } catch (e) {}
}

function gerConfirmarNovaPasta() {
  const r = gerCriarPasta($("gerNpDisc").value, $("gerNpTop").value);
  if (!r.ok) { $("gerNpErro").textContent = t(r.motivo === "longa" ? "ger_np_longa" : "ger_np_vazia"); return r; }
  $("dlgGerNovaPasta").close();
  gerPasta = { chave: r.chave };
  gerCalcular(); gerPintarDestinos(); gerPintar();
  gerAviso(t(r.existe ? "ger_np_existe" : "ger_np_criada", { n: r.nome }), false);
  return r;
}

/* marca TODOS os cartões da lista de agora (não só os 60 à vista): é o "mover todos desta pasta" */
function gerMarcarTodos() {
  gerSel = new Set(gerVis.map((_, i) => i));
  gerPintarLista(); gerPintarAcoes();
}

function gerAbrir() {
  gerPasta = null; gerFechados = new Set();
  $("gerBusca").value = ""; $("gerFiltro").value = "todos"; gerAviso("", false);
  gerFecharDestinos();
  gerCalcular(); gerPintarDestinos(); gerPintar();
  gerAplicarTamanho(gerGrandeLer());
  dicasDosBotoes(GER_DICAS);
  abrirModal("dlgGerCartoes");
  try { matReg("cartoes", "gerenciador aberto", gerNotas.length + " cartões"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnGerCartoes")) {
  $("btnGerCartoes").onclick = gerAbrir;
  if ($("btnBancaGer")) $("btnBancaGer").onclick = gerAbrir;
  $("btnGerFechar").onclick = () => $("dlgGerCartoes").close();
  $("gerBusca").oninput = () => { gerRefiltrar(); gerPintar(); };
  $("gerFiltro").onchange = () => { gerRefiltrar(); gerPintar(); };
  $("btnGerMais").onclick = () => { gerMostrando += GER_LIM.visiveis; gerPintarLista(); flashBotao($("btnGerMais")); };
  $("btnGerMarcar").onclick = () => { gerSel = new Set(gerVis.slice(0, gerMostrando).map((_, i) => i)); gerPintarLista(); gerPintarAcoes(); flashBotao($("btnGerMarcar")); };
  $("btnGerLimpar").onclick = () => { gerSel = new Set(); gerPintarLista(); gerPintarAcoes(); flashBotao($("btnGerLimpar")); };
  $("btnGerMarcarTodos").onclick = () => { gerMarcarTodos(); flashBotao($("btnGerMarcarTodos")); };
  $("btnGerNovaPasta").onclick = gerAbrirNovaPasta;
  $("btnGerNpOk").onclick = gerConfirmarNovaPasta;
  $("btnGerNpCancelar").onclick = () => $("dlgGerNovaPasta").close();
  ["gerNpDisc", "gerNpTop"].forEach((id) => {
    $(id).onkeydown = (ev) => { if (ev && ev.key === "Enter") { if (ev.preventDefault) ev.preventDefault(); gerConfirmarNovaPasta(); } };
  });
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
  $("btnGerEditar").onclick = () => { gerAcaoEditar(); flashBotao($("btnGerEditar")); };
  $("btnGerEditSalvar").onclick = gerAcaoSalvarEdicao;
  $("btnGerEditCancelar").onclick = () => { gerEditando = false; gerPintarPrevia(); };
  $("btnGerMelhorar").onclick = gerAcaoMelhorar;
  $("btnGerDesfazer").onclick = gerAcaoDesfazer;
}
