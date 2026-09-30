/* =====================================================================
 * MONTAR PACOTE .apkg E IMPORTAR PARA UMA PASTA (16.73.0)
 *
 * O que originou: a exportação só saía do texto da bancada, num baralho
 * só; quem organiza o material em disciplina › tópico não podia escolher
 * quais pastas viram pacote, nem levar essa organização para o Anki — e um
 * .apkg importado perdia o baralho de cada cartão.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada pasta vira um baralho (Disciplina::Tópico), sem "::" nos nomes.
 *  2. O pacote leva só as pastas marcadas; opcionalmente sem os repetidos
 *     (fica o mais completo de cada grupo, entre pastas) e sem os abaixo do padrão.
 *  3. A previsão conta notas, baralhos e o que ficou de fora.
 *  4. O cartão exportado leva o baralho da pasta sem perder a manchete;
 *     .apkg e .txt saem com o nome certo, e erro aparece em vez de sumir.
 *  5. Importar: o baralho de cada cartão vira pasta (sem a raiz comum), ou
 *     tudo vai para uma pasta escolhida; lacuna e explicação sobrevivem;
 *     pergunta que a pasta já tem não duplica; o gerenciador desfaz.
 *  6. Toda ação que grava pergunta antes.
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
  const RICO = "Serviços constantes da lista anexa à LC 116/2003, conforme o art. 1º; o imposto é municipal e incide sobre a prestação de serviços de qualquer natureza, ainda que não seja atividade preponderante do prestador";

  const montar = () => {
    const r = rodar(); const a = r.api;
    a.matIniciar(); a.edIniciar(); a.$("editor").value = "";
    const iss = a.matChave("Trib", "ISS"), iptu = a.matChave("Trib", "IPTU"), pri = a.matChave("Const", "Princípios");
    a.matGravarCartoes(iss, [
      "@ Trilha ISS", "Qual o fato gerador do ISS? :: Serviço :: x", "+ Nota antiga", "",
      "Qual a alíquota máxima do ISS? :: " + RICO + " :: x", "+ Literalidade — Art. 8º-A"].join("\n"), { disciplina: "Trib", topico: "ISS" });
    a.matGravarCartoes(iptu, [
      "Qual o fato gerador do imposto ISS? :: " + RICO + " :: y", "+ Literalidade — Art. 1º",
      "", "Quem paga o IPTU? :: O proprietário :: y"].join("\n"), { disciplina: "Trib", topico: "IPTU" });
    a.matGravarCartoes(pri, "O prazo é de {{c1::30 dias::30 ou 60?}} (art. 5º). ::  :: z", { disciplina: "Const", topico: "Princípios" });
    return { a, iss, iptu, pri };
  };

  /* ---- P1: nomes ---- */
  {
    const { a } = montar();
    ok(a.pacNomeDeck({ disciplina: "Trib", topico: "ISS" }) === "Trib::ISS", "P1 baralho = Disciplina::Topico");
    ok(a.pacNomeDeck({ disciplina: "A :: B", topico: "  C   D " }) === "A — B::C D", `P1a '::' dentro do nome nao cria nivel: ${a.pacNomeDeck({ disciplina: "A :: B", topico: "  C   D " })}`);
    ok(a.pacNomeDeck({ disciplina: "", topico: "" }) === "Sem pasta" && a.pacNomeDeck({ disciplina: "So", topico: "" }) === "So", "P1b pasta sem nome");
    ok(a.pacNomeArquivo("ISS: Caruaru/2026?") === "ISS Caruaru 2026" && a.pacNomeArquivo("A::B") === "A - B" && a.pacNomeArquivo("  ") === "EasyAnkiCards", `P1c nome de arquivo seguro: ${a.pacNomeArquivo("ISS: Caruaru/2026?")}`);
  }

  /* ---- P2: o que entra ---- */
  {
    const { a, iss, iptu, pri } = montar();
    const notas = a.cqLerBiblioteca();
    const M = (sel, o) => a.pacMontar(notas, new Set(sel), o);
    ok(M([], {}).itens.length === 0 && M([iss], {}).itens.length === 2, "P2 so' as pastas marcadas entram");
    ok(M([iss, iptu, pri], {}).itens.length === 5 && M([iss, iptu, pri], {}).decks.size === 3, "P2a tudo marcado: 5 notas em 3 baralhos");
    const sr = M([iss, iptu], { semRepetidos: true });
    ok(sr.itens.length === 3 && sr.ignRep === 1, `P2b sem repetidos: 4 -> 3, ignorou 1: ${sr.itens.length}/${sr.ignRep}`);
    const fica = sr.itens.find((x) => /fato gerador/.test(x.card.front));
    ok(fica && fica.chave === iptu && /Art\. 1º/.test(fica.card.more), "P2c dos dois 'fato gerador' fica o mais completo (o do OUTRO topico, com artigo)");
    ok(M([iss], { semRepetidos: true }).ignRep === 0, "P2d repeticao so' conta entre o que esta marcado (aqui so' ha um)");
    const sf = M([iss, iptu, pri], { semFracos: true });
    ok(sf.ignFracos >= 2 && sf.itens.every((x) => !a.ceAbaixo(x.card)), `P2e sem fracos: so' o que esta no padrao: ${sf.ignFracos}`);
    const ambos = M([iss, iptu], { semRepetidos: true, semFracos: true });
    ok(ambos.ignRep === 1 && ambos.itens.every((x) => !a.ceAbaixo(x.card)), "P2f repetido conta uma vez so' (nao entra como fraco tambem)");
    const restam = M([iss, iptu], { semRepetidos: true }).itens.filter((x) => a.ceAbaixo(x.card)).length;
    ok(ambos.ignFracos === restam, `P2f2 so' conta como fraco o que sobrou depois de tirar os repetidos: ${ambos.ignFracos} vs ${restam}`);
    ok([...M([iss, iptu], { semRepetidos: true }).decks.values()].reduce((s, v) => s + v, 0) === 3, "P2g a contagem por baralho soma as notas");
    ok(a.pacMontar(null, null, null).itens.length === 0, "P2h entradas vazias nao quebram");
  }

  /* ---- P3: os cartoes do pacote ---- */
  {
    const { a, iss } = montar();
    const notas = a.cqLerBiblioteca().filter((x) => x.chave === iss);
    const cs = a.pacCartoes(notas);
    ok(cs.length === 2 && cs.every((c) => c.deck === "Trib::ISS") && cs[0].titulo === "Trilha ISS", "P3 cada cartao leva o baralho da pasta e mantem a manchete");
    ok(notas[0].card.deck === undefined, "P3a o cartao original nao e' alterado");
    cs[0].tags.push("zzz");
    ok(notas[0].card.tags.indexOf("zzz") < 0, "P3b as etiquetas sao copiadas (nao compartilhadas)");
  }

  /* ---- P4: separar baralho / raiz comum ---- */
  {
    const { a } = montar();
    ok(JSON.stringify(a.pacSepararDeck("A::B::C", "")) === JSON.stringify({ disciplina: "A", topico: "B › C" }), "P4 A::B::C -> A / B › C");
    ok(JSON.stringify(a.pacSepararDeck("Raiz::Trib::ISS", "Raiz")) === JSON.stringify({ disciplina: "Trib", topico: "ISS" }), "P4a a raiz comum sai");
    ok(JSON.stringify(a.pacSepararDeck("Raiz", "Raiz")) === JSON.stringify({ disciplina: "Raiz", topico: "Geral" }), "P4b so' a raiz: fica como disciplina, topico Geral");
    ok(JSON.stringify(a.pacSepararDeck("", "")) === JSON.stringify({ disciplina: "Importados", topico: "Sem baralho" }), "P4c sem baralho");
    ok(JSON.stringify(a.pacSepararDeck("Solto", "")) === JSON.stringify({ disciplina: "Solto", topico: "Geral" }), "P4d um nivel so'");
    ok(a.pacRaizComum([{ deck: "R::A" }, { deck: "R::B" }]) === "R" && a.pacRaizComum([{ deck: "R::A" }, { deck: "S::B" }]) === "" && a.pacRaizComum([{ deck: "R::A" }, { deck: "R::A" }]) === "" && a.pacRaizComum([]) === "", "P4e raiz comum: so' com 2+ baralhos e a mesma primeira parte");
  }

  /* ---- P5: o bloco importado ---- */
  {
    const { a } = montar();
    const cloze = { kind: "cloze", front: "O ISS é de {{c1::municipal::A ou B?}}.", back: "", tags: ["x"], ownTags: ["x"], more: "Literalidade — Art. 156<br>Exemplo — serviço", titulo: "Trilha" };
    const b = a.pacBlocoImportado(cloze);
    ok(/^@ Trilha\nO ISS é de \{\{c1::municipal::A ou B\?\}\}\.( ::)?/.test(b) && /\+ Literalidade — Art\. 156\n\+ Exemplo — serviço$/.test(b), `P5 bloco de lacuna: ${JSON.stringify(b)}`);
    const v = a.parseText(b, []).cards;
    ok(v.length === 1 && v[0].kind === "cloze" && /\{\{c1::municipal::A ou B\?\}\}/.test(v[0].front) && v[0].titulo === "Trilha" && /Exemplo/.test(v[0].more), `P5a volta como lacuna, com titulo e explicacao: ${JSON.stringify(v[0])}`);
    const basico = { kind: "basic", front: "P :: com dois pontos", back: "R :: idem\nquebra", tags: ["Direito::ISS", "duas palavras"], ownTags: ["Direito::ISS", "duas palavras"], more: "", titulo: "" };
    const b2 = a.pacBlocoImportado(basico);
    const v2 = a.parseText(b2, []).cards;
    ok(v2.length === 1 && v2[0].kind === "basic" && /P — com dois pontos/.test(v2[0].front) && /R — idem quebra/.test(v2[0].back), `P5b '::' no texto do cartao nao o parte: ${JSON.stringify(v2[0])} / ${JSON.stringify(b2)}`);
    ok(v2[0].tags.join() === "Direito_ISS,duas_palavras", `P5c etiquetas hierarquicas e com espaco: ${v2[0].tags}`);
  }

  /* ---- P6: importar ---- */
  {
    const { a, iss } = montar();
    const c = (front, deck, extra) => Object.assign({ kind: "basic", front, back: "Resposta " + front, tags: [], ownTags: [], more: "", titulo: "", deck }, extra);
    const pacote = [
      c("Pergunta A?", "Pacote::Civil::Contratos"), c("Pergunta B?", "Pacote::Civil::Contratos", { more: "Exemplo — x" }),
      c("Pergunta C?", "Pacote::Penal"), c("Pergunta D?", ""),
      c("Qual o fato gerador do ISS?", "Pacote::Trib::ISS"),
    ];
    const antesISS = a.matResumosAtual()[iss].cartoes;
    const r = a.pacImportar(pacote, "decks");
    ok(r.novos === 4 && r.repetidos === 1 && r.topicos === 3, `P6 importar por baralho (o "fato gerador" ja existia em Trib/ISS): ${JSON.stringify(r)}`);
    const R = a.matResumosAtual();
    const civ = R[a.matChave("Civil", "Contratos")];
    ok(civ && civ.disciplina === "Civil" && civ.topico === "Contratos" && /Pergunta A\?/.test(civ.cartoes) && /Pergunta B\?[\s\S]*\+ Exemplo — x/.test(civ.cartoes), `P6a a raiz comum saiu e o topico foi criado: ${civ && civ.cartoes}`);
    ok(R[a.matChave("Penal", "Geral")] && R[a.matChave("Importados", "Sem baralho")], "P6b baralho de um nivel e cartao sem baralho tem pasta");
    ok((R[iss].cartoes.match(/Qual o fato gerador do ISS\?/g) || []).length === 1, "P6c a pergunta que a pasta ja tinha nao foi duplicada");
    ok(a.gerRecibo() && a.gerRecibo().itens.length === 3, `P6d recibo so' com as 3 pastas que mudaram: ${a.gerRecibo() && a.gerRecibo().itens.length}`);
    const r2 = a.pacImportar(pacote, "decks");
    ok(r2.novos === 0 && r2.repetidos === 5, `P6e importar de novo nao duplica: ${JSON.stringify(r2)}`);
    a.gerDesfazerUltima();
    /* o recibo do 2o import (nada mudou) nao existe; o 1o foi sobrescrito? nao: 2o nao grava recibo */
    ok(!/Pergunta A\?/.test(String(a.matResumosAtual()[a.matChave("Civil", "Contratos")].cartoes || "")) && a.matResumosAtual()[iss].cartoes === antesISS, "P6f desfazer a importacao esvazia as pastas novas e devolve a existente");
    /* modo topico */
    const alvo = a.matChave("Trib", "IPTU");
    const r3 = a.pacImportar(pacote, "topico", alvo);
    ok(r3.novos === 5 && r3.topicos === 1 && /Pergunta D\?/.test(a.matResumosAtual()[alvo].cartoes), `P6g tudo numa pasta: ${JSON.stringify(r3)}`);
    const r4 = a.pacImportar(pacote, "topico", "chave inexistente");
    ok(r4.novos === 0, "P6h destino inexistente nao grava");
  }

  /* ---- P7: a tela de exportar ---- */
  {
    const { a, iss, iptu } = montar();
    a.pacAbrir();
    ok(a.$("dlgPacote").open === true && /Marque ao menos/.test(a.$("pacPrevia").textContent) && a.$("btnPacApkg").disabled === true && a.$("btnPacTxt").disabled === true, "P7 abre sem nada marcado, exportar desligado");
    const labels = achar(a.$("pacArvore"), (e) => cls(e, "pac-disc") || cls(e, "pac-top"));
    ok(labels.length === 2 + 3, `P7a arvore com 2 disciplinas e 3 topicos: ${labels.length}`);
    ok(a.$("pacSemRep").checked === true && a.$("pacSemFracos").checked === false && a.$("pacNome").value !== "", "P7b padroes: sem repetidos ligado, sem fracos desligado, nome preenchido");
    /* marcar a disciplina Trib marca os 2 topicos dela */
    const disc = labels.filter((l) => cls(l, "pac-disc") && /Trib/.test(l.textContent))[0];
    const ck = achar(disc, (e) => e.tag === "input")[0];
    ck.checked = true; ck.onchange();
    ok(a.pacSelAtual().size === 2 && /3 notas em 2 baralhos · 1 repetida\(s\)/.test(a.$("pacPrevia").textContent), `P7c marcar a disciplina marca os topicos: ${a.$("pacPrevia").textContent}`);
    ok(a.$("btnPacApkg").disabled === false && achar(a.$("pacDecks"), (e) => cls(e, "cq-onde")).length === 2, "P7d exportar liga e a lista de baralhos aparece");
    a.$("pacSemRep").checked = false; a.$("pacSemRep").onchange();
    ok(/4 notas em 2 baralhos · 0 repetida/.test(a.$("pacPrevia").textContent), `P7e desligar 'sem repetidos' muda a previsao: ${a.$("pacPrevia").textContent}`);
    a.$("pacSemRep").checked = true; a.$("pacSemRep").onchange();
    a.$("pacSemFracos").checked = true; a.$("pacSemFracos").onchange();
    ok(/ 1 abaixo do padrão|[1-9] abaixo do padrão/.test(a.$("pacPrevia").textContent), `P7f 'sem fracos' aparece na previsao: ${a.$("pacPrevia").textContent}`);
    a.$("pacSemFracos").checked = false; a.$("pacSemFracos").onchange();
    a.$("btnPacLimpar").onclick();
    ok(a.pacSelAtual().size === 0 && a.$("btnPacApkg").disabled === true, "P7g limpar desmarca tudo");
    a.$("btnPacTudo").onclick();
    ok(a.pacSelAtual().size === 3, "P7h marcar tudo");

    /* exportar .apkg com o construtor de mentira */
    a.$("pacNome").value = "Meu: Pacote";
    let recebido = null, entregue = null;
    const deps = {
      construir: async (cards, raiz, est, tit, al) => { recebido = { cards, raiz, est, tit, al }; return new Uint8Array([1, 2, 3]); },
      entregar: async (bytes, nome, mime) => { entregue = { n: bytes.length, nome, mime }; },
    };
    const r = await a.pacExportar("apkg", deps);
    ok(r.ok === true && r.n === 4 && r.k === 3, `P7i exportar: ${JSON.stringify(r)}`);
    ok(recebido.raiz === "Meu: Pacote" && recebido.tit === "" && recebido.cards.length === 4 && recebido.cards.every((c) => /::/.test(c.deck)), "P7j o construtor recebe a raiz, cartoes com baralho e sem manchete geral");
    ok(entregue.nome === "Meu Pacote.apkg" && entregue.mime === "application/octet-stream" && entregue.n === 3, `P7k arquivo: ${JSON.stringify(entregue)}`);
    ok(/Meu Pacote\.apkg: 4 notas em 3 baralhos/.test(a.$("pacMsg").textContent), `P7l mensagem: ${a.$("pacMsg").textContent}`);
    /* .txt */
    const r2 = await a.pacExportar("txt", deps);

    ok(r2.ok === true && entregue.nome === "Meu Pacote.txt" && entregue.mime === "text/plain", `P7m txt: ${JSON.stringify(entregue)}`);
    /* erro do construtor aparece */
    const r3 = await a.pacExportar("apkg", { construir: async () => { throw new Error("sql.js caiu"); }, entregar: async () => {} });
    ok(r3.ok === false && /sql\.js caiu/.test(a.$("pacMsg").textContent), `P7n erro do construtor aparece na tela: ${a.$("pacMsg").textContent}`);
    /* nada marcado */
    a.$("btnPacLimpar").onclick();
    ok((await a.pacExportar("apkg", deps)).ok === false, "P7o sem pasta marcada nao exporta");
  }
  {
    /* o conteudo do .txt */
    const { a } = montar();
    a.pacAbrir(); a.$("btnPacTudo").onclick(); a.$("pacNome").value = "Raiz";
    let bytes = null;
    await a.pacExportar("txt", { entregar: async (b) => { bytes = b; } });
    const linhas = new TextDecoder().decode(bytes).split("\n").filter((l) => l && !l.startsWith("#"));
    const decks = linhas.map((l) => l.split("\t")[1]);
    ok(linhas.length === 4 && decks.indexOf("Raiz::Trib::ISS") >= 0 && decks.indexOf("Raiz::Const::Princípios") >= 0, `P7p o .txt tem o baralho de cada cartao: ${decks}`);
  }

  /* ---- P8: a tela de importar ---- */
  {
    const { a, iss } = montar();
    a.pacAbrir();
    ok(a.$("pacImpCx").hidden === true, "P8 sem arquivo a area de importar fica escondida");
    const cards = [
      { kind: "basic", front: "Q1?", back: "R1", tags: [], ownTags: [], more: "", titulo: "", deck: "Pacote::Civil" },
      { kind: "basic", front: "Q2?", back: "R2", tags: [], ownTags: [], more: "", titulo: "", deck: "Pacote::Penal" },
    ];
    const lido = await a.pacLerArquivo({ fake: 1 }, { ler: async () => ({ deck: "Pacote", cards }) });
    ok(lido && a.$("pacImpCx").hidden === false && /2 cartões em 2 baralho\(s\) \(pacote “Pacote”\)/.test(a.$("pacImpResumo").textContent) && a.$("btnPacImportar").disabled === false, `P8a resumo do pacote lido: ${a.$("pacImpResumo").textContent}`);
    const erro = await a.pacLerArquivo({ fake: 1 }, { ler: async () => { throw new Error("arquivo estragado"); } });
    ok(erro === null && a.$("pacImpCx").hidden === true && /arquivo estragado/.test(a.$("pacMsg").textContent), "P8b erro de leitura aparece e esconde a area");
    await a.pacLerArquivo({ fake: 1 }, { ler: async () => ({ deck: "Pacote", cards }) });
    const antes = JSON.stringify(a.matResumosAtual());
    await negar(a, a.$("btnPacImportar").onclick());
    ok(JSON.stringify(a.matResumosAtual()) === antes, "P8c dizer NAO em 'importar' nao mexe em nada");
    await conduzir(a, a.$("btnPacImportar").onclick());
    ok(/Q1\?/.test((a.matResumosAtual()[a.matChave("Civil", "Geral")] || {}).cartoes || "") && /Q2\?/.test((a.matResumosAtual()[a.matChave("Penal", "Geral")] || {}).cartoes || "") && a.matResumosAtual()[a.matChave("Pacote", "Civil")] === undefined, "P8d a raiz comum 'Pacote' saiu: Civil/Geral e Penal/Geral");
    ok(Object.keys(a.matResumosAtual()).length === 5, `P8e o material ganhou 2 pastas: ${Object.keys(a.matResumosAtual()).length}`);
    ok(/2 cartão\(ões\) novo\(s\) em 2 pasta\(s\)/.test(a.$("pacMsg").textContent) && a.$("pacImpCx").hidden === true, `P8f mensagem e area escondida depois: ${a.$("pacMsg").textContent}`);
    ok(a.pacNotasAtual().length === 7, `P8g a arvore do pacote se atualiza: ${a.pacNotasAtual().length}`);
    /* modo topico */
    await a.pacLerArquivo({ fake: 1 }, { ler: async () => ({ deck: "Pacote", cards: [{ kind: "basic", front: "Novo Q9?", back: "R9", tags: [], ownTags: [], more: "", titulo: "", deck: "X::Y" }] }) });
    a.$("pacModoTopico").checked = true; a.$("pacModoDecks").checked = false;
    a.$("pacImpDestino").value = iss;
    await conduzir(a, a.$("btnPacImportar").onclick());
    ok(/Novo Q9\?/.test(a.matResumosAtual()[iss].cartoes), "P8h modo 'tudo numa pasta' grava na pasta escolhida");
    /* modo topico sem destino */
    await a.pacLerArquivo({ fake: 1 }, { ler: async () => ({ deck: "P", cards }) });
    a.$("pacModoTopico").checked = true; a.$("pacImpDestino").value = "";
    const t0 = JSON.stringify(a.matResumosAtual());
    const pSem = a.$("btnPacImportar").onclick();
    await Promise.resolve();
    const aviso = a.$("uiModalMsg") ? a.$("uiModalMsg").textContent : "";
    for (let i = 0; i < 6; i++) { await Promise.resolve(); try { a._uiFechar(true); } catch (e) {} }
    await pSem;
    ok(JSON.stringify(a.matResumosAtual()) === t0 && /Escolha a pasta de destino/.test(aviso), `P8i sem pasta de destino nao importa e AVISA: ${aviso}`);
  }

  /* ---- P10: a lacuna sobrevive ao salvar no material (o "::" da lacuna nao e' do material) ---- */
  {
    const { a } = montar();
    const ch = a.matChave("Trib", "Salvar");
    a.matGravar(ch, "resumo", { disciplina: "Trib", topico: "Salvar", concurso: "X" });
    a.matAbrirEditor({ disciplina: "Trib", nome: "Salvar" }, true);
    a.matCartoesAbrir();
    a.$("mcTexto").value = "O ISS é de {{c1::municipal::municipal ou estadual?}}. ::  :: x\nQual o prazo? :: 30 dias :: x";
    a.matCartoesConferir();
    await conduzir(a, a.matCartoesSalvar());
    const t = String((a.matResumosAtual()[ch] || {}).cartoes || "");
    ok(/\{\{c1::municipal::municipal ou estadual\?\}\}/.test(t) && !/c1 —/.test(t), `P10 a lacuna com dica foi estragada ao salvar: ${JSON.stringify(t)}`);
    const volta = a.parseText(t).cards;
    ok(volta.length === 2 && volta[0].kind === "cloze", "P10a o cartao de lacuna volta como lacuna");
  }

  /* ---- P10: exportar pastas COMPLETAS por edital (Edital::Disciplina::Topico) ---- */
  {
    const ME = () => {
      const r = rodar(); const a = r.api;
      a.matIniciar(); a.edIniciar();
      const edA = a.edCriar("ISS Caruaru Auditor", "# ISS Caruaru | prova: 2027-06-01 | horas: 20\n@ Sistema Tributário Brasileiro :: 5\n+ ISS :: 5\n+ IPTU :: 5\n+ Taxas :: 3\n@ Direito Financeiro :: 4\n+ Receita Pública :: 4");
      const edB = a.edCriar("TCE-PE", "# TCE-PE | prova: 2027-08-01 | horas: 20\n@ Direito Financeiro :: 5\n+ Receita Pública :: 5\n+ Créditos Adicionais :: 3");
      a.$("editor").value = "";
      const k = (d, t) => a.matChave(d, t);
      const cs = (pref, n) => Array.from({ length: n }, (_, i) => pref + " " + i + "? :: Resposta " + pref + i + " zz" + pref + i).join("\n");
      a.matGravarCartoes(k("Sistema Tributário Brasileiro", "ISS"), cs("ISS", 3), { disciplina: "Sistema Tributário Brasileiro", topico: "ISS", concurso: "ISS Caruaru Auditor" });
      a.matGravarCartoes(k("Direito Financeiro", "Receita Pública"), cs("Receita", 2), { disciplina: "Direito Financeiro", topico: "Receita Pública", concurso: "TCE-PE" });
      return { a, edA, edB, k };
    };
    const deps = (cap) => ({ construir: async (cards, raiz, est, tit, al, extras) => { cap.cards = cards; cap.raiz = raiz; cap.extras = extras; return new Uint8Array([1]); }, entregar: async (b, nome) => { cap.nome = nome; } });
    const linhas = (a, c) => achar(a.$("pacArvore"), (e) => cls(e, c));

    /* nomes de baralho */
    {
      const { a } = montar();
      ok(a.pacNomeDeck({ edital: "ISS", disciplina: "Trib", topico: "ISS" }, true) === "ISS::Trib::ISS" && a.pacNomeDeck({ edital: "ISS", disciplina: "Trib", topico: "ISS" }, false) === "Trib::ISS" && a.pacNomeDeck({ edital: "ISS", disciplina: "Trib", topico: "ISS" }) === "Trib::ISS", "P10a com a pasta do edital: Edital::Disciplina::Topico; sem: como sempre");
      ok(a.pacNomeDeck({ edital: "A :: B", disciplina: "Trib", topico: "ISS" }, true) === "A — B::Trib::ISS" && a.pacNomeDeck({ edital: "", disciplina: "Trib", topico: "ISS" }, true) === "Trib::ISS", "P10b '::' no nome do edital nao cria nivel; sem edital nao sobra nivel vazio");
      const cs = a.pacCartoes([{ card: { front: "P", back: "R", tags: [] }, edital: "ISS", disciplina: "Trib", topico: "ISS" }], true);
      ok(cs[0].deck === "ISS::Trib::ISS" && a.pacCartoes([{ card: { front: "P", back: "R" }, edital: "ISS", disciplina: "Trib", topico: "ISS" }])[0].deck === "Trib::ISS", "P10c pacCartoes leva o baralho com o edital so' quando pedido");
    }
    /* baralhos vazios no arquivo .apkg */
    {
      const { a } = montar();
      const g = a.apkgAgruparDecks([{ front: "P", deck: "A::B" }], "Raiz", "", ["Ed::Disc::Vazio", "  ", "A::B"]);
      const nomes = Object.values(g.decks).map((d) => d.name).sort();
      ok(nomes.join("|") === "Raiz::A::B|Raiz::Ed::Disc::Vazio" && g.idPorCartao.length === 1, "P10d baralhos vazios entram no arquivo (raiz + nome), sem repetir e sem nome em branco: " + nomes.join("|"));
      const g2 = a.apkgAgruparDecks([{ front: "P", deck: "A::B" }], "Raiz", "");
      ok(Object.keys(g2.decks).length === 1, "P10e sem extras o arquivo e' o mesmo de sempre");
      const g3 = a.apkgAgruparDecks([], "Raiz", "", ["X::Y"]);
      ok(Object.keys(g3.decks).length === 1 && Object.values(g3.decks)[0].name === "Raiz::X::Y", "P10f dá para gerar so' baralhos vazios");
      ok(JSON.stringify(Object.keys(a.apkgAgruparDecks([], "Raiz", "", ["X::Y"]).decks)) === JSON.stringify(Object.keys(g3.decks)), "P10g o id do baralho e' estavel (reimportar atualiza, nao duplica)");
      const codAnki = fs.readFileSync(path.join(__dirname, "..", "docs", "anki.js"), "utf8");
      ok(/async function buildApkg\(cards, deckName, estilo, titulo, alinha, extras\)/.test(codAnki) && /apkgAgruparDecks\(cards, deckName, titulo, extras\)/.test(codAnki), "P10g2 o buildApkg repassa os baralhos vazios para o agrupador");
    }
    /* pacMontar: edital e vazios */
    {
      const { a, k } = ME();
      const notas = a.cqLerBiblioteca();
      const sel = new Set([k("Sistema Tributário Brasileiro", "ISS"), k("Sistema Tributário Brasileiro", "IPTU")]);
      const info = new Map([[k("Sistema Tributário Brasileiro", "IPTU"), { edital: "ISS Caruaru Auditor", disciplina: "Sistema Tributário Brasileiro", topico: "IPTU" }]]);
      const editalDe = new Map([[k("Sistema Tributário Brasileiro", "ISS"), "ISS Caruaru Auditor"], [k("Sistema Tributário Brasileiro", "IPTU"), "ISS Caruaru Auditor"]]);
      const m1 = a.pacMontar(notas, sel, { comEdital: true, editalDe, info, vazios: true });
      ok(m1.itens.length === 3 && m1.itens.every((n) => n.edital === "ISS Caruaru Auditor") && [...m1.decks.keys()].sort().join("|") === "ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU|ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS" && m1.decks.get("ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU") === 0 && m1.vazios.length === 1, "P10h com edital e vazios: o topico sem cartao vira baralho vazio (0) e sai em 'vazios': " + JSON.stringify([...m1.decks]));
      const m2 = a.pacMontar(notas, sel, { comEdital: true, editalDe, info, vazios: false });
      ok(m2.vazios.length === 0 && m2.decks.size === 1, "P10i sem a opcao de vazios o topico sem cartao fica de fora");
      const m3 = a.pacMontar(notas, sel, { comEdital: false, editalDe, info, vazios: true });
      ok([...m3.decks.keys()].sort().join("|") === "Sistema Tributário Brasileiro::IPTU|Sistema Tributário Brasileiro::ISS", "P10j sem a pasta do edital: Disciplina::Topico");
      const info2 = new Map(info); info2.set(k("Sistema Tributário Brasileiro", "ISS"), { edital: "ISS Caruaru Auditor", disciplina: "Sistema Tributário Brasileiro", topico: "ISS" });
      const m4 = a.pacMontar(notas, new Set([k("Sistema Tributário Brasileiro", "ISS")]), { comEdital: true, editalDe, info: info2, vazios: true });
      ok(m4.vazios.length === 0 && m4.decks.get("ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS") === 3, "P10k topico com cartao nunca e' 'vazio' (mesmo que o mapa o cite) e a contagem dele nao e' zerada");
      const info3 = new Map(info); info3.set("outra›chave", { edital: "ISS Caruaru Auditor", disciplina: "Sistema Tributário Brasileiro", topico: "ISS" });
      const m4b = a.pacMontar(notas, new Set([k("Sistema Tributário Brasileiro", "ISS"), "outra›chave"]), { comEdital: true, editalDe, info: info3, vazios: true });
      ok(m4b.vazios.length === 0 && m4b.decks.get("ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS") === 3, "P10k2 baralho vazio com o MESMO nome de um que tem cartao nao apaga a contagem nem entra como vazio");
      const m5 = a.pacMontar(notas, sel, { comEdital: true, vazios: true });
      ok([...m5.decks.keys()].every((d) => d.split("::").length === 2), "P10l sem o mapa de editais nada quebra (Disciplina::Topico)");
    }
    /* a tela: arvore por edital, caixas de tres estados, exportar */
    {
      const { a, k, edA } = ME();
      a.pacAbrir();
      a.$("pacSemRep").checked = false;
      ok(a.$("pacOpcEdital").hidden === false && a.$("pacComEdital").checked === true && a.$("pacVazios").checked === false, "P10m com edital cadastrado aparecem as opcoes (pasta do edital ligada, vazios desligado)");
      /* children[0] = seta recolher/expandir (17.49.0), [1] = caixa, [2] = nome (N) */
      const raizes = linhas(a, "pac-ed-raiz").map((e) => e.children[2].textContent.trim());
      ok(raizes.join("|") === "ISS Caruaru Auditor (5)|TCE-PE (2)", "P10n a arvore tem uma raiz por edital, na ordem da lista: " + raizes.join("|"));
      /* children[1] = o span "topico (N)"; children[2] (novo, 17.46.0) e' o caminho no Anki, ver P10o2 */
      const tops = linhas(a, "pac-ed-top").map((e) => e.children[1].textContent.trim());
      ok(tops.indexOf("Taxas (0)") >= 0 && tops.indexOf("Créditos Adicionais (0)") >= 0 && tops.indexOf("ISS (3)") < tops.indexOf("IPTU (0)"), "P10o os topicos do plano aparecem na ordem do edital, tambem os sem cartao: " + tops.join("|"));
      /* 17.46.0 — ao lado de cada topico, o caminho de verdade que ele ocupa no Anki, nao so' o nome da pasta */
      const linhaISS = linhas(a, "pac-ed-top").find((e) => /^ISS \(3\)/.test(e.children[1].textContent.trim()));
      const raizPacote = a.$("pacNome").value;
      ok(linhaISS.children[2].textContent.trim() === raizPacote + " › ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS",
        "P10o2 o caminho mostrado bate com o que pacCaminhoDoNo/pacNomeDeck geram de verdade: " + linhaISS.children[2].textContent);
      /* muda a raiz (digitada) e o "pasta do edital": o caminho ao lado de cada topico acompanha na hora */
      a.$("pacNome").value = "Outra Raiz"; a.$("pacNome").oninput();
      const linhaISS2 = linhas(a, "pac-ed-top").find((e) => /^ISS \(3\)/.test(e.children[1].textContent.trim()));
      ok(linhaISS2.children[2].textContent.trim() === "Outra Raiz › ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS",
        "P10o3 mudar a raiz digitada atualiza o caminho na hora, sem precisar marcar/desmarcar nada: " + linhaISS2.children[2].textContent);
      a.$("pacComEdital").checked = false; a.$("pacComEdital").onchange();
      const linhaISS3 = linhas(a, "pac-ed-top").find((e) => /^ISS \(3\)/.test(e.children[1].textContent.trim()));
      ok(linhaISS3.children[2].textContent.trim() === "Outra Raiz › Sistema Tributário Brasileiro › ISS",
        "P10o4 desligar 'pasta do edital' tira o edital do caminho mostrado tambem: " + linhaISS3.children[2].textContent);
      a.$("pacNome").value = raizPacote; a.$("pacComEdital").checked = true; a.$("pacComEdital").onchange();
      /* marcar o edital A inteiro */
      const rA = linhas(a, "pac-ed-raiz")[0];
      const ckA = achar(rA, (e) => e.tag === "input")[0];
      ok(ckA.checked === false && ckA.indeterminate === false, "P10p (a caixa comeca vazia)");
      ckA.checked = true; ckA.onchange();
      ok(a.pacSelAtual().size === 4 && [...a.pacEditalDeAtual().values()].every((v) => v === "ISS Caruaru Auditor"), "P10q marcar o edital marca TODOS os topicos dele (inclusive os vazios) e guarda de qual edital: " + a.pacSelAtual().size);
      ok(achar(linhas(a, "pac-ed-raiz")[0], (e) => e.tag === "input")[0].checked === true, "P10r a caixa do edital fica marcada");
      /* o topico compartilhado (Receita Publica) marcado sob A vale so' uma vez */
      const rB = linhas(a, "pac-ed-raiz")[1];
      const ckB = achar(rB, (e) => e.tag === "input")[0];
      ok(ckB.indeterminate === true && ckB.checked === false, "P10s edital B: 'Receita Publica' ja marcada (via A) deixa a caixa em estado PARCIAL");
      ckB.checked = true; ckB.onchange();
      ok(a.pacSelAtual().size === 5 && a.pacEditalDeAtual().get(k("Direito Financeiro", "Receita Pública")) === "ISS Caruaru Auditor" && a.pacEditalDeAtual().get(k("Direito Financeiro", "Créditos Adicionais")) === "TCE-PE", "P10t topico compartilhado marcado sob dois editais: fica com o primeiro (sai UMA vez so'), os outros sob o B");
      /* previa e exportacao */
      ok(/notas? em \d+ baralho/.test(a.$("pacPrevia").textContent) && achar(a.$("pacDecks"), (e) => cls(e, "cq-onde")).some((e) => /ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS — 3/.test(e.textContent)), "P10u a previa lista os baralhos com o edital: " + achar(a.$("pacDecks"), (e) => cls(e, "cq-onde")).map((e) => e.textContent).join(" ; "));
      a.$("pacVazios").checked = true; a.$("pacVazios").onchange();
      ok(/vazio\(s\) incluído/.test(a.$("pacPrevia").textContent) && a.$("btnPacApkg").disabled === false, "P10v com 'vazios' a previa conta os baralhos vazios");
      const cap = {};
      const r = await a.pacExportar("apkg", deps(cap));
      ok(r.ok && cap.cards.every((c) => /^(ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS|ISS Caruaru Auditor::Direito Financeiro::Receita Pública)$/.test(c.deck)) && cap.cards.length === 5 && cap.extras.length === 3, "P10w o .apkg sai com os baralhos Edital::Disciplina::Topico e leva os vazios (Taxas, IPTU, Creditos): " + JSON.stringify(cap.extras));
      ok(cap.extras.every((e) => e.split("::").length === 3) && cap.extras.some((e) => /^TCE-PE::Direito Financeiro::Créditos Adicionais$/.test(e)), "P10x cada baralho vazio tem o caminho completo");
      /* o mapa de editais: marcar, desmarcar e marcar de novo sob OUTRO edital */
      const kR = k("Direito Financeiro", "Receita Pública");
      a.$("btnPacLimpar").onclick();
      ok(a.pacEditalDeAtual().size === 0, "P10y0 limpar tambem esquece de que edital era cada topico");
      a.pacMarcar(kR, true, "ISS Caruaru Auditor"); a.pacMarcar(kR, false); a.pacMarcar(kR, true, "TCE-PE");
      ok(a.pacEditalDeAtual().get(kR) === "TCE-PE" && a.pacSelAtual().has(kR), "P10y1 desmarcar esquece o edital: marcar de novo sob outro vale o novo");
      a.pacMarcar(kR, true, "ISS Caruaru Auditor");
      ok(a.pacEditalDeAtual().get(kR) === "TCE-PE", "P10y2 marcar de novo sem desmarcar mantem o primeiro");
      /* marcar UM topico pela caixa dele leva o edital da raiz onde ele esta */
      a.$("btnPacLimpar").onclick();
      const ckCred = achar(linhas(a, "pac-ed-top").find((e) => /Créditos Adicionais/.test(e.textContent)), (e) => e.tag === "input")[0];
      ckCred.checked = true; ckCred.onchange();
      ok(a.pacEditalDeAtual().get(k("Direito Financeiro", "Créditos Adicionais")) === "TCE-PE", "P10y3 marcar um topico pela caixa dele guarda o edital da raiz onde ele esta");
      /* abrir de novo com outra pasta nao herda o mapa da vez anterior */
      a.pacAbrir({ chaves: [kR], edital: "TCE-PE" });
      a.pacAbrir({ chaves: [k("Sistema Tributário Brasileiro", "ISS")], edital: "ISS Caruaru Auditor" });
      ok(a.pacEditalDeAtual().size === 1 && a.pacSelAtual().size === 1 && !a.pacEditalDeAtual().has(kR), "P10y4 abrir de novo comeca do zero (nada sobra da marcacao anterior)");
      a.$("pacSemRep").checked = false;
      a.$("btnPacTudo").onclick();
      a.$("pacVazios").checked = true; a.$("pacVazios").onchange();
      /* sem a pasta do edital */
      a.$("pacComEdital").checked = false; a.$("pacComEdital").onchange();
      const cap2 = {};
      await a.pacExportar("apkg", deps(cap2));
      ok(cap2.cards.every((c) => c.deck.split("::").length === 2) && cap2.extras.every((e) => e.split("::").length === 2), "P10y desligar 'pasta do edital' volta a Disciplina::Topico (cartoes e vazios)");
      /* txt nao leva vazios */
      a.$("pacComEdital").checked = true;
      let txt = "";
      await a.pacExportar("txt", { entregar: async (b) => { txt = new TextDecoder().decode(b); } });
      ok(/ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS/.test(txt) && !/Créditos Adicionais/.test(txt), "P10z o .txt tem os baralhos aninhados com o edital, sem os vazios");
      /* so' vazios */
      a.$("btnPacLimpar").onclick();
      const ck2 = achar(linhas(a, "pac-ed-top").find((e) => /Taxas/.test(e.textContent)), (e) => e.tag === "input")[0];
      ck2.checked = true; ck2.onchange();
      ok(a.$("btnPacApkg").disabled === false && a.$("btnPacTxt").disabled === true && !/Marque ao menos/.test(a.$("pacPrevia").textContent) && /1 baralho\(s\) vazio\(s\) incluído/.test(a.$("pacPrevia").textContent), "P10za so' topicos vazios marcados: o .apkg pode sair (estrutura pronta), o .txt nao, e a previa fala dos vazios: " + a.$("pacPrevia").textContent);
      const cap3 = {};
      ok((await a.pacExportar("txt", { entregar: async () => {} })).ok === false, "P10zaa .txt so' com baralhos vazios nao exporta (nao ha o que escrever)");
      const r3 = await a.pacExportar("apkg", deps(cap3));
      ok(r3.ok && cap3.cards.length === 0 && cap3.extras.length === 1, "P10zb .apkg so' com a estrutura vazia");
      a.$("pacVazios").checked = false; a.$("pacVazios").onchange();
      ok(a.$("btnPacApkg").disabled === true, "P10zc sem 'vazios' nada a exportar: desliga");
      a.$("btnPacTudo").onclick();
      ok(a.pacSelAtual().size === 5 && a.pacEditalDeAtual().get(k("Sistema Tributário Brasileiro", "ISS")) === "ISS Caruaru Auditor", "P10zd 'marcar tudo' marca todos os topicos do plano, cada um sob o edital dele");
    }
    /* sem edital a tela e' a de sempre */
    {
      const { a } = montar();
      a.pacAbrir();
      ok(a.$("pacOpcEdital").hidden === true && linhas(a, "pac-ed-raiz").length === 0 && linhas(a, "pac-disc").length === 2, "P10ze sem edital cadastrado nada muda na tela");
      ok(a.$("pacComEdital").checked === false, "P10zf (e a pasta do edital nao vem ligada)");
    }
    /* importar: o 1o nivel e' o edital */
    {
      ok(JSON.stringify(montar().a.pacSepararDeck("Raiz::ISS Caruaru::Sistema Tributário::ISS::Sub", "Raiz", true)) === JSON.stringify({ edital: "ISS Caruaru", disciplina: "Sistema Tributário", topico: "ISS › Sub" }) && JSON.stringify(montar().a.pacSepararDeck("Raiz::Trib::ISS", "Raiz", true)) === JSON.stringify({ disciplina: "Trib", topico: "ISS" }), "P10zg com edital: o 1o nivel e' o edital; com menos de 3 niveis nada muda");
      const { a, edA, k } = ME();
      const cardsPac = [
        { kind: "basic", front: "Fato gerador? " , back: "Servico", tags: [], deck: "Raiz::ISS Caruaru Auditor::Sistema Tributário Brasileiro::ISS" },
        { kind: "basic", front: "Quem paga? ", back: "Proprietario", tags: [], deck: "Raiz::ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU" },
      ];
      ok(a.pacDetectarEdital(cardsPac) === true && a.pacDetectarEdital([{ front: "P", deck: "Raiz::Trib::ISS" }, { front: "Q", deck: "Raiz::Trib::IPTU" }]) === false && a.pacDetectarEdital([{ front: "P", deck: "Raiz::Outro::Trib::ISS" }, { front: "Q", deck: "Raiz::Outro::Trib::IPTU" }]) === false, "P10zh detecta o pacote que veio com a pasta de um edital CADASTRADO (e so' esse)");
      const r = a.pacImportar(cardsPac, "decks", undefined, true);
      const e1 = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "ISS")], e2 = a.matResumosAtual()[k("Sistema Tributário Brasileiro", "IPTU")];
      ok(r.novos === 2 && r.topicos === 2 && e1.concurso === "ISS Caruaru Auditor" && e1.disciplina === "Sistema Tributário Brasileiro" && e1.topico === "ISS" && e2.concurso === "ISS Caruaru Auditor", "P10zi importar com edital: o topico nasce com o edital dono, a disciplina e o topico certos: " + JSON.stringify({ c: e1 && e1.concurso, d: e1 && e1.disciplina }));
      const r2 = a.pacImportar(cardsPac, "decks", undefined, true);
      ok(r2.novos === 0 && r2.repetidos === 2, "P10zj reimportar nao duplica");
      const outro = [{ kind: "basic", front: "Receita? ", back: "x", tags: [], deck: "ISS Caruaru Auditor::Direito Financeiro::Receita Pública" }, { kind: "basic", front: "Receita 2? ", back: "y", tags: [], deck: "ISS Caruaru Auditor::Direito Financeiro::Receita Pública" }];
      a.pacImportar(outro, "decks", undefined, true);
      ok(a.matResumosAtual()[k("Direito Financeiro", "Receita Pública")].concurso === "TCE-PE" && /Receita 2/.test(a.matResumosAtual()[k("Direito Financeiro", "Receita Pública")].cartoes), "P10zk topico que ja tem dono NAO troca de edital ao importar");
      ok(a.pacDetectarEdital([{ front: "P", deck: "Raiz::ISS Caruaru Auditor::Trib::ISS" }, { front: "Q", deck: "Raiz::Outro::Trib::IPTU" }]) === false, "P10zk0 basta UM baralho fora do padrao para nao ligar sozinho");
      const cCaixa = [{ kind: "basic", front: "Caixa? ", back: "z", tags: [], deck: "iss caruaru auditor::Nova Disciplina::Novo Topico" }];
      a.pacImportar(cCaixa, "decks", undefined, true);
      ok(a.matResumosAtual()[k("Nova Disciplina", "Novo Topico")].concurso === "ISS Caruaru Auditor", "P10zk1 o edital e' gravado com o NOME CADASTRADO (caixa/acento do baralho nao importam)");
      const chavesAntes = Object.keys(a.matResumosAtual()).length;
      const cAcento = [{ kind: "basic", front: "Sem acento? ", back: "z", tags: [], deck: "ISS Caruaru Auditor::Sistema Tributario Brasileiro::ISS" }];
      a.pacImportar(cAcento, "decks", undefined, true);
      ok(Object.keys(a.matResumosAtual()).length === chavesAntes && /Sem acento/.test(a.matResumosAtual()[k("Sistema Tributário Brasileiro", "ISS")].cartoes), "P10zk2 baralho sem acento cai no topico que ja existe (chave viva), sem criar um topico paralelo");
      const sem = a.pacImportar([{ kind: "basic", front: "Livre? ", back: "z", tags: [], deck: "Trib::ISS" }], "decks");
      ok(sem.novos === 1 && a.matResumosAtual()[k("Trib", "ISS")].disciplina === "Trib", "P10zl importar sem a opcao continua igual (Disciplina::Topico)");
      /* a tela de importar */
      a.pacAbrir();
      await a.pacLerArquivo(new Uint8Array([1]), { ler: async () => ({ cards: cardsPac, deck: "Raiz" }) });
      ok(a.$("pacImpComEdital").checked === true && a.$("pacImpEditalCx").hidden === false, "P10zm ao ler um pacote com a pasta do edital a caixa nasce LIGADA");
      const novoPac = [
        { kind: "basic", front: "Tela 1? ", back: "a", tags: [], deck: "Raiz::ISS Caruaru Auditor::Disciplina da Tela::Topico da Tela" },
        { kind: "basic", front: "Tela 2? ", back: "b", tags: [], deck: "Raiz::ISS Caruaru Auditor::Disciplina da Tela::Outro Topico" },
      ];
      await a.pacLerArquivo(new Uint8Array([1]), { ler: async () => ({ cards: novoPac, deck: "Raiz" }) });
      await conduzir(a, a.$("btnPacImportar").onclick());
      const et = a.matResumosAtual()[k("Disciplina da Tela", "Topico da Tela")];
      ok(et && et.concurso === "ISS Caruaru Auditor" && et.disciplina === "Disciplina da Tela", "P10zm2 importar pela tela com a caixa ligada leva o edital: " + JSON.stringify(et && { c: et.concurso, d: et.disciplina }));
      a.pacAbrir();
      await a.pacLerArquivo(new Uint8Array([1]), { ler: async () => ({ cards: cardsPac, deck: "Raiz" }) });
      await a.pacLerArquivo(new Uint8Array([1]), { ler: async () => ({ cards: [{ front: "P", deck: "Raiz::Trib::ISS" }, { front: "Q", deck: "Raiz::Trib::IPTU" }], deck: "Raiz" }) });
      ok(a.$("pacImpComEdital").checked === false, "P10zn e desligada quando o pacote nao e' assim");
    }
    /* explicacao de cada controle da janela */
    {
      const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
      const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
      const ini = html.indexOf('<dialog id="dlgPacote"');
      const dlg = html.slice(ini, html.indexOf("</dialog>", ini));
      const ids = [...dlg.matchAll(/<button[^>]*\bid="(\w+)"/g)].map((m) => m[1]).concat([...dlg.matchAll(/<input type="checkbox"[^>]*\bid="(\w+)"/g)].map((m) => m[1]));
      const { a } = ME();
      const faltam = ids.filter((id) => !a.PAC_DICAS[id]);
      ok(ids.length >= 10 && faltam.length === 0, "P10zo todo botao e opcao do montador tem explicacao (falta: " + faltam.join(",") + ")");
      ok(Object.keys(a.PAC_DICAS).every((id) => dlg.indexOf('id="' + id + '"') >= 0), "P10zp nenhuma explicacao aponta para controle que nao existe");
      const semIdioma = Object.values(a.PAC_DICAS).filter((kk) => i18n.split('"' + kk + '": ').length - 1 < 2 || a.t(kk).length < 20);
      ok(semIdioma.length === 0, "P10zq explicacoes em portugues e ingles: " + semIdioma.join(","));
      a.pacAbrir();
      const mal = Object.keys(a.PAC_DICAS).filter((id) => { const e = a.$(id); return !(e._dicaLigada === true && e._ouv.mouseenter.length === 1 && e.getAttribute("aria-description") === a.t(a.PAC_DICAS[id])); });
      ok(mal.length === 0, "P10zr cada controle recebeu o balao: " + mal.join(","));
    }
    /* ---- P10arr: arrastar um tópico para mudar de disciplina, edital ou juntar
     * com outro (17.47.0) — SÓ NESTA EXPORTAÇÃO: pacMoverPara nunca grava na
     * Biblioteca, some ao reabrir o montador (mesmo padrão visual do arrastar
     * do gerenciador: pilula, destaque verde/vermelho no alvo). ---- */
    {
      const ev = () => ({ prevented: false, preventDefault() { this.prevented = true; }, dataTransfer: { dados: {}, setData(kk, v) { this.dados[kk] = v; }, setDragImage(el) { this.img = el; }, effectAllowed: "", dropEffect: "" } });
      const { a, k } = ME();
      a.pacAbrir();
      const issCh = k("Sistema Tributário Brasileiro", "ISS");
      const acharTop = (nome) => linhas(a, "pac-ed-top").find((e) => new RegExp("^" + nome + " \\(").test(e.children[1].textContent.trim()));

      /* toda linha arrastavel, todo alvo aceita soltar */
      {
        const tops = linhas(a, "pac-ed-top");
        ok(tops.length > 0 && tops.every((e) => e.draggable === true && typeof e.ondragstart === "function"), "P10arr1 todo topico da arvore por edital e' arrastavel");
        ok(linhas(a, "pac-ed-disc").every((e) => typeof e.ondragover === "function" && typeof e.ondrop === "function")
          && linhas(a, "pac-ed-raiz").every((e) => typeof e.ondragover === "function" && typeof e.ondrop === "function"),
          "P10arr2 disciplina e raiz (edital) aceitam soltar");
      }
      /* sobre a PROPRIA pasta: invalido; sobre outra: valido */
      {
        const iss = acharTop("ISS");
        const e1 = ev(); iss.ondragstart(e1);
        ok(/ISS/.test(e1.dataTransfer.dados["text/plain"]) && e1.dataTransfer.img && /ISS/.test(e1.dataTransfer.img.textContent), "P10arr3 a pilula 'movendo ISS' acompanha o ponteiro");
        const ep = ev(); iss.ondragover(ep);
        ok(ep.prevented === false && cls(iss, "pac-alvo-no") && !cls(iss, "pac-alvo") && ep.dataTransfer.dropEffect === "none", "P10arr4 sobre a PROPRIA pasta nao permite soltar");
        const iptu = acharTop("IPTU");
        const eo = ev(); iptu.ondragover(eo);
        ok(eo.prevented === true && cls(iptu, "pac-alvo") && eo.dataTransfer.dropEffect === "move", "P10arr5 sobre outro topico: permite soltar e destaca");
        iptu.ondragleave();
        ok(!cls(iptu, "pac-alvo"), "P10arr6 sair do alvo tira o destaque");
        iss.ondragend();
        ok(a.pacArrastoAtual() === null, "P10arr7 soltar fora (dragend) limpa o arrasto");
      }
      /* soltar ISS sobre a PROPRIA pasta (nao so' passar por cima): nao cria arrasto nenhum */
      {
        const iss = acharTop("ISS"); iss.ondragstart(ev());
        iss.ondrop(ev());
        ok(!a.pacMoverParaAtual().has(issCh), "P10arr7b soltar um topico sobre ele mesmo nao vira um arrasto (seria um no-op)");
      }
      /* soltar ISS sobre IPTU: mescla (ISS passa a ir para o MESMO baralho de IPTU) */
      {
        const iss = acharTop("ISS"); iss.ondragstart(ev());
        const iptu = acharTop("IPTU");
        iptu.ondrop(ev());
        ok(a.pacArrastoAtual() === null, "P10arr8 soltar limpa o arrasto");
        const mov = a.pacMoverParaAtual().get(issCh);
        ok(mov && mov.disciplina === "Sistema Tributário Brasileiro" && mov.topico === "IPTU" && mov.edital === "ISS Caruaru Auditor", "P10arr9 ISS passa a ir para o baralho de IPTU (mesma disciplina/edital, topico de IPTU): " + JSON.stringify(mov));
        const issDepois = acharTop("ISS");
        ok(cls(issDepois.children[2], "pac-caminho-movido") && / › IPTU$/.test(issDepois.children[2].textContent.trim()), "P10arr10 o caminho ao lado de ISS mostra o destino novo, marcado: " + issDepois.children[2].textContent);
        ok(achar(issDepois, (e) => cls(e, "pac-desfazer-mov")).length === 1, "P10arr11 aparece 'desfazer' so' na linha que foi movida");
        const m = a.pacMontar(a.pacNotasAtual(), new Set([issCh]), { semRepetidos: false, semFracos: false, comEdital: true, comRamos: true, editalDe: new Map(), info: new Map(), moverPara: a.pacMoverParaAtual() });
        ok([...m.decks.keys()].join("|") === "ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU", "P10arr11b o resumo de baralhos (pacMontar) tambem usa o destino do arrasto, nao o baralho original: " + [...m.decks.keys()].join("|"));
      }
      /* desfazer so' esta (o botao da propria linha) */
      {
        const issAntes = acharTop("ISS");
        const des = achar(issAntes, (e) => cls(e, "pac-desfazer-mov"))[0];
        des.onclick({ preventDefault() {}, stopPropagation() {} });
        ok(!a.pacMoverParaAtual().has(issCh), "P10arr12 'desfazer' tira so' este topico do mapa de arrastos");
        const issDepois = acharTop("ISS");
        ok(!cls(issDepois.children[2], "pac-caminho-movido") && / › ISS$/.test(issDepois.children[2].textContent.trim()), "P10arr13 o caminho volta a mostrar o lugar de origem");
        ok(achar(issDepois, (e) => cls(e, "pac-desfazer-mov")).length === 0, "P10arr14 o botao 'desfazer' some da linha depois de usado");
      }
      /* soltar ISS sobre a disciplina 'Direito Financeiro' (mesmo edital A): muda so' a disciplina */
      {
        const iss = acharTop("ISS"); iss.ondragstart(ev());
        const discFinA = linhas(a, "pac-ed-disc")[1]; /* raiz A: [0]=Sistema Tributario, [1]=Direito Financeiro */
        ok(/Direito Financeiro/.test(discFinA.textContent), "P10arr15 (achou a disciplina certa: " + discFinA.textContent + ")");
        const eo = ev(); discFinA.ondragover(eo);
        ok(eo.prevented === true && cls(discFinA, "pac-alvo"), "P10arr16 disciplina diferente e' alvo valido");
        discFinA.ondrop(ev());
        const mov = a.pacMoverParaAtual().get(issCh);
        ok(mov && mov.disciplina === "Direito Financeiro" && mov.topico === "ISS" && mov.edital === "ISS Caruaru Auditor", "P10arr17 ISS muda de disciplina, mantendo o proprio nome: " + JSON.stringify(mov));
      }
      /* arrastar de novo (ja' movido) e soltar no edital B: muda so' o dono, preserva a disciplina/topico ATUAIS */
      {
        const iss = acharTop("ISS"); iss.ondragstart(ev());
        const raizB = linhas(a, "pac-ed-raiz")[1];
        ok(/TCE-PE/.test(raizB.textContent), "P10arr18 (achou a raiz B: " + raizB.textContent + ")");
        raizB.ondrop(ev());
        const mov = a.pacMoverParaAtual().get(issCh);
        ok(mov && mov.edital === "TCE-PE" && mov.disciplina === "Direito Financeiro" && mov.topico === "ISS", "P10arr19 trocar de edital preserva a disciplina/topico ja' movidos (os arrastos se somam): " + JSON.stringify(mov));
      }
      /* soltar sobre o lugar onde ja' esta' (no-op): nao muda nada */
      {
        const iss = acharTop("ISS"); iss.ondragstart(ev());
        const raizB = linhas(a, "pac-ed-raiz")[1];
        const eo = ev(); raizB.ondragover(eo);
        ok(eo.prevented === false && cls(raizB, "pac-alvo-no"), "P10arr20 soltar no MESMO edital onde ja' esta' e' invalido (nada mudaria)");
        iss.ondragend();
      }
      /* "desfazer movimentos": aparece so' quando ha' arrasto pendente, e desfaz TODOS de uma vez */
      {
        ok(a.$("btnPacDesfazerMovs").hidden === false, "P10arr21 com arrastos pendentes o botao 'desfazer movimentos' aparece");
        a.$("btnPacDesfazerMovs").onclick();
        ok(a.pacMoverParaAtual().size === 0 && a.$("btnPacDesfazerMovs").hidden === true, "P10arr22 desfaz TODOS os arrastos e volta a esconder o botao");
        const issDepois = acharTop("ISS");
        ok(/ › ISS$/.test(issDepois.children[2].textContent.trim()), "P10arr23 ISS volta ao proprio lugar depois de desfazer tudo");
      }
      /* o arrasto muda de verdade o .apkg exportado — nao e' so' visual */
      {
        const iss = acharTop("ISS"); iss.ondragstart(ev());
        const iptu = acharTop("IPTU"); iptu.ondrop(ev());
        a.pacSelTeste([issCh]);
        a.$("pacSemRep").checked = false; /* os 3 cartoes de ISS sao parecidos o bastante para o radar de repeticao agrupar; aqui o que importa e' o baralho, nao a deduplicacao */
        const cap = {};
        await a.pacExportar("apkg", deps(cap));
        ok(cap.cards.length === 3 && cap.cards.every((c) => c.deck === "ISS Caruaru Auditor::Sistema Tributário Brasileiro::IPTU"), "P10arr24 o .apkg exportado leva o baralho movido, nao o original: " + JSON.stringify(cap.cards.map((c) => c.deck)));
      }
      /* reabrir o montador esquece TODOS os arrastos: e' so' desta exportacao */
      {
        a.pacAbrir();
        ok(a.pacMoverParaAtual().size === 0, "P10arr25 abrir de novo comeca sem nenhum arrasto guardado");
      }
    }
    /* ---- P10mov: "mover os marcados para" — o mesmo destino do arrastar (Fase 2), so' que
     * aplicado a TODOS os topicos marcados de uma vez (Fase 3, 17.48.0). Existe porque
     * arrastar um a um nao escala para muitos marcados, e em tela de toque nao da' para
     * arrastar (o gerenciador resolve o mesmo problema do mesmo jeito, com "Mover para…"). ---- */
    {
      const { a, k } = ME();
      a.pacAbrir();
      const issCh = k("Sistema Tributário Brasileiro", "ISS");
      const taxasCh = k("Sistema Tributário Brasileiro", "Taxas");
      const iptuCh = k("Sistema Tributário Brasileiro", "IPTU");

      /* a lista de destinos: raiz (edital), disciplina e topico, com o caminho completo no nome */
      {
        const l = a.pacDestinosLista();
        ok(l.some((d) => d.tipo === "raiz" && d.edital === "ISS Caruaru Auditor" && d.nome === "ISS Caruaru Auditor"), "P10mov1 a lista tem o edital como destino (tipo raiz)");
        ok(l.some((d) => d.tipo === "disc" && d.disciplina === "Direito Financeiro" && d.edital === "ISS Caruaru Auditor" && d.nome === "ISS Caruaru Auditor › Direito Financeiro"), "P10mov2 a lista tem a disciplina como destino, com o caminho completo");
        const top = l.find((d) => d.tipo === "top" && d.chave === iptuCh && d.edital === "ISS Caruaru Auditor");
        ok(top && top.nome === "ISS Caruaru Auditor › Sistema Tributário Brasileiro › IPTU" && top.disciplina === "Sistema Tributário Brasileiro" && top.topico === "IPTU", "P10mov3 a lista tem o topico como destino (mescla), com a chave para o auto-soltar nao contar: " + JSON.stringify(top));
        ok(!l.some((d) => d.tipo === "bancada" || d.nome === "Bancada"), "P10mov4 a bancada nao entra como destino (nao e' uma pasta do edital)");
      }
      /* com cartao na bancada (raiz "Bancada" existe na arvore), ela continua de fora dos destinos */
      {
        a.$("editor").value = "Pergunta da bancada? :: Resposta";
        a.pacAbrir();
        ok(linhas(a, "pac-ed-raiz").some((e) => /^Bancada/.test(e.children[2].textContent.trim())), "P10mov4b (confirma que a bancada aparece na ARVORE desta vez, para o teste valer)");
        const l = a.pacDestinosLista();
        ok(!l.some((d) => d.tipo === "bancada" || /^Bancada/.test(d.nome)), "P10mov4c mesmo com cartao na bancada, ela nao entra na lista de destinos");
        a.$("editor").value = "";
        a.pacAbrir();
      }
      /* a caixa de mover: desligada sem nada marcado, liga ao marcar */
      {
        ok(a.$("pacMoverSel").disabled === true && a.$("btnPacMoverMarcados").disabled === true, "P10mov5 sem nada marcado a caixa de mover fica desligada");
        a.pacMarcar(issCh, true, "ISS Caruaru Auditor"); a.pacMarcar(taxasCh, true, "ISS Caruaru Auditor"); a.pacPintar();
        ok(a.$("pacMoverSel").disabled === false && a.$("btnPacMoverMarcados").disabled === false, "P10mov6 com algo marcado a caixa liga");
      }
      /* mover ISS e Taxas (marcados) para dentro do topico IPTU: os dois passam a ir para o baralho de IPTU */
      {
        const idx = a.pacDestinosCacheAtual().findIndex((d) => d.tipo === "top" && d.chave === iptuCh);
        a.$("pacMoverSel").selectedIndex = idx;
        a.$("btnPacMoverMarcados").onclick();
        const movISS = a.pacMoverParaAtual().get(issCh), movTax = a.pacMoverParaAtual().get(taxasCh);
        ok(movISS && movISS.topico === "IPTU" && movISS.disciplina === "Sistema Tributário Brasileiro" && movISS.edital === "ISS Caruaru Auditor", "P10mov7 ISS vai para o baralho de IPTU: " + JSON.stringify(movISS));
        ok(movTax && movTax.topico === "IPTU" && movTax.disciplina === "Sistema Tributário Brasileiro", "P10mov8 Taxas TAMBEM vai (o destino se aplica a TODOS os marcados de uma vez): " + JSON.stringify(movTax));
        ok(/2 tópico\(s\) movido\(s\) para/.test(a.$("pacMsg").textContent) && /IPTU/.test(a.$("pacMsg").textContent), "P10mov9 a mensagem confirma quantos foram movidos e para onde: " + a.$("pacMsg").textContent);
      }
      /* soltar sobre o proprio destino (marcar IPTU junto) nao cria um arrasto sem sentido para ele */
      {
        a.$("btnPacDesfazerMovs").onclick();
        a.pacMarcar(iptuCh, true, "ISS Caruaru Auditor"); a.pacPintar();
        const idx = a.pacDestinosCacheAtual().findIndex((d) => d.tipo === "top" && d.chave === iptuCh);
        a.$("pacMoverSel").selectedIndex = idx;
        a.$("btnPacMoverMarcados").onclick();
        ok(!a.pacMoverParaAtual().has(iptuCh) && a.pacMoverParaAtual().has(issCh) && a.pacMoverParaAtual().has(taxasCh), "P10mov10 IPTU marcado junto e' o proprio destino: fica de fora (so' os outros dois se movem)");
        ok(/2 tópico\(s\) movido\(s\)/.test(a.$("pacMsg").textContent), "P10mov11 a contagem da mensagem exclui quem ja' estava no destino");
      }
      /* mover para uma DISCIPLINA (nao um topico): so' a disciplina muda, cada um mantem o proprio nome */
      {
        a.$("btnPacDesfazerMovs").onclick();
        const idxD = a.pacDestinosCacheAtual().findIndex((d) => d.tipo === "disc" && d.disciplina === "Direito Financeiro" && d.edital === "ISS Caruaru Auditor");
        a.$("pacMoverSel").selectedIndex = idxD;
        a.$("btnPacMoverMarcados").onclick();
        const movISS = a.pacMoverParaAtual().get(issCh), movTax = a.pacMoverParaAtual().get(taxasCh);
        ok(movISS.disciplina === "Direito Financeiro" && movISS.topico === "ISS" && movTax.disciplina === "Direito Financeiro" && movTax.topico === "Taxas", "P10mov12 disciplina como destino: cada um muda de disciplina mas mantem o proprio nome de topico: " + JSON.stringify([movISS, movTax]));
      }
      /* mover para um EDITAL (raiz): so' o dono muda */
      {
        a.$("btnPacDesfazerMovs").onclick();
        const idxR = a.pacDestinosCacheAtual().findIndex((d) => d.tipo === "raiz" && d.edital === "TCE-PE");
        a.$("pacMoverSel").selectedIndex = idxR;
        a.$("btnPacMoverMarcados").onclick();
        const movISS = a.pacMoverParaAtual().get(issCh);
        ok(movISS.edital === "TCE-PE" && movISS.disciplina === "Sistema Tributário Brasileiro" && movISS.topico === "ISS", "P10mov13 edital como destino: so' o dono muda, disciplina/topico continuam os proprios: " + JSON.stringify(movISS));
      }
      /* sem editais cadastrados: a lista tem so' disciplina e topico, nunca raiz */
      {
        const { a: a2, iss } = montar();
        a2.pacAbrir();
        const l2 = a2.pacDestinosLista();
        ok(l2.length > 0 && l2.every((d) => d.tipo !== "raiz") && l2.some((d) => d.tipo === "top" && d.chave === iss), "P10mov14 sem edital cadastrado a lista nao tem raiz, so' disciplina e topico");
      }
    }
    /* ---- P10fec: recolher/expandir edital e disciplina — so' visual (Fase 4, 17.49.0) ---- */
    {
      const { a, k } = ME();
      a.pacAbrir();
      /* por edital: recolher a raiz A esconde as disciplinas/topicos dela (a raiz B continua aberta), sem desmarcar nada */
      {
        const topsAntes = linhas(a, "pac-ed-top").length, discsAntes = linhas(a, "pac-ed-disc").length;
        ok(topsAntes > 0 && discsAntes > 0, "P10fec1 (a arvore comeca com topicos e disciplinas, para o teste valer)");
        const rA = linhas(a, "pac-ed-raiz")[0];
        ok(rA.children[0].textContent === "▾", "P10fec2 a seta comeca expandida (▾)");
        rA.children[0].onclick({ preventDefault() {}, stopPropagation() {} });
        const rA2 = linhas(a, "pac-ed-raiz")[0];
        ok(rA2.children[0].textContent === "▸", "P10fec3 clicar na seta vira ▸ (recolhida)");
        /* raiz A tem 2 disciplinas (Sistema Tributario, Direito Financeiro) e 4 topicos (ISS, IPTU, Taxas, Receita Publica) */
        ok(linhas(a, "pac-ed-disc").length === discsAntes - 2 && linhas(a, "pac-ed-top").length === topsAntes - 4, "P10fec4 recolhida, a raiz A some com as PROPRIAS disciplinas e topicos (a raiz B continua): " + linhas(a, "pac-ed-disc").length + "/" + linhas(a, "pac-ed-top").length);
        ok(linhas(a, "pac-ed-raiz").length === 2, "P10fec4b as duas raizes continuam na tela (so' os FILHOS da A sumiram)");
        ok(rA2.children[2].textContent.trim() === "ISS Caruaru Auditor (5)", "P10fec5 mesmo recolhida, a contagem '(N)' continua no cabecalho");
        ok(a.pacSelAtual().size === 0 && a.pacMoverParaAtual().size === 0, "P10fec6 recolher e' so' visual: nao marca nem desmarca, nao mexe em arrasto");
      }
      /* expandir de novo devolve tudo */
      {
        const rA = linhas(a, "pac-ed-raiz")[0];
        rA.children[0].onclick({ preventDefault() {}, stopPropagation() {} });
        const rA2 = linhas(a, "pac-ed-raiz")[0];
        ok(rA2.children[0].textContent === "▾" && linhas(a, "pac-ed-top").length > 0, "P10fec7 clicar de novo expande e volta a desenhar os topicos");
      }
      /* recolher so' uma disciplina nao mexe nas outras (nem na outra raiz) */
      {
        const discFinA = linhas(a, "pac-ed-disc")[1]; /* raiz A: [0]=Sistema Tributario, [1]=Direito Financeiro */
        ok(/Direito Financeiro/.test(discFinA.children[2].textContent), "P10fec8 (achou 'Direito Financeiro' da raiz A)");
        const totalAntes = linhas(a, "pac-ed-top").length;
        discFinA.children[0].onclick({ preventDefault() {}, stopPropagation() {} });
        const totalDepois = linhas(a, "pac-ed-top").length;
        ok(totalDepois === totalAntes - 1 && linhas(a, "pac-ed-disc").length === 3, "P10fec9 recolher 'Direito Financeiro' some so' com o topico dela (Receita Publica), as outras disciplinas continuam abertas: " + totalAntes + "->" + totalDepois);
      }
      /* reabrir o dialogo esquece os recolhidos (comeca tudo aberto de novo) */
      {
        a.pacAbrir();
        ok(linhas(a, "pac-ed-raiz").every((e) => e.children[0].textContent === "▾") && linhas(a, "pac-ed-disc").every((e) => e.children[0].textContent === "▾"), "P10fec10 reabrir o montador comeca com tudo expandido de novo");
      }
      /* sem editais cadastrados: recolher a disciplina esconde os topicos dela (o outro fallback da arvore) */
      {
        const { a: a2 } = montar();
        a2.pacAbrir();
        const discs = linhas(a2, "pac-disc").filter((e) => !cls(e, "pac-top"));
        const alvo = discs.find((e) => /Trib/.test(e.children[2].textContent));
        ok(!!alvo, "P10fec11 (achou a disciplina 'Trib' sem edital cadastrado)");
        const topsAntes = linhas(a2, "pac-top").length;
        alvo.children[0].onclick({ preventDefault() {}, stopPropagation() {} });
        ok(linhas(a2, "pac-top").length < topsAntes, "P10fec12 sem edital cadastrado, recolher a disciplina tambem esconde os topicos dela");
      }
    }
    /* ---- P10lis: lista de cartões da pasta clicada, sempre visível ao lado da árvore (Fase 5, 17.50.0) ---- */
    {
      const fakeEv = () => ({ preventDefault() {}, stopPropagation() {} });
      const { a, iss, iptu } = montar();
      a.pacAbrir();
      /* nada selecionado ainda: a lista mostra o convite a clicar */
      {
        ok(a.pacPastaAtual() === null, "P10lis1 a lista comeca sem pasta selecionada");
        ok(/clique numa pasta/i.test(a.$("pacListaCartoes").textContent), "P10lis2 o convite a clicar aparece na lista vazia: " + a.$("pacListaCartoes").textContent);
      }
      /* clicar num topico (o texto, nao a caixa) mostra so' os cartoes dele, sem marcar */
      {
        const linhaIss = linhas(a, "pac-top").find((e) => /^ISS \(/.test(e.children[1].textContent.trim()));
        linhaIss.onclick(fakeEv());
        ok(a.pacPastaAtual() && a.pacPastaAtual().chaves.has(iss), "P10lis3 clicar no topico ISS escolhe a pasta dele");
        ok(a.pacSelAtual().size === 0, "P10lis4 clicar para VER nao marca a caixa (a marcacao continua so' na caixinha)");
        const linhasCartao = achar(a.$("pacListaCartoes"), (e) => cls(e, "ger-item"));
        ok(linhasCartao.length === 2, "P10lis5 duas linhas de cartao na lista (ISS tem 2 cartoes no fixture): " + linhasCartao.length);
        ok(linhasCartao.some((e) => /fato gerador do ISS/i.test(e.textContent)), "P10lis6 a frente do cartao aparece na linha da lista: " + linhasCartao.map((e) => e.textContent).join(" | "));
      }
      /* clicar na CAIXA nao muda a pasta ativa da lista (so' marca/desmarca) */
      {
        const linhaIptu = linhas(a, "pac-top").find((e) => /^IPTU \(/.test(e.children[1].textContent.trim()));
        const ckIptu = achar(linhaIptu, (e) => e.tag === "input")[0];
        const espiao = { calls: 0, stopPropagation() { this.calls++; } };
        ckIptu.onclick(espiao);
        ok(espiao.calls === 1, "P10lis7 clicar na CAIXA impede que o clique suba ate' a linha e troque a pasta ativa (stopPropagation)");
        ckIptu.checked = true; ckIptu.onchange();
        ok(a.pacPastaAtual().chaves.has(iss) && !a.pacPastaAtual().chaves.has(iptu), "P10lis8 marcar a caixa do IPTU nao troca a pasta ativa (a lista continua mostrando ISS)");
        ok(a.pacSelAtual().has(iptu), "P10lis8b (a marcacao em si funcionou normalmente)");
      }
      /* clicar numa DISCIPLINA mostra os cartoes de TODOS os topicos dela */
      {
        const discTrib = achar(a.$("pacArvore"), (e) => cls(e, "pac-disc") && !cls(e, "pac-top")).find((e) => /Trib/.test(e.children[2].textContent));
        discTrib.onclick(fakeEv());
        ok(a.pacPastaAtual().chaves.has(iss) && a.pacPastaAtual().chaves.has(iptu), "P10lis9 clicar na disciplina 'Trib' mostra os cartoes de ISS E IPTU juntos");
        const linhasCartao = achar(a.$("pacListaCartoes"), (e) => cls(e, "ger-item"));
        ok(linhasCartao.length === 4, "P10lis10 4 cartoes (2 de ISS + 2 de IPTU) na lista: " + linhasCartao.length);
      }
      /* topico sem cartao (vazio): a lista avisa, nao quebra */
      {
        a.pacClicarPasta(["disciplina-fantasma›topico-fantasma"]);
        ok(/ainda n.o tem cart/i.test(a.$("pacListaCartoes").textContent), "P10lis11 pasta sem cartao mostra aviso, nao quebra: " + a.$("pacListaCartoes").textContent);
      }
      /* reabrir o dialogo esquece a pasta ativa (a lista volta ao convite) */
      {
        a.pacAbrir();
        ok(a.pacPastaAtual() === null, "P10lis12 reabrir o montador esquece a pasta ativa da lista");
      }
      /* pastas grandes: a lista tem um limite (nao desenha centenas de linhas de uma vez) */
      {
        const { a: a2 } = montar();
        const cs = Array.from({ length: 70 }, (_, i) => "Pergunta " + i + "? :: Resposta " + i).join("\n");
        a2.$("editor").value = cs;
        a2.pacAbrir();
        a2.pacClicarPasta([a2.CQ_BANCADA]);
        const linhasCartao = achar(a2.$("pacListaCartoes"), (e) => cls(e, "ger-item"));
        ok(linhasCartao.length === 60, "P10lis13 a lista para no limite (60), mesmo com 70 cartoes na pasta: " + linhasCartao.length);
        ok(/mais 10 cart/i.test(a2.$("pacListaCartoes").textContent), "P10lis14 avisa quantos ficaram de fora: " + a2.$("pacListaCartoes").textContent);
      }
    }
    /* ---- P10cav: arrastar um cartão avulso da lista, separado dos irmãos do tópico (Fase 6, 17.51.0) ---- */
    {
      const fakeEv = () => ({ preventDefault() {}, stopPropagation() {}, dataTransfer: { effectAllowed: "", setData() {}, setDragImage() {}, dropEffect: "" } });
      const acharTop = (a, nome) => linhas(a, "pac-top").find((e) => new RegExp("^" + nome + " \\(").test(e.children[1].textContent.trim()));
      const acharCartao = (a, re) => achar(a.$("pacListaCartoes"), (e) => cls(e, "ger-item")).find((e) => re.test(e.textContent));
      const { a, iss, iptu } = montar();
      a.pacAbrir();
      a.pacClicarPasta([iss]);
      /* toda linha da lista e' arrastavel */
      {
        const linhasCard = achar(a.$("pacListaCartoes"), (e) => cls(e, "ger-item"));
        ok(linhasCard.length === 2 && linhasCard.every((e) => e.draggable === true && typeof e.ondragstart === "function"), "P10cav1 toda linha da lista de cartoes e' arrastavel");
      }
      /* arrastar UM cartao (o da aliquota) e soltar sobre o topico IPTU: so' ele muda */
      {
        const linhaAliquota = acharCartao(a, /al.quota/i);
        ok(!!linhaAliquota, "P10cav2 (achou a linha do cartao da aliquota)");
        linhaAliquota.ondragstart(fakeEv());
        ok(a.pacArrastoAtual() && a.pacArrastoAtual().tipo === "cartao", "P10cav3 o arrasto guarda o tipo 'cartao'");
        acharTop(a, "IPTU").ondrop(fakeEv());
        ok(a.pacArrastoAtual() === null, "P10cav4 soltar limpa o arrasto");
        ok(a.pacCartaoMoverParaAtual().size === 1, "P10cav5 so' UM cartao ganhou arrasto (nao o topico inteiro): " + a.pacCartaoMoverParaAtual().size);
        ok(a.pacMoverParaAtual().size === 0, "P10cav6 o topico ISS em si NAO foi movido (so' o cartao avulso)");
      }
      /* a lista mostra o cartao movido com caminho e desfazer; o outro cartao de ISS continua normal */
      {
        const linhaAliquota2 = acharCartao(a, /al.quota/i), linhaFato2 = acharCartao(a, /fato gerador/i);
        const marcaAliquota = achar(linhaAliquota2, (e) => cls(e, "pac-caminho-movido"));
        ok(marcaAliquota.length === 1 && /IPTU$/.test(marcaAliquota[0].textContent.trim()), "P10cav7 o cartao movido mostra o caminho novo, terminando em IPTU: " + (marcaAliquota[0] && marcaAliquota[0].textContent));
        ok(achar(linhaFato2, (e) => cls(e, "pac-caminho-movido")).length === 0, "P10cav8 o OUTRO cartao de ISS (fato gerador) continua sem marca nenhuma");
      }
      /* desfazer so' este cartao */
      {
        const linhaAliquota3 = acharCartao(a, /al.quota/i);
        const des = achar(linhaAliquota3, (e) => cls(e, "pac-desfazer-mov"))[0];
        des.onclick({ preventDefault() {}, stopPropagation() {} });
        ok(a.pacCartaoMoverParaAtual().size === 0, "P10cav9 'desfazer' tira o arrasto deste cartao");
      }
      /* soltar sobre o PROPRIO lugar (sem nenhum arrasto de topico): invalido, nao cria arrasto vazio */
      {
        const linhaAliquota4 = acharCartao(a, /al.quota/i);
        linhaAliquota4.ondragstart(fakeEv());
        const linhaIss = acharTop(a, "ISS");
        const eo = fakeEv();
        linhaIss.ondragover(eo);
        ok(cls(linhaIss, "pac-alvo-no") && !cls(linhaIss, "pac-alvo"), "P10cav10 soltar o cartao sobre o PROPRIO topico e' invalido");
        linhaIss.ondrop(fakeEv());
        ok(a.pacCartaoMoverParaAtual().size === 0, "P10cav11 soltar no proprio lugar nao cria um arrasto vazio");
      }
      /* o cartao avulso HERDA a posicao atual do topico, se o topico inteiro ja foi movido */
      {
        const { a: a3, iss: iss3 } = montar();
        a3.pacAbrir();
        a3.pacClicarPasta([iss3]);
        acharTop(a3, "ISS").ondragstart(fakeEv());
        acharTop(a3, "IPTU").ondrop(fakeEv());
        ok(a3.pacMoverParaAtual().get(iss3).topico === "IPTU", "P10cav12 (confirma: o topico ISS inteiro foi movido para IPTU)");
        a3.pacClicarPasta([iss3]);
        const linhaFato3 = acharCartao(a3, /fato gerador/i);
        linhaFato3.ondragstart(fakeEv());
        ok(a3.pacArrastoAtual().topico === "IPTU" && a3.pacArrastoAtual().disciplina === "Trib", "P10cav13 o cartao avulso herda a posicao ATUAL do topico (ja movido), nao a original: " + JSON.stringify(a3.pacArrastoAtual()));
      }
      /* prioridade cartao > topico: se os dois tem arrasto, o cartao vence na exportacao */
      {
        const { a: a4, iss: iss4 } = montar();
        a4.pacAbrir();
        a4.pacClicarPasta([iss4]);
        acharTop(a4, "ISS").ondragstart(fakeEv());
        acharTop(a4, "IPTU").ondrop(fakeEv());
        a4.pacClicarPasta([iss4]);
        const linhaFato4 = acharCartao(a4, /fato gerador/i);
        linhaFato4.ondragstart(fakeEv());
        const linhaPri4 = acharTop(a4, "Princípios");
        ok(!!linhaPri4, "P10cav14 (achou o topico Principios)");
        linhaPri4.ondrop(fakeEv());
        ok(a4.pacCartaoMoverParaAtual().size === 1, "P10cav15 o cartao ganhou seu PROPRIO arrasto, diferente do topico");
        a4.pacSelTeste([iss4]);
        a4.$("pacSemRep").checked = false;
        const cap4 = {};
        await a4.pacExportar("apkg", deps(cap4));
        const deckDoFato = cap4.cards.find((c) => /fato gerador/i.test(c.front)).deck;
        const deckDaAliquota = cap4.cards.find((c) => /al.quota/i.test(c.front)).deck;
        ok(deckDoFato === "Const::Princípios", "P10cav16 o cartao com arrasto proprio vai para o SEU destino: " + deckDoFato);
        ok(deckDaAliquota === "Trib::IPTU", "P10cav17 o OUTRO cartao do mesmo topico (sem arrasto proprio) continua herdando o destino do TOPICO: " + deckDaAliquota);
      }
      /* "desfazer movimentos" (geral) limpa TAMBEM os arrastos de cartao avulso */
      {
        const { a: a5, iss: iss5 } = montar();
        a5.pacAbrir();
        a5.pacClicarPasta([iss5]);
        acharCartao(a5, /fato gerador/i).ondragstart(fakeEv());
        acharTop(a5, "IPTU").ondrop(fakeEv());
        ok(a5.pacCartaoMoverParaAtual().size === 1, "P10cav18 (o cartao ganhou um arrasto, para o teste valer)");
        a5.$("btnPacDesfazerMovs").onclick();
        ok(a5.pacCartaoMoverParaAtual().size === 0, "P10cav19 'desfazer movimentos' geral tambem limpa os arrastos de cartao avulso");
      }
      /* reabrir o dialogo esquece os arrastos de cartao avulso */
      {
        const { a: a6, iss: iss6 } = montar();
        a6.pacAbrir();
        a6.pacClicarPasta([iss6]);
        acharCartao(a6, /fato gerador/i).ondragstart(fakeEv());
        acharTop(a6, "IPTU").ondrop(fakeEv());
        a6.pacAbrir();
        ok(a6.pacCartaoMoverParaAtual().size === 0, "P10cav20 reabrir o montador esquece os arrastos de cartao avulso tambem");
      }
    }
    /* ---- P11: a raiz digitada por dentro, sem ser um palpite de outra tela ----
     * O CASO REAL: "Nome do baralho raiz" vinha do campo de nome do gerador de
     * cartao avulso, sem relacao nenhuma com o que estava sendo exportado —
     * a pessoa tinha de digitar a raiz a mao toda vez ("Sistema tríbutário ISS
     * Caruaru", com erro de digitacao e repetindo o que "pasta do edital" ja
     * ia acrescentar sozinho). E a previa nunca mostrava a raiz, entao a
     * duplicacao so' aparecia depois, dentro do Anki. */
    {
      const { a, k } = ME();
      /* "exportar esta pasta" de UM edital: a raiz vem pronta com o nome do
       * concurso, e "pasta do edital" nasce DESLIGADA (o concurso ja' esta'
       * na raiz — ligar de novo duplicaria a pasta) */
      a.pacAbrir({ chaves: [k("Sistema Tributário Brasileiro", "ISS")], edital: "ISS Caruaru Auditor" });
      ok(a.$("pacNome").value === "ISS Caruaru Auditor",
         "P11 a raiz nao veio pronta com o nome do concurso: " + a.$("pacNome").value);
      ok(a.$("pacComEdital").checked === false,
         "P11a com a raiz ja' sendo o concurso, 'pasta do edital' nao pode nascer ligada (duplicaria a pasta)");
      const cap = {};
      await a.pacExportar("apkg", deps(cap));
      ok(cap.cards.every((c) => c.deck === "Sistema Tributário Brasileiro::ISS"),
         "P11b sem 'pasta do edital' o baralho e' Disciplina::Topico (a raiz so' entra na hora de escrever o arquivo): "
         + JSON.stringify(cap.cards.map((c) => c.deck)));
      ok(cap.raiz === "ISS Caruaru Auditor", "P11c o arquivo recebeu a raiz certa");

      /* sem "exportar esta pasta" (o botao geral "montar pacote"), nada muda:
       * a raiz continua vindo de onde vinha */
      a.pacAbrir();
      ok(a.$("pacNome").value !== "ISS Caruaru Auditor",
         "P11d sem edital unico marcado, a raiz nao pode virar o nome de um edital qualquer");

      /* a previa mostra o CAMINHO INTEIRO, com a raiz na frente, e atualiza a
       * cada letra digitada — e' o que deixa uma duplicacao visivel ANTES de
       * exportar, em vez de so' depois, dentro do Anki */
      a.pacAbrir({ chaves: [k("Sistema Tributário Brasileiro", "ISS")], edital: "ISS Caruaru Auditor" });
      const caminhos = () => achar(a.$("pacDecks"), (e) => cls(e, "cq-onde")).map((e) => e.textContent);
      ok(caminhos().some((t) => t.indexOf("ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS") === 0),
         "P11e a previa comeca sem a duplicacao (raiz = concurso, pasta do edital desligada): " + caminhos().join(" ; "));
      a.$("pacComEdital").checked = true; a.$("pacComEdital").onchange();
      ok(caminhos().some((t) => t.indexOf("ISS Caruaru Auditor › ISS Caruaru Auditor › Sistema Tributário Brasileiro › ISS") === 0),
         "P11f religar 'pasta do edital' por cima da raiz que ja' e' o concurso MOSTRA a duplicacao na previa, antes de exportar: "
         + caminhos().join(" ; "));
      a.$("pacComEdital").checked = false; a.$("pacComEdital").onchange();
      a.$("pacNome").value = "Outro Nome"; a.$("pacNome").oninput();
      ok(caminhos().some((t) => t.indexOf("Outro Nome › Sistema Tributário Brasileiro › ISS") === 0),
         "P11g digitar na caixa da raiz atualiza a previa na hora, sem precisar de outro clique: " + caminhos().join(" ; "));
    }
  }

  /* ---- P9: no app ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="pacote\.js"><\/script>/.test(html) && /id="btnPacote"/.test(html) && /id="dlgPacote"/.test(html) && /id="pacArquivo"/.test(html), "P9 falta o script, o botao ou a janela no index.html");
    ok(/"pacote\.js"/.test(sw), "P9a o modulo nao esta no cache offline");
    const anki = fs.readFileSync(path.join(__dirname, "..", "docs", "anki.js"), "utf8");
    ok(/SELECT nid, did FROM cards/.test(anki) && /deck: \(\(\) =>/.test(anki), "P9b o leitor de .apkg devolve o baralho de cada cartao");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`pacote: ok (${f.quantas} verificacoes)`);
  });
}
