/* ENXUGAR A TELA — quatro lugares onde a interface cobrava espaço sem
 * entregar informação.
 *
 * O fio comum: coisa que serve UMA vez ocupando lugar TODAS as vezes.
 * Sete botões de caneta antes das alternativas em toda questão, mesmo
 * nas que ninguém marca. Quatro botões repetidos em cada linha de uma
 * lista de dezenas. Um parágrafo de instrução lido na primeira semana e
 * pulado nas outras cinquenta. E a mesma frase de três números repetida
 * seis vezes, quando três colunas alinhadas diriam o mesmo de relance.
 *
 * O custo não era só estético: era essa soma que empurrava o botão de
 * avançar para fora da tela. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(
  path.join(__dirname, "..", "docs", "index.html"), "utf8");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const acharClasse = (el, cls, saida) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) saida.push(f);
      acharClasse(f, cls, saida);
    });
    return saida;
  };
  /* botões que a pessoa REALMENTE vê: escondido dentro de escondido
   * continua escondido, e é isso que a contagem precisa respeitar */
  const visiveis = (el) => {
    const saida = [];
    const anda = (x, oculto) => Array.from(x.children || []).forEach((f) => {
      const off = oculto || f.hidden === true;
      if (f.tag === "button" && !off) saida.push(f);
      anda(f, off);
    });
    anda(el, el.hidden === true);
    return saida;
  };
  /* ANCORADO NO COMEÇO DA LINHA. Sem isso, procurar ".lac-linha{"
   * encontrava o pedaço final de ".lac-cab,.lac-linha{" — e comparar a
   * regra combinada com ela mesma passa sempre, seja qual for o CSS. */
  const cssRegra = (sel) => {
    const i = HTML.indexOf("\n" + sel + "{");
    if (i < 0) return "";
    return HTML.slice(i + 1, HTML.indexOf("}", i) + 1);
  };

  /* O BLOCO E1 SAIU: ele media a barra de sete botões do grifo em
   * canvas, que ligava e desligava. Não há mais película para ligar —
   * o grifo virou <mark> no próprio texto, e a barra tem quatro cores
   * fixas. O que substitui esta verificação está em tests/grifo.js. */

  /* ================================================================
   * E2: as ferramentas do rascunho não podem ser CORTADAS
   *
   * Elas já moraram na barra do título, para economizar uma linha. Numa
   * coluna estreita — que é o que o rascunho vira quando fica ao lado da
   * questão — as canetas passavam da borda e a caixa, que tem
   * overflow:hidden, simplesmente as ENGOLIA: sem barra de rolagem, sem
   * reticências, sem nenhum sinal de que havia mais botões ali. Um botão
   * cortado é pior do que um botão ausente, porque a pessoa vê metade
   * dele e conclui que o app está quebrado.
   * ============================================================== */
  {
    const { api } = rodar();
    /* a faixa é FILHA DO CORPO, não da barra do título: é ali que ela
     * pode ocupar as linhas de que precisar */
    const corpo = HTML.slice(HTML.indexOf('id="rsCorpo"'),
      HTML.indexOf('id="rsTela"'));
    ok(/id="rsFerramentas"/.test(corpo),
       "E2 as ferramentas do rascunho nao estao na barra propria do corpo");
    ok(HTML.indexOf('<div class="rs-topo">') < 0,
       "E2b a barra de titulo voltou — ela era uma linha inteira para dizer"
       + " o que a propria barra de ferramentas ja diz");

    /* A CAIXA CORTA — e é por isso que a faixa TEM de quebrar. As duas
     * regras juntas são o defeito; separadas, nenhuma é. */
    const caixa = cssRegra(".rs-caixa");
    const fer = cssRegra(".rs-barra");
    if (/overflow:\s*hidden/.test(caixa)) {
      ok(/flex-wrap:\s*wrap/.test(fer),
         "E2c a caixa corta o que passa da borda e a faixa nao quebra: "
         + fer);
    }
    /* e nenhuma regra pode voltar a impedir a quebra */
    ok(HTML.indexOf(".rs-barra{display:inline-flex") < 0
       && !/\.rs-barra\{[^}]*flex-wrap:nowrap/.test(HTML),
       "E2d alguma regra voltou a impedir a quebra das ferramentas");

    /* e SOMEM com o rascunho recolhido: cores de caneta ao lado de um
     * rascunho fechado não são atalho, são enfeite — não há onde
     * desenhar */
    api.rsIniciar();
    api.rsRecolher(false);
    ok(api.$("rsFerramentas").hidden === false,
       "E2e rascunho aberto e as ferramentas escondidas");
    api.rsRecolher(true);
    ok(api.$("rsFerramentas").hidden === true,
       "E2f rascunho recolhido e as ferramentas continuam a mostra");
  }

  /* ================================================================
   * E3: a ação principal não sai da tela
   * ============================================================== */
  {
    /* O "Próxima" era o último elemento de um diálogo que rolava
     * inteiro: com enunciado longo, avançar virava "rolar até o fim
     * primeiro", a cada questão. */
    const r = cssRegra("#dlgQsResponder[open]");
    ok(/display:flex/.test(r) && /flex-direction:column/.test(r),
       "E3 o dialogo de responder nao virou coluna: " + r);
    /* "dvh" ENTROU NA CONTA, e não é detalhe de unidade.
     *
     * A caixa passou a ter altura FIXA — antes ela crescia até caber o
     * conteúdo, e por isso mudava de tamanho quando o comentário
     * aparecia, levando o "próxima" para um lugar diferente a cada
     * questão. Altura fixa em "vh" é exatamente o defeito que o
     * comentário do CSS descreve: vh ignora a barra do navegador, mede
     * mais do que a tela tem, e o título sai por cima da borda sem
     * rolagem que o alcance. "dvh" mede a área que existe agora.
     *
     * Então a invariante deixou de perguntar só "tem teto?" e passou a
     * perguntar "o teto é medido pela tela de verdade?". */
    ok(/max-height:9\dd?vh/.test(r),
       "E3b sem max-height o dialogo passa da tela e leva o titulo junto: " + r);
    ok(!/height:\s*\d+vh(?![a-z])/.test(r.replace(/max-height:\s*\d+vh/g, "")),
       "E3b2 altura FIXA em vh: no telefone isso mede mais do que a tela "
       + "tem e joga o titulo para cima da borda, sem rolagem que o "
       + "alcance. Use dvh: " + r);

    /* [open] NÃO É ENFEITE: um <dialog> fechado só fica escondido pelo
     * display:none da folha do navegador. Um "#dlgQsResponder{display:flex}"
     * tem especificidade de id, vence essa regra, e o diálogo passaria a
     * aparecer SEMPRE, encaixado na página, sem fundo e sem como fechar. */
    ok(HTML.indexOf("#dlgQsResponder{display:") < 0,
       "E3c display no dialogo sem exigir [open]");

    /* O QUE ROLA MUDOU DE LUGAR, E A INVARIANTE TINHA DE MUDAR JUNTO.
     *
     * Ela exigia que o CORPO INTEIRO fosse o que rola. Era o desenho
     * antigo, e o defeito dele era exatamente esse: o comentário nasce
     * depois das alternativas, então rolar o corpo inteiro é a única
     * forma de alcançá-lo — arrastar a caixa toda a cada questão
     * respondida.
     *
     * Agora o corpo é a COLUNA, e quem rola é uma das duas zonas
     * conforme o momento: o enunciado antes de responder, o comentário
     * depois. A pergunta que a invariante faz continua sendo a mesma —
     * "alguma coisa aqui dentro rola?" —, só que dirigida a quem de
     * fato rola. Sem isso, uma caixa sem nenhuma área de rolagem
     * passaria: o conteúdo simplesmente sumiria pela borda de baixo. */
    const corpo = cssRegra("#dlgQsResponder #qsSessCorpo");
    ok(/flex:1 1 auto/.test(corpo) && /flex-direction:column/.test(corpo),
       "E3d o corpo da questao nao e a coluna elastica: " + corpo);
    const enun = cssRegra("#dlgQsResponder .qs-enunciado");
    ok(/overflow:auto/.test(enun),
       "E3d2 o enunciado nao rola: sem rolagem interna, um enunciado "
       + "longo empurra as alternativas para fora da tela: " + enun);

    /* ================================================================
     * E3f: O ENUNCIADO ENCOLHE, MAS NAO ESTICA
     *
     * O DEFEITO QUE ISTO GUARDA, medido no DevTools do usuario:
     * .qs-enunciado com 824 x 680,94 para um enunciado de TRES LINHAS.
     * A causa foi "flex:1 1 auto" — que diz duas coisas ao mesmo tempo,
     * e so uma delas era desejada: "ceda espaco quando faltar" (certo)
     * e "tome o espaco que sobrar" (seiscentos pixels de buraco cinza
     * entre a pergunta e as alternativas).
     *
     * A invariante olha o FLEX-GROW porque foi ele quem errou. Um teto
     * de altura nao teria evitado nada: com flex-grow, o enunciado
     * estica ate o teto de qualquer jeito.
     * ============================================================== */
    const cresce = (r2) => /flex:\s*[1-9]/.test(r2);
    ok(!cresce(enun),
       "E3f o enunciado tem flex-grow: tres linhas de texto vao esticar "
       + "ate o fim da caixa e jogar as alternativas para o fim de um "
       + "buraco vazio. Ele deve encolher (flex:0 1 auto) e parar num "
       + "teto: " + enun);
    const enunFez = cssRegra("#dlgQsResponder .qs-fez .qs-enunciado");
    ok(!cresce(enunFez),
       "E3f2 depois de responder o enunciado volta a esticar: " + enunFez);
    ok(/max-height:\d+d?vh/.test(enun),
       "E3f3 o enunciado nao tem teto: um enunciado de trinta linhas "
       + "ocupa a caixa inteira e o comentario nao cabe: " + enun);
    /* E O TETO NAO E EM PORCENTAGEM: altura em % so resolve quando cada
     * elo da corrente flex tem altura definida, e basta o rascunho
     * abrir para ela virar "auto" sem erro nenhum. */
    ok(!/max-height:\d+%/.test(enun),
       "E3f4 teto do enunciado em porcentagem: ele deixa de valer "
       + "silenciosamente quando um elo da corrente flex perde a altura "
       + "definida: " + enun);
    const dep = cssRegra("#dlgQsResponder .qs-depois");
    ok(/overflow-y:auto/.test(dep),
       "E3d3 o bloco do gabarito e do comentario nao rola — que e a "
       + "queixa original: responder e ter de arrastar a caixa inteira "
       + "para ler o porque: " + dep);

    /* a ordem no HTML importa: a faixa principal tem de vir DEPOIS do
     * corpo, senão "preso embaixo" não quer dizer nada */
    const iCorpo = HTML.indexOf('id="qsSessCorpo"');
    const iAcao = HTML.indexOf('id="btnQsProxima"');
    ok(iCorpo > 0 && iAcao > iCorpo,
       "E3e o botao de avancar nao esta depois do corpo da questao");
  }

  /* ================================================================
   * E4: uma ação por linha, o resto no menu
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("Direito Financeiro", "Receita pública");
    api.matGravar(ch, "Receita é ingresso definitivo.",
      { disciplina: "Direito Financeiro", topico: "Receita pública",
        concurso: "TCE-PE Auditor" });
    api.matRender();

    const itens = acharClasse(api.$("matLista"), "mat-item", []);
    ok(itens.length === 1, "E4-pre devia haver 1 linha: " + itens.length);
    const acoes = acharClasse(itens[0], "mat-acoes", [])[0];
    ok(!!acoes, "E4-pre2 a linha nao tem area de acoes");

    /* DOIS BOTÕES VISÍVEIS: abrir, que é o que se faz quase sempre, e o
     * "⋮". Quatro botões repetidos em dezenas de linhas produzem uma
     * parede onde nada se destaca. */
    const vis = visiveis(acoes);
    ok(vis.length === 2,
       "E4 a linha mostra " + vis.length + " botoes; deviam ser 2 (abrir e ⋮): "
       + vis.map((b) => b.textContent).join(" | "));
    ok(vis.some((b) => (b.textContent || "").indexOf("⋮") >= 0),
       "E4b falta o menu de tres pontos: "
       + vis.map((b) => b.textContent).join(" | "));

    /* e o que saiu da linha continua existindo — sumir não é enxugar */
    const menu = acharClasse(acoes, "mat-menu", [])[0];
    ok(!!menu, "E4c o menu nao foi criado");
    ok((menu || {}).hidden === true, "E4d o menu nasceu aberto");
    const dentro = ((menu || {}).children || []).map((b) => b.textContent || "");
    ok(dentro.some((x) => /lei seca/i.test(x)),
       "E4e a lei seca sumiu em vez de mudar de lugar: " + dentro.join(" | "));

    const bt = vis.filter((b) => (b.textContent || "").indexOf("⋮") >= 0)[0];
    if (bt) bt.onclick();
    ok((menu || {}).hidden === false, "E4f tocar no ⋮ nao abriu o menu");
    if (bt) bt.onclick();
    ok((menu || {}).hidden === true, "E4g tocar de novo nao fechou o menu");
  }

  /* ---- E5: dois menus abertos ao mesmo tempo se sobrepõem ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    ["Receita pública", "Restos a pagar"].forEach((tp) => {
      api.matGravar(api.matChave("Direito Financeiro", tp), "texto de " + tp,
        { disciplina: "Direito Financeiro", topico: tp });
    });
    api.matRender();
    const menus = acharClasse(api.$("matLista"), "mat-menu", []);
    ok(menus.length === 2, "E5-pre deviam ser 2 menus: " + menus.length);
    const botoes = acharClasse(api.$("matLista"), "mat-menu-bt", []);
    ok(botoes.length === 2, "E5-pre2 deviam ser 2 botoes de menu: " + botoes.length);
    botoes.forEach((b) => b.onclick());
    /* EM LINHAS VIZINHAS, dois menus abertos se sobrepõem e o toque cai
     * no item errado — de outra disciplina. */
    ok(menus.length === 2 && menus[0].hidden === true && menus[1].hidden === false,
       "E5 abrir o segundo menu nao fechou o primeiro: "
       + menus.map((m) => m.hidden).join(","));

    /* e a escolha FECHA antes de agir: a ação abre outra janela, e um
     * menu aberto atrás dela reaparece depois, sem contexto nenhum */
    const item = ((menus[1] || {}).children || [])[0];
    ok(!!item, "E5b o menu da segunda linha esta vazio");
    if (item) item.onclick();
    ok((menus[1] || {}).hidden === true, "E5c escolher no menu nao o fechou");
  }

  /* ================================================================
   * E6: a instrução virou botão
   * ============================================================== */
  {
    const { api } = rodar();
    ok(HTML.indexOf('<p class="nota" data-i18n="mat_intro"></p>') < 0,
       "E6 o paragrafo de instrucao continua fixo na aba");
    ok(HTML.indexOf('id="btnMatIntro"') >= 0,
       "E6b nao existe botao para alcancar a instrucao");
    /* SUMIR NÃO É ENXUGAR: o texto tem de continuar alcançável, e ser o
     * mesmo texto — não uma versão encurtada que perde o que explicava. */
    ok(/\S/.test(api.t("mat_intro")) && api.t("mat_intro") !== "mat_intro",
       "E6c o texto da instrucao foi apagado junto");
    api.matIniciar();
    api.$("btnMatIntro").onclick();
    const viu = api.$("uiModalMsg").textContent || "";
    ok(viu.indexOf(api.t("mat_intro")) >= 0,
       "E6d o botao nao mostra a instrucao: " + viu.slice(0, 60));
    /* o "?" precisa DIZER o que é antes de ser tocado: um símbolo solto
     * numa barra de botões não se explica sozinho */
    ok(/\S/.test(api.$("btnMatIntro").title || ""),
       "E6e o botao de instrucao nao tem dica nenhuma");
  }

  /* ================================================================
   * E7: os buracos em colunas alinhadas
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const daqui = (d) => {
      const x = new Date(Date.now() + d * 86400000);
      return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
        + "-" + String(x.getDate()).padStart(2, "0");
    };
    /* duas disciplinas, nenhuma estudada: as duas viram buraco, que é o
     * que este painel lista */
    const ed = api.edCriar("Painel dos buracos", [
      "# Painel | prova: " + daqui(140) + " | horas: 12",
      "@ Direito Constitucional :: 5",
      "+ Princípios fundamentais :: 5",
      "+ Direitos e garantias :: 4",
      "@ Direito Financeiro :: 3",
      "+ Receita pública :: 3",
    ].join("\n"));
    api.hubAbrirEdital(ed.id);
    api.$("edProva").value = daqui(140);
    api.edRender();

    const cabs = acharClasse(api.$("edPainel"), "lac-cab", []);
    ok(cabs.length === 1,
       "E7 o painel dos buracos nao ganhou cabecalho de colunas: " + cabs.length);
    /* SEM CABEÇALHO, três porcentagens seguidas na mesma linha não dizem
     * qual é qual — e era essa confusão ("13% da prova" lido como o peso
     * da disciplina) que a frase longa tentava desfazer com palavras. */
    const rot = ((cabs[0] || {}).children || []).map((c) => c.textContent || "");
    ok(rot.length === 5,
       "E7b deviam ser 5 colunas: " + rot.join(" | "));
    ok(rot.some((x) => x === api.t("ed_lac_col_falta")),
       "E7c falta a coluna que explica a ordem da lista: " + rot.join(" | "));

    const linhas = acharClasse(api.$("edPainel"), "lac-linha", []);
    ok(linhas.length >= 1, "E7d nenhuma disciplina apareceu no painel");
    const celulas = ((linhas[0] || {}).children || []);
    ok(celulas.length === rot.length,
       "E7e a linha tem " + celulas.length + " celulas e o cabecalho "
       + rot.length + " colunas");

    /* A FRASE REPETIDA SAIU. Ela dizia as três coisas de uma vez, em
     * vermelho, seis vezes seguidas — e comparar seis frases é trabalho
     * que a tela devia fazer pelo alinhamento. */
    const txt = (linhas[0] || {}).textContent || "";
    ok(!/da prova ·/.test(txt) && !/vale \d+% ·/.test(txt),
       "E7f a frase antiga continua na linha: " + txt);
    ok(/%/.test(txt), "E7g a linha perdeu os numeros junto com a frase: " + txt);

    /* as duas grades precisam vir da MESMA definição de colunas: em dois
     * lugares elas desalinham na primeira mudança de fonte, e tabela
     * desalinhada é pior do que texto corrido */
    const g = cssRegra(".lac-cab,.lac-linha");
    ok(/grid-template-columns/.test(g),
       "E7h cabecalho e linha nao compartilham as colunas: " + g);
    const gl = cssRegra(".lac-linha");
    const cols = (r) => (r.match(/grid-template-columns:([^;}]+)/) || [])[1];
    ok(cols(g) && cols(gl) && cols(g).trim() === cols(gl).trim(),
       "E7i as colunas do cabecalho e da linha divergiram:\n"
       + cols(g) + "\n" + cols(gl));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
