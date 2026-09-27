/* =====================================================================
 * O HISTÓRICO DE DECISÕES NO INDEXEDDB (17.39.0 — Fase B, mesmo padrão de idb-leis.js)
 *
 * "eac_decisoes" é a segunda maior gaveta do localStorage (decMaxChars = 500 000
 * caracteres no pior caso) e cresce do mesmo jeito que as leis: uma decisão por vez, ao
 * longo de meses, sem se reconstituir de lugar nenhum se for perdida. Mesma solução:
 * mora no IndexedDB (cota bem maior), mas decLer/decGravar continuam SÍNCRONAS — os
 * chamadores nunca esperam promessa, e a gravação de verdade acontece em segundo plano.
 *
 * "eac_decisoes_resumo" NÃO migra: é limitado pelo número de REGRAS (um punhado de
 * nomes fixos, "colagem.cabecalho" e poucos parecidos), nunca cresce por decisão — fica
 * pequeno para sempre, e não vale a complexidade de mudar de lugar.
 *
 * decLista já é um array em memória, sem chave própria por registro (cada decisão TEM
 * um "id", mas a ordem cronológica é o que decPodar/decDobrar usam — "o mais velho sai
 * primeiro"). O IndexedDB guarda cada decisão pelo seu id (chave própria), e a leitura
 * reconstrói a ordem cronológica ordenando por "q" (o instante ISO gravado em cada
 * decisão) — não depende da ordem de iteração do IndexedDB, que não é garantida. */
const DEC_IDB_NOME = "eac_idb_decisoes";
const DEC_IDB_VERSAO = 1;
const DEC_IDB_LOJA = "decisoes";

let _decIdbDb = null;
let _decCache = null;      /* array, depois de migrar; null = ainda lendo/escrevendo o localStorage */
let _decMigrando = null;

function decIdbSuportado() {
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; }
  catch (e) { return false; }
}

function decIdbAbrir() {
  if (_decIdbDb) return Promise.resolve(_decIdbDb);
  if (!decIdbSuportado()) return Promise.reject(new Error("sem indexedDB"));
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DEC_IDB_NOME, DEC_IDB_VERSAO); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DEC_IDB_LOJA)) db.createObjectStore(DEC_IDB_LOJA);
    };
    req.onsuccess = () => { _decIdbDb = req.result; resolve(_decIdbDb); };
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB das decisões"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
}

function decIdbLerTudo() {
  return decIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([DEC_IDB_LOJA], "readonly");
    const loja = tx.objectStore(DEC_IDB_LOJA);
    const out = [];
    const req = loja.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out.push(cur.value); cur.continue(); }
      else { out.sort((a, b) => String(a && a.q).localeCompare(String(b && b.q))); resolve(out); }
    };
    req.onerror = () => reject(req.error || new Error("erro ao ler as decisões do indexedDB"));
  }));
}

/* Sempre grava a LISTA INTEIRA (mesmo contrato do localStorage) — limpa a loja e regrava
 * tudo numa transação só, cada decisão pelo seu id. */
function decIdbGravarTudo(lista) {
  return decIdbAbrir().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction([DEC_IDB_LOJA], "readwrite");
    const loja = tx.objectStore(DEC_IDB_LOJA);
    loja.clear();
    (lista || []).forEach((r) => { if (r && r.id) loja.put(r, r.id); });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("erro ao gravar as decisões no indexedDB"));
    tx.onabort = () => reject(tx.error || new Error("gravação das decisões abortada"));
  }));
}

/* Migração única e silenciosa — mesma proteção contra corrida que idb-leis.js: só apaga o
 * localStorage se ele não tiver mudado durante a cópia. */
function decIdbMigrar() {
  if (_decMigrando) return _decMigrando;
  if (!decIdbSuportado()) { _decMigrando = Promise.resolve(); return _decMigrando; }
  _decMigrando = (async () => {
    let brutoAntes = null;
    try { brutoAntes = localStorage.getItem(DEC_CHAVE); } catch (e) {}
    if (brutoAntes == null) {
      const idb = await decIdbLerTudo().catch(() => null);
      if (idb) _decCache = idb;
      return;
    }
    let lista = [];
    try { lista = JSON.parse(brutoAntes) || []; } catch (e) { lista = []; }
    if (!Array.isArray(lista)) lista = [];
    await decIdbGravarTudo(lista);
    let brutoDepois = null;
    try { brutoDepois = localStorage.getItem(DEC_CHAVE); } catch (e) {}
    if (brutoDepois !== brutoAntes) return;
    try { localStorage.removeItem(DEC_CHAVE); } catch (e) {}
    _decCache = lista;
  })().catch(() => {});
  return _decMigrando;
}

/* só para teste: ver tests/decisoes.js bloco P */
function decCacheForcarTeste(lista) { _decCache = lista; }
function decCacheAtual() { return _decCache; }
