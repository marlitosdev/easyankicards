/* A TELA DE ESTUDO DOS CARTÕES — e as três coisas erradas nela.
 *
 * 1. ETIQUETAS EM DOBRO. O prompt manda a IA escrever exatamente as
 *    etiquetas do tópico no terceiro campo, e ao gravar elas eram
 *    acrescentadas OUTRA VEZ. Toda linha salva saía com as quatro tags
 *    repetidas, e a tela de estudo as mostrava duas vezes seguidas. O
 *    Anki junta iguais na importação, então o estrago era invisível lá
 *    e permanente aqui.
 *
 * 2. A TELA MOSTRAVA O CARTÃO COMO AUTOR, não como aluno: um retângulo
 *    azul escrito "título deste cartão", um aviso amarelo de "sai sem
 *    cabeçalho" e três linhas de etiquetas — tudo ANTES da pergunta,
 *    que é o único pedaço que importa quando se está estudando.
 *
 * 3. A ORDEM DOS BOTÕES punha "apagar este cartão", em vermelho, logo
 *    abaixo de "mostrar a resposta". A mão passava por cima dele
 *    cinquenta vezes por sessão.
 *
 * E faltava o que a sessão de questões já tinha: voltar de onde parou. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(
  path.join(__dirname, "..", "docs", "index.html"), "utf8");

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
  const montar = (api, quantos) => {
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("Direito Financeiro", "Receita Pública");
    const linhas = [];
    for (let i = 1; i <= (quantos || 3); i++) {
      linhas.push("Pergunta " + i + "? :: Resposta " + i + ". :: tag_x");
    }
    api.matGravar(ch, "resumo", {
      disciplina: "Direito Financeiro", topico: "Receita Pública",
      concurso: "TCE-PE",
    });
    /* os cartões moram no MESMO registro do resumo mas têm porta
     * própria: matGravar não os aceita como metadado */
    api.matGravarCartoes(ch, linhas.join("\n"),
      { disciplina: "Direito Financeiro", topico: "Receita Pública" });
    api.matAbrirEditor(
      { disciplina: "Direito Financeiro", nome: "Receita Pública" }, true);
    return ch;
  };

  /* ================================================================
   * D1: etiquetas não podem sair em dobro
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("Direito Financeiro", "Receita Pública");
    api.matGravar(ch, "resumo", { disciplina: "Direito Financeiro",
      topico: "Receita Pública", concurso: "TCE-PE" });
    api.matAbrirEditor(
      { disciplina: "Direito Financeiro", nome: "Receita Pública" }, true);
    api.matCartoesAbrir();
    /* a IA devolve exatamente as etiquetas que o prompt pediu */
    const doTopico = api.matEtiquetasTopico(
      "Direito Financeiro", "Receita Pública", "TCE-PE", "resumo");
    api.$("mcTexto").value =
      "Pergunta? :: Resposta. :: " + doTopico.join(" ");
    api.matCartoesConferir();
    await conduzir(api, api.matCartoesSalvar());

    const linha = String((api.matResumosAtual()[ch] || {}).cartoes || "");
    const campos = linha.split("::").map((x) => x.trim());
    const tags = (campos[2] || "").split(/\s+/).filter(Boolean);
    ok(tags.length === doTopico.length,
       "D1 as etiquetas sairam em dobro: " + tags.length
       + " onde deviam ser " + doTopico.length + " → " + tags.join(" "));
    const vistas = {};
    const repetidas = tags.filter((x) => {
      const k = x.toLowerCase();
      if (vistas[k]) return true;
      vistas[k] = 1; return false;
    });
    ok(!repetidas.length,
       "D1b etiqueta repetida na linha salva: " + repetidas.join(" "));
  }

  /* ---- D2: juntar etiquetas não perde nem repete ---- */
  {
    const { api } = rodar();
    /* A REGRA, testada com listas na mão: a ordem da primeira aparição
     * é preservada (as do tópico primeiro, que é como se procura), e a
     * comparação ignora maiúsculas — "Direito_Financeiro" e
     * "direito_financeiro" são a mesma etiqueta para quem busca. */
    const r = api.matJuntarTags(["a_um", "b_dois"], ["B_DOIS", "c_tres"]);
    ok(r.length === 3, "D2 juntou errado: " + JSON.stringify(r));
    ok(r[0] === "a_um" && r[1] === "b_dois" && r[2] === "c_tres",
       "D2b a ordem da primeira aparicao nao foi preservada: "
       + JSON.stringify(r));
    ok(api.matJuntarTags([], ["so_esta"]).length === 1,
       "D2c lista vazia atrapalhou");
    ok(api.matJuntarTags(["x"], null, undefined, ["y"]).length === 2,
       "D2d lista ausente derrubou a juncao");
    ok(api.matJuntarTags([" ", ""], ["z"]).length === 1,
       "D2e etiqueta vazia entrou na lista");
  }

  /* ================================================================
   * E1: estudar mostra o cartão como ALUNO
   * ============================================================== */
  {
    const { api } = rodar();
    montar(api, 3);
    api.mcEstudarDireto("Direito Financeiro", "Receita Pública");
    const txt = api.$("mcEstCartao").textContent || "";

    /* NADA DE AUTORIA na tela de quem estuda: o retângulo "título deste
     * cartão" é um convite a editar, e o aviso de cabeçalho é uma
     * decisão de quem MONTA o baralho, não de quem responde. */
    ok(txt.indexOf(api.t("card_title_placeholder")) < 0,
       "E1 o titulo de exemplo aparece no estudo: " + txt.slice(0, 80));
    ok(txt.indexOf(api.t("card_using_general_none")) < 0,
       "E1b o aviso de 'sai sem cabecalho' aparece no estudo");
    ok(txt.indexOf("tag_x") < 0,
       "E1c as etiquetas aparecem no estudo, antes da pergunta: "
       + txt.slice(0, 90));
    /* e a pergunta, que é o assunto, está lá */
    ok(/Pergunta 1\?/.test(txt),
       "E1d a pergunta sumiu junto com o resto: " + txt.slice(0, 90));
    /* a resposta só depois de virar */
    ok(!/Resposta 1\./.test(txt),
       "E1e a resposta apareceu sem virar o cartao");
  }

  /* ---- E2: conferir continua mostrando como AUTOR ---- */
  {
    const { api } = rodar();
    montar(api, 2);
    const lista = api.mcCartoesSalvos();
    api.mcEstudarAbrir(0, { lista, revelado: true, deOnde: "conferencia" });
    const txt = api.$("mcEstCartao").textContent || "";
    /* CONFERIR É JULGAR O CARTÃO: aqui as etiquetas e o cabeçalho são o
     * assunto, e escondê-los seria esconder o que se foi ver. */
    ok(txt.indexOf("tag_x") >= 0,
       "E2 a conferencia perdeu as etiquetas junto com o estudo: "
       + txt.slice(0, 90));
    ok(/Resposta 1\./.test(txt),
       "E2b a conferencia devia mostrar a resposta de cara");
  }

  /* ================================================================
   * L1: a ordem da tela é a ordem do gesto
   * ============================================================== */
  {
    const bloco = HTML.slice(HTML.indexOf('id="dlgMcEstudo"'),
      HTML.indexOf("</dialog>", HTML.indexOf('id="dlgMcEstudo"')));
    const iCartao = bloco.indexOf('id="mcEstCartao"');
    const iVirar = bloco.indexOf('id="btnMcEstVirar"');
    const iNav = bloco.indexOf('id="btnMcEstAnt"');
    /* O GESTO PRINCIPAL COLADO NO CARTÃO. Com a navegação no meio, a
     * mão saía do cartão, passava por "← 1 de 50 →" e só então chegava
     * ao botão que se aperta em todo cartão. */
    ok(iCartao > 0 && iVirar > iCartao && iNav > iVirar,
       "L1 a ordem da tela nao e cartao → virar → navegacao: "
       + iCartao + "/" + iVirar + "/" + iNav);

    /* APAGAR SAI DO CAMINHO. Em vermelho logo abaixo da ação principal,
     * a mão passava por cima dele a cada cartão. */
    const iApagar = bloco.indexOf('id="btnMcEstApagar"');
    const iMenu = bloco.indexOf('id="mcEstMenu"');
    ok(iMenu > 0 && iApagar > iMenu,
       "L1b o apagar continua fora do menu, no caminho da mao");
  }

  /* ---- L2: o menu abre, fecha, e não atravessa o cartão ---- */
  {
    const { api } = rodar();
    montar(api, 3);
    api.mcEstudarDireto("Direito Financeiro", "Receita Pública");
    const m = api.$("mcEstMenu");
    ok(m && m.hidden === true, "L2 o menu nasceu aberto");
    api.$("btnMcEstMais").onclick();
    ok(m.hidden === false, "L2b tocar no menu nao o abriu");
    /* TROCAR DE CARTÃO FECHA O MENU: aberto sobre o cartão seguinte, o
     * "apagar" que estava embaixo do dedo passa a valer para OUTRO
     * cartão — e apagar o errado numa pilha de cinquenta é fácil. */
    api.mcEstAndar(1);
    ok(m.hidden === true, "L2c o menu atravessou a troca de cartao");
  }

  /* ================================================================
   * P1: voltar de onde parou
   * ============================================================== */
  {
    const { api } = rodar();
    const ch = montar(api, 5);
    api.mcEstudarDireto("Direito Financeiro", "Receita Pública");
    ok(api.mcEstIdxAtual() === 0, "P1-pre devia abrir no primeiro");
    api.mcEstAndar(1);
    api.mcEstAndar(1);
    ok(api.mcEstIdxAtual() === 2, "P1-pre2 devia estar no terceiro");
    ok(api.mcPareiDe(ch, 5) === 2,
       "P1 nao guardou onde parou: " + api.mcPareiDe(ch, 5));

    /* REABRIR VOLTA PARA LÁ. Sem isto, "continuar amanhã" significa
     * passar de novo pelos trinta que já foram vistos — e a saída
     * prática é não voltar mais. */
    api.$("dlgMcEstudo").close();
    api.mcEstudarDireto("Direito Financeiro", "Receita Pública");
    ok(api.mcEstIdxAtual() === 2,
       "P1b reabrir nao voltou ao cartao onde parou: " + api.mcEstIdxAtual());
  }

  /* ---- P2: a pilha mudou de tamanho, o marcador não vale ---- */
  {
    const { api } = rodar();
    const ch = montar(api, 5);
    api.mcPareiGuardar(ch, 4, 5);
    ok(api.mcPareiDe(ch, 5) === 4, "P2-pre o marcador nao foi guardado");
    /* CARTÕES APAGADOS OU ACRESCENTADOS deslocam tudo: o índice velho
     * aponta para outro cartão, e abrir um cartão qualquer dizendo que
     * foi ali que você parou é pior do que recomeçar. */
    ok(api.mcPareiDe(ch, 4) === 0,
       "P2 o marcador sobreviveu a pilha mudar de tamanho: "
       + api.mcPareiDe(ch, 4));
    ok(api.mcPareiDe(ch, 9) === 0,
       "P2b o marcador sobreviveu a pilha crescer");
    ok(api.mcPareiDe("outro›topico", 5) === 0,
       "P2c o marcador de um topico valeu para outro");
  }

  /* ---- P3: no primeiro cartão não há o que guardar ---- */
  {
    const { api } = rodar();
    const ch = montar(api, 4);
    api.mcPareiGuardar(ch, 3, 4);
    api.mcPareiGuardar(ch, 0, 4);
    /* GUARDAR "ZERO" seria guardar "não comecei" — e aí voltar ao
     * primeiro passa a parecer uma decisão do app, não o começo. */
    ok(api.mcPareiDe(ch, 4) === 0,
       "P3 voltar ao primeiro nao apagou o marcador");
    ok(Object.keys(api.mcPareiLer()).indexOf(ch) < 0,
       "P3b o marcador zerado continua ocupando lugar no armazenamento");
  }

  /* ---- P4: conferir não mexe no marcador ---- */
  {
    const { api } = rodar();
    const ch = montar(api, 5);
    api.mcPareiGuardar(ch, 3, 5);
    /* AMPLIAR UM CARTÃO NA CONFERÊNCIA não é estudar: mexer no marcador
     * ali faria a próxima sessão começar onde alguém só deu uma olhada. */
    const lista = api.mcCartoesSalvos();
    api.mcEstudarAbrir(0, { lista, revelado: true, deOnde: "conferencia" });
    /* e NEM ABRE no marcador: a conferência mostra a lista que ela
     * recebeu, na ordem em que a recebeu — pular para o cartão 4 porque
     * o ESTUDO parou lá abriria outro cartão sem avisar, que é o mesmo
     * defeito que "ampliar" já teve indexando na pilha errada. */
    ok(api.mcEstIdxAtual() === 0,
       "P4 a conferencia abriu no marcador do estudo: " + api.mcEstIdxAtual());
    api.mcEstAndar(1);
    ok(api.mcPareiDe(ch, 5) === 3,
       "P4b a conferencia mexeu no marcador do estudo: "
       + api.mcPareiDe(ch, 5));
  }

  /* ---- P5: pedir um cartão específico vence o marcador ---- */
  {
    const { api } = rodar();
    const ch = montar(api, 5);
    api.mcPareiGuardar(ch, 3, 5);
    api.$("dlgMcEstudo").close();
    api.mcEstudarAbrir(1);
    /* QUEM PEDE O CARTÃO 2 QUER O CARTÃO 2. Sobrepor o pedido com o
     * marcador abriria outro cartão sem avisar — o mesmo defeito que
     * "ampliar" já teve, quando indexava na pilha errada. */
    ok(api.mcEstIdxAtual() === 1,
       "P5 o marcador atropelou o cartao pedido: " + api.mcEstIdxAtual());
  }

  /* ---- P6: o marcador entra no backup ---- */
  {
    const { api } = rodar();
    const chaves = [].concat.apply([],
      Object.keys(api.BK_CHAVES).map((g) => api.BK_CHAVES[g]));
    ok(chaves.indexOf("eac_mc_parei") >= 0,
       "P6 onde parei nos cartoes ficou de fora do backup");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
