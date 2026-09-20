/* =====================================================================
 * A ESTRUTURA DA LEI — divisões em árvore, artigos bem lidos, "capítulo lido" único
 *
 * O CASO REAL. O CTN colado tinha: "LIVRO PRIMEIRO" engolido pelo art. 1º (o cabeçalho só
 * conhecia numeral romano); o art. 178 lido como "178-A" ("Art. 178 - A isenção…"); "TÍTULO
 * V-A" lido como "TÍTULO V — A"; capítulos cujo "nome" era a nota "(Incluído pela LC 236)"; e
 * vários "CAPÍTULO I — Disposições Gerais" que, guardados pelo NOME, marcavam todos de uma vez.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. As divisões formam uma ÁRVORE (Parte › Livro › Título › Capítulo › Seção), e cada
 *     artigo sabe o caminho até ele. O id da divisão é o caminho por tipo e número.
 *  2. "Art. 178 - A isenção" é o artigo 178; "Art. 178-A" e "Art. 18 - A Para fins…" são -A.
 *  3. O número da divisão pode ser por extenso ("LIVRO PRIMEIRO") ou ter letra ("V-A").
 *  4. A nota de alteração não é o nome do capítulo; "Disposições Finais e Transitórias" é
 *     divisão, e não texto do último artigo.
 *  5. Dois capítulos de mesmo nome são dois blocos, com chaves diferentes.
 *  6. O que já estava marcado por nome continua marcado depois da troca da chave.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api: p } = rodar();
  const nums = (t) => p.leiArtigos(t).map((a) => a.num).join(",");

  /* ==============================================================
   * A: OS ARTIGOS
   * ============================================================== */
  {
    const t = ["Art. 177. Alfa.", "Art. 178 - A isenção, salvo se concedida por prazo certo, pode ser revogada.",
      "Art. 179. Beta.", "Art. 18 - A Para fins da incidência do imposto.", "Art. 5-A. Gama.",
      "Art. 6º - A lei dispõe.", "Art. 7 - a lei dispõe."].join("\n");
    const arts = p.leiArtigos(t);
    ok(arts.map((a) => a.num).join(",") === "177,178,179,18-A,5-A,6,7", "A1 'Art. 178 - A isenção' e' o 178; 'Art. 18 - A Para' e' o 18-A: " + nums(t));
    ok(arts[1].corpo.indexOf("A isenção, salvo") === 0, "A1a o 'A' fica no texto do artigo: " + arts[1].corpo.slice(0, 30));
    ok(p.leiCasarArtigo("Art. 178-A. A isenção") && p.leiCasarArtigo("Art. 178-A. A isenção")[1] === "178-A", "A2 o sufixo colado sempre vale");
    ok(p.leiCasarArtigo("Art. 12 - A") && /A$/.test(p.leiCasarArtigo("Art. 12 - A")[1]), "A2a 'Art. 12 - A' sozinho na linha e' o 12-A");
    ok(p.leiCasarArtigo("Texto qualquer") === null, "A2b linha sem artigo");
    /* a numeração deixa de acusar um buraco que não existe */
    const seq = [];
    for (let i = 170; i <= 185; i++) seq.push(i === 178 ? "Art. 178 - A isenção, salvo se…" : "Art. " + i + ". Texto " + i + ".");
    const nm = p.leiNumeracao(p.leiArtigos(seq.join("\n")));
    ok(nm.problemas.length === 0, "A3 a sequência 170-185 (com o 178 escrito assim) nao tem problema: " + JSON.stringify(nm.problemas));
  }

  /* ==============================================================
   * D: AS DIVISÕES
   * ============================================================== */
  {
    const t = ["Art. 1º Esta Lei regula o sistema.", "LIVRO PRIMEIRO", "SISTEMA TRIBUTÁRIO NACIONAL",
      "TÍTULO I", "Disposições Gerais", "Art. 2º O sistema é regido pela Constituição.",
      "CAPÍTULO I — Da União", "Art. 3º Tributo é toda prestação."].join("\n");
    const arts = p.leiArtigos(t);
    ok(!/LIVRO/.test(arts[0].texto), "D1 'LIVRO PRIMEIRO' nao fica dentro do art. 1º: " + JSON.stringify(arts[0].texto));
    const e = p.leiEstruturaLei(t);
    ok(e.raiz.length === 2 && e.raiz[0].virtual && e.raiz[0].artigos.length === 1 && e.raiz[1].tipo === "LIVRO", "D1a o art. 1º fica num nó '(sem divisão)' e o livro e' o outro: " + e.raiz.map((x) => x.rotulo));
    const livro = e.raiz[1];
    ok(livro.num === "PRIMEIRO" && livro.nome === "SISTEMA TRIBUTÁRIO NACIONAL" && livro.rotulo === "LIVRO PRIMEIRO — SISTEMA TRIBUTÁRIO NACIONAL", "D1b o livro por extenso e o nome da 2ª linha: " + livro.rotulo);
    ok(livro.filhos.length === 1 && livro.filhos[0].rotulo === "TÍTULO I — Disposições Gerais", "D2 o título esta DENTRO do livro: " + livro.filhos.map((x) => x.rotulo));
    ok(livro.filhos[0].filhos.length === 1 && livro.filhos[0].filhos[0].artigos.length === 1, "D2a o capitulo esta dentro do titulo, com o art. 3º");
    ok(arts[2].caminho.join(" | ") === "LIVRO PRIMEIRO — SISTEMA TRIBUTÁRIO NACIONAL | TÍTULO I — Disposições Gerais | CAPÍTULO I — Da União", "D3 o caminho do art. 3º: " + arts[2].caminho.join(" | "));
    ok(livro.total === 2 && livro.de === 1 && livro.ate === 2, "D3a total e faixa do ramo: " + [livro.total, livro.de, livro.ate]);
    ok(arts[2].divisao === "CAPÍTULO I — Da União" && arts[2].divisaoTipo === "CAPITULO", "D3b os campos antigos continuam: " + arts[2].divisao + "/" + arts[2].divisaoTipo);
  }
  {
    const r = (t) => { const d = p.leiEstruturaLei(t + "\nArt. 1º x").raiz[0]; return d; };
    ok(r("TÍTULO V-A").num === "V-A" && r("TÍTULO V-A").rotulo === "TÍTULO V-A", "D4 'TÍTULO V-A': " + r("TÍTULO V-A").rotulo);
    ok(r("TÍTULO V - A").num === "V-A", "D4a 'TÍTULO V - A' (a letra sozinha) tambem: " + r("TÍTULO V - A").num);
    ok(r("TÍTULO V - Contribuição de Melhoria").num === "V" && r("TÍTULO V - Contribuição de Melhoria").nome === "Contribuição de Melhoria", "D4b 'V - Contribuição' continua sendo o nome");
    ok(r("CAPÍTULO I - A Fiscalização").nome === "A Fiscalização" || r("CAPÍTULO I - A Fiscalização").num === "I-A", "D4c (registro) 'CAPÍTULO I - A Fiscalização': num=" + r("CAPÍTULO I - A Fiscalização").num + " nome=" + r("CAPÍTULO I - A Fiscalização").nome);
    ok(p.leiEstruturaLei("TÍTULO CÍVICO\nArt. 1º x").raiz.every((x) => x.virtual), "D5 'TÍTULO CÍVICO' nao e' o título 'C'");
    ok(p.leiEstruturaLei("Título dos crimes\nArt. 1º x").raiz.every((x) => x.virtual), "D5a texto corrido que comeca com 'Título' nao e' divisão");
    ok(r("SEÇÃO ÚNICA").num === "ÚNICA" || r("SEÇÃO ÚNICA").num === "UNICA", "D6 seção única: " + r("SEÇÃO ÚNICA").num);
    ok(r("TÍTULO SÉTIMO").num === "SÉTIMO", "D6a ordinal com acento");
  }
  {
    /* a nota de alteração não é o NOME */
    const t = ["CAPÍTULO IV (Incluído pela Lei Complementar nº 236, de 2026)", "Do Processo Administrativo Fiscal",
      "Art. 208-A. Este Capítulo estabelece normas.", "Seção III — (Redação dada pela Lei Complementar nº 227, de 2026)",
      "Art. 209. Outra coisa."].join("\n");
    const e = p.leiEstruturaLei(t);
    const cap = e.nos["CAPITULO IV"], sec = e.nos["CAPITULO IV>SECAO III"] || e.nos["SECAO III"];
    ok(cap && cap.nome === "Do Processo Administrativo Fiscal" && /Incluído/.test(cap.nota), "D7 a nota vai para 'nota' e o nome vem da linha seguinte: " + JSON.stringify(cap && [cap.nome, cap.nota]));
    ok(cap.rotulo === "CAPÍTULO IV — Do Processo Administrativo Fiscal", "D7a rótulo sem a nota: " + cap.rotulo);
    ok(sec && sec.rotulo === "Seção III" && /Redação dada/.test(sec.nota), "D7b 'Seção III — (Redação dada…)' fica 'Seção III': " + (sec && sec.rotulo));
    const n = p.leiNomeDaDivisao("Da Receita (Vide Lei nº 5, de 1990) (Redação dada pela LC 9)");
    ok(n.nome === "Da Receita" && /Vide/.test(n.nota) && /Redação/.test(n.nota), "D7c varias notas: " + JSON.stringify(n));
  }
  {
    const t = ["Art. 208-J. Última do processo.", "§ 2º Disposição.", "Disposições Finais e Transitórias", "Art. 209. Primeira final.",
      "PARTE GERAL", "Art. 210. Xis."].join("\n");
    const arts = p.leiArtigos(t);
    ok(!/Disposições Finais/.test(arts[0].texto), "D8 'Disposições Finais e Transitórias' nao fica no fim do art. 208-J: " + JSON.stringify(arts[0].texto));
    ok(arts[1].divisao === "Disposições Finais e Transitórias" && arts[1].divisaoTipo === "DISPOSICOES", "D8a e' uma divisão: " + arts[1].divisao);
    ok(arts[2].divisaoTipo === "PARTE" && arts[2].divisao === "PARTE GERAL", "D8b 'PARTE GERAL' tambem");
    /* como NOME de uma divisão, continua sendo o nome */
    const e = p.leiEstruturaLei("TÍTULO IX\nDISPOSIÇÕES FINAIS\nArt. 1º x");
    ok(e.raiz[0].nome === "DISPOSIÇÕES FINAIS" && e.raiz[0].tipo === "TITULO", "D8c depois de 'TÍTULO IX' a linha e' o NOME: " + e.raiz[0].rotulo);
    ok(p.leiEstruturaLei("Art. 1º x\nDISPOSIÇÕES GERAIS SOBRE OUTRA COISA\nArt. 2º y").raiz.every((x) => x.virtual), "D8d so as frases conhecidas viram divisão");
  }

  /* ==============================================================
   * I: OS IDS E OS BLOCOS
   * ============================================================== */
  const DOIS = [
    "TÍTULO I", "Art. 1º a.", "CAPÍTULO I — Disposições Gerais", "Art. 2º b.", "Art. 3º c.",
    "TÍTULO II", "CAPÍTULO I — Disposições Gerais", "Art. 4º d.", "Art. 5º e.",
    "SEÇÃO I — Disposições Gerais", "Art. 6º f.",
    "TÍTULO II", "CAPÍTULO I — Disposições Gerais", "Art. 7º g.",
  ].join("\n");
  {
    const e = p.leiEstruturaLei(DOIS);
    const ids = Object.keys(e.nos);
    ok(ids.join("|") === "TITULO I|TITULO I>CAPITULO I|TITULO II|TITULO II>CAPITULO I|TITULO II>CAPITULO I>SECAO I|TITULO II#2|TITULO II#2>CAPITULO I",
      "I1 os ids sao caminhos por tipo e numero; o que se repete ganha #2: " + ids.join(" | "));
    const bl = p.leiBlocos(DOIS);
    const chaves = bl.map((b) => b.chave);
    ok(chaves.length === 5 && new Set(chaves).size === 5, "I2 cinco blocos, cinco chaves diferentes: " + chaves.join(" | "));
    ok(bl.filter((b) => b.nome === "CAPÍTULO I — Disposições Gerais").length === 3, "I2a tres blocos tem o MESMO nome (e por isso o nome nao serve de chave)");
    ok(bl[1].caminho.join(" › ") === "TÍTULO I › CAPÍTULO I — Disposições Gerais", "I2b o bloco sabe o caminho: " + bl[1].caminho.join(" › "));
    ok(bl[0].id === "b0" && bl[0].de === "1" && bl[0].ate === "1", "I2c os campos antigos continuam (id, de, ate)");
    /* sem divisão: blocos de tamanho fixo têm chave própria */
    const semDiv = []; for (let i = 1; i <= 40; i++) semDiv.push("Art. " + i + ". Texto " + i + ".");
    const b2 = p.leiBlocos(semDiv.join("\n"));
    ok(b2.length === 3 && b2[0].chave === "arts:1-15" && b2[2].chave === "arts:31-40", "I3 lei sem divisão: 'arts:1-15'...: " + b2.map((b) => b.chave));
    /* capítulo grande é partido em partes, cada uma com a sua chave */
    const gr = ["CAPÍTULO I — Enorme"]; for (let i = 1; i <= 40; i++) gr.push("Art. " + i + ". Texto " + i + ".");
    const b3 = p.leiBlocos(gr.join("\n"));
    ok(b3.length === 3 && b3[0].chave === "d:CAPITULO I|1/3" && b3[2].chave === "d:CAPITULO I|3/3", "I4 capítulo partido: " + b3.map((b) => b.chave));
  }
  {
    /* A MIGRAÇÃO: o que estava marcado por NOME continua marcado */
    const l = { id: "x", texto: DOIS, blocos: {
      "CAPÍTULO I — Disposições Gerais": "2026-01-01",         /* nome repetido 3x: os três ficam lidos, como a pessoa via */
      "TÍTULO I": "2026-02-02",
      "Capítulo que sumiu": "2025-05-05" } };
    const m = p.leiMigrarBlocos(l);
    const bl = p.leiBlocos(DOIS);
    ok(m.mudou === true, "M1 ha o que migrar");
    ok(bl.filter((b) => b.nome === "CAPÍTULO I — Disposições Gerais").every((b) => m.blocos[b.chave] === "2026-01-01"), "M2 o nome repetido virou a chave de cada um dos tres: " + JSON.stringify(m.blocos));
    ok(m.blocos["d:TITULO I"] === "2026-02-02" && m.blocos["d:TITULO I"] !== undefined, "M2a o nome unico virou a chave do bloco: " + JSON.stringify(Object.keys(m.blocos)));
    ok(m.blocos["Capítulo que sumiu"] === "2025-05-05", "M3 o que nao existe mais no texto NAO se perde");
    ok(m.blocos["CAPÍTULO I — Disposições Gerais"] === undefined && m.blocos["TÍTULO I"] === undefined, "M4 a chave por nome sai");
    ok(p.leiMigrarBlocos({ id: "y", texto: DOIS, blocos: m.blocos }).mudou === false, "M5 migrar de novo nao muda nada");
    ok(p.leiMigrarBlocos({ id: "z", texto: DOIS, blocos: { "d:TITULO I": "2026-03-03", "TÍTULO I": "2020-01-01" } }).blocos["d:TITULO I"] === "2026-03-03", "M6 a marca nova vale mais que a antiga");
    /* gravado de verdade */
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const salvo = api.leiGuardar({ id: "lei_e", nome: "Lei E", texto: DOIS, blocos: { "TÍTULO I": "2026-02-02" } });
    ok(api.leisMigrarBlocosDe(salvo.id) === true && api.leiDe(salvo.id).blocos["d:TITULO I"] === "2026-02-02" && !("TÍTULO I" in api.leiDe(salvo.id).blocos), "M7 a migração grava na lei");
    ok(api.leisMigrarBlocosDe(salvo.id) === false, "M7a e nao grava de novo");
    ok(api.leisMigrarBlocosDe("nao-existe") === false, "M7b lei inexistente");
  }

  /* ==============================================================
   * U: A TELA DE CAPÍTULOS — marcar um não marca o outro
   * ============================================================== */
  {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_e", nome: "Lei E", texto: DOIS, blocos: { "CAPÍTULO I — Disposições Gerais": "2026-01-01" } });
    api.leiAbrir("Direito", "Tributário", l.id);
    const dep = api.leiDe(l.id);
    ok(!("CAPÍTULO I — Disposições Gerais" in dep.blocos) && Object.keys(dep.blocos).length === 3, "U1 ao abrir, a lei antiga e' migrada: " + JSON.stringify(dep.blocos));
    api.leiIrAbrir();       /* os capitulos vivem no mapa; lei pequena abre inteira */
    const linhas = () => api.$("leiIrGrade").querySelectorAll(".lei-bloco");
    const lidas = () => Array.from(linhas()).map((x) => /lei-bloco-lido/.test(x.className || "") ? 1 : 0).join("");
    ok(lidas() === "01101", "U1a os tres 'Capítulo I' aparecem lidos, como antes: " + lidas());
    const chk = Array.from(linhas()[1].querySelectorAll("button")).filter((b) => /lei-bloco-chk/.test(b.className || ""))[0];
    chk.onclick();
    ok(lidas() === "00101", "U2 desmarcar UM capítulo não desmarca os de mesmo nome: " + lidas());
    ok(api.leiBlocosLidos(l.id) === 2, "U2a a lei guarda 2");
    const chk2 = Array.from(linhas()[0].querySelectorAll("button")).filter((b) => /lei-bloco-chk/.test(b.className || ""))[0];
    chk2.onclick();
    ok(lidas() === "10101", "U3 marcar o Título I marca so ele: " + lidas());
  }

  /* ==============================================================
   * G: O DIAGNÓSTICO E O MAPA DE UMA LEI JÁ GUARDADA
   * ============================================================== */
  const CTN = [
    "Art. 1º Esta Lei regula o sistema.",
    "LIVRO PRIMEIRO", "SISTEMA TRIBUTÁRIO NACIONAL", "TÍTULO I", "Disposições Gerais",
    "Art. 2º O sistema é regido.", "Art. 3º Tributo é toda prestação.",
    "SISTEMA DOS TRIBUTOS INDEVIDOS",
    "Art. 4º A natureza do tributo.", "Art. 5º Os tributos são impostos.", "Art. 6º A competência.",
    "CAPÍTULO II", "Art. 7º Vedado.",
    "Art. 8-A. Sem o oito.", "Art. 9º Nono.",
    "Art. 40. Uma remissão lida como artigo.",
    "Art. 10. Décimo.", "Art. 11. Onze.", "Art. 12. Doze.",
  ].join("\n");
  {
    const dg = p.leiDiagnosticarLei(CTN);
    const tipos = dg.itens.map((x) => x.tipo);
    ok(dg.resumo.artigos === 13 && dg.resumo.de === "1º" && dg.resumo.ate === "12", "G1 o resumo: " + JSON.stringify(dg.resumo));
    ok(dg.resumo.porTipo.LIVRO === 1 && dg.resumo.porTipo.TITULO === 1 && dg.resumo.porTipo.CAPITULO === 1 && dg.resumo.divisoes === 3, "G1a as divisoes por tipo: " + JSON.stringify(dg.resumo.porTipo));
    const tit = dg.itens.filter((x) => x.tipo === "titulo_no_artigo")[0];
    ok(tit && tit.texto === "SISTEMA DOS TRIBUTOS INDEVIDOS" && tit.numCru === "3º" && tit.linha === 8, "G2 o titulo solto dentro do art. 3º: " + JSON.stringify(tit));
    const suf = dg.itens.filter((x) => x.tipo === "sufixo_sem_base")[0];
    ok(suf && suf.numCru === "8-A" && suf.base === "8", "G3 '8-A' sem o 8, entre 7 e 9: " + JSON.stringify(suf));
    ok(dg.itens.some((x) => x.tipo === "isolado" && x.numCru === "40" && x.gravidade === "grave"), "G4 o art. 40 isolado (remissao lida como artigo): " + tipos);
    ok(dg.itens.some((x) => x.tipo === "divisao_sem_nome" && /CAPÍTULO II/.test(x.rotulo) && x.numCru === "7º"), "G5 o CAPÍTULO II sem nome, apontando o art. 7º: " + JSON.stringify(dg.itens.filter((x) => x.tipo === "divisao_sem_nome")));
    ok(dg.itens.every((x, i, a) => i === 0 || a[i - 1].linha <= x.linha), "G6 os itens vêm na ordem do texto");
    ok(dg.itens.every((x) => x.indice >= 0 && x.num), "G6a todo item sabe a que artigo ir");
    ok(dg.resumo.graves >= 1, "G6b conta os graves");
    /* uma lei limpa não acusa nada */
    const limpa = []; for (let i = 1; i <= 12; i++) limpa.push("Art. " + i + ". Texto " + i + ".");
    ok(p.leiDiagnosticarLei("CAPÍTULO I — Da Receita\n" + limpa.join("\n")).itens.length === 0, "G7 lei limpa: nada a conferir");
    /* incisos e parágrafos em maiúsculas não são 'título solto' */
    ok(p.leiDiagnosticarLei("Art. 1º Texto.\nI - PESSOAS FÍSICAS E JURÍDICAS;\n§ 1º DA OBRIGAÇÃO PRINCIPAL\nArt. 2º Outro.").itens.filter((x) => x.tipo === "titulo_no_artigo").length === 0, "G8 inciso e § em maiusculas nao sao titulo");
    ok(p.leiDiagnosticarLei("Art. 1º Texto.\n(VETADO)\nANEXO\nArt. 2º Outro.").itens.filter((x) => x.tipo === "titulo_no_artigo").length === 0, "G8a '(VETADO)' nao e' titulo");
    ok(p.leiDiagnosticarLei("Art. 1º Texto.\nII - TRIBUTOS EM GERAL\nArt. 2º Outro.").itens.filter((x) => x.tipo === "titulo_no_artigo").length === 0, "G8b um inciso escrito em maiusculas (sem ponto final) nao e' titulo solto");
  }
  {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
    const l = api.leiGuardar({ id: "lei_ctn", nome: "CTN", texto: CTN, parei: "4" });
    api.leiAbrir("Direito", "Tributário", l.id);
    ok(achar(api.$("leiProc"), (c) => c.id === "btnLeiMapa").length === 1, "G9 a lei guardada tem o botao 'mapa e conferência'");
    ok(achar(api.$("leiProc"), (c) => c.id === "btnLeiNumeracao").length === 1, "G9a e o aviso de numeracao continua");
    achar(api.$("leiProc"), (c) => c.id === "btnLeiNumeracao")[0].onclick();
    ok(api.$("dlgLeiMapa").open === true, "G10 o aviso de numeracao agora abre o MAPA (antes era so um alerta)");
    const txt = api.$("dlgLeiMapa").textContent || "";
    ok(/13 artigos · 3 divisões · numeração de 1º a 12/.test(api.$("leiMapaResumo").textContent), "G10a o resumo na tela: " + api.$("leiMapaResumo").textContent);
    const itens = achar(api.$("leiMapaConferir"), (c) => /lei-mapa-item/.test(c.className || ""));
    ok(itens.length === 4 && /SISTEMA DOS TRIBUTOS INDEVIDOS/.test(itens[0].textContent), "G11 quatro itens a conferir, o primeiro e' o titulo solto: " + itens.length + " " + (itens[0] && itens[0].textContent.slice(0, 80)));
    ok(itens.every((it) => achar(it, (c) => c.tag === "summary" || c.tagName === "SUMMARY").length === 1), "G11a cada item tem 'ver no texto' (o trecho com os vizinhos)");
    ok(achar(itens[0], (c) => c.tag === "button" || c.tagName === "BUTTON").length === 1, "G11b e o botao 'ir ao artigo'");
    ok(!/undefined/.test(txt), "G11c nenhum texto 'undefined' na tela");
    /* a árvore: o ramo onde parei (art. 4º) já vem aberto */
    const arv = Array.from(api.$("leiMapaArvore").children);
    ok(arv.length === 2 && /\(sem divisão\)/.test(arv[0].textContent) && /LIVRO PRIMEIRO — SISTEMA TRIBUTÁRIO NACIONAL/.test(arv[1].textContent), "G12 a arvore: '(sem divisão)' e o livro: " + arv.map((x) => (x.textContent || "").slice(0, 30)));
    ok(arv[1].open === true && arv[0].open !== true, "G12a o ramo do art. 4º (parei) vem aberto: " + [arv[0].open, arv[1].open]);
    const chipsDe = (el) => achar(el, (c) => /lei-ir-n/.test(c.className || "")).map((c) => c.textContent);
    ok(chipsDe(arv[1]).join(",") === "2º,3º,4º,5º,6º", "G12b o titulo mostra os seus artigos; o capitulo (fechado) ainda nao desenha os dele: " + chipsDe(arv[1]).join(","));
    const cap2 = achar(arv[1], (c) => (c.tag === "details" || c.tagName === "DETAILS") && /^CAPÍTULO II/.test(c.textContent || ""))[0];
    cap2.encher();
    ok(chipsDe(cap2).join(",") === "7º,8-A,9º,40,10,11,12", "G12c abrir o capitulo desenha os artigos dele: " + chipsDe(cap2).join(","));
    /* ir ao artigo fecha o mapa */
    api.leiMapaIr("5");
    ok(api.$("dlgLeiMapa").open !== true, "G13 ir ao artigo fecha o mapa");
    ok(api.leiDe(l.id).texto === CTN, "G14 o texto guardado nao foi tocado");
    /* pela Biblioteca */
    api.leiBibAbrir();
    const bt = achar(api.$("leiBibLista"), (c) => c.id === "btnLeiBibMapa_lei_ctn");
    ok(bt.length === 1, "G15 o cartao da biblioteca tem 'mapa e conferência'");
    bt[0].onclick();
    ok(api.$("dlgLeiMapa").open === true && /CTN/.test(api.$("leiMapaTitulo").textContent) && api.$("dlgLeiBib").open !== true, "G15a abre a lei e o mapa: " + api.$("leiMapaTitulo").textContent);
  }
  {
    /* AS DIVISÕES SEM NOME (o aviso mais comum) ficam num grupo recolhido e explicado, e o relatorio
     * da tela leva tudo o que e' preciso para relatar: os numeros, cada ponto com as linhas ao redor e a arvore */
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
    const l = api.leiGuardar({ id: "lei_rel", nome: "CTN rel", texto: CTN });
    api.leiAbrir("Direito", "Tributário", l.id);
    api.leiMapaAbrir();
    const cf = api.$("leiMapaConferir");
    const grupo = achar(cf, (c) => String(c.tag || c.tagName || "").toLowerCase() === "details" && /lei-mapa-grupo/.test(c.className || ""))[0];
    ok(grupo && /Divisões sem nome \(1\)/.test(grupo.textContent) && /não afeta os artigos nem a numeração/.test(grupo.textContent), "G18 a divisao sem nome fica num grupo explicado: " + (grupo && grupo.textContent.slice(0, 120)));
    const itens = (el) => achar(el, (c) => /lei-mapa-item/.test(c.className || ""));
    ok(itens(grupo).length === 1 && itens(cf).length === 4, "G18a so ela vai para o grupo; as outras tres ficam a vista: " + itens(cf).length);
    ok(/⚠ = a leitura provavelmente está errada/.test(cf.textContent), "G18b a legenda dos sinais (⚠ e •) aparece");
    const rel = api.leiRelatorioFluxo("mapa e conferência");
    ok(/Mapa e conferência de CTN rel \(lei_rel\): 13 artigos · 3 divisões \(LIVRO 1, TITULO 1, CAPITULO 1\) · numeração de 1º a 12/.test(rel), "G19 o relatorio traz os numeros: " + rel.split("\n").filter((x) => /Mapa e conferência/.test(x)).join("|"));
    ok(/a conferir: 4 \(graves: 1\) — /.test(rel) && /divisao_sem_nome 1/.test(rel) && /isolado 1/.test(rel), "G19a e o resumo do que foi apontado: " + rel.split("\n").filter((x) => /a conferir/.test(x)).join("|"));
    ok(/\[divisao_sem_nome\/leve\] linha 12 · art\. 7º/.test(rel) && />\s+12\| CAPÍTULO II/.test(rel) && /\s11\| Art\. 6º/.test(rel) && /\s13\| Art\. 7º/.test(rel), "G19b cada ponto vem com as linhas ao redor, e a linha do ponto marcada com >: " + rel.slice(rel.indexOf("divisao_sem_nome") - 5, rel.indexOf("divisao_sem_nome") + 260));
    ok(/árvore de divisões:/.test(rel) && /LIVRO PRIMEIRO — SISTEMA TRIBUTÁRIO NACIONAL · arts\. 2º a 12 \(12\)/.test(rel) && /\n {8}CAPÍTULO II · arts\. 7º a 12 \(7\)/.test(rel), "G19c e a arvore de divisoes, com a hierarquia: " + rel.slice(rel.indexOf("árvore")));
    ok(/— Registro \(últimas 60 linhas\)/.test(rel) && /EasyAnkiCards 16\./.test(rel), "G19d com a versao do app e o registro");
    ok(!/Mapa e conferência de/.test(api.leiRelatorioFluxo("artigos repetidos")), "G19e o relatorio de OUTRA tela nao leva o mapa");
    ok(typeof api.$("btnLeiRelMapa").onclick === "function" && /Mapa e conferência de/.test(api.leiRelatorioCopiar("mapa e conferência")), "G19f o botao 'copiar relatorio desta tela' existe no mapa e copia");
    /* a nota que veio no lugar do nome aparece no ponto */
    const n2 = api.leiGuardar({ id: "lei_nota", nome: "Com nota", texto: "CAPÍTULO IV (Incluído pela Lei Complementar nº 236, de 2026)\nArt. 208-A. Este Capítulo.\nSeção III — (Redação dada pela Lei Complementar nº 227, de 2026)\nArt. 209. Outro." });
    api.leiAbrir("Direito", "Tributário", n2.id);
    api.leiMapaAbrir();
    const txt2 = api.$("leiMapaConferir").textContent;
    ok(/Divisões sem nome \(2\)/.test(txt2) && /Veio só a nota: \(Incluído pela Lei Complementar nº 236, de 2026\)/.test(txt2) && /Veio só a nota: \(Redação dada pela Lei Complementar nº 227, de 2026\)/.test(txt2), "G20 a nota de alteração que veio no lugar do nome e' mostrada: " + txt2.slice(0, 260));
    ok(/nota: \(Incluído/.test(api.leiRelatorioFluxo("mapa e conferência")) || /Veio só a nota/.test(api.leiRelatorioFluxo("mapa e conferência")), "G20a e vai no relatorio");
  }
  {
    /* lei sem problemas e lei sem texto */
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const limpa = ["CAPÍTULO I — Da Receita"]; for (let i = 1; i <= 12; i++) limpa.push("Art. " + i + ". Texto " + i + ".");
    const l = api.leiGuardar({ id: "lei_ok", nome: "Lei OK", texto: limpa.join("\n") });
    api.leiAbrir("D", "T", l.id);
    ok(api.leiMapaAbrir() === true && /Nada suspeito/.test(api.$("leiMapaConferir").textContent), "G16 lei limpa: diz que nada e' suspeito");
    api.$("dlgLeiMapa").close();
    const v = api.leiGuardar({ id: "lei_vazia", nome: "Vazia", texto: "" });
    api.leiAbrir("D", "T", v.id);
    ok(api.leiMapaAbrir() === false, "G17 lei sem texto nao abre o mapa");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
