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
