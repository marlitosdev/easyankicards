/* =====================================================================
 * MATERIAL DE ESTUDO: CONTAGENS QUE SE ENTENDEM (v18.39.0, JM1)
 *
 * O relato, com print: "⚖ Julgados · 4" na aba e "13 julgado(s)" na
 * linha — a aba contava TÓPICOS, a linha contava JULGADOS, e só a dica do
 * mouse dizia isso. Agora a aba conta o que o nome dela diz (julgados,
 * cartões, leis, questões; um julgado ou uma lei em dois tópicos conta uma
 * vez) e, com a aba ativa, uma linha diz "N itens em K tópicos".
 * Junto: o edital vira cabeçalho de largura inteira (a classe do grupo
 * colidia com a dos grupos de botões da leitura) e as questões do tópico
 * ganham aba e botão na linha.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((x) => { if (pred(x)) acc.push(x); achar(x, pred, acc); }); return acc; };
  const cls = (e) => String((e || {}).className || "");

  const { api } = rodar();
  api.matIniciar();
  const mat = api.matResumosAtual();
  Object.keys(mat).forEach((k) => delete mat[k]);
  const A = api.matChave("Tributário", "Limitações"), B = api.matChave("Tributário", "Princípios");
  api.matGravar(A, "Resumo A.", { disciplina: "Tributário", topico: "Limitações", concurso: "ISS" });
  api.matGravarCartoes(A, ["P1? :: R1 :: t", "P2? :: R2 :: t", "P3? :: R3 :: t"].join("\n"), { disciplina: "Tributário", topico: "Limitações" });
  api.matGravarCartoes(B, ["Q1? :: S1 :: t", "Q2? :: S2 :: t"].join("\n"), { disciplina: "Tributário", topico: "Princípios", concurso: "ISS" });
  const jur = (n, chs) => { const j = api.jurGravar({ tribunal: "STF", classe: "RE", numero: String(n), tese: "tese " + n }); chs.forEach((c) => api.jurLigar(j.id, c[0], "Tributário", c[1])); return j; };
  jur(101, [[A, "Limitações"]]); jur(102, [[A, "Limitações"]]); jur(103, [[A, "Limitações"]]);
  jur(104, [[A, "Limitações"], [B, "Princípios"]]);   /* o mesmo julgado nos dois tópicos: conta UMA vez */
  api.leiGuardar({ id: "lei-ctn", nome: "CTN", texto: "Art. 1º Texto.", topicos: [A, B] });   /* a mesma lei nos dois */
  api.qsBancoPor([
    { id: "q1", chave: A, disciplina: "Tributário", topico: "Limitações", enunciado: "x", gabarito: "C", tipo: "ce" },
    { id: "q2", chave: A, disciplina: "Tributário", topico: "Limitações", enunciado: "y", gabarito: "E", tipo: "ce" },
  ]);
  api.matFiltroTiposTeste([]);
  api.matRender();
  const abas = () => Array.from(api.$("matTipos").children);
  const aba = (tp) => abas().find((b) => cls(b).indexOf("tp-" + tp) >= 0);

  /* C1: a aba conta ITENS */
  ok(aba("tudo").textContent === "Tudo · 2", "C1 'Tudo' conta tópicos: " + aba("tudo").textContent);
  ok(aba("cartoes").textContent === "🃏 Cartões · 5" && aba("cartoes").title === "5 cartão(ões) em 2 tópico(s)", "C1a cartões: 5 cartões em 2 tópicos: " + aba("cartoes").textContent + " | " + aba("cartoes").title);
  ok(aba("juris").textContent === "⚖ Julgados · 4" && aba("juris").title === "4 julgado(s) em 2 tópico(s)", "C1b julgados: 4 (o que está em dois tópicos conta uma vez) em 2 tópicos: " + aba("juris").textContent + " | " + aba("juris").title);
  ok(aba("lei").textContent === "§ Lei seca · 1" && aba("lei").title === "1 lei(s) em 2 tópico(s)", "C1c lei: a mesma lei em dois tópicos é 1 lei: " + aba("lei").textContent + " | " + aba("lei").title);
  ok(aba("resumo").textContent === "📄 Resumos · 1", "C1d resumos: um por tópico: " + aba("resumo").textContent);
  ok(aba("questoes") && aba("questoes").textContent === "❓ Questões · 2" && aba("questoes").title === "2 questão(ões) em 1 tópico(s)", "C1e questões têm aba, com o total: " + (aba("questoes") && aba("questoes").textContent));

  /* C2: a linha "N itens em K tópicos" só com uma aba de tipo ativa */
  ok(api.$("matAbaConta").hidden === true, "C2 em 'Tudo' a linha da contagem não aparece");
  aba("juris").onclick();
  ok(api.$("matAbaConta").hidden === false && api.$("matAbaConta").textContent === "⚖ 4 julgado(s) em 2 tópico(s)", "C2a aba Julgados: a linha diz quantos julgados em quantos tópicos: " + api.$("matAbaConta").textContent);
  aba("questoes").onclick();
  const nomes = () => achar(api.$("matLista"), (e) => /(^| )mat-nome( |$)/.test(cls(e))).map((e) => e.textContent);
  ok(api.$("matFerrQuestoes").hidden === false && nomes().join() === "Limitações" && /questão/.test(api.$("matAbaConta").textContent), "C2b aba Questões: a faixa dela, e só os tópicos com questões: " + nomes().join());
  aba("tudo").onclick();
  ok(api.$("matAbaConta").hidden === true && api.$("matFerrQuestoes").hidden === true, "C2c voltar a 'Tudo' esconde a linha e a faixa");

  /* C3: o botão das questões na linha */
  const linhaA = achar(api.$("matLista"), (e) => cls(e) === "mat-item").find((it) => /^Limitações/.test(it.textContent));
  const slotQ = achar(linhaA, (e) => /\bslot-questoes\b/.test(cls(e)))[0];
  ok(slotQ && slotQ.textContent === "❓ 2 questão(ões)" && typeof slotQ.onclick === "function" && slotQ.title, "C3 a linha tem o botão ❓ com o número de questões: " + (slotQ && slotQ.textContent));
  const linhaB = achar(api.$("matLista"), (e) => cls(e) === "mat-item").find((it) => /^Princípios/.test(it.textContent));
  ok(!achar(linhaB, (e) => /\bslot-questoes\b/.test(cls(e))).length, "C3a tópico sem questões não tem o botão");

  /* C4: o edital é um cabeçalho de largura inteira (classe própria, sem o inline-flex dos grupos de botões) */
  const grupos = Array.from(api.$("matLista").children).filter((e) => /mat-grupo/.test(cls(e)));
  ok(grupos.length && grupos.every((g) => cls(g) === "mat-grupo-ed"), "C4 o grupo do edital tem classe própria: " + grupos.map(cls).join());
  ok(HTML.indexOf(".mat-grupo-ed{margin:0 0 6px}") > 0 && HTML.indexOf(".mat-tipo.ativa.tp-questoes{") > 0 && HTML.indexOf(".mat-aba-conta{") > 0, "C4a o CSS do grupo, da aba de questões e da linha de contagem existe");

  /* C5: os textos novos nos dois idiomas */
  ["mat_aba_questoes", "mat_aba_itens", "mat_un_juris", "mat_un_cartoes", "mat_un_lei", "mat_un_questoes", "mat_un_resumo", "mat_tipo_questoes", "mat_slot_questoes_n", "mat_ferr_questoes_exp"].forEach((k) => {
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "C5 falta " + k + " em " + l); });
  });
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
