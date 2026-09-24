/* =====================================================================
 * CONFERIR LADO A LADO — o texto gravado e o colado, inteiros, linha a linha
 *
 * O PEDIDO. Depois de colar a EC 132 sobre o registro dela mesma, o app dizia só "Nenhuma diferença…"
 * num aviso que sumia — sem mostrar os textos, sem explicar, sem deixar rastro no registro. O usuário pediu
 * uma sistemática que MOSTRE o texto antigo e o novo, com o que mudou em destaque (ou explique que são
 * iguais), lado a lado, linha a linha.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. leiDiffLinhas alinha as linhas: igual / mudou / so_antigo / so_novo, com o número ORIGINAL de cada
 *     linha; aspas, travessão e espaço de sobra NÃO são alteração (só formato); linhas em branco não contam.
 *  2. É rápida: a Constituição inteira (10 mil linhas) contra uma emenda (1,3 mil) não pode travar.
 *  3. A tela mostra as duas colunas, marca as palavras alteradas, explica quando são iguais, navega entre
 *     as diferenças, filtra "só o que mudou" e registra no log como terminou.
 *  4. "Nenhuma diferença" abre o painel (não mais um aviso que some); o botão do Passo 1 abre com o
 *     texto colado; no modo "só alterações" ele explica por que não vale.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const p = iniciar();
  const tipos = (d) => d.linhas.map((l) => l.tipo).join(",");

  /* ---- 1: leiDiffLinhas ---- */
  {
    const base = "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Três.";
    let d = p.leiDiffLinhas(base, base);
    ok(d.mesmoTexto === true && d.resumo.iguais === 3 && tipos(d) === "igual,igual,igual", "D1 textos iguais: " + JSON.stringify(d.resumo));

    d = p.leiDiffLinhas(base, "Art. 1º Um.\nArt. 2º Dois, alterado agora.\nArt. 3º Três.");
    ok(tipos(d) === "igual,mudou,igual" && d.resumo.mudadas === 1 && !d.mesmoTexto, "D2 uma linha alterada vira 'mudou': " + tipos(d));
    ok(d.linhas[1].esq.n === 2 && d.linhas[1].dir.n === 2 && /Dois\.$/.test(d.linhas[1].esq.txt) && /alterado/.test(d.linhas[1].dir.txt),
      "D2a as duas pontas da linha alterada, com o numero original: " + JSON.stringify(d.linhas[1]));

    d = p.leiDiffLinhas(base, base + "\nArt. 4º Quatro.");
    ok(tipos(d) === "igual,igual,igual,so_novo" && d.linhas[3].esq === null && d.linhas[3].dir.n === 4 && d.mesmoTexto === false, "D3 linha so' no novo (e os textos NAO sao iguais): " + tipos(d));
    d = p.leiDiffLinhas(base, "Art. 1º Um.\nArt. 3º Três.");
    ok(tipos(d) === "igual,so_antigo,igual" && d.linhas[1].dir === null && d.linhas[1].esq.n === 2, "D4 linha so' no antigo: " + tipos(d));

    d = p.leiDiffLinhas("Art. 1º “A” — x  y.", "Art. 1º \"A\" - x y.");
    ok(d.mesmoTexto && d.resumo.soFormato === 1 && d.linhas[0].soFormato === true, "D5 aspas, travessao e espaco sao so' formato, nao alteracao: " + JSON.stringify(d.resumo));

    d = p.leiDiffLinhas("Art. 1º Um.\n\n\nArt. 2º Dois.", "Art. 1º Um.\nArt. 2º Dois.");
    ok(d.mesmoTexto && d.linhas[1].esq.n === 4, "D6 linhas em branco nao contam, mas o numero original da linha e' mantido: " + JSON.stringify(d.linhas[1]));

    d = p.leiDiffLinhas("", "Art. 1º Um.\nArt. 2º Dois.");
    ok(d.resumo.soNovo === 2 && d.resumo.soAntigo === 0, "D7 antigo vazio: tudo e' novo: " + JSON.stringify(d.resumo));
    d = p.leiDiffLinhas("Art. 1º Um.", "");
    ok(d.resumo.soAntigo === 1 && d.resumo.soNovo === 0, "D8 novo vazio: tudo e' so' do antigo: " + JSON.stringify(d.resumo));

    d = p.leiDiffLinhas("A um\nB dois\nC tres\nD quatro", "A um\nD quatro\nB dois\nC tres");
    ok(d.resumo.iguais >= 3 && !d.mesmoTexto, "D9 troca de ordem: acha o que ficou igual e marca o resto: " + tipos(d));

    d = p.leiDiffLinhas("a\nb\nc\nd", "a\nB novo\nX outro\nd");
    ok(d.linhas[0].tipo === "igual" && d.linhas[d.linhas.length - 1].tipo === "igual" && d.resumo.iguais === 2,
      "D10 prefixo e sufixo iguais ficam de fora do que mudou: " + tipos(d));
  }

  /* ---- 2: desempenho ---- */
  {
    const big = Array.from({ length: 10000 }, (_, i) => "Art. " + i + " texto do artigo " + i).join("\n");
    const peq = Array.from({ length: 1300 }, (_, i) => "Art. " + (i * 7) + " texto do artigo " + (i * 7)).join("\n");
    const t0 = Date.now();
    const d = p.leiDiffLinhas(big, peq);
    ok(Date.now() - t0 < 2000, "P1 10 mil x 1,3 mil linhas em menos de 2s: " + (Date.now() - t0) + "ms");
    ok(d.resumo.iguais === 1300 && d.resumo.soAntigo === 8700, "P1a acha as 1300 linhas em comum: " + JSON.stringify(d.resumo));
    const t1 = Date.now();
    const sem = p.leiDiffLinhas(Array.from({ length: 3000 }, (_, i) => "linha " + (i % 50)).join("\n"), Array.from({ length: 3000 }, (_, i) => "linha " + ((i * 3) % 50)).join("\n"));
    /* prefixo/sufixo comum: 3000 linhas repetidas, so' a primeira muda — sem ancora unica, so' o sufixo comum salva */
    const rep = Array.from({ length: 3000 }, () => "linha repetida igual");
    const rep2 = ["linha repetida diferente"].concat(rep.slice(1));
    const dr = p.leiDiffLinhas(rep.join("\n"), rep2.join("\n"));
    ok(dr.resumo.mudadas === 1 && dr.resumo.iguais === 2999, "P3 3000 linhas repetidas, so' a primeira muda: o sufixo comum resolve sem LCS gigante: " + JSON.stringify(dr.resumo));
    ok(Date.now() - t1 < 4000 && sem.linhas.length > 0, "P2 texto cheio de linhas repetidas (sem ancora) tambem termina: " + (Date.now() - t1) + "ms");
  }

  /* ---- 3: a tela ---- */
  {
    const api = iniciar();
    const base = "Art. 1º Um artigo.\nArt. 2º Dois artigos aqui.\nArt. 3º Terceiro artigo.";
    api.leiLadoAbrir(base, "Art. 1º Um artigo.\nArt. 2º Dois artigos alterados aqui.\nArt. 3º Terceiro artigo.\nArt. 4º Quarto.", "teste");
    ok(api.$("dlgLeiLado").open === true, "T1 o painel abre");
    const lins = api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin");
    ok(lins.length === 4, "T2 uma linha de tela por linha alinhada: " + lins.length);
    ok(cls(lins[1], "mudou") && cls(lins[3], "so_novo") && cls(lins[0], "igual"), "T2a as classes de cada tipo: " + lins.map((l) => l.className).join(" | "));
    const cel = lins[1].querySelectorAll(".lei-lado-cel");
    ok(cel.length === 2 && /^2/.test(cel[0].textContent) && /^2/.test(cel[1].textContent), "T3 duas colunas com o numero de cada linha: " + cel.map((c) => c.textContent).join(" | "));
    const marcas = lins[1].querySelectorAll("mark");
    ok(marcas.length >= 1 && marcas.some((m) => /alterados/.test(m.textContent)), "T4 as palavras alteradas ficam marcadas: " + marcas.map((m) => m.textContent).join(","));
    ok(/1 linha\(s\) alterada\(s\).*1 só no texto colado/.test(api.$("leiLadoResumo").textContent), "T5 o resumo conta certo: " + api.$("leiLadoResumo").textContent);

    /* navegacao */
    ok(api.$("leiLadoBarra").hidden === false && api.$("btnLeiLadoProx").disabled === false, "T6 a barra de navegacao aparece quando ha diferenca");
    api.leiLadoIr(1);
    ok(api.leiLadoCtxAtual().foco === 0 && cls(api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin")[1], "lei-lado-atual"), "T6a 'proxima' vai pra primeira diferenca e marca o foco");
    api.leiLadoIr(1);
    ok(api.leiLadoCtxAtual().foco === 1 && !cls(api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin")[1], "lei-lado-atual"), "T6b a segunda diferenca: o foco anterior sai");
    api.leiLadoIr(1);
    ok(api.leiLadoCtxAtual().foco === 0, "T6c depois da ultima, volta a primeira");
    api.leiLadoIr(-1);
    ok(api.leiLadoCtxAtual().foco === 1, "T6d 'anterior' anda pra tras");
    ok(/diferença 2 de 2/.test(api.$("leiLadoPos").textContent), "T6e a posicao aparece: " + api.$("leiLadoPos").textContent);

    /* registro */
    ok(api.leiLogTexto().indexOf("lado a lado aberto (teste)") >= 0 && /1 alterada\(s\)/.test(api.leiLogTexto()), "T7 o registro diz como terminou");
  }
  {
    /* textos iguais: o painel EXPLICA, nao some */
    const api = iniciar();
    const base = "Art. 1º Um.\nArt. 2º Dois.";
    api.leiLadoAbrir(base, base, "teste");
    ok(/iguais, linha a linha/.test(api.$("leiLadoResumo").textContent) && /não há o que atualizar/.test(api.$("leiLadoResumo").textContent),
      "I1 explica que os dois textos sao iguais: " + api.$("leiLadoResumo").textContent);
    ok(api.$("leiLadoBarra").hidden === true, "I2 sem diferenca, nao ha navegacao");
    ok(api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length === 2, "I3 os dois textos continuam visiveis, linha a linha");
    ok(api.leiLogTexto().indexOf("textos iguais, linha a linha") >= 0, "I4 o registro tambem diz que eram iguais");
    api.leiLadoAbrir("Art. 1º “A” — x.", "Art. 1º \"A\" - x.", "teste");
    ok(/só a formatação/.test(api.$("leiLadoResumo").textContent), "I5 so' formato: diz que o conteudo e' o mesmo: " + api.$("leiLadoResumo").textContent);
  }
  {
    /* filtro "so' o que mudou": as iguais viram faixa, e a faixa abre */
    const api = iniciar();
    const linhas = Array.from({ length: 40 }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".");
    const novo = linhas.slice(); novo[20] = "Art. 21º Texto do artigo 21, alterado.";
    api.leiLadoAbrir(linhas.join("\n"), novo.join("\n"), "teste");
    ok(api.$("leiLadoSoMudou").checked === false, "F0 com poucas linhas o filtro comeca desligado");
    api.$("leiLadoSoMudou").checked = true;
    api.$("leiLadoSoMudou").onchange();
    const faixas = api.$("leiLadoGrade").querySelectorAll(".lei-lado-faixa");
    ok(faixas.length === 2 && /18 linhas iguais/.test(faixas[0].textContent), "F1 as iguais viram faixas (2 de cada lado): " + faixas.map((f) => f.textContent).join(" | "));
    ok(api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length === 5, "F2 a diferenca aparece com 2 linhas de contexto de cada lado: " + api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length);
    faixas[0].onclick();
    ok(api.$("leiLadoGrade").querySelectorAll(".lei-lado-faixa").length === 1 && api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length === 23, "F3 clicar na faixa abre as linhas iguais");
    api.$("leiLadoSoMudou").checked = false;
    api.$("leiLadoSoMudou").onchange();
    ok(api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length === 40, "F4 sem o filtro, todas as linhas");
  }
  {
    /* texto muito grande: corta e avisa, sem travar */
    const api = iniciar();
    const a = Array.from({ length: 2600 }, (_, i) => "linha " + i).join("\n");
    api.leiLadoAbrir(a, a, "teste");
    ok(api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length === 2000 && /primeiras 2000 linhas/.test(api.$("leiLadoNota").textContent),
      "G1 acima de 2000 linhas corta e avisa: " + api.$("leiLadoGrade").querySelectorAll(".lei-lado-lin").length);
  }

  /* ---- 4: integracao com "atualizar versao" ---- */
  {
    const api = iniciar();
    const base = Array.from({ length: 12 }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + " com redação própria e completa da lei.").join("\n");
    const l = api.leiGuardar({ nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "15", ano: "2009", texto: base });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    ok(typeof api.$("btnLeiUpdLado").onclick === "function", "A1 o botao existe e esta ligado no Passo 1");
    api.$("leiUpdFonte").value = "atualização";
    api.$("leiUpdTexto").value = base;
    const r = api.leiAtualizarComparar();
    ok(r === false && api.$("dlgLeiLado").open === true, "A2 'nenhuma diferenca' abre o painel lado a lado (nao mais so' um aviso): " + r);
    ok(/iguais, linha a linha/.test(api.$("leiLadoResumo").textContent), "A2a e o painel explica que os textos sao iguais");
    ok(api.leiLogTexto().indexOf("lado a lado aberto (nenhuma diferença)") >= 0, "A2b o registro guarda como terminou");
    api.$("dlgLeiLado").close();

    /* o botao do Passo 1, com o texto colado diferente */
    api.$("leiUpdTexto").value = base.replace("Texto do artigo 3 ", "Texto ALTERADO do artigo 3 ");
    ok(api.leiLadoDoAtualizar() === true && api.$("dlgLeiLado").open === true, "A3 o botao abre o painel com o texto colado");
    ok(/1 linha\(s\) alterada\(s\)/.test(api.$("leiLadoResumo").textContent), "A3a e mostra a diferenca: " + api.$("leiLadoResumo").textContent);
    api.$("dlgLeiLado").close();

    api.$("leiUpdTexto").value = "";
    ok(api.leiLadoDoAtualizar() === false && /Cole \(ou abra\)/.test(api.$("uiModalMsg").textContent), "A4 sem texto colado, pede o texto: " + api.$("uiModalMsg").textContent);
    api._uiFechar(true);
    api.$("leiUpdTexto").value = base;
    api.$("leiUpdModoAlt").checked = true;
    ok(api.leiLadoDoAtualizar() === true && api.$("dlgLeiLado").open === true, "A5 no modo 'so' alteracoes' o painel TAMBEM abre (o botao nao pode recusar)");
    ok(/Modo “só alterações”/.test(api.$("leiLadoNota").textContent), "A5a e explica o modo numa nota: " + api.$("leiLadoNota").textContent);
    ok(api.leiLogTexto().indexOf("atualizar versão, só alterações") >= 0, "A5b o registro diz o modo");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
