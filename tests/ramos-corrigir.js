/* =====================================================================
 * PROBLEMAS NOS RAMOS E A CORREÇÃO PELA IA (v18.93.0) — o caso real de 19/10
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o app aponta ramo repetido, ramo quase igual, ramo que também é de um tópico vizinho e ramo com nome de tópico;
 *     ramos sãos não geram aviso;
 *  2. o editor de ramos mostra os problemas do tópico aberto (e esconde o quadro sem problema), repintando ao mudar;
 *  3. "Pedir correção à IA" copia um pedido com os ramos atuais (com peso e nota), os dos tópicos vizinhos e os
 *     problemas — e o pedido colado de volta por engano é reconhecido como pedido, não como lista;
 *  4. a lista corrigida volta pelo caminho de sempre: pergunta (substituir/acrescentar) e só vale ao salvar.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const tique = () => new Promise((r) => setImmediate(r));
  const NL = String.fromCharCode(10);
  /* recorte do edital real (ISS, 19/10): ramos de "Crédito tributário" repetidos em "Suspensão, extinção e exclusão…" */
  const ED = ["# ISS | prova: 2027-06-01 | horas: 20", "@ Tributário :: 5",
    "+ Crédito tributário :: 5",
    "++ Constituição do crédito tributário :: 5", "++ Extinção do crédito tributário :: 4", "++ Exclusão do crédito tributário :: 4",
    "++ Decadência e prescrição :: 5", "++ Decadência e prescrição :: 3", "++ Garantias e privilégios do crédito :: 3",
    "+ Suspensão, extinção e exclusão do crédito tributário :: 5",
    "++ Suspensão da exigibilidade :: 5", "++ Extinção do crédito :: 4", "++ Exclusão do crédito :: 4", "++ Decadência e prescrição :: 5",
    "+ Lançamento :: 5", "++ Lançamento de ofício :: 5", "++ Lançamento por declaração :: 4",
    "@ Financeiro :: 3", "+ Receita pública :: 3", "++ Decadência e prescrição :: 2"].join(NL);

  /* ---- 1: o detector ---- */
  {
    const { api: a } = rodar();
    const ps = a.ramProblemas(ED, "Tributário", "Crédito tributário");
    const de = (tipo) => ps.filter((p) => p.tipo === tipo);
    ok(de("repetido_texto").length === 1 && de("repetido_texto")[0].ramo === "Decadência e prescrição" && de("repetido_texto")[0].n === 2,
      "C1 a linha '++' escrita duas vezes no tópico (o leitor guarda uma só) é 'repetido no texto', com quantas vezes: " + JSON.stringify(ps));
    ok(!a.ramProblemas(ED, "Tributário", "Suspensão, extinção e exclusão do crédito tributário").some((p) => p.tipo === "repetido_texto")
      && !a.ramProblemas(ED, "Financeiro", "Receita pública").some((p) => p.tipo === "repetido_texto"), "C1k a repetição é só do tópico em que ela está (não vaza para o vizinho)");
    const tres = a.ramProblemas(ED.replace("++ Garantias", "++ Decadência e prescrição :: 1" + NL + "++ Garantias"), "Tributário", "Crédito tributário").find((p) => p.tipo === "repetido_texto");
    ok(tres && tres.n === 3, "C1l escrita três vezes: diz 3");
    ok(!a.ramProblemas(ED, "Tributário", "Crédito tributário", ["Constituição do crédito tributário"]).some((p) => p.tipo === "repetido_texto"), "C1n tirado da lista no editor, o aviso de repetido no texto some");
    const dig = a.ramProblemas(ED, "Tributário", "Lançamento", ["Lançamento de ofício", "lancamento de oficio"]);
    ok(dig.length === 1 && dig[0].tipo === "repetido", "C1m digitado duas vezes no editor (mesmo nome sem acento): 'repetido'");
    const fora = de("outro_topico");
    ok(fora.some((p) => p.ramo === "Extinção do crédito tributário" && p.topico === "Suspensão, extinção e exclusão do crédito tributário" && p.outro === "Extinção do crédito"),
      "C1a 'Extinção do crédito tributário' também é ramo do tópico vizinho (lá: 'Extinção do crédito'): " + JSON.stringify(fora));
    ok(fora.some((p) => p.ramo === "Decadência e prescrição") && fora.filter((p) => p.ramo === "Decadência e prescrição").length === 1,
      "C1b o ramo repetido no tópico aparece UMA vez como 'em outro tópico' (sem duplicar o aviso)");
    ok(!fora.some((p) => p.topico === "Receita pública"), "C1c ramo de OUTRA disciplina não conta (só os vizinhos da mesma disciplina)");
    ok(!ps.some((p) => p.ramo === "Constituição do crédito tributário" || p.ramo === "Garantias e privilégios do crédito"), "C1d ramos sãos não geram aviso: " + JSON.stringify(ps.map((p) => p.ramo)));
    ok(!ps.some((p) => p.tipo === "nome_de_topico"),
      "C1o ramo que CONTÉM o nome de um tópico vizinho ('Extinção do crédito tributário' ⊂ 'Suspensão, extinção e exclusão do crédito tributário') não é 'nome de tópico': " + JSON.stringify(ps.filter((p) => p.tipo === "nome_de_topico")));
    const ED2 = ED.replace("++ Decadência e prescrição :: 5" + NL + "+ Lançamento", "++ Decadência e prescrição :: 5" + NL + "++ Decadência e prescrição :: 1" + NL + "+ Lançamento");
    const rc = a.ramProblemas(ED2, "Tributário", "Crédito tributário").find((p) => p.tipo === "repetido_texto");
    const rs = a.ramProblemas(ED2, "Tributário", "Suspensão, extinção e exclusão do crédito tributário").find((p) => p.tipo === "repetido_texto");
    ok(rc && rc.n === 2 && rs && rs.n === 2, "C1p o mesmo ramo repetido em dois tópicos: cada um conta só as linhas dele (2 e 2): " + JSON.stringify([rc, rs]));
    /* o caso real: em "Sistema Tributário Brasileiro", "tributo" está em todo nome e não diz nada */
    const ED3 = ["# X | prova: 2027-06-01", "@ Sistema Tributário Brasileiro :: 5", "+ Tributos e suas espécies :: 5", "++ Conceito de Tributo :: 5", "++ Taxas :: 4",
      "+ Crédito tributário :: 5", "++ Conceito, constituição e lançamento tributário :: 5", "+ Suspensão do crédito :: 4", "++ Suspensão da exigibilidade :: 5", "++ Moratória e parcelamento :: 3",
      "+ Outro :: 3", "++ Moratória e parcelamento :: 3", "++ Moratória e parcelamento tributário :: 2"].join(NL);
    ok(a.ramProblemas(ED3, "Sistema Tributário Brasileiro", "Tributos e suas espécies").length === 0,
      "C1q radical do nome da disciplina não conta: 'Conceito de Tributo' não é 'Conceito, constituição e lançamento tributário': " + JSON.stringify(a.ramProblemas(ED3, "Sistema Tributário Brasileiro", "Tributos e suas espécies")));
    const um = a.ramProblemas(ED3, "Sistema Tributário Brasileiro", "Suspensão do crédito").filter((p) => p.tipo === "outro_topico");
    ok(um.length === 1 && um[0].ramo === "Moratória e parcelamento" && um[0].topico === "Outro", "C1r um aviso por ramo e tópico vizinho (dois ramos parecidos lá = um aviso só): " + JSON.stringify(um));
    ok(a.ramProblemas(ED3, "Sistema Tributário Brasileiro", "Outro").some((p) => p.tipo === "parecido"), "C1s 'Moratória e parcelamento' × '… tributário' no mesmo tópico: parecido (o radical da disciplina some, ficam iguais)");
    ok(a.ramProblemas(ED, "Tributário", "Lançamento").length === 0, "C1e tópico com ramos sãos: nenhum problema");
    const par = a.ramProblemas(ED, "Tributário", "Lançamento", ["Lançamento de ofício", "Lançamentos de ofício"]);
    ok(par.length === 1 && par[0].tipo === "parecido", "C1f quase iguais (os mesmos radicais) são 'parecido': " + JSON.stringify(par));
    const nt = a.ramProblemas(ED, "Tributário", "Lançamento", ["Crédito tributário"]);
    ok(nt.some((p) => p.tipo === "nome_de_topico" && p.topico === "Crédito tributário"), "C1g ramo com o nome de outro tópico: " + JSON.stringify(nt));
    ok(a.ramSemelhanca("Extinção do crédito", "Extinção do crédito tributário") >= 0.75 && a.ramSemelhanca("Lançamento de ofício", "Lançamento por declaração") < 0.75
      && a.ramSemelhanca("Decadência", "decadencia") === 1, "C1h semelhança: mesmo nome sem acento = 1; nomes só com uma palavra em comum ficam abaixo do corte");
    ok(a.ramProblemas("", "X", "Y").length === 0, "C1i edital vazio: nada (sem erro)");
    ok(ps.every((p) => a.ramProblemaTexto(p).indexOf(p.ramo) >= 0), "C1j cada aviso diz o nome do ramo");
  }

  /* ---- 2 e 3: no editor, e o pedido ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.edIniciar();
    const ed = a.edCriar("ISS", ED);
    const ctx = { editalId: ed.id, disciplina: "Tributário", topico: "Crédito tributário", chave: a.matChave("Tributário", "Crédito tributário") };
    a.ramAbrirEditor(ctx);
    ok(a.$("ramProblemas").hidden === false && a.$("ramProblemasLista").children.length >= 3, "C2 o editor do tópico com problema mostra o quadro: " + a.$("ramProblemasLista").children.length);
    ok(a.$("ramProblemasTit").textContent === a.t("ram_prob_tit", { n: a.ramProblemas(ED, "Tributário", "Crédito tributário").length }), "C2a o título conta os problemas");
    const pedido = await a.$("btnRamCorrigirIA").onclick();
    const copiado = await a.navegador.clipboard.readText();
    ok(copiado === pedido && /Crédito tributário/.test(pedido) && /\+\+ Decadência e prescrição :: 5/.test(pedido) && /\+\+ Garantias e privilégios do crédito :: 3/.test(pedido),
      "C3 o pedido é copiado com os ramos atuais (nome :: peso)");
    ok(/Suspensão, extinção e exclusão do crédito tributário: Suspensão da exigibilidade; Extinção do crédito/.test(pedido) && pedido.indexOf("Receita pública") < 0,
      "C3a leva os tópicos vizinhos COM os ramos deles (e não os de outra disciplina)");
    ok(pedido.indexOf(a.t("ram_prob_repetido_texto", { r: "Decadência e prescrição", n: 2 })) >= 0 && /também é ramo de/.test(pedido), "C3b leva os problemas encontrados");
    ok(a.$("ramProblemasMsg").textContent === a.t("ram_corr_copiado") && a.$("ramCaminhos").open === true && a.$("ramIaBox").className === "ednovo-passo ativo",
      "C3c avisa ao lado do botão e abre o passo 2 (colar a resposta)");
    ok(a.ramEhPedido(pedido), "C3d o pedido colado de volta por engano é reconhecido como PEDIDO");
    ok(pedido.split(NL).length > 10 && pedido.indexOf("\\n") < 0, "C3e o pedido tem quebras de linha de verdade (não '\\n' escrito)");
    /* a falha da cópia mostra o pedido na caixa */
    const orig = a.navegador.clipboard.writeText;
    a.navegador.clipboard.writeText = async () => { throw new Error("negado"); };
    await a.ramPedirCorrecaoIA();
    a.navegador.clipboard.writeText = orig;
    ok(a.$("ramPedidoTxt").hidden === false && a.$("ramPedidoTxt").value === pedido && a.$("ramProblemasMsg").textContent === a.t("ram_ia_copie_manual"),
      "C3f sem a área de transferência: o pedido fica visível na caixa para copiar à mão");
    /* 4: a resposta corrigida volta pelo caminho de sempre */
    a.$("ramColar").value = ["++ Constituição do crédito tributário :: 5", "++ Garantias e privilégios do crédito :: 3", "++ Preferências do crédito :: 2"].join(NL);
    const p = a.$("btnRamConferir").onclick();
    await tique();
    ok(p && typeof p.then === "function" && a.$("uiModal").open === true, "C4 a lista corrigida deixa ramos de fora: pergunta substituir/acrescentar");
    a.uiModalResponder("substituir"); await p;
    ok(a.ramLinhasAtual().map((l) => l.nome).join(",") === "Constituição do crédito tributário,Garantias e privilégios do crédito,Preferências do crédito",
      "C4a substituir: fica a lista corrigida");
    ok(a.$("ramProblemas").hidden === true, "C4b sem problema na lista nova, o quadro some (repinta ao mudar a lista)");
    ok(a.edRamosDoTopico(ed.texto, "Tributário", "Crédito tributário").length === 5 && /Decadência e prescrição :: 3/.test(ed.texto), "C4c nada gravado antes de salvar");
    a.ramSalvar();
    const txt = ed.texto;
    ok(txt && a.edRamosDoTopico(txt, "Tributário", "Crédito tributário").length === 3, "C4d salvo: o edital passa a ter os 3 ramos corrigidos");
    /* tópico sem problema: quadro escondido; o pedido diz que nada foi achado */
    a.ramAbrirEditor({ editalId: ed.id, disciplina: "Tributário", topico: "Lançamento", chave: a.matChave("Tributário", "Lançamento") });
    ok(a.$("ramProblemas").hidden === true, "C5 tópico sem problema: quadro escondido");
    const ped2 = a.ramPedidoCorrecao(a.ramCtxAtual(), a.ramLinhasAtual());
    ok(ped2.indexOf(a.t("ram_corr_sem_prob")) >= 0, "C5a o pedido sem problema achado diz isso (e pede revisão mesmo assim)");
  }
  return falhas;
}

module.exports = { testes };
