/* =====================================================================
 * CITAÇÃO DENTRO DA PRÓPRIA LEI ABRE UM PREVIEW DO ARTIGO
 *
 * O PEDIDO: "ligar as leis" como já é feito nas questões — uma citação
 * a outra lei, dentro do TEXTO DE UMA LEI (não de um comentário de
 * questão), também devia levar até lá. E verificar antes se é preciso
 * mesmo abrir a lei inteira, ou só o trecho próximo resolve.
 *
 * A DECISÃO: abre um preview pequeno (o artigo citado, já na redação
 * vigente), sem trocar a leitura atual — "abrir a lei inteira" continua
 * disponível dentro do preview, para quem realmente quer navegar, e
 * reaproveita a MESMA porta que a questão já usa (leiAbrirNoArtigo +
 * leiVoltaPara).
 *
 * DOIS DEFEITOS REAIS FORAM ACHADOS TESTANDO ISTO, E FICAM AQUI:
 * 1. leiCitacoesNoTexto também reconhece o "Art. 5º." com que o PRÓPRIO
 *    artigo começa (o texto guardado carrega o número junto) — sem
 *    filtrar por citações com LEI NOMEADA, todo artigo virava um link
 *    morto em cima do próprio título.
 * 2. O simulador de DOM dos testes (fumaca.js) tinha insertBefore()
 *    como no-op puro, e os nós que nascem de innerHTML nunca ganhavam
 *    parentNode — dois buracos que faziam a fiação de citação (que
 *    precisa fatiar um nó de texto sem tocar no resto) rodar sem erro
 *    nenhum e não mudar nada. Os dois foram corrigidos no simulador.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const DISC = "Direito Administrativo";
  const TOP = "Licitações";

  const preparar = (api) => {
    api.matIniciar(); api.leiIniciar();
    return api.matChave(DISC, TOP);
  };

  /* ==============================================================
   * V1-V4: A CITAÇÃO A OUTRA LEI VIRA LINK, E O PRÓPRIO CAPUT NÃO
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.leiGuardar({ id: "lei_8666", nome: "Lei 8.666/1993", numero: "8.666",
      especie: "Lei",
      texto: "Art. 1º. Esta Lei institui normas gerais de licitação." });
    api.leiGuardar({ id: "lei_a", nome: "Lei A",
      texto: "Art. 5º. Aplica-se, no que couber, o disposto no art. 1º da "
        + "Lei 8.666/1993, no que for cabível." });
    api.leiLigar("lei_a", ch);
    api.leiAbrir(DISC, TOP, "lei_a");

    const corpo = api.$("leiLeitura").querySelectorAll(".lei-art-txt")[0];
    ok(!!corpo, "V1pre o artigo nao foi desenhado na leitura");

    const links = api.$("leiLeitura").querySelectorAll("button.lei-cita-link");
    ok(links.length === 1,
       "V1 a citacao a outra lei nao virou link (ou virou mais de um) · "
       + "vieram " + links.length);
    ok(!!links[0] && /Lei 8\.666\/1993/.test(links[0].textContent || ""),
       "V1a o link nao mostra a citacao completa: "
       + (links[0] && links[0].textContent));

    /* O CAPUT NÃO VIROU LINK MORTO — era o defeito achado ao testar: o
     * "Art. 5º." do próprio artigo bate em leiCitacoesNoTexto do mesmo
     * jeito que uma citação de verdade, só que sem lei nomeada. */
    ok(!links.some((b) => /^Art\. 5/.test(b.textContent || "")),
       "V2 o proprio 'Art. 5º' do caput virou um link — nao e citacao a "
       + "lei nenhuma, e clicar nele nao levaria a lugar algum");

    /* O TEXTO NA TELA CONTINUA EXATAMENTE O MESMO — desenhar o link não
     * pode comer nem repetir uma letra do artigo. */
    ok(corpo.textContent === "Art. 5º. Aplica-se, no que couber, o disposto "
       + "no art. 1º da Lei 8.666/1993, no que for cabível.",
       "V3 desenhar o link mudou o texto do artigo: "
       + JSON.stringify(corpo.textContent));

    /* SEM CITAÇÃO NENHUMA, NENHUM LINK — o caso comum não pode ganhar
     * botão à toa. */
    api.leiGuardar({ id: "lei_c", nome: "Lei C",
      texto: "Art. 1º. Disposição sem citação nenhuma." });
    api.leiLigar("lei_c", api.matChave("Outra", "Sem citação"));
    api.leiAbrir("Outra", "Sem citação", "lei_c");
    ok(api.$("leiLeitura").querySelectorAll("button.lei-cita-link").length === 0,
       "V4 um artigo sem nenhuma citacao a outra lei ganhou link do nada");
  }

  /* ==============================================================
   * V5-V9: O PREVIEW MOSTRA O ARTIGO CERTO, JÁ NA REDAÇÃO VIGENTE
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.leiGuardar({ id: "lei_8666", nome: "Lei 8.666/1993", numero: "8.666",
      especie: "Lei",
      texto: "Art. 1º. Redação original da licitação.\n"
        + "Art. 2º. As obras, serviços e compras seguem esta Lei." });
    api.leiArtigoAlterar("lei_8666", "1",
      { texto: "Art. 1º. Redação dada pela Lei 14.133/2021.",
        fonteAlteracao: "Lei 14.133/2021" });
    api.leiGuardar({ id: "lei_a", nome: "Lei A",
      texto: "Art. 5º. Vide art. 1º da Lei 8.666/1993." });
    api.leiLigar("lei_a", ch);
    api.leiAbrir(DISC, TOP, "lei_a");

    const link = api.$("leiLeitura").querySelectorAll("button.lei-cita-link")[0];
    ok(!!link, "V5pre a citacao nao virou link");
    link.onclick({});

    ok(api.$("dlgLeiCitaPreview").open === true,
       "V5 clicar na citacao nao abriu o preview");
    ok(api.$("leiCitaPreviewTitulo").textContent === "Lei 8.666/1993",
       "V6 o preview nao mostra o nome da lei citada: "
       + api.$("leiCitaPreviewTitulo").textContent);

    /* A REDAÇÃO VIGENTE, NÃO A ORIGINAL — o mesmo selo que a leitura
     * normal usa para artigo alterado (leiArtigosEfetivos). */
    ok(/Redação dada pela Lei 14\.133/.test(api.$("leiCitaPreviewTexto").textContent || ""),
       "V7 o preview mostrou a redacao ORIGINAL, nao a vigente: "
       + api.$("leiCitaPreviewTexto").textContent);
    ok(/alterado/i.test(api.$("leiCitaPreviewArtigo").textContent || ""),
       "V8 o preview nao avisa que o artigo foi alterado: "
       + api.$("leiCitaPreviewArtigo").textContent);
    ok(api.$("btnLeiCitaPreviewAbrir").hidden === false,
       "V9 o escape hatch 'abrir a lei inteira' nao apareceu");

    /* A LEITURA ATUAL NÃO MUDOU — o preview é uma janela por cima, não
     * uma troca de tela. */
    ok(api.$("leiTitulo").textContent === "Lei A",
       "V9a abrir o preview trocou a lei que estava sendo lida");
  }

  /* ==============================================================
   * V10-V11: CITAÇÃO A LEI QUE NÃO ESTÁ NA BIBLIOTECA — AVISA, NÃO
   * INVENTA, E NÃO OFERECE "ABRIR A LEI INTEIRA" PARA NADA
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.leiGuardar({ id: "lei_a", nome: "Lei A",
      texto: "Art. 5º. Vide art. 1º da Lei 9.999/1999." });
    api.leiLigar("lei_a", ch);
    api.leiAbrir(DISC, TOP, "lei_a");

    const link = api.$("leiLeitura").querySelectorAll("button.lei-cita-link")[0];
    ok(!!link, "V10pre a citacao a lei desconhecida nao virou link");
    link.onclick({});

    ok(api.$("dlgLeiCitaPreview").open === true,
       "V10 clicar na citacao desconhecida nao abriu nada");
    ok(/9\.999\/1999/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
       "V10a o aviso nao diz qual lei nao foi achada: "
       + api.$("leiCitaPreviewTitulo").textContent);
    ok(api.$("btnLeiCitaPreviewAbrir").hidden === true,
       "V11 o botao 'abrir a lei inteira' apareceu para uma lei que nao "
       + "existe na biblioteca");
  }

  /* ==============================================================
   * V12-V15: "ABRIR A LEI INTEIRA" NAVEGA, E VOLTA PARA ONDE ESTAVA
   *
   * O ESCAPE HATCH reaproveita leiAbrirNoArtigo + leiVoltaPara — a
   * MESMA porta que a citação de uma questão já usa. Aqui o "de onde
   * vim" é a própria lei que estava sendo lida, não uma questão.
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.leiGuardar({ id: "lei_8666", nome: "Lei 8.666/1993", numero: "8.666",
      especie: "Lei", texto: "Art. 1º. Institui normas gerais de licitação." });
    api.leiGuardar({ id: "lei_a", nome: "Lei A",
      texto: "Art. 5º. Vide art. 1º da Lei 8.666/1993." });
    api.leiLigar("lei_a", ch);
    api.leiAbrirNoArtigo(DISC, TOP, "lei_a", "5");
    ok(api.$("leiTitulo").textContent === "Lei A",
       "V12pre nao abriu a lei de origem no artigo certo");

    const link = api.$("leiLeitura").querySelectorAll("button.lei-cita-link")[0];
    link.onclick({});
    api.leiCitacaoPreviewAbrirLeiInteira();

    ok(api.$("leiTitulo").textContent === "Lei 8.666/1993",
       "V12 'abrir a lei inteira' nao navegou para a lei citada: "
       + api.$("leiTitulo").textContent);
    ok(api.leiModoAtual() === "ler",
       "V13 a lei citada nao abriu em modo de LEITURA");
    ok(api.$("dlgLeiCitaPreview").open !== true,
       "V14 o preview continuou aberto por cima da lei citada");

    /* fechar a lei citada volta para a Lei A — o mesmo "voltar de onde
     * vim" que a questão já usa, aqui vindo de dentro da própria lei */
    await api.leiFechar();
    ok(api.$("leiTitulo").textContent === "Lei A",
       "V15 fechar a lei citada nao voltou para a lei de origem: "
       + api.$("leiTitulo").textContent);
  }

  if (!n) falhas.push("nenhuma asserção rodou — o arquivo abortou no meio");
  return falhas;
}

module.exports = { testes };
