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
  /* (19.145.0) o que a IA disse ao conferir na fonte */
  if (typeof jcfIaVerificacoes === "function") jcfIaVerificacoes(j).forEach((x) => v.push(x));
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
  jcf = { ids: lista, i: 0, decisoes: {}, pilha: [], volta: (opc && opc.volta) || null, ia: null };
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
  /* (19.145.0) a IA conferindo na fonte */
  if (typeof jcfIaPintar === "function") jcfIaPintar(dir, j);
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

/* =====================================================================
 * (19.145.0) A IA CONFERINDO NA FONTE
 *
 * Na fila, "🤖 Conferir com a IA": o pedido leva os dados do julgado (tribunal, classe, número, órgão, relator, data,
 * tese, o começo da ementa e a fonte) e pede que a IA confira em fonte OFICIAL e responda num formato fixo — uma linha
 * por item: PROCESSO, RELATOR, ORGAO, DATA, TESE, EMENTA, VIGENCIA, FONTE. Dois caminhos: copiar o pedido (qualquer
 * IA) e colar a resposta, ou o Gemini direto com a busca do Google (a opção "usar a chave na jurisprudência").
 * NADA É APLICADO SOZINHO: o veredito fica guardado no julgado (iaConf) e aparece nas verificações; os campos que a
 * IA achou (relator, órgão, data, link da fonte) vêm marcados para você aplicar; e o selo continua sendo dado por você,
 * depois de abrir a fonte — a IA pode errar, e a IA sozinha não é fonte.
 * ===================================================================== */
const JCF_IA_TEMPO = 180000;

function jcfIaPedido(j) {
  const ementa = String(j.texto || "").replace(/\s+/g, " ").trim();
  const L = [t("jcf_ia_p_abre"), "",
    t("jcf_ia_p_dados"),
    "- " + t("jcf_ia_p_tribunal") + ": " + (j.tribunal || "—"),
    "- " + t("jcf_ia_p_processo") + ": " + ([j.classe, j.numero].filter(Boolean).join(" ") || "—") + (j.tema ? " (Tema " + j.tema + ")" : ""),
    "- " + t("jcf_ia_p_orgao") + ": " + (j.orgao || "—"),
    "- " + t("jcf_ia_p_relator") + ": " + (j.relator || "—"),
    "- " + t("jcf_ia_p_data") + ": " + (j.data || "—"),
    "- " + t("jcf_ia_p_tese") + ": " + (String(j.tese || "").trim() || "—"),
    "- " + t("jcf_ia_p_ementa") + ": " + (ementa ? ementa.slice(0, 1500) + (ementa.length > 1500 ? " […]" : "") : "—"),
    "- " + t("jcf_ia_p_fonte") + ": " + ([j.fonte, j.fonteUrl].filter((x) => String(x || "").trim()).join(" · ") || "—"),
    "", t("jcf_ia_p_tarefa"), "", t("jcf_ia_p_formato")];
  return L.join("\n");
}

/* a resposta: "CHAVE: situação — detalhe" por linha (aceita negrito, marcador de lista e acento na chave) */
const JCF_IA_CHAVES = { PROCESSO: "processo", RELATOR: "relator", ORGAO: "orgao", DATA: "data", TESE: "tese", EMENTA: "ementa", VIGENCIA: "vigencia", FONTE: "fonte" };
function jcfIaSituacao(chave, v) {
  const n = jcfNormal(v);
  if (/^NAO ACHEI|^NAO ENCONTR|^NAO SEI|^SEM INFORMA/.test(n)) return "nao_achei";
  if (chave === "vigencia") return /^SUPERAD/.test(n) ? "superada" : /^CANCELAD/.test(n) ? "cancelada" : /^VIGENTE|^VALE|^EM VIGOR/.test(n) ? "vigente" : "nao_achei";
  if (chave === "ementa" && /OUTRO PROCESSO|OUTRO JULGADO|DE OUTRO/.test(n)) return "outro";
  if (/^NAO CONFERE|^DIVERG|^DIFERENTE|^ERRAD|^INCORRET/.test(n)) return "diverge";
  if (/^CONFERE|^CORRET|^CONFIRMAD|^OK\b|^SIM\b/.test(n)) return "confere";
  return "";
}
function jcfIaLer(texto) {
  const r = {};
  String(texto || "").split(/\r?\n/).forEach((linha) => {
    const s = linha.replace(/\*\*/g, "").replace(/^\s*(?:[-*•·]|\d{1,2}[.)])\s*/, "").trim();
    const m = s.match(/^([A-Za-zÀ-ú]+)\s*:\s*(.+)$/);
    if (!m) return;
    const chave = JCF_IA_CHAVES[jcfNormal(m[1])];
    if (!chave || r[chave]) return;
    const corpo = m[2].trim();
    const partes = corpo.split(/\s+[—–]\s+|\s+-\s+/);
    const valor = partes[0].trim(), det = partes.slice(1).join(" — ").trim();
    if (chave === "fonte") { const u = corpo.match(/https?:\/\/\S+/); r.fonte = u ? u[0].replace(/[).,;]+$/, "") : ""; return; }
    if (chave === "relator" || chave === "orgao") { r[chave] = { v: /^n[ãa]o achei/i.test(valor) ? "" : valor.replace(/[.;]+$/, ""), det }; return; }
    if (chave === "data") { const d = corpo.match(/(\d{4})-(\d{2})-(\d{2})/) || corpo.match(/(\d{2})\/(\d{2})\/(\d{4})/); r.data = { v: d ? (d[1].length === 4 ? d[0] : d[3] + "-" + d[2] + "-" + d[1]) : "", det }; return; }
    r[chave] = { st: jcfIaSituacao(chave, valor), det: det || (jcfIaSituacao(chave, valor) ? "" : valor) };
  });
  return Object.keys(r).length >= 3 ? r : null;
}

/* guarda o veredito no julgado (fica para as verificações e para a próxima vez) */
function jcfIaGuardar(id, res, via, fontes) {
  if (!res) return null;
  const v = { em: jurHojeISO(), via: via || "colado", processo: (res.processo || {}).st || "", tese: (res.tese || {}).st || "", ementa: (res.ementa || {}).st || "",
    vigencia: (res.vigencia || {}).st || "", det: ["processo", "tese", "ementa", "vigencia"].map((k) => res[k] && res[k].det ? k + ": " + res[k].det : "").filter(Boolean).join(" · ").slice(0, 600),
    fonte: res.fonte || "", fontes: (fontes || []).slice(0, 5) };
  return jurGravar({ id, iaConf: v });
}

/* as linhas que o veredito acrescenta às verificações */
function jcfIaVerificacoes(j) {
  const v = j && j.iaConf;
  if (!v || !v.em) return [];
  const out = [], d = jurDataBr(v.em);
  if (v.processo === "diverge") out.push({ k: "ia_processo", peso: 3, txt: t("jcf_v_ia_processo", { d }) });
  if (v.ementa === "outro" || v.ementa === "diverge") out.push({ k: "ia_ementa", peso: 3, txt: t("jcf_v_ia_ementa", { d }) });
  if (v.tese === "diverge") out.push({ k: "ia_tese", peso: 3, txt: t("jcf_v_ia_tese", { d }) });
  if (v.vigencia === "superada" || v.vigencia === "cancelada") out.push({ k: "ia_vigencia", peso: 3, txt: t("jcf_v_ia_vigencia", { d, s: t("jcf_ia_st_" + v.vigencia) }) });
  if (!out.length && v.processo === "confere" && v.tese === "confere") out.push({ k: "ia_ok", peso: 0, txt: t("jcf_v_ia_ok", { d }) });
  return out;
}

/* ---------------- o painel na fila ---------------- */
function jcfIaPintar(box, j) {
  const ia = jcf.ia && jcf.ia.id === j.id ? jcf.ia : (jcf.ia = { id: j.id, res: null, fontes: [], rascunho: "", msg: "" });
  const det = jcfEl("details", "jcf-ia");
  det.id = "jcfIa";
  det.open = !!(ia.res || ia.rascunho || ia.aberto);
  if (det.addEventListener) det.addEventListener("toggle", () => { ia.aberto = det.open; });
  det.append(jcfEl("summary", "", t("jcf_ia_tit")));
  det.append(jcfEl("p", "nota", t("jcf_ia_expl")));
  const bts = jcfEl("div", "qm-bts");
  const bc = jcfEl("button", "btn-min", t("jcf_ia_copiar")); bc.type = "button"; bc.id = "btnJcfIaCopiar";
  bc.onclick = () => jcfIaCopiar();
  bts.append(bc);
  if (typeof jurIaPronta === "function" && jurIaPronta()) {
    const bg = jcfEl("button", "btn-min btn-min-ok", t("jcf_ia_gemini")); bg.type = "button"; bg.id = "btnJcfIaGemini"; bg.title = t("jcf_ia_gemini_aj");
    bg.onclick = () => jcfIaGemini();
    bts.append(bg);
  } else {
    const bk = jcfEl("button", "btn-link", t("jcf_ia_config")); bk.type = "button"; bk.id = "btnJcfIaConfig";
    bk.onclick = () => { if (typeof vzAbrirChave === "function") vzAbrirChave(); };
    bts.append(bk);
  }
  det.append(bts);
  const ta = jcfEl("textarea", "jcf-ia-resp");
  ta.id = "jcfIaResp"; ta.rows = 4; ta.placeholder = t("jcf_ia_ph"); ta.value = ia.rascunho || "";
  ta.oninput = () => { ia.rascunho = ta.value; };
  det.append(ta);
  const bl = jcfEl("button", "btn-min btn-min-ok", t("jcf_ia_ler")); bl.type = "button"; bl.id = "btnJcfIaLer";
  bl.onclick = () => jcfIaAplicarTexto(($("jcfIaResp") || {}).value || "", "colado", []);
  det.append(bl);
  const msg = jcfEl("p", "nota"); msg.id = "jcfIaMsg"; msg.setAttribute("role", "status"); msg.textContent = ia.msg || "";
  det.append(msg);
  if (ia.res) det.append(jcfIaResultado(j, ia.res, ia.fontes));
  box.append(det);
}
function jcfIaResultado(j, r, fontes) {
  const cx = jcfEl("div", "jcf-ia-res");
  cx.id = "jcfIaRes";
  const ico = (st) => ({ confere: "✓", vigente: "✓", diverge: "✗", outro: "✗", superada: "✗", cancelada: "✗", nao_achei: "?" }[st] || "·");
  const linha = (rot, st, det) => {
    const li = jcfEl("div", "jcf-ia-lin jcf-ia-" + (st || "x"));
    li.append(jcfEl("b", "", ico(st) + " " + rot + ": "), document.createTextNode(t("jcf_ia_st_" + (st || "x")) + (det ? " — " + det : "")));
    cx.append(li);
  };
  if (r.processo) linha(t("jcf_ia_r_processo"), r.processo.st, r.processo.det);
  if (r.ementa) linha(t("jcf_ia_r_ementa"), r.ementa.st, r.ementa.det);
  if (r.tese) linha(t("jcf_ia_r_tese"), r.tese.st, r.tese.det);
  if (r.vigencia) linha(t("jcf_ia_r_vigencia"), r.vigencia.st, r.vigencia.det);
  /* os campos que a IA achou: marcados para aplicar quando o do julgado está vazio */
  const campos = [["relator", r.relator && r.relator.v], ["orgao", r.orgao && r.orgao.v], ["data", r.data && r.data.v], ["fonteUrl", r.fonte]]
    .filter(([k, v]) => v && String(v).trim() && String(v).trim() !== String(j[k] || "").trim());
  if (campos.length) {
    cx.append(jcfEl("div", "jcf-rot2", t("jcf_ia_campos")));
    campos.forEach(([k, v]) => {
      const lab = jcfEl("label", "diag-op jcf-ia-campo");
      const c = jcfEl("input", ""); c.type = "checkbox"; c.id = "jcfIaUsar_" + k; c.checked = !String(j[k] || "").trim(); c.dataset.v = v;
      lab.append(c, " ", jcfEl("span", "", t("jcf_c_" + (k === "fonteUrl" ? "fonte_url" : k)).replace(/\s*\(.*\)$/, "") + ": " + v + (String(j[k] || "").trim() ? " " + t("jcf_ia_antes", { a: j[k] }) : "")));
      cx.append(lab);
    });
    const ba = jcfEl("button", "btn-min btn-min-ok", t("jcf_ia_aplicar")); ba.type = "button"; ba.id = "btnJcfIaAplicar";
    ba.onclick = () => jcfIaAplicarCampos();
    cx.append(ba);
  }
  const lks = [r.fonte].concat((fontes || []).map((f) => f.url)).filter(Boolean).filter((u, i, a) => a.indexOf(u) === i).slice(0, 5);
  if (lks.length) {
    cx.append(jcfEl("div", "jcf-rot2", t("jcf_ia_fontes")));
    const lb = jcfEl("div", "jcf-links");
    lks.forEach((u, i) => { const a = jcfEl("a", "btn-min jur-oficial-lnk", "↗ " + (u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; a.id = "jcfIaFonte_" + i; lb.append(a); });
    cx.append(lb);
  }
  cx.append(jcfEl("p", "nota", t("jcf_ia_lembrete")));
  return cx;
}

function jcfIaAplicarTexto(texto, via, fontes) {
  const j = jcfAtual();
  if (!j) return null;
  const res = jcfIaLer(texto);
  if (!res) { jcf.ia = Object.assign(jcf.ia || { id: j.id }, { id: j.id, msg: t("jcf_ia_nada"), rascunho: texto }); jcfPintar(); return null; }
  jcfIaGuardar(j.id, res, via, fontes);
  jcf.ia = { id: j.id, res, fontes: fontes || [], rascunho: texto, msg: t("jcf_ia_lida"), aberto: true };
  try { reg("JURIS", "conferir um a um: resposta da IA lida", jurTitulo(j) + " · " + via + " · processo " + ((res.processo || {}).st || "?") + ", tese " + ((res.tese || {}).st || "?")); } catch (e) {}
  jcfDepois();
  jcfPintar();
  return res;
}
function jcfIaAplicarCampos() {
  const j = jcfAtual();
  if (!j) return 0;
  const mud = { id: j.id };
  ["relator", "orgao", "data", "fonteUrl"].forEach((k) => { const c = $("jcfIaUsar_" + k); if (c && c.checked) mud[k] = c.dataset.v; });
  if (Object.keys(mud).length === 1) return 0;
  jcf.pilha.push({ id: j.id, antes: JSON.parse(JSON.stringify(j)), decisao: "corrigido", i: jcf.i });
  jurGravar(mud);
  try { reg("JURIS", "conferir um a um: campos da IA aplicados", jurTitulo(j) + " · " + Object.keys(mud).filter((k) => k !== "id").join(", ")); } catch (e) {}
  jcfDepois();
  jcfPintar();
  if ($("jcfMsg")) $("jcfMsg").textContent = t("jcf_corr_ok", { n: Object.keys(mud).length - 1 });
  return Object.keys(mud).length - 1;
}
async function jcfIaCopiar() {
  const j = jcfAtual();
  if (!j) return false;
  const p = jcfIaPedido(j);
  let ok = false;
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(p); ok = true; } } catch (e) { ok = false; }
  jcf.ia = Object.assign(jcf.ia && jcf.ia.id === j.id ? jcf.ia : { id: j.id }, { msg: ok ? t("jcf_ia_copiado") : t("led_ia_nao_copiou"), aberto: true });
  if ($("jcfIaMsg")) $("jcfIaMsg").textContent = jcf.ia.msg;
  try { reg("JURIS", "conferir um a um: pedido à IA copiado", jurTitulo(j)); } catch (e) {}
  return ok ? p : false;
}
async function jcfIaGemini() {
  const j = jcfAtual();
  if (!j || typeof jurIaPerguntar !== "function") return null;
  if ($("btnJcfIaGemini")) $("btnJcfIaGemini").disabled = true;
  if ($("jcfIaMsg")) $("jcfIaMsg").textContent = t("jcf_ia_esperando");
  try {
    const r = await jurIaPerguntar(jcfIaPedido(j), { modulo: "JURIS", busca: true, tempo: JCF_IA_TEMPO });
    return jcfIaAplicarTexto(r.texto, "gemini", r.fontes || []);
  } catch (e) {
    const cod = (e && e.codigo) || "rede";
    jcf.ia = Object.assign(jcf.ia && jcf.ia.id === j.id ? jcf.ia : { id: j.id }, { msg: t("jur_ia_erro_" + cod) + (e && e.detalhe && cod !== "cancelado" ? " (" + e.detalhe + ")" : ""), aberto: true });
    if ($("jcfIaMsg")) $("jcfIaMsg").textContent = jcf.ia.msg;
    try { reg("JURIS", "conferir um a um: Gemini falhou", cod); } catch (x) {}
    return null;
  } finally {
    if ($("btnJcfIaGemini")) $("btnJcfIaGemini").disabled = false;
  }
}
