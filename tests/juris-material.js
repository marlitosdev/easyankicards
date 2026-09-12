/* =====================================================================
 * O JULGADO VIRA MATERIAL — E O CAMINHO DE VOLTA PARA A QUESTÃO
 *
 * POR QUE ISTO EXISTE. A jurisprudência era o único dos quatro tipos de
 * material guardado FORA do registro do tópico: resumo, cartões e lei
 * seca são campos de matResumos; julgado mora em eac_juris, ligado por
 * chave. Enquanto ele era uma gaveta à parte isso não doía. Passando a
 * contar como material, cada consequência dessa diferença virou um
 * defeito possível — e todos do mesmo tipo, o pior de todos: material
 * que está guardado e não é alcançável por quem o guardou.
 *
 * O QUE PRECISA SER VERDADE:
 *
 * 1. UM TÓPICO QUE SÓ TEM JULGADO APARECE NA ESTANTE. Ele não tem
 *    registro de material nenhum — e é justamente por isso que sumia.
 * 2. E APARECE COM O NOME CERTO. A chave é minúscula por ser feita para
 *    comparar; usá-la como rótulo criaria "direito tributário" ao lado
 *    de "Direito Tributário".
 * 3. A LINHA INVENTADA NÃO É GRAVADA. Ela existe para a tela e some
 *    sozinha; um registro vazio no armazenamento entraria em toda
 *    contagem, todo backup e todo cálculo de cobertura.
 * 4. O FILTRO E A BUSCA ALCANÇAM O JULGADO.
 * 5. COMPLETAR NUNCA SOBRESCREVE. É a metade perigosa: a tese é
 *    transcrição do tribunal, e uma "correção" automática nela sai
 *    decorada errada.
 * 6. DA QUESTÃO PARA A GAVETA E DE VOLTA, sem fechar a sessão.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* Monta um julgado ligado a um tópico, do jeito que a tela monta. */
  const guardar = (api, dados, disciplina, topico) => {
    const j = api.jurGravar(Object.assign({ tese: "tese qualquer" }, dados));
    const ch = api.matChave(disciplina, topico);
    api.jurLigar(j.id, ch, disciplina, topico);
    return api.jurDe(j.id);
  };

  /* ==============================================================
   * J1: O TÓPICO QUE SÓ TEM JULGADO APARECE NA ESTANTE
   * ============================================================== */
  {
    const { api } = rodar();
    guardar(api, { tribunal: "STF", classe: "RE", numero: "574706",
                   tese: "o ICMS não compõe a base do PIS e da COFINS" },
            "Direito Tributário", "Princípios");

    const cheia = api.matListaCheia();
    const achou = cheia.filter((x) => /princ/i.test(x.topico || ""))[0];
    ok(!!achou,
       "J1 um tópico com julgado guardado e sem resumo não aparece na "
       + "estante: " + cheia.length + " linha(s), nenhuma dele");

    /* ---- J1a: COM O NOME CERTO, não a chave de comparação ---- */
    ok(achou && achou.disciplina === "Direito Tributário",
       "J1a a disciplina veio da chave minúscula em vez do nome escrito: "
       + JSON.stringify(achou && achou.disciplina));
    ok(achou && achou.topico === "Princípios",
       "J1b o tópico veio da chave em vez do nome escrito: "
       + JSON.stringify(achou && achou.topico));

    /* ---- J1c: E O TIPO É "juris" ---- */
    ok(achou && api.matTiposDe(achou).indexOf("juris") >= 0,
       "J1c a linha do julgado não se marcou como material do tipo juris: "
       + JSON.stringify(achou && api.matTiposDe(achou)));

    /* ---- J1d: NADA DISSO FOI GRAVADO ----
     * A linha é de visualização. Se ela tiver escorregado para o
     * armazenamento, matLista (que lê o gravado) a devolveria também —
     * e um registro de material vazio entra em contagem, backup e
     * cobertura para sempre. */
    ok(!api.matLista().some((x) => /princ/i.test(x.topico || "")),
       "J1d a linha inventada foi PARADA no armazenamento: agora existe "
       + "um material vazio que nunca ninguém criou");

    /* ---- J1e: E A ESTANTE NÃO SE DIZ VAZIA ----
     * matRender pergunta "total" ANTES de tudo e, com zero, desenha
     * "nada guardado ainda" e volta — sem nem montar a lista. Com seis
     * julgados e nenhum resumo, a estante dizia estar vazia: o mesmo
     * defeito um andar acima, e o que faz a pessoa concluir que o
     * trabalho dela se perdeu. */
    ok(api.matResumo().total >= 1,
       "J1e a estante se declara vazia com julgado guardado dentro — e "
       + "com total=0 ela nem chega a montar a lista: "
       + JSON.stringify(api.matResumo()));
  }

  /* ==============================================================
   * J2: O JULGADO NÃO INVENTA UMA SEGUNDA LINHA
   *
   * Se o tópico já tem resumo, o julgado é um TIPO daquela linha — não
   * uma linha nova. Duas linhas para o mesmo tópico é o defeito que a
   * comparação de chave sem acento existe para evitar, reaparecendo
   * por outra porta.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matGravar(api.matChave("Direito Tributário", "Princípios"),
      "meu resumo", { disciplina: "Direito Tributário", topico: "Princípios" });
    guardar(api, { tese: "outra tese" }, "Direito Tributário", "Princípios");

    const quantas = api.matListaCheia()
      .filter((x) => /princ/i.test(x.topico || "")).length;
    ok(quantas === 1,
       "J2 o mesmo tópico apareceu " + quantas + " vezes na estante: o "
       + "julgado abriu linha própria em vez de marcar a que já existia");

    const linha = api.matListaCheia()
      .filter((x) => /princ/i.test(x.topico || ""))[0];
    const tps = api.matTiposDe(linha);
    ok(tps.indexOf("resumo") >= 0 && tps.indexOf("juris") >= 0,
       "J2a a linha não acumulou os dois tipos: " + JSON.stringify(tps));
  }

  /* ==============================================================
   * J3: ACENTO NA CHAVE NÃO SEPARA O JULGADO DO MATERIAL
   *
   * "Princípios" no edital e "principios" no vínculo é o caso real que
   * criou duas gavetas para o mesmo tópico em outras partes do app.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matGravar(api.matChave("Direito Tributário", "Princípios"),
      "meu resumo", { disciplina: "Direito Tributário", topico: "Princípios" });
    const j = api.jurGravar({ tese: "t" });
    api.jurLigar(j.id, "direito tributario›principios");   /* sem acento */

    const linha = api.matListaCheia()
      .filter((x) => /princ/i.test(x.topico || ""))[0];
    ok(linha && api.matTiposDe(linha).indexOf("juris") >= 0,
       "J3 um acento a menos no vínculo escondeu o julgado do material: "
       + JSON.stringify(linha && api.matTiposDe(linha)));
  }

  /* ==============================================================
   * J4: A BUSCA ENTRA NO JULGADO
   *
   * Procurar "confisco" e não achar o tópico onde está o julgado que
   * fala de confisco é o mesmo defeito de sempre por outro caminho.
   * ============================================================== */
  {
    const { api } = rodar();
    guardar(api, { tese: "as multas punitivas não podem ultrapassar o "
                         + "valor do tributo, sob pena de confisco" },
            "Direito Tributário", "Limitações");

    const acha = (f) => {
      let quantos = 0;
      api.matAgrupado(f).forEach((discs) =>
        discs.forEach((lista) => { quantos += lista.length; }));
      return quantos;
    };
    ok(acha("confisco") === 1,
       "J4 a busca não alcança o texto do julgado: 'confisco' está na "
       + "tese guardada e devolveu " + acha("confisco") + " resultado(s)");
    /* ---- J4a: e não vira peneira furada ---- */
    ok(acha("usucapião") === 0,
       "J4a a busca passou a devolver tudo: 'usucapião' não está em "
       + "lugar nenhum e voltou " + acha("usucapião") + " resultado(s)");
  }

  /* ==============================================================
   * J4b: O BOTÃO PRÓPRIO NA LINHA — E UMA PORTA SÓ
   *
   * O acesso à jurisprudência morava dentro do ⋮, junto de "mexer nos
   * cartões" e "ver a lei seca". Enquanto o julgado não contava como
   * material isso se defendia; contando, esconder o quarto tipo
   * enquanto os outros três têm porta na própria linha é dizer uma
   * coisa no selo e outra no caminho.
   *
   * E UMA PORTA SÓ: com o botão na linha, repetir a mesma ação no ⋮
   * seriam duas entradas para a mesma sala a dois centímetros uma da
   * outra. O que fica no menu é o convite para CRIAR o primeiro, que é
   * outra coisa.
   * ============================================================== */
  {
    const { api } = rodar();
    guardar(api, { tese: "t" }, "Direito Tributário", "Limitações");
    api.matRender();
    const cx = api.$("matLista");
    const todos = [];
    const varrer = (el) => {
      Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); });
    };
    varrer(cx);
    const botoes = todos.filter((x) => x.tag === "button");
    /* A CONTA É DE TODO CAMINHO PARA A GAVETA, com qualquer rótulo.
     * Filtrar só por "julgados" deixava passar a sabotagem que devolvia
     * a entrada do ⋮ — ela diz "guardar jurisprudência", e a contagem
     * seguia dando 1 com duas portas na tela. */
    const naLinha = botoes.filter((b) =>
      /julgado|jurisprud/i.test(b.textContent || ""));
    ok(naLinha.length === 1,
       "J4b a linha do material tem " + naLinha.length + " caminho(s) "
       + "visíveis para os julgados — zero é esconder o quarto tipo "
       + "atrás do ⋮; dois é a mesma porta desenhada duas vezes: "
       + JSON.stringify(naLinha.map((b) => b.textContent)));

    /* e ele leva à gaveta do tópico certo */
    if (naLinha[0]) naLinha[0].onclick();
    const alvo = api.jurTopicoAtualAtual();
    ok(alvo && /limita/i.test(alvo.nome || ""),
       "J4c o botão da linha abriu outro tópico: "
       + JSON.stringify(alvo && alvo.nome));
  }

  /* ---- J4d: sem julgado, o convite fica no menu ---- */
  {
    const { api } = rodar();
    api.matGravar(api.matChave("Direito Tributário", "Limitações"),
      "meu resumo", { disciplina: "Direito Tributário", topico: "Limitações" });
    api.matRender();
    const todos = [];
    const varrer = (el) => {
      Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); });
    };
    varrer(api.$("matLista"));
    const btns = todos.filter((x) => x.tag === "button");
    ok(!btns.some((b) => /\d+ julgados/i.test(b.textContent || "")),
       "J4d um tópico SEM julgado nenhum ganhou o botão de ver julgados");
    ok(btns.some((b) => /guardar jurisprud/i.test(b.textContent || "")),
       "J4e o convite para guardar o primeiro julgado sumiu do menu: um "
       + "tópico sem julgado ficou sem nenhum caminho para criar um");
  }

  /* ==============================================================
   * J5: COMPLETAR PREENCHE O VAZIO E NÃO TOCA NO CHEIO
   *
   * A metade perigosa. A tese é transcrição do tribunal: uma versão
   * "melhorada" por uma IA sai decorada errada, e decorada com a
   * confiança de quem acha que copiou do tribunal.
   * ============================================================== */
  {
    const { api } = rodar();
    const j = guardar(api, {
      tribunal: "STF",
      tese: "o limite das multas punitivas é de até 100% do tributo",
    }, "Direito Tributário", "Limitações");

    const falta = api.jurFaltando(j);
    ok(falta.indexOf("classe") >= 0 && falta.indexOf("numero") >= 0
       && falta.indexOf("tags") >= 0,
       "J5-pre não viu como faltando o que está vazio: "
       + JSON.stringify(falta));
    ok(falta.indexOf("tribunal") < 0,
       "J5-pre2 contou como faltando um campo que está preenchido: "
       + JSON.stringify(falta));

    const r = api.jurCompletar(j.id, {
      tribunal: "STJ",                       /* CONFLITO: já era STF */
      classe: "RE", numero: "833106",
      tese: "o limite das multas é de 20%", /* A TESE, que é intocável */
      assuntos: ["multa tributária", "não confisco"],
    });
    const dep = api.jurDe(j.id);

    ok(dep.tribunal === "STF",
       "J5 o tribunal que já estava preenchido foi sobrescrito: "
       + dep.tribunal);
    ok(r.ignorados.indexOf("tribunal") >= 0,
       "J5a o conflito foi engolido em silêncio — quem colou a resposta "
       + "não fica sabendo que a IA discordava: "
       + JSON.stringify(r.ignorados));
    ok(dep.classe === "RE" && dep.numero === "833106",
       "J5b os campos VAZIOS não foram preenchidos: "
       + dep.classe + " " + dep.numero);
    ok(/100%/.test(dep.tese) && !/20%/.test(dep.tese),
       "J5c A TESE FOI REESCRITA PELA IA. Isto é uma resposta errada "
       + "decorada com cara de transcrição do tribunal: " + dep.tese);
    ok((api.jurTagsDe(dep) || []).length === 2,
       "J5d os assuntos sugeridos não entraram: "
       + JSON.stringify(api.jurTagsDe(dep)));
  }

  /* ==============================================================
   * J5e: NEM A TESE VAZIA É PREENCHIDA PELA IA
   *
   * A sabotagem pegou este furo: com a tese CHEIA, o que protege é a
   * regra geral de "não sobrescrever", e a exclusão específica da tese
   * podia ser removida sem nenhum teste reclamar. Ela só se exerce
   * quando a tese está VAZIA — e é aí que ela mais importa: uma tese
   * "transcrita" por quem não tem a ementa na frente é invenção, e
   * inventada seria decorada exatamente como se fosse do tribunal.
   * Campo vazio se vê; frase errada com cara de transcrição, não.
   * ============================================================== */
  {
    const { api } = rodar();
    const j = api.jurGravar({ tese: "", resumo: "" });
    api.jurLigar(j.id, api.matChave("D", "T"), "D", "T");
    api.jurCompletar(j.id, {
      tese: "frase inventada pela IA",
      tese_curta: "outra frase inventada",
    });
    const dep = api.jurDe(j.id);
    ok(!String(dep.tese || "").trim(),
       "J5e a IA escreveu a tese de um julgado que não tinha nenhuma. "
       + "Isso é uma frase inventada guardada com a aparência de "
       + "transcrição do tribunal: " + JSON.stringify(dep.tese));
  }

  /* ---- J6: assunto se SOMA, não substitui ----
   * A sugestão da IA NÃO repete o assunto que já existia — de propósito.
   * Com "meu assunto" nos dois lados, substituir e somar dão o mesmo
   * resultado, e o teste passaria com a regra apagada. */
  {
    const { api } = rodar();
    const j = guardar(api, { tags: ["meu assunto"] },
                      "Direito Tributário", "Limitações");
    api.jurCompletar(j.id, { assuntos: ["não confisco"] });
    const tags = api.jurTagsDe(api.jurDe(j.id)) || [];
    ok(tags.length === 2,
       "J6 os assuntos da IA substituíram os meus em vez de se somarem: "
       + JSON.stringify(tags));
    ok(tags.some((x) => /meu assunto/.test(x)),
       "J6a o assunto que eu tinha escrito sumiu: " + JSON.stringify(tags));
    ok(tags.some((x) => /confisco/.test(x)),
       "J6b o assunto sugerido não entrou: " + JSON.stringify(tags));
  }

  /* ---- J6c: e não duplica o que já estava lá ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tags: ["não confisco"] },
                      "Direito Tributário", "Limitações");
    api.jurCompletar(j.id, { assuntos: ["Não Confisco", "nao confisco"] });
    const tags = api.jurTagsDe(api.jurDe(j.id)) || [];
    ok(tags.length === 1,
       "J6c o mesmo assunto entrou de novo com outra grafia: "
       + JSON.stringify(tags));
  }

  /* ---- J7: o prompt leva o que EXISTE e diz o que FALTA ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF",
      tese: "a tese guardada", resumo: "tetos teto diferenciados" },
      "Direito Tributário", "Limitações");
    const p = api.jurPromptCompletar(j, "Limitações");
    ok(/tetos teto/.test(p),
       "J7 o resumo guardado não foi junto: sem ele a IA não tem como "
       + "achar o erro de digitação que está justamente nele");
    ok(/a tese guardada/.test(p),
       "J7a a tese não foi junto: sem ela não há como conferir se o "
       + "resumo diz outra coisa");
    ok(/NÃO REESCREVA A TESE/i.test(p),
       "J7b o prompt não proíbe reescrever a tese — e a IA reescreve "
       + "por padrão, porque é o que a torna útil em todo outro caso");
    ok(/classe/.test(p) && /número/.test(p),
       "J7c o prompt não diz quais campos estão vazios: sem a lista, a "
       + "IA devolve todos e o app tem de recusar a maioria");
  }

  /* ==============================================================
   * J8: O BOTÃO PRINCIPAL DA ENTRADA SABE EM QUE PASSO ESTÁ
   *
   * Antes eram dois botões que pareciam alternativas e eram dois
   * momentos: colar a ementa → pedir à IA → sair do app → voltar com o
   * JSON pela MESMA caixa → apertar o OUTRO botão.
   * ============================================================== */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Limitações", "incluir");
    const btn = api.$("btnJurPrincipal");

    api.$("jurColar").value = "";
    api.jurPintarPrincipal();
    ok(btn.disabled === true,
       "J8 com a caixa vazia o botão principal continua clicável — e "
       + "clicá-lo abria um alerta para dizer que a caixa está vazia, "
       + "que é o que a tela já mostrava");
    const rotVazio = btn.textContent;

    api.$("jurColar").value = "RE 574706 / PR\nRelator: Min. CÁRMEN LÚCIA";
    api.jurPintarPrincipal();
    ok(btn.disabled === false,
       "J8a com uma ementa dentro o botão continuou desabilitado");
    ok(btn.textContent !== rotVazio,
       "J8b o rótulo não muda com o estado: se ele diz a mesma coisa "
       + "sempre, não está dizendo qual é o próximo passo");
    const rotEmenta = btn.textContent;

    api.$("jurColar").value = '{"tribunal":"STF","tese_curta":"x"}';
    api.jurPintarPrincipal();
    ok(btn.textContent !== rotEmenta,
       "J8c com a RESPOSTA da IA na caixa o botão continua oferecendo "
       + "perguntar à IA de novo: " + btn.textContent);
    ok(api.jurEstadoDaCaixa() === "resposta",
       "J8d um JSON na caixa não foi reconhecido como resposta: "
       + api.jurEstadoDaCaixa());
  }

  /* ---- J9: colar a resposta já preenche, sem clique extra ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Limitações", "incluir");
    api.$("jurColar").value = '{"tribunal":"STF","classe":"RE",'
      + '"numero":"574706","tese_curta":"o ICMS não compõe a base"}';
    api.jurAoColarNaCaixa();
    await new Promise((r) => setTimeout(r, 5));
    ok(api.$("jurTribunal").value === "STF",
       "J9 colar a resposta da IA ainda exige apertar um botão: o campo "
       + "ficou " + JSON.stringify(api.$("jurTribunal").value));
    ok(/ICMS/.test(api.$("jurTese").value || ""),
       "J9a a tese não veio do JSON colado: "
       + JSON.stringify(api.$("jurTese").value));
  }

  /* ---- J9b: ementa colada NÃO dispara leitura sozinha ----
   * Ali a leitura é palpite, e palpite automático preenche seis campos
   * sem ninguém ter pedido — o oposto do que a pílula existe para
   * evitar. */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Limitações", "incluir");
    api.$("jurColar").value = "RE 574706 / PR — PARANÁ\nÓrgão: Tribunal Pleno";
    api.jurAoColarNaCaixa();
    await new Promise((r) => setTimeout(r, 5));
    ok(!String(api.$("jurNumero").value || "").trim(),
       "J9b uma ementa colada foi extraída sozinha: seis campos "
       + "preenchidos por palpite sem ninguém pedir");
  }

  /* ==============================================================
   * J10: DA QUESTÃO PARA A GAVETA — SEM FECHAR A SESSÃO
   *
   * Fechar e reabrir a sessão perderia o rascunho, os grifos e a
   * rolagem da questão. O <dialog> empilha; a gaveta sobe por cima.
   * ============================================================== */
  {
    const { api } = rodar();
    const q = { id: "q1", disciplina: "Direito Tributário",
                topico: "Limitações", enunciado: "e", gabarito: "C",
                tipo: "ce" };
    api.$("dlgQsResponder").open = true;
    api.qsUiJuris(q);
    ok(api.$("dlgQsResponder").open === true,
       "J10 a sessão de questões foi FECHADA para abrir os julgados: "
       + "com ela vão embora o rascunho, os grifos e a rolagem da "
       + "questão que a pessoa estava lendo");
    ok(api.$("dlgJuris").open === true,
       "J10a a gaveta de julgados não abriu");
    const alvo = api.jurTopicoAtualAtual();
    ok(alvo && alvo.nome === "Limitações",
       "J10b a gaveta abriu em outro tópico que não o da questão: "
       + JSON.stringify(alvo && alvo.nome));
  }

  /* ---- J10c: e a volta repinta a tela de trás ---- */
  {
    const { api } = rodar();
    let voltou = 0;
    api.jurVoltaParaPor(() => { voltou++; });
    api.jurFechar();
    ok(voltou === 1,
       "J10c fechar a gaveta não avisou a tela de trás: o botão da "
       + "questão continuaria dizendo 'guardar julgado' depois de um "
       + "julgado ter sido guardado");
    /* e uma vez só: repintar duas vezes é trabalho à toa, e o segundo
     * disparo aconteceria com o estado já mudado */
    api.jurFechar();
    ok(voltou === 1,
       "J10d a volta foi disparada duas vezes pelo mesmo fechamento");
  }

  /* ==============================================================
   * J11: A TELA DE COMPLETAR — UMA CAIXA, E ELA SALVA
   *
   * O DEFEITO REAL, relatado com print: a caixa abria com DOIS campos
   * sem rótulo e recusava um JSON perfeito, dizendo "não entendi essa
   * resposta como JSON". A causa foi minha, de leitura de assinatura:
   * uiTexto(titulo, valor, dois, extra) — o terceiro argumento abre uma
   * SEGUNDA caixa, e eu passei "true" achando que pedia caixa alta.
   *
   * Com "dois" ligado, uiTexto devolve {a, b} — um objeto. O JSON.parse
   * recebia "[object Object]" e falhava. Ou seja: a mensagem de erro
   * acusava o usuário do meu engano, e nada era gravado.
   * ============================================================== */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF",
      tese: "a prorrogação de alíquota já vigente não se sujeita à noventena" },
      "Direito Tributário", "Anterioridade");
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Anterioridade", "ler");
    api.jurCompletarAbrir(j.id);

    ok(api.$("dlgJurCompletar").open === true,
       "J11 a tela de completar não abriu");
    /* UMA caixa de resposta, não duas */
    ok(api.$("jurCplResposta") && !api.$("txtLivreCaixa2Visivel"),
       "J11a a tela ainda usa a caixa genérica de dois campos");

    const RESP = '{"classe":"RE","numero":"584100",'
      + '"data_julgamento":"2009-11-25","orgao":"Tribunal Pleno",'
      + '"relator":"Min. Ricardo Lewandowski",'
      + '"fonte":"DJE de 12/02/2010 (RE 584100 / SP)",'
      + '"categoria":"REPERCUSSÃO GERAL",'
      + '"assuntos":["anterioridade nonagesimal","prorrogação de alíquota"],'
      + '"conferencia":[],'
      + '"identificacao":"Tema 131 do STF"}';
    api.$("jurCplResposta").value = RESP;
    api.jurCompletarLer();

    const dep = api.jurDe(j.id);
    ok(dep.numero === "584100" && dep.classe === "RE",
       "J11b a resposta da IA não foi gravada — que é a queixa original: "
       + "o JSON estava perfeito e o app dizia não entendê-lo: "
       + JSON.stringify({ classe: dep.classe, numero: dep.numero }));
    ok(dep.orgao === "Tribunal Pleno" && /Lewandowski/.test(dep.relator || ""),
       "J11c só parte dos campos vazios foi preenchida: "
       + JSON.stringify({ orgao: dep.orgao, relator: dep.relator }));
    ok((api.jurTagsDe(dep) || []).length === 2,
       "J11d os assuntos não entraram: "
       + JSON.stringify(api.jurTagsDe(dep)));
    ok(dep.tribunal === "STF",
       "J11e o tribunal que já estava preenchido foi sobrescrito: "
       + dep.tribunal);

    /* ---- J11f: E O RESULTADO FICA ESCRITO NA TELA ----
     * Antes ele saía num alerta que some ao tocar em OK — e é
     * justamente o que se lê comparando com o julgado atrás. */
    ok(api.$("jurCplSaida").hidden === false
       && String(api.$("jurCplSaida").textContent || "").trim(),
       "J11f o resultado não ficou escrito na tela: o que foi "
       + "preenchido, o que foi recusado e o que a IA apontou some "
       + "antes de poder ser lido");
  }

  /* ---- J11g: colar a resposta já lê, sem clicar ---- */
  {
    const { api } = rodar();
    const j = guardar(api, {}, "D", "T");
    api.jurIniciarTela();
    api.jurCompletarAbrir(j.id);
    api.$("jurCplResposta").value = '{"classe":"ADI","numero":"2405"}';
    api.jurCplAoColar();
    await new Promise((r) => setTimeout(r, 5));
    ok(api.jurDe(j.id).numero === "2405",
       "J11g colar a resposta ainda exige apertar um botão: "
       + JSON.stringify(api.jurDe(j.id).numero));
  }

  /* ---- J11h: o botão de ler nasce desabilitado ----
   * Caixa vazia, nada para ler: desabilitado ele diz isso sem precisar
   * de um alerta para dizê-lo. */
  {
    const { api } = rodar();
    const j = guardar(api, {}, "D", "T");
    api.jurIniciarTela();
    api.jurCompletarAbrir(j.id);
    ok(api.$("btnJurCplLer").disabled === true,
       "J11h o botão de ler está clicável com a caixa vazia");
    api.$("jurCplResposta").value = "qualquer coisa";
    api.jurCplPintarLer();
    ok(api.$("btnJurCplLer").disabled === false,
       "J11i o botão continuou desabilitado com texto na caixa");
  }

  /* ---- J11j: os campos que faltam vêm escritos, não contados ----
   * "faltam 6" não diz quais, e "quais" é o que decide se vale a ida à
   * IA: faltar o relator é uma coisa, faltar o número é outra. */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF" }, "D", "T");
    api.jurIniciarTela();
    api.jurCompletarAbrir(j.id);
    const selos = Array.from(api.$("jurCplFalta").children || [])
      .map((x) => String(x.textContent || ""));
    ok(selos.some((x) => /classe/i.test(x)) && selos.some((x) => /número/i.test(x)),
       "J11j a tela não diz QUAIS campos faltam: " + JSON.stringify(selos));
    ok(selos.some((x) => /✓/.test(x) && /tribunal/i.test(x)),
       "J11k o campo que já está preenchido não se distingue dos "
       + "vazios: " + JSON.stringify(selos));
  }

  /* ==============================================================
   * J12: O AVISO DE REPETIDO NÃO PODE PARECER QUE COMPARA AS LINHAS
   *
   * O RELATO REAL: o aviso mostrava duas linhas — "STF RE 584.100" e
   * "STF ADI 2405/RS" — sob o título "Parece o mesmo julgado guardado
   * duas vezes". Um RE e uma ADI são processos evidentemente
   * diferentes, e a leitura natural era "o app quer juntar estes dois".
   *
   * A conta sempre esteve certa: cada linha é UM processo guardado duas
   * vezes, e o aviso nunca comparou uma linha com a outra. O que faltava
   * era a linha DIZER isso — e mostrar as duas cópias, para a decisão se
   * tomar olhando em vez de por fé.
   * ============================================================== */
  {
    const { api } = rodar();
    const mk = (dados) => {
      const j = api.jurGravar(dados);
      api.jurLigar(j.id, api.matChave("D", "T"), "D", "T");
      return j;
    };
    /* DOIS PROCESSOS DIFERENTES, cada um guardado duas vezes — que é
     * exatamente o caso do print. */
    mk({ tribunal: "STF", classe: "RE", numero: "584100",
         tese: "a prorrogação de alíquota não se sujeita à noventena" });
    mk({ tribunal: "STF", classe: "RE", numero: "584.100",
         tese: "a simples prorrogação de alíquota já aplicada não surpreende" });
    mk({ tribunal: "STF", classe: "ADI", numero: "2405",
         tese: "não há reserva de lei complementar para meios de extinção" });
    mk({ tribunal: "STF", classe: "ADI", numero: "2405/RS",
         tese: "o Estado-membro pode estabelecer regras de extinção" });

    api.jurIniciarTela();
    api.jurAbrir("D", "T", "ler");
    const cx = api.$("jurRepetidos");
    ok(cx.hidden === false, "J12-pre o aviso de repetidos não apareceu");

    const todos = [];
    const varrer = (el) => {
      Array.from(el.children || []).forEach((f) => { todos.push(f); varrer(f); });
    };
    varrer(cx);
    const tit = todos.filter((x) => /jur-rep-tit/.test(x.className || ""))[0];
    ok(tit && /2/.test(tit.textContent || ""),
       "J12 o título não diz que são DOIS processos repetidos — com duas "
       + "linhas na tela, 'parece o mesmo julgado guardado duas vezes' é "
       + "lido como 'estas duas linhas são a mesma coisa': "
       + JSON.stringify(tit && tit.textContent));

    /* ---- J12a: cada linha mostra AS DUAS CÓPIAS dela ---- */
    const copias = todos.filter((x) => /jur-rep-copia/.test(x.className || ""));
    ok(copias.length === 4,
       "J12a as cópias não estão escritas: 'unir as duas' vira um ato de "
       + "fé, e o caso em que o app se engana só apareceria depois de "
       + "unir. Esperava 4 (2 por linha), achei " + copias.length);

    /* e são as teses CERTAS: as duas do RE numa linha, as duas da ADI
     * na outra — se estivessem trocadas, o aviso estaria de fato
     * comparando processos diferentes */
    const linhas = todos.filter((x) => /jur-rep-li/.test(x.className || ""));
    ok(linhas.length === 2,
       "J12b o aviso não tem uma linha por processo: " + linhas.length);
    /* AS CÓPIAS TÊM DE SER AS DO PRÓPRIO PROCESSO DA LINHA.
     *
     * A primeira versão desta asserção só exigia que uma linha não
     * misturasse os dois — e a sabotagem que mostrava as cópias do RE
     * nas DUAS linhas passou verde, porque a linha da ADI ficava sem
     * nenhuma tese de ADI e o "não mistura" continuava verdadeiro.
     * Ausência não é acerto: o que se cobra é a correspondência entre o
     * título da linha e as cópias que ela mostra. */
    linhas.forEach((li) => {
      const dentro = [];
      varrer2(li, dentro);
      const nomeEl = dentro.filter((x) => /jur-rep-nome/.test(x.className || ""))[0];
      const nome2 = String((nomeEl && nomeEl.textContent) || "");
      const cops = dentro.filter((x) => /jur-rep-copia/.test(x.className || ""))
        .map((x) => String(x.textContent || "")).join(" ");
      const daADI = /ADI/.test(nome2);
      ok(daADI
         ? (/lei complementar/.test(cops) && /Estado-membro/.test(cops))
         : (/noventena/.test(cops) && /surpreend/.test(cops)),
         "J12c a linha de “" + nome2.trim() + "” mostra as cópias de "
         + "OUTRO processo — aí sim ela estaria propondo unir dois "
         + "julgados diferentes: " + cops.slice(0, 180));
    });
    function varrer2(el, saida) {
      Array.from(el.children || []).forEach((f) => {
        saida.push(f); varrer2(f, saida);
      });
    }
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
