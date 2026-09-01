/* =====================================================================
 * "O QUE EU JÁ ESTUDEI DISTO?"
 *
 * Cruza o DIÁRIO (o que você estudou, em qualquer concurso) com os tópicos
 * pendentes do edital aberto. Comparar dois editais inteiros seriam 30.856
 * combinações; comparar o diário com o edital são ~5.300 — e vínculo entre
 * dois tópicos que você nunca estudou não produz informação nenhuma.
 *
 * NADA é aplicado sozinho. Nem mesmo nome idêntico:
 * "Controle interno e externo" num TCE e numa prefeitura cobram normas
 * diferentes; o mesmo nome em disciplinas diferentes é outro assunto. O
 * app APRESENTA os idênticos e quem decide é a pessoa — item a item, ou
 * mandando tudo para a IA.
 *
 * E a IA nunca vê datas. Ela responde uma coisa só: estes dois tópicos são
 * o mesmo assunto? A recência é aritmética, e o app faz aritmética certo.
 * ===================================================================== */

let vinculos = [];

function vkCarregar() {
  try { vinculos = JSON.parse(localStorage.getItem("eac_vinculos") || "[]"); }
  catch (e) { vinculos = []; }
  if (!Array.isArray(vinculos)) vinculos = [];
  return vinculos;
}

function vkSalvar() {
  if (typeof guardar === "function") guardar("eac_vinculos", JSON.stringify(vinculos));
  else { try { localStorage.setItem("eac_vinculos", JSON.stringify(vinculos)); } catch (e) {} }
}

/* normalização só para COMPARAR nomes — nunca para exibir */
function vkNormal(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function vkChave(disc, top) { return vkNormal(disc) + "›" + vkNormal(top); }

/* ------------------------------------------------------------------
 * O QUE VOCÊ JÁ ESTUDOU
 * Uma linha por assunto, com a data mais recente e o concurso. Estudar
 * duas vezes o mesmo tópico não vira dois itens: vale o mais recente.
 * ------------------------------------------------------------------ */
function vkEstudados(diario) {
  const m = {};
  (diario || []).forEach((x) => {
    if (!x || !x.n || x.a === "pendente") return;
    const k = vkChave(x.disc, x.n);
    const antes = m[k];
    const dt = x.d && x.d !== "?" ? x.d : "";
    if (!antes || (dt && dt > antes.data)) {
      m[k] = { chave: k, disciplina: x.disc || "", topico: x.n,
               data: dt, concurso: x.cc || "", acao: x.a || "feito" };
    } else if (antes && x.a === "revisado") {
      antes.acao = "revisado";
    }
  });
  return Object.keys(m).map((k) => m[k]);
}

/* ------------------------------------------------------------------
 * TRIAGEM: nomes idênticos
 * Devolve os pares de nome exatamente igual (normalizado) — como
 * CANDIDATOS, nunca como fato. A disciplina entra na apresentação porque
 * é o que mais desmente a igualdade do nome.
 * ------------------------------------------------------------------ */
function vkIdenticos(estudados, pendentes) {
  const porNome = {};
  (estudados || []).forEach((e) => {
    (porNome[vkNormal(e.topico)] = porNome[vkNormal(e.topico)] || []).push(e);
  });
  const pares = [];
  (pendentes || []).forEach((p) => {
    const iguais = porNome[vkNormal(p.nome)];
    if (!iguais) return;
    iguais.forEach((e) => {
      if (vkJaTem(e.chave, vkChave(p.disciplina, p.nome))) return;
      pares.push({
        de: e, para: { disciplina: p.disciplina, topico: p.nome,
                       chave: vkChave(p.disciplina, p.nome) },
        /* mesma disciplina reforça, disciplina diferente é sinal de alerta —
         * e a tela mostra os dois casos, não esconde nenhum */
        mesmaDisciplina: vkNormal(e.disciplina) === vkNormal(p.disciplina),
      });
    });
  });
  return pares;
}

function vkJaTem(a, b) {
  return vinculos.some((v) => (v.a === a && v.b === b) || (v.a === b && v.b === a));
}

/* ------------------------------------------------------------------
 * O PROMPT
 * Recebe só o que a pessoa mandou para a IA. Sem datas: a IA responde
 * equivalência, o app calcula tempo.
 * ------------------------------------------------------------------ */
/* O PROMPT NOMEIA OS DOIS CONCURSOS.
 *
 * "Controle interno e externo" no TCE-PE e numa SEFAZ são normas
 * diferentes, e é o CARGO que decide — auditor de controle externo lê a
 * Lei Orgânica do Tribunal, auditor fiscal lê o regulamento do ICMS.
 * Sem os dois cabeçalhos, a IA compara dois nomes soltos e acerta por
 * sorte.
 *
 * A saída também mudou de natureza: em vez de só "quais são iguais",
 * pede-se uma SUGESTÃO em três níveis — dá para pular, vale uma revisão
 * rápida, ou só o nome é parecido. É a decisão que a pessoa vai tomar de
 * qualquer jeito; devolvê-la já classificada poupa a leitura de cem
 * pares para descobrir isso sozinha. */
function vkPrompt(estudados, pendentes, nomeEdital, deOnde) {
  const linha = (d, t2) => "- " + (d ? d + " > " : "") + t2;
  return t("vk_prompt", {
    origem: (deOnde && String(deOnde).trim()) || t("vk_origem_varias"),
    edital: nomeEdital || "",
    estudei: (estudados || []).map((e) => linha(e.disciplina, e.topico)).join("\n"),
    pendentes: (pendentes || []).map((p) => linha(p.disciplina, p.nome)).join("\n"),
  });
}

/* ------------------------------------------------------------------
 * A RESPOSTA
 * "~ assunto estudado :: tópico do edital :: ALTA :: por quê"
 * ------------------------------------------------------------------ */
function vkLerResposta(txt, estudados, pendentes) {
  const achaEstudado = (s) => (estudados || []).find((e) =>
    vkNormal(e.disciplina + " " + e.topico) === vkNormal(s)
    || vkNormal(e.topico) === vkNormal(String(s).split(">").pop()));
  const achaPendente = (s) => (pendentes || []).find((p) =>
    vkNormal(p.disciplina + " " + p.nome) === vkNormal(s)
    || vkNormal(p.nome) === vkNormal(String(s).split(">").pop()));

  const pares = [], ignoradas = [];
  String(txt || "").split("\n").forEach((l, i) => {
    const bruta = l.trim();
    if (!bruta) return;
    if (!/^~/.test(bruta)) { ignoradas.push({ linha: i + 1, txt: bruta.slice(0, 70) }); return; }
    const p = bruta.replace(/^~\s*/, "").split("::").map((x) => x.trim());
    const e = achaEstudado(p[0]), d = achaPendente(p[1]);
    if (!e || !d) { ignoradas.push({ linha: i + 1, txt: bruta.slice(0, 70), motivo: "nao_achou" }); return; }
    /* O TERCEIRO CAMPO virou a SUGESTÃO, não mais a confiança.
     *
     * "ALTA/MEDIA" dizia o quanto a IA acreditava; "PULAR/REVISAR" diz o
     * que fazer. É a mesma informação vista do lado útil — e o que a
     * pessoa vai decidir de qualquer modo.
     *
     * O formato velho continua sendo lido: quem tiver um prompt antigo
     * salvo, ou uma IA que respondeu ALTA, não fica sem resposta. */
    const bruto = String(p[2] || "").trim().toUpperCase();
    const sug = /^PULAR/.test(bruto) ? "PULAR"
      : (/^REVISAR/.test(bruto) ? "REVISAR"
        : (/^ALTA/.test(bruto) ? "PULAR" : "REVISAR"));
    pares.push({ de: e, para: { disciplina: d.disciplina, topico: d.nome,
                                chave: vkChave(d.disciplina, d.nome) },
                 /* conf fica, para não quebrar quem já lê este campo */
                 conf: sug === "PULAR" ? "ALTA" : "MEDIA",
                 sugestao: sug,
                 por: p[3] || "", origem: "ia" });
  });
  return { pares, ignoradas };
}

/* ------------------------------------------------------------------
 * APLICAR
 * Idempotente de propósito: este botão vai ser apertado de novo todo mês,
 * e tem de acrescentar só o que é novo.
 * ------------------------------------------------------------------ */
function vkAplicar(pares, editalId) {
  let novos = 0, repetidos = 0;
  (pares || []).forEach((p) => {
    const a = p.de.chave, b = p.para.chave;
    if (vkJaTem(a, b)) { repetidos++; return; }
    vinculos.push({
      a, b, editalB: editalId || "",
      conf: p.conf || "ALTA", sugestao: p.sugestao || "",
      por: p.por || "",
      origem: p.origem || "manual", criado: new Date().toISOString(),
    });
    novos++;
  });
  if (novos) vkSalvar();
  return { novos, repetidos };
}

function vkDesfazer(a, b) {
  const antes = vinculos.length;
  vinculos = vinculos.filter((v) => !((v.a === a && v.b === b) || (v.a === b && v.b === a)));
  if (vinculos.length !== antes) vkSalvar();
  return antes - vinculos.length;
}

/* =====================================================================
 * O ACERVO DO OUTRO CONCURSO
 *
 * Vincular dois tópicos nunca deve marcar nada como estudado. "Já vi
 * isto no TCE-PE" e "não preciso mais estudar isto para a SEFAZ" são
 * afirmações diferentes, e só quem estudou sabe a distância entre elas:
 * o recorte muda, a banca muda, e seis meses passaram. Marcar sozinho
 * seria o app decidindo o que só a memória de alguém pode decidir — e
 * o erro custaria um assunto inteiro na prova.
 *
 * O que o vínculo faz é ABRIR A PORTA. Do lado de lá está o resumo que
 * você escreveu, os cartões que gerou, as leis que anexou e as questões
 * que respondeu. Você olha, e então decide: pular, revisar em vinte
 * minutos, ou estudar do zero.
 *
 * E NADA DISSO IMPEDE MATERIAL PRÓPRIO. O tópico deste edital continua
 * com a gaveta dele, vazia, esperando o resumo desta prova. O acervo
 * antigo é consulta, não herança: adotá-lo automaticamente misturaria
 * o recorte de dois concursos num texto só, e ninguém saberia depois
 * qual parte foi escrita para qual prova.
 * ===================================================================== */

/* A CADEIA, NÃO SÓ O VIZINHO.
 *
 * Você compara cada concurso novo com o anterior: A→B, depois B→C. É a
 * sequência natural, e com um salto só ela quebra exatamente onde
 * importa — C enxerga B, B está vazio, e o material que existe (em A)
 * fica inalcançável. Na agenda do terceiro concurso o selo nem aparecia.
 *
 * MAS A CADEIA NÃO É UMA IGUALDADE. "A é como B" e "B é como C" não
 * garantem que A e C sejam a mesma coisa: cada elo aceita uma pequena
 * diferença de recorte, e três elos somam três diferenças. Por isso o
 * salto fica REGISTRADO — quem veio direto é uma coisa, quem chegou por
 * dois intermediários é outra, e a tela diz qual é qual.
 *
 * O limite de três saltos não é medo de laço (os visitados já cuidam
 * disso): é que além disso a soma de aproximações deixa de significar
 * qualquer coisa. */
const VK_SALTOS_MAX = 3;

function vkLigadosDe(disciplina, topico, maxSaltos) {
  const inicio = vkChave(disciplina, topico);
  const limite = maxSaltos === undefined ? VK_SALTOS_MAX : maxSaltos;
  const vistos = {};
  vistos[inicio] = true;
  const saida = [];
  let fronteira = [{ chave: inicio, via: [] }];

  for (let salto = 1; salto <= limite && fronteira.length; salto++) {
    const proxima = [];
    fronteira.forEach((atual) => {
      vinculos.forEach((v) => {
        if (v.a !== atual.chave && v.b !== atual.chave) return;
        const outro = v.a === atual.chave ? v.b : v.a;
        if (vistos[outro]) return;
        vistos[outro] = true;
        const item = { chave: outro, editalB: v.editalB || "",
                       conf: v.conf || "", quando: v.quando || "",
                       /* quantos elos até aqui, e por onde passou: sem
                        * isto a tela não teria como distinguir o que
                        * você ligou do que o app deduziu */
                       saltos: salto, via: atual.via.slice() };
        saida.push(item);
        proxima.push({ chave: outro, via: atual.via.concat([outro]) });
      });
    });
    fronteira = proxima;
  }
  return saida;
}

/* O QUE EXISTE DO OUTRO LADO, contado antes de abrir.
 *
 * Precisa dos acervos passados de fora: vinculos.js não conhece
 * material.js nem questoes.js, e não deve conhecer — este módulo é
 * sobre a LIGAÇÃO, não sobre o que está ligado. Quem chama entrega os
 * quatro mapas, e o teste consegue entregar mapas de mentira. */
function vkAcervoDe(disciplina, topico, fontes) {
  const f = fontes || {};
  const ligados = vkLigadosDe(disciplina, topico);
  if (!ligados.length) return { temAlgo: false, itens: [] };

  const itens = ligados.map((L) => {
    /* a chave do vínculo é normalizada (sem acento, minúscula); os
     * acervos são endereçados pela chave ORIGINAL. A ponte é o mapa de
     * equivalência que quem chama monta a partir do diário. */
    const real = (f.chaveReal && f.chaveReal[L.chave]) || L.chave;
    /* O NOME COMO VOCÊ ESCREVEU, não a chave.
     * A chave é minúscula por construção (serve para comparar), e usá-la
     * na tela mostrava "direito financeiro › receita pública" — legível,
     * mas não é o nome que está no seu edital. */
    const bonito = (f.nomeReal && f.nomeReal[L.chave]) || "";
    const partes = bonito ? bonito.split("›") : String(real).split("›");
    const res = (f.resumos && f.resumos[real]) || null;
    const cartoes = res && String(res.cartoes || "").trim()
      ? String(res.cartoes).split(/\r?\n/).filter((x) => x.trim()).length : 0;
    const leis = (f.leis && f.leis[real]) || [];
    const questoes = (f.questoes && f.questoes[real]) || 0;
    const est = (f.estudo && f.estudo[L.chave]) || null;
    return {
      chave: real,
      disciplina: partes[0] || "",
      topico: partes.slice(1).join("›") || "",
      /* de qual concurso veio, e quando foi estudado. Sem os dois, a
       * informação é "existe material" — que não ajuda a decidir. */
      /* DE QUAL CONCURSO É ESTE TÓPICO — e não de qual vínculo ele veio.
       *
       * O campo "editalB" do vínculo guarda o DESTINO da comparação, não
       * a origem do tópico. Usá-lo como nome do concurso fazia o app
       * dizer que um tópico do ISS Caruaru era do SEFAZ-AL — errado com
       * cara de certo, que é o pior modo de errar.
       *
       * A ordem é: o que o diário registrou (é fato, tem data), depois
       * em qual edital cadastrado aquele tópico existe (é dedução, mas
       * verificável), e por fim nada. Nunca um identificador interno. */
      concurso: (est && est.concurso)
        || (f.editalDoTopico && f.editalDoTopico[L.chave]) || "",
      data: (est && est.data) || "",
      acao: (est && est.acao) || "",
      /* quantos elos de distância, para a tela poder separar o que você
       * ligou do que veio por transitividade */
      saltos: L.saltos || 1,
      via: L.via || [],
      resumoChars: res ? String(res.texto || "").length : 0,
      cartoes,
      leis: leis.length,
      questoes,
      /* "tem alguma coisa" é o que decide se vale abrir a gaveta */
      temAlgo: !!(res && (String(res.texto || "").trim() || cartoes))
        || leis.length > 0 || questoes > 0,
    };
  });
  /* PERTO E COM MATERIAL PRIMEIRO. Numa cadeia de três concursos o
   * item útil pode ser o mais distante, e enterrá-lo sob um elo vazio
   * é o mesmo que não tê-lo. */
  itens.sort((a, b) => (b.temAlgo ? 1 : 0) - (a.temAlgo ? 1 : 0)
    || (a.saltos - b.saltos));
  return { temAlgo: itens.some((x) => x.temAlgo), itens };
}

/* ------------------------------------------------------------------
 * A MARCA DE HISTÓRICO
 * Seis estados, e cada tópico está em exatamente um. As faixas de tempo
 * existem porque a decisão é diferente em cada uma: pular, revisar, ou
 * estudar sabendo que já há material.
 * ------------------------------------------------------------------ */
const VK_FAIXAS = { recente: 30, morno: 90 };

function vkHistorico(disciplina, topico, estado, diario, hoje) {
  if (estado === "revisado") return { marca: "revisado_aqui" };
  if (estado === "feito") return { marca: "estudado_aqui" };

  /* a mesma cadeia: com um salto só, a marca de histórico sumia no
   * terceiro concurso da sequência — o único que não tem material
   * próprio e mais precisa saber que existe material em algum lugar */
  const ligados = vkLigadosDe(disciplina, topico).map((x) => x.chave);
  if (!ligados.length) return { marca: "sem_historico" };

  /* o registro mais recente entre todos os tópicos ligados */
  let melhor = null;
  (diario || []).forEach((x) => {
    if (!x || !x.n || x.a === "pendente") return;
    if (ligados.indexOf(vkChave(x.disc, x.n)) < 0) return;
    const d = x.d && x.d !== "?" ? x.d : "";
    if (!d) return;
    if (!melhor || d > melhor.d) melhor = x;
  });
  if (!melhor) return { marca: "sem_historico" };

  /* CONTA DE DIAS SEM FUSO.
   * new Date("2026-08-16") é meia-noite UTC; new Date("2026-08-10T00:00:00")
   * é meia-noite LOCAL. Subtrair os dois erra por um dia inteiro em quase
   * todo o Brasil — e "há 5 dias" contra "há 6 dias" muda a faixa quando o
   * valor está na borda dos 30. Aqui as duas datas viram número de dia puro,
   * sem hora nenhuma no meio. */
  const emDias = (iso) => {
    const p = String(iso).slice(0, 10).split("-").map(Number);
    return Math.floor(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) / 86400000);
  };
  const hojeIso = hoje ? String(hoje).slice(0, 10)
    : (typeof hojeISO === "function"
        ? hojeISO() : new Date().toISOString().slice(0, 10));
  const dias = Math.max(0, emDias(hojeIso) - emDias(melhor.d));
  const marca = dias <= VK_FAIXAS.recente ? "ja_visto"
    : dias <= VK_FAIXAS.morno ? "vale_revisar" : "visto_ha_muito";
  return { marca, dias, data: melhor.d, concurso: melhor.cc || "",
           topico: melhor.n, acao: melhor.a || "feito" };
}

/* limpeza: vínculo apontando para edital que não existe mais continua
 * contando cobertura de um concurso apagado */
/* APAGAR UM EDITAL NÃO APAGA O QUE VOCÊ SOUBE.
 *
 * Isto removia todo vínculo cujo "editalB" saísse da lista. Parecia
 * limpeza e era perda: o vínculo registra um julgamento SEU — "estes
 * dois assuntos são o mesmo" —, e esse julgamento continua verdadeiro
 * depois que o edital sai da tela. Fechado o concurso do TCE-PE, as
 * equivalências que você levou meses reconhecendo sumiam junto.
 *
 * E, com a cadeia, o dano se espalhava: apagar o edital do MEIO cortava
 * A↔B e deixava B↔C órfão, quebrando o caminho de A até C. Você perderia
 * o acesso ao seu próprio material por ter arrumado a lista de editais.
 *
 * Agora o vínculo fica. O que se perde é só a etiqueta do edital de
 * destino, que é um detalhe de procedência — e o acervo já descobre o
 * concurso de cada tópico procurando nos editais que existem. */
function vkPodar(idsValidos) {
  const validos = idsValidos || [];
  let mexeu = 0;
  vinculos.forEach((v) => {
    if (!v.editalB || validos.indexOf(v.editalB) >= 0) return;
    /* a procedência vira histórico, o vínculo permanece */
    v.editalAntigo = v.editalB;
    v.editalB = "";
    mexeu++;
  });
  if (mexeu) vkSalvar();
  /* devolve quantos foram AFETADOS, não quantos foram apagados — nenhum
   * é apagado. O nome antigo do retorno induzia quem lesse a achar que
   * havia remoção. */
  return 0;
}
