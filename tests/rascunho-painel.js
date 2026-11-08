/* O RASCUNHO SOBREPOSTO — e o que a coluna dividida custava.
 *
 * Em coluna, os dois lados perdiam. A questão estreitava até quebrar
 * cada linha em quatro palavras; o rascunho virava uma tira de duzentos
 * pixels onde as canetas quebravam em duas linhas. E como cada lado
 * rolava por conta, apareciam DUAS barras de rolagem verticais
 * paralelas: a pessoa tinha de descobrir qual das duas movia o que ela
 * queria ver.
 *
 * Sobreposto, o rascunho ou está aberto usando a largura toda, ou está
 * fechado e não ocupa nada. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");
const HTML = fs.readFileSync(
  path.join(__dirname, "..", "docs", "index.html"), "utf8");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const cssRegra = (sel) => {
    const i = HTML.indexOf("\n" + sel + "{");
    if (i < 0) return "";
    return HTML.slice(i + 1, HTML.indexOf("}", i) + 1);
  };
  const grupos = (el) => {
    const saida = [];
    const anda = (x) => Array.from(x.children || []).forEach((f) => {
      if (/(^| )rs-grupo( |$)/.test(f.className || "")) saida.push(f);
      anda(f);
    });
    anda(el);
    return saida;
  };

  /* ---- O1: acabou a coluna dividida ---- */
  {
    /* AS DUAS BARRAS DE ROLAGEM eram consequência de dois contêineres
     * roláveis lado a lado. Sem a coluna, não há o segundo. */
    ok(HTML.indexOf("qs-com-rascunho") < 0,
       "O1 a coluna dividida do rascunho continua no CSS");
    const cx = cssRegra("#dlgQsResponder .rs-caixa");
    ok(/position:absolute/.test(cx),
       "O1b o rascunho nao e um painel sobreposto: " + cx.slice(0, 80));
    /* PARA EM 72%: ler a questão enquanto se faz a conta é metade do
     * gesto, e um painel de tela cheia por padrão tiraria isso. */
    ok(/max-height:7\d%/.test(cx),
       "O1c o painel cobre a tela toda por padrao: " + cx.slice(0, 120));
  }

  /* ================================================================
   * O0: OS GATILHOS EXISTEM DESDE O ARRANQUE
   *
   * Foi assim que o rascunho sumiu da tela inteira: o rótulo dos botões
   * era escrito por rsPintarGatilhos(), que só roda depois de
   * rsPrepararPara() — e essa roda dentro de um try/catch na tela de
   * questões. Um tropeço ali, engolido em silêncio, deixava dois botões
   * sem texto e escondidos. Sem erro, sem aviso, sem caminho de volta.
   *
   * Um botão que ABRE uma coisa não pode depender de essa coisa já ter
   * sido montada: é ele quem a monta.
   * ============================================================== */
  {
    const { api } = rodar();
    /* NADA de rsIniciar, NADA de questão: o estado do arranque */
    api.qsUiIniciar();
    const b1 = api.$("btnRsAbrir");
    ok(b1.hidden === true,
       "O0 (19.114.0) o 'rascunho' do cabecalho fica escondido: a entrada e o ✏️ do lapis");
    ok(/\S/.test(b1.textContent || ""),
       "O0b o gatilho nasce sem rotulo — um botao sem texto e um botao invisivel");
    /* o rótulo vem do HTML, então vale mesmo que nenhum JS tenha rodado */
    ok(/id="btnRsAbrir"[^>]*data-i18n=/.test(HTML.replace(/\n\s*/g, " ")),
       "O0d o rotulo do gatilho depende de JS em vez de vir do HTML");

    /* E CLICAR ABRE, mesmo sem questão carregada. Dependia de rsQid, e
     * um clique que não faz nada é pior do que um botão ausente. */
    ok(typeof b1.onclick === "function",
       "O0e-pre o gatilho existe na tela e nao esta ligado a nada");
    if (typeof b1.onclick === "function") b1.onclick();
    ok(api.$("rsCaixa").hidden === false,
       "O0e clicar no gatilho sem questao carregada nao abriu nada");
  }

  /* ---- O2: fechado não ocupa nada; o gatilho é que aparece ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsPrepararPara("q1");
    ok(api.$("rsCaixa").hidden === true,
       "O2 o rascunho fechado continua na tela");
    ok(api.$("btnRsAbrir").hidden === true,
       "O2b (19.114.0) o gatilho do cabecalho continua escondido com o rascunho fechado");

    ok(typeof api.$("btnRsAbrir").onclick === "function",
       "O2c-pre o gatilho nao esta ligado a nada");
    if (typeof api.$("btnRsAbrir").onclick === "function") {
      api.$("btnRsAbrir").onclick();
    }
    ok(api.rsAberto() === true, "O2c o gatilho nao abriu o rascunho");
    /* ABRE NO PAINEL PEQUENO — e a folha inteira, que era um gatilho a
     * parte, agora e so mais um toque no btnRsCheia de dentro do
     * rascunho ja aberto. Duplicar o gatilho la fora nao economizava
     * nada: era um segundo caminho para o mesmo lugar. */
    ok(api.rsCheiaAtual() === false,
       "O2d o gatilho abriu direto na folha inteira, sem pedir");
    ok(api.$("btnRsAbrir").hidden === true,
       "O2e o gatilho continua na tela com o rascunho aberto");
    ok(api.$("rsCaixa").hidden === false,
       "O2f o painel nao apareceu ao abrir");

    /* A TELA CHEIA CONTINUA A UM TOQUE, DE DENTRO */
    ok(typeof api.$("btnRsCheia").onclick === "function",
       "O2f2-pre o botao de folha inteira de dentro nao esta ligado a nada");
    api.$("btnRsCheia").onclick();
    ok(api.rsCheiaAtual() === true,
       "O2f3 btnRsCheia, de dentro do rascunho aberto, nao alcancou a folha inteira");

    /* E FECHAR DEVOLVE A TELA. Era este o defeito do desenho anterior: a
     * caixa continuava lá, vazia, com barra de título e um botão de
     * expandir um painel que não estava aberto. */
    api.rsRecolher(true);
    ok(api.$("rsCaixa").hidden === true,
       "O2g fechar o rascunho deixou o painel na tela");
    ok(api.$("btnRsAbrir").hidden === true,
       "O2h (19.114.0) fechar o quadro nao traz de volta o gatilho duplicado");
  }

  /* ================================================================
   * O1b: FOLHA INTEIRA É A TELA DO APARELHO
   *
   * Era "absolute" com top:0 — e absolute mede o DIÁLOGO, que já está
   * limitado a 92vh e tem recuo dos quatro lados. O painel ia até o topo
   * do diálogo e parava ali: escondia a questão e não crescia nada.
   * ============================================================== */
  {
    const r = cssRegra("#dlgQsResponder.rs-cheia .rs-caixa");
    ok(/position:fixed/.test(r),
       "O1b-cheia a folha inteira mede o dialogo, nao a tela: " + r.slice(0, 90));
    ok(/inset:0/.test(r) && /width:100vw/.test(r),
       "O1b2 a folha inteira nao ocupa a tela: " + r.slice(0, 110));
    /* 100dvh, e não só 100vh: no telefone a barra do navegador entra e
     * sai, e com vh o fim da folha — onde ficam salvar e limpar — some
     * atrás dela. */
    ok(/height:100dvh/.test(r),
       "O1b3 sem dvh o rodape da folha some atras da barra do navegador: "
       + r.slice(0, 110));

    /* DOIS BOTÕES PARA O MESMO GESTO: na folha inteira, "recolher" e
     * "voltar à questão" faziam a mesma coisa. */
    ok(/#dlgQsResponder\.rs-cheia #btnRsMin\{display:none\}/.test(HTML),
       "O1b4 o 'recolher' continua na folha inteira, ao lado do 'voltar'");
  }

  /* ---- O1c: a folha cresce com a tela, e o traço acompanha ---- */
  {
    const { api, janela } = rodar();
    /* UMA TELA DE VERDADE. Sem medida de janela, rsFolhaDaTela() cai no
     * valor de reserva — e aí ele e o valor fixo são a mesma coisa, o
     * que faz este teste passar mesmo com a medida desligada. */
    janela.innerWidth = 1024;
    janela.innerHeight = 768;
    janela.devicePixelRatio = 1;
    api.rsIniciar();
    api.rsPrepararPara("q1");
    api.rsRecolher(false);
    const cv = api.rsTela();
    const normal = cv.width * cv.height;
    /* um traço no meio, para denunciar deslocamento */
    api.rsTracosAtual().length = 0;
    api.rsTracosAtual().push({ cor: "#111", larg: 4,
      pontos: [[api.RS_FOLHA_NORMAL.w / 2, api.RS_FOLHA_NORMAL.h / 2]] });

    api.rsCheiaTrocar(true);
    /* NÃO É "mais pixels internos", e sim OS DA TELA.
     *
     * A primeira versão deste teste exigia área interna maior — e isso é
     * falso num telefone: 390x694 tem MENOS pixels que a folha normal de
     * 900x420, e ainda assim é muito mais área física para a mão. O que
     * precisa valer é que a folha passe a ser do tamanho da tela; o
     * quanto isso representa em pixels depende do aparelho. */
    ok(cv.width * cv.height !== normal,
       "O1c a folha inteira ficou do mesmo tamanho da normal: "
       + cv.width + "x" + cv.height);
    /* MEDIDA DA JANELA, não um número fixo: um valor fixo é grande demais
     * num telefone e pequeno demais num monitor. */
    const f = api.rsFolhaDaTela();
    ok(f.w !== api.RS_FOLHA_CHEIA.w,
       "O1c2-pre a medida da tela e o valor de reserva coincidiram: "
       + JSON.stringify(f));
    ok(cv.width === f.w && cv.height === f.h,
       "O1c2 a folha inteira nao usou a medida da tela: "
       + cv.width + "x" + cv.height + " vs " + f.w + "x" + f.h);
    const p0 = api.rsTracosAtual()[0].pontos[0];
    ok(Math.abs(p0[0] - f.w / 2) < 2 && Math.abs(p0[1] - f.h / 2) < 2,
       "O1c3 o traco do meio saiu do meio ao crescer: " + JSON.stringify(p0));
  }

  /* ---- O1d: ver a questão atrás é escolha, e só na folha inteira ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsPrepararPara("q1");
    api.rsRecolher(false);
    ok(api.$("btnRsVidro").hidden === true,
       "O1d o 'ver a questao' aparece no painel de 72%, onde ela ja esta visivel");
    api.rsCheiaTrocar(true);
    /* (19.114.0) riscar por cima do enunciado é o lápis da própria questão (que agora cobre a questão inteira): a
     * folha transparente saiu de cena */
    ok(api.$("btnRsVidro").hidden === true,
       "O1d2 (19.114.0) o 'ver a questao' saiu: riscar sobre o enunciado e o lapis da questao");
    /* PAPEL É O PADRÃO: número escrito sobre texto não se lê, e somar um
     * balanço é o caso que pediu a folha inteira. */
    ok(api.rsVidroAtual() === false,
       "O1d3 a folha inteira abriu transparente por padrao");
    api.rsVidroTrocar(true);
    ok(api.rsVidroAtual() === true, "O1d4 nao deu para ver a questao atras");
    /* e SAIR da folha inteira leva o vidro junto: ligado por baixo, o
     * painel de 72% abriria sem papel */
    api.rsCheiaTrocar(false);
    ok(api.rsVidroAtual() === false,
       "O1d5 o fundo transparente sobreviveu a saida da folha inteira");
  }

  /* ---- O3: a barra tem três grupos, e a ordem é a do gesto ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsPrepararPara("q1");
    api.rsRecolher(false);
    /* os grupos são declarados no HTML — o simulador registra os ids mas
     * não monta a árvore do que vem em markup, então a leitura é pelos
     * ids, e a existência dos três se confere no próprio HTML */
    const barra = HTML.slice(HTML.indexOf('id="rsFerramentas"'),
      HTML.indexOf("</div>", HTML.indexOf('id="btnRsMin"')));
    ok(/rs-grupo-esq/.test(barra) && /rs-grupo-centro/.test(barra)
       && /rs-grupo-dir/.test(barra),
       "O3 a barra do rascunho nao tem os tres grupos");
    const gEsq = api.$("rsGrupoEsq"), gCen = api.$("rsGrupoCen");
    ok(!!gEsq && !!gCen, "O3b os grupos nao existem na tela");

    /* ESQUERDA: com o que escrever. Quatro cores e três espessuras. */
    const nEsq = (gEsq.children || []).length;
    ok(nEsq === 7, "O3c a esquerda devia ter cores e espessuras: " + nEsq);
    /* CENTRO: o que desfaz — borracha, os tamanhos dela, e limpar. */
    const cen = (gCen.children || []).map((b) => b.id || b.textContent || "");
    ok(cen.some((x) => /Borracha/i.test(x)),
       "O3d a borracha nao esta no grupo do meio: " + cen.join(" | "));
    ok(cen.some((x) => /Limpar/i.test(x)),
       "O3e limpar tudo nao esta junto da borracha: " + cen.join(" | "));
    /* e o tamanho da JANELA não pode estar junto do desenho: era o que
     * fazia a mão procurar a caneta e achar o "recolher" */
    ok(!cen.some((x) => /Cheia|Min|Modo/i.test(x)),
       "O3f o tamanho da janela vazou para o grupo das ferramentas: "
       + cen.join(" | "));
    /* e a direita, que vem do HTML, tem os três de janela e modo */
    const dir = HTML.slice(HTML.indexOf('rs-grupo-dir'),
      HTML.indexOf("</span>", HTML.indexOf('id="btnRsMin"')));
    ok(/id="btnRsModo"/.test(dir) && /id="btnRsCheia"/.test(dir)
       && /id="btnRsMin"/.test(dir),
       "O3g a direita nao tem modo, folha inteira e recolher");
  }

  /* O BLOCO O4 SAIU: comparava a arrumação em três grupos da barra do
     grifo com a do rascunho. O grifo não tem mais barra de desenho —
     são quatro cores e um ⋮. */

  /* ---- O5: o selo diz que há rascunho guardado ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsPrepararPara("q1");
    const selo = () => {
      const b = api.$("btnRsAbrir");
      return ((b.children || []).filter((f) =>
        /rs-selo/.test(f.className || ""))).length;
    };
    ok(selo() === 0, "O5 selo de rascunho guardado numa questao sem nada");

    api.rsRecolher(false);
    api.rsComecar({ clientX: 10, clientY: 10 });
    api.rsMover({ clientX: 40, clientY: 40 });
    api.rsSoltar({});
    const p = api.rsSalvarNaQuestao();
    api._uiFechar(true);
    await Promise.resolve();
    await p;
    api.rsRecolher(true);
    /* SEM O SELO, saber se aquela questão tem conta guardada exige abrir
     * o rascunho. Numa segunda passada por trinta questões, é a
     * diferença entre olhar e abrir trinta vezes. */
    ok(selo() === 1, "O5b a questao com rascunho salvo nao ganhou selo");
  }

  /* ---- O6: caneta ou teclado, e o texto é salvo junto ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsPrepararPara("q9");
    api.rsRecolher(false);
    ok(api.rsModoAtual() === "caneta", "O6 devia comecar na caneta");
    ok(api.$("rsTela").hidden === false && api.$("rsTexto").hidden === true,
       "O6b a folha e o campo de texto nao estao no modo certo");

    api.rsModoTrocar();
    ok(api.rsModoAtual() === "teclado", "O6c nao trocou para o teclado");
    ok(api.$("rsTela").hidden === true && api.$("rsTexto").hidden === false,
       "O6d trocar de modo nao trocou o que aparece");

    api.$("rsTexto").value = "Ativo 1.000\nPassivo 400\nPL 600";
    /* TRAÇO OU TEXTO: as duas metades do mesmo rascunho. Exigir traço
     * faria "salvar" recusar uma conta inteiramente digitada. */
    const p = api.rsSalvarNaQuestao();
    api._uiFechar(true);
    await Promise.resolve();
    await p;
    const g = api.rsDaQuestao("q9");
    ok(!!g, "O6e o rascunho so de texto nao foi guardado");
    ok(/PL 600/.test((g || {}).texto || ""),
       "O6f o texto digitado nao foi salvo: " + JSON.stringify((g || {}).texto));

    /* (19.114.0) o "modo teclado" deu lugar às caixas de texto NA folha: o texto antigo volta como a primeira caixa,
     * no alto, ao lado de onde se desenha */
    api.rsPrepararPara("q9");
    ok(api.rsModoAtual() === "caneta" && api.rsNotasAtual().length === 1 && /PL 600/.test(api.rsNotasAtual()[0].t),
       "O6g (19.114.0) o texto do antigo modo teclado volta como uma caixa na folha: " + JSON.stringify(api.rsNotasAtual()));
    ok(/PL 600/.test(api.rsTextoAtual()),
       "O6h o texto guardado nao voltou: " + api.rsTextoAtual());
  }

  /* ---- (19.114.0) O7: caixas de texto e símbolos no quadro ---- */
  {
    const { api } = rodar();
    const tr = (txt, pos) => api.simbAutoTrocar(txt, pos === undefined ? txt.length : pos);
    ok(tr("p ->").txt === "p →" && tr("p <->").txt === "p ↔" && tr("x <=").txt === "x ≤" && tr("a !=").txt === "a ≠"
       && tr("(1+i)^n").txt === "(1+i)ⁿ" && tr("x^2").txt === "x²" && tr("x¹2").txt === "x¹²" && tr("abc").txt === "abc",
       "O7 atalhos que viram simbolo: " + ["p ->", "p <->", "x <=", "a !=", "(1+i)^n", "x^2", "x¹2"].map((x) => tr(x).txt).join(" | "));
    ok(tr("p -> q", 4).txt === "p → q" && tr("p -> q", 4).pos === 3, "O7a troca so o que acabou de ser digitado, antes do cursor");
    const ja = "a->b ";
    const blk = api.simbAutoTrocar(ja + "M = C(1+i)^n -> x <= 2^12", (ja + "M = C(1+i)^n -> x <= 2^12").length, 20);
    ok(blk.txt === "a->b M = C(1+i)ⁿ → x ≤ 2¹²", "O7a2 um trecho inteiro de uma vez (ditado, correcao automatica): troca o trecho e deixa o texto de antes: " + blk.txt);
    api.rsIniciar();
    api.rsPrepararPara("q7");
    api.rsRecolher(false);
    api.rsNotaNova(100, 60, "Ativo 1.000");
    api.rsNotaNova(100, 200, "");
    ok(api.rsNotasAtual().length === 2 && api.rsTemAlgo() === true, "O7b duas caixas na folha");
    api.rsInserirSimbolo("Σ");
    ok(api.rsNotasAtual()[1].t === "Σ", "O7c o simbolo vai para a caixa em uso: " + JSON.stringify(api.rsNotasAtual()));
    api.rsComecar({ clientX: 10, clientY: 10 }); api.rsMover({ clientX: 40, clientY: 40 }); api.rsSoltar({});
    api.rsNotaNova(300, 300, "   ");
    const p = api.rsSalvarNaQuestao();
    api._uiFechar(true);
    await Promise.resolve();
    await p;
    const g = api.rsDaQuestao("q7");
    ok(g && g.notas && g.notas.length === 2 && g.notas[0].x === 100 && g.notas[0].y === 60 && g.tracos.length === 1,
       "O7d desenho e texto guardados juntos; caixa em branco nao vai: " + JSON.stringify(g && g.notas));
    api.rsPrepararPara(null);
    api.rsPrepararPara("q7");
    ok(api.rsNotasAtual().length === 2 && api.rsNotasAtual()[0].t === "Ativo 1.000" && api.rsTracosAtual().length === 1,
       "O7e e voltam juntos, no lugar: " + JSON.stringify(api.rsNotasAtual()));
    api.rsRedimensionar(api.RS_FOLHA_NORMAL.w * 2, api.RS_FOLHA_NORMAL.h * 2);
    ok(api.rsNotasAtual()[0].x === 200 && api.rsNotasAtual()[0].y === 120, "O7f a folha cresce: as caixas acompanham");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
