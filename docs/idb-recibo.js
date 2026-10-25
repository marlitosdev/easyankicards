/* =====================================================================
 * O RECIBO DO "SALVAR NO MATERIAL" NO INDEXEDDB (v19.21.0 — Fase 4, terceira fatia)
 *
 * "eac_cm_recibo" é o desfazer da última gravação de cartões no material: a lista inteira das linhas gravadas (no
 * backup de 24/10, 535 cartões — 240 KB). Era a terceira maior gaveta do localStorage. Muda para o IndexedDB, mais
 * simples que as outras porque:
 *  · é SEMPRE gravado inteiro (cada gravação substitui o recibo anterior) — gravar na janela do carregamento não perde
 *    nada; o cuidado é o contrário: a leitura que chega atrasada não pode trocar um recibo NOVO pelo velho;
 *  · só é lido para desfazer, que já é assíncrono (espera cmReciboPronto).
 * Sem IndexedDB (testes, navegador antigo) ou se o IndexedDB recusar, fica no localStorage como sempre. Um recibo no
 * localStorage é sempre o mais novo (depois de migrar, só uma recusa do IndexedDB grava lá): ao abrir, ele vence e
 * muda de casa.
 *
 * O QUE FICA NO localStorage, DE PROPÓSITO: "eac_texto", o texto da bancada. Gravar no localStorage é IMEDIATO — o
 * que foi digitado sobrevive mesmo se a aba fechar no instante seguinte; no IndexedDB a gravação é em segundo plano e
 * a última linha digitada poderia se perder. Para o lugar onde se digita, essa garantia vale mais do que 218 KB.
 * ===================================================================== */
const CM_RECIBO_CHAVE = "eac_cm_recibo";
const CM_RECIBO_IDB = "eac_idb_recibo";
const CM_RECIBO_LOJA = "r";

let cmReciboLojaUsada = null;   /* {ler(): Promise<string|null>, gravar(texto|null): Promise} — trocável nos testes */
let _cmReciboGravando = null;
let _cmReciboPendente;          /* undefined = nada na fila; null = apagar; string = gravar */
let _cmReciboMudou = false;     /* gravaram (ou apagaram) nesta abertura: a leitura atrasada não manda mais */
let _cmReciboCarregando = null;

function cmReciboSuportado() {
  if (cmReciboLojaUsada) return true;
  try { return typeof indexedDB !== "undefined" && indexedDB !== null; } catch (e) { return false; }
}
function cmReciboLojaDefinir(l) { cmReciboLojaUsada = l; }
function cmReciboLoja() {
  if (cmReciboLojaUsada) return cmReciboLojaUsada;
  const abrir = () => new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(CM_RECIBO_IDB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(CM_RECIBO_LOJA)) db.createObjectStore(CM_RECIBO_LOJA); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB do recibo"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado"));
  });
  const tx = (modo, fn) => abrir().then((db) => new Promise((resolve, reject) => {
    const x = db.transaction([CM_RECIBO_LOJA], modo);
    let out;
    const req = fn(x.objectStore(CM_RECIBO_LOJA));
    if (req) {
      req.onsuccess = () => { out = req.result; };
      req.onerror = () => { db.close(); reject(req.error || new Error("erro ao ler o recibo")); };
    }
    x.oncomplete = () => { db.close(); resolve(out); };
    x.onerror = () => { db.close(); reject(x.error || new Error("erro no indexedDB do recibo")); };
    x.onabort = () => { db.close(); reject(x.error || new Error("gravação do recibo abortada (sem espaço?)")); };
  }));
  cmReciboLojaUsada = {
    ler: () => tx("readonly", (l) => l.get("ultimo")).then((v) => (typeof v === "string" ? v : null)),
    gravar: (texto) => tx("readwrite", (l) => { if (texto === null) l.delete("ultimo"); else l.put(String(texto), "ultimo"); return null; }),
  };
  return cmReciboLojaUsada;
}
function cmReciboObjeto(txt) {
  try { const o = JSON.parse(txt || "null"); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch (e) { return null; }
}

/* ao abrir: traz o recibo (o do localStorage, se houver, vence e muda de casa) */
function cmReciboCarregar() {
  if (_cmReciboCarregando) return _cmReciboCarregando;
  if (!cmReciboSuportado()) {
    /* sem IndexedDB: a memória começa com o do localStorage, como sempre */
    try { if (!_cmReciboMudou) cmUltimoRecibo = cmReciboObjeto(localStorage.getItem(CM_RECIBO_CHAVE)); } catch (e) {}
    _cmReciboCarregando = Promise.resolve();
    return _cmReciboCarregando;
  }
  _cmReciboCarregando = idbGuardaComecar("recibo", async () => {
    let doLs = null;
    try { doLs = localStorage.getItem(CM_RECIBO_CHAVE); } catch (e) {}
    if (doLs != null) {
      /* migra: grava, lê de volta e confere — só então apaga daqui */
      await cmReciboLoja().gravar(doLs);
      if ((await cmReciboLoja().ler()) === doLs && localStorage.getItem(CM_RECIBO_CHAVE) === doLs) {
        try { localStorage.removeItem(CM_RECIBO_CHAVE); } catch (e) {}
        try { reg("ARMAZEN", "recibo do 'Salvar no material' migrado para o IndexedDB", (doLs.length / 1024).toFixed(0) + " KB"); } catch (e) {}
      }
      if (!_cmReciboMudou) cmUltimoRecibo = cmReciboObjeto(doLs);
      return;
    }
    const txt = await cmReciboLoja().ler();
    if (!_cmReciboMudou) cmUltimoRecibo = cmReciboObjeto(txt);
  }, false);
  return _cmReciboCarregando;
}
function cmReciboPronto() { return _cmReciboCarregando || cmReciboCarregar(); }

/* grava o recibo novo (memória na hora; IndexedDB em fila; se o IndexedDB recusar, localStorage, como antes) */
function cmReciboGuardar(rec) {
  _cmReciboMudou = true;
  try { cmUltimoRecibo = rec || null; } catch (e) {}
  const txt = rec ? JSON.stringify(rec) : null;
  if (!cmReciboSuportado()) {
    if (txt === null) { try { localStorage.removeItem(CM_RECIBO_CHAVE); } catch (e) {} }
    else { try { guardar(CM_RECIBO_CHAVE, txt); } catch (e) {} }
    return Promise.resolve();
  }
  _cmReciboPendente = txt;
  _cmReciboGravando = (_cmReciboGravando || Promise.resolve()).then(() => {
    if (_cmReciboPendente === undefined) return null;
    const t0 = _cmReciboPendente;
    _cmReciboPendente = undefined;
    return cmReciboLoja().gravar(t0).then(() => {
      /* gravou no IndexedDB: uma cópia antiga no localStorage (de uma recusa anterior) não pode vencer na abertura seguinte */
      try { localStorage.removeItem(CM_RECIBO_CHAVE); } catch (e) {}
    }).catch((e) => {
      try { reg("ERRO", "recibo: o IndexedDB recusou — fica no localStorage", (e && e.message) || "?"); } catch (x) {}
      if (t0 === null) { try { localStorage.removeItem(CM_RECIBO_CHAVE); } catch (x) {} }
      else { try { guardar(CM_RECIBO_CHAVE, t0); } catch (x) {} }
    });
  });
  return _cmReciboGravando;
}
function cmReciboApagar() { return cmReciboGuardar(null); }

/* para o backup: o recibo da memória (o guarda faz o backup esperar a leitura) */
function cmReciboParaBackup() {
  if (!cmReciboSuportado()) { try { return localStorage.getItem(CM_RECIBO_CHAVE); } catch (e) { return null; } }
  try { return cmUltimoRecibo ? JSON.stringify(cmUltimoRecibo) : null; } catch (e) { return null; }
}
/* só para teste */
function cmReciboEsquecer() { _cmReciboCarregando = null; _cmReciboMudou = false; }

/* começa no cmIniciarTela (edital-ui.js), que roda ao abrir o app, depois de todos os scripts */
