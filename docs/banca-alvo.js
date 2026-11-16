/* =====================================================================
 * CRIAR MAIS CARTÕES DE UM TÓPICO, PELA BANCADA
 *
 * "Criar mais cartões deste tópico" não abre uma caixinha à parte: leva à BANCADA de cartões (o editor, com a prévia e
 * todas as ferramentas — Revisar, Melhorar/Elevar, Cartões repetidos, colar e conferir) e deixa lá um TÓPICO-ALVO:
 *
 *   1. prompt para a IA, já com o tópico, o resumo, os cartões que ele JÁ tem (para não repetir) e as etiquetas;
 *   2. você cola a resposta na bancada e usa as ferramentas de sempre para melhorar;
 *   3. "Salvar neste tópico" grava os cartões da bancada (os marcados) direto no tópico — sem classificar um a um —,
 *      com o mesmo recibo e o mesmo desfazer do "Salvar cartões no material de estudo".
 *
 * O alvo fica lembrado até você sair dele. Nada aqui muda o texto da bancada.
 * ===================================================================== */
const BANC_ALVO_CHAVE = "eac_banca_alvo";
let bancAlvo = null;

function bancAlvoLer() {
  try { const j = JSON.parse(localStorage.getItem(BANC_ALVO_CHAVE) || "null"); return j && j.disciplina && j.topico ? j : null; } catch (e) { return null; }
}

/* o prompt do tópico: o mesmo do painel antigo, com o resumo, os cartões que já existem e as etiquetas */
function bancAlvoTextoPrompt(a) {
  /* (19.89.0) o alvo veio de "Cartões de uma lei": o pedido é o do lote atual (cartoes-lei.js) */
  if (a && a.lei && typeof clPromptDoAlvo === "function") return clPromptDoAlvo(a);
  const r = matResumos[a.chave] || {};
  const esc = typeof pcEscolhaLer === "function" ? pcEscolhaLer() : { tipo: "rico", qtd: "auto" };
  /* (19.142.0) com um RAMO escolhido (veio da ficha do ramo), o pedido é do ramo e cada cartão já sai com a etiqueta dele */
  const tags = matEtiquetasTopico(a.disciplina, a.topico, r.concurso || a.concurso || "", "resumo");
  if (a.ramo && a.ramo.id) tags.push("ram_" + a.ramo.id);
  return t("mc_prompt", {
    d: a.disciplina, tp: a.topico + (a.ramo && a.ramo.nome ? " › " + a.ramo.nome : ""),
    frentes: pcFrentesDoTopico(a.disciplina, a.topico),
    tipo: esc.tipo, qtd: esc.qtd,
    resumo: String(r.texto || ""),
    tags: tags.join(" "),
  });
}

/* (19.142.0) O ESTADO DA BANCADA diante do que já foi salvo: a "impressão" do texto (tamanho + começo e fim) — basta para
 * dizer "a bancada atual já foi salva" sem guardar o texto inteiro */
function bancAlvoImpressao(txt) {
  const s = String(txt || "").trim();
  return s.length + ":" + s.slice(0, 80) + ":" + s.slice(-80);
}
function bancAlvoContarBancada() {
  try { return parseText(String(($("editor") || {}).value || ""), []).cards.length; } catch (e) { return 0; }
}
/* o botão principal do rodapé: com tópico escolhido, salva NELE; a classificação por tópico vira o secundário */
function bancAlvoRodape() {
  const b = $("btnSalvarMaterial");
  if (!b) return;
  if (bancAlvo) {
    b.textContent = t("banc_alvo_rodape", { t: bancAlvo.ramo && bancAlvo.ramo.nome ? bancAlvo.ramo.nome : bancAlvo.topico });
    b.title = t("banc_alvo_tip_salvar");
    b.onclick = bancAlvoSalvar;
  } else {
    b.textContent = t("cm_botao");
    b.title = "";
    if (typeof cmAbrir === "function") b.onclick = cmAbrir;
  }
  const v = $("btnSalvarMaterialVarios");
  if (v) { v.hidden = !bancAlvo; v.onclick = () => { if (typeof cmAbrir === "function") cmAbrir(); }; }
}
function bancAlvoPintar() {
  const box = $("bancAlvoBox");
  bancAlvoRodape();
  if (!box) return;
  box.hidden = !bancAlvo;
  if (!bancAlvo) return;
  const n = matContarCartoes(bancAlvo.chave);
  $("bancAlvoNome").textContent = bancAlvo.disciplina + " › " + bancAlvo.topico + (bancAlvo.ramo && bancAlvo.ramo.nome ? " › " + bancAlvo.ramo.nome : "");
  $("bancAlvoSub").textContent = t("banc_alvo_sub", { n });
  /* os três passos, com o que já foi feito */
  const nB = bancAlvoContarBancada();
  const salvo = bancAlvo.salvo || null;
  const igual = !!(salvo && salvo.impressao === bancAlvoImpressao(($("editor") || {}).value));
  const marca = (id, feito, txt) => { const el = $(id); if (!el) return; el.className = "banc-alvo-passo" + (feito ? " feito" : ""); const ok = $(id + "Ok"); if (ok) ok.textContent = txt || ""; };
  marca("bancAlvoP1", !!bancAlvo.promptEm, bancAlvo.promptEm ? t("banc_alvo_p1_ok") : "");
  marca("bancAlvoP2", nB > 0, nB ? t("banc_alvo_p2_n", { n: nB }) : "");
  marca("bancAlvoP3", igual, igual ? t("banc_alvo_p3_ok", { h: new Date(salvo.em).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }) : "");
  /* depois de salvar: a confirmação fica NA caixa, com o próximo passo */
  const fe = $("bancAlvoFeito");
  if (fe) {
    fe.hidden = !salvo;
    if (salvo) {
      $("bancAlvoFeitoTxt").textContent = igual
        ? t("banc_alvo_feito", { n: salvo.novos, t: salvo.onde, h: new Date(salvo.em).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), r: salvo.repetidos, d: salvo.dist ? " " + t("banc_alvo_conf_ramos") + " " + salvo.dist + "." : "" })
        : t("banc_alvo_feito_mudou", { n: salvo.novos, h: new Date(salvo.em).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
      if ($("btnBancAlvoLimpar")) $("btnBancAlvoLimpar").hidden = !(igual && nB);
    }
  }
  /* (19.147.0) cmUltimoRecibo é um "let" de edital-ui.js, que carrega DEPOIS deste arquivo: ao abrir o app com um tópico
   * na bancada, até o typeof dava ReferenceError e a pintura parava aqui (sem "Voltar" e sem a navegação dos lotes) */
  let rec = null;
  try { rec = cmUltimoRecibo; } catch (e) { rec = null; }
  $("btnBancAlvoDesfazer").hidden = !(rec && rec.recibo && rec.recibo.length);
  if ($("btnBancAlvoVoltar")) $("btnBancAlvoVoltar").hidden = bancAlvo.volta !== "biblioteca";
  if (typeof clPintarNoAlvo === "function") clPintarNoAlvo();
}

function bancAlvoDefinir(disciplina, topico, opc) {
  const chave = matChaveViva(disciplina, topico);
  const r = matResumos[chave] || {};
  /* (v18.37.0) veio da Biblioteca (ou de algo aberto por cima dela)? a bancada sabe voltar para lá */
  const daBiblioteca = !!($("dlgGerCartoes") && $("dlgGerCartoes").open);
  /* (19.142.0) o RAMO vem junto quando "Criar cartões" foi tocado na ficha de um ramo */
  const ramo = opc && opc.ramo && opc.ramo.id ? { id: String(opc.ramo.id), nome: String(opc.ramo.nome || "") } : null;
  bancAlvo = { disciplina, topico, chave, concurso: r.concurso || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    volta: daBiblioteca ? "biblioteca" : "", ramo };
  try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {}
  try { bancVigiaGravou(($("editor") || {}).value); } catch (e) {}
  ["dlgGerEstudo", "dlgCobertura", "dlgGerCartoes", "dlgMatCartoes"].forEach((id) => { const d = $(id); if (d && d.open) d.close(); });
  trocarModo("cartoes");
  bancAlvoPintar();
  try { const b = $("bancAlvoBox"); if (b && b.scrollIntoView) b.scrollIntoView({ block: "center" }); } catch (e) {}
  try { matReg("cartoes", "bancada apontada para um tópico", disciplina + " › " + topico); } catch (e) {}
}

/* volta à Biblioteca, na pasta do tópico-alvo */
function bancAlvoVoltar() {
  if (!bancAlvo || typeof gerAbrirNoTopico !== "function") return false;
  gerAbrirNoTopico(bancAlvo.disciplina, bancAlvo.topico);
  try { matReg("cartoes", "voltou da bancada para a Biblioteca", bancAlvo.topico); } catch (e) {}
  return true;
}

/* (19.142.0) LIMPAR A BANCADA para o próximo lote, com o tópico mantido. A versão de antes fica no histórico. */
function bancAlvoLimpar() {
  const ed = $("editor");
  if (!ed || !ed.value.trim()) return false;
  try { guardarVersao("antes de limpar (lote salvo no tópico)"); } catch (e) {}
  const antes = ed.value;
  ed.value = "";
  try { textoAnterior = ""; } catch (e) {}
  try { localStorage.removeItem("eac_texto"); } catch (e) {}
  bancVigiaLimpou("Limpar a bancada (lote salvo no tópico)", antes);
  try { preview(); } catch (e) {}
  try { matReg("cartoes", "bancada limpa depois de salvar no tópico", bancAlvo ? bancAlvo.topico : ""); } catch (e) {}
  bancAlvoPintar();
  try { ed.focus(); } catch (e) {}
  return true;
}

function bancAlvoGuardar() {
  try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {}
  try { bancVigiaGravou(($("editor") || {}).value); } catch (e) {}
}

function bancAlvoSair() {
  const era = bancAlvo;
  bancAlvo = null;
  try { localStorage.removeItem(BANC_ALVO_CHAVE); } catch (e) {}
  /* (19.147.0) sair do tópico agora deixa evento: antes, o alvo sumir e o "Sair" eram indistinguíveis */
  if (era) { try { reg("BANCADA", "saiu do tópico da bancada", bancVigiaAlvoTxt(era)); } catch (e) {} }
  try { bancVigiaGravou(($("editor") || {}).value); } catch (e) {}
  bancAlvoPintar();
}

function bancAlvoPrompt() {
  if (!bancAlvo) return;
  const txt = bancAlvoTextoPrompt(bancAlvo);
  $("bancAlvoPromptTxt").value = txt;
  $("bancAlvoPromptVer").hidden = false;
  let copiou = false;
  try {
    const p = navigator.clipboard && navigator.clipboard.writeText(txt);
    copiou = !!p;
    if (p && p.catch) p.catch(() => { $("bancAlvoPromptVer").open = true; });
  } catch (e) { copiou = false; }
  if (!copiou) $("bancAlvoPromptVer").open = true;
  else toast("mc_prompt_copiado");
  bancAlvo.promptEm = Date.now();
  bancAlvoGuardar();
  bancAlvoPintar();
  try { matReg("cartoes", copiou ? "prompt do tópico copiado (bancada)" : "prompt do tópico gerado (sem copiar)", bancAlvo.topico + " · " + txt.length + " caracteres"); } catch (e) {}
}

async function bancAlvoSalvar() {
  if (!bancAlvo) return;
  const r = await validar();
  if (!r || !r.cards.length) return;
  const destino = { disciplina: bancAlvo.disciplina, topico: bancAlvo.topico };
  /* (19.142.0) O RAMO DE CADA CARTÃO: o da etiqueta, o do alvo, ou o sugerido pelo título e pelas palavras. Sem isso o
   * tópico ganhava os cartões e cada ramo continuava "nenhum ainda neste ramo" — na ficha e na agenda. */
  const ramos = typeof ramRamosDoTopico === "function" ? ramRamosDoTopico(bancAlvo.disciplina, bancAlvo.topico) : [];
  const dist = ramos.length && typeof ramDistribuicao === "function" ? ramDistribuicao(r.cards, ramos, bancAlvo.ramo ? bancAlvo.ramo.id : "") : null;
  const distTxt = dist ? ramDistribuicaoTexto(dist.resumo, t("ram_dist_geral")) : "";
  const onde = bancAlvo.disciplina + " › " + bancAlvo.topico;
  if (!(await uiConfirm(t("banc_alvo_conf", { n: r.cards.length, t: onde }) + (distTxt ? "\n\n" + t("banc_alvo_conf_ramos") + "\n" + distTxt : "")))) return;
  const cards = dist ? dist.itens.map((x) => (x.id && !x.ja ? ramCartaoComRamo(x.card, x.id) : x.card)) : r.cards;
  const rec = cmAplicar(cards.map((c) => ({ card: c, destino })), bancAlvo.concurso || "", matGravarCartoes);
  cmReciboGuardar(rec);
  try { matReg("cartoes", "cartões da bancada salvos no tópico", bancAlvo.topico + " · " + rec.novos + " novos, " + rec.repetidos + " já existiam" + (distTxt ? " · " + distTxt.replace(/\n/g, " ") : "")); } catch (e) {}
  if (typeof matRenderLista === "function") { try { matRenderLista(); } catch (e) {} }
  bancAlvo.salvo = { em: Date.now(), novos: rec.novos, repetidos: rec.repetidos, onde: bancAlvo.ramo && bancAlvo.ramo.nome ? bancAlvo.ramo.nome : bancAlvo.topico,
    impressao: bancAlvoImpressao(($("editor") || {}).value), dist: distTxt ? distTxt.split("\n").map((l) => l.replace(/^•\s*/, "")).join(" · ") : "" };
  bancAlvoGuardar();
  bancAlvoPintar();
  if (!rec.novos) { await uiAlert(t("banc_alvo_nada_novo", { r: rec.repetidos })); return; }
  /* (19.142.0) SEM BIBLIOTECA PARA VOLTAR NEM LOTE DE LEI, a confirmação fica na própria caixa ("✓ 20 salvos…", com
   * "Estudar agora" e "Limpar a bancada"): a janela de escolha só aparece quando há um caminho a mais a oferecer */
  if (!bancAlvo.lei && bancAlvo.volta !== "biblioteca") {
    try { const b = $("bancAlvoBox"); if (b && b.scrollIntoView) b.scrollIntoView({ block: "nearest" }); } catch (e) {}
    return;
  }
  /* (v18.37.0) quem veio da Biblioteca volta para a mesma pasta, onde os novos cartões já estão */
  /* (19.89.0) cartões de uma lei: o caminho natural é o próximo lote */
  const L = bancAlvo.lei;
  const temLote = !!(L && L.k < L.lotes.length - 1);
  const opcoes = (temLote ? [{ valor: "lote", rot: t("cl_prox_lote", { k: L.k + 2, n: L.lotes.length }), classe: "btn-verde" }] : [])
    .concat(bancAlvo.volta === "biblioteca" ? [{ valor: "biblioteca", rot: t("banc_alvo_voltar"), classe: temLote ? "" : "btn-verde" }] : [])
    .concat([{ valor: "estudar", rot: t("cm_estudar_agora"), classe: bancAlvo.volta === "biblioteca" || temLote ? "" : "btn-verde" }, { valor: "ok", rot: t("help_close") }]);
  const ir = await uiEscolha(t("cm_gravados_estudar", { n: rec.novos, t: bancAlvo.topico, r: rec.repetidos })
    + (L && !temLote ? "\n\n" + t("cl_lei_fim", { l: L.nome }) : ""), opcoes);
  if (ir === "lote" && typeof clIrLote === "function") { clIrLote(L.k + 1); return; }
  if (ir === "biblioteca") bancAlvoVoltar();
  if (ir === "estudar") estcEstudarTopico(bancAlvo.disciplina, bancAlvo.topico);
}

/* =====================================================================
 * (19.147.0) A VIGIA DA BANCADA
 *
 * Na noite de 13/11 a bancada e o tópico-alvo se esvaziaram entre 22:23 e 22:45, e o registro não tinha NADA: limpar
 * depois de salvar, trocar de lote da lei e "Sair" do tópico não deixavam evento, e o app não guardava como a bancada
 * estava. Os cartões estavam salvos no tópico, mas não havia como saber o que tinha acontecido.
 *
 * AGORA:
 *  · todo caminho que esvazia a bancada ou tira o tópico deixa evento BANCADA no registro, com o motivo;
 *  · a cada gravação do texto, um SELO pequeno (quantos cartões, quantos caracteres, qual tópico, quando) e, no máximo a
 *    cada 20 s (ou quando o número de cartões muda), uma CÓPIA do texto — fora das Versões, para não empurrar nenhuma
 *    delas para fora. A cópia nunca é trocada por uma bancada vazia;
 *  · ao abrir, se o selo diz que havia cartões, a bancada está vazia e ninguém limpou: evento no registro, a cópia entra
 *    nas Versões do texto e a faixa de recuperar aparece. Se o tópico sumiu sem "Sair", ele volta (e o aviso diz).
 * O selo e a cópia não vão para o backup: valem só para este aparelho, como as Versões.
 * ===================================================================== */
const BANC_SELO_CH = "eac_banc_selo";
const BANC_COPIA_CH = "eac_banc_copia";
const BANC_COPIA_MAX = 400000;
const BANC_COPIA_INTERVALO = 20000;
let bancVigiaRelogio = () => Date.now();
function bancVigiaRelogioDefinir(f) { bancVigiaRelogio = f || (() => Date.now()); }

function bancVigiaContar(txt) { return (String(txt || "").match(/^(?!\s*#)[^\n]*::/gm) || []).length; }
function bancVigiaEhExemplo(txt) {
  try { return String(txt || "").trim() === String(t("example")).trim(); } catch (e) { return false; }
}
function bancVigiaLerJ(ch) { try { return JSON.parse(localStorage.getItem(ch) || "null"); } catch (e) { return null; } }
function bancVigiaAlvoTxt(a) { return a ? a.disciplina + " › " + a.topico : ""; }

/* chamada depois de cada gravação do texto (autoSalvar) e quando o tópico muda */
function bancVigiaGravou(txt) {
  txt = String(txt == null ? "" : txt);
  const vazio = !txt.trim() || bancVigiaEhExemplo(txt);
  const agora = bancVigiaRelogio();
  const selo = { t: agora, c: vazio ? 0 : txt.length, n: vazio ? 0 : bancVigiaContar(txt), alvo: bancVigiaAlvoTxt(bancAlvo) };
  if (bancAlvo) { try { if (JSON.stringify(bancAlvo).length < 20000) selo.alvoObj = bancAlvo; } catch (e) {} }
  try { localStorage.setItem(BANC_SELO_CH, JSON.stringify(selo)); } catch (e) {}
  if (vazio || txt.length > BANC_COPIA_MAX) return selo;
  const c = bancVigiaLerJ(BANC_COPIA_CH);
  if (!c || c.n !== selo.n || agora - (c.t || 0) >= BANC_COPIA_INTERVALO) {
    try { localStorage.setItem(BANC_COPIA_CH, JSON.stringify({ t: agora, n: selo.n, alvo: selo.alvo, txt })); } catch (e) {}
  }
  return selo;
}

/* um caminho do app esvaziou a bancada A PEDIDO: fica no registro, e o selo passa a dizer "vazia" */
function bancVigiaLimpou(motivo, antes) {
  const a = String(antes || "");
  try { reg("BANCADA", "bancada esvaziada: " + motivo, bancVigiaContar(a) + " cartões · " + a.length + " caracteres" + (bancAlvo ? " · " + bancVigiaAlvoTxt(bancAlvo) : "")); } catch (e) {}
  bancVigiaGravou("");
}

/* ao abrir: o selo diz que havia cartões e a bancada está vazia sem ninguém ter limpado? */
function bancVigiaAbrir() {
  const r = { vazia: false, copia: false, alvo: false };
  const selo = bancVigiaLerJ(BANC_SELO_CH);
  const ed = typeof $ === "function" ? $("editor") : null;
  if (selo && typeof selo === "object") {
    let salvo = null;
    try { salvo = localStorage.getItem("eac_texto"); } catch (e) {}
    const vaziaAgora = salvo === null || !salvo.trim() || bancVigiaEhExemplo(salvo);
    const quando = new Date(selo.t || 0).toLocaleString();
    if (selo.c > 0 && vaziaAgora) {
      r.vazia = true;
      r.n = selo.n || 0;
      r.quando = quando;
      const cp = bancVigiaLerJ(BANC_COPIA_CH);
      r.copia = !!(cp && cp.txt && String(cp.txt).trim());
      try {
        reg("BANCADA", "a bancada abriu vazia sem ninguém ter limpado",
          "antes: " + (selo.n || 0) + " cartões · " + selo.c + " caracteres · " + quando + (selo.alvo ? " · " + selo.alvo : "")
          + (r.copia ? " · cópia de " + new Date(cp.t || 0).toLocaleString() + " (" + (cp.n || 0) + " cartões) posta nas Versões do texto" : " · sem cópia"));
      } catch (e) {}
      if (r.copia && typeof guardarVersao === "function") {
        try { guardarVersao("cópia da vigia: a bancada abriu vazia", String(cp.txt)); } catch (e) {}
        /* guardarVersao marca "foi o app": aqui ninguém mexeu no texto, e a próxima digitação precisa continuar vigiada */
        try { appMexendo = false; } catch (e) {}
      }
    }
    const ao = selo.alvoObj;
    if (selo.alvo && !bancAlvo && ao && ao.disciplina && ao.topico) {
      bancAlvo = ao;
      try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {}
      r.alvo = selo.alvo;
      try { reg("BANCADA", "o tópico da bancada sumiu sem Sair: trazido de volta", selo.alvo); } catch (e) {}
    }
  }
  if (r.vazia || r.alvo) bancVigiaAviso(r);
  /* o aviso sai UMA vez: dali em diante o selo descreve a bancada como ela está (a cópia continua guardada) */
  bancVigiaGravou(ed ? ed.value : "");
  return r;
}

function bancVigiaAviso(r) {
  if (typeof $ !== "function") return;
  const alvoTxt = r.alvo ? " " + t("banc_vigia_alvo", { t: r.alvo }) : "";
  if (!r.vazia) { try { toastMsg(t("banc_vigia_alvo", { t: r.alvo }), 8000); } catch (e) {} return; }
  const bar = $("barraRecuperar");
  if (!bar) return;
  if ($("recuperarTxt")) $("recuperarTxt").textContent = t("banc_vigia_tit", { n: r.n, q: r.quando });
  if ($("recuperarCorpo")) $("recuperarCorpo").textContent = t(r.copia ? "banc_vigia_corpo" : "banc_vigia_sem_copia") + alvoTxt;
  if ($("btnRecuperar")) $("btnRecuperar").hidden = !r.copia;
  bar.hidden = false;
}

if (typeof document !== "undefined" && $("bancAlvoBox")) {
  $("btnBancAlvoPrompt").onclick = bancAlvoPrompt;
  $("btnBancAlvoSalvar").onclick = bancAlvoSalvar;
  $("btnBancAlvoSair").onclick = bancAlvoSair;
  if ($("btnBancAlvoVoltar")) $("btnBancAlvoVoltar").onclick = bancAlvoVoltar;
  $("btnBancAlvoDesfazer").onclick = async () => { await cmDesfazerUltimo(); if (bancAlvo) { delete bancAlvo.salvo; bancAlvoGuardar(); } bancAlvoPintar(); };
  if ($("btnBancAlvoLimpar")) $("btnBancAlvoLimpar").onclick = bancAlvoLimpar;
  if ($("btnBancAlvoEstudar")) $("btnBancAlvoEstudar").onclick = () => { if (bancAlvo) estcEstudarTopico(bancAlvo.disciplina, bancAlvo.topico); };
  /* os passos acompanham a bancada: colou, apagou, mudou — o "② N cartões" e o "✓ salvos" se atualizam sozinhos */
  if ($("editor") && $("editor").addEventListener) {
    let tm = null;
    $("editor").addEventListener("input", () => { if (!bancAlvo) return; clearTimeout(tm); tm = setTimeout(bancAlvoPintar, 400); });
  }
  bancAlvo = bancAlvoLer();
  try { bancVigiaAbrir(); } catch (e) {}
  bancAlvoPintar();
}
