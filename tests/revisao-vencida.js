/* A REVISÃO VENCIDA APARECIA COM CARA DE TRABALHO FEITO.
 *
 * A classe "feito" é verdadeira para uma revisão pendente — o tópico JÁ
 * foi estudado —, e é dela que vem o risco no nome e o desbotado. Então
 * o item que mais precisa de atenção na semana chegava à tela riscado,
 * apagado e com um "✓" verde ao lado: exatamente o desenho de quem já
 * saiu da lista.
 *
 * Quem olha conclui que está tudo certo. E quem registra o estudo e vê a
 * linha continuar ali, riscada como estava, conclui que o registro não
 * funcionou — quando o que não funcionava era a linha dizer a verdade.
 *
 * Aqui ficam as duas coisas: o que a tela mostra enquanto a revisão está
 * pendente, e o que acontece com ela depois de registrada. */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(
  path.join(__dirname, "..", "docs", "index.html"), "utf8");

const CHAVE = "direito financeiro›leis orçamentárias";

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const daqui = (d) => {
    const x = new Date(Date.now() + d * 86400000);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0")
      + "-" + String(x.getDate()).padStart(2, "0");
  };
  const itens = (el, out) => {
    Array.from(el.children || []).forEach((f) => {
      if (/(^| )ed-item( |$)/.test(f.className || "")) out.push(f);
      itens(f, out);
    });
    return out;
  };
  const montar = (api, diasAtras) => {
    api.matIniciar(); api.edIniciar();
    const ed = api.edCriar("T", [
      "# TCE | prova: " + daqui(120) + " | horas: 40",
      "@ Direito Financeiro :: 5",
      "+ Leis Orçamentárias :: 5",
      "+ Outro tópico :: 3",
    ].join("\n"));
    api.hubAbrirEdital(ed.id);
    api.$("edProva").value = daqui(120);
    if (diasAtras != null) {
      api.edProgressoPor({ [CHAVE]: { e: "feito", d: daqui(-diasAtras) } });
    }
    api.edRender(); api.hubRender();
    return ed;
  };
  const plano = (api) => api.montarPlano(
    api.lerEdital(api.$("editalTexto").value),
    { horas: 40, prova: daqui(120), feitos: api.edProgresso });
  const oItem = (api) =>
    plano(api).itens.filter((i) => i.nome === "Leis Orçamentárias")[0];
  const aLinha = (api) => itens(api.$("edAgendaTopo"), [])
    .filter((li) => /Leis Or/.test(li.textContent || ""))[0];

  /* ---- V1: a revisão vencida entra na semana ---- */
  {
    const { api } = rodar();
    montar(api, 8);
    const i = oItem(api);
    ok(i.feito === true && i.revisado === false,
       "V1-pre o estado de partida nao e 'estudado, nao revisado': "
       + JSON.stringify({ f: i.feito, r: i.revisado }));
    ok(i.ehRevisao === true && i.semana === 1,
       "V1 a revisao vencida nao entrou na semana: "
       + JSON.stringify({ ehRevisao: i.ehRevisao, semana: i.semana }));
  }

  /* ---- V2: e NÃO aparece como coisa feita ---- */
  {
    const { api } = rodar();
    montar(api, 8);
    const li = aLinha(api);
    ok(!!li, "V2-pre a linha da revisao nao esta na agenda");
    /* a classe "feito" continua verdadeira — o tópico foi estudado — e é
     * por isso que a regra de risco precisa de uma exceção explícita, em
     * vez de a linha simplesmente deixar de se declarar estudada */
    ok(/(^| )ehrev( |$)/.test((li || {}).className || ""),
       "V2 a linha nao se declara revisao: " + (li || {}).className);

    /* O RISCO É A MENTIRA. Duas regras de mesma especificidade: quem
     * vence é a última do arquivo. */
    const iFeito = HTML.indexOf(".ed-item.feito .ed-item-nome{");
    const iRev = HTML.indexOf(".ed-item.feito.ehrev .ed-item-nome{");
    ok(iRev > 0, "V2b nao ha regra tirando o risco da revisao pendente");
    ok(iRev > iFeito,
       "V2c a excecao vem ANTES da regra que ela corrige — e perde: "
       + iFeito + " vs " + iRev);
    const regra = HTML.slice(iRev, HTML.indexOf("}", iRev) + 1);
    ok(/text-decoration:none/.test(regra) && /opacity:1/.test(regra),
       "V2d a excecao nao desfaz o risco nem o desbotado: " + regra);

    /* e o sinal do botão diz o que FALTA, não o que passou */
    const txt = (li || {}).textContent || "";
    ok(txt.indexOf("↻") >= 0,
       "V2e o botao da revisao vencida nao mostra o sinal de rever: "
       + txt.slice(0, 30));
    ok(txt.indexOf("✓") < 0,
       "V2f a revisao vencida mostra o visto de concluido: " + txt.slice(0, 30));
  }

  /* ---- V3: item de fato concluído continua riscado ---- */
  {
    const { api } = rodar();
    montar(api, 8);
    api.edProgressoPor({ [CHAVE]: { e: "revisado", d: daqui(0) } });
    api.edRender(); api.hubRender();
    /* TIRAR O RISCO DE TUDO seria trocar um erro por outro: quem
     * terminou precisa ver que terminou. */
    const i = oItem(api);
    ok(i.revisado === true && !i.ehRevisao,
       "V3 o item revisado ainda se declara revisao pendente");
    ok(i.semana === undefined,
       "V3b o item revisado continua na semana: " + i.semana);
  }

  /* ---- V4: registrar revisão tira o item da semana ---- */
  {
    const { api, janela } = rodar();
    montar(api, 8);
    const i = oItem(api);
    api.abrirRegistro(i);
    api.$("regMinutos").value = 30;
    api.confirmarRegistro("revisado");

    const d = oItem(api);
    ok(d.revisado === true,
       "V4 registrar revisao nao marcou o topico como revisado");
    ok(d.semana === undefined,
       "V4b o topico revisado continua na semana: " + d.semana);
    ok(!aLinha(api) || !/↻/.test(aLinha(api).textContent || ""),
       "V4c a linha continua oferecendo rever depois de revisada");

    /* E SOBREVIVE AO RECARREGAMENTO — lido do ARMAZENAMENTO, não da
     * memória. Conferir a variável do módulo responderia "sim" mesmo com
     * a gravação desligada: ela guarda o que acabou de acontecer nesta
     * página, que é justamente o que um F5 leva embora. */
    const bruto = janela.localStorage.getItem("eac_edital_progresso");
    let guardado = {};
    try { guardado = JSON.parse(bruto || "{}"); } catch (e) { guardado = {}; }
    ok(String((guardado[CHAVE] || {}).e) === "revisado",
       "V4d a revisao nao foi gravada — some no primeiro F5: " + bruto);
  }

  /* ---- V5: registrar ESTUDO num tópico que pedia revisão ---- */
  {
    const { api } = rodar();
    montar(api, 8);
    const i = oItem(api);
    /* O BOTÃO JÁ VEM COMO REVISÃO: um tópico estudado que volta é
     * revisão, e o app sabe disso. O segundo botão existe para quem
     * discorda — reler algo que mal viu é estudo novo. */
    api.abrirRegistro(i);
    ok(api.regTipoAtual() === "revisado",
       "V5 o registro de um topico ja estudado nao veio como revisao: "
       + api.regTipoAtual());

    api.$("regMinutos").value = 30;
    api.confirmarRegistro("feito");
    const d = oItem(api);
    /* mesmo escolhendo "estudo", o item sai da semana: a data foi
     * renovada, e é a data que decide quando a revisão vence de novo */
    ok(d.semana === undefined,
       "V5b registrar estudo deixou o topico na semana: " + d.semana);
    ok(d.dias === 0,
       "V5c a data do topico nao foi renovada: " + d.dias);
  }

  /* ================================================================
   * V6: O REGISTRO VAI PARA O EDITAL DONO DA LINHA
   *
   * A agenda do topo junta a semana de TODOS os editais ativos; o
   * edProgresso é de UM só — o aberto. Registrar uma linha do edital B
   * enquanto o A estava aberto escrevia no progresso do A: a linha de B
   * nunca saía da agenda, por mais vezes que se registrasse, e o A
   * ganhava calado um tópico "revisado" que ninguém estudou lá.
   *
   * O registro dizia "revisado: Leis Orçamentárias" todas as vezes. E
   * todas as vezes era no edital errado.
   * ============================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const txt = (nome) => [
      "# " + nome + " | prova: " + daqui(120) + " | horas: 40",
      "@ Direito Financeiro :: 5",
      "+ Leis Orçamentárias :: 5",
    ].join("\n");
    const A = api.edCriar("A", txt("A"));
    const B = api.edCriar("B", txt("B"));
    /* só B tem o tópico estudado há 8 dias: é dele a revisão vencida */
    B.progresso = { [CHAVE]: { e: "feito", d: daqui(-8) } };
    api.edSalvarLista();
    api.hubAbrirEdital(A.id);
    api.hubRender();

    const li = itens(api.$("edAgendaTopo"), [])
      .filter((x) => /(^| )ehrev( |$)/.test(x.className || ""))[0];
    ok(!!li, "V6-pre a revisao vencida de B nao apareceu na agenda");
    const btn = Array.from((li || {}).children || [])
      .filter((c) => /ed-reg/.test(c.className || ""))[0];
    ok(!!btn, "V6-pre2 a linha nao tem botao de registrar");
    if (btn) {
      btn.onclick({ stopPropagation: () => {} });
      api.$("regMinutos").value = 30;
      api.confirmarRegistro("revisado");
    }

    const pega = (id) => (api.editaisLista()
      .filter((e) => String(e.id) === String(id))[0] || {}).progresso || {};
    ok(String((pega(B.id)[CHAVE] || {}).e) === "revisado",
       "V6 a marca nao foi para o edital DONO da linha: "
       + JSON.stringify(pega(B.id)));
    /* E NÃO PODE SUJAR O VIZINHO: um "revisado" no edital aberto é um
     * tópico que a pessoa nunca estudou lá, contando como progresso. */
    ok(!pega(A.id)[CHAVE],
       "V6b o edital aberto ganhou um progresso que nao e dele: "
       + JSON.stringify(pega(A.id)));

    /* E A LINHA TEM DE SUMIR DA TELA NA HORA.
     *
     * Gravar no lugar certo e deixar a linha ali é a mesma queixa de
     * antes: quem registra e continua vendo o item conclui que não
     * pegou, e registra de novo. Quem repinta a agenda do topo é o
     * hubRender — e com a marca num edital que NÃO é o aberto, o
     * edRender do aberto não muda nada na tela. */
    const aindaLa = itens(api.$("edAgendaTopo"), [])
      .filter((x) => /(^| )ehrev( |$)/.test(x.className || ""));
    ok(aindaLa.length === 0,
       "V6c a linha registrada continua na agenda ate o proximo F5: "
       + aindaLa.length);
  }

  /* ---- V7: o item do outro edital não é descrito pelo plano do aberto ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const A = api.edCriar("A", [
      "# A | prova: " + daqui(120) + " | horas: 40",
      "@ Direito Financeiro :: 1",
      "+ Leis Orçamentárias :: 1",
    ].join("\n"));
    const B = api.edCriar("B", [
      "# B | prova: " + daqui(120) + " | horas: 40",
      "@ Direito Financeiro :: 5",
      "+ Leis Orçamentárias :: 5",
    ].join("\n"));
    api.hubAbrirEdital(A.id);
    api.hubRender();
    /* MESMO NOME, OUTRO CONCURSO. O plano do aberto descreveria um
     * tópico homônimo — peso 1 em vez de 5 — e o registro sairia com os
     * números do vizinho. */
    api.abrirRegistro({ nome: "Leis Orçamentárias",
      disciplina: "Direito Financeiro", chave: CHAVE, edital: B.id,
      minutos: 30, peso: 5, disciplinaPeso: 5 });
    ok(String(api.regAtualTeste().edital) === String(B.id),
       "V7 o registro perdeu de qual edital veio a linha: "
       + JSON.stringify(api.regAtualTeste().edital));
    ok(api.regAtualTeste().peso === 5,
       "V7b o item foi descrito pelo plano do edital aberto: peso "
       + api.regAtualTeste().peso);
  }

  /* ================================================================
   * V7: O DIA É O DO RELÓGIO DE QUEM ESTUDA
   *
   * hojeISO() usava toISOString(), que devolve o dia em UTC. No Brasil
   * (UTC-3), TODO REGISTRO FEITO DEPOIS DAS 21H saía datado de amanhã —
   * e quem estuda para concurso estuda à noite.
   *
   * O estrago é composto e silencioso: a sessão aparece no diário num
   * dia que ainda não chegou, a revisão passa a contar da data errada, e
   * "há quantos dias estudei" fica NEGATIVO, o que nenhuma tela espera.
   * A suíte só pegou isto porque rodou às 22h35 de um fuso negativo —
   * antes disso, passava o dia inteiro.
   * ============================================================== */
  {
    const { api } = rodar();
    const agora = new Date();
    const local = agora.getFullYear() + "-"
      + String(agora.getMonth() + 1).padStart(2, "0") + "-"
      + String(agora.getDate()).padStart(2, "0");
    ok(api.hojeISO() === local,
       "V7 o dia gravado nao e o do relogio de quem estuda: "
       + api.hojeISO() + " contra " + local);

    /* E O EFEITO: registrar agora tem de dar zero dia de idade, nunca
     * um dia negativo. É a asserção que sobrevive a qualquer fuso. */
    montar(api, null);
    const i = oItem(api);
    api.abrirRegistro(i);
    api.$("regMinutos").value = 30;
    api.confirmarRegistro("feito");
    const d = oItem(api);
    ok(d.dias === 0,
       "V7b o topico registrado agora tem idade de " + d.dias + " dia(s) — "
       + "com fuso negativo e depois das 21h isto fica em -1");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
