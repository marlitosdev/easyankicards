/* =====================================================================
 * UM INDEXEDDB DE MENTIRA, EM MEMÓRIA (v19.19.0)
 *
 * O Node não tem IndexedDB, e por isso as migrações das leis, julgados e decisões nunca rodaram em teste — só o
 * caminho do "cache forçado". Este falso cobre o que os módulos usam (open com versão e upgrade, transaction,
 * objectStore, get/put/delete/clear, openCursor, oncomplete/onerror) e deixa o teste ATRASAR as leituras (para abrir
 * a "janela do carregamento") e QUEBRAR leituras/gravações. O mesmo objeto pode ser passado a vários rodar() seguidos:
 * é o "disco" que sobrevive ao recarregar a página.
 * ===================================================================== */
function criarIdbFalso() {
  const bancos = {};             /* nome -> {versao, lojas: {nome: Map}} */
  const ctl = { atrasoLer: null, falharLer: false, falharGravar: false, aberturas: 0 };
  const tick = (f) => setImmediate(f);
  const req = () => ({ result: undefined, error: null, onsuccess: null, onerror: null });

  function abrirBanco(nome, versao) {
    const r = req();
    r.onupgradeneeded = null; r.onblocked = null;
    tick(() => {
      ctl.aberturas++;
      let b = bancos[nome];
      const novo = !b;
      if (!b) b = bancos[nome] = { versao: 0, lojas: {} };
      const db = {
        get objectStoreNames() { return { contains: (n) => n in b.lojas }; },
        createObjectStore: (n) => { b.lojas[n] = new Map(); return {}; },
        close() {},
        transaction: (lojas, modo) => transacao(b, lojas, modo),
      };
      r.result = db;
      if (novo || (versao || 1) > b.versao) {
        b.versao = versao || 1;
        if (r.onupgradeneeded) r.onupgradeneeded({ target: r });
      }
      if (r.onsuccess) r.onsuccess({ target: r });
    });
    return r;
  }

  function transacao(b, lojas, modo) {
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
    const pendentes = [];
    let falhou = null;
    const escrita = modo === "readwrite";
    /* as mudanças valem só no fim (tudo-ou-nada, como no navegador) */
    const copia = {};
    const lojaDe = (n) => {
      if (!(n in b.lojas)) throw new Error("NotFoundError: " + n);
      if (escrita && !copia[n]) copia[n] = new Map(b.lojas[n]);
      return escrita ? copia[n] : b.lojas[n];
    };
    tx.objectStore = (n) => {
      const L = () => lojaDe(n);
      const pedido = (fn) => { const r = req(); const f = () => { r.result = fn(); if (r.onsuccess) r.onsuccess({ target: r }); }; f.r = r; pendentes.push(f); return r; };
      return {
        get: (k) => pedido(() => { const v = L().get(k); return v === undefined ? undefined : clonar(v); }),
        put: (v, k) => pedido(() => { if (ctl.falharGravar) falhou = new Error("QuotaExceededError"); L().set(k, clonar(v)); return k; }),
        delete: (k) => pedido(() => { L().delete(k); }),
        clear: () => pedido(() => { L().clear(); }),
        openCursor: () => {
          const r = req();
          const f = () => {
            const itens = [...L().entries()];
            let i = 0;
            const passo = () => {
              if (i < itens.length) {
                const [key, value] = itens[i++];
                r.result = { key, value: clonar(value), continue: () => tick(passo) };
              } else r.result = null;
              if (r.onsuccess) r.onsuccess({ target: r });
            };
            passo();
          };
          f.r = r;
          pendentes.push(f);
          return r;
        },
      };
    };
    const ehLeitura = !escrita;
    tick(async () => {
      if (ehLeitura && ctl.atrasoLer) await ctl.atrasoLer;
      if (ehLeitura && ctl.falharLer) {
        /* como no navegador: o erro chega primeiro a CADA pedido (req.onerror), depois à transação */
        tx.error = new Error("leitura quebrada");
        pendentes.splice(0).forEach((f) => { if (f.r) { f.r.error = tx.error; if (f.r.onerror) f.r.onerror({ target: f.r }); } });
        if (tx.onerror) tx.onerror({ target: tx });
        return;
      }
      try { while (pendentes.length) { pendentes.shift()(); await new Promise((r) => tick(r)); } }
      catch (e) { falhou = e; }
      if (falhou) {
        tx.error = falhou;
        if (tx.onabort) tx.onabort({ target: tx });
        else if (tx.onerror) tx.onerror({ target: tx });
        return;
      }
      if (escrita) Object.keys(copia).forEach((n) => { b.lojas[n] = copia[n]; });
      if (tx.oncomplete) tx.oncomplete({ target: tx });
    });
    return tx;
  }

  function clonar(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  return {
    open: abrirBanco,
    deleteDatabase: (n) => { const r = req(); tick(() => { delete bancos[n]; if (r.onsuccess) r.onsuccess({ target: r }); }); return r; },
    ctl,
    /* para o teste espiar o "disco" */
    loja: (banco, loja) => (bancos[banco] && bancos[banco].lojas[loja]) || new Map(),
  };
}

module.exports = { criarIdbFalso };
