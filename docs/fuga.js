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
 *    dos cartões; os outros itens abrem no lugar deles. Fora isso, nada é gravado além de linhas no registro.
 * ===================================================================== */
const FUGA_SEG = 180;
const FUGA_PREF_CH = "eac_fuga_pref";
const FUGA_VISTOS_CH = "eac_fuga_vistos";
const FUGA_COMO_CH = "eac_fuga_como_visto";
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
    out.push({ tipo: "cartao", disciplina: n.disciplina || "", topico: n.topico || "", frente: fugaLimpo(frente).slice(0, 400), verso: verso.slice(0, 500), peso, uid });
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
      const r = agg[a.chave] || (agg[a.chave] = { leiId: a.leiId, num: a.num, q: 0, e: 0, a: 0, discs: {}, tops: {} });
      r.q++;
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
    out.push({ tipo: "artigo", lei: l.nome || "", leiId: l.id, num: r.num, rotulo: a.rotulo || ("Art. " + r.num),
      disciplina: maisDe(r.discs) || tp.disciplina, topico: maisDe(r.tops) || tp.topico,
      frente: a.rotulo + (nota ? " — " + fugaLimpo(nota) : ""), verso: corpo.slice(0, 900),
      motivo: t(erra ? "fuga_art_erra" : "fuga_art_cai", { q: r.q, e: r.e }), peso: (erra ? 10 : 0) + r.q });
  });
  return out.sort((a, b) => b.peso - a.peso);
}
/* os trechos marcados nos resumos E nas leis: [{ tipo: "pegadinha" | "importante", disciplina, topico, texto }] */
function fugaMarcas() {
  const out = [];
  const juntar = (txt, disciplina, topico, origem) => {
    if (String(txt || "").indexOf("==") < 0) return;
    [[FUGA_RE_PEG, "pegadinha"], [FUGA_RE_IMP, "importante"]].forEach(([re, tipo]) => {
      String(txt).replace(re, (m, x) => {
        const s = fugaLimpo(x);
        if (s.length >= 12) out.push(Object.assign({ tipo, disciplina: disciplina || "", topico: topico || "", texto: s.slice(0, 400) }, origem ? { origem } : {}));
        return m;
      });
    });
  };
  const rs = typeof matResumos !== "undefined" ? matResumos : {};
  Object.keys(rs).forEach((k) => { const r = rs[k]; juntar(r && r.texto, r && r.disciplina, r && r.topico); });
  /* (19.185.0) as pegadinhas que você marcou na própria letra da lei */
  try {
    leisLista().forEach((l) => {
      if (!l || String(l.texto || "").indexOf("==") < 0) return;
      const tp = fugaDoTopico((l.topicos || [])[0]);
      juntar(l.texto, tp.disciplina, tp.topico, l.nome);
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
  const atual = fugaNorm(o.disc !== undefined ? o.disc : fugaDiscAtual());
  const F = o.fontes || fugaFontesTodas(rnd);
  const discs = o.discs || F.discs || new Set();
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
  /* "como funciona" vem aberto na primeira vez */
  const como = typeof document !== "undefined" ? document.getElementById("fugaComo") : null;
  let viu = false;
  try { viu = localStorage.getItem(FUGA_COMO_CH) === "1"; localStorage.setItem(FUGA_COMO_CH, "1"); } catch (e) {}
  if (como) como.open = !viu;
  fugaChipsPintar();
  if (typeof abrirModal === "function") abrirModal("dlgFuga");
  return true;
}
/* a rodada seguinte da corrente: continua o tipo de onde parou e não repete nada desta fuga */
function fugaNovaRodada() {
  if (!fugaS) return null;
  const pref = fugaPref();
  const r = fugaSortear({ disc: fugaS.disc, rnd: fugaS.rnd, fontes: fugaS.fontes, ativas: pref.fontes, excluir: fugaS.vistos,
    vistos: fugaVistosLer(), inicio: fugaS.inicio });
  fugaS.rodada++;
  fugaS.itens = r.itens;
  fugaS.inicio = r.proxInicio;
  fugaS.i = 0;
  fugaS.revelado = false;
  fugaS.fase = r.itens.length ? "item" : (fugaS.respostas.length ? "resumo" : "vazio");
  r.itens.forEach((x) => fugaS.vistos.push(fugaChave(x)));
  fugaVistosJuntar(r.itens.map(fugaChave));
  fugaPintar();
  return r;
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
  fugaS.respostas.push({ item: x, sabia: certo, rodada: fugaS.rodada });
  fugaPintar();
  return certo;
}
function fugaProximo() {
  if (!fugaS) return false;
  fugaS.i++;
  fugaS.revelado = false;
  if (fugaS.i >= fugaS.itens.length) {
    fugaS.fase = "fimRodada";
    const da = fugaS.respostas.filter((r) => r.rodada === fugaS.rodada);
    const c = fugaContas(da);
    try { reg("ESTUDO", "fuga rápida: rodada " + fugaS.rodada, c.s + " sabia · " + c.n + " não sabia · " + c.l + " lido(s)"); } catch (e) {}
  }
  fugaPintar();
  return true;
}
function fugaTerminar() {
  if (!fugaS) return false;
  fugaS.fase = "resumo";
  const s = fugaS.respostas;
  try { reg("ESTUDO", "fuga rápida encerrada", fugaS.rodada + " rodada(s) · " + s.length + " item(ns) · " + fugaContas(s).s + " sabia · " + fugaContas(s).n + " não sabia"); } catch (e) {}
  fugaPintar();
  return true;
}
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
  try { if (fugaRelogio) clearInterval(fugaRelogio); } catch (e) {}
  fugaRelogio = null;
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
    const b = fugaBt(t("fuga_f_" + k) + (n != null ? " (" + n + ")" : ""), () => { fugaPrefDefinir({ fontes: { [k]: !fugaPref().fontes[k] } }); fugaChipsPintar(); },
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
  const sub = document.getElementById("fugaSub");
  const m = (S && S.min) || fugaPref().min;
  if (sub) sub.textContent = S.disc ? t("fuga_sub_disc", { d: S.disc, m }) : t("fuga_sub", { m });
  const outros = document.getElementById("btnFugaOutros");
  if (outros) outros.textContent = t(S.fase === "resumo" ? "fuga_outros_mais" : "fuga_outros");
  if (S.fase === "vazio") {
    const p = fugaEl("p", "nota", t("fuga_vazia"));
    p.id = "fugaVazia";
    box.append(p);
    return;
  }
  if (S.fase === "fimRodada") return fugaPintarFimRodada(box, S);
  if (S.fase === "resumo") return fugaPintarResumo(box, S);
  const x = S.itens[S.i];
  if (!x) return;
  const c = fugaEl("div", "fuga-item fuga-" + x.tipo);
  c.id = "fugaItem_" + S.i;
  const cab = fugaEl("div", "fuga-cab");
  cab.append(fugaEl("span", "fuga-cab-tipo", (FUGA_ICO[x.tipo] || "•") + " " + fugaRotuloTipo(x)));
  cab.append(fugaEl("span", "fuga-cab-orig", fugaOrigem(x)));
  c.append(cab);
  c.append(fugaEl("div", "nota fuga-conta", t("fuga_conta", { i: S.i + 1, n: S.itens.length, r: S.rodada })));
  const frente = fugaEl("div", "fuga-txt", x.tipo === "pegadinha" || x.tipo === "importante" || x.tipo === "dica" || x.tipo === "prazo" ? (x.tipo === "prazo" ? x.rotulo + " — " + t("fuga_prazo_q") : x.texto) : x.frente);
  frente.id = "fugaFrente";
  fugaLigarCitas(frente, x);
  c.append(frente);
  if (x.motivo) c.append(fugaEl("div", "nota fuga-motivo", x.motivo));
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
      const ultima = S.respostas[S.respostas.length - 1];
      const fb = fugaEl("div", "fuga-verso " + (ultima && ultima.sabia ? "fuga-acertou" : "fuga-errou"),
        t(ultima && ultima.sabia ? "fuga_q_acertou" : "fuga_q_errou", { g: String(q.gabarito || "").toUpperCase() }));
      const extra = fugaLimpo(q.dica || q.comentario || "");
      if (extra) fb.append(fugaEl("div", "fuga-verso-txt", extra.slice(0, 700)));
      fugaLigarCitas(fb, x);
      c.append(fb);
      acoes.innerHTML = "";
      acoes.append(fugaBt(t("fuga_proximo"), () => fugaProximo(), "btn-min-ok", "btnFugaProx"));
    }
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
    acoes.append(fugaBt(t("fuga_sabia"), () => fugaResponder(true), "btn-min-ok", "btnFugaSabia", t("fuga_sabia_tip")));
    acoes.append(fugaBt(t("fuga_nao_sabia"), () => fugaResponder(false), "btn-min-perigo", "btnFugaNaoSabia", t("fuga_nao_sabia_tip")));
  }
  /* abrir no lugar dele (sem fechar a fuga: a janela abre por cima) */
  const ir = fugaIrBotao(x);
  if (ir && (S.revelado || x.tipo === "julgado" || x.tipo === "artigo")) acoes.append(ir);
  c.append(acoes);
  box.append(c);
}
function fugaIrBotao(x) {
  if ((x.tipo === "artigo" || x.tipo === "prazo") && x.leiId && typeof leiAbrirNoArtigo === "function") {
    return fugaBt(t("fuga_ir_lei"), () => leiAbrirNoArtigo("", "", x.leiId, x.num), "", "btnFugaIr");
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
  p.append(fugaEl("div", "fuga-fim-tit", t("fuga_fim_rodada", { r: S.rodada, s: cd.s, n: cd.n, l: cd.l })));
  if (S.rodada > 1) p.append(fugaEl("div", "nota", t("fuga_ate_agora", { n: S.respostas.length, s: fugaContas(S.respostas).s })));
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
  p.append(fugaEl("div", "fuga-fim-tit", r.length ? t("fuga_resumo", { n: r.length, s: fugaContas(r).s, ns: fugaContas(r).n, r: S.rodada }) : t("fuga_resumo_vazio")));
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
    liga("btnFugaFechar", () => fugaFechar());
    /* teclas: espaço vira, S sabia, N não sabia, → próximo; nunca enquanto se digita */
    const d = document.getElementById("dlgFuga");
    if (d && d.addEventListener) d.addEventListener("keydown", (e) => {
      if (!e || e.ctrlKey || e.metaKey || e.altKey || !fugaS) return;
      const alvo = e.target || {};
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName || "")) return;
      const k = String(e.key || "").toLowerCase();
      const x = fugaItemAtual();
      let feito = false;
      if ((k === " " || k === "enter") && x && !fugaS.revelado && x.tipo !== "questao") feito = fugaVirar();
      else if (k === "s" && x && (fugaS.revelado || /pegadinha|importante|dica/.test(x.tipo)) && x.tipo !== "questao") feito = fugaResponder(true, /pegadinha|importante|dica/.test(x.tipo));
      else if (k === "n" && x && fugaS.revelado && x.tipo !== "questao") feito = fugaResponder(false);
      else if (k === "arrowright" && x && fugaS.revelado) feito = fugaProximo();
      else if (k === "c" && x && x.tipo === "questao" && !fugaS.revelado) feito = fugaResponderQuestao("C") !== false;
      else if (k === "e" && x && x.tipo === "questao" && !fugaS.revelado) feito = fugaResponderQuestao("E") !== false;
      if (feito && e.preventDefault) e.preventDefault();
    });
  } catch (e) {}
})();
