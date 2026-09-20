/* =====================================================================
 * "IR PARA…" É O MAPA DA LEI
 *
 * Eram três botões atrás de "ir para…": "capítulos", "ir ao artigo" e "artigos que mais
 * caem". O botão "ir ao artigo" era o mais usado, e mostrava só os NÚMEROS dos artigos — os
 * parágrafos e incisos que o app já sabia ler não apareciam. Agora "ir para…" abre uma tela só.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "ir para…" abre o mapa direto; a gaveta dos três botões não existe mais.
 *  2. O mapa é a árvore de divisões, com os artigos de cada uma; um toque no artigo leva a ele.
 *  3. A seta ▾ de cada artigo abre os parágrafos, incisos e alíneas, com hierarquia, e cada
 *     um leva direto ao trecho.
 *  4. O que era "artigos que mais caem" vive nos próprios artigos (questões, erro, prova, o
 *     inciso cobrado) e em filtros; o que era "capítulos" vive nos capítulos (minutos, lido).
 *  5. Marcar um capítulo como lido move o marcador; o mesmo capítulo não marca o vizinho.
 *  6. A busca entende "4", "4 II", "4 § 2º", o nome de um capítulo e palavras.
 *  7. Lei grande abre só o ramo do "parei" e só desenha o que se abre.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

const LEI = [
  "Art. 1º Preâmbulo da lei.",
  "LIVRO PRIMEIRO", "SISTEMA TRIBUTÁRIO NACIONAL",
  "TÍTULO I — Disposições Gerais",
  "Art. 2º O sistema é regido pela Constituição.",
  "Art. 3º Tributo é toda prestação pecuniária compulsória.",
  "Art. 4º A natureza jurídica do tributo:",
  "I - a denominação;", "II - a destinação:", "a) legal;", "b) outra;",
  "§ 1º Primeiro parágrafo.", "§ 2º Segundo:", "I - inciso do parágrafo;", "§ 3º Terceiro.",
  "CAPÍTULO I — Da Receita", "Art. 5º A receita pública.",
  "CAPÍTULO II — Da Despesa", "Art. 6º A despesa pública ordinária.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const eh = (c, tag) => String(c.tag || c.tagName || "").toLowerCase() === tag;
  const classe = (re) => (c) => re.test(c.className || "");
  const montar = (texto, extra) => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito Tributário", "Sistema tributário");
    api.matGravar(ch, "Resumo.", { disciplina: "Direito Tributário", topico: "Sistema tributário", concurso: "TCE-PE" });
    const l = api.leiGuardar(Object.assign({ id: "lei_t", nome: "Lei T", texto: texto || LEI, parei: "3" }, extra || {}));
    api.leiAbrir("Direito Tributário", "Sistema tributário", l.id);
    return { api, l, ch };
  };
  const grade = (api) => api.$("leiIrGrade");
  const celDe = (api, numCru) => achar(grade(api), classe(/lei-ir-cel/)).filter((c) => c.children[0] && c.children[0].textContent === numCru)[0];

  /* ==============================================================
   * M: ABRIR E A ÁRVORE
   * ============================================================== */
  {
    const { api } = montar();
    ok(!api.$("leiGavNavegar") && !api.$("btnLeiBlocos") && !api.$("btnLeiIr") && !api.$("btnLeiRank"), "M1 a gaveta e os tres botoes nao existem mais");
    ok(!api.$("dlgLeiRank") && !api.$("leiBlocosCx") && typeof api.leiRankingAbrir === "undefined", "M1a o dialogo do ranking e a lista de capitulos tambem nao");
    api.$("btnLeiNavegar").onclick();
    ok(api.$("dlgLeiIr").open === true, "M1b 'ir para…' abre o mapa DIRETO");
    const filhos = Array.from(grade(api).children);
    ok(filhos.length === 2 && eh(filhos[0], "details") && /\(sem divisão\)/.test(filhos[0].textContent) && /LIVRO PRIMEIRO — SISTEMA TRIBUTÁRIO NACIONAL/.test(filhos[1].textContent), "M2 a arvore: '(sem divisão)' e o livro: " + filhos.map((x) => (x.textContent || "").slice(0, 28)));
    const sm = achar(filhos[1], (c) => eh(c, "summary"))[0];
    ok(/arts\. 2º a 6º \(5\)/.test(sm.textContent) && /~\d+ min/.test(sm.textContent), "M2a o livro diz os artigos e os minutos: " + sm.textContent);
    ok(/1 artigos|artigos/.test(api.$("leiIrSub").textContent) && /6 artigos/.test(api.$("leiIrSub").textContent), "M2b o subtitulo: " + api.$("leiIrSub").textContent);
    const chips = achar(grade(api), classe(/lei-ir-n/));
    ok(chips.map((c) => c.textContent).join(",") === "1º,2º,3º,4º,5º,6º", "M3 lei pequena abre inteira, com todos os artigos: " + chips.map((c) => c.textContent).join(","));
    ok(/lei-ir-parei/.test(chips[2].className), "M3a o art. 3º (parei) tem o selo verde");
    ok(achar(grade(api), classe(/lei-ir-mais/)).length === 6, "M3b cada artigo tem a seta dos parágrafos e incisos");
    /* um toque no artigo leva a ele e fecha o mapa */
    chips[4].onclick();
    ok(api.$("dlgLeiIr").open !== true, "M4 tocar no artigo fecha o mapa");
    ok(api.leiIrIr("5") === true, "M4a e chega ao artigo");
  }

  /* ==============================================================
   * U: A SETA ▾ — PARÁGRAFOS, INCISOS E ALÍNEAS
   * ============================================================== */
  {
    const { api } = montar();
    api.leiIrAbrir();
    const cel = celDe(api, "4º");
    const mais = achar(cel, classe(/lei-ir-mais/))[0];
    ok(achar(cel, classe(/lei-ir-un/)).length === 0, "U1 os parágrafos só são desenhados quando a seta e' tocada");
    mais.onclick();
    const painel = achar(cel, classe(/lei-ir-un/))[0];
    const rot = achar(painel, classe(/lei-ir-u-rot/)).map((c) => c.textContent);
    ok(rot.join("|") === "I|II|a)|b)|§ 1º|§ 2º|I|§ 3º", "U2 a estrutura do art. 4º, na ordem do texto: " + rot.join("|"));
    const linhas = achar(painel, classe(/lei-ir-u /));
    const nivel = linhas.map((b) => (String(b.className).match(/lei-ir-u(\d)/) || [])[1]).join("");
    ok(nivel === "22331121", "U2a a hierarquia (inciso 2, alinea 3, paragrafo 1): " + nivel);
    ok(/lei-ir-cel-aberta/.test(cel.className) && mais.textContent === "▴", "U3 a celula abre em linha inteira e a seta vira ▴");
    mais.onclick();
    ok(painel.hidden === true && !/lei-ir-cel-aberta/.test(cel.className) && mais.textContent === "▾", "U3a tocar de novo recolhe");
    mais.onclick();
    /* o toque na unidade leva ao trecho */
    achar(painel, classe(/lei-ir-u /)).filter((b) => /^II/.test(b.textContent))[0].onclick();
    ok(api.$("dlgLeiIr").open !== true, "U4 tocar no inciso fecha o mapa");
    ok(/rolou até o trecho citado/.test(api.leiLogTexto()) && /inciso II/.test(api.leiLogTexto()), "U4a rolou ate' o inciso II: " + api.leiLogTexto().slice(-160));
    /* artigo sem parágrafo nem inciso */
    api.leiIrAbrir();
    const c2 = celDe(api, "2º");
    achar(c2, classe(/lei-ir-mais/))[0].onclick();
    ok(/não tem parágrafos nem incisos/.test(c2.textContent), "U5 artigo sem unidades diz isso: " + c2.textContent);
  }

  /* ==============================================================
   * C: O QUE ERA "ARTIGOS QUE MAIS CAEM"
   * ============================================================== */
  {
    const { api, ch } = montar();
    api.qsAplicar([
      { tipo: "ce", enunciado: "Nos termos do art. 4º, II, o tributo se define pela destinação.", gabarito: "C", comentario: "", chave: ch },
      { tipo: "ce", enunciado: "O art. 4º trata da natureza do tributo.", gabarito: "E", comentario: "", chave: ch },
      { tipo: "ce", enunciado: "Segundo o art. 5º, a receita pública é ingresso.", gabarito: "C", comentario: "", chave: ch },
    ]);
    api.qsTodas().slice(0, 2).forEach((q) => { q.tentativas = [{ acertou: false }]; });
    api.qsTodas()[2].tentativas = [{ acertou: true }];      /* o art. 5º: cai, mas voce acerta */
    api.leiIrAbrir();
    const cel = celDe(api, "4º");
    ok(/lei-ir-erro/.test(cel.children[0].className), "C1 o art. 4º (erro > acerto) tem a borda vermelha: " + cel.children[0].className);
    const q = achar(cel, classe(/lei-ir-q/))[0];
    ok(q && q.textContent === "2", "C2 o selo diz quantas questoes suas citam o artigo: " + (q && q.textContent));
    achar(cel, classe(/lei-ir-mais/))[0].onclick();
    const un = achar(cel, classe(/lei-ir-u /));
    const ii = un.filter((b) => /^II/.test(b.textContent))[0], i1 = un.filter((b) => /^I(?!I)/.test(b.textContent))[0];
    ok(/lei-ir-u-cai/.test(ii.className) && !/lei-ir-u-cai/.test(i1.className), "C3 o inciso II (cobrado) esta destacado e o I nao");
    /* os filtros */
    api.$("btnLeiIrF_erros").onclick();
    const txt = grade(api).textContent;
    ok(/Art\. 4º/.test(txt) && /erros/.test(txt) && !/Art\. 5º/.test(txt), "C4 o filtro 'erros' lista so o art. 4º com o placar: " + txt.slice(0, 120));
    ok(/lei-ir-erro|mat-ligado/.test(api.$("btnLeiIrF_erros").className) && /mat-ligado/.test(api.$("btnLeiIrF_erros").className), "C4a o filtro ativo fica marcado");
    api.$("btnLeiIrF_caem").onclick();
    ok(/Contado nas SUAS questões/.test(grade(api).textContent) && /Art\. 4º/.test(grade(api).textContent) && /Art\. 5º/.test(grade(api).textContent) && /incisos: II/.test(grade(api).textContent), "C5 'mais caem': a nota de amostra, o artigo e o inciso: " + grade(api).textContent.slice(0, 200));
    api.$("btnLeiIrF_prova").onclick();
    ok(/Nenhum artigo desta lei foi citado/.test(grade(api).textContent), "C6 'caiu em prova' sem marcas diz por que esta vazio");
    api.$("btnLeiIrF_parei").onclick();
    ok(/Art\. 3º/.test(grade(api).textContent) && /Você parou aqui/.test(grade(api).textContent), "C7 'onde parei' mostra o art. 3º: " + grade(api).textContent.slice(0, 120));
    api.$("btnLeiIrF_todos").onclick();
    ok(Array.from(grade(api).children).some((c) => eh(c, "details")), "C8 'todos' volta para a arvore");
    /* botao de ver leva ao artigo */
    api.$("btnLeiIrF_erros").onclick();
    achar(grade(api), (c) => eh(c, "button") && /ver no texto/.test(c.textContent))[0].onclick();
    ok(api.$("dlgLeiIr").open !== true, "C9 'ver no texto' fecha o mapa");
  }
  {
    /* lei sem nada a ranquear e sem 'parei' */
    const { api } = montar(LEI, { parei: "" });
    api.leiIrAbrir({ filtro: "parei" });
    ok(/ainda não marcou onde parou/.test(grade(api).textContent), "C10 sem 'parei': " + grade(api).textContent);
    ok(/mat-ligado/.test(api.$("btnLeiIrF_parei").className), "C10a abrir com o filtro ja o deixa marcado");
  }

  /* ==============================================================
   * K: O QUE ERA "CAPÍTULOS" — TEMPO, LIDO E O MARCADOR
   * ============================================================== */
  {
    const { api, l } = montar();
    api.leiIrAbrir();
    const linhas = () => achar(grade(api), classe(/lei-bloco(\s|$)/));
    ok(linhas().length === 4, "K1 quatro blocos de leitura no mapa (sem divisao, titulo, dois capitulos): " + linhas().length);
    ok(linhas().every((x) => /min/.test(x.textContent) && /artigos/.test(x.textContent)), "K1a cada bloco diz quantos artigos e quantos minutos");
    const chk = (i) => achar(linhas()[i], (c) => eh(c, "button") && /lei-bloco-chk/.test(c.className))[0];
    ok(/marcar lido/.test(chk(2).textContent), "K2 o botao de marcar lido");
    chk(2).onclick();                             /* CAPÍTULO I (art. 5º) */
    ok(api.leiBlocosLidos(l.id) === 1 && api.leiProgresso(l.id).artigo === "5", "K3 marcar o capitulo move o marcador para o art. 5º: " + api.leiProgresso(l.id).artigo);
    ok(/lei-bloco-lido/.test(linhas()[2].className) && !/lei-bloco-lido/.test(linhas()[3].className), "K3a so o capitulo marcado fica lido");
    const sms = achar(grade(api), (c) => eh(c, "summary")).map((c) => c.textContent);
    ok(sms.some((s) => /^✓ CAPÍTULO I — Da Receita/.test(s)) && !sms.some((s) => /^✓ CAPÍTULO II/.test(s)), "K3b o resumo do capitulo ganha o ✓: " + sms.join(" | "));
    ok(api.leiDe(l.id).blocos["d:LIVRO PRIMEIRO>TITULO I>CAPITULO I"], "K3c guardado pela chave do bloco: " + JSON.stringify(api.leiDe(l.id).blocos));
    chk(2).onclick();
    ok(api.leiBlocosLidos(l.id) === 0, "K4 tocar de novo desmarca");
    /* o nome do bloco leva ao começo dele */
    achar(linhas()[3], classe(/lei-bloco-nome/))[0].onclick();
    ok(api.$("dlgLeiIr").open !== true, "K5 tocar em 'ler arts. …' fecha o mapa");
  }

  /* ==============================================================
   * B: A BUSCA
   * ============================================================== */
  {
    const { api } = montar();
    api.leiIrAbrir();
    const busca = (q) => { api.$("leiIrBusca").value = q; api.leiIrPintar(); return grade(api).textContent; };
    let t = busca("4");
    ok(/Art\. 4º — A natureza/.test(t) && !/Art\. 5º/.test(t), "B1 '4' acha o art. 4º: " + t.slice(0, 100));
    t = busca("art. 4");
    ok(/Art\. 4º/.test(t), "B1a 'art. 4' tambem");
    t = busca("4 II");
    ok(/Art\. 4º/.test(t) && /Art\. 4º · II/.test(t) && /a destinação/.test(t), "B2 '4 II' acha o inciso II dentro do artigo: " + t.slice(0, 160));
    t = busca("4 § 2º");
    ok(/Art\. 4º · § 2º/.test(t) && /Segundo/.test(t), "B3 '4 § 2º' acha o parágrafo: " + t.slice(0, 160));
    t = busca("receita");
    ok(/CAPÍTULO I — Da Receita/.test(t) && /Art\. 5º/.test(t), "B4 uma palavra acha o capitulo e o artigo: " + t.slice(0, 160));
    t = busca("xyzzy");
    ok(/Nada encontrado para “xyzzy”/.test(t), "B5 sem resultado, diz isso: " + t);
    t = busca("");
    ok(Array.from(grade(api).children).some((c) => eh(c, "details")), "B6 busca vazia volta para a arvore");
    /* O CAMPO DE BUSCA TEM COR PROPRIA. Um <input type=search> sem regra ganha fundo BRANCO do
     * navegador, e o texto do tema escuro (claro) some nele: a pessoa digita e nao ve o que digitou. */
    const css = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const rg = (css.match(/.lei-ir-busca{([^}]*)}/) || [])[1] || "";
    ok(/background:var\(--campo\)/.test(rg) && /;color:var\(--texto\)/.test(rg), "B6a o campo de busca define fundo e cor (senao fica branco no tema escuro): " + rg);
    /* o prefixo: 1 acha o 1º (e nao o resto, que nao começa por 1) */
    t = busca("1");
    ok(/Art\. 1º/.test(t) && !/Art\. 2º/.test(t), "B7 '1' acha o 1º: " + t.slice(0, 80));
  }

  /* ==============================================================
   * G: LEI GRANDE E LEI SEM DIVISÃO
   * ============================================================== */
  {
    const gr = [];
    for (let c = 1; c <= 10; c++) { gr.push("CAPÍTULO " + ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][c - 1] + " — Cap " + c, "Art. " + (c * 2 - 1) + ". Texto.", "Art. " + (c * 2) + ". Texto."); }
    const { api } = montar(gr.join("\n"), { parei: "3" });
    api.leiIrAbrir();
    const dets = () => achar(grade(api), (c) => eh(c, "details"));
    ok(dets().length === 10 && dets().filter((d) => d.open).length === 1, "G1 lei com muitas divisoes abre so o ramo do 'parei': abertos=" + dets().filter((d) => d.open).length);
    ok(achar(grade(api), classe(/lei-ir-n/)).map((c) => c.textContent).join(",") === "3,4", "G1a so o capitulo aberto desenha os artigos: " + achar(grade(api), classe(/lei-ir-n/)).map((c) => c.textContent).join(","));
    /* abrir outro nao se perde ao repintar */
    const d5 = dets()[4];
    d5.open = true; d5.ontoggle();
    api.leiIrPintar();
    ok(dets().filter((d) => d.open).length === 2 && achar(grade(api), classe(/lei-ir-n/)).length === 4, "G2 o que a pessoa abriu continua aberto depois de repintar");
  }
  {
    const sem = []; for (let i = 1; i <= 5; i++) sem.push("Art. " + i + ". Texto " + i + ".");
    const { api } = montar(sem.join("\n"));
    api.leiIrAbrir();
    ok(Array.from(grade(api).children).length === 5 && /lei-ir-grade/.test(grade(api).className), "G3 lei sem divisao: so a grade de artigos, sem arvore");
  }

  /* ==============================================================
   * A: A AJUDA ACOMPANHA A TELA
   * ============================================================== */
  {
    const { api } = montar();
    ok(api.LEI_AJUDA.indexOf("mapa") >= 0 && api.LEI_AJUDA.indexOf("capitulos") < 0 && api.LEI_AJUDA.indexOf("ranking") < 0 && api.LEI_AJUDA.indexOf("artigo") < 0, "A1 a ajuda tem 'mapa' no lugar de capitulos, ranking e artigo: " + api.LEI_AJUDA.join(","));
    api.leiAjudaAbrir();
    const tx = api.$("leiAjudaCx").textContent;
    ok(/Ir para…: o mapa da lei/.test(tx) && !/undefined/.test(tx) && !/lei_aj_/.test(tx), "A2 o texto da ajuda existe e nao mostra chave crua: " + tx.slice(0, 80));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
