/* =====================================================================
 * EDITAR UM PARÁGRAFO SÓ (v18.76.0)
 *
 * Para trocar uma palavra no meio de um resumo de 30 mil caracteres era
 * preciso ir ao modo editar, achar o trecho no texto cru (com as marcas à
 * mostra) e voltar a ler. Agora, lendo: o lápis ao lado do parágrafo (ou
 * "✎ parágrafo" na bolha da seleção, no celular) abre uma caixa NO LUGAR
 * dele, só com ele — mudar palavras, aumentar, diminuir, ou pedir à IA
 * (encurtar, ampliar, deixar mais claro, corrigir o português, instrução
 * livre) e colar a resposta para conferir antes de gravar.
 *
 * QUAL É O PARÁGRAFO: cada bloco da leitura leva a linha de origem
 * (data-l, v18.74.0) no texto do escopo; o escopo de um ramo é a seção dele
 * (com o título "## Ramo — X" desenhado na linha 0), e a linha vira a do
 * texto inteiro somando onde a seção começa. A dica de várias linhas é um
 * bloco só e é editada inteira. Título de ramo, divisória e questões não
 * se editam aqui (o título do ramo é o nome do ramo; a questão tem a tela
 * dela). Antes de gravar, confere-se que as linhas ainda são as mesmas — se
 * o texto mudou por baixo, não grava em cima.
 * ===================================================================== */

/* o parágrafo aberto: { chave, ini, fim (linhas do texto inteiro), original, el (o bloco), caixa } */
let rpaEd = null;
let rpaAnterior = null;
const RPA_ACOES = ["encurtar", "ampliar", "clarear", "corrigir", "livre"];

/* ---------------- o motor (puro) ---------------- */
/* em que linha do texto inteiro começa o texto do escopo ("*" e "" = 0; ramo = a linha do título da seção) */
function rpaLinhaBase(tudo, escopo, ramos) {
  if (escopo === "*" || escopo === "" || escopo === undefined || escopo === null) return 0;
  const x = matSecoesDeRamo(String(tudo || ""), ramos || []).secoes.find((y) => y.id === escopo);
  if (!x) return null;
  return String(tudo).slice(0, x.corpoIni).split("\n").length - 2;
}
/* a dica de várias linhas é UM bloco ("> " seguidas, do mesmo tipo); o resto é uma linha */
function rpaExtensao(linhas, l) {
  const ehDica = (s) => /^>~?\s?/.test(String(s || "").trim()) && !/^>>/.test(String(s || "").trim());
  const tipo = (s) => /^>~/.test(String(s || "").trim());
  let f = l;
  if (ehDica(linhas[l])) while (f + 1 < linhas.length && ehDica(linhas[f + 1]) && tipo(linhas[f + 1]) === tipo(linhas[l])) f++;
  return [l, f];
}
/* o que se edita aqui: texto, título, item, número, dica — não o título do ramo, a divisória nem a questão */
function rpaPodeEditar(linha) {
  const s = String(linha || "").trim();
  if (!s || s === "\u0001MARCADOR\u0001") return false;
  if (MAT_RAMO_TIT_RE.test(s)) return false;
  if (/^-{3,}$/.test(s) || /^\?>/.test(s) || /^>>/.test(s)) return false;
  return true;
}
/* troca as linhas ini..fim do texto inteiro pelo texto novo (vazio = tira as linhas) */
function rpaTrocar(tudo, ini, fim, novo) {
  const L = String(tudo || "").split("\n");
  const n = String(novo || "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  const meio = n ? n.split("\n") : [];
  return L.slice(0, ini).concat(meio, L.slice(fim + 1)).join("\n");
}
/* O PEDIDO À IA. o = { disciplina, topico, ramo, antes, alvo, depois, acao, instrucao } */
function rpaPrompt(o) {
  const L = [];
  L.push(t("rpa_p_intro"));
  L.push(t("rpa_p_onde", { t: o.topico || "", d: o.disciplina || "" }) + (o.ramo ? " · " + t("rpa_p_ramo", { r: o.ramo }) : ""));
  L.push("");
  const acao = RPA_ACOES.indexOf(o.acao) >= 0 ? o.acao : "clarear";
  L.push(t("rpa_p_fazer") + " " + (acao === "livre" ? String(o.instrucao || "").trim() : t("rpa_p_" + acao)));
  L.push("");
  L.push(t("rpa_p_regras"));
  if (acao === "ampliar" || acao === "livre") L.push(t("rpa_p_varios"));
  if (String(o.antes || "").trim() || String(o.depois || "").trim()) {
    L.push("");
    L.push(t("rpa_p_contexto"));
    if (String(o.antes || "").trim()) L.push(t("rpa_p_antes") + " «" + String(o.antes).trim() + "»");
    if (String(o.depois || "").trim()) L.push(t("rpa_p_depois") + " «" + String(o.depois).trim() + "»");
  }
  L.push("");
  L.push(t("rpa_p_alvo"));
  L.push("<<<");
  L.push(String(o.alvo || "").trim());
  L.push(">>>");
  return L.join("\n");
}
/* A RESPOSTA: sem cerca de código, sem os <<< >>>, sem rótulo "Parágrafo:"; o próprio pedido colado de volta é recusado */
function rpaLerResposta(texto) {
  let s = String(texto || "").replace(/\r\n?/g, "\n").trim();
  if (!s) return { vazio: true, ehPedido: false, texto: "" };
  if (/PARÁGRAFO A REESCREVER|PARAGRAPH TO REWRITE/.test(s)) return { vazio: false, ehPedido: true, texto: "" };
  s = s.replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
  s = s.replace(/^<<<\s*\n?/, "").replace(/\n?>>>\s*$/, "").trim();
  s = s.replace(/^(parágrafo( novo| reescrito)?|paragraph( rewritten)?)\s*:\s*/i, "").trim();
  return { vazio: !s, ehPedido: false, texto: s };
}

/* ---------------- a tela ---------------- */
function rpaRamosDoAtual() { return (typeof matRamosDoAtual === "function" ? matRamosDoAtual() : []) || []; }
/* o bloco (com data-l) que contém um nó da leitura */
function rpaBlocoDe(no) {
  const p = $("matLeitura");
  for (let e = no; e && e !== p; e = e.parentNode) {
    if (e.getAttribute && e.getAttribute("data-l") !== null && e.getAttribute("data-l") !== undefined) return e;
  }
  return null;
}
/* as linhas do bloco no texto inteiro, ou null (com o motivo) */
function rpaAlvoDoBloco(el) {
  if (!matAtual || !el) return { erro: "rpa_sem_bloco" };
  const l = Number(el.getAttribute("data-l"));
  const tudo = $("matTexto").value || "";
  const esc = matEscopoAtual();
  const base = rpaLinhaBase(tudo, esc, rpaRamosDoAtual());
  const txtEsc = matTextoDoEscopo();
  if (base === null || txtEsc === null || !(l >= 0)) return { erro: "rpa_sem_bloco" };
  const linhasEsc = txtEsc.split("\n");
  if (!rpaPodeEditar(linhasEsc[l])) return { erro: MAT_RAMO_TIT_RE.test(String(linhasEsc[l] || "").trim()) ? "rpa_tit_ramo" : "rpa_nao_editavel" };
  const [a, b] = rpaExtensao(linhasEsc, l);
  const L = tudo.split("\n");
  const ini = base + a, fim = base + b;
  const original = L.slice(ini, fim + 1).join("\n");
  /* a linha do escopo tem de ser a do texto inteiro (senão a conta errou: não mexe em nada) */
  if (original !== linhasEsc.slice(a, b + 1).join("\n")) return { erro: "rpa_sem_bloco" };
  const vizinho = (de, passo) => {
    for (let k = de; k >= 0 && k < L.length; k += passo) {
      const s = L[k].trim();
      if (s && !MAT_RAMO_TIT_RE.test(s) && !/^-{3,}$/.test(s)) return s;
      if (MAT_RAMO_TIT_RE.test(s)) return "";
    }
    return "";
  };
  return { ini, fim, original, antes: vizinho(ini - 1, -1), depois: vizinho(fim + 1, 1) };
}
function rpaFecharCaixa() {
  if (!rpaEd) return;
  try { if (rpaEd.caixa && rpaEd.caixa.parentNode) rpaEd.caixa.parentNode.removeChild(rpaEd.caixa); } catch (e) {}
  try { if (rpaEd.el && rpaEd.el.style) rpaEd.el.style.display = ""; } catch (e) {}
  rpaEd = null;
}
function rpaCancelar() { rpaFecharCaixa(); return true; }

function rpaPintarConta() {
  if (!rpaEd) return;
  const ta = rpaEd.ta;
  const a = rpaEd.original.length, b = String(ta.value || "").replace(/\s+$/, "").length;
  const pct = a ? Math.round(((b - a) / a) * 100) : 0;
  rpaEd.conta.textContent = t("rpa_conta", { a, b, p: (pct > 0 ? "+" : "") + pct });
  const m0 = riaContarMarcas(rpaEd.original), m1 = riaContarMarcas(ta.value);
  const perde = Math.max(0, m0.marcas - m1.marcas);
  rpaEd.aviso.textContent = perde ? t("rpa_perde_marcas", { n: perde }) : "";
  rpaEd.aviso.hidden = !perde;
  rpaEd.salvar.disabled = String(ta.value || "").replace(/\s+$/, "") === rpaEd.original.replace(/\s+$/, "");
}

function rpaBotao(rot, cls, fn, tip) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = rot;
  if (tip) b.title = tip;
  b.onclick = fn;
  return b;
}

/* ABRIR: a caixa entra no lugar do bloco (que fica escondido até salvar/cancelar) */
function rpaAbrir(el) {
  if (!el) return false;
  if (rpaEd) rpaFecharCaixa();
  const alvo = rpaAlvoDoBloco(el);
  if (alvo.erro) { try { $("matEstado").textContent = t(alvo.erro); } catch (e) {} return false; }
  const cx = document.createElement("div");
  cx.className = "mat-par-ed";
  const cab = document.createElement("div");
  cab.className = "mat-par-cab";
  const tit = document.createElement("b");
  tit.textContent = t("rpa_tit");
  const sub = document.createElement("span");
  sub.className = "nota";
  sub.textContent = " " + t("rpa_sub");
  cab.append(tit, sub);
  const ta = document.createElement("textarea");
  ta.className = "mat-par-ta";
  ta.value = alvo.original;
  ta.rows = Math.min(14, Math.max(3, Math.ceil(alvo.original.length / 70) + 1));
  const conta = document.createElement("div");
  conta.className = "nota mat-par-conta";
  const aviso = document.createElement("div");
  aviso.className = "mat-par-aviso";
  aviso.hidden = true;
  const acoes = document.createElement("div");
  acoes.className = "mat-par-acoes";
  const salvar = rpaBotao(t("rpa_salvar"), "btn-min btn-min-ok", () => rpaSalvar(), t("rpa_salvar_tip"));
  const cancelar = rpaBotao(t("rpa_cancelar"), "btn-min", () => rpaCancelar());
  acoes.append(salvar, cancelar);
  /* a IA: um toque copia o pedido; a resposta volta numa caixa própria e só entra no parágrafo com "usar" */
  const ia = document.createElement("div");
  ia.className = "mat-par-ia";
  const iaRot = document.createElement("span");
  iaRot.className = "nota";
  iaRot.textContent = t("rpa_ia_rot");
  ia.append(iaRot);
  ["encurtar", "ampliar", "clarear", "corrigir"].forEach((ac) => ia.append(rpaBotao(t("rpa_ac_" + ac), "btn-min mat-par-ac", () => rpaPedir(ac), t("rpa_ac_" + ac + "_tip"))));
  const livre = document.createElement("input");
  livre.type = "text";
  livre.className = "mat-busca mat-par-livre";
  livre.placeholder = t("rpa_livre_ph");
  ia.append(livre, rpaBotao(t("rpa_ac_livre"), "btn-min mat-par-ac", () => rpaPedir("livre")));
  const resp = document.createElement("div");
  resp.className = "mat-par-resp";
  resp.hidden = true;
  const respMsg = document.createElement("div");
  respMsg.className = "nota mat-par-resp-msg";
  const respTa = document.createElement("textarea");
  respTa.className = "mat-par-ta mat-par-resp-ta";
  respTa.rows = 3;
  respTa.placeholder = t("rpa_resp_ph");
  const usar = rpaBotao(t("rpa_usar"), "btn-min btn-min-ok", () => rpaUsarResposta());
  resp.append(respMsg, respTa, usar);
  cx.append(cab, ta, conta, aviso, acoes, ia, resp);
  el.parentNode.insertBefore(cx, el);
  if (el.style) el.style.display = "none";
  /* o lápis sai de cena enquanto o parágrafo está aberto */
  try { const lp = $("matLeitura").querySelector(".mat-par-lapis"); if (lp) lp.hidden = true; } catch (e) {}
  rpaEd = { chave: matAtual.chave, ini: alvo.ini, fim: alvo.fim, original: alvo.original, antes: alvo.antes, depois: alvo.depois,
            el, caixa: cx, ta, conta, aviso, salvar, livre, resp, respMsg, respTa, usarBt: usar };
  ta.addEventListener("input", rpaPintarConta);
  respTa.addEventListener("input", rpaConferirResposta);
  /* Ctrl+Enter grava; Esc desiste SÓ do parágrafo (sem isto o Esc fecharia o resumo inteiro) */
  [ta, respTa, livre].forEach((x) => x.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); rpaCancelar(); }
    else if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey) && x === ta) { if (ev.preventDefault) ev.preventDefault(); rpaSalvar(); }
  }));
  rpaPintarConta();
  try { ta.focus(); } catch (e) {}
  try { if (cx.scrollIntoView) cx.scrollIntoView({ block: "nearest" }); } catch (e) {}
  try { matReg("paragrafo", "parágrafo aberto para editar", (matAtual.topico || "") + " · linhas " + (alvo.ini + 1) + "–" + (alvo.fim + 1)); } catch (e) {}
  return true;
}

function rpaPedido(acao) {
  if (!rpaEd) return "";
  const r = rpaRamosDoAtual().find((x) => x.id === matEscopoAtual());
  return rpaPrompt({ disciplina: matAtual.disciplina, topico: matAtual.topico, ramo: r ? r.nome : "",
    antes: rpaEd.antes, depois: rpaEd.depois, alvo: rpaEd.ta.value, acao, instrucao: rpaEd.livre.value });
}
function rpaPedir(acao) {
  if (!rpaEd) return false;
  if (acao === "livre" && !String(rpaEd.livre.value || "").trim()) {
    rpaEd.resp.hidden = false;
    rpaEd.respMsg.textContent = t("rpa_livre_vazio");
    try { rpaEd.livre.focus(); } catch (e) {}
    return false;
  }
  const txt = rpaPedido(acao);
  rpaEd.resp.hidden = false;
  rpaEd.respMsg.textContent = t("rpa_copiado");
  rpaConferirResposta();
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {}
  try { rpaEd.respTa.focus(); } catch (e) {}
  return txt;
}
function rpaConferirResposta() {
  if (!rpaEd) return null;
  const r = rpaLerResposta(rpaEd.respTa.value);
  rpaEd.usarBt.disabled = r.vazio || r.ehPedido;
  rpaEd.respTa.className = "mat-par-ta mat-par-resp-ta" + (r.ehPedido ? " ta-erro" : (!r.vazio ? " ta-ok" : ""));
  if (r.ehPedido) rpaEd.respMsg.textContent = t("rpa_resp_pedido");
  else if (!r.vazio) rpaEd.respMsg.textContent = t("rpa_resp_ok", { n: r.texto.length });
  return r;
}
/* a resposta vai para a caixa do parágrafo (ainda não grava: dá para conferir e mexer) */
function rpaUsarResposta() {
  if (!rpaEd) return false;
  const r = rpaLerResposta(rpaEd.respTa.value);
  if (r.vazio || r.ehPedido) return false;
  rpaEd.ta.value = r.texto;
  rpaEd.respTa.value = "";
  rpaEd.resp.hidden = true;
  rpaPintarConta();
  try { rpaEd.ta.focus(); } catch (e) {}
  return true;
}

/* GRAVAR: só se as linhas ainda forem as mesmas; o resumo inteiro é gravado (como o "Salvar") e a leitura volta no lugar */
async function rpaSalvar() {
  if (!rpaEd || !matAtual || matAtual.chave !== rpaEd.chave) return false;
  const novo = String(rpaEd.ta.value || "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  if (novo === rpaEd.original.replace(/\s+$/, "")) { rpaCancelar(); return false; }
  if (!novo.trim()) {
    const sim = await Promise.resolve(uiConfirm(t("rpa_apagar_conf")));
    if (!sim || !rpaEd) return false;
  }
  try { matSecaoSincronizar(); } catch (e) {}
  const tudo = $("matTexto").value || "";
  const L = tudo.split("\n");
  if (L.slice(rpaEd.ini, rpaEd.fim + 1).join("\n") !== rpaEd.original) {
    rpaEd.respMsg.textContent = "";
    rpaEd.aviso.hidden = false;
    rpaEd.aviso.textContent = t("rpa_mudou");
    return false;
  }
  const depois = rpaTrocar(tudo, rpaEd.ini, rpaEd.fim, novo);
  rpaAnterior = { chave: rpaEd.chave, texto: tudo };
  const info = (matAtual.topico || "") + " · linhas " + (rpaEd.ini + 1) + "–" + (rpaEd.fim + 1) + " · " + rpaEd.original.length + " → " + novo.length + " caracteres";
  rpaEd = null;
  $("matTexto").value = depois;
  matSalvarEstado();
  if (matModo === "ler") matTrocarModo("ler");
  try { matReg("paragrafo", novo.trim() ? "parágrafo editado" : "parágrafo apagado", info); } catch (e) {}
  rpaPintarDesfazer();
  return true;
}
/* "↶ desfazer" ao lado do "salvo" */
function rpaPintarDesfazer() {
  const est = $("matEstado");
  if (!est || !rpaAnterior) return;
  est.textContent = t("rpa_salvo") + " ";
  const b = rpaBotao(t("rpa_desfazer"), "btn-min mat-par-desfazer", () => rpaDesfazer());
  est.append(b);
}
function rpaDesfazer() {
  if (!rpaAnterior || !matAtual || matAtual.chave !== rpaAnterior.chave) return false;
  if (rpaEd) rpaFecharCaixa();
  $("matTexto").value = rpaAnterior.texto;
  rpaAnterior = null;
  matSalvarEstado();
  if (matModo === "ler") matTrocarModo("ler");
  try { $("matEstado").textContent = t("rpa_desfeito"); } catch (e) {}
  try { matReg("paragrafo", "edição do parágrafo desfeita", matAtual.topico || ""); } catch (e) {}
  return true;
}

/* O LÁPIS: um só, que acompanha o parágrafo sob o mouse (telas com mouse; no toque vale a bolha da seleção) */
function rpaLapis() {
  const p = $("matLeitura");
  if (!p) return null;
  let b = p.querySelector ? p.querySelector(".mat-par-lapis") : null;
  if (!b) {
    b = rpaBotao("✎", "mat-par-lapis", () => { if (b._alvo) rpaAbrir(b._alvo); }, t("rpa_lapis_tip"));
    b.hidden = true;
    if (b.setAttribute) b.setAttribute("aria-label", t("rpa_lapis_tip"));
    p.append(b);
  }
  return b;
}
function rpaAoPassar(ev) {
  if (matModo !== "ler" || rpaEd) return;
  const el = rpaBlocoDe(ev && ev.target);
  const b = rpaLapis();
  if (!b) return;
  if (!el || el === b) { if (ev && ev.target === b) return; b.hidden = true; return; }
  const l = Number(el.getAttribute("data-l"));
  const txtEsc = matTextoDoEscopo();
  if (txtEsc === null || !rpaPodeEditar(txtEsc.split("\n")[l])) { b.hidden = true; return; }
  b._alvo = el;
  b.hidden = false;
  if (b.style) { b.style.top = (el.offsetTop || 0) + "px"; b.style.left = Math.max(0, (el.offsetLeft || 0) - 30) + "px"; }
}
/* o botão da bolha: o parágrafo onde está a seleção */
function rpaDaSelecao() {
  let sel = null;
  try { sel = window.getSelection ? window.getSelection() : null; } catch (e) { sel = null; }
  const el = rpaBlocoDe(sel && sel.anchorNode);
  if (!el) { try { $("matEstado").textContent = t("rpa_sem_bloco"); } catch (e) {} return false; }
  try { sel.removeAllRanges(); } catch (e) {}
  try { $("matBolha").hidden = true; } catch (e) {}
  return rpaAbrir(el);
}

function rpaIniciar() {
  const p = $("matLeitura");
  if (p && p.addEventListener) p.addEventListener("mouseover", rpaAoPassar);
  if ($("btnBolhaPar")) {
    $("btnBolhaPar").onclick = rpaDaSelecao;
    if ($("btnBolhaPar").addEventListener) $("btnBolhaPar").addEventListener("mousedown", (ev) => ev.preventDefault());
  }
}

if (typeof document !== "undefined" && $("matLeitura")) rpaIniciar();
