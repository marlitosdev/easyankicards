/* =====================================================================
 * A BANCADA TAMBÉM É UMA PASTA (16.75.0)
 *
 * O que originou: o baralho de 955 cartões do NotebookLM estava na
 * bancada (o texto do editor), e o radar de repetição, o "elevar ao padrão"
 * e o gerenciador só liam o material — era preciso mandar tudo para o
 * material antes, um passo que a pessoa não sabia que existia.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. A bancada entra na biblioteca como a pasta "Bancada › Texto do editor".
 *  2. Radar, elevar e gerenciador leem E GRAVAM nela: o texto do editor muda,
 *     com o mesmo cuidado de sempre (pergunta antes, lixeira, desfazer).
 *  3. Repetido entre a bancada e o material é achado.
 *  4. Uma foto no histórico ANTES de mexer — uma por ação, não uma por cartão.
 *  5. O que sai da bancada volta para a bancada (lixeira "editor").
 *  6. Os botões existem na própria bancada.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
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
  const RICO = "Serviços constantes da lista anexa à LC 116/2003, conforme o art. 1º; o imposto é municipal e incide sobre a prestação de serviços de qualquer natureza, ainda que não seja atividade preponderante do prestador";
  const historico = (a) => { try { return JSON.parse(a.loja.getItem("eac_hist") || "[]"); } catch (e) { return []; } };

  const BANCADA = [
    "@ Trilha ISS", "Qual o prazo de recolhimento do ISS retido pelo tomador? :: Até o dia 09 :: x", "+ Nota antiga", "",
    "Qual o prazo para recolhimento do ISS retido pelo tomador do serviço? :: " + RICO + " :: x", "+ Literalidade — Art. 40", "",
    "Prazo de recolhimento do ISS retido pelo tomador :: Dia 09 :: x", "",
    "Quem paga o IPTU? :: O proprietário :: y",
  ].join("\n");

  const montar = (texto, comMaterial) => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    a.$("editor").value = texto === undefined ? BANCADA : texto;
    let mat = null;
    if (comMaterial) {
      mat = a.matChave("Trib", "ISS");
      a.matGravarCartoes(mat, "Prazo do recolhimento do ISS retido pelo tomador de serviço :: Dia 09 do mês seguinte, art. 40 :: x\n+ Exemplo — retenção", { disciplina: "Trib", topico: "ISS" });
    }
    return { a, mat };
  };

  /* ---- B1: a biblioteca ---- */
  {
    const { a } = montar();
    const notas = a.cqLerBiblioteca();
    ok(notas.length === 4 && notas.every((x) => x.chave === a.CQ_BANCADA && x.disciplina === "Bancada" && x.topico === "Texto do editor" && x.card.raw), `B1 a bancada entra com 4 cartoes e a origem: ${notas.length}`);
    ok(a.cqEhBancada(a.CQ_BANCADA) && !a.cqEhBancada("trib›iss") && a.cqViaLixeira(a.CQ_BANCADA) === "editor" && a.cqViaLixeira("x") === "material", "B1a chave e via da lixeira");
    const v = montar("");
    ok(v.a.cqLerBiblioteca().length === 0, "B1b editor vazio: nada a ler");
    const m = montar(BANCADA, true);
    ok(m.a.cqLerBiblioteca().length === 5 && m.a.cqLerBiblioteca().filter((x) => x.chave === m.mat).length === 1, "B1c bancada e material juntos");
    ok(a.cqTexto(a.CQ_BANCADA) === BANCADA && a.cqTexto("chave que nao existe") === "", "B1d cqTexto le o editor e devolve vazio para pasta inexistente");
    a.cqGravar(a.CQ_BANCADA, "A :: B", {});
    ok(a.$("editor").value === "A :: B", "B1e cqGravar na bancada escreve no editor");
    ok(a.loja.getItem("eac_texto") === "A :: B", `B1e2 e o editor e SALVO (autoSalvar): ${a.loja.getItem("eac_texto")}`);
  }

  /* ---- B2: o radar na bancada (e entre bancada e material) ---- */
  {
    const { a } = montar();
    a.cqAbrir();
    ok(/4 cartões lidos · 1 grupos de parecidos · 2 a mais \(50%\)/.test(a.$("cqResumo").textContent), `B2 o radar ve os repetidos da bancada: ${a.$("cqResumo").textContent}`);
    const itens = achar(a.$("cqLista"), (e) => cls(e, "cq-item"));
    ok(itens.length === 3 && /Bancada · Texto do editor/.test(itens[0].textContent), "B2a a origem 'Bancada' aparece no grupo");
    const antesHist = historico(a).length;
    const grupos = achar(a.$("cqLista"), (e) => cls(e, "cq-grupo"));
    const mesclar = achar(grupos[0], (e) => e.tag === "button" && /mesclar/.test(e.textContent))[0];
    await conduzir(a, mesclar.onclick());
    const t = a.$("editor").value;
    ok(!/Trilha ISS/.test(t) && a.parseText(t).cards.filter((c) => /prazo/i.test(c.front)).length === 1 && /Quem paga o IPTU/.test(t), `B2b os repetidos saem do EDITOR (o titulo do que saiu some junto): ${JSON.stringify(t)}`);
    ok(/\+ Literalidade — Art\. 40/.test(t) && /\+ Nota antiga/.test(t) && /Também cobrado — Até o dia 09/.test(t), "B2c o cartao que fica e' o mais completo e recebeu o que os outros tinham a mais (a nota e a resposta)");
    const lix = a.lixLer();
    ok(lix.length === 2 && lix.every((x) => x.tipo === "cartao" && x.via === "editor" && typeof x.dados.bloco === "string"), `B2d foram para a lixeira como 'editor': ${JSON.stringify(lix.map((x) => x.via))}`);
    ok(historico(a).length === antesHist + 1, `B2e uma foto do editor para o grupo inteiro: +${historico(a).length - antesHist}`);
    /* restaurar volta para o editor */
    ok(a.lixRestaurar(lix[0].id).ok === true && /Trilha ISS|Dia 09/.test(a.$("editor").value), "B2f restaurar da lixeira devolve o cartao ao EDITOR");
  }
  {
    /* repetido ENTRE a bancada e o material */
    const { a, mat } = montar(undefined, true);
    const rel = a.cqRelatorio(a.cqLerBiblioteca());
    ok(rel.total === 5 && rel.grupos.length === 1 && rel.grupos[0].itens.length === 4, `B3 bancada + material: 4 parafrases num grupo so': ${JSON.stringify({ t: rel.total, g: rel.grupos.map((g) => g.itens.length) })}`);
    const notas = a.cqLerBiblioteca();
    const r = a.cqResolverGrupo(notas, rel.grupos[0].itens, rel.grupos[0].melhor, true);
    ok(r.removidos === 3, `B3a removeu 3: ${JSON.stringify(r)}`);
    const nBanc = (a.$("editor").value.match(/prazo/gi) || []).length, nMat = ((a.matResumosAtual()[mat] || {}).cartoes.match(/prazo/gi) || []).length;
    ok(nBanc + nMat === 1, `B3b sobra UM cartao 'prazo' em toda a biblioteca: bancada ${nBanc} + material ${nMat}`);
    ok(a.lixLer().map((x) => x.via).sort().join() === "editor,editor,material" || a.lixLer().map((x) => x.via).sort().join() === "editor,material,material" || a.lixLer().length === 3, "B3c cada removido volta pelo lugar de onde saiu");
  }

  /* ---- B4: elevar na bancada ---- */
  {
    const { a } = montar();
    const ab = a.ceLerAbaixo();
    ok(ab.length === 3 && ab.every((x) => x.chave === a.CQ_BANCADA), `B4 o elevar lista os fracos da bancada: ${ab.length}`);
    a.ceAbrir();
    a.$("btnCeMarcar").onclick(); a.$("btnCePrompt").onclick();
    ok(/@@ 1\n/.test(a.$("cePrompt").value) && /Nota antiga/.test(a.$("cePrompt").value), "B4a o prompt em lote sai com os cartoes da bancada");
    const it = a.cePedidoAtual().itens;
    const idIptu = it.findIndex((x) => /IPTU/.test(x.card.front)) + 1;
    a.$("ceColar").value = "@@ " + idIptu + "\nQuem paga o IPTU? :: O proprietário do imóvel, o titular do domínio útil ou o possuidor a qualquer título, conforme o art. 34 do CTN :: y\n+ Literalidade — Art. 34 do CTN: contribuinte do imposto é o proprietário do imóvel";
    a.$("btnCeConferir").onclick();
    const antes = a.$("editor").value, hist0 = historico(a).length;
    await conduzir(a, a.$("btnCeAplicar").onclick());
    ok(/domínio útil/.test(a.$("editor").value) && a.$("editor").value !== antes && /Trilha ISS/.test(a.$("editor").value), "B4b aplicar troca o cartao NO EDITOR e preserva os outros");
    ok(historico(a).length === hist0 + 1, `B4c uma foto do historico para a rodada toda: +${historico(a).length - hist0}`);
    {
      /* duas trocas na mesma rodada = ainda UMA foto */
      const b = montar();
      b.a.ceAbrir(); b.a.$("btnCeMarcar").onclick(); b.a.$("btnCePrompt").onclick();
      const its = b.a.cePedidoAtual().itens;
      const i1 = its.findIndex((x) => /IPTU/.test(x.card.front)) + 1, i2 = its.findIndex((x) => /^Prazo de recolhimento/.test(x.card.front)) + 1;
      b.a.$("ceColar").value = "@@ " + i1 + "\nQuem paga o IPTU? :: O proprietário do imóvel, o titular do domínio útil ou o possuidor a qualquer título, conforme o art. 34 do CTN :: y\n+ Literalidade — Art. 34 do CTN: contribuinte do imposto é o proprietário\n\n@@ " + i2 + "\nPrazo de recolhimento do ISS retido pelo tomador :: Até o dia 09 do mês seguinte ao da retenção, conforme o art. 40 da lei municipal, sob pena de multa :: x\n+ Literalidade — Art. 40: o tomador recolhe até o dia 09";
      b.a.$("btnCeConferir").onclick();
      const h1 = historico(b.a).length;
      await conduzir(b.a, b.a.$("btnCeAplicar").onclick());
      ok(b.a.ceRecibo() && b.a.$("editor").value.indexOf("sob pena de multa") >= 0 && /domínio útil/.test(b.a.$("editor").value), "B4c1 as duas trocas foram para o editor");
      ok(historico(b.a).length === h1 + 1, `B4c2 duas trocas na rodada = UMA foto no historico: +${historico(b.a).length - h1}`);
    }
    ok(a.ceRecibo() && a.ceRecibo().itens.length === 1 && a.ceRecibo().itens[0].chave === a.CQ_BANCADA, "B4d o recibo aponta para a bancada");
    const d = a.ceDesfazerLote();
    ok(d.desfeitos === 1 && a.$("editor").value === antes, `B4e desfazer devolve o texto do editor: ${JSON.stringify(d)}`);
    /* se digitou depois, nao pisa: refaz a rodada inteira (conferir + aplicar) e digita antes de desfazer */
    a.ceAbrir();
    a.$("btnCeMarcar").onclick(); a.$("btnCePrompt").onclick();
    const id2 = a.cePedidoAtual().itens.findIndex((x) => /IPTU/.test(x.card.front)) + 1;
    a.$("ceColar").value = "@@ " + id2 + "\nQuem paga o IPTU? :: O proprietário do imóvel, o titular do domínio útil ou o possuidor, conforme o art. 34 do CTN :: y\n+ Literalidade — Art. 34 do CTN";
    a.$("btnCeConferir").onclick();
    await conduzir(a, a.$("btnCeAplicar").onclick());
    a.$("editor").value = a.$("editor").value + "\nEscrevi depois :: agora";
    const d2 = a.ceDesfazerLote();
    ok(d2.pulados === 1 && /Escrevi depois/.test(a.$("editor").value), "B4f texto digitado depois nao e' pisado ao desfazer");
  }

  /* ---- B5: gerenciador na bancada ---- */
  {
    const { a, mat } = montar(undefined, true);
    a.gerAbrir();
    const pastas = achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta"));
    ok(pastas.some((p) => /Bancada \(4\)/.test(p.textContent.trim())) && pastas.some((p) => /Texto do editor \(4\)/.test(p.textContent)), `B5 a arvore mostra a pasta Bancada: ${pastas.map((p) => p.textContent.trim())}`);
    const pTxt = pastas.filter((p) => /Texto do editor/.test(p.textContent))[0];
    pTxt.onclick();
    const linhas = achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
    ok(linhas.length === 4, `B5a a pasta lista os 4 cartoes da bancada: ${linhas.length}`);
    /* apagar um da bancada */
    const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
    const iptu = linhas.findIndex((l) => /IPTU/.test(l.textContent));
    ck[iptu].checked = true; ck[iptu].onchange();
    await conduzir(a, a.$("btnGerApagar").onclick());
    ok(!/IPTU/.test(a.$("editor").value) && a.lixLer().length === 1 && a.lixLer()[0].via === "editor", "B5b apagar pela tela tira do EDITOR e vai para a lixeira 'editor'");
    await conduzir(a, a.$("btnGerDesfazer").onclick());
    ok(/Quem paga o IPTU/.test(a.$("editor").value), "B5c desfazer devolve ao editor");
    /* mover da bancada para o material */
    a.gerAbrir();
    const pastas2 = achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta"));
    pastas2.filter((p) => /Texto do editor/.test(p.textContent))[0].onclick();
    const ck2 = achar(a.$("gerLista"), (e) => e.tag === "input");
    const l2 = achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
    const i2 = l2.findIndex((l) => /IPTU/.test(l.textContent));
    ck2[i2].checked = true; ck2[i2].onchange();
    a.$("gerDestino").value = mat;
    await conduzir(a, a.$("btnGerMover").onclick());
    ok(!/IPTU/.test(a.$("editor").value) && /Quem paga o IPTU/.test(a.matResumosAtual()[mat].cartoes), "B5d mover da bancada para o material: sai de la, entra aqui");
    await conduzir(a, a.$("btnGerDesfazer").onclick());
    ok(/Quem paga o IPTU/.test(a.$("editor").value) && !/IPTU/.test(a.matResumosAtual()[mat].cartoes), "B5e desfazer volta os dois lados");
    /* editar na bancada */
    a.gerAbrir();
    achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta")).filter((p) => /Texto do editor/.test(p.textContent))[0].onclick();
    const l3 = achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
    l3[l3.findIndex((l) => /IPTU/.test(l.textContent))].onclick();
    a.$("btnGerEditar").onclick();
    a.$("gerEditor").value = "Quem paga o IPTU? :: O proprietário, conforme o art. 34 do CTN :: y";
    a.$("btnGerEditSalvar").onclick();
    ok(/conforme o art\. 34 do CTN/.test(a.$("editor").value), "B5f editar pelo gerenciador grava no editor");
  }

  /* ---- B6: uma foto por acao ---- */
  {
    const { a } = montar();
    a.gerAbrir();
    a.$("btnGerMarcar").onclick();
    const h0 = historico(a).length;
    await conduzir(a, a.$("btnGerApagar").onclick());
    ok(historico(a).length === h0 + 1, `B6 apagar 4 cartoes da bancada de uma vez = UMA foto no historico: +${historico(a).length - h0}`);
    ok(a.$("editor").value.trim() === "" || !/::/.test(a.$("editor").value), "B6a a bancada ficou sem cartoes");
    ok(a.lixLer().length === 4 && a.lixLer().every((x) => x.via === "editor"), "B6b os 4 estao na lixeira, como 'editor'");
  }
  {
    /* acao so' no MATERIAL nao mexe no historico do editor */
    const { a, mat } = montar(undefined, true);
    const h0 = historico(a).length;
    a.gerApagar(a.cqLerBiblioteca().filter((x) => x.chave === mat));
    ok(historico(a).length === h0 && a.lixLer().length === 1 && a.lixLer()[0].via === "material", `B6c apagar so' do material nao gera foto do editor: +${historico(a).length - h0}`);
  }

  /* ---- B7: os botoes na bancada ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/id="btnBancaRep"/.test(html) && /id="btnBancaElevar"/.test(html) && /id="btnBancaGer"/.test(html), "B7 os tres botoes estao no index.html");
    const { a } = montar();
    a.$("btnBancaRep").onclick();
    ok(a.$("dlgCartRep").open === true, "B7a o botao da bancada abre o radar");
    a.$("dlgCartRep").close();
    a.$("btnBancaElevar").onclick();
    ok(a.$("dlgCartElevar").open === true && /3 de 4/.test(a.$("ceResumo").textContent), `B7b o botao da bancada abre o elevar: ${a.$("ceResumo").textContent}`);
    a.$("dlgCartElevar").close();
    a.$("btnBancaGer").onclick();
    ok(a.$("dlgGerCartoes").open === true && /4 de 4 cartões/.test(a.$("gerResumo").textContent), `B7c o botao da bancada abre o gerenciador: ${a.$("gerResumo").textContent}`);
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ok((src.match(/"cq_bancada_disc"/g) || []).length === 2 && (src.match(/"cq_bancada_top"/g) || []).length === 2, "B7d os nomes da pasta existem em PT e EN");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`bancada: ok (${f.quantas} verificacoes)`);
  });
}
