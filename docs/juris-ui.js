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
let jurFiltroTag = "";          /* etiqueta escolhida na lista */
/* "ler" ou "incluir" — ver jurPintarModo */
let jurModo = "ler";

/* ABRE NO MODO QUE A SITUAÇÃO PEDE.
 *
 * Com julgados guardados, o gesto é LER: clicar na etiqueta "3 julgados"
 * é pedir para ver os três, e um formulário de sete campos no topo
 * empurra a leitura para fora da tela. Sem nenhum julgado não há o que
 * ler, e a única coisa a fazer é incluir.
 *
 * É a mesma divisão do "responder / criar mais" das questões: a tela
 * abre no verbo que a pessoa veio exercer, e o outro fica a um toque. */
function jurAbrir(disciplina, topico, modo) {
  const chave = (typeof matChave === "function")
    ? matChave(disciplina, topico) : (disciplina + "›" + topico);
  jurTopicoAtual = { disciplina, nome: topico, chave };
  jurEditando = "";
  jurFiltroTag = "";
  const sub = $("jurSub");
  if (sub) sub.textContent = t("jur_sub", { d: disciplina, t: topico });
  jurLimparForm();
  const quantos = jurDoTopico(chave).length;
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
  jurModo = m;
  jurPintarModo();
  jurPintarLista();
  if (m === "incluir" && $("jurTese") && $("jurTese").focus) {
    $("jurTese").focus();
  }
}

function jurLimparForm() {
  ["jurColar", "jurTese", "jurResumo", "jurTribunal", "jurClasse", "jurNumero",
   "jurData", "jurOrgao", "jurFonte"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  jurEditando = "";
  jurCategoriaColada = "";
  jurTagsColadas = [];
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
  const a = jurIdentificar(bruto);
  /* COLAR UM JSON É UM PEDIDO EXPLÍCITO DE PREENCHIMENTO.
   *
   * Para texto solto, a regra é não sobrescrever o que já está escrito:
   * o extrator adivinha, e adivinhação não apaga trabalho. Um JSON não
   * adivinha nada — ele traz os campos nomeados, e quem o colou colou
   * para que substituíssem. Foi o que faltou: a tese continuava com um
   * texto anterior enquanto o JSON trazia a tese certa. */
  const doJson = String(bruto).trim()[0] === "{"
    && typeof jurDoJson === "function" && !!jurDoJson(bruto);
  const põe = (id, v) => { if ($(id) && v) $(id).value = v; };
  põe("jurTribunal", a.tribunal);
  põe("jurClasse", a.classe);
  põe("jurNumero", a.numero);
  põe("jurData", a.data);
  põe("jurOrgao", a.orgao);
  if (a.categoria) jurCategoriaColada = a.categoria;
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
    $("jurColar").value = a.texto || "";
  }
  if (a.tags && a.tags.length) jurTagsColadas = a.tags;
  jurPintarTagsForm();

  const achou = ["tribunal", "classe", "numero", "data", "orgao"]
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
    av.className = "jur-pilula" + (achou.length ? " ok" : " aviso");
    av.textContent = achou.length
      ? t("jur_pilula", { c: pedacos.join(" · ") })
      : t("jur_pilula_nada");
  }
  /* NÃO RECONHECEU NADA: aí os campos precisam aparecer, porque não há
   * o que conferir — há o que preencher. Reconheceu: ficam fechados,
   * e a pílula acima já mostra o que há dentro. */
  jurMeta(!achou.length);
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
  const v = (id) => String(($(id) || {}).value || "").trim();
  const tese = v("jurTese");
  const texto = v("jurColar");
  /* SEM TESE E SEM TEXTO não há o que guardar. Um julgado só com o
   * número é uma etiqueta que não se revisa. */
  if (!tese && !texto) { await uiAlert(t("jur_falta")); return; }

  const j = jurGravar({
    id: jurEditando || undefined,
    tribunal: v("jurTribunal"), classe: v("jurClasse"),
    numero: v("jurNumero"), data: v("jurData"), orgao: v("jurOrgao"),
    fonte: v("jurFonte"), tese, texto, resumo: v("jurResumo"),
    /* a categoria vem da colagem ou é deduzida da classe na hora de
     * desenhar — guardá-la evita recalcular e permite que um JSON traga
     * uma classificação que a classe sozinha não diria */
    categoria: jurCategoriaColada
      || (typeof jurCategoria === "function" ? jurCategoria(v("jurClasse")) : ""),
    tags: jurTagsColadas.slice(),
    topicos: jurEditando ? undefined : [jurTopicoAtual.chave],
  });
  if (!j) { await uiAlert(t("jur_nao_salvou")); return; }
  /* SEMPRE, e não só ao editar: o vínculo já existe quando se cria (ele
   * foi para "topicos" ali em cima), mas o RÓTULO não — e é ele que faz
   * o julgado aparecer na estante com o nome certo da disciplina. */
  jurLigar(j.id, jurTopicoAtual.chave,
           jurTopicoAtual.disciplina, jurTopicoAtual.nome);

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
  põe("jurTese", j.tese); põe("jurResumo", j.resumo); põe("jurColar", j.texto);
  jurTagsColadas = (typeof jurTagsDe === "function") ? jurTagsDe(j) : [];
  jurPintarTagsForm();
  /* editar é incluir com os campos preenchidos: sem trocar de modo, o
   * formulário ficaria escondido e o clique não faria nada visível */
  jurModo = "incluir";
  jurPintarModo();
  /* editando à mão, os campos são o que se veio mexer */
  jurMeta(true);
  jurConteudoVisivel(true);
  jurBotaoSalvar();
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
  const txt = jurPromptPreencher(bruto,
    jurTopicoAtual ? jurTopicoAtual.nome : "");
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
  const txt = jurPromptCompletar(j, jurTopicoAtual ? jurTopicoAtual.nome : "");
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
    jurCplEscrever(t("jur_completar_nada"));
    return;
  }
  const r = jurCompletar(jurCplId, dados);
  const partes = [];
  partes.push(r.mudou.length
    ? t("jur_completar_fez", { q: r.mudou.map(jurNomeCampo).join(", ") })
    : t("jur_completar_zero"));
  if (r.ignorados.length) {
    partes.push(t("jur_completar_ignorou",
      { q: r.ignorados.map(jurNomeCampo).join(", ") }));
  }
  /* A CONFERÊNCIA É AVISO, NUNCA CORREÇÃO.
   * A tese é transcrição do tribunal e o resumo é texto de estudo: uma
   * troca automática apagaria a palavra certa achando que era a errada,
   * e o erro sairia gravado com a autoridade de "o app corrigiu". */
  const conf = Array.isArray(dados.conferencia) ? dados.conferencia : [];
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
  reg("JURIS", "resposta de completar aplicada",
      jurTitulo(j) + " · preenchidos " + r.mudou.length
      + " · apontamentos " + conf.length);
  jurCplEscrever(partes.join(""));
  jurCplPintarFalta();
  jurPintarLista();
}

function jurCplEscrever(txt) {
  const cx = $("jurCplSaida");
  if (!cx) return;
  cx.hidden = false;
  cx.textContent = txt;
}

function jurNomeCampo(k) {
  const c = (typeof JUR_CAMPOS_META !== "undefined" ? JUR_CAMPOS_META : [])
    .filter((x) => x.k === k)[0];
  if (c) return t(c.i);
  return k === "tags" ? t("jur_f_tags") : k;
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
  box.innerHTML = "";
  let lista = jurDoTopico(jurTopicoAtual.chave);
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
    const proc = [j.classe, j.numero].filter(Boolean).join(" ");
    if (proc) sel(proc, "proc");
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

    /* AS AÇÕES NO CANTO, EM ÍCONES.
     *
     * Três botões escritos por extenho no rodapé de cada cartão custam
     * uma linha inteira por julgado — com cinco guardados, cinco linhas
     * de botão contra cinco de tese. Em ícone ocupam o canto que já
     * estava vazio. Cada um leva title e aria-label: ícone sozinho é
     * ilegível para quem não adivinha o desenho, e mudo para o leitor
     * de tela. */
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
    /* COMPLETAR E CONFERIR, com o número do que falta no próprio ícone.
     *
     * O ícone mudo dizia "há uma ação aqui"; o número diz QUAL é o
     * estado — "faltam 6 campos" é a informação que faz alguém tocar.
     * Sem ele, um julgado pela metade e um completo têm exatamente a
     * mesma aparência, e o pela metade só é descoberto no dia em que se
     * procura por ele e não se acha. */
    const falta = (typeof jurFaltando === "function") ? jurFaltando(j) : [];
    /* UM ÍCONE SÓ, e ele abre a tela onde os dois passos estão em ordem.
     *
     * Eram dois — 🩹 para copiar a pergunta e 📥 para colar a resposta —
     * e nada na tela dizia que um vinha depois do outro. Dois ícones
     * mudos lado a lado se leem como duas ações alternativas, e não como
     * o começo e o fim do mesmo caminho. */
    bt(falta.length ? "🩹" + falta.length : "🩹",
      falta.length === 1
        ? t("jur_completar_falta_um", { q: jurNomeCampo(falta[0]) })
        : falta.length
        ? t("jur_completar_falta", { n: falta.length,
            q: falta.map(jurNomeCampo).join(", ") })
        : t("jur_completar_ok"),
      falta.length ? "jur-ic-falta" : "", () => jurCompletarAbrir(j.id));
    bt("🃏", t("jur_card_dica"), "", () => jurGerarCartao(j.id));
    bt("✏️", t("jur_ed"), "", () => jurEditar(j.id));
    bt("📋", t("jur_cp"), "", async () => {
      const ok = await edColarCopiarTexto(jurTexto([j]), "", null);
      if (ok) toast("toast_copied");
    });
    bt("🗑️", t("jur_tr"), "jur-ic-perigo", () => jurTirar(j.id));
    cab.append(acoes);
    li.append(cab);

    /* A TESE COMO CITAÇÃO. É o que se revisa; a ementa é onde se
     * confere. Com a mesma tipografia, os dois viravam um bloco só de
     * texto e a tese se perdia dentro dele. */
    if (j.tese) {
      const p = document.createElement("blockquote");
      p.className = "jur-tese";
      jurEscreverTese(p, j.tese);
      li.append(p);
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
  jurPintarPrincipal();
  liga("btnJurVoltarLer", () => jurTrocarModo("ler"));
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
