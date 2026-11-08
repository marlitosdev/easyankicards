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
/* (19.114.0) AS CAIXAS DE TEXTO DO QUADRO: [{x, y, t}] nas coordenadas da folha (as mesmas dos traços). Desenho e
 * texto convivem na mesma folha — antes era um OU outro (o "modo teclado" trocava a folha por um campo de texto). */
let rsNotas = [];
let rsNotaFoco = null;   // a caixa em que o cursor está (para os símbolos)
let rsApagandoAgora = false;   // a borracha do lápis (ou a ponta da caneta) neste gesto
let rsRaioAgora = 0;
let rsCaneta = "preta";
let rsBorracha = false;
let rsDesenhando = false;
let rsSalvo = false;     // reflete o que está no armazenamento
let rsLixo = [];         // pilha para desfazer (traços apagados/limpos)
let rsIniciado = false;
let rsBotoes = {};       // canetas e borracha, por referência

/* ---------------- armazenamento ---------------- */

/* =====================================================================
 * (19.115.0) OS RASCUNHOS NO INDEXEDDB — o mesmo padrão dos julgados (idb-juris.js)
 *
 * Medido: UM rascunho guardado ocupava 115 KB do localStorage, que tem teto de ~5 MB para o app inteiro e já passava
 * de 2 MB. Com o quadro ao lado da questão (folha maior) e o traço liso da caneta (mais pontos), dez rascunhos
 * guardados disputariam espaço com o edital e o material. Agora:
 *  · moram no IndexedDB (cota bem maior); rsLerTudo/rsGravarTudo continuam SÍNCRONAS (cache em texto JSON);
 *  · a migração é única e silenciosa, com a proteção da janela do carregamento (idb-guarda.js): enquanto a gaveta
 *    não chegou, gravar é recusado; sobra no localStorage com rascunhos também no IndexedDB → junta, não copia;
 *  · o traço é guardado COMPACTO (rsCompactar): pontos inteiros e sem os que estão na mesma reta.
 * ===================================================================== */
const RS_IDB_NOME = "eac_idb_rascunhos";
const RS_IDB_LOJA = "r";
let _rsIdbDb = null;
let _rsCache = null;      /* texto JSON do mapa {qid: rascunho}, depois de migrar; null = ainda no localStorage */
let _rsMigrando = null;
let _rsGravando = null;   /* a última gravação em segundo plano (o backup espera por ela antes de recarregar) */
function rsIdbSuportado() { try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; } }
function rsIdbAbrir() {
  if (_rsIdbDb) return Promise.resolve(_rsIdbDb);
  if (!rsIdbSuportado()) return Promise.reject(new Error("sem indexedDB"));
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(RS_IDB_NOME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(RS_IDB_LOJA)) db.createObjectStore(RS_IDB_LOJA); };
    req.onsuccess = () => { _rsIdbDb = req.result; resolve(_rsIdbDb); };
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB dos rascunhos"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
}
function rsIdbLerTudo() {
  return rsIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const out = {};
    const req = db.transaction([RS_IDB_LOJA], "readonly").objectStore(RS_IDB_LOJA).openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { out[c.key] = c.value; c.continue(); } else resolve(out); };
    req.onerror = () => reject(req.error || new Error("erro ao ler os rascunhos do indexedDB"));
  }));
}
/* grava o MAPA INTEIRO (o mesmo contrato do localStorage): limpa a loja e regrava, numa transação só */
function rsIdbGravarTudo(o) {
  return rsIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([RS_IDB_LOJA], "readwrite");
    const loja = tx.objectStore(RS_IDB_LOJA);
    loja.clear();
    Object.keys(o || {}).forEach((k) => loja.put(o[k], k));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("erro ao gravar os rascunhos no indexedDB"));
    tx.onabort = () => reject(tx.error || new Error("gravação dos rascunhos abortada"));
  }));
}
function rsIdbMigrar() {
  if (_rsMigrando) return _rsMigrando;
  if (!rsIdbSuportado() || typeof idbGuardaComecar !== "function") { _rsMigrando = Promise.resolve(); return _rsMigrando; }
  let brutoAntes = null;
  try { brutoAntes = localStorage.getItem(RS_CHAVE); } catch (e) {}
  if (brutoAntes == null) {
    const marcada = idbMarcaTem(RS_CHAVE);
    _rsMigrando = idbGuardaComecar("rascunhos", async () => {
      /* nada no localStorage: ou nunca houve rascunho, ou já migrou — lê o IndexedDB. Sem nada em lugar nenhum, fica
       * como os julgados: o primeiro rascunho vai ao localStorage e migra no carregamento seguinte (marcar uma gaveta
       * vazia faria uma leitura quebrada avisar e bloquear por nada) */
      const idb = await rsIdbLerTudo();
      if (!marcada && !Object.keys(idb || {}).length) return;
      _rsCache = JSON.stringify(idb || {});
      idbMarcaPor(RS_CHAVE);
      try { if (rsQid && typeof rsPintarGatilhos === "function") rsPintarGatilhos(); } catch (e) {}
    }, marcada);
    return _rsMigrando;
  }
  _rsMigrando = idbGuardaComecar("rascunhos", async () => {
    let o = {};
    try { o = JSON.parse(brutoAntes) || {}; } catch (e) { o = {}; }
    if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
    /* já que vai regravar tudo, guarda compacto (os traços antigos tinham pontos com 14 casas decimais) */
    Object.keys(o).forEach((k) => { if (o[k] && Array.isArray(o[k].tracos)) o[k].tracos = rsCompactar(o[k].tracos); });
    const idb = await rsIdbLerTudo();
    const sobra = Object.keys(idb || {}).length > 0;
    const final = sobra ? idbJuntarMapas(idb, o) : o;
    await rsIdbGravarTudo(final);
    let brutoDepois = null;
    try { brutoDepois = localStorage.getItem(RS_CHAVE); } catch (e) {}
    /* mudou durante a cópia: fica para o próximo carregamento, com o valor mais novo */
    if (brutoDepois !== brutoAntes) return;
    if (!idbMarcaPor(RS_CHAVE)) return;
    try { localStorage.removeItem(RS_CHAVE); } catch (e) {}
    _rsCache = JSON.stringify(final);
    try { reg("ARMAZEN", "rascunhos: do localStorage para o IndexedDB", Object.keys(o).length + " rascunho(s) · " + Math.round(brutoAntes.length * 2 / 1024) + " KB → " + Math.round(_rsCache.length * 2 / 1024) + " KB"); } catch (e) {}
  }, false);
  return _rsMigrando;
}
function rsNoIdb() { return typeof _rsCache === "string" && !!_rsCache; }
/* só para teste (o Node não tem indexedDB): simular "já migrou" */
function rsCacheForcarTeste(texto) { _rsCache = texto; }

/* O TRAÇO COMPACTO: pontos inteiros (a folha já tem resolução de tela, até 2× a densidade) e sem os que caem na mesma
 * reta — a forma desenhada não muda, o tamanho cai a uma fração */
function rsCompactar(tracos) {
  return (tracos || []).map((tr) => {
    let pts = (tr.pontos || []).map((p) => [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]);
    if (pts.length > 2 && typeof tnSimplificar === "function") { try { pts = tnSimplificar(pts, 0.75); } catch (e) {} }
    pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (pts.length === 1) pts.push([pts[0][0] + 1, pts[0][1] + 1]);
    return Object.assign({}, tr, { larg: Math.round((Number(tr.larg) || 3) * 10) / 10, pontos: pts });
  }).filter((tr) => tr.pontos.length > 1);
}

function rsLerTudo() {
  try {
    const bruto = rsNoIdb() ? _rsCache : localStorage.getItem(RS_CHAVE);
    const o = JSON.parse(bruto || "{}");
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}
function rsGravarTudo(o) {
  /* a gaveta ainda está chegando do IndexedDB: gravar agora trocaria todos os rascunhos pelos da memória */
  if (typeof idbGuardaPodeGravar === "function" && !idbGuardaPodeGravar("rascunhos")) return false;
  try {
    const s = JSON.stringify(o || {});
    if (rsNoIdb()) {
      _rsCache = s;
      _rsGravando = rsIdbGravarTudo(JSON.parse(s)).catch(() => { try { uiAlert(t("rs_sem_espaco")); } catch (e2) {} });
      return true;
    }
    localStorage.setItem(RS_CHAVE, s);
    return true;
  } catch (e) {
    /* cota estourada: avisar em vez de fingir que salvou */
    try { uiAlert(t("rs_sem_espaco")); } catch (e2) {}
    return false;
  }
}
/* começa a migração em segundo plano (no Node não há indexedDB: não faz nada) */
try { rsIdbMigrar(); } catch (e) {}
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
  /* (19.114.0) o texto do antigo "modo teclado" vira uma caixa no alto da folha; quem já tem caixas guardadas não
   * ganha a cópia (o texto delas também vai em "texto", por compatibilidade) */
  const notasG = guardado && Array.isArray(guardado.notas) && guardado.notas.length ? guardado.notas : null;
  rsNotas = notasG ? notasG.map((n) => ({ x: Number(n.x) || 0, y: Number(n.y) || 0, t: String(n.t || "") }))
    : (guardado && String(guardado.texto || "").trim() ? [{ x: 24, y: 24, t: String(guardado.texto) }] : []);
  rsNotaFoco = null;
  if (tx0) tx0.value = "";
  /* volta no modo em que há conteúdo: guardado só texto, abrir na
   * caneta mostraria uma folha em branco sobre um rascunho que existe */
  rsModoTrocar("caneta");
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
  rsNotas.forEach((n) => { n.x *= fx; n.y *= fy; });
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
  const ladoJa = rsLadoMarcar(!rsCheia && rsAberto() && rsLadoCabe());
  const f = rsCheia ? rsFolhaDaTela() : (ladoJa ? rsFolhaDoLado() : RS_FOLHA_NORMAL);
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
  if (!rsCheia) {
    const lado = !sim && rsLadoCabe();
    rsLadoMarcar(lado);
    const fl = lado ? rsFolhaDoLado() : RS_FOLHA_NORMAL;
    rsRedimensionar(fl.w, fl.h);
  }
  if (!sim) rsPintar();
  try { if (typeof tnPintarBarra === "function") tnPintarBarra(); } catch (e) {}
}
/* =====================================================================
 * (19.114.0) O QUADRO AO LADO DA QUESTÃO
 *
 * Em tela larga, o quadro abre À DIREITA da questão, na altura toda: a conta fica do lado do enunciado, como o papel
 * ao lado da prova. Em tela estreita continua o painel que sobe por baixo; a folha inteira continua a um toque.
 * ===================================================================== */
const RS_FOLHA_LADO = { w: 800, h: 1100 };
const RS_LADO_MIN = 1000;
function rsLadoCabe() {
  const dlg = typeof document !== "undefined" ? $("dlgQsResponder") : null;
  let w = 0;
  try { w = dlg && dlg.getBoundingClientRect ? dlg.getBoundingClientRect().width : 0; } catch (e) { w = 0; }
  return w >= RS_LADO_MIN;
}
function rsLadoMarcar(sim) {
  const dlg = $("dlgQsResponder");
  if (dlg && dlg.classList) dlg.classList.toggle("rs-lado", !!sim);
  return !!sim;
}
/* a folha do lado tem o tamanho do painel (medido depois de o painel ir para o lado); sem medida, um tamanho fixo */
function rsFolhaDoLado() {
  try {
    const f = typeof document !== "undefined" && document.querySelector ? document.querySelector("#rsCaixa .rs-folha") : null;
    const r = f && f.getBoundingClientRect ? f.getBoundingClientRect() : null;
    if (r && r.width > 100 && r.height > 100) {
      const dpr = Math.max(1, Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
      return { w: Math.round(r.width * dpr), h: Math.round((r.height - 4) * dpr) };
    }
  } catch (e) {}
  return RS_FOLHA_LADO;
}
function rsLadoAtual() { const d = $("dlgQsResponder"); return !!(d && d.classList && d.classList.contains("rs-lado")); }
/* o quadro pelo 📄 da barra do lápis: abre (ou fecha) sem sair da questão */
function rsQuadroAlternar(abrir) {
  if (!rsIniciado) rsIniciar();
  const vai = abrir === undefined ? !rsAberto() : !!abrir;
  if (vai) { rsRecolher(false); } else rsRecolher(true);
  return rsAberto();
}
/* a janela mudou de tamanho: o quadro aberto troca entre embaixo e ao lado */
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("resize", () => {
    try {
      if (!rsIniciado || !rsAberto() || rsCheia) return;
      const lado = rsLadoCabe();
      if (lado === rsLadoAtual()) return;
      rsLadoMarcar(lado);
      const fl = lado ? rsFolhaDoLado() : RS_FOLHA_NORMAL;
      rsRedimensionar(fl.w, fl.h);
    } catch (e) {}
  });
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
  const doCampo = tx ? String(tx.value || "") : "";
  const dasNotas = rsNotas.map((n) => n.t).filter((x) => String(x || "").trim()).join("\n");
  return [dasNotas, doCampo].filter((x) => x.trim()).join("\n");
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
  const b1 = $("btnRsAbrir");
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
    /* (19.114.0) A ENTRADA É UMA SÓ: o ✏️ da questão abre a barra, e o 📄 dela abre este quadro. O "rascunho" do
     * cabeçalho duplicava o caminho (o relato: "a ferramenta de anotação está duplicada"); fica no HTML, escondido,
     * e ainda abre o quadro se algo o chamar. */
    b1.hidden = true;
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

/* (19.114.0) UM MOTOR SÓ: com a barra do lápis aberta, o quadro usa as ferramentas DELA — a mesma cor, a mesma
 * espessura, o marca-texto, a borracha, a mão, o texto —, a palma da mão ignorada com a caneta em uso, a ponta de
 * borracha da caneta e o botão direito do mouse apagando. As canetas próprias do quadro só aparecem com a barra
 * fechada. */
function rsPeloLapis() {
  try { return typeof tnAbertaAgora === "function" && tnAbertaAgora(); } catch (e) { return false; }
}
/* pixels da folha por pixel da tela (a folha tem tamanho interno próprio) */
function rsEscala() {
  const cv = rsTela();
  try {
    const r = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
    if (r && r.width) return cv.width / r.width;
  } catch (e) {}
  return 1;
}
function rsComecarPeloLapis(e, x, y) {
  const borr = tnFerr === "borracha" || (typeof tnBorrachaDoPonteiro === "function" && tnBorrachaDoPonteiro(e));
  if (!borr && tnFerr === "mao") return false;
  if (!borr && typeof tnAceitaPonteiro === "function" && !tnAceitaPonteiro(e)) return false;
  if (!borr && tnFerr === "texto") { rsNotaNova(x, y, "", true); return true; }
  const esc = rsEscala();
  if (borr) {
    rsApagandoAgora = true;
    rsRaioAgora = Math.max(4, (Number(tnLarg.borracha) || 14) * esc);
    rsApagarEm(x, y, rsRaioAgora);
    rsDesenhando = true;
    return true;
  }
  const marca = tnFerr === "marca";
  const cor = tnCorDe(tnCor);
  rsTracos.push({ cor: marca ? cor + "61" : cor, larg: Math.max(1, (Number(tnLarg[marca ? "marca" : "lapis"]) || 3) * esc), pontos: [[x, y]] });
  rsDesenhando = true;
  rsMarcarSujo();
  rsPintar();
  return true;
}
function rsComecar(e) {
  if (!rsAberto()) return;
  const [x, y] = rsCoords(e);
  if (rsPeloLapis()) { rsComecarPeloLapis(e, x, y); return; }
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
  if (rsApagandoAgora) { rsApagarEm(x, y, rsRaioAgora); return; }
  if (rsBorracha) { rsApagarEm(x, y); return; }
  const tr = rsTracos[rsTracos.length - 1];
  if (!tr) return;
  /* (19.114.0) os pontos agrupados pelo navegador: o traço da caneta sai liso, sem os cantos de quem perdeu pontos */
  let evs = null;
  try { evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null; } catch (er) { evs = null; }
  const pts = evs && evs.length ? evs.map(rsCoords) : [[x, y]];
  pts.forEach((p) => {
    const ult = tr.pontos[tr.pontos.length - 1];
    /* ponto praticamente no mesmo lugar só engorda o guardado */
    if (ult && Math.abs(ult[0] - p[0]) < 1 && Math.abs(ult[1] - p[1]) < 1) return;
    tr.pontos.push([p[0], p[1]]);
  });
  rsPintar();
}
function rsSoltar() {
  if (!rsDesenhando) return;
  rsDesenhando = false;
  if (rsApagandoAgora) { rsApagandoAgora = false; rsPintar(); return; }
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

function rsApagarEm(x, y, raio) {
  const sobrou = [];
  const tirados = [], postos = [];
  rsTracos.forEach((tr) => {
    const partes = rsPartirTraco(tr, x, y, raio || rsBorrachaRaio);
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
    if (v.notas && v.notas.length) rsNotas = rsNotas.concat(v.notas);
  } else if (rsTracos.length) {
    rsTracos.pop();
  } else return;
  rsMarcarSujo();
  rsPintar();
}

async function rsLimpar() {
  if (!rsTracos.length && !rsNotas.length) { uiAlert(t("rs_vazio")); return; }
  if (!(await uiConfirm(t("rs_limpar_conf", { n: rsTracos.length + rsNotas.length })))) return;
  rsLixo.push({ tipo: "limpeza", tracos: rsTracos, notas: rsNotas });
  rsTracos = [];
  rsNotas = [];
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
  rsPintarNotas();
  const cx = $("rsCaixa");
  if (cx && cx.classList) cx.classList.toggle("rs-pelo-lapis", rsPeloLapis());
  /* estado das ferramentas */
  RS_CANETAS.forEach((c) => {
    const b = rsBotoes[c.id];
    if (b) b.className = "rs-caneta" +
      (!rsBorracha && rsCaneta === c.id ? " rs-sel" : "");
  });
  if (rsBotoes.borracha) rsBotoes.borracha.className =
    "btn-min rs-borracha" + (rsBorracha ? " rs-sel" : "");
  rsPintarBorrachas();
  rsPintarAviso();
  const bs = $("btnRsSalvar");
  if (bs) bs.textContent = t(rsSalvo ? "rs_salvar_de_novo" : "rs_salvar");
  const bl = $("btnRsApagarSalvo");
  if (bl) bl.hidden = !(rsQid && rsDaQuestao(rsQid));
  const bModo = $("btnRsModo");
  /* (19.114.0) o "modo teclado" deu lugar às caixas de texto na própria folha (ferramenta T do lápis) */
  if (bModo) bModo.hidden = true;
  if (bModo) {
    bModo.textContent = t(rsModo === "caneta" ? "rs_modo_teclado" : "rs_modo_caneta");
    bModo.title = t(rsModo === "caneta" ? "rs_modo_teclado_ajuda" : "rs_modo_caneta_ajuda");
  }
  const bVidro = $("btnRsVidro");
  if (bVidro) {
    /* só faz sentido na folha inteira: no painel de 72% a questão já
     * está visível acima dele */
    /* (19.114.0) riscar por cima do enunciado é o lápis da própria questão: a folha transparente saiu de cena */
    bVidro.hidden = true;
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
  tudo[rsQid] = { tracos: rsCompactar(rsTracos), texto: rsTextoAtual(),
                  notas: rsNotas.filter((n) => String(n.t || "").trim()).map((n) => ({ x: Math.round(n.x), y: Math.round(n.y), t: n.t })),
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
  return !!(rsQid && rsTemAlgo() && !rsSalvo);
}

async function rsGuardarSeSair() {
  if (!rsQid || !rsTemAlgo() || rsSalvo) return;
  if (await uiConfirm(t("rs_sair_conf"))) rsSalvarNaQuestao();
}

/* =====================================================================
 * (19.114.0) CAIXAS DE TEXTO NA FOLHA
 *
 * Com a ferramenta T do lápis, um toque na folha abre uma caixa ali mesmo: os dados da questão, a conta digitada, um
 * lembrete — ao lado do que foi desenhado. Caixa que fica vazia some sozinha ao sair dela.
 * ===================================================================== */
function rsNotasCaixa() {
  let box = $("rsNotas");
  if (box) return box;
  const folha = typeof document !== "undefined" && document.querySelector ? document.querySelector("#rsCaixa .rs-folha") : null;
  if (!folha || !folha.append) return null;
  box = document.createElement("div");
  box.id = "rsNotas";
  box.className = "rs-notas";
  folha.append(box);
  return box;
}
function rsNotaNova(x, y, txt, focar) {
  const n = { x: Number(x) || 0, y: Number(y) || 0, t: String(txt || "") };
  rsNotas.push(n);
  rsNotaFoco = n;
  rsMarcarSujo();
  rsPintarNotas();
  if (focar) {
    const el = rsNotaEl(n);
    try { if (el && el.focus) el.focus(); } catch (e) {}
  }
  return n;
}
function rsNotaEl(n) {
  const box = $("rsNotas");
  if (!box || !box.children) return null;
  const i = rsNotas.indexOf(n);
  return i >= 0 ? box.children[i] || null : null;
}
/* a próxima caixa nasce embaixo da última (o teclado não escolhe lugar na folha) */
function rsNotaProximaPos() {
  if (!rsNotas.length) return [24, 24];
  const u = rsNotas[rsNotas.length - 1];
  const linhas = String(u.t || "").split("\n").length;
  return [u.x, u.y + (linhas + 1) * 22 * rsEscala()];
}
function rsAjustarAltura(ta) {
  if (!ta || !ta.style) return;
  ta.rows = Math.max(1, String(ta.value || "").split("\n").length);
}
function rsPintarNotas() {
  const box = rsNotasCaixa();
  if (!box) return;
  const cv = rsTela();
  const W = (cv && cv.width) || RS_FOLHA_NORMAL.w, H = (cv && cv.height) || RS_FOLHA_NORMAL.h;
  /* a camada das caixas cobre exatamente a folha (o canvas): posição em % da folha */
  if (box.style && cv) {
    box.style.width = (cv.offsetWidth || 0) + "px";
    box.style.height = (cv.offsetHeight || 0) + "px";
  }
  const ativo = typeof document !== "undefined" ? document.activeElement : null;
  /* não refaz a caixa em que se está digitando: o cursor pularia para o fim */
  const vivas = Array.from(box.children || []);
  if (vivas.length === rsNotas.length && vivas.every((el, i) => el._nota === rsNotas[i])) {
    vivas.forEach((el) => { el.style.left = (el._nota.x / W * 100) + "%"; el.style.top = (el._nota.y / H * 100) + "%"; });
    return;
  }
  box.innerHTML = "";
  rsNotas.forEach((n) => {
    const ta = document.createElement("textarea");
    ta.className = "rs-nota";
    ta._nota = n;
    ta.value = n.t;
    ta.rows = 1;
    ta.spellcheck = false;
    ta.placeholder = t("rs_nota_ph");
    ta.setAttribute("aria-label", t("rs_nota_aj"));
    ta.style.left = (n.x / W * 100) + "%";
    ta.style.top = (n.y / H * 100) + "%";
    rsAjustarAltura(ta);
    ta.oninput = (ev) => {
      const tipo = String((ev && ev.inputType) || "insertText");
      const r = /^insert/.test(tipo) && tipo !== "insertFromPaste" && tipo !== "insertFromDrop"
        ? simbAutoTrocar(ta.value, ta.selectionStart, ev && ev.data ? String(ev.data).length : 1) : { txt: ta.value };
      if (r.txt !== ta.value) {
        ta.value = r.txt;
        try { ta.setSelectionRange(r.pos, r.pos); } catch (e) {}
      }
      n.t = ta.value;
      rsAjustarAltura(ta);
      rsMarcarSujo();
      rsPintarAviso();
    };
    ta.onfocus = () => { rsNotaFoco = n; };
    ta.onblur = () => {
      if (!String(n.t || "").trim()) {
        const i = rsNotas.indexOf(n);
        if (i >= 0) { rsNotas.splice(i, 1); rsPintarNotas(); rsPintarAviso(); }
        if (rsNotaFoco === n) rsNotaFoco = null;
      }
    };
    /* Esc sai da caixa (e não fecha a rodada); as teclas de responder não valem aqui dentro */
    ta.onkeydown = (ev) => {
      if (ev.key === "Escape") { if (ev.preventDefault) ev.preventDefault(); if (ev.stopPropagation) ev.stopPropagation(); try { ta.blur(); } catch (e) {} }
    };
    box.append(ta);
    if (ativo && ativo._nota === n) { try { ta.focus(); } catch (e) {} }
  });
}
function rsPintarAviso() {
  const av = $("rsAviso");
  if (!av) return;
  const n = rsTracos.length + rsNotas.filter((x) => String(x.t || "").trim()).length;
  av.textContent = !n ? "" : t(rsSalvo ? "rs_estado_salvo" : "rs_estado_nao", { n });
  av.className = "rs-aviso" + (rsSalvo ? " rs-ok" : "");
}
/* um símbolo no cursor da caixa em uso (ou numa caixa nova, embaixo da última) */
function rsInserirSimbolo(sb) {
  let n = rsNotaFoco && rsNotas.indexOf(rsNotaFoco) >= 0 ? rsNotaFoco : null;
  if (!n) { const p = rsNotaProximaPos(); n = rsNotaNova(p[0], p[1], "", false); }
  const el = rsNotaEl(n);
  if (el && typeof el.selectionStart === "number" && el.value === n.t) {
    const a = el.selectionStart, b = el.selectionEnd;
    el.value = n.t.slice(0, a) + sb + n.t.slice(b);
    n.t = el.value;
    try { el.focus(); el.setSelectionRange(a + sb.length, a + sb.length); } catch (e) {}
    rsAjustarAltura(el);
  } else {
    n.t += sb;
    rsPintarNotas();
  }
  rsMarcarSujo();
  rsPintarAviso();
  return n.t;
}

/* =====================================================================
 * (19.114.0) SÍMBOLOS — lógica, conjuntos, estatística e matemática financeira
 *
 * Uma fileira para tocar, e atalhos que viram símbolo enquanto se digita: "->" vira →, "<->" vira ↔, "<=" vira ≤,
 * "^2" vira ², "^n" vira ⁿ. Para quem não tem tela de toque nem caneta, é o teclado que escreve a fórmula.
 * ===================================================================== */
const SIMB_FILEIRA = ["¬", "∧", "∨", "⊻", "→", "↔", "≡", "∀", "∃", "∈", "∩", "∪", "≤", "≥", "≠", "≈", "±", "×", "÷", "√", "Σ", "x̄", "σ", "μ", "²", "ⁿ", "%"];
const SIMB_TROCAS = [["<->", "↔"], ["->", "→"], ["=>", "⇒"], ["<=", "≤"], [">=", "≥"], ["!=", "≠"], ["~=", "≈"], ["+-", "±"],
  ["^n", "ⁿ"], ["^i", "ⁱ"], ["^0", "⁰"], ["^1", "¹"], ["^2", "²"], ["^3", "³"], ["^4", "⁴"], ["^5", "⁵"], ["^6", "⁶"], ["^7", "⁷"], ["^8", "⁸"], ["^9", "⁹"]];
const SIMB_SOBRE = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/* troca só o que acabou de ser digitado — os "n" caracteres antes do cursor (1 numa tecla; o trecho inteiro no ditado
 * ou na correção automática), mais 2 de contexto para o atalho que começou antes ("<-" + ">"). Texto colado ou já
 * escrito fica como está. */
function simbAutoTrocar(txt, pos, n) {
  const s = String(txt || "");
  const p = typeof pos === "number" ? pos : s.length;
  const ini = Math.max(0, p - Math.max(1, Number(n) || 1) - 2);
  let jan = s.slice(ini, p);
  SIMB_TROCAS.forEach(([de, para]) => { if (jan.indexOf(de) >= 0) jan = jan.split(de).join(para); });
  /* o expoente continua: "¹" + "2" vira "¹²" */
  let mudou = true;
  while (mudou) {
    mudou = false;
    jan = jan.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹])(\d)/, (m, a, d) => { mudou = true; return a + SIMB_SOBRE[d]; });
  }
  if (jan === s.slice(ini, p)) return { txt: s, pos: p };
  const novo = s.slice(0, ini) + jan;
  return { txt: novo + s.slice(p), pos: novo.length };
}
function rsSimbolosMontar() {
  let fila = $("rsSimbolos");
  if (fila) return fila;
  const acoes = typeof document !== "undefined" && document.querySelector ? document.querySelector("#rsCaixa .rs-acoes") : null;
  if (!acoes || !acoes.parentNode) return null;
  fila = document.createElement("div");
  fila.id = "rsSimbolos";
  fila.className = "rs-simbolos";
  fila.setAttribute("role", "toolbar");
  fila.setAttribute("aria-label", t("rs_simb_aj"));
  SIMB_FILEIRA.forEach((sb) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rs-simb";
    b.textContent = sb;
    b.title = t("rs_simb_inserir", { s: sb });
    /* o toque no símbolo não tira o cursor da caixa */
    b.onpointerdown = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); };
    b.onmousedown = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); };
    b.onclick = () => rsInserirSimbolo(sb);
    fila.append(b);
  });
  acoes.parentNode.insertBefore(fila, acoes);
  return fila;
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
  /* "FOLHA INTEIRA" MOROU FORA POR UMA VERSÃO, DUPLICANDO btnRsCheia.
   * Era um segundo gatilho ("abrir já em tela cheia") ao lado de
   * "abrir rascunho" — mas btnRsCheia, DENTRO do rascunho já aberto, já
   * faz exatamente isso num toque a mais. Dois caminhos para o mesmo
   * lugar não economizavam nada, só disputavam espaço na barra. */
  const b1 = $("btnRsAbrir");
  if (b1) {
    b1.onclick = () => {
      if (!rsIniciado) rsIniciar();
      rsRecolher(false);
      rsCheiaTrocar(false);
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
    /* o botão direito do mouse apaga (com a barra do lápis aberta): o menu do navegador não abre por cima */
    cv.oncontextmenu = (e) => { if (rsPeloLapis() && e && e.preventDefault) e.preventDefault(); };
  }
  try { rsSimbolosMontar(); rsNotasCaixa(); } catch (e) {}
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
    rsNotaNova, rsInserirSimbolo, simbAutoTrocar, rsQuadroAlternar,
    rsCompactar, rsLerTudo, rsGravarTudo, rsNoIdb, rsCacheForcarTeste,
  };
}
