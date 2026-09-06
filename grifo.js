/* =====================================================================
 * GRIFAR O ENUNCIADO — por seleção de texto
 *
 * POR QUE NÃO É MAIS UM CANVAS.
 *
 * A versão anterior desenhava pixels por cima do texto. Isso obriga a
 * converter coordenada, lidar com a densidade da tela, testar acerto da
 * borracha por distância — e nada disso sobrevive ao que acontece de
 * verdade num celular: girar o aparelho, aumentar a letra, mudar a
 * largura da caixa. Em qualquer um desses casos o texto reflui e os
 * riscos ficam onde estavam, apontando para palavras que já não estão
 * ali. Havia ainda um defeito silencioso: o canvas tinha tamanho
 * interno FIXO (900×420) para uma caixa cujo formato varia muito, e num
 * telefone o traço horizontal saía espremido a ponto de quase sumir —
 * era o "grifo não funciona".
 *
 * AQUI O GRIFO É POSIÇÃO DE CARACTERE no enunciado: "do caractere 40 ao
 * 78, amarelo". Isso não tem pixel nenhum. Refluiu, girou, dobrou de
 * tamanho: o grifo continua exatamente sobre as mesmas palavras, porque
 * ele nunca falou de posição na tela — falou de posição no texto.
 *
 * E O GESTO JÁ EXISTE NO APARELHO. Selecionar texto com o dedo tem
 * alças de ajuste, lupa e precisão que nenhum arrasto sobre canvas
 * alcança. Some o botão "ligar película": não há modo a ligar, porque
 * selecionar texto nunca deixou de ser possível.
 *
 * O QUE SE PERDE, e é honesto dizer: desenhar livre — seta, círculo,
 * sublinhado torto. Grifo de prova é sobre palavra; quem precisa de
 * seta tem o rascunho ao lado.
 * ===================================================================== */

const GR_CORES = [
  { id: "am", i18n: "gr_cor_am" },
  { id: "vd", i18n: "gr_cor_vd" },
  { id: "rs", i18n: "gr_cor_rs" },
  { id: "az", i18n: "gr_cor_az" },
];

/* Por questão, e só enquanto a sessão dura. Um grifo é andaime de
 * leitura: serve para responder ESTA questão. Guardá-lo para sempre
 * encheria o armazenamento de rabisco que ninguém vai reler — mas
 * perdê-lo ao pular para a próxima e voltar seria refazer trabalho, e
 * "só as que errei" faz exatamente esse caminho. */
let grPorQuestao = {};
let grQid = null;
let grTexto = "";
let grCor = "am";
let grCaixa = null;

function grCorAtual() { return grCor; }
function grEscolherCor(id) {
  if (GR_CORES.some((c) => c.id === id)) grCor = id;
  return grCor;
}

function grMarcasDe(qid) {
  const k = String(qid == null ? "" : qid);
  return (grPorQuestao[k] || []).slice();
}

function grGuardar(qid, marcas) {
  grPorQuestao[String(qid == null ? "" : qid)] = marcas || [];
}

function grEsquecerTudo() { grPorQuestao = {}; }

/* ---------------------------------------------------------------------
 * O NÚCLEO: uma cor por caractere
 *
 * Toda a lógica de sobreposição vive aqui, e vive em UMA linha de
 * raciocínio: pinta-se um vetor de cores do tamanho do texto, na ordem
 * em que os grifos foram feitos, e depois se lê o vetor de volta em
 * trechos. Emendar intervalos "na mão" — juntar vizinhos, cortar o que
 * cruza, remover o que virou vazio — é onde nascem os erros de canto:
 * grifar por cima de metade de um grifo antigo, grifar exatamente o
 * mesmo trecho de novo, grifar um caractere. Aqui esses casos não são
 * casos: são o mesmo laço.
 * ------------------------------------------------------------------ */
function grPintarVetor(tamanho, marcas) {
  const v = new Array(Math.max(0, tamanho)).fill(null);
  (marcas || []).forEach((m) => {
    if (!m) return;
    const ini = Math.max(0, Math.min(v.length, m.ini | 0));
    const fim = Math.max(0, Math.min(v.length, m.fim | 0));
    for (let i = ini; i < fim; i++) v[i] = m.cor || null;
  });
  return v;
}

function grTrechos(vetor) {
  const fora = [];
  let i = 0;
  while (i < vetor.length) {
    const cor = vetor[i];
    let j = i + 1;
    while (j < vetor.length && vetor[j] === cor) j++;
    fora.push({ ini: i, fim: j, cor });
    i = j;
  }
  return fora;
}

/* A forma guardada: só os trechos COM cor, já normalizados. Guardar o
 * vetor inteiro seria carregar um "null" por caractere de enunciado. */
function grNormalizar(tamanho, marcas) {
  return grTrechos(grPintarVetor(tamanho, marcas)).filter((t) => t.cor);
}

function grAcrescentar(qid, texto, ini, fim, cor) {
  const a = Math.max(0, Math.min(ini, fim));
  const b = Math.min(String(texto || "").length, Math.max(ini, fim));
  /* SELEÇÃO VAZIA NÃO PRECISA DE GUARDA.
   *
   * Havia aqui um "if (b <= a) return" para o toque sem arrastar. A
   * sabotagem mostrou que ele nunca fazia diferença: a normalização
   * pinta um vetor e o lê de volta em trechos, e um intervalo de
   * largura zero não pinta caractere nenhum — some por construção. Era
   * código que parecia proteger algo e não protegia; tirado, porque
   * guarda morta é a que engana quem lê depois. */
  const novas = grNormalizar(String(texto || "").length,
    grMarcasDe(qid).concat([{ ini: a, fim: b, cor }]));
  grGuardar(qid, novas);
  return novas;
}

/* Tirar o grifo que cobre um caractere — é o "toque na marca para
 * apagar". Não precisa de borracha, nem de teste de distância. */
function grTirarEm(qid, texto, pos) {
  const marcas = grMarcasDe(qid);
  const sobra = marcas.filter((m) => !(pos >= m.ini && pos < m.fim));
  if (sobra.length === marcas.length) return marcas;
  const novas = grNormalizar(String(texto || "").length, sobra);
  grGuardar(qid, novas);
  return novas;
}

function grLimpar(qid) { grGuardar(qid, []); return []; }

/* ---------------------------------------------------------------------
 * DA SELEÇÃO PARA A POSIÇÃO NO TEXTO
 *
 * O navegador entrega a seleção como "nó tal, deslocamento tal". Como a
 * caixa é feita de pedaços de texto e de <mark>, esse par não serve
 * para nada sozinho: o mesmo trecho vira nós diferentes conforme os
 * grifos que já existem. Aqui ele é convertido para uma posição única —
 * quantos caracteres existem antes dele na caixa inteira.
 *
 * A função é PURA em relação à árvore: recebe raiz, nó e deslocamento e
 * devolve um número. É o que permite testá-la sem navegador.
 * ------------------------------------------------------------------ */
function grPosicaoDe(raiz, no, desloc) {
  let n = 0;
  let achou = false;
  const anda = (el) => {
    if (achou || !el) return;
    if (el === no && el.nodeType !== 3) {
      /* seleção que aponta para um ELEMENTO: o deslocamento conta
       * filhos, não letras — soma-se o texto dos filhos anteriores */
      const fs = el.childNodes || [];
      for (let i = 0; i < desloc && i < fs.length; i++) anda2(fs[i]);
      achou = true;
      return;
    }
    if (el.nodeType === 3) {
      const txt = String(el.nodeValue == null ? el.textContent : el.nodeValue);
      if (el === no) { n += Math.min(desloc, txt.length); achou = true; return; }
      n += txt.length;
      return;
    }
    const fs = el.childNodes || [];
    for (let i = 0; i < fs.length; i++) { anda(fs[i]); if (achou) return; }
  };
  const anda2 = (el) => {
    if (!el) return;
    if (el.nodeType === 3) {
      n += String(el.nodeValue == null ? el.textContent : el.nodeValue).length;
      return;
    }
    const fs = el.childNodes || [];
    for (let i = 0; i < fs.length; i++) anda2(fs[i]);
  };
  anda(raiz);
  return achou ? n : -1;
}

/* ---------------------------------------------------------------------
 * DESENHAR
 *
 * A caixa é reconstruída inteira a cada mudança, a partir do TEXTO
 * ORIGINAL e da lista de trechos. Reconstruir parece desperdício e não
 * é: garante que o que está na tela é função do que está guardado, sem
 * um segundo caminho por onde os dois possam divergir — que é o defeito
 * que mais me custou nesta base.
 *
 * Nada de innerHTML: o enunciado vem de fora (colado de um caderno de
 * questões), e montar HTML com ele daria a qualquer texto copiado a
 * chance de injetar marcação. Só nós de texto e <mark>.
 * ------------------------------------------------------------------ */
function grPintar(caixa, qid, texto) {
  if (!caixa) return;
  caixa.textContent = "";
  /* "txt", e não "t": "t" é a função de tradução do aplicativo, e uma
   * variável com esse nome aqui a esconderia dentro desta função — o
   * title da marca abaixo quebraria com "t is not a function". */
  const txt = String(texto || "");
  const marcas = grMarcasDe(qid);
  const partes = grTrechos(grPintarVetor(txt.length, marcas));
  partes.forEach((p) => {
    const pedaco = txt.slice(p.ini, p.fim);
    if (!pedaco) return;
    if (!p.cor) { caixa.append(document.createTextNode(pedaco)); return; }
    const m = document.createElement("mark");
    m.className = "gr-m gr-" + p.cor;
    /* UM NÓ DE TEXTO DENTRO, e não "textContent = pedaco".
     *
     * No navegador as duas formas dão a mesma árvore; no simulador dos
     * testes, "textContent" é só uma propriedade e a marca fica SEM
     * filho. A conversão de seleção em posição anda a árvore, então com
     * a marca oca o teste do gesto principal — grifar por cima de um
     * grifo — passava sem visitar nada. Construir o nó explicitamente
     * faz as duas árvores serem a mesma. */
    m.append(document.createTextNode(pedaco));
    m.title = t("gr_tirar_ajuda");
    /* TOCAR NA MARCA APAGA. Sem borracha, sem modo, sem acerto por
     * distância: o alvo é a própria coisa que se quer tirar. */
    m.onclick = (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      grTirarEm(qid, txt, p.ini);
      grPintar(caixa, qid, txt);
      try { reg("GRIFO", "grifo tirado", "questão " + (qid || "?")); } catch (e) {}
    };
    caixa.append(m);
  });
}

/* A caixa do enunciado, já pintada e ligada. Substitui plEnvolver. */
/* O NAVEGADOR AVISA A CADA MUDANÇA DE SELEÇÃO, e é aí que ela ainda
 * existe. Um só ouvinte para o aplicativo inteiro: ligar e desligar por
 * questão criaria o caso de ficar sem ouvinte nenhum. */
let grOuvindo = false;

function grOuvirSelecao() {
  if (grOuvindo) return;
  if (typeof document === "undefined" || !document.addEventListener) return;
  document.addEventListener("selectionchange", () => {
    try { grLembrarSelecao(); } catch (e) {}
  });
  grOuvindo = true;
}

function grEnvolver(caixa, qid, texto) {
  grQid = qid == null ? null : String(qid);
  grTexto = String(texto || "");
  grCaixa = caixa || null;
  grEsquecerSelecao();
  grOuvirSelecao();
  if (caixa) caixa.className = ((caixa.className || "") + " gr-cx").trim();
  grPintar(caixa, grQid, grTexto);
  return caixa;
}

/* ---------------------------------------------------------------------
 * A SELEÇÃO PRECISA SER LEMBRADA ANTES DO CLIQUE
 *
 * O DEFEITO: selecionar o trecho, tocar numa cor, e nada acontecer.
 *
 * No Chrome, apertar um <button> move o foco e COLAPSA a seleção no
 * "mousedown" — antes do "click". Quando o gatilho da cor roda, o que
 * "window.getSelection()" devolve já é um cursor sem largura: início
 * igual a fim, e a função recusa. O gesto inteiro do grifo dependia de
 * ler a seleção no instante em que ela já não existe mais.
 *
 * ESTE APLICATIVO JÁ SABIA DISSO: "matLembrarSelecao", no material,
 * existe pelo mesmo motivo e resolve do mesmo jeito. Eu não apliquei
 * aqui.
 *
 * A CORREÇÃO É UM CAMINHO SÓ, e não duas defesas: a seleção é anotada
 * enquanto ela existe (o navegador avisa a cada mudança) e o botão usa
 * o que ficou anotado. Duas defesas — anotar E impedir o foco de sair —
 * seriam duas verdades sobre a mesma coisa, e uma delas viraria código
 * morto que ninguém consegue testar.
 * ------------------------------------------------------------------ */
let grSelGuardada = null;      /* {ini, fim} dentro do enunciado */

/* Lê a seleção viva e a anota, se ela for utilizável. Devolve o que
 * anotou, para quem quiser usar na hora. */
function grLembrarSelecao() {
  if (!grCaixa) return null;
  const sel = (typeof window !== "undefined" && window.getSelection)
    ? window.getSelection() : null;
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  const a = grPosicaoDe(grCaixa, r.startContainer, r.startOffset);
  const b = grPosicaoDe(grCaixa, r.endContainer, r.endOffset);
  /* FORA DA CAIXA OU SEM LARGURA não vira grifo — e, principalmente,
   * não apaga o que já estava anotado: o colapso causado pelo próprio
   * clique chega aqui como uma seleção vazia, e deixá-lo sobrescrever a
   * anotação seria reintroduzir o defeito por outro caminho. */
  if (a < 0 || b < 0 || a === b) return null;
  grSelGuardada = { ini: Math.min(a, b), fim: Math.max(a, b) };
  return grSelGuardada;
}

function grSelGuardadaAtual() { return grSelGuardada; }
function grEsquecerSelecao() { grSelGuardada = null; }

/* Grifa o que está selecionado AGORA, com a cor escolhida.
 *
 * NÃO ESCOLHE A COR: quem escolhe é o botão, ANTES de chamar. A versão
 * anterior recebia a cor e só a aplicava depois de achar uma seleção —
 * então tocar numa cor sem nada selecionado não fazia nada, embora a
 * ajuda do botão prometesse "só escolhe a cor do próximo grifo". As
 * duas coisas são decisões separadas e agora estão em lugares
 * separados. */
function grDaSelecao() {
  if (!grCaixa) return null;
  /* tenta a viva primeiro — no caminho em que ela sobrevive, é a mais
   * recente; se já colapsou, vale a que ficou anotada */
  grLembrarSelecao();
  const s = grSelGuardada;
  if (!s) {
    try {
      reg("GRIFO", "cor tocada sem trecho selecionado",
          "questão " + (grQid || "?"));
    } catch (e) {}
    return null;
  }
  grAcrescentar(grQid, grTexto, s.ini, s.fim, grCorAtual());
  grPintar(grCaixa, grQid, grTexto);
  try {
    const sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();
  } catch (e) {}
  grEsquecerSelecao();
  try {
    reg("GRIFO", "trecho grifado",
        grCorAtual() + " · " + (s.fim - s.ini) + " caracteres · questão "
        + (grQid || "?"));
  } catch (e) {}
  return { ini: s.ini, fim: s.fim, cor: grCorAtual() };
}

function grLimparTela() {
  if (!grCaixa) return;
  try {
    reg("GRIFO", "grifos apagados",
        grContar(grQid) + " · questão " + (grQid || "?"));
  } catch (e) {}
  grLimpar(grQid);
  grPintar(grCaixa, grQid, grTexto);
}

function grContar(qid) { return grMarcasDe(qid).length; }
