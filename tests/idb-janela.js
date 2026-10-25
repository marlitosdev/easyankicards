/* =====================================================================
 * A JANELA DO CARREGAMENTO: LEIS, JULGADOS E DECISÕES (v19.19.0)
 *
 * O DEFEITO (achado ao migrar as questões, reproduzido aqui com um IndexedDB de mentira): depois de migradas, ao abrir
 * a página, as gavetas levam alguns milissegundos para chegar do IndexedDB. Uma gravação nessa janela ia para o
 * localStorage só com o item novo, e na abertura seguinte a "migração" copiava isso por cima: três leis viravam uma.
 *
 * O QUE PRECISA SER VERDADE, para cada gaveta:
 *  W1 a primeira migração continua: localStorage → IndexedDB, com a marca "<chave>_onde";
 *  W2 na janela, gravar é RECUSADO (aviso para leis e julgados; em silêncio para o histórico de decisões) e nada vai
 *     ao localStorage; depois de chegar, gravar funciona e vai ao IndexedDB;
 *  W3 quem já tinha migrado antes desta versão (sem marca) ganha a marca ao abrir;
 *  W4 quem JÁ FOI ATINGIDO (sobra no localStorage + IndexedDB cheio): junta as duas, nada some; mesmo id → a sobra;
 *  W5 a leitura falhou com a marca: gravar continua bloqueado; sem marca (nunca migrou), segue no localStorage;
 *  W6 o backup espera as gavetas; restaurar na janela recusa e desfaz.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const { criarIdbFalso } = require("./idb-falso.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const espera = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= (n || 40) ? r() : setImmediate(f)); f(); });
  const despejar = (L) => { const o = {}; for (let i = 0; i < L.length; i++) { const k = L.key(i); o[k] = L.getItem(k); } return o; };
  const aviso = (api) => (api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "");
  const fechar = (api) => { try { api._uiFechar(true); } catch (e) {} if (api.$("uiModalMsg")) api.$("uiModalMsg").textContent = ""; };
  const segurar = (idb) => { let solta; idb.ctl.atrasoLer = new Promise((r) => { solta = r; }); return () => { solta(); idb.ctl.atrasoLer = null; }; };

  /* cada gaveta: a chave do localStorage, onde mora no IndexedDB, e como ler/acrescentar pelo app */
  const item = (id) => ({ id, q: "2026-10-" + String(10 + id.length).padStart(2, "0") + "T00:00:00Z", titulo: "Item " + id, texto: "Art. 1º" });
  const GAVETAS = [
    { nome: "leis", chave: "eac_leis", banco: "eac_idb", loja: "leis", avisa: true,
      inicial: (ids) => JSON.stringify(Object.fromEntries(ids.map((i) => [i, item(i)]))),
      ids: (api) => Object.keys(api.leisLerTudo()).sort().join(","),
      somar: (api, id) => { const o = api.leisLerTudo(); o[id] = item(id); return api.leisGravarTudo(o); } },
    { nome: "juris", chave: "eac_juris", banco: "eac_idb_juris", loja: "juris", avisa: true,
      inicial: (ids) => JSON.stringify(Object.fromEntries(ids.map((i) => [i, item(i)]))),
      ids: (api) => Object.keys(api.jurLerTudo()).sort().join(","),
      somar: (api, id) => { const o = api.jurLerTudo(); o[id] = item(id); return api.jurGravarTudo(o); } },
    { nome: "decisoes", chave: "eac_decisoes", banco: "eac_idb_decisoes", loja: "decisoes", avisa: false,
      inicial: (ids) => JSON.stringify(ids.map(item)),
      ids: (api) => api.decLer().map((r) => r.id).sort().join(","),
      somar: (api, id) => { const l = api.decLer().slice(); l.push(item(id)); return api.decDefinirTudo(l); } },
  ];
  const noIdb = (idb, G) => [...idb.loja(G.banco, G.loja).keys()].sort().join(",");

  for (const G of GAVETAS) {
    /* W1 + W2 */
    {
      const idb = criarIdbFalso();
      const e1 = rodar({ indexedDB: idb, lojaInicial: { [G.chave]: G.inicial(["a", "b", "c"]) } });
      await espera();
      ok(noIdb(idb, G) === "a,b,c" && e1.api.loja.getItem(G.chave) === null && e1.api.loja.getItem(G.chave + "_onde") === "idb",
        G.nome + " W1 migrou: IndexedDB a,b,c, localStorage limpo, marca posta: " + noIdb(idb, G));
      const soltar = segurar(idb);
      const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
      await espera(5);
      const r = G.somar(e2.api, "d");
      ok(r === false && e2.api.loja.getItem(G.chave) === null, G.nome + " W2 gravar na janela é RECUSADO e nada vai ao localStorage");
      ok(G.avisa ? /Ainda estou carregando/.test(aviso(e2.api)) : !aviso(e2.api), G.nome + " W2b " + (G.avisa ? "avisa" : "em silêncio (só registro)") + ": " + aviso(e2.api));
      fechar(e2.api);
      soltar();
      await espera();
      ok(G.ids(e2.api) === "a,b,c", G.nome + " W2c chegaram as três: " + G.ids(e2.api));
      ok(G.somar(e2.api, "e") !== false, G.nome + " W2d depois de chegar, gravar funciona");
      await espera();
      ok(noIdb(idb, G) === "a,b,c,e" && e2.api.loja.getItem(G.chave) === null, G.nome + " W2e e vai ao IndexedDB: " + noIdb(idb, G));
      /* a abertura seguinte não perde nada (era aqui que as três viravam uma) */
      const e3 = rodar({ indexedDB: idb, lojaInicial: despejar(e2.api.loja) });
      await espera();
      ok(G.ids(e3.api) === "a,b,c,e", G.nome + " W2f a abertura seguinte tem tudo: " + G.ids(e3.api));
    }
    /* W3: migrado por uma versão anterior (sem marca) */
    {
      const idb = criarIdbFalso();
      const e1 = rodar({ indexedDB: idb, lojaInicial: { [G.chave]: G.inicial(["a", "b"]) } });
      await espera();
      const loja = despejar(e1.api.loja);
      delete loja[G.chave + "_onde"];
      const e2 = rodar({ indexedDB: idb, lojaInicial: loja });
      await espera();
      ok(e2.api.loja.getItem(G.chave + "_onde") === "idb" && G.ids(e2.api) === "a,b", G.nome + " W3 migrado antes desta versão: ganha a marca e lê do IndexedDB");
    }
    /* W4: já atingido — sobra no localStorage e IndexedDB cheio */
    {
      const idb = criarIdbFalso();
      const e1 = rodar({ indexedDB: idb, lojaInicial: { [G.chave]: G.inicial(["a", "b", "c"]) } });
      await espera();
      const loja = despejar(e1.api.loja);
      delete loja[G.chave + "_onde"];
      const sobra = JSON.parse(G.inicial(["b", "d"]));
      if (Array.isArray(sobra)) sobra[0].titulo = "B editada"; else sobra.b.titulo = "B editada";
      loja[G.chave] = JSON.stringify(sobra);
      const e2 = rodar({ indexedDB: idb, lojaInicial: loja });
      await espera();
      ok(noIdb(idb, G) === "a,b,c,d" && G.ids(e2.api) === "a,b,c,d" && e2.api.loja.getItem(G.chave) === null,
        G.nome + " W4 sobra (b, d) + IndexedDB (a, b, c): JUNTA tudo, nada some: " + noIdb(idb, G));
      const b = idb.loja(G.banco, G.loja).get("b");
      ok(b && b.titulo === "B editada", G.nome + " W4b mesmo id: fica a versão da sobra (a mais nova)");
    }
    /* W4c: sobra no localStorage e a LEITURA do IndexedDB falha: sem saber o que há lá, não grava por cima */
    {
      const idb = criarIdbFalso();
      const e1 = rodar({ indexedDB: idb, lojaInicial: { [G.chave]: G.inicial(["a", "b", "c"]) } });
      await espera();
      const loja = despejar(e1.api.loja);
      delete loja[G.chave + "_onde"];
      loja[G.chave] = G.inicial(["d"]);
      idb.ctl.falharLer = true;
      const e2 = rodar({ indexedDB: idb, lojaInicial: loja });
      await espera();
      idb.ctl.falharLer = false;
      ok(noIdb(idb, G) === "a,b,c" && e2.api.loja.getItem(G.chave) === G.inicial(["d"]), G.nome + " W4c leitura do IndexedDB falhou: não copia a sobra por cima (a,b,c intactos; a sobra fica para a próxima abertura): " + noIdb(idb, G));
    }
    /* W5: a leitura falhou */
    {
      const idb = criarIdbFalso();
      const e1 = rodar({ indexedDB: idb, lojaInicial: { [G.chave]: G.inicial(["a"]) } });
      await espera();
      idb.ctl.falharLer = true;
      const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
      await espera();
      ok(/Não consegui ler/.test(aviso(e2.api)) && e2.api.idbGuardaPendencias().indexOf(G.nome) >= 0, G.nome + " W5 marca + leitura quebrada: avisa e fica pendente");
      fechar(e2.api);
      ok(G.somar(e2.api, "z") === false && e2.api.loja.getItem(G.chave) === null && noIdb(idb, G) === "a", G.nome + " W5b gravar continua bloqueado (o 'a' no IndexedDB intacto)");
      idb.ctl.falharLer = false;
      /* sem marca e sem nada guardado (nunca usou): a leitura falhar não bloqueia */
      const idb2 = criarIdbFalso();
      idb2.ctl.falharLer = true;
      const e3 = rodar({ indexedDB: idb2 });
      await espera();
      ok(G.somar(e3.api, "n") !== false && e3.api.loja.getItem(G.chave) !== null, G.nome + " W5c sem marca: segue gravando no localStorage, como sempre");
    }
  }

  /* ---- W6: backup e restauro ---- */
  {
    const idb = criarIdbFalso();
    const ini = { eac_leis: GAVETAS[0].inicial(["a", "b"]), eac_juris: GAVETAS[1].inicial(["j1"]), eac_decisoes: GAVETAS[2].inicial(["d1"]) };
    const e1 = rodar({ indexedDB: idb, lojaInicial: ini });
    await espera();
    const soltar = segurar(idb);
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    await espera(5);
    let pronto = false;
    const p = e2.api.bkEsperarDados().then(() => { pronto = true; });
    await espera(5);
    ok(!pronto, "W6 o backup espera as gavetas chegarem");
    /* restaurar na janela: recusa e desfaz */
    e2.api.loja.setItem("eac_texto", "antes :: x");
    const bk = e2.api.montarBackup();
    bk.dados.cartoes.eac_texto = "depois :: x";
    bk.dados.material.eac_leis = GAVETAS[0].inicial(["x"]);
    let erro = null;
    try { e2.api.restaurarBackup(bk); } catch (x) { erro = x; }
    ok(erro && erro.tipo === "gravar" && /eac_juris|eac_leis/.test(erro.chave) && erro.desfeito && e2.api.loja.getItem("eac_texto") === "antes :: x", "W6b restaurar na janela: recusa na primeira gaveta ainda chegando e o resto volta: " + (erro && erro.message));
    fechar(e2.api);
    soltar();
    await p;
    ok(pronto, "W6c chegaram: o backup segue");
    const bk2 = e2.api.montarBackup();
    ok(bk2.resumo.leis === 2 && bk2.resumo.juris === 1, "W6d o backup leva as leis e os julgados do IndexedDB");
    ok(e2.api.restaurarBackup(bk2) > 0, "W6e depois de chegarem, restaurar funciona");
    /* leitura quebrada: o backup recusa (sairia sem as leis) */
    idb.ctl.falharLer = true;
    const e3 = rodar({ indexedDB: idb, lojaInicial: despejar(e2.api.loja) });
    await espera();
    fechar(e3.api);
    let e4 = null;
    try { await e3.api.bkEsperarDados(); } catch (x) { e4 = x; }
    ok(e4 && /ainda não carregaram/.test(e4.message), "W6f leitura quebrada: o backup recusa: " + (e4 && e4.message));
  }

  /* ---- juntar (puro) ---- */
  {
    const { api } = rodar();
    const L = api.idbJuntarListas([{ id: "a", q: "2" }, { id: "b", q: "1" }], [{ id: "a", q: "3", x: 1 }, { id: "c", q: "0" }]);
    ok(L.map((r) => r.id).join() === "c,b,a" && L.find((r) => r.id === "a").x === 1, "J1 listas: junta por id, a sobra vence, em ordem cronológica: " + L.map((r) => r.id).join());
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["idb_gaveta_leis", "idb_gaveta_juris", "idb_gaveta_decisoes", "idb_ainda_carregando", "idb_falhou_ler", "bk_err_gaveta_nao_chegou"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
