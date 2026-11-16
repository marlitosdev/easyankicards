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
  $("btnBancAlvoDesfazer").hidden = !(typeof cmUltimoRecibo !== "undefined" && cmUltimoRecibo && cmUltimoRecibo.recibo && cmUltimoRecibo.recibo.length);
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
  ed.value = "";
  try { localStorage.removeItem("eac_texto"); } catch (e) {}
  try { preview(); } catch (e) {}
  try { matReg("cartoes", "bancada limpa depois de salvar no tópico", bancAlvo ? bancAlvo.topico : ""); } catch (e) {}
  bancAlvoPintar();
  try { ed.focus(); } catch (e) {}
  return true;
}

function bancAlvoGuardar() { try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {} }

function bancAlvoSair() {
  bancAlvo = null;
  try { localStorage.removeItem(BANC_ALVO_CHAVE); } catch (e) {}
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
  bancAlvoPintar();
}
