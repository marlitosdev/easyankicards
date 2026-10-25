/* =====================================================================
 * A JANELA DO CARREGAMENTO — guarda comum das gavetas no IndexedDB (v19.19.0)
 *
 * O DEFEITO (reproduzido em teste, tests/idb-janela.js): leis, julgados e decisões moram no IndexedDB, mas ao abrir a
 * página levam alguns milissegundos para chegar; até lá, o cache está vazio e a leitura cai no localStorage, que já
 * não tem nada. Uma gravação nessa janela ("guardar esta lei") ia para o localStorage SÓ com a lei nova — e na
 * abertura seguinte a "migração" achava o localStorage com dados e os copiava por cima do IndexedDB: três leis
 * viraram uma. As questões (v19.18.0) já nasceram protegidas; aqui a mesma proteção vale para as outras gavetas:
 *  · enquanto a leitura de uma gaveta não chegou, GRAVAR NELA É RECUSADO (registro e aviso, uma vez por sessão);
 *  · se a leitura falhou e a marca diz que os dados moram no IndexedDB, continua recusado (melhor não gravar do que
 *    trocar tudo pelo pouco que está na memória);
 *  · quem lê o app inteiro (backup) espera todas chegarem (idbGuardaPronto).
 * ===================================================================== */
const IDB_GUARDA = {};   /* nome -> {esperando, falhou, pronto: Promise} */
let idbGuardaAvisou = false;

/* começa a vigiar uma leitura: "carregar" é a promessa que traz a gaveta do IndexedDB. bloquearSeFalhar: a marca diz
 * que os dados moram lá (sem a marca, uma leitura que falha não tem o que proteger — fica como sempre). */
function idbGuardaComecar(nome, carregar, bloquearSeFalhar) {
  const g = IDB_GUARDA[nome] = { esperando: true, falhou: "", pronto: null };
  g.pronto = Promise.resolve().then(carregar).then(() => { g.esperando = false; }, (e) => {
    g.esperando = false;
    const msg = (e && e.message) || "?";
    try { reg("ERRO", nome + ": não consegui ler do IndexedDB", msg); } catch (x) {}
    if (bloquearSeFalhar) {
      g.falhou = msg;
      try { uiAlert(t("idb_falhou_ler", { g: idbGuardaRotulo(nome), e: msg })); } catch (x) {}
    }
  });
  return g.pronto;
}
function idbGuardaRotulo(nome) {
  const r = typeof t === "function" ? t("idb_gaveta_" + nome) : "";
  return r && r !== "idb_gaveta_" + nome ? r : nome;
}
/* pode gravar? (false = a gaveta ainda está chegando, ou a leitura falhou). silencioso: só registra (o histórico de
 * decisões grava sozinho a toda hora; um aviso por decisão seria barulho) */
function idbGuardaPodeGravar(nome, silencioso) {
  const g = IDB_GUARDA[nome];
  if (!g || (!g.esperando && !g.falhou)) return true;
  try { reg("ERRO", nome + ": gravação recusada — " + (g.falhou ? "a leitura do IndexedDB falhou" : "ainda carregando do IndexedDB"), ""); } catch (x) {}
  if (!silencioso && !idbGuardaAvisou) {
    idbGuardaAvisou = true;
    try { uiAlert(t("idb_ainda_carregando", { g: idbGuardaRotulo(nome) })); } catch (x) {}
  }
  return false;
}
/* todas as gavetas chegaram? (o backup espera por isto) */
function idbGuardaPronto() {
  return Promise.all(Object.keys(IDB_GUARDA).map((k) => IDB_GUARDA[k].pronto)).then(() => idbGuardaPendencias());
}
/* as gavetas que não estão prontas (esperando ou falharam) */
function idbGuardaPendencias() {
  return Object.keys(IDB_GUARDA).filter((k) => IDB_GUARDA[k].esperando || IDB_GUARDA[k].falhou);
}
/* a marca de onde a gaveta mora ("eac_leis_onde" = "idb") */
function idbMarcaTem(chave) { try { return localStorage.getItem(chave + "_onde") === "idb"; } catch (e) { return false; } }
function idbMarcaPor(chave) { try { localStorage.setItem(chave + "_onde", "idb"); return true; } catch (e) { return false; } }
/* JUNTAR em vez de copiar por cima: a sobra no localStorage (de uma gravação na janela, antes desta versão) e o
 * IndexedDB. O mesmo id fica com a versão da sobra (a gravação mais nova); o que só existe no IndexedDB continua.
 * Na dúvida, nada some — no máximo volta algo que tinha sido apagado naquela janela. */
function idbJuntarMapas(doIdb, daSobra) {
  return Object.assign({}, doIdb || {}, daSobra || {});
}
function idbJuntarListas(doIdb, daSobra) {
  const porId = new Map();
  (doIdb || []).forEach((r) => { if (r && r.id) porId.set(r.id, r); });
  (daSobra || []).forEach((r) => { if (r && r.id) porId.set(r.id, r); });
  return [...porId.values()].sort((a, b) => String(a.q || "").localeCompare(String(b.q || "")));
}
