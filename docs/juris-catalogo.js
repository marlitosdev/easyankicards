/* =====================================================================
 * CATÁLOGO OFICIAL DE PRECEDENTES E SELO DE QUALIDADE DOS JULGADOS (v18.95.0)
 *
 * O catálogo (dados/juris-catalogo.json) é GERADO por scripts/catalogo-juris.js a partir das páginas do STF e do STJ —
 * súmulas, súmulas vinculantes, teses de repercussão geral e temas repetitivos —, com a data em que foi lido. Nunca é
 * escrito à mão nem pela IA: ele existe para CONFERIR, e um catálogo de memória trocaria o erro da pessoa pelo dele.
 *
 * O que ele dá ao app:
 *  · a tese oficial de uma súmula/tema pelo número (conferir o que está guardado; guardar o que foi citado);
 *  · o elo TEMA ↔ PROCESSO que o fixou: "RE 593.849" é o Tema 201 do STF; "REsp 1.377.019" é o Tema 962 do STJ — a
 *    literatura cita um ou outro, e o app tem de saber que são o mesmo precedente;
 *  · o link certo da página oficial (o STF numera as súmulas por um código interno, não pelo número);
 *  · a base do SELO DE QUALIDADE de cada julgado guardado.
 *
 * O SELO (jurQualidade) junta o que já existia espalhado — "de memória", "a conferir", "verificado em", "superada/
 * cancelada", "repetido" — num veredito só, com o porquê:
 *    🟢 oficial    · a tese é a do catálogo oficial (selo dado na auditoria, preso ao texto da tese)
 *    🔵 conferido  · a pessoa conferiu na fonte (✓ conferi) ou verificou a vigência — sem pendência
 *    🟡 a conferir · de memória da IA, campos a conferir, nunca conferido
 *    🔴 problema   · difere do oficial, fora de vigor, ou repetido
 *    ⏳ vencido    · conferido há mais de 180 dias
 * O selo é PRESO AO TEXTO DA TESE (hash do texto normalizado): editar a tese depois tira o selo sozinho.
 * ===================================================================== */
const JUR_CAT_URL = "dados/juris-catalogo.json";
const JUR_CAT_RECIBO = "eac_jur_cat_recibo";
let jurCat = null;            /* { geradoEm, itens: { "STF|tema|69": {...} } } */
let jurCatPromessa = null;
let jurCatIdx = null;         /* "re|593849" → ["STF|tema|201"] */

/* para os testes e para quem já tem o objeto: define o catálogo sem rede */
function jurCatDefinir(c) {
  jurCat = c && c.itens ? c : (c ? { geradoEm: "", itens: c } : null);
  jurCatIdx = null;
  return jurCat;
}
function jurCatPronto() { return !!(jurCat && jurCat.itens); }

/* CARREGAR, DIZENDO O QUE ESTÁ FAZENDO: aoProgresso({ fase: "baixando"|"lendo"|"pronto"|"erro", feito, total }).
 * Uma vez carregado, fica na memória; de novo só se a página recarregar. */
function jurCatCarregar(aoProgresso) {
  const avisa = (o) => { try { if (typeof aoProgresso === "function") aoProgresso(o); } catch (e) {} };
  if (jurCatPronto()) { avisa({ fase: "pronto", feito: 1, total: 1 }); return Promise.resolve(jurCat); }
  if (jurCatPromessa) return jurCatPromessa.then((c) => { avisa({ fase: "pronto", feito: 1, total: 1 }); return c; });
  if (typeof fetch !== "function") return Promise.reject(new Error("sem_fetch"));
  jurCatPromessa = (async () => {
    avisa({ fase: "baixando", feito: 0, total: 0 });
    const r = await fetch(JUR_CAT_URL, { cache: "no-cache" });
    if (!r || !r.ok) throw new Error("http_" + (r ? r.status : 0));
    const total = +((r.headers && r.headers.get && r.headers.get("content-length")) || 0);
    let txt = "";
    if (r.body && r.body.getReader && typeof TextDecoder === "function") {
      const leitor = r.body.getReader(), dec = new TextDecoder("utf-8");
      let feito = 0;
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        feito += value.length;
        txt += dec.decode(value, { stream: true });
        avisa({ fase: "baixando", feito, total });
      }
      txt += dec.decode();
    } else {
      txt = await r.text();
    }
    avisa({ fase: "lendo", feito: 1, total: 1 });
    const c = JSON.parse(txt);
    if (!c || !c.itens) throw new Error("formato");
    jurCatDefinir(c);
    avisa({ fase: "pronto", feito: 1, total: 1 });
    try { reg("JURIS", "catálogo oficial carregado", Object.keys(c.itens).length + " itens · gerado em " + (c.geradoEm || "?")); } catch (e) {}
    return jurCat;
  })();
  jurCatPromessa.catch((e) => { jurCatPromessa = null; avisa({ fase: "erro", erro: String(e && e.message || e) }); });
  return jurCatPromessa;
}

/* classe do catálogo: só súmula, súmula vinculante e tema estão nele */
function jurCatClasse(cc) {
  return cc === "sumula" || cc === "sumula vinculante" || cc === "tema" ? cc : "";
}
function jurCatItem(chave) { return jurCatPronto() ? (jurCat.itens[chave] || null) : null; }

/* o índice processo → temas (o processo que fixou cada tema), feito uma vez */
function jurCatIndice() {
  if (jurCatIdx || !jurCatPronto()) return jurCatIdx || {};
  const idx = {};
  Object.keys(jurCat.itens).forEach((k) => {
    (jurCat.itens[k].paradigmas || []).forEach((p) => {
      const m = String(p).match(/^([A-Za-z][A-Za-z\s]*?)\s*([\d.]+)/);
      if (!m) return;
      const ch = jurClasseChave(m[1]) + "|" + jurNumChave(m[2]);
      (idx[ch] = idx[ch] || []).push(k);
    });
  });
  jurCatIdx = idx;
  return idx;
}

/* AS ENTRADAS DO CATÁLOGO PARA UMA IDENTIDADE {cc, numero, tribunal}: a própria (súmula/tema) ou, para um processo, os
 * temas que ele fixou. Sem tribunal, tenta STF e STJ (e devolve as duas quando ambas existem — quem chama decide). */
function jurCatEntradasDe(id) {
  if (!jurCatPronto() || !id) return [];
  const n = jurNumChave(id.numero), cc = id.cc || jurClasseChave(id.classe);
  if (!n || !cc) return [];
  const tris = id.tribunal ? [String(id.tribunal).toUpperCase()] : ["STF", "STJ"];
  const out = [];
  if (jurCatClasse(cc)) {
    tris.forEach((tr) => { const k = tr + "|" + cc + "|" + n; if (jurCat.itens[k]) out.push({ chave: k, item: jurCat.itens[k], via: "eh" }); });
  } else {
    (jurCatIndice()[cc + "|" + n] || []).forEach((k) => {
      if (tris.indexOf(k.split("|")[0]) >= 0) out.push({ chave: k, item: jurCat.itens[k], via: "paradigma" });
    });
  }
  return out;
}

/* O PRECEDENTE OFICIAL DE UM JULGADO GUARDADO: pela 1ª identidade que o catálogo conhece. Ficha com dois temas
 * ("863 / 827") não tem UM oficial — fica de fora da comparação de tese (seria comparar com a metade). */
function jurCatDoJulgado(j) {
  if (!jurCatPronto() || !j) return null;
  const ids = jurIdentidadesDe(j).filter((x) => !x.paradigma);
  const temas = ids.filter((x) => jurCatClasse(x.cc));
  if (temas.length > 1) return { composto: true, entradas: temas.map((x) => jurCatEntradasDe(Object.assign({ tribunal: j.tribunal }, x))).flat() };
  for (const x of ids.concat(jurIdentidadesDe(j).filter((y) => y.paradigma))) {
    const e = jurCatEntradasDe(Object.assign({ tribunal: j.tribunal }, x));
    if (e.length === 1) return e[0];
    if (e.length > 1) return { ambiguo: true, entradas: e };
  }
  return null;
}

/* AS IDENTIDADES EQUIVALENTES (tema ↔ processo que o fixou), pelo catálogo. Usado por jurAcharCitado e pelos repetidos. */
function jurCatEquivalentes(id) {
  const out = [];
  jurCatEntradasDe(id).forEach((e) => {
    const it = e.item;
    if (e.via === "paradigma") out.push({ cc: jurClasseChave(it.classe), numero: jurNumChave(it.numero), tribunal: it.tribunal, chave: e.chave });
    (it.paradigmas || []).forEach((p) => {
      const m = String(p).match(/^([A-Za-z][A-Za-z\s]*?)\s*([\d.]+)/);
      if (m) out.push({ cc: jurClasseChave(m[1]), numero: jurNumChave(m[2]), tribunal: it.tribunal, chave: e.chave });
    });
  });
  const cc = id.cc || jurClasseChave(id.classe), n = jurNumChave(id.numero);
  return out.filter((x, i, a) => !(x.cc === cc && x.numero === n) && a.findIndex((y) => y.cc === x.cc && y.numero === x.numero) === i);
}

/* ---------------- COMPARAR A TESE GUARDADA COM A OFICIAL ---------------- */
/* estrita: só acento, caixa e pontuação não contam */
function jurCatNormal(s) {
  return jurSemAcento(jurSemMarcacao(String(s || ""))).toLowerCase()
    .replace(/[“”"'‘’«»]/g, "").replace(/[^a-z0-9§º°]+/g, " ").replace(/\s+/g, " ").trim();
}
/* frouxa: além disso, o que é só FORMA de escrever — "nº", "art."/"artigo", "inciso"/"alínea", "Decreto-Lei"/"DL",
 * "CF"/"Constituição Federal", ano com dois ou quatro dígitos, "1º" × "1", artigos e preposições soltos */
function jurCatFrouxa(s) {
  const x = jurCatNormal(s);
  if (!x) return "";
  return (" " + x + " ")
      .replace(/ n[º°o]? (?=\d)/g, " ")
      .replace(/ artigos? /g, " art ").replace(/ arts? /g, " art ")
      .replace(/ (inciso|incisos|alinea|alineas|letra) /g, " ")
      .replace(/ decreto lei /g, " dl ").replace(/ dl /g, " dl ")
      .replace(/ constituicao federal | constituicao da republica | cf 88 | cf 1988 /g, " cf ")
      .replace(/ lei complementar /g, " lc ")
      .replace(/ (19|20)(\d\d)(?= )/g, " $2")
      .replace(/(\d)[º°]/g, "$1")
      .replace(/ (o|a|os|as|de|da|do|das|dos|e|em|no|na|nos|nas|ao|aos|pelo|pela|um|uma) /g, " ")
      .replace(/ (o|a|os|as|de|da|do|das|dos|e|em|no|na|nos|nas|ao|aos|pelo|pela|um|uma) /g, " ")
      .replace(/\s+/g, " ").trim();
}
/* "igual" | "forma" (só a forma de escrever muda) | "diferente" */
function jurCatComparar(salva, oficial) {
  const a = jurCatNormal(salva), b = jurCatNormal(oficial);
  if (!a || !b) return "diferente";
  if (a === b) return "igual";
  return jurCatFrouxa(salva) === jurCatFrouxa(oficial) ? "forma" : "diferente";
}

/* SEMELHANÇA DE ASSUNTO (0–1): as palavras de 4+ letras em comum. Serve para avisar "parece OUTRO assunto" — trocar o
 * texto, aí, mudaria o assunto do julgado; o certo é conferir o número e o tribunal. */
function jurCatSemelhanca(a, b) {
  const p = (s) => new Set(jurCatNormal(s).split(" ").filter((w) => w.length >= 4));
  const A = p(a), B = p(b);
  if (!A.size || !B.size) return 0;
  let c = 0;
  A.forEach((w) => { if (B.has(w)) c++; });
  return c / (A.size + B.size - c);
}
const JUR_CAT_OUTRO_ASSUNTO = 0.2;

/* DIFERENÇA PALAVRA A PALAVRA (para mostrar o antes × depois): [{t: "=", s}|{t: "-", s}|{t: "+", s}].
 * Teses têm dezenas de palavras: o LCS simples basta. */
function jurDiffPalavras(antes, depois) {
  const A = String(antes || "").split(/\s+/).filter(Boolean), B = String(depois || "").split(/\s+/).filter(Boolean);
  const k = (w) => jurSemAcento(w).toLowerCase().replace(/[^a-z0-9§º°]/g, "");
  const n = A.length, m = B.length;
  if (n * m > 400000) return [{ t: "-", s: A.join(" ") }, { t: "+", s: B.join(" ") }];
  const L = new Array((n + 1) * (m + 1)).fill(0), w = m + 1;
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i * w + j] = k(A[i]) === k(B[j]) ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
  const out = [];
  const poe = (t2, s) => { const u = out[out.length - 1]; if (u && u.t === t2) u.s += " " + s; else out.push({ t: t2, s }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (k(A[i]) === k(B[j])) { poe("=", B[j]); i++; j++; }
    else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { poe("-", A[i]); i++; }
    else { poe("+", B[j]); j++; }
  }
  while (i < n) poe("-", A[i++]);
  while (j < m) poe("+", B[j++]);
  return out;
}

/* ---------------- O SELO ---------------- */
/* o hash do texto normalizado da tese: o selo vale para ESTE texto (editar a tese tira o selo) */
function jurHashTese(s) {
  const x = jurCatFrouxa(s);
  let h = 5381;
  for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function jurSeloValido(j) {
  return !!(j && j.selo && j.selo.hash && j.selo.hash === jurHashTese(j.tese));
}
/* dar o selo: tipo "oficial" (catálogo) ou "pessoa" (conferi na fonte) */
function jurSeloConceder(id, tipo, fonte, hoje) {
  const j = jurDe(id);
  if (!j || !String(j.tese || "").trim()) return null;
  const em = jurHojeISO(hoje);
  return jurGravar({ id, selo: { tipo, em, hash: jurHashTese(j.tese), fonte: String(fonte || "") }, conferidoEm: em, deMemoria: false, aConferir: tipo === "oficial" ? [] : j.aConferir });
}
function jurSeloTirar(id) { return jurGravar({ id, selo: null }); }

function jurDiasDesde(iso, hoje) {
  const a = new Date(String(iso || "") + "T00:00:00"), b = new Date(jurHojeISO(hoje) + "T00:00:00");
  return isNaN(a) ? Infinity : Math.round((b - a) / 86400000);
}

/* O VEREDITO DE QUALIDADE de um julgado guardado: { nivel, motivos: [{k, txt}], oficial? }.
 * opc.lista (para achar repetidos), opc.hoje (testes). Ordem: o que é PROBLEMA vence tudo; depois o selo; depois o resto. */
function jurQualidade(j, opc) {
  const o = opc || {};
  if (!j) return { nivel: "aconferir", motivos: [] };
  const mot = [];
  const L = o.lista || null;
  /* problema */
  if (jurForaDeVigor(j)) mot.push({ k: "fora", txt: t("jur_q_m_fora", { s: t("jur_sit_" + j.situacao) }) });
  const of = jurCatDoJulgado(j);
  const ofItem = of && of.item;
  if (ofItem && ofItem.tese && String(j.tese || "").trim()) {
    const cmp = jurCatComparar(j.tese, ofItem.tese);
    if (cmp === "diferente" && !(j.selo && j.selo.tipo === "pessoa" && jurSeloValido(j))) mot.push({ k: "difere", txt: t("jur_q_m_difere", { o: jurCatNome(ofItem) }) });
  }
  if (ofItem && (ofItem.situacao === "cancelada" || ofItem.situacao === "superada") && j.situacao !== ofItem.situacao)
    mot.push({ k: "oficial_fora", txt: t("jur_q_m_oficial_fora", { s: t("jur_sit_" + ofItem.situacao) }) });
  if (jurRepetidosDe(j, L).length) mot.push({ k: "repetido", txt: t("jur_q_m_repetido", { n: jurRepetidosDe(j, L).map(jurCitNome).join("; ") }) });
  if (mot.length) return { nivel: "problema", motivos: mot, oficial: of };
  /* selo */
  const dias = jurDiasDesde(j.selo && j.selo.em || j.conferidoEm, o.hoje);
  if (jurSeloValido(j)) {
    if (dias > JUR_REVER_DIAS) return { nivel: "vencido", motivos: [{ k: "vencido", txt: t("jur_q_m_vencido", { d: jurDataBr(j.selo.em) }) }], oficial: of };
    return { nivel: j.selo.tipo === "oficial" ? "oficial" : "conferido", motivos: [{ k: "selo", txt: t(j.selo.tipo === "oficial" ? "jur_q_m_oficial" : "jur_q_m_pessoa", { d: jurDataBr(j.selo.em), f: j.selo.fonte || "—" }) }], oficial: of };
  }
  if (j.selo && j.selo.hash) mot.push({ k: "editada", txt: t("jur_q_m_editada") });
  /* a conferir */
  if (j.deMemoria) mot.push({ k: "memoria", txt: t("jur_q_m_memoria") });
  const ac = Array.isArray(j.aConferir) ? j.aConferir : [];
  if (ac.length) mot.push({ k: "conferir", txt: t("jur_q_m_conferir", { q: ac.map((x) => (typeof jurNomeCampo === "function" ? jurNomeCampo(x) : x)).join(", ") }) });
  if (!mot.length && j.conferidoEm) {
    if (dias > JUR_REVER_DIAS) return { nivel: "vencido", motivos: [{ k: "vencido", txt: t("jur_q_m_vencido", { d: jurDataBr(j.conferidoEm) }) }], oficial: of };
    return { nivel: "conferido", motivos: [{ k: "verificado", txt: t("jur_q_m_verificado", { d: jurDataBr(j.conferidoEm) }) }], oficial: of };
  }
  if (!mot.length) mot.push({ k: "nunca", txt: t("jur_q_m_nunca") });
  return { nivel: "aconferir", motivos: mot, oficial: of };
}
const JUR_Q_ICONE = { oficial: "🟢", conferido: "🔵", aconferir: "🟡", problema: "🔴", vencido: "⏳" };
const JUR_Q_ORDEM = ["problema", "aconferir", "vencido", "conferido", "oficial"];
function jurDataBr(iso) { return String(iso || "").split("-").reverse().join("/"); }
function jurCatNome(it) { return it ? [it.tribunal, it.classe, it.numero].filter(Boolean).join(" ") : ""; }

/* REPETIDOS, contando o elo tema ↔ processo do catálogo: "Tema 201" e "RE 593.849" guardados separados são o mesmo
 * precedente. Sem catálogo, vale o que já valia (mesma classe e número). */
function jurRepetidosDe(j, lista) {
  if (!j) return [];
  const L = lista || jurLista();
  const meus = jurIdentidadesDe(j).filter((x) => !x.paradigma);
  if (!meus.length) return [];
  const chaves = new Set();
  meus.forEach((x) => {
    chaves.add(x.cc + "|" + x.numero);
    if (jurCatPronto()) jurCatEquivalentes(Object.assign({ tribunal: j.tribunal }, x)).forEach((e) => chaves.add(e.cc + "|" + e.numero));
  });
  const tri = String(j.tribunal || "").toUpperCase();
  return L.filter((x) => x && x.id !== j.id && (!tri || !x.tribunal || String(x.tribunal).toUpperCase() === tri)
    && jurIdentidadesDe(x).filter((y) => !y.paradigma).some((y) => chaves.has(y.cc + "|" + y.numero)));
}

/* ---------------- LINKS OFICIAIS ---------------- */
/* a página oficial deste julgado: do catálogo (o STF numera as súmulas por código interno) ou a busca do tribunal */
/* a URL da página oficial de uma entrada do catálogo (o arquivo não guarda URLs: são montadas aqui, pelo código do STF ou pelo número) */
function jurCatUrl(it) {
  if (!it) return "";
  if (it.url) return it.url;
  const cc = jurClasseChave(it.classe);
  if (it.tribunal === "STF" && it.stfId) return "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=" + (cc === "sumula vinculante" ? 26 : 30) + "&sumula=" + it.stfId;
  if (it.tribunal === "STF" && cc === "tema") {
    const p = String((it.paradigmas || [])[0] || "").split(/\s+/);
    return it.incidente ? "https://portal.stf.jus.br/jurisprudenciaRepercussao/verAndamentoProcesso.asp?incidente=" + it.incidente + "&numeroProcesso=" + (p[1] || "") + "&classeProcesso=" + (p[0] || "RE") + "&numeroTema=" + it.numero
      : "https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=" + it.numero;
  }
  if (it.tribunal === "STJ" && cc === "sumula") return "https://scon.stj.jus.br/SCON/sumstj/toc.jsp?livre=" + encodeURIComponent("@num='" + it.numero + "'");
  if (it.tribunal === "STJ" && cc === "tema") return "https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=" + it.numero + "&cod_tema_final=" + it.numero;
  return "";
}
function jurLinkOficial(j) {
  const of = jurCatDoJulgado(j);
  if (of && of.item && jurCatUrl(of.item)) return { url: jurCatUrl(of.item), nome: t("jur_q_link_oficial", { t: jurCatNome(of.item) }) };
  const tri = String((j && j.tribunal) || "").toUpperCase();
  const id = jurIdentidadesDe(j || {})[0];
  if (tri === "STJ" && id && id.cc === "sumula")
    return { url: "https://scon.stj.jus.br/SCON/sumstj/toc.jsp?livre=" + encodeURIComponent("@num='" + id.numero + "'"), nome: t("jur_q_link_stj_sum", { n: id.numero }) };
  if (tri === "STJ" && id && id.cc === "tema")
    return { url: "https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=" + id.numero + "&cod_tema_final=" + id.numero, nome: t("jur_q_link_stj_tema", { n: id.numero }) };
  if (tri === "STF" && id && id.cc === "tema")
    return { url: "https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=" + id.numero, nome: t("jur_q_link_stf_tema", { n: id.numero }) };
  const p = typeof jurPortalOficial === "function" ? jurPortalOficial(tri) : null;
  return p ? { url: p.url, nome: p.nome } : null;
}

/* =====================================================================
 * A AUDITORIA PELO CATÁLOGO — o motor (a tela está em juris-ui.js)
 *
 * Nada é gravado sem a pessoa decidir. jurCatAuditar devolve UMA LINHA POR JULGADO com o que o catálogo diz e uma
 * SUGESTÃO; a pessoa aceita, troca ou pula; jurCatAplicar grava só o que foi decidido, com recibo guardado (desfaz
 * depois, mesmo fechando a janela). Regras:
 *  · tese igual (ou só a forma muda) → sugestão "selo": dá o selo oficial SEM trocar o texto;
 *  · tese diferente → sem sugestão: a pessoa escolhe "usar a oficial" (a sua vai para teseAnterior) ou "manter a minha";
 *  · o catálogo diz cancelada/superada e o julgado não → sugere marcar (nunca o contrário: rebaixar "cancelada" para
 *    "vigente" não é sugerido — a pessoa pode ter verificado algo mais novo que o catálogo);
 *  · tribunal trocado só é sugerido corrigir quando o TEXTO bate com o oficial do outro tribunal;
 *  · campos vazios (data, órgão, fonte, precedentes) podem ser completados com o que a página oficial mostra;
 *  · ficha com dois temas, ou citação ambígua (STF e STJ), fica de fora, dito.
 * ===================================================================== */
function jurCatAuditar(lista, aoProgresso) {
  const L = lista || jurLista();
  const linhas = [];
  L.forEach((j, i) => {
    try { if (typeof aoProgresso === "function" && (i % 10 === 0 || i === L.length - 1)) aoProgresso({ fase: "comparando", feito: i + 1, total: L.length }); } catch (e) {}
    const lin = { id: j.id, j, of: null, cmp: "", sugestao: "", avisos: [], meta: {} };
    let of = jurCatDoJulgado(j);
    if (!of && /sumula/.test((jurIdentidadesDe(j)[0] || {}).cc || "")) {
      /* súmula gravada com o tribunal trocado: só conta se o TEXTO for o do outro tribunal */
      const outro = String(j.tribunal || "").toUpperCase() === "STF" ? "STJ" : "STF";
      const e = jurCatEntradasDe(Object.assign({}, jurIdentidadesDe(j)[0], { tribunal: outro }))[0];
      if (e && e.item.tese && jurCatComparar(j.tese, e.item.tese) !== "diferente") { of = e; lin.trocarTribunal = outro; }
    }
    if (!of) { lin.estado = "fora"; linhas.push(lin); return; }
    if (of.composto) { lin.estado = "composto"; lin.avisos.push(t("jur_aud_av_composto")); linhas.push(lin); return; }
    if (of.ambiguo) { lin.estado = "ambiguo"; lin.avisos.push(t("jur_aud_av_ambiguo")); linhas.push(lin); return; }
    lin.of = of.item;
    lin.chave = of.chave;
    lin.via = of.via;
    if (!String(of.item.tese || "").trim()) { lin.estado = "sem_tese_oficial"; lin.avisos.push(t("jur_aud_av_sem_tese")); linhas.push(lin); return; }
    lin.cmp = String(j.tese || "").trim() ? jurCatComparar(j.tese, of.item.tese) : "vazia";
    lin.estado = lin.cmp === "igual" || lin.cmp === "forma" ? "confere" : "difere";
    lin.sugestao = lin.estado === "confere" ? "selo" : (lin.cmp === "vazia" ? "oficial" : "");
    /* situação: só sugere o que é MAIS grave do que está guardado */
    if ((of.item.situacao === "cancelada" || of.item.situacao === "superada") && !jurForaDeVigor(j)) {
      lin.situacao = of.item.situacao;
      lin.avisos.push(t("jur_aud_av_situacao", { s: t("jur_sit_" + of.item.situacao) }));
    } else if (jurForaDeVigor(j) && of.item.situacao === "vigente") {
      lin.avisos.push(t("jur_aud_av_situacao_mantida", { s: t("jur_sit_" + j.situacao) }));
    }
    if (lin.trocarTribunal) lin.avisos.push(t("jur_aud_av_tribunal", { a: j.tribunal || "—", b: lin.trocarTribunal }));
    /* DIFERENTE: é a mesma súmula do OUTRO tribunal (gravada com o tribunal errado)? ou outro assunto (número errado)? */
    if (lin.estado === "difere" && lin.cmp !== "vazia") {
      lin.semelhanca = jurCatSemelhanca(j.tese, of.item.tese);
      const id0 = jurIdentidadesDe(j)[0] || {};
      if (/sumula/.test(id0.cc || "") && !lin.trocarTribunal) {
        const outro = String(of.item.tribunal) === "STF" ? "STJ" : "STF";
        const e2 = jurCatEntradasDe(Object.assign({}, id0, { tribunal: outro }))[0];
        if (e2 && e2.item.tese && (jurCatComparar(j.tese, e2.item.tese) !== "diferente" || jurCatSemelhanca(j.tese, e2.item.tese) >= 0.6)) {
          lin.outroTribunal = { tribunal: outro, item: e2.item, chave: e2.chave };
          lin.avisos.push(t("jur_aud_av_tribunal_errado", { a: of.item.tribunal, b: outro, n: of.item.numero }));
        }
      }
      if (!lin.outroTribunal && lin.semelhanca < JUR_CAT_OUTRO_ASSUNTO) {
        lin.outroAssunto = true;
        lin.avisos.unshift(t("jur_aud_av_outro_assunto", { o: jurCatNome(of.item) }));
      }
    }
    ["data", "orgao", "fonte", "relator"].forEach((k) => {
      if (!String(j[k] || "").trim() && String(of.item[k] || "").trim()) lin.meta[k] = of.item[k];
    });
    if (!String(j.precedentes || "").trim() && (of.item.paradigmas || []).length) lin.meta.precedentes = of.item.paradigmas.join("; ");
    if (lin.via === "paradigma") lin.avisos.push(t("jur_aud_av_paradigma", { o: jurCatNome(of.item) }));
    linhas.push(lin);
  });
  const conta = (e) => linhas.filter((x) => x.estado === e).length;
  return { linhas, total: L.length, confere: conta("confere"), difere: conta("difere"), fora: conta("fora"),
    outros: linhas.filter((x) => /composto|ambiguo|sem_tese_oficial/.test(x.estado)).length, geradoEm: (jurCat && jurCat.geradoEm) || "" };
}

/* decisões: { [id]: "selo" | "oficial" | "manter" | "" }; meta: aplica os campos vazios; situacao: marca o que o catálogo diz.
 * Grava UM por vez avisando o progresso, e guarda o recibo (o "antes" de cada um) para desfazer depois. */
function jurCatAplicar(aud, decisoes, opc, aoProgresso) {
  const o = opc || {};
  const hoje = jurHojeISO(o.hoje);
  const alvo = aud.linhas.filter((x) => decisoes[x.id] && x.of);
  const recibo = { em: new Date().toISOString(), itens: [] };
  const feitos = { selo: 0, oficial: 0, manter: 0, tribunal: 0 };
  alvo.forEach((lin0, i) => {
    let lin = lin0;
    try { if (typeof aoProgresso === "function") aoProgresso({ fase: "gravando", feito: i + 1, total: alvo.length }); } catch (e) {}
    const j = jurDe(lin.id);
    if (!j) return;
    const d = decisoes[lin.id];
    const antes = {};
    ["tese", "teseAnterior", "tribunal", "classe", "numero", "data", "orgao", "fonte", "relator", "precedentes", "situacao", "situacaoFonte",
      "conferidoEm", "deMemoria", "aConferir", "selo"].forEach((k) => { antes[k] = j[k] === undefined ? null : JSON.parse(JSON.stringify(j[k])); });
    recibo.itens.push({ id: j.id, antes });
    const patch = { id: j.id };
    const fonte = t("jur_q_fonte_cat", { t: jurCatNome(lin.of), d: jurDataBr(aud.geradoEm) || "—" });
    if (d === "oficial") {
      if (String(j.tese || "").trim()) patch.teseAnterior = j.tese;
      patch.tese = lin.of.tese;
    }
    if (o.meta !== false) Object.keys(lin.meta || {}).forEach((k) => { patch[k] = lin.meta[k]; });
    if (lin.trocarTribunal && (d === "oficial" || d === "selo")) patch.tribunal = lin.trocarTribunal;
    if (d === "tribunal" && lin.outroTribunal) {
      patch.tribunal = lin.outroTribunal.tribunal;
      lin = Object.assign({}, lin, { of: lin.outroTribunal.item, meta: {} });
      ["data", "orgao", "fonte"].forEach((k) => { if (!String(j[k] || "").trim() && String(lin.of[k] || "").trim()) patch[k] = lin.of[k]; });
    }
    if (lin.situacao && o.situacao !== false) { patch.situacao = lin.situacao; patch.situacaoFonte = fonte; }
    jurGravar(patch);
    if (d === "oficial" || d === "selo") jurSeloConceder(j.id, "oficial", fonte, hoje);
    if (d === "tribunal" && jurCatComparar(jurDe(j.id).tese, lin.of.tese) !== "diferente")
      jurSeloConceder(j.id, "oficial", t("jur_q_fonte_cat", { t: jurCatNome(lin.of), d: jurDataBr(aud.geradoEm) || "—" }), hoje);
    feitos[d] = (feitos[d] || 0) + 1;
  });
  try { localStorage.setItem(JUR_CAT_RECIBO, JSON.stringify(recibo)); } catch (e) {}
  try { reg("JURIS", "auditoria pelo catálogo oficial aplicada", JSON.stringify(feitos)); } catch (e) {}
  return { feitos, recibo };
}
function jurCatReciboLer() {
  try { const r = JSON.parse(localStorage.getItem(JUR_CAT_RECIBO) || "null"); return r && Array.isArray(r.itens) && r.itens.length ? r : null; } catch (e) { return null; }
}
/* desfaz a última auditoria aplicada (todos os julgados que ela mexeu voltam ao que eram) */
function jurCatDesfazer() {
  const r = jurCatReciboLer();
  if (!r) return 0;
  let n = 0;
  r.itens.forEach((it) => {
    if (!jurDe(it.id)) return;
    const patch = { id: it.id };
    Object.keys(it.antes).forEach((k) => { patch[k] = it.antes[k] === null ? (k === "aConferir" ? [] : k === "deMemoria" ? false : k === "selo" ? null : "") : it.antes[k]; });
    jurGravar(patch);
    n++;
  });
  try { localStorage.removeItem(JUR_CAT_RECIBO); } catch (e) {}
  try { reg("JURIS", "auditoria pelo catálogo desfeita", n + " julgados"); } catch (e) {}
  return n;
}

/* carrega em segundo plano quando o app abre (sem travar nada): os links e o elo tema ↔ processo ficam prontos */
if (typeof window !== "undefined" && typeof fetch === "function" && typeof document !== "undefined" && !(typeof process !== "undefined" && process.versions && process.versions.node)) {
  try { setTimeout(() => { jurCatCarregar().catch(() => {}); }, 4000); } catch (e) {}
}
