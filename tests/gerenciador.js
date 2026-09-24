/* =====================================================================
 * GERENCIADOR DE CARTÕES (16.72.0)
 *
 * O que originou: os cartões ficam no texto de cada tópico e cada tela
 * mostrava um pedaço. Não dava para ver a biblioteca inteira em pastas,
 * buscar, filtrar por defeito ou repetição, nem agir em vários de uma vez.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. A árvore (disciplina › tópico) conta certo; a lista respeita pasta,
 *     busca (sem diferenciar acento) e filtro, combinados.
 *  2. Apagar leva o cartão INTEIRO (com @ e +) para a lixeira, que restaura.
 *  3. Mover leva o bloco como está; pergunta que o destino já tem não é
 *     duplicada (o cartão fica onde estava); mover para o mesmo tópico não faz nada.
 *  4. Editar troca o cartão; texto que não forma cartão é recusado sem salvar.
 *  5. A última ação (mover, apagar, editar) desfaz — sem pisar em tópico
 *     que mudou depois.
 *  6. A tela: pastas, busca, filtros, prévia, marcar, ações que perguntam,
 *     "melhorar marcados" abre o elevar com esses cartões.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
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
  const negar = async (api, promessa) => {
    for (let i = 0; i < 6; i++) { await Promise.resolve(); api.uiModalResponder(false); }
    return promessa;
  };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const linhasDaLista = (a) => achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
  const RICO = "Serviços constantes da lista anexa à LC 116/2003, conforme o art. 1º; o imposto é municipal e incide sobre a prestação de serviços de qualquer natureza, ainda que não seja atividade preponderante do prestador";

  const montar = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const iss = a.matChave("Trib", "ISS"), iptu = a.matChave("Trib", "IPTU"), pri = a.matChave("Const", "Princípios");
    a.matGravarCartoes(iss, [
      "@ Trilha ISS", "Qual o fato gerador do ISS? :: Serviço :: x", "+ Nota antiga", "",
      "Qual a alíquota máxima do ISS? :: " + RICO + " :: x", "+ Literalidade — Art. 8º-A", "",
      "Qual o fato gerador do imposto ISS? :: Serviço prestado :: x"].join("\n"), { disciplina: "Trib", topico: "ISS" });
    a.matGravarCartoes(iptu, "Quem paga o IPTU? :: O proprietário :: y", { disciplina: "Trib", topico: "IPTU" });
    a.matGravarCartoes(pri, [
      "O prazo é de {{c1::30 dias}} (art. 5º). :: obs :: z",
      "[MC] Qual princípio? :: Legalidade * | Moralidade | Eficiência :: Art. 37 da CF :: z"].join("\n"), { disciplina: "Const", topico: "Princípios" });
    return { a, iss, iptu, pri };
  };

  /* ---- G1: a arvore ---- */
  {
    const { a, iss, iptu } = montar();
    const notas = a.cqLerBiblioteca();
    const arv = a.gerArvore(notas);
    ok(arv.length === 2 && arv[0].disciplina === "Const" && arv[1].disciplina === "Trib", `G1 disciplinas em ordem: ${arv.map((x) => x.disciplina)}`);
    ok(arv[1].total === 4 && arv[1].topicos.length === 2 && arv[1].topicos[0].topico === "IPTU" && arv[1].topicos[0].total === 1 && arv[1].topicos[1].total === 3, `G1a contagens: ${JSON.stringify(arv[1])}`);
    ok(arv[0].total === 2 && arv[0].topicos[0].chave, "G1b a arvore leva a chave do topico");
    ok(a.gerArvore([]).length === 0 && a.gerArvore(null).length === 0, "G1c sem cartoes a arvore e' vazia");
  }

  /* ---- G2: filtrar ---- */
  {
    const { a, iss, iptu, pri } = montar();
    const notas = a.cqLerBiblioteca();
    const F = (o) => a.gerFiltrar(notas, o);
    ok(F({}).length === 6 && F({ filtro: "todos" }).length === 6 && F({ filtro: "invalido" }).length === 6, "G2 sem filtro sao todos (filtro desconhecido tambem)");
    ok(F({ pasta: { disciplina: "Trib" } }).length === 4 && F({ pasta: { chave: iptu } }).length === 1 && F({ pasta: { chave: iss } }).length === 3, "G2a pasta por disciplina e por topico");
    ok(F({ busca: "ALIQUOTA" }).length === 1 && F({ busca: "proprietario" }).length === 1, "G2b busca ignora maiuscula e acento (na pergunta e na resposta)");
    ok(F({ busca: "principios" }).length === 2 && F({ busca: "Alíquota" }).length === 1 && F({ busca: "PRINCÍPIOS" }).length === 2, "G2c busca acha pelo nome do topico, com ou sem acento na pergunta");
    ok(F({ busca: "Nota antiga" }).length === 1, "G2d busca acha no saiba mais");
    ok(F({ busca: "zzzz" }).length === 0, "G2e busca sem resultado");
    ok(F({ filtro: "basico" }).length === 4 && F({ filtro: "cloze" }).length === 1 && F({ filtro: "mc" }).length === 1, `G2f tipos: ${F({ filtro: "basico" }).length}/${F({ filtro: "cloze" }).length}/${F({ filtro: "mc" }).length}`);
    ok(F({ filtro: "abaixo" }).length >= 3 && F({ filtro: "abaixo" }).every((i) => a.ceAbaixo(notas[i].card)), "G2g abaixo do padrao usa a mesma nota do elevar");
    ok(F({ filtro: "sem_artigo" }).every((i) => a.ceDefeitos(notas[i].card).indexOf("sem_artigo") >= 0) && F({ filtro: "sem_artigo" }).length === 3, `G2h sem artigo: ${F({ filtro: "sem_artigo" }).length}`);
    const rep = F({ filtro: "repetidos" });
    ok(rep.length === 2 && rep.every((i) => /fato gerador/.test(notas[i].card.front)), `G2i repetidos: os dois "fato gerador": ${rep.length}`);
    ok(F({ pasta: { chave: iss }, filtro: "abaixo", busca: "fato" }).length === 2, "G2j pasta + filtro + busca combinados");
    ok(F({ pasta: { chave: iptu }, filtro: "cloze" }).length === 0, "G2k combinacao vazia");
  }

  /* ---- G3: apagar ---- */
  {
    const { a, iss } = montar();
    const notas = a.cqLerBiblioteca();
    const alvo = notas.filter((x) => /^Qual o fato gerador do ISS\?/.test(x.card.front));
    const r = a.gerApagar(alvo);
    ok(r.apagados === 1 && r.naoAchou === 0, `G3 apagou 1: ${JSON.stringify(r)}`);
    const t = a.matResumosAtual()[iss].cartoes;
    ok(!/Trilha ISS/.test(t) && !/Nota antiga/.test(t) && !/^Qual o fato gerador do ISS\?/m.test(t) && /alíquota máxima/.test(t) && /Serviço prestado/.test(t), `G3a apagou o bloco inteiro e so' ele: ${JSON.stringify(t)}`);
    const lix = a.lixLer();
    ok(lix.length === 1 && lix[0].tipo === "cartao" && lix[0].via === "material" && /@ Trilha ISS/.test(lix[0].dados.bloco) && /\+ Nota antiga/.test(lix[0].dados.bloco), "G3b foi para a lixeira com o bloco inteiro");
    ok(a.lixRestaurar(lix[0].id).ok === true && /Trilha ISS[\s\S]*Nota antiga/.test(a.matResumosAtual()[iss].cartoes), "G3c restaurar da lixeira devolve o cartao");
    ok(a.gerRecibo() && a.gerRecibo().itens.length === 1, "G3d a acao deixou recibo para desfazer");
    {
      /* dois cartoes do MESMO topico numa acao: desfazer volta ao original, nao ao meio */
      const m = montar();
      const orig = m.a.matResumosAtual()[m.iss].cartoes;
      m.a.gerApagar(m.a.cqLerBiblioteca().filter((x) => x.chave === m.iss && /fato gerador/.test(x.card.front)));
      ok(!/fato gerador/.test(m.a.matResumosAtual()[m.iss].cartoes), "G3f apagou os dois 'fato gerador'");
      m.a.gerDesfazerUltima();
      ok(m.a.matResumosAtual()[m.iss].cartoes === orig, "G3g desfazer duas exclusoes do mesmo topico volta ao ORIGINAL");
    }
    /* cartao que ja nao esta no texto */
    const fantasma = [Object.assign({}, alvo[0], { card: Object.assign({}, alvo[0].card, { raw: "sumiu :: do texto", line: 99 }) })];
    const rf = a.gerApagar(fantasma);
    ok(rf.apagados === 0 && rf.naoAchou === 1, `G3e cartao que sumiu do texto: ${JSON.stringify(rf)}`);
  }

  /* ---- G4: mover e desfazer ---- */
  {
    const { a, iss, iptu } = montar();
    const notas = a.cqLerBiblioteca();
    const fato = notas.filter((x) => /^Qual o fato gerador do ISS\?/.test(x.card.front));
    const r = a.gerMover(fato, iptu);
    ok(r.movidos === 1 && r.repetidos === 0, `G4 moveu 1: ${JSON.stringify(r)}`);
    const ti = a.matResumosAtual()[iss].cartoes, tp = a.matResumosAtual()[iptu].cartoes;
    ok(!/fato gerador do ISS\?/.test(ti) && !/Trilha ISS/.test(ti) && /^Quem paga o IPTU\?/.test(tp) && /@ Trilha ISS\nQual o fato gerador do ISS\? :: Serviço :: x\n\+ Nota antiga$/.test(tp), `G4a o bloco (com @ e +) foi inteiro para o destino: ${JSON.stringify(tp)}`);
    ok(a.matResumosAtual()[iptu].disciplina === "Trib" && a.matResumosAtual()[iptu].topico === "IPTU", "G4b o topico de destino manteve disciplina e nome");
    /* mesma pergunta no destino: fica onde estava */
    a.matGravarCartoes(iss, a.matResumosAtual()[iss].cartoes + "\nQuem paga o IPTU? :: Outra coisa :: y", { disciplina: "Trib", topico: "ISS" });
    const rep2 = a.gerMover(a.cqLerBiblioteca().filter((x) => x.chave === iptu && /^Quem paga/.test(x.card.front)), iss);
    ok(rep2.movidos === 0 && rep2.repetidos === 1 && /Quem paga o IPTU\? :: O proprietário/.test(a.matResumosAtual()[iptu].cartoes), `G4c pergunta que o destino ja tem nao duplica: ${JSON.stringify(rep2)}`);
    /* mesmo topico e destino inexistente */
    const t0 = JSON.stringify(a.matResumosAtual());
    const mesmo = a.gerMover(a.cqLerBiblioteca().filter((x) => x.chave === iss), iss);
    const nada = a.gerMover(a.cqLerBiblioteca(), "chave que nao existe");
    ok(mesmo.movidos === 0 && mesmo.repetidos === 0 && nada.movidos === 0 && JSON.stringify(a.matResumosAtual()) === t0, "G4d mover para o mesmo topico ou para topico inexistente nao faz nada");
    {
      /* uma acao que nao muda nada nao pode apagar o recibo da anterior */
      const m = montar();
      m.a.gerApagar(m.a.cqLerBiblioteca().filter((x) => /Quem paga/.test(x.card.front)));
      const rec = JSON.stringify(m.a.gerRecibo());
      m.a.gerMover(m.a.cqLerBiblioteca().filter((x) => x.chave === m.iss), m.iss);
      m.a.gerApagar([]);
      ok(JSON.stringify(m.a.gerRecibo()) === rec && m.a.gerRecibo().itens.length === 1, "G4e acao que nao mudou nada nao mexe no recibo anterior");
    }
  }
  {
    /* desfazer a ultima acao, dois topicos */
    const { a, iss, iptu } = montar();
    const antesI = a.matResumosAtual()[iss].cartoes, antesP = a.matResumosAtual()[iptu].cartoes;
    a.gerMover(a.cqLerBiblioteca().filter((x) => x.chave === iss && /alíquota/.test(x.card.front)), iptu);
    ok(a.gerRecibo().itens.length === 2, "G5 mover deixa recibo dos DOIS topicos");
    const d = a.gerDesfazerUltima();
    ok(d.desfeitos === 2 && d.pulados === 0 && a.matResumosAtual()[iss].cartoes === antesI && a.matResumosAtual()[iptu].cartoes === antesP && a.gerRecibo() === null, `G5a desfazer volta os dois e apaga o recibo: ${JSON.stringify(d)}`);
    ok(a.gerDesfazerUltima().desfeitos === 0, "G5b sem recibo nao faz nada");
    /* mexeram depois: nao pisa */
    a.gerMover(a.cqLerBiblioteca().filter((x) => x.chave === iss && /alíquota/.test(x.card.front)), iptu);
    a.matGravarCartoes(iptu, a.matResumosAtual()[iptu].cartoes + "\nNovo :: cartao", { disciplina: "Trib", topico: "IPTU" });
    const d2 = a.gerDesfazerUltima();
    ok(d2.desfeitos === 1 && d2.pulados === 1 && /Novo :: cartao/.test(a.matResumosAtual()[iptu].cartoes) && a.gerRecibo() !== null, `G5c topico mexido depois nao e' pisado e o recibo fica: ${JSON.stringify(d2)}`);
  }

  /* ---- G6: editar ---- */
  {
    const { a, iss } = montar();
    const alvo = a.cqLerBiblioteca().filter((x) => /^Qual o fato gerador do ISS\?/.test(x.card.front))[0];
    const antes = a.matResumosAtual()[iss].cartoes;
    const r = a.gerEditar(alvo, "@ Novo título\nQual o fato gerador do ISS? :: A prestação de serviços da lista anexa :: x\n+ Literalidade — Art. 1º");
    ok(r.ok === true, `G6 editar: ${JSON.stringify(r)}`);
    const t = a.matResumosAtual()[iss].cartoes;
    ok(/^@ Novo título\nQual o fato gerador do ISS\? :: A prestação/.test(t) && !/Nota antiga/.test(t) && !/Trilha ISS/.test(t) && /alíquota máxima/.test(t), `G6a trocou o bloco e so' ele: ${JSON.stringify(t)}`);
    ok(a.gerRecibo().itens.length === 1, "G6b editar deixa recibo");
    a.gerDesfazerUltima();
    ok(a.matResumosAtual()[iss].cartoes === antes, "G6c desfazer volta a edicao");
    const ruim = a.gerEditar(alvo, "isto nao e' um cartao");
    ok(ruim.ok === false && ruim.motivo === "sem_cartao" && a.matResumosAtual()[iss].cartoes === antes, `G6d texto que nao forma cartao e' recusado sem salvar: ${JSON.stringify(ruim)}`);
    const fantasma = Object.assign({}, alvo, { card: Object.assign({}, alvo.card, { raw: "sumiu :: x", line: 99 }) });
    ok(a.gerEditar(fantasma, "P :: R").motivo === "nao_achou", "G6e cartao que sumiu do texto: nao_achou");
  }

  /* ---- G7: a tela ---- */
  {
    const { a, iss, iptu } = montar();
    a.gerAbrir();
    ok(a.$("dlgGerCartoes").open === true, "G7 a janela nao abriu");
    ok(/6 de 6 cartões/.test(a.$("gerResumo").textContent), `G7a resumo: ${a.$("gerResumo").textContent}`);
    const pastas = achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta"));
    ok(pastas.length === 1 + 2 + 3 && /Todos os cartões \(6\)/.test(pastas[0].textContent), `G7b arvore com todos + 2 disciplinas + 3 topicos: ${pastas.length}`);
    ok(linhasDaLista(a).length === 6, "G7c lista com 6 cartoes");
    /* clicar numa pasta de topico */
    const pIss = pastas.filter((p) => /^ISS \(3\)/.test(p.textContent))[0];
    pIss.onclick();
    ok(linhasDaLista(a).length === 3 && /3 de 6 cartões/.test(a.$("gerResumo").textContent) && achar(a.$("gerArvore"), (e) => cls(e, "ger-atual")).length === 1, "G7d clicar no topico filtra a lista e marca a pasta");
    /* disciplina: recolher */
    const disc = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc")).filter((e) => /Trib/.test(e.textContent))[0];
    achar(disc, (e) => cls(e, "ger-seta"))[0].onclick();
    ok(achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).length === 1, "G7e recolher a disciplina esconde os topicos dela");
    disc.onclick();
    ok(linhasDaLista(a).length === 4, "G7f clicar na disciplina lista os cartoes dos topicos dela");
    /* busca e filtro */
    a.$("gerBusca").value = "aliquota"; a.$("gerBusca").oninput();
    ok(linhasDaLista(a).length === 1, `G7g busca: ${linhasDaLista(a).length}`);
    a.$("gerBusca").value = ""; a.$("gerFiltro").value = "repetidos"; a.$("gerFiltro").onchange();
    ok(linhasDaLista(a).length === 2, `G7h filtro repetidos: ${linhasDaLista(a).length}`);
    a.$("gerFiltro").value = "todos"; a.$("gerFiltro").onchange();
    /* previa */
    linhasDaLista(a)[0].onclick();
    ok(a.gerFocoAtual() === 0 && a.$("gerPrevia").children.length >= 1 && /nota/.test(a.$("gerPrevia").textContent), "G7i clicar no cartao mostra a previa com a nota");
    ok(a.$("btnGerEditar").disabled === false && a.$("btnGerApagar").disabled === true, "G7j editar liga com foco; apagar so' com marcacao");
    /* marcar */
    a.$("btnGerMarcar").onclick();
    ok(a.gerSelAtual().size === 4 && /4 marcado/.test(a.$("gerSel").textContent) && a.$("btnGerApagar").disabled === false && a.$("btnGerMover").disabled === false && a.$("btnGerMelhorar").disabled === false, "G7k marcar os visiveis liga as acoes");
    a.$("btnGerLimpar").onclick();
    ok(a.gerSelAtual().size === 0 && a.$("btnGerApagar").disabled === true, "G7l limpar marcacao");
    /* destinos */
    ok(achar(a.$("gerDestino"), (e) => e.tag === "option").length === 3, "G7m o seletor de destino lista os topicos");
  }
  {
    /* apagar pela tela: pergunta antes */
    const { a, iss } = montar();
    a.gerAbrir();
    const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
    const alvo = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent));
    ck[alvo].checked = true; ck[alvo].onchange();
    const antes = JSON.stringify(a.matResumosAtual());
    await negar(a, a.$("btnGerApagar").onclick());
    ok(JSON.stringify(a.matResumosAtual()) === antes && a.lixLer().length === 0, "G8 dizer NAO em 'apagar' nao mexe em nada");
    await conduzir(a, a.$("btnGerApagar").onclick());
    ok(!/alíquota/.test(a.matResumosAtual()[iss].cartoes) && a.lixLer().length === 1 && linhasDaLista(a).length === 5, "G8a confirmar apaga, manda para a lixeira e atualiza a lista");
    ok(/1 cartão\(ões\) apagado/.test(a.$("gerMsg").textContent) && a.$("btnGerDesfazer").hidden === false && a.gerSelAtual().size === 0, "G8b mensagem, botao desfazer e marcacao zerada");
    await negar(a, a.$("btnGerDesfazer").onclick());
    ok(!/alíquota/.test(a.matResumosAtual()[iss].cartoes), "G8c dizer NAO em 'desfazer' nao desfaz");
    await conduzir(a, a.$("btnGerDesfazer").onclick());
    ok(/alíquota/.test(a.matResumosAtual()[iss].cartoes) && linhasDaLista(a).length === 6 && a.$("btnGerDesfazer").hidden === true, "G8d desfazer devolve o cartao e some o botao");
  }
  {
    /* mover pela tela */
    const { a, iss, iptu } = montar();
    a.gerAbrir();
    const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
    const alvo = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent));
    ck[alvo].checked = true; ck[alvo].onchange();
    a.$("gerDestino").value = iptu;
    const antes = JSON.stringify(a.matResumosAtual());
    await negar(a, a.$("btnGerMover").onclick());
    ok(JSON.stringify(a.matResumosAtual()) === antes, "G9 dizer NAO em 'mover' nao mexe em nada");
    await conduzir(a, a.$("btnGerMover").onclick());
    ok(/alíquota/.test(a.matResumosAtual()[iptu].cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes) && /1 movido/.test(a.$("gerMsg").textContent), `G9a mover pela tela: ${a.$("gerMsg").textContent}`);
  }
  {
    /* editar pela tela */
    const { a, iss } = montar();
    a.gerAbrir();
    const alvo = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent));
    linhasDaLista(a)[alvo].onclick();
    a.$("btnGerEditar").onclick();
    ok(a.$("gerEditorCx").hidden === false && /^Qual a alíquota máxima do ISS\? ::/.test(a.$("gerEditor").value) && /\+ Literalidade — Art\. 8º-A/.test(a.$("gerEditor").value), `G10 o editor abre com o bloco do cartao: ${a.$("gerEditor").value.slice(0, 80)}`);
    a.$("btnGerEditCancelar").onclick();
    ok(a.$("gerEditorCx").hidden === true, "G10a cancelar fecha o editor");
    a.$("btnGerEditar").onclick();
    a.$("gerEditor").value = "isto nao e' cartao";
    const antes = a.matResumosAtual()[iss].cartoes;
    a.$("btnGerEditSalvar").onclick();
    ok(a.matResumosAtual()[iss].cartoes === antes, "G10b texto invalido nao salva");
    a.$("gerEditor").value = "Qual a alíquota máxima do ISS? :: Cinco por cento, conforme o art. 8º-A da LC 116 :: x";
    a.$("btnGerEditSalvar").onclick();
    ok(/Cinco por cento/.test(a.matResumosAtual()[iss].cartoes) && !/Literalidade — Art\. 8º-A/.test(a.matResumosAtual()[iss].cartoes) && /Cartão salvo/.test(a.$("gerMsg").textContent) && a.$("gerEditorCx").hidden === true, "G10c salvar troca o cartao e fecha o editor");
  }
  {
    /* melhorar marcados abre o elevar com ESTES cartoes, bons ou nao */
    const { a } = montar();
    a.gerAbrir();
    const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
    const bom = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent)), fraco = linhasDaLista(a).findIndex((l) => /Quem paga/.test(l.textContent));
    [bom, fraco].forEach((i) => { ck[i].checked = true; ck[i].onchange(); });
    a.$("btnGerMelhorar").onclick();
    ok(a.$("dlgGerCartoes").open === false && a.$("dlgCartElevar").open === true, "G11 melhorar fecha o gerenciador e abre o elevar");
    ok(a.ceNotasAtual().length === 2 && a.ceNotasAtual().some((x) => /alíquota/.test(x.card.front) && x.nota === 100), `G11a o elevar recebeu os 2 marcados (inclusive o que ja esta bom): ${a.ceNotasAtual().length}`);
    a.$("btnCeMarcar").onclick();
    a.$("btnCePrompt").onclick();
    ok(/@@ 2\n/.test(a.$("cePrompt").value), "G11b o prompt em lote sai com os 2");
    a.ceAbrir();
    ok(a.ceNotasAtual().length === 3 || a.ceNotasAtual().every((x) => x.nota < 70), "G11c abrir o elevar de novo volta ao comportamento normal (so' abaixo do padrao)");
  }
  {
    /* depois de aplicar, o elevar volta a listar so' o abaixo do padrao (a lista forcada some) */
    const { a, iss } = montar();
    a.gerAbrir();
    const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
    const bom = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent)), fraco = linhasDaLista(a).findIndex((l) => /Quem paga/.test(l.textContent));
    [bom, fraco].forEach((i) => { ck[i].checked = true; ck[i].onchange(); });
    a.$("btnGerMelhorar").onclick();
    a.$("btnCeMarcar").onclick(); a.$("btnCePrompt").onclick();
    const idFraco = a.cePedidoAtual().itens.findIndex((x) => /Quem paga/.test(x.card.front)) + 1;
    a.$("ceColar").value = "@@ " + idFraco + "\nQuem paga o IPTU? :: O proprietário do imóvel, o titular do domínio útil ou o possuidor a qualquer título, conforme o art. 34 do CTN :: y\n+ Literalidade — Art. 34 do CTN: contribuinte do imposto é o proprietário do imóvel";
    a.$("btnCeConferir").onclick();
    await conduzir(a, a.$("btnCeAplicar").onclick());
    ok(a.ceNotasAtual().every((x) => x.nota < 70) && !a.ceNotasAtual().some((x) => /alíquota/.test(x.card.front)), "G11d depois de aplicar, o elevar volta a listar so' os abaixo do padrao");
  }
  {
    /* o lote do elevar tem teto tambem quando vem do gerenciador */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const ch = a.matChave("D", "T");
    a.matGravarCartoes(ch, Array.from({ length: 20 }, (_, i) => "Pergunta numero" + i + " unica" + (i * 7) + "? :: Resp " + i).join("\n"), { disciplina: "D", topico: "T" });
    a.gerAbrir();
    a.$("btnGerMarcar").onclick();
    ok(a.gerSelAtual().size === 20, "G11e marcou os 20");
    a.$("btnGerMelhorar").onclick();
    ok(a.ceNotasAtual().length === a.CE_LIM.lote, `G11f o elevar recebe no maximo o lote: ${a.ceNotasAtual().length}`);
  }
  {
    /* paginacao */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar();
    const ch = a.matChave("D", "T");
    a.matGravarCartoes(ch, Array.from({ length: 70 }, (_, i) => `Pergunta numero${i} unica${i * 3}? :: Resposta ${i}`).join("\n"), { disciplina: "D", topico: "T" });
    a.gerAbrir();
    ok(linhasDaLista(a).length === 60 && a.$("btnGerMais").hidden === false, `G12 mostra 60 e oferece mais: ${linhasDaLista(a).length}`);
    a.$("btnGerMais").onclick();
    ok(linhasDaLista(a).length === 70 && a.$("btnGerMais").hidden === true, "G12a mostrar mais traz o resto");
    /* biblioteca vazia */
    const v = rodar().api; v.matIniciar(); v.edIniciar();
    v.gerAbrir();
    ok(/Ainda não há cartões/.test(v.$("gerResumo").textContent), `G12b biblioteca vazia: ${v.$("gerResumo").textContent}`);
  }

  /* ---- G13: no app ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="gerenciador\.js"><\/script>/.test(html) && /id="btnGerCartoes"/.test(html) && /id="dlgGerCartoes"/.test(html), "G13 falta o script, o botao ou a janela no index.html");
    ok(/"gerenciador\.js"/.test(sw), "G13a o modulo nao esta no cache offline");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`gerenciador: ok (${f.quantas} verificacoes)`);
  });
}
