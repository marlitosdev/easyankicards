/* UM GESTO SÓ PARA REGISTRAR — e ele acerta o tipo sozinho.
 *
 * O defeito relatado: resolver questões de um tópico que estava para
 * revisar somava as horas mas NÃO cumpria a revisão. O tópico continuava
 * cobrado na agenda dia após dia, com o tempo entrando numa conta e a
 * revisão em outra — e nada na tela dizia que as duas tinham se
 * separado.
 *
 * A causa era um valor de preenchimento: a tela de questões mandava
 * "feito: false" para o registro, e o registro respeita o que recebe.
 * "false" não era informação, era chute — e o chute estava sempre errado
 * justamente nos tópicos já estudados. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# TCE-PE | prova: 2027-06-01 | horas: 40",
  "@ Direito Financeiro :: 5",
  "+ Lei 4.320 :: 5",
  "+ Restos a pagar :: 4",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const preparar = (api) => {
    api.matIniciar(); api.edIniciar(); api.edCarregarLista();
    api.edCriar("TCE-PE", EDITAL);
    api.$("editalTexto").value = EDITAL;
    api.$("edHoras").value = 40;
    api.$("edProva").value = "2027-06-01";
    return api.matChave("Direito Financeiro", "Lei 4.320");
  };

  /* ---- G1: tópico novo abre como ESTUDO ---- */
  {
    const { api } = rodar();
    preparar(api);
    api.edProgressoPor({});
    api.abrirRegistro({ nome: "Lei 4.320", disciplina: "Direito Financeiro",
      chave: api.matChave("Direito Financeiro", "Lei 4.320"), minutos: 30 });

    ok(api.$("dlgRegistro").open === true, "G1 a janela de registro nao abriu");
    ok(api.regTipoAtual() === "feito",
       "G1b topico nunca estudado devia abrir como estudo: " + api.regTipoAtual());
    /* O BOTÃO DIZ O QUE VAI FAZER — decisao silenciosa vira informacao */
    ok(/estudo/i.test(api.$("btnRegEstudo").textContent || ""),
       "G1c o botao nao diz que vai lancar estudo: "
       + api.$("btnRegEstudo").textContent);
    /* e o segundo botao oferece o OUTRO tipo, nao repete o mesmo */
    ok(/revis/i.test(api.$("btnRegOutro").textContent || ""),
       "G1d o botao de excecao nao oferece a revisao: "
       + api.$("btnRegOutro").textContent);
  }

  /* ---- G2: tópico já estudado abre como REVISÃO ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.edProgressoPor({ [ch]: { e: "feito", d: "2026-08-01" } });
    api.abrirRegistro({ nome: "Lei 4.320", disciplina: "Direito Financeiro",
      chave: ch, minutos: 30 });

    ok(api.regTipoAtual() === "revisado",
       "G2 topico ja estudado devia abrir como revisao: " + api.regTipoAtual());
    ok(/revis/i.test(api.$("btnRegEstudo").textContent || ""),
       "G2b o botao principal nao diz que vai lancar revisao: "
       + api.$("btnRegEstudo").textContent);
    /* A FORMA ACOMPANHA: um lançamento de revisão que chega com
     * "leitura" marcada e nada de "revisão" conta o tempo na conta
     * errada. */
    ok((api.regFormasAtual() || []).indexOf("revisao") >= 0,
       "G2c a forma 'revisao' nao veio marcada: "
       + JSON.stringify(api.regFormasAtual()));

    /* DOIS BOTÕES VIRARAM UM. O app ja sabe se o topico e novo ou esta
     * para revisar; perguntar isso a pessoa e transferir para ela uma
     * classificacao que o plano faz melhor — e errar aqui nao dava aviso
     * nenhum. */
    const html = require("fs").readFileSync(
      require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(html.indexOf('id="btnRegRevisao"') < 0,
       "G2d o segundo botao de registrar voltou ao rodape");
    ok(html.indexOf('id="btnRegOutro"') >= 0,
       "G2e sumiu a saida para quem discorda do app");
  }

  /* ---- G3: discordar do app continua possível ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.edProgressoPor({ [ch]: { e: "feito", d: "2026-08-01" } });
    api.abrirRegistro({ nome: "Lei 4.320", disciplina: "Direito Financeiro",
      chave: ch, minutos: 30 });

    ok(api.regTipoAtual() === "revisado", "G3 premissa: devia abrir em revisao");
    /* reler um topico que voce mal viu e estudo novo, nao revisao — e a
     * pessoa e quem sabe disso */
    api.$("btnRegOutro").onclick();
    ok(api.regTipoAtual() === "feito",
       "G3b o botao de excecao nao trocou o tipo: " + api.regTipoAtual());
    ok(/estudo/i.test(api.$("btnRegEstudo").textContent || ""),
       "G3c o botao principal nao acompanhou a troca: "
       + api.$("btnRegEstudo").textContent);
    /* E A FORMA ACOMPANHA. Quem clica aqui esta declarando "esta sessao
     * foi da outra natureza"; manter "leitura" marcada num lancamento de
     * revisao mandaria o tempo para a conta errada — e essa divergencia
     * ninguem percebe depois. */
    ok((api.regFormasAtual() || []).indexOf("leitura") >= 0,
       "G3c2 virou estudo e a forma continuou 'revisao': "
       + JSON.stringify(api.regFormasAtual()));

    api.$("btnRegOutro").onclick();
    ok(api.regTipoAtual() === "revisado", "G3d nao voltou ao tipo original");
    ok((api.regFormasAtual() || []).indexOf("revisao") >= 0,
       "G3e voltou para revisao e a forma continuou 'leitura': "
       + JSON.stringify(api.regFormasAtual()));
  }

  /* ---- G4: o defeito relatado — questões de um tópico em revisão ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.edProgressoPor({ [ch]: { e: "feito", d: "2026-08-01" } });

    api.qsAplicar([
      { tipo: "ce", enunciado: "Pertencem ao exercício as receitas nele "
          + "arrecadadas.", gabarito: "C", disciplina: "Direito Financeiro",
        topico: "Lei 4.320", chave: ch },
    ]);
    api.qsSessaoIniciar(api.qsTodas());
    api.qsResponder("C");
    api.qsUiRegistrarEstudo();

    ok(api.$("dlgRegistro").open === true,
       "G4 o registro por questoes nao abriu");
    /* AQUI ESTAVA O DEFEITO: a tela de questoes mandava "feito: false", o
     * registro respeitava, e a sessao entrava como estudo novo. O tempo
     * somava; a revisao continuava pendente. */
    ok(api.regTipoAtual() === "revisado",
       "G4b resolver questoes de um topico em revisao abriu como estudo novo — "
       + "o tempo entra e a revisao nunca se cumpre");
    ok(/revis/i.test(api.$("btnRegEstudo").textContent || ""),
       "G4c o botao nao diz que vai lancar revisao: "
       + api.$("btnRegEstudo").textContent);
    /* e as questoes resolvidas chegam contadas no formulario */
    ok(String(api.$("regQFeitas").value || "") === "1",
       "G4d as questoes respondidas nao chegaram no registro: "
       + api.$("regQFeitas").value);

    /* e um topico NOVO, pelo mesmo caminho, continua entrando como
     * estudo — a correcao nao pode ter invertido o problema */
    const ch2 = api.matChave("Direito Financeiro", "Restos a pagar");
    api.qsAplicar([
      { tipo: "ce", enunciado: "Restos a pagar são despesas empenhadas e não "
          + "pagas até 31 de dezembro.", gabarito: "C",
        disciplina: "Direito Financeiro", topico: "Restos a pagar", chave: ch2 },
    ]);
    api.qsSessaoIniciar(api.qsTodas().filter((q) => q.chave === ch2));
    api.qsResponder("C");
    api.qsUiRegistrarEstudo();
    ok(api.regTipoAtual() === "feito",
       "G4e topico novo pelo caminho das questoes virou revisao: "
       + api.regTipoAtual());
  }

  /* ---- G5: criar cartão ou questão repinta a agenda ---- */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.edProgressoPor({});
    api.hubPintarAgenda();

    const indicadores = () => {
      const box = api.$("edAgendaTopo");
      const achar = (el, saida) => {
        Array.from(el.children || []).forEach((f) => {
          if (/ed-st-crt/.test(f.className || "")) saida.push(f);
          achar(f, saida);
        });
        return saida;
      };
      return achar(box, []).length;
    };
    const antes = indicadores();

    /* O DEFEITO: gravar funcionava, e a agenda so mostrava depois de um
     * F5. Quem nao sabe disso conclui que a gravacao falhou e refaz o
     * trabalho — duas vezes o mesmo esforco, com o app dizendo que nada
     * aconteceu. */
    api.matGravarCartoes(ch, "Pergunta :: Resposta :: fin",
      { disciplina: "Direito Financeiro", topico: "Lei 4.320" });

    ok(indicadores() > antes,
       "G5 criar um cartao nao acendeu o indicador na agenda sem F5 ("
       + antes + " -> " + indicadores() + ")");

    /* A MUDANÇA TEM DE SER PERCEBIDA: um indicador que acende sem
     * transicao, numa lista de dez linhas, acende fora do campo de visao
     * e e como se nao tivesse acendido.
     *
     * O setTimeout do stub roda NA HORA — entao o pisca seria posto e
     * retirado no mesmo instante, e o teste nunca veria o estado
     * intermediario, que e justamente o que a pessoa ve. Segurar as
     * chamadas adiadas e o que permite olhar para ele. */
    const box = api.$("edAgendaTopo");
    const achaPisca = (el, saida) => {
      Array.from(el.children || []).forEach((f) => {
        if (/ed-piscou/.test(f.className || "")) saida.push(f);
        achaPisca(f, saida);
      });
      return saida;
    };
    api.segurarAdiados();
    api.hubPiscarLinha(ch);
    ok(achaPisca(box, []).length > 0,
       "G5b a linha que mudou nao piscou — a mudanca passa despercebida");
    /* e o pisca SAI depois: destaque permanente deixaria a lista inteira
     * marcada ao fim de uma sessao de estudo */
    api.soltarAdiados();
    ok(achaPisca(api.$("edAgendaTopo"), []).length === 0,
       "G5b2 o pisca ficou preso na linha — vira destaque permanente");

    /* e pisca a linha CERTA, nao qualquer uma */
    api.segurarAdiados();
    api.hubPiscarLinha("disciplina que nao existe›topico nenhum");
    ok(achaPisca(api.$("edAgendaTopo"), []).length === 0,
       "G5b3 piscou uma linha que nao tem nada a ver com a mudanca");
    api.soltarAdiados();

    /* e a chave fica na linha: e o que permite reencontra-la depois da
     * repintura, para piscar exatamente a que mudou */
    const linhas = [];
    const achaLinhas = (el) => Array.from(el.children || []).forEach((f) => {
      if (/(^| )ed-item( |$)/.test(f.className || "")) linhas.push(f);
      achaLinhas(f);
    });
    achaLinhas(box);
    ok(linhas.some((l) => l.dataset && l.dataset.chave),
       "G5c as linhas da agenda nao carregam a chave do topico");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
