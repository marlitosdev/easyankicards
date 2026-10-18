/* =====================================================================
 * A QUESTÃO IRMÃ (v18.81.0)
 *
 * Errou (ou acertou no chute) uma questão do art. 3º do CTN: a revisão é
 * OUTRA questão do mesmo artigo, mais adiante na rodada. O QUE PRECISA SER
 * VERDADE:
 *  1. o artigo da questão vem da mesma decisão dos links (o art. 3º da CF
 *     não é irmão do art. 3º do CTN); o mesmo inciso é o mais perto;
 *     nunca respondida vem antes; sem artigo, vale o mesmo ramo;
 *  2. debaixo do gabarito (erro ou chute — acerto firme, não): "N irmãs",
 *     "fazer uma daqui a 5 questões" (a 5ª a partir da atual) ou "fazer
 *     agora" (a próxima); se já estava mais adiante, muda de lugar;
 *  3. agendada: a linha diz onde e deixa desfazer; ao chegar nela, o selo
 *     diz de onde veio; a rodada guarda isso ao fechar e reabrir;
 *  4. a já respondida nesta rodada não volta como irmã.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(e.className || "");

  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.leiIniciar(); a.qsUiIniciar();
    const ch = a.matChave("Direito Tributário", "Tributo");
    a.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", especie: "Lei", numero: "5172", ano: "1966",
      texto: "Art. 1º Regula.\nArt. 3º Tributo é prestação.\nI - a;\nII - b.\nArt. 4º A natureza.", topicos: [ch] });
    a.leiGuardar({ id: "lei_cf", nome: "Constituição Federal", especie: "Constituição", numero: "", ano: "1988", texto: "Art. 3º Objetivos." });
    const Q = (id, en, extra) => Object.assign({ id, tipo: "ce", enunciado: en, gabarito: "C", comentario: "", disciplina: "Direito Tributário", topico: "Tributo", chave: ch, tentativas: [] }, extra || {});
    const qs = [
      Q("q1", "Segundo o art. 3º, II, do CTN, tributo é prestação."),
      Q("f1", "Pelo art. 4º do CTN, a natureza."), Q("f2", "Pelo art. 1º do CTN, regula."), Q("f3", "Questão sem artigo um."),
      Q("f4", "Questão sem artigo dois."), Q("f5", "Questão sem artigo três."), Q("f6", "Questão sem artigo quatro."),
      Q("q2", "Nos termos do art. 3º, II, do CTN, a prestação é pecuniária."),           /* mesmo inciso, nunca feita */
      Q("q3", "O art. 3º do CTN define tributo."),                                      /* mesmo artigo, sem inciso — também nunca feita */
      Q("q5", "O art. 3º da CF traz os objetivos."),                                    /* outra lei */
    ];
    qs.forEach((q) => a.qsTodas().push(q));
    const porId = (id) => a.qsTodas().find((x) => x.id === id);
    a.qsUiResponderAbrir(["q1", "f1", "f2", "f3", "f4", "f5", "f6"].map(porId), "aba", "irma");
    /* a rodada pode vir embaralhada: aqui a ordem é a da lista */
    const s0 = a.qsSessaoAtual();
    s0.fila.splice(0, s0.fila.length, ...["q1", "f1", "f2", "f3", "f4", "f5", "f6"].map(porId));
    s0.i = 0;
    a.qsUiPintarSessao();
    return { a, ch, porId };
  };
  const linha = (a) => achar(a.$("qsSessCorpo"), (e) => cls(e, "qs-irma"))[0];
  const botao = (el, txt) => achar(el, (e) => e.tagName && /button/i.test(e.tagName) && e.textContent === txt)[0];
  const responder = (a, certo, chute) => {
    const q = a.qsAtual();
    if (chute) a.$("btnQsChute").onclick();
    a.qsTeclaResponder({ key: certo ? q.gabarito.toLowerCase() : (q.gabarito === "C" ? "e" : "c"), target: { tagName: "BODY" }, preventDefault() {} });
    a.$("btnQsProxima").onclick();
  };

  /* ---- 1: quem é irmã ---- */
  {
    const { a, porId } = montar();
    const arts = a.qsArtigosDaQuestao(porId("q1"));
    ok(arts.length === 1 && arts[0].chave === "lei_ctn:3" && arts[0].sub.join() === "II", "I1 o artigo da questão: CTN art. 3º, inciso II: " + JSON.stringify(arts));
    ok(a.qsArtigosDaQuestao(porId("q5"))[0].chave === "lei_cf:3", "I1a 'art. 3º da CF' é da CF (não irmã do art. 3º do CTN)");
    const ir = a.qsIrmasDe(porId("q1"), a.qsTodas());
    ok(ir.map((x) => x.q.id).join() === "q2,q3" && ir[0].pontos > ir[1].pontos && /art\. 3º/.test(ir[0].artigo), "I2 as irmãs: q2 (mesmo inciso) antes de q3 (as duas nunca feitas); a da CF e as de outro artigo, não: " + JSON.stringify(ir.map((x) => [x.q.id, x.pontos, x.artigo])));
    /* lei que não está na biblioteca: a citação não tem destino, e "o mesmo artigo" de lugar nenhum não faz irmã */
    const x1 = { id: "x1", enunciado: "Segundo o art. 7º da Lei 9.999/2020.", chave: "outra›coisa", tentativas: [] };
    const x2 = { id: "x2", enunciado: "Pelo art. 7º da Lei 9.999/2020.", chave: "outra›coisa", tentativas: [] };
    ok(a.qsIrmasDe(x1, [x1, x2]).length === 0, "I2a citação sem lei na biblioteca não faz irmã");
    /* sem artigo: o mesmo ramo */
    const r1 = { id: "r1", enunciado: "Sem artigo.", chave: porId("q1").chave, ramo: "conceito", tentativas: [] };
    const r2 = { id: "r2", enunciado: "Também sem.", chave: porId("q1").chave, ramo: "conceito", tentativas: [] };
    const r3 = { id: "r3", enunciado: "Outro ramo.", chave: porId("q1").chave, ramo: "especies", tentativas: [] };
    const rr = a.qsIrmasDe(r1, [r1, r2, r3]);
    ok(rr.length === 1 && rr[0].q.id === "r2" && rr[0].artigo === a.t("qs_irma_ramo"), "I3 sem artigo, a irmã é do mesmo ramo");
  }

  /* ---- 2 e 3: na rodada ---- */
  {
    const { a } = montar();
    responder(a, true);
    ok(!linha(a), "R1 acerto firme: sem irmã");
    a.$("btnQsVoltar") && null;
  }
  {
    const { a, porId } = montar();
    responder(a, false);
    const lin = linha(a);
    ok(lin && lin.textContent.indexOf(a.t("qs_irma_ha", { n: 2, a: "art. 3º " + a.t("qs_irma_da") + " CTN" })) >= 0, "R2 errou: '2 irmãs — art. 3º do CTN': " + (lin && lin.textContent));
    botao(lin, a.t("qs_irma_depois", { n: 5 })).onclick();
    const s = a.qsSessaoAtual();
    ok(s.fila[s.i + 5].id === "q2" && s.fila.length === 8, "R3 'daqui a 5 questões': a irmã q2 vira a 5ª a partir da atual: " + s.fila.map((x) => x.id).join());
    ok(linha(a).textContent.indexOf(a.t("qs_irma_agendada", { a: "art. 3º " + a.t("qs_irma_da") + " CTN", n: 5 })) >= 0, "R3a a linha diz que está agendada e onde");
    ok(a.qsSessaoLer().irmas.q2.origem === "q1", "R3b a rodada guarda a irmã (fechar e reabrir não perde)");
    botao(linha(a), a.t("qs_irma_desfazer")).onclick();
    ok(s.fila.map((x) => x.id).indexOf("q2") < 0 && !a.qsIrmaAgendadaDe("q1") && /qs_irma|🔄/.test(linha(a).textContent), "R3c desfazer tira a irmã da fila e volta a oferecer");
    botao(linha(a), a.t("qs_irma_depois", { n: 5 })).onclick();
    /* andar até ela: o selo */
    for (let k = 0; k < 5; k++) { a.qsAndar(1); }
    a.qsUiPintarSessao();
    ok(a.qsAtual().id === "q2" && achar(a.$("qsSessCorpo"), (e) => cls(e, "qs-irma-selo")).length === 1, "R4 ao chegar nela, o selo diz de onde veio");
    /* retomar a rodada guardada: o selo continua */
    const ret = a.qsSessaoRetomar("irma");
    ok(ret && ret.irmas && ret.irmas.q2 && ret.irmas.q2.artigo, "R4a retomar a rodada guarda as irmãs");
  }
  {
    const { a } = montar();
    responder(a, true, true);
    const lin = linha(a);
    ok(lin, "R5 acertou no chute: também oferece a irmã");
    botao(lin, a.t("qs_irma_agora")).onclick();
    ok(a.qsAtual().id === "q2", "R5a 'fazer agora': a irmã vem já na próxima");
    /* q2 respondida nesta rodada: não volta como irmã */
    responder(a, false);
    const ir = a.qsIrmasDaAtual().map((x) => x.q.id);
    ok(ir.indexOf("q1") < 0 && ir.indexOf("q2") < 0 && ir.indexOf("q3") >= 0, "R6 as já respondidas nesta rodada não voltam como irmã: " + ir.join());
  }
  {
    /* já estava mais adiante na fila: muda de lugar (não duplica) */
    const { a, porId } = montar();
    const s = a.qsSessaoAtual();
    s.fila.push(porId("q2"));
    responder(a, false);
    botao(linha(a), a.t("qs_irma_depois", { n: 5 })).onclick();
    ok(s.fila.filter((x) => x.id === "q2").length === 1 && s.fila[s.i + 5].id === "q2", "R7 a irmã que já estava no fim da fila muda de lugar, sem duplicar");
  }
  return falhas;
}

module.exports = { testes };
