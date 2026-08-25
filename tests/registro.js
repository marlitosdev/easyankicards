/* =====================================================================
 * O REGISTRO E O DIAGNÓSTICO REGISTRAM MESMO? (v8.70)
 *
 * A pergunta não é se o registro existe — é se ele fala quando algo dá
 * errado. Um registro que só anota o que deu certo é um registro que
 * concorda com você e não ajuda ninguém.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const { falhas: carga, api, janela } = rodar();
  const falhas = [...carga];
  if (!api) return falhas;
  const ok = (cond, msg) => { if (!cond) falhas.push(msg); };
  const linhas = () => api.registroTexto().split("\n").filter((l) => l.trim());
  const temErro = (t) => linhas().some((l) => /\[ERRO\]/.test(l) && l.includes(t));

  /* ---- R1: gravação recusada NÃO pode falhar calada ----
   * Com o espaço cheio o app continua perfeito na tela e nao salva mais
   * nada. Sem este registro, o diagnostico de um app que parou de salvar
   * fica identico ao de um app saudavel. */
  {
    const real = janela.localStorage.setItem;
    janela.localStorage.setItem = (k) => {
      if (k === "eac_texto") { const e = new Error("cheio"); e.name = "QuotaExceededError"; throw e; }
      return real.apply(janela.localStorage, arguments.length ? arguments : [k]);
    };
    const antes = linhas().length;
    const okGrav = api.guardar("eac_texto", "conteudo que o usuario acabou de escrever");
    janela.localStorage.setItem = real;
    ok(okGrav === false, "R1 guardar() devolveu sucesso numa gravacao que falhou");
    ok(linhas().length > antes, "R2 a gravacao recusada nao gerou registro nenhum");
    ok(temErro("eac_texto"), "R3 o registro nao diz QUAL chave o app nao conseguiu gravar");
  }

  /* ---- R4: o diagnostico mostra a falha, nao so o registro ----
   * Sao dois publicos: o registro e a historia, o diagnostico e a foto. */
  {
    /* o diagnóstico é calculado sob demanda; ler sem medir devolve o texto
     * de antes — foi o que este teste pegou de mim na primeira rodada */
    await api.medirArmazenamento();
    ok(/gravações recusadas/.test(api.estadoArmazenTexto() || ""),
       "R4 o diagnostico nao tem linha de gravacoes recusadas");
    ok(/eac_texto/.test(api.estadoArmazenTexto() || ""),
       "R5 o diagnostico nao diz qual chave falhou");
  }

  /* ---- R6: acoes destrutivas do modo edital ficam registradas ----
   * Apagar um edital leva junto meses de progresso. Se isso nao entra no
   * registro, nao ha como reconstruir o que aconteceu. */
  {
    api.hubIniciar();
    const antes = linhas().length;
    const e = api.edCriar("Registro X",
      "# Registro X | prova: 2026-09-10 | horas: 10\n@ D :: 5\n+ t :: 5 :: x");
    api.hubAbrirEdital(e.id);
    const novas = linhas().slice(antes);
    ok(novas.some((l) => /\[EDITAL\]/.test(l) && /aberto/.test(l)),
       "R6 abrir um edital nao ficou registrado");
    api.hubRenomearTeste(e.id, "Registro Y");
    ok(linhas().some((l) => /renomeado/.test(l)),
       "R7 renomear um edital nao ficou registrado");
  }

  /* ---- R8: o filtro por modo continua funcionando com os eventos novos --- */
  {
    const soEdital = api.registroTexto("edital");
    ok(soEdital.length > 0, "R8 o filtro do modo edital devolveu registro vazio");
    const fora = soEdital.split("\n").filter((l) =>
      l.trim() && !/\[(EDITAL|EDITAL-TEXTO|ERRO|INICIO|ARMAZEN)\]/.test(l));
    ok(fora.length === 0,
       "R9 o filtro do modo edital deixou passar evento de outro modo: " + fora[0]);
  }

  return falhas;
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
  f.forEach((x) => console.log("  FALHA  " + x));
  console.log(f.length ? `\nregistro: ${f.length} FALHA(S)\n`
    : "\nregistro: gravacao recusada, diagnostico e eventos do edital ok (9 verificacoes)\n");
  process.exit(f.length ? 1 : 0);
  });
}
