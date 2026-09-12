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
      ["btnLeiRankFechar", "dlgLeiRank"],
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
   * L7: O BOTÃO DO EXERCÍCIO DIZ EM QUE ESTADO ESTÁ
   *
   * O RELATO: "o botão de ativar esta função está com funcionamento
   * confuso". O rótulo era só a AÇÃO — "apagar só as palavras-chave" —
   * e lido com a função já ligada ele parece dizer que ela está
   * desligada. A única outra pista era um preenchimento de cor, que
   * ninguém lê como estado.
   * ============================================================== */
  {
    const { api } = rodar();
    abrirLei(api);
    api.leiTrocarModo("recitar");
    const acha = () => {
      const todos = [];
      const varrer = (el) => {
        Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); });
      };
      varrer(api.$("leiRecitar"));
      return todos.filter((x) => /lei-rec-alt/.test(x.className || ""))[0];
    };
    const b1 = acha();
    ok(!!b1, "L7-pre o botão do exercício não está na tela");
    const rot1 = String((b1 && b1.textContent) || "");
    ok(b1 && !/lei-modo-on/.test(b1.className || ""),
       "L7 o botão nasce marcado como ligado, e o exercício é o outro");

    b1.onclick();
    const b2 = acha();
    const rot2 = String((b2 && b2.textContent) || "");
    ok(rot1 !== rot2,
       "L7a o rótulo é o mesmo nos dois estados: se ele diz sempre a "
       + "mesma coisa, não está dizendo em qual você está: " + rot1);
    ok(b2 && /lei-modo-on/.test(b2.className || ""),
       "L7b ligado, o botão não se destaca dos outros");

    /* ---- L7c: e a tela diz QUAL exercício está valendo ----
     * Os dois desenhos são muito diferentes — artigos fechados ou
     * artigos com buracos — e nada dizia qual era, nem que havia dois. */
    const nota = Array.from(api.$("leiRecitar").children || [])
      .filter((x) => (x.tag || "") === "p")[0];
    ok(nota && /LACUNAS/i.test(nota.textContent || ""),
       "L7c a tela não diz que o exercício de lacunas está valendo: "
       + JSON.stringify(nota && nota.textContent));
    b2.onclick();
    const nota2 = Array.from(api.$("leiRecitar").children || [])
      .filter((x) => (x.tag || "") === "p")[0];
    ok(nota2 && /FECHADO/i.test(nota2.textContent || ""),
       "L7d desligado, a tela continua anunciando o exercício de "
       + "lacunas: " + JSON.stringify(nota2 && nota2.textContent));
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

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
