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

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
