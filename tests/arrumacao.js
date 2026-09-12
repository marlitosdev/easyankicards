/* ARRUMAÇÃO DE TELA: a barra de modos, as gavetas do leitor de lei e o
 * prompt do caderno.
 *
 * O fio comum aos três: coisa demais visível ao mesmo tempo. Uma faixa
 * de navegação sem nome, catorze botões numa fila só, e quarenta linhas
 * de prompt empurrando para baixo o campo que a pessoa de fato usa. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const visiveis = (el) => {
    const saida = [];
    const anda = (x, escondido) => Array.from(x.children || []).forEach((f) => {
      const oculto = escondido || f.hidden === true;
      if (f.tag === "button" && !oculto) saida.push(f);
      anda(f, oculto);
    });
    anda(el, el.hidden === true);
    return saida;
  };

  /* ---- A1: a barra de modos tem nome e recolhe ---- */
  {
    const { api } = rodar();
    api.montarBarraModos();

    const html = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    /* A FAIXA NUNCA SE APRESENTOU: cinco lugares diferentes do app sem
     * uma palavra dizendo que aquilo e a navegacao pareciam botoes
     * soltos acima do conteudo. */
    ok(html.indexOf('data-i18n="modos_titulo"') >= 0,
       "A1 a faixa de modos continua sem nome");
    ok(/\S/.test(api.t("modos_titulo")) && api.t("modos_titulo") !== "modos_titulo",
       "A1b o nome da faixa nao foi escrito: " + api.t("modos_titulo"));

    const cx = api.$("modosCaixa");
    const recolhida = () => /(^| )modos-recolhida( |$)/.test(cx.className || "");
    ok(!recolhida(), "A1c a faixa nasceu recolhida sem ninguem pedir");

    api.$("btnModosRecolher").onclick();
    ok(recolhida(), "A1d o botao nao recolheu a faixa: " + cx.className);

    /* O ESTADO NÃO PODE USAR A CLASSE DO BOTÃO.
     *
     * "modos-min" é a classe do botão de recolher — "all:unset", 20x20,
     * borda. Enquanto o estado da faixa se chamava igual, recolher punha
     * essa classe no CONTÊINER, e a regra base (que casa por classe
     * simples) se aplicava a ele também: a faixa de navegação inteira
     * virava uma caixinha de 20 pixels.
     *
     * Esta asserção olha o nome porque é o nome que carrega o desenho —
     * o simulador não calcula CSS, e o estrago acontecia na cascata. */
    ok(!/(^| )modos-min( |$)/.test(cx.className || ""),
       "A1d2 o contentor recebeu 'modos-min', que e' a classe do BOTAO "
       + "(all:unset, 20x20): a faixa inteira encolhe para 20 pixels — "
       + cx.className);

    /* E A REGRA EXIGE A ETIQUETA <button>. É a segunda tranca: com
     * "all:unset" e 20x20 dentro, uma regra de classe solta apaga o
     * layout de qualquer elemento em que caia. Exigindo <button>, a
     * classe no lugar errado fica inerte em vez de destrutiva — e o
     * estrago aqui não foi só encolher: a barra é "float:left" em tela
     * larga, então os botões descolaram e flutuaram sobre a agenda. */
    ok(/button\.modos-min\s*\{/.test(html),
       "A1d3 a regra do botao de recolher voltou a casar por classe solta; "
       + "exija 'button.modos-min{' para ela nao poder atingir um contentor");
    /* RECOLHIDA, O RÓTULO VIRA DICA — nao some. Icone sozinho e enigma
     * para quem ainda nao decorou, e o leitor de tela precisa continuar
     * lendo o nome. */
    const bts = api.$("barraModos").querySelectorAll("button");
    ok(bts.length >= 4, "A1e a barra ficou sem botoes: " + bts.length);
    ok(bts.every((b) => String(b.title || "").trim()),
       "A1f recolhida, os botoes ficaram sem dica com o nome do modo");
    ok(bts.every((b) => String(b.getAttribute("aria-label") || "").trim()),
       "A1g os botoes ficaram sem nome para o leitor de tela");

    /* e a escolha fica guardada: quem trabalha num monitor pequeno nao
     * quer refazer isso toda manha */
    ok(api.loja.getItem("eac_modos_recolhida") === "1",
       "A1h a escolha de recolher nao foi guardada");
    api.$("btnModosRecolher").onclick();
    ok(!recolhida(), "A1i nao voltou a abrir");
    ok(api.loja.getItem("eac_modos_recolhida") === "0",
       "A1j abrir de novo nao foi guardado");

    /* ---- A1k-A1p: as cinco cores, o breakpoint certo, sem float ----
     * Duas cores tinham sumido: o CSS mirava ".modo-btn[data-modo=
     * "resumos"]", mas o modo se chama "material" — a regra nunca
     * casava. "Questões" nunca teve regra nenhuma. E a barra era
     * "float:left" dentro de um contentor sem *clearfix*: o contentor
     * colapsava e o "position:sticky" não tinha onde grudar — a barra
     * sumia ao rolar a página, em qualquer largura de computador. */
    ok(/\.modo-btn\[data-modo="cartoes"\]\{--modo-cor:/.test(html),
       "A1k a cor de Cartoes sumiu do CSS");
    ok(/\.modo-btn\[data-modo="edital"\]\{--modo-cor:/.test(html),
       "A1l a cor de Edital sumiu do CSS");
    ok(/\.modo-btn\[data-modo="material"\]\{--modo-cor:/.test(html),
       "A1m Material de estudo continua sem cor propria (o seletor "
       + "ainda mira 'resumos', que nao e' o id deste modo)");
    ok(/\.modo-btn\[data-modo="questoes"\]\{--modo-cor:/.test(html),
       "A1n Questoes continua sem cor propria");
    ok(/\.modo-btn\[data-modo="ferramentas"\]\{--modo-cor:/.test(html),
       "A1o a cor de Ferramentas sumiu do CSS");
    ok(!/\.modo-btn\[data-modo="resumos"\]/.test(html),
       "A1p o seletor morto '[data-modo=\"resumos\"]' (nunca casa com "
       + "nenhum botao) continua no CSS");

    /* sem comentários: a própria explicação de por que o float saiu
     * cita ".barra-modos{float:left}" como exemplo do jeito antigo, e
     * uma busca ingênua acharia essa citação em vez do CSS de verdade */
    const CSSTXT = html.replace(/\/\*[\s\S]*?\*\//g, "");
    ok(!/\.barra-modos\{[^}]*float:left/.test(CSSTXT),
       "A1q a barra de modos continua flutuando (float:left) — e o "
       + "float que faz o contentor colapsar e o sticky perder onde "
       + "grudar, sumindo ao rolar a pagina");
    /* o trilho vertical do computador precisa trocar de layout em
     * 760px, nao 900px — ha' OUTRO "@media (min-width:900px)" no
     * arquivo, sem nenhuma relacao (grade de jurisprudencia), entao a
     * busca acha a regra da coluna e sobe ate' o "@media" mais proximo
     * ACIMA dela, em vez de varrer o arquivo inteiro atras de qualquer
     * "@media" (o que acharia o primeiro do arquivo, nao o certo) */
    const marcador = ".modos-caixa{flex:0 0 186px";
    const posMarcador = CSSTXT.indexOf(marcador);
    const antes = CSSTXT.slice(0, posMarcador);
    const posMedia = antes.lastIndexOf("@media (min-width:");
    const larguraMedia = (antes.slice(posMedia).match(/@media \(min-width:(\d+)px\)/) || [])[1];
    ok(posMarcador >= 0 && larguraMedia === "760",
       "A1r o trilho do computador ainda troca de layout em 900px, "
       + "destoando do resto do app (760px em toda parte, e o que "
       + "PLANO-edital.md ja documentava para esta barra) — achei "
       + JSON.stringify(larguraMedia));

    /* o rótulo curto: só existe para caber a fileira numa linha só no
     * celular, e é a mesma técnica em todo botão — dois <span>, o CSS
     * decide qual mostrar. Sem rótulo curto próprio, os dois têm o
     * mesmo texto (não um <span> vazio, que o leitor de tela leria como
     * "botão sem nome" na largura errada). */
    const btEstudo = Array.from(api.$("barraModos").children || [])
      .find((b) => b.dataset && b.dataset.modo === "material");
    const curto = (btEstudo.children || []).find((c) =>
      (c.className || "") === "modo-rot-curto");
    const cheio = (btEstudo.children || []).find((c) =>
      (c.className || "") === "modo-rot");
    ok(!!curto && curto.textContent === "Material",
       "A1s o rotulo curto de Material de estudo nao apareceu: "
       + (curto && curto.textContent));
    ok(!!cheio && cheio.textContent === "Material de estudo",
       "A1t o rotulo cheio de Material de estudo mudou: "
       + (cheio && cheio.textContent));
    const btEdital = Array.from(api.$("barraModos").children || [])
      .find((b) => b.dataset && b.dataset.modo === "edital");
    const curtoEdital = (btEdital.children || []).find((c) =>
      (c.className || "") === "modo-rot-curto");
    ok(!!curtoEdital && curtoEdital.textContent === "Edital",
       "A1u sem rotulo curto proprio, o botao deveria repetir o rotulo "
       + "cheio, nao ficar vazio: " + (curtoEdital && curtoEdital.textContent));
  }

  /* ---- A2: a janela da lei cresce em LARGURA ---- */
  {
    const css = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    /* O DEFEITO: .diag-modal tem max-width:860px. O "width" das classes
     * de tamanho crescia e o max-width clampava — por isso a janela so
     * aumentava na vertical. Cada tamanho precisa soltar os DOIS. */
    ["estreita", "media", "larga", "maxima"].forEach((nome) => {
      const re = new RegExp("#dlgLeiSeca\\.lei-j-" + nome + "\\[open\\]\\{([^}]*)\\}");
      const m = css.match(re);
      ok(!!m, "A2 sumiu a regra de largura do tamanho " + nome);
      if (!m) return;
      ok(/max-width/.test(m[1]),
         "A2b o tamanho " + nome + " nao solta o max-width, entao a janela "
         + "so cresce na vertical: " + m[1]);
    });
    const larga = css.match(/#dlgLeiSeca\.lei-j-larga\[open\]\{([^}]*)\}/)[1];
    ok(/1[0-9]{3}px/.test(larga),
       "A2c a janela larga nao passa de mil pixels: " + larga);
  }

  /* ---- A3: o leitor de lei tem menos botões à vista ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito Financeiro", "Receita pública");
    api.matGravar(ch, "R.", { disciplina: "Direito Financeiro",
                              topico: "Receita pública" });
    api.leiAbrir("Direito Financeiro", "Receita pública");

    /* O stub nao monta a arvore do HTML declarado — so registra os ids.
     * Entao a contagem de botoes "a vista" e feita na fonte: pega o
     * bloco do dialogo, corta na primeira gaveta, e conta o que sobra. */
    const htmlLei = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const bloco = htmlLei.slice(htmlLei.indexOf('<dialog id="dlgLeiSeca"'));
    const barra = bloco.slice(bloco.indexOf('<div class="mat-topo">'),
                              bloco.indexOf('<div class="mat-topo lei-gaveta"'));
    const naFila = (barra.match(/<button/g) || []).length;
    /* CATORZE BOTÕES NUMA FILA SÓ VIRAM RUÍDO. Os tres de modo sao UMA
     * escolha e ficam; o resto se divide por pergunta ("onde eu vou?" e
     * "como eu vejo?"), cada uma numa gaveta que abre sob demanda. */
    ok(naFila > 0 && naFila <= 9,
       "A3 a barra do leitor tem " + naFila + " botoes a vista (limite: 9)");

    /* as gavetas nascem fechadas */
    ok(api.$("leiGavNavegar").hidden === true,
       "A3b a gaveta de navegacao nasceu aberta");
    ok(api.$("leiGavExibir").hidden === true,
       "A3c a gaveta de exibicao nasceu aberta");

    api.$("btnLeiNavegar").onclick();
    ok(api.$("leiGavNavegar").hidden === false, "A3d a gaveta nao abriu");
    /* UMA DE CADA VEZ: duas abertas devolveriam a fila de catorze que
     * elas existem para desfazer. */
    api.$("btnLeiExibir").onclick();
    ok(api.$("leiGavExibir").hidden === false, "A3e a segunda gaveta nao abriu");
    ok(api.$("leiGavNavegar").hidden === true,
       "A3f as duas gavetas ficaram abertas ao mesmo tempo");
    /* clicar de novo fecha */
    api.$("btnLeiExibir").onclick();
    ok(api.$("leiGavExibir").hidden === true,
       "A3g clicar de novo nao fechou a gaveta");

    /* e os botoes continuam existindo — foram movidos, nao removidos */
    ["btnLeiBlocos", "btnLeiIr", "btnLeiRank", "btnLeiCheia",
     "btnLeiMaior", "btnLeiMenor", "btnLeiJanelaMais"].forEach((id) => {
      ok(typeof api.$(id).onclick === "function",
         "A3h o botao " + id + " sumiu junto com a arrumacao");
    });
  }

  /* ---- A4: o prompt do caderno ---- */
  {
    const { api } = rodar();
    const ctx = { disciplina: "Direito Financeiro", topico: "Receita pública",
                  concurso: "SEFAZ-AL" };
    const p = api.qsPromptCaderno(ctx);

    ok(/Receita pública/.test(p) && /SEFAZ-AL/.test(p),
       "A4 o prompt do caderno nao leva o contexto");
    /* A DIFERENÇA QUE JUSTIFICA UM PROMPT SEPARADO: no caderno a IA ja
     * tem as fontes e responde ancorada nelas. Mandar ali o prompt
     * generico desperdica a unica vantagem do lugar — e deixa a porta
     * aberta para ela responder de memoria, que e como entram no banco
     * as questoes com contexto errado. */
    ok(/EXCLUSIVAMENTE|exclusivamente/.test(p),
       "A4b o prompt nao exige que a IA fique dentro das fontes");
    ok(/SEM FONTE SUFICIENTE/.test(p),
       "A4c o prompt nao diz o que fazer quando as fontes nao cobrem o topico — "
       + "sem essa saida, a IA inventa");
    ok(/Fonte:/.test(p),
       "A4d o prompt nao pede a citacao da fonte no comentario");
    /* e NAO manda texto nenhum junto: no caderno isso seria devolver a
     * ela o que ela ja tem */
    ok(!/\[cole aqui/.test(p) && !/TEXTO-BASE/.test(p),
       "A4e o prompt do caderno esta pedindo para colar texto");
    ok(/\[QUESTAO\]/.test(p) && /GABARITO/.test(p),
       "A4f o prompt nao ensina o formato que o app sabe ler");

    /* e o prompt COMUM continua diferente — os dois nao podem ter virado
     * um so por descuido */
    const comum = api.qsPrompt("um texto qualquer", ctx);
    ok(comum !== p, "A4g o prompt do caderno e o comum ficaram iguais");
    ok(!/SEM FONTE SUFICIENTE/.test(comum),
       "A4h a regra do caderno vazou para o prompt comum");
  }

  /* ---- A5: o quadro do prompt nasce recolhido ---- */
  {
    const { api } = rodar();
    const html = fs.readFileSync(
      path.join(__dirname, "..", "docs", "index.html"), "utf8");
    /* O PROMPT É PARA COPIAR, NÃO PARA LER. Quarenta linhas de instrucao
     * empurram para baixo o campo onde a resposta e colada — que e o
     * campo que a pessoa realmente usa. */
    ok(/<textarea id="qsCriarPrompt"[^>]*\shidden/.test(html),
       "A5 o quadro do prompt nasce aberto de novo");
    ok(html.indexOf('id="btnQsVerPrompt"') >= 0,
       "A5b sumiu o caminho para ver o prompt quando se quer conferir");

    api.qsUiIniciar && api.qsUiIniciar();
    const ta = api.$("qsCriarPrompt");
    const b = api.$("btnQsVerPrompt");
    if (typeof b.onclick === "function") {
      ta.hidden = true;
      b.onclick();
      ok(ta.hidden === false, "A5c o botao nao mostra o prompt");
      ok(/esconder/i.test(b.textContent || ""),
         "A5d aberto, o botao devia oferecer esconder: " + b.textContent);
      b.onclick();
      ok(ta.hidden === true, "A5e o botao nao esconde de volta");
    } else {
      ok(false, "A5c o botao de ver o prompt nao foi ligado");
    }

    /* a terceira fonte existe e e distinta das outras duas */
    ok(html.indexOf('id="qsFonteCaderno"') >= 0,
       "A5f sumiu a opcao de gerar a partir do caderno");
  }

  /* ---- A6: achar questão pelo edital e pelo tópico ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.edCarregarLista();
    const EDITAL = [
      "# SEFAZ-AL | prova: 2027-06-01 | horas: 20",
      "& Conhecimentos Básicos | minimo: 50%",
      "@ Português :: 10q",
      "+ Crase :: 5",
      "& Conhecimentos Específicos | minimo: 60%",
      "@ Direito Financeiro :: 20q",
      "+ Receita pública :: 5",
      "+ Despesa pública :: 4",
    ].join("\n");
    const e1 = api.edCriar("SEFAZ-AL", EDITAL);
    api.edCriar("ISS Caruaru",
      "# ISS Caruaru | prova: 2027-09-01 | horas: 10\n@ Direito Tributário :: 5\n+ ISS :: 5");

    const chR = api.matChave("Direito Financeiro", "Receita pública");
    const chC = api.matChave("Português", "Crase");
    const chI = api.matChave("Direito Tributário", "ISS");
    api.qsAplicar([
      { tipo: "ce", enunciado: "Receita é ingresso definitivo.", gabarito: "C",
        disciplina: "Direito Financeiro", topico: "Receita pública", chave: chR },
      { tipo: "ce", enunciado: "Crase é a fusão de duas vogais.", gabarito: "C",
        disciplina: "Português", topico: "Crase", chave: chC },
      { tipo: "ce", enunciado: "ISS é imposto municipal.", gabarito: "C",
        disciplina: "Direito Tributário", topico: "ISS", chave: chI },
    ]);
    api.qsUiRender();

    /* O FILTRO DE EDITAL EXISTE. Disciplina e o nome que a questao
     * carrega; o edital e a lista que a pessoa esta estudando, e com
     * dois concursos abertos "todas de Direito Financeiro" mistura
     * recortes de bancas e cargos diferentes. */
    const selE = api.$("qsFEdital");
    ok(selE.querySelectorAll("option").length >= 3,
       "A6 o filtro de edital nao lista os editais: "
       + selE.querySelectorAll("option").length);
    ok(selE.hidden === false,
       "A6b com dois editais o filtro devia aparecer");

    selE.value = e1.id;
    api.qsUiLerFiltros();
    ok(api.qsUiListaFiltrada().length === 2,
       "A6c filtrar pelo edital devia deixar 2 questoes, deixou "
       + api.qsUiListaFiltrada().length);
    ok(!api.qsUiListaFiltrada().some((q) => /ISS/.test(q.enunciado)),
       "A6d a questao do outro edital passou pelo filtro");

    /* OS BLOCOS DO EDITAL VIRAM CABEÇALHO da lista de topicos: e o que
     * transforma 232 linhas soltas em algo navegavel, e e onde a
     * pergunta "tenho questoes do bloco que esta abaixo do minimo?"
     * ganha resposta. */
    const selT = api.$("qsFTopico");
    ok(selT.hidden === false,
       "A6e escolhido o edital, a lista de topicos continuou escondida");
    const grupos = selT.querySelectorAll("optgroup");
    ok(grupos.length === 2,
       "A6f os blocos do edital nao viraram cabecalho: " + grupos.length);
    const rotulos = grupos.map((g) => g.label || "");
    ok(rotulos.some((x) => /Básicos/.test(x))
       && rotulos.some((x) => /Específicos/.test(x)),
       "A6g os cabecalhos nao sao os blocos do edital: "
       + JSON.stringify(rotulos));

    /* TÓPICO SEM QUESTÃO NÃO ENTRA: escolher um levaria a uma tela
     * vazia sem nada de errado ter acontecido. */
    const txtT = selT.textContent || "";
    ok(/Receita pública/.test(txtT), "A6h o topico com questao nao aparece");
    ok(!/Despesa pública/.test(txtT),
       "A6i topico sem questao nenhuma entrou na lista: " + txtT);
    /* e a contagem por topico aparece: e o que evita escolher no escuro */
    ok(/\(1\)/.test(txtT),
       "A6j a lista de topicos nao diz quantas questoes cada um tem: " + txtT);

    selT.value = chR;
    api.qsUiLerFiltros();
    ok(api.qsUiListaFiltrada().length === 1,
       "A6k filtrar por topico devia deixar 1 questao, deixou "
       + api.qsUiListaFiltrada().length);
    ok(/Receita/.test(api.qsUiListaFiltrada()[0].enunciado),
       "A6l o filtro de topico trouxe a questao errada");

    /* SEM EDITAL ESCOLHIDO NÃO HÁ LISTA DE TÓPICOS: juntar os topicos de
     * tres editais devolveria o amontoado que este filtro desfaz. */
    selE.value = "";
    selT.value = "";
    api.qsUiLerFiltros();
    ok(api.$("qsFTopico").hidden === true,
       "A6m sem edital escolhido a lista de topicos continuou visivel");
    ok(api.qsUiListaFiltrada().length === 3,
       "A6n tirar os filtros nao devolveu todas as questoes: "
       + api.qsUiListaFiltrada().length);
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
