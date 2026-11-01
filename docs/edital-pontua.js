/* =====================================================================
 * COMO A PROVA PONTUA (19.55.0)
 *
 * O PEDIDO: "a correção via texto é muito complexa para quem não conhece o app. Criar interface de botões e
 * marcadores, com campo para o mínimo por disciplina ou grupo, que possa ser preenchido pela IA. O usuário não deve
 * quebrar a cabeça com isso; deve focar em estudar."
 *
 * O QUE ERA: nota mínima e peso real só entravam escrevendo "& Grupo | minimo: 50%" e "@ Português :: 10q" no meio
 * de um texto de 130 tópicos — e uma linha fora do lugar sumia com disciplinas.
 *
 * O QUE É: uma janela com duas perguntas e uma tabela, uma linha por disciplina:
 *   1. "O edital diz quantas questões (ou pontos) tem cada disciplina?" — sim: número e "questões/pontos";
 *   2. "Tem nota mínima para não ser eliminado?" — sim: o mínimo de cada disciplina, ou "junto com" um grupo
 *      (que tem o seu próprio mínimo).
 * Embaixo, a regra em frases ("Você é eliminado se fizer menos de 50% em Português") e quanto cada disciplina vale.
 * "🤖 Preencher com IA" copia um pedido curto (só pontuação, com a lista exata das disciplinas) e lê a resposta de
 * volta para a tabela — para conferir, nunca aplicado direto.
 *
 * GRAVAR MEXE SÓ NO QUE FOI PERGUNTADO: o peso de cada linha "@" e as linhas "&". Os tópicos, os ramos, os motivos,
 * o cabeçalho e o progresso ficam como estavam. Grupo com disciplinas espalhadas no texto: as disciplinas do grupo
 * passam a ficar juntas (o texto exige), levando cada uma os seus tópicos.
 * ===================================================================== */
let epCtx = null;

/* o estado da janela a partir do texto do edital */
function epEstado(texto) {
  const r = lerEdital(texto || "");
  const ds = (r.disciplinas || []).map((d) => ({ nome: d.nome, peso: d.peso, abs: d.abs || 0, unidade: d.unidade || "q", grupo: "", min: null }));
  const grupos = [];
  (r.blocos || []).forEach((b) => {
    const membros = (b.disciplinas || []).filter((n) => ds.some((d) => d.nome === n));
    if (!membros.length) return;
    if (membros.length === 1 && membros[0] === b.nome) {
      /* bloco de uma disciplina só, com o nome dela: é o mínimo DELA */
      const d = ds.find((x) => x.nome === b.nome);
      if (d) d.min = b.minimo || null;
      return;
    }
    grupos.push({ nome: b.nome, min: b.minimo || null });
    membros.forEach((n) => { const d = ds.find((x) => x.nome === n); if (d) d.grupo = b.nome; });
  });
  const temAbs = ds.length > 0 && ds.every((d) => d.abs > 0);
  const temMin = grupos.some((g) => g.min) || ds.some((d) => d.min);
  /* (19.56.0) a discursiva: o que já está no cabeçalho "# discursiva | …" */
  const dc = (r.cfg && r.cfg.discursiva) || null;
  const disc = { pontos: dc ? dc.pontos : 0, objetiva: dc ? dc.objetiva : 0, minimo: dc ? dc.minimo : null,
    linhas: dc && dc.linhas ? { min: dc.linhas.min, max: dc.linhas.max } : null, corrigida: dc ? dc.corrigida : 0,
    disciplinas: dc ? (dc.disciplinas || []).slice() : [] };
  return { r, ds, grupos, peso: temAbs ? "sim" : "nao", minimo: temMin ? "sim" : "nao", disc, discursiva: dc ? "sim" : "nao" };
}

function epAbrir() {
  const dlg = $("dlgEdPontua");
  if (!dlg || !$("editalTexto")) return false;
  epCtx = epEstado($("editalTexto").value);
  if (!epCtx.ds.length) { try { uiAlert(t("ep_sem_disc")); } catch (e) {} return false; }
  if ($("epIaResp")) $("epIaResp").value = "";
  if ($("epIaBox")) $("epIaBox").open = false;
  if ($("epMsg")) $("epMsg").textContent = "";
  epPintar();
  abrirModal("dlgEdPontua");
  try { reg("EDITAL", "como a prova pontua: aberto", epCtx.ds.length + " disciplinas"); } catch (e) {}
  return true;
}

/* "50%" · "5 acertos" */
function epMinTexto(m) {
  if (!m) return "";
  return m.tipo === "pct" ? String(m.valor).replace(".", ",") + "%" : t("ep_acertos_n", { n: m.valor });
}

function epPintar() {
  const c = epCtx;
  if (!c) return;
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  ["sim", "nao"].forEach((v) => {
    if ($("epPeso_" + v)) $("epPeso_" + v).checked = c.peso === v;
    if ($("epMin_" + v)) $("epMin_" + v).checked = c.minimo === v;
    if ($("epDisc_" + v)) $("epDisc_" + v).checked = c.discursiva === v;
  });
  epPintarDiscursiva();
  const tb = $("epTabela");
  tb.innerHTML = "";
  const cab = el("div", "ep-lin ep-cab");
  cab.append(el("span", "ep-c-nome", t("ep_col_disc")));
  if (c.peso === "sim") cab.append(el("span", "ep-c-vale", t("ep_col_vale")));
  if (c.minimo === "sim") cab.append(el("span", "ep-c-min", t("ep_col_min")));
  tb.append(cab);
  c.ds.forEach((d, k) => {
    const lin = el("div", "ep-lin");
    lin.append(el("span", "ep-c-nome", d.nome));
    if (c.peso === "sim") {
      const v = el("span", "ep-c-vale");
      const n = document.createElement("input");
      n.type = "number"; n.min = "0"; n.step = "1"; n.id = "epVale_" + k; n.className = "ep-num";
      n.value = d.abs > 0 ? String(d.abs) : "";
      n.oninput = () => { d.abs = Number(n.value) || 0; epResumo(); };
      const u = document.createElement("select");
      u.id = "epUni_" + k;
      [["q", t("ep_questoes")], ["p", t("ep_pontos")]].forEach(([val, txt]) => { const o = document.createElement("option"); o.value = val; o.textContent = txt; u.append(o); });
      u.value = d.unidade === "p" ? "p" : "q";
      u.onchange = () => { d.unidade = u.value; c.ds.forEach((x) => { x.unidade = u.value; }); epPintar(); };
      v.append(n, u);
      lin.append(v);
    }
    if (c.minimo === "sim") {
      /* (19.56.0) disciplina num bloco mostra o bloco (o mínimo é do bloco); fora de bloco, o mínimo próprio */
      const m = el("span", "ep-c-min");
      if (d.grupo) m.append(el("span", "ep-no-bloco", t("ep_no_bloco", { g: d.grupo })));
      else m.append(epCampoMin("epMinD_" + k, d.min, (nm) => { d.min = nm; epResumo(); }));
      lin.append(m);
    }
    tb.append(lin);
  });
  /* (19.56.0) OS BLOCOS, À VISTA: o mínimo de um conjunto de disciplinas ("Conhecimentos Específicos: 50%") era
   * escondido numa lista dentro de cada linha. Agora é uma seção própria: "+ criar bloco", o nome, o mínimo do bloco
   * e uma caixa por disciplina para marcar quem faz parte. */
  const gx = $("epGrupos");
  gx.innerHTML = "";
  gx.hidden = c.minimo !== "sim";
  if (!gx.hidden) {
    gx.append(el("div", "ep-sub-tit", t("ep_blocos_tit")));
    gx.append(el("p", "nota", t("ep_blocos_aj")));
    c.grupos.forEach((gr, k) => {
      const bx = el("div", "ep-bloco");
      bx.id = "epBloco_" + k;
      const topo = el("div", "ep-bloco-topo");
      const nm = document.createElement("input");
      nm.type = "text"; nm.id = "epGrupoNome_" + k; nm.className = "ep-gnome"; nm.value = gr.nome;
      nm.setAttribute("aria-label", t("ep_bloco_nome"));
      nm.onchange = () => {
        const novo = String(nm.value || "").replace(/[|&@#]/g, "").trim();
        if (!novo || c.grupos.some((x) => x !== gr && x.nome === novo)) { nm.value = gr.nome; return; }
        c.ds.forEach((d) => { if (d.grupo === gr.nome) d.grupo = novo; });
        gr.nome = novo; epPintar();
      };
      const rotMin = el("span", "ep-bloco-rot", t("ep_bloco_min"));
      const tira = el("button", "btn-min", t("ep_bloco_tirar"));
      tira.type = "button"; tira.id = "btnEpBlocoTirar_" + k;
      tira.onclick = () => { c.ds.forEach((d) => { if (d.grupo === gr.nome) d.grupo = ""; }); c.grupos = c.grupos.filter((x) => x !== gr); epPintar(); };
      topo.append(nm, rotMin, epCampoMin("epMinG_" + k, gr.min, (m2) => { gr.min = m2; epResumo(); }), tira);
      bx.append(topo);
      const marcas = el("div", "ep-bloco-discs");
      c.ds.forEach((d, j) => {
        const l = el("label", "ep-bloco-d" + (d.grupo && d.grupo !== gr.nome ? " ep-outro" : ""));
        const ck = document.createElement("input");
        ck.type = "checkbox"; ck.id = "epBlocoD_" + k + "_" + j;
        ck.checked = d.grupo === gr.nome;
        ck.onchange = () => { d.grupo = ck.checked ? gr.nome : ""; if (ck.checked) d.min = null; epPintar(); };
        l.append(ck, el("span", "", hubDiscCurtaSeg(d.nome) + (d.grupo && d.grupo !== gr.nome ? " (" + d.grupo + ")" : "")));
        marcas.append(l);
      });
      bx.append(marcas);
      gx.append(bx);
    });
    const novo = el("button", "btn-min btn-min-ok", t("ep_bloco_criar"));
    novo.type = "button"; novo.id = "btnEpBlocoCriar";
    novo.onclick = () => epCriarBloco();
    gx.append(novo);
  }
  epResumo();
}

function hubDiscCurtaSeg(d) { return typeof hubDiscCurta === "function" ? hubDiscCurta(d) : d; }

/* o campo do mínimo: número + "%" ou "acertos" */
function epCampoMin(id, m, aoMudar) {
  const w = document.createElement("span");
  w.className = "ep-mincampo";
  const n = document.createElement("input");
  n.type = "number"; n.min = "0"; n.step = "any"; n.id = id; n.className = "ep-num";
  n.placeholder = t("ep_min_ph");
  n.value = m && m.valor != null ? String(m.valor) : "";
  const u = document.createElement("select");
  u.id = id + "_u";
  [["pct", "%"], ["abs", t("ep_acertos")]].forEach(([val, txt]) => { const o = document.createElement("option"); o.value = val; o.textContent = txt; u.append(o); });
  u.value = m && m.tipo === "abs" ? "abs" : "pct";
  const ler = () => { const v = Number(String(n.value).replace(",", ".")); aoMudar(v > 0 ? { tipo: u.value, valor: v } : null); };
  n.oninput = ler; u.onchange = ler;
  w.append(n, u);
  return w;
}

/* "+ criar bloco": pergunta o nome (com a sugestão mais comum) e abre o bloco vazio para marcar as disciplinas */
async function epCriarBloco(nomeDado) {
  const c = epCtx;
  if (!c) return false;
  const nome = nomeDado !== undefined ? nomeDado : await uiTexto(t("ep_novo_grupo_pergunta"), c.grupos.length ? "" : t("ep_novo_grupo_sug"));
  const n = String(nome || "").replace(/[|&@#]/g, "").trim();
  if (!n || c.grupos.some((g) => g.nome === n)) { epPintar(); return false; }
  c.grupos.push({ nome: n, min: null });
  epPintar();
  return true;
}

async function epTrocarGrupo(d, val) {
  const c = epCtx;
  if (val === "+") {
    const nome = await uiTexto(t("ep_novo_grupo_pergunta"), t("ep_novo_grupo_sug"));
    const n = String(nome || "").replace(/[|&@#]/g, "").trim();
    if (!n) { epPintar(); return; }
    if (!c.grupos.some((g) => g.nome === n)) c.grupos.push({ nome: n, min: d.min || null });
    d.grupo = n; d.min = null;
  } else if (val.indexOf("g:") === 0) { d.grupo = val.slice(2); d.min = null; }
  else d.grupo = "";
  epPintar();
}

/* a regra em frases, e quanto cada disciplina vale (do edital ou estimado) */
function epResumo() {
  const c = epCtx, cx = $("epResumo");
  if (!c || !cx) return [];
  const frases = [];
  if (c.minimo === "sim") {
    c.grupos.forEach((g) => {
      const ms = c.ds.filter((d) => d.grupo === g.nome).map((d) => d.nome);
      if (g.min) frases.push(t("ep_frase_grupo", { g: g.nome, d: ms.map(hubDiscCurtaSeg).join(", "), m: epMinTexto(g.min) }));
      else frases.push(t("ep_frase_grupo_sem", { g: g.nome }));
    });
    c.ds.filter((d) => !d.grupo).forEach((d) => frases.push(d.min ? t("ep_frase_disc", { d: d.nome, m: epMinTexto(d.min) }) : t("ep_frase_disc_sem", { d: d.nome })));
  } else frases.push(t("ep_frase_sem_min"));
  if (c.peso === "sim") {
    const tot = c.ds.reduce((a, d) => a + (d.abs || 0), 0);
    const falta = c.ds.filter((d) => !(d.abs > 0)).map((d) => d.nome);
    if (falta.length) frases.push(t("ep_frase_falta_vale", { d: falta.join(", ") }));
    else frases.push(t("ep_frase_vale", { l: c.ds.map((d) => hubDiscCurtaSeg(d.nome) + " " + Math.round(d.abs / (tot || 1) * 100) + "%").join(" · ") }));
  } else frases.push(t("ep_frase_estimado"));
  /* a discursiva: quanto vale da nota final, onde cai e o que elimina */
  if (c.discursiva === "sim") {
    const dd = c.disc, obj = epObjetivaPontos();
    if (dd.pontos > 0 && obj > 0) frases.push(t("ep_frase_disc_vale", { s: Math.round(dd.pontos / (obj + dd.pontos) * 100), p: dd.pontos, t: obj + dd.pontos }));
    else frases.push(t("ep_frase_disc_falta"));
    if (dd.disciplinas.length) frases.push(t("ep_frase_disc_cai", { d: dd.disciplinas.map(hubDiscCurtaSeg).join(", ") }));
    else frases.push(t("ep_frase_disc_sem_disc"));
    if (dd.minimo) frases.push(t("ep_frase_disc_min", { m: epMinTexto(dd.minimo) }));
    if (dd.linhas && dd.linhas.min && dd.linhas.max) frases.push(t("ep_frase_disc_linhas", { a: dd.linhas.min, b: dd.linhas.max }));
    if (dd.corrigida > 0) frases.push(t("ep_frase_disc_corrigida", { n: dd.corrigida }));
  }
  cx.innerHTML = "";
  frases.forEach((f) => { const p = document.createElement("li"); p.textContent = f; cx.append(p); });
  return frases;
}

/* ---------------- a discursiva (pergunta 3) ---------------- */
/* os pontos da objetiva: o que a pessoa digitou ou, com todas as disciplinas em pontos, a soma delas */
function epObjetivaPontos() {
  const c = epCtx;
  if (!c) return 0;
  if (c.disc && c.disc.objetiva > 0) return c.disc.objetiva;
  if (c.peso === "sim" && c.ds.every((d) => d.abs > 0 && d.unidade === "p")) return c.ds.reduce((a, d) => a + d.abs, 0);
  return 0;
}
function epPintarDiscursiva() {
  const c = epCtx, cx = $("epDiscCx");
  if (!c || !cx) return;
  cx.innerHTML = "";
  cx.hidden = c.discursiva !== "sim";
  if (cx.hidden) return;
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const dd = c.disc;
  const campo = (id, rot, val, aoMudar, ph) => {
    const l = el("label", "ep-disc-campo");
    l.append(el("span", "", rot));
    const n = document.createElement("input");
    n.type = "number"; n.min = "0"; n.step = "1"; n.id = id; n.className = "ep-num";
    if (ph) n.placeholder = ph;
    n.value = val > 0 ? String(val) : "";
    n.oninput = () => { aoMudar(Number(n.value) || 0); epResumo(); };
    l.append(n);
    return l;
  };
  const lin1 = el("div", "ep-disc-lin");
  lin1.append(
    campo("epDiscPontos", t("ep_disc_pontos"), dd.pontos, (v) => { dd.pontos = v; }),
    campo("epDiscObj", t("ep_disc_obj"), dd.objetiva || epObjetivaPontos(), (v) => { dd.objetiva = v; }, t("ep_disc_obj_ph")));
  const lm = el("label", "ep-disc-campo");
  lm.append(el("span", "", t("ep_disc_min")), epCampoMin("epDiscMin", dd.minimo, (m) => { dd.minimo = m; epResumo(); }));
  lin1.append(lm);
  cx.append(lin1);
  const lin2 = el("div", "ep-disc-lin");
  lin2.append(
    campo("epDiscLinMin", t("ep_disc_lin_min"), dd.linhas ? dd.linhas.min : 0, (v) => { dd.linhas = Object.assign({ min: 0, max: 0 }, dd.linhas || {}, { min: v }); }),
    campo("epDiscLinMax", t("ep_disc_lin_max"), dd.linhas ? dd.linhas.max : 0, (v) => { dd.linhas = Object.assign({ min: 0, max: 0 }, dd.linhas || {}, { max: v }); }),
    campo("epDiscCorr", t("ep_disc_corrigida"), dd.corrigida, (v) => { dd.corrigida = v; }, t("ep_disc_corrigida_ph")));
  cx.append(lin2);
  cx.append(el("div", "ep-sub-tit", t("ep_disc_onde")));
  const marcas = el("div", "ep-bloco-discs");
  c.ds.forEach((d, j) => {
    const l = el("label", "ep-bloco-d");
    const ck = document.createElement("input");
    ck.type = "checkbox"; ck.id = "epDiscD_" + j;
    ck.checked = dd.disciplinas.some((n) => n.toLowerCase() === d.nome.toLowerCase());
    ck.onchange = () => {
      dd.disciplinas = dd.disciplinas.filter((n) => n.toLowerCase() !== d.nome.toLowerCase());
      if (ck.checked) dd.disciplinas.push(d.nome);
      epResumo();
    };
    l.append(ck, el("span", "", hubDiscCurtaSeg(d.nome)));
    marcas.append(l);
  });
  cx.append(marcas);
}

/* ---------------- gravar: só os pesos das linhas "@" e as linhas "&" ---------------- */
function epNovoTexto(texto, c) {
  const L = String(texto || "").split("\n");
  const pre = [], blocos = [];
  let atual = null;
  L.forEach((ln) => {
    if (/^\s*&/.test(ln)) return;                          /* os "&" antigos saem; os novos são escritos abaixo */
    if (/^\s*@/.test(ln)) { atual = { linhas: [ln] }; blocos.push(atual); return; }
    if (atual) atual.linhas.push(ln); else pre.push(ln);
  });
  const nomeDe = (ln) => { const m = ln.match(/^\s*@\s*(.+?)\s*(?:::|$)/); return m ? m[1].trim() : ""; };
  /* (19.58.0) "| minimo:" na linha "@" sai: o mínimo é escrito abaixo, num bloco "&" só dela */
  blocos.forEach((b) => { b.linhas[0] = b.linhas[0].replace(/\s*\|\s*m[íi]nimo\s*:\s*[^|]*/i, ""); });
  blocos.forEach((b) => { b.nome = nomeDe(b.linhas[0]); b.d = c.ds.find((d) => d.nome === b.nome) || null; });
  /* o peso: "10q"/"20p" quando o edital diz; senão, o que já estava */
  blocos.forEach((b) => {
    if (!b.d) return;
    const m = b.linhas[0].match(/^(\s*@\s*.+?\s*::\s*)([^|]*?)(\s*\|.*)?$/);
    let novo = null;
    if (c.peso === "sim" && b.d.abs > 0) novo = String(b.d.abs) + (b.d.unidade === "p" ? "p" : "q");
    else if (c.peso === "nao" && /^\s*\d+(?:[.,]\d+)?\s*[qp]\s*$/i.test(m ? m[2] : "")) novo = String(b.d.peso || 3);
    if (m && novo !== null) b.linhas[0] = m[1] + novo + (m[3] || "");
    else if (!m && novo !== null) b.linhas[0] = b.linhas[0].replace(/\s*$/, "") + " :: " + novo;
  });
  /* a ordem: primeiro as disciplinas sem mínimo; depois cada grupo (juntas) e cada disciplina com mínimo próprio */
  const comMin = (b) => c.minimo === "sim" && b.d && (b.d.grupo || b.d.min);
  const fora = blocos.filter((b) => !comMin(b));
  /* (19.56.0) a linha "# discursiva" mora no cabeçalho: sai a velha, entra a nova logo depois do primeiro "#" */
  const preD = pre.filter((ln) => !/^\s*#\s*discursiva\s*(\||$)/i.test(ln));
  if (c.discursiva === "sim" && c.disc && c.disc.pontos > 0 && typeof edLinhaDiscursiva === "function") {
    const obj = epObjetivaPontos();
    const linha = edLinhaDiscursiva(Object.assign({}, c.disc, { objetiva: c.disc.objetiva || obj }));
    const k = preD.findIndex((ln) => /^\s*#/.test(ln));
    let fim = k;
    while (fim >= 0 && fim + 1 < preD.length && /^\s*#/.test(preD[fim + 1])) fim++;
    if (k >= 0) preD.splice(fim + 1, 0, linha); else preD.unshift(linha);
  }
  const saida = preD;
  fora.forEach((b) => saida.push(...b.linhas));
  const feitos = new Set();
  const minTxt = (m) => (m.tipo === "pct" ? m.valor + "%" : String(m.valor));
  blocos.filter(comMin).forEach((b) => {
    if (feitos.has(b)) return;
    if (b.d.grupo) {
      const g = c.grupos.find((x) => x.nome === b.d.grupo);
      saida.push("& " + b.d.grupo + (g && g.min ? " | minimo: " + minTxt(g.min) : ""));
      blocos.filter((x) => comMin(x) && x.d.grupo === b.d.grupo).forEach((x) => { saida.push(...x.linhas); feitos.add(x); });
    } else {
      saida.push("& " + b.d.nome + " | minimo: " + minTxt(b.d.min));
      saida.push(...b.linhas);
      feitos.add(b);
    }
  });
  return saida.join("\n").replace(/\n{3,}/g, "\n\n");
}

function epGravar() {
  const c = epCtx;
  if (!c) return false;
  const msg = $("epMsg");
  /* bloco sem disciplina marcada não vai para o texto */
  c.grupos = c.grupos.filter((g) => c.ds.some((x) => x.grupo === g.nome));
  if (c.minimo === "sim" && c.grupos.some((g) => !g.min)) { if (msg) msg.textContent = t("ep_bloco_sem_min"); return false; }
  if (c.discursiva === "sim" && (!(c.disc.pontos > 0) || !(epObjetivaPontos() > 0) || !c.disc.disciplinas.length)) { if (msg) msg.textContent = t("ep_disc_incompleta"); return false; }
  if (c.peso === "sim" && c.ds.some((d) => !(d.abs > 0))) { if (msg) msg.textContent = t("ep_falta_vale"); return false; }
  const antes = $("editalTexto").value;
  const novo = epNovoTexto(antes, c);
  /* a garantia: os tópicos e os ramos são os mesmos, só a ordem das disciplinas pode mudar */
  const conta = (tx) => { const r = lerEdital(tx); return r.disciplinas.length + "|" + r.disciplinas.reduce((a, d) => a + d.topicos.length + d.topicos.reduce((b, tp) => b + ((tp.ramos || []).length), 0), 0); };
  if (conta(novo) !== conta(antes)) { if (msg) msg.textContent = t("ep_erro_conta"); try { reg("EDITAL", "como a prova pontua: gravação recusada (tópicos não batem)", ""); } catch (e) {} return false; }
  $("editalTexto").value = novo;
  try { edSalvar(); } catch (e) {}
  /* "não tem" também é resposta: tira o item da conferência */
  const id = typeof editalAtual !== "undefined" ? editalAtual : "";
  try {
    if (c.minimo === "nao" && typeof edConfDispensar === "function") edConfDispensar(id, "corte");
    if (c.peso === "nao" && typeof edConfDispensar === "function") edConfDispensar(id, "pesos");
    if (c.discursiva === "nao" && typeof edConfDispensar === "function") edConfDispensar(id, "discursiva");
  } catch (e) {}
  try { reg("EDITAL", "como a prova pontua: gravado", (epResumo() || []).join(" · ")); } catch (e) {}
  try { $("dlgEdPontua").close(); } catch (e) {}
  try { if (typeof edRender === "function") edRender(); } catch (e) {}
  try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
  try { toastMsg(t("ep_gravado"), 4000); } catch (e) {}
  return true;
}

/* (19.56.0) A REVISÃO COM IA NÃO APAGA OS CORTES. Um plano refeito pela IA (a partir do edital oficial, ou corrigido) pode
 * voltar sem as linhas "&" e sem os "10q" — a IA não recebeu o trecho de pontuação, ou só esqueceu. O que foi cadastrado
 * em "⚖ Pontuação e cortes" é a fonte: se o plano novo não traz cortes (ou números) e o antigo trazia, eles são levados
 * para o novo, disciplina por disciplina (pelo nome). Plano novo que JÁ traz cortes ou números manda — é uma decisão. */
function edManterPontuacao(antigo, novo) {
  const ea = epEstado(antigo), en = epEstado(novo);
  const out = { txt: novo, cortes: false, pesos: false, discursiva: false };
  if (!ea.ds.length || !en.ds.length) return out;
  const k = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const velho = {};
  ea.ds.forEach((d) => { velho[k(d.nome)] = d; });
  if (ea.minimo === "sim" && en.minimo === "nao") {
    en.ds.forEach((d) => { const v = velho[k(d.nome)]; if (v) { d.grupo = v.grupo; d.min = v.min; } });
    en.grupos = ea.grupos.filter((g) => en.ds.some((d) => d.grupo === g.nome)).map((g) => ({ nome: g.nome, min: g.min }));
    if (en.grupos.some((g) => g.min) || en.ds.some((d) => d.min)) { en.minimo = "sim"; out.cortes = true; }
  }
  if (ea.peso === "sim" && en.peso === "nao" && en.ds.every((d) => velho[k(d.nome)] && velho[k(d.nome)].abs > 0)) {
    en.ds.forEach((d) => { const v = velho[k(d.nome)]; d.abs = v.abs; d.unidade = v.unidade; });
    en.peso = "sim"; out.pesos = true;
  }
  /* (19.56.0) a discursiva também: o pedido de revisão não a conhece, então o plano devolvido vem sem a linha
   * "# discursiva" — ela é levada do atual (com as disciplinas que ainda existirem no novo) */
  if (ea.discursiva === "sim" && en.discursiva === "nao" && ea.disc.pontos > 0) {
    const novas = ea.disc.disciplinas.map((n) => (en.ds.find((d) => k(d.nome) === k(n)) || {}).nome).filter(Boolean);
    if (novas.length) { en.disc = Object.assign({}, ea.disc, { disciplinas: novas }); en.discursiva = "sim"; out.discursiva = true; }
  }
  if (out.cortes || out.pesos || out.discursiva) out.txt = epNovoTexto(novo, en);
  return out;
}

/* ---------------- preencher com IA ---------------- */
function epPromptIA() {
  const c = epCtx;
  if (!c) return "";
  return t("ep_ia_pedido", { l: c.ds.map((d) => "- " + d.nome).join("\n") });
}
function epCopiarIA() {
  const txt = epPromptIA();
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {}
  try { toastMsg(t("ep_ia_copiado"), 6000); } catch (e) {}
  return txt;
}
/* lê "Disciplina | questões | pontos | mínimo | grupo" e preenche a tabela (para conferir) */
function epLerIA(txt) {
  const c = epCtx;
  if (!c) return { lidas: 0, avisos: [] };
  const nomes = c.ds.map((d) => d.nome);
  const achar = (x) => (typeof hubIaAcharDisc === "function" ? hubIaAcharDisc(x, nomes) : (nomes.find((n) => n.toLowerCase() === String(x).trim().toLowerCase()) || ""));
  const num = (x) => { const m = String(x || "").match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : 0; };
  const avisos = [];
  let lidas = 0, comVale = 0, comPontos = 0;
  const minimos = {};
  String(txt || "").split(/\r?\n/).forEach((ln0) => {
    const ln = ln0.replace(/\*\*/g, "").replace(/^[-•*·]\s*/, "").trim();
    if (!ln || ln.indexOf("|") < 0) return;
    const p = ln.split("|").map((x) => x.trim());
    if (/^disciplina$/i.test(p[0])) return;
    /* (19.56.0) "Discursiva | pontos | objetiva | mínimo | linhas | corrigida | disciplinas (;)" */
    if (/^discursiva$/i.test(p[0])) {
      const dd = c.disc;
      if (num(p[1]) > 0) dd.pontos = num(p[1]);
      if (num(p[2]) > 0) dd.objetiva = num(p[2]);
      if (num(p[3]) > 0) dd.minimo = { tipo: "pct", valor: num(p[3]) };
      const ml = String(p[4] || "").match(/(\d+)\D+(\d+)/);
      if (ml) dd.linhas = { min: Number(ml[1]), max: Number(ml[2]) };
      if (num(p[5]) > 0) dd.corrigida = num(p[5]);
      const ds2 = String(p[6] || "").split(/[;,]/).map((x) => achar(x.trim())).filter(Boolean);
      if (ds2.length) dd.disciplinas = ds2;
      if (dd.pontos > 0) c.discursiva = "sim";
      lidas++;
      return;
    }
    const d0 = achar(p[0]);
    if (!d0) { avisos.push(t("ep_ia_av_disc", { d: p[0] })); return; }
    const d = c.ds.find((x) => x.nome === d0);
    const q = num(p[1]), pt = num(p[2]);
    if (pt > 0) { d.abs = pt; d.unidade = "p"; comPontos++; comVale++; }
    else if (q > 0) { d.abs = q; d.unidade = "q"; comVale++; }
    const mtx = (p[3] || "").trim();
    let min = null;
    if (/%/.test(mtx) && num(mtx) > 0) min = { tipo: "pct", valor: num(mtx) };
    else if (num(mtx) > 0 && /acert|quest/i.test(mtx)) min = { tipo: "abs", valor: num(mtx) };
    else if (num(mtx) > 0) min = { tipo: "pct", valor: num(mtx) };
    const g = (p[4] || "").replace(/^-+$/, "").replace(/[|&@#]/g, "").trim();
    if (g && !/^(nenhum|n[aã]o|sem)$/i.test(g)) {
      d.grupo = g; d.min = null;
      if (!c.grupos.some((x) => x.nome === g)) c.grupos.push({ nome: g, min: null });
      if (min) minimos[g] = min;
    } else { d.grupo = ""; d.min = min; }
    lidas++;
  });
  c.grupos.forEach((g) => { if (minimos[g.nome]) g.min = minimos[g.nome]; });
  c.grupos = c.grupos.filter((g) => c.ds.some((x) => x.grupo === g.nome));
  /* questões e pontos misturados não somam: se veio algum em pontos, quem veio só em questões fica sem número */
  if (comPontos && comPontos < comVale) avisos.push(t("ep_ia_av_misto"));
  if (comVale && comVale === c.ds.length) c.peso = "sim";
  else if (comVale) avisos.push(t("ep_ia_av_parcial", { n: comVale, t: c.ds.length }));
  if (c.grupos.some((g) => g.min) || c.ds.some((d) => d.min)) c.minimo = "sim";
  epPintar();
  if ($("epMsg")) $("epMsg").textContent = lidas ? t("ep_ia_lido", { n: lidas }) + (avisos.length ? " " + avisos.join(" ") : "") : t("ep_ia_nada");
  return { lidas, avisos };
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("dlgEdPontua")) {
  const lig = (id, fn) => { const x = document.getElementById(id); if (x) x.onclick = fn; };
  lig("btnEpGravar", () => epGravar());
  lig("btnEpCancelar", () => document.getElementById("dlgEdPontua").close());
  lig("btnEpX", () => document.getElementById("dlgEdPontua").close());
  lig("btnEpIaCopiar", () => epCopiarIA());
  lig("btnEpIaLer", () => epLerIA(document.getElementById("epIaResp").value));
  ["sim", "nao"].forEach((v) => {
    const a = document.getElementById("epPeso_" + v), b = document.getElementById("epMin_" + v), dz = document.getElementById("epDisc_" + v);
    if (a) a.onchange = () => { if (epCtx) { epCtx.peso = v; epPintar(); } };
    if (b) b.onchange = () => { if (epCtx) { epCtx.minimo = v; epPintar(); } };
    if (dz) dz.onchange = () => { if (epCtx) { epCtx.discursiva = v; epPintar(); } };
  });
}
