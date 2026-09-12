/* DE QUANDO É A BASE QUE ESTÁ CARREGADA
 *
 * A PERGUNTA QUE O SELO NÃO RESPONDIA: "salvei três vezes hoje — esta
 * que está carregada é qual das três?"
 *
 * Ele dizia "base de 04/09/2026 · há 0d". Data sem hora não distingue
 * nada dentro do mesmo dia, e "há 0d" gasta espaço para dizer "hoje" de
 * um jeito que ninguém fala. O que responde de verdade é o NOME DO
 * ARQUIVO, porque ele já traz hora e minuto e é o que aparece na pasta
 * de downloads.
 *
 * E OS DOIS BOTÕES DE GUARDAR: "Salvar na nuvem" tenta compartilhar,
 * depois escolher pasta, e — se nenhum dos dois existe — cai calado no
 * download. Num navegador sem esses recursos os dois botões faziam
 * exatamente a mesma coisa, sem nada na tela dizendo isso. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  /* bkRegravar termina num uiAlert, que fica esperando o "OK". Sem
   * fechar o diálogo, a promessa nunca resolve e o arquivo trava sem
   * imprimir nada. */
  const conduzir = async (api, promessa) => {
    let pronto = false;
    promessa.then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 12 && !pronto; i++) {
      await Promise.resolve();
      try { api._uiFechar(true); } catch (e) {}
    }
    return promessa;
  };
  const diasAtras = (d) =>
    new Date(Date.now() - d * 86400000).toISOString();

  /* ---- Q1: o selo diz a hora ---- */
  {
    const { api } = rodar();
    api.bkIniciar();
    api.bkMarcarSalvo("download", "easyankicards-20260904-2047.json");
    const selo = api.$("seloBase").textContent || "";

    /* A HORA, que é o que separa três cópias do mesmo dia. */
    ok(/\d{1,2}[:h]\d{2}/.test(selo),
       "Q1 o selo continua sem hora: " + selo);
    /* "HÁ 0D" SAIU: é a informação menos útil possível. */
    ok(!/0d/.test(selo), "Q1a o selo ainda diz 'há 0d': " + selo);
    ok(/hoje/i.test(selo),
       "Q1b salvo agora, o selo nao diz 'hoje': " + selo);

    /* O NOME DO ARQUIVO fica no título — é o que se compara com a
     * pasta de downloads. */
    ok(/easyankicards-20260904-2047/.test(api.$("seloBase").title || ""),
       "Q1c o nome do arquivo nao esta no selo: " + api.$("seloBase").title);
  }

  /* ================================================================
   * Q1c: ONTEM À NOITE NÃO É HOJE
   *
   * O defeito relatado: cópia de ontem às 20:47, olhada hoje às 15:44,
   * aparecia como "hoje, 20:47" — uma hora que ainda não tinha
   * chegado. São 19 horas de idade, e 19 horas dividido por 24 dá zero
   * dia. Mas "quanto tempo passou" não responde "que dia foi": entre os
   * dois instantes houve uma virada de meia-noite, e é isso que a
   * palavra "ontem" quer dizer.
   * ============================================================== */
  {
    const { api } = rodar();
    /* ONTEM, uma hora mais tarde no relógio do que agora: sempre menos
     * de 24 horas atrás (23h), e sempre no dia anterior — em qualquer
     * hora do dia em que este teste rode. */
    const agora = new Date();
    const ontemTarde = new Date(agora.getTime() - 23 * 3600000);
    const horas = (agora.getTime() - ontemTarde.getTime()) / 3600000;
    ok(horas < 24,
       "Q1c-pre o cenario tem 24h ou mais e a divisao por 24 ja acertaria "
       + "sozinha: " + horas + "h");
    ok(ontemTarde.getDate() !== agora.getDate(),
       "Q1c-pre2 o cenario caiu no mesmo dia do calendario e nao "
       + "reproduz o defeito");

    ok(api.bkDiasDeCalendario(ontemTarde.toISOString()) === 1,
       "Q1c 23 horas atras, do outro lado da meia-noite, nao foi contado "
       + "como um dia: " + api.bkDiasDeCalendario(ontemTarde.toISOString()));

    const txt = api.bkQuandoCurto(ontemTarde.toISOString(), 0);
    ok(/ontem/i.test(txt),
       "Q1c2 uma copia de ontem a noite aparece como sendo de hoje: " + txt);
    ok(!/hoje/i.test(txt),
       "Q1c3 o texto ainda diz 'hoje' para uma copia de ontem: " + txt);

    /* E O CONTRÁRIO: cedo de HOJE continua sendo hoje, mesmo com muitas
     * horas de diferença. */
    const hojeCedo = new Date(agora);
    hojeCedo.setHours(0, 5, 0, 0);
    ok(api.bkDiasDeCalendario(hojeCedo.toISOString()) === 0,
       "Q1c4 uma copia da madrugada de hoje foi contada como de ontem");
    ok(/hoje/i.test(api.bkQuandoCurto(hojeCedo.toISOString(), 9)),
       "Q1c5 uma copia de hoje nao e reconhecida como de hoje: "
       + api.bkQuandoCurto(hojeCedo.toISOString(), 9));

    /* A CONTA NÃO PODE VIR DE FORA. Quem chama passa a idade em horas,
     * e confiar nela foi a origem do defeito — o segundo argumento
     * acima é 9 de propósito, e a resposta certa continua "hoje". */

    /* ================================================================
     * A VIRADA DO DIA É A DO APARELHO, NÃO A DE GREENWICH.
     *
     * Quem salva às 22h no Brasil está a 01h do dia seguinte em UTC.
     * Contando por UTC, essa cópia apareceria como sendo de outro dia —
     * e o defeito só se manifesta fora do fuso zero, que é justamente
     * onde este teste NÃO roda: a máquina da suíte está em UTC, e ali
     * as duas contas dão o mesmo resultado. Por isso o fuso é trocado à
     * força aqui, e devolvido logo depois. */
    const fusoAntes = process.env.TZ;
    process.env.TZ = "America/Recife";                 /* UTC-3 */
    try {
      const ontem22 = new Date(2026, 8, 4, 22, 0, 0);  /* 04/09 22h local */
      const hoje10 = new Date(2026, 8, 5, 10, 0, 0);   /* 05/09 10h local */
      ok(ontem22.getUTCDate() === 5 && hoje10.getUTCDate() === 5,
         "Q1c6-pre no fuso do teste os dois instantes nao caem no mesmo "
         + "dia UTC, e a conta por UTC nao seria distinguivel");
      ok(api.bkDiasDeCalendario(ontem22.toISOString(), hoje10.toISOString()) === 1,
         "Q1c6 22h de ontem no Brasil foi contada pelo dia de Greenwich, "
         + "e virou 'hoje': "
         + api.bkDiasDeCalendario(ontem22.toISOString(), hoje10.toISOString()));
    } finally {
      if (fusoAntes === undefined) delete process.env.TZ;
      else process.env.TZ = fusoAntes;
    }
  }

  /* ---- Q1b: ontem e dias atrás ---- */
  {
    const { api } = rodar();
    ok(/ontem/i.test(api.bkQuandoCurto(diasAtras(1), 1)),
       "Q1d um dia atras nao vira 'ontem': " + api.bkQuandoCurto(diasAtras(1), 1));
    const velho = api.bkQuandoCurto(diasAtras(9), 9);
    ok(/9d/.test(velho),
       "Q1e uma copia de nove dias nao diz quantos dias: " + velho);
    ok(/\d{1,2}[:h]\d{2}/.test(velho),
       "Q1f a copia antiga perdeu a hora: " + velho);
    /* e não diz "hoje" para o que não é de hoje */
    ok(!/hoje/i.test(velho), "Q1g uma copia de nove dias diz 'hoje': " + velho);
  }

  /* ================================================================
   * Q2: TRÊS CÓPIAS NO MESMO DIA
   *
   * O caso relatado. Cada uma tem hora e nome próprios, e a tela
   * precisa dizer qual delas está carregada.
   * ============================================================== */
  {
    const { api } = rodar();
    api.bkIniciar();
    /* TRÊS HORÁRIOS DE VERDADE.
     *
     * A primeira versão chamava bkMarcarSalvo três vezes seguidas e
     * esperava ver 09:30 e 20:47 nas linhas — mas essas horas estão no
     * NOME do arquivo, e a linha mostra quando a cópia foi feita, que é
     * o certo. Salvas no mesmo segundo, as três apareciam com a mesma
     * hora e a asserção media o relógio do teste, não a tela. */
    const emPontoDe = (h, m) => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const t0930 = emPontoDe(9, 30);
    const t1412 = emPontoDe(14, 12);
    const t2047 = emPontoDe(20, 47);
    api.bkRegistrarCopia("download", "easyankicards-20260904-0930.json", t0930);
    api.bkRegistrarCopia("download", "easyankicards-20260904-1412.json", t1412);
    api.bkRegistrarCopia("download", "easyankicards-20260904-2047.json", t2047);
    api.loja.setItem("eac_backup_em", t2047);

    const L = api.bkHistorico();
    ok(L.length === 3, "Q2 as tres copias nao foram registradas: " + L.length);
    /* A MAIS NOVA PRIMEIRO: a lista se lê de cima para baixo. */
    ok(/2047/.test(L[0].nome),
       "Q2a a copia mais nova nao esta no topo: " + L[0].nome);
    ok(api.bkCopiasNoDia(L[0].quando) === 3,
       "Q2b nao soube dizer quantas copias houve no dia: "
       + api.bkCopiasNoDia(L[0].quando));

    /* QUAL ESTÁ CARREGADA. É a pergunta inteira. */
    const at = api.bkCopiaAtual();
    ok(at && /2047/.test(at.nome),
       "Q2c nao identificou qual copia esta carregada: "
       + JSON.stringify(at));

    /* E A TELA MARCA ESSA. */
    api.bkPintarHistorico();
    const cx = api.$("bkHist");
    ok(cx.hidden === false,
       "Q2d com tres copias a lista continua escondida");
    const linhas = (cx.children || [])
      .filter((x) => /bk-hist-li/.test(x.className || ""));
    ok(linhas.length === 3,
       "Q2e a lista nao mostra as tres: " + linhas.length);
    const atuais = linhas.filter((x) => /atual/.test(x.className || ""));
    ok(atuais.length === 1,
       "Q2f a lista nao marca exatamente uma como carregada: "
       + atuais.length);
    ok(/2047/.test(atuais[0].textContent || ""),
       "Q2g marcou a copia errada como carregada: " + atuais[0].textContent);
    /* cada linha traz a HORA, senão a lista tem o mesmo defeito do selo */
    /* TRÊS HORAS DIFERENTES — que é a propriedade que interessa, e a
     * única que não depende do formato de relógio do aparelho: aqui o
     * simulador escreve "08:47 PM", num celular brasileiro sairia
     * "20:47", e cravar um dos dois seria testar a locale. */
    const horas = linhas.map((li) => {
      const b = (li.children || []).filter((x) => x.tag === "b")[0];
      return (b && b.textContent) || "";
    });
    ok(horas.every((h) => /\d{1,2}[:h]\d{2}/.test(h)),
       "Q2h alguma linha ficou sem hora: " + JSON.stringify(horas));
    ok(new Set(horas).size === 3,
       "Q2i as tres copias do mesmo dia aparecem com a mesma hora — que "
       + "era exatamente o defeito do selo: " + JSON.stringify(horas));
  }

  /* ---- Q2b: com uma cópia só, a lista não aparece ---- */
  {
    const { api } = rodar();
    api.bkIniciar();
    api.bkMarcarSalvo("download", "um-arquivo.json");
    api.bkPintarHistorico();
    /* A linha do "último backup" acima já disse tudo; uma lista de um
     * item só é ruído. */
    ok(api.$("bkHist").hidden === true,
       "Q2i com uma copia so a lista aparece assim mesmo");
  }

  /* ================================================================
   * Q3: OS DOIS BOTÕES DE GUARDAR
   * ============================================================== */
  {
    const { api } = rodar();
    /* NAVEGADOR SEM NADA: só download. Dois botões que fazem a mesma
     * coisa, um deles prometendo "nuvem", é pior do que um botão. */
    ok(api.bkModoDeGuardar() === "download",
       "Q3-pre o simulador anuncia recursos que nao tem: "
       + api.bkModoDeGuardar());
    api.bkIniciar();
    api.bkPintarBotoes();
    ok(api.$("btnBkSalvarNuvem").hidden === true,
       "Q3 num navegador que so baixa, 'salvar na nuvem' continua na tela "
       + "fazendo exatamente o que o outro botao faz");
    ok(api.$("btnBkBaixar").hidden !== true,
       "Q3a sumiu tambem o botao que funciona");
    /* e o texto explica POR QUE há um botão só */
    ok(/download/i.test(api.$("bkGuardarExp").textContent || ""),
       "Q3b o texto nao explica o que este navegador faz: "
       + api.$("bkGuardarExp").textContent);

    /* COM SELETOR DE PASTA: dois botões, e cada um diz outra coisa. */
    api.porSeletorDePasta(() => {});
    ok(api.bkModoDeGuardar() === "pasta",
       "Q3c com seletor de pasta o modo nao mudou: " + api.bkModoDeGuardar());
    api.bkPintarBotoes();
    ok(api.$("btnBkSalvarNuvem").hidden === false,
       "Q3d com seletor de pasta o segundo botao nao apareceu");
    const a = (api.$("btnBkSalvarNuvem").textContent || "").toLowerCase();
    const b = (api.$("btnBkBaixar").textContent || "").toLowerCase();
    ok(a && b && a !== b,
       "Q3e os dois botoes voltaram a dizer a mesma coisa: " + a + " / " + b);
  }

  /* ---- Q4: regravar no mesmo arquivo ---- */
  {
    const { api } = rodar();
    api.bkIniciar();
    api.bkPintarBotoes();
    /* SEM PASTA ESCOLHIDA não há o que regravar. */
    ok(api.$("btnBkRegravar").hidden === true,
       "Q4 'regravar' aparece antes de haver uma pasta escolhida");

    let escrito = "";
    api.bkPorPasta({ name: "Backups do Drive",
      createWritable: async () => ({
        write: async (x) => { escrito = x; }, close: async () => {} }) });
    api.bkPintarBotoes();
    ok(api.$("btnBkRegravar").hidden === false,
       "Q4a com pasta escolhida, 'regravar' nao apareceu");
    /* O NOME DA PASTA NO BOTÃO: regravar sem dizer onde é pedir fé. */
    ok(/Backups do Drive/.test(api.$("btnBkRegravar").textContent || ""),
       "Q4b o botao nao diz em que pasta vai regravar: "
       + api.$("btnBkRegravar").textContent);

    await conduzir(api, api.bkRegravar());
    ok(escrito && escrito.indexOf("EasyAnkiCards") >= 0,
       "Q4c regravar nao escreveu o backup: " + String(escrito).slice(0, 40));
    /* E CONTA COMO CÓPIA, com o nome da pasta. */
    const L = api.bkHistorico();
    ok(L.length && /Backups do Drive/.test(L[0].nome || ""),
       "Q4d a regravacao nao entrou no historico: " + JSON.stringify(L[0]));
  }

  /* ---- Q5: o histórico não vai no backup ---- */
  {
    const { api } = rodar();
    /* Ele é sobre ESTE aparelho: quais arquivos existem na pasta de
     * downloads daqui. Levado para outro computador, apontaria para
     * arquivos que não estão lá. */
    ok(JSON.stringify(api.gruposBackup || {}).indexOf("eac_backup_hist") < 0,
       "Q5 o historico de copias entrou no backup, e vai apontar para "
       + "arquivos que nao existem no outro aparelho");
  }

  /* ==============================================================
   * B10: A CONFERÊNCIA MOSTRA TUDO O QUE ESTÁ SENDO TROCADO
   *
   * Escolher qual arquivo restaurar é o momento mais perigoso do
   * aplicativo: a decisão é irreversível na prática, e é tomada olhando
   * uma tabela. Ela listava cartões, editais, tópicos e resumos — e
   * calava sobre TRÊS acervos inteiros que estão no backup desde que
   * foram criados: questões, lei seca e jurisprudência.
   *
   * Dava para trocar uma base com 8 julgados e 5 leis por outra com
   * zero sem que uma linha da tela mencionasse julgados ou leis. O dado
   * não se perdia por falta de backup — perdia-se por falta de aviso.
   * ============================================================== */
  {
    const { api } = rodar();
    const bk = { app: "EasyAnkiCards", gerado: new Date().toISOString(),
      dados: {
        cartoes: { eac_texto: "frente :: verso" },
        edital: { eac_juris: JSON.stringify({ a: {}, b: {}, c: {} }) },
        material: {
          eac_questoes: JSON.stringify([1, 2, 3, 4, 5]),
          eac_leis: JSON.stringify({
            l1: { nome: "X", texto: "Art. 1º a\nArt. 2º b\nArt. 3º c" },
            l2: { nome: "Y", texto: "Art. 1º z" },
          }),
        },
      } };
    const c = api.compararBackup(bk);
    const acha = (k) => c.linhas.filter((l) => l.chave === k)[0];

    ok(acha("questoes") && acha("questoes").backup === 5,
       "B10 as QUESTÕES não aparecem na conferência: dá para trocar uma "
       + "base de 500 questões por uma de zero sem a tela dizer nada");
    ok(acha("juris") && acha("juris").backup === 3,
       "B10a os JULGADOS não aparecem na conferência: "
       + JSON.stringify(acha("juris")));
    ok(acha("leis") && acha("leis").backup === 2,
       "B10b as LEIS não aparecem na conferência: "
       + JSON.stringify(acha("leis")));
    ok(acha("artigos") && acha("artigos").backup === 4,
       "B10c os ARTIGOS não são contados: “2 leis” não distingue dois "
       + "artigos colados às pressas de dois códigos inteiros, e é essa "
       + "diferença que se quer ver comparando dois arquivos: "
       + JSON.stringify(acha("artigos")));
  }

  /* ==============================================================
   * B11: UM ARQUIVO ANTIGO NÃO PODE MOSTRAR ZERO
   *
   * O backup grava um "resumo" de si mesmo — feito pela versão que o
   * gerou, que não conhecia lei seca nem julgados. Se a conferência
   * confiasse nesse resumo, as linhas novas mostrariam ZERO num arquivo
   * que tem os dados lá dentro. E zero na coluna do backup é lido como
   * "você vai perder tudo isso" — o oposto exato da verdade, na tela em
   * que a pessoa decide se restaura.
   * ============================================================== */
  {
    const { api } = rodar();
    const bk = { app: "EasyAnkiCards", gerado: new Date().toISOString(),
      /* o resumo VELHO, sem os campos novos — como num arquivo de 2025 */
      resumo: { cartoes: 1, resumos: 0 },
      dados: {
        edital: { eac_juris: JSON.stringify({ a: {}, b: {} }) },
        material: { eac_questoes: JSON.stringify([1, 2, 3]) },
      } };
    const c = api.compararBackup(bk);
    const acha = (k) => c.linhas.filter((l) => l.chave === k)[0];
    ok(acha("juris") && acha("juris").backup === 2,
       "B11 a conferência acreditou no resumo gravado dentro do arquivo "
       + "em vez de contar os dados: um backup gerado por uma versão "
       + "antiga mostra ZERO julgados, e zero ali se lê como “vai "
       + "perder todos”: " + JSON.stringify(acha("juris")));
    ok(acha("questoes") && acha("questoes").backup === 3,
       "B11a idem para as questões: " + JSON.stringify(acha("questoes")));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
