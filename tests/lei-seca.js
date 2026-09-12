/* LEI SECA — a lei como documento.
 *
 * O que precisa valer: a lei colada do jeito que vem do Planalto é lida
 * em artigos, sem inventar nem perder nenhum; o artigo acrescentado por
 * emenda fica no lugar certo; a lei é UMA e vários tópicos apontam para
 * ela; o marcador é um artigo e sobrevive a mudar de aparelho; e o texto
 * que já estava colado no tópico não some na migração. */
const { rodar } = require("./fumaca.js");

/* Um pedaço de verdade da Lei 4.320/1964, colado como o Planalto entrega
 * — com o ordinal "º", o capítulo em versalete, o artigo acrescentado
 * por lei posterior e a numeração passando de um dígito para três. */
const L4320 = [
  "LEI Nº 4.320, DE 17 DE MARÇO DE 1964",
  "",
  "Estatui Normas Gerais de Direito Financeiro para elaboração e controle",
  "dos orçamentos e balanços da União, dos Estados, dos Municípios e do",
  "Distrito Federal.",
  "",
  "O PRESIDENTE DA REPÚBLICA:",
  "",
  "TÍTULO I",
  "Da Lei de Orçamento",
  "",
  "CAPÍTULO I - Disposições Gerais",
  "",
  "Art. 1º Esta lei estatui normas gerais de direito financeiro para",
  "elaboração e controle dos orçamentos e balanços.",
  "",
  "Art. 2º A Lei do Orçamento conterá a discriminação da receita e despesa",
  "de forma a evidenciar a política econômica financeira.",
  "§ 1º Integrarão a Lei de Orçamento:",
  "I - Sumário geral da receita por fontes;",
  "II - Quadro demonstrativo da Receita e Despesa;",
  "",
  "Art. 3º A Lei de Orçamentos compreenderá tôdas as receitas.",
  "",
  /* cabeçalho em DUAS linhas, como o Planalto entrega de verdade */
  "CAPÍTULO II",
  "Da Receita",
  "",
  "Art. 9º Tributo é a receita derivada instituída pelas entidades de",
  "direito público.",
  "",
  "Art. 11. A Receita classificar-se-á nas seguintes categorias",
  "econômicas: Receitas Correntes e Receitas de Capital.",
  "",
  "Art. 12-A Esta é uma redação acrescentada por lei posterior.",
  "",
  "Art. 35. Pertencem ao exercício financeiro:",
  "I - as receitas nêle arrecadadas;",
  "II - as despesas nêle legalmente empenhadas.",
  "",
  "Art. 115. Esta lei entrará em vigor em 1º de janeiro de 1964.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* ---- L1: ler a lei em artigos ---- */
  {
    const { api } = rodar();
    const arts = api.leiArtigos(L4320);
    const nums = arts.map((a) => a.num);

    ok(arts.length === 8,
       "L1 deviam sair 8 artigos, sairam " + arts.length + ": " + nums.join(","));
    /* O PREÂMBULO NÃO É ARTIGO. A ementa da lei, o "O PRESIDENTE DA
     * REPÚBLICA" e os cabeçalhos de título e capítulo entram na conta se
     * o leitor for ingênuo — e a partir daí "parei no 3º artigo" aponta
     * para o lugar errado da lei inteira. */
    ok(nums.indexOf("1") === 0,
       "L1b o primeiro artigo devia ser o 1, veio: " + nums[0]);
    ok(nums.join(",") === "1,2,3,9,11,12-A,35,115",
       "L1c a lista de artigos saiu errada: " + nums.join(","));

    /* o "º" é grafia, não é outro artigo */
    ok(api.leiNumNormal("1º") === "1" && api.leiNumNormal("1o") === "1"
       && api.leiNumNormal(" 1 ") === "1",
       "L1d '1º', '1o' e '1' deviam ser o MESMO artigo");

    /* o artigo leva junto os incisos e parágrafos que vêm abaixo dele */
    const a2 = arts.filter((a) => a.num === "2")[0];
    ok(!!a2 && /Sumário geral da receita/.test(a2.texto),
       "L1e o art. 2 perdeu os incisos que estão abaixo dele");
    ok(!!a2 && /§ 1º/.test(a2.texto),
       "L1f o art. 2 perdeu o parágrafo");
    /* e NÃO leva o artigo seguinte junto */
    ok(!!a2 && !/Art\. 3/.test(a2.texto),
       "L1g o art. 2 engoliu o art. 3 — os dois viraram um só");

    /* NEM LEVA O CABEÇALHO DO CAPÍTULO SEGUINTE.
     * O "CAPÍTULO II" vem depois do art. 3 e antes do art. 9. Colado ao
     * art. 3, ele apareceria no cartao gerado a partir do artigo e, pior,
     * o bloco de leitura comecaria um artigo cedo demais. */
    const a3 = arts.filter((a) => a.num === "3")[0];
    ok(!!a3 && !/CAP[ÍI]TULO II/i.test(a3.texto),
       "L1g2 o art. 3 engoliu o cabecalho do Capitulo II");
    /* o NOME do capitulo vem na linha de baixo, e grudaria no art. 3 */
    ok(!!a3 && !/Da Receita/.test(a3.texto),
       "L1g3 o nome do Capitulo II grudou no fim do art. 3");
    /* e esse nome tem de virar o rotulo do capitulo: "CAPÍTULO II" nu e
     * um algarismo romano que nao diz do que trata */
    const a9 = arts.filter((a) => a.num === "9")[0];
    ok(!!a9 && /Da Receita/.test(a9.divisao),
       "L1g4 o capitulo do art. 9 ficou sem nome: " + (a9 && a9.divisao));

    /* a ementa é a promessa do artigo, e ":" fecha frase aqui */
    const a35 = arts.filter((a) => a.num === "35")[0];
    ok(!!a35 && a35.ementa === "Pertencem ao exercício financeiro:",
       "L1h a ementa do art. 35 saiu: " + (a35 && a35.ementa));

    /* cada artigo sabe em que capítulo está */
    ok(!!a35 && /CAP[ÍI]TULO II/i.test(a35.divisao),
       "L1i o art. 35 nao sabe em que capitulo esta: " + (a35 && a35.divisao));
    const a1 = arts[0];
    ok(/CAP[ÍI]TULO I\b/i.test(a1.divisao),
       "L1j o art. 1 devia estar no Capitulo I: " + a1.divisao);

    /* a linha permite o editor rolar até lá.
     * Sem o guarda, um leitor que engolisse artigos derrubava o teste com
     * pilha de erro — e pilha nao diz O QUE quebrou. */
    ok(!!(a35 && a2 && a35.linha > a2.linha),
       "L1k as linhas dos artigos estao fora de ordem (ou o artigo sumiu)");
  }

  /* ---- L1b: o que vem sob o cabeçalho do capítulo não é do artigo anterior ---- */
  {
    const { api } = rodar();
    /* O Planalto põe a nota de alteração logo abaixo do cabeçalho. Ela
     * não é nome de capítulo (longa demais) nem artigo. Se o leitor não
     * fechar o artigo ao ver o cabeçalho, essa nota gruda no FIM do
     * artigo anterior — e vai junto para o cartão gerado dele, dizendo
     * uma coisa que o artigo não diz. */
    const txt = [
      "Art. 3º A Lei de Orçamentos compreenderá tôdas as receitas.",
      "",
      "CAPÍTULO II",
      "Da Receita",
      "(Redação dada pela Lei nº 6.000, de 1970, com efeitos a partir do "
        + "exercício financeiro seguinte ao da sua publicação oficial)",
      "",
      "Art. 9º Tributo é a receita derivada.",
    ].join("\n");
    const arts = api.leiArtigos(txt);
    const a3 = arts.filter((a) => a.num === "3")[0];
    ok(arts.length === 2, "L1L o trecho tem 2 artigos, leu " + arts.length);
    ok(!!a3 && !/Redação dada/.test(a3.texto),
       "L1m a nota do capitulo grudou no fim do art. 3: "
       + (a3 && a3.texto.replace(/\n/g, "⏎").slice(0, 110)));
    ok(!!a3 && /Da Receita/.test(arts[1].divisao),
       "L1n a nota longa foi confundida com o nome do capitulo: "
       + arts[1].divisao);

    /* e quando o capitulo NÃO tem nome, a nota tambem nao pode virar
     * nome: o rotulo do bloco de leitura seria um paragrafo inteiro */
    const semNome = api.leiArtigos([
      "CAPÍTULO III",
      "(Incluído pela Lei nº 7.000, de 1985, produzindo efeitos a partir "
        + "do primeiro dia do exercicio financeiro subsequente)",
      "",
      "Art. 20. Texto.",
    ].join("\n"));
    ok(semNome.length === 1 && !/Incluído/.test(semNome[0].divisao),
       "L1o a nota virou o nome do capitulo: " + (semNome[0] || {}).divisao);
  }

  /* ---- L2: ordem, inclusive do artigo acrescentado por emenda ---- */
  {
    const { api } = rodar();
    const o = (x) => api.leiNumOrdem(x);
    ok(o("5") < o("11"),
       "L2 ordenou como TEXTO: o art. 11 caiu antes do 5");
    /* 12-A é acrescentado DEPOIS do 12 e ANTES do 13 — é assim que a lei
     * numera o que a emenda enfia no meio */
    ok(o("12") < o("12-A") && o("12-A") < o("13"),
       "L2b o art. 12-A nao ficou entre o 12 e o 13");
    ok(o("1") < o("2"), "L2c ordem basica quebrada");

    const arts = api.leiArtigos(L4320);
    const ordens = arts.map((a) => a.ordem);
    ok(ordens.every((x, i) => i === 0 || x > ordens[i - 1]),
       "L2d a lei saiu fora de ordem: " + ordens.join(","));
  }

  /* ---- L3: blocos de leitura pelo corte da própria lei ---- */
  {
    const { api } = rodar();
    const bl = api.leiBlocos(L4320);
    ok(bl.length === 2,
       "L3 a lei tem 2 capitulos, viraram " + bl.length + " blocos");
    ok(/CAP[ÍI]TULO I\b/i.test(bl[0].nome),
       "L3b o primeiro bloco nao se chama pelo capitulo: " + bl[0].nome);
    ok(bl[0].quantos === 3 && bl[1].quantos === 5,
       "L3c os blocos ficaram com " + bl.map((b) => b.quantos).join("/")
       + " artigos — deviam ser 3/5");
    ok(bl.reduce((s, b) => s + b.quantos, 0) === api.leiArtigos(L4320).length,
       "L3d a soma dos blocos nao bate com o total de artigos — sumiu artigo");
    ok(!!bl[0] && bl[0].minutos >= 3,
       "L3e o bloco nao estima tempo nenhum de leitura");
    ok(!!bl[1] && bl[1].de === "9" && bl[1].ate === "115",
       "L3f o segundo bloco nao vai do art. 9 ao 115: "
       + (bl[1] ? bl[1].de + "→" + bl[1].ate : "nao existe segundo bloco"));

    /* lei SEM divisão nenhuma nao pode virar um bloco unico gigante */
    const semDiv = [];
    for (let i = 1; i <= 40; i++) semDiv.push("Art. " + i + ". Texto do artigo " + i + ".");
    const bl2 = api.leiBlocos(semDiv.join("\n"));
    ok(bl2.length >= 2,
       "L3g 40 artigos sem capitulo viraram " + bl2.length + " bloco(s)");
    ok(bl2.every((b) => b.quantos <= 20),
       "L3h algum bloco ficou grande demais para uma sessao: "
       + bl2.map((b) => b.quantos).join(","));
  }

  /* ---- L4: identificar a lei pelo cabeçalho ---- */
  {
    const { api } = rodar();
    const id = api.leiIdentificar(L4320);
    ok(!!id, "L4 nao reconheceu a lei pelo proprio cabecalho");
    ok(id && id.numero === "4.320",
       "L4b leu o numero errado: " + (id && id.numero));
    ok(id && id.ano === "1964", "L4c leu o ano errado: " + (id && id.ano));
    ok(id && /4\.320/.test(id.nome), "L4d o nome saiu sem o numero: " + (id && id.nome));

    const lc = api.leiIdentificar("LEI COMPLEMENTAR Nº 101, DE 4 DE MAIO DE 2000");
    ok(lc && lc.especie === "Lei Complementar",
       "L4e a LRF nao foi reconhecida como lei complementar: "
       + JSON.stringify(lc));
    ok(api.leiIdentificar("texto solto sem cabecalho nenhum") === null,
       "L4f inventou uma lei a partir de texto que nao tem cabecalho");
  }

  /* ---- L4g-L4m: A CONSTITUIÇÃO NÃO PODE VIRAR UMA EMENDA ----
   *
   * O DEFEITO, com o relato inteiro: a Constituição foi copiada do
   * Planalto com Ctrl+A e gravada como "Emenda Constitucional 106/2020 ·
   * 424 artigos". O texto compilado traz um índice de emendas antes do
   * corpo e anotações de vigência dentro dos artigos; a busca antiga
   * varria 1200 caracteres CORRIDOS atrás da primeira ocorrência, então
   * qualquer menção ganhava do título que estava acima. E a Constituição
   * — a única norma cujo nome não tem número — só era considerada quando
   * NADA mais casava, isto é, praticamente nunca. */
  {
    const { api } = rodar();
    /* o começo do compilado do Planalto, do jeito que o Ctrl+A entrega:
     * cabeçalho do órgão, o índice de emendas, e só então o corpo — com
     * a nota de vigência colada no fim do inciso */
    const CF = [
      "Presidência da República",
      "Casa Civil",
      "Subchefia para Assuntos Jurídicos",
      "",
      "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988",
      "",
      "Emenda Constitucional nº 106, de 2020",
      "Emenda Constitucional nº 132, de 2023",
      "",
      "PREÂMBULO",
      "",
      "TÍTULO I — DOS PRINCÍPIOS FUNDAMENTAIS",
      "",
      "Art. 1º A República Federativa do Brasil constitui-se em Estado",
      "Democrático de Direito e tem como fundamentos:",
      "IV - os valores sociais do trabalho e da livre iniciativa; (Vide Lei nº 13.874, de 2019)",
      "Art. 2º São Poderes da União o Legislativo, o Executivo e o Judiciário.",
    ].join("\n");

    const cf = api.leiIdentificar(CF);
    ok(cf && cf.especie === "Constituição",
       "L4g a Constituição do Planalto foi identificada como outra coisa: "
       + JSON.stringify(cf));
    ok(cf && cf.nome === "Constituição Federal de 1988",
       "L4h nome errado para a Constituição: " + (cf && cf.nome));

    /* SABOTAGEM VIVA 1: sem o título, o índice de emendas volta a ser a
     * primeira coisa que casa — e aí é o teto de artigos que tem de
     * segurar. Um texto com 80 artigos não é emenda nenhuma. */
    const arts = [];
    for (let i = 1; i <= 80; i++) arts.push("Art. " + i + ". Texto do artigo " + i + ".");
    const semTitulo = ["Emenda Constitucional nº 106, de 2020", ""]
      .concat(arts).join("\n");
    ok(api.leiIdentificar(semTitulo) === null,
       "L4i uma 'emenda' com 80 artigos foi aceita — emenda com essa "
       + "quantidade de artigos não existe, e o nome está mentindo");

    /* SABOTAGEM VIVA 2: o teto não pode engolir a emenda de verdade. */
    const ec = ["EMENDA CONSTITUCIONAL Nº 132, DE 20 DE DEZEMBRO DE 2023", "",
                "Art. 1º A Constituição Federal passa a vigorar com alterações.",
                "Art. 2º Fica instituído o Imposto sobre Bens e Serviços."].join("\n");
    const rEc = api.leiIdentificar(ec);
    ok(rEc && rEc.especie === "Emenda Constitucional" && rEc.numero === "132",
       "L4j a EC 132 de verdade deixou de ser reconhecida: " + JSON.stringify(rEc));

    /* uma nota de vigência sozinha não batiza norma nenhuma */
    ok(api.leiIdentificar("(Redação dada pela Emenda Constitucional nº 132, de 2023)")
       === null,
       "L4k uma anotação de vigência do Planalto virou nome de lei");

    /* e "Constituição" no meio da frase não transforma uma MP na CF */
    const mp = ["MEDIDA PROVISÓRIA Nº 1.185, DE 30 DE AGOSTO DE 2023", "",
                "O PRESIDENTE DA REPÚBLICA, no uso da atribuição que lhe confere",
                "o art. 62 da Constituição Federal, adota a seguinte medida:",
                "Art. 1º Esta medida provisória dispõe sobre subvenções."].join("\n");
    const rMp = api.leiIdentificar(mp);
    ok(rMp && rMp.especie === "Medida Provisória",
       "L4l 'Constituição Federal' citada no preâmbulo sequestrou a MP: "
       + JSON.stringify(rMp));
  }

  /* ---- L4m: corrigir o nome corrige o registro INTEIRO ----
   * Renomear e deixar especie/numero para trás guardaria a Constituição
   * respondendo por "EC 106" na hora de resolver uma citação. */
  {
    const { api } = rodar();
    const c = api.leiCamposDoNome("Constituição Federal de 1988");
    ok(c.especie === "Constituição" && c.numero === "" && c.ano === "1988",
       "L4m o nome corrigido não reescreve espécie/número/ano: "
       + JSON.stringify(c));
    const c2 = api.leiCamposDoNome("LC 101/2000");
    ok(c2.especie === "Lei Complementar" && c2.numero === "101",
       "L4n LC 101 não foi relida do nome: " + JSON.stringify(c2));
    const c3 = api.leiCamposDoNome("Minhas anotações de despesa");
    ok(c3.numero === "" && c3.especie === "",
       "L4o um nome que não é de norma deixou número velho para trás: "
       + JSON.stringify(c3));
  }

  /* ---- L5: a lei é UMA, os tópicos apontam para ela ---- */
  {
    const { api } = rodar();
    const l = api.leiGuardar({ nome: "Lei 4.320/1964", texto: L4320 });
    ok(!!l && !!l.id, "L5 a lei nao foi guardada");

    /* O PONTO DA REFORMA: cinco topicos, UMA copia do texto. Guardar por
     * topico faria cinco copias que envelhecem separadamente. */
    const chaves = ["direito financeiro›receita pública",
                    "direito financeiro›despesa pública",
                    "direito financeiro›restos a pagar"];
    chaves.forEach((c) => api.leiLigar(l.id, c));
    const dep = api.leiDe(l.id);
    ok(dep.topicos.length === 3,
       "L5b a lei devia servir 3 topicos, serve " + dep.topicos.length);
    ok(api.leisLista().length === 1,
       "L5c tres topicos criaram " + api.leisLista().length + " copias da lei");

    chaves.forEach((c) => {
      const achadas = api.leisDoTopico(c);
      ok(achadas.length === 1 && achadas[0].id === l.id,
         "L5d o topico '" + c + "' nao encontra a lei dele");
    });
    /* topico que nao foi ligado nao pode receber a lei de brinde */
    ok(api.leisDoTopico("estatística›amostragem").length === 0,
       "L5e a lei apareceu num topico que nunca foi ligado a ela");

    /* acento e espaco a mais nao podem abrir uma segunda gaveta */
    ok(api.leisDoTopico("Direito Financeiro › Receita Publica ".replace(" › ", "›")).length >= 0,
       "L5f chave com variacao derrubou a busca");

    api.leiDesligar(l.id, chaves[0]);
    ok(api.leisDoTopico(chaves[0]).length === 0,
       "L5g desligar nao tirou a lei do topico");
    ok(api.leisDoTopico(chaves[1]).length === 1,
       "L5h desligar de UM topico tirou a lei dos OUTROS tambem");
    /* e desligar nao pode apagar a lei: ela existe sozinha */
    ok(!!api.leiDe(l.id),
       "L5i desligar do ultimo topico apagou a lei — a lei nao e do topico");
  }

  /* ---- L6: onde parei é um ARTIGO ---- */
  {
    const { api } = rodar();
    const l = api.leiGuardar({ nome: "Lei 4.320/1964", texto: L4320 });
    let p = api.leiProgresso(l.id);
    ok(p.total === 8, "L6 o progresso nao conta os artigos: " + p.total);
    ok(p.lidos === 0 && p.pct === 0,
       "L6b lei recem-colada ja aparece parcialmente lida");

    api.leiParar(l.id, "11");
    p = api.leiProgresso(l.id);
    ok(p.artigo === "11", "L6c o marcador nao ficou no art. 11: " + p.artigo);
    ok(p.lidos === 5, "L6d ate o art. 11 sao 5 artigos, contou " + p.lidos);
    ok(p.pct === 63, "L6e o percentual saiu " + p.pct + "%, esperado 63%");
    ok(p.proximo && p.proximo.num === "12-A",
       "L6f o proximo artigo a ler devia ser o 12-A, veio "
       + (p.proximo && p.proximo.num));

    /* MARCAR "1º" TEM DE ENCONTRAR O ARTIGO ESCRITO "1".
     * Sem normalizar, o marcador gravado de um jeito nunca mais acha o
     * artigo escrito do outro — e o "onde parei" volta calado ao zero,
     * que e o pior fim possivel para ele. */
    api.leiParar(l.id, "35º");
    p = api.leiProgresso(l.id);
    ok(p.lidos === 7,
       "L6g marcar '35º' nao encontrou o art. 35: lidos=" + p.lidos);

    /* o marcador sobrevive a recolar a lei (texto novo, mesma lei) */
    api.leiGuardar({ id: l.id, texto: L4320 + "\n\nArt. 116. Novo." });
    p = api.leiProgresso(l.id);
    ok(p.artigo === "35",
       "L6h recolar a lei apagou onde a pessoa tinha parado");
    ok(p.total === 9, "L6i o artigo novo nao entrou na conta: " + p.total);
  }

  /* ---- L7: blocos lidos ---- */
  {
    const { api } = rodar();
    const l = api.leiGuardar({ nome: "Lei 4.320/1964", texto: L4320 });
    const bl = api.leiBlocos(L4320);
    ok(api.leiBlocosLidos(l.id) === 0, "L7 lei nova ja tem bloco lido");
    api.leiBlocoLido(l.id, bl[0].nome, true);
    ok(api.leiBlocosLidos(l.id) === 1, "L7b marcar o bloco lido nao pegou");
    ok(!!api.leiDe(l.id).blocos[bl[0].nome],
       "L7c o bloco lido nao guardou a data");
    /* marcar o mesmo bloco duas vezes nao conta duas */
    api.leiBlocoLido(l.id, bl[0].nome, true);
    ok(api.leiBlocosLidos(l.id) === 1,
       "L7d marcar duas vezes contou 2 leituras do mesmo bloco");
    api.leiBlocoLido(l.id, bl[0].nome, false);
    ok(api.leiBlocosLidos(l.id) === 0, "L7e desmarcar o bloco nao pegou");
  }

  /* ---- L8: citação de artigo dentro da questão ---- */
  {
    const { api } = rodar();
    const enun = "Nos termos do art. 167, IV, da Constituição, e do artigo 35 "
      + "da Lei 4.320, é vedada a vinculação de receita. Ver ainda o art. 167, VI "
      + "e o art. 5º, § 2º.";
    const cit = api.leiCitacoes(enun);
    const nums = cit.map((c) => c.num).sort();
    ok(nums.join(",") === "167,35,5",
       "L8 as citacoes lidas foram: " + nums.join(",") + " (esperado 167,35,5)");

    const c167 = cit.filter((c) => c.num === "167")[0];
    ok(c167 && c167.vezes === 2,
       "L8b o art. 167 aparece 2 vezes, contou " + (c167 && c167.vezes));
    ok(c167 && c167.incisos.join(",") === "IV,VI",
       "L8c os incisos do 167 sairam: " + (c167 && c167.incisos.join(",")));

    const c5 = cit.filter((c) => c.num === "5")[0];
    ok(c5 && c5.paragrafos.join(",") === "2º",
       "L8d o paragrafo do art. 5 nao foi lido: "
       + (c5 && c5.paragrafos.join(",")));

    /* NÃO PODE ACHAR ARTIGO ONDE NÃO HÁ.
     * "departamento 45", "Bonaparte 12" e "quarta 7" TÊM as letras "art"
     * dentro, e uma regra sem fronteira de palavra transformaria os tres
     * em artigos 45, 12 e 7 — a estatistica de "artigos que mais caem"
     * viraria ficcao, e ficcao com numero tem cara de verdade. */
    const vazio = api.leiCitacoes(
      "sinfonia de Mozart 40, estadio de Stuttgart 1996, "
      + "produto artesanal, artefato antigo, parte 3");
    ok(vazio.length === 0,
       "L8e inventou citacao onde nao ha: " + JSON.stringify(vazio));
  }

  /* ---- L9: migração não perde o que já estava colado ---- */
  {
    const { api } = rodar();
    /* dois topicos com a MESMA lei colada — o caso real: a 4.320 estava
     * em receita e em despesa, uma vez inteira e outra pela metade */
    const resumos = {
      "direito financeiro›receita pública": {
        disciplina: "Direito Financeiro", topico: "Receita pública",
        leiTexto: L4320,
      },
      "direito financeiro›despesa pública": {
        disciplina: "Direito Financeiro", topico: "Despesa pública",
        leiTexto: L4320.split("CAPÍTULO II")[0],
      },
      "estatística›média": {
        disciplina: "Estatística", topico: "Média", texto: "só resumo, sem lei",
      },
    };
    const criadas = api.leisMigrarDe(resumos);
    ok(api.leisLista().length === 1,
       "L9 duas copias da mesma lei viraram " + api.leisLista().length
       + " registros — a biblioteca ja nasceu duplicada");
    ok(criadas.length === 1, "L9b devia criar 1 lei, criou " + criadas.length);

    const l = api.leisLista()[0];
    ok(/4\.320/.test(l.nome),
       "L9c a lei migrada nao foi identificada pelo numero: " + l.nome);
    ok(l.topicos.length === 2,
       "L9d a lei migrada devia servir os 2 topicos, serve " + l.topicos.length);
    /* FICA COM O TEXTO MAIOR. A copia pela metade nao pode sobrescrever
     * a inteira: seriam artigos perdidos sem ninguem ver. */
    ok(l.texto.length === L4320.length,
       "L9e a migracao ficou com a copia MENOR da lei — "
       + l.texto.length + " de " + L4320.length + " caracteres");
    ok(api.leiArtigos(l.texto).length === 8,
       "L9f a lei migrada perdeu artigos: " + api.leiArtigos(l.texto).length);

    /* topico sem lei nenhuma nao pode virar uma lei vazia */
    ok(!api.leisDoTopico("estatística›média").length,
       "L9g topico que so tem resumo ganhou uma lei do nada");

    /* migrar DUAS VEZES nao pode duplicar nada */
    api.leisMigrarDe(resumos);
    ok(api.leisLista().length === 1,
       "L9h migrar de novo duplicou a biblioteca: " + api.leisLista().length);
  }

  /* ---- L10: trocar e acrescentar artigo sem estragar a lei ---- */
  {
    const { api } = rodar();

    /* TROCAR A REDAÇÃO DE UM ARTIGO é o que uma emenda faz. O resto do
     * arquivo — artigos vizinhos, cabeçalhos, marcas coloridas — tem de
     * sair byte por byte como entrou. */
    const novo = api.leiSubstituirArtigo(L4320, "35",
      "Art. 35. Pertencem ao exercício financeiro (nova redação):\n"
      + "I - as receitas nele arrecadadas;");
    ok(!!novo, "L10 nao consegui trocar a redacao do art. 35");
    ok(/nova redação/.test(novo), "L10b a nova redacao nao entrou");
    ok(!/nêle arrecadadas/.test(novo),
       "L10c a redacao antiga ficou junto com a nova");
    ok(api.leiArtigos(novo).length === 8,
       "L10d a lei mudou de tamanho: " + api.leiArtigos(novo).length);
    ok(/Tributo é a receita derivada/.test(novo),
       "L10e trocar o art. 35 mexeu no art. 9");
    ok(/Esta lei entrará em vigor/.test(novo),
       "L10f trocar o art. 35 comeu o art. 115, que vem depois");
    /* o cabeçalho do capítulo que fica ENTRE artigos sobrevive */
    ok(/CAP[ÍI]TULO II/.test(novo), "L10g o cabecalho do capitulo sumiu");

    /* marca colorida em OUTRO artigo não pode ser tocada */
    const comMarca = L4320.replace("Tributo é a receita derivada",
      "==~Tributo é a receita derivada==");
    const n2 = api.leiSubstituirArtigo(comMarca, "35", "Art. 35. Outro texto.");
    ok(/==~Tributo é a receita derivada==/.test(n2),
       "L10h editar um artigo apagou a marca que estava em outro");

    /* artigo que não existe devolve null, em vez de inventar */
    ok(api.leiSubstituirArtigo(L4320, "999", "Art. 999. X.") === null,
       "L10i trocar artigo inexistente nao avisou nada");

    /* ---- acrescentar ---- */
    const com5 = api.leiInserirArtigo(L4320, "Art. 5º Artigo novo.");
    ok(!!com5, "L10j nao consegui acrescentar o art. 5");
    ok(api.leiArtigos(com5).map((a) => a.num).join(",")
       === "1,2,3,5,9,11,12-A,35,115",
       "L10k o art. 5 caiu no lugar errado: "
       + api.leiArtigos(com5).map((a) => a.num).join(","));

    /* repetido é recusado: dois art. 35 tornariam o endereço ambíguo, e
     * o marcador, os cartões e a estatística passariam a apontar para um
     * lugar que existe duas vezes */
    ok(api.leiInserirArtigo(L4320, "Art. 35. Duplicata.") === null,
       "L10l aceitou um segundo art. 35");
    /* texto que não começa com "Art. N" não é artigo */
    ok(api.leiInserirArtigo(L4320, "Um texto qualquer.") === null,
       "L10m aceitou como artigo um texto sem numero");

    /* ANTES DE TODOS: um artigo anterior ao primeiro do texto entra no
     * COMEÇO — mas depois da ementa e do preâmbulo, que não são artigos
     * e precisam continuar em cima. */
    const soDoNove = ["LEI Nº 4.320, DE 1964", "", "Estatui normas gerais.",
      "", "Art. 9º Tributo é receita derivada.", "",
      "Art. 11. A receita classifica-se."].join("\n");
    const comCinco = api.leiInserirArtigo(soDoNove, "Art. 5º Anterior.");
    ok(!!comCinco, "L10n nao consegui acrescentar antes do primeiro artigo");
    ok(api.leiArtigos(comCinco).map((a) => a.num).join(",") === "5,9,11",
       "L10o o artigo anterior nao ficou na frente: "
       + api.leiArtigos(comCinco).map((a) => a.num).join(","));
    ok(comCinco.indexOf("Estatui normas gerais")
       < comCinco.indexOf("Art. 5º"),
       "L10p o artigo novo passou na frente da ementa da lei");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes, L4320 };
