/* =====================================================================
 * A JANELA "MOVER PARA…" COM A HIERARQUIA À VISTA (19.46.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. As fichas dos editais vêm pela prova mais próxima, com "prova em N dias"; vem marcado o edital do tópico do
 *     cartão (o gravado nele, quando o tópico está em dois editais).
 *  2. A lista é disciplina (cabeçalho que abre e fecha) › tópico; só a disciplina do cartão vem aberta.
 *  3. Os ramos ficam recolhidos num "▸ N ramos" (abertos só no tópico do próprio cartão); abrir mostra e escolher
 *     um ramo continua ligando o cartão a ele.
 *  4. A busca abre o que achou; "todos" mostra cada edital com o seu cabeçalho; a Bancada é um botão no rodapé.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (e, c) => new RegExp("\\b" + c + "\\b").test(String(e.className || ""));
  const conduzir = async (api, promessa, resp) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 80 && !pronto; i++) {
      await new Promise((r) => setImmediate(r));
      try { api._uiFechar(resp === undefined ? true : resp); } catch (e) {}
    }
    return await promessa;
  };

  const r = rodar(); const a = r.api;
  a.matIniciar(); a.edIniciar();
  a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20\n@ Direito Financeiro :: 5\n+ Receita Pública :: 5\n+ Créditos Adicionais :: 3");
  a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5\n@ Direito Financeiro :: 4\n+ Receita Pública :: 4");
  const k = (d, t) => a.matChave(d, t);
  a.matGravarCartoes(k("Direito Financeiro", "Receita Pública"), "Receita 0? :: R0\nReceita 1? :: R1", { disciplina: "Direito Financeiro", topico: "Receita Pública", concurso: "TCE-PE" });
  a.matGravarCartoes(k("Sistema Tributário Brasileiro", "ISS"), "ISS 0? :: R0", { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
  a.gerAbrir();
  const nota = a.gerNotasAtual().find((x) => /Receita 0/.test(x.card.front));
  a.gerDestAbrir([nota]);

  /* ---- 1: fichas ---- */
  const fichas = () => Array.from(a.$("gerDestEds").children);
  const nomes = fichas().map((f) => f.children[0].textContent);
  ok(a.$("gerDestEds").hidden === false && nomes[0] === "ISS Caruaru Auditor" && nomes[1] === "TCE-PE" && nomes[nomes.length - 1] === "todos",
    "D1 as fichas vem pela prova mais proxima (ISS em junho antes do TCE em agosto) e terminam em 'todos': " + nomes.join(" | "));
  ok(/prova em \d+ dias/.test(fichas()[0].textContent), "D2 a ficha diz quanto falta para a prova: " + fichas()[0].textContent);
  ok(cls(fichas()[1], "sel") && !cls(fichas()[0], "sel"), "D3 vem marcado o edital gravado no topico do cartao (TCE-PE), mesmo o topico estando nos dois");

  /* ---- 2: disciplina › tópico ---- */
  const discs = () => Array.from(a.$("gerDestLista").children).filter((e) => /(^| )ger-dest-disc( |$)/.test(e.className || ""));
  const itens = () => achar(a.$("gerDestLista"), (e) => cls(e, "ger-dest-item"));
  ok(discs().length === 1 && /Direito Financeiro/.test(discs()[0].textContent) && cls(discs()[0], "aberta"), "D4 no TCE-PE so ha Direito Financeiro, ja aberta");
  ok(itens().some((b) => /Receita Pública/.test(b.textContent) && b.disabled && /está aqui/.test(b.textContent)) && itens().some((b) => /Créditos Adicionais/.test(b.textContent)),
    "D5 os topicos aparecem como linhas; o do cartao esta desligado ('esta aqui')");
  fichas()[0].onclick();
  ok(discs().length === 2 && discs().every((d) => !cls(d, "aberta") || /Direito Financeiro/.test(d.textContent)), "D6 no ISS: duas disciplinas; so a do cartao aberta");
  const stb = discs().find((d) => /Sistema Tributário/.test(d.textContent));
  ok(!itens().some((b) => /IPTU/.test(b.textContent)), "D7 disciplina fechada nao mostra os topicos");
  stb.onclick();
  ok(itens().some((b) => /IPTU/.test(b.textContent)), "D8 abrir a disciplina mostra os topicos");

  /* ---- 4: busca, todos, Bancada ---- */
  a.$("gerDestBusca").value = "crédit"; a.$("gerDestBusca").oninput();
  ok(itens().length === 0, "D9 a busca respeita a ficha marcada (no ISS nao ha 'Créditos')");
  fichas().find((f) => /todos/.test(f.textContent)).onclick();
  ok(itens().length === 1 && /Créditos Adicionais/.test(itens()[0].textContent) && /TCE-PE/.test(a.$("gerDestLista").textContent), "D10 em 'todos' a busca acha, com o cabecalho do edital");
  a.$("gerDestBusca").value = ""; a.$("gerDestBusca").oninput();
  ok(a.$("btnGerDestBancada").hidden === false && !itens().some((b) => /Texto do editor|Bancada/.test(b.textContent)), "D11 a Bancada saiu da lista e virou botao do rodape");
  await conduzir(a, a.$("btnGerDestBancada").onclick());
  ok(a.gerNotasAtual().some((x) => /Receita 0/.test(x.card.front) && a.cqEhBancada(x.chave)), "D12 o botao da Bancada move o cartao para la");

  /* ---- textos ---- */
  ["ger_dest_prova_em", "ger_dest_prova_hoje", "ger_dest_prova_foi", "ger_dest_prova_sem", "ger_dest_todos", "ger_dest_n", "ger_dest_ntop", "ger_dest_nramos", "ger_dest_ramos_tip", "ger_dest_vazio", "ger_dest_bancada", "ger_dest_bancada_tip", "ger_dest_eds_tip"].forEach((ch) => {
    ["pt", "en"].forEach((lg) => { a.setLanguage(lg); ok(a.t(ch) && a.t(ch) !== ch, "I1 falta " + ch + " em " + lg); });
  });
  a.setLanguage("pt");

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
