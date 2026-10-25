/* =====================================================================
 * AS QUESTÕES NO INDEXEDDB (v19.18.0 — Fase 4 do plano de backup, primeira fatia)
 *
 * O QUE PRECISA SER VERDADE:
 *  F  gravar no localStorage não falha mais calado (sem espaço → registro e aviso);
 *  M  a migração copia, CONFERE, põe a marca e só então apaga o localStorage; se o localStorage mudou durante a cópia,
 *     ou a cópia não bate, não migra (tenta na próxima abertura);
 *  J  A JANELA DO CARREGAMENTO: aberto já migrado, enquanto as questões não chegaram, gravar é RECUSADO — nada vai
 *     para o localStorage nem para o IndexedDB (no padrão antigo, essa gravação trocava as 595 questões por uma);
 *  L  ler falhou: gravar continua recusado;
 *  G  gravações em fila, na ordem; IndexedDB recusou → aviso;
 *  B  backup, cópia de antes, automático e restauro leem/gravam as questões de onde elas estiverem, esperando-as chegar.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const espera = () => new Promise((r) => setImmediate(r));
  const adiado = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
  const lojaIdb = () => {
    const L = { txt: null, gravacoes: [], atrasoLer: null, atrasoGravar: null, falharLer: false, falharGravar: false, adulterar: null };
    L.ler = async () => { if (L.atrasoLer) await L.atrasoLer; if (L.falharLer) throw new Error("idb quebrado"); return L.adulterar ? L.adulterar(L.txt) : L.txt; };
    L.gravar = async (t) => { if (L.atrasoGravar) await L.atrasoGravar; if (L.falharGravar) throw new Error("QuotaExceededError"); L.txt = String(t); L.gravacoes.push(String(t)); };
    return L;
  };
  const QS = (n, pre) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: (pre || "q") + i, chave: "d›t", enunciado: "Questão " + i })));
  const avisos = (api) => (api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "");
  const fechar = (api) => { try { api._uiFechar(true); } catch (e) {} if (api.$("uiModalMsg")) api.$("uiModalMsg").textContent = ""; };

  /* ---- F: sem IndexedDB, como sempre; mas a falha de gravar avisa ---- */
  {
    const { api } = rodar();
    const L = api.loja;
    L.setItem("eac_questoes", QS(3));
    api.qsCarregar();
    ok(api.qsTodas().length === 3 && !api.qsIdbEstado().noIdb, "F0 sem IndexedDB: as questões ficam no localStorage, como sempre");
    const orig = L.setItem.bind(L);
    L.setItem = (k, v) => { if (k === "eac_questoes") { const x = new Error("cota"); x.name = "QuotaExceededError"; throw x; } return orig(k, v); };
    api.qsTodas().push({ id: "nova", chave: "d›t" });
    const r = api.qsSalvar();
    L.setItem = orig;
    ok(r === false && /Não consegui gravar as questões/.test(avisos(api)), "F1 sem espaço: avisa (antes era um catch vazio): " + avisos(api));
    fechar(api);
  }

  /* ---- M: a migração ---- */
  {
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes", QS(5));
    api.qsCarregar();
    /* abrir o app basta: qsCarregar começa a migração sozinho (ninguém chama qsIdbMigrar) */
    for (let i = 0; i < 20 && L.getItem("eac_questoes_onde") !== "idb"; i++) await espera();
    ok(L.getItem("eac_questoes_onde") === "idb", "M1 abrir o app (qsCarregar) migrou sozinho");
    ok(I.txt === QS(5) && L.getItem("eac_questoes_onde") === "idb" && L.getItem("eac_questoes") === null, "M2 o IndexedDB tem as 5, a marca está posta e o localStorage foi limpo");
    ok(api.qsTodas().length === 5, "M3 a memória continua com as 5");
    /* depois de migrar, gravar vai ao IndexedDB e não volta ao localStorage */
    api.qsTodas().push({ id: "q-nova", chave: "d›t" });
    api.qsSalvar();
    await api.qsGravandoAtual();
    ok(JSON.parse(I.txt).length === 6 && L.getItem("eac_questoes") === null, "M4 gravar depois de migrar: IndexedDB com 6; nada no localStorage");
  }
  {
    /* mudou durante a cópia: não migra */
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    const g = adiado();
    I.atrasoGravar = g.p;
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes", QS(5));
    api.qsCarregar();
    const p = api.qsIdbMigrar();
    await espera();
    api.qsTodas().push({ id: "durante", chave: "d›t" });
    api.qsSalvar();
    g.res();
    ok(await p === false && L.getItem("eac_questoes_onde") === null && JSON.parse(L.getItem("eac_questoes")).length === 6, "M5 gravou durante a cópia: não migra, o localStorage (com 6) fica");
  }
  {
    /* a cópia lida de volta não bate: não migra */
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    I.adulterar = (t) => (t || "").slice(0, -5);
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes", QS(5));
    api.qsCarregar();
    ok(await api.qsIdbMigrar() === false && L.getItem("eac_questoes_onde") === null && L.getItem("eac_questoes") === QS(5), "M6 a cópia não bate: não migra, nada apagado");
  }

  /* ---- J: a janela do carregamento ---- */
  {
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    I.txt = QS(595);
    const lerDev = adiado();
    I.atrasoLer = lerDev.p;
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes_onde", "idb");
    L.setItem("eac_questoes", QS(2, "velha"));   /* sobra de migração interrompida */
    api.qsCarregar();
    ok(api.qsTodas().length === 0 && api.qsIdbEstado().esperando, "J1 aberto já migrado: as questões ainda estão chegando");
    /* alguém grava nesta janela (o padrão antigo escreveria [1 questão] no localStorage) */
    api.qsTodas().push({ id: "pressa", chave: "d›t" });
    const r = api.qsSalvar();
    ok(r === false && I.gravacoes.length === 0 && L.getItem("eac_questoes") === QS(2, "velha") && /ainda estão carregando/.test(avisos(api)),
      "J2 gravar na janela é RECUSADO: nada vai ao IndexedDB nem ao localStorage, e avisa");
    fechar(api);
    ok(api.qsParaBackup() === null, "J3 o backup também não lê as questões pela metade");
    let bkErro = null;
    const espBk = api.bkEsperarDados().catch((e) => { bkErro = e; });
    lerDev.res();
    await espBk;
    await espera();
    ok(api.qsTodas().length === 595 && !api.qsIdbEstado().esperando && !bkErro, "J4 chegaram as 595 (e quem esperava para o backup seguiu)");
    ok(L.getItem("eac_questoes") === null, "J5 a sobra no localStorage foi limpa");
    ok(JSON.parse(api.qsParaBackup()).length === 595, "J6 o backup vê as 595");
    api.qsTodas().push({ id: "agora", chave: "d›t" });
    api.qsAvisouFalhaZerar();
    ok(api.qsSalvar() === true, "J7 depois de chegarem, gravar funciona");
    await api.qsGravandoAtual();
    ok(JSON.parse(I.txt).length === 596, "J8 e o IndexedDB fica com 596 (não com 1)");
  }

  /* ---- L: ler falhou ---- */
  {
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    I.txt = QS(10);
    I.falharLer = true;
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes_onde", "idb");
    api.qsCarregar();
    await api.qsPronto();
    await espera();
    ok(api.qsIdbEstado().falhou && /Não consegui ler as questões/.test(avisos(api)), "L1 ler falhou: avisa");
    fechar(api);
    api.qsTodas().push({ id: "x", chave: "d›t" });
    ok(api.qsSalvar() === false && I.txt === QS(10), "L2 e gravar continua recusado (as 10 no IndexedDB intactas)");
    let e = null;
    try { await api.bkEsperarDados(); } catch (x) { e = x; }
    ok(e && /ainda não carregaram/.test(e.message), "L3 o backup recusa (sairia sem as questões)");
    const fim = api.bkBaixar();
    for (let i = 0; i < 20; i++) { await espera(); if (/Não consegui montar o backup/.test(avisos(api))) break; }
    ok(/Não consegui montar o backup/.test(avisos(api)), "L4 'Baixar' avisa em vez de baixar um backup sem questões: " + avisos(api));
    fechar(api);
    await fim;
  }

  /* ---- G: fila e falha de gravar ---- */
  {
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    I.txt = QS(1);
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes_onde", "idb");
    api.qsCarregar();
    await api.qsPronto();
    const g = adiado();
    I.atrasoGravar = g.p;
    api.qsBancoForcar(JSON.parse(QS(2)));
    api.qsSalvar();
    api.qsBancoForcar(JSON.parse(QS(3)));
    api.qsSalvar();
    api.qsBancoForcar(JSON.parse(QS(4)));
    api.qsSalvar();
    g.res();
    await api.qsGravandoAtual();
    await espera(); await espera();
    await api.qsGravandoAtual();
    ok(JSON.parse(I.txt).length === 4 && I.gravacoes.length <= 2, "G1 três gravações seguidas: fica a mais nova (4), sem gravar três vezes: " + I.gravacoes.map((x) => JSON.parse(x).length).join(","));
    I.atrasoGravar = null;
    I.falharGravar = true;
    api.qsBancoForcar(JSON.parse(QS(5)));
    api.qsSalvar();
    await api.qsGravandoAtual();
    ok(/Não consegui gravar as questões/.test(avisos(api)), "G2 o IndexedDB recusou: avisa");
    fechar(api);
    ok(await api.bkAguardarGravacoes() >= 1, "G3 bkAguardarGravacoes espera a gravação das questões");
  }

  /* ---- B: backup e restauro com as questões no IndexedDB ---- */
  {
    const { api } = rodar();
    const L = api.loja;
    const I = lojaIdb();
    I.txt = QS(7);
    api.qsIdbLojaDefinir(I);
    L.setItem("eac_questoes_onde", "idb");
    api.qsCarregar();
    await api.qsPronto();
    const bk = api.montarBackup();
    ok(JSON.parse(bk.dados.material.eac_questoes).length === 7 && bk.resumo.questoes === 7, "B1 o backup leva as 7 questões do IndexedDB (e a conferência as conta)");
    /* restaurar uma base com 3 questões */
    bk.dados.material.eac_questoes = QS(3, "r");
    api.restaurarBackup(bk);
    await api.qsGravandoAtual();
    ok(api.qsTodas().length === 3 && JSON.parse(I.txt).length === 3 && L.getItem("eac_questoes") === null, "B2 restaurar grava as questões no IndexedDB (não no localStorage)");
    /* restaurar enquanto as questões não chegaram: tudo-ou-nada recusa e desfaz */
    api.qsIdbEsquecer();
    const lerDev = adiado();
    I.atrasoLer = lerDev.p;
    api.qsCarregar();
    L.setItem("eac_texto", "antes :: x");
    const bk2 = api.montarBackup();
    bk2.dados.cartoes.eac_texto = "depois :: x";
    bk2.dados.material.eac_questoes = QS(9);
    let e = null;
    try { api.restaurarBackup(bk2); } catch (x) { e = x; }
    ok(e && e.chave === "eac_questoes" && L.getItem("eac_texto") === "antes :: x", "B3 restaurar com as questões chegando: recusa e o resto volta ao que era");
    lerDev.res();
    await api.qsPronto();
    ok(api.qsTodas().length === 3, "B4 e as questões do IndexedDB continuam as de antes");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["bk_erro_montar", "bk_err_qs_nao_chegou", "qs_sem_espaco", "qs_ainda_carregando", "qs_idb_falhou"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
