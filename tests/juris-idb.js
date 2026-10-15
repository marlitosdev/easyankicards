/* =====================================================================
 * OS JULGADOS NO INDEXEDDB (v18.44.0, JM6)
 *
 * O Node não tem indexedDB: estes testes cobrem o caminho do CACHE (como
 * se a migração já tivesse terminado, via jurCacheForcarTeste) e o que
 * mais importa — o backup e o inventário de armazenamento continuam
 * vendo os julgados depois que eles saem do localStorage. A leitura e a
 * gravação reais no IndexedDB são conferidas no navegador.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  /* D1: sem indexedDB (Node), tudo como antes: localStorage */
  {
    const { api } = rodar();
    ok(api.jurIdbSuportado() === false && api.jurCacheAtual() === null, "D1 no Node não há indexedDB e o cache fica vazio");
    const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: "1", tese: "t1" });
    ok(JSON.parse(api.lojaLer("eac_juris"))[j.id].tese === "t1", "D1a sem migrar, grava no localStorage como sempre");
  }

  /* D2: depois de migrar (cache): lê e grava no cache, não no localStorage; cada leitura é um objeto NOVO */
  {
    const { api } = rodar();
    api.jurGravar({ id: "a", tribunal: "STF", classe: "RE", numero: "1", tese: "antes" });
    api.jurCacheForcarTeste(api.lojaLer("eac_juris"));
    api.lojaGravar("eac_juris", "{}");   /* o que a migração faria: o localStorage não é mais a fonte */
    ok(api.jurDe("a") && api.jurDe("a").tese === "antes", "D2 lê do cache");
    api.jurGravar({ id: "a", tese: "depois" });
    ok(api.jurDe("a").tese === "depois" && JSON.parse(api.jurCacheAtual()).a.tese === "depois" && api.lojaLer("eac_juris") === "{}",
       "D2a grava no cache (e não volta a escrever no localStorage)");
    const x = api.jurLerTudo(); x.a.tese = "mexido só na cópia";
    ok(api.jurDe("a").tese === "depois", "D2b quem mexe no objeto lido não altera o guardado (a leitura continua devolvendo uma cópia)");
    ok(api.jurLista().length === 1 && api.jurDoTopico("x›y").length === 0, "D2c lista e consultas funcionam pelo cache");
    api.jurCacheForcarTeste(null);
  }

  /* D3: o backup leva os julgados mesmo depois de migrar, e a restauração grava pelo caminho certo */
  {
    const { api } = rodar();
    api.jurGravar({ id: "b", tribunal: "STJ", classe: "Súmula", numero: "430", tese: "do backup" });
    api.jurCacheForcarTeste(api.lojaLer("eac_juris"));
    api.lojaGravar("eac_juris", null);
    try { localStorage.removeItem && localStorage.removeItem("eac_juris"); } catch (e) {}
    const bk = api.montarBackup();
    const juris = JSON.parse((bk.dados.edital || {}).eac_juris || "{}");
    ok(juris.b && juris.b.tese === "do backup", "D3 o backup feito depois da migração ainda tem os julgados: " + JSON.stringify(Object.keys(juris)));
    ok(api.resumirBackup(bk.dados).juris === 1, "D3a o resumo do backup conta 1 julgado");
    /* restaurar com o cache ativo: vai para o cache (não ressuscita a chave no localStorage) */
    const bk2 = JSON.parse(JSON.stringify(bk));
    bk2.dados.edital.eac_juris = JSON.stringify({ c: { id: "c", tribunal: "STF", classe: "ADI", numero: "2", tese: "restaurado", topicos: [] } });
    api.restaurarBackup(bk2);
    ok(api.jurDe("c") && api.jurDe("c").tese === "restaurado" && !api.jurDe("b"), "D3b restaurar troca os julgados pelos do arquivo (pelo cache)");
    api.jurCacheForcarTeste(null);
  }

  /* D4: o inventário de armazenamento mede os julgados onde estiverem */
  {
    const { api } = rodar();
    api.jurGravar({ id: "d", tribunal: "STF", classe: "RE", numero: "9", tese: "x".repeat(500) });
    const n1 = api.plBytesJuris();
    api.jurCacheForcarTeste(api.lojaLer("eac_juris"));
    try { localStorage.removeItem && localStorage.removeItem("eac_juris"); } catch (e) {}
    api.lojaGravar("eac_juris", null);
    const n2 = api.plBytesJuris();
    ok(n1 > 1000 && n2 > 1000, "D4 o tamanho dos julgados continua medido depois de migrar (não vira 0): " + n1 + " / " + n2);
    const lj = api.plArmazenamento().linhas.find((x) => x.chave === "eac_juris");
    ok(lj && lj.bytes > 1000 && lj.i18n === "plog_g_juris", "D4a o painel Armazenamento tem a linha dos julgados, medida depois de migrar: " + JSON.stringify(lj));
    api.jurCacheForcarTeste(null);
  }

  /* D5: carregamento: o módulo vem antes de juris.js (no HTML, no service worker e nos testes) */
  {
    const raiz = path.join(__dirname, "..", "docs");
    const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(raiz, "sw.js"), "utf8");
    ok(html.indexOf('<script src="idb-juris.js"></script>') > 0 && html.indexOf('<script src="idb-juris.js"></script>') < html.indexOf('<script src="juris.js'), "D5 index.html carrega idb-juris.js antes de juris.js");
    ok(sw.indexOf('"idb-juris.js"') > 0 && sw.indexOf('"idb-juris.js"') < sw.indexOf('"juris.js"'), "D5a o service worker guarda idb-juris.js (o app funciona sem internet)");
    const { api } = rodar();
    ok(api.t("plog_g_juris") !== "plog_g_juris" && api.t("jur_sem_espaco") !== "jur_sem_espaco", "D5b os textos novos existem");
  }
  return falhas;
}

module.exports = { testes };
