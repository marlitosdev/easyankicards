/* ARQUIVAR EM VEZ DE APAGAR, E AS ABAS QUE TORNAM ISSO POSSÍVEL
 *
 * O PROBLEMA REAL, medido numa base de verdade: 523 vínculos, 246 sem
 * histórico. Marcar 246 caixas à mão ninguém faz; apagar os 246 de uma
 * vez é uma decisão sobre 246 casos que ninguém leu.
 *
 * A saída não é um classificador melhor — é baixar o custo de errar.
 * Arquivar tira da frente sem destruir: se o vínculo era bom, ele volta
 * de onde está, com um toque.
 *
 * O QUE PRECISA SER VERDADE:
 *
 * 1. ARQUIVADO SOME DE TODO LUGAR — agenda, resumo, lista de revisão e
 *    das contagens. Um arquivar que não muda nenhum número visível
 *    parece não ter funcionado.
 * 2. ARQUIVADO NÃO VOLTA SOZINHO. Nem quando o tópico ganha resumo.
 *    Um vínculo que ressuscita no meio de um estudo chega com a
 *    autoridade de quem tem conteúdo, e você já o tinha dispensado.
 * 3. NADA É APAGADO: o vínculo continua no armazenamento, e volta
 *    inteiro.
 * 4. A ABA MANDA NO QUE SE MARCA. "Marcar os desta aba" não pode
 *    marcar o que a pessoa não está vendo. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };

  /* UM CENÁRIO COM OS DOIS TIPOS DE VÍNCULO.
   *
   * Sem os dois, "arquivar tirou os sem histórico" passaria arquivando
   * tudo — e a asserção não distinguiria uma faxina de um apagar geral.
   *
   *  · ISS (futuro) ↔ SEFAZ (futuro): TEM histórico, porque as duas
   *    provas ainda vão acontecer e a coincidência é o próprio aviso;
   *  · ISS (futuro) ↔ TCE (encerrado, sem material, sem estudo):
   *    SEM histórico. */
  const montar = (api) => {
    api.matIniciar(); api.edIniciar(); api.vkCarregar();
    const iss = api.edCriar("ISS", "# ISS | prova: " + daqui(80)
      + " | horas: 20\n@ Tributario :: 5\n+ Imunidades :: 5 :: a\n"
      + "+ Improbidade :: 5 :: b");
    const sef = api.edCriar("SEFAZ", "# SEFAZ | prova: " + daqui(120)
      + " | horas: 20\n@ Tributario :: 5\n+ Imunidade tributaria :: 5 :: c");
    const tce = api.edCriar("TCE", "# TCE | prova: " + daqui(-200)
      + " | horas: 20\n@ Antigo :: 5\n+ Assunto encerrado :: 5 :: d");
    api.vkAplicar([{ de: { chave: api.vkChave("Tributario", "Imunidades") },
      para: { chave: api.vkChave("Tributario", "Imunidade tributaria") },
      conf: "ALTA" }], sef.id, "ambos");
    api.vkAplicar([{ de: { chave: api.vkChave("Tributario", "Improbidade") },
      para: { chave: api.vkChave("Antigo", "Assunto encerrado") },
      conf: "ALTA" }], tce.id, "ambos");
    api.hubAbrirEdital(iss.id);
    api.vkIniciarTela();
    api.vkRevAbrir();
    return { iss, sef, tce };
  };

  /* ================================================================
   * A1: AS ABAS SEPARAM, E AS CONTAS BATEM COM A LISTA
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    const d = api.vkRevDadosAtual();
    ok(d.total === 2, "A1-pre o cenario nao criou os dois vinculos: " + d.total);
    /* OS DOIS TIPOS, e não dois iguais. */
    ok(d.mudos === 1 && d.falantes === 1,
       "A1-pre2 o cenario nao tem um de cada tipo (mudos=" + d.mudos
       + ", falantes=" + d.falantes + "), e as abas nao ficam separadas");

    api.vkRevAbaTrocar("mudos");
    ok(api.vkRevVisiveis().length === 1,
       "A1 a aba 'sem historico' nao filtrou: "
       + api.vkRevVisiveis().length);
    /* A CONTA DA ABA E A LISTA PINTADA SÃO A MESMA REGRA. Se a aba diz
     * 246 e a tela mostra outro número, o botão "marcar os 246" mente. */
    ok(api.vkRevVisiveis().length === d.mudos,
       "A1a a aba diz um numero e mostra outro");
    api.vkRevAbaTrocar("falam");
    ok(api.vkRevVisiveis().length === 1,
       "A1b a aba 'com historico' nao filtrou");
    ok(api.vkRevVisiveis()[0].mudo === false,
       "A1c a aba 'com historico' trouxe um sem historico");
    api.vkRevAbaTrocar("todos");
    ok(api.vkRevVisiveis().length === 2,
       "A1d a aba 'todos' nao mostra os dois");

    /* A ETIQUETA MUDOU DE NOME: "SEM NADA" era vago e informal. */
    const html = api.$("vkRevLista").textContent || "";
    ok(/SEM HIST[ÓO]RICO/i.test(html),
       "A1e a etiqueta nao aparece na lista: " + html.slice(0, 120));
    ok(!/SEM NADA/i.test(html),
       "A1f o rotulo antigo 'SEM NADA' continua na tela");
  }

  /* ================================================================
   * A2: MARCAR SÓ O QUE ESTÁ NA ABA
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.vkRevAbaTrocar("mudos");
    api.vkRevMarcarVisiveis();
    const m = api.vkRevMarcadosAtual();
    ok(Object.keys(m).length === 1,
       "A2 marcar na aba 'sem historico' marcou fora dela: "
       + Object.keys(m).length);
    ok(Object.keys(m).every((k) => m[k].mudo),
       "A2a marcou um vinculo que tem historico");

    /* NA ABA "TODOS" marca os dois — a regra é o que está na tela, e
     * não uma lista fixa de "os mudos". */
    api.vkRevDesmarcar();
    api.vkRevAbaTrocar("todos");
    api.vkRevMarcarVisiveis();
    ok(Object.keys(api.vkRevMarcadosAtual()).length === 2,
       "A2b na aba 'todos' nao marcou os dois: "
       + Object.keys(api.vkRevMarcadosAtual()).length);
  }

  /* ================================================================
   * A3: ARQUIVAR TIRA DA FRENTE SEM DESTRUIR
   * ============================================================== */
  {
    const { api } = rodar();
    const { iss } = montar(api);
    const guardadosAntes = api.vinculosAtual().length;

    api.vkRevAbaTrocar("mudos");
    api.vkRevMarcarVisiveis();
    await conduzir(api, api.vkRevArquivar(true));

    /* 1. SOME DAS CONTAS. */
    const d = api.vkRevDadosAtual();
    ok(d.total === 1,
       "A3 o arquivado continua contando no total: " + d.total);
    ok(d.mudos === 0,
       "A3a o arquivado continua contando como sem historico: " + d.mudos);
    ok((d.arquivados || []).length === 1,
       "A3b o arquivado nao apareceu na lista de arquivados");

    /* 2. NÃO FOI APAGADO. É a diferença inteira entre as duas saídas. */
    ok(api.vinculosAtual().length === guardadosAntes,
       "A3c arquivar apagou o vinculo do armazenamento: "
       + api.vinculosAtual().length + " de " + guardadosAntes);
    ok(api.vkContarArquivados() === 1,
       "A3d o vinculo nao ficou marcado como arquivado");

    /* 3. SOME DA AGENDA. Este é o efeito que a pessoa vê. */
    const ligados = api.vkLigadosDe("Tributario", "Improbidade");
    ok(ligados.length === 0,
       "A3e o vinculo arquivado continua aparecendo na agenda: "
       + ligados.length);
    /* e o outro, que não foi arquivado, continua aparecendo — senão a
     * asserção acima passaria com um vkLigadosDe quebrado */
    ok(api.vkLigadosDe("Tributario", "Imunidades").length === 1,
       "A3f-pre arquivar derrubou tambem o vinculo que ficou");
  }

  /* ================================================================
   * A4: NÃO VOLTA SOZINHO, MAS VOLTA QUANDO VOCÊ MANDA
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api);
    api.vkRevAbaTrocar("mudos");
    api.vkRevMarcarVisiveis();
    await conduzir(api, api.vkRevArquivar(true));

    /* O TÓPICO GANHA MATERIAL. Antes de arquivar, escrever um resumo
     * aqui faria o vínculo deixar de ser mudo e voltar à tela. Depois
     * de arquivado, não: você já disse que não quer ver isto, e um
     * aviso que ressuscita no meio de um estudo chega sem nada por
     * perto que lembre de onde veio. */
    api.matGravar(api.matChave("Antigo", "Assunto encerrado"),
      "um resumo escrito agora neste topico",
      { disciplina: "Antigo", topico: "Assunto encerrado" });
    api.vkRevDadosPara(api.vkRevisao(api.vkRevFontes()));
    ok(api.vkRevDadosAtual().total === 1,
       "A4 o vinculo arquivado voltou sozinho quando o topico ganhou resumo");
    ok(api.vkLigadosDe("Tributario", "Improbidade").length === 0,
       "A4a o arquivado voltou para a agenda por causa do resumo novo");

    /* MAS VOLTA POR DECISÃO SUA, e volta inteiro. */
    api.vkRevAbaTrocar("arq");
    ok(api.vkRevVisiveis().length === 1,
       "A4b a aba de arquivados nao mostra o que foi arquivado");
    api.vkRevMarcarVisiveis();
    await conduzir(api, api.vkRevArquivar(false));
    ok(api.vkContarArquivados() === 0,
       "A4c reativar nao desarquivou");
    ok(api.vkLigadosDe("Tributario", "Improbidade").length === 1,
       "A4d reativado, o vinculo nao voltou para a agenda");
    /* E VOLTOU COM O QUE APRENDEU: agora o tópico tem resumo, então ele
     * não é mais "sem histórico" — o que prova que voltou de verdade,
     * e não como uma cópia congelada do que era. */
    const d2 = api.vkRevDadosAtual();
    ok(d2.total === 2 && d2.mudos === 0,
       "A4e voltou, mas sem reavaliar: total=" + d2.total
       + " mudos=" + d2.mudos);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
