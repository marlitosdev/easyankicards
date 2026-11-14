/* =====================================================================
 * (19.130.0) DUAS ABAS DO APP ABERTAS
 *
 * Cada aba (ou a janela do app instalado, mais uma aba do navegador) carrega os dados UMA vez e depois grava o que
 * tem na memória. Com duas abertas, a que ficou parada grava por cima do que a outra fez — sem erro, sem aviso e sem
 * nada no registro. É uma das causas possíveis do incidente de 14/11/2026, e não havia como saber.
 *
 * AGORA:
 *  · as abas se enxergam (BroadcastChannel): ao abrir, cada uma diz "olá", as outras respondem, e um sinal a cada 10 s
 *    mantém a lista — quem some por 25 s, ou diz "tchau" ao fechar, sai dela;
 *  · havendo outra aba, uma FAIXA no alto avisa nas duas, e o caso vai para o registro (uma vez por aparição);
 *  · quando a OUTRA aba grava dados de verdade (o navegador avisa pelo evento "storage"), esta fica DESATUALIZADA: a
 *    faixa fica vermelha, diz o que mudou e oferece "Recarregar esta aba" — continuar usando gravaria o velho por cima.
 * O que NÃO faz: não bloqueia a gravação. Travar a aba errada num momento ruim custa mais do que o aviso; a trava do
 * progresso (editais.js) e o backup seguem sendo as redes de segurança.
 * ===================================================================== */
const ABAS_CANAL = "eac_abas";
const ABAS_SINAL = 10000;
const ABAS_SOME = 25000;
/* as chaves que são DADO (e não preferência ou estado de tela): outra aba gravar uma destas deixa esta desatualizada */
const ABAS_CHAVES = { eac_editais: "editais e progresso", eac_edital_progresso: "progresso do edital", eac_edital_diario: "diário de estudo",
  eac_edital_texto: "texto do edital", eac_resumos: "resumos", eac_questoes: "questões", eac_texto: "cartões", eac_juris: "julgados", eac_leis: "leis" };

let abasId = Math.random().toString(36).slice(2, 8);
let abasOutras = {};          /* id -> quando deu sinal pela última vez (ms) */
let abasFora = null;          /* { chaves: [rótulos], quando } — a outra aba gravou dados */
let abasDispensada = false;   /* o aviso simples (só "há outra aba") foi fechado nesta sessão */
let abasAvisouRegistro = false;
let abasEnviar = () => {};    /* trocável nos testes */
let abasRelogio = () => Date.now();

function abasEnviarDefinir(f) { abasEnviar = f || (() => {}); }
function abasRelogioDefinir(f) { abasRelogio = f || (() => Date.now()); }
function abasQuantas() { return Object.keys(abasOutras).length; }
function abasEstado() { return { id: abasId, outras: abasQuantas(), fora: abasFora, dispensada: abasDispensada }; }

function abasLimpar() {
  const agora = abasRelogio();
  Object.keys(abasOutras).forEach((id) => { if (agora - abasOutras[id] > ABAS_SOME) delete abasOutras[id]; });
}
/* uma mensagem de outra aba: { t: "ola" | "aqui" | "viva" | "tchau", id } */
function abasReceber(m) {
  if (!m || !m.id || m.id === abasId) return;
  const antes = abasQuantas();
  if (m.t === "tchau") delete abasOutras[m.id];
  else {
    abasOutras[m.id] = abasRelogio();
    if (m.t === "ola") { try { abasEnviar({ t: "aqui", id: abasId }); } catch (e) {} }
  }
  abasLimpar();
  const agora = abasQuantas();
  if (agora && !antes && !abasAvisouRegistro) {
    abasAvisouRegistro = true;
    try { reg("ABAS", "o app está aberto em outra aba ou janela", "esta: " + abasId + " · outra: " + m.id); } catch (e) {}
  }
  if (!agora) { abasAvisouRegistro = false; if (!abasFora) abasDispensada = false; }
  abasPintar();
}
/* o navegador avisa quando OUTRA aba grava no localStorage */
function abasGravouFora(ev) {
  if (!ev || !ev.key || !ABAS_CHAVES[ev.key] || ev.newValue === ev.oldValue) return false;
  const rot = ABAS_CHAVES[ev.key];
  if (!abasFora) abasFora = { chaves: [], quando: new Date(abasRelogio()).toISOString() };
  if (abasFora.chaves.indexOf(rot) < 0) {
    abasFora.chaves.push(rot);
    try { reg("ABAS", "outra aba gravou dados: esta ficou desatualizada", rot + " · " + (String(ev.oldValue || "").length) + " → " + (String(ev.newValue || "").length) + " caracteres"); } catch (e) {}
  }
  abasPintar();
  return true;
}
function abasPintar() {
  if (typeof document === "undefined" || typeof $ !== "function") return;
  const fx = $("abasFaixa");
  if (!fx) return;
  const n = abasQuantas();
  const grave = !!abasFora;
  fx.hidden = !(grave || (n && !abasDispensada));
  if (fx.hidden) return;
  fx.className = "abas-faixa" + (grave ? " grave" : "");
  $("abasFaixaTxt").textContent = grave ? t("abas_fora", { o: abasFora.chaves.join(", ") }) : t("abas_aberta");
  if ($("btnAbasRecarregar")) $("btnAbasRecarregar").hidden = !grave;
  if ($("btnAbasFechar")) $("btnAbasFechar").hidden = grave;
}
/* a linha do resumo do diagnóstico */
function abasLinhaDiagnostico() {
  const n = abasQuantas();
  if (abasFora) return { tipo: "aviso", txt: "Abas: OUTRA aba gravou dados (" + abasFora.chaves.join(", ") + ") — esta está desatualizada; recarregue antes de continuar" };
  if (n) return { tipo: "aviso", txt: "Abas: o app está aberto em mais " + n + " aba(s) ou janela(s) — o que uma grava a outra pode sobrescrever" };
  return { tipo: "ok", txt: "Abas: só esta aberta" };
}
/* opc.semCanal: liga os botões e o evento "storage", mas não abre o canal (os testes: um canal aberto segura o processo) */
function abasIniciar(opc) {
  if (typeof window === "undefined") return;
  if ($("btnAbasRecarregar")) $("btnAbasRecarregar").onclick = () => { try { location.reload(); } catch (e) {} };
  if ($("btnAbasFechar")) $("btnAbasFechar").onclick = () => { abasDispensada = true; abasPintar(); };
  try { window.addEventListener("storage", abasGravouFora); } catch (e) {}
  if ((opc && opc.semCanal) || typeof BroadcastChannel !== "function") return;
  let canal;
  try { canal = new BroadcastChannel(ABAS_CANAL); } catch (e) { return; }
  abasEnviar = (m) => { try { canal.postMessage(m); } catch (e) {} };
  canal.onmessage = (ev) => abasReceber(ev && ev.data);
  abasEnviar({ t: "ola", id: abasId });
  setInterval(() => { abasEnviar({ t: "viva", id: abasId }); const antes = abasQuantas(); abasLimpar(); if (abasQuantas() !== antes) abasReceber({ t: "tchau", id: "-" }); }, ABAS_SINAL);
  window.addEventListener("pagehide", () => abasEnviar({ t: "tchau", id: abasId }));
}
