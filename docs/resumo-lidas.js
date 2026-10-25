/* =====================================================================
 * SEÇÕES JÁ LIDAS DO RESUMO (v19.11.0)
 *
 * O PEDIDO: "uma marcação para lembrar o que já li, principalmente para saber qual seção do resumo ainda não foi
 * lida". O "onde parei" (v18.74.0) guarda UM lugar por ramo — serve para continuar, não para saber o que falta: quem
 * lê fora de ordem (pula para a seção que caiu na prova) perde a conta.
 *
 * A SEÇÃO É O TÍTULO (# a ######) e o texto até o próximo título. Estados: não lida · lida (com a data) · lida, mas o
 * texto MUDOU depois (vale reler). Como se mostra: ver "COMO SE MOSTRA (v19.14.0)", abaixo.
 *
 * QUEM É A SEÇÃO: o texto do título (sem marcas, sem acento) + a vez em que ele aparece no resumo ("Conceito" do ramo
 * A e "Conceito" do ramo B são duas). O "mudou" compara uma impressão do corpo SEM as marcas de estudo — grifar e
 * marcar dúvida não é mudar o texto. Mora em "eac_mat_lidas" ({tópico: {seção: {em, h}}}), pequeno, e vai no backup.
 * ===================================================================== */
const RLS_CHAVE = "eac_mat_lidas";
const RLS_TIT_RE = /^(#{1,6})\s+(.*)$/;

/* ---------------- o motor (puro) ---------------- */
function rlsSemMarcas(s) {
  return String(s == null ? "" : s).replace(/==[!?§*~@]?/g, "").replace(/\*\*|__/g, "");
}
function rlsNormal(s) {
  return rlsSemMarcas(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/^ramo\s*[—–:-]\s*/, "ramo ").replace(/[^a-z0-9]+/g, " ").trim();
}
/* impressão curta do corpo (djb2 em base 36): o que conta é o texto, não as marcas nem os espaços */
function rlsHash(s) {
  const x = rlsSemMarcas(s).replace(/\s+/g, " ").trim();
  let h = 5381;
  for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + "." + x.length.toString(36);
}
/* as seções do texto inteiro: [{l (linha do título), nivel, titulo, k (chave), corpo, h, vazia, filhas: [k…]}] */
function rlsSecoes(texto) {
  const L = String(texto || "").split(/\r?\n/);
  const tits = [];
  L.forEach((ln, i) => { const m = ln.trim().match(RLS_TIT_RE); if (m && m[2].trim()) tits.push({ l: i, nivel: m[1].length, titulo: rlsSemMarcas(m[2]).trim() }); });
  const vezes = {};
  const out = tits.map((x, n) => {
    const fim = n + 1 < tits.length ? tits[n + 1].l : L.length;
    const corpo = L.slice(x.l + 1, fim).join("\n");
    const base = rlsNormal(x.titulo) || "secao";
    vezes[base] = (vezes[base] || 0) + 1;
    return Object.assign({}, x, { k: base + "#" + vezes[base], corpo, h: rlsHash(corpo), vazia: !corpo.trim() });
  });
  /* as filhas de um título: as seções de baixo até o próximo título de mesmo nível ou acima */
  out.forEach((x, n) => {
    x.filhas = [];
    for (let m = n + 1; m < out.length && out[m].nivel > x.nivel; m++) if (!out[m].vazia) x.filhas.push(out[m].k);
  });
  return out;
}
/* "nao" | "lida" | "mudou" */
function rlsEstado(marca, h) {
  if (!marca) return "nao";
  return marca.h && h && marca.h !== h ? "mudou" : "lida";
}
/* o placar e a próxima não lida (na ordem do texto) — "mudou" conta como a ler */
function rlsResumo(secoes, marcas) {
  const M = marcas || {};
  const lendo = (secoes || []).filter((x) => !x.vazia);
  let lidas = 0, mudou = 0, proxima = null;
  lendo.forEach((x) => {
    const e = rlsEstado(M[x.k], x.h);
    if (e === "lida") lidas++;
    else { if (e === "mudou") mudou++; if (!proxima) proxima = x; }
  });
  return { total: lendo.length, lidas, mudou, proxima };
}

/* ---------------- guardado ---------------- */
function rlsLerTudo() {
  try { const o = JSON.parse(localStorage.getItem(RLS_CHAVE) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
function rlsGravarTudo(o) {
  try { localStorage.setItem(RLS_CHAVE, JSON.stringify(o || {})); return true; } catch (e) { return false; }
}
function rlsMarcasDe(chave) { return rlsLerTudo()[chave] || {}; }
function rlsMarcar(chave, sec, sim) {
  if (!chave || !sec) return false;
  const tudo = rlsLerTudo();
  const m = Object.assign({}, tudo[chave] || {});
  if (sim) m[sec.k] = { em: new Date().toISOString().slice(0, 10), h: sec.h };
  else delete m[sec.k];
  if (Object.keys(m).length) tudo[chave] = m; else delete tudo[chave];
  return rlsGravarTudo(tudo);
}

/* ---------------- a leitura ---------------- */
function rlsDataBr(iso) { const p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
/* o texto inteiro do resumo aberto e em que linha dele começa o que a leitura mostra */
function rlsContexto() {
  if (typeof matAtual === "undefined" || !matAtual || typeof $ !== "function" || !$("matTexto")) return null;
  const tudo = $("matTexto").value || "";
  let base = 0;
  try {
    if (typeof matEscopo !== "undefined" && matEscopo !== "*" && matEscopo !== "" && typeof rpaLinhaBase === "function") {
      base = rpaLinhaBase(tudo, matEscopo, typeof matRamosDoAtual === "function" ? matRamosDoAtual() : []);
      if (base === null) return null;
    }
  } catch (e) { base = 0; }
  return { chave: matAtual.chave, tudo, base, secoes: rlsSecoes(tudo) };
}
/* =====================================================================
 * COMO SE MOSTRA (v19.14.0)
 *
 * O RELATO: "o marcador está confuso; o usuário não entende o que se pretende fazer com ele, nem o que indica". Era um
 * "○" sem rótulo colado ao título — não dizia que era um botão, nem o que fazia, nem por quê; e a faixa "Seções lidas:
 * 0 de 1 · próxima não lida" apontava para a seção que já estava na tela. Agora, como nas plataformas de curso:
 *  · A AÇÃO MORA ONDE A LEITURA ACABA: no fim de cada seção, um botão com rótulo — "✓ Terminei de ler esta seção";
 *    depois, "✓ Lida em 24/10 · desmarcar"; se o texto mudou depois, "↻ … marcar como lida de novo";
 *  · O TÍTULO SÓ FALA QUANDO HÁ O QUE DIZER: "✓ lida" ou "↻ mudou" (não lida = sem marca nenhuma);
 *  · NO TOPO, UM SUMÁRIO DE LEITURA (recolhido): barra de progresso e "3 de 7 seções lidas"; aberto, a lista das seções
 *    (tocar leva até ela) e "→ Ir para a próxima não lida". Com UMA seção na tela, não há sumário.
 * ===================================================================== */
function rlsBotao(txt, cls, fn, tit) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-min " + (cls || "");
  b.textContent = txt;
  if (tit) { b.title = tit; b.setAttribute("aria-label", tit); }
  b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); fn(); };
  return b;
}
function rlsIrPara(p, cx, sec) {
  const alvo = Array.from(p.querySelectorAll("h3, h4")).filter((h) => cx.base + Number(h.getAttribute("data-l")) === sec.l)[0];
  if (!alvo) return false;
  /* a mesma rolagem do "onde parei" (conta a escala da leitura); scrollIntoView não movia este painel */
  if (typeof matRolAplicar === "function") matRolAplicar(p, { l: Number(alvo.getAttribute("data-l")), d: 0 });
  else if (alvo.scrollIntoView) alvo.scrollIntoView({ block: "start" });
  return true;
}
/* desenha as marcas dos títulos, o botão do fim de cada seção e o sumário (depois do matParaHtml) */
function rlsPintar(painel) {
  const p = painel || (typeof $ === "function" ? $("matLeitura") : null);
  if (!p || !p.querySelectorAll) return 0;
  const cx = rlsContexto();
  Array.from(p.querySelectorAll(".rls-sumario, .rls-fim, .rls-tag")).forEach((x) => { if (x.parentNode) x.parentNode.removeChild(x); });
  if (!cx || !cx.secoes.length) return 0;
  const marcas = rlsMarcasDe(cx.chave);
  const porLinha = {};
  cx.secoes.forEach((s) => { porLinha[s.l] = s; });
  const titulos = Array.from(p.querySelectorAll("h3, h4")).filter((h) => {
    const dl = h.getAttribute ? h.getAttribute("data-l") : null;
    return dl !== null && dl !== undefined && dl !== "" && porLinha[cx.base + Number(dl)];
  });
  const repintar = () => rlsPintar(p);
  const naTela = [];
  titulos.forEach((h, k) => {
    const s = porLinha[cx.base + Number(h.getAttribute("data-l"))];
    const tag = (txt, cls, tit) => { const x = document.createElement("span"); x.className = "rls-tag " + cls; x.textContent = txt; if (tit) x.title = tit; h.appendChild(x); };
    if (s.vazia) {
      /* o título que só agrupa: quantas das de baixo já foram lidas (texto, não botão) */
      const nL = s.filhas.filter((kf) => { const f = cx.secoes.find((y) => y.k === kf); return f && rlsEstado(marcas[kf], f.h) === "lida"; }).length;
      if (s.filhas.length && nL) tag(t("rls_tag_grupo", { n: nL, t: s.filhas.length }), nL === s.filhas.length ? "lida" : "", t("rls_grupo_tip", { n: nL, t: s.filhas.length }));
      return;
    }
    naTela.push(s);
    const e = rlsEstado(marcas[s.k], s.h);
    const d = marcas[s.k] ? rlsDataBr(marcas[s.k].em) : "";
    if (e === "lida") tag(t("rls_tag_lida"), "lida", t("rls_lida_tip", { d }));
    if (e === "mudou") tag(t("rls_tag_mudou"), "mudou", t("rls_mudou_tip", { d }));
    /* o fim da seção: logo antes do próximo título (ou no fim da leitura) */
    const fim = document.createElement("div");
    fim.className = "rls-fim " + e;
    const marcar = (sim) => () => {
      rlsMarcar(cx.chave, s, sim);
      try { reg("MATERIAL", sim ? "seção marcada como lida" : "seção desmarcada", s.titulo); } catch (x) {}
      repintar();
    };
    if (e === "nao") fim.append(rlsBotao(t("rls_fim_marcar"), "btn-min-ok rls-marcar", marcar(true), t("rls_fim_marcar_aj")));
    else if (e === "lida") {
      const tx = document.createElement("span"); tx.className = "rls-fim-txt"; tx.textContent = t("rls_fim_lida", { d });
      fim.append(tx, " ", rlsBotao(t("rls_fim_desmarcar"), "rls-desmarcar", marcar(false), t("rls_fim_desmarcar_aj")));
    } else {
      const tx = document.createElement("span"); tx.className = "rls-fim-txt"; tx.textContent = t("rls_fim_mudou", { d });
      fim.append(tx, " ", rlsBotao(t("rls_fim_reler"), "btn-min-ok rls-marcar", marcar(true), t("rls_fim_marcar_aj")));
    }
    let prox = null;
    for (let n = h.nextSibling; n; n = n.nextSibling) { if (n.tagName && /^H[3-4]$/i.test(n.tagName) && titulos.indexOf(n) > k) { prox = n; break; } }
    if (prox && prox.parentNode) prox.parentNode.insertBefore(fim, prox);
    else if (h.parentNode) h.parentNode.appendChild(fim);
  });
  /* o sumário: só com DUAS ou mais seções na tela (com uma, "próxima" seria ela mesma) */
  if (naTela.length >= 2) {
    const r = rlsResumo(naTela, marcas);
    const sum = document.createElement("details");
    sum.className = "rls-sumario" + (r.lidas === r.total ? " completa" : "");
    const sm = document.createElement("summary");
    const tit = document.createElement("span");
    tit.className = "rls-sum-tit";
    tit.textContent = r.lidas === r.total ? t("rls_sum_todas", { n: r.total }) : t("rls_sum", { l: r.lidas, n: r.total }) + (r.mudou ? t("rls_sum_mudaram", { n: r.mudou }) : "");
    const barra = document.createElement("span");
    barra.className = "rls-barra";
    const ench = document.createElement("span");
    ench.className = "rls-barra-ench";
    if (ench.style) ench.style.width = Math.round((r.lidas / r.total) * 100) + "%";
    barra.append(ench);
    sm.append(tit, barra);
    sum.append(sm);
    const exp = document.createElement("p");
    exp.className = "nota rls-sum-exp";
    exp.textContent = t("rls_sum_aj");
    sum.append(exp);
    if (r.proxima) sum.append(rlsBotao(t("rls_ir_proxima", { s: r.proxima.titulo.length > 48 ? r.proxima.titulo.slice(0, 47) + "…" : r.proxima.titulo }), "btn-min-ok rls-ir", () => rlsIrPara(p, cx, r.proxima), t("rls_proxima_tip")));
    const lista = document.createElement("div");
    lista.className = "rls-sum-lista";
    naTela.forEach((s) => {
      const e = rlsEstado(marcas[s.k], s.h);
      lista.append(rlsBotao((e === "lida" ? "✓ " : e === "mudou" ? "↻ " : "○ ") + s.titulo, "rls-sum-item " + e, () => rlsIrPara(p, cx, s), t("rls_sum_item_aj")));
    });
    sum.append(lista);
    p.insertBefore(sum, p.firstChild);
  }
  return naTela.length;
}
