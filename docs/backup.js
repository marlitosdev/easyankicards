/* =====================================================================
 * BACKUP — um arquivo único para o aplicativo inteiro
 *
 * Regras que este arquivo existe para garantir:
 *  1. UM arquivo, todos os modos. Backup dividido é backup que se restaura
 *     pela metade e deixa o app num estado que ninguém conhecia.
 *  2. FORMATO VERSIONADO. Campo desconhecido é ignorado, campo ausente
 *     ganha padrão — é o que permite restaurar hoje um backup de dezembro.
 *  3. NUNCA restaurar sem dizer ANTES o que vai mudar, com os números dos
 *     dois lados.
 *  4. Restauração é tudo-ou-nada (de verdade desde a v19.15.0 — ver restaurarBackup) e tem volta: antes de trocar,
 *     uma cópia completa do que havia fica neste aparelho (bkGuardarAntes).
 * ===================================================================== */

const BK_FORMATO = "backup/1";

/* Tudo que o app guarda, com o papel de cada chave. A lista é explícita de
 * propósito: varrer o localStorage inteiro levaria junto lixo de outras
 * origens e qualquer coisa que um dia alguém guardar sem pensar. */
const BK_CHAVES = {
  cartoes: ["eac_texto", "eac_recortes", "eac_revisados", "eac_hist"],
  /* "eac_editais" é a lista nova; os dois "eac_edital_*" continuam no backup
   * porque um arquivo gerado antes da v8.68 os traz, e restaurá-lo tem de
   * reconstituir o edital único — que a migração então converte na lista. */
  /* "eac_dificuldade" é o seu julgamento sobre cada tópico — meses de
   * "isto eu não domino" que não se reconstituem de lugar nenhum, e que
   * mandam na ordem da agenda. Ficar de fora do backup faria a agenda
   * voltar ao peso puro do edital depois de restaurar, sem uma linha de
   * aviso: exatamente como "eac_rascunhos" ficou de fora por meses.
   * "eac_plano_snaps" é a série de instantâneos da recomendação. */
  edital: ["eac_editais", "eac_edital_atual", "eac_vinculos", "eac_cm_recibo", "eac_mat_log",
           "eac_edital_texto", "eac_edital_progresso", "eac_edital_diario",
           "eac_dificuldade", "eac_plano_snaps", "eac_dominio_snaps",
           /* a jurisprudência é material do mesmo nível do resumo e da
            * lei seca: meses de teses copiadas dos tribunais, que não
            * se reconstituem de lugar nenhum */
           "eac_juris"],
  /* FORA DO BACKUP, DE PROPÓSITO: "eac_chave_gemini".
   *
   * Toda a lógica deste arquivo é "não esqueça de incluir" — e esta é a
   * única chave em que esquecer seria o certo, então ela precisa estar
   * escrita, ou alguém a acrescenta em seis meses achando que corrige
   * um descuido.
   *
   * Um arquivo de backup é feito para circular: vai para a nuvem, para
   * o e-mail, para o pen drive. Uma chave de API dentro dele vira
   * cobrança na fatura de quem a gerou. Perder a chave num backup custa
   * dez segundos para colar de novo; vazá-la custa dinheiro. */
  /* as questões têm arquivo próprio (não vivem na gaveta do tópico), então
   * precisam entrar no backup por conta: sem esta linha, salvar e carregar
   * a base apagava o banco inteiro em silêncio. */
  /* a rodada em andamento também é trabalho: sem ela no backup, trocar de
   * base joga fora "12 de 31 respondidas" — que é justamente o que a
   * pessoa não quer refazer. */
  /* "eac_leis" é a biblioteca: o texto da lei NÃO fica mais dentro do
   * tópico, então sem esta chave o backup levaria os resumos e deixaria
   * as leis para trás — e a perda só apareceria ao restaurar.
   *
   * "eac_rascunhos" e "eac_fora_da_agenda" estavam faltando desde que
   * foram criados. Restaurar apagava os rabiscos das questões e todos os
   * adiamentos e dispensas, sem uma linha de aviso: o pior tipo de
   * perda, porque a tela depois parece apenas "vazia", não quebrada. */
  material: ["eac_resumos", "eac_questoes", "eac_qs_sessao", "eac_mat_prova",
             "eac_leis", "eac_cit_vinculos", "eac_rascunhos", "eac_fora_da_agenda", "eac_qs_hist", "eac_mc_parei", "eac_lixeira",
             "eac_decisoes", "eac_decisoes_resumo",
             /* (v19.8.0) as marcas do lápis: moram no IndexedDB e só entram com a opção ligada (tnParaBackup) */
             "eac_tinta",
             /* (v19.11.0) as seções do resumo já lidas: o trabalho de saber o que falta ler */
             "eac_mat_lidas",
             /* (v19.12.0) as pastas livres de leis e julgados (só nomes e atalhos) */
             "eac_pastas"],
  /* O HISTÓRICO DAS CÓPIAS FICA DE FORA, de propósito.
   *
   * Ele é sobre ESTE aparelho: quais arquivos existem na pasta de
   * downloads daqui. Levado num backup para outro computador, listaria
   * cópias que não estão lá — e a lista serve justamente para você
   * achar o arquivo certo. Uma lista que aponta para o nada é pior do
   * que nenhuma. */
  preferencias: ["eac_estudo_dias", "eac_estudo_inicio",
                 "eac_deck", "eac_titulo", "eac_lang", "eac_theme", "eac_cor",
    "eac_style", "eac_alinha", "eac_2col", "eac_destaque", "eac_gaveta",
    "eac_maisCampos", "eac_modo", "eac_ampliar", "eac_edital_vista",
    /* o tamanho da caixa de responder: quem escolheu letra maior
     * escolheu por precisar dela, e restaurar num aparelho novo com
     * a letra pequena de volta é desfazer uma decisão de acessibilidade */
    "eac_qs_tamanho",
    /* a meta de ramos por semana, por edital */
    "eac_meta_ramos",
    /* a agenda de estudo dos cartões (quando cada um volta), o modo e o limite de novos por dia */
    "eac_cartao_estudo", "eac_cartao_estudo_dia", "eac_est_modo", "eac_est_novos_dia"],
};

function bkLer(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}

/* "eac_leis" (17.38.0) pode já não estar no localStorage — migrou para o IndexedDB, e
 * leisLerTudo() sabe de onde ler de qualquer jeito (cache em memória ou localStorage,
 * conforme a migração já tenha terminado ou não). Ler/gravar essa chave sempre passa por
 * leisLerTudo/leisGravarTudo em vez do localStorage direto, senão um backup feito depois
 * da migração sairia sem lei nenhuma. */
function bkLerLeis() {
  try { return typeof leisLerTudo === "function" ? JSON.stringify(leisLerTudo()) : bkLer("eac_leis"); }
  catch (e) { return bkLer("eac_leis"); }
}

/* "eac_decisoes" (17.39.0, Fase B) — mesma história de "eac_leis": pode já ter migrado
 * para o IndexedDB, e decLer() sabe de onde ler de qualquer jeito. */
function bkLerDecisoes() {
  try { return typeof decLer === "function" ? JSON.stringify(decLer()) : bkLer("eac_decisoes"); }
  catch (e) { return bkLer("eac_decisoes"); }
}

/* "eac_juris" (18.44.0, JM6) — a mesma história: depois de migrar, o localStorage não tem mais a chave e o backup
 * sairia SEM os julgados; jurLerTudo() sabe ler de onde estiverem. */
function bkLerJuris() {
  try { return typeof jurLerTudo === "function" ? JSON.stringify(jurLerTudo()) : bkLer("eac_juris"); }
  catch (e) { return bkLer("eac_juris"); }
}

/* (v18.45.0) AS GRAVAÇÕES DO INDEXEDDB TERMINARAM? Leis, decisões e julgados são gravados em segundo plano; restaurar um
 * backup e recarregar a página logo depois pode cortar a gravação no meio — e o recarregamento acharia o IndexedDB vazio
 * (visto no navegador: restaurar + recarregar na hora deixou 0 leis e 0 julgados). Quem vai recarregar espera por isto. */
function bkAguardarGravacoes() {
  const p = [];
  try { if (typeof _leisGravando !== "undefined" && _leisGravando) p.push(_leisGravando); } catch (e) {}
  try { if (typeof _decGravando !== "undefined" && _decGravando) p.push(_decGravando); } catch (e) {}
  try { if (typeof _tnGravando !== "undefined" && _tnGravando) p.push(_tnGravando); } catch (e) {}
  try { if (typeof _jurGravando !== "undefined" && _jurGravando) p.push(_jurGravando); } catch (e) {}
  return Promise.all(p).then(() => p.length, () => p.length);
}

function montarBackup() {
  const dados = {};
  Object.keys(BK_CHAVES).forEach((grupo) => {
    dados[grupo] = {};
    BK_CHAVES[grupo].forEach((k) => {
      const v = k === "eac_leis" ? bkLerLeis() : k === "eac_decisoes" ? bkLerDecisoes() : k === "eac_juris" ? bkLerJuris()
        : k === "eac_tinta" ? (typeof tnParaBackup === "function" ? tnParaBackup() : null) : bkLer(k);
      if (v !== null) dados[grupo][k] = v;
    });
  });
  return {
    app: "EasyAnkiCards",
    formato: BK_FORMATO,
    gerado: new Date().toISOString(),
    versao_app: typeof VERSAO === "string" ? VERSAO : "?",
    resumo: resumirBackup(dados),
    dados,
  };
}

/* O resumo vai DENTRO do arquivo. Assim dá para dizer o que tem num backup
 * sem restaurá-lo — que é a pergunta de quem está com dois arquivos na mão
 * e não sabe qual é o bom. */
function resumirBackup(dados) {
  const conta = (txt, re) => (String(txt || "").match(re) || []).length;
  const jsonN = (s) => { try { const o = JSON.parse(s); return Array.isArray(o)
    ? o.length : Object.keys(o || {}).length; } catch (e) { return 0; } };
  const c = (dados.cartoes || {}), e = (dados.edital || {}), m = (dados.material || {});
  /* com vários editais, contar só o "edital único" mentiria: o resumo soma a
   * lista inteira, que é o que a pessoa reconhece ao olhar dois backups */
  let lista = [];
  try { lista = JSON.parse(e.eac_editais || "[]"); } catch (x) { lista = []; }
  if (!Array.isArray(lista)) lista = [];
  const textoTodos = lista.map((x) => x.texto || "").join("\n")
    + "\n" + (e.eac_edital_texto || "");
  const progTodos = lista.reduce((a, x) => a + Object.keys(x.progresso || {}).length, 0);
  return {
    cartoes: conta(c.eac_texto, /^[^\n#].*::/gm),
    bandeja: jsonN(c.eac_recortes),
    editais: lista.length,
    disciplinas: conta(textoTodos, /^\s*@/gm),
    topicos: conta(textoTodos, /^\s*\+/gm),
    progresso: progTodos || jsonN(e.eac_edital_progresso),
    diario: jsonN(e.eac_edital_diario),
    resumos: jsonN(m.eac_resumos),
    questoes: jsonN(m.eac_questoes),
    /* =================================================================
     * OS TRÊS QUE FALTAVAM NA CONFERÊNCIA
     *
     * "questoes" já era contado aqui e não aparecia na tabela — só
     * faltava o rótulo. Lei seca e jurisprudência não eram contadas de
     * jeito nenhum, embora as duas estejam no backup desde que foram
     * criadas.
     *
     * O efeito era ruim justamente no momento mais perigoso do
     * aplicativo: escolher qual arquivo restaurar. A tabela dizia
     * "cartões, editais, tópicos, resumos" e calava sobre três acervos
     * inteiros — dava para trocar uma base com 8 julgados por outra com
     * 0 sem que uma linha da tela mencionasse julgados.
     *
     * ARTIGOS, e não só o número de leis: "3 leis" não distingue três
     * artigos colados às pressas de três códigos inteiros, e é essa
     * diferença que se quer ver comparando dois arquivos.
     * ================================================================= */
    leis: jsonN(m.eac_leis),
    artigos: (() => {
      let o = {};
      try { o = JSON.parse(m.eac_leis || "{}") || {}; } catch (x) { o = {}; }
      return Object.keys(o).reduce((soma, k) => soma
        + conta((o[k] || {}).texto, /^\s*Art\.?\s*\d/gmi), 0);
    })(),
    juris: jsonN(e.eac_juris),
  };
}

function resumoAtual() { return resumirBackup(montarBackup().dados); }

/* Compara o backup com o que está no app AGORA. É o que a tela mostra antes
 * de perguntar "substituir?" — sem isto o usuário decide no escuro. */
function compararBackup(bk) {
  const agora = resumoAtual();
  /* CONTA O QUE ESTÁ NO ARQUIVO, e não o que ele diz de si mesmo.
   *
   * "bk.resumo" é o resumo gravado por QUEM GEROU o arquivo — uma
   * versão anterior do aplicativo, que não conhecia lei seca nem
   * jurisprudência nem questões na tabela. Confiar nele faria as linhas
   * novas mostrarem ZERO num arquivo que tem os dados lá dentro; e zero
   * na coluna "backup" é lido como "vai perder tudo isso", que é o
   * oposto da verdade.
   *
   * Recontar dos dados custa um JSON.parse e responde pelo arquivo que
   * está na mão. O resumo gravado fica como último recurso, para o caso
   * de um arquivo sem "dados" — que a validação já recusa, mas que não
   * custa nada respeitar aqui. */
  const dele = (bk && bk.dados)
    ? resumirBackup(bk.dados)
    : ((bk && bk.resumo) || resumirBackup({}));
  const linhas = [];
  const rotulos = {
    cartoes: "cartões", bandeja: "cartões na bandeja",
    editais: "editais cadastrados",
    disciplinas: "disciplinas", topicos: "tópicos do edital",
    progresso: "tópicos marcados", diario: "registros de estudo",
    resumos: "resumos",
    /* os três que a tabela calava — ver resumirBackup */
    questoes: "questões", leis: "leis guardadas",
    artigos: "artigos de lei", juris: "julgados",
  };
  Object.keys(rotulos).forEach((k) => {
    const a = agora[k] || 0, b = dele[k] || 0;
    if (!a && !b) return;
    linhas.push({ chave: k, rotulo: rotulos[k], agora: a, backup: b,
      perde: b < a, ganha: b > a });
  });
  return { linhas, agora, backup: dele,
    perdeAlgo: linhas.some((l) => l.perde) };
}

function validarBackup(obj) {
  if (!obj || typeof obj !== "object") return "arquivo não é um backup";
  if (obj.app !== "EasyAnkiCards") return "este arquivo não é do EasyAnkiCards";
  if (!obj.dados || typeof obj.dados !== "object") return "backup sem dados";
  /* formato futuro: avisa mas deixa tentar — campo desconhecido é ignorado
   * na restauração, e recusar por número de versão trava quem voltou de um
   * aparelho mais novo */
  return null;
}

/* =====================================================================
 * (v19.15.0) TUDO-OU-NADA DE VERDADE
 *
 * A regra 4 lá de cima estava escrita, mas não era cumprida: cada chave era gravada com um "catch" vazio. Faltou
 * espaço no meio (o localStorage tem teto) e metade das chaves vinha do arquivo, metade ficava como estava — e a
 * tela dizia "restaurado". Uma parte estragada do arquivo (JSON quebrado na lei, nos julgados) era pulada calada.
 * Agora, em três passos:
 *  1. LER E CONFERIR TUDO antes de gravar qualquer coisa — parte estragada recusa o arquivo inteiro;
 *  2. gravar o localStorage guardando o valor de antes de cada chave, e CONFERIR o que ficou gravado; falhou → volta
 *     cada chave ao que era;
 *  3. só então leis, julgados, decisões e marcas do lápis (que vão para o IndexedDB pelas funções deles); falhou →
 *     volta estas e as do passo 2.
 * O erro diz se o desfazer deu certo ("desfeito") — se não deu, a pessoa precisa saber que há a cópia de antes.
 * ===================================================================== */
const BK_ESPECIAIS = {
  eac_leis: { pode: () => typeof leisGravarTudo === "function", ler: () => bkLerLeis(), gravar: (o) => leisGravarTudo(o), vazio: () => ({}), serve: bkEhObjeto },
  /* (JM6) os julgados também passam pela função (que sabe gravar no IndexedDB, se já migrou) */
  eac_juris: { pode: () => typeof jurGravarTudo === "function", ler: () => bkLerJuris(), gravar: (o) => jurGravarTudo(o), vazio: () => ({}), serve: bkEhObjeto },
  eac_decisoes: { pode: () => typeof decDefinirTudo === "function", ler: () => bkLerDecisoes(), gravar: (o) => decDefinirTudo(o), vazio: () => [], serve: Array.isArray },
  /* as marcas do lápis nunca vão ao localStorage; o "ler" pega as guardadas mesmo com a opção de backup desligada */
  eac_tinta: { pode: () => true, ler: () => bkLerTintaToda(), gravar: (o) => { if (typeof tnRestaurarTudo === "function") tnRestaurarTudo(o); }, vazio: () => ({}), serve: bkEhObjeto },
};
function bkEhObjeto(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
function bkLerTintaToda() {
  try { return typeof tnSalvos !== "undefined" && tnSalvos ? JSON.stringify(tnSalvos) : null; } catch (e) { return null; }
}
function bkErro(tipo, k, desfeito, causa) {
  const nome = (causa && causa.name) || "";
  const txt = typeof t === "function" ? t("bk_err_" + tipo, { k }) : tipo + ": " + k;
  const e = new Error(txt);
  e.tipo = tipo; e.chave = k; e.desfeito = desfeito !== false; e.causa = nome;
  return e;
}

/* Tudo-ou-nada: confere o conjunto inteiro primeiro, grava depois, e desfaz se algo falhar no meio.
 *
 * opc.exato (lista de chaves): VOLTAR A UMA CÓPIA tem de ser exato. O restauro comum só grava as chaves que o arquivo
 * traz (um backup de dezembro não conhece as chaves novas, e apagá-las seria perder dado); mas a cópia de antes do
 * restauro foi tirada DESTE app — uma chave da lista dela que não está nela não existia naquela hora, e o que o arquivo
 * restaurado trouxe a mais tem de sair. Só as chaves da lista gravada na cópia: uma chave criada numa versão posterior
 * nunca é apagada por uma cópia antiga. */
function restaurarBackup(bk, opc) {
  const erro = validarBackup(bk);
  if (erro) throw new Error(erro);
  const aplicar = [];
  Object.keys(BK_CHAVES).forEach((grupo) => {
    const g = bk.dados[grupo] || {};
    BK_CHAVES[grupo].forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(g, k)) aplicar.push([k, g[k]]);
    });
  });
  if (!aplicar.length) throw new Error("backup vazio");
  const exato = opc && Array.isArray(opc.exato) ? opc.exato : null;
  if (exato) {
    const tem = {};
    aplicar.forEach(([k]) => { tem[k] = true; });
    Object.keys(BK_CHAVES).forEach((g) => BK_CHAVES[g].forEach((k) => {
      if (!tem[k] && exato.indexOf(k) >= 0) aplicar.push([k, undefined]);
    }));
  }

  /* 1. ler e conferir — nada gravado ainda */
  const loc = [], esp = [];
  aplicar.forEach(([k, v]) => {
    const E = BK_ESPECIAIS[k];
    if (v === undefined) { if (E && E.pode()) esp.push([k, E.vazio()]); else loc.push([k, null]); return; }   /* exato: não existia */
    if (!E || !E.pode()) { loc.push([k, v == null ? "" : String(v)]); return; }
    let o;
    try { o = v == null || v === "" ? null : JSON.parse(v); } catch (x) { throw bkErro("parte", k); }
    if (o == null) o = E.vazio();
    if (!E.serve(o)) throw bkErro("parte", k);
    esp.push([k, o]);
  });

  /* 2. o localStorage, com o valor de antes de cada chave */
  const antes = [];
  const desfazerLoc = () => {
    let ok = true;
    antes.slice().reverse().forEach(([k, velho]) => {
      try { if (velho === null) localStorage.removeItem(k); else localStorage.setItem(k, velho); }
      catch (x) { ok = false; }
    });
    return ok;
  };
  for (const [k, v] of loc) {
    const velho = bkLer(k);
    /* setItem que falha não muda a chave: ela não entra na lista do desfazer */
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    catch (x) { const ok = desfazerLoc(); throw bkErro(x && /quota/i.test(x.name + " " + x.message) ? "espaco" : "gravar", k, ok, x); }
    antes.push([k, velho]);
    if (bkLer(k) !== v) { const ok = desfazerLoc(); throw bkErro("conferir", k, ok); }
  }

  /* 3. leis, julgados, decisões, lápis */
  const antesEsp = [];
  for (const [k, o] of esp) {
    const E = BK_ESPECIAIS[k];
    const velho = E.ler();
    try { E.gravar(o); antesEsp.push([k, velho]); }
    catch (x) {
      let ok = true;
      /* a que falhou também é posta de volta, por garantia — mas recusar de novo não conta como "não desfeito": quem
       * recusou gravar, em regra, não chegou a gravar nada */
      try { E.gravar(velho == null ? E.vazio() : JSON.parse(velho)); } catch (y) {}
      antesEsp.slice().reverse().forEach(([k2, s]) => {
        const E2 = BK_ESPECIAIS[k2];
        try { E2.gravar(s == null ? E2.vazio() : JSON.parse(s)); } catch (y) { ok = false; }
      });
      ok = desfazerLoc() && ok;
      throw bkErro("gravar", k, ok, x);
    }
  }

  /* 4. AS FUNÇÕES DO PASSO 3 TAMBÉM GRAVAM NO localStorage. decDefinirTudo regrava "eac_decisoes_resumo" com o resumo
   * que está na MEMÓRIA — o deste aparelho —, por cima do que acabou de vir do arquivo (visto no navegador, ao voltar a
   * uma cópia). Cada chave do passo 2 é relida e, se mudou, gravada de novo como veio. */
  for (const [k, v] of loc) {
    if (bkLer(k) === v) continue;
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (x) { /* conferido abaixo */ }
    if (bkLer(k) !== v) {
      let ok = true;
      antesEsp.slice().reverse().forEach(([k2, s2]) => {
        const E2 = BK_ESPECIAIS[k2];
        try { E2.gravar(s2 == null ? E2.vazio() : JSON.parse(s2)); } catch (y) { ok = false; }
      });
      ok = desfazerLoc() && ok;
      throw bkErro("conferir", k, ok);
    }
  }
  return aplicar.length;
}

/* =====================================================================
 * (v19.15.0) A CÓPIA DE ANTES DO RESTAURO
 *
 * A confirmação prometia "o estado atual vai para o histórico de versões". Era só o texto da bancada — e nem ele
 * sobrevivia: o restauro gravava por cima o histórico que vinha no arquivo. Restaurar o arquivo errado não tinha volta
 * para questões, resumos, edital, leis.
 *
 * Agora, antes de trocar, o app guarda uma CÓPIA COMPLETA do que tem (o mesmo conteúdo de um backup, mais as marcas do
 * lápis) no IndexedDB deste aparelho. Ficam as 3 últimas; "voltar" passa pela mesma tabela de conferência de um
 * arquivo. Uma cópia igual à mais recente não entra de novo — restaurar três vezes o mesmo arquivo errado não pode
 * empurrar para fora a cópia boa. Não vai no backup: é sobre ESTE aparelho, como "eac_backup_hist".
 * ===================================================================== */
const BK_ANTES_MAX = 3;
const BK_ANTES_IDB = "eac_idb_backup";
const BK_ANTES_LOJA = "antes";
let bkAntesLojaUsada = null;   /* {ler(): Promise<lista>, gravar(lista): Promise} — trocável nos testes */

function bkAntesLojaIdb() {
  const abrir = () => new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined" || !indexedDB) { reject(new Error("sem indexedDB")); return; }
    let req;
    try { req = indexedDB.open(BK_ANTES_IDB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(BK_ANTES_LOJA)) db.createObjectStore(BK_ANTES_LOJA); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("erro ao abrir o indexedDB das cópias"));
    req.onblocked = () => reject(new Error("indexedDB bloqueado"));
  });
  const tx = (modo, fn) => abrir().then((db) => new Promise((resolve, reject) => {
    const x = db.transaction([BK_ANTES_LOJA], modo);
    let out;
    const req = fn(x.objectStore(BK_ANTES_LOJA));
    if (req) req.onsuccess = () => { out = req.result; };
    x.oncomplete = () => { db.close(); resolve(out); };
    x.onerror = () => { db.close(); reject(x.error || new Error("erro no indexedDB das cópias")); };
    x.onabort = () => { db.close(); reject(x.error || new Error("gravação da cópia abortada (sem espaço?)")); };
  }));
  return {
    ler: () => tx("readonly", (l) => l.get("lista")).then((v) => (Array.isArray(v) ? v : [])),
    gravar: (lista) => tx("readwrite", (l) => { l.put(lista, "lista"); return null; }),
  };
}
function bkAntesLoja() { return bkAntesLojaUsada || (bkAntesLojaUsada = bkAntesLojaIdb()); }
function bkAntesLojaDefinir(l) { bkAntesLojaUsada = l; }

function bkChavesTodas() { return Object.keys(BK_CHAVES).reduce((a, g) => a.concat(BK_CHAVES[g]), []); }
/* o backup inteiro de agora, com as marcas do lápis mesmo se a opção de levá-las no backup estiver desligada */
function bkCopiaCompleta() {
  const b = montarBackup();
  const tinta = bkLerTintaToda();
  if (tinta && b.dados.material && !b.dados.material.eac_tinta) b.dados.material.eac_tinta = tinta;
  return b;
}
function bkAntesLer() { return bkAntesLoja().ler().catch(() => []); }
/* guarda a cópia; devolve a cópia guardada (ou a que já era igual). Rejeita se não conseguiu — quem chama decide. */
async function bkGuardarAntes(motivo) {
  const bk = bkCopiaCompleta();
  const lista = await bkAntesLoja().ler();
  const ult = lista[0];
  if (ult && ult.bk && JSON.stringify(ult.bk.dados) === JSON.stringify(bk.dados)) return ult;
  /* "chaves": as que este app conhecia ao tirar a cópia — o voltar exato só mexe nelas */
  const copia = { quando: new Date().toISOString(), motivo: String(motivo || ""), chaves: bkChavesTodas(), bk };
  await bkAntesLoja().gravar([copia].concat(lista).slice(0, BK_ANTES_MAX));
  return copia;
}

function nomeArquivoBackup() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return "easyankicards-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
    + "-" + p(d.getHours()) + p(d.getMinutes()) + ".json";
}

/* Idade da base em dias, para o app poder dizer de quando é o que você está
 * usando — a informação que faltava para alguém perceber que abriu o app num
 * aparelho onde o backup é de três semanas atrás. */
/* DIAS DE CALENDÁRIO, e não horas divididas por 24.
 *
 * O defeito: uma cópia feita ONTEM às 20:47, olhada hoje às 15:44, tem
 * 19 horas de idade — menos de um dia. Dividindo por 86400000 dá zero,
 * e a tela dizia "hoje, 20:47" para um arquivo de ontem, mostrando uma
 * hora que ainda não chegou. É o mesmo erro do "há 0d" que este trecho
 * tinha acabado de substituir, com outra roupa: "quanto tempo passou"
 * não responde "que dia foi".
 *
 * A conta certa zera as horas dos dois lados e conta as viradas de
 * meia-noite entre eles — que é o que "ontem" quer dizer para quem
 * fala. E usa horário LOCAL: a virada do dia é a do aparelho, não a de
 * Greenwich, ou quem salva às 22h no Brasil vê "amanhã". */
function bkDiasDeCalendario(iso, agora) {
  const a = new Date(iso);
  const b = agora ? new Date(agora) : new Date();
  if (isNaN(a.getTime())) return 0;
  const meiaNoite = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((meiaNoite(b) - meiaNoite(a)) / 86400000);
}

function idadeBase() {
  const q = bkLer("eac_backup_em");
  if (!q) return null;
  return { quando: q, dias: bkDiasDeCalendario(q) };
}

/* =====================================================================
 * O HISTÓRICO DAS CÓPIAS
 *
 * "base de 04/09/2026 · há 0d" não responde a pergunta que se faz de
 * verdade: salvei três vezes hoje — esta que está carregada é qual das
 * três? Data sem hora não distingue nada dentro do mesmo dia, e "há 0d"
 * é a informação menos útil possível.
 *
 * O que responde é o NOME DO ARQUIVO, porque ele já carrega hora e
 * minuto (easyankicards-20260904-2047.json) e é o que aparece na pasta
 * de downloads. Guardando as últimas cópias com hora, destino e nome, a
 * pergunta vira uma leitura.
 * ===================================================================== */
const BK_HIST_CHAVE = "eac_backup_hist";
const BK_HIST_MAX = 8;

function bkHistorico() {
  try {
    const L = JSON.parse(localStorage.getItem(BK_HIST_CHAVE) || "[]");
    return Array.isArray(L) ? L : [];
  } catch (e) { return []; }
}

/* "onde" é download, pasta ou compartilhado; "nome" é o arquivo. O
 * resumo vai junto porque é o que permite reconhecer a cópia mesmo sem
 * o arquivo à mão: "aquela com 47 disciplinas". */
function bkRegistrarCopia(onde, nome, quando) {
  const q = quando || new Date().toISOString();
  const item = { quando: q, onde: onde || "?", nome: nome || "",
                 resumo: resumoAtual() };
  const L = [item].concat(bkHistorico()).slice(0, BK_HIST_MAX);
  try { localStorage.setItem(BK_HIST_CHAVE, JSON.stringify(L)); } catch (e) {}
  return L;
}

/* A cópia que corresponde ao que está carregado agora — casada pelo
 * instante, que é o mesmo que "eac_backup_em" guarda. */
function bkCopiaAtual() {
  const q = bkLer("eac_backup_em");
  if (!q) return null;
  return bkHistorico().filter((x) => x && x.quando === q)[0] || null;
}

/* Quantas cópias foram feitas no MESMO dia desta. É o número que
 * explica por que a data sozinha não bastava. */
function bkCopiasNoDia(iso) {
  const dia = String(iso || "").slice(0, 10);
  if (!dia) return 0;
  return bkHistorico().filter((x) => String(x.quando || "").slice(0, 10) === dia).length;
}
