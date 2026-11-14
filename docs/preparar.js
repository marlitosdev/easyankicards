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
/* (19.125.0) DIRETO PELO GEMINI: opcional e desligado; a pessoa liga na tela da chave, que diz o que vai ao Google */
const PREP_IA_CH = "eac_prep_ia_direta";
const PREP_IA_TEMPO = 300000;            /* um tópico inteiro demora: 5 minutos antes de desistir */
const PREP_TEXTO_MAX_DIRETO = 600000;    /* direto, a aula vai inteira (o colar numa conversa é que tem limite) */
/* o TEXTO da aula lido do PDF, só nesta sessão: { chave, quando (da impressão), textos[] } — nunca é guardado */
let prepAula = null;
let prepIaRodando = false;

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
  /* (19.125.0) o texto vai dividido em trechos numerados, e cada questão diz de qual saiu */
  if (o.numerada) L.push(t("prep_p_numerada"));
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
  if (p.questoes) {
    let bq = t("prep_p_b_questoes");
    if (o.numerada) bq = bq.replace(/^(RAMO:.*)$/m, (m0) => m0 + "\n" + t("prep_p_trecho_linha"));
    L.push(""); L.push(bq);
  }
  if (p.cartoes) { L.push(""); L.push(t("prep_p_b_cartoes", { tags: (o.tags || []).join(" ") })); }
  L.push("");
  L.push(t("prep_p_cobertura"));
  if (o.fonte === "resumo" && String(o.texto || "").trim()) {
    L.push("");
    L.push(t("prep_p_texto"));
    L.push(String(o.texto).slice(0, o.textoMax || PREP_TEXTO_MAX));
  }
  /* depois de um texto longo, o que fazer é dito de novo (e, na continuação, o que falta) */
  if (o.sufixo) { L.push(""); L.push(o.sufixo); }
  return L.join("\n");
}

/* o pedido da CONTINUAÇÃO: só o que a cobertura mostrou que falta */
function prepListaDoQueFalta(cobertura, partes, cobFonte, comCodigo) {
  const p = partes || {};
  const linhas = [];
  /* (19.124.0) os trechos da FONTE que nenhum item do tópico cobre: com o título, a página e as palavras deles */
  const trechos = typeof cfLinhasDoQueFalta === "function" ? cfLinhasDoQueFalta(cobFonte, 20, comCodigo) : [];
  (cobertura || []).forEach((c) => {
    const falta = [];
    if (p.resumo && !c.resumo) falta.push(t("prep_f_resumo"));
    if (p.questoes && !(c.questoes + (c.tinhaQ || 0))) falta.push(t("prep_f_questoes"));
    if (p.cartoes && !(c.cartoes + (c.tinhaC || 0))) falta.push(t("prep_f_cartoes"));
    if (falta.length) linhas.push("- " + c.nome + ": " + falta.join(", "));
  });
  if (!linhas.length && !trechos.length) return "";
  const partesTxt = [];
  if (linhas.length) partesTxt.push(linhas.join("\n"));
  if (trechos.length) partesTxt.push(t("prep_p_cont_trechos", { n: cobFonte.faltam.length }) + "\n" + trechos.join("\n"));
  return partesTxt.join("\n\n");
}
function prepPedidoContinuar(ctx, cobertura, partes, cobFonte) {
  const lista = prepListaDoQueFalta(cobertura, partes, cobFonte, false);
  return lista ? t("prep_p_continuar", { tp: (ctx && ctx.topico) || "?", lista }) : "";
}

/* o conteúdo de um bloco "[NOME] … [/NOME]"; sem o fecho, vai até o próximo bloco conhecido (ou o fim) */
/* (19.125.0) TODAS AS VEZES QUE O BLOCO APARECE. A continuação entra depois da primeira resposta, e a caixa passa a ter
 * dois [QUESTOES], dois [CARTOES]… Só o primeiro era lido: as questões da segunda resposta ficavam de fora, caladas. */
function prepBlocosDe(txt, nome) {
  let s = String(txt || "");
  const N = (b) => b.replace("OES", "(?:OES|ÕES)");
  const abre = new RegExp("\\[\\s*" + N(nome) + "\\s*\\]", "i");
  const fecha = new RegExp("\\[\\s*\\/\\s*" + N(nome) + "\\s*\\]", "i");
  const partes = [];
  for (let volta = 0; volta < 60; volta++) {
    const m = s.match(abre);
    if (!m) break;
    const resto = s.slice(m.index + m[0].length);
    const fim = resto.search(fecha);
    let outro = -1;
    /* sem o fecho, o bloco acaba onde outro começa — inclusive o MESMO, aberto de novo por outra resposta */
    PREP_BLOCOS.forEach((b) => {
      const k = resto.search(new RegExp("^\\s*\\[\\s*" + N(b) + "\\s*\\]\\s*$", "im"));
      if (k >= 0 && (outro < 0 || k < outro)) outro = k;
    });
    const noFecho = fim >= 0 && (outro < 0 || fim < outro);
    const corta = noFecho ? fim : outro;
    const corpo = (corta >= 0 ? resto.slice(0, corta) : resto).trim();
    if (corpo) partes.push(corpo);
    if (corta < 0) break;
    s = resto.slice(corta + (noFecho ? (resto.slice(corta).match(fecha) || [""])[0].length : 0));
  }
  return partes;
}
function prepBloco(txt, nome) { return prepBlocosDe(txt, nome).join("\n\n"); }

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
    out.ramosNovos = (rl.ramos || []).map((r) => ({ id: edRamoId(r.nome), nome: r.nome, nota: r.nota || "", novo: true }))
      .filter((r, k, todos) => r.id && todos.findIndex((x) => x.id === r.id) === k);
  }
  const ramos = existentes.concat(out.ramosNovos.map((r) => ({ id: r.id, nome: r.nome })));

  if (b.RESUMO && p.resumo !== false) {
    /* cada [RESUMO] (a primeira resposta, a continuação) é lido à parte e as partes se juntam: o geral soma, e a seção
     * do mesmo ramo continua no fim da que já veio */
    prepBlocosDe(s, "RESUMO").forEach((corpoR) => {
      let r1 = null;
      try { r1 = riaLerResposta(corpoR, ramos, ""); } catch (e) { r1 = null; }
      if (!r1 || r1.vazio || r1.ehPedido || r1.ehRamos) return;
      if (!out.resumo) { out.resumo = r1; return; }
      if (r1.geral) out.resumo.geral = (out.resumo.geral ? out.resumo.geral + "\n\n" : "") + r1.geral;
      r1.secoes.forEach((x) => {
        const ja = out.resumo.secoes.find((y) => y.id === x.id);
        if (ja) ja.corpo = String(ja.corpo || "").replace(/\s+$/, "") + "\n\n" + String(x.corpo || "").trim();
        else out.resumo.secoes.push(x);
      });
      out.resumo.semSecao = !out.resumo.secoes.length;
    });
  }
  if (b.QUESTOES && p.questoes !== false) {
    const corpo = b.QUESTOES.replace(/^\s*FALTA\s*:.*$/gim, "");
    const ctxQ = { disciplina: c.disciplina, topico: c.topico, chave: c.chave, concurso: c.concurso, ramos };
    /* (19.125.0) "TRECHO: T07": de qual trecho da fonte a questão saiu. A linha sai do texto antes da leitura (não é
     * campo da questão) e fica guardada como a origem dela. Bloco a bloco, para a origem não trocar de questão. */
    const fonteQ = typeof cfFonteDe === "function" ? cfFonteDe(c.chave) : null;
    const blocosQ = corpo.split(/(?=\[\s*QUEST[ÃA]O\s*\])/i).filter((x) => /\[\s*QUEST[ÃA]O\s*\]/i.test(x));
    if (blocosQ.length && /^[ \t]*TRECHOS?\s*:/im.test(corpo)) {
      out.questoes = { achados: [], ignoradas: [] };
      blocosQ.forEach((bl) => {
        let cods = [];
        const semTrecho = bl.replace(/^[ \t]*TRECHOS?\s*:[ \t]*(.*)$/gim, (m0, v) => { if (fonteQ) cods = cods.concat(cfLerCodigos(v, fonteQ.trechos.length)); return ""; });
        const r1 = qsLerResposta(semTrecho, ctxQ);
        r1.achados.forEach((q) => { if (cods.length) q._trechos = cods.filter((x, k) => cods.indexOf(x) === k); out.questoes.achados.push(q); });
        r1.ignoradas.forEach((x) => out.questoes.ignoradas.push(x));
      });
    } else out.questoes = qsLerResposta(corpo, ctxQ);
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
    const fonteG = typeof cfFonteDe === "function" ? cfFonteDe(c.chave) : null;
    lido.questoes.achados.forEach((q) => {
      if (q.ramo && !idsValidos.has(q.ramo)) { delete q.ramo; delete q.ramoNome; }
      /* (19.125.0) a questão diz de onde saiu: "Fonte: aula-17.pdf, pág. 12 — Do veto" no fim do comentário */
      if (fonteG && q._trechos && q._trechos.length) {
        const rot = q._trechos.map((i) => fonteG.trechos[i]).filter(Boolean).map((x) => cfRotulo(x));
        if (rot.length) {
          q.comentario = String(q.comentario || "").replace(/\s+$/, "") + "\n" + t("prep_fonte_linha", { n: fonteG.nome || t("cf_sem_nome"), r: rot.join("; ") });
          q.trechos = { f: fonteG.quando, i: q._trechos.slice() };
        }
      }
      delete q._trechos;
    });
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
/* (19.125.0) A FONTE QUE VAI NO PEDIDO. Devolve { fonte (a frase do pedido), texto, numerada, guardar (a impressão nova a
 * guardar, quando a numeração nasce agora), tipo: "resumo"|"aula"|"", chars, falta (a chave do aviso) }.
 *  · o resumo: vai o texto dele; numerado em trechos quando a fonte medida É o resumo (ou ainda não há nenhuma) — com
 *    o PDF da aula guardado, a numeração é a da aula e o resumo vai sem números;
 *  · o material de fora: pelo copiar e colar, a pessoa manda junto; DIRETO, o app manda o texto da aula que leu do PDF
 *    nesta sessão (limpo: sem cabeçalho, rodapé nem a marca do comprador), numerado. */
function prepFonteParaPedido(direto) {
  const out = { fonte: prepFonteEscolhida(), texto: "", numerada: false, guardar: null, tipo: "", chars: 0, falta: "" };
  if (!prepCtx) return out;
  const reg0 = (typeof matObter === "function" && matObter(prepCtx.chave)) || {};
  const resumo = String(reg0.texto || "");
  const fc = typeof cfFonteDe === "function" ? cfFonteDe(prepCtx.chave) : null;
  if (out.fonte === "resumo") {
    out.tipo = "resumo";
    if (!resumo.trim()) { out.falta = "prep_ia_sem_resumo"; return out; }
    out.texto = resumo; out.chars = resumo.length;
    if (typeof cfFonteCompleta === "function" && (!fc || cfFonteTipo(fc) === "resumo")) {
      const comp = cfFonteCompleta(cfTrechosDeTexto(resumo), t("cf_nome_resumo"), "resumo");
      if (comp.fonte.trechos.length >= 2) {
        const mesma = !!fc && cfMesmaFonte(fc, comp.fonte);
        out.numerada = true;
        out.texto = cfTextoNumerado(mesma ? fc : comp.fonte, comp.textos);
        out.guardar = mesma ? null : comp.fonte;
      }
    }
    return out;
  }
  if (!direto) return out;
  out.tipo = "aula";
  out.fonte = "resumo";      /* no pedido direto, a aula é "o TEXTO no fim deste pedido" */
  if (!fc || cfFonteTipo(fc) !== "pdf" || !prepAula || prepAula.chave !== prepCtx.chave || prepAula.quando !== fc.quando) { out.falta = "prep_ia_sem_aula"; return out; }
  out.numerada = true;
  out.texto = cfTextoNumerado(fc, prepAula.textos);
  out.chars = out.texto.length;
  return out;
}
function prepMontarPedido(direto, sufixo) {
  if (!prepCtx) return "";
  const f = prepFonteParaPedido(!!direto);
  return prepPedido({
    disciplina: prepCtx.disciplina, topico: prepCtx.topico, concurso: prepCtx.concurso,
    ramos: prepCtx.ramos, partes: prepPartes(), fonte: f.fonte, texto: f.texto, numerada: f.numerada,
    textoMax: direto ? PREP_TEXTO_MAX_DIRETO : 0, sufixo: sufixo || "",
    tags: matEtiquetasTopico(prepCtx.disciplina, prepCtx.topico, prepCtx.concurso, "resumo"),
  });
}
/* a numeração que nasceu com o pedido fica guardada na hora em que ele sai: é por ela que "T07" volta a ser um trecho */
function prepGuardarNumeracao(f) {
  if (!f || !f.guardar || !prepCtx || typeof cfFonteGuardar !== "function") return false;
  cfFonteGuardar(prepCtx.chave, f.guardar, { disciplina: prepCtx.disciplina, topico: prepCtx.topico, concurso: prepCtx.concurso });
  return true;
}
/* os dois botões do "que falta" andam juntos: copiar o pedido, e (com o Gemini ligado) pedir direto */
function prepMostrarFalta(sim) {
  if ($("btnPrepContinuar")) $("btnPrepContinuar").hidden = !sim;
  if ($("btnPrepIaFalta")) $("btnPrepIaFalta").hidden = !(sim && prepIaPronta());
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
  prepMostrarFalta(false);
  if ($("prepFonteCob")) $("prepFonteCob").textContent = "";
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
      prepMostrarFalta(true);
    } else cx.append(prepEl("p", "prep-ok", t("prep_cob_ok")));
  }
  /* (19.124.0) a cobertura contra a FONTE, contando o que o tópico já tem e o que veio nesta resposta */
  try { if (prepPintarFonteCob(l)) prepMostrarFalta(true); } catch (e) {}
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

/* (19.124.0) A FONTE DO TÓPICO e a cobertura dela. Devolve true quando há trecho sem cobertura. */
let prepCobFonte = null;
function prepPintarFonteCob(lido) {
  const cx = $("prepFonteCob"), st = $("prepFonteSt");
  prepCobFonte = null;
  if (!cx || !prepCtx || typeof cfFonteDe !== "function") return false;
  cx.textContent = "";
  const fonte = cfFonteDe(prepCtx.chave);
  if (st) st.textContent = fonte ? t("cf_st_tem", { n: fonte.nome || t("cf_sem_nome"), k: fonte.trechos.length, d: String(fonte.quando || "").slice(0, 10).split("-").reverse().join("/") }) : t("cf_st_sem");
  if ($("btnPrepFonteTirar")) $("btnPrepFonteTirar").hidden = !fonte;
  if (!fonte) return false;
  /* (19.125.0) o trecho que uma questão DECLARA como origem está coberto: as já gravadas e as desta resposta */
  const citados = typeof cfCitadosDoTopico === "function" ? cfCitadosDoTopico(prepCtx.chave, fonte) : new Set();
  ((lido && lido.questoes && lido.questoes.achados) || []).forEach((q) => (q._trechos || []).forEach((i) => citados.add(i)));
  /* com o RESUMO como fonte, o próprio resumo não conta como cobertura dele mesmo (daria sempre 100%) */
  const semResumo = cfFonteTipo(fonte) === "resumo";
  const cob = cfCobertura(fonte, cfItensDoTopico(prepCtx.chave, semResumo).concat(cfItensDaResposta(lido, semResumo)), citados);
  prepCobFonte = cob;
  cx.append(prepEl("div", "prep-cob-tit", t("cf_tit")));
  const chips = prepEl("div", "mc-status");
  chips.append(prepEl("span", "mc-chip " + (cob.faltam.length ? "mc-chip-av" : "mc-chip-ok"), t("cf_chip", { c: cob.cobertos, n: cob.total, p: cob.pct })));
  cx.append(chips);
  if (!cob.faltam.length) { cx.append(prepEl("p", "prep-ok", t("cf_ok"))); return false; }
  const ul = prepEl("ul", "cf-lista");
  cob.faltam.slice(0, 12).forEach((x) => {
    const li = prepEl("li", "cf-item");
    li.append(prepEl("span", "cf-rot", cfRotulo(x)), prepEl("span", "cf-ini", x.ini + "…"));
    ul.append(li);
  });
  cx.append(ul);
  if (cob.faltam.length > 12) cx.append(prepEl("p", "fatos-limite", t("cf_mais", { n: cob.faltam.length - 12 })));
  cx.append(prepEl("p", "fatos-limite", t("cf_limite")));
  return true;
}
/* a fonte escolhida: o PDF da aula (lido aqui mesmo) ou o resumo do tópico */
async function prepFonteDoPdf(arquivo) {
  if (!prepCtx || !arquivo) return null;
  const dizer = (s) => { $("prepMsg").textContent = s; $("prepMsg").hidden = !s; };
  dizer(t("qs_pdf_lendo", { p: 0, n: "…" }));
  let bytes;
  try { bytes = new Uint8Array(await arquivo.arrayBuffer()); } catch (e) { dizer(t("qs_pdf_m_pdf_invalido")); return null; }
  const r = await cfFonteDePdf(bytes, arquivo.name || "PDF", { onProgresso: (p, n) => dizer(t("qs_pdf_lendo", { p, n })) });
  if (!r.fonte || r.motivo) { dizer(t(r.motivo === "sem_trechos" ? "cf_sem_trechos" : "qs_pdf_m_" + r.motivo)); return null; }
  cfFonteGuardar(prepCtx.chave, r.fonte, { disciplina: prepCtx.disciplina, topico: prepCtx.topico, concurso: prepCtx.concurso });
  /* (19.125.0) o TEXTO da aula fica só nesta sessão: é ele que o Gemini recebe quando a pessoa gera direto */
  prepAula = { chave: prepCtx.chave, quando: r.fonte.quando, textos: r.textos || [] };
  dizer(t("cf_guardada", { n: r.fonte.nome, k: r.fonte.trechos.length, p: r.paginas }));
  prepPintarConferenciaOuFonte();
  prepIaPintar();
  return r.fonte;
}
function prepFonteDoResumo() {
  if (!prepCtx) return null;
  const txt = String(((typeof matObter === "function" && matObter(prepCtx.chave)) || {}).texto || "");
  const fonte = cfFonteCompleta(cfTrechosDeTexto(txt), t("cf_nome_resumo"), "resumo").fonte;
  if (!fonte.trechos.length) { $("prepMsg").textContent = t("cf_sem_trechos"); $("prepMsg").hidden = false; return null; }
  cfFonteGuardar(prepCtx.chave, fonte, { disciplina: prepCtx.disciplina, topico: prepCtx.topico, concurso: prepCtx.concurso });
  $("prepMsg").textContent = t("cf_guardada", { n: fonte.nome, k: fonte.trechos.length, p: "—" }); $("prepMsg").hidden = false;
  prepPintarConferenciaOuFonte();
  prepIaPintar();
  return fonte;
}
/* repinta o que estiver na tela: a conferência (se há resposta) ou só a cobertura da fonte */
function prepPintarConferenciaOuFonte() {
  if (prepLido && !prepLido.vazio) { prepPintarConferencia(); return; }
  const falta = prepPintarFonteCob(null);
  prepMostrarFalta(falta);
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
  if ($("prepIaSt")) { $("prepIaSt").textContent = ""; $("prepIaSt").hidden = true; }
  prepPintarConferencia();
  prepPintarConferenciaOuFonte();
  prepIaPintar();
}

function prepCopiar(texto, chaveMsg) {
  const fPed = texto ? null : prepFonteParaPedido(false);
  const txt = texto || prepMontarPedido();
  if (prepGuardarNumeracao(fPed)) { try { prepPintarConferenciaOuFonte(); } catch (e) {} }
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
  prepPintarConferenciaOuFonte();
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
  /* (19.125.0) direto pelo Gemini */
  liga("btnPrepIa", () => prepIaGerar(false));
  liga("btnPrepIaFalta", () => prepIaGerar(true));
  liga("btnPrepIaCancelar", () => { if (typeof jurIaCancelar === "function") jurIaCancelar(); });
  liga("btnPrepIaConfig", () => { if (typeof vzAbrirChave === "function") vzAbrirChave(); });
  PREP_FONTES.forEach((f) => { if ($("prepFonte_" + f)) $("prepFonte_" + f).onchange = () => prepIaPintar(); });
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
    const txt = prepPedidoContinuar(prepCtx, prepLido ? prepLido.cobertura : [], prepPartes(), prepCobFonte);
    if (txt) prepCopiar(txt, "prep_copiado_cont");
  });
  /* (19.124.0) a fonte para medir a cobertura */
  liga("btnPrepFontePdf", () => { const a = $("prepFonteArq"); if (a) { try { a.value = ""; } catch (e) {} a.click(); } });
  if ($("prepFonteArq")) $("prepFonteArq").onchange = () => { const f = $("prepFonteArq").files && $("prepFonteArq").files[0]; if (f) prepFonteDoPdf(f); };
  liga("btnPrepFonteResumo", () => prepFonteDoResumo());
  liga("btnPrepFonteTirar", () => { if (prepCtx) { cfFonteEsquecer(prepCtx.chave); prepAula = null; prepPintarConferenciaOuFonte(); prepIaPintar(); } });
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

/* =====================================================================
 * DIRETO PELO GEMINI (19.125.0) — a mesma tela, sem copiar e colar
 *
 * Opcional e DESLIGADO: a pessoa liga na tela da chave, que diz o que vai ao Google. O que muda é só o transporte: o
 * pedido é o mesmo, a resposta cai na MESMA caixa e passa pela MESMA conferência — nada é gravado sozinho.
 *  · o que vai: o pedido (tópico, ramos) e a fonte — o resumo do tópico, ou o TEXTO da aula que o app leu do PDF nesta
 *    sessão, já limpo (sem cabeçalho, rodapé nem a marca do comprador: o PDF em si não é enviado);
 *  · a fonte vai dividida em trechos numerados, e cada questão volta dizendo de qual saiu ("TRECHO: T07") — a
 *    cobertura passa a contar por citação, e a questão ganha a linha "Fonte: …, pág. 12 — Do veto";
 *  · "pedir o que falta": o mesmo pedido, com a fonte, restrito aos ramos e trechos que a conferência mostrou vazios;
 *  · a tela diz o que acontece (⏳ N s, cancelar), cada erro tem nome, e a resposta cortada pelo limite do modelo é
 *    dita — o consumo fica anotado no painel da chave, como o das outras chamadas.
 * O caderno do NotebookLM não é alcançável daqui: quem gera a partir da aula escolhe o PDF em "Conferir contra a fonte".
 * ===================================================================== */
function prepIaLigada() { try { return localStorage.getItem(PREP_IA_CH) === "1"; } catch (e) { return false; } }
function prepIaLigar(sim) { try { if (sim) localStorage.setItem(PREP_IA_CH, "1"); else localStorage.removeItem(PREP_IA_CH); } catch (e) {} return prepIaLigada(); }
function prepIaPronta() { return prepIaLigada() && typeof jurIaPerguntar === "function" && typeof vzChaveApi === "function" && !!vzChaveApi(); }

/* o que vai ao Google nesta consulta — dito ANTES de ir: { ok, f, msg } */
function prepIaInfo() {
  const f = prepFonteParaPedido(true);
  if (f.falta) return { ok: false, f, msg: t(f.falta) };
  return { ok: true, f, msg: t(f.tipo === "aula" ? "prep_ia_vai_aula" : "prep_ia_vai_resumo", { n: Math.max(1, Math.round(f.chars / 1000)), k: Math.max(1, Math.round(f.chars / 4000)) }) };
}
/* os botões do Gemini: o de gerar (ligado), o de configurar (desligado) e a linha do que vai */
function prepIaPintar() {
  if (!$("btnPrepIa")) return;
  const pronta = prepIaPronta();
  $("btnPrepIa").hidden = !pronta;
  if ($("btnPrepIaConfig")) $("btnPrepIaConfig").hidden = pronta;
  if ($("btnPrepIaCancelar")) $("btnPrepIaCancelar").hidden = !prepIaRodando;
  const inf = $("prepIaInfo");
  if (inf) { inf.textContent = pronta && prepCtx ? prepIaInfo().msg : ""; inf.hidden = !inf.textContent; }
  if ($("btnPrepIaFalta") && $("btnPrepContinuar")) $("btnPrepIaFalta").hidden = !(pronta && !$("btnPrepContinuar").hidden);
}

async function prepIaGerar(soFalta) {
  if (!prepCtx || prepIaRodando) return null;
  if (!prepIaPronta()) { if (typeof vzAbrirChave === "function") vzAbrirChave(); return null; }
  const st = $("prepIaSt");
  const dizer = (s, cls) => { if (st) { st.textContent = s; st.hidden = !s; st.className = "prep-msg" + (cls ? " " + cls : ""); } };
  const info = prepIaInfo();
  if (!info.ok) { dizer(info.msg, "prep-msg-erro"); return null; }
  let sufixo = info.f.texto ? t("prep_p_fim_texto") : "";
  if (soFalta) {
    const lista = prepListaDoQueFalta(prepLido ? prepLido.cobertura : [], prepPartes(), prepCobFonte, info.f.numerada);
    if (!lista) { dizer(t("prep_ia_nada_falta")); return null; }
    sufixo = (sufixo ? sufixo + "\n\n" : "") + t("prep_p_so_falta", { lista });
  }
  const pedido = prepMontarPedido(true, sufixo);
  prepGuardarNumeracao(info.f);
  try { prepFonteGravar(prepCtx.chave, prepFonteEscolhida()); } catch (e) {}
  prepIaRodando = true;
  const travar = (sim) => { ["btnPrepIa", "btnPrepIaFalta"].forEach((id) => { if ($(id)) $(id).disabled = sim; }); if ($("btnPrepIaCancelar")) $("btnPrepIaCancelar").hidden = !sim; };
  travar(true);
  const inicio = Date.now();
  const seg = () => Math.round((Date.now() - inicio) / 1000);
  const espera = () => dizer(t("prep_ia_esperando", { s: seg() }), "prep-msg-espera");
  espera();
  const relogio = setInterval(espera, 1000);
  const topico = prepCtx.topico;
  try { reg("PREPARAR", "Gemini direto: consulta", topico + " · " + pedido.length + " caracteres · fonte: " + (info.f.tipo || "—") + (soFalta ? " · só o que falta" : "")); } catch (e) {}
  try {
    const r = await jurIaPerguntar(pedido, { modulo: "PREPARAR", tempo: PREP_IA_TEMPO });
    const cx = $("prepResposta");
    const antes = String(cx.value || "");
    /* acrescenta: a continuação entra depois do que já veio, e a conferência lê tudo junto */
    cx.value = antes.trim() ? antes.replace(/\s*$/, "") + "\n\n" + r.texto : r.texto;
    prepConferir();
    const cortou = /MAX_TOKENS/i.test(String(r.fim || ""));
    dizer(t(cortou ? "prep_ia_ok_cortou" : "prep_ia_ok", { s: seg(), n: r.texto.length }), cortou ? "prep-msg-erro" : "");
    try { reg("PREPARAR", "Gemini direto: resposta", topico + " · " + r.texto.length + " caracteres · " + seg() + " s · " + r.modelo + (cortou ? " · CORTADA pelo limite" : "")); } catch (e) {}
    return r;
  } catch (e) {
    const cod = (e && e.codigo) || "rede";
    dizer((cod === "tempo" ? t("prep_ia_erro_tempo") : t("jur_ia_erro_" + cod)) + (e && e.detalhe && cod !== "cancelado" ? " (" + e.detalhe + ")" : "") + " " + t("jur_ia_erro_rodape"), "prep-msg-erro");
    try { reg("PREPARAR", "Gemini direto: falhou", topico + " · " + cod + (e && e.detalhe ? " · " + e.detalhe : "")); } catch (e2) {}
    return null;
  } finally {
    clearInterval(relogio);
    prepIaRodando = false;
    travar(false);
    prepIaPintar();
  }
}
