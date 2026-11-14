/* =====================================================================
 * A COBERTURA MEDIDA CONTRA A FONTE (19.124.0)
 *
 * O RELATO: "a ideia [dos ramos] foi forçar a IA a cobrir todo o conteúdo da disciplina (…) mudar o prompt por si só
 * não pareceu ser suficiente."
 *
 * POR QUE O PROMPT NÃO BASTA: quem escreve o material não tem como conferir o que deixou de fora — a IA diz "cobri
 * tudo" e ninguém vê o buraco. Os ramos ajudam a repartir, mas continuam sendo uma promessa. Só a comparação com a
 * própria FONTE (a aula, a lei, o resumo) mostra o que ficou sem questão e sem cartão.
 *
 * COMO: o app lê a fonte — o PDF da aula (o mesmo leitor das leis) ou o resumo do tópico —, divide em TRECHOS (pelos
 * títulos; sem título, pela página ou pelo parágrafo) e guarda de cada um uma IMPRESSÃO: o título, a página, o
 * começo e as palavras que só aquele trecho tem (pesadas pela raridade dentro da fonte). Um trecho está COBERTO
 * quando alguma questão, cartão ou parte do resumo do tópico usa uma parte dessas palavras. Não depende de a IA
 * marcar nada, nem de onde o material foi gerado (o caderno, outra IA, à mão): é uma conferência independente.
 *
 * A impressão (não o texto da aula) fica guardada com o tópico e vai no backup; a cobertura se refaz a qualquer hora
 * com o que o tópico tiver. O que falta entra no pedido de continuação, com o título e a página de cada trecho.
 *
 * É UM INDÍCIO, NÃO UMA PROVA: a comparação é por palavras. Trecho marcado como coberto pode estar coberto pela
 * metade; trecho marcado como vazio quase sempre está vazio mesmo — e é esse lado que interessa.
 * ===================================================================== */
const CF_TRECHO_MAX = 1800;      /* caracteres: trecho maior que isso é partido */
const CF_TRECHO_MIN = 220;       /* menor que isso junta com o vizinho (um título solto não é conteúdo) */
const CF_TERMOS = 14;            /* quantas palavras raras cada impressão guarda */
const CF_FIM_RE = /^(quest[õo]es\s+comentadas|lista\s+de\s+quest[õo]es|gabaritos?|quest[õo]es\s+de\s+concurso|exerc[íi]cios)(?:\s*[-–:].*)?$/i;

/* uma linha com cara de TÍTULO: curta, sem ponto final, em maiúsculas ou numerada ("2.1 Do veto", "CAPÍTULO III") */
function cfEhTitulo(l) {
  const s = String(l || "").trim();
  if (s.length < 4 || s.length > 90 || /[.;:,]$/.test(s)) return false;
  if (/^#{1,6}\s+\S/.test(s)) return true;
  if (/^(cap[íi]tulo|se[çc][ãa]o|t[íi]tulo|parte|livro)\s+[ivxlc\d]+/i.test(s)) return true;
  if (/^\d+(\.\d+){0,3}[.)]?\s+\p{Lu}/u.test(s) && s.length <= 70 && !/\?$/.test(s)) return true;
  const letras = s.replace(/[^\p{L}]/gu, "");
  return letras.length >= 6 && letras === letras.toUpperCase() && /\s/.test(s);
}

/* fecha um trecho na lista (partindo o que passou do tamanho e juntando o que ficou pequeno demais) */
function cfFechar(lista, tr) {
  const txt = tr.linhas.join("\n").trim();
  if (!txt) return;
  /* pequeno e sem título: junta ao anterior; se é o primeiro (a capa, o nome da aula), não é conteúdo */
  if (txt.length < CF_TRECHO_MIN && !tr.titulo) { if (lista.length) lista[lista.length - 1].texto += "\n" + txt; return; }
  if (txt.length <= CF_TRECHO_MAX) { lista.push({ titulo: tr.titulo, pagina: tr.pagina, texto: txt }); return; }
  /* longo demais: parte nos parágrafos (ou nas linhas), mantendo o título e dizendo a parte */
  let buf = "", parte = 1;
  txt.split("\n").forEach((l) => {
    if (buf && buf.length + l.length > CF_TRECHO_MAX) { lista.push({ titulo: tr.titulo, pagina: tr.pagina, parte: parte++, texto: buf.trim() }); buf = ""; }
    buf += l + "\n";
  });
  if (buf.trim()) lista.push({ titulo: tr.titulo, pagina: tr.pagina, parte: parte > 1 ? parte : 0, texto: buf.trim() });
}

/* OS TRECHOS de um texto corrido (o resumo, uma aula colada): pelos títulos; sem título, pelos parágrafos */
function cfTrechosDeTexto(texto) {
  const out = [];
  let atual = { titulo: "", pagina: 0, linhas: [] };
  String(texto || "").replace(/\r\n?/g, "\n").split("\n").forEach((l) => {
    const s = l.trim();
    if (cfEhTitulo(s)) { cfFechar(out, atual); atual = { titulo: s.replace(/^#{1,6}\s+/, ""), pagina: 0, linhas: [] }; return; }
    if (!s) { if (atual.linhas.join("\n").length >= CF_TRECHO_MAX * 0.6) { cfFechar(out, atual); atual = { titulo: atual.titulo, pagina: 0, linhas: [] }; } return; }
    atual.linhas.push(s);
  });
  cfFechar(out, atual);
  return out;
}

/* OS TRECHOS das páginas de um PDF (já limpas: sem cabeçalho, rodapé nem marca). Para na parte de questões da aula:
 * "Questões comentadas", "Lista de questões" e "Gabarito" não são teoria a cobrir. */
function cfTrechosDePaginas(paginasLimpas) {
  const out = [];
  let atual = { titulo: "", pagina: 1, linhas: [] };
  let acabou = false;
  (paginasLimpas || []).forEach((linhas, k) => {
    if (acabou) return;
    (linhas || []).forEach((l) => {
      if (acabou) return;
      const s = String(l || "").trim();
      if (!s) return;
      if (CF_FIM_RE.test(s)) { acabou = true; return; }
      /* linha de sumário ("1) Lei Orgânica ........ 3") não é conteúdo */
      if (/\.{6,}/.test(s) || /(?:\.\s*){8,}/.test(s)) return;
      if (cfEhTitulo(s)) { cfFechar(out, atual); atual = { titulo: s, pagina: k + 1, linhas: [] }; return; }
      if (!atual.linhas.length && !atual.titulo) atual.pagina = k + 1;
      atual.linhas.push(s);
    });
    /* sem título há muito tempo: a página fecha o trecho */
    if (!acabou && atual.linhas.join("\n").length >= CF_TRECHO_MAX * 0.7) { cfFechar(out, atual); atual = { titulo: atual.titulo, pagina: k + 2, linhas: [] }; }
  });
  cfFechar(out, atual);
  /* o que vem ANTES do primeiro título e é curto é a capa (nome da aula, autor, data): não é conteúdo a cobrir */
  if (out.length > 1 && !out[0].titulo && out[0].texto.length < 600) out.shift();
  return out;
}

/* as palavras de um texto, do mesmo jeito que as questões irmãs as leem (questoes.js) */
function cfTermos(txt) {
  return typeof qsTermosDeTexto === "function" ? qsTermosDeTexto(txt) : new Map();
}

/* A IMPRESSÃO da fonte: de cada trecho, o título, a página, o começo e as palavras mais raras dele dentro da fonte.
 * É o que fica guardado — o texto da aula não. */
function cfImpressao(trechos, nome) {
  const docs = (trechos || []).map((tr) => cfTermos((tr.titulo ? tr.titulo + "\n" : "") + tr.texto));
  const N = docs.length;
  const df = new Map();
  docs.forEach((d) => d.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1)));
  const base = (w) => { const n = qsSemAcento(w); return n.length >= 6 && /s$/.test(n) ? n.slice(0, -1) : n; };
  const lista = (trechos || []).map((tr, i) => {
    /* quantas vezes cada palavra aparece NESTE trecho, e quais estão no título: a palavra que dá nome ao trecho e a que
     * ele repete dizem mais sobre ele do que a palavra mais comprida */
    const tf = new Map();
    (String(tr.texto || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).forEach((w) => { const b = base(w); tf.set(b, (tf.get(b) || 0) + 1); });
    const doTitulo = new Set((String(tr.titulo || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).map(base));
    const pares = [];
    docs[i].forEach((vis, k) => {
      const n = df.get(k) || 1;
      /* o que aparece em mais de 40% dos trechos é o assunto da aula inteira: não distingue este trecho */
      if (N > 3 && n > N * 0.4) return;
      const vezes = tf.get(k) || 1;
      pares.push([k, vis, Math.log((N + 1) / n) * (1 + Math.log(vezes)) + (doTitulo.has(k) ? 1.2 : 0) + (/ /.test(k) ? 0.4 : 0)]);
    });
    pares.sort((a, b) => b[2] - a[2] || b[0].length - a[0].length);
    const top = pares.slice(0, CF_TERMOS);
    return { t: tr.titulo || "", p: tr.pagina || 0, parte: tr.parte || 0, ini: tr.texto.replace(/\s+/g, " ").slice(0, 140),
      k: top.map((x) => x[0]), v: top.map((x) => x[1]), n: tr.texto.length, o: i };
  }).filter((x) => x.k.length >= 3);
  return { nome: nome || "", quando: new Date().toISOString(), trechos: lista };
}

/* (19.125.0) A FONTE COMPLETA: a impressão (o que fica guardado) e, alinhado com ela, o TEXTO de cada trecho (o que vai
 * no pedido e não fica guardado). O trecho pequeno demais para ter impressão não some: o texto dele entra no vizinho. */
function cfFonteTipo(f) { return !f ? "" : (f.tipo || (f.paginas ? "pdf" : "resumo")); }
function cfFonteCompleta(trechos, nome, tipo) {
  const fonte = cfImpressao(trechos, nome);
  fonte.tipo = tipo || "resumo";
  const pos = new Map();
  fonte.trechos.forEach((x, k) => pos.set(x.o, k));
  const textos = fonte.trechos.map(() => "");
  let ult = -1;
  const pend = [];
  (trechos || []).forEach((tr, i) => {
    if (pos.has(i)) {
      ult = pos.get(i);
      textos[ult] = (pend.length ? pend.join("\n") + "\n" : "") + tr.texto;
      pend.length = 0;
    } else if (ult >= 0) textos[ult] += "\n" + tr.texto;
    else pend.push(tr.texto);
  });
  fonte.trechos.forEach((x) => { delete x.o; });
  return { fonte, textos };
}
/* a mesma divisão? (o resumo que não mudou mantém a impressão — e as citações já gravadas continuam valendo) */
function cfMesmaFonte(a, b) {
  if (!a || !b || !a.trechos || !b.trechos || a.trechos.length !== b.trechos.length) return false;
  return a.trechos.every((x, i) => x.ini === b.trechos[i].ini && x.n === b.trechos[i].n && x.t === b.trechos[i].t);
}
/* o código do trecho no pedido: T01, T02… */
function cfCodigo(i) { return "T" + String(i + 1).padStart(2, "0"); }
/* o texto da fonte com cada trecho numerado e rotulado — é assim que ele vai no pedido */
function cfTextoNumerado(fonte, textos) {
  return ((fonte && fonte.trechos) || []).map((x, i) => "[" + cfCodigo(i) + "] " + cfRotulo(x) + "\n" + String((textos || [])[i] || "").trim()).join("\n\n");
}
/* "T07, T08" (ou "[T07]", "T7") → os índices válidos na fonte */
function cfLerCodigos(valor, total) {
  const out = [];
  (String(valor || "").match(/T\s*0*(\d{1,3})/gi) || []).forEach((c) => {
    const n = parseInt(c.replace(/\D/g, ""), 10) - 1;
    if (n >= 0 && n < total && out.indexOf(n) < 0) out.push(n);
  });
  return out;
}
/* os trechos que as questões JÁ GRAVADAS do tópico citam (só as que citam ESTA impressão: a numeração é dela) */
function cfCitadosDoTopico(chave, fonte) {
  const out = new Set();
  if (!fonte) return out;
  try {
    (typeof qsTodas === "function" ? qsTodas() : []).forEach((q) => {
      if (!q || q.chave !== chave || !q.trechos || q.trechos.f !== fonte.quando) return;
      (q.trechos.i || []).forEach((i) => { if (i >= 0 && i < fonte.trechos.length) out.add(i); });
    });
  } catch (e) {}
  return out;
}

/* A COBERTURA: para cada trecho, quantas das palavras dele o melhor item do tópico usa. Coberto: pelo menos um quarto
 * delas num MESMO item (e nunca menos de 3) — um item só, e não a soma de vários, porque palavras espalhadas por dez
 * questões não são uma questão sobre o trecho. itens = textos (questões, cartões, partes do resumo). */
function cfCobertura(fonte, itens, citados) {
  /* (19.125.0) "citados": os trechos que alguma questão DECLARA como origem (TRECHO: T07) — cobertos sem depender das
   * palavras */
  const cit = citados || new Set();
  const trechos = (fonte && fonte.trechos) || [];
  const docs = (itens || []).map((x) => cfTermos(x)).filter((d) => d.size);
  let cobertos = 0;
  const lista = trechos.map((tr, i) => {
    const pede = Math.max(3, Math.ceil(tr.k.length / 4));
    let melhor = 0;
    for (const d of docs) {
      let n = 0;
      for (const k of tr.k) if (d.has(k)) n++;
      if (n > melhor) { melhor = n; if (melhor >= tr.k.length) break; }
    }
    const coberto = melhor >= pede || cit.has(i);
    if (coberto) cobertos++;
    return { i, t: tr.t, p: tr.p, parte: tr.parte, ini: tr.ini, v: tr.v, n: tr.n, melhor, pede, coberto, citado: cit.has(i) };
  });
  return { total: trechos.length, cobertos, pct: trechos.length ? Math.round((cobertos / trechos.length) * 100) : null,
    faltam: lista.filter((x) => !x.coberto), lista };
}

/* os textos do que o tópico JÁ TEM: cada questão, cada cartão e cada parágrafo do resumo */
function cfItensDoTopico(chave, semResumo) {
  const out = [];
  try {
    (typeof qsTodas === "function" ? qsTodas() : []).forEach((q) => {
      if (!q || q.chave !== chave) return;
      out.push([q.enunciado, (q.opcoes || []).map((o) => o.txt).join(" "), q.comentario].filter(Boolean).join("\n"));
    });
  } catch (e) {}
  const reg0 = (typeof matObter === "function" && matObter(chave)) || {};
  String(reg0.cartoes || "").split(/\n\s*\n|\n(?=[^+@\n])/).forEach((b) => { if (b.trim()) out.push(b.replace(/::[^:\n]*$/gm, "")); });
  /* (19.125.0) semResumo: quando a fonte medida É o resumo, ele não cobre a si mesmo */
  if (!semResumo) String(reg0.texto || "").split(/\n\s*\n/).forEach((p) => { if (p.trim().length > 40) out.push(p); });
  return out;
}
/* os textos do que VEIO numa resposta do "preparar o tópico" (ainda não gravado) */
function cfItensDaResposta(lido, semResumo) {
  const out = [];
  if (!lido) return out;
  (lido.questoes && lido.questoes.achados || []).forEach((q) => out.push([q.enunciado, (q.opcoes || []).map((o) => o.txt).join(" "), q.comentario].filter(Boolean).join("\n")));
  (lido.cartoes && lido.cartoes.cartoes || []).forEach((x) => out.push([x.card.front, x.card.back, x.card.more].filter(Boolean).join("\n")));
  if (lido.resumo && !semResumo) {
    if (lido.resumo.geral) out.push(lido.resumo.geral);
    (lido.resumo.secoes || []).forEach((s) => String(s.corpo || "").split(/\n\s*\n/).forEach((p) => { if (p.trim()) out.push(p); }));
  }
  return out;
}

/* guardar e ler a impressão da fonte do tópico (mora com o material dele: vai no backup, sai com ele) */
function cfFonteDe(chave) {
  const r = (typeof matObter === "function" && matObter(chave)) || null;
  return r && r.fonteCob && Array.isArray(r.fonteCob.trechos) ? r.fonteCob : null;
}
function cfFonteGuardar(chave, fonte, meta) {
  if (typeof matResumos === "undefined" || !matResumos) return false;
  const antigo = matResumos[chave] || {};
  const m = meta || {};
  matResumos[chave] = Object.assign({ texto: "", criado: new Date().toISOString() }, antigo, {
    disciplina: antigo.disciplina || m.disciplina || "", topico: antigo.topico || m.topico || "",
    concurso: antigo.concurso || m.concurso || "", fonteCob: fonte, tocado: new Date().toISOString() });
  try { matSalvar(chave); } catch (e) {}
  try { reg("FONTE", "fonte do tópico guardada para medir a cobertura", (antigo.topico || m.topico || chave) + " · " + (fonte.nome || "—") + " · " + fonte.trechos.length + " trecho(s)"); } catch (e) {}
  return true;
}
function cfFonteEsquecer(chave) {
  if (typeof matResumos === "undefined" || !matResumos || !matResumos[chave]) return false;
  delete matResumos[chave].fonteCob;
  try { matSalvar(chave); } catch (e) {}
  return true;
}

/* a fonte a partir de um PDF: lê, limpa, divide e tira a impressão. Devolve { fonte, motivo, paginas } */
async function cfFonteDePdf(bytes, nome, opc) {
  const lido = await qsPdfPaginas(bytes, opc || {});
  if (lido.motivo) return { fonte: null, motivo: lido.motivo };
  const limpo = qsPdfLimpar(lido.paginas);
  const trechos = cfTrechosDePaginas(limpo.porPagina || [limpo.linhas]);
  const comp = cfFonteCompleta(trechos, nome, "pdf");
  const fonte = comp.fonte;
  fonte.paginas = limpo.paginas;
  /* "textos": o texto limpo de cada trecho (sem cabeçalho, rodapé nem a marca do comprador) — para quem vai mandá-lo
   * no pedido; não fica guardado */
  return { fonte, textos: comp.textos, paginas: limpo.paginas, motivo: fonte.trechos.length ? "" : "sem_trechos" };
}

/* o rótulo de um trecho para a tela e para o pedido: "pág. 12 — Do veto" */
function cfRotulo(x) {
  const pg = x.p ? t("cf_pag", { p: x.p }) : "";
  const tit = x.t ? x.t + (x.parte ? " (" + x.parte + ")" : "") : "";
  return [pg, tit].filter(Boolean).join(" — ") || x.ini.slice(0, 60);
}
/* as linhas do que falta, para o pedido de continuação */
function cfLinhasDoQueFalta(cob, max, comCodigo) {
  return ((cob && cob.faltam) || []).slice(0, max || 20).map((x) => "- " + (comCodigo ? cfCodigo(x.i) + " · " : "") + cfRotulo(x) + ": " + (x.v || []).slice(0, 6).join(", "));
}
