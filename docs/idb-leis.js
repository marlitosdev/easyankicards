/* =====================================================================
 * BIBLIOTECA DE LEIS NO INDEXEDDB (17.38.0)
 *
 * O localStorage tem um teto fixo por site (5-10 MB, não importa quanto
 * disco a pessoa tenha) e "eac_leis" era a maior gaveta dele — cada lei
 * grande colada empurrava o app para mais perto do "não há espaço no
 * navegador para guardar esta lei". O IndexedDB usa uma cota muito maior
 * (uma fatia do disco livre, ainda maior com armazenamento permanente
 * concedido), e é o lugar certo para conteúdo que só cresce.
 *
 * A TROCA TEM DE SER INVISÍVEL PARA O RESTO DO APP. leiDe/leiGuardar/
 * leisLista e tudo que depende deles (dezenas de lugares, em vários
 * arquivos) chamam leisLerTudo()/leisGravarTudo() sem esperar promessa
 * nenhuma — são mais de cem pontos de uso para reescrever de uma vez, e
 * cada um vira um jeito novo de quebrar a leitura de uma lei no meio de
 * um estudo. Por isso as duas continuam SÍNCRONAS: leisLerTudo devolve
 * o que já está em memória (_leisCache, carregado uma vez), e
 * leisGravarTudo atualiza a memória na hora e manda a gravação de
 * verdade para o IndexedDB em segundo plano, sem que quem chamou espere
 * por ela. Só a migração em si (uma vez, ao carregar o app) é
 * assíncrona — e enquanto ela não termina, tudo continua lendo e
 * escrevendo o localStorage exatamente como sempre fez.
 * ===================================================================== */
const LEIS_IDB_NOME = "eac_idb";
const LEIS_IDB_VERSAO = 1;
const LEIS_IDB_LOJA = "leis";

let _leisIdbDb = null;      /* IDBDatabase, uma vez aberto */
let _leisCache = null;      /* {id: registro, ...} depois de migrar; null = ainda lendo/escrevendo o localStorage */
let _leisMigrando = null;   /* a promessa da migração em curso, para não disparar duas */

function leisIdbSuportado() {
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; }
  catch (e) { return false; }
}

function leisIdbAbrir() {
  if (_leisIdbDb) return Promise.resolve(_leisIdbDb);
  if (!leisIdbSuportado()) return Promise.reject(new Error("sem indexedDB"));
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(LEIS_IDB_NOME, LEIS_IDB_VERSAO); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LEIS_IDB_LOJA)) db.createObjectStore(LEIS_IDB_LOJA);
    };
    req.onsuccess = () => { _leisIdbDb = req.result; resolve(_leisIdbDb); };
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
}

function leisIdbLerTudo() {
  return leisIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([LEIS_IDB_LOJA], "readonly");
    const loja = tx.objectStore(LEIS_IDB_LOJA);
    const out = {};
    const req = loja.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out[cur.key] = cur.value; cur.continue(); }
      else resolve(out);
    };
    req.onerror = () => reject(req.error || new Error("erro ao ler as leis do indexedDB"));
  }));
}

/* Sempre grava o CONJUNTO INTEIRO — o mesmo contrato que o localStorage já tinha
 * (leisGravarTudo recebe o objeto completo, não um registro por vez), então limpa a
 * loja e regrava tudo numa transação só: nunca sobra registro apagado de fora do app. */
function leisIdbGravarTudo(o) {
  return leisIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([LEIS_IDB_LOJA], "readwrite");
    const loja = tx.objectStore(LEIS_IDB_LOJA);
    loja.clear();
    Object.keys(o || {}).forEach((k) => loja.put(o[k], k));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("erro ao gravar as leis no indexedDB"));
    tx.onabort = () => reject(tx.error || new Error("gravação das leis abortada"));
  }));
}

/* Migração única e silenciosa. Só apaga o localStorage depois de confirmar que a
 * gravação no IndexedDB terminou — e só se o localStorage não tiver mudado no meio
 * do caminho (alguém gravando uma lei nos poucos milissegundos da migração): se
 * mudou, não apaga nada e tenta de novo na próxima abertura, com o valor mais novo. */
function leisIdbMigrar() {
  if (_leisMigrando) return _leisMigrando;
  if (!leisIdbSuportado()) { _leisMigrando = Promise.resolve(); return _leisMigrando; }
  _leisMigrando = (async () => {
    let brutoAntes = null;
    try { brutoAntes = localStorage.getItem(LEIS_CHAVE); } catch (e) {}
    if (brutoAntes == null) {
      /* nada no localStorage: ou nunca houve lei, ou já migrou antes — lê o que já está no IndexedDB */
      const idb = await leisIdbLerTudo().catch(() => null);
      if (idb) _leisCache = idb;
      return;
    }
    let o = {};
    try { o = JSON.parse(brutoAntes) || {}; } catch (e) { o = {}; }
    await leisIdbGravarTudo(o);
    let brutoDepois = null;
    try { brutoDepois = localStorage.getItem(LEIS_CHAVE); } catch (e) {}
    if (brutoDepois !== brutoAntes) return; /* mudou durante a migração: não apaga, não usa cache ainda */
    try { localStorage.removeItem(LEIS_CHAVE); } catch (e) {}
    _leisCache = o;
  })().catch(() => {});
  return _leisMigrando;
}

/* só para teste: forçar/ler o estado de "já migrou" sem precisar de um IndexedDB de
 * verdade (o Node do runner de testes não tem um) — ver tests/lei-biblioteca.js bloco P */
function leisCacheForcarTeste(o) { _leisCache = o; }
function leisCacheAtual() { return _leisCache; }
