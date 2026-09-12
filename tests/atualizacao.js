/* "SUBI OS ARQUIVOS E CONTINUA A VERSÃO ANTIGA"
 *
 * Já aconteceu duas vezes. A causa quase nunca é o código — é uma
 * destas três, e nenhuma delas aparecia na tela:
 *
 *  1. o service worker ATIVO é o antigo, e o novo está em espera;
 *  2. o próprio "sw.js" veio do cache do navegador, então nem o novo
 *     worker chegou a ser visto;
 *  3. o servidor ainda serve a versão anterior.
 *
 * Sem saber em qual delas se está, a pessoa recarrega a página dez
 * vezes — que é o gesto que não resolve nenhuma das três. O que este
 * arquivo defende é que o app DIGA em qual delas está.
 *
 * LIMITE DO SIMULADOR: não há service worker aqui. O que se testa é a
 * função que traduz um estado em frase — que é onde mora a decisão. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  {
    const { api } = rodar();
    const V = api.VERSAO;

    /* EM DIA: diz que está em dia, e não assusta ninguém. */
    const bom = api.swLinhaDiagnostico({ suporta: true, estado: "em-dia",
      ativo: V, app: V });
    ok(/em dia/i.test(bom), "A1 o estado normal nao e anunciado: " + bom);
    ok(!/[A-Z]{4,}/.test(bom.replace(/v?\d+\.\d+\.\d+/g, "")),
       "A1a o estado normal grita em maiusculas: " + bom);

    /* ESPERANDO: a versão nova já baixou e está parada. É o caso mais
     * comum, e o que a pessoa resolve com um toque. */
    const esp = api.swLinhaDiagnostico({ suporta: true, estado: "esperando",
      ativo: "16.6.0", esperando: "16.7.0", app: V });
    ok(/16\.7\.0/.test(esp) && /16\.6\.0/.test(esp),
       "A2 a frase nao diz qual versao esta esperando e qual esta "
       + "rodando: " + esp);
    ok(/esperando/i.test(esp),
       "A2a a frase nao diz que ha uma versao parada: " + esp);
    ok(/forçar atualização/i.test(esp),
       "A2b a frase nao diz o que fazer: " + esp);

    /* ATRASADO: o worker serve uma versão diferente da que este arquivo
     * é — o caso "o servidor ainda não atualizou". */
    const atr = api.swLinhaDiagnostico({ suporta: true, estado: "atrasado",
      ativo: "16.6.0", app: V });
    ok(/16\.6\.0/.test(atr),
       "A3 nao diz qual versao o worker esta servindo: " + atr);
    ok(atr.indexOf(V) >= 0,
       "A3a nao diz qual versao este arquivo e, e sem as duas nao da "
       + "para saber que estao diferentes: " + atr);

    /* OS DOIS CASOS PROBLEMÁTICOS TÊM DE SE DISTINGUIR: eles pedem
     * coisas diferentes — um é um toque, o outro é o servidor. */
    ok(esp !== atr,
       "A3b 'esperando' e 'atrasado' dizem a mesma coisa, e os dois "
       + "pedem providencias diferentes");

    /* SEM SERVICE WORKER não há o que consertar aqui, e a frase não
     * pode sugerir que há. */
    const sem = api.swLinhaDiagnostico({ suporta: false, app: V });
    ok(/não tem|nao tem/i.test(sem),
       "A4 um navegador sem service worker recebe uma frase que nao se "
       + "aplica a ele: " + sem);
    ok(!/forçar/i.test(sem),
       "A4a manda forcar atualizacao onde nao ha o que forcar: " + sem);

    /* E NENHUM ESTADO PODE CAIR NA CHAVE CRUA. t() devolve a própria
     * chave quando não acha a tradução, e aí a tela mostra
     * "sw_diag_esperando" para o usuário. */
    ["em-dia", "esperando", "atrasado", "sem-registro", "sem-controle",
     "erro"].forEach((e) => {
      const f = api.swLinhaDiagnostico({ suporta: true, estado: e,
        ativo: "1", esperando: "2", app: V });
      ok(f.indexOf("sw_diag") < 0,
         "A5 o estado '" + e + "' nao tem frase no dicionario e aparece "
         + "como nome de chave: " + f);
    });
  }

  /* ================================================================
   * A6: A FAIXA DIZ QUAL VERSÃO, E DE QUEM É A VEZ
   *
   * Os dois estados pedem coisas diferentes: uma versão que JÁ BAIXOU e
   * espera um toque seu, e um servidor que ainda não entregou nada. A
   * primeira é sua; na segunda não há botão aqui que resolva, e
   * oferecer um seria mentir sobre quem manda.
   * ============================================================== */
  {
    const { api } = rodar();

    api.mostrarBarraUpdate({ postMessage() {} }, "16.9.0");
    const b = api.$("barraUpdate");
    ok(/16\.9\.0/.test(api.$("updTitulo").textContent || ""),
       "A6 a faixa nao diz QUAL versao esta pronta: "
       + api.$("updTitulo").textContent);
    ok(/upd-pronta/.test(b.className || ""),
       "A6a a faixa da versao pronta nao tem cor propria: " + b.className);
    ok(/on\b/.test(b.className || ""), "A6b a faixa nao apareceu");

    /* O OUTRO ESTADO: e ele NÃO pode herdar a cor nem o texto do
     * primeiro, senão os dois viram a mesma coisa na tela. */
    api.mostrarBarraOrigem("16.6.0");
    ok(/16\.6\.0/.test(api.$("updTitulo").textContent || ""),
       "A6c a faixa da origem nao diz o que o servidor esta entregando: "
       + api.$("updTitulo").textContent);
    ok(/upd-origem/.test(b.className || ""),
       "A6d a faixa da origem nao tem cor propria: " + b.className);
    ok(!/upd-pronta/.test(b.className || ""),
       "A6e a faixa ficou com as duas cores ao mesmo tempo: " + b.className);
    /* E O BOTÃO NÃO PROMETE ATUALIZAR o que não depende dele. */
    ok(!/atualizar agora/i.test(api.$("btnAtualizar").textContent || ""),
       "A6f o botao promete atualizar numa situacao em que so o "
       + "servidor resolve: " + api.$("btnAtualizar").textContent);
    ok(/recarregar a página não resolve|nao resolve/i
        .test(api.$("updTexto").textContent || ""),
       "A6g o texto nao avisa que recarregar nao adianta: "
       + api.$("updTexto").textContent);

    /* E VOLTANDO ao primeiro estado, a cor da origem sai. */
    api.mostrarBarraUpdate({ postMessage() {} }, "17.0.0");
    ok(!/upd-origem/.test(b.className || ""),
       "A6h a cor da origem ficou depois de a versao nova chegar: "
       + b.className);
  }

  /* ---- A7: o sw.js nunca vem do cache do navegador ---- */
  {
    /* A TERCEIRA CAUSA, corrigida na raiz. O navegador guarda o próprio
     * "sw.js" no cache HTTP; enquanto ele estiver lá, nenhuma
     * verificação chega ao servidor. No GitHub Pages não dá para mandar
     * cabeçalho — mas dá para dizer ao navegador, no registro, que este
     * arquivo específico nunca vem do cache. */
    const fs2 = require("fs"), path2 = require("path");
    const js = fs2.readFileSync(
      path2.join(__dirname, "..", "docs", "app.js"), "utf8");
    const m = js.match(/serviceWorker\.register\([^)]*\)/);
    ok(m, "A7-pre nao achei o registro do service worker");
    ok(/updateViaCache/.test(m[0]),
       "A7 o service worker e registrado sem 'updateViaCache', entao o "
       + "proprio sw.js pode vir do cache do navegador e a atualizacao "
       + "nunca ser vista: " + m[0]);
    ok(/["']none["']/.test(m[0]),
       "A7a 'updateViaCache' esta presente mas nao e 'none': " + m[0]);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
