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
  const ds = (r.disciplinas || []).map((d) => ({ nome: d.nome, peso: d.peso, peso0: d.peso, abs: d.abs || 0, unidade: d.unidade || "q", grupo: "", min: null }));
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
  /* (19.59.0) a foto do que está gravado: é o "antes" da confirmação e do "cadastrado agora" */
  epCtx.orig = epFoto(epCtx);
  epPintarAtual();
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
  /* (19.63.0) o que vai em cada campo, ANTES da tabela: que número, em que formato e como o app usa */
  tb.append(el("div", "ep-guia", t(c.peso === "sim" ? "ep_guia_vale" : "ep_guia_peso15")));
  const cab = el("div", "ep-lin ep-cab");
  cab.append(el("span", "ep-c-nome", t("ep_col_disc")));
  if (c.peso === "sim") cab.append(el("span", "ep-c-vale", t("ep_col_vale")));
  else cab.append(el("span", "ep-c-vale", t("ep_col_peso15")));
  cab.append(el("span", "ep-c-fatia", t("ep_col_fatia")));
  if (c.minimo === "sim") cab.append(el("span", "ep-c-min", t("ep_col_min")));
  tb.append(cab);
  c.ds.forEach((d, k) => {
    const lin = el("div", "ep-lin" + (d.novo ? " ep-lin-nova" : ""));
    const nomeCx = el("span", "ep-c-nome", d.nome);
    if (d.novo) {
      /* (19.64.0) disciplina incluída nesta janela: marcada, com o 1º tópico, e dá para tirar antes de gravar */
      nomeCx.append(el("span", "ep-nova-tag", t("ep_nova_tag")));
      nomeCx.append(el("span", "ep-atual-sub", t("ep_nova_topico", { t: d.topico })));
      const tira = el("button", "btn-min ep-nova-tirar", "✕");
      tira.type = "button"; tira.id = "btnEpTirarNova_" + k;
      tira.title = t("ep_nova_tirar");
      tira.onclick = () => { c.ds = c.ds.filter((x) => x !== d); if (c.disc) c.disc.disciplinas = (c.disc.disciplinas || []).filter((n) => n !== d.nome); epPintar(); };
      nomeCx.append(tira);
    }
    lin.append(nomeCx);
    if (c.peso === "sim") {
      const v = el("span", "ep-c-vale");
      const n = document.createElement("input");
      n.type = "number"; n.min = "0"; n.step = "1"; n.id = "epVale_" + k; n.className = "ep-num";
      n.placeholder = t("ep_vale_ph");
      n.setAttribute("aria-label", t("ep_vale_aria", { d: d.nome }));
      n.value = d.abs > 0 ? String(d.abs) : "";
      n.oninput = () => { d.abs = Number(n.value) || 0; epResumo(); };
      const u = document.createElement("select");
      u.id = "epUni_" + k;
      [["q", t("ep_questoes")], ["p", t("ep_pontos")]].forEach(([val, txt]) => { const o = document.createElement("option"); o.value = val; o.textContent = txt; u.append(o); });
      u.value = d.unidade === "p" ? "p" : "q";
      u.onchange = () => { d.unidade = u.value; c.ds.forEach((x) => { x.unidade = u.value; }); epPintar(); };
      v.append(n, u);
      lin.append(v);
    } else {
      /* (19.59.0) sem os números do edital, o peso de 1 a 5 da disciplina pode ser mudado aqui */
      const v = el("span", "ep-c-vale");
      if (d.abs > 0 && !epLimpaNumeros(c)) {
        /* (19.60.1) esta já tem o número do edital: ele fica (para tirá-lo, "Sim" e depois "Não") */
        const fica = el("span", "ep-num-fica", epPesoTexto(d, "sim", false));
        fica.id = "epVale_" + k;
        v.append(fica);
        lin.append(v);
        const fz0 = el("span", "ep-c-fatia"); fz0.id = "epFatia_" + k; lin.append(fz0);
        if (c.minimo === "sim") {
          const m0 = el("span", "ep-c-min");
          if (d.grupo) m0.append(el("span", "ep-no-bloco", t("ep_no_bloco", { g: d.grupo })));
          else m0.append(epCampoMin("epMinD_" + k, d.min, (nm) => { d.min = nm; epResumo(); }));
          lin.append(m0);
        }
        tb.append(lin);
        return;
      }
      const sel = document.createElement("select");
      sel.id = "epPeso15_" + k; sel.className = "ep-peso15";
      sel.setAttribute("aria-label", t("ep_col_peso15") + " · " + d.nome);
      [1, 2, 3, 4, 5].forEach((x) => { const o = document.createElement("option"); o.value = String(x); o.textContent = x + " · " + t("ep_peso15_" + x); sel.append(o); });
      sel.value = String(Math.min(5, Math.max(1, Math.round(d.peso || 3))));
      sel.onchange = () => { d.peso = Number(sel.value); epResumo(); };
      v.append(sel);
      if (d.peso !== d.peso0) v.append(el("span", "ep-mudou", t("ep_era", { v: d.peso0 })));
      lin.append(v);
    }
    const fz = el("span", "ep-c-fatia");
    fz.id = "epFatia_" + k;
    lin.append(fz);
    if (c.minimo === "sim") {
      /* (19.56.0) disciplina num bloco mostra o bloco (o mínimo é do bloco); fora de bloco, o mínimo próprio */
      const m = el("span", "ep-c-min");
      if (d.grupo) m.append(el("span", "ep-no-bloco", t("ep_no_bloco", { g: d.grupo })));
      else m.append(epCampoMin("epMinD_" + k, d.min, (nm) => { d.min = nm; epResumo(); }));
      lin.append(m);
    }
    tb.append(lin);
  });
  /* (19.64.0) "+ incluir disciplina": a disciplina nova entra com UM tópico (sem tópico ela não ganharia tempo na agenda) */
  const inc = el("button", "btn-min btn-min-ok", t("ep_nova_btn"));
  inc.type = "button"; inc.id = "btnEpIncluirDisc";
  inc.title = t("ep_nova_btn_tip");
  inc.onclick = () => epIncluirDisciplina();
  tb.append(inc);
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
/* (19.62.0) AS FRASES DE UM ESTADO, cada uma com uma CHAVE (do que ela fala), para comparar o gravado com o da janela:
 * "g:Bloco", "d:Disciplina", "min", "peso", "disc:vale", "disc:cai", "disc:min", "disc:linhas", "disc:corrigida".
 * st = { ds, grupos, minimo, peso, disc, discursiva }; hib = a fatia híbrida desse estado (ou null). */
function epFrasesDe(st, hib, objetiva) {
  const F = [];
  const add = (k, txt) => F.push({ k, txt });
  if (st.minimo === "sim") {
    st.grupos.forEach((g) => {
      const ms = st.ds.filter((d) => d.grupo === g.nome).map((d) => d.nome);
      if (!ms.length) return;
      add("g:" + g.nome, g.min ? t("ep_frase_grupo", { g: g.nome, d: ms.map(hubDiscCurtaSeg).join(", "), m: epMinTexto(g.min) }) : t("ep_frase_grupo_sem", { g: g.nome }));
    });
    st.ds.filter((d) => !d.grupo).forEach((d) => add("d:" + d.nome, d.min ? t("ep_frase_disc", { d: d.nome, m: epMinTexto(d.min) }) : t("ep_frase_disc_sem", { d: d.nome })));
  } else add("min", t("ep_frase_sem_min"));
  if (st.peso === "sim") {
    const tot = st.ds.reduce((a, d) => a + (d.abs || 0), 0);
    const falta = st.ds.filter((d) => !(d.abs > 0)).map((d) => d.nome);
    if (falta.length) add("peso", t("ep_frase_falta_vale", { d: falta.join(", ") }));
    else add("peso", t("ep_frase_vale", { l: st.ds.map((d) => hubDiscCurtaSeg(d.nome) + " " + Math.round(d.abs / (tot || 1) * 100) + "%").join(" · ") }));
  } else if (hib) {
    /* (19.61.0) edital misturado com o total da objetiva: parte exata, parte estimada no que sobra */
    add("peso", t("ep_frase_hibrida", { e: Object.keys(hib.pts).filter((k) => hib.estimadas.indexOf(k) < 0).map(hubDiscCurtaSeg).join(", "),
      d: hib.estimadas.map(hubDiscCurtaSeg).join(", "), r: Math.round(hib.resto) }));
  } else add("peso", t("ep_frase_estimado"));
  /* a discursiva: quanto vale da nota final, onde cai e o que elimina */
  if (st.discursiva === "sim" && st.disc) {
    const dd = st.disc, obj = objetiva;
    if (dd.pontos > 0 && obj > 0) add("disc:vale", t("ep_frase_disc_vale", { s: Math.round(dd.pontos / (obj + dd.pontos) * 100), p: dd.pontos, t: obj + dd.pontos }));
    else add("disc:vale", t("ep_frase_disc_falta"));
    if ((dd.disciplinas || []).length) add("disc:cai", t("ep_frase_disc_cai", { d: dd.disciplinas.map(hubDiscCurtaSeg).join(", ") }));
    else add("disc:cai", t("ep_frase_disc_sem_disc"));
    if (dd.minimo) add("disc:min", t("ep_frase_disc_min", { m: epMinTexto(dd.minimo) }));
    if (dd.linhas && dd.linhas.max) add("disc:linhas", t("ep_frase_disc_linhas2", { l: edLinhasTxt(dd.linhas) }));
    if (dd.corrigida > 0) add("disc:corrigida", t("ep_frase_disc_corrigida", { n: dd.corrigida }));
  }
  return F;
}

/* "Como fica", com o que mudou em relação ao gravado (mesmas cores e símbolos do painel da revisão):
 *   ＋ verde "novo" · ↻ âmbar "mudou" (com o "antes" riscado) · ✕ vermelho "sai" (riscada, no fim) · sem marca = igual */
function epResumo() {
  const c = epCtx, cx = $("epResumo");
  if (!c || !cx) return [];
  const agora = epFrasesDe(c, epFatiasDe(epTextoPrevia()).hibrida, epObjetivaPontos());
  let antes = null;
  if (c.orig) {
    const o = c.orig;
    const objO = o.disc && o.disc.objetiva > 0 ? o.disc.objetiva
      : (o.peso === "sim" && o.ds.length && o.ds.every((d) => d.abs > 0 && d.unidade === "p") ? o.ds.reduce((a, d) => a + d.abs, 0) : 0);
    antes = epFrasesDe(o, epFatiasDe($("editalTexto").value).hibrida, objO);
  }
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const marcas = [];
  agora.forEach((f) => {
    const a = antes ? antes.find((x) => x.k === f.k) : null;
    marcas.push(!antes ? { f, tipo: "" } : !a ? { f, tipo: "novo" } : a.txt !== f.txt ? { f, tipo: "mudou", antes: a.txt } : { f, tipo: "" });
  });
  const saem = antes ? antes.filter((a) => !agora.some((f) => f.k === a.k)) : [];
  const n = { novo: marcas.filter((m) => m.tipo === "novo").length, mudou: marcas.filter((m) => m.tipo === "mudou").length, sai: saem.length };
  cx.innerHTML = "";
  if (n.novo || n.mudou || n.sai) {
    const leg = el("li", "ep-res-leg");
    leg.setAttribute("role", "presentation");
    if (n.novo) leg.append(el("span", "ep-res-chip ep-res-novo", "＋ " + t("ep_res_novos", { n: n.novo })));
    if (n.mudou) leg.append(el("span", "ep-res-chip ep-res-mudou", "↻ " + t("ep_res_mudou", { n: n.mudou })));
    if (n.sai) leg.append(el("span", "ep-res-chip ep-res-sai", "✕ " + t("ep_res_sai", { n: n.sai })));
    cx.append(leg);
  }
  const SIMB = { novo: "＋", mudou: "↻", sai: "✕" };
  const item = (txt, tipo, ant) => {
    const li = el("li", tipo ? "ep-res-" + tipo : "");
    if (tipo) {
      li.append(el("span", "ep-res-simb", SIMB[tipo] + " "));
      li.setAttribute("aria-label", t("ep_res_aria_" + tipo) + " " + txt);
    }
    li.append(el("span", "ep-res-txt", txt));
    if (ant) li.append(el("span", "ep-res-antes", t("ep_res_antes", { x: ant })));
    li.dataset.chave = tipo;
    cx.append(li);
  };
  marcas.forEach((m) => item(m.f.txt, m.tipo, m.antes));
  saem.forEach((a) => item(a.txt, "sai"));
  /* (19.83.0) o efeito na agenda, em uma linha: as 3 disciplinas que mais mudam de "vale X%" (o detalhe vem na confirmação) */
  try {
    if (n.novo || n.mudou || n.sai) {
      const fa = epFatiasDe($("editalTexto").value), fb = epFatiasDe(epTextoPrevia());
      const top = c.ds.map((d) => ({ n: hubDiscCurtaSeg(d.nome), a: fa.fatia[d.nome], b: fb.fatia[d.nome] }))
        .filter((x) => x.a != null && x.b != null && x.a !== x.b).sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a)).slice(0, 3);
      if (top.length) {
        const li = el("li", "ep-res-agenda");
        li.append(el("span", "ep-res-simb", "⇅ "), el("span", "ep-res-txt", t("ep_res_agenda", { l: top.map((x) => x.n + " " + x.a + "% → " + x.b + "%").join(" · ") })));
        cx.append(li);
      }
    }
  } catch (e) {}
  epPintarFatias();
  epMarcarMudancas();
  return agora.map((f) => f.txt);
}

/* (19.63.0) CAMPO QUE MUDOU, MARCADO. Depois do "preencher" (ou de digitar), cada campo diferente do que está gravado
 * ganha a borda âmbar e o "era …" ao lado; voltar ao valor gravado tira a marca. Devolve quantos campos estão marcados. */
function epMarcarMudancas() {
  const c = epCtx;
  if (!c || !c.orig) return 0;
  const o = c.orig;
  let n = 0;
  const marca = (id, mudou, era) => {
    const x = $(id);
    if (!x || !x.classList) return;
    x.classList.toggle("ep-campo-mudou", !!mudou);
    if (mudou) { n++; x.title = era != null && era !== "" ? t("ep_era", { v: era }) : t("ep_campo_novo"); }
    else x.title = "";
  };
  const minTx = (m) => (m ? epMinTexto(m) : "");
  c.ds.forEach((d, k) => {
    const a = o.ds.find((x) => x.nome === d.nome) || {};
    marca("epVale_" + k, (d.abs || 0) !== (a.abs || 0) || ((d.abs || 0) > 0 && d.unidade !== a.unidade), a.abs > 0 ? epPesoTexto(a, "sim", false) : "");
    marca("epPeso15_" + k, d.peso !== a.peso, a.peso);
    marca("epMinD_" + k, minTx(d.min) !== minTx(a.min) && !d.grupo, minTx(a.min));
  });
  c.grupos.forEach((g, k) => {
    const a = o.grupos.find((x) => x.nome === g.nome);
    marca("epMinG_" + k, !a || minTx(a.min) !== minTx(g.min), a ? minTx(a.min) : "");
    marca("epGrupoNome_" + k, !a, "");
  });
  const dd = c.disc || {}, da = o.disc || {};
  if (c.discursiva === "sim") {
    marca("epDiscPontos", (dd.pontos || 0) !== (da.pontos || 0), da.pontos || "");
    marca("epDiscObj", (dd.objetiva || 0) !== (da.objetiva || 0), da.objetiva || "");
    marca("epDiscMin", minTx(dd.minimo) !== minTx(da.minimo), minTx(da.minimo));
    marca("epDiscLinMin", ((dd.linhas || {}).min || 0) !== ((da.linhas || {}).min || 0), (da.linhas || {}).min || "");
    marca("epDiscLinMax", ((dd.linhas || {}).max || 0) !== ((da.linhas || {}).max || 0), (da.linhas || {}).max || "");
    marca("epDiscCorr", (dd.corrigida || 0) !== (da.corrigida || 0), da.corrigida || "");
  }
  return n;
}

/* =====================================================================
 * (19.59.0) CONSULTAR, MUDAR COM CONFIRMAÇÃO E AS REGRAS
 * O pedido: "consultar os pesos já cadastrados e poder alterar — com confirmação adicional e alerta prévio explicando o
 * que acontece em cada botão — e as regras dos pesos". Três peças:
 *  · "Cadastrado agora": a foto do que está gravado (peso, quanto vale, mínimo, discursiva), sempre visível no topo;
 *  · na tabela, o peso de 1 a 5 vira uma lista quando o edital não traz números, e a coluna "vale" mostra a fatia ao vivo;
 *  · "Gravar" mostra ANTES o que muda (de → para) e o que cada botão faz; sair com mudanças também pergunta.
 * ===================================================================== */
function epFoto(c) {
  return JSON.parse(JSON.stringify({ ds: c.ds, grupos: c.grupos, peso: c.peso, minimo: c.minimo, disc: c.disc, discursiva: c.discursiva }));
}

/* a fatia de cada disciplina como o app a calcula (montarPlano), para um texto */
function epFatiasDe(texto) {
  try {
    const r = lerEdital(texto || "");
    const pl = montarPlano(r, { hoje: typeof hojeISO === "function" ? hojeISO() : undefined });
    return { fatia: pl.fatia || {}, exata: !!pl.fatiaExata, hibrida: pl.fatiaHibrida || null };
  } catch (e) { return { fatia: {}, exata: false, hibrida: null }; }
}

/* o texto que seria gravado agora (sem gravar) */
function epTextoPrevia() {
  const c = epCtx;
  if (!c || !$("editalTexto")) return "";
  try { return epNovoTexto($("editalTexto").value, c); } catch (e) { return $("editalTexto").value; }
}

/* (19.61.0) "≈" só no que é estimado: no edital misturado com o total da objetiva, as numeradas são exatas */
function epFatiaEstimada(f, nome) {
  if (f.exata) return false;
  if (f.hibrida) return f.hibrida.estimadas.indexOf(nome) >= 0;
  return true;
}
function epPintarFatias() {
  const c = epCtx;
  if (!c) return;
  const f = epFatiasDe(epTextoPrevia());
  c.ds.forEach((d, k) => {
    const x = $("epFatia_" + k);
    if (!x) return;
    const v = f.fatia[d.nome];
    const est = epFatiaEstimada(f, d.nome);
    x.textContent = v == null ? "—" : (est ? "≈" : "") + v + "%";
    x.title = t(!est ? "ep_fatia_exata" : f.hibrida ? "ep_fatia_hibrida" : "ep_fatia_estimada", f.hibrida ? { r: Math.round(f.hibrida.resto), t: f.hibrida.total } : {});
  });
}

/* o peso de uma disciplina, em palavras: "10 questões" · "peso 4 (1 a 5)" */
/* (19.60.1) "Não" na pergunta 1 só APAGA os números do edital quando a pessoa trocou de "Sim" para "Não" nesta janela.
 * Com o edital já misturado (algumas disciplinas com "10q", outras de 1 a 5), "Não" é o estado de partida — e gravar
 * qualquer outra coisa (um mínimo, a discursiva, a resposta da IA) trocava "10q" por "5" sem ninguém pedir. */
function epLimpaNumeros(c) {
  if (!c) return false;
  return c.orig ? c.orig.peso === "sim" && c.peso === "nao" : !!c.limparNumeros;
}
function epPesoTexto(d, peso, limpar) {
  if (d.abs > 0 && (peso === "sim" || !limpar)) return t(d.unidade === "p" ? "ep_vale_pontos" : "ep_vale_questoes", { n: d.abs });
  return t("ep_peso15_tx", { n: d.peso });
}
function epMinDe(d, foto) {
  if (foto.minimo !== "sim") return t("ep_atual_sem_min");
  if (d.grupo) { const g = foto.grupos.find((x) => x.nome === d.grupo); return t("ep_atual_bloco", { g: d.grupo, m: g && g.min ? epMinTexto(g.min) : "—" }); }
  return d.min ? epMinTexto(d.min) : t("ep_atual_sem_min");
}
function epDiscTexto(foto) {
  if (foto.discursiva !== "sim" || !foto.disc || !(foto.disc.pontos > 0)) return t("ep_atual_disc_nao");
  const dd = foto.disc;
  return t("ep_atual_disc", { p: dd.pontos, o: dd.objetiva || "?", d: (dd.disciplinas || []).map(hubDiscCurtaSeg).join(", ") || "—" })
    + (dd.minimo ? " · " + t("ep_atual_disc_min", { m: epMinTexto(dd.minimo) }) : "")
    /* (19.83.0) linhas e "corrigida" também: mudar só um deles não aparecia e a gravação dizia "nada mudou" */
    + (dd.linhas && dd.linhas.max ? " · " + edLinhasTxt(dd.linhas) : "")
    + (dd.corrigida ? " · " + t("ep_conf_d_corr", { n: dd.corrigida }) : "");
}

/* "Cadastrado agora": o que está gravado no edital, antes de mexer em qualquer coisa */
function epPintarAtual() {
  const c = epCtx, cx = $("epAtual");
  if (!c || !cx || !c.orig) return;
  const o = c.orig;
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  cx.innerHTML = "";
  const f = epFatiasDe($("editalTexto").value);
  cx.append(el("summary", "", t("ep_atual_tit")));
  cx.append(el("p", "nota", f.hibrida
    ? t("ep_atual_sub_hibrida", { n: f.hibrida.numeradas, t: f.hibrida.total, r: Math.round(f.hibrida.resto), d: f.hibrida.estimadas.map(hubDiscCurtaSeg).join(", ") })
    : t(f.exata ? "ep_atual_sub_exata" : "ep_atual_sub_estimada")));
  /* (19.63.0) uma TABELA de verdade: cabeçalho destacado, números alinhados à direita, peso e mínimo em duas linhas
   * (o valor em destaque, a explicação menor embaixo) — a lista corrida não deixava ver o que é de quem */
  const tab = el("table", "ep-atual-tabela");
  const th = el("thead"), trh = el("tr");
  [["ep_col_disc", ""], ["ep_atual_col_peso", ""], ["ep_col_fatia", "ep-num-col"], ["ep_col_min", ""]].forEach(([k, cls]) => trh.append(el("th", cls, t(k))));
  th.append(trh); tab.append(th);
  const tb = el("tbody");
  o.ds.forEach((d) => {
    const tr = el("tr");
    tr.append(el("td", "ep-atual-nome", d.nome));
    const tdP = el("td");
    if (d.abs > 0) {
      tdP.append(el("strong", "", epPesoTexto(d, "sim", false)));
      tdP.append(el("span", "ep-atual-sub", t("ep_atual_do_edital")));
    } else {
      tdP.append(el("strong", "", t("ep_atual_peso_n", { n: d.peso })));
      tdP.append(el("span", "ep-atual-sub", t("ep_atual_escala")));
    }
    tr.append(tdP);
    const v = f.fatia[d.nome];
    const tdV = el("td", "ep-num-col", v == null ? "—" : (epFatiaEstimada(f, d.nome) ? "≈" : "") + v + "%");
    tr.append(tdV);
    const tdM = el("td");
    if (o.minimo === "sim" && d.grupo) {
      const g = o.grupos.find((x) => x.nome === d.grupo);
      tdM.append(el("strong", "", g && g.min ? epMinTexto(g.min) : "—"));
      tdM.append(el("span", "ep-atual-sub", t("ep_atual_no_bloco", { g: d.grupo })));
    } else if (o.minimo === "sim" && d.min) {
      tdM.append(el("strong", "", epMinTexto(d.min)));
      tdM.append(el("span", "ep-atual-sub", t("ep_atual_so_dela")));
    } else tdM.append(el("span", "ep-atual-sub", t("ep_atual_sem_min")));
    tr.append(tdM);
    tb.append(tr);
  });
  tab.append(tb);
  cx.append(tab);
  if (!f.exata) cx.append(el("p", "ep-atual-leg", t("ep_atual_leg_aprox")));
  /* a discursiva em pares rótulo → valor */
  const dl = el("div", "ep-atual-disc");
  dl.append(el("div", "ep-atual-disc-tit", t("ep_atual_disc_rot")));
  if (o.discursiva !== "sim" || !o.disc || !(o.disc.pontos > 0)) dl.append(el("span", "ep-atual-sub", t("ep_atual_disc_nao")));
  else {
    const dd = o.disc;
    const par = (k, val) => { const x = el("span", "ep-atual-par"); x.append(el("span", "ep-atual-rot", t(k)), el("strong", "", String(val))); dl.append(x); };
    par("ep_atual_d_vale", t("ep_vale_pontos", { n: dd.pontos }));
    if (dd.objetiva) par("ep_atual_d_obj", t("ep_vale_pontos", { n: dd.objetiva }));
    if (dd.minimo) par("ep_atual_d_min", epMinTexto(dd.minimo));
    if (dd.linhas && dd.linhas.max) par("ep_atual_d_lin", edLinhasTxt(dd.linhas, true));
    if (dd.corrigida) par("ep_atual_d_corr", t("ep_atual_d_corr_v", { n: dd.corrigida }));
    par("ep_atual_d_cai", (dd.disciplinas || []).map(hubDiscCurtaSeg).join(", ") || "—");
  }
  cx.append(dl);
  cx.open = true;
}

/* o que muda entre o gravado e o que está na janela: [{tipo: "peso"|"min"|"bloco"|"disc", txt}] */
/* (19.64.0) INCLUIR UMA DISCIPLINA pela janela. Pergunta o nome e o primeiro tópico (sugestão: "Conteúdo geral de X");
 * a disciplina entra com peso 3 e pode ganhar número, mínimo e bloco ali mesmo. Só vai para o edital ao Gravar — e a trava
 * de tópicos passa a aceitar exatamente as disciplinas e tópicos incluídos aqui. */
async function epIncluirDisciplina(nomeDado, topicoDado) {
  const c = epCtx;
  if (!c) return false;
  let nome = nomeDado, topico = topicoDado;
  if (nome === undefined) {
    const r = await uiTexto(t("ep_nova_pergunta"), "", { rotulo2: t("ep_nova_pergunta_top"), valor2: "" });
    if (!r) return false;
    nome = r.a; topico = r.b;
  }
  const limpa = (x) => String(x || "").replace(/[|&@#+]/g, " ").replace(/::/g, " ").replace(/\s+/g, " ").trim();
  nome = limpa(nome);
  const k = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const msg = $("epMsg");
  if (!nome) { if (msg) msg.textContent = t("ep_nova_sem_nome"); return false; }
  if (c.ds.some((d) => k(d.nome) === k(nome))) { if (msg) msg.textContent = t("ep_nova_existe", { d: nome }); try { await uiAlert(t("ep_nova_existe", { d: nome })); } catch (e) {} return false; }
  topico = limpa(topico) || t("ep_nova_topico_padrao", { d: nome });
  c.ds.push({ nome, peso: 3, peso0: 3, abs: 0, unidade: (c.ds.find((d) => d.abs > 0) || {}).unidade || "q", grupo: "", min: null, novo: true, topico });
  epPintar();
  if (msg) msg.textContent = t("ep_nova_ok", { d: nome, t: topico });
  try { reg("EDITAL", "como a prova pontua: disciplina incluída (ainda não gravada)", nome + " · " + topico); } catch (e) {}
  return true;
}

function epMudancas(c) {
  const o = c && c.orig;
  if (!o) return [];
  const out = [];
  c.ds.forEach((d) => {
    const a = o.ds.find((x) => x.nome === d.nome);
    if (!a && d.novo) { out.push({ tipo: "nova", txt: t("ep_mud_nova", { d: d.nome, t: d.topico, p: epPesoTexto(d, c.peso, false) }) }); return; }
    if (!a) return;
    const pa = epPesoTexto(a, o.peso, false), pb = epPesoTexto(d, c.peso, epLimpaNumeros(c));
    if (pa !== pb) out.push({ tipo: "peso", txt: t("ep_mud_linha", { d: d.nome, a: pa, b: pb }) });
    const ma = epMinDe(a, o), mb = epMinDe(d, c);
    if (ma !== mb) out.push({ tipo: "min", txt: t("ep_mud_min", { d: d.nome, a: ma, b: mb }) });
  });
  const da = epDiscTexto(o), db = epDiscTexto(c);
  if (da !== db) out.push({ tipo: "disc", txt: t("ep_mud_disc", { a: da, b: db }) });
  return out;
}

/* (19.83.0) O CORPO DA CONFIRMAÇÃO. Agrupa as mudanças por assunto e diz o efeito delas na agenda. */
function epConfirmacaoEl(c, mud, fa, fb) {
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const box = el("div", "ep-conf");
  box.append(el("p", "ep-conf-porque", t("ep_conf_porque")));
  const sec = (tit) => { const s = el("div", "ep-conf-sec"); s.append(el("div", "ep-conf-sec-tit", tit)); box.append(s); return s; };
  const o = c.orig || {};
  /* 1. o que muda no edital */
  const s1 = sec(t("ep_conf_s_muda"));
  const ul = el("ul", "ep-conf-lista");
  const li = (txt, det) => { const x = el("li", "", txt); if (det && det.length) { const d = el("details", "ep-conf-det"); d.append(el("summary", "", t("ep_conf_quais", { n: det.length })), el("div", "nota", det.join(", "))); x.append(d); } ul.append(x); return x; };
  /* cortes: as disciplinas que vão para o mesmo destino viram uma linha */
  const porMin = {};
  c.ds.forEach((d) => { const a = (o.ds || []).find((x) => x.nome === d.nome); if (!a) return; const ma = epMinDe(a, o), mb = epMinDe(d, c); if (ma !== mb) (porMin[mb] = porMin[mb] || []).push(hubDiscCurtaSeg(d.nome)); });
  Object.keys(porMin).forEach((mb) => {
    const ds = porMin[mb];
    if (ds.length === 1) li(t("ep_conf_min_uma", { d: ds[0], m: mb }));
    else li(ds.length === c.ds.length ? t("ep_conf_min_todas", { m: mb, n: ds.length }) : t("ep_conf_min_algumas", { m: mb, n: ds.length }), ds);
  });
  /* pontuação: "Português 10 questões → 10 pontos" numa linha só, separadas por ponto */
  const pesos = mud.filter((x) => x.tipo === "peso").map((x) => x.txt);
  if (pesos.length) { const lp = li(t("ep_conf_pesos", { n: pesos.length })); pesos.forEach((p) => lp.append(el("div", "ep-conf-sub", p))); }
  mud.filter((x) => x.tipo === "nova").forEach((x) => li(x.txt));
  /* discursiva: campo a campo */
  const da = epDiscTexto(o), db = epDiscTexto(c);
  if (da !== db) {
    const dd = c.disc || {};
    const nova = !(o.discursiva === "sim" && o.disc && o.disc.pontos > 0);
    const x = el("li", "ep-conf-disc");
    x.append(el("strong", "", t(nova ? "ep_conf_d_nova" : "ep_conf_d_muda")));
    if (c.discursiva !== "sim") x.append(el("div", "ep-conf-sub", t("ep_conf_d_sai")));
    else {
      const campos = [[t("ep_conf_d_pontos"), dd.pontos + (dd.objetiva ? " " + t("ep_conf_d_obj", { o: dd.objetiva }) : "")],
        [t("ep_conf_d_min"), dd.minimo ? epMinTexto(dd.minimo) : t("ep_conf_d_sem")],
        [t("ep_conf_d_linhas"), dd.linhas && dd.linhas.max ? edLinhasTxt(dd.linhas) : t("ep_conf_d_sem")],
        [t("ep_conf_d_corrigida"), dd.corrigida ? t("ep_conf_d_corr", { n: dd.corrigida }) : t("ep_conf_d_todos")],
        [t("ep_conf_d_onde"), t("ep_conf_d_disc_n", { n: (dd.disciplinas || []).length })]];
      const tb = el("div", "ep-conf-campos");
      campos.forEach(([k, v]) => { tb.append(el("span", "ep-conf-k", k), el("span", "ep-conf-v", String(v))); });
      x.append(tb);
      if ((dd.disciplinas || []).length) { const d = el("details", "ep-conf-det"); d.append(el("summary", "", t("ep_conf_quais", { n: dd.disciplinas.length })), el("div", "nota", dd.disciplinas.map(hubDiscCurtaSeg).join(", "))); x.append(d); }
    }
    ul.append(x);
  }
  if (!ul.children.length) ul.append(el("li", "", t("ep_conf_so_respostas").replace(/^·\s*/, "")));
  s1.append(ul);
  /* 2. o efeito na agenda: antes → depois, ordenado pela diferença; as 3 maiores em destaque */
  const lin = c.ds.map((d) => ({ n: hubDiscCurtaSeg(d.nome), a: fa.fatia[d.nome], b: fb.fatia[d.nome] }))
    .filter((x) => x.a !== x.b).map((x) => Object.assign(x, { dif: (x.b || 0) - (x.a || 0) }))
    .sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif));
  if (lin.length) {
    const s2 = sec(t("ep_conf_s_agenda"));
    s2.append(el("p", "nota", t(c.discursiva === "sim" && c.disc && c.disc.pontos > 0 ? "ep_conf_agenda_aj_disc" : "ep_conf_agenda_aj")));
    const g = el("div", "ep-conf-fat");
    ["ep_conf_c_disc", "ep_conf_c_antes", "ep_conf_c_depois", "ep_conf_c_dif"].forEach((k) => g.append(el("span", "ep-conf-fat-cab", t(k))));
    lin.forEach((x, i) => {
      const forte = i < 3 && Math.abs(x.dif) >= 2 ? " ep-conf-forte" : "";
      g.append(el("span", "ep-conf-fat-n" + forte, x.n), el("span", "ep-conf-num", x.a == null ? "—" : x.a + "%"), el("span", "ep-conf-num" + forte, x.b == null ? "—" : x.b + "%"),
        el("span", "ep-conf-num ep-conf-dif " + (x.dif > 0 ? "sobe" : "desce") + forte, (x.dif > 0 ? "▲ +" : "▼ ") + x.dif));
    });
    s2.append(g);
  }
  /* 3. o que não muda e os botões */
  const s3 = sec(t("ep_conf_s_nao"));
  s3.append(el("p", "nota", t("ep_conf_nao_muda")));
  box.append(el("p", "nota ep-conf-botoes", t("ep_conf_botoes2")));
  return box;
}

/* Gravar COM confirmação: o que muda (de → para), as fatias antes e depois, e o que cada botão faz */
async function epGravarConfirmando() {
  const c = epCtx;
  if (!c) return false;
  const falha = epValidar(c);
  if (falha) {
    if ($("epMsg")) $("epMsg").textContent = falha;
    try { reg("EDITAL", "como a prova pontua: gravação recusada (antes de confirmar)", falha.replace(/\n/g, " · ")); } catch (e) {}
    await uiAlert(t("ep_nao_grava", { f: falha }));
    /* (19.80.0) leva até o campo que falta (as disciplinas da discursiva são o caso mais comum) */
    try {
      const alvo = c.discursiva === "sim" && !c.disc.disciplinas.length ? $("epDiscMarcas") : null;
      if (alvo && alvo.scrollIntoView) { alvo.scrollIntoView({ behavior: "smooth", block: "center" }); alvo.classList.add("ep-disc-pisca"); setTimeout(() => alvo.classList.remove("ep-disc-pisca"), 2000); }
    } catch (e) {}
    return false;
  }
  const mud = epMudancas(c);
  if (!mud.length && c.peso === c.orig.peso && c.minimo === c.orig.minimo && c.discursiva === c.orig.discursiva) {
    await uiAlert(t("ep_nada_mudou"));
    return false;
  }
  const fa = epFatiasDe($("editalTexto").value), fb = epFatiasDe(epTextoPrevia());
  const fat = c.ds.filter((d) => fa.fatia[d.nome] !== fb.fatia[d.nome])
    .map((d) => hubDiscCurtaSeg(d.nome) + " " + (fa.fatia[d.nome] == null ? "—" : fa.fatia[d.nome] + "%") + " → " + (fb.fatia[d.nome] == null ? "—" : fb.fatia[d.nome] + "%"));
  /* (19.83.0) A CONFIRMAÇÃO EM SEÇÕES: por que ela aparece, o que muda (agrupado — dez linhas iguais de "mínimo: sem
   * mínimo → bloco Prova Objetiva" viram uma), o efeito na agenda (antes → depois, as maiores mudanças em destaque) e o
   * que não muda. O texto corrido de antes continua como "fat" só para o registro. */
  const corpo = epConfirmacaoEl(c, mud, fa, fb);
  if (!(await uiConfirm(t("ep_conf_tit2"), { ok: t("ep_conf_ok"), cancelar: t("ep_conf_voltar"), corpo }))) {
    try { reg("EDITAL", "como a prova pontua: gravação desistida na confirmação", mud.length + " mudança(s)"); } catch (e) {}
    return false;
  }
  const ok = epGravar();
  if (!ok) await uiAlert(t("ep_nao_grava", { f: ($("epMsg") && $("epMsg").textContent) || t("ep_erro_conta") }));
  return ok;
}

/* fechar a janela: com mudanças não gravadas, pergunta antes (e diz o que cada botão faz) */
async function epFechar() {
  const c = epCtx, dlg = $("dlgEdPontua");
  const mud = c ? epMudancas(c) : [];
  const respostas = c && c.orig && (c.peso !== c.orig.peso || c.minimo !== c.orig.minimo || c.discursiva !== c.orig.discursiva);
  if ((mud.length || respostas) && !(await uiConfirm(t("ep_sair_conf", { n: mud.length || 1 }), { ok: t("ep_sair_ok"), perigo: true }))) return false;
  try { if (dlg && dlg.open) dlg.close(); } catch (e) {}
  return true;
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
  /* (19.80.0) QUANDO O EDITAL NÃO DIZ ("1 questão discursiva", como no TJ PB): atalhos para marcar todas, as de um grupo
   * ou as sem número próprio (num edital que numera as gerais, são as específicas) — e o aviso de que é preciso marcar */
  if (!dd.disciplinas.length) cx.append(el("p", "nota ep-disc-falta-txt", t("ep_disc_nao_diz")));
  const atalhos = el("div", "ep-disc-atalhos");
  const atalho = (rot, lista, id, cls) => {
    const b = el("button", "btn-min" + (cls ? " " + cls : ""), rot);
    b.type = "button"; b.id = id;
    b.onclick = () => { dd.disciplinas = lista.slice(); epPintarDiscursiva(); epResumo(); };
    atalhos.append(b);
  };
  /* (19.82.0) as específicas vêm PRIMEIRO e em destaque: num edital que numera as gerais e não as específicas, as sem
   * número próprio são as específicas. Antes este atalho só aparecia sem nenhum grupo — e o grupo "Prova Objetiva" (o
   * mínimo de 60% do total, no TJ PB) o escondia, deixando só "marcar as de Prova Objetiva (10)", que é marcar todas.
   * Grupo com TODAS as disciplinas também não vira atalho: é o mesmo que "marcar todas". */
  const semN = c.ds.filter((d) => !(d.abs > 0));
  if (semN.length && semN.length < c.ds.length) atalho(t("ep_disc_sem_numero", { n: semN.length }), semN.map((d) => d.nome), "btnEpDiscSemN", dd.disciplinas.length ? "" : "btn-min-ok");
  const gruposD = c.ds.map((d) => d.grupo).filter((g, i, a) => g && a.indexOf(g) === i)
    .filter((g) => c.ds.filter((d) => d.grupo === g).length < c.ds.length);
  gruposD.forEach((g, k) => atalho(t("ep_disc_do_grupo", { g, n: c.ds.filter((d) => d.grupo === g).length }), c.ds.filter((d) => d.grupo === g).map((d) => d.nome), "btnEpDiscGrupo_" + k));
  atalho(t("ep_disc_todas"), c.ds.map((d) => d.nome), "btnEpDiscTodas");
  if (dd.disciplinas.length) atalho(t("ep_disc_limpar"), [], "btnEpDiscLimpar");
  cx.append(atalhos);
  const marcas = el("div", "ep-bloco-discs" + (dd.disciplinas.length ? "" : " ep-disc-falta"));
  marcas.id = "epDiscMarcas";
  c.ds.forEach((d, j) => {
    const l = el("label", "ep-bloco-d");
    const ck = document.createElement("input");
    ck.type = "checkbox"; ck.id = "epDiscD_" + j;
    ck.checked = dd.disciplinas.some((n) => n.toLowerCase() === d.nome.toLowerCase());
    ck.onchange = () => {
      dd.disciplinas = dd.disciplinas.filter((n) => n.toLowerCase() !== d.nome.toLowerCase());
      if (ck.checked) dd.disciplinas.push(d.nome);
      marcas.classList.toggle("ep-disc-falta", !dd.disciplinas.length);
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
  /* (19.64.0) as disciplinas incluídas na janela: "@ Nome :: 3" e o primeiro tópico, no lugar que os blocos mandarem */
  c.ds.filter((d) => d.novo).forEach((d) => blocos.push({ linhas: ["@ " + d.nome + " :: " + (d.peso0 || 3), "+ " + d.topico + " :: 3"] }));
  blocos.forEach((b) => { b.nome = nomeDe(b.linhas[0]); b.d = c.ds.find((d) => d.nome === b.nome) || null; });
  /* o peso: "10q"/"20p" quando o edital diz; senão, o que já estava */
  blocos.forEach((b) => {
    if (!b.d) return;
    const m = b.linhas[0].match(/^(\s*@\s*.+?\s*::\s*)([^|]*?)(\s*\|.*)?$/);
    let novo = null;
    if (c.peso === "sim" && b.d.abs > 0) novo = String(b.d.abs) + (b.d.unidade === "p" ? "p" : "q");
    /* (19.60.1) "Não" sem ter trocado de "Sim": o número que a disciplina tem (ou que a IA trouxe) fica */
    else if (c.peso === "nao" && b.d.abs > 0 && !epLimpaNumeros(c)) novo = String(b.d.abs) + (b.d.unidade === "p" ? "p" : "q");
    else if (c.peso === "nao" && /^\s*\d+(?:[.,]\d+)?\s*[qp]\s*$/i.test(m ? m[2] : "")) novo = String(b.d.peso || 3);
    /* (19.59.0) o peso de 1 a 5 mudado na janela */
    else if (c.peso === "nao" && b.d.peso0 !== undefined && b.d.peso !== b.d.peso0) novo = String(b.d.peso);
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

/* (19.59.1) O QUE IMPEDE GRAVAR, dito por nome. Antes, a recusa só aparecia no rodapé da janela (fora da vista) e DEPOIS da
 * confirmação — a pessoa confirmava, nada era gravado e o aviso da agenda continuava, sem explicação. "" = pode gravar. */
function epValidar(c) {
  if (!c) return "";
  /* bloco sem disciplina marcada não vai para o texto */
  c.grupos = c.grupos.filter((g) => c.ds.some((x) => x.grupo === g.nome));
  const falhas = [];
  if (c.peso === "sim") {
    const sem = c.ds.filter((d) => !(d.abs > 0)).map((d) => d.nome);
    if (sem.length) falhas.push(t("ep_falta_vale_de", { n: sem.length, d: sem.join(", ") }));
  }
  if (c.minimo === "sim") {
    const semMin = c.grupos.filter((g) => !g.min).map((g) => g.nome);
    if (semMin.length) falhas.push(t("ep_bloco_sem_min_de", { g: semMin.join(", ") }));
  }
  if (c.discursiva === "sim") {
    const f = [];
    if (!(c.disc.pontos > 0)) f.push(t("ep_disc_f_pontos"));
    if (!(epObjetivaPontos() > 0)) f.push(t("ep_disc_f_objetiva"));
    if (!c.disc.disciplinas.length) f.push(t("ep_disc_f_disc"));
    if (f.length) falhas.push(t("ep_disc_incompleta_de", { f: f.join(", ") }));
  }
  return falhas.join("\n");
}

function epGravar() {
  const c = epCtx;
  if (!c) return false;
  const msg = $("epMsg");
  const falha = epValidar(c);
  if (falha) {
    if (msg) msg.textContent = falha;
    try { reg("EDITAL", "como a prova pontua: gravação recusada", falha.replace(/\n/g, " · ")); } catch (e) {}
    return false;
  }
  const antes = $("editalTexto").value;
  const novo = epNovoTexto(antes, c);
  /* a garantia: os tópicos e os ramos são os mesmos, só a ordem das disciplinas pode mudar */
  /* (19.64.0) + exatamente as disciplinas incluídas aqui, com um tópico cada */
  const extra = c.ds.filter((d) => d.novo).length;
  const conta = (tx, mais) => { const r = lerEdital(tx); return (r.disciplinas.length + (mais || 0)) + "|" + (r.disciplinas.reduce((a, d) => a + d.topicos.length + d.topicos.reduce((b, tp) => b + ((tp.ramos || []).length), 0), 0) + (mais || 0)); };
  if (conta(novo) !== conta(antes, extra)) { if (msg) msg.textContent = t("ep_erro_conta"); try { reg("EDITAL", "como a prova pontua: gravação recusada (tópicos não batem)", ""); } catch (e) {} return false; }
  /* (19.59.0) uma versão anterior no histórico, como na revisão com IA */
  try { if (typeof guardarVersao === "function") guardarVersao("antes de ⚖ Pontuação e cortes", antes); } catch (e) {}
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

/* =====================================================================
 * (19.60.0) MESCLAR UMA RESPOSTA "SÓ PESOS" NO PLANO
 * A resposta tem só "#", "&" e "@" — usada para substituir o plano, apagaria os tópicos e o progresso. Aqui ela é
 * MESCLADA: muda só o peso de cada "@" (pelo nome, sem acento/maiúscula), os blocos e mínimos ("&") e a discursiva; o
 * cabeçalho (data, horas) é do app; disciplina sem par não é criada nem apagada (vai para o aviso). A garantia: o número de
 * disciplinas, tópicos e ramos depois é IGUAL ao de antes — senão nada é devolvido.
 * Devolve { texto, casadas, semPar, faltaram, misto, erro }.
 * ===================================================================== */
function edColarSoPesosResp(txt, atual) {
  const s = String(txt || "");
  if (!s.trim() || /^\s*\+/m.test(s)) return false;
  const r = lerEdital(s);
  if (!r.disciplinas.length || r.disciplinas.some((d) => d.topicos.length)) return false;
  const a = lerEdital(String(atual || ""));
  return a.disciplinas.some((d) => d.topicos.length > 0);
}

function edMesclarPesos(atual, resp) {
  const out = { texto: "", casadas: 0, semPar: [], faltaram: [], misto: false, erro: "" };
  const k = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const RE = /^\s*@\s*(.+?)\s*::\s*([^|]*?)\s*(\|.*)?$/;
  /* o peso e a escolha de cada disciplina da resposta, como a IA escreveu */
  const daResp = {};
  String(resp || "").split(/\r?\n/).forEach((l) => {
    const m = l.match(RE);
    if (!m) return;
    const suf = String(m[3] || "").replace(/\s*\|\s*m[íi]nimo\s*:\s*[^|]*/i, "").trim();
    daResp[k(m[1])] = { nome: m[1].trim(), peso: m[2].trim(), escolha: /escolha\s*:/i.test(suf) ? suf : "" };
  });
  const usadas = new Set();
  const meio = String(atual || "").split(/\r?\n/).map((l) => {
    const m = l.match(RE) || l.match(/^\s*@\s*(.+?)\s*$/);
    if (!m || !/^\s*@/.test(l)) return l;
    const nome = m[1].trim(), x = daResp[k(nome)];
    if (!x || !x.peso) { out.faltaram.push(nome); return l; }
    usadas.add(k(nome));
    out.casadas++;
    const escAtual = m[3] && /escolha\s*:/i.test(m[3]) ? m[3].trim() : "";
    const esc = x.escolha || escAtual;
    return "@ " + nome + " :: " + x.peso + (esc ? " " + esc : "");
  }).join("\n");
  Object.keys(daResp).forEach((kk) => { if (!usadas.has(kk)) out.semPar.push(daResp[kk].nome); });
  /* blocos, mínimos e discursiva: os da resposta, quando ela traz; senão ficam os do plano */
  const en = epEstado(meio), er = epEstado(resp);
  const nomeNoPlano = (n) => { const d = en.ds.find((x) => k(x.nome) === k(n)); return d ? d.nome : ""; };
  const temBlocos = er.grupos.length > 0 || er.ds.some((d) => d.min);
  if (temBlocos) {
    en.ds.forEach((d) => { const r2 = er.ds.find((x) => k(x.nome) === k(d.nome)); d.grupo = r2 ? r2.grupo : ""; d.min = r2 ? r2.min : null; });
    en.grupos = er.grupos.map((g) => ({ nome: g.nome, min: g.min }));
    en.minimo = "sim";
  }
  if (er.discursiva === "sim" && er.disc.pontos > 0) {
    en.disc = Object.assign({}, er.disc, { disciplinas: er.disc.disciplinas.map(nomeNoPlano).filter(Boolean) });
    en.discursiva = "sim";
  }
  en.peso = "manter";            /* os pesos já foram escritos acima, como a IA mandou */
  let texto = meio;
  try { texto = epNovoTexto(meio, en); } catch (e) { out.erro = String(e && e.message || e); return out; }
  /* a garantia */
  const conta = (tx) => { const r = lerEdital(tx); return r.disciplinas.length + "|" + r.disciplinas.reduce((a, d) => a + d.topicos.length + d.topicos.reduce((b, tp) => b + ((tp.ramos || []).length), 0), 0); };
  if (conta(texto) !== conta(atual)) { out.erro = t("ep_erro_conta"); return out; }
  const rd = lerEdital(texto).disciplinas.filter((d) => !d.inativa);
  const comNum = rd.filter((d) => d.abs > 0).length;
  out.misto = comNum > 0 && comNum < rd.length;
  out.semNumero = out.misto ? rd.filter((d) => !(d.abs > 0)).map((d) => d.nome) : [];
  out.texto = texto;
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
/* (19.63.0) LER A RESPOSTA DA IA LINHA POR LINHA, dizendo o que cada uma fez — ou por que não deu.
 * Cada linha vira { n, txt, tipo: "ok"|"aviso"|"erro"|"info", msg }: "Linha 3 · Português: 10 questões e 20 pontos — uso
 * os pontos" / "“dez” não é um número". O relatório aparece logo abaixo da caixa colada; os campos que mudaram ficam
 * marcados na tabela. Nada é gravado aqui. */
function epLerIA(txt) {
  const c = epCtx;
  if (!c) return { lidas: 0, avisos: [], linhas: [] };
  const nomes = c.ds.map((d) => d.nome);
  const achar = (x) => (typeof hubIaAcharDisc === "function" ? hubIaAcharDisc(x, nomes) : (nomes.find((n) => n.toLowerCase() === String(x).trim().toLowerCase()) || ""));
  const num = (x) => { const m = String(x || "").match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(",", ".")) : 0; };
  const vazio = (x) => /^\s*(?:-+|—|–|n\/?a|nd|n\.?\s*d\.?|n[ãa]o\s+(?:informa|diz|h[áa])|sem|nenhum|\?)?\s*$/i.test(String(x == null ? "" : x));
  const numOk = (x) => vazio(x) || /^\s*\d+(?:[.,]\d+)?\s*(?:quest(?:[õo]es)?|q|pontos?|pts?|p)?\s*$/i.test(String(x));
  const avisos = [], linhas = [];
  let lidas = 0, comVale = 0, comPontos = 0;
  const minimos = {}, vistas = {};
  const discModulos = [];   /* (19.80.0) "disciplinas: Conhecimentos Específicos" — resolvido depois de ler todas as linhas */
  const rel = (n, txt0, tipo, msg) => linhas.push({ n, txt: txt0, tipo, msg });
  String(txt || "").split(/\r?\n/).forEach((ln0, idx) => {
    const n = idx + 1;
    const ln = ln0.replace(/\*\*/g, "").replace(/^[-•*·]\s*/, "").trim();
    if (!ln) return;
    if (ln.indexOf("|") < 0) { rel(n, ln, "aviso", t("ep_iac_sem_barra")); return; }
    const p = ln.split("|").map((x) => x.trim());
    if (/^disciplina$/i.test(p[0])) { rel(n, ln, "info", t("ep_iac_cabecalho")); return; }
    /* (19.56.0) "Discursiva | pontos | objetiva | mínimo | linhas | corrigida | disciplinas (;)" */
    if (/^discursiva$/i.test(p[0])) {
      const dd = c.disc, prob = [];
      if (num(p[1]) > 0) dd.pontos = num(p[1]); else prob.push(t("ep_iac_d_pontos"));
      if (num(p[2]) > 0) dd.objetiva = num(p[2]); else prob.push(t("ep_iac_d_obj"));
      if (num(p[3]) > 0) dd.minimo = { tipo: "pct", valor: num(p[3]) };
      const ml = String(p[4] || "").match(/(\d+)\D+(\d+)/);
      const m1 = String(p[4] || "").match(/(\d+)/);
      if (ml) dd.linhas = { min: Number(ml[1]), max: Number(ml[2]) };
      else if (m1 && Number(m1[1]) > 0) dd.linhas = { min: 0, max: Number(m1[1]) };   /* (19.80.0) "30" = até 30 linhas */
      if (num(p[5]) > 0) dd.corrigida = num(p[5]);
      const brutos = String(p[6] || "").split(/[;,]/).map((x) => x.trim()).filter((x) => x && !/^-+$/.test(x));
      /* (19.80.0) "todas", "não diz" e o nome de um módulo ("Conhecimentos Específicos") também são respostas: o nome do
       * módulo vira as disciplinas dele (resolvidas no fim, quando todas as linhas já deram o grupo de cada uma) */
      const kd = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (brutos.some((x) => /^todas?\b/i.test(kd(x)))) dd.disciplinas = c.ds.map((d) => d.nome);
      else {
        const naoDiz = brutos.length === 0 || brutos.some((x) => /^n[aã]o\s*diz|^nao informa|^nao especifica/i.test(kd(x)));
        const ds2 = brutos.map(achar).filter(Boolean);
        const modulos = brutos.filter((x) => !achar(x) && !/^n[aã]o/i.test(kd(x)));
        if (ds2.length) dd.disciplinas = ds2;
        if (modulos.length) discModulos.push({ dd, nomes: modulos, prob, n, ln });
        else if (!ds2.length) prob.push(t(naoDiz ? "ep_iac_d_naodiz" : "ep_iac_d_disc"));
      }
      if (dd.pontos > 0) c.discursiva = "sim";
      rel(n, ln, prob.length ? "aviso" : "ok", t("ep_iac_d_ok", { p: dd.pontos || "?", o: dd.objetiva || "?" }) + (prob.length ? " " + t("ep_iac_falta", { l: prob.join("; ") }) : ""));
      lidas++;
      return;
    }
    const d0 = achar(p[0]);
    if (!d0) { avisos.push(t("ep_ia_av_disc", { d: p[0] })); rel(n, ln, "erro", t("ep_iac_disc_nao", { d: p[0], l: nomes.map(hubDiscCurtaSeg).join(", ") })); return; }
    const d = c.ds.find((x) => x.nome === d0);
    const prob = [];
    if (p.length < 5) prob.push(t("ep_iac_colunas", { n: p.length }));
    if (!numOk(p[1])) prob.push(t("ep_iac_num", { x: p[1], c: t("ep_iac_c_q") }));
    if (!numOk(p[2])) prob.push(t("ep_iac_num", { x: p[2], c: t("ep_iac_c_p") }));
    if (vistas[d0]) prob.push(t("ep_iac_repetida"));
    vistas[d0] = true;
    const q = num(p[1]), pt = num(p[2]);
    let oQue;
    if (pt > 0) { d.abs = pt; d.unidade = "p"; comPontos++; comVale++; oQue = q > 0 ? t("ep_iac_qp", { q, p: pt }) : t("ep_iac_p", { p: pt }); }
    else if (q > 0) { d.abs = q; d.unidade = "q"; comVale++; oQue = t("ep_iac_q", { q }); }
    else oQue = t("ep_iac_sem_num");
    const mtx = (p[3] || "").trim();
    let min = null;
    if (/%/.test(mtx) && num(mtx) > 0) min = { tipo: "pct", valor: num(mtx) };
    else if (num(mtx) > 0 && /acert|quest/i.test(mtx)) min = { tipo: "abs", valor: num(mtx) };
    else if (num(mtx) > 0) min = { tipo: "pct", valor: num(mtx) };
    else if (!vazio(mtx)) prob.push(t("ep_iac_min", { x: mtx }));
    let g = (p[4] || "").replace(/^-+$/, "").replace(/[|&@#]/g, "").trim();
    /* (19.80.0) "Conhecimentos Específicos: -" ou "…: 50%": o que vem depois dos dois-pontos é o mínimo, não o nome */
    const mdp = g.match(/^(.*?)\s*:\s*(-+|\d+(?:[.,]\d+)?\s*%?)\s*$/);
    if (mdp && mdp[1].trim()) { g = mdp[1].trim(); if (!min && /\d/.test(mdp[2])) min = { tipo: "pct", valor: num(mdp[2]) }; }
    /* (19.60.1) "Conhecimentos Específicos (50%)": o "(50%)" é o mínimo do bloco, não parte do nome */
    const mg = g.match(/^(.*?)\s*\(\s*(?:m[íi]n(?:imo)?\s*:?\s*)?(\d+(?:[.,]\d+)?)\s*(%|acertos?)?\s*\)\s*$/i);
    if (mg && mg[1].trim()) {
      g = mg[1].trim();
      if (!min) min = mg[3] && /acert/i.test(mg[3]) ? { tipo: "abs", valor: num(mg[2]) } : { tipo: "pct", valor: num(mg[2]) };
    }
    const kg = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const jaExiste = c.grupos.find((x) => kg(x.nome) === kg(g));
    if (jaExiste) g = jaExiste.nome;
    let ondeMin;
    if (g && !/^(nenhum|n[aã]o|sem)$/i.test(g)) {
      d.grupo = g; d.min = null;
      if (!c.grupos.some((x) => x.nome === g)) c.grupos.push({ nome: g, min: null });
      if (min) minimos[g] = min;
      ondeMin = min ? t("ep_iac_min_bloco", { m: epMinTexto(min), g }) : t("ep_iac_bloco_sem", { g });
    } else { d.grupo = ""; d.min = min; ondeMin = min ? t("ep_iac_min_dela", { m: epMinTexto(min) }) : t("ep_iac_sem_min"); }
    rel(n, ln, prob.length ? "aviso" : "ok", hubDiscCurtaSeg(d0) + ": " + oQue + "; " + ondeMin + "." + (prob.length ? " " + prob.join(" ") : ""));
    lidas++;
  });
  c.grupos.forEach((g) => { if (minimos[g.nome]) g.min = minimos[g.nome]; });
  /* (19.80.0) a discursiva que "cai em Conhecimentos Específicos": as disciplinas desse grupo; sem grupo com esse nome e
   * com o nome falando em "específic", as disciplinas sem número próprio (as gerais vêm numeradas, as específicas não) */
  discModulos.forEach((x) => {
    const kd = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    let achadas = [];
    x.nomes.forEach((nm) => {
      const g = c.ds.filter((d) => d.grupo && (kd(d.grupo) === kd(nm) || kd(d.grupo).indexOf(kd(nm)) >= 0 || kd(nm).indexOf(kd(d.grupo)) >= 0));
      if (g.length) achadas = achadas.concat(g.map((d) => d.nome));
      else if (/espec/i.test(kd(nm)) && c.ds.some((d) => d.abs > 0)) achadas = achadas.concat(c.ds.filter((d) => !(d.abs > 0)).map((d) => d.nome));
    });
    achadas = achadas.filter((v, i, a) => a.indexOf(v) === i);
    if (achadas.length) x.dd.disciplinas = (x.dd.disciplinas || []).concat(achadas.filter((v) => (x.dd.disciplinas || []).indexOf(v) < 0));
    else x.prob.push(t("ep_iac_d_naoachou", { l: x.nomes.join(", ") }));
    const r0 = linhas.find((y) => y.n === x.n);
    if (r0) { r0.tipo = x.prob.length ? "aviso" : "ok"; r0.msg = t("ep_iac_d_ok", { p: x.dd.pontos || "?", o: x.dd.objetiva || "?" }) + (achadas.length ? " " + t("ep_iac_d_modulo", { n: achadas.length }) : "") + (x.prob.length ? " " + t("ep_iac_falta", { l: x.prob.join("; ") }) : ""); }
  });
  c.grupos = c.grupos.filter((g) => c.ds.some((x) => x.grupo === g.nome));
  /* questões e pontos misturados não somam: se veio algum em pontos, quem veio só em questões fica sem número */
  if (comPontos && comPontos < comVale) avisos.push(t("ep_ia_av_misto"));
  if (comVale && comVale === c.ds.length) c.peso = "sim";
  else if (comVale) avisos.push(t("ep_ia_av_parcial", { n: comVale, t: c.ds.length, l: c.ds.filter((d) => !(d.abs > 0)).map((d) => d.nome).join(", ") }));
  const semLinha = nomes.filter((x) => !vistas[x]);
  if (lidas && semLinha.length) avisos.push(t("ep_iac_sem_linha", { l: semLinha.join(", ") }));
  if (c.grupos.some((g) => g.min) || c.ds.some((d) => d.min)) c.minimo = "sim";
  epPintar();
  epMarcarMudancas();
  /* (19.63.0) a contagem vem dos DADOS (o que muda no edital), não de quantos campos estão na tela */
  const mudados = epMudancas(c).length + (c.discursiva !== (c.orig || {}).discursiva || JSON.stringify(c.disc) !== JSON.stringify((c.orig || {}).disc) ? 1 : 0)
    + (c.grupos.length !== ((c.orig || {}).grupos || []).length ? 1 : 0);
  const resumo = lidas ? t("ep_ia_lido", { n: lidas, m: mudados }) : t("ep_ia_nada");
  if ($("epMsg")) $("epMsg").textContent = resumo + (avisos.length ? " " + avisos.join(" ") : "");
  epPintarConfIA({ lidas, mudados, avisos, linhas, resumo });
  try { reg("EDITAL", "como a prova pontua: resposta da IA lida", lidas + " linha(s), " + mudados + " campo(s) mudaram, " + linhas.filter((x) => x.tipo !== "ok").length + " com problema"); } catch (e) {}
  return { lidas, avisos, linhas, mudados };
}

/* o relatório do "preencher", logo abaixo da caixa: o resumo, os avisos e cada linha com ✓ ⚠ ✕ ℹ */
function epPintarConfIA(r) {
  const cx = $("epIaConf");
  if (!cx) return;
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  cx.innerHTML = "";
  cx.hidden = false;
  cx.className = "ep-ia-conf " + (r.lidas ? "ep-iac-feito" : "ep-iac-nada");
  cx.append(el("div", "ep-iac-resumo", (r.lidas ? "✓ " : "✕ ") + r.resumo));
  r.avisos.forEach((a) => cx.append(el("div", "ep-iac-aviso", "⚠ " + a)));
  if (r.linhas.length) {
    const ul = el("ul", "ep-iac-linhas");
    const SIMB = { ok: "✓", aviso: "⚠", erro: "✕", info: "ℹ" };
    r.linhas.forEach((x) => {
      const li = el("li", "ep-iac-" + x.tipo);
      li.append(el("span", "ep-iac-n", SIMB[x.tipo] + " " + t("ep_iac_linha", { n: x.n })));
      li.append(el("code", "ep-iac-txt", x.txt.length > 90 ? x.txt.slice(0, 88) + "…" : x.txt));
      li.append(el("span", "ep-iac-msg", x.msg));
      ul.append(li);
    });
    cx.append(ul);
  }
  if (!r.lidas) cx.append(el("div", "ep-iac-formato", t("ep_iac_formato")));
  try { if (cx.scrollIntoView) cx.scrollIntoView({ block: "nearest" }); } catch (e) {}
  try { toastMsg(r.resumo, 5000); } catch (e) {}
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("dlgEdPontua")) {
  const lig = (id, fn) => { const x = document.getElementById(id); if (x) x.onclick = fn; };
  /* (19.59.0) gravar pergunta antes, mostrando o que muda; sair com mudanças também pergunta (inclusive pelo Esc) */
  lig("btnEpGravar", () => epGravarConfirmando());
  lig("btnEpCancelar", () => epFechar());
  lig("btnEpX", () => epFechar());
  const dlgP = document.getElementById("dlgEdPontua");
  if (dlgP.addEventListener) dlgP.addEventListener("cancel", (ev) => { ev.preventDefault(); epFechar(); });
  lig("btnEpIaCopiar", () => epCopiarIA());
  lig("btnEpIaLer", () => epLerIA(document.getElementById("epIaResp").value));
  ["sim", "nao"].forEach((v) => {
    const a = document.getElementById("epPeso_" + v), b = document.getElementById("epMin_" + v), dz = document.getElementById("epDisc_" + v);
    if (a) a.onchange = () => { if (epCtx) { epCtx.peso = v; epPintar(); } };
    if (b) b.onchange = () => { if (epCtx) { epCtx.minimo = v; epPintar(); } };
    if (dz) dz.onchange = () => { if (epCtx) { epCtx.discursiva = v; epPintar(); } };
  });
}
