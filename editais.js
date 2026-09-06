/* =====================================================================
 * EDITAIS — vários planos, não um
 *
 * Até a v8.67 existia UM edital, em "eac_edital_texto". A partir daqui há
 * uma lista, e o app precisa responder três perguntas que antes não faziam
 * sentido: qual edital está aberto, quais estão ativos, e como a agenda da
 * semana combina tópicos de concursos diferentes.
 *
 * A migração é a parte que não pode falhar: quem já tem um edital com meses
 * de progresso marcado não pode abrir o app e encontrar a lista vazia.
 * ===================================================================== */

let editais = [];
let editalAtual = null;      /* id do edital aberto, ou null = tela de lista */

function edNovoId() {
  return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function edCarregarLista() {
  try { editais = JSON.parse(localStorage.getItem("eac_editais") || "[]"); }
  catch (e) { editais = []; }
  if (!Array.isArray(editais)) editais = [];

  /* Migração do edital único. Só acontece uma vez, e só quando há o que
   * migrar: sem isto, quem já usava o app perderia texto e progresso na
   * atualização — o tipo de perda que não se percebe até ser tarde. */
  if (!editais.length) {
    let txt = null, prog = "{}";
    try {
      txt = localStorage.getItem("eac_edital_texto");
      prog = localStorage.getItem("eac_edital_progresso") || "{}";
    } catch (e) {}
    if (txt && txt.trim()) {
      const cfg = (typeof lerEdital === "function" ? lerEdital(txt).cfg : {}) || {};
      editais.push({
        id: edNovoId(),
        nome: cfg.concurso || "Edital importado",
        texto: txt,
        progresso: (() => { try { return JSON.parse(prog); } catch (e) { return {}; } })(),
        criado: new Date().toISOString(),
        tocado: new Date().toISOString(),
        migrado: true,
      });
      edSalvarLista();
      if (typeof reg === "function")
        reg("EDITAL", "edital único migrado para a lista", cfg.concurso || "sem nome");
    }
  }
  try { editalAtual = localStorage.getItem("eac_edital_atual") || null; } catch (e) {}
  if (editalAtual && !editais.some((x) => x.id === editalAtual)) editalAtual = null;
  return editais;
}

function edSalvarLista() {
  guardar("eac_editais", JSON.stringify(editais));
}

function edAberto() {
  return editais.find((x) => x.id === editalAtual) || null;
}

function edAbrir(id) {
  editalAtual = id || null;
  try {
    if (id) localStorage.setItem("eac_edital_atual", id);
    else localStorage.removeItem("eac_edital_atual");
  } catch (e) {}
  const e = edAberto();
  if (e) { e.tocado = new Date().toISOString(); edSalvarLista(); }
  return e;
}

function edCriar(nome, texto) {
  const e = {
    id: edNovoId(), nome: nome || "Novo edital", texto: texto || "",
    progresso: {}, criado: new Date().toISOString(), tocado: new Date().toISOString(),
  };
  editais.push(e);
  edSalvarLista();
  return e;
}

function edApagar(id) {
  const i = editais.findIndex((x) => x.id === id);
  if (i < 0) return false;
  editais.splice(i, 1);
  if (editalAtual === id) edAbrir(null);
  edSalvarLista();
  /* vínculo apontando para edital apagado continuaria marcando "já estudei"
   * num concurso que não existe mais */
  if (typeof vkPodar === "function") vkPodar(editais.map((x) => x.id));
  return true;
}

function edDuplicar(id) {
  const o = editais.find((x) => x.id === id);
  if (!o) return null;
  /* progresso NÃO vem junto: duplicar serve para reaproveitar o edital em
   * outro cargo, e herdar o progresso do outro concurso seria mentir sobre
   * o que já foi estudado ali */
  const c = edCriar(o.nome + " (cópia)", o.texto);
  return c;
}

/* ------------------------------------------------------------------
 * SITUAÇÃO DE CADA EDITAL
 * Três grupos, e a régua é a data da prova — que é a única coisa que
 * torna um edital mais urgente que outro.
 * ------------------------------------------------------------------ */
const ED_PROXIMO_DIAS = 120;   /* quatro meses: dentro disso a prova manda */

/* Meia-noite LOCAL do dia informado. Aceita "AAAA-MM-DD" (que o
 * construtor parsearia como UTC, deslocando o dia) e Date. */
function leiHojeZero(hoje) {
  if (typeof hoje === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hoje)) {
    return new Date(hoje + "T00:00:00");
  }
  const d = hoje ? new Date(hoje) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function edSituacao(e, hoje) {
  const cfg = (typeof lerEdital === "function" ? lerEdital(e.texto || "").cfg : {}) || {};
  let prova = cfg.prova || "";
  let fase = 1;
  /* A DATA QUE IMPORTA É A PRÓXIMA, NÃO A PRIMEIRA.
   * Sem isto, a SEFAZ-AL viraria "encerrada" no dia 14 de dezembro — com
   * a discursiva de janeiro ainda pela frente — e sumiria da agenda
   * exatamente no mês em que ela precisa aparecer todos os dias. */
  if (cfg.fase2 && cfg.fase2.prova && prova) {
    const zero = (d) => new Date(d + "T00:00:00");
    const agora = hoje ? new Date(hoje) : new Date();
    if (zero(prova) < agora && zero(cfg.fase2.prova) >= agora) {
      prova = cfg.fase2.prova;
      fase = 2;
    }
  }
  if (!prova) return { grupo: "sem_data", dias: null, prova: "", fase, cfg };
  const fim = new Date(prova + "T00:00:00");
  if (isNaN(fim)) return { grupo: "sem_data", dias: null, prova: "", fase, cfg };
  /* DIAS DE CALENDÁRIO, NÃO HORAS DECORRIDAS.
   * A data da prova é meia-noite local; "agora" é uma hora qualquer do
   * dia. A subtração crua dava 89,1 dias para uma prova daqui a 90, e a
   * tela mostrava 89 — contra os 90 que qualquer pessoa conta no
   * calendário. O erro crescia com o passar do dia.
   *
   * O zeramento tem de respeitar o formato de "hoje": vindo como texto
   * "AAAA-MM-DD" ele é parseado em UTC, e ler getDate() dele (que é
   * local) tira um dia inteiro em qualquer fuso a oeste de Greenwich.
   * O teste E14 pegou exatamente isso. */
  const ini = leiHojeZero(hoje);
  const dias = Math.round((fim - ini) / 86400000);
  /* DIAS É SEMPRE UM NÚMERO POSITIVO — o que muda é o que ele conta.
   * Antes o encerrado saía com dias negativo e a tela imprimia "−6 dias",
   * literal. "Dias" para quem lê significa "quanto falta"; para uma prova
   * que passou, o número que importa é "há quanto tempo", e são duas
   * grandezas diferentes com o mesmo nome. Agora vêm separadas. */
  if (dias < 0) {
    return { grupo: "encerrado", dias: null, desde: Math.abs(dias), prova, fase, cfg };
  }
  return { grupo: dias <= ED_PROXIMO_DIAS ? "proximo" : "sem_data", dias, prova, fase, cfg };
}

/* ordem: prova mais próxima primeiro; sem data depois; encerrados por último */
const ED_ORDEM_GRUPO = { proximo: 0, sem_data: 1, encerrado: 2 };

function edAgrupados(filtro, hoje) {
  const f = (filtro || "").trim().toLowerCase();
  const lista = editais
    .map((e) => {
      const s = edSituacao(e, hoje);
      const r = typeof lerEdital === "function" ? lerEdital(e.texto || "") : null;
      const tops = r ? r.disciplinas.reduce((a, d) => a + d.topicos.length, 0) : 0;
      const feitos = Object.keys(e.progresso || {}).length;
      return Object.assign({}, e, {
        sit: s, disciplinas: r ? r.disciplinas.length : 0,
        topicos: tops, feitos,
        pct: tops ? Math.round((feitos / tops) * 100) : 0,
      });
    })
    .filter((e) => !f || (e.nome + " " + (e.sit.cfg.concurso || "")).toLowerCase().includes(f));
  lista.sort((a, b) => {
    const g = ED_ORDEM_GRUPO[a.sit.grupo] - ED_ORDEM_GRUPO[b.sit.grupo];
    if (g) return g;
    if (a.sit.dias !== null && b.sit.dias !== null) return a.sit.dias - b.sit.dias;
    return String(b.tocado).localeCompare(String(a.tocado));
  });
  const grupos = { proximo: [], sem_data: [], encerrado: [] };
  lista.forEach((e) => grupos[e.sit.grupo].push(e));
  return grupos;
}

/* ------------------------------------------------------------------
 * A AGENDA É DE ESTUDOS, NÃO DE UM EDITAL
 * A semana combina os tópicos de TODOS os editais ativos. Comparar peso
 * entre concursos diferentes só faz sentido depois de considerar a
 * urgência: um tópico de peso médio numa prova em três semanas vale mais
 * que um de peso alto numa prova sem data marcada.
 * ------------------------------------------------------------------ */
function edUrgencia(sit) {
  if (sit.grupo === "encerrado") return 0;         /* fora da conta */
  if (sit.dias === null) return 0.5;               /* sem data: metade do peso */
  if (sit.dias <= 30) return 2;
  if (sit.dias <= 90) return 1.5;
  if (sit.dias <= 180) return 1.15;
  return 1;
}

function edTopicosAtivos(opcoes) {
  const o = opcoes || {};
  const juntos = [];
  editais.forEach((e) => {
    const s = edSituacao(e, o.hoje);
    if (s.grupo === "encerrado") return;
    if (typeof lerEdital !== "function" || typeof montarPlano !== "function") return;
    const r = lerEdital(e.texto || "");
    const p = montarPlano(r, { horas: 100, prova: s.prova, hoje: o.hoje,
                               feitos: e.progresso || {} });
    const u = edUrgencia(s);
    p.itens.forEach((i) => {
      i.edital = e.id;
      i.editalNome = e.nome;
      i.urgencia = u;
      i.pesoAjustado = i.bruto * u;
      juntos.push(i);
    });
  });
  juntos.sort((a, b) => b.pesoAjustado - a.pesoAjustado);
  return juntos;
}

/* =====================================================================
 * COMPARATIVO ENTRE EDITAIS
 *
 * Somar a cobertura de dois concursos produz um número que não existe:
 * ninguém presta uma prova média. "11% do peso de todas as minhas provas"
 * não corresponde a nada que se possa decidir.
 *
 * Com dois ou mais editais ativos, a pergunta também muda: deixa de ser
 * "quanto já cobri?" e passa a ser "estou abandonando um deles?". Isso só
 * uma linha por edital responde — e a coluna que decide é a última, a
 * projeção, porque é ela que mostra qual prova ainda dá tempo de salvar.
 * ===================================================================== */
function comparativoEditais(diario, hoje) {
  const linhas = [];
  editais.forEach((e) => {
    const s = edSituacao(e, hoje);
    if (s.grupo === "encerrado") return;
    const r = lerEdital(e.texto || "");
    if (!r.disciplinas.length) return;
    const cfg = r.cfg || {};
    const p = montarPlano(r, {
      horas: cfg.horas || 10, prova: s.prova, hoje,
      feitos: e.progresso || {},
    });
    /* o ritmo é POR EDITAL: o diário guarda o nome do concurso em cada
     * registro (campo "cc") desde a v8.66, e é isso que permite dizer
     * "você deu 6h ao TCE e 40min ao TCU nesta semana" */
    const meu = (diario || []).filter((x) =>
      !x.cc || x.cc === e.nome || x.cc === cfg.concurso);
    const A = acompanhamento(p, meu, p.porSemana);
    linhas.push({
      id: e.id, nome: e.nome,
      dias: s.dias, desde: s.desde || null, grupo: s.grupo,
      pesoEstudado: A.cobertura.pesoEstudado,
      pesoRevisado: A.cobertura.pesoRevisado,
      topicos: p.total, feitos: p.feitos,
      ritmoMin: A.ritmo.medivel ? A.ritmo.fezMin : null,
      projecao: A.projecao ? A.projecao.pesoPct : null,
      projecaoMeta: A.projecaoMeta ? A.projecaoMeta.pesoPct : null,
      fora: A.fora.n,
    });
  });
  /* ordem: quem tem prova mais perto primeiro — é onde o tempo decide */
  linhas.sort((a, b) => {
    if (a.dias === null && b.dias === null) return 0;
    if (a.dias === null) return 1;
    if (b.dias === null) return -1;
    return a.dias - b.dias;
  });
  return linhas;
}

/* =====================================================================
 * DE QUEM É O TEXTO QUE ESTÁ NA BANCADA
 *
 * O QUE ACONTECEU, num backup de verdade: o edital "TCE-PE Auditor de
 * Controle Externo" — 17 disciplinas, 232 tópicos, 6 marcados —
 * apareceu numa cópia com o nome, o texto e o progresso do "ISS Caruaru
 * Auditor Fiscal". Mesmo id, mesma data de criação, conteúdo do outro.
 * Duzentos e trinta e dois tópicos sumiram sem uma linha de aviso.
 *
 * COMO: duas funções gravam o conteúdo da bancada dentro do edital
 * aberto — edSalvar e hubGravarAberto. Nenhuma das duas conferia se o
 * texto que está na bancada é DAQUELE edital. Elas assumem o par. Basta
 * "eac_edital_atual" apontar para um edital e a bancada estar com o
 * texto de outro — o que acontece se a página abrir com a cópia de
 * trabalho antiga, ou se algum caminho trocar o aberto sem recarregar o
 * texto — para a gravação seguinte escrever um edital por cima do
 * outro. E ela ainda RENOMEIA o destino, pelo cabeçalho do texto: é por
 * isso que ficaram dois "ISS Caruaru" na lista.
 *
 * A REGRA, escrita uma vez só e usada pelas duas: gravar pode mudar o
 * conteúdo de um edital; NÃO pode mudar de qual edital ele é. Se o
 * cabeçalho da bancada nomeia outro concurso, ou se a bancada está
 * marcada como sendo de outro edital, a gravação é recusada — e dita em
 * voz alta, porque não gravar em silêncio é o outro jeito de perder
 * trabalho.
 * ===================================================================== */
const ED_DONO_CHAVE = "eac_edital_texto_de";

function edDonoDoTexto() {
  try { return localStorage.getItem(ED_DONO_CHAVE) || ""; } catch (e) { return ""; }
}

function edMarcarDonoDoTexto(id) {
  try {
    if (id) localStorage.setItem(ED_DONO_CHAVE, String(id));
    else localStorage.removeItem(ED_DONO_CHAVE);
  } catch (e) {}
}

/* O concurso que o cabeçalho do texto declara — a identidade que o
 * próprio texto carrega. */
function edConcursoDoTexto(texto) {
  try {
    const cfg = (lerEdital(String(texto || "")).cfg) || {};
    return String(cfg.concurso || "").trim();
  } catch (e) { return ""; }
}

function edMesmoNome(a, b) {
  const n = (x) => String(x || "").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  return n(a) === n(b);
}

/* Devolve { ok, motivo }. "motivo" é o que a tela mostra. */
function edPodeGravarNo(alvo, texto) {
  if (!alvo) return { ok: false, motivo: "sem-alvo" };

  /* 1. A BANCADA ESTÁ MARCADA COMO DE OUTRO EDITAL. É o caso direto, e
   *    só existe depois que alguém abriu um edital de verdade. */
  const dono = edDonoDoTexto();
  if (dono && String(dono) !== String(alvo.id)) {
    return { ok: false, motivo: "outro-dono" };
  }

  /* 2. O CABEÇALHO NOMEIA UM EDITAL QUE JÁ EXISTE NA LISTA.
   *
   *    A pergunta certa não é "o cabeçalho mudou?" — mudar o cabeçalho
   *    do próprio edital é renomear, e renomear é legítimo: corrigir o
   *    nome do concurso, acertar o ano. A primeira versão desta trava
   *    barrava isso, o que é pior que o defeito.
   *
   *    A pergunta certa é "este texto é de OUTRO edital que existe?".
   *    Foi exatamente o que aconteceu: o cabeçalho dizia "ISS Caruaru
   *    Auditor Fiscal", havia um edital com esse nome na lista, e o
   *    texto foi gravado por cima do TCE-PE — deixando dois "ISS
   *    Caruaru". Renomear para um nome novo continua passando; assumir
   *    a identidade de um irmão, não.
   *
   *    O dono marcado não substitui esta checagem: ele diz de onde a
   *    bancada foi CARREGADA, e continua apontando para o mesmo edital
   *    depois de alguém colar outro plano por cima. */
  const cab = edConcursoDoTexto(texto);
  if (cab) {
    const irmao = (editais || []).filter((x) =>
      x && String(x.id) !== String(alvo.id) && edMesmoNome(x.nome, cab))[0];
    if (irmao) return { ok: false, motivo: "outro-concurso" };
  }
  return { ok: true, motivo: "" };
}
