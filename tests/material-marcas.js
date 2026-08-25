/* =====================================================================
 * MARCA-TEXTO: seleção, rascunho e o fechar que pergunta (v8.69)
 *
 * Três defeitos relatados na mesma tela, e os três com a mesma raiz: o app
 * decidia sozinho. Decidia que a seleção tinha sumido, decidia gravar a
 * marca, decidia fechar sem perguntar.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const { rodar } = require("./fumaca.js");

async function testes() {
  const { falhas: carga, api } = rodar();
  const falhas = [...carga];
  if (!api) return falhas;
  /* conta quantas perguntas foram feitas: o número no rodapé estava fixo em
   * "254" e não se mexia quando eu acrescentava verificações — um número
   * que mente é pior do que nenhum. */
  let quantas = 0;
  const ok = (cond, msg) => { quantas++; if (!cond) falhas.push(msg); };

  const CHAVE = "financeiro›receita m";
  const TXT = "Receita publica e o ingresso definitivo de recursos nos cofres.";
  api.matGravar(CHAVE, TXT, { disciplina: "Financeiro", topico: "Receita M" });
  api.matAbrirEditor({ disciplina: "Financeiro", nome: "Receita M" }, true);
  const gravado = () => (api.matObter(CHAVE) || {}).texto || "";

  /* M1 — a selecao guardada sobrevive ao clique.
   * mousedown no botao recolhe a selecao ANTES do onclick. Se o app so
   * lesse getSelection() na hora do clique, veria vazio e responderia
   * "selecione pelo menos tres caracteres" para quem tinha selecionado uma
   * frase inteira — que foi exatamente a queixa. */
  api.matPorSelecao("ingresso definitivo");
  api.matMarcarSelecao("destaque");
  ok(/==ingresso definitivo==/.test(api.$("matTexto").value),
     "M1 a marcacao se perdeu: o clique apagou a selecao antes de ser lida");

  /* M2 — marcar NAO grava. Grifar e experimentar: marca, olha, desfaz.
   * Gravar a cada clique tira a chance de desistir, e faz o botao
   * "salvar estado" nao significar nada. */
  ok(!/==ingresso/.test(gravado()),
     "M2 marcar gravou direto no material — nao da para desistir do grifo");
  ok(api.matEstaSujo(), "M3 marcar devia deixar o material como nao salvo");

  /* M4 — "salvar estado" e o unico caminho ate o disco */
  api.matSalvarEstado();
  ok(/==ingresso definitivo==/.test(gravado()),
     "M4 'salvar estado' nao gravou a marcacao");
  ok(!api.matEstaSujo(), "M5 depois de salvar continua constando como nao salvo");

  /* M6/M7/M8 — fechar com pendencia oferece TRES saidas (v8.79).
   * Antes eram duas, e "nao" significava perder o trabalho: quem clicava
   * fechar por engano no meio de uma leitura marcada nao tinha volta. */
  api.matPorSelecao("cofres");
  api.matMarcarSelecao("duvida");
  ok(api.matEstaSujo(), "M6 a segunda marcacao nao entrou como pendente");
  const antes = gravado();

  /* "continuar aqui" NAO fecha e NAO perde nada */
  const ficando = api.matFechar();
  api.uiModalResponder("cancelar");
  await ficando;
  ok(api.matEstaSujo(), "M6b 'continuar aqui' descartou a marcacao pendente");
  ok(api.$("dlgMaterial").open, "M6c 'continuar aqui' fechou a tela assim mesmo");

  /* Esc e clique fora resolvem como false: o padrao seguro e FICAR, porque
   * sair sem salvar e o unico caminho que perde trabalho */
  const escapando = api.matFechar();
  api.uiModalResponder(false);
  await escapando;
  ok(api.matEstaSujo(), "M6d Esc no aviso de saida descartou a marcacao");

  const fechando = api.matFechar();
  api.uiModalResponder("sair");
  await fechando;
  ok(gravado() === antes, "M7 'sair sem salvar' gravou assim mesmo");
  ok(!api.matEstaSujo(), "M8 a pendencia sobreviveu ao fechar");

  /* M9 — e "salvar e sair" grava */
  api.matAbrirEditor({ disciplina: "Financeiro", nome: "Receita M" }, true);
  api.matPorSelecao("recursos");
  api.matMarcarSelecao("importante");
  const f2 = api.matFechar();
  api.uiModalResponder("salvar");
  await f2;
  ok(/==!recursos==/.test(gravado()),
     "M9 'salvar e sair' nao gravou a marcacao");

  /* M10 — sem pendencia, fechar nao pergunta nada (senao vira estorvo) */
  api.matAbrirEditor({ disciplina: "Financeiro", nome: "Receita M" }, true);
  let perguntou = false;
  const antesResp = api.uiModalResponder;
  const f3 = api.matFechar();
  const t0 = Date.now();
  await Promise.race([f3, new Promise((r) => setTimeout(r, 50))]);
  ok(!api.matEstaSujo(), "M10 abrir de novo trouxe pendencia do material anterior");

  /* M11 — abrir outro material zera o rascunho: pendencia e de quem a fez */
  api.matGravar("financeiro›despesa m", "Despesa publica.",
    { disciplina: "Financeiro", topico: "Despesa M" });
  api.matAbrirEditor({ disciplina: "Financeiro", nome: "Receita M" }, true);
  api.matPorSelecao("definitivo");
  api.matMarcarSelecao("destaque");
  api.matAbrirEditor({ disciplina: "Financeiro", nome: "Despesa M" }, true);
  ok(!api.matEstaSujo(),
     "M11 a pendencia de um material vazou para o material seguinte");

  /* ---- M12: o que se VÊ não é o que está guardado ----
   * A leitura mostra "créditos suplementares"; o arquivo guarda
   * "**créditos suplementares**". Qualquer selecao que atravesse um
   * marcador NAO EXISTE no texto-fonte, e o indexOf falhava — o app entao
   * respondia "nao encontrei esse trecho, salve antes de marcar", culpando
   * a pessoa por um defeito dele. Grifar frase inteira, que e o uso normal,
   * quase sempre atravessa um negrito. */
  const FONTE = "1. Autorizacao para abertura de **creditos suplementares**.\n"
    + "2. Contratacao de **operacoes de credito**, inclusive por ARO.";
  const casos = [
    ["abertura de creditos suplementares", "M12 selecao que atravessa um negrito"],
    ["operacoes de credito, inclusive por ARO", "M13 selecao que comeca dentro do negrito"],
    ["Autorizacao para abertura", "M14 selecao de texto simples"],
    ["creditos suplementares", "M15 selecao exatamente igual ao negrito"],
  ];
  for (const [sel, nome] of casos) {
    api.matGravar("d›bold", FONTE, { disciplina: "D", topico: "Bold" });
    api.matAbrirEditor({ disciplina: "D", nome: "Bold" }, true);
    api.matPorSelecao(sel);
    api.matMarcarSelecao("destaque");
    const v = api.$("matTexto").value;
    ok(/==/.test(v), nome + " nao marcou nada");
    /* e a marca nao pode partir o negrito ao meio: "==a de **b==" deixa o
     * negrito aberto e estraga a leitura de TODO o resto do resumo.
     * A conta tem de ser DENTRO da marca: o documento inteiro continua com
     * numero par de "**" mesmo quando a marca corta um par ao meio — foi
     * assim que este teste passou com o equilibrio desligado. */
    const dentro = (v.match(/==[!?]?((?:[^=]|=(?!=))*)==/) || [, ""])[1];
    ok(((dentro.match(/\*\*/g) || []).length % 2) === 0,
       nome + " partiu o negrito ao meio dentro da marca: " + JSON.stringify(dentro));
  }

  /* M16 — seleção que não existe mesmo continua sendo recusada: sem isto o
   * conserto viraria "marca em qualquer lugar" */
  /* fecha antes: reabrir o MESMO tópico agora preserva o que não foi salvo
   * (senão "abrir onde está" descartaria as marcas do usuário em silêncio),
   * então uma abertura limpa exige fechar de verdade, como o app faz. */
  api.$("dlgMaterial").close();
  api.matGravar("d›bold", FONTE, { disciplina: "D", topico: "Bold" });
  api.matAbrirEditor({ disciplina: "D", nome: "Bold" }, true);
  const antesM16 = (api.$("matTexto").value.match(/==/g) || []).length;
  api.matPorSelecao("isto nao esta no texto de jeito nenhum");
  api.matMarcarSelecao("destaque");
  ok(!/==/.test(api.$("matTexto").value),
     "M16 marcou um trecho que nao existe no material");
  /* e, independente do estado anterior: nenhuma marca NOVA apareceu */
  ok((api.$("matTexto").value.match(/==/g) || []).length === antesM16,
     "M16b seleção inexistente acrescentou marca ao texto");

  /* ---- M17: TODAS as transformações da leitura ----
   * A leitura nao mostra o texto-fonte: ela come "## " de titulo, "- " e
   * "* " de lista, os "**" do negrito, os "_" do italico, e apaga "---"
   * inteiro. Cada um desses e um jeito de a selecao nao existir na fonte,
   * com o app respondendo "nao encontrei esse trecho" e culpando a pessoa.
   * A primeira correcao cobriu so "**", "==" e "__" — e o defeito continuou
   * acontecendo. */
  const DOC = ["## Instrumentos de Planejamento", "",
    "- **PPA, LDO e LOA**: sao leis de iniciativa _privativa_ do Executivo.",
    "* Plano Plurianual: estabelece diretrizes e metas.", "", "---", "",
    "#### 2. Processo Legislativo (Art. 166)",
    "1. Autorizacao para abertura de **creditos suplementares**.",
    "2. Contratacao de **operacoes de credito**, inclusive por ARO."].join("\n");

  [["PPA, LDO e LOA: sao leis de iniciativa privativa do Executivo", "M17 lista + negrito + italico"],
   ["Plano Plurianual: estabelece diretrizes", "M18 marcador de lista com *"],
   ["Instrumentos de Planejamento", "M19 titulo com ##"],
   ["abertura de creditos suplementares", "M20 atravessa negrito"],
   ["operacoes de credito, inclusive por ARO", "M21 comeca dentro do negrito"],
   ["leis de iniciativa privativa", "M22 termina dentro do italico"],
   ["de iniciativa privativa do Executivo", "M23 atravessa o italico inteiro"],
  ].forEach(([sel, nome]) => {
    api.matGravar("d›doc", DOC, { disciplina: "D", topico: "Doc" });
    api.matAbrirEditor({ disciplina: "D", nome: "Doc" }, true);
    api.matPorSelecao(sel);
    api.matMarcarSelecao("destaque");
    const v = api.$("matTexto").value;
    const m = v.match(/==(?:[^=]|=(?!=))*==/);
    ok(!!m, nome + " nao marcou nada");
    const dentro = m ? m[0].slice(2, -2) : "";
    /* nenhum par de marcadores pode ficar partido ao meio: negrito ou
     * italico aberto e nunca fechado estraga a leitura de TODO o resto */
    ok(((dentro.match(/\*\*/g) || []).length % 2) === 0,
       nome + " partiu o negrito: " + JSON.stringify(dentro.slice(0, 70)));
    ok(((dentro.match(/_/g) || []).length % 2) === 0,
       nome + " partiu o italico: " + JSON.stringify(dentro.slice(0, 70)));
  });

  /* ---- M28: títulos de 1 a 6 "#" ----
   * O leitor entendia só "#" e "##". Os resumos do NotebookLM usam "###" e
   * "####" o tempo todo, e eles apareciam LITERAIS na tela — com os quatro
   * jogos da velha à vista. Foi um teste de marcação que revelou isso. */
  [["# Um", "h3"], ["## Dois", "h4"], ["### Tres", "h4"],
   ["#### Quatro", "h4"], ["###### Seis", "h4"]].forEach(([src, tag]) => {
    const h = api.matParaHtml(src);
    ok(h.indexOf("<" + tag + ">") === 0,
       `M28 "${src}" devia virar <${tag}>, veio ${JSON.stringify(h.slice(0, 30))}`);
    ok(h.indexOf("#") < 0,
       `M28b "${src}" deixou o marcador visível: ${JSON.stringify(h.slice(0, 30))}`);
  });
  /* e sem espaço não é título: "####sem espaco" é texto */
  ok(/^<p>/.test(api.matParaHtml("####sem espaco")),
     "M28c '####sem espaco' virou título — sem espaço não é marcador");

  /* ---- M29: a normalização e o mapa concordam ----
   * Se um tira o prefixo e o outro não, a busca procura uma coisa e o mapa
   * aponta para outra — e o resultado é marca no lugar errado, que é pior
   * que recusa. */
  {
    const src = "## Titulo\n- item de lista\n* outro item";
    const mp = api.matMapear(src);
    ok(mp.plano.indexOf("#") < 0 && mp.plano.indexOf("- ") < 0,
       "M29 o texto plano ainda tem marcador: " + JSON.stringify(mp.plano));
    ok(api.matNormalizar(src) === mp.plano.replace(/\s+/g, " ").trim(),
       "M29b a normalização e o mapa discordam:\n  norm: "
       + JSON.stringify(api.matNormalizar(src)) + "\n  mapa: "
       + JSON.stringify(mp.plano.replace(/\s+/g, " ").trim()));
  }

  /* ---- M25: seleção ATRAVESSANDO linhas ----
   * Aqui os prefixos passam a importar de verdade. Numa linha só, o mapa
   * degrada bem: caractere sobrando antes do trecho não desloca nada,
   * porque cada caractere carrega o próprio índice. Mas quem seleciona de
   * um item de lista até o seguinte tem, na fonte, um "\n* " no meio — e
   * na leitura, só um espaço. Se o mapa não comer o marcador, o trecho
   * deixa de existir e volta o "não encontrei esse trecho". */
  [["Executivo. Plano Plurianual: estabelece", "M25 selecao entre dois itens de lista"],
   ["metas. 2. Processo Legislativo", "M26 selecao atravessando a linha divisoria"],
   ["Planejamento PPA, LDO e LOA", "M27 selecao do titulo ate o primeiro item"],
  ].forEach(([sel, nome]) => {
    api.matGravar("d›doc", DOC, { disciplina: "D", topico: "Doc" });
    api.matAbrirEditor({ disciplina: "D", nome: "Doc" }, true);
    api.matPorSelecao(sel);
    api.matMarcarSelecao("destaque");
    ok(/==/.test(api.$("matTexto").value), nome + " nao marcou nada");
  });

  /* ---- M24: recusar tem de deixar rastro no REGISTRO ----
   * Enquanto a recusa era so um uiAlert, o defeito acontecia repetidas
   * vezes na tela e o log nao tinha uma linha sobre isso. Consertei no
   * escuro por causa disso, e consertei errado uma vez. */
  {
    api.matGravar("d›doc", DOC, { disciplina: "D", topico: "Doc" });
    api.matAbrirEditor({ disciplina: "D", nome: "Doc" }, true);
    const antes = api.registroTexto().split("\n").length;
    api.matPorSelecao("isto nao esta em lugar nenhum do texto");
    api.matMarcarSelecao("destaque");
    const novas = api.registroTexto().split("\n").slice(antes).join("\n");
    ok(/MATERIAL-MARCA/.test(novas),
       "M24 a recusa de marcacao nao gerou registro nenhum");
    ok(/nao_achou/.test(novas),
       "M24b o registro nao diz POR QUE a marcacao foi recusada");
    ok(/isto nao esta/.test(novas),
       "M24c o registro nao guarda o trecho que a pessoa tentou marcar");
  }

  /* ---- M30: marca GRANDE e com "=" dentro ----
   * O leitor limitava o miolo a 300 caracteres e proibia "=". Um trecho
   * grande marcado aparecia com os "==" literais na tela, como se a marca
   * nao tivesse pegado — foi o que aconteceu com um bloco de 368
   * caracteres sobre o mnemonico ROSERA. */
  {
    const longo = "==!" + "palavra ".repeat(45) + "fim==";
    ok(longo.length > 340, "M30-pre o caso de teste precisa passar de 340 chars");
    /* checar a CLASSE, nao so que existe <mark>: com o limite de 300 no
     * "==!", o bloco longo caia na regra generica "==...==" e virava um
     * <mark> comum com o "!" dentro do texto — o teste passava e a cor
     * estava errada. */
    ok(/m-imp/.test(api.matParaHtml(longo)),
       `M30 marca de ${longo.length} caracteres perdeu a cor: `
       + api.matParaHtml(longo).slice(0, 60));
    ok(/m-imp/.test(api.matParaHtml("==!Art. 5 = base==")),
       "M30b marca com '=' no meio do texto perdeu a cor: "
       + api.matParaHtml("==!Art. 5 = base=="));
    ok(!/>!/.test(api.matParaHtml(longo)),
       "M30b2 o sufixo da cor vazou para dentro do texto marcado");
    /* mas "==" continua sendo o fecho: nao pode engolir o resto do texto */
    const dois = api.matParaHtml("==um== e ==dois==");
    ok((dois.match(/<mark/g) || []).length === 2,
       `M30c duas marcas na mesma linha viraram ${(dois.match(/<mark/g) || []).length}`);
  }

  /* ---- M31: as cores novas ---- */
  {
    [["==§Art. 43==", "m-lei"], ["==*Caiu em 2024==", "m-prova"],
     ["==~Cuidado==", "m-peg"], ["==!Importante==", "m-imp"],
     ["==?Duvida==", "m-duv"]].forEach(([src, cls]) => {
      const h = api.matParaHtml(src);
      ok(h.indexOf(cls) >= 0, `M31 ${src} nao virou ${cls}: ${h.slice(0, 40)}`);
    });
    /* o destaque simples continua sem classe extra */
    /* o destaque tambem se identifica: e por "data-marca" que o clique na
     * marca sabe de que cor ela e. Exigir "<mark>" exato amarrava o teste
     * a nao existir atributo nenhum, que e detalhe de escrita, nao regra. */
    const hSimples = api.matParaHtml("==simples==");
    ok(/<mark[^>]*>simples<\/mark>/.test(hSimples),
       "M31b o destaque simples perdeu a marca: " + hSimples.slice(0, 60));
    ok(/data-marca="destaque"/.test(hSimples),
       "M31c o destaque nao diz de que tipo e — clicar nele nao teria o que ler");
  }

  /* ---- M32: tirar UMA marca ----
   * Existia so "limpar marcas", que apaga todas: quem errou uma cor tinha
   * de refazer a leitura inteira. */
  {
    const DOC = "Primeiro trecho aqui.\nSegundo trecho ali.\nTerceiro trecho la.";
    api.matGravar("d›tirar", DOC, { disciplina: "D", topico: "Tirar" });
    api.matAbrirEditor({ disciplina: "D", nome: "Tirar" }, true);
    api.matPorSelecao("Primeiro trecho");
    api.matMarcarSelecao("destaque");
    api.matPorSelecao("Terceiro trecho");
    api.matMarcarSelecao("duvida");
    const comDuas = api.$("matTexto").value;
    ok((comDuas.match(/==/g) || []).length === 4,
       `M32-pre esperava 2 marcas, o texto tem ${(comDuas.match(/==/g) || []).length / 2}`);

    /* tira a SEGUNDA, nao a primeira: se a funcao pegasse sempre a primeira
     * marca do texto, um teste que remove a primeira passaria de qualquer
     * jeito e nao verificaria nada. */
    api.matPorSelecao("Terceiro trecho");
    api.matTirarMarca();
    const v = api.$("matTexto").value;
    ok((v.match(/==/g) || []).length === 2,
       `M32 tirar uma marca mexeu nas outras: ${JSON.stringify(v)}`);
    ok(/==Primeiro trecho==/.test(v),
       `M32b tirar a segunda marca levou junto a primeira: ${JSON.stringify(v)}`);
    ok(!/==\?/.test(v),
       `M32c a marca do terceiro trecho nao saiu: ${JSON.stringify(v)}`);
    /* e o TEXTO nao pode ter sido perdido */
    /* o conteudo continua todo la — inclusive o texto FORA das marcas.
     * A primeira versao desta assercao procurava a frase inteira sem as
     * marcas no meio e acusava perda onde nao havia. */
    ok(/Terceiro trecho/.test(v) && /la\./.test(v) && /Segundo trecho ali/.test(v),
       "M32d o conteudo se perdeu ao tirar a marca: " + JSON.stringify(v));
  }

  /* ---- M33: marcador de pagina ----
   * Resumo de vinte telas sem marcador vira "onde eu estava?" toda vez. */
  {
    const DOC = ["Linha um do resumo.", "Linha dois.", "Linha tres.",
                 "Linha quatro.", "Linha cinco."].join("\n");
    api.matGravar("d›marc", DOC, { disciplina: "D", topico: "Marc" });
    api.matAbrirEditor({ disciplina: "D", nome: "Marc" }, false);
    const ta = api.$("matTexto");
    ta.selectionStart = ta.selectionEnd = DOC.indexOf("Linha tres");
    api.matPorMarcador();

    const r = api.matResumosAtual()["d›marc"];
    ok(r && typeof r.marcador === "number" && r.marcador > 0,
       `M33 o marcador nao foi guardado: ${JSON.stringify(r && r.marcador)}`);
    /* posicao no TEXTO, nao pixel: mudar a fonte ou marcar um trecho nao
     * pode deslocar o lugar guardado */
    const html = api.matParaHtml(DOC);
    ok(/mat-marcador/.test(html),
       "M33b o marcador nao aparece na leitura");
    /* e ele fica DEPOIS da linha onde caiu, nunca cortando a linha ao meio */
    ok(html.indexOf("Linha tres") < html.indexOf("mat-marcador"),
       "M33c o marcador cortou a linha ao meio em vez de ficar depois dela");
    ok(api.$("btnMatIrMarcador").hidden === false,
       "M33d o atalho para voltar ao marcador nao apareceu");
  }

  /* ---- M34: UMA chave por topico, nao duas ----
   * cmChave() normalizava agressivamente (sem acento, sem pontuacao) e
   * matChave() so passa para minusculas. "Lei Federal nº 4.320/1964" virava
   * "lei federal n 4 320 1964" de um lado e "lei federal nº 4.320/1964" do
   * outro: todo topico com acento ou pontuacao ganhava DUAS gavetas, e os
   * cartoes gravados iam para a que a agenda e o editor nunca abrem. Foi
   * por isso que o icone do resumo nao acendia. */
  {
    const CM = new Function("matResumos", "t", "matChave",
      fs.readFileSync(path.join(RAIZ, "docs", "cartoes-material.js"), "utf8")
      + "; return { cmChave, cmChaveGeral };")({}, () => "", api.matChave);
    [["Direito Financeiro", "Lei Federal nº 4.320/1964"],
     ["Controle Externo", "Lei Orgânica do TCE/PE"],
     ["Língua Portuguesa", "Semântica: sentido e emprego"],
     ["Direito Financeiro", "Restos a pagar"]].forEach(([d, tp]) => {
      ok(api.matChave(d, tp) === CM.cmChave(d, tp),
         `M34 chaves divergem para "${tp}":\n  material: ${api.matChave(d, tp)}`
         + `\n  cartoes : ${CM.cmChave(d, tp)}`);
    });
  }

  /* ---- M35: conserto das chaves orfas ja gravadas ----
   * Quem ja salvou cartoes antes da v8.79 tem gavetas invisiveis. Como cada
   * registro guarda disciplina e topico, da para recalcular a chave certa
   * e juntar — sem perder nada dos dois lados. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    /* uma gaveta orfa (chave antiga) e uma certa, do mesmo topico */
    /* o orfao tem texto PROPRIO: com texto vazio, sobrescrever ou nao dava
     * no mesmo e o teste nao distinguia as duas coisas */
    mat["direito financeiro›lei federal n 4 320 1964"] = {
      texto: "Texto que veio junto do cartao", cartoes: "P orfa :: R orfa :: tag",
      disciplina: "Direito Financeiro", topico: "Lei Federal nº 4.320/1964" };
    mat[api.matChave("Direito Financeiro", "Lei Federal nº 4.320/1964")] = {
      texto: "Resumo que eu escrevi", cartoes: "P certa :: R certa :: tag",
      disciplina: "Direito Financeiro", topico: "Lei Federal nº 4.320/1964" };

    const r = api.matRepararChaves();
    ok(r.juntados === 1, `M35 esperava 1 gaveta juntada, veio ${r.juntados}`);
    ok(!mat["direito financeiro›lei federal n 4 320 1964"],
       "M35b a gaveta orfa continuou existindo");
    const certa = mat[api.matChave("Direito Financeiro", "Lei Federal nº 4.320/1964")];
    ok(certa && certa.texto === "Resumo que eu escrevi",
       "M35c o conserto sobrescreveu o resumo escrito a mao");
    ok(certa && /P orfa/.test(certa.cartoes) && /P certa/.test(certa.cartoes),
       `M35d o conserto perdeu cartoes de um dos lados: ${certa && certa.cartoes}`);

    /* e rodar de novo nao pode mexer em nada */
    const r2 = api.matRepararChaves();
    ok(r2.movidos === 0 && r2.juntados === 0,
       `M35e o conserto mexeu de novo em material ja correto: ${JSON.stringify(r2)}`);
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M36: cartoes do topico SEM fechar o resumo ----
   * O botao antigo fechava o material, trocava o app de modo e abria o
   * gerador: quem estava no meio de uma leitura marcada perdia o lugar. */
  {
    api.matIniciar();
    const chC = api.matChave("Direito Financeiro", "Restos a pagar");
    api.matGravar(chC, "Restos a pagar sao despesas empenhadas e nao pagas.",
      { disciplina: "Direito Financeiro", topico: "Restos a pagar",
        concurso: "TCE-PE Auditor" });
    api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Restos a pagar" }, true);
    api.matCartoesAbrir();
    ok(api.$("dlgMaterial").open, "M36 abrir os cartoes fechou o resumo");
    ok(api.$("dlgMatCartoes").open, "M36b o painel de cartoes nao abriu");

    /* as ETIQUETAS sao o que permite achar o cartao depois. Sem elas, o
     * cartao vira orfao — foi o que custou a v8.79 inteira. */
    const tags = api.matEtiquetasTopico("Direito Financeiro", "Restos a pagar", "TCE-PE Auditor");
    ok(tags.some((x) => /^disc_/.test(x)), "M36c falta a etiqueta da disciplina");
    ok(tags.some((x) => /^top_/.test(x)), "M36d falta a etiqueta do topico");
    ok(tags.some((x) => /^concurso_/.test(x)), "M36e falta a etiqueta do concurso");
    ok(tags.every((x) => x.indexOf("::") < 0),
       "M36f etiqueta com '::' quebra o formato do material: " + tags.join(" "));

    api.$("mcTexto").value = "O que sao restos a pagar? :: Despesas empenhadas\n"
      + "Ate quando se empenha? :: 31 de dezembro";
    api.matCartoesConferir();
    const salvando = api.matCartoesSalvar();
    api.uiModalResponder(true);
    await new Promise((r) => setImmediate(r));
    api.uiModalResponder(true);
    await salvando;

    ok(api.$("dlgMaterial").open, "M36g salvar os cartoes fechou o resumo");
    ok(api.matContarCartoes(chC) === 2,
       `M36h esperava 2 cartoes no topico, veio ${api.matContarCartoes(chC)}`);

    const rC = api.matResumosAtual()[chC];
    ok(/top_Restos_a_pagar/.test(rC.cartoes),
       `M36i o cartao salvo nao tem a etiqueta do topico: ${rC.cartoes}`);
    /* PROCEDENCIA: sem isto nao da para responder, meses depois, de qual
     * resumo saiu o cartao e quando */
    ok(rC.cartoesInfo && rC.cartoesInfo.length === 1 && rC.cartoesInfo[0].n === 2,
       `M36j a procedencia do lote nao foi registrada: ${JSON.stringify(rC.cartoesInfo)}`);
    ok(rC.cartoesInfo[0].origem === "resumo" && rC.cartoesInfo[0].quando,
       "M36k a procedencia nao diz de onde nem quando");

    /* IDA E VOLTA: o cartao tem de voltar inteiro pelo leitor do app */
    const P = new Function("t", "UI", "pm",
      fs.readFileSync(path.join(RAIZ, "docs", "parser.js"), "utf8") + "; return { parseText };")(
      (k) => k, { pt: {}, en: {} }, (k, p) => k + " " + JSON.stringify(p || {}));
    const lido = P.parseText(rC.cartoes);
    ok(lido.cards.length === 2,
       `M36l gravei 2 e o leitor do app achou ${lido.cards.length}`);
    ok(lido.cards[0].tags.some((x) => /top_Restos_a_pagar/.test(x)),
       `M36m a etiqueta do topico se perdeu na volta: ${JSON.stringify(lido.cards[0].tags)}`);

    /* salvar de novo nao duplica */
    api.$("mcTexto").value = "O que sao restos a pagar? :: Despesas empenhadas";
    const r2 = api.matCartoesConferir();
    ok(r2.repetidos === 1, `M36n o repetido nao foi reconhecido (${r2.repetidos})`);
    const denovo = api.matCartoesSalvar();
    api.uiModalResponder(true);
    await new Promise((r) => setImmediate(r));
    api.uiModalResponder(true);
    await denovo;
    ok(api.matContarCartoes(chC) === 2,
       `M36o salvar o repetido duplicou: ${api.matContarCartoes(chC)} cartoes`);

    /* M36p — a procedencia ACUMULA. Com um lote so, sobrescrever e acumular
     * dao no mesmo, e a primeira versao deste teste nao distinguia os dois.
     * Um segundo lote, com cartao novo, separa as duas coisas. */
    api.$("mcTexto").value = "Quem inscreve os restos? :: O ordenador de despesa";
    const lote2 = api.matCartoesSalvar();
    api.uiModalResponder(true);
    await new Promise((r) => setImmediate(r));
    api.uiModalResponder(true);
    await lote2;
    const rC2 = api.matResumosAtual()[chC];
    ok(rC2.cartoesInfo && rC2.cartoesInfo.length === 2,
       `M36p a procedencia do 1o lote foi perdida: ${JSON.stringify(rC2.cartoesInfo)}`);
    ok(rC2.cartoesInfo[0].n === 2 && rC2.cartoesInfo[1].n === 1,
       "M36q os lotes registrados nao batem com o que foi gravado");
    ok(api.matContarCartoes(chC) === 3,
       `M36r o segundo lote nao foi somado: ${api.matContarCartoes(chC)}`);

    api.$("dlgMatCartoes").close();
  }

  /* ---- M37: o marcador segue a LEITURA, nao o cursor escondido ----
   * Em modo leitura o textarea esta escondido e o cursor fica onde o
   * navegador deixou — ao atribuir .value o Chrome poe no FIM, e o marcador
   * ia sempre para a ultima linha. */
  {
    const DOC = Array.from({ length: 40 },
      (_, k) => "Linha " + (k + 1) + " do resumo com algum texto.").join("\n");
    api.matGravar("d›marc2", DOC, { disciplina: "D", topico: "Marc2" });
    api.matAbrirEditor({ disciplina: "D", nome: "Marc2" }, true);
    api.matTrocarModo("ler");
    const pane = api.$("matLeitura");
    pane.scrollHeight = 1000; pane.clientHeight = 200; pane.scrollTop = 320;
    /* o cursor do textarea no FIM: exatamente o estado que causava o bug */
    api.$("matTexto").selectionStart = DOC.length;
    api.matPorMarcador();
    const r = api.matResumosAtual()["d›marc2"];
    const pct = Math.round((r.marcador / DOC.length) * 100);
    ok(pct > 25 && pct < 55,
       `M37 marcador em ${pct}% quando a leitura estava em 40% — nao acompanhou`);
    ok(r.marcador < DOC.length - 10,
       "M37b o marcador foi para o fim do texto: voltou o bug do cursor escondido");

    pane.scrollTop = 0;
    api.matPorMarcador();
    ok(api.matResumosAtual()["d›marc2"].marcador < 50,
       "M37c leitura no topo devia pôr o marcador no comeco");

    /* em modo EDICAO o cursor volta a mandar, que e o certo ali */
    api.matTrocarModo("editar");
    api.$("matTexto").selectionStart = 200;
    api.matPorMarcador();
    ok(api.matResumosAtual()["d›marc2"].marcador === 200,
       "M37d editando, o marcador devia seguir o cursor");
  }

  /* ---- M38: palavra REPETIDA, uma já marcada ----
   * Selecionar "transparência" numa linha quando a MESMA palavra já estava
   * marcada mais acima fazia o app olhar a ocorrência de cima, ver o "==" e
   * responder "já marcado" — recusando um trecho que estava livre. */
  {
    const DOC = ["- A ==transparencia== e o meio.",
                 "- A transparencia fiscal aparece na LRF."].join("\n");
    const ch = api.matChave("Direito Financeiro", "Principios");
    api.matGravar(ch, DOC, { disciplina: "Direito Financeiro", topico: "Principios" });
    api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Principios" }, true);

    api.matPorSelecao("transparencia");
    api.matMarcarSelecao("destaque");
    const v = api.$("matTexto").value;
    ok((v.match(/==/g) || []).length === 4,
       `M38 devia haver 2 marcas, o texto tem ${(v.match(/==/g) || []).length / 2}: ${v}`);
    ok(/A ==transparencia== fiscal/.test(v),
       `M38b marcou a ocorrencia errada: ${JSON.stringify(v)}`);
    ok(!/====/.test(v),
       `M38c marcou POR CIMA da marca que ja existia: ${JSON.stringify(v)}`);

    /* e quando NENHUMA esta livre, aí sim recusa */
    api.matPorSelecao("transparencia");
    api.matMarcarSelecao("destaque");
    ok(api.$("matTexto").value === v,
       "M38d com todas as ocorrencias marcadas, o texto mudou assim mesmo");
    const ultimo = api.matLogAtual()[api.matLogAtual().length - 1];
    ok(ultimo && /ja_marcado/.test(ultimo.o),
       `M38e a recusa devia ser 'ja_marcado': ${ultimo && ultimo.o}`);
  }

  /* ---- M39: o registro PRÓPRIO dos resumos ----
   * O registro geral mistura edital, cartões e backup; achar por que uma
   * marcação falhou virava garimpo. Consertei a marcação no escuro três
   * vezes por falta disto. */
  {
    api.matLogCarregar();
    const antes = api.matLogAtual().length;
    const ch = api.matChave("Direito Financeiro", "Log");
    api.matGravar(ch, "Um texto qualquer para marcar aqui dentro.",
      { disciplina: "Direito Financeiro", topico: "Log" });
    api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Log" }, true);
    api.matPorSelecao("texto qualquer");
    api.matMarcarSelecao("importante");
    api.matPorSelecao("isto nao existe no resumo");
    api.matMarcarSelecao("duvida");

    const log = api.matLogAtual();
    ok(log.length >= antes + 2, "M39 os eventos do resumo nao entraram no registro proprio");
    const meus = log.slice(antes);
    ok(meus.every((x) => x.top === "Log" && x.disc === "Direito Financeiro"),
       "M39b o registro nao guarda de qual topico foi cada evento");
    ok(meus.some((x) => /marcado \(importante\)/.test(x.o)),
       "M39c a marcacao bem-sucedida nao foi registrada");
    ok(meus.some((x) => /recusada: nao_achou/.test(x.o)),
       "M39d a recusa nao foi registrada");
    ok(meus.some((x) => /isto nao existe/.test(x.d)),
       "M39e o registro nao guarda o trecho que a pessoa tentou marcar");

    const txt = api.matLogTexto();
    ok(/REGISTRO DOS RESUMOS|SUMMARY LOG/.test(txt) && /Log/.test(txt),
       "M39f o texto do registro saiu sem cabecalho ou sem o topico");

    /* apagar limpa de verdade */
    api.matLogLimpar();
    ok(api.matLogAtual().length === 0, "M39g apagar o registro nao apagou nada");
  }

  /* ---- M40: fechar pelo topo faz a MESMA coisa que fechar embaixo ---- */
  {
    ok(typeof api.$("btnMatFecharTopo").onclick === "function",
       "M40 o botao de fechar do topo nao esta ligado a nada");
    ok(typeof api.$("btnMatLog").onclick === "function",
       "M40b o botao do registro nao esta ligado a nada");

    const ch = api.matChave("D", "FecharTopo");
    api.matGravar(ch, "Texto para marcar e sair sem salvar.",
      { disciplina: "D", topico: "FecharTopo" });
    api.matAbrirEditor({ disciplina: "D", nome: "FecharTopo" }, true);
    api.matPorSelecao("para marcar");
    api.matMarcarSelecao("destaque");
    ok(api.matEstaSujo(), "M40c-pre precisa haver marcacao pendente");
    /* o botao do topo tem de fazer a MESMA pergunta de tres saidas */
    const fechando = api.$("btnMatFecharTopo").onclick();
    api.uiModalResponder("cancelar");
    await fechando;
    ok(api.matEstaSujo() && api.$("dlgMaterial").open,
       "M40c fechar pelo topo nao ofereceu 'continuar aqui'");
    const f2 = api.$("btnMatFecharTopo").onclick();
    api.uiModalResponder("salvar");
    await f2;
    ok(/==para marcar==/.test(String(api.matObter(ch).texto || "")),
       "M40d 'salvar e sair' pelo botao do topo nao gravou");
  }

  /* ---- M41: filtro do material — edital primeiro, depois disciplina ----
   * Com dois concursos as disciplinas se repetem ("Direito Financeiro"
   * existe nos dois), e uma lista unica de disciplinas nao diz de qual se
   * trata. Escolhido o edital, a lista encolhe para o que existe nele. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const por = (cc, d, tp, texto, cartoes) => {
      const ch = api.matChave(d, tp);
      api.matGravar(ch, texto, { disciplina: d, topico: tp, concurso: cc });
      if (cartoes) api.matGravarCartoes(ch, cartoes, { disciplina: d, topico: tp, concurso: cc });
      return ch;
    };
    por("TCE-PE", "Direito Financeiro", "Restos a pagar", "Resumo A", "P :: R :: t");
    por("TCE-PE", "Controle Externo", "Lei Organica", "Resumo B", "");
    por("ISS Caruaru", "Direito Financeiro", "Despesa publica", "Resumo C", "");
    api.matRender();

    const opcoes = (id) => (api.$(id).children || []).map((o) => o.value).filter(Boolean);
    ok(opcoes("matListaEditais").length === 2,
       `M41 esperava 2 editais nas sugestoes, veio ${opcoes("matListaEditais").length}`);
    ok(opcoes("matListaDiscs").length === 2,
       `M41b sem edital escolhido, esperava as 2 disciplinas distintas, veio `
       + JSON.stringify(opcoes("matListaDiscs")));

    /* escolhido o edital, as disciplinas encolhem */
    api.matFiltroEditalTeste("ISS");
    ok(opcoes("matListaDiscs").length === 1
       && opcoes("matListaDiscs")[0] === "Direito Financeiro",
       `M41c a lista de disciplinas nao encolheu para o edital: `
       + JSON.stringify(opcoes("matListaDiscs")));
    ok(api.matAgrupado("").size === 1,
       "M41d o filtro de edital nao reduziu a lista de material");

    /* trocar de edital limpa a disciplina — senao o resultado fica vazio e
     * parece "nao tenho material" */
    api.matFiltroDiscTeste("Controle");
    api.matFiltroEditalTeste("TCE");
    ok(api.matFiltroDiscAtual() === "",
       "M41e trocar de edital manteve a disciplina antiga escolhida");
    api.matFiltroEditalTeste("");
  }

  /* ---- M42: marcadores de tipo ----
   * Um topico pode ter resumo, cartoes e lei seca ao mesmo tempo; filtrar
   * por palavra nunca separaria as tres coisas. */
  {
    const lista = api.matListaTeste();
    const comCartoes = lista.filter((x) => api.matTiposDe(x).indexOf("cartoes") >= 0);
    ok(comCartoes.length === 1,
       `M42 esperava 1 material com cartoes, veio ${comCartoes.length}`);
    ok(lista.every((x) => api.matTiposDe(x).indexOf("resumo") >= 0),
       "M42b todos tem texto, entao todos deviam ter o tipo 'resumo'");
    ok(lista.every((x) => api.matTiposDe(x).indexOf("lei") < 0),
       "M42c 'lei seca' apareceu sem ninguem ter marcado");

    /* filtrar por tipo */
    api.matFiltroTiposTeste(["cartoes"]);
    let n = 0;
    api.matAgrupado("").forEach((discs) => discs.forEach((its) => { n += its.length; }));
    ok(n === 1, `M42d o filtro por 'cartoes' devia deixar 1 item, deixou ${n}`);

    /* dois tipos ao mesmo tempo somam exigencias, nao alternativas */
    api.matFiltroTiposTeste(["cartoes", "lei"]);
    let n2 = 0;
    api.matAgrupado("").forEach((discs) => discs.forEach((its) => { n2 += its.length; }));
    ok(n2 === 0,
       `M42e 'cartoes' E 'lei seca' juntos deviam exigir os dois, deixou ${n2}`);
    api.matFiltroTiposTeste([]);
  }

  /* ---- M43: "lei seca" é marca da pessoa, e ela persiste ---- */
  {
    const ch = api.matChave("Direito Financeiro", "Restos a pagar");
    api.matAbrirEditor({ disciplina: "Direito Financeiro", nome: "Restos a pagar" }, false);
    api.matAlternarLei();
    ok(api.matResumosAtual()[ch].leiSeca === true,
       "M43 marcar como lei seca não guardou nada");
    ok(api.matTiposDe(api.matResumosAtual()[ch]).indexOf("lei") >= 0,
       "M43b o tipo 'lei' não apareceu depois de marcar");
    api.matAlternarLei();
    ok(!api.matResumosAtual()[ch].leiSeca,
       "M43c desmarcar lei seca não desmarcou");
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M44: guardar cartoes guarda SÓ os cartoes ----
   * guardarCartoesNoMaterial contava as linhas com "::" para validar e em
   * seguida gravava a CAIXA INTEIRA — prompt junto. Um topico ficou com 155
   * linhas das quais 17 eram cartao; o resto era "Gere flashcards para
   * Anki...". */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("Direito Financeiro", "Lei 4.320");
    const sujo = ["Gere flashcards para Anki a partir do texto abaixo.",
      "REGRAS DE FORMATO (siga exatamente):",
      "1. Uma ideia por cartao.", "",
      "O que e exercicio financeiro? :: Periodo de 12 meses :: fin",
      "Quando comeca? :: 1 de janeiro :: fin",
      "Espero ter ajudado!"].join("\n");
    api.matGravarCartoes(ch, sujo, { disciplina: "Direito Financeiro", topico: "Lei 4.320" });

    const lx = api.matLixoNosCartoes(ch);
    ok(lx.cartoes === 2 && lx.lixo === 4,
       `M44 a conta de lixo errou: ${JSON.stringify(lx)}`);
    /* a tela precisa DIZER isso: antes, um topico com 138 linhas de prompt
     * aparecia como se estivesse tudo bem */
    api.matRender();
    const txt = (el) => {
      let s = "";
      const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
      anda(el); return s;
    };
    const naTela = txt(api.$("matLista"));
    /* a comparacao ignora acentos: a mensagem na tela e "nao sao cartao"
     * com acentos, e a primeira versao deste teste procurava sem eles */
    const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
    ok(/nao sao cartao|not cards/i.test(semAcento(naTela)),
       "M44b a lista nao avisa que o campo de cartoes tem lixo dentro");

    const n = api.matLimparLixoCartoes(ch);
    ok(n === 4, `M44c a limpeza devia tirar 4 linhas, tirou ${n}`);
    ok(api.matContarCartoes(ch) === 2,
       `M44d a limpeza levou cartoes junto: sobraram ${api.matContarCartoes(ch)}`);
    ok(/exercicio financeiro/.test(mat[ch].cartoes),
       "M44e o conteudo dos cartoes se perdeu na limpeza");
    ok(!/Gere flashcards/.test(mat[ch].cartoes),
       "M44f o prompt continuou no campo de cartoes");
    ok(api.matLimparLixoCartoes(ch) === 0,
       "M44g limpar de novo mexeu em material ja limpo");
  }

  /* ---- M45: a lista MOSTRA os cartoes ----
   * matSelosDe existia desde a v8.84 e nunca tinha sido usada: a lista
   * mostrava so o tamanho do resumo, entao um topico com cartoes parecia
   * ter apenas texto — e quem salvou cartoes nao os achava em lugar nenhum. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Com cartoes");
    api.matGravar(ch, "Um resumo qualquer.", { disciplina: "D", topico: "Com cartoes" });
    api.matGravarCartoes(ch, "P :: R :: tag", { disciplina: "D", topico: "Com cartoes" });
    const ch2 = api.matChave("D", "So resumo");
    api.matGravar(ch2, "Outro resumo.", { disciplina: "D", topico: "So resumo" });
    api.matRender();

    const txt = (el) => {
      let s = "";
      const anda = (x) => (x.children || []).forEach((f) => { s += " " + (f._texto || ""); anda(f); });
      anda(el); return s;
    };
    /* contar os SELOS por classe: procurar a palavra "cartões" no texto da
     * linha casava com o botao "ver os 1 cartões" e com a contagem, entao
     * tirar os selos passava despercebido */
    const contaCls = (el, cls) => {
      let n = 0;
      const anda = (x) => (x.children || []).forEach((f) => {
        if ((f.className || "").split(/\s+/).includes(cls)) n++;
        anda(f);
      });
      anda(el); return n;
    };
    ok(contaCls(api.$("matLista"), "selo-cartoes") === 1,
       `M45 o selo de cartoes devia aparecer 1 vez, apareceu `
       + contaCls(api.$("matLista"), "selo-cartoes"));
    ok(contaCls(api.$("matLista"), "selo-resumo") === 2,
       "M45a o selo de resumo devia aparecer nos dois itens");

    /* a CONTAGEM fica na linha de baixo, e e outra coisa: sem ela o item
     * diz que tem cartoes mas nao quantos */
    const subs = [];
    const andaSub = (x) => (x.children || []).forEach((f) => {
      if ((f.className || "").split(/\s+/).includes("mat-sub")) subs.push(f._texto || "");
      andaSub(f);
    });
    andaSub(api.$("matLista"));
    ok(subs.some((s) => /1 cart/i.test(s)),
       "M45b a linha nao diz QUANTOS cartoes o topico tem: " + JSON.stringify(subs));

    /* e existe um caminho ate eles */
    let botao = null;
    const anda = (x) => (x.children || []).forEach((f) => {
      if (/ver os 1 cart|see the 1 card/i.test(f._texto || "")) botao = f;
      anda(f);
    });
    anda(api.$("matLista"));
    ok(!!botao, "M45c nao ha botao para ver os cartoes a partir da lista");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M46: gravar o resumo NÃO pode apagar os cartões ----
   * matGravar montava um registro do zero com seis campos e jogava fora
   * todos os outros — "cartoes", "leiSeca", "marcador", "cartoesInfo".
   * Gravar o resumo APAGAVA os cartões do tópico. E abrir o painel de
   * cartões grava o texto antes: o próprio ato de ir ver os cartões
   * destruía os cartões. Foi por isso que eles "não apareciam em lugar
   * nenhum" — eram apagados no caminho. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Preserva");
    api.matGravar(ch, "Resumo original.", { disciplina: "D", topico: "Preserva" });
    api.matGravarCartoes(ch, "P1 :: R1 :: t\nP2 :: R2 :: t",
      { disciplina: "D", topico: "Preserva" });
    mat[ch].leiSeca = true;
    mat[ch].marcador = 42;
    mat[ch].cartoesInfo = [{ n: 2, origem: "resumo" }];

    api.matGravar(ch, "Resumo editado.", { disciplina: "D", topico: "Preserva" });
    /* guarda antes de acessar: quando o registro é destruído, o teste tem
     * de DIZER isso em vez de quebrar com "cannot read properties of
     * undefined" — mensagem que não ensina nada a quem lê o resultado */
    ok(!!mat[ch], "M46-zero gravar o resumo destruiu o registro inteiro do tópico");
    if (!mat[ch]) mat[ch] = {};
    ok(api.matContarCartoes(ch) === 2,
       `M46 gravar o resumo apagou os cartões: sobraram ${api.matContarCartoes(ch)}`);
    ok(mat[ch].leiSeca === true, "M46b gravar o resumo apagou a marca de lei seca");
    ok(mat[ch].marcador === 42, "M46c gravar o resumo apagou o marcador de página");
    ok(mat[ch].cartoesInfo && mat[ch].cartoesInfo.length === 1,
       "M46d gravar o resumo apagou a procedência dos cartões");
    ok(mat[ch].texto === "Resumo editado.", "M46e o texto novo não entrou");

    /* e apagar o TEXTO não pode levar os cartões junto */
    api.matGravar(ch, "", { disciplina: "D", topico: "Preserva" });
    ok(mat[ch] && api.matContarCartoes(ch) === 2,
       "M46f apagar o texto do resumo levou os cartões junto");
    /* mas sem texto E sem cartões, o registro some mesmo */
    if (!mat[ch]) mat[ch] = { disciplina: "D", topico: "Preserva" };
    mat[ch].cartoes = "";
    api.matGravar(ch, "", { disciplina: "D", topico: "Preserva" });
    ok(!mat[ch], "M46g registro sem texto e sem cartões devia ter sido removido");
  }

  /* ---- M47: abrir o painel de cartões MOSTRA os cartões ---- */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Ver");
    api.matGravar(ch, "Resumo.", { disciplina: "D", topico: "Ver" });
    api.matGravarCartoes(ch, "P1 :: R1 :: t\nP2 :: R2 :: t",
      { disciplina: "D", topico: "Ver" });
    api.matAbrirEditor({ disciplina: "D", nome: "Ver" }, false);
    api.matCartoesAbrir();
    ok(api.matContarCartoes(ch) === 2,
       `M47 abrir o painel apagou os cartões: ${api.matContarCartoes(ch)}`);
    api.matCartoesVer();
    const naCaixa = String(api.$("mcTexto").value || "").split("\n").filter(Boolean);
    ok(naCaixa.length === 2,
       `M47b "ver os salvos" trouxe ${naCaixa.length} linhas em vez de 2`);
    ok(/P1/.test(api.$("mcTexto").value), "M47c o conteúdo dos cartões não veio");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M48: estudar os cartoes em tela, sem abrir o resumo ----
   * Consultar cartao e ler resumo sao tarefas diferentes; obrigar a abrir o
   * texto para ver os cartoes e cobrar um pedagio que nao serve a nada. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    api.mcEstudoIniciar();
    const ch = api.matChave("Direito Financeiro", "Restos a pagar");
    api.matGravar(ch, "Resumo.", { disciplina: "Direito Financeiro", topico: "Restos a pagar" });
    api.matGravarCartoes(ch, ["P1 :: R1 :: fin", "P2 :: R2 :: fin", "P3 :: R3 :: fin"].join("\n"),
      { disciplina: "Direito Financeiro", topico: "Restos a pagar" });

    /* fecha o que blocos anteriores deixaram aberto: a invariante e que
     * mcEstudarDireto NAO abre o resumo, nao que ele estava fechado antes */
    api.$("dlgMaterial").close();
    api.mcEstudarDireto("Direito Financeiro", "Restos a pagar");
    ok(api.$("dlgMcEstudo").open, "M48 o estudo em tela nao abriu");
    ok(!api.$("dlgMaterial").open,
       "M48b abrir os cartoes abriu o resumo junto — sao tarefas diferentes");
    ok(api.mcCartoesSalvos().length === 3,
       `M48c esperava 3 cartoes salvos, veio ${api.mcCartoesSalvos().length}`);
    ok(/1 de 3|1 of 3/.test(api.$("mcEstPos").textContent),
       `M48d a posicao nao aparece: ${api.$("mcEstPos").textContent}`);
    ok((api.$("mcEstCartao").children || []).length === 1,
       "M48e o cartao nao foi desenhado");

    /* andar e circular */
    api.mcEstAndar(1);
    ok(api.mcEstIdxAtual() === 1, "M48f avancar nao mudou de cartao");
    api.mcEstAndar(-1); api.mcEstAndar(-1);
    ok(api.mcEstIdxAtual() === 2,
       `M48g voltar do primeiro devia ir ao ultimo, foi para ${api.mcEstIdxAtual()}`);
    /* virar esconde de novo ao trocar de cartao: senao a resposta do
     * proximo aparece antes de voce tentar lembrar */
    api.$("btnMcEstVirar").onclick();
    ok(api.mcEstMostraAtual() === true, "M48h virar nao mostrou a resposta");
    api.mcEstAndar(1);
    ok(api.mcEstMostraAtual() === false,
       "M48i a resposta do proximo cartao ja veio virada");
  }

  /* ---- M49: apagar um cartao pergunta DUAS vezes ----
   * Cartao apagado nao volta, e apagar o errado e facil quando se esta
   * passando rapido por uma pilha deles. */
  {
    const ch = api.matChave("Direito Financeiro", "Restos a pagar");
    api.mcEstudarDireto("Direito Financeiro", "Restos a pagar");
    const antes = api.matContarCartoes(ch);

    /* "nao" na PRIMEIRA pergunta */
    const p1 = api.mcApagarCartao(0);
    api.uiModalResponder(false);
    await p1;
    ok(api.matContarCartoes(ch) === antes,
       "M49 responder 'nao' na primeira pergunta apagou assim mesmo");

    /* "sim" na primeira e "nao" na segunda */
    const p2 = api.mcApagarCartao(0);
    api.uiModalResponder(true);
    await new Promise((r) => setImmediate(r));
    api.uiModalResponder(false);
    await p2;
    ok(api.matContarCartoes(ch) === antes,
       "M49b a segunda pergunta nao segurou a exclusao");

    /* sim nas duas */
    /* apaga o do MEIO: apagando o primeiro, uma implementacao que sempre
     * remove a linha 0 passaria sem ninguem notar */
    const p3 = api.mcApagarCartao(1);
    api.uiModalResponder(true);
    await new Promise((r) => setImmediate(r));
    api.uiModalResponder(true);
    await p3;
    ok(api.matContarCartoes(ch) === antes - 1,
       `M49c confirmar duas vezes devia apagar 1: ${antes} -> ${api.matContarCartoes(ch)}`);
    const sobrou = String(api.matResumosAtual()[ch].cartoes || "");
    ok(!/P2 ::/.test(sobrou), `M49d apagou o cartao errado: ${sobrou}`);
    ok(/P1 ::/.test(sobrou) && /P3 ::/.test(sobrou),
       `M49e apagar um cartao levou os outros junto: ${sobrou}`);
    Object.keys(api.matResumosAtual()).forEach((k) => delete api.matResumosAtual()[k]);
  }

  /* ---- M50: todo botao do resumo explica o que faz ---- */
  {
    const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
    [["dlgMaterial", "resumo"], ["dlgMatCartoes", "painel de cartoes"],
     ["dlgMcEstudo", "estudo em tela"]].forEach(([id, nome]) => {
      const i = html.indexOf('<dialog id="' + id + '"');
      const j = html.indexOf("</dialog>", i);
      const bloco = html.slice(i, j);
      const pedacos = bloco.split("<button").slice(1);
      const sem = pedacos.filter((x) => {
        const fim = x.indexOf(">");
        return x.slice(0, fim).indexOf("title=") < 0;
      });
      ok(sem.length === 0,
         `M50 ${sem.length} botao(oes) do ${nome} sem explicacao ao passar o mouse: `
         + sem.map((x) => ("<button" + x).slice(0, 46)).join(" | "));
    });
  }

  /* ---- M51: LEI SECA e documento proprio, nao uma marca no resumo ----
   * Marcar o resumo inteiro como "lei seca" era confuso: um topico costuma
   * ter as DUAS coisas — a letra da lei e o comentario sobre ela. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    api.leiIniciar();
    const ch = api.matChave("Direito Financeiro", "LRF");
    api.matGravar(ch, "Comentario sobre a LRF.",
      { disciplina: "Direito Financeiro", topico: "LRF" });
    api.matGravarCartoes(ch, "P :: R :: fin",
      { disciplina: "Direito Financeiro", topico: "LRF" });

    ok(api.leiTem(ch) === false, "M51-pre ainda nao devia haver lei seca");
    api.leiAbrir("Direito Financeiro", "LRF");
    ok(api.leiModoAtual() === "editar",
       "M51 lei seca vazia devia abrir em EDICAO, nao em leitura");
    api.$("leiTexto").value = "## Art. 1o\nEsta Lei estabelece normas.";
    api.leiGravar();

    ok(api.leiTem(ch), "M51b a lei seca nao foi gravada");
    /* e as OUTRAS coisas do topico continuam intactas */
    ok(mat[ch].texto === "Comentario sobre a LRF.",
       "M51c gravar a lei seca apagou o resumo");
    ok(api.matContarCartoes(ch) === 1,
       "M51d gravar a lei seca apagou os cartoes");
    ok(api.matTiposDe(mat[ch]).indexOf("lei") >= 0
       && api.matTiposDe(mat[ch]).indexOf("resumo") >= 0
       && api.matTiposDe(mat[ch]).indexOf("cartoes") >= 0,
       `M51e o topico devia ter os tres tipos: ${JSON.stringify(api.matTiposDe(mat[ch]))}`);

    /* reabrir com conteudo abre LENDO */
    api.leiAbrir("Direito Financeiro", "LRF");
    ok(api.leiModoAtual() === "ler",
       "M51f lei seca com conteudo devia abrir em LEITURA");

    /* "li este material" vai para o diario */
    api.diarioPor([]);
    api.leiRegistrarLeitura();
    api.uiModalResponder(true);
    await new Promise((r) => setImmediate(r));
    ok(api.diarioAtual().length === 1,
       `M51g a leitura da lei seca nao foi para o diario (${api.diarioAtual().length})`);
    ok(api.diarioAtual()[0].n === "LRF",
       "M51h o registro do diario aponta para o topico errado");
    api.diarioPor([]);
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M52: o "*" do negrito NAO e sufixo de cor ----
   * "==**Ato Complexo:**" tinha o primeiro "*" lido como sufixo da cor
   * "prova": tirar a marca levava um asterisco junto e o negrito ficava
   * aberto — "*Ato Complexo:**". Foi o defeito relatado. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Neg");
    api.matGravar(ch, "- ==**Ato Complexo:** Exige a conjugacao.==\n- ==*Caiu em 2024==",
      { disciplina: "D", topico: "Neg" });
    api.matAbrirEditor({ disciplina: "D", nome: "Neg" }, true);
    api.matPorSelecao("Ato Complexo");
    api.matTirarMarca();
    const v = api.$("matTexto").value;
    ok(((v.match(/\*\*/g) || []).length % 2) === 0,
       `M52 tirar a marca quebrou o negrito: ${JSON.stringify(v.split("\n")[0])}`);
    ok(/\*\*Ato Complexo:\*\*/.test(v),
       `M52b o par de negrito nao ficou inteiro: ${JSON.stringify(v.split("\n")[0])}`);
    /* e a marca de PROVA, que usa "*" de verdade, continua funcionando */
    ok(/==\*Caiu em 2024==/.test(v), "M52c a marca de prova foi levada junto");
    ok(/m-prova/.test(api.matParaHtml("==*Caiu em 2024==")),
       "M52d a marca de prova deixou de ser reconhecida na leitura");
    ok(/m-duv/.test(api.matParaHtml("==?**Ato:** duvida==")),
       "M52e duvida com negrito dentro perdeu a cor");
  }

  /* ---- M53: dúvidas viram lista consultável ---- */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const c1 = api.matChave("Direito Administrativo", "Atos");
    api.matGravar(c1, "O ato ==?depende de homologacao== e o ==?ato composto== gera duvida.",
      { disciplina: "Direito Administrativo", topico: "Atos", concurso: "TCE-PE" });
    const c2 = api.matChave("Direito Financeiro", "LRF");
    api.matGravar(c2, "Texto com ==?outra duvida== no meio.",
      { disciplina: "Direito Financeiro", topico: "LRF", concurso: "TCE-PE" });

    const d = api.matDuvidas();
    ok(d.length === 3, `M53 esperava 3 duvidas, veio ${d.length}`);
    ok(d.every((x) => x.topico && x.disciplina),
       "M53b a duvida nao diz de qual topico e");
    ok(d.some((x) => x.trecho === "outra duvida"),
       "M53c a duvida de outro topico nao entrou na lista");

    /* o contador do topo conta so as DESTE resumo */
    api.matAbrirEditor({ disciplina: "Direito Administrativo", nome: "Atos" }, true);
    ok(api.$("btnMatDuvidas").hidden === false, "M53d o contador nao apareceu");
    ok(/2/.test(api.$("btnMatDuvidas").textContent),
       `M53e o contador devia dizer 2: ${api.$("btnMatDuvidas").textContent}`);

    /* resolver tira a marca e MANTEM o texto */
    api.matResolverDuvida(d[0]);
    ok(api.matDuvidas().length === 2, "M53f resolver nao tirou a duvida da lista");
    ok(/depende de homologacao/.test(mat[c1].texto),
       "M53g resolver apagou o texto junto com a marca");
    ok(!/==\?depende/.test(mat[c1].texto),
       "M53h a marca de duvida continuou no texto");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M54: conserto da marcacao ja danificada ----
   * Quem usou o app antes da correcao tem texto com asterisco orfao e marca
   * aberta que nunca fecha — a leitura mostra "==?" literal. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Dano");
    api.matGravar(ch, "- *==?Ato Complexo:** Exige a conjugacao.\n- **Ato Composto:** normal.",
      { disciplina: "D", topico: "Dano" });
    const q = api.matNegritoQuebrado(ch);
    ok(q.length === 1, `M54 esperava 1 linha danificada, veio ${q.length}`);
    ok(q[0].marca === true, "M54b a marca orfa nao foi identificada");

    api.matConsertarNegrito(ch);
    const t1 = mat[ch].texto.split("\n")[0];
    ok(!/==/.test(t1), `M54c a marca orfa continuou: ${JSON.stringify(t1)}`);
    ok(/\*\*Ato Complexo:\*\*/.test(t1),
       `M54d o asterisco que faltava nao foi devolvido: ${JSON.stringify(t1)}`);
    /* e a linha que estava boa nao pode ter sido tocada */
    ok(mat[ch].texto.split("\n")[1] === "- **Ato Composto:** normal.",
       "M54e o conserto mexeu numa linha que estava certa");
    ok(!/==/.test(api.matParaHtml(mat[ch].texto).replace(/<[^>]+>/g, "")),
       "M54f a leitura ainda mostra marcador literal");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M55: erro em botao do resumo vai para o log ----
   * Enquanto cada botao chamava sua funcao direto, um erro morria no
   * console do navegador — que ninguem abre. */
  {
    const html = fs.readFileSync(path.join(RAIZ, "docs", "material.js"), "utf8");
    ok(/function matBotao\(/.test(html),
       "M55 nao existe o envelope que captura erro de botao");
    const diretos = (html.match(/\$\("btnMarca[A-Za-z]+"\)\.onclick\s*=/g) || []);
    ok(diretos.length === 0,
       `M55b ${diretos.length} botao(oes) de marca ainda ligados sem captura de erro`);
  }

  /* ---- M56: marca que ATRAVESSA linhas ----
   * A leitura e montada linha a linha: um "==?" numa linha e o "==" de
   * fecho na seguinte nao formam marca nenhuma — as duas aparecem LITERAIS
   * na tela. Selecionar um paragrafo inteiro e o gesto mais comum ao
   * grifar, entao isso acontecia o tempo todo. Foi o defeito relatado:
   * "o botao de duvida nao pinta de azul". */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Multi");
    const DOC = ["- **Ato Complexo:** Exige a conjugacao de vontades de dois orgaos.",
                 "O exemplo vital e a aposentadoria.", "",
                 "- **Ato Composto:** normal."].join("\n");
    api.matGravar(ch, DOC, { disciplina: "D", topico: "Multi" });
    api.matAbrirEditor({ disciplina: "D", nome: "Multi" }, true);
    api.matPorSelecao("Exige a conjugacao de vontades de dois orgaos. O exemplo vital");
    api.matMarcarSelecao("duvida");

    const v = api.$("matTexto").value;
    const h = api.matParaHtml(v);
    ok((h.match(/m-duv/g) || []).length === 2,
       `M56 a marca devia pintar as 2 linhas, pintou `
       + (h.match(/m-duv/g) || []).length + `: ${JSON.stringify(v.slice(0, 120))}`);
    ok(!/==/.test(h.replace(/<[^>]+>/g, "")),
       "M56b sobrou marcador LITERAL na leitura — é o que a pessoa vê como “==?”");
    ok(/<b>Ato Complexo:<\/b>/.test(h),
       "M56c o negrito da linha se perdeu ao marcar através dela");
    /* a linha em branco no meio nao pode virar "==?==" */
    ok(!/==\?==/.test(v), `M56d linha vazia recebeu marca vazia: ${JSON.stringify(v)}`);

    /* e tirar a marca desfaz tudo */
    api.matPorSelecao("Exige a conjugacao");
    api.matTirarMarca();
    ok(!/==\?/.test(api.$("matTexto").value.split("\n")[0]),
       "M56e tirar a marca de uma linha não a removeu");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M57: reabrir diálogo já aberto NÃO pode quebrar ----
   * showModal() num <dialog> já aberto lança InvalidStateError no Chrome, e
   * a função que chamou morre ali. Era o que fazia "abrir onde está" e
   * "resolvida", nas dúvidas, parecerem sem efeito: as duas reabriam um
   * diálogo que já estava na tela. O stub aceitava calado e os testes
   * passavam verdes — agora ele lança igual ao navegador. */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    api.leiIniciar();
    const ch = api.matChave("D", "Duv");
    api.matGravar(ch, "O ato ==?depende de homologacao== e assim.",
      { disciplina: "D", topico: "Duv" });

    /* o caminho real: o resumo ABERTO, e as dúvidas abertas de dentro dele */
    api.matAbrirEditor({ disciplina: "D", nome: "Duv" }, true);
    api.matDuvidasAbrir();
    const li = (api.$("duvLista").children || [])[0];
    const ac = (li.children || []).find((c) => (c.className || "") === "duv-acoes");
    const bAbrir = (ac.children || []).find((b) => /abrir onde|open where/i.test(b._texto || ""));
    let erro = null;
    try { bAbrir.onclick(); } catch (e) { erro = e; }
    ok(!erro, `M57 "abrir onde está" quebrou: ${erro && erro.message}`);

    /* e "resolvida" redesenha a lista — que é reabrir o mesmo diálogo */
    api.matDuvidasAbrir();
    const li2 = (api.$("duvLista").children || [])[0];
    const ac2 = (li2.children || []).find((c) => (c.className || "") === "duv-acoes");
    const bOk = (ac2.children || []).find((b) => /resolvida|solved/i.test(b._texto || ""));
    const p = bOk.onclick();
    api.uiModalResponder(true);
    let erro2 = null;
    await Promise.resolve(p).catch((e) => { erro2 = e; });
    ok(!erro2, `M57b "resolvida" quebrou: ${erro2 && erro2.message}`);
    ok(api.matDuvidas().length === 0, "M57c a dúvida não foi resolvida");
    ok(/depende de homologacao/.test(mat[ch].texto),
       "M57d resolver apagou o texto junto com a marca");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- M58: dica presa à dúvida, e incorporável ao resumo ---- */
  {
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Dica");
    api.matGravar(ch, "O ato composto ==?depende de homologacao== do superior.\nOutra linha.",
      { disciplina: "D", topico: "Dica" });

    api.matGravarDica(ch, "depende de homologacao", "Homologacao confirma o ato.");
    ok(!!api.matDicaDe(ch, "depende de homologacao"), "M58 a dica não foi guardada");
    /* presa ao TRECHO, não à posição: editar o resumo move o texto de lugar */
    mat[ch].texto = "Linha nova no topo.\n" + mat[ch].texto;
    ok(!!api.matDicaDe(ch, "depende de homologacao"),
       "M58b a dica se perdeu quando o texto mudou de posição");

    api.matDuvidasAbrir();
    const li = (api.$("duvLista").children || [])[0];
    ok((li.children || []).some((c) => (c.className || "") === "duv-dica"),
       "M58c a dica não aparece junto da dúvida na lista");

    ok(api.matIncorporarDica(ch, "depende de homologacao", "texto"),
       "M58d incorporar falhou");
    const linhas = mat[ch].texto.split("\n");
    const k = linhas.findIndex((l) => /depende de homologacao/.test(l));
    ok(/^> /.test(linhas[k + 1] || ""),
       `M58e a dica não entrou logo abaixo do trecho: ${JSON.stringify(linhas)}`);
    ok(!api.matDicaDe(ch, "depende de homologacao"),
       "M58f a dica incorporada continuou na lista de dicas soltas");
    /* e a leitura mostra que é DICA, não parte do material original */
    ok(/mat-dica/.test(api.matParaHtml(mat[ch].texto)),
       "M58g a dica incorporada não é reconhecível na leitura");
    /* incorporar duas vezes não duplica */
    ok(api.matIncorporarDica(ch, "depende de homologacao", "texto") === false,
       "M58h incorporou a mesma dica de novo");
    Object.keys(mat).forEach((k2) => delete mat[k2]);
  }

  /* ---- M59: UM botão de salvar, não dois ----
   * Havia "Salvar" e "Salvar estado" fazendo a MESMA gravação — a única
   * diferença era fechar ou não a janela, e os rótulos sugeriam que
   * salvavam coisas diferentes. */
  {
    const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
    const i = html.indexOf('<dialog id="dlgMaterial"');
    const j = html.indexOf("</dialog>", i);
    const bloco = html.slice(i, j);
    const salvas = (bloco.match(/id="btnMatSalvar[A-Za-z]*"/g) || []);
    ok(salvas.length <= 2,
       `M59 há ${salvas.length} botões de salvar no resumo: ${salvas.join(", ")}`);
    /* e os que existem têm o MESMO rótulo: dois nomes para a mesma gravação
     * é o que fazia parecer que salvavam coisas diferentes */
    const rotulos = (bloco.match(/id="btnMatSalvar[A-Za-z]*"[^>]*data-i18n="([a-z_]+)"/g) || [])
      .map((x) => (x.match(/data-i18n="([a-z_]+)"/) || [])[1]);
    ok(new Set(rotulos).size === 1,
       `M59a os botões de salvar usam rótulos diferentes: ${rotulos.join(", ")}`);

    /* e ele grava mesmo: marca, salva, e o texto guardado tem a marca */
    const mat = api.matResumosAtual();
    Object.keys(mat).forEach((k) => delete mat[k]);
    const ch = api.matChave("D", "Salvar");
    api.matGravar(ch, "Um texto para marcar aqui.", { disciplina: "D", topico: "Salvar" });
    api.matAbrirEditor({ disciplina: "D", nome: "Salvar" }, true);
    api.matPorSelecao("para marcar");
    api.matMarcarSelecao("destaque");
    ok(api.matEstaSujo(), "M59-pre precisa haver marcação pendente");
    api.$("btnMatSalvar").onclick();
    ok(!api.matEstaSujo(), "M59b salvar não limpou a pendência");
    ok(/==para marcar==/.test(String(mat[ch].texto || "")),
       `M59c a marca não foi gravada: ${JSON.stringify(mat[ch].texto)}`);
    ok(api.$("dlgMaterial").open,
       "M59d salvar fechou o resumo — o botão único grava e CONTINUA aqui");
    /* o do TOPO faz exatamente o mesmo, sem perder função */
    api.matPorSelecao("Um texto");
    api.matMarcarSelecao("duvida");
    api.$("btnMatSalvarEstadoTopo").onclick();
    ok(!api.matEstaSujo() && (mat[ch].texto.match(/==/g) || []).length === 4,
       "M59e o botão de salvar do topo não faz a mesma gravação do rodapé");
    Object.keys(mat).forEach((k) => delete mat[k]);
  }

  /* ---- N1: "caiu na prova" numa linha em NEGRITO ----
   * O sufixo da marca de prova e um asterisco; negrito sao dois. Grudados,
   * "==***" nao e marca nenhuma para o leitor, e o detector de marcacao
   * torta acendia no primeiro uso do botao. */
  {
    const { api: aN } = rodar();
    aN.matIniciar();
    const cN = aN.matChave("D", "T");
    const linha = "**1. (FGV) Sobre a transferencia, o que se exige?** A) Convenio.";
    aN.matGravar(cN, linha, { disciplina: "D", topico: "T" });
    aN.matAbrirEditor({ disciplina: "D", nome: "T" }, "editar");
    aN.matPorSelecao(linha);
    aN.matMarcarSelecao("prova");
    const txt = aN.matTextoVivo(cN, "texto");

    ok(!/==\*\*/.test(txt),
       "N1 a marca de prova ficou grudada no negrito: " + txt.slice(0, 30));
    ok(aN.matLinhaTorta(txt) === false,
       "N1b marcar 'caiu na prova' deixou a linha como torta sem nada estar torto");
    ok(aN.matConsertarPlano(cN).length === 0,
       "N1c o 'consertar marcacao' acendeu sozinho depois de um grifo legitimo");

    aN.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const mks = aN.$("matLeitura").querySelectorAll("mark");
    ok(mks.length === 1, `N1d devia pintar 1 marca, pintou ${mks.length}`);
    ok(!!mks[0] && mks[0].getAttribute("data-marca") === "prova",
       "N1e a marca pintada nao se identifica como a de prova: "
       + (mks[0] ? mks[0].getAttribute("data-marca") : "nenhuma marca"));
    ok(/1\. \(FGV\)/.test((mks[0] && mks[0].textContent) || ""),
       "N1f o texto da questao nao entrou na marca");
    /* e o negrito continua negrito */
    ok(((txt.match(/\*\*/g) || []).length) === 2,
       "N1g o negrito da linha foi desfeito pelo grifo");
  }

  /* ---- N2: contadores e lista de "caiu na prova" e "pegadinha" ---- */
  {
    const { api: aO } = rodar();
    aO.matIniciar();
    const cO = aO.matChave("D", "T");
    aO.matGravar(cO, "Um ==*caiu na prova isto== fim.\nDois ==~pegadinha aqui== fim.",
      { disciplina: "D", topico: "T" });
    aO.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");

    const bp = aO.$("btnMatProvaLista");
    const bg = aO.$("btnMatPegLista");
    ok(!!bp && !!bg, "N2 faltam os contadores de prova e pegadinha");
    ok(/\(1\)/.test(bp.textContent || ""),
       "N2b o contador de prova nao conta: " + bp.textContent);
    ok(/\(1\)/.test(bg.textContent || ""),
       "N2c o contador de pegadinha nao conta: " + bg.textContent);

    bp.onclick();
    ok(aO.$("dlgMarcasTipo").open === true, "N2d a lista nao abriu");
    const itens = aO.$("mkLista").querySelectorAll(".duv-item");
    ok(itens.length === 1, `N2e a lista devia ter 1 item, tem ${itens.length}`);
    ok(/caiu na prova isto/.test(itens[0].textContent || ""),
       "N2f o item nao mostra o trecho marcado");
    const acoes = itens[0].querySelectorAll("button").map((b) => b.textContent);
    ok(acoes.length === 3,
       "N2g o item devia ter ver/editar/tirar, tem: " + JSON.stringify(acoes));

    /* TIRAR pela lista: pergunta antes, mostrando o trecho */
    const bTirar = itens[0].querySelectorAll("button")
      .filter((b) => /tirar/i.test(b.textContent))[0];
    const pr = bTirar.onclick();
    ok(aO.uiPerguntando() === true, "N2h tirou a marca sem perguntar nada");
    ok(/caiu na prova isto/.test(aO.$("uiModalMsg").textContent || ""),
       "N2i a pergunta nao mostra QUAL trecho perde a cor");
    aO.uiModalResponder(false);
    await pr;
    ok(aO.matContarMarcas("prova", cO) === 1, "N2j respondi NAO e tirou assim mesmo");

    const pr2 = aO.$("mkLista").querySelectorAll(".duv-item")[0]
      .querySelectorAll("button").filter((b) => /tirar/i.test(b.textContent))[0].onclick();
    aO.uiModalResponder(true);
    await pr2;
    ok(aO.matContarMarcas("prova", cO) === 0, "N2k respondi SIM e a marca ficou");
    ok(/caiu na prova isto/.test(aO.matTextoVivo(cO, "texto")),
       "N2l tirar a marca levou o TEXTO junto — so a cor devia sair");
    ok(aO.matContarMarcas("pegadinha", cO) === 1,
       "N2m tirar a marca de prova levou a pegadinha junto");
  }

  /* ---- N3: clicar na propria marca ---- */
  {
    const { api: aP } = rodar();
    aP.matIniciar();
    const cP = aP.matChave("D", "T");
    aP.matGravar(cP, "Linha ==*trecho de prova== fim.", { disciplina: "D", topico: "T" });
    aP.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const mk = aP.$("matLeitura").querySelectorAll("mark")[0];
    ok(!!mk, "N3 a marca nao foi pintada");

    aP.matMenuDaMarca(mk);
    ok(aP.$("dlgMarcaMenu").open === true, "N3b clicar na marca nao abriu menu nenhum");
    ok(/trecho de prova/.test(aP.$("mmTrecho").textContent || ""),
       "N3c o menu nao diz em qual trecho estou mexendo");
    ok(/prova/i.test(aP.$("mmTitulo").textContent || ""),
       "N3c2 o menu nao diz de que cor e a marca: " + aP.$("mmTitulo").textContent);

    /* TODAS as cores cabem: com o modal generico de tres botoes, duas
     * das cinco ficavam inalcancaveis e nao havia como saber disso. */
    const cores = aP.$("mmCores").querySelectorAll("button");
    ok(cores.length === 4,
       `N3d deviam sobrar 4 cores para trocar, aparecem ${cores.length}`);
    const nomes = cores.map((b) => b.textContent).join(",");
    ok(nomes.indexOf("pegadinha") >= 0,
       "N3e a pegadinha ficou fora das cores oferecidas: " + nomes);

    const pt = aP.$("btnMmTirar").onclick();
    ok(aP.uiPerguntando() === true, "N3f tirou pelo menu sem perguntar");
    aP.uiModalResponder(true);
    await pt;
    ok(aP.matContarMarcas("prova", cP) === 0, "N3g o menu nao tirou a marca");
    ok(/trecho de prova/.test(aP.matTextoVivo(cP, "texto")),
       "N3h tirar pelo menu levou o texto junto");

    /* trocar a cor: um clique so, e o trecho nao sai do lugar.
     * matAplicarTexto e nao matGravar: com o editor aberto quem manda na
     * tela e o texto VIVO da caixa, e gravar so no registro deixaria o
     * teste medindo um texto que a tela nao esta mostrando. */
    aP.matAplicarTexto(cP, "texto", "Linha ==*outro trecho== fim.");
    aP.matRender();
    aP.matMenuDaMarca(aP.$("matLeitura").querySelectorAll("mark")[0]);
    const bPeg = aP.$("mmCores").querySelectorAll("button")
      .filter((b) => /pegadinha/i.test(b.textContent))[0];
    ok(!!bPeg, "N3i2 sem o botao de pegadinha nao da para trocar para ela");
    if (bPeg) bPeg.onclick();
    ok(aP.matContarMarcas("prova", cP) === 0, "N3i trocar a cor deixou a marca antiga");
    ok(aP.matContarMarcas("pegadinha", cP) === 1, "N3j trocar a cor nao pos a nova");
    ok(/outro trecho/.test(aP.matTextoVivo(cP, "texto")),
       "N3k trocar a cor mexeu no texto");
  }

  /* ---- N4: os botoes que sairam da barra ---- */
  {
    const { api: aQ } = rodar();
    aQ.matIniciar();
    ok(aQ.$("btnMarcaLei") === null,
       "N4 o botao de lei/artigo continua na barra");
    ok(aQ.$("btnMarcaLimpar") === null,
       "N4b 'limpar marcas' continua na barra — era a acao mais destrutiva "
       + "da tela, ao lado das que so pintam");
    ok(aQ.$("btnMarcaTirar") === null,
       "N4c 'tirar esta marca' continua na barra em vez de sair pelo clique na marca");
    ok(aQ.$("btnMatLei") === null,
       "N4c2 a lei seca continua na barra do resumo — a porta dela e o ⚖ da agenda");
    /* mas texto ANTIGO com marca de lei continua sendo lido */
    const h = aQ.matParaHtml("==\u00a7artigo antigo==");
    ok(/m-lei/.test(h),
       "N4d texto antigo com marca de lei deixou de ser pintado: " + h.slice(0, 50));
  }

  falhas.quantas = quantas;
  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  const { comVigia } = require("./vigia.js");
  comVigia(Promise.resolve(testes()), "material-marcas", 60000).then((f) => {
    f.forEach((x) => console.log("  FALHA  " + x));
    console.log(f.length ? `\nmarcas: ${f.length} FALHA(S)\n`
      : "\nmarcas: selecao, rascunho e fechar-que-pergunta ok ("
        + (f.quantas || "?") + " verificacoes)\n");
    process.exit(f.length ? 1 : 0);
  }).catch((e) => { console.log("  FALHA  " + e.message); process.exit(1); });
}
