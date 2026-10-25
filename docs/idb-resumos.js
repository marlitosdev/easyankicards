/* =====================================================================
 * OS RESUMOS NO INDEXEDDB (v19.20.0 — Fase 4 do plano de backup, segunda fatia)
 *
 * "eac_resumos" é a maior gaveta que ainda morava no localStorage (1,0 MB no backup de 24/10: 36 tópicos, com o texto
 * dos resumos e os cartões de cada um). Muda para o IndexedDB com as proteções das questões (v19.18.0) e do guarda
 * comum (idb-guarda.js, v19.19.0):
 *  · a MARCA "eac_resumos_onde" = "idb" diz onde moram; sem ela, nada muda (localStorage, como sempre — é o que roda
 *    nos testes e em navegador sem IndexedDB);
 *  · a migração copia, LÊ DE VOLTA e confere, confere que o localStorage não mudou durante a cópia, põe a marca e só
 *    então apaga; se o IndexedDB já tinha resumos (cópia interrompida), JUNTA (mesmo tópico: o do localStorage);
 *  · aberto já migrado, enquanto não chegam, GRAVAR É RECUSADO (o guarda avisa) — gravar o pouco da memória por cima
 *    de 36 tópicos é exatamente a perda que o guarda existe para impedir;
 *  · ao chegarem: os consertos de arranque (chaves órfãs, lacunas quebradas) rodam de novo — na primeira vez rodaram
 *    com a gaveta vazia — e as telas são redesenhadas.
 * ===================================================================== */
const MAT_CHAVE_LOJA = "eac_resumos";
const MAT_IDB_NOME = "eac_idb_resumos";
const MAT_IDB_LOJA = "r";

let matIdbLojaUsada = null;   /* {ler(): Promise<string|null>, gravar(texto): Promise} — trocável nos testes */
let _matMigrando = null;
let _matCarregando = null;
let _matGravando = null;
let _matTextoPendente = null;

function matIdbSuportado() {
  if (matIdbLojaUsada) return true;
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; }
}
function matIdbLojaDefinir(l) { matIdbLojaUsada = l; }
function matIdbLoja() {
  if (matIdbLojaUsada) return matIdbLojaUsada;
  const abrir = () => new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(MAT_IDB_NOME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(MAT_IDB_LOJA)) db.createObjectStore(MAT_IDB_LOJA); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB dos resumos"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado (outra aba com versão antiga aberta)"));
  });
  const tx = (modo, fn) => abrir().then((db) => new Promise((resolve, reject) => {
    const x = db.transaction([MAT_IDB_LOJA], modo);
    let out;
    const req = fn(x.objectStore(MAT_IDB_LOJA));
    if (req) {
      req.onsuccess = () => { out = req.result; };
      req.onerror = () => { db.close(); reject(req.error || new Error("erro ao ler os resumos do indexedDB")); };
    }
    x.oncomplete = () => { db.close(); resolve(out); };
    x.onerror = () => { db.close(); reject(x.error || new Error("erro no indexedDB dos resumos")); };
    x.onabort = () => { db.close(); reject(x.error || new Error("gravação dos resumos abortada (sem espaço?)")); };
  }));
  matIdbLojaUsada = {
    ler: () => tx("readonly", (l) => l.get("mapa")).then((v) => (typeof v === "string" ? v : null)),
    gravar: (texto) => tx("readwrite", (l) => { l.put(String(texto), "mapa"); return null; }),
  };
  return matIdbLojaUsada;
}
function matNoIdb() { return typeof idbMarcaTem === "function" && idbMarcaTem(MAT_CHAVE_LOJA); }
function matObjeto(txt) {
  let o = {};
  try { o = JSON.parse(txt || "{}"); } catch (e) { o = {}; }
  return o && typeof o === "object" && !Array.isArray(o) ? o : {};
}

/* com a marca: traz os resumos do IndexedDB (uma vez por abertura). aoChegar recebe o mapa. */
function matIdbCarregar(aoChegar) {
  if (_matCarregando) return _matCarregando;
  _matCarregando = idbGuardaComecar("resumos", async () => {
    const txt = await matIdbLoja().ler();
    aoChegar(matObjeto(txt));
    /* sobra de uma migração interrompida entre a marca e a limpeza */
    try { localStorage.removeItem(MAT_CHAVE_LOJA); } catch (e) {}
  }, true).then(() => {
    if (typeof IDB_GUARDA !== "undefined" && IDB_GUARDA.resumos && IDB_GUARDA.resumos.falhou) return;
    /* os consertos de arranque rodaram com a gaveta vazia: rodam de novo, agora com os resumos */
    try { if (typeof matRepararChaves === "function") matRepararChaves(); } catch (e) {}
    try { if (typeof matRepararLacunasTudo === "function") matRepararLacunasTudo(); } catch (e) {}
    try { if (typeof edAvisarMudanca === "function") edAvisarMudanca(""); } catch (e) {}
  });
  return _matCarregando;
}

/* gravar com os resumos no IndexedDB: memória na hora, IndexedDB em segundo plano, em fila (só a mais nova importa) */
function matIdbGravar(txt) {
  _matTextoPendente = txt;
  _matGravando = (_matGravando || Promise.resolve()).then(() => {
    const t0 = _matTextoPendente;
    _matTextoPendente = null;
    return t0 === null ? null : matIdbLoja().gravar(t0);
  }).catch((e) => {
    try { reg("ERRO", "resumos: o IndexedDB recusou gravar", (e && e.message) || "?"); } catch (x) {}
    try { uiAlert(t("mat_sem_espaco")); } catch (x) {}
  });
  return _matGravando;
}

/* a migração única: copia (juntando ao que já houver lá), lê de volta, confere, marca e só então apaga */
function matIdbMigrar() {
  if (_matMigrando) return _matMigrando;
  if (!matIdbSuportado() || matNoIdb()) { _matMigrando = Promise.resolve(false); return _matMigrando; }
  _matMigrando = (async () => {
    let antes = null;
    try { antes = localStorage.getItem(MAT_CHAVE_LOJA); } catch (e) {}
    if (antes == null) return false;
    let idbTxt;
    try { idbTxt = await matIdbLoja().ler(); } catch (e) { return false; }   /* sem saber o que há lá, não grava por cima */
    const doIdb = matObjeto(idbTxt);
    const juntou = Object.keys(doIdb).length > 0;
    const final = juntou ? JSON.stringify(idbJuntarMapas(doIdb, matObjeto(antes))) : antes;
    await matIdbLoja().gravar(final);
    if ((await matIdbLoja().ler()) !== final) return false;   /* a cópia não bate: deixa como está */
    let depois = null;
    try { depois = localStorage.getItem(MAT_CHAVE_LOJA); } catch (e) {}
    if (depois !== antes) return false;                       /* mudou durante a cópia: tenta na próxima abertura */
    if (!idbMarcaPor(MAT_CHAVE_LOJA)) return false;
    try { localStorage.removeItem(MAT_CHAVE_LOJA); } catch (e) {}
    if (juntou) {
      matResumos = matObjeto(final);
      try { if (typeof edAvisarMudanca === "function") edAvisarMudanca(""); } catch (e) {}
    }
    try { reg("ARMAZEN", "resumos migrados para o IndexedDB", (final.length / 1024).toFixed(0) + " KB" + (juntou ? " (juntados ao que já havia lá)" : "")); } catch (e) {}
    return true;
  })().catch((e) => {
    try { reg("ARMAZEN", "migração dos resumos adiada", (e && e.message) || "?"); } catch (x) {}
    return false;
  });
  return _matMigrando;
}

/* o texto dos resumos para o backup (null = moram no IndexedDB e não chegaram: quem chama espera bkEsperarDados) */
function matParaBackup() {
  if (!matNoIdb()) { try { return localStorage.getItem(MAT_CHAVE_LOJA); } catch (e) { return null; } }
  /* sem entrada no guarda = migraram NESTA abertura (estão inteiros na memória); com entrada, só depois de chegarem */
  const g = typeof IDB_GUARDA !== "undefined" ? IDB_GUARDA.resumos : null;
  if (g && (g.esperando || g.falhou)) return null;
  return JSON.stringify(matResumos || {});
}
/* só para teste */
function matIdbEsquecer() { _matMigrando = null; _matCarregando = null; }
