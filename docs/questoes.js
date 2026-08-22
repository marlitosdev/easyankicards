/* =====================================================================
 * QUESTÕES — arquivo próprio
 *
 * Por que arquivo próprio, e não dentro da gaveta do tópico como o resumo,
 * os cartões e a lei seca: uma questão de "Princípios orçamentários" da FGV
 * serve para o TCE-PE e serve para o ISS Caruaru. Presa ao tópico de um
 * edital, ela teria de ser duplicada a cada concurso novo — e duplicata é
 * onde o estudo começa a mentir sobre o quanto foi feito.
 *
 * Cada questão guarda a CHAVE do tópico (disciplina›tópico, a mesma regra de
 * endereçamento do material), então continua sendo possível perguntar "as
 * questões deste resumo" sem que ela pertença ao resumo.
 *
 * FORMATO CANÔNICO (o que a IA devolve e o que o app lê)
 *
 *   ? CE :: FGV :: Enunciado da afirmação a julgar
 *   = C :: Comentário explicando por que está certa
 *
 *   ? ME :: Cebraspe :: Enunciado da pergunta
 *   A) primeira opção
 *   B) segunda opção
 *   C) terceira opção
 *   = B :: Comentário explicando a resposta
 *
 * CE = certo/errado (gabarito "C" ou "E").
 * ME = múltipla escolha (gabarito é a letra).
 * A banca é opcional: deixar vazio é resposta honesta, inventar não é.
 * ===================================================================== */

const QS_CHAVE_LOJA = "eac_questoes";
const QS_TIPOS = ["ce", "me"];
let qsBanco = [];

function qsNormal(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function qsCarregar(lerLoja) {
  let cru = null;
  if (lerLoja) cru = lerLoja(QS_CHAVE_LOJA);
  else { try { cru = localStorage.getItem(QS_CHAVE_LOJA); } catch (e) { cru = null; } }
  try {
    const v = JSON.parse(cru || "[]");
    qsBanco = Array.isArray(v) ? v : [];
  } catch (e) { qsBanco = []; }
  return qsBanco;
}

function qsSalvar(gravar) {
  const txt = JSON.stringify(qsBanco);
  if (gravar) { gravar(QS_CHAVE_LOJA, txt); return; }
  try { localStorage.setItem(QS_CHAVE_LOJA, txt); } catch (e) {}
}

function qsTodas() { return qsBanco; }

let qsSeq = 0;
function qsNovoId() {
  qsSeq++;
  return "q" + Date.now().toString(36) + qsSeq.toString(36);
}

/* ---------------------------------------------------------------------
 * O PROMPT
 *
 * O trabalho da IA é TRANSFORMAR o que já está no resumo, não inventar
 * matéria nova: um texto que já é questão vira questão respondível; um
 * texto corrido vira questões sobre o que ele afirma. O que ele não diz,
 * a IA não deve supor.
 * ------------------------------------------------------------------- */
function qsPrompt(texto, ctx) {
  const c = ctx || {};
  return t("qs_prompt", {
    disciplina: c.disciplina || "?",
    topico: c.topico || "?",
    concurso: c.concurso || "?",
    texto: String(texto || "").slice(0, 12000),
  });
}

/* ---------------------------------------------------------------------
 * LER A RESPOSTA
 *
 * Tolerante na entrada, rígido na saída — a mesma postura do leitor de
 * cartões. O que não der para entender vai para "ignoradas" COM o motivo,
 * em vez de virar uma questão pela metade que só aparece meses depois, no
 * meio de um simulado, quando não dá mais para saber o que se perdeu.
 * ------------------------------------------------------------------- */
function qsLerResposta(txt, ctx) {
  const c = ctx || {};
  const achados = [];
  const ignoradas = [];
  const linhas = String(txt || "").split("\n");
  let atual = null;

  const fechar = () => {
    if (!atual) return;
    /* O CONTEÚDO MANDA, NÃO O RÓTULO.
     * A IA às vezes escreve "? CE" e entrega opções A/B/C. Se a correção
     * viesse depois da conferência, uma questão perfeitamente boa era
     * recusada por "gabarito não é C nem E" — jogando fora o trabalho por
     * causa de uma etiqueta. */
    if (atual.tipo === "ce" && atual.opcoes.length >= 2) atual.tipo = "me";
    if (atual.tipo === "me" && !atual.opcoes.length) atual.tipo = "ce";
    const problemas = [];
    if (!atual.enunciado) problemas.push("sem_enunciado");
    if (!atual.gabarito) problemas.push("sem_gabarito");
    if (atual.tipo === "me") {
      if (atual.opcoes.length < 2) problemas.push("poucas_opcoes");
      else if (!atual.opcoes.some((o) => o.letra === atual.gabarito)) {
        problemas.push("gabarito_fora_das_opcoes");
      }
    }
    if (atual.tipo === "ce" && atual.gabarito
        && atual.gabarito !== "C" && atual.gabarito !== "E") {
      problemas.push("gabarito_nao_e_C_nem_E");
    }
    delete atual._lendoComentario;
    if (problemas.length) {
      ignoradas.push({ linha: atual.linha,
                       txt: String(atual.enunciado || "").slice(0, 70),
                       motivo: problemas.join("+") });
    } else {
      achados.push(atual);
    }
    atual = null;
  };

  linhas.forEach((l0, li) => {
    const l = l0.trim();
    /* linha em branco ENCERRA o comentário. Sem isso, a despedida da IA
     * ("Espero ter ajudado!") virava parte do gabarito comentado — o mesmo
     * defeito que os cartões já tiveram com o prompt vazando para dentro
     * do cartão. */
    if (!l) { if (atual) atual._lendoComentario = false; return; }
    if (/^-{3,}$/.test(l)) { if (atual) atual._lendoComentario = false; return; }

    if (/^\?/.test(l)) {
      fechar();
      const p = l.replace(/^\?\s*/, "").split("::").map((x) => x.trim());
      const tipo = qsNormal(p[0]).replace(/[^a-z]/g, "");
      let banca = "", enunciado = "";
      /* "? CE :: banca :: enunciado", mas a banca pode faltar e aí são dois
       * campos. Contar as partes é mais gentil do que exigir um "::" vazio
       * de quem escreve à mão. */
      if (p.length >= 3) { banca = p[1]; enunciado = p.slice(2).join(" :: "); }
      else { enunciado = p.slice(1).join(" :: "); }
      atual = {
        id: qsNovoId(),
        tipo: QS_TIPOS.indexOf(tipo) >= 0 ? tipo : "me",
        enunciado: enunciado.trim(),
        opcoes: [], gabarito: "", comentario: "",
        banca: banca.trim(),
        disciplina: c.disciplina || "", topico: c.topico || "",
        chave: c.chave || "", concurso: c.concurso || "",
        origem: "prompt", linha: li + 1,
      };
      return;
    }

    const mo = l.match(/^([A-Ea-e])\s*[).\-]\s+(.+)$/);
    if (mo && atual && !atual.gabarito) {
      atual.opcoes.push({ letra: mo[1].toUpperCase(), txt: mo[2].trim() });
      return;
    }

    if (/^=/.test(l) && atual) {
      const p = l.replace(/^=\s*/, "").split("::");
      atual.gabarito = String(p[0] || "").trim().toUpperCase().slice(0, 1);
      atual.comentario = p.slice(1).join("::").trim();
      atual._lendoComentario = true;
      return;
    }

    if (atual && atual._lendoComentario) {
      /* só continua o comentário se a frase estava PENDURADA. Um comentário
       * que já terminou em ponto não pede continuação — o que vem depois é
       * outra coisa, e outra coisa tem de aparecer na conferência em vez de
       * entrar de carona no gabarito. */
      if (/[.!?:;]["»)\]]?$/.test(atual.comentario)) {
        atual._lendoComentario = false;
        ignoradas.push({ linha: li + 1, txt: l.slice(0, 70), motivo: "fora_de_questao" });
        return;
      }
      atual.comentario = (atual.comentario ? atual.comentario + " " : "") + l;
      return;
    }
    if (atual && !atual.gabarito && !atual.opcoes.length) {
      atual.enunciado = (atual.enunciado ? atual.enunciado + " " : "") + l;
      return;
    }
    ignoradas.push({ linha: li + 1, txt: l.slice(0, 70), motivo: "fora_de_questao" });
  });
  fechar();

  return { achados, ignoradas };
}

/* ---------------------------------------------------------------------
 * GRAVAR — com recibo, e sem duplicar
 * ------------------------------------------------------------------- */
function qsIgual(a, b) {
  return qsNormal(a.enunciado) === qsNormal(b.enunciado)
    && (a.chave || "") === (b.chave || "");
}

function qsAplicar(lista, gravar) {
  const novas = [];
  let repetidas = 0;
  (lista || []).forEach((q) => {
    if (qsBanco.some((v) => qsIgual(v, q))) { repetidas++; return; }
    const limpa = {
      id: q.id || qsNovoId(),
      tipo: q.tipo === "ce" ? "ce" : "me",
      enunciado: String(q.enunciado || "").trim(),
      opcoes: (q.opcoes || []).map((o) => ({ letra: o.letra, txt: o.txt })),
      gabarito: String(q.gabarito || "").toUpperCase().slice(0, 1),
      comentario: String(q.comentario || "").trim(),
      disciplina: q.disciplina || "", topico: q.topico || "",
      chave: q.chave || "", concurso: q.concurso || "", banca: q.banca || "",
      origem: q.origem || "manual",
      criado: new Date().toISOString(),
      tentativas: [],
    };
    qsBanco.push(limpa);
    novas.push(limpa);
  });
  qsSalvar(gravar);
  return { novas: novas.length, repetidas, ids: novas.map((x) => x.id) };
}

function qsDesfazer(recibo, gravar) {
  if (!recibo || !recibo.ids) return 0;
  const antes = qsBanco.length;
  qsBanco = qsBanco.filter((q) => recibo.ids.indexOf(q.id) < 0);
  qsSalvar(gravar);
  return antes - qsBanco.length;
}

function qsApagar(id, gravar) {
  const antes = qsBanco.length;
  qsBanco = qsBanco.filter((q) => q.id !== id);
  qsSalvar(gravar);
  return antes - qsBanco.length;
}

/* ---------------------------------------------------------------------
 * ESCOLHER O QUE RESPONDER
 * ------------------------------------------------------------------- */
function qsFiltrar(f) {
  const o = f || {};
  return qsBanco.filter((q) => {
    if (o.chave && q.chave !== o.chave) return false;
    if (o.disciplina && qsNormal(q.disciplina) !== qsNormal(o.disciplina)) return false;
    if (o.concurso && qsNormal(q.concurso) !== qsNormal(o.concurso)) return false;
    if (o.banca && qsNormal(q.banca) !== qsNormal(o.banca)) return false;
    if (o.tipo && q.tipo !== o.tipo) return false;
    if (o.soIneditas && (q.tentativas || []).length) return false;
    if (o.soErradas) {
      const ts = q.tentativas || [];
      if (!ts.length || ts[ts.length - 1].acertou) return false;
    }
    if (o.busca && qsNormal(q.enunciado).indexOf(qsNormal(o.busca)) < 0) return false;
    return true;
  });
}

/* quantas questões cada tópico tem — é o que põe o número no botão dentro
 * do resumo sem varrer o banco a cada desenho */
function qsContarPorChave() {
  const m = {};
  qsBanco.forEach((q) => { if (q.chave) m[q.chave] = (m[q.chave] || 0) + 1; });
  return m;
}

function qsBancas() {
  const s = {};
  qsBanco.forEach((q) => { if (q.banca) s[q.banca] = 1; });
  return Object.keys(s).sort();
}

function qsDisciplinas() {
  const s = {};
  qsBanco.forEach((q) => { if (q.disciplina) s[q.disciplina] = 1; });
  return Object.keys(s).sort();
}

/* ---------------------------------------------------------------------
 * RESPONDER
 *
 * O gabarito só aparece DEPOIS de escolher. Mostrar antes transforma o
 * teste em leitura — que é exatamente o que a pessoa já fez no resumo.
 * ------------------------------------------------------------------- */
let qsSessao = null;

function qsSessaoIniciar(lista, opcoes) {
  const o = opcoes || {};
  const fila = (lista || []).slice();
  if (o.embaralhar) {
    for (let i = fila.length - 1; i > 0; i--) {
      const j = Math.floor((o.sorte ? o.sorte() : Math.random()) * (i + 1));
      const tmp = fila[i]; fila[i] = fila[j]; fila[j] = tmp;
    }
  }
  qsSessao = { fila, i: 0, respondidas: [], comecou: new Date().toISOString() };
  return qsSessao;
}

function qsSessaoAtual() { return qsSessao; }

function qsAtual() {
  if (!qsSessao || qsSessao.i >= qsSessao.fila.length) return null;
  return qsSessao.fila[qsSessao.i];
}

function qsJaRespondida() {
  const q = qsAtual();
  if (!q || !qsSessao) return null;
  return qsSessao.respondidas.filter((x) => x.id === q.id)[0] || null;
}

function qsResponder(escolha, gravar) {
  const q = qsAtual();
  if (!q) return null;
  if (qsJaRespondida()) return null;   /* uma resposta por passagem */
  const resp = String(escolha || "").toUpperCase().slice(0, 1);
  const acertou = resp === String(q.gabarito || "").toUpperCase();
  q.tentativas = q.tentativas || [];
  q.tentativas.push({ q: new Date().toISOString(), resp, acertou });
  qsSessao.respondidas.push({ id: q.id, resp, acertou });
  qsSalvar(gravar);
  return { acertou, gabarito: q.gabarito, comentario: q.comentario, resp };
}

function qsAndar(n) {
  if (!qsSessao) return null;
  qsSessao.i = Math.max(0, Math.min(qsSessao.fila.length, qsSessao.i + (n || 1)));
  return qsAtual();
}

function qsPlacar() {
  if (!qsSessao) return { total: 0, feitas: 0, certas: 0, pct: 0 };
  const feitas = qsSessao.respondidas.length;
  const certas = qsSessao.respondidas.filter((x) => x.acertou).length;
  return { total: qsSessao.fila.length, feitas, certas,
           pct: feitas ? Math.round((certas / feitas) * 100) : 0 };
}

function qsDesempenho(lista) {
  const ls = lista || qsBanco;
  let feitas = 0, certas = 0;
  ls.forEach((q) => {
    (q.tentativas || []).forEach((tt) => { feitas++; if (tt.acertou) certas++; });
  });
  return { questoes: ls.length, feitas, certas,
           pct: feitas ? Math.round((certas / feitas) * 100) : null };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    qsNormal, qsCarregar, qsSalvar, qsTodas, qsPrompt, qsLerResposta,
    qsAplicar, qsDesfazer, qsApagar, qsFiltrar, qsContarPorChave, qsBancas,
    qsDisciplinas, qsSessaoIniciar, qsAtual, qsResponder, qsAndar, qsPlacar,
    qsDesempenho, qsSessaoAtual, qsJaRespondida,
  };
}
