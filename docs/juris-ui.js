/* =====================================================================
 * A TELA DA JURISPRUDÊNCIA
 *
 * Uma gaveta por tópico, aberta dos três lugares em que se decide o que
 * estudar: a agenda da semana, o material e o próprio resumo.
 *
 * O gesto que ela existe para servir é um só e é curto: você está lendo
 * o resumo, encontra a frase que o tribunal decidiu, seleciona e guarda.
 * Tudo o mais — colar a ementa inteira, preencher tribunal e número —
 * é para quem está montando o material antes de estudar.
 * ===================================================================== */

let jurTopicoAtual = null;      /* {disciplina, nome, chave} */
let jurEditando = "";           /* id em edição, "" para novo */
let jurCategoriaColada = "";    /* categoria vinda da colagem/JSON */
let jurTagsColadas = [];        /* etiquetas de assunto vindas do JSON */
/* CAMPOS QUE A IA TROUXE E O TEXTO NÃO CONFIRMA: { campo: valor }. O valor
 * fica junto para saber, ao guardar, se a pessoa o corrigiu (então deixou
 * de ser suposição) ou o deixou como veio (continua "a conferir"). */
let jurConferirForm = {};
/* O texto que foi de fato enviado no último pedido à IA. A resposta chega
 * pela mesma caixa e a substitui — sem guardar aqui, não haveria com que
 * comparar o que a IA devolveu (ver jurVerificarNoTexto). */
let jurUltimoTextoPedido = "";
/* os valores que a leitura do TEXTO colocou em cada campo: enquanto o
 * campo continuar igual, ele mostra "✓ do texto". Se a pessoa mexeu,
 * a marca some — o campo agora é dela. */
let jurValoresLidos = {};
/* a última resposta disse que a "tese" colada é paráfrase, não o enunciado */
let jurParafraseColada = false;
/* os campos do formulário (o relator existe no julgado, não na entrada) */
const JUR_CAMPOS_FORM = { tribunal: "jurTribunal", classe: "jurClasse",
  numero: "jurNumero", data: "jurData", orgao: "jurOrgao", fonte: "jurFonte",
  precedentes: "jurPrecedentes" };
let jurFiltroTag = "";          /* etiqueta escolhida na lista */
/* "ler" ou "incluir" — ver jurPintarModo */
let jurModo = "ler";
/* abaixo disto não há ementa nem enunciado: só um título ou uma frase */
const JUR_TEXTO_MINIMO = 120;
/* os julgados já guardados, enquanto se cria ou edita: recolhidos até a pessoa pedir */
let jurOutrosAberto = false;

/* ABRE NO MODO QUE A SITUAÇÃO PEDE.
 *
 * Com julgados guardados, o gesto é LER: clicar na etiqueta "3 julgados"
 * é pedir para ver os três, e um formulário de sete campos no topo
 * empurra a leitura para fora da tela. Sem nenhum julgado não há o que
 * ler, e a única coisa a fazer é incluir.
 *
 * É a mesma divisão do "responder / criar mais" das questões: a tela
 * abre no verbo que a pessoa veio exercer, e o outro fica a um toque. */
/* Q3 — aberta pelo ramo (a ficha do ramo): a lista mostra só os julgados dele e o que se guarda agora já fica ligado a ele */
let jurRamoAlvo = null;
function jurRamoVerTodos() { jurRamoAlvo = null; jurPintarLista(); }
function jurAbrir(disciplina, topico, modo, opc) {
  const chave = (typeof matChave === "function")
    ? matChave(disciplina, topico) : (disciplina + "›" + topico);
  jurTopicoAtual = { disciplina, nome: topico, chave };
  /* abrir a gaveta zera o "lote dos citados" (quem o começa liga de novo logo depois) */
  if (typeof jurLoteDeCitacoes !== "undefined") jurLoteDeCitacoes = false;
  if ($("jurClPedidoTxt")) { $("jurClPedidoTxt").hidden = true; $("jurClPedidoTxt").value = ""; }
  jurRamoAlvo = opc && opc.ramo && opc.ramo.id ? { id: opc.ramo.id, nome: opc.ramo.nome || opc.ramo.id } : null;
  jurEditando = "";
  jurFiltroTag = "";
  jurOutrosAberto = false;
  const sub = $("jurSub");
  if (sub) sub.textContent = t("jur_sub", { d: disciplina, t: topico });
  jurLimparForm();
  if ($("jurMais")) $("jurMais").open = false;       /* o menu abre sempre fechado */
  const quantos = jurRamoAlvo ? (jurContarPorRamo(chave)[jurRamoAlvo.id] || 0) : jurDoTopico(chave).length;
  jurModo = modo || (quantos ? "ler" : "incluir");
  /* pedir "ler" sem ter o que ler abriria uma tela vazia */
  if (jurModo === "ler" && !quantos) jurModo = "incluir";
  jurPintarModo();
  jurPintarLista();
  abrirModal("dlgJuris");
  reg("JURIS", "gaveta aberta (" + jurModo + ")",
      disciplina + " › " + topico + " · " + quantos + " julgado(s)");
}

/* =====================================================================
 * DE ONDE A GAVETA FOI ABERTA — E PARA ONDE ELA DEVOLVE
 *
 * A gaveta é aberta da agenda, do material, do resumo e agora da
 * questão. Dos três primeiros a volta é trivial: a tela de trás
 * continua onde estava, e fechar basta.
 *
 * Da QUESTÃO é diferente por um detalhe que só aparece no uso: quem
 * está respondendo uma prova quer voltar para A MESMA QUESTÃO, no
 * mesmo ponto, com o rascunho e o grifo intactos. Fechar a sessão para
 * abrir os julgados e reabri-la depois perderia as três coisas — e
 * perder o traço de uma conta no meio de uma questão é o tipo de
 * estrago que faz alguém parar de usar o botão.
 *
 * ENTÃO A SESSÃO NÃO É FECHADA. Um <dialog> aberto por showModal()
 * empilha no top layer: a gaveta sobe POR CIMA da questão, e fechá-la
 * descobre a questão exatamente como ela estava. Não há "voltar" a
 * programar — há um "não sair" a respeitar.
 *
 * O que sobra para esta função é o que de fato mudou: o número de
 * julgados do tópico, que a tela de trás mostra e que pode ter
 * aumentado enquanto a gaveta esteve aberta.
 * ===================================================================== */
let jurVoltaPara = null;   /* função a chamar quando a gaveta fechar */
if (typeof document !== "undefined" && $("btnJurRamoTodos")) $("btnJurRamoTodos").onclick = () => jurRamoVerTodos();

function jurFechar() {
  const d = $("dlgJuris");
  if (d && d.close) d.close();
  /* o "close" do <dialog> chama jurVoltarPara; em navegador que não
   * dispare o evento, esta linha garante que ele aconteça mesmo assim.
   * jurVoltarPara é idempotente de propósito por causa disto. */
  jurVoltarPara();
}

function jurVoltarPara() {
  const f = jurVoltaPara;
  jurVoltaPara = null;          /* uma vez só: chamar duas vezes repintaria
                                 * a sessão sem que nada tivesse mudado */
  if (typeof f === "function") { try { f(); } catch (e) {} }
}

function jurPintarModo() {
  const lendo = jurModo === "ler";
  const quantos = jurTopicoAtual ? jurDoTopico(jurTopicoAtual.chave).length : 0;
  if ($("jurForm")) $("jurForm").hidden = lendo;
  /* O GUARDAR VIVE NO RODAPÉ FIXO, fora do formulário — então é ele que
   * precisa saber que no modo leitura não há o que salvar. */
  if ($("btnJurSalvar")) $("btnJurSalvar").hidden = lendo;
  if ($("jurLerAcoes")) $("jurLerAcoes").hidden = !lendo;
  /* voltar para a leitura só existe quando há o que ler */
  if ($("btnJurVoltarLer")) $("btnJurVoltarLer").hidden = !quantos;
  if ($("jurTitulo")) {
    $("jurTitulo").textContent = t(lendo ? "jur_titulo_ler" : "jur_titulo_novo");
  }
  const aj = $("jurAjuda");
  if (aj) aj.textContent = t(lendo ? "jur_ajuda_ler" : "jur_ajuda");
}

function jurTrocarModo(m) {
  /* "+ guardar mais um julgado" promete um formulário em branco. Sem
   * limpar aqui, um ✏️ editar cancelado com "voltar para a leitura"
   * deixava tese/resumo/id do julgado anterior escondidos no
   * formulário — jurEditar preenche os campos direto, sem passar por
   * jurTrocarModo, então nada os limpava na volta. "+ mais" reabria com
   * esse lixo: jurColar só sobrescreve tese/resumo vazios, então o
   * texto novo (ou melhorado) colado nunca aparecia — e se a pessoa
   * salvasse assim, sobrescrevia o julgado antigo em vez de criar um
   * novo, porque jurEditando continuava apontando para ele. */
  if (m === "incluir") jurLimparForm();
  jurOutrosAberto = false;
  jurModo = m;
  jurPintarModo();
  jurPintarLista();
  if (m === "incluir" && $("jurTese") && $("jurTese").focus) {
    $("jurTese").focus();
  }
}

function jurLimparForm() {
  ["jurColar", "jurTese", "jurResumo", "jurTribunal", "jurClasse", "jurNumero",
   "jurData", "jurOrgao", "jurFonte", "jurPrecedentes"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  jurEditando = "";
  jurCategoriaColada = "";
  jurTagsColadas = [];
  jurConferirForm = {};
  jurValoresLidos = {};
  jurParafraseColada = false;
  jurLoteLimpar();
  jurPintarTagsForm();
  jurPilulaLimpar();
  jurMeta(false);
  jurConteudoVisivel(false);
  jurBotaoSalvar();
  /* esvaziar a caixa desabilita o botão principal — senão ele continua
   * dizendo "perguntar à IA" sobre uma ementa que não existe mais */
  if (typeof jurPintarPrincipal === "function") jurPintarPrincipal();
}

/* A SANFONA DOS SEIS CAMPOS.
 *
 * Eles são conferência, não digitação: quando "ler e preencher"
 * funciona — que é quase sempre — já vêm certos e ninguém os toca.
 * Abertos, ocupam metade da tela e empurram a tese, que é a única coisa
 * escrita à mão, para fora da dobra. */
/* ---------------------------------------------------------------------
 * A TESE E O RESUMO SÓ APARECEM QUANDO EXISTEM
 *
 * Três caixas altas empilhadas — ementa, tese, resumo — enchiam a tela
 * de espaço vazio antes de haver o que escrever nele: na prática, duas
 * caixas de quinze linhas para conteúdo de duas.
 *
 * O caminho normal é colar e mandar ler: os campos surgem já
 * preenchidos. Quem quiser escrever sem colar nada abre pelo botão. E
 * eles nunca se escondem sozinhos depois de ter conteúdo — esconder
 * texto que a pessoa escreveu seria perder trabalho aos olhos dela.
 * ------------------------------------------------------------------ */
function jurConteudoVisivel(mostrar) {
  const temTexto = ["jurTese", "jurResumo"].some((id) =>
    $(id) && String($(id).value || "").trim());
  const ver = mostrar === undefined ? temTexto : (!!mostrar || temTexto);
  if ($("jurConteudo")) $("jurConteudo").hidden = !ver;
  if ($("btnJurAMao")) $("btnJurAMao").hidden = ver;
  if (ver) jurCrescer();
  return ver;
}

/* A CAIXA CRESCE COM O TEXTO, em vez de reservar altura para o que
 * talvez não venha. Sem isto, o campo de duas linhas obrigaria a rolar
 * dentro dele numa tese longa — rolagem dentro de rolagem, que é o que
 * já tirei da ementa. */
/* O TETO É MENOR NA CAIXA DE COLAR, e a diferença tem motivo.
 *
 * A tese e o resumo são CONTEÚDO: crescem porque o que está ali dentro
 * é o que se vai ler depois. A caixa de colar é TRANSPORTE — recebe a
 * ementa crua e o JSON de volta, e nada do que está nela é guardado
 * como está. Deixá-la subir a 420px como as outras afundava o
 * formulário inteiro por causa de um texto de passagem.
 *
 * O teto também está no CSS (#jurColar{max-height:180px}), e de
 * propósito: se um dia esta função não rodar, a caixa ainda não estoura
 * a tela. Mas os dois números têm de ser o mesmo — dois tetos
 * diferentes fazem a caixa parar de crescer antes de encostar no
 * limite visível, e o efeito é uma barra de rolagem que aparece sem
 * explicação. */
const JUR_TETO = { jurColar: 180, jurTese: 420, jurResumo: 420 };
function jurCrescer() {
  ["jurTese", "jurResumo", "jurColar"].forEach((id) => {
    const ta = $(id);
    if (!ta || !ta.style) return;
    ta.style.height = "auto";
    const h = ta.scrollHeight;
    if (h) ta.style.height = Math.min(h + 2, JUR_TETO[id] || 420) + "px";
  });
}

function jurMeta(abrir) {
  const cx = $("jurMetaCampos");
  if (cx) cx.hidden = !abrir;
  const b = $("btnJurMeta");
  if (b) b.textContent = t(abrir ? "jur_meta_esconder" : "jur_meta_ver");
}

function jurMetaAberta() {
  return !!($("jurMetaCampos") && !$("jurMetaCampos").hidden);
}

/* ---------------------------------------------------------------------
 * AS ETIQUETAS, EDITÁVEIS ANTES DE SALVAR
 *
 * A IA propõe; quem estuda decide. Uma etiqueta errada não é só um selo
 * feio: ela entra no filtro, e um julgado marcado com o assunto errado
 * some da busca em que deveria aparecer.
 * ------------------------------------------------------------------ */
function jurPintarTagsForm() {
  const cx = $("jurTagsForm");
  if (!cx) return;
  cx.innerHTML = "";
  cx.hidden = false;
  jurTagsColadas.forEach((tg, i) => {
    const p = document.createElement("span");
    p.className = "jur-tag-ed";
    const nm = document.createElement("span");
    nm.textContent = "#" + tg;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "jur-tag-x";
    x.textContent = "✖";
    x.title = t("jur_tag_tirar", { t: tg });
    x.setAttribute("aria-label", x.title);
    x.onclick = () => {
      jurTagsColadas = jurTagsColadas.filter((_, k) => k !== i);
      jurPintarTagsForm();
    };
    p.append(nm, x);
    cx.append(p);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "jur-tag-add";
  add.textContent = t("jur_tag_add");
  add.title = t("jur_tag_add_aj");
  add.onclick = async () => {
    const novo = await uiTexto(t("jur_tag_add"), "");
    const limpo = String(novo || "").replace(/^#+/, "").trim();
    if (!limpo) return;
    if (!jurTagsColadas.some((x2) => jurTagNormal(x2) === jurTagNormal(limpo))) {
      jurTagsColadas = jurTagsColadas.concat([limpo]);
    }
    jurPintarTagsForm();
  };
  cx.append(add);
}

function jurBotaoSalvar() {
  const b = $("btnJurSalvar");
  if (b && jurLoteAtivo()) { b.textContent = t("jur_lote_salvar", { n: jurLoteMarcados().length }); return; }
  if (b) b.textContent = t(jurEditando ? "jur_salvar_edicao" : "jur_salvar");
}

/* ------------------------------------------------------------------
 * COLAR COM FORMATAÇÃO
 *
 * O bloco cru do sítio do tribunal entra numa caixa e sai nos campos.
 * O que o app reconheceu fica ESCRITO na tela antes de qualquer coisa
 * ser salva — extrair em silêncio e mostrar formulário preenchido faria
 * a pessoa confiar num palpite sem saber que houve palpite.
 * ------------------------------------------------------------------ */
/* A PÍLULA NUNCA SOBREVIVE À PRÓXIMA LEITURA.
 *
 * Ela dizia "Detectado: STF · ADI 1.917" enquanto a caixa já estava com
 * outro julgado — sobra da leitura anterior. Um selo de sucesso que
 * fala do que não está mais na tela é pior que selo nenhum: ele afirma,
 * e afirma errado. */
function jurPilulaLimpar() {
  const av = $("jurColarAviso");
  if (av) { av.hidden = true; av.textContent = ""; av.className = "jur-pilula"; }
}

/* =====================================================================
 * UM BOTÃO PRINCIPAL QUE SABE EM QUE PASSO VOCÊ ESTÁ
 *
 * O FLUXO ANTIGO, escrito por extenso, mostra o problema: colar a
 * ementa → apertar "pedir à IA" → sair do app → voltar com o JSON e
 * colá-lo na MESMA caixa → apertar o OUTRO botão, "ler e preencher".
 * Dois botões que não são alternativas, e sim dois momentos do mesmo
 * caminho — mas apresentados lado a lado como se fossem escolha. Quem
 * não decorou a sequência aperta o errado, e o errado ou copia um
 * prompt que ninguém pediu ou tenta extrair campos de um texto que
 * ainda não passou por IA.
 *
 * A CAIXA JÁ SABE EM QUAL DOS DOIS MOMENTOS SE ESTÁ: ementa dentro é
 * antes, JSON dentro é depois. Então quem decide é ela, e o botão só
 * anuncia o que vai fazer. Não é um botão que faz duas coisas — é o
 * mesmo passo ("siga daqui") em duas situações diferentes.
 *
 * VAZIA, ELE FICA DESABILITADO. Antes abria um alerta modal para dizer
 * "cole a ementa acima primeiro" — interrompendo a tela para informar
 * o que a tela já mostrava.
 * ===================================================================== */
function jurEstadoDaCaixa() {
  const bruto = String(($("jurColar") || {}).value || "").trim();
  if (!bruto) return "vazia";
  /* jurEhJson e não um teste de primeiro caractere: uma ementa que
   * comece com "{" não existe, mas um JSON precedido de espaço ou de
   * uma crase de markdown existe o tempo todo. */
  if (typeof jurEhJson === "function" && jurEhJson(bruto)) return "resposta";
  return "ementa";
}

function jurPintarPrincipal() {
  const b = $("btnJurPrincipal");
  if (!b) return;
  const est = jurEstadoDaCaixa();
  b.disabled = est === "vazia";
  b.textContent = t("jur_principal_" + est);
  b.title = t("jur_principal_" + est + "_aj");
  /* o caminho local só se oferece quando há texto para ele ler */
  if ($("btnJurColar")) $("btnJurColar").disabled = est === "vazia";
  const sem = jurPintarSemaforo();
  /* o PEDIDO colado por engano não se lê nem se reenvia */
  if (sem && sem.pedido) { b.disabled = true; if ($("btnJurColar")) $("btnJurColar").disabled = true; }
  jurPintarPassos();
  jurPintarOrigem();
}

/* =====================================================================
 * OS TRÊS PASSOS, À VISTA
 *
 * A entrada era uma caixa que trocava de papel (ementa, depois resposta
 * da IA) e um botão que trocava de rótulo — o caminho existia, mas só na
 * cabeça de quem já o conhecia. Agora o passo em que se está fica aceso
 * e uma linha diz o que se faz nele:
 *   1 · Cole      — caixa e campos vazios
 *   2 · Confira   — há texto para ler, ainda sem campos
 *   3 · Guarde    — há campos (lidos, digitados ou vindos da IA)
 * ===================================================================== */
function jurPassoAtual() {
  if (jurLoteAtivo()) return 3;
  const tem = (id) => !!String(($(id) || {}).value || "").trim();
  if (["jurTese", "jurTribunal", "jurClasse", "jurNumero", "jurResumo"].some(tem)) return 3;
  return jurEstadoDaCaixa() === "vazia" ? 1 : 2;
}

function jurPintarPassos() {
  const cx = $("jurPassos");
  if (!cx) return;
  const p = jurPassoAtual();
  [1, 2, 3].forEach((n) => {
    const el = $("jurPasso" + n);
    if (!el) return;
    el.className = "jur-passo" + (n === p ? " atual" : (n < p ? " feito" : ""));
    if (el.setAttribute) el.setAttribute("aria-current", n === p ? "step" : "false");
  });
  if ($("jurPassoAjuda")) $("jurPassoAjuda").textContent = jurLoteAtivo() ? t("jur_passo_aj_lote", { n: jurLoteFichas.length }) : t("jur_passo_aj_" + p);
}

/* =====================================================================
 * DE ONDE VEIO CADA CAMPO
 *
 * Um campo preenchido não diz se foi lido do tribunal ou lembrado pela
 * IA — e é essa diferença que decide se dá para decorar. Ao lado do
 * rótulo: "✓ do texto" (leitura local ou confirmado no texto enviado) ou
 * "⚠ a conferir" (a IA trouxe, o texto não confirma). Campo que a pessoa
 * digitou ou corrigiu não leva marca nenhuma: é dela.
 *
 * O RÓTULO DA DATA ACOMPANHA A CATEGORIA: numa súmula, a data que importa
 * é a da APROVAÇÃO — chamar de "data do julgamento" foi o que levou a IA
 * (e a pessoa) a preencher com a data da publicação.
 * ===================================================================== */
function jurPintarOrigem() {
  const val = (id) => String(($(id) || {}).value || "").trim();
  Object.keys(JUR_CAMPOS_FORM).forEach((k) => {
    const el = $("jurOrigem_" + k);
    if (!el) return;
    const cur = val(JUR_CAMPOS_FORM[k]);
    let estado = "";
    if (cur && jurConferirForm[k] !== undefined
        && String(jurConferirForm[k]).trim() === cur) estado = "conferir";
    else if (cur && jurValoresLidos[k] === cur) estado = "texto";
    el.className = "jur-origem" + (estado ? " " + estado : "");
    el.textContent = estado ? t("jur_origem_" + estado) : "";
  });
  const cat = jurCategoriaColada
    || (typeof jurCategoria === "function" ? jurCategoria(val("jurClasse")) : "");
  if ($("jurRotData")) {
    $("jurRotData").textContent = t(/S[UÚ]MULA/i.test(cat) ? "jur_c_data_sumula" : "jur_c_data");
  }
  jurPintarOficial();
}

/* O SITE OFICIAL, quando há o que conferir. Só o portal de busca do
 * tribunal (jurPortalOficial): o app não sabe o endereço de cada julgado
 * e não finge saber. Sem innerHTML — o texto do link é fixo, mas o
 * hábito de montar nós vale mais que a exceção. */
function jurPintarOficial() {
  const cx = $("jurOficial");
  if (!cx) return;
  const portal = typeof jurPortalOficial === "function"
    ? jurPortalOficial(($("jurTribunal") || {}).value) : null;
  const precisa = Object.keys(jurConferirForm).length > 0 || jurParafraseColada;
  cx.hidden = !(portal && precisa);
  if (cx.hidden) return;
  cx.textContent = t("jur_oficial_rot") + " ";
  const a = document.createElement("a");
  a.href = portal.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = portal.nome;
  cx.append(a);
}

function jurPrincipal() {
  const est = jurEstadoDaCaixa();
  if (est === "vazia") return;                 /* desabilitado; nem chega aqui */
  if (est === "resposta") { jurColar(); return; }
  jurPedirIA();
}

/* COLOU UM JSON, JÁ ESTÁ LIDO.
 *
 * Colar a resposta da IA e ainda ter de apertar um botão é o passo que
 * não decide nada: não existe motivo para colar um JSON de julgado na
 * caixa e NÃO querer que ele seja lido. O selo verde com os valores
 * detectados aparece na hora, e é ele que confirma que a colagem valeu.
 *
 * SÓ PARA JSON. Ementa colada continua esperando: ali a leitura é
 * palpite, e palpite automático preencheria seis campos sem ninguém
 * ter pedido — que é o oposto do que a pílula existe para evitar.
 *
 * O setTimeout não é superstição: no instante do evento "paste" o
 * valor da caixa ainda é o ANTERIOR; o texto novo só está lá no fim do
 * ciclo. Ler antes disso leria o que estava na tela antes da colagem. */
function jurAoColarNaCaixa() {
  setTimeout(() => {
    jurCrescer();
    jurPintarPrincipal();
    if (jurEstadoDaCaixa() !== "resposta") return;
    jurColar();
    reg("JURIS", "resposta da IA lida ao colar", "sem clique extra");
  }, 0);
}

function jurColar() {
  jurPilulaLimpar();
  const bruto = String(($("jurColar") || {}).value || "");
  if (!bruto.trim()) { jurReagirBtn("btnJurColar", t("jur_colar_vazio")); return; }
  /* O PEDIDO colado por engano não é lido: o semáforo já avisou, e preencher campos com o prompt seria o erro de sempre */
  if (typeof jurEhPedido === "function" && jurEhPedido(bruto)) { jurPintarPrincipal(); return; }
  /* A IA SEPAROU VÁRIOS JULGADOS: painel com uma ficha por julgado, em vez de misturar tudo no formulário */
  const lote = typeof jurDoJsonLote === "function" ? jurDoJsonLote(bruto) : null;
  if (lote && lote.length > 1) { jurLoteMostrar(lote); return; }
  const a = jurIdentificar(bruto);
  /* RESPOSTA DA IA QUE VEIO SEM DADO NENHUM: o que ela disse que o julgado é (a frase "identificacao") ainda ajuda a
   * preencher tribunal, classe e número — vazios apenas, e marcados "a conferir" mais abaixo, porque vêm da memória. */
  if (a.semConteudo && a.identificacao && typeof jurIdentificarProcesso === "function") {
    const idp = jurIdentificarProcesso(a.identificacao);
    ["tribunal", "classe", "numero"].forEach((k) => { if (!a[k] && idp[k]) a[k] = idp[k]; });
  }
  /* COLAR UM JSON É UM PEDIDO EXPLÍCITO DE PREENCHIMENTO.
   *
   * Para texto solto, a regra é não sobrescrever o que já está escrito:
   * o extrator adivinha, e adivinhação não apaga trabalho. Um JSON não
   * adivinha nada — ele traz os campos nomeados, e quem o colou colou
   * para que substituíssem. Foi o que faltou: a tese continuava com um
   * texto anterior enquanto o JSON trazia a tese certa. */
  const doJson = typeof jurDoJson === "function" && !!jurDoJson(bruto);
  /* O QUE A IA LEMBROU entra onde o texto não trouxe nada — e, junto com
   * tudo o que veio no JSON, é CONFERIDO no texto que foi enviado. O que
   * não aparece lá fica marcado "a conferir" (jurVerificarNoTexto). */
  jurConferirForm = {};
  jurValoresLidos = {};
  jurParafraseColada = false;
  const sugeridos = [];
  if (doJson) {
    const mem = a.deMemoria || {};
    Object.keys(JUR_CAMPOS_FORM).forEach((k) => {
      if (!a[k] && mem[k]) a[k] = mem[k];
    });
    const vals = {};
    Object.keys(JUR_CAMPOS_FORM).forEach((k) => {
      if (a[k] && !(k === "tribunal" && a.tribunalDeduzido)) vals[k] = a[k];
    });
    const base = [jurUltimoTextoPedido, a.texto].filter(Boolean).join("\n");
    jurVerificarNoTexto(vals, base).aConferir.forEach((k) => {
      jurConferirForm[k] = a[k];
      sugeridos.push(k);
    });
  }
  const põe = (id, v) => { if ($(id) && v) $(id).value = v; };
  põe("jurTribunal", a.tribunal);
  põe("jurClasse", a.classe);
  põe("jurNumero", a.numero);
  põe("jurData", a.data);
  põe("jurOrgao", a.orgao);
  põe("jurFonte", a.fonte);
  põe("jurPrecedentes", a.precedentes);
  if (a.categoria) jurCategoriaColada = a.categoria;
  /* o que a LEITURA pôs nos campos e que não está sob suspeita: "do texto" */
  Object.keys(JUR_CAMPOS_FORM).forEach((k) => {
    if (a[k] && jurConferirForm[k] === undefined) jurValoresLidos[k] = String(a[k]).trim();
  });
  jurParafraseColada = !!(doJson && (a.teseOficial === false
    || /parafrase/i.test(a.tipoDoTexto || "")));
  /* A tese só é SUGERIDA quando o campo está vazio — quem já escreveu a
   * sua não pode perdê-la para um palpite. Vindo de JSON, substitui:
   * ali não houve palpite, houve um campo nomeado. */
  if ($("jurTese") && a.tese && (doJson || !$("jurTese").value.trim())) {
    $("jurTese").value = a.tese;
  }
  if ($("jurResumo") && a.resumo && (doJson || !$("jurResumo").value.trim())) {
    $("jurResumo").value = a.resumo;
  }

  /* A PÍLULA DIZ OS VALORES, NÃO OS NOMES DOS CAMPOS.
   *
   * "5 campos: tribunal, classe, número, data, órgão" informa que houve
   * leitura e nada sobre o que foi lido — para conferir era preciso
   * descer até os campos. "STF · RE 574706 · Pleno · 15/03/2017" se
   * confere de relance, que é o ponto de mostrar. */
  /* O JSON SAI DA CAIXA E A EMENTA ENTRA.
   *
   * O DEFEITO: o que ficasse na caixa de colar virava o "texto" do
   * julgado — então, colando um JSON, o "ver ementa completa" mostrava
   * chaves e aspas. JSON é transporte; o que se lê é ementa. Trocar o
   * conteúdo da caixa resolve na origem: o JSON nunca chega ao
   * armazenamento nem à tela, e a pessoa VÊ o que foi extraído. */
  if (doJson && $("jurColar")) {
    /* SE VEIO EMENTA LIMPA, ela fica; se não veio, a caixa esvazia.
     *
     * Guardar o JSON como se fosse a ementa era o defeito relatado: o
     * "ver ementa completa" mostrava chaves e aspas. E deixar o JSON na
     * caixa quando ele não traz ementa nenhuma repetiria o defeito por
     * omissão — o campo do texto viraria o JSON de novo na hora de
     * salvar. Sem ementa, não há ementa: melhor vazio do que código. */
    /* resposta SEM conteúdo: o que a pessoa tinha enviado volta para a caixa, para ela completar e pedir de novo */
    $("jurColar").value = a.semConteudo ? (jurUltimoTextoPedido || "") : (a.texto || "");
  }
  if (a.tags && a.tags.length) jurTagsColadas = a.tags;
  jurPintarTagsForm();

  const achou = ["tribunal", "classe", "numero", "data", "orgao", "fonte"]
    .filter((k) => a[k]);
  const pedacos = [];
  if (a.tribunal) pedacos.push(a.tribunal + (a.tribunalDeduzido ? "*" : ""));
  if (a.classe || a.numero) {
    pedacos.push([a.classe, a.numero].filter(Boolean).join(" "));
  }
  if (a.orgao) pedacos.push(a.orgao);
  if (a.data) pedacos.push(String(a.data).split("-").reverse().join("/"));
  /* O ANO SOLTO, quando é tudo o que o texto diz. A caixa de data não
   * aceita ano sozinho, e sem esta linha a pessoa não ficava sabendo
   * que havia uma data ali — parecia que o extrator não viu nada. */
  else if (a.ano) pedacos.push(t("jur_so_ano", { a: a.ano }));
  const av = $("jurColarAviso");
  if (av) {
    av.hidden = false;
    av.className = "jur-pilula" + (achou.length && !a.semConteudo ? " ok" : " aviso");
    const linhas = [achou.length
      ? t("jur_pilula", { c: pedacos.join(" · ") })
      : t("jur_pilula_nada")];
    /* O QUE NÃO SE PODE CONFIAR fica escrito ao lado do que se pode */
    if (sugeridos.length) {
      linhas.push("⚠ " + t("jur_pilula_memoria",
        { q: sugeridos.map(jurNomeCampo).join(", ") }));
    }
    if (doJson && (a.teseOficial === false || /parafrase/i.test(a.tipoDoTexto || ""))) {
      linhas.push("⚠ " + t("jur_pilula_parafrase"));
    }
    if (doJson && a.ondeConferir) {
      linhas.push(t("jur_pilula_onde", { q: a.ondeConferir }));
    }
    if (a.semConteudo) {
      /* a leitura não achou DADO — o que a IA disse sobre isso é o que importa, e vem primeiro */
      const tipo = String(a.tipoDoTexto || "").toLowerCase();
      const motivo = t(tipo === "vazio" ? "jur_resp_motivo_vazio"
        : tipo === "so_identificacao" ? "jur_resp_motivo_ident" : "jur_resp_motivo_outro");
      linhas.unshift("⚠ " + t("jur_resp_vazia", { motivo }));
      if (a.identificacao) linhas.push(t("jur_ident_curta", { q: a.identificacao }));
      (a.conferencia || []).slice(0, 3).forEach((c) => {
        if (c && c.problema) linhas.push("⚠ " + t("jur_resp_apontou", { q: String(c.problema) }));
      });
      linhas.push(t("jur_resp_proximo"));
    }
    av.textContent = linhas.join("\n");
    av.style.whiteSpace = "pre-line";
    /* várias linhas não cabem numa pílula: vira caixa */
    if (linhas.length > 1) av.className += " multi";
  }
  /* NÃO RECONHECEU NADA: aí os campos precisam aparecer, porque não há
   * o que conferir — há o que preencher. Reconheceu: ficam fechados,
   * e a pílula acima já mostra o que há dentro. */
  jurMeta(!achou.length || sugeridos.length > 0);
  /* preencheu alguma coisa: os campos aparecem, já com o conteúdo */
  jurConteudoVisivel();
  reg("JURIS", "ementa colada",
      achou.length + " campos reconhecidos de " + bruto.length + " caracteres");
  jurReagirBtn("btnJurColar", t("jur_colou_btn", { n: achou.length }));
  /* LER UM JSON TROCA O CONTEÚDO DA CAIXA pela ementa limpa — ou seja,
   * o estado muda de "resposta" para "ementa" ou "vazia" dentro desta
   * mesma função. Sem repintar aqui, o botão principal continuaria
   * oferecendo "ler a resposta" sobre uma resposta que já foi lida. */
  if (typeof jurPintarPrincipal === "function") jurPintarPrincipal();
}

/* a mesma reação curta dos outros botões do app */
function jurReagirBtn(id, txt) {
  if (typeof vkReagir === "function") vkReagir($(id), txt);
}

async function jurSalvar() {
  if (!jurTopicoAtual) return;
  if (jurLoteAtivo()) return jurSalvarLote();
  const v = (id) => String(($(id) || {}).value || "").trim();
  const tese = v("jurTese");
  const texto = v("jurColar");
  /* SEM TESE E SEM TEXTO não há o que guardar. Um julgado só com o
   * número é uma etiqueta que não se revisa. */
  if (!tese && !texto) { await uiAlert(t("jur_falta")); return; }

  /* O CONCURSO DO JULGADO: o dono do tópico nos editais cadastrados (ver
   * matConcursoDoTopico). Quem já tem concurso o mantém; só se preenche o
   * vazio — e vazio continua vazio quando o tópico não é de edital nenhum. */
  const antigoJ = jurEditando ? jurDe(jurEditando) : null;
  const concursoJ = (antigoJ && antigoJ.concurso)
    || (typeof matConcursoDoTopico === "function"
        ? matConcursoDoTopico(jurTopicoAtual.disciplina, jurTopicoAtual.nome,
            (typeof concursoAtual === "function" ? concursoAtual().nome : ""))
        : "");
  const j = jurGravar({
    id: jurEditando || undefined,
    concurso: concursoJ,
    tribunal: v("jurTribunal"), classe: v("jurClasse"),
    numero: v("jurNumero"), data: v("jurData"), orgao: v("jurOrgao"),
    fonte: v("jurFonte"), precedentes: v("jurPrecedentes"),
    tese, texto, resumo: v("jurResumo"),
    /* a categoria vem da colagem ou é deduzida da classe na hora de
     * desenhar — guardá-la evita recalcular e permite que um JSON traga
     * uma classificação que a classe sozinha não diria */
    categoria: jurCategoriaColada
      || (typeof jurCategoria === "function" ? jurCategoria(v("jurClasse")) : ""),
    tags: jurTagsColadas.slice(),
    /* "a conferir": o que a IA trouxe e a pessoa não corrigiu. Campo que
     * ela mexeu deixa de ser suposição; campo fora do formulário (relator)
     * mantém a marca que já tinha. */
    aConferir: jurConferirAoGuardar(),
    topicos: jurEditando ? undefined : [jurTopicoAtual.chave],
  });
  if (!j) { await uiAlert(t("jur_nao_salvou")); return; }
  /* SEMPRE, e não só ao editar: o vínculo já existe quando se cria (ele
   * foi para "topicos" ali em cima), mas o RÓTULO não — e é ele que faz
   * o julgado aparecer na estante com o nome certo da disciplina. */
  jurLigar(j.id, jurTopicoAtual.chave,
           jurTopicoAtual.disciplina, jurTopicoAtual.nome);
  /* Q3 — guardado pela ficha de um ramo: já fica ligado a ele (só o novo; editar não troca o ramo) */
  if (jurRamoAlvo && !jurEditando) jurLigarRamo(j.id, jurTopicoAtual.chave, jurRamoAlvo.id, jurRamoAlvo.nome);

  reg("JURIS", jurEditando ? "julgado editado" : "julgado guardado",
      jurTitulo(j) + " · " + jurTopicoAtual.nome);
  jurLimparForm();
  /* GUARDOU, VOLTA PARA A LEITURA. É onde o resultado aparece — ficar no
   * formulário vazio depois de salvar não mostra que salvou. */
  jurModo = "ler";
  jurPintarModo();
  jurPintarLista();
  jurRepintarTelas();
  jurReagirBtn("btnJurSalvar", t("jur_salvou"));
}

function jurConferirAoGuardar() {
  const v = (id) => String(($(id) || {}).value || "").trim();
  const ficam = Object.keys(jurConferirForm)
    .filter((k) => v(JUR_CAMPOS_FORM[k]) === String(jurConferirForm[k] || "").trim());
  const antigo = jurEditando ? jurDe(jurEditando) : null;
  const fora = ((antigo && antigo.aConferir) || [])
    .filter((k) => !JUR_CAMPOS_FORM[k]);
  return ficam.concat(fora);
}

/* Depois de guardar, a agenda e o material precisam mostrar o selo novo
 * — senão o julgado existe e não aparece em lugar nenhum até um F5. */
function jurRepintarTelas() {
  try { if (typeof edRender === "function") edRender(); } catch (e) {}
  try { if (typeof matRender === "function") matRender(); } catch (e) {}
  try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
}

function jurEditar(id) {
  const j = jurDe(id);
  if (!j) return;
  jurEditando = id;
  /* editar é outro julgado: o selo da leitura anterior não vale mais */
  jurPilulaLimpar();
  const põe = (idc, v) => { if ($(idc)) $(idc).value = v || ""; };
  põe("jurTribunal", j.tribunal); põe("jurClasse", j.classe);
  põe("jurNumero", j.numero); põe("jurData", j.data);
  põe("jurOrgao", j.orgao); põe("jurFonte", j.fonte);
  põe("jurPrecedentes", j.precedentes);
  põe("jurTese", j.tese); põe("jurResumo", j.resumo); põe("jurColar", j.texto);
  jurTagsColadas = (typeof jurTagsDe === "function") ? jurTagsDe(j) : [];
  jurConferirForm = {};
  jurValoresLidos = {};
  jurParafraseColada = false;
  (j.aConferir || []).forEach((k) => {
    if (JUR_CAMPOS_FORM[k]) jurConferirForm[k] = String(j[k] || "").trim();
  });
  jurPintarTagsForm();
  /* editar é incluir com os campos preenchidos: sem trocar de modo, o
   * formulário ficaria escondido e o clique não faria nada visível */
  jurModo = "incluir";
  jurPintarModo();
  /* os outros julgados saem de cena enquanto este é editado (e o botão os traz de volta) */
  jurOutrosAberto = false;
  jurPintarLista();
  /* editando à mão, os campos são o que se veio mexer */
  jurMeta(true);
  jurConteudoVisivel(true);
  jurBotaoSalvar();
  /* (v18.36.0) a tese deste julgado veio da memória da IA: dito na hora de editar */
  if (j.deMemoria && $("jurColarAviso")) {
    $("jurColarAviso").hidden = false;
    $("jurColarAviso").className = "ed-mud";
    $("jurColarAviso").textContent = t("jur_mem_editar_aviso", { c: j.certeza ? t("jur_cn_certeza_" + j.certeza) : "?" });
  }
  if ($("jurTese") && $("jurTese").focus) $("jurTese").focus();
}

async function jurTirar(id) {
  if (!jurTopicoAtual) return;
  const j = jurDe(id);
  /* DESLIGAR NÃO É APAGAR, e a diferença precisa estar na pergunta: o
   * mesmo julgado costuma servir a meia dúzia de tópicos. */
  const outros = ((j && j.topicos) || []).length - 1;
  if (!(await uiConfirm(t(outros > 0 ? "jur_tirar_conf_varios"
                                     : "jur_tirar_conf"),
        { t: jurTitulo(j), n: outros }))) return;
  jurDesligar(id, jurTopicoAtual.chave);
  reg("JURIS", "julgado desligado do topico",
      jurTitulo(j) + " · " + jurTopicoAtual.nome);
  /* tirou o último: não há mais leitura, e a tela precisa acompanhar */
  if (!jurDoTopico(jurTopicoAtual.chave).length) jurModo = "incluir";
  jurPintarModo();
  jurPintarLista();
  jurRepintarTelas();
}

/* O **NEGRITO** VIRA NEGRITO, sem innerHTML.
 *
 * O extrator novo já tira a marcação do que se cola daqui em diante,
 * mas o que foi guardado ANTES tem os asteriscos gravados no texto — e
 * migrar o armazenamento para consertar aparência é mexer no dado por
 * causa da tela. Desenhar resolve os dois casos e não altera nada do
 * que está guardado.
 *
 * NÃO USA innerHTML: o texto vem de uma colagem de fora, e montar HTML
 * com ele daria a qualquer página copiada a chance de injetar marcação
 * na tela do aplicativo. Aqui só existem nós de texto e <b>. */
function jurEscreverTese(el, txt) {
  el.textContent = "";
  String(txt || "").split(/(\*\*[^*]+\*\*)/g).forEach((p) => {
    if (!p) return;
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      const b = document.createElement("b");
      b.textContent = p.slice(2, -2);
      el.append(b);
    } else {
      el.append(document.createTextNode(p));
    }
  });
}

/* ------------------------------------------------------------------
 * OS REPETIDOS, quando existem
 *
 * "ADI 2405" e "ADI 2.405" viraram dois cartões na mesma tela no uso
 * real. São o mesmo processo, e o que os separou foi o ponto de milhar.
 * Aqui a tela diz isso e oferece a união — sem fazê-la sozinha: unir
 * mistura duas teses num registro só, e desfazer isso na véspera da
 * prova não é possível.
 * ------------------------------------------------------------------ */
function jurPintarRepetidos() {
  const cx = $("jurRepetidos");
  if (!cx || !jurTopicoAtual) return;
  cx.innerHTML = "";
  const pares = jurRepetidosDoTopico(jurTopicoAtual.chave);
  cx.hidden = !pares.length || jurModo !== "ler";
  if (cx.hidden) return;

  const tit = document.createElement("div");
  tit.className = "jur-rep-tit";
  /* O TÍTULO CONTA QUANTOS PROCESSOS, e não quantos registros.
   *
   * "Parece o mesmo julgado guardado duas vezes" sobre uma lista de
   * DUAS linhas se lê como "estas duas linhas são a mesma coisa" — e as
   * duas linhas eram um RE e uma ADI, processos evidentemente
   * diferentes. Quem lia concluía, com razão, que o app estava propondo
   * uma besteira.
   *
   * Cada linha é UM processo que está guardado duas vezes. O aviso
   * inteiro nunca comparou uma linha com a outra. */
  tit.textContent = t(pares.length > 1 ? "jur_rep_tit_n" : "jur_rep_tit",
                      { n: pares.length });
  cx.append(tit);
  const exp = document.createElement("div");
  exp.className = "nota";
  exp.textContent = t("jur_rep_exp");
  cx.append(exp);

  pares.forEach((p) => {
    const li = document.createElement("div");
    li.className = "jur-rep-li";

    const esq = document.createElement("div");
    esq.className = "jur-rep-txt";
    const nome = document.createElement("div");
    nome.className = "jur-rep-nome";
    nome.textContent = t("jur_rep_um", { t: jurTitulo(p.fica), n: 2 });
    esq.append(nome);

    /* AS DUAS CÓPIAS, ESCRITAS.
     *
     * Sem elas, "unir os dois" pedia um ato de fé: não dava para ver o
     * que ia ser unido nem conferir que são mesmo o mesmo processo. Com
     * as duas teses lado a lado, a decisão se toma olhando — e o caso
     * em que o app se engana (dois julgados de números iguais em
     * tribunais diferentes) fica visível antes de unir, não depois. */
    [p.fica, p.vai].forEach((x, i) => {
      const l = document.createElement("div");
      l.className = "jur-rep-copia";
      const tese = String(x.tese || x.texto || "").replace(/\s+/g, " ").trim();
      l.textContent = t("jur_rep_copia", { i: i + 1 })
        + " " + (tese ? tese.slice(0, 110) + (tese.length > 110 ? "…" : "")
                      : t("jur_rep_sem_tese"));
      l.title = tese;
      esq.append(l);
    });

    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min";
    b.textContent = t("jur_rep_unir");
    b.title = t("jur_rep_unir_aj", { t: jurTitulo(p.fica) });
    b.onclick = () => jurUnirPar(p.fica.id, p.vai.id);
    li.append(esq, b);
    cx.append(li);
  });
}

async function jurUnirPar(idFica, idVai) {
  const a = jurDe(idFica);
  const b = jurDe(idVai);
  if (!a || !b) return;
  /* A PERGUNTA MOSTRA AS DUAS TESES.
   *
   * "Unir os dois registros de STF RE 584.100?" não dá o que conferir:
   * a pessoa está sendo convidada a apagar um registro sem ver o que há
   * dentro dele. Com as duas teses na pergunta, ela vê que são a mesma
   * decisão escrita de dois jeitos — ou vê que NÃO são, e cancela. */
  const corta = (x) => {
    const s2 = String(x.tese || x.texto || "").replace(/\s+/g, " ").trim();
    return s2 ? s2.slice(0, 220) + (s2.length > 220 ? "…" : "")
              : t("jur_rep_sem_tese");
  };
  if (!(await uiConfirm(t("jur_rep_unir_conf", {
        t: jurTitulo(a), a: corta(a), b: corta(b) })))) return;
  const r = jurUnir(idFica, idVai);
  if (!r) return;
  reg("JURIS", "julgados repetidos unidos", jurTitulo(r));
  jurPintarLista();
  jurRepintarTelas();
  await uiAlert(t("jur_rep_uniu", { t: jurTitulo(r) }));
}

/* PEDIR À IA QUE LEIA A EMENTA E PREENCHA.
 *
 * O texto que vai na pergunta é o que está na caixa de colar — o mesmo
 * que a pessoa acabou de colar do tribunal. A resposta volta pela mesma
 * caixa, e o "ler e preencher" a entende porque ela vem em JSON. Um
 * caminho só, sem tela nova. */
async function jurPedirIA() {
  const bruto = String(($("jurColar") || {}).value || "").trim();
  if (!bruto) { await uiAlert(t("jur_prompt_ia_vazio")); return; }
  /* TEXTO CURTO DEMAIS: a IA só consegue identificar o julgado pelo nome e devolve tudo vazio ("tipo_do_texto": "vazio").
   * Melhor dizer isso ANTES de a pessoa sair do app e voltar com uma resposta sem nada. */
  if (bruto.length < JUR_TEXTO_MINIMO && !(await uiConfirm(t("jur_prompt_curto", { n: bruto.length })))) return;
  const campos = {};
  Object.keys(JUR_CAMPOS_FORM).forEach((k) => {
    campos[k] = String(($(JUR_CAMPOS_FORM[k]) || {}).value || "").trim();
  });
  /* O TEXTO ENVIADO FICA GUARDADO: a resposta volta pela mesma caixa e a
   * apaga; é contra ele que se confere o que a IA devolver */
  jurUltimoTextoPedido = bruto;
  const txt = jurPromptIA({
    topico: jurTopicoAtual ? jurTopicoAtual.nome : "",
    texto: bruto, campos,
    pedirPrecedentes: /S[UÚ]MULA|REPETITIVO|REPERCUSS/i.test(
      jurCategoriaColada || jurCategoria(campos.classe) || ""),
    tese: String(($("jurTese") || {}).value || "").trim(),
    resumo: String(($("jurResumo") || {}).value || "").trim(),
    tags: jurTagsColadas.slice(),
  }, { memoria: ($("chkJurMemoria") && $("chkJurMemoria").checked) ? "tudo" : "identidade", separar: jurSepararAtivo() });
  const ok = await edColarCopiarTexto(txt, "", null);
  reg("JURIS", "prompt de leitura copiado", bruto.length + " caracteres");
  if (ok) await uiAlert(t("jur_prompt_ia_copiado"));
}

/* =====================================================================
 * COMPLETAR E CONFERIR UM JULGADO JÁ GUARDADO
 *
 * Dois toques, e o segundo é separado do primeiro de propósito: entre
 * copiar a pergunta e colar a resposta a pessoa sai do aplicativo. Um
 * botão só que fizesse as duas coisas teria de adivinhar em qual das
 * duas metades ela está.
 *
 * A GRAVAÇÃO É CEGA PARA CAMPO CHEIO — quem decide isso é jurCompletar,
 * e é lá que a regra tem de morar: aqui é tela, e tela que também
 * decide o que sobrescrever é onde a regra se perde na próxima
 * refatoração.
 * ===================================================================== */
/* =====================================================================
 * COMPLETAR E CONFERIR: OS DOIS PASSOS NUMA TELA SÓ
 *
 * O QUE ESTAVA ERRADO, e era erro meu de leitura da assinatura:
 * uiTexto(titulo, valor, dois, extra) — o terceiro argumento abre uma
 * SEGUNDA caixa de texto, e eu passei "true" achando que pedia caixa
 * alta. Duas consequências, e a segunda escondia a primeira:
 *
 *   1. A tela abria com dois campos idênticos, sem rótulo nenhum, e
 *      ninguém tinha como saber o que ia em cada um.
 *   2. Com "dois" ligado, uiTexto devolve {a, b} — um OBJETO. O
 *      JSON.parse recebia "[object Object]", falhava, e o app dizia
 *      "não entendi essa resposta como JSON" sobre um JSON perfeito.
 *      Ou seja: a mensagem de erro acusava o usuário do meu engano.
 *
 * MAS TROCAR O "true" POR NADA NÃO BASTAVA. A caixa genérica de texto é
 * a ferramenta errada aqui: ela não diz o que colar dentro, não diz de
 * qual julgado se trata, não mostra o que falta, e o resultado saía num
 * alerta que some ao tocar em OK — sendo que o resultado é exatamente o
 * que se lê comparando com o julgado na tela de trás.
 *
 * A TELA PRÓPRIA põe os dois passos na ordem em que se fazem, mostra
 * quais campos estão vazios antes e depois, e deixa o resultado escrito
 * até alguém fechar.
 * ===================================================================== */
let jurCplId = "";           /* julgado aberto nesta tela */

function jurCompletarAbrir(id) {
  const j = jurDe(id);
  if (!j) return;
  jurCplId = id;
  if ($("jurCplAlvo")) {
    $("jurCplAlvo").textContent = jurTitulo(j) || t("jur_sem_titulo");
  }
  if ($("jurCplResposta")) $("jurCplResposta").value = "";
  if ($("jurCplAcoes")) $("jurCplAcoes").innerHTML = "";
  if ($("jurCplSaida")) { $("jurCplSaida").hidden = true; $("jurCplSaida").textContent = ""; }
  jurCplPintarFalta();
  jurCplPintarLer();
  abrirModal("dlgJurCompletar");
  reg("JURIS", "tela de completar aberta",
      jurTitulo(j) + " · faltam " + jurFaltando(j).length);
}

/* OS CAMPOS VAZIOS, ESCRITOS. "Faltam 6" não diz quais, e "quais" é o
 * que decide se vale a pena a ida à IA — faltar o relator é uma coisa,
 * faltar o número do processo é outra. Repintado depois de aplicar, é
 * ele que mostra o que a resposta resolveu. */
function jurCplPintarFalta() {
  const cx = $("jurCplFalta");
  if (!cx) return;
  cx.innerHTML = "";
  const j = jurDe(jurCplId);
  if (!j) return;
  const falta = jurFaltando(j);
  const todos = (typeof JUR_CAMPOS_META !== "undefined" ? JUR_CAMPOS_META : [])
    .map((c) => c.k).concat(["tags"]);
  todos.forEach((k) => {
    const vazio = falta.indexOf(k) >= 0;
    const p = document.createElement("span");
    p.className = "jur-cpl-campo" + (vazio ? "" : " jur-cpl-campo-ok");
    p.textContent = (vazio ? "" : "✓ ") + jurNomeCampo(k);
    p.title = t(vazio ? "jur_cpl_vazio_aj" : "jur_cpl_cheio_aj",
                { c: jurNomeCampo(k) });
    cx.append(p);
  });
}

/* O botão de ler só acende com algo na caixa — desabilitado ele diz o
 * que falta fazer sem precisar de um alerta para dizê-lo. */
function jurCplPintarLer() {
  const b = $("btnJurCplLer");
  if (!b) return;
  b.disabled = !String(($("jurCplResposta") || {}).value || "").trim();
}

async function jurCompletarPedir(id) {
  const j = jurDe(id || jurCplId);
  if (!j) return;
  /* SEM EMENTA GUARDADA o pedido vai sem texto — e a IA responde, com razão, "tipo_do_texto: vazio" */
  if (!String(j.texto || "").trim() && !(await uiConfirm(t("jur_cpl_sem_texto")))) return;
  const txt = jurPromptCompletar(j, jurTopicoAtual ? jurTopicoAtual.nome : "",
    { memoria: ($("chkJurCplMemoria") && $("chkJurCplMemoria").checked) ? "tudo" : "identidade" });
  if (!txt) return;
  const ok = await edColarCopiarTexto(txt, "", null);
  const falta = jurFaltando(j);
  reg("JURIS", "prompt de completar copiado",
      jurTitulo(j) + " · faltam " + falta.length + ": " + falta.join(", "));
  if (ok) jurReagirBtn("btnJurCplCopiar", t("jur_cpl_copiado"));
}

/* COLOU, JÁ LÊ — a mesma regra da caixa de entrada. Não existe motivo
 * para colar a resposta da IA aqui e não querer que ela seja lida. */
function jurCplAoColar() {
  setTimeout(() => {
    jurCplPintarLer();
    const v = String(($("jurCplResposta") || {}).value || "").trim();
    if (!v || (typeof jurJsonDoTexto === "function" && !jurJsonDoTexto(v))) return;
    jurCompletarLer();
  }, 0);
}

function jurCompletarLer() {
  const j = jurDe(jurCplId);
  if (!j) return;
  /* GUARDADO ANTES DE CHAMAR jurCompletar: é o que diferencia "não tinha
   * nada para preencher" de "tinha, e a IA preferiu não arriscar". As
   * duas terminam com r.mudou vazio — jurCompletar nem entra num campo
   * que a resposta devolveu em branco (docs/juris.js, "if (!v) return") —
   * e sem esta lista a mensagem dizia "já tinha conteúdo" mesmo quando a
   * IA tinha acabado de recusar, de propósito, preencher o que faltava.
   * SEM "tags": é o único item de jurFaltando que não corresponde a um
   * campo de texto do formulário (assuntos se SOMAM, nunca "faltam" no
   * mesmo sentido), e quase todo julgado nasce sem etiqueta — contá-lo
   * aqui faria "recusou" aparecer até quando a IA nunca foi questionada
   * sobre isso. */
  const faltaAntes = jurFaltando(j).filter((k) => k !== "tags");
  const bruto = String(($("jurCplResposta") || {}).value || "").trim();
  /* jurJsonDoTexto e não JSON.parse: a resposta chega com cerca de
   * markdown ou com uma frase de cortesia em volta na maioria das
   * vezes, e recusá-la era mandar a pessoa editar texto para agradar o
   * programa. Quatro recusas seguidas no registro do usuário, todas com
   * o objeto lá dentro. */
  const dados = (typeof jurJsonDoTexto === "function")
    ? jurJsonDoTexto(bruto) : null;
  if (!dados) {
    reg("JURIS", "resposta de completar recusada", "não era JSON");
    jurCplMostrarErroJson(bruto);
    return;
  }
  const r = jurCompletar(jurCplId, dados);
  const partes = [];
  /* a IA diz, no próprio JSON, que não recebeu o que ler: isso explica o "nada mudou" e vem antes de tudo */
  if (/^(vazio|so_identificacao)$/i.test(String(dados.tipo_do_texto || ""))) {
    partes.push("⚠ " + t("jur_resp_vazia", { motivo: t(/^vazio$/i.test(String(dados.tipo_do_texto)) ? "jur_resp_motivo_vazio" : "jur_resp_motivo_ident") })
      + "\n" + t("jur_resp_proximo_cpl") + "\n\n");
  }
  partes.push(r.mudou.length
    ? t("jur_completar_fez", { q: r.mudou.map(jurNomeCampo).join(", ") })
    : (faltaAntes.length ? t("jur_completar_recusou") : t("jur_completar_zero")));
  if (r.ignorados.length) {
    partes.push(t("jur_completar_ignorou",
      { q: r.ignorados.map(jurNomeCampo).join(", ") }));
  }
  /* A CONFERÊNCIA É AVISO, NUNCA CORREÇÃO.
   * A tese é transcrição do tribunal e o resumo é texto de estudo: uma
   * troca automática apagaria a palavra certa achando que era a errada,
   * e o erro sairia gravado com a autoridade de "o app corrigiu". */
  const conf = Array.isArray(dados.conferencia) ? dados.conferencia : [];
  jurCplPintarAcoes(conf);
  if (conf.length) {
    partes.push("\n\n" + t("jur_conferencia_tit") + "\n"
      + conf.slice(0, 8).map((c) => t("jur_conferencia_linha", {
          c: String((c && c.campo) || "?"),
          p: String((c && c.problema) || ""),
          tr: String((c && c.trecho) || ""),
          sg: String((c && c.sugestao) || ""),
        })).join("\n\n")
      + t("jur_conferencia_aviso"));
  } else {
    partes.push(t("jur_conferencia_nada"));
  }
  if (dados.identificacao) {
    partes.push(t("jur_ident_tit", { q: String(dados.identificacao) }));
  }
  if (r.aConferir && r.aConferir.length) {
    partes.push(t("jur_completar_conferir",
      { q: r.aConferir.map(jurNomeCampo).join(", ") }));
  }
  reg("JURIS", "resposta de completar aplicada",
      jurTitulo(j) + " · preenchidos " + r.mudou.length
      + " · a conferir " + ((r.aConferir || []).length)
      + " · apontamentos " + conf.length);
  jurCplEscrever(partes.join(""));
  jurCplPintarFalta();
  jurPintarLista();
}

/* A TESE NUNCA É TROCADA SOZINHA — mas apontar o erro e deixar a pessoa
 * copiar a redação sugerida à mão era pedir um passo que o app sabe fazer.
 * O botão mostra ANTES e DEPOIS, e só troca com o "sim"; a nova redação
 * vem da memória da IA e entra marcada "a conferir" (campo "tese"). */
function jurCplPintarAcoes(conf) {
  const cx = $("jurCplAcoes");
  if (!cx) return;
  cx.innerHTML = "";
  (conf || []).forEach((c) => {
    if (!c || String(c.campo || "").toLowerCase() !== "tese") return;
    const nova = String(c.sugestao || "").trim();
    if (!nova) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min";
    b.textContent = t("jur_tese_subst_btn");
    b.onclick = () => jurTeseSubstituir(jurCplId, nova);
    cx.append(b);
  });
}

async function jurTeseSubstituir(id, nova) {
  const j = jurDe(id);
  if (!j || !String(nova || "").trim()) return false;
  const antes = String(j.tese || "").trim();
  if (antes === String(nova).trim()) return false;
  if (!(await uiConfirm(t("jur_tese_subst_conf", { a: antes || "(vazia)", d: nova })))) return false;
  const atuais = Array.isArray(j.aConferir) ? j.aConferir : [];
  jurGravar({ id, tese: String(nova).trim(),
    aConferir: atuais.indexOf("tese") >= 0 ? atuais : atuais.concat(["tese"]) });
  reg("JURIS", "tese trocada pela redação sugerida (a conferir)", jurTitulo(j));
  jurCplPintarFalta();
  jurPintarLista();
  toast("jur_tese_subst_feito");
  return true;
}

function jurCplEscrever(txt, erro) {
  const cx = $("jurCplSaida");
  if (!cx) return;
  cx.hidden = false;
  cx.textContent = txt;
  cx.className = "jur-cpl-saida" + (erro ? " jur-cpl-saida-erro" : "");
}

/* A SELEÇÃO NA PRÓPRIA CAIXA É O FEEDBACK VISUAL: jurDiagnosticoJson diz
 * onde o JSON.parse desistiu de entender, e setSelectionRange faz o
 * navegador pintar esse trecho sozinho — sem overlay, sem reinventar
 * destaque de texto. A pessoa vê exatamente qual pedaço colado quebrou
 * tudo, em vez de reler a resposta inteira à procura do erro. */
function jurCplMostrarErroJson(bruto) {
  const d = (typeof jurDiagnosticoJson === "function") ? jurDiagnosticoJson(bruto) : null;
  let msg = t("jur_completar_nada");
  if (d && d.motivo === "sem_fechamento") {
    msg = t("jur_completar_erro_truncado");
  } else if (d && d.motivo === "sintaxe") {
    msg = t(d.causa === "aspas" ? "jur_completar_erro_aspas" : "jur_completar_erro_sintaxe",
      { l: d.linha, trecho: d.trecho });
  }
  const ta = $("jurCplResposta");
  if (ta && d && d.ini != null && d.fim != null && typeof ta.setSelectionRange === "function") {
    try { ta.focus(); ta.setSelectionRange(d.ini, d.fim); } catch (e) {}
  }
  jurCplEscrever(msg, true);
}

function jurNomeCampo(k) {
  const c = (typeof JUR_CAMPOS_META !== "undefined" ? JUR_CAMPOS_META : [])
    .filter((x) => x.k === k)[0];
  if (c) return t(c.i);
  if (k === "tese") return t("jur_f_tese");
  return k === "tags" ? t("jur_f_tags") : k;
}

/* =====================================================================
 * MELHORAR O RESUMO — antes/depois, e só aplica quem confirma
 *
 * "Completar e conferir" (acima) preenche o que falta e aponta erro,
 * sem reescrever nada — era o que faltava para "corrigir lacunas". O
 * que ainda faltava de verdade era MELHORAR A REDAÇÃO de um resumo que
 * já existe, mas saiu mal escrito. Mesmo formato do "cartão-melhorar"
 * (docs/cartao-melhorar.js, mesmas classes ".qm-*"): gera o prompt,
 * você cola a resposta, vê o antes/depois, e só então aplica.
 *
 * DIFERENÇA DE PROPÓSITO: a resposta aqui é texto simples — um campo
 * só, não um cartão com frente/verso — e "aplicar" escreve na caixa do
 * formulário, não grava sozinho. Salvar continua sendo o "Guardar" de
 * sempre, a mesma regra de "marcar é experimentar" que já vale para
 * grifos na lei seca: aplicar é olhar o resultado, não é comprometer-se
 * com ele. */
let jurMelAntes = "";
let jurMelDepois = "";

function jurMelAbrir() {
  if (!$("dlgJurMelhorar")) return;
  const resumo = String(($("jurResumo") || {}).value || "").trim();
  const tese = String(($("jurTese") || {}).value || "").trim();
  const ementa = String(($("jurColar") || {}).value || "").trim();
  jurMelAntes = resumo;
  jurMelDepois = "";
  $("jurMelPrompt").value = jurPromptMelhorar(
    jurTopicoAtual ? jurTopicoAtual.nome : "", tese, ementa, resumo);
  $("jurMelColar").value = "";
  $("jurMelComparar").hidden = true;
  $("btnJurMelAplicar").hidden = true;
  abrirModal("dlgJurMelhorar");
  reg("JURIS", "melhorar o resumo aberto", jurTopicoAtual ? jurTopicoAtual.nome : "");
}

function jurMelConferir() {
  const cru = String(($("jurMelColar") || {}).value || "").trim();
  if (!cru) { uiAlert(t("jur_mel_vazio")); return false; }
  jurMelDepois = cru;

  const cx = $("jurMelComparar");
  cx.innerHTML = "";
  [["cm_mel_antes", jurMelAntes || t("jur_mel_antes_vazio"), "qm-antes"],
   ["cm_mel_depois", jurMelDepois, "qm-depois"]].forEach(([rot, texto, cls]) => {
    const r1 = document.createElement("div");
    r1.className = "qm-rot";
    r1.textContent = t(rot);
    const d = document.createElement("div");
    d.className = "qm-lado " + cls;
    d.textContent = texto;
    cx.append(r1, d);
  });
  cx.hidden = false;
  $("btnJurMelAplicar").hidden = false;
  reg("JURIS", "antes/depois do resumo conferido", jurTopicoAtual ? jurTopicoAtual.nome : "");
  return true;
}

/* NÃO GRAVA — escreve na caixa do formulário, igual toda marcação
 * "experimental" deste app. Quem confirma de verdade é o "Guardar". */
function jurMelAplicar() {
  if (!jurMelDepois || !$("jurResumo")) return false;
  $("jurResumo").value = jurMelDepois;
  $("dlgJurMelhorar").close();
  reg("JURIS", "resumo melhorado aplicado ao formulário (ainda não salvo)",
      jurTopicoAtual ? jurTopicoAtual.nome : "");
  return true;
}

/* O PROMPT, para quando a aritmética não responde. */
async function jurCopiarPrompt() {
  if (!jurTopicoAtual) return;
  const lista = jurDoTopico(jurTopicoAtual.chave);
  if (lista.length < 2) { await uiAlert(t("jur_prompt_poucos")); return; }
  /* QUAIS JULGADOS VÃO ENTRAR, escritos antes de copiar.
   * "Criar prompt" sem dizer sobre o quê obriga a colar numa IA para
   * descobrir o que foi perguntado — e o prompt sai com o texto inteiro
   * das teses, que é o que se manda para fora do aparelho. */
  if (!(await uiConfirm(t("jur_prompt_escopo", {
        n: lista.length,
        l: lista.map((x) => jurTitulo(x) || t("jur_sem_titulo")).join("\n· "),
      })))) return;
  const txt = jurPromptComparar(lista);
  const ok = await edColarCopiarTexto(txt, "", null);
  reg("JURIS", "prompt de comparacao copiado",
      lista.length + " julgados de " + jurTopicoAtual.nome);
  if (ok) jurReagirBtn("btnJurPrompt", t("jur_prompt_copiado"));
}

function jurPintarLista() {
  const box = $("jurLista");
  if (!box || !jurTopicoAtual) return;
  jurPintarLista._memo = {};
  box.innerHTML = "";
  let lista = jurDoTopico(jurTopicoAtual.chave);
  /* Q3 — aberta por um ramo: só os julgados LIGADOS a ele, com a faixa que diz isso e leva de volta ao tópico inteiro */
  const faixa = $("jurRamoFaixa");
  if (faixa) {
    faixa.hidden = !jurRamoAlvo;
    if (jurRamoAlvo) $("jurRamoFaixaTxt").textContent = t(jurModo === "ler" ? "jur_ramo_faixa" : "jur_ramo_faixa_incluir", { r: jurRamoAlvo.nome });
  }
  if (jurRamoAlvo) lista = lista.filter((x) => { const r = jurRamoDe(x, jurTopicoAtual.chave); return r && r.id === jurRamoAlvo.id; });
  /* O FILTRO POR ETIQUETA vale só enquanto a gaveta está aberta: é uma
   * lente de leitura, não uma preferência que se guarda. */
  if (jurFiltroTag) {
    const alvo = jurTagNormal(jurFiltroTag);
    lista = lista.filter((x) =>
      jurTagsDe(x).some((tg) => jurTagNormal(tg) === alvo));
  }
  const conta = $("jurConta");
  if (conta) {
    conta.textContent = lista.length
      ? t("jur_conta", { n: lista.length }) : t("jur_conta_zero");
  }
  jurPintarRepetidos();
  /* CRIANDO OU EDITANDO, A LISTA FICA RECOLHIDA (e os avisos de repetidos junto): é do que se escreve, não dos outros,
   * que a tela precisa. Os elementos continuam desenhados e só ficam escondidos — o botão os traz de volta. */
  const todosDoTopico = jurDoTopico(jurTopicoAtual.chave).length;
  /* (JM2) quem chega pela primeira vez a um tópico sem julgado: os três jeitos de guardar o primeiro */
  if ($("jurComecar")) $("jurComecar").hidden = !(jurModo !== "ler" && !todosDoTopico);
  const recolhida = jurModo !== "ler" && !jurOutrosAberto;
  const bOutros = $("btnJurOutros");
  if (bOutros) {
    bOutros.hidden = jurModo === "ler" || !todosDoTopico;
    bOutros.textContent = t(jurOutrosAberto ? "jur_outros_ocultar" : "jur_outros_ver", { n: todosDoTopico });
    bOutros.title = t("jur_outros_aj");
  }
  if (conta) conta.hidden = recolhida;
  box.hidden = recolhida;
  if ($("jurRepetidos") && recolhida) $("jurRepetidos").hidden = true;
  /* O prompt de comparação só faz sentido com dois ou mais. */
  if ($("btnJurPrompt")) $("btnJurPrompt").hidden = lista.length < 2 || jurModo !== "ler";
  if (!lista.length) return;

  lista.forEach((j) => {
    const li = document.createElement("div");
    li.className = "jur-item";

    const cab = document.createElement("div");
    cab.className = "jur-cab";

    /* ETIQUETAS, NÃO UMA FRASE.
     *
     * "STF ADI 2.405 19/12/2003" é uma linha de texto em que os três
     * dados têm o mesmo peso e nenhum se acha de relance. Separados, o
     * olho pula direto para a corte — que é como se procura julgado
     * numa lista de dez. */
    const sel = (txt, cls) => {
      const b = document.createElement("span");
      b.className = "jur-sel " + cls;
      b.textContent = txt;
      cab.append(b);
      return b;
    };
    if (j.tribunal) sel(j.tribunal, "trib");
    /* Q3 — o ramo deste julgado neste tópico */
    const rJ = jurRamoDe(j, jurTopicoAtual.chave);
    if (rJ) sel(t("qs_ramo_tag", { r: rJ.nome || rJ.id }), "ramo");
    const proc = [j.classe, j.numero].filter(Boolean).join(" ");
    if (proc) sel(proc, "proc");
    /* DOIS PROCESSOS NUMA FICHA SÓ. Só aponta — dividir é decisão de
     * quem estuda, a mesma regra dos outros avisos desta tela. */
    if (typeof jurPareceDoisProcessos === "function" && jurPareceDoisProcessos(j)) {
      sel(t("jur_dois_proc"), "dois-proc").title = t("jur_dois_proc_aj");
    }
    /* A CATEGORIA MUDA O JEITO DE ESTUDAR, e por isso vale um selo
     * próprio: súmula vinculante se decora literal, tema repetitivo se
     * decora pela tese, acórdão isolado se lê pelo raciocínio.
     * Deduzida da classe quando ninguém a informou. */
    const cat = j.categoria || (typeof jurCategoria === "function"
      ? jurCategoria(j.classe) : "");
    if (cat) {
      const c = sel(cat, "cat cat-" + cat.split(" ")[0].toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      c.title = t("jur_cat_aj");
    }
    /* (JM4) superada / cancelada / alterada: dito no próprio julgado, com a fonte no balão */
    const svG = typeof jurSeloSituacao === "function" ? jurSeloSituacao(j) : null;
    if (svG) cab.append(svG);
    if (j.data) {
      const d = document.createElement("span");
      d.className = "jur-data";
      d.textContent = String(j.data).split("-").reverse().join("/");
      cab.append(d);
    }
    if (j.orgao) {
      const o = document.createElement("span");
      o.className = "jur-orgao";
      o.textContent = j.orgao;
      cab.append(o);
    }
    /* (v18.39.0→JM2, v18.40.0) UMA SITUAÇÃO POR JULGADO, E O RESTO NUM ⋯.
     *
     * Eram até oito controles mudos no cabeçalho de cada julgado — 🩹N, ✅, "⚠ N a conferir", "conferir ↗", 🃏, ✏️, 📋,
     * 🗑️ — e mais uma linha inteira de "Ramo deste julgado" em todo cartão. Três falavam da mesma coisa (conferir), e o
     * 🩹 com número aparecia em quase todo julgado só porque a ementa é opcional: parecia erro onde não havia.
     * Agora: UM selo de situação (só quando há algo a fazer: tese de memória ou campos a conferir), que abre um painel
     * com o porquê e as ações (conferi · site oficial · completar com a IA); à vista só o 🃏 (o que se faz com um julgado
     * bom) e o ⋯, que abre editar, completar/conferir com a IA, copiar, ramo e excluir — com nome escrito. */
    const conferir = Array.isArray(j.aConferir) ? j.aConferir : [];
    const falta = (typeof jurFaltando === "function") ? jurFaltando(j) : [];
    const sit = document.createElement("div");
    sit.className = "jur-situacao";
    sit.hidden = true;
    const abreSit = (el) => {
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); sit.hidden = !sit.hidden; };
      el.onkeydown = (ev) => { if (ev && (ev.key === "Enter" || ev.key === " ")) { if (ev.preventDefault) ev.preventDefault(); sit.hidden = !sit.hidden; } };
    };
    /* (v18.36.0) A TESE VEIO DA MEMÓRIA DA IA (criada pela citação, sem ementa): o selo fica até alguém conferir */
    if (j.deMemoria) {
      const m = sel(t("jur_mem_selo") + " ▾", "conferir jur-mem");
      m.title = t("jur_mem_selo_aj", { c: j.certeza ? t("jur_cn_certeza_" + j.certeza) : "?" });
      abreSit(m);
      const p = document.createElement("p");
      p.className = "nota";
      p.textContent = t("jur_sit_mem", { c: j.certeza ? t("jur_cn_certeza_" + j.certeza) : "?" });
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "btn-min btn-min-ok jur-mem-ok";
      ok.id = "btnJurMemOk_" + j.id;
      ok.textContent = t("jur_cn_conferi");
      ok.title = t("jur_mem_ok_aj");
      ok.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        jurGravar({ id: j.id, deMemoria: false });
        try { reg("JURIS", "tese de memória conferida (gaveta)", jurTitulo(j)); } catch (e) {}
        jurPintarLista();
        try { jurRepintarTelas(); } catch (e) {}
      };
      sit.append(p, ok);
    }
    /* O QUE A IA TROUXE E NINGUÉM CONFERIU: sem o selo, um dado lembrado e um dado lido do tribunal têm a mesma cara */
    if (conferir.length) {
      const c = sel(t("jur_a_conferir_n", { n: conferir.length }) + " ▾", "conferir");
      c.title = t("jur_a_conferir_aj", { q: conferir.map(jurNomeCampo).join(", ") });
      abreSit(c);
      const p = document.createElement("p");
      p.className = "nota";
      p.textContent = t("jur_sit_conferir", { q: conferir.map(jurNomeCampo).join(", ") });
      const bOk = document.createElement("button");
      bOk.type = "button";
      bOk.className = "btn-min btn-min-ok jur-ic-conferi";
      bOk.id = "btnJurConferi_" + j.id;
      bOk.textContent = t("jur_sit_conferi_btn");
      bOk.title = t("jur_conferi_aj");
      bOk.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        jurMarcarConferido(j.id);
        reg("JURIS", "campos conferidos na fonte", jurTitulo(j) + " · " + conferir.join(", "));
        jurPintarLista();
        toast("jur_conferi_feito");
      };
      sit.append(p, bOk);
      const portal = typeof jurPortalOficial === "function" ? jurPortalOficial(j.tribunal) : null;
      if (portal) {
        const a = document.createElement("a");
        a.className = "jur-oficial-lnk";
        a.href = portal.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = t("jur_oficial_lnk");
        a.title = t("jur_oficial_rot") + " " + portal.nome;
        sit.append(a);
      }
    }
    if (j.deMemoria || conferir.length) {
      const bIA = document.createElement("button");
      bIA.type = "button";
      bIA.className = "btn-min";
      bIA.textContent = t("jur_sit_ia_btn");
      bIA.title = t("jur_completar_ok");
      bIA.onclick = () => jurCompletarAbrir(j.id);
      sit.append(bIA);
    }

    const acoes = document.createElement("div");
    acoes.className = "jur-acoes";
    const bt = (icone, rot, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "jur-ic" + (cls ? " " + cls : "");
      b.textContent = icone;
      b.title = rot;
      b.setAttribute("aria-label", rot);
      b.onclick = fn;
      acoes.append(b);
      return b;
    };
    bt("🃏", t("jur_card_dica"), "", () => jurGerarCartao(j.id));
    /* O ⋯: as ações com NOME (um ícone mudo só se lê para quem já sabe o que ele faz) */
    const mais = document.createElement("div");
    mais.className = "jur-mais-painel";
    mais.hidden = true;
    const bMais = bt("⋯", t("jur_mais_aj"), "jur-ic-mais", (ev) => {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      mais.hidden = !mais.hidden;
      bMais.setAttribute("aria-expanded", mais.hidden ? "false" : "true");
    });
    bMais.setAttribute("aria-expanded", "false");
    const item = (rot, dica, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min jur-mais-item" + (cls ? " " + cls : "");
      b.textContent = rot;
      b.title = dica;
      b.onclick = fn;
      mais.append(b);
      return b;
    };
    item("✏️ " + t("jur_mais_editar"), t("jur_ed"), "", () => jurEditar(j.id));
    /* completar com a IA: o que falta, escrito (era o 🩹 com número, que parecia erro) */
    item("🩹 " + (falta.length ? t("jur_mais_completar_n", { q: falta.map(jurNomeCampo).join(", ") }) : t("jur_mais_conferir_ia")),
      falta.length === 1 ? t("jur_completar_falta_um", { q: jurNomeCampo(falta[0]) })
        : falta.length ? t("jur_completar_falta", { n: falta.length, q: falta.map(jurNomeCampo).join(", ") }) : t("jur_completar_ok"),
      "", () => jurCompletarAbrir(j.id));
    item("📋 " + t("jur_mais_copiar"), t("jur_cp"), "", async () => {
      const ok = await edColarCopiarTexto(jurTexto([j]), "", null);
      if (ok) toast("toast_copied");
    });
    /* Q3 — escolher o ramo deste julgado (quando o tópico tem ramos): dentro do ⋯, e não uma linha em todo julgado */
    const ramosT = typeof qsUiRamosDoTopico === "function" ? qsUiRamosDoTopico(jurTopicoAtual.chave, jurPintarLista._memo || (jurPintarLista._memo = {})) : [];
    if (ramosT.length) {
      const lb = document.createElement("label");
      lb.className = "jur-ramo-sel";
      const sp = document.createElement("span");
      sp.textContent = t("jur_ramo_rot") + " ";
      const sl = document.createElement("select");
      [["", t("qs_ramo_nenhum")]].concat(ramosT.map((r) => [r.id, r.nome])).forEach(([v, rot]) => {
        const o = document.createElement("option"); o.value = v; o.textContent = rot; sl.append(o);
      });
      sl.value = rJ && ramosT.some((r) => r.id === rJ.id) ? rJ.id : "";
      sl.onchange = () => {
        const r = ramosT.find((x) => x.id === sl.value);
        jurLigarRamo(j.id, jurTopicoAtual.chave, sl.value, r ? r.nome : "");
        jurPintarLista();
      };
      lb.append(sp, sl);
      mais.append(lb);
    }
    item("🗑️ " + t("jur_mais_excluir"), t("jur_tr"), "jur-mais-perigo", () => jurTirar(j.id));
    cab.append(acoes);
    li.append(cab, sit, mais);

    /* A TESE COMO CITAÇÃO. É o que se revisa; a ementa é onde se
     * confere. Com a mesma tipografia, os dois viravam um bloco só de
     * texto e a tese se perdia dentro dele. */
    if (j.tese) {
      const p = document.createElement("blockquote");
      p.className = "jur-tese";
      jurEscreverTese(p, j.tese);
      li.append(p);
    }

    /* OS PRECEDENTES: de onde a súmula/o tema saiu. Uma linha, discreta —
     * é para conferir, não para decorar. */
    if (j.precedentes) {
      const pr = document.createElement("div");
      pr.className = "jur-prec";
      pr.textContent = t("jur_prec_rot") + " " + j.precedentes;
      li.append(pr);
    }

    /* O RESUMO VEM DEPOIS DA TESE, e menor.
     * A tese é o que se decora; o resumo é o que se lê quando a tese
     * sozinha não basta. Invertendo o tamanho, a explicação roubaria a
     * atenção da frase que cai na prova. */
    if (j.resumo) {
      const rs = document.createElement("div");
      rs.className = "jur-resumo";
      rs.textContent = j.resumo;
      li.append(rs);
    }

    /* AS ETIQUETAS DE ASSUNTO, clicáveis.
     *
     * Elas cruzam julgados de tópicos diferentes: a mesma etiqueta liga
     * uma ADI estudada em Tributário a um repetitivo estudado em
     * Administrativo — o que a árvore do edital, por ser árvore, não
     * consegue fazer. Clicar filtra a lista por ela. */
    const tags = (typeof jurTagsDe === "function") ? jurTagsDe(j) : [];
    if (tags.length) {
      const cx2 = document.createElement("div");
      cx2.className = "jur-tags";
      tags.forEach((tg) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "jur-tag"
          + (jurTagNormal(tg) === jurTagNormal(jurFiltroTag) ? " sel" : "");
        b.textContent = "#" + tg;
        b.title = t("jur_tag_aj", { t: tg });
        b.onclick = (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          jurFiltroTag = (jurTagNormal(tg) === jurTagNormal(jurFiltroTag))
            ? "" : tg;
          jurPintarLista();
        };
        cx2.append(b);
      });
      li.append(cx2);
    }

    /* EM QUANTOS TÓPICOS ELE ESTÁ. É o que impede o susto de "tirei
     * daqui e sumiu de lá também" — e mostra que a mesma tese está
     * fazendo trabalho em mais de um lugar. */
    const n = (j.topicos || []).length;
    if (n > 1) {
      const em = document.createElement("div");
      em.className = "jur-em";
      em.textContent = t("jur_em_varios", { n });
      li.append(em);
    }

    /* A EMENTA INTEIRA, sob demanda e só na leitura.
     *
     * A tese cabe em três linhas e é o que se revisa; a ementa tem
     * trinta e é o que se consulta quando a tese sozinha não basta.
     * Mostrar as duas sempre faria a lista de cinco julgados virar uma
     * rolagem de página inteira. No formulário ela já está na caixa de
     * colar, e repeti-la ali seria o mesmo texto duas vezes na tela. */
    if (jurModo === "ler" && j.texto && j.texto.trim() !== (j.tese || "").trim()) {
      const cheia = document.createElement("pre");
      cheia.className = "jur-ementa";
      cheia.textContent = j.texto;
      cheia.hidden = true;
      const bVer = document.createElement("button");
      bVer.type = "button";
      bVer.className = "btn-min jur-ementa-btn";
      bVer.textContent = t("jur_ver_ementa");
      /* o próprio botão, não o alvo do evento: o simulador dos testes
       * chama onclick sem evento, e "ev.target" seria undefined lá */
      bVer.onclick = () => {
        cheia.hidden = !cheia.hidden;
        bVer.textContent = t(cheia.hidden ? "jur_ver_ementa"
                                          : "jur_esconder_ementa");
      };
      li.append(bVer, cheia);
    }

    box.append(li);
  });
}

/* ------------------------------------------------------------------
 * DO JULGADO PARA O CARTÃO
 *
 * Guardar a tese é metade do trabalho; a outra metade é reencontrá-la
 * na semana que vem sem abrir esta gaveta. O cartão nasce da TESE, não
 * da ementa: um verso de trinta linhas não se responde, e cartão que
 * não se responde não se revisa.
 *
 * NÃO É CLOZE. O formato do app é "frente :: verso :: etiquetas", com
 * dois lados; a omissão de trecho do Anki ({{c1::…}}) atravessaria o
 * separador e chegaria mutilada na tela de estudo. Pergunta direta é o
 * que este app sabe guardar inteiro.
 *
 * E NÃO GRAVA SOZINHO: mostra frente e verso e pergunta. Um cartão
 * gerado sem confirmação vira lixo que só aparece na revisão, quando
 * já não se sabe de onde veio.
 * ------------------------------------------------------------------ */
function jurCartaoDe(j, topico) {
  if (!j || !String(j.tese || "").trim()) return null;
  const quem = [j.tribunal, [j.classe, j.numero].filter(Boolean).join(" ")]
    .filter(Boolean).join(" ");
  const frente = t("jur_card_frente", {
    q: quem ? "do " + quem : "do tribunal", tp: topico });
  return { frente, verso: String(j.tese).trim() };
}

async function jurGerarCartao(id) {
  const j = jurDe(id);
  if (!jurTopicoAtual || !j) return;
  const c = jurCartaoDe(j, jurTopicoAtual.nome);
  if (!c) { await uiAlert(t("jur_card_sem_tese")); return; }

  const ch = jurTopicoAtual.chave;
  const atual = String(((typeof matResumos !== "undefined" && matResumos[ch])
    || {}).cartoes || "");
  /* IDEMPOTENTE, como o resto do app: gerar duas vezes o mesmo julgado
   * não cria dois cartões iguais. A comparação é pela FRENTE, que é o
   * que identifica a pergunta. */
  const jaTem = atual.split("\n").some((l) =>
    l.split("::")[0].trim().toLowerCase() === c.frente.trim().toLowerCase());
  if (jaTem) { await uiAlert(t("jur_card_repetido")); return; }

  if (!(await uiConfirm(t("jur_card_conf",
      { tp: jurTopicoAtual.nome, f: c.frente, v: c.verso })))) return;

  const tags = [jurTopicoAtual.disciplina, jurTopicoAtual.nome, "jurisprudencia"]
    .concat(j.tribunal ? [j.tribunal] : [])
    .map((x) => String(x).replace(/::/g, "_").replace(/\s+/g, "_"))
    .filter(Boolean);
  const linha = c.frente.replace(/\s*::\s*/g, " — ") + " :: "
    + c.verso.replace(/\s*::\s*/g, " — ").replace(/\r?\n+/g, " ")
    + " :: " + tags.join(" ");
  matGravarCartoes(ch, (atual.trim() ? atual.replace(/\s*$/, "") + "\n" : "") + linha,
    { disciplina: jurTopicoAtual.disciplina, topico: jurTopicoAtual.nome });

  reg("JURIS", "cartão gerado do julgado",
      jurTitulo(j) + " › " + jurTopicoAtual.nome);
  jurRepintarTelas();
  jurPintarLista();
  toast("jur_card_feito");
}

/* ------------------------------------------------------------------
 * DO RESUMO, COM O TEXTO SELECIONADO
 *
 * O gesto principal: lendo o resumo, você encontra a frase que o
 * tribunal decidiu, seleciona e guarda como tese. Sem isso, guardar
 * jurisprudência exigiria sair da leitura, abrir outra tela e redigitar
 * — e ninguém faz isso no meio de um estudo.
 * ------------------------------------------------------------------ */
/* =====================================================================
 * O JULGADO CITADO VIRA LINK (v18.33.0)
 *
 * "(Súmula 430 do STJ)" no resumo, no cartão ou no comentário da questão:
 * tocar abre a PRÉVIA do julgado guardado (tese, resumo, ementa) por cima de
 * onde se está. Sem julgado guardado, "Criar agora" abre a gaveta já com
 * tribunal, classe e número; ao guardar, o link passa a achar o julgado
 * sozinho (a identidade é a mesma), sem vínculo manual.
 * base = {disciplina, topico, chave?, aoVoltar} — de onde veio a citação.
 * ===================================================================== */
function jurCitChave(base) {
  const b = base || {};
  if (b.disciplina && b.topico && typeof matChave === "function") return matChave(b.disciplina, b.topico);
  return b.chave || "";
}
function jurCitNome(j) {
  return [String(j.tribunal || "").trim(), [j.classe, j.numero].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}
function jurCitTrecho(s, n) {
  const x = String(s || "").replace(/\s+/g, " ").trim();
  return x.length > n ? x.slice(0, n - 1) + "…" : x;
}

function jurCitLink(c, base) {
  const b = document.createElement("button");
  b.type = "button";
  let ach = { julgado: null };
  try { ach = jurAcharCitado(c, null, jurCitChave(base)); } catch (e) {}
  const j = ach.julgado;
  b.className = "jur-cit-link" + (j ? "" : " jur-cit-sem") + (c.permanente ? " jur-cit-perm" : "") + (base && base.onde === "cartao" ? " car-jur-link" : "");
  b.textContent = c.texto;
  b.title = j ? t("jur_cit_ir", { j: jurCitNome(j), t: jurCitTrecho(j.tese || j.resumo, 140) })
    : ach.ambiguos ? t("jur_cit_amb", { n: ach.ambiguos.length, j: c.texto })
    : t("jur_cit_sem", { j: c.texto });
  b.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    jurCitIr(c, base);
  };
  return b;
}

let jurCitaAlvo = null;
function jurCitIr(c, base) {
  let ach = { julgado: null };
  try { ach = jurAcharCitado(c, null, jurCitChave(base)); } catch (e) {}
  jurCitPreviewAbrir(c, ach, base);
}

function jurCitPreviewAbrir(c, ach, base) {
  if (!$("dlgJurCitaPreview")) return;
  const j = ach && ach.julgado;
  jurCitaAlvo = { c, base: base || {}, j: j || null };
  $("jurCitaTit").textContent = String(c.texto || "").replace(/[\s.;,]+$/g, "");
  const corpo = $("jurCitaCorpo");
  corpo.innerHTML = "";
  const bloco = (rot, txt, cls) => {
    if (!String(txt || "").trim()) return;
    const d = document.createElement("div");
    d.className = "jur-cita-bloco" + (cls ? " " + cls : "");
    const r = document.createElement("div");
    r.className = "jur-cita-rot";
    r.textContent = rot;
    const x = document.createElement("div");
    x.className = "jur-cita-txt";
    x.textContent = txt;
    d.append(r, x);
    corpo.append(d);
  };
  if ($("jurCitaNovo")) $("jurCitaNovo").hidden = true;
  if ($("dlgJurCitaPreview").classList) $("dlgJurCitaPreview").classList.remove("criando");
  if ($("btnJurCitaGuardar")) $("btnJurCitaGuardar").hidden = true;
  if ($("btnJurCitaGaveta")) $("btnJurCitaGaveta").hidden = true;
  if ($("btnJurCitaConferi")) $("btnJurCitaConferi").hidden = !(j && j.deMemoria);
  if (j) {
    $("jurCitaMeta").textContent = [jurCitNome(j), j.orgao, j.relator, j.data].filter((x) => String(x || "").trim()).join(" · ");
    /* (v18.35.0) a tese que a IA trouxe de memória, sem ementa: fica dito, até a pessoa conferir */
    if (j.deMemoria) bloco("", t("jur_cn_mem_aviso", { c: j.certeza ? t("jur_cn_certeza_" + j.certeza) : "?" }), "jur-cita-mem");
    /* (JM4) a tese guardada não é (só) o que vale hoje */
    if (typeof jurForaDeVigor === "function" && jurForaDeVigor(j)) bloco("", t("jur_cit_fora", { s: t("jur_sit_" + j.situacao), f: j.situacaoFonte || "—" }) + (j.teseAnterior ? " " + t("jur_sit_tese_antiga", { t: j.teseAnterior }) : ""), "jur-cita-fora");
    bloco(t("jur_cit_tese"), j.tese, "jur-cita-tese");
    bloco(t("jur_cit_resumo"), j.resumo);
    bloco(t("jur_cit_ementa"), jurCitTrecho(j.texto, 900));
    if ((j.tags || []).length) bloco(t("jur_cit_tags"), j.tags.join(" · "));
    if (!String(j.tese || j.resumo || j.texto || "").trim()) bloco("", t("jur_cit_vazio"));
  } else if (ach && ach.ambiguos && ach.ambiguos.length) {
    $("jurCitaMeta").textContent = t("jur_cit_amb_meta", { n: ach.ambiguos.length });
    ach.ambiguos.forEach((x, i) => {
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "jur-cita-opcao";
      bt.id = "jurCitaOpcao_" + i;
      bt.textContent = jurCitNome(x) + " — " + jurCitTrecho(x.tese || x.resumo, 110);
      bt.onclick = () => jurCitPreviewAbrir(c, { julgado: x }, base);
      corpo.append(bt);
    });
  } else {
    $("jurCitaMeta").textContent = "";
    bloco("", t("jur_cit_nao_guardado", { j: $("jurCitaTit").textContent }));
    const temTopico = !!(base && base.disciplina && base.topico);
    bloco("", t(temTopico ? "jur_cit_criar_dica" : "jur_cit_sem_topico"), "jur-cita-dica");
  }
  const temTopico = !!(base && base.disciplina && base.topico);
  $("btnJurCitaCriar").hidden = !!j || !temTopico || !!(ach && ach.ambiguos && ach.ambiguos.length);
  $("btnJurCitaAbrir").hidden = !j || !temTopico;
  /* (v18.36.0) outros julgados citados e não guardados no mesmo texto: todos de uma vez */
  if ($("btnJurCitaLote")) {
    let pend = [];
    try { if (!j && temTopico && base && typeof base.textoTodo === "function") pend = jurCitPendentes(base.textoTodo(), jurCitChave(base)); } catch (e) { pend = []; }
    jurCitaAlvo.pend = pend;
    $("btnJurCitaLote").hidden = pend.length < 2;
    $("btnJurCitaLote").textContent = t("jur_cl_btn", { n: pend.length });
  }
  /* (v18.34.0) a citação errada se desliga, ou se liga a outro julgado */
  $("btnJurCitaDesligar").hidden = false;
  $("btnJurCitaOutro").hidden = false;
  abrirModal("dlgJurCitaPreview");
  try { reg("JURIS", "prévia de julgado citado", c.texto + (j ? " · achado" : ach && ach.ambiguos ? " · dúvida" : " · não guardado")); } catch (e) {}
}

/* "usar a gaveta completa": a gaveta de sempre, já com a identidade do citado */
function jurCitCriarNaGaveta() {
  const a = jurCitaAlvo;
  if (!a || !a.base || !a.base.disciplina || !a.base.topico) return false;
  $("dlgJurCitaPreview").close();
  jurAbrir(a.base.disciplina, a.base.topico, "incluir");
  const c = a.c;
  if ($("jurTribunal")) $("jurTribunal").value = c.tribunal || JUR_CASA[c.classe] || "";
  if ($("jurClasse")) $("jurClasse").value = c.classe || "";
  if ($("jurNumero")) $("jurNumero").value = jurSoDigitos(c.numero);
  /* a identidade preenchida fica À VISTA (os campos moram numa parte recolhida), e o aviso diz de onde veio */
  if (typeof jurMeta === "function") jurMeta(true);
  const av = $("jurColarAviso");
  if (av) { av.hidden = false; av.className = "ed-mud"; av.textContent = t("jur_cit_criado_aviso", { j: String(c.texto || "").replace(/[\s.;,]+$/g, "") }); }
  jurVoltaPara = a.base.aoVoltar || null;
  try { reg("JURIS", "julgado citado: criar agora", c.texto); } catch (e) {}
  return true;
}

function jurCitAbrirGaveta() {
  const a = jurCitaAlvo;
  if (!a || !a.j || !a.base || !a.base.disciplina || !a.base.topico) return false;
  $("dlgJurCitaPreview").close();
  jurAbrir(a.base.disciplina, a.base.topico, "ler");
  jurEditar(a.j.id);
  jurVoltaPara = a.base.aoVoltar || null;
  return true;
}

/* =====================================================================
 * CRIAR O JULGADO DENTRO DA PRÉVIA (v18.35.0)
 *
 * Antes: prévia → gaveta → SITE DO TRIBUNAL (achar a ementa) → gaveta →
 * IA → gaveta → guardar → fechar → resumo. Agora, na própria prévia:
 * (1) copiar o pedido — já com a citação, o tribunal e o trecho do material;
 * a ementa é OPCIONAL; (2) colar a resposta — lida na hora, com semáforo;
 * conferir a tese e o resumo; Guardar. Sem ementa, o que a IA trouxe fica
 * marcado "de memória" até a pessoa conferir (✓ conferi).
 * ===================================================================== */
let jurCitaLido = null;   /* o que a resposta colada trouxe: {achado, certeza} */

function jurCitCriar() {
  const a = jurCitaAlvo;
  if (!a || !a.base || !a.base.disciplina || !a.base.topico) return false;
  jurCitaLido = null;
  $("jurCitaNovo").hidden = false;
  /* a explicação de "criar agora" já cumpriu o papel: sai de cena enquanto se cria */
  if ($("dlgJurCitaPreview").classList) $("dlgJurCitaPreview").classList.add("criando");
  $("btnJurCitaCriar").hidden = true;
  $("btnJurCitaGaveta").hidden = false;
  $("jurCitaEmenta").value = "";
  $("jurCitaResp").value = "";
  $("jurCitaPedidoMsg").textContent = "";
  $("jurCitaPedidoTxt").hidden = true;
  $("jurCitaBuscar").href = "https://www.google.com/search?q=" + encodeURIComponent(jurCitTitulo(a.c) + " " + (a.c.tribunal || "") + " enunciado tese");
  jurCitaPintarResp();
  try { reg("JURIS", "julgado citado: criar na prévia", a.c.texto); } catch (e) {}
  return true;
}
function jurCitTitulo(c) { return String((c && c.texto) || "").replace(/[\s.;,]+$/g, ""); }

function jurCitaPedido(a, ementa) {
  const c = a.c;
  const vals = {
    tp: (a.base && a.base.topico) || "",
    cit: jurCitTitulo(c) + (c.tribunal && jurCitTitulo(c).indexOf(c.tribunal) < 0 ? " (" + c.tribunal + ")" : ""),
    ctx: String(c._frase || c.texto || "").trim().slice(0, 1200),
    ementa_bloco: ementa ? t("jur_cn_ementa_bloco").replace("{ementa}", String(ementa).slice(0, 6000)) : "",
    regra_tese: t(ementa ? "jur_cn_regra_com_ementa" : "jur_cn_regra_sem_ementa"),
  };
  return t("jur_prompt_citado").replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vals, k) ? vals[k] : m));
}

function jurCitaCopiarPedido() {
  const a = jurCitaAlvo;
  if (!a) return "";
  const p = jurCitaPedido(a, String($("jurCitaEmenta").value || "").trim());
  $("jurCitaPedidoTxt").value = p;
  $("jurCitaPedidoTxt").hidden = false;
  $("jurCitaPedidoMsg").textContent = t("jur_cn_copiado");
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p).catch(() => {}); } catch (e) {}
  try { reg("JURIS", "pedido do julgado citado copiado", a.c.texto + (String($("jurCitaEmenta").value || "").trim() ? " · com ementa" : " · sem ementa")); } catch (e) {}
  return p;
}

/* o semáforo da resposta: vazio · é o pedido · não deu para ler · leu (com ressalvas) · leu */
function jurCitaEstado(resp, c) {
  const s = String(resp || "").trim();
  if (!s) return { est: "vazio", msg: t("jur_cn_sem_vazio") };
  if (/aparece citado assim no meu material|appears cited like this in my material/i.test(s)) return { est: "erro", msg: t("jur_cn_sem_pedido") };
  let ach = null, obj = null;
  try { ach = jurDoJson(s); obj = jurObjetoDoJson(s); } catch (e) { ach = null; }
  if (!ach) return { est: "erro", msg: t("jur_cn_sem_ilegivel") };
  const certeza = String((obj && !Array.isArray(obj) && obj.certeza_da_tese) || "").toLowerCase().replace(/é/g, "e").trim();
  const lido = { achado: ach, certeza: /^(alta|media|baixa)$/.test(certeza) ? certeza : "" };
  const outro = ach.numero && c && c.numero && jurNumChave(ach.numero) !== jurNumChave(c.numero);
  if (outro) return { est: "atencao", msg: t("jur_cn_sem_outro", { a: [ach.tribunal, ach.classe, ach.numero].filter(Boolean).join(" "), c: jurCitTitulo(c) }), lido };
  if (!ach.tese && !ach.resumo) return { est: "atencao", msg: t("jur_cn_sem_vazia"), lido };
  if (!ach.tese) return { est: "atencao", msg: t("jur_cn_sem_sem_tese"), lido };
  return { est: "ok", msg: t("jur_cn_sem_ok", { a: [ach.tribunal, ach.classe, ach.numero].filter(Boolean).join(" ") || jurCitTitulo(c) }), lido };
}

function jurCitaPintarResp() {
  const a = jurCitaAlvo;
  const e = jurCitaEstado($("jurCitaResp").value, a && a.c);
  const sem = $("jurCitaSem");
  sem.textContent = e.msg;
  sem.className = "nota jur-cita-sem " + (e.est === "ok" ? "ok" : e.est === "atencao" ? "atencao" : e.est === "erro" ? "erro" : "");
  const mudou = !jurCitaLido || !e.lido || jurCitaLido.achado !== e.lido.achado;
  jurCitaLido = e.lido || null;
  $("jurCitaLido").hidden = !jurCitaLido;
  if (jurCitaLido && mudou) {
    $("jurCitaTese").value = jurCitaLido.achado.tese || "";
    $("jurCitaResumo").value = jurCitaLido.achado.resumo || "";
  }
  const semEmenta = !String($("jurCitaEmenta").value || "").trim();
  $("jurCitaMemAviso").textContent = jurCitaLido && semEmenta
    ? t("jur_cn_mem_aviso", { c: jurCitaLido.certeza ? t("jur_cn_certeza_" + jurCitaLido.certeza) : "?" }) : "";
  jurCitaPintarGuardar();
}
function jurCitaPintarGuardar() {
  const pode = !!jurCitaLido && !!(String($("jurCitaTese").value || "").trim() || String($("jurCitaResumo").value || "").trim());
  $("btnJurCitaGuardar").hidden = !jurCitaLido;
  $("btnJurCitaGuardar").disabled = !pode;
}

function jurCitaGuardar() {
  const a = jurCitaAlvo;
  if (!a || !a.base || !a.base.disciplina || !a.base.topico || !jurCitaLido) return null;
  const ach = jurCitaLido.achado;
  const c = a.c;
  const tese = String($("jurCitaTese").value || "").trim();
  const resumo = String($("jurCitaResumo").value || "").trim();
  if (!tese && !resumo) return null;
  const ementa = String($("jurCitaEmenta").value || "").trim();
  const dados = {
    tribunal: ach.tribunal || c.tribunal || JUR_CASA[c.classe] || "",
    classe: ach.classe || c.classe || "",
    numero: ach.numero || jurSoDigitos(c.numero),
    tese, resumo, texto: ach.texto || ementa,
    data: ach.data || "", orgao: ach.orgao || "", relator: ach.relator || "",
    fonte: ach.fonte || "", precedentes: ach.precedentes || "", categoria: ach.categoria || "",
    tags: (ach.tags || []).slice(),
  };
  if (!ementa) {
    dados.deMemoria = true;
    dados.certeza = jurCitaLido.certeza || "";
    dados.aConferir = ["data", "orgao", "relator", "fonte", "precedentes"].filter((k) => String(dados[k] || "").trim());
  }
  const j = jurGravar(dados);
  if (!j) { $("jurCitaSem").textContent = t("qs_vinc_erro_gravar"); return null; }
  jurLigar(j.id, jurCitChave(a.base), a.base.disciplina, a.base.topico);
  try { reg("JURIS", "julgado criado pela citação", jurCitNome(j) + (dados.deMemoria ? " · de memória (" + (dados.certeza || "?") + ")" : " · com ementa")); } catch (e) {}
  jurCitaLido = null;
  /* a prévia passa a mostrar o julgado; quem está atrás repinta (o link acha o julgado) */
  jurCitPreviewAbrir(c, { julgado: jurDe(j.id) }, a.base);
  try { if (typeof a.base.aoVoltar === "function") a.base.aoVoltar(); } catch (e) {}
  return j;
}

function jurCitaConferi() {
  const a = jurCitaAlvo;
  if (!a || !a.j) return false;
  jurGravar({ id: a.j.id, deMemoria: false });
  try { reg("JURIS", "tese de memória conferida", jurCitNome(a.j)); } catch (e) {}
  jurCitPreviewAbrir(a.c, { julgado: jurDe(a.j.id) }, a.base);
  return true;
}

/* =====================================================================
 * TODOS OS JULGADOS CITADOS DE UMA VEZ (v18.36.0)
 *
 * Três súmulas citadas e não guardadas eram três voltas inteiras. Agora um
 * pedido só, com a lista e o trecho de cada uma; a resposta {"julgados":[…]}
 * cai no painel de várias fichas da gaveta (conferir e guardar todas). O que
 * vier sem ementa fica "de memória", como no criar um por um.
 * ===================================================================== */
let jurLoteDeCitacoes = false;
let jurCitLoteUltimo = "";

/* as citações de julgado deste texto que AINDA não têm julgado guardado (sem repetir; sem os desligados) */
function jurCitPendentes(txt, chave) {
  let cs = [];
  try { cs = citJuntarJulgados(String(txt || ""), [], chave); } catch (e) { cs = []; }
  const vistos = {};
  return cs.filter((c) => {
    if (!c._jur || c.jurId) return false;
    let ach = { julgado: null };
    try { ach = jurAcharCitado(c, null, chave); } catch (e) {}
    if (ach.julgado || (ach.ambiguos && ach.ambiguos.length)) return false;
    const k = [c.tribunal, jurClasseChave(c.classe), jurNumChave(c.numero)].join("|");
    if (vistos[k]) return false;
    vistos[k] = true;
    return true;
  });
}

function jurCitLotePedido(pend, base) {
  const lista = pend.map((c, i) => (i + 1) + ". " + jurCitTitulo(c) + (c.tribunal && jurCitTitulo(c).indexOf(c.tribunal) < 0 ? " (" + c.tribunal + ")" : "")
    + " — " + t("jur_cl_trecho") + ": \"" + String(c._frase || c.texto || "").replace(/\s+/g, " ").trim().slice(0, 500) + "\"").join("\n");
  return t("jur_prompt_citados_lote").replace(/\{(\w+)\}/g, (m, k) => ({ tp: (base && base.topico) || "", lista, n: String(pend.length) }[k] !== undefined
    ? { tp: (base && base.topico) || "", lista, n: String(pend.length) }[k] : m));
}

/* começa: copia o pedido e abre a gaveta pronta para receber a resposta (o painel de fichas) */
function jurCitLoteIniciar(pend, base) {
  const b = base || {};
  if (!pend || !pend.length || !b.disciplina || !b.topico) return false;
  if (pend.length === 1) {
    /* um só: o caminho da prévia (L2) é mais curto */
    jurCitPreviewAbrir(pend[0], { julgado: null }, b);
    jurCitCriar();
    return true;
  }
  const p = jurCitLotePedido(pend, b);
  jurCitLoteUltimo = p;
  if ($("dlgJurCitaPreview") && $("dlgJurCitaPreview").open) $("dlgJurCitaPreview").close();
  jurAbrir(b.disciplina, b.topico, "incluir");
  /* a régua da conferência: as citações (a identidade vem delas); é o que volta à caixa depois de ler a resposta */
  jurUltimoTextoPedido = pend.map((c) => jurCitTitulo(c)).join("\n");
  jurLoteDeCitacoes = true;
  const av = $("jurColarAviso");
  if (av) { av.hidden = false; av.className = "ed-mud"; av.textContent = t("jur_cl_aviso", { n: pend.length, l: pend.map(jurCitTitulo).join(", ") }); }
  jurVoltaPara = b.aoVoltar || null;
  /* o pedido fica À VISTA (copiar à mão), e o aviso muda se a cópia automática não der */
  if ($("jurClPedidoTxt")) { $("jurClPedidoTxt").value = p; $("jurClPedidoTxt").hidden = false; }
  const falhou = () => { if (av) av.textContent = t("jur_cl_aviso_manual", { n: pend.length }); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p).catch(falhou);
    else falhou();
  } catch (e) { falhou(); }
  try { reg("JURIS", "pedido dos julgados citados copiado", pend.length + " · " + pend.map(jurCitTitulo).join(" | ")); } catch (e) {}
  return true;
}

/* ---------- (v18.34.0) DESLIGAR E LIGAR A OUTRO ---------- */
function jurCitDesligar() {
  const a = jurCitaAlvo;
  if (!a || !a.c) return false;
  const r = citVinculoSalvar({ trecho: a.c.texto, tipo: "jur", nenhum: true, chave: jurCitChave(a.base) });
  if ($("dlgJurCitaPreview").open) $("dlgJurCitaPreview").close();
  try { reg("JURIS", "link de julgado desligado", a.c.texto); } catch (e) {}
  try { if (a.base && typeof a.base.aoVoltar === "function") a.base.aoVoltar(); } catch (e) {}
  return !!r;
}
function jurCitOutro() {
  const a = jurCitaAlvo;
  if (!a || !a.c) return false;
  if ($("dlgJurCitaPreview").open) $("dlgJurCitaPreview").close();
  jurEscAbrir(a.c.texto, a.base);
  return true;
}

/* LIGAR UM TRECHO A UM JULGADO GUARDADO, À MÃO: a lista (os do tópico primeiro),
 * a busca e a prévia do escolhido, antes de ligar. O vínculo vale neste tópico. */
let jurEscCtx = null;
function jurEscAbrir(trecho, base) {
  if (!$("dlgJurEscolher")) return;
  jurEscCtx = { trecho: String(trecho || "").trim(), base: base || {}, sel: "" };
  $("jurEscTrecho").textContent = t("jur_esc_trecho", { t: jurEscCtx.trecho });
  $("jurEscBusca").value = "";
  $("jurEscAviso").textContent = "";
  jurEscPintar();
  abrirModal("dlgJurEscolher");
}
function jurEscPintar() {
  const c = jurEscCtx;
  if (!c) return;
  const ch = jurCitChave(c.base);
  const k = ch ? jurChaveComparavel(ch) : "";
  const doT = (j) => !!k && (j.topicos || []).some((x) => jurChaveComparavel(x) === k);
  const q = jurSemAcento(String($("jurEscBusca").value || "")).toLowerCase().trim();
  let L = jurLista();
  if (q) L = L.filter((j) => jurSemAcento([j.tribunal, j.classe, j.numero, j.tese, j.resumo, (j.tags || []).join(" ")].join(" ")).toLowerCase().indexOf(q) >= 0);
  L = L.filter(doT).concat(L.filter((j) => !doT(j))).slice(0, 40);
  const cx = $("jurEscLista");
  cx.innerHTML = "";
  if (!L.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = q ? t("jur_esc_nada", { q: $("jurEscBusca").value }) : t("jur_esc_vazio");
    cx.append(p);
  }
  L.forEach((j, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "jur-cita-opcao" + (c.sel === j.id ? " sel" : "");
    b.id = "jurEscOpcao_" + i;
    b.setAttribute("aria-pressed", c.sel === j.id ? "true" : "false");
    b.textContent = jurCitNome(j) + (doT(j) ? " ★" : "") + " — " + jurCitTrecho(j.tese || j.resumo, 100);
    b.onclick = () => { c.sel = j.id; jurEscPintar(); };
    cx.append(b);
  });
  const pv = $("jurEscPrev");
  pv.innerHTML = "";
  const j = c.sel ? jurDe(c.sel) : null;
  pv.hidden = !j;
  if (j) {
    const h = document.createElement("div");
    h.className = "jur-cita-rot";
    h.textContent = jurCitNome(j);
    const x = document.createElement("div");
    x.className = "jur-cita-txt";
    x.textContent = String(j.tese || j.resumo || "").trim() || t("jur_cit_vazio");
    pv.append(h, x);
  }
}
function jurEscLigar() {
  const c = jurEscCtx;
  if (!c) return false;
  if (!c.sel || !jurDe(c.sel)) { $("jurEscAviso").textContent = t("jur_esc_sem"); return false; }
  const r = citVinculoSalvar({ trecho: c.trecho, tipo: "jur", jurId: c.sel, chave: jurCitChave(c.base) });
  if (!r) { $("jurEscAviso").textContent = t("qs_vinc_erro_gravar"); return false; }
  $("dlgJurEscolher").close();
  try { reg("JURIS", "trecho ligado a um julgado à mão", c.trecho + " → " + jurCitNome(jurDe(c.sel))); } catch (e) {}
  try { if (c.base && typeof c.base.aoVoltar === "function") c.base.aoVoltar(); } catch (e) {}
  return true;
}

/* os julgados citados (e os ligados/desligados à mão), juntados às citações de lei:
 * o que a pessoa FIXOU vence o automático do outro tipo; no resto, vence a lei */
function citJuntarJulgados(txt, cits, chave) {
  let jcs = [];
  try { if (typeof jurTemCitacao === "function" && jurTemCitacao(txt)) jcs = jurCitacoesNoTexto(txt); } catch (e) { jcs = []; }
  try { if (typeof citVinculosAplicarJur === "function") jcs = citVinculosAplicarJur(txt, jcs, chave); } catch (e) {}
  jcs = jcs.map((j) => Object.assign(j, { _jur: true,
    _frase: String(txt || "").slice(Math.max(0, j.ini - 240), Math.min(String(txt || "").length, j.fim + 240)).trim() }));
  const sobre = (a, b) => a.ini < b.fim && b.ini < a.fim;
  const leis = (cits || []).filter((c) => c.permanente || !jcs.some((j) => j.permanente && sobre(c, j)));
  const juls = jcs.filter((j) => !leis.some((c) => sobre(c, j)));
  return leis.concat(juls).sort((a, b) => a.ini - b.ini);
}

if (typeof document !== "undefined" && $("dlgJurCitaPreview")) {
  $("btnJurCitaCriar").onclick = () => jurCitCriar();
  if ($("btnJurCitaGaveta")) $("btnJurCitaGaveta").onclick = () => jurCitCriarNaGaveta();
  if ($("btnJurCitaLote")) $("btnJurCitaLote").onclick = () => { const a = jurCitaAlvo; if (a && a.pend) jurCitLoteIniciar(a.pend, a.base); };
  if ($("btnJurCitaGuardar")) $("btnJurCitaGuardar").onclick = () => jurCitaGuardar();
  if ($("btnJurCitaConferi")) $("btnJurCitaConferi").onclick = () => jurCitaConferi();
  if ($("btnJurCitaPedido")) $("btnJurCitaPedido").onclick = () => jurCitaCopiarPedido();
  if ($("jurCitaResp")) $("jurCitaResp").oninput = () => jurCitaPintarResp();
  if ($("jurCitaEmenta")) $("jurCitaEmenta").oninput = () => jurCitaPintarResp();
  if ($("jurCitaTese")) $("jurCitaTese").oninput = () => jurCitaPintarGuardar();
  if ($("jurCitaResumo")) $("jurCitaResumo").oninput = () => jurCitaPintarGuardar();
  $("btnJurCitaAbrir").onclick = () => jurCitAbrirGaveta();
  $("btnJurCitaFechar").onclick = () => $("dlgJurCitaPreview").close();
  if ($("btnJurCitaDesligar")) $("btnJurCitaDesligar").onclick = () => jurCitDesligar();
  if ($("btnJurCitaOutro")) $("btnJurCitaOutro").onclick = () => jurCitOutro();
  if ($("btnJurEscOk")) $("btnJurEscOk").onclick = () => jurEscLigar();
  if ($("btnJurEscCancelar")) $("btnJurEscCancelar").onclick = () => $("dlgJurEscolher").close();
  if ($("btnJurEscX")) $("btnJurEscX").onclick = () => $("dlgJurEscolher").close();
  if ($("jurEscBusca")) $("jurEscBusca").oninput = () => jurEscPintar();
}

function jurDaSelecao() {
  if (typeof matLembrarSelecao === "function") matLembrarSelecao("matLeitura");
  /* O TÓPICO É O QUE ESTÁ ABERTO NO EDITOR, e a seleção é a que o
   * material acabou de guardar. Os dois já existem — reimplementá-los
   * aqui criaria uma segunda leitura da mesma coisa, que é como as
   * divergências nascem. */
  const trecho = (typeof matSelGuardadaAtual === "function")
    ? matSelGuardadaAtual() : "";
  const alvo = (typeof matAtualAtual === "function") ? matAtualAtual() : null;
  if (!alvo || !alvo.disciplina) { uiAlert(t("jur_sem_topico")); return; }
  jurAbrir(alvo.disciplina, alvo.topico || alvo.nome, "incluir");
  if (trecho && $("jurTese")) {
    $("jurTese").value = trecho;
    const av = $("jurColarAviso");
    if (av) {
      av.hidden = false;
      av.className = "ed-mud";
      av.textContent = t("jur_da_selecao", { n: trecho.length });
    }
  }
}

/* =====================================================================
 * VÁRIOS JULGADOS DE UMA VEZ (J3/J4)
 *
 * O CASO REAL: um resumo colado dizia "Resumo do Entendimento do STF (ADPF 499 e ADI 5835)" — dois julgados num texto só.
 * A tela só sabia guardar UM por vez, e o que a IA devolvesse sobre os dois virava uma ficha misturada.
 *
 * AGORA há um marcador "Separar julgados se houver mais de um", ligado por padrão. Ligado, o pedido manda a IA separar
 * (um objeto por julgado, cada um com o trecho do texto que lhe pertence); a resposta com 2+ julgados abre um PAINEL com
 * uma ficha por julgado, onde se confere, se edita e se marca o que guardar — e um botão guarda todas de uma vez.
 *
 * E O SEMÁFORO diz, em cima da caixa, em que pé está a colagem (vazia, pedido colado por engano, JSON que não abre,
 * texto com vários julgados, resposta lida) — o mesmo desenho do "Novo edital": o erro é dito ANTES de custar um clique.
 * ===================================================================== */
let jurLoteFichas = null;     /* null = nenhum lote aberto */

function jurSepararAtivo() {
  const c = $("chkJurSeparar");
  return c ? !!c.checked : true;
}

function jurLoteAtivo() { return !!(jurLoteFichas && jurLoteFichas.length); }

function jurLoteMarcados() { return (jurLoteFichas || []).filter((f) => f.marcado); }

function jurLoteLimpar() {
  jurLoteFichas = null;
  if ($("jurLote")) $("jurLote").hidden = true;
  if ($("jurLoteCards")) $("jurLoteCards").innerHTML = "";
  if ($("btnJurMeta")) $("btnJurMeta").hidden = false;
}

/* o semáforo da colagem: { nivel: vazio | ok | aviso | erro, msg } */
function jurEstadoColagem() {
  if (jurLoteAtivo()) return { nivel: "ok", msg: t("jur_sem_lote", { n: jurLoteFichas.length }) };
  const bruto = String(($("jurColar") || {}).value || "").trim();
  if (!bruto) return { nivel: "vazio", msg: t("jur_sem_vazia") };
  if (typeof jurEhPedido === "function" && jurEhPedido(bruto)) return { nivel: "erro", msg: t("jur_sem_pedido"), pedido: true };
  if (/^\s*(```|\{|\[)/.test(bruto)) {
    const lote = typeof jurDoJsonLote === "function" ? jurDoJsonLote(bruto) : null;
    if (lote) return { nivel: "ok", msg: t("jur_sem_resposta", { n: lote.length }) };
    if (typeof jurJsonDoTexto === "function" && jurJsonDoTexto(bruto)) return { nivel: "erro", msg: t("jur_sem_json_outro") };
    const d = typeof jurDiagnosticoJson === "function" ? jurDiagnosticoJson(bruto) : null;
    let msg = t("jur_completar_nada");
    if (d && d.motivo === "sem_fechamento") msg = t("jur_completar_erro_truncado");
    else if (d && d.motivo === "sintaxe") {
      msg = t(d.causa === "aspas" ? "jur_completar_erro_aspas" : "jur_completar_erro_sintaxe", { l: d.linha, trecho: d.trecho });
    }
    return { nivel: "erro", msg };
  }
  const procs = typeof jurProcessosNoTexto === "function" ? jurProcessosNoTexto(bruto) : [];
  if (procs.length >= 2) {
    return { nivel: jurSepararAtivo() ? "ok" : "aviso", msg: t(jurSepararAtivo() ? "jur_sem_varios" : "jur_sem_varios_off", { n: procs.length, q: procs.map((p) => p.rotulo).join(", ") }) };
  }
  if (bruto.length < JUR_TEXTO_MINIMO) return { nivel: "aviso", msg: t("jur_sem_curto", { n: bruto.length }) };
  return { nivel: "ok", msg: t("jur_sem_ementa") };
}

function jurPintarSemaforo() {
  const el = $("jurSem");
  if (!el) return;
  const e = jurEstadoColagem();
  el.className = "jur-sem sem-" + e.nivel;
  el.textContent = ({ vazio: "○ ", ok: "✓ ", aviso: "⚠ ", erro: "⛔ " }[e.nivel] || "") + e.msg;
  if (el.setAttribute) el.setAttribute("data-nivel", e.nivel);
  return e;
}

/* a ficha de um julgado achado: o que a IA trouxe, conferido no texto enviado, e se o app já o tem */
function jurLoteFicha(a, todos) {
  const f = { tribunal: a.tribunal || "", classe: a.classe || "", numero: a.numero || "", data: a.data || "", orgao: a.orgao || "",
    fonte: a.fonte || "", precedentes: a.precedentes || "", tese: a.tese || "", resumo: a.resumo || "", texto: a.texto || "",
    tags: (a.tags || []).slice(), categoria: a.categoria || "", ident: a.identificacao || "", certeza: a.certeza || "",
    compartilhado: !!a.compartilhado, semConteudo: !!a.semConteudo, conferir: {}, jaExiste: null, marcado: true };
  /* o que a IA lembrou entra onde o texto não trouxe, e tudo é conferido no texto que foi enviado (a mesma régua de jurColar) */
  const mem = a.deMemoria || {};
  Object.keys(JUR_CAMPOS_FORM).forEach((k) => { if (!f[k] && mem[k]) f[k] = mem[k]; });
  if (!f.classe && !f.numero && f.ident && typeof jurIdentificarProcesso === "function") {
    const idp = jurIdentificarProcesso(f.ident);
    ["tribunal", "classe", "numero"].forEach((k) => { if (!f[k] && idp[k]) f[k] = idp[k]; });
  }
  const vals = {};
  Object.keys(JUR_CAMPOS_FORM).forEach((k) => { if (f[k] && !(k === "tribunal" && a.tribunalDeduzido)) vals[k] = f[k]; });
  const base = [jurUltimoTextoPedido, a.texto].filter(Boolean).join("\n");
  jurVerificarNoTexto(vals, base).aConferir.forEach((k) => { f.conferir[k] = f[k]; });
  const iguais = jurIguaisA(f, todos);
  f.jaExiste = iguais.length ? iguais[0] : null;
  f.marcado = !f.jaExiste && !f.semConteudo;
  return f;
}

function jurLoteMostrar(achados) {
  const todos = typeof jurLista === "function" ? jurLista() : [];
  jurLoteFichas = achados.map((a) => jurLoteFicha(a, todos));
  /* o JSON sai da caixa (é transporte, não ementa); o texto que foi enviado volta, para quem quiser pedir de novo */
  if ($("jurColar")) $("jurColar").value = jurUltimoTextoPedido || "";
  jurPilulaLimpar();
  jurConteudoVisivel(false);
  jurMeta(false);
  if ($("jurConteudo")) $("jurConteudo").hidden = true;
  if ($("btnJurMeta")) $("btnJurMeta").hidden = true;
  if ($("btnJurAMao")) $("btnJurAMao").hidden = true;
  jurLotePintar();
  reg("JURIS", "lote de julgados separado pela IA", jurLoteFichas.map(jurTitulo).join(" | "));
  jurPintarPrincipal();
  jurBotaoSalvar();
}

function jurLotePintar() {
  const cx = $("jurLote");
  if (!cx) return;
  cx.hidden = !jurLoteAtivo();
  if (!jurLoteAtivo()) return;
  if ($("jurLoteTit")) $("jurLoteTit").textContent = t("jur_lote_tit", { n: jurLoteFichas.length });
  const box = $("jurLoteCards");
  box.innerHTML = "";
  jurLoteFichas.forEach((f, idx) => {
    const card = document.createElement("div");
    card.className = "jur-lote-card" + (f.marcado ? "" : " desmarcado");
    const cab = document.createElement("label");
    cab.className = "jur-lote-cab";
    const ck = document.createElement("input");
    ck.type = "checkbox"; ck.checked = f.marcado;
    ck.onchange = () => { f.marcado = ck.checked; card.className = "jur-lote-card" + (f.marcado ? "" : " desmarcado"); jurBotaoSalvar(); };
    const nome = document.createElement("strong");
    nome.className = "jur-lote-nome";
    nome.textContent = jurTitulo(f) || t("jur_sem_titulo");
    cab.append(ck, nome);
    /* (v18.36.0) lote dos julgados CITADOS: quão certa está a tese que veio de memória */
    if (jurLoteDeCitacoes && !String(f.texto || "").trim()) {
      const tm = document.createElement("span");
      tm.className = "jur-lote-tag mem" + (f.certeza === "baixa" || !String(f.tese || "").trim() ? " baixa" : "");
      tm.textContent = t("jur_lote_mem", { c: f.certeza ? t("jur_cn_certeza_" + f.certeza) : "?" });
      tm.title = t("jur_mem_selo_aj", { c: f.certeza ? t("jur_cn_certeza_" + f.certeza) : "?" });
      cab.append(tm);
    }
    if (f.jaExiste) {
      const tg = document.createElement("span");
      tg.className = "jur-lote-tag ja";
      tg.textContent = t("jur_lote_ja");
      tg.title = t("jur_lote_ja_aj", { q: jurTitulo(f.jaExiste) });
      cab.append(tg);
    }
    if (Object.keys(f.conferir).length) {
      const tg = document.createElement("span");
      tg.className = "jur-lote-tag conferir";
      tg.textContent = t("jur_lote_conferir");
      tg.title = t("jur_pilula_memoria", { q: Object.keys(f.conferir).map(jurNomeCampo).join(", ") });
      cab.append(tg);
    }
    card.append(cab);
    /* identidade: o que mais se corrige */
    const id = document.createElement("div");
    id.className = "jur-lote-ident";
    [["tribunal", "jur_c_tribunal", "text"], ["classe", "jur_c_classe", "text"], ["numero", "jur_c_numero", "text"], ["data", "jur_c_data", "date"]].forEach(([k, rot, tipo]) => {
      const lab = document.createElement("label");
      const sp = document.createElement("span"); sp.textContent = t(rot);
      const inp = document.createElement("input");
      inp.type = tipo; inp.value = f[k] || "";
      inp.oninput = () => { f[k] = inp.value.trim(); nome.textContent = jurTitulo(f) || t("jur_sem_titulo"); };
      lab.append(sp, inp);
      id.append(lab);
    });
    card.append(id);
    const campo = (rot, k, linhas) => {
      const l = document.createElement("label"); l.className = "jur-lote-campo";
      const sp = document.createElement("span"); sp.textContent = t(rot);
      const ta = document.createElement("textarea"); ta.rows = linhas; ta.value = f[k] || "";
      /* a caixa cresce com o texto (a regra geral de textarea reserva 260px, que aqui é só espaço vazio) */
      const cresce = () => { ta.style.height = "auto"; const h = ta.scrollHeight; if (h) ta.style.height = Math.min(h + 2, 240) + "px"; };
      ta.oninput = () => { f[k] = ta.value; cresce(); };
      setTimeout(cresce, 0);
      l.append(sp, ta);
      card.append(l);
    };
    campo("jur_tese_rot", "tese", 3);
    campo("jur_resumo_rot", "resumo", 2);
    if (f.compartilhado) {
      const n = document.createElement("div"); n.className = "jur-lote-nota"; n.textContent = t("jur_lote_compartilhado");
      card.append(n);
    }
    if (f.semConteudo) {
      const n = document.createElement("div"); n.className = "jur-lote-nota"; n.textContent = t("jur_lote_sem_conteudo");
      card.append(n);
    }
    box.append(card);
  });
}

async function jurSalvarLote() {
  if (!jurTopicoAtual || !jurLoteAtivo()) return;
  const marcadas = jurLoteMarcados();
  if (!marcadas.length) { await uiAlert(t("jur_lote_nenhum")); return; }
  /* UM só aviso, para o conjunto: ficha marcada sem tese e sem texto não tem o que revisar depois */
  const vazias = marcadas.filter((f) => !String(f.tese || "").trim() && !String(f.texto || "").trim());
  if (vazias.length && !(await uiConfirm(t("jur_lote_sem_tese", { n: vazias.length })))) return;
  const concursoJ = typeof matConcursoDoTopico === "function"
    ? matConcursoDoTopico(jurTopicoAtual.disciplina, jurTopicoAtual.nome,
        (typeof concursoAtual === "function" ? concursoAtual().nome : "")) : "";
  const feitos = [];
  marcadas.forEach((f) => {
    const j = jurGravar({
      concurso: concursoJ, tribunal: f.tribunal, classe: f.classe, numero: f.numero, data: f.data, orgao: f.orgao,
      fonte: f.fonte, precedentes: f.precedentes, tese: String(f.tese || "").trim(), texto: String(f.texto || "").trim(),
      resumo: String(f.resumo || "").trim(),
      categoria: f.categoria || (typeof jurCategoria === "function" ? jurCategoria(f.classe) : ""),
      tags: f.tags.slice(),
      /* o que a IA trouxe e a pessoa não corrigiu continua "a conferir" */
      aConferir: Object.keys(f.conferir).filter((k) => String(f[k] || "").trim() === String(f.conferir[k] || "").trim()),
      topicos: [jurTopicoAtual.chave],
      /* (v18.36.0) veio dos julgados CITADOS, sem ementa: a tese é da memória da IA */
      ...(jurLoteDeCitacoes && !String(f.texto || "").trim() ? { deMemoria: true, certeza: f.certeza || "" } : {}),
    });
    if (!j) return;
    jurLigar(j.id, jurTopicoAtual.chave, jurTopicoAtual.disciplina, jurTopicoAtual.nome);
    if (jurRamoAlvo) jurLigarRamo(j.id, jurTopicoAtual.chave, jurRamoAlvo.id, jurRamoAlvo.nome);
    feitos.push(j);
  });
  if (!feitos.length) { await uiAlert(t("jur_nao_salvou")); return; }
  jurLoteDeCitacoes = false;
  reg("JURIS", "lote de julgados guardado", feitos.length + " de " + jurLoteFichas.length + " · " + feitos.map(jurTitulo).join(" | ") + " · " + jurTopicoAtual.nome);
  jurLimparForm();
  jurModo = "ler";
  jurPintarModo();
  jurPintarLista();
  jurRepintarTelas();
  jurReagirBtn("btnJurSalvar", t("jur_lote_feito", { n: feitos.length }));
}

function jurIniciarTela() {
  /* CONSERTA O QUE FOI GUARDADO ERRADO, uma vez, no arranque.
   * Corrigir a entrada não conserta o que entrou antes dela. */
  try { jurRepararJson(); } catch (e) {}
  const liga = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  liga("btnJurColar", jurColar);
  liga("btnJurPrincipal", jurPrincipal);
  liga("btnJurCplCopiar", () => jurCompletarPedir());
  liga("btnJurCplLer", () => jurCompletarLer());
  liga("btnJurCplFechar", () => $("dlgJurCompletar").close());
  liga("btnJurCplX", () => $("dlgJurCompletar").close());
  liga("btnJurMelhorarResumo", () => jurMelAbrir());
  liga("btnJurMelCopiar", () => {
    try { navigator.clipboard.writeText($("jurMelPrompt").value); } catch (e) {}
  });
  liga("btnJurMelConferir", () => jurMelConferir());
  liga("btnJurMelAplicar", () => jurMelAplicar());
  liga("btnJurMelFechar", () => $("dlgJurMelhorar").close());
  if ($("jurCplResposta")) {
    $("jurCplResposta").oninput = jurCplPintarLer;
    if ($("jurCplResposta").addEventListener) {
      $("jurCplResposta").addEventListener("paste", jurCplAoColar);
    }
  }
  liga("btnJurSalvar", jurSalvar);
  liga("btnJurLimpar", () => {
    jurLimparForm();
    jurReagirBtn("btnJurLimpar", t("jur_limpou"));
  });
  liga("btnJurMais", () => jurTrocarModo("incluir"));
  /* O MARCADOR "separar julgados" VEM LIGADO, e a escolha fica lembrada */
  if ($("chkJurSeparar")) {
    let lig = true;
    try { lig = localStorage.getItem("eac_jur_separar") !== "0"; } catch (e) { lig = true; }
    $("chkJurSeparar").checked = lig;
    $("chkJurSeparar").onchange = () => {
      try { localStorage.setItem("eac_jur_separar", $("chkJurSeparar").checked ? "1" : "0"); } catch (e) {}
      jurPintarPrincipal();
    };
  }
  liga("btnJurOutros", () => { jurOutrosAberto = !jurOutrosAberto; jurPintarLista(); });
  liga("btnJurMeta", () => jurMeta(!jurMetaAberta()));
  dicaLigar("btnJurAjuda", "jur_ajuda");
  liga("btnJurPrompt", jurCopiarPrompt);
  liga("btnJurPromptIA", jurPedirIA);
  liga("btnJurAMao", () => jurConteudoVisivel(true));
  /* a caixa acompanha o que se digita */
  ["jurTese", "jurResumo"].forEach((id) => {
    if ($(id)) $(id).oninput = jurCrescer;
  });
  /* A CAIXA DE COLAR TEM DOIS OUVINTES, E POR ISSO SAIU DA LISTA ACIMA.
   *
   * Ela precisa crescer (como as outras) E redesenhar o botão
   * principal, que muda de rótulo conforme o que está dentro dela.
   * Enquanto estava na lista, a atribuição de lá sobrescrevia a daqui —
   * o último "oninput = ..." apaga o anterior sem erro nenhum, e o
   * botão simplesmente não se atualizava. É o mesmo motivo de o
   * "paste" ser addEventListener e não onpaste. */
  if ($("jurColar")) {
    $("jurColar").oninput = () => { jurCrescer(); jurPintarPrincipal(); };
    if ($("jurColar").addEventListener) {
      $("jurColar").addEventListener("paste", jurAoColarNaCaixa);
    }
  }
  /* PASSOS E ORIGEM ACOMPANHAM O QUE SE DIGITA nos campos */
  ["jurTese", "jurResumo"].forEach((id) => {
    if (!$(id)) return;
    const antes = $(id).oninput;
    $(id).oninput = () => { if (antes) antes(); jurPintarPassos(); };
  });
  Object.keys(JUR_CAMPOS_FORM).forEach((k) => {
    const el = $(JUR_CAMPOS_FORM[k]);
    if (el) el.oninput = () => { jurPintarOrigem(); jurPintarPassos(); };
  });
  jurPintarPrincipal();
  liga("btnJurVoltarLer", () => jurTrocarModo("ler"));
  /* ESCOLHEU UM ITEM DO "MAIS", O MENU FECHA — senão ele ficaria aberto por
   * cima do que o item acabou de mostrar. A caixa de "sugerir de memória"
   * não fecha: é uma opção, não uma ação, e quem a marca ainda vai pedir. */
  if ($("jurMaisCorpo")) {
    $("jurMaisCorpo").onclick = (e) => {
      const alvo = e && e.target;
      if (alvo && String(alvo.tagName || "").toUpperCase() === "BUTTON" && $("jurMais")) {
        $("jurMais").open = false;
      }
    };
  }
  liga("btnJurFechar", () => jurFechar());
  liga("btnJurFecharTopo", () => jurFechar());
  /* ESC E O ✖ TÊM DE ACABAR NO MESMO LUGAR.
   * Enquanto só o botão chamava a volta, fechar com Esc deixava a tela
   * de trás com o número velho de julgados — o mesmo desfecho por dois
   * caminhos, e um deles mentindo. O evento "close" é o único ponto por
   * onde os dois passam. */
  if ($("dlgJuris") && $("dlgJuris").addEventListener) {
    $("dlgJuris").addEventListener("close", () => jurVoltarPara());
  }
  liga("btnMatJuris", jurDaSelecao);
}

/* =====================================================================
 * JM3 — A BIBLIOTECA DE JULGADOS (v18.41.0)
 *
 * Cartões e leis tinham a sua biblioteca; julgados, não: cada um só era
 * visto de dentro do SEU tópico, e "quais súmulas do STF eu já guardei?"
 * não tinha resposta. Aqui estão todos, com busca (tribunal, número, tese,
 * etiqueta, tópico), filtros (tribunal e situação), agrupados por tópico ou
 * por tribunal. Daqui: abrir o julgado no tópico, ligá-lo a mais um tópico,
 * criar os cartões das teses filtradas de uma vez (com desfazer) e estudar
 * as teses (vê o tribunal e o número, lembra a tese, confere).
 * ===================================================================== */
let jurBib = { busca: "", trib: "", sit: "", grupo: "topico", estudo: null, ligando: "" };

function jurBibTopicosDe(j) {
  return (j.topicos || []).map((c) => {
    /* o nome com as maiúsculas certas vem do material, quando o tópico está lá; senão, do rótulo do julgado (que pode ser
     * só a chave, em minúsculas) — e o GRUPO é pela chave comparável, para o mesmo tópico não virar dois */
    const k = jurChaveComparavel(c);
    let m = null;
    if (typeof matResumos === "object") m = matResumos[c] || Object.keys(matResumos).map((x) => matResumos[x]).find((x) => x && x.disciplina && x.topico && jurChaveComparavel(x.disciplina + "›" + x.topico) === k) || null;
    const r = typeof jurRotuloDe === "function" ? jurRotuloDe(j, c) : {};
    return { chave: c, k, disciplina: (m && m.disciplina) || r.disciplina || "", topico: (m && m.topico) || r.topico || c };
  }).filter((x) => x.topico);
}

function jurBibSituacao(j) {
  if (j.deMemoria) return "memoria";
  if (Array.isArray(j.aConferir) && j.aConferir.length) return "conferir";
  return "";
}

function jurBibFiltrados() {
  const q = jurSemAcento(String(jurBib.busca || "")).toLowerCase().trim();
  return jurLista().filter((j) => {
    if (jurBib.trib && String(j.tribunal || "") !== jurBib.trib) return false;
    if (jurBib.sit === "conferir" && !jurBibSituacao(j)) return false;
    if (jurBib.sit === "memoria" && !j.deMemoria) return false;
    if (jurBib.sit === "sem_ementa" && String(j.texto || "").trim()) return false;
    if (jurBib.sit === "sem_topico" && (j.topicos || []).length) return false;
    /* (JM4) a rever: nunca verificado ou há mais de 180 dias; fora de vigor: superada, cancelada ou alterada */
    if (jurBib.sit === "rever" && !jurPrecisaRever(j)) return false;
    if (jurBib.sit === "fora" && !jurForaDeVigor(j)) return false;
    if (!q) return true;
    const alvo = [j.tribunal, j.classe, j.numero, j.tese, j.resumo, (j.tags || []).join(" "),
      jurBibTopicosDe(j).map((x) => x.disciplina + " " + x.topico).join(" ")].join(" ");
    return jurSemAcento(alvo).toLowerCase().indexOf(q) >= 0;
  });
}

function jurBibAbrir(opc) {
  if (!$("dlgJurBib")) return false;
  const o = opc || {};
  jurBib = { busca: o.busca || "", trib: "", sit: o.sit || "", grupo: "topico", estudo: null, ligando: "", atual: false };
  $("jurBibBusca").value = jurBib.busca;
  $("jurBibSit").value = jurBib.sit;
  $("jurBibGrupo").value = jurBib.grupo;
  $("jurBibMsg").textContent = "";
  $("btnJurBibDesfazer").hidden = true;
  jurBibPintar();
  abrirModal("dlgJurBib");
  try { reg("JURIS", "biblioteca de julgados aberta", jurLista().length + " julgados"); } catch (e) {}
  return true;
}

function jurBibPintar() {
  if (!$("dlgJurBib")) return;
  const todos = jurLista();
  /* tribunais: só os que existem */
  const st = $("jurBibTrib");
  const tribs = [...new Set(todos.map((j) => String(j.tribunal || "").trim()).filter(Boolean))].sort();
  st.innerHTML = "";
  [["", t("jur_bib_trib_todos")]].concat(tribs.map((x) => [x, x])).forEach(([v, r]) => {
    const op = document.createElement("option"); op.value = v; op.textContent = r; st.append(op);
  });
  if (jurBib.trib && tribs.indexOf(jurBib.trib) < 0) jurBib.trib = "";
  st.value = jurBib.trib;
  const L = jurBibFiltrados();
  const nTop = new Set(todos.flatMap((j) => (j.topicos || []).map(jurChaveComparavel))).size;
  $("jurBibConta").textContent = t("jur_bib_conta", { n: todos.length, k: nTop });
  $("jurBibFiltro").textContent = L.length === todos.length ? "" : t("jur_bib_filtrados", { n: L.length });
  const comTese = L.filter((j) => String(j.tese || "").trim());
  $("btnJurBibCartoes").textContent = t("jur_bib_cartoes", { n: comTese.filter((j) => (j.topicos || []).length).length });
  $("btnJurBibCartoes").disabled = !comTese.some((j) => (j.topicos || []).length);
  $("btnJurBibEstudar").textContent = t("jur_bib_estudar", { n: comTese.length });
  $("btnJurBibEstudar").disabled = !comTese.length;
  /* (JM4) verificar se continuam valendo: vale para os filtrados */
  if ($("btnJurBibAtual")) {
    $("btnJurBibAtual").textContent = t("jur_atual_btn", { n: L.length });
    $("btnJurBibAtual").disabled = !L.length;
    $("btnJurBibAtual").title = t("jur_atual_btn_aj", { r: todos.filter((j) => jurPrecisaRever(j)).length });
  }
  const est = !!jurBib.estudo, atu = !!jurBib.atual;
  $("jurBibEstudo").hidden = !est;
  if ($("jurBibAtual")) $("jurBibAtual").hidden = !atu;
  $("jurBibLista").hidden = est || atu;
  $("jurBibBarra").hidden = est || atu;
  if (est) { jurBibPintarEstudo(); return; }
  if (atu) { jurBibAtualPintar(); return; }

  const cx = $("jurBibLista");
  cx.innerHTML = "";
  if (!L.length) {
    const p = document.createElement("p");
    p.className = "nota";
    p.textContent = todos.length ? t("jur_bib_nada") : t("jur_bib_vazio");
    cx.append(p);
    return;
  }
  /* grupos: por tópico (um julgado em dois tópicos aparece nos dois), por tribunal, ou lista única */
  const grupos = new Map();
  /* chave do grupo = a comparável (sem acento/caixa); o rótulo é o primeiro nome visto, preferindo um com maiúscula */
  const rotulos = new Map();
  const porNo = (rot, j, kc) => {
    const k = kc || rot;
    if (!grupos.has(k)) grupos.set(k, []);
    if (!rotulos.has(k) || (rotulos.get(k) === rotulos.get(k).toLowerCase() && rot !== rot.toLowerCase())) rotulos.set(k, rot);
    grupos.get(k).push(j);
  };
  L.forEach((j) => {
    if (jurBib.grupo === "tribunal") porNo(j.tribunal || t("jur_bib_sem_trib"), j);
    else if (jurBib.grupo === "topico") {
      const tps = jurBibTopicosDe(j);
      if (!tps.length) porNo(t("jur_bib_sem_topico"), j);
      tps.forEach((x) => porNo((x.disciplina ? x.disciplina + " › " : "") + x.topico, j, x.k));
    } else porNo("", j);
  });
  [...grupos.keys()].sort((a, b) => String(rotulos.get(a)).localeCompare(String(rotulos.get(b)))).forEach((k) => {
    if (rotulos.get(k)) {
      const h = document.createElement("div");
      h.className = "jur-bib-grupo";
      h.textContent = rotulos.get(k) + " (" + grupos.get(k).length + ")";
      cx.append(h);
    }
    grupos.get(k).forEach((j) => cx.append(jurBibLinha(j)));
  });
}

function jurBibLinha(j) {
  const li = document.createElement("div");
  li.className = "jur-bib-item";
  const cab = document.createElement("div");
  cab.className = "jur-cab";
  const sel = (txt, cls) => { const s = document.createElement("span"); s.className = "jur-sel " + cls; s.textContent = txt; cab.append(s); return s; };
  if (j.tribunal) sel(j.tribunal, "trib");
  const proc = [j.classe, j.numero].filter(Boolean).join(" ");
  if (proc) sel(proc, "proc");
  const cat = j.categoria || (typeof jurCategoria === "function" ? jurCategoria(j.classe) : "");
  if (cat) sel(cat, "cat");
  const s = jurBibSituacao(j);
  if (s === "memoria") sel(t("jur_mem_selo"), "conferir jur-mem");
  if (s === "conferir") sel(t("jur_a_conferir_n", { n: j.aConferir.length }), "conferir");
  const sv = jurSeloSituacao(j);
  if (sv) cab.append(sv);
  /* (JM4) quando foi verificado se continua valendo */
  const vf = document.createElement("span");
  vf.className = "jur-data jur-verif" + (jurPrecisaRever(j) ? " rever" : "");
  vf.textContent = j.conferidoEm ? t("jur_verif_em", { d: j.conferidoEm.split("-").reverse().join("/") }) : t("jur_verif_nunca");
  cab.append(vf);
  li.append(cab);
  const tese = document.createElement("div");
  tese.className = "jur-bib-tese";
  tese.textContent = String(j.tese || j.resumo || t("jur_bib_sem_tese")).trim();
  li.append(tese);
  /* os tópicos: tocar abre o julgado lá (a gaveta do tópico) */
  const tps = document.createElement("div");
  tps.className = "jur-bib-tops";
  jurBibTopicosDe(j).forEach((x) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-min jur-bib-top";
    b.textContent = "⚖ " + x.topico;
    b.title = t("jur_bib_abrir_aj", { tp: (x.disciplina ? x.disciplina + " › " : "") + x.topico });
    b.onclick = () => { $("dlgJurBib").close(); jurAbrir(x.disciplina, x.topico, "ler"); };
    tps.append(b);
  });
  /* + outro tópico: um seletor com os tópicos da estante que ainda não têm este julgado */
  const bL = document.createElement("button");
  bL.type = "button";
  bL.className = "btn-min jur-bib-ligar";
  bL.id = "btnJurBibLigar_" + j.id;
  bL.textContent = t("jur_bib_ligar");
  bL.title = t("jur_bib_ligar_aj");
  bL.onclick = () => { jurBib.ligando = jurBib.ligando === j.id ? "" : j.id; jurBibPintar(); };
  tps.append(bL);
  if (jurBib.ligando === j.id) {
    const ja = new Set((j.topicos || []).map(jurChaveComparavel));
    const op = (typeof matListaCheia === "function" ? matListaCheia() : [])
      .filter((x) => x.disciplina && x.topico && !ja.has(jurChaveComparavel(x.chave)));
    const sl = document.createElement("select");
    sl.className = "jur-bib-ligar-sel";
    sl.id = "jurBibLigarSel_" + j.id;
    [["", t("jur_bib_ligar_escolha")]].concat(op.map((x) => [x.chave, x.disciplina + " › " + x.topico])).forEach(([v, r]) => {
      const o = document.createElement("option"); o.value = v; o.textContent = r; sl.append(o);
    });
    sl.onchange = () => {
      const x = op.find((y) => y.chave === sl.value);
      if (!x) return;
      jurLigar(j.id, x.chave, x.disciplina, x.topico);
      try { reg("JURIS", "julgado ligado a mais um tópico (biblioteca)", jurTitulo(j) + " › " + x.topico); } catch (e) {}
      jurBib.ligando = "";
      jurBibPintar();
      try { jurRepintarTelas(); } catch (e) {}
    };
    tps.append(sl);
  }
  li.append(tps);
  return li;
}

/* os cartões das teses filtradas, de uma vez: um cartão por julgado e por tópico, com o mesmo formato do 🃏 da gaveta;
 * os que o tópico já tem ficam de fora (cmAplicar) e o recibo permite desfazer */
async function jurBibCartoes() {
  const L = jurBibFiltrados().filter((j) => String(j.tese || "").trim());
  const destinos = [];
  L.forEach((j) => jurBibTopicosDe(j).forEach((x) => {
    const c = jurCartaoDe(j, x.topico);
    if (!c) return;
    const tags = [x.disciplina, x.topico, "jurisprudencia"].concat(j.tribunal ? [j.tribunal] : [])
      .map((v) => String(v).replace(/::/g, "_").replace(/\s+/g, "_")).filter(Boolean);
    const linha = c.frente.replace(/\s*::\s*/g, " — ") + " :: " + c.verso.replace(/\s*::\s*/g, " — ").replace(/\r?\n+/g, " ") + " :: " + tags.join(" ");
    let card = null;
    try { card = (parseText(linha).cards || [])[0]; } catch (e) { card = null; }
    if (card) destinos.push({ card, destino: { disciplina: x.disciplina, topico: x.topico } });
  }));
  if (!destinos.length) return null;
  if (!(await uiConfirm(t("jur_bib_cartoes_conf", { n: destinos.length })))) return null;
  const rec = cmAplicar(destinos, "", matGravarCartoes);
  try { cmUltimoRecibo = rec; } catch (e) {}
  try { guardar("eac_cm_recibo", JSON.stringify(rec)); } catch (e) {}
  try { reg("JURIS", "cartões das teses (biblioteca de julgados)", rec.novos + " novos, " + rec.repetidos + " já existiam"); } catch (e) {}
  $("jurBibMsg").textContent = t("jur_bib_cartoes_feito", { n: rec.novos, r: rec.repetidos });
  $("btnJurBibDesfazer").hidden = !rec.novos;
  try { jurRepintarTelas(); } catch (e) {}
  return rec;
}

async function jurBibDesfazer() {
  await cmDesfazerUltimo();
  $("btnJurBibDesfazer").hidden = true;
  $("jurBibMsg").textContent = "";
  try { jurRepintarTelas(); } catch (e) {}
}

/* ESTUDAR AS TESES: vê o tribunal, o número e as etiquetas; lembra a tese; toca para conferir */
function jurBibEstudarIniciar() {
  const L = jurBibFiltrados().filter((j) => String(j.tese || "").trim());
  if (!L.length) return false;
  jurBib.estudo = { ids: L.map((j) => j.id), i: 0, ver: false };
  try { reg("JURIS", "estudo das teses (biblioteca de julgados)", L.length + " teses"); } catch (e) {}
  jurBibPintar();
  return true;
}
function jurBibEstudoIr(d) {
  const e = jurBib.estudo;
  if (!e) return;
  e.i = Math.max(0, Math.min(e.ids.length - 1, e.i + d));
  e.ver = false;
  jurBibPintar();
}
function jurBibEstudoSair() { jurBib.estudo = null; jurBibPintar(); }
function jurBibPintarEstudo() {
  const e = jurBib.estudo;
  const j = jurDe(e.ids[e.i]);
  if (!j) { jurBibEstudoSair(); return; }
  $("jurBibEstPos").textContent = t("jur_bib_est_pos", { i: e.i + 1, n: e.ids.length });
  const quem = [j.tribunal, [j.classe, j.numero].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  $("jurBibEstFrente").textContent = t("jur_bib_est_frente", { q: quem || "?" });
  /* só o tópico como pista: as etiquetas ("#cartão de crédito #planos de saúde") quase entregam a tese */
  const pistas = jurBibTopicosDe(j).map((x) => x.topico).join(", ");
  $("jurBibEstPistas").textContent = pistas;
  $("jurBibEstTese").hidden = !e.ver;
  $("jurBibEstTese").textContent = String(j.tese || "").trim() + (j.resumo ? "\n\n" + String(j.resumo).trim() : "");
  $("btnJurBibEstVer").hidden = e.ver;
  $("btnJurBibEstAnt").disabled = e.i === 0;
  $("btnJurBibEstProx").disabled = e.i >= e.ids.length - 1;
}

if (typeof document !== "undefined" && $("dlgJurBib")) {
  $("jurBibBusca").oninput = () => { jurBib.busca = $("jurBibBusca").value; jurBibPintar(); };
  $("jurBibTrib").onchange = () => { jurBib.trib = $("jurBibTrib").value; jurBibPintar(); };
  $("jurBibSit").onchange = () => { jurBib.sit = $("jurBibSit").value; jurBibPintar(); };
  $("jurBibGrupo").onchange = () => { jurBib.grupo = $("jurBibGrupo").value; jurBibPintar(); };
  $("btnJurBibCartoes").onclick = () => jurBibCartoes();
  $("btnJurBibDesfazer").onclick = () => jurBibDesfazer();
  $("btnJurBibEstudar").onclick = () => jurBibEstudarIniciar();
  $("btnJurBibEstVer").onclick = () => { if (jurBib.estudo) { jurBib.estudo.ver = true; jurBibPintar(); } };
  $("btnJurBibEstAnt").onclick = () => jurBibEstudoIr(-1);
  $("btnJurBibEstProx").onclick = () => jurBibEstudoIr(1);
  $("btnJurBibEstSair").onclick = () => jurBibEstudoSair();
  $("btnJurBibX").onclick = () => $("dlgJurBib").close();
  $("btnJurBibFechar").onclick = () => $("dlgJurBib").close();
  if ($("btnMatJurBib")) $("btnMatJurBib").onclick = () => jurBibAbrir();
  if ($("btnJurBib")) $("btnJurBib").onclick = () => { $("dlgJuris").close(); jurBibAbrir(); };
}

/* =====================================================================
 * JM4 — "VERIFICAR SE CONTINUAM VALENDO", na biblioteca de julgados (v18.42.0)
 * Vale para os julgados FILTRADOS (o filtro "a rever" junta os nunca verificados e os de mais de 180 dias). Dois passos,
 * como os outros pedidos: copiar o pedido · colar a resposta → conferir um a um (marcar/desmarcar, antes/depois da tese)
 * → aplicar, com desfazer.
 * ===================================================================== */
let jurAtualCtx = null;

function jurBibAtualIniciar() {
  const L = jurBibFiltrados();
  if (!L.length) return false;
  jurAtualCtx = { ids: L.map((j) => j.id), pedido: "", lidos: null, recibo: null };
  jurBib.estudo = null;
  jurBib.atual = true;
  $("jurBibAtualResp").value = "";
  $("jurBibAtualPedidoTxt").hidden = true;
  $("jurBibAtualPedidoMsg").textContent = "";
  $("jurBibAtualFeito").textContent = "";
  $("btnJurBibAtualDesfazer").hidden = true;
  $("jurBibAtualIntro").textContent = t("jur_atual_intro", { n: L.length });
  try { reg("JURIS", "verificar atualidade: aberto", L.length + " julgados"); } catch (e) {}
  jurBibPintar();
  return true;
}
function jurBibAtualSair() { jurAtualCtx = null; jurBib.atual = false; jurBibPintar(); }

function jurBibAtualPedido() {
  const c = jurAtualCtx;
  if (!c) return "";
  const lista = c.ids.map(jurDe).filter(Boolean);
  c.pedido = jurAtualPedido(lista);
  $("jurBibAtualPedidoTxt").value = c.pedido;
  $("jurBibAtualPedidoTxt").hidden = false;
  $("jurBibAtualPedidoMsg").textContent = t("jur_atual_copiado");
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c.pedido).catch(() => { $("jurBibAtualPedidoMsg").textContent = t("jur_atual_copiar_mao"); }); else $("jurBibAtualPedidoMsg").textContent = t("jur_atual_copiar_mao"); } catch (e) { $("jurBibAtualPedidoMsg").textContent = t("jur_atual_copiar_mao"); }
  return c.pedido;
}

function jurBibAtualLerResp() {
  const c = jurAtualCtx;
  if (!c) return null;
  const bruto = $("jurBibAtualResp").value;
  if (c.pedido && String(bruto).trim().slice(0, 100) === String(c.pedido).trim().slice(0, 100)) {
    c.lidos = { est: "pedido", itens: [] };
  } else {
    c.lidos = jurAtualLer(bruto, c.ids.map(jurDe).filter(Boolean));
  }
  jurBibAtualPintar();
  return c.lidos;
}

function jurBibAtualPintar() {
  const c = jurAtualCtx;
  if (!c) return;
  const r = c.lidos || { est: "vazio", itens: [] };
  const sem = $("jurBibAtualSem");
  sem.className = "nota jur-cita-sem " + (r.est === "ok" ? "ok" : r.est === "vazio" ? "" : "erro");
  const n = (s) => r.itens.filter((x) => x.situacao === s).length;
  sem.textContent = r.est === "vazio" ? t("jur_atual_sem_vazio")
    : r.est === "pedido" ? t("jur_atual_sem_pedido")
    : r.est === "erro" ? t("jur_atual_sem_erro") + (r.erro ? " " + r.erro : "")
    : t("jur_atual_sem_ok", { n: r.itens.length, v: n("vigente"), m: n("alterada") + n("superada") + n("cancelada"), d: n("nao_sei") })
      + (r.faltam > 0 ? " " + t("jur_atual_sem_faltam", { n: r.faltam }) : "");
  const cx = $("jurBibAtualPrev");
  cx.innerHTML = "";
  r.itens.forEach((x, i) => {
    const it = document.createElement("div");
    it.className = "jur-atual-item sit-" + x.situacao;
    const cab = document.createElement("label");
    cab.className = "jur-cab";
    const ck = document.createElement("input");
    ck.type = "checkbox";
    ck.id = "jurAtualCk_" + i;
    ck.checked = x.marcado;
    ck.disabled = x.situacao === "nao_sei";
    ck.onchange = () => { x.marcado = ck.checked; jurBibAtualPintarAplicar(); };
    const nome = document.createElement("b");
    nome.textContent = [x.j.tribunal, [x.j.classe, x.j.numero].filter(Boolean).join(" ")].filter(Boolean).join(" ");
    const s = document.createElement("span");
    s.className = "jur-sel jur-sit sit-" + x.situacao;
    s.textContent = t("jur_sit_" + x.situacao);
    cab.append(ck, nome, s);
    it.append(cab);
    if (x.explicacao || x.fonte) {
      const p = document.createElement("p");
      p.className = "nota";
      p.textContent = [x.explicacao, x.fonte ? t("jur_atual_fonte", { f: [x.fonte, x.data].filter(Boolean).join(" · ") }) : ""].filter(Boolean).join(" ");
      it.append(p);
    }
    if (x.muda) {
      const ant = document.createElement("div");
      ant.className = "jur-atual-antes";
      ant.textContent = t("jur_atual_antes") + " " + String(x.j.tese || "").trim();
      const dep = document.createElement("div");
      dep.className = "jur-atual-depois";
      dep.textContent = t("jur_atual_depois") + " " + x.teseAtual;
      it.append(ant, dep);
    }
    cx.append(it);
  });
  jurBibAtualPintarAplicar();
}
function jurBibAtualPintarAplicar() {
  const c = jurAtualCtx;
  const itens = (c && c.lidos && c.lidos.itens) || [];
  const n = itens.filter((x) => x.marcado && x.situacao !== "nao_sei").length;
  const b = $("btnJurBibAtualAplicar");
  b.hidden = !itens.length;
  b.disabled = !n;
  b.textContent = t("jur_atual_aplicar", { n });
}

function jurBibAtualAplicar() {
  const c = jurAtualCtx;
  if (!c || !c.lidos || !c.lidos.itens) return null;
  const rec = jurAtualAplicar(c.lidos.itens);
  c.recibo = rec;
  const mud = c.lidos.itens.filter((x) => x.marcado && x.muda).length;
  try { reg("JURIS", "verificar atualidade: aplicado", rec.length + " julgados · " + mud + " tese(s) trocada(s)"); } catch (e) {}
  $("jurBibAtualFeito").textContent = t("jur_atual_feito", { n: rec.length, m: mud });
  $("btnJurBibAtualDesfazer").hidden = !rec.length;
  c.lidos = null;
  $("jurBibAtualResp").value = "";
  jurBibAtualPintar();
  try { jurRepintarTelas(); } catch (e) {}
  return rec;
}
function jurBibAtualDesfazer() {
  const c = jurAtualCtx;
  if (!c || !c.recibo) return 0;
  const n = jurAtualDesfazer(c.recibo);
  c.recibo = null;
  $("btnJurBibAtualDesfazer").hidden = true;
  $("jurBibAtualFeito").textContent = t("jur_atual_desfeito", { n });
  try { reg("JURIS", "verificar atualidade: desfeito", n + " julgados"); } catch (e) {}
  try { jurRepintarTelas(); } catch (e) {}
  return n;
}

/* o selo da situação (para a gaveta, a biblioteca e a prévia da citação): só quando a tese não é (só) o que vale hoje */
function jurSeloSituacao(j) {
  if (!jurForaDeVigor(j)) return null;
  const s = document.createElement("span");
  s.className = "jur-sel jur-sit sit-" + j.situacao;
  s.textContent = t("jur_sit_" + j.situacao);
  s.title = t("jur_sit_selo_aj", { f: j.situacaoFonte || "—", n: j.situacaoNota || "", d: j.conferidoEm ? j.conferidoEm.split("-").reverse().join("/") : "—" })
    + (j.teseAnterior ? " " + t("jur_sit_tese_antiga", { t: j.teseAnterior }) : "");
  return s;
}

if (typeof document !== "undefined" && $("jurBibAtual")) {
  $("btnJurBibAtual").onclick = () => jurBibAtualIniciar();
  $("btnJurBibAtualPedido").onclick = () => jurBibAtualPedido();
  $("jurBibAtualResp").oninput = () => jurBibAtualLerResp();
  $("btnJurBibAtualAplicar").onclick = () => jurBibAtualAplicar();
  $("btnJurBibAtualDesfazer").onclick = () => jurBibAtualDesfazer();
  $("btnJurBibAtualSair").onclick = () => jurBibAtualSair();
}
