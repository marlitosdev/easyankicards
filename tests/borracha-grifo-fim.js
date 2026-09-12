/* TRÊS COISAS QUE PARECIAM FUNCIONAR E NÃO FUNCIONAVAM, e duas novas.
 *
 * 1. A BORRACHA. Escolher o tamanho não mudava nada — grande ou pequena,
 *    o traço tocado sumia inteiro. O raio decidia só se acertava, nunca
 *    o quanto saía; e uma borracha que não apaga por tamanho não é uma
 *    borracha, é um botão de excluir com três larguras de ícone.
 *
 * 2. O GRIFO. Fino e a 32% de opacidade ele mal aparecia — e o ponto de
 *    grifar é justamente chamar atenção.
 *
 * 3. O FIM DA RODADA era um beco: mostrava o placar e as erradas, e não
 *    havia o que fazer com isso na própria tela.
 *
 * O que precisa valer: o raio muda o quanto se apaga; apagar o meio de
 * uma linha deixa as duas pontas; desfazer não desenha a linha duas
 * vezes; a repescagem tem placar PRÓPRIO; e a dobra lembra a escolha. */
const { rodar } = require("./fumaca.js");

const QUESTOES = [
  { tipo: "ce", enunciado: "Receita é ingresso definitivo de recursos.",
    gabarito: "C", comentario: "Sim, sem obrigação de devolução.",
    disciplina: "Direito Financeiro", topico: "Receita pública",
    chave: "direito financeiro›receita pública" },
  { tipo: "ce", enunciado: "Receita corrente inclui operações de crédito.",
    gabarito: "E", comentario: "Operação de crédito é receita de capital.",
    disciplina: "Direito Financeiro", topico: "Receita pública",
    chave: "direito financeiro›receita pública" },
  { tipo: "ce", enunciado: "Restos a pagar são despesas empenhadas.",
    gabarito: "C", comentario: "Empenhadas e não pagas até 31/12.",
    disciplina: "Direito Financeiro", topico: "Receita pública",
    chave: "direito financeiro›receita pública" },
];

/* uma linha reta de 40 pontos, de x=0 a x=390 na altura y=100 */
const RETA = () => ({ cor: "#111", larg: 3,
  pontos: Array.from({ length: 40 }, (_, i) => [i * 10, 100]) });

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

  /* ================================================================
   * B1: o raio decide QUANTO se apaga, não SE apaga
   * ============================================================== */
  {
    const { api } = rodar();
    const tr = RETA();
    /* mesma linha, mesmo ponto, dois raios: o resultado TEM de diferir.
     * Enquanto a borracha apagava o traço inteiro, os dois davam zero
     * pontos restantes — e era por isso que o botão de tamanho parecia
     * decorativo. */
    const pequena = api.rsPartirTraco(tr, 200, 100, 15);
    const grande = api.rsPartirTraco(tr, 200, 100, 60);
    const sobra = (partes) => partes.reduce((a, x) => a + x.pontos.length, 0);
    ok(sobra(pequena) > sobra(grande),
       "B1 a borracha grande nao apagou mais do que a pequena: "
       + sobra(pequena) + " vs " + sobra(grande));
    ok(sobra(pequena) > 0 && sobra(grande) > 0,
       "B1b alguma das borrachas apagou a linha inteira: "
       + sobra(pequena) + " / " + sobra(grande));

    /* APAGAR O MEIO DEIXA AS DUAS PONTAS — é o que se espera de uma
     * borracha no papel, e o que o "apaga o traço todo" impedia. */
    ok(pequena.length === 2,
       "B1c apagar o meio da linha nao deixou duas pontas: " + pequena.length);
    ok(((pequena[0] || {}).pontos || [[]])[0][0] === 0,
       "B1d a ponta esquerda nao comeca no comeco da linha");
    const dir = (pequena[1] || {}).pontos || [];
    ok(dir.length && dir[dir.length - 1][0] === 390,
       "B1e a ponta direita nao termina no fim da linha");
    /* e a cor e a largura seguem com os pedaços: sem isso, apagar o meio
     * de um traço vermelho grosso devolveria dois pretos finos */
    ok((pequena[0] || {}).cor === tr.cor && (pequena[0] || {}).larg === tr.larg,
       "B1f o pedaco perdeu a cor ou a largura do traco original");
  }

  /* ---- B2: o círculo é redondo, não quadrado ---- */
  {
    const { api } = rodar();
    /* O PONTO DA ESQUINA: (25,25) está a 35,4 do centro (0,0) — FORA de
     * um raio 30. Mas |25| ≤ 30 nos dois eixos, então o teste em CAIXA o
     * apagaria: a borracha comendo num canto onde ela visivelmente não
     * encostou. Os outros dois pontos existem só para o traço ser um
     * traço. */
    const tr = { cor: "#111", larg: 3,
                 pontos: [[200, 200], [25, 25], [300, 300]] };
    const partes = api.rsPartirTraco(tr, 0, 0, 30);
    const restam = partes.reduce((a, x) => a + x.pontos.length, 0);
    ok(restam === 3,
       "B2 a borracha apagou no canto do quadrado, fora do circulo: "
       + restam + " de 3 pontos");
    /* e o ponto que está DENTRO do círculo sai mesmo */
    const dentro = api.rsPartirTraco(
      { cor: "#111", larg: 3,
        pontos: [[200, 200], [210, 210], [10, 10], [300, 300], [310, 310]] },
      0, 0, 30);
    ok(dentro.reduce((a, x) => a + x.pontos.length, 0) === 4,
       "B2b o ponto dentro do circulo nao foi apagado: "
       + JSON.stringify(dentro.map((x) => x.pontos)));

    /* PEDAÇO DE UM PONTO SÓ NÃO SOBREVIVE: o traço é uma polilinha, e um
     * ponto isolado não desenha nada — ficaria sujeira invisível
     * acumulando na memória a cada passada da borracha. */
    const sozinho = api.rsPartirTraco(
      { cor: "#111", larg: 3, pontos: [[200, 200], [10, 10], [300, 300]] },
      0, 0, 30);
    ok(sozinho.length === 0,
       "B2c sobraram pedacos de um ponto so, que nao desenham nada: "
       + JSON.stringify(sozinho.map((x) => x.pontos)));
  }

  /* ---- B3: apagar e desfazer não deixa a linha duas vezes ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsRecolher(false);
    api.rsComecar({ clientX: 0, clientY: 0 });
    api.rsSoltar({});
    const tracos0 = api.rsTracosAtual();
    tracos0.length = 0;
    tracos0.push(RETA());
    api.rsApagarEm(200, 100);
    ok(api.rsTracosAtual().length === 2,
       "B3 apagar o meio nao deixou 2 pedacos: " + api.rsTracosAtual().length);
    api.rsDesfazer();
    /* DESFAZER TEM DE TIRAR OS PEDAÇOS antes de repor o inteiro. Só
     * repondo, a linha ficaria desenhada por cima dela mesma — e o
     * próximo desfazer removeria uma cópia, não o gesto. */
    ok(api.rsTracosAtual().length === 1,
       "B3b desfazer deixou o traco inteiro E os pedacos: "
       + api.rsTracosAtual().length);
    ok(api.rsTracosAtual()[0].pontos.length === 40,
       "B3c o traco reposto nao esta inteiro: "
       + api.rsTracosAtual()[0].pontos.length);
  }

  /* OS BLOCOS DO GRIFO EM CANVAS SAÍRAM DAQUI.
   *
   * Espessura, opacidade e cor de traço eram propriedades de um
   * desenho por cima do texto. O grifo agora é <mark> dentro do
   * próprio texto (docs/grifo.js), e essas grandezas deixaram de
   * existir: não há traço para engrossar nem alfa para calibrar.
   * O que ficou aqui é o rascunho, que continua sendo desenho. */
  /* ---- G2b: a caneta do rascunho também escolhe espessura ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsRecolher(false);
    ok(api.RS_ESPESSURAS.length === 3,
       "G2b nao ha tres espessuras de caneta: " + api.RS_ESPESSURAS.length);
    /* A COMPARAÇÃO COM O GRIFO SAIU DAQUI.
     * Ela media a caneta contra a espessura do traço de grifo, e traço
     * de grifo não existe mais: o grifo virou <mark> dentro do texto.
     * O que continua valendo da caneta é o que está abaixo. */
    api.rsEspessuraDefinir(0);
    api.rsComecar({ clientX: 5, clientY: 5 });
    api.rsSoltar({});
    const t1 = api.rsTracosAtual()[0];
    api.rsEspessuraDefinir(2);
    api.rsComecar({ clientX: 60, clientY: 60 });
    api.rsSoltar({});
    const t2 = api.rsTracosAtual()[1];
    ok(t1 && t2 && t1.larg < t2.larg,
       "G2d o traco do rascunho nao guardou a largura escolhida: "
       + (t1 && t1.larg) + " / " + (t2 && t2.larg));

    /* e o botão escolhido fica marcado, como no grifo */
    const b0 = api.rsFerramenta("e_fina"), b2 = api.rsFerramenta("e_grossa");
    ok(b0 && b2, "G2e faltam os botoes de espessura da caneta");
    ok(/rs-sel/.test((b2 || {}).className || "")
       && !/rs-sel/.test((b0 || {}).className || ""),
       "G2f o botao de espessura escolhido nao fica marcado: "
       + (b0 || {}).className + " | " + (b2 || {}).className);
  }

  /* ================================================================
   * F1: a folha inteira, e o que já estava desenhado
   * ============================================================== */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsRecolher(false);
    const cv = api.rsTela();
    ok(cv.width === api.RS_FOLHA_NORMAL.w,
       "F1-pre a folha nao comeca no tamanho normal: " + cv.width);

    /* um traço no MEIO da folha: é o que denuncia deslocamento */
    api.rsTracosAtual().length = 0;
    api.rsTracosAtual().push({ cor: "#111", larg: 4,
      pontos: [[450, 210], [455, 215]] });

    ok(api.rsCheiaTrocar(true) === true, "F1 nao entrou na folha inteira");

    /* A FOLHA TEM O TAMANHO DA TELA, e não um valor fixo.
     *
     * Este bloco media a constante RS_FOLHA_CHEIA — o valor de reserva
     * para quando NÃO dá para medir a janela. Ele passava porque o
     * simulador não tinha "innerWidth": o teste media a cegueira do
     * simulador, não o comportamento do aplicativo. Com a largura
     * disponível, o ramo de verdade é este, e a reserva ganhou um teste
     * só dela, logo abaixo. */
    const esperado = api.rsFolhaDaTela();
    ok(cv.width === esperado.w && cv.height === esperado.h,
       "F1b a folha nao acompanhou o tamanho da tela: "
       + cv.width + "x" + cv.height + " · esperado "
       + esperado.w + "x" + esperado.h);
    /* MAIS ESPAÇO, e não o mesmo desenho esticado: o número de pixels
     * internos é o que decide quanto cabe. */
    ok(esperado.w * esperado.h
       > api.RS_FOLHA_NORMAL.w * api.RS_FOLHA_NORMAL.h * 2,
       "F1c a folha inteira mal aumentou a area: "
       + esperado.w + "x" + esperado.h);

    /* O QUE JÁ ESTAVA DESENHADO ACOMPANHA. Trocar o tamanho sem
     * converter os pontos empurraria tudo para o canto de cima,
     * encolhido — o rabisco apareceria longe de onde foi feito. */
    const p0 = api.rsTracosAtual()[0].pontos[0];
    const meioX = esperado.w / 2, meioY = esperado.h / 2;
    ok(Math.abs(p0[0] - meioX) < 2 && Math.abs(p0[1] - meioY) < 2,
       "F1d o traco do meio da folha nao ficou no meio depois de crescer: "
       + JSON.stringify(p0) + " · esperado ~" + meioX + "," + meioY);
    /* e a largura do traço acompanha: fina numa folha pequena é um fio
     * invisível numa folha grande */
    ok(api.rsTracosAtual()[0].larg > 4,
       "F1e a largura do traco nao acompanhou a escala: "
       + api.rsTracosAtual()[0].larg);

    /* e VOLTA sem deslocar */
    api.rsCheiaTrocar(false);
    const p1 = api.rsTracosAtual()[0].pontos[0];
    ok(Math.abs(p1[0] - 450) < 2 && Math.abs(p1[1] - 210) < 2,
       "F1f voltar da folha inteira deslocou o traco: " + JSON.stringify(p1));
    ok(cv.width === api.RS_FOLHA_NORMAL.w,
       "F1g voltar nao devolveu a folha ao tamanho normal: " + cv.width);
  }

  /* ---- F1x: a folha de reserva, quando não dá para medir a tela ----
   *
   * Este ramo existe para navegador antigo e para qualquer situação em
   * que a janela não informa o tamanho. Ele passou meses "coberto" por
   * acidente — era o único que o simulador conseguia alcançar, porque
   * ele não tinha largura de tela nenhuma. Agora tem, e a reserva
   * precisa de um teste que a exercite de propósito.
   *
   * Sem ele, uma folha de 0x0 num navegador que não responde à medida
   * passaria despercebida: canvas de área zero não lança erro, só não
   * desenha nada. */
  {
    const { api, janela } = rodar();
    api.rsIniciar();
    api.rsRecolher(false);
    const antes = janela.innerWidth;
    janela.innerWidth = 0;
    janela.innerHeight = 0;
    const f = api.rsFolhaDaTela();
    ok(f.w === api.RS_FOLHA_CHEIA.w && f.h === api.RS_FOLHA_CHEIA.h,
       "F1x sem medida da tela a folha nao caiu no tamanho de reserva: "
       + f.w + "x" + f.h);
    ok(f.w > 0 && f.h > 0,
       "F1x2 a folha de reserva tem area zero — o canvas nao desenha e "
       + "nao reclama");
    janela.innerWidth = antes;
    janela.innerHeight = 900;
  }

  /* ---- F1y: a folha acompanha telas diferentes ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsRecolher(false);
    /* Um valor fixo é sempre errado em algum aparelho: grande demais num
     * telefone (o traço sai fino como fio de cabelo) e pequeno demais
     * num monitor (a mão desenha o dobro do que aparece). */
    api.larguraTela(390);
    const tel = api.rsFolhaDaTela();
    api.larguraTela(1600);
    const mon = api.rsFolhaDaTela();
    ok(mon.w > tel.w * 3,
       "F1y a folha nao mudou com o tamanho da tela: telefone " + tel.w
       + ", monitor " + mon.w);
    api.larguraTela(1200);
  }

  /* ---- F2: trocar de questão sai da folha inteira ---- */
  {
    const { api } = rodar();
    api.rsIniciar();
    api.rsRecolher(false);
    api.rsCheiaTrocar(true);
    ok(api.rsCheiaAtual() === true, "F2-pre devia estar na folha inteira");
    /* A FOLHA INTEIRA ESCONDE O ENUNCIADO. Ficar nela ao virar a questão
     * mostraria a folha em branco da questão seguinte sem a pergunta. */
    api.rsPrepararPara("q2");
    ok(api.rsCheiaAtual() === false,
       "F2 trocar de questao continuou na folha inteira");
    ok(api.rsTela().width === api.RS_FOLHA_NORMAL.w,
       "F2b a folha ficou grande na questao seguinte: " + api.rsTela().width);
  }

  /* ================================================================
   * F1: o fim da rodada oferece registrar e repescar
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    api.qsAplicar(QUESTOES.map((q) => Object.assign({}, q)));
    const todas = api.qsTodas();
    api.qsSessaoIniciar(todas);
    api.qsResponder("C");            /* acerta */
    api.qsAndar(1);
    api.qsResponder("C");            /* erra (gabarito E) */
    api.qsAndar(1);
    api.qsResponder("E");            /* erra (gabarito C) */
    api.qsAndar(1);
    api.qsUiPintarSessao();

    const acoes = acharClasse(api.$("qsSessCorpo"), "qs-fim-acoes", [])[0];
    ok(!!acoes, "F1 o fim da rodada nao tem area de acoes");
    const rot = Array.from((acoes || {}).children || []).map((b) => b.textContent || "");
    ok(rot.length === 2,
       "F1b deviam ser 2 acoes no fim: " + rot.join(" | "));
    ok(rot.some((x) => /registrar/i.test(x)),
       "F1c falta registrar o estudo no fim da rodada: " + rot.join(" | "));
    ok(rot.some((x) => /\b2\b/.test(x)),
       "F1d o botao de repescar nao diz quantas voce errou: " + rot.join(" | "));

    /* AS ERRADAS, e só elas: pular as que não deu tempo de responder
     * seria repescar o que nunca foi tentado. */
    const err = api.qsErradasDaSessao();
    ok(err.length === 2, "F1e deviam ser 2 erradas: " + err.length);
    ok(!err.some((q) => q.enunciado === QUESTOES[0].enunciado),
       "F1f a questao acertada entrou na repescagem");
  }

  /* ---- F2: a repescagem tem placar PRÓPRIO ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    api.qsAplicar(QUESTOES.map((q) => Object.assign({}, q)));
    api.qsSessaoIniciar(api.qsTodas());
    api.qsResponder("C"); api.qsAndar(1);
    api.qsResponder("C"); api.qsAndar(1);
    api.qsResponder("E"); api.qsAndar(1);
    const p0 = api.qsPlacar();
    ok(p0.feitas === 3 && p0.certas === 1,
       "F2-pre a primeira rodada nao saiu 1/3: " + JSON.stringify(p0));

    ok(api.qsUiRepescar() === true, "F2 a repescagem nao comecou");
    const p1 = api.qsPlacar();
    /* O PLACAR ZERA e o total passa a ser 2. Somar os acertos da
     * repescagem no placar da primeira apagaria a única medida que
     * interessa: quanto você acertava ANTES de rever. */
    ok(p1.total === 2, "F2b a rodada nova nao tem so as erradas: " + p1.total);
    ok(p1.feitas === 0 && p1.certas === 0,
       "F2c a repescagem herdou o placar da primeira: " + JSON.stringify(p1));
    const s = api.qsSessaoAtual();
    ok(s.repescagem === true, "F2d a rodada nova nao se declara repescagem");
    ok(s.deRodada && s.deRodada.certas === 1,
       "F2e a rodada nova esqueceu de onde veio: " + JSON.stringify(s.deRodada));

    api.qsResponder("E");             /* agora acerta a segunda */
    ok(api.qsPlacar().certas === 1,
       "F2f o acerto da repescagem nao contou nela");
    /* e o desempenho DA QUESTÃO guarda as duas tentativas: a repescagem
     * é histórico, não substituição */
    const q2 = api.qsTodas().filter((q) => q.gabarito === "E")[0];
    ok((q2.tentativas || []).length === 2,
       "F2g a segunda tentativa nao entrou no historico da questao: "
       + JSON.stringify(q2.tentativas));
  }

  /* ---- F3: sem erradas, não há o que repescar ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    api.qsAplicar([Object.assign({}, QUESTOES[0])]);
    api.qsSessaoIniciar(api.qsTodas());
    api.qsResponder("C");
    api.qsAndar(1);
    api.qsUiPintarSessao();
    const acoes = acharClasse(api.$("qsSessCorpo"), "qs-fim-acoes", [])[0];
    const rot = Array.from((acoes || {}).children || []).map((b) => b.textContent || "");
    /* OFERECER REPESCAR QUANDO NÃO HÁ ERRO é um botão que só serve para
     * dar uma resposta negativa depois de clicado. */
    ok(rot.length === 1,
       "F3 apareceu repescagem numa rodada sem erros: " + rot.join(" | "));
    ok(api.qsUiRepescar() === false,
       "F3b repescar sem erradas devia recusar");
  }

  /* ================================================================
   * D1: a dobra do comentário lembra a escolha
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.qsUiIniciar();
    api.qsAplicar(QUESTOES.map((q) => Object.assign({}, q)));
    api.qsSessaoIniciar(api.qsTodas());
    api.qsResponder("C");
    api.qsUiPintarSessao();

    const dobras = acharClasse(api.$("qsSessCorpo"), "qs-dobra", []);
    ok(dobras.length >= 1, "D1 o comentario nao virou dobra");
    /* ABERTA POR PADRÃO: acabar de responder e não ver o comentário
     * seria esconder justamente o que se foi buscar. */
    ok(dobras[0].open === true,
       "D1b a dobra do comentario nasceu fechada");

    /* e a escolha vale para a RODADA, não para a questão: quem fecha o
     * comentário numa não quer reabri-lo na próxima */
    dobras[0].open = false;
    if (dobras[0].ontoggle) dobras[0].ontoggle();
    api.qsAndar(1);
    api.qsResponder("E");
    api.qsUiPintarSessao();
    const d2 = acharClasse(api.$("qsSessCorpo"), "qs-dobra", []);
    ok(d2.length >= 1, "D1c a questao seguinte perdeu a dobra");
    ok(d2[0].open === false,
       "D1d fechar o comentario numa questao nao valeu para a seguinte");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
