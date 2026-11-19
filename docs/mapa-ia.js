/* =====================================================================
 * (19.177.0) 🤖 O MAPA DA IA — fase 4: o resumo condensado em palavras-chave, guardado com ele
 *
 * O mapa "do resumo" (mapa-mental.js) é a estrutura do texto: não inventa, mas também não condensa — um resumo longo
 * vira um mapa longo. O mapa da IA é o mesmo assunto em poucas palavras-chave. Para não trocar a confiança do mapa
 * do texto pela comodidade da IA:
 *  · a IA responde com uma LISTA RECUADA ("- **Termo** — detalhe"), o formato que o próprio mapa já lê (nada de JSON);
 *  · cada galho é CONFERIDO no texto do resumo a cada abertura: o que não se acha fica marcado "⚠ não está no resumo",
 *    e o número (prazo, percentual, artigo) que não aparece no resumo também — é onde a IA costuma inventar;
 *  · tocar num galho conferido leva à linha do resumo de onde ele saiu, e as SUAS marcas daquela linha aparecem nele;
 *  · os dois mapas convivem: "📄 do resumo" × "🤖 da IA" na barra; o treino e os recolhidos de cada um são separados;
 *  · o mapa fica no registro do resumo (campo mapaIA): vai no backup e some junto se o resumo for apagado;
 *  · o caminho é o de sempre: copiar o pedido e colar a resposta; com a IA direta ligada, o "Perguntar ao Gemini"
 *    cai na mesma caixa, e a conferência vem antes de gravar.
 * ===================================================================== */
const MM_FONTE_CH = "eac_mm_fonte";               /* conveniência do aparelho: qual mapa abre ("texto" | "ia") */
const MMIA_MAX = 60000;                           /* o resumo vai inteiro até aqui; passou, vai cortado (e a tela avisa) */
let mmFonte = (() => { try { return localStorage.getItem(MM_FONTE_CH) === "ia" ? "ia" : "texto"; } catch (e) { return "texto"; } })();
/* palavras que não identificam galho nenhum (não contam na conferência) */
const MMIA_VAZIAS = new Set(("a o as os um uma uns umas de da do das dos em na no nas nos por pela pelo pelas pelos para pra com sem "
  + "e ou que se nao sim mais menos muito sua seu suas seus ser sao esta este isso isto como quando onde qual quais ate sobre entre "
  + "the of and or to in on for with is are").split(" "));

function mmIaNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function mmIaChaveAtual() { return typeof matAtual !== "undefined" && matAtual && matAtual.chave ? matAtual.chave : ""; }
function mmIaGuardado(chave) {
  const r = chave && typeof matObter === "function" ? matObter(chave) : null;
  return r && r.mapaIA && String(r.mapaIA.texto || "").trim() ? r.mapaIA : null;
}
/* qual mapa está à vista: o da IA só quando este resumo tem um */
function mmFonteAtual() { return mmFonte === "ia" && mmIaGuardado(mmIaChaveAtual()) ? "ia" : "texto"; }
function mmFonteDefinir(f) {
  mmFonte = f === "ia" ? "ia" : "texto";
  try { localStorage.setItem(MM_FONTE_CH, mmFonte); } catch (e) {}
  try { if (typeof mmRevelados !== "undefined") mmRevelados = {}; } catch (e) {}
  if (typeof matMapaPintar === "function") matMapaPintar();
  return mmFonteAtual();
}

/* O PEDIDO. O texto vai sem os sinais das marcas ("==…=="), que só atrapalhariam a IA */
function mmIaTextoLimpo(txt) { return String(txt || "").replace(/==(?:[!?§~@]|\*(?!\*))?((?:[^=\n]|=(?!=))+)==/g, "$1").trim(); }
function mmIaPedido(texto, titulo) {
  const corpo = mmIaTextoLimpo(texto);
  return t("mmia_p", { t: titulo || "" }) + "\n\n\"\"\"\n" + corpo.slice(0, MMIA_MAX) + "\n\"\"\"";
}

/* A RESPOSTA: ficam só as linhas de lista (e títulos, se a IA usar); cerca de código, introdução e fecho saem */
function mmIaLimparResposta(resp) {
  const out = [];
  String(resp || "").replace(/\r/g, "").split("\n").forEach((l) => {
    const s = l.replace(/\s+$/, "");
    if (/^\s*```/.test(s)) return;
    if (/^\s*([-*+•]|\d+[.)])\s+\S/.test(s)) { out.push(s.replace(/^(\s*)[+•]\s+/, "$1- ")); return; }
    if (/^#{1,6}\s+\S/.test(s.trim())) out.push(s.trim());
  });
  return out.join("\n");
}

/* ONDE O GALHO ESTÁ NO RESUMO: o nome inteiro numa linha; senão, a linha com mais palavras dele (≥ 60%); senão, todas
 * as palavras em algum lugar do texto. Plural e gênero passam (a palavra longa vale pelo começo). */
function mmIaLinhas(texto) {
  return String(texto || "").split("\n").map((l) => " " + mmIaNorm(typeof mmLimpar === "function" ? mmLimpar(l) : l) + " ");
}
function mmIaAchar(label, L) {
  const alvo = mmIaNorm(String(label || "").replace(/…$/, ""));
  if (!alvo) return { ok: false, linha: -1 };
  for (let i = 0; i < L.length; i++) if (L[i].indexOf(" " + alvo + " ") >= 0) return { ok: true, linha: i };
  const pal = alvo.split(" ").filter((w) => w.length >= 3 && !MMIA_VAZIAS.has(w));
  if (!pal.length) return { ok: false, linha: -1 };
  const tem = (x, w) => x.indexOf(" " + w + " ") >= 0 || (w.length >= 6 && x.indexOf(" " + w.slice(0, w.length - 2)) >= 0);
  let melhor = -1, nota = 0;
  L.forEach((x, i) => {
    let n = 0;
    pal.forEach((w) => { if (tem(x, w)) n++; });
    const q = n / pal.length;
    if (q > nota) { nota = q; melhor = i; }
  });
  if (nota >= 0.6 && (pal.length > 1 || nota === 1)) return { ok: true, linha: melhor };
  const tudo = L.join(" ");
  if (pal.every((w) => tem(tudo, w))) return { ok: true, linha: melhor };
  return { ok: false, linha: nota >= 0.5 ? melhor : -1 };
}
/* os números de um galho (prazo, percentual, artigo, ano) */
function mmIaNumeros(s) { return (mmIaNorm(s).match(/\b\d+\b/g) || []).filter((x, i, a) => a.indexOf(x) === i); }

/* A ÁRVORE DA IA, CONFERIDA: cada galho ganha a linha do resumo de onde saiu (e as marcas dela), ou o aviso */
function mmIaMontar(resp, resumoTexto, titulo) {
  const limpo = mmIaLimparResposta(resp);
  const arv = mmMontar(limpo, { titulo: titulo || "", corNaLista: true });
  arv.ramos = arv.raiz.filhos.length;
  const linhas = String(resumoTexto || "").split("\n");
  const L = mmIaLinhas(resumoTexto);
  const tudo = L.join(" ");
  const conf = { ok: 0, fora: 0, num: 0, total: 0, foraNomes: [] };
  const ir = (no) => {
    if (!no.raiz) {
      conf.total++;
      const r = mmIaAchar(no.label, L);
      no.linha = r.linha;
      no.marcas = r.ok && r.linha >= 0 && typeof mmMarcasDe === "function" ? mmMarcasDe(linhas[r.linha]) : [];
      if (r.ok) { no.conferido = true; conf.ok++; } else { no.foraDoResumo = true; conf.fora++; conf.foraNomes.push(no.label); }
      const nums = mmIaNumeros(no.label + " " + no.det).filter((x) => tudo.indexOf(" " + x + " ") < 0);
      if (nums.length) { no.numFora = nums; conf.num++; if (r.ok) conf.foraNomes.push(no.label + " (" + nums.join(", ") + ")"); }
    }
    no.filhos.forEach(ir);
  };
  ir(arv.raiz);
  arv.conf = conf;
  arv.ia = true;
  return arv;
}
/* o mapa da IA do resumo aberto, conferido contra o texto de agora (editou o resumo, a conferência já é outra) */
function mmIaArvore() {
  const chave = mmIaChaveAtual();
  const g = mmIaGuardado(chave);
  if (!g) return null;
  const titulo = (matAtual && (matAtual.topico || matAtual.nome)) || "";
  const arv = mmIaMontar(g.texto, ($("matTexto") || {}).value || "", titulo);
  arv.em = g.em || "";
  return arv;
}

/* GUARDAR E APAGAR: no registro do resumo, como a impressão da fonte (cobertura-fonte.js) */
function mmIaGravar(chave, resp) {
  const texto = mmIaLimparResposta(resp);
  if (!texto || !chave || typeof matResumos === "undefined" || !matResumos[chave]) return null;
  matResumos[chave] = Object.assign({}, matResumos[chave], { mapaIA: { texto, em: new Date().toISOString() }, tocado: new Date().toISOString() });
  try { matSalvar(chave); } catch (e) {}
  return matResumos[chave].mapaIA;
}
function mmIaApagar(chave) {
  if (!chave || typeof matResumos === "undefined" || !matResumos[chave] || !matResumos[chave].mapaIA) return false;
  matResumos[chave] = Object.assign({}, matResumos[chave], { tocado: new Date().toISOString() });
  delete matResumos[chave].mapaIA;
  try { matSalvar(chave); } catch (e) {}
  /* o treino e os recolhidos do mapa apagado saem junto */
  try { const m = mmTreinoLer(); if (m[chave + "|ia"]) { delete m[chave + "|ia"]; mmTreinoGravar(m); } } catch (e) {}
  try { const m = mmLerRecolhidos(); if (m[chave + "|ia"]) { delete m[chave + "|ia"]; mmGravarRecolhidos(m); } } catch (e) {}
  return true;
}

/* ---------------- a tela: copiar o pedido, colar a resposta, conferir, usar ---------------- */
function mmIaPedidoAtual() {
  const titulo = (matAtual && (matAtual.topico || matAtual.nome)) || "";
  return mmIaPedido(($("matTexto") || {}).value || "", titulo);
}
function mmIaAbrir() {
  const chave = mmIaChaveAtual();
  if (!chave) return false;
  const g = mmIaGuardado(chave);
  const resp = $("mmIaResp");
  if (resp) resp.value = "";
  const msg = $("mmIaCopiadoMsg");
  if (msg) msg.textContent = "";
  const aviso = $("mmIaAviso");
  const tam = mmIaTextoLimpo(($("matTexto") || {}).value || "").length;
  if (aviso) {
    const partes = [];
    if (g) partes.push(t("mmia_ja_tem", { d: mmIaData(g.em) }));
    if (tam > MMIA_MAX) partes.push(t("mmia_cortado", { n: MMIA_MAX }));
    aviso.textContent = partes.join(" ");
    aviso.hidden = !partes.length;
  }
  const bA = $("btnMmIaApagar");
  if (bA) bA.hidden = !g;
  if (typeof jurIaMontar === "function") {
    jurIaMontar("mmIaGemini", { id: "mmIaGm", pedido: () => mmIaPedidoAtual(), destino: "mmIaResp", rotulo: "mapa do resumo", modulo: "MAPA" });
  }
  mmIaConferirTela();
  try { matReg("ler", "mapa da IA: aberto", chave); } catch (e) {}
  if (typeof abrirModal === "function") abrirModal("dlgMmIa");
  return true;
}
function mmIaFechar() {
  const d = typeof document !== "undefined" ? document.getElementById("dlgMmIa") : null;
  if (d && d.open && d.close) d.close();
}
/* a data no fuso de quem estuda (o ISO gravado é UTC: à noite já seria "amanhã") */
function mmIaData(iso) {
  const d = new Date(iso || "");
  if (isNaN(d.getTime())) return "";
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}
function mmIaCopiar() {
  const txt = mmIaPedidoAtual();
  const msg = $("mmIaCopiadoMsg");
  const ok = () => { if (msg) msg.textContent = t("mmia_copiado"); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(ok, ok);
  } catch (e) {}
  ok();
  return Promise.resolve();
}
/* a conferência, a cada mudança da caixa: quantos galhos, quantos achados no resumo, quais não */
function mmIaConferirTela() {
  const resp = ($("mmIaResp") || {}).value || "";
  const box = $("mmIaConf"), lst = $("mmIaForaLista"), bU = $("btnMmIaUsar");
  if (lst) lst.innerHTML = "";
  let arv = null;
  if (resp.trim()) {
    const titulo = (matAtual && (matAtual.topico || matAtual.nome)) || "";
    arv = mmIaMontar(resp, ($("matTexto") || {}).value || "", titulo);
  }
  const pode = !!(arv && arv.nos >= 3);
  if (box) {
    box.className = "nota mmia-conf" + (arv && !pode ? " mmia-ruim" : "");
    if (!resp.trim()) box.textContent = t("mmia_conf_vazio");
    else if (!pode) box.textContent = t("mmia_conf_sem_lista");
    else {
      const c = arv.conf;
      box.textContent = t("mmia_conf", { n: arv.nos, r: arv.ramos, ok: c.ok })
        + (c.fora ? " " + t("mmia_conf_fora", { n: c.fora }) : "") + (c.num ? " " + t("mmia_conf_num", { n: c.num }) : "")
        + (!c.fora && !c.num ? " " + t("mmia_conf_tudo") : "");
    }
  }
  if (lst && pode) {
    arv.conf.foraNomes.slice(0, 15).forEach((nome) => { const li = document.createElement("li"); li.textContent = nome; lst.append(li); });
    if (arv.conf.foraNomes.length > 15) { const li = document.createElement("li"); li.textContent = t("mmia_e_mais", { n: arv.conf.foraNomes.length - 15 }); lst.append(li); }
  }
  if (bU) bU.disabled = !pode;
  return arv;
}
function mmIaUsar() {
  const chave = mmIaChaveAtual();
  const resp = ($("mmIaResp") || {}).value || "";
  const g = mmIaGravar(chave, resp);
  const box = $("mmIaConf");
  if (!g) { if (box) box.textContent = t("mmia_sem_resumo"); return null; }
  try { const m = mmTreinoLer(); if (m[chave + "|ia"]) { delete m[chave + "|ia"]; mmTreinoGravar(m); } } catch (e) {}
  try { const m = mmLerRecolhidos(); if (m[chave + "|ia"]) { delete m[chave + "|ia"]; mmGravarRecolhidos(m); } } catch (e) {}
  try { matReg("ler", "mapa da IA: guardado", chave + " · " + g.texto.split("\n").length + " linhas"); } catch (e) {}
  mmIaFechar();
  mmFonte = "ia";
  try { localStorage.setItem(MM_FONTE_CH, "ia"); } catch (e) {}
  if (typeof matMapaOn !== "undefined" && !matMapaOn && typeof matMapaAlternar === "function") matMapaAlternar(true);
  else if (typeof matMapaPintar === "function") matMapaPintar();
  return g;
}
function mmIaApagarTela() {
  const chave = mmIaChaveAtual();
  if (!mmIaGuardado(chave)) return false;
  if (typeof confirm === "function" && !confirm(t("mmia_apagar_conf"))) return false;
  mmIaApagar(chave);
  try { matReg("ler", "mapa da IA: apagado", chave); } catch (e) {}
  mmIaFechar();
  if (typeof matMapaPintar === "function") matMapaPintar();
  return true;
}
(function mmIaLigar() {
  try {
    if (typeof document === "undefined") return;
    const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
    on("btnMmIaCopiar", () => mmIaCopiar());
    on("btnMmIaUsar", () => mmIaUsar());
    on("btnMmIaFechar", () => mmIaFechar());
    on("btnMmIaApagar", () => mmIaApagarTela());
    const r = document.getElementById("mmIaResp");
    if (r) r.oninput = () => mmIaConferirTela();
  } catch (e) {}
})();
