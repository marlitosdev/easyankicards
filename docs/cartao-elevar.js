/* ===================================================================
 * ELEVAR CARTÕES ANTIGOS AO PADRÃO
 *
 * Medido num baralho real: verso com menos de 100 caracteres em 759 de
 * 843 cartões, só 16% citando artigo, cloze sem dica e "pergunta+resposta"
 * na mesma frase. Os bons baralhos de referência têm resposta com o
 * fundamento, artigo, literalidade em "saiba mais" e lacuna com dica.
 *
 * Aqui: (1) cada cartão recebe uma NOTA pelo que lhe falta; (2) a pessoa
 * marca os piores e o app monta UM prompt em lote (âncoras "@@ N", as
 * mesmas da correção parcial); (3) a resposta da IA é conferida ANTES de
 * mexer em qualquer coisa — cartão que voltou mais curto, ou que perdeu
 * conteúdo, é apontado — e cada troca é aceita ou recusada por cartão,
 * vendo o antes e o depois; (4) dá para desfazer a última rodada.
 *
 * Reaproveita: conferirCorrecaoParcial / coberturaConteudo (parser.js),
 * cqLerBiblioteca (cartao-qualidade.js) e pcPadrao (prompts-cartao.js).
 * =================================================================== */
const CE_LIM = {
  versoCurto: 100,     // resposta abaixo disto não ensina: é só o dado solto
  padrao: 70,          // nota abaixo disto = abaixo do padrão
  lote: 15,            // cartões por prompt (o prompt precisa caber na IA)
  visiveis: 40,
  fonteMax: 3000,      // do resumo de cada tópico
  fonteTotal: 9000,
  encolheu: 0.9,       // devolvido com menos de 90% do tamanho = encolheu
};

const CE_PESOS = {
  verso_curto: 30, sem_artigo: 20, sem_mais: 20, cloze_sem_dica: 10,
  lacunas_demais: 10, fonte_no_texto: 10, cloze_pergunta: 10,
};

const CE_ART_RE = /\bart(?:igo|s)?\.?\s*\d|§\s*\d|\binciso\b|\bcaput\b/i;

/* O que falta a este cartão (lista de ids, a mesma dos textos ce_def_*). */
function ceDefeitos(c) {
  const f = String((c && c.front) || ""), b = String((c && c.back) || ""), m = String((c && c.more) || "");
  const ehCloze = (c && c.kind === "cloze") || /\{\{c\d+::/.test(f);
  const d = [];
  if (!ehCloze && b.trim().length < CE_LIM.versoCurto) d.push("verso_curto");
  if (!CE_ART_RE.test(f + " " + b + " " + m)) d.push("sem_artigo");
  if (!m.trim()) d.push("sem_mais");
  if (ehCloze) {
    const lac = f.match(/\{\{c\d+::[^}]*\}\}/g) || [];
    if (lac.length && !lac.some((x) => /\{\{c\d+::[^}:]*::[^}]+\}\}/.test(x))) d.push("cloze_sem_dica");
    if (lac.length > 2) d.push("lacunas_demais");
    if (/\?/.test(f.replace(/\{\{[^}]*\}\}/g, ""))) d.push("cloze_pergunta");
  }
  if (/\(\s*fonte\s*:/i.test(f + " " + b)) d.push("fonte_no_texto");
  return d;
}

function ceNota(c) {
  return Math.max(0, 100 - ceDefeitos(c).reduce((s, x) => s + (CE_PESOS[x] || 0), 0));
}

function ceAbaixo(c) { return ceNota(c) < CE_LIM.padrao; }

/* Etiquetas usadas uma vez só na biblioteca: quase sempre ruído do gerador
 * (num baralho real eram 139 etiquetas para 955 cartões). */
function ceTagsUnicas(notas) {
  const cont = new Map();
  (notas || []).forEach((n) => ((n.card && n.card.ownTags) || []).forEach((tg) => {
    const k = String(tg).toLowerCase();
    cont.set(k, (cont.get(k) || 0) + 1);
  }));
  return [...cont.entries()].filter((e) => e[1] === 1).map((e) => e[0]).sort();
}

/* Cartões abaixo do padrão, os piores primeiro. */
function ceLerAbaixo() {
  return cqLerBiblioteca().map((n) => Object.assign({ nota: ceNota(n.card), defeitos: ceDefeitos(n.card) }, n))
    .filter((n) => n.nota < CE_LIM.padrao)
    .sort((a, b) => a.nota - b.nota || String(a.topico).localeCompare(String(b.topico)));
}

/* O resumo de cada tópico do lote vira FONTE: sem ela a IA só teria o próprio
 * cartão, e "citar o artigo" vira invenção. */
function ceFontes(itens) {
  const vistos = new Set(), partes = [];
  let total = 0;
  (itens || []).forEach((n) => {
    if (vistos.has(n.chave)) return;
    vistos.add(n.chave);
    const r = (typeof matResumos === "object" && matResumos[n.chave]) || {};
    const txt = String(r.texto || "").trim();
    if (!txt || total >= CE_LIM.fonteTotal) return;
    const corte = txt.slice(0, Math.min(CE_LIM.fonteMax, CE_LIM.fonteTotal - total));
    total += corte.length;
    partes.push("### " + [n.disciplina, n.topico].filter(Boolean).join(" · ") + "\n" + corte);
  });
  return partes.join("\n\n");
}

function ceMontarPrompt(itens) {
  const blocos = itens.map((n, i) => ({ id: i + 1, texto: cardToLine(n.card), cartoesOriginais: 1 }));
  const trechos = blocos.map((b) => "@@ " + b.id + "\n" + b.texto).join("\n\n");
  const fontes = ceFontes(itens);
  return {
    blocos,
    texto: t("ce_prompt", { n: itens.length, trechos, fontes: fontes || t("ce_sem_fonte") }),
  };
}

/* Troca o cartão (com o "@" de cima e os "+" de baixo) pelo texto novo. */
function ceSubstituir(bruto, c, novo) {
  const linhas = String(bruto || "").split("\n");
  const raw = String((c && c.raw) || "").trim();
  let k = c && c.line ? c.line - 1 : -1;
  if (k < 0 || String(linhas[k] || "").trim() !== raw) k = linhas.findIndex((l) => l.trim() === raw);
  if (k < 0) return null;
  let de = k, ate = k;
  while (ate + 1 < linhas.length && /^\s*[+*]\s/.test(linhas[ate + 1])) ate++;
  if (de > 0 && /^\s*@\s/.test(linhas[de - 1])) de--;
  linhas.splice(de, ate - de + 1, ...String(novo).replace(/\s+$/, "").split(/\r?\n/));
  return linhas.join("\n");
}

function ceSemFonte(s) { return String(s || "").replace(/\(\s*fonte\s*:[^)]*\)/gi, ""); }

/* Confere a resposta da IA ANTES de tocar em qualquer coisa.
 * Devolve { erros, avisos, itens } — cada item já com o que mudou. */
function ceConferir(resposta, itens, blocos) {
  const r = conferirCorrecaoParcial(resposta, blocos);
  const saida = [];
  r.aplicar.forEach((a) => {
    const n = itens[a.id - 1];
    if (!n) return;
    const av = [];
    if (String(a.novo).length < String(a.texto).length * CE_LIM.encolheu) av.push({ id: "encolheu", n: a.id });
    /* tirar "(Fonte: ...)" do texto é justamente o pedido: não conta como perda */
    const cob = coberturaConteudo(ceSemFonte(a.texto), a.novo);
    if (cob.pct < COBERTURA_MIN) av.push({ id: "perdeu", n: a.id, p: cob.pct, termos: cob.faltando.slice(0, 6).join(", ") });
    let novos = [];
    try { novos = parseText(a.novo, []).cards; } catch (e) {}
    if (novos.length && novos.every(ceAbaixo)) av.push({ id: "continua", n: a.id });
    saida.push({ nota: n, id: a.id, antes: a.texto, depois: a.novo, cartoes: a.cartoes,
                 cobertura: cob.pct, notaDepois: novos.length ? Math.min(...novos.map(ceNota)) : 0, avisos: av });
  });
  /* o aviso de "perdeu conteúdo" já sai por cartão, com a caixa de aceitar */
  const perdeu = new Set(r.aplicar.filter((a) => a.cobertura < COBERTURA_MIN)
    .map((a) => t("fixpart_perdeu", { n: a.id, p: a.cobertura, termos: a.faltando.slice(0, 6).join(", ") })));
  return { erros: r.erros, avisos: r.avisos.filter((x) => !perdeu.has(x)), itens: saida };
}

/* ---- desfazer a última rodada ---- */
const CE_CHAVE_RECIBO = "eac_ce_recibo";

function ceAplicarLote(aceitos) {
  const antes = {}, tocados = new Set();
  let trocados = 0, naoAchou = 0;
  aceitos.forEach((it) => {
    const ch = it.nota.chave;
    const bruto = String((matResumos[ch] || {}).cartoes || "");
    if (!(ch in antes)) antes[ch] = bruto;
    const novo = ceSubstituir(bruto, it.nota.card, it.depois);
    if (novo === null) { naoAchou++; return; }
    matGravarCartoes(ch, novo, { disciplina: it.nota.disciplina, topico: it.nota.topico });
    tocados.add(ch); trocados++;
  });
  const itens = [...tocados].map((ch) => ({ chave: ch, antes: antes[ch], depois: String(matResumos[ch].cartoes || ""),
    disciplina: matResumos[ch].disciplina, topico: matResumos[ch].topico }));
  if (itens.length) {
    try { localStorage.setItem(CE_CHAVE_RECIBO, JSON.stringify({ quando: new Date().toISOString(), itens })); } catch (e) {}
  }
  try { matReg("cartoes", "cartões elevados ao padrão", trocados + " trocado(s), " + naoAchou + " não achado(s)"); } catch (e) {}
  return { trocados, naoAchou };
}

function ceRecibo() {
  try { return JSON.parse(localStorage.getItem(CE_CHAVE_RECIBO) || "null"); } catch (e) { return null; }
}

/* Só desfaz o tópico que continua exatamente como a rodada o deixou: se a
 * pessoa mexeu depois, desfazer apagaria o trabalho dela. */
function ceDesfazerLote() {
  const rec = ceRecibo();
  if (!rec || !rec.itens) return { desfeitos: 0, pulados: 0 };
  let desfeitos = 0, pulados = 0;
  rec.itens.forEach((it) => {
    if (String((matResumos[it.chave] || {}).cartoes || "") !== it.depois) { pulados++; return; }
    matGravarCartoes(it.chave, it.antes, { disciplina: it.disciplina, topico: it.topico });
    desfeitos++;
  });
  if (!pulados) { try { localStorage.removeItem(CE_CHAVE_RECIBO); } catch (e) {} }
  try { matReg("cartoes", "rodada de melhoria desfeita", desfeitos + " tópico(s), " + pulados + " pulado(s)"); } catch (e) {}
  return { desfeitos, pulados };
}

/* ---- a tela ---- */
let ceNotas = [], ceSel = new Set(), ceMostrando = CE_LIM.visiveis, ceConf = null, cePedido = null;

function ceEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function ceCalcular() {
  ceNotas = ceLerAbaixo();
  ceSel = new Set([...ceSel].filter((i) => i < ceNotas.length));
  return ceNotas;
}

function ceContarSel() {
  $("ceSel").textContent = t("ce_sel", { n: ceSel.size, max: CE_LIM.lote });
  $("btnCePrompt").disabled = !ceSel.size;
}

function cePintar() {
  const total = cqLerBiblioteca().length;
  $("ceResumo").textContent = total
    ? t("ce_resumo", { a: ceNotas.length, n: total, p: Math.round(100 * ceNotas.length / total),
                       tg: ceTagsUnicas(cqLerBiblioteca()).length })
    : t("cq_sem_cartoes");
  const cx = $("ceLista");
  cx.innerHTML = "";
  if (total && !ceNotas.length) cx.append(ceEl("p", "nota", t("ce_nenhum")));
  ceNotas.slice(0, ceMostrando).forEach((n, i) => {
    const lin = ceEl("label", "ce-item");
    const ck = ceEl("input"); ck.type = "checkbox"; ck.checked = ceSel.has(i);
    ck.onchange = () => {
      if (ck.checked) {
        if (ceSel.size >= CE_LIM.lote) { ck.checked = false; $("ceMsg").textContent = t("ce_lote_cheio", { max: CE_LIM.lote }); return; }
        ceSel.add(i);
      } else ceSel.delete(i);
      ceContarSel();
    };
    const corpo = ceEl("span", "ce-corpo");
    corpo.append(ceEl("span", "ce-nota", String(n.nota)));
    corpo.append(ceEl("span", "ce-f", " " + cqTrecho(cqRevelado(n.card), 130)));
    corpo.append(ceEl("span", "ce-def", n.defeitos.map((d) => t("ce_def_" + d)).join(" · ")));
    corpo.append(ceEl("span", "cq-onde", [n.disciplina, n.topico].filter(Boolean).join(" · ")));
    lin.append(ck, corpo);
    cx.append(lin);
  });
  $("btnCeMais").hidden = ceNotas.length <= ceMostrando;
  const rec = ceRecibo();
  $("btnCeDesfazer").hidden = !(rec && rec.itens && rec.itens.length);
  ceContarSel();
}

function ceMarcarPiores() {
  ceSel = new Set();
  for (let i = 0; i < Math.min(CE_LIM.lote, ceNotas.length); i++) ceSel.add(i);
  ceMostrando = Math.max(ceMostrando, CE_LIM.lote);
  cePintar();
}

function ceGerarPrompt() {
  const itens = [...ceSel].sort((a, b) => a - b).map((i) => ceNotas[i]);
  if (!itens.length) return;
  cePedido = { itens, ...ceMontarPrompt(itens) };
  $("cePrompt").value = cePedido.texto;
  $("cePromptCx").hidden = false;
  $("ceColarCx").hidden = false;
  $("ceComparar").hidden = true;
  $("btnCeAplicar").hidden = true;
  ceConf = null;
  try { matReg("cartoes", "prompt em lote para elevar ao padrão", itens.length + " cartões"); } catch (e) {}
}

function ceConferirColagem() {
  if (!cePedido) return;
  const resposta = $("ceColar").value;
  if (!resposta.trim()) { uiAlert(t("ce_colar_vazio")); return; }
  ceConf = ceConferir(resposta, cePedido.itens, cePedido.blocos);
  cePintarComparacao();
}

function cePintarComparacao() {
  const cx = $("ceComparar");
  cx.innerHTML = ""; cx.hidden = false;
  const c = ceConf;
  c.erros.forEach((e) => cx.append(ceEl("div", "ce-erro", e)));
  c.avisos.forEach((e) => cx.append(ceEl("div", "ce-aviso", e)));
  c.itens.forEach((it) => {
    const box = ceEl("div", "ce-cmp");
    const ck = ceEl("input"); ck.type = "checkbox";
    it.aceitar = !it.avisos.some((a) => a.id === "encolheu" || a.id === "perdeu");
    ck.checked = it.aceitar;
    ck.onchange = () => { it.aceitar = ck.checked; $("btnCeAplicar").textContent = t("ce_aplicar", { n: c.itens.filter((x) => x.aceitar).length }); };
    const cab = ceEl("label", "cq-grupo-tit");
    cab.append(ck, ceEl("span", "", " " + t("ce_cmp_tit", { a: it.antes.length, d: it.depois.length, na: it.nota.nota, nd: it.notaDepois })));
    box.append(cab);
    it.avisos.forEach((a) => box.append(ceEl("div", "ce-aviso", t("ce_av_" + a.id, a))));
    const par = ceEl("div", "ce-par");
    const a1 = ceEl("div", "ce-lado"); a1.append(ceEl("b", "", t("ce_antes")), ceEl("pre", "", it.antes));
    const a2 = ceEl("div", "ce-lado"); a2.append(ceEl("b", "", t("ce_depois")), ceEl("pre", "", it.depois));
    par.append(a1, a2);
    box.append(par);
    cx.append(box);
  });
  const n = c.itens.filter((x) => x.aceitar).length;
  $("btnCeAplicar").hidden = !c.itens.length;
  $("btnCeAplicar").textContent = t("ce_aplicar", { n });
}

async function ceAplicar() {
  if (!ceConf) return;
  const aceitos = ceConf.itens.filter((x) => x.aceitar);
  if (!aceitos.length) { uiAlert(t("ce_nenhum_aceito")); return; }
  if (!(await uiConfirm(t("ce_conf_aplicar", { n: aceitos.length })))) return;
  const r = ceAplicarLote(aceitos);
  ceConf = null; cePedido = null; ceSel = new Set();
  $("ceComparar").hidden = true; $("btnCeAplicar").hidden = true;
  $("cePromptCx").hidden = true; $("ceColarCx").hidden = true; $("ceColar").value = "";
  ceCalcular(); cePintar();
  try { matRender(); } catch (e) {}
  $("ceMsg").textContent = t("ce_feito", { n: r.trocados, m: r.naoAchou });
}

async function ceDesfazer() {
  if (!(await uiConfirm(t("ce_conf_desfazer")))) return;
  const r = ceDesfazerLote();
  ceCalcular(); cePintar();
  try { matRender(); } catch (e) {}
  $("ceMsg").textContent = t("ce_desfeito", { n: r.desfeitos, m: r.pulados });
}

function ceAbrir() {
  ceMostrando = CE_LIM.visiveis; ceSel = new Set(); ceConf = null; cePedido = null;
  ceCalcular();
  $("ceMsg").textContent = "";
  $("cePromptCx").hidden = true; $("ceColarCx").hidden = true;
  $("ceComparar").hidden = true; $("btnCeAplicar").hidden = true;
  cePintar();
  abrirModal("dlgCartElevar");
  try { matReg("cartoes", "elevar ao padrão aberto", ceNotas.length + " abaixo do padrão"); } catch (e) {}
}

if (typeof document !== "undefined" && $("btnCartElevar")) {
  $("btnCartElevar").onclick = ceAbrir;
  if ($("btnCeFechar")) $("btnCeFechar").onclick = () => $("dlgCartElevar").close();
  if ($("btnCeMais")) $("btnCeMais").onclick = () => { ceMostrando += CE_LIM.visiveis; cePintar(); };
  if ($("btnCeMarcar")) $("btnCeMarcar").onclick = ceMarcarPiores;
  if ($("btnCeLimpar")) $("btnCeLimpar").onclick = () => { ceSel = new Set(); cePintar(); };
  if ($("btnCePrompt")) $("btnCePrompt").onclick = ceGerarPrompt;
  if ($("btnCeConferir")) $("btnCeConferir").onclick = ceConferirColagem;
  if ($("btnCeAplicar")) $("btnCeAplicar").onclick = ceAplicar;
  if ($("btnCeDesfazer")) $("btnCeDesfazer").onclick = ceDesfazer;
  if ($("btnCeCopiar")) $("btnCeCopiar").onclick = async () => {
    try { await navigator.clipboard.writeText($("cePrompt").value); $("ceMsg").textContent = t("ce_copiado"); }
    catch (e) { $("cePrompt").select(); $("ceMsg").textContent = t("ce_copiar_manual"); }
  };
}
