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
    /* v17.42.0: o caso real foi a IA citar a própria tese oficial (que já
     * vem entre aspas) dentro de "sugestao" sem escapar as aspas internas —
     * o JSON quebrava e a resposta inteira era recusada como "não é JSON".
     * O prompt agora pede a barra invertida antes de aspas internas. */
    ok(/ASPAS DENTRO DE UM VALOR JSON PRECISAM DE \\ NA FRENTE/.test(p),
       "J7d o prompt avisa para escapar aspas internas dentro de um valor "
       + "JSON (a causa real de citar a tese oficial dentro de \"sugestao\" "
       + "sem escapar): " + p.slice(p.indexOf("10. Nada de markdown")));
    ok(/\\"trecho assim\\"/.test(p),
       "J7e o exemplo do aviso mostra a barra invertida antes da aspas "
       + "(\\\"trecho assim\\\"), não só descreve a regra");
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
   * J11l/J11m: "NADA A PREENCHER" TINHA SÓ UM MOTIVO — SÓ QUE HÁ DOIS
   *
   * O CASO REAL: um julgado juntava dois processos distintos do STF numa
   * ficha só (número composto "551/RJ e 938.538 AgR/ES"), e a IA, seguindo
   * a própria regra do prompt ("não invente data nem relator se não tiver
   * certeza de qual processo é este"), devolveu data/órgão/relator
   * vazios DE PROPÓSITO. A tela mostrou "todos os campos que ela devolveu
   * já tinham conteúdo" — falso: eles não tinham, a IA recusou preenchê-
   * los. jurCompletar nem entra num campo que a resposta devolveu em
   * branco ("if (!v) return", em juris.js), então r.mudou fica vazio nos
   * dois casos (já preenchido, ou recusado) e o texto genérico escondia
   * qual dos dois tinha acontecido.
   * ============================================================== */
  {
    /* J11l: havia campo faltando, e a IA devolveu vazio — mensagem tem
     * de dizer que ela recusou, não que "já tinha conteúdo". */
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "ADI",
      numero: "551/RJ e 938.538 AgR/ES" }, "Direito Tributário", "Limitações");
    api.jurIniciarTela();
    api.jurCompletarAbrir(j.id);
    ok(api.jurFaltando(api.jurDe(j.id)).indexOf("data") >= 0,
       "J11l-pre o cenário não tem data faltando, o teste não testa nada");
    api.$("jurCplResposta").value = JSON.stringify({
      data_julgamento: "", orgao: "", relator: "",
      identificacao: "dois processos numa ficha só",
    });
    api.jurCompletarLer();
    const saida = String(api.$("jurCplSaida").textContent || "");
    ok(saida.indexOf(api.t("jur_completar_recusou")) >= 0,
       "J11l a tela não avisou que a IA recusou preencher: " + saida);
    ok(saida.indexOf(api.t("jur_completar_zero")) < 0,
       "J11m a tela disse 'já tinha conteúdo' para campo que estava vazio: " + saida);
  }
  {
    /* J11n: nada faltava, e a IA devolveu os mesmos valores — a mensagem
     * antiga continua correta aqui, e não pode regredir para a nova. */
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "ADI", numero: "551",
      data: "2019-05-20", orgao: "Tribunal Pleno", relator: "Min. Fux",
      fonte: "DJE", resumo: "resumo já completo" },
      "Direito Tributário", "Limitações");
    api.jurIniciarTela();
    api.jurCompletarAbrir(j.id);
    ok(api.jurFaltando(api.jurDe(j.id)).length === 0
       || api.jurFaltando(api.jurDe(j.id)).join(",") === "tags",
       "J11n-pre o cenário ainda tem campo de texto faltando, além de tags: "
       + JSON.stringify(api.jurFaltando(api.jurDe(j.id))));
    api.$("jurCplResposta").value = JSON.stringify({
      tribunal: "STF", classe: "ADI", numero: "551",
      data_julgamento: "2019-05-20", orgao: "Tribunal Pleno", relator: "Min. Fux",
    });
    api.jurCompletarLer();
    const saida2 = String(api.$("jurCplSaida").textContent || "");
    ok(saida2.indexOf(api.t("jur_completar_zero")) >= 0,
       "J11o um julgado já completo deixou de mostrar a mensagem antiga: " + saida2);
    ok(saida2.indexOf(api.t("jur_completar_recusou")) < 0,
       "J11p um julgado já completo passou a mostrar a mensagem de recusa: " + saida2);
  }

  /* ==============================================================
   * J11q-t: "DOIS PROCESSOS NUMA FICHA SÓ" — SÓ APONTA, NUNCA SEPARA
   *
   * O MESMO CASO REAL do bloco acima, agora do lado do cartão: um
   * número como "551/RJ e 938.538 AgR/ES" ganha um selo de aviso na
   * lista, explicando por que data/órgão/relator nunca vão fechar — e
   * um número comum, de processo único, não ganha selo nenhum. O
   * detector nunca separa a ficha sozinho: quem decide o que vira duas
   * fichas (e o que cada uma leva) é quem estuda.
   * ============================================================== */
  {
    const { api } = rodar();
    const dois = guardar(api, { tribunal: "STF", classe: "ADI",
      numero: "551/RJ e 938.538 AgR/ES" }, "Direito Tributário", "Limitações");
    const unico = guardar(api, { tribunal: "STF", classe: "RE",
      numero: "574706" }, "Direito Tributário", "Limitações");

    ok(api.jurPareceDoisProcessos(dois) === true,
       "J11q o detector nao reconheceu o numero composto: " + dois.numero);
    ok(api.jurPareceDoisProcessos(unico) === false,
       "J11r o detector deu falso positivo num processo unico: " + unico.numero);

    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Limitações");
    const cx = api.$("jurLista");
    const avisos = cx.querySelectorAll ? cx.querySelectorAll(".dois-proc") : [];
    ok(avisos.length === 1,
       "J11s a lista nao mostrou exatamente um selo de aviso: " + avisos.length);
    ok(/dois processos/i.test((avisos[0] && avisos[0].textContent) || ""),
       "J11t o selo nao diz o que esta acontecendo: "
       + (avisos[0] && avisos[0].textContent));
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

  /* ==============================================================
   * J13: LEI + JURISPRUDÊNCIA LADO A LADO
   *
   * O botão só existe quando os DOIS materiais do tópico existem — sem
   * lei ou sem julgado não há o que separar em duas metades. E só faz
   * sentido em tela larga: dois painéis não cabem num celular.
   * ============================================================== */
  {
    const { api, janela, doc } = rodar();
    const disc = "Direito Tributário", topico = "Imunidades";

    /* só julgado, ainda sem lei: o botão não pode aparecer */
    guardar(api, { tese: "tese qualquer" }, disc, topico);
    janela.innerWidth = 1200;
    api.matRender();
    const semLei = api.$("matLista").querySelectorAll("button")
      .filter((b) => (b.className || "").indexOf("btn-lj-split") >= 0);
    ok(semLei.length === 0,
       "J13a o botão lado a lado apareceu sem lei nenhuma guardada");

    /* agora com lei também */
    api.leiAbrir(disc, topico);
    api.$("leiTexto").value = "Art. 1o Texto de teste.";
    api.leiGravar();
    api.$("dlgLeiSeca").close();
    api.matRender();
    const btns = api.$("matLista").querySelectorAll("button")
      .filter((b) => (b.className || "").indexOf("btn-lj-split") >= 0);
    ok(btns.length === 1,
       "J13b o botão lado a lado não apareceu com lei E julgado guardados: "
       + btns.length);

    /* ---- J13c: em tela estreita, cai no comportamento normal ---- */
    janela.innerWidth = 375;
    api.leiJurLadoALado(disc, topico);
    ok(api.$("dlgLeiSeca").open === true,
       "J13c a lei não abriu em tela estreita");
    ok(api.$("dlgJuris").open !== true,
       "J13d em tela estreita a jurisprudência abriu junto — devia abrir "
       + "só a lei, uma de cada vez, como sempre foi no celular");
    ok(!doc.body.classList.contains("split-lj"),
       "J13e o modo lado a lado ligou numa tela que não cabe os dois");
    api.$("dlgLeiSeca").close();

    /* ---- J13f: em tela larga, os dois abrem juntos, pro MESMO tópico ---- */
    janela.innerWidth = 1200;
    api.leiJurLadoALado(disc, topico);
    ok(api.$("dlgLeiSeca").open === true && api.$("dlgJuris").open === true,
       "J13f em tela larga os dois painéis deviam abrir juntos: lei="
       + api.$("dlgLeiSeca").open + " juris=" + api.$("dlgJuris").open);
    ok(doc.body.classList.contains("split-lj"),
       "J13g a classe que liga o layout lado a lado não foi para o body");
    const jt = api.jurTopicoAtualAtual();
    ok(!!jt && jt.disciplina === disc && jt.nome === topico,
       "J13h a jurisprudência abriu para outro tópico, não o mesmo da lei: "
       + JSON.stringify(jt));

    /* botão real, clicado de verdade — não só a função por trás dele */
    api.$("dlgLeiSeca").close(); api.$("dlgJuris").close();
    api.matRender();
    const btn = api.$("matLista").querySelectorAll("button")
      .filter((b) => (b.className || "").indexOf("btn-lj-split") >= 0)[0];
    ok(!!btn, "J13i-pre o botão precisa existir para o clique valer algo");
    if (btn) btn.onclick();
    ok(api.$("dlgLeiSeca").open === true && api.$("dlgJuris").open === true,
       "J13i o clique no botão real não abriu os dois painéis");
  }

  /* =================================================================
   * Q: NÃO CONFIAR NA MEMÓRIA DA IA — um pedido só, e a resposta é conferida
   *
   * O CASO REAL. A Súmula Vinculante 29, dada só pelo título, foi
   * "completada" pela IA com data, fonte e "relator" que não conferem com
   * o que os sítios oficiais publicam — e o app os gravou com a mesma cara
   * do que veio do texto. O primeiro pedido dizia "não deduza", o segundo
   * pedia para preencher: contratos opostos, e a resposta do segundo só
   * podia vir de memória.
   * =============================================================== */
  const RESPOSTA_SV29 = {
    tribunal: "", classe: "", numero: "", data_julgamento: "2010-02-17",
    orgao: "Tribunal Pleno",
    relator: "Ministro Cezar Peluso (Relator da Sessão de Aprovação)",
    fonte: "DJe nº 40/2010, p. 1, publicado em 05/03/2010",
    categoria: "SÚMULA VINCULANTE", resumo: "", assuntos: [],
  };
  const PARAFRASE_SV29 = "O STF (Súmula Vinculante 29) admite apenas a utilização de um "
    + "ou mais elementos da base de cálculo de imposto, vedada a integral identidade.";

  /* ---- Q1: um montador só, com o mesmo formato para entrada e completar ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
      tese: PARAFRASE_SV29, resumo: "" }, "Direito Tributário", "Tributos");
    const pC = api.jurPromptCompletar(j, "Tributos e suas espécies");
    const pE = api.jurPromptPreencher("RE 574706 / PR — Relator: Min. CÁRMEN LÚCIA",
      "Tributos e suas espécies");
    ["do_texto", "de_memoria", "tipo_do_texto", "tese_e_transcricao_oficial",
     "onde_conferir", "conferencia"].forEach((marca) => {
      ok(pC.indexOf(marca) >= 0 && pE.indexOf(marca) >= 0,
         "Q1 o pedido de " + (pC.indexOf(marca) < 0 ? "completar" : "entrada")
         + " nao tem '" + marca + "': continuam sendo dois formatos");
    });
    /* o texto entra DELIMITADO: dado, não instrução */
    ok(/<texto>[\s\S]*<\/texto>/.test(pE) && /não é instrução|NÃO ORDEM/i.test(pE),
       "Q1a o texto colado nao esta delimitado como dado (tag <texto>)");
    /* a paráfrase guardada vai na tag da tese, e o pedido manda apontar */
    ok(/<tese_guardada>[\s\S]*integral identidade[\s\S]*<\/tese_guardada>/.test(pC),
       "Q1b a tese guardada nao foi dentro da tag");
    ok(/paráfrase e não o enunciado oficial/.test(pC),
       "Q1c o pedido nao manda apontar tese que e' parafrase");
  }

  /* ---- Q2: de memória, só a IDENTIDADE (a menos que se peça mais) ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF" }, "Direito Tributário", "Tributos");
    const bloco = (p) => (/"de_memoria": \{([^}]*)\}/.exec(p) || [])[1] || "";
    const pId = api.jurPromptCompletar(j, "T");
    ok(/"numero"/.test(bloco(pId)) && !/relator|data_julgamento|orgao|fonte/.test(bloco(pId)),
       "Q2 o padrao deixa a IA lembrar data/relator/orgao/fonte: " + bloco(pId));
    ok(/NUNCA de memória/.test(pId),
       "Q2a o pedido nao proibe data/relator/orgao/fonte de memoria");
    const pTudo = api.jurPromptCompletar(j, "T", { memoria: "tudo" });
    ok(/relator/.test(bloco(pTudo)) && /data_julgamento/.test(bloco(pTudo)),
       "Q2b o pedido explicito de memoria total nao abriu os campos: " + bloco(pTudo));
    ok(/vou conferi-los na fonte oficial/.test(pTudo),
       "Q2c a memoria total nao diz que sera conferida");
  }

  /* ---- Q3: o texto colado é inserido UMA vez (marcadores dentro dele não são trocados) ---- */
  {
    const { api } = rodar();
    const p = api.jurPromptIA({ topico: "T", texto: "trecho com {tese} e {resumo} e {falta}",
      tese: "TESE-X", resumo: "RESUMO-Y", campos: {} });
    ok(p.indexOf("trecho com {tese} e {resumo} e {falta}") >= 0,
       "Q3 marcadores dentro do texto colado foram substituidos pelo que veio depois");
  }

  /* ---- Q4: a resposta nova (dois blocos) é lida; a antiga (campos soltos) continua ---- */
  {
    const { api } = rodar();
    const nova = JSON.stringify({
      tipo_do_texto: "parafrase_ou_resumo",
      identificacao: "SV 29 do STF",
      do_texto: { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
        tese_curta: PARAFRASE_SV29, tese_e_transcricao_oficial: false },
      de_memoria: { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
        data_julgamento: "2010-02-03" },
      onde_conferir: "portal.stf.jus.br, busca por Súmula Vinculante 29",
    });
    const a = api.jurDoJson(nova);
    ok(a && a.tribunal === "STF" && a.classe === "Súmula Vinculante" && a.numero === "29",
       "Q4 o bloco do_texto nao foi lido: " + JSON.stringify(a));
    ok(a && a.teseOficial === false && /parafrase/.test(a.tipoDoTexto),
       "Q4a o tipo do texto / tese nao-oficial nao chegaram: "
       + JSON.stringify(a && [a.tipoDoTexto, a.teseOficial]));
    ok(a && a.deMemoria.data === "2010-02-03" && /portal\.stf/.test(a.ondeConferir),
       "Q4b o bloco de_memoria / onde_conferir nao chegaram");
    /* a resposta ANTIGA, sem os blocos */
    const velha = api.jurDoJson('{"tribunal":"STF","classe":"RE","numero":"574706","tese_curta":"x"}');
    ok(velha && velha.tribunal === "STF" && velha.numero === "574706"
       && velha.teseOficial === null && velha.deMemoria.classe === "",
       "Q4c a resposta do formato antigo deixou de ser lida");
  }

  /* ---- Q5: a régua — cada campo é procurado no texto do jeito dele ---- */
  {
    const { api } = rodar();
    const no = (c, v, b) => api.jurValorNoTexto(c, v, b);
    const EMENTA = "RE 574.706 / PR — PARANÁ\nRelator(a): Min. CÁRMEN LÚCIA\n"
      + "Julgamento: 15/03/2017 — Tribunal Pleno\nDJe nº 61, de 20/03/2017";
    ok(no("data", "2017-03-15", EMENTA), "Q5 data escrita dd/mm/aaaa nao foi reconhecida");
    ok(no("data", "2010-02-17", "aprovada em 17 de fevereiro de 2010"),
       "Q5a data por extenso nao foi reconhecida");
    ok(!no("data", "2010-02-17", EMENTA), "Q5b data que NAO esta no texto foi dada como confirmada");
    ok(no("numero", "574706", EMENTA), "Q5c numero com ponto de milhar nao foi reconhecido");
    ok(!no("numero", "574", EMENTA) && !no("numero", "706", EMENTA),
       "Q5d pedaço de numero foi dado como confirmado (fichas partidas)");
    ok(no("relator", "Ministra Cármen Lúcia", EMENTA), "Q5e relator por sobrenome nao foi reconhecido");
    ok(!no("relator", "Ministro Cezar Peluso (Relator da Sessão de Aprovação)", EMENTA),
       "Q5f relator que nao esta no texto foi dado como confirmado");
    ok(!no("relator", "Ministro Carmen Rocha", EMENTA),
       "Q5f2 um nome que so casa em parte com o texto foi dado como confirmado");
    ok(no("orgao", "Tribunal Pleno", EMENTA) && !no("orgao", "Primeira Turma", EMENTA),
       "Q5g orgao: confirma o que esta, nao o que nao esta");
    ok(no("fonte", "DJe nº 61, de 20/03/2017", EMENTA)
       && !no("fonte", "DJe nº 40/2010, p. 1, publicado em 05/03/2010", EMENTA),
       "Q5h fonte: os numeros dela tem de estar todos no texto");
    ok(!no("fonte", "portal do STF", EMENTA), "Q5i fonte sem numero nao se confere em texto");
    ok(no("tribunal", "STF", "O STF decidiu") && !no("tribunal", "STF", "MANIFESTO do órgão"),
       "Q5j sigla de tribunal: palavra inteira, nao pedaço");
    ok(!no("data", "2010-02-17", ""), "Q5k sem texto de base nada e' verificavel");
    /* o tribunal que a CLASSE ja diz (RE -> STF) nao e' suposicao da IA, desde que a
     * classe esteja no texto; com a classe nao confirmada, a deducao nao vale */
    const v1 = api.jurVerificarNoTexto({ tribunal: "STF", classe: "RE", numero: "574706" }, "RE 574706 / PR");
    ok(v1.aConferir.length === 0, "Q5l tribunal deduzido da classe confirmada ficou a conferir: " + JSON.stringify(v1));
    const v2 = api.jurVerificarNoTexto({ tribunal: "STF", classe: "RE", numero: "574706" }, "texto sem nada");
    ok(v2.aConferir.indexOf("tribunal") >= 0, "Q5m tribunal com a classe NAO confirmada foi dado como confirmado");
  }

  /* ---- Q6: O CASO DA SV 29 — o que a IA lembrou e o texto não confirma fica "a conferir" ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
      tese: PARAFRASE_SV29 }, "Direito Tributário", "Tributos");
    const r = api.jurCompletar(j.id, RESPOSTA_SV29);
    const dep = api.jurDe(j.id);
    ["data", "orgao", "relator", "fonte"].forEach((k) => {
      ok(r.mudou.indexOf(k) >= 0, "Q6-pre o campo " + k + " nao foi preenchido");
      ok(dep.aConferir.indexOf(k) >= 0,
         "Q6 o campo '" + k + "', lembrado pela IA e ausente do texto guardado, foi "
         + "gravado com a mesma cara de dado verificado: " + JSON.stringify(dep.aConferir));
    });
    ok(r.aConferir.length === 4, "Q6a o retorno nao diz quais ficaram a conferir: " + JSON.stringify(r.aConferir));
    /* a tese continua intocada */
    ok(dep.tese === PARAFRASE_SV29, "Q6b a tese foi alterada");
  }

  /* ---- Q7: com texto guardado, o que ele confirma NÃO fica a conferir ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "RE", numero: "574706",
      texto: "Julgamento: 15/03/2017 — Tribunal Pleno\nRelator(a): Min. CÁRMEN LÚCIA" },
      "Direito Tributário", "Tributos");
    const r = api.jurCompletar(j.id, { do_texto: { data_julgamento: "2017-03-15",
      orgao: "Tribunal Pleno", relator: "Cármen Lúcia", fonte: "DJe nº 999 de 01/01/2001" } });
    const dep = api.jurDe(j.id);
    ok(dep.data === "2017-03-15" && dep.orgao === "Tribunal Pleno" && dep.relator === "Cármen Lúcia",
       "Q7-pre os campos nao foram preenchidos");
    ok(dep.aConferir.length === 1 && dep.aConferir[0] === "fonte",
       "Q7 so a fonte (que o texto nao traz) devia ficar a conferir: " + JSON.stringify(dep.aConferir));
  }

  /* ---- Q8: a memória só entra em campo VAZIO, e nasce "a conferir" ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF" }, "Direito Tributário", "Tributos");
    api.jurCompletar(j.id, { de_memoria: { tribunal: "STJ", classe: "RE", numero: "833106" } });
    const dep = api.jurDe(j.id);
    ok(dep.tribunal === "STF", "Q8 a memoria sobrescreveu um campo preenchido: " + dep.tribunal);
    ok(dep.classe === "RE" && dep.numero === "833106" && dep.aConferir.indexOf("classe") >= 0,
       "Q8a a identidade lembrada nao entrou marcada a conferir: " + JSON.stringify(dep.aConferir));
  }

  /* ---- Q9: "conferi" limpa a marca (tudo, ou só alguns campos) ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", aConferir: ["data", "orgao", "fonte"] },
      "Direito Tributário", "Tributos");
    api.jurMarcarConferido(j.id, ["data"]);
    ok(JSON.stringify(api.jurDe(j.id).aConferir) === JSON.stringify(["orgao", "fonte"]),
       "Q9 conferir um campo mexeu nos outros: " + JSON.stringify(api.jurDe(j.id).aConferir));
    api.jurMarcarConferido(j.id);
    ok(api.jurDe(j.id).aConferir.length === 0, "Q9a conferir tudo nao limpou");
  }

  /* ---- Q10: na ENTRADA — a resposta volta pela mesma caixa e é conferida contra o texto ENVIADO ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    let copiado = "";
    api.navegador.clipboard = { writeText: async (x) => { copiado = x; } };
    const EMENTA = "RE 574706 / PR — PARANÁ\nRelator(a): Min. CÁRMEN LÚCIA\n"
      + "Julgamento: 15/03/2017 — Tribunal Pleno\nTese: O ICMS não compõe a base de cálculo do PIS.";
    api.$("jurColar").value = EMENTA;
    api.$("jurTribunal").value = "STF";
    api.jurPedirIA();                      /* não se espera: termina num alerta */
    await new Promise((r) => setTimeout(r, 5));
    ok(/<texto>[\s\S]*574706[\s\S]*<\/texto>/.test(copiado),
       "Q10-pre o pedido copiado nao leva o texto colado");
    ok(/tribunal: STF/i.test(copiado),
       "Q10a o pedido nao leva o que o formulario JA tem (a IA nao pode refazer): "
       + copiado.slice(0, 300));
    ok(api.jurTextoDoPedidoAtual() === EMENTA,
       "Q10b o texto enviado nao ficou guardado para conferir a resposta");

    /* a resposta substitui a caixa: data confirmada (está no texto), orgao NAO */
    api.$("jurColar").value = JSON.stringify({ do_texto: { tribunal: "STF", classe: "RE",
      numero: "574706", data_julgamento: "2017-03-15", orgao: "Primeira Turma",
      tese_curta: "O ICMS não compõe a base de cálculo do PIS.",
      tese_e_transcricao_oficial: true } });
    api.jurAoColarNaCaixa();
    await new Promise((r) => setTimeout(r, 5));
    ok(api.$("jurData").value === "2017-03-15" && api.$("jurOrgao").value === "Primeira Turma",
       "Q10c os campos da resposta nao entraram no formulario");
    const conf = Object.keys(api.jurConferirFormAtual());
    ok(conf.length === 1 && conf[0] === "orgao",
       "Q10d so o orgao (que o texto enviado nao traz) devia ficar a conferir: " + JSON.stringify(conf));
    ok(/a conferir/.test(api.$("jurColarAviso").textContent || ""),
       "Q10e a pilula nao diz que ha campo a conferir: " + api.$("jurColarAviso").textContent);

    /* guardar deixa o selo; corrigir o campo ANTES de guardar tira a marca */
    api.$("jurTese").value = "O ICMS não compõe a base de cálculo do PIS.";
    await api.jurSalvar();
    const salvo = api.jurDoTopico(api.matChave("Direito Tributário", "Tributos"))[0];
    ok(salvo && salvo.aConferir.length === 1 && salvo.aConferir[0] === "orgao",
       "Q10f o julgado guardado perdeu a marca 'a conferir': " + JSON.stringify(salvo && salvo.aConferir));
  }

  /* ---- Q11: campo que a pessoa CORRIGIU deixa de ser suposição ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurColar").value = JSON.stringify({ do_texto: { tribunal: "STF", classe: "ADI",
      numero: "2405", orgao: "Tribunal Pleno", tese_curta: "tese de teste da adi" } });
    api.jurAoColarNaCaixa();
    await new Promise((r) => setTimeout(r, 5));
    /* sem pedido anterior, nada e' verificavel: tudo a conferir */
    ok(Object.keys(api.jurConferirFormAtual()).indexOf("orgao") >= 0,
       "Q11-pre sem texto de base o orgao devia ficar a conferir");
    api.$("jurOrgao").value = "Segunda Turma";        /* a pessoa conferiu e corrigiu */
    await api.jurSalvar();
    const salvo = api.jurDoTopico(api.matChave("Direito Tributário", "Tributos"))[0];
    ok(salvo.orgao === "Segunda Turma" && salvo.aConferir.indexOf("orgao") < 0,
       "Q11 o campo que a pessoa corrigiu continua marcado a conferir: "
       + JSON.stringify(salvo.aConferir));
    ok(salvo.aConferir.indexOf("classe") >= 0,
       "Q11a o que a pessoa NAO mexeu perdeu a marca: " + JSON.stringify(salvo.aConferir));
  }

  /* ---- Q12: paráfrase avisa na pílula, e o "onde conferir" aparece ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurColar").value = JSON.stringify({
      tipo_do_texto: "parafrase_ou_resumo", onde_conferir: "portal.stf.jus.br, busca por SV 29",
      do_texto: { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
        tese_curta: PARAFRASE_SV29, tese_e_transcricao_oficial: false } });
    api.jurAoColarNaCaixa();
    await new Promise((r) => setTimeout(r, 5));
    const av = api.$("jurColarAviso").textContent || "";
    ok(/paráfrase/.test(av),
       "Q12 a pilula nao avisa que a frase colada nao e' o enunciado oficial: " + av);
    ok(/portal\.stf\.jus\.br/.test(av), "Q12a a pilula nao diz onde conferir: " + av);
  }

  /* ---- Q13: a lista mostra o selo e o "conferi" limpa ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "RE", numero: "1",
      data: "2017-03-15", aConferir: ["data"] }, "Direito Tributário", "Tributos");
    api.jurAbrir("Direito Tributário", "Tributos", "ler");
    const selos = api.$("jurLista").querySelectorAll(".jur-sel");
    ok(selos.some((x) => /a conferir/.test(x.textContent || "")),
       "Q13 a lista nao marca o julgado com dado a conferir: "
       + selos.map((x) => x.textContent).join("|"));
    const ic = api.$("jurLista").querySelectorAll(".jur-ic")
      .filter((b) => /conferidos|confer/i.test(b.title || ""))[0];
    ok(!!ic, "Q13a nao ha o botao de marcar como conferido");
    if (ic) {
      ic.onclick();
      ok(api.jurDe(j.id).aConferir.length === 0, "Q13b 'conferi' nao limpou a marca");
      ok(!api.$("jurLista").querySelectorAll(".jur-sel").some((x) => /a conferir/.test(x.textContent || "")),
         "Q13c o selo continuou na lista depois de conferir");
    }
  }

  /* ---- Q14: unir dois julgados leva a marca do campo que veio do outro ---- */
  {
    const { api } = rodar();
    const a = guardar(api, { tribunal: "STF", classe: "RE", numero: "9" },
      "Direito Tributário", "Tributos");
    const b = guardar(api, { tribunal: "STF", classe: "RE", numero: "9", data: "2001-01-01",
      aConferir: ["data"] }, "Direito Tributário", "Tributos");
    const u = api.jurUnir(a.id, b.id);
    ok(u && u.data === "2001-01-01" && u.aConferir.indexOf("data") >= 0,
       "Q14 unir trouxe o campo mas perdeu a marca 'a conferir': " + JSON.stringify(u && u.aConferir));
  }

  /* =================================================================
   * S: A TELA DE ENTRADA — três passos, origem de cada campo, memória opt-in
   *
   * POR QUE ISTO EXISTE. A entrada era uma caixa que trocava de papel e um
   * botão que trocava de rótulo: o caminho só existia na cabeça de quem já
   * o conhecia. E um campo preenchido não dizia se veio do tribunal ou da
   * memória da IA — a diferença que decide se dá para decorar.
   * =============================================================== */
  const lerPassos = (api) => [1, 2, 3].map((n) => api.$("jurPasso" + n)).map((c) =>
    /atual/.test(c.className || "") ? "A" : (/feito/.test(c.className || "") ? "F" : "-")).join("");
  const espera = () => new Promise((r) => setTimeout(r, 5));

  /* ---- S1: os três passos acompanham o estado ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    ok(lerPassos(api) === "A--", "S1 vazio devia acender o passo 1: " + lerPassos(api));
    const aj1 = api.$("jurPassoAjuda").textContent;
    api.$("jurColar").value = "RE 574706 / PR — PARANÁ\nJulgamento: 15/03/2017 — Tribunal Pleno";
    api.jurPintarPrincipal();
    ok(lerPassos(api) === "FA-", "S1a com texto colado devia acender o passo 2: " + lerPassos(api));
    const aj2 = api.$("jurPassoAjuda").textContent;
    api.jurColar();
    ok(lerPassos(api) === "FFA", "S1b com campos lidos devia acender o passo 3: " + lerPassos(api));
    const aj3 = api.$("jurPassoAjuda").textContent;
    ok(aj1 && aj2 && aj3 && aj1 !== aj2 && aj2 !== aj3,
       "S1c a linha de ajuda nao muda com o passo: " + [aj1, aj2, aj3].join(" | "));
    api.jurLimparForm();
    ok(lerPassos(api) === "A--", "S1d limpar nao voltou ao passo 1: " + lerPassos(api));
  }

  /* ---- S2: só a identificação já serve ("STF SV 29"), sem ementa nenhuma ---- */
  {
    const { api } = rodar();
    const a = api.jurIdentificar("STF SV 29");
    ok(a.tribunal === "STF" && a.classe === "Súmula Vinculante" && a.numero === "29",
       "S2 'STF SV 29' nao foi identificado: " + JSON.stringify([a.tribunal, a.classe, a.numero]));
    ok(api.jurIdentificar("ASV 29 qualquer").classe === "",
       "S2a 'SV' dentro de outra palavra virou classe");
    ok(api.jurIdentificar("SV 2019 foi o ano").classe === "",
       "S2b 'SV 2019' (ano de 4 digitos) virou súmula vinculante");
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurColar").value = "STF SV 29";
    api.jurPintarPrincipal();
    api.jurColar();
    ok(api.$("jurTribunal").value === "STF" && api.$("jurClasse").value === "Súmula Vinculante"
       && api.$("jurNumero").value === "29",
       "S2c ler e preencher nao preencheu tribunal/classe/numero a partir da identificacao");
  }

  /* ---- S3: cada campo diz de onde veio ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.navegador.clipboard = { writeText: async () => {} };
    const EMENTA = "RE 574706 / PR\nJulgamento: 15/03/2017 — Tribunal Pleno\nTese: O ICMS não compõe a base de cálculo para fins de incidência do PIS e da COFINS, por não representar faturamento.";
    api.$("jurColar").value = EMENTA;
    api.jurPedirIA();
    await espera();
    api.$("jurColar").value = JSON.stringify({ do_texto: { tribunal: "STF", classe: "RE",
      numero: "574706", data_julgamento: "2017-03-15", orgao: "Primeira Turma",
      tese_curta: "tese de teste" } });
    api.jurAoColarNaCaixa();
    await espera();
    const o = (k) => api.$("jurOrigem_" + k);
    ok(/do texto/.test(o("data").textContent || "") && /texto/.test(o("data").className),
       "S3 a data confirmada no texto nao mostra 'do texto': " + o("data").textContent);
    ok(/a conferir/.test(o("orgao").textContent || "") && /conferir/.test(o("orgao").className),
       "S3a o orgao que o texto nao traz nao mostra 'a conferir': " + o("orgao").textContent);
    ok(api.jurMetaAberta() === true,
       "S3b ha campo a conferir e os campos continuam escondidos: ninguem ve o aviso");
    ok(/multi/.test(api.$("jurColarAviso").className || ""),
       "S3b2 a pilula com varias linhas continua em formato de pilula (vira oval): " + api.$("jurColarAviso").className);
    /* corrigir o campo tira a marca: agora ele e' da pessoa */
    api.$("jurOrgao").value = "Segunda Turma";
    api.$("jurOrgao").oninput();
    ok(!(o("orgao").textContent || ""),
       "S3c o campo corrigido continua marcado: " + o("orgao").textContent);
    /* e a leitura local (texto solto) marca 'do texto', nunca 'a conferir' */
    api.jurLimparForm();
    api.$("jurColar").value = EMENTA;
    api.jurColar();
    ok(/do texto/.test(o("numero").textContent || "") && !/conferir/.test(o("data").className),
       "S3d a leitura local devia marcar 'do texto': " + o("numero").textContent);
  }

  /* ---- S4: o rótulo da data acompanha a categoria (súmula: "aprovada em") ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    const rot = () => api.$("jurRotData").textContent;
    api.$("jurColar").value = "RE 574706 / PR";
    api.jurColar();
    const normal = rot();
    ok(!/aprovada/.test(normal), "S4-pre o rotulo normal ja diz 'aprovada em': " + normal);
    api.jurLimparForm();
    api.$("jurColar").value = "STF SV 29";
    api.jurColar();
    ok(/aprovada em/.test(rot()),
       "S4 numa sumula a data continua 'data do julgamento' (foi o que levou a preencher "
       + "com a data da publicacao): " + rot());
    api.$("jurClasse").value = "RE"; api.$("jurClasse").oninput();
    api.jurLimparForm();
    ok(rot() === normal, "S4a o rotulo nao voltou ao normal depois de limpar: " + rot());
  }

  /* ---- S5: memória é OPT-IN, na entrada e no completar ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    let copiado = "";
    api.navegador.clipboard = { writeText: async (x) => { copiado = x; } };
    const bloco = (p) => (/"de_memoria": \{([^}]*)\}/.exec(p) || [])[1] || "";
    api.$("jurColar").value = "STF SV 29 — Súmula Vinculante 29: É constitucional a adoção, no cálculo do valor de taxa, de um ou mais elementos da base de cálculo própria de determinado imposto, desde que não haja integral identidade.";
    api.jurPedirIA();
    await espera();
    ok(!/relator|data_julgamento/.test(bloco(copiado)),
       "S5 sem marcar nada, o pedido ja deixa a IA lembrar data/relator: " + bloco(copiado));
    api.$("chkJurMemoria").checked = true;
    api.jurPedirIA();
    await espera();
    ok(/relator/.test(bloco(copiado)) && /data_julgamento/.test(bloco(copiado)),
       "S5a marcar 'sugerir de memoria' nao abriu os campos no pedido: " + bloco(copiado));
    /* completar */
    const j = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29", texto: "Súmula Vinculante 29: É constitucional a adoção, no cálculo do valor de taxa, de um ou mais elementos da base de cálculo própria de determinado imposto." },
      "Direito Tributário", "Tributos");
    api.jurCompletarAbrir(j.id);
    api.$("chkJurCplMemoria").checked = false;
    await api.jurCompletarPedir(j.id);
    ok(!/relator|data_julgamento/.test(bloco(copiado)), "S5b completar sem marcar ja abre a memoria");
    api.$("chkJurCplMemoria").checked = true;
    await api.jurCompletarPedir(j.id);
    ok(/relator/.test(bloco(copiado)), "S5c completar marcado nao abriu a memoria");
  }

  /* ---- S6: o app oferece trocar a tese que a IA aponta — com antes/depois e "sim" ---- */
  {
    const { api } = rodar();
    const OFICIAL = "É constitucional a adoção, no cálculo do valor de taxa, de um ou mais "
      + "elementos da base de cálculo própria de determinado imposto, desde que não haja "
      + "integral identidade entre uma base e outra.";
    const j = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
      tese: PARAFRASE_SV29 }, "Direito Tributário", "Tributos");
    api.jurAbrir("Direito Tributário", "Tributos", "ler");
    api.jurCompletarAbrir(j.id);
    api.$("jurCplResposta").value = JSON.stringify({ conferencia: [
      { campo: "tese", trecho: PARAFRASE_SV29, problema: "nao e' o enunciado oficial", sugestao: OFICIAL },
      { campo: "resumo", trecho: "x", problema: "y", sugestao: "z" }] });
    api.jurCompletarLer();
    const bts = Array.from(api.$("jurCplAcoes").children || []);
    ok(bts.length === 1 && /tese/i.test(bts[0].textContent || ""),
       "S6 a conferencia da tese nao virou botao (e so' a tese: " + bts.length + ")");
    /* recusar: nada muda */
    const conduzir = async (p, aceitar) => {
      let pronto = false; p.then(() => { pronto = true; }, () => { pronto = true; });
      for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(aceitar); } catch (e) {} }
      return p;
    };
    const r1 = await conduzir(api.jurTeseSubstituir(j.id, OFICIAL), false);
    ok(r1 === false && api.jurDe(j.id).tese === PARAFRASE_SV29,
       "S6a recusar o 'antes/depois' trocou a tese mesmo assim");
    const r2 = await conduzir(api.jurTeseSubstituir(j.id, OFICIAL), true);
    const dep = api.jurDe(j.id);
    ok(r2 === true && dep.tese === OFICIAL,
       "S6b aceitar nao trocou a tese: " + dep.tese.slice(0, 40));
    ok(dep.aConferir.indexOf("tese") >= 0,
       "S6c a redacao que veio da memoria da IA nao ficou marcada 'a conferir': "
       + JSON.stringify(dep.aConferir));
    ok(api.jurNomeCampo("tese") === "tese", "S6d 'tese' nao tem nome legivel na lista de a conferir");
  }

  /* ---- S7: o link do site oficial aparece quando há o que conferir ---- */
  {
    const { api } = rodar();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurColar").value = JSON.stringify({ do_texto: { tribunal: "STF", classe: "Súmula Vinculante",
      numero: "29", orgao: "Tribunal Pleno", tese_curta: "x" } });
    api.jurAoColarNaCaixa();
    await espera();
    const cx = api.$("jurOficial");
    const a = (cx.children || [])[0];
    ok(cx.hidden === false && a && /portal\.stf\.jus\.br/.test(a.href || ""),
       "S7 nao ha link do site oficial do STF quando ha campo a conferir");
    ok(a && a.target === "_blank" && /noopener/.test(a.rel || ""),
       "S7a o link abre na mesma aba ou sem noopener");
    ok(api.jurPortalOficial("TRF1") === null, "S7b inventou um site para um tribunal que o app nao conhece");
    /* sem nada a conferir, sem link */
    api.jurLimparForm();
    api.$("jurColar").value = "RE 574706 / PR";
    api.jurColar();
    ok(api.$("jurOficial").hidden === true, "S7c o link aparece sem haver nada a conferir");
    /* na lista, ao lado do selo */
    const j = guardar(api, { tribunal: "STF", classe: "RE", numero: "1", aConferir: ["data"] },
      "Direito Tributário", "Tributos");
    api.jurAbrir("Direito Tributário", "Tributos", "ler");
    const lnk = api.$("jurLista").querySelectorAll(".jur-oficial-lnk");
    ok(lnk.length >= 1 && /portal\.stf/.test(lnk[0].href || ""),
       "S7d a lista nao traz o link oficial ao lado do 'a conferir'");
  }

  /* =================================================================
   * S8: QUANDO A RESPOSTA NÃO VIRA JSON, A TELA APONTA ONDE — NÃO SÓ QUE FALHOU
   *
   * O CASO REAL (v17.42.0/v17.43.0): a IA respondeu "completar e conferir"
   * do Tema 299/STF citando a própria tese oficial (que já vem entre aspas)
   * dentro de "sugestao", sem escapar as aspas internas. jurJsonDoTexto
   * recusava a resposta inteira, e a mensagem era sempre a mesma frase
   * genérica, qualquer que fosse o defeito. jurDiagnosticoJson usa a
   * posição que o próprio JSON.parse já sabe para dizer ONDE, e a tela
   * seleciona esse trecho na caixa de colar — sem tentar consertar nada.
   * ================================================================= */
  {
    /* função pura: os quatro motivos, isolados */
    const { api } = rodar();
    ok(api.jurDiagnosticoJson("   ").motivo === "vazio", "S8a caixa em branco (só espaço)");
    ok(api.jurDiagnosticoJson("Claro! Aqui está.").motivo === "sem_chaves",
       "S8b sem um '{' sequer (colou outra coisa)");
    const cortada = '{"tribunal": "STF", "classe": "Tema"';
    const dCortada = api.jurDiagnosticoJson(cortada);
    ok(dCortada.motivo === "sem_fechamento" && dCortada.ini === 0 && dCortada.fim === cortada.length,
       "S8c abre '{' e nunca fecha: aponta do começo ao fim da resposta: " + JSON.stringify(dCortada));

    /* o caso real: a tese oficial (já entre aspas) citada sem escapar dentro de "sugestao" */
    const TESE = "É inconstitucional a incidência do ISS sobre operações de industrialização por encomenda.";
    const respostaReal = '{"identificacao": "Tema 299", "conferencia": [{"campo": "tese", '
      + '"trecho": "x", "problema": "y", "sugestao": "Substituir pelo enunciado oficial: "' + TESE + '""}]}';
    const d = api.jurDiagnosticoJson(respostaReal);
    ok(d.motivo === "sintaxe" && d.causa === "aspas",
       "S8d o caso real (aspas da tese oficial sem escapar) e' diagnosticado como 'aspas': " + JSON.stringify(d));
    ok(respostaReal[d.ini] === "É",
       "S8e a posicao apontada cai exatamente onde o texto solto comeca: "
       + JSON.stringify(respostaReal.slice(Math.max(0, d.ini - 15), d.ini + 15)));
    ok(api.jurJsonDoTexto(respostaReal) === null,
       "S8f confirmando a premissa: essa resposta continua SEM virar JSON (o app nao tenta consertar)");

    /* falta de vírgula entre dois campos: mesma mensagem genérica ("Expected...
     * after property value"), mas o caractere seguinte é aspas — não é o padrão de aspas internas */
    const semVirgula = '{"a": "hello" "b": "x"}';
    const dv = api.jurDiagnosticoJson(semVirgula);
    ok(dv.motivo === "sintaxe" && dv.causa === "outro",
       "S8g falta de virgula (o proximo token e' aspas, nao texto solto) nao vira 'aspas': " + JSON.stringify(dv));

    /* JSON de verdade: sem motivo nenhum a apontar (a função só é chamada quando já falhou) */
    ok(api.jurDiagnosticoJson('{"a": 1}').motivo === "outro",
       "S8h JSON valido: nao ha erro do JSON.parse, entao nao ha o que apontar (motivo 'outro')");
  }

  /* ---- S9: a tela usa o diagnóstico — seleciona o trecho e troca a cor da caixa de saída ---- */
  {
    const { api } = rodar();
    const j = guardar(api, { tribunal: "STF", classe: "Tema", numero: "299" }, "Direito Tributário", "Tributos");
    api.jurCompletarAbrir(j.id);
    const TESE = "É inconstitucional a incidência do ISS sobre operações de industrialização por encomenda.";
    const respostaReal = '{"identificacao": "Tema 299", "conferencia": [{"campo": "tese", '
      + '"trecho": "x", "problema": "y", "sugestao": "Substituir pelo enunciado oficial: "' + TESE + '""}]}';
    api.$("jurCplResposta").value = respostaReal;
    api.jurCompletarLer();
    const saida = api.$("jurCplSaida");
    ok(saida.hidden === false && /jur-cpl-saida-erro/.test(saida.className),
       "S9 a caixa de saida ganha a cor de erro quando a resposta nao vira JSON: " + saida.className);
    ok(/aspas/i.test(saida.textContent) && !/^Não entendi essa resposta como JSON\./.test(saida.textContent),
       "S9a a mensagem agora e' especifica (aspas internas), nao mais a frase generica: " + saida.textContent);
    const ta = api.$("jurCplResposta");
    ok(ta.selectionStart > 0 && ta.selectionEnd === ta.selectionStart + 1,
       "S9b o trecho problematico foi selecionado na propria caixa (o feedback visual): "
       + JSON.stringify([ta.selectionStart, ta.selectionEnd]));
    ok(respostaReal.slice(ta.selectionStart, ta.selectionEnd) === "É",
       "S9c a selecao cai exatamente sobre onde o texto solto comeca, nao num ponto qualquer: "
       + JSON.stringify(respostaReal.slice(ta.selectionStart, ta.selectionEnd)));

    /* resposta cortada: seleciona do começo ao fim, mensagem de "cortada" */
    api.$("jurCplResposta").value = '{"tribunal": "STF"';
    api.jurCompletarLer();
    ok(/cortada/i.test(saida.textContent), "S9d resposta sem fechar '{' avisa que parece cortada: " + saida.textContent);
    ok(ta.selectionStart === 0 && ta.selectionEnd === api.$("jurCplResposta").value.length,
       "S9e a selecao cobre a resposta inteira (nao ha um ponto so' para apontar)");

    /* sucesso: a caixa volta ao estilo normal (sem a classe de erro) */
    api.$("jurCplResposta").value = JSON.stringify({ do_texto: { classe: "Tema" } });
    api.jurCompletarLer();
    ok(!/jur-cpl-saida-erro/.test(saida.className), "S9f uma leitura com sucesso tira a cor de erro: " + saida.className);
  }

  /* =================================================================
   * P: PRECEDENTES — os processos que originaram a súmula ou o tema
   *
   * POR QUE ISTO EXISTE. No caso da SV 29 a IA, sem ter onde pôr a
   * informação certa (o RE 576.321 QO-RG que originou a súmula), pôs no
   * "relator" o nome do presidente da sessão de aprovação. Súmula e tema
   * não têm relator; têm PRECEDENTES.
   * =============================================================== */

  /* ---- P1: a leitura local acha "Precedentes: ..." no texto ---- */
  {
    const { api } = rodar();
    const a = api.jurIdentificar("Súmula Vinculante 29\nPrecedentes representativos: "
      + "RE 576.321 QO-RG, AI 441038 AgR\nOutra linha qualquer");
    ok(/RE 576\.321 QO-RG, AI 441038 AgR/.test(a.precedentes) && !/Outra linha/.test(a.precedentes),
       "P1 os precedentes nao foram lidos do texto (ou levaram a linha seguinte): "
       + JSON.stringify(a.precedentes));
    ok(api.jurIdentificar("RE 574706 / PR").precedentes === "",
       "P1a inventou precedentes onde o texto nao diz nada");
  }

  /* ---- P2: a resposta da IA traz precedentes como texto ou como lista ---- */
  {
    const { api } = rodar();
    const t1 = api.jurDoJson(JSON.stringify({ do_texto: { classe: "Súmula Vinculante", numero: "29",
      precedentes: "RE 576321 QO-RG" } }));
    ok(t1 && t1.precedentes === "RE 576321 QO-RG", "P2 precedentes em texto nao chegaram: " + (t1 && t1.precedentes));
    const t2 = api.jurDoJson(JSON.stringify({ classe: "Tema", numero: "69",
      precedentes: ["RE 574706", "RE 240785"] }));
    ok(t2 && t2.precedentes === "RE 574706; RE 240785", "P2a lista de precedentes nao virou texto: " + (t2 && t2.precedentes));
    const t3 = api.jurDoJson(JSON.stringify({ classe: "Tema", numero: "69",
      de_memoria: { precedentes: ["RE 1", "RE 2"] } }));
    ok(t3 && t3.deMemoria.precedentes === "RE 1; RE 2", "P2b precedentes de memoria nao chegaram");
  }

  /* ---- P3: "faltam precedentes" só para súmula e tema ---- */
  {
    const { api } = rodar();
    const sum = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29" },
      "Direito Tributário", "Tributos");
    const acor = guardar(api, { tribunal: "STF", classe: "RE", numero: "574706" },
      "Direito Tributário", "Tributos");
    const tema = guardar(api, { tribunal: "STF", classe: "Tema", numero: "69" },
      "Direito Tributário", "Tributos");
    ok(api.jurFaltando(sum).indexOf("precedentes") >= 0, "P3 sumula sem precedentes nao conta como faltando");
    ok(api.jurFaltando(tema).indexOf("precedentes") >= 0, "P3a tema sem precedentes nao conta como faltando");
    ok(api.jurFaltando(acor).indexOf("precedentes") < 0,
       "P3b um acordao isolado ganhou 'faltam precedentes' (inflaria o 'faltam N' de todos)");
    api.jurGravar({ id: sum.id, precedentes: "RE 576321" });
    ok(api.jurFaltando(api.jurDe(sum.id)).indexOf("precedentes") < 0, "P3c com precedentes ainda conta como faltando");
  }

  /* ---- P4: precedentes vindos da IA são conferidos no texto (todos os números) ---- */
  {
    const { api } = rodar();
    const BASE = "Precedentes: RE 576.321 QO-RG e AI 441.038 AgR";
    ok(api.jurValorNoTexto("precedentes", "RE 576321 QO-RG; AI 441038 AgR", BASE),
       "P4 precedentes presentes no texto nao foram confirmados");
    ok(!api.jurValorNoTexto("precedentes", "RE 576321; RE 999999", BASE),
       "P4a um precedente que o texto nao traz foi dado como confirmado");
    ok(!api.jurValorNoTexto("precedentes", "RE 576321", ""), "P4b sem texto de base nada se confirma");
    const j = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
      tese: "tese qualquer" }, "Direito Tributário", "Tributos");
    const r = api.jurCompletar(j.id, { do_texto: { precedentes: "RE 576321 QO-RG" } });
    ok(r.mudou.indexOf("precedentes") >= 0 && api.jurDe(j.id).aConferir.indexOf("precedentes") >= 0,
       "P4c precedentes que a IA trouxe sem texto guardado nao ficaram a conferir: "
       + JSON.stringify(api.jurDe(j.id).aConferir));
    const k = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
      texto: BASE }, "Direito Tributário", "Tributos");
    api.jurCompletar(k.id, { do_texto: { precedentes: "RE 576321 QO-RG; AI 441038 AgR" } });
    ok(api.jurDe(k.id).precedentes && api.jurDe(k.id).aConferir.indexOf("precedentes") < 0,
       "P4d precedentes confirmados no texto guardado ficaram a conferir");
  }

  /* ---- P5: o pedido à IA fala de precedentes só onde faz sentido ---- */
  {
    const { api } = rodar();
    const sum = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29" },
      "Direito Tributário", "Tributos");
    const acor = guardar(api, { tribunal: "STF", classe: "RE", numero: "574706" },
      "Direito Tributário", "Tributos");
    const faltaDe = (p) => (/CAMPOS VAZIOS QUE QUERO PREENCHER: ([^\n]*)/.exec(p) || [])[1] || "";
    ok(/precedentes/.test(faltaDe(api.jurPromptCompletar(sum, "T"))),
       "P5 o pedido para uma sumula nao lista 'precedentes' entre os vazios");
    ok(!/precedentes/.test(faltaDe(api.jurPromptCompletar(acor, "T"))),
       "P5a o pedido para um acordao pede precedentes");
    ok(/"precedentes":/.test(api.jurPromptCompletar(sum, "T")) && /processos que a originaram/.test(api.jurPromptCompletar(sum, "T")),
       "P5b o formato/regra de precedentes nao esta no pedido");
    const bloco = (p) => (/"de_memoria": \{([^}]*)\}/.exec(p) || [])[1] || "";
    ok(!/precedentes/.test(bloco(api.jurPromptCompletar(sum, "T"))),
       "P5c por padrao a IA pode lembrar precedentes de memoria");
    ok(/precedentes/.test(bloco(api.jurPromptCompletar(sum, "T", { memoria: "tudo" }))),
       "P5d a memoria total nao inclui precedentes");
  }

  /* ---- P6: na tela — colar, conferir, guardar, ver na lista, editar, limpar ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurColar").value = JSON.stringify({ do_texto: { tribunal: "STF", classe: "Súmula Vinculante",
      numero: "29", precedentes: "RE 576321 QO-RG", tese_curta: "tese de teste" } });
    api.jurAoColarNaCaixa();
    await espera();
    ok(api.$("jurPrecedentes").value === "RE 576321 QO-RG",
       "P6 os precedentes da resposta nao entraram no formulario");
    ok(/a conferir/.test(api.$("jurOrigem_precedentes").textContent || ""),
       "P6a precedentes que o texto enviado nao traz nao mostram 'a conferir'");
    await api.jurSalvar();
    const salvo = api.jurDoTopico(api.matChave("Direito Tributário", "Tributos"))[0];
    ok(salvo.precedentes === "RE 576321 QO-RG" && salvo.aConferir.indexOf("precedentes") >= 0,
       "P6b o julgado guardado perdeu os precedentes ou a marca: " + JSON.stringify([salvo.precedentes, salvo.aConferir]));
    api.jurAbrir("Direito Tributário", "Tributos", "ler");
    const linhas = api.$("jurLista").querySelectorAll(".jur-prec");
    ok(linhas.length === 1 && /RE 576321 QO-RG/.test(linhas[0].textContent || ""),
       "P6c a lista nao mostra os precedentes");
    api.jurEditar(salvo.id);
    ok(api.$("jurPrecedentes").value === "RE 576321 QO-RG", "P6d editar nao carregou os precedentes");
    api.jurLimparForm();
    ok(api.$("jurPrecedentes").value === "", "P6e limpar os campos deixou os precedentes");
    ok(/Precedentes: RE 576321 QO-RG/.test(api.jurTexto([salvo])), "P6f a copia do julgado perdeu os precedentes");
  }

  /* ---- P7: unir dois julgados leva os precedentes ---- */
  {
    const { api } = rodar();
    const a = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29" },
      "Direito Tributário", "Tributos");
    const b = guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29",
      precedentes: "RE 576321", aConferir: ["precedentes"] }, "Direito Tributário", "Tributos");
    const u = api.jurUnir(a.id, b.id);
    ok(u && u.precedentes === "RE 576321" && u.aConferir.indexOf("precedentes") >= 0,
       "P7 unir perdeu os precedentes (ou a marca): " + JSON.stringify(u && [u.precedentes, u.aConferir]));
  }

  /* =================================================================
   * M: O MENU "MAIS" DA ENTRADA — caminho principal à vista, utilidades num toque
   *
   * POR QUE ISTO EXISTE. A entrada tinha oito botões de peso parecido
   * (perguntar à IA, ler e preencher, escrever à mão, ver os dados,
   * limpar, voltar…). Nada dizia quais eram o caminho e quais eram
   * utilidade — a mesma confusão do diálogo de diagnóstico.
   * =============================================================== */
  const htmlIdx = require("fs").readFileSync(
    require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
  const dlgJuris = (() => {
    const a = htmlIdx.indexOf('<dialog id="dlgJuris"');
    return htmlIdx.slice(a, htmlIdx.indexOf("</dialog>", a));
  })();
  const posJ = (id) => dlgJuris.indexOf('id="' + id + '"');

  /* ---- M1: o principal e o "ler e preencher" ficam FORA do menu; as utilidades DENTRO ---- */
  {
    const ini = posJ("jurMais");
    const fim = dlgJuris.indexOf("</details>", ini);
    ok(ini > 0 && fim > ini, "M1-pre nao ha o menu 'mais' (<details id=jurMais>) na entrada");
    const dentro = (id) => posJ(id) > ini && posJ(id) < fim;
    ["btnJurAMao", "btnJurLimpar", "btnJurVoltarLer", "chkJurMemoria"].forEach((id) => {
      ok(dentro(id), "M1 '" + id + "' devia estar dentro do menu 'mais'");
    });
    ["btnJurPrincipal", "btnJurColar", "btnJurMeta"].forEach((id) => {
      const vezes = dlgJuris.split('id="' + id + '"').length - 1;
      ok(vezes === 1 && posJ(id) > 0 && !dentro(id),
         "M1a '" + id + "' nao devia estar no menu (e' o caminho principal), nem duplicado: " + vezes + " vez(es)");
    });
    ok(dlgJuris.indexOf("jur-salvar-lin") < 0, "M1b sobrou a linha antiga de limpar/voltar fora do menu");
    ok(/<details[^>]*id="jurMais"(?![^>]*\bopen\b)/.test(dlgJuris), "M1c o menu nasce aberto");
  }

  /* ---- M2: os itens mantêm as regras de quando aparecem ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    ok(api.$("btnJurVoltarLer").hidden === true, "M2 'voltar para a leitura' aparece sem haver o que ler");
    guardar(api, { tribunal: "STF", classe: "RE", numero: "1" }, "Direito Tributário", "Tributos");
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    ok(api.$("btnJurVoltarLer").hidden === false, "M2a com julgado guardado 'voltar para a leitura' nao aparece");
    ok(api.$("btnJurAMao").hidden === false, "M2b 'escrever a tese a mao' devia aparecer com os campos escondidos");
    api.jurConteudoVisivel(true);
    ok(api.$("btnJurAMao").hidden === true, "M2c 'escrever a tese a mao' continua depois que os campos abriram");
  }

  /* ---- M3: escolher um item fecha o menu; marcar a caixa de memória não ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurMais").open = true;
    api.$("jurMaisCorpo").onclick({ target: { tagName: "INPUT" } });
    ok(api.$("jurMais").open === true, "M3 marcar a caixa de memoria fechou o menu (quem a marca ainda vai pedir)");
    api.$("jurMaisCorpo").onclick({ target: { tagName: "BUTTON" } });
    ok(api.$("jurMais").open === false, "M3a escolher um botao do menu nao o fechou");
    api.$("jurMais").open = true;
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    ok(api.$("jurMais").open === false, "M3b o menu reabriu ja aberto (deve nascer sempre fechado)");
  }

  /* ---- M4: o botão do menu funciona (limpar limpa) e a ajuda do passo 1 aponta para ele ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurTese").value = "algo";
    api.$("btnJurLimpar").onclick();
    ok(api.$("jurTese").value === "", "M4 o 'limpar' dentro do menu nao limpou");
    ok(/mais/i.test(api.$("jurPassoAjuda").textContent || ""),
       "M4a a ajuda do passo 1 nao diz onde escrever a tese a mao: " + api.$("jurPassoAjuda").textContent);
  }

  /* =================================================================
   * CC: DE QUE CONCURSO É UM TÓPICO QUE SÓ TEM JULGADO
   *
   * POR QUE ISTO EXISTE. A SV 29, guardada num tópico do ISS Caruaru que
   * ainda não tinha resumo, aparecia na estante em "Sem concurso
   * registrado": o resumo é gravado com o concurso do edital aberto, mas
   * o julgado nunca gravou concurso nenhum, e a linha só-de-julgado
   * nascia com concurso vazio.
   * =============================================================== */
  const EDITAL_ISS = "# ISS Caruaru Auditor Fiscal | prova: 2026-11-29 | horas: 40\n"
    + "@ Sistema Tributário Brasileiro :: 5\n+ Tributos e suas espécies :: 5\n+ Lançamento :: 5\n"
    + "@ Português :: 4\n+ Crase :: 5";
  const EDITAL_OUTRO = "# TCE Exemplo Auditor | prova: 2027-03-10 | horas: 30\n"
    + "@ Sistema Tributário Brasileiro :: 5\n+ Tributos e suas espécies :: 5\n"
    + "@ Direito Financeiro :: 4\n+ Restos a pagar :: 3";
  const soJuris = (api, disc, top) => api.matSoJuris()
    .filter((x) => x.disciplina === disc && x.topico === top)[0];
  const gruposDe = (api) => Array.from(api.matAgrupado("").keys());

  /* ---- CC1: tópico que só está num edital herda o concurso dele ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    guardar(api, { tribunal: "STF", classe: "Súmula Vinculante", numero: "29" },
      "Sistema Tributário Brasileiro", "Tributos e suas espécies");
    const linha = soJuris(api, "Sistema Tributário Brasileiro", "Tributos e suas espécies");
    ok(linha && linha.concurso === "ISS Caruaru Auditor Fiscal",
       "CC1 o julgado de um topico do ISS Caruaru continua sem concurso: " + JSON.stringify(linha && linha.concurso));
    ok(gruposDe(api).indexOf("ISS Caruaru Auditor Fiscal") >= 0 && gruposDe(api).indexOf("") < 0,
       "CC1a a estante ainda joga o julgado em 'Sem concurso registrado': " + JSON.stringify(gruposDe(api)));
  }

  /* ---- CC2: a comparação ignora acento e caixa (o edital e o julgado podem diferir nisso) ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    guardar(api, { tribunal: "STF", classe: "RE", numero: "1" },
      "sistema tributario brasileiro", "TRIBUTOS E SUAS ESPECIES");
    const linha = api.matSoJuris()[0];
    ok(linha && linha.concurso === "ISS Caruaru Auditor Fiscal",
       "CC2 acento/caixa diferentes impediram de achar o edital: " + JSON.stringify(linha && linha.concurso));
  }

  /* ---- CC3: em dois editais de concursos diferentes, NÃO chuta ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    api.edCriar("TCE", EDITAL_OUTRO);
    guardar(api, { tribunal: "STF", classe: "RE", numero: "2" },
      "Sistema Tributário Brasileiro", "Tributos e suas espécies");
    const linha = soJuris(api, "Sistema Tributário Brasileiro", "Tributos e suas espécies");
    ok(linha && linha.concurso === "",
       "CC3 o topico esta em dois concursos e o app escolheu um deles: " + JSON.stringify(linha && linha.concurso));
    /* a menos que um dos dois seja o edital aberto agora: aí a pessoa disse qual */
    ok(api.matConcursoDoTopico("Sistema Tributário Brasileiro", "Tributos e suas espécies",
         "TCE Exemplo Auditor") === "TCE Exemplo Auditor",
       "CC3a com o concurso aberto entre os candidatos, ele devia desempatar");
    ok(api.matConcursoDoTopico("Sistema Tributário Brasileiro", "Tributos e suas espécies",
         "Outro Concurso Qualquer") === "",
       "CC3b o 'preferido' que nao esta entre os candidatos foi aceito");
  }

  /* ---- CC4: dois editais com o MESMO nome de concurso (ex.: uma cópia) não são ambiguidade ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    api.edCriar("ISS (copia)", EDITAL_ISS);
    ok(api.matConcursoDoTopico("Português", "Crase") === "ISS Caruaru Auditor Fiscal",
       "CC4 uma copia do mesmo edital foi tomada como um segundo concurso");
  }

  /* ---- CC5: tópico que não é de edital nenhum continua "sem concurso" (e diz a verdade) ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    guardar(api, { tribunal: "STF", classe: "RE", numero: "3" }, "Matéria Avulsa", "Tópico Solto");
    const linha = soJuris(api, "Matéria Avulsa", "Tópico Solto");
    ok(linha && linha.concurso === "", "CC5 um topico fora de qualquer edital ganhou concurso: " + JSON.stringify(linha && linha.concurso));
    ok(gruposDe(api).indexOf("") >= 0, "CC5a o grupo 'sem concurso' devia continuar existindo para ele");
  }

  /* ---- CC6: o concurso que o julgado JÁ TEM vale mais que a inferência ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    guardar(api, { tribunal: "STF", classe: "RE", numero: "4", concurso: "Concurso Gravado" },
      "Sistema Tributário Brasileiro", "Tributos e suas espécies");
    ok(soJuris(api, "Sistema Tributário Brasileiro", "Tributos e suas espécies").concurso === "Concurso Gravado",
       "CC6 a inferencia sobrescreveu o concurso que o julgado ja tinha");
  }

  /* ---- CC7: edital sem nome no cabeçalho não inventa concurso ---- */
  {
    const { api } = rodar();
    api.edCriar("Sem nome", "@ Português :: 4\n+ Crase :: 5");
    ok(api.matConcursoDoTopico("Português", "Crase") === "",
       "CC7 edital sem nome de concurso no cabecalho produziu um concurso");
    /* e um edital sem nome NAO transforma um topico de um concurso so em ambiguidade */
    api.edCriar("ISS", EDITAL_ISS);
    ok(api.matConcursoDoTopico("Português", "Crase") === "ISS Caruaru Auditor Fiscal",
       "CC7a um edital sem nome tornou ambiguo um topico que so pertence a um concurso");
  }

  /* ---- CC8: ao GUARDAR um julgado, o concurso já é gravado (e não é sobrescrito ao editar) ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    api.jurIniciarTela();
    api.jurAbrir("Sistema Tributário Brasileiro", "Tributos e suas espécies", "incluir");
    api.$("jurTese").value = "tese de teste da SV 29";
    api.$("jurClasse").value = "Súmula Vinculante"; api.$("jurNumero").value = "29";
    await api.jurSalvar();
    const salvo = api.jurDoTopico(api.matChave("Sistema Tributário Brasileiro", "Tributos e suas espécies"))[0];
    ok(salvo && salvo.concurso === "ISS Caruaru Auditor Fiscal",
       "CC8 o julgado foi guardado sem o concurso do topico: " + JSON.stringify(salvo && salvo.concurso));
    /* editar um julgado que ja tem concurso nao o troca (mesmo com outro edital aberto depois) */
    api.jurGravar({ id: salvo.id, concurso: "Gravado Antes" });
    api.jurEditar(salvo.id);
    api.$("jurTese").value = "tese editada";
    await api.jurSalvar();
    ok(api.jurDe(salvo.id).concurso === "Gravado Antes",
       "CC8a editar o julgado trocou o concurso que ele ja tinha: " + api.jurDe(salvo.id).concurso);
    /* tópico fora de edital: guarda sem concurso (verdade > palpite) */
    api.jurAbrir("Matéria Avulsa", "Tópico Solto", "incluir");
    api.$("jurTese").value = "tese avulsa";
    await api.jurSalvar();
    const avulso = api.jurDoTopico(api.matChave("Matéria Avulsa", "Tópico Solto"))[0];
    ok(avulso && !avulso.concurso, "CC8b um topico fora de edital ganhou concurso: " + JSON.stringify(avulso && avulso.concurso));
  }

  /* ---- CC9: quando o tópico GANHA um resumo, o concurso dele passa a ser o do resumo (não some do grupo) ---- */
  {
    const { api } = rodar();
    api.edCriar("ISS", EDITAL_ISS);
    guardar(api, { tribunal: "STF", classe: "RE", numero: "5" },
      "Sistema Tributário Brasileiro", "Tributos e suas espécies");
    api.matGravar(api.matChave("Sistema Tributário Brasileiro", "Tributos e suas espécies"), "resumo x",
      { disciplina: "Sistema Tributário Brasileiro", topico: "Tributos e suas espécies",
        concurso: "ISS Caruaru Auditor Fiscal" });
    ok(soJuris(api, "Sistema Tributário Brasileiro", "Tributos e suas espécies") === undefined,
       "CC9-pre o topico com resumo ainda vira linha so-de-julgado");
    ok(gruposDe(api).length === 1 && gruposDe(api)[0] === "ISS Caruaru Auditor Fiscal",
       "CC9 o topico com resumo e julgado saiu do grupo do concurso: " + JSON.stringify(gruposDe(api)));
  }

  /* ---- CC10: unir dois julgados leva o concurso ---- */
  {
    const { api } = rodar();
    const a = guardar(api, { tribunal: "STF", classe: "RE", numero: "9" }, "Direito Tributário", "Tributos");
    const b = guardar(api, { tribunal: "STF", classe: "RE", numero: "9", concurso: "ISS Caruaru Auditor Fiscal" },
      "Direito Tributário", "Tributos");
    const u = api.jurUnir(a.id, b.id);
    ok(u && u.concurso === "ISS Caruaru Auditor Fiscal", "CC10 unir perdeu o concurso: " + JSON.stringify(u && u.concurso));
  }

  /* ---- JR: criando ou editando, os julgados guardados ficam RECOLHIDOS (J1, 17.83.0) ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    const T = ["Direito Tributário", "Limitações"];
    [1, 2, 3].forEach((k) => guardar(api, { tribunal: "STF", classe: "ADI", numero: String(100 + k), tese: "Tese " + k }, T[0], T[1]));
    const lista = () => api.$("jurLista"), conta = () => api.$("jurConta"), bt = () => api.$("btnJurOutros");
    api.jurAbrir(T[0], T[1], "ler");
    ok(bt().hidden === true && lista().hidden === false && conta().hidden === false && lista().children.length === 3, "JR1 lendo: a lista aparece inteira e não há botão de 'ver os guardados'");
    api.jurAbrir(T[0], T[1], "incluir");
    ok(lista().hidden === true && conta().hidden === true && bt().hidden === false && /3/.test(bt().textContent) && bt().title.length > 15, "JR2 criando: a lista e a contagem somem, e o botão diz quantos há: " + bt().textContent);
    ok(lista().children.length === 3, "JR2b a lista continua desenhada (só escondida): o botão não precisa recalcular nada");
    bt().onclick();
    ok(lista().hidden === false && conta().hidden === false && /Ocultar|Hide/.test(bt().textContent), "JR3 tocar no botão traz a lista de volta e o botão passa a ocultar");
    bt().onclick();
    ok(lista().hidden === true && /Ver os|Show the/.test(bt().textContent), "JR3b tocar de novo recolhe");
    bt().onclick();
    api.jurTrocarModo("ler");
    ok(lista().hidden === false && bt().hidden === true, "JR4 voltar à leitura mostra a lista e esconde o botão");
    api.jurTrocarModo("incluir");
    ok(lista().hidden === true, "JR4b ao criar de novo a lista volta recolhida (o 'aberto' não vaza entre usos)");
    const um = api.jurLista()[0];
    api.jurTrocarModo("ler");
    api.jurEditar(um.id);
    ok(lista().hidden === true && bt().hidden === false, "JR5 editando um julgado, a lista também fica recolhida");
    bt().onclick();
    api.jurAbrir(T[0], T[1], "incluir");
    ok(lista().hidden === true && /Ver os|Show the/.test(bt().textContent), "JR5b reabrir a gaveta começa recolhido, mesmo que a vez anterior tenha ficado aberta");
    api.jurAbrir(T[0], "Tópico sem julgado", "incluir");
    ok(bt().hidden === true, "JR6 tópico sem julgado: não há o que recolher, e o botão não aparece");
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/@media \(max-width:560px\)\{\s*dialog#dlgJuris\[open\]\{[^}]*width:100vw[^}]*height:100dvh/.test(html), "JR7 no celular a gaveta ocupa a tela toda (regra com [open], invariante E7)");
    ok(/#dlgJuris \.jur-mais\{position:static\}/.test(html) && /#dlgJuris \.jur-mais-corpo\{left:0;right:0;width:auto/.test(html), "JR8 o menu 'mais' se ancora na largura da linha de botões, e não estoura a borda direita");
  }

  /* ---- JV: A RESPOSTA DA IA SEM DADO NENHUM (J2, 17.84.0) ----
   * O caso real: o pedido foi sem texto, a IA devolveu um JSON perfeito com "tipo_do_texto": "vazio" e tudo em branco, e a
   * tela tomou o JSON por EMENTA — o objeto inteiro foi parar na tese e a pílula dizia "Detectado: STF · Tema 214". */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    const VAZIA = JSON.stringify({ tipo_do_texto: "vazio",
      identificacao: "Recurso Extraordinário 582.461/SP do STF (Tema 214 da Repercussão Geral), sobre multas tributárias.",
      do_texto: { tribunal: "", classe: "", numero: "", data_julgamento: "", tese_curta: "", tese_e_transcricao_oficial: false },
      de_memoria: { tribunal: "", classe: "", numero: "", relator: "Min. Gilmar Mendes" },
      onde_conferir: "portal do STF", resumo: "", assuntos: [],
      conferencia: [{ campo: "tese", trecho: "multas moratórias", problema: "não é o enunciado oficial", sugestao: "É válida a multa moratória de 20%." }] }, null, 2);
    const d = api.jurDoJson(VAZIA);
    ok(d && d.semConteudo === true && /582\.461/.test(d.identificacao) && d.conferencia.length === 1 && d.tipoDoTexto === "vazio", "JV1 jurDoJson reconhece uma resposta da IA sem dado e a marca como 'sem conteúdo' (antes devolvia null)");
    ok(api.jurDoJson('{"qualquer": "coisa"}') === null && api.jurDoJson("não é json") === null, "JV1b um objeto qualquer que não tem a cara da resposta continua não sendo julgado");
    ok(api.jurEhJson("```json\n" + VAZIA + "\n```") === true && api.jurEhJson("Aqui está o resultado:\n" + VAZIA + "\nEspero ter ajudado.") === true && api.jurEhJson("RE 574706 / PR — a ementa começa assim") === false, "JV2 a resposta com cerca de markdown ou frase em volta também é reconhecida como JSON; ementa continua não sendo");
    const cerca = api.jurDoJson("```json\n" + JSON.stringify({ do_texto: { tribunal: "STF", classe: "RE", numero: "1" } }) + "\n```");
    ok(cerca && cerca.classe === "RE" && cerca.numero === "1", "JV2b jurDoJson lê a resposta com cerca de markdown (antes só entrava como texto)");
    const p = api.jurIdentificarProcesso("Recurso Extraordinário 582.461/SP do STF (Tema 214 da Repercussão Geral)");
    ok(p.classe === "RE" && p.numero === "582.461" && p.tribunal === "STF" && p.tema === "214", "JV3 a frase que NOMEIA o julgado dá o processo (RE 582.461), e o tema é só apelido: " + JSON.stringify(p));
    ok(api.jurIdentificarProcesso("ADPF 499 e ADI 5835").classe === "ADPF" && api.jurIdentificarProcesso("Súmula Vinculante 29").classe === "" && api.jurIdentificarProcesso("").classe === "", "JV3b siglas simples; súmula/tema sozinhos não viram 'processo'; vazio não quebra");

    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    api.$("jurColar").value = "RE 582461 multas tributárias";      /* o que foi enviado */
    api.navegador.clipboard = { writeText: async () => {} };
    api.jurPedirIA();                                                 /* curto: pede confirmação, que o teste recusa */
    const conduzir = async (p, aceitar) => {
      let pronto = false; p.then(() => { pronto = true; }, () => { pronto = true; });
      for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(aceitar); } catch (e) {} }
      return p;
    };
    api._uiFechar(false);
    await new Promise((r) => setTimeout(r, 5));
    api.$("jurColar").value = VAZIA;
    api.jurColar();
    const v = (id) => api.$(id).value;
    ok(v("jurTese") === "" && v("jurResumo") === "", "JV4 o JSON vazio NÃO vira tese nem resumo (era o defeito: o objeto inteiro na tese)");
    ok(v("jurClasse") === "RE" && v("jurNumero") === "582.461" && v("jurTribunal") === "STF", "JV4b a identificação em frase preenche tribunal, classe e número: " + [v("jurTribunal"), v("jurClasse"), v("jurNumero")].join("|"));
    ok(!/tipo_do_texto|identificacao/.test(v("jurColar")), "JV4c o JSON sai da caixa: " + v("jurColar").slice(0, 60));
    const pil = api.$("jurColarAviso");
    ok(pil.hidden === false && /aviso/.test(pil.className) && !/(^|\s)ok(\s|$)/.test(pil.className), "JV5 a pílula fica de AVISO (âmbar), não verde de sucesso");
    ok(/NÃO RECEBEU texto/.test(pil.textContent) && /Recurso Extraordinário 582\.461/.test(pil.textContent) && /não é o enunciado oficial/.test(pil.textContent) && /cole a ementa ou o enunciado oficial/i.test(pil.textContent), "JV5b a pílula diz POR QUE veio vazio, o que a IA entendeu, o que ela apontou e o que fazer: " + pil.textContent.slice(0, 200));
    ok(!/Tema 214/.test((pil.textContent.match(/Detectado:[^\n]*/) || [""])[0]), "JV5c a pílula não 'detecta' o Tema a partir das chaves do JSON");
    ok(/conferir/.test(api.$("jurOrigem_classe").textContent) && /conferir/.test(api.$("jurOrigem_numero").textContent), "JV6 o que veio da frase da IA fica marcado 'a conferir'");
    /* o que a IA leu do texto vale mais que a frase dela: o tribunal que veio em "do_texto" não é trocado pela identificação */
    api.jurLimparForm();
    api.$("jurColar").value = JSON.stringify({ tipo_do_texto: "so_identificacao", identificacao: "RE 1 do STF", do_texto: { tribunal: "STJ" }, de_memoria: {}, conferencia: [] });
    api.jurColar();
    ok(v("jurTribunal") === "STJ" && v("jurClasse") === "RE" && /só recebeu o nome do julgado/.test(api.$("jurColarAviso").textContent), "JV6b a identificação só preenche o que está vazio (o tribunal lido do texto fica) e o motivo 'só o nome' aparece: " + v("jurTribunal"));
    api.jurLimparForm();
    api.$("jurColar").value = JSON.stringify({ tipo_do_texto: "ementa_acordao", identificacao: "RE 2", do_texto: {}, de_memoria: {} });
    api.jurColar();
    ok(/não tinha dados que ela pudesse extrair/.test(api.$("jurColarAviso").textContent), "JV6c a resposta vazia de um tipo qualquer tem o motivo genérico");
    api.jurLimparForm();
    api.$("jurColar").value = "```json\n" + JSON.stringify({ do_texto: { tribunal: "STF", classe: "ADI", numero: "9", tese_curta: "tese cercada" } }) + "\n```";
    api.jurColar();
    ok(v("jurClasse") === "ADI" && v("jurTese") === "tese cercada" && !/```/.test(v("jurColar")), "JV6d uma resposta com cerca de markdown é lida como resposta (e a cerca não vira ementa): " + v("jurClasse") + "|" + v("jurTese"));
    /* o texto que a pessoa tinha enviado volta para a caixa */
    api.jurLimparForm();
    api.$("jurColar").value = "RE 582461 multas tributárias e o princípio do não confisco, com a discussão dos percentuais aceitos pelo tribunal para multas moratórias e punitivas.";
    api.navegador.clipboard = { writeText: async () => {} };
    await conduzir(api.jurPedirIA(), true);
    api.$("jurColar").value = VAZIA;
    api.jurColar();
    ok(/RE 582461 multas tributárias e o princípio/.test(v("jurColar")), "JV7 numa resposta vazia, o texto que foi enviado VOLTA para a caixa, para completar e pedir de novo");
  }

  /* ---- JW: PEDIR SEM TEXTO É AVISADO ANTES (J2) ---- */
  {
    const { api } = rodar();
    api.jurIniciarTela();
    api.jurAbrir("Direito Tributário", "Tributos", "incluir");
    let copiado = "";
    api.navegador.clipboard = { writeText: async (x) => { copiado = x; } };
    const conduzir = async (p, aceitar) => {
      let pronto = false; p.then(() => { pronto = true; }, () => { pronto = true; });
      for (let i = 0; i < 12 && !pronto; i++) { await Promise.resolve(); try { api._uiFechar(aceitar); } catch (e) {} }
      return p;
    };
    api.$("jurColar").value = "RE 582461";
    await conduzir(api.jurPedirIA(), false);
    ok(copiado === "", "JW1 texto curto demais: a pessoa recusa o aviso e NADA é copiado");
    await conduzir(api.jurPedirIA(), true);
    ok(/<texto>[\s\S]*RE 582461[\s\S]*<\/texto>/.test(copiado), "JW2 texto curto demais: aceitando o aviso, o pedido é copiado mesmo assim");
    copiado = "";
    api.$("jurColar").value = "RE 582461 / SP — multas tributárias. Tese: A multa moratória de 20% não ofende o princípio do não confisco, e a multa punitiva pode chegar a 100% do tributo devido.";
    await conduzir(api.jurPedirIA(), true);
    ok(/RE 582461/.test(copiado), "JW3 texto de tamanho normal: copia direto, sem aviso");
    const sem = guardar(api, { tribunal: "STF", classe: "RE", numero: "582461", tese: "paráfrase qualquer" }, "Direito Tributário", "Tributos");
    copiado = "";
    api.jurCompletarAbrir(sem.id);
    await conduzir(api.jurCompletarPedir(sem.id), false);
    ok(copiado === "", "JW4 completar um julgado SEM ementa guardada: o aviso aparece e, recusado, nada é copiado");
    await conduzir(api.jurCompletarPedir(sem.id), true);
    ok(copiado.length > 100, "JW5 aceitando o aviso o pedido é copiado");
    /* a resposta 'vazio' no completar explica o 'nada mudou' */
    api.$("jurCplResposta").value = JSON.stringify({ tipo_do_texto: "vazio", identificacao: "RE 582.461", do_texto: {}, de_memoria: {}, conferencia: [] });
    api.jurCompletarLer();
    ok(/NÃO RECEBEU texto/.test(api.$("jurCplSaida").textContent) && /texto oficial guardado/.test(api.$("jurCplSaida").textContent), "JW6 no completar, uma resposta 'vazio' diz que a IA não recebeu texto e o que fazer: " + api.$("jurCplSaida").textContent.slice(0, 120));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
