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

/* (19.175.0) TENTAR LEMBRAR — a fase 2: o mapa deixa de ser leitura passiva. Os galhos aparecem só pelo nome; o que há
 * dentro (o detalhe e os galhos de baixo) fica escondido até você tentar lembrar e tocar para revelar; aí marca
 * "✓ lembrei" ou "✗ não lembrei". O "não lembrei" fica destacado também no mapa normal e pode virar cartão (o painel de
 * cartões do tópico abre já preenchido, para você conferir antes de gravar). O resultado é guardado por CAMINHO do galho
 * ("Ramo › Item"), não por linha — vale igual no "Tudo" e no ramo, e sobrevive a editar outras partes do resumo. */
const MM_TREINO_CH = "eac_mm_treino";
let mmTreino = false;
let mmRevelados = {};
function mmTreinoLer() { try { const v = JSON.parse(localStorage.getItem(MM_TREINO_CH) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function mmTreinoGravar(m) { try { localStorage.setItem(MM_TREINO_CH, JSON.stringify(m)); } catch (e) {} }
/* (19.177.0) o mapa da IA (mapa-ia.js) tem o seu próprio treino e os seus recolhidos: chave do resumo + "|ia" */
function mmEhIa() { return typeof mmFonteAtual === "function" && mmFonteAtual() === "ia"; }
function mmChaveResumo() { const c = typeof matAtual !== "undefined" && matAtual && matAtual.chave ? matAtual.chave : ""; return c && mmEhIa() ? c + "|ia" : c; }
function mmResultados() { return mmTreinoLer()[mmChaveResumo()] || {}; }
function mmMarcarResultado(no, v) {
  const m = mmTreinoLer();
  const ch = mmChaveResumo();
  const r = m[ch] || {};
  if (v) r[no.caminho] = { v, em: (typeof hojeISO === "function" ? hojeISO() : new Date().toISOString().slice(0, 10)) };
  else delete r[no.caminho];
  m[ch] = r;
  mmTreinoGravar(m);
  matMapaPintar();
}
function mmTemDentro(no) { return !no.raiz && (!!no.det || no.filhos.length > 0); }
function mmRevelar(no) { mmRevelados[no.caminho] = 1; matMapaPintar(); }
/* os galhos com "não lembrei" na árvore atual */
function mmEsquecidos(arv) {
  const res = mmResultados(), out = [];
  const ir = (no, pai) => { if (!no.raiz && res[no.caminho] && res[no.caminho].v === "n") out.push({ no, pai }); no.filhos.forEach((f) => ir(f, no)); };
  if (arv) ir(arv.raiz, null);
  return out;
}
/* a linha do cartão ("frente :: verso"): a pergunta leva o galho de cima, para não ficar solta */
function mmCartaoLinha(no, pai) {
  const limpa = (s) => String(s || "").replace(/::/g, ":").replace(/\s+/g, " ").trim();
  const verso = no.det ? no.det : no.filhos.map((f) => f.label).join("; ");
  if (!verso) return "";
  const ctx = pai && !pai.raiz ? limpa(pai.label) + " › " : "";
  return limpa(ctx + no.label + " — o que é / o que diz?") + " :: " + limpa(verso);
}
function mmVirarCartoes() {
  const lst = mmEsquecidos(mmUltimo && mmUltimo.arvore).map((x) => mmCartaoLinha(x.no, x.pai)).filter(Boolean);
  if (!lst.length || typeof matCartoesAbrir !== "function") return 0;
  matCartoesAbrir({ semGravarResumo: true });
  const ta = $("mcTexto");
  if (ta) { ta.value = lst.join("\n"); try { if (typeof matCartoesConferir === "function") matCartoesConferir(); } catch (e) {} }
  try { matReg("ler", "mapa: não lembrados viram cartões", lst.length + " · " + mmChaveResumo()); } catch (e) {}
  return lst.length;
}
function mmTreinoAlternar(sim) {
  mmTreino = sim === undefined ? !mmTreino : !!sim;
  mmRevelados = {};
  matMapaPintar();
  try { matReg("ler", mmTreino ? "mapa: tentar lembrar" : "mapa: fim do treino", mmChaveResumo()); } catch (e) {}
  return mmTreino;
}
function mmTreinoRecomecar() {
  const m = mmTreinoLer();
  delete m[mmChaveResumo()];
  mmTreinoGravar(m);
  mmRevelados = {};
  matMapaPintar();
}

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

/* (19.176.0) o TIPO do galho pelo nome: "Exceções", "Pegadinhas comuns" → ⚠; "Como costuma cair em prova" → 🎯. Os mesmos
 * ícones e cores das marcas de pegadinha e de prova — uma legenda só. "Regra", "Conceito" ficam sem cor: cor em tudo
 * não destaca nada. */
function mmSemantica(label) {
  const s = String(label || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\bexce(cao|coes)\b|\bressalva|\bpegadinha|\bcuidado\b|\batencao\b|\bconfus/.test(s)) return "peg";
  if (/cai(r|u)? em prova|costuma cair|como (e )?cobrad|cobranca em prova|na prova\b|bancas?\b.*cobr/.test(s)) return "prova";
  return "";
}
/* o nome comprido termina num parêntese explicativo ("… (Conformidade, Comparação, …)"): o parêntese vai menor, sem
 * virar galho — nos resumos ele quase sempre é explicação ("(CF88)", "(art. 150, I)"), não lista */
function mmPartirRotulo(label) {
  const m = String(label || "").match(/^(.{10,}?)\s*(\([^()]{6,}\))\s*$/);
  return m && label.length > 40 ? { prin: m[1], par: m[2] } : { prin: label, par: "" };
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
  let corN = 0;
  const novo = (k, linha, rot, extra) => {
    nos++;
    return Object.assign({ id: "l" + k, linha: k, label: rot.label, det: rot.det, marcas: mmMarcasDe(linha), filhos: [], sem: mmSemantica(rot.label) }, extra || {});
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
      /* (19.176.0) "# Resumo geral" (ou o próprio nome do tópico) não é galho: é o cabeçalho do resumo. O que vem
       * abaixo dele fica na raiz e os ramos saem direto dela, cada um com a sua cor */
      const lt = norm(mmLimpar(txt));
      if (!ehRamo && (/^resumo( geral)?$/.test(lt) || (o.titulo && lt === norm(o.titulo)))) { tits.length = 0; lista = []; return; }
      const no = novo(k, linha, { label: mmLimpar(txt), det: "" }, { titulo: true, ramo: ehRamo, tituloCru: h[2] });
      if (ehRamo) { ramos++; const p = pesoDe[norm(mmLimpar(txt))]; if (p != null) no.peso = p; }
      /* cada galho de primeiro nível (ramo ou título) tem a sua cor, que segue pelas linhas dele */
      if (atual() === raiz) no.cor = corN++ % 6;
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
      /* (19.177.0) no mapa da IA os galhos de primeiro nível são itens de lista: cada um com a sua cor também */
      if (o.corNaLista && pai === raiz) no.cor = corN++ % 6;
      pai.filhos.push(no);
      lista.push({ ind, no });
      return;
    }
    const dica = tr.match(/^(?:\?>|>>|>~?)\s?(.*)$/);
    const rot = mmRotulo(dica ? dica[1] : tr);
    if (!rot.label) return;
    /* (19.176.0) o parágrafo corrido, sem termo em negrito, é NOTA: um galho discreto ("📝 …") que não compete com os
     * termos-chave — o mapa é de palavras-chave, não de frases */
    const nota = !dica && !/^\s*(?:==\S?\s*)?\*\*/.test(tr) && mmLimpar(tr).length > 90;
    const no = novo(k, linha, rot, dica ? { dica: true } : (nota ? { nota: true } : {}));
    /* o parágrafo logo depois de um item, sem linha em branco no meio, continua o item */
    (lista.length ? lista[lista.length - 1].no : atual()).filhos.push(no);
  });
  /* o CAMINHO de cada galho ("Ramo › Item"): a identidade estável do treino; nomes repetidos sob o mesmo pai ganham #2 */
  const caminhos = (no, pre) => {
    const vistos = {};
    no.filhos.forEach((f) => {
      const base = (pre ? pre + " › " : "") + norm(f.label).slice(0, 80);
      vistos[base] = (vistos[base] || 0) + 1;
      f.caminho = base + (vistos[base] > 1 ? " #" + vistos[base] : "");
      caminhos(f, f.caminho);
    });
  };
  raiz.caminho = "";
  caminhos(raiz, "");
  return { raiz, nos, ramos };
}

/* ---------------- o desenho ---------------- */
const MM_ICO_MARCA = { importante: "❗", duvida: "❓", lei: "§", prova: "🎯", pegadinha: "⚠", nota: "📝", destaque: "🖍" };
function mmNoEl(no, prof, rec, chave) {
  const li = document.createElement("li");
  /* no treino, o que está aberto é o que você já revelou (a raiz sempre) */
  const fechado = mmTreino ? !(no.raiz || mmRevelados[no.caminho]) : !!rec[no.id];
  li.className = "mm-no" + (no.raiz ? " mm-raiz" : "") + (no.ramo ? " mm-ramo" : "") + (no.titulo && !no.ramo ? " mm-tit" : "")
    + (no.peso >= 4 ? " mm-peso-alto" : "") + (no.dica ? " mm-dica" : "") + (fechado && no.filhos.length ? " mm-fechado" : "")
    + (no.cor != null ? " mm-cor-" + no.cor : "") + (no.nota ? " mm-nota" : "") + (no.sem ? " mm-sem-" + no.sem : "")
    + (no.marcas.length ? " mm-mkb-" + no.marcas[0] : "") + (no.foraDoResumo ? " mm-ia-fora" : "") + (no.numFora ? " mm-ia-num" : "");
  li.id = "mmNo_" + no.id;
  const cx = document.createElement("div");
  cx.className = "mm-cx";
  if (no.filhos.length) {
    const tg = document.createElement("button");
    tg.type = "button"; tg.className = "mm-tg"; tg.id = "mmTg_" + no.id;
    tg.textContent = fechado ? "▸" : "▾";
    tg.setAttribute("aria-expanded", fechado ? "false" : "true");
    tg.title = t(fechado ? "mm_abrir" : "mm_recolher", { n: no.filhos.length });
    tg.onclick = () => (mmTreino && fechado ? mmRevelar(no) : mmAlternar(chave, no.id));
    cx.append(tg);
  }
  /* (19.176.0) o tipo do galho (⚠ exceção/pegadinha, 🎯 cai em prova), antes do nome */
  if (no.sem) { const sm = document.createElement("span"); sm.className = "mm-sem"; sm.textContent = no.sem === "peg" ? "⚠" : "🎯"; sm.title = t("mm_sem_" + no.sem); cx.append(sm); }
  const rot = document.createElement("span");
  rot.className = "mm-rot";
  if (no.nota) {
    /* a nota: curta, discreta; o texto inteiro no balão e no próprio resumo */
    rot.textContent = "📝 " + (no.label.length > 60 ? no.label.slice(0, 59).replace(/\s+\S*$/, "") + "…" : no.label);
    rot.title = [no.label.replace(/…$/, ""), no.det].filter(Boolean).join(" ");
  } else {
    const pr = mmPartirRotulo(no.label);
    rot.textContent = pr.prin;
    if (pr.par) { const pa = document.createElement("span"); pa.className = "mm-par"; pa.textContent = " " + pr.par; rot.append(pa); }
  }
  if (!no.raiz) {
    rot.setAttribute("role", "button"); rot.tabIndex = 0;
    if (!no.nota) rot.title = t(mmTreino ? "mm_revelar_tip" : no.linha < 0 ? "mm_ia_sem_linha" : "mm_ir_tip");
    /* (19.177.0) o galho da IA que não se achou no resumo não tem linha para onde ir */
    rot.onclick = () => (mmTreino ? mmRevelar(no) : no.linha >= 0 ? matMapaIr(no.linha) : null);
    /* (19.176.0) teclado: Enter/Espaço = tocar; no treino, 1 = lembrei, 2 = não lembrei */
    rot.onkeydown = (ev) => {
      const k = ev && ev.key;
      if (k === "Enter" || k === " ") { if (ev.preventDefault) ev.preventDefault(); rot.onclick(); return; }
      if (mmTreino && mmRevelados[no.caminho] && mmTemDentro(no) && (k === "1" || k === "2")) { if (ev.preventDefault) ev.preventDefault(); mmMarcarResultado(no, k === "1" ? "s" : "n"); }
    };
  }
  cx.append(rot);
  if (no.titulo && mmLidos && mmLidos.has(mmNormTit(no.tituloCru))) { const ld = document.createElement("span"); ld.className = "mm-lido"; ld.textContent = t("mm_lido"); cx.append(ld); }
  /* (19.177.0) a conferência do mapa da IA: o galho que não está no resumo, ou com número que o resumo não tem */
  if (no.foraDoResumo || no.numFora) {
    const s = document.createElement("span"); s.className = "mm-ia-selo";
    s.textContent = t(no.foraDoResumo ? "mm_ia_fora" : "mm_ia_num");
    s.title = t(no.foraDoResumo ? "mm_ia_fora_tip" : "mm_ia_num_tip", { n: (no.numFora || []).join(", ") });
    cx.append(s);
  }
  if (no.peso >= 4) { const p = document.createElement("span"); p.className = "mm-peso"; p.textContent = t("mm_peso", { p: no.peso }); cx.append(p); }
  no.marcas.forEach((m) => { const s = document.createElement("span"); s.className = "mm-mk mm-mk-" + m; s.textContent = MM_ICO_MARCA[m] || "•"; s.title = t("mm_marca_" + m); cx.append(s); });
  if (fechado && no.filhos.length && !mmTreino) { const n = document.createElement("span"); n.className = "mm-conta"; n.textContent = "+" + no.filhos.length; cx.append(n); }
  /* (19.175.0) o treino: o que há dentro fica escondido até revelar; revelado, "✓ lembrei / ✗ não lembrei" */
  const res = mmResultados()[no.caminho];
  if (res && res.v === "n") li.className += " mm-esqueci";
  if (mmTreino && mmTemDentro(no)) {
    const revelado = !!mmRevelados[no.caminho];
    if (res && res.v === "s") li.className += " mm-lembrei";
    if (!revelado) {
      const oc = document.createElement("button");
      oc.type = "button"; oc.className = "mm-oculto"; oc.id = "mmOc_" + no.id;
      oc.textContent = t("mm_oculto", { n: no.filhos.length });
      oc.onclick = () => mmRevelar(no);
      cx.append(oc);
    } else {
      const ac = document.createElement("span");
      ac.className = "mm-res";
      const bt = (id, txt, v, cls) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn-min " + cls + (res && res.v === v ? " on" : ""); b.id = id; b.textContent = txt; b.onclick = () => mmMarcarResultado(no, res && res.v === v ? "" : v); ac.append(b); };
      bt("mmSim_" + no.id, t("mm_lembrei"), "s", "mm-res-s");
      bt("mmNao_" + no.id, t("mm_nao_lembrei"), "n", "mm-res-n");
      cx.append(ac);
    }
  } else if (res && res.v === "n") {
    const s = document.createElement("span"); s.className = "mm-esq-selo"; s.textContent = t("mm_selo_esqueci"); s.title = t("mm_selo_esqueci_tip", { d: (res.em || "").split("-").reverse().join("/") }); cx.append(s);
  }
  if (no.det && !no.nota && (mmTreino ? !!mmRevelados[no.caminho] : !mmCompacto)) {
    const d = document.createElement("span");
    d.className = "mm-det";
    d.textContent = no.det.length > 180 ? no.det.slice(0, 179) + "…" : no.det;
    if (no.det.length > 180) d.title = no.det;
    cx.append(d);
  }
  li.append(cx);
  /* com filtro (só não lembrados / só grifados), aparece o caminho até cada galho que passa, tudo aberto */
  const filhos = mmVis ? no.filhos.filter((f) => mmVis.has(f.caminho)) : no.filhos;
  if (filhos.length && (!fechado || mmVis)) {
    const ul = document.createElement("ul");
    filhos.forEach((f) => ul.append(mmNoEl(f, prof + 1, rec, chave)));
    li.append(ul);
  }
  return li;
}
/* (19.176.0) a vista compacta (só as palavras-chave), o filtro e as seções lidas */
const MM_COMPACTO_CH = "eac_mm_compacto";
let mmCompacto = (() => { try { return localStorage.getItem(MM_COMPACTO_CH) === "1"; } catch (e) { return false; } })();
let mmFiltro = "";              /* "" | "esqueci" | "grifos" */
let mmVis = null;               /* com filtro: os caminhos que aparecem */
let mmLidos = null;             /* os títulos de seção lidos (resumo-lidas.js) */
function mmNormTit(s) { return typeof rlsNormal === "function" ? rlsNormal(s) : String(s || "").toLowerCase(); }
function mmCompactoAlternar() { mmCompacto = !mmCompacto; try { localStorage.setItem(MM_COMPACTO_CH, mmCompacto ? "1" : "0"); } catch (e) {} matMapaPintar(); return mmCompacto; }
function mmFiltroDefinir(f) { mmFiltro = mmFiltro === f ? "" : (f || ""); matMapaPintar(); return mmFiltro; }
/* os caminhos que passam no filtro e os de cima deles */
function mmVisiveis(arv, filtro) {
  if (!filtro) return null;
  const res = mmResultados();
  const vis = new Set();
  const passa = (no) => (filtro === "esqueci" ? !!(res[no.caminho] && res[no.caminho].v === "n") : no.marcas.length > 0);
  const ir = (no) => { let tem = !no.raiz && passa(no); no.filhos.forEach((f) => { if (ir(f)) tem = true; }); if (tem) vis.add(no.caminho); return tem; };
  ir(arv.raiz);
  return vis;
}
function mmContar(arv, pred) { let n = 0; const ir = (no) => { if (!no.raiz && pred(no)) n++; no.filhos.forEach(ir); }; ir(arv.raiz); return n; }
function mmLidosAtual() {
  try {
    if (typeof rlsSecoes !== "function" || typeof rlsMarcasDe !== "function" || !matAtual) return null;
    const secs = rlsSecoes(($("matTexto") || {}).value || "");
    const M = rlsMarcasDe(matAtual.chave);
    const out = new Set();
    secs.forEach((x) => { if (!x.vazia && rlsEstado(M[x.k], x.h) === "lida") out.add(mmNormTit(x.titulo)); });
    return out;
  } catch (e) { return null; }
}
let mmUltimo = null;            /* { chave, arvore } da última pintura */
/* (19.176.0) o mapa é do resumo INTEIRO: ele mesmo é o navegador dos ramos (a barra de ramos some no modo mapa) */
function mmChave() { return (typeof matAtual !== "undefined" && matAtual && matAtual.chave ? matAtual.chave : "") + (mmEhIa() ? "|ia" : "|*"); }
function mmArvoreAtual() {
  if (mmEhIa() && typeof mmIaArvore === "function") { const a = mmIaArvore(); if (a) return a; }
  const txt = ($("matTexto") || {}).value || "";
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
  res.textContent = t(arv.ia ? "mm_resumo_ia" : "mm_resumo", { r: arv.ramos, n: arv.nos });
  const b1 = document.createElement("button"); b1.type = "button"; b1.className = "btn-min"; b1.id = "btnMmAbrirTudo"; b1.textContent = t("mm_abrir_tudo");
  b1.onclick = () => mmTodos(chave, true);
  const b2 = document.createElement("button"); b2.type = "button"; b2.className = "btn-min"; b2.id = "btnMmSoRamos"; b2.textContent = t("mm_so_ramos");
  b2.onclick = () => mmTodos(chave, false);
  barra.append(res, b1, b2);
  /* (19.177.0) o mapa da IA: quando é ele que está à vista, a conferência dele logo no começo */
  if (arv.ia && arv.conf) {
    const c = arv.conf;
    const cf = document.createElement("span"); cf.className = "nota mm-ia-conf" + (c.fora || c.num ? " mm-ia-alerta" : ""); cf.id = "mmIaConfMapa";
    cf.textContent = t("mm_ia_conf_mapa", { d: typeof mmIaData === "function" ? mmIaData(arv.em) : "", ok: c.ok, n: c.total })
      + (c.fora ? " " + t("mmia_conf_fora", { n: c.fora }) : "") + (c.num ? " " + t("mmia_conf_num", { n: c.num }) : "");
    barra.append(cf);
  }
  /* (19.175.0) o treino: ligar, o placar, recomeçar e os não lembrados em cartões */
  const bt = document.createElement("button"); bt.type = "button"; bt.className = "btn-min" + (mmTreino ? " on" : ""); bt.id = "btnMmTreino";
  bt.textContent = t(mmTreino ? "mm_treino_sair" : "mm_treino"); bt.title = t("mm_treino_tip");
  bt.setAttribute("aria-pressed", mmTreino ? "true" : "false");
  bt.onclick = () => mmTreinoAlternar();
  barra.append(bt);
  const resT = mmResultados();
  const vals = Object.keys(resT).map((k) => resT[k] && resT[k].v);
  const nS = vals.filter((v) => v === "s").length, nN = vals.filter((v) => v === "n").length;
  if (mmTreino || nS || nN) {
    const pl = document.createElement("span"); pl.className = "nota mm-placar"; pl.id = "mmPlacar";
    pl.textContent = t("mm_placar", { s: nS, n: nN });
    barra.append(pl);
  }
  if (mmTreino && (nS || nN)) {
    const br = document.createElement("button"); br.type = "button"; br.className = "btn-min"; br.id = "btnMmRecomecar"; br.textContent = t("mm_recomecar");
    br.onclick = () => mmTreinoRecomecar();
    barra.append(br);
  }
  const esq = mmEsquecidos(arv).filter((x) => mmCartaoLinha(x.no, x.pai));
  if (esq.length) {
    const bc = document.createElement("button"); bc.type = "button"; bc.className = "btn-min"; bc.id = "btnMmCartoes";
    bc.textContent = t("mm_cartoes", { n: esq.length }); bc.title = t("mm_cartoes_tip");
    bc.onclick = () => mmVirarCartoes();
    barra.append(bc);
  }
  /* (19.176.0) vista e filtros, numa segunda linha: compacto, só grifados, só não lembrados */
  const vista = document.createElement("div");
  vista.className = "mm-barra mm-vista";
  /* (19.177.0) qual mapa: o do resumo (a estrutura do texto) ou o da IA (condensado); e o botão de pedir/refazer o da IA */
  const temIa = typeof mmIaGuardado === "function" && !!mmIaGuardado(typeof matAtual !== "undefined" && matAtual ? matAtual.chave : "");
  if (temIa) {
    [["texto", "btnMmFonteTexto", "mm_fonte_texto"], ["ia", "btnMmFonteIa", "mm_fonte_ia"]].forEach(([f, id, k]) => {
      const on = (arv.ia ? "ia" : "texto") === f;
      const b = document.createElement("button"); b.type = "button"; b.className = "btn-min mm-fonte" + (on ? " on" : ""); b.id = id;
      b.textContent = t(k); b.title = t(k + "_tip"); b.setAttribute("aria-pressed", on ? "true" : "false");
      b.onclick = () => mmFonteDefinir(f);
      vista.append(b);
    });
  }
  if (typeof mmIaAbrir === "function") {
    const bi = document.createElement("button"); bi.type = "button"; bi.className = "btn-min"; bi.id = "btnMmIa";
    bi.textContent = t(temIa ? "mm_ia_refazer" : "mm_ia_pedir"); bi.title = t("mm_ia_pedir_tip");
    bi.onclick = () => mmIaAbrir();
    vista.append(bi);
  }
  const bk = document.createElement("button"); bk.type = "button"; bk.className = "btn-min" + (mmCompacto ? " on" : ""); bk.id = "btnMmCompacto";
  bk.textContent = t("mm_compacto"); bk.title = t("mm_compacto_tip"); bk.setAttribute("aria-pressed", mmCompacto ? "true" : "false");
  bk.onclick = () => mmCompactoAlternar();
  vista.append(bk);
  const nG = mmContar(arv, (no) => no.marcas.length > 0);
  const nE = mmContar(arv, (no) => !!(resT[no.caminho] && resT[no.caminho].v === "n"));
  if (mmFiltro === "grifos" && !nG) mmFiltro = "";
  if (mmFiltro === "esqueci" && !nE) mmFiltro = "";
  [["grifos", "btnMmSoGrifos", "mm_f_grifos", nG], ["esqueci", "btnMmSoEsqueci", "mm_f_esqueci", nE]].forEach(([f, id, k, q]) => {
    if (!q) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn-min" + (mmFiltro === f ? " on" : ""); b.id = id;
    b.textContent = t(k, { n: q }); b.title = t(k + "_tip"); b.setAttribute("aria-pressed", mmFiltro === f ? "true" : "false");
    b.onclick = () => mmFiltroDefinir(f);
    vista.append(b);
  });
  box.append(barra, vista);
  if (!arv.nos) {
    const p = document.createElement("p"); p.className = "nota"; p.id = "mmVazio"; p.textContent = t("mm_vazio"); box.append(p);
    return arv;
  }
  mmLidos = mmLidosAtual();
  mmVis = mmVisiveis(arv, mmFiltro);
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
  /* (19.176.0) no modo mapa a barra de ramos e a dica de seleção saem: o mapa é o navegador dos ramos */
  const dlg = $("dlgMaterial");
  if (dlg && dlg.classList) dlg.classList.toggle("mm-on", matMapaOn);
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
  /* o mapa é do resumo inteiro: a leitura volta para "Tudo", onde a linha do galho é a mesma */
  try { if (typeof matEscopo !== "undefined" && matEscopo !== "*" && typeof matEscopoEscolher === "function") matEscopoEscolher("*"); } catch (e) {}
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
