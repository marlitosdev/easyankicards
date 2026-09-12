/* O QUE ESTE ARQUIVO DEFENDE
 *
 * 1. TRÊS BOTÕES QUE PARECEM UM SÓ. "Comparar e vincular editais",
 *    "Revisar vínculos" e "comparar estes dois" ocupavam a mesma tela
 *    com verbos vagos. Dois deles são a MESMA função — "comparar estes
 *    dois" é vkAbrir com os seletores preenchidos, um atalho com
 *    argumento. O terceiro faz o CONTRÁRIO: apaga o que os outros
 *    criam. Então o certo não é fundir os três nem manter os três: é
 *    dizer qual é qual, e a contagem faz isso sozinha.
 *
 * 2. TRÊS LINHAS DE TEXTO NÃO VALEM UM MODAL. O (?) abria um <dialog>
 *    que escurece a tela, rouba o foco e cobra um "OK" para devolver a
 *    navegação — três gestos para ler uma frase, interrompendo quem
 *    parou no meio de uma decisão justamente para tirar uma dúvida
 *    pequena.
 *
 * LIMITE DO SIMULADOR: "document.addEventListener" é um no-op aqui, e
 * por isso o fechamento por clique fora e por Esc não pode ser
 * exercitado — só o que passa pelas funções. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const doisEditais = (api) => {
    api.edIniciar();
    const a = api.edCriar("SEFAZ", "# SEFAZ | prova: " + daqui(120)
      + " | horas: 20\n@ Direito Tributário :: 5\n+ Imunidades :: 5 :: x");
    const b = api.edCriar("ISS", "# ISS | prova: " + daqui(90)
      + " | horas: 20\n@ Direito Tributário :: 5\n+ Imunidade tributária :: 5 :: y");
    return { a, b };
  };

  /* ================================================================
   * B1: O BOTÃO DA REVISÃO DIZ QUANTOS, E SOME NO ZERO
   * ============================================================== */
  {
    const { api } = rodar();
    doisEditais(api);
    api.vkCarregar();

    /* SEM VÍNCULO NENHUM não há o que revisar, e um botão que abre uma
     * tela vazia é pior do que botão nenhum: ele promete conteúdo. */
    api.vkPintarBotoes();
    ok(api.$("btnHubRevisar").hidden === true,
       "B1 sem nenhum vinculo o botao de revisar continua na tela");
    /* o de comparar NÃO some: é ele que cria o primeiro vínculo */
    ok(api.$("btnHubVincular").hidden !== true,
       "B1a o botao de comparar sumiu junto, e ai nao ha como comecar");

    /* COM UM SÓ, o texto vai no singular. */
    api.vinculosAtual().push({ a: "x›1", b: "y›1" });
    api.vkPintarBotoes();
    ok(api.$("btnHubRevisar").hidden === false,
       "B1b existe vinculo e o botao de revisar continua escondido");
    ok(/1 v[íi]nculo\b/.test(api.$("btnHubRevisar").textContent || ""),
       "B1c com um vinculo o botao nao usa o singular: "
       + api.$("btnHubRevisar").textContent);

    /* COM VÁRIOS, a contagem — que é o que separa este botão do azul ao
     * lado. "Revisar vínculos" e "Comparar editais" são dois verbos
     * vagos; "Revisar os 3 vínculos" já diz que mexe no que existe. */
    api.vinculosAtual().push({ a: "x›2", b: "y›2" });
    api.vinculosAtual().push({ a: "x›3", b: "y›3" });
    api.vkPintarBotoes();
    const txt = api.$("btnHubRevisar").textContent || "";
    ok(/3/.test(txt),
       "B1d o botao nao traz a contagem de vinculos: " + txt);
    ok(!/\{n\}/.test(txt),
       "B1e o marcador {n} vazou para a tela: " + txt);
    /* e os dois botões não podem dizer a mesma coisa */
    ok(txt.trim().toLowerCase()
       !== (api.$("btnHubVincular").textContent || "").trim().toLowerCase(),
       "B1f os dois botoes ficaram com o mesmo texto: " + txt);
  }

  /* ================================================================
   * B2: "COMPARAR ESTES DOIS" É O MESMO COMANDO, COM ARGUMENTO
   * ============================================================== */
  {
    const { api } = rodar();
    /* TRÊS EDITAIS, e não dois.
     *
     * Com dois, o par que o mapa manda é forçosamente o mesmo que
     * vkAbrir montaria sozinho — não há outro — e a asserção de que o
     * atalho "levou o par escolhido" passaria mesmo se ele ignorasse os
     * argumentos por completo. A pré-condição B2c-pre pegou isto. */
    const { a, b } = doisEditais(api);
    const c = api.edCriar("TCE", "# TCE | prova: " + daqui(200)
      + " | horas: 20\n@ Controle Externo :: 5\n+ Licitações :: 5 :: z");
    api.vkCarregar();
    api.vkIniciarTela();

    /* O botão azul abre a comparação sem escolha feita. */
    api.vkAbrir();
    const de1 = api.$("vkDeEdital").value, para1 = api.$("vkParaEdital").value;
    ok(String(de1) !== String(para1),
       "B2 a comparacao abriu com o mesmo edital dos dois lados");

    /* A LINHA DO MAPA abre A MESMA TELA, com os dois já escolhidos — e
     * é por isso que ela não é um terceiro comando. Se abrisse outra
     * coisa, aí sim haveria três funções. */
    /* FECHAR ANTES. O vkAbrir acima deixou a tela aberta, e enquanto ela
     * estivesse aberta a asserção "o atalho abriu a tela" seria
     * verdadeira mesmo que o atalho não abrisse nada — foi o que a
     * sabotagem mostrou. */
    api.$("dlgJaEstudei").close();
    ok(api.$("dlgJaEstudei").open === false,
       "B2-pre a tela nao fechou, e o teste de abertura nao vale nada");
    api.vkAbrirPar(c.id, b.id);
    ok(String(api.$("vkDeEdital").value) === String(c.id)
       && String(api.$("vkParaEdital").value) === String(b.id),
       "B2a 'comparar estes dois' nao levou o par escolhido para a tela");
    ok(api.$("dlgJaEstudei").open === true,
       "B2b 'comparar estes dois' nao abriu a tela de comparacao");
    /* PROVA DE QUE É A MESMA TELA e não uma cópia: o par escolhido tem
     * de ser diferente do que vkAbrir montaria sozinho, senão a
     * asserção acima passaria por coincidência. */
    ok(String(c.id) !== String(de1) || String(b.id) !== String(para1),
       "B2c-pre o par do mapa coincide com o padrao: o teste nao separa os dois caminhos");
  }

  /* ================================================================
   * B3: O (?) É UM BALÃO, NÃO UM MODAL
   * ============================================================== */
  {
    const { api } = rodar();
    api.vkIniciarTela();
    const alvo = api.$("btnVkAjuda");
    ok(!!alvo, "B3-pre o (?) da comparacao nao existe na tela");

    ok(api.dicaAberta() === false,
       "B3 o balao ja nasce aberto");
    const bal = api.dicaMostrar(alvo, "um texto de ajuda qualquer");
    ok(api.dicaAberta() === true, "B3a o balao nao abriu");
    ok(/um texto de ajuda/.test(bal.textContent || ""),
       "B3b o balao abriu sem o texto: " + bal.textContent);
    /* NÃO É MODAL: nada de <dialog>, nada de escurecer a tela. O que
     * está atrás continua legível — é o ponto de ser uma dica. */
    ok(!api.$("dlgAjuda").open,
       "B3c abrir a dica abriu um modal por baixo dos panos");

    /* TOCAR NO MESMO (?) FECHA. Sem isto o ícone só liga, e para
     * desligar seria preciso adivinhar que clicar fora resolve. */
    api.dicaMostrar(alvo, "um texto de ajuda qualquer");
    ok(api.dicaAberta() === false,
       "B3d tocar no mesmo (?) de novo nao fechou o balao");

    /* TROCAR DE (?) não empilha dois balões na tela. */
    api.dicaMostrar(alvo, "primeiro");
    const outro = api.$("btnJurAjuda");
    ok(!!outro, "B3-pre2 o (?) da jurisprudencia nao existe, e o cenario nao troca de alvo");
    const b2 = api.dicaMostrar(outro, "segundo");
    ok(/segundo/.test((b2 && b2.textContent) || ""),
       "B3e trocar de (?) nao trocou o texto");
    ok(api.dicaBalaoAtual() === b2,
       "B3f sobrou mais de um balao aberto ao trocar de (?)");

    api.dicaFechar();
    ok(api.dicaAberta() === false, "B3g dicaFechar nao fechou");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
