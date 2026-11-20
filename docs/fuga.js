/* =====================================================================
 * (19.173.0) ⚡ FUGA RÁPIDA — a pausa ativa de 3 minutos
 *
 * Quando a concentração cai no meio de uma sessão longa, a saída comum é o celular. O e-book ("Revisões de alto
 * desempenho") propõe o "assunto de fuga": uma lista curta de decorebas, prazos, exceções e vedações de OUTRAS
 * matérias, lida por 3 a 5 minutos — troca o contexto, descansa a cabeça e não sai do estudo.
 *
 * (19.185.0) A FUGA REFEITA. Era uma lista fixa de 5 textos (2 cartões, 2 pegadinhas, 1 prazo de uma lei qualquer) e só
 * "ver resposta". O que o app ganhou depois não chegava nela: o caderno de erros e chutes, os artigos que caem e onde
 * você erra, os julgados, os ramos esquecidos do mapa, os editais em andamento. Agora:
 *  · UM ITEM POR VEZ, como um cartão: tente lembrar, vire (espaço), diga "sabia" (S) ou "não sabia" (N);
 *  · CADA TIPO COM A SUA INTERAÇÃO: a questão do caderno se responde ali (Certo/Errado ou a alternativa); o artigo
 *    abre na lei; o julgado abre na Jurisprudência;
 *  · AS FONTES: cartões difíceis, questões do caderno, artigos que caem (ou onde você erra) e com prazo, julgados,
 *    pegadinhas marcadas (resumos e leis), ramos esquecidos do mapa e as suas dicas — você liga e desliga ("o que
 *    entra"), e a duração (3 ou 5 min) fica lembrada;
 *  · O SORTEIO: fora da disciplina de agora, só disciplinas dos editais em andamento (quando há), sem repetir disciplina
 *    na rodada enquanto houver outra, os mais difíceis primeiro e evitando o que saiu nas últimas fugas;
 *  · "OUTROS 5" É UMA CORRENTE: a rodada seguinte começa do tipo onde a anterior parou, nunca repete um item desta fuga,
 *    e o relógio NÃO recomeça (a fuga inteira dura o tempo escolhido). "Como funciona" diz isso na própria janela;
 *  · NO FIM, o resumo de todas as rodadas: os cartões que você não sabia vão, se você quiser, para "De novo" na agenda
 *    dos cartões; os outros itens abrem no lugar deles.
 * (19.187.0) O CARTÃO DA FUGA É O CARTÃO DO ESTUDO: a lacuna com a dica, a múltipla escolha, as fórmulas, "✚ saiba
 * mais", as citações ligadas, os avisos (cartão difícil, ramo do mapa) e as QUATRO NOTAS com o intervalo de cada uma —
 * que valem na agenda dos cartões, como no estudo. E A RODADA SE VÊ: as 5 bolinhas no topo dizem que há outros itens (a
 * atual em destaque, as respondidas com a cor do resultado; tocar numa leva a ela), no lugar do "item 1 de 5" e das
 * linhas de explicação — que viraram ⓘ e ⚙ no canto.
 * (19.186.0) A RESPOSTA À QUESTÃO ENTRA NO HISTÓRICO DELA (origem "fuga"): sem isso, uma questão que você acerta sempre
 * na fuga nunca saía do caderno (que a tira com 2 acertos seguidos) e voltava sempre. E FECHAR A JANELA ENCERRA A FUGA
 * por qualquer caminho (Esc, "voltar ao estudo"): o relógio para e o registro anota o que foi feito — antes, só o
 * "terminar e ver o resumo" anotava, e o relógio seguia contando escondido.
 * ===================================================================== */
const FUGA_SEG = 180;
const FUGA_PREF_CH = "eac_fuga_pref";
const FUGA_VISTOS_CH = "eac_fuga_vistos";
const FUGA_VISTOS_MAX = 80;
const FUGA_RE_PRAZO = /\b\d+\s*(?:\([^)]{1,30}\)\s*)?(?:dias?|meses|m[eê]s|anos?|horas?)\b/i;
const FUGA_RE_PEG = /==~((?:[^=\n]|=(?!=))+)==/g;
const FUGA_RE_IMP = /==!((?:[^=\n]|=(?!=))+)==/g;
/* a CORRENTE dos tipos: cada rodada pega um de cada, na ordem, e a seguinte continua de onde esta parou */
const FUGA_ROTA = ["cartao", "questao", "artigo", "marca", "julgado", "mapa", "prazo", "dica"];
/* as fontes que a pessoa liga e desliga ("o que entra") e os tipos de cada uma */
const FUGA_FONTES = { cartoes: ["cartao"], questoes: ["questao"], leis: ["artigo", "prazo"], julgados: ["julgado"], marcas: ["marca"], mapa: ["mapa"], dicas: ["dica"] };
const FUGA_ICO = { cartao: "🃏", questao: "❓", artigo: "⚖", prazo: "⏳", julgado: "🏛", pegadinha: "⚠", importante: "❗", mapa: "🗺", dica: "💡" };

function fugaNorm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
function fugaLimpo(s) {
  return String(s || "").replace(/\{\{c\d+::([\s\S]*?)\}\}/g, (m, x) => x.split("::")[0]).replace(/\*\*|__|==[!?§*~@]?/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    /* o "* " / "- " / "1. " da lista que veio junto com a marca (marcas antigas, ver matMarcaAntesDaLista) */
    .replace(/^(?:[-*]|\d+[.)])\s+/, "");
}
function fugaHash(s) { let h = 5381; const x = String(s || ""); for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
/* a identidade de um item (para não repetir nesta fuga e evitar o das últimas) */
function fugaChave(x) {
  if (!x) return "";
  if (x.tipo === "questao" || x.tipo === "julgado") return x.tipo + ":" + x.id;
  if (x.tipo === "artigo" || x.tipo === "prazo") return x.tipo + ":" + (x.leiId || x.lei) + ":" + (x.num || x.rotulo);
  if (x.tipo === "mapa") return "mapa:" + x.chave + ":" + x.caminho;
  return x.tipo + ":" + fugaHash(x.frente || x.texto);
}
/* a disciplina de agora: a do resumo aberto; sem ele, a do último registro de hoje no diário */
function fugaDiscAtual() {
  try { if (typeof matAtual !== "undefined" && matAtual && matAtual.disciplina) return matAtual.disciplina; } catch (e) {}
  try {
    const hoje = typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10);
    const d = ((typeof edDiario !== "undefined" && edDiario) || []).filter((x) => x && x.d === hoje && x.disc);
    if (d.length) return d[d.length - 1].disc;
  } catch (e) {}
  return "";
}
function fugaEmbaralhar(a, rnd) {
  const r = rnd || Math.random;
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t0 = x[i]; x[i] = x[j]; x[j] = t0; }
  return x;
}
/* disciplina e tópico de uma chave de tópico ("disciplina›tópico"): os nomes como o resumo os guarda, se houver */
function fugaDoTopico(chave) {
  const ch = String(chave || "");
  let r = null;
  try { r = typeof matObter === "function" ? matObter(ch) : null; } catch (e) { r = null; }
  if (!r && typeof matResumos !== "undefined" && matResumos) r = matResumos[ch] || null;
  const p = ch.split("›");
  return { disciplina: (r && r.disciplina) || p[0] || "", topico: (r && r.topico) || p[1] || "" };
}
/* as disciplinas dos editais em andamento (normalizadas); vazio = sem edital, vale tudo */
function fugaDiscsDosEditais() {
  const s = new Set();
  try {
    if (typeof lvEditaisAtivos === "function" && typeof lvTopicosDoEdital === "function") {
      lvEditaisAtivos().forEach((e) => lvTopicosDoEdital(e).forEach((tp) => s.add(fugaNorm(tp.disciplina))));
    }
  } catch (e) {}
  return s;
}

/* ---------------- preferências e memória ---------------- */
function fugaPref() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(FUGA_PREF_CH) || "null"); } catch (e) { o = null; }
  const fontes = {};
  Object.keys(FUGA_FONTES).forEach((k) => { fontes[k] = !(o && o.fontes && o.fontes[k] === false); });
  const min = o && (o.min === 5 || o.min === 3) ? o.min : 3;
  return { fontes, min };
}
function fugaPrefDefinir(mud) {
  const p = fugaPref();
  if (mud && mud.fontes) Object.keys(mud.fontes).forEach((k) => { if (k in p.fontes) p.fontes[k] = !!mud.fontes[k]; });
  if (mud && (mud.min === 3 || mud.min === 5)) p.min = mud.min;
  /* nunca todas desligadas: a fuga ficaria vazia sem dizer por quê */
  if (!Object.keys(p.fontes).some((k) => p.fontes[k])) p.fontes.cartoes = true;
  try { localStorage.setItem(FUGA_PREF_CH, JSON.stringify(p)); } catch (e) {}
  return p;
}
function fugaVistosLer() {
  try { const v = JSON.parse(localStorage.getItem(FUGA_VISTOS_CH) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function fugaVistosJuntar(chaves) {
  const v = fugaVistosLer().filter((k) => chaves.indexOf(k) < 0).concat(chaves).slice(-FUGA_VISTOS_MAX);
  try { localStorage.setItem(FUGA_VISTOS_CH, JSON.stringify(v)); } catch (e) {}
  return v;
}

/* ---------------- as fontes ---------------- */
/* os cartões difíceis: [{ tipo: "cartao", disciplina, topico, frente, verso, peso, uid }] (uid: a unidade mais difícil) */
function fugaCartoes() {
  let notas = [];
  try { notas = typeof cqLerBiblioteca === "function" ? cqLerBiblioteca() : []; } catch (e) { notas = []; }
  let regs = {};
  try { regs = typeof ESTC_CH_REGS !== "undefined" && typeof estcLerJSON === "function" ? estcLerJSON(ESTC_CH_REGS, {}) : ((typeof estcRegs !== "undefined" && estcRegs) || {}); } catch (e) { regs = {}; }
  const out = [];
  notas.forEach((n) => {
    if (!n || !n.card) return;
    let ids = [];
    try { ids = typeof estcIdsDoCard === "function" ? estcIdsDoCard(n.card) : []; } catch (e) { ids = []; }
    let peso = 0, uid = "";
    ids.forEach((id) => {
      const r = regs[id];
      if (!r) return;
      const h = Array.isArray(r.h) ? r.h : [];
      const p = (Number(r.l) || 0) * 2 + h.filter((v) => v === 1).length;
      if (p > peso) { peso = p; uid = id; }
    });
    if (peso < 2) return;
    const c = n.card;
    const frente = String(c.front || "").replace(/\{\{c\d+::([\s\S]*?)\}\}/g, (m, x) => { const p = x.split("::"); return p[1] ? "[" + p[1] + "]" : "[…]"; });
    const verso = fugaLimpo([c.front && /\{\{c\d+::/.test(c.front) ? c.front : "", c.back].filter(Boolean).join(" — "));
    const mc = /#c(\d+)$/.exec(uid);
    out.push({ tipo: "cartao", disciplina: n.disciplina || "", topico: n.topico || "", frente: fugaLimpo(frente).slice(0, 400), verso: verso.slice(0, 500), peso, uid,
      nota: n, cn: mc ? Number(mc[1]) : 0 });
  });
  return out.sort((a, b) => b.peso - a.peso);
}
/* as questões do caderno de erros e chutes: [{ tipo: "questao", id, disciplina, topico, frente, q, peso }] */
function fugaQuestoes() {
  let banco = [];
  try { banco = typeof qsTodas === "function" ? (qsTodas() || []) : []; } catch (e) { banco = []; }
  const out = [];
  banco.forEach((q) => {
    let est = null;
    try { est = typeof qsCadernoEstado === "function" ? qsCadernoEstado(q) : null; } catch (e) { est = null; }
    if (!est || !est.dentro) return;
    const en = fugaLimpo(Array.isArray(q.enunciado) ? q.enunciado.join(" ") : q.enunciado);
    if (en.length < 12 || !String(q.gabarito || "").trim()) return;
    out.push({ tipo: "questao", id: q.id, disciplina: q.disciplina || "", topico: q.topico || "", frente: en.slice(0, 700), q, peso: est.errou ? 3 : 2 });
  });
  return out.sort((a, b) => b.peso - a.peso);
}
/* os artigos que caem nas suas questões (os que você erra primeiro), das leis dos editais em andamento:
 * [{ tipo: "artigo", lei, leiId, num, rotulo, disciplina, topico, frente, verso, motivo, peso }] */
function fugaArtigos() {
  const out = [];
  if (typeof qsTodas !== "function" || typeof qsArtigosDaQuestao !== "function") return out;
  /* UMA PASSADA pelas questões (a mesma decisão de lei das irmãs e da fila dos nunca vistos). O ranking da lei lia o
   * banco inteiro uma vez POR LEI: com 20 leis, 3 s para abrir uma pausa de 3 minutos. A disciplina do artigo é a das
   * questões que o citam (a de mais questões) — é por ela que a fuga sai da disciplina de agora e fica nos editais. */
  const agg = {};
  (qsTodas() || []).forEach((q) => {
    let as = [];
    try { as = qsArtigosDaQuestao(q) || []; } catch (e) { as = []; }
    const vistos = {};
    as.forEach((a) => {
      if (!a || !a.leiId || vistos[a.chave]) return;
      vistos[a.chave] = true;
      const r = agg[a.chave] || (agg[a.chave] = { leiId: a.leiId, num: a.num, q: 0, e: 0, a: 0, discs: {}, tops: {}, fontes: [] });
      r.q++;
      /* (19.188.0) de onde saiu: as questões que citam (a nomeada primeiro — é a que diz a lei com todas as letras) */
      r.fontes.push({ q, como: a.como || "", trecho: a.trecho || "", citado: a.citado || "" });
      if (q.disciplina) r.discs[q.disciplina] = (r.discs[q.disciplina] || 0) + 1;
      if (q.topico) r.tops[q.topico] = (r.tops[q.topico] || 0) + 1;
      (q.tentativas || []).forEach((tt) => { if (tt && tt.acertou && !tt.chute) r.a++; else if (tt) r.e++; });
    });
  });
  const efetivosDe = {};
  const maisDe = (o) => Object.keys(o).sort((x, y) => o[y] - o[x])[0] || "";
  Object.keys(agg).map((k) => agg[k]).sort((x, y) => (y.e - y.a) - (x.e - x.a) || y.q - x.q).slice(0, 80).forEach((r) => {
    const l = typeof leiDe === "function" ? leiDe(r.leiId) : null;
    if (!l || !l.texto) return;
    if (!efetivosDe[l.id]) { try { efetivosDe[l.id] = leiArtigosEfetivos(l); } catch (e) { efetivosDe[l.id] = []; } }
    const a = efetivosDe[l.id].find((x) => x.num === r.num);
    if (!a || a.revogado) return;
    const corpo = fugaLimpo(a.corpo || a.texto || "");
    if (corpo.length < 10) return;
    const erra = r.e > r.a;
    let nota = "";
    try { nota = typeof leiNotaDe === "function" ? String(leiNotaDe(l.id, r.num) || "") : ""; } catch (e) { nota = ""; }
    const tp = fugaDoTopico((l.topicos || [])[0]);
    const ordem = { vinculo: 0, nomeada: 1, alteradora: 2, deduzida: 3, topico: 4 };
    const fonte = r.fontes.slice().sort((x, y) => (ordem[x.como] == null ? 5 : ordem[x.como]) - (ordem[y.como] == null ? 5 : ordem[y.como]))[0] || null;
    /* a lei que NENHUMA questão nomeia (todas sem a lei escrita) é uma dedução: pesa menos e a fuga avisa */
    const soDeduzida = r.fontes.length && r.fontes.every((f) => f.como === "topico" || f.como === "deduzida");
    const curta = fugaLeiRotulo(l);
    out.push({ tipo: "artigo", lei: l.nome || "", leiCurta: curta || l.nome || "", leiId: l.id, num: r.num, rotulo: a.rotulo || ("Art. " + r.num),
      disciplina: maisDe(r.discs) || tp.disciplina, topico: maisDe(r.tops) || tp.topico,
      frente: a.rotulo + " · " + (curta || l.nome || "") + (nota ? " — " + fugaLimpo(nota) : ""), verso: corpo.slice(0, 900),
      motivo: t(erra ? "fuga_art_erra" : "fuga_art_cai", { q: r.q, e: r.e }), peso: (erra ? 10 : 0) + r.q - (soDeduzida ? 3 : 0),
      fonte, soDeduzida: !!soDeduzida });
  });
  /* (19.189.0) OS ★ IMPORTANTES (IA ou você) entram na frente: o que já veio das questões ganha o selo; o que não veio
   * entra com o motivo da lista */
  try {
    if (typeof liTodos === "function") {
      liTodos().forEach((im) => {
        const ja = out.find((x) => x.leiId === im.leiId && x.num === im.num);
        const motivoImp = t(im.de === "ia" ? "fuga_imp_ia" : "fuga_imp_voce", { e: im.edId && typeof liEditalNome === "function" ? liEditalNome(im.edId) : t("li_geral") }) + (im.motivo ? " — " + im.motivo : "");
        if (ja) { ja.imp = im; ja.motivoImp = motivoImp; ja.peso += 14; return; }
        const l = typeof leiDe === "function" ? leiDe(im.leiId) : null;
        if (!l || !l.texto) return;
        if (!efetivosDe[l.id]) { try { efetivosDe[l.id] = leiArtigosEfetivos(l); } catch (e) { efetivosDe[l.id] = []; } }
        const a = efetivosDe[l.id].find((x) => x.num === im.num);
        if (!a || a.revogado) return;
        const corpo = fugaLimpo(a.corpo || a.texto || "");
        if (corpo.length < 10) return;
        const curta = fugaLeiRotulo(l);
        const tp = fugaDoTopico((l.topicos || [])[0]);
        out.push({ tipo: "artigo", lei: l.nome || "", leiCurta: curta, leiId: l.id, num: im.num, rotulo: a.rotulo || ("Art. " + im.num),
          disciplina: tp.disciplina, topico: tp.topico, frente: a.rotulo + " · " + curta, verso: corpo.slice(0, 900),
          motivo: "", peso: 14, fonte: null, imp: im, motivoImp });
      });
    }
  } catch (e) {}
  return out.sort((a, b) => b.peso - a.peso);
}
/* o nome da lei que diz QUAL é: o número ("Lei 9.784/1999"); sem número, o nome curto do leitor ("Constituição") */
function fugaLeiRotulo(l) {
  const nome = String((l && l.nome) || "").trim();
  const m = nome.match(/^(.{0,30}?\d[\d.]*\/\d{2,4})/);
  if (m) return m[1].trim();
  try { if (typeof leiNomeCurto === "function") return leiNomeCurto(l); } catch (e) {}
  return nome.length > 30 ? nome.slice(0, 29) + "…" : nome;
}
/* os trechos marcados nos resumos E nas leis: [{ tipo: "pegadinha" | "importante", disciplina, topico, texto, onde }]
 * (19.194.0) "onde" diz de onde a marca saiu, para abrir a fonte com o trecho em destaque: { resumo: chave } ou
 * { leiId, num, rotulo } (o artigo que contém a marca) */
function fugaMarcas() {
  const out = [];
  const juntar = (txt, disciplina, topico, origem, ondeDe) => {
    if (String(txt || "").indexOf("==") < 0) return;
    [[FUGA_RE_PEG, "pegadinha"], [FUGA_RE_IMP, "importante"]].forEach(([re, tipo]) => {
      String(txt).replace(re, (m, x) => {
        const s = fugaLimpo(x);
        if (s.length >= 12) {
          const o = Object.assign({ tipo, disciplina: disciplina || "", topico: topico || "", texto: s.slice(0, 400) }, origem ? { origem } : {});
          const w = ondeDe ? ondeDe(m) : null;
          if (w) o.onde = w;
          out.push(o);
        }
        return m;
      });
    });
  };
  const rs = typeof matResumos !== "undefined" ? matResumos : {};
  Object.keys(rs).forEach((k) => { const r = rs[k]; juntar(r && r.texto, r && r.disciplina, r && r.topico, "", () => ({ resumo: k })); });
  /* (19.185.0) as pegadinhas que você marcou na própria letra da lei */
  try {
    leisLista().forEach((l) => {
      if (!l || String(l.texto || "").indexOf("==") < 0) return;
      const tp = fugaDoTopico((l.topicos || [])[0]);
      let arts = null;
      juntar(l.texto, tp.disciplina, tp.topico, l.nome, (m) => {
        if (arts === null) { try { arts = typeof leiArtigos === "function" ? leiArtigos(l.texto) : []; } catch (e) { arts = []; } }
        const a = arts.find((y) => String((y && y.texto) || "").indexOf(m) >= 0);
        return { leiId: l.id, num: a ? a.num : "", rotulo: a ? (a.rotulo || ("Art. " + (a.numCru || a.num))) : "" };
      });
    });
  } catch (e) {}
  return out;
}
/* os artigos com prazo das suas leis: [{ tipo: "prazo", lei, leiId, num, rotulo, texto, disciplina }] (no máximo 8 por lei) */
function fugaPrazos(rnd) {
  const out = [];
  let leis = [];
  try { leis = Object.keys(leisLerTudo() || {}).map((k) => leisLerTudo()[k]).filter((l) => l && l.texto); } catch (e) { leis = []; }
  fugaEmbaralhar(leis, rnd).slice(0, 6).forEach((l) => {
    let arts = [];
    try { arts = leiArtigos(l.texto); } catch (e) { arts = []; }
    const tp = fugaDoTopico((l.topicos || [])[0]);
    let n = 0;
    fugaEmbaralhar(arts, rnd).some((a) => {
      const tx = String(a.texto || "");
      if (/revogad|vetad/i.test(tx.slice(0, 200)) || !FUGA_RE_PRAZO.test(tx) || tx.length > 900) return false;
      out.push({ tipo: "prazo", lei: l.nome || "", leiId: l.id, num: a.num, rotulo: a.rotulo || ("Art. " + a.numCru), texto: fugaLimpo(tx).slice(0, 600),
        disciplina: (l.topicos || []).length ? tp.disciplina : "", topico: (l.topicos || []).length ? tp.topico : "" });
      return ++n >= 8;
    });
  });
  return out;
}
/* os julgados (a tese é a decoreba): [{ tipo: "julgado", id, disciplina, topico, frente, verso, peso }] */
function fugaJulgados() {
  let js = [];
  try { js = typeof jurLista === "function" ? jurLista() : []; } catch (e) { js = []; }
  const out = [];
  js.forEach((j) => {
    const tese = fugaLimpo(j.tese || "");
    if (tese.length < 20 || tese.length > 700) return;
    const nome = typeof jurCitNome === "function" ? jurCitNome(j) : [j.tribunal, j.classe, j.numero].filter(Boolean).join(" ");
    if (!String(nome || "").trim()) return;
    const tp = fugaDoTopico((j.topicos || [])[0]);
    out.push({ tipo: "julgado", id: j.id, disciplina: tp.disciplina, topico: tp.topico, frente: nome, verso: tese,
      peso: /s[úu]mula/i.test(String(j.classe || "")) ? 2 : 1 });
  });
  return out.sort((a, b) => b.peso - a.peso);
}
/* os ramos que você esqueceu no "tentar lembrar" do mapa: [{ tipo: "mapa", chave, caminho, disciplina, topico, frente, verso }] */
function fugaMapa() {
  let tr = {};
  try { tr = typeof mmTreinoLer === "function" ? mmTreinoLer() : {}; } catch (e) { tr = {}; }
  const out = [];
  Object.keys(tr).slice(0, 40).forEach((k) => {
    const res = tr[k] || {};
    const esq = Object.keys(res).filter((c) => res[c] && res[c].v === "n");
    if (!esq.length || typeof mmArvoreDaChave !== "function") return;
    let arv = null;
    try { arv = mmArvoreDaChave(k); } catch (e) { arv = null; }
    if (!arv || !arv.raiz) return;
    const achar = (no, pai) => {
      if (esq.indexOf(no.caminho) >= 0 && !no.raiz) {
        const verso = no.det ? fugaLimpo(no.det) : (no.filhos || []).map((f) => fugaLimpo(f.label)).join("; ");
        if (verso) {
          const ch = k.replace(/\|ia$/, "");
          const tp = fugaDoTopico(ch);
          out.push({ tipo: "mapa", chave: ch, caminho: no.caminho, disciplina: tp.disciplina, topico: tp.topico,
            frente: (pai && !pai.raiz ? fugaLimpo(pai.label) + " › " : "") + fugaLimpo(no.label), verso: verso.slice(0, 600) });
        }
      }
      (no.filhos || []).forEach((f) => achar(f, no));
    };
    achar(arv.raiz, null);
  });
  return out;
}
/* as suas dicas do caderno: [{ tipo: "dica", disciplina, topico, texto }] */
function fugaDicas() {
  try {
    if (typeof qsBizu !== "function" || typeof qsFiltrar !== "function") return [];
    const out = [];
    qsBizu(qsFiltrar({ caderno: true })).forEach((g) => g.itens.forEach((x) => {
      const s = fugaLimpo(x.dica);
      if (s.length >= 8) out.push({ tipo: "dica", disciplina: g.disciplina, topico: g.topico, texto: s.length > 400 ? s.slice(0, 399) + "…" : s });
    }));
    return out;
  } catch (e) { return []; }
}
/* todas as fontes de uma vez (a fuga lê uma vez ao abrir; "outros 5" reaproveita) */
function fugaFontesTodas(rnd) {
  const discs = fugaDiscsDosEditais();
  const pega = (fn) => { try { return fn() || []; } catch (e) { return []; } };
  return {
    cartoes: pega(fugaCartoes), questoes: pega(fugaQuestoes), artigos: pega(fugaArtigos), marcas: pega(fugaMarcas),
    julgados: pega(fugaJulgados), mapa: pega(fugaMapa), prazos: pega(() => fugaPrazos(rnd)), dicas: pega(fugaDicas), discs,
  };
}

/* ---------------- O SORTEIO (uma rodada) ----------------
 * opc: { disc, rnd, fontes, ativas: { cartoes, questoes, ... }, excluir: [chaves], vistos: [chaves], inicio, n, discs }
 * devolve { itens, disc, proxInicio } — proxInicio é onde a próxima rodada continua a corrente */
function fugaSortear(opc) {
  const o = opc || {};
  const rnd = o.rnd || Math.random;
  const n = o.n || 5;
  /* (19.194.0) "ampliar": sem o corte da disciplina de agora e dos editais (o que a pessoa pede quando o escopo secou) */
  const atual = o.amplo ? "" : fugaNorm(o.disc !== undefined ? o.disc : fugaDiscAtual());
  const F = o.fontes || fugaFontesTodas(rnd);
  const discs = o.amplo ? new Set() : (o.discs || F.discs || new Set());
  const ativas = o.ativas || fugaPref().fontes;
  const excluir = new Set(o.excluir || []);
  const vistos = o.vistos || [];
  const tipoAtivo = (tp) => Object.keys(FUGA_FONTES).some((k) => ativas[k] !== false && FUGA_FONTES[k].indexOf(tp) >= 0);
  const serve = (x) => {
    const d = fugaNorm(x.disciplina);
    if (atual && d && d === atual) return false;                     /* nada da disciplina de agora */
    if (discs.size && d && !discs.has(d)) return false;              /* só os editais em andamento (quando há) */
    return !excluir.has(fugaChave(x));
  };
  /* dentro de cada tipo: os mais difíceis primeiro, sorteados entre os 12 do topo; o que saiu nas últimas fugas vai para o fim */
  const preparar = (lista) => {
    const ok = (lista || []).filter(serve);
    const novos = ok.filter((x) => vistos.indexOf(fugaChave(x)) < 0), velhos = ok.filter((x) => vistos.indexOf(fugaChave(x)) >= 0);
    return fugaEmbaralhar(novos.slice(0, 12), rnd).concat(novos.slice(12), fugaEmbaralhar(velhos, rnd));
  };
  const marcas = (F.marcas || []);
  const pools = {
    cartao: preparar(F.cartoes), questao: preparar(F.questoes), artigo: preparar(F.artigos),
    marca: preparar(marcas.filter((x) => x.tipo === "pegadinha")).concat(preparar(marcas.filter((x) => x.tipo === "importante"))),
    julgado: preparar(F.julgados), mapa: preparar(F.mapa), prazo: preparar(F.prazos), dica: preparar(F.dicas),
  };
  const out = [], usadas = {};
  let pos = Math.max(0, o.inicio || 0), seco = 0;
  while (out.length < n && seco < FUGA_ROTA.length) {
    const tp = FUGA_ROTA[pos % FUGA_ROTA.length];
    pos++;
    const pool = pools[tp];
    if (!tipoAtivo(tp === "marca" ? "marca" : tp) || !pool.length) { seco++; continue; }
    /* disciplina ainda não usada na rodada; sem ela, qualquer uma */
    let k = pool.findIndex((x) => { const d = fugaNorm(x.disciplina || x.lei || ""); return !d || !usadas[d]; });
    if (k < 0) k = 0;
    const x = pool.splice(k, 1)[0];
    out.push(x);
    usadas[fugaNorm(x.disciplina || x.lei || "")] = true;
    seco = 0;
  }
  return { itens: out, disc: o.disc !== undefined ? o.disc : fugaDiscAtual(), proxInicio: pos % FUGA_ROTA.length };
}

/* ---------------- A SESSÃO (a fuga aberta) ---------------- */
let fugaS = null;          /* { fontes, rodada, inicio, itens, i, revelado, respostas: [{ item, sabia, rodada }], vistos: [], fase, fim, min } */
let fugaRelogio = null, fugaFim = 0;
function fugaEstado() { return fugaS; }
function fugaAbrir(opc) {
  const o = opc || {};
  const pref = fugaPref();
  fugaS = { fontes: o.fontes || null, rodada: 0, inicio: 0, itens: [], i: 0, revelado: false, respostas: [], vistos: [], fase: "item",
    min: pref.min, disc: o.disc !== undefined ? o.disc : fugaDiscAtual(), rnd: o.rnd || Math.random };
  if (!fugaS.fontes) fugaS.fontes = fugaFontesTodas(fugaS.rnd);
  fugaNovaRodada();
  fugaFim = Date.now() + fugaS.min * 60 * 1000;
  fugaTique();
  try { if (fugaRelogio) clearInterval(fugaRelogio); fugaRelogio = setInterval(fugaTique, 1000); } catch (e) {}
  try { reg("ESTUDO", "fuga rápida aberta", fugaS.min + " min · " + Object.keys(pref.fontes).filter((k) => pref.fontes[k]).join(", ")); } catch (e) {}
  /* (19.187.0) "como funciona" e "o que entra" ficam fechados no ⓘ e no ⚙ do canto: a rodada (as bolinhas) é que se explica */
  fugaPainel("");
  fugaChipsPintar();
  if (typeof abrirModal === "function") abrirModal("dlgFuga");
  return true;
}
/* a rodada seguinte da corrente: continua o tipo de onde parou e não repete nada desta fuga */
function fugaNovaRodada() {
  if (!fugaS) return null;
  const pref = fugaPref();
  const r = fugaSortear({ disc: fugaS.disc, rnd: fugaS.rnd, fontes: fugaS.fontes, ativas: pref.fontes, excluir: fugaS.vistos,
    vistos: fugaVistosLer(), inicio: fugaS.inicio, amplo: !!fugaS.amplo });
  /* uma tentativa vazia não é rodada: ampliar ou ligar uma fonte depois do vazio começa da rodada 1 */
  if (fugaS.fase !== "vazio" || fugaS.rodada === 0) fugaS.rodada++;
  /* secou no meio da fuga: o resumo diz por quê */
  fugaS.esgotou = !r.itens.length && fugaS.respostas.length > 0;
  fugaS.itens = r.itens;
  fugaS.inicio = r.proxInicio;
  fugaS.i = 0;
  fugaS.passados = {};
  fugaS.revelado = false;
  fugaS.fase = r.itens.length ? "item" : (fugaS.respostas.length ? "resumo" : "vazio");
  r.itens.forEach((x) => fugaS.vistos.push(fugaChave(x)));
  fugaVistosJuntar(r.itens.map(fugaChave));
  fugaPintar();
  return r;
}
/* =====================================================================
 * (19.194.0) QUANDO NÃO HÁ O QUE MOSTRAR NO ESCOPO
 * A fuga dizia "ainda não há material" mesmo com centenas de itens — só que todos da disciplina de agora, ou fora dos
 * editais em andamento, ou de fontes desligadas no ⚙. E o relógio corria e "outros 5" não fazia nada. Agora o vazio
 * diz POR QUE (com quantos itens ficaram de fora em cada corte) e oferece a saída de cada um: "incluir mesmo assim"
 * (amplia o escopo nesta fuga) e "o que entra" (o ⚙ com as fontes).
 * ===================================================================== */
const FUGA_FONTE_LISTAS = { cartoes: ["cartoes"], questoes: ["questoes"], leis: ["artigos", "prazos"], julgados: ["julgados"], marcas: ["marcas"], mapa: ["mapa"], dicas: ["dicas"] };
function fugaPorQueVazio() {
  const S = fugaS;
  if (!S) return null;
  let F = S.fontes;
  if (!F) { try { F = fugaFontesTodas(S.rnd || Math.random); } catch (e) { F = {}; } }
  const ativas = fugaPref().fontes;
  const atual = S.amplo ? "" : fugaNorm(S.disc);
  const discs = S.amplo ? new Set() : (F.discs || new Set());
  const vistos = new Set(S.vistos || []);
  const d = { tudo: 0, desligadas: [], nDesligadas: 0, atual: 0, edital: 0, discsFora: [], vistos: 0, sobra: 0 };
  Object.keys(FUGA_FONTE_LISTAS).forEach((k) => {
    const itens = [].concat(...FUGA_FONTE_LISTAS[k].map((c) => F[c] || []));
    d.tudo += itens.length;
    if (!itens.length) return;
    if (ativas[k] === false) { d.desligadas.push(k); d.nDesligadas += itens.length; return; }
    itens.forEach((x) => {
      const dn = fugaNorm(x.disciplina);
      if (atual && dn && dn === atual) d.atual++;
      else if (discs.size && dn && !discs.has(dn)) { d.edital++; if (d.discsFora.indexOf(x.disciplina) < 0) d.discsFora.push(x.disciplina); }
      else if (vistos.has(fugaChave(x))) d.vistos++;
      else d.sobra++;
    });
  });
  return d;
}
/* o bloco do "por quê": uma linha por corte, com a saída de cada um */
function fugaPorQueEl(d) {
  const S = fugaS || {};
  const box = fugaEl("div", "fuga-vazio");
  box.id = "fugaPorQue";
  if (!d || !d.tudo) { box.append(fugaEl("p", "nota", t("fuga_vazia"))); return box; }
  const lin = (txt) => box.append(fugaEl("p", "fuga-vazio-lin", txt));
  if (d.atual) lin(t("fuga_vz_atual", { n: d.atual, d: S.disc }));
  if (d.edital) lin(t("fuga_vz_edital", { n: d.edital, l: d.discsFora.slice(0, 3).join(", ") + (d.discsFora.length > 3 ? "…" : "") }));
  if (d.desligadas.length) lin(t("fuga_vz_desligadas", { n: d.nDesligadas, l: d.desligadas.map((k) => t("fuga_f_" + k)).join(", ") }));
  if (d.vistos) lin(t("fuga_vz_vistos", { n: d.vistos }));
  const ac = fugaEl("div", "fuga-acoes");
  if (d.atual || d.edital) ac.append(fugaBt(t("fuga_vz_ampliar"), () => fugaAmpliar(), "btn-min-ok", "btnFugaAmpliar", t("fuga_vz_ampliar_tip")));
  if (d.desligadas.length) ac.append(fugaBt(t("fuga_vz_fontes"), () => fugaPainel("fugaOpcoes"), "", "btnFugaVzFontes", t("fuga_vz_fontes_tip")));
  if (d.atual || d.edital || d.desligadas.length) box.append(ac);
  return box;
}
/* amplia o escopo nesta fuga (a disciplina de agora e as fora dos editais entram) e tenta de novo */
function fugaAmpliar() {
  if (!fugaS) return null;
  fugaS.amplo = true;
  try { reg("ESTUDO", "fuga rápida: escopo ampliado", fugaS.disc || "—"); } catch (e) {}
  return fugaNovaRodada();
}
/* "outros 5": no meio da rodada, o que ficou sem resposta não conta; a corrente segue */
function fugaOutros() {
  if (!fugaS) return fugaAbrir();
  try { reg("ESTUDO", "fuga rápida: outros 5", "rodada " + (fugaS.rodada + 1)); } catch (e) {}
  return fugaNovaRodada();
}
function fugaItemAtual() { return fugaS && fugaS.fase === "item" ? fugaS.itens[fugaS.i] || null : null; }
function fugaVirar() {
  if (!fugaItemAtual() || fugaItemAtual().tipo === "questao") return false;
  fugaS.revelado = true;
  fugaPintar();
  return true;
}
/* sabia / não sabia (a questão responde pela alternativa: fugaResponderQuestao) */
function fugaResponder(sabia, lido) {
  const x = fugaItemAtual();
  if (!x) return false;
  if (!fugaS.respostas.some((r) => r.item === x)) fugaS.respostas.push(Object.assign({ item: x, sabia: !!sabia, rodada: fugaS.rodada }, lido ? { lido: true } : {}));
  return fugaProximo();
}
function fugaResponderQuestao(letra) {
  const x = fugaItemAtual();
  if (!x || x.tipo !== "questao" || fugaS.revelado) return false;
  const gab = String(x.q.gabarito || "").trim().toUpperCase();
  const certo = String(letra || "").toUpperCase() === gab;
  fugaS.revelado = true;
  x.escolha = String(letra || "").toUpperCase();
  /* (19.186.0) no histórico da questão, como qualquer resposta (o caderno decide se ela já está dominada) */
  x.gravada = false;
  try { if (typeof qsTentativaAvulsa === "function") x.gravada = !!qsTentativaAvulsa(x.q.id, x.escolha, "fuga"); } catch (e) { x.gravada = false; }
  fugaS.respostas.push({ item: x, sabia: certo, rodada: fugaS.rodada });
  fugaPintar();
  return certo;
}
function fugaRespondido(x) { return !!(fugaS && fugaS.respostas.some((r) => r.item === x)); }
function fugaRespostaDe(x) { return (fugaS && fugaS.respostas.find((r) => r.item === x)) || null; }
/* (19.188.0) IR A QUALQUER ITEM DA RODADA (as bolinhas, ‹ ›, as setas): o ainda sem resposta abre para responder; o já
 * respondido abre para REVER — virado, com o que você marcou, sem pedir a resposta de novo. Vale também do fim da rodada. */
function fugaIr(k) {
  if (!fugaS || (fugaS.fase !== "item" && fugaS.fase !== "fimRodada") || !fugaS.itens[k]) return false;
  fugaS.fase = "item";
  fugaS.i = k;
  fugaS.revelado = fugaRespondido(fugaS.itens[k]);
  fugaPintar();
  return true;
}
/* ‹ › : o vizinho, respondido ou não; depois do último, o fim da rodada (se não falta nenhum) */
function fugaNav(d) {
  if (!fugaS || !fugaS.itens.length) return false;
  const n = fugaS.itens.length;
  const de = fugaS.fase === "fimRodada" ? n : fugaS.i;
  const k = de + d;
  if (k < 0) return false;
  if (k >= n) {
    if (fugaS.itens.every(fugaRespondido)) { fugaS.fase = "fimRodada"; fugaS.i = n; fugaPintar(); return true; }
    const falta = fugaS.itens.findIndex((x) => !fugaRespondido(x));
    return falta >= 0 ? fugaIr(falta) : false;
  }
  return fugaIr(k);
}
function fugaProximo() {
  if (!fugaS) return false;
  const n = fugaS.itens.length;
  /* o que se deixa sem resposta ("próximo" sem responder) fica para trás: a rodada acaba quando todos foram respondidos
   * ou passados — e a bolinha dele continua tocável enquanto a rodada está aberta */
  fugaS.passados = fugaS.passados || {};
  fugaS.passados[fugaS.i] = true;
  let prox = -1;
  for (let d = 1; d <= n; d++) { const k = (fugaS.i + d) % n; if (!fugaRespondido(fugaS.itens[k]) && !fugaS.passados[k]) { prox = k; break; } }
  fugaS.revelado = false;
  fugaS.i = prox >= 0 ? prox : n;
  if (prox < 0) {
    fugaS.fase = "fimRodada";
    const da = fugaS.respostas.filter((r) => r.rodada === fugaS.rodada);
    const c = fugaContas(da);
    try { reg("ESTUDO", "fuga rápida: rodada " + fugaS.rodada, c.s + " sabia · " + c.n + " não sabia · " + c.l + " lido(s)"); } catch (e) {}
  }
  fugaPintar();
  return true;
}
/* a linha do registro do fim (uma vez por fuga, por qualquer caminho) */
/* A NOTA DO CARTÃO (1 de novo · 2 difícil · 3 bom · 4 fácil), como no estudo: vale na agenda e no livro de fatos */
function fugaNotaCartao(nota) {
  const x = fugaItemAtual();
  if (!x || x.tipo !== "cartao" || !x.uid || !fugaS.revelado || typeof agdResponder !== "function") return false;
  try { if (typeof estcCarregarAgenda === "function") estcCarregarAgenda(); } catch (e) {}
  const agora = Date.now();
  const antes = estcRegs[x.uid];
  estcRegs[x.uid] = agdResponder(antes, nota, agora);
  try { if (typeof estcSalvarAgenda === "function") estcSalvarAgenda(); } catch (e) {}
  try {
    if (typeof fatoGravar === "function" && typeof fatoDeCartao === "function") {
      const n = x.nota || {};
      const f = fatoDeCartao({ id: x.uid, nota: n, cn: x.cn }, nota, agora, { chave: n.chave || "", disciplina: n.disciplina, topico: n.topico, antes: antes || null });
      if (f) fatoGravar(f);
    }
  } catch (e) {}
  x.notado = nota;
  x.enviado = true;
  try { reg("ESTUDO", "fuga rápida: cartão revisado", "nota " + nota + " · " + String(x.frente || "").slice(0, 50)); } catch (e) {}
  fugaS.respostas.push({ item: x, sabia: nota >= 2, nota, rodada: fugaS.rodada });
  return fugaProximo();
}
/* a múltipla escolha do cartão: a escolha revela (e sugere a nota) */
function fugaEscolherOpcao(i) {
  const x = fugaItemAtual();
  if (!x || fugaS.revelado) return false;
  x.escEst = i;
  fugaS.revelado = true;
  fugaPintar();
  return true;
}
function fugaRegistrarFim(como) {
  if (!fugaS || fugaS.registrado) return false;
  fugaS.registrado = true;
  const s = fugaS.respostas;
  try { reg("ESTUDO", "fuga rápida encerrada", fugaS.rodada + " rodada(s) · " + s.length + " item(ns) · " + fugaContas(s).s + " sabia · " + fugaContas(s).n + " não sabia" + (como ? " · " + como : "")); } catch (e) {}
  return true;
}
function fugaTerminar() {
  if (!fugaS) return false;
  fugaS.fase = "resumo";
  fugaRegistrarFim("");
  fugaPintar();
  return true;
}
/* a janela fechou (Esc, "voltar ao estudo"): o relógio para e o registro anota o que foi feito */
function fugaAoFechar() {
  try { if (fugaRelogio) clearInterval(fugaRelogio); } catch (e) {}
  fugaRelogio = null;
  if (fugaS && fugaS.respostas.length) fugaRegistrarFim("fechada");
}
function fugaRelogioAtivo() { return !!fugaRelogio; }
/* os cartões que você não sabia vão para "De novo" na agenda dos cartões (a única gravação da fuga, e só a pedido) */
function fugaMandarRevisao() {
  if (!fugaS) return 0;
  const cards = fugaS.respostas.filter((r) => !r.sabia && r.item.tipo === "cartao" && r.item.uid && !r.item.enviado);
  if (!cards.length || typeof agdResponder !== "function") return 0;
  try { if (typeof estcCarregarAgenda === "function") estcCarregarAgenda(); } catch (e) {}
  const agora = Date.now();
  cards.forEach((r) => {
    estcRegs[r.item.uid] = agdResponder(estcRegs[r.item.uid], 1, agora);
    r.item.enviado = true;
  });
  try { if (typeof estcSalvarAgenda === "function") estcSalvarAgenda(); } catch (e) {}
  try { reg("ESTUDO", "fuga rápida: cartões para 'De novo'", cards.length + " cartão(ões)"); } catch (e) {}
  fugaPintar();
  return cards.length;
}
function fugaFechar() {
  fugaAoFechar();
  const d = typeof document !== "undefined" ? document.getElementById("dlgFuga") : null;
  if (d && d.open && d.close) d.close();
}
function fugaTique() {
  const el = typeof document !== "undefined" ? document.getElementById("fugaRelogio") : null;
  const s = Math.max(0, Math.round((fugaFim - Date.now()) / 1000));
  if (el) {
    el.textContent = s ? t("fuga_relogio", { m: Math.floor(s / 60), s: String(s % 60).padStart(2, "0") }) : t("fuga_acabou");
    if (el.classList) el.classList.toggle("fuga-acabou", !s);
  }
  const tr = typeof document !== "undefined" ? document.getElementById("fugaTrilho") : null;
  const total = ((fugaS && fugaS.min) || 3) * 60;
  if (tr && tr.style) tr.style.width = Math.round((s / total) * 100) + "%";
  if (!s && fugaRelogio) { try { clearInterval(fugaRelogio); } catch (e) {} fugaRelogio = null; }
  return s;
}

/* ---------------- a janela ---------------- */
function fugaEl(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function fugaBt(rot, fn, cls, id, tip) { const b = fugaEl("button", "btn-min" + (cls ? " " + cls : ""), rot); b.type = "button"; if (id) b.id = id; if (tip) b.title = tip; b.onclick = fn; return b; }
function fugaRotuloTipo(x) { return t("fuga_tipo_" + x.tipo); }
/* as contas de uma lista de respostas: o que é só de ler ("lido") não entra em sabia/não sabia */
function fugaContas(rs) {
  return { s: rs.filter((r) => r.sabia && !r.lido).length, n: rs.filter((r) => !r.sabia && !r.lido).length, l: rs.filter((r) => r.lido).length };
}
function fugaOrigem(x) {
  if (x.tipo === "prazo" || x.tipo === "artigo") return [x.lei, x.rotulo].filter(Boolean).join(", ");
  return [x.disciplina, x.topico].filter(Boolean).join(" › ") + (x.origem ? " · " + x.origem : "");
}
/* curto, no cabeçalho do item: o tópico (a origem inteira vai no balão). A marca e a dica têm o bloco "de onde saiu"
 * embaixo do texto, com tudo: no cabeçalho, nada (repetir o tópico só disputava espaço) */
function fugaOrigemCurta(x) {
  if (x.tipo === "artigo") return x.leiCurta || x.lei || "";
  if (x.tipo === "prazo") return x.rotulo || x.lei || "";
  if (fugaTemFonte(x)) return "";
  return x.topico || x.disciplina || x.origem || "";
}
/* =====================================================================
 * (19.194.0) DE ONDE SAIU A PEGADINHA
 * A pegadinha (e o "importante", e a dica) aparecia só com o tópico no canto: sem o edital, sem a disciplina, sem
 * jeito de ver o trecho no lugar dele. Agora, embaixo do texto: o edital em andamento que cobra o tópico, "disciplina
 * › tópico", a lei e o artigo (quando a marca é da lei), e "ver no resumo" / "ver na lei", que abre a fonte por cima
 * da fuga e pisca no trecho — como "abrir na lei" faz com o artigo.
 * ===================================================================== */
function fugaTemFonte(x) { return !!x && (x.tipo === "pegadinha" || x.tipo === "importante" || x.tipo === "dica"); }
/* o nome do edital em andamento que cobra o tópico ("" sem edital) */
function fugaEditalNome(disciplina, topico) {
  try {
    if (!disciplina || !topico || typeof lvEditalDoTopico !== "function") return "";
    const id = lvEditalDoTopico(disciplina, topico);
    if (!id) return "";
    const e = (typeof editais !== "undefined" ? editais : []).find((y) => String(y.id) === String(id));
    return e ? String(e.nome || "").trim() : "";
  } catch (e) { return ""; }
}
function fugaFonteEl(x) {
  const o = fugaEl("div", "fuga-origem fuga-fonte");
  o.id = "fugaFonte";
  const linha = fugaEl("div", "fuga-fonte-onde");
  linha.id = "fugaFonteOnde";
  let partes = 0;
  const ed = fugaEditalNome(x.disciplina, x.topico);
  if (ed) { const e = fugaEl("span", "fuga-fonte-ed", "📋 " + ed); e.title = t("fuga_fonte_ed_tip"); linha.append(e); partes++; }
  const dt = [x.disciplina, x.topico].filter(Boolean).join(" › ");
  if (dt) { linha.append(fugaEl("span", "fuga-fonte-top", dt)); partes++; }
  const w = x.onde || {};
  if (w.leiId) {
    let nome = x.origem || "";
    try { const l = typeof leiDe === "function" ? leiDe(w.leiId) : null; if (l) nome = fugaLeiRotulo(l) || nome; } catch (e) {}
    linha.append(fugaEl("span", "fuga-fonte-lei", "⚖ " + [nome, w.rotulo].filter(Boolean).join(", ")));
    partes++;
  } else if (x.origem) { linha.append(fugaEl("span", "fuga-fonte-lei", x.origem)); partes++; }
  if (!partes) linha.append(fugaEl("span", "fuga-fonte-top", t("fuga_fonte_sem")));
  o.append(linha);
  const b = fugaFonteBotao(x);
  if (b) o.append(b);
  return o;
}
function fugaFonteBotao(x) {
  const w = (x && x.onde) || {};
  if (w.leiId && typeof leiAbrir === "function") return fugaBt(t("fuga_ver_lei"), () => fugaAbrirFonte(x), "", "btnFugaFonte", t("fuga_ver_lei_tip"));
  if (w.resumo && typeof matAbrirEditor === "function") return fugaBt(t("fuga_ver_resumo"), () => fugaAbrirFonte(x), "", "btnFugaFonte", t("fuga_ver_resumo_tip"));
  return null;
}
/* pisca a marca (<mark>) cujo texto começa como o da pegadinha; devolve se achou */
function fugaPiscarMarca(caixa, texto) {
  const so = (v) => fugaNorm(v).replace(/\s+/g, " ");
  const alvo = so(texto).slice(0, 30);
  if (!caixa || !caixa.querySelectorAll || alvo.length < 8) return false;
  const nos = caixa.querySelectorAll("mark");
  for (let i = 0; i < nos.length; i++) {
    if (so(nos[i].textContent).indexOf(alvo) < 0) continue;
    const el = nos[i];
    try { el.scrollIntoView({ block: "center" }); } catch (e) {}
    if (el.classList) el.classList.add("mat-piscando");
    setTimeout(() => { try { el.classList.remove("mat-piscando"); } catch (e) {} }, 2400);
    return true;
  }
  return false;
}
/* abre a fonte (o resumo na leitura, ou a lei no artigo) por cima da fuga e destaca o trecho */
function fugaAbrirFonte(x) {
  const w = (x && x.onde) || {};
  let achou = false;
  if (w.leiId) {
    const tp = fugaTopicoDaLei({ leiId: w.leiId, disciplina: x.disciplina, topico: x.topico });
    if (w.num && typeof leiAbrirNoArtigo === "function") leiAbrirNoArtigo(tp.disciplina, tp.topico, w.leiId, w.num);
    else {
      leiAbrir(tp.disciplina, tp.topico, w.leiId, { semRetomar: true });
      try { if (typeof leiModo !== "undefined" && leiModo !== "ler") leiTrocarModo("ler"); } catch (e) {}
    }
    /* depois do salto ao artigo, a própria marca; a lei grande entra na tela aos pedaços: tenta de novo */
    const tentar = (k) => {
      if (fugaPiscarMarca(typeof document !== "undefined" ? document.getElementById("leiLeitura") : null, x.texto)) { achou = true; return; }
      if (k < 3) setTimeout(() => tentar(k + 1), 500);
    };
    setTimeout(() => tentar(0), 450);
  } else if (w.resumo && typeof matAbrirEditor === "function") {
    const tp = fugaDoTopico(w.resumo);
    matAbrirEditor({ disciplina: x.disciplina || tp.disciplina, nome: x.topico || tp.topico, chave: w.resumo }, "ler");
    try { achou = typeof matIrPara === "function" ? !!matIrPara(x.texto, "texto") : false; } catch (e) { achou = false; }
  } else return false;
  try { if (typeof reg === "function") reg("FUGA", achou ? "fonte da marca aberta no trecho" : "fonte da marca aberta", String(x.texto || "").slice(0, 50)); } catch (e) {}
  return true;
}
/* ⓘ e ⚙: um painel aberto por vez, logo abaixo do topo */
function fugaPainel(qual) {
  if (typeof document === "undefined") return "";
  [["fugaComo", "btnFugaComo"], ["fugaOpcoes", "btnFugaOpcoes"]].forEach(([id, bt]) => {
    const el = document.getElementById(id), b = document.getElementById(bt);
    const abre = id === qual && el && el.hidden !== false;
    if (el) el.hidden = !abre;
    if (b && b.setAttribute) b.setAttribute("aria-expanded", abre ? "true" : "false");
    if (b && b.classList) b.classList.toggle("fuga-redondo-on", !!abre);
  });
  return qual;
}
/* AS BOLINHAS DA RODADA: dizem que há outros itens sem uma palavra. A atual em destaque; as respondidas com a cor do
 * resultado; tocar numa ainda sem resposta leva a ela. */
function fugaPassosEl(S) {
  const f = fugaEl("div", "fuga-passos");
  f.id = "fugaPassos";
  const rot = fugaEl("span", "fuga-rodada", t("fuga_rodada", { r: S.rodada }));
  rot.title = t("fuga_rodada_tip", { r: S.rodada, n: S.itens.length });
  f.append(rot);
  const nav = (d, txt, id, tip) => { const b = fugaBt(txt, () => fugaNav(d), "fuga-nav", id, tip); return b; };
  const ant = nav(-1, "‹", "btnFugaAnt", t("fuga_ant_tip"));
  ant.disabled = S.fase === "item" && S.i <= 0;
  f.append(ant);
  S.itens.forEach((x, k) => {
    const r = S.respostas.find((y) => y.item === x);
    const est = r ? (r.lido ? " fuga-passo-lido" : r.sabia ? " fuga-passo-ok" : " fuga-passo-erro") : "";
    const b = fugaEl("button", "fuga-passo" + est + (k === S.i && S.fase === "item" ? " fuga-passo-atual" : ""), FUGA_ICO[x.tipo] || "•");
    b.type = "button";
    b.id = "btnFugaPasso_" + k;
    /* a marca no canto: dá para ver de longe o que já foi feito, e como */
    /* (19.194.0) o "lido" é feito: ✓ verde como o "sabia" (era um "·" apagado, que parecia não ter contado) */
    if (r) b.append(fugaEl("span", "fuga-passo-marca", r.lido || r.sabia ? "✓" : "✗"));
    const estado = r ? t(r.lido ? "fuga_passo_lido" : r.sabia ? "fuga_passo_sabia" : "fuga_passo_nao") : t("fuga_passo_falta");
    b.title = t("fuga_passo_tip", { k: k + 1, n: S.itens.length, t: fugaRotuloTipo(x), o: fugaOrigem(x) }) + " · " + estado;
    if (b.setAttribute) b.setAttribute("aria-label", b.title);
    b.onclick = () => fugaIr(k);
    f.append(b);
  });
  f.append(nav(1, "›", "btnFugaSeg", t("fuga_seg_tip")));
  return f;
}
/* O CARTÃO DO ESTUDO: o mesmo desenho e os mesmos recursos (est-* de estudo-cartoes.js) */
function fugaPintarCartao(box, x, S) {
  const n = x.nota, c = (n && n.card) || {};
  const cx = fugaEl("div", "est-cartao fuga-cartao");
  cx.id = "fugaItem_" + S.i;
  cx.append(fugaEl("div", "est-cab", (c.titulo || "").trim() || n.topico || n.disciplina || ""));
  let reg = null;
  try { reg = typeof estcLerJSON === "function" ? (estcLerJSON(ESTC_CH_REGS, {})[x.uid] || null) : null; } catch (e) { reg = null; }
  if (reg && typeof ESTC_LEECH_LIMIAR !== "undefined" && (reg.l || 0) >= ESTC_LEECH_LIMIAR) cx.append(fugaEl("div", "est-leech", t("est_leech", { n: reg.l })));
  try { const pr = typeof mmCartaoProblemas === "function" ? mmCartaoProblemas(n) : []; if (pr.length) cx.append(mmCartaoAvisoEl(pr, S.revelado, n)); } catch (e) {}
  const txt = (s0) => (typeof estcTxt === "function" ? estcTxt(s0) : String(s0 || ""));
  const frente = fugaEl("div", "est-frente");
  if (c.kind === "mc") {
    frente.append(fugaEl("div", "est-txt", txt(c.front)));
    const ops = fugaEl("div", "est-ops");
    (c.options || []).forEach((o, i) => {
      const certa = i === c.correct;
      const b = fugaEl("button", "est-op" + (S.revelado && certa ? " est-op-ok" : "") + (S.revelado && x.escEst === i && !certa ? " est-op-erro" : ""));
      b.type = "button";
      b.id = "btnFugaOp_" + i;
      b.append(fugaEl("span", "est-op-l", typeof letra === "function" ? letra(i) : String.fromCharCode(65 + i)), fugaEl("span", "est-op-t", txt(o)));
      b.disabled = S.revelado;
      b.onclick = () => fugaEscolherOpcao(i);
      ops.append(b);
    });
    frente.append(ops);
  } else if (x.cn && typeof estcClozeNos === "function") {
    const tx = fugaEl("div", "est-txt");
    estcClozeNos(tx, c.front, x.cn, S.revelado);
    frente.append(tx);
  } else {
    frente.append(fugaEl("div", "est-txt", txt(c.front)));
  }
  frente.id = "fugaFrente";
  cx.append(frente);
  if (typeof matTexDesenharEm === "function") { try { matTexDesenharEm(frente); } catch (e) {} }
  if (S.revelado) {
    const verso = fugaEl("div", "est-verso");
    verso.id = "fugaVerso";
    if (c.kind !== "mc" && !x.cn && c.back) verso.append(fugaEl("div", "est-hr"), fugaEl("div", "est-txt est-resp", txt(c.back)));
    else if (c.back) verso.append(fugaEl("div", "est-just", txt(c.back)));
    cx.append(verso);
    if (typeof matTexDesenharEm === "function") { try { matTexDesenharEm(verso); } catch (e) {} }
    let corpo = null;
    if (c.more) {
      const sb = fugaEl("button", "est-saiba-b", "✚ " + t("est_saiba"));
      sb.type = "button";
      sb.id = "btnFugaSaiba";
      corpo = fugaEl("div", "est-saiba");
      if (typeof estcSaibaMais === "function") estcSaibaMais(corpo, c.more); else corpo.textContent = txt(c.more);
      if (typeof matTexDesenharEm === "function") { try { matTexDesenharEm(corpo); } catch (e) {} }
      corpo.hidden = true;
      sb.onclick = () => { corpo.hidden = !corpo.hidden; };
      cx.append(sb, corpo);
    }
    /* as citações da resposta e do "saiba mais" (a frente da lacuna também: o texto em volta já estava à vista) */
    try {
      const base = typeof estcCitBase === "function" ? estcCitBase(n) : { disciplina: n.disciplina, topico: n.topico, onde: "cartao" };
      if (typeof citLigarEm === "function") {
        if (x.cn) citLigarEm(frente, base);
        citLigarEm(verso, base);
        if (corpo) citLigarEm(corpo, base);
      }
    } catch (e) {}
  }
  box.append(cx);
  /* a parte de baixo: virar, ou as quatro notas com o intervalo de cada uma */
  const acoes = fugaEl("div", "fuga-acoes");
  if (!S.revelado) {
    if (c.kind !== "mc") acoes.append(fugaBt(t("fuga_virar"), () => fugaVirar(), "btn-min-ok", "btnFugaVirar", t("fuga_virar_tip")));
    box.append(acoes);
    return;
  }
  const resp = fugaRespostaDe(x);
  if (resp) {
    box.append(fugaFeitoEl(resp, x));
    return;
  }
  const notas = fugaEl("div", "est-notas fuga-notas");
  let prev = [];
  try { prev = typeof agdPrevisao === "function" ? agdPrevisao(reg, Date.now()) : []; } catch (e) { prev = []; }
  const sug = c.kind === "mc" && x.escEst != null ? (x.escEst === c.correct ? 3 : 1) : 0;
  [1, 2, 3, 4].forEach((k, i) => {
    const b = fugaEl("button", "est-nota est-nota-" + k + (sug === k ? " est-nota-sug" : ""));
    b.type = "button";
    b.id = "btnFugaNota" + k;
    if (prev[i] != null && typeof agdFormatar === "function" && typeof estcUnidadesTxt === "function") b.append(fugaEl("span", "est-nota-t", agdFormatar(prev[i], estcUnidadesTxt())));
    b.append(fugaEl("span", "est-nota-r", t("est_nota" + k)));
    b.title = t("fuga_nota_tip", { k });
    b.onclick = () => fugaNotaCartao(k);
    notas.append(b);
  });
  box.append(notas);
}
/* as citações de lei ficam clicáveis (a prévia do artigo), como no resumo */
function fugaLigarCitas(el, x) {
  try { if (typeof citLigarEm === "function") citLigarEm(el, { disciplina: x.disciplina || "", topico: x.topico || "", onde: "resumo" }); } catch (e) {}
}
/* os chips "o que entra" e a duração */
function fugaChipsPintar() {
  const cx = typeof document !== "undefined" ? document.getElementById("fugaChips") : null;
  if (!cx) return;
  cx.innerHTML = "";
  const p = fugaPref();
  const F = fugaS && fugaS.fontes;
  Object.keys(FUGA_FONTES).forEach((k) => {
    const n = F ? FUGA_FONTES[k].reduce((s, tp) => s + ((F[{ cartao: "cartoes", questao: "questoes", artigo: "artigos", prazo: "prazos", julgado: "julgados", marca: "marcas", mapa: "mapa", dica: "dicas" }[tp]] || []).length), 0) : null;
    const b = fugaBt(t("fuga_f_" + k) + (n != null ? " (" + n + ")" : ""), () => {
      fugaPrefDefinir({ fontes: { [k]: !fugaPref().fontes[k] } }); fugaChipsPintar();
      /* (19.194.0) com a fuga vazia, ligar uma fonte já sorteia */
      if (fugaS && fugaS.fase === "vazio") fugaNovaRodada();
    },
      "fuga-chip" + (p.fontes[k] ? " fuga-chip-on" : ""), "btnFugaF_" + k, t("fuga_f_tip"));
    b.setAttribute && b.setAttribute("aria-pressed", p.fontes[k] ? "true" : "false");
    cx.append(b);
  });
  const sep = fugaEl("span", "fuga-chip-sep", "·");
  cx.append(sep);
  [3, 5].forEach((m) => {
    const b = fugaBt(t("fuga_min", { m }), () => { fugaPrefDefinir({ min: m }); if (fugaS) { fugaS.min = m; fugaFim = Date.now() + m * 60 * 1000; fugaTique(); try { if (!fugaRelogio) fugaRelogio = setInterval(fugaTique, 1000); } catch (e) {} } fugaChipsPintar(); },
      "fuga-chip" + (p.min === m ? " fuga-chip-on" : ""), "btnFugaMin_" + m, t("fuga_min_tip"));
    cx.append(b);
  });
}
/* (19.189.0) O QUE A FUGA REGISTROU: as notas de cartão (agenda), as respostas de questão (histórico) e os cartões
 * mandados para "De novo". Ler, virar e "sabia/não sabia" dos outros itens não gravam nada — e a linha diz isso. */
function fugaRegistrado() {
  const rs = (fugaS && fugaS.respostas) || [];
  return {
    cartoes: rs.filter((r) => r.nota || (r.item && r.item.tipo === "cartao" && r.item.enviado)).length,
    questoes: rs.filter((r) => r.item && r.item.tipo === "questao" && r.item.gravada).length,
  };
}
function fugaRegistroPintar() {
  const el = typeof document !== "undefined" ? document.getElementById("fugaRegistro") : null;
  if (!el) return null;
  const g = fugaRegistrado();
  const partes = [];
  if (g.cartoes) partes.push(t("fuga_reg_cartoes", { n: g.cartoes }));
  if (g.questoes) partes.push(t("fuga_reg_questoes", { n: g.questoes }));
  el.textContent = partes.length ? t("fuga_reg_sim", { o: partes.join(" · ") }) : t("fuga_reg_nada");
  el.title = t("fuga_reg_tip");
  if (el.classList) el.classList.toggle("fuga-registro-sim", partes.length > 0);
  return g;
}
function fugaPintar(resLegado) {
  const box = typeof document !== "undefined" ? document.getElementById("fugaLista") : null;
  if (!box) return;
  /* compatível: fugaPintar({ itens }) pinta uma rodada pronta (o sorteio de fora) */
  if (resLegado && resLegado.itens) {
    fugaS = Object.assign(fugaS || { fontes: null, inicio: 0, respostas: [], vistos: [], min: fugaPref().min, rnd: Math.random }, { rodada: 1, itens: resLegado.itens, i: 0, revelado: false,
      fase: resLegado.itens.length ? "item" : "vazio", disc: resLegado.disc || "" });
  }
  box.innerHTML = "";
  const S = fugaS || { fase: "vazio", itens: [], respostas: [] };
  fugaRegistroPintar();
  const outros = document.getElementById("btnFugaOutros");
  if (outros) outros.textContent = t(S.fase === "resumo" ? "fuga_outros_mais" : "fuga_outros");
  if (outros) outros.disabled = S.fase === "vazio";
  if (S.fase === "vazio") {
    /* (19.194.0) o vazio diz POR QUE: sem material nenhum, de onde ele vem; com material fora do escopo, o corte e a saída */
    const d = fugaPorQueVazio();
    const p = fugaEl("p", "fuga-vazio-tit", t(d && d.tudo ? "fuga_vz_tit" : "fuga_vz_tit_nada"));
    p.id = "fugaVazia";
    box.append(p);
    box.append(fugaPorQueEl(d));
    return;
  }
  if (S.fase === "fimRodada") { box.append(fugaPassosEl(S)); return fugaPintarFimRodada(box, S); }
  if (S.fase === "resumo") return fugaPintarResumo(box, S);
  const x = S.itens[S.i];
  if (!x) return;
  box.append(fugaPassosEl(S));
  /* o cartão de verdade (com a nota da biblioteca): o desenho do estudo */
  if (x.tipo === "cartao" && x.nota && x.nota.card && x.uid) return fugaPintarCartao(box, x, S);
  const c = fugaEl("div", "fuga-item fuga-" + x.tipo);
  c.id = "fugaItem_" + S.i;
  const cab = fugaEl("div", "fuga-cab");
  cab.append(fugaEl("span", "fuga-cab-tipo", (FUGA_ICO[x.tipo] || "•") + " " + fugaRotuloTipo(x)));
  const orig = fugaEl("span", "fuga-cab-orig", fugaOrigemCurta(x));
  orig.title = fugaOrigem(x);
  cab.append(orig);
  c.append(cab);
  const frente = fugaEl("div", "fuga-txt", x.tipo === "pegadinha" || x.tipo === "importante" || x.tipo === "dica" || x.tipo === "prazo" ? (x.tipo === "prazo" ? x.rotulo + " — " + t("fuga_prazo_q") : x.texto) : x.frente);
  frente.id = "fugaFrente";
  if (x.tipo !== "artigo" && x.tipo !== "prazo") fugaLigarCitas(frente, x);
  c.append(frente);
  if (x.motivoImp) { const mi = fugaEl("div", "fuga-imp", "★ " + x.motivoImp); mi.id = "fugaImp"; c.append(mi); }
  if (x.motivo) c.append(fugaEl("div", "nota fuga-motivo", x.motivo));
  if (fugaTemFonte(x)) c.append(fugaFonteEl(x));
  /* (19.188.0) DE ONDE SAIU: o trecho da questão que cita o artigo; quando a questão não escreve a lei, o aviso de que
   * ela foi deduzida — e "ver a questão" leva lá, onde o link da citação deixa trocar a lei ou fixar a certa (🔗) */
  if (x.tipo === "artigo" && x.fonte) {
    const o = fugaEl("div", "fuga-origem");
    o.id = "fugaOrigem";
    if (x.fonte.trecho) o.append(fugaEl("div", "fuga-origem-txt", "“" + x.fonte.trecho + "”"));
    /* POR QUE ESTA LEI — sempre dito: a questão escreve a lei, o vínculo é seu, a lei citada altera esta, ou (o caso que
     * pede atenção) a questão NÃO diz a lei e o app a supôs pelo tópico ou pela lei citada antes no parágrafo */
    const como = x.fonte.como || "nomeada";
    const suposta = como === "topico" || como === "deduzida";
    const tpQ = (x.fonte.q && x.fonte.q.topico) || x.topico || "";
    const av = fugaEl("div", "fuga-origem-aviso" + (suposta ? "" : " fuga-origem-ok"),
      t("fuga_lei_por_" + (["topico", "deduzida", "nomeada", "vinculo", "alteradora"].indexOf(como) >= 0 ? como : "nomeada"),
        { l: x.leiCurta || x.lei, a: x.rotulo, tp: tpQ, c: x.fonte.citado || x.rotulo }));
    av.id = "fugaOrigemAviso";
    o.append(av);
    if (x.fonte.q && typeof qsUiResponderAbrir === "function") {
      o.append(fugaBt(t("fuga_ver_questao"), () => qsUiResponderAbrir([x.fonte.q], "aba", "fuga"), "", "btnFugaOrigemQ", t("fuga_ver_questao_tip")));
    }
    c.append(o);
  }
  const acoes = fugaEl("div", "fuga-acoes");
  if (x.tipo === "questao") {
    const q = x.q;
    if (q.tipo === "ce" || !(q.opcoes || []).length) {
      ["C", "E"].forEach((L) => acoes.append(fugaBt(t(L === "C" ? "fuga_q_certo" : "fuga_q_errado"), () => fugaResponderQuestao(L),
        S.revelado && x.escolha === L ? (x.escolha === String(q.gabarito).toUpperCase() ? "btn-min-ok" : "btn-min-perigo") : "", "btnFugaQ_" + L)));
    } else {
      const ops = fugaEl("div", "fuga-ops");
      (q.opcoes || []).forEach((op) => {
        const L = String(op.letra || "").toUpperCase();
        const cls = S.revelado ? (L === String(q.gabarito).toUpperCase() ? "btn-min-ok" : (x.escolha === L ? "btn-min-perigo" : "")) : "";
        const b = fugaBt(L + ") " + fugaLimpo(op.txt), () => fugaResponderQuestao(L), "fuga-op " + cls, "btnFugaQ_" + L);
        if (S.revelado) b.disabled = true;
        ops.append(b);
      });
      c.append(ops);
    }
    if (S.revelado) {
      const ultima = fugaRespostaDe(x);
      const fb = fugaEl("div", "fuga-verso " + (ultima && ultima.sabia ? "fuga-acertou" : "fuga-errou"),
        t(ultima && ultima.sabia ? "fuga_q_acertou" : "fuga_q_errou", { g: String(q.gabarito || "").toUpperCase() }));
      if (x.gravada) fb.append(fugaEl("div", "nota fuga-gravada", t("fuga_q_gravada")));
      c.append(fb);
      /* (19.194.0) o comentário INTEIRO e a SUA DICA, cada um com o seu título. Antes era "q.dica || q.comentario"
       * cortado em 700 caracteres: a questão com dica escondia o comentário, e o comentário longo saía pela metade.
       * O comentário sai como na tela da questão (formatado, com as citações de lei e julgado ligadas). */
      const base = (() => { try { return typeof qsUiCitBase === "function" ? qsUiCitBase(q) : null; } catch (e) { return null; } })();
      const ligar = (el) => {
        try { if (base && typeof citLigarEm === "function") { citLigarEm(el, base); return; } } catch (e) {}
        fugaLigarCitas(el, x);
      };
      if (String(q.comentario || "").trim()) {
        const sec = fugaEl("div", "fuga-q-sec");
        sec.id = "fugaQComent";
        sec.append(fugaEl("div", "fuga-q-sec-tit", t("qs_coment_tit")));
        const cm = fugaEl("div", "fuga-q-sec-txt");
        let feito = false;
        try { if (typeof qsUiComentario === "function") { qsUiComentario(cm, q); feito = !!String(cm.textContent || "").trim(); } } catch (e) { feito = false; }
        if (!feito) { cm.textContent = String(q.comentario); ligar(cm); }
        sec.append(cm);
        c.append(sec);
      }
      const minha = String(((typeof qsDicaDeQuestao === "function" && q.id) ? qsDicaDeQuestao(q.id) : "") || q.dica || "");
      if (minha.trim()) {
        const sec = fugaEl("div", "fuga-q-sec fuga-q-dica");
        sec.id = "fugaQDica";
        sec.append(fugaEl("div", "fuga-q-sec-tit", "💡 " + t("qs_dica_dobra")));
        const dc = fugaEl("div", "fuga-q-sec-txt qs-minha-dica");
        try { dc.innerHTML = typeof matParaHtml === "function" ? matParaHtml(minha) : ""; } catch (e) { dc.innerHTML = ""; }
        if (!String(dc.textContent || "").trim()) dc.textContent = minha;
        ligar(dc);
        sec.append(dc);
        c.append(sec);
      }
      acoes.innerHTML = "";
      acoes.append(fugaBt(t("fuga_proximo"), () => fugaSeguir(), "btn-min-ok", "btnFugaProx"));
    }
  } else if (fugaRespondido(x) && (x.tipo === "pegadinha" || x.tipo === "importante" || x.tipo === "dica")) {
    acoes.append(fugaFeitoEl(fugaRespostaDe(x), x));
  } else if (x.tipo === "pegadinha" || x.tipo === "importante" || x.tipo === "dica") {
    /* o que é só para ler: lido, segue */
    acoes.append(fugaBt(t("fuga_lido"), () => fugaResponder(true, true), "btn-min-ok", "btnFugaLido", t("fuga_lido_tip")));
  } else if (!S.revelado) {
    acoes.append(fugaBt(t("fuga_virar"), () => fugaVirar(), "btn-min-ok", "btnFugaVirar", t("fuga_virar_tip")));
  } else {
    const v = fugaEl("div", "fuga-verso", x.tipo === "prazo" ? x.texto : x.verso);
    v.id = "fugaVerso";
    fugaLigarCitas(v, x);
    c.append(v);
    if (fugaRespondido(x)) acoes.append(fugaFeitoEl(fugaRespostaDe(x), x));
    else {
      acoes.append(fugaBt(t("fuga_sabia"), () => fugaResponder(true), "btn-min-ok", "btnFugaSabia", t("fuga_sabia_tip")));
      acoes.append(fugaBt(t("fuga_nao_sabia"), () => fugaResponder(false), "btn-min-perigo", "btnFugaNaoSabia", t("fuga_nao_sabia_tip")));
    }
  }
  /* abrir no lugar dele (sem fechar a fuga: a janela abre por cima) */
  const ir = fugaIrBotao(x);
  if (ir && (S.revelado || x.tipo === "julgado" || x.tipo === "artigo")) acoes.append(ir);
  c.append(acoes);
  box.append(c);
}
/* (19.188.0) O QUE VOCÊ MARCOU neste item: "✓ sabia", "✗ não sabia", "✓ lido" ou a nota do cartão — e o próximo */
function fugaFeitoEl(resp, x) {
  const d = fugaEl("div", "fuga-feito " + (resp.lido ? "fuga-feito-lido" : resp.sabia ? "fuga-feito-ok" : "fuga-feito-erro"));
  d.id = "fugaFeito";
  const txt = resp.nota ? t("fuga_feito_nota", { n: t("est_nota" + resp.nota) }) : t(resp.lido ? "fuga_feito_lido" : resp.sabia ? "fuga_feito_sabia" : "fuga_feito_nao");
  d.append(fugaEl("span", "fuga-feito-txt", txt));
  d.append(fugaBt(t("fuga_proximo"), () => fugaSeguir(), "btn-min-ok", "btnFugaProx"));
  return d;
}
/* "próximo" depois de responder ou de rever: o próximo SEM resposta; sem nenhum, o fim da rodada */
function fugaSeguir() {
  if (!fugaS) return false;
  if (!fugaRespondido(fugaS.itens[fugaS.i])) return fugaProximo();
  const n = fugaS.itens.length;
  for (let d = 1; d <= n; d++) { const k = (fugaS.i + d) % n; if (!fugaRespondido(fugaS.itens[k])) return fugaIr(k); }
  fugaS.fase = "fimRodada"; fugaS.i = n; fugaPintar();
  return true;
}
/* o tópico para abrir a lei: o da questão de onde o artigo saiu (se a lei está ligada a ele), o do item, ou o primeiro
 * tópico a que a lei está ligada; sem nenhum, a lei abre solta (pela Biblioteca) */
function fugaTopicoDaLei(x) {
  const l = typeof leiDe === "function" ? leiDe(x.leiId) : null;
  const nada = { disciplina: "", topico: "" };
  if (!l || typeof matChave !== "function" || typeof leisDoTopico !== "function") return nada;
  const ligada = (d, tp) => !!(d && tp && leisDoTopico(matChave(d, tp)).some((y) => y.id === l.id));
  const q = x.fonte && x.fonte.q;
  if (q && ligada(q.disciplina, q.topico)) return { disciplina: q.disciplina, topico: q.topico };
  if (ligada(x.disciplina, x.topico)) return { disciplina: x.disciplina, topico: x.topico };
  for (const c of (l.topicos || [])) { const tp = fugaDoTopico(c); if (ligada(tp.disciplina, tp.topico)) return tp; }
  return nada;
}
function fugaIrBotao(x) {
  if ((x.tipo === "artigo" || x.tipo === "prazo") && x.leiId && typeof leiAbrirNoArtigo === "function") {
    /* (19.188.0) PELO TÓPICO, não solta: a leitura conta para ele e o leitor vem inteiro (consulta ao lado, leis do tópico) */
    return fugaBt(t("fuga_ir_lei"), () => { const tp = fugaTopicoDaLei(x); leiAbrirNoArtigo(tp.disciplina, tp.topico, x.leiId, x.num); }, "", "btnFugaIr");
  }
  if (x.tipo === "julgado" && typeof jurAbrir === "function" && x.disciplina && x.topico) {
    return fugaBt(t("fuga_ir_jur"), () => jurAbrir(x.disciplina, x.topico, "ler"), "", "btnFugaIr");
  }
  if (x.tipo === "questao" && typeof qsUiResponderAbrir === "function") {
    return fugaBt(t("fuga_ir_q"), () => qsUiResponderAbrir([x.q], "aba", "fuga"), "", "btnFugaIr");
  }
  return null;
}
/* o tipo que abre a próxima rodada (a corrente) */
function fugaProximoTipo() {
  if (!fugaS || !fugaS.fontes) return "";
  /* pergunta ao próprio sorteio (um item, sem tirar nada): o tipo vazio ou desligado é pulado, como na rodada de verdade */
  const r = fugaSortear({ disc: fugaS.disc, rnd: () => 0, fontes: fugaS.fontes, ativas: fugaPref().fontes, excluir: fugaS.vistos, vistos: [], inicio: fugaS.inicio, n: 1 });
  const x = r.itens[0];
  return x ? (x.tipo === "pegadinha" || x.tipo === "importante" ? "marca" : x.tipo) : "";
}
function fugaPintarFimRodada(box, S) {
  const da = S.respostas.filter((r) => r.rodada === S.rodada);
  const p = fugaEl("div", "fuga-fim");
  p.id = "fugaFimRodada";
  const cd = fugaContas(da);
  p.append(fugaEl("div", "fuga-fim-tit", t("fuga_fim_rodada", { r: S.rodada, f: da.length, tt: S.itens.length, s: cd.s, n: cd.n, l: cd.l })));

  const tp = fugaProximoTipo();
  p.append(fugaEl("p", "nota fuga-corrente", t("fuga_corrente", { t: tp ? (FUGA_ICO[tp === "marca" ? "pegadinha" : tp] || "") + " " + t("fuga_tipo_" + (tp === "marca" ? "pegadinha" : tp)) : "—" })));
  const ac = fugaEl("div", "fuga-acoes");
  ac.append(fugaBt(t("fuga_outros_seguir"), () => fugaOutros(), "btn-min-ok", "btnFugaSeguir"));
  ac.append(fugaBt(t("fuga_terminar"), () => fugaTerminar(), "", "btnFugaTerminar"));
  p.append(ac);
  box.append(p);
}
function fugaPintarResumo(box, S) {
  const r = S.respostas;
  const p = fugaEl("div", "fuga-fim");
  p.id = "fugaResumo";
  p.append(fugaEl("div", "fuga-fim-tit", r.length ? t("fuga_resumo", { n: r.length, s: fugaContas(r).s, ns: fugaContas(r).n, l: fugaContas(r).l, r: S.rodada }) : t("fuga_resumo_vazio")));
  if (S.esgotou) {
    p.append(fugaEl("p", "fuga-vazio-tit", t("fuga_vz_esgotou")));
    p.append(fugaPorQueEl(fugaPorQueVazio()));
  }
  const nao = r.filter((x) => !x.sabia && !x.lido);
  if (nao.length) {
    p.append(fugaEl("div", "fuga-sec", t("fuga_nao_sabia_lista")));
    nao.forEach((x, k) => {
      const lin = fugaEl("div", "fuga-res-lin");
      lin.append(fugaEl("span", "", (FUGA_ICO[x.item.tipo] || "•") + " " + String(x.item.frente || x.item.texto || x.item.rotulo || "").slice(0, 110)));
      const ir = fugaIrBotao(x.item);
      if (ir) { ir.id = "btnFugaResIr_" + k; lin.append(ir); }
      p.append(lin);
    });
    const cards = nao.filter((x) => x.item.tipo === "cartao" && x.item.uid);
    if (cards.length) {
      const pend = cards.filter((x) => !x.item.enviado).length;
      const bm = fugaBt(pend ? t("fuga_mandar", { n: pend }) : t("fuga_mandado", { n: cards.length }), () => fugaMandarRevisao(), pend ? "btn-min-ok" : "", "btnFugaMandar", t("fuga_mandar_tip"));
      if (!pend) bm.disabled = true;
      p.append(bm);
    }
  }
  box.append(p);
}
(function fugaLigar() {
  try {
    if (typeof document === "undefined") return;
    const liga = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    liga("btnHdrFuga", () => fugaAbrir());
    liga("btnMatFuga", () => fugaAbrir());
    liga("btnFugaOutros", () => fugaOutros());
    liga("btnFugaComo", () => fugaPainel("fugaComo"));
    /* (19.187.0) o "como funciona" não abre mais sozinho: a marca de já visto não serve */
    try { localStorage.removeItem("eac_fuga_como_visto"); } catch (e) {}
    liga("btnFugaOpcoes", () => fugaPainel("fugaOpcoes"));
    liga("btnFugaFechar", () => fugaFechar());
    liga("btnFugaX", () => fugaFechar());
    /* teclas: espaço vira, S sabia, N não sabia, → próximo; nunca enquanto se digita */
    const d = document.getElementById("dlgFuga");
    /* (19.186.0) fechar por qualquer caminho encerra a fuga (o Esc não passa pelo "voltar ao estudo") */
    if (d && d.addEventListener) d.addEventListener("close", () => fugaAoFechar());
    if (d && d.addEventListener) d.addEventListener("keydown", (e) => {
      if (!e || e.ctrlKey || e.metaKey || e.altKey || !fugaS) return;
      const alvo = e.target || {};
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || "")) return;
      const k = String(e.key || "").toLowerCase();
      const x = fugaItemAtual();
      let feito = false;
      const cartaoDeVerdade = x && x.tipo === "cartao" && x.nota && x.uid && !fugaRespondido(x);
      if (cartaoDeVerdade && fugaS.revelado && /^[1-4]$/.test(k)) feito = fugaNotaCartao(Number(k));
      else if (cartaoDeVerdade && fugaS.revelado && (k === "s" || k === "n")) feito = fugaNotaCartao(k === "s" ? 3 : 1);
      else if ((k === " " || k === "enter") && x && !fugaS.revelado && x.tipo !== "questao") feito = fugaVirar();
      else if (k === "s" && x && !fugaRespondido(x) && (fugaS.revelado || /pegadinha|importante|dica/.test(x.tipo)) && x.tipo !== "questao") feito = fugaResponder(true, /pegadinha|importante|dica/.test(x.tipo));
      else if (k === "n" && x && !fugaRespondido(x) && fugaS.revelado && x.tipo !== "questao") feito = fugaResponder(false);
      else if (k === "arrowright" && (x || fugaS.fase === "fimRodada")) feito = fugaNav(1);
      else if (k === "arrowleft" && (x || fugaS.fase === "fimRodada")) feito = fugaNav(-1);
      else if (k === "c" && x && x.tipo === "questao" && !fugaS.revelado) { fugaResponderQuestao("C"); feito = true; }
      else if (k === "e" && x && x.tipo === "questao" && !fugaS.revelado) { fugaResponderQuestao("E"); feito = true; }
      if (feito && e.preventDefault) e.preventDefault();
    });
  } catch (e) {}
})();
