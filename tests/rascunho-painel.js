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
    const b1 = api.$("btnRsAbrir"), b2 = api.$("btnRsAbrirCheia");
    ok(b1.hidden === false && b2.hidden === false,
       "O0 os gatilhos nascem escondidos e so aparecem se algo mais rodar");
    ok(/\S/.test(b1.textContent || ""),
       "O0b o gatilho nasce sem rotulo — um botao sem texto e um botao invisivel");
    ok(/\S/.test(b2.textContent || ""),
       "O0c o gatilho da folha inteira nasce sem rotulo");
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

  /* ---- O2: fechado não ocupa nada; os gatilhos é que aparecem ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsPrepararPara("q1");
    ok(api.$("rsCaixa").hidden === true,
       "O2 o rascunho fechado continua na tela");
    ok(api.$("btnRsAbrir").hidden === false && api.$("btnRsAbrirCheia").hidden === false,
       "O2b os dois gatilhos deviam estar a mao com o rascunho fechado");

    ok(typeof api.$("btnRsAbrirCheia").onclick === "function",
       "O2c-pre o gatilho da folha inteira nao esta ligado a nada");
    if (typeof api.$("btnRsAbrirCheia").onclick === "function") {
      api.$("btnRsAbrirCheia").onclick();
    }
    /* o gatilho da folha inteira ABRE JÁ NELA: se abrisse no painel de
     * 72% e coubesse à pessoa expandir depois, seriam dois toques para
     * um pedido que ela já fez. */
    ok(api.rsAberto() === true, "O2c o gatilho da folha inteira nao abriu");
    ok(api.rsCheiaAtual() === true,
       "O2d o gatilho da folha inteira abriu no painel pequeno");
    ok(api.$("btnRsAbrir").hidden === true && api.$("btnRsAbrirCheia").hidden === true,
       "O2e os gatilhos continuam na tela com o rascunho aberto");
    ok(api.$("rsCaixa").hidden === false,
       "O2f o painel nao apareceu ao abrir");

    /* E FECHAR DEVOLVE A TELA. Era este o defeito do desenho anterior: a
     * caixa continuava lá, vazia, com barra de título e um botão de
     * expandir um painel que não estava aberto. */
    api.rsRecolher(true);
    ok(api.$("rsCaixa").hidden === true,
       "O2g fechar o rascunho deixou o painel na tela");
    ok(api.$("btnRsAbrir").hidden === false,
       "O2h fechar o rascunho nao devolveu o gatilho");
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
    ok(api.$("btnRsVidro").hidden === false,
       "O1d2 falta o 'ver a questao' na folha inteira");
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

    /* e volta NO MODO em que há conteúdo: abrir na caneta mostraria uma
     * folha em branco sobre um rascunho que existe */
    api.rsPrepararPara("q9");
    ok(api.rsModoAtual() === "teclado",
       "O6g voltou na caneta para um rascunho que era de texto");
    ok(/PL 600/.test(api.rsTextoAtual()),
       "O6h o texto guardado nao voltou: " + api.rsTextoAtual());
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
