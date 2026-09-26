/* =====================================================================
 * AGENDADOR DE CARTÕES (estilo Anki): De novo · Difícil · Bom · Fácil
 *
 * Funções PURAS: recebem o registro do cartão, a nota (1 a 4) e o "agora", e devolvem o registro novo. Quem guarda no
 * navegador é o player (estudo-cartoes.js). Nenhuma função aqui lê a tela.
 *
 * É uma APROXIMAÇÃO do agendador v2 do Anki com os padrões dele — não uma cópia:
 *   - CARTÃO NOVO / EM APRENDIZADO: passos de 1 min e 10 min. De novo volta ao 1º passo; Difícil repete o passo; Bom
 *     avança (no último, forma-se em 1 dia); Fácil forma-se direto em 4 dias.
 *   - REVISÃO: Bom = intervalo × facilidade (2,5); Difícil = × 1,2 e facilidade −0,15; Fácil = × facilidade × 1,3 e
 *     facilidade +0,15; De novo = LAPSO: facilidade −0,20, volta a "reaprender" (passo de 10 min) e reforma-se em 1 dia.
 *   - Os intervalos dos quatro botões sempre crescem (Difícil < Bom < Fácil, ao menos +1 dia de diferença).
 *   - Novos por dia: 20. Revisão vence no DIA marcado (não na hora).
 *
 * O registro de um cartão: { s: "learn"|"review"|"relearn", st: passo, iv: dias, ez: facilidade, due: ms, n: vezes, l: lapsos }.
 * Cartão SEM registro é NOVO.
 * ===================================================================== */
const AGD = {
  passos: [1, 10], passosRel: [10], graduar: 1, facil: 4,
  ease0: 2.5, easeMin: 1.3, difIvl: 1.2, bonus: 1.3, novosDia: 20, adiante: 20,
};
const AGD_MIN = 60000, AGD_DIA = 86400000;

/* fim do dia local de `agora` (último ms) */
function agdFimDoDia(agora) {
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

/* Aplica a nota (1 De novo, 2 Difícil, 3 Bom, 4 Fácil) e devolve o registro NOVO (não altera o de entrada). */
function agdResponder(reg, nota, agora) {
  const r = reg ? Object.assign({}, reg) : { s: "learn", st: 0, iv: 0, ez: AGD.ease0, due: agora, n: 0, l: 0, novo: true };
  const dias = (n) => agora + n * AGD_DIA;
  const min = (n) => agora + n * AGD_MIN;
  r.n = (r.n || 0) + 1;
  if (r.s === "learn" || r.s === "relearn") {
    const passos = r.s === "relearn" ? AGD.passosRel : AGD.passos;
    const st = Math.min(r.st || 0, passos.length - 1);
    const formar = (iv) => { r.s = "review"; r.iv = iv; r.st = 0; r.due = dias(iv); };
    if (nota === 1) { r.st = 0; r.due = min(passos[0]); }
    else if (nota === 2) { r.st = st; r.due = min(passos[st]); }
    else if (nota === 3) {
      if (st + 1 < passos.length) { r.st = st + 1; r.due = min(passos[r.st]); }
      else formar(r.s === "relearn" ? Math.max(1, r.iv || 1) : AGD.graduar);
    } else formar(r.s === "relearn" ? Math.max(1, r.iv || 1) + 1 : AGD.facil);
    delete r.novo;
    return r;
  }
  /* revisão */
  const iv = Math.max(1, r.iv || 1), ez = r.ez || AGD.ease0;
  if (nota === 1) {
    r.l = (r.l || 0) + 1;
    r.ez = Math.max(AGD.easeMin, ez - 0.2);
    r.s = "relearn"; r.st = 0; r.iv = 1; r.due = min(AGD.passosRel[0]);
    return r;
  }
  const dificil = Math.max(iv + 1, Math.round(iv * AGD.difIvl));
  const bom = Math.max(dificil + 1, Math.round(iv * ez));
  const facil = Math.max(bom + 1, Math.round(iv * ez * AGD.bonus));
  if (nota === 2) { r.ez = Math.max(AGD.easeMin, ez - 0.15); r.iv = dificil; }
  else if (nota === 3) { r.iv = bom; }
  else { r.ez = ez + 0.15; r.iv = facil; }
  r.due = dias(r.iv);
  return r;
}

/* Quanto falta para o cartão voltar, para cada botão: [ms, ms, ms, ms] (o texto dos botões). */
function agdPrevisao(reg, agora) {
  return [1, 2, 3, 4].map((n) => agdResponder(reg, n, agora).due - agora);
}

/* "<1min", "10min", "3h", "4d", "1,5mes", "1,2a" — `u` traz as unidades (traduzíveis) */
function agdFormatar(ms, u) {
  const un = u || { min: "min", h: "h", d: "d", mes: "mes", a: "a" };
  const fmt = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
  if (ms < AGD_MIN) return "<1" + un.min;
  const m = ms / AGD_MIN;
  if (m < 60) return Math.round(m) + un.min;
  const h = m / 60;
  if (h < 24) return Math.round(h) + un.h;
  const d = h / 24;
  if (d < 30) return Math.round(d) + un.d;
  if (d < 365) return fmt(d / 30) + un.mes;
  return fmt(d / 365) + un.a;
}

/* A FILA do momento.
 *   unidades: [{ id }, ...] na ordem de estudo · regs: { id → registro } · dia: { novos: n já vistos hoje }
 * Ordem (a do Anki): aprendizado vencido → revisões do dia → novos (até o limite do dia) → aprendizado a vencer em breve.
 * Devolve { proxima: unidade|null, conta: { novos, aprender, revisar }, quando: ms|null } — `quando` é o próximo
 * vencimento futuro, para a tela dizer "volte em 12 min" quando não há mais nada agora. */
function agdFila(unidades, regs, dia, agora, opc) {
  const o = Object.assign({}, AGD, opc || {});
  const fim = agdFimDoDia(agora);
  const aprVencido = [], revisoes = [], novos = [], aprAdiante = [];
  let futuro = null;
  (unidades || []).forEach((u) => {
    const r = (regs || {})[u.id];
    if (!r) { novos.push(u); return; }
    if (r.s === "learn" || r.s === "relearn") {
      if (r.due <= agora) aprVencido.push([r.due, u]);
      else if (r.due <= agora + o.adiante * AGD_MIN) aprAdiante.push([r.due, u]);
      else futuro = futuro === null ? r.due : Math.min(futuro, r.due);
      return;
    }
    if (r.due <= fim) revisoes.push([r.due, u]);
    else futuro = futuro === null ? r.due : Math.min(futuro, r.due);
  });
  const restam = Math.max(0, o.novosDia - ((dia && dia.novos) || 0));
  const novosHoje = novos.slice(0, restam);
  const porData = (a, b) => a[0] - b[0];
  aprVencido.sort(porData); revisoes.sort(porData); aprAdiante.sort(porData);
  const aprender = aprVencido.length + aprAdiante.length;
  let proxima = null;
  if (aprVencido.length) proxima = aprVencido[0][1];
  else if (revisoes.length) proxima = revisoes[0][1];
  else if (novosHoje.length) proxima = novosHoje[0];
  else if (aprAdiante.length) proxima = aprAdiante[0][1];
  if (!proxima && aprAdiante.length === 0 && novos.length > novosHoje.length) futuro = futuro === null ? fim + 1 : Math.min(futuro, fim + 1);
  return { proxima, conta: { novos: novosHoje.length, aprender, revisar: revisoes.length }, quando: futuro };
}
