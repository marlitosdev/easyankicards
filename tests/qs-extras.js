/* =====================================================================
 * EXTRAS DAS QUESTÕES (v19.10.0) — tirados do caderno da Literalidade
 *
 * O QUE PRECISA SER VERDADE:
 *  1. caracteres invisíveis (a marca d'água de largura zero daquele site, o hífen mole dos PDFs) saem ao colar e ao
 *     ler as questões — a busca e o "repetido" voltam a funcionar;
 *  2. a origem (disciplina, tópico) pode ficar escondida: um toque mostra só naquela questão; responder mostra;
 *  3. a linha "você já respondeu esta N×" abre as tentativas; a letra marcada só aparece depois de responder;
 *  4. a linha de teclas lembra os atalhos do lápis.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const ZW = String.fromCharCode(0x200B), ZJ = String.fromCharCode(0x200D), WJ = String.fromCharCode(0x2060), SH = String.fromCharCode(0x00AD);

  /* ---- 1: invisíveis ---- */
  {
    const { api } = rodar();
    const sujo = "base" + ZW + " de cál" + SH + "culo" + WJ + " do IBS" + ZJ;
    ok(api.semInvisiveis(sujo) === "base de cálculo do IBS", "Z1 os invisíveis saem: " + JSON.stringify(api.semInvisiveis(sujo)));
    ok(api.semInvisiveis("Ação — “x” ç") === "Ação — “x” ç", "Z1a o resto do texto fica intacto (acento, travessão, aspas)");
    const campo = { value: "abc" + ZW + "def" + ZW + ZW + "ghi", selectionStart: 10, setSelectionRange(a) { this.pos = a; } };
    ok(api.limparInvisiveisNoCampo(campo) === 3 && campo.value === "abcdefghi" && campo.pos === 7, "Z2 no campo, depois de colar: limpa e o cursor fica no lugar: " + JSON.stringify(campo));
    ok(api.limparInvisiveisNoCampo({ value: "limpo" }) === 0, "Z2a campo limpo: nada muda");
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "T");
    const r = api.qsLerResposta("? CE :: FGV :: A base" + ZW + " de cál" + SH + "culo inclui o frete" + WJ + ".\n= C :: com" + ZW + "entário", { disciplina: "D", topico: "T", chave: ch });
    const q = r.achados[0];
    ok(q && q.enunciado === "A base de cálculo inclui o frete." && !/[​­⁠]/.test(JSON.stringify(q)), "Z3 a questão colada entra sem invisíveis: " + JSON.stringify(q && q.enunciado));
  }

  /* ---- 2 a 4: na sessão ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    api.qsAplicar(api.qsLerResposta("? CE :: FGV :: Afirmacao numero um para responder.\n= C :: comentario", { disciplina: "D", topico: "T", chave: ch }).achados);
    const q = api.qsTodas()[0];
    q.tentativas = [{ q: "2026-08-01T10:00:00Z", resp: "E", acertou: false, chute: true }, { q: "2026-09-10T10:00:00Z", resp: "C", acertou: true }];
    const corpo = api.$("qsSessCorpo");
    const de = () => corpo.querySelectorAll(".qs-de")[0];

    /* origem escondida */
    api.qsOrigemEsconder(true);
    api.qsUiResponderAbrir([q], "aba", "extras");
    ok(/origem escondida/.test(de().textContent) && !/T$/.test(de().textContent), "O1 a origem fica escondida: " + de().textContent);
    de().onclick();
    ok(/D · T/.test(de().textContent), "O2 um toque mostra (só nesta questão): " + de().textContent);
    api.qsUiResponderAbrir([q], "aba", "extras-2");
    ok(/origem escondida/.test(de().textContent) || /D · T/.test(de().textContent), "O2a (a mesma questão, já vista, pode continuar à mostra)");
    const btO = corpo.querySelectorAll("button").filter((b) => b.id === "btnQsOrigem")[0];
    ok(btO && /Mostrar a origem/.test(btO.textContent), "O3 o ⋮ tem a opção (e diz o estado)");

    /* histórico das tentativas */
    const hs = () => corpo.querySelectorAll(".qs-hist")[0];
    ok(hs() && /2×/.test(hs().textContent), "H1 a linha do histórico");
    hs().onclick();
    const lista = () => corpo.querySelectorAll(".qs-hist-tent")[0];
    ok(lista() && /10\/09\/2026 · certa/.test(lista().textContent) && /01\/08\/2026 · errada · chute/.test(lista().textContent) && lista().textContent.indexOf("10/09") < lista().textContent.indexOf("01/08"), "H2 tocar abre as tentativas (mais nova primeiro): " + (lista() && lista().textContent));
    ok(!/marcou [A-E]/.test(lista().textContent) && /depois que você responder/.test(lista().textContent), "H3 antes de responder, sem a letra (seria o gabarito)");
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(lista() && /marcou C/.test(lista().textContent) && /marcou E/.test(lista().textContent), "H4 depois de responder, a letra de cada vez aparece: " + (lista() && lista().textContent));
    ok(/D · T/.test(de().textContent), "O4 depois de responder, a origem aparece");
    hs().onclick();
    ok(!lista(), "H5 tocar de novo fecha");
    /* outra questão, origem NUNCA revelada: responder a mostra */
    api.qsAplicar(api.qsLerResposta("? CE :: FGV :: Segunda afirmacao para responder agora.\n= E :: c", { disciplina: "D2", topico: "T2", chave: api.matChave("D2", "T2") }).achados);
    const q2 = api.qsTodas().filter((x) => /Segunda/.test(x.enunciado))[0];
    api.qsUiResponderAbrir([q2], "aba", "extras-3");
    ok(/origem escondida/.test(de().textContent), "O5 a outra questão começa escondida");
    api.qsResponder("C"); api.qsUiPintarSessao();
    ok(/D2 · T2/.test(de().textContent), "O6 responder mostra a origem (sem precisar tocar): " + de().textContent);
    api.qsOrigemEsconder(false);

    /* teclas */
    ok(/P lápis/.test(api.$("qsTeclas").textContent) && /R borracha/.test(api.$("qsTeclas").textContent), "K1 a linha de teclas lembra os atalhos do lápis");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["qs_origem_escondida", "qs_origem_mostrar", "qs_origem_esconder", "qs_origem_mostrar_todas", "qs_origem_aj", "qs_hist_t_certa", "qs_hist_t_errada",
      "qs_hist_t_chute", "qs_hist_t_marcou", "qs_hist_t_sem_letra"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
