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

/* =====================================================================
 * O SEGUNDO MODO: "VOU ESTUDAR OS DOIS"
 *
 * Até aqui a origem da comparação era sempre o DIÁRIO — o que já foi
 * estudado. Isso responde "o que eu não preciso refazer?", e deixa de
 * fora a pergunta que aparece quando duas provas estão abertas ao mesmo
 * tempo: "o que eu vou estudar DUAS VEZES sem perceber?".
 *
 * A resposta é o mesmo vínculo, e é por isso que este modo não traz
 * estrutura nova. Muda só de onde sai a lista da esquerda: dos tópicos
 * PENDENTES do outro edital, em vez do diário. Ligado o par, o app faz o
 * resto sozinho — antes de estudar o selo diz "também cai lá"; depois
 * que você registrar, o mesmo vínculo passa a mostrar o resumo e os
 * cartões que você acabou de escrever, porque quem alimenta essa leitura
 * é o diário.
 *
 * O RISCO AQUI É O OPOSTO do outro modo. Lá, um vínculo errado fazia
 * PULAR um assunto. Aqui ele faz estudar o recorte do concurso errado
 * achando que serve para os dois — e por isso o vocabulário da resposta
 * muda junto: não é "pular ou revisar", é "serve para os dois" ou
 * "recorte diferente".
 * ===================================================================== */

/* Os pendentes na forma de ORIGEM. Sem data e sem concurso, porque não
 * houve estudo nenhum: inventar uma data aqui faria o app afirmar, na
 * agenda, algo que nunca aconteceu. */
function vkComoOrigem(pendentes) {
  return (pendentes || []).map((p) => ({
    chave: vkChave(p.disciplina, p.nome || p.topico),
    disciplina: p.disciplina || "",
    topico: p.nome || p.topico || "",
    data: "", concurso: "", acao: "",
  }));
}

/* As disciplinas de uma lista, na ordem em que aparecem e sem repetir. */
function vkDisciplinasDe(lista) {
  const vistas = {}, saida = [];
  (lista || []).forEach((x) => {
    const d = x.disciplina || "";
    if (!d || vistas[vkNormal(d)]) return;
    vistas[vkNormal(d)] = true;
    saida.push(d);
  });
  return saida;
}

/* QUAL DISCIPLINA DE LÁ CORRESPONDE A ESTA.
 *
 * É palpite, e por isso é só uma sugestão que a tela deixa trocar:
 * "Finanças Públicas" e "Direito Financeiro" são a mesma matéria e não
 * compartilham palavra nenhuma. O que a conta acha bem são os casos
 * fáceis, que são a maioria — e errar aqui não estraga nada, porque a
 * escolha final é de quem estuda. */
function vkParDisciplina(nome, candidatas) {
  const alvo = vkNormal(nome);
  const lista = candidatas || [];
  const igual = lista.filter((c) => vkNormal(c) === alvo)[0];
  if (igual) return igual;
  const pal = (s) => vkNormal(s).split(" ").filter((w) => w.length > 3);
  const minhas = pal(nome);
  let melhor = null, forca = 0;
  lista.forEach((c) => {
    const dela = pal(c);
    if (!minhas.length || !dela.length) return;
    const comuns = minhas.filter((w) => dela.indexOf(w) >= 0).length;
    const f = comuns / Math.max(minhas.length, dela.length);
    if (f > forca) { forca = f; melhor = c; }
  });
  return forca >= 0.5 ? melhor : "";
}

/* Só os itens de uma disciplina. O recorte é o que torna o prompt
 * possível: 232 tópicos contra 533 dariam 765 linhas de lista e cento e
 * vinte mil combinações numa resposta só — a IA perde o fio no meio, e o
 * que voltar não dá para conferir. */
function vkSoDaDisciplina(lista, disciplina) {
  if (!disciplina) return lista || [];
  const alvo = vkNormal(disciplina);
  return (lista || []).filter((x) => vkNormal(x.disciplina) === alvo);
}

/* AS DUAS LISTAS SOMADAS, sem repetir.
 *
 * A conferência precisa reconhecer os nomes que a IA devolveu, e eles
 * foram escritos contra as listas do momento em que o prompt foi
 * copiado. Trabalhando disciplina a disciplina, essas listas mudam entre
 * copiar e colar — e recalcular sozinho faria a colagem descartar a
 * resposta inteira dizendo "não achei nenhum destes".
 *
 * Somar em vez de escolher é o que não tem armadilha: reconhece o que
 * foi enviado E o que está na tela agora, e nunca recusa uma resposta
 * legítima por causa de um seletor que mudou de posição. */
function vkUnir(a, b) {
  const vistos = {}, saida = [];
  (a || []).concat(b || []).forEach((x) => {
    if (!x) return;
    const k = x.chave || vkChave(x.disciplina, x.topico || x.nome);
    if (vistos[k]) return;
    vistos[k] = true;
    saida.push(x);
  });
  return saida;
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

/* O PROMPT DO SEGUNDO MODO — nenhum dos dois lados foi estudado.
 *
 * A pergunta é outra e o vocabulário acompanha. "PULAR" não faz sentido
 * aqui: não há nada estudado para pular. O que se quer saber é se um
 * estudo só cobre os dois editais ou se cada prova pede um recorte
 * próprio — e o erro perigoso deste modo é o inverso do outro: dizer
 * "serve para os dois" quando não serve faz estudar a matéria certa pelo
 * ângulo errado, e o buraco só aparece na prova.
 *
 * Uma disciplina por vez, dito no cabeçalho, para a IA não sair
 * procurando parentesco fora do assunto. */
function vkPromptAmbos(a, b, nomeA, nomeB, disciplina) {
  const linha = (d, t2) => "- " + (d ? d + " > " : "") + t2;
  return t("vk_prompt_ambos", {
    a: (nomeA && String(nomeA).trim()) || "?",
    b: (nomeB && String(nomeB).trim()) || "?",
    disc: disciplina || "",
    la: (a || []).map((x) => linha(x.disciplina, x.topico || x.nome)).join("\n"),
    lb: (b || []).map((x) => linha(x.disciplina, x.nome || x.topico)).join("\n"),
  });
}

/* O PROMPT DAS DUPLAS JÁ ESCOLHIDAS.
 *
 * Os outros dois prompts mandam DUAS LISTAS e pedem à IA que ache os
 * pares — e é aí que o tamanho estoura: 533 contra 232 são 123.656
 * combinações implícitas numa resposta só. Foi o que obrigou a recortar
 * por disciplina e a rodar dezesseis vezes.
 *
 * Com a vizinhança semântica escolhendo os candidatos, a tarefa muda de
 * natureza: chegam duzentas duplas prontas e pergunta-se de cada uma
 * "esta serve?". Uma linha entra, uma linha sai — dá para conferir
 * item a item, coisa que uma resposta livre não permite.
 *
 * E ela precisa poder dizer NÃO. Aproximação de vetor não é
 * equivalência de matéria: "Responsabilidade Civil" e "Responsabilidade
 * Civil do Estado" ficam quase coladas e são assuntos diferentes. Se o
 * formato não tivesse a saída NAO, a IA seria empurrada a aprovar o
 * lixo que a triagem deixou passar. */
function vkPromptDuplas(pares, nomeA, nomeB) {
  const linha = (p, i) => (i + 1) + ". "
    + (p.de.disciplina ? p.de.disciplina + " > " : "") + p.de.topico
    + "  ::  "
    + (p.para.disciplina ? p.para.disciplina + " > " : "") + p.para.topico;
  return t("vk_prompt_duplas", {
    a: (nomeA && String(nomeA).trim()) || "?",
    b: (nomeB && String(nomeB).trim()) || "?",
    n: (pares || []).length,
    duplas: (pares || []).map(linha).join("\n"),
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

  const pares = [], ignoradas = [], recusados = [];
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
    /* A RECUSA DA IA É RESPOSTA, NÃO LIXO.
     *
     * No caminho das duplas, quem escolheu os candidatos foi a
     * vizinhança semântica — e ela erra por construção: aproxima
     * "Responsabilidade Civil" de "Responsabilidade Civil do Estado".
     * A IA precisa poder devolver essas duplas com um NÃO, e esse não
     * precisa ser CONTADO: "a IA recusou 60 das 250" é a medida de
     * quanto a triagem exagerou, e sem ela não há como calibrar o
     * corte. Jogar as recusas na pilha das linhas ignoradas as
     * misturaria com erro de formato, que é outra coisa. */
    if (/^N[AÃ]O/.test(bruto)) {
      recusados.push({ de: e, para: d, por: p[3] || "" });
      return;
    }
    const sug = /^PULAR/.test(bruto) ? "PULAR"
      : (/^REVISAR/.test(bruto) ? "REVISAR"
        /* o vocabulário do segundo modo. Não é sinônimo do primeiro:
         * "serve para os dois" é uma previsão sobre um estudo que ainda
         * vai acontecer, "pular" é um veredito sobre um estudo que já
         * aconteceu. Guardar o token como veio é o que permite à agenda
         * dizer a frase certa em cada caso. */
        : (/^SERVE/.test(bruto) ? "SERVE"
          : (/^RECORTE/.test(bruto) ? "RECORTE"
            : (/^ALTA/.test(bruto) ? "PULAR" : "REVISAR"))));
    const forte = sug === "PULAR" || sug === "SERVE";
    pares.push({ de: e, para: { disciplina: d.disciplina, topico: d.nome,
                                chave: vkChave(d.disciplina, d.nome) },
                 /* conf fica, para não quebrar quem já lê este campo */
                 conf: forte ? "ALTA" : "MEDIA",
                 sugestao: sug,
                 por: p[3] || "", origem: "ia" });
  });
  return { pares, ignoradas, recusados };
}

/* ------------------------------------------------------------------
 * APLICAR
 * Idempotente de propósito: este botão vai ser apertado de novo todo mês,
 * e tem de acrescentar só o que é novo.
 * ------------------------------------------------------------------ */
function vkAplicar(pares, editalId, modo) {
  let novos = 0, repetidos = 0;
  (pares || []).forEach((p) => {
    const a = p.de.chave, b = p.para.chave;
    if (vkJaTem(a, b)) { repetidos++; return; }
    vinculos.push({
      a, b, editalB: editalId || "",
      conf: p.conf || "ALTA", sugestao: p.sugestao || "",
      /* DE QUAL PERGUNTA ESTE VÍNCULO NASCEU. "Já estudei" e "vou
       * estudar os dois" produzem o mesmo objeto e significam coisas
       * diferentes; sem esta marca a tela teria de adivinhar qual frase
       * dizer, e adivinharia errado metade das vezes. */
      modo: modo || p.modo || "estudei",
      por: p.por || "",
      origem: p.origem || "manual", criado: new Date().toISOString(),
    });
    novos++;
  });
  if (novos) vkSalvar();
  return { novos, repetidos };
}

/* =====================================================================
 * UM VÍNCULO TEM O QUE DIZER? — a regra, num lugar só
 *
 * Ela já existiu em dois lugares, e eles discordaram no primeiro uso
 * real: a gaveta considerava "o outro edital ainda vai acontecer" e a
 * revisão não. Resultado na tela: 502 de 513 vínculos rotulados "não
 * levam a nada" — e a maioria deles era ISS↔SEFAZ, dois concursos
 * futuros, ou seja, exatamente os bons. Um botão "marcar os que não
 * levam a nada" em cima disso teria apagado o trabalho todo.
 *
 * A REGRA É DIRECIONAL, e é por isso que ela não cabe num "&&" solto.
 * Um vínculo serve a quem está estudando; então:
 *
 *   1. só um lado ATIVO tem alguém para avisar — ninguém estuda para um
 *      concurso que já passou;
 *   2. e o OUTRO lado precisa oferecer alguma coisa: material para
 *      consultar, um estudo registrado, ou estar ele mesmo ativo (aí a
 *      coincidência é o próprio aviso: você vai estudar isto duas
 *      vezes).
 *
 * Basta um dos dois sentidos servir. ISS↔SEFAZ, os dois futuros: serve.
 * ISS↔TCE com o TCE encerrado e vazio: não serve — o TCE não tem o que
 * emprestar, e ninguém mais estuda para ele.
 * ===================================================================== */
function vkOferece(lado) {
  return !!(lado && (lado.material || lado.estudado || lado.ativo));
}

function vkVinculoUtil(a, b) {
  return (!!(a && a.ativo) && vkOferece(b))
      || (!!(b && b.ativo) && vkOferece(a));
}

/* =====================================================================
 * A REVISÃO DOS VÍNCULOS — a faxina
 *
 * ELA É NECESSÁRIA, e a pergunta "esconder não basta?" tem uma resposta
 * concreta: não.
 *
 * Esconder resolve o hoje. Mas um vínculo errado guardado é uma bomba de
 * efeito retardado: no dia em que você escrever um resumo naquele
 * tópico, ele deixa de ser mudo e volta à tela — apontando o material
 * certo para o assunto errado. E aí ele chega com a autoridade de quem
 * tem conteúdo, no meio de um estudo, sem nada por perto que lembre de
 * onde veio.
 *
 * Também há a razão simples: eles são SEUS. Uma resposta de IA aplicada
 * em bloco pode ter criado duzentos pares que você nunca leu um a um, e
 * não existe motivo para carregá-los para sempre.
 *
 * O QUE ESTA FUNÇÃO NÃO FAZ é decidir. Ela agrupa, conta e classifica;
 * apagar é gesto de quem estuda, item a item ou em bloco, com o número
 * na frente. O app não sabe qual vínculo é besteira — ele só sabe qual
 * deles nunca teve nada a dizer.
 * ===================================================================== */
function vkRevisao(fontes) {
  const f = fontes || {};
  const nomeDe = (chave) => (f.editalDoTopico && f.editalDoTopico[chave]) || "";
  const bonito = (chave) => (f.nomeReal && f.nomeReal[chave]) || chave;
  const temMaterial = (chave) => {
    const real = (f.chaveReal && f.chaveReal[chave]) || chave;
    const res = (f.resumos && f.resumos[real]) || null;
    const cart = res && String(res.cartoes || "").trim() ? 1 : 0;
    const leis = ((f.leis && f.leis[real]) || []).length;
    const q = (f.questoes && f.questoes[real]) || 0;
    return !!(res && String(res.texto || "").trim()) || !!cart || leis > 0 || q > 0;
  };
  const estudado = (chave) => !!((f.estudo && f.estudo[chave]) || {}).data;

  const grupos = {};
  const arquivados = [];
  (vinculos || []).forEach((v, i) => {
    const na = nomeDe(v.a) || t("vk_rev_sem_edital");
    const nb = nomeDe(v.b) || t("vk_rev_sem_edital");
    /* o par de editais, sempre na mesma ordem: A↔B e B↔A são o mesmo
     * par, e dois grupos para a mesma coisa dobrariam a lista */
    const par = [na, nb].sort().join("  ↔  ");
    if (!grupos[par]) grupos[par] = { par, itens: [], mudos: 0 };
    /* A MESMA REGRA DA GAVETA, pela mesma função. Enquanto eram duas,
     * elas discordaram: 502 de 513 vínculos vinham rotulados "não
     * levam a nada" porque esta metade ignorava se o outro edital
     * ainda ia acontecer. */
    const lado = (ch) => ({
      material: temMaterial(ch), estudado: estudado(ch),
      ativo: !!(f.editalAtivo && f.editalAtivo[ch]),
    });
    const mudo = !vkVinculoUtil(lado(v.a), lado(v.b));
    const item = {
      i, a: v.a, b: v.b,
      nomeA: bonito(v.a), nomeB: bonito(v.b),
      origem: v.origem || "", sugestao: v.sugestao || "", por: v.por || "",
      modo: v.modo || "estudei", criado: v.criado || "",
      mudo, arq: vkArquivado(v), par,
    };
    /* ARQUIVADO SAI DOS GRUPOS E DAS CONTAS. Se ele continuasse somando
     * em "246 sem historico", arquivar nao mudaria numero nenhum na
     * tela — e uma acao que nao muda nada visivel parece nao ter
     * funcionado. */
    if (item.arq) { arquivados.push(item); return; }
    grupos[par].itens.push(item);
    if (mudo) grupos[par].mudos++;
  });
  const lista = Object.keys(grupos).map((k) => grupos[k])
    .filter((g) => g.itens.length);
  lista.sort((a, b) => b.itens.length - a.itens.length);
  const vivos = lista.reduce((s, g) => s + g.itens.length, 0);
  const mudos = lista.reduce((s, g) => s + g.mudos, 0);
  return {
    grupos: lista,
    arquivados,
    /* "total" e o que esta EM USO, nao o que existe no armazenamento:
     * e o numero que a tela mostra, e ele tem de cair quando se
     * arquiva. */
    total: vivos,
    mudos,
    falantes: vivos - mudos,
  };
}

/* APAGAR OS ESCOLHIDOS. Recebe pares (a,b), não índices: a lista da tela
 * pode ter sido filtrada, e um índice velho apagaria o vizinho. */
function vkApagarPares(pares) {
  let n = 0;
  (pares || []).forEach((p) => { n += vkDesfazer(p.a, p.b); });
  return n;
}

/* =====================================================================
 * ARQUIVAR — a saída que não destrói
 *
 * Apagar um vínculo sem histórico resolve a poluição de hoje e cria um
 * problema de amanhã: no dia em que você escrever um resumo naquele
 * tópico do concurso encerrado, o vínculo teria voltado a falar — e não
 * volta, porque não existe mais. Duzentos e quarenta e seis apagados de
 * uma vez é uma decisão tomada sobre duzentos e quarenta e seis casos
 * que ninguém leu um a um.
 *
 * Arquivar guarda a decisão sem destruir o dado: o vínculo sai da
 * agenda, sai do resumo, sai da lista de revisão — e continua lá, num
 * filtro próprio, de onde volta com um toque.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO: voltar sozinho. Um vínculo que
 * ressuscita porque você escreveu um resumo chegaria no meio de um
 * estudo, com a autoridade de quem tem conteúdo, sem nada por perto que
 * lembrasse de onde veio — e você já o tinha dispensado uma vez.
 * Arquivar É a decisão "não quero ver isto"; desfazê-la tem de ser um
 * gesto seu.
 * ===================================================================== */
function vkArquivado(v) { return !!(v && v.arq); }

function vkArquivar(pares, arquivar) {
  const quer = arquivar !== false;
  let n = 0;
  (pares || []).forEach((p) => {
    vinculos.forEach((v) => {
      if ((v.a === p.a && v.b === p.b) || (v.a === p.b && v.b === p.a)) {
        if (!!v.arq === quer) return;
        if (quer) { v.arq = 1; v.arqEm = new Date().toISOString(); }
        else { delete v.arq; delete v.arqEm; }
        n++;
      }
    });
  });
  if (n) vkSalvar();
  return n;
}

function vkContarArquivados() {
  return (vinculos || []).filter(vkArquivado).length;
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
 * qualquer coisa.
 *
 * =====================================================================
 * UM SALTO, E NÃO TRÊS — corrigido depois do uso real
 * =====================================================================
 *
 * Três saltos foi um erro meu, e o tamanho dele apareceu na tela: um
 * tópico com dois vínculos diretos mostrava OITO na gaveta. A cadeia
 * A→B→C fazia cada tópico puxar a vizinhança da vizinhança, e o painel
 * que deveria responder "o que eu já tenho sobre isto?" respondia com
 * a metade do banco de dados.
 *
 * E o argumento que sustentava os três saltos é o mesmo que agora os
 * derruba: VÍNCULO NÃO É IGUALDADE. Cada elo aceita uma diferença de
 * recorte; três elos somam três diferenças, e o que chega na ponta não
 * é "o mesmo assunto", é um primo distante. Guardar o número de saltos
 * e mostrá-lo na tela não resolve — ninguém lê "3 saltos" e desconta
 * mentalmente a confiança.
 *
 * Então o padrão é UM: o vínculo que VOCÊ afirmou. O que o app deduziu
 * continua calculável (basta pedir mais saltos), e é assim que a faxina
 * de vínculos consegue mostrar a rede inteira quando ela é o assunto. */
const VK_SALTOS_MAX = 1;

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
        /* ARQUIVADO NAO APARECE. E o ponto de arquivar: some da agenda e
         * do resumo, sem deixar de existir. */
        if (vkArquivado(v)) return;
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
  if (!ligados.length) {
    return { temAlgo: false, temEstudo: false, temVinculo: false, itens: [] };
  }

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
      /* ============================================================
       * "FOI ESTUDADO" E "CONSTA NESTE EDITAL" SAO DUAS COISAS
       * ============================================================
       *
       * Este campo misturava as duas, e o resultado foi o aplicativo
       * afirmando um estudo que nunca houve. A ordem era: o que o
       * diario registrou; e, se nao houvesse registro, em qual edital o
       * topico existe. O segundo responde "de onde e este topico?" — e
       * a frase da gaveta em volta dele dizia "Estudado para X".
       *
       * Dois editais marcando 0% estudado apareciam listando oito
       * estudos cada. Nao havia contradicao no dado: havia uma frase
       * colada no dado errado, que e o pior modo de errar, porque
       * parece informacao e ninguem desconfia de informacao.
       *
       * Agora sao dois campos com dois nomes, e quem escreve a frase
       * precisa escolher qual dos dois esta usando: "concurso" so
       * existe quando ha registro no diario. */
      estudado: !!(est && est.data),
      concurso: (est && est.concurso) || "",
      ondeConsta: (f.editalDoTopico && f.editalDoTopico[L.chave]) || "",
      /* O OUTRO EDITAL AINDA VAI ACONTECER?
       * E o que separa "vou estudar os dois, me avise" de "isto e de um
       * concurso que ja passou, so me interessa o material". */
      ativo: !!(f.editalAtivo && f.editalAtivo[L.chave]),
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

  /* =================================================================
   * O QUE MERECE APARECER
   *
   * Uma linha só vale a tela se responder alguma pergunta:
   *
   *   · tem MATERIAL do outro lado — resumo, cartões, lei, questões.
   *     Este é o único motivo que vale para um concurso que já passou:
   *     o registro de "estudei isto para o TCE-PE" não ajuda a decidir
   *     nada hoje, mas o resumo que ficou de lá ajuda muito;
   *   · foi ESTUDADO de verdade, com data no diário;
   *   · o outro edital AINDA VAI ACONTECER — aí a coincidência é o
   *     próprio aviso: você vai estudar isto duas vezes.
   *
   * O que sobra é um vínculo mudo: dois tópicos ligados, nenhum
   * estudado, nada escrito, e o outro concurso encerrado. Ele não é
   * errado — só não tem o que dizer, e oito deles empilhados afogam o
   * único que tinha.
   *
   * Continuam GUARDADOS. Escondê-los é decisão de tela; apagá-los é
   * decisão de quem estuda, e tem lugar próprio (a revisão de
   * vínculos). O dia em que você escrever um resumo naquele tópico, o
   * vínculo mudo volta a falar sozinho. */
  /* A MESMA REGRA, pela mesma função. Deste lado, quem pergunta é o
   * tópico da tela — que está no edital aberto e portanto é o lado
   * ativo; o que se avalia é o que o outro lado oferece. */
  itens.forEach((x) => {
    x.util = vkVinculoUtil({ ativo: true },
      { material: x.temAlgo, estudado: x.estudado, ativo: x.ativo });
  });
  const mudos = itens.filter((x) => !x.util).length;
  /* PERTO E COM MATERIAL PRIMEIRO. Numa cadeia de três concursos o
   * item útil pode ser o mais distante, e enterrá-lo sob um elo vazio
   * é o mesmo que não tê-lo. */
  itens.sort((a, b) => (b.temAlgo ? 1 : 0) - (a.temAlgo ? 1 : 0)
    || (a.saltos - b.saltos));
  /* TRÊS RESPOSTAS, NÃO UMA.
   *
   * "temAlgo" sozinho servia enquanto todo vínculo nascia do diário: se
   * havia vínculo, havia estudo, e quase sempre havia material. No modo
   * "vou estudar os dois" o vínculo nasce ANTES de qualquer estudo — os
   * dois lados vazios — e com uma resposta só a agenda não mostrava
   * nada, justamente no momento em que o aviso mais vale: você está
   * prestes a estudar um assunto que também cai na outra prova.
   *
   * Então:
   *   temVinculo — existe outro tópico ligado a este (a coincidência);
   *   temEstudo  — algum deles foi estudado (o diário registrou);
   *   temAlgo    — algum deles tem material para consultar.
   * São três estados de uma mesma coisa ao longo do tempo, e a agenda
   * diz uma frase diferente em cada um. */
  const uteis = itens.filter((x) => x.util);
  return {
    temAlgo: uteis.some((x) => x.temAlgo),
    /* SÓ COM DATA NO DIÁRIO. Era "algum item tem data", e a data vinha
     * do mesmo campo que também guardava a dedução — por isso a agenda
     * dizia "já estudei em outro" para tópico nenhum estudado. */
    temEstudo: uteis.some((x) => x.estudado),
    /* a coincidência entre dois editais que ainda vão acontecer */
    temCoincidencia: uteis.some((x) => x.ativo && !x.estudado && !x.temAlgo),
    temVinculo: uteis.length > 0,
    /* quantos ficaram de fora, para a tela poder oferecer a faxina em
     * vez de esconder e calar */
    mudos,
    itens: uteis,
    /* NÃO devolve a lista completa. Ela existiu por um instante, "caso
     * alguém precise", e a sabotagem provou o que isso vale: dava para
     * trocá-la pela lista filtrada sem nenhum teste piscar, porque
     * ninguém a lia. Campo que ninguém lê não é opção guardada para o
     * futuro — é uma segunda versão da verdade esperando divergir da
     * primeira. Quem precisa da lista inteira usa vkRevisao, que existe
     * exatamente para isso. */
  };
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
