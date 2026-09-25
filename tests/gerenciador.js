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
    ok(/Elevar ao padrão \(1\)/.test(a.$("btnGerMelhorar").textContent), "G14d o botao de elevar diz quantos");
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
    ok(a.gerSelAtual().size > 15 && /Elevar ao padrão \(15 de \d+\)/.test(a.$("btnGerMelhorar").textContent), "G14v com mais de 15 marcados o botao diz que so' 15 vao por rodada: " + a.$("btnGerMelhorar").textContent);
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
    const ids = botoes(dialogo("dlgGerCartoes")).concat(botoes(dialogo("dlgGerNovaPasta")));
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
    const raizes = (a) => linhas(a, "ger-ed").map((e) => e.textContent.replace(/^\s*[▾▸]\s*/, "").trim());
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
      ok(r.join("|") === "Bancada (1)|ISS Caruaru Auditor (7)|TCE-PE (2)|Concurso Apagado (1)|Sem edital (1)", "G19f raizes: Bancada, cada edital (na ordem da lista), edital que sumiu e 'Sem edital': " + r.join("|"));
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
    ok(ordem[0] === "btnBancaGer" && ordem.indexOf("btnRevisar") > 0 && ordem.indexOf("btnBancaElevar") > 0 && ordem.indexOf("btnBancaRep") > 0, "G20a na bancada a Biblioteca e' o PRIMEIRO botao da fila: " + ordem.join(","));
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

  /* ---- G13: no app ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="gerenciador\.js"><\/script>/.test(html) && /id="btnGerCartoes"/.test(html) && /id="dlgGerCartoes"/.test(html), "G13 falta o script, o botao ou a janela no index.html");
    ok(/"gerenciador\.js"/.test(sw), "G13a o modulo nao esta no cache offline");
    ok(/grid-template-columns:22fr 43fr 35fr/.test(html) && /#dlgGerCartoes\[open\]\{display:flex;flex-direction:column/.test(html) && /\.ger-grande\{width:98vw/.test(html), "G13b colunas 22/43/35, janela em coluna flexivel e modo ampliado no CSS");
    ok(/\.ger-pasta\.ger-alvo\{/.test(html) && /\.ger-ghost\{/.test(html) && /\.ger-item\.ger-indo\{/.test(html), "G13d CSS do destaque da pasta, da pilula e da linha esmaecida");
    ok(/id="gerAgrupar"/.test(html) && /\.ger-modo-edital \.ger-top\{/.test(html) && /\.ger-ed\{/.test(html), "G13f seletor da visao por edital e o recuo dos niveis");
    ok(/id="gerNpErro" role="alert"/.test(html) && /id="btnGerNovaPasta"/.test(html) && /id="btnGerMarcarTodos"/.test(html) && /\.ger-vazia\{/.test(html) && /\.ger-x\{/.test(html), "G13e botoes de nova pasta e marcar todos, e o estilo da pasta vazia");
    ok(/id="gerMsgCx" role="status" aria-live="polite" hidden/.test(html) && /id="gerAcoes"[^>]*hidden/.test(html) && /id="gerPop"[^>]*hidden/.test(html) && /id="btnGerAmpliar"/.test(html) && /resize:both/.test(html.slice(html.indexOf("#dlgGerCartoes{"), html.indexOf("#dlgGerCartoes{") + 200)), "G13c a barra de acoes e o seletor nascem escondidos; ha botao ampliar e o canto arrasta");
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
