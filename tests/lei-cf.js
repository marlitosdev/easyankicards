/* =====================================================================
 * A CONFERÊNCIA NÃO DÁ ALARME FALSO — o caso da CF/88
 *
 * "Mapa e conferência" da CF/88 apontava quatro coisas, e nenhuma era problema na lei:
 *   · "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS" lido como título solto dentro do art. 250
 *     (o ADCT não era reconhecido como divisão);
 *   · "a numeração recomeça no Art. 1º — normal em ADCT" listado em "o que conferir";
 *   · duas seções "sem nome" que TÊM nome, na linha depois da nota de alteração
 *     ("Seção V / (Redação dada pela EC 92/2016) / Do Tribunal Superior do Trabalho…").
 * E a árvore estava errada: o ADCT inteiro ia para dentro do último Título ("arts. 233 a 138").
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O ADCT é uma divisão de topo (ATO): tem o próprio ramo e os próprios blocos; o último Título
 *     termina no último artigo do corpo; o resumo diz "1º a 12" e, à parte, "ADCT de 1º a 10".
 *  2. A numeração é conferida TRECHO A TRECHO: recomeçar no art. 1º do ADCT não é problema, mas um
 *     número isolado dentro do ADCT ou um recomeço no meio de um capítulo continuam apontados.
 *  3. O nome que vem depois da nota é o nome (até 160 caracteres); nota sem nome nenhum continua
 *     "sem nome" e não engole o artigo seguinte.
 *  4. "… REFORMA AGRÁRIA Regulamento" (texto de link) sai do nome; "Da Vigência" não perde nada.
 *  5. "42O", "1o" e "5°" aparecem como "42º", "1º" e "5º".
 *  6. A tela: uma linha de estado, só o grave à vista, avisos recolhidos, um ponto por linha, a
 *     ajuda recolhida, e o relatório com "art. 9º" e o ADCT.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

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
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const { api: p } = rodar();

  const ATO = "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS";
  const adct = [];
  for (let i = 1; i <= 10; i++) adct.push("Art. " + i + (i < 10 ? "º" : "") + ". Texto do ADCT " + i + ".");
  /* corpo 1 a 12, no formato do Planalto: notas de alteração entre o cabeçalho e o nome, e o "Regulamento" do link */
  const CORPO = [
    "TÍTULO IV", "DA ORGANIZAÇÃO DOS PODERES", "CAPÍTULO III", "DO PODER JUDICIÁRIO",
    "Seção IV", "DOS TRIBUNAIS REGIONAIS FEDERAIS E DOS JUÍZES FEDERAIS",
    "Art. 1º Cada Estado.", "Art. 2º Dois.", "Art. 3º Três.", "Art. 4º Quatro.",
    "Seção V", "(Redação dada pela Emenda Constitucional nº 92, de 2016)",
    "Do Tribunal Superior do Trabalho, dos Tribunais Regionais do Trabalho e dos Juízes do Trabalho",
    "Art. 5º São órgãos.", "Art. 6º Seis.",
    "TÍTULO VI", "Da Tributação e do Orçamento", "CAPÍTULO I", "DO SISTEMA TRIBUTÁRIO NACIONAL",
    "Seção V", "DOS IMPOSTOS DOS MUNICÍPIOS", "Art. 7º Compete aos Municípios.",
    "Seção V-A", "", "(Incluído pela Emenda Constitucional nº 132, de 2023)", "", "Do Imposto sobre Bens e Serviços",
    "Art. 8º Lei complementar.",
    "TÍTULO VII", "Da Ordem Econômica", "CAPÍTULO III", "DA POLÍTICA AGRÍCOLA E FUNDIÁRIA E DA REFORMA AGRÁRIA Regulamento",
    "Art. 9º Nove.",
    "TÍTULO IX", "Das Disposições Constitucionais Gerais", "Art. 10. Dez.", "Art. 11. Onze.", "Art. 12. Doze.",
  ];
  const CF = CORPO.concat(["", ATO, ""], adct).join("\n");

  /* ==============================================================
   * P: O PARSER
   * ============================================================== */
  {
    const dg = p.leiDiagnosticarLei(CF);
    ok(dg.itens.length === 0, "P1 a CF no formato do Planalto nao tem NENHUM ponto a conferir: " + JSON.stringify(dg.itens.map((x) => x.tipo + "@" + x.linha)));
    ok(dg.resumo.artigos === 22 && dg.resumo.de === "1º" && dg.resumo.ate === "12", "P2 o resumo fala do corpo (1º a 12), e nao de '1º a 10' do fim do ADCT: " + JSON.stringify([dg.resumo.de, dg.resumo.ate]));
    ok(dg.resumo.atos.length === 1 && dg.resumo.atos[0].rotulo === ATO && dg.resumo.atos[0].de === "1º" && dg.resumo.atos[0].ate === "10" && dg.resumo.atos[0].n === 10, "P2a e o ADCT vem a parte: " + JSON.stringify(dg.resumo.atos));
    ok(dg.resumo.porTipo.ATO === 1 && dg.resumo.divisoes === 12, "P2b uma divisao de topo do tipo ATO: " + JSON.stringify(dg.resumo.porTipo));
    const e = p.leiEstruturaLei(CF);
    const raiz = e.raiz;
    const ultimo = raiz[raiz.length - 1];
    ok(ultimo.tipo === "ATO" && ultimo.total === 10 && e.artigos[ultimo.de].numCru === "1º" && e.artigos[ultimo.ate].numCru === "10", "P3 o ADCT e' o ultimo ramo de topo, com os seus 10 artigos: " + ultimo.rotulo + " " + ultimo.total);
    const t9 = e.nos["TITULO IX"];
    ok(t9.total === 3 && e.artigos[t9.de].numCru === "10" && e.artigos[t9.ate].numCru === "12", "P3a o ultimo Titulo termina no art. 12 e nao engole o ADCT (era 'arts. 233 a 138'): " + t9.total);
    ok(ultimo.pai === "" && ultimo.nivel === 1, "P3b o ADCT e' de topo (nao fica dentro do Titulo IX)");
    /* nomes depois da nota */
    const sv = e.nos["TITULO IV>CAPITULO III>SECAO V"], sva = e.nos["TITULO VI>CAPITULO I>SECAO V-A"];
    ok(sv && sv.nome === "Do Tribunal Superior do Trabalho, dos Tribunais Regionais do Trabalho e dos Juízes do Trabalho" && /Redação dada/.test(sv.nota), "P4 a nota vem antes do nome de 94 caracteres e o nome e' achado: " + (sv && sv.rotulo));
    ok(sva && sva.nome === "Do Imposto sobre Bens e Serviços" && /Incluído/.test(sva.nota), "P4a com linhas em branco entre o cabeçalho, a nota e o nome tambem: " + (sva && sva.rotulo));
    /* link do Planalto */
    const cap3 = e.nos["TITULO VII>CAPITULO III"];
    ok(cap3.rotulo === "CAPÍTULO III — DA POLÍTICA AGRÍCOLA E FUNDIÁRIA E DA REFORMA AGRÁRIA", "P5 o 'Regulamento' do link sai do nome: " + cap3.rotulo);
    ok(p.leiNomeDaDivisao("Da Vigência").nome === "Da Vigência" && p.leiNomeDaDivisao("Do Regulamento Geral").nome === "Do Regulamento Geral" && p.leiNomeDaDivisao("DA VIGÊNCIA").nome === "DA VIGÊNCIA", "P5a nomes que TEM essas palavras nao perdem nada");
    /* blocos de leitura do ADCT sao dele */
    const bl = p.leiBlocos(CF);
    ok(/^d:ATO\|/.test(bl[bl.length - 1].chave) && bl[bl.length - 1].artigos.length === 10 && !/^d:ATO/.test(bl[bl.length - 2].chave), "P6 o ADCT tem o proprio bloco de leitura: " + bl.map((b) => b.chave).slice(-2).join(" | "));
  }
  {
    /* nota sem nome nenhum: continua 'sem nome' e o artigo seguinte e' artigo */
    const t = ["CAPÍTULO IV", "(Incluído pela Lei Complementar nº 236, de 2026)", "Art. 5º Texto do artigo.", "Art. 6º Outro."].join("\n");
    const e = p.leiEstruturaLei(t);
    const cap = e.nos["CAPITULO IV"];
    ok(cap.nome === "" && /Incluído/.test(cap.nota) && e.artigos.length === 2 && e.artigos[0].num === "5", "P7 so a nota e logo um artigo: continua sem nome e o art. 5º nao e' engolido: " + JSON.stringify([cap.nome, e.artigos.length]));
    /* uma linha longa demais depois da nota NAO e' nome */
    const longa = "Este e' um paragrafo de texto corrido que passa dos cento e sessenta caracteres e por isso nao pode ser tomado como o nome de uma divisao, ainda que venha logo depois da nota de alteracao dela.";
    const e2 = p.leiEstruturaLei(["CAPÍTULO V", "(Redação dada pela Lei nº 1)", longa, "Art. 7º Texto."].join("\n"));
    ok(e2.nos["CAPITULO V"].nome === "", "P7a texto corrido (mais de 160 caracteres) depois da nota nao vira nome: " + e2.nos["CAPITULO V"].nome.slice(0, 30));
  }
  {
    /* o "42O" e o ordinal */
    const t = ["Art. 40. A.", "Art. 41. B.", "Art. 42O. Os membros das Polícias.", "Art. 43. D.", "Art. 44-O. E.", "Art. 1o Um.", "Art. 5° Cinco."].join("\n");
    const a = p.leiArtigos(t);
    ok(a[2].numCru === "42º" && a[2].num === "42", "P8 'Art. 42O' aparece como 42º e continua sendo o artigo 42: " + a[2].numCru + "/" + a[2].num);
    ok(a[4].numCru === "44-O" && a[4].num === "44-O", "P8a mas o sufixo de verdade ('44-O') nao muda: " + a[4].numCru);
    ok(a[5].numCru === "1º" && a[6].numCru === "5º", "P8b '1o' e '5°' viram o ordinal: " + a[5].numCru + " " + a[6].numCru);
  }

  /* ==============================================================
   * N: A NUMERAÇÃO POR TRECHO
   * ============================================================== */
  {
    ok(p.leiNumeracao(p.leiArtigos(CF)).problemas.length === 0, "N1 o ADCT recomeca no art. 1º e isso nao e' problema: " + JSON.stringify(p.leiNumeracao(p.leiArtigos(CF)).problemas));
    /* um recomeco NO MEIO de um capitulo (sem ATO) continua apontado */
    const meio = ["CAPÍTULO I", "Nome"]; for (let i = 1; i <= 10; i++) meio.push("Art. " + i + ". T.");
    meio.push("Art. 1º. Um de novo.", "Art. 2º. Dois de novo.");
    const dm = p.leiDiagnosticarLei(meio.join("\n"));
    ok(dm.itens.some((x) => x.tipo === "recomeco"), "N2 recomecar no meio de um capitulo (sem ATO) continua apontado: " + dm.itens.map((x) => x.tipo));
    /* um numero isolado DENTRO do ADCT continua grave */
    const dentro = CORPO.concat(["", ATO, ""]);
    ["1", "2", "3", "90", "4", "5", "6", "7", "8"].forEach((x) => dentro.push("Art. " + x + "º. T."));
    const di = p.leiDiagnosticarLei(dentro.join("\n"));
    ok(di.itens.some((x) => x.tipo === "isolado" && x.gravidade === "grave" && x.numCru === "90º"), "N3 um numero isolado dentro do ADCT continua grave: " + JSON.stringify(di.itens.map((x) => x.tipo + ":" + x.numCru)));
    ok(di.resumo.graves === 1, "N3a e conta como grave: " + di.resumo.graves);
  }

  /* ==============================================================
   * U: A TELA
   * ============================================================== */
  {
    const r = rodar(); const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_cf", nome: "CF/88", texto: CF });
    api.leiAbrir("Direito", "Constitucional", l.id);
    api.leiMapaAbrir();
    const cf = api.$("leiMapaConferir");
    ok(cf.children.length === 1 && /lei-mapa-estado-ok/.test(cf.children[0].className) && /Nada suspeito/.test(cf.children[0].textContent) && /^✓/.test(cf.children[0].textContent), "U1 a CF sai com UMA linha: '✓ Nada suspeito': " + cf.textContent.slice(0, 80));
    ok(/22 artigos · 12 divisões · numeração de 1º a 12 · ADCT de 1º a 10/.test(api.$("leiMapaResumo").textContent), "U2 o resumo: " + api.$("leiMapaResumo").textContent);
    const rel = api.leiRelatorioFluxo("mapa e conferência");
    ok(/numeração de 1º a 12 · ADCT 1º a 10/.test(rel) && /a conferir: 0/.test(rel), "U3 o relatorio traz o ADCT: " + rel.split("\n").filter((x) => /Mapa e conferência/.test(x)).join("|").slice(-120));
    ok(/CAPÍTULO III — DA POLÍTICA AGRÍCOLA E FUNDIÁRIA E DA REFORMA AGRÁRIA · art\. 9º\n/.test(rel) && !/arts\. 9º a 9º/.test(rel), "U3a o relatorio diz 'art. 9º' quando ha um so");
    ok(new RegExp("\\n {4}" + ATO + " · arts\\. 1º a 10 \\(10\\)\\n").test(rel), "U3b e a arvore tem o ADCT como ramo de topo");
    const arv = Array.from(api.$("leiMapaArvore").children);
    const ultimoRamo = arv[arv.length - 1];
    ok(arv.length === 5 && /^ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS · arts\. 1º a 10 \(10\)/.test(ultimoRamo.textContent) && /lei-mapa-no-alto/.test(ultimoRamo.className), "U4 na arvore da tela o ADCT e' um ramo de topo em destaque: " + arv.map((x) => x.textContent.slice(0, 40)));
    ok(api.t("lei_mapa_conferir") === "lei_mapa_conferir" && api.t("lei_mapa_legenda") === "lei_mapa_legenda", "U5 os textos do cabecalho e da legenda antigos sairam");
  }
  {
    /* uma lei COM problema: o grave fica a vista, o resto recolhido, e um ponto ocupa UMA linha */
    const r = rodar(); const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const T = ["Art. 1º A.", "LIVRO PRIMEIRO", "TÍTULO I", "Art. 2º B.", "Art. 3º C.", "SISTEMA INDEVIDO", "Art. 4º D.", "Art. 5º E.", "Art. 6º F.", "CAPÍTULO II",
      "Art. 7º G.", "Art. 8-A. H.", "Art. 9º I.", "Art. 40. Uma remissão.", "Art. 10. J.", "Art. 11. K.", "Art. 12. L."].join("\n");
    const l = api.leiGuardar({ id: "lei_p", nome: "Lei P", texto: T });
    api.leiAbrir("Direito", "T", l.id);
    api.leiMapaAbrir();
    const cf = api.$("leiMapaConferir");
    const grupos = achar(cf, (c) => eh(c, "details") && /lei-mapa-grupo/.test(c.className || ""));
    ok(/lei-mapa-estado-grave/.test(cf.children[0].className) && /^⚠ 1 a conferir · 2 avisos · 3 divisões sem nome/.test(cf.children[0].textContent), "U6 a linha de estado conta o que ha: " + cf.children[0].textContent);
    ok(grupos.length === 2 && grupos.every((g) => g.open !== true), "U6a os avisos e as divisoes sem nome nascem RECOLHIDOS");
    const fora = Array.from(cf.children).filter((c) => /lei-mapa-item/.test(c.className || ""));
    ok(fora.length === 1 && /isolado/.test(fora[0].textContent) && /lei-mapa-g-grave/.test(fora[0].className), "U6b so o ponto GRAVE fica a vista: " + fora.map((x) => x.textContent.slice(0, 50)));
  }

  /* ==============================================================
   * T: HTML, CSS E TEXTOS
   * ============================================================== */
  {
    const pos = (s) => html.indexOf(s);
    ok(pos('id="leiMapaConferir"') < pos('class="lei-mapa-como"') && pos('class="lei-mapa-como"') < pos('data-i18n="lei_mapa_arvore"'), "T1 a explicacao ('como ler esta tela') fica RECOLHIDA, depois da conferencia (nao ocupa o topo)");
    ok(/<details class="lei-mapa-como">\s*<summary data-i18n="lei_mapa_como"><\/summary>\s*<p class="nota" data-i18n="lei_mapa_ajuda"><\/p>/.test(html), "T1a e e' um <details> com o texto da ajuda");
    ok((html.match(/data-i18n="lei_mapa_ajuda"/g) || []).length === 1, "T1b o paragrafo de ajuda existe UMA vez (dentro do details), e nao tambem solto no topo do dialogo");
    ok(/id="btnLeiRelMapa" data-i18n="lei_rel_btn_curto"/.test(html) && p.t("lei_rel_btn_curto") === "🐞 relatório", "T2 o botao do relatorio e' curto: " + p.t("lei_rel_btn_curto"));
    ok(/\.lei-mapa-estado-ok\{[^}]*color:var\(--verde\)\}/.test(html) && /\.lei-mapa-estado-grave\{[^}]*#ef4444/.test(html), "T3 a linha de estado e' verde ou vermelha");
    ok(/\.lei-mapa-g-grave>\.nota::before\{color:#ef4444\}/.test(html) && /\.lei-mapa-g-aviso>\.nota::before\{color:#f59e0b\}/.test(html) && /\.lei-mapa-g-leve>\.nota::before\{color:var\(--sutil\)\}/.test(html) && /\.lei-mapa-item-compacto>\.nota::before\{content:"●"/.test(html), "T4 a bolinha de cada gravidade");
    ok(p.t("lei_mapa_ok").indexOf("✓") === 0 && p.t("lei_mapa_c_isolado", { n: "40", l: 5 }) === "art. 40 · linha 5 · número isolado (remissão lida como artigo?)", "T5 os textos curtos");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
