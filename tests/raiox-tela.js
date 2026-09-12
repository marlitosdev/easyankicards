/* O RAIO-X CABENDO NA TELA.
 *
 * O painel é uma tabela de nove colunas e algumas centenas de linhas,
 * dentro de um diálogo de 96vw com o corpo limitado a 66vh. Num monitor
 * isso funciona. Num telefone de 540 px vira uma caixa com duas barras
 * de rolagem aninhadas — uma da página, outra do corpo — mostrando sete
 * linhas por vez e metade das colunas. Não é um problema de estilo: é o
 * painel não cabendo no lugar onde foi posto.
 *
 * Três medidas, e nenhuma delas joga informação fora:
 *
 *   1. TELA CHEIA, automática abaixo de 760 px. Nesse tamanho não há
 *      escolha a fazer — a resposta certa é sempre a mesma —, e oferecer
 *      a opção só faria a pessoa descobrir isso depois de tentar ler a
 *      tabela na janela pequena.
 *   2. ABAS EM UMA LINHA, roláveis. Embrulhadas em duas fileiras, elas
 *      roubavam altura de onde a tabela precisava dela.
 *   3. A COLUNA DO TÓPICO FIXA, e o que é recuperável some. Rolando para
 *      o lado sem a identidade da linha à vista, três colunas adiante a
 *      tabela vira uma grade de números soltos.
 *
 * O invariante que sustenta a terceira: a classe da coluna é escrita UMA
 * vez e vale para o cabeçalho e para a célula. Se fossem dois lugares,
 * uma hora um esconderia a coluna e o outro não — e a tabela continuaria
 * desenhando, alinhada, com os números embaixo do rótulo errado. Uma
 * tabela que mente alinhada é pior que uma quebrada, porque parece
 * certa. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const html = fs.readFileSync(
    path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
  /* TODOS os blocos daquele tamanho, e não o primeiro.
   * A folha tem mais de um "@media (max-width:760px)" — pegar só o
   * primeiro fazia o teste procurar as regras da tabela dentro do bloco
   * do modo foco e concluir que elas não existiam. */
  const estreito = [...css.matchAll(
    /@media\s*\(max-width:760px\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
    .map((m) => m[1]).join("\n");

  const montar = (api) => {
    api.matIniciar(); api.edIniciar();
    const e = api.edCriar("SEFAZ", [
      "# SEFAZ-AL Auditor Fiscal | prova: " + daqui(120) + " | horas: 20",
      "@ Ciência de Dados :: 5",
      "+ Bancos de dados relacionais :: 5 :: cai sempre",
      "+ Modelagem relacional :: 5",
      "@ Direito Tributário :: 3",
      "+ Sistema Tributário Nacional :: 5",
    ].join("\n"));
    api.hubAbrirEdital(e.id);
    api.$("edProva").value = daqui(120);
    api.$("edHoras").value = "20";
    return e;
  };
  const achar = (el, cls, out) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) out.push(f);
      achar(f, cls, out);
    });
    return out;
  };

  /* ================================================================
   * X1: TELA ESTREITA ABRE EM TELA CHEIA, sem perguntar
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.plIniciar();

    api.larguraTela(1200);
    api.plAbrir();
    const dlg = api.$("dlgPlanoLog");
    ok(!/plog-cheia/.test(dlg.className || ""),
       "X1-pre numa tela larga o painel ja abre ocupando tudo: "
       + dlg.className);

    api.larguraTela(540);
    api.plAbrir();
    ok(/plog-cheia/.test(dlg.className || ""),
       "X1 num telefone o painel abre na janela pequena, onde a tabela "
       + "de nove colunas nao se le: " + dlg.className);

    /* E O BOTÃO DE VOLTAR SOME. Ele ofereceria trocar para um formato
     * em que a tabela não funciona naquele tamanho — uma opção cuja
     * resposta certa é sempre a mesma não é uma opção, é uma armadilha. */
    ok(api.$("btnPlogTela").hidden === true,
       "X1b em tela estreita sobrou o botao de sair da tela cheia");
    api.larguraTela(1200);
  }

  /* ---- X2: em tela larga a escolha é de quem usa, e fica guardada ---- */
  {
    const { api } = rodar();
    montar(api);
    api.plIniciar();
    api.larguraTela(1200);
    api.plAbrir();
    const dlg = api.$("dlgPlanoLog");
    const bt = api.$("btnPlogTela");

    ok(bt.hidden !== true, "X2-pre o botao de tela cheia sumiu na tela larga");
    ok(/Tela cheia/i.test(bt.textContent || ""),
       "X2-pre2 o botao nao diz o que faz: " + bt.textContent);

    api.plTelaAlternar();
    ok(/plog-cheia/.test(dlg.className || ""),
       "X2 alternar nao levou o painel para a tela cheia");
    /* O RÓTULO ACOMPANHA. Um botão que continua dizendo "tela cheia"
     * depois de já estar em tela cheia manda o usuário adivinhar. */
    ok(/Sair/i.test(bt.textContent || ""),
       "X2b o rotulo do botao nao mudou: " + bt.textContent);

    /* GUARDADA: numa tela grande a janela flutuante tem uma vantagem
     * real (dá para ver a agenda atrás), então a escolha é dele e
     * precisa sobreviver a fechar e abrir. */
    api.$("dlgPlanoLog").close();
    api.plAbrir();
    ok(/plog-cheia/.test(dlg.className || ""),
       "X2c a escolha de tela cheia nao sobreviveu a reabrir o painel");

    api.plTelaAlternar();
    api.$("dlgPlanoLog").close();
    api.plAbrir();
    ok(!/plog-cheia/.test(dlg.className || ""),
       "X2d voltar para a janela nao foi guardado");
  }

  /* ================================================================
   * X2e: O TAMANHO QUE O DEDO DEIXOU GRAVADO
   *
   * O diálogo tem "resize: both" — arrastar o canto é gesto legítimo, e
   * o navegador guarda o resultado como estilo INLINE no elemento.
   * Estilo inline vence QUALQUER regra de classe, inclusive
   * ".plog-cheia{width:100vw}".
   *
   * Foi por isso que a tela cheia parecia só esticar para baixo: a
   * largura continuava presa no valor de um arrasto feito antes, e
   * nenhum ajuste de CSS resolvia — o problema não estava no CSS.
   * ============================================================== */
  {
    const { api } = rodar();
    api.plIniciar();
    api.larguraTela(1400);
    api.plAbrir();
    const dlg = api.$("dlgPlanoLog");

    /* A PESSOA ARRASTOU O CANTO em algum momento. É o que o navegador
     * escreve, e é o estado real de quem usa o painel há semanas. */
    dlg.style.width = "550px";
    dlg.style.height = "700px";

    api.plTelaAlternar();
    ok(dlg.style.width === "",
       "X2e a largura do arrasto continua presa e a tela cheia nao "
       + "alarga: " + dlg.style.width);
    ok(dlg.style.height === "",
       "X2e2 a altura do arrasto continua presa: " + dlg.style.height);

    /* REPINTAR NÃO PODE PERDER O QUE FOI GUARDADO. plTelaAplicar roda a
     * cada repintura, e na segunda o que ele leria já seria o vazio que
     * ele mesmo escreveu. */
    api.plTelaAplicar();
    api.plTelaAplicar();
    const g = api.plTamanhoGuardadoAtual();
    ok(g && g.w === "550px",
       "X2f repintar apagou o tamanho guardado: " + JSON.stringify(g));

    /* SAIR DEVOLVE EXATAMENTE O QUE ESTAVA LÁ. O arrasto é trabalho da
     * pessoa; a tela cheia empresta a largura, não confisca. */
    api.plTelaAlternar();
    ok(dlg.style.width === "550px" && dlg.style.height === "700px",
       "X2g sair da tela cheia nao devolveu o tamanho arrastado: "
       + dlg.style.width + " x " + dlg.style.height);
    ok(api.plTamanhoGuardadoAtual() === null,
       "X2h o tamanho ficou guardado depois de devolvido, e a proxima "
       + "entrada em tela cheia nao vai guardar o valor novo");

    /* E SEM ARRASTO NENHUM não inventa tamanho ao sair. */
    api.plTelaAlternar();
    api.plTelaAlternar();
    ok(dlg.style.width === "550px",
       "X2i o ciclo mexeu no tamanho sem a pessoa ter arrastado nada: "
       + dlg.style.width);
  }

  /* ================================================================
   * X3: O CORPO OCUPA O QUE SOBRA, em tela cheia
   *
   * Sem isto o "max-height:66vh" continuaria valendo dentro de um
   * diálogo de 100vh — e sobraria uma faixa vazia de um terço da tela
   * embaixo da tabela, que é justamente o espaço que se foi buscar.
   * ============================================================== */
  {
    const corpo = (css.match(/\.plog-cheia\s+\.plog-corpo\s*\{([^}]*)\}/) || [])[1] || "";
    ok(corpo, "X3-pre nao ha regra para o corpo em tela cheia");
    ok(/max-height\s*:\s*none/.test(corpo),
       "X3 em tela cheia o corpo continua limitado a 66vh: " + corpo);
    ok(/flex\s*:/.test(corpo),
       "X3b o corpo nao cresce para ocupar o que sobra: " + corpo);

    /* A REGRA DE GEOMETRIA, com o seletor que ela precisa ter.
     *
     * "dialog.plog-cheia[open]" — o "dialog." porque a regra geral
     * "dialog.ui-modal" é elemento+classe e venceria uma classe
     * sozinha; o "[open]" porque a regra dá display ao diálogo (E7).
     * O padrão antigo casava com qualquer coisa que contivesse
     * ".plog-cheia" e pegou a primeira, que agora é outra regra. */
    const cheia = (css.match(/dialog\.plog-cheia\[open\]\s*\{([^}]*)\}/) || [])[1] || "";
    ok(/display\s*:\s*flex/.test(cheia) && /column/.test(cheia),
       "X3c o dialogo em tela cheia nao vira coluna — sem isso o corpo "
       + "nao tem de onde crescer: " + cheia);

    /* O ESTADO TEM NOME PRÓPRIO e a regra dele desenha forma — o que é
     * seguro porque "plog-cheia" NÃO está escrito em nenhum class= do
     * HTML. Se estivesse, seria a repetição do defeito que encolheu a
     * faixa de navegação para 20 px (E15). */
    ok(!/class="[^"]*\bplog-cheia\b/.test(html),
       "X3d 'plog-cheia' virou identidade no HTML alem de estado no JS");
  }

  /* ---- X4: as abas em uma linha só ---- */
  {
    /* A REGRA BASE, e não a primeira que mencione ".plog-abas".
     *
     * O padrão antigo casava com qualquer regra que contivesse o nome —
     * e pegou ".plog-cheia .plog-abas{min-height:38px}", que aparece
     * antes no arquivo. O teste passou a examinar uma regra que não
     * fala de embrulho nenhum e acusou falha onde não havia. Ancorar
     * em início de LINHA resolve: a regra base abre a linha com
     * ".plog-abas"; a outra abre com ".plog-cheia". */
    const abas = (css.match(/^\.plog-abas\s*\{([^}]*)\}/m) || [])[1] || "";
    ok(/flex-wrap\s*:\s*nowrap/.test(abas),
       "X4 as abas voltaram a embrulhar em duas fileiras, roubando "
       + "altura da tabela: " + abas);
    ok(/overflow-x\s*:\s*auto/.test(abas),
       "X4b as abas nao embrulham E nao rolam: as ultimas ficam "
       + "inalcancaveis numa tela estreita: " + abas);
  }

  /* ================================================================
   * X5: CABEÇALHO E CÉLULA COMPARTILHAM A CLASSE DA COLUNA
   *
   * É o invariante que permite esconder e fixar colunas pelo CSS. Se
   * cabeçalho e célula pudessem divergir, a tabela continuaria
   * desenhando — alinhada, e com os números embaixo do rótulo errado.
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.plIniciar();
    api.larguraTela(540);
    api.plAbrir();
    /* a aba da SEMANA é a que tem as nove colunas; o painel abre na de
     * disciplinas, que tem duas */
    api.plAbaTrocar("fila");

    const box = api.$("plogCorpo");
    const ths = achar(box, "plog-so-largo", []).filter((x) => x.tag === "th");
    const tds = achar(box, "plog-so-largo", []).filter((x) => x.tag === "td");
    ok(ths.length === 2,
       "X5-pre nao sao duas as colunas que somem em tela estreita: "
       + ths.length);
    /* uma linha por item da semana, duas colunas cada */
    ok(tds.length > 0 && tds.length % ths.length === 0,
       "X5 o numero de celulas marcadas nao bate com o de cabecalhos: "
       + tds.length + " celulas para " + ths.length + " colunas");

    const thTop = achar(box, "plog-col-top", []).filter((x) => x.tag === "th");
    const tdTop = achar(box, "plog-col-top", []).filter((x) => x.tag === "td");
    ok(thTop.length === 1,
       "X5b a coluna fixa do topico nao tem exatamente um cabecalho: "
       + thTop.length);
    ok(tdTop.length === tds.length / ths.length,
       "X5c a coluna fixa nao tem uma celula por linha: " + tdTop.length);

    /* A DISCIPLINA VIAJA JUNTO DO TÓPICO, sempre. É o que permite
     * esconder a coluna própria dela sem perder a informação — e é o
     * CSS, não o JavaScript, que decide qual das duas cópias aparece.
     * Montar isto por largura no JS criaria um desenho que muda com o
     * tamanho da janela sem ninguém repintar. */
    const disc = achar(box, "plog-top-disc", []);
    ok(disc.length === tdTop.length,
       "X5d a disciplina nao acompanha cada celula de topico: "
       + disc.length + " para " + tdTop.length + " linhas");
    ok((disc[0] || {}).textContent,
       "X5e a linha da disciplina veio vazia");

    /* e quem manda é o CSS: em tela larga essa cópia não aparece */
    const regra = (css.match(/\.plog-top-disc\s*\{([^}]*)\}/) || [])[1] || "";
    ok(/display\s*:\s*none/.test(regra),
       "X5f a disciplina aparece duas vezes na tela larga: " + regra);
    ok(/\.plog-top-disc\s*\{\s*display\s*:\s*block/.test(estreito),
       "X5g em tela estreita a disciplina continua escondida — a coluna "
       + "dela some e a informacao some junto");
    ok(/\.plog-so-largo\s*\{\s*display\s*:\s*none/.test(estreito),
       "X5h as colunas dispensaveis nao somem em tela estreita");
    ok(/\.plog-col-top\s*\{[^}]*position\s*:\s*sticky/.test(estreito),
       "X5i a coluna do topico nao fica fixa ao rolar para o lado");
    api.larguraTela(1200);
  }

  /* ---- X6: a tabela continua completa; nada foi jogado fora ---- */
  {
    const { api } = rodar();
    montar(api);
    api.plIniciar();
    api.larguraTela(540);
    api.plAbrir();
    api.plAbaTrocar("fila");
    const box = api.$("plogCorpo");
    const todos = [];
    const varrer = (el) => {
      Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); });
    };
    varrer(box);
    const cabecalhos = todos.filter((x) => x.tag === "th");
    /* NOVE COLUNAS, sempre. Esconder é trabalho do CSS: quem tem tela
     * larga, ou gira o telefone, vê tudo — e o relatório copiado
     * continua trazendo os números que a tela estreita não mostra. */
    ok(cabecalhos.length === 9,
       "X6 a tabela perdeu colunas de verdade em vez de escondê-las: "
       + cabecalhos.length);

    const txt = (api.$("plogCorpo").textContent || "");
    ok(/Bancos de dados relacionais/.test(txt),
       "X6b o topico sumiu da tabela em tela estreita");
    api.larguraTela(1200);
  }

  /* ---- X7: girar o aparelho não deixa a janela presa ---- */
  {
    const { api, janela } = rodar();
    montar(api);
    api.plIniciar();
    api.larguraTela(1200);
    api.plAbrir();
    ok(!/plog-cheia/.test(api.$("dlgPlanoLog").className || ""),
       "X7-pre comecou em tela cheia sem motivo");

    /* deitar o telefone é estreitar a tela com o painel ABERTO: sem
     * reagir, ficaria uma janela pequena de nove colunas na mão de quem
     * acabou de pedir mais espaço */
    api.$("dlgPlanoLog").open = true;
    api.larguraTela(500);
    (janela.__ouvintes && janela.__ouvintes.resize || []).forEach((f) => f());
    if (!(janela.__ouvintes && janela.__ouvintes.resize)) {
      /* o simulador pode não guardar ouvintes de window; então ao menos
       * a regra tem de valer quando o painel for repintado */
      api.plAbrir();
    }
    ok(/plog-cheia/.test(api.$("dlgPlanoLog").className || ""),
       "X7 estreitar a tela com o painel aberto deixou a janela pequena");
    api.larguraTela(1200);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
