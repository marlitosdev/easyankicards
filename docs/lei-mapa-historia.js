/* =====================================================================
 * (19.168.0) O MAPA CONTA A HISTÓRIA DA LEI
 *
 * O "Mapa e conferência" mostrava a árvore e o que conferir; o que MUDOU na lei desde que ela entrou (as suas correções,
 * as alterações por outras normas, os ajustes do leitor, a limpeza da colagem) estava espalhado ou não aparecia.
 *  1. ✎ NA ÁRVORE: cada divisão diz quantos artigos dela mudaram, e o número do artigo ganha a marca; "só o que mudou"
 *     deixa à vista só esses ramos, abertos, com uma linha por artigo;
 *  2. COMO VEIO × COMO FICOU: em cada artigo marcado, a sequência do que aconteceu com ele — a correção sua (era / ficou),
 *     a alteração por outra norma (o texto-base × a redação em vigor), o ajuste do leitor — só o trecho que mudou;
 *  3. LINHA DO TEMPO: os dias em que algo aconteceu com a lei, do mais novo ao mais antigo — correções, alterações por
 *     norma, as decisões da colagem, da atualização e dos repetidos (do histórico de decisões);
 *  4. DEVOLVER O QUE A LIMPEZA TIROU: nas "Decisões tomadas", cada limpeza aceita mostra o que saiu; dá para copiar (e
 *     colar onde quiser, com o ✎) ou, quando o que saiu é um ARTIGO INTEIRO que não existe mais na lei, devolvê-lo ao
 *     lugar dele na numeração — como uma correção sua, com desfazer.
 * ===================================================================== */
let leiMapaSoMudou = false;
let leiMapaMudAtual = null;      /* Map num → { corr: [], alt, aj: [] } da lei aberta no mapa */

function leiMapaArtigoDaLinha(arts, linha) {
  return (arts || []).find((a) => a.linha <= linha && linha <= (a.linhaFim || a.linha)) || null;
}
/* o que mudou em cada artigo: as correções suas, a alteração por norma, os ajustes do leitor */
function leiMapaMudancas(l, dg) {
  const arts = (dg && dg.estrutura && dg.estrutura.artigos) || [];
  const M = new Map();
  const de = (num) => { if (!M.has(num)) M.set(num, { corr: [], alt: null, aj: [] }); return M.get(num); };
  ((l && l.correcoes) || []).forEach((x) => {
    let onde = null;
    try { onde = x.num ? { num: x.num } : (typeof leiCorrArtigoNaLei === "function" ? leiCorrArtigoNaLei(l, x, arts) : null); } catch (e) { onde = null; }
    if (onde && onde.num) de(onde.num).corr.push(x);
  });
  Object.keys((l && l.alteracoes) || {}).forEach((n) => { de(n).alt = l.alteracoes[n]; });
  ((dg && dg.ajustes) || []).forEach((a) => {
    if (a.informativo) return;
    const ar = leiMapaArtigoDaLinha(arts, a.linha);
    if (ar) de(ar.num).aj.push(a);
  });
  return M;
}
function leiMapaMarcaTip(m) {
  if (!m) return "";
  const p = [];
  const ativas = m.corr.filter((x) => !x.desfeita);
  if (ativas.length) p.push(t("lei_mh_tip_corr", { n: ativas.length }));
  if (m.alt) p.push(t(m.alt.revogado ? "lei_mh_tip_rev" : "lei_mh_tip_alt", { f: m.alt.fonteAlteracao || t("lei_mh_sem_norma") }));
  if (m.aj.length) p.push(t("lei_mh_tip_aj", { n: m.aj.length }));
  return p.join(" · ");
}
function leiMapaMudouNo(no, arts) {
  const mud = leiMapaMudAtual;
  if (!mud) return 0;
  let n = 0;
  (no.artigos || []).forEach((i) => { if (arts[i] && mud.has(arts[i].num)) n++; });
  (no.filhos || []).forEach((f) => { n += leiMapaMudouNo(f, arts); });
  return n;
}

/* ---------------- 2. como veio × como ficou ---------------- */
/* (19.171.0) SÓ EM VOLTA DO QUE MUDOU. O corte antigo tirava só o começo e o fim iguais: com duas mudanças longe uma
 * da outra (art. 91 da LC 15/2009: o caput e um parágrafo), o "era" mostrava o artigo quase inteiro. Agora a comparação
 * é palavra a palavra (a maior sequência em comum) e só aparecem os trechos alterados, cada um com até
 * LEI_MH_CTX palavras em volta; trechos próximos se juntam, os distantes ficam separados por "…". O artigo inteiro fica
 * num "ver o artigo inteiro". Artigo gigante (mais de LEI_MH_DIFF_MAX comparações) volta ao corte antigo. */
const LEI_MH_CTX = 6;
const LEI_MH_DIFF_MAX = 3000000;
function leiMapaDiffPalavras(antes, depois) {
  const A = String(antes || "").match(/\S+\s*/g) || [], B = String(depois || "").match(/\S+\s*/g) || [];
  const n = A.length, m = B.length;
  if ((n + 1) * (m + 1) > LEI_MH_DIFF_MAX) return null;
  const a = A.map((x) => x.trim()), b = B.map((x) => x.trim());
  const W = m + 1;
  const T = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    T[i * W + j] = a[i] === b[j] ? T[(i + 1) * W + j + 1] + 1 : Math.max(T[(i + 1) * W + j], T[i * W + j + 1]);
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: "=", a: A[i], b: B[j] }); i++; j++; }
    else if (T[(i + 1) * W + j] >= T[i * W + j + 1]) { ops.push({ t: "-", a: A[i] }); i++; }
    else { ops.push({ t: "+", b: B[j] }); j++; }
  }
  while (i < n) ops.push({ t: "-", a: A[i++] });
  while (j < m) ops.push({ t: "+", b: B[j++] });
  return ops;
}
/* os trechos: [{ ini, fim }] em ops, já com o contexto e juntando os próximos */
function leiMapaDiffTrechos(ops) {
  const mud = [];
  ops.forEach((o, k) => { if (o.t !== "=") mud.push(k); });
  const tr = [];
  mud.forEach((k) => {
    const ini = Math.max(0, k - LEI_MH_CTX), fim = Math.min(ops.length - 1, k + LEI_MH_CTX);
    const u = tr[tr.length - 1];
    if (u && ini <= u.fim + 1) u.fim = Math.max(u.fim, fim); else tr.push({ ini, fim });
  });
  return tr;
}
function leiMapaDiffEl(antes, depois) {
  const ops = leiMapaDiffPalavras(antes, depois);
  if (ops) {
    const tr = leiMapaDiffTrechos(ops);
    if (!tr.length) return leiPreEl("span", "nota", t("lei_mh_sem_dif"));
    const lado = (qual) => {
      const s = leiPreEl("span", "lei-corr-res");
      tr.forEach((x, q) => {
        if (q || x.ini > 0) s.append(document.createTextNode(q ? " … " : "…"));
        /* as palavras vizinhas que mudaram ficam num destaque só ("de Finanças." e não "de" + "Finanças.") */
        let igual = "", mudou = "";
        const cls = qual === "a" ? "lei-pre-sai" : "lei-pre-entra";
        const soltaM = () => { if (mudou) { const fim = mudou.match(/\s*$/)[0]; s.append(leiPreEl("span", cls, mudou.slice(0, mudou.length - fim.length))); if (fim) s.append(document.createTextNode(fim)); mudou = ""; } };
        const soltaI = () => { if (igual) { s.append(document.createTextNode(igual)); igual = ""; } };
        for (let k = x.ini; k <= x.fim; k++) {
          const o = ops[k];
          if (o.t === "=") { soltaM(); igual += qual === "a" ? o.a : o.b; }
          else if (o.t === "-" && qual === "a") { soltaI(); mudou += o.a; }
          else if (o.t === "+" && qual === "b") { soltaI(); mudou += o.b; }
        }
        soltaM(); soltaI();
      });
      if (tr[tr.length - 1].fim < ops.length - 1) s.append(document.createTextNode("…"));
      return s;
    };
    const box = leiPreEl("span", "lei-mapa-dec-ad");
    box.append(leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_antes")), lado("a"), leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_depois")), lado("b"));
    /* recortou alguma coisa: o artigo inteiro, antes e depois, fica a um toque */
    const cortou = tr.length > 1 || tr[0].ini > 0 || tr[0].fim < ops.length - 1;
    if (cortou) {
      const det = leiPreEl("details", "lei-mh-inteiro");
      det.append(leiPreEl("summary", "", t("lei_mh_ver_inteiro")));
      det.append(leiPreEl("div", "lei-mh-inteiro-tx", t("lei_mapa_dec_antes") + " " + String(antes || "")));
      det.append(leiPreEl("div", "lei-mh-inteiro-tx", t("lei_mapa_dec_depois") + " " + String(depois || "")));
      box.append(det);
    }
    return box;
  }
  const d = leiPreDiff(String(antes || ""), String(depois || ""));
  const ctxA = d.pre.length > 70 ? "…" + d.pre.slice(-70) : d.pre, ctxD = d.suf.length > 70 ? d.suf.slice(0, 70) + "…" : d.suf;
  const parte = (meio, k) => { const s = leiPreEl("span", "lei-corr-res"); s.append(document.createTextNode(ctxA)); if (meio) s.append(leiPreEl("span", "lei-pre-" + k, meio)); s.append(document.createTextNode(ctxD)); return s; };
  const box = leiPreEl("span", "lei-mapa-dec-ad");
  box.append(leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_antes")), parte(d.a, "sai"), leiPreEl("span", "lei-mapa-dec-rot", t("lei_mapa_dec_depois")), parte(d.b, "entra"));
  return box;
}
function leiMapaDataBr(iso) { return String(iso || "").slice(0, 10).split("-").reverse().join("/"); }
/* a sequência do que aconteceu com um artigo, da mais antiga para a mais nova */
function leiMapaHistoriaArt(l, num, m) {
  const out = [];
  if (!m) return out;
  m.corr.forEach((x) => out.push({ quando: x.em || "", tipo: "corr", x }));
  if (m.alt) out.push({ quando: m.alt.data || "", tipo: "alt", x: m.alt });
  m.aj.forEach((a) => out.push({ quando: "", tipo: "aj", x: a }));
  return out.sort((a, b) => String(a.quando).localeCompare(String(b.quando)));
}
function leiMapaHistoriaArtEl(l, num, m) {
  const det = leiPreEl("details", "lei-mh-art");
  det.append(leiPreEl("summary", "", t("lei_mh_comoveio")));
  leiMapaHistoriaArt(l, num, m).forEach((ev) => {
    const lin = leiPreEl("div", "lei-corr-item");
    if (ev.tipo === "corr") {
      const x = ev.x;
      lin.append(leiPreEl("span", "lei-corr-tipo", t("lei_corr_tipo_" + x.tipo) + " · " + t(x.fase === "leitor" ? "lei_mapa_dec_fase_leitor" : x.fase === "atualizar" ? "lei_mapa_dec_fase_upd" : "lei_mapa_dec_fase_criar", { d: leiMapaDataBr(x.em) })
        + (x.desfeita ? " · " + t("lei_mapa_dec_st_desfeita") : "")));
      lin.append(leiMapaDiffEl(leiTirarMarcasTachado(x.antes), leiTirarMarcasTachado(x.depois)));
    } else if (ev.tipo === "alt") {
      const a = ev.x;
      lin.append(leiPreEl("span", "lei-corr-tipo", t(a.revogado ? "lei_mh_ev_rev" : "lei_mh_ev_alt", { f: a.fonteAlteracao || t("lei_mh_sem_norma"), d: leiMapaDataBr(a.data) })));
      let base = "";
      try { const b = leiArtigo(l.texto, num); base = b ? b.texto : ""; } catch (e) { base = ""; }
      if (a.revogado) lin.append(leiPreEl("span", "nota", t("lei_mh_rev_txt")));
      else if (base) lin.append(leiMapaDiffEl(base, a.texto || ""));
      else lin.append(leiPreEl("span", "nota", t("lei_mh_acrescido")));
    } else {
      const a = ev.x;
      let fr = "";
      try { fr = typeof leiAjusteFrase === "function" ? leiAjusteFrase(a) : (a.tipo + " · linha " + a.linha); } catch (e) { fr = a.tipo; }
      lin.append(leiPreEl("span", "lei-corr-tipo", t("lei_mh_ev_aj") + (a.recusado ? " · " + t("lei_mh_aj_recusado") : "")));
      lin.append(leiPreEl("span", "lei-corr-res", fr));
    }
    det.append(lin);
  });
  return det;
}
/* no modo "só o que mudou": uma linha por artigo marcado, com o resumo e "como veio × como ficou" */
function leiMapaLinhasMudouEl(l, no, arts) {
  const box = leiPreEl("div", "lei-mh-lista");
  (no.artigos || []).forEach((i) => {
    const a = arts[i];
    const m = a && leiMapaMudAtual && leiMapaMudAtual.get(a.num);
    if (!m) return;
    const lin = leiPreEl("div", "lei-mh-lin");
    lin.id = "leiMh_" + a.num;
    const b = leiPreEl("button", "lei-ir-n lei-ir-n-mudou", a.numCru);
    b.type = "button"; b.title = a.rotulo;
    b.onclick = () => leiMapaIr(a.num, a.indice);
    lin.append(b, leiPreEl("span", "lei-mh-tip", leiMapaMarcaTip(m)));
    lin.append(leiMapaHistoriaArtEl(l, a.num, m));
    box.append(lin);
  });
  return box;
}
/* os artigos que só existem por alteração (acrescentados por norma: 273-A, 356-B…) não estão no texto colado,
 * logo não estão em ramo nenhum da árvore; ganham um ramo próprio no fim, para a conta do botão fechar */
function leiMapaForaDoTexto(arts) {
  if (!leiMapaMudAtual) return [];
  const tem = new Set((arts || []).map((a) => a.num));
  const chave = (n) => { const m = /^(\d+)(.*)$/.exec(n) || [0, "0", n]; return [Number(m[1]), m[2]]; };
  return Array.from(leiMapaMudAtual.keys()).filter((n) => !tem.has(n))
    .sort((a, b) => { const x = chave(a), y = chave(b); return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); });
}
function leiMapaForaDoTextoEl(l, arts) {
  const nums = leiMapaForaDoTexto(arts);
  if (!nums.length) return null;
  const det = document.createElement("details");
  det.className = "lei-mapa-no";
  det.id = "leiMapaForaDoTexto";
  const sm = document.createElement("summary");
  sm.textContent = t("lei_mh_fora_tit", { n: nums.length }) + " · ✎ " + nums.length;
  sm.title = t("lei_mh_fora_tip");
  det.append(sm);
  if (leiMapaSoMudou) det.open = true;
  const box = leiPreEl("div", "lei-mh-lista");
  nums.forEach((num) => {
    const m = leiMapaMudAtual.get(num);
    const lin = leiPreEl("div", "lei-mh-lin");
    lin.id = "leiMh_" + num;
    const b = leiPreEl("button", "lei-ir-n lei-ir-n-mudou", num);
    b.type = "button";
    b.onclick = () => leiMapaIr(num);
    lin.append(b, leiPreEl("span", "lei-mh-tip", leiMapaMarcaTip(m)));
    lin.append(leiMapaHistoriaArtEl(l, num, m));
    box.append(lin);
  });
  det.append(box);
  return det;
}
/* o botão "só o que mudou", em cima da árvore */
function leiMapaFiltroEl(n) {
  const b = leiPreEl("button", "btn-min lei-mh-filtro" + (leiMapaSoMudou ? " on" : ""), t(leiMapaSoMudou ? "lei_mh_filtro_on" : "lei_mh_filtro", { n }));
  b.type = "button"; b.id = "btnLeiMapaSoMudou";
  b.setAttribute("aria-pressed", leiMapaSoMudou ? "true" : "false");
  b.disabled = !n && !leiMapaSoMudou;
  b.title = t("lei_mh_filtro_tip");
  b.onclick = () => { leiMapaSoMudou = !leiMapaSoMudou; leiMapaAbrir(true); };
  return b;
}

/* ---------------- 3. linha do tempo ---------------- */
function leiMapaLinhaTempo(l) {
  const ev = [];
  ((l && l.correcoes) || []).forEach((x) => ev.push({ dia: String(x.em || "").slice(0, 10), tipo: "corr",
    txt: t("lei_mh_lt_corr", { t: t("lei_corr_tipo_" + x.tipo), a: x.rotulo || (x.linha ? t("lei_corr_linha", { l: x.linha }) : "") }) + (x.desfeita ? " (" + t("lei_mapa_dec_st_desfeita") + ")" : "") }));
  const porNorma = {};
  Object.keys((l && l.alteracoes) || {}).forEach((n) => {
    const a = l.alteracoes[n];
    const k = String(a.data || "").slice(0, 10) + "|" + (a.fonteAlteracao || "?");
    const g = porNorma[k] = porNorma[k] || { dia: String(a.data || "").slice(0, 10), fonte: a.fonteAlteracao || t("lei_mh_sem_norma"), n: 0, rev: 0 };
    g.n++; if (a.revogado) g.rev++;
  });
  Object.keys(porNorma).forEach((k) => { const g = porNorma[k]; ev.push({ dia: g.dia, tipo: "alt", txt: t("lei_mh_lt_alt", { f: g.fonte, n: g.n, r: g.rev }) }); });
  const decs = typeof decLer === "function" ? decLer().filter((d) => d.lei === (l && l.nome) && d.regra !== "colagem.correcao") : [];
  const porDia = {};
  decs.forEach((d) => {
    const k = String(d.q || "").slice(0, 10) + "|" + (d.area || "?");
    const g = porDia[k] = porDia[k] || { dia: String(d.q || "").slice(0, 10), area: d.area || "?", n: 0, ace: 0 };
    g.n++; if (d.decisao === "aceitou") g.ace++;
  });
  Object.keys(porDia).forEach((k) => { const g = porDia[k]; ev.push({ dia: g.dia, tipo: "dec", txt: t("lei_mh_lt_dec_" + (["colagem", "versao", "repetidos"].indexOf(g.area) >= 0 ? g.area : "outra"), { n: g.n, a: g.ace, r: g.n - g.ace, ar: g.area }) }); });
  if (l && l.consultadaEm) ev.push({ dia: String(l.consultadaEm).slice(0, 10), tipo: "consulta", txt: t("lei_mh_lt_consulta") });
  return ev.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.dia)).sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0));
}
function leiMapaLinhaTempoEl(l) {
  const ev = leiMapaLinhaTempo(l);
  if (!ev.length) return null;
  const det = leiPreEl("details", "lei-mapa-dec lei-mh-lt");
  det.id = "leiMapaLinhaTempo";
  det.append(leiPreEl("summary", "", t("lei_mh_lt_tit", { n: ev.length })));
  let dia = "";
  ev.forEach((x) => {
    if (x.dia !== dia) { dia = x.dia; det.append(leiPreEl("div", "lei-mapa-dec-sub", leiMapaDataBr(dia))); }
    det.append(leiPreEl("div", "lei-mh-lt-ev lei-mh-lt-" + x.tipo, "• " + x.txt));
  });
  if (l && l.versao) det.append(leiPreEl("p", "nota", t("lei_mh_lt_versao", { v: String(l.versao).slice(0, 300) })));
  return det;
}

/* ---------------- 4. devolver o que a limpeza tirou ---------------- */
/* o texto que saiu numa decisão da colagem (sem as marcas do riscado) */
function leiMapaTextoQueSaiu(d) {
  const ls = ((d && d.proposta && d.proposta.linhas) || []).map((x) => (typeof leiTirarMarcasTachado === "function" ? leiTirarMarcasTachado(x.texto) : x.texto));
  return ls.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
/* (19.171.0) O TEXTO QUE DIZ QUE FOI REVOGADO. "(Revogado pela Lei nº 12.529, de 2011)", "(Vetado)": saiu riscado da
 * fonte porque não vale mais — devolvê-lo poria texto revogado no meio da lei em vigor. */
const LEI_MH_RE_REVOGADO = /\((?:[^)]*\b)?(?:revogad[oa]s?|vetad[oa]s?|suprimid[oa]s?)\b[^)]*\)|\brevogad[oa]s?\s+pel[oa]\b/i;
function leiMapaTextoRevogado(tx) { return LEI_MH_RE_REVOGADO.test(String(tx || "")); }
/* dá para devolver ao lugar? só um ARTIGO INTEIRO que não existe mais na lei (o número dele está livre).
 * (19.171.0) revogado: o próprio texto diz que foi revogado/vetado (não volta); riscado: veio riscado na fonte (volta,
 * mas avisando — em geral é redação antiga) */
function leiMapaPodeDevolver(l, d) {
  const tx = leiMapaTextoQueSaiu(d);
  if (!tx) return null;
  const a = leiArtigos(tx)[0];
  if (!a || a.linha !== 1) return null;
  let tem = false;
  try { tem = leiArtigosEfetivos(l).some((x) => x.num === a.num); } catch (e) { tem = !!leiArtigo(l.texto, a.num); }
  return tem ? null : { num: a.num, rotulo: a.rotulo || ("Art. " + a.numCru), texto: tx,
    revogado: leiMapaTextoRevogado(tx), riscado: /tachado/.test(String((d && d.regra) || "")) };
}
function leiMapaDevolver(idLei, d) {
  const l = leiDe(idLei);
  const p = l ? leiMapaPodeDevolver(l, d) : null;
  if (!p) return { erro: t("lei_mh_dev_nao") };
  if (p.revogado) return { erro: t("lei_mh_dev_revogado_tip") };
  let final = leiInserirArtigo(l.texto, p.texto);
  if (final === null) return { erro: t("lei_mh_dev_nao") };
  /* o artigo devolvido não gruda no seguinte: uma linha em branco depois dele */
  const ins = leiArtigo(final, p.num);
  if (ins) {
    const NL = String.fromCharCode(10);
    const L = final.split(NL);
    if (L[ins.linhaFim] !== undefined && String(L[ins.linhaFim - 1]).trim() && String(L[ins.linhaFim]).trim()) { L.splice(ins.linhaFim, 0, ""); final = L.join(NL); }
  }
  leiGuardar({ id: idLei, texto: final });
  try { if (typeof leiIdAtual !== "undefined" && leiIdAtual === idLei && $("leiTexto")) $("leiTexto").value = final; } catch (e) {}
  const entrada = { id: "cd" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fase: "leitor", tipo: "devolvido", num: p.num, rotulo: p.rotulo,
    onde: "base", antes: "", depois: p.texto.slice(0, 6000), em: new Date().toISOString(), deDecisao: d.id || "" };
  const l2 = leiDe(idLei);
  leiGuardar({ id: idLei, correcoes: (l2.correcoes || []).concat([entrada]).slice(-200) });
  try { leiReg("editar", "linha da limpeza devolvida à lei", p.rotulo + " · " + (d.regra || "")); } catch (e) {}
  return { ok: true, entrada };
}
async function leiMapaCopiar(txt) {
  try { await navigator.clipboard.writeText(txt); toastMsg(t("lei_mh_copiado"), 3000); return true; }
  catch (e) { if (typeof leiRelatorioMostrar === "function") leiRelatorioMostrar(txt); return false; }
}
/* nas "Decisões tomadas": o que saiu numa regra da limpeza, com copiar e (quando dá) devolver */
function leiMapaSaiuEl(l, itens) {
  const com = itens.filter((d) => d.decisao === "aceitou" && leiMapaTextoQueSaiu(d));
  if (!com.length) return null;
  const det = leiPreEl("details", "lei-mh-saiu");
  det.append(leiPreEl("summary", "", t("lei_mh_saiu_tit", { n: com.length })));
  com.slice(0, 40).forEach((d, k) => {
    const tx = leiMapaTextoQueSaiu(d);
    const lin = leiPreEl("div", "lei-corr-item");
    lin.append(leiPreEl("span", "lei-corr-tipo", d.ref || ""));
    lin.append(leiPreEl("span", "lei-corr-res", tx.length > 220 ? tx.slice(0, 219) + "…" : tx));
    const ac = leiPreEl("span", "lei-mh-saiu-ac");
    const cp = leiPreEl("button", "btn-min", t("lei_mh_copiar"));
    cp.type = "button"; cp.id = "btnLeiMhCopiar_" + (d.id || k);
    cp.onclick = () => leiMapaCopiar(tx);
    ac.append(cp);
    const pd = leiMapaPodeDevolver(l, d);
    if (pd && pd.revogado) {
      /* revogado não volta: diz por quê, no lugar do botão */
      const rv = leiPreEl("span", "lei-mh-revogado", t("lei_mh_dev_revogado"));
      rv.id = "leiMhRevogado_" + (d.id || k); rv.title = t("lei_mh_dev_revogado_tip");
      ac.append(rv);
    } else if (pd) {
      const dv = leiPreEl("button", "btn-min" + (pd.riscado ? "" : " btn-min-ok"), t(pd.riscado ? "lei_mh_devolver_riscado" : "lei_mh_devolver", { a: pd.rotulo }));
      dv.type = "button"; dv.id = "btnLeiMhDevolver_" + (d.id || k); dv.title = t(pd.riscado ? "lei_mh_devolver_riscado_tip" : "lei_mh_devolver_tip");
      dv.onclick = async () => {
        if (!(await uiConfirm((pd.riscado ? t("lei_mh_devolver_aviso_riscado") + "\n\n" : "") + t("lei_mh_devolver_conf", { a: pd.rotulo, x: pd.texto.slice(0, 400) })))) return;
        const r = leiMapaDevolver(l.id, d);
        if (r.erro) { uiAlert(r.erro); return; }
        try { toastMsg(t("lei_mh_devolvido", { a: pd.rotulo }), 4500); } catch (e) {}
        if (typeof leiPintar === "function") leiPintar();
        leiMapaAbrir(true);
        const dd = $("leiMapaDec"); if (dd) dd.open = true;
      };
      ac.append(dv);
    }
    lin.append(ac);
    det.append(lin);
  });
  if (com.length > 40) det.append(leiPreEl("p", "nota", t("lei_mapa_dec_mais", { n: com.length - 40 })));
  return det;
}
