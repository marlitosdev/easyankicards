/* =====================================================================
 * (19.184.0) A CONSULTA AO LADO, DENTRO DO LEITOR DE LEI
 *
 * O "⇔ lei e julgados lado a lado" abria DUAS janelas soltas, presas às metades da tela: o par era fixo (lei à esquerda,
 * julgados à direita), cada uma com o seu cabeçalho e o seu "Fechar", e a coluna de julgados mostrava o tópico inteiro —
 * lendo o art. 1º da CF, ao lado estavam a Súmula 473 e a SV 3. No registro, 1 uso contra ~50 prévias de citação.
 *
 * Agora é UM PAINEL do leitor, à direita, só em tela larga:
 *  · VOCÊ ESCOLHE o que vai nele (julgados do tópico, resumo do tópico, outra lei do tópico, questões do artigo), e o
 *    app lembra a escolha (e se o painel estava aberto);
 *  · ELE ACOMPANHA A LEITURA: os julgados que citam o artigo que está na tela vêm primeiro, em destaque; as questões
 *    são as do artigo da tela. O detector é o mesmo das citações do resumo (leiCitacoesNoTexto + leiResolverCitacao);
 *  · COM O PAINEL ABERTO, A CITAÇÃO ABRE NELE (a do leitor e a do resumo do painel) e não tapa mais a lei; "prévia
 *    completa" continua a um toque. Fechado, tudo é como antes.
 * ===================================================================== */
const LEI_CONS_CH = "eac_lei_consulta";
const LEI_CONS_MODOS = ["julgados", "resumo", "outra", "questoes"];
const LEI_CONS_MIN = 900;            /* abaixo disto não cabem dois painéis: o botão some e o painel não abre */
let leiCons = null;                  /* { aberto, modo, outraId } */
let leiConsCit = null;               /* a citação mostrada no painel: { c, origemNum, opc, lei, num } */
let leiConsAss = "";                 /* a assinatura da última pintura (repinta só quando algo muda) */
let leiConsArtObj = null;            /* o artigo no topo da leitura */
let leiConsTimer = null;
let leiConsCliqueEm = 0;             /* o último clique DENTRO do painel (a citação do resumo do painel abre nele) */
const leiConsJurMemo = new Map();    /* id do julgado → { k, cits } */

function leiConsLer() {
  if (!leiCons) {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(LEI_CONS_CH) || "null"); } catch (e) { o = null; }
    leiCons = { aberto: !!(o && o.aberto), modo: o && LEI_CONS_MODOS.indexOf(o.modo) >= 0 ? o.modo : "julgados", outraId: "" };
  }
  return leiCons;
}
function leiConsGravar() {
  const s = leiConsLer();
  try { localStorage.setItem(LEI_CONS_CH, JSON.stringify({ aberto: s.aberto, modo: s.modo })); } catch (e) {}
}
function leiConsLarga() {
  const w = (typeof window !== "undefined" && window.innerWidth) || 0;
  return w >= LEI_CONS_MIN;
}
/* o painel vale agora? aberto, com a lei aberta PELO TÓPICO, fora da tela cheia, em tela larga */
function leiConsAtivo() {
  const s = leiConsLer();
  const d = $("dlgLeiSeca");
  return !!(s.aberto && d && d.open && leiAtual && leiAtual.chave && !leiCheia && leiConsLarga());
}
function leiConsEl(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}
function leiConsBotao(rot, fn, cls, tip, id) {
  const b = leiConsEl("button", "btn-min" + (cls ? " " + cls : ""), rot);
  b.type = "button";
  if (tip) b.title = tip;
  if (id) b.id = id;
  b.onclick = fn;
  return b;
}
/* o artigo que está no topo da leitura (null fora do "ler") */
function leiConsArtigoNaTela() {
  let a = null;
  try { a = typeof leiArtigoDoTopo === "function" ? leiArtigoDoTopo() : null; } catch (e) { a = null; }
  return a && a.num ? a : null;
}

/* ---------------- abrir, fechar, escolher ---------------- */
function leiConsAplicar(forcar) {
  const s = leiConsLer();
  const d = $("dlgLeiSeca"), p = $("leiConsulta"), b = $("btnLeiConsulta");
  const ativo = leiConsAtivo();
  if (b) {
    b.hidden = !leiConsLarga() || !leiAtual || !leiAtual.chave || leiCheia;
    if (b.classList) b.classList.toggle("btn-min-ok", ativo);
    if (b.setAttribute) b.setAttribute("aria-pressed", ativo ? "true" : "false");
  }
  if (d && d.classList) d.classList.toggle("lei-com-cons", ativo);
  if (!p) return false;
  p.hidden = !ativo;
  if (!ativo) { leiConsAss = ""; return false; }
  leiConsArtObj = leiConsArtigoNaTela();
  /* o artigo da tela só entra na assinatura onde ele muda o conteúdo: julgados (o destaque) e questões */
  const segue = !leiConsCit && (s.modo === "julgados" || s.modo === "questoes");
  let nJ = 0;
  if (!leiConsCit && s.modo === "julgados") { try { nJ = jurDoTopico(leiAtual.chave).length; } catch (e) { nJ = 0; } }
  const ass = [leiIdAtual, leiAtual.chave, s.modo, s.outraId, segue && leiConsArtObj ? leiConsArtObj.num : "",
    leiConsCit ? "cit:" + leiConsCit.lei.id + ":" + leiConsCit.num : "", nJ].join("|");
  if (!forcar && ass === leiConsAss) return true;
  leiConsAss = ass;
  leiConsPintar();
  return true;
}
function leiConsAlternar(sim) {
  const s = leiConsLer();
  s.aberto = sim === undefined ? !s.aberto : !!sim;
  if (!s.aberto) leiConsCit = null;
  leiConsGravar();
  try { leiReg("leitura", s.aberto ? "consulta ao lado aberta" : "consulta ao lado fechada", s.modo); } catch (e) {}
  leiConsAplicar(true);
  return s.aberto;
}
function leiConsModo(m) {
  if (LEI_CONS_MODOS.indexOf(m) < 0) return false;
  const s = leiConsLer();
  s.modo = m;
  leiConsCit = null;
  leiConsGravar();
  try { leiReg("leitura", "consulta ao lado: " + m, ""); } catch (e) {}
  leiConsAplicar(true);
  return true;
}
/* de FORA do leitor (a ficha do tópico, o menu do tópico): abre a lei com o painel já no conteúdo pedido */
function leiConsAbrirTopico(disciplina, topico, modo) {
  const s = leiConsLer();
  s.aberto = true;
  if (LEI_CONS_MODOS.indexOf(modo) >= 0) s.modo = modo;
  leiConsCit = null;
  leiConsGravar();
  try { reg("MATERIAL", "lei com consulta ao lado", disciplina + " · " + topico + " · " + s.modo); } catch (e) {}
  if (typeof lvAbrirLeiDoTopico === "function") lvAbrirLeiDoTopico(disciplina, topico, { origem: "consulta ao lado" });
  else leiAbrir(disciplina, topico);
  leiConsAplicar(true);
}
/* a rolagem da leitura: o painel acompanha o artigo da tela (sem repintar a cada pixel) */
function leiConsAgendar() {
  if (leiConsTimer || !leiConsAtivo()) return;
  leiConsTimer = setTimeout(() => { leiConsTimer = null; leiConsAplicar(); }, 220);
}

/* ---------------- a pintura ---------------- */
function leiConsPintar() {
  const s = leiConsLer();
  const sel = $("leiConsSel");
  if (sel) sel.value = s.modo;
  const cx = $("leiConsCorpo");
  if (!cx) return;
  cx.innerHTML = "";
  if (cx.scrollTop) cx.scrollTop = 0;
  try {
    if (leiConsCit) leiConsPintarCitacao(cx);
    else if (s.modo === "resumo") leiConsPintarResumo(cx);
    else if (s.modo === "outra") leiConsPintarOutra(cx);
    else if (s.modo === "questoes") leiConsPintarQuestoes(cx);
    else leiConsPintarJulgados(cx);
  } catch (e) {
    cx.append(leiConsEl("p", "nota", t("lcons_erro", { e: e && e.message })));
    try { leiReg("erro", "consulta ao lado: erro ao pintar", s.modo + " · " + (e && e.message)); } catch (x) {}
  }
}

/* ---- JULGADOS: os que citam o artigo da tela primeiro ---- */
function leiConsJurTexto(j) { return String(j.tese || j.resumo || j.texto || ""); }
/* as citações de lei de um julgado, já resolvidas (guardadas enquanto o julgado não muda) */
function leiConsJurCitas(j, lista, doTopico) {
  const k = String(j.tocado || "") + "|" + leiConsJurTexto(j).length + "|" + String(j.resumo || "").length + "|" + doTopico.map((l) => l.id).join(",");
  const m = leiConsJurMemo.get(j.id);
  if (m && m.k === k) return m.cits;
  const todos = [leiConsJurTexto(j), j.resumo && j.resumo !== leiConsJurTexto(j) ? j.resumo : ""].filter(Boolean).join("\n");
  let cs = [];
  try { cs = leiCitacoesNoTexto(todos); } catch (e) { cs = []; }
  const cits = cs.map((c) => {
    let r = { lei: null };
    try { r = leiResolverCitacao(c, lista, doTopico); } catch (e) { r = { lei: null }; }
    return { num: c.num, leiId: r.lei ? r.lei.id : "" };
  }).filter((x) => x.leiId);
  leiConsJurMemo.set(j.id, { k, cits });
  return cits;
}
/* o texto do julgado com as citações de lei clicáveis: a da lei aberta leva a leitura ao artigo; outra, abre no painel */
function leiConsTextoComCitas(txt, lista, doTopico) {
  const box = leiConsEl("div", "lei-cons-item-txt");
  let cs = [];
  try { cs = leiCitacoesNoTexto(txt).filter((c) => c.fim > c.ini).sort((a, b) => a.ini - b.ini); } catch (e) { cs = []; }
  let pos = 0;
  cs.forEach((c) => {
    if (c.ini < pos) return;
    let r = { lei: null };
    try { r = leiResolverCitacao(c, lista, doTopico); } catch (e) { r = { lei: null }; }
    if (!r.lei) return;
    if (c.ini > pos) box.append(document.createTextNode(txt.slice(pos, c.ini)));
    const mesma = r.lei.id === leiIdAtual;
    const b = leiConsEl("button", "lei-cons-cit" + (mesma ? " lei-cons-cit-aqui" : ""), txt.slice(c.ini, c.fim));
    b.type = "button";
    b.title = mesma ? t("lcons_cit_ir", { a: c.numCru || c.num }) : t("lcons_cit_abrir", { l: r.lei.nome, a: c.numCru || c.num });
    b.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (mesma && typeof leiIrArtigo === "function") { leiIrArtigo(c.num); return; }
      leiConsCit = { c, origemNum: "", opc: {}, lei: r.lei, num: c.num };
      leiConsAplicar(true);
    };
    box.append(b);
    pos = c.fim;
  });
  if (pos < txt.length) box.append(document.createTextNode(txt.slice(pos)));
  return box;
}
function leiConsPintarJulgados(cx) {
  const ch = leiAtual.chave;
  let js = [];
  try { js = jurDoTopico(ch); } catch (e) { js = []; }
  const lista = leisLista(), doTopico = leisDoTopico(ch);
  const art = leiConsArtObj;
  const doArt = [], daLei = [], resto = [];
  js.forEach((j) => {
    const cits = leiConsJurCitas(j, lista, doTopico);
    const daAberta = cits.filter((x) => x.leiId === leiIdAtual);
    if (art && daAberta.some((x) => x.num === art.num)) doArt.push(j);
    else if (daAberta.length) daLei.push({ j, nums: daAberta.map((x) => x.num).filter((n, i, a) => a.indexOf(n) === i) });
    else resto.push(j);
  });
  const cab = leiConsEl("p", "nota lei-cons-cab-txt");
  cab.textContent = js.length
    ? t("lcons_jur_cab", { n: js.length }) + (art ? " · " + t("lcons_jur_art", { a: art.rotulo || ("art. " + art.num), m: doArt.length }) : "")
    : t("lcons_jur_vazio");
  cx.append(cab);
  const card = (j, cls, extra) => {
    const it = leiConsEl("div", "lei-cons-item" + (cls ? " " + cls : ""));
    const nome = typeof jurCitNome === "function" ? jurCitNome(j) : String(j.tribunal || "");
    it.append(leiConsEl("div", "lei-cons-item-tit", nome || t("lcons_jur_sem_nome")));
    if (extra) it.append(leiConsEl("div", "nota lei-cons-item-meta", extra));
    it.append(leiConsTextoComCitas(leiConsJurTexto(j), lista, doTopico));
    return it;
  };
  if (doArt.length) {
    cx.append(leiConsEl("div", "lei-cons-sec", t("lcons_jur_sec_art", { a: art.rotulo || ("art. " + art.num) })));
    doArt.forEach((j) => cx.append(card(j, "lei-cons-destaque")));
  }
  if (daLei.length) {
    cx.append(leiConsEl("div", "lei-cons-sec", t("lcons_jur_sec_lei")));
    daLei.forEach((x) => cx.append(card(x.j, "", t("lcons_jur_cita_arts", { a: x.nums.slice(0, 6).join(", ") }))));
  }
  if (resto.length) {
    if (doArt.length || daLei.length) cx.append(leiConsEl("div", "lei-cons-sec", t("lcons_jur_sec_resto")));
    resto.forEach((j) => cx.append(card(j)));
  }
  const pe = leiConsEl("div", "lei-cons-pe");
  pe.append(leiConsBotao(t(js.length ? "lcons_jur_abrir" : "lcons_jur_guardar"),
    () => { if (typeof jurAbrir === "function") jurAbrir(leiAtual.disciplina, leiAtual.topico, js.length ? "ler" : "incluir"); },
    js.length ? "" : "btn-min-ok", "", "btnLeiConsJurAbrir"));
  cx.append(pe);
}

/* ---- RESUMO DO TÓPICO: o mesmo desenho da leitura do resumo, com as citações ligadas ---- */
function leiConsPintarResumo(cx) {
  const ch = leiAtual.chave;
  let txt = "";
  try { txt = typeof matTextoVivo === "function" ? String(matTextoVivo(ch, "texto") || "") : ""; } catch (e) { txt = ""; }
  if (!txt.trim()) {
    cx.append(leiConsEl("p", "nota", t("lcons_res_vazio")));
    return;
  }
  const box = leiConsEl("div", "lei-cons-res");
  box.innerHTML = typeof matParaHtml === "function" ? matParaHtml(txt, null) : "";
  if (!box.innerHTML) box.textContent = txt;
  cx.append(box);
  try { if (typeof citLigarEm === "function") citLigarEm(box, { disciplina: leiAtual.disciplina, topico: leiAtual.topico, chave: ch, onde: "resumo", textoTodo: () => txt }); } catch (e) {}
}

/* ---- OUTRA LEI DO TÓPICO ---- */
function leiConsPintarOutra(cx) {
  const s = leiConsLer();
  const outras = leisDoTopico(leiAtual.chave).filter((l) => l.id !== leiIdAtual);
  if (!outras.length) {
    cx.append(leiConsEl("p", "nota", t("lcons_outra_vazio")));
    if (typeof leiBibAbrir === "function") cx.append(leiConsBotao(t("lei_fila_bib"), () => leiBibAbrir(), "", t("lei_fila_bib_aj")));
    return;
  }
  const l = outras.find((x) => x.id === s.outraId) || outras[0];
  s.outraId = l.id;
  const topo = leiConsEl("div", "lei-cons-outra-topo");
  if (outras.length > 1) {
    const sel = leiConsEl("select", "lei-cons-outra-sel");
    sel.id = "leiConsOutraSel";
    outras.forEach((x) => { const o = leiConsEl("option", "", x.nome); o.value = x.id; sel.append(o); });
    sel.value = l.id;
    sel.onchange = () => { s.outraId = sel.value; leiConsAplicar(true); };
    topo.append(sel);
  } else topo.append(leiConsEl("div", "lei-cons-item-tit", l.nome));
  const ir = leiConsEl("input", "lei-cons-ir");
  ir.id = "leiConsOutraIr";
  ir.type = "text";
  ir.placeholder = t("lcons_outra_ir");
  topo.append(ir);
  cx.append(topo);
  const lista = leiConsEl("div", "lei-cons-arts");
  let arts = [];
  try { arts = leiArtigosEfetivos(l); } catch (e) { arts = []; }
  arts.forEach((a) => {
    const d = leiConsEl("div", "lei-cons-art");
    d._num = a.num;
    d.append(leiConsEl("div", "lei-cons-art-rot", a.rotulo || ("Art. " + a.num)));
    d.append(leiConsEl("div", "lei-cons-art-txt", String(a.corpo || a.texto || "")));
    lista.append(d);
  });
  cx.append(lista);
  const irPara = () => {
    const n = typeof leiNumNormal === "function" ? leiNumNormal(String(ir.value || "").replace(/^\s*art\.?\s*/i, "")) : String(ir.value || "").trim();
    const alvo = Array.from(lista.children || []).find((e) => e._num === n);
    if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: "start" });
    return !!alvo;
  };
  ir.onkeydown = (ev) => { if (ev && ev.key === "Enter") { if (ev.preventDefault) ev.preventDefault(); irPara(); } };
  ir._irPara = irPara;
}

/* ---- QUESTÕES DO ARTIGO DA TELA ---- */
function leiConsPintarQuestoes(cx) {
  const art = leiConsArtObj;
  if (!art) { cx.append(leiConsEl("p", "nota", t("lcons_qs_sem_art"))); return; }
  let qs = [];
  try { qs = typeof leiQuestoesDoArtigo === "function" ? leiQuestoesDoArtigo(leiIdAtual, art.num) : []; } catch (e) { qs = []; }
  const rot = art.rotulo || ("art. " + art.num);
  cx.append(leiConsEl("p", "nota lei-cons-cab-txt", qs.length ? t("lcons_qs_cab", { a: rot, n: qs.length }) : t("lcons_qs_vazio", { a: rot })));
  if (!qs.length) return;
  if (typeof qsUiResponderAbrir === "function") {
    cx.append(leiConsBotao(t("lcons_qs_responder", { n: qs.length }), () => qsUiResponderAbrir(qs, "aba", "art:" + leiIdAtual + ":" + art.num), "btn-min-ok", "", "btnLeiConsQsResponder"));
  }
  qs.forEach((q) => {
    const it = leiConsEl("div", "lei-cons-item");
    const en = Array.isArray(q.enunciado) ? q.enunciado.join(" ") : String(q.enunciado || "");
    const tx = en.replace(/\s+/g, " ").trim();
    it.append(leiConsEl("div", "lei-cons-item-txt", tx.length > 260 ? tx.slice(0, 259) + "…" : tx));
    cx.append(it);
  });
}

/* ---- A CITAÇÃO, NO PAINEL ---- */
/* a prévia de citação chama isto primeiro: com o painel aberto e o toque vindo do leitor (ou do próprio painel), a
 * citação abre no painel e a prévia não abre. Devolve se recebeu. */
function leiConsReceberCitacao(c, origemNum, opc) {
  const o = opc || {};
  if (!c || o._fora || o._nav || !leiConsAtivo()) return false;
  const doLeitor = !!(o.ctx && o.ctx.dentro);
  const doPainel = Date.now() - leiConsCliqueEm < 1500;
  if (!doLeitor && !doPainel) return false;
  let lei = o.lei || (c.leiId ? leiDe(c.leiId) : null) || (c.mesmaLei && leiIdAtual ? leiDe(leiIdAtual) : null);
  if (!lei && c.rotulo) { try { lei = leiCasarRotulo(c.rotulo, leisLista()); } catch (e) { lei = null; } }
  if (!lei) return false;            /* sem lei certa: a prévia completa decide (ela pergunta) */
  leiConsCit = { c, origemNum: origemNum || "", opc: o, lei, num: c.num };
  try { leiReg("consulta", "citação aberta na consulta ao lado", lei.nome + " · art. " + (c.numCru || c.num || "—")); } catch (e) {}
  leiConsAplicar(true);
  return true;
}
function leiConsPintarCitacao(cx) {
  const k = leiConsCit, s = leiConsLer();
  const topo = leiConsEl("div", "lei-cons-outra-topo");
  topo.append(leiConsBotao(t("lcons_cit_voltar", { m: t("lcons_m_" + s.modo) }), () => { leiConsCit = null; leiConsAplicar(true); }, "", "", "btnLeiConsVoltar"));
  cx.append(topo);
  cx.append(leiConsEl("div", "lei-cons-item-tit", k.lei.nome));
  let arts = [];
  try { arts = leiArtigosEfetivos(k.lei); } catch (e) { arts = []; }
  const i = arts.findIndex((a) => a.num === k.num);
  const art = i >= 0 ? arts[i] : null;
  if (!art) {
    cx.append(leiConsEl("p", "nota", t("lei_cita_artigo_nao_achou", { a: (k.c && k.c.numCru) || k.num })));
  } else {
    const nav = leiConsEl("div", "lei-cons-nav");
    if (i > 0) nav.append(leiConsBotao("‹ " + arts[i - 1].rotulo, () => { k.num = arts[i - 1].num; leiConsAplicar(true); }, "", "", "btnLeiConsAnt"));
    if (i < arts.length - 1) nav.append(leiConsBotao(arts[i + 1].rotulo + " ›", () => { k.num = arts[i + 1].num; leiConsAplicar(true); }, "", "", "btnLeiConsProx"));
    cx.append(nav);
    const d = leiConsEl("div", "lei-cons-art lei-cons-destaque");
    d.append(leiConsEl("div", "lei-cons-art-rot", art.rotulo));
    d.append(leiConsEl("div", "lei-cons-art-txt", String(art.corpo || art.texto || "")));
    cx.append(d);
  }
  const pe = leiConsEl("div", "lei-cons-pe");
  if (k.lei.id === leiIdAtual && art) pe.append(leiConsBotao(t("lcons_cit_ler"), () => leiIrArtigo(art.num), "btn-min-ok", "", "btnLeiConsIrArt"));
  pe.append(leiConsBotao(t("lcons_cit_previa"), () => {
    const c2 = Object.assign({}, k.c, { num: k.num });
    leiCitacaoPreviewAbrir(c2, k.origemNum, Object.assign({}, k.opc, { lei: k.lei, _fora: true }));
  }, "", t("lcons_cit_previa_tip"), "btnLeiConsPrevia"));
  cx.append(pe);
}

/* ---------------- ligar ---------------- */
function leiConsIniciar() {
  const liga = (id, nome, fn) => { if ($(id)) leiBotao(id, nome, fn); };
  liga("btnLeiConsulta", "consulta ao lado", () => leiConsAlternar());
  liga("btnLeiConsFechar", "fechar a consulta ao lado", () => leiConsAlternar(false));
  const sel = $("leiConsSel");
  if (sel) sel.onchange = () => leiConsModo(sel.value);
  const p = $("leiConsulta");
  if (p && p.addEventListener && !p._eacConsOuvinte) {
    p._eacConsOuvinte = true;
    /* o toque num link DO PAINEL (a citação do resumo) abre a citação no próprio painel */
    p.addEventListener("click", () => { leiConsCliqueEm = Date.now(); }, true);
  }
  if (typeof window !== "undefined" && window.addEventListener && !leiConsIniciar._resize) {
    leiConsIniciar._resize = true;
    window.addEventListener("resize", () => { try { if (leiAtual) leiConsAplicar(); } catch (e) {} });
  }
}
