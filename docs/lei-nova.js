/* =====================================================================
 * INCLUIR LEI EM 3 PASSOS (v19.2.0)
 *
 * O QUE ERA: "＋ Nova lei" abria o leitor no modo editar — abas, ferramentas, a caixa de colar e, no rodapé, a
 * fila das leis que alteram. Gravar disparava uma sequência de telas (limpeza da colagem, artigos repetidos, cada
 * lei que altera) sem nenhuma dizer em que ponto da inclusão a pessoa estava. Relato (22/10, LC 15/2009 de
 * Caruaru com 3 alteradoras): "a interface de inclusão ainda é confusa".
 *
 * O QUE É AGORA: um assistente com três passos e uma ação por passo —
 *   1. a lei PRINCIPAL (arquivo ou colar): o app diz o que reconheceu;
 *   2. as leis que ALTERAM (opcional, vários arquivos de uma vez): o app põe em ordem de data;
 *   3. conferir e criar: o resumo do que vai acontecer, e um botão.
 * Depois do botão, o MOTOR É O MESMO de sempre (leiGravar → limpeza → repetidos → criar → fila), e cada tela de
 * conferência ganha uma faixa no topo: "Incluindo LC 15/2009 — etapa 3 de 6", com ✓ feito · ▶ agora · ○ depois.
 * Nada é gravado antes das confirmações de sempre. O editor completo continua a um link.
 * ===================================================================== */
let leiNovaCtx = null;

const LEI_NOVA_ACCEPT = ".docx,.htm,.html,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function leiNovaAbrir() {
  if ($("dlgLeiBib") && $("dlgLeiBib").open) $("dlgLeiBib").close();
  leiNovaIniciarTela();   /* idempotente: os botões ficam ligados mesmo se a partida não ligou */
  leiNovaCtx = { passo: 1, texto: "", origem: "", tipo: "", riscados: 0, alts: [], faixa: null };
  ["leiNovaTexto", "leiNovaAltTexto"].forEach((id) => { if ($(id)) $(id).value = ""; });
  if ($("leiNovaColarCx")) $("leiNovaColarCx").hidden = true;
  if ($("leiNovaAltColarCx")) $("leiNovaAltColarCx").hidden = true;
  if ($("leiNovaMsg")) $("leiNovaMsg").textContent = "";
  leiNovaPintar();
  abrirModal("dlgLeiNova");
  try { leiReg("lei", "incluir lei: assistente aberto", ""); } catch (e) {}
  return true;
}

/* ---- passo 1: a lei principal ---- */
function leiNovaDefinirPrincipal(texto, origem, tipo, riscados) {
  const c = leiNovaCtx;
  const tx = String(texto || "").trim();
  if (!c || !tx) return false;
  c.texto = tx; c.origem = String(origem || ""); c.tipo = tipo || "colado"; c.riscados = riscados || 0;
  try { leiReg("lei", "incluir lei: lei principal " + (c.origem ? "lida de " + c.origem : "colada"),
    tx.length + " caracteres · " + leiArtigos(tx).length + " artigos"); } catch (e) {}
  leiNovaPintar();
  return true;
}
async function leiNovaArquivoPrincipal(file) {
  if (!file) return false;
  const lido = await leiLerArquivoLei(file);
  if (!lido) return false;
  return leiNovaDefinirPrincipal(lido.r.texto, file.name, lido.tipo, lido.r.n || 0);
}
/* o que o app reconheceu na principal: { nome, artigos, chars, ident, alteradora } */
function leiNovaAnalise(texto) {
  const tx = String(texto || "");
  const it = leiFilaItem(tx, "");
  const ident = typeof leiIdentificar === "function" ? leiIdentificar(tx) : null;
  return { nome: (ident && ident.nome) || (it.nome !== "?" ? it.nome : ""), artigos: leiArtigos(tx).length,
    chars: tx.length, alteradora: !!it.alteradora };
}

/* ---- passo 2: as leis que alteram ---- */
function leiNovaAdicionarAlt(texto, origem) {
  const c = leiNovaCtx;
  const tx = String(texto || "").trim();
  if (!c || !tx) return null;
  const item = leiFilaItem(tx, origem);
  c.alts = leiFilaOrdenar(leiFilaJuntar(c.alts, item));
  try { leiReg("lei", "incluir lei: lei que altera adicionada", item.nome + " · " + (item.dataLei || "sem data")
    + (item.alteradora ? "" : " · não parece alterar outra lei")); } catch (e) {}
  leiNovaPintar();
  return item;
}
async function leiNovaArquivosAlt(files) {
  let n = 0;
  for (const f of Array.from(files || [])) {
    const lido = await leiLerArquivoLei(f);
    if (lido && leiNovaAdicionarAlt(lido.r.texto, f.name)) n++;
  }
  return n;
}
function leiNovaTirarAlt(id) {
  const c = leiNovaCtx;
  if (!c) return false;
  c.alts = c.alts.filter((x) => x.id !== id);
  leiNovaPintar();
  return true;
}

/* ---- navegar ---- */
function leiNovaIr(passo) {
  const c = leiNovaCtx;
  if (!c) return false;
  if (passo > 1 && !c.texto) { $("leiNovaMsg").textContent = t("lei_nova_falta_principal"); return false; }
  c.passo = Math.max(1, Math.min(3, passo));
  $("leiNovaMsg").textContent = "";
  leiNovaPintar();
  return true;
}

/* ---- passo 3: criar, pelo motor de sempre ---- */
function leiNovaComecar() {
  const c = leiNovaCtx;
  if (!c || !c.texto) return false;
  const an = leiNovaAnalise(c.texto);
  c.faixa = { nome: an.nome || t("lei_nova_sem_nome"), etapa: "limpeza", alts: c.alts.map((x) => ({ id: x.id, nome: x.nome })) };
  $("dlgLeiNova").close();
  leiBibNovaEditor();
  leiAltFilaNovaDefinir(c.alts);
  $("leiTexto").value = c.texto;
  try {
    if (c.origem) leiFluxoEtapa("entrada", t("lei_fx_r_arquivo", { a: c.origem, x: "." + c.tipo, c: c.texto.length,
      l: c.texto.split("\n").length, n: c.riscados }), [t("lei_fx_d_comeco") + " " + c.texto.replace(/\s+/g, " ").slice(0, 200)]);
    c.alts.forEach((it) => leiFluxoEtapa("fila", t("lei_fx_r_fila_add", { n: it.nome, d: it.dataLei || "?", c: it.chars,
      o: it.origem || t("lei_fx_colado") }), it.alteradora ? [] : [t("lei_fx_d_nao_alteradora")]));
    leiReg("lei", "incluir lei: criar e conferir", c.faixa.nome + " · " + c.alts.length + " lei(s) que altera(m)");
  } catch (e) {}
  leiNovaFaixaPintar();
  return leiGravar();
}

/* ---- a faixa "em que ponto estou", nas telas de conferência ---- */
function leiNovaEtapas() {
  const f = leiNovaCtx && leiNovaCtx.faixa;
  if (!f) return [];
  return [{ id: "limpeza", nome: t("lei_nova_e_limpeza") }, { id: "repetidos", nome: t("lei_nova_e_repetidos") },
    { id: "criar", nome: t("lei_nova_e_criar") }].concat(f.alts.map((a) => ({ id: "alt:" + a.id, nome: a.nome })));
}
function leiNovaEtapa(id) {
  const f = leiNovaCtx && leiNovaCtx.faixa;
  if (!f) return false;
  f.etapa = id;
  leiNovaFaixaPintar();
  return true;
}
function leiNovaFim(motivo) {
  const f = leiNovaCtx && leiNovaCtx.faixa;
  if (!f) return false;
  try { leiReg("lei", "incluir lei: concluído", f.nome + " · " + (motivo || "")); } catch (e) {}
  leiNovaCtx = null;
  leiNovaFaixaPintar();
  return true;
}
function leiNovaFaixaTexto() {
  const f = leiNovaCtx && leiNovaCtx.faixa;
  if (!f) return null;
  const etapas = leiNovaEtapas();
  const i = Math.max(0, etapas.findIndex((e) => e.id === f.etapa));
  const pulados = (typeof leiAltFilaCtx !== "undefined" && leiAltFilaCtx && leiAltFilaCtx.pulados) || new Set();
  const chips = etapas.map((e, k) => {
    const pulou = e.id.indexOf("alt:") === 0 && pulados.has(e.id.slice(4));
    return { nome: e.nome, estado: k < i ? (pulou ? "pulada" : "feito") : k === i ? "agora" : "depois" };
  });
  return { titulo: t("lei_nova_faixa", { n: f.nome, a: i + 1, b: etapas.length, e: etapas[i].nome }), chips };
}
function leiNovaFaixaPintar() {
  const ft = leiNovaFaixaTexto();
  ["leiNovaFaixaPre", "leiNovaFaixaDup", "leiNovaFaixaUpd"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.hidden = !ft;
    el.innerHTML = "";
    if (!ft) return;
    const tit = document.createElement("div");
    tit.className = "lei-nova-faixa-tit";
    tit.textContent = ft.titulo;
    const lista = document.createElement("div");
    lista.className = "lei-nova-faixa-chips";
    ft.chips.forEach((c) => {
      const s = document.createElement("span");
      s.className = "lei-nova-chip " + c.estado;
      s.textContent = (c.estado === "feito" ? "✓ " : c.estado === "agora" ? "▶ " : c.estado === "pulada" ? "↷ " : "○ ") + c.nome;
      lista.append(s);
    });
    el.append(tit, lista);
  });
}

/* ---- a tela do assistente ---- */
function leiNovaPintar() {
  const c = leiNovaCtx;
  if (!c || !$("dlgLeiNova")) return;
  [1, 2, 3].forEach((p) => {
    const li = $("leiNovaP" + p);
    if (li) li.className = "lei-nova-passo" + (p === c.passo ? " atual" : p < c.passo ? " feito" : "");
    const s = $("leiNovaS" + p);
    if (s) s.hidden = p !== c.passo;
  });
  /* passo 1 */
  const card = $("leiNovaPrinc");
  card.hidden = !c.texto;
  card.innerHTML = "";
  if (c.texto) {
    const an = leiNovaAnalise(c.texto);
    const l1 = document.createElement("div");
    l1.className = "lei-nova-card-tit";
    l1.textContent = an.nome ? t("lei_nova_reconheci", { n: an.nome }) : t("lei_nova_nao_reconheci");
    const l2 = document.createElement("div");
    l2.className = "nota";
    l2.textContent = t("lei_nova_numeros", { a: an.artigos, c: Math.max(1, Math.round(an.chars / 1000)) })
      + (c.riscados ? " · " + t("lei_nova_riscados", { r: c.riscados }) : "")
      + (c.origem ? " · " + t("lei_nova_de", { o: c.origem }) : "");
    card.append(l1, l2);
    const avisos = [];
    if (!an.nome) avisos.push(t("lei_nova_aviso_nome"));
    if (!an.artigos) avisos.push(t("lei_nova_aviso_sem_artigos"));
    if (an.alteradora) avisos.push(t("lei_nova_aviso_alteradora"));
    avisos.forEach((a) => { const p = document.createElement("div"); p.className = "lei-nova-aviso"; p.textContent = "⚠ " + a; card.append(p); });
  }
  /* passo 2 */
  const ol = $("leiNovaAlts");
  ol.innerHTML = "";
  c.alts.forEach((x, i) => {
    const li = document.createElement("li");
    li.className = "lei-nova-alt" + (x.alteradora ? "" : " suspeita");
    li.id = "leiNovaAlt_" + i;
    const nome = document.createElement("span");
    nome.textContent = x.nome + " · " + (x.dataLei ? x.dataLei.split("-").reverse().join("/") : t("lei_altfila_sem_data"))
      + " · " + t("lei_altfila_chars", { c: Math.max(1, Math.round(x.chars / 1000)) })
      + (x.alteradora ? "" : " · ⚠ " + t("lei_altfila_suspeita"));
    nome.title = x.origem || "";
    const bx = document.createElement("button");
    bx.type = "button";
    bx.className = "btn-min";
    bx.id = "btnLeiNovaAltTirar_" + i;
    bx.textContent = "✕";
    bx.title = t("lei_altfila_tirar");
    bx.setAttribute("aria-label", t("lei_altfila_tirar") + " " + x.nome);
    bx.onclick = () => leiNovaTirarAlt(x.id);
    li.append(nome, bx);
    ol.append(li);
  });
  $("leiNovaAltsVazio").hidden = !!c.alts.length;
  /* passo 3 */
  const res = $("leiNovaResumo");
  res.innerHTML = "";
  if (c.passo === 3 && c.texto) {
    const an = leiNovaAnalise(c.texto);
    const p1 = document.createElement("div");
    p1.className = "lei-nova-card-tit";
    p1.textContent = t("lei_nova_vou_criar", { n: an.nome || t("lei_nova_sem_nome"), a: an.artigos });
    res.append(p1);
    const p2 = document.createElement("div");
    p2.className = "nota";
    p2.textContent = c.alts.length ? t("lei_nova_depois_aplico", { n: c.alts.length }) : t("lei_nova_sem_alts");
    res.append(p2);
    if (c.alts.length) {
      const o = document.createElement("ol");
      c.alts.forEach((x) => { const li = document.createElement("li"); li.textContent = x.nome + (x.dataLei ? " (" + x.dataLei.split("-").reverse().join("/") + ")" : ""); o.append(li); });
      res.append(o);
    }
  }
  /* rodapé */
  $("btnLeiNovaVoltar").hidden = c.passo === 1;
  $("btnLeiNovaAvancar").hidden = c.passo === 3;
  $("btnLeiNovaAvancar").disabled = c.passo === 1 && !c.texto;
  $("btnLeiNovaAvancar").textContent = t(c.passo === 2 && !c.alts.length ? "lei_nova_pular" : "lei_nova_avancar");
  $("btnLeiNovaCriar").hidden = c.passo !== 3;
}

function leiNovaIniciarTela() {
  const lig = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  lig("btnLeiNovaX", () => $("dlgLeiNova").close());
  lig("btnLeiNovaArq", () => $("leiNovaArq").click());
  lig("btnLeiNovaColar", () => { $("leiNovaColarCx").hidden = false; try { $("leiNovaTexto").focus(); } catch (e) {} });
  lig("btnLeiNovaColarOk", () => { if (leiNovaDefinirPrincipal($("leiNovaTexto").value, "", "colado", 0)) $("leiNovaColarCx").hidden = true; });
  lig("btnLeiNovaAltArq", () => $("leiNovaAltArq").click());
  lig("btnLeiNovaAltColar", () => { $("leiNovaAltColarCx").hidden = false; try { $("leiNovaAltTexto").focus(); } catch (e) {} });
  lig("btnLeiNovaAltColarOk", () => { if (leiNovaAdicionarAlt($("leiNovaAltTexto").value, "")) { $("leiNovaAltTexto").value = ""; $("leiNovaAltColarCx").hidden = true; } });
  lig("btnLeiNovaVoltar", () => leiNovaIr((leiNovaCtx ? leiNovaCtx.passo : 1) - 1));
  lig("btnLeiNovaAvancar", () => leiNovaIr((leiNovaCtx ? leiNovaCtx.passo : 1) + 1));
  lig("btnLeiNovaCriar", () => leiNovaComecar());
  lig("btnLeiNovaEditor", () => { $("dlgLeiNova").close(); leiNovaCtx = null; leiBibNovaEditor(); });
  const liga = (id, fn) => {
    const inp = $(id);
    if (!inp || !inp.addEventListener || inp._leiNova) return;
    inp._leiNova = true;
    inp.addEventListener("change", () => { Promise.resolve(fn(inp.files)).then(() => { try { inp.value = ""; } catch (e) {} }); });
  };
  liga("leiNovaArq", (fs) => leiNovaArquivoPrincipal(fs && fs[0]));
  liga("leiNovaAltArq", (fs) => leiNovaArquivosAlt(fs));
}
