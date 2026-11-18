/* =====================================================================
 * (19.173.0) ⚡ FUGA RÁPIDA — a pausa ativa de 3 minutos
 *
 * Quando a concentração cai no meio de uma sessão longa, a saída comum é o celular. O e-book ("Revisões de alto
 * desempenho") propõe o "assunto de fuga": uma lista curta de decorebas, prazos, exceções e vedações de OUTRAS
 * matérias, lida por 3 a 5 minutos — troca o contexto, descansa a cabeça e não sai do estudo.
 *
 * O app já tem esse material, espalhado; a fuga só junta 5 itens curtos, de disciplinas diferentes da atual:
 *  · 2 CARTÕES DIFÍCEIS — os que mais levaram "De novo" (lapsos e notas 1 da agenda dos cartões); tocar mostra a
 *    resposta;
 *  · 2 PEGADINHAS — os trechos que você marcou "~" (pegadinha) nos resumos (sem elas, os marcados "importante");
 *  · 1 ARTIGO COM PRAZO — um artigo de lei sua com "N dias/meses/anos";
 *  · o que faltar sai das SUAS DICAS do caderno de erros e chutes (o bizu).
 * Nada é gravado além de uma linha no registro: é leitura, não estudo contado.
 * ===================================================================== */
const FUGA_SEG = 180;
const FUGA_RE_PRAZO = /\b\d+\s*(?:\([^)]{1,30}\)\s*)?(?:dias?|meses|m[eê]s|anos?|horas?)\b/i;
const FUGA_RE_PEG = /==~((?:[^=\n]|=(?!=))+)==/g;
const FUGA_RE_IMP = /==!((?:[^=\n]|=(?!=))+)==/g;

function fugaNorm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
function fugaLimpo(s) {
  return String(s || "").replace(/\{\{c\d+::([\s\S]*?)\}\}/g, (m, x) => x.split("::")[0]).replace(/\*\*|__|==[!?§*~@]?/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    /* o "* " / "- " / "1. " da lista que veio junto com a marca (marcas antigas, ver matMarcaAntesDaLista) */
    .replace(/^(?:[-*]|\d+[.)])\s+/, "");
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

/* os cartões difíceis: [{ tipo: "cartao", disciplina, topico, frente, verso, peso }] */
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
    let peso = 0;
    ids.forEach((id) => {
      const r = regs[id];
      if (!r) return;
      const h = Array.isArray(r.h) ? r.h : [];
      peso = Math.max(peso, (Number(r.l) || 0) * 2 + h.filter((v) => v === 1).length);
    });
    if (peso < 2) return;
    const c = n.card;
    const frente = String(c.front || "").replace(/\{\{c\d+::([\s\S]*?)\}\}/g, (m, x) => { const p = x.split("::"); return p[1] ? "[" + p[1] + "]" : "[…]"; });
    const verso = fugaLimpo([c.front && /\{\{c\d+::/.test(c.front) ? c.front : "", c.back].filter(Boolean).join(" — "));
    out.push({ tipo: "cartao", disciplina: n.disciplina || "", topico: n.topico || "", frente: fugaLimpo(frente).slice(0, 400), verso: verso.slice(0, 500), peso });
  });
  return out.sort((a, b) => b.peso - a.peso);
}
/* os trechos marcados nos resumos: [{ tipo: "pegadinha" | "importante", disciplina, topico, texto }] */
function fugaMarcas() {
  const out = [];
  const rs = typeof matResumos !== "undefined" ? matResumos : {};
  Object.keys(rs).forEach((k) => {
    const r = rs[k];
    const txt = String((r && r.texto) || "");
    if (txt.indexOf("==") < 0) return;
    [[FUGA_RE_PEG, "pegadinha"], [FUGA_RE_IMP, "importante"]].forEach(([re, tipo]) => {
      txt.replace(re, (m, x) => {
        const s = fugaLimpo(x);
        if (s.length >= 12) out.push({ tipo, disciplina: r.disciplina || "", topico: r.topico || "", texto: s.slice(0, 400) });
        return m;
      });
    });
  });
  return out;
}
/* os artigos com prazo das suas leis: [{ tipo: "prazo", lei, rotulo, texto }] (no máximo 8 por lei, para não pesar) */
function fugaPrazos(rnd) {
  const out = [];
  let leis = [];
  try { leis = Object.keys(leisLerTudo() || {}).map((k) => leisLerTudo()[k]).filter((l) => l && l.texto); } catch (e) { leis = []; }
  fugaEmbaralhar(leis, rnd).slice(0, 6).forEach((l) => {
    let arts = [];
    try { arts = leiArtigos(l.texto); } catch (e) { arts = []; }
    let n = 0;
    fugaEmbaralhar(arts, rnd).some((a) => {
      const tx = String(a.texto || "");
      if (/revogad|vetad/i.test(tx.slice(0, 200)) || !FUGA_RE_PRAZO.test(tx) || tx.length > 900) return false;
      out.push({ tipo: "prazo", lei: l.nome || "", rotulo: a.rotulo || ("Art. " + a.numCru), texto: fugaLimpo(tx).slice(0, 600) });
      return ++n >= 8;
    });
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

/* O SORTEIO: 5 itens (2 cartões, 2 pegadinhas, 1 prazo; o que faltar, dicas), sem a disciplina de agora e sem
 * repetir disciplina enquanto houver outra. opc: { disc, rnd, fontes: {cartoes, marcas, prazos, dicas} } */
function fugaSortear(opc) {
  const o = opc || {};
  const rnd = o.rnd || Math.random;
  const atual = fugaNorm(o.disc !== undefined ? o.disc : fugaDiscAtual());
  const F = o.fontes || {};
  const fora = (x) => !atual || !x.disciplina || fugaNorm(x.disciplina) !== atual;
  /* os difíceis vêm primeiro, mas sorteados entre os mais difíceis (os 12 do topo), para a fuga não repetir sempre */
  const cartoes = (F.cartoes || fugaCartoes()).filter(fora);
  const topo = fugaEmbaralhar(cartoes.slice(0, 12), rnd);
  const marcas = (F.marcas || fugaMarcas()).filter(fora);
  const peg = fugaEmbaralhar(marcas.filter((x) => x.tipo === "pegadinha"), rnd).concat(fugaEmbaralhar(marcas.filter((x) => x.tipo === "importante"), rnd));
  const prazos = fugaEmbaralhar(F.prazos || fugaPrazos(rnd), rnd);
  const dicas = fugaEmbaralhar((F.dicas || fugaDicas()).filter(fora), rnd);
  const out = [];
  const usadas = {};
  const pegar = (lista, n) => {
    let k = 0;
    /* 1ª passada: disciplina ainda não usada; 2ª: qualquer uma */
    [true, false].forEach((nova) => lista.forEach((x) => {
      if (k >= n || out.indexOf(x) >= 0) return;
      const d = fugaNorm(x.disciplina || x.lei || "");
      if (nova && d && usadas[d]) return;
      out.push(x); usadas[d] = true; k++;
    }));
    return k;
  };
  let falta = 0;
  falta += 2 - pegar(topo, 2);
  falta += 2 - pegar(peg, 2);
  falta += 1 - pegar(prazos, 1);
  if (falta > 0) pegar(dicas, falta);
  return { itens: out, disc: o.disc !== undefined ? o.disc : fugaDiscAtual() };
}

/* ---------------- a janela ---------------- */
let fugaRelogio = null, fugaFim = 0;
function fugaAbrir() {
  fugaPintar(fugaSortear());
  fugaFim = Date.now() + FUGA_SEG * 1000;
  fugaTique();
  try { if (fugaRelogio) clearInterval(fugaRelogio); fugaRelogio = setInterval(fugaTique, 1000); } catch (e) {}
  try { reg("ESTUDO", "fuga rápida aberta", ""); } catch (e) {}
  if (typeof abrirModal === "function") abrirModal("dlgFuga");
  return true;
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
  if (!s && fugaRelogio) { try { clearInterval(fugaRelogio); } catch (e) {} fugaRelogio = null; }
  return s;
}
const FUGA_ICO = { cartao: "🃏", pegadinha: "⚠", importante: "❗", prazo: "⚖", dica: "💡" };
function fugaPintar(res) {
  const box = typeof document !== "undefined" ? document.getElementById("fugaLista") : null;
  if (!box) return;
  box.innerHTML = "";
  const r = res || { itens: [] };
  const sub = document.getElementById("fugaSub");
  if (sub) sub.textContent = r.disc ? t("fuga_sub_disc", { d: r.disc }) : t("fuga_sub");
  if (!r.itens.length) {
    const p = document.createElement("p"); p.className = "nota"; p.id = "fugaVazia"; p.textContent = t("fuga_vazia"); box.append(p);
    return;
  }
  r.itens.forEach((x, k) => {
    const c = document.createElement("div");
    c.className = "fuga-item fuga-" + x.tipo; c.id = "fugaItem_" + k;
    const cab = document.createElement("div");
    cab.className = "fuga-cab";
    cab.textContent = FUGA_ICO[x.tipo] + " " + t("fuga_tipo_" + x.tipo) + " · " + (x.tipo === "prazo" ? x.lei + ", " + x.rotulo : [x.disciplina, x.topico].filter(Boolean).join(" › "));
    c.append(cab);
    const tx = document.createElement("div");
    tx.className = "fuga-txt";
    tx.textContent = x.tipo === "cartao" ? x.frente : x.texto;
    c.append(tx);
    if (x.tipo === "cartao") {
      const v = document.createElement("div"); v.className = "fuga-verso"; v.hidden = true; v.textContent = x.verso;
      const b = document.createElement("button"); b.type = "button"; b.className = "btn-min"; b.id = "btnFugaVer_" + k; b.textContent = t("fuga_ver_resposta");
      b.onclick = () => { v.hidden = !v.hidden; b.textContent = t(v.hidden ? "fuga_ver_resposta" : "fuga_esconder"); };
      c.append(b, v);
    }
    box.append(c);
  });
}
(function fugaLigar() {
  try {
    if (typeof document === "undefined") return;
    const liga = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    liga("btnHdrFuga", () => fugaAbrir());
    liga("btnMatFuga", () => fugaAbrir());
    liga("btnFugaOutros", () => fugaPintar(fugaSortear()));
    liga("btnFugaFechar", () => fugaFechar());
  } catch (e) {}
})();
