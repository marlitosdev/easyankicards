/* =====================================================================
 * DECISÕES — o histórico permanente do que o app sugeriu tirar ou trocar, e do que a pessoa decidiu
 *
 * POR QUE EXISTE. Quando o app propõe excluir algo do seu texto (a limpeza da colagem, o artigo
 * repetido a manter, a redação nova de uma versão) ou quando você pede para apagar, a única coisa
 * que ficava era uma linha no registro: "escolhas confirmadas", com uma contagem. Não dava para
 * saber O QUE seria tirado, POR QUE o app sugeriu, o que você DECIDIU item a item, nem se a sugestão
 * estava errada. Sem isso não há como melhorar as regras — e é isso que este histórico guarda:
 *
 *   quando · versão do app · área · REGRA (nome estável, ex. "colagem.cabecalho") · lei · onde ·
 *   o motivo · o trecho proposto (as linhas que sairiam, por inteiro) · o risco · a decisão
 *   (aceitou / recusou / escolheu outra coisa / sem decisão) e por qual caminho (padrão, manual…).
 *
 * NÃO É O REGISTRO DO APP. O registro é uma janela rolante de eventos curtos (200 e 300 linhas): o
 * que é antigo sai. Este é próprio, guarda até ~2.000 decisões na íntegra e, quando passa disso,
 * DOBRA as mais velhas em contagens por regra (as taxas de recusa continuam valendo), em vez de
 * apagá-las. Fica só neste aparelho; "copiar" e "baixar" levam o histórico para quem for orientar
 * as regras. Cada registro aceita o seu julgamento — "sugestão certa" ou "sugestão errada", com
 * uma frase — que é o dado mais valioso para treinar.
 * ===================================================================== */
const DEC_CHAVE = "eac_decisoes";
const DEC_RESUMO_CHAVE = "eac_decisoes_resumo";
let decMax = 2000;             /* quantas decisões ficam na íntegra */
let decMaxChars = 500000;      /* e quantos caracteres, no máximo, no armazenamento */
let decLista = null;           /* o histórico (em memória, espelho do armazenamento) */
let decResumo = null;          /* as contagens por regra das decisões já dobradas */
let decSeq = 0;
let decFiltro = { area: "", decisao: "" };

const DEC_AREAS = ["colagem", "repetidos", "versao", "apagar"];
const DEC_DECISOES = ["aceitou", "recusou", "mudou", "escolheu", "sem_decisao"];

function decCarregar() {
  if (decLista) return;
  try { decLista = JSON.parse(localStorage.getItem(DEC_CHAVE) || "[]"); } catch (e) { decLista = []; }
  if (!Array.isArray(decLista)) decLista = [];
  try { decResumo = JSON.parse(localStorage.getItem(DEC_RESUMO_CHAVE) || "{}"); } catch (e) { decResumo = {}; }
  if (!decResumo || typeof decResumo !== "object" || Array.isArray(decResumo)) decResumo = {};
}

function decLer() { decCarregar(); return decLista; }

/* volta a ler do armazenamento (depois de restaurar um backup, por exemplo) */
function decRecarregar() { decLista = null; decResumo = null; decCarregar(); }

function decCortar(s, n) { return String(s == null ? "" : s).replace(/\s+$/, "").slice(0, n); }

/* O registro com todos os campos, e cada texto limitado: o histórico não pode crescer sem fim por
 * causa de UMA sugestão com mil linhas (o cabeçalho repetido a cada página de um PDF, por exemplo) */
function decNormalizar(r) {
  const p = r.proposta || {};
  return Object.assign({ id: "", q: "", v: "", area: "", regra: "", origem: "app", lei: "", ref: "",
    motivo: "", risco: "", decisao: "", via: "", escolha: "", feedback: "", nota: "" }, r, {
    motivo: decCortar(r.motivo, 300),
    lei: decCortar(r.lei, 120),
    ref: decCortar(r.ref, 80),
    proposta: {
      acao: decCortar(p.acao, 60),
      amostra: decCortar(p.amostra, 600),
      depois: decCortar(p.depois, 300),
      n: Number(p.n) || 0,
      linhas: (p.linhas || []).slice(0, 60).map((x) => ({ linha: x.linha, texto: decCortar(x.texto, 300) })),
      alertas: (p.alertas || []).slice(0, 8).map((x) => decCortar(x, 40)),
    },
  });
}

/* uma decisão que sai da lista inteira entra nas contagens da sua regra */
function decDobrar(r) {
  const s = decResumo[r.regra] = decResumo[r.regra]
    || { area: r.area, sug: 0, ace: 0, rec: 0, mud: 0, esc: 0, sem: 0, cer: 0, err: 0 };
  s.sug++;
  if (r.decisao === "aceitou") s.ace++;
  else if (r.decisao === "recusou") s.rec++;
  else if (r.decisao === "mudou") s.mud++;
  else if (r.decisao === "escolheu") s.esc++;
  else s.sem++;
  if (r.feedback === "certa") s.cer++;
  if (r.feedback === "errada") s.err++;
}

function decPodar() {
  while (decLista.length > decMax) decDobrar(decLista.shift());
  let tam = decLista.reduce((s, r) => s + JSON.stringify(r).length, 0);
  while (tam > decMaxChars && decLista.length > 1) {
    const r = decLista.shift();
    tam -= JSON.stringify(r).length;
    decDobrar(r);
  }
}

function decGravar() {
  const tenta = () => {
    localStorage.setItem(DEC_CHAVE, JSON.stringify(decLista));
    localStorage.setItem(DEC_RESUMO_CHAVE, JSON.stringify(decResumo));
  };
  try { tenta(); return true; } catch (e) {}
  /* armazenamento cheio: dobra um quarto do que é mais velho e tenta de novo, uma vez */
  try {
    const n = Math.max(1, Math.floor(decLista.length / 4));
    for (let i = 0; i < n && decLista.length > 1; i++) decDobrar(decLista.shift());
    tenta();
    return true;
  } catch (e) { return false; }
}

/* Registra várias decisões numa gravação só. Devolve os ids. */
function decRegistrarLote(regs) {
  decCarregar();
  const ids = [];
  (regs || []).forEach((r) => {
    const n = decNormalizar(r);
    n.id = "d" + Date.now().toString(36) + (decSeq++).toString(36) + Math.random().toString(36).slice(2, 5);
    n.q = new Date().toISOString();
    n.v = typeof VERSAO !== "undefined" ? VERSAO : "";
    decLista.push(n);
    ids.push(n.id);
  });
  if (!ids.length) return ids;
  decPodar();
  decGravar();
  return ids;
}

function decRegistrar(r) { return decRegistrarLote([r])[0]; }

/* "sugestão certa" / "sugestão errada" (feedback vazio = tirar o julgamento), com uma frase opcional */
function decMarcar(id, feedback, nota) {
  decCarregar();
  const r = decLista.filter((x) => x.id === id)[0];
  if (!r) return false;
  r.feedback = feedback === "certa" || feedback === "errada" ? feedback : "";
  if (nota !== undefined) r.nota = decCortar(nota, 300);
  else if (!r.feedback) r.nota = "";
  decGravar();
  return true;
}

/* O RISCO de tirar um texto. Linha que cita artigo, parágrafo, prazo, percentual ou valor pode ser
 * lei de verdade: remover isso por engano é o erro caro. Sem esses sinais, é ruído (cabeçalho de
 * página, número de página) e o risco é baixo. */
const DEC_RE_RISCO = /\bArt(?:igo)?s?\.?\s*\d|§|\bpar[áa]grafo\b|\b\d+\s*(?:dias|anos|meses|horas)\b|\d\s*%|R\$/i;
function decRiscoDoTexto(textos) {
  return (textos || []).some((x) => DEC_RE_RISCO.test(String(x))) ? "alto" : "baixo";
}

/* as contagens por regra: o que está na íntegra + o que já foi dobrado */
function decPorRegra() {
  decCarregar();
  const m = {};
  Object.keys(decResumo).forEach((k) => { m[k] = Object.assign({ regra: k }, decResumo[k]); });
  decLista.forEach((r) => {
    const s = m[r.regra] = m[r.regra]
      || { regra: r.regra, area: r.area, sug: 0, ace: 0, rec: 0, mud: 0, esc: 0, sem: 0, cer: 0, err: 0 };
    s.sug++;
    if (r.decisao === "aceitou") s.ace++;
    else if (r.decisao === "recusou") s.rec++;
    else if (r.decisao === "mudou") s.mud++;
    else if (r.decisao === "escolheu") s.esc++;
    else s.sem++;
    if (r.feedback === "certa") s.cer++;
    if (r.feedback === "errada") s.err++;
  });
  return Object.keys(m).map((k) => {
    const s = m[k];
    /* a taxa de RECUSA só conta quem decidiu entre aceitar e recusar: "escolheu" e "sem decisão" ficam de fora */
    const decididas = s.ace + s.rec + s.mud;
    return Object.assign(s, { decididas, taxaRecusa: decididas ? (s.rec + s.mud) / decididas : 0,
      revisar: decididas >= 5 && (s.rec + s.mud) / decididas >= 0.3 });
  }).sort((x, y) => y.sug - x.sug || (x.regra < y.regra ? -1 : 1));
}

/* O histórico em linhas de JSON (uma por linha): a primeira é o cabeçalho, com as estatísticas por regra */
function decExportar() {
  decCarregar();
  const cab = { tipo: "cabecalho", app: typeof VERSAO !== "undefined" ? VERSAO : "", gerado: new Date().toISOString(),
    registros: decLista.length, regras: decPorRegra() };
  return [JSON.stringify(cab)].concat(decLista.map((r) => JSON.stringify(Object.assign({ tipo: "decisao" }, r)))).join("\n") + "\n";
}

function decLimpar() {
  decLista = [];
  decResumo = {};
  decGravar();
}

/* ---------------------------------------------------------------------
 * A TELA
 * ------------------------------------------------------------------ */
function decTituloDaRegra(regra) {
  const s = String(regra || "");
  const k = /^colagem\./.test(s) ? "lei_pre_g_" + s.slice(8) : "dec_r_" + s.replace(/\./g, "_");
  const v = t(k);
  return v === k ? s : v;
}

function decDataCurta(iso) { return String(iso || "").slice(0, 16).replace("T", " "); }

function decRegraEl(s) {
  const el = document.createElement("div");
  el.className = "dec-regra" + (s.revisar ? " dec-regra-alerta" : "");
  const tit = document.createElement("span");
  tit.className = "dec-regra-tit";
  tit.textContent = decTituloDaRegra(s.regra);
  const num = document.createElement("span");
  num.className = "nota";
  num.textContent = t("dec_regra_linha", { s: s.sug, r: s.rec + s.mud, p: Math.round(s.taxaRecusa * 100) })
    + (s.err ? " · " + t("dec_regra_erradas", { n: s.err }) : "");
  el.append(tit, num);
  if (s.revisar) {
    const av = document.createElement("span");
    av.className = "dec-regra-aviso";
    av.textContent = t("dec_regra_alerta");
    el.append(av);
  }
  return el;
}

function decItemEl(r) {
  const it = document.createElement("div");
  it.className = "duv-item dec-item";
  const cab = document.createElement("div");
  cab.className = "duv-titulo";
  cab.textContent = decDataCurta(r.q) + " · " + decTituloDaRegra(r.regra);
  const bd = document.createElement("span");
  bd.className = "dec-badge dec-b-" + r.decisao;
  bd.textContent = t("dec_d_" + r.decisao);
  cab.append(" ", bd);
  if (r.risco) {
    const rk = document.createElement("span");
    rk.className = "dec-risco dec-risco-" + r.risco;
    rk.textContent = t("dec_risco_" + r.risco);
    cab.append(" ", rk);
  }
  it.append(cab);
  const onde = document.createElement("div");
  onde.className = "nota";
  onde.textContent = [r.lei, r.ref, r.origem === "pessoa" ? t("dec_origem_pessoa") : ""].filter(Boolean).join(" · ");
  it.append(onde);
  if (r.motivo) {
    const m = document.createElement("div");
    m.className = "nota";
    m.textContent = t("dec_porque") + " " + r.motivo;
    it.append(m);
  }
  const p = r.proposta || {};
  const det = document.createElement("details");
  det.className = "dec-prop";
  const sm = document.createElement("summary");
  sm.textContent = t("dec_ver_proposta");
  det.append(sm);
  const ac = document.createElement("div");
  ac.className = "nota";
  ac.textContent = [p.acao, p.n ? t("dec_n_itens", { n: p.n }) : "", r.escolha ? t("dec_escolheu", { e: r.escolha }) : ""].filter(Boolean).join(" · ");
  det.append(ac);
  if (p.amostra) { const a = document.createElement("div"); a.className = "dec-trecho"; a.textContent = p.amostra; det.append(a); }
  (p.linhas || []).forEach((x) => {
    const l = document.createElement("div");
    l.className = "dec-trecho";
    l.textContent = t("dec_linha", { l: x.linha }) + " " + x.texto;
    det.append(l);
  });
  if (p.depois) { const d = document.createElement("div"); d.className = "dec-trecho dec-depois"; d.textContent = "→ " + p.depois; det.append(d); }
  if ((p.alertas || []).length) { const a = document.createElement("div"); a.className = "nota"; a.textContent = t("dec_alertas") + " " + p.alertas.join(", "); det.append(a); }
  it.append(det);

  const acoes = document.createElement("div");
  acoes.className = "dec-acoes";
  const fb = (qual, chave) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min dec-fb dec-fb-" + qual + (r.feedback === qual ? " btn-min-ok" : "");
    b.textContent = t(chave);
    b.onclick = () => { decMarcar(r.id, r.feedback === qual ? "" : qual); decPintar(); };
    return b;
  };
  acoes.append(fb("certa", "dec_certa"), fb("errada", "dec_errada"));
  if (r.feedback === "errada") {
    const c = document.createElement("input");
    c.type = "text";
    c.className = "dec-nota mat-busca";
    c.placeholder = t("dec_nota_ph");
    c.value = r.nota || "";
    c.onchange = () => { decMarcar(r.id, "errada", c.value); };
    acoes.append(c);
  }
  it.append(acoes);
  return it;
}

function decPintar() {
  const cx = $("decLista");
  if (!cx) return;
  decCarregar();
  const st = decPorRegra();
  const tot = st.reduce((s, x) => s + x.sug, 0);
  const soma = (k) => st.reduce((s, x) => s + x[k], 0);
  $("decResumo").textContent = tot
    ? t("dec_resumo", { n: tot, a: soma("ace"), r: soma("rec"), m: soma("mud"), s: soma("sem"), e: soma("err") })
    : "";
  /* por regra */
  const rg = $("decRegras");
  rg.innerHTML = "";
  if (st.length) {
    const h = document.createElement("div");
    h.className = "lei-mapa-tit";
    h.textContent = t("dec_regras_tit");
    rg.append(h);
    st.forEach((s) => rg.append(decRegraEl(s)));
  }
  /* filtros */
  const fx = $("decFiltros");
  fx.innerHTML = "";
  [["area", ["", ].concat(DEC_AREAS), (v) => (v ? t("dec_area_" + v) : t("dec_f_todas"))],
   ["decisao", [""].concat(DEC_DECISOES), (v) => (v ? t("dec_d_" + v) : t("dec_d_todas"))]].forEach(([campo, valores, rot]) => {
    valores.forEach((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min" + (decFiltro[campo] === v ? " mat-ligado" : "");
      b.id = "btnDecF_" + campo + "_" + (v || "todas");
      b.textContent = rot(v);
      b.onclick = () => { decFiltro[campo] = v; decPintar(); };
      fx.append(b);
    });
  });
  /* a lista, do mais novo para o mais velho */
  cx.innerHTML = "";
  const todas = decLista.slice().reverse().filter((r) =>
    (!decFiltro.area || r.area === decFiltro.area) && (!decFiltro.decisao || r.decisao === decFiltro.decisao));
  if (!todas.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = t(tot ? "dec_vazio_filtro" : "dec_vazio");
    cx.append(p);
    return;
  }
  todas.slice(0, 100).forEach((r) => cx.append(decItemEl(r)));
  if (todas.length > 100) {
    const m = document.createElement("p");
    m.className = "nota";
    m.textContent = t("dec_mais", { n: todas.length - 100 });
    cx.append(m);
  }
}

function decAbrir() {
  if (!$("dlgDecisoes")) return false;
  decFiltro = { area: "", decisao: "" };
  decPintar();
  abrirModal("dlgDecisoes");
  return true;
}

function decCopiar() {
  const txt = decExportar();
  const ok = () => { try { toast("dec_copiado"); } catch (e) {} };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, () => { try { leiRelatorioMostrar(txt); } catch (e) {} });
      return txt;
    }
  } catch (e) {}
  try { leiRelatorioMostrar(txt); } catch (e) {}
  return txt;
}

function decBaixar() {
  const txt = decExportar();
  try { baixarArquivo(txt, "eac-decisoes-" + new Date().toISOString().slice(0, 10) + ".jsonl", "application/x-ndjson"); } catch (e) {}
  return txt;
}

/* APAGAR O HISTÓRICO É UMA EXCLUSÃO, e segue a mesma regra: mostra o que se perde */
async function decApagar() {
  decCarregar();
  const st = decPorRegra();
  const n = st.reduce((s, x) => s + x.sug, 0);
  if (!n) return false;
  const ok = await uiConfirm(t("dec_apagar_conf", { n, r: st.length, e: st.reduce((s, x) => s + x.err, 0) }));
  if (!ok) return false;
  decLimpar();
  decPintar();
  return true;
}

function decLigar() {
  const liga = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  liga("btnDecCopiar", () => decCopiar());
  liga("btnDecBaixar", () => decBaixar());
  liga("btnDecApagar", () => decApagar());
  liga("btnDecFechar", () => $("dlgDecisoes").close());
  liga("btnDecX", () => $("dlgDecisoes").close());
  liga("btnLeiLogDecisoes", () => decAbrir());
  liga("btnLeiBibDecisoes", () => decAbrir());
}
decLigar();
