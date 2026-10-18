/* =====================================================================
 * O MARCADOR DE CHUTE (v18.80.0)
 *
 * "Acertou no chute" não é saber. O QUE PRECISA SER VERDADE:
 *  1. ao lado do "responder", ANTES do gabarito, "🎲 chute" liga e
 *     desliga (tecla ?; o C é alternativa e é o Certo); a resposta grava
 *     chute:true na tentativa e na rodada; a questão seguinte começa sem;
 *  2. depois do gabarito: num acerto, "🎲 foi chute" corrige (marca ou
 *     desmarca); num erro, o botão some (erro já é erro);
 *  3. a rodada conta o acerto (o placar diz "N no chute"); o gabarito diz
 *     "acertou — no chute";
 *  4. a questão chutada volta no "só as que errei ou chutei", na
 *     repescagem e no filtro "só erradas" da aba;
 *  5. onde se mede DOMÍNIO o acerto no chute vale 1/4: domínio dos
 *     assuntos, acerto do tópico (S2), ramos, disciplina e o mapa da lei.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };

  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "T");
    api.qsAplicar(api.qsLerResposta([
      "[QUESTAO] ENUNCIADO: Q1 certo ou errado. GABARITO: C COMENTARIO: c1.",
      "[QUESTAO] ENUNCIADO: Q2 certo ou errado. GABARITO: E COMENTARIO: c2.",
      "[QUESTAO] ENUNCIADO: Q3 certo ou errado. GABARITO: C COMENTARIO: c3.",
    ].join("\n"), { disciplina: "D", topico: "T", chave: ch }).achados);
    api.qsUiResponderAbrir(api.qsFiltrar({}), "aba", "t");
    return api;
  };
  const tecla = (api, key) => api.qsTeclaResponder({ key, target: { tagName: "BODY" }, preventDefault() {} });

  /* ---- 1 a 3: marcar, responder, corrigir ---- */
  {
    const a = montar();
    const b = a.$("btnQsChute");
    ok(b.hidden === false && b.textContent === a.t("qs_chute") && b.getAttribute("aria-pressed") === "false", "C1 antes de responder, '🎲 chute' está ao lado do responder, desligado");
    ok(tecla(a, "?") === true && a.qsChuteAtual() === true && b.getAttribute("aria-pressed") === "true", "C1a a tecla ? liga o chute");
    b.onclick();
    ok(a.qsChuteAtual() === false && b.getAttribute("aria-pressed") === "false", "C1b o botão desliga");
    b.onclick();
    const q1 = a.qsAtual();
    tecla(a, String(q1.gabarito).toLowerCase());
    a.$("btnQsProxima").onclick();
    const t1 = q1.tentativas[q1.tentativas.length - 1];
    ok(t1.acertou === true && t1.chute === true && a.qsJaRespondida().chute === true, "C2 responder com o chute ligado grava chute na tentativa e na rodada");
    ok(a.$("qsSessCorpo").textContent.indexOf(a.t("qs_acertou_chute")) >= 0, "C2a o gabarito diz 'acertou — no chute'");
    ok(a.$("qsSessPlacar").textContent.indexOf(a.t("qs_placar_chutes", { n: 1 })) >= 0 && a.qsPlacar().certas === 1, "C2b a rodada conta o acerto e diz quantos foram no chute: " + a.$("qsSessPlacar").textContent);
    ok(b.hidden === false && b.textContent === a.t("qs_chute_depois") && b.getAttribute("aria-pressed") === "true", "C2c depois do acerto: '🎲 foi chute', ligado");
    b.onclick();
    ok(!t1.chute && !a.qsJaRespondida().chute && b.getAttribute("aria-pressed") === "false" && a.$("qsSessPlacar").textContent.indexOf(a.t("qs_placar_chutes", { n: 1 })) < 0, "C2d desmarcar corrige a tentativa e o placar");
    b.onclick();
    ok(t1.chute === true, "C2e marcar de novo (depois do gabarito também vale)");
    /* a próxima começa sem chute */
    a.$("btnQsProxima").onclick();
    ok(a.qsChuteAtual() === false && b.getAttribute("aria-pressed") === "false" && b.textContent === a.t("qs_chute"), "C3 a questão seguinte começa sem o chute");
    /* errou: o botão some (não há o que corrigir) */
    tecla(a, a.qsAtual().gabarito === "C" ? "e" : "c");
    a.$("btnQsProxima").onclick();
    ok(a.qsJaRespondida().acertou === false && b.hidden === true, "C3a num erro, o botão some");
    ok(a.qsUiChuteAlternar() === false && !a.qsAtual().tentativas.slice(-1)[0].chute, "C3b e erro não vira 'chute' nem por fora do botão");
    /* a 3ª: liga o chute e PULA — a próxima (de volta à fila) não pode herdar o chute */
    tecla(a, "?");
    a.$("btnQsPular").onclick();
    ok(a.qsChuteAtual() === false, "C3c chute ligado e questão pulada: a que vem depois começa sem chute");
    ok(a.qsQuantasFalhas() === 3 && a.qsErradasDaSessao().map((q) => q.id).indexOf(q1.id) >= 0, "C4 a chutada volta no 'só as que errei ou chutei' e na repescagem");
    ok(a.qsFiltrar({ soErradas: true }).some((q) => q.id === q1.id), "C4a e no filtro 'só erradas' da aba (a última tentativa foi chute)");
    ok(a.qsPedeRevisao({ acertou: true }) === false && a.qsPedeRevisao({ acertou: true, chute: true }) && a.qsPedeRevisao({ acertou: false }), "C4b pede revisão: erro ou chute");
  }

  /* ---- 5: 1/4 onde se mede domínio ---- */
  {
    const a = montar();
    ok(a.qsValorAcerto({ acertou: true }) === 1 && a.qsValorAcerto({ acertou: true, chute: true }) === a.QS_PESO_CHUTE && a.QS_PESO_CHUTE === 0.25 && a.qsValorAcerto({ acertou: false, chute: true }) === 0,
       "D1 o acerto vale 1, o chute 1/4, o erro 0 (chutado ou não)");
    const dom = a.domAcerto([{ q: "2026-01-01", acertou: true }, { q: "2026-01-02", acertou: true, chute: true }, { q: "2026-01-03", acertou: false }, { q: "2026-01-04", acertou: true, chute: true }]);
    ok(dom.certas === 1.5 && Math.round(dom.pct) === 38, "D2 domínio dos assuntos: 1 + 1/4 + 0 + 1/4 de 4 = 38%: " + JSON.stringify(dom));
    const ch = a.matChave("D", "T");
    const banco = Array.from({ length: 10 }, (_, i) => ({ chave: ch, disciplina: "D", topico: "T", tentativas: [{ q: "2026-02-" + String(10 + i), acertou: true, chute: i < 8 }] }));
    const ac = a.edAcertosPorTopico([], banco)[ch.toLowerCase()];
    ok(ac && ac.pct === 40, "D3 acerto do tópico (S2): 10 acertos, 8 no chute = 2 + 8/4 = 40% (era 100%, 'fácil'): " + JSON.stringify(ac));
  }
  /* o mapa da lei: dois chutes não compensam um erro */
  {
    const { api: b } = rodar();
    b.matIniciar(); b.leiIniciar();
    const chT = b.matChave("Direito Tributário", "Tributo");
    b.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", especie: "Lei", numero: "5172", ano: "1966",
      texto: "Art. 1º Esta Lei regula.\nArt. 3º Tributo é prestação.", topicos: [chT] });
    b.qsTodas().push({ id: "q1", tipo: "ce", enunciado: "Segundo o art. 3º do CTN.", gabarito: "C", comentario: "", chave: chT,
      tentativas: [{ acertou: false }, { acertou: true, chute: true }, { acertou: true, chute: true }] });
    b.leiAbrir("Direito Tributário", "Tributo", "lei_ctn");
    const r = b.leiRanking("lei_ctn").find((x) => x.num === "3");
    ok(r && r.erros === 1 && r.acertos === 0.5 && r.chutes === 2 && r.acertosN === 0, "D4 no mapa: 1 erro, 2 chutes (valem 0,5): " + JSON.stringify(r));
    b.leiIrAbrir();
    const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
    const cel = achar(b.$("leiIrGrade"), (c) => /lei-ir-cel/.test(c.className || "") && c.children[0] && c.children[0].textContent === "3º")[0];
    ok(cel && /lei-ir-cel-erro/.test(cel.className), "D5 a pílula do art. 3º fica vermelha (o erro pesa mais que dois chutes)");
    b.$("btnLeiIrF_erros").onclick();
    ok(/1 erro/.test(b.$("leiIrGrade").textContent) && b.$("leiIrGrade").textContent.indexOf(b.t("lei_rank_chutes", { n: 2 })) >= 0, "D6 a lista diz '2 no chute': " + b.$("leiIrGrade").textContent.slice(0, 200));
  }
  return falhas;
}

module.exports = { testes };
