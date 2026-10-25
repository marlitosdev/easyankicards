/* =====================================================================
 * OS RESUMOS NO INDEXEDDB (v19.20.0 — Fase 4, segunda fatia)
 *
 * O QUE PRECISA SER VERDADE (com o IndexedDB de mentira e recarregamentos simulados):
 *  R1 abrir o app migra sozinho: localStorage → IndexedDB, conferido, marca posta, localStorage limpo;
 *  R2 aberto já migrado, enquanto os resumos não chegam, GRAVAR É RECUSADO (aviso) e nada é escrito; depois de
 *     chegarem, gravar vai ao IndexedDB e a abertura seguinte tem tudo;
 *  R3 os consertos de arranque (chave órfã) rodam de novo quando os resumos chegam;
 *  R4 o IndexedDB já tinha resumos (cópia interrompida) e o localStorage também: junta, nada some;
 *  R5 leitura quebrada: gravar bloqueado e o backup recusa;
 *  R6 backup leva os resumos do IndexedDB; restaurar grava lá; restaurar na janela recusa e desfaz.
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
  const reg = (d, t, texto) => ({ disciplina: d, topico: t, texto: texto || ("Resumo de " + t), cartoes: "Pergunta de " + t + " :: Resposta" });
  const tres = () => JSON.stringify({ "d›a": reg("D", "A"), "d›b": reg("D", "B"), "d›c": reg("D", "C") });
  const noIdb = (idb) => { const v = idb.loja("eac_idb_resumos", "r").get("mapa"); return v ? Object.keys(JSON.parse(v)).sort().join(",") : ""; };
  const nomes = (api) => Object.keys(api.matResumosAtual()).sort().join(",");

  /* ---- R1 + R2 ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_resumos: tres() } });
    await espera();
    ok(noIdb(idb) === "d›a,d›b,d›c" && e1.api.loja.getItem("eac_resumos") === null && e1.api.loja.getItem("eac_resumos_onde") === "idb" && nomes(e1.api) === "d›a,d›b,d›c",
      "R1 abrir migrou: IndexedDB com os 3 tópicos, marca posta, localStorage limpo: " + noIdb(idb));
    const soltar = segurar(idb);
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    await espera(5);
    ok(nomes(e2.api) === "", "R2 aberto já migrado: os resumos ainda estão chegando");
    e2.api.matResumosAtual()["d›pressa"] = reg("D", "Pressa");
    const r = e2.api.matSalvar("d›pressa");
    ok(r === false && /Ainda estou carregando os resumos/.test(aviso(e2.api)) && e2.api.loja.getItem("eac_resumos") === null && noIdb(idb) === "d›a,d›b,d›c",
      "R2b gravar na janela é RECUSADO (aviso) e nada é escrito: " + aviso(e2.api));
    fechar(e2.api);
    ok(e2.api.matParaBackup() === null, "R2c o backup também não lê os resumos pela metade");
    soltar();
    await espera();
    ok(nomes(e2.api) === "d›a,d›b,d›c", "R2d chegaram os 3: " + nomes(e2.api));
    e2.api.matGravar("d›d", "Resumo novo de D", { disciplina: "D", topico: "D" });
    await espera();
    ok(noIdb(idb) === "d›a,d›b,d›c,d›d" && e2.api.loja.getItem("eac_resumos") === null, "R2e depois de chegar, gravar vai ao IndexedDB: " + noIdb(idb));
    const e3 = rodar({ indexedDB: idb, lojaInicial: despejar(e2.api.loja) });
    await espera();
    ok(nomes(e3.api) === "d›a,d›b,d›c,d›d" && /Resumo novo de D/.test(e3.api.matResumosAtual()["d›d"].texto), "R2f a abertura seguinte tem os 4");
    /* matIniciar chama matCarregar DE NOVO depois de chegarem: não pode zerar a memória */
    e3.api.matIniciar();
    await espera();
    ok(nomes(e3.api) === "d›a,d›b,d›c,d›d", "R2g carregar de novo (matIniciar) não zera os resumos que já chegaram: " + nomes(e3.api));
  }

  /* ---- R3: o conserto de chave órfã roda quando os resumos chegam ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_resumos: tres() } });
    await espera();
    /* um tópico gravado com a chave fora da regra (como acontecia antes de matRepararChaves existir) */
    const mapa = JSON.parse(idb.loja("eac_idb_resumos", "r").get("mapa"));
    mapa["chave-orfa"] = reg("Direito", "Tributos");
    const banco = idb.loja("eac_idb_resumos", "r");
    banco.set("mapa", JSON.stringify(mapa));
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    e2.api.matIniciar();
    await espera();
    ok(e2.api.matResumosAtual()["direito›tributos"] && !e2.api.matResumosAtual()["chave-orfa"] && /direito›tributos/.test(noIdb(idb)) && !/chave-orfa/.test(noIdb(idb)),
      "R3 a chave órfã foi consertada quando os resumos chegaram (e gravada no IndexedDB): " + nomes(e2.api));
  }

  /* ---- R4: IndexedDB já tinha, localStorage também: junta ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_resumos: tres() } });
    await espera();
    const loja = despejar(e1.api.loja);
    delete loja.eac_resumos_onde;
    loja.eac_resumos = JSON.stringify({ "d›b": reg("D", "B", "B editado"), "d›e": reg("D", "E") });
    const e2 = rodar({ indexedDB: idb, lojaInicial: loja });
    await espera();
    ok(noIdb(idb) === "d›a,d›b,d›c,d›e" && nomes(e2.api) === "d›a,d›b,d›c,d›e" && /B editado/.test(e2.api.matResumosAtual()["d›b"].texto),
      "R4 junta: nada some, e o mesmo tópico fica com a versão do localStorage: " + nomes(e2.api));
  }

  /* ---- R5: leitura quebrada ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_resumos: tres() } });
    await espera();
    idb.ctl.falharLer = true;
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    await espera();
    ok(/Não consegui ler os resumos/.test(aviso(e2.api)), "R5 leitura quebrada: avisa");
    fechar(e2.api);
    e2.api.matResumosAtual()["d›x"] = reg("D", "X");
    ok(e2.api.matSalvar() === false && noIdb(idb) === "d›a,d›b,d›c", "R5b gravar bloqueado (os 3 no IndexedDB intactos)");
    let e = null;
    try { await e2.api.bkEsperarDados(); } catch (x) { e = x; }
    ok(e && /os resumos/.test(e.message), "R5c o backup recusa: " + (e && e.message));
  }

  /* ---- R6: backup e restauro ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_resumos: tres() } });
    await espera();
    const bk = e1.api.montarBackup();
    ok(bk.resumo.resumos === 3 && JSON.parse(bk.dados.material.eac_resumos)["d›a"], "R6 o backup leva os 3 resumos do IndexedDB");
    bk.dados.material.eac_resumos = JSON.stringify({ "d›z": reg("D", "Z") });
    e1.api.restaurarBackup(bk);
    await e1.api.bkAguardarGravacoes();
    await espera();
    ok(noIdb(idb) === "d›z" && e1.api.loja.getItem("eac_resumos") === null, "R6b restaurar grava os resumos no IndexedDB (não no localStorage)");
    const soltar = segurar(idb);
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    await espera(5);
    e2.api.loja.setItem("eac_texto", "antes :: x");
    const bk2 = e2.api.montarBackup();
    bk2.dados.cartoes.eac_texto = "depois :: x";
    bk2.dados.material.eac_resumos = tres();
    let erro = null;
    try { e2.api.restaurarBackup(bk2); } catch (x) { erro = x; }
    ok(erro && erro.desfeito && e2.api.loja.getItem("eac_texto") === "antes :: x", "R6c restaurar na janela: recusa e o resto volta: " + (erro && erro.message));
    fechar(e2.api);
    soltar();
    await espera();
    ok(nomes(e2.api) === "d›z", "R6d e os resumos do IndexedDB continuam os de antes");
  }

  /* ---- R7: a migração com uma loja controlável (conferência, corrida, leitura quebrada, gravação recusada) ---- */
  {
    const adiado = () => { let res; const p = new Promise((a) => { res = a; }); return { p, res }; };
    const lojaCtl = () => {
      const L = { txt: null, gravacoes: 0, atrasoGravar: null, adulterar: null, falharLer: false, falharGravar: false };
      L.ler = async () => { if (L.falharLer) throw new Error("ler quebrado"); return L.adulterar ? L.adulterar(L.txt) : L.txt; };
      L.gravar = async (t) => { if (L.atrasoGravar) await L.atrasoGravar; if (L.falharGravar) throw new Error("QuotaExceededError"); L.txt = String(t); L.gravacoes++; };
      return L;
    };
    const comLoja = (L) => {
      const { api } = rodar({ lojaInicial: { eac_resumos: tres() } });
      api.matIdbLojaDefinir(L);
      api.matIdbEsquecer();
      return api;
    };
    /* a cópia lida de volta não bate */
    {
      const L = lojaCtl();
      L.adulterar = (t) => (t || "").slice(0, -3);
      const api = comLoja(L);
      api.matCarregar();
      await espera();
      ok(api.loja.getItem("eac_resumos_onde") === null && api.loja.getItem("eac_resumos") === tres(), "R7a a cópia não bate: não migra, nada apagado");
    }
    /* gravaram durante a cópia */
    {
      const L = lojaCtl();
      const g = adiado();
      L.atrasoGravar = g.p;
      const api = comLoja(L);
      api.matCarregar();
      await espera(5);
      api.matGravar("d›novo", "Novo", { disciplina: "D", topico: "Novo" });
      g.res();
      await espera();
      ok(api.loja.getItem("eac_resumos_onde") === null && /d›novo/.test(api.loja.getItem("eac_resumos") || ""), "R7b gravaram durante a cópia: não migra, o localStorage (com o novo) fica");
    }
    /* a leitura do IndexedDB quebrou na migração: não grava por cima */
    {
      const L = lojaCtl();
      L.txt = JSON.stringify({ "d›outro": reg("D", "Outro") });
      L.falharLer = true;
      const api = comLoja(L);
      api.matCarregar();
      await espera();
      ok(L.gravacoes === 0 && api.loja.getItem("eac_resumos") === tres() && /d›outro/.test(L.txt), "R7c leitura do IndexedDB quebrada: não grava por cima, nada apagado");
    }
    /* o IndexedDB recusou gravar: avisa */
    {
      const L = lojaCtl();
      const api = comLoja(L);
      api.matCarregar();
      await espera();
      ok(api.loja.getItem("eac_resumos_onde") === "idb", "R7d migrou (para o próximo caso)");
      L.falharGravar = true;
      api.matGravar("d›f", "F", { disciplina: "D", topico: "F" });
      await espera();
      ok(/Não consegui gravar os resumos/.test(aviso(api)), "R7e o IndexedDB recusou gravar: avisa: " + aviso(api));
      fechar(api);
    }
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["idb_gaveta_resumos", "mat_sem_espaco"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
