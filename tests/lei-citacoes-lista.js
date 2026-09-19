/* =====================================================================
 * A CITAÇÃO É UMA LISTA, O ARTIGO TEM ESTRUTURA E O VÍNCULO PODE SER CORRIGIDO
 *
 * O QUE O USO REAL MOSTROU (com print):
 *  1. "previstos nos arts. 77, 78 e 79 do CTN" só marcava "arts. 77" e não
 *     achava o CTN: depois do primeiro número a leitura parava.
 *  2. Não havia como ligar depois um trecho que o app não entendeu, nem
 *     dizer "este vínculo está errado".
 *  3. A conferência de repetidos tratava "§ 4º" e "§ 4º-A/-B/-C" (e "§ 19" e
 *     "§ 19-A") como o mesmo item: o sufixo era ignorado. Faltava ao leitor
 *     a estrutura do artigo (LC 95/1998): parágrafo, inciso, alínea, item.
 *  4. Artigos revogados em grupo ("Arts. 12 a 15 (Revogados)") criavam uma
 *     "lacuna de numeração" que não existe.
 *  5. Escolher qual redação de um artigo repetido fica não dava como ver o
 *     trecho no texto, com os vizinhos, sem fechar a tela.
 *  6. Uma falha no fluxo de atualização não deixava rastro para relatar.
 * ===================================================================== */
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
  const { api: p } = rodar();
  const cit = (txt) => p.leiCitacoesNoTexto(txt);
  const resumo = (txt) => JSON.stringify(cit(txt).map((c) => [c.texto, c.num, c.rotulo]));

  /* ==============================================================
   * L: A CITAÇÃO É UMA LISTA
   * ============================================================== */
  {
    const c = cit("previstos nos arts. 77, 78 e 79 do CTN");
    ok(c.length === 3 && c.map((x) => x.num).join(",") === "77,78,79", "L1 a lista de 3 artigos nao virou 3 citacoes: " + resumo("previstos nos arts. 77, 78 e 79 do CTN"));
    ok(c.every((x) => x.rotulo === "CTN"), "L1a o 'do CTN' vale para os TRES artigos: " + JSON.stringify(c.map((x) => x.rotulo)));
    ok(c[0].texto === "arts. 77" && c[1].texto === "78" && c[2].texto === "79 do CTN", "L1b cada artigo e' o seu proprio pedaço, e o ultimo engole a lei: " + JSON.stringify(c.map((x) => x.texto)));
  }
  {
    const t = "conforme arts. 148, I, 153, I, II, IV e V; e 154, II, da CF/88";
    const c = cit(t);
    ok(c.map((x) => x.num).join(",") === "148,153,154" && c.every((x) => x.rotulo === "CF/88"), "L2 lista com incisos e ';': " + resumo(t));
    ok(c[0].incisos.join("/") === "I" && c[1].incisos.join("/") === "I/II/IV/V" && c[2].incisos.join("/") === "II",
       "L2a os incisos de cada artigo: " + JSON.stringify(c.map((x) => x.incisos)));
    /* a lista NÃO pode mudar uma letra do texto: os pedaços + o que sobra reconstituem tudo */
    let pos = 0, rec = "";
    c.forEach((x) => { rec += t.slice(pos, x.ini) + x.texto; pos = x.fim; });
    rec += t.slice(pos);
    ok(rec === t, "L2b as citacoes nao reconstituem o texto");
  }
  ok(cit("os arts. 5º e 6º, 10 dias depois").map((x) => x.num).join(",") === "5,6" && cit("os arts. 5º e 6º, 10 dias depois")[1].texto === "6º",
     "L3 o '10 dias' virou artigo: " + resumo("os arts. 5º e 6º, 10 dias depois"));
  ok(cit("art. 20, o prazo é de 30 dias").length === 1 && cit("art. 5º, 10 dias").length === 1, "L3a 'art. 5º, 10 dias' virou lista");
  ok(cit("art. 77, 78").length === 1, "L4 lista no singular SEM lei no fim devia ser so o primeiro: " + resumo("art. 77, 78"));
  ok(cit("art. 77, 78 e 79 do CTN").length === 3, "L4a lista no singular que TERMINA numa lei vale: " + resumo("art. 77, 78 e 79 do CTN"));
  ok(cit("arts. 77 a 79 do CTN").map((x) => x.num).join(",") === "77,79" && cit("arts. 77 a 79 do CTN").every((x) => x.rotulo === "CTN"), "L5 faixa 77 a 79: " + resumo("arts. 77 a 79 do CTN"));
  ok(p.leiCitacoes("arts. 77, 78 e 79 do CTN").map((x) => x.num).join(",") === "77,78,79", "L6 a contagem por artigo (ranking) devia ver os tres");
  ok(cit("art. 156-A, § 1º, IV, da CF/88").length === 1 && cit("art. 156-A, § 1º, IV, da CF/88")[0].paragrafos[0] === "1º", "L7 a citacao simples continua igual");

  /* ==============================================================
   * E: A ESTRUTURA DO ARTIGO (LC 95/1998)
   * ============================================================== */
  const CF = [
    "Art. 40. Os servidores titulares de cargos efetivos terão regime próprio de previdência social.",
    "§ 4º É vedada a adoção de requisitos ou critérios diferenciados, ressalvado o disposto nos §§ 4º-A, 4º-B, 4º-C e 5º. (Redação dada pela Emenda Constitucional nº 103, de 2019)",
    "§ 4º-A. Poderão ser estabelecidos por lei complementar idade e tempo de contribuição diferenciados. (Incluído pela Emenda Constitucional nº 103, de 2019)",
    "§ 4º-B. Poderão ser estabelecidos por lei complementar idade e tempo de contribuição para agente penitenciário.",
    "§ 4º-C. Poderão ser estabelecidos por lei complementar idade e tempo de contribuição para servidores.",
    "§ 5º Os requisitos de idade e de tempo de contribuição serão reduzidos em cinco anos.",
    "Art. 100. Os pagamentos devidos pelas Fazendas Públicas serão feitos na ordem cronológica.",
    "§ 19. Caso o montante total de débitos ultrapasse a média do comprometimento da receita, a parcela que exceder poderá:",
    "I - ser paga em parcelas;",
    "II - ser paga com desconto;",
    "§ 19-A. A União fica autorizada a instituir linha de crédito especial. (Incluído pela Emenda Constitucional nº 136, de 2025)",
    "Art. 149. Compete exclusivamente à União instituir contribuições sociais.",
    "§ 1º A União, os Estados, o Distrito Federal e os Municípios instituirão contribuições. (Redação dada pela Emenda Constitucional nº 103, de 2019)",
    "§ 1º-A. Quando houver déficit atuarial, a contribuição ordinária poderá incidir. (Incluído pela Emenda Constitucional nº 103, de 2019)",
    "§ 1º-B. Demonstrada a insuficiência da medida prevista no § 1º-A, é facultada a instituição de contribuição extraordinária. (Incluído pela Emenda Constitucional nº 103, de 2019)",
  ].join("\n");
  ok(p.leiDuplicados(CF).length === 0, "E1 § 4º e § 4º-A/-B/-C (ou § 19 e § 19-A) foram apontados como repetidos: " + JSON.stringify(p.leiDuplicados(CF).map((g) => g.num)));

  const A153 = [
    "Art. 153. Compete à União instituir impostos sobre: I - importação; II - exportação; III - renda; IV - produtos industrializados;",
    "§ 1º É facultado ao Poder Executivo alterar as alíquotas dos impostos enumerados nos incisos I, II, IV e V.",
    "§ 2º O imposto previsto no inciso III:",
    "I - será informado pelos critérios da generalidade;",
    "II - não incidirá sobre rendimentos:",
    "a) os proventos de aposentadoria;",
    "b) outros proventos;",
    "1. subitem um;",
    "2. subitem dois;",
    "III - o resto.",
    "§ 3º O imposto previsto no inciso IV:",
    "Parágrafo único. Regra final.",
  ].join("\n");
  {
    const est = p.leiEstruturaArtigo(A153);
    const ch = est.unidades.map((u) => u.chave).join(" ");
    ok(ch === "I II III IV P1 P2 P2>I P2>II P2>II>a P2>II>b P2>II>b>1 P2>II>b>2 P2>III P3 PU",
       "E2 hierarquia (caput, §, inciso, alinea, item): " + ch);
    ok(est.unidades[0].inicioDeLinha === false && est.unidades[4].inicioDeLinha === true, "E2a os incisos corridos no caput nao comecam a linha");
    ok(est.caput.texto === "Compete à União instituir impostos sobre:", "E2b o texto proprio do caput nao inclui os incisos: " + est.caput.texto);
    /* "os incisos I, II, IV e V" dentro do §1º NAO sao incisos */
    ok(est.unidades.filter((u) => u.chave === "P1").length === 1 && !est.unidades.some((u) => /^P1>/.test(u.chave)), "E2c remissao a incisos dentro do §1º virou inciso");
    ok(p.leiRotuloDaUnidade(est.unidades[9]) === "alínea b do inciso II do §2º", "E2d rotulo da unidade: " + p.leiRotuloDaUnidade(est.unidades[9]));
  }
  {
    /* a citação leva ao inciso: caput, §, inciso do § */
    const un = (sub) => p.leiAcharUnidades(A153, sub).map((u) => u.chave).join(",");
    ok(un({ incisos: ["II", "IV"], paragrafos: [] }) === "II,IV", "E3 incisos do caput: " + un({ incisos: ["II", "IV"], paragrafos: [] }));
    ok(un({ incisos: ["II"], paragrafos: ["2º"] }) === "P2>II", "E3a inciso II do §2º: " + un({ incisos: ["II"], paragrafos: ["2º"] }));
    ok(un({ incisos: [], paragrafos: ["3º"] }) === "P3" && un({ incisos: [], paragrafos: ["único"] }) === "PU", "E3b paragrafos");
    ok(un({ incisos: ["II"], paragrafos: ["2º"], alineas: ["b"] }) === "P2>II,P2>II>b", "E3c alinea b do inciso II: " + un({ incisos: ["II"], paragrafos: ["2º"], alineas: ["b"] }));
    ok(p.leiContextoDeLinhas("a\nb\nc\nd\ne", 3, 3, 1, 1).map((x) => x.n + (x.alvo ? "*" : "")).join(",") === "2,3*,4", "E3d contexto de linhas");
  }
  {
    /* o "§ 5º" antigo e o novo (mesmo endereço) continuam sendo apontados; o -A nao */
    const t = ["Art. 9º. Vedado ao Município:", "§ 5º. Texto antigo do cinco.", "§ 5º. Texto novo do cinco. (Redação dada pela LC 18/2009)", "§ 5º-A. Texto do cinco-A. (Incluído pela LC 18/2009)", "Art. 10. Outro."].join("\n");
    const g = p.leiDuplicados(t);
    ok(g.length === 1 && g[0].num === "9#P5" && g[0].candidatos.length === 2, "E4 so os DOIS §5º sao repetidos (o 5º-A nao): " + JSON.stringify(g.map((x) => [x.num, x.candidatos.length])));
    /* incisos repetidos lado a lado (redação velha + nova) */
    const i = ["Art. 20. Requisitos:", "I - texto antigo do primeiro;", "I - texto novo do primeiro; (Redação dada pela LC 1/2001)", "II - segundo.", "Art. 21. Outro."].join("\n");
    const gi = p.leiDuplicados(i);
    ok(gi.length === 1 && gi[0].num === "20#I", "E4a inciso repetido lado a lado: " + JSON.stringify(gi.map((x) => x.num)));
    /* lista que recomeça em outro pai NAO e' repetição */
    const r = ["Art. 30. Regras:", "§ 1º Primeiro:", "I - a;", "II - b;", "§ 2º Segundo:", "I - a;", "II - b;", "Art. 31. Outro."].join("\n");
    ok(p.leiDuplicados(r).length === 0, "E4b incisos I e II de dois paragrafos diferentes foram apontados como repetidos");
  }
  {
    /* artigos revogados em grupo */
    const t = ["Art. 10. Dez.", "Art. 11. Onze.", "Arts. 12 a 15 (Revogados pela Lei Complementar nº 9, de 2010)", "Art. 16. Dezesseis.", "Art. 17. Dezessete.", "Art. 18. Dezoito.", "Art. 19. Dezenove.", "Art. 20. Vinte."].join("\n");
    const as = p.leiArtigos(t);
    ok(as.map((a) => a.rotulo).join("|") === "Art. 10|Art. 11|Arts. 12 a 15|Art. 16|Art. 17|Art. 18|Art. 19|Art. 20", "R1 o grupo revogado nao virou um item: " + as.map((a) => a.rotulo).join("|"));
    ok(as[2].faixaFim === 15 && !/Arts/.test(as[1].texto), "R1a o grupo engoliu o texto do artigo de cima ou perdeu a faixa");
    ok(p.leiNumeracao(as).problemas.length === 0, "R2 o grupo revogado gerou lacuna de numeracao: " + JSON.stringify(p.leiNumeracao(as).problemas));
    ok(p.leiArtigo(t, "13") && p.leiArtigo(t, "13").num === "12" && p.leiArtigo(t, "15") && !p.leiArtigo(t, "16-B"), "R3 um artigo dentro do grupo devia ser achado pelo numero");
    /* sem a palavra "revogado", "Art. 12 e 13" é artigo comum */
    ok(p.leiLerFaixaRevogada("Art. 12 e 13 obrigam o contribuinte") === null && p.leiLerFaixaRevogada("Arts. 12 e 13 (Vetados)") !== null, "R4 so vale com revogado/vetado na linha");
    /* sem o grupo, a lacuna existe (controle) */
    const sem = t.replace(/Arts\. 12 a 15.*\n/, "");
    ok(p.leiNumeracao(p.leiArtigos(sem)).problemas.length === 1, "R5 (controle) sem o grupo a lacuna devia aparecer");
    /* §§ e incisos revogados em faixa */
    const u = ["Art. 40. Regras:", "§ 1º Primeiro.", "§§ 2º a 4º (Revogados)", "§ 5º Quinto.", "Art. 41. Outro."].join("\n");
    ok(p.leiEstruturaArtigo(p.leiArtigos(u)[0].texto).unidades.map((x) => x.chave).join(",") === "P1,P2,P5", "R6 §§ 2º a 4º revogados: " + p.leiEstruturaArtigo(p.leiArtigos(u)[0].texto).unidades.map((x) => x.chave));
    const v = ["Art. 50. Requisitos:", "I - a;", "II a IV (Revogados)", "V - e;", "Art. 51. Outro."].join("\n");
    ok(p.leiEstruturaArtigo(p.leiArtigos(v)[0].texto).unidades.map((x) => x.chave).join(",") === "I,II,V", "R7 incisos II a IV revogados: " + p.leiEstruturaArtigo(p.leiArtigos(v)[0].texto).unidades.map((x) => x.chave));
  }

  /* ==============================================================
   * V: O VÍNCULO PERMANENTE
   * ============================================================== */
  {
    const { api } = rodar();
    ok(api.citLerArtigos("77, 78º e 79-A e 80").map((a) => a.num).join(",") === "77,78,79-A,80", "V1 leitura dos artigos digitados: " + JSON.stringify(api.citLerArtigos("77, 78º e 79-A e 80")));
    ok(api.citVinculoSalvar({ trecho: "  os arts. 77   a 79 do CTN", leiId: "lei_x", artigos: api.citLerArtigos("77, 79") }) && api.citVinculosLer().length === 1, "V2 nao gravou o vinculo");
    const txt = "conforme os arts. 77 a 79\ndo CTN, e depois arts. 5º da CF";
    const cits = api.citVinculosAplicar(txt, api.leiCitacoesNoTexto(txt));
    const perm = cits.filter((c) => c.permanente);
    ok(perm.length === 1 && perm[0].leiId === "lei_x" && perm[0].num === "77" && /^os arts\. 77\s+a 79\s+do CTN$/.test(perm[0].texto),
       "V3 o trecho guardado (com quebra de linha no meio) nao foi achado no texto: " + JSON.stringify(perm.map((c) => c.texto)));
    ok(cits.filter((c) => !c.permanente).length === 1 && /CF|arts\. 5/.test(cits.filter((c) => !c.permanente)[0].texto), "V3a as citacoes automaticas que nao estao no trecho continuam");
    ok(cits.every((c, i) => i === 0 || cits[i - 1].fim <= c.ini), "V3b as citacoes se sobrepoem");
    ok(api.citVinculoSalvar({ trecho: "OS ARTS. 77 A 79 DO CTN", leiId: "lei_y" }) && api.citVinculosLer().length === 1 && api.citVinculosLer()[0].leiId === "lei_y", "V4 o mesmo trecho (caixa/espaco) devia SUBSTITUIR o vinculo, nao duplicar");
    ok(api.citVinculoRemover(api.citVinculosLer()[0].k) === true && api.citVinculosLer().length === 0, "V5 remover");
  }

  /* ==============================================================
   * U: A TELA — comentário, vínculos, rolar até o inciso, contexto, relatório
   * ============================================================== */
  const DISC = "Direito Tributário", TOP = "Obrigação tributária";
  const montar = () => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "", especie: "Lei", numero: "5.172",
      texto: ["Art. 77. A taxa cobrada pela União tem como fato gerador o exercício regular do poder de polícia.", "Art. 78. Considera-se poder de polícia a atividade da administração.", "Art. 79. Os serviços públicos.",
        "Art. 80. Outro."].join("\n") });
    api.leiGuardar({ id: "lei_cf", nome: "Constituição Federal de 1988", apelido: "CF/88", especie: "Constituição", numero: "",
      texto: A153 + "\nArt. 154. A União poderá instituir:\nI - impostos.\nII - outros impostos." });
    api.leiLigar("lei_ctn", ch);
    const q = { disciplina: DISC, topico: TOP, comentario: "Os valores estão previstos nos arts. 77, 78 e 79 do CTN, e em nada mudam." };
    return { api, ch, q };
  };
  const links = (api, el) => achar(el, (c) => /qs-lei-link/.test(c.className || "") && c.tagName !== "SPAN");
  {
    const { api, q } = montar();
    const el = api.document.createElement("div");
    api.qsUiComentario(el, q);
    const ls = links(api, el);
    ok(ls.length === 3, "U1 o comentario devia ter 3 links: " + ls.length);
    ok(ls.every((b) => !/qs-lei-link-sem/.test(b.className)), "U1a os links devem apontar para a lei (CTN pela sigla): " + ls.map((b) => b.className).join("|"));
    ok(ls.map((b) => b.textContent).join("|") === "arts. 77|78|79 do CTN" && el.textContent === q.comentario, "U1b o texto do comentario mudou: " + el.textContent);
    ls[1].onclick();
    ok(api.leiIdAtualValor() === "lei_ctn" && api.$("dlgLeiSeca").open === true, "U2 clicar em '78' devia abrir o CTN");
  }
  {
    /* a citação leva ao inciso: rola e destaca */
    const { api } = montar();
    api.leiAbrirNoArtigo("", "", "lei_cf", "153", { incisos: ["II", "IV"], paragrafos: [], alineas: [] });
    const bloco = api.leiBlocoDoArtigo("153");
    ok(!!bloco, "U3 o bloco do art. 153 nao foi desenhado");
    /* (o destaque some no mesmo instante no simulador, cujo setTimeout e' sincrono: confere pelo retorno e pelo registro) */
    const sub = { incisos: ["II", "IV"], paragrafos: [], alineas: [] };
    ok(api.leiIrUnidade("153", sub) === true && /rolou até o trecho citado/.test(api.leiLogTexto()) && /inciso II, inciso IV/.test(api.leiLogTexto()),
       "U3a o inciso citado nao foi localizado na tela: " + api.leiLogTexto().slice(-200));
    ok(api.leiIrUnidade("153", { incisos: ["IX"], paragrafos: [] }) === false, "U3aa inciso inexistente devia devolver false");
    /* o preview mostra o trecho citado */
    const c0 = api.leiCitacoesNoTexto("art. 153, II, da CF/88")[0];
    api.leiCitacaoPreviewAbrir(c0, "");
    ok(/Trecho citado/.test(api.$("leiCitaPreviewTexto").textContent || "") && /inciso II/.test(api.$("leiCitaPreviewTexto").textContent || ""),
       "U3b o preview nao separa o trecho citado: " + (api.$("leiCitaPreviewTexto").textContent || "").slice(-160));
  }
  {
    /* "este vínculo está errado": corrigir a lei e fixar */
    const { api, q } = montar();
    q.comentario = "Conforme os arts. 148, I, 153, II do imposto federal.";        /* sem lei nomeada */
    const el = api.document.createElement("div");
    api.qsUiComentario(el, q);
    ok(links(api, el).every((b) => /qs-lei-link-sem/.test(b.className) === false || true) && links(api, el).length === 2, "U4 comentario sem lei nomeada");
    api.qsVincAbrir(q, el, "");
    const cards = achar(api.$("qsVincLista"), (c) => /lei-bib-card/.test(c.className || ""));
    ok(cards.length === 2 && /lei não identificada|abre/.test(cards[0].textContent), "U4a o dialogo devia listar as duas citacoes e o que o app entendeu: " + cards.map((c) => c.textContent).join(" || "));
    ok(achar(api.$("qsVincSel"), (c) => c.id === "btnQsVincSel").length === 0 && /Nenhum trecho selecionado/.test(api.$("qsVincSel").textContent || ""), "U4b sem selecao devia dizer como selecionar");
    achar(cards[1], (c) => /^btnQsVincErrado_/.test(c.id || ""))[0].onclick();
    ok(api.$("dlgQsVincEsc").open === true && api.$("qsVincArts").value === "153", "U4c a tela de correcao devia abrir com o artigo do trecho: " + api.$("qsVincArts").value);
    api.$("btnQsVincEscOk").onclick();
    ok(/Escolha a lei/.test(api.$("qsVincEscAviso").textContent || "") && api.citVinculosLer().length === 0, "U4d sem escolher a lei nao pode gravar");
    api.$("qsVincLei").value = "lei_cf";
    api.$("qsVincArts").value = "153, 154";
    api.$("btnQsVincEscOk").onclick();
    const v = api.citVinculosLer();
    ok(v.length === 1 && v[0].leiId === "lei_cf" && v[0].artigos.map((a) => a.num).join(",") === "153,154", "U4e o vinculo permanente nao foi gravado: " + JSON.stringify(v));
    const el2 = api.document.createElement("div");
    api.qsUiComentario(el2, q);
    const l2 = links(api, el2);
    ok(l2.some((b) => /qs-lei-link-perm/.test(b.className)) && el2.textContent === q.comentario, "U4f o comentario devia mostrar o vinculo permanente sem mudar o texto");
    const perm = l2.filter((b) => /qs-lei-link-perm/.test(b.className))[0];
    perm.onclick();
    ok(api.leiIdAtualValor() === "lei_cf", "U4g o vinculo permanente devia abrir a lei fixada (CF): " + api.leiIdAtualValor());
    /* remover */
    api.qsVincAbrir(q, el2, "");
    const rm = achar(api.$("qsVincLista"), (c) => /^btnQsVincRemover_/.test(c.id || ""))[0];
    ok(!!rm, "U4h o vinculo permanente devia ter o botao remover");
    rm.onclick();
    ok(api.citVinculosLer().length === 0, "U4i remover nao apagou");
  }
  {
    /* vincular um trecho SELECIONADO, sem tornar permanente: só abre agora */
    const { api, q } = montar();
    const el = api.document.createElement("div");
    api.qsUiComentario(el, q);
    api.qsVincAbrir(q, el, "nos arts. 77, 78 e 79 do CTN");
    const bSel = achar(api.$("qsVincSel"), (c) => c.id === "btnQsVincSel")[0];
    ok(!!bSel, "U5 com trecho selecionado devia haver o botao de vincular");
    bSel.onclick();
    ok(api.$("qsVincArts").value === "77, 78, 79", "U5a os artigos do trecho selecionado vem preenchidos: " + api.$("qsVincArts").value);
    api.$("qsVincLei").value = "lei_ctn";
    api.$("qsVincPerm").checked = false;
    api.$("btnQsVincEscOk").onclick();
    ok(api.citVinculosLer().length === 0 && api.leiIdAtualValor() === "lei_ctn", "U5b desmarcado 'permanente' nao pode gravar, so abrir");
  }
  {
    /* ver o trecho no texto, com os vizinhos, dentro da tela de repetidos */
    const { api } = montar();
    const t = ["Art. 1º. Um.", "Art. 2º. Dois.", "Art. 3º. Antigo três do código.", "Art. 3º. Novo três do código mudado. (Redação dada pela LC 018/2009)", "Art. 4º. Quatro.", "Art. 5º. Cinco."].join("\n");
    const g = api.leiDuplicados(t);
    api.leiDuplicadosAbrir({ modo: "criar", texto: t, grupos: g, aoConfirmar() {} });
    const dets = achar(api.$("leiDupLista"), (c) => /lei-dup-ctx-det/.test(c.className || ""));
    ok(dets.length === 2, "U6 cada ocorrencia devia ter o 'ver no texto': " + dets.length);
    dets[0].encher();
    const ls = achar(dets[0], (c) => /lei-ctx-l/.test(c.className || ""));
    ok(ls.length >= 5 && ls.filter((c) => /lei-ctx-alvo/.test(c.className)).length === 1 && /Art\. 2º/.test(ls[0].textContent + ls[1].textContent),
       "U6a o contexto devia mostrar o vizinho e destacar so a ocorrencia: " + ls.map((c) => c.textContent).join(" | "));
    ok(api.$("dlgLeiDup").open === true, "U6b a tela de repetidos nao pode fechar");
  }
  {
    /* o relatório do fluxo e a falha que deixa rastro */
    const { api } = montar();
    const t = ["Art. 1º. Um.", "Art. 2º. Dois.", "Art. 3º. Antigo.", "Art. 3º. Novo. (Redação dada pela LC 18/2009)"].join("\n");
    api.leiDuplicadosAbrir({ modo: "criar", texto: t, grupos: api.leiDuplicados(t), aoConfirmar() {} });
    const rel = api.leiRelatorioFluxo("artigos repetidos");
    ok(/Artigos repetidos \(criar\): 1 grupo/.test(rel) && /linha 3/.test(rel) && /linha 4/.test(rel) && /redacao|redação/i.test(rel),
       "U7 o relatorio nao descreve os grupos, as linhas e os sinais: " + rel.slice(0, 500));
    ok(/repetido: Art\. 3/.test(rel), "U7a o registro nao tem uma linha por grupo");
    ok(/EasyAnkiCards/.test(rel) && /Registro \(últimas 60/.test(rel), "U7b o relatorio sem versao/registro");
    const seguro = api.leiSeguro("etapa de teste", () => { throw new Error("estourou de proposito"); });
    ok(seguro() === false && /falha em etapa de teste/.test(api.leiLogTexto()) && /estourou de proposito/.test(api.leiLogTexto()),
       "U7c uma falha no fluxo nao deixou linha [erro] no registro: " + api.leiLogTexto().slice(-300));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
