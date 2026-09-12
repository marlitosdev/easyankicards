/* =====================================================================
 * A MARCA CAI ONDE VOCÊ APONTOU
 *
 * O DEFEITO, relatado com as duas frases exatas: no art. 156-A da EC
 * 132, "marquei 'entre Estados' no caput e ele marcou a palavra na linha
 * logo acima" — o título da Seção V-A, que diz "Do Imposto de
 * Competência Compartilhada entre Estados, Distrito Federal e
 * Municípios". E: "não existe como remover as marcações atualmente".
 *
 * TRÊS CAUSAS, e as três escrevem no texto de estudo — que é o motivo de
 * este arquivo existir antes de qualquer conserto.
 *
 * 1. matGuardarOffset tinha "$('matLeitura')" CRAVADO. Desde que a lei
 *    ganhou marcas são dois leitores; marcando na lei, o nó da seleção
 *    não estava naquele painel, a função saía com offset -1 e
 *    matMarcarSelecao caía na regra de último recurso — "a primeira
 *    ocorrência livre". A primeira era a do título.
 *
 * 2. Mesmo com o painel certo, a ocorrência era escolhida por PROPORÇÃO:
 *    (offset / total) × tamanho do texto guardado. Isso supõe que o
 *    texto renderizado e o guardado têm o mesmo comprimento, e não têm —
 *    o guardado carrega "==", "**" e os sufixos das marcas; o
 *    renderizado carrega cabeçalho de artigo e avisos que não existem no
 *    arquivo. Erra mais quanto mais marcado estiver o documento, que é
 *    quando mais se precisa dele.
 *
 * 3. O ouvinte de clique na marca estava ligado só a "matLeitura". Na
 *    lei dava para PÔR marca e não dava para TIRAR.
 *
 * O SUBSTITUTO É CONTAR, NÃO ESTIMAR: quantas vezes o trecho aparece
 * antes do ponto onde a seleção começou. Esse número é o mesmo nos dois
 * textos, porque não depende de comprimento nenhum.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

/* O texto do usuário, reduzido ao que importa: "entre Estados" aparece
 * DUAS vezes — no título da seção e no caput —, e é a segunda que ele
 * selecionou. */
const LEI_156A = [
  "Seção V-A",
  "Do Imposto de Competência Compartilhada entre Estados, Distrito Federal e Municípios",
  "Art. 156-A. Lei complementar instituirá imposto sobre bens e serviços de",
  "competência compartilhada entre Estados, Distrito Federal e Municípios.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const DISC = "Direito Tributário";
  const TOP = "Limitações ao poder de tributar";

  /* Monta o leitor de lei com a mesma estrutura que leiPintarLeitura
   * desenha: cabeçalho de divisão, o botão com o rótulo do artigo, os
   * botões de ação e o corpo. A moldura entra de propósito — parte do
   * conserto é ela NÃO ser contada. */
  const montarLeitor = (api) => {
    const painel = api.$("leiLeitura");
    painel.innerHTML = "";

    const div = api.document.createElement("div");
    div.className = "lei-div";
    div.textContent = "Seção V-A — Do Imposto de Competência Compartilhada "
      + "entre Estados, Distrito Federal e Municípios";

    const bloco = api.document.createElement("div");
    bloco.className = "lei-art";

    const cab = api.document.createElement("div");
    cab.className = "lei-art-cab";
    const rot = api.document.createElement("button");
    rot.className = "lei-art-num";
    rot.textContent = "Art. 156-A";
    cab.append(rot);

    const corpo = api.document.createElement("div");
    corpo.className = "lei-art-txt";
    const t1 = api.document.createTextNode(
      "Art. 156-A. Lei complementar instituirá imposto sobre bens e serviços de competência compartilhada ");
    const t2 = api.document.createTextNode(
      "entre Estados, Distrito Federal e Municípios.");
    corpo.append(t1, t2);

    const cai = api.document.createElement("div");
    cai.className = "lei-art-cai";
    cai.textContent = "Este artigo cai: 3 questão(ões) sua(s) entre Estados";

    bloco.append(cab, corpo, cai);
    painel.append(div, bloco);
    return { painel, div, t1, t2, cai, rot };
  };

  /* uma seleção de mentira: é o que o navegador entrega, reduzido ao que
   * matGuardarOffset lê */
  const selEm = (no, off) => ({
    anchorNode: no, anchorOffset: off, isCollapsed: false, rangeCount: 0,
  });

  /* ==============================================================
   * K1-K3: A CONTAGEM ACHA A OCORRÊNCIA CERTA
   * ============================================================== */
  {
    const { api } = rodar();
    const d = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");

    /* a segunda ocorrência: o começo do nó de texto do caput */
    api.matGuardarOffset(selEm(d.t2, 0), "leiLeitura");
    ok(api.matSelOrdinalAtual() === 1,
       "K1 selecionando 'entre Estados' no CAPUT, a contagem não disse "
       + "'segunda ocorrência' — é este número que decide onde a marca "
       + "cai · veio " + api.matSelOrdinalAtual());

    /* a primeira: dentro do título da seção */
    const iTit = String(d.div.textContent).indexOf("entre Estados");
    api.matGuardarOffset(selEm(d.div, iTit), "leiLeitura");
    ok(api.matSelOrdinalAtual() === 0,
       "K2 selecionando no TÍTULO da seção, a contagem não disse "
       + "'primeira' · veio " + api.matSelOrdinalAtual());

    /* SABOTAGEM VIVA: o painel importa. Com "matLeitura" — que é o que
     * estava cravado na função — a seleção da lei fica invisível, e era
     * exatamente assim que o app caía na "primeira livre". */
    api.matGuardarOffset(selEm(d.t2, 0), "matLeitura");
    ok(api.matSelOrdinalAtual() === -1,
       "K3 o painel deixou de importar: a função aceitou uma seleção que "
       + "não está no painel que lhe foi dado, e o teste K1 passa a "
       + "provar nada");
  }

  /* ==============================================================
   * K4: A MOLDURA NÃO CONTA
   * ============================================================== */
  {
    const { api } = rodar();
    const d = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");
    /* o aviso "este artigo cai" também contém a frase, e ele NÃO existe
     * no texto guardado: contá-lo empurraria a marca uma casa adiante */
    ok(api.matEhCromo(d.cai) === true,
       "K4 o aviso 'este artigo cai' não é reconhecido como moldura");
    ok(api.matEhCromo(d.div) === false,
       "K4a o título da seção foi tratado como moldura — ele é uma LINHA "
       + "DO TEXTO, e é ali que está a primeira ocorrência; pulá-lo troca "
       + "o sinal do erro em vez de corrigi-lo");
  }

  /* ==============================================================
   * K5-K7: A MARCA CAI NO CAPUT, E NÃO NO TÍTULO
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ec132", nome: "EC 132/2023", texto: LEI_156A });
    api.leiLigar("lei_ec132", ch);
    api.leiAbrir(DISC, TOP);

    const d = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");
    api.matGuardarOffset(selEm(d.t2, 0), "leiLeitura");
    api.matMarcarSelecao("destaque", "lei");

    const txt = String(api.$("leiTexto").value || "");
    const linhas = txt.split("\n");
    const tit = linhas.filter((l) => /Do Imposto de Compet/.test(l))[0] || "";
    const caput = linhas.filter((l) => /compartilhada/.test(l)).pop() || "";

    ok(/==entre Estados==/.test(caput),
       "K5 a marca não caiu no CAPUT, que é onde estava a seleção · "
       + JSON.stringify(caput));
    ok(!/==/.test(tit),
       "K6 a marca caiu no TÍTULO DA SEÇÃO — o erro exato do relato · "
       + JSON.stringify(tit));
    ok((txt.match(/==entre Estados==/g) || []).length === 1,
       "K7 a frase foi marcada mais de uma vez");
  }

  /* ==============================================================
   * K8: APONTAR PARA UM TRECHO JÁ MARCADO É UM "NÃO"
   *
   * A regra antiga procurava OUTRA ocorrência livre e marcava um trecho
   * diferente do selecionado, sem dizer nada. Recusar é a resposta
   * honesta.
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ec132", nome: "EC 132/2023", texto: LEI_156A });
    api.leiLigar("lei_ec132", ch);
    api.leiAbrir(DISC, TOP);

    const d = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");
    api.matGuardarOffset(selEm(d.t2, 0), "leiLeitura");
    api.matMarcarSelecao("destaque", "lei");
    const depois1 = String(api.$("leiTexto").value || "");

    /* de novo, no MESMO lugar — mas o navegador de verdade nunca entrega o
     * MESMO nó de antes: marcar repinta o leitor (leiPintarLeitura refaz o
     * innerHTML), e a seleção seguinte nasce da árvore nova. Reusar "d.t2"
     * aqui testaria uma referência que nenhum usuário real produz; montar
     * o leitor de novo é o que representa o repaint com o mesmo texto. */
    const d2 = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");
    api.matGuardarOffset(selEm(d2.t2, 0), "leiLeitura");
    api.matMarcarSelecao("importante", "lei");
    const depois2 = String(api.$("leiTexto").value || "");

    ok(depois1 === depois2,
       "K8 marcar de novo o MESMO trecho mexeu no texto — a regra antiga "
       + "ia marcar a outra ocorrência, no título, sem avisar");
    ok(!/==entre Estados==/.test(depois2.split("\n")
       .filter((l) => /Do Imposto de Compet/.test(l))[0] || ""),
       "K8a e o que ela mexeu foi justamente o título");
  }

  /* ==============================================================
   * K9-K10: DÁ PARA TIRAR A MARCA DENTRO DA LEI
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ec132", nome: "EC 132/2023", texto: LEI_156A });
    api.leiLigar("lei_ec132", ch);
    api.leiAbrir(DISC, TOP);

    const d = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");
    api.matGuardarOffset(selEm(d.t2, 0), "leiLeitura");
    api.matMarcarSelecao("destaque", "lei");
    api.leiGravar();

    /* ESTE TÓPICO NÃO TEM RESUMO — de propósito. Abrir o leitor de lei
     * não cria registro em matResumos, e a varredura de marcas começava
     * e terminava ali: a marca existia no texto, pintava na tela e não
     * aparecia em lista nenhuma. O que não aparece na lista não tem como
     * ser tirado, nem contado, nem revisado. */
    ok(!api.matResumosAtual()[ch],
       "K9pre o tópico ganhou resumo, e aí o teste deixa de exercitar o "
       + "caso que interessa: lei sem resumo");
    const marcas = api.matMarcasDe("destaque")
      .filter((m) => m.onde === "lei" && /entre Estados/.test(m.trecho));
    ok(marcas.length === 1,
       "K9 a marca feita na lei não aparece na lista de marcas · vieram "
       + marcas.length);

    if (marcas.length) {
      ok(api.matTirarMarcaDe(marcas[0]) === true,
         "K10 tirar a marca da lei falhou — era o 'não existe como "
         + "remover as marcações' do relato");
      ok(!/==entre Estados==/.test(api.leiTextoDoTopico(ch)),
         "K10a a marca continua no texto da lei depois de removida");
    }
  }

  /* ==============================================================
   * K11: O TEXTO DO ESTUDO NÃO PODE PERDER UMA LETRA
   *
   * Marcar e desmarcar é o gesto mais repetido do aplicativo, e o único
   * que reescreve o material. Se a ida e volta não devolver o texto
   * exato, cada ciclo come um pedaço da lei.
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ec132", nome: "EC 132/2023", texto: LEI_156A });
    api.leiLigar("lei_ec132", ch);
    api.leiAbrir(DISC, TOP);

    const antes = api.leiTextoDoTopico(ch);
    const d = montarLeitor(api);
    api.matSelGuardadaPor("entre Estados");
    api.matGuardarOffset(selEm(d.t2, 0), "leiLeitura");
    api.matMarcarSelecao("destaque", "lei");
    api.leiGravar();

    const m = api.matMarcasDe("destaque")
      .filter((x) => x.onde === "lei" && /entre Estados/.test(x.trecho))[0];
    if (m) api.matTirarMarcaDe(m);
    ok(api.leiTextoDoTopico(ch) === antes,
       "K11 marcar e desmarcar não devolveu o texto exato:\n   antes: "
       + JSON.stringify(antes) + "\n   depois: "
       + JSON.stringify(api.leiTextoDoTopico(ch)));
  }

  if (!n) falhas.push("nenhuma asserção rodou — o arquivo abortou no meio");
  return falhas;
}

module.exports = { testes };
