/* =====================================================================
 * T4 — PEDIR O RESUMO À IA, COM OS RAMOS
 *
 * O mesmo caminho da ficha: do tópico inteiro (resumo geral + uma seção "## Ramo — X" por ramo) ou de um ramo só (só a
 * seção dele). Dois passos, como os outros pedidos do app: 1) montar o pedido e copiar; 2) colar a resposta, que o app
 * confere (é o pedido? veio separada por ramos? que partes muda? que marcas se perderiam?) antes de gravar — e o que
 * foi gravado tem "desfazer". Ramos novos (escritos pela pessoa ou sugeridos pela IA) viram seções guardadas: quando o
 * ramo é criado no edital ("ajustar ramos"), a seção passa a aparecer nele, porque o casamento é pelo nome.
 * ===================================================================== */

const RIA_LEI_MAX = 20000;
const RIA_PROFS = ["enxuto", "padrao", "detalhado"];
/* o contexto do diálogo: { disciplina, topico, chave, ramos, ramo (id; "" = tópico inteiro), editalId } */
let riaCtx = null;
let riaNovos = [];
let riaModo = "secoes";
let riaAnterior = null;

/* a marca e a dica incorporada, no formato do resumo (== … == e linhas "> ") */
const RIA_MARCA_RE = /==[!?§*~@]?(?:[^=\n]|=(?!=))+==/g;
function riaContarMarcas(s) {
  const txt = String(s || "");
  return { marcas: (txt.match(RIA_MARCA_RE) || []).length, dicas: (txt.match(/^>\s/gm) || []).length };
}

/* O PEDIDO. o = { disciplina, topico, ramos:[{nome, foco, novo}], ramo:{nome, foco}|null, prof, sugerir, lei, atual } */
function riaPrompt(o) {
  const L = [];
  const nl = "\n";
  if (o.ramo) {
    L.push(t("ria_p_intro_ramo", { r: o.ramo.nome, t: o.topico, d: o.disciplina }));
    L.push("");
    L.push(t("ria_p_formato_ramo", { r: o.ramo.nome }));
    if (String(o.ramo.foco || "").trim()) L.push(t("ria_p_foco", { f: String(o.ramo.foco).trim() }));
  } else {
    L.push(t("ria_p_intro_topico", { t: o.topico, d: o.disciplina }));
    L.push("");
    L.push(t("ria_p_formato_topico"));
    const rs = (o.ramos || []).filter((r) => r && String(r.nome || "").trim());
    if (rs.length) {
      L.push("");
      L.push(t("ria_p_ramos"));
      rs.forEach((r) => L.push("- " + r.nome + (r.novo ? t("ria_p_novo") : "") + (String(r.foco || "").trim() ? t("ria_p_cubra", { f: String(r.foco).trim() }) : "")));
    }
  }
  L.push("");
  L.push(t("ria_p_cada"));
  L.push(t("ria_p_prof_" + (RIA_PROFS.indexOf(o.prof) >= 0 ? o.prof : "padrao")));
  if (!o.ramo && o.sugerir) L.push(t("ria_p_sugerir"));
  L.push(t("ria_p_regras"));
  if (String(o.lei || "").trim()) {
    L.push("");
    L.push(t("ria_p_lei"));
    L.push(String(o.lei).slice(0, RIA_LEI_MAX));
  }
  if (String(o.atual || "").trim()) {
    L.push("");
    L.push(t(o.ramo ? "ria_p_atual_ramo" : "ria_p_atual"));
    L.push(String(o.atual).trim());
  }
  return L.join(nl);
}

/* A RESPOSTA. Devolve { vazio, ehPedido, geral (texto ou ""), secoes:[{id,nome,corpo,semRamo,sugerido}], semSecao }.
 * Tópico: "# Resumo geral" sai (é só o rótulo); "## Ramo sugerido — X" vira "## Ramo — X" marcada como sugerida.
 * Ramo: sem título nenhum, o texto inteiro é a seção do ramo. */
function riaLerResposta(texto, ramos, ramoAlvo) {
  let s = String(texto || "").replace(/\r\n?/g, "\n").replace(/^\s*```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
  if (!s) return { vazio: true, ehPedido: false, geral: "", secoes: [], semSecao: false };
  if (/FORMATO \(obrigatório|FORMAT \(required|^Você vai escrever o (RESUMO|resumo)|^You will write the/m.test(s)) {
    return { vazio: false, ehPedido: true, geral: "", secoes: [], semSecao: false };
  }
  const sugeridos = [];
  s = s.replace(/^(#{1,6})[ \t]*ramo[ \t]+sugerido[ \t]*[—–:-][ \t]*(.+)$/gim, (m0, h, nome) => { sugeridos.push(matIdDeNome(nome.trim())); return "## Ramo — " + nome.trim(); });
  s = s.replace(/^#{1,6}[ \t]*(resumo geral|general summary)[ \t]*#*[ \t]*\n?/im, "");
  const sc = matSecoesDeRamo(s, ramos);
  if (ramoAlvo) {
    const alvo = (ramos || []).find((r) => r.id === ramoAlvo) || { id: ramoAlvo, nome: ramoAlvo };
    const x = sc.secoes.find((y) => y.id === ramoAlvo);
    /* sem o título: o texto inteiro é o ramo */
    const corpo = x ? x.corpo : (sc.secoes.length ? "" : s.trim());
    return { vazio: !corpo.trim(), ehPedido: false, geral: "", secoes: corpo.trim() ? [{ id: alvo.id, nome: alvo.nome, corpo, semRamo: false, sugerido: false }] : [], semSecao: false };
  }
  return {
    vazio: false, ehPedido: false,
    geral: sc.geral.corpo.trim(),
    secoes: sc.secoes.map((x) => ({ id: x.id, nome: x.nome, corpo: x.corpo, semRamo: x.semRamo, sugerido: sugeridos.indexOf(x.id) >= 0 })),
    semSecao: !sc.secoes.length,
  };
}

/* APLICAR: "secoes" troca só o geral (se veio) e as seções que vieram; "tudo" refaz o resumo só com a resposta */
function riaAplicarTexto(atual, resp, modo, ramos) {
  if (!resp || resp.vazio || resp.ehPedido) return String(atual || "");
  if (modo === "tudo") {
    const partes = [];
    if (resp.geral) partes.push(resp.geral);
    resp.secoes.forEach((x) => partes.push("## Ramo — " + x.nome + "\n" + x.corpo.trim()));
    return partes.join("\n\n");
  }
  let s = String(atual || "");
  if (resp.geral) s = matTrocarSecao(s, "", resp.geral, "", ramos);
  resp.secoes.forEach((x) => { s = matTrocarSecao(s, x.id, x.corpo, x.nome, ramos); });
  return s;
}

/* O QUE MUDA: uma linha por parte (antes → depois) e as marcas/dicas que estão nas partes trocadas */
function riaConferir(atual, resp, modo, ramos) {
  const sc = matSecoesDeRamo(String(atual || ""), ramos);
  const itens = [];
  let perdidas = { marcas: 0, dicas: 0 };
  const soma = (s) => { const c = riaContarMarcas(s); perdidas.marcas += c.marcas; perdidas.dicas += c.dicas; };
  const rotGeral = t("ria_parte_geral");
  if (modo === "tudo") {
    soma(atual);
    const antesG = sc.geral.corpo;
    if (resp.geral || antesG) itens.push({ parte: rotGeral, antes: antesG.length, depois: (resp.geral || "").length, tipo: resp.geral ? (antesG ? "troca" : "nova") : "some" });
    sc.secoes.forEach((x) => { const n = resp.secoes.find((y) => y.id === x.id); itens.push({ parte: x.nome, antes: x.corpo.length, depois: n ? n.corpo.length : 0, tipo: n ? "troca" : "some" }); });
    resp.secoes.filter((y) => !sc.secoes.some((x) => x.id === y.id)).forEach((y) => itens.push({ parte: y.nome, antes: 0, depois: y.corpo.length, tipo: "nova" }));
  } else {
    if (resp.geral) { soma(sc.geral.corpo); itens.push({ parte: rotGeral, antes: sc.geral.corpo.length, depois: resp.geral.length, tipo: sc.geral.corpo ? "troca" : "nova" }); }
    resp.secoes.forEach((y) => {
      const x = sc.secoes.find((z) => z.id === y.id);
      if (x) soma(x.corpo);
      itens.push({ parte: y.nome, antes: x ? x.corpo.length : 0, depois: y.corpo.length, tipo: x ? "troca" : "nova" });
    });
  }
  return { itens, perdidas };
}

/* ---------------- a tela ---------------- */
function riaAbrir(ctx) {
  const dlg = $("dlgResIA");
  if (!dlg || !ctx) return null;
  riaCtx = Object.assign({ ramos: [], ramo: "" }, ctx);
  riaNovos = [];
  riaModo = "secoes";
  riaAnterior = null;
  const ramo = riaRamoAlvo();
  $("resIATit").textContent = ramo ? t("ria_tit_ramo", { r: ramo.nome }) : t("ria_tit_topico", { t: riaCtx.topico });
  $("resIASub").textContent = t(ramo ? "ria_sub_ramo" : "ria_sub_topico");
  $("resIATexto").value = "";
  $("resIACopiadoMsg").textContent = "";
  $("resIAFeito").hidden = true;
  if ($("resIANovo")) $("resIANovo").value = "";
  const lei = typeof leiTextoDoTopico === "function" ? String(leiTextoDoTopico(riaCtx.chave) || "") : "";
  $("resIALeiLin").hidden = !lei.trim();
  $("resIALei").checked = !!lei.trim();
  $("resIALeiRot").textContent = t("ria_lei", { n: RIA_LEI_MAX.toLocaleString() });
  const atual = riaTextoAtualDoEscopo();
  $("resIAAtualLin").hidden = !String(atual || "").trim();
  $("resIAAtual").checked = !!String(atual || "").trim();
  $("resIANovoLin").hidden = !!ramo;
  $("resIASugerirLin").hidden = !!ramo;
  riaPintarRamos();
  riaConferirTela();
  abrirModal("dlgResIA");
  return dlg;
}
/* aberto de fora da ficha (Agenda, Material de estudo, diário): os ramos vêm do plano do edital aberto, quando o tópico
 * está nele — o mesmo critério da ficha */
function riaAbrirDoTopico(disciplina, topico, chave, opc) {
  const o = opc || {};
  let ramos = o.ramos;
  if (!ramos) {
    let it = null;
    try { it = typeof edItemDoPlano === "function" ? edItemDoPlano(disciplina, topico) : null; } catch (e) { it = null; }
    ramos = (it && it.ramos) || [];
  }
  const ch = chave || (typeof matChaveViva === "function" ? matChaveViva(disciplina, topico) : matChave(disciplina, topico));
  return riaAbrir({ disciplina, topico, chave: ch, ramos, ramo: o.ramo || "", editalId: o.editalId || "" });
}
function riaRamoAlvo() { return riaCtx && riaCtx.ramo ? (riaCtx.ramos || []).find((r) => r.id === riaCtx.ramo) || { id: riaCtx.ramo, nome: riaCtx.ramo } : null; }
function riaTextoAtual() { const r = matObter(riaCtx.chave); return (r && r.texto) || ""; }
function riaTextoAtualDoEscopo() {
  const tudo = riaTextoAtual();
  return riaCtx.ramo ? (matTextoDaSecao(tudo, riaCtx.ramo, riaCtx.ramos) || "") : tudo;
}
/* os ramos do pedido: caixa (incluir) + "o que cobrir"; os novos escritos pela pessoa entram marcados como novos */
function riaPintarRamos() {
  const bx = $("resIARamos");
  bx.innerHTML = "";
  const ramo = riaRamoAlvo();
  const linha = (r, novo) => {
    const lin = document.createElement("div");
    lin.className = "res-ia-ramo";
    const lb = document.createElement("label");
    if (!ramo) {
      const ck = document.createElement("input");
      ck.type = "checkbox"; ck.checked = r.incluir !== false;
      ck.onchange = () => { r.incluir = ck.checked; };
      lb.append(ck);
    }
    const nm = document.createElement("b");
    nm.textContent = " " + r.nome;
    lb.append(nm);
    if (novo) { const tg = document.createElement("span"); tg.className = "res-ia-novo-tag"; tg.textContent = t("ria_novo_tag"); lb.append(tg); }
    const fc = document.createElement("input");
    fc.type = "text"; fc.className = "mat-busca res-ia-foco"; fc.placeholder = t("ria_foco_ph"); fc.value = r.foco || "";
    fc.oninput = () => { r.foco = fc.value; };
    lin.append(lb, fc);
    bx.append(lin);
  };
  if (ramo) { riaCtx.alvoFoco = riaCtx.alvoFoco || { nome: ramo.nome, foco: "" }; linha(riaCtx.alvoFoco, false); return; }
  if (!riaCtx.lista) riaCtx.lista = (riaCtx.ramos || []).map((r) => ({ id: r.id, nome: r.nome, foco: "", incluir: true }));
  riaCtx.lista.forEach((r) => linha(r, false));
  riaNovos.forEach((r) => linha(r, true));
  if (!riaCtx.lista.length && !riaNovos.length) {
    const p = document.createElement("p"); p.className = "nota"; p.textContent = t("ria_sem_ramos"); bx.append(p);
  }
}
function riaAcrescentarNovo() {
  const nome = String(($("resIANovo") || {}).value || "").trim();
  if (!nome) return;
  const id = matIdDeNome(nome);
  if ((riaCtx.ramos || []).some((r) => r.id === id) || riaNovos.some((r) => matIdDeNome(r.nome) === id)) { $("resIANovo").value = ""; return; }
  riaNovos.push({ nome, foco: "", incluir: true });
  $("resIANovo").value = "";
  riaPintarRamos();
}
function riaMontarPedido() {
  const ramo = riaRamoAlvo();
  const prof = ($("resIAProf") || {}).value || "padrao";
  const lei = $("resIALei").checked && !$("resIALeiLin").hidden && typeof leiTextoDoTopico === "function" ? leiTextoDoTopico(riaCtx.chave) : "";
  const atual = $("resIAAtual").checked && !$("resIAAtualLin").hidden ? riaTextoAtualDoEscopo() : "";
  return riaPrompt({
    disciplina: riaCtx.disciplina, topico: riaCtx.topico, prof, lei, atual,
    sugerir: !ramo && $("resIASugerir").checked,
    ramo: ramo ? { nome: ramo.nome, foco: (riaCtx.alvoFoco || {}).foco || "" } : null,
    ramos: ramo ? [] : (riaCtx.lista || []).filter((r) => r.incluir !== false).map((r) => ({ nome: r.nome, foco: r.foco }))
      .concat(riaNovos.filter((r) => r.incluir !== false).map((r) => ({ nome: r.nome, foco: r.foco, novo: true }))),
  });
}
function riaCopiar() {
  const txt = riaMontarPedido();
  const msg = $("resIACopiadoMsg");
  const ok = () => { msg.textContent = t("ria_copiado"); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(ok, ok);
  } catch (e) {}
  ok();
  return Promise.resolve();
}
/* o semáforo e a conferência, a cada mudança da caixa */
function riaConferirTela() {
  const ramo = riaRamoAlvo();
  const resp = riaLerResposta($("resIATexto").value, riaCtx.ramos, ramo ? ramo.id : "");
  const sem = $("resIASem"), ico = $("resIASemIco"), txt = $("resIASemTxt");
  let est = "vazio", msg = t("ria_sem_vazio");
  if (resp.ehPedido) { est = "erro"; msg = t("ria_sem_pedido"); }
  else if (resp.vazio) { est = "vazio"; msg = t("ria_sem_vazio"); }
  else if (ramo) { est = "ok"; msg = t("ria_sem_ramo_ok", { r: ramo.nome, c: resp.secoes[0].corpo.length }); }
  else if (resp.semSecao) { est = "atencao"; msg = t("ria_sem_semsecao"); }
  else {
    est = "ok";
    const partes = [];
    if (resp.geral) partes.push(t("ria_parte_geral"));
    if (resp.secoes.length) partes.push(t("ria_parte_n", { n: resp.secoes.length, l: resp.secoes.map((x) => x.nome).join(", ") }));
    msg = t("ria_sem_ok", { p: partes.join(" + ") });
    const pedidos = (riaCtx.lista || []).filter((r) => r.incluir !== false);
    const faltam = pedidos.filter((r) => !resp.secoes.some((x) => x.id === r.id)).map((r) => r.nome);
    if (faltam.length) { msg += " " + t("ria_sem_falta", { l: faltam.join(", ") }); est = "atencao"; }
    const novos = resp.secoes.filter((x) => x.semRamo).map((x) => x.nome + (x.sugerido ? " (" + t("ria_sugerido") + ")" : ""));
    if (novos.length) msg += " " + t("ria_sem_novos", { l: novos.join(", ") });
  }
  sem.className = "ednovo-sem sem-" + est;
  ico.textContent = est === "ok" ? "✓" : est === "erro" ? "✕" : est === "atencao" ? "!" : "○";
  txt.textContent = msg;
  $("resIATexto").className = "ednovo-ta" + (est === "ok" ? " ta-ok" : est === "erro" ? " ta-erro" : est === "atencao" ? " ta-atencao" : "");
  const pode = !resp.vazio && !resp.ehPedido;
  $("btnResIAAplicar").disabled = !pode;
  /* trocar tudo só existe no tópico inteiro e quando já há resumo */
  const temAtual = !!riaTextoAtual().trim();
  $("resIAModoLin").hidden = !pode || !!ramo || !temAtual;
  $("btnResIAModoSec").setAttribute("aria-pressed", riaModo === "secoes" ? "true" : "false");
  $("btnResIAModoTudo").setAttribute("aria-pressed", riaModo === "tudo" ? "true" : "false");
  const conf = $("resIAConf");
  conf.innerHTML = "";
  conf.hidden = !pode || !temAtual;
  if (!conf.hidden) {
    const c = riaConferir(riaTextoAtual(), resp, ramo ? "secoes" : riaModo, riaCtx.ramos);
    const tit = document.createElement("b"); tit.textContent = t("ria_conf_tit"); conf.append(tit);
    c.itens.forEach((it) => {
      const p = document.createElement("div");
      p.className = "res-ia-conf-lin";
      p.textContent = it.tipo === "nova" ? t("ria_conf_nova", { p: it.parte, b: it.depois })
        : it.tipo === "some" ? t("ria_conf_some", { p: it.parte }) : t("ria_conf_troca", { p: it.parte, a: it.antes, b: it.depois });
      conf.append(p);
    });
    if (c.perdidas.marcas || c.perdidas.dicas) {
      const w = document.createElement("div"); w.className = "res-ia-conf-perda";
      w.textContent = t("ria_conf_marcas", { m: c.perdidas.marcas, d: c.perdidas.dicas });
      conf.append(w);
    }
  }
  return resp;
}
function riaModoDefinir(m) { riaModo = m === "tudo" ? "tudo" : "secoes"; riaConferirTela(); }
function riaAplicar() {
  const ramo = riaRamoAlvo();
  const resp = riaLerResposta($("resIATexto").value, riaCtx.ramos, ramo ? ramo.id : "");
  if (resp.vazio || resp.ehPedido) return false;
  const antes = riaTextoAtual();
  const novo = riaAplicarTexto(antes, resp, ramo ? "secoes" : riaModo, riaCtx.ramos);
  riaAnterior = { chave: riaCtx.chave, texto: antes, tinha: !!matObter(riaCtx.chave) };
  matGravar(riaCtx.chave, novo, { disciplina: riaCtx.disciplina, topico: riaCtx.topico });
  try { reg("MATERIAL", "resumo pela IA" + (ramo ? " (ramo " + ramo.nome + ")" : ""), riaCtx.topico + " · " + antes.length + " → " + novo.length + " caracteres"); } catch (e) {}
  $("resIAFeitoTxt").textContent = t("ria_aplicado", { t: ramo ? riaCtx.topico + " › " + ramo.nome : riaCtx.topico });
  $("resIAFeito").hidden = false;
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
  return true;
}
function riaDesfazer() {
  if (!riaAnterior) return false;
  matGravar(riaAnterior.chave, riaAnterior.texto, { disciplina: riaCtx.disciplina, topico: riaCtx.topico });
  riaAnterior = null;
  $("resIAFeitoTxt").textContent = t("ria_desfeito");
  $("btnResIADesfazer").hidden = true;
  if (typeof matRender === "function") { try { matRender(); } catch (e) {} }
  return true;
}
function riaAbrirResumo() {
  try { $("dlgResIA").close(); } catch (e) {}
  matAbrirEditor({ disciplina: riaCtx.disciplina, nome: riaCtx.topico, chave: riaCtx.chave }, "ler", { ramos: riaCtx.ramos, ramo: riaCtx.ramo || "*" });
}

function riaIniciar() {
  if (!$("dlgResIA")) return;
  $("btnResIACopiar").onclick = riaCopiar;
  $("btnResIANovo").onclick = riaAcrescentarNovo;
  $("resIANovo").onkeydown = (ev) => { if (ev && ev.key === "Enter") { if (ev.preventDefault) ev.preventDefault(); riaAcrescentarNovo(); } };
  $("resIATexto").addEventListener("input", riaConferirTela);
  $("btnResIAModoSec").onclick = () => riaModoDefinir("secoes");
  $("btnResIAModoTudo").onclick = () => riaModoDefinir("tudo");
  $("btnResIAAplicar").onclick = () => { if (riaAplicar()) $("btnResIADesfazer").hidden = false; };
  $("btnResIADesfazer").onclick = riaDesfazer;
  $("btnResIAAbrir").onclick = riaAbrirResumo;
  $("btnResIAFechar").onclick = () => $("dlgResIA").close();
}
if (typeof document !== "undefined" && $("dlgResIA")) riaIniciar();
