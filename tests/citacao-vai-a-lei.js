/* =====================================================================
 * A CITAÇÃO DO COMENTÁRIO LEVA À LEI CERTA
 *
 * O DEFEITO, relatado assim: "o botão ⚖ consultar a lei abre por padrão
 * a primeira lei vinculada ao tópico, sem saber qual lei o gabarito
 * comentado está citando". Num tópico servido por duas — despesa pública
 * é a 4.320 E a LRF — isso acerta metade das vezes, e erra calado. Quem
 * lê confere um artigo que existe, vê que bate com alguma coisa, e leva
 * para a prova uma regra que não é a que caiu.
 *
 * O QUE PRECISA SER VERDADE:
 * 1. A citação é achada com a LEI junto, venha ela depois ("art. 5º da
 *    CF/88") ou antes ("LC 101/2000, art. 1º").
 * 2. O endereço interno não interrompe a leitura: "§ 1º", ", IV", a
 *    alínea com e sem parêntese.
 * 3. Mas "art. 20, o prazo é de 30 dias" NÃO tem alínea — o link não
 *    pode engolir palavra de português.
 * 4. Casar com a biblioteca devolve null quando há dúvida. Abrir a lei
 *    errada em silêncio é pior do que não abrir nada.
 * 5. Desenhar os links não muda UMA LETRA do comentário.
 * 6. Nada de innerHTML: o comentário vem de IA ou de colagem.
 * 7. Com duas leis no tópico, o ⚖ PERGUNTA em vez de escolher.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const DISC = "Direito Financeiro";
  const TOP = "Despesa pública";

  /* Uma biblioteca com as quatro leis que o usuário de fato tem: a
   * Constituição, a 4.320, a LRF e o CTN. Duas delas servem o MESMO
   * tópico — é essa a situação que o defeito exige. */
  const montarBiblioteca = (api, quantasNoTopico) => {
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({
      id: "lei_cf", nome: "Constituição Federal de 1988", apelido: "CF/88",
      especie: "Constituição", numero: "",
      texto: "Art. 156-A. Lei complementar instituirá o IBS.\nArt. 167. São vedados:",
    });
    api.leiGuardar({
      id: "lei_4320", nome: "Lei 4.320/1964", apelido: "",
      especie: "Lei", numero: "4.320",
      texto: "Art. 12. A despesa será classificada nas seguintes categorias.\nArt. 35. Pertencem ao exercício financeiro.",
    });
    api.leiGuardar({
      id: "lei_lc101", nome: "LC 101/2000", apelido: "LRF",
      especie: "Lei Complementar", numero: "101",
      texto: "Art. 1º. Esta Lei Complementar estabelece normas de finanças públicas.",
    });
    api.leiGuardar({
      id: "lei_ctn", nome: "Lei 5.172/1966", apelido: "CTN",
      especie: "Lei", numero: "5.172",
      texto: "Art. 113. A obrigação tributária é principal ou acessória.",
    });
    api.leiLigar("lei_4320", ch);
    if (quantasNoTopico > 1) api.leiLigar("lei_lc101", ch);
    return ch;
  };

  /* ==============================================================
   * L1-L4: A CITAÇÃO SABE DE QUAL LEI ESTÁ FALANDO
   * ============================================================== */
  {
    const { api } = rodar();
    const um = (txt) => api.leiCitacoesNoTexto(txt)[0] || { num: "", rotulo: "", texto: "" };

    ok(um("nos termos do art. 5º da CF/88").rotulo === "CF/88",
       "L1 a lei que vem DEPOIS do artigo é capturada");
    ok(um("LC 101/2000, art. 1º").rotulo === "LC 101/2000",
       "L2 a lei que vem ANTES do artigo é capturada");
    ok(um("art. 156-A, § 1º, IV, da CF/88").rotulo === "CF/88",
       "L3 § e inciso não interrompem a leitura do rótulo");
    ok(um("art. 150, VI, a, da CF").rotulo === "CF",
       "L4 alínea SEM parêntese não interrompe a leitura do rótulo");

    /* A SABOTAGEM QUE ESTA REGRA EXIGE. Aceitar "vírgula + letra" como
     * alínea faria o link cobrir o ", o" de um artigo definido. O que
     * separa os dois é o que vem depois: alínea é seguida de pontuação,
     * artigo definido é seguido de palavra. */
    ok(um("art. 20, o prazo é de 30 dias").texto === "art. 20",
       "L5 ', o' de artigo definido não é engolido como alínea · veio: "
       + JSON.stringify(um("art. 20, o prazo é de 30 dias").texto));
    ok(um("o art. 20 é claro").rotulo === "",
       "L6 citação sem lei nomeada não inventa lei");
    ok(um("art. 5º e o art. 6º").rotulo === "",
       "L7 'e o' não é lido como nome de lei");

    const duas = api.leiCitacoesNoTexto("art. 1º da LC 101/2000 e art. 35 da Lei 4.320");
    ok(duas.length === 2 && duas[0].rotulo === "LC 101/2000"
       && duas[1].rotulo === "Lei 4.320",
       "L8 duas citações de leis diferentes na mesma frase");
    ok(duas.length === 2 && duas[0].fim <= duas[1].ini,
       "L9 os trechos não se sobrepõem");
    const t9 = "veja o art. 5º da CF/88, que trata";
    const c9 = um(t9);
    ok(t9.slice(c9.ini, c9.fim) === c9.texto,
       "L10 ini/fim apontam exatamente para o trecho devolvido");
  }

  /* ==============================================================
   * L11-L16: CASAR COM A BIBLIOTECA, E DUVIDAR QUANDO É O CASO
   * ============================================================== */
  {
    const { api } = rodar();
    montarBiblioteca(api, 2);
    const ls = api.leisLista();
    const idDe = (r) => (api.leiCasarRotulo(r, ls) || {}).id || null;

    ok(idDe("CF/88") === "lei_cf", "L11 CF/88 casa pela espécie Constituição");
    ok(idDe("Constituição Federal") === "lei_cf", "L12 CF por extenso casa igual");
    ok(idDe("Lei nº 4.320/64") === "lei_4320", "L13 lei casa pelo número, com ponto");
    ok(idDe("Lei 4320") === "lei_4320", "L14 e sem ponto");
    ok(idDe("LC 101/2000") === "lei_lc101", "L15 LC casa pelo número");
    ok(idDe("CTN") === "lei_ctn", "L16 sigla casa pelo APELIDO, não pelo nome");
    ok(idDe("LRF") === "lei_lc101", "L17 apelido da LRF");

    /* A DÚVIDA É O CASO IMPORTANTE. */
    ok(api.leiCasarRotulo("Lei 9.999/99", ls) === null,
       "L18 lei que não está na biblioteca devolve null");
    ok(api.leiCasarRotulo("XPTO", ls) === null,
       "L19 sigla desconhecida devolve null");

    /* espécie desempata: LC 101 não é Lei 101 */
    api.leiGuardar({ id: "lei_x", nome: "Lei 101/1990", apelido: "",
                     especie: "Lei", numero: "101", texto: "Art. 1º. Teste." });
    const ls2 = api.leisLista();
    ok((api.leiCasarRotulo("LC 101", ls2) || {}).id === "lei_lc101",
       "L20 a espécie desempata a favor da LC");
    ok((api.leiCasarRotulo("Lei 101", ls2) || {}).id === "lei_x",
       "L21 e a favor da Lei ordinária");
  }

  /* ==============================================================
   * L22-L26: PARA ONDE O LINK APONTA
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = montarBiblioteca(api, 2);
    const ls = api.leisLista();
    const dt = api.leisDoTopico(ch);
    const cit = (txt) => api.leiCitacoesNoTexto(txt)[0];

    const a1 = api.qsUiLeiAlvo(cit("art. 1º da LC 101/2000"), ls, dt);
    ok(a1.lei && a1.lei.id === "lei_lc101" && a1.ligada === true,
       "L22 lei nomeada e ligada ao tópico: abre nela");

    const a2 = api.qsUiLeiAlvo(cit("art. 113 do CTN"), ls, dt);
    ok(a2.lei && a2.lei.id === "lei_ctn" && a2.ligada === false,
       "L23 lei nomeada mas NÃO ligada: abre mesmo assim, e diz que não está ligada");

    const a3 = api.qsUiLeiAlvo(cit("art. 5º da Lei 9.999/99"), ls, dt);
    ok(a3.lei === null && a3.motivo === "desconhecida",
       "L24 lei nomeada que não existe: não abre nada, oferece vincular");

    const a4 = api.qsUiLeiAlvo(cit("o art. 12 é claro"), ls, dt);
    ok(a4.lei === null && a4.motivo === "ambigua",
       "L25 sem lei nomeada e com DUAS no tópico: pergunta, não chuta");
  }
  {
    /* a mesma citação, com UMA lei só no tópico, resolve sozinha —
     * perguntar aqui seria burocracia */
    const { api } = rodar();
    const ch = montarBiblioteca(api, 1);
    const cit = api.leiCitacoesNoTexto("o art. 12 é claro")[0];
    const a = api.qsUiLeiAlvo(cit, api.leisLista(), api.leisDoTopico(ch));
    ok(a.lei && a.lei.id === "lei_4320",
       "L26 sem lei nomeada e com UMA no tópico: abre nela sem perguntar");
  }

  /* ==============================================================
   * L27-L31: O COMENTÁRIO DESENHADO
   * ============================================================== */
  {
    const { api } = rodar();
    montarBiblioteca(api, 2);
    const COM = "O gabarito é C. Nos termos do art. 156-A, § 1º, IV, da CF/88, "
      + "o IBS é de competência compartilhada. Veja também o art. 35 da Lei 4.320 "
      + "e, por fim, o art. 99 desta lei.";
    const q = { disciplina: DISC, topico: TOP, comentario: COM };
    const el = api.document.createElement("div");
    api.qsUiComentario(el, q);

    /* A INVARIANTE QUE VALE POR TODAS: linkar não pode reescrever o
     * comentário. Se um caractere se perde entre os trechos, o texto que
     * a pessoa lê deixou de ser o que a IA escreveu. */
    ok(el.textContent === COM,
       "L27 o comentário desenhado é EXATAMENTE o comentário original");

    /* filtra pela CLASSE, e não por tagName: o nome da tag no simulador
     * é detalhe dele, e um teste que depende disso cobra o simulador em
     * vez de cobrar o aplicativo */
    const filhos = Array.from(el.children || []);
    const botoes = filhos.filter((c) =>
      c && String(c.className || "").indexOf("qs-lei-link") >= 0);
    ok(botoes.length === 3,
       "L28 três citações viram três botões · vieram " + botoes.length);
    ok(botoes.every((b) => (b.className || "").indexOf("qs-lei-link") >= 0),
       "L29 todo trecho clicável carrega a classe qs-lei-link");

    /* O ESTADO É VISÍVEL ANTES DO TOQUE: o art. 99 não nomeia lei e o
     * tópico tem duas — esse não pode parecer que já sabe o caminho. */
    const semAlvo = botoes.filter((b) => (b.className || "").indexOf("qs-lei-link-sem") >= 0);
    ok(semAlvo.length === 1,
       "L30 o link sem lei resolvida se anuncia diferente · vieram " + semAlvo.length);

    ok(!el.innerHTML,
       "L31 o comentário não passa por innerHTML");
  }
  {
    /* o caso comum em Português e Informática: comentário sem citação
     * nenhuma continua sendo texto puro, sem nada em volta */
    const { api } = rodar();
    const el = api.document.createElement("div");
    const txt = "A crase é obrigatória antes de palavra feminina definida.";
    api.qsUiComentario(el, { disciplina: "Português", topico: "Crase", comentario: txt });
    ok(el.textContent === txt, "L32 comentário sem citação fica intacto");
    ok(Array.from(el.children || []).length === 0,
       "L33 comentário sem citação não cria botão nenhum");
  }

  /* ==============================================================
   * L34-L37: O ⚖ PERGUNTA EM VEZ DE CHUTAR
   * ============================================================== */
  {
    const { api } = rodar();
    montarBiblioteca(api, 2);
    const q = { disciplina: DISC, topico: TOP, comentario: "" };
    const caixa = api.document.createElement("div");
    const bt = api.document.createElement("button");
    caixa.append(bt);

    const menu = api.qsUiLeiEscolher(bt, q, null);
    ok(!!menu && menu.hidden === false, "L34 o menu de escolher a lei abre");
    const itens = Array.from((menu && menu.children) || [])
      .filter((c) => c && String(c.className || "").indexOf("qs-fer-rot") < 0);
    /* duas leis do tópico + "usar uma lei já guardada" + "colar nova" */
    ok(itens.length === 4,
       "L35 uma opção por lei do tópico, mais vincular e colar · vieram " + itens.length);
    ok(itens.some((b) => String(b.textContent || "").indexOf("LC 101/2000") >= 0)
       && itens.some((b) => String(b.textContent || "").indexOf("Lei 4.320") >= 0),
       "L36 as duas leis do tópico aparecem pelo nome");
    ok(itens.some((b) => b.id === "btnQsLeiNova"),
       "L37 dá para incluir lei nova sem sair da questão");

    /* o mesmo toque fecha: senão o botão vira um interruptor que só liga */
    const segundo = api.qsUiLeiEscolher(bt, q, null);
    ok(segundo === null && menu.hidden === true,
       "L38 tocar de novo fecha o menu");
  }

  /* ==============================================================
   * L39-L41: ABRE A LEI ESCOLHIDA, E NÃO "A PRIMEIRA"
   *
   * O SALTO ATÉ O ARTIGO NÃO É TESTÁVEL AQUI, e dizer isso é melhor do
   * que fingir. leiIrArtigo procura "#leiArt_35", um id criado em tempo
   * de desenho; o simulador só resolve os ids que existem no
   * index.html, então ele devolve false para QUALQUER artigo. Uma
   * asserção de "achou" passaria ou falharia por causa do simulador, e
   * não do aplicativo — que é a definição de asserção vazia.
   *
   * O que ESTE arquivo tem de provar é outra coisa, e é a que o defeito
   * pede: que a lei aberta seja a ESCOLHIDA. Por isso as duas leis do
   * mesmo tópico são abertas uma após a outra — se o código voltasse a
   * pegar "a primeira da fila", uma das duas quebraria.
   * ============================================================== */
  {
    const { api } = rodar();
    montarBiblioteca(api, 2);

    api.leiAbrirNoArtigo(DISC, TOP, "lei_4320", "35");
    ok(String(api.$("leiTitulo").textContent || "") === "Lei 4.320/1964",
       "L39 abre a lei pedida · veio: " + api.$("leiTitulo").textContent);
    ok(api.leiModoAtual() === "ler",
       "L40 abre para LER: no meio da prova o que se quer é conferir a letra");

    api.leiAbrirNoArtigo(DISC, TOP, "lei_lc101", "1");
    ok(String(api.$("leiTitulo").textContent || "") === "LC 101/2000",
       "L41 e abre a OUTRA quando é a outra que a questão cita · veio: "
       + api.$("leiTitulo").textContent);
  }

  if (!n) falhas.push("nenhuma asserção rodou — o arquivo abortou no meio");
  return falhas;
}

module.exports = { testes };
