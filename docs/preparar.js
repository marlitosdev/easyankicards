/* =====================================================================
 * PREPARAR O TÓPICO (19.123.0) — um pedido, uma resposta, uma conferência
 *
 * O RELATO: "ando perdendo muito tempo com o botão estudar da agenda da semana (…) passo 30% do meu tempo para criar
 * o material de estudo. Criando questões, criando resumo, criando cartões."
 *
 * O QUE SE MEDIU: a ficha do tópico é por RAMO, e cada ramo tem três criações separadas (resumo, cartões, questões),
 * cada uma com a sua janela, o seu pedido para copiar, a sua resposta para colar, a sua conferência e o seu gravar.
 * No edital ativo há 15 tópicos com ramos, 8,6 ramos em média e até 12: um tópico pode pedir 36 idas e voltas à IA.
 *
 * O QUE MUDA: UMA ida e volta por tópico. O pedido único entrega, em blocos marcados, os ramos (quando o tópico ainda
 * não tem), o resumo por ramo, as questões e os cartões — cada item já dizendo de qual ramo é. A resposta única é
 * separada pelos blocos e lida pelos MESMOS leitores de sempre (riaLerResposta, qsLerResposta, parseText). A
 * conferência é uma só e mostra as exceções; o gravar é um só, com um desfazer.
 *
 * A COBERTURA É MEDIDA PELO APP, não prometida pela IA: para cada ramo, a tabela diz se veio resumo, quantas questões
 * e quantos cartões. O que faltou vira um pedido de continuação pronto — só do que falta.
 * ===================================================================== */
const PREP_FONTE_CH = "eac_prep_fonte";      /* { chave: "resumo" | "anexo" | "caderno" } — a fonte lembrada por tópico */
const PREP_FONTES = ["resumo", "anexo", "caderno"];
const PREP_BLOCOS = ["RAMOS", "RESUMO", "QUESTOES", "CARTOES"];
/* A FONTE VAI INTEIRA. O pedido de questões cortava o resumo em 12 mil caracteres; um resumo real de 25 mil perdia
 * metade — e a metade cortada é um buraco de cobertura que ninguém vê. Aqui o limite é folgado, e passar dele é dito. */
const PREP_TEXTO_MAX = 60000;

/* o contexto: { disciplina, topico, chave, editalId, concurso, ramos:[{id, nome, nota}] } */
let prepCtx = null;
let prepLido = null;
let prepRecibo = null;

function prepFonteLer(chave) {
  try { const v = JSON.parse(localStorage.getItem(PREP_FONTE_CH) || "{}"); return PREP_FONTES.indexOf(v[chave]) >= 0 ? v[chave] : ""; } catch (e) { return ""; }
}
function prepFonteGravar(chave, f) {
  try { const v = JSON.parse(localStorage.getItem(PREP_FONTE_CH) || "{}") || {}; v[chave] = f; localStorage.setItem(PREP_FONTE_CH, JSON.stringify(v)); } catch (e) {}
}

/* O PEDIDO ÚNICO. o = { disciplina, topico, concurso, ramos:[{nome, nota}], partes:{resumo, questoes, cartoes},
 *   fonte, texto (o resumo, quando ele é a fonte), tags (as etiquetas dos cartões) } */
function prepPedido(o) {
  const p = o.partes || {};
  const ramos = (o.ramos || []).filter((r) => r && String(r.nome || "").trim());
  const L = [];
  const entregas = [];
  if (!ramos.length) entregas.push(t("prep_e_ramos"));
  if (p.resumo) entregas.push(t("prep_e_resumo"));
  if (p.questoes) entregas.push(t("prep_e_questoes"));
  if (p.cartoes) entregas.push(t("prep_e_cartoes"));
  L.push(t("prep_p_intro", { e: entregas.join("; ") }));
  L.push("");
  L.push(t("prep_p_contexto", { d: o.disciplina || "?", tp: o.topico || "?", c: o.concurso || "?" }));
  L.push("");
  L.push(t("prep_p_fonte_" + (PREP_FONTES.indexOf(o.fonte) >= 0 ? o.fonte : "anexo")));
  L.push("");
  if (ramos.length) {
    L.push(t("prep_p_ramos"));
    ramos.forEach((r) => L.push("- " + r.nome + (String(r.nota || "").trim() ? " — " + String(r.nota).trim() : "")));
  } else L.push(t("prep_p_ramos_sugerir"));
  L.push("");
  L.push(t("prep_p_regras"));
  L.push("");
  L.push(t("prep_p_blocos"));
  if (!ramos.length) { L.push(""); L.push(t("prep_p_b_ramos")); }
  if (p.resumo) { L.push(""); L.push(t("prep_p_b_resumo")); }
  if (p.questoes) { L.push(""); L.push(t("prep_p_b_questoes")); }
  if (p.cartoes) { L.push(""); L.push(t("prep_p_b_cartoes", { tags: (o.tags || []).join(" ") })); }
  L.push("");
  L.push(t("prep_p_cobertura"));
  if (o.fonte === "resumo" && String(o.texto || "").trim()) {
    L.push("");
    L.push(t("prep_p_texto"));
    L.push(String(o.texto).slice(0, PREP_TEXTO_MAX));
  }
  return L.join("\n");
}

/* o pedido da CONTINUAÇÃO: só o que a cobertura mostrou que falta */
function prepPedidoContinuar(ctx, cobertura, partes) {
  const p = partes || {};
  const linhas = [];
  (cobertura || []).forEach((c) => {
    const falta = [];
    if (p.resumo && !c.resumo) falta.push(t("prep_f_resumo"));
    if (p.questoes && !(c.questoes + (c.tinhaQ || 0))) falta.push(t("prep_f_questoes"));
    if (p.cartoes && !(c.cartoes + (c.tinhaC || 0))) falta.push(t("prep_f_cartoes"));
    if (falta.length) linhas.push("- " + c.nome + ": " + falta.join(", "));
  });
  if (!linhas.length) return "";
  return t("prep_p_continuar", { tp: (ctx && ctx.topico) || "?", lista: linhas.join("\n") });
}

/* o conteúdo de um bloco "[NOME] … [/NOME]"; sem o fecho, vai até o próximo bloco conhecido (ou o fim) */
function prepBloco(txt, nome) {
  const s = String(txt || "");
  const abre = new RegExp("\\[\\s*" + nome.replace("OES", "(?:OES|ÕES)") + "\\s*\\]", "i");
  const m = s.match(abre);
  if (!m) return "";
  const resto = s.slice(m.index + m[0].length);
  const fim = resto.search(new RegExp("\\[\\s*\\/\\s*" + nome.replace("OES", "(?:OES|ÕES)") + "\\s*\\]", "i"));
  let outro = -1;
  PREP_BLOCOS.filter((b) => b !== nome).forEach((b) => {
    const k = resto.search(new RegExp("^\\s*\\[\\s*" + b.replace("OES", "(?:OES|ÕES)") + "\\s*\\]\\s*$", "im"));
    if (k >= 0 && (outro < 0 || k < outro)) outro = k;
  });
  const corta = fim >= 0 && (outro < 0 || fim < outro) ? fim : outro;
  return (corta >= 0 ? resto.slice(0, corta) : resto).trim();
}

/* os cartões do bloco, cada um com o ramo do título "## Ramo — X" acima dele */
function prepLerCartoes(txt, ramos, chave) {
  const out = { cartoes: [], avisos: [], repetidos: 0 };
  if (!String(txt || "").trim()) return out;
  const grupos = [];
  let atual = { nome: "", linhas: [] };
  String(txt).split(/\r?\n/).forEach((l) => {
    const m = l.trim().match(/^#{1,6}\s*ramo(?:\s+sugerido)?\s*[—–:-]\s*(.+?)\s*#*$/i);
    if (m) { if (atual.linhas.some((x) => x.trim())) grupos.push(atual); atual = { nome: m[1].trim(), linhas: [] }; return; }
    atual.linhas.push(l);
  });
  if (atual.linhas.some((x) => x.trim())) grupos.push(atual);
  const jaTem = new Set(String(((typeof matResumos !== "undefined" && matResumos && matResumos[chave]) || {}).cartoes || "")
    .split("\n").map((l) => l.split("::")[0].trim().toLowerCase()).filter(Boolean));
  grupos.forEach((g) => {
    const r = parseText(g.linhas.join("\n"));
    const ramo = g.nome ? qsRamoPorNome(g.nome, ramos) : { nome: "" };
    (r.cards || []).forEach((c) => {
      const k = String(c.front || "").trim().toLowerCase();
      if (!k) return;
      if (jaTem.has(k)) { out.repetidos++; return; }
      jaTem.add(k);
      out.cartoes.push({ card: c, ramoId: ramo.id || "", ramoNome: ramo.nome || g.nome || "" });
    });
    (r.warnings || []).forEach((w, i) => out.avisos.push({ motivo: w, txt: ((r.ignorados || [])[i] || {}).texto || "" }));
  });
  return out;
}

/* A RESPOSTA ÚNICA → o que veio em cada bloco, lido pelos leitores de sempre, e a cobertura por ramo */
function prepLerResposta(txt, ctx, partes) {
  const c = ctx || {};
  const p = partes || { resumo: true, questoes: true, cartoes: true };
  const s = String((typeof semInvisiveis === "function" ? semInvisiveis(txt) : txt) || "").replace(/\r\n?/g, "\n");
  const out = { vazio: !s.trim(), ehPedido: false, ramosNovos: [], resumo: null, questoes: { achados: [], ignoradas: [] },
    cartoes: { cartoes: [], avisos: [], repetidos: 0 }, falta: [], cobertura: [], semBlocos: false };
  if (out.vazio) return out;
  if (/RESPONDA SÓ COM OS BLOCOS|ANSWER ONLY WITH THE BLOCKS/.test(s)) { out.ehPedido = true; return out; }
  const b = {};
  PREP_BLOCOS.forEach((n) => { b[n] = prepBloco(s, n); });
  /* sem bloco nenhum: pode ser só as questões (os [QUESTAO] soltos) — o resto fica vazio e a tela diz */
  out.semBlocos = !PREP_BLOCOS.some((n) => b[n]);
  if (!b.QUESTOES && /\[\s*QUEST[ÃA]O\s*\]/i.test(s)) b.QUESTOES = s;

  const existentes = (c.ramos || []).map((r) => ({ id: r.id, nome: r.nome }));
  if (b.RAMOS && !existentes.length) {
    let rl = { ramos: [] };
    try { rl = ramLerRespostaIA(b.RAMOS); } catch (e) { rl = { ramos: [] }; }
    out.ramosNovos = (rl.ramos || []).map((r) => ({ id: edRamoId(r.nome), nome: r.nome, nota: r.nota || "", novo: true })).filter((r) => r.id);
  }
  const ramos = existentes.concat(out.ramosNovos.map((r) => ({ id: r.id, nome: r.nome })));

  if (b.RESUMO && p.resumo !== false) {
    try { out.resumo = riaLerResposta(b.RESUMO, ramos, ""); } catch (e) { out.resumo = null; }
    if (out.resumo && (out.resumo.vazio || out.resumo.ehPedido || out.resumo.ehRamos)) out.resumo = null;
  }
  if (b.QUESTOES && p.questoes !== false) {
    const corpo = b.QUESTOES.replace(/^\s*FALTA\s*:.*$/gim, "");
    out.questoes = qsLerResposta(corpo, { disciplina: c.disciplina, topico: c.topico, chave: c.chave, concurso: c.concurso, ramos });
    /* o ramo sugerido que virou ramo novo: a questão já aponta para ele */
    out.questoes.achados.forEach((q) => {
      if (q.ramo || !q.ramoSugerido) return;
      const r = ramos.find((x) => x.id === edRamoId(q.ramoSugerido));
      if (r) { q.ramo = r.id; q.ramoNome = r.nome; delete q.ramoSugerido; }
    });
  }
  if (b.CARTOES && p.cartoes !== false) out.cartoes = prepLerCartoes(b.CARTOES, ramos, c.chave);
  (s.match(/^\s*FALTA\s*:\s*(.+)$/gim) || []).forEach((l) => out.falta.push(l.replace(/^\s*FALTA\s*:\s*/i, "").trim()));

  /* A COBERTURA, medida aqui: por ramo, o que veio */
  const atual = String(((typeof matObter === "function" && matObter(c.chave)) || {}).texto || "");
  let secAtuais = [];
  try { secAtuais = matSecoesDeRamo(atual, ramos).secoes.filter((x) => String(x.corpo || "").trim()).map((x) => x.id); } catch (e) { secAtuais = []; }
  /* o que o tópico JÁ TEM em cada ramo conta: sem isso, a tabela acusaria "falta" (e pediria de novo) num ramo que
   * já tem questões e cartões de antes */
  const banco = typeof qsTodas === "function" ? (qsTodas() || []).filter((q) => q && q.chave === c.chave) : [];
  const cartoesTxt = String(((typeof matObter === "function" && matObter(c.chave)) || {}).cartoes || "");
  /* a etiqueta inteira "ram_<id>" (não o começo de outra): conta pelas palavras da linha */
  const contaTag = (id) => {
    const alvo = ("ram_" + String(id)).toLowerCase();
    return cartoesTxt.split("\n").filter((l) => l.toLowerCase().split(/\s+/).indexOf(alvo) >= 0).length;
  };
  out.cobertura = ramos.map((r) => ({
    id: r.id, nome: r.nome, novo: out.ramosNovos.some((x) => x.id === r.id),
    tinhaQ: banco.filter((q) => q.ramo === r.id).length, tinhaC: contaTag(r.id),
    resumo: !!(out.resumo && out.resumo.secoes.some((x) => x.id === r.id && String(x.corpo || "").trim())) || secAtuais.indexOf(r.id) >= 0,
    questoes: out.questoes.achados.filter((q) => q.ramo === r.id).length,
    cartoes: out.cartoes.cartoes.filter((x) => x.ramoId === r.id).length,
  }));
  out.ramos = ramos;
  return out;
}

/* quantos itens prontos para gravar */
function prepContagem(l) {
  if (!l) return { questoes: 0, cartoes: 0, resumo: 0, ramos: 0, avisos: 0 };
  return {
    questoes: l.questoes.achados.length, cartoes: l.cartoes.cartoes.length,
    resumo: l.resumo ? l.resumo.secoes.filter((x) => String(x.corpo || "").trim()).length + (l.resumo.geral ? 1 : 0) : 0,
    ramos: l.ramosNovos.length,
    avisos: l.questoes.ignoradas.length + l.cartoes.avisos.length,
  };
}

/* GRAVAR TUDO: ramos novos (se o tópico está num edital), resumo (acrescenta), questões e cartões. Devolve o recibo. */
function prepGravar(lido, ctx, opc) {
  const o = opc || {};
  const c = ctx || {};
  const rec = { chave: c.chave, ramos: 0, resumo: null, questoes: null, cartoes: null };
  let ramos = (c.ramos || []).map((r) => ({ id: r.id, nome: r.nome }));
  /* 1. os ramos sugeridos viram ramos do tópico */
  if (lido.ramosNovos.length && o.criarRamos !== false && c.editalId && typeof ramAplicar === "function") {
    const linhas = (c.ramos || []).map((r) => ({ nome: r.nome, peso: r.herdado ? "" : (r.peso === undefined ? "" : String(r.peso)), nota: r.nota || "", idOrig: r.id }))
      .concat(lido.ramosNovos.map((r) => ({ nome: r.nome, peso: "", nota: r.nota || "" })));
    let res = null;
    try { res = ramAplicar({ editalId: c.editalId, disciplina: c.disciplina, topico: c.topico, chave: c.chave }, linhas); } catch (e) { res = null; }
    if (res && res.ok) { rec.ramos = lido.ramosNovos.length; ramos = res.ramos.map((r) => ({ id: r.id, nome: r.nome })); }
  }
  const idsValidos = new Set(ramos.map((r) => r.id));
  /* 2. o resumo: o que veio entra no FIM de cada parte (nada do que existe muda) */
  if (lido.resumo) {
    const reg0 = (typeof matObter === "function" && matObter(c.chave)) || {};
    const antes = String(reg0.texto || "");
    const depois = riaAplicarTexto(antes, lido.resumo, "acrescentar", ramos);
    if (depois !== antes) {
      matGravar(c.chave, depois, { disciplina: c.disciplina, topico: c.topico, concurso: c.concurso || reg0.concurso || "" });
      rec.resumo = { antes };
    }
  }
  /* 3. as questões (o ramo só fica se existe de verdade) */
  if (lido.questoes.achados.length) {
    lido.questoes.achados.forEach((q) => { if (q.ramo && !idsValidos.has(q.ramo)) { delete q.ramo; delete q.ramoNome; } });
    const r = qsAplicar(lido.questoes.achados);
    rec.questoes = { ids: r.ids, lote: r.lote, novas: r.novas, repetidas: r.repetidas };
  }
  /* 4. os cartões, com as etiquetas do tópico e a do ramo */
  if (lido.cartoes.cartoes.length) {
    const reg0 = (typeof matObter === "function" && matObter(c.chave)) || {};
    const concurso = c.concurso || reg0.concurso || "";
    const tags = matEtiquetasTopico(c.disciplina, c.topico, concurso, "resumo");
    const linhas = [];
    lido.cartoes.cartoes.forEach((x) => {
      const ex = cmExtrasCartao(x.card);
      const proprias = (x.card.tags || []).map((tg) => String(tg).replace(/::/g, "_")).filter((tg) => !/^ram_/i.test(tg));
      const doRamo = x.ramoId && idsValidos.has(x.ramoId) ? [RAM_PREFIXO + x.ramoId] : [];
      ex.antes.forEach((l) => linhas.push(l));
      linhas.push(cmCampo(x.card.front) + " :: " + cmCampo(x.card.back) + " :: " + matJuntarTags(tags, proprias, doRamo).join(" "));
      ex.depois.forEach((l) => linhas.push(l));
    });
    const antes = String(reg0.cartoes || "");
    matGravarCartoes(c.chave, (antes.replace(/\s*$/, "") ? antes.replace(/\s*$/, "") + "\n" : "") + linhas.join("\n"),
      { disciplina: c.disciplina, topico: c.topico, concurso });
    const alvo = typeof matResumos !== "undefined" && matResumos ? matResumos[c.chave] : null;
    if (alvo) {
      alvo.cartoesInfo = (alvo.cartoesInfo || []).concat([{ quando: new Date().toISOString(), n: lido.cartoes.cartoes.length, origem: "preparar", concurso,
        resumoChars: String(alvo.texto || "").length, app: (typeof VERSAO === "string" ? VERSAO : "") }]);
      try { matSalvar(); } catch (e) {}
    }
    rec.cartoes = { antes, n: lido.cartoes.cartoes.length };
  }
  try {
    reg("PREPARAR", "tópico preparado", c.topico + " · " + (rec.questoes ? rec.questoes.novas : 0) + " questão(ões) · " + (rec.cartoes ? rec.cartoes.n : 0)
      + " cartão(ões) · resumo " + (rec.resumo ? "acrescentado" : "sem mudança") + (rec.ramos ? " · " + rec.ramos + " ramo(s) criado(s)" : ""));
  } catch (e) {}
  return rec;
}

/* DESFAZER o que o "gravar tudo" pôs: questões, cartões e resumo. Os ramos criados ficam (têm o desfazer deles). */
function prepDesfazer(rec) {
  if (!rec || !rec.chave) return false;
  const reg0 = (typeof matObter === "function" && matObter(rec.chave)) || {};
  const meta = { disciplina: reg0.disciplina, topico: reg0.topico, concurso: reg0.concurso || "" };
  if (rec.questoes && rec.questoes.ids) { try { qsDesfazer(rec.questoes); } catch (e) {} }
  if (rec.cartoes) { try { matGravarCartoes(rec.chave, rec.cartoes.antes, meta); } catch (e) {} }
  if (rec.resumo) { try { matGravar(rec.chave, rec.resumo.antes, meta); } catch (e) {} }
  try { reg("PREPARAR", "preparo desfeito", String(reg0.topico || rec.chave)); } catch (e) {}
  return true;
}

/* ------------------------------- a tela ------------------------------ */
function prepPartes() {
  return { resumo: !!($("prepPResumo") && $("prepPResumo").checked), questoes: !!($("prepPQuestoes") && $("prepPQuestoes").checked),
    cartoes: !!($("prepPCartoes") && $("prepPCartoes").checked) };
}
function prepFonteEscolhida() {
  const r = PREP_FONTES.find((f) => $("prepFonte_" + f) && $("prepFonte_" + f).checked);
  return r || "anexo";
}
function prepMontarPedido() {
  if (!prepCtx) return "";
  const reg0 = (typeof matObter === "function" && matObter(prepCtx.chave)) || {};
  return prepPedido({
    disciplina: prepCtx.disciplina, topico: prepCtx.topico, concurso: prepCtx.concurso,
    ramos: prepCtx.ramos, partes: prepPartes(), fonte: prepFonteEscolhida(), texto: reg0.texto || "",
    tags: matEtiquetasTopico(prepCtx.disciplina, prepCtx.topico, prepCtx.concurso, "resumo"),
  });
}

function prepEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

/* a conferência única: contadores, a cobertura por ramo e só as exceções */
function prepPintarConferencia() {
  const cx = $("prepConf");
  if (!cx) return;
  cx.textContent = "";
  const l = prepLido;
  const b = $("btnPrepGravar");
  if (b) b.disabled = true;
  if ($("btnPrepContinuar")) $("btnPrepContinuar").hidden = true;
  if (!l || l.vazio) return;
  if (l.ehPedido) { cx.append(prepEl("p", "prep-aviso", t("prep_c_eh_pedido"))); return; }
  const n = prepContagem(l);
  const chips = prepEl("div", "mc-status");
  const chip = (txt, cls) => chips.append(prepEl("span", "mc-chip " + (cls || "mc-chip-ok"), txt));
  if (n.ramos) chip(t("prep_c_ramos", { n: n.ramos }));
  chip(t("prep_c_resumo", { n: n.resumo }), n.resumo ? "" : "mc-chip-rep");
  chip(t("prep_c_questoes", { n: n.questoes }), n.questoes ? "" : "mc-chip-rep");
  chip(t("prep_c_cartoes", { n: n.cartoes }), n.cartoes ? "" : "mc-chip-rep");
  if (n.avisos) chip(t("mc_chip_avisos", { a: n.avisos }), "mc-chip-av");
  cx.append(chips);
  if (l.semBlocos && !n.questoes) cx.append(prepEl("p", "prep-aviso", t("prep_c_sem_blocos")));

  /* a cobertura por ramo */
  const partes = prepPartes();
  if (l.cobertura.length) {
    const tab = prepEl("table", "fatos-tab prep-cob");
    const cab = prepEl("tr");
    [["prep_h_ramo", ""], ["prep_h_resumo", "fatos-num"], ["prep_h_questoes", "fatos-num"], ["prep_h_cartoes", "fatos-num"]].forEach(([k, c2]) => cab.append(prepEl("th", c2, t(k))));
    const th = prepEl("thead"); th.append(cab); tab.append(th);
    const tb = prepEl("tbody");
    let buracos = 0;
    l.cobertura.forEach((c) => {
      const tr = prepEl("tr");
      const c0 = prepEl("td"); c0.append(prepEl("span", "fatos-top", c.nome)); if (c.novo) c0.append(prepEl("span", "mc-selo mc-selo-suspeito prep-novo", t("prep_novo")));
      tr.append(c0);
      const cel = (ok, txt, pede) => { const td = prepEl("td", "fatos-num" + (pede && !ok ? " prep-falta" : ""), txt); if (pede && !ok) buracos++; return td; };
      /* "2 novas (+3)": o que veio agora e, entre parênteses, o que o ramo já tinha */
      const num = (novo, tinha) => (novo ? String(novo) : "—") + (tinha ? " " + t("prep_ja_tinha", { n: tinha }) : "");
      tr.append(cel(c.resumo, c.resumo ? "✓" : "—", partes.resumo));
      tr.append(cel(c.questoes + (c.tinhaQ || 0) > 0, num(c.questoes, c.tinhaQ), partes.questoes));
      tr.append(cel(c.cartoes + (c.tinhaC || 0) > 0, num(c.cartoes, c.tinhaC), partes.cartoes));
      tb.append(tr);
    });
    tab.append(tb);
    const rol = prepEl("div", "fatos-rol"); rol.append(tab);
    cx.append(prepEl("div", "prep-cob-tit", t("prep_cob_tit")), rol);
    if (buracos) {
      cx.append(prepEl("p", "prep-aviso", t("prep_cob_buracos", { n: buracos })));
      if ($("btnPrepContinuar")) $("btnPrepContinuar").hidden = false;
    } else cx.append(prepEl("p", "prep-ok", t("prep_cob_ok")));
  }
  if (l.falta.length) cx.append(prepEl("p", "prep-aviso", t("prep_c_falta", { f: l.falta.join("; ") })));
  if (l.ramosNovos.length && !(prepCtx && prepCtx.editalId)) cx.append(prepEl("p", "prep-aviso", t("prep_c_ramos_sem_edital")));

  /* só as exceções, agrupadas */
  const avisos = [];
  l.questoes.ignoradas.forEach((x) => avisos.push({ onde: t("prep_h_questoes"), motivo: x.motivo, txt: x.txt }));
  l.cartoes.avisos.forEach((x) => avisos.push({ onde: t("prep_h_cartoes"), motivo: x.motivo, txt: x.txt }));
  if (l.cartoes.repetidos) avisos.push({ onde: t("prep_h_cartoes"), motivo: t("prep_c_repetidos", { n: l.cartoes.repetidos }), txt: "" });
  if (avisos.length) {
    const ul = prepEl("ul", "mc-recusadas-lista");
    avisos.slice(0, 30).forEach((a) => {
      const li = prepEl("li", "mc-recusada mc-recusada-recusada");
      const cab = prepEl("div", "mc-recusada-cab");
      cab.append(prepEl("span", "mc-selo mc-selo-recusada", a.onde), prepEl("span", "mc-motivo", a.motivo));
      li.append(cab);
      if (a.txt) li.append(prepEl("div", "mc-recusada-txt mc-curto", a.txt));
      ul.append(li);
    });
    cx.append(ul);
  }
  if (b) b.disabled = !(n.questoes || n.cartoes || n.resumo || n.ramos);
  if (b) b.textContent = t("prep_gravar_n", { q: n.questoes, c: n.cartoes, r: n.resumo });
}

function prepConferir() {
  if (!prepCtx) return null;
  prepLido = prepLerResposta($("prepResposta").value, prepCtx, prepPartes());
  prepPintarConferencia();
  try { if (!prepLido.vazio) { const n = prepContagem(prepLido); reg("PREPARAR", "resposta conferida", prepCtx.topico + " · " + n.questoes + " questão(ões) · " + n.cartoes + " cartão(ões) · " + n.resumo + " parte(s) de resumo · " + n.avisos + " aviso(s)"); } } catch (e) {}
  return prepLido;
}

function prepPintar() {
  if (!prepCtx) return;
  const reg0 = (typeof matObter === "function" && matObter(prepCtx.chave)) || {};
  const temResumo = String(reg0.texto || "").trim().length;
  $("prepTit").textContent = t("prep_titulo", { tp: prepCtx.topico });
  $("prepSub").textContent = t("prep_tem", {
    d: prepCtx.disciplina, r: prepCtx.ramos.length, c: temResumo,
    q: typeof qsContarDoTopico === "function" ? qsContarDoTopico(prepCtx.chave) : 0,
    k: typeof matContarCartoes === "function" ? matContarCartoes(prepCtx.chave) : 0,
  });
  /* o resumo já existe: não se pede outro por padrão, e ele pode ser a fonte */
  $("prepPResumo").checked = temResumo < 200;
  $("prepPQuestoes").checked = true;
  $("prepPCartoes").checked = true;
  const lembrada = prepFonteLer(prepCtx.chave);
  const padrao = lembrada || (temResumo >= 200 ? "resumo" : "anexo");
  PREP_FONTES.forEach((f) => { if ($("prepFonte_" + f)) $("prepFonte_" + f).checked = f === padrao; });
  if ($("prepFonte_resumo")) $("prepFonte_resumo").disabled = temResumo < 200;
  if (temResumo < 200 && padrao === "resumo") $("prepFonte_anexo").checked = true;
  $("prepResposta").value = "";
  $("prepPedidoTxt").value = ""; $("prepPedidoTxt").hidden = true;
  $("prepMsg").textContent = ""; $("prepMsg").hidden = true;
  if ($("btnPrepDesfazer")) $("btnPrepDesfazer").hidden = true;
  prepLido = null;
  prepPintarConferencia();
}

function prepCopiar(texto, chaveMsg) {
  const txt = texto || prepMontarPedido();
  $("prepPedidoTxt").value = txt;
  let copiou = false;
  try { const p = navigator.clipboard && navigator.clipboard.writeText(txt); copiou = !!p; if (p && p.catch) p.catch(() => { $("prepPedidoTxt").hidden = false; }); } catch (e) { copiou = false; }
  if (!copiou) $("prepPedidoTxt").hidden = false;
  $("prepMsg").textContent = t(copiou ? (chaveMsg || "prep_copiado") : "prep_copie_a_mao", { n: txt.length });
  /* a fonte não coube inteira: dito na hora, para a pessoa mandar o material junto em vez de confiar no corte */
  try {
    const nRes = String(((typeof matObter === "function" && matObter(prepCtx.chave)) || {}).texto || "").length;
    if (!texto && prepFonteEscolhida() === "resumo" && nRes > PREP_TEXTO_MAX) $("prepMsg").textContent += " " + t("prep_fonte_cortada", { n: nRes, m: PREP_TEXTO_MAX });
  } catch (e) {}
  $("prepMsg").hidden = false;
  try { prepFonteGravar(prepCtx.chave, prepFonteEscolhida()); } catch (e) {}
  try { reg("PREPARAR", "pedido copiado", prepCtx.topico + " · " + txt.length + " caracteres · fonte: " + prepFonteEscolhida()); } catch (e) {}
  return txt;
}

async function prepAplicar() {
  if (!prepCtx || !prepLido) return null;
  const n = prepContagem(prepLido);
  if (!(n.questoes || n.cartoes || n.resumo || n.ramos)) return null;
  prepRecibo = prepGravar(prepLido, prepCtx, {});
  const r = prepRecibo;
  $("prepResposta").value = "";
  prepLido = null;
  prepPintarConferencia();
  $("prepMsg").textContent = t("prep_gravado", { q: r.questoes ? r.questoes.novas : 0, c: r.cartoes ? r.cartoes.n : 0,
    r: r.resumo ? t("prep_gravado_resumo") : "", m: r.ramos ? t("prep_gravado_ramos", { n: r.ramos }) : "",
    rep: r.questoes && r.questoes.repetidas ? t("prep_gravado_rep", { n: r.questoes.repetidas }) : "" });
  $("prepMsg").hidden = false;
  if ($("btnPrepDesfazer")) $("btnPrepDesfazer").hidden = false;
  /* os ramos podem ter mudado: o contexto acompanha */
  try {
    if (r.ramos && prepCtx.editalId) {
      const ed = (typeof editais !== "undefined" ? editais : []).find((e) => e.id === prepCtx.editalId);
      if (ed) prepCtx.ramos = edRamosDoTopico(ed.texto || "", prepCtx.disciplina, prepCtx.topico);
    }
  } catch (e) {}
  try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
  prepPintarCabecalho();
  return r;
}
function prepPintarCabecalho() {
  if (!prepCtx || !$("prepSub")) return;
  const reg0 = (typeof matObter === "function" && matObter(prepCtx.chave)) || {};
  $("prepSub").textContent = t("prep_tem", { d: prepCtx.disciplina, r: prepCtx.ramos.length, c: String(reg0.texto || "").trim().length,
    q: typeof qsContarDoTopico === "function" ? qsContarDoTopico(prepCtx.chave) : 0, k: typeof matContarCartoes === "function" ? matContarCartoes(prepCtx.chave) : 0 });
}

/* abre para um tópico. ctx = { disciplina, topico, chave, editalId, ramos, concurso } */
function prepAbrir(ctx) {
  if (!ctx || !ctx.chave || !$("dlgPreparar")) return false;
  let concurso = ctx.concurso || "";
  try { if (!concurso && typeof concursoAtual === "function") concurso = concursoAtual().nome || ""; } catch (e) {}
  prepCtx = { disciplina: ctx.disciplina || "", topico: ctx.topico || "", chave: ctx.chave, editalId: ctx.editalId || "",
    concurso, ramos: (ctx.ramos || []).map((r) => ({ id: r.id, nome: r.nome, nota: r.nota || "", peso: r.peso, herdado: r.herdado })) };
  prepPintar();
  abrirModal("dlgPreparar");
  try { reg("PREPARAR", "preparar tópico aberto", prepCtx.topico + " · " + prepCtx.ramos.length + " ramo(s)"); } catch (e) {}
  return true;
}
/* da ficha do tópico (o "▶ Estudar"): o mesmo tópico, os mesmos ramos */
function prepAbrirDaFicha() {
  if (typeof matFichaAtual === "undefined" || !matFichaAtual) return false;
  const x = matFichaAtual, o = (typeof matFichaOpc !== "undefined" && matFichaOpc) || {};
  try { if ($("dlgMatFicha") && $("dlgMatFicha").open) $("dlgMatFicha").close(); } catch (e) {}
  return prepAbrir({ disciplina: x.disciplina, topico: x.topico, chave: x.chave, editalId: o.editalId || (typeof editalAtual !== "undefined" ? editalAtual : "") || "",
    ramos: o.ramos || [], concurso: x.concurso || "" });
}

function prepIniciar() {
  if (!$("dlgPreparar")) return;
  const liga = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  liga("btnMatFichaPreparar", () => prepAbrirDaFicha());
  liga("btnPrepCopiar", () => prepCopiar());
  liga("btnPrepVer", () => { $("prepPedidoTxt").value = prepMontarPedido(); $("prepPedidoTxt").hidden = !$("prepPedidoTxt").hidden; });
  liga("btnPrepColar", async () => {
    let lido = "";
    try { lido = await navigator.clipboard.readText(); } catch (e) { lido = ""; }
    if (!String(lido).trim()) { $("prepMsg").textContent = t("prep_colar_vazio"); $("prepMsg").hidden = false; return; }
    const antes = String($("prepResposta").value || "");
    /* acrescenta: a continuação entra depois do que já veio, e a conferência lê tudo junto */
    $("prepResposta").value = antes.trim() ? antes.replace(/\s*$/, "") + "\n\n" + lido : lido;
    prepConferir();
  });
  liga("btnPrepConferir", () => prepConferir());
  liga("btnPrepContinuar", () => {
    if (!prepLido) return;
    const txt = prepPedidoContinuar(prepCtx, prepLido.cobertura, prepPartes());
    if (txt) prepCopiar(txt, "prep_copiado_cont");
  });
  liga("btnPrepGravar", () => prepAplicar());
  liga("btnPrepDesfazer", () => {
    if (!prepRecibo) return;
    prepDesfazer(prepRecibo); prepRecibo = null;
    $("btnPrepDesfazer").hidden = true;
    $("prepMsg").textContent = t("prep_desfeito"); $("prepMsg").hidden = false;
    try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
    prepPintarCabecalho();
  });
  liga("btnPrepFechar", () => $("dlgPreparar").close());
  liga("btnPrepX", () => $("dlgPreparar").close());
  if ($("prepResposta")) $("prepResposta").addEventListener("input", () => prepConferir());
  ["prepPResumo", "prepPQuestoes", "prepPCartoes"].forEach((id) => { if ($(id)) $(id).onchange = () => { if (prepLido) prepConferir(); }; });
}
