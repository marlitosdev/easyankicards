/* ============================================================
 * RASCUNHO — o papel de lado da questão
 *
 * Questão de concurso não se resolve só lendo: rabisca-se o esquema,
 * risca-se a alternativa, faz-se a conta no canto. Antes disto, essa
 * parte acontecia num papel fora do aplicativo e sumia — junto com o
 * raciocínio que levou ao erro, que é justamente o que valeria rever.
 *
 * DUAS DECISÕES QUE MOLDAM O RESTO:
 *
 * 1. O desenho é guardado como TRAÇOS (listas de pontos), não como
 *    imagem. Um PNG de tela cheia pesa dezenas de KB e, guardado por
 *    questão, estoura o armazenamento do navegador em poucas dezenas
 *    de rascunhos — sem aviso, derrubando OUTROS dados junto. Traço é
 *    leve, sobrevive à mudança de tamanho da tela e permite apagar um
 *    risco sem apagar o resto.
 *
 * 2. Nada daqui entra na questão sozinho. O pedido foi "pode ou não
 *    ser salvo, a pedido do usuário", então o padrão é NÃO salvar —
 *    mas sair com rabisco na tela pergunta antes, porque perder sem
 *    perguntar também é decidir pelo usuário.
 * ============================================================ */

const RS_CHAVE = "eac_rascunhos";

/* preto, azul, vermelho e verde — as quatro do pedido */
const RS_CANETAS = [
  { id: "preta",    cor: "#151515", larg: 2.6 },
  { id: "azul",     cor: "#1a4fd6", larg: 2.6 },
  { id: "vermelha", cor: "#d62828", larg: 2.6 },
  { id: "verde",    cor: "#128a3a", larg: 2.6 },
];
/* TAMANHOS DE BORRACHA.
 *
 * Um raio fixo servia mal aos dois usos que existem de verdade: tirar um
 * traço fino no meio de uma conta pede precisão, e limpar meia folha
 * pede área. Com um só, o primeiro caso apaga o vizinho e o segundo vira
 * vinte passadas.
 *
 * A lista é compartilhada com a película do enunciado: são o mesmo gesto
 * em duas superfícies, e ter tamanhos diferentes em cada uma seria pedir
 * para a pessoa reaprender a ferramenta ao mudar de lugar. */
const RS_BORRACHAS = [
  { id: "fina", raio: 7 },
  { id: "media", raio: 15 },
  { id: "grossa", raio: 34 },
];
let rsBorrachaRaio = 15;

function rsBorrachaDefinir(raio) {
  const v = Number(raio) || 15;
  rsBorrachaRaio = Math.max(4, Math.min(60, v));
  rsPintarBorrachas();
  return rsBorrachaRaio;
}

let rsQid = null;        // questão a que este rascunho pertence
let rsTracos = [];       // [{cor, larg, pontos:[[x,y],...]}]
let rsCaneta = "preta";
let rsBorracha = false;
let rsDesenhando = false;
let rsSalvo = false;     // reflete o que está no armazenamento
let rsLixo = [];         // pilha para desfazer (traços apagados/limpos)
let rsIniciado = false;
let rsBotoes = {};       // canetas e borracha, por referência

/* ---------------- armazenamento ---------------- */

function rsLerTudo() {
  try { return JSON.parse(localStorage.getItem(RS_CHAVE) || "{}") || {}; }
  catch (e) { return {}; }
}
function rsGravarTudo(o) {
  try { localStorage.setItem(RS_CHAVE, JSON.stringify(o)); return true; }
  catch (e) {
    /* cota estourada: avisar em vez de fingir que salvou */
    try { uiAlert(t("rs_sem_espaco")); } catch (e2) {}
    return false;
  }
}
function rsDaQuestao(id) {
  const r = rsLerTudo()[String(id)];
  return r && r.tracos && r.tracos.length ? r : null;
}
function rsQuantosSalvos() { return Object.keys(rsLerTudo()).length; }

/* ---------------- abrir/fechar ---------------- */

/* Chamado a cada questão pintada. Recolhido por padrão: o rascunho é
 * ferramenta de quando se precisa, não moldura permanente. Se ESTA
 * questão já tem rascunho salvo, ele volta carregado (mas ainda
 * recolhido — abrir sozinho entregaria o esquema da resposta antes de
 * a pessoa tentar de novo). */
function rsPrepararPara(id) {
  const cx = $("rsCaixa");
  if (!cx) return;
  if (!rsIniciado) rsIniciar();
  rsQid = id == null ? null : String(id);
  const guardado = rsQid ? rsDaQuestao(rsQid) : null;
  rsTracos = guardado ? guardado.tracos.map((tr) => ({
    cor: tr.cor, larg: tr.larg, pontos: tr.pontos.map((p) => p.slice()),
  })) : [];
  rsSalvo = !!guardado;
  rsLixo = [];
  rsBorracha = false;
  cx.hidden = !rsQid;
  rsRecolher(true);
  rsPintar();
}

/* Repintar a questao (ao responder, por exemplo) nao pode zerar o
 * rascunho que a pessoa acabou de fazer para resolve-la. */
function rsMesmaQuestao(id) {
  return rsQid != null && String(id) === rsQid;
}

function rsRecolher(sim) {
  const corpo = $("rsCorpo");
  if (!corpo) return;
  corpo.hidden = !!sim;
  /* AS FERRAMENTAS SEGUEM O CORPO. Elas agora moram na barra do título,
   * que continua visível com o rascunho recolhido — e cores de caneta
   * ao lado de um rascunho fechado não são atalho, são enfeite: não há
   * onde desenhar. */
  const fer = $("rsFerramentas");
  if (fer) fer.hidden = !!sim;
  const b = $("btnRsMin");
  if (b) {
    b.textContent = t(sim ? "rs_abrir" : "rs_recolher");
    b.title = t(sim ? "rs_abrir_ajuda" : "rs_recolher_ajuda");
  }
  if (!sim) rsPintar();
}
function rsAberto() {
  const corpo = $("rsCorpo");
  return !!(corpo && corpo.hidden === false);
}

/* ---------------- desenho ---------------- */

function rsTela() { return $("rsTela"); }

/* Converte a posição do ponteiro para as coordenadas INTERNAS da tela.
 * A tela tem tamanho fixo em pixels e tamanho variável em CSS; sem a
 * conversão, o traço aparece deslocado do dedo — quanto menor o
 * aparelho, maior o erro. */
function rsCoords(e) {
  const cv = rsTela();
  if (!cv) return [0, 0];
  const r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
  if (r && r.width) {
    return [((e.clientX || 0) - r.left) * (cv.width / r.width),
            ((e.clientY || 0) - r.top) * (cv.height / r.height)];
  }
  return [e.offsetX || 0, e.offsetY || 0];
}

function rsCanetaAtual() {
  return RS_CANETAS.filter((c) => c.id === rsCaneta)[0] || RS_CANETAS[0];
}

function rsComecar(e) {
  if (!rsAberto()) return;
  const [x, y] = rsCoords(e);
  if (rsBorracha) { rsApagarEm(x, y); rsDesenhando = true; return; }
  const c = rsCanetaAtual();
  rsTracos.push({ cor: c.cor, larg: c.larg, pontos: [[x, y]] });
  rsDesenhando = true;
  rsMarcarSujo();
  rsPintar();
}
function rsMover(e) {
  if (!rsDesenhando) return;
  const [x, y] = rsCoords(e);
  if (rsBorracha) { rsApagarEm(x, y); return; }
  const tr = rsTracos[rsTracos.length - 1];
  if (!tr) return;
  const ult = tr.pontos[tr.pontos.length - 1];
  /* ponto praticamente no mesmo lugar só engorda o guardado */
  if (ult && Math.abs(ult[0] - x) < 1 && Math.abs(ult[1] - y) < 1) return;
  tr.pontos.push([x, y]);
  rsPintar();
}
function rsSoltar() {
  if (!rsDesenhando) return;
  rsDesenhando = false;
  /* toque seco sem arrastar vira um ponto visível, não um traço vazio */
  const tr = rsTracos[rsTracos.length - 1];
  if (tr && tr.pontos.length === 1) tr.pontos.push([tr.pontos[0][0] + 0.6, tr.pontos[0][1] + 0.6]);
  rsPintar();
}

/* BORRACHA — apaga o traço inteiro que ela encostar.
 * Apagar "meio traço" exigiria partir a linha em duas e o resultado
 * costuma ser pior do que refazer o risco. Como some coisa, o apagado
 * vai para a pilha do desfazer. */
function rsApagarEm(x, y) {
  const antes = rsTracos.length;
  const sobrou = [];
  rsTracos.forEach((tr) => {
    const toca = tr.pontos.some((p) =>
      Math.abs(p[0] - x) <= rsBorrachaRaio && Math.abs(p[1] - y) <= rsBorrachaRaio);
    if (toca) rsLixo.push({ tipo: "traco", tracos: [tr] });
    else sobrou.push(tr);
  });
  if (sobrou.length === antes) return;
  rsTracos = sobrou;
  rsMarcarSujo();
  rsPintar();
}

function rsDesfazer() {
  if (rsLixo.length) {
    const v = rsLixo.pop();
    rsTracos = rsTracos.concat(v.tracos);
  } else if (rsTracos.length) {
    rsTracos.pop();
  } else return;
  rsMarcarSujo();
  rsPintar();
}

async function rsLimpar() {
  if (!rsTracos.length) { uiAlert(t("rs_vazio")); return; }
  if (!(await uiConfirm(t("rs_limpar_conf", { n: rsTracos.length })))) return;
  rsLixo.push({ tipo: "limpeza", tracos: rsTracos });
  rsTracos = [];
  rsMarcarSujo();
  rsPintar();
}

function rsMarcarSujo() { rsSalvo = false; }

/* ---------------- pintar ---------------- */

function rsPintar() {
  const cv = rsTela();
  if (cv && cv.getContext) {
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      rsTracos.forEach((tr) => {
        if (!tr.pontos.length) return;
        ctx.beginPath();
        ctx.strokeStyle = tr.cor;
        ctx.lineWidth = tr.larg;
        ctx.moveTo(tr.pontos[0][0], tr.pontos[0][1]);
        tr.pontos.slice(1).forEach((p) => ctx.lineTo(p[0], p[1]));
        ctx.stroke();
      });
    }
  }
  /* estado das ferramentas */
  RS_CANETAS.forEach((c) => {
    const b = rsBotoes[c.id];
    if (b) b.className = "rs-caneta" +
      (!rsBorracha && rsCaneta === c.id ? " rs-sel" : "");
  });
  if (rsBotoes.borracha) rsBotoes.borracha.className =
    "btn-min rs-borracha" + (rsBorracha ? " rs-sel" : "");
  rsPintarBorrachas();
  const av = $("rsAviso");
  if (av) {
    av.textContent = !rsTracos.length ? ""
      : t(rsSalvo ? "rs_estado_salvo" : "rs_estado_nao", { n: rsTracos.length });
    av.className = "rs-aviso" + (rsSalvo ? " rs-ok" : "");
  }
  const bs = $("btnRsSalvar");
  if (bs) bs.textContent = t(rsSalvo ? "rs_salvar_de_novo" : "rs_salvar");
  const bl = $("btnRsApagarSalvo");
  if (bl) bl.hidden = !(rsQid && rsDaQuestao(rsQid));
}

/* ---------------- salvar ---------------- */

function rsSalvarNaQuestao() {
  if (!rsQid) { uiAlert(t("rs_sem_questao")); return false; }
  if (!rsTracos.length) { uiAlert(t("rs_vazio")); return false; }
  const tudo = rsLerTudo();
  tudo[rsQid] = { tracos: rsTracos, q: new Date().toISOString() };
  if (!rsGravarTudo(tudo)) return false;
  rsSalvo = true;
  rsPintar();
  try { matReg("questoes", "rascunho guardado na questão", rsTracos.length + " traços"); }
  catch (e) {}
  uiAlert(t("rs_salvo_ok"));
  return true;
}

async function rsApagarSalvo() {
  if (!rsQid) return;
  if (!(await uiConfirm(t("rs_apagar_conf")))) return;
  const tudo = rsLerTudo();
  delete tudo[rsQid];
  rsGravarTudo(tudo);
  rsSalvo = false;
  rsPintar();
}

/* SAIR COM RABISCO NA TELA.
 * Chamado antes de trocar de questão e antes de fechar a sessão.
 * Devolve promessa: quem chama espera a decisão antes de seguir. */
/* Ha algo por perguntar? Saber disto SEM promessa deixa o caminho
 * comum — sem rabisco nenhum — continuar sincrono: virar a questao nao
 * pode passar a depender de um ciclo de espera so porque existe um
 * quadro de rascunho na tela. */
function rsPrecisaPerguntar() {
  return !!(rsQid && rsTracos.length && !rsSalvo);
}

async function rsGuardarSeSair() {
  if (!rsQid || !rsTracos.length || rsSalvo) return;
  if (await uiConfirm(t("rs_sair_conf"))) rsSalvarNaQuestao();
}

/* ---------------- ligação ---------------- */

/* acesso as ferramentas por nome — o teste precisa apertar a caneta
 * vermelha do mesmo jeito que um dedo aperta */
function rsPintarBorrachas() {
  RS_BORRACHAS.forEach((x) => {
    const b = rsBotoes["b_" + x.id];
    if (b) b.className = "rs-bsize" + (x.raio === rsBorrachaRaio ? " rs-sel" : "");
  });
}

function rsFerramenta(nome) { return rsBotoes[nome] || null; }

function rsIniciar() {
  if (rsIniciado) return;
  const cx = $("rsCaixa");
  if (!cx) return;
  rsIniciado = true;

  const fer = $("rsFerramentas");
  if (fer && !fer.children.length) {
    RS_CANETAS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "btnRsCaneta_" + c.id;
      b.className = "rs-caneta";
      b.style.background = c.cor;
      b.title = t("rs_caneta_" + c.id);
      b.setAttribute("aria-label", t("rs_caneta_" + c.id));
      b.onclick = () => { rsCaneta = c.id; rsBorracha = false; rsPintar(); };
      rsBotoes[c.id] = b;
      fer.append(b);
    });
    const bb = document.createElement("button");
    bb.type = "button"; bb.id = "btnRsBorracha"; bb.className = "btn-min rs-borracha";
    bb.textContent = t("rs_borracha");
    bb.title = t("rs_borracha_ajuda");
    bb.onclick = () => { rsBorracha = !rsBorracha; rsPintar(); };
    rsBotoes.borracha = bb;
    fer.append(bb);

    /* OS TAMANHOS DA BORRACHA, ao lado dela — e não escondidos num menu.
     * Trocar de tamanho acontece no meio do gesto ("errei uma linha, não
     * a conta inteira"); um menu a mais nesse ponto faz a pessoa desistir
     * e apagar tudo. O botão é redondo e do tamanho que ele apaga: a
     * amostra é o próprio botão. */
    RS_BORRACHAS.forEach((x) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "btnRsBorracha_" + x.id;
      b.className = "rs-bsize";
      b.title = t("rs_borracha_tam_" + x.id);
      b.setAttribute("aria-label", t("rs_borracha_tam_" + x.id));
      const d = Math.round(6 + x.raio * 0.32);
      b.style.width = d + "px";
      b.style.height = d + "px";
      b.onclick = () => {
        rsBorrachaDefinir(x.raio);
        /* escolher um tamanho LIGA a borracha: ninguém escolhe o tamanho
         * de uma ferramenta que não pretende usar em seguida */
        rsBorracha = true;
        rsPintar();
      };
      rsBotoes["b_" + x.id] = b;
      fer.append(b);
    });
    rsPintarBorrachas();
  }

  if ($("btnRsMin")) $("btnRsMin").onclick = () => rsRecolher(rsAberto());
  if ($("btnRsDesfazer")) $("btnRsDesfazer").onclick = () => rsDesfazer();
  if ($("btnRsLimpar")) $("btnRsLimpar").onclick = () => rsLimpar();
  if ($("btnRsSalvar")) $("btnRsSalvar").onclick = () => rsSalvarNaQuestao();
  if ($("btnRsApagarSalvo")) $("btnRsApagarSalvo").onclick = () => rsApagarSalvo();

  const cv = rsTela();
  if (cv) {
    /* ponteiro unificado: o MESMO caminho serve para mouse, dedo e
     * caneta. Escrever três tratamentos separados era como isto
     * costuma quebrar em celular. */
    cv.onpointerdown = (e) => {
      if (e.preventDefault) e.preventDefault();
      if (cv.setPointerCapture && e.pointerId != null) {
        try { cv.setPointerCapture(e.pointerId); } catch (e2) {}
      }
      rsComecar(e);
    };
    cv.onpointermove = (e) => { if (rsDesenhando && e.preventDefault) e.preventDefault(); rsMover(e); };
    cv.onpointerup = () => rsSoltar();
    cv.onpointercancel = () => rsSoltar();
    cv.onpointerleave = () => rsSoltar();
  }
  rsPintar();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RS_CHAVE, RS_CANETAS, rsIniciar, rsPrepararPara, rsRecolher, rsAberto,
    rsComecar, rsMover, rsSoltar, rsApagarEm, rsDesfazer, rsLimpar,
    rsSalvarNaQuestao, rsApagarSalvo, rsGuardarSeSair, rsDaQuestao,
    rsQuantosSalvos, rsPintar, rsFerramenta, rsPrecisaPerguntar,
    RS_BORRACHAS, rsBorrachaDefinir, rsPintarBorrachas,
    rsBorrachaRaioAtual: () => rsBorrachaRaio,
  };
}
