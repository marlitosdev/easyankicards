/* =====================================================================
 * (19.89.0) CARTÕES DE UMA LEI — a partir da biblioteca de leis, pela bancada
 *
 * O que já existia: "virar cartões" em CADA artigo (lei-ui.js, leiClozeAbrir), o "🃏 N" no artigo que tem cartão, o filtro
 * "sem cartão" do mapa e o ranking dos artigos que caem nas questões (leiRanking). O que faltava: um caminho que comece
 * na LEI inteira e diga por onde começar. Com o backup: o CTN tinha 69 artigos citados nas questões e 36 deles sem
 * cartão; a CF, 36 e 20; a Lei 4.320, 16 e 10 — e ninguém ia abrir artigo por artigo.
 *
 * A ESTRATÉGIA (a mesma para toda lei já guardada):
 *  1. QUAL LEI: a ligada a tópico do edital com prova mais perto e mais peso, e com mais artigos que caem sem cartão;
 *  2. QUAIS ARTIGOS, nesta ordem: os que as SUAS questões citam (os que você erra primeiro) e os marcados "caiu na prova";
 *     os que o PRÓPRIO EDITAL cita no tópico ou nos subtópicos ("Art. 150, I e § 1º, CF"); os dos capítulos cujo título
 *     bate com o assunto do tópico. Revogados e os que já têm cartão ficam fora. Nada indica? a ordem da lei;
 *  3. EM LOTES de até 8 artigos (ou ~6.000 caracteres) por pedido: o que a IA faz bem e o que se confere de uma vez;
 *  4. NA BANCADA DE SEMPRE: o pedido sai pelo tópico-alvo (banca-alvo.js), a resposta é colada na caixa, conferida na
 *     prévia e salva com "Salvar neste tópico"; depois, "próximo lote". As regras do pedido são as do "virar cartões"
 *     (lacuna no que a banca troca, texto literal, a etiqueta do artigo em cada cartão).
 * O edital entra na EXTRAÇÃO: o tópico decide para onde vão os cartões e quais artigos vêm marcados, e o pedido diz à IA
 * o assunto e os subtópicos (para escolher o que esconder), sem deixar a IA pular artigo por conta própria.
 * ===================================================================== */
const CL = { lote: 8, loteChars: 6000, preMax: 40 };
const CL_FRACAS = new Set(["direito", "direitos", "lei", "leis", "federal", "complementar", "codigo", "decreto", "nocoes", "geral",
  "gerais", "sobre", "artigo", "artigos", "disposicoes", "normas", "regras", "titulo", "capitulo", "secao", "conceito",
  "conceitos", "aspectos", "principais", "acordo", "termos", "relativas", "relativos", "segundo", "pelos", "pelas", "entre"]);
function clNorm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }

/* os tópicos do edital ligados à lei (com o edital, os dias e o peso); a mesma chave em dois editais fica uma vez */
function clTopicosDaLei(l) {
  const chs = ((l && l.topicos) || []).map((c) => leisChaveComparavel(c));
  const porChave = {};
  ((typeof editais !== "undefined" && editais) || []).forEach((E) => {
    let r = null, sit = null;
    try { r = lerEdital(E.texto || ""); } catch (e) { return; }
    try { sit = typeof edSituacao === "function" ? edSituacao(E) : null; } catch (e) { sit = null; }
    (r.disciplinas || []).forEach((d) => (d.topicos || []).forEach((tp) => {
      const ch = leisChaveComparavel(matChave(d.nome, tp.nome));
      if (chs.indexOf(ch) < 0) return;
      const x = { disciplina: d.nome, topico: tp.nome, chave: matChaveViva(d.nome, tp.nome), edital: E.id, editalNome: E.nome || (r.cfg || {}).concurso || "",
        dias: sit && sit.dias != null ? sit.dias : null, encerrado: !!(sit && sit.grupo === "encerrado"), peso: Number(tp.peso) || 0,
        foco: [tp.nome, tp.motivo || ""].concat((tp.ramos || []).map((m) => (m.nome || "") + " " + (m.nota || ""))).join("\n"),
        ramos: (tp.ramos || []).map((m) => m.nome).filter(Boolean) };
      const ant = porChave[ch];
      const melhor = (a) => (a.encerrado ? 1e6 : 0) + (a.dias == null || a.dias < 0 ? 1e5 : a.dias);
      if (!ant || melhor(x) < melhor(ant)) porChave[ch] = x;
    }));
  });
  return Object.keys(porChave).map((k) => porChave[k])
    .sort((a, b) => (a.encerrado - b.encerrado) || ((a.dias == null ? 1e5 : a.dias) - (b.dias == null ? 1e5 : b.dias)) || (b.peso - a.peso));
}

/* os artigos que o texto do tópico cita (nome, motivo, subtópicos e as notas deles) e que são DESTA lei */
function clArtigosCitados(texto, l) {
  const out = new Set();
  let cits = [];
  try { cits = leiCitacoesNoTexto(texto) || []; } catch (e) { cits = []; }
  const lista = typeof leisLista === "function" ? leisLista() : [];
  cits.forEach((c) => {
    let res = null;
    try { res = c.leiId ? { lei: { id: c.leiId } } : leiResolverCitacao(c, lista, [l]); } catch (e) { res = null; }
    if (!res || !res.lei || res.lei.id !== l.id) return;
    const nums = c.artigos && c.artigos.length ? c.artigos.map((a) => a.num) : [c.num];
    nums.forEach((n) => { if (n != null && n !== "") out.add(typeof leiNumNormal === "function" ? leiNumNormal(n) : String(n)); });
  });
  return out;
}
/* as palavras do assunto que distinguem (as que estão no nome da lei não distinguem nada dentro dela) */
function clPalavrasDoTopico(tp, l) {
  if (!tp) return [];
  const daLei = new Set(clNorm(l && l.nome).split(" "));
  const ws = clNorm([tp.topico].concat(tp.ramos || []).join(" ")).split(" ")
    .filter((w) => w.length >= 5 && !CL_FRACAS.has(w) && !daLei.has(w) && !/^\d+$/.test(w));
  return Array.from(new Set(ws));
}

/* A CHAVE DE CADA ARTIGO: o número; "#2", "#3"… quando ele se repete no mesmo texto (a CF guardada com o ADCT recomeça
 * a numeração: dois "Art. 1º" não podem dividir a mesma caixinha nem o mesmo lugar no lote) */
function clComChave(arts) {
  const vistos = {};
  return arts.map((a) => { const n0 = String(a.num); vistos[n0] = (vistos[n0] || 0) + 1; return Object.assign({}, a, { chave: vistos[n0] > 1 ? n0 + "#" + vistos[n0] : n0 }); });
}
/* os artigos da lei com o que se sabe de cada um, para o tópico escolhido */
function clArtigos(l, tp) {
  const arts = clComChave(leiArtigosEfetivos(l));
  let mp = new Map();
  try { mp = leiCartoesPorArtigo(l); } catch (e) { mp = new Map(); }
  const rk = {};
  try { leiRanking(l.id).forEach((r) => { rk[r.num] = r; }); } catch (e) {}
  const citados = tp ? clArtigosCitados(tp.foco || "", l) : new Set();
  const palavras = clPalavrasDoTopico(tp, l);
  return arts.map((a, i) => {
    const r = rk[a.num] || {};
    const cam = clNorm([].concat(a.caminho || a.divisao || []).join(" "));
    const citado = citados.has(String(a.num)) || citados.has(typeof leiNumNormal === "function" ? leiNumNormal(a.num) : a.num);
    const tema = !!(palavras.length && cam && palavras.some((w) => cam.indexOf(w) >= 0));
    const questoes = r.questoes || 0, erros = r.erros || 0, prova = r.prova || 0;
    return { num: a.chave, numLei: a.num, rotulo: a.rotulo, ementa: a.ementa || "", divisao: a.divisao || "", texto: a.texto, ordem: i,
      rev: leiArtigoRevogado(a), nCart: (mp.get(a.num) || []).length, questoes, erros, prova, citado, tema,
      score: questoes * 3 + erros * 2 + prova * 4 + (citado ? 8 : 0) + (tema ? 3 : 0) };
  });
}
/* a marcação inicial: o que tem motivo, sem cartão, até 40; nada com motivo? os primeiros sem cartão, na ordem da lei */
function clPreSelecao(arts) {
  const cand = arts.filter((a) => !a.rev && !a.nCart);
  let sel = cand.filter((a) => a.score > 0).sort((a, b) => b.score - a.score || a.ordem - b.ordem);
  if (!sel.length) sel = cand;
  return new Set(sel.slice(0, CL.preMax).map((a) => a.num));
}
/* os lotes: os mais importantes primeiro; dentro do lote, na ordem da lei */
function clLotes(arts, sel) {
  const escolhidos = arts.filter((a) => sel.has(a.num)).sort((a, b) => b.score - a.score || a.ordem - b.ordem);
  const lotes = [];
  let cur = [], chars = 0;
  escolhidos.forEach((a) => {
    const tam = String(a.texto || "").length;
    if (cur.length && (cur.length >= CL.lote || chars + tam > CL.loteChars)) { lotes.push(cur); cur = []; chars = 0; }
    cur.push(a); chars += tam;
  });
  if (cur.length) lotes.push(cur);
  return lotes.map((lt) => lt.sort((a, b) => a.ordem - b.ordem).map((a) => a.num));
}

/* o pedido de um lote: as regras do "virar cartões", com o assunto do edital e a etiqueta de cada artigo */
function clPrompt(l, tp, nums) {
  const arts = clComChave(leiArtigosEfetivos(l));
  const blocos = nums.map((n) => arts.find((a) => a.chave === String(n))).filter(Boolean).map((a) => {
    const limpo = a.revogacao || a.revogado ? { texto: a.texto } : leiSemDispositivosRevogados(a.texto);
    return "### " + a.rotulo + " — etiqueta: " + leiEtiquetaDe(l, a) + "\n" + limpo.texto;
  });
  return t("cl_prompt", { lei: l.nome || "—", d: tp ? tp.disciplina : "—", tp: tp ? tp.topico : "—",
    ramos: tp && tp.ramos && tp.ramos.length ? tp.ramos.join("; ") : "—", n: blocos.length, artigos: blocos.join("\n\n") });
}

/* ---------------- o painel (dlgLeiCartoes) ---------------- */
let clEst = { passo: 1, leiId: "", topico: "", sel: null, arts: null, resumo: null };
function clResumoLei(l) {
  const arts = leiArtigosEfetivos(l);
  const vig = arts.filter((a) => !leiArtigoRevogado(a));
  const nums = new Set(vig.map((a) => a.num));
  let mp = new Map();
  try { mp = leiCartoesPorArtigo(l); } catch (e) { mp = new Map(); }
  let rk = [];
  try { rk = leiRanking(l.id); } catch (e) { rk = []; }
  /* números distintos: o mesmo número repetido no texto não conta dois cartões */
  const comCart = new Set(vig.filter((a) => mp.has(a.num)).map((a) => String(a.num))).size;
  const caem = rk.filter((r) => nums.has(r.num));
  const semCartCaem = caem.filter((r) => !mp.has(r.num)).length;
  const tops = clTopicosDaLei(l);
  const ativo = tops.find((x) => !x.encerrado && x.dias != null && x.dias >= 0) || null;
  const prioridade = semCartCaem * 3 + (ativo ? ativo.peso * 4 + Math.max(0, 120 - ativo.dias) / 6 : 0) + (tops.length ? 2 : 0) + (vig.length > comCart ? 1 : 0);
  return { id: l.id, nome: l.nome || "", vig: vig.length, comCart, caem: caem.length, semCartCaem, tops, ativo, prioridade };
}
function clAbrir(leiId) {
  clEst = { passo: leiId ? 2 : 1, leiId: leiId || "", topico: "", sel: null, arts: null, resumo: clEst.resumo };
  abrirModal("dlgLeiCartoes");
  clRender();
  if (!clEst.resumo) clCalcularResumos();
}
/* a conta de todas as leis leva ~2 s com 16 leis e 1.000 cartões: vai lei por lei, repintando, sem travar a tela */
function clCalcularResumos() {
  const leis = typeof leisLista === "function" ? leisLista() : [];
  const res = {};
  clEst.resumo = { pronto: false, porId: res };
  let i = 0;
  const um = () => {
    if (i >= leis.length) { clEst.resumo.pronto = true; clRender(); return; }
    try { res[leis[i].id] = clResumoLei(leis[i]); } catch (e) {}
    i++;
    if (clEst.passo === 1 && (i % 4 === 0)) clRender();
    setTimeout(um, 0);
  };
  um();
}
function clRender() {
  const cx = $("clCorpo");
  if (!cx) return;
  cx.innerHTML = "";
  if (clEst.passo === 2 && clEst.leiId) clPintarArtigos(cx); else clPintarLeis(cx);
}
function clEl(tag, cls, txt) { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; }

function clPintarLeis(cx) {
  const el = clEl;
  const leis = typeof leisLista === "function" ? leisLista() : [];
  cx.append(el("div", "cl-passo-tit", t("cl_p1_tit")));
  const est = el("details", "ds-info");
  est.append(el("summary", "", "ⓘ " + t("cl_estrategia_tit")));
  const ol = el("ol", "cl-estrategia");
  [1, 2, 3, 4].forEach((k) => ol.append(el("li", "", t("cl_estrategia_" + k))));
  est.append(ol);
  cx.append(est);
  if (!leis.length) { cx.append(el("p", "nota", t("cl_sem_leis"))); return; }
  const R = (clEst.resumo && clEst.resumo.porId) || {};
  const pronto = !!(clEst.resumo && clEst.resumo.pronto);
  if (!pronto) cx.append(el("p", "nota", t("cl_calculando", { n: Object.keys(R).length, t: leis.length })));
  const ordem = leis.slice().sort((a, b) => ((R[b.id] || {}).prioridade || 0) - ((R[a.id] || {}).prioridade || 0) || String(a.nome).localeCompare(String(b.nome)));
  const lista = el("div", "cl-leis");
  ordem.forEach((l, k) => {
    const r = R[l.id];
    const b = el("button", "cl-lei" + (pronto && k === 0 && r && r.prioridade > 0 ? " cl-lei-top" : ""));
    b.type = "button"; b.id = "clLei_" + l.id;
    const tit = el("span", "cl-lei-nome", l.nome || "?");
    if (pronto && k === 0 && r && r.prioridade > 0) tit.append(el("span", "cl-lei-selo", t("cl_comece")));
    b.append(tit);
    if (r) {
      const info = [];
      info.push(t("cl_info_cart", { c: r.comCart, v: r.vig }));
      if (r.semCartCaem) info.push(t("cl_info_caem", { n: r.semCartCaem }));
      info.push(r.ativo ? t("cl_info_top", { tp: r.ativo.topico, e: typeof edNomeCurtoConcurso === "function" ? edNomeCurtoConcurso(r.ativo.editalNome) : r.ativo.editalNome, d: r.ativo.dias })
        : r.tops.length ? t("cl_info_top_enc", { tp: r.tops[0].topico }) : t("cl_info_sem_top"));
      b.append(el("span", "cl-lei-info", info.join(" · ")));
      const pct = r.vig ? Math.round((r.comCart / r.vig) * 100) : 0;
      const barra = el("span", "cl-lei-barra"); const f = el("span", "cl-lei-fill"); f.style.width = pct + "%"; barra.append(f);
      b.append(barra);
    } else b.append(el("span", "cl-lei-info", "…"));
    b.onclick = () => { clEst.passo = 2; clEst.leiId = l.id; clEst.topico = ""; clEst.sel = null; clEst.arts = null; clRender(); };
    lista.append(b);
  });
  cx.append(lista);
}

/* todos os tópicos dos editais em andamento, para a lei que não está ligada a nenhum */
function clTodosTopicos() {
  const out = [];
  ((typeof editais !== "undefined" && editais) || []).forEach((E) => {
    let r = null, sit = null;
    try { r = lerEdital(E.texto || ""); sit = typeof edSituacao === "function" ? edSituacao(E) : null; } catch (e) { return; }
    if (sit && sit.grupo === "encerrado") return;
    (r.disciplinas || []).forEach((d) => (d.topicos || []).forEach((tp) => out.push({ disciplina: d.nome, topico: tp.nome,
      chave: matChaveViva(d.nome, tp.nome), edital: E.id, editalNome: E.nome || "", dias: sit && sit.dias != null ? sit.dias : null,
      encerrado: false, peso: Number(tp.peso) || 0, foco: [tp.nome, tp.motivo || ""].concat((tp.ramos || []).map((m) => (m.nome || "") + " " + (m.nota || ""))).join("\n"),
      ramos: (tp.ramos || []).map((m) => m.nome).filter(Boolean) })));
  });
  return out;
}

function clPintarArtigos(cx) {
  const el = clEl;
  const l = leiDe(clEst.leiId);
  if (!l) { clEst.passo = 1; clPintarLeis(cx); return; }
  const volta = el("button", "btn-min", "◀ " + t("cl_outras"));
  volta.type = "button"; volta.id = "btnClVoltar";
  volta.onclick = () => { clEst.passo = 1; clRender(); };
  cx.append(volta, el("div", "cl-passo-tit", t("cl_p2_tit", { l: l.nome || "?" })));
  /* o tópico do edital que recebe os cartões */
  const ligados = clTopicosDaLei(l);
  const opcoes = ligados.length ? ligados : clTodosTopicos();
  if (!clEst.topico && opcoes.length) clEst.topico = opcoes[0].chave;
  const tp = opcoes.find((x) => x.chave === clEst.topico) || null;
  const lt = el("label", "cl-campo");
  lt.append(el("span", "", t(ligados.length ? "cl_topico" : "cl_topico_escolha")));
  const s = document.createElement("select"); s.className = "ds-sel"; s.id = "clTopico";
  opcoes.forEach((x) => { const o = document.createElement("option"); o.value = x.chave; o.textContent = x.disciplina + " › " + x.topico + (x.editalNome ? " — " + x.editalNome : ""); s.append(o); });
  s.value = clEst.topico;
  s.onchange = () => { clEst.topico = s.value; clEst.sel = null; clEst.arts = null; clRender(); };
  lt.append(s);
  cx.append(lt);
  if (!ligados.length) cx.append(el("p", "nota", t("cl_sem_ligacao")));
  if (!tp) { cx.append(el("p", "nota", t("cl_sem_topico"))); return; }
  if (tp.ramos.length) cx.append(el("p", "nota cl-foco", t("cl_foco", { tp: tp.topico, r: tp.ramos.slice(0, 6).join("; ") + (tp.ramos.length > 6 ? "…" : "") })));
  /* os artigos */
  if (!clEst.arts) { clEst.arts = clArtigos(l, tp); clEst.sel = clPreSelecao(clEst.arts); }
  const arts = clEst.arts, sel = clEst.sel;
  const vig = arts.filter((a) => !a.rev);
  const nRev = arts.length - vig.length;
  /* atalhos de marcação */
  const fx = el("div", "cl-filtros");
  const atalho = (id, rot, fn) => { const b = el("button", "btn-min", rot); b.type = "button"; b.id = id; b.onclick = () => { clEst.sel = new Set(fn().map((a) => a.num)); clRender(); }; fx.append(b); };
  atalho("btnClSug", t("cl_m_sug"), () => vig.filter((a) => clPreSelecao(arts).has(a.num)));
  atalho("btnClCaem", t("cl_m_caem"), () => vig.filter((a) => (a.questoes || a.prova) && !a.nCart));
  atalho("btnClFoco", t("cl_m_foco"), () => vig.filter((a) => (a.citado || a.tema) && !a.nCart));
  atalho("btnClSemCart", t("cl_m_semcart"), () => vig.filter((a) => !a.nCart));
  atalho("btnClNenhum", t("cl_m_nenhum"), () => []);
  cx.append(fx);
  const lotes = clLotes(arts, sel);
  const resumo = el("p", "cl-resumo", t("cl_resumo", { n: sel.size, l: lotes.length, v: vig.length, c: vig.filter((a) => a.nCart).length }) + (nRev ? " " + t("cl_rev_fora", { n: nRev }) : ""));
  resumo.id = "clResumo";
  cx.append(resumo);
  /* a lista, por divisão da lei */
  const lista = el("div", "cl-arts");
  let div = null;
  vig.forEach((a) => {
    if (a.divisao !== div) { div = a.divisao; if (div) lista.append(el("div", "cl-div", div)); }
    const lb = el("label", "cl-art" + (a.nCart ? " cl-art-tem" : ""));
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "clArt_" + a.num; cb.checked = sel.has(a.num);
    cb.onchange = () => { if (cb.checked) sel.add(a.num); else sel.delete(a.num); const ls = clLotes(arts, sel); const r0 = $("clResumo"); if (r0) r0.textContent = t("cl_resumo", { n: sel.size, l: ls.length, v: vig.length, c: vig.filter((x) => x.nCart).length }); const b0 = $("btnClComecar"); if (b0) b0.disabled = !sel.size; };
    const tx = el("span", "cl-art-tx");
    tx.append(el("strong", "", a.rotulo), el("span", "cl-art-em", " " + a.ementa.slice(0, 110)));
    const sinais = [];
    if (a.questoes) sinais.push(t("cl_s_q", { n: a.questoes, e: a.erros }));
    if (a.prova) sinais.push(t("cl_s_prova"));
    if (a.citado) sinais.push(t("cl_s_citado"));
    else if (a.tema) sinais.push(t("cl_s_tema"));
    if (a.nCart) sinais.push(t("cl_s_tem", { n: a.nCart }));
    if (sinais.length) tx.append(el("span", "cl-art-sin", sinais.join(" · ")));
    lb.append(cb, tx);
    lista.append(lb);
  });
  cx.append(lista);
  const ir = el("button", "btn btn-azul", t("cl_comecar"));
  ir.type = "button"; ir.id = "btnClComecar"; ir.disabled = !sel.size;
  ir.onclick = () => clComecar(l, tp);
  const rod = el("div", "cl-rodape");
  rod.append(ir, el("span", "nota", t("cl_comecar_aj")));
  cx.append(rod);
}

/* começar: a bancada aponta para o tópico, com a lei e os lotes; o pedido do lote 1 já vai copiado */
function clComecar(l, tp) {
  const lotes = clLotes(clEst.arts || [], clEst.sel || new Set());
  if (!lotes.length || !tp) return false;
  if ($("dlgLeiCartoes") && $("dlgLeiCartoes").open) $("dlgLeiCartoes").close();
  bancAlvoDefinir(tp.disciplina, tp.topico);
  bancAlvo.lei = { id: l.id, nome: l.nome || "", lotes, k: 0, tp: { disciplina: tp.disciplina, topico: tp.topico, ramos: tp.ramos } };
  try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {}
  try { leiReg("cartoes", "cartões de uma lei: lotes montados", (l.nome || "") + " · " + lotes.length + " lote(s) · " + lotes.reduce((a, x) => a + x.length, 0) + " artigo(s)"); } catch (e) {}
  bancAlvoPintar();
  bancAlvoPrompt();
  return true;
}
/* o pedido do lote atual (banca-alvo.js chama quando o alvo tem lei) */
function clPromptDoAlvo(a) {
  const l = leiDe(a.lei.id);
  if (!l) return t("cl_lei_sumiu");
  const tp = Object.assign({ disciplina: a.disciplina, topico: a.topico, ramos: [] }, a.lei.tp || {});
  return clPrompt(l, tp, a.lei.lotes[a.lei.k] || []);
}
/* a faixa da lei dentro do tópico-alvo: o lote atual e como andar */
function clPintarNoAlvo() {
  const box = $("bancAlvoLei");
  if (!box) return;
  box.innerHTML = "";
  const L = bancAlvo && bancAlvo.lei;
  box.hidden = !L;
  if (!L) return;
  const l = leiDe(L.id) || {};
  const arts = clComChave(leiArtigosEfetivos(l));
  const rot = (L.lotes[L.k] || []).map((n) => { const a = arts.find((x) => x.chave === String(n)); return a ? a.rotulo : n; });
  box.append(clEl("div", "cl-alvo-tit", t("cl_alvo", { l: L.nome, k: L.k + 1, n: L.lotes.length })), clEl("div", "cl-alvo-arts", rot.join(", ")));
  const nav = clEl("div", "cl-alvo-nav");
  const ant = clEl("button", "btn-min", "◀ " + t("cl_lote_ant")); ant.type = "button"; ant.id = "btnClLoteAnt"; ant.disabled = L.k === 0;
  ant.onclick = () => clIrLote(L.k - 1);
  const prox = clEl("button", "btn-min", t("cl_lote_prox") + " ▶"); prox.type = "button"; prox.id = "btnClLoteProx"; prox.disabled = L.k >= L.lotes.length - 1;
  prox.onclick = () => clIrLote(L.k + 1);
  nav.append(ant, prox);
  box.append(nav);
}
/* trocar de lote limpa a bancada (com versão guardada: dá para recuperar) e copia o pedido do novo lote */
function clIrLote(k) {
  const L = bancAlvo && bancAlvo.lei;
  if (!L || k < 0 || k >= L.lotes.length) return false;
  const ed = $("editor");
  if (ed && ed.value.trim()) {
    try { if (typeof guardarVersao === "function") guardarVersao("antes do próximo lote da lei"); } catch (e) {}
    ed.value = "";
    try { textoAnterior = ""; } catch (e) {}
    try { if (typeof respostasFechadas !== "undefined") respostasFechadas.clear(); } catch (e) {}
    try { localStorage.removeItem("eac_texto"); } catch (e) {}
    try { if (typeof preview === "function") preview(); } catch (e) {}
  }
  L.k = k;
  try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {}
  bancAlvoPintar();
  bancAlvoPrompt();
  return true;
}

if (typeof document !== "undefined" && $("btnLeiCartoes")) {
  $("btnLeiCartoes").onclick = () => clAbrir();
  if ($("btnClFechar")) $("btnClFechar").onclick = () => $("dlgLeiCartoes").close();
}
