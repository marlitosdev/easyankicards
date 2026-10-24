/* =====================================================================
 * SEÇÕES JÁ LIDAS DO RESUMO (v19.11.0)
 *
 * O PEDIDO: "uma marcação para lembrar o que já li, principalmente para saber qual seção do resumo ainda não foi
 * lida". O "onde parei" (v18.74.0) guarda UM lugar por ramo — serve para continuar, não para saber o que falta: quem
 * lê fora de ordem (pula para a seção que caiu na prova) perde a conta.
 *
 * A SEÇÃO É O TÍTULO (# a ######) e o texto até o próximo título. Ao lado de cada título, na leitura:
 *  ○ não lida · ✓ lida (com a data) · ↻ lida, mas o texto MUDOU depois (vale reler);
 * um título que só agrupa (o do ramo, logo seguido de subtítulos) mostra "2/3" das seções de baixo. No topo,
 * "Seções lidas: 3 de 7 · próxima não lida: «…» ↓".
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
/* desenha os marcadores ao lado dos títulos e a faixa do topo (depois do matParaHtml) */
function rlsPintar(painel) {
  const p = painel || (typeof $ === "function" ? $("matLeitura") : null);
  if (!p || !p.querySelectorAll) return 0;
  const cx = rlsContexto();
  Array.from(p.querySelectorAll(".rls-faixa")).forEach((x) => { if (x.parentNode) x.parentNode.removeChild(x); });
  if (!cx || !cx.secoes.length) return 0;
  const marcas = rlsMarcasDe(cx.chave);
  const porLinha = {};
  cx.secoes.forEach((s) => { porLinha[s.l] = s; });
  const naTela = [];
  Array.from(p.querySelectorAll("h3, h4")).forEach((h) => {
    const dl = h.getAttribute ? h.getAttribute("data-l") : null;
    if (dl === null || dl === undefined || dl === "") return;
    const s = porLinha[cx.base + Number(dl)];
    if (!s) return;
    Array.from(h.querySelectorAll(".rls-bt")).forEach((x) => h.removeChild(x));
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rls-bt";
    if (s.vazia) {
      /* o título que só agrupa: o placar das de baixo, sem botão de marcar */
      const nL = s.filhas.filter((k) => { const f = cx.secoes.find((y) => y.k === k); return f && rlsEstado(marcas[k], f.h) === "lida"; }).length;
      if (!s.filhas.length) return;
      b.className += " rls-grupo" + (nL === s.filhas.length ? " lida" : "");
      b.textContent = (nL === s.filhas.length ? "✓ " : "") + nL + "/" + s.filhas.length;
      b.title = t("rls_grupo_tip", { n: nL, t: s.filhas.length });
      b.disabled = true;
    } else {
      const e = rlsEstado(marcas[s.k], s.h);
      b.className += " " + e;
      b.textContent = e === "lida" ? "✓" : e === "mudou" ? "↻" : "○";
      b.title = e === "lida" ? t("rls_lida_tip", { d: rlsDataBr(marcas[s.k].em) }) : e === "mudou" ? t("rls_mudou_tip", { d: rlsDataBr(marcas[s.k].em) }) : t("rls_nao_tip");
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", e === "lida" ? "true" : "false");
      b.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        rlsMarcar(cx.chave, s, e !== "lida");
        try { reg("MATERIAL", e !== "lida" ? "seção marcada como lida" : "seção desmarcada", s.titulo); } catch (x) {}
        rlsPintar(p);
      };
      naTela.push(s);
    }
    h.appendChild(b);
  });
  /* a faixa do topo: o que falta NO QUE ESTÁ NA TELA (o escopo), e o atalho para a próxima */
  if (naTela.length) {
    const r = rlsResumo(naTela, marcas);
    const f = document.createElement("div");
    f.className = "rls-faixa" + (r.lidas === r.total ? " completa" : "");
    const tx = document.createElement("span");
    tx.textContent = r.lidas === r.total ? t("rls_todas", { n: r.total }) : t("rls_placar", { l: r.lidas, n: r.total }) + (r.mudou ? " · " + t("rls_mudaram", { n: r.mudou }) : "");
    f.append(tx);
    if (r.proxima) {
      const ir = document.createElement("button");
      ir.type = "button";
      ir.className = "btn-min rls-ir";
      ir.textContent = t("rls_proxima", { s: r.proxima.titulo.length > 48 ? r.proxima.titulo.slice(0, 47) + "…" : r.proxima.titulo });
      ir.title = t("rls_proxima_tip");
      ir.onclick = () => {
        const alvo = Array.from(p.querySelectorAll("h3, h4")).filter((h) => cx.base + Number(h.getAttribute("data-l")) === r.proxima.l)[0];
        if (!alvo) return;
        /* a mesma rolagem do "onde parei" (conta a escala da leitura); scrollIntoView não movia este painel */
        if (typeof matRolAplicar === "function") matRolAplicar(p, { l: Number(alvo.getAttribute("data-l")), d: 0 });
        else if (alvo.scrollIntoView) alvo.scrollIntoView({ block: "start" });
      };
      f.append(" ", ir);
    }
    p.insertBefore(f, p.firstChild);
  }
  return naTela.length;
}
