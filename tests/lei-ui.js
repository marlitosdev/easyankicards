/* A TELA DA LEI SECA.
 *
 * O que precisa valer aqui é o que a pessoa vê e o que ela não perde:
 * colar a lei uma vez e usá-la em vários tópicos; o marcador dizer um
 * ARTIGO; o texto declarar de quando é; o capítulo ser uma sessão de
 * estudo; recitar esconder o texto de verdade; e nenhum cartão entrar no
 * tópico antes de a pessoa ver o que veio da IA. */
const { rodar } = require("./fumaca.js");
const { L4320 } = require("./lei-seca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const preparar = (api, disc, top) => {
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(disc, top);
    api.matGravar(ch, "Resumo.", { disciplina: disc, topico: top,
                                   concurso: "TCE-PE Auditor" });
    return ch;
  };

  /* ---- U1: colar a lei uma vez ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    ok(api.$("dlgLeiSeca").open === true, "U1 a janela da lei nao abriu");
    ok(api.leiModoAtual() === "editar",
       "U1b tópico sem lei devia abrir em EDICAO, para colar");

    api.$("leiTexto").value = L4320;
    api.leiGravar();

    ok(api.leisLista().length === 1, "U1c a lei nao entrou na biblioteca");
    const l = api.leisLista()[0];
    ok(/4\.320/.test(l.nome),
       "U1d a lei nao foi batizada pelo proprio cabecalho: " + l.nome);
    /* a data da consulta é posta SOZINHA na primeira gravação: quem cola
     * a lei não pensa em datar, e sem data não há como saber que o texto
     * envelheceu */
    ok(!!l.consultadaEm,
       "U1e a lei foi guardada sem data de consulta");
    ok(api.matResumosAtual()[ch].leiId === l.id,
       "U1f o topico nao ficou apontando para a lei");

    const chips = api.$("leiFila").querySelectorAll(".lei-chip");
    ok(chips.length >= 1, "U1g a fila de leis do topico esta vazia");
    ok(/8 artigos/.test(chips.map((c) => c.textContent).join(" ")),
       "U1h a fila nao diz quantos artigos a lei tem: "
       + chips.map((c) => c.textContent).join(" | "));
  }

  /* ---- U2: a MESMA lei em dois tópicos, sem segunda cópia ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    const id = api.leisLista()[0].id;

    const ch2 = preparar(api, "Direito Financeiro", "Despesa pública");
    api.leiAbrir("Direito Financeiro", "Despesa pública");
    /* o segundo tópico ainda não tem lei: a tela tem de oferecer as que
     * já existem, senão a pessoa cola a 4.320 de novo — que é
     * exatamente o problema que esta reforma existe para resolver */
    /* PELO ID, E NÃO PELA PALAVRA DO RÓTULO.
     * Esta asserção procurava "vincular" no texto do botão e quebrou
     * quando o rótulo virou "usar uma lei já guardada" — uma melhoria de
     * redação derrubando um teste que fala de função. O botão continua
     * sendo o mesmo; o que ele diz é outra coisa, e não é isto que se
     * quer congelar aqui. */
    const fila = api.$("leiFila").querySelectorAll(".lei-chip");
    const bVinc = fila.filter((b) => b.id === "btnLeiVincular")[0];
    ok(!!bVinc, "U2 a tela nao oferece usar uma lei ja guardada: "
       + fila.map((b) => b.textContent).join(" | "));

    api.leiLigar(id, ch2);
    api.leiTrocarPara(id);
    ok(api.leisLista().length === 1,
       "U2b o segundo topico criou uma SEGUNDA copia da lei");
    ok(String(api.$("leiTexto").value || "").length === L4320.length,
       "U2c o segundo topico abriu com a lei incompleta");

    /* marcar onde parei num tópico vale no outro: é a mesma lei */
    api.leiParar(id, "35");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    ok(/art\. 35/.test(api.$("leiOnde").textContent || ""),
       "U2d o marcador nao acompanhou a lei entre os topicos: "
       + api.$("leiOnde").textContent);
  }

  /* ---- U3: onde parei é um artigo, e dá para continuar dali ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiTrocarModo("ler");

    ok(/ainda n|8/.test(api.$("leiOnde").textContent || ""),
       "U3 lei recem-colada nao diz que ainda nao foi comecada: "
       + api.$("leiOnde").textContent);

    const arts = api.$("leiLeitura").querySelectorAll(".lei-art");
    ok(arts.length === 8,
       "U3b a leitura devia mostrar 8 artigos, mostrou " + arts.length);
    /* O NÚMERO DO ARTIGO É O MARCADOR.
     * Havia um botao "parei aqui" em CADA artigo: numa lei de 115, eram
     * 115 alvos disputando espaco com o texto, e o cabecalho de cada
     * artigo ficava mais pesado que alguns artigos. O numero ja estava
     * la, ja e unico, ja e o endereco. */
    const b35 = arts.filter((a) => /Art\. 35/.test(a.textContent))[0];
    ok(!!b35, "U3c nao achei o bloco do art. 35 na leitura");
    if (!b35) { falhas.quantas = n; return falhas; }

    const semParei = arts.reduce((c, a) => c + a.querySelectorAll("button")
      .filter((b) => /^parei aqui$/i.test((b.textContent || "").trim())).length, 0);
    ok(semParei === 0,
       "U3c2 voltaram os " + semParei + " botoes de 'parei aqui' por artigo");

    const num35 = b35.querySelectorAll(".lei-art-num")[0];
    ok(!!num35 && typeof num35.onclick === "function",
       "U3d o numero do artigo nao e clicavel");
    if (!num35 || typeof num35.onclick !== "function") {
      falhas.quantas = n; return falhas;
    }
    num35.onclick();

    const onde = api.$("leiOnde").textContent || "";
    ok(/art\. 35/.test(onde), "U3e o marcador nao ficou no art. 35: " + onde);
    ok(/7 de 8/.test(onde),
       "U3f o marcador nao diz a posicao na lei: " + onde);
    /* e o botao de continuar aponta para o PRÓXIMO, nao para o mesmo */
    const bCont = api.$("leiOnde").querySelectorAll("button")
      .filter((b) => /continuar/i.test(b.textContent))[0];
    ok(!!bCont && /115/.test(bCont.textContent),
       "U3g continuar devia levar ao art. 115: "
       + (bCont && bCont.textContent));

    /* O RÓTULO É O ATALHO PARA O PONTO ONDE PAROU.
     * Dizer "parei no art. 35" e obrigar a procurar o art. 35 na rolagem
     * e dar a informacao e cobrar o trabalho. */
    const bIr = api.$("leiOnde").querySelectorAll(".lei-onde-txt")[0];
    ok(!!bIr && typeof bIr.onclick === "function",
       "U3h a frase 'parei no art. 35' nao leva ao artigo");

    /* clicar de novo no mesmo numero TIRA o marcador: sem isso, so daria
     * para desmarcar marcando outro artigo qualquer */
    api.$("leiLeitura").querySelectorAll(".lei-art")
      .filter((a) => /Art\. 35/.test(a.textContent))[0]
      .querySelectorAll(".lei-art-num")[0].onclick();
    ok(/ainda n/.test(api.$("leiOnde").textContent || ""),
       "U3i clicar de novo no artigo marcado nao tirou o marcador: "
       + api.$("leiOnde").textContent);
  }

  /* ---- U15: o aviso do artigo que mais cai, na leitura ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.qsAplicar([
      { tipo: "ce", enunciado: "O art. 35 da Lei 4.320 trata do regime de caixa.",
        gabarito: "E", comentario: "", chave: ch },
      { tipo: "ce", enunciado: "Conforme o art. 35, pertencem ao exercício as "
          + "receitas nele arrecadadas.", gabarito: "C", comentario: "", chave: ch },
    ]);
    api.qsTodas().forEach((q) => { q.tentativas = [{ acertou: false }]; });
    api.leiTrocarModo("ler");

    const arts = api.$("leiLeitura").querySelectorAll(".lei-art");
    const a35 = arts.filter((a) => /Art\. 35/.test(a.textContent))[0];
    const avisos = a35.querySelectorAll(".lei-art-cai");
    ok(avisos.length === 1,
       "U15 o art. 35 devia ter o aviso de que cai, tem " + avisos.length);
    const txt = (avisos[0] || {}).textContent || "";
    ok(/2 quest/.test(txt),
       "U15b o aviso nao diz em quantas questoes suas o artigo apareceu: " + txt);
    ok(/errou 2/.test(txt),
       "U15c o aviso nao diz como voce tem se saido nele: " + txt);
    /* erra mais do que acerta: o aviso muda de cor */
    ok(/lei-art-cai-erro/.test(avisos[0].className || ""),
       "U15d erro maior que acerto e o aviso nao se destaca: "
       + avisos[0].className);

    /* ARTIGO QUE NÃO CAI NÃO GANHA AVISO.
     * Pendurar a nota em todos os 115 artigos a transformaria em moldura
     * — e moldura nao informa nada. */
    const a1 = arts.filter((a) => /Art\. 1º/.test(a.textContent))[0];
    ok(a1 && a1.querySelectorAll(".lei-art-cai").length === 0,
       "U15e artigo sem questao nenhuma ganhou o aviso mesmo assim");
  }

  /* ---- U16: o tamanho da JANELA ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiTrocarModo("ler");

    /* A LISTA DE TAMANHOS DE LETRA FOI EMBORA.
     * Pequeno / medio / grande / enorme / gigante era resposta para a
     * pergunta errada: quem mexe na letra quer um degrau a mais do que
     * esta vendo, e o A+/A- ja fazia isso. O que faltava era o outro
     * eixo — o tamanho da janela. */
    ok(!api.$("leiTamanhos") || !api.$("leiTamanhos").querySelectorAll(".lei-tam").length,
       "U16 a lista de tamanhos de letra voltou");

    const dlg = api.$("dlgLeiSeca");
    ok(/lei-j-/.test(dlg.className || ""),
       "U16b a janela nao tem tamanho nenhum aplicado: " + dlg.className);
    /* SEM NADA GUARDADO, A JANELA NÃO PODE ABRIR NA MENOR.
     * Number(null) vale 0, e 0 e um indice valido — quem nunca escolheu
     * nada abria na janela mais estreita achando que era o normal. */
    const antes = api.leiJanelaAtual();
    ok(antes > 0,
       "U16b2 sem preferencia guardada a janela abriu na menor de todas");

    api.$("btnLeiJanelaMais").onclick();
    ok(api.leiJanelaAtual() === antes + 1,
       "U16c aumentar a janela nao pegou");
    ok(dlg.className.indexOf("lei-j-" + api.LEI_JANELAS[antes + 1]) >= 0,
       "U16d a classe nao acompanhou o tamanho novo: " + dlg.className);
    /* UM tamanho de cada vez: duas classes juntas dariam largura
     * imprevisivel, decidida pela ordem do CSS */
    const quantas = (dlg.className || "").split(/\s+/)
      .filter((c) => /^lei-j-/.test(c)).length;
    ok(quantas === 1,
       "U16e a janela ficou com " + quantas + " tamanhos ao mesmo tempo");

    ok(!!api.loja.getItem("eac_lei_janela"),
       "U16f o tamanho da janela nao ficou guardado");
    ok(/larga|m[ée]dia|estreita|tela/i.test(api.$("leiJanelaNome").textContent || ""),
       "U16g a janela nao diz em que tamanho esta: "
       + api.$("leiJanelaNome").textContent);

    /* chegando no maior, o botao de aumentar se desliga: clique sem
     * resposta parece defeito */
    for (let i = 0; i < 6; i++) api.$("btnLeiJanelaMais").onclick();
    ok(api.leiJanelaAtual() === api.LEI_JANELAS.length - 1,
       "U16h nao chegou ao maior tamanho");
    ok(api.$("btnLeiJanelaMais").disabled === true,
       "U16i no maior tamanho o botao de aumentar continua clicavel");
    ok(api.$("btnLeiJanelaMenos").disabled === false,
       "U16j no maior tamanho o botao de diminuir ficou desligado");

    for (let i = 0; i < 6; i++) api.$("btnLeiJanelaMenos").onclick();
    ok(api.leiJanelaAtual() === 0, "U16k nao chegou ao menor tamanho");
    ok(api.$("btnLeiJanelaMenos").disabled === true,
       "U16l no menor tamanho o botao de diminuir continua clicavel");

    /* e o tamanho guardado volta na proxima abertura */
    api.$("btnLeiJanelaMais").onclick();
    api.$("btnLeiJanelaMais").onclick();
    const escolhido = api.leiJanelaAtual();
    api.leiIniciar();
    ok(api.leiJanelaAtual() === escolhido,
       "U16m o tamanho escolhido nao voltou na abertura seguinte");
  }

  /* ---- U17: ajuda e registro separados, com forma própria ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    [["btnLeiAjuda", "ajuda"], ["btnLeiLog", "registro"]].forEach(([id, nome]) => {
      ok(/lei-redondo/.test(api.$(id).className || ""),
         "U17 o botao de " + nome + " nao tem forma propria: "
         + api.$(id).className);
      ok(!/btn-min/.test(api.$(id).className || ""),
         "U17b o botao de " + nome + " voltou a ser igual aos de trabalho");
    });
    /* e a ajuda ganhou os dois recursos novos */
    api.$("btnLeiAjuda").onclick();
    const txt = api.$("leiAjudaCx").textContent || "";
    ok(/editar/i.test(txt) && /emenda|artigo novo/i.test(txt),
       "U17c a ajuda nao explica a edicao por artigo");
    ok(/cai/i.test(txt) && /questões salvas|questoes salvas/i.test(txt),
       "U17d a ajuda nao explica o aviso 'este artigo cai'");
    /* letra e janela sao ajustes DIFERENTES, e a ajuda tem de dizer isso:
     * foi exatamente essa confusao que me fez construir a coisa errada */
    ok(/LETRA/.test(txt) && /JANELA/.test(txt),
       "U17e a ajuda nao distingue o tamanho da letra do tamanho da janela");
  }

  /* ---- U18: editar um artigo sem tocar no resto ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiParar(api.leisLista()[0].id, "35");
    api.leiTrocarModo("ler");

    const a35 = api.$("leiLeitura").querySelectorAll(".lei-art")
      .filter((a) => /Art\. 35/.test(a.textContent))[0];
    const bEd = a35.querySelectorAll("button")
      .filter((b) => /editar/i.test(b.textContent))[0];
    ok(!!bEd, "U18 o artigo nao tem botao de editar");
    bEd.onclick();
    ok(api.$("dlgLeiArt").open === true, "U18b a janela do artigo nao abriu");

    /* SÓ AQUELE ARTIGO no campo — era este o problema: a lei inteira
     * numa caixa, e a pessoa cacando a linha no meio de cinco mil
     * palavras */
    const campo = api.$("leiArtTexto").value || "";
    ok(/Pertencem ao exercício financeiro/.test(campo),
       "U18c o campo nao trouxe o artigo pedido");
    ok(!/Tributo é a receita derivada/.test(campo),
       "U18d o campo trouxe a lei inteira de novo");

    /* a lista ao lado permite trocar de artigo sem fechar */
    const itens = api.$("leiArtLista").querySelectorAll(".lei-art-item");
    ok(itens.length >= 9,
       "U18e a lista de artigos veio com " + itens.length + " itens (8 + novo)");
    ok(itens.some((x) => /artigo novo/i.test(x.textContent)),
       "U18f falta o caminho para acrescentar artigo");
    ok(itens.some((x) => /lei-art-item-on/.test(x.className || "")),
       "U18g a lista nao mostra qual artigo esta aberto");

    /* gravar troca SÓ aquele artigo */
    api.$("leiArtTexto").value =
      "Art. 35. Pertencem ao exercício financeiro (redação nova):\n"
      + "I - as receitas nele arrecadadas;";
    api.leiEdSalvar(false);
    const lei = api.leisLista()[0];
    ok(/redação nova/.test(lei.texto),
       "U18h a nova redacao nao entrou na lei");
    ok(/Tributo é a receita derivada/.test(lei.texto),
       "U18i editar o art. 35 apagou os outros artigos");
    ok(api.leiArtigos(lei.texto).length === 8,
       "U18j a lei mudou de tamanho: " + api.leiArtigos(lei.texto).length);
    ok(api.leiProgresso(lei.id).artigo === "35",
       "U18k editar o artigo derrubou o marcador");

    /* ARTIGO NOVO ENTRA NO LUGAR CERTO, não no fim do arquivo.
     * O numero escolhido tem de NAO existir na lei de teste — pedir um
     * que ja existe faz a insercao ser recusada, a ordem continuar certa
     * por acaso, e o teste passar sem ter exercido nada. Foi o que
     * aconteceu com o 12-A, que ja esta no texto. */
    api.leiEdAbrir("");
    api.$("leiArtTexto").value = "Art. 5º Artigo acrescentado por emenda.";
    ok(api.leiEdSalvar(false) === true,
       "U18l1 nao consegui acrescentar o artigo: "
       + api.$("leiArtAviso").textContent);
    const nums = api.leiArtigos(api.leisLista()[0].texto).map((a) => a.num);
    ok(nums.join(",") === "1,2,3,5,9,11,12-A,35,115",
       "U18l o artigo novo caiu no lugar errado: " + nums.join(","));

    /* e o mesmo numero duas vezes e recusado, com aviso */
    api.leiEdAbrir("");
    api.$("leiArtTexto").value = "Art. 35. Tentando duplicar.";
    ok(api.leiEdSalvar(false) === false,
       "U18m aceitou um segundo art. 35 na mesma lei");
    ok(/já existe|ja existe/i.test(api.$("leiArtAviso").textContent || ""),
       "U18n recusou sem dizer por que: " + api.$("leiArtAviso").textContent);

    /* TEXTO SEM "Art. N" É RECUSADO.
     * Sem o numero na frente, o pedaco deixa de ser encontravel pelo
     * marcador, pelos cartoes e pela estatistica — e o estrago so
     * apareceria muito depois. */
    api.leiEdAbrir("11");
    api.$("leiArtTexto").value = "A receita classifica-se em categorias.";
    /* try/catch porque a alternativa ao "recusar" nao e "aceitar": e
     * estourar mais adiante, quando alguem for ler o numero do artigo
     * que nao existe. Pilha de erro tambem e falha — so nao diz qual. */
    let recusou = false;
    try { recusou = api.leiEdSalvar(false) === false; } catch (e) { recusou = false; }
    ok(recusou, "U18o aceitou (ou estourou com) artigo sem o numero na frente");
    ok(/número|numero/i.test(api.$("leiArtAviso").textContent || ""),
       "U18p recusou sem explicar o que falta");
  }

  /* ---- U4: de onde veio e de quando é ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    const id = api.leisLista()[0].id;

    api.leiProcAbrir();
    ok(api.$("dlgLeiProc").open === true, "U4 a janela de procedencia nao abriu");
    api.$("leiProcFonte").value = "https://www.planalto.gov.br/x.htm";
    api.$("leiProcVersao").value = "atualizada até a EC 126/2022";
    api.$("leiProcData").value = "2026-08-20";
    api.leiProcSalvar();

    const l = api.leiDe(id);
    ok(l.fonte === "https://www.planalto.gov.br/x.htm",
       "U4b o link da fonte nao foi guardado");
    ok(/EC 126/.test(l.versao || ""), "U4c a versao nao foi guardada");
    const proc = api.$("leiProc").textContent || "";
    ok(/2026-08-20/.test(proc),
       "U4d a tela nao mostra a data da consulta: " + proc);
    ok(/EC 126/.test(proc), "U4e a tela nao mostra ate onde o texto vale");

    /* LEI VELHA TEM DE APARECER COMO VELHA.
     * Texto copiado antes de uma emenda continua parecendo certo — o
     * unico sinal possivel e a data. Sem o aviso, a data vira enfeite. */
    api.leiGuardar({ id, consultadaEm: "2024-01-10" });
    api.leiPintar();
    const velho = api.$("leiProc").textContent || "";
    ok(/dias/.test(velho),
       "U4f lei copiada ha mais de dois anos nao avisou nada: " + velho);
    const alerta = api.$("leiProc").querySelectorAll(".lei-velha");
    ok(alerta.length > 0, "U4g o aviso de lei velha nao tem destaque nenhum");

    /* e lei SEM data nenhuma tambem tem de avisar */
    api.leiGuardar({ id, consultadaEm: "" });
    api.leiPintar();
    ok(/atualizado|sem link/.test(api.$("leiProc").textContent || ""),
       "U4h lei sem data nenhuma passou calada: " + api.$("leiProc").textContent);
  }

  /* ---- U5: capítulos como sessões de estudo ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    const id = api.leisLista()[0].id;

    const blocos = api.$("leiBlocosCx").querySelectorAll(".lei-bloco");
    ok(blocos.length === 2,
       "U5 deviam aparecer 2 capitulos, apareceram " + blocos.length);
    const txt = blocos.map((b) => b.textContent).join(" | ");
    ok(/min/.test(txt),
       "U5b o capitulo nao diz quanto tempo leva — e o que decide se cabe hoje: "
       + txt);
    ok(/artigos/.test(txt), "U5c o capitulo nao diz quantos artigos tem");

    const bMarcar = blocos[0].querySelectorAll("button")
      .filter((b) => /marcar lido/i.test(b.textContent))[0];
    ok(!!bMarcar, "U5d falta o botao de marcar o capitulo como lido");
    bMarcar.onclick();
    ok(api.leiBlocosLidos(id) === 1, "U5e marcar o capitulo lido nao pegou");
    /* MARCAR O CAPÍTULO MOVE O MARCADOR. Deixar os dois discordando
     * ("li o capitulo I" mas "parei no art. 1") e o comeco de o app nao
     * saber mais onde a pessoa esta. */
    ok(api.leiProgresso(id).artigo === "3",
       "U5f marcar o capitulo I nao levou o marcador ao art. 3: "
       + api.leiProgresso(id).artigo);
  }

  /* ---- U6: recitar esconde o texto de verdade ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();

    api.leiTrocarModo("recitar");
    ok(api.$("leiRecitar").hidden === false, "U6 o modo recitar nao apareceu");
    ok(api.$("leiLeitura").hidden === true,
       "U6b a leitura normal continuou na tela por baixo do recitar");

    const rec = api.$("leiRecitar").textContent || "";
    ok(/Art\. 35/.test(rec), "U6c o modo recitar nao mostra o numero do artigo");
    ok(/Pertencem ao exercício financeiro/.test(rec),
       "U6d o modo recitar nao mostra a ementa — sem ela nao ha o que lembrar");
    /* O TEXTO TEM DE ESTAR ESCONDIDO. Se os incisos aparecem, recitar
     * vira leitura com letra menor e nao mede nada. */
    ok(!/as receitas nêle arrecadadas/.test(rec),
       "U6e o modo recitar mostrou o texto do artigo — nao esconde nada");

    const cabs = api.$("leiRecitar").querySelectorAll(".lei-rec-cab");
    const c35 = cabs.filter((b) => /Art\. 35/.test(b.textContent))[0];
    ok(!!c35, "U6f nao achei o art. 35 no recitar");
    if (c35) {
      c35.onclick();
      ok(/as receitas nêle arrecadadas/.test(api.$("leiRecitar").textContent || ""),
         "U6g revelar o artigo nao mostrou o texto dele");
      /* E REVELAR UM NÃO REVELA OS OUTROS.
       * A comparação tem de ser com um trecho que NÃO esteja na ementa —
       * a ementa aparece de propósito, mesmo escondido. O inciso do art.
       * 2 serve: ele só existe no corpo. */
      ok(!/Sumário geral da receita/.test(api.$("leiRecitar").textContent || ""),
         "U6h revelar um artigo revelou a lei inteira");
    }
  }

  /* ---- U7: cartões de um artigo, com conferência antes ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiTrocarModo("ler");

    const a35 = api.$("leiLeitura").querySelectorAll(".lei-art")
      .filter((a) => /Art\. 35/.test(a.textContent))[0];
    const bC = a35 && a35.querySelectorAll("button")
      .filter((b) => /cart/i.test(b.textContent))[0];
    ok(!!bC, "U7 o artigo nao tem botao de virar cartoes");
    if (!bC) { falhas.quantas = n; return falhas; }
    bC.onclick();
    ok(api.$("dlgLeiCloze").open === true, "U7b a janela de cartoes nao abriu");

    const pr = api.$("leiClozePrompt").value || "";
    ok(/Pertencem ao exercício financeiro/.test(pr),
       "U7c o prompt nao leva o texto do artigo");
    ok(!/Tributo é a receita derivada/.test(pr),
       "U7d o prompt levou OUTROS artigos junto — o pedido era ESTE artigo");
    /* a etiqueta amarra o cartao ao artigo: cartao de lei sem numero de
     * artigo e cartao orfao — errou na revisao e nao ha como voltar */
    ok(/art35/.test(pr),
       "U7e o prompt nao manda etiquetar o cartao com o artigo: "
       + pr.slice(0, 120));
    ok(/PRAZOS|NÚMEROS/.test(pr),
       "U7f o prompt nao diz O QUE esconder — a banca troca numero e prazo");

    /* NADA ENTRA ANTES DE SER VISTO */
    ok(api.matContarCartoes(ch) === 0, "U7g havia cartao antes da hora");
    api.$("leiClozeColar").value =
      "Pertencem ao exercício financeiro as receitas {{c1::nêle arrecadadas}} "
      + ":: :: lei4320-art35";
    api.leiClozeConferir();
    ok(api.$("leiClozePrevia").hidden === false,
       "U7h a previa dos cartoes nao apareceu");
    ok(api.matContarCartoes(ch) === 0,
       "U7i o cartao foi gravado ANTES de a pessoa confirmar");

    api.leiClozeAplicar();
    api.uiModalResponder(true);
    ok(api.matContarCartoes(ch) === 1,
       "U7j apliquei e o cartao nao entrou no topico: "
       + api.matContarCartoes(ch));
    ok(/art35/.test(String(api.matResumosAtual()[ch].cartoes || "")),
       "U7k o cartao entrou sem a etiqueta do artigo");
  }

  /* ---- U8: artigos que mais caem, das SUAS questões ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();

    /* duas questões citando o art. 35, uma citando um artigo que NÃO é
     * desta lei, e uma errada para o placar ter o que dizer */
    api.qsAplicar([
      { tipo: "ce", enunciado: "Nos termos do art. 35 da Lei 4.320, pertencem "
          + "ao exercício as receitas nele arrecadadas.", gabarito: "C",
        comentario: "", chave: ch },
      { tipo: "ce", enunciado: "O art. 35 trata do regime de competência.",
        gabarito: "E", comentario: "Ver também o art. 11.", chave: ch },
      { tipo: "ce", enunciado: "Conforme o art. 927 do Código Civil, aquele "
          + "que causa dano fica obrigado a repará-lo.", gabarito: "C",
        comentario: "", chave: ch },
    ]);
    /* as duas do art. 35 foram erradas: é o que dá sentido ao placar */
    api.qsTodas().slice(0, 2).forEach((q) => { q.tentativas = [{ acertou: false }]; });

    const rank = api.leiRanking();
    ok(rank.length > 0, "U8 o ranking saiu vazio com duas questoes citando a lei");
    ok(rank[0] && rank[0].num === "35",
       "U8b o artigo mais citado devia ser o 35, veio: "
       + JSON.stringify(rank.map((r) => r.num)));
    ok(rank[0] && rank[0].questoes === 2,
       "U8c o art. 35 aparece em 2 questoes, contou "
       + (rank[0] && rank[0].questoes));
    ok(rank[0] && rank[0].erros === 2,
       "U8d o placar do art. 35 nao contou os erros: "
       + (rank[0] && rank[0].erros));
    /* ARTIGO DE OUTRA LEI NÃO ENTRA. O art. 927 do Código Civil citado
     * numa questao qualquer nao e artigo da 4.320 — misturar as duas
     * transformaria a estatistica em ruido. */
    ok(!rank.some((r) => r.num === "927"),
       "U8e um artigo de OUTRA lei entrou no ranking desta");
    /* o art. 11 existe na 4.320 e foi citado no comentario: conta */
    ok(rank.some((r) => r.num === "11"),
       "U8f citacao no COMENTARIO da questao nao foi contada");

    api.leiRankingAbrir();
    ok(api.$("dlgLeiRank").open === true, "U8g a janela do ranking nao abriu");
    const linha = api.$("leiRankCx").textContent || "";
    ok(/Art\. 35/.test(linha), "U8h a lista nao mostra o artigo");
    ok(/2 erros|erros/.test(linha),
       "U8i a lista nao mostra como voce se saiu: " + linha.slice(0, 120));
  }

  /* ---- U9: as marcas valem dentro da lei ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiTrocarModo("ler");

    api.matPorSelecao("Pertencem ao exercício financeiro");
    api.$("btnLeiMarcaPeg").onclick();

    const vivo = api.leiTextoDoTopico(ch);
    ok(/==~Pertencem ao exercício financeiro==/.test(vivo),
       "U9 a marca de pegadinha nao entrou no texto da lei");
    /* e NÃO foi parar no resumo do tópico, que é outro documento */
    ok(!/==~/.test(String(api.matResumosAtual()[ch].texto || "")),
       "U9b a marca feita na lei foi gravada no RESUMO");

    const marcas = api.matMarcasNoTexto(ch, "lei");
    ok(marcas.length === 1 && marcas[0].tipo === "pegadinha",
       "U9c a marca da lei nao aparece na lista de marcas: "
       + JSON.stringify(marcas.map((m) => m.tipo)));

    /* E A MARCA TEM DE CHEGAR À BIBLIOTECA.
     * Com a janela aberta, tudo isto acima podia estar lendo apenas a
     * caixa de texto na tela. O teste só vale quando a janela fecha: é aí
     * que se descobre se o texto foi mesmo para onde ele mora. */
    api.leiGravar();
    await api.$("btnLeiFechar").onclick();
    ok(api.$("dlgLeiSeca").open === false, "U9d a janela nao fechou");
    ok(/==~Pertencem ao exercício financeiro==/.test(api.leiTextoDoTopico(ch)),
       "U9e com a janela fechada a marca sumiu — ela vivia so na tela");
    const naBiblio = api.leisLista()[0];
    ok(/==~/.test(String(naBiblio.texto || "")),
       "U9f a marca nao foi gravada no texto da lei na biblioteca");
    /* e a marca vale para TODOS os tópicos que usam esta lei: é uma lei
     * só, e a pegadinha é da lei, não do tópico */
    const ch2 = api.matChave("Direito Financeiro", "Despesa pública");
    api.leiLigar(naBiblio.id, ch2);
    ok(/==~/.test(api.leiTextoDoTopico(ch2)),
       "U9g o outro topico que usa a mesma lei nao enxerga a marca");

    /* QUEM ESCREVE DE FORA TAMBÉM TEM DE ACERTAR O ALVO.
     * Tirar uma marca, incorporar uma dica e "consertar marcação" não
     * passam por leiGravar: chamam matAplicarTexto. Enquanto essa porta
     * escrevia no campo antigo do tópico, o trabalho sumia — a tela
     * mostrava o texto da biblioteca, sem a alteração. */
    api.matAplicarTexto(ch, "lei", "Art. 1º Texto trocado por fora.");
    ok(/trocado por fora/.test(api.leiTextoDoTopico(ch)),
       "U9h escrever pela porta de fora nao chegou na lei");
    ok(/trocado por fora/.test(String(api.leisLista()[0].texto || "")),
       "U9i a alteracao feita por fora nao entrou na biblioteca");
    ok(/trocado por fora/.test(api.leiTextoDoTopico(ch2)),
       "U9j a alteracao nao valeu para o outro topico da mesma lei");
  }

  /* ---- U10: ler maior ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiTrocarModo("ler");
    api.$("btnLeiBlocos").onclick();          /* deixa os capítulos abertos */

    ok(api.$("leiFila").hidden === false, "U10 a fila devia estar visivel antes");
    api.$("btnLeiCheia").onclick();

    /* NA LEITURA AMPLIADA SÓ FICA A LEI.
     * Fila, procedencia, marcador, capitulos e marcas sao referencia:
     * servem antes e depois de ler, nao durante. Era o texto que estava
     * espremido numa faixa com barra de rolagem propria. */
    [["leiFila", "a fila de leis"], ["leiProc", "a procedencia"],
     ["leiOnde", "o marcador"], ["leiBlocosCx", "a lista de capitulos"],
     ["leiMarcas", "a barra de marcas"]].forEach(([id, nome]) => {
      ok(api.$(id).hidden === true,
         "U10b " + nome + " continuou na tela na leitura ampliada");
    });
    ok(api.$("leiLeitura").hidden === false,
       "U10c a leitura sumiu junto com o resto — sobrou nada");
    ok(/lei-cheia/.test(api.$("dlgLeiSeca").className || ""),
       "U10d a janela nao entrou em modo ampliado");
    ok(/normal|voltar/i.test(api.$("btnLeiCheia").textContent || ""),
       "U10e o botao nao oferece a saida: " + api.$("btnLeiCheia").textContent);

    api.$("btnLeiCheia").onclick();
    ok(api.$("leiFila").hidden === false, "U10f sair da tela cheia nao trouxe a fila de volta");
    ok(api.$("leiOnde").hidden === false, "U10g sair nao trouxe o marcador de volta");
    ok(!/lei-cheia/.test(api.$("dlgLeiSeca").className || ""),
       "U10h a janela ficou presa no modo ampliado");

    /* FECHAR SAI DA TELA CHEIA. Reabrir a lei amputada de tudo, sem ter
     * pedido, parece defeito e nao recurso. */
    api.$("btnLeiCheia").onclick();
    await api.$("btnLeiFechar").onclick();
    api.leiAbrir("Direito Financeiro", "Receita pública");
    ok(api.$("leiFila").hidden === false,
       "U10i reabriu ainda em tela cheia, sem ninguem ter pedido");
  }

  /* ---- U11: a letra escolhida fica ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();
    api.leiTrocarModo("ler");
    const antes = api.$("leiLeitura").style.fontSize;
    api.$("btnLeiMaior").onclick();
    api.$("btnLeiMaior").onclick();
    const depois = api.$("leiLeitura").style.fontSize;
    ok(antes !== depois, "U11 A+ nao mudou o tamanho da letra");
    ok(!!api.loja.getItem("eac_lei_fonte"),
       "U11b o tamanho escolhido nao foi guardado — teria de refazer toda vez");
    ok(api.loja.getItem("eac_lei_fonte") === String(parseInt(depois, 10)),
       "U11c guardou um tamanho diferente do que esta na tela: "
       + api.loja.getItem("eac_lei_fonte") + " vs " + depois);

    /* e nao cresce sem fim: A+ repetido criaria letra que nenhuma tela
     * comporta, e sem forma de voltar sem clicar vinte vezes */
    for (let i = 0; i < 40; i++) api.$("btnLeiMaior").onclick();
    const px = parseInt(api.$("leiLeitura").style.fontSize, 10);
    ok(px <= 56 && px >= 40,
       "U11d a letra parou em " + px + "px — esperado um teto entre 40 e 56");
    for (let i = 0; i < 40; i++) api.$("btnLeiMenor").onclick();
    ok(parseInt(api.$("leiLeitura").style.fontSize, 10) >= 11,
       "U11e a letra encolheu ate ficar ilegivel: "
       + api.$("leiLeitura").style.fontSize);
  }

  /* ---- U12: ajuda ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("btnLeiAjuda").onclick();
    ok(api.$("dlgLeiAjuda").open === true, "U12 a ajuda nao abriu");

    const itens = api.$("leiAjudaCx").querySelectorAll(".duv-item");
    ok(itens.length === api.LEI_AJUDA.length && itens.length >= 12,
       "U12b a ajuda tem " + itens.length + " itens para "
       + api.LEI_AJUDA.length + " recursos");

    /* AJUDA QUE MOSTRA O NOME DA CHAVE É PIOR QUE AJUDA NENHUMA.
     * t() devolve a propria chave quando falta a traducao — foi assim
     * que "lei_proc_btn" chegou a aparecer num botao. */
    const txt = itens.map((i) => i.textContent).join(" ");
    ok(!/lei_aj_/.test(txt),
       "U12c a ajuda esta mostrando o nome interno das chaves: "
       + txt.slice(0, 120));

    /* cada recurso da janela precisa estar explicado */
    [["recitar", /reconhecer e lembrar|sensação de/i],
     ["fonte", /data|atualizad/i],
     ["marcador|parei", /artigo/i],
     ["capítulo", /minutos|sess/i],
     ["etiqueta|órfão", /artigo/i]].forEach(([oque, comQue]) => {
      const achou = itens.some((i) => new RegExp(oque, "i").test(i.textContent)
        && comQue.test(i.textContent));
      ok(achou, "U12d a ajuda nao explica '" + oque + "'");
    });
  }

  /* ---- U13: registro próprio, com hoje e erros ---- */
  {
    const { api } = rodar();
    const ch = preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");
    api.$("leiTexto").value = L4320;
    api.leiGravar();

    api.$("btnLeiLog").onclick();
    ok(api.$("dlgLeiLog").open === true, "U13 o registro nao abriu");
    const txt = api.$("leiLogTexto").value || "";
    ok(/lei gravada/.test(txt),
       "U13b gravar a lei nao virou linha no registro: " + txt.slice(0, 120));
    ok(/4\.320/.test(txt),
       "U13c a linha do registro nao diz de QUAL lei se trata");

    /* o registro da lei NAO pode virar o registro de tudo */
    ok(!/edital|backup/i.test(txt),
       "U13d entrou coisa que nao e da lei no registro dela");

    /* FILTRO DE HOJE: abre ligado, porque a pergunta comum e "o que eu
     * fiz agora?". Mas tem de dizer o que esta escondendo. */
    ok(/hoje/.test(api.$("leiLogResumo").textContent || ""),
       "U13e o resumo nao diz quantas linhas sao de hoje: "
       + api.$("leiLogResumo").textContent);

    /* uma linha de ONTEM some com o filtro e volta sem ele */
    const cru = JSON.parse(api.loja.getItem("eac_lei_log") || "[]");
    cru.unshift({ q: "2020-01-02T10:00:00.000Z", t: "gravar",
                  o: "coisa antiga", d: "", lei: "Lei X", top: "", modo: "ler" });
    api.loja.setItem("eac_lei_log", JSON.stringify(cru));
    api.leiIniciar();
    api.$("btnLeiLog").onclick();
    ok(!/coisa antiga/.test(api.$("leiLogTexto").value || ""),
       "U13f o filtro de hoje deixou passar linha de outro dia");
    api.$("btnLeiLogHoje").onclick();
    ok(/coisa antiga/.test(api.$("leiLogTexto").value || ""),
       "U13g desligar o filtro nao trouxe as linhas antigas");
    ok(/2020-01-02/.test(api.$("leiLogTexto").value || ""),
       "U13h sem o filtro de hoje as linhas precisam mostrar a DATA");

    /* FILTRO DE ERROS: e a pergunta "o que quebrou?" */
    api.$("btnLeiLogErros").onclick();
    ok(!/coisa antiga|lei gravada/.test(api.$("leiLogTexto").value || ""),
       "U13i 'so erros' esta mostrando linha que nao e erro");
    ok(/Nada registrado/i.test(api.$("leiLogTexto").value || ""),
       "U13j sem erros, a lista devia dizer que esta vazia POR CAUSA do filtro");
  }

  /* ---- U14: erro de botão vira linha de registro ---- */
  {
    const { api } = rodar();
    preparar(api, "Direito Financeiro", "Receita pública");
    api.leiAbrir("Direito Financeiro", "Receita pública");

    /* ERRO QUE MORRE NO CONSOLE É ERRO QUE NUNCA SERÁ CONSERTADO.
     * Ninguem abre o console do navegador. Todo botao daqui passa pelo
     * leiBotao justamente para que a falha vire uma linha com o NOME do
     * botao — que e o que a pessoa consegue relatar. */
    api.leiBotao("btnLeiSalvar", "gravar", () => {
      throw new Error("estourou de proposito");
    });
    api.$("btnLeiSalvar").onclick();
    api.uiModalResponder(true);          /* dispensa o aviso na tela */

    api.$("btnLeiLog").onclick();
    api.$("btnLeiLogErros").onclick();
    const txt = api.$("leiLogTexto").value || "";
    ok(/erro/.test(txt), "U14 a falha nao virou linha de erro: " + txt.slice(0, 100));
    ok(/gravar/.test(txt),
       "U14b a linha de erro nao diz QUAL botao falhou: " + txt.slice(0, 140));
    ok(/estourou de proposito/.test(txt),
       "U14c a linha nao guarda a mensagem do erro: " + txt.slice(0, 140));

    /* E NENHUM BOTÃO PODE ESCAPAR DO EMBRULHO.
     * O caso real: as cinco marcas foram ligadas com a assinatura antiga
     * e passaram a estourar em silencio ao primeiro clique. Nenhum teste
     * pegava, porque nenhum perguntava se o botao AINDA funcionava. */
    api.leiIniciar();
    api.leiAbrir("Direito Financeiro", "Receita pública");
    ["btnLeiModoLer", "btnLeiModoEditar", "btnLeiModoRecitar", "btnLeiBlocos",
     "btnLeiCheia", "btnLeiAjuda", "btnLeiLog", "btnLeiMaior", "btnLeiMenor",
     "btnLeiMarcaDest", "btnLeiMarcaImp", "btnLeiMarcaDuv",
     "btnLeiMarcaProva", "btnLeiMarcaPeg"].forEach((id) => {
      ok(typeof api.$(id).onclick === "function",
         "U14d o botao " + id + " ficou sem acao nenhuma");
    });
    /* clicar em cada um nao pode gerar linha de erro */
    const errosAntes = api.leiLog0();
    ["btnLeiModoLer", "btnLeiModoRecitar", "btnLeiModoLer", "btnLeiBlocos",
     "btnLeiMaior", "btnLeiMenor"].forEach((id) => api.$(id).onclick());
    ok(api.leiLog0() === errosAntes,
       "U14e clicar nos botoes gerou " + (api.leiLog0() - errosAntes)
       + " erro(s) — algum deles esta quebrado");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
