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

/* IDENTIFICAR A LEI PELO PRÓPRIO TEXTO.
 * Quem cola a lei já colou o cabeçalho junto na imensa maioria das
 * vezes. Ler dali o número e o ano poupa dois campos de formulário e,
 * mais importante, evita o erro de digitar "4.230". */
function leiIdentificar(texto) {
  const cabeca = String(texto || "").slice(0, 1200);
  const m = cabeca.match(
    /\b(LEI|LEI\s+COMPLEMENTAR|DECRETO[\s-]?LEI|DECRETO|EMENDA\s+CONSTITUCIONAL|MEDIDA\s+PROVIS[ÓO]RIA)\s*(?:N?[ºo°.]?\s*)?([\d.]{3,9})(?:\s*,?\s*DE\s+.{0,40}?(\d{4}))?/i);
  if (!m) {
    if (/constitui[çc][ãa]o/i.test(cabeca)) {
      return { especie: "Constituição", numero: "", ano: "1988",
               nome: "Constituição Federal de 1988", curto: "CF/88" };
    }
    return null;
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LEIS_CHAVE, LEI_ART_POR_BLOCO,
    leiNumNormal, leiNumOrdem, leiEmenta, leiArtigos, leiArtigo, leiBlocos,
    leiCitacoes, leiIdentificar,
    leisLerTudo, leisLista, leiId, leiDe, leiGuardar, leiApagar,
    leiLigar, leiDesligar, leisDoTopico, leisChaveComparavel,
    leiParar, leiProgresso, leiBlocoLido, leiBlocosLidos, leisMigrarDe,
    leisHojeISO,
  };
}
