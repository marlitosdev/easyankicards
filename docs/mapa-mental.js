/* =====================================================================
 * (19.174.0) 🗺 O MAPA DO RESUMO — fase 1: montado do próprio texto, sem IA
 *
 * Os resumos já são hierárquicos: "## Ramo — …", subtítulos, listas recuadas e o termo-chave em negrito no começo do
 * item ("**Teste do Pronome Relativo:** substitui-se…"). O mapa é essa estrutura desenhada como árvore — e por isso:
 *  · NÃO INVENTA: cada nó é uma linha do seu texto (tocar leva a ela na leitura); nada vem de fora;
 *  · NÃO DESATUALIZA: é refeito do texto a cada abertura; editou o resumo, o mapa já é outro;
 *  · CUSTA ZERO e funciona offline; não guarda nada além de quais ramos você recolheu (no aparelho).
 * O que ele destaca: o ramo de PESO 4 ou 5 no edital (borda forte e "peso 5") e as SUAS MARCAS em cada nó (as mesmas
 * cores da leitura). Vale para o ramo escolhido no seletor do resumo, como a leitura.
 * A diferença para o "só grifos": o só grifos mostra o que VOCÊ marcou; o mapa mostra a ESTRUTURA do assunto.
 * ===================================================================== */
let matMapaOn = false;
const MM_RECOLHIDOS = "eac_mm_recolhidos";       /* conveniência do aparelho: quais nós ficam recolhidos, por resumo */
const MM_MUITOS = 60;                             /* acima disso, o mapa abre só até os ramos */

function mmLerRecolhidos() { try { const v = JSON.parse(localStorage.getItem(MM_RECOLHIDOS) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function mmGravarRecolhidos(m) { try { localStorage.setItem(MM_RECOLHIDOS, JSON.stringify(m)); } catch (e) {} }

/* as marcas de uma linha, pelo tipo (a ordem das cores da leitura) */
function mmMarcasDe(l) {
  const out = [];
  const porSuf = { "!": "importante", "?": "duvida", "§": "lei", "~": "pegadinha", "@": "nota" };
  /* cada marca INTEIRA ("==…=="): o primeiro caractere de dentro diz o tipo; sem sufixo, é o grifo simples */
  String(l || "").replace(/==((?:[^=\n]|=(?!=))+)==/g, (m, x) => {
    const c = x.charAt(0);
    const tipo = porSuf[c] || (c === "*" && x.charAt(1) !== "*" ? "prova" : "destaque");
    if (out.indexOf(tipo) < 0) out.push(tipo);
    return m;
  });
  return out;
}
/* o texto visível: sem os sinais de marca, negrito, itálico, lacuna e fórmula simples */
function mmLimpar(s) {
  return String(s || "")
    .replace(/\{\{c\d+::([\s\S]*?)\}\}/g, (m, x) => x.split("::")[0])
    .replace(/==[!?§~@]?|==\*(?!\*)/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2").replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/\s+/g, " ").trim();
}
/* rótulo e detalhe de um item: o termo-chave em negrito no começo ("**Termo:** resto") vira o rótulo; sem ele,
 * "Termo: resto" com o termo curto; sem nada disso, o começo da frase */
function mmRotulo(s0) {
  const s = String(s0 || "").replace(/^\s*(?:==[!?§~@]?|==\*(?!\*))\s*/, "");
  const b = s.match(/^\*\*([^*]{2,90}?)\*\*\s*[:—–-]?\s*([\s\S]*)$/);
  if (b) return { label: mmLimpar(b[1]).replace(/[:.\s]+$/, ""), det: mmLimpar(b[2]) };
  const limpo = mmLimpar(s);
  const dp = limpo.match(/^([^:]{2,50}):\s+(.+)$/);
  if (dp && !/\d$/.test(dp[1])) return { label: dp[1], det: dp[2] };
  if (limpo.length <= 90) return { label: limpo, det: "" };
  const corte = limpo.slice(0, 90).replace(/\s+\S*$/, "");
  return { label: corte + "…", det: limpo.slice(corte.length).trim() };
}

/* A ÁRVORE. opc: { titulo, ramos: [{nome, peso}] } → { raiz, nos (total), ramos (quantos) } */
function mmMontar(texto, opc) {
  const o = opc || {};
  const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const pesoDe = {};
  (o.ramos || []).forEach((r) => { if (r && r.nome) pesoDe[norm(r.nome)] = r.peso; });
  const raiz = { id: "raiz", label: o.titulo || "", det: "", linha: -1, marcas: [], filhos: [], raiz: true };
  let nos = 0, ramos = 0;
  const tits = [];             /* [{nivel, no}] */
  let lista = [];              /* [{ind, no}] */
  const atual = () => (tits.length ? tits[tits.length - 1].no : raiz);
  const novo = (k, linha, rot, extra) => {
    nos++;
    return Object.assign({ id: "l" + k, linha: k, label: rot.label, det: rot.det, marcas: mmMarcasDe(linha), filhos: [] }, extra || {});
  };
  String(texto || "").split("\n").forEach((linha, k) => {
    const s = linha.replace(/\s+$/, "");
    if (!s.trim()) { lista = []; return; }
    const tr = s.trim();
    if (/^\|/.test(tr) || /^-{3,}$/.test(tr) || /^\$\$/.test(tr) || /^\\\[/.test(tr)) return;   /* tabela, régua, fórmula */
    const h = tr.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const nivel = h[1].length;
      let txt = h[2];
      const rm = txt.match(/^ramo\s*[—–:-]\s*(.+)$/i);
      const ehRamo = !!rm;
      if (rm) txt = rm[1];
      while (tits.length && tits[tits.length - 1].nivel >= nivel) tits.pop();
      const no = novo(k, linha, { label: mmLimpar(txt), det: "" }, { titulo: true, ramo: ehRamo });
      if (ehRamo) { ramos++; const p = pesoDe[norm(mmLimpar(txt))]; if (p != null) no.peso = p; }
      atual().filhos.push(no);
      tits.push({ nivel, no });
      lista = [];
      return;
    }
    const li = s.match(/^(\s*)(?:==[!?§~@]?\s*|==\*(?!\*)\s*)?([-*]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ind = li[1].replace(/\t/g, "    ").length;
      while (lista.length && lista[lista.length - 1].ind >= ind) lista.pop();
      const pai = lista.length ? lista[lista.length - 1].no : atual();
      const no = novo(k, linha, mmRotulo(li[3]));
      pai.filhos.push(no);
      lista.push({ ind, no });
      return;
    }
    const dica = tr.match(/^(?:\?>|>>|>~?)\s?(.*)$/);
    const rot = mmRotulo(dica ? dica[1] : tr);
    if (!rot.label) return;
    const no = novo(k, linha, rot, dica ? { dica: true } : {});
    /* o parágrafo logo depois de um item, sem linha em branco no meio, continua o item */
    (lista.length ? lista[lista.length - 1].no : atual()).filhos.push(no);
  });
  return { raiz, nos, ramos };
}

/* ---------------- o desenho ---------------- */
const MM_ICO_MARCA = { importante: "❗", duvida: "❓", lei: "§", prova: "🎯", pegadinha: "⚠", nota: "📝", destaque: "🖍" };
function mmNoEl(no, prof, rec, chave) {
  const li = document.createElement("li");
  const fechado = !!rec[no.id];
  li.className = "mm-no" + (no.raiz ? " mm-raiz" : "") + (no.ramo ? " mm-ramo" : "") + (no.titulo && !no.ramo ? " mm-tit" : "")
    + (no.peso >= 4 ? " mm-peso-alto" : "") + (no.dica ? " mm-dica" : "") + (fechado && no.filhos.length ? " mm-fechado" : "");
  li.id = "mmNo_" + no.id;
  const cx = document.createElement("div");
  cx.className = "mm-cx";
  if (no.filhos.length) {
    const tg = document.createElement("button");
    tg.type = "button"; tg.className = "mm-tg"; tg.id = "mmTg_" + no.id;
    tg.textContent = fechado ? "▸" : "▾";
    tg.setAttribute("aria-expanded", fechado ? "false" : "true");
    tg.title = t(fechado ? "mm_abrir" : "mm_recolher", { n: no.filhos.length });
    tg.onclick = () => mmAlternar(chave, no.id);
    cx.append(tg);
  }
  const rot = document.createElement("span");
  rot.className = "mm-rot";
  rot.textContent = no.label;
  if (!no.raiz) {
    rot.setAttribute("role", "button"); rot.tabIndex = 0;
    rot.title = t("mm_ir_tip");
    rot.onclick = () => matMapaIr(no.linha);
  }
  cx.append(rot);
  if (no.peso >= 4) { const p = document.createElement("span"); p.className = "mm-peso"; p.textContent = t("mm_peso", { p: no.peso }); cx.append(p); }
  no.marcas.forEach((m) => { const s = document.createElement("span"); s.className = "mm-mk mm-mk-" + m; s.textContent = MM_ICO_MARCA[m] || "•"; s.title = t("mm_marca_" + m); cx.append(s); });
  if (fechado && no.filhos.length) { const n = document.createElement("span"); n.className = "mm-conta"; n.textContent = "+" + no.filhos.length; cx.append(n); }
  if (no.det) {
    const d = document.createElement("span");
    d.className = "mm-det";
    d.textContent = no.det.length > 180 ? no.det.slice(0, 179) + "…" : no.det;
    if (no.det.length > 180) d.title = no.det;
    cx.append(d);
  }
  li.append(cx);
  if (no.filhos.length && !fechado) {
    const ul = document.createElement("ul");
    no.filhos.forEach((f) => ul.append(mmNoEl(f, prof + 1, rec, chave)));
    li.append(ul);
  }
  return li;
}
let mmUltimo = null;            /* { chave, arvore } da última pintura */
function mmChave() { return (typeof matAtual !== "undefined" && matAtual && matAtual.chave ? matAtual.chave : "") + "|" + (typeof matEscopo !== "undefined" ? matEscopo : ""); }
function mmArvoreAtual() {
  const txt = typeof matTextoDoEscopo === "function" ? matTextoDoEscopo() : (($("matTexto") || {}).value || "");
  let ramos = [];
  try {
    if (typeof matIndiceRamos === "function" && matAtual) ramos = matIndiceRamos().get(matChaveNormal(matAtual.chave)) || [];
  } catch (e) { ramos = []; }
  const titulo = (typeof matAtual !== "undefined" && matAtual && (matAtual.topico || matAtual.nome)) || "";
  return mmMontar(txt === null ? "" : txt, { titulo, ramos });
}
/* os recolhidos deste resumo; na primeira vez, um mapa grande abre só até os ramos */
function mmRecolhidosDe(chave, arv) {
  const m = mmLerRecolhidos();
  if (m[chave]) return m[chave];
  const rec = {};
  if (arv.nos > MM_MUITOS) {
    const fechar = (no, prof) => no.filhos.forEach((f) => { if (f.filhos.length) rec[f.id] = 1; fechar(f, prof + 1); });
    fechar(arv.raiz, 0);
  }
  return rec;
}
function mmAlternar(chave, id) {
  const m = mmLerRecolhidos();
  const rec = m[chave] || mmRecolhidosDe(chave, mmUltimo ? mmUltimo.arvore : { nos: 0, raiz: { filhos: [] } });
  if (rec[id]) delete rec[id]; else rec[id] = 1;
  m[chave] = rec;
  mmGravarRecolhidos(m);
  matMapaPintar();
}
function mmTodos(chave, abrir) {
  const m = mmLerRecolhidos();
  const rec = {};
  if (!abrir && mmUltimo) {
    /* "só os ramos": recolhe tudo abaixo do primeiro nível de títulos */
    const fechar = (no, prof) => no.filhos.forEach((f) => { if (f.filhos.length) rec[f.id] = 1; fechar(f, prof + 1); });
    fechar(mmUltimo.arvore.raiz, 0);
  }
  m[chave] = rec;
  mmGravarRecolhidos(m);
  matMapaPintar();
}
function matMapaPintar() {
  const box = $("matMapa");
  if (!box) return null;
  box.innerHTML = "";
  const chave = mmChave();
  const arv = mmArvoreAtual();
  mmUltimo = { chave, arvore: arv };
  const barra = document.createElement("div");
  barra.className = "mm-barra";
  const res = document.createElement("span");
  res.className = "nota"; res.id = "mmResumo";
  res.textContent = t("mm_resumo", { r: arv.ramos, n: arv.nos });
  const b1 = document.createElement("button"); b1.type = "button"; b1.className = "btn-min"; b1.id = "btnMmAbrirTudo"; b1.textContent = t("mm_abrir_tudo");
  b1.onclick = () => mmTodos(chave, true);
  const b2 = document.createElement("button"); b2.type = "button"; b2.className = "btn-min"; b2.id = "btnMmSoRamos"; b2.textContent = t("mm_so_ramos");
  b2.onclick = () => mmTodos(chave, false);
  barra.append(res, b1, b2);
  box.append(barra);
  if (!arv.nos) {
    const p = document.createElement("p"); p.className = "nota"; p.id = "mmVazio"; p.textContent = t("mm_vazio"); box.append(p);
    return arv;
  }
  const ul = document.createElement("ul");
  ul.className = "mm-arv";
  ul.append(mmNoEl(arv.raiz, 0, mmRecolhidosDe(chave, arv), chave));
  box.append(ul);
  return arv;
}
/* ligar/desligar e o botão: chamado depois de cada desenho do resumo (material.js) */
function matMapaAplicar(lendo) {
  const b = $("btnMatMapa"), box = $("matMapa"), lei = $("matLeitura");
  const pode = lendo !== false && !!lei;
  let n = 0;
  if (pode) { try { n = mmArvoreAtual().nos; } catch (e) { n = 0; } }
  if (!pode || n < 3) matMapaOn = false;
  if (b) {
    b.hidden = !pode || n < 3;
    b.textContent = t(matMapaOn ? "mm_btn_on" : "mm_btn");
    b.setAttribute("aria-pressed", matMapaOn ? "true" : "false");
    if (b.classList) b.classList.toggle("on", matMapaOn);
  }
  if (box) box.hidden = !matMapaOn;
  if (lei && pode) lei.hidden = matMapaOn;
  if (matMapaOn) matMapaPintar();
  return matMapaOn;
}
function matMapaAlternar(sim) {
  matMapaOn = sim === undefined ? !matMapaOn : !!sim;
  matMapaAplicar(typeof matModo !== "undefined" ? matModo === "ler" : true);
  try { matReg("ler", matMapaOn ? "mapa do resumo" : "texto do resumo", matAtual ? matAtual.chave : ""); } catch (e) {}
  return matMapaOn;
}
/* tocar num nó: volta ao texto, no trecho daquela linha (ou do mais próximo acima que a leitura desenhou) */
function matMapaIr(linha) {
  matMapaAlternar(false);
  const lei = $("matLeitura");
  if (!lei || !lei.querySelector) return null;
  let el = null;
  for (let j = linha; j >= 0 && !el; j--) el = lei.querySelector('[data-l="' + j + '"]');
  if (el) {
    try { el.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) { try { el.scrollIntoView(); } catch (x) {} }
    if (el.classList) { el.classList.add("mm-alvo"); setTimeout(() => { try { el.classList.remove("mm-alvo"); } catch (e) {} }, 1600); }
  }
  return el;
}
(function mmLigar() {
  try {
    if (typeof document === "undefined") return;
    const b = document.getElementById("btnMatMapa");
    if (b) b.onclick = () => matMapaAlternar();
  } catch (e) {}
})();
