/* =====================================================================
 * A PELÍCULA — grifar o enunciado enquanto se lê
 *
 * Numa prova de papel a primeira coisa que se faz num enunciado longo é
 * riscar: circula o "EXCETO", sublinha o prazo, corta o que é enfeite.
 * Isso não é decoração — é o que impede o erro de ler "não" onde está
 * escrito "não" e responder como se não estivesse.
 *
 * TRÊS DECISÕES QUE MOLDAM O RESTO:
 *
 * 1. A PELÍCULA COBRE SÓ O ENUNCIADO. Uma camada por cima das
 *    alternativas engoliria os cliques delas, e o gesto de responder é o
 *    mais importante da tela. A camada é filha do bloco do enunciado, e
 *    termina onde ele termina.
 *
 * 2. ELA NASCE DESLIGADA, e desligada NÃO INTERCEPTA NADA
 *    (pointer-events: none). Uma tela transparente sempre ativa impede
 *    selecionar o texto — e selecionar o enunciado para copiar é
 *    justamente o outro pedido desta mesma tela. Ligar é um clique; o
 *    padrão é o texto continuar sendo texto.
 *
 * 3. AS MARCAS NÃO SÃO SALVAS. Foi o pedido, e é o certo: elas
 *    pertencem à leitura daquele momento, não à questão. Guardá-las
 *    faria a segunda tentativa começar com as pistas da primeira — que
 *    é exatamente o que arruína uma segunda tentativa. Trocar de questão
 *    limpa a folha.
 *
 * As canetas e os tamanhos de borracha vêm do rascunho, sem cópia: são o
 * mesmo gesto em outra superfície, e dois jogos de ferramenta na mesma
 * tela seriam duas convenções para a pessoa decorar.
 * ===================================================================== */

let plQid = null;         /* questão a que esta película pertence */
let plTracos = [];
let plCaneta = "vermelha"; /* vermelho: no papel, é a cor de quem grifa */
let plBorracha = false;
let plDesenhando = false;
let plLigada = false;
let plBotoes = {};
let plCx = null;          /* o contêiner posicionado */
let plTela = null;        /* o canvas */

/* ---------------------------------------------------------------------
 * MONTAR SOBRE O ENUNCIADO
 * ------------------------------------------------------------------ */

/* Recebe o elemento do enunciado JÁ PRONTO e devolve um bloco que o
 * contém, mais a camada e a barrinha de ferramentas. Quem chama continua
 * mandando no conteúdo do enunciado; a película não o toca. */
function plEnvolver(en, qid) {
  if (!en) return null;
  plQid = qid == null ? null : String(qid);
  plTracos = [];
  plBorracha = false;
  plLigada = false;
  plBotoes = {};

  const cx = document.createElement("div");
  cx.className = "pl-cx";

  const tela = document.createElement("canvas");
  tela.className = "pl-tela";
  tela.id = "plTela";
  /* tamanho interno fixo; o CSS estica. Mesmo esquema do rascunho, pelo
   * mesmo motivo: sem a conversão de coordenadas o traço aparece
   * deslocado do dedo, e o erro cresce quanto menor o aparelho. */
  tela.width = 900;
  tela.height = 420;

  cx.append(en, tela);
  plCx = cx;
  plTela = tela;
  plLigar(false);
  plAmarrarPonteiro(tela);
  return cx;
}

/* A barra fica FORA do contêiner do enunciado, abaixo dele: dentro, ela
 * disputaria espaço com o texto e ficaria por baixo da própria película. */
function plBarra() {
  const barra = document.createElement("div");
  barra.className = "pl-barra";

  const bLig = document.createElement("button");
  bLig.type = "button";
  bLig.id = "btnPlLigar";
  bLig.className = "btn-min";
  bLig.textContent = t("pl_ligar");
  bLig.title = t("pl_ligar_ajuda");
  bLig.onclick = () => plLigar(!plLigada);
  plBotoes.ligar = bLig;
  barra.append(bLig);

  const fer = document.createElement("span");
  fer.className = "pl-fer";
  fer.id = "plFerramentas";

  (typeof RS_CANETAS !== "undefined" ? RS_CANETAS : []).forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "btnPlCaneta_" + c.id;
    b.className = "rs-caneta";
    b.style.background = c.cor;
    b.title = t("rs_caneta_" + c.id);
    b.setAttribute("aria-label", t("rs_caneta_" + c.id));
    b.onclick = () => {
      plCaneta = c.id; plBorracha = false;
      /* escolher caneta LIGA a película: ninguém escolhe a cor de uma
       * ferramenta que não pretende usar em seguida */
      plLigar(true);
    };
    plBotoes[c.id] = b;
    fer.append(b);
  });

  const bb = document.createElement("button");
  bb.type = "button";
  bb.id = "btnPlBorracha";
  bb.className = "btn-min rs-borracha";
  bb.textContent = t("rs_borracha");
  bb.title = t("rs_borracha_ajuda");
  bb.onclick = () => { plBorracha = !plBorracha; plLigar(true); };
  plBotoes.borracha = bb;
  fer.append(bb);

  (typeof RS_BORRACHAS !== "undefined" ? RS_BORRACHAS : []).forEach((x) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = "btnPlBorracha_" + x.id;
    b.className = "rs-bsize";
    b.title = t("rs_borracha_tam_" + x.id);
    b.setAttribute("aria-label", t("rs_borracha_tam_" + x.id));
    const d = Math.round(6 + x.raio * 0.32);
    b.style.width = d + "px";
    b.style.height = d + "px";
    b.onclick = () => {
      if (typeof rsBorrachaDefinir === "function") rsBorrachaDefinir(x.raio);
      plBorracha = true;
      plLigar(true);
    };
    plBotoes["b_" + x.id] = b;
    fer.append(b);
  });

  const bl = document.createElement("button");
  bl.type = "button";
  bl.id = "btnPlLimpar";
  bl.className = "btn-min";
  bl.textContent = t("pl_limpar");
  bl.title = t("pl_limpar_ajuda");
  bl.onclick = () => plLimpar();
  plBotoes.limpar = bl;
  fer.append(bl);

  barra.append(fer);
  plBotoes.fer = fer;
  plPintarFerramentas();
  return barra;
}

/* ---------------------------------------------------------------------
 * LIGAR E DESLIGAR
 * ------------------------------------------------------------------ */

function plLigar(sim) {
  plLigada = !!sim;
  if (plTela) {
    /* DESLIGADA NÃO INTERCEPTA NADA. É o que devolve ao enunciado a
     * condição de texto: selecionável, copiável, com o link e o clique
     * das alternativas passando direto. */
    plTela.className = "pl-tela" + (plLigada ? " pl-on" : "");
    plTela.style.pointerEvents = plLigada ? "auto" : "none";
  }
  const b = plBotoes.ligar;
  if (b) {
    b.textContent = t(plLigada ? "pl_desligar" : "pl_ligar");
    b.title = t(plLigada ? "pl_desligar_ajuda" : "pl_ligar_ajuda");
    if (b.classList) b.classList.toggle("btn-min-ok", plLigada);
  }
  const fer = $("plFerramentas");
  if (fer) fer.hidden = !plLigada;
  plPintarFerramentas();
  return plLigada;
}

function plLigada_() { return plLigada; }

function plPintarFerramentas() {
  /* AS FERRAMENTAS SÓ EXISTEM ENQUANTO SE GRIFA.
   * Sete botões — quatro cores, borracha, dois tamanhos — ocupavam uma
   * faixa inteira entre o enunciado e as alternativas em TODA questão,
   * inclusive nas que ninguém marca. E o custo não é só estético: é essa
   * faixa que empurrava o "Próxima" para fora da tela. Desligada, sobra
   * um botão só, "grifar", que é a porta de entrada. */
  if (plBotoes.fer) plBotoes.fer.hidden = !plLigada;
  (typeof RS_CANETAS !== "undefined" ? RS_CANETAS : []).forEach((c) => {
    const b = plBotoes[c.id];
    if (b) b.className = "rs-caneta"
      + (!plBorracha && plCaneta === c.id ? " rs-sel" : "");
  });
  if (plBotoes.borracha) {
    plBotoes.borracha.className = "btn-min rs-borracha"
      + (plBorracha ? " rs-sel" : "");
  }
  const raio = typeof rsBorrachaRaio !== "undefined" ? rsBorrachaRaio : 15;
  (typeof RS_BORRACHAS !== "undefined" ? RS_BORRACHAS : []).forEach((x) => {
    const b = plBotoes["b_" + x.id];
    if (b) b.className = "rs-bsize" + (x.raio === raio ? " rs-sel" : "");
  });
}

/* ---------------------------------------------------------------------
 * DESENHAR
 * ------------------------------------------------------------------ */

function plCoords(e) {
  const cv = plTela;
  if (!cv) return [0, 0];
  const r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
  if (r && r.width) {
    return [((e.clientX || 0) - r.left) * (cv.width / r.width),
            ((e.clientY || 0) - r.top) * (cv.height / r.height)];
  }
  return [e.offsetX || 0, e.offsetY || 0];
}

function plCanetaAtual() {
  const lista = typeof RS_CANETAS !== "undefined" ? RS_CANETAS : [];
  return lista.filter((c) => c.id === plCaneta)[0] || lista[0]
    || { cor: "#d62828", larg: 2.6 };
}

function plComecar(e) {
  if (!plLigada) return;
  const [x, y] = plCoords(e);
  if (plBorracha) { plApagarEm(x, y); plDesenhando = true; return; }
  const c = plCanetaAtual();
  /* GRIFO, NÃO CANETA FINA. Sobre texto, o traço tem de ser largo e
   * translúcido — senão ele cobre a palavra que estava tentando
   * destacar, e o destaque vira rasura. */
  plTracos.push({ cor: c.cor, larg: 11, pontos: [[x, y]] });
  plDesenhando = true;
  plPintar();
}

function plMover(e) {
  if (!plDesenhando) return;
  const [x, y] = plCoords(e);
  if (plBorracha) { plApagarEm(x, y); return; }
  const tr = plTracos[plTracos.length - 1];
  if (!tr) return;
  const ult = tr.pontos[tr.pontos.length - 1];
  if (ult && Math.abs(ult[0] - x) < 1 && Math.abs(ult[1] - y) < 1) return;
  tr.pontos.push([x, y]);
  plPintar();
}

function plSoltar() {
  if (!plDesenhando) return;
  plDesenhando = false;
  const tr = plTracos[plTracos.length - 1];
  if (tr && tr.pontos.length === 1) {
    tr.pontos.push([tr.pontos[0][0] + 0.6, tr.pontos[0][1] + 0.6]);
  }
  plPintar();
}

function plApagarEm(x, y) {
  const raio = typeof rsBorrachaRaio !== "undefined" ? rsBorrachaRaio : 15;
  const antes = plTracos.length;
  plTracos = plTracos.filter((tr) => !tr.pontos.some((p) =>
    Math.abs(p[0] - x) <= raio && Math.abs(p[1] - y) <= raio));
  if (plTracos.length !== antes) plPintar();
}

/* Sem confirmação, de propósito: aqui não há nada a perder, porque nada
 * é salvo. Perguntar antes de apagar um grifo que morre ao virar a
 * questão seria cerimônia sem conteúdo. */
function plLimpar() {
  plTracos = [];
  plPintar();
  return true;
}

function plPintar() {
  const cv = plTela;
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  plTracos.forEach((tr) => {
    if (!tr.pontos.length) return;
    ctx.beginPath();
    ctx.strokeStyle = tr.cor;
    ctx.lineWidth = tr.larg;
    /* translúcido: o grifo tem de deixar a palavra legível por baixo */
    ctx.globalAlpha = 0.32;
    tr.pontos.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function plAmarrarPonteiro(cv) {
  if (!cv) return;
  cv.onpointerdown = (e) => {
    if (!plLigada) return;
    if (e.preventDefault) e.preventDefault();
    if (cv.setPointerCapture && e.pointerId != null) {
      try { cv.setPointerCapture(e.pointerId); } catch (e2) {}
    }
    plComecar(e);
  };
  cv.onpointermove = (e) => {
    if (plDesenhando && e.preventDefault) e.preventDefault();
    plMover(e);
  };
  cv.onpointerup = () => plSoltar();
  cv.onpointercancel = () => plSoltar();
  cv.onpointerleave = () => plSoltar();
}

/* ---------------------------------------------------------------------
 * COPIAR O TEXTO DA QUESTÃO
 *
 * O que se copia daqui vai para uma IA, para um caderno ou para um
 * colega — e em todos esses destinos o enunciado sozinho costuma não
 * bastar. Por isso as duas caixas vêm MARCADAS: o caso comum é querer o
 * pacote inteiro, e quem quiser só o enunciado desmarca.
 *
 * O gabarito sai por extenso ("Certo" / "Errado"), não como a letra
 * solta: "C" fora do aplicativo não quer dizer nada.
 * ------------------------------------------------------------------ */

let plIncluirGab = true;
let plIncluirDica = true;

function plTextoDaQuestao(q, opc) {
  if (!q) return "";
  const o = opc || {};
  const L = [];
  const cab = [q.concurso, q.banca, q.disciplina, q.topico].filter(Boolean);
  if (cab.length) L.push(cab.join(" · "));
  if (q.tipo === "ce") L.push(t("qs_julgue"));
  L.push(String(q.enunciado || ""));
  (q.opcoes || []).forEach((x) => {
    L.push(String(x.letra) + ") " + String(x.txt));
  });
  if (o.gabarito) {
    const g = q.tipo === "ce"
      ? (q.gabarito === "C" ? t("qs_certo") : t("qs_errado"))
      : q.gabarito;
    L.push("");
    L.push(t("pl_copia_gab", { g }));
    if (String(q.comentario || "").trim()) {
      L.push(t("pl_copia_coment", { c: q.comentario }));
    }
  }
  if (o.dica) {
    let d = "";
    try { d = (typeof qsDicaDeQuestao === "function" && qsDicaDeQuestao(q.id)) || ""; }
    catch (e) { d = ""; }
    if (String(d).trim()) {
      L.push("");
      L.push(t("pl_copia_dica", { d }));
    }
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* A barra de copiar: o botão e as duas caixas, lado a lado. As caixas
 * ficam VISÍVEIS, não escondidas atrás de um menu — a escolha muda o que
 * vai para a área de transferência, e escolha invisível vira surpresa. */
function plBarraCopiar(q) {
  const cx = document.createElement("div");
  cx.className = "pl-copiar";

  const b = document.createElement("button");
  b.type = "button";
  b.id = "btnPlCopiar";
  b.className = "btn-min";
  b.textContent = t("pl_copiar");
  b.title = t("pl_copiar_ajuda");
  b.onclick = () => {
    const txt = plTextoDaQuestao(q, { gabarito: plIncluirGab, dica: plIncluirDica });
    try { navigator.clipboard.writeText(txt); } catch (e) {}
    const antes = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = antes; }, 1800);
    try {
      matReg("questao", "texto da questão copiado",
             (plIncluirGab ? "com gabarito" : "sem gabarito")
             + (plIncluirDica ? " · com dica" : " · sem dica"));
    } catch (e) {}
  };
  cx.append(b);

  [["plCopGab", "pl_com_gab", () => plIncluirGab, (v) => { plIncluirGab = v; }],
   ["plCopDica", "pl_com_dica", () => plIncluirDica, (v) => { plIncluirDica = v; }],
  ].forEach(([id, chave, ler, escrever]) => {
    const lab = document.createElement("label");
    lab.className = "qs-chk";
    const c = document.createElement("input");
    c.type = "checkbox";
    c.id = id;
    c.checked = ler();
    c.onchange = () => escrever(!!c.checked);
    const sp = document.createElement("span");
    sp.textContent = t(chave);
    lab.append(c, sp);
    lab.title = t(chave + "_ajuda");
    cx.append(lab);
  });

  return cx;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    plEnvolver, plBarra, plBarraCopiar, plLigar, plLimpar, plPintar,
    plComecar, plMover, plSoltar, plApagarEm, plTextoDaQuestao,
    plLigadaAtual: () => plLigada,
    plTracosAtual: () => plTracos,
  };
}
