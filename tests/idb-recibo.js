/* =====================================================================
 * O RECIBO DO "SALVAR NO MATERIAL" NO INDEXEDDB (v19.21.0 — Fase 4, terceira fatia)
 *
 * O QUE PRECISA SER VERDADE:
 *  C1 o recibo que está no localStorage muda de casa ao abrir (conferido) e continua servindo para desfazer;
 *  C2 numa abertura seguinte, desfazer acha o recibo no IndexedDB e tira as linhas do material;
 *  C3 a leitura atrasada não troca um recibo NOVO (gravado na janela) pelo velho;
 *  C4 o IndexedDB recusou gravar: fica no localStorage (como antes) e, ao abrir, vence e muda de casa;
 *  C5 backup leva o recibo do IndexedDB; restaurar grava lá (e "nenhum recibo" apaga);
 *  C6 sem IndexedDB, tudo como sempre (localStorage).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const { criarIdbFalso } = require("./idb-falso.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const espera = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= (n || 40) ? r() : setImmediate(f)); f(); });
  const despejar = (L) => { const o = {}; for (let i = 0; i < L.length; i++) { const k = L.key(i); o[k] = L.getItem(k); } return o; };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 80 && !pronto; i++) { await new Promise((r) => setImmediate(r)); try { api._uiFechar(true); } catch (e) {} }
    return promessa;
  };
  const CH = "d›t";
  const recibo = (n, rot) => ({ novos: n, repetidos: 0, topicos: 1, concurso: "", quando: "2026-10-25T10:00:00Z",
    recibo: [{ chave: CH, disciplina: "D", topico: "T", linhas: Array.from({ length: n }, (_, i) => (rot || "P") + i + " :: R" + i) }] });
  const noIdb = (idb) => { const v = idb.loja("eac_idb_recibo", "r").get("ultimo"); return v ? JSON.parse(v) : null; };
  /* o material com as linhas do recibo, para o desfazer ter o que tirar */
  const comMaterial = (n, rot) => JSON.stringify({ [CH]: { disciplina: "D", topico: "T", texto: "", cartoes: Array.from({ length: n }, (_, i) => (rot || "P") + i + " :: R" + i).join("\n") } });

  /* ---- C1 + C2 ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_cm_recibo: JSON.stringify(recibo(3)), eac_resumos: comMaterial(3) } });
    e1.api.cmReciboCarregar();
    await espera();
    ok(e1.api.loja.getItem("eac_cm_recibo") === null && noIdb(idb) && noIdb(idb).novos === 3 && e1.api.cmReciboAtual() && e1.api.cmReciboAtual().novos === 3,
      "C1 o recibo do localStorage mudou para o IndexedDB (conferido) e está na memória");
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    e2.api.cmReciboCarregar();
    await espera();
    ok(e2.api.cmReciboAtual() && e2.api.cmReciboAtual().novos === 3, "C2 na abertura seguinte, o recibo chega do IndexedDB");
    await conduzir(e2.api, e2.api.cmDesfazerUltimo());
    await espera();
    const mat = e2.api.matResumosAtual()[CH];
    ok(!mat || !String(mat.cartoes || "").trim(), "C2b desfazer tirou as 3 linhas do material");
    ok(!noIdb(idb) && !e2.api.cmReciboAtual() && e2.api.loja.getItem("eac_cm_recibo") === null, "C2c e o recibo foi apagado (IndexedDB e memória)");
  }

  /* ---- C3: a leitura atrasada não manda ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_cm_recibo: JSON.stringify(recibo(2, "Velho")) } });
    e1.api.cmReciboCarregar();
    await espera();
    let solta;
    idb.ctl.atrasoLer = new Promise((r) => { solta = r; });
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    e2.api.cmReciboCarregar();
    await espera(5);
    e2.api.cmReciboGuardar(recibo(5, "Novo"));
    await espera();
    solta(); idb.ctl.atrasoLer = null;
    await espera();
    ok(e2.api.cmReciboAtual().novos === 5 && noIdb(idb).novos === 5, "C3 gravaram um recibo novo na janela: a leitura atrasada (do velho) não o troca");
  }

  /* ---- C4: o IndexedDB recusou ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb });
    e1.api.cmReciboCarregar();
    await espera();
    idb.ctl.falharGravar = true;
    e1.api.cmReciboGuardar(recibo(4));
    await espera();
    idb.ctl.falharGravar = false;
    ok(JSON.parse(e1.api.loja.getItem("eac_cm_recibo") || "null").novos === 4, "C4 o IndexedDB recusou: o recibo fica no localStorage (como antes)");
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    e2.api.cmReciboCarregar();
    await espera();
    ok(e2.api.cmReciboAtual().novos === 4 && noIdb(idb).novos === 4 && e2.api.loja.getItem("eac_cm_recibo") === null, "C4b ao abrir, o do localStorage vence e muda de casa");
  }

  /* ---- C5: backup e restauro ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_cm_recibo: JSON.stringify(recibo(6)) } });
    e1.api.cmReciboCarregar();
    await espera();
    await e1.api.bkEsperarDados();
    const bk = e1.api.montarBackup();
    ok(JSON.parse(bk.dados.edital.eac_cm_recibo).novos === 6, "C5 o backup leva o recibo do IndexedDB");
    bk.dados.edital.eac_cm_recibo = JSON.stringify(recibo(1, "Restaurado"));
    e1.api.restaurarBackup(bk);
    await e1.api.bkAguardarGravacoes();
    await espera();
    ok(noIdb(idb).novos === 1 && e1.api.loja.getItem("eac_cm_recibo") === null, "C5b restaurar grava o recibo no IndexedDB");
    bk.dados.edital.eac_cm_recibo = "null";
    e1.api.restaurarBackup(bk);
    await espera();
    ok(!noIdb(idb) && !e1.api.cmReciboAtual(), "C5c restaurar uma base sem recibo apaga o recibo");
  }

  /* ---- C3b: a leitura atrasada também não manda durante a MIGRAÇÃO do localStorage ---- */
  {
    const idb = criarIdbFalso();
    let solta;
    idb.ctl.atrasoLer = new Promise((r) => { solta = r; });
    const e = rodar({ indexedDB: idb, lojaInicial: { eac_cm_recibo: JSON.stringify(recibo(2, "Velho")) } });
    e.api.cmReciboCarregar();
    await espera(5);
    e.api.cmReciboGuardar(recibo(7, "Novo"));
    await espera(5);
    solta(); idb.ctl.atrasoLer = null;
    await espera();
    ok(e.api.cmReciboAtual().novos === 7 && noIdb(idb).novos === 7 && e.api.loja.getItem("eac_cm_recibo") === null,
      "C3b gravaram um recibo novo enquanto o velho migrava: fica o novo (memória e IndexedDB)");
  }

  /* ---- C4c: uma cópia velha no localStorage (de uma recusa) não vence um recibo gravado depois no IndexedDB ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb });
    e1.api.cmReciboCarregar();
    await espera();
    idb.ctl.falharGravar = true;
    e1.api.cmReciboGuardar(recibo(2, "A"));
    await espera();
    idb.ctl.falharGravar = false;
    e1.api.cmReciboGuardar(recibo(9, "B"));
    await espera();
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    e2.api.cmReciboCarregar();
    await espera();
    ok(e2.api.cmReciboAtual().novos === 9, "C4c a cópia velha do localStorage (A) não vence o recibo gravado depois no IndexedDB (B)");
  }

  /* ---- C2d: desfazer chamado ANTES de o recibo chegar espera por ele ---- */
  {
    const idb = criarIdbFalso();
    const e1 = rodar({ indexedDB: idb, lojaInicial: { eac_cm_recibo: JSON.stringify(recibo(3)), eac_resumos: comMaterial(3) } });
    e1.api.cmReciboCarregar();
    await espera();
    let solta;
    idb.ctl.atrasoLer = new Promise((r) => { solta = r; });
    const e2 = rodar({ indexedDB: idb, lojaInicial: despejar(e1.api.loja) });
    e2.api.cmReciboCarregar();
    const desf = e2.api.cmDesfazerUltimo();
    await espera(5);
    solta(); idb.ctl.atrasoLer = null;
    await conduzir(e2.api, desf);
    await espera();
    const mat = e2.api.matResumosAtual()[CH];
    ok(!mat || !String(mat.cartoes || "").trim(), "C2d desfazer antes de o recibo chegar: espera e desfaz (não diz 'nada a desfazer')");
  }

  /* ---- C7: a cópia lida de volta não bate: não apaga o localStorage ---- */
  {
    const e = rodar({ lojaInicial: { eac_cm_recibo: JSON.stringify(recibo(3)) } });
    let guardado = null;
    e.api.cmReciboLojaDefinir({ ler: async () => (guardado ? guardado.slice(0, -2) : null), gravar: async (t) => { guardado = t; } });
    e.api.cmReciboEsquecer();
    e.api.cmReciboCarregar();
    await espera();
    ok(e.api.loja.getItem("eac_cm_recibo") !== null, "C7 a cópia no IndexedDB não bate: o recibo continua no localStorage");
  }

  /* ---- C6: sem IndexedDB ---- */
  {
    const { api } = rodar({ lojaInicial: { eac_resumos: comMaterial(2) } });
    api.cmReciboCarregar();
    api.cmReciboGuardar(recibo(2));
    ok(JSON.parse(api.loja.getItem("eac_cm_recibo")).novos === 2, "C6 sem IndexedDB: o recibo vai ao localStorage, como sempre");
    ok(JSON.parse(api.cmReciboParaBackup()).novos === 2, "C6b e o backup o lê de lá");
  }
  return falhas;
}

module.exports = { testes };
