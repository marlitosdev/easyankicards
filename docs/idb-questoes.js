/* =====================================================================
 * AS QUESTÕES NO INDEXEDDB (v19.18.0 — Fase 4 do plano de backup, primeira fatia)
 *
 * "eac_questoes" é a segunda maior gaveta do localStorage (873 KB no backup de 24/10, 595 questões) e cresce a cada
 * sessão; o localStorage tem teto de ~5 MB para o app inteiro. E gravava com um catch VAZIO: sem espaço, a questão nova
 * (ou a resposta) sumia sem uma linha de aviso. Mesma saída das leis, decisões e julgados — o IndexedDB, de cota bem
 * maior —, mas com uma proteção que aquele padrão não tem:
 *
 * A JANELA DO CARREGAMENTO. Depois de migrar, ao abrir a página, as questões levam alguns milissegundos para chegar do
 * IndexedDB; até lá "qsBanco" está vazio. No padrão antigo, uma gravação nessa janela ia para o localStorage com a
 * lista vazia (ou só com a questão nova) — e no carregamento seguinte a "migração" copiava essa lista por cima do
 * IndexedDB: as 595 questões trocadas por uma. Aqui:
 *  · uma MARCA no localStorage ("eac_questoes_onde" = "idb") diz onde as questões moram — sem ela, nada muda: o
 *    localStorage continua sendo a gaveta, como sempre (e é o que roda nos testes e em navegador sem IndexedDB);
 *  · com a marca, enquanto as questões não chegaram, GRAVAR É RECUSADO (fica no registro), nunca escrito pela metade;
 *  · a migração só apaga o localStorage depois de a cópia no IndexedDB terminar E de conferir que o localStorage não
 *    mudou durante a cópia; a marca é posta ANTES de apagar (se a página fechar entre os dois, sobra só uma cópia
 *    velha no localStorage, que a próxima abertura limpa);
 *  · quem precisa de TODAS as questões (backup, cópia de antes do restauro, backup automático) espera qsPronto().
 * ===================================================================== */
const QS_ONDE_CHAVE = "eac_questoes_onde";
const QS_IDB_NOME = "eac_idb_questoes";
const QS_IDB_LOJA = "q";

let qsEsperandoIdb = false;   /* true = moram no IndexedDB e ainda não chegaram: gravar é recusado */
let qsFalhouLer = "";         /* o IndexedDB não respondeu: continua recusando gravar (melhor que apagar tudo) */
let _qsProntoP = null;
let _qsGravando = null;       /* a última gravação em segundo plano (o backup espera por ela antes de recarregar) */
let qsIdbLojaUsada = null;    /* {ler(): Promise<string|null>, gravar(texto): Promise} — trocável nos testes */

function qsIdbSuportado() {
  if (qsIdbLojaUsada) return true;
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; }
}
function qsIdbLojaDefinir(l) { qsIdbLojaUsada = l; }
function qsIdbLoja() {
  if (qsIdbLojaUsada) return qsIdbLojaUsada;
  const abrir = () => new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(QS_IDB_NOME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(QS_IDB_LOJA)) db.createObjectStore(QS_IDB_LOJA); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB das questões"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
  const tx = (modo, fn) => abrir().then((db) => new Promise((resolve, reject) => {
    const x = db.transaction([QS_IDB_LOJA], modo);
    let out;
    const req = fn(x.objectStore(QS_IDB_LOJA));
    if (req) req.onsuccess = () => { out = req.result; };
    x.oncomplete = () => { db.close(); resolve(out); };
    x.onerror = () => { db.close(); reject(x.error || new Error("erro no indexedDB das questões")); };
    x.onabort = () => { db.close(); reject(x.error || new Error("gravação das questões abortada (sem espaço?)")); };
  }));
  qsIdbLojaUsada = {
    ler: () => tx("readonly", (l) => l.get("lista")).then((v) => (typeof v === "string" ? v : null)),
    gravar: (texto) => tx("readwrite", (l) => { l.put(String(texto), "lista"); return null; }),
  };
  return qsIdbLojaUsada;
}
function qsNoIdb() {
  try { return localStorage.getItem(QS_ONDE_CHAVE) === "idb"; } catch (e) { return false; }
}
/* resolve quando as questões estão em memória (na hora, se moram no localStorage) */
function qsPronto() { return _qsProntoP || Promise.resolve(); }

/* chamado por qsCarregar quando há a marca: traz as questões do IndexedDB */
function qsIdbCarregar(aoChegar) {
  qsEsperandoIdb = true;
  qsFalhouLer = "";
  _qsProntoP = qsIdbLoja().ler().then((txt) => {
    let v = [];
    try { v = JSON.parse(txt || "[]"); } catch (e) { v = []; }
    aoChegar(Array.isArray(v) ? v : []);
    qsEsperandoIdb = false;
    /* sobra de uma migração interrompida entre a marca e a limpeza */
    try { localStorage.removeItem(QS_CHAVE_LOJA); } catch (e) {}
    /* a agenda, o edital e o material foram desenhados com zero questões: desenha de novo */
    try { if (typeof edAvisarMudanca === "function") edAvisarMudanca(""); } catch (e) {}
  }).catch((e) => {
    qsFalhouLer = (e && e.message) || "?";
    try { reg("ERRO", "questões: não consegui ler do IndexedDB — gravar fica bloqueado", qsFalhouLer); } catch (x) {}
    try { uiAlert(t("qs_idb_falhou", { e: qsFalhouLer })); } catch (x) {}
  });
  return _qsProntoP;
}

/* gravar com as questões no IndexedDB: memória na hora, IndexedDB em segundo plano. EM FILA: duas gravações seguidas
 * (responder e logo marcar) não podem chegar fora de ordem — a mais velha terminando por último venceria. E só a mais
 * nova da fila importa: se três gravações esperam, a de verdade é uma, com o texto mais recente. */
let _qsTextoPendente = null;
function qsIdbGravar(txt) {
  _qsTextoPendente = txt;
  _qsGravando = (_qsGravando || Promise.resolve()).then(() => {
    const t0 = _qsTextoPendente;
    _qsTextoPendente = null;
    return t0 === null ? null : qsIdbLoja().gravar(t0);
  }).catch((e) => {
    try { reg("ERRO", "questões: o IndexedDB recusou gravar", (e && e.message) || "?"); } catch (x) {}
    try { uiAlert(t("qs_sem_espaco")); } catch (x) {}
  });
  return _qsGravando;
}

/* a migração única: copia, confere que nada mudou, põe a marca, e só então apaga o localStorage */
let _qsMigrando = null;
function qsIdbMigrar() {
  if (_qsMigrando) return _qsMigrando;
  if (!qsIdbSuportado() || qsNoIdb()) { _qsMigrando = Promise.resolve(false); return _qsMigrando; }
  _qsMigrando = (async () => {
    let antes = null;
    try { antes = localStorage.getItem(QS_CHAVE_LOJA); } catch (e) {}
    if (antes == null) return false;          /* nada a migrar (ainda não há questões): fica no localStorage */
    await qsIdbLoja().gravar(antes);
    const conferido = await qsIdbLoja().ler();
    if (conferido !== antes) return false;    /* a cópia não bate: deixa como está */
    let depois = null;
    try { depois = localStorage.getItem(QS_CHAVE_LOJA); } catch (e) {}
    if (depois !== antes) return false;       /* mudou durante a cópia: tenta na próxima abertura */
    try { localStorage.setItem(QS_ONDE_CHAVE, "idb"); } catch (e) { return false; }
    try { localStorage.removeItem(QS_CHAVE_LOJA); } catch (e) {}
    try { reg("ARMAZEN", "questões migradas para o IndexedDB", (antes.length / 1024).toFixed(0) + " KB"); } catch (e) {}
    return true;
  })().catch((e) => {
    try { reg("ARMAZEN", "migração das questões adiada", (e && e.message) || "?"); } catch (x) {}
    return false;
  });
  return _qsMigrando;
}

/* o texto das questões para o backup (null = moram no IndexedDB e ainda não chegaram: quem chama espera qsPronto) */
function qsParaBackup() {
  if (!qsNoIdb()) { try { return localStorage.getItem(QS_CHAVE_LOJA); } catch (e) { return null; } }
  if (qsEsperandoIdb) return null;
  return JSON.stringify(typeof qsBanco !== "undefined" ? qsBanco : []);
}
/* só para teste */
function qsIdbEstado() { return { noIdb: qsNoIdb(), esperando: qsEsperandoIdb, falhou: qsFalhouLer }; }
function qsIdbEsquecer() { _qsMigrando = null; _qsProntoP = null; qsEsperandoIdb = false; qsFalhouLer = ""; }
