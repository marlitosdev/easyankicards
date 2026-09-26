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
  const r = matResumos[a.chave] || {};
  const esc = typeof pcEscolhaLer === "function" ? pcEscolhaLer() : { tipo: "rico", qtd: "auto" };
  return t("mc_prompt", {
    d: a.disciplina, tp: a.topico,
    frentes: pcFrentesDoTopico(a.disciplina, a.topico),
    tipo: esc.tipo, qtd: esc.qtd,
    resumo: String(r.texto || ""),
    tags: matEtiquetasTopico(a.disciplina, a.topico, r.concurso || a.concurso || "", "resumo").join(" "),
  });
}

function bancAlvoPintar() {
  const box = $("bancAlvoBox");
  if (!box) return;
  box.hidden = !bancAlvo;
  if (!bancAlvo) return;
  const n = matContarCartoes(bancAlvo.chave);
  $("bancAlvoNome").textContent = bancAlvo.disciplina + " › " + bancAlvo.topico;
  $("bancAlvoSub").textContent = t("banc_alvo_sub", { n });
  $("btnBancAlvoDesfazer").hidden = !(typeof cmUltimoRecibo !== "undefined" && cmUltimoRecibo && cmUltimoRecibo.recibo && cmUltimoRecibo.recibo.length);
}

function bancAlvoDefinir(disciplina, topico) {
  const chave = matChaveViva(disciplina, topico);
  const r = matResumos[chave] || {};
  bancAlvo = { disciplina, topico, chave, concurso: r.concurso || (typeof concursoAtual === "function" ? concursoAtual().nome : "") };
  try { localStorage.setItem(BANC_ALVO_CHAVE, JSON.stringify(bancAlvo)); } catch (e) {}
  ["dlgGerEstudo", "dlgCobertura", "dlgGerCartoes", "dlgMatCartoes"].forEach((id) => { const d = $(id); if (d && d.open) d.close(); });
  trocarModo("cartoes");
  bancAlvoPintar();
  try { const b = $("bancAlvoBox"); if (b && b.scrollIntoView) b.scrollIntoView({ block: "center" }); } catch (e) {}
  try { matReg("cartoes", "bancada apontada para um tópico", disciplina + " › " + topico); } catch (e) {}
}

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
  try { matReg("cartoes", copiou ? "prompt do tópico copiado (bancada)" : "prompt do tópico gerado (sem copiar)", bancAlvo.topico + " · " + txt.length + " caracteres"); } catch (e) {}
}

async function bancAlvoSalvar() {
  if (!bancAlvo) return;
  const r = await validar();
  if (!r || !r.cards.length) return;
  const destino = { disciplina: bancAlvo.disciplina, topico: bancAlvo.topico };
  if (!(await uiConfirm(t("banc_alvo_conf", { n: r.cards.length, t: bancAlvo.disciplina + " › " + bancAlvo.topico })))) return;
  const rec = cmAplicar(r.cards.map((c) => ({ card: c, destino })), bancAlvo.concurso || "", matGravarCartoes);
  cmUltimoRecibo = rec;
  try { guardar("eac_cm_recibo", JSON.stringify(rec)); } catch (e) {}
  try { matReg("cartoes", "cartões da bancada salvos no tópico", bancAlvo.topico + " · " + rec.novos + " novos, " + rec.repetidos + " já existiam"); } catch (e) {}
  if (typeof matRenderLista === "function") { try { matRenderLista(); } catch (e) {} }
  bancAlvoPintar();
  if (!rec.novos) { await uiAlert(t("banc_alvo_nada_novo", { r: rec.repetidos })); return; }
  const ir = await uiEscolha(t("cm_gravados_estudar", { n: rec.novos, t: bancAlvo.topico, r: rec.repetidos }), [
    { valor: "estudar", rot: t("cm_estudar_agora"), classe: "btn-verde" },
    { valor: "ok", rot: t("help_close") },
  ]);
  if (ir === "estudar") estcEstudarTopico(bancAlvo.disciplina, bancAlvo.topico);
}

if (typeof document !== "undefined" && $("bancAlvoBox")) {
  $("btnBancAlvoPrompt").onclick = bancAlvoPrompt;
  $("btnBancAlvoSalvar").onclick = bancAlvoSalvar;
  $("btnBancAlvoSair").onclick = bancAlvoSair;
  $("btnBancAlvoDesfazer").onclick = async () => { await cmDesfazerUltimo(); bancAlvoPintar(); };
  bancAlvo = bancAlvoLer();
  bancAlvoPintar();
}
