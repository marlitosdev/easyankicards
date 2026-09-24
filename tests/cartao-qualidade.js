/* =====================================================================
 * RADAR DE REPETIÇÃO DOS CARTÕES (16.70.0)
 *
 * O que originou: num baralho real de 955 notas, 62% dos cartões básicos
 * eram paráfrases uns dos outros e 112 cartões de lacuna cobriam só 14
 * frases. O app só sabia achar frente IDÊNTICA dentro de um texto.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Paráfrases (frentes com quase as mesmas palavras) formam grupo; perguntas
 *     de assuntos diferentes não; a mesma frase de lacuna com outra palavra
 *     escondida é o mesmo cartão.
 *  2. Sugere ficar o cartão mais completo (resposta longa, artigo, literalidade).
 *  3. Mesclar acrescenta ao que fica só o que os outros sabiam a mais — e não
 *     duplica o que ele já tem. Se o cartão que fica não é achado, NADA é apagado.
 *  4. Os que saem vão para a lixeira, de qualquer tópico, e voltam de lá.
 *  5. "Não é repetido" esconde o grupo sem apagar nada e dá para reexibir.
 *  6. A tela conta, mostra os grupos, pergunta antes e atualiza depois.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");

  const B = (f, v, extra) => Object.assign({ kind: "basic", front: f, back: v, more: "" }, extra);
  const CARTOES = [
    B("Qual o prazo de recolhimento do ISS retido pelo tomador?", "Até o dia 09 do mês seguinte"),            // 0
    B("Qual o fato gerador do ISS?", "A prestação de serviço da lista anexa"),                                // 1
    B("Qual o prazo para recolhimento do ISS retido pelo tomador do serviço?", "Dia 09 do mês seguinte ao da retenção, conforme o art. 40", { more: "Literalidade — Art. 40, §2º" }), // 2
    B("Quem é o devedor contumaz no ISS?", "Quem deixa de pagar de forma reiterada"),                        // 3
    B("Prazo de recolhimento do ISS retido pelo tomador", "Até o dia 09"),                                    // 4
    B("Quem é considerado devedor contumaz do ISS?", "O contribuinte com inadimplência reiterada e substancial"), // 5
    { kind: "cloze", front: "O ISS é de competência {{c1::municipal}}.", back: "", more: "" },                // 6
    { kind: "cloze", front: "O ISS é de {{c1::competência}} municipal.", back: "", more: "" },                // 7
    B("Qual a alíquota máxima do ISS?", "5% sobre o preço do serviço"),                                       // 8
    B("Qual o limite da alíquota do ISS?", "5% sobre o preço do serviço"),                                    // 9
    B("Como se dá a decadência do crédito tributário em Caruaru?", "Em cinco anos contados do fato gerador"), // 10
  ];

  const { api } = rodar();

  /* ---- Q1: quem forma grupo ---- */
  {
    const g = api.cqAgrupar(CARTOES).map((x) => x.slice().sort((a, b) => a - b).join(","));
    ok(g.indexOf("0,2,4") >= 0, `Q1 as tres paráfrases do prazo nao formaram um grupo: ${JSON.stringify(g)}`);
    ok(g.indexOf("3,5") >= 0, `Q1a devedor contumaz nao agrupou: ${JSON.stringify(g)}`);
    ok(g.indexOf("6,7") >= 0, `Q1b a mesma frase de lacuna com outra palavra escondida nao agrupou: ${JSON.stringify(g)}`);
    ok(g.indexOf("8,9") >= 0, `Q1c frente parecida + resposta igual nao agrupou: ${JSON.stringify(g)}`);
    ok(g.every((x) => x.split(",").indexOf("1") < 0 && x.split(",").indexOf("10") < 0), `Q1d pergunta de outro assunto entrou num grupo: ${JSON.stringify(g)}`);
    ok(g[0] === "0,2,4", `Q1e o maior grupo devia vir primeiro: ${JSON.stringify(g)}`);
    ok(api.cqAgrupar([]).length === 0 && api.cqAgrupar([B("a", "b")]).length === 0, "Q1f sem cartoes ou com um so' nao ha grupo");
    /* frentes sem palavra util (curtas demais) so' se juntam se forem IDENTICAS */
    const curtos = api.cqAgrupar([B("A B", "x"), B("A B", "y"), B("A C", "z")]);
    ok(curtos.length === 1 && curtos[0].join(",") === "0,1", `Q1h frentes curtas identicas devem agrupar (e so' elas): ${JSON.stringify(curtos)}`);
    /* a dica dentro da lacuna nao conta como palavra da frase */
    const dica = api.cqAgrupar([
      { kind: "cloze", front: "A multa moratória é de {{c1::vinte::entre dez, quinze ou trinta por cento?}} do valor", back: "" },
      { kind: "cloze", front: "A multa moratória é de {{c1::vinte}} do valor", back: "" }]);
    ok(dica.length === 1, `Q1i a dica da lacuna atrapalhou o agrupamento: ${JSON.stringify(dica)}`);
    /* palavras que estao em quase todos os cartoes nao aproximam ninguem */
    const muitos = [];
    for (let i = 0; i < 100; i++) muitos.push(B(`Assunto${i} lei imposto tributo municipal regra`, "resp" + i));
    ok(api.cqAgrupar(muitos).length === 0, "Q1g palavras comuns a todos os cartoes juntaram cartoes que nada tem a ver");
  }

  /* ---- Q2: o mais completo ---- */
  {
    ok(api.cqMelhor(CARTOES, [0, 2, 4]) === 2, "Q2 devia sugerir o cartao com artigo, resposta longa e literalidade");
    ok(api.cqMelhor(CARTOES, [8, 9]) === 8, "Q2a empate fica com o mais antigo");
    ok(api.cqPontuar(CARTOES[2]) > api.cqPontuar(CARTOES[0]), "Q2b a pontuacao nao premia artigo e literalidade");
    ok(api.cqPontuar(B("P", "Prazo, art. 5º")) > api.cqPontuar(B("P", "Prazo, lei bem")), "Q2c com o mesmo tamanho, citar o artigo devia pontuar mais");
  }

  /* ---- Q3: o que os outros sabem a mais ---- */
  {
    const fica = B("P?", "Resposta A completa sobre o tema X", { more: "Exemplo — caso Y" });
    const outro = B("P?", "Resposta totalmente diferente sobre Z", { more: "Exemplo — caso Y<br>Exceção — regra W" });
    const a = api.cqAcrescimos(fica, outro);
    ok(a.indexOf("+ Também cobrado — Resposta totalmente diferente sobre Z") >= 0, `Q3 a resposta diferente nao foi acrescentada: ${JSON.stringify(a)}`);
    ok(a.indexOf("+ Exceção — regra W") >= 0, `Q3a a linha nova do saiba mais nao foi acrescentada: ${JSON.stringify(a)}`);
    ok(!a.some((l) => /caso Y/.test(l)), `Q3b duplicou linha que o cartao ja tem: ${JSON.stringify(a)}`);
    const igual = api.cqAcrescimos(fica, B("P?", "Resposta A completa sobre o tema X"));
    ok(igual.length === 0, `Q3c resposta que nao acrescenta nada foi acrescentada: ${JSON.stringify(igual)}`);
    const sujo = api.cqAcrescimos(fica, B("P?", "com :: dois pontos\ne quebra", {}));
    ok(sujo.every((l) => !/::|\n/.test(l)), `Q3d o :: ou a quebra de linha vazou para o material: ${JSON.stringify(sujo)}`);
  }

  /* ---- Q4: inserir o saiba mais no lugar certo ---- */
  {
    const bruto = "@ T\nP1 :: R1\n+ um\n+ dois\n\nP2 :: R2";
    const c = { raw: "P1 :: R1", line: 2 };
    ok(api.cqInserirSaibaMais(bruto, c, ["+ novo"]) === "@ T\nP1 :: R1\n+ um\n+ dois\n+ novo\n\nP2 :: R2", "Q4 nao inseriu depois do saiba mais que o cartao ja tinha");
    ok(api.cqInserirSaibaMais(bruto, { raw: "P1 :: R1", line: 9 }, ["+ novo"]).indexOf("+ dois\n+ novo") > 0, "Q4a com o numero da linha desatualizado devia achar pelo texto");
    ok(api.cqInserirSaibaMais(bruto, { raw: "nao existe :: x", line: 1 }, ["+ novo"]) === null, "Q4b cartao que nao existe devia dar null");
    ok(api.cqInserirSaibaMais(bruto, c, []) === bruto, "Q4c sem linhas novas o texto nao muda");
  }

  /* ---- Q5: biblioteca, relatorio, resolver (de verdade, entre topicos) ---- */
  const montar = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const c1 = a.matChave("Tributário", "ISS retenção"), c2 = a.matChave("Tributário", "ISS geral");
    a.matGravarCartoes(c1, [
      "@ Trilha", "Qual o prazo de recolhimento do ISS retido pelo tomador? :: Até o dia 09 do mês seguinte :: x",
      "+ Exemplo — retenção", "", "Qual o fato gerador do ISS? :: A prestação de serviço da lista :: x"].join("\n"),
      { disciplina: "Tributário", topico: "ISS retenção" });
    a.matGravarCartoes(c2, [
      "Qual o prazo para recolhimento do ISS retido pelo tomador do serviço? :: Dia 09 do mês seguinte ao da retenção, conforme o art. 40 :: x",
      "+ Literalidade — Art. 40, §2º",
      "Prazo de recolhimento do ISS retido pelo tomador :: Até o dia 09 :: x"].join("\n"),
      { disciplina: "Tributário", topico: "ISS geral" });
    return { a, c1, c2 };
  };
  {
    const { a } = montar();
    const notas = a.cqLerBiblioteca();
    ok(notas.length === 4 && notas.every((x) => x.chave && x.card && x.card.raw), `Q5 a biblioteca devia ter 4 cartoes com origem: ${notas.length}`);
    const rel = a.cqRelatorio(notas);
    ok(rel.total === 4 && rel.grupos.length === 1 && rel.grupos[0].itens.length === 3 && rel.redundantes === 2 && rel.pct === 50,
       `Q5a relatorio errado: ${JSON.stringify({ t: rel.total, g: rel.grupos.length, r: rel.redundantes, p: rel.pct })}`);
    const melhor = notas[rel.grupos[0].melhor];
    ok(melhor.topico === "ISS geral" && /art\. 40/.test(melhor.card.back), "Q5b o sugerido devia ser o cartao com o artigo (do outro topico)");
    ok(a.cqAssinatura(notas, rel.grupos[0].itens) === a.cqAssinatura(notas, rel.grupos[0].itens.slice().reverse()), "Q5c a assinatura do grupo depende da ordem");
  }
  {
    /* mesclar: o que fica ganha o que os outros sabiam; os outros vao para a lixeira, de ambos os topicos */
    const { a, c1, c2 } = montar();
    const notas = a.cqLerBiblioteca();
    const g = a.cqRelatorio(notas).grupos[0];
    const r = a.cqResolverGrupo(notas, g.itens, g.melhor, true);
    ok(r.removidos === 2 && r.mesclados >= 1, `Q5d devia remover 2 e mesclar ao menos 1: ${JSON.stringify(r)}`);
    const t1 = a.matResumosAtual()[c1].cartoes, t2 = a.matResumosAtual()[c2].cartoes;
    ok(!/prazo de recolhimento do ISS retido/i.test(t1) && /fato gerador/.test(t1), `Q5e o cartao repetido nao saiu do primeiro topico (ou saiu o errado): ${JSON.stringify(t1)}`);
    ok(!/@ Trilha/.test(t1) && !/Exemplo — retenção/.test(t1) && /^Qual o fato gerador/.test(t1), `Q5f o titulo e o + do cartao que saiu ficaram orfaos: ${JSON.stringify(t1)}`);
    ok(/conforme o art\. 40/.test(t2) && /\+ Literalidade — Art\. 40/.test(t2) && /\+ Exemplo — retenção/.test(t2) && !/Também cobrado/.test(t2) && r.mesclados === 1,
       `Q5g o cartao que ficou nao ganhou o saiba mais dos outros: ${JSON.stringify(t2)}`);
    ok(!/\nPrazo de recolhimento do ISS retido pelo tomador ::/.test("\n" + t2), `Q5h o terceiro cartao nao saiu do segundo topico: ${JSON.stringify(t2)}`);
    const lix = a.lixLer();
    ok(lix.length === 2 && lix.every((x) => x.tipo === "cartao" && x.via === "material"), `Q5i os dois removidos deviam estar na lixeira: ${lix.length}`);
    /* restaurar um deles devolve no lugar */
    const rest = a.lixRestaurar(lix[0].id);
    ok(rest.ok === true, "Q5j restaurar da lixeira falhou");
    ok(a.cqRelatorio(a.cqLerBiblioteca()).total === 3, "Q5k depois de restaurar um, a biblioteca devia ter 3 cartoes");
  }
  {
    /* sem mesclar: so remove; e se o cartao que fica nao for achado, com mesclar NADA e apagado */
    const { a, c1 } = montar();
    const notas = a.cqLerBiblioteca();
    const g = a.cqRelatorio(notas).grupos[0];
    const antes = JSON.stringify(a.matResumosAtual());
    const fantasma = notas.map((x, i) => (i === g.melhor ? Object.assign({}, x, { card: Object.assign({}, x.card, { raw: "sumiu :: do texto", line: 99 }) }) : x));
    /* o "fica" com texto que nao existe mais so' e' problema se ha algo a mesclar (ha) */
    const r = a.cqResolverGrupo(fantasma, g.itens, g.melhor, true);
    ok(r.erro === "mesclar" && r.removidos === 0 && JSON.stringify(a.matResumosAtual()) === antes && a.lixLer().length === 0,
       `Q5l cartao que fica nao achado: devia parar sem apagar nada: ${JSON.stringify(r)}`);
    const s = a.cqResolverGrupo(notas, g.itens, g.melhor, false);
    ok(s.removidos === 2 && s.mesclados === 0, `Q5m sem mesclar devia so remover: ${JSON.stringify(s)}`);
    ok(!/Também cobrado/.test(JSON.stringify(a.matResumosAtual())), "Q5n sem mesclar nao devia acrescentar nada");
  }

  /* ---- Q6: nao e repetido ---- */
  {
    const { a } = montar();
    a.cqReexibirIgnorados();
    a.cqCalcular();
    ok(a.cqRelAtual().grupos.length === 1, "Q6 devia haver 1 grupo");
    const notas = a.cqNotasAtual();
    a.cqIgnorar(a.cqAssinatura(notas, a.cqRelAtual().grupos[0].itens));
    a.cqCalcular();
    ok(a.cqRelAtual().grupos.length === 0 && a.cqRelAtual().ocultos === 1 && a.cqRelAtual().redundantes === 0, "Q6a o grupo ignorado devia sumir do relatorio e contar como oculto");
    ok(a.cqIgnorados().size === 1, "Q6b o ignorado devia ficar guardado");
    a.cqReexibirIgnorados(); a.cqCalcular();
    ok(a.cqRelAtual().grupos.length === 1, "Q6c reexibir devia trazer o grupo de volta");
    /* se o grupo muda (um cartao a mais), a decisao antiga nao vale */
    a.cqIgnorar(a.cqAssinatura(a.cqNotasAtual(), a.cqRelAtual().grupos[0].itens));
    const c1 = a.matChave("Tributário", "ISS retenção");
    a.matGravarCartoes(c1, a.matResumosAtual()[c1].cartoes + "\nPrazo do recolhimento do ISS retido pelo tomador de serviço :: Dia 09 :: x", { disciplina: "Tributário", topico: "ISS retenção" });
    a.cqCalcular();
    ok(a.cqRelAtual().grupos.length === 1 && a.cqRelAtual().grupos[0].itens.length === 4, "Q6d grupo que cresceu devia reaparecer");
    a.cqReexibirIgnorados();
  }

  /* ---- Q7: a tela ---- */
  {
    const { a, c2 } = montar();
    a.cqReexibirIgnorados();
    a.cqAbrir();
    ok(a.$("dlgCartRep").open === true, "Q7 a janela nao abriu");
    ok(/4 cartões lidos · 1 grupos de parecidos · 2 a mais \(50%\)/.test(a.$("cqResumo").textContent), `Q7a resumo errado: ${a.$("cqResumo").textContent}`);
    const grupos = achar(a.$("cqLista"), (e) => cls(e, "cq-grupo"));
    ok(grupos.length === 1, `Q7b devia desenhar 1 grupo: ${grupos.length}`);
    const itens = achar(a.$("cqLista"), (e) => cls(e, "cq-item"));
    ok(itens.length === 3 && itens.filter((e) => cls(e, "cq-sugerido")).length === 1, "Q7c 3 cartoes no grupo, um so' sugerido");
    ok(/★/.test(achar(itens.filter((e) => cls(e, "cq-sugerido"))[0], (e) => cls(e, "cq-f"))[0].textContent), "Q7d o sugerido devia ter a estrela");
    ok(a.$("btnCqTudo").hidden === false && a.$("btnCqMais").hidden === true && a.$("btnCqReexibir").hidden === true, "Q7e botoes: resolver todos sim, mostrar mais e reexibir nao");

    /* recusar a pergunta nao mexe em nada */
    const antes = JSON.stringify(a.matResumosAtual());
    const btnMesclar = achar(grupos[0], (e) => e.tag === "button" && /mesclar/.test(e.textContent))[0];
    const p = btnMesclar.onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
    await p;
    ok(JSON.stringify(a.matResumosAtual()) === antes && a.lixLer().length === 0, "Q7f dizer NAO na pergunta nao devia mexer em nada");

    /* confirmar mescla e atualiza a tela */
    const p2 = btnMesclar.onclick();
    await conduzir(a, p2);
    ok(a.lixLer().length === 2, `Q7g confirmar devia mandar 2 para a lixeira: ${a.lixLer().length}`);
    ok(/2 cartões lidos · 0 grupos/.test(a.$("cqResumo").textContent) && achar(a.$("cqLista"), (e) => /Nenhum grupo/.test(e.textContent || "")).length === 1,
       `Q7h a tela nao atualizou depois de resolver: ${a.$("cqResumo").textContent}`);
    ok(/Literalidade — Art\. 40/.test(a.matResumosAtual()[c2].cartoes), "Q7i o cartao que ficou perdeu a literalidade");
    ok(/\+ Exemplo — retenção/.test(a.matResumosAtual()[c2].cartoes), "Q7i2 'mesclar no mais completo' nao juntou o que o outro tinha a mais");
  }
  {
    /* "manter so este" num cartao que NAO e o sugerido, e "resolver todos" */
    const { a, c1, c2 } = montar();
    a.cqReexibirIgnorados();
    a.cqAbrir();
    const grupos = achar(a.$("cqLista"), (e) => cls(e, "cq-grupo"));
    const nao = achar(grupos[0], (e) => cls(e, "cq-item") && !cls(e, "cq-sugerido"))[0];
    const bt = achar(nao, (e) => e.tag === "button")[0];
    await conduzir(a, bt.onclick());
    const t2 = a.matResumosAtual()[c2].cartoes, t1 = a.matResumosAtual()[c1].cartoes;
    ok((t1 + t2).split("\n").filter((l) => /recolhimento do ISS retido/i.test(l) && /::/.test(l)).length === 1, `Q7j manter so' este devia deixar exatamente 1 dos 3: ${t1} / ${t2}`);
    ok(a.lixLer().length === 2, "Q7k os outros dois deviam ir para a lixeira");
    ok(!/Literalidade/.test(t1 + t2) && !/Também cobrado/.test(t1 + t2), "Q7l 'manter so este' nao mescla: a literalidade do que saiu nao devia aparecer no que ficou");

    const m = montar();
    m.a.cqReexibirIgnorados();
    m.a.cqAbrir();
    const antesTudo = JSON.stringify(m.a.matResumosAtual());
    const pn = m.a.$("btnCqTudo").onclick();
    for (let i = 0; i < 6; i++) { await Promise.resolve(); m.a.uiModalResponder(false); }
    await pn;
    ok(JSON.stringify(m.a.matResumosAtual()) === antesTudo && m.a.lixLer().length === 0, "Q7m0 dizer NAO em 'resolver todos' nao devia mexer em nada");
    await conduzir(m.a, m.a.$("btnCqTudo").onclick());
    ok(m.a.lixLer().length === 2 && /2 cartões lidos · 0 grupos/.test(m.a.$("cqResumo").textContent), `Q7m resolver todos: ${m.a.lixLer().length} / ${m.a.$("cqResumo").textContent}`);
    ok(/\+ Exemplo — retenção/.test(m.a.matResumosAtual()[m.c2].cartoes), "Q7n 'resolver todos' devia mesclar (nao so apagar)");
  }
  {
    /* biblioteca vazia e sem repeticao */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    a.cqAbrir();
    ok(/Ainda não há cartões/.test(a.$("cqResumo").textContent), `Q8 biblioteca vazia: ${a.$("cqResumo").textContent}`);
    const c = a.matChave("D", "T");
    a.matGravarCartoes(c, "Qual o fato gerador do ISS? :: Serviço\nQuem paga o IPTU? :: O proprietário", { disciplina: "D", topico: "T" });
    a.cqAbrir();
    ok(/2 cartões lidos · 0 grupos/.test(a.$("cqResumo").textContent), `Q8a sem repeticao: ${a.$("cqResumo").textContent}`);
    ok(a.$("btnCqTudo").hidden === true, "Q8b sem grupos nao devia oferecer resolver todos");
  }

  /* ---- Q10: o modulo esta no app e no cache offline ---- */
  {
    const fs = require("fs"), path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="cartao-qualidade\.js"><\/script>/.test(html) && /id="btnCartRepetidos"/.test(html) && /id="dlgCartRep"/.test(html), "Q10 falta o script, o botao ou a janela no index.html");
    ok(/"cartao-qualidade\.js"/.test(sw), "Q10a o modulo nao esta no cache offline (sw.js)");
  }

  /* ---- Q9: escala — milhares de cartoes sem comparar todos com todos ---- */
  {
    const muitos = [];
    for (let i = 0; i < 3000; i++) muitos.push(B(`Pergunta numero${i} sobre tema${i % 300} do assunto${i % 47} palavra${i * 7}`, "Resposta " + i));
    const t0 = Date.now();
    api.cqAgrupar(muitos);
    ok(Date.now() - t0 < 5000, `Q9 3000 cartoes levaram ${Date.now() - t0}ms`);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`cartao-qualidade: ok (${f.quantas} verificacoes)`);
  });
}
