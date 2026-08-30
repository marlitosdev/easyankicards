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

/* ESPESSURA DA CANETA — pelo mesmo motivo do grifo.
 *
 * Um traço fixo de 2,6 serve para escrever uma conta e não serve para
 * circular uma resposta ou riscar um caminho inteiro. E a superfície é
 * pequena: num rascunho de meia tela, traço fino em telefone some, e
 * traço grosso num monitor grande vira borrão.
 *
 * Os valores são MENORES do que os do grifo de propósito. O grifo passa
 * por cima de texto e precisa cobrir a linha; a caneta escreve, e
 * escrita com 15px de largura não tem forma nenhuma. */
const RS_ESPESSURAS = [
  { id: "fina", larg: 1.8 },
  { id: "media", larg: 3 },
  { id: "grossa", larg: 6 },
];
const RS_ESP_CHAVE = "eac_rs_esp";
let rsEspessura = 1;

function rsLarguraAtual() {
  return (RS_ESPESSURAS[rsEspessura] || RS_ESPESSURAS[1]).larg;
}

function rsEspessuraDefinir(i) {
  const n = Math.max(0, Math.min(RS_ESPESSURAS.length - 1, Number(i) || 0));
  rsEspessura = n;
  try { localStorage.setItem(RS_ESP_CHAVE, String(n)); } catch (e) {}
  rsPintar();
  return rsEspessura;
}

function rsEspessuraCarregar() {
  let v = null;
  try { v = localStorage.getItem(RS_ESP_CHAVE); } catch (e) { v = null; }
  /* Number(null) é 0, e 0 é a mais fina: sem esta checagem, "nunca
   * escolhi" viraria "escolhi a mais fina" — o mesmo tropeço que o
   * tamanho da janela da lei já teve. */
  if (v === null || v === "") return rsEspessura;
  rsEspessura = Math.max(0, Math.min(RS_ESPESSURAS.length - 1, Number(v) || 0));
  return rsEspessura;
}

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
  if (!r) return null;
  /* um rascunho SÓ DE TEXTO é um rascunho: exigir traço aqui fazia a
   * conta digitada sumir na volta, e o selo não aparecer */
  const temTraco = !!(r.tracos && r.tracos.length);
  const temTexto = !!String(r.texto || "").trim();
  return (temTraco || temTexto) ? r : null;
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
  rsTracos = guardado && guardado.tracos ? guardado.tracos.map((tr) => ({
    cor: tr.cor, larg: tr.larg, pontos: tr.pontos.map((p) => p.slice()),
  })) : [];
  const tx0 = $("rsTexto");
  if (tx0) tx0.value = (guardado && guardado.texto) || "";
  /* volta no modo em que há conteúdo: guardado só texto, abrir na
   * caneta mostraria uma folha em branco sobre um rascunho que existe */
  rsModoTrocar(guardado && !rsTracos.length && String((guardado || {}).texto || "").trim()
    ? "teclado" : "caneta");
  rsSalvo = !!guardado;
  rsLixo = [];
  rsBorracha = false;
  /* TROCAR DE QUESTÃO SAI DA FOLHA INTEIRA: ela é um estado de trabalho
   * daquela questão, e ficar nela esconderia o enunciado da seguinte. */
  if (rsCheia) rsCheiaTrocar(false);
  else rsRedimensionar(RS_FOLHA_NORMAL.w, RS_FOLHA_NORMAL.h);
  rsRecolher(true);
  rsPintar();
}

/* Repintar a questao (ao responder, por exemplo) nao pode zerar o
 * rascunho que a pessoa acabou de fazer para resolve-la. */
function rsMesmaQuestao(id) {
  return rsQid != null && String(id) === rsQid;
}

/* ---------------------------------------------------------------------
 * O TAMANHO DA FOLHA
 *
 * A tela tem um tamanho INTERNO em pixels (o espaço de coordenadas em
 * que os traços são guardados) e um tamanho em CSS. Esticar só o CSS não
 * dá mais espaço: dá o mesmo desenho maior, com o traço engordando
 * junto. Para caber um balanço patrimonial é preciso mais ESPAÇO — mais
 * pixels internos.
 *
 * E aqui está a parte que não pode errar: os traços já feitos estão
 * guardados em coordenadas da folha ANTIGA. Trocar o tamanho sem mexer
 * neles empurraria tudo para o canto superior esquerdo, encolhido — o
 * rabisco que a pessoa acabou de fazer apareceria deslocado do lugar
 * onde ela o fez. Por isso cada ponto é convertido junto, pela mesma
 * razão de escala.
 * ------------------------------------------------------------------ */
const RS_FOLHA_NORMAL = { w: 900, h: 420 };
/* usada quando não dá para medir a tela (teste, navegador antigo) */
const RS_FOLHA_CHEIA = { w: 1500, h: 1150 };
let rsCheia = false;
let rsVidro = false;

/* A FOLHA DA TELA CHEIA TEM O TAMANHO DA TELA.
 *
 * Um valor fixo é sempre errado em algum aparelho: grande demais num
 * telefone (o traço sai fino como fio de cabelo) e pequeno demais num
 * monitor (a mão desenha o dobro do que aparece). Medindo a janela, a
 * proporção do que se escreve é a mesma em qualquer lugar.
 *
 * O desconto de 150px é o que as barras de cima e de baixo ocupam. Errar
 * para menos é seguro: sobra margem. Errar para mais faria a folha
 * passar da tela e esconder o botão de salvar. */
function rsFolhaDaTela() {
  const w = typeof window !== "undefined" ? window.innerWidth : 0;
  const h = typeof window !== "undefined" ? window.innerHeight : 0;
  if (!w || !h) return RS_FOLHA_CHEIA;
  /* a densidade dobra a resolução interna: sem isso, numa tela retina o
   * traço sai serrilhado */
  const dpr = Math.max(1, Math.min(2,
    (typeof window !== "undefined" && window.devicePixelRatio) || 1));
  return { w: Math.round(w * dpr), h: Math.round(Math.max(240, h - 150) * dpr) };
}

/* VER A QUESTÃO ATRÁS — só na folha inteira.
 *
 * A folha branca é o certo para somar um balanço: número escrito sobre
 * texto não se lê. Mas para riscar um esquema em cima do enunciado, o
 * papel é justamente o que atrapalha. São dois usos legítimos e opostos,
 * então é uma escolha, com o papel como padrão. */
function rsVidroTrocar(sim) {
  rsVidro = sim === undefined ? !rsVidro : !!sim;
  const dlg = $("dlgQsResponder");
  if (dlg && dlg.classList) dlg.classList.toggle("rs-vidro", rsVidro);
  const b = $("btnRsVidro");
  if (b && b.classList) b.classList.toggle("btn-min-ok", rsVidro);
  return rsVidro;
}

function rsRedimensionar(w, h) {
  const cv = rsTela();
  if (!cv || !w || !h) return false;
  const antesW = cv.width || RS_FOLHA_NORMAL.w;
  const antesH = cv.height || RS_FOLHA_NORMAL.h;
  if (antesW === w && antesH === h) return false;
  const fx = w / antesW, fy = h / antesH;
  rsTracos.forEach((tr) => {
    tr.pontos = (tr.pontos || []).map((p) => [p[0] * fx, p[1] * fy]);
    /* a LARGURA do traço acompanha a escala: sem isto, uma linha fina
     * numa folha pequena vira um fio invisível na folha grande */
    tr.larg = (Number(tr.larg) || 3) * Math.min(fx, fy);
  });
  cv.width = w;
  cv.height = h;
  rsPintar();
  return true;
}

function rsCheiaTrocar(sim) {
  rsCheia = sim === undefined ? !rsCheia : !!sim;
  const dlg = $("dlgQsResponder");
  if (dlg && dlg.classList) dlg.classList.toggle("rs-cheia", rsCheia);
  /* abrir a folha inteira com o rascunho recolhido não faria sentido:
   * a tela ficaria vazia com um botão de voltar */
  if (rsCheia && !rsAberto()) rsRecolher(false);
  const f = rsCheia ? rsFolhaDaTela() : RS_FOLHA_NORMAL;
  rsRedimensionar(f.w, f.h);
  /* sair da folha inteira leva junto o fundo transparente: ele só existe
   * lá, e ficar ligado por baixo faria o painel de 72% abrir sem papel */
  if (!rsCheia) rsVidroTrocar(false);
  rsPintar();
  return rsCheia;
}

function rsRecolher(sim) {
  const corpo = $("rsCorpo");
  if (!corpo) return;
  corpo.hidden = !!sim;
  /* RECOLHIDO É FECHADO. Antes a caixa continuava na tela, vazia, com a
   * barra de título e um botão de "folha inteira" para expandir um
   * painel que não estava aberto. Agora o rascunho fechado não ocupa
   * nada — quem o abre são os gatilhos, no fim da questão. */
  /* ABRIR NÃO DEPENDE DE HAVER QUESTÃO CARREGADA.
   * Dependia, e era a segunda metade do mesmo defeito: com rsQid nulo o
   * painel não abria, sem dizer nada — um botão que não faz nada é pior
   * do que um botão ausente. O que precisa de questão é SALVAR, e
   * rsSalvarNaQuestao já recusa com uma frase. */
  const cx = $("rsCaixa");
  if (cx) cx.hidden = !!sim;
  if (sim && rsCheia) rsCheiaTrocar(false);
  /* AS FERRAMENTAS SEGUEM O CORPO. Cores de caneta ao lado de um
   * rascunho fechado não são atalho, são enfeite: não há onde desenhar. */
  const fer = $("rsFerramentas");
  if (fer) fer.hidden = !!sim;
  const b = $("btnRsMin");
  if (b) {
    b.textContent = t("rs_recolher");
    b.title = t("rs_recolher_ajuda");
  }
  rsPintarGatilhos();
  if (!sim) rsPintar();
}
/* a instrução serve à primeira vez; com a folha rabiscada ela vira uma
 * faixa de texto ocupando altura que a conta precisa */
/* ---------------------------------------------------------------------
 * CANETA OU TECLADO
 *
 * O rascunho nasceu como papel: desenhar é o gesto certo para riscar uma
 * alternativa ou montar um esquema. Mas transcrever os números de um
 * balanço é digitar, não desenhar — e escrever à mão com o dedo, num
 * telefone, é o caminho mais lento possível para uma coisa que o teclado
 * faz em segundos.
 *
 * O texto é guardado JUNTO do traço, na mesma entrada da questão: são as
 * duas metades do mesmo rascunho, e separá-las faria "salvar" significar
 * coisas diferentes conforme o modo em que a pessoa estivesse. */
let rsModo = "caneta";

function rsModoTrocar(qual) {
  rsModo = qual || (rsModo === "caneta" ? "teclado" : "caneta");
  const cv = rsTela(), tx = $("rsTexto");
  if (cv) cv.hidden = rsModo !== "caneta";
  if (tx) tx.hidden = rsModo !== "teclado";
  /* as ferramentas de desenho não servem ao teclado: deixá-las acesas
   * seria oferecer uma caneta para escrever num campo de texto */
  ["rs-grupo-esq", "rs-grupo-centro"].forEach((cls) => {
    const g = $("rsFerramentas");
    if (!g) return;
    /* mesma armadilha: HTMLCollection nao tem forEach, e trocar para o
     * teclado lancava excecao no meio da repintura da barra */
    Array.from(g.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) {
        f.hidden = rsModo !== "caneta";
      }
    });
  });
  rsPintar();
  return rsModo;
}

function rsTextoAtual() {
  const tx = $("rsTexto");
  return tx ? String(tx.value || "") : "";
}

function rsTemAlgo() {
  return rsTracos.length > 0 || !!rsTextoAtual().trim();
}

/* OS DOIS GATILHOS, e o selo.
 *
 * O selo responde a uma pergunta que antes só se respondia abrindo: esta
 * questão tem conta guardada? Numa segunda passada pelo mesmo bloco, é a
 * diferença entre reabrir trinta rascunhos para achar o que interessa e
 * ver de relance quais têm alguma coisa. */
function rsPintarGatilhos() {
  const aberto = rsAberto();
  const b1 = $("btnRsAbrir"), b2 = $("btnRsAbrirCheia");
  const temSalvo = !!(rsQid && rsDaQuestao(rsQid));
  /* SÓ ESCONDE COM O PAINEL ABERTO — e nunca por não haver questão.
   *
   * A regra era "some se não há rsQid", e rsQid só é preenchido por
   * rsPrepararPara, que roda dentro de um try/catch lá na tela de
   * questões. Qualquer tropeço ali — e basta um — engolia a exceção e
   * deixava os dois gatilhos escondidos para sempre: o rascunho sumia
   * da tela inteira, sem erro, sem aviso, sem caminho de volta.
   *
   * Um botão que abre o rascunho não precisa saber de que questão ele é.
   * Se a questão não estiver pronta, quem descobre isso é o clique — e
   * aí há uma mensagem, em vez de um botão ausente. */
  if (b1) {
    b1.hidden = aberto;
    b1.textContent = "";
    b1.append(document.createTextNode(t("rs_abrir")));
    if (temSalvo) {
      const selo = document.createElement("span");
      selo.className = "rs-selo";
      selo.id = "rsSelo";
      selo.textContent = t("rs_selo");
      selo.title = t("rs_selo_ajuda");
      b1.append(selo);
    }
  }
  if (b2) b2.hidden = aberto;
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
  /* a largura vai GRAVADA no traço: trocar de espessura depois não pode
   * reescrever o que já foi desenhado */
  rsTracos.push({ cor: c.cor, larg: rsLarguraAtual(), pontos: [[x, y]] });
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
/* O QUE SOBRA DE UM TRAÇO DEPOIS DA BORRACHA.
 *
 * Antes, tocar num traço apagava o traço INTEIRO — e por isso escolher o
 * tamanho da borracha não mudava nada: grande ou pequena, o resultado
 * era o mesmo, sumir com a linha toda. O raio só mudava a facilidade de
 * acertar, nunca o quanto se apagava, e uma borracha que não apaga por
 * tamanho não é uma borracha, é um botão de excluir.
 *
 * Aqui os pontos dentro do raio saem e os trechos que sobram de cada
 * lado viram traços independentes — apagar o meio de uma linha deixa as
 * duas pontas, como no papel.
 *
 * A distância é a EUCLIDIANA, não a do quadrado: o cursor é redondo, e
 * com o teste em caixa a borracha apagava nos cantos, onde ela
 * visivelmente não encostou. */
function rsPartirTraco(tr, x, y, raio) {
  const r2 = raio * raio;
  const partes = [];
  let atual = [];
  (tr.pontos || []).forEach((p) => {
    const dx = p[0] - x, dy = p[1] - y;
    if (dx * dx + dy * dy <= r2) {
      if (atual.length > 1) partes.push(atual);
      atual = [];
    } else {
      atual.push(p);
    }
  });
  if (atual.length > 1) partes.push(atual);
  /* trecho de um ponto só não desenha nada (o traço é uma polilinha) e
   * viraria sujeira invisível acumulando na memória */
  return partes.map((pontos) => Object.assign({}, tr, { pontos }));
}

function rsApagarEm(x, y) {
  const sobrou = [];
  const tirados = [], postos = [];
  rsTracos.forEach((tr) => {
    const partes = rsPartirTraco(tr, x, y, rsBorrachaRaio);
    if (partes.length === 1 && partes[0].pontos.length === (tr.pontos || []).length) {
      sobrou.push(tr);                     /* a borracha não encostou */
      return;
    }
    tirados.push(tr);
    partes.forEach((pt) => { postos.push(pt); sobrou.push(pt); });
  });
  if (!tirados.length) return;
  /* DESFAZER PRECISA SABER DAS DUAS PONTAS: repor o traço original sem
   * tirar os pedaços deixaria a linha desenhada duas vezes. */
  rsLixo.push({ tipo: "traco", tracos: tirados, novos: postos });
  rsTracos = sobrou;
  rsMarcarSujo();
  rsPintar();
}

function rsDesfazer() {
  if (rsLixo.length) {
    const v = rsLixo.pop();
    /* tira os pedaços que a borracha deixou antes de repor o inteiro:
     * sem isto, desfazer desenharia a linha por cima dela mesma */
    if (v.novos && v.novos.length) {
      rsTracos = rsTracos.filter((tr) => v.novos.indexOf(tr) < 0);
    }
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
  const bModo = $("btnRsModo");
  if (bModo) {
    bModo.textContent = t(rsModo === "caneta" ? "rs_modo_teclado" : "rs_modo_caneta");
    bModo.title = t(rsModo === "caneta" ? "rs_modo_teclado_ajuda" : "rs_modo_caneta_ajuda");
  }
  const bVidro = $("btnRsVidro");
  if (bVidro) {
    /* só faz sentido na folha inteira: no painel de 72% a questão já
     * está visível acima dele */
    bVidro.hidden = !rsCheia;
    bVidro.textContent = t("rs_vidro");
    bVidro.title = t("rs_vidro_ajuda");
  }
  const bCheia = $("btnRsCheia");
  if (bCheia) {
    bCheia.textContent = t(rsCheia ? "rs_cheia_sair" : "rs_cheia");
    if (bCheia.classList) bCheia.classList.toggle("btn-min-ok", rsCheia);
  }
  rsPintarGatilhos();
}

/* ---------------- salvar ---------------- */

function rsSalvarNaQuestao() {
  if (!rsQid) { uiAlert(t("rs_sem_questao")); return false; }
  /* TRAÇO OU TEXTO: as duas metades do mesmo rascunho. Exigir traço
   * faria "salvar" recusar uma conta inteiramente digitada. */
  if (!rsTemAlgo()) { uiAlert(t("rs_vazio")); return false; }
  const tudo = rsLerTudo();
  tudo[rsQid] = { tracos: rsTracos, texto: rsTextoAtual(),
                  q: new Date().toISOString() };
  if (!rsGravarTudo(tudo)) return false;
  rsSalvo = true;
  rsPintar();
  try { matReg("questoes", "rascunho guardado na questão",
    rsTracos.length + " traços"
    + (rsTextoAtual().trim() ? " · " + rsTextoAtual().length + " caracteres" : "")); }
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
  RS_ESPESSURAS.forEach((x, i) => {
    const b = rsBotoes["e_" + x.id];
    if (b) b.className = "rs-esp"
      + (!rsBorracha && i === rsEspessura ? " rs-sel" : "");
  });
  RS_BORRACHAS.forEach((x) => {
    const b = rsBotoes["b_" + x.id];
    if (b) b.className = "rs-bsize" + (x.raio === rsBorrachaRaio ? " rs-sel" : "");
  });
}

function rsFerramenta(nome) { return rsBotoes[nome] || null; }

/* OS GATILHOS SÃO LIGADOS NO ARRANQUE, e não dentro de rsIniciar().
 *
 * rsIniciar() só roda na primeira vez que uma questão é pintada. Enquanto
 * os gatilhos dependiam dele, eles ficavam sem texto e sem clique até
 * lá — e se algo falhasse no caminho, para sempre. O botão que ABRE uma
 * coisa não pode depender de essa coisa já ter sido montada: é ele quem
 * a monta. */
function rsGatilhosIniciar() {
  const b1 = $("btnRsAbrir"), b2 = $("btnRsAbrirCheia");
  if (b1) {
    b1.onclick = () => {
      if (!rsIniciado) rsIniciar();
      rsRecolher(false);
      rsCheiaTrocar(false);
    };
  }
  if (b2) {
    b2.textContent = t("rs_cheia");
    b2.onclick = () => {
      if (!rsIniciado) rsIniciar();
      rsRecolher(false);
      rsCheiaTrocar(true);
    };
  }
  rsPintarGatilhos();
}

function rsIniciar() {
  if (rsIniciado) return;
  const cx = $("rsCaixa");
  if (!cx) return;
  rsIniciado = true;
  rsEspessuraCarregar();
  /* DE QUALQUER PORTA. Os gatilhos são ligados no arranque da tela de
   * questões, mas também aqui: quem chegar primeiro liga, e ligar duas
   * vezes é inofensivo. Depender de uma ordem entre dois arranques é
   * como o rascunho já sumiu uma vez. */
  try { rsGatilhosIniciar(); } catch (e) {}
  /* O TAMANHO DA FOLHA VEM DAQUI, não do atributo do HTML. Com o número
   * escrito nos dois lugares, mudar um deles faz a conversão de escala
   * partir de um tamanho que não é o da folha — e todo traço aparece
   * deslocado. Uma fonte só para o mesmo número. */
  const cv0 = rsTela();
  if (cv0) { cv0.width = RS_FOLHA_NORMAL.w; cv0.height = RS_FOLHA_NORMAL.h; }

  const fer = $("rsFerramentas");
  if (fer && !fer.children.length) {
    /* TRÊS GRUPOS, e a posição é o que identifica a ferramenta. Numa
     * fila única de dez botões a pessoa lê todos toda vez; com grupos
     * ela vai ao lugar. Os dois primeiros são preenchidos aqui; o da
     * direita já vem escrito no HTML, porque botão criado em JS não
     * aparece para quem lê a página nem para os invariantes. */
    const gEsq = $("rsGrupoEsq") || fer;
    const gCen = $("rsGrupoCen") || fer;
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
      gEsq.append(b);
    });
    /* A ESPESSURA DA CANETA fica junto das cores e ANTES da borracha:
     * escolher com que traço escrever é parte de escrever, não de
     * apagar. Cada botão mostra a própria espessura — apontar é mais
     * rápido do que ler "média" e traduzir para uma largura. */
    RS_ESPESSURAS.forEach((x, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "btnRsEsp_" + x.id;
      b.className = "rs-esp";
      b.title = t("rs_esp_" + x.id);
      b.setAttribute("aria-label", t("rs_esp_" + x.id));
      const tr = document.createElement("span");
      tr.className = "rs-esp-tr";
      tr.style.height = Math.max(2, Math.round(x.larg * 1.6)) + "px";
      b.append(tr);
      b.onclick = () => { rsEspessuraDefinir(i); rsBorracha = false; rsPintar(); };
      rsBotoes["e_" + x.id] = b;
      gEsq.append(b);
    });

    const bb = document.createElement("button");
    bb.type = "button"; bb.id = "btnRsBorracha"; bb.className = "btn-min rs-borracha";
    bb.textContent = t("rs_borracha");
    bb.title = t("rs_borracha_ajuda");
    bb.onclick = () => { rsBorracha = !rsBorracha; rsPintar(); };
    rsBotoes.borracha = bb;
    gCen.append(bb);

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
      gCen.append(b);
    });
    /* limpar tudo fica no CENTRO, com a borracha: são a mesma família
     * (desfazer o que foi feito), e longe das cores, que é o que a mão
     * procura o tempo todo */
    const bLimpa = document.createElement("button");
    bLimpa.type = "button";
    bLimpa.id = "btnRsLimparBarra";
    bLimpa.className = "btn-min";
    bLimpa.textContent = t("rs_limpar");
    bLimpa.onclick = () => rsLimpar();
    gCen.append(bLimpa);

    rsPintarBorrachas();
  }

  if ($("btnRsMin")) $("btnRsMin").onclick = () => rsRecolher(rsAberto());
  if ($("btnRsModo")) $("btnRsModo").onclick = () => rsModoTrocar();
  if ($("btnRsCheia")) $("btnRsCheia").onclick = () => rsCheiaTrocar();
  if ($("btnRsMin")) $("btnRsMin").onclick = () => rsRecolher(true);
  if ($("btnRsVidro")) $("btnRsVidro").onclick = () => rsVidroTrocar();

  /* ESC VOLTA À QUESTÃO ANTES de fechar a rodada. Sem isto, o gesto mais
   * natural para "sair da folha inteira" encerraria a sessão de questões
   * — e o rabisco não salvo iria junto. */
  if ($("dlgQsResponder")) {
    $("dlgQsResponder").addEventListener("cancel", (e) => {
      if (!rsCheia) return;
      if (e && e.preventDefault) e.preventDefault();
      rsCheiaTrocar(false);
    });
  }
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
