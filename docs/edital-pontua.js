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
  return { r, ds, grupos, peso: temAbs ? "sim" : "nao", minimo: temMin ? "sim" : "nao" };
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
  });
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
      const m = el("span", "ep-c-min");
      const g = document.createElement("select");
      g.id = "epGrupo_" + k;
      const opt = (val, txt) => { const o = document.createElement("option"); o.value = val; o.textContent = txt; g.append(o); };
      opt("", t("ep_so_ela"));
      c.grupos.forEach((gr) => opt("g:" + gr.nome, t("ep_no_grupo", { g: gr.nome })));
      opt("+", t("ep_novo_grupo"));
      g.value = d.grupo ? "g:" + d.grupo : "";
      g.onchange = () => epTrocarGrupo(d, g.value);
      m.append(g);
      if (!d.grupo) m.append(epCampoMin("epMinD_" + k, d.min, (nm) => { d.min = nm; epResumo(); }));
      lin.append(m);
    }
    tb.append(lin);
  });
  /* os grupos: nome e o mínimo do grupo */
  const gx = $("epGrupos");
  gx.innerHTML = "";
  gx.hidden = !(c.minimo === "sim" && c.grupos.length);
  if (!gx.hidden) {
    gx.append(el("div", "ep-sub-tit", t("ep_grupos_tit")));
    c.grupos.forEach((gr, k) => {
      const lin = el("div", "ep-lin ep-grupo");
      const nm = document.createElement("input");
      nm.type = "text"; nm.id = "epGrupoNome_" + k; nm.className = "ep-gnome"; nm.value = gr.nome;
      nm.onchange = () => {
        const novo = String(nm.value || "").replace(/[|&@#]/g, "").trim();
        if (!novo || c.grupos.some((x) => x !== gr && x.nome === novo)) { nm.value = gr.nome; return; }
        c.ds.forEach((d) => { if (d.grupo === gr.nome) d.grupo = novo; });
        gr.nome = novo; epPintar();
      };
      const membros = c.ds.filter((d) => d.grupo === gr.nome).map((d) => hubDiscCurtaSeg(d.nome));
      lin.append(nm, epCampoMin("epMinG_" + k, gr.min, (m2) => { gr.min = m2; epResumo(); }), el("span", "ep-membros", membros.join(", ") || t("ep_grupo_vazio")));
      gx.append(lin);
    });
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
  /* grupo que ficou sem ninguém some */
  c.grupos = c.grupos.filter((g) => c.ds.some((x) => x.grupo === g.nome));
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
  cx.innerHTML = "";
  frases.forEach((f) => { const p = document.createElement("li"); p.textContent = f; cx.append(p); });
  return frases;
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
  const saida = pre.slice();
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
  } catch (e) {}
  try { reg("EDITAL", "como a prova pontua: gravado", (epResumo() || []).join(" · ")); } catch (e) {}
  try { $("dlgEdPontua").close(); } catch (e) {}
  try { if (typeof edRender === "function") edRender(); } catch (e) {}
  try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
  try { toastMsg(t("ep_gravado"), 4000); } catch (e) {}
  return true;
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
    const a = document.getElementById("epPeso_" + v), b = document.getElementById("epMin_" + v);
    if (a) a.onchange = () => { if (epCtx) { epCtx.peso = v; epPintar(); } };
    if (b) b.onchange = () => { if (epCtx) { epCtx.minimo = v; epPintar(); } };
  });
}
