/* =====================================================================
 * PACOTE .apkg — O MOTOR DE MONTAR + IMPORTAR PARA UMA PASTA
 *
 * Desde a B4a (fusão com a Biblioteca de cartões), a TELA de "Montar
 * pacote" é o modo exportação de `docs/gerenciador.js` (testada em
 * `tests/gerenciador.js`, blocos G24-G26) — aqui só sobra o MOTOR puro que
 * ela chama (`pacMontar`/`pacCartoes`/`pacNomeDeck`/etc.) e a tela própria
 * de "Importar .apkg para uma pasta", que não faz parte da fusão.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada pasta vira um baralho (Disciplina::Tópico), sem "::" nos nomes.
 *  2. O pacote leva só as pastas marcadas; opcionalmente sem os repetidos
 *     (fica o mais completo de cada grupo, entre pastas) e sem os abaixo do padrão.
 *  3. O cartão exportado leva o baralho da pasta sem perder a manchete.
 *  4. Importar: o baralho de cada cartão vira pasta (sem a raiz comum), ou
 *     tudo vai para uma pasta escolhida; lacuna e explicação sobrevivem;
 *     pergunta que a pasta já tem não duplica; o gerenciador desfaz.
 *  5. Toda ação que grava pergunta antes.
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

  /* ---- P3b: a Bancada cai DIRETO no baralho raiz (o que o "Exportar" do rodape sempre fez) ---- */
  {
    const { a, iss } = montar();
    a.$("editor").value = "Qual a regra geral do prazo? :: Resposta decente e completa aqui";
    const notas = a.cqLerBiblioteca();
    const banc = notas.filter((x) => x.chave === a.CQ_BANCADA);
    ok(banc.length === 1 && a.pacCartoes(banc)[0].deck === "", "P3b cartao da Bancada sai sem subbaralho (direto na raiz)");
    const m = a.pacMontar(notas, new Set([a.CQ_BANCADA, iss]), {});
    ok(m.decks.get("") === 1 && m.decks.get("Trib::ISS") === 2, "P3c a previsao conta a Bancada na raiz (baralho vazio) e as pastas nos seus baralhos: " + [...m.decks.entries()]);
    const mov = new Map([[a.CQ_BANCADA, { disciplina: "Dir", topico: "Geral", edital: "" }]]);
    ok(a.pacCartoes(banc, false, false, mov)[0].deck === "Dir::Geral", "P3d se a Bancada foi ARRASTADA para uma pasta, vale o destino dela");
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

  /* ---- P7: explicação de cada controle da janela de importar (o teste confere que nenhum fica de fora) ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    const ini = html.indexOf('<dialog id="dlgPacote"');
    const dlg = html.slice(ini, html.indexOf("</dialog>", ini));
    const ids = [...dlg.matchAll(/<button[^>]*\bid="(\w+)"/g)].map((m) => m[1])
      .concat([...dlg.matchAll(/<input type="checkbox"[^>]*\bid="(\w+)"/g)].map((m) => m[1]));
    const { a } = montar();
    const faltam = ids.filter((id) => !a.PAC_DICAS[id]);
    ok(ids.length >= 3 && faltam.length === 0, "P7 todo botao e opcao da janela de importar tem explicacao (falta: " + faltam.join(",") + ")");
    ok(Object.keys(a.PAC_DICAS).every((id) => dlg.indexOf('id="' + id + '"') >= 0), "P7a nenhuma explicacao aponta para controle que nao existe");
    const semIdioma = Object.values(a.PAC_DICAS).filter((kk) => i18n.split('"' + kk + '": ').length - 1 < 2 || a.t(kk).length < 20);
    ok(semIdioma.length === 0, "P7b explicacoes em portugues e ingles: " + semIdioma.join(","));
    a.pacAbrir();
    const mal = Object.keys(a.PAC_DICAS).filter((id) => { const e = a.$(id); return !(e._dicaLigada === true && e._ouv.mouseenter.length === 1 && e.getAttribute("aria-description") === a.t(a.PAC_DICAS[id])); });
    ok(mal.length === 0, "P7c cada controle recebeu o balao: " + mal.join(","));
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
    /* fechar e reabrir esquece o arquivo lido (senao a tela mostraria um resumo de um
     * arquivo que a pessoa nem escolheu de novo) */
    await a.pacLerArquivo({ fake: 1 }, { ler: async () => ({ deck: "Pacote", cards }) });
    ok(a.pacLidoAtual() !== null, "P8j (confirma: ha' um arquivo lido, para o teste valer)");
    a.$("dlgPacote").close();
    a.pacAbrir();
    ok(a.pacLidoAtual() === null && a.$("pacImpCx").hidden === true, "P8k reabrir esquece o arquivo lido da vez anterior");
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
