/* =====================================================================
 * O LEITOR DE LEI SECA
 *
 * POR QUE ISTO EXISTE. O botão "li este material" era a única porta do
 * aplicativo que gravava estudo SOZINHA. Todas as outras — agenda,
 * material, questões — abrem o mesmo formulário, onde se confere
 * minutos, forma de estudo, questões feitas e dificuldade. Aqui não:
 * chamava edMarcar direto, com minutos que ele mesmo tinha calculado.
 *
 * E O CÁLCULO ERA UM PALPITE APRESENTADO COMO FATO. Ninguém cronometrou
 * nada: os minutos são palavras ÷ 75 — "quanto tempo esta lei levaria
 * para ser lida inteira". Numa emenda de 14 mil palavras isso dá 193
 * minutos, que iam para o diário como três horas de estudo por causa de
 * um toque. E não param no diário: entram na cobertura da disciplina,
 * mudam a prioridade dela e deslocam as horas das outras.
 *
 * O QUE PRECISA SER VERDADE:
 *
 * 1. O BOTÃO ABRE O FORMULÁRIO, não grava.
 * 2. O PALPITE CHEGA COMO SUGESTÃO no campo de minutos.
 * 3. O QUE VAI PARA O DIÁRIO É O QUE FOI CONFIRMADO, não o sugerido.
 * 4. FECHAR SEM GRAVAR NÃO REGISTRA NADA — nem no diário, nem no log.
 * 5. E O RETORNO NÃO SOBRA ARMADO para o próximo registro, que pode
 *    vir de outra tela e de outro tópico.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* Uma lei curta o bastante para a conta ser conferível à mão. */
  const LEI = "Art. 1º Esta lei entra em vigor na data de sua publicação.\n"
    + "Art. 2º O prazo é de quinze dias, salvo motivo justificado.\n"
    + "Art. 3º É vedado ao órgão exigir documento que já conste dos autos.";

  const abrirLei = (api) => {
    /* edIniciar liga o "fechar" do formulário de registro. Sem ele, o
     * teste do cancelamento não teria em que clicar — e passar por não
     * ter botão é o tipo de verde que não quer dizer nada. */
    try { api.edIniciar(); } catch (e) {}
    api.leiAbrir("Direito Tributário", "Princípios");
    api.$("leiTexto").value = LEI;
    return api;
  };

  /* ==============================================================
   * L1: O BOTÃO ABRE O FORMULÁRIO — não grava sozinho
   * ============================================================== */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiRegistrarLeitura();
    ok(api.$("dlgRegistro").open === true,
       "L1 a lei seca continua sendo a única porta que grava estudo sem "
       + "passar pelo formulário: sem ele não há como corrigir os "
       + "minutos, dizer que houve questões, nem marcar a dificuldade");
  }

  /* ---- L1a: com o tópico e o palpite de minutos já dentro ---- */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiRegistrarLeitura();
    ok(/princ/i.test(api.$("regTitulo").textContent || ""),
       "L1a o formulário abriu apontando para outro tópico: "
       + api.$("regTitulo").textContent);
    const min = Number(api.$("regMinutos").value);
    ok(min >= 5,
       "L1b o campo de minutos abriu vazio: o palpite é ruim como "
       + "afirmação e bom como ponto de partida — em branco, ele obriga "
       + "a inventar um número do zero: " + api.$("regMinutos").value);
  }

  /* ==============================================================
   * L2: O QUE VAI PARA O DIÁRIO É O QUE FOI CONFIRMADO
   *
   * O caso real: 193 minutos sugeridos, a pessoa corrige para 40. Se o
   * app gravar 193, ele registrou três horas que não existiram — e a
   * correção terá sido teatro.
   * ============================================================== */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiRegistrarLeitura();
    const sugerido = Number(api.$("regMinutos").value);
    api.$("regMinutos").value = "40";
    api.confirmarRegistro("feito");

    const log = api.leiLogTexto ? api.leiLogTexto() : "";
    ok(/40 min/.test(log),
       "L2 o registro anotou os minutos SUGERIDOS e não os confirmados "
       + "(sugestão era " + sugerido + "): " + log);
    ok(!new RegExp("\\\\b" + sugerido + " min").test(log)
       || sugerido === 40,
       "L2a a sugestão vazou para o registro como se fosse o valor "
       + "confirmado: " + log);
  }

  /* ==============================================================
   * L3: FECHAR SEM GRAVAR NÃO REGISTRA NADA
   *
   * Anotar "leitura registrada" na abertura diria que houve registro
   * mesmo quando o formulário fosse fechado — e é justamente para o
   * registro que se olha quando alguma conta não bate.
   * ============================================================== */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiRegistrarLeitura();
    api.$("btnRegFechar").onclick();
    const log = api.leiLogTexto ? api.leiLogTexto() : "";
    ok(!/leitura registrada/.test(log),
       "L3 fechar o formulário sem gravar deixou 'leitura registrada' "
       + "no log: o registro passa a mentir sobre o que aconteceu, e é "
       + "para ele que se olha quando algo não bate: " + log);
  }

  /* ---- L3a: e o retorno não fica armado para o próximo ---- */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiRegistrarLeitura();
    api.$("btnRegFechar").onclick();
    ok(api.regDepoisAtual() === null,
       "L3a o retorno da lei seca continuou armado depois de a pessoa "
       + "desistir: o PRÓXIMO registro — de outro tópico, aberto pela "
       + "agenda — sairia anotado no log da lei como leitura dela");
  }

  /* ==============================================================
   * L4: A LACUNA APAGA O QUE A BANCA TROCA
   *
   * Esconder o artigo inteiro testa se você lembra que existe um art.
   * 150, não o que ele diz. A banca troca UMA palavra: "quinze" vira
   * "trinta", "vedado" vira "permitido", "somente" some.
   * ============================================================== */
  {
    const { api } = rodar();
    const txt = "O prazo é de quinze dias, salvo motivo justificado, "
      + "e o órgão deverá publicar em 30 dias.";
    const lac = api.leiComLacunas(txt).filter((x) => x.lacuna)
      .map((x) => x.txt);
    ["quinze", "salvo", "deverá", "30"].forEach((p) => {
      ok(lac.some((x) => x.replace(/[.,;]$/, "") === p),
         "L4 a palavra “" + p + "” não virou lacuna — é exatamente o "
         + "tipo de palavra que a banca troca: " + JSON.stringify(lac));
    });
    /* ---- L4a: e NÃO apaga palavra à toa ----
     * Apagar substantivo comum transforma o exercício em adivinhação de
     * texto, que treina paciência e não a norma. */
    ["prazo", "dias", "motivo", "publicar", "órgão"].forEach((p) => {
      ok(!lac.some((x) => x.replace(/[.,;]$/, "") === p),
         "L4a apagou “" + p + "”, que a banca não troca: com meia frase "
         + "em branco o exercício vira adivinhação: " + JSON.stringify(lac));
    });
  }

  /* ---- L4b: os pedaços recompõem o texto exato ----
   * Se a soma dos pedaços não for o original, a tela mostra um artigo
   * que não é o artigo — sem espaço, com pontuação comida, e a pessoa
   * decora a versão estropiada. */
  {
    const { api } = rodar();
    const txt = "Art. 2º  O prazo é de 15 (quinze) dias, salvo disposição "
      + "em contrário.\nParágrafo único. Aplica-se o disposto no caput.";
    const volta = api.leiComLacunas(txt).map((x) => x.txt).join("");
    ok(volta === txt,
       "L4b os pedaços não recompõem o texto original: a tela vai "
       + "mostrar um artigo estropiado, e é ele que a pessoa decora");
  }

  /* ==============================================================
   * L4d: O NÚMERO DO ARTIGO NÃO É LACUNA — É O ENDEREÇO
   *
   * O DEFEITO REAL, visto na EC 132/2023: o Art. 1º saiu com CEM
   * lacunas, e as primeiras eram "1º", "43.", "4º", "2º", "50.". A
   * regra apagava qualquer coisa com dígito, e num texto de emenda
   * quase todo dígito é REMISSÃO: "Art. 43", "§ 2º", "inciso III".
   *
   * Erra duas vezes. A banca não troca o endereço de um artigo por
   * outro esperando que você tenha decorado a numeração de cada
   * remissão — ela troca o PRAZO e o PERCENTUAL. E sem os números o
   * texto deixa de ser legível: cem buracos num artigo só não se
   * responde, se abandona.
   * ============================================================== */
  {
    const { api } = rodar();
    const txt = "Art. 1º A Constituição passa a vigorar com as seguintes "
      + "alterações: \"Art. 43. § 4º Sempre que possível, a concessão a "
      + "que se refere o § 2º, III, considerará critérios. Art. 50. A "
      + "Câmara poderão convocar Ministro. O prazo é de 90 dias e a "
      + "alíquota de 20%. Salvo disposição, o prazo é de quinze dias.";
    const lac = api.leiComLacunas(txt).filter((x) => x.lacuna)
      .map((x) => x.txt.replace(/[.,;"]+$/, ""));

    /* ---- o que NÃO pode sumir: endereço ---- */
    ["1º", "43", "4º", "2º", "50", "III"].forEach((p) => {
      ok(!lac.some((x) => x === p),
         "L4d apagou “" + p + "”, que é NÚMERO DE DISPOSITIVO e não "
         + "quantidade. Foi assim que um artigo saiu com cem lacunas e "
         + "virou um texto quebrado: " + JSON.stringify(lac));
    });

    /* ---- o que TEM de sumir: quantidade e palavra que inverte ---- */
    ["90", "20%", "quinze", "Sempre", "Salvo", "poderão"].forEach((p) => {
      ok(lac.some((x) => x === p),
         "L4d2 “" + p + "” não virou lacuna — é prazo, percentual ou "
         + "palavra que inverte a norma: " + JSON.stringify(lac));
    });

    /* ---- e o total cabe num exercício ----
     * Cem lacunas num artigo não se responde: se abandona. */
    ok(lac.length <= 10,
       "L4d3 " + lac.length + " lacunas num artigo só: um exercício que "
       + "não se responde, se abandona: " + JSON.stringify(lac));
  }

  /* ---- L4d4: A REMISSÃO COM PONTO — "Lei 5.172", "Súmula 473" ----
   *
   * A sabotagem achou este furo: eu tirei a guarda de "vem depois de
   * palavra de endereço" e NENHUMA asserção reclamou, porque todos os
   * casos que eu tinha escrito ("Art. 43", "§ 2º") já eram barrados
   * pela outra regra — a que exige unidade depois de um número solto.
   *
   * A guarda só se exerce no número que NÃO parece numeração de
   * dispositivo: "5.172" tem ponto no meio e passaria como se fosse um
   * valor. É "Lei" na frente que diz que é remissão. Sem asserção sobre
   * este caso, a guarda era código que ninguém defendia.
   * ============================================================== */
  {
    const { api } = rodar();
    const lac = api.leiComLacunas("Aplica-se o disposto na Lei 5.172, na "
      + "Súmula 473 e no Decreto 70.235, no prazo de 30 dias.")
      .filter((x) => x.lacuna).map((x) => x.txt.replace(/[.,;]+$/, ""));
    ["5.172", "473", "70.235"].forEach((p) => {
      ok(!lac.some((x) => x === p),
         "L4d4 apagou “" + p + "”, que é o número de uma NORMA CITADA e "
         + "não uma quantidade: " + JSON.stringify(lac));
    });
    ok(lac.some((x) => x === "30"),
       "L4d5 “30 dias” é prazo e não virou lacuna: " + JSON.stringify(lac));
  }

  /* ---- L4e: numeral por extenso sem unidade não vira lacuna ----
   * "um" e "uma" são artigo indefinido em nove de cada dez frases. */
  {
    const { api } = rodar();
    const lac = api.leiComLacunas("Compete a um órgão a fiscalização de "
      + "uma atividade por três anos.").filter((x) => x.lacuna)
      .map((x) => x.txt.replace(/[.,;]+$/, ""));
    ok(!lac.some((x) => x === "um") && !lac.some((x) => x === "uma"),
       "L4e apagou o artigo indefinido: " + JSON.stringify(lac));
    ok(lac.some((x) => x === "três"),
       "L4e2 “três anos” é prazo e não virou lacuna: " + JSON.stringify(lac));
  }

  /* ---- L4c: acento não decide se a palavra é chave ----
   * Lei colada de PDF vem com acentuação irregular, e "e vedado" tem de
   * valer o mesmo que "é vedado". */
  {
    const { api } = rodar();
    ok(api.leiPalavraChave("VEDADO") && api.leiPalavraChave("vedado")
       && api.leiPalavraChave("Salvo"),
       "L4c a comparação depende de maiúscula ou de acento — e lei "
       + "colada de PDF vem das duas formas");
  }

  /* ==============================================================
   * L5: A GRADE DE ARTIGOS
   *
   * A caixa "digite o número" exige saber o número, e quem lê uma lei
   * nova quase nunca sabe. Digitar também erra: "8", "8º" e "8-A" são
   * três coisas, e a caixa respondia "não achei" para duas.
   * ============================================================== */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiIrAbrir();
    ok(api.$("dlgLeiIr").open === true, "L5 a grade de artigos não abriu");
    const bs = Array.from(api.$("leiIrGrade").children || []);
    ok(bs.length === 3,
       "L5a a grade não tem um botão por artigo (3 esperados): "
       + bs.length);
    ok(bs.every((b) => String(b.textContent || "").trim()),
       "L5b há botão sem número na grade: "
       + JSON.stringify(bs.map((b) => b.textContent)));
  }

  /* ---- L5c: lei sem artigo nenhum não abre grade vazia ---- */
  {
    const { api } = rodar();
    api.leiAbrir("D", "T");
    api.$("leiTexto").value = "texto solto, sem artigo nenhum";
    api.leiIrAbrir();
    ok(api.$("dlgLeiIr").open !== true,
       "L5c abriu uma grade vazia: uma tela sem nada dentro parece "
       + "defeito, e a resposta certa é dizer que não há artigos");
  }

  /* ==============================================================
   * L6: OS "FECHAR" DAS GAVETAS FECHAM
   *
   * O DEFEITO REAL, achado no registro do usuário: sete botões desta
   * tela estavam ligados com dois argumentos numa função de três. A
   * arrow caiu no lugar do NOME, a ação virou undefined, e cada clique
   * produzia "Cannot read properties of undefined (reading 'apply')"
   * com o CÓDIGO impresso no lugar do nome do botão.
   *
   * POR QUE NENHUM TESTE PEGOU. Nenhum deles clicava em "fechar" —
   * fechar é o gesto que se faz depois que o teste já conferiu o que
   * queria. Uma gaveta que não fecha prende a pessoa na tela.
   * ============================================================== */
  {
    const { api } = rodar();
    try { api.leiIniciar(); } catch (e) {}
    const FECHAM = [
      ["btnLeiProcFechar", "dlgLeiProc"],
      ["btnLeiVincFechar", "dlgLeiVincular"],
      ["btnLeiClozeFechar", "dlgLeiCloze"],
      ["btnLeiIrFechar", "dlgLeiIr"],
    ];
    FECHAM.forEach(([bid, did]) => {
      const b = api.$(bid);
      ok(b && typeof b.onclick === "function",
         "L6 o botão " + bid + " não tem ação ligada: ele existe, "
         + "responde ao toque e não faz nada — e o clique ainda estoura "
         + "em '.apply', porque a arrow foi parar no lugar do nome");
      if (!b || typeof b.onclick !== "function") return;
      const d = api.$(did);
      if (d) d.open = true;
      b.onclick();
      ok(!d || d.open !== true,
         "L6a " + bid + " não fechou " + did + ": a gaveta prende a "
         + "pessoa na tela");
    });
  }

  /* ---- L6b: ligar com a ação no lugar do nome ainda FUNCIONA ----
   * Um botão nunca deve ficar morto por causa da ordem dos argumentos.
   * Sem nome, ele é deduzido do id: pior no log, e vivo na tela. */
  {
    const { api } = rodar();
    let bateu = 0;
    api.leiBotao("btnLeiProcFechar", () => { bateu++; });
    const b = api.$("btnLeiProcFechar");
    ok(b && typeof b.onclick === "function",
       "L6b ligar com dois argumentos deixou o botão sem ação nenhuma");
    if (b && b.onclick) b.onclick();
    ok(bateu === 1,
       "L6c a ação passada como segundo argumento não foi executada: "
       + bateu + " chamada(s)");
  }

  /* ---- L6d: e lixo no lugar da ação é anotado NA LIGAÇÃO ----
   * Erro que espera o clique chega junto com a frustração, e três dias
   * depois de quem o escreveu ter saído do arquivo. */
  {
    const { api } = rodar();
    api.leiBotao("btnLeiProcFechar", "nome qualquer", "isto não é função");
    const b = api.$("btnLeiProcFechar");
    ok(!b || typeof b.onclick !== "function",
       "L6d ligou um onclick que vai estourar no primeiro toque: melhor "
       + "não ligar do que cobrir a tela com um alerta de erro");
    const log = api.leiLogTexto ? api.leiLogTexto() : "";
    ok(/sem ação/.test(log),
       "L6e a ligação quebrada passou calada: ela só apareceria quando "
       + "alguém tocasse no botão: " + log);
  }

  /* ==============================================================
   * L7: O EXERCÍCIO DE TESTAR É UM SÓ — O ARTIGO FECHADO
   *
   * O botão que trocava para "texto com lacunas" saiu: era lento (cada
   * troca repintava todos os artigos, e cada um passava por
   * leiComLacunas) e só escondia informação de pouca serventia. A
   * necessidade de treinar com lacunas passa para a criação de cartões,
   * que precisa continuar tendo as funções de lacuna.
   * ============================================================== */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiTrocarModo("recitar");
    const todos = [];
    const varrer = (el) => { Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); }); };
    varrer(api.$("leiRecitar"));
    ok(!todos.some((x) => /lei-rec-alt/.test(x.className || "")),
       "L7 o botao que trocava para 'texto com lacunas' continua na tela");
    ok(!todos.some((x) => /lei-lac/.test(x.className || "")),
       "L7a ainda ha lacunas desenhadas no modo de testar");
    const nota = Array.from(api.$("leiRecitar").children || []).filter((x) => (x.tag || "") === "p")[0];
    ok(nota && /FECHADO/i.test(nota.textContent || "") && !/LACUNAS/i.test(nota.textContent || ""),
       "L7b a tela nao anuncia so o exercicio de artigo fechado: " + JSON.stringify(nota && nota.textContent));
    ok(!/lacuna/i.test(api.t("lei_aj_recitar_d").split("Para treinar")[0]),
       "L7c a ajuda do modo continua descrevendo o exercicio de lacunas como uma opcao do botao");
    ok(/virar cartões/.test(api.t("lei_aj_recitar_d")),
       "L7d a ajuda nao aponta para onde ficou o treino com lacunas (os cartoes)");
    /* toque no artigo continua revelando o texto (o exercicio em si) */
    const cab = todos.filter((x) => /lei-rec-cab/.test(x.className || ""))[0];
    ok(!!cab && typeof cab.onclick === "function", "L7e o artigo fechado perdeu o toque que revela o texto");
    /* e as funcoes que os cartoes de lacuna usam CONTINUAM existindo */
    ok(typeof api.leiComLacunas === "function" && typeof api.leiQuantasLacunas === "function"
       && api.leiQuantasLacunas("O prazo é de quinze dias, salvo motivo justificado.") > 0,
       "L7f as funcoes de lacuna, usadas pelos cartoes, sumiram junto com o botao");
    /* as chaves de texto do botao removido nao ficam soltas */
    ["lei_rec_lac_off", "lei_rec_lac_on", "lei_rec_modo_lac", "lei_rec_lac_aj", "lei_rec_lac_n", "lei_lac_ajuda"]
      .forEach((k) => ok(api.t(k) === k, "L7g a chave '" + k + "' do botao removido ficou no dicionario"));
  }

  /* ---- L8: os dois botões da fila de leis são coisas diferentes ----
   *
   * "colar outra lei" e "vincular uma das já guardadas" pareciam duas
   * formas de fazer o mesmo. A diferença é ONDE O TEXTO ESTÁ: fora do
   * app, ou já dentro dele noutro tópico. Se as explicações não
   * disserem isso, o usuário cola de novo o que já tinha — e passa a
   * ter duas cópias que divergem na primeira correção. */
  {
    const { api } = rodar();
    const a = api.t("lei_colar_nova_ajuda");
    const b = api.t("lei_vincular_ajuda");
    ok(a !== b && a.length > 80 && b.length > 80,
       "L8 as duas explicações não distinguem os botões");
    ok(/ainda não está|não está no aplicativo|AINDA NÃO/i.test(a),
       "L8a a explicação de colar não diz que é para texto de FORA: " + a);
    ok(/já está|JÁ ESTÁ/i.test(b) && /mesmo texto|MESMO texto/i.test(b),
       "L8b a explicação de vincular não diz que é o MESMO texto, e não "
       + "uma cópia — que é a razão de o botão existir: " + b);
  }

  /* ---- L9: colar a lei não pode ser por um buraco de fechadura ----
   *
   * "#leiTexto" já era "flex:1 1 auto" e mesmo assim ficava com as 14
   * linhas de "rows". Não é bug do textarea: flex-grow reparte ESPAÇO
   * LIVRE, e o diálogo tem max-height sem height — ele encolhe para
   * caber no conteúdo, e no modo editar o conteúdo é a própria caixa.
   * Quem cria o espaço livre é a altura pedida pelo diálogo, e ela só
   * vale no modo editar; por isso a marca é uma CLASSE, e é ela que o
   * teste consegue ver. Sem a classe, a folha de estilo não tem como
   * distinguir os três modos — eles não mudam nenhum atributo do
   * diálogo. */
  {
    const { api } = rodar();
    const dlg = api.$("dlgLeiSeca");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.leiTrocarModo("editar");
    ok(dlg.classList.contains("lei-m-editar"),
       "L9 no modo editar o diálogo não se marca, e a folha de estilo "
       + "não tem como dar altura à caixa de colar");
    /* SABOTAGEM VIVA: se a classe fosse posta e nunca tirada, a leitura
     * herdaria a altura de edição e o teste acima continuaria verde. */
    api.leiTrocarModo("ler");
    ok(!dlg.classList.contains("lei-m-editar"),
       "L9a a marca de edição sobrou depois de voltar para a leitura");
    api.leiTrocarModo("recitar");
    ok(!dlg.classList.contains("lei-m-editar"),
       "L9b a marca de edição aparece no recitar, que não é edição");
  }

  /* ---- L10: o número do artigo não é chave única ----
   *
   * Parece que é, e é em toda lei ordinária. Não é na Constituição: o
   * corpo vai até o art. 250 e o ADCT recomeça do art. 1º. Colada
   * inteira, ela tem dois art. 1º, dois art. 2º, dois de quase tudo.
   *
   * Enquanto o id era só o número, os dois blocos nasciam com o MESMO
   * id — HTML inválido — e getElementById devolve sempre o primeiro. Ir
   * ao art. 1º do ADCT levava ao art. 1º do corpo, em silêncio, e o
   * texto que aparecia era plausível o bastante para ninguém
   * desconfiar. É o mesmo estrago da marca que caía na ocorrência
   * errada, e tem a mesma cura: identificar por POSIÇÃO. */
  {
    const { api } = rodar();
    const FIX = [
      "TÍTULO I", "Dos Princípios Fundamentais",
      "Art. 1º A República constitui-se em Estado Democrático de Direito.",
      "Art. 2º São Poderes da União o Legislativo, o Executivo e o Judiciário.",
      "TÍTULO II", "Das Disposições Transitórias",
      "Art. 1º O Presidente tomará posse no dia 5 de outubro de 1988.",
      "Art. 2º No dia 7 de setembro de 1993 o eleitorado definirá a forma.",
    ].join("\n");
    const ch = api.matChave("Direito Constitucional", "Princípios");
    api.leiGuardar({ id: "lei_cf_t", nome: "CF de teste", texto: FIX });
    api.leiLigar("lei_cf_t", ch);
    api.leiAbrir("Direito Constitucional", "Princípios");

    const blocos = Array.from(api.$("leiLeitura").children || [])
      .filter((x) => /\blei-art\b/.test(String(x.className || "")));
    ok(blocos.length === 4,
       "L10 os quatro artigos não foram desenhados — a repetição de "
       + "numeração entre corpo e ADCT não pode virar deduplicação, que "
       + "esconderia metade da lei · vieram " + blocos.length);

    const ids = blocos.map((x) => String(x.id || ""));
    ok(new Set(ids).size === ids.length,
       "L10a dois artigos nasceram com o MESMO id — getElementById vai "
       + "devolver sempre o primeiro: " + ids.join(", "));
    ok(ids[0] === "leiArt_1" && ids[1] === "leiArt_2",
       "L10b a PRIMEIRA ocorrência perdeu o id pelo número, e com ele a "
       + "citação da questão e o 'onde parei', que só têm o número: "
       + ids.join(", "));
    ok(ids[2] === "leiArtI_2" && ids[3] === "leiArtI_3",
       "L10c a ocorrência repetida não recebeu id por posição: "
       + ids.join(", "));
  }

  /* ---- L11: "CONTINUAR" ACERTA A OCORRÊNCIA CERTA, MESMO QUANDO O
   * PRÓXIMO ARTIGO REPETE NÚMERO COM OUTRO LÁ ATRÁS ----
   *
   * "continuar" usa arts[lidos] — uma POSIÇÃO, não uma busca por
   * número — e por isso já sabe exatamente qual ocorrência é a certa.
   * O que faltava era leiIrArtigo RECEBER essa posição: sem o índice,
   * "continuar do art. 2º do título I para o art. 1º do título II"
   * chamava leiIrArtigo só com "1" — que sempre resolve para a
   * PRIMEIRA ocorrência (a do título I), voltando para trás em vez de
   * andar para a frente. (A "parei em X" — marcada por número, sem
   * posição — continua com a mesma ambiguidade de sempre; consertá-la
   * pede guardar a ocorrência no próprio marcador, mudança maior que
   * fica para outra hora.)
   * ============================================================== */
  {
    const { api } = rodar();
    const FIX = [
      "TÍTULO I", "Dos Princípios Fundamentais",
      "Art. 1º A República constitui-se em Estado Democrático de Direito.",
      "Art. 2º São Poderes da União o Legislativo, o Executivo e o Judiciário.",
      "TÍTULO II", "Das Disposições Transitórias",
      "Art. 1º O Presidente tomará posse no dia 5 de outubro de 1988.",
      "Art. 2º No dia 7 de setembro de 1993 o eleitorado definirá a forma.",
    ].join("\n");
    const ch = api.matChave("Direito Constitucional", "Princípios L11");
    api.leiGuardar({ id: "lei_cf_t2", nome: "CF de teste 2", texto: FIX });
    api.leiLigar("lei_cf_t2", ch);
    api.leiAbrir("Direito Constitucional", "Princípios L11");

    /* "parei" no Art. 2º do TÍTULO I (índice 1) — a ÚNICA ocorrência de
     * "2" até aqui, sem ambiguidade nenhuma para achar. O próximo
     * (arts[2]) é o Art. 1º do TÍTULO II: mesmo número do primeiro
     * artigo da lei inteira, índice bem diferente. */
    api.leiGuardar({ id: "lei_cf_t2", parei: "2" });
    const p = api.leiProgresso("lei_cf_t2");
    ok(!!p.proximo && p.proximo.num === "1" && p.proximo.indice === 2,
       "L11-pre o próximo depois do art. 2º do título I devia ser o "
       + "art. 1º do título II (índice 2): " + JSON.stringify(p.proximo));

    api.leiPintar();
    const bCont = api.$("leiOnde").querySelectorAll("button")
      .filter((b) => /continuar/i.test(b.textContent))[0];
    ok(!!bCont, "L11a o botão 'continuar' não apareceu");

    bCont.onclick();
    ok(api.$("leiArtI_2")._rolouAte === true,
       "L11b 'continuar' não foi para o Art. 1º do título II (a "
       + "ocorrência de verdade seguinte) — sem o índice, um número que "
       + "se repete manda de volta para a primeira ocorrência dele");
    ok(!api.$("leiArt_1")._rolouAte,
       "L11c 'continuar' voltou para o Art. 1º do título I em vez de "
       + "andar para a frente, até o do título II");
  }

  /* ---- L12: A ROLAGEM MIRA O COMEÇO DO ARTIGO, NÃO O MEIO ----
   *
   * "block:center" num artigo mais alto que a tela mostra o MEIO do
   * bloco — sem o cabeçalho "Art. X" na tela, ninguém sabe aonde
   * chegou. O simulador de testes não mede pixel nem faz scroll de
   * verdade, então a prova aqui é no código-fonte: quem lê "ir a um
   * artigo" tem de pedir "start", não "center". ---- */
  {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "docs", "lei-ui.js"), "utf8");
    const fn = (src.match(/function leiIrArtigo[\s\S]*?\n\}/) || [""])[0];
    ok(/block:\s*["']start["']/.test(fn),
       "L12 leiIrArtigo não rola para o início do artigo (\"start\") — "
       + "um artigo mais alto que a tela mostraria o meio do bloco, sem "
       + "o cabeçalho à vista");
    ok(!/block:\s*["']center["']/.test(fn),
       "L12b leiIrArtigo ainda centraliza o artigo: um bloco mais alto "
       + "que a tela esconde o cabeçalho acima da dobra");
  }

  /* =================================================================
   * G: ABRIR UMA LEI GRANDE — andamento à vista, sem congelar a tela
   *
   * POR QUE ISTO EXISTE. Tocar no link de uma lei de 424 artigos deixava
   * a tela parada por segundos: o diálogo só abria no FIM de leiAbrir, e
   * a thread ocupada não deixa o navegador desenhar nada (medido: 717 ms
   * parados no computador, 65% deles em leiNotaDe relendo a biblioteca
   * inteira uma vez por artigo). Agora: o diálogo abre primeiro, com um
   * painel de andamento; os artigos entram em pedaços, na ordem do
   * documento; lei pequena continua síncrona.
   * =============================================================== */
  const leiGrande = (nArts) => {
    const L = [];
    for (let i = 1; i <= nArts; i++) {
      L.push("Art. " + i + "º Texto do artigo " + i + ", nos termos do art. "
        + (i + 1) + " desta lei.");
    }
    return L.join("\n");
  };
  const cedeTudo = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  /* fatia de desenho zerada: cada quadro desenha UM artigo, então o
   * desenho cede muitas vezes e dá para olhar o meio do caminho. (Não se
   * mexe em performance.now: os testes rodam juntos e o relógio é de todos) */
  const comRelogioLento = async (api, fn) => {
    api.leiFatiaDefinir(0);
    return fn();
  };
  const arvore = (api) => (api.$("leiLeitura").children || [])
    .filter((c) => /lei-art\b|lei-div/.test(c.className || ""))
    .map((c) => c.id + "|" + c.className + "|" + c.textContent);
  const nArtsNaTela = (api) => (api.$("leiLeitura").children || [])
    .filter((c) => /(^|\s)lei-art(\s|$)/.test(c.className || "")).length;

  /* ---- G1: lei pequena continua síncrona (nada de painel, nada adiado) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2000", texto: leiGrande(8) });
    api.leiAbrir("Direito", "T", l.id);
    ok(nArtsNaTela(api) === 8,
       "G1 lei pequena deixou de ser desenhada na hora: " + nArtsNaTela(api) + " de 8");
    ok(api.$("leiCarga").hidden === true, "G1a lei pequena mostrou o painel de andamento");
    ok(api.$("dlgLeiSeca").open === true, "G1b o dialogo nao abriu");
  }

  /* ---- G2: lei grande — o dialogo abre PRIMEIRO, com o painel; depois entram os artigos ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 1/2000", texto: leiGrande(150) });
    api.leiAbrir("Direito", "T", l.id);
    ok(api.$("dlgLeiSeca").open === true, "G2 o dialogo so abre depois de desenhar tudo (a tela fica parada)");
    ok(api.$("leiCarga").hidden === false,
       "G2a nao ha painel de andamento enquanto a lei grande carrega");
    ok(/Lei Grande 1\/2000/.test(api.$("leiCargaTxt").textContent || ""),
       "G2b o painel nao diz qual lei esta abrindo: " + api.$("leiCargaTxt").textContent);
    ok(nArtsNaTela(api) < 150,
       "G2c a lei grande foi desenhada inteira ANTES de devolver o controle: " + nArtsNaTela(api));
    await api.leiPinturaPronta();
    ok(nArtsNaTela(api) === 150,
       "G2d ao final a lei nao esta inteira na tela: " + nArtsNaTela(api) + " de 150");
    ok(api.$("leiCarga").hidden === true, "G2e o painel de andamento nao sumiu ao terminar");
  }

  /* ---- G3: o andamento ANDA, e diz a verdade ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 2/2000", texto: leiGrande(150) });
    await comRelogioLento(api, async () => {
      api.leiAbrir("Direito", "T", l.id);
      const vistos = [];
      for (let i = 0; i < 3000; i++) {
        await Promise.resolve();
        const feitos = nArtsNaTela(api);
        const txt = api.$("leiCargaTxt").textContent || "";
        if (feitos > 0 && feitos < 150 && !api.$("leiCarga").hidden) vistos.push({ feitos, txt });
        if (api.$("leiCarga").hidden && feitos === 150) break;
      }
      const distintos = new Set(vistos.map((v) => v.feitos)).size;
      ok(distintos >= 3,
         "G3 o desenho nao foi em pedacos (ou nao cedeu a vez): so " + distintos + " estados intermediarios");
      ok(vistos.every((v) => new RegExp("\\b" + v.feitos + " de 150").test(v.txt)),
         "G3a o texto do painel nao acompanha o que esta na tela: "
         + JSON.stringify(vistos.slice(0, 2)));
      const largs = vistos.map((v) => parseInt(v.txt.replace(/\D+/, ""), 10));
      ok(largs.every((x, i) => i === 0 || x >= largs[i - 1]),
         "G3b o andamento andou para tras");
    });
    await api.leiPinturaPronta();
  }

  /* ---- G4: o resultado é IDÊNTICO ao da pintura síncrona (ordem e conteúdo) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 3/2000", texto: leiGrande(150) });
    await comRelogioLento(api, async () => {
      api.leiAbrir("Direito", "T", l.id);
      await api.leiPinturaPronta();
    });
    const emPedacos = arvore(api);
    api.leiCacheLimpar();                  /* sem cache: o desenho sincrono tem de sair do zero */
    api.leiPintar();                       /* pintura síncrona, do zero */
    const sincrona = arvore(api);
    ok(emPedacos.length === 150 && sincrona.length === 150,
       "G4-pre esperava 150 blocos: " + emPedacos.length + "/" + sincrona.length);
    ok(JSON.stringify(emPedacos) === JSON.stringify(sincrona),
       "G4 desenhar em pedacos mudou a ordem ou o conteudo (as marcas contam a "
       + "ocorrencia desde o inicio do painel: fora de ordem cairiam no lugar errado)");
  }

  /* ---- G5: fechar o dialogo no meio CANCELA o desenho ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 4/2000", texto: leiGrande(150) });
    await comRelogioLento(api, async () => {
      api.leiAbrir("Direito", "T", l.id);
      for (let i = 0; i < 400 && nArtsNaTela(api) < 20; i++) await Promise.resolve();
      const antes = nArtsNaTela(api);
      api.$("dlgLeiSeca").close();
      await api.leiPinturaPronta();
      await cedeTudo();
      ok(antes > 0 && antes < 150 && nArtsNaTela(api) <= antes + 40,
         "G5 fechar o dialogo nao interrompeu o desenho: " + antes + " -> " + nArtsNaTela(api));
      ok(nArtsNaTela(api) < 150, "G5a a lei continuou sendo desenhada com o dialogo fechado");
      ok(api.$("leiCarga").hidden === true, "G5b o painel ficou preso na tela apos fechar");
    });
  }

  /* ---- G6: repintar durante o carregamento refaz tudo na hora (e nao duplica) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 5/2000", texto: leiGrande(150) });
    await comRelogioLento(api, async () => {
      api.leiAbrir("Direito", "T", l.id);
      for (let i = 0; i < 400 && nArtsNaTela(api) < 10; i++) await Promise.resolve();
      api.leiPintar();                     /* ex.: marcar um trecho no meio do carregamento */
      ok(nArtsNaTela(api) === 150,
         "G6 repintar no meio deixou a lei incompleta: " + nArtsNaTela(api));
      ok(api.$("leiCarga").hidden === true, "G6a o painel continuou depois da repintura completa");
      await cedeTudo();
      ok(nArtsNaTela(api) === 150,
         "G6b a pintura antiga continuou escrevendo por cima (duplicou): " + nArtsNaTela(api));
    });
  }

  /* ---- G7: a citação de outra tela vai ao artigo assim que o pedaço dele entra ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 6/2000", texto: leiGrande(150) });
    let achou, inexistente;
    await comRelogioLento(api, async () => {
      achou = api.leiAbrirNoArtigo("Direito", "T", l.id, "120");
      ok(achou === true,
         "G7 artigo que existe foi dado como inexistente so porque ainda nao estava na tela");
      ok(!api.$("leiArt_120"), "G7-pre o artigo ja estava na tela: o teste nao mede nada");
      for (let i = 0; i < 6000 && !api.$("leiArt_120"); i++) await Promise.resolve();
      await Promise.resolve();
      /* o "pisca" do artigo se apaga por setTimeout (no simulador, na hora):
       * a prova de que foi ao artigo e' o registro, que diz quantos ja
       * estavam na tela — e tem de ser MENOS que a lei inteira */
      const m = /art\. 120 · (\d+) de 150 artigos/.exec(api.leiLogTexto() || "");
      ok(!!m && Number(m[1]) < 150 && Number(m[1]) >= 120,
         "G7a a lei nao foi ao artigo pedido assim que ele entrou na tela: "
         + (m ? m[0] : "sem registro"));
      await api.leiPinturaPronta();
    });
    const { api: b } = rodar();
    b.matIniciar(); b.leiIniciar();
    const l2 = b.leiGuardar({ nome: "Lei Grande 7/2000", texto: leiGrande(150) });
    inexistente = b.leiAbrirNoArtigo("Direito", "T", l2.id, "999");
    ok(inexistente === false,
       "G7b artigo que nao existe na lei foi dado como achado (a questao dira que foi aberto)");
    await b.leiPinturaPronta();
    ok(nArtsNaTela(b) === 150, "G7c a lei nao abriu inteira quando o artigo pedido nao existe");
  }

  /* ---- G8: a biblioteca não é relida uma vez por artigo ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 8/2000", texto: leiGrande(200) });
    api.leiNotaGuardar(l.id, "5", "nota do cinco");
    let leituras = 0;
    const gi = api.loja.getItem;
    api.loja.getItem = (k) => { if (k === "eac_leis") leituras++; return gi(k); };
    api.leiAbrir("Direito", "T", l.id);
    await api.leiPinturaPronta();
    api.loja.getItem = gi;
    ok(nArtsNaTela(api) === 200, "G8-pre a lei nao abriu inteira: " + nArtsNaTela(api));
    /* antes eram ~2N+15 (mais de 400 para 200 artigos); agora e' um numero
     * pequeno e que NAO cresce com o tamanho da lei */
    ok(leituras > 0 && leituras <= 40,
       "G8 a abertura reler a biblioteca inteira " + leituras + " vezes (uma por artigo?)");
    /* e a nota continua chegando ao artigo certo */
    const bloco = api.$("leiArt_5");
    ok(!!bloco && /lei-art-b-nota/.test(bloco.innerHTML || bloco.textContent || "")
       || (bloco && (bloco.querySelectorAll(".lei-art-b-nota") || []).length === 1),
       "G8a a nota do artigo 5 nao apareceu no leitor");
    ok(api.leiNotaDeEm(api.leiDe(l.id), "5") === "nota do cinco"
       && api.leiNotaDe(l.id, "5") === "nota do cinco"
       && api.leiNotaDeEm(null, "5") === "" && api.leiNotaTrechoDeEm(null, "x") === null,
       "G8b leiNotaDeEm e leiNotaDe discordam (ou nao tratam lei ausente)");
  }

  /* ---- G9: uma pintura só por abertura ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei 2/2000", texto: leiGrande(8) });
    let limpezas = 0;
    const cx = api.$("leiLeitura");
    const d = Object.getOwnPropertyDescriptor(cx, "innerHTML");
    if (d && d.configurable && d.set) {
      Object.defineProperty(cx, "innerHTML", {
        configurable: true, enumerable: true, get: d.get,
        set(v) { if (v === "") limpezas++; d.set.call(this, v); },
      });
      api.leiAbrir("Direito", "T", l.id);
      ok(limpezas === 1,
         "G9 abrir uma lei pintou a leitura " + limpezas + " vezes (era 2: uma no trocar-modo, outra no pintar)");
    } else {
      ok(false, "G9-pre nao consegui espionar o innerHTML da leitura no simulador");
    }
  }

  /* ---- G10: as marcas de nota (uma por artigo) tampouco relem a biblioteca ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const L = [];
    for (let i = 1; i <= 100; i++) L.push("Art. " + i + "º O prazo ==@marca " + i + "== e' de dez dias.");
    const l = api.leiGuardar({ nome: "Lei Grande 9/2000", texto: L.join("\n") });
    api.leiNotaTrechoGuardar(l.id, "marca 3", "anotacao da marca tres");
    let leituras = 0;
    const gi = api.loja.getItem;
    api.loja.getItem = (k) => { if (k === "eac_leis") leituras++; return gi(k); };
    api.leiAbrir("Direito", "T", l.id);
    await api.leiPinturaPronta();
    api.loja.getItem = gi;
    ok(nArtsNaTela(api) === 100, "G10-pre a lei nao abriu inteira: " + nArtsNaTela(api));
    ok(leituras > 0 && leituras <= 40,
       "G10 as notas de trecho releram a biblioteca " + leituras + " vezes (uma por marca?)");
    const m3 = (api.$("leiArt_3").querySelectorAll(".m-nota") || [])[0];
    ok(!m3 || m3.title === "anotacao da marca tres",
       "G10a a nota do trecho nao chegou como dica da marca: " + (m3 && m3.title));
  }

  /* ---- G11: pedir "ler" logo após abrir (o caminho da questão) não refaz tudo de uma vez ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Grande 10/2000", texto: leiGrande(150) });
    api.leiAbrir("Direito", "T", l.id);
    api.leiTrocarModo("ler");
    ok(nArtsNaTela(api) < 150 && api.$("leiCarga").hidden === false,
       "G11 leiTrocarModo('ler') logo apos abrir jogou fora o desenho em andamento e "
       + "refez a lei inteira de uma vez (a tela volta a congelar): " + nArtsNaTela(api));
    await api.leiPinturaPronta();
    ok(nArtsNaTela(api) === 150, "G11a a lei nao terminou de entrar: " + nArtsNaTela(api));
    /* e trocar de modo DEPOIS de pronta continua repintando na hora */
    api.leiTrocarModo("editar");
    api.leiTrocarModo("ler");
    ok(nArtsNaTela(api) === 150 && api.$("leiCarga").hidden === true,
       "G11b voltar ao modo ler depois de pronta nao repintou a lei: " + nArtsNaTela(api));
  }

  /* ---- G12: abrir outra lei no meio do carregamento troca o painel, sem misturar ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const a = api.leiGuardar({ nome: "Lei A 1/2000", texto: leiGrande(150) });
    const b = api.leiGuardar({ nome: "Lei B 2/2000",
      texto: leiGrande(120).replace(/Texto do artigo/g, "Redacao da B") });
    api.leiAbrir("Direito", "T", a.id);
    api.leiAbrir("Direito", "T", b.id);
    await api.leiPinturaPronta();
    await cedeTudo();
    ok(nArtsNaTela(api) === 120,
       "G12 abrir outra lei no meio deixou artigos da anterior ou faltou da nova: " + nArtsNaTela(api));
    ok(/Redacao da B/.test(api.$("leiLeitura").textContent || "")
       && !/Texto do artigo/.test(api.$("leiLeitura").textContent || ""),
       "G12a o painel mistura texto das duas leis");
    ok(api.$("leiCarga").hidden === true, "G12b o painel de andamento ficou preso");
  }

  /* =================================================================
   * C: O DESENHO PRONTO DA LEI GRANDE FICA GUARDADO (e o navegador só
   *    desenha o que está na tela)
   *
   * POR QUE ISTO EXISTE. Medido na CF sintética (424 artigos), depois da
   * 16.26.0: reabrir ou repintar ainda levava ~150 ms, quase todos de
   * LAYOUT de 5,6 mil nós — não de montá-los. Duas peças: o cache dos
   * nós já montados (pula o desenho) e content-visibility (pula o layout
   * do que está fora da tela). Cache errado serviria "parei aqui", nota
   * ou marca velha; content-visibility errado faria o salto ao artigo
   * cair dez artigos antes do pedido.
   * =============================================================== */
  const primeiroNo = (api) => (api.$("leiLeitura").children || [])
    .filter((c) => /(^|\s)lei-art(\s|$)/.test(c.className || ""))[0];
  const abrirGrande = async (api, id) => {
    api.leiAbrir("Direito", "T", id);
    await api.leiPinturaPronta();
  };

  /* ---- C1: reabrir a mesma lei reaproveita os MESMOS nós (não desenha de novo) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 1/2000", texto: leiGrande(150) });
    await abrirGrande(api, l.id);
    const no1 = primeiroNo(api);
    ok(api.leiCacheTamanho() === 1, "C1-pre a lei grande desenhada nao foi guardada: " + api.leiCacheTamanho());
    api.$("dlgLeiSeca").close();
    await abrirGrande(api, l.id);
    ok(primeiroNo(api) === no1 && nArtsNaTela(api) === 150,
       "C1 reabrir a mesma lei redesenhou tudo em vez de reaproveitar os nos");
    ok(api.$("leiCarga").hidden === true, "C1a a reabertura pelo cache deixou o painel de andamento");
    /* e o que veio do cache continua FUNCIONANDO: clicar no numero marca "parei" */
    const bt = (api.$("leiArt_3").querySelectorAll(".lei-art-num") || [])[0];
    ok(!!bt && typeof bt.onclick === "function", "C1b o botao do artigo perdeu o clique ao vir do cache");
    bt.onclick();
    ok(api.leiDe(l.id).parei === "3", "C1c o clique no numero (vindo do cache) nao marcou 'parei': " + api.leiDe(l.id).parei);
  }

  /* ---- C2: mudou o texto, o desenho é refeito ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 2/2000", texto: leiGrande(150) });
    await abrirGrande(api, l.id);
    const no1 = primeiroNo(api);
    api.$("dlgLeiSeca").close();
    api.leiGuardar({ id: l.id, texto: leiGrande(150) + "\nArt. 151º Artigo novo." });
    await abrirGrande(api, l.id);
    ok(primeiroNo(api) !== no1 && nArtsNaTela(api) === 151,
       "C2 o texto mudou e a lei reabriu com o desenho velho: " + nArtsNaTela(api) + " artigos");
  }

  /* ---- C3: "parei aqui" mudou, o desenho é refeito (e mostra o marcador certo) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 3/2000", texto: leiGrande(150) });
    await abrirGrande(api, l.id);
    api.$("dlgLeiSeca").close();
    api.leiParar(l.id, "7");
    await abrirGrande(api, l.id);
    ok(/lei-art-parei/.test((api.$("leiArt_7") || {}).className || ""),
       "C3 o 'parei aqui' mudou e a lei reabriu sem o marcador novo (cache servido velho)");
  }

  /* ---- C4: nota de artigo e nota de trecho mudaram ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const L = [];
    for (let i = 1; i <= 100; i++) L.push("Art. " + i + "º O prazo ==@marca " + i + "== e' de dez dias.");
    const l = api.leiGuardar({ nome: "Lei Cache 4/2000", texto: L.join("\n") });
    await abrirGrande(api, l.id);
    api.$("dlgLeiSeca").close();
    api.leiNotaGuardar(l.id, "5", "nota nova do cinco");
    api.leiNotaTrechoGuardar(l.id, "marca 3", "anotacao nova da marca tres");
    await abrirGrande(api, l.id);
    ok(/lei-art-b-nota/.test((api.$("leiArt_5").querySelectorAll(".lei-art-b-nota") || []).length ? "lei-art-b-nota" : ""),
       "C4 a nota de artigo mudou e o desenho velho foi servido");
    const m3 = (api.$("leiArt_3").querySelectorAll(".m-nota") || [])[0];
    ok(!m3 || m3.title === "anotacao nova da marca tres",
       "C4a a nota de trecho mudou e o desenho velho foi servido: " + (m3 && m3.title));
  }

  /* ---- C5: a chave cobre TUDO de que o desenho depende ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 5/2000", texto: leiGrande(80) });
    const reg = api.leiDe(l.id);
    const k = (o) => api.leiChavePintura(o.l || reg, o.bruto === undefined ? reg.texto : o.bruto, o.rank || {});
    const base = k({});
    ok(k({}) === base, "C5-pre a chave nao e' estavel");
    ok(k({ bruto: reg.texto + " x" }) !== base, "C5 texto diferente, mesma chave");
    ok(k({ l: Object.assign({}, reg, { parei: "9" }) }) !== base, "C5a 'parei' diferente, mesma chave");
    ok(k({ l: Object.assign({}, reg, { notasArtigos: { 1: "x" } }) }) !== base, "C5b nota diferente, mesma chave");
    ok(k({ l: Object.assign({}, reg, { alteracoes: { 1: { texto: "novo" } } }) }) !== base,
       "C5c alteracao diferente, mesma chave");
    ok(k({ rank: { 4: { num: "4", erros: 3, acertos: 1 } } }) !== base, "C5d ranking diferente, mesma chave");
    ok(api.leiChavePintura(Object.assign({}, reg, { texto: "outro texto qualquer" }), reg.texto, {}) === base,
       "C5e o texto GRAVADO entrou na chave (o que vale e' o texto do painel, que tem as marcas nao gravadas)");
    ok(api.leiHashTexto("abc") !== api.leiHashTexto("abd") && api.leiHashTexto("ab") !== api.leiHashTexto("abb"),
       "C5f o hash confunde textos proximos");
  }

  /* ---- C6: só lei grande, só duas, uma entrada por lei ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const peq = api.leiGuardar({ nome: "Lei Peq 1/2000", texto: leiGrande(8) });
    api.leiAbrir("Direito", "T", peq.id);
    ok(api.leiCacheTamanho() === 0, "C6 lei pequena entrou no cache");
    api.$("dlgLeiSeca").close();
    const ids = [];
    for (let i = 1; i <= 3; i++) {
      const g = api.leiGuardar({ nome: "Lei Grande C" + i + "/2000", texto: leiGrande(100 + i) });
      ids.push(g.id);
      await abrirGrande(api, g.id);
      api.$("dlgLeiSeca").close();
    }
    ok(api.leiCacheTamanho() === 2, "C6a o cache passou do limite de duas leis: " + api.leiCacheTamanho());
    ok(api.leiCacheIds().indexOf(ids[0]) < 0 && api.leiCacheIds().indexOf(ids[2]) >= 0,
       "C6b saiu a lei errada (deve sair a menos recente): " + JSON.stringify(api.leiCacheIds()));
    /* uma versao nova da MESMA lei substitui a velha, nao soma */
    api.leiGuardar({ id: ids[2], texto: leiGrande(103) + "\nArt. 104º Novo." });
    await abrirGrande(api, ids[2]);
    ok(api.leiCacheIds().filter((x) => x === ids[2]).length === 1, "C6c a mesma lei ficou duas vezes no cache");
  }

  /* ---- C7: interromper o desenho NÃO guarda uma lei pela metade ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 7/2000", texto: leiGrande(150) });
    api.leiFatiaDefinir(0);
    api.leiAbrir("Direito", "T", l.id);
    for (let i = 0; i < 400 && nArtsNaTela(api) < 20; i++) await Promise.resolve();
    api.$("dlgLeiSeca").close();
    await api.leiPinturaPronta();
    await cedeTudo();
    ok(api.leiCacheTamanho() === 0,
       "C7 uma lei desenhada so ate a metade foi guardada no cache: " + api.leiCacheTamanho());
  }

  /* ---- C8: trocar de modo e voltar (sem mudar nada) não redesenha ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 8/2000", texto: leiGrande(150) });
    await abrirGrande(api, l.id);
    const no1 = primeiroNo(api);
    api.leiTrocarModo("editar");
    api.leiTrocarModo("ler");
    ok(primeiroNo(api) === no1 && nArtsNaTela(api) === 150,
       "C8 ler -> editar -> ler redesenhou a lei inteira");
  }

  /* ---- C9: a citação de outra tela vai ao artigo mesmo quando a lei vem do cache ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 9/2000", texto: leiGrande(150) });
    await abrirGrande(api, l.id);
    api.$("dlgLeiSeca").close();
    const achou = api.leiAbrirNoArtigo("Direito", "T", l.id, "120");
    ok(achou === true, "C9 artigo existente foi dado como inexistente ao reabrir pelo cache");
    ok(/art\. 120/.test(api.leiLogTexto() || "") || nArtsNaTela(api) === 150,
       "C9a a lei nao reabriu inteira pelo cache");
    ok(api.leiAbrirNoArtigo("Direito", "T", l.id, "999") === false,
       "C9b artigo inexistente foi dado como achado ao reabrir pelo cache");
  }

  /* ---- C10: só o painel de lei grande ganha content-visibility ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const peq = api.leiGuardar({ nome: "Lei Peq 2/2000", texto: leiGrande(8) });
    api.leiAbrir("Direito", "T", peq.id);
    ok(!/lei-cv/.test(api.$("leiLeitura").className || ""), "C10 painel de lei pequena ganhou 'lei-cv'");
    api.$("dlgLeiSeca").close();
    const g = api.leiGuardar({ nome: "Lei Grande CV/2000", texto: leiGrande(120) });
    await abrirGrande(api, g.id);
    ok(/lei-cv/.test(api.$("leiLeitura").className || ""), "C10a painel de lei grande sem 'lei-cv'");
    api.$("dlgLeiSeca").close();
    api.leiAbrir("Direito", "T", peq.id);
    ok(!/lei-cv/.test(api.$("leiLeitura").className || ""),
       "C10b o 'lei-cv' ficou no painel depois de abrir uma lei pequena");
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/\.lei-cv \.lei-art\{[^}]*content-visibility:auto/.test(html),
       "C10c o CSS de content-visibility nao esta escopado em .lei-cv");
    ok(!/(?<!\.lei-cv )\.lei-art\{[^}]*content-visibility/.test(html), "C10d content-visibility esta no .lei-art de TODA lei");
    /* paint containment recorta o contorno para fora da caixa: o pisca desenha para dentro */
    ok(/\.lei-art-pisca\{[^}]*outline-offset:-\d/.test(html),
       "C10e o contorno do 'pisca' desenha para fora e sera recortado pelo content-visibility");
  }

  /* ---- C11: em lei grande o salto e' instantaneo e dado duas vezes; em lei pequena, um salto suave ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const g = api.leiGuardar({ nome: "Lei Grande J/2000", texto: leiGrande(120) });
    await abrirGrande(api, g.id);
    const chamadas = [];
    api.$("leiArt_50").scrollIntoView = (o) => { chamadas.push(o && o.behavior); };
    api.leiIrArtigo("50");
    ok(chamadas.length === 2 && chamadas.every((b) => b === "auto"),
       "C11 em lei grande o salto devia ser instantaneo e repetido: " + JSON.stringify(chamadas));
    api.$("dlgLeiSeca").close();
    const peq = api.leiGuardar({ nome: "Lei Peq 3/2000", texto: leiGrande(8) });
    api.leiAbrir("Direito", "T", peq.id);
    const c2 = [];
    api.$("leiArt_5").scrollIntoView = (o) => { c2.push(o && o.behavior); };
    api.leiIrArtigo("5");
    ok(c2.length === 1 && c2[0] === "smooth", "C11a em lei pequena o salto devia continuar suave e unico: " + JSON.stringify(c2));
  }

  /* ---- C12: o desenho SINCRONO de lei grande (depois de mudar algo) tambem e' guardado ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei Cache 12/2000", texto: leiGrande(150) });
    await abrirGrande(api, l.id);
    api.leiParar(l.id, "7");
    api.leiPintar();                       /* repintura sincrona, com a lei mudada: nao ha entrada igual */
    ok(/lei-art-parei/.test((api.$("leiArt_7") || {}).className || ""), "C12-pre a repintura nao mostrou o marcador");
    const no1 = primeiroNo(api);
    api.leiTrocarModo("editar");
    api.leiTrocarModo("ler");
    ok(primeiroNo(api) === no1 && nArtsNaTela(api) === 150,
       "C12 o desenho sincrono nao foi guardado: voltar ao modo ler redesenhou tudo");
  }

  /* =================================================================
   * DU: ARTIGOS REPETIDOS NO TEXTO COLADO — a pessoa escolhe qual fica
   *
   * POR QUE ISTO EXISTE. O Código Tributário de Caruaru, copiado do PDF,
   * traz o "Art. 3º" antigo (tachado — e o tachado se perde ao copiar) e o
   * novo, com "(Redação dada pela LC nº 018…)". A colagem guardava os dois
   * sem aviso; "ir ao art. 3º" e a prévia de citação caíam no PRIMEIRO,
   * justamente o substituído; e a atualização de versão comparava por
   * número deixando a última ocorrência ganhar em silêncio.
   * =============================================================== */
  const CARUARU = [
    "LEI COMPLEMENTAR 015, DE 05 DE JANEIRO DE 2009",
    "DAS DISPOSIÇÕES PRELIMINARES",
    "Art. 1º. Este Código regula os direitos e obrigações que emanam das relações jurídicas.",
    "Art. 2º. O Código é constituído de 4 (quatro) Livros, com a matéria, assim distribuída:",
    "Art. 3º O Código Tributário Municipal é subordinado:",
    "I - à Constituição Federal;",
    "II - ao Código Tributário Nacional e demais Leis Complementares da União;",
    "III – à Lei Orgânica do Município de Caruaru.",
    "Art. 3º. Compreendem o Sistema de Normas Tributárias do Município de Caruaru os princípios e as normas gerais estabelecidas pela Constituição Federal. (Redação dada pela Lei Complementar nº 018, de 09 de outubro de 2009)",
    "Art. 4º. Outro artigo comum, sem repetição.",
  ].join("\n");
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const radios = (api, num) => achar(api.$("leiDupLista"), (c) => c.type === "radio" && c.name === "leiDup_" + num);
  const gruposTela = (api) => Array.from(api.$("leiDupLista").children || []).filter((c) => /lei-dup-grupo/.test(c.className || ""));

  /* ---- DU1: detecta o caso real e sugere a redação nova, com o motivo ---- */
  {
    const { api } = rodar();
    const g = api.leiDuplicados(CARUARU);
    ok(g.length === 1 && g[0].num === "3" && g[0].candidatos.length === 2,
       "DU1 nao achou o Art. 3o repetido: " + JSON.stringify(g.map((x) => x.num)));
    ok(g[0].confianca === "forte" && g[0].motivo === "redacao" && g[0].sugerido === g[0].candidatos[1].indice,
       "DU1a nao sugeriu a redacao nova como segura: " + JSON.stringify([g[0].confianca, g[0].motivo, g[0].sugerido]));
    ok(/Lei Complementar nº 018, de 09 de outubro de 2009/.test(g[0].fonte),
       "DU1b nao leu a fonte da alteracao: " + g[0].fonte);
    ok(g[0].candidatos[0].sinais.tipo === "" && g[0].candidatos[1].sinais.tipo === "redacao",
       "DU1c os sinais de cada ocorrencia estao errados");
  }

  /* ---- DU2: o que NÃO é defeito não é apontado ---- */
  {
    const { api } = rodar();
    /* corpo e ADCT repetem numeros de proposito (divisoes e posicoes diferentes) */
    const CF = ["TÍTULO I", "Dos princípios", "Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Tres.",
      "TÍTULO II", "Dos direitos", "Art. 4º Quatro.", "Art. 5º Cinco.",
      "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS",
      "Art. 1º Um do ADCT.", "Art. 2º Dois do ADCT.", "Art. 5º Cinco do ADCT."].join("\n");
    ok(api.leiDuplicados(CF).length === 0,
       "DU2 corpo e ADCT (divisoes diferentes) foram apontados como repetidos: "
       + JSON.stringify(api.leiDuplicados(CF).map((x) => x.num)));
    ok(api.leiDuplicados("Art. 3º Um.\nArt. 3º-A Dois.\nArt. 4º Tres.").length === 0,
       "DU2a 3o e 3o-A foram tomados como o mesmo artigo");
    ok(api.leiDuplicados("Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres.").length === 0,
       "DU2b lei sem repeticao foi apontada");
  }

  /* ---- DU3: a sugestão segue o que o TEXTO diz, na ordem em que estiver ---- */
  {
    const { api } = rodar();
    const antes = api.leiDuplicados("Art. 4º (Revogado pela LC 9/2010)\nArt. 4º Texto que vale hoje para o contribuinte.")[0];
    ok(antes.confianca === "forte" && antes.motivo === "revogado" && antes.sugerido === antes.candidatos[1].indice,
       "DU3 o revogado vem primeiro e a sugestao nao e' a segunda: " + JSON.stringify([antes.confianca, antes.motivo]));
    const invertido = api.leiDuplicados("Art. 4º Texto que vale hoje para o contribuinte.\nArt. 4º (Revogado pela LC 9/2010)")[0];
    ok(invertido.sugerido === invertido.candidatos[0].indice && invertido.confianca === "forte",
       "DU3a o revogado vem DEPOIS e a sugestao nao acompanhou o texto (nao pode ser 'a ultima ganha')");
    const nova = api.leiDuplicados("Art. 5º Texto novo mesmo.\n(Redação dada pela LC 1/2001)\nArt. 5º Texto antigo mesmo.")[0];
    ok(nova === undefined || nova.candidatos.length === 2, "DU3b-pre forma inesperada");
    const igual = api.leiDuplicados("Art. 6º Mesmo texto exato aqui.\nArt. 6º Mesmo   texto exato aqui.")[0];
    ok(igual.confianca === "forte" && igual.motivo === "identico" && igual.sugerido === igual.candidatos[0].indice,
       "DU3c duas copias identicas nao foram tratadas como copia: " + JSON.stringify([igual.confianca, igual.motivo]));
    const fraca = api.leiDuplicados("Art. 7º Uma redacao de um jeito.\nArt. 7º Outra redacao bem diferente.")[0];
    ok(fraca.confianca === "fraca" && fraca.motivo === "posicao",
       "DU3d sem nenhum indicio a sugestao devia ser fraca: " + JSON.stringify([fraca.confianca, fraca.motivo]));
    const vazio = api.leiDuplicados("Art. 8º\nArt. 8º Texto completo do artigo oito aqui.")[0];
    ok(vazio.confianca === "forte" && vazio.sugerido === vazio.candidatos[1].indice, "DU3e artigo sem texto nao foi descartado");
    const vetado = api.leiDuplicados("Art. 9º Texto do artigo nove aqui mesmo. (Vetado)\nArt. 9º Outra redacao do nove diferente.")[0];
    ok(vetado.confianca === "forte" && vetado.sugerido === vetado.candidatos[1].indice, "DU3f artigo vetado nao foi descartado");
  }

  /* ---- DU4: as palavras que distinguem uma redação da outra ficam marcadas ---- */
  {
    const { api } = rodar();
    const p = api.leiPalavrasDiferentes("O Código é subordinado à Constituição", "O Código compreende a Constituição");
    const dif = p.filter((x) => x.dif).map((x) => x.t);
    ok(dif.indexOf("é") >= 0 && dif.indexOf("subordinado") >= 0 && dif.indexOf("Código") < 0 && dif.indexOf("Constituição") < 0,
       "DU4 as palavras destacadas estao erradas: " + JSON.stringify(dif));
    ok(api.leiPalavrasDiferentes("igual texto", "igual texto").every((x) => !x.dif), "DU4a texto igual ganhou destaque");
    ok(api.leiPalavrasDiferentes("a a a", "a").filter((x) => x.dif).length === 2, "DU4b a repeticao nao contou por ocorrencia");
  }

  /* ---- DU5: aplicar as escolhas ---- */
  {
    const { api } = rodar();
    const g = api.leiDuplicados(CARUARU);
    const [a, b] = g[0].candidatos;
    const so = (t2) => api.leiArtigos(t2).filter((x) => x.num === "3");
    let r = api.leiAplicarDuplicados(CARUARU, g, { 3: { manter: b.indice, original: false } });
    ok(so(r.texto).length === 1 && /Compreendem o Sistema/.test(so(r.texto)[0].texto) && !/subordinado/.test(r.texto),
       "DU5 ficar com a nova nao deixou so a nova");
    ok(api.leiArtigos(r.texto).length === 4 && /Art\. 4º\. Outro artigo comum/.test(r.texto),
       "DU5a mexeu nos outros artigos: " + api.leiArtigos(r.texto).length);
    r = api.leiAplicarDuplicados(CARUARU, g, { 3: { manter: a.indice, original: false } });
    ok(so(r.texto).length === 1 && /subordinado/.test(r.texto) && !/Compreendem/.test(r.texto), "DU5b ficar com a 1a nao deixou so a 1a");
    r = api.leiAplicarDuplicados(CARUARU, g, { 3: { manter: "todas" } });
    ok(r.texto === CARUARU && so(r.texto).length === 2, "DU5c 'manter todas' alterou o texto");
    /* guardar a substituída como original: base = antiga, alteração = nova */
    r = api.leiAplicarDuplicados(CARUARU, g, { 3: { manter: b.indice, original: true } });
    ok(so(r.texto).length === 1 && /subordinado/.test(r.texto), "DU5d com 'original' a base devia manter a redacao antiga");
    ok(r.alteracoes["3"] && /Compreendem/.test(r.alteracoes["3"].texto)
       && /Lei Complementar nº 018/.test(r.alteracoes["3"].fonteAlteracao),
       "DU5e a redacao nova nao virou alteracao com a fonte: " + JSON.stringify(r.alteracoes));
    const ef = api.leiArtigosEfetivos({ texto: r.texto, alteracoes: r.alteracoes }).filter((x) => x.num === "3");
    ok(ef.length === 1 && ef[0].alterado === true && /Compreendem/.test(ef[0].texto) && /subordinado/.test(ef[0].textoOriginal),
       "DU5f o leitor nao mostraria a redacao vigente com a original a um toque");
    /* 'original' e' ignorado quando nao se aplica (a escolhida nao tem 'Redação dada') */
    r = api.leiAplicarDuplicados(CARUARU, g, { 3: { manter: a.indice, original: true } });
    ok(Object.keys(r.alteracoes).length === 0, "DU5g 'original' gerou alteracao para uma escolha sem 'Redacao dada'");
  }

  /* ---- DU6: na CRIAÇÃO, salvar não cria a lei: abre a conferência, com a sugestão segura marcada ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = CARUARU;
    const r = api.leiGravar();
    ok(r === "pendente", "DU6 salvar com repetidos nao devolveu 'pendente': " + r);
    ok(api.$("dlgLeiDup").open === true, "DU6a a conferencia nao abriu");
    ok(api.leisLista().length === 0, "DU6b a lei foi criada ANTES de a pessoa confirmar");
    const g = gruposTela(api);
    ok(g.length === 1 && /forte/.test(g[0].className), "DU6c a tela nao mostra o grupo com sugestao segura");
    const rs = radios(api, "3");
    ok(rs.length === 3, "DU6d esperava 2 ocorrencias + 'manter todas': " + rs.length);
    const marcado = rs.filter((x) => x.checked)[0];
    ok(marcado && String(marcado.value) === String(api.leiDupCtxAtual().grupos[0].sugerido),
       "DU6e a sugestao segura nao veio marcada");
    ok(api.$("btnLeiDupConfirmar").disabled === false, "DU6f com tudo sugerido o confirmar devia estar liberado");
    ok(/Redação dada|Compreendem/.test((g[0].textContent || "")) && /sugerido/.test(g[0].textContent || "") && /redação nova/.test(g[0].textContent || ""),
       "DU6g a tela nao marca visualmente a sugerida (chip 'sugerido' e 'redacao nova')");
    ok(achar(g[0], (c) => /lei-dup-dif/.test(c.className || "")).length > 0, "DU6h nenhuma palavra diferente foi destacada");
    /* ate aqui NADA foi criado; agora a pessoa confirma */
    api.$("btnLeiDupConfirmar").onclick();
    ok(api.$("dlgLeiDup").open === false, "DU6i a conferencia nao fechou ao confirmar");
    const l = api.leisLista()[0];
    ok(!!l && l.nome === "LC 015/2009", "DU6j a lei nao foi criada depois do confirmar: " + JSON.stringify(l && l.nome));
    ok(api.leiArtigos(l.texto).filter((x) => x.num === "3").length === 1,
       "DU6k a lei nasceu com o artigo repetido");
    ok(l.alteracoes && l.alteracoes["3"] && /Compreendem/.test(l.alteracoes["3"].texto) && /subordinado/.test(l.texto),
       "DU6l a redacao substituida nao ficou como original (padrao quando ha 'Redacao dada'): " + JSON.stringify(l.alteracoes));
  }

  /* ---- DU7: sem indício, a escolha é da pessoa: começa vazia e trava o confirmar ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito", "T");
    api.$("leiTexto").value = "Art. 1º Um.\nArt. 2º Uma redacao de um jeito.\nArt. 2º Outra redacao bem diferente.\nArt. 3º Tres.";
    ok(api.leiGravar() === "pendente", "DU7-pre nao abriu a conferencia");
    ok(radios(api, "2").filter((x) => x.checked).length === 0, "DU7 a sugestao FRACA veio marcada (escolher so pela posicao)");
    ok(api.$("btnLeiDupConfirmar").disabled === true, "DU7a o confirmar nao esta travado com um repetido sem escolha");
    ok(/1 artigo|1 artigo\(s\)|Escolha em 1/.test(api.$("leiDupFaltam").textContent || ""),
       "DU7b a tela nao diz quantas escolhas faltam: " + api.$("leiDupFaltam").textContent);
    api.$("btnLeiDupConfirmar").onclick();
    ok(api.leisLista().length === 0, "DU7c o confirmar travado ainda criou a lei");
    const r2 = radios(api, "2")[1];
    r2.onchange();
    ok(api.$("btnLeiDupConfirmar").disabled === false, "DU7d escolher nao liberou o confirmar");
    api.$("btnLeiDupConfirmar").onclick();
    const l = api.leisLista()[0];
    ok(!!l && /Outra redacao/.test(l.texto) && !/Uma redacao de um jeito/.test(l.texto),
       "DU7e a lei nao ficou com a escolha da pessoa");
  }

  /* ---- DU8: cancelar volta ao texto, sem criar nada ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = CARUARU;
    api.leiGravar();
    api.$("btnLeiDupCancelar").onclick();
    ok(api.$("dlgLeiDup").open === false && api.leisLista().length === 0, "DU8 cancelar criou a lei ou nao fechou");
    ok(api.$("leiTexto").value === CARUARU, "DU8a cancelar mexeu no texto colado");
    ok(api.leiDupCtxAtual() === null, "DU8b o contexto da conferencia sobrou");
  }

  /* ---- DU9: "manter todas" cria a lei com as duas ocorrencias (e nao reabre a conferencia) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = CARUARU;
    api.leiGravar();
    radios(api, "3")[2].onchange();
    api.$("btnLeiDupConfirmar").onclick();
    const l = api.leisLista()[0];
    ok(!!l && api.leiArtigos(l.texto).filter((x) => x.num === "3").length === 2 && api.$("dlgLeiDup").open === false,
       "DU9 'manter todas' nao criou a lei com as duas ou reabriu a conferencia");
  }

  /* ---- DU10: sem repetidos o fluxo e' o de sempre (cria na hora) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito", "T");
    api.$("leiTexto").value = "Art. 1º Um.\nArt. 2º Dois.";
    const r = api.leiGravar();
    ok(r !== "pendente" && api.leisLista().length === 1 && api.$("dlgLeiDup").open !== true,
       "DU10 texto sem repetidos passou pela conferencia");
  }

  /* ---- DU11: trocar de lei no meio da conferência não perde a colagem nem troca por baixo ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const outra = api.leiGuardar({ nome: "Lei 1/2000", texto: "Art. 1º Um." });
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = CARUARU;
    api.leiSujoDefinir(true);
    api.leiTrocarPara(outra.id);          /* grava a colagem antes de trocar — e a gravacao pede conferencia */
    ok(api.$("dlgLeiDup").open === true, "DU11 trocar de lei com a colagem nao gravada nao abriu a conferencia");
    ok(api.leiIdAtualValor() === "", "DU11a a lei foi trocada por baixo da conferencia: " + api.leiIdAtualValor());
    ok(api.$("leiTexto").value === CARUARU, "DU11b a colagem foi perdida ao tentar trocar de lei");
    api.$("btnLeiDupConfirmar").onclick();
    const nova = api.leisLista().filter((x) => x.id !== outra.id)[0];
    ok(!!nova && api.leiIdAtualValor() === nova.id, "DU11c depois de confirmar, a lei aberta devia ser a recem-criada");
  }

  /* ---- DU12: ATUALIZAÇÃO de versão — repetidos no texto NOVO são conferidos antes de comparar ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "LC 015/2009", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Antigo tres do codigo." });
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "LC 018/2009";
    api.$("leiUpdTexto").value = "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Antigo tres do codigo.\nArt. 3º Novo tres do codigo mudado. (Redação dada pela LC 018/2009)";
    const r = api.leiAtualizarComparar();
    ok(r === false && api.$("dlgLeiDup").open === true, "DU12 a atualizacao nao abriu a conferencia dos repetidos");
    ok(api.$("leiUpdPasso2").hidden === true, "DU12a a comparacao abriu ANTES de a pessoa escolher");
    ok(radios(api, "3").length === 2, "DU12b na atualizacao nao deve haver 'manter todas' (a comparacao usa um artigo por numero): " + radios(api, "3").length);
    ok(achar(api.$("leiDupLista"), (c) => c.type === "checkbox").length === 0,
       "DU12c a opcao 'guardar como original' apareceu na atualizacao (a comparacao ja guarda o original)");
    ok(/versão nova/i.test(api.$("leiDupTitulo").textContent || ""), "DU12d o titulo nao diz que e' o texto NOVO: " + api.$("leiDupTitulo").textContent);
    api.$("btnLeiDupConfirmar").onclick();
    ok(api.$("leiUpdPasso2").hidden === false, "DU12e depois do confirmar a comparacao nao seguiu");
    const item = (api.leiUpdComparoAtual() || []).filter((x) => x.num === "3")[0];
    ok(item && item.tipo === "mudou" && /Novo tres/.test(item.novo) && /Antigo tres/.test(item.antigo),
       "DU12f a comparacao nao usou a escolhida (a nova) contra a antiga: " + JSON.stringify(item));
  }

  /* ---- DU13: atualização sem repetidos segue como sempre ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "LC 015/2009", texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "LC 1/2001";
    api.$("leiUpdTexto").value = "Art. 1º Um.\nArt. 2º Dois mudado.";
    ok(api.leiAtualizarComparar() === true && api.$("dlgLeiDup").open !== true, "DU13 atualizacao sem repetidos passou pela conferencia");
  }

  /* =================================================================
   * RV: REVISAR OS ARTIGOS REPETIDOS DE UMA LEI JÁ GUARDADA
   *
   * POR QUE ISTO EXISTE. A conferência da criação (DU) só vale para o que
   * se cola de agora em diante. A lei que já estava guardada com o artigo
   * antigo e o novo lado a lado — como a de Caruaru — precisava de um
   * caminho de volta, e quem manda "manter todas" precisa que o aviso pare.
   * =============================================================== */
  const LEI_REP = [
    "Art. 1º Um artigo qualquer que nao repete.",
    "Art. 2º O Codigo e subordinado a Constituicao Federal.",
    "Art. 2º O Codigo compreende o Sistema de Normas Tributarias. (Redação dada pela Lei Complementar nº 018, de 09 de outubro de 2009)",
    "Art. 3º Outro artigo comum.",
  ].join("\n");
  /* pelo painel (e nao por $("id")): o simulador guarda o elemento pelo id mesmo depois de ele sair da tela */
  const botaoRev = (api) => achar(api.$("leiProc"), (c) => c.id === "btnLeiRepetidos")[0];
  const abrirComRepetidos = (api, extra) => {
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar(Object.assign({ nome: "LC 015/2009", texto: LEI_REP }, extra || {}));
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal", l.id);
    return l;
  };

  /* ---- RV1: lei guardada com repetidos mostra o aviso no cabeçalho; lei limpa não ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    ok(!!botaoRev(api) && /1 artigo/.test(botaoRev(api).textContent || ""),
       "RV1 a lei com artigo repetido nao mostra o aviso 'revisar': " + (botaoRev(api) && botaoRev(api).textContent));
    ok(/art\. 2º/.test(botaoRev(api).title || ""), "RV1a o aviso nao diz QUAL artigo esta repetido: " + botaoRev(api).title);
    const { api: b } = rodar();
    b.matIniciar(); b.leiIniciar();
    const limpa = b.leiGuardar({ nome: "Lei 2/2000", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres." });
    b.leiAbrir("Direito", "T", limpa.id);
    ok(!botaoRev(b), "RV1b lei sem repetidos ganhou o aviso");
  }

  /* ---- RV2: revisar abre a conferência (modo "revisar") com a sugestão segura marcada, sem alterar nada ainda ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    botaoRev(api).onclick();
    ok(api.$("dlgLeiDup").open === true && api.leiDupCtxAtual().modo === "revisar", "RV2 nao abriu a conferencia em modo 'revisar'");
    ok(/nesta lei/i.test(api.$("leiDupTitulo").textContent || ""), "RV2a o titulo nao diz que e' a lei ja guardada: " + api.$("leiDupTitulo").textContent);
    ok(/atualizar a lei/i.test(api.$("btnLeiDupConfirmar").textContent || ""), "RV2b o botao nao diz que atualiza a lei: " + api.$("btnLeiDupConfirmar").textContent);
    ok(api.leiDe(l.id).texto === LEI_REP, "RV2c a lei foi alterada ANTES do confirmar");
    ok(radios(api, "2").filter((x) => x.checked).length === 1 && api.$("btnLeiDupConfirmar").disabled === false,
       "RV2d a sugestao segura nao veio marcada");
    ok(radios(api, "2").length === 3, "RV2e devia ter 'manter todas' (a lei pode repetir de verdade): " + radios(api, "2").length);
  }

  /* ---- RV3: confirmar atualiza a lei guardada: um artigo por número, redação anterior como original ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    botaoRev(api).onclick();
    api.$("btnLeiDupConfirmar").onclick();
    const dep = api.leiDe(l.id);
    ok(api.leiArtigos(dep.texto).filter((x) => x.num === "2").length === 1, "RV3 a lei continuou com o art. 2o repetido");
    ok(dep.alteracoes["2"] && /Sistema de Normas/.test(dep.alteracoes["2"].texto) && /subordinado/.test(dep.texto),
       "RV3a a redacao nova nao virou alteracao (com a antiga como original): " + JSON.stringify(dep.alteracoes));
    ok(api.leiArtigos(dep.texto).length === 3, "RV3b mexeu nos outros artigos");
    ok(api.$("leiTexto").value === dep.texto, "RV3c o campo de texto nao acompanhou a lei atualizada");
    ok(!botaoRev(api), "RV3d o aviso continua depois de resolvido");
    ok(api.leiArtigosEfetivos(dep).filter((x) => x.num === "2")[0].alterado === true,
       "RV3e o leitor nao mostra o art. 2o como alterado");
  }

  /* ---- RV4: "manter todas" faz o aviso PARAR (a repetição é legítima) e é lembrado ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    botaoRev(api).onclick();
    radios(api, "2")[2].onchange();
    api.$("btnLeiDupConfirmar").onclick();
    const dep = api.leiDe(l.id);
    ok(dep.texto === LEI_REP, "RV4 'manter todas' alterou o texto da lei");
    ok((dep.repetidosOk || []).indexOf("2") >= 0, "RV4a a lei nao lembrou que o art. 2o foi conferido: " + JSON.stringify(dep.repetidosOk));
    ok(!botaoRev(api), "RV4b o aviso continua depois de 'manter todas'");
    ok(api.leiDuplicados(dep.texto, dep.repetidosOk).length === 0 && api.leiDuplicados(dep.texto).length === 1,
       "RV4c leiDuplicados nao respeita a lista de conferidos (ou a lista apagou a deteccao geral)");
  }

  /* ---- RV5: cancelar não altera nada, e o aviso continua ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    botaoRev(api).onclick();
    api.$("btnLeiDupCancelar").onclick();
    ok(api.leiDe(l.id).texto === LEI_REP && !(api.leiDe(l.id).repetidosOk || []).length, "RV5 cancelar alterou a lei");
    ok(!!botaoRev(api), "RV5a o aviso sumiu sem a pessoa resolver");
  }

  /* ---- RV6: uma alteração JÁ registrada para o número não é sobrescrita ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api, { alteracoes: { 2: { texto: "Art. 2º Minha alteracao feita a mao.", fonteAlteracao: "EC 1/2000", data: "2026-01-01", revogado: false } } });
    botaoRev(api).onclick();
    ok(achar(api.$("leiDupLista"), (c) => c.type === "checkbox").length === 0,
       "RV6 ofereceu 'guardar como original' por cima de uma alteracao existente do mesmo artigo");
    api.$("btnLeiDupConfirmar").onclick();
    ok(/Minha alteracao feita a mao/.test(api.leiDe(l.id).alteracoes["2"].texto),
       "RV6a a alteracao que a pessoa ja tinha foi sobrescrita: " + JSON.stringify(api.leiDe(l.id).alteracoes["2"]));
  }

  /* ---- RV7: marcas ainda não gravadas entram antes da revisão (não se perdem) ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    api.$("leiTexto").value = LEI_REP.replace("Um artigo qualquer", "==Um artigo== qualquer");
    api.leiSujoDefinir(true);
    botaoRev(api).onclick();
    ok(/==Um artigo==/.test(api.leiDe(l.id).texto), "RV7 a marca ainda nao gravada nao foi guardada antes de revisar");
    api.$("btnLeiDupConfirmar").onclick();
    ok(/==Um artigo==/.test(api.leiDe(l.id).texto), "RV7a a revisao apagou a marca que a pessoa acabara de fazer");
  }

  /* ---- RV8: na CRIAÇÃO, "manter todas" ja fica registrado (o aviso nao aparece em seguida) ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = LEI_REP;
    api.leiGravar();
    radios(api, "2")[2].onchange();
    api.$("btnLeiDupConfirmar").onclick();
    const l = api.leisLista()[0];
    ok((l.repetidosOk || []).indexOf("2") >= 0, "RV8 'manter todas' na criacao nao foi lembrado: " + JSON.stringify(l.repetidosOk));
    ok(!botaoRev(api), "RV8a o aviso apareceu logo depois de a pessoa mandar manter");
  }

  /* ---- RV9: corpo e ADCT nunca disparam o aviso ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const cf = api.leiGuardar({ nome: "Constituição Federal", texto: ["TÍTULO I", "Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Tres.",
      "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS", "Art. 1º Um do ADCT.", "Art. 2º Dois do ADCT."].join("\n") });
    api.leiAbrir("Direito Constitucional", "CF", cf.id);
    ok(!botaoRev(api), "RV9 corpo e ADCT dispararam o aviso de repetidos");
  }

  /* ---- RV10: o aviso acompanha a lei aberta (troca de lei, mesmo texto novo) ---- */
  {
    const { api } = rodar();
    const l = abrirComRepetidos(api);
    ok(!!botaoRev(api), "RV10-pre sem aviso");
    api.leiGuardar({ id: l.id, texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiPintar();
    ok(!botaoRev(api), "RV10 o aviso ficou (memoria velha) depois de o texto perder o repetido");
  }

  /* =================================================================
   * SP: TEXTO COLADO NUMA LINHA SÓ
   *
   * POR QUE ISTO EXISTE. O leitor só reconhece "Art." no começo de uma
   * linha. O Código Tributário de Caruaru colado sem quebras dava ZERO
   * artigos: a lei virava um bloco de texto, e nada — ir ao artigo,
   * marcar, conferir repetidos — funcionava.
   * =============================================================== */
  const PLANO = "LEI COMPLEMENTAR 015, DE 05 DE JANEIRO DE 2009 (Com Alterações pelas Leis Complementares N° 018/09; 023/10) Institui o Código Tributário e de rendas do município de Caruaru e dá outras providências. O Prefeito do Município de Caruaru, Estado de Pernambuco. Faço saber que a Câmara Legislativa Municipal aprovou e eu sanciono a seguinte Lei Complementar: DAS DISPOSIÇÕES PRELIMINARES Art. 1º. Este Código regula os direitos e obrigações que emanam das relações jurídicas referentes a tributos e demais rendas que constituem receita do Município de Caruaru. Art. 2º. O Código é constituído de 4 (quatro) Livros, com a matéria, assim distribuída: LIVRO I - Estabelece Normas Gerais de Direito Tributário aplicáveis ao Município; LIVRO II - Regula o Sistema Tributário Municipal; LIVRO III - Regula o Regime Contratual dos Preços Públicos Municipais; LIVRO IV - Estabelece as Disposições Gerais, Transitórias e Finais. Art. 3º O Código Tributário Municipal é subordinado: I - à Constituição Federal; II - ao Código Tributário Nacional e demais Leis Complementares da União; III – à Lei Orgânica do Município de Caruaru. Art. 3º. Compreendem o Sistema de Normas Tributárias do Município de Caruaru os princípios e as normas gerais estabelecidas pela Constituição Federal, além dos demais atos normativos, cuja aplicação dependerá da conformidade com a natureza do tributo. (Redação dada pela Lei Complementar nº 018, de 09 de outubro de 2009)";
  const conduzirSep = async (api, aceitar) => {
    for (let i = 0; i < 25; i++) { await Promise.resolve(); try { api._uiFechar(aceitar); } catch (e) {} }
    await new Promise((r) => setTimeout(r, 5));
  };

  /* ---- SP1: o caso real — o leitor não achava nada; agora acha os quatro ---- */
  {
    const { api } = rodar();
    ok(api.leiArtigos(PLANO).length === 0, "SP1-pre o texto em uma linha ja era lido (o teste nao mede nada)");
    const r = api.leiSepararColagem(PLANO);
    ok(r.aplicavel === true, "SP1 nao propos separar um texto todo numa linha");
    ok(r.artigos.map((a) => a.num).join(",") === "1,2,3,3", "SP1a os artigos achados estao errados: " + r.artigos.map((a) => a.rotulo).join("|"));
    ok(api.leiArtigos(r.texto).length === 4, "SP1b depois de separar o leitor nao enxerga 4 artigos: " + api.leiArtigos(r.texto).length);
    /* nenhuma palavra muda: so entram quebras de linha */
    ok(r.texto.replace(/\s+/g, " ").trim() === PLANO.replace(/\s+/g, " ").trim(),
       "SP1c a separacao alterou palavras do texto");
    /* incisos com linha propria (leitura) */
    const linhas = r.texto.split("\n");
    ok(linhas.some((l) => /^I - à Constituição Federal;/.test(l)) && linhas.some((l) => /^III – à Lei Orgânica/.test(l)),
       "SP1d os incisos nao ganharam linha propria");
    /* a lista LIVRO I.. NAO virou divisao da lei */
    ok(!linhas.some((l) => /^LIVRO [IVX]+\b/.test(l)), "SP1e quebrou antes de um 'LIVRO n' da lista (isso viraria uma divisao da lei)");
    /* e os repetidos passam a ser vistos */
    ok(api.leiDuplicados(r.texto).length === 1 && api.leiDuplicados(r.texto)[0].num === "3",
       "SP1f o art. 3o repetido nao foi visto depois de separar");
  }

  /* ---- SP2: remissão não é artigo novo ---- */
  {
    const { api } = rodar();
    const t2 = "Art. 1º Este código trata do tributo. Art. 2º O prazo é de trinta dias, nos termos do art. 5º desta lei e conforme o Art. 9º do decreto. Art. 3º Fim.";
    const r = api.leiSepararColagem(t2);
    ok(r.aplicavel && r.artigos.map((a) => a.num).join(",") === "1,2,3",
       "SP2 tomou uma remissao por artigo (ou nao achou os tres): " + r.artigos.map((a) => a.rotulo).join("|"));
    /* remissão logo depois de um ponto final, mas com numero FORA DA SEQUENCIA */
    const t3 = "Art. 6º Trata de A. Art. 7º Trata de B; Art. 2º do Decreto revoga o resto. Art. 8º Trata de C.";
    const r3 = api.leiSepararColagem(t3);
    ok(r3.aplicavel && r3.artigos.map((a) => a.num).join(",") === "6,7,8",
       "SP2a uma remissao 'Art. 2º do Decreto' fora da sequencia virou artigo: " + r3.artigos.map((a) => a.rotulo).join("|"));
    /* salto absurdo */
    const t4 = "Art. 1º Um. Art. 2º Dois. Art. 900 Remissao solta. Art. 3º Tres.";
    ok(api.leiSepararColagem(t4).artigos.map((a) => a.num).join(",") === "1,2,3", "SP2b um salto de sequencia foi aceito como artigo");
  }

  /* ---- SP3: o que não precisa de separação passa reto ---- */
  {
    const { api } = rodar();
    ok(!api.leiSepararColagem("Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres.").aplicavel, "SP3 texto ja separado foi proposto de novo");
    ok(!api.leiSepararColagem("Art. 1º Artigo único e ponto final.").aplicavel, "SP3a texto com um artigo so foi proposto");
    ok(!api.leiSepararColagem("Este texto nao tem artigo nenhum, so um comentario sobre o art. 5º e o art. 6º.").aplicavel,
       "SP3b texto sem cabecalhos foi proposto");
    ok(!api.leiSepararColagem("").aplicavel && !api.leiSepararColagem(null).aplicavel, "SP3c vazio foi proposto");
    /* já separado + um único embutido: 1 candidato a mais, não vale o incômodo? ao menos não quebra o que está certo */
    const misto = api.leiSepararColagem("Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres. Art. 4º Quatro colado.\n");
    ok(misto.aplicavel && api.leiArtigos(misto.texto).length === 4, "SP3d texto meio separado nao foi completado");
  }

  /* ---- SP4: § e parágrafo único ganham linha, sem tocar em remissões ---- */
  {
    const { api } = rodar();
    const r = api.leiSepararColagem("Art. 1º O prazo e de dez dias. § 1º Contam-se em dias uteis, nos termos do § 2º do art. 4º. § 2º Excecoes. Parágrafo único. Vale para todos. Art. 2º Dois.");
    const ls = r.texto.split("\n");
    ok(ls.some((l) => /^§ 1º Contam-se/.test(l)) && ls.some((l) => /^§ 2º Excecoes/.test(l)) && ls.some((l) => /^Parágrafo único\. Vale/.test(l)),
       "SP4 os paragrafos nao ganharam linha propria: " + JSON.stringify(ls));
    ok(ls.filter((l) => /nos termos do § 2º do art\. 4º/.test(l)).length === 1, "SP4a quebrou uma remissao a '§ 2º' no meio da frase");
  }

  /* ---- SP5: na CRIAÇÃO, o texto em uma linha pede confirmação; aceitar separa e segue para os repetidos ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = PLANO;
    const r = api.leiGravar();
    ok(r === "pendente", "SP5 salvar um texto numa linha so nao devolveu 'pendente': " + r);
    ok(api.leisLista().length === 0, "SP5a a lei foi criada ANTES da confirmacao");
    await conduzirSep(api, true);
    ok(api.$("leiTexto").value !== PLANO && api.leiArtigos(api.$("leiTexto").value).length === 4,
       "SP5b aceitar nao separou o texto do editor");
    ok(api.$("dlgLeiDup").open === true, "SP5c depois de separar, o art. 3o repetido nao abriu a conferencia");
    ok(api.leisLista().length === 0, "SP5d a lei foi criada antes da conferencia dos repetidos");
    api.$("btnLeiDupConfirmar").onclick();
    const l = api.leisLista()[0];
    ok(!!l && api.leiArtigos(l.texto).length === 3 && l.alteracoes && l.alteracoes["3"],
       "SP5e a lei nao nasceu com 3 artigos e o 3o como alteracao: " + JSON.stringify(l && Object.keys(l.alteracoes || {})));
  }

  /* ---- SP6: recusar volta ao texto e não cria nada ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito Tributário", "Código Tributário Municipal");
    api.$("leiTexto").value = PLANO;
    api.leiGravar();
    await conduzirSep(api, false);
    ok(api.leisLista().length === 0 && api.$("leiTexto").value === PLANO && api.$("dlgLeiDup").open !== true,
       "SP6 recusar criou a lei, mexeu no texto ou abriu outra conferencia");
  }

  /* ---- SP7: sem repetidos, aceitar cria a lei direto ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito", "T");
    api.$("leiTexto").value = "Art. 1º Um artigo. Art. 2º Outro artigo. Art. 3º Mais um artigo.";
    api.leiGravar();
    await conduzirSep(api, true);
    const l = api.leisLista()[0];
    ok(!!l && api.leiArtigos(l.texto).length === 3 && api.$("dlgLeiDup").open !== true,
       "SP7 texto numa linha sem repetidos nao virou uma lei com 3 artigos");
  }

  /* ---- SP8: texto normal nem pergunta ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiAbrir("Direito", "T");
    api.$("leiTexto").value = "Art. 1º Um.\nArt. 2º Dois.";
    const r = api.leiGravar();
    ok(r !== "pendente" && api.leisLista().length === 1, "SP8 texto ja separado passou pela pergunta");
  }

  /* ---- SP9: ATUALIZAÇÃO — texto novo numa linha só era 'nenhum artigo'; agora propõe separar ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2000", texto: "Art. 1º Um.\nArt. 2º Dois.\nArt. 3º Tres." });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "LC 1/2001";
    api.$("leiUpdTexto").value = "Art. 1º Um. Art. 2º Dois mudado. Art. 3º Tres.";
    const r = api.leiAtualizarComparar();
    ok(r === false && api.$("leiUpdPasso2").hidden === true, "SP9 a comparacao seguiu sem separar o texto novo");
    ok(!/nenhum artigo|sem artigo/i.test(api.$("leiUpdAviso1").textContent || ""),
       "SP9a a atualizacao morreu com 'nenhum artigo' em vez de propor separar: " + api.$("leiUpdAviso1").textContent);
    await conduzirSep(api, true);
    ok(api.$("leiUpdPasso2").hidden === false, "SP9b depois de aceitar a comparacao nao seguiu");
    const item = (api.leiUpdComparoAtual() || []).filter((x) => x.num === "2")[0];
    ok(item && item.tipo === "mudou" && /Dois mudado/.test(item.novo), "SP9c a comparacao nao viu a mudanca do art. 2o: " + JSON.stringify(item));
  }

  /* ---- SP10: atualização recusada não segue ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ nome: "Lei 1/2000", texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiAbrir("Direito", "T", l.id);
    api.leiAtualizarAbrir();
    api.$("leiUpdFonte").value = "LC 1/2001";
    api.$("leiUpdTexto").value = "Art. 1º Um. Art. 2º Dois mudado.";
    api.leiAtualizarComparar();
    await conduzirSep(api, false);
    ok(api.$("leiUpdPasso2").hidden === true && api.$("leiUpdTexto").value === "Art. 1º Um. Art. 2º Dois mudado.",
       "SP10 recusar seguiu com a comparacao ou mexeu no texto");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
