/* =====================================================================
 * VIGIA DE TRAVAMENTO
 *
 * Promessa que nunca resolve saía como SUCESSO: o Node esvaziava a fila de
 * eventos, ninguém imprimia nada, e o código de saída era 0. Descobri isso
 * sabotando "cancelar a gravação" — a sabotagem deixava o app esperando uma
 * resposta de modal que nunca vinha, o teste não acusava nada, e eu quase
 * registrei a sabotagem como "não detectada" quando na verdade ela tinha
 * derrubado o teste inteiro.
 *
 * Teste que trava é teste que falhou. Aqui isso passa a ter nome.
 * ===================================================================== */
function comVigia(promessa, nome, ms) {
  const limite = ms || 90000;
  let alarme;
  const vigia = new Promise((_, rejeitar) => {
    alarme = setTimeout(() => rejeitar(new Error(
      "TRAVOU: " + nome + " não terminou em " + Math.round(limite / 1000)
      + "s. Quase sempre é um uiConfirm/uiAlert esperando resposta que o "
      + "teste não deu — ou um await numa promessa que nunca resolve.")), limite);
  });
  return Promise.race([promessa, vigia]).finally(() => clearTimeout(alarme));
}

module.exports = { comVigia };
