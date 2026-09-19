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
/* A RESPOSTA NOVA TEM DOIS BLOCOS: "do_texto" (o que o texto colado diz) e
 * "de_memoria" (o que a IA lembra). Achatar o primeiro por cima do nível
 * de cima deixa o leitor antigo — que só conhece campos soltos — servindo
 * às duas formas: uma resposta do prompt de antes continua sendo lida. */
function jurAchatar(o) {
  if (!o || typeof o !== "object") return {};
  const dt = (o.do_texto && typeof o.do_texto === "object") ? o.do_texto : null;
  return dt ? Object.assign({}, o, dt) : o;
}

/* O QUE A IA DISSE DE MEMÓRIA, só as chaves que o app sabe usar. Nunca vem
 * tese aqui: a tese é do texto ou é da pessoa. */
const JUR_CAMPOS_VERIFICAVEIS = ["tribunal", "classe", "numero", "data", "orgao",
  "relator", "fonte"];

function jurDeMemoria(o) {
  const m = (o && o.de_memoria && typeof o.de_memoria === "object") ? o.de_memoria : {};
  const pega = function () {
    for (let i = 0; i < arguments.length; i++) {
      const v = m[arguments[i]];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    return "";
  };
  return {
    tribunal: pega("tribunal").toUpperCase(), classe: pega("classe"),
    numero: pega("numero", "número"),
    data: pega("data_julgamento", "data"), orgao: pega("orgao", "órgao"),
    relator: pega("relator"), fonte: pega("fonte"),
  };
}

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
  const bruto0 = o;
  o = jurAchatar(o);
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
    fonte: pega("fonte", "onde_encontrei", "link", "url"),
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
    /* O QUE A IA DIZ SOBRE O PRÓPRIO TEXTO que recebeu — e o que lembra.
     * O app não confia em nenhum dos dois: ver jurVerificarNoTexto. */
    tipoDoTexto: pega("tipo_do_texto"),
    teseOficial: (typeof o.tese_e_transcricao_oficial === "boolean")
      ? o.tese_e_transcricao_oficial : null,
    ondeConferir: pega("onde_conferir"),
    identificacao: pega("identificacao"),
    deMemoria: jurDeMemoria(bruto0),
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
  const mem = achado.deMemoria;
  if (!achado.classe && !achado.numero && !achado.tese
      && !mem.classe && !mem.numero) return null;
  return achado;
}

/* =====================================================================
 * NÃO CONFIAR: CONFERIR NO TEXTO, MECANICAMENTE
 *
 * O CASO REAL. Pedi à IA que completasse data, órgão, relator e fonte da
 * Súmula Vinculante 29, dada só pelo título. Ela respondeu de memória —
 * e errou três dos quatro (a data era a da PUBLICAÇÃO, a fonte era outro
 * número do DJe, o "relator" era o presidente da sessão; súmula vinculante
 * nem tem relator). O app gravou tudo com a mesma cara de dado verificado.
 *
 * Pedir à IA que "não invente" é pedir por favor. O que funciona é um
 * teste que o app faz sozinho: o valor devolvido APARECE no texto que a
 * pessoa colou? Aparece → veio do texto (✓). Não aparece → a IA lembrou
 * ou supôs, e o campo fica marcado "a conferir" até alguém conferir na
 * fonte. Preencher continua permitido; o que não se permite é parecer
 * verificado sem estar.
 *
 * Sem texto nenhum de base, nada é verificável: tudo o que a IA trouxe
 * fica "a conferir". É o lado seguro do erro — custa um toque em
 * "conferi"; o contrário custa decorar uma data errada.
 * ===================================================================== */
const JUR_MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function jurSemAcento(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* o valor está no texto? Cada campo tem a sua régua: número e data têm
 * grafias, nome se compara sem acento e sem caixa. */
function jurValorNoTexto(campo, valor, base) {
  const v = String(valor || "").trim();
  const b = String(base || "");
  if (!v || !b.trim()) return false;
  const bn = jurSemAcento(b);
  if (campo === "data") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const dia = String(Number(m[3]));
    const ano = m[1];
    const re = new RegExp("(^|\\D)0?" + dia + "\\s*[./-]\\s*0?" + Number(m[2])
      + "\\s*[./-]\\s*" + ano + "(\\D|$)");
    if (re.test(b)) return true;
    const extenso = new RegExp("(^|\\D)0?" + dia + "\\s*(?:de|d[oa])?\\s*"
      + JUR_MESES[Number(m[2]) - 1] + "\\s*(?:de|do)?\\s*" + ano);
    return extenso.test(bn);
  }
  if (campo === "numero") {
    const d = v.replace(/\D+/g, "");
    if (!d) return bn.indexOf(jurSemAcento(v)) >= 0;
    /* por FICHAS numéricas do texto ("574.706/PR" -> 574706): remover os
     * separadores do texto todo casaria pedaços de números diferentes */
    const fichas = (b.match(/\d[\d.]*/g) || []).map((x) => x.replace(/\D/g, ""));
    return fichas.indexOf(d) >= 0;
  }
  if (campo === "relator") {
    /* o sobrenome basta: "Cármen Lúcia" no texto confirma "Min. Cármen
     * Lúcia da Rocha". Palavras de título não contam. */
    const nomes = jurSemAcento(v).replace(/\(.*?\)/g, " ")
      .split(/[^a-z]+/).filter((p) => p.length >= 4
        && !/^(ministro|ministra|relator|relatora|desembargador|conselheiro)$/.test(p));
    return nomes.length > 0 && nomes.every((p) => bn.indexOf(p) >= 0);
  }
  if (campo === "fonte") {
    /* uma fonte é confirmada quando TODOS os números dela (edição do DJe,
     * página, dia) estão no texto; uma fonte sem número nenhum ("portal do
     * tribunal") não se confere num texto */
    const grupos = v.match(/\d+/g) || [];
    if (!grupos.length) return false;
    const soNum = b.match(/\d+/g) || [];
    return grupos.every((g) => soNum.indexOf(g) >= 0);
  }
  /* tribunal, classe, órgão: a expressão inteira, sem acento nem caixa;
   * a sigla de tribunal como palavra isolada */
  const vn = jurSemAcento(v);
  if (campo === "tribunal") {
    return new RegExp("(^|[^a-z0-9])" + vn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      + "([^a-z0-9]|$)").test(bn);
  }
  return bn.replace(/\s+/g, " ").indexOf(vn.replace(/\s+/g, " ")) >= 0;
}

/* Recebe { campo: valor } do que a IA trouxe e o texto de base. Devolve
 * { confirmados:[campos], aConferir:[campos] }. */
function jurVerificarNoTexto(valores, base) {
  const confirmados = [], aConferir = [];
  JUR_CAMPOS_VERIFICAVEIS.forEach((k) => {
    const v = String((valores || {})[k] || "").trim();
    if (!v) return;
    (jurValorNoTexto(k, v, base) ? confirmados : aConferir).push(k);
  });
  /* O TRIBUNAL QUE A CLASSE JÁ DIZ. "RE 574706" está no texto e a sigla
   * STF não: o app já deduz um do outro (JUR_CASA), e essa dedução é regra
   * dele, não palpite da IA — desde que a própria classe tenha sido
   * confirmada no texto. */
  const iT = aConferir.indexOf("tribunal");
  const cl = String((valores || {}).classe || "").trim();
  if (iT >= 0 && confirmados.indexOf("classe") >= 0
      && JUR_CASA[cl] === String(valores.tribunal || "").trim().toUpperCase()) {
    aConferir.splice(iT, 1);
    confirmados.push("tribunal");
  }
  return { confirmados, aConferir };
}

/* "conferi": tira a marca de campos (ou de todos, sem lista) */
function jurMarcarConferido(id, campos) {
  const j = jurDe(id);
  if (!j) return false;
  const atuais = Array.isArray(j.aConferir) ? j.aConferir : [];
  const resto = campos && campos.length
    ? atuais.filter((k) => campos.indexOf(k) < 0) : [];
  return !!jurGravar({ id, aConferir: resto });
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
                   relator: "", orgao: "", fonte: "", tese: "", ano: "",
                   categoria: "", tribunalDeduzido: false };
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

  /* "SV 29" — a abreviação que se digita à mão quando não há ementa
   * nenhuma para colar, só o nome do julgado. */
  if (!achado.classe) {
    const sv = bruto.match(/(^|[^A-Za-z])SV\s*n?[º°.]?\s*(\d{1,3})(?!\d)/);
    if (sv) { achado.classe = "Súmula Vinculante"; achado.numero = sv[2]; }
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

/* ONDE CONFERIR, POR TRIBUNAL. Só a página de busca de cada um — não um
 * endereço por julgado, que eu não teria como saber sem errar. O que a
 * pessoa faz ali é digitar "Súmula Vinculante 29" e ler o texto oficial;
 * o app não sabe mais do que isso, e não finge saber. */
const JUR_PORTAIS = {
  STF: { nome: "portal do STF", url: "https://portal.stf.jus.br/jurisprudencia/" },
  STJ: { nome: "SCON — STJ", url: "https://scon.stj.jus.br/SCON/" },
  TST: { nome: "jurisprudência do TST", url: "https://jurisprudencia.tst.jus.br/" },
  TSE: { nome: "jurisprudência do TSE", url: "https://jurisprudencia.tse.jus.br/" },
  TCU: { nome: "pesquisa do TCU", url: "https://pesquisa.apps.tcu.gov.br/" },
};

function jurPortalOficial(tribunal) {
  return JUR_PORTAIS[String(tribunal || "").trim().toUpperCase()] || null;
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
    /* campos que a IA trouxe e que o texto colado NÃO confirma — ficam
     * marcados até alguém conferir na fonte (jurMarcarConferido) */
    aConferir: [],
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
  const confA = Array.isArray(a.aConferir) ? a.aConferir.slice() : [];
  ["tribunal", "classe", "numero", "data", "orgao", "relator", "fonte"]
    .forEach((k) => {
      if (!String(a[k] || "").trim() && b[k]) {
        a[k] = b[k];
        /* o campo que veio do outro lado leva a marca dele junto */
        if ((b.aConferir || []).indexOf(k) >= 0 && confA.indexOf(k) < 0) confA.push(k);
      }
    });
  a.aConferir = confA;
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
function jurPromptPreencher(texto, tituloTopico, campos) {
  const t2 = String(texto || "").trim();
  if (!t2) return "";
  return jurPromptIA({ topico: tituloTopico, texto: t2, campos });
}

/* =====================================================================
 * UM PEDIDO SÓ À IA, MONTADO A PARTIR DO QUE EXISTE
 *
 * Eram dois textos com contratos opostos. O de ENTRADA dizia "não deduza
 * número, data nem relator"; o de COMPLETAR dizia "preencha data, órgão,
 * relator e fonte" — e, dado só o título do julgado, isso só se responde
 * de memória. Quem colou uma frase solta da Súmula Vinculante 29 precisou
 * dos dois em sequência, e o segundo devolveu de memória uma data, uma
 * fonte e um "relator" que não conferem com o que os sítios oficiais
 * publicam — gravados no julgado com a mesma cara do que veio do texto.
 *
 * AGORA UM PEDIDO, UM FORMATO, UMA LEITURA. O estado de quem pede (o
 * formulário na entrada, o julgado guardado no completar) entra pelo
 * mesmo montador, e a resposta tem dois blocos:
 *   · "do_texto"   — só o que está escrito no texto colado;
 *   · "de_memoria" — só a IDENTIDADE (tribunal, classe, número), a menos
 *                    que a pessoa peça mais (opc.memoria === "tudo");
 * e a IA diz de que TIPO é o texto que recebeu (ementa, enunciado
 * oficial, paráfrase de terceiros…). Uma frase de resumo copiada como
 * "tese" deixa de passar por transcrição do tribunal.
 *
 * O prompt PEDE isso; quem GARANTE é o app (jurVerificarNoTexto). Rodar a
 * régua no que volta é o que torna a regra "não invente" verificável.
 *
 * estado: { topico, texto, tese, resumo, campos:{tribunal,classe,numero,
 *   data,orgao,relator,fonte}, tags, titulo }
 * ===================================================================== */
function jurPromptIA(estado, opc) {
  const e = estado || {};
  const o = opc || {};
  const campos = e.campos || {};
  const tem = JUR_CAMPOS_META
    .filter((c) => c.k !== "resumo" && String(campos[c.k] || "").trim())
    .map((c) => t(c.i) + ": " + String(campos[c.k]).trim());
  const tags = e.tags || [];
  if (tags.length) tem.push(t("jur_f_tags") + ": " + tags.join(", "));
  const resumo = String(e.resumo || "").trim();
  const falta = JUR_CAMPOS_META
    .filter((c) => c.k === "resumo" ? !resumo : !String(campos[c.k] || "").trim())
    .map((c) => c.k);
  if (!tags.length) falta.push("tags");
  const tudo = o.memoria === "tudo";
  const vals = {
    tp: e.topico || "",
    tit: e.titulo || [campos.tribunal, campos.classe, campos.numero]
      .filter(Boolean).join(" ") || "(?)",
    tem: tem.length ? tem.join("\n") : t("jur_nada_preenchido"),
    falta: falta.length ? falta.join(", ") : t("jur_nada_faltando"),
    txt: String(e.texto || "").trim().slice(0, 6000) || "(vazio)",
    tese: String(e.tese || "").trim() || "(vazia)",
    resumo: resumo || "(vazio)",
    schema_memoria: t(tudo ? "jur_prompt_mem_tudo_schema" : "jur_prompt_mem_ident_schema"),
    regra_memoria: t(tudo ? "jur_prompt_mem_tudo_regra" : "jur_prompt_mem_ident_regra"),
  };
  /* UMA PASSADA SÓ: o texto colado pode conter "{tese}" ou "{resumo}", e
   * substituir marcador por marcador, em sequência, reescreveria o que veio
   * de fora dentro do que já foi montado */
  return t("jur_prompt_unico").replace(/\{(\w+)\}/g,
    (m, k) => (Object.prototype.hasOwnProperty.call(vals, k) ? vals[k] : m));
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

/* =====================================================================
 * DOIS PROCESSOS NUMA FICHA SÓ
 *
 * O CASO REAL: "551/RJ e 938.538 AgR/ES" — dois julgados do STF viraram
 * um número só. Data, órgão e relator descrevem UMA decisão; juntar duas
 * nesta mesma ficha deixa esses três campos sem resposta certa para
 * sempre — não é falha de prompt nem de IA, "completar" vai (com razão)
 * recusar todos os três, porque não existe uma data única para dois
 * julgamentos diferentes. Foi exatamente o que aconteceu ao pedir para
 * completar este julgado: a IA devolveu os três vazios e explicou por
 * quê, em vez de inventar uma resposta.
 *
 * SÓ APONTA, NUNCA SEPARA SOZINHO — a mesma regra dos outros detectores
 * desta tela (jurFaltando, a conferência do "completar"): qual dos dois
 * leva a tese, que assuntos cada um leva, é decisão de quem estuda.
 *
 * O SINAL: um " e " (conjunção, palavra inteira — \b nas duas pontas
 * para não casar o "e" dentro de "AgRE" ou "Resp") entre dois números.
 * Não tenta reconhecer o FORMATO do número (variam demais entre
 * tribunais) — só que há dígito antes E depois da conjunção. */
const JUR_NUMERO_DUPLO = /\d.*\be\b.*\d/i;
function jurPareceDoisProcessos(j) {
  return !!(j && j.numero && JUR_NUMERO_DUPLO.test(String(j.numero)));
}

function jurPromptCompletar(j, tituloTopico, opc) {
  if (!j) return "";
  const campos = {};
  JUR_CAMPOS_META.forEach((c) => { campos[c.k] = j[c.k]; });
  return jurPromptIA({
    topico: tituloTopico || (j.topicos || [])[0] || "",
    titulo: jurTitulo(j),
    texto: String(j.texto || "").slice(0, 4000),
    tese: j.tese, resumo: j.resumo, campos,
    tags: jurTagsDe(j) || [],
  }, opc);
}

/* =====================================================================
 * MELHORAR SÓ O RESUMO — nunca a tese
 *
 * "Completar e conferir" (acima) preenche o que falta e aponta erro,
 * sem reescrever nada. Este é o prompt que FALTAVA: quando o resumo
 * está preenchido mas mal escrito, a única saída até aqui era reescrever
 * à mão. Tese e ementa entram como CONTEXTO — para a IA entender do que
 * o julgado trata — mas a regra que vale em todo prompt desta tela vale
 * aqui também: tese é transcrição do tribunal, nunca reescrita. Por
 * isso o prompt pede texto simples, não JSON — é UM campo só, e cada
 * chave a mais no formato é uma chance a mais de a IA errar o que
 * devolver. */
function jurPromptMelhorar(tituloTopico, tese, ementa, resumo) {
  return t("jur_prompt_melhorar", {
    tp: tituloTopico || "",
    tese: String(tese || "").trim() || "(vazia)",
    ementa: String(ementa || "").trim().slice(0, 3000) || "(não guardei a ementa)",
    resumo: String(resumo || "").trim() || "(vazio)",
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
  const plano = jurAchatar(dados);
  const vindo = {
    tribunal: plano.tribunal, classe: plano.classe, numero: plano.numero,
    data: plano.data_julgamento || plano.data, orgao: plano.orgao,
    relator: plano.relator, fonte: plano.fonte, resumo: plano.resumo,
    categoria: plano.categoria,
  };
  /* O QUE A IA LEMBROU só entra onde o texto não trouxe nada — e
   * a verificação logo abaixo o marca "a conferir" se o texto não o
   * confirmar. Nunca substitui campo já preenchido. */
  const mem = jurDeMemoria(dados);
  JUR_CAMPOS_VERIFICAVEIS.forEach((k) => {
    if (!String(vindo[k] === undefined || vindo[k] === null ? "" : vindo[k]).trim() && mem[k]) {
      vindo[k] = mem[k];
    }
  });
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
  if (!mudou.length) return { mudou: [], ignorados, aConferir: [], ok: true };
  /* CADA CAMPO NOVO É CONFERIDO NO TEXTO GUARDADO (ementa e tese). O que
   * não aparece lá fica "a conferir" — ver jurVerificarNoTexto. */
  const novos = {};
  JUR_CAMPOS_VERIFICAVEIS.forEach((k) => { if (novo[k]) novos[k] = novo[k]; });
  const ver = jurVerificarNoTexto(novos,
    [j.texto, j.tese].filter(Boolean).join("\n"));
  const antes = Array.isArray(j.aConferir) ? j.aConferir : [];
  const juntas = antes.slice();
  ver.aConferir.forEach((k) => { if (juntas.indexOf(k) < 0) juntas.push(k); });
  novo.aConferir = juntas;
  novo.id = j.id;
  return { mudou, ignorados, aConferir: ver.aConferir, ok: !!jurGravar(novo) };
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
