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
const GER_CHAVE_AGRUPAR = "eac_ger_agrupar";
const GER_CHAVE_VAZIAS = "eac_ger_ocultar_vazias";
let gerOcultarVazias = false;

/* A explicação de CADA controle das duas janelas (o gerenciador e a de nova pasta): id → chave do texto.
 * O teste confere que todo botão do HTML está aqui, para botão novo nunca nascer sem explicação. */
const GER_DICAS = {
  btnGerX: "ger_tip_x", btnGerAbaPastas: "ger_tip_aba_pastas", btnGerAbaCartoes: "ger_tip_aba_cartoes", btnGerAbaPrevia: "ger_tip_aba_previa",
  btnGerAmpliar: "ger_tip_ampliar", gerAgrupar: "ger_tip_agrupar", btnGerNovaPasta: "ger_tip_nova_pasta", gerFiltro: "ger_tip_filtro",
  btnGerMarcar: "ger_tip_marcar", btnGerLimpar: "ger_tip_limpar", btnGerMarcarTodos: "ger_tip_marcar_todos",
  btnGerMais: "ger_tip_mais", btnGerEditar: "ger_tip_editar", btnGerPreApagar: "ger_tip_lixeira",
  btnGerEditSalvar: "ger_tip_edit_salvar", btnGerEditCancelar: "ger_tip_edit_cancelar",
  btnGerMsgDesfazer: "ger_tip_msg_desfazer", btnGerMover: "ger_tip_mover", btnGerApagar: "ger_tip_apagar",
  btnGerMelhorar: "ger_tip_melhorar", btnGerDesfazer: "ger_tip_desfazer", btnGerFechar: "ger_tip_fechar",
  btnGerNpOk: "ger_tip_np_ok", btnGerNpCancelar: "ger_tip_np_cancelar", gerNpEdital: "ger_tip_np_edital",
  btnGerClassificar: "ger_tip_classificar", btnGerExportar: "ger_tip_exportar", btnGerRamos: "ger_tip_ramos", btnGerClMover: "ger_tip_cl_mover", btnGerClFechar: "ger_tip_cl_fechar",
  gerClEdital: "ger_tip_cl_edital", gerClGerais: "ger_tip_cl_gerais",
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
    if (p && p.chaves && !p.chaves.has(n.chave)) return;
    if (p && p.chave && n.chave !== p.chave) return;
    if (p && p.ramo) {
      const id = ramIdDoCartao(n.card);
      if (p.ramo === RAM_GERAL) { if (id && p.conhecidos && p.conhecidos.has(id)) return; }
      else if (id !== p.ramo) return;
    }
    if (p && !p.chave && !p.chaves && p.disciplina && (n.disciplina || "—") !== p.disciplina) return;
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
function gerRegistrar(antes, extra) {
  const itens = Object.keys(antes).filter((ch) => antes[ch] !== gerTexto(ch)).map((ch) => ({
    chave: ch, antes: antes[ch], depois: gerTexto(ch),
    disciplina: (matResumos[ch] || {}).disciplina, topico: (matResumos[ch] || {}).topico }));
  try {
    if (itens.length || (extra && extra.edital)) localStorage.setItem(GER_CHAVE_RECIBO, JSON.stringify({ quando: new Date().toISOString(), itens, edital: (extra && extra.edital) || undefined }));
  } catch (e) {}
  return itens.length;
}

/* há o que desfazer? (cartões movidos/apagados/etiquetados OU o texto do edital, quando só os ramos mudaram) */
function gerTemRecibo() {
  const rec = gerRecibo();
  return !!(rec && ((rec.itens && rec.itens.length) || rec.edital));
}

function gerRecibo() {
  try { return JSON.parse(localStorage.getItem(GER_CHAVE_RECIBO) || "null"); } catch (e) { return null; }
}

/* Só desfaz o tópico que continua como a ação o deixou. */
function gerDesfazerUltima() {
  const rec = gerRecibo();
  if (!rec || !(rec.itens || rec.edital)) return { desfeitos: 0, pulados: 0 };
  let desfeitos = 0, pulados = 0;
  /* o texto do edital (ramos): só volta se continua como a ação o deixou */
  if (rec.edital) {
    const ed = (typeof editais !== "undefined" ? editais : []).find((e) => e.id === rec.edital.id);
    if (ed && ed.texto === rec.edital.depois) {
      ed.texto = rec.edital.antes;
      try { edSalvarLista(); } catch (e) {}
      try { if (typeof editalAtual !== "undefined" && editalAtual === ed.id && $("editalTexto")) { $("editalTexto").value = ed.texto; edRender(); } } catch (e) {}
      desfeitos++;
    } else pulados++;
  }
  const itensDoRecibo = rec.itens || [];
  itensDoRecibo.forEach((it) => {
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
  if (p) return { disciplina: p.disciplina, topico: p.topico };
  const v = gerVirtuais.get(ch);
  return v ? { disciplina: v.disciplina, topico: v.topico } : null;
}

/* Nomes: espaços arrumados; "›" trocado (é o separador da chave) e "::" (é nível de baralho no Anki). */
function gerLimparNome(s) {
  return String(s || "").replace(/›/g, "-").replace(/\s*::\s*/g, " - ").replace(/\s+/g, " ").trim();
}

/* Cria a pasta (só o registro): devolve { ok, chave, nome, existe } ou { ok:false, motivo }. */
function gerCriarPasta(disciplina, topico, edital) {
  const d = gerLimparNome(disciplina), tp = gerLimparNome(topico);
  const ed = edital ? (typeof editais !== "undefined" ? editais : []).find((e) => e.nome === edital) : null;
  if (!d || !tp) return { ok: false, motivo: "vazia" };
  if (d.length > 80 || tp.length > 120) return { ok: false, motivo: "longa" };
  const alvo = matChaveNormal(matChave(d, tp));
  const criadas = gerPastasCriadas();
  const jaCriada = criadas.find((x) => matChaveNormal(x.chave) === alvo);
  const viva = matChaveViva(d, tp);
  const noMaterial = !!matResumos[viva];
  const chave = jaCriada ? jaCriada.chave : viva;
  const nome = (ed ? ed.nome + " › " : "") + d + " › " + tp;
  /* tópico que JÁ é do plano deste edital: a pasta já existe (é a virtual) */
  if (ed) {
    let plano = [];
    try { plano = lerEdital(ed.texto || "").disciplinas; } catch (e) { plano = []; }
    const doPlano = [];
    plano.forEach((pd) => pd.topicos.forEach((pt) => { if (matChaveNormal(matChave(pd.nome, pt.nome)) === alvo) doPlano.push([pd.nome, pt.nome]); }));
    if (doPlano.length) return { ok: true, existe: true, chave: matChaveViva(doPlano[0][0], doPlano[0][1]), nome, plano: true };
  }
  /* já visível na árvore: tem cartão, ou já foi criada aqui */
  const comCartao = noMaterial && String(matResumos[viva].cartoes || "").trim();
  if (jaCriada || comCartao) return { ok: true, existe: true, chave, nome };
  criadas.push({ chave, disciplina: noMaterial ? (matResumos[viva].disciplina || d) : d, topico: noMaterial ? (matResumos[viva].topico || tp) : tp, edital: ed ? ed.nome : "", criada: new Date().toISOString() });
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
function gerMoverNucleo(notas, destChave, concurso, dest, antes, r) {
  const guarda = (ch) => { if (!(ch in antes)) { antes[ch] = gerTexto(ch); cqVersaoBancada("antes de mover cartões", [ch]); } };
  guarda(destChave);
  const livre = gerPastasCriadas().some((x) => x.chave === destChave);
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
    /* o edital só entra quando o tópico ainda NÃO tem dono: um tópico pertence a um edital só (é o que o
     * "Salvar no material de estudo" também faz), e gravar de novo trocaria o dono de quem já estava lá */
    const meta = { disciplina: dest.disciplina, topico: dest.topico };
    if (livre) meta.pastaLivre = true;
    if (concurso && !cqEhBancada(destChave) && !(matResumos[destChave] || {}).concurso) meta.concurso = concurso;
    cqGravar(destChave, (at ? at + "\n" : "") + saida.bloco, meta);
    r.movidos++;
  });
}

function gerMover(notas, destChave, concurso, info) {
  const dest = info || gerPastaInfo(destChave);
  const r = { movidos: 0, repetidos: 0, naoAchou: 0 };
  if (!dest) return r;
  const antes = {};
  gerMoverNucleo(notas, destChave, concurso, dest, antes, r);
  gerRegistrar(antes);
  try { matReg("cartoes", "gerenciador: cartões movidos", r.movidos + " para " + (dest.topico || destChave) + ", " + r.repetidos + " repetido(s)"); } catch (e) {}
  return r;
}

/* Vários destinos numa ação só (a classificação pelo edital): UM recibo, então "desfazer" volta tudo. */
function gerMoverGrupos(grupos, concurso) {
  const r = { movidos: 0, repetidos: 0, naoAchou: 0, topicos: 0 };
  const antes = {};
  (grupos || []).forEach((g) => {
    const antesN = r.movidos;
    gerMoverNucleo(g.notas, g.chave, concurso, { disciplina: g.disciplina, topico: g.topico }, antes, r);
    if (r.movidos > antesN) r.topicos++;
  });
  gerRegistrar(antes);
  try { matReg("cartoes", "gerenciador: classificados pelo edital", r.movidos + " cartões em " + r.topicos + " tópicos, " + r.repetidos + " repetido(s)"); } catch (e) {}
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
/* a visão da árvore: "edital" (Edital › Disciplina › Tópico) ou "disciplina" (a de antes) */
let gerAgrupar = "disciplina", gerAbertos = new Set(), gerVirtuais = new Map(), gerDestinoConcurso;
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

/* ---- visão por EDITAL: Edital › Disciplina › Tópico ----
 * Fonte das pastas: o plano de cada edital (lerEdital — inclui os tópicos SEM cartão, como pastas vazias
 * que só viram tópico do material quando chega o primeiro cartão) + o que já está no material, agrupado
 * pelo `concurso` gravado no tópico (o mesmo campo que "Salvar no material de estudo" preenche). A chave
 * do tópico é a mesma nos dois caminhos (matChaveViva): mover aqui == salvar por lá. */
function gerNomesDoEdital(ed) {
  const s = new Set();
  if (ed && ed.nome) s.add(cqNormal(ed.nome));
  try { const c = lerEdital((ed && ed.texto) || "").cfg.concurso; if (c) s.add(cqNormal(c)); } catch (e) {}
  return s;
}

function gerModeloEditais(notas, vazias) {
  const virtuais = new Map();
  const cont = new Map();
  (notas || []).forEach((n) => cont.set(n.chave, (cont.get(n.chave) || 0) + 1));
  /* quantos cartões de cada RAMO (etiqueta ram_<id>) em cada tópico */
  const contRamo = new Map();
  (notas || []).forEach((n) => {
    const id = ramIdDoCartao(n.card);
    if (!id) return;
    if (!contRamo.has(n.chave)) contRamo.set(n.chave, new Map());
    const mm = contRamo.get(n.chave); mm.set(id, (mm.get(id) || 0) + 1);
  });
  const lista = (typeof editais !== "undefined" && Array.isArray(editais)) ? editais : [];
  const eds = lista.map((ed) => ({ ed, nomes: gerNomesDoEdital(ed), id: "ed:" + ed.id }));
  const raizes = new Map(), doEdital = [], semEdital = [];
  const raiz = (id, nome, tipo, concurso) => {
    if (!raizes.has(id)) {
      const r = { tipo, id, nome, concurso, total: 0, chaves: new Set(), filhos: [], _discs: new Map() };
      raizes.set(id, r);
      (tipo === "edital" ? doEdital : semEdital).push(r);
    }
    return raizes.get(id);
  };
  const noDisc = (root, disciplina) => {
    const nome = disciplina || "—", k = cqNormal(nome);
    let d = root._discs.get(k);
    if (!d) {
      d = { tipo: "disc", id: root.id + "|" + k, nome, disciplina: nome, total: 0, chaves: new Set(), filhos: [], _tops: new Map() };
      root._discs.set(k, d); root.filhos.push(d);
    }
    return d;
  };
  const noTop = (root, disc, chave, nomeTopico, extra) => {
    if (disc._tops.has(chave)) return disc._tops.get(chave);
    const tp = Object.assign({ tipo: "top", chave, topico: nomeTopico || "—", total: cont.get(chave) || 0, concurso: root.concurso }, extra);
    tp.vazia = tp.total === 0;
    disc._tops.set(chave, tp); disc.filhos.push(tp);
    disc.total += tp.total; disc.chaves.add(chave); root.total += tp.total; root.chaves.add(chave);
    return tp;
  };
  /* 1. os editais, na ordem da lista, com o plano completo */
  eds.forEach((e) => {
    const root = raiz(e.id, e.ed.nome || "—", "edital", e.ed.nome || "");
    let plano = [];
    try { plano = lerEdital(e.ed.texto || "").disciplinas; } catch (err) { plano = []; }
    plano.forEach((d) => {
      const disc = noDisc(root, d.nome);
      d.topicos.forEach((tp) => {
        const chave = matChaveViva(d.nome, tp.nome);
        const no = noTop(root, disc, chave, tp.nome, { virtual: !cont.get(chave) });
        no.plano = { editalId: e.ed.id, disciplina: d.nome, topico: tp.nome };
        if (tp.ramos && tp.ramos.length && !no.ramos) {
          const mm = contRamo.get(chave) || new Map();
          const conhecidos = new Set(tp.ramos.map((rm) => rm.id));
          no.ramos = tp.ramos.map((rm) => ({ tipo: "ramo", id: root.id + "|rm|" + chave + "|" + rm.id, ramoId: rm.id, nome: rm.nome, peso: rm.peso,
            herdado: rm.herdado, nota: rm.nota, abs: rm.abs, chave, concurso: root.concurso, total: mm.get(rm.id) || 0, conhecidos }));
          const soma = no.ramos.reduce((a, x) => a + x.total, 0);
          no.semRamo = Math.max(0, no.total - soma);
          no.conhecidos = conhecidos;
        }
        if (!virtuais.has(chave)) virtuais.set(chave, { disciplina: d.nome, topico: tp.nome, concurso: e.ed.nome || "" });
        const dono = (matResumos[chave] || {}).concurso;
        if (dono && !e.nomes.has(cqNormal(dono))) no.compartilhado = dono;
      });
    });
  });
  /* 2. os cartões: cada um vai para o edital do tópico dele (ou para "Sem edital") */
  const banca = { tipo: "bancada", id: "bancada", nome: t("cq_bancada_disc"), total: 0, chaves: new Set(), filhos: [] };
  (notas || []).forEach((n) => {
    if (cqEhBancada(n.chave)) {
      if (!banca.filhos.length) {
        banca.filhos.push({ tipo: "top", chave: CQ_BANCADA, topico: t("cq_bancada_top"), total: cont.get(CQ_BANCADA) || 0, vazia: false, concurso: undefined });
        banca.total = cont.get(CQ_BANCADA) || 0; banca.chaves.add(CQ_BANCADA);
      }
      return;
    }
    const c = (matResumos[n.chave] || {}).concurso || "";
    const dono = c ? eds.find((e) => e.nomes.has(cqNormal(c))) : null;
    const root = dono ? raizes.get(dono.id) : raiz("sem:" + cqNormal(c), c || t("ger_sem_edital"), "sem", "");
    noTop(root, noDisc(root, n.disciplina), n.chave, n.topico);
  });
  /* 3. pastas criadas aqui (sem cartão ainda) ficam em "Sem edital" */
  (vazias || []).forEach((p) => {
    const dono = p.edital ? eds.find((e) => e.nomes.has(cqNormal(p.edital))) : null;
    const root = dono ? raizes.get(dono.id) : raiz("sem:", t("ger_sem_edital"), "sem", "");
    noTop(root, noDisc(root, p.disciplina), p.chave, p.topico, { livre: true });
  });
  semEdital.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt"));
  const roots = (banca.filhos.length ? [banca] : []).concat(doEdital, semEdital);
  roots.forEach((r) => { delete r._discs; r.filhos.forEach((d) => { delete d._tops; }); });
  return { roots, virtuais };
}

/* a linha de UM tópico (pasta): usada pelas duas visões */
/* a linha de um RAMO do tópico (ou o "geral do tópico"): clicar lista os cartões dele; soltar cartões aqui os liga a ele */
function gerLinhaRamo(cx, rm, concurso) {
  const geral = rm.ramoId === RAM_GERAL;
  const peso = !geral && !rm.herdado ? " ★" + (rm.abs > 0 ? rm.abs + (rm.unidade === "p" ? "p" : "q") : rm.peso) : "";
  const ativo = !!gerPasta && gerPasta.chave === rm.chave && gerPasta.ramo === rm.ramoId;
  const li = gerEl("div", "ger-pasta ger-ramo" + (geral ? " ger-ramo-geral" : "") + (rm.total === 0 ? " ger-vazia" : "") + (ativo ? " ger-atual" : ""),
    "↳ " + rm.nome + " (" + rm.total + ")" + peso);
  li.title = geral ? t("ger_tip_ramo_geral") : t("ger_tip_ramo", { r: rm.nome }) + (rm.nota ? " — " + rm.nota : "");
  li.onclick = () => { gerPasta = { chave: rm.chave, ramo: rm.ramoId, conhecidos: rm.conhecidos, concurso: concurso || rm.concurso }; gerRefiltrar(); gerPintar(); };
  li.ondragover = (ev) => gerSobreAlvo(ev, rm.chave, li, true);
  li.ondragleave = () => gerSaiuAlvo(li);
  li.ondrop = (ev) => gerSoltarRamo(ev, rm);
  cx.append(li);
}

function gerLinhaTopico(cx, tp, concurso) {
  /* "ocultar pastas vazias": some só o que não tem cartão e não é a pasta aberta agora */
  if (gerOcultarVazias && !tp.total && !(gerPasta && gerPasta.chave === tp.chave)) return;
  const marca = tp.compartilhado ? " ↔" : "";
  const li = gerEl("div", "ger-pasta ger-top" + (tp.vazia ? " ger-vazia" : "") + (gerPasta && gerPasta.chave === tp.chave && !gerPasta.ramo ? " ger-atual" : ""), tp.topico + " (" + tp.total + ")" + marca);
  /* tópico COM ramos: uma seta abre e fecha os ramos dele */
  const idRamos = "rm|" + tp.chave + "|" + (concurso || "");
  const ramosAbertos = !!tp.ramos && gerAbertos.has(idRamos);
  if (tp.ramos) {
    const seta = gerEl("span", "ger-seta", ramosAbertos ? "▾" : "▸");
    seta.title = t("ger_tip_seta_ramos");
    seta.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); ramosAbertos ? gerAbertos.delete(idRamos) : gerAbertos.add(idRamos); gerPintarArvore(); };
    li.textContent = "";
    li.append(seta, gerEl("span", "", " " + tp.topico + " (" + tp.total + ")" + marca));
  }
  li.onclick = () => { gerPasta = { chave: tp.chave, concurso: concurso }; gerRefiltrar(); gerPintar(); };
  li.title = tp.compartilhado ? t("ger_tip_compartilhado", { e: tp.compartilhado })
    : t(tp.vazia ? (tp.virtual ? "ger_tip_pasta_edital_vazia" : "ger_tip_pasta_vazia") : "ger_tip_pasta");
  if (tp.vazia && !tp.virtual) {
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
  } else if (!tp.vazia) {
    /* a pasta inteira é arrastável: leva todos os cartões dela */
    li.draggable = true;
    li.ondragstart = (ev) => gerIniciarArrastoPasta(ev, tp.chave);
    li.ondragend = gerFimArrasto;
  }
  li.ondragover = (ev) => gerSobreAlvo(ev, tp.chave, li);
  li.ondragleave = () => gerSaiuAlvo(li);
  li.ondrop = (ev) => gerSoltar(ev, tp.chave, concurso);
  cx.append(li);
  if (ramosAbertos) {
    tp.ramos.forEach((rm) => gerLinhaRamo(cx, rm, concurso));
    if (tp.semRamo > 0) gerLinhaRamo(cx, { ramoId: RAM_GERAL, nome: t("ger_ramo_geral"), total: tp.semRamo, chave: tp.chave, concurso, conhecidos: tp.conhecidos, herdado: true });
  }
}

/* um nó da árvore por edital (edital, disciplina ou tópico) */
function gerPintarNo(cx, no) {
  if (no.tipo === "top") { gerLinhaTopico(cx, no, no.concurso); return; }
  const aberto = gerAbertos.has(no.id);
  const ativa = !!gerPasta && gerPasta.id === no.id;
  const cab = gerEl("div", "ger-pasta " + (no.tipo === "disc" ? "ger-disc" : "ger-ed") + (ativa ? " ger-atual" : ""));
  const seta = gerEl("span", "ger-seta", aberto ? "▾" : "▸");
  seta.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); aberto ? gerAbertos.delete(no.id) : gerAbertos.add(no.id); gerPintarArvore(); };
  seta.title = t("ger_tip_seta");
  cab.append(seta, gerEl("span", "", " " + no.nome + " (" + no.total + ")"));
  cab.title = t(no.tipo === "disc" ? "ger_tip_disciplina" : (no.tipo === "edital" ? "ger_tip_edital" : (no.tipo === "bancada" ? "ger_tip_bancada" : "ger_tip_sem_edital")));
  cab.onclick = () => { gerPasta = { chaves: no.chaves, id: no.id, disciplina: no.tipo === "disc" ? no.disciplina : undefined }; gerRefiltrar(); gerPintar(); };
  cab.ondragover = (ev) => gerSobreNo(ev, no.id);
  cab.ondragleave = () => { if (gerHoverTimer) { clearTimeout(gerHoverTimer); gerHoverTimer = null; } };
  cx.append(cab);
  if (aberto) no.filhos.forEach((f) => gerPintarNo(cx, f));
}

function gerPintarArvore() {
  const cx = $("gerArvore");
  cx.innerHTML = "";
  cx.classList.toggle("ger-modo-edital", gerAgrupar === "edital");
  const tudo = gerEl("div", "ger-pasta" + (!gerPasta ? " ger-atual" : ""), t("ger_todos", { n: gerNotas.length }));
  tudo.onclick = () => { gerPasta = null; gerRefiltrar(); gerPintar(); if (gerEhCelular()) gerVista("cartoes"); };
  cx.append(tudo);
  if (gerAgrupar === "edital") {
    const m = gerModeloEditais(gerNotas, gerPastasVazias(gerNotas));
    gerVirtuais = m.virtuais;
    m.roots.forEach((r) => gerPintarNo(cx, r));
    return;
  }
  gerVirtuais = new Map();
  gerArvore(gerNotas, gerPastasVazias(gerNotas)).forEach((d) => {
    const aberto = !gerFechados.has(d.disciplina);
    const ativa = gerPasta && !gerPasta.chave && !gerPasta.chaves && gerPasta.disciplina === d.disciplina;
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
    if (aberto) d.topicos.forEach((tp) => gerLinhaTopico(cx, tp, undefined));
  });
}

function gerPintarLista() {
  const cx = $("gerLista");
  cx.innerHTML = "";
  $("gerResumo").textContent = gerNotas.length
    ? t("ger_resumo", { v: gerVis.length, n: gerNotas.length }) : t("cq_sem_cartoes");
  $("btnGerMarcarTodos").textContent = t("ger_marcar_todos", { n: gerVis.length });
  $("btnGerExportar").hidden = !gerPasta;
  $("btnGerRamos").hidden = !gerContextoRamos();
  const naBancada = !!gerPasta && (gerPasta.chave === CQ_BANCADA || gerPasta.id === "bancada");
  $("btnGerClassificar").hidden = !(naBancada && typeof editais !== "undefined" && editais.length && gerBancadaNotas().length);
  $("btnGerMarcarTodos").hidden = gerVis.length <= 1;
  const pastaVazia = !!(gerPasta && gerPasta.chave && !gerNotas.some((n) => n.chave === gerPasta.chave));
  if (pastaVazia) cx.append(gerEl("p", "nota", t("ger_pasta_vazia")));
  else if (gerNotas.length && !gerVis.length) cx.append(gerEl("p", "nota", t("ger_nenhum")));
  gerVis.slice(0, gerMostrando).forEach((idx, pos) => {
    const n = gerNotas[idx];
    const lin = gerEl("div", "ger-item ger-tp-" + (n.card.kind === "cloze" ? "cloze" : (n.card.kind === "mc" ? "mc" : "basic")) + (pos === gerFoco ? " ger-foco" : ""));
    const ck = gerEl("input"); ck.type = "checkbox"; ck.checked = gerSel.has(pos);
    ck.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); };
    ck.onchange = () => { ck.checked ? gerSel.add(pos) : gerSel.delete(pos); gerPintarAcoes(); };
    const corpo = gerEl("div", "ger-corpo");
    corpo.append(gerEl("div", "ger-f", cqTrecho(cqRevelado(n.card), 140)));
    corpo.append(gerEl("div", "ger-v", cqTrecho(n.card.back, 120)));
    const onde = gerEl("div", "cq-onde");
    const tp = n.card.kind === "cloze" ? "cloze" : (n.card.kind === "mc" ? "mc" : "basic");
    onde.append(gerEl("span", "ger-tipo ger-tipo-" + tp, t("ger_tipo_" + tp)), ceSelo(ceNivel(n.card)));
    /* dentro de UM tópico o "onde" é sempre o mesmo: só aparece quando a lista mistura pastas */
    if (!(gerPasta && gerPasta.chave)) onde.append(gerEl("span", "ger-onde-lin", [n.disciplina, n.topico].filter(Boolean).join(" · ")));
    corpo.append(onde);
    lin.append(ck, corpo);
    lin.onclick = () => { gerFoco = pos; gerEditando = false; gerPintar(); if (gerEhCelular()) gerVista("previa"); };
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
  const tem = gerTemRecibo();
  $("btnGerDesfazer").hidden = !tem;
  if (!tem) $("btnGerMsgDesfazer").hidden = true;
  if (!k) gerFecharDestinos();
}

/* O aviso do que acabou de acontecer, com "desfazer" ao lado (a mesma última ação do rodapé). */
function gerAviso(texto, comDesfazer) {
  $("gerMsg").textContent = texto || "";
  $("gerMsgCx").hidden = !texto;
  $("btnGerMsgDesfazer").hidden = !(comDesfazer && gerTemRecibo());
}

/* ---- destino: um seletor com busca (o <select> nativo estourava a tela) ---- */
function gerDestinosLista() {
  const banca = { ch: CQ_BANCADA, nome: [t("cq_bancada_disc"), t("cq_bancada_top")].join(" › ") };
  if (gerAgrupar === "edital") {
    const out = [banca];
    gerModeloEditais(gerNotas, gerPastasVazias(gerNotas)).roots.forEach((r) => {
      if (r.tipo === "bancada") return;
      r.filhos.forEach((d) => d.filhos.forEach((tp) => {
        out.push({ ch: tp.chave, concurso: r.tipo === "edital" ? r.concurso : undefined,
          nome: (r.tipo === "edital" ? [r.nome, d.nome, tp.topico] : [d.nome, tp.topico]).join(" › ") });
      }));
    });
    return out;
  }
  const vivos = Object.keys(matResumos).map((ch) => ({ ch, r: matResumos[ch] })).filter((x) => x.r && (x.r.disciplina || x.r.topico));
  const tem = new Set(vivos.map((x) => x.ch));
  gerPastasCriadas().forEach((p) => { if (!tem.has(p.chave)) vivos.push({ ch: p.chave, r: { disciplina: p.disciplina, topico: p.topico } }); });
  return [banca].concat(vivos
    .sort((a, b) => String((a.r.disciplina || "") + (a.r.topico || "")).localeCompare(String((b.r.disciplina || "") + (b.r.topico || "")), "pt"))
    .map((x) => ({ ch: x.ch, nome: [x.r.disciplina, x.r.topico].filter(Boolean).join(" › ") })));
}
function gerNomeDestino(ch, concurso) {
  const l = gerDestinosLista();
  const d = l.find((x) => x.ch === ch && (concurso === undefined || x.concurso === concurso)) || l.find((x) => x.ch === ch);
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
    b.onclick = () => gerEscolherDestino(d.ch, d.concurso);
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
function gerEscolherDestino(ch, concurso) {
  $("gerDestino").value = ch;
  gerDestinoConcurso = concurso;
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

/* ---- AS ABAS DO TELEFONE (pastas / cartões / prévia): só valem em tela estreita; em tela larga as três colunas seguem lado a lado ---- */
let gerVistaAtual = "pastas", gerVistaPasta = "null", gerCelularForcado = null;
function gerEhCelular() {
  if (gerCelularForcado !== null) return gerCelularForcado;
  try { return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width:760px)").matches); } catch (e) { return false; }
}
function gerVista(v) {
  if (["pastas", "cartoes", "previa"].indexOf(v) < 0) return gerVistaAtual;
  gerVistaAtual = v;
  const dlg = $("dlgGerCartoes");
  if (dlg && dlg.classList) {
    ["pastas", "cartoes", "previa"].forEach((x) => dlg.classList.toggle("ger-v-" + x, x === v));
  }
  [["btnGerAbaPastas", "pastas"], ["btnGerAbaCartoes", "cartoes"], ["btnGerAbaPrevia", "previa"]].forEach(([id, x]) => {
    const b = $(id); if (b) b.setAttribute("aria-selected", x === v ? "true" : "false");
  });
  return v;
}
/* escolher uma pasta leva aos cartões (só no telefone); tocar num cartão leva à prévia (no clique do próprio cartão) */
function gerVistaDecidir() {
  const ab = $("btnGerAbaCartoes");
  if (ab) ab.textContent = t("ger_aba_cartoes", { n: gerVis.length });
  const chave = JSON.stringify(gerPasta || null);
  const mudouPasta = chave !== gerVistaPasta;
  gerVistaPasta = chave;
  if (!gerEhCelular()) return;
  if (mudouPasta && gerPasta) gerVista("cartoes");
}
function gerPintar() { gerPintarArvore(); gerPintarLista(); gerPintarPrevia(); gerPintarAcoes(); gerVistaDecidir(); }

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
async function gerConfirmarMover(ms, dest, concurso) {
  if (!ms || !ms.length || !dest) return;
  const prev = gerPrevisaoMover(ms, dest);
  if (!prev.validos.length) { gerAviso(t("ger_mover_mesmo"), false); return; }
  const msg = t("ger_conf_mover", { n: prev.validos.length, d: gerNomeDestino(dest, concurso) })
    + (prev.repetidos ? "\n\n" + t("ger_conf_mover_rep", { r: prev.repetidos }) : "");
  if (!(await uiConfirm(msg))) return;
  const r = gerMover(prev.validos, dest, concurso);
  gerCalcular(); gerPintar();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_feito_mover", { n: r.movidos, m: r.repetidos, k: r.naoAchou }), true);
}

async function gerAcaoMover() {
  return gerConfirmarMover(gerMarcados(), $("gerDestino").value, gerDestinoConcurso);
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

function gerSobreAlvo(ev, chave, el, aceitaMesma) {
  if (!gerArrasto) return;
  const ok = aceitaMesma ? !!chave : gerAlvoValido(chave);
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

/* o mesmo, na visão por edital: nó fechado abre ao segurar o cartão em cima */
function gerSobreNo(ev, id) {
  if (!gerArrasto || gerAbertos.has(id)) return;
  if (ev && ev.preventDefault) ev.preventDefault();
  if (gerHoverTimer) clearTimeout(gerHoverTimer);
  gerHoverTimer = setTimeout(() => { gerHoverTimer = null; gerAbertos.add(id); gerPintarArvore(); }, 600);
}

/* soltar cartões num RAMO: liga-os a ele (os de outro tópico são movidos para o tópico do ramo) */
function gerSoltarRamo(ev, rm) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const ms = gerArrasto && gerArrasto.notas;
  gerFimArrasto();
  if (!ms) return Promise.resolve();
  return gerConfirmarRamo(ms, rm);
}

async function gerConfirmarRamo(ms, rm) {
  if (!ms || !ms.length) return;
  const geral = rm.ramoId === RAM_GERAL;
  const fora = ms.filter((n) => n.chave !== rm.chave).length;
  const msg = t(geral ? "ger_conf_ramo_geral" : "ger_conf_ramo", { n: ms.length, r: rm.nome })
    + (fora ? "\n\n" + t("ger_conf_ramo_fora", { f: fora }) : "");
  if (!(await uiConfirm(msg))) return;
  const r = ramAtribuir(ms, rm.chave, geral ? "" : rm.ramoId, rm.concurso);
  gerCalcular(); gerAbrirCaminhoDe(rm.chave); gerPintar(); gerPintarDestinos();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_feito_ramo", { n: r.ligados, m: r.movidos }), true);
}

function gerSoltar(ev, chave, concurso) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const ms = gerArrasto && gerArrasto.notas;
  gerFimArrasto();
  if (!ms || !chave) return Promise.resolve();
  return gerConfirmarMover(ms, chave, concurso);
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
/* o edital da pasta aberta (para a pasta nova nascer dentro dele): raiz/disciplina do edital ou tópico dele */
function gerEditalDoContexto() {
  if (!gerPasta) return "";
  const m = gerModeloEditais(gerNotas, gerPastasVazias(gerNotas));
  if (gerPasta.id) {
    const r = m.roots.find((x) => x.tipo === "edital" && (gerPasta.id === x.id || gerPasta.id.indexOf(x.id + "|") === 0));
    return r ? r.concurso : "";
  }
  if (gerPasta.chave) {
    if (gerPasta.concurso && m.roots.some((x) => x.tipo === "edital" && x.concurso === gerPasta.concurso && x.chaves.has(gerPasta.chave))) return gerPasta.concurso;
    const r = m.roots.find((x) => x.tipo === "edital" && x.chaves.has(gerPasta.chave));
    return r ? r.concurso : "";
  }
  return "";
}

/* disciplinas sugeridas: as que já existem + as do plano do edital escolhido */
function gerPreencherDiscsNp() {
  const banca = t("cq_bancada_disc");
  const dl = $("gerNpDiscLista");
  dl.innerHTML = "";
  const nomes = [];
  gerArvore(gerNotas, gerPastasVazias(gerNotas)).forEach((d) => nomes.push(d.disciplina));
  const ed = (typeof editais !== "undefined" ? editais : []).find((e) => e.nome === $("gerNpEdital").value);
  if (ed) { try { lerEdital(ed.texto || "").disciplinas.forEach((d) => nomes.push(d.nome)); } catch (e) {} }
  const vistos = new Set();
  nomes.filter((d) => d && d !== "—" && d !== banca).forEach((d) => {
    const k = cqNormal(d);
    if (vistos.has(k)) return;
    vistos.add(k);
    const o = document.createElement("option");
    o.value = d;
    dl.append(o);
  });
}

function gerAbrirNovaPasta() {
  const atual = gerPasta && gerPasta.chave ? gerPastaInfo(gerPasta.chave) : (gerPasta ? { disciplina: gerPasta.disciplina } : null);
  const sel = $("gerNpEdital");
  sel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = ""; o0.textContent = t("ger_np_sem_edital");
  sel.append(o0);
  (typeof editais !== "undefined" ? editais : []).forEach((e) => {
    const o = document.createElement("option");
    o.value = e.nome; o.textContent = e.nome;
    sel.append(o);
  });
  const ctx = gerEditalDoContexto();
  sel.value = (typeof editais !== "undefined" ? editais : []).some((e) => e.nome === ctx) ? ctx : "";
  const banca = t("cq_bancada_disc");
  $("gerNpDisc").value = (atual && atual.disciplina && atual.disciplina !== banca) ? atual.disciplina : "";
  $("gerNpTop").value = "";
  $("gerNpErro").textContent = "";
  gerPreencherDiscsNp();
  abrirModal("dlgGerNovaPasta");
  try { ($("gerNpDisc").value ? $("gerNpTop") : $("gerNpDisc")).focus(); } catch (e) {}
}

function gerConfirmarNovaPasta() {
  const r = gerCriarPasta($("gerNpDisc").value, $("gerNpTop").value, $("gerNpEdital").value);
  if (!r.ok) { $("gerNpErro").textContent = t(r.motivo === "longa" ? "ger_np_longa" : "ger_np_vazia"); return r; }
  $("dlgGerNovaPasta").close();
  gerPasta = { chave: r.chave };
  gerCalcular(); gerAbrirCaminhoDe(r.chave); gerPintarDestinos(); gerPintar();
  gerAviso(t(r.existe ? "ger_np_existe" : "ger_np_criada", { n: r.nome }), false);
  return r;
}

/* abre (na visão por edital) o edital e a disciplina onde está a pasta, para ela aparecer */
function gerAbrirCaminhoDe(chave) {
  gerModeloEditais(gerNotas, gerPastasVazias(gerNotas)).roots.forEach((r) => {
    r.filhos.forEach((d) => {
      const tops = d.tipo === "disc" ? d.filhos : [d];
      if (tops.some((tp) => tp.chave === chave)) { gerAbertos.add(r.id); if (d.tipo === "disc") gerAbertos.add(d.id); }
    });
  });
}

/* ---- classificar a Bancada pelo edital ----
 * A MESMA sugestão do "Salvar no material de estudo" (cmClassificarLocal: etiquetas do cartão × tópicos do
 * edital), só que aqui a pessoa vê o resultado por tópico antes de mover, e desfaz tudo de uma vez. */
function gerBancadaNotas() { return gerNotas.filter((n) => cqEhBancada(n.chave)); }

function gerClassificar(notas, ed, comGerais) {
  const itens = cmClassificarLocal(notas.map((n) => n.card), cmPlanoDoEdital(ed));
  const mapa = new Map(), semPista = [], soDisciplina = [];
  itens.forEach((x, i) => {
    const n = notas[i];
    if (!x.sugestao) { semPista.push(n); return; }
    const gerais = x.sugestao.topico === CM_GERAL;
    if (gerais && !comGerais) { soDisciplina.push(n); return; }
    const chave = matChaveViva(x.sugestao.disciplina, x.sugestao.topico);
    if (!mapa.has(chave)) mapa.set(chave, { chave, disciplina: x.sugestao.disciplina, topico: x.sugestao.topico, gerais, notas: [] });
    mapa.get(chave).notas.push(n);
  });
  const grupos = [...mapa.values()];
  return { grupos, semPista, soDisciplina, total: notas.length, classificados: grupos.reduce((s, g) => s + g.notas.length, 0) };
}

function gerClEdital() {
  return (typeof editais !== "undefined" ? editais : []).find((e) => e.id === $("gerClEdital").value) || null;
}

function gerPintarClassificar() {
  const ed = gerClEdital();
  const cx = $("gerClLista");
  cx.innerHTML = "";
  if (!ed) { $("gerClResumo").textContent = t("ger_cl_sem_edital"); $("btnGerClMover").disabled = true; return null; }
  const c = gerClassificar(gerBancadaNotas(), ed, $("gerClGerais").checked);
  $("gerClResumo").textContent = t("ger_cl_resumo", { t: c.total, c: c.classificados, g: c.grupos.length, d: c.soDisciplina.length, s: c.semPista.length });
  c.grupos.forEach((g) => {
    cx.append(gerEl("div", "ger-cl-item", g.disciplina + " › " + g.topico + " — " + g.notas.length));
  });
  $("btnGerClMover").disabled = !c.classificados;
  return c;
}

function gerAbrirClassificar() {
  const lista = (typeof editais !== "undefined" ? editais : []);
  if (!lista.length) { gerAviso(t("ger_cl_sem_edital"), false); return; }
  if (!gerBancadaNotas().length) { gerAviso(t("ger_cl_sem_cartoes"), false); return; }
  const sel = $("gerClEdital");
  sel.innerHTML = "";
  lista.forEach((e) => {
    const o = document.createElement("option");
    o.value = e.id; o.textContent = e.nome;
    sel.append(o);
  });
  const ctx = gerEditalDoContexto();
  const dono = lista.find((e) => e.nome === ctx) || lista.find((e) => e.id === (typeof editalAtual !== "undefined" ? editalAtual : null)) || lista[0];
  sel.value = dono.id;
  $("gerClGerais").checked = false;
  gerPintarClassificar();
  abrirModal("dlgGerClassificar");
}

function gerConfirmarClassificar() {
  const ed = gerClEdital();
  if (!ed) return null;
  const c = gerClassificar(gerBancadaNotas(), ed, $("gerClGerais").checked);
  if (!c.classificados) { $("gerClResumo").textContent = t("ger_cl_nada"); return null; }
  $("dlgGerClassificar").close();
  const r = gerMoverGrupos(c.grupos, ed.nome);
  gerCalcular(); gerPintar(); gerPintarDestinos();
  try { matRender(); } catch (e) {}
  gerAviso(t("ger_cl_feito", { n: r.movidos, k: r.topicos, r: r.repetidos, s: c.semPista.length + c.soDisciplina.length }), true);
  return r;
}

/* "Exportar esta pasta": abre o montador de pacote já com a pasta (edital, disciplina ou tópico) marcada */
function gerChavesDaPasta() {
  if (!gerPasta) return { chaves: [], edital: "" };
  if (gerPasta.chaves) {
    const r = gerModeloEditais(gerNotas, gerPastasVazias(gerNotas)).roots.find((x) => gerPasta.id === x.id || String(gerPasta.id).indexOf(x.id + "|") === 0);
    return { chaves: [...gerPasta.chaves], edital: r && r.tipo === "edital" ? r.concurso : "" };
  }
  if (gerPasta.chave) return { chaves: [gerPasta.chave], edital: gerEditalDoContexto() };
  if (gerPasta.disciplina) return { chaves: [...new Set(gerNotas.filter((n) => (n.disciplina || "—") === gerPasta.disciplina).map((n) => n.chave))], edital: "" };
  return { chaves: [], edital: "" };
}

function gerExportarPasta() {
  const p = gerChavesDaPasta();
  if (!p.chaves.length) { gerAviso(t("ger_exp_nada"), false); return null; }
  $("dlgGerCartoes").close();
  pacAbrir(p);
  return p;
}

/* o tópico do PLANO de um edital que está aberto na lista (é dele que os ramos são lidos e escritos) */
function gerContextoRamos() {
  if (!gerPasta || !gerPasta.chave) return null;
  const pref = gerEditalDoContexto();
  let achado = null;
  gerModeloEditais(gerNotas, gerPastasVazias(gerNotas)).roots.forEach((r) => {
    if (r.tipo !== "edital") return;
    r.filhos.forEach((d) => (d.filhos || []).forEach((tp) => {
      if (tp.chave === gerPasta.chave && tp.plano && (!achado || r.concurso === pref)) achado = Object.assign({ chave: tp.chave, concurso: r.concurso }, tp.plano);
    }));
  });
  return achado;
}

function gerAbrirRamos() {
  const ctx = gerContextoRamos();
  if (!ctx) return false;
  ctx.depois = (r) => {
    gerCalcular(); gerAbertos.add("rm|" + ctx.chave + "|" + ctx.concurso); gerAbrirCaminhoDe(ctx.chave); gerPintar();
    try { matRender(); } catch (e) {}
    gerAviso(t("ram_salvo", { n: r.ramos.length, c: r.retag }), true);
  };
  return ramAbrirEditor(ctx);
}

/* marca TODOS os cartões da lista de agora (não só os 60 à vista): é o "mover todos desta pasta" */
function gerMarcarTodos() {
  gerSel = new Set(gerVis.map((_, i) => i));
  gerPintarLista(); gerPintarAcoes();
}

function gerAgruparPadrao() {
  let v = "";
  try { v = localStorage.getItem(GER_CHAVE_AGRUPAR) || ""; } catch (e) {}
  if (v === "edital" || v === "disciplina") return v;
  return (typeof editais !== "undefined" && Array.isArray(editais) && editais.length) ? "edital" : "disciplina";
}

/* abre as raízes (edital, sem edital, bancada) e deixa as disciplinas fechadas: um edital tem dezenas de tópicos */
function gerAbrirRaizes() {
  gerAbertos = new Set(gerModeloEditais(gerNotas, gerPastasVazias(gerNotas)).roots.map((r) => r.id));
}

function gerTrocarAgrupar(v) {
  gerAgrupar = v === "edital" ? "edital" : "disciplina";
  try { localStorage.setItem(GER_CHAVE_AGRUPAR, gerAgrupar); } catch (e) {}
  $("gerAgrupar").value = gerAgrupar;
  gerPasta = null; gerFechados = new Set(); gerDestinoConcurso = undefined;
  gerCalcular(); gerAbrirRaizes(); gerPintarDestinos(); gerPintar();
}

function gerAbrir() {
  gerPasta = null; gerFechados = new Set(); gerDestinoConcurso = undefined;
  gerAgrupar = gerAgruparPadrao();
  $("gerAgrupar").value = gerAgrupar;
  try { gerOcultarVazias = localStorage.getItem(GER_CHAVE_VAZIAS) === "1"; } catch (e) { gerOcultarVazias = false; }
  $("gerOcultarVazias").checked = gerOcultarVazias;
  $("gerBusca").value = ""; $("gerFiltro").value = "todos"; gerAviso("", false);
  gerFecharDestinos();
  gerVistaPasta = "null";
  gerVista("pastas");
  gerCalcular(); gerAbrirRaizes(); gerPintarDestinos(); gerPintar();
  gerAplicarTamanho(gerGrandeLer());
  dicasDosBotoes(GER_DICAS);
  abrirModal("dlgGerCartoes");
  try { matReg("cartoes", "gerenciador aberto", gerNotas.length + " cartões"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnGerCartoes")) {
  $("btnGerCartoes").onclick = gerAbrir;
  if ($("btnBancaGer")) $("btnBancaGer").onclick = gerAbrir;
  dicasDosBotoes({ btnGerCartoes: "ger_btn_aj", btnBancaGer: "ger_btn_aj" });
  $("btnGerFechar").onclick = () => $("dlgGerCartoes").close();
  $("btnGerX").onclick = () => $("dlgGerCartoes").close();
  $("btnGerAbaPastas").onclick = () => gerVista("pastas");
  $("btnGerAbaCartoes").onclick = () => gerVista("cartoes");
  $("btnGerAbaPrevia").onclick = () => gerVista("previa");
  $("gerBusca").oninput = () => { gerRefiltrar(); gerPintar(); };
  $("gerFiltro").onchange = () => { gerRefiltrar(); gerPintar(); };
  $("btnGerMais").onclick = () => { gerMostrando += GER_LIM.visiveis; gerPintarLista(); flashBotao($("btnGerMais")); };
  $("btnGerMarcar").onclick = () => { gerSel = new Set(gerVis.slice(0, gerMostrando).map((_, i) => i)); gerPintarLista(); gerPintarAcoes(); flashBotao($("btnGerMarcar")); };
  $("btnGerLimpar").onclick = () => { gerSel = new Set(); gerPintarLista(); gerPintarAcoes(); flashBotao($("btnGerLimpar")); };
  $("btnGerMarcarTodos").onclick = () => { gerMarcarTodos(); flashBotao($("btnGerMarcarTodos")); };
  $("btnGerNovaPasta").onclick = gerAbrirNovaPasta;
  $("gerNpEdital").onchange = gerPreencherDiscsNp;
  $("btnGerClassificar").onclick = gerAbrirClassificar;
  $("btnGerExportar").onclick = gerExportarPasta;
  $("btnGerRamos").onclick = gerAbrirRamos;
  $("gerClEdital").onchange = gerPintarClassificar;
  $("gerClGerais").onchange = gerPintarClassificar;
  $("btnGerClMover").onclick = gerConfirmarClassificar;
  $("btnGerClFechar").onclick = () => $("dlgGerClassificar").close();
  $("gerAgrupar").onchange = () => gerTrocarAgrupar($("gerAgrupar").value);
  $("gerOcultarVazias").onchange = () => {
    gerOcultarVazias = !!$("gerOcultarVazias").checked;
    try { localStorage.setItem(GER_CHAVE_VAZIAS, gerOcultarVazias ? "1" : "0"); } catch (e) {}
    gerPintarArvore();
  };
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
    else if (ev.key === "Enter") { ev.preventDefault && ev.preventDefault(); const it = gerPintarDestinosLista(); if (it.length) gerEscolherDestino(it[0].ch, it[0].concurso); }
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
