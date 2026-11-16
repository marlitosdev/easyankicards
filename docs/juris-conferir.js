/* =====================================================================
 * CONFERIR JULGADOS UM A UM (19.144.0)
 *
 * O PEDIDO: os julgados "a conferir" (21 no backup de 16/11) não tinham caminho para serem tratados. O "🛡 Conferir
 * julgados" compara com o CATÁLOGO OFICIAL — que só tem súmulas e temas; os acórdãos (ADI, RE-AgR, ARE…) ficavam de
 * fora. E o que tinham de errado não estava dito: dos 21, 5 sem ementa, 12 com um texto que não é a ementa, 3 com a
 * ementa de OUTRO processo ("ADI 5135" guardando a ementa de um ARE-AgR), 16 sem relator, 15 com a vigência dita só
 * pela IA.
 *
 * A FILA: os julgados com algo a resolver, do de maior risco para o de menor. Em cada um:
 *  · O QUE ESTÁ GUARDADO (tese, ementa, dados, fonte) e AS VERIFICAÇÕES, cada uma com o porquê por extenso;
 *  · os links para CONFERIR NA FONTE (o processo no portal do tribunal e a pesquisa de jurisprudência);
 *  · CORRIGIR AQUI os campos que mais faltam (relator, data, órgão, fonte, a ementa colada do portal);
 *  · decidir: ✓ confere (o selo "conferido por você", preso a esta tese) · ⚠ problema (com o motivo) · ⏭ pular.
 * Tudo se desfaz ("↶ desfazer a última"), e o registro anota cada decisão.
 * ===================================================================== */

let jcf = null;   /* { ids, i, decisoes: {id: "confere"|"problema"|"pulado"}, pilha: [{id, antes}] } */

function jcfNormal(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/* as classes que a ementa diz no começo ("AÇÃO DIRETA DE INCONSTITUCIONALIDADE…", "AGRAVO INTERNO EM RECURSO
 * EXTRAORDINÁRIO COM AGRAVO…") — e as que o julgado diz ser (classe guardada) */
const JCF_FRASES = [
  ["ACAO DIRETA DE INCONST", "ADI"], ["ACAO DECLARATORIA DE CONST", "ADC"], ["ARGUICAO DE DESCUMPRIMENTO", "ADPF"],
  ["RECURSO EXTRAORDINARIO COM AGRAVO", "ARE"], ["RECURSO EXTRAORDINARIO", "RE"], ["AGRAVO EM RECURSO ESPECIAL", "ARESP"],
  ["RECURSO ESPECIAL", "RESP"], ["AGRAVO INTERNO", "AGR"], ["AGRAVO REGIMENTAL", "AGR"], ["MANDADO DE SEGURANCA", "MS"],
  ["HABEAS CORPUS", "HC"], ["RECLAMACAO", "RCL"], ["EMBARGOS DE DIVERGENCIA", "EDIV"], ["EMBARGOS DE DECLARACAO", "ED"],
];
function jcfClassesDaEmenta(texto) {
  const cab = jcfNormal(texto).replace(/^(?:EMENTA\s*:?\s*)+/, "").slice(0, 220);
  const out = [];
  JCF_FRASES.forEach(([fr, c]) => { const k = cab.indexOf(fr); if (k >= 0 && k < 200) out.push({ c, k, fr }); });
  return out.sort((a, b) => a.k - b.k);
}
function jcfClassesGuardadas(j) {
  const s = " " + jcfNormal([j.classe, j.numero].join(" ")).replace(/[^A-Z]+/g, " ") + " ";
  const c = new Set();
  [["ADPF", "ADPF"], ["ADI", "ADI"], ["ADC", "ADC"], ["ARESP", "ARESP"], ["ARE", "ARE"], ["RESP", "RESP"], ["RE", "RE"], ["MS", "MS"], ["HC", "HC"], ["RCL", "RCL"],
    ["AGR", "AGR"], ["AGINT", "AGR"], ["AGRG", "AGR"], ["ED", "ED"], ["EDCL", "ED"], ["ERESP", "EDIV"]].forEach(([k, v]) => { if (s.indexOf(" " + k + " ") >= 0) c.add(v); });
  return c;
}

/* os radicais de um texto (para ver se a tese está na ementa) */
function jcfRadicais(s) {
  const r = new Set();
  jcfNormal(s).split(/[^A-Z0-9]+/).forEach((w) => { if (w.length > 4) r.add(w.slice(0, 6)); });
  return r;
}

/* AS VERIFICAÇÕES de um julgado: [{ k, peso (3 grave · 2 atenção · 1 detalhe), txt }] */
function jcfVerificacoes(j) {
  if (!j) return [];
  const v = [];
  const add = (k, peso, txt) => v.push({ k, peso, txt });
  /* o que a qualidade já acusa como problema (fora de vigor, tese diferente da oficial, repetido) */
  try {
    const q = jurQualidade(j, { lista: jurLista() });
    if (q.nivel === "problema") (q.motivos || []).forEach((m) => add("q_" + m.k, 3, m.txt));
  } catch (e) {}
  const tx = String(j.texto || "").trim();
  if (!tx) add("sem_ementa", 3, t("jcf_v_sem_ementa"));
  else {
    const nao = !/\bEMENTA\b/.test(jcfNormal(tx.slice(0, 300))) && tx.length < 700;   /* a palavra inteira: "complEMENTAr" não conta */
    if (nao) add("nao_ementa", 2, t("jcf_v_nao_ementa", { n: tx.length }));
    const ce = jcfClassesDaEmenta(tx);
    const cg = jcfClassesGuardadas(j);
    if (ce.length && cg.size && !ce.some((x) => cg.has(x.c) && x.c !== "AGR") && !(cg.has("AGR") && ce.some((x) => x.c === "AGR"))) {
      const fr = ce[0].fr.toLowerCase();
      add("outra_classe", 3, t("jcf_v_outra_classe", { e: fr, g: [j.classe, j.numero].filter(Boolean).join(" ") }));
    }
    if (String(j.tese || "").trim() && tx.length > 200) {
      const rt = jcfRadicais(j.tese), re = jcfRadicais(tx);
      if (rt.size >= 5) {
        let c = 0; rt.forEach((w) => { if (re.has(w)) c++; });
        const pct = Math.round((c / rt.size) * 100);
        if (pct < 25) add("tese_fora", 2, t("jcf_v_tese_fora", { p: pct }));
      }
    }
  }
  if (j.deMemoria) add("memoria", 3, t("jcf_v_memoria"));
  if (!String(j.fonte || "").trim() && !String(j.fonteUrl || "").trim()) add("sem_fonte", 2, t("jcf_v_sem_fonte"));
  if (j.vigenciaIA && j.vigenciaIA === j.conferidoEm && !(j.selo && jurSeloValido(j))) add("vig_ia", 2, t("jcf_v_vig_ia", { d: jurDataBr(j.vigenciaIA) }));
  if (j.certeza === "baixa") add("certeza", 2, t("jcf_v_certeza"));
  const ac = Array.isArray(j.aConferir) ? j.aConferir : [];
  if (ac.length) add("campos", 2, t("jcf_v_campos", { c: ac.map((x) => (typeof jurNomeCampo === "function" ? jurNomeCampo(x) : x)).join(", ") }));
  if (!String(j.relator || "").trim()) add("sem_relator", 1, t("jcf_v_sem_relator"));
  if (!String(j.data || "").trim()) add("sem_data", 1, t("jcf_v_sem_data"));
  if (!String(j.orgao || "").trim()) add("sem_orgao", 1, t("jcf_v_sem_orgao"));
  return v.sort((a, b) => b.peso - a.peso);
}
function jcfRisco(j) { return jcfVerificacoes(j).reduce((s, x) => s + x.peso, 0); }

/* quem entra na fila: o que tem algo a resolver (problema, a conferir, vencido), do maior risco para o menor */
function jcfFila(lista) {
  const L = (lista || jurLista()).filter((j) => {
    let nv = "";
    try { nv = jurQualidade(j, { lista: jurLista() }).nivel; } catch (e) { nv = ""; }
    return nv === "problema" || nv === "aconferir" || nv === "vencido";
  });
  return L.map((j) => ({ id: j.id, r: jcfRisco(j) })).sort((a, b) => b.r - a.r).map((x) => x.id);
}

/* os links para CONFERIR NA FONTE: o processo no portal e a pesquisa de jurisprudência */
function jcfLinks(j) {
  const out = [];
  const tri = String((j && j.tribunal) || "").toUpperCase();
  const cl = String(j.classe || "").split(/[\s/-]/)[0].trim();
  const num = String(j.numero || "").replace(/[^\d]/g, "");
  const ref = [cl, num].filter(Boolean).join(" ");
  try { const lk = jurLinkOficial(j); if (lk) out.push({ id: "oficial", rot: lk.nome, url: lk.url }); } catch (e) {}
  if (tri === "STF") {
    if (cl && num) out.push({ id: "processo", rot: t("jcf_l_stf_proc", { p: ref }), url: "https://portal.stf.jus.br/processos/listarProcessos.asp?classe=" + encodeURIComponent(cl) + "&numeroProcesso=" + num });
    if (ref) out.push({ id: "juris", rot: t("jcf_l_stf_juris", { p: ref }), url: "https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&queryString=" + encodeURIComponent(ref) });
  } else if (tri === "STJ") {
    if (ref) out.push({ id: "juris", rot: t("jcf_l_stj_juris", { p: ref }), url: "https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=" + encodeURIComponent(ref) });
    if (ref) out.push({ id: "processo", rot: t("jcf_l_stj_proc", { p: ref }), url: "https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaGenerica&termo=" + encodeURIComponent(ref) });
  }
  if (String(j.fonteUrl || "").trim()) out.unshift({ id: "sua", rot: t("jcf_l_sua"), url: String(j.fonteUrl).trim() });
  return out;
}

/* ---------------- a fila ---------------- */
function jcfAbrir(ids, opc) {
  if (!$("dlgJcf")) return false;
  const lista = (ids && ids.length ? ids : jcfFila()).filter((id) => jurDe(id));
  jcf = { ids: lista, i: 0, decisoes: {}, pilha: [], volta: (opc && opc.volta) || null };
  abrirModal("dlgJcf");
  jcfPintar();
  try { reg("JURIS", "conferir um a um: fila aberta", lista.length + " julgado(s)"); } catch (e) {}
  return true;
}
function jcfAtual() { return jcf && jcf.ids[jcf.i] ? jurDe(jcf.ids[jcf.i]) : null; }

function jcfEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

function jcfPintar() {
  if (!jcf || !$("jcfCorpo")) return;
  const n = jcf.ids.length;
  const feitos = Object.keys(jcf.decisoes).length;
  const fim = jcf.i >= n;
  $("jcfPos").textContent = n ? (fim ? t("jcf_pos_fim", { n }) : t("jcf_pos", { k: jcf.i + 1, n })) : t("jcf_vazia");
  $("jcfProg").value = n ? Math.round((feitos / n) * 100) : 100;
  ["btnJcfAnt", "btnJcfPular", "btnJcfProblema", "btnJcfConfere"].forEach((id) => { if ($(id)) $(id).hidden = fim || !n; });
  if ($("btnJcfAnt")) $("btnJcfAnt").disabled = jcf.i <= 0;
  if ($("btnJcfDesfazer")) $("btnJcfDesfazer").hidden = !jcf.pilha.length;
  const cx = $("jcfCorpo");
  cx.innerHTML = "";
  if (!n) { cx.append(jcfEl("p", "nota", t("jcf_vazia_expl"))); return; }
  if (fim) { jcfPintarFim(cx); return; }
  const j = jcfAtual();
  const ver = jcfVerificacoes(j);
  /* esquerda: o que está guardado */
  const esq = jcfEl("section", "jcf-col jcf-guardado");
  esq.append(jcfEl("div", "jcf-rot", t("jcf_guardado")));
  if (typeof jurBibCab === "function") esq.append(jurBibCab(j));
  esq.append(jcfEl("div", "jcf-tit", jurCitNome(j) || jurTitulo(j)));
  const dados = [j.orgao, j.relator, j.data ? jurDataBr(String(j.data).slice(0, 10)) : ""].filter((x) => String(x || "").trim());
  esq.append(jcfEl("p", "jcf-dados", dados.length ? dados.join(" · ") : t("jbb_lt_sem_dados")));
  esq.append(jcfEl("div", "jcf-rot2", t("jbb_lt_tese")));
  esq.append(jcfEl("blockquote", "jbb-lt-tese", String(j.tese || "").trim() || t("jur_bib_sem_tese")));
  esq.append(jcfEl("div", "jcf-rot2", t("jbb_lt_ementa")));
  const tx = String(j.texto || "").trim();
  esq.append(tx ? jcfEl("p", "jbb-lt-ementa jcf-ementa", tx) : jcfEl("p", "jbb-lt-vazio", t("jbb_lt_sem_ementa")));
  esq.append(jcfEl("div", "jcf-rot2", t("jbb_lt_fonte")));
  esq.append(jcfEl("p", "jbb-lt-ementa", [String(j.fonte || "").trim(), String(j.fonteUrl || "").trim()].filter(Boolean).join(" · ") || t("jbb_lt_sem_fonte")));
  /* direita: as verificações, a fonte, corrigir e decidir */
  const dir = jcfEl("section", "jcf-col jcf-conferir");
  dir.append(jcfEl("div", "jcf-rot", t("jcf_verificacoes", { n: ver.length })));
  const ul = jcfEl("ul", "jcf-ver");
  ul.id = "jcfVer";
  if (!ver.length) ul.append(jcfEl("li", "jcf-ok", t("jcf_v_nada")));
  ver.forEach((x) => { const li = jcfEl("li", "jcf-p" + x.peso, x.txt); li.dataset.k = x.k; ul.append(li); });
  dir.append(ul);
  dir.append(jcfEl("div", "jcf-rot", t("jcf_na_fonte")));
  const lks = jcfEl("div", "jcf-links");
  jcfLinks(j).forEach((l) => { const a = jcfEl("a", "btn-min jur-oficial-lnk", "↗ " + l.rot); a.href = l.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.id = "jcfLink_" + l.id; lks.append(a); });
  if (!lks.childNodes.length) lks.append(jcfEl("p", "nota", t("jcf_sem_links")));
  dir.append(lks);
  /* corrigir aqui: os campos que mais faltam */
  const cor = jcfEl("details", "jcf-corrigir");
  cor.id = "jcfCorrigir";
  if (ver.some((x) => /sem_|nao_ementa|outra_classe|tese_fora/.test(x.k))) cor.open = true;
  cor.append(jcfEl("summary", "", t("jcf_corrigir")));
  const campo = (k, rot, tipo) => {
    const lab = jcfEl("label", "jbb-campo");
    lab.append(jcfEl("span", "", rot));
    const inp = jcfEl(tipo === "area" ? "textarea" : "input", "");
    if (tipo === "area") inp.rows = 5; else inp.type = "text";
    inp.id = "jcfCampo_" + k;
    inp.value = String(j[k] || "");
    lab.append(inp);
    cor.append(lab);
  };
  campo("relator", t("jcf_c_relator"));
  campo("orgao", t("jcf_c_orgao"));
  campo("data", t("jcf_c_data"));
  campo("fonteUrl", t("jcf_c_fonte_url"));
  campo("texto", t("jcf_c_ementa"), "area");
  const bs = jcfEl("div", "qm-bts");
  const bSal = jcfEl("button", "btn-min btn-min-ok", t("jcf_salvar_corr"));
  bSal.type = "button"; bSal.id = "btnJcfSalvarCorr";
  bSal.onclick = () => jcfSalvarCorrecoes();
  const bEd = jcfEl("button", "btn-min", t("jcf_editar_tudo"));
  bEd.type = "button"; bEd.id = "btnJcfEditarTudo"; bEd.title = t("jcf_editar_tudo_aj");
  bEd.onclick = () => jcfEditarTudo();
  bs.append(bSal, bEd);
  cor.append(bs);
  dir.append(cor);
  /* o que a pessoa conferiu: os três vistos liberam o "confere" */
  dir.append(jcfEl("div", "jcf-rot", t("jcf_checklist")));
  const ck = jcfEl("div", "jcf-check");
  ["proc", "ementa", "tese"].forEach((k) => {
    const lab = jcfEl("label", "diag-op");
    const c = jcfEl("input", "");
    c.type = "checkbox"; c.id = "jcfCk_" + k;
    c.onchange = () => jcfPintarConfere();
    lab.append(c, " ", jcfEl("span", "", t("jcf_ck_" + k)));
    ck.append(lab);
  });
  dir.append(ck);
  const mot = jcfEl("input", "jcf-motivo");
  mot.type = "text"; mot.id = "jcfMotivo"; mot.placeholder = t("jcf_motivo_ph");
  dir.append(mot);
  const corpo = jcfEl("div", "jcf-grade");
  corpo.append(esq, dir);
  cx.append(corpo);
  jcfPintarConfere();
}
function jcfPintarConfere() {
  const b = $("btnJcfConfere");
  if (!b) return;
  const j = jcfAtual();
  const todos = ["proc", "ementa", "tese"].every((k) => $("jcfCk_" + k) && $("jcfCk_" + k).checked);
  b.disabled = !todos || !j || !String(j.tese || "").trim();
  b.title = !j || !String(j.tese || "").trim() ? t("jcf_confere_sem_tese") : todos ? t("jcf_confere_aj") : t("jcf_confere_falta");
}
function jcfPintarFim(cx) {
  const d = jcf.decisoes;
  const conta = (x) => Object.keys(d).filter((k) => d[k] === x).length;
  const box = jcfEl("div", "jcf-fim");
  box.append(jcfEl("div", "jcf-tit", t("jcf_fim_tit")));
  box.append(jcfEl("p", "", t("jcf_fim", { c: conta("confere"), p: conta("problema"), s: conta("pulado"), n: jcf.ids.length })));
  const bts = jcfEl("div", "qm-bts");
  const b1 = jcfEl("button", "btn-min", t("jcf_rever_pulados", { n: conta("pulado") }));
  b1.type = "button"; b1.id = "btnJcfReverPulados"; b1.hidden = !conta("pulado");
  b1.onclick = () => { const ps = jcf.ids.filter((id) => d[id] === "pulado"); jcf.ids = ps; jcf.i = 0; ps.forEach((id) => delete d[id]); jcfPintar(); };
  bts.append(b1);
  box.append(bts);
  cx.append(box);
}

/* guarda o "antes" do julgado (para o desfazer) e registra a decisão */
function jcfAnotar(j, decisao) {
  jcf.pilha.push({ id: j.id, antes: JSON.parse(JSON.stringify(j)), decisao, i: jcf.i });
  jcf.decisoes[j.id] = decisao;
}
function jcfAvancar() { jcf.i++; jcfPintar(); try { if ($("jcfCorpo")) $("jcfCorpo").scrollTop = 0; } catch (e) {} }

function jcfConfere() {
  const j = jcfAtual();
  if (!j || !String(j.tese || "").trim()) return false;
  jcfAnotar(j, "confere");
  const lk = jcfLinks(j)[0];
  if (j.problema) jurGravar({ id: j.id, problema: null });
  jurSeloConceder(j.id, "pessoa", t("jcf_selo_fonte", { f: (j.fonteUrl || (lk && lk.rot) || t("jur_q_fonte_pessoa")) }));
  try { reg("JURIS", "conferir um a um: confere (selo)", jurTitulo(j)); } catch (e) {}
  jcfDepois();
  jcfAvancar();
  return true;
}
function jcfProblema() {
  const j = jcfAtual();
  if (!j) return false;
  const motivo = String(($("jcfMotivo") || {}).value || "").trim() || (jcfVerificacoes(j)[0] || {}).txt || t("jcf_problema_sem_motivo");
  jcfAnotar(j, "problema");
  jurGravar({ id: j.id, problema: { em: jurHojeISO(), nota: motivo.slice(0, 300) } });
  try { reg("JURIS", "conferir um a um: marcado com problema", jurTitulo(j) + " · " + motivo.slice(0, 120)); } catch (e) {}
  jcfDepois();
  jcfAvancar();
  return true;
}
function jcfPular() {
  const j = jcfAtual();
  if (!j) return false;
  jcf.decisoes[j.id] = "pulado";
  jcfAvancar();
  return true;
}
function jcfVoltar() { if (jcf && jcf.i > 0) { jcf.i--; jcfPintar(); } }

/* corrigir aqui: só grava o que mudou; a tese não muda (o selo fica preso a ela) */
function jcfSalvarCorrecoes() {
  const j = jcfAtual();
  if (!j) return false;
  const mud = { id: j.id };
  ["relator", "orgao", "data", "fonteUrl", "texto"].forEach((k) => {
    const el = $("jcfCampo_" + k);
    if (!el) return;
    const v = String(el.value || "").trim();
    if (v !== String(j[k] || "").trim()) mud[k] = v;
  });
  if (Object.keys(mud).length === 1) { if ($("jcfMsg")) $("jcfMsg").textContent = t("jcf_corr_nada"); return 0; }
  jcf.pilha.push({ id: j.id, antes: JSON.parse(JSON.stringify(j)), decisao: "corrigido", i: jcf.i });
  jurGravar(mud);
  const n = Object.keys(mud).length - 1;
  try { reg("JURIS", "conferir um a um: correções", jurTitulo(j) + " · " + Object.keys(mud).filter((k) => k !== "id").join(", ")); } catch (e) {}
  jcfDepois();
  jcfPintar();
  if ($("jcfMsg")) $("jcfMsg").textContent = t("jcf_corr_ok", { n });
  return n;
}

/* editar tudo: o editor completo, na gaveta do tópico; ao voltar, a fila reabre no mesmo julgado */
function jcfEditarTudo() {
  const j = jcfAtual();
  if (!j) return false;
  const tp = typeof jurBibTopicosDe === "function" ? jurBibTopicosDe(j)[0] : null;
  if (!tp) { try { uiAlert(t("jur_aud_editar_sem_topico")); } catch (x) {} return false; }
  const guardado = jcf;
  $("dlgJcf").close();
  if ($("dlgJurBib") && $("dlgJurBib").open) $("dlgJurBib").close();
  jurAbrir(tp.disciplina, tp.topico, "ler");
  jurEditar(j.id);
  jurVoltaPara = () => { jcf = guardado; abrirModal("dlgJcf"); jcfPintar(); };
  try { reg("JURIS", "conferir um a um: editar tudo", jurTitulo(j)); } catch (x) {}
  return true;
}

/* ↶ desfazer a última: o julgado volta exatamente ao que era, e a fila volta para ele */
function jcfDesfazer() {
  if (!jcf || !jcf.pilha.length) return false;
  const u = jcf.pilha.pop();
  const atual = jurDe(u.id) || {};
  const r = Object.assign({}, u.antes);
  Object.keys(atual).forEach((k) => { if (!(k in u.antes)) r[k] = null; });
  jurGravar(r);
  if (u.decisao !== "corrigido") delete jcf.decisoes[u.id];
  jcf.i = u.i;
  try { reg("JURIS", "conferir um a um: desfeito", jurTitulo(atual) + " · " + u.decisao); } catch (e) {}
  jcfDepois();
  jcfPintar();
  return true;
}

/* as outras telas acompanham (a biblioteca, a gaveta) */
function jcfDepois() {
  try { if (typeof jurRepintarTelas === "function") jurRepintarTelas(); } catch (e) {}
  try { if (typeof jurPintarLista === "function" && $("dlgJuris") && $("dlgJuris").open) jurPintarLista(); } catch (e) {}
}

function jcfIniciar() {
  if (typeof document === "undefined" || !$("dlgJcf")) return;
  $("btnJcfX").onclick = () => $("dlgJcf").close();
  $("btnJcfAnt").onclick = jcfVoltar;
  $("btnJcfPular").onclick = jcfPular;
  $("btnJcfProblema").onclick = jcfProblema;
  $("btnJcfConfere").onclick = jcfConfere;
  $("btnJcfDesfazer").onclick = jcfDesfazer;
  /* teclado: ← voltar · → pular */
  if ($("dlgJcf").addEventListener) $("dlgJcf").addEventListener("keydown", (ev) => {
    const alvo = ev && ev.target && ev.target.tagName;
    if (/INPUT|TEXTAREA|SELECT/.test(alvo || "")) return;
    if (ev.key === "ArrowRight") { if (ev.preventDefault) ev.preventDefault(); jcfPular(); }
    else if (ev.key === "ArrowLeft") { if (ev.preventDefault) ev.preventDefault(); jcfVoltar(); }
  });
  /* fechar a fila repinta a biblioteca (os selos novos aparecem) */
  if ($("dlgJcf").addEventListener) $("dlgJcf").addEventListener("close", () => { try { if ($("dlgJurBib") && $("dlgJurBib").open && typeof jurBibPintar === "function") jurBibPintar(); } catch (e) {} });
}
