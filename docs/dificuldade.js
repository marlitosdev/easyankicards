/* =====================================================================
 * O QUE VOCÊ ACHA QUE NÃO SABE
 *
 * O plano media a prova e ignorava você. A prioridade de um tópico era a
 * mesma no primeiro dia e depois de você errar 70% das questões dele.
 *
 * Aqui entra o outro lado: o seu julgamento. Três níveis, porque cinco
 * viram chute e dois não distinguem "preciso treinar" de "não entendi".
 *
 * POR QUE A PERCEPÇÃO E NÃO SÓ O ACERTO. 80% num tópico de exatas pode
 * ter custado o dobro do tempo, ou ter vindo de chute com sorte. O
 * percentual mede o resultado; a insegurança aparece antes, e é ela que
 * vira erro no dia da prova, sob relógio. Um mede o passado, o outro
 * antecipa — e por isso os dois ficam, lado a lado, sem se misturarem
 * num número só.
 *
 * ------------------------------------------------------------------
 * DUAS DECISÕES QUE FAZEM ISTO NÃO APODRECER
 *
 * 1. A AVALIAÇÃO VENCE. Um tópico marcado "inseguro" em março e nunca
 *    reavaliado continuaria furando fila em novembro, muito depois de
 *    você já dominá-lo. Passados 45 dias a marca não é apagada — ela
 *    deixa de pesar, e a tela diz que está vencida. Apagar perderia a
 *    informação; manter valendo mentiria.
 *
 * 2. DECLARAR VENCE INFERIR. "Rendeu pouco" numa sessão sugere
 *    dificuldade, e o app usa isso — mas é palpite sobre uma tarde. Se
 *    você disse "domino", uma tarde ruim não desmente: a declaração
 *    explícita fica, e a inferida só preenche o silêncio.
 * ===================================================================== */

const DIF_CHAVE = "eac_dificuldade";
const DIF_VALIDADE = 45;          /* dias até a avaliação vencer */

/* Os três níveis e o que cada um multiplica. Acima de 1 sobe na fila,
 * abaixo desce. O 0.7 do domínio não é enfeite: sem ele, "eu já sei
 * isto" não teria efeito nenhum e a tela ofereceria um botão que não faz
 * nada — que é como se aprende a não usar um recurso. */
const DIF_NIVEIS = [
  { id: "alta", fator: 1.5 },
  { id: "media", fator: 1.0 },
  { id: "baixa", fator: 0.7 },
];

let difMapa = null;

function difLer() {
  if (difMapa) return difMapa;
  try { difMapa = JSON.parse(localStorage.getItem(DIF_CHAVE) || "{}") || {}; }
  catch (e) { difMapa = {}; }
  if (typeof difMapa !== "object" || Array.isArray(difMapa)) difMapa = {};
  return difMapa;
}

/* ESQUECER O QUE ESTÁ NA MEMÓRIA e reler do armazenamento.
 *
 * O mapa fica em cache porque difDe é chamada uma vez por linha da
 * agenda — reabrir e reinterpretar o JSON 200 vezes por repintura seria
 * caro. Mas cache que nunca é invalidado mente na hora errada: quem
 * restaura um backup troca o armazenamento por baixo, e sem isto o app
 * continuaria mostrando as avaliações do arquivo antigo até o F5. */
function difRecarregar() {
  difMapa = null;
  return difLer();
}

function difSalvar() {
  const txt = JSON.stringify(difMapa || {});
  if (typeof guardar === "function") guardar(DIF_CHAVE, txt);
  else { try { localStorage.setItem(DIF_CHAVE, txt); } catch (e) {} }
}

function difHojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

/* dias de calendário entre duas datas ISO, sem hora e sem fuso no meio */
function difDias(de, ate) {
  const num = (iso) => {
    const p = String(iso || "").slice(0, 10).split("-").map(Number);
    if (!p[0]) return NaN;
    return Math.floor(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) / 86400000);
  };
  const a = num(de), b = num(ate || difHojeISO());
  return isFinite(a) && isFinite(b) ? b - a : NaN;
}

function difChave(disc, top) {
  return (String(disc || "") + "›" + String(top || "")).toLowerCase();
}

function difNivelValido(n) {
  return DIF_NIVEIS.some((x) => x.id === n);
}

/* Guarda o nível. `origem` é "declarada" (você disse) ou "sessao" (o app
 * deduziu do "rendeu pouco"). */
function difDefinir(disc, top, nivel, origem) {
  if (!difNivelValido(nivel)) return false;
  const m = difLer();
  const k = difChave(disc, top);
  const antes = m[k];
  /* DECLARAR VENCE INFERIR — e uma inferência não pisa numa declaração
   * que ainda vale. O contrário (declaração sobre inferência) é sempre
   * permitido: é a pessoa corrigindo o palpite do app. */
  if (origem === "sessao" && antes && antes.o === "declarada"
      && difDias(antes.d) <= DIF_VALIDADE) {
    return false;
  }
  m[k] = { n: nivel, d: difHojeISO(), o: origem === "sessao" ? "sessao" : "declarada" };
  difSalvar();
  return true;
}

function difApagar(disc, top) {
  const m = difLer();
  const k = difChave(disc, top);
  if (!(k in m)) return false;
  delete m[k];
  difSalvar();
  return true;
}

/* O QUE A TELA E O PLANO PERGUNTAM.
 * Devolve sempre um objeto — nunca null —, porque "sem avaliação" é uma
 * resposta legítima e com fator 1: quem nunca opinou não deve ver a fila
 * mudar. */
function difDe(disc, top, hoje) {
  const r = difLer()[difChave(disc, top)];
  if (!r || !difNivelValido(r.n)) {
    return { nivel: "", fator: 1, vencida: false, dias: null, origem: "" };
  }
  const dias = difDias(r.d, hoje);
  const vencida = isFinite(dias) && dias > DIF_VALIDADE;
  const base = DIF_NIVEIS.filter((x) => x.id === r.n)[0];
  return {
    nivel: r.n,
    /* VENCIDA NÃO PESA. O nível continua à vista para você reavaliar,
     * mas parou de mexer na ordem — senão uma opinião de março
     * comandaria a agenda de novembro. */
    fator: vencida ? 1 : base.fator,
    fatorNivel: base.fator,
    vencida, dias: isFinite(dias) ? dias : null,
    data: r.d, origem: r.o || "declarada",
  };
}

/* Só o número, que é o que o motor precisa. */
function difFator(disc, top, hoje) {
  return difDe(disc, top, hoje).fator;
}

/* O mapa inteiro no formato que montarPlano espera: chave → fator.
 * Passar o mapa (em vez de o plano chamar difDe item a item) mantém o
 * motor sem dependência deste módulo — ele continua sendo aritmética
 * sobre o que recebeu, e o teste consegue passar um mapa na mão. */
function difMapaFatores(hoje) {
  const m = difLer();
  const out = {};
  Object.keys(m).forEach((k) => {
    const r = m[k];
    if (!r || !difNivelValido(r.n)) return;
    const dias = difDias(r.d, hoje);
    const vencida = isFinite(dias) && dias > DIF_VALIDADE;
    if (vencida) return;                    /* vencida = fator 1 = ausente */
    out[k] = DIF_NIVEIS.filter((x) => x.id === r.n)[0].fator;
  });
  return out;
}

/* Quantas avaliações existem, e quantas já venceram — o número que
 * justifica um aviso de "reavalie" na tela. */
function difResumo(hoje) {
  const m = difLer();
  const r = { total: 0, alta: 0, media: 0, baixa: 0, vencidas: 0, inferidas: 0 };
  Object.keys(m).forEach((k) => {
    const x = m[k];
    if (!x || !difNivelValido(x.n)) return;
    r.total++;
    r[x.n]++;
    if (x.o === "sessao") r.inferidas++;
    const dias = difDias(x.d, hoje);
    if (isFinite(dias) && dias > DIF_VALIDADE) r.vencidas++;
  });
  return r;
}

/* O "rendeu pouco" da sessão vira uma avaliação inferida. Chamado pelo
 * registro de estudo; devolve true se de fato mudou alguma coisa. */
function difDoHumor(disc, top, humor) {
  if (humor === "ruim") return difDefinir(disc, top, "alta", "sessao");
  if (humor === "boa") return difDefinir(disc, top, "baixa", "sessao");
  return false;
}

/* O selo da linha da agenda. Mora aqui, e não na tela, porque quem sabe
 * quando um nível conta e quando venceu é este módulo — a tela só
 * pendura o que receber. Devolve null quando não há o que dizer: nível
 * "média" sem vencimento é o padrão, e um selo para o padrão seria ruído
 * em toda linha da lista. */
function difSeloDe(item) {
  if (!item || typeof document === "undefined") return null;
  const d = difDe(item.disciplina, item.nome);
  if (!d.nivel) return null;
  if (d.nivel === "media" && !d.vencida) return null;
  const el = document.createElement("span");
  el.className = "dif-selo " + d.nivel + (d.vencida ? " vencida" : "");
  el.textContent = t("dif_selo_" + d.nivel);
  el.title = d.vencida
    ? t("dif_eco_vencida", { n: t("dif_n_" + d.nivel), d: d.dias })
    : t("dif_eco_atual", { n: t("dif_n_" + d.nivel),
        o: t("dif_origem_" + d.origem), d: d.dias });
  return el;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DIF_CHAVE, DIF_VALIDADE, DIF_NIVEIS,
    difLer, difSalvar, difRecarregar, difChave, difDefinir, difApagar, difDe, difFator,
    difMapaFatores, difResumo, difDoHumor, difDias, difNivelValido,
    difSeloDe,
  };
}
