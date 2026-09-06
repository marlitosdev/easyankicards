/* =====================================================================
 * TIRAR DA AGENDA — adiar e dispensar
 *
 * A agenda ordena por prioridade e não pergunta nada. Mas há duas
 * situações em que o item certo está na frente e mesmo assim não é o
 * que fazer agora:
 *
 *   1. NÃO É A HORA. Semana cheia, cabeça em outra matéria, prova de
 *      outro concurso na frente. O tópico continua devendo — só não
 *      hoje.
 *
 *   2. JÁ ESTÁ COBERTO. Estudei isto semana passada para outro edital,
 *      ou já domino. Aqui o tópico não deve mais nada.
 *
 * As duas coisas tiram o item da tela e por isso parecem a mesma. Não
 * são, e a diferença aparece no número que importa: quanto FALTA
 * estudar. Adiado continua na conta; dispensado sai dela. Tratar as
 * duas como uma só produziria um de dois erros — ou a agenda cobra
 * eternamente o que já foi visto, ou o plano encolhe cada vez que a
 * semana está cheia, e a pessoa chega na prova achando que estudou.
 *
 * Por isso o MOTIVO decide o tipo. Ninguém precisa escolher entre dois
 * botões parecidos: escolhe-se o porquê, que é o que a pessoa sabe, e
 * a consequência vem junto.
 * ===================================================================== */

const FA_CHAVE = "eac_fora_da_agenda";

/* Cada motivo já carrega o que ele significa para o plano.
 * "dias" só existe nos de tempo: dispensa não tem prazo de volta. */
const FA_MOTIVOS = [
  { id: "sem_prioridade", tipo: "adiado",     dias: 7 },
  { id: "semana_cheia",   tipo: "adiado",     dias: 7 },
  { id: "outro_concurso", tipo: "adiado",     dias: 30 },
  { id: "outro_edital",   tipo: "dispensado", dias: 0 },
  { id: "ja_domino",      tipo: "dispensado", dias: 0 },
  { id: "nao_vou",        tipo: "dispensado", dias: 0 },
];

function faMotivo(id) {
  return FA_MOTIVOS.filter((m) => m.id === id)[0] || null;
}

/* ---------------- armazenamento ---------------- */

function faLerTudo() {
  try {
    const v = JSON.parse(localStorage.getItem(FA_CHAVE) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch (e) { return {}; }
}

function faGravarTudo(o) {
  try { localStorage.setItem(FA_CHAVE, JSON.stringify(o || {})); return true; }
  catch (e) {
    try { uiAlert(t("fa_sem_espaco")); } catch (e2) {}
    return false;
  }
}

function faHojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

function faEmDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + (Number(n) || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

/* O REGISTRO DE UM TÓPICO, JÁ CONSIDERANDO O PRAZO.
 * Adiamento vencido não é adiamento: devolve null e o item volta à
 * agenda sozinho, sem ninguém precisar lembrar de reativá-lo. */
function faDe(chave) {
  const r = faLerTudo()[String(chave || "")];
  if (!r) return null;
  if (r.tipo === "adiado" && r.ate && r.ate <= faHojeISO()) return null;
  return r;
}

function faEstaFora(chave) { return !!faDe(chave); }

/* dispensados NUNCA vencem: ficam listados para poder voltar à mão */
function faDispensados() {
  const tudo = faLerTudo();
  return Object.keys(tudo)
    .filter((k) => tudo[k] && tudo[k].tipo === "dispensado")
    .map((k) => Object.assign({ chave: k }, tudo[k]));
}

function faAdiados() {
  const tudo = faLerTudo();
  const hoje = faHojeISO();
  return Object.keys(tudo)
    .filter((k) => tudo[k] && tudo[k].tipo === "adiado"
                && (!tudo[k].ate || tudo[k].ate > hoje))
    .map((k) => Object.assign({ chave: k }, tudo[k]));
}

/* MINUTOS DISPENSADOS — o que saiu do que falta estudar.
 * É este número que ganha cor própria no acompanhamento: sem ele, uma
 * semana em que se dispensou meio edital pareceria uma semana de
 * estudo enorme ou uma semana perdida, dependendo de para onde as
 * horas fossem jogadas. Nenhuma das duas é verdade. */
function faMinutosDispensados(filtro) {
  return faDispensados()
    .filter((d) => !filtro || filtro(d))
    .reduce((a, d) => a + (Number(d.minutos) || 0), 0);
}

/* ---------------- pôr e tirar ---------------- */

function faTirar(item, motivoId, gravar) {
  const m = faMotivo(motivoId);
  if (!item || !item.chave || !m) return null;
  const tudo = faLerTudo();
  const r = {
    tipo: m.tipo,
    motivo: motivoId,
    q: new Date().toISOString(),
    /* os minutos que o plano reservava para ele: é o tamanho do que
     * saiu da conta, e sem guardar aqui não haveria como somar depois
     * (o plano é recalculado a cada abertura e o item já não estará lá) */
    minutos: Number(item.minutos) || 0,
    disciplina: item.disciplina || "",
    topico: item.nome || item.topico || "",
    edital: item.edital || null,
  };
  if (m.tipo === "adiado") r.ate = faEmDias(m.dias);
  tudo[String(item.chave)] = r;
  if (!faGravarTudo(tudo)) return null;
  if (gravar) gravar(FA_CHAVE, JSON.stringify(tudo));
  try {
    reg("EDITAL-FORA", (m.tipo === "adiado" ? "adiado: " : "dispensado: ")
        + (r.topico || item.chave),
        (r.disciplina || "?") + " · " + t("fa_motivo_" + motivoId)
        + (r.ate ? " · " + t("fa_volta_em", { d: r.ate }) : ""));
  } catch (e) {}
  return r;
}

function faVoltar(chave, gravar) {
  const tudo = faLerTudo();
  const r = tudo[String(chave)];
  if (!r) return false;
  delete tudo[String(chave)];
  if (!faGravarTudo(tudo)) return false;
  if (gravar) gravar(FA_CHAVE, JSON.stringify(tudo));
  try {
    reg("EDITAL-FORA", "voltou para a agenda: " + (r.topico || chave),
        (r.disciplina || "?"));
  } catch (e) {}
  return true;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FA_CHAVE, FA_MOTIVOS, faMotivo, faLerTudo, faDe, faEstaFora,
    faDispensados, faAdiados, faMinutosDispensados, faTirar, faVoltar,
    faEmDias, faHojeISO,
  };
}
