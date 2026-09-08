/* =====================================================================
 * JURISPRUDÊNCIA
 *
 * O quarto material de um tópico, ao lado do resumo, dos cartões, das
 * questões e da lei seca. Guarda o que os tribunais decidiram — e o que
 * se decora de uma decisão não é a decisão inteira: é a TESE, aquela
 * frase que a banca transcreve na assertiva.
 *
 * POR QUE NÃO É UMA LEI COM OUTRO NOME.
 *
 * A lei seca é um texto ARTICULADO e estável: dividida em artigos, lida
 * em ordem, e o marcador é "parei no art. 35". Um julgado não tem
 * artigos, não se lê em ordem, e o que importa dele cabe em três linhas.
 * Guardá-lo como lei obrigaria a inventar artigos onde não há, e o
 * leitor de lei — que existe para percorrer capítulos — mostraria uma
 * ementa como se fosse um código.
 *
 * E também não é uma questão: questão tem gabarito e se responde. Uma
 * tese se lê, se reconhece na prova e se revisa. São três verbos
 * diferentes, e o app já erra pouco justamente por não misturá-los.
 *
 * O QUE ELE FAZ DE DIFERENTE: colar uma ementa crua e sair com os
 * campos preenchidos. Quem estuda copia do sítio do tribunal um bloco
 * com "RE 574706 / PR - PARANÁ, Relator(a): Min. CÁRMEN LÚCIA,
 * Julgamento: 15/03/2017" e não deveria ter de redigitar nada disso.
 * ===================================================================== */

const JUR_CHAVE = "eac_juris";

/* Os tribunais que aparecem em edital de concurso. A lista é fechada de
 * propósito: reconhecer uma sigla qualquer de três letras encheria o
 * campo com lixo tirado do meio da ementa. */
const JUR_TRIBUNAIS = ["STF", "STJ", "TST", "TSE", "STM", "TCU", "TNU",
  "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", "CARF"];

/* DE QUAL TRIBUNAL É CADA CLASSE.
 *
 * "RE 574706" já diz que é do Supremo, e a página do tribunal nem
 * sempre repete a sigla no bloco que se copia — ela está no cabeçalho
 * do site, que fica de fora da seleção. Deduzir daqui poupa uma
 * digitação em quase todo julgado colado.
 *
 * É DEDUÇÃO, e por isso só vale quando a sigla não aparece no texto: o
 * que está escrito manda sempre. E só entram as classes que pertencem a
 * um tribunal só — "MS" e "HC" existem em todos, e chutar ali seria
 * inventar procedência. */
const JUR_CASA = {
  "RE": "STF", "ARE": "STF", "ADI": "STF", "ADC": "STF",
  "ADPF": "STF", "ADO": "STF", "Súmula Vinculante": "STF",
  "REsp": "STJ", "AREsp": "STJ", "EREsp": "STJ",
  "AgRg no REsp": "STJ", "AgRg no AREsp": "STJ",
  "AgInt no REsp": "STJ", "EDcl no REsp": "STJ",
  "RR": "TST", "AIRR": "TST", "E-RR": "TST",
};

/* As classes processuais que a banca cita pelo nome. Ordem importa: as
 * compostas antes das simples, senão "AgRg no REsp" vira "REsp" e o
 * agravo se perde. */
const JUR_CLASSES = [
  "Súmula Vinculante", "Súmula", "Tema", "Repercussão Geral",
  "AgRg no REsp", "AgRg no AREsp", "AgInt no REsp", "EDcl no REsp",
  "AgRg", "AgInt", "EDcl", "EREsp", "AREsp", "REsp", "RE", "ARE",
  "ADI", "ADC", "ADPF", "ADO", "RMS", "MS", "HC", "RHC", "MI", "Rcl",
  "IRDR", "IAC", "RR", "AIRR", "E-RR",
];

function jurLerTudo() {
  try {
    const o = JSON.parse(localStorage.getItem(JUR_CHAVE) || "{}");
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}

function jurGravarTudo(tudo) {
  jurEsquecerChaves();
  try {
    const s = JSON.stringify(tudo || {});
    if (typeof guardar === "function") return guardar(JUR_CHAVE, s) !== false;
    localStorage.setItem(JUR_CHAVE, s);
    return true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------------
 * QUAIS TÓPICOS TÊM JULGADO — UMA VEZ, NÃO UMA VEZ POR LINHA
 *
 * A estante de material pergunta "este tópico tem julgado?" para cada
 * linha da lista, e mais uma vez por tipo ao contar os filtros. Com
 * jurTem() isso seria um localStorage.getItem + JSON.parse por
 * pergunta: com 300 materiais e 4 tipos, mais de mil leituras da
 * gaveta inteira para desenhar uma tela.
 *
 * O cache é apagado por jurGravarTudo — ou seja, por TODA escrita, que
 * é o único jeito de o conjunto mudar. Cache que se invalida sozinho no
 * único ponto de escrita não tem como ficar velho; cache invalidado à
 * mão em cinco chamadores é onde nasce a lista que não atualiza.
 * ------------------------------------------------------------------ */
let jurChavesCache = null;
function jurEsquecerChaves() { jurChavesCache = null; }
function jurChavesComJulgado() {
  if (jurChavesCache) return jurChavesCache;
  const s = new Set();
  jurLista().forEach((j) => (j.topicos || []).forEach((c) => {
    const k = jurChaveComparavel(c);
    if (k) s.add(k);
  }));
  jurChavesCache = s;
  return s;
}

function jurLista() {
  const tudo = jurLerTudo();
  return Object.keys(tudo).map((k) => tudo[k])
    .sort((a, b) => String(b.tocado || "").localeCompare(String(a.tocado || "")));
}

/* A MESMA COMPARAÇÃO DE CHAVE DA LEI SECA.
 * Um acento de diferença entre o que o edital escreveu e o que ficou
 * gravado abriria duas gavetas para o mesmo tópico. */
function jurChaveComparavel(c) {
  return String(c || "").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function jurDoTopico(chave) {
  const alvo = jurChaveComparavel(chave);
  if (!alvo) return [];
  return jurLista().filter((j) =>
    (j.topicos || []).some((c) => jurChaveComparavel(c) === alvo));
}

function jurContarDoTopico(chave) { return jurDoTopico(chave).length; }
function jurTem(chave) { return jurDoTopico(chave).length > 0; }

/* ------------------------------------------------------------------
 * COLAR COM FORMATAÇÃO
 *
 * Recebe o bloco cru copiado do sítio do tribunal e devolve os campos
 * separados. Nada aqui é adivinhação sobre o CONTEÚDO — só leitura de
 * formatos que os tribunais escrevem sempre igual.
 *
 * O que não for reconhecido fica em branco, e o texto inteiro é sempre
 * preservado: um extrator que "limpa" o que não entendeu apaga
 * justamente o que era diferente, e diferente costuma ser importante.
 * ------------------------------------------------------------------ */
/* =====================================================================
 * JSON TAMBÉM SERVE — MAS NÃO É EXIGIDO
 *
 * Uma proposta era o "ler e preencher" passar a EXIGIR um JSON limpo.
 * Isso inverteria o valor do botão: hoje você copia da página do
 * tribunal e cola; exigindo JSON, seria copiar, pedir a uma IA que
 * converta, e só então colar — três passos onde havia um, e nenhum
 * deles possível sem chave de API.
 *
 * Mas JSON é ÓTIMO quando já se tem: vem sem ambiguidade, sem ruído de
 * diário oficial, com a data já normalizada. Então ele é aceito, e não
 * exigido. O extrator olha o texto: se for um objeto JSON com campos
 * que ele conhece, lê de lá; senão, faz o que sempre fez.
 *
 * OS DOIS NOMES DE CADA CAMPO. "data_julgamento" e "data", "tese_curta"
 * e "tese": quem gera o JSON é uma IA seguindo um exemplo, e exemplo
 * nunca é seguido à risca. Aceitar as duas grafias custa uma linha e
 * evita "não reconheci nada" num JSON quase certo.
 * ===================================================================== */
function jurDoJson(bruto) {
  /* SEM GUARDA DE PRIMEIRO CARACTERE.
   *
   * Havia aqui um "só continue se começar com { ou [". A sabotagem
   * mostrou que ele nunca fazia diferença: uma ementa de tribunal não é
   * JSON válido, então o JSON.parse abaixo já a recusa, e um número ou
   * uma string solta reprovam no teste de objeto. Era otimização
   * disfarçada de proteção — e guarda que não guarda nada engana quem
   * lê depois. */
  const txt = String(bruto || "").trim();
  let o = null;
  try { o = JSON.parse(txt); } catch (e) { return null; }
  if (Array.isArray(o)) o = o[0];
  if (!o || typeof o !== "object") return null;
  const pega = function () {
    for (let i = 0; i < arguments.length; i++) {
      const v = o[arguments[i]];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    return "";
  };
  const achado = {
    tribunal: pega("tribunal", "corte").toUpperCase(),
    classe: pega("classe", "tipo"),
    numero: pega("numero", "n\u00famero", "processo"),
    data: pega("data_julgamento", "data", "julgamento"),
    relator: pega("relator", "relatora"),
    orgao: pega("orgao", "\u00f3rgao", "orgao_julgador"),
    tese: pega("tese_curta", "tese", "ementa"),
    resumo: pega("resumo_prova", "resumo", "resumo_curto", "explicacao"),
    /* A EMENTA LIMPA, quando a IA a devolveu. É ela que vai para o
     * campo do texto — nunca o JSON.
     *
     * O DEFEITO QUE ISTO CONSERTA: o "ver ementa completa" mostrava o
     * objeto JSON cru, com chaves e aspas. A colagem virava o texto
     * guardado sem ninguém perguntar se aquilo era leitura. JSON é
     * transporte; o que se lê é ementa. */
    texto: pega("ementa_limpa", "ementa", "texto", "inteiro_teor"),
    /* As etiquetas de assunto, quando vierem. */
    tags: (function () {
      const v = o.hashtags || o.tags || o.assuntos;
      /* SEM O "#" JÁ NA ENTRADA: guardar com e ler sem seriam duas
       * representações da mesma coisa, e a comparação erraria em
       * algum dos dois lados. */
      const limpa = (x) => String(x).replace(/^#+/, "").trim();
      if (Array.isArray(v)) return v.map(limpa).filter(Boolean);
      if (typeof v === "string") {
        return v.split(/[,;\s]+/).map(limpa).filter(Boolean);
      }
      return [];
    })(),
    categoria: pega("categoria", "classificacao").toUpperCase(),
    ano: "", tribunalDeduzido: false,
  };
  /* DATA SÓ SE FOR DATA: a caixa da tela é <input type="date"> e só
   * entende aaaa-mm-dd. Um ano solto vai para o campo do ano. */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(achado.data)) {
    const br = achado.data.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (br) {
      achado.data = br[3] + "-" + br[2].padStart(2, "0") + "-"
        + br[1].padStart(2, "0");
    } else {
      const so = achado.data.match(/^((?:19|20)\d{2})$/);
      achado.ano = so ? so[1] : "";
      achado.data = "";
    }
  }
  if (!achado.tribunal && achado.classe && JUR_CASA[achado.classe]) {
    achado.tribunal = JUR_CASA[achado.classe];
    achado.tribunalDeduzido = true;
  }
  if (!achado.categoria) achado.categoria = jurCategoria(achado.classe);
  /* SEM NADA RECONHECÍVEL não é um julgado: pode ser qualquer outro
   * objeto colado por engano, e fingir que entendeu seria pior do que
   * cair no extrator de texto. */
  if (!achado.classe && !achado.numero && !achado.tese) return null;
  return achado;
}

/* =====================================================================
 * AS ETIQUETAS DE ASSUNTO
 *
 * "#dação em pagamento", "#licitação". Elas cruzam julgados de tópicos
 * diferentes: a mesma etiqueta liga uma ADI do Supremo estudada em
 * Tributário a um repetitivo do STJ estudado em Administrativo — o que
 * a árvore do edital, por ser uma árvore, não consegue fazer.
 *
 * GUARDADAS SEM O "#" e comparadas sem acento e sem caixa, pelo mesmo
 * motivo das chaves de tópico: "#Licitação" e "#licitacao" são a mesma
 * etiqueta, e duas grafias fariam duas listas.
 * ===================================================================== */
function jurTagNormal(t2) {
  return String(t2 || "").replace(/^#+/, "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

function jurTagsDe(j) {
  return ((j && j.tags) || []).map((x) => String(x).replace(/^#+/, "").trim())
    .filter(Boolean);
}

/* Todas as etiquetas que existem, com quantos julgados cada uma tem. */
function jurTagsTodas() {
  const c = {};
  jurLista().forEach((j) => {
    jurTagsDe(j).forEach((t2) => {
      const k = jurTagNormal(t2);
      if (!k) return;
      if (!c[k]) c[k] = { nome: t2, chave: k, n: 0 };
      c[k].n++;
    });
  });
  return Object.keys(c).map((k) => c[k]).sort((a, b) => b.n - a.n
    || a.nome.localeCompare(b.nome));
}

function jurPorTag(tag) {
  const alvo = jurTagNormal(tag);
  if (!alvo) return [];
  return jurLista().filter((j) =>
    jurTagsDe(j).some((x) => jurTagNormal(x) === alvo));
}

/* =====================================================================
 * A CATEGORIA — o que muda o jeito de estudar
 *
 * Não é enfeite: súmula vinculante se decora literal, tema repetitivo
 * se decora pela tese, e um acórdão isolado se lê pelo raciocínio. O
 * selo diz qual dos três está na sua frente antes de você abrir.
 *
 * DEDUZIDA DA CLASSE quando ninguém informou: a classe já carrega essa
 * informação, e pedir para digitá-la de novo é pedir o mesmo dado duas
 * vezes.
 * ===================================================================== */
const JUR_CATEGORIAS = {
  "S\u00famula Vinculante": "S\u00daMULA VINCULANTE",
  "S\u00famula": "S\u00daMULA",
  "Tema": "REPETITIVO",
  "Repercuss\u00e3o Geral": "REPERCUSS\u00c3O GERAL",
  "ADI": "CONTROLE CONCENTRADO",
  "ADC": "CONTROLE CONCENTRADO",
  "ADPF": "CONTROLE CONCENTRADO",
  "ADO": "CONTROLE CONCENTRADO",
};

function jurCategoria(classe) {
  const c = String(classe || "").trim();
  return c ? (JUR_CATEGORIAS[c] || "") : "";
}

function jurIdentificar(txt) {
  const bruto = String(txt || "");
  const achado = { tribunal: "", classe: "", numero: "", data: "",
                   relator: "", orgao: "", tese: "", ano: "", categoria: "",
                   tribunalDeduzido: false };
  if (!bruto.trim()) return achado;
  /* JSON PRIMEIRO, quando for JSON: o resto do extrator trabalha com
   * texto de página de tribunal e não teria o que fazer com chaves. */
  const doJson = jurDoJson(bruto);
  if (doJson) return doJson;

  /* TRIBUNAL: sigla isolada, não pedaço de palavra. "STF" dentro de
   * "MANIFESTO" não é tribunal nenhum. */
  const tri = JUR_TRIBUNAIS.filter((s) =>
    new RegExp("(^|[^A-Za-z])" + s + "([^A-Za-z0-9]|$)").test(bruto))[0];
  if (tri) achado.tribunal = tri;

  /* CLASSE E NÚMERO juntos: é o par que identifica o julgado, e separá-los
   * em duas buscas independentes casaria a classe de uma citação com o
   * número de outra. */
  for (let i = 0; i < JUR_CLASSES.length; i++) {
    const c = JUR_CLASSES[i];
    const re = new RegExp("(^|[^A-Za-zÀ-ú])"
      + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
      + "\\s*(?:n?[º°.]?\\s*)?([\\d][\\d.\\-/]*)", "i");
    const m = bruto.match(re);
    if (m) {
      achado.classe = c;
      /* o "/PR" do fim é o estado, não parte do número */
      achado.numero = String(m[2]).replace(/[.\-/]+$/, "");
      break;
    }
  }

  /* A CASA DA CLASSE, quando a sigla não está escrita. O que aparece no
   * texto tem precedência: dedução não corrige ninguém. */
  if (!achado.tribunal && achado.classe && JUR_CASA[achado.classe]) {
    achado.tribunal = JUR_CASA[achado.classe];
    achado.tribunalDeduzido = true;
  }

  /* DATA DE JULGAMENTO. "Julgamento: 15/03/2017", "j. 15.03.2017",
   * "DJe 02/10/2017" — e a primeira data do bloco quando nenhuma delas
   * aparece rotulada. */
  const dRot = bruto.match(
    /(?:julgamento|julgado em|j\.|DJe|DJ)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  const dQualquer = bruto.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
  const data = (dRot && dRot[1]) || (dQualquer && dQualquer[1]) || "";
  if (data) {
    const p = data.split(/[./-]/);
    const ano = p[2].length === 2 ? "20" + p[2] : p[2];
    achado.data = ano + "-" + String(p[1]).padStart(2, "0")
      + "-" + String(p[0]).padStart(2, "0");
  } else {
    /* SÓ O ANO, quando é só o que o texto diz.
     *
     * Muito texto de estudo cita "no julgamento da ADI 2405, em 2019" —
     * sem dia nem mês. A caixa de data pede dd/mm/aaaa e não aceita um
     * ano sozinho, então antes isto virava campo vazio e a pessoa não
     * ficava sabendo que havia um ano ali. Ele fica guardado à parte, e
     * a tela diz "2019 (só o ano)". */
    const anoSo = bruto.match(/\b(?:em|de|ano de)\s+((?:19|20)\d{2})\b/i)
      || bruto.match(/\b((?:19|20)\d{2})\b/);
    if (anoSo) achado.ano = anoSo[1];
  }

  const rel = bruto.match(/Relator(?:\(a\))?\s*:?\s*(?:Min(?:istro|istra)?\.?\s*)?([^\n,;]{3,60})/i);
  if (rel) achado.relator = rel[1].trim();

  const org = bruto.match(/\b(Tribunal Pleno|Plenário|Corte Especial|Órgão Especial|Primeira Turma|Segunda Turma|Terceira Turma|Quarta Turma|Quinta Turma|Sexta Turma|Primeira Seção|Segunda Seção|Terceira Seção|[12]ª\s*Turma|[12]ª\s*Seção)\b/i);
  if (org) achado.orgao = org[1].trim();

  /* A TESE é o que se decora, e quase sempre está numa linha que começa
   * com "Tese:" ou dentro do bloco de ementa. Sem marcação nenhuma,
   * sugere-se a primeira frase longa — que quem cola confere e corrige,
   * porque é o campo que vai ser lido na revisão. */
  /* AS QUEBRAS DE LINHA SÃO PRESERVADAS ATÉ A LIMPEZA.
   *
   * Antes o texto era achatado com \s+ ANTES de tirar a marcação, e aí
   * "### 1." deixava de estar em início de linha: a regra de título,
   * que é ancorada em ^, não pegava mais nada e o "###" chegava inteiro
   * na tese. Quem colapsa é jurSemMarcacao, no fim. */
  const tRot = bruto.match(/(?:^|\n)\s*(?:tese|ementa)\s*:?\s*([\s\S]{20,600}?)(?:\n\s*\n|$)/i);
  if (tRot) achado.tese = tRot[1];
  else {
    const frase = bruto.split(/\n\s*\n/).map((x) => x.trim())
      .filter((x) => x.replace(/\s+/g, " ").length >= 40)[0];
    if (frase) achado.tese = frase.slice(0, 900);
  }
  /* A TESE VAI SEM MARCAÇÃO DE MARKDOWN.
   *
   * Quem cola de uma resposta de IA ou de um material de estudo traz
   * "**ADI 2405/RS**" e "### 1." junto. O app não desenha markdown na
   * citação da tese: os asteriscos apareciam LITERALMENTE na tela, em
   * texto que se vai reler dezenas de vezes até a prova.
   *
   * Só a TESE é limpa. O texto colado inteiro fica como veio — é a
   * regra que este arquivo tem desde o começo: o extrator não joga fora
   * o que não entendeu. */
  achado.tese = jurSemMarcacao(achado.tese).slice(0, 600);
  achado.categoria = jurCategoria(achado.classe);
  return achado;
}

/* Tira o que é marcação de texto, mantendo o que é texto. Não usa o
 * limpador da dica porque aquele preserva quebras de linha e marcadores
 * de lista, que numa tese de três linhas viram sujeira. */
function jurSemMarcacao(txt) {
  return String(txt || "")
    .replace(/^#{1,6}\s+/gm, "")            /* ### título */
    .replace(/\*\*([^*]+)\*\*/g, "$1")      /* **negrito** */
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")  /* *itálico* */
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")          /* marcador de lista */
    .replace(/\s+/g, " ")
    .trim();
}

/* O TÍTULO CURTO, para caber numa linha de lista. */
function jurTitulo(j) {
  if (!j) return "";
  const partes = [j.tribunal, j.classe, j.numero].filter(Boolean);
  if (partes.length) return partes.join(" ");
  return String(j.tese || j.texto || "").replace(/\s+/g, " ").slice(0, 60)
    || "(sem identificação)";
}

function jurId(j) {
  const base = jurChaveComparavel(jurTitulo(j)).replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || "jur") + "-" + Math.random().toString(36).slice(2, 7);
}

/* Grava um julgado. Sem id, cria; com id, atualiza. */
function jurGravar(dados) {
  if (!dados) return null;
  const tudo = jurLerTudo();
  const id = dados.id || jurId(dados);
  const antigo = tudo[id] || {};
  const r = Object.assign({
    id, tribunal: "", classe: "", numero: "", orgao: "", relator: "",
    data: "", tese: "", texto: "", fonte: "", topicos: [], tags: [],
    /* O RESUMO É UM CAMPO À PARTE, e essa separação é o ponto.
     *
     * A tese é a proposição jurídica como ela é — a frase que se
     * reconhece na prova, e que não pode ser parafraseada por ninguém:
     * uma reescrita que troca "lei complementar" por "lei ordinária",
     * ou que perde um "não", vira resposta errada memorizada. O resumo
     * é a explicação, e explicação pode ser reescrita à vontade.
     *
     * Por isso a IA preenche o RESUMO, e nunca reescreve a tese em cima
     * dela. Foi a diferença entre acrescentar e substituir. */
    resumo: "", categoria: "",
    criado: new Date().toISOString(),
  }, antigo, dados, { id, tocado: new Date().toISOString() });
  r.topicos = (r.topicos || []).filter((x, i, a) => x && a.indexOf(x) === i);
  tudo[id] = r;
  if (!jurGravarTudo(tudo)) return null;
  return r;
}

function jurDe(id) { return jurLerTudo()[String(id)] || null; }

function jurApagar(id) {
  const tudo = jurLerTudo();
  if (!tudo[String(id)]) return false;
  delete tudo[String(id)];
  return jurGravarTudo(tudo);
}

/* LIGAR E DESLIGAR DE UM TÓPICO.
 * O mesmo julgado serve a vários tópicos e a vários editais — uma tese
 * de repercussão geral encosta em meia dúzia de assuntos. Por isso a
 * ligação é uma lista, e desligar de um tópico não apaga o julgado. */
/* O RÓTULO VIAJA JUNTO COM O VÍNCULO.
 *
 * A chave é "direito tributário›princípios" — minúscula, com "›" no
 * meio, porque é feita para COMPARAR, não para ler. Enquanto o julgado
 * só aparecia dentro do tópico, isso bastava: o nome bonito estava no
 * cabeçalho da gaveta.
 *
 * Agora que o julgado entra na estante de material, ele precisa dizer
 * de qual disciplina e de qual tópico é — e num tópico que NÃO tem
 * resumo não existe registro nenhum de onde tirar o nome com maiúscula
 * e acento. Reconstruir a partir da chave devolveria "direito
 * tributário" na lista, ao lado de "Direito Tributário" escrito
 * certo: duas linhas para a mesma disciplina.
 *
 * Então o nome é guardado NA HORA DO VÍNCULO, que é o único momento em
 * que ele existe sem ambiguidade. Julgado antigo não tem o mapa, e
 * para esse o app volta a partir da chave — pior, mas nunca errado. */
function jurLigar(id, chave, disciplina, topico) {
  const j = jurDe(id);
  if (!j || !chave) return false;
  const alvo = jurChaveComparavel(chave);
  if (disciplina || topico) {
    j.rotulos = Object.assign({}, j.rotulos || {});
    j.rotulos[alvo] = { d: disciplina || "", t: topico || "" };
  }
  if ((j.topicos || []).some((c) => jurChaveComparavel(c) === alvo)) {
    /* já ligado: mas se o rótulo chegou agora, ele vale a gravação */
    return (disciplina || topico) ? !!jurGravar(j) : true;
  }
  j.topicos = (j.topicos || []).concat([chave]);
  return !!jurGravar(j);
}

/* O nome legível de um tópico, do mapa quando existe e da chave quando
 * não. Um só lugar decide isso — dois lugares reconstruindo a chave de
 * jeitos parecidos é como nascem as duas linhas para o mesmo tópico. */
function jurRotuloDe(j, chave) {
  const alvo = jurChaveComparavel(chave);
  const r = (j && j.rotulos && j.rotulos[alvo]) || null;
  if (r && (r.d || r.t)) return { disciplina: r.d || "", topico: r.t || "" };
  const p = String(chave || "").split("›");
  return { disciplina: (p[0] || "").trim(), topico: (p.slice(1).join("›")).trim() };
}

function jurDesligar(id, chave) {
  const j = jurDe(id);
  if (!j) return false;
  const alvo = jurChaveComparavel(chave);
  j.topicos = (j.topicos || []).filter((c) => jurChaveComparavel(c) !== alvo);
  return !!jurGravar(j);
}

/* O TEXTO PARA REVISÃO, em uma linha por julgado. */
function jurTexto(lista) {
  return (lista || []).map((j) => {
    const cab = jurTitulo(j)
      + (j.data ? " · " + String(j.data).split("-").reverse().join("/") : "")
      + (j.orgao ? " · " + j.orgao : "");
    return cab + (j.tese ? "\n" + j.tese : "");
  }).join("\n\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    JUR_CHAVE, JUR_TRIBUNAIS, JUR_CLASSES, JUR_CASA,
    jurLerTudo, jurGravarTudo, jurLista, jurChaveComparavel,
    jurDoTopico, jurContarDoTopico, jurTem, jurIdentificar, jurTitulo,
    jurGravar, jurDe, jurApagar, jurLigar, jurDesligar, jurTexto,
  };
}

/* =====================================================================
 * O MESMO JULGADO GUARDADO DUAS VEZES
 *
 * Aconteceu no uso real: "ADI 2405" e "ADI 2.405" viraram dois cartões
 * na mesma tela. São o mesmo processo — o ponto que os separou foi o
 * ponto de milhar.
 *
 * DUAS PERGUNTAS DIFERENTES, E SÓ UMA PRECISA DE IA:
 *
 *  · MESMO PROCESSO? É aritmética. Tribunal, classe e número, com o
 *    número sem pontuação. Não há dúvida a resolver, e mandar isto para
 *    uma IA seria pagar por uma resposta que a comparação de strings dá
 *    com certeza.
 *  · MESMA COISA, PROCESSOS DIFERENTES? Aí sim: dois julgados sem
 *    número, ou dois números distintos que decidiram a mesma tese, ou o
 *    acórdão e a súmula que dele nasceu. Isso é leitura, e é o que o
 *    prompt vai perguntar.
 * ===================================================================== */
function jurSoDigitos(s) { return String(s || "").replace(/\D+/g, ""); }

/* A identidade de PROCESSO. Vazia quando não há classe nem número — e
 * vazia não casa com vazia, senão todo julgado sem número seria
 * "repetido" de todos os outros sem número. */
function jurIdentidade(j) {
  if (!j) return "";
  const num = jurSoDigitos(j.numero);
  const cls = String(j.classe || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!num || !cls) return "";
  return [String(j.tribunal || "").toUpperCase().trim(), cls, num].join("|");
}

/* Os outros julgados que são o MESMO PROCESSO deste. */
function jurIguaisA(j, lista) {
  const id = jurIdentidade(j);
  if (!id) return [];
  return (lista || jurLista()).filter((x) =>
    x && x.id !== (j && j.id) && jurIdentidade(x) === id);
}

/* Os pares repetidos de um tópico, para a tela oferecer a união. */
function jurRepetidosDoTopico(chave) {
  const lista = jurDoTopico(chave);
  const vistos = {};
  const pares = [];
  lista.forEach((j) => {
    const id = jurIdentidade(j);
    if (!id) return;
    if (vistos[id]) pares.push({ fica: vistos[id], vai: j, id });
    else vistos[id] = j;
  });
  return pares;
}

/* =====================================================================
 * UNIR DOIS JULGADOS
 *
 * O QUE NÃO SE PERDE: nada. A tese que sai vai para o fim do texto do
 * que fica, com uma linha dizendo de onde veio, e os tópicos dos dois
 * se somam. Este arquivo inteiro é construído sobre "o extrator não
 * joga fora o que não entendeu" — unir não pode ser a exceção.
 *
 * QUEM FICA é quem tem mais matéria: a tese mais longa costuma ser a
 * que a pessoa escreveu com cuidado, e a curta a que veio de um resumo
 * automático. Empatado, fica o mais antigo, que é o que já está
 * apontado pelos outros tópicos.
 * ===================================================================== */
function jurUnir(idFica, idVai) {
  /* MEXE NO OBJETO GUARDADO, e não na cópia que jurDe devolve: a leitura
   * é feita do localStorage a cada chamada, então alterar o retorno de
   * jurDe muda uma cópia que ninguém mais vai ver. */
  const tudo = jurLerTudo();
  const a = tudo[String(idFica)], b = tudo[String(idVai)];
  if (!a || !b || a.id === b.id) return null;
  const tA = String(a.tese || "").trim(), tB = String(b.tese || "").trim();
  const extra = [];
  if (tB && jurChaveComparavel(tB) !== jurChaveComparavel(tA)) {
    extra.push(t("jur_unir_veio", { t: jurTitulo(b) }));
    extra.push(tB);
  }
  const txB = String(b.texto || "").trim();
  if (txB && txB !== String(a.texto || "").trim()) {
    extra.push(t("jur_unir_ementa", { t: jurTitulo(b) }));
    extra.push(txB);
  }
  if (extra.length) {
    a.texto = String(a.texto || "").replace(/\s*$/, "")
      + (String(a.texto || "").trim() ? "\n\n" : "") + extra.join("\n");
  }
  /* os campos que faltavam de um lado vêm do outro: unir tem de somar */
  ["tribunal", "classe", "numero", "data", "orgao", "relator", "fonte"]
    .forEach((k) => { if (!String(a[k] || "").trim() && b[k]) a[k] = b[k]; });
  (b.topicos || []).forEach((c) => {
    if (!(a.topicos || []).some((x) => jurChaveComparavel(x) === jurChaveComparavel(c))) {
      a.topicos = (a.topicos || []).concat([c]);
    }
  });
  a.tocado = new Date().toISOString();
  delete tudo[String(b.id)];
  if (!jurGravarTudo(tudo)) return null;
  return a;
}

/* =====================================================================
 * O PROMPT QUE PREENCHE OS CAMPOS
 *
 * O extrator de texto acerta o que está escrito com rótulo — classe,
 * número, data, órgão. O que ele não sabe fazer é ler trinta linhas de
 * ementa e dizer, em três, o que aquilo decidiu. Isso é leitura, e é
 * para isso que a IA serve aqui.
 *
 * A REGRA QUE ESTE PROMPT CARREGA, e que é o motivo de ele existir na
 * forma em que está: a IA preenche o RESUMO e NÃO reescreve a tese.
 * Tese é proposição jurídica — uma paráfrase que troca "lei
 * complementar" por "lei ordinária", ou que perde um "não", vira
 * resposta errada memorizada, e memorizada com a confiança de quem
 * copiou do tribunal. O resumo é explicação, e explicação pode ser
 * escrita com outras palavras sem custo nenhum.
 *
 * A RESPOSTA VEM EM JSON porque o app já sabe lê-lo (jurDoJson), e
 * porque campo nomeado não se confunde: "tese" no lugar de "resumo" é
 * um erro que um formato livre esconderia.
 * ===================================================================== */
function jurPromptPreencher(texto, tituloTopico) {
  const t2 = String(texto || "").trim();
  if (!t2) return "";
  return t("jur_prompt_preencher", {
    tp: tituloTopico || "", txt: t2.slice(0, 6000) });
}

/* =====================================================================
 * O JULGADO JÁ GUARDADO, INCOMPLETO
 *
 * O prompt de cima serve à ENTRADA: existe uma ementa colada, e a IA a
 * lê. Depois de guardado o cenário é outro e mais comum do que parece —
 * a ementa foi colada pela metade, ou nem foi colada (a tese foi
 * escrita à mão), e sobraram seis campos vazios: classe, data, órgão,
 * fonte, e nenhum assunto.
 *
 * Isso não é cosmético. Sem classe e número o julgado não se identifica
 * na busca; sem assunto ele não se cruza com os outros; sem data não se
 * sabe se foi superado. E, principalmente: o texto guardado pode estar
 * torto — o resumo desta base tem "tetos teto diferenciados", que
 * entrou na gravação e ninguém releu.
 *
 * DUAS TAREFAS NUM PEDIDO SÓ, e é de propósito. "Complete o que falta"
 * e "confira o que está escrito" olham o mesmo texto; separá-los em
 * dois botões faria a pessoa colar a mesma ementa duas vezes numa IA.
 *
 * O QUE ELE NUNCA PEDE: reescrever a tese. A regra é a mesma do outro
 * prompt e pelo mesmo motivo — tese parafraseada é resposta errada
 * decorada. Erro NA TESE é APONTADO, com o trecho e o problema, para
 * quem estuda decidir; nunca corrigido por conta própria.
 * ===================================================================== */
const JUR_CAMPOS_META = [
  { k: "tribunal", i: "jur_f_tribunal" },
  { k: "classe", i: "jur_f_classe" },
  { k: "numero", i: "jur_f_numero" },
  { k: "data", i: "jur_f_data" },
  { k: "orgao", i: "jur_f_orgao" },
  { k: "relator", i: "jur_f_relator" },
  { k: "fonte", i: "jur_f_fonte" },
  { k: "resumo", i: "jur_f_resumo" },
];

/* Quais campos estão vazios. "tags" entra pela contagem e não pelo
 * valor: uma lista vazia é falsy só depois de se olhar o comprimento —
 * e `[]` sozinho é verdadeiro, que é como uma checagem descuidada
 * concluiria que o julgado tem assunto. */
function jurFaltando(j) {
  if (!j) return [];
  const falta = JUR_CAMPOS_META
    .filter((c) => !String(j[c.k] || "").trim())
    .map((c) => c.k);
  if (!(jurTagsDe(j) || []).length) falta.push("tags");
  return falta;
}

function jurPromptCompletar(j, tituloTopico) {
  if (!j) return "";
  const falta = jurFaltando(j);
  const tem = JUR_CAMPOS_META.filter((c) => String(j[c.k] || "").trim())
    .map((c) => t(c.i) + ": " + String(j[c.k]).trim());
  const tags = jurTagsDe(j) || [];
  if (tags.length) tem.push(t("jur_f_tags") + ": " + tags.join(", "));
  return t("jur_prompt_completar", {
    tp: tituloTopico || (j.topicos || [])[0] || "",
    tit: jurTitulo(j),
    tem: tem.length ? tem.join("\n") : t("jur_nada_preenchido"),
    falta: falta.length ? falta.join(", ") : t("jur_nada_faltando"),
    tese: String(j.tese || "").trim() || "(vazia)",
    resumo: String(j.resumo || "").trim() || "(vazio)",
    ementa: String(j.texto || "").trim().slice(0, 4000) || "(não guardei a ementa)",
  });
}

/* =====================================================================
 * APLICAR A RESPOSTA SEM APAGAR O QUE JÁ EXISTIA
 *
 * Esta é a metade perigosa. Uma IA que devolve o objeto inteiro — com
 * os campos que ela leu E os que ela deduziu — sobrescreveria a tese
 * conferida à mão por uma transcrição aproximada, e o estrago só
 * apareceria na prova.
 *
 * Então a regra é dura e vale para TODOS os campos: campo com conteúdo
 * fica como está. O que a resposta traz para um campo já preenchido
 * não é gravado — vira aviso, e quem estuda decide.
 *
 * Devolve { mudou:[...], ignorados:[...] } para a tela poder dizer o
 * que aconteceu. Gravação silenciosa aqui seria pedir fé.
 * ===================================================================== */
/* =====================================================================
 * O JSON QUE VEM COM ROUPA EM VOLTA
 *
 * QUATRO RECUSAS SEGUIDAS NO REGISTRO DO USUÁRIO, todas "não era JSON",
 * e o objeto estava lá. O que vem de uma IA quase nunca vem limpo: vem
 * dentro de uma cerca de markdown (```json … ```), ou com uma frase de
 * cortesia antes ("Claro! Aqui está o JSON:"), ou com um parágrafo
 * depois. O prompt pede sem nada disso e as IAs desobedecem — todas,
 * o tempo todo.
 *
 * Recusar isso é fazer a pessoa editar texto à mão para agradar o
 * programa. O trabalho de achar as chaves é do app: tirar a cerca e
 * pegar do primeiro "{" ao último "}" resolve os três casos com duas
 * linhas.
 *
 * NÃO É "TENTAR CONSERTAR JSON QUEBRADO". Se o que está entre as chaves
 * não for JSON válido, continua sendo recusado — inventar vírgula que
 * falta produziria um objeto que ninguém escreveu, e campos errados
 * entrando calados num julgado é pior que uma recusa clara.
 * ===================================================================== */
function jurJsonDoTexto(bruto) {
  let t2 = String(bruto || "").trim();
  if (!t2) return null;
  /* a cerca de markdown, com ou sem a palavra "json" na abertura */
  t2 = t2.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
  const tenta = (x) => {
    try {
      const v = JSON.parse(x);
      return (v && typeof v === "object" && !Array.isArray(v)) ? v : null;
    } catch (e) { return null; }
  };
  const direto = tenta(t2);
  if (direto) return direto;
  /* do primeiro "{" ao último "}": cobre a frase antes e o parágrafo
   * depois de uma vez só */
  const a = t2.indexOf("{");
  const b = t2.lastIndexOf("}");
  if (a >= 0 && b > a) return tenta(t2.slice(a, b + 1));
  return null;
}

function jurCompletar(id, dados) {
  const j = jurDe(id);
  if (!j || !dados || typeof dados !== "object") {
    return { mudou: [], ignorados: [], ok: false };
  }
  const vindo = {
    tribunal: dados.tribunal, classe: dados.classe, numero: dados.numero,
    data: dados.data_julgamento || dados.data, orgao: dados.orgao,
    relator: dados.relator, fonte: dados.fonte, resumo: dados.resumo,
    categoria: dados.categoria,
  };
  const mudou = [], ignorados = [];
  const novo = {};
  Object.keys(vindo).forEach((k) => {
    const v = String(vindo[k] === undefined || vindo[k] === null ? "" : vindo[k]).trim();
    if (!v) return;
    if (String(j[k] || "").trim()) {
      /* só conta como conflito se for DIFERENTE: a IA repetir o que já
       * está lá é o caso comum, e anunciá-lo como "ignorei" faria a
       * pessoa procurar um problema que não existe */
      if (String(j[k]).trim() !== v) ignorados.push(k);
      return;
    }
    novo[k] = v;
    mudou.push(k);
  });
  /* ASSUNTOS SE SOMAM, não se substituem: são o único campo em que a
   * sugestão da IA e o que a pessoa escreveu podem conviver. */
  const sug = Array.isArray(dados.assuntos) ? dados.assuntos
    : (Array.isArray(dados.tags) ? dados.tags : []);
  if (sug.length) {
    const atuais = jurTagsDe(j) || [];
    const juntas = atuais.slice();
    sug.forEach((tg) => {
      const s = String(tg || "").trim();
      if (!s) return;
      if (!juntas.some((x) => jurTagNormal(x) === jurTagNormal(s))) juntas.push(s);
    });
    if (juntas.length > atuais.length) { novo.tags = juntas; mudou.push("tags"); }
  }
  /* A TESE NUNCA ENTRA AQUI. Nem vazia: uma tese "transcrita" por quem
   * não tem a ementa na frente é invenção, e inventada ela seria
   * decorada exatamente como se fosse do tribunal. */
  if (!mudou.length) return { mudou: [], ignorados, ok: true };
  novo.id = j.id;
  return { mudou, ignorados, ok: !!jurGravar(novo) };
}

/* =====================================================================
 * O PROMPT: "estes julgados dizem a mesma coisa?"
 *
 * Ele existe para o caso em que a aritmética não responde — dois
 * julgados sem número, números diferentes que decidiram a mesma tese, o
 * acórdão e a súmula que dele nasceu.
 *
 * ELE NÃO UNE NADA. Devolve uma leitura, e unir continua sendo um
 * toque seu num botão. É a mesma regra do resto do aplicativo: a IA
 * ordena e sugere, quem decide é quem estuda — inclusive porque uma
 * resposta errada aqui funde duas teses distintas num registro só, e
 * isso não se desfaz no dia da prova.
 * ===================================================================== */
function jurPromptComparar(lista) {
  const L = (lista || []).filter(Boolean);
  if (L.length < 2) return "";
  const blocos = L.map((j, i) => [
    "[" + (i + 1) + "] " + (jurTitulo(j) || t("jur_sem_titulo")),
    (j.data ? String(j.data).split("-").reverse().join("/") + " · " : "")
      + (j.orgao || ""),
    String(j.tese || j.texto || "").replace(/\s+/g, " ").slice(0, 900),
  ].filter((x) => String(x).trim()).join("\n"));
  return t("jur_prompt_texto", { n: L.length, blocos: blocos.join("\n\n") });
}

/* =====================================================================
 * O CONSERTO DO QUE JÁ ESTÁ GUARDADO
 *
 * Corrigir a ENTRADA não conserta o que entrou antes dela. Os julgados
 * salvos enquanto o defeito existia têm o objeto JSON gravado no campo
 * do texto — e é ele que o "ver ementa completa" mostra, com chaves e
 * aspas, e que o botão de copiar exporta.
 *
 * Isto roda uma vez, no arranque, e é DIFERENTE de reescrever a tela:
 * ali (o negrito do markdown) a decisão certa foi desenhar melhor e não
 * tocar no dado, porque o dado estava certo e só a exibição estava
 * feia. Aqui o dado está errado: JSON não é ementa. Uma coisa é mostrar
 * bem o que está guardado; outra é guardar o que não devia.
 *
 * O QUE ELE NUNCA FAZ: sobrescrever campo que já tem conteúdo. A tese e
 * o resumo são texto de estudo — se a pessoa corrigiu algum, a correção
 * dela vale mais que o JSON. Só campo VAZIO é preenchido, e o resto do
 * JSON é descartado depois que tudo o que ele tinha de útil saiu de lá.
 * ===================================================================== */
function jurEhJson(txt) {
  /* SEM GUARDA DE PRIMEIRO CARACTERE, pelo mesmo motivo de jurDoJson: o
   * JSON.parse já recusa uma ementa, e um número ou uma string solta
   * reprovam no teste de objeto. Guarda que não guarda nada engana quem
   * lê depois. */
  try {
    const o = JSON.parse(String(txt || "").trim());
    return !!o && typeof o === "object";
  } catch (e) { return false; }
}

function jurRepararJson() {
  const tudo = jurLerTudo();
  const ids = Object.keys(tudo);
  let consertados = 0;
  ids.forEach((id) => {
    const j = tudo[id];
    if (!j || !jurEhJson(j.texto)) return;
    const doJson = jurDoJson(j.texto);
    /* SEM CONSEGUIR LER, NÃO MEXE. Um JSON que o extrator não entende
     * pode ser outra coisa que alguém colou de propósito, e apagá-lo
     * seria destruir sem saber o quê. */
    if (!doJson) return;

    ["tribunal", "classe", "numero", "data", "orgao", "relator",
     "tese", "resumo", "categoria"].forEach((k) => {
      if (!String(j[k] || "").trim() && String(doJson[k] || "").trim()) {
        j[k] = doJson[k];
      }
    });
    if (!(j.tags || []).length && (doJson.tags || []).length) {
      j.tags = doJson.tags.slice();
    }
    /* e o texto vira a ementa limpa, ou nada */
    j.texto = String(doJson.texto || "").trim();
    consertados++;
  });
  if (consertados) {
    jurGravarTudo(tudo);
    try {
      reg("JURIS", "ementas em JSON consertadas",
          consertados + " julgado(s): o objeto JSON saiu do campo do "
          + "texto e o que faltava foi preenchido a partir dele");
    } catch (e) {}
  }
  return consertados;
}
