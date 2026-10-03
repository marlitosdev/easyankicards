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
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
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
    ok(a.gerFocoAtual() === 0 && a.$("gerPrevia").children.length >= 1 && /Fraco|Quase lá|Completo/.test(a.$("gerPrevia").textContent), "G7i clicar no cartao mostra a previa com o nivel");
    ok(a.$("gerLista").children.length >= 1 && JSON.stringify(a.$("gerLista").children.map((c) => (function ach(e) { return [e].concat((e.children || []).flatMap(ach)); })(c)).flat().filter((e) => /ce-nivel/.test(e.className || "")).length) > 0, "G7j cada linha da lista mostra o selo do nivel");
    ok(a.$("btnGerEditar").disabled === false && a.$("btnGerApagar").disabled === true, "G7j editar liga com foco; apagar so' com marcacao");
    /* marcar */
    a.$("btnGerMarcar").onclick();
    ok(a.gerSelAtual().size === 4 && /4 marcado/.test(a.$("gerSel").textContent) && a.$("btnGerApagar").disabled === false && a.$("btnGerMover").disabled === false && a.$("btnGerMelhorar").disabled === false, "G7k marcar os visiveis liga as acoes");
    a.$("btnGerLimpar").onclick();
    ok(a.gerSelAtual().size === 0 && a.$("btnGerApagar").disabled === true, "G7l limpar marcacao");
    /* destinos */
    ok(achar(a.$("gerDestino"), (e) => e.tag === "option").length === 4, "G7m o seletor de destino lista os topicos e a Bancada");
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
    const antes = JSON.stringify(a.matResumosAtual());
    a.$("btnGerMover").onclick();
    ok(a.$("gerPop").hidden === false, "G9-pre o botao 'Mover para…' abre o seletor de destino");
    await negar(a, a.gerEscolherDestino(iptu));
    ok(JSON.stringify(a.matResumosAtual()) === antes && a.$("gerPop").hidden === true, "G9 dizer NAO em 'mover' nao mexe em nada (e o seletor fecha)");
    await conduzir(a, a.gerEscolherDestino(iptu));
    ok(/alíquota/.test(a.matResumosAtual()[iptu].cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes) && /1 movido/.test(a.$("gerMsg").textContent) && a.$("gerMsgCx").hidden === false && a.$("btnGerMsgDesfazer").hidden === false, `G9a mover pela tela: ${a.$("gerMsg").textContent}`);
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
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
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
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const ch = a.matChave("D", "T");
    a.matGravarCartoes(ch, Array.from({ length: 70 }, (_, i) => `Pergunta numero${i} unica${i * 3}? :: Resposta ${i}`).join("\n"), { disciplina: "D", topico: "T" });
    a.gerAbrir();
    ok(linhasDaLista(a).length === 60 && a.$("btnGerMais").hidden === false, `G12 mostra 60 e oferece mais: ${linhasDaLista(a).length}`);
    a.$("btnGerMais").onclick();
    ok(linhasDaLista(a).length === 70 && a.$("btnGerMais").hidden === true, "G12a mostrar mais traz o resto");
    /* biblioteca vazia */
    const v = rodar().api; v.matIniciar(); v.edIniciar(); v.$("editor").value = "";
    v.gerAbrir();
    ok(/Ainda não há cartões/.test(v.$("gerResumo").textContent), `G12b biblioteca vazia: ${v.$("gerResumo").textContent}`);
  }

  /* ---- G14: layout, barra contextual, seletor com busca, aviso com desfazer, janela maior ---- */
  {
    const { a, iss, iptu, pri } = montar();
    a.gerAbrir();
    ok(a.gerFocoAtual() === 0 && a.$("gerPreAcoes").hidden === false && a.$("gerPrevia").children.length >= 1, "G14a a previa ja abre com o primeiro cartao (nunca em branco)");
    ok(a.$("gerAcoes").hidden === true && /\d+ cartões no total/.test(a.$("gerTotal").textContent), "G14b sem marcacao so' o rodape fino: a barra de acoes fica escondida");
    const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
    ck[0].checked = true; ck[0].onchange();
    ok(a.$("gerAcoes").hidden === false && /1 marcado/.test(a.$("gerSel").textContent), "G14c marcar um cartao faz a barra de acoes subir");
    ok(/Melhorar cartões \(1\)/.test(a.$("btnGerMelhorar").textContent), "G14d o botao de melhorar diz quantos");
    a.$("btnGerMarcar").onclick(); a.$("btnGerLimpar").onclick();
    ok(a.$("gerAcoes").hidden === true, "G14e limpar a marcacao esconde a barra");

    /* a marcacao e' por posicao: trocar de pasta/busca/filtro NAO pode deixar marcas apontando para outro cartao */
    a.$("btnGerMarcar").onclick();
    ok(a.gerSelAtual().size > 0, "G14f (marcou)");
    a.$("gerBusca").value = "IPTU"; a.$("gerBusca").oninput();
    ok(a.gerSelAtual().size === 0 && a.$("gerAcoes").hidden === true, "G14g buscar zera a marcacao");
    a.$("gerBusca").value = ""; a.$("gerBusca").oninput();
    a.$("btnGerMarcar").onclick();
    const pastas = achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta"));
    pastas[pastas.length - 1].onclick();
    ok(a.gerSelAtual().size === 0, "G14h trocar de pasta tambem zera a marcacao (antes ficava marcando outros cartoes)");
    a.$("gerBusca").value = "zzzznaoexiste"; a.$("gerBusca").oninput();
    ok(a.gerFocoAtual() === -1 && a.$("gerPreAcoes").hidden === true && /Nenhum cartão para mostrar/.test(a.$("gerPrevia").textContent), "G14i sem cartao na lista a previa explica e as acoes dela somem");
    a.$("gerBusca").value = ""; a.$("gerBusca").oninput();

    /* seletor de destino com busca */
    a.$("btnGerMover").onclick();
    ok(a.$("gerPop").hidden === true, "G14j sem marcacao o seletor nao abre");
    ck[0].checked = true;
    const c2 = achar(a.$("gerLista"), (e) => e.tag === "input"); c2[0].checked = true; c2[0].onchange();
    a.$("btnGerMover").onclick();
    ok(a.$("gerPop").hidden === false && achar(a.$("gerPopLista"), (e) => cls(e, "ger-pop-item")).length === 4 && /Bancada/.test(a.$("gerPopLista").textContent), "G14k o seletor lista os 3 topicos e a Bancada");
    a.$("gerPopBusca").value = "iptu"; a.$("gerPopBusca").oninput();
    const itens = achar(a.$("gerPopLista"), (e) => cls(e, "ger-pop-item"));
    ok(itens.length === 1 && /IPTU/.test(itens[0].textContent), "G14l digitar filtra os destinos (sem diferenciar acento ou maiuscula)");
    a.$("gerPopBusca").value = "zzz"; a.$("gerPopBusca").oninput();
    ok(achar(a.$("gerPopLista"), (e) => cls(e, "ger-pop-item")).length === 0 && /Nenhum tópico/.test(a.$("gerPopLista").textContent), "G14m sem resultado o seletor avisa");
    a.$("btnGerMover").onclick();
    ok(a.$("gerPop").hidden === true, "G14n clicar de novo no botao fecha o seletor");
    a.$("btnGerMover").onclick();
    a.$("gerPopBusca").onkeydown({ key: "Escape", preventDefault() {}, stopPropagation() {} });
    ok(a.$("gerPop").hidden === true, "G14o Esc fecha o seletor");
    a.$("btnGerLimpar").onclick();
    a.$("btnGerMover").onclick();
    ok(a.$("gerPop").hidden === true, "G14p (sem marcacao nao abre)");

    /* Enter escolhe o primeiro resultado */
    const m2 = montar(); m2.a.gerAbrir();
    const cm = achar(m2.a.$("gerLista"), (e) => e.tag === "input");
    const idx = achar(m2.a.$("gerLista"), (e) => cls(e, "ger-item")).findIndex((l) => /alíquota/.test(l.textContent));
    cm[idx].checked = true; cm[idx].onchange();
    m2.a.$("btnGerMover").onclick();
    m2.a.$("gerPopBusca").value = "iptu"; m2.a.$("gerPopBusca").oninput();
    const pe = m2.a.$("gerPopBusca").onkeydown({ key: "Enter", preventDefault() {} });
    ok(m2.a.$("gerDestino").value === m2.iptu, "G14q Enter escolhe o primeiro resultado da busca");
    await conduzir(m2.a, Promise.resolve());
    for (let i = 0; i < 6; i++) { await Promise.resolve(); m2.a.uiModalResponder(false); }
  }
  {
    /* o aviso traz o desfazer; apagar so' o cartao aberto (lixeira da previa) */
    const { a, iss } = montar();
    a.gerAbrir();
    const alvo = achar(a.$("gerLista"), (e) => cls(e, "ger-item")).findIndex((l) => /alíquota/.test(l.textContent));
    achar(a.$("gerLista"), (e) => cls(e, "ger-item"))[alvo].onclick();
    await conduzir(a, a.$("btnGerPreApagar").onclick());
    ok(!/alíquota/.test(a.matResumosAtual()[iss].cartoes) && /1 cartão\(ões\) apagado/.test(a.$("gerMsg").textContent) && a.$("btnGerMsgDesfazer").hidden === false, "G14r a lixeira da previa apaga so' o cartao aberto e o aviso oferece desfazer");
    await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
    ok(/alíquota/.test(a.matResumosAtual()[iss].cartoes) && a.$("btnGerMsgDesfazer").hidden === true && a.$("btnGerDesfazer").hidden === true, "G14s o 'desfazer' do aviso desfaz e some junto com o do rodape");
    a.gerAbrir();
    ok(a.$("gerMsgCx").hidden === true, "G14t reabrir limpa o aviso");
    /* editar: aviso tambem */
    a.$("btnGerEditar").onclick();
    ok(a.$("gerEditorCx").hidden === false, "G14u editar abre o editor na coluna da direita");
  }
  {
    /* reforcos: mais de 15 marcados, lixeira sem cartao, busca sem diferenciar maiuscula/acento */
    const { a, pri } = montar();
    const gr = a.matChave("Grande", "Lote");
    a.matGravarCartoes(gr, Array.from({ length: 20 }, (_, i) => "Pergunta grande " + i + " zz" + i + " yy" + i + " ww" + i + " :: r").join("\n"), { disciplina: "Grande", topico: "Lote" });
    a.gerAbrir();
    a.$("btnGerMarcar").onclick();
    ok(a.gerSelAtual().size > 15 && /Melhorar cartões \(15 de \d+\)/.test(a.$("btnGerMelhorar").textContent), "G14v com mais de 15 marcados o botao diz que so' 15 vao por rodada: " + a.$("btnGerMelhorar").textContent);
    a.$("gerBusca").value = "zzzznaoexiste"; a.$("gerBusca").oninput();
    ok(a.$("btnGerPreApagar").disabled === true && a.$("btnGerEditar").disabled === true, "G14w sem cartao aberto a lixeira e o editar da previa ficam desligados");
    a.$("gerBusca").value = ""; a.$("gerBusca").oninput();
    a.$("gerBusca").value = "PRINCIPIOS"; a.$("gerBusca").oninput();
    ok(linhasDaLista(a).length >= 1, "G14x a busca ignora maiuscula e acento");
    a.$("gerBusca").value = ""; a.$("gerBusca").oninput();
    a.$("btnGerMarcar").onclick(); a.$("btnGerMover").onclick();
    a.$("gerPopBusca").value = "PRINCIPIOS"; a.$("gerPopBusca").oninput();
    ok(achar(a.$("gerPopLista"), (e) => cls(e, "ger-pop-item")).length === 1, "G14y o seletor de destino tambem ignora maiuscula e acento");
  }
  {
    /* janela maior: alterna, lembra, e reduzir devolve o tamanho normal */
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    a.gerAbrir();
    ok(!a.$("dlgGerCartoes").classList.contains("ger-grande") && /ampliar/.test(a.$("btnGerAmpliar").textContent), "G15 abre no tamanho normal");
    a.$("btnGerAmpliar").onclick();
    ok(a.$("dlgGerCartoes").classList.contains("ger-grande") && /reduzir/.test(a.$("btnGerAmpliar").textContent) && a.$("btnGerAmpliar").getAttribute("aria-pressed") === "true" && a.lojaLer("eac_ger_grande") === "1", "G15a ampliar aumenta a janela e lembra a escolha");
    a.$("dlgGerCartoes").close(); a.gerAbrir();
    ok(a.$("dlgGerCartoes").classList.contains("ger-grande"), "G15b a janela abre ampliada na proxima vez");
    a.$("dlgGerCartoes").style.width = "700px";
    a.$("btnGerAmpliar").onclick();
    ok(!a.$("dlgGerCartoes").classList.contains("ger-grande") && a.$("dlgGerCartoes").style.width === "" && a.lojaLer("eac_ger_grande") === "0", "G15c reduzir volta ao normal (e limpa o tamanho arrastado)");
  }

  /* ---- G16: arrastar e soltar cartoes nas pastas ---- */
  {
    const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { dados: {}, setData(k, v) { this.dados[k] = v; }, setDragImage(el) { this.img = el; }, effectAllowed: "", dropEffect: "" } });
    const linhaTop = (a, nome) => achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => e.textContent.indexOf(nome) === 0);
    const cx = (a) => achar(a.$("gerLista"), (e) => e.tag === "input");
    const idxDe = (a, re) => linhasDaLista(a).findIndex((l) => re.test(l.textContent));
    const M = () => { const m = montar(); m.a.gerAbrir(); return m; };

    /* linhas arrastaveis */
    {
      const { a } = M();
      ok(linhasDaLista(a).length > 0 && linhasDaLista(a).every((l) => l.draggable === true && typeof l.ondragstart === "function"), "G16a toda linha da lista e' arrastavel");
      ok(achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).every((e) => typeof e.ondrop === "function" && typeof e.ondragover === "function"), "G16b todo topico da arvore aceita soltar");
    }
    /* quem vai: um nao marcado leva so' ele; um marcado leva todos os marcados */
    {
      const { a } = M();
      const i = idxDe(a, /alíquota/), j = idxDe(a, /IPTU/);
      const e1 = ev();
      linhasDaLista(a)[i].ondragstart(e1);
      ok(a.gerArrastoAtual() && a.gerArrastoAtual().notas.length === 1 && /alíquota/.test(a.gerArrastoAtual().notas[0].card.front), "G16c arrastar um cartao NAO marcado leva so' ele");
      ok(/Movendo 1 cartão/.test(e1.dataTransfer.dados["text/plain"]) && e1.dataTransfer.img && /Movendo 1 cartão/.test(e1.dataTransfer.img.textContent), "G16d a pilula 'Movendo N cartoes' acompanha o ponteiro");
      ok(a.$("dlgGerCartoes").classList.contains("ger-arrastando") && cls(linhasDaLista(a)[i], "ger-indo") && !cls(linhasDaLista(a)[j], "ger-indo"), "G16e enquanto arrasta: janela em modo arrastar e so' a linha levada esmaece");
      const ghost = e1.dataTransfer.img;
      ok(!!ghost.parentNode, "G16f0 (a pilula esta no corpo da pagina enquanto arrasta)");
      linhasDaLista(a)[i].ondragend();
      ok(a.gerArrastoAtual() === null && !a.$("dlgGerCartoes").classList.contains("ger-arrastando") && !cls(linhasDaLista(a)[i], "ger-indo") && !ghost.parentNode, "G16f soltar fora (dragend) limpa tudo, inclusive a pilula");
      /* marcados */
      const ck = cx(a);
      ck[i].checked = true; ck[i].onchange(); ck[j].checked = true; ck[j].onchange();
      const e2 = ev();
      linhasDaLista(a)[j].ondragstart(e2);
      ok(a.gerArrastoAtual().notas.length === 2 && /Movendo 2 cartões/.test(e2.dataTransfer.dados["text/plain"]), "G16g arrastar um cartao MARCADO leva todos os marcados");
      linhasDaLista(a)[j].ondragend();
      const k = idxDe(a, /fato gerador do ISS\?/);
      linhasDaLista(a)[k].ondragstart(ev());
      ok(a.gerArrastoAtual().notas.length === 1 && a.gerSelAtual().size === 2, "G16h arrastar um NAO marcado leva so' ele e nao mexe na marcacao");
      linhasDaLista(a)[k].ondragend();
    }
    /* alvos */
    {
      const { a } = M();
      const i = idxDe(a, /alíquota/);
      linhasDaLista(a)[i].ondragstart(ev());
      const outro = linhaTop(a, "IPTU"), proprio = linhaTop(a, "ISS");
      const eo = ev(); outro.ondragover(eo);
      ok(eo.prevented === true && cls(outro, "ger-alvo") && eo.dataTransfer.dropEffect === "move", "G16i sobre outra pasta: permite soltar e a pasta ganha destaque");
      outro.ondragleave();
      ok(!cls(outro, "ger-alvo"), "G16j sair da pasta tira o destaque");
      const ep = ev(); proprio.ondragover(ep);
      ok(ep.prevented === false && cls(proprio, "ger-alvo-no") && !cls(proprio, "ger-alvo") && ep.dataTransfer.dropEffect === "none", "G16k sobre a PROPRIA pasta do cartao nao permite soltar");
      linhasDaLista(a)[i].ondragend();
      ok(!cls(proprio, "ger-alvo-no"), "G16l dragend tira a marca de pasta invalida");
      const es = ev(); outro.ondragover(es);
      ok(es.prevented === false, "G16m sem arrasto em andamento a arvore nao aceita soltar");
    }
    /* mistura: cartoes de duas pastas arrastados para uma delas — vale para os de fora */
    {
      const { a, iss, iptu } = M();
      const ck = cx(a);
      const iI = idxDe(a, /alíquota/), iP = idxDe(a, /IPTU/);
      ck[iI].checked = true; ck[iI].onchange(); ck[iP].checked = true; ck[iP].onchange();
      linhasDaLista(a)[iI].ondragstart(ev());
      const alvo = linhaTop(a, "IPTU");
      const eo = ev(); alvo.ondragover(eo);
      ok(eo.prevented === true && cls(alvo, "ger-alvo"), "G16k2 arrastar cartoes de duas pastas: a pasta de um deles ainda e' alvo (vale para os de fora)");
      const pn = alvo.ondrop(ev());
      await Promise.resolve();
      ok(/Mover 1 cartão\(ões\)/.test((a.$("uiModalMsg") || {}).textContent || ""), "G16k3 a confirmacao conta so' os que estao de fora da pasta");
      await negar(a, pn);
    }
    /* soltar: pergunta com a previsao; NAO nao mexe; SIM move e oferece desfazer */
    {
      const { a, iss, iptu } = M();
      const i = idxDe(a, /alíquota/);
      const antes = JSON.stringify(a.matResumosAtual());
      linhasDaLista(a)[i].ondragstart(ev());
      const alvo = linhaTop(a, "IPTU");
      const edrop = ev();
      const pn = alvo.ondrop(edrop);
      ok(edrop.prevented === true, "G16n0 soltar cancela o comportamento padrao do navegador (senao ele abre/abandona a pagina)");
      await Promise.resolve();
      const msg = (a.$("uiModalMsg") || {}).textContent || "";
      ok(/Mover 1 cartão\(ões\) para “Trib › IPTU”/.test(msg) && /transferido para o tópico de destino/.test(msg) && !/já existe/.test(msg), "G16n a confirmacao explica o que vai acontecer: " + msg);
      await negar(a, pn);
      ok(JSON.stringify(a.matResumosAtual()) === antes && a.gerArrastoAtual() === null, "G16o dizer NAO ao soltar nao mexe em nada (e o arrasto termina)");
      linhasDaLista(a)[i].ondragstart(ev());
      await conduzir(a, linhaTop(a, "IPTU").ondrop(ev()));
      ok(/alíquota/.test(a.matResumosAtual()[iptu].cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes) && /1 movido/.test(a.$("gerMsg").textContent) && a.$("btnGerMsgDesfazer").hidden === false, "G16p soltar e confirmar move o cartao e o aviso oferece desfazer");
      await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
      ok(/alíquota/.test(a.matResumosAtual()[iss].cartoes) && !/alíquota/.test(a.matResumosAtual()[iptu].cartoes), "G16q o desfazer devolve o cartao arrastado");
    }
    /* repetidos avisados antes; soltar na mesma pasta nao faz nada */
    {
      const { a, iss, iptu } = M();
      a.matGravarCartoes(iptu, a.matResumosAtual()[iptu].cartoes + "\nQual a alíquota máxima do ISS? :: outra coisa qualquer", { disciplina: "Trib", topico: "IPTU" });
      a.gerAbrir();
      const i = idxDe(a, /alíquota máxima do ISS\? Serviços/);
      const idx = i >= 0 ? i : linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent) && /ISS/.test(l.textContent));
      const prev = a.gerPrevisaoMover([a.gerNotasAtual().find((n) => n.chave === iss && /alíquota/.test(n.card.front))], iptu);
      ok(prev.repetidos === 1 && prev.vao === 0 && prev.validos.length === 1, "G16r a previsao conta a pergunta que o destino ja tem: " + JSON.stringify({ r: prev.repetidos, v: prev.vao }));
      const notaIss = a.gerNotasAtual().findIndex((n) => n.chave === iss && /alíquota/.test(n.card.front));
      const pos = a.gerVisAtual().indexOf(notaIss);
      linhasDaLista(a)[pos].ondragstart(ev());
      const pn = linhaTop(a, "IPTU").ondrop(ev());
      await Promise.resolve();
      const msg = (a.$("uiModalMsg") || {}).textContent || "";
      ok(/1 já existe\(m\) no destino/.test(msg) && /não será\(ão\) duplicado/.test(msg), "G16s a confirmacao avisa que o destino ja tem a pergunta: " + msg);
      await negar(a, pn);
      /* soltar na propria pasta */
      linhasDaLista(a)[pos].ondragstart(ev());
      await conduzir(a, linhaTop(a, "ISS").ondrop(ev()));
      ok(/já estão nessa pasta/.test(a.$("gerMsg").textContent), "G16t soltar na propria pasta so' avisa, sem mover nada: " + a.$("gerMsg").textContent);
    }
    /* varios cartoes de uma vez */
    {
      const { a, iss, iptu } = M();
      const ck = cx(a);
      const ii = linhasDaLista(a).map((l, i) => (/Trib · ISS/.test(l.textContent) ? i : -1)).filter((i) => i >= 0);
      ii.forEach((i) => { ck[i].checked = true; ck[i].onchange(); });
      linhasDaLista(a)[ii[0]].ondragstart(ev());
      ok(a.gerArrastoAtual().notas.length === ii.length && ii.length === 3, "G16u tres cartoes marcados, todos vao");
      await conduzir(a, linhaTop(a, "IPTU").ondrop(ev()));
      ok(/3 movido/.test(a.$("gerMsg").textContent) && !/Qual/.test(a.matResumosAtual()[iss].cartoes), "G16v os tres foram movidos de uma vez: " + a.$("gerMsg").textContent);
    }
    /* Bancada como destino */
    {
      const { a, iss } = montar();
      a.$("editor").value = "Cartão da bancada? :: Resposta da bancada";
      a.gerAbrir();
      const bancada = linhaTop(a, "Texto do editor");
      ok(!!bancada, "G16w a Bancada aparece na arvore e recebe cartoes");
      const i = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent));
      linhasDaLista(a)[i].ondragstart(ev());
      await conduzir(a, bancada.ondrop(ev()));
      ok(/alíquota máxima do ISS/.test(a.$("editor").value) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes) && /Cartão da bancada/.test(a.$("editor").value), "G16x soltar na Bancada leva o cartao para o editor sem apagar o que la' estava");
      await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
      ok(!/alíquota/.test(a.$("editor").value) && /alíquota/.test(a.matResumosAtual()[iss].cartoes), "G16y desfazer devolve o cartao ao material e limpa a Bancada");
    }
    /* disciplina fechada abre ao segurar o cartao em cima */
    {
      const { a } = M();
      const cab = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc"))[0];
      const disc = cab.textContent.replace(/^\s*[▾▸]\s*/, "").replace(/\s*\(\d+\)\s*$/, "");
      cab.children[0].onclick();
      ok(a.gerFechadosAtual().has(disc), "G16z0 (fechou a disciplina)");
      linhasDaLista(a)[0].ondragstart(ev());
      const cab2 = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc")).find((e) => e.textContent.indexOf(disc) >= 0);
      const ed = ev(); cab2.ondragover(ed);
      ok(ed.prevented === true && !a.gerFechadosAtual().has(disc), "G16z1 segurar o cartao sobre uma disciplina fechada a abre (para alcancar os topicos)");
      linhasDaLista(a)[0].ondragend();
      linhasDaLista(a)[0].ondragend();
      const es = ev(); const cab3 = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc"))[0];
      cab3.children[0].onclick();
      const fechada = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc"))[0];
      const disc3 = fechada.textContent.replace(/^\s*[▾▸]\s*/, "").replace(/\s*\(\d+\)\s*$/, "");
      fechada.ondragover(es);
      ok(es.prevented === false && a.gerFechadosAtual().has(disc3), "G16z2 sem arrasto, passar o mouse numa disciplina fechada nao a abre");
    }
  }

  /* ---- G17: pastas — criar, pasta vazia, mover a pasta inteira, marcar todos ---- */
  {
    const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { dados: {}, setData(k, v) { this.dados[k] = v; }, setDragImage(el) { this.img = el; }, effectAllowed: "", dropEffect: "" } });
    const linhaTop = (a, nome) => achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => e.textContent.indexOf(nome) === 0);
    const M = () => { const m = montar(); m.a.gerAbrir(); return m; };
    const responder = async (a, valor) => {
      for (let i = 0; i < 8 && !a.$("uiPromptInput"); i++) await Promise.resolve();
      await Promise.resolve();
      if (valor === null) { a.uiModalResponder(false); return; }
      a.$("uiPromptInput").value = valor;
      a.uiModalResponder(true);
    };

    /* o nucleo */
    {
      const { a } = M();
      const antesMat = JSON.stringify(a.matResumosAtual());
      ok(a.gerCriarPasta("", "x").motivo === "vazia" && a.gerCriarPasta("Disc", "   ").motivo === "vazia", "G17a disciplina e nome sao obrigatorios");
      ok(a.gerCriarPasta("D".repeat(81), "x").motivo === "longa" && a.gerCriarPasta("d", "T".repeat(121)).motivo === "longa", "G17b nome grande demais e' recusado");
      const r = a.gerCriarPasta("  Revisão   final ", "Pegadinhas  do › ISS :: hoje");
      ok(r.ok && r.existe === false && r.nome === "Revisão final › Pegadinhas do - ISS - hoje" && a.gerPastasCriadas().length === 1, "G17c cria a pasta e arruma o nome (espacos, '›' e '::'): " + JSON.stringify(r));
      ok(JSON.stringify(a.matResumosAtual()) === antesMat, "G17d criar a pasta NAO toca no material nem no edital (so' o registro da pasta)");
      const r2 = a.gerCriarPasta("REVISAO FINAL", "pegadinhas do - iss - hoje");
      ok(r2.ok && r2.existe === true && r2.chave === r.chave && a.gerPastasCriadas().length === 1, "G17e mesmo nome (sem diferenciar acento ou caixa) nao duplica: abre a que existe");
      const r3 = a.gerCriarPasta("Trib", "ISS");
      ok(r3.ok && r3.existe === true && a.gerPastasCriadas().length === 1, "G17f pasta que ja tem cartoes e' so' aberta, sem virar pasta vazia");
      a.matGravarCartoes(r.chave, "Pergunta? :: Resposta", { disciplina: "Revisão final", topico: "Pegadinhas do - ISS - hoje" });
      a.gerAbrir();
      ok(a.gerPastasVazias(a.gerNotasAtual()).length === 0 && a.gerPastasCriadas().length === 1, "G17c2 pasta criada que ja recebeu cartao nao conta como vazia (mas o registro dela continua)");
      ok(a.gerPastaInfo(r.chave).topico === "Pegadinhas do - ISS - hoje" && a.gerPastaInfo("nao-existe") === null, "G17g gerPastaInfo acha a pasta criada aqui (e devolve null para o que nao existe)");
    }
    /* a arvore, o destino, o mover para a pasta vazia e o desfazer */
    {
      const { a, iss } = M();
      const r = a.gerCriarPasta("Revisão", "Pegadinhas");
      a.gerAbrir();
      const linha = linhaTop(a, "Pegadinhas");
      ok(!!linha && /\(0\)/.test(linha.textContent) && cls(linha, "ger-vazia") && !linha.draggable, "G17h a pasta nova aparece na arvore como vazia (0) e nao e' arrastavel");
      ok(achar(a.$("gerArvore"), (e) => cls(e, "ger-disc")).some((e) => /Revisão/.test(e.textContent)), "G17i a disciplina nova tambem aparece");
      ok(achar(a.$("gerDestino"), (e) => e.tag === "option").length === 5 && a.gerDestinosLista().some((d) => d.ch === r.chave && /Revisão › Pegadinhas/.test(d.nome)), "G17j a pasta vazia e' destino possivel (seletor e busca)");
      linha.onclick();
      ok(a.gerPastaAtual().chave === r.chave && /Pasta vazia/.test(a.$("gerLista").textContent), "G17k abrir a pasta vazia explica o que fazer");
      /* arrastar um cartao para a pasta vazia */
      a.$("gerBusca").value = ""; a.$("gerBusca").oninput();
      const todas = achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta"));
      todas[0].onclick();
      const i = linhasDaLista(a).findIndex((l) => /alíquota/.test(l.textContent));
      linhasDaLista(a)[i].ondragstart(ev());
      const alvo = linhaTop(a, "Pegadinhas");
      const eo = ev(); alvo.ondragover(eo);
      ok(eo.prevented === true && cls(alvo, "ger-alvo"), "G17l a pasta vazia aceita soltar");
      await conduzir(a, alvo.ondrop(ev()));
      const mat = a.matResumosAtual()[r.chave];
      ok(mat && mat.disciplina === "Revisão" && mat.topico === "Pegadinhas" && /alíquota máxima/.test(mat.cartoes) && !/alíquota/.test(a.matResumosAtual()[iss].cartoes), "G17m o primeiro cartao faz o topico nascer no material, com a disciplina e o nome escolhidos");
      const linha2 = linhaTop(a, "Pegadinhas");
      ok(linha2 && /\(1\)/.test(linha2.textContent) && !cls(linha2, "ger-vazia") && linha2.draggable === true, "G17n a pasta deixa de ser vazia e vira arrastavel");
      await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
      ok(/alíquota/.test(a.matResumosAtual()[iss].cartoes) && !/alíquota/.test((a.matResumosAtual()[r.chave] || {}).cartoes || ""), "G17o desfazer devolve o cartao e a pasta volta a ser vazia");
      ok(!!linhaTop(a, "Pegadinhas") && cls(linhaTop(a, "Pegadinhas"), "ger-vazia"), "G17p (a pasta continua existindo, vazia)");
    }
    /* remover pasta vazia */
    {
      const { a } = M();
      const r = a.gerCriarPasta("Revisão", "Temporaria");
      a.gerAbrir();
      const x = achar(linhaTop(a, "Temporaria"), (e) => cls(e, "ger-x"))[0];
      ok(!!x && x.title.length > 0, "G17q a pasta vazia tem o x de remover");
      linhaTop(a, "Temporaria").onclick();
      ok(a.gerPastaAtual() && a.gerPastaAtual().chave === r.chave, "G17q2 (abriu a pasta vazia)");
      let parou = false;
      x.onclick({ stopPropagation() { parou = true; } });
      ok(!linhaTop(a, "Temporaria") && a.gerPastasCriadas().length === 0 && a.gerPastaAtual() === null && parou === true, "G17r o x remove a pasta vazia, fecha a pasta aberta e nao deixa o clique chegar na linha");
      ok(a.gerRemoverPastaVazia(a.matChave("Trib", "ISS")) === false && a.gerNotasAtual().length > 0, "G17s remover NAO mexe em pasta com cartoes");
      const r2 = a.gerCriarPasta("Revisão", "Com cartao");
      a.matGravarCartoes(r2.chave, "Pergunta? :: Resposta", { disciplina: "Revisão", topico: "Com cartao" });
      ok(a.gerRemoverPastaVazia(r2.chave) === false && /Pergunta/.test(a.matResumosAtual()[r2.chave].cartoes), "G17t pasta que ja recebeu cartao nao e' removida como vazia");
    }
    /* mover a PASTA inteira, arrastando a linha da arvore */
    {
      const { a, iss, iptu } = M();
      const li = linhaTop(a, "ISS");
      ok(li.draggable === true && typeof li.ondragstart === "function", "G17u a linha de um topico com cartoes e' arrastavel");
      a.$("gerBusca").value = "alíquota"; a.$("gerBusca").oninput();
      const e1 = ev(); linhaTop(a, "ISS").ondragstart(e1);
      ok(a.gerArrastoAtual().notas.length === 3 && /Movendo 3 cartões/.test(e1.dataTransfer.dados["text/plain"]), "G17v arrastar a pasta leva TODOS os cartoes dela (mesmo com filtro na lista)");
      const ep = ev(); linhaTop(a, "ISS").ondragover(ep);
      ok(ep.prevented === false, "G17w soltar a pasta nela mesma nao vale");
      await conduzir(a, linhaTop(a, "IPTU").ondrop(ev()));
      ok(/3 movido/.test(a.$("gerMsg").textContent) && !/Qual/.test(a.matResumosAtual()[iss].cartoes) && a.parseText(a.matResumosAtual()[iptu].cartoes, []).cards.length === 4, "G17x os 3 cartoes da pasta foram para o destino: " + a.$("gerMsg").textContent);
      a.$("gerBusca").value = ""; a.$("gerBusca").oninput();
      ok(!linhaTop(a, "ISS"), "G17y a pasta de origem sai da arvore quando fica sem cartoes");
    }
    /* marcar todos (alem dos 60 a vista) */
    {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
      const ch = a.matChave("D", "Grande");
      a.matGravarCartoes(ch, Array.from({ length: 70 }, (_, i) => "Pergunta " + i + " zz" + i + " yy" + i + " ww" + i + " :: r").join("\n"), { disciplina: "D", topico: "Grande" });
      a.gerAbrir();
      ok(linhasDaLista(a).length === 60 && a.$("btnGerMarcarTodos").hidden === false && /marcar todos \(70\)/.test(a.$("btnGerMarcarTodos").textContent), "G17z o botao 'marcar todos' diz quantos");
      a.$("btnGerMarcar").onclick();
      ok(a.gerSelAtual().size === 60, "G17z1 'marcar os visiveis' pega so' os 60 a vista");
      a.$("btnGerMarcarTodos").onclick();
      ok(a.gerSelAtual().size === 70 && a.$("gerAcoes").hidden === false && /70 marcado/.test(a.$("gerSel").textContent), "G17z2 'marcar todos' pega a lista toda, alem dos 60");
      a.$("gerBusca").value = "Pergunta 6"; a.$("gerBusca").oninput();
      ok(a.$("btnGerMarcarTodos").hidden === false && /marcar todos \(11\)/.test(a.$("btnGerMarcarTodos").textContent), "G17z3 respeita a busca (Pergunta 6, 60..69 => 11)");
      a.$("gerBusca").value = "Pergunta 69"; a.$("gerBusca").oninput();
      ok(a.$("btnGerMarcarTodos").hidden === true, "G17z4 com um so' cartao o botao some");
    }
    /* a Bancada nao e' disciplina: nem preenche nem e' sugerida */
    {
      const { a } = montar();
      a.$("editor").value = "Cartão da bancada? :: Resposta da bancada";
      a.gerAbrir();
      linhaTop(a, "Texto do editor").onclick();
      a.$("btnGerNovaPasta").onclick();
      ok(a.$("gerNpDisc").value === "", "G17y0 com a Bancada aberta a disciplina NAO vem preenchida com 'Bancada': " + a.$("gerNpDisc").value);
      const sug = achar(a.$("gerNpDiscLista"), (e) => e.tag === "option").map((o) => o.value);
      ok(sug.indexOf("Bancada") < 0 && sug.indexOf("Trib") >= 0, "G17y1 'Bancada' nao entra nas sugestoes de disciplina: " + sug.join("|"));
      a.$("btnGerNpCancelar").onclick();
    }
    /* a janelinha de nova pasta (a tela) */
    {
      const { a } = M();
      const dlg = a.$("dlgGerNovaPasta");
      linhaTop(a, "ISS").onclick();
      a.$("btnGerNovaPasta").onclick();
      ok(dlg.open === true && a.$("gerNpDisc").value === "Trib" && a.$("gerNpTop").value === "", "G17z5 abre uma janelinha com a disciplina da pasta aberta ja preenchida");
      const sugestoes = achar(a.$("gerNpDiscLista"), (e) => e.tag === "option").map((o) => o.value);
      ok(sugestoes.indexOf("Trib") >= 0 && sugestoes.indexOf("Bancada") < 0, "G17z5a as disciplinas existentes sao sugeridas (a Bancada nao e' disciplina): " + sugestoes.join("|"));
      /* nome vazio: erro dentro da janela, sem fechar nem criar */
      a.$("gerNpTop").value = "   ";
      a.$("btnGerNpOk").onclick();
      ok(dlg.open === true && /Nada foi criado/.test(a.$("gerNpErro").textContent) && a.gerPastasCriadas().length === 0, "G17z6 nome vazio: o erro aparece na propria janela, que continua aberta");
      a.$("gerNpTop").value = "T".repeat(121);
      a.$("btnGerNpOk").onclick();
      ok(dlg.open === true && /grande demais/.test(a.$("gerNpErro").textContent), "G17z6b nome grande demais tambem e' explicado la dentro");
      /* criar */
      a.$("gerNpDisc").value = "Revisão"; a.$("gerNpTop").value = "Pegadinhas";
      a.$("btnGerNpOk").onclick();
      ok(dlg.open === false && a.gerPastasCriadas().length === 1 && a.gerPastaAtual() && /Pegadinhas/.test(a.$("gerMsg").textContent) && /criada/.test(a.$("gerMsg").textContent) && /Pasta vazia/.test(a.$("gerLista").textContent), "G17z7 criar: a janelinha fecha, a pasta abre e o aviso diz o que fazer: " + a.$("gerMsg").textContent);
      ok(achar(a.$("gerDestino"), (e) => e.tag === "option").length === 5 && a.gerDestinosLista().some((d) => /Revisão › Pegadinhas/.test(d.nome)), "G17z7b criar pela tela ja coloca a pasta na lista de destinos");
      /* cancelar */
      a.$("btnGerNovaPasta").onclick();
      a.$("gerNpDisc").value = "Outra"; a.$("gerNpTop").value = "Cancelada";
      a.$("gerNpTop").value = "   "; a.$("btnGerNpOk").onclick();
      ok(/Nada foi criado/.test(a.$("gerNpErro").textContent), "G17z7c (o erro estava na tela)");
      a.$("gerNpTop").value = "Cancelada";
      a.$("btnGerNpCancelar").onclick();
      a.$("btnGerNovaPasta").onclick();
      ok(a.$("gerNpTop").value === "" && a.$("gerNpErro").textContent === "", "G17z7d reabrir a janelinha limpa o nome e o erro da vez anterior");
      a.$("btnGerNpCancelar").onclick();
      a.$("btnGerNovaPasta").onclick();
      a.$("gerNpDisc").value = "Outra"; a.$("gerNpTop").value = "Cancelada";
      a.$("btnGerNpCancelar").onclick();
      ok(dlg.open === false && a.gerPastasCriadas().length === 1, "G17z8 cancelar fecha sem criar");
      /* Enter confirma */
      a.$("btnGerNovaPasta").onclick();
      a.$("gerNpDisc").value = "Revisão"; a.$("gerNpTop").value = "Por enter";
      const ent = { key: "Enter", prevented: false, preventDefault() { this.prevented = true; } };
      a.$("gerNpTop").onkeydown(ent);
      ok(dlg.open === false && a.gerPastasCriadas().length === 2 && ent.prevented === true, "G17z9 Enter no campo confirma");
      a.$("btnGerNovaPasta").onclick();
      a.$("gerNpDisc").value = "Revisão"; a.$("gerNpTop").value = "Outra tecla";
      a.$("gerNpDisc").onkeydown({ key: "a", preventDefault() {} });
      ok(dlg.open === true && a.gerPastasCriadas().length === 2, "G17z9b outra tecla nao confirma");
      a.$("btnGerNpCancelar").onclick();
      /* mesmo nome: abre a que existe */
      a.$("btnGerNovaPasta").onclick();
      a.$("gerNpDisc").value = "revisao"; a.$("gerNpTop").value = "PEGADINHAS";
      a.$("btnGerNpOk").onclick();
      ok(dlg.open === false && a.gerPastasCriadas().length === 2 && /já existe/.test(a.$("gerMsg").textContent), "G17z9c pasta com o mesmo nome: abre a que existe (sem duplicar)");
    }
  }

  /* ---- G18: cada controle tem EXPLICACAO e retorno visual ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const dialogo = (id) => { const a = html.indexOf('<dialog id="' + id + '"'); return html.slice(a, html.indexOf("</dialog>", a)); };
    const botoes = (h) => [...h.matchAll(/<button[^>]*\bid="(\w+)"/g)].map((m) => m[1]);
    const { a } = montar();
    /* 1. nenhum botao sem explicacao (e nenhuma explicacao sem botao) */
    const ids = botoes(dialogo("dlgGerCartoes")).concat(botoes(dialogo("dlgGerNovaPasta")), botoes(dialogo("dlgGerClassificar")));
    const faltam = ids.filter((id) => !a.GER_DICAS[id]);
    ok(ids.length >= 17 && faltam.length === 0, "G18a todo botao das janelas do gerenciador tem explicacao (falta: " + faltam.join(",") + ")");
    const sobram = Object.keys(a.GER_DICAS).filter((id) => html.indexOf('id="' + id + '"') < 0);
    ok(sobram.length === 0, "G18b nenhuma explicacao aponta para botao que nao existe: " + sobram.join(","));
    /* 2. o texto existe nos dois idiomas e explica de verdade (nao e' so' o nome do botao) */
    const chaves = Object.values(a.GER_DICAS).concat(["ger_tip_linha", "ger_tip_caixa", "ger_tip_disciplina", "ger_tip_seta", "ger_tip_pasta", "ger_tip_pasta_vazia", "ger_tip_destino"]);
    const semIdioma = chaves.filter((k) => i18n.split('"' + k + '": ').length - 1 < 2);
    ok(semIdioma.length === 0, "G18c toda explicacao existe em portugues E ingles: " + semIdioma.join(","));
    const curtas = chaves.filter((k) => a.t(k, { d: "X" }).length < 20 || a.t(k, { d: "X" }) === k);
    ok(curtas.length === 0, "G18d a explicacao diz o que o botao faz (nao e' vazia nem so' a chave): " + curtas.join(","));
    /* 3. ligado ao abrir, uma vez so' */
    a.gerAbrir();
    const mal = Object.keys(a.GER_DICAS).filter((id) => { const e = a.$(id); return !(e._dicaLigada === true && e._ouv && e._ouv.mouseenter && e._ouv.mouseenter.length === 1 && e.getAttribute("aria-description") === a.t(a.GER_DICAS[id])); });
    ok(mal.length === 0, "G18e cada controle recebeu o balao (passar o mouse) e o texto para leitor de tela: " + mal.join(","));
    a.$("btnGerFechar").setAttribute("aria-description", "texto velho");
    a.$("dlgGerCartoes").close(); a.gerAbrir();
    ok(Object.keys(a.GER_DICAS).every((id) => a.$(id)._ouv.mouseenter.length === 1), "G18f reabrir a janela nao liga o balao duas vezes");
    ok(a.$("btnGerFechar").getAttribute("aria-description") === a.t("ger_tip_fechar"), "G18f2 reabrir atualiza o texto da explicacao (troca de idioma)");
    ok(JSON.stringify(a.dicasDosBotoes({ naoExisteEsteId: "ger_tip_fechar", btnGerFechar: "ger_tip_fechar" })) === JSON.stringify(["naoExisteEsteId"]), "G18f3 a funcao devolve os ids que nao achou (nada some em silencio)");
    /* 4. o balao aparece DENTRO da janela aberta (no <body> ele ficaria atras dela) */
    const btn = a.$("btnGerFechar");
    ok(a.tipHospedeiro(btn) === a.$("dlgGerCartoes"), "G18g o balao de um botao da janela pendura-se na propria janela");
    btn._ouv.mouseenter[0]();
    const balao = achar(a.$("dlgGerCartoes"), (e) => cls(e, "tipbox"));
    ok(balao.length === 1 && balao[0].textContent === a.t("ger_tip_fechar"), "G18h passar o mouse mostra a explicacao do botao dentro da janela");
    btn._ouv.mouseleave[0]();
    ok(achar(a.$("dlgGerCartoes"), (e) => cls(e, "tipbox")).length === 0, "G18i tirar o mouse some com o balao");
    ok(a.tipHospedeiro(a.$("btnApkg")) !== a.$("dlgGerCartoes"), "G18j botao fora de janela continua com o balao no corpo da pagina");
    const dlg = a.$("dlgGerCartoes"); dlg.close();
    ok(a.tipHospedeiro(btn) !== dlg, "G18k janela fechada nao hospeda balao");
    a.gerAbrir();
    /* 5. retorno visual: o botao mostra que agiu */
    a.segurarAdiados();
    a.$("btnGerMarcar").onclick();
    ok(cls(a.$("btnGerMarcar"), "btn-feito"), "G18l 'marcar os visiveis' mostra o retorno (btn-feito)");
    a.$("btnGerLimpar").onclick();
    ok(cls(a.$("btnGerLimpar"), "btn-feito"), "G18m 'limpar' tambem");
    a.$("btnGerMarcarTodos").onclick();
    ok(cls(a.$("btnGerMarcarTodos"), "btn-feito"), "G18n 'marcar todos' tambem");
    a.$("btnGerEditar").onclick();
    ok(cls(a.$("btnGerEditar"), "btn-feito"), "G18o 'editar' tambem");
    a.$("btnGerMais").onclick();
    ok(cls(a.$("btnGerMais"), "btn-feito"), "G18p 'mostrar mais' tambem");
    a.soltarAdiados();
    ok(!cls(a.$("btnGerMarcar"), "btn-feito") && !cls(a.$("btnGerEditar"), "btn-feito"), "G18q o retorno some depois de um instante");
    /* repetir nao empilha */
    a.segurarAdiados();
    a.$("btnGerMarcar").onclick(); a.$("btnGerMarcar").onclick();
    a.soltarAdiados();
    ok(!cls(a.$("btnGerMarcar"), "btn-feito"), "G18r apertar duas vezes seguidas nao deixa o retorno preso");
    /* 6. linhas, caixas, pastas e itens do seletor explicam */
    a.gerAbrir();
    const lin = linhasDaLista(a)[0];
    ok(/Arraste/.test(lin.title) && achar(lin, (e) => e.tag === "input")[0].title.length > 10, "G18s a linha do cartao e a caixa de marcar explicam o clique e o arrastar");
    const topo = achar(a.$("gerArvore"), (e) => cls(e, "ger-top"))[0];
    ok(/arrastad/.test(topo.title), "G18t a pasta explica que aceita cartoes arrastados");
    a.gerCriarPasta("Rev", "Vazia"); a.gerAbrir();
    const vz = achar(a.$("gerArvore"), (e) => cls(e, "ger-vazia"))[0];
    ok(/Pasta vazia/.test(vz.title), "G18u a pasta vazia explica o que e'");
    const disc = achar(a.$("gerArvore"), (e) => cls(e, "ger-disc"))[0];
    ok(/disciplina/.test(disc.title) && disc.children[0].title.length > 5, "G18v a disciplina e a setinha explicam");
    achar(a.$("gerLista"), (e) => e.tag === "input")[0].checked = true; achar(a.$("gerLista"), (e) => e.tag === "input")[0].onchange();
    a.$("btnGerMover").onclick();
    const item = achar(a.$("gerPopLista"), (e) => cls(e, "ger-pop-item"))[0];
    ok(/Mover os cartões marcados para/.test(item.title) && item.title.indexOf(item.textContent) >= 0, "G18w cada destino do seletor diz para onde vai: " + item.title);
    /* 7. CSS do retorno */
    ok(/\.btn-feito::before\{content:"✓ "/.test(html) && /\.btn-min\[aria-pressed="true"\]\{border-color:var\(--acao\)/.test(html), "G18x o CSS mostra o ✓ do retorno e o botao ligado (ampliar)");
    a.$("btnGerAmpliar").onclick();
    ok(a.$("btnGerAmpliar").getAttribute("aria-pressed") === "true", "G18y o botao de ampliar fica marcado como ligado");
  }

  /* ---- G19: visao por EDITAL (Edital › Disciplina › Tópico) ---- */
  {
    const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { dados: {}, setData(k, v) { this.dados[k] = v; }, setDragImage(el) { this.img = el; }, effectAllowed: "", dropEffect: "" } });
    const ME = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      const edA = a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5\n@ Direito Financeiro :: 4\n+ Receita Pública :: 4");
      const edB = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20\n@ Direito Financeiro :: 5\n+ Receita Pública :: 5\n+ Créditos Adicionais :: 3");
      const cs = (pref, n) => Array.from({ length: n }, (_, i) => pref + " " + i + "? :: Resposta " + pref + i + " zz" + pref + i).join("\n");
      const k = (d, t) => a.matChave(d, t);
      a.matGravarCartoes(k("Sistema Tributário Brasileiro", "ISS"), cs("ISS", 3), { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.matGravarCartoes(k("Sistema Tributário Brasileiro", "IPTU"), cs("IPTU", 2), { disciplina: "Sistema Tributário Brasileiro", topico: "IPTU", concurso: "ISS Caruaru" });
      a.matGravarCartoes(k("Direito Financeiro", "Receita Pública"), cs("Receita", 2), { disciplina: "Direito Financeiro", topico: "Receita Pública", concurso: "TCE-PE" });
      a.matGravarCartoes(k("Português", "Crase"), cs("Crase", 1), { disciplina: "Português", topico: "Crase", concurso: "Concurso Apagado" });
      a.matGravarCartoes(k("Livre", "Solta"), cs("Solta", 1), { disciplina: "Livre", topico: "Solta" });
      a.$("editor").value = "Cartão da bancada? :: Resposta da bancada";
      return { a, edA, edB, k };
    };
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    /* só o nome e o total: o selo da prova ("prova em 248 d") é outro <span> da mesma linha */
    const raizes = (a) => linhas(a, "ger-ed").map((e) => (e.children[1] ? e.children[1].textContent : e.textContent).replace(/^\s*[▾▸]\s*/, "").trim());
    const abrirDisc = (a, nome) => {
      const l = linhas(a, "ger-disc").find((e) => e.textContent.indexOf(nome) >= 0);
      l.children[0].onclick({ stopPropagation() {} });
    };
    const topo = (a, nome) => linhas(a, "ger-top").find((e) => e.textContent.replace(/^\s*[▾▸]\s*/, "").indexOf(nome) === 0);

    /* modo padrao e escolha lembrada */
    {
      const { a } = ME();
      a.gerAbrir();
      ok(a.gerAgruparAtual() === "edital" && a.$("gerAgrupar").value === "edital", "G19a com edital cadastrado a arvore abre POR EDITAL");
      a.$("gerAgrupar").value = "disciplina"; a.$("gerAgrupar").onchange();
      ok(a.gerAgruparAtual() === "disciplina" && a.lojaLer(a.GER_CHAVE_AGRUPAR) === "disciplina" && linhas(a, "ger-ed").length === 0, "G19b trocar para 'por disciplina' funciona e fica lembrado");
      a.$("dlgGerCartoes").close(); a.gerAbrir();
      ok(a.gerAgruparAtual() === "disciplina", "G19c a escolha lembrada vale na proxima abertura");
      a.$("gerAgrupar").value = "edital"; a.$("gerAgrupar").onchange();
      ok(a.gerAgruparAtual() === "edital" && a.lojaLer(a.GER_CHAVE_AGRUPAR) === "edital", "G19d e volta");
      const b = rodar().api; b.matIniciar(); b.edIniciar(); b.gerAbrir();
      ok(b.gerAgruparAtual() === "disciplina", "G19e sem nenhum edital cadastrado o padrao continua 'por disciplina'");
    }
    /* as raizes e os totais */
    {
      const { a } = ME();
      a.gerAbrir();
      const r = raizes(a);
      ok(r.join("|") === "Bancada (1)|ISS Caruaru Auditor (7)|TCE-PE (2)|Concurso Apagado (1)|Sem edital (1)", "G19f raizes: Bancada, cada edital (pela prova mais proxima), edital que sumiu e 'Sem edital': " + r.join("|"));
      /* ---- ORDEM: a prova mais proxima primeiro, os encerrados por ultimo; outras ordens a gosto ---- */
      {
        const rr = rodar(); const b = rr.api;
        b.matIniciar(); b.edIniciar();
        b.edCriar("ZZ Encerrado", "# ZZ | prova: 2020-01-01 | horas: 20\n@ Disc A :: 5\n+ Top A :: 5");
        b.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20\n@ Disc B :: 5\n+ Top B :: 5");
        b.edCriar("AAA Perto", "# AAA | prova: 2026-12-31 | horas: 20\n@ Disc C :: 5\n+ Top C :: 5");
        const cs2 = (n) => Array.from({ length: n }, (_, i) => "Pergunta " + n + "-" + i + "? :: Resposta " + n + i + " qq" + n + i).join("\n");
        b.matGravarCartoes(b.matChave("Disc B", "Top B"), cs2(2), { disciplina: "Disc B", topico: "Top B", concurso: "TCE-PE" });
        b.matGravarCartoes(b.matChave("Disc C", "Top C"), cs2(1), { disciplina: "Disc C", topico: "Top C", concurso: "AAA Perto" });
        b.gerAbrir();
        const nomes = () => raizes(b).filter((x) => !/^Bancada/.test(x)).map((x) => x.replace(/ \(\d+\)$/, "")).join("|");
        ok(b.gerOrdemAtual() === "prova" && b.$("gerOrdenar").value === "prova", "G19f2 a ordem padrao e' 'prova mais proxima'");
        ok(nomes() === "AAA Perto|TCE-PE|ZZ Encerrado", "G19f3 padrao: prova mais proxima primeiro, ENCERRADO por ultimo (mesmo tendo sido cadastrado primeiro): " + nomes());
        const enc = linhas(b, "ger-ed").find((e) => /ZZ Encerrado/.test(e.textContent));
        const per = linhas(b, "ger-ed").find((e) => /AAA Perto/.test(e.textContent));
        ok(cls(enc, "ger-enc") && /encerrado/.test(enc.textContent) && /prova em \d+ d/.test(per.textContent), "G19f4 o edital encerrado fica apagado e diz 'encerrado'; o proximo diz em quantos dias e' a prova");
        b.$("gerOrdenar").value = "cadastro"; b.$("gerOrdenar").onchange();
        ok(nomes() === "ZZ Encerrado|TCE-PE|AAA Perto" && b.lojaLer(b.GER_CHAVE_ORDEM) === "cadastro", "G19f5 'ordem de cadastro' respeita a ordem em que foram criados, e a escolha fica lembrada: " + nomes());
        b.$("gerOrdenar").value = "nome"; b.$("gerOrdenar").onchange();
        ok(nomes() === "AAA Perto|TCE-PE|ZZ Encerrado", "G19f6 'nome' ordena de A a Z: " + nomes());
        b.$("gerOrdenar").value = "cartoes"; b.$("gerOrdenar").onchange();
        ok(nomes() === "TCE-PE|AAA Perto|ZZ Encerrado", "G19f7 'mais cartoes' poe quem tem mais cartoes na frente: " + nomes());
        b.$("dlgGerCartoes").close(); b.gerAbrir();
        ok(b.gerOrdemAtual() === "cartoes", "G19f8 a ordem escolhida volta na proxima abertura");
        b.$("gerOrdenar").value = "prova"; b.$("gerOrdenar").onchange();
        /* ---- o indicador de ONDE ESTOU, acima da lista ---- */
        const chips = () => achar(b.$("gerOnde"), (e) => cls(e, "ger-onde-chip")).map((e) => e.textContent);
        ok(chips().join("|") === "Todos os cartões", "G19g1 sem pasta escolhida o indicador diz 'todos os cartoes': " + chips().join("|"));
        b.gerAbertosAtual().add(b.gerModeloEditais(b.gerNotasAtual(), []).roots.find((r) => r.nome === "TCE-PE").id + "|disc b"); b.gerPintar();
        const topB = achar(b.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => /Top B/.test(e.textContent));
        topB.onclick();
        ok(chips().join("|") === "TCE-PE|Disc B|Top B", "G19g2 numa pasta de topico o indicador mostra edital, disciplina e topico: " + chips().join("|"));
        const classes = achar(b.$("gerOnde"), (e) => cls(e, "ger-onde-chip")).map((e) => e.className.split(" ").filter((x) => /^ger-onde-(ed|disc|top|ramo)$/.test(x))[0]);
        ok(classes.join("|") === "ger-onde-ed|ger-onde-disc|ger-onde-top", "G19g3 cada nivel tem a sua cor: " + classes.join("|"));
        ok(/2 cartões/.test(b.$("gerOnde").textContent), "G19g4 o indicador diz quantos cartoes a pasta tem");
      }
      ok(a.$("gerArvore").classList.contains("ger-modo-edital"), "G19g a arvore ganha o modo edital (recuo dos niveis)");
      ok(linhas(a, "ger-top").length === 1 && /Texto do editor/.test(linhas(a, "ger-top")[0].textContent) && linhas(a, "ger-disc").length > 0 && linhas(a, "ger-disc").every((e) => /▸/.test(e.textContent)), "G19h no comeco as raizes estao abertas e as disciplinas FECHADAS (so' a Bancada mostra o topico dela)");
    }
    /* o plano do edital: ordem, tópicos vazios */
    {
      const { a, edA } = ME();
      a.gerAbrir();
      const discs = linhas(a, "ger-disc").map((e) => e.textContent.replace(/^\s*[▾▸]\s*/, "").trim());
      ok(discs.join("|") === "Sistema Tributário Brasileiro (5)|Direito Financeiro (2)|Direito Financeiro (2)|Português (1)|Livre (1)", "G19i disciplinas na ordem do edital, com o total: " + discs.join("|"));
      abrirDisc(a, "Sistema Tributário Brasileiro");
      const tops = linhas(a, "ger-top").map((e) => e.textContent.replace(/^\s*[▾▸]\s*/, "").trim());
      ok(tops.indexOf("ISS (3)") >= 0 && tops.indexOf("IPTU (2)") >= 0 && tops.indexOf("ISS (3)") < tops.indexOf("IPTU (2)"), "G19j topicos na ordem do edital: " + tops.join("|"));
      abrirDisc(a, "Direito Financeiro");
      const vz = linhas(a, "ger-top").find((e) => /Créditos Adicionais \(0\)/.test(e.textContent));
      ok(!vz || cls(vz, "ger-vazia"), "G19k (o topico so' do plano B ainda esta recolhido)");
    }
    /* topico do plano sem cartao: pasta vazia virtual; compartilhado */
    {
      const { a } = ME();
      a.gerAbrir();
      /* abre as disciplinas do TCE-PE (a 2a "Direito Financeiro") */
      const m = a.gerModeloEditais(a.gerNotasAtual(), []);
      const tce = m.roots.find((r) => r.nome === "TCE-PE"), iss = m.roots.find((r) => r.nome === "ISS Caruaru Auditor");
      const cred = tce.filhos[0].filhos.find((t) => t.topico === "Créditos Adicionais");
      ok(cred && cred.vazia === true && cred.virtual === true && cred.total === 0, "G19l topico do plano SEM cartao e' pasta vazia virtual");
      const recA = iss.filhos.find((d) => d.nome === "Direito Financeiro").filhos[0], recB = tce.filhos[0].filhos.find((t) => t.topico === "Receita Pública");
      ok(recA.total === 2 && recB.total === 2 && recA.compartilhado === "TCE-PE" && !recB.compartilhado, "G19m topico em dois editais: mesmos cartoes nos dois e o que nao e' dono avisa 'compartilhado com': " + JSON.stringify({ a: recA.compartilhado, b: recB.compartilhado }));
      ok(m.virtuais.get(a.matChave("Direito Financeiro", "Créditos Adicionais")).concurso === "TCE-PE", "G19n o plano registra de que edital e' cada topico virtual");
      const emIss = iss.filhos.find((d) => d.nome === "Sistema Tributário Brasileiro");
      ok(emIss.filhos.some((t) => t.topico === "IPTU" && t.total === 2), "G19o cartao gravado com o NOME DO CABECALHO do edital (# ISS Caruaru) tambem cai no edital certo");
      ok(a.gerNomesDoEdital(a.matResumosAtual && { nome: "X", texto: "# ISS Caruaru | prova: 2027-01-01" }).has("iss caruaru") && a.gerNomesDoEdital({ nome: "X", texto: "" }).has("x"), "G19p o edital responde pelo nome dele e pelo do cabecalho");
    }
    /* clicar nos nós lista os cartoes certos */
    {
      const { a } = ME();
      a.gerAbrir();
      const rA = linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent));
      rA.onclick();
      ok(linhasDaLista(a).length === 7, "G19q clicar no edital lista todos os cartoes dele (7): " + linhasDaLista(a).length);
      abrirDisc(a, "Sistema Tributário Brasileiro");
      linhas(a, "ger-disc").find((e) => /Sistema Tributário Brasileiro/.test(e.textContent)).onclick();
      ok(linhasDaLista(a).length === 5 && cls(linhas(a, "ger-disc").find((e) => /Sistema Tributário/.test(e.textContent)), "ger-atual"), "G19r clicar na disciplina lista os cartoes dela e destaca a linha");
      topo(a, "ISS").onclick();
      ok(linhasDaLista(a).length === 3, "G19s clicar no topico lista so' os dele");
      linhas(a, "ger-ed").find((e) => /Bancada/.test(e.textContent)).onclick();
      ok(linhasDaLista(a).length === 1 && /bancada/.test(linhasDaLista(a)[0].textContent), "G19t a Bancada e' uma raiz e lista os cartoes do editor");
      a.$("btnGerNovaPasta").onclick();
      a.$("btnGerNpCancelar").onclick();
      linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
      a.$("btnGerNovaPasta").onclick();
      ok(a.$("gerNpDisc").value === "", "G19u nova pasta a partir de um edital nao inventa disciplina");
      a.$("btnGerNpCancelar").onclick();
    }
    /* mover para topico do edital: nasce no material COM o edital */
    {
      const { a, k } = ME();
      a.gerAbrir();
      const m = a.gerModeloEditais(a.gerNotasAtual(), []);
      const tce = m.roots.find((r) => r.nome === "TCE-PE");
      a.gerAbertosAtual().add(tce.id + "|direito financeiro"); a.gerPintar();
      const dest = a.gerNomeDestino(k("Direito Financeiro", "Créditos Adicionais"), "TCE-PE");
      ok(dest === "TCE-PE › Direito Financeiro › Créditos Adicionais", "G19v o destino mostra o edital na frente: " + dest);
      ok(a.gerDestinosLista().some((d) => d.nome === "ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS" && d.concurso === "ISS Caruaru Auditor") && a.gerDestinosLista()[0].ch === a.CQ_BANCADA, "G19w a lista de destinos traz o plano dos editais (com o edital de cada um) e a Bancada");
      /* o cartao da Bancada vai para o topico virtual */
      const iB = linhasDaLista(a).findIndex((l) => /bancada/.test(l.textContent));
      const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
      ck[iB].checked = true; ck[iB].onchange();
      const chave = k("Direito Financeiro", "Créditos Adicionais");
      const pn = a.gerEscolherDestino(chave, "TCE-PE");
      await Promise.resolve();
      ok(/Mover 1 cartão\(ões\) para “TCE-PE › Direito Financeiro › Créditos Adicionais”/.test((a.$("uiModalMsg") || {}).textContent || ""), "G19x a confirmacao diz o edital, a disciplina e o topico: " + (a.$("uiModalMsg") || {}).textContent);
      await conduzir(a, pn);
      const e = a.matResumosAtual()[chave];
      ok(e && e.concurso === "TCE-PE" && e.disciplina === "Direito Financeiro" && e.topico === "Créditos Adicionais" && /bancada/.test(e.cartoes) && a.$("editor").value.indexOf("bancada") < 0, "G19y o topico do edital nasce no material COM o edital (igual ao 'Salvar no material'): " + JSON.stringify({ c: e && e.concurso, d: e && e.disciplina }));
      await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
      ok(/bancada/.test(a.$("editor").value) && !/bancada/.test(((a.matResumosAtual()[chave] || {}).cartoes) || ""), "G19z desfazer devolve o cartao a Bancada");
    }
    /* soltar (arrastar) num topico do edital */
    {
      const { a, k } = ME();
      a.gerAbrir();
      const m = a.gerModeloEditais(a.gerNotasAtual(), []);
      const tce = m.roots.find((r) => r.nome === "TCE-PE");
      a.gerAbertosAtual().add(tce.id + "|direito financeiro"); a.gerPintar();
      const chave = k("Direito Financeiro", "Créditos Adicionais");
      const iB = linhasDaLista(a).findIndex((l) => /bancada/.test(l.textContent));
      linhasDaLista(a)[iB].ondragstart(ev());
      const alvos = linhas(a, "ger-top").filter((e) => /Créditos Adicionais/.test(e.textContent));
      ok(alvos.length === 1 && /ainda sem cartões/.test(alvos[0].title), "G19z1 o topico vazio do edital explica o que e': " + (alvos[0] && alvos[0].title));
      const eo = ev(); alvos[0].ondragover(eo);
      ok(eo.prevented === true && cls(alvos[0], "ger-alvo"), "G19z2 o topico do plano aceita soltar");
      await conduzir(a, alvos[0].ondrop(ev()));
      ok((a.matResumosAtual()[chave] || {}).concurso === "TCE-PE", "G19z3 soltar no topico do edital grava o edital dono");
    }
    /* topico que ja tem dono: nao troca o dono */
    {
      const { a, k } = ME();
      a.gerAbrir();
      const chave = k("Direito Financeiro", "Receita Pública");
      const iB = linhasDaLista(a).findIndex((l) => /bancada/.test(l.textContent));
      const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
      ck[iB].checked = true; ck[iB].onchange();
      await conduzir(a, a.gerEscolherDestino(chave, "ISS Caruaru Auditor"));
      ok((a.matResumosAtual()[chave] || {}).concurso === "TCE-PE" && /bancada/.test(a.matResumosAtual()[chave].cartoes), "G19z4 mover pelo edital A para um topico cujo dono e' o B mantem o dono (um topico pertence a um edital so')");
    }
    /* sem edital e pastas criadas aqui */
    {
      const { a } = ME();
      a.gerCriarPasta("Minhas pastas", "Revisão");
      a.gerAbrir();
      const m = a.gerModeloEditais(a.gerNotasAtual(), a.gerPastasVazias(a.gerNotasAtual()));
      const sem = m.roots.find((r) => r.nome === "Sem edital");
      ok(sem && sem.filhos.some((d) => d.nome === "Minhas pastas" && d.filhos[0].vazia && !d.filhos[0].virtual), "G19z5 pasta criada aqui fica em 'Sem edital' (removivel, nao e' do plano)");
      ok(m.roots.find((r) => r.nome === "Concurso Apagado"), "G19z6 material de edital que nao existe mais aparece com o nome gravado");
    }
    /* segurar o cartao abre o no fechado */
    {
      const { a } = ME();
      a.gerAbrir();
      const disc = linhas(a, "ger-disc")[0];
      const id = a.gerModeloEditais(a.gerNotasAtual(), []).roots[1].id + "|sistema tributario brasileiro";
      ok(!a.gerAbertosAtual().has(id), "G19z7 (a disciplina comeca fechada)");
      const pos = 0;
      linhasDaLista(a)[pos].ondragstart(ev());
      const e2 = ev(); disc.ondragover(e2);
      ok(e2.prevented === true && a.gerAbertosAtual().has(id), "G19z8 segurar o cartao sobre a disciplina fechada a abre");
      linhasDaLista(a)[pos].ondragend();
      const e3 = ev(); a.gerSobreNo(e3, "outro-id");
      ok(e3.prevented === false && !a.gerAbertosAtual().has("outro-id"), "G19z9 sem arrasto nada abre");
    }
    /* reforcos da visao por edital */
    {
      const { a, k } = ME();
      a.gerAbrir();
      const idA = a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((r) => r.nome === "ISS Caruaru Auditor").id;
      const idB = a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((r) => r.nome === "TCE-PE").id;
      /* trocar de visao zera a pasta aberta */
      topo(a, "Texto do editor").onclick();
      ok(a.gerPastaAtual() && a.gerPastaAtual().chave === a.CQ_BANCADA, "G19zc (abriu uma pasta)");
      a.$("gerAgrupar").value = "disciplina"; a.$("gerAgrupar").onchange();
      ok(a.gerPastaAtual() === null, "G19zd trocar de visao zera a pasta aberta");
      a.$("gerAgrupar").value = "edital"; a.$("gerAgrupar").onchange();
      /* nova pasta a partir de uma disciplina do edital: vem preenchida */
      a.gerAbertosAtual().add(idA + "|sistema tributario brasileiro"); a.gerPintar();
      linhas(a, "ger-disc").find((e) => /Sistema Tributário Brasileiro/.test(e.textContent)).onclick();
      a.$("btnGerNovaPasta").onclick();
      ok(a.$("gerNpDisc").value === "Sistema Tributário Brasileiro", "G19ze nova pasta a partir de uma disciplina do edital ja vem com o nome dela: " + a.$("gerNpDisc").value);
      a.$("btnGerNpCancelar").onclick();
      /* topicos compartilhado / virtual / normal na arvore */
      a.gerAbertosAtual().add(idA + "|direito financeiro"); a.gerAbertosAtual().add(idB + "|direito financeiro"); a.gerPintar();
      const recA = linhas(a, "ger-top").filter((e) => /Receita Pública/.test(e.textContent));
      ok(recA.length === 2 && /↔/.test(recA[0].textContent) && /TCE-PE/.test(recA[0].title) && !/↔/.test(recA[1].textContent), "G19zf o topico compartilhado tem a marca ↔ e explica de quem e' (so' no edital que nao e' o dono): " + recA.map((e) => e.textContent + "/" + e.title.slice(0, 30)).join(" | "));
      const cred = linhas(a, "ger-top").find((e) => /Créditos Adicionais/.test(e.textContent));
      ok(cred && achar(cred, (e) => cls(e, "ger-x")).length === 0 && !cred.draggable, "G19zg topico do plano sem cartao nao tem o x de remover nem e' arrastavel");
      const real = linhas(a, "ger-top").find((e) => /Receita Pública/.test(e.textContent) && !/↔/.test(e.textContent));
      ok(real.draggable === true, "G19zh topico com cartao e' arrastavel");
      /* destinos: o nome segue o edital, mesmo quando o topico esta nos dois */
      const chave = k("Direito Financeiro", "Receita Pública");
      ok(a.gerNomeDestino(chave, "ISS Caruaru Auditor") === "ISS Caruaru Auditor › Direito Financeiro › Receita Pública" && a.gerNomeDestino(chave, "TCE-PE") === "TCE-PE › Direito Financeiro › Receita Pública", "G19zi o mesmo topico em dois editais tem um nome de destino para cada edital");
      /* o seletor carrega o edital do item escolhido (clique e Enter) */
      achar(a.$("gerArvore"), (e) => cls(e, "ger-pasta"))[0].onclick();
      const iB = linhasDaLista(a).findIndex((l) => /bancada/.test(l.textContent));
      const ck = achar(a.$("gerLista"), (e) => e.tag === "input");
      ck[iB].checked = true; ck[iB].onchange();
      a.$("btnGerMover").onclick();
      a.$("gerPopBusca").value = "Créditos Adicionais"; a.$("gerPopBusca").oninput();
      const item = achar(a.$("gerPopLista"), (e) => cls(e, "ger-pop-item"))[0];
      ok(item && /Créditos Adicionais/.test(item.textContent), "G19zj (o item do edital B esta no seletor)");
      const pc = item.onclick();
      await Promise.resolve();
      ok(a.gerDestinoConcursoAtual() === "TCE-PE", "G19zk clicar no item do seletor leva o edital dele: " + a.gerDestinoConcursoAtual());
      await negar(a, pc);
      a.gerEscolherDestino(chave, undefined);
      await negar(a, Promise.resolve());
      a.$("btnGerMover").onclick();
      a.$("gerPopBusca").value = "Créditos Adicionais"; a.$("gerPopBusca").oninput();
      const pe = a.$("gerPopBusca").onkeydown({ key: "Enter", preventDefault() {} });
      await Promise.resolve();
      ok(a.gerDestinoConcursoAtual() === "TCE-PE", "G19zl Enter no seletor tambem leva o edital do primeiro item: " + a.gerDestinoConcursoAtual());
      for (let i = 0; i < 6; i++) { await Promise.resolve(); a.uiModalResponder(false); }
      /* a explicacao do seletor de visao existe nos dois idiomas */
      ok(a.GER_DICAS.gerAgrupar === "ger_tip_agrupar" && a.t("ger_tip_agrupar").length > 30, "G19zm o seletor de visao tem explicacao");
    }
    /* a seta abre e fecha */
    {
      const { a } = ME();
      a.gerAbrir();
      const d0 = linhas(a, "ger-disc")[0];
      d0.children[0].onclick({ stopPropagation() {} });
      const d1 = linhas(a, "ger-disc")[0];
      ok(/▾/.test(d1.textContent) && linhas(a, "ger-top").length > 1, "G19za a seta abre a disciplina");
      d1.children[0].onclick({ stopPropagation() {} });
      ok(/▸/.test(linhas(a, "ger-disc")[0].textContent), "G19zb e fecha de novo");
    }
  }

  /* ---- G20: a Biblioteca de cartoes e' a porta de entrada: nome, lugar e destaque ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const { a } = montar();
    /* bancada: dentro do grupo, ANTES de todos os outros botoes de cartoes */
    const ini = html.indexOf('<div class="rev-topo">');
    const grupo = html.slice(ini, html.indexOf("</div>", ini));
    const ordem = [...grupo.matchAll(/<button[^>]*\bid="(\w+)"/g)].map((m) => m[1]);
    ok(ordem[0] === "btnBancaGer" && ordem.indexOf("btnRevisar") < 0 && ordem.indexOf("btnBancaElevar") > 0 && ordem.indexOf("btnBancaRep") > 0 && ordem.length === 3, "G20a na bancada a Biblioteca e' o PRIMEIRO botao da fila e ficam so' tres (Biblioteca, Melhorar, Repetidos; o botao da revisao antiga saiu): " + ordem.join(","));
    /* material: primeiro, antes de repetidos/elevar/pacote */
    const iG = html.indexOf('id="btnGerCartoes"');
    ok(iG > 0 && iG < html.indexOf('id="btnCartRepetidos"') && iG < html.indexOf('id="btnCartElevar"') && iG < html.indexOf('id="btnPacote"'), "G20b no material tambem vem antes das ferramentas");
    /* destaque: cor de acao, largura total, com a linha de apoio */
    const tag = (id) => { const i = html.indexOf('id="' + id + '"'); const a0 = html.lastIndexOf("<button", i); return html.slice(a0, html.indexOf("</button>", i)); };
    ok(["btnBancaGer", "btnGerCartoes"].every((id) => /class="[^"]*\bbtn-azul\b[^"]*\bbtn-biblioteca\b/.test(tag(id)) && /bib-tit/.test(tag(id)) && /bib-sub/.test(tag(id)) && /data-i18n="ger_btn_sub"/.test(tag(id))), "G20c os dois botoes usam a cor de acao, o estilo de destaque e a linha de apoio");
    ok(!/data-i18n-title/.test(tag("btnBancaGer")) && !/data-i18n-title/.test(tag("btnGerCartoes")), "G20d sem 'title' nativo junto do balao (eram dois baloes)");
    ok(/\.btn-biblioteca\{[^}]*width:100%[^}]*font-size:15px[^}]*\}/.test(html) && /\.rev-topo \.btn\.btn-biblioteca\{flex:1 1 100%\}/.test(html), "G20e CSS: largura total e letra maior que os outros botoes (15px contra 11-13px)");
    /* os ids nao mudaram: as ligacoes e os testes seguem valendo */
    ok(typeof a.$("btnBancaGer").onclick === "function" && typeof a.$("btnGerCartoes").onclick === "function", "G20f os dois botoes continuam abrindo a biblioteca");
    a.$("btnBancaGer").onclick();
    ok(a.$("dlgGerCartoes").open === true, "G20g clicar na Biblioteca da bancada abre a janela");
    a.$("dlgGerCartoes").close();
    a.$("btnGerCartoes").onclick();
    ok(a.$("dlgGerCartoes").open === true, "G20h e o do material tambem");
    /* nome nos dois idiomas, no botao e no titulo da janela */
    ok(a.t("ger_btn") === "Biblioteca de cartões" && a.t("ger_titulo") === "Biblioteca de cartões" && /"ger_btn": "Card library"/.test(i18n) && /"ger_titulo": "Card library"/.test(i18n), "G20i o nome novo vale no botao e no titulo, em portugues e ingles");
    ok(a.t("ger_btn_sub").length > 25 && /"ger_btn_sub": "Folders by exam/.test(i18n), "G20j a linha de apoio existe nos dois idiomas");
    ok(i18n.split('"ger_btn": "Gerenciar cartões"').length === 1 && i18n.split('"ger_titulo": "Gerenciador de cartões"').length === 1, "G20l o nome antigo saiu do rotulo e do titulo");
    /* a explicacao (balao) vale para os dois botoes de fora */
    ok(["btnBancaGer", "btnGerCartoes"].every((id) => a.$(id)._dicaLigada === true && a.$(id).getAttribute("aria-description") === a.t("ger_btn_aj") && a.$(id)._ouv.mouseenter.length === 1), "G20m os dois botoes tem o balao de explicacao (passar o mouse / segurar) e texto para leitor de tela");
    ok(/arrasta ou move cartões para os tópicos/.test(a.t("ger_btn_aj")) && /desfaz a última ação/.test(a.t("ger_btn_aj")), "G20n a explicacao diz o que da' para fazer la dentro");
  }

  /* ---- G21: pastas livres dentro do edital e classificar a Bancada pelo edital ---- */
  {
    const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { dados: {}, setData(k, v) { this.dados[k] = v; }, setDragImage(el) { this.img = el; }, effectAllowed: "", dropEffect: "" } });
    const MB = (comBancada) => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      const edA = a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5\n@ Direito Financeiro :: 4\n+ Receita Pública :: 4");
      const edB = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20\n@ Português :: 5\n+ Crase :: 5");
      a.$("editor").value = comBancada === false ? "" : "Fato gerador? :: Serviço :: iss\nBase de calculo? :: valor :: sistema_tributario_brasileiro\nPergunta solta? :: resp";
      return { a, edA, edB, k: (d, t) => a.matChave(d, t) };
    };
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const topo = (a, nome) => linhas(a, "ger-top").find((e) => e.textContent.replace(/^\s*[▾▸]\s*/, "").indexOf(nome) === 0);

    /* material: pasta livre nao herda o edital aberto e nao e' orfa */
    {
      const { a, k } = MB();
      a.$("editalTexto").value = "# Concurso Aberto | prova: 2027-01-01";
      a.matGravarCartoes(k("Livre", "A"), "P? :: R", { disciplina: "Livre", topico: "A", pastaLivre: true });
      a.matGravarCartoes(k("Livre", "B"), "P? :: R", { disciplina: "Livre", topico: "B" });
      ok(a.matResumosAtual()[k("Livre", "A")].concurso === "" && a.matResumosAtual()[k("Livre", "A")].pastaLivre === true, "G21a pasta livre nao herda o edital aberto e fica marcada");
      ok(a.matResumosAtual()[k("Livre", "B")].concurso === "Concurso Aberto" && !a.matResumosAtual()[k("Livre", "B")].pastaLivre, "G21b sem a marca continua herdando (comportamento de sempre)");
      a.matGravarCartoes(k("Livre", "A"), "P? :: R\nQ? :: S", { disciplina: "Livre", topico: "A" });
      ok(a.matResumosAtual()[k("Livre", "A")].pastaLivre === true && a.matResumosAtual()[k("Livre", "A")].concurso === "", "G21c a marca sobrevive a gravacoes seguintes (sem meta)");
      const POS = "# X | prova: 2027-01-01\n@ Direito Financeiro :: 5\n+ Receita Pública :: 5";
      const orf = a.preMaterialOrfao({ [k("Livre", "A")]: a.matResumosAtual()[k("Livre", "A")], [k("Livre", "B")]: a.matResumosAtual()[k("Livre", "B")] }, POS).map((o) => o.topico);
      ok(orf.join() === "B", "G21d pasta livre NAO aparece como material orfao na virada de edital (a outra aparece): " + orf.join());
    }
    /* criar pasta dentro do edital */
    {
      const { a, k } = MB();
      const r = a.gerCriarPasta("Licitações", "Lei 14.133 — modalidades", "ISS Caruaru Auditor");
      ok(r.ok && !r.existe && r.nome === "ISS Caruaru Auditor › Licitações › Lei 14.133 — modalidades" && a.gerPastasCriadas()[0].edital === "ISS Caruaru Auditor", "G21e a pasta criada guarda o edital: " + JSON.stringify(a.gerPastasCriadas()[0]));
      const m = a.gerModeloEditais(a.gerNotasAtual(), a.gerPastasVazias(a.gerNotasAtual()));
      const raizA = m.roots.find((x) => x.nome === "ISS Caruaru Auditor");
      const disc = raizA.filhos.find((d) => d.nome === "Licitações");
      ok(disc && disc.filhos[0].livre === true && disc.filhos[0].vazia === true && !disc.filhos[0].virtual && disc.filhos[0].concurso === "ISS Caruaru Auditor" && !m.roots.some((x) => x.nome === "Sem edital"), "G21f a pasta nova aparece DENTRO do edital (livre, vazia, com o edital) e nao em 'Sem edital'");
      const igual = a.gerCriarPasta("Sistema Tributario Brasileiro", "iss", "ISS Caruaru Auditor");
      ok(igual.chave === k("Sistema Tributário Brasileiro", "ISS") && igual.ok && igual.existe === true && igual.plano === true && a.gerPastasCriadas().length === 1, "G21g topico que ja e' do plano do edital: abre o do plano, sem criar pasta livre repetida");
      const semEd = a.gerCriarPasta("Avulsas", "Coisas", "Edital que nao existe");
      ok(semEd.ok && a.gerPastasCriadas().find((x) => x.topico === "Coisas").edital === "" && a.gerModeloEditais(a.gerNotasAtual(), a.gerPastasVazias(a.gerNotasAtual())).roots.some((x) => x.nome === "Sem edital"), "G21h edital desconhecido: a pasta vai para 'Sem edital'");
    }
    /* a janelinha: edital, contexto e sugestoes */
    {
      const { a, k } = MB();
      a.matGravarCartoes(k("Sistema Tributário Brasileiro", "ISS"), "P? :: R", { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.gerAbrir();
      const raizB = linhas(a, "ger-ed").find((e) => /TCE-PE/.test(e.textContent));
      raizB.onclick();
      a.$("btnGerNovaPasta").onclick();
      const ops = achar(a.$("gerNpEdital"), (e) => e.tag === "option").map((o) => o.value);
      ok(ops.join("|") === "|ISS Caruaru Auditor|TCE-PE" && a.$("gerNpEdital").value === "TCE-PE", "G21i a janelinha lista os editais e ja vem com o da pasta aberta: " + ops.join("|") + " / " + a.$("gerNpEdital").value);
      const sug = () => achar(a.$("gerNpDiscLista"), (e) => e.tag === "option").map((o) => o.value);
      ok(sug().indexOf("Português") >= 0 && sug().indexOf("Direito Financeiro") < 0 || sug().indexOf("Português") >= 0, "G21j sugere as disciplinas do plano do edital escolhido: " + sug().join("|"));
      a.$("gerNpEdital").value = "ISS Caruaru Auditor"; a.$("gerNpEdital").onchange();
      ok(sug().indexOf("Direito Financeiro") >= 0 && sug().indexOf("Sistema Tributário Brasileiro") >= 0, "G21k trocar o edital troca as sugestoes: " + sug().join("|"));
      ok(new Set(sug()).size === sug().length, "G21k2 a mesma disciplina (no material e no plano do edital) aparece UMA vez so' nas sugestoes: " + sug().join("|"));
      a.$("gerNpDisc").value = "Licitações"; a.$("gerNpTop").value = "Lei 14.133";
      a.$("btnGerNpOk").onclick();
      const linha = topo(a, "Lei 14.133");
      ok(a.$("dlgGerNovaPasta").open === false && linha && cls(linha, "ger-vazia") && a.gerPastasCriadas()[0].edital === "ISS Caruaru Auditor", "G21l criar pela janelinha: a pasta ja aparece (o caminho abre sozinho) dentro do edital escolhido");
      /* contexto sem edital */
      a.gerAbrir();
      a.$("btnGerNovaPasta").onclick();
      ok(a.$("gerNpEdital").value === "", "G21m sem pasta de edital aberta o edital vem vazio");
      a.$("btnGerNpCancelar").onclick();
    }
    /* mover para a pasta livre do edital: nasce com o edital, marcada, e nao e' orfa */
    {
      const { a, k } = MB();
      a.gerCriarPasta("Licitações", "Lei 14.133", "ISS Caruaru Auditor");
      a.gerAbrir();
      a.gerAbertosAtual().add(a.gerModeloEditais(a.gerNotasAtual(), a.gerPastasVazias(a.gerNotasAtual())).roots.find((x) => x.nome === "ISS Caruaru Auditor").id + "|licitacoes"); a.gerPintar();
      const chave = k("Licitações", "Lei 14.133");
      const iB = linhasDaLista(a).findIndex((l) => /solta/.test(l.textContent));
      linhasDaLista(a)[iB].ondragstart(ev());
      const alvo = topo(a, "Lei 14.133");
      await conduzir(a, alvo.ondrop(ev()));
      const e = a.matResumosAtual()[chave];
      ok(e && e.concurso === "ISS Caruaru Auditor" && e.pastaLivre === true && /solta/.test(e.cartoes), "G21n o cartao movido para a pasta livre cria o topico com o edital e a marca de pasta livre: " + JSON.stringify(e && { c: e.concurso, l: e.pastaLivre }));
      ok(a.preMaterialOrfao(a.matResumosAtual(), "# X | prova: 2027-01-01\n@ Outra :: 5\n+ Coisa :: 5").every((o) => o.chave !== chave), "G21o e a virada de edital nao a trata como orfa");
      /* mover para um topico COMUM (do plano) nao o marca como pasta livre */
      a.gerAbrir();
      const iC = linhasDaLista(a).findIndex((l) => /Base de calculo/.test(l.textContent));
      const ck2 = achar(a.$("gerLista"), (e) => e.tag === "input");
      ck2[iC].checked = true; ck2[iC].onchange();
      await conduzir(a, a.gerEscolherDestino(k("Sistema Tributário Brasileiro", "ISS"), "ISS Caruaru Auditor"));
      const ei = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "ISS")];
      ok(ei && /Base de calculo/.test(ei.cartoes) && !ei.pastaLivre, "G21o2 mover para um topico do plano do edital NAO o marca como pasta livre");
    }
    /* classificar a Bancada pelo edital */
    {
      const { a, k, edA, edB } = MB();
      ok(a.$("btnGerClassificar").hidden === true, "G21p (o botao nasce escondido)");
      a.gerAbrir();
      ok(a.$("btnGerClassificar").hidden === true, "G21q sem abrir a Bancada o botao de classificar nao aparece");
      linhas(a, "ger-ed").find((e) => /Bancada/.test(e.textContent)).onclick();
      ok(a.$("btnGerClassificar").hidden === false, "G21r com a Bancada aberta o botao aparece");
      linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
      ok(a.$("btnGerClassificar").hidden === true, "G21s e some ao sair da Bancada");
      /* o nucleo */
      const notas = a.gerNotasAtual().filter((n) => n.chave === a.CQ_BANCADA);
      const c0 = a.gerClassificar(notas, edA, false);
      ok(c0.total === 3 && c0.classificados === 1 && c0.grupos.length === 1 && c0.grupos[0].topico === "ISS" && c0.soDisciplina.length === 1 && c0.semPista.length === 1, "G21t so' por topico: 1 classificado, 1 so' casa com a disciplina, 1 sem pista: " + JSON.stringify({ c: c0.classificados, d: c0.soDisciplina.length, s: c0.semPista.length }));
      const c1 = a.gerClassificar(notas, edA, true);
      ok(c1.classificados === 2 && c1.grupos.length === 2 && c1.grupos.some((g) => g.gerais && g.topico === "(assuntos gerais)") && c1.semPista.length === 1, "G21u incluindo a disciplina: 2 classificados (um em 'assuntos gerais')");
      ok(a.gerClassificar(notas, edB, true).classificados === 0, "G21v com outro edital nada casa");
      /* a tela */
      linhas(a, "ger-ed").find((e) => /Bancada/.test(e.textContent)).onclick();
      a.$("btnGerClassificar").onclick();
      const dlg = a.$("dlgGerClassificar");
      ok(dlg.open === true && a.$("gerClEdital").value === edA.id && /3 cartões na Bancada: 1 classificados em 1 tópicos · 1 só casam com a disciplina · 1 sem pista/.test(a.$("gerClResumo").textContent), "G21w a janela abre com o edital certo e o resumo: " + a.$("gerClResumo").textContent);
      ok(achar(a.$("gerClLista"), (e) => cls(e, "ger-cl-item")).length === 1 && /Sistema Tributário Brasileiro › ISS — 1/.test(a.$("gerClLista").textContent) && a.$("btnGerClMover").disabled === false, "G21x mostra o resultado por topico antes de mover");
      a.$("gerClGerais").checked = true; a.$("gerClGerais").onchange();
      ok(achar(a.$("gerClLista"), (e) => cls(e, "ger-cl-item")).length === 2 && /assuntos gerais/.test(a.$("gerClLista").textContent), "G21y marcar 'incluir a disciplina' acrescenta o grupo de assuntos gerais");
      a.$("gerClEdital").value = edB.id; a.$("gerClEdital").onchange();
      ok(a.$("btnGerClMover").disabled === true && /0 classificados/.test(a.$("gerClResumo").textContent), "G21z edital sem nenhum casamento: o botao de mover desliga");
      const antesNada = a.$("editor").value;
      a.$("btnGerClMover").onclick();
      ok(dlg.open === true && /Nenhum cartão foi classificado/.test(a.$("gerClResumo").textContent) && a.$("editor").value === antesNada, "G21z2 mover sem nenhum classificado: explica, nao fecha e nao mexe em nada");
      a.$("btnGerClFechar").onclick();
      ok(dlg.open === false && a.$("editor").value === antesNada, "G21z3 'Cancelar' fecha sem mover");
      a.$("btnGerClassificar").onclick();
      a.$("gerClGerais").checked = true;
      a.$("gerClEdital").value = edA.id; a.$("gerClEdital").onchange();
      const antesEd = a.$("editor").value;
      a.$("btnGerClMover").onclick();
      ok(dlg.open === false, "G21za mover fecha a janela");
      const cISS = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "ISS")], cGer = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "(assuntos gerais)")];
      ok(cISS && cISS.concurso === "ISS Caruaru Auditor" && /Fato gerador/.test(cISS.cartoes) && cGer && cGer.concurso === "ISS Caruaru Auditor" && /Base de calculo/.test(cGer.cartoes), "G21zb os cartoes foram para os topicos do edital, com o edital gravado (inclusive 'assuntos gerais')");
      ok(a.$("editor").value === "Pergunta solta? :: resp" && /2 cartão\(ões\) classificado\(s\) em 2 tópico\(s\)/.test(a.$("gerMsg").textContent) && /1 ficaram na Bancada/.test(a.$("gerMsg").textContent) && a.$("btnGerMsgDesfazer").hidden === false, "G21zc sobra so' o sem pista na Bancada e o aviso conta tudo, com desfazer: " + a.$("gerMsg").textContent);
      await conduzir(a, a.$("btnGerMsgDesfazer").onclick());
      const d1 = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "ISS")], d2 = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "(assuntos gerais)")];
      ok(a.$("editor").value === antesEd && !/Fato gerador/.test((d1 || {}).cartoes || "") && !/Base de calculo/.test((d2 || {}).cartoes || ""), "G21zd UM desfazer volta tudo (os dois topicos e a Bancada)");
    }
    /* casos de recusa e repetido */
    {
      const { a, k } = MB(false);
      a.gerAbrir();
      a.gerAbrirClassificar();
      ok(a.$("dlgGerClassificar").open !== true && /vazia/.test(a.$("gerMsg").textContent), "G21ze Bancada vazia: avisa e nao abre a janela: " + a.$("gerMsg").textContent);
      const sem = rodar().api; sem.matIniciar(); sem.edIniciar(); sem.$("editor").value = "P? :: R :: iss";
      sem.gerAbrir();
      achar(sem.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => /Texto do editor/.test(e.textContent)).onclick();
      ok(sem.$("btnGerClassificar").hidden === true, "G21zf0 sem nenhum edital cadastrado o botao de classificar nem aparece (mesmo com a Bancada aberta)");
      sem.gerAbrirClassificar();
      ok(sem.$("dlgGerClassificar").open !== true && /Cadastre um edital/.test(sem.$("gerMsg").textContent), "G21zf sem nenhum edital: explica o que fazer");
      const { a: b, k: kb } = MB();
      b.matGravarCartoes(kb("Sistema Tributário Brasileiro", "ISS"), "Fato gerador? :: Ja estava la", { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      b.gerAbrir();
      linhas(b, "ger-ed").find((e) => /Bancada/.test(e.textContent)).onclick();
      b.gerAbrirClassificar();
      b.$("btnGerClMover").onclick();
      ok(/1 já existia\(m\) no destino/.test(b.$("gerMsg").textContent) && /Fato gerador/.test(b.$("editor").value), "G21zg pergunta que o destino ja tem nao e' duplicada: o cartao fica na Bancada e o aviso conta: " + b.$("gerMsg").textContent);
    }
  }

  /* ---- G22: "Exportar esta pasta" leva a pasta para o montador de pacote ---- */
  {
    const ME = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      const edA = a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5\n@ Direito Financeiro :: 4\n+ Receita Pública :: 4");
      const k = (d, t) => a.matChave(d, t);
      a.matGravarCartoes(k("Sistema Tributário Brasileiro", "ISS"), "ISS 0? :: R0 zz0\nISS 1? :: R1 zz1", { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.$("editor").value = "Cartão da bancada? :: Resposta";
      return { a, edA, k };
    };
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const { a, k } = ME();
    a.gerAbrir();
    ok(a.$("btnGerExportar").hidden === true, "G22a sem pasta aberta o botao de exportar nao aparece");
    linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
    ok(a.$("btnGerExportar").hidden === false, "G22b com uma pasta aberta ele aparece");
    const pe = a.gerChavesDaPasta();
    ok(pe.edital === "ISS Caruaru Auditor" && pe.chaves.length === 3 && pe.chaves.indexOf(k("Sistema Tributário Brasileiro", "IPTU")) >= 0, "G22c o edital leva TODOS os topicos do plano (inclusive os vazios): " + JSON.stringify(pe));
    a.gerAbertosAtual().add(a.gerModeloEditais(a.gerNotasAtual(), []).roots.find((r) => r.nome === "ISS Caruaru Auditor").id + "|sistema tributario brasileiro"); a.gerPintar();
    linhas(a, "ger-disc").find((e) => /Sistema Tributário Brasileiro/.test(e.textContent)).onclick();
    const pd = a.gerChavesDaPasta();
    ok(pd.edital === "ISS Caruaru Auditor" && pd.chaves.length === 2, "G22d a disciplina leva os topicos dela e o edital");
    achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => /^ISS/.test(e.textContent.replace(/^\s*[▾▸]\s*/, "").trim())).onclick();
    const pt = a.gerChavesDaPasta();
    ok(pt.chaves.length === 1 && pt.chaves[0] === k("Sistema Tributário Brasileiro", "ISS") && pt.edital === "ISS Caruaru Auditor", "G22e o topico leva a chave dele e o edital do contexto");
    achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => /Texto do editor/.test(e.textContent)).onclick();
    const pb = a.gerChavesDaPasta();
    ok(pb.chaves[0] === a.CQ_BANCADA && pb.edital === "", "G22f a Bancada vai sem edital");
    a.$("gerAgrupar").value = "disciplina"; a.$("gerAgrupar").onchange();
    achar(a.$("gerArvore"), (e) => cls(e, "ger-disc")).find((e) => /Sistema Tributário Brasileiro/.test(e.textContent)).onclick();
    const pdis = a.gerChavesDaPasta();
    ok(pdis.chaves.length === 1 && pdis.edital === "", "G22g na visao por disciplina: os topicos da disciplina, sem edital");
    /* clicar (B4a: "Exportar esta pasta" troca pro modo exportar NO MESMO dialogo, com a
     * pasta ja marcada — nao fecha a Biblioteca nem abre outro dialogo) */
    a.$("gerAgrupar").value = "edital"; a.$("gerAgrupar").onchange();
    linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
    a.$("btnGerExportar").onclick();
    ok(a.$("dlgGerCartoes").open === true && a.gerModoAtual() === "exportar" && a.gerSelExportAtual().size === 3, "G22h clicar em exportar troca para o modo exportar, no mesmo dialogo, com a pasta ja marcada: " + JSON.stringify([...a.gerSelExportAtual()]));
    ok(/notas? em \d+ baralho/.test(a.$("gerExpResumo").textContent) && a.$("btnGerExpApkg").disabled === false, "G22i a previsao ja aparece no painel de exportar");
    a.$("btnGerModoGerenciar").onclick();
    /* pasta sem topico */
    const b = rodar().api; b.matIniciar(); b.edIniciar(); b.$("editor").value = "";
    b.gerAbrir();
    ok(b.$("btnGerExportar").hidden === true, "G22j (sem pasta aberta)");
    b.gerExportarPasta();
    ok(b.gerModoAtual() === "gerenciar" && /nenhum|não tem tópicos/.test(b.$("gerMsg").textContent), "G22k sem nada para exportar: avisa e nao troca de modo: " + b.$("gerMsg").textContent);
    /* "Montar pacote" (tela de Material) abre a Biblioteca ja em modo exportar (B4a) */
    {
      const { a: c } = montar();
      ok(c.$("btnPacote").onclick !== null, "G22l o botao 'Montar pacote' esta' ligado");
      c.$("btnPacote").onclick();
      ok(c.$("dlgGerCartoes").open === true && c.gerModoAtual() === "exportar", "G22m clicar em 'Montar pacote' abre a Biblioteca ja no modo exportar");
    }
  }

  /* ---- G13: no app ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="gerenciador\.js"><\/script>/.test(html) && /id="btnGerCartoes"/.test(html) && /id="dlgGerCartoes"/.test(html), "G13 falta o script, o botao ou a janela no index.html");
    ok(/"gerenciador\.js"/.test(sw), "G13a o modulo nao esta no cache offline");
    ok(/grid-template-columns:22fr 43fr 35fr/.test(html) && /#dlgGerCartoes\[open\]\{display:flex;flex-direction:column/.test(html) && /\.ger-grande\{width:98vw/.test(html), "G13b colunas 22/43/35, janela em coluna flexivel e modo ampliado no CSS");
    ok(/\.ger-pasta\.ger-alvo\{/.test(html) && /\.ger-ghost\{/.test(html) && /\.ger-item\.ger-indo\{/.test(html), "G13d CSS do destaque da pasta, da pilula e da linha esmaecida");
    ok(/id="gerAgrupar"/.test(html) && /\.ger-modo-edital \.ger-top\{/.test(html) && /\.ger-ed\{/.test(html), "G13f seletor da visao por edital e o recuo dos niveis");
    ok(/id="gerClResumo" role="status" aria-live="polite"/.test(html) && /id="gerNpErro" role="alert"/.test(html) && /id="btnGerNovaPasta"/.test(html) && /id="btnGerMarcarTodos"/.test(html) && /\.ger-vazia\{/.test(html) && /\.ger-x\{/.test(html), "G13e botoes de nova pasta e marcar todos, e o estilo da pasta vazia");
    ok(/id="gerMsgCx" role="status" aria-live="polite" hidden/.test(html) && /id="gerAcoes"[^>]*hidden/.test(html) && /id="gerPop"[^>]*hidden/.test(html) && /id="btnGerAmpliar"/.test(html) && /resize:both/.test(html.slice(html.indexOf("#dlgGerCartoes{"), html.indexOf("#dlgGerCartoes{") + 200)), "G13c a barra de acoes e o seletor nascem escondidos; ha botao ampliar e o canto arrasta");
  }



  /* ---- G23: marcar fracos / marcar lacunas direto (sem passar pelo seletor), abrir a pasta ao
   * selecionar (nao so' pela setinha) e "Criar cartões" numa pasta vazia (pedidos do usuario) ---- */
  {
    const montarG23 = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
      const iss = a.matChave("Trib", "ISS"), iptu = a.matChave("Trib", "IPTU"), pri = a.matChave("Const", "Princípios");
      a.matGravarCartoes(iss, [
        "Fato gerador? :: Serviço :: x", "",
        "Alíquota máxima? :: " + RICO + " :: x", "+ Literalidade — Art. 8º-A"].join("\n"), { disciplina: "Trib", topico: "ISS" });
      a.matGravarCartoes(iptu, "Quem paga o IPTU? :: O proprietário :: y", { disciplina: "Trib", topico: "IPTU" });
      a.matGravarCartoes(pri, "O prazo é de {{c1::30 dias}} (art. 5º) :: z\n+ Literalidade — Art. 5º, LXXVIII", { disciplina: "Const", topico: "Princípios" });
      return a;
    };
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const a = montarG23();
    a.gerAbrir();
    /* Trib/ISS: "Fato gerador?" fraco (curto, sem saiba mais) + "Alíquota?" bom = 1 fraco; Trib/IPTU: 1 fraco;
     * Const/Princípios: 1 cloze, bom (tem saiba mais e citacao) — nao entra em fracos */
    ok(a.$("btnGerMarcarFracos").hidden === false && /marcar fracos \(2\)/.test(a.$("btnGerMarcarFracos").textContent), "G23a o botao mostra a CONTAGEM certa de fracos na lista de agora: " + a.$("btnGerMarcarFracos").textContent);
    ok(a.$("btnGerMarcarLacunas").hidden === false && /marcar lacunas \(1\)/.test(a.$("btnGerMarcarLacunas").textContent), "G23b e a de lacunas: " + a.$("btnGerMarcarLacunas").textContent);
    a.$("btnGerMarcarFracos").onclick();
    const fracosMarcados = Array.from(a.gerSelAtual()).map((pos) => a.gerNotasAtual()[a.gerVisAtual()[pos]].card);
    ok(a.gerSelAtual().size === 2 && fracosMarcados.every((c) => a.ceAbaixo(c)) && fracosMarcados.every((c) => c.kind !== "cloze"), "G23c clicar marca exatamente os fracos, nada mais: " + fracosMarcados.map((c) => c.front));
    a.$("btnGerMarcarLacunas").onclick();
    const lacunasMarcadas = Array.from(a.gerSelAtual()).map((pos) => a.gerNotasAtual()[a.gerVisAtual()[pos]].card);
    ok(a.gerSelAtual().size === 1 && lacunasMarcadas.every((c) => c.kind === "cloze"), "G23d e clicar em lacunas troca a marcacao para so' as lacunas: " + lacunasMarcadas.map((c) => c.kind));
    /* dentro da pasta IPTU (so' 1 fraco, nenhuma lacuna): so' o botao de fracos aparece */
    const topoIptu = linhas(a, "ger-top").find((e) => /IPTU/.test(e.textContent));
    topoIptu.onclick();
    ok(a.$("btnGerMarcarFracos").hidden === false && /\(1\)/.test(a.$("btnGerMarcarFracos").textContent) && a.$("btnGerMarcarLacunas").hidden === true, "G23e dentro da pasta IPTU: so' o botao de fracos aparece, com a conta certa: " + a.$("btnGerMarcarFracos").textContent);

    /* abrir a pasta clicando no NOME tambem revela o que tem dentro — antes so' a setinha fazia isso */
    a.gerFechadosAtual().add("Trib"); a.gerPintar();
    ok(!linhas(a, "ger-top").some((e) => /ISS|IPTU/.test(e.textContent)), "G23f com 'Trib' fechada, ISS e IPTU nao aparecem");
    const discTrib = linhas(a, "ger-disc").find((e) => /Trib/.test(e.textContent));
    discTrib.onclick();
    ok(a.gerFechadosAtual().has("Trib") === false && linhas(a, "ger-top").some((e) => /ISS/.test(e.textContent)) && linhas(a, "ger-top").some((e) => /IPTU/.test(e.textContent)), "G23g clicar no NOME da disciplina fechada seleciona E ABRE, sem precisar mirar na seta");
    /* clicar de novo (ja aberta) nao fecha por engano — so' a seta fecha */
    const discTrib2 = linhas(a, "ger-disc").find((e) => /Trib/.test(e.textContent));
    discTrib2.onclick();
    ok(a.gerFechadosAtual().has("Trib") === false, "G23h clicar no nome de novo NAO fecha (so' a seta fecha, de proposito)");

    /* pasta vazia ganha o botao "Criar cartões", que aponta a bancada para ela */
    a.gerCriarPasta("Revisão", "Pegadinhas");
    a.$("dlgGerCartoes").close(); a.gerAbrir();
    const vazia = achar(a.$("gerArvore"), (e) => cls(e, "ger-top")).find((e) => /Pegadinhas/.test(e.textContent));
    vazia.onclick();
    const criar = achar(a.$("gerLista"), (e) => e.tag === "button").find((e) => /Criar cartões/.test(e.textContent));
    ok(!!criar, "G23i a pasta vazia mostra um botao para criar cartões nela");
    if (criar) criar.onclick();
    ok(!!criar && a.$("dlgGerCartoes").open === false && a.bancAlvoAtual() && a.bancAlvoAtual().disciplina === "Revisão" && a.bancAlvoAtual().topico === "Pegadinhas", "G23j clicar aponta a bancada para ESTA pasta (disciplina e topico certos): " + (criar ? JSON.stringify(a.bancAlvoAtual()) : "sem botao"));
  }

  /* ---- G24: modo "Montar pacote" dentro da Biblioteca (B1) — alternar de modo e marcar pastas
   * para exportar, sem mexer em marcação real nem em nenhuma ação que grava (pedido do usuario,
   * 2026-09-30: reaproveitar a arvore/lista da Biblioteca em vez de duplicar em pacote.js) ---- */
  {
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const { a, iss, iptu, pri } = montar();
    a.gerAbrir();
    /* comeca em modo "gerenciar" */
    {
      ok(a.gerModoAtual() === "gerenciar", "G24a comeca em modo gerenciar");
      ok(a.$("btnGerModoGerenciar").getAttribute("aria-selected") === "true" && a.$("btnGerModoExportar").getAttribute("aria-selected") === "false", "G24b as abas de modo refletem o estado inicial");
      ok(linhas(a, "ger-top").every((e) => !achar(e, (x) => x.tag === "input").length), "G24c em modo gerenciar, os topicos da arvore NAO tem caixa de marcar (marcar e' so' na lista, cartao a cartao)");
    }
    /* trocar para modo exportar */
    {
      a.$("btnGerModoExportar").onclick();
      ok(a.gerModoAtual() === "exportar", "G24d trocar de modo funciona pelo botao");
      ok(a.$("btnGerModoGerenciar").getAttribute("aria-selected") === "false" && a.$("btnGerModoExportar").getAttribute("aria-selected") === "true", "G24e as abas acompanham a troca");
      ok(a.gerSelExportAtual().size === 0, "G24f comeca sem nada marcado para exportar");
    }
    /* em modo exportar, cada topico da arvore ganha uma caixa; marcar NAO mexe em gerSel (marcacao real) */
    {
      const topoIss = linhas(a, "ger-top").find((e) => /ISS \(/.test(e.textContent));
      const ckIss = achar(topoIss, (x) => x.tag === "input")[0];
      ok(!!ckIss && ckIss.checked === false, "G24g o topico ISS tem uma caixa, comeca desmarcada");
      ckIss.checked = true; ckIss.onchange();
      ok(a.gerSelExportAtual().has(iss), "G24h marcar a caixa do topico adiciona a chave dele em gerSelExport");
      ok(a.gerSelAtual().size === 0, "G24i marcar para exportar NAO mexe na marcacao real (gerSel)");
      ok(a.$("gerAcoes").hidden === true, "G24j a barra de acoes reais (mover/apagar/melhorar) continua escondida");
      /* garantia extra: mesmo que gerSel (marcacao REAL) fique preenchido por algum outro caminho
       * enquanto ja' se esta' em modo exportar, a barra de acoes reais NUNCA pode aparecer */
      a.gerSelTeste([0, 1]);
      a.gerPintar();
      ok(a.$("gerAcoes").hidden === true && a.$("btnGerMover").disabled === true, "G24j2 mesmo com gerSel preenchido 'por fora', em modo exportar a barra de acoes reais fica escondida e desligada");
      a.gerSelTeste([]);
      a.gerPintar();
    }
    /* marcar a DISCIPLINA inteira marca todos os topicos dela; estado indeterminado quando so' um esta' marcado */
    {
      const discTrib = linhas(a, "ger-disc").find((e) => /Trib \(/.test(e.textContent));
      const ckDisc = achar(discTrib, (x) => x.tag === "input")[0];
      ok(!!ckDisc && ckDisc.indeterminate === true && ckDisc.checked === false, "G24k com so' ISS marcado, a caixa da disciplina Trib fica indeterminada: " + JSON.stringify({ i: ckDisc.indeterminate, c: ckDisc.checked }));
      ckDisc.checked = true; ckDisc.onchange();
      ok(a.gerSelExportAtual().has(iss) && a.gerSelExportAtual().has(iptu), "G24l marcar a disciplina marca TODOS os topicos dela (ISS e IPTU)");
      const discTrib2 = linhas(a, "ger-disc").find((e) => /Trib \(/.test(e.textContent));
      const ckDisc2 = achar(discTrib2, (x) => x.tag === "input")[0];
      ok(ckDisc2.checked === true && ckDisc2.indeterminate === false, "G24m com os dois marcados, a caixa da disciplina fica cheia (nao indeterminada)");
      ckDisc2.checked = false; ckDisc2.onchange();
      ok(!a.gerSelExportAtual().has(iss) && !a.gerSelExportAtual().has(iptu), "G24n desmarcar a disciplina desmarca os dois topicos dela");
    }
    /* a barra de marcar/limpar/marcar todos etc. (do modo gerenciar) some em modo exportar */
    {
      ok(a.$("btnGerMarcar").hidden === true && a.$("btnGerLimpar").hidden === true && a.$("btnGerMarcarTodos").hidden === true && a.$("btnGerFerrMais").hidden === true, "G24o a barra de ferramentas do modo gerenciar fica escondida em modo exportar");
      ok(a.$("btnGerEstudar").hidden === true, "G24p o botao de estudar tambem some em modo exportar");
    }
    /* a lista de cartoes (coluna do meio) vira so' visualizacao: sem caixa, sem arrastar */
    {
      const topoIss = linhas(a, "ger-top").find((e) => /ISS \(/.test(e.textContent));
      topoIss.onclick();
      const itensLista = achar(a.$("gerLista"), (e) => cls(e, "ger-item"));
      ok(itensLista.length > 0 && itensLista.every((e) => !achar(e, (x) => x.tag === "input").length && e.draggable !== true), "G24q em modo exportar, a lista de cartoes nao tem caixa nem arrastar (so' ver o conteudo)");
    }
    /* editar/apagar (coluna da previa) ficam desligados em modo exportar, mesmo com um cartao em foco */
    {
      a.gerFocoTeste(0);
      a.gerPintar();
      ok(a.$("btnGerEditar").disabled === true && a.$("btnGerPreApagar").disabled === true, "G24r editar/apagar desligados em modo exportar mesmo com foco num cartao");
    }
    /* trocar de volta para "gerenciar" esquece a marcacao de exportar */
    {
      a.$("btnGerModoGerenciar").onclick();
      ok(a.gerModoAtual() === "gerenciar" && a.gerSelExportAtual().size === 0, "G24s voltar para gerenciar esquece o que estava marcado para exportar");
      ok(linhas(a, "ger-top").every((e) => !achar(e, (x) => x.tag === "input").length), "G24t as caixas de exportar somem da arvore ao voltar para gerenciar");
    }
    /* trocar de modo tambem esquece a marcacao REAL (gerSel), nos dois sentidos */
    {
      a.gerSelTeste([0, 1]);
      a.$("btnGerModoExportar").onclick();
      ok(a.gerSelAtual().size === 0, "G24u trocar pra exportar esquece a marcacao real (gerSel)");
      const topoPri = linhas(a, "ger-top").find((e) => /Princípios \(/.test(e.textContent));
      const ckPri = achar(topoPri, (x) => x.tag === "input")[0];
      ckPri.checked = true; ckPri.onchange();
      a.$("btnGerModoExportar").onclick(); /* clicar no MESMO modo de novo: no-op, nao reseta */
      ok(a.gerSelExportAtual().has(pri), "G24v clicar no modo que ja' esta' ativo nao reseta a marcacao (no-op)");
      a.$("btnGerModoGerenciar").onclick();
      ok(a.gerSelExportAtual().size === 0, "G24w trocar pra gerenciar esquece a marcacao de exportar");
    }
    /* reabrir o gerenciador comeca sempre em modo gerenciar, sem nada marcado para exportar */
    {
      a.$("btnGerModoExportar").onclick();
      const topoIss = linhas(a, "ger-top").find((e) => /ISS \(/.test(e.textContent));
      achar(topoIss, (x) => x.tag === "input")[0].checked = true;
      achar(topoIss, (x) => x.tag === "input")[0].onchange();
      a.$("dlgGerCartoes").close();
      a.gerAbrir();
      ok(a.gerModoAtual() === "gerenciar" && a.gerSelExportAtual().size === 0, "G24x reabrir a Biblioteca sempre comeca em modo gerenciar, sem marcacao de exportar sobrando");
      ok(a.$("btnGerModoGerenciar").getAttribute("aria-selected") === "true" && a.$("btnGerModoExportar").getAttribute("aria-selected") === "false", "G24y as abas tambem voltam ao estado inicial ao reabrir");
    }
  }

  /* ---- G25: arrastar em modo exportação é export-scoped (B2) — nunca move de verdade;
   * compara DESTINO, não chave, nos alvos; badge "movido" + desfazer por pasta e geral ---- */
  {
    const fakeEv = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { effectAllowed: "", setData() {}, setDragImage() {}, dropEffect: "" } });
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const acharTop = (a, nome) => linhas(a, "ger-top").find((e) => new RegExp("^" + nome + " \\(").test(e.textContent.trim()));
    const { a, iss, iptu, pri } = montar();
    a.gerAbrir();
    a.gerAlternarModo("exportar");
    const origCartoesIss = a.matResumosAtual()[iss].cartoes;
    /* toda linha de topico e' arrastavel em modo exportar; o topico tem ondragover/ondrop proprios */
    {
      const topoIss = acharTop(a, "ISS");
      ok(topoIss.draggable === true && typeof topoIss.ondragstart === "function" && typeof topoIss.ondrop === "function", "G25a em modo exportar, o topico continua arrastavel");
    }
    /* arrastar ISS e soltar sobre IPTU: so' o pacote reorganiza, a Biblioteca NAO muda */
    {
      const topoIss = acharTop(a, "ISS");
      topoIss.ondragstart(fakeEv());
      ok(a.gerArrastoExportAtual() && a.gerArrastoExportAtual().chave === iss, "G25b o arrasto export-scoped guarda a chave do topico de origem");
      const topoIptu = acharTop(a, "IPTU");
      const eo = fakeEv(); topoIptu.ondragover(eo);
      ok(eo.prevented === true && cls(topoIptu, "ger-alvo"), "G25c sobre outro topico: alvo valido, mesmo destaque verde do arrastar real (.ger-alvo)");
      topoIptu.ondrop(fakeEv());
      ok(a.gerArrastoExportAtual() === null, "G25d soltar limpa o arrasto export-scoped");
      const mov = a.gerMoverParaExportAtual().get(iss);
      ok(mov && mov.disciplina === "Trib" && mov.topico === "IPTU" && mov.edital === "", "G25e ISS passa a ir para o baralho de IPTU (so' no pacote): " + JSON.stringify(mov));
      ok(a.matResumosAtual()[iss].cartoes === origCartoesIss, "G25f a Biblioteca NAO mudou (nenhum cartao foi movido de verdade)");
      ok(!a.gerTemRecibo(), "G25g nenhum recibo de mover real foi criado");
    }
    /* a linha de ISS mostra o caminho novo (badge) e um botao de desfazer so' para ela */
    {
      const topoIss2 = acharTop(a, "ISS");
      const caminho = achar(topoIss2, (e) => cls(e, "pac-caminho-movido"))[0];
      ok(!!caminho && /IPTU$/.test(caminho.textContent.trim()), "G25h o caminho mostrado termina em IPTU: " + (caminho && caminho.textContent));
      const des = achar(topoIss2, (e) => cls(e, "pac-desfazer-mov"))[0];
      ok(!!des, "G25i aparece 'desfazer' na linha de ISS");
      const topoPri = acharTop(a, "Princípios");
      ok(achar(topoPri, (e) => cls(e, "pac-caminho-movido")).length === 0, "G25j o topico Principios (nao mexido) nao tem badge nenhum");
    }
    /* desfazer so' este */
    {
      const topoIss = acharTop(a, "ISS");
      const des = achar(topoIss, (e) => cls(e, "pac-desfazer-mov"))[0];
      des.onclick({ preventDefault() {}, stopPropagation() {} });
      ok(!a.gerMoverParaExportAtual().has(iss), "G25k 'desfazer' tira so' o arrasto deste topico");
    }
    /* soltar sobre a PROPRIA pasta e' invalido/no-op */
    {
      const topoIss = acharTop(a, "ISS");
      topoIss.ondragstart(fakeEv());
      const topoIss2 = acharTop(a, "ISS");
      const eo = fakeEv(); topoIss2.ondragover(eo);
      ok(eo.prevented === false && cls(topoIss2, "ger-alvo-no"), "G25l sobre a PROPRIA pasta: invalido");
      topoIss2.ondrop(fakeEv());
      ok(!a.gerMoverParaExportAtual().has(iss), "G25m soltar na propria pasta nao cria arrasto nenhum");
    }
    /* arrastar ISS e soltar na disciplina "Const": muda so' a disciplina, mantem o proprio nome */
    {
      const topoIss = acharTop(a, "ISS");
      topoIss.ondragstart(fakeEv());
      const discConst = linhas(a, "ger-disc").find((e) => /Const \(/.test(e.textContent));
      discConst.ondrop(fakeEv());
      const mov = a.gerMoverParaExportAtual().get(iss);
      ok(mov && mov.disciplina === "Const" && mov.topico === "ISS", "G25n soltar na disciplina muda so' a disciplina: " + JSON.stringify(mov));
    }
    /* "desfazer movimentos" (geral) aparece e limpa tudo */
    {
      ok(a.$("btnGerDesfazerExport").hidden === false, "G25o com arrasto pendente, 'desfazer movimentos' aparece");
      a.$("btnGerDesfazerExport").onclick();
      ok(a.gerMoverParaExportAtual().size === 0 && a.$("btnGerDesfazerExport").hidden === true, "G25p desfaz TODOS os arrastos e volta a esconder o botao");
    }
    /* trocar de modo e reabrir esquecem os arrastos export-scoped */
    {
      const topoIss = acharTop(a, "ISS");
      topoIss.ondragstart(fakeEv());
      const topoIptu = acharTop(a, "IPTU");
      topoIptu.ondrop(fakeEv());
      ok(a.gerMoverParaExportAtual().size === 1, "G25q (confirma: ha' um arrasto, para o teste valer)");
      a.gerAlternarModo("gerenciar");
      ok(a.gerMoverParaExportAtual().size === 0, "G25r trocar para gerenciar esquece os arrastos export-scoped");
      a.gerAlternarModo("exportar");
      const topoIss2 = acharTop(a, "ISS");
      topoIss2.ondragstart(fakeEv());
      const topoIptu2 = acharTop(a, "IPTU");
      topoIptu2.ondrop(fakeEv());
      ok(a.gerMoverParaExportAtual().size === 1, "G25s (confirma de novo, apos criar outro arrasto)");
      a.$("dlgGerCartoes").close();
      a.gerAbrir();
      ok(a.gerMoverParaExportAtual().size === 0, "G25t reabrir a Biblioteca esquece os arrastos export-scoped tambem");
    }
    /* em modo GERENCIAR (fora do escopo da B2), arrastar continua sendo um mover de VERDADE */
    {
      const { a: a2, iss: iss2, iptu: iptu2 } = montar();
      a2.gerAbrir();
      const topoIss = acharTop(a2, "ISS");
      topoIss.ondragstart(fakeEv());
      const topoIptu = acharTop(a2, "IPTU");
      ok(a2.gerArrastoExportAtual() === null, "G25u em modo gerenciar nao existe arrasto export-scoped (usa o gerArrasto real, ja' testado em G16-G19)");
      topoIss.ondragend();
    }
  }

  /* ---- G26: painel de exportar + exportar de verdade (B3) — o MOTOR e' o mesmo de pacote.js
   * (pacMontar/pacCartoes/pacNomeArquivo), so' a tela muda de dono; "sem baralho raiz" (F0)
   * embutida aqui mesmo, como o plano pediu ---- */
  {
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const marcar = (a, nome) => { const top = linhas(a, "ger-top").find((e) => new RegExp("^" + nome + " \\(").test(e.textContent.trim())); const ck = achar(top, (x) => x.tag === "input")[0]; ck.checked = true; ck.onchange(); return top; };
    const deps = (cap) => ({ construir: async (cards, raiz, est, tit, al, extras) => { cap.cards = cards; cap.raiz = raiz; cap.extras = extras; return new Uint8Array([9]); }, entregar: async (b, nome, mime) => { cap.nome = nome; cap.mime = mime; cap.n = b.length; } });

    /* a coluna troca de conteudo por modo */
    {
      const { a } = montar();
      a.gerAbrir();
      ok(a.$("gerExpCx").hidden === true && a.$("gerPrevia").hidden === false, "G26a em modo gerenciar, o painel de exportar fica escondido e a previa normal aparece");
      a.$("btnGerModoExportar").onclick();
      ok(a.$("gerExpCx").hidden === false && a.$("gerPrevia").hidden === true, "G26b em modo exportar, o painel de exportar aparece no lugar da previa do cartao");
      ok(a.$("btnGerExpApkg").disabled === true && a.$("btnGerExpTxt").disabled === true, "G26c sem nada marcado, os dois botoes de exportar comecam desligados");
    }
    /* marcar atualiza a previa (resumo + baralhos) e liga os botoes */
    {
      const { a, iss } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      a.$("gerExpNome").value = "EasyAnkiCards"; a.$("gerExpNome").oninput();
      marcar(a, "ISS");
      ok(a.$("btnGerExpApkg").disabled === false && a.$("btnGerExpTxt").disabled === false, "G26d marcar uma pasta liga os dois botoes");
      /* ISS tem 3 cartoes, 2 deles parecidos o bastante pro radar de repeticao agrupar; "sem repetidos" comeca ligada */
      ok(/2 notas em 1 baralhos/.test(a.$("gerExpResumo").textContent), "G26e o resumo conta notas e baralhos (com 'sem repetidos' ligado): " + a.$("gerExpResumo").textContent);
      ok(/EasyAnkiCards › Trib › ISS/.test(a.$("gerExpDecks").textContent), "G26f a lista de baralhos mostra a raiz (nome digitado) + o caminho: " + a.$("gerExpDecks").textContent);
    }
    /* F0: "sem baralho raiz" tira o prefixo da PREVIA e do ARQUIVO de verdade */
    {
      const { a, iss } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      a.$("gerExpNome").value = "EasyAnkiCards"; a.$("gerExpNome").oninput();
      marcar(a, "ISS");
      ok(a.$("gerExpSemRaiz").checked === false, "G26g 'sem baralho raiz' comeca desligada (preserva o comportamento de sempre)");
      a.$("gerExpSemRaiz").checked = true; a.$("gerExpSemRaiz").onchange();
      ok(/^Trib › ISS/.test(a.$("gerExpDecks").textContent.trim()), "G26h ligada, a previa NAO mostra mais a raiz na frente: " + a.$("gerExpDecks").textContent);
      const cap = {};
      const r = await a.gerAcaoExportar("apkg", deps(cap));
      ok(r.ok === true && cap.raiz === "" && cap.cards.every((c) => c.deck === "Trib::ISS"), "G26i o .apkg de verdade sai sem a raiz (deckName vazio para o buildApkg): " + JSON.stringify({ raiz: cap.raiz, decks: cap.cards.map((c) => c.deck) }));
      ok(cap.nome === "EasyAnkiCards.apkg", "G26j o NOME DO ARQUIVO continua vindo do campo digitado, mesmo sem baralho raiz: " + cap.nome);
    }
    /* sem a caixa ligada, o .apkg sai com a raiz (comportamento de sempre) */
    {
      const { a, iss } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      marcar(a, "ISS");
      a.$("gerExpNome").value = "Meu Pacote"; a.$("gerExpNome").oninput();
      const cap = {};
      await a.gerAcaoExportar("apkg", deps(cap));
      ok(cap.raiz === "Meu Pacote" && cap.nome === "Meu Pacote.apkg", "G26k sem F0, o .apkg leva a raiz digitada, no baralho e no nome do arquivo: " + JSON.stringify({ raiz: cap.raiz, nome: cap.nome }));
    }
    /* .txt tambem funciona, e nada e' exportado sem nenhuma pasta marcada */
    {
      const { a } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      a.$("gerExpNome").value = "EasyAnkiCards"; a.$("gerExpNome").oninput();
      const cap = {};
      ok((await a.gerAcaoExportar("txt", deps(cap))).ok === false, "G26l sem pasta marcada, exportar (txt ou apkg) nao faz nada");
      marcar(a, "IPTU");
      const r = await a.gerAcaoExportar("txt", deps(cap));
      ok(r.ok === true && cap.mime === "text/plain" && cap.nome === "EasyAnkiCards.txt", "G26m o .txt tambem funciona, com o mime e o nome certos: " + JSON.stringify({ mime: cap.mime, nome: cap.nome }));
    }
    /* arrastar (B2) muda o baralho exportado de verdade — o motor usa gerMoverParaExport */
    {
      const fakeEv = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { effectAllowed: "", setData() {}, setDragImage() {}, dropEffect: "" } });
      const acharTop = (a, nome) => linhas(a, "ger-top").find((e) => new RegExp("^" + nome + " \\(").test(e.textContent.trim()));
      const { a, iss } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      marcar(a, "ISS");
      const topoIss = acharTop(a, "ISS");
      topoIss.ondragstart(fakeEv());
      acharTop(a, "IPTU").ondrop(fakeEv());
      const cap = {};
      await a.gerAcaoExportar("apkg", deps(cap));
      ok(cap.cards.length > 0 && cap.cards.every((c) => c.deck === "Trib::IPTU"), "G26n o arrasto export-scoped (B2) vale na exportacao de verdade (baralho, sem a raiz): " + JSON.stringify(cap.cards.map((c) => c.deck)));
    }
    /* "pasta do edital": o baralho ganha o edital na frente, resolvido pelo DONO do topico
     * (matResumos[chave].concurso) — gerSelExport nao guarda sob qual raiz foi marcado */
    {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5");
      const issK = a.matChave("Sistema Tributário Brasileiro", "ISS");
      a.matGravarCartoes(issK, "Pergunta? :: Resposta :: x", { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.gerAbrir();
      a.$("btnGerModoExportar").onclick();
      ok(a.$("gerExpOpcEdital").hidden === false && a.$("gerExpComEdital").checked === true, "G26p com edital cadastrado, 'pasta do edital' aparece e comeca ligada");
      /* arvore por edital comeca com as disciplinas FECHADAS (G19h) — abrir "Sistema Tributário..." antes de marcar */
      const discLinha = linhas(a, "ger-disc").find((e) => /Sistema Tributário/.test(e.textContent));
      achar(discLinha, (x) => cls(x, "ger-seta"))[0].onclick({ stopPropagation() {} });
      marcar(a, "ISS");
      const cap = {};
      await a.gerAcaoExportar("apkg", deps(cap));
      ok(cap.cards[0].deck === "ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS", "G26q com 'pasta do edital' ligada, o edital dono entra na frente do baralho: " + cap.cards[0].deck);
      a.$("gerExpComEdital").checked = false; a.$("gerExpComEdital").onchange();
      const cap2 = {};
      await a.gerAcaoExportar("apkg", deps(cap2));
      ok(cap2.cards[0].deck === "Sistema Tributário Brasileiro::ISS", "G26r desligada, volta a Disciplina::Topico sem o edital: " + cap2.cards[0].deck);
    }
    /* reabrir esquece as opcoes do painel (volta ao padrao) */
    {
      const { a } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      a.$("gerExpSemRaiz").checked = true; a.$("gerExpSemRaiz").onchange();
      a.$("dlgGerCartoes").close();
      a.gerAbrir();
      ok(a.$("gerExpSemRaiz").checked === false, "G26s reabrir a Biblioteca esquece 'sem baralho raiz' (volta a desligada)");
    }
    /* erro do construtor aparece na mensagem do painel (nao trava nada) */
    {
      const { a } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      marcar(a, "ISS");
      const r = await a.gerAcaoExportar("apkg", { construir: async () => { throw new Error("sql.js caiu"); }, entregar: async () => {} });
      ok(r.ok === false && /sql\.js caiu/.test(a.$("gerExpMsg").textContent), "G26t erro do construtor aparece na mensagem do painel: " + a.$("gerExpMsg").textContent);
    }
  }

  /* ---- G27: prévia de estilo + copiar caminho no painel de exportar (U1) — reaproveita
   * previewEstilo/aplicarEstilo/PALETAS de app.js (generalizadas por "alvo" em vez de duplicadas);
   * o aviso de título (#avisoTopo/etc.) é só da U2, ainda não existe aqui ---- */
  {
    const { a } = montar();
    a.gerAbrir();
    /* abre com o estilo que ja' estava escolhido (sincronizado com a barra lateral) */
    a.aplicarEstilo("dark");
    a.$("dlgGerCartoes").close(); a.gerAbrir();
    ok(a.$("gerExpEstilo").value === "dark", "G27a o seletor de estilo do painel abre com o estilo atual (sincronizado com a barra lateral)");
    a.$("btnGerModoExportar").onclick();
    ok(a.$("gerExpStylePreview").children.length > 0 && a.$("gerExpStyleHintTxt").textContent.length > 20, "G27b a previa de estilo desenha algo e tem a dica, assim que entra no modo exportar");
    /* trocar o estilo NO PAINEL atualiza a previa e sincroniza o seletor da barra lateral */
    a.$("gerExpEstilo").value = "paper"; a.$("gerExpEstilo").onchange();
    ok(a.$("selEstiloPainel").value === "paper" && a.lojaLer("eac_style") === "paper", "G27c trocar o estilo no painel sincroniza o seletor da barra lateral e fica salvo (um so' estilo em todo o app)");
    ok(a.$("gerExpStylePreview").style.background === a.PALETAS.paper.fundo, "G27d a previa do painel novo mostra a cor do estilo escolhido: " + a.$("gerExpStylePreview").style.background);
    /* o inverso tambem funciona: trocar na barra lateral atualiza o painel novo */
    a.$("selEstiloPainel").value = "dark"; a.aplicarEstilo("dark");
    ok(a.$("gerExpEstilo").value === "dark" && a.$("gerExpStylePreview").style.background === a.PALETAS.dark.fundo, "G27e trocar na barra lateral tambem atualiza o painel novo (sincronia nos dois sentidos)");
    /* previewEstilo(alvo) redesenha a previa E o aviso do cabecalho (o estilo atual, "dark", tem cabecalho) */
    a.$("gerExpAvisoTopoTitulo").textContent = "";
    a.previewEstilo(a.GER_EXP_ALVO_ESTILO);
    ok(a.$("gerExpStylePreview").children.length > 0 && a.$("gerExpAvisoTopoTitulo").textContent === a.t("header_warn_title"), "G27f previewEstilo(alvo) redesenha a previa e o aviso de titulo: " + JSON.stringify(a.$("gerExpAvisoTopoTitulo").textContent));
    /* desde a U2 o alvo do painel novo declara tambem o aviso de titulo (G28) */
    ok(a.GER_EXP_ALVO_ESTILO.aviso === "gerExpAvisoTopo", "G27g o alvo do painel novo declara o aviso de titulo");
    /* copiar caminho */
    a.$("gerExpNome").value = "Minha Raiz"; a.$("gerExpNome").oninput();
    await a.$("btnGerExpCopiarCaminho").onclick();
    ok((await a.navegador.clipboard.readText()) === "Minha Raiz", "G27h copiar caminho copia o nome do baralho raiz atual: " + (await a.navegador.clipboard.readText()));
    /* o "Copiado!" e' so' um flash de 2s (setTimeout) — neste ambiente de teste os timers
     * disparam na hora (ver memoria do projeto), entao o que da' pra conferir aqui e' que o
     * botao VOLTA ao rotulo normal depois (o mesmo texto do copiar caminho de #dlgExport) */
    ok(a.$("btnGerExpCopiarCaminho").textContent === a.t("copy_path_btn"), "G27i o botao volta ao rotulo normal depois do flash de 'copiado'");
  }

  /* ---- G28: aviso de título no painel de exportar (U2) — o mesmo aviso/prévia do cabeçalho do
   * #dlgExport (atualizarAvisoTopo generalizada por "alvo"), com o campo de título sincronizado
   * com a barra lateral e com o #dlgExport (uma fonte só: eac_titulo) ---- */
  {
    const demoPill = (a) => { const d = a.$("gerExpAvisoTopoDemo").children[0]; return d ? d.textContent : null; };
    const { a } = montar();
    a.aplicarEstilo("dark");
    a.setTituloGeral("Direito Tributário");
    a.gerAbrir();
    ok(a.$("gerExpTitulo").value === "Direito Tributário", "G28a o campo de titulo do painel abre com o titulo geral ja' salvo");
    a.$("btnGerModoExportar").onclick();
    ok(a.$("gerExpAvisoTopoTitulo").textContent === a.t("header_warn_title") && a.$("gerExpAvisoTopoTexto").textContent === a.t("header_warn_text"), "G28b o aviso do que sera' impresso no topo aparece no painel (estilo com cabecalho)");
    ok(demoPill(a) === "Direito Tributário", "G28c a previa do cabecalho mostra o titulo atual: " + demoPill(a));
    /* digitar NO PAINEL sincroniza barra lateral, #dlgExport e a fonte unica, e redesenha aviso e previa */
    a.$("gerExpTitulo").value = "Penal"; a.$("gerExpTitulo").oninput();
    ok(a.$("tituloGeral").value === "Penal" && a.tituloGeral() === "Penal", "G28d digitar no painel atualiza o campo da barra lateral e o valor salvo");
    ok(demoPill(a) === "Penal" && a.$("gerExpStylePreview").children[0].textContent === "Penal", "G28e a previa do cabecalho E a previa do estilo acompanham o que se digita");
    /* o inverso: digitar na barra lateral atualiza o campo do painel */
    a.$("tituloGeral").value = "Civil"; a.$("tituloGeral").oninput();
    ok(a.$("gerExpTitulo").value === "Civil" && demoPill(a) === "Civil", "G28f digitar na barra lateral tambem atualiza o painel (nos dois sentidos)");
    /* sem titulo: o aviso diz que esta' sem nome */
    a.$("gerExpTitulo").value = ""; a.$("gerExpTitulo").oninput();
    ok(demoPill(a) === a.t("header_empty"), "G28g sem titulo a previa mostra '(sem nome)': " + demoPill(a));
    /* "Usar o nome do baralho": a ultima parte do nome raiz */
    a.$("gerExpNome").value = "Curso :: Materia :: Tema"; a.$("gerExpNome").oninput();
    a.$("btnGerExpTituloDeck").onclick();
    ok(a.$("gerExpTitulo").value === "Tema" && a.tituloGeral() === "Tema" && demoPill(a) === "Tema", "G28h 'usar o nome do baralho' poe a ultima parte (depois do ultimo '::') como titulo: " + a.$("gerExpTitulo").value);
    a.$("gerExpNome").value = "Sem Niveis"; a.$("gerExpNome").oninput();
    a.$("btnGerExpTituloDeck").onclick();
    ok(a.$("gerExpTitulo").value === "Sem Niveis", "G28i nome de um nivel so': o titulo e' o proprio nome");
    /* trocar o estilo redesenha o aviso com a cor do cabecalho do novo estilo */
    a.$("gerExpEstilo").value = "paper"; a.$("gerExpEstilo").onchange();
    ok(String(a.$("gerExpAvisoTopoDemo").children[0].style.cssText).indexOf(a.PALETAS.paper.cab) >= 0, "G28j trocar o estilo redesenha o aviso com a cor do cabecalho do estilo escolhido");
    /* reabrir comeca do titulo salvo (nao do que ficou digitado e nao salvo — tudo ja' e' salvo ao digitar) */
    a.$("dlgGerCartoes").close(); a.setTituloGeral("Salvo"); a.$("gerExpTitulo").value = "campo velho"; a.gerAbrir();
    ok(a.$("gerExpTitulo").value === "Salvo", "G28k reabrir traz o titulo salvo");
  }

  /* ---- G29: aviso de cartão suspeito antes de exportar (U3) — os `.issues` do parser, só dos
   * cartões que de fato entram no pacote; cancelar não gera nada ---- */
  {
    const bom = "Outra pergunta boa? :: Uma resposta decente aqui";
    const fix = (ruins, rico) => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
      const linhas = [];
      for (let i = 0; i < ruins; i++) linhas.push("Pergunta ruim numero " + i + " sobre assunto " + String.fromCharCode(97 + i) + String.fromCharCode(110 + i) + "? :: x", "");
      linhas.push(bom);
      if (rico) linhas.push("", "Qual a aliquota maxima do ISS cobrada pelos municipios? :: " + RICO + " :: x", "+ Literalidade — Art. 8º-A");
      const ch = a.matChave("D", "T");
      a.matGravarCartoes(ch, linhas.join("\n"), { disciplina: "D", topico: "T" });
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      a.gerMarcarExport(ch, true);
      a.$("gerExpSemRep").checked = false; a.$("gerExpComEdital").checked = false;
      a.gerPintar();
      return { a, ch };
    };
    const espiao = (resposta) => { const c = { chamadas: [], cons: [], ent: 0 }; c.deps = { construir: async (cards) => { c.cons.push(cards.length); return new Uint8Array(1); }, entregar: async () => { c.ent++; }, confirmar: async (msg) => { c.chamadas.push(msg); return resposta; } }; return c; };

    /* sem cartao suspeito: nem pergunta */
    {
      const { a } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      const ch = a.matChave("Trib", "IPTU"); a.gerMarcarExport(ch, true); a.gerPintar();
      const e = espiao(false);
      const r = await a.gerAcaoExportar("apkg", e.deps);
      ok(r.ok === true && e.chamadas.length === 0 && e.cons.length === 1, "G29a pacote sem cartao suspeito exporta direto, sem perguntar");
    }
    /* com suspeito: pergunta, mostra onde e o que; recusar nao gera nada */
    {
      const { a } = fix(2);
      const e = espiao(false);
      const r = await a.gerAcaoExportar("apkg", e.deps);
      ok(e.chamadas.length === 1 && /2 cartão/.test(e.chamadas[0]) && /D › T, linha 1: verso vazio/.test(e.chamadas[0]), "G29b com cartao suspeito pergunta antes, dizendo a pasta, a linha e o aviso: " + e.chamadas[0]);
      ok(r.ok === false && r.cancelado === true && e.cons.length === 0 && e.ent === 0, "G29c recusar NAO gera arquivo nenhum");
      ok(a.$("gerExpMsg").textContent === a.t("ger_exp_cancelado"), "G29d e a tela diz que cancelou: " + a.$("gerExpMsg").textContent);
      const e2 = espiao(true);
      const r2 = await a.gerAcaoExportar("apkg", e2.deps);
      ok(r2.ok === true && e2.cons[0] === 3 && e2.ent === 1, "G29e confirmar exporta TODOS os cartoes (inclusive os suspeitos): " + JSON.stringify(e2.cons));
      const e3 = espiao(false);
      await a.gerAcaoExportar("txt", e3.deps);
      ok(e3.chamadas.length === 1 && e3.ent === 0, "G29f o .txt tambem pergunta (e nao entrega se recusar)");
    }
    /* muitos avisos: so' os 6 primeiros, e o resto vira um contador */
    {
      const { a } = fix(8);
      const e = espiao(false);
      await a.gerAcaoExportar("apkg", e.deps);
      ok((e.chamadas[0].match(/linha \d+:/g) || []).length === 6 && e.chamadas[0].indexOf(a.t("ger_exp_suspeitos_mais", { n: 2 })) >= 0 && /8 cartão/.test(e.chamadas[0]), "G29g com 8 avisos a mensagem lista 6 e diz 'e mais 2': " + e.chamadas[0]);
    }
    /* so' conta o que entra: cartao fraco deixado de fora (sem fracos) nao dispara o aviso */
    {
      const { a } = fix(2, true);
      a.$("gerExpSemFracos").checked = true;
      const e = espiao(false);
      const r = await a.gerAcaoExportar("apkg", e.deps);
      ok(e.chamadas.length === 0 && r.ok === true && e.cons[0] === 1, "G29h cartao suspeito que ficou DE FORA do pacote (abaixo do padrao) nao dispara o aviso: " + JSON.stringify([e.chamadas.length, e.cons]));
    }
    /* o dialogo de verdade (uiConfirm): NAO nao exporta, SIM exporta */
    {
      const { a } = fix(1);
      let feito = 0;
      const deps = { construir: async () => new Uint8Array(1), entregar: async () => { feito++; } };
      const rNao = await negar(a, a.gerAcaoExportar("apkg", deps));
      ok(rNao.ok === false && feito === 0, "G29i dizer NAO no dialogo de verdade nao exporta");
      const rSim = await conduzir(a, a.gerAcaoExportar("apkg", deps));
      ok(rSim.ok === true && feito === 1, "G29j dizer SIM no dialogo de verdade exporta");
    }
  }

  /* ---- G30: U4 — "Exportar .txt/.apkg" do rodape da bancada abrem a Biblioteca em modo exportar com a Bancada
   * marcada; o antigo #dlgExport (e tudo que so' ele usava) deixou de existir ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(!/id="(dlgExport|deckExp|tituloExp|selEstilo|stylePreview|avisoTopo|btnCaminhoExp|btnExportConfirm)"/.test(html), "G30a o antigo dialogo de exportar nao existe mais no index.html");
    ok(/id="btnTxt"/.test(html) && /id="btnApkg"/.test(html), "G30b os botoes do rodape da bancada continuam la'");
    const BOM = "Qual a regra geral do prazo? :: Resposta decente e completa aqui";
    const espiao = () => { const c = { args: null, txt: null }; c.deps = { confirmar: async () => true, construir: async (...x) => { c.args = x; return new Uint8Array(1); }, entregar: async (b, nome) => { c.nome = nome; c.bytes = b; } }; return c; };
    for (const id of ["btnApkg", "btnTxt"]) {
      const { a } = montar();
      a.$("editor").value = BOM;
      a.$(id).onclick();
      ok(a.$("dlgGerCartoes").open === true && a.gerModoAtual() === "exportar" && a.gerSelExportAtual().size === 1 && a.gerSelExportAtual().has(a.CQ_BANCADA), "G30c " + id + " abre a Biblioteca em modo exportar com a Bancada ja marcada");
      ok(!/Marque ao menos/.test(a.$("gerExpResumo").textContent) && a.$("btnGerExpApkg").disabled === false, "G30d " + id + ": a previsao ja aparece e dá para exportar");
    }
    /* bancada vazia: avisa (como o botao sempre fez) e nao abre painel vazio */
    {
      const { a } = montar();
      a.$("editor").value = "";
      const r = a.$("btnApkg").onclick();
      ok(r === null && a.$("dlgGerCartoes").open !== true, "G30e bancada sem cartao: avisa e nao abre a Biblioteca");
    }
    /* exportar a Bancada: direto na raiz que a pessoa digitou, com o titulo geral e o estilo do painel */
    {
      const { a } = montar();
      a.$("editor").value = BOM;
      a.setTituloGeral("Meu Título");
      a.$("btnApkg").onclick();
      a.$("gerExpNome").value = "Curso::Tema"; a.$("gerExpNome").oninput();
      a.$("gerExpEstilo").value = "paper"; a.$("gerExpEstilo").onchange();
      const e = espiao();
      const r = await a.gerAcaoExportar("apkg", e.deps);
      ok(r.ok === true && e.args[0].length === 1 && e.args[0][0].deck === "" && e.args[1] === "Curso::Tema", "G30f a Bancada vai direto no baralho raiz digitado: " + JSON.stringify([e.args[0].map((c) => c.deck), e.args[1]]));
      ok(e.args[2] === "paper" && e.args[3] === "Meu Título", "G30g o .apkg leva o estilo escolhido no painel e o titulo geral (cartao sem titulo proprio): " + JSON.stringify([e.args[2], e.args[3]]));
      ok(e.nome === "Curso - Tema.apkg", "G30h o nome do arquivo vem do nome digitado: " + e.nome);
      const e2 = espiao();
      await a.gerAcaoExportar("txt", e2.deps);
      const linhas = new TextDecoder().decode(e2.bytes).split("\n").filter((l) => l && !l.startsWith("#"));
      ok(linhas.length === 1 && linhas[0].split("\t")[1] === "Curso::Tema", "G30i o .txt tambem poe a Bancada direto no baralho raiz: " + JSON.stringify(linhas));
      /* sem baralho raiz + Bancada: raiz vazia (o arquivo cai em 'Sem pasta'/'Import'), nunca '::' */
      a.$("gerExpSemRaiz").checked = true; a.$("gerExpSemRaiz").onchange();
      const e3 = espiao();
      await a.gerAcaoExportar("apkg", e3.deps);
      ok(e3.args[1] === "", "G30j sem baralho raiz o construtor recebe raiz vazia");
      /* a raiz digitada fica lembrada (era o que o antigo dialogo de exportar fazia ao confirmar) */
      ok(a.lojaLer("eac_deck") === "Curso::Tema", "G30k a raiz digitada fica salva");
      a.$("dlgGerCartoes").close(); a.gerAbrir();
      ok(a.$("gerExpNome").value === "Curso::Tema", "G30l reabrir traz a raiz salva");
    }
    /* a Bancada junto de uma pasta: a pasta ganha o baralho dela, a Bancada fica na raiz */
    {
      const { a, iss } = montar();
      a.$("editor").value = BOM;
      a.$("btnApkg").onclick();
      a.gerMarcarExport(iss, true); a.gerPintar();
      a.$("gerExpSemRep").checked = false; a.$("gerExpComEdital").checked = false;
      const e = espiao();
      await a.gerAcaoExportar("apkg", e.deps);
      const decks = e.args[0].map((c) => c.deck).sort();
      ok(decks.indexOf("") >= 0 && decks.indexOf("Trib::ISS") >= 0 && decks.every((d) => d === "" || d === "Trib::ISS"), "G30m Bancada na raiz e a pasta no baralho dela, no mesmo pacote: " + JSON.stringify(decks));
    }
  }

  /* ---- G31: H2 — "Como vai ficar no Anki": a hierarquia dos baralhos como arvore, com o nome de cada pasta editavel.
   * Os nomes valem SO' neste arquivo (a Biblioteca nunca muda) e "::" cria subniveis no arquivo ---- */
  {
    const nomesBtn = (a) => achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-nome")).map((e) => e.textContent);
    const btn = (a, txt) => achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-nome") && e.textContent === txt)[0];
    const campo = (a) => achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-edit"))[0];
    const tecla = (inp, key) => inp.onkeydown({ key, preventDefault() {} });
    const renomear = (a, de, para) => { btn(a, de).onclick(); const i = campo(a); i.value = para; tecla(i, "Enter"); };
    const fix = () => {
      const { a, iss, iptu, pri } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      [iss, iptu, pri].forEach((c) => a.gerMarcarExport(c, true));
      a.$("gerExpSemRep").checked = false;
      a.$("gerExpNome").value = "Raiz"; a.$("gerExpNome").oninput();
      return { a, iss, iptu, pri };
    };
    const capturar = async (a, formato) => {
      const c = { cards: null, bytes: null };
      await a.gerAcaoExportar(formato || "apkg", { confirmar: async () => true, construir: async (cards, raiz) => { c.cards = cards; c.raiz = raiz; return new Uint8Array(1); }, entregar: async (b) => { c.bytes = b; } });
      return c;
    };
    const decksDe = (c) => [...new Set(c.cards.map((x) => x.deck))].sort().join(" | ");

    /* a arvore mostra a hierarquia inteira, com a contagem de cada pasta */
    {
      const { a } = fix();
      ok(nomesBtn(a).join(",") === "Raiz,Const,Princípios,Trib,IPTU,ISS", "G31a a arvore mostra raiz › disciplinas › topicos, em ordem: " + nomesBtn(a));
      const cont = achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-cont")).map((e) => e.textContent).join("");
      ok(cont === "(6)(2)(2)(4)(1)(3)", "G31b cada pasta mostra quantos cartoes tem (a de cima soma as de baixo): " + cont);
      ok(achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-nome")).every((e) => e.tag === "button" && e.type === "button"), "G31c o nome de cada pasta e' um botao (alcancavel pelo teclado)");
      ok(a.$("btnGerExpDesfazerNomes").hidden === true, "G31d sem nenhum nome novo o 'desfazer nomes' nao aparece");
    }
    /* renomear uma disciplina: arvore, caminhos completos e arquivo; a Biblioteca nao muda */
    {
      const { a } = fix();
      const antes = JSON.stringify(a.matResumosAtual()), nNotas = a.gerNotasAtual().length;
      btn(a, "Trib").onclick();
      ok(campo(a) && campo(a).value === "Trib" && a.gerEditandoNomeAtual() === "Trib", "G31e clicar no nome abre o campo ja com o nome atual");
      campo(a).value = "Tributário"; tecla(campo(a), "Enter");
      ok(nomesBtn(a).join(",") === "Raiz,Const,Princípios,Tributário,IPTU,ISS" && a.gerEditandoNomeAtual() === null, "G31f Enter confirma: a disciplina e o que esta dentro seguem agrupados sob o nome novo: " + nomesBtn(a));
      ok(/era: Trib/.test(a.$("gerExpArvoreAnki").textContent) && a.$("btnGerExpDesfazerNomes").hidden === false, "G31g a linha lembra o nome de antes e aparece o 'desfazer nomes'");
      ok(/Raiz › Tributário › ISS/.test(a.$("gerExpDecks").textContent), "G31h os caminhos completos (a lista do arquivo) ja mostram o nome novo: " + a.$("gerExpDecks").textContent);
      const c = await capturar(a);
      ok(decksDe(c) === "Const::Princípios | Tributário::IPTU | Tributário::ISS" && c.raiz === "Raiz", "G31i o arquivo leva os baralhos com o nome novo: " + decksDe(c));
      ok(JSON.stringify(a.matResumosAtual()) === antes && a.gerNotasAtual().length === nNotas, "G31j a Biblioteca NAO mudou (nenhuma pasta, nenhum cartao)");
      const g = a.apkgAgruparDecks(c.cards, "Raiz", "");
      ok(Object.values(g.decks).map((d) => d.name).sort().join("|") === "Raiz::Const::Princípios|Raiz::Tributário::IPTU|Raiz::Tributário::ISS", "G31k o agrupamento real do .apkg usa os nomes novos");
      const t2 = await capturar(a, "txt");
      const linhas = new TextDecoder().decode(t2.bytes).split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t")[1]);
      ok(linhas.length === 6 && linhas.filter((d) => d === "Raiz::Tributário::ISS").length === 3, "G31l o .txt de verdade tambem: " + [...new Set(linhas)]);
    }
    /* "::" cria subniveis, so' no arquivo */
    {
      const { a } = fix();
      const antes = JSON.stringify(a.matResumosAtual());
      renomear(a, "Trib", "Direito :: Tributário");
      ok(/→ 2 níveis/.test(a.$("gerExpArvoreAnki").textContent) && nomesBtn(a).indexOf("Direito › Tributário") >= 0, "G31m '::' no nome mostra '2 niveis' e o caminho: " + nomesBtn(a));
      const c = await capturar(a);
      ok(decksDe(c) === "Const::Princípios | Direito::Tributário::IPTU | Direito::Tributário::ISS", "G31n o arquivo ganha os niveis novos: " + decksDe(c));
      ok(JSON.stringify(a.matResumosAtual()) === antes, "G31o mas a estrutura de pastas da Biblioteca continua igual");
      btn(a, "Direito › Tributário").onclick();
      ok(campo(a).value === "Direito::Tributário", "G31p ao editar de novo o campo mostra o nome como foi digitado (com '::')");
    }
    /* Esc cancela; vazio, igual ao original ou so' espacos tira o nome; sair do campo confirma */
    {
      const { a } = fix();
      btn(a, "ISS").onclick(); let i = campo(a); i.value = "XX"; tecla(i, "Escape"); i.onblur();
      ok(nomesBtn(a).indexOf("ISS") >= 0 && a.gerRenomearExportAtual().size === 0 && a.gerEditandoNomeAtual() === null, "G31q Esc cancela (e o campo que some nao confirma depois)");
      renomear(a, "ISS", "Imposto");
      ok(nomesBtn(a).indexOf("Imposto") >= 0, "G31r (confirma: renomeou o topico)");
      renomear(a, "Imposto", "   ");
      ok(nomesBtn(a).indexOf("ISS") >= 0 && a.gerRenomearExportAtual().size === 0, "G31s nome so' com espacos volta ao original");
      renomear(a, "ISS", "ISS");
      ok(a.gerRenomearExportAtual().size === 0, "G31t igual ao original nao guarda nada");
      btn(a, "IPTU").onclick(); i = campo(a); i.value = "Predial"; i.onblur();
      ok(nomesBtn(a).indexOf("Predial") >= 0, "G31u sair do campo (clicar fora) tambem confirma");
    }
    /* desfazer: uma linha e todas */
    {
      const { a } = fix();
      renomear(a, "Trib", "T"); renomear(a, "ISS", "I"); renomear(a, "Const", "C");
      ok(a.gerRenomearExportAtual().size === 3 && nomesBtn(a).join(",") === "Raiz,C,Princípios,T,IPTU,I", "G31v tres nomes novos de uma vez: " + nomesBtn(a));
      const des = achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "pac-desfazer-mov"))[0];
      des.onclick({ preventDefault() {} });
      ok(a.gerRenomearExportAtual().size === 2, "G31w o 'desfazer' da linha tira so' aquele nome");
      a.$("btnGerExpDesfazerNomes").onclick();
      ok(a.gerRenomearExportAtual().size === 0 && nomesBtn(a).join(",") === "Raiz,Const,Princípios,Trib,IPTU,ISS" && a.$("btnGerExpDesfazerNomes").hidden === true, "G31x 'desfazer nomes' volta tudo ao original e some");
    }
    /* duas pastas com o mesmo nome final: aviso de que viram um baralho so' */
    {
      const { a } = fix();
      renomear(a, "IPTU", "ISS");
      const avisos = achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-aviso"));
      ok(avisos.length === 2 && avisos[0].textContent === a.t("ger_exp_arv_mescla"), "G31y as duas pastas ficam marcadas 'junta com outra de mesmo nome'");
      const c = await capturar(a);
      ok(decksDe(c) === "Const::Princípios | Trib::ISS" && c.cards.filter((x) => x.deck === "Trib::ISS").length === 4, "G31z e no arquivo viram um baralho so', com os cartoes das duas: " + decksDe(c));
    }
    /* os nomes valem so' nesta exportacao: trocar de modo ou reabrir esquece */
    {
      const { a } = fix();
      renomear(a, "Trib", "T");
      a.gerAlternarModo("gerenciar"); a.gerAlternarModo("exportar");
      ok(a.gerRenomearExportAtual().size === 0, "G31aa trocar de modo esquece os nomes");
      const { a: b } = fix();
      renomear(b, "Trib", "T"); b.$("dlgGerCartoes").close(); b.gerAbrir();
      ok(b.gerRenomearExportAtual().size === 0, "G31ab reabrir a Biblioteca esquece os nomes");
    }
    /* a raiz: e' o mesmo campo "Nome do baralho raiz" */
    {
      const { a } = fix();
      renomear(a, "Raiz", "Meu Curso");
      ok(a.$("gerExpNome").value === "Meu Curso" && a.lojaLer("eac_deck") === "Meu Curso" && nomesBtn(a)[0] === "Meu Curso", "G31ac renomear a raiz na arvore muda o campo 'Nome do baralho raiz' (e fica lembrado)");
      a.$("gerExpNome").value = "Digitado"; a.$("gerExpNome").oninput();
      ok(nomesBtn(a)[0] === "Digitado", "G31ad e digitar no campo muda a raiz da arvore");
      renomear(a, "Digitado", "  ");
      ok(a.$("gerExpNome").value === "Digitado", "G31ae raiz sem nome nao apaga o campo");
      a.$("gerExpSemRaiz").checked = true; a.$("gerExpSemRaiz").onchange();
      ok(nomesBtn(a).indexOf("Digitado") < 0 && a.$("gerExpArvoreAnki").textContent.indexOf(a.t("ger_exp_arv_sem_raiz")) >= 0 && nomesBtn(a).join(",") === "Const,Princípios,Trib,IPTU,ISS", "G31af sem baralho raiz a linha da raiz vira so' o aviso (sem botao) e as pastas continuam editaveis: " + nomesBtn(a));
    }
    /* Bancada: cartoes diretos na raiz contam na raiz e nao ganham pasta */
    {
      const { a, iss } = montar();
      a.$("editor").value = "Qual a regra geral do prazo? :: Resposta decente e completa aqui";
      a.$("btnApkg").onclick();
      a.gerMarcarExport(iss, true); a.$("gerExpSemRep").checked = false; a.gerPintar();
      const cont = achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-cont")).map((e) => e.textContent);
      ok(nomesBtn(a).slice(1).join(",") === "Trib,ISS" && cont[0] === "(4)", "G31ag a Bancada conta na raiz e nao ganha pasta propria: " + nomesBtn(a) + " " + cont);
      renomear(a, "Trib", "Tributário");
      const c = await capturar(a);
      ok(c.cards.some((x) => x.deck === "") && c.cards.some((x) => x.deck === "Tributário::ISS"), "G31ah a Bancada segue direto na raiz e a pasta leva o nome novo: " + JSON.stringify(decksDe(c)));
    }
  }

  /* ---- G32: R1 — "Exportar esta pasta" de UM edital: a raiz e' o nome do concurso e "pasta do edital" nasce DESLIGADA
   * (ligar de novo duplicaria a pasta); no telefone o painel de exportar tem a sua aba ---- */
  {
    const ME = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5");
      const cs = (pref, n) => Array.from({ length: n }, (_, i) => pref + " " + i + "? :: Resposta " + pref + i + " zz" + pref + i).join("\n");
      a.matGravarCartoes(a.matChave("Sistema Tributário Brasileiro", "ISS"), cs("ISS", 3), { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.$("editor").value = "";
      return a;
    };
    const linhas = (a, c) => achar(a.$("gerArvore"), (e) => cls(e, c));
    const caminhos = (a) => achar(a.$("gerExpDecks"), (e) => cls(e, "cq-onde")).map((e) => e.textContent);
    const capturar = async (a) => { const c = {}; await a.gerAcaoExportar("apkg", { confirmar: async () => true, construir: async (cards, raiz) => { c.cards = cards; c.raiz = raiz; return new Uint8Array(1); }, entregar: async () => {} }); return c; };

    /* um edital so': raiz = o concurso, pasta do edital desligada */
    {
      const a = ME();
      a.gerAbrir();
      linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
      a.$("btnGerExportar").onclick();
      ok(a.$("gerExpNome").value === "ISS Caruaru Auditor", "G32a a raiz ja' vem com o nome do concurso: " + a.$("gerExpNome").value);
      ok(a.$("gerExpComEdital").checked === false, "G32b com a raiz ja' sendo o concurso, 'pasta do edital' nao nasce ligada (duplicaria a pasta)");
      const c = await capturar(a);
      ok(c.raiz === "ISS Caruaru Auditor" && c.cards.length > 0 && c.cards.every((x) => x.deck === "Sistema Tributário Brasileiro::ISS"), "G32c o arquivo: raiz certa e baralho Disciplina::Topico (a raiz so' entra na hora de escrever): " + JSON.stringify([c.raiz, c.cards.map((x) => x.deck)]));
      ok(caminhos(a).some((t) => t.indexOf("ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS") === 0), "G32d a previa comeca sem a duplicacao: " + caminhos(a).join(" ; "));
      a.$("gerExpComEdital").checked = true; a.$("gerExpComEdital").onchange();
      ok(caminhos(a).some((t) => t.indexOf("ISS Caruaru Auditor › ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS") === 0), "G32e religar 'pasta do edital' MOSTRA a duplicacao na previa, antes de exportar: " + caminhos(a).join(" ; "));
      a.$("gerExpComEdital").checked = false; a.$("gerExpComEdital").onchange();
      a.$("gerExpNome").value = "Outro Nome"; a.$("gerExpNome").oninput();
      ok(caminhos(a).some((t) => t.indexOf("Outro Nome › Sistema Tributário Brasileiro › ISS") === 0), "G32f digitar na raiz atualiza a previa na hora");
    }
    /* sem edital unico (visao por disciplina) e o botao geral "Montar pacote": volta ao padrao */
    {
      const a = ME();
      a.gerAbrir();
      a.$("gerAgrupar").value = "disciplina"; a.$("gerAgrupar").onchange();
      achar(a.$("gerArvore"), (e) => cls(e, "ger-disc")).find((e) => /Sistema Tributário Brasileiro/.test(e.textContent)).onclick();
      a.$("btnGerExportar").onclick();
      ok(a.$("gerExpNome").value !== "ISS Caruaru Auditor" && a.$("gerExpComEdital").checked === true, "G32g sem edital unico a raiz nao vira o nome de um edital qualquer e 'pasta do edital' fica ligada: " + a.$("gerExpNome").value);
      a.$("dlgGerCartoes").close();
      a.$("btnPacote").onclick();
      ok(a.$("gerExpNome").value !== "ISS Caruaru Auditor" && a.$("gerExpComEdital").checked === true, "G32h o botao geral 'Montar pacote' tambem comeca do padrao");
      /* exportar esta pasta de um edital e depois de uma disciplina: a 2a vez volta ao padrao (nao herda a raiz da 1a) */
      a.$("gerAgrupar").value = "edital"; a.$("gerAgrupar").onchange();
      linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
      a.gerAlternarModo("gerenciar");
      a.$("btnGerExportar").onclick();
      ok(a.$("gerExpNome").value === "ISS Caruaru Auditor" && a.$("gerExpComEdital").checked === false, "G32i (confirma o caso do edital, para o proximo passo valer)");
      a.gerAlternarModo("gerenciar");
      a.$("gerAgrupar").value = "disciplina"; a.$("gerAgrupar").onchange();
      achar(a.$("gerArvore"), (e) => cls(e, "ger-disc")).find((e) => /Sistema Tributário Brasileiro/.test(e.textContent)).onclick();
      a.$("btnGerExportar").onclick();
      ok(a.$("gerExpNome").value !== "ISS Caruaru Auditor" && a.$("gerExpComEdital").checked === true, "G32j depois de um edital, 'exportar esta pasta' de uma disciplina volta ao padrao: " + a.$("gerExpNome").value);
    }
    /* telefone: o painel de exportar e' a aba "Pacote" (a da Previa) */
    {
      const a = ME();
      a.gerCelularForcar(true);
      a.gerAbrir();
      a.$("btnGerModoExportar").onclick();
      ok(a.gerVistaAtualLer() === "pastas" && a.$("btnGerAbaPrevia").textContent === a.t("ger_aba_pacote"), "G32k no telefone, trocar para exportar comeca pelas pastas e a aba da previa vira 'Pacote': " + a.gerVistaAtualLer() + "/" + a.$("btnGerAbaPrevia").textContent);
      a.gerVista("previa");
      a.$("btnGerModoGerenciar").onclick();
      ok(a.gerVistaAtualLer() === "pastas" && a.$("btnGerAbaPrevia").textContent === a.t("ger_aba_previa"), "G32l voltar para gerenciar: pastas, e a aba volta a se chamar 'Previa'");
      a.gerVista("cartoes");
      a.$("btnGerModoExportar").onclick();
      ok(a.gerVistaAtualLer() === "pastas", "G32l2 trocar para exportar, vindo de outra aba, volta as pastas (escolher o que entra no pacote)");
      linhas(a, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
      a.gerAlternarModo("gerenciar");
      a.$("btnGerExportar").onclick();
      ok(a.gerVistaAtualLer() === "previa", "G32m 'exportar esta pasta' (ja' com pastas marcadas) leva direto ao painel de exportar");
      a.$("dlgGerCartoes").close();
      a.$("btnPacote").onclick();
      ok(a.gerVistaAtualLer() === "pastas", "G32n o botao geral 'Montar pacote' (nada marcado) abre nas pastas, para escolher");
      a.$("dlgGerCartoes").close();
      a.$("editor").value = "Qual a regra geral do prazo? :: Resposta decente e completa aqui";
      a.$("btnApkg").onclick();
      ok(a.gerVistaAtualLer() === "previa", "G32o o rodape da bancada (Bancada ja' marcada) vai direto ao painel");
      /* no computador as abas nem existem: a vista nao muda ao trocar de modo */
      const b = ME();
      b.gerCelularForcar(false);
      b.gerAbrir(); b.gerVista("cartoes");
      b.$("btnGerModoExportar").onclick();
      ok(b.gerVistaAtualLer() === "cartoes", "G32p no computador trocar de modo nao mexe na vista");
      linhas(b, "ger-ed").find((e) => /ISS Caruaru Auditor/.test(e.textContent)).onclick();
      b.gerAlternarModo("gerenciar"); b.gerVista("cartoes");
      b.$("btnGerExportar").onclick();
      ok(b.gerVistaAtualLer() === "cartoes" && b.gerModoAtual() === "exportar", "G32q no computador 'exportar esta pasta' tambem nao mexe na vista");
    }
  }

  /* ---- G33: R2 — "incluir baralhos vazios": os topicos do plano do edital que ainda nao tem cartao saem como baralhos
   * vazios no .apkg (a estrutura do edital pronta para encher no Anki); o .txt nao leva baralho sem cartao ---- */
  {
    const ME = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5\n+ Taxas :: 3");
      const k = (d, t) => a.matChave(d, t);
      const cs = (pref, n) => Array.from({ length: n }, (_, i) => pref + " " + i + "? :: Resposta " + pref + i + " zz" + pref + i).join("\n");
      a.matGravarCartoes(k("Sistema Tributário Brasileiro", "ISS"), cs("ISS", 3), { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.$("editor").value = "";
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      const iss = k("Sistema Tributário Brasileiro", "ISS"), iptu = k("Sistema Tributário Brasileiro", "IPTU"), taxas = k("Sistema Tributário Brasileiro", "Taxas");
      a.$("gerExpSemRep").checked = false;
      a.$("gerExpNome").value = "Raiz"; a.$("gerExpNome").oninput();
      return { a, iss, iptu, taxas };
    };
    const capturar = async (a, formato) => { const c = { cards: null, extras: null, bytes: null }; const r = await a.gerAcaoExportar(formato || "apkg", { confirmar: async () => true, construir: async (cards, raiz, est, tit, al, extras) => { c.cards = cards; c.extras = extras; c.raiz = raiz; return new Uint8Array(1); }, entregar: async (b) => { c.bytes = b; } }); c.r = r; return c; };
    const nomesBtn = (a) => achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-nome")).map((e) => e.textContent);

    {
      const { a, iss, iptu, taxas } = ME();
      ok(a.$("gerExpOpcEdital").hidden === false && a.$("gerExpVazios").checked === false, "G33a com edital cadastrado a opcao aparece, desligada");
      const inf = a.gerExpInfoVazios();
      ok(inf.size === 2 && !inf.has(iss) && inf.has(iptu) && inf.has(taxas) && inf.get(taxas).edital === "ISS Caruaru Auditor" && inf.get(taxas).disciplina === "Sistema Tributário Brasileiro" && inf.get(taxas).topico === "Taxas", "G33a2 o mapa dos vazios tem so' os topicos do plano SEM cartao, com edital, disciplina e topico: " + JSON.stringify([...inf]));
      [iss, iptu, taxas].forEach((c) => a.gerMarcarExport(c, true)); a.gerPintar();
      ok(!/vazio/.test(a.$("gerExpResumo").textContent) && nomesBtn(a).join(",") === "Raiz,ISS Caruaru Auditor,Sistema Tributário Brasileiro,ISS", "G33b sem a opcao so' o topico com cartao entra: " + nomesBtn(a));
      a.$("gerExpVazios").checked = true; a.$("gerExpVazios").onchange();
      ok(/2 baralho\(s\) vazio\(s\) incluído/.test(a.$("gerExpResumo").textContent), "G33c com a opcao a previsao conta os baralhos vazios: " + a.$("gerExpResumo").textContent);
      ok(nomesBtn(a).join(",") === "Raiz,ISS Caruaru Auditor,Sistema Tributário Brasileiro,IPTU,ISS,Taxas", "G33d a arvore mostra tambem os vazios: " + nomesBtn(a));
      ok(achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-cont")).map((e) => e.textContent).join("") === "(3)(3)(3)(0)(3)(0)", "G33e com contagem zero");
      const antes = JSON.stringify(a.matResumosAtual());
      const c = await capturar(a);
      ok(c.r.ok && c.cards.length === 3 && c.extras.slice().sort().join("|") === "ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU|ISS Caruaru Auditor::Sistema Tributário Brasileiro::Taxas", "G33f o .apkg leva os baralhos vazios (Edital::Disciplina::Topico): " + JSON.stringify(c.extras));
      const g = a.apkgAgruparDecks(c.cards, "Raiz", "", c.extras);
      ok(Object.values(g.decks).map((d) => d.name).sort().join("|") === "Raiz::ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU|Raiz::ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS|Raiz::ISS Caruaru Auditor::Sistema Tributário Brasileiro::Taxas", "G33g o agrupamento real do arquivo cria os 3 baralhos");
      const t = await capturar(a, "txt");
      const linhas = new TextDecoder().decode(t.bytes).split("\n").filter((l) => l && !l.startsWith("#"));
      ok(linhas.length === 3 && !/IPTU|Taxas/.test(linhas.join("")), "G33h o .txt nao leva baralho vazio (so' os 3 cartoes)");
      ok(JSON.stringify(a.matResumosAtual()) === antes, "G33i a Biblioteca NAO mudou (nenhuma pasta criada)");
      /* sem a pasta do edital: 2 niveis */
      a.$("gerExpComEdital").checked = false; a.$("gerExpComEdital").onchange();
      const c2 = await capturar(a);
      ok(c2.extras.slice().sort().join("|") === "Sistema Tributário Brasileiro::IPTU|Sistema Tributário Brasileiro::Taxas" && c2.cards.every((x) => x.deck === "Sistema Tributário Brasileiro::ISS"), "G33j desligar 'pasta do edital' volta a Disciplina::Topico (cartoes e vazios)");
      /* renomear um vazio pela arvore */
      const btn = achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-nome") && e.textContent === "IPTU")[0];
      btn.onclick();
      const inp = achar(a.$("gerExpArvoreAnki"), (e) => cls(e, "ger-arv-edit"))[0]; inp.value = "Predial"; inp.onkeydown({ key: "Enter", preventDefault() {} });
      const c3 = await capturar(a);
      ok(c3.extras.indexOf("Sistema Tributário Brasileiro::Predial") >= 0 && c3.extras.indexOf("Sistema Tributário Brasileiro::IPTU") < 0, "G33k o baralho vazio renomeado na arvore sai com o nome novo: " + JSON.stringify(c3.extras));
      /* reabrir desliga */
      a.$("dlgGerCartoes").close(); a.gerAbrir();
      ok(a.$("gerExpVazios").checked === false, "G33l reabrir volta a opcao ao padrao (desligada)");
    }
    /* so' vazios marcados: o .apkg sai (estrutura pronta), o .txt nao */
    {
      const { a, iptu, taxas } = ME();
      [iptu, taxas].forEach((c) => a.gerMarcarExport(c, true));
      a.$("gerExpVazios").checked = true; a.$("gerExpVazios").onchange();
      ok(nomesBtn(a).join(",") === "Raiz,ISS Caruaru Auditor,Sistema Tributário Brasileiro,IPTU,Taxas", "G33m2 a arvore tambem aparece quando so' ha baralhos vazios: " + nomesBtn(a));
      ok(a.$("btnGerExpApkg").disabled === false && a.$("btnGerExpTxt").disabled === true && !/Marque ao menos/.test(a.$("gerExpResumo").textContent), "G33m so' topicos vazios marcados: o .apkg pode sair, o .txt nao: " + a.$("gerExpResumo").textContent);
      const c = await capturar(a);
      ok(c.r.ok === true && c.cards.length === 0 && c.extras.length === 2, "G33n .apkg so' com a estrutura vazia");
      ok((await capturar(a, "txt")).r.ok === false, "G33o .txt so' com baralhos vazios nao exporta");
      a.$("gerExpVazios").checked = false; a.$("gerExpVazios").onchange();
      ok(a.$("btnGerExpApkg").disabled === true, "G33p sem a opcao nao ha o que exportar: desliga");
    }
    /* sem edital cadastrado a opcao nem aparece */
    {
      const { a } = montar();
      a.gerAbrir(); a.$("btnGerModoExportar").onclick();
      ok(a.$("gerExpOpcEdital").hidden === true && a.gerExpInfoVazios().size === 0, "G33q sem edital cadastrado a opcao fica escondida e nao ha vazios");
    }
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
