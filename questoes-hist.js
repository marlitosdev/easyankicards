/* =====================================================================
 * HISTÓRICO DOS BLOCOS DE QUESTÕES
 *
 * A sessão de questões já era guardada — mas só para poder ser RETOMADA.
 * Terminada, ela desaparecia: o placar era mostrado uma vez, na tela do
 * fim, e depois não havia como responder "quantos blocos eu fiz esta
 * semana?", "como eu fui em Receita Pública da última vez?" ou "quero
 * refazer aquele mesmo recorte".
 *
 * Três decisões que moldam o resto:
 *
 * 1. O BLOCO É REGISTRADO AO COMEÇAR, não ao terminar. Rodada abandonada
 *    no meio é informação — talvez a mais útil de todas, porque diz onde
 *    o estudo emperra. Guardar só o que termina produziria um histórico
 *    que só mostra sucesso.
 *
 * 2. O FILTRO VAI JUNTO, e é o que permite refazer. Sem ele, o item do
 *    histórico é um número solto ("12 de 20, 60%") que não leva a lugar
 *    nenhum. Com ele, "refazer" reconstrói exatamente o mesmo recorte.
 *
 * 3. O CAMINHO DE ENTRADA NÃO MUDA O REGISTRO. Começar pela agenda ou
 *    pela aba de questões produz o mesmo item — só a origem é anotada.
 *    Dois formatos de histórico para o mesmo gesto seriam duas listas
 *    que nunca somam.
 * ===================================================================== */

const QH_CHAVE = "eac_qs_hist";
const QH_MAX = 120;      /* quatro meses de blocos diários */

let qhLista = [];
let qhAtual = null;      /* id do bloco em andamento */

function qhCarregar() {
  try {
    const v = JSON.parse(localStorage.getItem(QH_CHAVE) || "[]");
    qhLista = Array.isArray(v) ? v : [];
  } catch (e) { qhLista = []; }
  return qhLista;
}

function qhGravar(gravar) {
  const txt = JSON.stringify(qhLista);
  if (gravar) { gravar(QH_CHAVE, txt); return; }
  try { localStorage.setItem(QH_CHAVE, txt); } catch (e) {}
}

function qhTodos() { return qhLista; }

function qhNovoId() {
  return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* O RÓTULO DO BLOCO — o que se lê na lista.
 * Um item de histórico que diz "20 questões" não distingue um bloco de
 * Receita Pública de um de Crase. O rótulo tenta, na ordem: o tópico (se
 * o bloco foi de um só), a disciplina, o edital, e por último o número. */
function qhRotulo(lista, filtro) {
  const f = filtro || {};
  const tops = {};
  const discs = {};
  (lista || []).forEach((q) => {
    if (q.topico) tops[q.topico] = 1;
    if (q.disciplina) discs[q.disciplina] = 1;
  });
  const kt = Object.keys(tops);
  const kd = Object.keys(discs);
  if (kt.length === 1) return kt[0];
  if (kd.length === 1) return kd[0] + (kt.length ? " · " + kt.length + " tópicos" : "");
  if (f.editalNome) return f.editalNome;
  return "";
}

/* Abre um bloco. Devolve o id, que a sessão carrega até fechar. */
function qhIniciar(lista, ctx) {
  const c = ctx || {};
  qhCarregar();
  const item = {
    id: qhNovoId(),
    q: new Date().toISOString(),
    fim: "",
    origem: c.origem || "aba",
    escopo: c.escopo || "",
    /* O FILTRO É O QUE PERMITE REFAZER. Guardado como o objeto que a
     * tela usa, para "refazer" não precisar reinterpretar nada. */
    filtro: c.filtro ? JSON.parse(JSON.stringify(c.filtro)) : null,
    rotulo: qhRotulo(lista, c.filtro || {}),
    total: (lista || []).length,
    ids: (lista || []).map((q) => q.id).slice(0, 400),
    feitas: 0, certas: 0, pct: null, minutos: 0,
  };
  qhLista.unshift(item);
  while (qhLista.length > QH_MAX) qhLista.pop();
  qhAtual = item.id;
  qhGravar(c.gravar);
  return item;
}

/* Atualiza o bloco em andamento. Chamado a cada resposta e no fim —
 * assim uma rodada abandonada guarda o que chegou a ser feito, em vez de
 * ficar zerada. */
function qhAtualizar(placar, opc) {
  const o = opc || {};
  if (!qhAtual) return null;
  const item = qhLista.filter((x) => x.id === qhAtual)[0];
  if (!item) return null;
  const p = placar || {};
  item.feitas = Number(p.feitas) || 0;
  item.certas = Number(p.certas) || 0;
  item.pct = item.feitas ? Math.round((item.certas / item.feitas) * 100) : null;
  item.minutos = Math.max(0, Math.round(
    (Date.now() - new Date(item.q).getTime()) / 60000));
  if (o.fechar) { item.fim = new Date().toISOString(); qhAtual = null; }
  qhGravar(o.gravar);
  return item;
}

function qhEmAndamento() {
  if (!qhAtual) return null;
  return qhLista.filter((x) => x.id === qhAtual)[0] || null;
}

/* Blocos de um período, para o resumo ("esta semana: 4 blocos, 71%"). */
function qhResumo(dias) {
  const d = Number(dias) || 7;
  const corte = Date.now() - d * 86400000;
  const meus = qhLista.filter((x) => new Date(x.q).getTime() >= corte);
  const feitas = meus.reduce((a, x) => a + (x.feitas || 0), 0);
  const certas = meus.reduce((a, x) => a + (x.certas || 0), 0);
  return {
    blocos: meus.length,
    feitas, certas,
    pct: feitas ? Math.round((certas / feitas) * 100) : null,
    minutos: meus.reduce((a, x) => a + (x.minutos || 0), 0),
    /* ABANDONADOS TAMBÉM CONTAM, e aparecem separados: é onde o estudo
     * emperra, e um histórico que só mostra o que terminou esconde
     * justamente isso. */
    abandonados: meus.filter((x) => !x.fim && x.feitas < x.total).length,
  };
}

function qhApagar(id, gravar) {
  const antes = qhLista.length;
  qhLista = qhLista.filter((x) => x.id !== id);
  if (qhAtual === id) qhAtual = null;
  qhGravar(gravar);
  return antes - qhLista.length;
}

function qhLimpar(gravar) {
  const n = qhLista.length;
  qhLista = [];
  qhAtual = null;
  qhGravar(gravar);
  return n;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    QH_CHAVE, qhCarregar, qhTodos, qhIniciar, qhAtualizar, qhEmAndamento,
    qhResumo, qhApagar, qhLimpar, qhRotulo,
  };
}
