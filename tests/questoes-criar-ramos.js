/* =====================================================================
 * VIRAR TEXTO EM QUESTÕES: DOIS PASSOS, RAMOS E TELA CHEIA (v18.84.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. com ramos no tópico, eles aparecem no passo 1 (marcar e "o que cobrar")
 *     e o pedido manda distribuir as questões e dizer o RAMO de cada uma;
 *  2. a resposta com RAMO: liga a questão ao ramo (tolera numeração e aspas);
 *     nome que não é ramo vira SUGESTÃO e um botão cria esses ramos (pelo
 *     editor de sempre); depois de criados, as questões passam a ser deles;
 *  3. sem RAMO escrito, um palpite pelas palavras, visível e trocável;
 *  4. tópico sem ramos (num edital): criar agora ou pedir à IA que sugira;
 *     fora de edital ou criação de UM ramo: nada a escolher;
 *  5. o pedido colado na caixa da resposta não vira questão fantasma;
 *     copiar avisa na tela e passa o destaque para o passo 2;
 *  6. tela cheia entra e sai (e sai ao fechar a janela).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (e, c) => new RegExp("(^|\\s)" + c + "(\\s|$)").test(e.className || "");

  const EDITAL = ["# ISS | prova: 2027-06-01 | horas: 20", "@ Licitações :: 5", "+ Lei 14.133 :: 5",
    "++ Modalidades :: 5", "++ Fase preparatória", "++ Contratos :: 3", "+ Convênios :: 2"].join("\n");
  const montar = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.qsUiIniciar();
    const ed = a.edCriar("ISS Caruaru", EDITAL);
    const ctx = (tp, extra) => Object.assign({ disciplina: "Licitações", topico: tp, chave: a.matChave("Licitações", tp), concurso: "ISS Caruaru" }, extra || {});
    return { a, j: r.janela, ed, ctx };
  };
  const bloco = (ramo, en, gab) => ["[QUESTAO]", "TIPO: CE"].concat(ramo === null ? [] : ["RAMO: " + ramo])
    .concat(["ENUNCIADO: " + en, "GABARITO: " + (gab || "C"), "COMENTARIO: porque sim.", "[/QUESTAO]"]).join("\n");

  /* ---- 1, 2: ramos no pedido; RAMO: lido; sugestão vira ramo ---- */
  {
    const { a, j, ctx } = montar();
    a.qsUiCriarAbrir("O pregão é usado para bens comuns. Contratos têm cláusulas exorbitantes.", ctx("Lei 14.133"), "resumo");
    const box = a.$("qsCriarRamosBox");
    const linhas = () => achar(a.$("qsCriarRamos"), (e) => cls(e, "res-ia-ramo"));
    ok(box.hidden === false && linhas().length === 3 && a.$("qsCriarSugRamos").hidden === true && a.$("qsCriarAjustarLin").hidden === false,
      "C1 tópico com 3 ramos: o passo 1 lista os ramos para marcar, sem o aviso de 'sem ramos', com 'ajustar ramos'");
    const pr = () => a.$("qsCriarPrompt").value;
    ok(pr().indexOf("- Modalidades") > 0 && pr().indexOf("RAMO:") > 0 && pr().indexOf("- Modalidades") < pr().indexOf("FORMATO"),
      "C1a o pedido lista os ramos (antes do FORMATO) e pede a linha RAMO: — " + pr().slice(0, 40));
    const ckDe = (nome) => achar(linhas().find((l) => l.textContent.indexOf(nome) >= 0), (e) => e.type === "checkbox")[0];
    const focoDe = (nome) => achar(linhas().find((l) => l.textContent.indexOf(nome) >= 0), (e) => e.type === "text")[0];
    ckDe("Contratos").checked = false; ckDe("Contratos").onchange();
    ok(pr().indexOf("- Contratos") < 0 && pr().indexOf("- Modalidades") > 0, "C1b desmarcar um ramo tira ele do pedido");
    focoDe("Fase preparatória").value = "prazos"; focoDe("Fase preparatória").oninput();
    ok(pr().indexOf("- Fase preparatória — " + a.t("qs_prompt_ramos_foco", { f: "prazos" })) > 0, "C1c o 'o que cobrar' do ramo vai no pedido");
    ckDe("Contratos").checked = true; ckDe("Contratos").onchange();

    /* copiar: aviso na tela, passo 2 em destaque */
    a.$("btnQsCopiarPrompt").onclick();
    ok(j.__area === pr() && /Pedido copiado/.test(a.$("qsCriarCopiadoMsg").textContent)
      && cls(a.$("qsCriarPasso1"), "feito") && cls(a.$("qsCriarPasso2"), "ativo"),
      "C2 copiar leva o pedido, diz na tela o que fazer e passa o destaque ao passo 2");

    a.$("qsCriarResposta").value = [bloco("Modalidades", "O pregão serve para bens comuns."),
      bloco('2. "Contratos"', "Contratos têm cláusulas exorbitantes."),
      bloco("Sanções administrativas", "A multa é uma sanção."),
      bloco("(vazio)", "Questão geral da lei.", "E")].join("\n\n");
    a.qsUiConferir();
    const ach = a.qsUiAchadosAtual();
    ok(ach.length === 4 && ach[0].ramo === "modalidades" && ach[1].ramo === "contratos" && ach[1].ramoNome === "Contratos",
      "C3 RAMO: liga a questão ao ramo (numeração e aspas toleradas): " + JSON.stringify(ach.map((q) => q.ramo || q.ramoSugerido || "")));
    ok(!ach[2].ramo && ach[2].ramoSugerido === "Sanções administrativas" && !ach[3].ramo && !ach[3].ramoSugerido,
      "C3a nome que não é ramo vira sugestão; (vazio) fica no tópico inteiro");
    ok(ach.every((q) => q.enunciado.indexOf("RAMO") < 0 && q.ramoTxt === undefined), "C3b a linha RAMO: não vaza para o enunciado");
    ok(cls(a.$("qsCriarSem"), "sem-ok") && a.$("qsCriarSemTxt").textContent === a.t("qs_sem_ok", { n: 4 }) && cls(a.$("qsCriarPasso2"), "feito"),
      "C3c o semáforo diz quantas leu, e o passo 2 fica feito: " + a.$("qsCriarSemTxt").textContent);
    const confs = () => achar(a.$("qsCriarConf"), (e) => cls(e, "qs-conf"));
    const selDe = (i) => achar(confs()[i], (e) => typeof e.onchange === "function" && e.type !== "checkbox")[0];
    ok(selDe(0) && selDe(0).value === "modalidades" && selDe(2).value === "" && achar(confs()[2], (e) => cls(e, "qs-conf-ramo-sug")).length === 1,
      "C4 cada questão conferida mostra o seu ramo (trocável) e a sugestão da IA");
    selDe(3).value = "fase_preparatoria"; selDe(3).onchange();
    ok(ach[3].ramo === "fase_preparatoria" && /Fase/.test(ach[3].ramoNome), "C4a trocar o ramo na conferência muda a questão");
    const bNov = a.$("btnQsCriarNovosRamos");
    ok(bNov.hidden === false && bNov.textContent === a.t("qs_criar_novos_ramos", { n: 1 }), "C5 1 ramo sugerido pela IA: botão para criá-lo");
    /* desmarcar uma antes: criar os ramos não pode desfazer a escolha da pessoa */
    a.qsUiEscolhasAtual()[3].cb.checked = false;
    bNov.onclick();
    ok(a.$("dlgRamos").open === true && a.ramLinhasAtual().some((l) => l.nome === "Sanções administrativas"), "C5a o editor de ramos abre com o nome sugerido, para conferir");
    a.ramSalvar();
    const ach2 = a.qsUiAchadosAtual();
    ok(ach2[2].ramo === "sancoes_administrativas" && !ach2[2].ramoSugerido && a.$("btnQsCriarNovosRamos").hidden === true
      && a.$("qsCriarRamosMsg").textContent === a.t("qs_ramos_criados", { n: 4 }),
      "C5b ao salvar, a questão passa ao ramo novo e o botão some: " + JSON.stringify([ach2[2].ramo, a.$("qsCriarRamosMsg").textContent]));
    ok(pr().indexOf("- Sanções administrativas") > 0 && linhas().length === 4, "C5c o pedido e a lista já usam o ramo novo");
    ok(a.qsUiEscolhasAtual()[3].cb.checked === false && a.qsUiEscolhasAtual()[0].cb.checked === true, "C5d a escolha de gravar/não gravar foi mantida");
    a.qsUiAplicar();
    const gravada = (en) => a.qsTodas().find((q) => q.enunciado.indexOf(en) === 0);
    ok(gravada("A multa").ramo === "sancoes_administrativas" && gravada("O pregão").ramo === "modalidades" && !("ramoSugerido" in gravada("O pregão")) && !gravada("Questão geral"),
      "C6 gravar leva o ramo de cada uma (e não grava a desmarcada)");
  }

  /* ---- 3: sem RAMO, palpite pelas palavras ---- */
  {
    const { a, ctx } = montar();
    a.qsUiCriarAbrir("Texto.", ctx("Lei 14.133"), "resumo");
    a.$("qsCriarResposta").value = bloco(null, "A modalidade pregão serve para bens comuns.");
    a.qsUiConferir();
    const q = a.qsUiAchadosAtual()[0];
    const conf = achar(a.$("qsCriarConf"), (e) => cls(e, "qs-conf"))[0];
    const pal = achar(conf, (e) => cls(e, "qs-conf-ramo-palpite"))[0];
    ok(q.ramo === "modalidades" && pal && pal.hidden !== true, "C7 sem RAMO escrito: palpite pelas palavras, à vista ('confira')");
    const sel = achar(conf, (e) => typeof e.onchange === "function" && e.type !== "checkbox")[0];
    sel.value = ""; sel.onchange();
    ok(!q.ramo && pal.hidden === true, "C7a trocar para 'tópico inteiro' tira o ramo e o aviso de palpite");
  }

  /* ---- 4: sem ramos / fora de edital / um ramo só ---- */
  {
    const { a, ctx } = montar();
    a.qsUiCriarAbrir("Convênios são acordos.", ctx("Convênios"), "resumo");
    ok(a.$("qsCriarRamosBox").hidden === false && a.$("qsCriarSugRamos").hidden === false && a.$("qsCriarSugerirLin").hidden === false
      && a.$("qsCriarRamosRot").hidden === true && a.$("qsCriarAjustarLin").hidden === true,
      "C8 tópico sem ramos, num edital: aviso com 'criar os ramos agora' e 'pedir à IA que sugira'");
    ok(a.$("qsCriarPrompt").value.indexOf(a.t("qs_prompt_ramos_sugerir")) < 0, "C8a sem marcar, o pedido não fala de ramos");
    a.$("qsCriarSugerir").checked = true; a.$("qsCriarSugerir").onchange();
    ok(a.$("qsCriarPrompt").value.indexOf(a.t("qs_prompt_ramos_sugerir")) > 0, "C8b marcado, a IA sugere os ramos e diz o de cada questão");
    a.$("btnQsCriarRamosAgora").onclick();
    ok(a.$("dlgRamos").open === true && a.ramCtxAtual().topico === "Convênios", "C8c 'criar os ramos agora' abre o editor de ramos do tópico");
    a.$("dlgRamos").close();

    a.qsUiCriarAbrir("Texto solto.", { disciplina: "Outra", topico: "Fora", chave: a.matChave("Outra", "Fora") }, "resumo");
    ok(a.$("qsCriarRamosBox").hidden === true && a.$("qsCriarPrompt").value.indexOf("RAMO") < 0, "C9 tópico fora de edital: nada de ramos");

    a.qsUiCriarAbrir("Contratos.", ctx("Lei 14.133", { ramo: "contratos", ramoNome: "Contratos" }), "resumo");
    const pr = a.$("qsCriarPrompt").value;
    ok(a.$("qsCriarRamosBox").hidden === true && pr.indexOf(a.t("qs_prompt_ramo_linha", { r: "Contratos" })) > 0 && pr.indexOf("- Modalidades") < 0,
      "C10 criação de UM ramo: o pedido é só dele, sem a lista");
    a.$("qsCriarResposta").value = bloco("Modalidades", "Contratos têm prazo.");
    a.qsUiConferir();
    ok(a.qsUiAchadosAtual()[0].ramo === "contratos", "C10a criação de um ramo: a questão é dele, mesmo se a IA escrever outro");
  }

  /* ---- 5: o pedido colado na caixa da resposta ---- */
  {
    const { a, ctx } = montar();
    a.qsUiCriarAbrir("Um texto.", ctx("Lei 14.133"), "resumo");
    ok(cls(a.$("qsCriarSem"), "sem-vazio") && cls(a.$("qsCriarPasso1"), "ativo"), "C11 ao abrir: semáforo vazio e o passo 1 em destaque");
    a.$("qsCriarResposta").value = a.$("qsCriarPrompt").value;
    a.qsUiConferir();
    ok(cls(a.$("qsCriarSem"), "sem-erro") && a.qsUiAchadosAtual().length === 0, "C11a o pedido colado no lugar da resposta: aviso vermelho, nenhuma questão fantasma");
    a.$("qsCriarResposta").value = "texto qualquer sem questão";
    a.qsUiConferir();
    ok(cls(a.$("qsCriarSem"), "sem-erro") && a.$("qsCriarSemTxt").textContent === a.t("qs_sem_nada"), "C11b nada lido: diz que não achou questão");
    a.$("qsCriarResposta").value = bloco("Modalidades", "Boa.") + "\n\n[QUESTAO]\nTIPO: CE\nENUNCIADO: sem gabarito\n[/QUESTAO]";
    a.qsUiConferir();
    ok(cls(a.$("qsCriarSem"), "sem-atencao") && a.$("qsCriarSemTxt").textContent === a.t("qs_sem_avisos", { n: 1, r: 1 }), "C11c lidas e recusadas: amarelo, com os números");
  }

  /* ---- 6: tela cheia ---- */
  {
    const { a, ctx } = montar();
    a.qsUiCriarAbrir("Um texto.", ctx("Lei 14.133"), "resumo");
    const dlg = a.$("dlgQsCriar");
    a.$("btnQsCriarCheia").onclick();
    ok(cls(dlg, "qs-criar-cheia") && a.$("btnQsCriarCheia").textContent === a.t("qs_criar_cheia_sair"), "C12 tela cheia: a janela ocupa a tela e o botão vira 'sair'");
    a.$("btnQsCriarCheia").onclick();
    ok(!cls(dlg, "qs-criar-cheia") && a.$("btnQsCriarCheia").textContent === a.t("qs_criar_cheia"), "C12a de novo: volta ao tamanho padrão");
    a.$("btnQsCriarCheia").onclick();
    dlg.close();
    ((dlg._ouv && dlg._ouv.close) || []).forEach((f) => f({}));
    ok(!cls(dlg, "qs-criar-cheia"), "C12b fechar a janela sai da tela cheia");
  }

  /* ---- 7: puros ---- */
  {
    const { a } = montar();
    const R = [{ id: "contratos", nome: "Contratos" }];
    ok(a.qsRamoPorNome("Ramo — Contratos", R).id === "contratos" && a.qsRamoPorNome("«contratos»", R).id === "contratos" && a.qsRamoPorNome("nenhum", R).nome === "" && a.qsRamoPorNome("Outro", R).nome === "Outro",
      "C13 o nome escrito vira o ramo (prefixo, aspas, caixa); 'nenhum' = sem ramo; outro = sugestão");
    const p = a.qsPromptComRamos("A\n\nFORMATO x", [], false);
    ok(p === "A\n\nFORMATO x" && a.qsPromptComRamos("A", [{ nome: "R" }], false).indexOf("- R") > 0, "C13a sem ramos nem sugestão, o pedido não muda; sem FORMATO, o bloco vai no fim");
  }
  /* ---- 8: o plano de extração (material de fora) ---- */
  {
    const { a, j, ctx } = montar();
    a.qsUiCriarAbrir("", ctx("Lei 14.133"), "resumo");
    const pr = () => a.$("qsCriarPrompt").value;
    ok(a.$("qsFonteOutro").checked === true && a.$("qsCriarPlanejar").checked === true && pr().indexOf("[PLANO]") > 0
      && pr().indexOf("- Modalidades") < pr().indexOf("[PLANO]") && pr().indexOf("[PLANO]") < pr().indexOf("FORMATO"),
      "P1 material de fora: o plano de extração vem ligado, depois dos ramos e antes do FORMATO");
    a.$("qsFonteResumo").disabled = false; a.$("qsFonteResumo").checked = true; a.$("qsFonteOutro").checked = false; a.$("qsFonteResumo").onchange();
    ok(a.$("qsCriarPlanejar").checked === false && pr().indexOf("[PLANO]") < 0, "P1a o resumo do próprio tópico: sem plano (dá para ligar à mão)");
    a.$("qsFonteResumo").checked = false; a.$("qsFonteCaderno").checked = true; a.$("qsFonteCaderno").onchange();
    ok(a.$("qsCriarPlanejar").checked === true && pr().indexOf("[PLANO]") > 0 && pr().indexOf("- Contratos") > 0, "P1b o caderno (NotebookLM) também leva os ramos e o plano");
    const resp = ["[PLANO]", "RAMO: Modalidades", "- Pregão: bens comuns (cap. 2)", "- Concorrência: obras", "RAMO: Contratos", "- Cláusulas exorbitantes",
      "- Prazo de vigência", "RAMO: Fase preparatória — sem conteúdo no material", "RAMO: Sanções", "- Multa", "[/PLANO]", "",
      bloco("Modalidades", "O pregão serve para bens comuns.").replace("RAMO: Modalidades", "RAMO: Modalidades\nASSUNTO: Pregão: bens comuns"),
      bloco("Contratos", "Há cláusulas exorbitantes.").replace("RAMO: Contratos", "RAMO: Contratos\nASSUNTO: Cláusulas exorbitantes"),
      "FALTA: Concorrência, Prazo de vigência, Multa"].join("\n");
    a.$("qsCriarResposta").value = resp;
    a.qsUiConferir();
    const ach = a.qsUiAchadosAtual();
    ok(ach.length === 2 && cls(a.$("qsCriarSem"), "sem-ok") && ach[0].assunto === "Pregão: bens comuns",
      "P2 o plano e o FALTA: não viram questão nem recusa; o ASSUNTO: é lido: " + a.$("qsCriarSemTxt").textContent);
    const pl = a.$("qsCriarPlano");
    ok(pl.hidden === false && pl.textContent.indexOf(a.t("qs_plano_tit", { f: 2, n: 5 })) >= 0 && pl.textContent.indexOf("Fase preparatória: " + a.t("qs_plano_sem")) >= 0,
      "P3 o painel do plano: 2 de 5 assuntos com questão, e o ramo sem conteúdo no material: " + pl.textContent.slice(0, 90));
    ok(achar(a.$("qsCriarConf"), (e) => cls(e, "qs-conf-assunto")).length === 2, "P3a cada questão mostra o seu assunto do plano");
    ok(a.$("btnQsCriarNovosRamos").hidden === false && a.qsUiRamosSugeridos().join() === "Sanções", "P3b o ramo do plano que não existe vira ramo a criar: " + a.qsUiRamosSugeridos().join());
    const bC = achar(pl, (e) => e.id === "btnQsPlanoContinuar")[0];
    ok(bC && bC.textContent === a.t("qs_plano_continuar", { n: 3 }), "P4 o botão da continuação conta o que falta");
    bC.onclick();
    ok(j.__area.indexOf("Concorrência") > 0 && j.__area.indexOf("Contratos › Prazo de vigência") > 0 && j.__area.indexOf("Pregão") < 0 && j.__area.indexOf("[PLANO]") < 0,
      "P4a o pedido da continuação leva SÓ os assuntos que faltam, com o ramo: " + j.__area.slice(0, 120));
    a.$("qsCriarResposta").value = resp + "\n\n" + [
      bloco("Modalidades", "A concorrência serve para obras.").replace("RAMO: Modalidades", "RAMO: Modalidades\nASSUNTO: Concorrência"),
      bloco("Contratos", "O prazo de vigência é de até 5 anos.").replace("RAMO: Contratos", "RAMO: Contratos\nASSUNTO: Prazo de vigência (art. 106)"),
      bloco("Sanções", "A multa é sanção.").replace("RAMO: Sanções", "RAMO: Sanções\nASSUNTO: Multa")].join("\n\n");
    a.qsUiConferir();
    const pl2 = a.$("qsCriarPlano");
    ok(pl2.textContent.indexOf(a.t("qs_plano_completo")) >= 0 && !achar(pl2, (e) => e.id === "btnQsPlanoContinuar").length && a.qsUiAchadosAtual().length === 5,
      "P5 com a continuação colada embaixo: plano cumprido, 5 questões");
    /* puros */
    const p0 = a.qsLerPlano("[PLANO]\n- solto\nRAMO: X\n1. um\n[QUESTAO]\nTIPO: CE\nENUNCIADO: x\n2) alternativa da questão");
    ok(p0.tem && p0.itens.length === 2 && a.qsTirarPlano("[PLANO]\n- a\n[QUESTAO]\nTIPO: CE").indexOf("[QUESTAO]") >= 0 && p0.itens[0].ramo === "" && p0.itens[1].ramo === "X" && a.qsAssuntoChave("Prazo (art. 5)") === a.qsAssuntoChave("prazo"),
      "P6 plano sem fechar termina na primeira questão; numeração aceita; o 'onde está' não conta na comparação");
  }
  return falhas;
}

module.exports = { testes };
