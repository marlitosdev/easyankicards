/* =====================================================================
 * ESTUDAR OS CARTÕES DA BIBLIOTECA (player)
 *
 * Um cartão de cada vez, em tela cheia no telefone, no jeito do Anki: frente → "Mostrar resposta" → verso →
 * próximo. Vale para uma pasta inteira (tópico, disciplina, edital), para os cartões marcados ou para o que a
 * busca e o filtro deixaram na lista.
 *
 * A UNIDADE DE ESTUDO NÃO É A NOTA — é o que o Anki chama de "cartão":
 *   - Básico e Certo/Errado: uma unidade.
 *   - Múltipla escolha: uma unidade; tocar numa alternativa já revela e mostra se acertou.
 *   - Lacuna: UMA UNIDADE POR NÚMERO DE LACUNA (c1, c2, …). Numa nota com {{c1::…}} e {{c2::…}} estuda-se duas
 *     vezes: na primeira só a c1 fica escondida (a c2 aparece já preenchida), na segunda ao contrário.
 *
 * Nada aqui grava dado do cartão: o player só lê a lista que o gerenciador já filtrou. As ações do menu (editar,
 * apagar, melhorar, criar) chamam as MESMAS funções do gerenciador, com o mesmo desfazer.
 * ===================================================================== */

let estcUn = [], estcI = 0, estcRev = false, estcEsc = -1, estcSaiba = false, estcChave = "";
/* MODO: "agendado" (De novo · Difícil · Bom · Fácil, com o agendador do Anki) ou "sequencia" (passar pela lista sem agenda) */
const ESTC_CH_MODO = "eac_est_modo", ESTC_CH_REGS = "eac_cartao_estudo", ESTC_CH_DIA = "eac_cartao_estudo_dia", ESTC_CH_NOVOS = "eac_est_novos_dia";
let estcModo = "agendado", estcRegs = {}, estcDia = { d: "", novos: 0 }, estcFila = null;
/* a última nota dada no modo agendado, para dar para desfazer (uma vez só — v17.46.0) */
let estcUltima = null;
/* a partir de quantos "De novo" em revisão (lapsos) o cartão é avisado como difícil ("leech", no jeito do Anki) */
const ESTC_LEECH_LIMIAR = 8;

const ESTC_DICAS = {
  btnEstX: "est_tip_x", btnEstMais: "est_tip_mais", btnEstAnt: "est_tip_ant", btnEstProx: "est_tip_prox",
  btnEstVirar: "est_tip_virar", btnGerEstudar: "est_tip_estudar",
  btnEstNota1: "est_tip_nota1", btnEstNota2: "est_tip_nota2", btnEstNota3: "est_tip_nota3", btnEstNota4: "est_tip_nota4",
};

/* ---- a AGENDA dos cartões: um registro por unidade de estudo (guid#cN), guardado no navegador ---- */
function estcHojeISO() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function estcLerJSON(chave, pad) {
  try { const j = JSON.parse(localStorage.getItem(chave) || "null"); return j && typeof j === "object" ? j : pad; } catch (e) { return pad; }
}
function estcCarregarAgenda() {
  estcRegs = estcLerJSON(ESTC_CH_REGS, {});
  const d = estcLerJSON(ESTC_CH_DIA, { d: "", novos: 0 });
  estcDia = d.d === estcHojeISO() ? d : { d: estcHojeISO(), novos: 0 };
  try { const n = Math.round(Number(localStorage.getItem(ESTC_CH_NOVOS))); if (n >= 0 && n <= 999 && localStorage.getItem(ESTC_CH_NOVOS) !== null) AGD.novosDia = n; } catch (e) {}
}
function estcSalvarAgenda() {
  try { localStorage.setItem(ESTC_CH_REGS, JSON.stringify(estcRegs)); localStorage.setItem(ESTC_CH_DIA, JSON.stringify(estcDia)); } catch (e) {}
}
function estcModoLer() {
  try { return localStorage.getItem(ESTC_CH_MODO) === "sequencia" ? "sequencia" : "agendado"; } catch (e) { return "agendado"; }
}
/* escolhe a próxima unidade pelo agendador (estcI = -1 quando não há mais nada por agora) */
function estcProxima() {
  estcFila = agdFila(estcUn, estcRegs, estcDia, Date.now());
  estcI = estcFila.proxima ? estcUn.indexOf(estcFila.proxima) : -1;
  estcRev = false; estcEsc = -1; estcSaiba = false;
}
/* o histórico de um cartão acompanha uma EDIÇÃO dele: o guid nasce do texto, então editar mudaria a identidade */
function estcIdsDoCard(card) { return estcUnidades([{ nota: { card }, pos: 0 }]).map((u) => u.id); }
function estcMigrarAgenda(idsAntes, idsDepois) {
  const regs = estcLerJSON(ESTC_CH_REGS, {});
  let mudou = false;
  idsAntes.forEach((id, k) => {
    const novo = idsDepois[k];
    if (!novo || novo === id || !regs[id]) return;
    if (!regs[novo]) regs[novo] = regs[id];
    delete regs[id]; mudou = true;
  });
  if (mudou) { try { localStorage.setItem(ESTC_CH_REGS, JSON.stringify(regs)); } catch (e) {} estcRegs = regs; }
  return mudou;
}
function estcUnidadesTxt() { return { min: t("agd_u_min"), h: t("agd_u_h"), d: t("agd_u_d"), mes: t("agd_u_mes"), a: t("agd_u_ano") }; }

/* o texto guarda quebra de linha como "<br>": vira quebra de verdade (o CSS preserva) */
function estcTxt(s) { return String(s == null ? "" : s).replace(/<br\s*\/?>/gi, "\n"); }

/* As unidades de estudo de uma lista [{nota, pos}]. `pos` é a posição da nota na lista do gerenciador. */
function estcUnidades(lista) {
  const out = [];
  (lista || []).forEach((it) => {
    const nota = it.nota;
    if (!nota || !nota.card) return;
    const c = nota.card;
    const g = guidDoCartao(c);
    if (c.kind === "mc") { out.push({ nota, pos: it.pos, cn: 0, id: g }); return; }
    const ns = [];
    String(c.front || "").replace(/\{\{c(\d+)::/g, (m, n) => { if (ns.indexOf(+n) < 0) ns.push(+n); return m; });
    if (!ns.length) { out.push({ nota, pos: it.pos, cn: 0, id: g }); return; }
    ns.sort((a, b) => a - b);
    ns.forEach((n) => out.push({ nota, pos: it.pos, cn: n, id: g + "#c" + n, de: ns.length }));
  });
  return out;
}

/* A frente (ou a frente já respondida) de um cartão de lacuna: só a lacuna `cn` fica escondida; as outras já vêm
 * preenchidas, como no Anki. Escondida mostra a dica ("[A ou B?]"); revelada mostra a resposta em destaque. */
function estcClozeNos(pai, texto, cn, rev) {
  const t0 = estcTxt(texto);
  const re = /\{\{c(\d+)::([\s\S]*?)\}\}/g;
  let ult = 0, m;
  while ((m = re.exec(t0))) {
    if (m.index > ult) pai.append(document.createTextNode(t0.slice(ult, m.index)));
    const partes = m[2].split("::");
    const resp = (partes[0] || "").trim();
    const dica = (partes[1] || "").trim();
    if (+m[1] === cn) pai.append(gerEl("span", "est-cl" + (rev ? " est-cl-r" : ""), rev ? resp : "[" + (dica || "…") + "]"));
    else pai.append(document.createTextNode(resp));
    ult = m.index + m[0].length;
  }
  if (ult < t0.length) pai.append(document.createTextNode(t0.slice(ult)));
}

/* "Saiba mais": um conceito por linha, o termo em destaque quando vem no formato "Termo — explicação" */
function estcSaibaMais(cx, more) {
  String(more || "").split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean).forEach((linha) => {
    if (/^-{2,}$/.test(linha)) { cx.append(gerEl("div", "est-hr")); return; }
    const it = gerEl("div", "est-saiba-l");
    const m = linha.match(/^([^—:]{2,60})\s+—\s+([\s\S]+)$/);
    if (m) { it.append(gerEl("b", "", m[1].trim()), document.createTextNode(" — " + m[2].trim())); }
    else it.textContent = linha;
    cx.append(it);
  });
}

/* de onde vem o cartão, para a citação saber o tópico (e quais leis ele tem) */
function estcCitBase(nota) {
  const n = nota || {};
  const c = n.card || {};
  const bancada = typeof CQ_BANCADA !== "undefined" && n.chave === CQ_BANCADA;
  return { disciplina: bancada ? "" : (n.disciplina || ""), topico: bancada ? "" : (n.topico || ""),
    chave: bancada ? "" : (n.chave || ""), onde: "cartao",
    /* o texto inteiro do cartão (frente, verso e "saiba mais"), para achar os OUTROS julgados citados nele (como no
     * resumo, matCitBase) — sem isto o "criar os julgados citados" do cartão nunca achava nenhum */
    textoTodo: () => [c.front, c.back, c.more].filter(Boolean).map(estcTxt).join("\n"),
    aoVoltar: () => { try { const d = $("dlgGerEstudo"); if (d && d.open) estcPintar(); } catch (e) {} } };
}

function estcPintar() {
  const cx = $("estCartao");
  cx.innerHTML = "";
  /* o cartão vai ser redesenhado: a seleção de antes (se houver) não é mais deste texto */
  try { if ($("estBolha")) $("estBolha").hidden = true; } catch (e) {}
  if (estcModo === "agendado" && estcI < 0) { estcPintarFim(cx); return; }
  const u = estcUn[estcI];
  if (!u) return;
  estcMenuFechar();
  const c = u.nota.card;
  cx.scrollTop = 0;
  const onde = [u.nota.disciplina, u.nota.topico].filter(Boolean).join(" › ");
  $("estOnde").textContent = onde + (u.de > 1 ? " · " + t("est_lacuna", { n: u.cn, t: u.de }) : "");
  cx.append(gerEl("div", "est-cab", (c.titulo || "").trim() || u.nota.topico || u.nota.disciplina || ""));
  const reg = estcRegs[u.id];
  if (reg && (reg.l || 0) >= ESTC_LEECH_LIMIAR) cx.append(gerEl("div", "est-leech", t("est_leech", { n: reg.l })));
  const frente = gerEl("div", "est-frente");
  if (c.kind === "mc") {
    frente.append(gerEl("div", "est-txt", estcTxt(c.front)));
    const ops = gerEl("div", "est-ops");
    (c.options || []).forEach((o, i) => {
      const certa = i === c.correct;
      const cls = "est-op" + (estcRev && certa ? " est-op-ok" : "") + (estcRev && estcEsc === i && !certa ? " est-op-erro" : "");
      const b = gerEl("button", cls);
      b.type = "button";
      b.append(gerEl("span", "est-op-l", letra(i)), gerEl("span", "est-op-t", estcTxt(o)));
      b.disabled = estcRev;
      b.onclick = () => estcEscolher(i);
      ops.append(b);
    });
    frente.append(ops);
  } else if (u.cn) {
    const tx = gerEl("div", "est-txt");
    estcClozeNos(tx, c.front, u.cn, estcRev);
    frente.append(tx);
  } else {
    frente.append(gerEl("div", "est-txt", estcTxt(c.front)));
  }
  cx.append(frente);
  if (estcRev) {
    const verso = gerEl("div", "est-verso");
    /* no básico o verso É a resposta; na lacuna e na múltipla escolha ele é a justificativa (a resposta já está na frente) */
    if (c.kind !== "mc" && !u.cn && c.back) {
      verso.append(gerEl("div", "est-hr"), gerEl("div", "est-txt est-resp", estcTxt(c.back)));
    } else if (c.back) {
      verso.append(gerEl("div", "est-just", estcTxt(c.back)));
    }
    cx.append(verso);
    if (c.more) {
      const sb = gerEl("button", "est-saiba-b", "✚ " + t("est_saiba"));
      sb.type = "button";
      const corpo = gerEl("div", "est-saiba");
      estcSaibaMais(corpo, c.more);
      corpo.hidden = !estcSaiba;
      sb.onclick = () => { estcSaiba = !estcSaiba; corpo.hidden = !estcSaiba; };
      cx.append(sb, corpo);
    }
    /* as citações de lei da resposta e do "saiba mais" viram links — básico e múltipla escolha continuam de fora
     * da frente de propósito (K2b em tests/resumo-citacoes.js: "Segundo o art. 113 do CTN, a multa é?" não pode
     * virar link nem depois de virar — a pergunta é igual antes e depois, e um link ali seria um atalho para
     * ler o artigo em vez de responder).
     *
     * A LACUNA É DIFERENTE (v19.33.0): o texto AO REDOR do {{c1::...}} já está à vista desde o início — só o
     * próprio buraco fica escondido ("[…]") — então uma citação ali não entrega nada que a pessoa ainda não via.
     * O relato real: um vínculo criado para "art. 130, § 1º, do ADCT", que mora na frente ao lado da lacuna
     * "{{c1::ano anterior}}", aparecia certo na lista "🔗 vínculos de lei" (que já lia o cartão inteiro) mas
     * nunca ficava clicável — porque citLigarEm nunca rodava sobre a frente, nem na lacuna. Continua sem rodar
     * ANTES de virar: só depois de revelada é que vale a pena tocar num link em vez de tentar responder. */
    const baseCit = estcCitBase(u.nota);
    if (typeof citLigarEm === "function") {
      if (u.cn) { try { citLigarEm(frente, baseCit); } catch (e) {} }
      try { citLigarEm(verso, baseCit); } catch (e) {}
      cx.querySelectorAll && cx.querySelectorAll(".est-saiba").forEach((el) => { try { citLigarEm(el, baseCit); } catch (e) {} });
    }
    /* corrigir um vínculo errado e ligar à mão o que a leitura automática não achou — a mesma ferramenta das
     * questões e do resumo, só que sobre o texto deste cartão (v19.31.0); o texto inteiro (frente + resposta +
     * "saiba mais"), como a lista de citações encontradas também lê (v19.33.0) */
    if (typeof citVincBarra === "function") {
      const comentario = typeof baseCit.textoTodo === "function" ? baseCit.textoTodo() : estcTxt(c.back);
      const barra = citVincBarra(baseCit, () => cx, comentario);
      if (barra) cx.append(barra);
    }
  }
  estcPintarBase(u);
}

/* a parte de baixo: no modo AGENDADO, "mostrar resposta" e depois os quatro botões com o intervalo de cada um e os
 * contadores (novos · aprendendo · revisão); em SEQUÊNCIA, o botão grande e o anterior/próximo. */
function estcPintarBase(u) {
  const ag = estcModo === "agendado";
  $("estNav").hidden = ag; $("estContagem").hidden = !ag;
  $("estNotas").hidden = !(ag && estcRev && u);
  $("btnEstVirar").hidden = ag && estcRev;
  if (ag) {
    const c = (estcFila && estcFila.conta) || { novos: 0, aprender: 0, revisar: 0 };
    const reg = u ? estcRegs[u.id] : null;
    const cat = !u ? "" : (!reg ? "novos" : ((reg.s === "learn" || reg.s === "relearn") ? "aprender" : "revisar"));
    $("estContagem").innerHTML = "";
    [["novos", c.novos], ["aprender", c.aprender], ["revisar", c.revisar]].forEach(([k, n]) => {
      $("estContagem").append(gerEl("span", "est-cn est-cn-" + k + (cat === k ? " est-cn-atual" : ""), String(n)));
    });
    if (u && estcRev) {
      const prev = agdPrevisao(reg, Date.now());
      const sug = u.nota.card.kind === "mc" && estcEsc >= 0 ? (estcEsc === u.nota.card.correct ? 3 : 1) : 0;
      [1, 2, 3, 4].forEach((n, k) => {
        const b = $("btnEstNota" + n);
        b.className = "est-nota est-nota-" + n + (sug === n ? " est-nota-sug" : "");
        b.innerHTML = "";
        b.append(gerEl("span", "est-nota-t", agdFormatar(prev[k], estcUnidadesTxt())), gerEl("span", "est-nota-r", t("est_nota" + n)));
      });
    }
    $("btnEstVirar").textContent = t("est_virar");
    $("btnEstVirar").className = "est-virar";
  } else {
    $("estContador").textContent = t("est_pos", { n: estcI + 1, t: estcUn.length });
    const ultimo = estcI >= estcUn.length - 1;
    $("btnEstVirar").textContent = !estcRev ? t("est_virar") : (ultimo ? t("est_concluir") : t("est_prox"));
    $("btnEstVirar").className = "est-virar" + (estcRev ? " est-virar-prox" : "");
  }
}

/* nada mais por agora: diz quando volta o próximo cartão e oferece passar pela lista em sequência */
function estcPintarFim(cx) {
  $("estOnde").textContent = "";
  const c = (estcFila && estcFila.conta) || { novos: 0, aprender: 0, revisar: 0 };
  const box = gerEl("div", "est-fim");
  box.append(gerEl("div", "est-fim-tit", t("agd_fim")));
  const q = estcFila && estcFila.quando;
  box.append(gerEl("div", "est-fim-sub", q ? t("agd_volta", { q: agdFormatar(Math.max(0, q - Date.now()), estcUnidadesTxt()) }) : t("agd_tudo")));
  const seq = gerEl("button", "btn-min", t("agd_ver_sequencia")); seq.type = "button";
  seq.onclick = () => estcTrocarModo("sequencia");
  const fe = gerEl("button", "btn-min", t("help_close")); fe.type = "button";
  fe.onclick = estcFechar;
  box.append(seq, fe);
  cx.append(box);
  estcPintarBase(null);
  $("btnEstVirar").hidden = true;
  $("estContagem").hidden = false; $("estNav").hidden = true; $("estNotas").hidden = true;
  void c;
}

/* responde o cartão da vez (1 De novo · 2 Difícil · 3 Bom · 4 Fácil) e passa ao próximo pelo agendador */
function estcNota(n) {
  if (estcModo !== "agendado" || !estcRev) return;
  const u = estcUn[estcI];
  if (!u) return;
  const antes = estcRegs[u.id];
  estcUltima = { id: u.id, antes, diaNovosAntes: estcDia.novos || 0, esc: estcEsc };
  if (!antes) estcDia.novos = (estcDia.novos || 0) + 1;
  estcRegs[u.id] = agdResponder(antes, n, Date.now());
  estcSalvarAgenda();
  estcProxima();
  estcPintar();
}

/* desfaz a última nota dada (uma vez só): devolve o cartão ao estado de antes e mostra-o de novo,
 * virado, pronto para notar outra vez — para o toque errado em "De novo"/"Fácil" não ficar valendo. */
function estcDesfazerNota() {
  if (!estcUltima) return;
  const { id, antes, diaNovosAntes, esc } = estcUltima;
  estcUltima = null;
  if (antes) estcRegs[id] = antes; else delete estcRegs[id];
  estcDia.novos = diaNovosAntes;
  estcSalvarAgenda();
  const idx = estcUn.findIndex((x) => x.id === id);
  if (idx < 0) { estcProxima(); estcPintar(); return; }
  estcFila = agdFila(estcUn, estcRegs, estcDia, Date.now());
  estcI = idx; estcRev = true; estcEsc = esc >= 0 ? esc : -1; estcSaiba = false;
  estcPintar();
}

function estcTrocarModo(modo) {
  estcModo = modo === "sequencia" ? "sequencia" : "agendado";
  try { localStorage.setItem(ESTC_CH_MODO, estcModo); } catch (e) {}
  estcRev = false; estcEsc = -1; estcSaiba = false;
  if (estcModo === "agendado") { estcCarregarAgenda(); estcProxima(); }
  else { if (estcI < 0) estcI = 0; }
  estcPintar();
}

function estcEscolher(i) {
  if (estcRev) return;
  estcEsc = i; estcRev = true;
  estcPintar();
}

function estcGuardarPonto() {
  if (!estcChave || typeof mcPareiGuardar !== "function") return;
  mcPareiGuardar(estcChave, estcI, estcUn.length);
}

function estcIr(passo) {
  if (!estcUn.length) return;
  estcI = Math.max(0, Math.min(estcUn.length - 1, estcI + passo));
  estcRev = false; estcEsc = -1; estcSaiba = false;
  estcGuardarPonto();
  estcPintar();
}

/* o botão grande: 1º toque revela; 2º toque passa para o próximo (no último, conclui) */
function estcVirar() {
  if (!estcUn.length) return;
  if (estcModo === "agendado") { if (estcI >= 0 && !estcRev) { estcRev = true; estcPintar(); } return; }
  if (!estcRev) { estcRev = true; estcPintar(); return; }
  if (estcI >= estcUn.length - 1) {
    const n = estcUn.length;
    if (estcChave && typeof mcPareiGuardar === "function") mcPareiGuardar(estcChave, 0, n);
    estcFechar();
    try { gerAviso(t("est_fim", { n }), false); } catch (e) {}
    return;
  }
  estcIr(1);
}

function estcFechar() { const d = $("dlgGerEstudo"); if (d && d.open) d.close(); }

/* ao fechar o player, a biblioteca abre no cartão em que a pessoa parou */
function estcAoFechar() {
  estcMenuFechar();
  estcUltima = null;
  if (estcDeFora) { estcDeFora = null; return; }
  const u = estcUn[estcI];
  if (u && gerVis[u.pos] !== undefined && gerVis[u.pos] === gerNotas.indexOf(u.nota)) {
    gerFoco = u.pos; gerEditando = false;
    try { gerPintarLista(); gerPintarPrevia(); gerPintarAcoes(); } catch (e) {}
  }
}

/* Abre o player sobre a lista de agora do gerenciador: os MARCADOS, se houver; senão tudo o que a lista mostra.
 * `retomar` volta ao cartão em que se parou (só numa pasta de tópico, sem busca nem filtro). */
function estcAbrir(opt) {
  const o = opt || {};
  const marcados = gerSel.size ? Array.from(gerSel).sort((a, b) => a - b) : null;
  const posicoes = marcados || gerVis.map((_, p) => p);
  const lista = posicoes.map((pos) => ({ nota: gerNotas[gerVis[pos]], pos })).filter((x) => x.nota);
  estcDeFora = null;
  estcUltima = null;
  estcUn = estcUnidades(lista);
  if (!estcUn.length) { uiAlert(t("est_vazio")); return false; }
  const puro = !marcados && gerPasta && gerPasta.chave && !gerPasta.ramo && !$("gerBusca").value && $("gerFiltro").value === "todos";
  estcChave = puro ? "u|" + gerPasta.chave : "";
  estcI = 0;
  if (o.retomar && estcChave && typeof mcPareiDe === "function") estcI = Math.min(estcUn.length - 1, mcPareiDe(estcChave, estcUn.length));
  estcRev = false; estcEsc = -1; estcSaiba = false;
  estcModo = estcModoLer();
  if (estcModo === "agendado") { estcCarregarAgenda(); estcProxima(); }
  dicasDosBotoes(ESTC_DICAS);
  estcPintar();
  abrirModal("dlgGerEstudo");
  try { matReg("estudo", "player da biblioteca aberto", estcUn.length + " cartões" + (estcI ? " · retomado no " + (estcI + 1) : "")); } catch (e) {}
  return true;
}

/* (v18.90.0) ESTUDAR UMA LISTA QUALQUER (os cartões de um artigo, de um capítulo da lei): o mesmo player, sem depender
 * da Biblioteca aberta. A agenda é a mesma (o id do cartão vem do conteúdo). Editar e apagar ficam fora do menu — eles
 * trabalham sobre a lista da Biblioteca. A janela de onde se veio continua por baixo. */
let estcDeFora = null;
function estcAbrirLista(notas, opc) {
  const o = opc || {};
  const lista = (notas || []).filter((n) => n && n.card).map((nota, pos) => ({ nota, pos }));
  estcUn = estcUnidades(lista);
  if (!estcUn.length) { uiAlert(t("est_vazio")); return false; }
  estcDeFora = { rotulo: o.rotulo || "" };
  estcUltima = null;
  estcChave = "";
  estcI = 0;
  estcRev = false; estcEsc = -1; estcSaiba = false;
  estcModo = estcModoLer();
  if (estcModo === "agendado") { estcCarregarAgenda(); estcProxima(); }
  dicasDosBotoes(ESTC_DICAS);
  estcPintar();
  abrirModal("dlgGerEstudo");
  try { matReg("estudo", "player aberto numa lista", (o.rotulo ? o.rotulo + " · " : "") + estcUn.length + " cartões"); } catch (e) {}
  return true;
}

/* O texto do botão "Estudar" na barra dos cartões: quantas notas entram (os marcados, ou a lista toda) */
function estcRotulo() {
  const b = $("btnGerEstudar");
  if (!b) return;
  const n = gerSel.size || gerVis.length;
  b.hidden = !n;
  b.textContent = t("est_estudar", { n });
}

/* ---- menu (⋮): as ações de sempre, sobre o cartão que está na tela ---- */
function estcMenuFechar() { const m = $("estMenu"); if (m) m.hidden = true; }

function estcMenuMontar() {
  const m = $("estMenu");
  m.innerHTML = "";
  const u = estcUn[estcI];
  if (!u) return;
  const item = (rot, fn) => { const b = gerEl("button", "est-menu-i", rot); b.type = "button"; b.onclick = () => { estcMenuFechar(); fn(); }; m.append(b); };

  /* exibição: Sequência × Agendado lado a lado, com o modo atual destacado — mais claro do que um único
   * botão cujo rótulo muda (v17.46.0); a dica de cada lado mantém a frase completa de sempre */
  const disp = gerEl("div", "est-menu-disp");
  const optModo = (modo, rot, dica) => {
    const b = gerEl("button", "est-menu-opt" + (estcModo === modo ? " ativa" : ""), rot);
    b.type = "button"; b.title = dica;
    b.onclick = () => { estcMenuFechar(); if (estcModo !== modo) estcTrocarModo(modo); };
    return b;
  };
  disp.append(optModo("sequencia", t("est_m_seq"), t("est_m_modo_seq")), optModo("agendado", t("est_m_agd"), t("est_m_modo_agd")));
  m.append(disp);
  if (estcModo === "agendado") item(t("est_m_novos", { n: AGD.novosDia }), estcMudarNovos);
  m.append(gerEl("div", "est-menu-div"));

  if (estcModo === "agendado" && estcUltima) item(t("est_m_desfazer"), estcDesfazerNota);
  if (!estcDeFora) {
    /* (19.45.0) editar, mover e melhorar VOLTAM AO ESTUDO, no mesmo cartão: antes fechavam o player e deixavam a
     * pessoa na Biblioteca, tendo de reabrir a lista e achar de novo onde estava */
    item(t("est_m_editar"), () => {
      estcPausa = estcFoto(u.nota); estcFechar();
      if (!estcFocarNaBiblioteca(u.nota)) { estcAposEditar(null, null); return; }
      if (gerEhCelular()) gerVista("previa"); gerAcaoEditar();
    });
    /* mover nem fecha o player: a janela do destino abre por cima dele */
    item(t("est_m_mover"), () => { gerDestAbrir([u.nota], { aoMover: (r) => estcAposMover(r) }); });
    item(t("est_m_apagar"), estcApagar);
  }
  item(t("est_m_melhorar"), () => {
    const estudo = estcDeFora ? null : estcFoto(u.nota);
    estcFechar(); const pasta = typeof gerPasta !== "undefined" ? gerPasta : null; $("dlgGerCartoes").close();
    ceAbrir({ notas: [u.nota], volta: { pasta, estudo } });
  });
  if (u.nota.chave !== CQ_BANCADA) {
    /* pela BANCADA: com o editor, a prévia e as ferramentas de melhorar, com este tópico como alvo */
    item(t("est_m_criar"), () => { estcFechar(); bancAlvoDefinir(u.nota.disciplina, u.nota.topico); });
  }
  item(t("est_m_relatar"), estcRelatarAbrir);
}

/* =====================================================================
 * "RELATAR PROBLEMA DESTE CARTÃO" (v19.34.0)
 *
 * Diagnosticar um relato como "o vínculo existe mas não é clicável" (v19.33.0) levou várias rodadas de
 * reprodução às cegas — screenshot, hipótese, Playwright — porque nada no app guardava, num texto só, o que
 * o cartão tinha por dentro (frente crua com {{c1::…}}, se é lacuna ou básico) e o que os vínculos diziam
 * sobre ele. O mesmo texto que eu pediria para reproduzir, pronto para colar.
 *
 * Mesma ideia do "registro dos resumos" (matLogTexto/matLogAbrir): um texto simples, copiável, sem telemetria
 * nenhuma — tudo sai do que já está no aparelho (o cartão, os vínculos, o registro da agenda), nada é
 * enviado a lugar nenhum sozinho.
 * ===================================================================== */
function estcRelatarTexto(u) {
  if (!u) return "";
  const n = u.nota, c = n.card;
  const onde = [n.disciplina, n.topico].filter(Boolean).join(" › ") || "(bancada)";
  const tipo = c.kind === "mc" ? "múltipla escolha" : (u.cn ? "lacuna (c" + u.cn + " de " + (u.de || 1) + ")" : "básico/certo-errado");
  const linhas = [
    "RELATÓRIO DO CARTÃO — v" + (typeof VERSAO !== "undefined" ? VERSAO : "?"),
    new Date().toISOString(),
    "",
    onde,
    "tipo: " + tipo + " · modo: " + estcModo + (estcRev ? " · virado" : " · não virado"),
    "",
    "FRENTE (como foi digitada, com {{c::}} se houver):",
    String(c.front || "") || "(vazia)",
    "",
    "RESPOSTA:",
    String(c.back || "") || "(vazia)",
  ];
  if (c.more) linhas.push("", "SAIBA MAIS:", String(c.more));
  const chave = n.disciplina && n.topico && typeof matChave === "function" ? matChave(n.disciplina, n.topico) : "";
  let vinc = [];
  try { vinc = (typeof citVinculosLer === "function" ? citVinculosLer() : []).filter((v) => !v.chave || v.chave === chave); } catch (e) {}
  if (vinc.length) {
    linhas.push("", "VÍNCULOS (" + vinc.length + "):");
    vinc.forEach((v) => {
      const alvo = v.nenhum ? "desligado (fica como texto)"
        : v.tipo === "jur" ? "julgado " + (v.jurId || "?")
        : "lei " + (v.leiId || "?") + " · art. " + (v.artigos || []).map((a) => a.numCru).join(", ");
      linhas.push("  · \"" + v.trecho + "\" → " + alvo + (v.chave ? " · só neste tópico" : " · todo o app"));
    });
  } else {
    linhas.push("", "VÍNCULOS: nenhum para este tópico.");
  }
  if (estcModo === "agendado") {
    const reg = estcRegs[u.id];
    linhas.push("", "AGENDA: " + (reg ? JSON.stringify(reg) : "cartão novo, sem registro ainda"));
  }
  return linhas.join("\n");
}

function estcRelatarAbrir() {
  const u = estcUn[estcI];
  if (!u || !$("dlgEstRelatar")) return;
  $("estRelatarTexto").value = estcRelatarTexto(u);
  abrirModal("dlgEstRelatar");
  try { reg("ESTUDO", "relatório do cartão aberto", [u.nota.disciplina, u.nota.topico].filter(Boolean).join(" › ")); } catch (e) {}
}

async function estcMudarNovos() {
  const v = await uiTexto(t("est_novos_tit"), String(AGD.novosDia));
  if (v === null || v === undefined) return;
  const n = Math.round(Number(String(v).replace(",", ".")));
  if (!(n >= 0 && n <= 999)) return;
  AGD.novosDia = n;
  try { localStorage.setItem(ESTC_CH_NOVOS, String(n)); } catch (e) {}
  estcProxima(); estcPintar();
}

async function estcApagar() {
  const u = estcUn[estcI];
  if (!u) return;
  const antes = gerNotas.length;
  await gerAcaoApagar([u.nota]);
  if (gerNotas.length === antes) return;           /* recusou a confirmação: nada mudou */
  estcUltima = null;                                /* a lista mudou: a nota desfeita podia ser deste cartão */
  /* refaz a fila com o que a lista tem agora, no mesmo ponto */
  const lista = gerVis.map((idx, pos) => ({ nota: gerNotas[idx], pos }));
  estcUn = estcUnidades(lista);
  if (!estcUn.length) { estcFechar(); return; }
  estcI = Math.min(estcI, estcUn.length - 1); estcRev = false; estcEsc = -1; estcSaiba = false;
  if (estcModo === "agendado") estcProxima();
  estcPintar();
}

/* =====================================================================
 * (19.45.0) A LISTA EM ESTUDO SOBREVIVE A MOVER, EDITAR E MELHORAR UM CARTÃO
 *
 * O relato: "ao mover o cartão para outro tópico, a lista que eu estudava fecha e caio na Biblioteca". Agora:
 *  · mover abre o destino POR CIMA do player; movido, o player segue no mesmo cartão (já com o tópico novo);
 *  · editar usa o editor da Biblioteca (é lá que ele mora) e, ao salvar ou cancelar, o estudo reabre no cartão;
 *  · melhorar leva a foto do estudo junto e, ao voltar da tela de melhorar, reabre a lista no mesmo ponto.
 * Depois de cada mudança a Biblioteca relê os cartões (objetos novos): a lista em estudo troca cada cartão pelo
 * seu equivalente novo, achado pelo conteúdo — o editado, pelo texto que acabou de ser salvo.
 * ===================================================================== */
let estcPausa = null;    /* a foto do estudo enquanto o cartão é editado na Biblioteca */

function estcFoto(nota) {
  return { un: estcUn, i: estcI, chave: estcChave, rev: estcRev, nota };
}

function estcChaveCard(c) { return [c.kind || "", c.front || "", c.back || ""].join("\u0001"); }

/* troca as notas da lista pelas que a Biblioteca tem agora; `trocas` (nota velha → card novo) é o que foi editado */
function estcRefrescar(trocas) {
  const notas = typeof gerNotas !== "undefined" ? gerNotas : [];
  const porCard = new Map();
  notas.forEach((n, idx) => { if (n && n.card) porCard.set(estcChaveCard(n.card), idx); });
  const atual = estcUn[estcI];
  const novaDe = new Map();
  const lista = [];
  estcUn.forEach((u) => {
    if (novaDe.has(u.nota)) return;
    const card = (trocas && trocas.get(u.nota)) || u.nota.card;
    const idx = porCard.get(estcChaveCard(card));
    const nova = idx === undefined ? u.nota : notas[idx];
    novaDe.set(u.nota, nova);
    const pos = idx === undefined || typeof gerVis === "undefined" ? -1 : gerVis.indexOf(idx);
    lista.push({ nota: nova, pos });
  });
  estcUn = estcUnidades(lista);
  if (!estcUn.length) return false;
  const alvo = atual ? novaDe.get(atual.nota) : null;
  let k = alvo ? estcUn.findIndex((u) => u.nota === alvo && u.cn === atual.cn) : -1;
  if (k < 0 && alvo) k = estcUn.findIndex((u) => u.nota === alvo);
  estcI = k >= 0 ? k : Math.min(Math.max(estcI, 0), estcUn.length - 1);
  return true;
}

/* põe o foco da Biblioteca neste cartão — na pasta dele, se ele não está na lista de agora (foi movido, p. ex.) */
function estcFocarNaBiblioteca(nota) {
  const idx = gerNotas.indexOf(nota);
  if (idx < 0) return false;
  let pos = gerVis.indexOf(idx);
  if (pos < 0 && nota.chave) {
    gerPasta = { chave: nota.chave };
    try { gerAbrirCaminho(nota.chave); } catch (e) {}
    gerRefiltrar(); gerPintar();
    pos = gerVis.indexOf(idx);
  }
  if (pos < 0) return false;
  gerFoco = pos; gerEditando = false;
  return true;
}

/* reabre o player a partir de uma foto (editar, melhorar) */
function estcRetomar(foto, trocas) {
  if (!foto || !foto.un || !foto.un.length) return false;
  estcUn = foto.un; estcI = foto.i; estcChave = foto.chave || "";
  estcDeFora = null; estcUltima = null;
  if (!estcRefrescar(trocas)) return false;
  estcModo = estcModoLer();
  if (estcModo === "agendado") estcCarregarAgenda();
  estcRev = !!foto.rev; estcEsc = -1; estcSaiba = false;
  dicasDosBotoes(ESTC_DICAS);
  estcPintar();
  abrirModal("dlgGerEstudo");
  try { matReg("estudo", "estudo retomado depois de mexer no cartão", estcUn.length + " cartões · no " + (estcI + 1)); } catch (e) {}
  return true;
}

/* chamado pela Biblioteca ao salvar (card novo) ou cancelar (null) a edição: só se for o cartão que saiu do estudo */
function estcAposEditar(nota, cardNovo) {
  const p = estcPausa;
  if (!p || (nota && nota !== p.nota)) return false;
  estcPausa = null;
  return estcRetomar(p, cardNovo ? new Map([[p.nota, cardNovo]]) : null);
}

/* movido com o player aberto: a lista continua, no mesmo cartão */
function estcAposMover(r) {
  const d = $("dlgGerEstudo");
  if (!d || !d.open) return false;
  estcUltima = null;
  if (!estcRefrescar(null)) { estcFechar(); return false; }
  estcPintar();
  try {
    if (r && r.ligados !== undefined) toastMsg(t("ger_feito_ramo", { n: r.ligados, m: r.movidos }), 3500);
    else if (r) toastMsg(t("ger_feito_mover", { n: r.movidos, m: r.repetidos, k: r.naoAchou }), 3500);
  } catch (e) {}
  return true;
}

/* ---- entrada pela agenda: a biblioteca abre na pasta do tópico e já começa a estudar ---- */
function estcEstudarTopico(disciplina, topico) {
  try { if (typeof matLembrarRecente === "function" && disciplina && topico) matLembrarRecente("cartoes", disciplina, topico); } catch (e) {}
  if (typeof gerAbrirNoTopico === "function") return gerAbrirNoTopico(disciplina, topico, { estudar: true });
  return mcEstudarDireto(disciplina, topico);
}

/* =====================================================================
 * A BOLHA DA SELEÇÃO, TAMBÉM NO CARTÃO (v19.32.0)
 *
 * O relato real: selecionar "art. 130, § 1º, do ADCT" na resposta e tentar vincular não dava em nada visível, e
 * sem aviso nenhum. Dois motivos se somavam: a barra fixa (citVincBarra) fica depois do "saiba mais", rolada para
 * fora da vista — e o PRÓPRIO trecho já era um link automático (<button>): arrastar o dedo A PARTIR de um botão
 * não inicia seleção de texto (o gesto vira "pressionar o botão", não "selecionar" — conferido à mão: a seleção
 * fica vazia), então às vezes nem chegava a marcar nada, e por isso também não havia o que avisar.
 *
 * Esta bolha é a MESMA barra (citVincBarra), só que aparece JUNTO da seleção — como no resumo (matBolhaAtualizar)
 * — para quem selecionar um trecho AINDA NÃO RECONHECIDO não ter de rolar até o fim da resposta para achar onde
 * vincular. Some sozinha quando a seleção some. Ela NÃO resolve corrigir uma citação que JÁ é link: para essa, o
 * caminho de sempre não depende de selecionar nada — tocar no PRÓPRIO link abre a prévia, com "ligar a outro
 * julgado/lei" ou "desligar" (leiCitaOutro/leiCitaDesligar, jurCitOutro/jurCitDesligar); e a barra fixa também
 * lista todas as citações do cartão com "este vínculo está errado", sem seleção nenhuma.
 * ===================================================================== */
function estcBolhaDoca() {
  try {
    if (typeof window === "undefined") return false;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
    return (window.innerWidth || 1000) < 700;
  } catch (e) { return false; }
}

function estcBolhaAtualizar(selFake) {
  const b = $("estBolha");
  if (!b) return false;
  let rect = null;
  try {
    const dlg = $("dlgGerEstudo");
    const cx = $("estCartao");
    const sel = selFake || (typeof window !== "undefined" && window.getSelection ? window.getSelection() : null);
    if (dlg && dlg.open && estcRev && cx && sel && !sel.isCollapsed && String(sel).trim()
        && sel.anchorNode && cx.contains && cx.contains(sel.anchorNode)) {
      rect = sel.rangeCount && sel.getRangeAt ? sel.getRangeAt(0).getBoundingClientRect() : { top: 0, bottom: 0, left: 0, width: 0 };
    }
  } catch (e) { rect = null; }
  const u = estcUn[estcI];
  if (!rect || !u) { b.hidden = true; return false; }
  b.innerHTML = "";
  if (typeof citVincBarra === "function") {
    const base = estcCitBase(u.nota);
    const comentario = [estcTxt(u.nota.card.back), u.nota.card.more ? estcTxt(u.nota.card.more) : ""].filter(Boolean).join("\n");
    const barra = citVincBarra(base, () => $("estCartao"), comentario);
    if (barra) Array.from(barra.childNodes).forEach((el) => b.append(el));
  }
  if (!b.childNodes.length) { b.hidden = true; return false; }
  b.hidden = false;
  const doca = estcBolhaDoca();
  if (b.classList) b.classList.toggle("mat-bolha-doca", doca);
  if (!doca && b.style) {
    const alto = (b.offsetHeight || 40), larg = (b.offsetWidth || 320);
    const jan = (typeof window !== "undefined" && window.innerWidth) || 1000;
    let topo = rect.top - alto - 8;
    if (topo < 8) topo = rect.bottom + 8;
    const esq = Math.max(8, Math.min(rect.left + (rect.width || 0) / 2 - larg / 2, jan - larg - 8));
    b.style.top = Math.round(topo) + "px";
    b.style.left = Math.round(esq) + "px";
  }
  return true;
}

if (typeof document !== "undefined" && $("dlgGerEstudo")) {
  $("btnEstX").onclick = estcFechar;
  $("btnEstAnt").onclick = () => estcIr(-1);
  $("btnEstProx").onclick = () => estcIr(1);
  $("btnEstVirar").onclick = estcVirar;
  [1, 2, 3, 4].forEach((n) => { $("btnEstNota" + n).onclick = () => estcNota(n); });
  $("btnEstMais").onclick = () => { const m = $("estMenu"); if (!m.hidden) { estcMenuFechar(); return; } estcMenuMontar(); m.hidden = false; };
  $("btnGerEstudar").onclick = () => estcAbrir({});
  const dlg = $("dlgGerEstudo");
  if (typeof dlg.addEventListener === "function") dlg.addEventListener("close", estcAoFechar);
  /* a bolha da seleção (v19.32.0): aparece/atualiza com a seleção, some ao fechar o player */
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("selectionchange", () => { try { estcBolhaAtualizar(); } catch (e) {} });
  }
  if ($("estCartao") && $("estCartao").addEventListener) {
    $("estCartao").addEventListener("scroll", () => { try { estcBolhaAtualizar(); } catch (e) {} });
  }
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", () => { try { estcBolhaAtualizar(); } catch (e) {} });
  }
  if (typeof dlg.addEventListener === "function") {
    dlg.addEventListener("close", () => { if ($("estBolha")) $("estBolha").hidden = true; });
  }
  /* apertar um botão da bolha não pode desfazer a seleção que ele vai usar (como na bolha do resumo) */
  if ($("estBolha") && $("estBolha").addEventListener) {
    $("estBolha").addEventListener("mousedown", (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); });
  }
  /* "relatar problema deste cartão" (v19.34.0) */
  if ($("btnEstRelatarCopiar")) {
    $("btnEstRelatarCopiar").onclick = () => {
      try { navigator.clipboard.writeText($("estRelatarTexto").value); } catch (e) {}
      try { toast("est_rel_copiado"); } catch (e) {}
    };
  }
  if ($("btnEstRelatarFechar")) $("btnEstRelatarFechar").onclick = () => $("dlgEstRelatar").close();
  dlg.onkeydown = (ev) => {
    if (!ev) return;
    const alvo = ev.target && ev.target.tagName;
    /* agendado: 1-4 dão a nota (depois de mostrar a resposta) e espaço/Enter dão "Bom", como no Anki */
    if (estcModo === "agendado" && estcRev && /^[1-4]$/.test(ev.key || "")) { if (ev.preventDefault) ev.preventDefault(); estcNota(+ev.key); return; }
    if (estcModo === "agendado" && estcRev && (ev.key === " " || ev.key === "Enter") && alvo !== "BUTTON") { if (ev.preventDefault) ev.preventDefault(); estcNota(3); return; }
    if (estcModo === "agendado" && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) return;
    if (ev.key === "ArrowRight") { if (ev.preventDefault) ev.preventDefault(); estcIr(1); return; }
    if (ev.key === "ArrowLeft") { if (ev.preventDefault) ev.preventDefault(); estcIr(-1); return; }
    const u = estcUn[estcI];
    if (u && u.nota.card.kind === "mc" && !estcRev && /^[1-9]$/.test(ev.key || "") && +ev.key <= (u.nota.card.options || []).length) { estcEscolher(+ev.key - 1); return; }
    /* espaço / Enter em cima de um botão já dispara o botão: só age quando o foco não está em um */
    if ((ev.key === " " || ev.key === "Enter") && alvo !== "BUTTON") { if (ev.preventDefault) ev.preventDefault(); estcVirar(); }
  };
}
