/* AS SEIS CORES DE MARCA — listar, contar, trocar e tirar.
 *
 * O DEFEITO: MAT_PREFIXO_RE não tinha entrada para "destaque", e a linha
 * que a lê terminava em `|| "\\?"`. Um valor de reserva que PARECE certo
 * e é de outra coisa: o "\\?" é o prefixo da DÚVIDA. Então
 * matMarcasDe("destaque") devolvia a lista das dúvidas.
 *
 * A partir daí tudo o que depende dessa lista errou em silêncio: o
 * contador da barra contava dúvidas, e o menu da marca não achava o item
 * correspondente — caía no plano B, que remonta o trecho a partir do
 * texto RENDERIZADO da tela. Renderizado quer dizer sem o "**" do
 * negrito; procurar esse texto no fonte não acha nada, e a resposta era
 * "não consegui achar este trecho para tirar a marca", numa marca que
 * estava bem ali na tela.
 *
 * Um destaque, uma vez posto, não saía mais. */
const { rodar } = require("./fumaca.js");

const TIPOS = ["destaque", "importante", "duvida", "prova", "pegadinha", "lei"];

const TEXTO = [
  "Abre com ==um destaque simples== no meio da linha.",
  "",
  "Aqui vem ==!o importante==, a ==?duvida==, o ==*que caiu==,",
  "a ==~pegadinha== e o ==§artigo da lei==.",
  "",
  "A tese: ==a União **pode conceder** isenções sem compensar==.",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("Direito Financeiro", "Receita pública");
    api.matGravar(ch, TEXTO,
      { disciplina: "Direito Financeiro", topico: "Receita pública" });
    return { api, ch };
  };
  const doTopico = (api, ch, tp) =>
    api.matMarcasDe(tp).filter((m) => m.chave === ch);

  /* ---- M1: cada cor lista as SUAS marcas ---- */
  {
    const { api, ch } = montar();
    const esperado = { destaque: 2, importante: 1, duvida: 1,
                       prova: 1, pegadinha: 1, lei: 1 };
    TIPOS.forEach((tp) => {
      const l = doTopico(api, ch, tp);
      ok(l.length === esperado[tp],
         "M1 " + tp + ": esperava " + esperado[tp] + " marca(s), veio "
         + l.length + " → " + JSON.stringify(l.map((x) => x.trecho.slice(0, 30))));
    });
  }

  /* ---- M2: uma cor não pode devolver a marca de outra ---- */
  {
    const { api, ch } = montar();
    /* ERA ESTE O DEFEITO, e ele é invisível de fora: a lista tinha o
     * tamanho certo, só que com o conteúdo de outra cor. */
    const d = doTopico(api, ch, "destaque").map((x) => x.trecho);
    ok(d.join(" | ").indexOf("duvida") < 0,
       "M2 a lista de destaque trouxe a duvida: " + d.join(" | "));
    ok(d.some((x) => /destaque simples/.test(x)),
       "M2b o destaque de verdade nao esta na lista dele: " + d.join(" | "));
    ok(d.some((x) => /pode conceder/.test(x)),
       "M2c o destaque com negrito dentro ficou de fora: " + d.join(" | "));

    /* e o inverso: o prefixo vazio do destaque não pode engolir as outras */
    const marcados = {};
    TIPOS.forEach((tp) => doTopico(api, ch, tp).forEach((m) => {
      marcados[m.trecho] = (marcados[m.trecho] || 0) + 1;
    }));
    const repetidos = Object.keys(marcados).filter((k) => marcados[k] > 1);
    ok(!repetidos.length,
       "M2d o mesmo trecho aparece em mais de uma cor: " + repetidos.join(" | "));
  }

  /* ---- M3: o contador da barra conta a cor certa ---- */
  {
    const { api, ch } = montar();
    ok(api.matContarMarcas("prova", ch) === 1,
       "M3 contou " + api.matContarMarcas("prova", ch) + " marcas de prova");
    ok(api.matContarMarcas("destaque", ch) === 2,
       "M3b contou " + api.matContarMarcas("destaque", ch) + " destaques");
  }

  /* ---- M4: TIRAR funciona nas seis cores ---- */
  {
    TIPOS.forEach((tp) => {
      const { api, ch } = montar();
      const m = doTopico(api, ch, tp)[0];
      ok(!!m, "M4-pre " + tp + ": nao ha marca para tirar");
      if (!m) return;
      ok(api.matTirarMarcaDe(m) === true,
         "M4 " + tp + ": tirar a marca falhou");
      /* SUMIR DA LISTA não basta: o texto tem de ficar sem os sinais e
       * COM as palavras. Tirar a marca levando a frase junto seria pior
       * do que não tirar. */
      const depois = doTopico(api, ch, tp);
      ok(depois.length === (tp === "destaque" ? 1 : 0),
         "M4b " + tp + ": a marca continua na lista depois de tirada");
      const txt = api.matTextoVivo(ch, "texto");
      const palavras = String(m.trecho).replace(/\*\*/g, "").slice(0, 18);
      ok(txt.indexOf(palavras) >= 0,
         "M4c " + tp + ": tirar a marca apagou o texto junto: " + palavras);
    });
  }

  /* ---- M5: o destaque com NEGRITO dentro sai ---- */
  {
    const { api, ch } = montar();
    const m = doTopico(api, ch, "destaque")
      .filter((x) => /pode conceder/.test(x.trecho))[0];
    ok(!!m, "M5-pre o destaque com negrito nao foi encontrado");
    if (m) {
      /* O PLANO B remontava o trecho a partir do texto da TELA, que vem
       * sem os "**". Procurar esse texto no fonte não acha nada — e era
       * exatamente esta marca que não saía. */
      ok(api.matTirarMarcaDe(m) === true,
         "M5 a marca com negrito dentro nao saiu");
      const txt = api.matTextoVivo(ch, "texto");
      ok(/a União \*\*pode conceder\*\* isenções/.test(txt),
         "M5b o negrito de dentro da marca se perdeu: " + txt.slice(-90));
      ok(txt.indexOf("==a União") < 0, "M5c sobrou o sinal de marca");
    }
  }

  /* ---- M6: trocar de cor, e a marca continua sendo tirável ---- */
  {
    TIPOS.filter((x) => x !== "destaque").forEach((tp) => {
      const { api, ch } = montar();
      const m = doTopico(api, ch, tp)[0];
      if (!m) { ok(false, "M6-pre " + tp + ": sem marca"); return; }
      const antes = String(m.trecho);
      ok(api.matTrocarCorDaMarca(m, "destaque") === true,
         "M6 " + tp + " → destaque: a troca falhou");
      /* A MARCA MUDA DE LISTA. Continuar na antiga significaria dois
       * lugares dizendo coisas diferentes sobre a mesma marca. */
      ok(!doTopico(api, ch, tp).some((x) => x.trecho === antes),
         "M6b " + tp + ": depois de trocar, continua na lista antiga");
      /* PROCURADA NOS PEDAÇOS, não no trecho inteiro: marcas em linhas
       * vizinhas se juntam num item só (uma seleção = uma marca), então
       * a recém-chegada pode ter virado mais um pedaço de um destaque
       * que já existia. */
      const nova = doTopico(api, ch, "destaque")
        .filter((x) => (x.pedacos || [x.trecho]).indexOf(antes) >= 0)[0];
      ok(!!nova, "M6c " + tp + ": nao apareceu na lista da cor nova; ha "
         + JSON.stringify(doTopico(api, ch, "destaque")
             .map((x) => x.pedacos || [x.trecho])));

      /* E TEM DE SAIR DEPOIS DE TROCADA — foi assim que o defeito
       * apareceu: marcar de importante, trocar para destaque, e a marca
       * ficar presa no texto para sempre. */
      if (nova) {
        ok(api.matTirarMarcaDe(nova) === true,
           "M6d " + tp + " → destaque: depois de trocar, nao sai mais");
      }
    });
  }

  /* ---- M7: o objeto da marca aberta acompanha a troca ---- */
  {
    const { api, ch } = montar();
    const m = doTopico(api, ch, "importante")[0];
    api.matTrocarCorDaMarca(m, "prova");
    /* O MENU segura o MESMO objeto. Deixá-lo com a cor velha faz a ação
     * seguinte — tirar, trocar de novo — procurar pelo sinal errado. */
    ok(m.tipo === "prova",
       "M7 o objeto da marca ficou com a cor velha: " + m.tipo);
    ok(api.matTirarMarcaDe(m) === true,
       "M7b tirar logo depois de trocar, no mesmo objeto, falhou");
  }

  /* ---- M8: nenhuma cor pode ficar sem o seu prefixo ---- */
  {
    const { api } = rodar();
    /* A CAUSA-RAIZ, e a única asserção que impede a volta dela: um tipo
     * novo em MAT_MARCAS sem entrada correspondente no reconhecedor
     * volta a cair no valor de reserva e a listar a cor errada — em
     * silêncio, que é o que torna isto caro. */
    const marcas = api.MAT_MARCAS, porSinal = api.MAT_TIPO_POR_SINAL;
    Object.keys(marcas).forEach((tp) => {
      const sinal = String(marcas[tp]).slice(2);
      ok(porSinal[sinal] === tp,
         "M8 a cor \"" + tp + "\" (sinal \"" + sinal + "\") nao e reconhecida: "
         + porSinal[sinal]);
    });
    ok(Object.keys(porSinal).length === Object.keys(marcas).length,
       "M8b duas cores dividem o mesmo sinal: " + JSON.stringify(porSinal));

    /* E A VARREDURA NÃO PODE LER UM FECHA COMO UM ABRE — o pedaço entre
     * duas marcas nunca foi marcado por ninguém. */
    const achados = api.matVarrerMarcas("a ==?uma== e ==*outra== fim");
    ok(achados.length === 2,
       "M8c a varredura achou " + achados.length + " marcas onde ha 2: "
       + JSON.stringify(achados.map((x) => x.tipo + ":" + x.bruto)));
    ok(!achados.some((x) => /^\s*e\s*$/.test(x.bruto)),
       "M8d o vao entre duas marcas virou marca: "
       + JSON.stringify(achados.map((x) => x.bruto)));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
