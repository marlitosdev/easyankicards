/* =====================================================================
 * LEI SECA — a lei como documento, não como campo de texto
 *
 * Até aqui a "lei seca" era uma segunda caixa de texto pendurada no
 * tópico. Funcionava, e por isso mesmo não servia para muita coisa: era
 * um resumo mais pobre, sem marcas, sem cartões, sem questões.
 *
 * DUAS COISAS ESTAVAM ERRADAS NA RAIZ, e este arquivo existe para
 * corrigir as duas.
 *
 * 1. A LEI É DA LEI, NÃO DO TÓPICO.
 *    A Lei 4.320 atende, no edital do TCE-PE, pelo menos cinco tópicos:
 *    receita pública, despesa pública, restos a pagar, créditos
 *    adicionais e exercício financeiro. Guardada por tópico, ela seria
 *    colada cinco vezes — cinco cópias que envelhecem separadamente,
 *    cinco lugares para marcar a mesma pegadinha, e nenhuma resposta
 *    para "onde eu parei de ler a 4.320?". Aqui a lei vira entidade
 *    própria, com número, fonte e data, e os tópicos apontam PARA ela.
 *
 * 2. A LEI TEM ESTRUTURA QUE O RESUMO NÃO TEM — O ARTIGO.
 *    Um resumo é prosa: só dá para medir por caractere e por rolagem.
 *    Uma lei é uma lista numerada e estável, que a banca cita pelo nome
 *    ("art. 167, IV"). Reconhecer esse número é o que destrava tudo o
 *    mais: parar no art. 35 e voltar nele, gerar lacuna de um artigo,
 *    contar em quantas questões o art. 167 apareceu, ler o Capítulo III
 *    hoje e o IV amanhã.
 *
 * Este arquivo é só leitura de texto e armazenamento — nada de tela.
 * A tela fica em lei-ui.js, e é ela que pode ser trocada sem risco.
 * ===================================================================== */

const LEIS_CHAVE = "eac_leis";

/* ---------------------------------------------------------------------
 * PARTE 1 — LER A LEI
 * ------------------------------------------------------------------ */

/* CABEÇALHO DE ARTIGO.
 * O texto oficial escreve de várias formas e todas aparecem quando se
 * copia do Planalto ou de um PDF:
 *
 *   Art. 1º   Art. 1o   Art. 1   Artigo 1.   Art. 5º-A   Art. 167.
 *
 * O "º" às vezes vem como "o" solto (PDF que perdeu o ordinal) e às
 * vezes como "°" (grau, não ordinal — colagem de Word). Aceitar os três
 * não é frescura: recusar um deles faz a lei inteira virar um bloco só,
 * e aí nada nesta pasta funciona. */
const LEI_RE_ARTIGO =
  /^[\s>*]*Art(?:\.|igo)?\s*(\d{1,4}(?:\s*[ºo°ª])?(?:\s*[-–]\s*[A-Z])?)\s*[.\-–—)]?\s*/i;

/* CABEÇALHO DE DIVISÃO (título, capítulo, seção…).
 * Serve para dois fins: partir a lei em blocos de leitura e dizer, ao
 * lado do artigo, em que parte da lei ele está — "art. 35, no capítulo
 * do exercício financeiro" localiza muito melhor que "art. 35". */
/* O número da divisão pode vir por extenso ("LIVRO PRIMEIRO", "TÍTULO SEGUNDO" — o CTN e os códigos
 * antigos), em romano com letra colada ("TÍTULO V-A"), em romano, "único" ou em algarismos. Cada
 * alternativa fecha com "não vem letra depois": sem isso "C" de "CÍVICO" virava o romano 100. */
const LEI_RE_DIVISAO =
  /^[\s>*]*(LIVRO|PARTE|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O)\s+((?:PRIMEIR|SEGUND|TERCEIR|QUART|QUINT|SEXT|S[ÉE]TIM|OITAV|NON|D[ÉE]CIM)[OA](?![A-Za-zÀ-ú])|[IVXLCDM]+(?:-[A-Z])?(?![A-Za-zÀ-ú])|[ÚU]NIC[AO](?![A-Za-zÀ-ú])|\d{1,3}[ªº]?(?![A-Za-zÀ-ú0-9]))[\s.:\-–—]*(.*)$/i;

/* Divisão SEM número, escrita numa linha só: "Disposições Finais e Transitórias", "PARTE GERAL".
 * Só estas frases: uma linha qualquer em maiúsculas não é divisão. */
const LEI_RE_DIVISAO_LIVRE =
  /^[\s>*]*(DISPOSI[ÇC][ÕO]ES\s+(?:FINAIS|TRANSIT[ÓO]RIAS|PRELIMINARES)(?:\s+E\s+(?:FINAIS|TRANSIT[ÓO]RIAS|GERAIS))?|PARTE\s+(?:GERAL|ESPECIAL)|ATO\s+DAS\s+DISPOSI[ÇC][ÕO]ES\s+CONSTITUCIONAIS\s+TRANSIT[ÓO]RIAS)\s*$/i;

/* A nota "(Redação dada pela LC 227, de 2026)" não é o NOME do capítulo. */
const LEI_RE_NOTA_DIVISAO =
  /\(\s*(?:Reda[çc][ãa]o\s+dada|Inclu[íi]d[oa]|Revogad[oa]|Vetad[oa]|Vide|Vig[êe]ncia|Produ[çc][ãa]o\s+de\s+efeito|Renumerad[oa])[^)]*\)/gi;

/* Quanto mais alto o nível, mais fundo na árvore: Parte › Livro › Título › Capítulo › Seção › Subseção */
const LEI_NIVEL_DIVISAO = { PARTE: 1, ATO: 1, LIVRO: 2, TITULO: 3, DISPOSICOES: 3, CAPITULO: 4, SECAO: 5, SUBSECAO: 6 };

/* O número do artigo como se MOSTRA: sem espaços, e com o ordinal escrito como ordinal. Texto de PDF
 * traz "42O" (letra O) ou "1o"/"1°" no lugar do "º": é o mesmo artigo, e o "42O" ia para o mapa. */
function leiNumCruLimpo(bruto) {
  return String(bruto).replace(/\s+/g, "").replace(/(\d)[oO°]$/, "$1º");
}

/* Ordinal do artigo: "1º" e "1" são o MESMO artigo escrito de dois
 * jeitos. Sem normalizar, "onde parei" gravado como "1º" nunca mais
 * encontraria o artigo lido de um texto que escreve "1". */
function leiNumNormal(bruto) {
  return String(bruto || "")
    .replace(/\s+/g, "")
    .replace(/(\d)[ºo°ª]$/i, "$1")
    .replace(/[–]/g, "-")
    .toUpperCase();
}

/* Peso para ordenar. O art. 5º-A vem DEPOIS do 5º e ANTES do 6º — é
 * assim que a lei numera artigo acrescentado por emenda, e ordenar como
 * texto ("10" antes de "5") embaralharia a lei inteira. */
function leiNumOrdem(num) {
  const n = leiNumNormal(num);
  const m = n.match(/^(\d+)(?:-([A-Z]))?$/);
  if (!m) return 999999;
  return Number(m[1]) * 100 + (m[2] ? (m[2].charCodeAt(0) - 64) : 0);
}

/* EMENTA — a primeira frase do artigo, que é o que ele promete.
 * É o que aparece no modo recitar e na lista de artigos: "Art. 167 —
 * São vedados:" já diz do que se trata sem entregar os incisos. */
function leiEmenta(texto, limite) {
  const lim = limite || 90;
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  /* corta no primeiro ponto final, dois-pontos ou ponto-e-vírgula que
   * feche uma frase — ":" é comum e importante ("São vedados:") */
  const m = limpo.match(/^(.{10,}?[.:;])(\s|$)/);
  const frase = m ? m[1] : limpo;
  return frase.length > lim ? frase.slice(0, lim - 1).trim() + "…" : frase;
}

/* O CORAÇÃO: transformar o texto colado numa lista de artigos.
 *
 * Devolve, para cada artigo: o número (cru e normalizado), a ementa, o
 * texto completo com os incisos e parágrafos que vêm abaixo dele, a
 * linha onde começa (para o editor saber onde rolar) e a divisão em que
 * está. Tudo que vem ANTES do primeiro artigo (ementa da lei, preâmbulo,
 * "O PRESIDENTE DA REPÚBLICA…") fica de fora da lista — não é artigo e
 * contaria como um, estragando toda a numeração. */
/* ARTIGOS REVOGADOS EM GRUPO.
 * Texto consolidado de lei escreve "Arts. 12 a 15 (Revogados pela LC 9/2010)" numa
 * linha só, no lugar de quatro artigos. O leitor só conhecia "Art. N": lia "Art. 12"
 * com o resto ("a 15 (Revogados…)") como texto, e depois do 12 vinha o 16 — uma
 * LACUNA de numeração que não existe, criticada como erro do leitor. Agora a
 * linha vira UM item que cobre a faixa (faixaFim), marcado como revogado. Só vale
 * com a palavra "revogad…", "vetad…" ou "suprimid…" na própria linha: "Art. 12 e
 * 13 obrigam…" é artigo. */
const LEI_RE_FAIXA = /^[\s>*]*(Arts?\.?|Artigos)\s*(\d{1,4})\s*[ºo°ª]?(?:-([A-Z]))?\s*(?:,|\be\b|\ba\b|\bao\b|até|–|-)\s*(?:o\s+)?(?:Arts?\.?\s*)?(\d{1,4})/i;

function leiLerFaixaRevogada(linha) {
  const s0 = String(linha || "");
  const m = s0.match(LEI_RE_FAIXA);
  if (!m) return null;
  const k = s0.search(/revogad|vetad|suprimid/i);
  if (k < 0) return null;
  const nums = (s0.slice(0, k).match(/\d{1,4}/g) || []).map(Number);
  if (nums.length < 2) return null;
  const ini = Math.min.apply(null, nums), fim = Math.max.apply(null, nums);
  if (fim - ini > 400) return null;
  const sufixo = m[3] ? "-" + m[3] : "";
  return { num: leiNumNormal(m[2] + sufixo), numCru: m[2] + sufixo + " a " + fim, fim, ini,
    rotulo: "Arts. " + ini + " a " + fim, len: m[0].length };
}

/* "Art. 178 - A isenção, salvo…" É O ARTIGO 178, não o 178-A.
 *
 * O CTN escreve o artigo 178 assim (hífen com espaços e o artigo "A" logo depois). A regex lê
 * "- A" como sufixo de letra, e o leitor criava um "178-A" que não existe, deixando o 178 de fora
 * da numeração. O sufixo de verdade vem colado ("Art. 178-A") ou, com espaços, seguido de outro
 * começo de frase (maiúscula, número, aspas) ou do fim da linha. Letra minúscula, ou letra seguida
 * de palavra em minúscula, é o artigo/pronome "a": fica no texto. */
function leiCasarArtigo(linha) {
  const s = String(linha == null ? "" : linha);
  const a = s.match(LEI_RE_ARTIGO);
  if (!a) return null;
  const suf = a[1].match(/[-–]\s*([A-Za-z])$/);
  if (!suf) return a;
  if (!/\s[-–]|[-–]\s/.test(a[1])) return a;             /* colado ("178-A"): sufixo de verdade */
  const resto = s.slice(a[0].length);
  const proxima = (resto.match(/^\s*(\S)/) || [])[1] || "";
  const minuscula = suf[1] !== suf[1].toUpperCase() || (proxima && proxima !== proxima.toUpperCase());
  if (!minuscula) return a;
  return s.match(/^[\s>*]*Art(?:\.|igo)?\s*(\d{1,4}(?:\s*[ºo°ª])?)\s*[.\-–—)]?\s*/i) || a;
}

/* Separa o NOME de uma divisão das notas de alteração que vêm coladas nele. */
function leiNomeDaDivisao(bruto) {
  const notas = [];
  let link = "";
  const cru = String(bruto == null ? "" : bruto).replace(/\s+/g, " ").trim();
  const nome = String(bruto == null ? "" : bruto)
    .replace(LEI_RE_NOTA_DIVISAO, (m) => { notas.push(m.replace(/\s+/g, " ").trim()); return " "; })
    .replace(/\s+/g, " ").replace(/^[\s.:\-–—]+|[\s.:\-–—]+$/g, "")
    /* o texto de um link do Planalto que veio junto ("… REFORMA AGRÁRIA Regulamento") não é o nome. Só
     * quando vem depois de uma palavra em MAIÚSCULAS: "Da Vigência" e "Do Regulamento Geral" são nomes */
    .replace(/([A-ZÀ-Ú]{2,})\s+(Regulamento|Regulamenta[çc][ãa]o|Vig[êe]ncia)$/, (m, a, w) => { link = w; return a; });
  return { nome, nota: notas.join(" "), link, bruto: cru };
}

/* O CORAÇÃO: lê o texto e devolve os artigos e as DIVISÕES (Parte › Livro › Título › Capítulo ›
 * Seção), com a árvore montada. Cada divisão tem um id ESTÁVEL — o caminho por tipo e número, não
 * o nome: "TITULO I>CAPITULO I#2" é o segundo "Capítulo I" dentro do Título I. É esse id que marca
 * "capítulo lido", e é por ele que dois "CAPÍTULO I — Disposições Gerais" deixam de ser o mesmo. */
function leiLerLei(texto, opc) {
  const linhas = String(texto || "").split("\n");
  const artigos = [];
  const divisoes = [];
  /* OS AJUSTES DO LEITOR. Tudo o que ele muda ou deixa de fora ao ler — separar a nota de alteração do
   * nome, tirar o texto de link, ler "42O" como "42º", ler "Art. 178 - A isenção" como o art. 178, e as
   * linhas que não entram em artigo nenhum — vira um item em `ajustes`: o id, o tipo, a linha, o texto de
   * antes e os campos de cada tipo (a tela monta a frase; o porquê é o do tipo).
   * `opc.recusados` ({id: true}) são os que a pessoa mandou MANTER NO ORIGINAL: o leitor não os faz.
   * Nada disso altera o texto guardado: é só o jeito de ler. */
  const rec = (opc && opc.recusados) || {};
  const ajustes = [];
  const fora = [];
  /* AS CITAÇÕES: as linhas dentro de um artigo citado (entre aspas) são texto do artigo que ALTERA, não artigos
   * desta lei. Cada bloco vira um ajuste "citacao": a pessoa pode mandar tratar como texto comum. */
  const cit = leiLerCitacoes(linhas, rec);
  const citadas = cit.citadas;
  const cortaAj = (x, n) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, n);
  let atual = null;
  let divisao = null;
  /* O Planalto quebra o cabeçalho em duas linhas com muita frequência:
   *
   *   CAPÍTULO II
   *   Da Receita
   *
   * A segunda linha é o nome do capítulo. Sem esperar por ela, o bloco
   * de leitura se chamaria "CAPÍTULO II" — um algarismo romano nu, que
   * não diz do que trata e não ajuda a escolher o que ler hoje. */
  let esperaNome = false;
  const pilha = [];
  const vezes = {};
  const RE_LINK = /([A-ZÀ-Ú]{2,})\s+(?:Regulamento|Regulamenta[çc][ãa]o|Vig[êe]ncia)$/;

  const rotular = (d) => { d.rotulo = (d.rotuloBase + (d.nome ? " — " + d.nome : "")).trim(); };
  const abrir = (tipo, num, base, nome, nota, linha) => {
    const nivel = LEI_NIVEL_DIVISAO[tipo] || 4;
    while (pilha.length && pilha[pilha.length - 1].nivel >= nivel) pilha.pop();
    const pai = pilha.length ? pilha[pilha.length - 1] : null;
    const chave = num ? tipo + " " + num : tipo + "|" + base.toUpperCase().replace(/\s+/g, " ");
    const k = (pai ? pai.id : "") + "|" + chave;
    vezes[k] = (vezes[k] || 0) + 1;
    const d = { id: (pai ? pai.id + ">" : "") + chave + (vezes[k] > 1 ? "#" + vezes[k] : ""),
      tipo, nivel, num, nome, nota, rotuloBase: base, rotulo: "", linha, pai, caminho: [] };
    rotular(d);
    divisoes.push(d);
    pilha.push(d);
    return d;
  };

  /* põe o que veio numa linha de cabeçalho ou de nome no nome da divisão, e registra os ajustes:
   * a nota separada e o texto de link tirado. Recusado = fica como veio, na ordem em que veio. */
  const aplicarNome = (div, n, numLinha, linhaCrua) => {
    const rNota = !!rec["nota:" + div.id], rLink = !!rec["link:" + div.id];
    let parte = n.nome;
    if (n.nota && rNota) parte = rLink ? n.bruto : n.bruto.replace(RE_LINK, "$1");
    else if (n.link && rLink) parte = (n.nome + " " + n.link).trim();
    div.nome = [div.nome, parte].filter(Boolean).join(" ");
    div.nota = rNota ? "" : [div.nota, n.nota].filter(Boolean).join(" ");
    rotular(div);
    const registra = (tipo, extra, recusado) => {
      const id = tipo + ":" + div.id;
      const ja = ajustes.filter((x) => x.id === id)[0];
      if (ja) {
        ja.antes = cortaAj(ja.antes + " / " + linhaCrua, 200);
        if (extra.nota) ja.nota = cortaAj([ja.nota, extra.nota].filter(Boolean).join(" "), 200);
        return;
      }
      ajustes.push(Object.assign({ id, tipo, linha: numLinha, linhaFim: numLinha, antes: cortaAj(linhaCrua, 200),
        recusado, divId: div.id, rotulo: div.rotuloBase, nome: "" }, extra));
    };
    if (n.nota) registra("nota", { nota: cortaAj(n.nota, 200) }, rNota);
    if (n.link) registra("link", { link: n.link }, rLink);
  };
  let aguardaNome = false;         /* a divisão aberta ainda espera o NOME (só veio a nota, ou nada) */

  linhas.forEach((linha, i) => {
    if (citadas.has(i + 1)) {
      if (atual) {
        atual.linhas.push(linha);
        if (String(linha).trim()) atual.corpo += "\n" + linha;
      } else if (String(linha).trim()) fora.push({ linha: i + 1, texto: linha });
      return;
    }
    const d = linha.match(LEI_RE_DIVISAO);
    if (!d && esperaNome) {
      const cru = String(linha).trim();
      if (!cru) return;                      /* linha em branco: continua esperando */
      esperaNome = false;
      /* Depois de uma NOTA de alteração o nome pode ser mais longo (o Planalto escreve "Seção V /
       * (Redação dada pela EC 92/2016) / Do Tribunal Superior do Trabalho, dos Tribunais Regionais do
       * Trabalho e dos Juízes do Trabalho"): a linha de nome aceita mais caracteres nesse caso */
      const limite = divisao && divisao.nota ? 160 : 90;
      if (!leiCasarArtigo(linha) && cru.length <= limite && divisao && aguardaNome) {
        const n = leiNomeDaDivisao(cru);
        aplicarNome(divisao, n, i + 1, linha);
        /* a linha trouxe SÓ a nota (o nome vem na seguinte): continua esperando o nome */
        aguardaNome = !n.nome;
        if (!n.nome) esperaNome = true;
        return;
      }
    }
    if (d) {
      const tipo = d[1].toUpperCase()
        .replace("Í", "I").replace("Ç", "C").replace("Ã", "A");
      const n = leiNomeDaDivisao(d[3]);
      let nome = n.nome;
      let num = d[2].toUpperCase();
      let base = (d[1] + " " + d[2]).replace(/\s+/g, " ").trim();
      /* "TÍTULO V - A": a letra sozinha é o sufixo do número (Título V-A), não o nome */
      if (/^[IVXLCDM]+$/.test(num) && /^[A-Z]$/.test(nome)) {
        num += "-" + nome; base += "-" + nome; nome = "";
      }
      divisao = abrir(tipo, num, base, "", "", i + 1);
      if (n.nome !== nome) n.nome = nome;             /* "TÍTULO V - A": o nome ficou vazio */
      aplicarNome(divisao, n, i + 1, linha);
      aguardaNome = !nome;
      esperaNome = aguardaNome;
      /* a divisão também não é artigo: se o cabeçalho cair dentro do
       * texto do artigo anterior, o bloco seguinte herdaria o artigo
       * errado na hora de contar o progresso */
      atual = null;
      return;
    }
    const dl = linha.match(LEI_RE_DIVISAO_LIVRE);
    if (dl) {
      const base = dl[1].replace(/\s+/g, " ").trim();
      /* "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS" (o ADCT) abre um ramo de topo: sem isto o
       * cabeçalho caía DENTRO do último artigo do corpo, e os artigos do ADCT iam parar no último Título */
      divisao = abrir(/^ATO/i.test(base) ? "ATO" : /^PARTE/i.test(base) ? "PARTE" : "DISPOSICOES", "", base, "", "", i + 1);
      aguardaNome = false;
      esperaNome = false;
      atual = null;
      return;
    }

    const fx = leiLerFaixaRevogada(linha);
    if (fx) {
      atual = {
        num: fx.num, numCru: fx.numCru, ordem: leiNumOrdem(fx.num), linha: i + 1,
        corpo: linha.slice(fx.len), linhas: [linha], faixaFim: fx.fim, rotuloFaixa: fx.rotulo,
        div: divisao,
      };
      artigos.push(atual);
      return;
    }
    let a = leiCasarArtigo(linha);
    if (a) {
      /* "Art. 178 - A isenção…": o leitor lê o art. 178 (o "A" é o começo do texto), e não o 178-A */
      const brutoArt = linha.match(LEI_RE_ARTIGO);
      if (brutoArt && leiNumNormal(brutoArt[1]) !== leiNumNormal(a[1])) {
        const idS = "sufixo:" + (i + 1) + ":" + leiNumCruLimpo(brutoArt[1]);
        const recS = !!rec[idS];
        ajustes.push({ id: idS, tipo: "sufixo", linha: i + 1, linhaFim: i + 1, antes: cortaAj(linha, 200),
          de: leiNumCruLimpo(brutoArt[1]), para: leiNumCruLimpo(a[1]), letra: String(brutoArt[1]).slice(-1), recusado: recS });
        if (recS) a = brutoArt;
      }
      const cruBruto = String(a[1]).replace(/\s+/g, "");
      let cruArt = leiNumCruLimpo(a[1]);
      if (cruArt !== cruBruto) {
        const idO = "ordinal:" + (i + 1) + ":" + cruBruto;
        const recO = !!rec[idO];
        ajustes.push({ id: idO, tipo: "ordinal", linha: i + 1, linhaFim: i + 1, antes: cortaAj(linha, 200),
          de: cruBruto, para: cruArt, recusado: recO });
        if (recO) cruArt = cruBruto;
      }
      atual = {
        num: leiNumNormal(a[1]),
        numCru: cruArt,
        ordem: leiNumOrdem(a[1]),
        linha: i + 1,
        corpo: linha.slice(a[0].length),
        linhas: [linha],
        div: divisao,
      };
      artigos.push(atual);
      return;
    }

    if (atual) {
      atual.linhas.push(linha);
      if (String(linha).trim()) atual.corpo += "\n" + linha;
    } else if (String(linha).trim()) {
      fora.push({ linha: i + 1, texto: linha });       /* não entra em artigo nenhum: fica fora da leitura */
    }
  });

  divisoes.forEach((d) => { d.caminho = (d.pai ? d.pai.caminho : []).concat(d.rotulo); });

  /* as linhas fora da leitura (o preâmbulo, o que vem entre uma divisão e o 1º artigo), em trechos */
  const trechos = [];
  fora.forEach((f) => {
    const u = trechos[trechos.length - 1];
    if (u && f.linha - u.fim <= 3) { u.fim = f.linha; u.linhas.push(f.texto); }
    else trechos.push({ ini: f.linha, fim: f.linha, linhas: [f.texto] });
  });
  trechos.forEach((g) => ajustes.push({ id: "fora:" + g.ini, tipo: "fora", linha: g.ini, linhaFim: g.fim,
    antes: cortaAj(g.linhas.join(" "), 240), n: g.linhas.length, informativo: true, recusado: false }));
  /* o nome final da divisão (o nome pode ter vindo na linha seguinte à da nota) */
  ajustes.forEach((a) => {
    if (!a.divId) return;
    const d = divisoes.filter((x) => x.id === a.divId)[0];
    if (d) a.nome = cortaAj(d.nome, 120);
  });
  cit.blocos.forEach((b) => {
    ajustes.push({ id: b.id, tipo: "citacao", linha: b.linha, linhaFim: b.fim, antes: cortaAj(linhas[b.linha - 1], 200),
      rotulo: b.rotulo, alvo: b.alvo ? b.alvo.curto : "", n: b.n, recusado: !!b.recusado });
  });
  ajustes.sort((x, y) => x.linha - y.linha);

  return {
    ajustes,
    divisoes,
    artigos: artigos.map((a, i) => ({
      num: a.num,
      numCru: a.numCru,
      ordem: a.ordem,
      indice: i,
      linha: a.linha,
      linhaFim: a.linha + a.linhas.length - 1,
      rotulo: a.rotuloFaixa || "Art. " + a.numCru,
      faixaFim: a.faixaFim || 0,
      ementa: leiEmenta(a.corpo),
      texto: a.linhas.join("\n").replace(/\s+$/, ""),
      corpo: a.corpo.trim(),
      divisao: a.div ? a.div.rotulo : "",
      divisaoTipo: a.div ? a.div.tipo : "",
      divisaoId: a.div ? a.div.id : "",
      caminho: a.div ? a.div.caminho : [],
    })),
  };
}

/* Transforma o texto colado numa lista de artigos.
 *
 * Devolve, para cada artigo: o número (cru e normalizado), a ementa, o
 * texto completo com os incisos e parágrafos que vêm abaixo dele, a
 * linha onde começa (para o editor saber onde rolar) e a divisão em que
 * está (`divisao`, o rótulo; `divisaoId` e `caminho`, a hierarquia). Tudo que
 * vem ANTES do primeiro artigo (ementa da lei, preâmbulo, "O PRESIDENTE DA
 * REPÚBLICA…") fica de fora da lista — não é artigo e contaria como um,
 * estragando toda a numeração. */
function leiArtigos(texto, opc) {
  return leiLerLei(texto, opc).artigos;
}

/* As opções de leitura de UMA lei: os ajustes que a pessoa mandou manter no original */
function leiOpcDaLei(l) {
  return { recusados: (l && l.ajustesRecusados) || {} };
}

/* Manter o original (recusar) ou voltar ao ajuste do leitor. Só muda o jeito de LER: o texto guardado não muda. */
function leiAjusteRecusar(idLei, ids, recusar) {
  const l = leiDe(idLei);
  const lista = [].concat(ids || []);
  if (!l || !lista.length) return false;
  const r = Object.assign({}, l.ajustesRecusados || {});
  lista.forEach((id) => { if (recusar) r[id] = true; else delete r[id]; });
  const ok = leiGuardar({ id: idLei, ajustesRecusados: r });
  try {
    reg("LEI", recusar ? "ajuste do leitor recusado (fica o original)" : "ajuste do leitor aceito de novo",
      (l.nome || idLei) + " · " + lista.length + " ajuste(s)" + (lista.length === 1 ? " · " + lista[0] : ""));
  } catch (e) {}
  return !!ok;
}

/* A ÁRVORE DA LEI: cada nó é uma divisão, com os artigos que são DIRETAMENTE dela (índices em
 * `artigos`), os filhos, e o total/primeiro/último artigo do ramo inteiro. Artigos que vêm antes
 * de qualquer divisão ficam num nó virtual "(sem divisão)". */
function leiEstruturaLei(texto, opc) {
  const lei = leiLerLei(texto, opc);
  const nos = {};
  const raiz = [];
  const vazio = (d) => ({ id: d.id, tipo: d.tipo, nivel: d.nivel, num: d.num, nome: d.nome, nota: d.nota,
    rotulo: d.rotulo, caminho: d.caminho, linha: d.linha, pai: d.pai ? d.pai.id : "",
    filhos: [], artigos: [], virtual: false, de: -1, ate: -1, total: 0 });
  lei.divisoes.forEach((d) => {
    const n = vazio(d);
    nos[n.id] = n;
    (d.pai ? nos[d.pai.id].filhos : raiz).push(n);
  });
  let semDivisao = null;
  lei.artigos.forEach((a, i) => {
    let n = a.divisaoId ? nos[a.divisaoId] : null;
    if (!n) {
      if (!semDivisao) {
        semDivisao = vazio({ id: "", tipo: "", nivel: 0, num: "", nome: "", nota: "", rotulo: "(sem divisão)",
          caminho: [], linha: 0, pai: null });
        semDivisao.virtual = true;
      }
      n = semDivisao;
    }
    n.artigos.push(i);
  });
  if (semDivisao) raiz.unshift(semDivisao);
  const fechar = (n) => {
    let de = n.artigos.length ? n.artigos[0] : -1;
    let ate = n.artigos.length ? n.artigos[n.artigos.length - 1] : -1;
    let total = n.artigos.length;
    n.filhos.forEach((f) => {
      fechar(f);
      if (!f.total) return;
      if (de < 0 || f.de < de) de = f.de;
      if (f.ate > ate) ate = f.ate;
      total += f.total;
    });
    n.de = de; n.ate = ate; n.total = total;
  };
  raiz.forEach(fechar);
  return { raiz, nos, artigos: lei.artigos, semDivisao, ajustes: lei.ajustes };
}

function leiArtigo(texto, num) {
  const alvo = leiNumNormal(num);
  const todos = leiArtigos(texto);
  /* um artigo dentro de um grupo revogado ("Arts. 12 a 15") também existe */
  return todos.filter((a) => a.num === alvo)[0]
    || todos.filter((a) => a.faixaFim && /^\d+$/.test(alvo)
      && Number(alvo) >= Math.floor(a.ordem / 100) && Number(alvo) <= a.faixaFim)[0]
    || null;
}

/* =====================================================================
 * ARTIGOS REPETIDOS NO TEXTO COLADO
 *
 * O CASO REAL. O Código Tributário de Caruaru, copiado do PDF, traz o
 * "Art. 3º" antigo (TACHADO no PDF) e o "Art. 3º" novo, com "(Redação
 * dada pela Lei Complementar nº 018…)". O tachado se perde ao copiar como
 * texto, e o leitor guardava os dois sem aviso — com o "ir ao art. 3º" e a
 * prévia de citação caindo no PRIMEIRO, justamente o substituído. E a
 * atualização de versão comparava por número com a ÚLTIMA ocorrência
 * ganhando em silêncio.
 *
 * O QUE ISTO FAZ: acha os números repetidos que parecem DEFEITO, lê os
 * sinais de vigência de cada ocorrência e SUGERE qual fica. Nunca decide:
 * quem decide é quem cola (a tela mostra a lista e pede confirmação).
 *
 * O QUE NÃO É DEFEITO. A Constituição repete número entre o corpo e o ADCT
 * de propósito, e uma lei com anexos pode recomeçar a numeração. Por isso
 * só entram os repetidos LADO A LADO (posições consecutivas): o artigo
 * antigo e o novo saem colados um no outro; corpo e ADCT ficam a
 * centenas de artigos de distância. (Uma primeira versão também aceitava
 * "mesma divisão", e apontava o art. 5º do ADCT como repetido do corpo:
 * o cabeçalho do ADCT não é uma divisão reconhecida, então os artigos dele
 * herdam a divisão do corpo.)
 * ===================================================================== */
const LEI_RE_SINAL_REDACAO =
  /\(\s*(?:reda[çc][ãa]o\s+dada|nova\s+reda[çc][ãa]o|com\s+a\s+reda[çc][ãa]o)\s+([^)]*)\)/i;
const LEI_RE_SINAL_REVOGADO = /\(\s*revogad[oa]\b[^)]*\)|\brevogad[oa]\s+pel[ao]\b/i;
const LEI_RE_SINAL_VETADO = /\(\s*vetad[oa]\b[^)]*\)/i;
const LEI_RE_SINAL_INCLUIDO = /\(\s*inclu[íi]d[oa]\s+pel[ao]\b[^)]*\)/i;

/* O que o TEXTO de uma ocorrência diz sobre a própria vigência. */
function leiSinaisDoArtigo(a) {
  const corpo = String((a && a.corpo) || "");
  const red = corpo.match(LEI_RE_SINAL_REDACAO);
  if (red) {
    /* "pela Lei Complementar nº 018, de 09 de outubro de 2009" */
    return { tipo: "redacao", fonte: String(red[1]).replace(/^\s*pel[ao]s?\s+/i, "").trim() };
  }
  if (/\(\s*renumerad[oa]\b[^)]*\)/i.test(corpo)) return { tipo: "renumerado", fonte: "" };
  if (LEI_RE_SINAL_REVOGADO.test(corpo)) return { tipo: "revogado", fonte: "" };
  if (LEI_RE_SINAL_VETADO.test(corpo)) return { tipo: "vetado", fonte: "" };
  if (String(corpo).replace(/\([^)]*\)/g, "").replace(/\s+/g, "").length < 6) {
    return { tipo: "vazio", fonte: "" };
  }
  if (LEI_RE_SINAL_INCLUIDO.test(corpo)) return { tipo: "incluido", fonte: "" };
  return { tipo: "", fonte: "" };
}

/* pontos de EVIDÊNCIA (o texto diz) — a posição entra à parte, só para
 * desempatar, e nunca vira "confiança" */
function leiPontosDeSinal(tipo) {
  return ({ redacao: 4, renumerado: 4, incluido: 1, revogado: -6, vetado: -6, vazio: -3 })[tipo] || 0;
}

function leiNormalizaTexto(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/* Devolve os grupos de números repetidos SUSPEITOS:
 *   [{ num, numCru, rotulo, candidatos:[{ indice, linha, linhaFim, texto, corpo, pos, sinais }],
 *      sugerido: <indice global do artigo sugerido>, confianca: "forte"|"fraca",
 *      motivo: "redacao"|"revogado"|"vetado"|"vazio"|"identico"|"posicao", fonte }] */
function leiDuplicados(texto, ignorar) {
  const arts = leiArtigos(texto);
  /* os números que a pessoa JÁ CONFERIU e mandou manter (a lei repete de
   * verdade) não voltam a ser apontados */
  const conferidos = {};
  (ignorar || []).forEach((n) => { conferidos[leiNumNormal(n)] = true; });
  const porNum = {};
  arts.forEach((a) => { (porNum[a.num] = porNum[a.num] || []).push(a); });
  const grupos = [];
  Object.keys(porNum).forEach((num) => {
    const L = porNum[num];
    if (L.length < 2 || conferidos[num]) return;
    const suspeito = L.some((a, i) => i > 0 && a.indice === L[i - 1].indice + 1);
    if (!suspeito) return;
    const cands = L.map((a, k) => ({
      indice: a.indice, linha: a.linha, linhaFim: a.linhaFim, texto: a.texto,
      corpo: a.corpo, pos: k, sinais: leiSinaisDoArtigo(a),
    }));

    const sug = leiSugerirEntre(cands);
    grupos.push({
      num, numCru: L[0].numCru, rotulo: L[0].rotulo, candidatos: cands,
      sugerido: sug.melhor.indice, confianca: sug.confianca, motivo: sug.motivo, fonte: sug.fonte,
      ordem: leiNumOrdem(num) * 1000,
    });
  });
  /* + o mesmo rótulo de parágrafo duas vezes no MESMO artigo */
  leiRepetidosNoArtigo(texto, ignorar).forEach((g) => grupos.push(g));
  return grupos.sort((x, y) => x.ordem - y.ordem);
}

/* SUGESTÃO. Primeiro o que o TEXTO diz; a posição só desempata. */
function leiSugerirEntre(cands) {
  let motivo = "posicao", confianca = "fraca", fonte = "";
  let melhor = cands[cands.length - 1];
  const ev = cands.map((c) => leiPontosDeSinal(c.sinais.tipo));
  const maior = Math.max.apply(null, ev);
  const segundo = ev.slice().sort((x, y) => y - x)[1];
  if (maior - segundo >= 3) {
    const i = ev.indexOf(maior);
    melhor = cands[i];
    confianca = "forte";
    motivo = melhor.sinais.tipo === "redacao" ? "redacao"
      : melhor.sinais.tipo === "renumerado" ? "renumerado"
      : (cands.some((c) => c.sinais.tipo === "revogado") ? "revogado"
        : (cands.some((c) => c.sinais.tipo === "vetado") ? "vetado" : "vazio"));
    fonte = melhor.sinais.fonte || "";
  } else if (cands.every((c) => leiNormalizaTexto(c.texto) === leiNormalizaTexto(cands[0].texto))) {
    melhor = cands[0];
    confianca = "forte";
    motivo = "identico";
  }
  return { melhor, confianca, motivo, fonte };
}

/* As palavras de A que NÃO existem em B — o que muda de uma redação para a
 * outra, para a tela poder destacar. Comparação sem caixa e sem pontuação
 * das pontas; devolve [{ t, dif }] na ordem original de A. */
function leiPalavrasDiferentes(a, b) {
  const limpa = (w) => String(w).toLowerCase().replace(/^[^a-z0-9à-ú]+|[^a-z0-9à-ú]+$/gi, "");
  const contagem = {};
  String(b || "").split(/\s+/).forEach((w) => {
    const k = limpa(w);
    if (k) contagem[k] = (contagem[k] || 0) + 1;
  });
  return String(a || "").split(/\s+/).filter(Boolean).map((w) => {
    const k = limpa(w);
    if (k && contagem[k] > 0) { contagem[k]--; return { t: w, dif: false }; }
    return { t: w, dif: !!k };
  });
}

/* Aplica as ESCOLHAS de quem colou. decisoes = { [num]: { manter, original } }
 *   manter   — o "indice" do artigo que fica, ou "todas" (a lei repete de verdade);
 *   original — guardar a redação substituída como texto-base e a escolhida
 *              como ALTERAÇÃO (o leitor mostra "alterado por …" e "ver a
 *              redação original"). Só vale para grupos de duas ocorrências
 *              em que a escolhida traz "Redação dada pela…" e a outra não.
 * Devolve { texto, alteracoes, resumo }. NÃO grava nada. */
function leiAplicarDuplicados(texto, grupos, decisoes) {
  const linhas = String(texto || "").split("\n");
  const fora = {};
  const alteracoes = {};
  const resumo = [];
  (grupos || []).forEach((g) => {
    const d = (decisoes || {})[g.num];
    if (!d || d.manter === "todas" || d.manter === undefined) {
      resumo.push({ num: g.num, acao: "todas" });
      return;
    }
    const escolhido = g.candidatos.filter((c) => c.indice === d.manter)[0];
    if (!escolhido) { resumo.push({ num: g.num, acao: "todas" }); return; }
    const outros = g.candidatos.filter((c) => c !== escolhido);
    const comoAlteracao = !!d.original && !g.intra && outros.length === 1
      && escolhido.sinais.tipo === "redacao" && outros[0].sinais.tipo !== "redacao";
    const tirar = comoAlteracao ? [escolhido] : outros;
    tirar.forEach((c) => { for (let n = c.linha; n <= c.linhaFim; n++) fora[n] = true; });
    if (comoAlteracao) {
      alteracoes[g.num] = { texto: escolhido.texto, fonteAlteracao: escolhido.sinais.fonte || "",
        data: leisHojeISO(), revogado: false };
      resumo.push({ num: g.num, acao: "alteracao", fonte: escolhido.sinais.fonte || "" });
    } else {
      resumo.push({ num: g.num, acao: "manter", indice: escolhido.indice });
    }
  });
  const final = linhas.filter((_, i) => !fora[i + 1]).join("\n").replace(/\n{3,}/g, "\n\n");
  return { texto: final, alteracoes, resumo };
}

/* =====================================================================
 * TEXTO COLADO NUMA LINHA SÓ
 *
 * O leitor reconhece "Art." só no COMEÇO de uma linha. Um texto que chegou
 * sem quebras (colado de um chat, de um site que achata o parágrafo, de um
 * PDF em que cada artigo virou uma linha só) dava ZERO artigos — e a lei
 * inteira virava um bloco de texto em que nada funciona.
 *
 * O QUE ISTO FAZ: procura cabeçalhos de artigo escritos DEPOIS de outro
 * texto ("… nos termos da lei. Art. 3º O Código …") e propõe uma quebra de
 * linha antes de cada um. Só propõe: quem cola vê quais artigos foram
 * encontrados e confirma (lei-ui.js). É uma inserção de "\n" — nenhum
 * caractere é perdido.
 *
 * O QUE NÃO SE TOMA POR CABEÇALHO (uma remissão não é um artigo novo):
 *  · "Art." sem estar depois de ponto final, dois-pontos, ponto e vírgula,
 *    parêntese ou de um TÍTULO EM MAIÚSCULAS ("DAS DISPOSIÇÕES PRELIMINARES
 *    Art. 1º"): "nos termos do art. 5º" tem uma palavra comum antes;
 *  · "art." em minúscula;
 *  · número que fura a SEQUÊNCIA: menor que o anterior, ou que salta mais
 *    de 50 artigos. "…; Art. 2º do Decreto…" dentro do art. 7º é remissão.
 *
 * PARA LER MELHOR, e só depois de achar os artigos, também quebra antes de
 * "§ n", "Parágrafo único" e dos incisos romanos ("I - …") que vêm depois
 * de ponto final, dois-pontos ou ponto e vírgula. NÃO quebra antes de
 * LIVRO/TÍTULO/CAPÍTULO: numa lista ("LIVRO I - Estabelece…") isso
 * viraria uma divisão da lei.
 * ===================================================================== */
const LEI_RE_ART_EMBUTIDO =
  /(^|\n|[.:;)!?]["”')]*[ \t]+|[A-ZÀ-Ú]{3,}[ \t]+)(Art(?:\.|igo)[ \t]*(\d{1,4})(?:[ \t]*[ºo°ª])?(?:[ \t]*[-–][ \t]*[A-Z])?)(?=[\s.\-–—)])/g;

function leiSepararColagem(texto) {
  const src = String(texto || "");
  const cands = [];
  let m;
  const re = new RegExp(LEI_RE_ART_EMBUTIDO.source, "g");
  let anterior = null;
  while ((m = re.exec(src)) !== null) {
    const ord = leiNumOrdem(m[3]);
    const dentroDaSequencia = anterior === null
      || (ord >= anterior && ord - anterior <= 5000);
    if (!dentroDaSequencia) continue;            /* remissão, não cabeçalho */
    anterior = ord;
    const ini = m.index + m[1].length;           /* onde começa o "Art" */
    cands.push({
      ini, ws: m.index + m[1].replace(/[ \t]+$/, "").length,
      rotulo: m[2].replace(/\s+/g, " ").replace(/^Artigo/, "Art."),
      num: leiNumNormal(m[3]),
    });
  }
  const linhaArtigos = leiArtigos(src).length;
  const vazio = { aplicavel: false, texto: src, artigos: [], quebras: 0 };
  if (cands.length < 2 || cands.length <= linhaArtigos) return vazio;

  /* 1) uma linha por artigo */
  let saida = "";
  let ultimo = 0;
  cands.forEach((c) => {
    saida += src.slice(ultimo, c.ws);
    if (c.ws > 0 && src.charAt(c.ws - 1) !== "\n") saida += "\n";
    ultimo = c.ini;
  });
  saida += src.slice(ultimo);

  /* 2) legibilidade dentro do artigo */
  saida = saida
    .replace(/([.:;)])[ \t]+(§[ \t]*\d{1,3}[ \t]*[ºo°]?|Par[áa]grafo[ \t]+[úu]nico)/g, "$1\n$2")
    .replace(/([:;.])[ \t]+([IVXL]{1,6}[ \t]*[-–—][ \t])/g, "$1\n$2");

  const achados = leiArtigos(saida);
  /* a prova dos nove: se depois de tudo o leitor não enxerga ao menos os
   * cabeçalhos que se encontrou, a proposta não vale */
  if (achados.length < cands.length) return vazio;
  return {
    aplicavel: true, texto: saida,
    artigos: cands.map((c) => ({ num: c.num, rotulo: c.rotulo })),
    quebras: (saida.match(/\n/g) || []).length - (src.match(/\n/g) || []).length,
  };
}

/* =====================================================================
 * LIMPAR O TEXTO COLADO DE UM PDF — o app SUGERE, quem cola DECIDE
 *
 * O CASO REAL. Ctrl+A num PDF de lei (o Código Tributário de Caruaru, 296
 * páginas) traz, além da lei: o cabeçalho da prefeitura a cada página, os
 * Anexos de tabelas depois do último artigo, "Art . 382" com espaço,
 * "Art. 356. A -" no lugar de 356-A, remissões que a quebra de linha jogou
 * para o começo de uma linha ("…previstas no / artigo 16 desta Lei") e a
 * redação velha ao lado da nova DENTRO do mesmo artigo. O leitor lia tudo
 * isso como lei: artigos falsos, artigos cortados no meio, o Anexo inteiro
 * dentro do último artigo — e, na atualização de versão, centenas de
 * "mudou" e "revogado" que não eram nada disso.
 *
 * OS TIPOS DE ERRO (cada um tem um grupo abaixo e um teste):
 *   1. TEXTO QUE NÃO É LEI      cabeçalho/rodapé repetido, número de página,
 *                               caracteres invisíveis, Anexos.
 *   2. CABEÇALHO NÃO RECONHECIDO "“ Art. 162" (citação de lei alteradora),
 *                               "Art . 382", "Art. 356. A -".
 *   3. CABEÇALHO FALSO          remissão ("artigo 16 desta Lei") ou divisão
 *                               ("LIVRO II Regula…;") que a quebra de linha
 *                               pôs no começo da linha.
 *   4. REPETIÇÃO DENTRO DO ARTIGO  § velho e § novo (leiRepetidosNoArtigo).
 * O que esta função NÃO faz: decidir. Cada mudança volta com o que estava,
 * o que ficaria e por quê; quem aplica é leiAplicarPreprocesso, só com as
 * escolhas de quem colou, e nada é gravado antes disso.
 *
 * Todas as mudanças são identificadas pela linha ORIGINAL (1 = primeira),
 * então cada grupo pode ser aceito ou recusado sem mexer nos outros.
 * ===================================================================== */

/* linha que ENCERRA uma frase: o que vem depois pode ser um cabeçalho */
const LEI_RE_FIM_FRASE = /[.:;!?)\]”"’']\s*$/;
/* nota de vigência sozinha na linha: "(Redação dada pela…)" repete-se
 * centenas de vezes e NÃO é cabeçalho de página */
const LEI_RE_ANOTACAO_SOZINHA =
  /^\s*[(\[_*]*\s*(?:reda[çc][ãa]o|inclu[íi]d|revogad|renumerad|vetad|vide\b|acrescentad|com\s+a\s+reda|produ[çc][ãa]o\s+de\s+efeito|vig[êe]ncia|\(?nr\)|\(?ac\))/i;
const LEI_RE_PARAGRAFO =
  /^\s*(?:§\s*(\d{1,3})\s*[ºo°ª]?|(Par[áa]grafo\s+[úu]nico))(?=[\s.\-–—:]|$)/i;
const LEI_RE_INCISO = /^\s*[IVXLCDM]{1,7}\s*[-–—.)]\s/;
const LEI_RE_ALINEA = /^\s*[a-z]\)\s/;
const LEI_RE_ANEXO_MAIUSCULO = /^\s*ANEXO\s+([IVXLCDM]+|\d{1,3}|[ÚU]NICO)\b(.*)$/;
const LEI_RE_ANEXO_SOZINHO = /^\s*Anexo\s+([IVXLCDM]+|\d{1,3}|[úu]nico)\s*$/;
const LEI_RE_INVISIVEIS = /[­​-‍⁠﻿]/g;

/* A linha tem cara de ESTRUTURA da lei (e por isso não pode ser tomada por
 * cabeçalho de página repetido)? */
function leiLinhaEstrutural(linha) {
  const s = String(linha || "");
  return LEI_RE_ARTIGO.test(s) || LEI_RE_DIVISAO.test(s)
    || LEI_RE_PARAGRAFO.test(s) || LEI_RE_INCISO.test(s) || LEI_RE_ALINEA.test(s)
    || LEI_RE_ANOTACAO_SOZINHA.test(s)
    || LEI_RE_ANEXO_MAIUSCULO.test(s) || LEI_RE_ANEXO_SOZINHO.test(s);
}

/* números de página: só as formas que não deixam dúvida ("Página 3 de 296",
 * "3 / 296") — o número solto só conta quando forma uma SEQUÊNCIA */
const LEI_RE_PAGINA_CLARA =
  /^\s*(?:(?:p[áa]g(?:ina)?\.?|page)\s*\d{1,4}(?:\s*(?:\/|de|of)\s*\d{1,4})?|[-–—]?\s*\d{1,4}\s*(?:\/|de)\s*\d{1,4}\s*[-–—]?)\s*$/i;
const LEI_RE_PAGINA_SOLTA = /^\s*(\d{1,4})\s*$/;

/* Só o que a linha ganha se for um cabeçalho de artigo escrito de um jeito
 * que o leitor não reconhece. Devolve a linha corrigida, ou null. */
function leiGrafiaDaLinha(linha, opc) {
  let s = String(linha);
  const orig = s;
  /* citação de lei alteradora: “ Art. 162 [...]  (na atualização "só alterações" as
   * aspas ficam: são o que separa o artigo citado do artigo da própria lei) */
  if (!(opc && opc.manterAspas)) s = s.replace(/^(\s*)[“”"«»]+\s*(?=Art(?:\.|igo)?\s*\d)/i, "$1");
  /* "Art . 382" */
  s = s.replace(/^(\s*)(Art)\s+\.\s*(?=\d)/i, "$1$2. ");
  /* "Art. 356. A - texto"  =>  "Art. 356-A. texto" */
  s = s.replace(/^(\s*)Art(?:\.|igo)?\s*(\d{1,4})\s*([ºo°ª]?)(?:\.\s*|\s+)([A-Z])\s*[-–—]\s*(?=\S)/,
    (m0, ini, n, ord, letra) => ini + "Art. " + n + ord + "-" + letra + ". ");
  /* "Parágra único" */
  s = s.replace(/^(\s*)Par[áa]gra\s+([úu]nico)/i, "$1Parágrafo $2");
  return s === orig ? null : s;
}

function leiPreprocessar(texto, opc) {
  const linhas = String(texto == null ? "" : texto).replace(/\r\n?/g, "\n").split("\n");
  const sem = linhas.map((x) => x.replace(LEI_RE_INVISIVEIS, ""));
  const mudancas = [];
  /* OS BLOCOS DE ALTERAÇÃO NÃO SE LIMPAM. O fechamento "...... ” (NR)" repetido não é rodapé de página, a aspa de
   * “Art. 9º ...... é o que marca o artigo citado, e essa linha não é frase quebrada: as três limpezas as
   * destruíam (na LC 214: 326 linhas, 72 aspas e 32 colagens). O texto fica como veio. */
  const cit = leiLerCitacoes(sem);
  const protegidas = cit.citadas;
  const trilha = (s) => String(s).replace(/\s+/g, " ").trim(); const cola = (s, n) => { const x = trilha(s); if (x.length <= n) return x; const c = x.slice(-n); const i = c.indexOf(" "); return i >= 0 && i < 24 ? c.slice(i + 1) : c; };

  /* 1a. caracteres invisíveis (hífen opcional, espaço de largura zero…) */
  const inv = [];
  linhas.forEach((x, i) => { if (x !== sem[i]) inv.push(i + 1); });
  if (inv.length) {
    mudancas.push({ id: "inv", grupo: "invisiveis", linhas: inv, ocorrencias: inv.length,
      antes: trilha(linhas[inv[0] - 1]).slice(0, 120), depois: trilha(sem[inv[0] - 1]).slice(0, 120) });
  }

  /* AS LINHAS DE UM ANEXO são tabela: o cabeçalho de uma tabela se repete de propósito (na LC 214, "Receita
   * Bruta em 12 Meses" aparece 8 vezes, uma por anexo do Simples). Tomá-lo por cabeçalho de página e sugerir
   * apagar estraga o anexo. Vale o mesmo critério dos anexos mais abaixo: do título do anexo até o próximo
   * artigo. Na atualização por lei alteradora (semAnexos) os anexos não são separados, e nada disto vale. */
  const emAnexo = {};
  if (!(opc && opc.semAnexos)) {
    let dentroAx = false;
    sem.forEach((x, i) => {
      if (protegidas.has(i + 1)) return;
      if (LEI_RE_ANEXO_MAIUSCULO.test(x) || LEI_RE_ANEXO_SOZINHO.test(x)) dentroAx = true;
      else if (dentroAx && LEI_RE_ARTIGO.test(x) && /^[\s>*]*Art/.test(x)) dentroAx = false;
      if (dentroAx) emAnexo[i + 1] = true;
    });
  }

  /* 1b. cabeçalho e rodapé repetidos a cada página */
  const ondeEsta = {};
  sem.forEach((x, i) => {
    if (protegidas.has(i + 1) || emAnexo[i + 1]) return;
    const k = trilha(x);
    if (k.length < 20) return;
    (ondeEsta[k] = ondeEsta[k] || []).push(i + 1);
  });
  const remover = {};                 /* linha (1..) já destinada a sair */
  let n = 0;
  Object.keys(ondeEsta).forEach((k) => {
    const L = ondeEsta[k];
    if (L.length < 3) return;
    if (leiLinhaEstrutural(k)) return;
    if (/^[\d\s.,;:()\-–—/%R$]+$/.test(k)) return;       /* linha de tabela, só números */
    /* cabeçalho de página se repete ESPAÇADO; a mesma linha três vezes num
     * trecho curto é linha de tabela ou frase repetida de verdade */
    if ((L[L.length - 1] - L[0]) / (L.length - 1) < 5) return;
    L.forEach((ln) => { remover[ln] = true; });
    mudancas.push({ id: "cab:" + (n++), grupo: "cabecalho", linhas: L, ocorrencias: L.length,
      antes: k.slice(0, 160), depois: "" });
  });

  /* 1c. número de página */
  const pag = [];
  /* (um número de item de tabela de anexo — 1, 2, 3, 4… — não é número de página: na LC 214 eram 445 linhas) */
  sem.forEach((x, i) => { if (!emAnexo[i + 1] && LEI_RE_PAGINA_CLARA.test(x)) pag.push(i + 1); });
  /* número solto: só a SEQUÊNCIA +1, com 5 ou mais */
  let cadeia = [];
  const fechaCadeia = () => { if (cadeia.length >= 5) cadeia.forEach((c) => pag.push(c.ln)); cadeia = []; };
  sem.forEach((x, i) => {
    const m = x.match(LEI_RE_PAGINA_SOLTA);
    if (!m || emAnexo[i + 1]) return;
    const v = Number(m[1]);
    if (cadeia.length && v === cadeia[cadeia.length - 1].v + 1) cadeia.push({ v, ln: i + 1 });
    else { fechaCadeia(); cadeia = [{ v, ln: i + 1 }]; }
  });
  fechaCadeia();
  const pagFim = Array.from(new Set(pag)).filter((ln) => !remover[ln]).sort((a, b) => a - b);
  if (pagFim.length) {
    pagFim.forEach((ln) => { remover[ln] = true; });
    mudancas.push({ id: "pag", grupo: "pagina", linhas: pagFim, ocorrencias: pagFim.length,
      antes: pagFim.slice(0, 4).map((ln) => trilha(sem[ln - 1])).join(" · "), depois: "" });
  }

  /* 2. cabeçalho de artigo escrito de um jeito que o leitor não reconhece.
   * Daqui em diante trabalha-se sobre a linha JÁ corrigida, para que a
   * checagem de remissão veja o mesmo texto que o leitor veria. */
  const efetiva = sem.slice();
  sem.forEach((x, i) => {
    if (remover[i + 1] || protegidas.has(i + 1)) return;
    const g = leiGrafiaDaLinha(x, opc);
    if (g === null) return;
    efetiva[i] = g;
    mudancas.push({ id: "gra:" + (i + 1), grupo: "grafia", linhas: [i + 1], manterAspas: !!(opc && opc.manterAspas),
      antes: trilha(x).slice(0, 160), depois: trilha(g).slice(0, 160) });
  });

  /* 3. cabeçalho FALSO: remissão ou divisão que a quebra de linha pôs no
   * começo da linha. */
  const anteriorViva = (i) => {
    for (let j = i - 1; j >= 0; j--) if (!remover[j + 1] && efetiva[j].trim()) return j;
    return -1;
  };
  let ultimaOrdem = null;
  efetiva.forEach((x, i) => {
    if (remover[i + 1] || protegidas.has(i + 1)) return;
    const a = leiCasarArtigo(x);
    const d = !a && x.match(LEI_RE_DIVISAO);
    if (!a && !d) return;
    const j = anteriorViva(i);
    let falso = false, motivo = "";
    if (a && j >= 0) {
      const palavra = (x.match(/^[\s>*]*(art(?:igo)?)/i) || [])[1] || "";
      const minuscula = palavra === palavra.toLowerCase();
      const ord = leiNumOrdem(a[1]);
      /* só um número que VOLTA é suspeito: quem cola um recorte (1, 2, 3, 9,
       * 35…) tem saltos para frente de propósito. Compara o número BASE:
       * "31" depois de "31-A" ainda é a mesma altura da lei. */
      const cabe = ultimaOrdem === null
        || Math.floor(ord / 100) >= Math.floor(ultimaOrdem / 100);
      /* a linha de cima FECHOU a frase? Título de divisão, nome de capítulo em
       * maiúsculas e anexo também contam como fechados: depois deles vem artigo */
      const cima = efetiva[j].trim();
      /* "CAPÍTULO II" e, na linha de baixo, "Da Receita": o NOME da divisão
       * também não termina com ponto, e depois dele vem o artigo */
      const nomeDeDivisao = cima.length <= 90 && (() => {
        const jj = anteriorViva(j);
        return jj >= 0 && LEI_RE_DIVISAO.test(efetiva[jj].trim());
      })();
      const fechou = LEI_RE_FIM_FRASE.test(cima) || LEI_RE_DIVISAO.test(cima)
        || LEI_RE_ANEXO_MAIUSCULO.test(cima) || nomeDeDivisao
        || (cima === cima.toUpperCase() && cima.length <= 110);
      if (minuscula) { falso = true; motivo = "minuscula"; }
      else if (!fechou && !cabe) { falso = true; motivo = "sequencia"; }
    }
    if (d && j >= 0 && /[;,]\s*$/.test(x)) { falso = true; motivo = "divisao"; }
    if (falso) {
      mudancas.push({ id: "rem:" + (i + 1), grupo: "remissao", linhas: [i + 1], motivo,
        contexto: cola(efetiva[j], 110),
        antes: trilha(x).slice(0, 160),
        depois: cola(efetiva[j], 110) + " " + trilha(x).slice(0, 160) });
      return;
    }
    if (a) ultimaOrdem = leiNumOrdem(a[1]);
  });

  /* 4. anexos: cada "ANEXO X" vai até o próximo anexo ou o próximo artigo */
  const anx = [];
  efetiva.forEach((x, i) => {
    if (remover[i + 1] || protegidas.has(i + 1)) return;
    if (opc && opc.semAnexos) return;     /* lei que ALTERA: os anexos são lidos por leiAnexosDaAlteradora */
    const m = x.match(LEI_RE_ANEXO_MAIUSCULO) || x.match(LEI_RE_ANEXO_SOZINHO);
    if (m) anx.push(i);
  });
  anx.forEach((ini, k) => {
    let fim = efetiva.length - 1;
    for (let j = ini + 1; j < efetiva.length; j++) {
      if (remover[j + 1]) continue;
      if (k + 1 < anx.length && j === anx[k + 1]) { fim = j - 1; break; }
      if (LEI_RE_ARTIGO.test(efetiva[j]) && /^[\s>*]*Art/.test(efetiva[j])) { fim = j - 1; break; }
    }
    while (fim > ini && (remover[fim + 1] || !efetiva[fim].trim())) fim--;
    let titulo = trilha(efetiva[ini]);
    const prox = efetiva[ini + 1] !== undefined ? trilha(efetiva[ini + 1]) : "";
    if (prox && prox.length <= 110 && prox === prox.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(prox)) titulo += " — " + prox;
    let tam = 0;
    for (let j = ini; j <= fim; j++) if (!remover[j + 1]) tam += efetiva[j].length;
    mudancas.push({ id: "anx:" + (ini + 1), grupo: "anexo", linhas: [ini + 1, fim + 1],
      titulo: titulo.slice(0, 140), tamanho: tam, decisaoPadrao: "separar",
      antes: titulo.slice(0, 140), depois: "" });
  });

  const ordem = { invisiveis: 0, cabecalho: 1, pagina: 2, grafia: 3, remissao: 4, anexo: 5 };
  mudancas.sort((x, y) => (ordem[x.grupo] - ordem[y.grupo]) || (x.linhas[0] - y.linhas[0]));
  return { mudancas, linhas: linhas.length, blocos: cit.blocos, protegidas: protegidas.size };
}

/* Aplica as ESCOLHAS de quem colou. decisoes = { [id]: true|false } — e, nos
 * anexos, "separar" | "manter" | "descartar". O que não foi decidido vale a
 * sugestão (true / "separar"). Com TODAS as mudanças recusadas, devolve o
 * texto exatamente como veio. NÃO grava nada.
 * Devolve { texto, anexos:[{titulo,texto}], resumo }. */
function leiAplicarPreprocesso(texto, mudancas, decisoes) {
  const bruto = String(texto == null ? "" : texto).replace(/\r\n?/g, "\n");
  const dec = decisoes || {};
  const cur = bruto.split("\n").map((t) => ({ t, x: false }));
  const anexos = [];
  const resumo = { invisiveis: 0, cabecalho: 0, pagina: 0, grafia: 0, remissao: 0,
    anexosSeparados: 0, anexosDescartados: 0 };
  const vale = (c) => (c.grupo === "anexo"
    ? (dec[c.id] === undefined ? "separar" : dec[c.id])
    : (dec[c.id] === undefined ? true : !!dec[c.id]));
  let mexeu = false;

  (mudancas || []).forEach((c) => {
    if (c.grupo === "invisiveis" && vale(c)) {
      cur.forEach((o) => { o.t = o.t.replace(LEI_RE_INVISIVEIS, ""); });
      resumo.invisiveis = c.ocorrencias; mexeu = true;
    }
  });
  (mudancas || []).forEach((c) => {
    if ((c.grupo === "cabecalho" || c.grupo === "pagina") && vale(c)) {
      c.linhas.forEach((ln) => { if (cur[ln - 1]) cur[ln - 1].x = true; });
      resumo[c.grupo] += c.linhas.length; mexeu = true;
    }
  });
  (mudancas || []).forEach((c) => {
    if (c.grupo === "grafia" && vale(c) && cur[c.linhas[0] - 1] && !cur[c.linhas[0] - 1].x) {
      const g = leiGrafiaDaLinha(cur[c.linhas[0] - 1].t, { manterAspas: c.manterAspas });
      if (g !== null) { cur[c.linhas[0] - 1].t = g; resumo.grafia++; mexeu = true; }
    }
  });
  (mudancas || []).forEach((c) => {
    if (c.grupo !== "remissao" || !vale(c)) return;
    const i = c.linhas[0] - 1;
    if (!cur[i] || cur[i].x) return;
    let j = i - 1;
    while (j >= 0 && (cur[j].x || !cur[j].t.trim())) j--;
    if (j < 0) return;
    cur[j].t = cur[j].t.replace(/\s+$/, "") + " " + cur[i].t.trim();
    cur[i].x = true;
    resumo.remissao++; mexeu = true;
  });
  (mudancas || []).forEach((c) => {
    if (c.grupo !== "anexo") return;
    const v = vale(c);
    if (v !== "separar" && v !== "descartar") return;
    const partes = [];
    for (let ln = c.linhas[0]; ln <= c.linhas[1]; ln++) {
      const o = cur[ln - 1];
      if (o && !o.x) { partes.push(o.t); o.x = true; }
    }
    if (v === "separar") {
      anexos.push({ titulo: c.titulo, texto: partes.join("\n").replace(/^\s+|\s+$/g, "") });
      resumo.anexosSeparados++;
    } else resumo.anexosDescartados++;
    mexeu = true;
  });

  let saida = cur.filter((o) => !o.x).map((o) => o.t).join("\n");
  if (mexeu) saida = saida.replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
  return { texto: mexeu ? saida : bruto, anexos, resumo };
}

/* =====================================================================
 * A ESTRUTURA DE UM ARTIGO — parágrafo, inciso, alínea e item, EM ORDEM
 *
 * A LC 95/1998 fixa a hierarquia: o ARTIGO se desdobra em PARÁGRAFOS (§ 1º,
 * § 10, Parágrafo único); o artigo ou o parágrafo enumera INCISOS (I, II…);
 * o inciso se desdobra em ALÍNEAS (a), b)…); a alínea, em ITENS (1., 2.…).
 * Uma alteração legal muitas vezes mexe só num inciso ou numa alínea e não
 * toca o caput — então o leitor precisa saber a QUAL parágrafo e a QUAL
 * inciso cada pedaço pertence.
 *
 * O ERRO QUE MOTIVOU ISTO. A primeira versão da conferência de repetidos
 * lia o rótulo do parágrafo só pelo número e ignorava o sufixo: "§ 4º",
 * "§ 4º-A", "§ 4º-B" e "§ 4º-C" da Constituição viravam "o §4º aparece 4
 * vezes", e a tela sugeria apagar três parágrafos legítimos. "§ 19" e
 * "§ 19-A" também. O sufixo é parte do endereço: § 4º-A é OUTRO parágrafo.
 *
 * COMO SE LÊ, E POR QUÊ EM ORDEM. Um rótulo só vale se for o PRÓXIMO da
 * sequência daquele nível: depois do inciso II espera-se o III (ou a alínea
 * a); depois da alínea b, a c. Isso é o que separa "II" de inciso de um
 * "II" de remissão ("os incisos II, III do caput") e é o que permite abrir
 * um trecho corrido ("I - …; II - …; III - …") sem cortar frase. Rótulo fora
 * de ordem no começo da linha vira unidade com `quebra:true` (sequência
 * recomeçada — o sinal de redação velha ao lado da nova).
 *
 * Devolve { caput, unidades[] }. Cada unidade: tipo, rotulo (como escrito),
 * chave (o endereço: "P4A", "P5>II", "P5>II>c"), texto próprio, linha (0 =
 * primeira do artigo), inicioDeLinha, quebra, nivel, pai, e depois de lido,
 * linhaFim/soLinhas (a extensão em linhas, com filhos).
 * ===================================================================== */
const LEI_RE_ROMANO = /^(?:M{0,3})(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;

function leiRomanoValor(s) {
  const t = String(s || "");
  if (!t || !LEI_RE_ROMANO.test(t)) return 0;
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < t.length; i++) {
    const a = v[t[i]], b = v[t[i + 1]] || 0;
    total += a < b ? -a : a;
  }
  return total;
}

function leiValorRomano(n) {
  const tab = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "", x = n;
  tab.forEach(([v, s]) => { while (x >= v) { r += s; x -= v; } });
  return r;
}

/* Lê UM rótulo no começo de `s`. Não julga se está na ordem: só diz o que é. */
function leiLerRotulo(s) {
  let m = String(s).match(/^Par[áa]grafo\s+[úu]nico(?![A-Za-zÀ-ú])\.?/i);
  if (m) return { tipo: "paragrafo", unico: true, valor: 0, sufixo: "", rotulo: m[0], len: m[0].length };
  /* § 4º · § 4º-A · § 10 · §4º.  (o sufixo é COLADO ao número: "§ 4º - A lei…" não é 4º-A) */
  /* §§ 2º a 4º (Revogados): um só item que cobre a faixa */
  m = String(s).match(/^§§\s*(\d{1,3})\s*[ºo°ª]?\s*(?:a|ao|e|,)\s*(\d{1,3})\s*[ºo°ª]?/);
  if (m && /revogad|vetad/i.test(String(s).slice(0, 80))) {
    return { tipo: "paragrafo", unico: false, valor: Number(m[1]), valorFim: Number(m[2]), sufixo: "", rotulo: m[0].trim(), len: m[0].length };
  }
  m = String(s).match(/^§\s*(\d{1,3})\s*[ºo°ª]?(?:-([A-Z])(?![A-Za-zÀ-ú]))?\s*\.?(?=\s|[-–—:]|$|[A-ZÀ-Ú])/);
  if (m) return { tipo: "paragrafo", unico: false, valor: Number(m[1]), sufixo: m[2] || "", rotulo: m[0].trim(), len: m[0].length };
  /* inciso: romano maiúsculo, com sufixo colado (XIV-A), seguido de - . ) : ou espaço */
  /* II a IV (Revogados) */
  m = String(s).match(/^([IVXLCDM]{1,8})\s+(?:a|ao)\s+([IVXLCDM]{1,8})(?=[\s.:-]*\(?\s*revogad)/i);
  if (m && leiRomanoValor(m[1]) && leiRomanoValor(m[2])) {
    return { tipo: "inciso", valor: leiRomanoValor(m[1]), valorFim: leiRomanoValor(m[2]), sufixo: "", rotulo: m[0].trim(), len: m[0].length };
  }
  m = String(s).match(/^([IVXLCDM]{1,8})(?:-([A-Z])(?![A-Za-zÀ-ú]))?(?:\s*[-–—.):]\s*|\s+)(?=\S)/);
  if (m && leiRomanoValor(m[1])) {
    return { tipo: "inciso", valor: leiRomanoValor(m[1]), sufixo: m[2] || "", rotulo: m[0].trim(), len: m[0].length };
  }
  /* alínea: a) b) … */
  m = String(s).match(/^([a-z])\)\s*(?=\S)/);
  if (m) return { tipo: "alinea", valor: m[1].charCodeAt(0) - 96, sufixo: "", rotulo: m[0].trim(), len: m[0].length };
  /* item: 1. 2. … (só até 2 dígitos, com ponto ou parêntese e espaço depois) */
  m = String(s).match(/^(\d{1,2})\s*[.)]\s+(?=\S)/);
  if (m) return { tipo: "item", valor: Number(m[1]), sufixo: "", rotulo: m[0].trim(), len: m[0].length };
  return null;
}

function leiEstruturaArtigo(texto, opc) {
  const frag = !!(opc && opc.fragmento);
  const linhas = String(texto == null ? "" : texto).split("\n");
  const caput = { tipo: "caput", chave: "caput", rotulo: "", texto: "", linha: 0, inicioDeLinha: true,
    nivel: 0, quebra: false, pai: null, ultInc: null, ultAli: null, ultIte: null };
  const unidades = [];
  let par = caput, inc = null, ali = null, cur = caput;

  /* o que se ESPERA a seguir, em cada nível, dado onde a leitura está */
  const proximo = (u) => u && { valor: (u.valorFim || u.valor) + 1, mesmoValor: (u.valorFim || u.valor), sufixo: u.sufixo };
  const esperados = () => {
    const paiAli = inc || par, paiIte = ali || inc || par;
    return {
      inciso: par.ultInc ? proximo(par.ultInc) : { valor: 1, mesmoValor: 0, sufixo: "" },
      alinea: paiAli.ultAli ? proximo(paiAli.ultAli) : { valor: 1, mesmoValor: 0, sufixo: "" },
      item: paiIte.ultIte ? proximo(paiIte.ultIte) : { valor: 1, mesmoValor: 0, sufixo: "" },
    };
  };
  const naOrdem = (rot, esp) => {
    if (!esp) return false;
    if (rot.valor === esp.valor && !rot.sufixo) return true;
    /* II-A depois de II */
    if (rot.valor === esp.mesmoValor && rot.sufixo && esp.mesmoValor > 0) return true;
    return false;
  };
  /* aceito EM ORDEM (vale em qualquer posição) */
  const aceitaOrdem = (rot) => {
    if (rot.tipo === "paragrafo") return true;
    const e = esperados();
    if (rot.tipo === "inciso") return naOrdem(rot, e.inciso);
    if (rot.tipo === "alinea") return naOrdem(rot, e.alinea);
    return naOrdem(rot, e.item);
  };
  /* fora de ordem no COMEÇO da linha: sequência recomeçada, ou o 1º pedaço de um fragmento */
  const aceitaQuebra = (rot) => {
    if (rot.tipo === "paragrafo") return true;
    const e = esperados();
    const paiAli = inc || par, paiIte = ali || inc || par;
    const tem = rot.tipo === "inciso" ? par.ultInc : rot.tipo === "alinea" ? paiAli.ultAli : paiIte.ultIte;
    const ex = rot.tipo === "inciso" ? e.inciso : rot.tipo === "alinea" ? e.alinea : e.item;
    if (!tem) return frag;                       /* sem irmão anterior: só em fragmento */
    if (frag) return true;                       /* fragmento tem lacunas: II, V (III e IV não mudaram) */
    return rot.valor < ex.valor;                 /* recomeça (I depois de VII, a) depois de c)) */
  };

  /* em FRAGMENTO (lei que altera): o primeiro pedaço de um tipo pode começar em qualquer
   * letra/número ("f) companhias aéreas") — o resto do artigo não está no texto */
  const primeiroDoTipo = (rot) => {
    if (rot.tipo === "paragrafo") return true;
    const paiAli = inc || par, paiIte = ali || inc || par;
    const tem = rot.tipo === "inciso" ? par.ultInc : rot.tipo === "alinea" ? paiAli.ultAli : paiIte.ultIte;
    return !tem || rot.valor > (tem.valorFim || tem.valor);       /* ou um salto para a frente */
  };

  const criar = (rot, li, inicioDeLinha, quebra) => {
    const u = { tipo: rot.tipo, valor: rot.valor, valorFim: rot.valorFim || 0, sufixo: rot.sufixo, unico: !!rot.unico, rotulo: rot.rotulo,
      chave: "", texto: "", linha: li, inicioDeLinha, quebra, nivel: 0, pai: null,
      ultInc: null, ultAli: null, ultIte: null };
    if (rot.tipo === "paragrafo") {
      u.chave = rot.unico ? "PU" : "P" + rot.valor + rot.sufixo;
      u.nivel = 1; u.pai = caput; par = u; inc = null; ali = null;
    } else if (rot.tipo === "inciso") {
      const nome = leiValorRomano(rot.valor) + rot.sufixo;
      u.chave = (par === caput ? "" : par.chave + ">") + nome;
      u.nivel = 2; u.pai = par; par.ultInc = u; inc = u; ali = null;
    } else if (rot.tipo === "alinea") {
      const pai = inc || par;
      u.chave = (pai === caput ? "" : pai.chave + ">") + String.fromCharCode(96 + rot.valor);
      u.nivel = 3; u.pai = pai; pai.ultAli = u; ali = u;
    } else {
      const pai = ali || inc || par;
      u.chave = (pai === caput ? "" : pai.chave + ">") + rot.valor;
      u.nivel = 4; u.pai = pai; pai.ultIte = u;
    }
    unidades.push(u);
    cur = u;
    return u;
  };

  const juntar = (u, txt) => {
    const t = String(txt || "").trim();
    if (t) u.texto += (u.texto ? " " : "") + t;
  };

  /* o próximo rótulo DENTRO da linha (trecho corrido): só o que está em ordem,
   * depois de fim de frase, e — para parágrafo — com pontuação ou maiúscula */
  const proximoInline = (s) => {
    const re = /[.;:)\]”"⟧]\s+(?=\S)/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      const p = m.index + m[0].length;
      const rot = leiLerRotulo(s.slice(p));
      if (rot && (aceitaOrdem(rot) || (frag && primeiroDoTipo(rot)))) return p;
    }
    return -1;
  };

  linhas.forEach((linha, li) => {
    let s = String(linha);
    if (li === 0) {
      const a = leiCasarArtigo(s);
      if (a) s = s.slice(a[0].length);
    }
    let inicio = true;
    while (s.trim()) {
      s = s.replace(/^\s+/, "");
      let rot = leiLerRotulo(s);
      let quebra = false;
      if (rot) {
        if (aceitaOrdem(rot)) quebra = false;
        else if (inicio && aceitaQuebra(rot)) quebra = true;
        else if (!inicio && frag && primeiroDoTipo(rot)) quebra = true;    /* 1º pedaço de um fragmento, no meio do trecho */
        else rot = null;
      }
      if (rot) { criar(rot, li, inicio, quebra); s = s.slice(rot.len); }
      const p = proximoInline(s);
      juntar(cur, p < 0 ? s : s.slice(0, p));
      if (p < 0) break;
      s = s.slice(p);
      inicio = false;
    }
  });

  /* a extensão de cada unidade em LINHAS, filhos incluídos: vai até a linha
   * antes da próxima unidade de nível igual ou menor */
  unidades.forEach((u, i) => {
    let k = i + 1;
    while (k < unidades.length && unidades[k].nivel > u.nivel) k++;
    const prox = unidades[k];
    let fim = prox ? prox.linha - 1 : linhas.length - 1;
    let soLinhas = u.inicioDeLinha && (!prox || prox.inicioDeLinha);
    if (prox && prox.linha === u.linha) { fim = u.linha; soLinhas = false; }
    while (fim > u.linha && !String(linhas[fim] || "").trim()) fim--;
    u.linhaFim = Math.max(u.linha, fim);
    u.soLinhas = soLinhas;
  });
  return { caput, unidades, linhas: linhas.length };
}

/* "§ 4º-A" · "inciso II do § 5º" · "alínea c do inciso II" — para a tela dizer
 * de qual pedaço se fala */
function leiRotuloDaUnidade(u) {
  if (!u) return "";
  if (u.tipo === "paragrafo") return u.unico ? "parágrafo único" : "§" + u.valor + "º" + (u.sufixo ? "-" + u.sufixo : "");
  const meu = u.tipo === "inciso" ? "inciso " + leiValorRomano(u.valor) + u.sufixo
    : u.tipo === "alinea" ? "alínea " + String.fromCharCode(96 + u.valor) : "item " + u.valor;
  const pai = u.pai && u.pai.tipo !== "caput" ? leiRotuloDaUnidade(u.pai) : "";
  return pai ? meu + " do " + pai : meu;
}

/* As linhas ao redor de um trecho (1 = primeira linha do texto), com as do
 * trecho marcadas — para a tela mostrar como o trecho está na lei. */
function leiContextoDeLinhas(texto, linhaIni, linhaFim, antes, depois) {
  const L = String(texto == null ? "" : texto).split("\n");
  const de = Math.max(1, linhaIni - (antes || 0));
  const ate = Math.min(L.length, linhaFim + (depois || 0));
  const out = [];
  for (let n = de; n <= ate; n++) out.push({ n, texto: L[n - 1], alvo: n >= linhaIni && n <= linhaFim });
  return out;
}

/* =====================================================================
 * REPETIÇÃO DENTRO DO MESMO ARTIGO
 *
 * O PDF do Código de Caruaru (texto consolidado com tachados) traz, dentro
 * do Art. 9º, o "§5º" antigo e o "§5º" novo ("Redação dada pela LC 018");
 * no Art. 10, o "Parágrafo Único" antigo e o "§1º" novo ("Renumerado do
 * parágrafo único"). Não são artigos repetidos — leiDuplicados não os via —,
 * e a lei guardava as duas redações juntas, sem aviso.
 *
 * Só se aponta o que é SUSPEITO: o MESMO endereço (parágrafo com o mesmo
 * número E sufixo; ou inciso/alínea repetidos LADO A LADO no mesmo pai) duas
 * vezes no mesmo artigo. § 4º e § 4º-A são endereços diferentes e NUNCA são
 * apontados. O grupo sai no formato de leiDuplicados (a mesma tela escolhe
 * qual fica), com `intra: true` — a redação substituída não pode virar
 * "alteração", que só existe por artigo inteiro. Só entra candidato que
 * começa no começo de uma linha: o que está no meio de um trecho corrido
 * não se corta por linha.
 * ===================================================================== */
function leiRepetidosNoArtigo(texto, ignorar) {
  /* LEI QUE ALTERA OUTRA (emenda, lei complementar alteradora): o "Art. 1º" dela traz, entre aspas, a nova
   * redação de VÁRIOS artigos de outra lei, cada um com os seus §1º, §2º, §3º… Como os artigos citados não
   * são artigos desta lei, todos esses parágrafos caem no mesmo artigo e o mesmo endereço se repete de
   * verdade — em artigos diferentes da lei alterada. Não é repetição: a EC 132/2023 dava 22 grupos falsos. */
  if (leiEhAlteradora(texto)) return [];
  const conferidos = {};
  (ignorar || []).forEach((n) => { conferidos[leiNumNormal(n)] = true; });
  const grupos = [];
  leiArtigos(texto).forEach((a) => {
    const est = leiEstruturaArtigo(a.texto);
    const linhas = a.texto.split("\n");
    const porChave = {};
    est.unidades.forEach((u, i) => { (porChave[u.tipo + "|" + u.chave] = porChave[u.tipo + "|" + u.chave] || []).push({ u, i }); });
    /* "Renumerado do parágrafo único" diz a QUAL parágrafo antigo este substitui */
    est.unidades.forEach((u, i) => {
      if (u.tipo !== "paragrafo" || u.unico) return;
      if (/\(\s*renumerad[oa]\s+do\s+par[áa]grafo\s+[úu]nico/i.test(u.texto)) {
        (porChave["paragrafo|PU"] = porChave["paragrafo|PU"] || []).push({ u, i, renum: true });
      }
    });
    Object.keys(porChave).forEach((k) => {
      let L = porChave[k].slice().sort((x, y) => x.i - y.i);
      if (L.length < 2) return;
      const u0 = L[0].u;
      /* inciso, alínea e item: só repetidos LADO A LADO (o mesmo pai, sem irmão no meio) */
      if (u0.tipo !== "paragrafo") {
        const lado = [];
        L.forEach((x, j) => { if (j > 0 && x.u.pai === L[j - 1].u.pai && x.i > L[j - 1].i
          && !est.unidades.slice(L[j - 1].i + 1, x.i).some((y) => y.pai === x.u.pai && y.tipo === x.u.tipo)) {
          if (lado.indexOf(L[j - 1]) < 0) lado.push(L[j - 1]);
          lado.push(x);
        } });
        L = lado;
        if (L.length < 2) return;
      }
      if (!L.every((x) => x.u.soLinhas)) return;
      const num = a.num + "#" + u0.chave;
      if (conferidos[leiNumNormal(num)]) return;
      const cands = L.map((x, pos) => {
        const ls = linhas.slice(x.u.linha, x.u.linhaFim + 1);
        const t = ls.join("\n");
        return { indice: 1000000 + (a.linha + x.u.linha) * 4 + pos, linha: a.linha + x.u.linha,
          linhaFim: a.linha + x.u.linhaFim, texto: t, corpo: t, pos, sinais: leiSinaisDoArtigo({ corpo: t }) };
      });
      const s = leiSugerirEntre(cands);
      const rot = leiRotuloDaUnidade(u0);
      grupos.push({
        num, numCru: a.numCru + " — " + rot, rotulo: a.rotulo + " — " + rot,
        candidatos: cands, sugerido: s.melhor.indice, confianca: s.confianca,
        motivo: s.motivo, fonte: s.fonte, intra: true,
        ordem: leiNumOrdem(a.num) * 1000 + 1 + Math.min(u0.linha, 900),
      });
    });
  });
  return grupos;
}

/* =====================================================================
 * A LEI QUE ALTERA OUTRA — ler as alterações e propor o texto novo
 *
 * O CASO REAL. A LC 95/2022, a 112/2023 e a 145/2024 alteram o Código
 * Tributário de Caruaru (LC 15/2009) SEM trazer a lei inteira: trazem só os
 * dispositivos alterados, entre aspas, com marcas — "(NR)" nova redação,
 * "(AC)" acréscimo, "REVOGADO", e "[...]" no lugar do que não mudou. O
 * "Art. 1º" delas é da PRÓPRIA lei alteradora, não do Código. Colar isso na
 * atualização "de lei inteira" produzia "Art. 1º mudou" e centenas de
 * "revogado" (ver leiPreprocessar/leiUpdGuardas).
 *
 * O QUE ISTO FAZ, e o que NÃO faz:
 *  1. Separa os artigos PRÓPRIOS da lei alteradora (a sequência 1º, 2º, 3º…)
 *     dos artigos-ALVO (os citados). Nunca decide sozinho o texto novo.
 *  2. De cada artigo-alvo lê os pedaços por endereço (parágrafo, inciso,
 *     alínea) e a marca de cada um: nova redação, acréscimo, revogado ou
 *     omitido "[...]". O artigo pode vir INTEIRO (sem "[...]") ou só em
 *     PARTES — e uma parte pode mexer num inciso sem tocar o caput.
 *  3. Monta o texto proposto MESCLANDO as partes no artigo vigente (leiMesclar
 *     Fragmento). Onde não acha o dispositivo, diz qual — e a pessoa edita.
 *  4. Lê as ordens de revogar ("Fica revogado o art. 5º", "Revoga-se o § 2º
 *     do art. 296") e AVISA dos Anexos ("Ficam substituídos os Anexos…"), que
 *     não são atualizados automaticamente.
 * ===================================================================== */
const LEI_RE_OMISSAO = /\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)/g;
const LEI_OMITIDO = "⟦…⟧";
const LEI_MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

/* a data da lei, do título ("DE 23 DE DEZEMBRO DE 2024") → "2024-12-23" */
function leiDataDaLei(texto) {
  const cab = String(texto || "").slice(0, 3000);
  const m = cab.match(/\bDE\s+(\d{1,2})[ºo°]?\s+DE\s+([A-Za-zçÇãÃ]+)\s+DE\s+(\d{4})/i);
  if (!m) return "";
  const mes = LEI_MESES[leiTxtChave(m[2])];
  if (!mes) return "";
  return m[3] + "-" + String(mes).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0");
}

/* Os cabeçalhos "Art. N" da lei alteradora, no meio de linha ou não, com a posição. */
function leiCabecalhosAlteradora(s) {
  /* Os sufixos aparecem de três jeitos: "Art. 273-A", "Art. 343A" e — nos PDFs consolidados —
   * "Art. 356. B São responsáveis…" (número, ponto, LETRA, texto). O terceiro é ambíguo com o
   * artigo definido ("Art. 10. O prazo…"): só vale sem ordinal, e as letras A, E e O só valem
   * se a vizinha (B; D ou F; N ou P) aparece no mesmo número. */
  const re = /(^|\n|[.:;)\]”"]\s+)(["“]?\s*)(Arts?\.?|Artigo)\s*(\d{1,4})(?:([A-Z])(?![A-Za-zÀ-ú])|\s*([ºo°ª]?)(?:-([A-Z])(?![A-Za-zÀ-ú]))?(\.\s+([A-Z])(?=\s+[A-ZÀ-Ú(\["“]))?)(?!\d)/g;
  const hs = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const ini = m.index + m[1].length + m[2].length;
    const fimTotal = m.index + m[0].length;
    const letraPonto = m[9] || "";
    hs.push({ ini, fim: fimTotal, fimBase: fimTotal - (m[8] ? m[8].length : 0), inteiro: Number(m[4]),
      sufixo: m[5] || m[7] || "", letraPonto, ord: m[6] || "", cru: m[4] });
  }
  const tem = (int, L) => hs.some((x) => x.inteiro === int && x.letraPonto === L);
  hs.forEach((h) => {
    if (h.letraPonto) {
      const L = h.letraPonto;
      const vizinha = tem(h.inteiro, String.fromCharCode(L.charCodeAt(0) - 1)) || tem(h.inteiro, String.fromCharCode(L.charCodeAt(0) + 1));
      const valida = h.ord === "" && (!/[AEO]/.test(L) || vizinha);
      if (valida) h.sufixo = L; else h.fim = h.fimBase;
    }
    h.numCru = h.cru + (h.sufixo ? "-" + h.sufixo : "");
    h.num = leiNumNormal(h.numCru);
  });
  return hs;
}

/* A marca de um pedaço, e o texto sem a marca */
function leiMarcaDoTrecho(txt) {
  const t = String(txt || "");
  const limpo = t.replace(/\(\s*(?:NR|AC)\s*\)/g, "").split(LEI_OMITIDO).join(" ").replace(/\s+/g, " ").trim();
  let acao = "sem";
  if (/\(\s*NR\s*\)/.test(t)) acao = "nr";
  else if (/\(\s*AC\s*\)/.test(t)) acao = "ac";
  else if (/^\(?\s*revogad[oa]s?\b/i.test(limpo) || /^\S{0,12}\s*\(?\s*revogad/i.test(limpo)) acao = "rev";
  else if (!limpo) acao = "omitido";
  return { acao, texto: limpo };
}

/* O corpo de UM artigo-alvo: caput + unidades com marca; inteiro ou parcial. */
function leiLerBlocoAlterado(corpo) {
  const s0 = String(corpo || "").replace(/[”"]/g, " ");
  const temOmissao = new RegExp(LEI_RE_OMISSAO.source).test(s0);
  const s = s0.replace(new RegExp(LEI_RE_OMISSAO.source, "g"), " " + LEI_OMITIDO + " ");
  const est = leiEstruturaArtigo(s, { fragmento: true });
  const cap = leiMarcaDoTrecho(est.caput.texto);
  const unidades = est.unidades.map((u) => {
    const mk = leiMarcaDoTrecho(u.texto);
    return { tipo: u.tipo, chave: u.chave, rotulo: u.rotulo, texto: mk.texto, acao: mk.acao,
      nivel: u.nivel, valor: u.valor, sufixo: u.sufixo, unico: u.unico };
  });
  /* "Art. 274. A" + incisos: um caput que sobrou só com a letra inicial não é caput */
  const caputVazio = cap.acao === "omitido" || (cap.texto.length < 12 && cap.acao !== "rev");
  const parcial = temOmissao || (caputVazio && unidades.length > 0);
  return { caputTexto: caputVazio ? "" : cap.texto, caputAcao: caputVazio ? "omitido" : cap.acao,
    unidades, parcial, temOmissao, revogado: cap.acao === "rev" && !unidades.length && !temOmissao };
}

/* Onde entra um pedaço NOVO na lista plana do artigo: depois do irmão anterior
 * (com o que pende dele), ou antes do primeiro irmão, ou logo abaixo do pai. */
function leiPosicaoDeInsercao(L, u) {
  const paiChave = u.chave.indexOf(">") >= 0 ? u.chave.slice(0, u.chave.lastIndexOf(">")) : "";
  const irmaos = [];
  L.forEach((x, i) => {
    if (i === 0 || x.tipo !== u.tipo) return;
    const pc = x.chave.indexOf(">") >= 0 ? x.chave.slice(0, x.chave.lastIndexOf(">")) : "";
    if (pc === paiChave) irmaos.push(i);
  });
  const antes = (x) => (x.unico ? 0 : (x.valor || 0)) * 100 + (x.sufixo ? x.sufixo.charCodeAt(0) - 64 : 0);
  const meu = antes(u);
  const fimDoSubtree = (i) => { let k = i + 1; while (k < L.length && (L[k].nivel || 0) > (L[i].nivel || 0)) k++; return k; };
  let ant = -1;
  irmaos.forEach((i) => { if (antes(L[i]) <= meu) ant = i; });
  if (ant >= 0) return fimDoSubtree(ant);
  if (irmaos.length) return irmaos[0];
  if (u.tipo === "paragrafo") return L.length;
  if (!paiChave) return 1;                                     /* logo depois do caput */
  const pai = L.findIndex((x) => x.chave === paiChave);
  return pai >= 0 ? pai + 1 : L.length;
}

/* MESCLA as partes de um artigo-alvo no artigo vigente. Só atua pelo ENDEREÇO
 * (chave): "II" do caput, "P4A", "P2>II>b". Devolve o texto proposto e o que
 * não conseguiu localizar. `opc.fonte` acrescenta "(Redação dada por …)". */
function leiMesclarFragmento(baseTexto, bloco, opc) {
  const fonte = opc && opc.fonte;
  const est = leiEstruturaArtigo(baseTexto);
  const h = leiCasarArtigo(String(baseTexto).split("\n")[0]);
  const prefixo = h ? h[0].replace(/\s+$/, "") : ((opc && opc.prefixo) || "");
  const L = [{ tipo: "caput", chave: "caput", rotulo: "", texto: est.caput.texto, nivel: 0 }].concat(
    est.unidades.map((u) => ({ tipo: u.tipo, chave: u.chave, rotulo: u.rotulo, texto: u.texto,
      nivel: u.nivel, valor: u.valor, sufixo: u.sufixo, unico: u.unico })));
  const problemas = [];
  const nota = (acao) => (fonte ? (acao === "ac" ? " (Incluído por " : " (Redação dada por ") + fonte + ")" : "");
  let mudou = 0;
  if (bloco.caputTexto && bloco.caputAcao === "nr") { L[0].texto = bloco.caputTexto + nota("nr"); mudou++; }
  bloco.unidades.forEach((u) => {
    if (u.acao === "omitido") return;
    const rot = leiRotuloDaUnidade({ tipo: u.tipo, unico: u.unico, valor: u.valor, sufixo: u.sufixo,
      pai: u.chave.indexOf(">") >= 0 ? paiDe(L, u) : null });
    const i = L.findIndex((x) => x.chave === u.chave && x.tipo === u.tipo);
    if (u.acao === "rev") {
      if (i >= 0) { L[i].texto = "(Revogado" + (fonte ? " por " + fonte : "") + ")"; mudou++; }
      else problemas.push({ k: "nao_achou", unidade: rot });
      return;
    }
    const acao = u.acao === "sem" ? (i >= 0 ? "nr" : "ac") : u.acao;
    if (i >= 0) {
      if (acao === "ac") problemas.push({ k: "ja_existia", unidade: rot });
      L[i].texto = u.texto + nota(acao);
      mudou++;
      return;
    }
    if (acao === "nr") problemas.push({ k: "nao_existia", unidade: rot });
    L.splice(leiPosicaoDeInsercao(L, u), 0, { tipo: u.tipo, chave: u.chave, rotulo: u.rotulo,
      texto: u.texto + nota("ac"), nivel: u.nivel, valor: u.valor, sufixo: u.sufixo, unico: u.unico });
    mudou++;
  });
  return { texto: leiMontarArtigo(prefixo, L), ok: problemas.length === 0, problemas, mudou };
}

function paiDe(L, u) {
  const pc = u.chave.slice(0, u.chave.lastIndexOf(">"));
  const x = L.filter((y) => y.chave === pc)[0];
  return x ? { tipo: x.tipo, unico: x.unico, valor: x.valor, sufixo: x.sufixo, pai: null } : null;
}

/* a lista plana de volta em linhas: "Art. N. caput" + uma linha por pedaço */
function leiMontarArtigo(prefixo, L) {
  const cab = (String(prefixo || "") + " " + (L[0] ? L[0].texto : "")).trim();
  const resto = L.slice(1).map((x) => (String(x.rotulo || "") + " " + String(x.texto || "")).trim());
  return [cab].concat(resto).join("\n");
}

/* Lê a lei alteradora inteira. Devolve:
 *   { ident, curto, dataLei, blocos:[{num,numCru,corpo,bloco}], revogacoes:[{num,unidade}],
 *     avisos:[{k:"anexo",texto}], proprios:n } */
function leiLerAlteradora(texto, alvo) {
  const bruto = String(texto == null ? "" : texto).replace(/\r\n?/g, "\n");
  const ident = leiIdentificar(bruto);
  /* os ANEXOS (tabelas no fim da lei alteradora) saem antes de ler os artigos */
  const sep = leiAnexosDaAlteradora(bruto);
  const s = sep.texto;
  const hs = leiCabecalhosAlteradora(s);
  const par = { ident, curto: (ident && ident.curto) || "", dataLei: leiDataDaLei(bruto), blocos: [],
    revogacoes: [], avisos: [], proprios: 0, ordensAnexo: [], anexos: sep.anexos, textoSemAnexos: s };
  let proximo = 1;
  hs.forEach((h, i) => {
    const seg = s.slice(h.fim, i + 1 < hs.length ? hs[i + 1].ini : s.length);
    const omissaoLogo = /^\s*\.?\s*(?:\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\))/.test(seg);
    h.proprio = h.inteiro === proximo && !h.sufixo && !omissaoLogo;
    if (h.proprio) proximo++;
    h.seg = seg;
  });
  hs.forEach((h) => {
    if (h.proprio) {
      par.proprios++;
      leiDiretivasDoArtigoProprio(h.seg, alvo, par);
      return;
    }
    par.blocos.push({ num: h.num, numCru: h.numCru, corpo: h.seg, bloco: leiLerBlocoAlterado(h.seg) });
  });
  return par;
}

/* As ordens do artigo PRÓPRIO que não trazem texto entre aspas:
 * "Fica revogado o art. 5º", "Revogam-se os arts. 12 a 15", "Revoga-se o § 2º do
 * art. 296", e as menções a Anexos (que só se avisam). */
function leiDiretivasDoArtigoProprio(seg, alvo, par) {
  /* "art. 5º" tem ponto: protege as abreviaturas antes de cortar as frases */
  const frases = String(seg).replace(/\b(arts?|inc|n)\./gi, "$1\u0001").split(/[.;:]\s+/);
  frases.forEach((fr) => {
    const f = fr.replace(/\u0001/g, ".").replace(/\s+/g, " ").trim();
    if (!f) return;
    if (/\banexos?\b/i.test(f) && /substitu|revog|alter|inclu|acrescent|nova reda|passa(?:m)?\s+a\s+vigorar/i.test(f)) {
      const oa = leiOrdemDeAnexo(f);
      if (oa) par.ordensAnexo.push(oa);
      else par.avisos.push({ k: "anexo", texto: f.slice(0, 160) });
      return;
    }
    if (!/^(?:fica(?:m)?\s+revogad|revog(?:a-se|am-se)|s[ãa]o\s+revogad)/i.test(f) || /passa(?:m)?\s+a\s+vigorar/i.test(f)) return;
    /* "§ 2º do art. 296", "parágrafo único do art. 5º", "inciso II do art. 10" */
    const re = /(§\s*\d{1,3}[ºo°]?(?:-[A-Z])?|par[áa]grafo\s+[úu]nico|inciso\s+[IVXLC]{1,6})\s+do\s+art(?:igo)?\.?\s*(\d{1,4}(?:[ºo°])?(?:-[A-Z])?)/gi;
    let m, achouSub = false;
    while ((m = re.exec(f)) !== null) {
      achouSub = true;
      const sub = { incisos: [], paragrafos: [], alineas: [] };
      leiLerSubEndereco(m[1], sub);
      par.revogacoes.push({ num: leiNumNormal(m[2]), unidade: sub });
    }
    if (achouSub) return;
    leiCitacoesNoTexto(f).forEach((c) => {
      /* outra lei ("Revoga-se o art. 5º da Lei 123/2000") não é o alvo */
      if (c.rotulo && alvo && !leiRotuloEhDaLei(c.rotulo, alvo)) return;
      par.revogacoes.push({ num: c.num, unidade: null });
    });
  });
}

/* o rótulo citado ("Lei Complementar nº 015") é a lei-alvo? */
function leiRotuloEhDaLei(rotulo, l) {
  const k = leiRotuloChave(rotulo);
  if (k.especie === "constituicao") return leiEspecieNorm(l.especie) === "cf";
  if (k.numero && l.numero) return leiNumeroNorm(k.numero) === leiNumeroNorm(l.numero);
  return false;
}

/* a lei alteradora fala DESTA lei? ("Lei Complementar nº 015 de 05 de janeiro de 2009") */
function leiAlteradoraCitaLei(texto, l) {
  if (!l || !l.numero) return true;
  const n = leiNumeroNorm(l.numero);
  const re = /(?:Lei(?:\s+Complementar)?|LC|Decreto(?:-Lei)?|Emenda\s+Constitucional|EC)\s*n?[ºo°.]?\s*0*([\d.]+)/gi;
  let m;
  const s = String(texto || "").slice(0, 60000);
  while ((m = re.exec(s)) !== null) {
    if (leiNumeroNorm(m[1]) === n) return true;
  }
  return false;
}

/* a data da alteração mais recente já aplicada a um artigo */
function leiDataUltimaAlteracao(l, num) {
  const a = ((l && l.alteracoes) || {})[num];
  if (!a) return "";
  const h = a.historico || [];
  return h.map((x) => x.dataLei || "").filter(Boolean).sort().pop() || a.dataLei || "";
}

/* AS MUDANÇAS que a lei alteradora propõe, prontas para a tela de decidir.
 * Cada item: { num, numCru, tipo: mudou|novo|revogado, antigo, novo, parcial,
 * problemas[], fonteItem, dataLei, aceito:false, recusado:false, alertas[] }. */
function leiItensDaAlteradora(l, par) {
  const efetivos = leiArtigosEfetivos(l);
  const porNum = {};
  efetivos.forEach((a) => { if (!porNum[a.num]) porNum[a.num] = a; });
  const correndo = {};                 /* o texto de cada artigo, conforme as alterações já lidas */
  const itens = [];
  const porItem = {};
  const item = (num, numCru) => {
    if (!porItem[num]) {
      const base = porNum[num] && !porNum[num].revogado ? porNum[num].texto : "";
      porItem[num] = { num, numCru, tipo: base ? "mudou" : "novo", antigo: base, novo: base, parcial: false,
        problemas: [], fonteItem: par.curto, dataLei: par.dataLei, aceito: false, recusado: false, blocos: 0 };
      itens.push(porItem[num]);
    }
    return porItem[num];
  };
  par.blocos.forEach((b) => {
    /* "Art. 383 (Revogado)": revogação do artigo inteiro — só se ele existe na lei gravada */
    if (b.bloco.revogado) {
      if (!porNum[b.num] && !porItem[b.num]) { par.avisos.push({ k: "revogar_ausente", texto: "art. " + b.numCru }); return; }
      const rv = item(b.num, b.numCru);
      rv.tipo = "revogado"; rv.novo = "";
      return;
    }
    const it = item(b.num, b.numCru);
    const base = correndo[b.num] !== undefined ? correndo[b.num] : it.antigo;
    it.blocos++;
    if (!b.bloco.parcial) {
      /* o artigo VEM INTEIRO: é a nova redação, sem mesclar */
      const L = [{ tipo: "caput", chave: "caput", rotulo: "", texto: b.bloco.caputTexto, nivel: 0 }].concat(
        b.bloco.unidades.filter((u) => u.acao !== "omitido").map((u) => ({ tipo: u.tipo, chave: u.chave,
          rotulo: u.rotulo, texto: u.texto + (par.curto ? (u.acao === "ac" ? " (Incluído por " : " (Redação dada por ") + par.curto + ")" : ""),
          nivel: u.nivel })));
      L[0].texto = L[0].texto + (par.curto && L[0].texto ? " (Redação dada por " + par.curto + ")" : "");
      correndo[b.num] = leiMontarArtigo("Art. " + b.numCru + ".", L);
      return;
    }
    it.parcial = true;
    if (!base) {
      /* só partes de um artigo que a lei gravada NÃO tem */
      const r = leiMesclarFragmento("Art. " + b.numCru + ".", b.bloco, { fonte: par.curto, prefixo: "Art. " + b.numCru + "." });
      correndo[b.num] = r.texto;
      it.problemas.push({ k: "artigo_sem_base", unidade: "" });
      return;
    }
    const r = leiMesclarFragmento(base, b.bloco, { fonte: par.curto });
    correndo[b.num] = r.texto;
    r.problemas.forEach((p) => it.problemas.push(p));
  });
  Object.keys(correndo).forEach((n) => { porItem[n].novo = correndo[n]; });

  /* as ordens de revogar */
  par.revogacoes.forEach((rv) => {
    const a = porNum[rv.num];
    if (!a && !porItem[rv.num]) { par.avisos.push({ k: "revogar_ausente", texto: "art. " + rv.num }); return; }
    const it = item(rv.num, (a && a.numCru) || rv.num);
    if (!rv.unidade) { it.tipo = "revogado"; it.novo = ""; return; }
    const un = leiAcharUnidades(it.novo || it.antigo, rv.unidade)[0];
    if (!un) { it.problemas.push({ k: "nao_achou", unidade: "o dispositivo a revogar" }); return; }
    const r = leiMesclarFragmento(it.novo || it.antigo, { caputTexto: "", caputAcao: "omitido", parcial: true,
      unidades: [{ tipo: un.tipo, chave: un.chave, rotulo: un.rotulo, texto: "", acao: "rev", nivel: un.nivel,
        valor: un.valor, sufixo: un.sufixo, unico: un.unico }] }, { fonte: par.curto });
    it.novo = r.texto; it.parcial = true;
  });

  itens.sort((x, y) => leiNumOrdem(x.num) - leiNumOrdem(y.num));
  itens.forEach((it) => {
    const al = [];
    if (it.parcial) al.push({ k: "parcial", sev: "info" });
    it.problemas.forEach((p) => al.push({ k: p.k, sev: "alerta", u: p.unidade }));
    const ult = leiDataUltimaAlteracao(l, it.num);
    if (ult && it.dataLei && it.dataLei < ult) al.push({ k: "fora_ordem", sev: "alerta", d1: it.dataLei, d2: ult });
    if (it.tipo === "revogado") al.push({ k: "revogado_pela_lei", sev: "info" });
    else if (it.novo === it.antigo && !it.problemas.length) al.push({ k: "sem_efeito", sev: "aviso" });
    /* a nota "(Redação dada por LC 145/2024)" acrescentada pela mescla não conta como número que mudou */
    const semNota = (x) => String(x).replace(/\((?:Reda[çc][ãa]o dada|Inclu[íi]do|Revogado)[^)]*\)/gi, "")
      .replace(/§+\s*\d{1,3}[ºo°]?(?:-[A-Z])?/g, "");        /* o rótulo do parágrafo também não é "número que mudou" */
    const base = (it.tipo === "revogado" || it.novo === it.antigo) ? [] : leiAlertasDaMudanca(
      { tipo: it.tipo, antigo: semNota(it.antigo), novo: semNota(it.novo), num: it.num }, {}).filter((a) => a.k !== "so_anotacao" && a.k !== "menor" && a.k !== "outro");
    it.alertas = al.concat(base);
  });
  /* os ANEXOS que a lei substitui ou revoga entram como itens (depois dos artigos) */
  const ax = leiItensDeAnexos(l, par);
  ax.itens.forEach((x) => itens.push(x));
  itens.avisos = par.avisos.concat(ax.avisos);
  return itens;
}

/* =====================================================================
 * ANEXOS — tabelas que uma lei substitui, revoga ou cria
 *
 * O CASO REAL. A LC 145/2024 diz "Ficam substituídos os Anexos VI, VII e XV"
 * e "Fica revogado o Anexo XI"; o texto dos anexos novos vem NO FIM da própria
 * lei alteradora, cada um com o número dela ("ANEXO I") e, logo abaixo, o do
 * Anexo do Código que ele substitui ("Anexo VI"). Tabela não se mescla por
 * linha: o Anexo novo SUBSTITUI o antigo (ou o revoga), e a pessoa vê os dois
 * textos antes de aceitar. O Anexo antigo fica guardado (textoOriginal) e o
 * histórico registra qual lei mexeu nele.
 *
 * Os anexos de uma lei ficam em `l.anexos` ({titulo, texto, …}), separados do
 * texto dos artigos (ver leiPreprocessar).
 * ===================================================================== */
function leiRomanoDoAnexo(s) {
  const m = String(s || "").match(/anexo\s+([IVXLCDM]{1,8}|\d{1,3}|[úu]nico)\b/i);
  return m ? m[1].toUpperCase() : "";
}

/* Os anexos de um texto, prontos para uma lei alteradora: junta o título
 * PRÓPRIO ("ANEXO I", sozinho numa linha) ao anexo-alvo que vem logo abaixo
 * ("Anexo VI" + a tabela). Devolve {texto: o texto SEM os anexos, anexos:
 * [{proprio, alvo, titulo, texto}]}. */
function leiAnexosDaAlteradora(texto) {
  const r = leiPreprocessar(texto);
  const dec = {};
  r.mudancas.forEach((m) => { dec[m.id] = m.grupo === "anexo" ? "separar" : false; });
  const ap = leiAplicarPreprocesso(texto, r.mudancas, dec);
  const brutos = ap.anexos.slice();
  const out = [];
  for (let i = 0; i < brutos.length; i++) {
    const a = brutos[i];
    const soTitulo = String(a.texto || "").replace(/\s+/g, " ").trim().length <= String(a.titulo || "").length + 12;
    if (soTitulo && brutos[i + 1]) {
      const b = brutos[i + 1];
      out.push({ proprio: a.titulo, alvo: leiRomanoDoAnexo(b.titulo) || leiRomanoDoAnexo(b.texto.split("\n")[0]),
        titulo: b.titulo, texto: b.texto });
      i++;
    } else {
      /* "ANEXO I" + "Anexo VI" na 1ª ou 2ª linha do próprio texto */
      const linhas = String(a.texto || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const alvo = linhas.slice(1, 3).map(leiRomanoDoAnexo).filter(Boolean)[0] || "";
      out.push({ proprio: a.titulo, alvo, titulo: a.titulo, texto: a.texto });
    }
  }
  return { texto: ap.texto, anexos: out };
}

/* "Ficam substituídos os Anexos VI, VII e XV" → {acao:"substituir", alvos:["VI","VII","XV"]} */
function leiOrdemDeAnexo(frase) {
  const f = String(frase || "");
  if (!/\banexos?\b/i.test(f)) return null;
  const m = f.match(/anexos?\s+((?:[IVXLCDM]{1,8}|\d{1,3})(?:\s*(?:,|\be\b|\ba\b|\bao\b)\s*(?:[IVXLCDM]{1,8}|\d{1,3}))*)\b/i);
  if (!m) return null;
  /* "VI, VII e XV" e também a faixa "VI a VIII" (= VI, VII e VIII) */
  const alvos = [];
  const reAlvo = /([IVXLCDM]{1,8}|\d{1,3})(?:\s+(?:a|ao|até)\s+([IVXLCDM]{1,8}|\d{1,3}))?/gi;
  let ma;
  while ((ma = reAlvo.exec(m[1])) !== null) {
    const x = ma[1].toUpperCase(), y = ma[2] ? ma[2].toUpperCase() : "";
    const romano = /^[IVXLCDM]+$/.test(x);
    const vx = romano ? leiRomanoValor(x) : Number(x);
    const vy = !y ? 0 : (/^[IVXLCDM]+$/.test(y) ? leiRomanoValor(y) : Number(y));
    if (y && vx > 0 && vy > vx && vy - vx < 40) {
      for (let k = vx; k <= vy; k++) alvos.push(romano ? leiValorRomano(k) : String(k));
    } else { alvos.push(x); if (y) alvos.push(y); }
  }
  if (!alvos.length) return null;
  let acao = "alterar";
  if (/revog/i.test(f)) acao = "revogar";
  else if (/substitu|nova\s+reda|passa(?:m)?\s+a\s+vigorar/i.test(f)) acao = "substituir";
  else if (/inclu|acrescent/i.test(f) && !/subitem|item\b/i.test(f)) acao = "incluir";
  return { acao, alvos, texto: f.replace(/\s+/g, " ").trim().slice(0, 160) };
}

function leiAnexoDaLei(l, romano) {
  return ((l && l.anexos) || []).filter((a) => leiRomanoDoAnexo(a.titulo) === romano)[0] || null;
}

/* Os itens de ANEXO que a lei alteradora propõe. Cada um: {num:"ANEXO:VI", rotulo:"Anexo VI",
 * tipo: anexo_subst|anexo_rev, antigo, novo, alertas[]}. Ordens que não têm o texto do anexo
 * novo, e as que só ALTERAM uma linha do anexo, viram aviso — nunca item que apagaria tabela. */
function leiItensDeAnexos(l, par) {
  const itens = [];
  const avisos = [];
  (par.ordensAnexo || []).forEach((o) => {
    o.alvos.forEach((rom, idx) => {
      const base = leiAnexoDaLei(l, rom);
      if (o.acao === "revogar") {
        itens.push({ num: "ANEXO:" + rom, numCru: rom, rotulo: "Anexo " + rom, tipo: "anexo_rev",
          antigo: base ? base.texto : "", novo: "", parcial: false, problemas: [], fonteItem: par.curto,
          dataLei: par.dataLei, aceito: false, recusado: false,
          alertas: base ? [{ k: "anexo_revogar", sev: "aviso" }] : [{ k: "anexo_sem_base", sev: "alerta" }] });
        return;
      }
      if (o.acao !== "substituir" && o.acao !== "incluir") { avisos.push({ k: "anexo", texto: o.texto }); return; }
      const novos = par.anexos || [];
      const novo = novos.filter((a) => a.alvo === rom)[0]
        || (novos.length === o.alvos.length && !novos.some((a) => a.alvo) ? novos[idx] : null);
      if (!novo) { avisos.push({ k: "anexo_sem_texto", texto: "Anexo " + rom }); return; }
      itens.push({ num: "ANEXO:" + rom, numCru: rom, rotulo: "Anexo " + rom, tipo: "anexo_subst",
        antigo: base ? base.texto : "", novo: novo.texto, parcial: false, problemas: [],
        fonteItem: par.curto, dataLei: par.dataLei, aceito: false, recusado: false,
        alertas: base ? [{ k: "anexo_tabela", sev: "info" }] : [{ k: "anexo_sem_base", sev: "alerta" }] });
    });
  });
  return { itens, avisos };
}

/* Aplica UM item de anexo aceito à lista de anexos da lei e devolve a lista NOVA (não muda a
 * recebida). O anexo antigo nunca se perde: fica em textoOriginal; o histórico diz qual lei mexeu. */
function leiAplicarAnexo(anexos, item, ctx) {
  const rom = String((item && item.num) || "").replace(/^ANEXO:/, "");
  const c = ctx || {};
  const lista = (anexos || []).map((a) => Object.assign({}, a));
  let i = -1;
  lista.forEach((a, k) => { if (i < 0 && leiRomanoDoAnexo(a.titulo) === rom) i = k; });
  if (i < 0) { lista.push({ titulo: "ANEXO " + rom, texto: "" }); i = lista.length - 1; }
  const a = lista[i];
  const hist = Array.isArray(a.historico) ? a.historico.slice() : [];
  hist.push({ fonte: c.fonte || "", data: c.data || "", dataLei: item.dataLei || "", tipo: item.tipo });
  if (String(a.texto || "").trim() && a.textoOriginal === undefined) a.textoOriginal = a.texto;
  if (item.tipo === "anexo_rev") a.revogado = true;
  else { a.texto = String(item.novo || ""); a.revogado = false; }
  const fontes = [];
  hist.forEach((h) => { if (h.fonte && fontes.indexOf(h.fonte) < 0) fontes.push(h.fonte); });
  a.fonteAlteracao = fontes.join("; ");
  a.historico = hist;
  return lista;
}

/* =====================================================================
 * A NUMERAÇÃO DOS ARTIGOS TEM DE SER UMA SEQUÊNCIA
 *
 * É a prova dos nove do leitor: lida certa, a lei tem números que sobem de
 * um em um. Um número ISOLADO (o "Art. 16" de uma remissão), um SALTO (parte
 * do texto faltando ou artigo lido como texto) ou uma VOLTA (artigo colado
 * dentro de outro, texto repetido) quase sempre é o LEITOR errando, não a
 * lei. Isto só CRITICA — devolve os problemas para a tela mostrar; nunca
 * corrige. Lei legítima também salta (artigo vetado, ADCT que recomeça):
 * por isso cada problema tem gravidade, e só os graves abrem a conferência
 * sozinhos.
 *   isolado   grave    um número entre vizinhos que combinam entre si
 *   volta     grave    o número desce (fora do recomeço em 1 ou 2)
 *   salto     grave    faltam 3 ou mais números numa lei quase contínua;
 *                      leve se faltam 1 ou 2, ou se o texto é um RECORTE
 *   recomeco  leve     desce e recomeça em 1 ou 2 (ADCT, Anexos)
 *
 * RECORTE: quem cola só os artigos que interessam (1, 2, 3, 9, 11, 35, 115)
 * tem saltos de propósito. Quando os artigos presentes cobrem menos de 60%
 * do intervalo entre o primeiro e o último número, o texto é tratado como
 * recorte e os saltos viram avisos leves. Número isolado e volta continuam
 * graves em qualquer caso: esses são o sinal clássico de leitor errado.
 * ===================================================================== */
/* Os TRECHOS de uma lei: o corpo e cada ATO de topo (o ADCT). Cada trecho tem a sua numeração, que
 * recomeça no art. 1º — isso é esperado, e por isso a numeração é conferida trecho a trecho. */
function leiTrechosDaLei(artigos) {
  const trechos = [];
  (artigos || []).forEach((a) => {
    const ato = /^ATO\|/.test(a.divisaoId || "");
    const chave = ato ? String(a.divisaoId).split(">")[0] : "";
    const ult = trechos[trechos.length - 1];
    if (ult && ult.chave === chave) ult.artigos.push(a);
    else trechos.push({ chave, rotulo: ato ? String((a.caminho || [])[0] || "") : "", artigos: [a] });
  });
  return trechos;
}

function leiNumeracao(artigos) {
  const trechos = leiTrechosDaLei(artigos);
  if (trechos.length <= 1) return leiNumeracaoTrecho(artigos);
  const res = trechos.map((x) => leiNumeracaoTrecho(x.artigos));
  const problemas = [].concat.apply([], res.map((r) => r.problemas));
  return { problemas, graves: problemas.filter((x) => x.gravidade === "grave"), recorte: res.every((r) => r.recorte) };
}

function leiNumeracaoTrecho(artigos) {
  const A = artigos || [];
  const B = A.map((a) => Math.floor(a.ordem / 100));
  /* E: até onde cada item vai — um grupo revogado ("Arts. 12 a 15") cobre a faixa */
  const E = A.map((a, i) => (a.faixaFim && a.faixaFim >= B[i] ? a.faixaFim : B[i]));
  const distintos = {};
  B.forEach((b) => { distintos[b] = true; });
  const faixa = B.length ? Math.max.apply(null, B) - Math.min.apply(null, B) + 1 : 1;
  const recorte = Object.keys(distintos).length / faixa < 0.6;
  const isolado = {};
  for (let i = 1; i < A.length - 1; i++) {
    const vizinhos = B[i + 1] - B[i - 1];
    if (vizinhos >= 0 && vizinhos <= 3
        && Math.abs(B[i] - B[i - 1]) > 3 && Math.abs(B[i] - B[i + 1]) > 3) isolado[i] = true;
  }
  const problemas = [];
  let p = -1;
  A.forEach((a, i) => {
    if (isolado[i]) {
      problemas.push({ tipo: "isolado", gravidade: "grave", num: a.num, numCru: a.numCru,
        linha: a.linha, de: p >= 0 ? A[p].numCru : "", faltam: [], nFaltam: 0 });
      return;
    }
    if (p >= 0) {
      const d = B[i] - E[p];
      if (d >= 2) {
        const faltam = [];
        for (let x = E[p] + 1; x < B[i] && faltam.length < 8; x++) faltam.push(x);
        problemas.push({ tipo: "salto", gravidade: d - 1 >= 3 && !recorte ? "grave" : "leve", num: a.num,
          numCru: a.numCru, linha: a.linha, de: A[p].numCru, faltam, nFaltam: d - 1 });
      } else if (d < 0) {
        const recomeco = B[i] <= 2;
        problemas.push({ tipo: recomeco ? "recomeco" : "volta", gravidade: recomeco ? "leve" : "grave",
          num: a.num, numCru: a.numCru, linha: a.linha, de: A[p].numCru, faltam: [], nFaltam: 0 });
      }
    }
    p = i;
  });
  return { problemas, graves: problemas.filter((x) => x.gravidade === "grave"), recorte };
}

/* =====================================================================
 * MAPA E CONFERÊNCIA DA LEITURA — de uma lei que JÁ está guardada
 *
 * A conferência da colagem (leiPreprocessar, leiNumeracao) só roda na hora de criar ou
 * atualizar. A lei que entrou antes dela — ou que foi colada com o leitor de outra época — não
 * tinha como ser conferida: só o aviso "numeração fora de sequência", sem dizer onde nem por quê.
 * Isto lê o texto GUARDADO (nunca o reescreve) e devolve:
 *   estrutura  a árvore de divisões (leiEstruturaLei) e os artigos;
 *   resumo     quantos artigos, quantas divisões, de que número a que número;
 *   itens      o que conferir, na ordem do texto — cada um com a linha e o artigo:
 *     numeração          os problemas de leiNumeracao (isolado, volta, salto, recomeço);
 *     titulo_no_artigo   linha toda em maiúsculas dentro do artigo: é o cabeçalho de uma
 *                        divisão que o leitor não reconheceu ("SISTEMA TRIBUTÁRIO NACIONAL");
 *     sufixo_sem_base    "178-A" sem 178, com os vizinhos em sequência: o "Art. 178 - A isenção…";
 *     divisao_sem_nome   divisão cujo nome não veio.
 * ===================================================================== */
const LEI_RE_TITULO_SOLTO = /^[\s>*]*[A-ZÀ-Ú][A-ZÀ-Ú ,\-–—]{6,66}[A-ZÀ-Ú]\s*$/;

function leiDiagnosticarLei(texto, opc) {
  const est = leiEstruturaLei(texto, opc);
  const arts = est.artigos;
  const itens = [];
  const existe = {};
  const porLinha = {};
  arts.forEach((a) => { existe[a.num] = true; porLinha[a.linha] = a; });
  const daLinha = (linha) => {
    let ach = null;
    arts.forEach((a) => { if (a.linha <= linha && a.linhaFim >= linha) ach = a; });
    return ach;
  };

  arts.forEach((a, i) => {
    a.texto.split("\n").forEach((s, k) => {
      if (k === 0 || !s.trim() || !LEI_RE_TITULO_SOLTO.test(s) || leiLerRotulo(s.trim())) return;
      itens.push({ tipo: "titulo_no_artigo", gravidade: "aviso", num: a.num, numCru: a.numCru,
        indice: a.indice, linha: a.linha + k, linhaFim: a.linha + k, texto: s.trim().slice(0, 70) });
    });
    const m = a.num.match(/^(\d+)-([A-Z])$/);
    if (m && !existe[m[1]] && arts[i - 1] && arts[i + 1]
        && Math.floor(arts[i - 1].ordem / 100) === Number(m[1]) - 1
        && Math.floor(arts[i + 1].ordem / 100) === Number(m[1]) + 1) {
      itens.push({ tipo: "sufixo_sem_base", gravidade: "aviso", num: a.num, numCru: a.numCru,
        indice: a.indice, linha: a.linha, linhaFim: a.linhaFim, base: m[1] });
    }
  });

  Object.keys(est.nos).forEach((id) => {
    const d = est.nos[id];
    if (d.nome || d.tipo === "DISPOSICOES" || d.tipo === "PARTE" || d.tipo === "ATO") return;
    const prox = arts.filter((a) => a.linha > d.linha)[0] || null;
    itens.push({ tipo: "divisao_sem_nome", gravidade: "leve", rotulo: d.rotulo, nota: d.nota || "", divisaoId: d.id, num: prox ? prox.num : "",
      numCru: prox ? prox.numCru : "", indice: prox ? prox.indice : -1, linha: d.linha, linhaFim: d.linha });
  });

  /* LEI QUE ALTERA OUTRA (a EC 132/2023): os artigos que ela cita vêm soltos no meio dela — o 156-A e o 156-B
   * entre o 1º e o 2º —, então não há sequência a conferir. Sem isto, saíam "faltam 154 artigos depois do 1º"
   * e "a numeração recomeça", que não são defeito de nada. Não viram aviso — mas a pessoa pode querer ver: o que
   * a conferência normal apontaria vai em `numeracaoInfo`, sempre "leve", para a tela mostrar RECOLHIDO como
   * informação. */
  const alteradora = leiEhAlteradora(texto);
  const numReal = arts.length >= 8 ? leiNumeracao(arts) : { problemas: [], graves: [], recorte: false };
  const num = alteradora ? { problemas: [], graves: [], recorte: false } : numReal;
  const comIndice = (p) => {
    const a = porLinha[p.linha] || daLinha(p.linha);
    return Object.assign({}, p, { indice: a ? a.indice : -1, linhaFim: a ? a.linhaFim : p.linha });
  };
  num.problemas.forEach((p) => { itens.push(comIndice(p)); });
  const numeracaoInfo = alteradora ? numReal.problemas.map((p) => Object.assign(comIndice(p), { gravidade: "leve" })) : [];

  itens.sort((x, y) => x.linha - y.linha);
  /* o resumo fala do CORPO da lei e, à parte, de cada ATO de topo (ADCT): "1º a 250" e "1º a 138", e
   * não um "1º a 138" que mistura os dois */
  const trechos = leiTrechosDaLei(arts);
  const corpo = trechos.filter((x) => !x.chave)[0] || trechos[0] || null;
  const atos = trechos.filter((x) => x.chave).map((x) => ({ rotulo: x.rotulo, n: x.artigos.length,
    de: x.artigos[0].numCru, ate: x.artigos[x.artigos.length - 1].numCru }));
  const porTipo = {};
  Object.keys(est.nos).forEach((id) => { porTipo[est.nos[id].tipo] = (porTipo[est.nos[id].tipo] || 0) + 1; });
  return {
    estrutura: est,
    itens,
    ajustes: est.ajustes || [],
    alteradora,
    numeracaoInfo,
    numeracao: num,
    resumo: {
      artigos: arts.length,
      divisoes: Object.keys(est.nos).length,
      porTipo,
      de: corpo ? corpo.artigos[0].numCru : "",
      ate: corpo ? corpo.artigos[corpo.artigos.length - 1].numCru : "",
      atos,
      graves: itens.filter((x) => x.gravidade === "grave").length,
    },
  };
}

/* =====================================================================
 * COMPARAR A VERSÃO GRAVADA COM UMA NOVA — e ajudar a decidir
 *
 * Os tipos de erro que a comparação por número pode cometer, e o que a
 * cada um se faz (cada item leva a lista `alertas`, que a tela mostra ANTES
 * de a pessoa aceitar ou recusar):
 *   · "mudou" que é só formatação (aspas, travessão, º, espaço)  → não é
 *     listado; conta-se à parte (soFormatacao).
 *   · "mudou" que é só a nota de vigência ("Redação dada pela…")  → alerta
 *     informativo `so_anotacao`.
 *   · o texto novo é bem menor / quase outro artigo / traz "[...]" /
 *     é um número isolado fora da sequência                       → alerta.
 *   · "revogado" porque o artigo NÃO APARECEU no texto novo — o erro mais
 *     caro: numa colagem incompleta viram centenas. Só existe no modo
 *     "considerar a lei inteira" (ausentes = "revogar").
 * ===================================================================== */
function leiNormalizaComparacao(s) {
  return String(s == null ? "" : s)
    .replace(LEI_RE_INVISIVEIS, "")
    .replace(/ /g, " ")
    .replace(/[“”«»„]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/(\d)\s*[°ª]/g, "$1º")
    .replace(/§\s+(\d)/g, "§$1")
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ").trim();
}

/* Um número que está sozinho entre vizinhos distantes é remissão que virou
 * "artigo" (ver leiPreprocessar) ou lixo de OCR. Devolve { num: true }. */
function leiForaDaSequencia(artigos) {
  const fora = {};
  const A = artigos || [];
  A.forEach((a, i) => {
    if (i === 0 || i === A.length - 1) return;
    const d1 = Math.abs(a.ordem - A[i - 1].ordem);
    const d2 = Math.abs(a.ordem - A[i + 1].ordem);
    if (d1 > 500 && d2 > 500) fora[a.num] = true;
  });
  return fora;
}

function leiPareceAlteradora(texto) {
  const s = String(texto || "");
  const sinais = [];
  if ((s.match(/\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)/g) || []).length >= 2) sinais.push("omitidos");
  if ((s.match(/\(\s*(?:NR|AC)\s*\)/g) || []).length >= 3) sinais.push("nr_ac");
  if (/passa(?:m)?\s+a\s+vigorar\s+com\s+as?\s+seguintes?\s+(?:altera[çc][õo]es|reda[çc][ãa]o)/i.test(s)) {
    sinais.push("passa_a_vigorar");
  }
  if (/^\s*Altera\s+(?:a|o|as|os|dispositivos)\b/im.test(s.slice(0, 3000))) sinais.push("altera");
  /* "[...]", "(NR)"/"(AC)" e "passa a vigorar…" bastam sozinhos: lei consolidada
   * não os tem. "Altera a…" no título, sozinho, é menos: só conta com outro sinal */
  const forte = sinais.some((x) => x === "omitidos" || x === "nr_ac" || x === "passa_a_vigorar");
  return { sim: forte || sinais.length >= 2, sinais };
}

/* =====================================================================
 * AS CITAÇÕES: artigos de OUTRA lei, entre aspas, dentro de um artigo desta
 *
 * O Planalto traz, nas leis que alteram outras, o artigo que ALTERA e, logo abaixo, o texto novo do artigo
 * ALTERADO entre aspas:
 *
 *   Art. 496. A Lei nº 5.172, de 25 de outubro de 1966 - Código Tributário Nacional, passa a vigorar com as
 *   seguintes alterações:
 *   “Art. 9º ..................................        <- o artigo 9º do CTN, sem mudar o caput
 *   IV - cobrar impostos ... sobre:
 *   ...................................... ” (NR)       <- fecha; (NR) = nova redação, (AC) = acréscimo
 *
 * A LC 214/2025 tem 49 desses artigos e 88 citados. Tratados como texto da própria lei, eles viravam artigos
 * falsos (o 9º depois do 496º), cabeçalho repetido (o fechamento repetido 58 vezes), aspa "corrigida" e linha
 * "colada" na frase de cima. Aqui se acha CADA REGIÃO citada (da linha que abre com aspas até a que fecha) e o
 * artigo que altera e a lei-alvo dele. Só regiões FECHADAS contam: uma aspa que nunca fecha não engole o texto.
 * ===================================================================== */
const LEI_RE_ABRE_CITACAO = /^\s*[“"«]\s*Art(?:\.|igo)?\s*\d/i;
/* fecha com aspas, a marca (NR)/(AC)/(VETADO) e — no Planalto — notas editoriais depois dela: "” (NR)   (Vide Lei nº 227)" */
const LEI_RE_NOTA_DEPOIS = "(?:\\s*\\((?:Vide|Vig[êe]ncia|Regulamento|Produ[çc][ãa]o|Reda[çc][ãa]o|Inclu[ií]d|Revogad)[^)]*\\))*";
const LEI_RE_FECHA_CITACAO = new RegExp("[”\"»]\\s*(?:\\((?:NR|AC|VETADO)\\))?" + LEI_RE_NOTA_DEPOIS + "\\s*\\.?\\s*$");
const LEI_RE_INTRO_ALTERACAO = /^\s*Art(?:\.|igo)?\s*\d+[ºo°]?(?:-[A-Z]+)?\.?\s+(?:Os|As|O|A)\s+(.+?),?\s+passa(?:m)?\s+a\s+vigorar/i;
const LEI_RE_VIGENCIA_PROPRIA = /^\s*Art(?:\.|igo)?\s*\d+[ºo°]?(?:-[A-Z]+)?\.?\s+Esta\s+(?:Lei|Emenda|Medida)/i;

function leiContaAspas(s) {
  const c = (re) => (String(s).match(re) || []).length;
  return { o: c(/[“«]/g), c: c(/[”»]/g), r: c(/"/g) };
}

/* a linha FECHA uma citação? termina com aspas, e sobra uma aspa de fechar (não é "a" de uma alínea) */
function leiLinhaFechaCitacao(s) {
  if (!LEI_RE_FECHA_CITACAO.test(s)) return false;
  const q = leiContaAspas(s);
  return q.c > q.o || (q.c === q.o && q.r % 2 === 1);
}

/* a linha ABRE e FECHA a citação sozinha: “Art. 5º Texto.” (NR) */
function leiLinhaCitacaoInteira(s) {
  if (!LEI_RE_FECHA_CITACAO.test(s)) return false;
  const q = leiContaAspas(s);
  return (q.o > 0 && q.o === q.c) || (q.r >= 2 && q.r % 2 === 0);
}

function leiMarcaDoFecho(s) {
  const m = String(s).match(new RegExp("\\((NR|AC|VETADO)\\)" + LEI_RE_NOTA_DEPOIS + "\\s*\\.?\\s*$"));
  return m ? m[1] : "";
}

/* as regiões citadas FECHADAS: [{ ini, fim, marca }] com índices de linha 0-based */
function leiRegioesCitadas(linhas) {
  const regioes = [];
  let ini = -1;
  for (let i = 0; i < linhas.length; i++) {
    const s = linhas[i];
    if (ini < 0) {
      if (!LEI_RE_ABRE_CITACAO.test(s)) continue;
      if (leiLinhaCitacaoInteira(s)) regioes.push({ ini: i, fim: i, marca: leiMarcaDoFecho(s) });
      else ini = i;
      continue;
    }
    /* a citação que NUNCA fechou não engole o resto: uma nova alteração ou a vigência da própria lei a encerra */
    if (LEI_RE_INTRO_ALTERACAO.test(s) || LEI_RE_VIGENCIA_PROPRIA.test(s)) { ini = -1; continue; }
    if (leiLinhaFechaCitacao(s)) { regioes.push({ ini, fim: i, marca: leiMarcaDoFecho(s) }); ini = -1; }
  }
  return regioes;
}

/* "Lei nº 5.172, de 25 de outubro de 1966 - Código Tributário Nacional" => { curto, nome } */
function leiAlvoDaAlteracao(bruto) {
  const s = String(bruto || "").replace(/\s+/g, " ").replace(/\s*[:;]\s*$/, "").trim();
  const nome = (s.match(/\s[-–—]\s+([^,;]+?)\s*$/) || [])[1] || "";
  const m = s.match(/(Lei Complementar|Lei|Decreto-Lei|Decreto Legislativo|Decreto|Medida Provisória|Emenda Constitucional)\s+n[ºo°.]*\s*([\d.]+(?:-\d+)?)/i);
  if (m) {
    const ano = (s.slice(m.index + m[0].length).match(/(\d{4})/) || [])[1] || "";
    return { bruto: s.slice(0, 140), nome, curto: m[1] + " nº " + m[2] + (ano ? "/" + ano : "") };
  }
  if (/Ato das Disposi[çc][õo]es Constitucionais Transit[óo]rias/i.test(s)) return { bruto: s.slice(0, 140), nome: "", curto: "ADCT" };
  if (/Constitui[çc][ãa]o Federal/i.test(s)) return { bruto: s.slice(0, 140), nome: "", curto: "Constituição Federal" };
  return { bruto: s.slice(0, 140), nome, curto: s.slice(0, 70) };
}

/* Os BLOCOS DE ALTERAÇÃO de um texto: cada artigo próprio que "passa a vigorar com as seguintes alterações"
 * e as regiões citadas dele. `rec` = { "citacao:<linha>": true } são os que a pessoa mandou tratar como texto
 * comum (não entram em `citadas`).
 *   blocos: [{ id, linha, rotulo, alvo, trechos:[{ ini, fim, marca, artigos:[{ linha, num, numCru, semMudanca }] }],
 *             fim, n, recusado }]      (linha, ini, fim: 1-based)
 *   citadas: Set das linhas (1-based) que estão dentro de uma citação */
function leiLerCitacoes(linhas, rec) {
  rec = rec || {};
  const regioes = leiRegioesCitadas(linhas);
  const dentro = {};
  regioes.forEach((r) => { for (let k = r.ini; k <= r.fim; k++) dentro[k] = true; });
  const eventos = [];
  regioes.forEach((r) => eventos.push({ i: r.ini, tipo: "regiao", r }));
  linhas.forEach((s, i) => {
    if (dentro[i]) return;
    if (LEI_RE_INTRO_ALTERACAO.test(s)) eventos.push({ i, tipo: "intro", s });
    else if (leiCasarArtigo(s) && !LEI_RE_ABRE_CITACAO.test(s)) eventos.push({ i, tipo: "corte" });
  });
  eventos.sort((a, b) => a.i - b.i);
  const blocos = [];
  let atual = null;
  const rotuloDe = (s) => (String(s).match(/^\s*(Art(?:\.|igo)?\s*\d+[ºo°]?(?:-[A-Z]+)?)/i) || ["", "Art."])[1].replace(/^Artigo/i, "Art.");
  eventos.forEach((ev) => {
    if (ev.tipo === "intro") {
      const g = ev.s.match(LEI_RE_INTRO_ALTERACAO);
      atual = { id: "citacao:" + (ev.i + 1), linha: ev.i + 1, rotulo: rotuloDe(ev.s), alvo: leiAlvoDaAlteracao(g[1]), trechos: [], fim: ev.i + 1, n: 0, recusado: !!rec["citacao:" + (ev.i + 1)] };
      blocos.push(atual);
    } else if (ev.tipo === "corte") {
      atual = null;
    } else {
      if (!atual) {
        atual = { id: "citacao:o" + (ev.r.ini + 1), linha: ev.r.ini + 1, rotulo: "", alvo: null, trechos: [], fim: ev.r.fim + 1, n: 0, recusado: false };
        atual.recusado = !!rec[atual.id];
        blocos.push(atual);
      }
      const artigos = [];
      for (let k = ev.r.ini; k <= ev.r.fim; k++) {
        const a = String(linhas[k]).match(/^\s*[“"«]?\s*Art(?:\.|igo)?\s*(\d+[ºo°]?(?:\s*-\s*[A-Z]+)?)\.?\s*(.*)$/i);
        if (a) artigos.push({ linha: k + 1, num: leiNumNormal(a[1]), numCru: leiNumCruLimpo(a[1]), semMudanca: /^\.{5,}\s*(?:[”"»]\s*(?:\((?:NR|AC)\))?)?\s*$/.test(a[2]) });
      }
      atual.trechos.push({ ini: ev.r.ini + 1, fim: ev.r.fim + 1, marca: ev.r.marca, artigos });
      atual.fim = ev.r.fim + 1;
      atual.n += artigos.length;
    }
  });
  const citadas = new Set();
  blocos.forEach((b) => { if (!b.recusado) b.trechos.forEach((t) => { for (let k = t.ini; k <= t.fim; k++) citadas.add(k); }); });
  return { blocos, citadas, regioes };
}

/* A PARCELA DO TEXTO (0 a 1) que está dentro de artigos CITADOS entre aspas (regiões fechadas). */
function leiParcelaCitada(texto) {
  const linhas = String(texto || "").split("\n");
  const regioes = leiRegioesCitadas(linhas);
  let citado = 0, total = 0;
  linhas.forEach((s) => { total += s.length + 1; });
  regioes.forEach((r) => { for (let k = r.ini; k <= r.fim; k++) citado += linhas[k].length + 1; });
  return total ? citado / total : 0;
}

/* A lei É, no essencial, uma alteração de outra? Dois sinais que vêm de quem estuda:
 *  1. é uma EMENDA CONSTITUCIONAL — pela própria espécie, ela existe para alterar a Constituição;
 *  2. é uma lei em que a MAIORIA dos artigos é de alteração de outra lei (a LC 95/2022 de Caruaru).
 * A EC 132/2023 é (60% do texto são artigos citados da CF): a numeração e os parágrafos repetidos dela não
 * fazem sentido. A LC 214/2025 NÃO é: só 8% do texto são 43 artigos que alteram outras leis, no meio de 544
 * artigos dela — e a numeração dela vale. Fora a emenda, só o texto que "parece alteradora" E onde qualquer
 * destes é grande: a parte citada entre aspas (30%), a fração de artigos que dizem "passa a vigorar…" (a
 * maioria: 50%) ou a densidade das marcas (NR)/(AC): 0,3 por artigo E 0,2 por KB, as duas juntas. As marcas
 * NÃO dependem das aspas — a limpeza da colagem (grafia) as tira, e uma emenda salva sem aspas continua sendo
 * emenda. Medido nos textos oficiais, sem as aspas: EC 132 = 0,48 por artigo e 0,38 por KB; LC 214 = 0,12 por
 * artigo e 0,09 por KB. */
function leiEhAlteradora(texto) {
  const ident = leiIdentificar(texto);
  if (ident && ident.especie === "Emenda Constitucional") return true;
  if (!leiPareceAlteradora(texto).sim) return false;
  if (leiParcelaCitada(texto) >= 0.3) return true;
  const arts = leiArtigos(texto);
  if (!arts.length) return false;
  const intros = arts.filter((a) => /passa(?:m)?\s+a\s+vigorar|ficam?\s+acrescid|ficam?\s+revogad/i.test(String(a.texto).slice(0, 300))).length;
  const marcas = (String(texto || "").match(/\(\s*(?:NR|AC)\s*\)/g) || []).length;
  const kb = String(texto || "").length / 1000;
  return intros / arts.length >= 0.5 || (marcas / arts.length >= 0.3 && marcas / kb >= 0.2);
}

function leiConfereIdentidade(l, texto) {
  const novo = leiIdentificar(texto);
  if (!novo || !l || !l.numero) return { conflito: false, novo };
  const num = (x) => String(x || "").replace(/[.\s]/g, "").replace(/^0+/, "");
  const esp = (x) => String(x || "").toLowerCase().replace(/\s+/g, " ").trim();
  const conflito = num(l.numero) !== num(novo.numero)
    || (l.ano && novo.ano && String(l.ano) !== String(novo.ano))
    || (l.especie && novo.especie && esp(l.especie) !== esp(novo.especie));
  return { conflito: !!conflito, novo };
}

function leiCoberturaDaAtualizacao(antigos, novos) {
  const nn = {};
  (novos || []).forEach((a) => { nn[a.num] = true; });
  const todos = {};
  (antigos || []).forEach((a) => { todos[a.num] = a; });
  const nums = Object.keys(todos);
  const ausentes = nums.filter((k) => !nn[k]);
  return { total: nums.length, presentes: nums.length - ausentes.length, ausentes,
    pct: nums.length ? (nums.length - ausentes.length) / nums.length : 1 };
}

/* Os alertas de UM item da comparação. Cada um: { k, sev } com k = o sufixo
 * da chave de texto (lei_upd_al_<k>) e args para o texto. */
function leiAlertasDaMudanca(item, ctx) {
  const c = ctx || {};
  const al = [];
  const semNota = (s) => leiNormalizaComparacao(String(s || "").replace(/\([^)]*\)/g, ""));
  const palavras = (s) => leiNormalizaComparacao(s).toLowerCase().split(/[^a-zà-ú0-9]+/i).filter(Boolean);
  if (item.tipo === "mudou") {
    if (semNota(item.antigo) === semNota(item.novo)) al.push({ k: "so_anotacao", sev: "info" });
    if (/\[\s*(?:\.{3}|…)\s*\]|\(\s*(?:\.{3}|…)\s*\)/.test(item.novo)) al.push({ k: "omitido", sev: "alerta" });
    const a = leiNormalizaComparacao(item.antigo).length, b = leiNormalizaComparacao(item.novo).length;
    if (a > 80 && b < a * 0.6) al.push({ k: "menor", sev: "alerta", pct: Math.round(b / a * 100) });
    const pa = palavras(item.antigo), pb = new Set(palavras(item.novo));
    if (pa.length >= 8) {
      const comuns = pa.filter((w) => pb.has(w)).length;
      const jac = comuns / (pa.length + pb.size - comuns);
      if (jac < 0.35) al.push({ k: "outro", sev: "alerta", pct: Math.round(jac * 100) });
    }
    const nums = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) || []);
    const na = nums(item.antigo).filter((x) => nums(item.novo).indexOf(x) < 0);
    const nb = nums(item.novo).filter((x) => nums(item.antigo).indexOf(x) < 0);
    if (na.length || nb.length) {
      al.push({ k: na.length && nb.length ? "numeros" : (nb.length ? "numeros_novos" : "numeros_removidos"),
        sev: "info", de: na.slice(0, 4).join(", "), para: nb.slice(0, 4).join(", ") });
    }
    if (/^\s*Art[^\n(]{0,20}\(\s*revogad/i.test(String(item.novo).replace(/\s+/g, " "))) {
      al.push({ k: "revogado_no_texto", sev: "info" });
    }
  }
  if (item.tipo === "novo" && c.fora && c.fora[item.num]) al.push({ k: "fora_sequencia", sev: "alerta" });
  if (item.tipo === "revogado") {
    al.push({ k: "ausente", sev: "aviso" });
    if (c.cobertura && c.cobertura.pct < 0.9) al.push({ k: "ausente_incompleto", sev: "alerta", pct: Math.round(c.cobertura.pct * 100) });
  }
  return al;
}

/* A comparação em si, sem tela. opc.ausentes: "revogar" (padrão: o que não
 * aparece no texto novo vira "possivelmente revogado") | "presentes" (só os
 * artigos que estão nos dois textos são comparados). opc.ignorar: números
 * que se repetem DE VERDADE na lei gravada (corpo e ADCT), que a comparação
 * por número não sabe alinhar. */
function leiCompararVersoes(textoAntigo, textoNovo, opc) {
  const o = opc || {};
  const modo = o.ausentes === "presentes" ? "presentes" : "revogar";
  const ign = {};
  (o.ignorar || []).forEach((n) => { ign[leiNumNormal(n)] = true; });
  const antigos = leiArtigos(textoAntigo);
  const novos = leiArtigos(textoNovo);
  const porNumAntigo = {}, porNumNovo = {};
  antigos.forEach((a) => { porNumAntigo[a.num] = a; });
  novos.forEach((a) => { porNumNovo[a.num] = a; });
  const cobertura = leiCoberturaDaAtualizacao(antigos, novos);
  const fora = leiForaDaSequencia(novos);
  const itens = [];
  const soFormatacao = [];
  const naoComparados = [];
  Object.keys(porNumNovo).forEach((num) => {
    if (ign[num]) { naoComparados.push(num); return; }
    const a = porNumAntigo[num], b = porNumNovo[num];
    if (!a) itens.push({ num, numCru: b.numCru, tipo: "novo", antigo: "", novo: b.texto, aceito: false, recusado: false });
    else if (a.texto.replace(/\s+/g, " ").trim() !== b.texto.replace(/\s+/g, " ").trim()) {
      if (leiNormalizaComparacao(a.texto) === leiNormalizaComparacao(b.texto)) soFormatacao.push(num);
      else itens.push({ num, numCru: b.numCru, tipo: "mudou", antigo: a.texto, novo: b.texto, aceito: false, recusado: false });
    }
  });
  if (modo === "revogar") {
    Object.keys(porNumAntigo).forEach((num) => {
      if (ign[num]) { if (naoComparados.indexOf(num) < 0) naoComparados.push(num); return; }
      if (!porNumNovo[num]) {
        itens.push({ num, numCru: porNumAntigo[num].numCru, tipo: "revogado",
          antigo: porNumAntigo[num].texto, novo: "", aceito: false, recusado: false });
      }
    });
  }
  itens.sort((x, y) => leiNumOrdem(x.num) - leiNumOrdem(y.num));
  itens.forEach((it) => { it.alertas = leiAlertasDaMudanca(it, { fora, cobertura }); });
  return { itens, soFormatacao, naoComparados, cobertura };
}

/* =====================================================================
 * A LEI VIGENTE: TEXTO-BASE + ALTERAÇÕES POR CIMA
 *
 * `l.texto` (a "camada base") é o que foi colado, e nunca é reescrito por
 * uma emenda — fica intacto para sempre poder mostrar a redação
 * original. Toda alteração de artigo depois da criação da lei — edição
 * manual de um artigo ou a comparação de uma versão nova colada (ver
 * leiArtigoAlterar e o fluxo de dlgLeiAtualizar em lei-ui.js) — grava só
 * em `l.alteracoes`, um mapa {numArtigo: {texto, fonteAlteracao, data,
 * revogado?}}: a "camada de leitura e edição".
 *
 * Esta função funde as duas na hora de EXIBIR, sem tocar em nenhuma — é o
 * que se lê é sempre o texto vigente, e o que fica gravado nunca perde a
 * redação original.
 *
 * LIMITE CONHECIDO: a alteração é indexada só pelo NÚMERO do artigo, não
 * pela ocorrência. Na Constituição, corpo e ADCT repetem os mesmos
 * números — uma alteração no "art. 5º" cairia nos dois. Emenda não costuma
 * mexer no ADCT pelo número baixo do corpo, e resolver isso pediria uma
 * chave composta que este primeiro corte não vale a pena pagar.
 * ===================================================================== */
function leiArtigosEfetivos(l) {
  const base = leiArtigos(l && l.texto, leiOpcDaLei(l));
  const alt = (l && l.alteracoes) || {};
  const achados = {};

  const efetivos = base.map((a) => {
    const ov = alt[a.num];
    if (!ov) return a;
    achados[a.num] = true;
    if (ov.revogado) {
      return Object.assign({}, a, { revogado: true, fonteAlteracao: ov.fonteAlteracao || "" });
    }
    const novoTxt = String(ov.texto || "");
    const lido = leiArtigos(novoTxt)[0];
    return Object.assign({}, a, {
      texto: novoTxt,
      corpo: lido ? lido.corpo : a.corpo,
      ementa: lido ? lido.ementa : a.ementa,
      alterado: true,
      fonteAlteracao: ov.fonteAlteracao || "",
      textoOriginal: a.texto,
    });
  });

  /* artigos que só existem na camada de alteração (acrescentados por
   * emenda, ex. "150-A") entram ao lado do vizinho de número mais baixo,
   * pela mesma ordenação que leiNumOrdem já usa para o resto da lei */
  const novos = Object.keys(alt)
    .filter((num) => !achados[num] && !alt[num].revogado && String(alt[num].texto || "").trim())
    .map((num) => {
      const lido = leiArtigos(alt[num].texto)[0];
      return {
        num, numCru: (lido && lido.numCru) || num,
        ordem: leiNumOrdem(num),
        indice: -1,
        linha: 0, linhaFim: 0,
        rotulo: "Art. " + ((lido && lido.numCru) || num),
        ementa: lido ? lido.ementa : "",
        texto: alt[num].texto,
        corpo: lido ? lido.corpo : alt[num].texto,
        divisao: "", divisaoTipo: "",
        alterado: true, novo: true,
        fonteAlteracao: alt[num].fonteAlteracao || "",
      };
    })
    .sort((x, y) => x.ordem - y.ordem);

  if (!novos.length) return efetivos;

  /* NÃO SE REORDENA A LISTA INTEIRA por ordem — a Constituição repete
   * número entre corpo e ADCT, e dois artigos de MESMO "ordem" existem
   * de propósito em posições diferentes do documento; um sort global
   * reagruparia os dois "art. 1º" lado a lado, e o resto de lei-ui.js
   * (ids, "onde parei") depende dessa posição real para desambiguar. Só
   * os artigos NOVOS precisam achar seu lugar — inserção pontual, sem
   * tocar a ordem relativa do que já estava certo. */
  const resultado = efetivos.slice();
  novos.forEach((novo) => {
    let pos = resultado.length;
    for (let i = 0; i < resultado.length; i++) {
      if (resultado[i].ordem > novo.ordem) { pos = i; break; }
    }
    resultado.splice(pos, 0, novo);
  });
  return resultado;
}

/* Grava (ou apaga) UMA entrada da camada de alteração — nunca mexe na
 * base. `dados` é {texto, fonteAlteracao, revogado?}; `dados` nulo apaga
 * a entrada e devolve o artigo à redação original. */
function leiArtigoAlterar(idLei, num, dados) {
  const l = leiDe(idLei);
  if (!l) return false;
  const alvo = leiNumNormal(num);
  const alt = Object.assign({}, l.alteracoes || {});
  if (!dados) {
    delete alt[alvo];
  } else {
    alt[alvo] = {
      texto: dados.revogado ? "" : String(dados.texto || ""),
      fonteAlteracao: String(dados.fonteAlteracao || ""),
      data: leisHojeISO(),
      revogado: !!dados.revogado,
    };
  }
  const ok = leiGuardar({ id: idLei, alteracoes: alt });
  if (ok) {
    try {
      reg("LEI", dados ? (dados.revogado ? "artigo revogado" : "artigo alterado")
                        : "alteração de artigo desfeita",
          (l.nome || idLei) + " · art. " + num
          + (dados && dados.fonteAlteracao ? " · " + dados.fonteAlteracao : ""));
    } catch (e) {}
  }
  return !!ok;
}

/* BLOCOS DE LEITURA.
 * A Lei 4.320 tem 115 artigos. "Li a lei" é uma pergunta que não se
 * responde com sim ou não, e um botão único de "li" transforma três
 * sessões de estudo numa marca só — ou, pior, em nenhuma, porque nunca
 * se termina.
 *
 * O corte natural é o capítulo, porque é o corte que a própria lei fez.
 * Quando a lei não tem divisão nenhuma (decreto curto, artigo único),
 * cai-se em blocos de tamanho fixo — melhor um corte arbitrário que um
 * bloco de 115 artigos. */
const LEI_ART_POR_BLOCO = 15;

function leiBlocos(texto, opc) {
  const arts = leiArtigos(texto, opc);
  if (!arts.length) return [];

  const temDivisao = arts.some((a) => a.divisao);
  const blocos = [];

  if (temDivisao) {
    arts.forEach((a) => {
      const ult = blocos[blocos.length - 1];
      if (ult && ult.divisaoId === (a.divisaoId || "")) ult.artigos.push(a);
      else blocos.push({ nome: a.divisao || "(sem divisão)", divisaoId: a.divisaoId || "",
        caminho: a.caminho || [], tipo: a.divisaoTipo || "", artigos: [a] });
    });
    /* Capítulo com dois artigos ao lado de um com quarenta é uma lista
     * inútil para planejar. Blocos muito grandes são partidos; muito
     * pequenos ficam como estão (são realmente curtos, e dizer isso é
     * informação boa: "este capítulo tem 2 artigos" convida a ler). */
    const partidos = [];
    blocos.forEach((b) => {
      if (b.artigos.length <= LEI_ART_POR_BLOCO * 1.6) { partidos.push(b); return; }
      const partes = Math.ceil(b.artigos.length / LEI_ART_POR_BLOCO);
      const tam = Math.ceil(b.artigos.length / partes);
      for (let i = 0; i < partes; i++) {
        partidos.push({
          nome: b.nome + " (" + (i + 1) + "/" + partes + ")",
          divisaoId: b.divisaoId, caminho: b.caminho, parte: (i + 1) + "/" + partes,
          tipo: b.tipo,
          artigos: b.artigos.slice(i * tam, (i + 1) * tam),
        });
      }
    });
    blocos.length = 0;
    partidos.forEach((p) => blocos.push(p));
  } else {
    for (let i = 0; i < arts.length; i += LEI_ART_POR_BLOCO) {
      const pedaco = arts.slice(i, i + LEI_ART_POR_BLOCO);
      blocos.push({
        nome: "Arts. " + pedaco[0].numCru + " a "
              + pedaco[pedaco.length - 1].numCru,
        chave: "arts:" + pedaco[0].numCru + "-" + pedaco[pedaco.length - 1].numCru,
        caminho: [],
        tipo: "",
        artigos: pedaco,
      });
    }
  }

  return blocos.map((b, i) => ({
    id: "b" + i,
    nome: b.nome,
    /* a CHAVE é o que se grava em l.blocos: estável e única (ver leiMigrarBlocos) */
    chave: b.chave || ("d:" + (b.divisaoId || "-") + (b.parte ? "|" + b.parte : "")),
    divisaoId: b.divisaoId || "",
    caminho: b.caminho || [],
    tipo: b.tipo,
    indice: i,
    de: b.artigos[0].num,
    ate: b.artigos[b.artigos.length - 1].num,
    quantos: b.artigos.length,
    artigos: b.artigos,
    /* 150 palavras por minuto é leitura corrida; lei seca não se lê
     * corrida, então metade disso. O número serve para dizer "este
     * capítulo é meia hora", que é o que decide se cabe hoje. */
    minutos: Math.max(3, Math.round(
      b.artigos.reduce((s, a) => s + (a.texto.match(/\S+/g) || []).length, 0) / 75)),
  }));
}

/* CAPÍTULO LIDO: A CHAVE É O ID DO BLOCO, NÃO O NOME.
 *
 * Até a 16.42 `l.blocos` guardava a data pela NOME do capítulo. No CTN há vários "CAPÍTULO I —
 * Disposições Gerais": marcar um marcava todos. Agora a chave é `b.chave` (o id da divisão, com
 * "|1/2" nos blocos partidos). Esta função traduz o que já estava gravado: cada nome antigo vira a
 * chave de TODO bloco que tinha aquele nome — o que a pessoa via marcado continua marcado, e daí
 * em diante cada capítulo se marca sozinho. Nome que não existe mais no texto fica como está. */
function leiMigrarBlocos(l) {
  const antigo = (l && l.blocos) || {};
  const novo = Object.assign({}, antigo);
  let mudou = false;
  const casaram = {};
  leiBlocos((l && l.texto) || "", leiOpcDaLei(l)).forEach((b) => {
    if (b.nome === b.chave || antigo[b.nome] === undefined) return;
    casaram[b.nome] = true;
    if (novo[b.chave] === undefined) { novo[b.chave] = antigo[b.nome]; mudou = true; }
  });
  Object.keys(casaram).forEach((k) => { delete novo[k]; mudou = true; });
  return { blocos: novo, mudou };
}

function leisMigrarBlocosDe(id) {
  const l = leiDe(id);
  if (!l || !l.texto) return false;
  const m = leiMigrarBlocos(l);
  if (!m.mudou) return false;
  leiGuardar({ id, blocos: m.blocos });
  return true;
}

/* ---------------------------------------------------------------------
 * MEXER NUM ARTIGO SEM MEXER NA LEI
 *
 * Lei muda. Uma emenda troca a redação de um artigo, outra acrescenta um
 * artigo no meio. Até aqui, a única forma de acompanhar isso era abrir a
 * lei inteira num campo de texto e caçar a linha certa entre centenas —
 * com o risco, a cada vez, de apagar sem querer o artigo vizinho ou uma
 * marca colorida que estava três parágrafos acima.
 *
 * Estas duas funções trabalham por ENDEREÇO, não por rolagem: sabem
 * exatamente onde o artigo começa e termina, e devolvem o texto inteiro
 * com só aquele pedaço trocado. Tudo o mais — marcas, artigos vizinhos,
 * cabeçalhos de capítulo — fica byte por byte como estava.
 * ------------------------------------------------------------------ */

function leiSubstituirArtigo(texto, num, novo) {
  const alvo = leiNumNormal(num);
  const arts = leiArtigos(texto);
  const a = arts.filter((x) => x.num === alvo)[0];
  if (!a) return null;
  const linhas = String(texto || "").split("\n");
  const corpo = String(novo || "").replace(/\s+$/, "").split("\n");
  linhas.splice(a.linha - 1, a.linhaFim - a.linha + 1, ...corpo);
  return linhas.join("\n");
}

/* ACRESCENTAR NO LUGAR CERTO.
 * O art. 12-A entra depois do 12 e antes do 13 — colar no fim do arquivo
 * daria uma lei em que o artigo novo aparece depois do "entra em vigor",
 * e o modo recitar leria a lei fora de ordem. Aqui o lugar é calculado
 * pela numeração, e o artigo entra logo abaixo do antecessor. */
function leiInserirArtigo(texto, novo) {
  const cru = String(novo || "").replace(/\s+$/, "");
  const primeiro = leiArtigos(cru)[0];
  if (!primeiro) return null;             /* não começa com "Art. N" */
  const arts = leiArtigos(texto);
  if (arts.some((x) => x.num === primeiro.num)) return null;   /* já existe */

  const linhas = String(texto || "").split("\n");
  const anterior = arts.filter((x) => x.ordem < primeiro.ordem).pop();
  const corpo = cru.split("\n");
  if (!anterior) {
    /* antes de todos: entra acima do primeiro artigo, preservando o
     * preâmbulo e a ementa da lei que vêm antes dele */
    const pos = arts.length ? arts[0].linha - 1 : linhas.length;
    linhas.splice(pos, 0, ...corpo, "");
  } else {
    linhas.splice(anterior.linhaFim, 0, "", ...corpo);
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n");
}

/* CITAÇÃO DE ARTIGO DENTRO DE OUTRO TEXTO.
 * Serve para ligar questão ↔ artigo: a questão diz "nos termos do art.
 * 167, IV, da CF", e é isso que permite responder "o art. 167 apareceu
 * em três questões suas, você errou duas".
 *
 * Aqui a regra é diferente da de cabeçalho: a citação vem no meio da
 * frase, não no começo da linha, e costuma trazer inciso e parágrafo
 * junto. Guardamos o inciso, mas a contagem é por ARTIGO — a banca
 * troca o inciso e mantém o artigo o tempo todo. */
const LEI_RE_CITACAO =
  /\bart(?:\.|igos?|s\.)?\s*(\d{1,4}(?:\s*[ºo°ª])?(?:\s*[-–]\s*[A-Z])?)/gi;

function leiCitacoes(texto) {
  const achados = [];
  const vistos = {};
  leiCitacoesNoTexto(texto).forEach((c) => {
    if (!vistos[c.num]) {
      vistos[c.num] = { num: c.num, ordem: leiNumOrdem(c.num), incisos: [], paragrafos: [], vezes: 0 };
      achados.push(vistos[c.num]);
    }
    const v = vistos[c.num];
    v.vezes++;
    c.incisos.forEach((x) => { if (v.incisos.indexOf(x) < 0) v.incisos.push(x); });
    c.paragrafos.forEach((x) => { if (v.paragrafos.indexOf(x) < 0) v.paragrafos.push(x); });
  });
  return achados;
}

/* =====================================================================
 * A CITAÇÃO QUE SABE DE QUAL LEI ESTÁ FALANDO
 *
 * O DEFEITO QUE ISTO CONSERTA. O botão "⚖ consultar a lei" abria a
 * PRIMEIRA lei ligada ao tópico. Num tópico servido por duas — despesa
 * pública é a 4.320 E a LRF — o comentário citava uma e o app abria a
 * outra, calado. Quem lia acreditava estar conferindo o artigo certo.
 *
 * leiCitacoes (acima) conta artigos para o ranking e não precisa saber
 * de que lei eles são: a banca troca o inciso e mantém o artigo. Aqui a
 * pergunta é outra — "para ONDE este link leva?" — e a lei passa a ser
 * a metade que importa.
 *
 * DEVOLVE POSIÇÕES, NÃO HTML. {ini, fim} são deslocamentos no texto
 * original, para quem desenha montar o comentário com textContent e
 * nunca passar texto de questão por innerHTML. Um comentário vem de
 * IA ou de colagem; é conteúdo de fora.
 * ===================================================================== */

function leiTxtChave(x) {
  return String(x || "").toLowerCase().normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\s+/g, " ").trim();
}

function leiEspecieChave(e) {
  const s = leiTxtChave(e);
  if (/complementar/.test(s)) return "lc";
  if (/decreto[\s-]?lei/.test(s)) return "decreto-lei";
  if (/emenda/.test(s)) return "ec";
  if (/decreto/.test(s)) return "decreto";
  if (/constitui/.test(s)) return "constituicao";
  if (/\blei\b/.test(s)) return "lei";
  return "";
}

/* O ENDEREÇO INTERNO, engolido um pedaço de cada vez.
 *
 * Entre o artigo e o nome da lei quase sempre há inciso, parágrafo e
 * alínea: "art. 156-A, § 1º, IV, da CF/88". Sem atravessar isso, o
 * rótulo da lei nunca é alcançado e a citação vira um link para lugar
 * nenhum. É um laço, e não um regex único, porque regex com quantificador
 * aninhado sobre texto livre é como se escreve um travamento sem querer.
 *
 * A ALÍNEA NUA É O CASO PERIGOSO. Concurso escreve "art. 150, VI, a, da
 * CF" sem parêntese, e aceitar "vírgula + letra" engoliria o ", o" de
 * "art. 20, o prazo é de 30 dias" — o link passaria a cobrir palavra de
 * português. O que separa os dois é o que vem DEPOIS: alínea é seguida de
 * vírgula, ponto ou parêntese; artigo definido é seguido de outra
 * palavra. Daí a espiada à frente, e as duas asserções que a guardam. */
const LEI_SUB = [
  /^\s*,?\s*inc(?:isos?)?\.?\s*[IVXLC]{1,6}(?![\wº])/i,
  /^\s*,?\s*[IVXLC]{1,6}(?![\wº])/,          /* maiúsculo de propósito */
  /^\s*,?\s*§+\s*\d{1,3}\s*[ºo°]?(?:\s*-\s*[A-Z])?/,
  /^\s*,?\s*par[áa]grafo\s+[úu]nico/i,
  /* "PARÁGRAFO 4" POR EXTENSO — o símbolo § já tinha padrão próprio (duas
   * linhas acima); faltava a mesma coisa escrita por extenso, do jeito
   * que uma IA (ou uma pessoa) digita sem querer procurar o símbolo. Foi
   * exatamente isso que quebrou "art. 60, parágrafo 4, IV, da CF": o
   * laço parava em "60" sem conseguir atravessar "parágrafo 4", e "da
   * CF" nunca era alcançado — a citação virava "ambígua" apesar de a lei
   * estar escrita ali do lado. */
  /^\s*,?\s*par[áa]grafo\s+\d{1,3}\s*[ºo°]?(?:\s*-\s*[A-Z])?/i,
  /^\s*,?\s*(?:al[íi]nea\s*)?[a-z]\)/i,
  /^\s*,?\s*["'“”][a-z]["'“”]/i,
  /^\s*,\s*[a-k](?=\s*[,;.)]|\s*$)/,         /* alínea sem parêntese */
  /^\s*,?\s*caput/i,
];

/* OS RÓTULOS DE LEI, do mais específico para o mais geral.
 * A ordem é a regra: "Lei Complementar 101" tem de ser testado antes de
 * "Lei", e a sigla solta por último — ela é a mais faminta das dez e só
 * vira link se casar com um apelido guardado. */
const LEI_ROTULOS = [
  /^constitui[çc][ãa]o(?:\s+federal)?(?:\s+de\s+\d{4})?/i,
  /^(?:CF|CRFB)\s*\/?\s*(?:88|1988)?(?![\wº])/,
  /^lei\s+complementar\s*n?[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?/i,
  /^LC\s*n?[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?/,
  /^decreto[\s-]?lei\s*n?[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?/i,
  /^emenda\s+constitucional\s*n?[ºo°]?\.?\s*\d{1,4}(?:\s*\/\s*\d{2,4})?/i,
  /^EC\s*n?[ºo°]?\.?\s*\d{1,4}(?:\s*\/\s*\d{2,4})?/,
  /^lei\s*n?[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?/i,
  /^decreto\s*n?[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?/i,
  /^[A-Z]{3,6}(?![\wº])/,                    /* CTN, CLT, CDC, CPC */
];

/* A LEI ÀS VEZES VEM ANTES: "LC 101/2000, art. 1º".
 * Só conta se o rótulo TERMINAR onde o artigo começa — senão "Segundo a
 * doutrina, o art. 5º" acharia lei em "doutrina". */
function leiRotuloAntes(cauda) {
  const t = String(cauda || "").replace(/[\s,;:.—–-]+$/, "");
  if (!t) return "";
  for (let i = 0; i < LEI_ROTULOS.length; i++) {
    const base = LEI_ROTULOS[i];
    const g = new RegExp(base.source.replace(/^\^/, ""),
      base.flags.indexOf("i") >= 0 ? "gi" : "g");
    let m, achado = "";
    while ((m = g.exec(t)) !== null) {
      if (m.index + m[0].length === t.length) achado = m[0];
      if (m.index === g.lastIndex) g.lastIndex++;   /* casamento vazio */
    }
    if (achado) return achado;
  }
  return "";
}

/* O ENDEREÇO DENTRO DO ARTIGO, lido do trecho que a citação engoliu:
 * ", IV" → inciso IV; "§ 2º" → parágrafo 2º; ", b)" → alínea b. */
function leiLerSubEndereco(pedaco, sub) {
  const p = String(pedaco);
  let m;
  if ((m = p.match(/inc(?:isos?)?\.?\s*([IVXLC]{1,6})/i))) sub.incisos.push(m[1].toUpperCase());
  else if ((m = p.match(/^\s*(?:,|e|ou)?\s*([IVXLC]{1,6})(?![\wº])/))) sub.incisos.push(m[1]);
  else if ((m = p.match(/§+\s*(\d{1,3}[ºo°]?)(?:\s*-\s*([A-Z]))?/))) sub.paragrafos.push(m[1] + (m[2] ? "-" + m[2] : ""));
  else if (/par[áa]grafo\s+[úu]nico/i.test(p)) sub.paragrafos.push("único");
  else if ((m = p.match(/par[áa]grafo\s+(\d{1,3}[ºo°]?)(?:\s*-\s*([A-Z]))?/i))) sub.paragrafos.push(m[1] + (m[2] ? "-" + m[2] : ""));
  else if ((m = p.match(/(?:al[íi]nea\s*)?([a-z])\)|["'“”]([a-z])["'“”]|^\s*,\s*([a-k])/i))) {
    sub.alineas.push((m[1] || m[2] || m[3]).toLowerCase());
  }
}

/* Engole o endereço interno de UM artigo: parágrafo, inciso, alínea. Devolve o
 * tamanho consumido e o que leu. "e V" só continua uma lista de incisos já
 * começada ("…, I, II, IV e V"). */
function leiConsumirEndereco(resto) {
  let r = resto, len = 0, ultimoFoiInciso = false;
  const sub = { incisos: [], paragrafos: [], alineas: [] };
  for (let k = 0; k < 12; k++) {          /* teto: endereço não é infinito */
    let achou = false;
    for (let i = 0; i < LEI_SUB.length; i++) {
      const t = r.match(LEI_SUB[i]);
      if (t && t[0].length) {
        leiLerSubEndereco(t[0], sub);
        ultimoFoiInciso = i <= 1;
        len += t[0].length; r = r.slice(t[0].length); achou = true;
        break;
      }
    }
    if (!achou && ultimoFoiInciso) {
      const t = r.match(/^\s*(?:e|ou)\s+([IVXLC]{1,6})(?![\wº])/);
      if (t) { sub.incisos.push(t[1]); len += t[0].length; r = r.slice(t[0].length); achou = true; }
    }
    if (!achou) break;
  }
  return { len, sub };
}

/* depois do número, estas palavras dizem que o número NÃO é outro artigo:
 * "arts. 5º e 6º, 10 dias" */
const LEI_RE_NAO_ARTIGO = /^\s*(?:dias?\b|m[êe]s(?:es)?\b|anos?\b|horas?\b|vezes\b|por\s+cento|%|UFMs?\b|reais\b|sal[áa]rios?\b|unidades\b|de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/i;

/* =====================================================================
 * A CITAÇÃO É UMA LISTA — "arts. 77, 78 e 79 do CTN"
 *
 * O DEFEITO REAL. O comentário dizia "previstos nos arts. 77, 78 e 79 do
 * CTN" e só "arts. 77" virava link, sem lei: depois do primeiro número a
 * leitura parava, e o "do CTN" — que vale para os TRÊS artigos — nunca era
 * alcançado. Agora, depois de um artigo, o leitor segue a lista ("," ";" "e"
 * "ou" "a"), lê o endereço de cada um (inciso, parágrafo, alínea) e só então
 * procura a lei. Cada artigo da lista vira o seu próprio pedaço clicável,
 * todos com a mesma lei; o último engole o "do CTN". Se a lista não for
 * de artigos (plural) e não acabar numa lei, volta a ser só o primeiro:
 * "art. 5º, 10 dias" não vira duas citações.
 *
 * Cada item devolve incisos/paragrafos/alineas — o leitor usa para rolar até
 * o inciso citado ("art. 153, I, II, IV e V").
 * ===================================================================== */
function leiCitacoesNoTexto(texto) {
  const s = String(texto || "");
  const out = [];
  const re = new RegExp(LEI_RE_CITACAO.source, "gi");
  let m;
  while ((m = re.exec(s)) !== null) {
    const num = leiNumNormal(m[1]);
    if (!num || num === "0") {
      if (re.lastIndex === m.index) re.lastIndex++;
      continue;
    }
    const plural = /^(?:arts|artigos)/i.test(m[0].trim());
    const itens = [];
    let fim = m.index + m[0].length;
    const abrir = (ini, cru, n) => {
      const e = leiConsumirEndereco(s.slice(fim));
      fim += e.len;
      itens.push({ ini, fim, num: n, numCru: String(cru).replace(/\s+/g, ""), sub: e.sub });
    };
    abrir(m.index, m[1], num);

    /* a lista: ", 78", " e 79", "; e 154", " a 79" */
    for (let k = 0; k < 14; k++) {
      const c = s.slice(fim).match(/^(?:\s*[,;]\s*(?:(?:e|ou)\s+)?|\s+(?:e|ou|a|ao)\s+)(?:os?\s+)?(\d{1,4}(?:\s*[ºo°ª])?(?:\s*-\s*[A-Z])?)(?!\d)/);
      if (!c) break;
      if (LEI_RE_NAO_ARTIGO.test(s.slice(fim + c[0].length))) break;
      const n2 = leiNumNormal(c[1]);
      if (!n2 || n2 === "0") break;
      const iniNum = fim + c[0].length - c[1].length;
      fim += c[0].length;
      abrir(iniNum, c[1], n2);
    }

    /* a lei, que vale para a lista toda */
    let resto = s.slice(fim);
    let rotulo = "";
    const p = resto.match(/^[\s,]*(?:(?:d[aoe]s?|de)\s+)?/i);
    const salto = p ? p[0].length : 0;
    const dep = resto.slice(salto);
    for (let j = 0; j < LEI_ROTULOS.length; j++) {
      const t2 = dep.match(LEI_ROTULOS[j]);
      if (t2) { rotulo = t2[0]; itens[itens.length - 1].fim = fim + salto + t2[0].length; fim += salto + t2[0].length; break; }
    }
    /* lista que NÃO é de artigos e não acaba numa lei: era só o primeiro */
    if (itens.length > 1 && !plural && !rotulo) {
      itens.length = 1;
      fim = itens[0].fim;
    }
    if (!rotulo) rotulo = leiRotuloAntes(s.slice(Math.max(0, itens[0].ini - 48), itens[0].ini));
    itens.forEach((it, idx) => out.push({
      ini: it.ini, fim: it.fim, num: it.num, numCru: it.numCru,
      rotulo: rotulo || "", texto: s.slice(it.ini, it.fim),
      incisos: it.sub.incisos, paragrafos: it.sub.paragrafos, alineas: it.sub.alineas,
      lista: itens.length > 1, itemDaLista: idx,
    }));
    /* retomar DEPOIS do trecho inteiro: senão a lei que acabou de ser
     * consumida seria lida de novo como início de outra citação */
    re.lastIndex = fim > m.index ? fim : m.index + 1;
  }
  return out;
}

/* Quais unidades de um artigo uma citação aponta: ", I, II" no caput,
 * "§ 4º-A", "§ 2º, II", "II, b)". Devolve as unidades da estrutura. */
function leiAcharUnidades(textoArtigo, sub) {
  const S = sub || {};
  const est = leiEstruturaArtigo(textoArtigo);
  const achadas = [];
  const semOrd = (x) => String(x).replace(/[ºo°]/g, "");
  const chavePar = (x) => {
    if (/^[úu]nico$/i.test(x)) return "PU";
    const m = semOrd(x).match(/^(\d+)(?:-([A-Z]))?$/);
    return m ? "P" + Number(m[1]) + (m[2] || "") : "";
  };
  const base = (S.paragrafos || []).length ? chavePar(S.paragrafos[0]) : "";
  const porChave = (k) => est.unidades.filter((u) => u.chave === k)[0];
  if ((S.incisos || []).length) {
    S.incisos.forEach((r) => {
      const k = (base ? base + ">" : "") + r.toUpperCase();
      const u = porChave(k);
      if (u) {
        achadas.push(u);
        if ((S.alineas || []).length === 1 && S.incisos.length === 1) {
          const a = porChave(k + ">" + S.alineas[0]);
          if (a) achadas.push(a);
        }
      }
    });
  } else if (base) {
    const u = porChave(base);
    if (u) achadas.push(u);
  }
  return achadas;
}

/* =====================================================================
 * O VÍNCULO PERMANENTE DE UM TRECHO DE COMENTÁRIO
 *
 * A leitura automática de "arts. 77, 78 e 79 do CTN" pode errar — sigla
 * desconhecida, frase fora do padrão, lei com nome parecido. Quem estuda
 * precisa poder dizer "este trecho é o CTN, artigos 77 a 79" UMA vez e ver
 * o link certo dali em diante, em qualquer questão que traga a mesma frase,
 * e poder desfazer ("este vínculo está errado"). O vínculo é guardado pelo
 * TEXTO do trecho (normalizado), não pela questão: a mesma frase repetida em
 * cem comentários é corrigida numa vez só, e melhorar a questão (o texto
 * mudar) não perde nada — só deixa de casar o trecho que mudou.
 *
 * Cada vínculo: { k: chave do trecho, trecho, leiId, artigos:[{num,numCru}] }.
 * ===================================================================== */
const CIT_VINC_CHAVE = "eac_cit_vinculos";

function citVinculosLer() {
  try {
    const v = JSON.parse(localStorage.getItem(CIT_VINC_CHAVE) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

function citVinculosGravar(lista) {
  try { localStorage.setItem(CIT_VINC_CHAVE, JSON.stringify(lista || [])); return true; }
  catch (e) { return false; }
}

function citChave(trecho) {
  return leiTxtChave(trecho).replace(/[^a-z0-9]+/g, " ").trim();
}

/* "77, 78 e 79" → [{num:"77",numCru:"77"}, …] — o que a pessoa digitou no campo de artigos */
function citLerArtigos(texto) {
  const out = [];
  (String(texto || "").match(/\d{1,4}\s*[ºo°ª]?(?:\s*-\s*[A-Z])?/g) || []).forEach((x) => {
    const num = leiNumNormal(x);
    if (num && num !== "0" && !out.some((o) => o.num === num)) {
      out.push({ num, numCru: x.replace(/\s+/g, "") });
    }
  });
  return out;
}

function citVinculoSalvar(v) {
  const k = citChave(v && v.trecho);
  if (!k || !v.leiId) return null;
  const lista = citVinculosLer().filter((x) => x.k !== k);
  const r = { k, trecho: String(v.trecho).replace(/\s+/g, " ").trim(), leiId: v.leiId,
    artigos: (v.artigos || []).slice(0, 30), criado: new Date().toISOString() };
  lista.push(r);
  return citVinculosGravar(lista) ? r : null;
}

function citVinculoRemover(k) {
  const lista = citVinculosLer();
  const nova = lista.filter((x) => x.k !== k);
  if (nova.length === lista.length) return false;
  return citVinculosGravar(nova);
}

/* Sobrepõe os vínculos permanentes às citações lidas do texto: cada trecho
 * guardado que aparece no texto vira UM pedaço clicável com a lei FIXA (leiId),
 * no lugar do que a leitura automática tinha achado ali. */
function citVinculosAplicar(texto, cits) {
  const s = String(texto || "");
  let saida = (cits || []).slice();
  citVinculosLer().forEach((v) => {
    const molde = String(v.trecho || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (!molde) return;
    let re;
    try { re = new RegExp(molde, "gi"); } catch (e) { return; }
    let m;
    while ((m = re.exec(s)) !== null) {
      const ini = m.index, fim = m.index + m[0].length;
      saida = saida.filter((c) => !(c.ini < fim && ini < c.fim));
      const a0 = (v.artigos || [])[0] || {};
      saida.push({ ini, fim, num: a0.num || "", numCru: a0.numCru || "", rotulo: "", texto: m[0],
        incisos: [], paragrafos: [], alineas: [], leiId: v.leiId, permanente: true,
        vinculoK: v.k, artigos: v.artigos || [] });
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return saida.sort((x, y) => x.ini - y.ini);
}

function leiRotuloChave(rotulo) {
  const s = leiTxtChave(rotulo);
  /* O ADCT NÃO É UMA LEI À PARTE — é o Ato das Disposições Constitucionais
   * Transitórias, publicado dentro do MESMO texto da Constituição de
   * 1988, com sua própria numeração de artigos (por isso "art. 130" pode
   * existir tanto no corpo quanto no ADCT — ver o comentário sobre isso
   * em leiNotaDe). "CF"/"CRFB" já eram reconhecidos assim; "ADCT" é o
   * mesmo caso, não um apelido configurável por lei — citar o ADCT sem
   * ter guardado um documento separado para ele é a regra, não a
   * exceção, e o caso real que motivou isto era exatamente esse: o
   * tópico já tinha a Constituição ligada, e o app oferecia "colar uma
   * lei nova" em vez de abrir a que já existia. */
  if (/^(cf\b|cf\/|crfb|constitui|adct\b)/.test(s)) {
    return { especie: "constituicao", numero: "", sigla: "" };
  }
  const especie = leiEspecieChave(
    /^lc\b/.test(s) ? "complementar" : /^ec\b/.test(s) ? "emenda" : s);
  const m = s.match(/(\d[\d.]*)/);
  const numero = m ? m[1].replace(/[.]/g, "") : "";
  if (!especie && !numero) return { especie: "", numero: "", sigla: s.toUpperCase() };
  return { especie, numero, sigla: "" };
}

/* AS SIGLAS QUE O PRÓPRIO NOME DA LEI JÁ DIZ.
 *
 * O CASO REAL, com print: a Lei 5.172/1966 estava guardada como "Lei
 * 5.172/1966 - Código Tributário Nacional" e a citação "art. 77 do CTN"
 * caía em "CTN não está na sua biblioteca". A sigla só casava pelo campo
 * "apelido" — e nada no aplicativo preenche esse campo: quem cola a lei
 * nunca o vê. Na prática, toda sigla ficava desconhecida.
 *
 * A sigla de um código é as iniciais do título: Código Tributário
 * Nacional → CTN, Código de Processo Civil → CPC, Consolidação das Leis
 * do Trabalho → CLT. Vale para cada trecho do nome (antes/depois do
 * hífen) e com/sem a palavra "Lei" na frente — "Lei de Responsabilidade
 * Fiscal" é LRF, mas "Lei 5.172/1966 - Código Tributário Nacional" é
 * CTN, não LCTN. Duas leis com as mesmas iniciais dão dúvida (mais de
 * um candidato), e dúvida continua devolvendo null: não chuta. */
const LEI_PALAVRAS_LIGACAO = ["de", "da", "do", "das", "dos", "e", "a", "o", "as",
  "os", "em", "no", "na", "nos", "nas", "para", "por", "com", "sem", "ao", "aos"];
const LEI_PALAVRAS_ESPECIE = ["lei", "complementar", "decreto", "decreto-lei",
  "emenda", "constitucional", "medida", "provisoria", "resolucao", "portaria"];

function leiSiglasDoNome(nome) {
  const out = [];
  const palavras = (txt) => leiTxtChave(txt).split(/[^a-z0-9]+/)
    .filter((w) => w && !/\d/.test(w) && LEI_PALAVRAS_LIGACAO.indexOf(w) < 0);
  const somar = (ws) => {
    const s = ws.map((w) => w[0]).join("").toUpperCase();
    if (s.length >= 2 && out.indexOf(s) < 0) out.push(s);
  };
  const semEspecie = (ws) => ws.filter((w) => LEI_PALAVRAS_ESPECIE.indexOf(w) < 0);
  const trechos = String(nome || "").split(/\s[-–—·|:]\s|[–—()]/);
  trechos.forEach((tr) => {
    const t2 = tr.trim();
    /* o trecho já é a própria sigla: "Lei 5.172/1966 (CTN)" */
    if (/^[A-ZÀ-Ú]{2,8}$/.test(t2) && out.indexOf(t2) < 0) out.push(t2);
    const ws = palavras(t2);
    somar(ws);
    somar(semEspecie(ws));
  });
  const todas = palavras(nome);
  somar(todas);
  somar(semEspecie(todas));
  return out;
}

/* VINCULAR À FORÇA: guarda a sigla que a pessoa escolheu como apelido
 * da lei. É o mesmo campo "apelido" que o casamento já lê, só que agora
 * alguém o preenche. Devolve true se acrescentou (false: nada novo, ou
 * o rótulo não parece uma sigla — "art. 5º da lei acima" não vira
 * apelido de ninguém). */
function leiApelidoAdicionar(idLei, rotulo) {
  const l = leiDe(idLei);
  if (!l) return false;
  /* SIGLA É UMA PALAVRA SÓ: com espaço no meio o rótulo é uma frase, e
   * o campo "apelido" separa por espaço — viraria várias siglas falsas */
  if (leiTxtChave(rotulo).indexOf(" ") >= 0) return false;
  const sg = leiApelidoChave(rotulo).toUpperCase();
  if (sg.length < 2 || sg.length > 16) return false;
  const tem = String(l.apelido || "").split(/[\s/,]+/).filter(Boolean);
  if (tem.map((x) => leiTxtChave(x).toUpperCase()).indexOf(sg) >= 0) return false;
  tem.push(sg);
  return !!leiGuardar({ id: l.id, apelido: tem.join(" ") });
}

/* CASAR O RÓTULO COM A BIBLIOTECA.
 *
 * DEVOLVE null QUANDO HÁ DÚVIDA — zero candidatos ou mais de um. É a
 * decisão central deste arquivo: abrir a lei errada em silêncio é pior
 * que não abrir nada, porque a pessoa confere o artigo, vê que bate, e
 * guarda na cabeça uma regra que não é a que caiu na prova. Com null,
 * quem desenha abre a modal de vincular e a escolha volta para as mãos
 * de quem sabe. */
/* A CHAVE DO APELIDO: o rótulo sem espaço nem pontuação ("CF/88" ->
 * "cf88"), a mesma normalização de leiApelidoAdicionar — o que a pessoa
 * mandou lembrar tem de casar com o que a citação diz, senão o
 * marcador grava e a citação seguinte continua sem achar. */
function leiApelidoChave(x) {
  return leiTxtChave(x).replace(/[^a-z0-9-]/g, "");
}

/* QUAIS LEIS CASAM COM O RÓTULO — a lista inteira, para quem precisa
 * dizer POR QUE não abriu (zero, ou mais de uma). leiCasarRotulo, logo
 * abaixo, só devolve a lei quando sobra exatamente uma. */
function leiCandidatosDoRotulo(rotulo, lista) {
  const alvo = leiRotuloChave(rotulo);
  const ls = lista || leisLista();
  let cand = [];

  /* O APELIDO EXPLÍCITO GANHA EM QUALQUER RAMO. É a escolha da pessoa
   * ("vincular à força"), e antes ela só valia no ramo das siglas: com
   * duas leis parecidas com a Constituição na biblioteca (a federal e a
   * estadual, ou a CF guardada duas vezes), o ramo da Constituição
   * ignorava o apelido, "CF/88" continuava em dúvida e o marcador
   * parecia não ter feito nada — o caso real do print. Só vale para o
   * rótulo de uma palavra (é o que o apelido guarda), e duas leis com o
   * mesmo apelido continuam sendo dúvida. */
  const chaveAp = leiApelidoChave(rotulo);
  if (chaveAp.length >= 2 && String(rotulo || "").trim().indexOf(" ") < 0) {
    const explicitas = ls.filter((l) => String(l.apelido || "").split(/[\s/,]+/)
      .filter(Boolean).some((x) => leiApelidoChave(x) === chaveAp));
    if (explicitas.length) return explicitas;
  }

  if (alvo.especie === "constituicao") {
    /* O NOME NA BIBLIOTECA TAMBÉM PODE SER A SIGLA, sem a palavra
     * "Constituição" escrita por extenso em lugar nenhum — "CF 88",
     * "CF/88", "CRFB" são formas comuns de nomear a lei ao colá-la, e
     * "apelido" é um campo à parte que quase ninguém preenche se o
     * próprio nome já diz tudo. O CASO REAL: uma lei guardada como
     * "CF 88" não tinha "constitui" nem em nome nem em espécie, e o
     * apelido nunca tinha sido preenchido — a citação "art. 195, §7º,
     * da Constituição Federal" caía sempre em "não está na biblioteca",
     * mesmo com o texto certo guardado ali do lado. leiRotuloChave já
     * sabe reconhecer essas siglas para uma CITAÇÃO; aqui é o mesmo
     * reconhecimento aplicado ao NOME da lei guardada. */
    cand = ls.filter((l) =>
      /constitui/.test(leiTxtChave(l.especie) + " " + leiTxtChave(l.nome))
      || /^(cf|crfb)/.test(leiTxtChave(l.apelido))
      || leiRotuloChave(l.nome).especie === "constituicao");
    /* "CF", "CF/88", "CRFB", "Constituição Federal" são a FEDERAL. Com
     * mais de uma lei "constitucional" na biblioteca (a estadual, por
     * exemplo), fica a que se apresenta como federal — a menos que o
     * rótulo já diga "estadual". Se ainda restar mais de uma, é dúvida. */
    if (cand.length > 1 && !/estad|municip|distrit/.test(leiTxtChave(rotulo))) {
      const federais = cand.filter((l) => {
        const nm = leiTxtChave(l.nome);
        if (/estad|municip|distrit|organica/.test(nm)) return false;
        return /federa|republica|brasil de 1988/.test(nm)
          || /^(cf|crfb)/.test(leiTxtChave(l.apelido))
          || /^(cf|crfb)\b/.test(nm);
      });
      if (federais.length) cand = federais;
    }
  } else if (alvo.sigla) {
    /* a sigla casa PRIMEIRO pelo APELIDO, que é campo que a pessoa
     * preencheu de propósito (ou mandou lembrar, ver
     * leiApelidoAdicionar) — e por isso a escolha dela ganha do que o
     * nome sugere: forçar "CTN" para outra lei tem de funcionar mesmo
     * que uma terceira tenha as iniciais parecidas. Nunca pelo nome
     * solto, senão "LEI" acharia todas. */
    const sg = leiTxtChave(alvo.sigla);
    cand = ls.filter((l) => leiTxtChave(l.apelido).split(/[\s/,]+/).indexOf(sg) >= 0);
    if (!cand.length) {
      /* sem apelido nenhum: as iniciais do título ("CTN" = Código
       * Tributário Nacional) e, para o nome por extenso, o título
       * inteiro dentro do nome guardado. Título por extenso só conta
       * com DUAS palavras ou mais — uma palavra solta ("lei") acharia
       * tudo. */
      const porIniciais = ls.filter((l) =>
        leiSiglasDoNome(l.nome).map((x) => leiTxtChave(x)).indexOf(sg) >= 0);
      if (porIniciais.length) cand = porIniciais;
      else if (sg.indexOf(" ") > 0) {
        cand = ls.filter((l) => leiTxtChave(l.nome).indexOf(sg) >= 0);
      }
    }
  } else if (alvo.numero) {
    cand = ls.filter((l) => String(l.numero || "").replace(/[.]/g, "") === alvo.numero);
    /* lei colada sem cabeçalho não tem "numero" preenchido; o número
     * ainda costuma estar no nome que ela recebeu */
    if (!cand.length) {
      cand = ls.filter((l) => leiTxtChave(l.nome).replace(/[.]/g, "")
        .split(/[^0-9]+/).indexOf(alvo.numero) >= 0);
    }
    /* a espécie é o que separa a LC 101 da Lei 101 */
    if (cand.length > 1 && alvo.especie) {
      const pe = cand.filter((l) => leiEspecieChave(l.especie) === alvo.especie);
      if (pe.length) cand = pe;
    }
  }
  return cand;
}

function leiCasarRotulo(rotulo, lista) {
  const cand = leiCandidatosDoRotulo(rotulo, lista);
  return cand.length === 1 ? cand[0] : null;
}

/* =====================================================================
 * IDENTIFICAR A LEI PELO PRÓPRIO TEXTO
 *
 * Quem cola a lei já colou o cabeçalho junto na imensa maioria das
 * vezes. Ler dali o número e o ano poupa dois campos de formulário e,
 * mais importante, evita o erro de digitar "4.230".
 *
 * O DEFEITO QUE ISTO CONSERTA, com o relato inteiro: a Constituição
 * inteira foi colada do Planalto com Ctrl+A e gravada como "Emenda
 * Constitucional 106/2020 · 424 artigos".
 *
 * A CAUSA é a mesma que consertamos no comentário da questão, e é um
 * erro de projeto, não de expressão regular: procurar o nome em 1200
 * caracteres corridos acha MENÇÃO, não TÍTULO. O texto compilado do
 * Planalto vem cheio de "(Vide Emenda Constitucional nº 106, de 2020)"
 * e "(Redação dada pela Emenda Constitucional nº 132, de 2023)" —
 * anotações de vigência que o Planalto pendura no artigo. A primeira
 * delas ganhava da linha de título que estava ACIMA, porque a busca era
 * por primeira ocorrência, e a Constituição só era considerada quando
 * NADA mais casava.
 *
 * TRÊS MUDANÇAS, nesta ordem de importância:
 *
 * 1. TÍTULO MORA NO COMEÇO DA LINHA. A busca passa a ser linha a linha,
 *    e a linha de nota é descartada antes. "Vide" nunca começa um
 *    título, e um título nunca começa com parêntese.
 * 2. A CONSTITUIÇÃO É TESTADA PRIMEIRO. Ela é o único diploma cujo nome
 *    não tem número, então ela perdia para qualquer número que
 *    aparecesse antes. Sendo a mais citada das normas, era também a mais
 *    fácil de perder.
 * 3. O NÚMERO DE ARTIGOS DESMENTE O NOME. Emenda com 424 artigos não
 *    existe — a maior tem algumas dezenas. Quando a conta não fecha, a
 *    identificação é descartada em vez de gravada: um nome errado que
 *    parece certo é pior que nenhum nome.
 * ===================================================================== */

/* Linha de NOTA do Planalto, que não é título de norma nenhuma. */
const LEI_RE_NOTA =
  /^[\s("*]*(vide|reda[çc][ãa]o\s+dada|inclu[íi]d|revogad|acrescentad|renumerad|vig[êe]ncia|produ[çc][ãa]o\s+de\s+efeito|com\s+reda[çc][ãa]o)/i;

/* Emenda e medida provisória são normas CURTAS. Quando o texto colado
 * tem mais artigos do que isso, o nome lido é menção a uma emenda
 * dentro de outra norma — que é exatamente o caso da Constituição
 * compilada. */
const LEI_MAX_ARTIGOS_EMENDA = 60;

function leiIdentificar(texto, quantosArtigos) {
  const cru = String(texto || "");
  /* as primeiras linhas, e não os primeiros 1200 caracteres: o título
   * de uma norma está nas primeiras linhas dela, e mais abaixo só há
   * menção */
  const linhas = cru.slice(0, 12000).split("\n")
    .map((x) => x.trim())
    .filter((x) => x && !LEI_RE_NOTA.test(x))
    .slice(0, 120);

  /* 1. A CONSTITUIÇÃO PRIMEIRO, e pelo título por extenso: "Constituição"
   * solto aparece no corpo de metade das leis ("nos termos desta
   * Constituição"), e por isso o teste exige o nome inteiro NO COMEÇO DA
   * LINHA. É o que faz "nos termos do art. 62 da Constituição Federal",
   * no preâmbulo de uma medida provisória, não virar a Constituição.
   *
   * Ela olha mais longe que a busca por espécie logo abaixo — 120 linhas
   * contra 40 — porque o texto compilado do Planalto traz um índice de
   * emendas antes do corpo, e foi justamente uma linha desse índice que
   * batizou a Constituição de "Emenda Constitucional 106/2020". Sendo o
   * título exato e ancorado, olhar mais longe aqui não custa precisão. */
  const temCF = linhas.some((x) =>
    /^constitui[çc][ãa]o\s+(da\s+rep[úu]blica|federal)/i.test(x));
  if (temCF) {
    return { especie: "Constituição", numero: "", ano: "1988",
             nome: "Constituição Federal de 1988", curto: "CF/88" };
  }

  /* 2. O TÍTULO NO COMEÇO DA LINHA */
  /* o "[\s*#>_-]*" na frente aceita o enfeite que vem de PDF e de
   * markdown ("**LEI Nº 8.666**", "# LEI...") sem abrir mão da âncora,
   * que é o que separa título de menção */
  const RE_TIT =
    /^[\s*#>_-]*(LEI|LEI\s+COMPLEMENTAR|DECRETO[\s-]?LEI|DECRETO|EMENDA\s+CONSTITUCIONAL|MEDIDA\s+PROVIS[ÓO]RIA)\s*(?:N?[ºo°.]?\s*)?([\d.]{3,9}|\d{1,2}(?=\s*,?\s*DE\s+))(?:\s*,?\s*DE\s+.{0,40}?(\d{4}))?/i;
  let m = null;
  const ate = Math.min(linhas.length, 40);
  for (let i = 0; i < ate && !m; i++) m = linhas[i].match(RE_TIT);
  if (!m) return null;

  /* 3. O NÚMERO DE ARTIGOS DESMENTE O NOME */
  const ehEmenda = /^(EMENDA|MEDIDA)/i.test(m[1]);
  if (ehEmenda) {
    const n = (quantosArtigos === undefined)
      ? leiArtigos(cru).length : quantosArtigos;
    if (n > LEI_MAX_ARTIGOS_EMENDA) return null;
  }

  const especie = m[1].toUpperCase().replace(/\s+/g, " ");
  const numero = String(m[2]).replace(/\.$/, "");
  const ano = m[3] || "";
  const bonito = { "LEI": "Lei", "LEI COMPLEMENTAR": "Lei Complementar",
    "DECRETO-LEI": "Decreto-Lei", "DECRETO LEI": "Decreto-Lei",
    "DECRETO": "Decreto", "EMENDA CONSTITUCIONAL": "Emenda Constitucional",
    "MEDIDA PROVISÓRIA": "Medida Provisória",
    "MEDIDA PROVISORIA": "Medida Provisória" }[especie] || "Lei";
  const curto = (bonito === "Lei Complementar" ? "LC " : bonito === "Lei" ? "Lei " : bonito + " ")
    + numero + (ano ? "/" + ano : "");
  return { especie: bonito, numero, ano, nome: curto.trim(), curto: curto.trim() };
}

/* ---------------------------------------------------------------------
 * PARTE 2 — A BIBLIOTECA
 * ------------------------------------------------------------------ */

function leisLerTudo() {
  try {
    const v = JSON.parse(localStorage.getItem(LEIS_CHAVE) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch (e) { return {}; }
}

function leisGravarTudo(o) {
  try { localStorage.setItem(LEIS_CHAVE, JSON.stringify(o || {})); return true; }
  catch (e) {
    try { uiAlert(t("leis_sem_espaco")); } catch (e2) {}
    return false;
  }
}

function leisHojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

/* O id é derivado do nome, não sorteado: colar a mesma lei duas vezes
 * tem de cair no mesmo registro, senão a biblioteca enche de "Lei 4.320"
 * repetida e o vínculo com os tópicos se parte. */
function leiId(nome) {
  return "lei_" + String(nome || "sem-nome").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function leiDe(id) {
  const r = leisLerTudo()[String(id)];
  return r || null;
}

/* A NOTA DE UM ARTIGO — "Art. 151, isenção para exportação" — mora no
 * próprio registro da lei, um mapa por número normalizado
 * ("notasArtigos"), pelo mesmo mecanismo de merge que já guarda "onde
 * parei" e os capítulos lidos. Sem tabela nova, sem chave composta: o
 * número já é único DENTRO de uma lei (a ambiguidade do art. repetido
 * entre corpo e ADCT é resolvida no leitor, não aqui — a nota vale para
 * a primeira ocorrência, que é a que qualquer citação de fora aponta). */
function leiNotaDe(idLei, num) {
  return leiNotaDeEm(leiDe(idLei), num);
}

/* A MESMA CONSULTA, SOBRE UMA LEI JÁ EM MÃO. leiNotaDe(id, n) relê e
 * parseia a biblioteca INTEIRA do localStorage a cada chamada — e o
 * leitor pergunta uma vez por artigo (e duas por pintura). Numa
 * Constituição de 424 artigos isso eram ~865 leituras+parses por abertura,
 * dois terços do tempo que a tela ficava parada (medido: 467 de 717 ms).
 * Quem já tem o registro da lei passa por aqui. */
function leiNotaDeEm(l, num) {
  if (!l || !l.notasArtigos) return "";
  return l.notasArtigos[leiNumNormal(num)] || "";
}

function leiNotaGuardar(idLei, num, texto) {
  const l = leiDe(idLei);
  if (!l) return false;
  const notas = Object.assign({}, l.notasArtigos || {});
  const n = leiNumNormal(num);
  const limpo = String(texto || "").trim();
  /* salvar vazio APAGA a nota que existia: vai para a lixeira (lixeira.js) */
  if (!limpo && notas[n]) {
    try {
      lixJogar({ tipo: "nota", via: "artigo", motivo: "vazio", rotulo: String(notas[n]).slice(0, 80),
        onde: (l.nome || idLei) + " · art. " + n, dados: { lei: idLei, num: n, texto: notas[n] } });
    } catch (e) {}
  }
  if (limpo) notas[n] = limpo; else delete notas[n];
  return !!leiGuardar({ id: idLei, notasArtigos: notas });
}

/* A NOTA DE UM TRECHO — diferente da nota de artigo acima: em vez de uma
 * frase sobre o artigo inteiro, é uma anotação presa a um PEDAÇO
 * selecionado do texto (a marca "nota", `==@...==`, ver MAT_MARCAS em
 * material.js). Mesmo padrão de "dica" nos resumos (matChaveDica/
 * matGravarDica): a chave é o texto NORMALIZADO do trecho, não a
 * posição — sobrevive a reler a lei, a marcar de novo, a mudar de
 * aparelho. `notasTrechos` é uma lista (não um mapa) porque o mesmo
 * trecho normalizado, em teoria, pode aparecer marcado em mais de um
 * lugar da lei; `matChaveDica` já corta para 120 caracteres, suficiente
 * para distinguir na prática. */
function leiNotaTrechoDe(idLei, trecho) {
  return leiNotaTrechoDeEm(leiDe(idLei), trecho);
}

/* idem, sobre uma lei já em mãos (ver leiNotaDeEm) */
function leiNotaTrechoDeEm(l, trecho) {
  if (!l || !l.notasTrechos) return null;
  const k = matChaveDica(trecho);
  return l.notasTrechos.find((n) => n.k === k) || null;
}

function leiNotaTrechoGuardar(idLei, trecho, texto) {
  const l = leiDe(idLei);
  if (!l) return false;
  const k = matChaveDica(trecho);
  const anterior = (l.notasTrechos || []).filter((n) => n.k === k)[0];
  const lista = (l.notasTrechos || []).filter((n) => n.k !== k);
  const limpo = String(texto || "").trim();
  /* salvar vazio APAGA a nota que existia: vai para a lixeira (lixeira.js) */
  if (!limpo && anterior && anterior.texto) {
    try {
      lixJogar({ tipo: "nota", via: "trecho", motivo: "vazio", rotulo: String(anterior.texto).slice(0, 80),
        onde: (l.nome || idLei) + " · " + String(anterior.trecho || trecho).slice(0, 50),
        dados: { lei: idLei, trecho: anterior.trecho || String(trecho).slice(0, 300), texto: anterior.texto } });
    } catch (e) {}
  }
  if (limpo) {
    lista.push({ k, trecho: String(trecho || "").slice(0, 300), texto: limpo,
                 criado: new Date().toISOString() });
  }
  return !!leiGuardar({ id: idLei, notasTrechos: lista });
}

function leisLista() {
  const tudo = leisLerTudo();
  return Object.keys(tudo).map((k) => tudo[k])
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
}

/* Criar ou atualizar. Object.assign sobre o que já existe, pelo mesmo
 * motivo de sempre: gravar o texto não pode apagar o link da fonte, e
 * gravar a fonte não pode apagar onde a pessoa parou. */
function leiGuardar(dados, gravar) {
  if (!dados) return null;
  const id = dados.id || leiId(dados.nome || (leiIdentificar(dados.texto) || {}).nome);
  const tudo = leisLerTudo();
  const antigo = tudo[id] || {};
  const r = Object.assign({
    id,
    nome: "",
    apelido: "",
    especie: "",
    numero: "",
    ano: "",
    fonte: "",
    consultadaEm: "",
    versao: "",
    texto: "",
    topicos: [],
    parei: "",
    pareiEm: "",
    blocos: {},          /* {nomeDoBloco: "2026-08-20"} */
    alteracoes: {},       /* {numArtigo: {texto, fonteAlteracao, data, revogado?}} */
    repetidosOk: [],      /* números repetidos que a pessoa conferiu e mandou MANTER */
    criado: new Date().toISOString(),
  }, antigo, dados, { id, tocado: new Date().toISOString() });
  r.topicos = (r.topicos || []).filter((x, i, a) => x && a.indexOf(x) === i);
  tudo[id] = r;
  if (!leisGravarTudo(tudo)) return null;
  if (gravar) gravar(LEIS_CHAVE, JSON.stringify(tudo));
  return r;
}

function leiApagar(id) {
  const tudo = leisLerTudo();
  if (!tudo[String(id)]) return false;
  const nome = tudo[String(id)].nome;
  delete tudo[String(id)];
  if (!leisGravarTudo(tudo)) return false;
  /* os tópicos que apontavam para ela param de apontar */
  leiSoltarPonteiros(String(id), "");
  try { reg("LEI", "lei removida da biblioteca", nome || id); } catch (e) {}
  return true;
}

/* ---- o vínculo com os tópicos (é aqui que a lei deixa de ser cópia) ---- */

function leiLigar(id, chaveTopico) {
  const r = leiDe(id);
  if (!r || !chaveTopico) return false;
  const ch = String(chaveTopico);
  if (r.topicos.indexOf(ch) >= 0) return true;
  leiGuardar({ id, topicos: r.topicos.concat([ch]) });
  try { reg("LEI", "lei ligada a tópico", (r.nome || id) + " · " + ch); } catch (e) {}
  return true;
}

function leiDesligar(id, chaveTopico) {
  const r = leiDe(id);
  if (!r) return false;
  const ch = String(chaveTopico);
  leiGuardar({ id, topicos: r.topicos.filter((x) => x !== ch) });
  return true;
}

/* As leis de um tópico. Tolera as variações de acento e espaço da chave
 * pelo mesmo motivo de matChaveViva: um acento de diferença entre o que
 * o edital escreveu e o que ficou gravado abriria duas gavetas. */
function leisDoTopico(chave) {
  const alvo = leisChaveComparavel(chave);
  if (!alvo) return [];
  return leisLista().filter((l) =>
    (l.topicos || []).some((c) => leisChaveComparavel(c) === alvo));
}

function leisChaveComparavel(c) {
  return String(c || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

/* ---- onde parei ---- */

/* Marcador por ARTIGO, não por rolagem. Posição de rolagem morre quando
 * se aumenta a fonte, quando se abre no celular, quando se cola mais um
 * capítulo no começo. "Parei no art. 35" sobrevive a tudo isso, e ainda
 * é dizível em voz alta. */
function leiParar(id, numArtigo, indice) {
  const r = leiDe(id);
  if (!r) return false;
  const num = leiNumNormal(numArtigo);
  /* O NÚMERO NÃO É CHAVE ÚNICA (a CF repete quase todos entre o corpo e o ADCT): o marcador guarda
   * também a POSIÇÃO do artigo na lista. Sem ela, marcar o art. 5º do ADCT marcava o do corpo. */
  leiGuardar({ id, parei: num, pareiIndice: (num && Number.isInteger(indice) && indice >= 0) ? indice : -1,
    pareiEm: new Date().toISOString() });
  try {
    reg("LEI", "marcador movido", (r.nome || id) + " · art. " + numArtigo);
  } catch (e) {}
  return true;
}

/* A POSIÇÃO do artigo marcado na lista de artigos. Vale a posição guardada quando ela ainda aponta
 * para um artigo com o mesmo número; senão (marcador antigo, sem posição, ou texto que mudou) vale a
 * PRIMEIRA ocorrência do número — o que sempre valeu. -1 se não há marcador ou o artigo não existe. */
function leiIndiceDoMarcador(r, arts) {
  if (!r || !r.parei || !arts || !arts.length) return -1;
  const i = Number.isInteger(r.pareiIndice) ? r.pareiIndice : -1;
  if (i >= 0 && arts[i] && arts[i].num === r.parei) return i;
  return arts.findIndex((a) => a.num === r.parei);
}

/* Quanto da lei já foi lido, medido em artigos até o marcador. É a
 * resposta honesta para "estou onde?" — 40 de 115 é uma frase que
 * significa alguma coisa; "li" e "não li" não são. */
function leiProgresso(id) {
  const r = leiDe(id);
  if (!r) return null;
  const arts = leiArtigosEfetivos(r);
  if (!arts.length) return { total: 0, lidos: 0, pct: 0, artigo: "" };
  const i = leiIndiceDoMarcador(r, arts);
  const lidos = i < 0 ? 0 : i + 1;
  return {
    total: arts.length,
    lidos,
    pct: Math.round((lidos / arts.length) * 100),
    artigo: r.parei || "",
    indice: i,
    /* proximo VEM DE UMA POSIÇÃO (arts[lidos]), não de uma busca por
     * número — por isso carrega o próprio índice sem ambiguidade
     * nenhuma, mesmo quando o número dele se repete mais à frente no
     * documento (o corpo da Constituição e o ADCT, por exemplo). Ver o
     * uso em leiPintarOnde. */
    proximo: (arts[lidos] || null),
  };
}

/* ---- blocos lidos ---- */

function leiBlocoLido(id, nomeBloco, sim) {
  const r = leiDe(id);
  if (!r) return false;
  const b = Object.assign({}, r.blocos || {});
  if (sim === false) delete b[nomeBloco];
  else b[nomeBloco] = leisHojeISO();
  leiGuardar({ id, blocos: b });
  return true;
}

function leiBlocosLidos(id) {
  const r = leiDe(id);
  return r ? Object.keys(r.blocos || {}).length : 0;
}

/* ---------------------------------------------------------------------
 * PARTE 3 — MIGRAÇÃO
 *
 * Há leis já coladas na caixa antiga, uma por tópico. Elas não podem
 * simplesmente deixar de aparecer — isso é perda de dado com cara de
 * "atualização". A migração lê cada leiTexto, identifica a lei pelo
 * cabeçalho e junta as cópias iguais num registro só, mantendo o texto
 * antigo onde estava. Nada é apagado: se a migração errar, o original
 * continua no resumo.
 * ------------------------------------------------------------------ */

function leisMigrarDe(resumos, gravar) {
  const res = resumos || (typeof matResumos !== "undefined" ? matResumos : {});
  const criadas = [];
  Object.keys(res || {}).forEach((chave) => {
    const r = res[chave] || {};
    const txt = String(r.leiTexto || "").trim();
    if (!txt) return;
    const ident = leiIdentificar(txt);
    const nome = ident ? ident.nome
      : ((r.disciplina || "") + " — " + (r.topico || chave));
    const id = leiId(nome);
    const ja = leiDe(id);
    /* Texto MAIOR ganha: duas cópias do mesmo diploma quase sempre são
     * a mesma lei colada pela metade num tópico e inteira no outro.
     * Ficar com a menor perderia artigos em silêncio. */
    const texto = ja && String(ja.texto || "").length >= txt.length ? ja.texto : txt;
    const novo = leiGuardar(Object.assign({
      id, nome, texto,
      topicos: ((ja && ja.topicos) || []).concat([chave]),
      migradaDe: (ja && ja.migradaDe ? ja.migradaDe : []).concat([chave]),
    }, ident ? { especie: ident.especie, numero: ident.numero, ano: ident.ano } : {}),
    gravar);
    if (novo && !ja) criadas.push(novo);
  });
  if (criadas.length) {
    try {
      reg("LEI", "biblioteca de leis criada a partir dos tópicos",
          criadas.map((c) => c.nome).join(", "));
    } catch (e) {}
  }
  return criadas;
}

/* =====================================================================
 * A LEI EXISTE UMA VEZ SÓ — identidade, mesclagem e ponteiros
 *
 * O DEFEITO QUE MOTIVOU ISTO. Colar a Lei 4.320 num segundo tópico caía no
 * MESMO registro (o id nasce do nome) e o leiGuardar da criação SUBSTITUÍA o
 * texto e a lista de tópicos: o primeiro tópico perdia o vínculo e o texto
 * antigo era trocado por baixo, sem aviso. Fonte única não é só "um
 * registro": é nunca deixar duas coisas escreverem nele sem a pessoa saber.
 *
 * A IDENTIDADE de uma lei é espécie + número + ano (+ cidade/órgão quando se
 * sabe): "Lei Complementar 15/2009" de Caruaru não é a de outro município.
 * Sem número (a Constituição, um texto sem cabeçalho), vale o nome.
 * ===================================================================== */
function leiNumeroNorm(n) {
  return String(n == null ? "" : n).replace(/[.\s]/g, "").replace(/^0+(?=\d)/, "");
}

function leiEspecieNorm(e) {
  const k = leiTxtChave(e);
  if (!k) return "";
  if (/complementar|^lc$/.test(k)) return "lc";
  if (/decreto.?lei/.test(k)) return "decreto-lei";
  if (/decreto/.test(k)) return "decreto";
  if (/emenda|^ec$/.test(k)) return "ec";
  if (/medida/.test(k)) return "mp";
  if (/constitui/.test(k)) return "cf";
  if (/^lei/.test(k)) return "lei";
  return k;
}

/* A cidade ou o órgão, lido do cabeçalho ("Prefeitura de Caruaru",
 * "Município de Caruaru", "Estado de Pernambuco"). Só uma SUGESTÃO: a pessoa
 * corrige na procedência. Vazio quando não há certeza. */
function leiEnteDoTexto(texto) {
  const linhas = String(texto || "").split("\n").slice(0, 40).join("\n");
  const m = linhas.match(/(?:prefeitura|munic[ií]pio|c[âa]mara\s+municipal|estado|governo)\s+d[eoa]s?\s+([A-ZÀ-Ú][A-Za-zÀ-ú]+(?:\s+d[aeo]s?\s+[A-ZÀ-Ú][A-Za-zÀ-ú]+){0,2})/i);
  if (!m) return "";
  const nome = m[1].trim();
  /* "Prefeitura de Caruaru" e nada mais — ignora o que vier depois de pontuação */
  return nome.length >= 3 && nome.length <= 40 ? nome : "";
}

function leiChaveIdentidade(x) {
  const num = leiNumeroNorm(x && x.numero);
  if (!num) return "";
  return [leiEspecieNorm(x.especie), num, String((x && x.ano) || "").trim(),
    leiTxtChave((x && x.ente) || "")].join("|");
}

/* São a MESMA lei? Duas leis com número igual só são a mesma se nada do que
 * se sabe delas se contradiz: espécie, ano e cidade só desempatam quando os
 * DOIS lados os têm. Sem número, o nome igual decide. */
function leiMesmaLei(a, b) {
  if (!a || !b) return false;
  const na = leiNumeroNorm(a.numero), nb = leiNumeroNorm(b.numero);
  if (na && nb) {
    if (na !== nb) return false;
    const ea = leiEspecieNorm(a.especie), eb = leiEspecieNorm(b.especie);
    if (ea && eb && ea !== eb) return false;
    if (a.ano && b.ano && String(a.ano) !== String(b.ano)) return false;
    const ta = leiTxtChave(a.ente), tb = leiTxtChave(b.ente);
    if (ta && tb && ta !== tb) return false;
    return true;
  }
  if (na || nb) return false;
  const ka = leiTxtChave(a.nome), kb = leiTxtChave(b.nome);
  return !!ka && ka === kb;
}

/* A lei da biblioteca que é a mesma de `x` — a que a pessoa disse "são
 * diferentes" não conta. */
function leiAcharIgual(x, exceto) {
  return leisLista().filter((l) => l.id !== exceto
    && !((l.distintasDe || []).indexOf(x && x.id) >= 0)
    && leiMesmaLei(l, x))[0] || null;
}

/* Um id que NÃO esteja em uso — para criar uma lei separada de propósito,
 * sem cair em cima do registro de outra. */
function leiIdLivre(nome, ente) {
  const tudo = leisLerTudo();
  const base = leiId(nome);
  if (!tudo[base]) return base;
  if (ente) {
    const c = leiId(String(nome || "") + " " + ente);
    if (!tudo[c]) return c;
  }
  for (let i = 2; i < 200; i++) {
    const c = base.slice(0, 44) + "-" + i;
    if (!tudo[c]) return c;
  }
  return base + "-" + Date.now().toString(36);
}

/* GRUPOS DE LEIS QUE PARECEM A MESMA, para a pessoa escolher qual fica. */
function leiDuplicadasNaBiblioteca() {
  const L = leisLista();
  const pai = {};
  L.forEach((l) => { pai[l.id] = l.id; });
  const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
  for (let i = 0; i < L.length; i++) {
    for (let j = i + 1; j < L.length; j++) {
      if ((L[i].distintasDe || []).indexOf(L[j].id) >= 0
          || (L[j].distintasDe || []).indexOf(L[i].id) >= 0) continue;
      if (leiMesmaLei(L[i], L[j])) pai[raiz(L[j].id)] = raiz(L[i].id);
    }
  }
  const grupos = {};
  L.forEach((l) => { (grupos[raiz(l.id)] = grupos[raiz(l.id)] || []).push(l); });
  return Object.keys(grupos).map((k) => grupos[k]).filter((g) => g.length > 1);
}

/* "São leis diferentes": cada uma lembra das outras, e o aviso some. */
function leiMarcarDistintas(ids) {
  const lista = (ids || []).filter(Boolean);
  lista.forEach((id) => {
    const l = leiDe(id);
    if (!l) return;
    const d = (l.distintasDe || []).slice();
    lista.forEach((o) => { if (o !== id && d.indexOf(o) < 0) d.push(o); });
    leiGuardar({ id, distintasDe: d });
  });
  return true;
}

/* Os ponteiros que os tópicos guardam para uma lei (matResumos[..].leiId).
 * Apagar a lei sem soltá-los deixava o tópico dizendo "tem lei" (o selo do
 * Material) sem lei nenhuma. `paraId` reaponta em vez de soltar. */
function leiSoltarPonteiros(id, paraId) {
  if (typeof matResumos === "undefined" || !matResumos) return 0;
  let n = 0;
  Object.keys(matResumos).forEach((k) => {
    const r = matResumos[k];
    if (r && r.leiId === id) { r.leiId = paraId || ""; n++; }
  });
  if (n && typeof matSalvar === "function") { try { matSalvar(); } catch (e) {} }
  return n;
}

/* MESCLAR: `idMantida` fica; as outras entram nela e somem. Nada do que a
 * pessoa fez se perde: tópicos, notas, marcas, "onde parei", alterações e
 * apelidos são UNIDOS. Onde os dois lados têm algo diferente no mesmo lugar
 * (a nota do mesmo artigo), fica a da lei mantida e a outra vem depois dela.
 * O TEXTO é o da lei mantida — a escolha de qual fica é da pessoa. */
function leiMesclar(idMantida, idsAbsorvidas) {
  const kept = leiDe(idMantida);
  const outras = (idsAbsorvidas || []).map((i) => leiDe(i)).filter((l) => l && l.id !== idMantida);
  if (!kept || !outras.length) return null;
  const r = { topicos: 0, notas: 0, marcas: 0 };
  const dados = { id: kept.id };
  const topicos = (kept.topicos || []).slice();
  const notas = Object.assign({}, kept.notasArtigos || {});
  const trechos = (kept.notasTrechos || []).slice();
  const blocos = Object.assign({}, kept.blocos || {});
  const alteracoes = Object.assign({}, kept.alteracoes || {});
  const repetidosOk = (kept.repetidosOk || []).slice();
  const anexos = (kept.anexos || []).slice();
  const siglas = String(kept.apelido || "").split(/[\s/,]+/).filter(Boolean);
  let parei = kept.parei || "", pareiEm = kept.pareiEm || "";
  let pareiIndice = Number.isInteger(kept.pareiIndice) ? kept.pareiIndice : -1;

  outras.forEach((o) => {
    (o.topicos || []).forEach((t2) => { if (topicos.indexOf(t2) < 0) { topicos.push(t2); r.topicos++; } });
    Object.keys(o.notasArtigos || {}).forEach((n) => {
      const nova = o.notasArtigos[n];
      if (!notas[n]) { notas[n] = nova; r.notas++; }
      else if (notas[n].indexOf(nova) < 0) { notas[n] = notas[n] + "\n— " + nova; r.notas++; }
    });
    (o.notasTrechos || []).forEach((n) => {
      if (!trechos.some((x) => x.k === n.k)) { trechos.push(n); r.notas++; }
    });
    Object.keys(o.blocos || {}).forEach((b) => {
      if (!blocos[b] || String(o.blocos[b]) > String(blocos[b])) blocos[b] = o.blocos[b];
    });
    Object.keys(o.alteracoes || {}).forEach((n) => { if (!alteracoes[n]) alteracoes[n] = o.alteracoes[n]; });
    (o.repetidosOk || []).forEach((n) => { if (repetidosOk.indexOf(n) < 0) repetidosOk.push(n); });
    (o.anexos || []).forEach((a) => { if (!anexos.some((x) => x.titulo === a.titulo)) anexos.push(a); });
    String(o.apelido || "").split(/[\s/,]+/).filter(Boolean).forEach((s) => {
      if (siglas.map((x) => leiTxtChave(x)).indexOf(leiTxtChave(s)) < 0) siglas.push(s);
    });
    if (o.parei && (!parei || String(o.pareiEm || "") > String(pareiEm))) { parei = o.parei; pareiEm = o.pareiEm || ""; pareiIndice = Number.isInteger(o.pareiIndice) ? o.pareiIndice : -1; }
    ["fonte", "consultadaEm", "versao", "especie", "numero", "ano", "ente"].forEach((c) => {
      if (!kept[c] && o[c]) dados[c] = o[c];
    });
  });
  r.marcas = 0;
  Object.assign(dados, { topicos, notasArtigos: notas, notasTrechos: trechos, blocos,
    alteracoes, repetidosOk, apelido: siglas.join(" "), parei, pareiEm, pareiIndice });
  if (anexos.length) dados.anexos = anexos;
  const nova = leiGuardar(dados);
  if (!nova) return null;
  outras.forEach((o) => {
    leiSoltarPonteiros(o.id, kept.id);
    const tudo = leisLerTudo();
    delete tudo[o.id];
    leisGravarTudo(tudo);
  });
  try { reg("LEI", "leis mescladas", kept.nome + " ← " + outras.map((o) => o.nome).join(", ")); } catch (e) {}
  return { lei: nova, resumo: r };
}

/* =====================================================================
 * LACUNA PARCIAL: ESCONDER O QUE A BANCA TROCA
 *
 * O "recitar" esconde o artigo inteiro e mostra só o número e a ementa.
 * Isso testa se você lembra que existe um art. 150, não se você sabe o
 * que ele diz — e artigo inteiro escondido é um degrau alto demais: ou
 * se recita de cor, ou se desiste e abre.
 *
 * A banca não troca o artigo: ela troca UMA palavra. "Quinze" vira
 * "trinta", "vedado" vira "permitido", "somente" some, "poderá" vira
 * "deverá". Essas são as palavras que decidem a assertiva, e são elas
 * que esta função apaga.
 *
 * O QUE ENTRA NA LISTA, e por quê:
 *   - NUMERAIS e prazos: é a troca mais comum e a mais fácil de não
 *     notar relendo.
 *   - MODAIS (poderá/deverá, é vedado/é permitido): invertem a norma
 *     inteira sem mudar mais nada na frase.
 *   - RESTRITIVAS (salvo, exceto, somente, exclusivamente): tirar uma
 *     delas transforma exceção em regra.
 *   - QUÓRUNS e frações, pelo mesmo motivo dos numerais.
 *
 * O QUE NÃO ENTRA: substantivo comum, verbo qualquer, conectivo. Apagar
 * palavra à toa transforma o exercício em adivinhação de texto, que
 * treina paciência e não a norma.
 *
 * DEVOLVE PEDAÇOS, não HTML. Quem desenha decide o que é lacuna e o que
 * é texto — misturar marcação aqui obrigaria esta função a saber da
 * tela, e ela é a única parte disto que dá para testar sozinha.
 * ===================================================================== */
const LEI_MODAIS = ["poderá", "poderão", "deverá", "deverão", "devem",
  "pode", "podem", "vedado", "vedada", "proibido", "permitido",
  "permitida", "obrigatório", "obrigatória", "facultado", "facultada"];
const LEI_RESTRITIVAS = ["salvo", "exceto", "somente", "exclusivamente",
  "apenas", "ressalvado", "ressalvada", "inclusive", "não", "nunca",
  "sempre"];

/* Numeral por extenso: "quinze dias" é tão trocável quanto "15 dias", e
 * a lei brasileira escreve os prazos das duas formas. */
const LEI_NUMEROS = ["um", "uma", "dois", "duas", "três", "quatro", "cinco",
  "seis", "sete", "oito", "nove", "dez", "onze", "doze", "quinze", "vinte",
  "trinta", "quarenta", "sessenta", "noventa", "cem", "cento", "mil",
  "metade", "terço", "quarto", "quinto", "décimo", "dobro", "triplo"];

function leiNormalPalavra(p) {
  return String(p || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* Só as letras e dígitos: "quinze," e "quinze" são a mesma palavra, e
 * "20%." precisa manter o % para se reconhecer como percentual. */
function leiMiolo(p) {
  return leiNormalPalavra(p).replace(/^[^\wº°%]+|[^\wº°%]+$/g, "");
}

/* =====================================================================
 * O NÚMERO DO ARTIGO NÃO É UMA LACUNA — É O ENDEREÇO
 *
 * O DEFEITO, visto na EC 132/2023: o Art. 1º saiu com CEM lacunas, e
 * as primeiras eram "1º", "43.", "4º", "2º", "50.". A regra apagava
 * qualquer coisa com dígito, e num texto de emenda quase todo dígito é
 * REFERÊNCIA: "Art. 43", "§ 2º", "inciso III", "Lei 5.172".
 *
 * Apagar referência erra duas vezes. Primeiro porque a banca não troca
 * o endereço de um artigo por outro esperando que você tenha decorado a
 * numeração de cada remissão — ela troca o PRAZO, o PERCENTUAL, o
 * QUÓRUM. Segundo porque sem os números o texto deixa de ser legível:
 * "Art. ▁▁ ... § ▁▁" não é um exercício, é um texto quebrado, e cem
 * buracos num artigo só não se responde, se abandona.
 *
 * ENTÃO O DÍGITO SÓ VIRA LACUNA QUANDO É QUANTIDADE: seguido de uma
 * unidade (dias, meses, anos, vezes), escrito como percentual, ou
 * escrito como fração. E nunca quando vem logo depois de uma palavra de
 * endereço.
 * ===================================================================== */
const LEI_ENDERECO = ["art", "arts", "artigo", "artigos", "inciso", "incisos",
  "alinea", "alineas", "item", "itens", "paragrafo", "paragrafos",
  "lei", "leis", "decreto", "emenda", "ec", "sumula", "n", "no", "nos",
  "numero", "caput", "anexo", "capitulo", "secao", "titulo", "livro"];

/* As unidades que transformam um número em prazo ou medida. */
const LEI_UNIDADES = ["dia", "dias", "mes", "meses", "ano", "anos",
  "hora", "horas", "vez", "vezes", "por"];

function leiEhEndereco(p) {
  const m = leiMiolo(p);
  return LEI_ENDERECO.indexOf(m) >= 0 || m === "§" || /^§+$/.test(String(p || ""));
}

/* A decisão precisa da VIZINHANÇA, e é por isso que ela não cabe numa
 * função que olha uma palavra sozinha: "90" depois de "prazo de" e
 * antes de "dias" é prazo; "90" depois de "Art." é endereço. Foi a
 * palavra isolada que produziu as cem lacunas. */
function leiPalavraChaveNo(palavras, i) {
  const bruto = String(palavras[i] || "");
  const limpo = leiMiolo(bruto);
  if (!limpo) return false;

  if (/\d/.test(limpo)) {
    /* percentual e fração são sempre quantidade */
    if (/%/.test(bruto) || /^\d+\/\d+$/.test(limpo)) return true;
    /* logo depois de uma palavra de endereço: é remissão */
    const antes = palavras[i - 1];
    if (antes !== undefined && leiEhEndereco(antes)) return false;
    /* "1º", "2º", "43." soltos são numeração de dispositivo */
    if (/^\d+[º°]?$/.test(limpo) || /^[ivxlcdm]+$/.test(limpo)) {
      const dep = palavras[i + 1];
      /* só conta se uma unidade vier logo depois: "90 dias" */
      return dep !== undefined && LEI_UNIDADES.indexOf(leiMiolo(dep)) >= 0;
    }
    return true;                 /* "5.172-A", valores, algo com unidade junto */
  }

  const listas = LEI_MODAIS.concat(LEI_RESTRITIVAS, LEI_NUMEROS);
  if (listas.some((x) => leiNormalPalavra(x) === limpo)) {
    /* NUMERAL POR EXTENSO também precisa de unidade, pelo mesmo motivo:
     * "um" e "uma" são artigo indefinido em nove de cada dez frases, e
     * apagá-los não testa nada. */
    if (LEI_NUMEROS.some((x) => leiNormalPalavra(x) === limpo)) {
      const dep = palavras[i + 1];
      return dep !== undefined && LEI_UNIDADES.indexOf(leiMiolo(dep)) >= 0;
    }
    return true;
  }
  return false;
}

/* Mantida para quem só quer perguntar de uma palavra solta — e para o
 * teste que confere que acento e maiúscula não decidem nada. */
function leiPalavraChave(p) {
  return leiPalavraChaveNo([p], 0);
}

/* Devolve [{txt, lacuna}] — o texto em pedaços, marcando o que sumir.
 * Preserva os espaços originais: recompondo os pedaços na ordem, sai
 * exatamente o texto de entrada. */
function leiComLacunas(texto) {
  const bruto = String(texto || "");
  if (!bruto) return [];
  const cru = bruto.split(/(\s+)/).filter((x) => x !== "");
  /* só as palavras, para a vizinhança ser contada sem os espaços no meio */
  const idx = [];
  const palavras = [];
  cru.forEach((pedaco, k) => {
    if (/^\s+$/.test(pedaco)) return;
    idx.push(k);
    palavras.push(pedaco);
  });
  const marca = {};
  palavras.forEach((_, j) => {
    if (leiPalavraChaveNo(palavras, j)) marca[idx[j]] = true;
  });
  return cru.map((pedaco, k) => ({ txt: pedaco, lacuna: !!marca[k] }));
}

/* =====================================================================
 * O PONTILHADO DAS EMENDAS ENCOLHE NA LEITURA — E SÓ NA LEITURA
 *
 * Texto de emenda constitucional vem assim, copiado do Planalto:
 *
 *   "Art. 43. ................................................
 *    .............................. § 4º Sempre que possível..."
 *
 * São marcas de "o resto do dispositivo continua como está". No papel
 * do Diário Oficial fazem sentido; na tela, ocupam linhas inteiras de
 * nada entre dois trechos que importam, e foi o que apareceu no print
 * da EC 132/2023.
 *
 * ENCOLHE, NÃO APAGA. A reticência diz que ali HAVIA texto omitido pela
 * emenda; sumindo com ela, dois dispositivos distintos passariam a
 * parecer um parágrafo contínuo — o leitor juntaria o que a norma
 * separou. Viram três pontos, marcados para a tela poder apagá-los na
 * cor.
 *
 * E NÃO TOCA NO QUE ESTÁ GUARDADO. Esta função é de EXIBIÇÃO: o texto
 * salvo continua sendo o que foi colado do tribunal, letra por letra.
 * É a mesma decisão do negrito de markdown, e o motivo é o mesmo — uma
 * coisa é mostrar bem o que está guardado; outra é guardar o que o app
 * achou mais bonito. Quem copia o artigo para fora leva o original.
 * ===================================================================== */
function leiSemPontilhado(texto) {
  return String(texto || "")
    /* CINCO OU MAIS: quatro pontos ainda podem ser uma reticência com
     * um ponto final grudado, e trocar isso mexeria em texto normativo.
     * Emenda usa dezenas de cada vez. */
    .replace(/\.{5,}/g, "…")
    /* a linha que sobrou só com a reticência não precisa de linha
     * própria: ela vira o separador, no fim da linha anterior */
    .replace(/\n[ \t]*…[ \t]*(?=\n)/g, "\n…");
}

function leiQuantasLacunas(texto) {
  return leiComLacunas(texto).filter((x) => x.lacuna).length;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LEIS_CHAVE, LEI_ART_POR_BLOCO,
    leiNumNormal, leiNumOrdem, leiEmenta, leiArtigos, leiArtigo,
    leiArtigosEfetivos, leiArtigoAlterar, leiBlocos, leiEstruturaLei, leiCasarArtigo, leiNomeDaDivisao,
    leiMigrarBlocos, leisMigrarBlocosDe, leiDiagnosticarLei,
    leiCitacoes, leiIdentificar, leiSubstituirArtigo, leiInserirArtigo,
    leiTxtChave, leiEspecieChave, leiRotuloAntes, leiCitacoesNoTexto,
    leiRotuloChave, leiCasarRotulo, leiCandidatosDoRotulo, leiApelidoChave,
    leiSiglasDoNome, leiApelidoAdicionar,
    leiDuplicados, leiSinaisDoArtigo, leiPalavrasDiferentes, leiAplicarDuplicados,
    leiSepararColagem,
    leiComLacunas, leiQuantasLacunas, leiSemPontilhado,
    leisLerTudo, leisLista, leiId, leiDe, leiGuardar, leiApagar,
    leiNotaDe, leiNotaDeEm, leiNotaGuardar, leiNotaTrechoDe, leiNotaTrechoDeEm,
    leiNotaTrechoGuardar,
    leiLigar, leiDesligar, leisDoTopico, leisChaveComparavel,
    leiParar, leiProgresso, leiIndiceDoMarcador, leiOpcDaLei, leiAjusteRecusar, leiBlocoLido, leiBlocosLidos, leisMigrarDe,
    leisHojeISO,
    leiNumeroNorm, leiEspecieNorm, leiEnteDoTexto, leiChaveIdentidade, leiMesmaLei,
    leiAcharIgual, leiIdLivre, leiDuplicadasNaBiblioteca, leiMarcarDistintas,
    leiSoltarPonteiros, leiMesclar,
    leiEstruturaArtigo, leiLerRotulo, leiRomanoValor, leiValorRomano, leiRotuloDaUnidade,
    leiContextoDeLinhas, leiLerFaixaRevogada, leiAcharUnidades, leiConsumirEndereco,
    citVinculosLer, citVinculosGravar, citChave, citLerArtigos, citVinculoSalvar, citVinculoRemover, citVinculosAplicar,
    leiDataDaLei, leiCabecalhosAlteradora, leiMarcaDoTrecho, leiLerBlocoAlterado, leiMesclarFragmento,
    leiMontarArtigo, leiLerAlteradora, leiAlteradoraCitaLei, leiDataUltimaAlteracao, leiItensDaAlteradora,
    leiRomanoDoAnexo, leiAnexosDaAlteradora, leiOrdemDeAnexo, leiAnexoDaLei, leiItensDeAnexos, leiAplicarAnexo,
  };
}
