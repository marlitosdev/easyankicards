/* =====================================================================
 * OS JULGADOS NO INDEXEDDB (v18.44.0 — JM6, mesmo padrão de idb-leis.js e idb-decisoes.js)
 *
 * "eac_juris" morava no localStorage, que tem teto de ~5 MB para o app inteiro (e já passava de 3 MB). Com a ementa
 * inteira guardada (5–20 KB cada) e os informativos virando lotes de julgados, a gaveta cresce depressa. Mesma solução
 * das leis: mora no IndexedDB (cota bem maior), mas jurLerTudo/jurGravarTudo continuam SÍNCRONAS — ninguém espera
 * promessa; a gravação de verdade acontece em segundo plano.
 *
 * UMA DIFERENÇA DE PROPÓSITO: o cache guarda o TEXTO JSON, não o objeto. jurLerTudo sempre devolveu um objeto NOVO
 * (JSON.parse a cada leitura) e há quem o modifique para montar uma prévia sem gravar; devolver o próprio cache faria
 * essas modificações vazarem. Com o texto, a leitura continua idêntica à de antes.
 * ===================================================================== */
const JUR_IDB_NOME = "eac_idb_juris";
const JUR_IDB_VERSAO = 1;
const JUR_IDB_LOJA = "juris";

let _jurIdbDb = null;
let _jurCache = null;      /* texto JSON do mapa {id: julgado}, depois de migrar; null = ainda no localStorage */
let _jurMigrando = null;

function jurIdbSuportado() {
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; }
  catch (e) { return false; }
}

function jurIdbAbrir() {
  if (_jurIdbDb) return Promise.resolve(_jurIdbDb);
  if (!jurIdbSuportado()) return Promise.reject(new Error("sem indexedDB"));
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(JUR_IDB_NOME, JUR_IDB_VERSAO); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(JUR_IDB_LOJA)) db.createObjectStore(JUR_IDB_LOJA);
    };
    req.onsuccess = () => { _jurIdbDb = req.result; resolve(_jurIdbDb); };
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB dos julgados"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
}

function jurIdbLerTudo() {
  return jurIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([JUR_IDB_LOJA], "readonly");
    const loja = tx.objectStore(JUR_IDB_LOJA);
    const out = {};
    const req = loja.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out[cur.key] = cur.value; cur.continue(); }
      else resolve(out);
    };
    req.onerror = () => reject(req.error || new Error("erro ao ler os julgados do indexedDB"));
  }));
}

/* grava o MAPA INTEIRO (o mesmo contrato do localStorage): limpa a loja e regrava, numa transação só */
function jurIdbGravarTudo(o) {
  return jurIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([JUR_IDB_LOJA], "readwrite");
    const loja = tx.objectStore(JUR_IDB_LOJA);
    loja.clear();
    Object.keys(o || {}).forEach((k) => loja.put(o[k], k));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("erro ao gravar os julgados no indexedDB"));
    tx.onabort = () => reject(tx.error || new Error("gravação dos julgados abortada"));
  }));
}

/* Migração única e silenciosa, com a mesma proteção contra corrida das leis: só apaga o localStorage se ele não mudou
 * durante a cópia (se mudou, tenta de novo no próximo carregamento, com o valor mais novo). */
function jurIdbMigrar() {
  if (_jurMigrando) return _jurMigrando;
  if (!jurIdbSuportado()) { _jurMigrando = Promise.resolve(); return _jurMigrando; }
  _jurMigrando = (async () => {
    let brutoAntes = null;
    try { brutoAntes = localStorage.getItem(JUR_CHAVE); } catch (e) {}
    if (brutoAntes == null) {
      /* nada no localStorage: ou nunca houve julgado, ou já migrou antes — lê o que está no IndexedDB */
      const idb = await jurIdbLerTudo().catch(() => null);
      if (idb) _jurCache = JSON.stringify(idb);
      /* a tela foi desenhada ANTES desta leitura (que é assíncrona) e mostrou zero julgados: com julgados de verdade,
       * desenha de novo (estante, agenda e edital) — senão "sumiram" até a próxima repintura */
      if (idb && Object.keys(idb).length) {
        try { if (typeof jurEsquecerChaves === "function") jurEsquecerChaves(); } catch (e) {}
        try { if (typeof jurRepintarTelas === "function") jurRepintarTelas(); } catch (e) {}
      }
      return;
    }
    let o = {};
    try { o = JSON.parse(brutoAntes) || {}; } catch (e) { o = {}; }
    if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
    await jurIdbGravarTudo(o);
    let brutoDepois = null;
    try { brutoDepois = localStorage.getItem(JUR_CHAVE); } catch (e) {}
    if (brutoDepois !== brutoAntes) return;
    try { localStorage.removeItem(JUR_CHAVE); } catch (e) {}
    _jurCache = JSON.stringify(o);
    try { if (typeof jurEsquecerChaves === "function") jurEsquecerChaves(); } catch (e) {}
  })().catch(() => {});
  return _jurMigrando;
}

/* só para teste (o Node não tem indexedDB): simular "já migrou" */
function jurCacheForcarTeste(texto) { _jurCache = texto; }
function jurCacheAtual() { return _jurCache; }
