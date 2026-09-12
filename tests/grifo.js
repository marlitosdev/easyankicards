/* GRIFAR POR SELEÇÃO DE TEXTO
 *
 * POR QUE O CANVAS SAIU.
 *
 * Ele desenhava pixels por cima do texto, com tamanho interno FIXO
 * (900×420) para uma caixa cujo formato varia muito. Num telefone o
 * traço horizontal — que é como se grifa — saía espremido a ponto de
 * quase sumir: era o "o grifo não funciona" relatado. E mesmo
 * consertada a conta, nenhum desenho sobrevive ao que acontece de
 * verdade: girar o aparelho, aumentar a letra, mudar a largura da
 * caixa. O texto reflui e os riscos ficam apontando para palavras que
 * já não estão ali.
 *
 * O QUE PRECISA SER VERDADE AGORA:
 *
 * 1. O GRIFO É POSIÇÃO DE CARACTERE, não posição na tela. É o que o
 *    torna imune a reflow, zoom e rotação — e é o que se testa aqui,
 *    porque não há pixel nenhum envolvido.
 * 2. SOBREPOR NÃO PODE CRIAR LIXO. Grifar por cima de metade de um
 *    grifo antigo, grifar o mesmo trecho duas vezes, grifar um
 *    caractere: os casos de canto de intervalo são onde nascem os
 *    erros, e aqui eles têm de sair normalizados.
 * 3. TIRAR UM GRIFO É TOCAR NELE. Sem borracha, sem modo, sem acerto
 *    por distância.
 * 4. O TEXTO NUNCA SE PERDE. Reconstruir a caixa a partir do texto
 *    original e das marcas tem de devolver exatamente o texto. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const T = "O ICMS nao compoe a base de calculo do PIS e da COFINS.";

  /* ---- G1: a cor por caractere, e os trechos de volta ---- */
  {
    const { api } = rodar();
    const v = api.grPintarVetor(10, [{ ini: 2, fim: 5, cor: "am" }]);
    ok(v.length === 10, "G1 o vetor nao tem o tamanho do texto: " + v.length);
    ok(v[1] === null && v[2] === "am" && v[4] === "am" && v[5] === null,
       "G1a o intervalo pintou fora do que devia: " + JSON.stringify(v));

    const tr = api.grTrechos(v);
    ok(tr.length === 3,
       "G1b os trechos nao saíram (antes, marca, depois): " + tr.length);
    ok(tr[1].ini === 2 && tr[1].fim === 5 && tr[1].cor === "am",
       "G1c o trecho colorido saiu errado: " + JSON.stringify(tr[1]));
  }

  /* ---- G2: sobrepor sai normalizado ---- */
  {
    const { api } = rodar();
    /* GRIFO NOVO POR CIMA DO ANTIGO: quem chega manda na parte comum,
     * e o que sobra do antigo continua com a cor dele. */
    let m = api.grNormalizar(20, [
      { ini: 0, fim: 10, cor: "am" },
      { ini: 5, fim: 15, cor: "vd" },
    ]);
    ok(m.length === 2,
       "G2 dois grifos que se cruzam nao viraram dois trechos: "
       + JSON.stringify(m));
    ok(m[0].ini === 0 && m[0].fim === 5 && m[0].cor === "am",
       "G2a o pedaco que sobrou do grifo antigo saiu errado: "
       + JSON.stringify(m[0]));
    ok(m[1].ini === 5 && m[1].fim === 15 && m[1].cor === "vd",
       "G2b o grifo novo nao ficou inteiro: " + JSON.stringify(m[1]));

    /* VIZINHOS DA MESMA COR VIRAM UM. Dois trechos colados com a mesma
     * cor desenhariam duas marcas encostadas — e tocar numa tiraria só
     * metade do que parece um grifo só. */
    m = api.grNormalizar(20, [
      { ini: 0, fim: 5, cor: "am" }, { ini: 5, fim: 9, cor: "am" }]);
    ok(m.length === 1 && m[0].ini === 0 && m[0].fim === 9,
       "G2c dois grifos colados da mesma cor nao viraram um: "
       + JSON.stringify(m));

    /* O MESMO TRECHO DUAS VEZES não vira dois. */
    m = api.grNormalizar(20, [
      { ini: 3, fim: 8, cor: "am" }, { ini: 3, fim: 8, cor: "am" }]);
    ok(m.length === 1, "G2d grifar o mesmo trecho duas vezes duplicou: "
       + JSON.stringify(m));

    /* ENGOLIR POR INTEIRO: o antigo some, nao sobra casca de largura
     * zero. */
    m = api.grNormalizar(20, [
      { ini: 5, fim: 8, cor: "am" }, { ini: 2, fim: 12, cor: "vd" }]);
    ok(m.length === 1 && m[0].cor === "vd",
       "G2e o grifo engolido deixou sobra: " + JSON.stringify(m));
    ok(m.every((x) => x.fim > x.ini),
       "G2f sobrou trecho de largura zero: " + JSON.stringify(m));
  }

  /* ---- G3: acrescentar, tirar e limpar ---- */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    api.grAcrescentar("q1", T, 2, 6, "am");
    ok(api.grContar("q1") === 1, "G3 o grifo nao foi guardado");

    /* UM TOQUE SEM ARRASTAR não vira grifo. Não há guarda no código
     * para isto, e não precisa haver: a normalização pinta um vetor e o
     * lê de volta em trechos, e largura zero não pinta caractere
     * nenhum. A asserção defende o COMPORTAMENTO; a guarda que existia
     * era código morto e saiu. */
    api.grAcrescentar("q1", T, 9, 9, "vd");
    ok(api.grContar("q1") === 1,
       "G3a um toque sem arrastar criou um grifo vazio: "
       + JSON.stringify(api.grMarcasDe("q1")));

    /* INVERTIDO: arrastar da direita para a esquerda é seleção normal,
     * e chega com ini > fim. */
    api.grAcrescentar("q1", T, 20, 14, "vd");
    const m = api.grMarcasDe("q1").filter((x) => x.cor === "vd")[0];
    ok(m && m.ini === 14 && m.fim === 20,
       "G3b arrastar de tras para a frente nao foi endireitado: "
       + JSON.stringify(m));

    /* TOCAR NA MARCA TIRA — e tira só aquela. */
    api.grTirarEm("q1", T, 3);
    ok(api.grContar("q1") === 1,
       "G3c tirar um grifo levou o outro junto: "
       + JSON.stringify(api.grMarcasDe("q1")));
    ok(api.grMarcasDe("q1")[0].cor === "vd",
       "G3d tirou o grifo errado");

    /* TOCAR FORA DE QUALQUER MARCA não tira nada. */
    api.grTirarEm("q1", T, 0);
    ok(api.grContar("q1") === 1,
       "G3e tocar fora de uma marca apagou uma marca");

    api.grLimpar("q1");
    ok(api.grContar("q1") === 0, "G3f limpar nao limpou");
  }

  /* ---- G4: cada questão tem os seus ---- */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    /* CONTAGENS DIFERENTES DE PROPÓSITO.
     *
     * Com uma marca em cada, "olhar sempre a primeira questão" dava o
     * mesmo número das duas e a asserção passava sem medir nada — foi o
     * que a sabotagem mostrou. Duas de um lado e uma do outro separam
     * os dois casos. */
    api.grAcrescentar("q1", T, 0, 4, "am");
    api.grAcrescentar("q1", T, 10, 14, "am");
    api.grAcrescentar("q2", T, 30, 34, "vd");
    ok(api.grContar("q1") === 2,
       "G4 a questao q1 nao ficou com os dois grifos dela: "
       + api.grContar("q1"));
    ok(api.grContar("q2") === 1,
       "G4a os grifos de q1 vazaram para q2: " + api.grContar("q2"));
    ok(api.grMarcasDe("q2")[0].cor === "vd",
       "G4b a marca devolvida para q2 e de outra questao");
  }

  /* ================================================================
   * G5: DESENHAR NÃO PODE PERDER TEXTO
   * ============================================================== */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    const caixa = api.$("qsSessCorpo");
    api.grAcrescentar("q1", T, 2, 6, "am");
    api.grAcrescentar("q1", T, 20, 26, "vd");
    api.grPintar(caixa, "q1", T);

    /* O TEXTO INTEIRO, na ordem. Reconstruir a caixa a cada mudança só
     * é seguro se reconstruir devolver o mesmo texto. */
    ok(caixa.textContent === T,
       "G5 desenhar mudou o texto do enunciado:\\n  " + caixa.textContent
       + "\\n  " + T);

    const marcas = (caixa.children || []).filter((x) => x.tag === "mark");
    ok(marcas.length === 2,
       "G5a nao saíram duas marcas: " + marcas.length);
    ok(marcas[0].textContent === T.slice(2, 6),
       "G5b a marca cobre o trecho errado: '" + marcas[0].textContent
       + "' em vez de '" + T.slice(2, 6) + "'");
    ok(/gr-am/.test(marcas[0].className || ""),
       "G5c a marca nao leva a cor: " + marcas[0].className);

    /* SEM GRIFO NENHUM, o texto continua lá — e sem marca nenhuma. */
    api.grLimpar("q1");
    api.grPintar(caixa, "q1", T);
    ok(caixa.textContent === T, "G5d sem grifos o texto sumiu");
    ok((caixa.children || []).filter((x) => x.tag === "mark").length === 0,
       "G5e sobrou marca depois de limpar");
  }

  /* ================================================================
   * G6: DA SELEÇÃO PARA A POSIÇÃO NO TEXTO
   *
   * O navegador entrega "nó tal, deslocamento tal". Com grifos já na
   * tela, a caixa vira uma mistura de pedaços de texto e <mark>, e o
   * mesmo trecho passa a ter nós diferentes. A conversão para uma
   * posição única é o ponto onde isso pode dar errado.
   * ============================================================== */
  {
    const { api } = rodar();
    /* uma arvore no formato que o navegador entrega */
    const texto = (s) => ({ nodeType: 3, nodeValue: s, childNodes: [] });
    const t1 = texto("O ICMS ");
    const t2 = texto("nao compoe");
    const marca = { nodeType: 1, childNodes: [t2] };
    const t3 = texto(" a base.");
    const raiz = { nodeType: 1, childNodes: [t1, marca, t3] };

    ok(api.grPosicaoDe(raiz, t1, 0) === 0,
       "G6 o comeco do primeiro pedaco nao e a posicao zero");
    ok(api.grPosicaoDe(raiz, t1, 7) === 7,
       "G6a a posicao dentro do primeiro pedaco saiu errada");
    /* DENTRO DE UMA MARCA: o "nao" comeca no 7, entao o caractere 3
     * dele e a posicao 10 do texto inteiro. Sem somar o que veio antes,
     * um grifo por cima de outro sairia deslocado para o comeco. */
    ok(api.grPosicaoDe(raiz, t2, 3) === 10,
       "G6b a posicao dentro de uma marca nao somou o texto anterior: "
       + api.grPosicaoDe(raiz, t2, 3));
    ok(api.grPosicaoDe(raiz, t3, 0) === 17,
       "G6c a posicao depois da marca nao somou a marca: "
       + api.grPosicaoDe(raiz, t3, 0));
    /* SELEÇÃO QUE APONTA PARA O ELEMENTO, e não para um texto: o
     * deslocamento conta FILHOS, não letras. Tratá-lo como letra daria
     * "2" onde o certo são 17. */
    ok(api.grPosicaoDe(raiz, raiz, 2) === 17,
       "G6d selecao ancorada no elemento foi lida como letra: "
       + api.grPosicaoDe(raiz, raiz, 2));
    /* nó de fora da caixa não devolve posição inventada */
    ok(api.grPosicaoDe(raiz, texto("outro"), 1) === -1,
       "G6e um no de fora da caixa devolveu posicao");
  }

  /* ================================================================
   * G7: A BARRA — QUATRO CORES, E O RESTO ATRÁS DO ⋮
   *
   * Substitui o bloco E1 de tests/enxugar-tela.js, que media a barra de
   * sete botões do grifo em canvas (ligar, quatro canetas, borracha,
   * dois tamanhos, limpar). O gesto agora é um só — selecionar e tocar
   * numa cor —, e entre o enunciado e as alternativas cada linha de
   * botão custa uma linha de texto num telefone.
   * ============================================================== */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    const q = { id: "q1", enunciado: T, tipo: "ce", opcoes: [] };
    const barra = api.qsUiFerramentas(q);

    const filhos = (barra.children || []);
    const cores = filhos.filter((x) => /qs-cor/.test(x.className || ""));
    ok(cores.length === api.GR_CORES.length,
       "G7 as cores nao estao todas na barra: " + cores.length);
    ok(cores.length === 4,
       "G7a-pre o cenario nao tem quatro cores e o numero acima nao diz nada");

    /* CADA COR DIZ O QUE É. Bolinha colorida sem rótulo é ilegível para
     * quem não enxerga cor, e muda para o leitor de tela. */
    ok(cores.every((b) => (b.title || "").length > 3
      && b.getAttribute("aria-label")),
       "G7b uma bolinha de cor ficou sem nome");

    /* O QUE NÃO É GESTO DE LEITURA fica escondido até ser pedido. */
    const mais = filhos.filter((x) => /qs-fer-mais/.test(x.className || ""))[0];
    ok(mais, "G7c nao ha o ⋮ na barra");
    const menu = (mais.children || [])
      .filter((x) => /qs-fer-menu/.test(x.className || ""))[0];
    ok(menu && menu.hidden === true,
       "G7d o menu do ⋮ ja nasce aberto, ocupando a tela");
    const bm = (mais.children || []).filter((x) => x.tag === "button")[0];
    bm.onclick();
    ok(menu.hidden === false, "G7e o ⋮ nao abriu o menu");
    /* e dentro dele está o copiar a questão, que saiu da faixa fixa */
    ok(/copiar/i.test(menu.textContent || ""),
       "G7f o copiar a questao nao foi para dentro do ⋮: "
       + (menu.textContent || "").slice(0, 60));

    /* TOCAR NUMA COR SEM SELEÇÃO só troca a cor — e o botão reage, para
     * não parecer quebrado. */
    const azul = cores.filter((b) => /gr-az/.test(b.className || ""))[0];
    azul.onclick();
    ok(api.grCorAtual() === "az",
       "G7g tocar numa cor nao trocou a cor do proximo grifo: "
       + api.grCorAtual());
    ok(api.vkUltimaReacaoAtual(),
       "G7h a cor sem selecao nao deu reacao nenhuma, e o botao parece "
       + "quebrado");
  }

  /* ================================================================
   * G8: O CAMINHO INTEIRO, DA SELEÇÃO ATÉ A MARCA NA TELA
   *
   * G1–G6 testam as peças. Este testa o gesto: com a caixa montada e
   * uma seleção de verdade, tocar numa cor tem de virar uma marca sobre
   * as palavras certas — inclusive quando a seleção começa DENTRO de um
   * grifo que já existe, que é onde a conversão de posição pode errar.
   * ============================================================== */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    const caixa = api.$("qsSessCorpo");
    api.grEnvolver(caixa, "q1", T);

    /* a seleção como o navegador entrega: nó e deslocamento */
    let soltou = 0;
    const selecionar = (no1, d1, no2, d2) => {
      soltou = 0;
      api.porSelecao(() => ({
        rangeCount: 1,
        getRangeAt: () => ({ startContainer: no1, startOffset: d1,
                             endContainer: no2, endOffset: d2 }),
        removeAllRanges() { soltou++; },
      }));
    };

    /* PRIMEIRO GRIFO, sobre um texto ainda sem marca nenhuma. */
    let no = caixa.childNodes[0];
    ok(no && no.nodeType === 3,
       "G8-pre a caixa nao comeca com um no de texto, e o cenario nao "
       + "reproduz o que o navegador entrega");
    selecionar(no, 2, no, 6);
    api.grEscolherCor("am");
    let feito = api.grDaSelecao();
    ok(feito && feito.ini === 2 && feito.fim === 6,
       "G8 a selecao nao virou grifo na posicao certa: "
       + JSON.stringify(feito));
    ok(caixa.textContent === T, "G8a grifar mudou o texto do enunciado");
    /* A SELEÇÃO É SOLTA DEPOIS DE GRIFAR. Deixá-la ativa faz o toque
     * seguinte numa cor regrifar o mesmo trecho, e no celular as alças
     * da seleção ficam por cima do texto que se quer ler. */
    ok(soltou > 0,
       "G8a2 a selecao continuou ativa depois de virar grifo");

    /* SEGUNDO GRIFO COMEÇANDO DENTRO DO PRIMEIRO.
     *
     * Agora a caixa é texto + <mark> + texto, e o nó da seleção não é
     * mais o começo de nada. Sem somar o que veio antes, este grifo
     * sairia deslocado para o início do enunciado. */
    const marca = caixa.childNodes[1];
    ok(marca && marca.tag === "mark",
       "G8-pre2 nao ha marca na caixa, e a selecao dentro de marca nao "
       + "chega a ser testada");
    selecionar(marca.childNodes[0], 2, caixa.childNodes[2], 4);
    api.grEscolherCor("vd");
    feito = api.grDaSelecao();
    ok(feito && feito.ini === 4,
       "G8b a selecao que comeca dentro de um grifo saiu deslocada: "
       + JSON.stringify(feito));
    ok(feito && feito.fim === 10,
       "G8c o fim da selecao nao somou a marca inteira: "
       + JSON.stringify(feito));
    ok(caixa.textContent === T,
       "G8d o segundo grifo mudou o texto: " + caixa.textContent);

    /* SELEÇÃO VAZIA — um toque sem arrastar — não vira grifo. */
    const antes = api.grContar("q1");
    selecionar(caixa.childNodes[0], 1, caixa.childNodes[0], 1);
    ok(api.grDaSelecao() === null,
       "G8e um toque sem arrastar virou grifo");
    ok(api.grContar("q1") === antes,
       "G8f o toque sem arrastar mexeu na lista de grifos");

    /* SEM SELEÇÃO NENHUMA também não. */
    api.porSelecao(() => ({ rangeCount: 0, removeAllRanges() {} }));
    ok(api.grDaSelecao() === null, "G8g grifou sem haver selecao");
  }

  /* ================================================================
   * G9: O CLIQUE NA COR MATA A SELEÇÃO — E MESMO ASSIM TEM DE GRIFAR
   *
   * O DEFEITO RELATADO: selecionar o trecho, tocar numa cor, e nada
   * acontecer.
   *
   * No Chrome, apertar um <button> move o foco e COLAPSA a seleção no
   * "mousedown", antes do "click". Quando o gatilho roda, o que
   * getSelection devolve já é um cursor sem largura — início igual a
   * fim — e a função recusava. O gesto inteiro dependia de ler a
   * seleção no instante em que ela já não existe.
   *
   * LIMITE DO SIMULADOR: "document.addEventListener" é um no-op aqui,
   * então o aviso de mudança de seleção não chega sozinho. O teste
   * chama grLembrarSelecao() na mão, que é exatamente o que o navegador
   * faria — e depois COLAPSA a seleção viva, que é o que o clique faz.
   * ============================================================== */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    const caixa = api.$("qsSessCorpo");
    api.grEnvolver(caixa, "q1", T);
    /* O NÓ É BUSCADO NA HORA, e não guardado numa variável: grifar
     * reconstrói a caixa inteira, e o nó de antes fica órfão — no
     * navegador acontece o mesmo, e a seleção passa a apontar para os
     * nós novos. Guardar o nó antigo fazia a segunda parte deste teste
     * medir uma referência morta. */
    const primeiro = () => caixa.childNodes[0];

    const selecao = (a, b) => api.porSelecao(() => ({
      rangeCount: 1,
      getRangeAt: () => ({ startContainer: primeiro(), startOffset: a,
                           endContainer: primeiro(), endOffset: b }),
      removeAllRanges() {},
    }));

    /* 1. a pessoa seleciona — o navegador avisa, e o app anota */
    selecao(2, 6);
    api.grLembrarSelecao();
    ok(api.grSelGuardadaAtual(),
       "G9-pre a selecao nao foi anotada, e o teste abaixo nao mede nada");

    /* 2. o clique no botão colapsa a seleção viva */
    selecao(6, 6);
    ok(api.grLembrarSelecao() === null,
       "G9-pre2 uma selecao colapsada foi aceita como selecao");

    /* 3. e o grifo TEM de sair assim mesmo */
    api.grEscolherCor("am");
    const feito = api.grDaSelecao();
    ok(feito && feito.ini === 2 && feito.fim === 6,
       "G9 o clique na cor matou a selecao e o grifo nao saiu: "
       + JSON.stringify(feito));
    ok(api.grContar("q1") === 1,
       "G9a nenhum grifo foi guardado");

    /* 4. A SELEÇÃO ANOTADA NÃO PODE SER APAGADA PELO PRÓPRIO COLAPSO.
     * Se grLembrarSelecao zerasse a anotação ao ver uma seleção vazia,
     * o defeito voltaria por outro caminho. */
    /* NO ÚLTIMO PEDAÇO, e não no primeiro: depois do grifo acima a
     * caixa virou "O " + <mark>ICMS</mark> + " nao compoe...", e o
     * primeiro nó tem dois caracteres. Pedir o deslocamento 10 nele
     * devolvia o fim do nó nas duas pontas — uma seleção vazia — e o
     * teste falhava por culpa do cenário, não do código. */
    const ultimo = () => caixa.childNodes[caixa.childNodes.length - 1];
    api.porSelecao(() => ({ rangeCount: 1,
      getRangeAt: () => ({ startContainer: ultimo(), startOffset: 2,
                           endContainer: ultimo(), endOffset: 6 }),
      removeAllRanges() {} }));
    api.grLembrarSelecao();
    ok(api.grSelGuardadaAtual() && api.grSelGuardadaAtual().ini === 8,
       "G9b-pre a selecao do segundo trecho nao foi anotada onde eu "
       + "esperava: " + JSON.stringify(api.grSelGuardadaAtual()));
    api.porSelecao(() => ({ rangeCount: 1,
      getRangeAt: () => ({ startContainer: ultimo(), startOffset: 6,
                           endContainer: ultimo(), endOffset: 6 }),
      removeAllRanges() {} }));
    api.grLembrarSelecao();          /* o colapso do clique */
    api.grLembrarSelecao();          /* e outro, por via das dúvidas */
    ok(api.grSelGuardadaAtual() && api.grSelGuardadaAtual().ini === 8,
       "G9b o colapso do clique apagou a selecao anotada: "
       + JSON.stringify(api.grSelGuardadaAtual()));

    /* 5. depois de grifar, a anotação é consumida: tocar noutra cor sem
     * selecionar de novo não pode regrifar o mesmo trecho */
    api.grDaSelecao();
    const antes = api.grContar("q1");
    ok(api.grDaSelecao() === null,
       "G9c grifou de novo sem selecao nova");
    ok(api.grContar("q1") === antes,
       "G9d o segundo toque mexeu na lista de grifos");
  }

  /* ---- G9e: a seleção não atravessa a virada de questão ----
   *
   * Você seleciona um trecho na questão 1, não grifa, e aperta
   * "próxima". Se a anotação sobrevivesse, tocar numa cor na questão 2
   * grifaria um intervalo calculado sobre o texto ANTERIOR — no lugar
   * errado, ou fora do texto. */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    const caixa = api.$("qsSessCorpo");
    const OUTRO = "Um enunciado bem diferente e mais curto.";
    api.grEnvolver(caixa, "q1", T);
    api.porSelecao(() => ({ rangeCount: 1,
      getRangeAt: () => ({ startContainer: caixa.childNodes[0], startOffset: 20,
                           endContainer: caixa.childNodes[0], endOffset: 30 }),
      removeAllRanges() {} }));
    api.grLembrarSelecao();
    ok(api.grSelGuardadaAtual(),
       "G9e-pre nada foi anotado na primeira questao");

    api.grEnvolver(caixa, "q2", OUTRO);      /* virou a questão */
    ok(api.grSelGuardadaAtual() === null,
       "G9e a selecao da questao anterior sobreviveu a virada: "
       + JSON.stringify(api.grSelGuardadaAtual()));
    /* E O NAVEGADOR TAMBÉM PERDE A SELEÇÃO ao trocar o conteúdo da
     * caixa — o simulador mantém a seleção falsa viva, então aqui ela é
     * desfeita à mão para reproduzir o estado real. Sem isso o teste
     * mediria uma seleção que no navegador não existiria. */
    api.porSelecao(() => ({ rangeCount: 0, removeAllRanges() {} }));
    ok(api.grDaSelecao() === null && api.grContar("q2") === 0,
       "G9f grifou na questao nova um trecho selecionado na anterior");
  }

  /* ---- G10: a cor da bolinha vence o "all: unset" ---- */
  {
    const { api } = rodar();
    /* o CSS vem do arquivo, e não do simulador: regra de folha de
     * estilo não tem como ser exercida num DOM de mentira */
    const fs = require("fs"), path = require("path");
    const html = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
    /* As cores vêm de regras de uma classe só, iguais em especificidade
     * a ".qs-cor{all:unset}" — e escritas antes dela no arquivo,
     * perdiam: "all: unset" zera o fundo. Os quatro botões apareciam
     * como círculos vazios. O par ".qs-cor.gr-am" vence esteja onde
     * estiver. */
    ok(/\.qs-cor\.gr-am\s*\{[^}]*background/.test(css),
       "G10 a bolinha da cor nao tem regra propria, e o 'all: unset' "
       + "apaga o fundo dela");
    api.grEsquecerTudo();
    const barra = api.qsUiFerramentas({ id: "q1", enunciado: T, opcoes: [] });
    const bolinha = (barra.children || [])
      .filter((x) => /qs-cor/.test(x.className || ""))[0];
    ok(/gr-am/.test(bolinha.className || ""),
       "G10a a bolinha nao carrega a classe da cor: " + bolinha.className);
  }

  /* ---- G11: o registro vê o que o grifo faz, e o que ele recusa ---- */
  {
    const { api } = rodar();
    api.grEsquecerTudo();
    const caixa = api.$("qsSessCorpo");
    api.grEnvolver(caixa, "q1", T);

    /* TOCAR NUMA COR SEM SELEÇÃO não quebra nada — e por isso o
     * registro nunca via. Foi assim que o defeito ficou invisível: a
     * função devolvia null, ninguém lançava exceção, e o log só enxerga
     * o que quebra ou o que alguém escolheu anotar. */
    api.porSelecao(() => ({ rangeCount: 0, removeAllRanges() {} }));
    api.grEsquecerSelecao();
    ok(api.grDaSelecao() === null, "G11-pre o cenario grifou sem selecao");
    const L = api.registroTexto();
    ok(/sem trecho selecionado/i.test(L),
       "G11 tocar numa cor sem selecao nao deixou rastro nenhum, e um "
       + "no-op silencioso e invisivel para quem depura");

    /* e o que dá certo também fica registrado */
    const no = caixa.childNodes[0];
    api.porSelecao(() => ({ rangeCount: 1,
      getRangeAt: () => ({ startContainer: no, startOffset: 2,
                           endContainer: no, endOffset: 6 }),
      removeAllRanges() {} }));
    api.grDaSelecao();
    ok(/trecho grifado/i.test(api.registroTexto()),
       "G11a grifar nao ficou registrado");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
