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
const LEI_RE_DIVISAO =
  /^[\s>*]*(LIVRO|PARTE|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O)\s+([IVXLCDM]+|[ÚU]NIC[AO]|\d{1,3}[ªº]?)\b[\s.:\-–—]*(.*)$/i;

/* Ordinal do artigo: "1º" e "1" são o MESMO artigo escrito de dois
 * jeitos. Sem normalizar, "onde parei" gravado como "1º" nunca mais
 * encontraria o artigo lido de um texto que escreve "1". */
function leiNumNormal(bruto) {
  return String(bruto || "")
    .replace(/\s+/g, "")
    .replace(/[ºo°ª]$/i, "")
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
function leiArtigos(texto) {
  const linhas = String(texto || "").split("\n");
  const artigos = [];
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

  linhas.forEach((linha, i) => {
    const d = linha.match(LEI_RE_DIVISAO);
    if (!d && esperaNome) {
      const cru = String(linha).trim();
      if (!cru) return;                      /* linha em branco: continua esperando */
      esperaNome = false;
      if (!LEI_RE_ARTIGO.test(linha) && cru.length <= 90 && divisao && !divisao.nome) {
        divisao.nome = cru.replace(/^[\s.:\-–—]+/, "");
        divisao.rotulo = (divisao.rotuloBase + " — " + divisao.nome).trim();
        return;
      }
    }
    if (d) {
      const tipo = d[1].toUpperCase()
        .replace("Í", "I").replace("Ç", "C").replace("Ã", "A");
      const base = (d[1] + " " + d[2]).replace(/\s+/g, " ").trim();
      divisao = {
        tipo,
        num: d[2].toUpperCase(),
        nome: String(d[3] || "").trim(),
        rotuloBase: base,
        rotulo: (base + (d[3] ? " — " + String(d[3]).trim() : "")).trim(),
        linha: i + 1,
      };
      esperaNome = !divisao.nome;
      /* a divisão também não é artigo: se o cabeçalho cair dentro do
       * texto do artigo anterior, o bloco seguinte herdaria o artigo
       * errado na hora de contar o progresso */
      atual = null;
      return;
    }

    const a = linha.match(LEI_RE_ARTIGO);
    if (a) {
      atual = {
        num: leiNumNormal(a[1]),
        numCru: String(a[1]).replace(/\s+/g, ""),
        ordem: leiNumOrdem(a[1]),
        linha: i + 1,
        corpo: linha.slice(a[0].length),
        linhas: [linha],
        divisao: divisao ? divisao.rotulo : "",
        divisaoTipo: divisao ? divisao.tipo : "",
      };
      artigos.push(atual);
      return;
    }

    if (atual) {
      atual.linhas.push(linha);
      if (String(linha).trim()) atual.corpo += "\n" + linha;
    }
  });

  return artigos.map((a, i) => ({
    num: a.num,
    numCru: a.numCru,
    ordem: a.ordem,
    indice: i,
    linha: a.linha,
    linhaFim: a.linha + a.linhas.length - 1,
    rotulo: "Art. " + a.numCru,
    ementa: leiEmenta(a.corpo),
    texto: a.linhas.join("\n").replace(/\s+$/, ""),
    corpo: a.corpo.trim(),
    divisao: a.divisao,
    divisaoTipo: a.divisaoTipo,
  }));
}

function leiArtigo(texto, num) {
  const alvo = leiNumNormal(num);
  return leiArtigos(texto).filter((a) => a.num === alvo)[0] || null;
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

function leiBlocos(texto) {
  const arts = leiArtigos(texto);
  if (!arts.length) return [];

  const temDivisao = arts.some((a) => a.divisao);
  const blocos = [];

  if (temDivisao) {
    arts.forEach((a) => {
      const nome = a.divisao || "(sem divisão)";
      const ult = blocos[blocos.length - 1];
      if (ult && ult.nome === nome) ult.artigos.push(a);
      else blocos.push({ nome, tipo: a.divisaoTipo || "", artigos: [a] });
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
        tipo: "",
        artigos: pedaco,
      });
    }
  }

  return blocos.map((b, i) => ({
    id: "b" + i,
    nome: b.nome,
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
  const s = String(texto || "");
  let m;
  LEI_RE_CITACAO.lastIndex = 0;
  while ((m = LEI_RE_CITACAO.exec(s)) !== null) {
    const num = leiNumNormal(m[1]);
    if (!num || num === "0") continue;
    /* o que vem logo depois: ", IV", ", § 2º", ", inciso II" */
    const depois = s.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const inc = depois.match(/^\s*,?\s*(?:inc(?:iso)?\.?\s*)?([IVXLC]{1,6})\b/);
    const par = depois.match(/^\s*,?\s*§\s*(\d{1,2}[ºo°]?)/);
    if (!vistos[num]) {
      vistos[num] = { num, ordem: leiNumOrdem(num), incisos: [], paragrafos: [], vezes: 0 };
      achados.push(vistos[num]);
    }
    vistos[num].vezes++;
    if (inc && vistos[num].incisos.indexOf(inc[1]) < 0) vistos[num].incisos.push(inc[1]);
    if (par && vistos[num].paragrafos.indexOf(par[1]) < 0) vistos[num].paragrafos.push(par[1]);
  }
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
    const ini = m.index;
    let fim = m.index + m[0].length;
    let resto = s.slice(fim);
    for (let k = 0; k < 8; k++) {          /* teto: endereço não é infinito */
      let achou = false;
      for (let i = 0; i < LEI_SUB.length; i++) {
        const t = resto.match(LEI_SUB[i]);
        if (t && t[0].length) {
          fim += t[0].length;
          resto = resto.slice(t[0].length);
          achou = true;
          break;
        }
      }
      if (!achou) break;
    }
    let rotulo = "";
    const p = resto.match(/^[\s,]*(?:(?:d[aoe]s?|de)\s+)?/i);
    const salto = p ? p[0].length : 0;
    const dep = resto.slice(salto);
    for (let j = 0; j < LEI_ROTULOS.length; j++) {
      const t2 = dep.match(LEI_ROTULOS[j]);
      if (t2) { rotulo = t2[0]; fim += salto + t2[0].length; break; }
    }
    if (!rotulo) rotulo = leiRotuloAntes(s.slice(Math.max(0, ini - 48), ini));
    out.push({
      ini, fim, num,
      numCru: String(m[1]).replace(/\s+/g, ""),
      rotulo: rotulo || "",
      texto: s.slice(ini, fim),
    });
    /* retomar DEPOIS do trecho inteiro: senão a lei que acabou de ser
     * consumida seria lida de novo como início de outra citação */
    re.lastIndex = fim > m.index ? fim : m.index + 1;
  }
  return out;
}

function leiRotuloChave(rotulo) {
  const s = leiTxtChave(rotulo);
  if (/^(cf\b|cf\/|crfb|constitui)/.test(s)) {
    return { especie: "constituicao", numero: "", sigla: "" };
  }
  const especie = leiEspecieChave(
    /^lc\b/.test(s) ? "complementar" : /^ec\b/.test(s) ? "emenda" : s);
  const m = s.match(/(\d[\d.]*)/);
  const numero = m ? m[1].replace(/[.]/g, "") : "";
  if (!especie && !numero) return { especie: "", numero: "", sigla: s.toUpperCase() };
  return { especie, numero, sigla: "" };
}

/* CASAR O RÓTULO COM A BIBLIOTECA.
 *
 * DEVOLVE null QUANDO HÁ DÚVIDA — zero candidatos ou mais de um. É a
 * decisão central deste arquivo: abrir a lei errada em silêncio é pior
 * que não abrir nada, porque a pessoa confere o artigo, vê que bate, e
 * guarda na cabeça uma regra que não é a que caiu na prova. Com null,
 * quem desenha abre a modal de vincular e a escolha volta para as mãos
 * de quem sabe. */
function leiCasarRotulo(rotulo, lista) {
  const alvo = leiRotuloChave(rotulo);
  const ls = lista || leisLista();
  let cand = [];
  if (alvo.especie === "constituicao") {
    cand = ls.filter((l) =>
      /constitui/.test(leiTxtChave(l.especie) + " " + leiTxtChave(l.nome))
      || /^(cf|crfb)/.test(leiTxtChave(l.apelido)));
  } else if (alvo.sigla) {
    /* a sigla casa pelo APELIDO, que é campo que a pessoa preencheu de
     * propósito — nunca pelo nome, senão "LEI" acharia todas */
    const sg = leiTxtChave(alvo.sigla);
    cand = ls.filter((l) => leiTxtChave(l.apelido).split(/[\s/,]+/).indexOf(sg) >= 0);
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
    /^[\s*#>_-]*(LEI|LEI\s+COMPLEMENTAR|DECRETO[\s-]?LEI|DECRETO|EMENDA\s+CONSTITUCIONAL|MEDIDA\s+PROVIS[ÓO]RIA)\s*(?:N?[ºo°.]?\s*)?([\d.]{3,9})(?:\s*,?\s*DE\s+.{0,40}?(\d{4}))?/i;
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
function leiParar(id, numArtigo) {
  const r = leiDe(id);
  if (!r) return false;
  leiGuardar({ id, parei: leiNumNormal(numArtigo), pareiEm: new Date().toISOString() });
  try {
    reg("LEI", "marcador movido", (r.nome || id) + " · art. " + numArtigo);
  } catch (e) {}
  return true;
}

/* Quanto da lei já foi lido, medido em artigos até o marcador. É a
 * resposta honesta para "estou onde?" — 40 de 115 é uma frase que
 * significa alguma coisa; "li" e "não li" não são. */
function leiProgresso(id) {
  const r = leiDe(id);
  if (!r) return null;
  const arts = leiArtigos(r.texto);
  if (!arts.length) return { total: 0, lidos: 0, pct: 0, artigo: "" };
  const i = r.parei ? arts.findIndex((a) => a.num === r.parei) : -1;
  const lidos = i < 0 ? 0 : i + 1;
  return {
    total: arts.length,
    lidos,
    pct: Math.round((lidos / arts.length) * 100),
    artigo: r.parei || "",
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
    leiNumNormal, leiNumOrdem, leiEmenta, leiArtigos, leiArtigo, leiBlocos,
    leiCitacoes, leiIdentificar, leiSubstituirArtigo, leiInserirArtigo,
    leiTxtChave, leiEspecieChave, leiRotuloAntes, leiCitacoesNoTexto,
    leiRotuloChave, leiCasarRotulo,
    leiComLacunas, leiQuantasLacunas, leiSemPontilhado,
    leisLerTudo, leisLista, leiId, leiDe, leiGuardar, leiApagar,
    leiLigar, leiDesligar, leisDoTopico, leisChaveComparavel,
    leiParar, leiProgresso, leiBlocoLido, leiBlocosLidos, leisMigrarDe,
    leisHojeISO,
  };
}
