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

const ESTC_DICAS = {
  btnEstX: "est_tip_x", btnEstMais: "est_tip_mais", btnEstAnt: "est_tip_ant", btnEstProx: "est_tip_prox",
  btnEstVirar: "est_tip_virar", btnGerEstudar: "est_tip_estudar",
};

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

function estcPintar() {
  const cx = $("estCartao");
  cx.innerHTML = "";
  const u = estcUn[estcI];
  if (!u) return;
  estcMenuFechar();
  const c = u.nota.card;
  cx.scrollTop = 0;
  const onde = [u.nota.disciplina, u.nota.topico].filter(Boolean).join(" › ");
  $("estOnde").textContent = onde + (u.de > 1 ? " · " + t("est_lacuna", { n: u.cn, t: u.de }) : "");
  cx.append(gerEl("div", "est-cab", (c.titulo || "").trim() || u.nota.topico || u.nota.disciplina || ""));
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
  }
  $("estContador").textContent = t("est_pos", { n: estcI + 1, t: estcUn.length });
  const ultimo = estcI >= estcUn.length - 1;
  $("btnEstVirar").textContent = !estcRev ? t("est_virar") : (ultimo ? t("est_concluir") : t("est_prox"));
  $("btnEstVirar").className = "est-virar" + (estcRev ? " est-virar-prox" : "");
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
  estcUn = estcUnidades(lista);
  if (!estcUn.length) { uiAlert(t("est_vazio")); return false; }
  const puro = !marcados && gerPasta && gerPasta.chave && !gerPasta.ramo && !$("gerBusca").value && $("gerFiltro").value === "todos";
  estcChave = puro ? "u|" + gerPasta.chave : "";
  estcI = 0;
  if (o.retomar && estcChave && typeof mcPareiDe === "function") estcI = Math.min(estcUn.length - 1, mcPareiDe(estcChave, estcUn.length));
  estcRev = false; estcEsc = -1; estcSaiba = false;
  dicasDosBotoes(ESTC_DICAS);
  estcPintar();
  abrirModal("dlgGerEstudo");
  try { matReg("estudo", "player da biblioteca aberto", estcUn.length + " cartões" + (estcI ? " · retomado no " + (estcI + 1) : "")); } catch (e) {}
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
  item(t("est_m_editar"), () => { estcFechar(); gerFoco = u.pos; if (gerEhCelular()) gerVista("previa"); gerAcaoEditar(); });
  item(t("est_m_apagar"), estcApagar);
  item(t("est_m_melhorar"), () => { estcFechar(); $("dlgGerCartoes").close(); ceAbrir({ notas: [u.nota] }); });
  if (u.nota.chave !== CQ_BANCADA) {
    /* pela BANCADA: com o editor, a prévia e as ferramentas de melhorar, com este tópico como alvo */
    item(t("est_m_criar"), () => { estcFechar(); bancAlvoDefinir(u.nota.disciplina, u.nota.topico); });
  }
}

async function estcApagar() {
  const u = estcUn[estcI];
  if (!u) return;
  const antes = gerNotas.length;
  await gerAcaoApagar([u.nota]);
  if (gerNotas.length === antes) return;           /* recusou a confirmação: nada mudou */
  /* refaz a fila com o que a lista tem agora, no mesmo ponto */
  const lista = gerVis.map((idx, pos) => ({ nota: gerNotas[idx], pos }));
  estcUn = estcUnidades(lista);
  if (!estcUn.length) { estcFechar(); return; }
  estcI = Math.min(estcI, estcUn.length - 1); estcRev = false; estcEsc = -1; estcSaiba = false;
  estcPintar();
}

/* ---- entrada pela agenda: a biblioteca abre na pasta do tópico e já começa a estudar ---- */
function estcEstudarTopico(disciplina, topico) {
  if (typeof gerAbrirNoTopico === "function") return gerAbrirNoTopico(disciplina, topico, { estudar: true });
  return mcEstudarDireto(disciplina, topico);
}

if (typeof document !== "undefined" && $("dlgGerEstudo")) {
  $("btnEstX").onclick = estcFechar;
  $("btnEstAnt").onclick = () => estcIr(-1);
  $("btnEstProx").onclick = () => estcIr(1);
  $("btnEstVirar").onclick = estcVirar;
  $("btnEstMais").onclick = () => { const m = $("estMenu"); if (!m.hidden) { estcMenuFechar(); return; } estcMenuMontar(); m.hidden = false; };
  $("btnGerEstudar").onclick = () => estcAbrir({});
  const dlg = $("dlgGerEstudo");
  if (typeof dlg.addEventListener === "function") dlg.addEventListener("close", estcAoFechar);
  dlg.onkeydown = (ev) => {
    if (!ev) return;
    const alvo = ev.target && ev.target.tagName;
    if (ev.key === "ArrowRight") { if (ev.preventDefault) ev.preventDefault(); estcIr(1); return; }
    if (ev.key === "ArrowLeft") { if (ev.preventDefault) ev.preventDefault(); estcIr(-1); return; }
    const u = estcUn[estcI];
    if (u && u.nota.card.kind === "mc" && !estcRev && /^[1-9]$/.test(ev.key || "") && +ev.key <= (u.nota.card.options || []).length) { estcEscolher(+ev.key - 1); return; }
    /* espaço / Enter em cima de um botão já dispara o botão: só age quando o foco não está em um */
    if ((ev.key === " " || ev.key === "Enter") && alvo !== "BUTTON") { if (ev.preventDefault) ev.preventDefault(); estcVirar(); }
  };
}
