<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1a7f37">
<title>EasyAnkiCards · by MarlitosDev</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<style>
:root{
  --bg:#f5f6f8; --panel:#fff; --texto:#1a1a2e; --sutil:#5b6472;
  --verde:#1a7f37; --verde-claro:#eaf6ea; --verde-borda:#4caf50;
  --laranja:#b45309; --laranja-claro:#fdf2df; --laranja-borda:#e8940a;
  --azul:#2563eb; --cinza:#6b7280; --roxo:#7c3aed; --ciano:#0e7490;
  --campo:#ffffff; --borda:#c8ccd4;
}
/* Temas explícitos (selecionáveis) — vencem o modo automático do sistema */
:root[data-theme="light"]{ --bg:#f5f6f8; --panel:#fff; --texto:#1a1a2e; --sutil:#5b6472;
  --campo:#fff; --borda:#c8ccd4;
  --verde-claro:#eaf6ea; --laranja-claro:#fdf2df; --laranja:#b45309; }
:root[data-theme="dark"]{ --bg:#15171c; --panel:#22252d; --texto:#f4f5f8; --sutil:#b4bdc9;
  --campo:#2a2e37; --borda:#5a616d;
  --verde-claro:#1d2f1d; --laranja-claro:#3a2e1c; --laranja:#ffb45e; }
:root[data-theme="black"]{ --bg:#000; --panel:#101014; --texto:#fff; --sutil:#ccd3de;
  --campo:#16161c; --borda:#5a616d;
  --verde-claro:#0f2413; --verde-borda:#22c55e; --laranja-claro:#2b2110;
  --laranja-borda:#ffa726; --laranja:#ffc069; }
:root[data-theme="dark"] .chip-cloze, :root[data-theme="black"] .chip-cloze{
  background:#1d4ed8; color:#fff }
:root[data-theme="dark"] .chip-ops, :root[data-theme="black"] .chip-ops{
  background:#6d28d9; color:#fff }
:root[data-theme="dark"] .chip-ops .certa, :root[data-theme="black"] .chip-ops .certa{
  color:#4ade80 }
:root[data-theme="black"] input[type=text], :root[data-theme="black"] textarea,
:root[data-theme="black"] select{ border-color:#5a616d }
@media (prefers-color-scheme: dark){
  :root:not([data-theme]){ --bg:#15171c; --panel:#22252d; --texto:#f4f5f8; --sutil:#b4bdc9;
         --verde-claro:#1d3020; --verde-borda:#3ea75a; --laranja-claro:#3a2e1c;
         --laranja-borda:#ffa726; --laranja:#ffbe6a; --campo:#2a2e37; --borda:#5a616d; }
  :root:not([data-theme]) .chip-cloze{ background:#1d4ed8; color:#fff }
  :root:not([data-theme]) .chip-ops{ background:#6d28d9; color:#fff }
  :root:not([data-theme]) .chip-ops .certa{ color:#4ade80 }
}
*{box-sizing:border-box} html,body{margin:0;padding:0}
body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);
     color:var(--texto);padding-bottom:84px}
header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;background:var(--panel);
       box-shadow:0 1px 4px rgba(0,0,0,.08);position:sticky;top:0;z-index:5}
header h1{font-size:19px;margin:0;flex:1}
header h1 small{display:block;font-size:11px;font-weight:400;color:var(--sutil);font-style:italic}
header .hdr-ctls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
header select, header .hdr-btn{height:34px;border-radius:9px;border:1px solid var(--borda);
  background:var(--campo);color:var(--texto);font-size:12.5px;font-family:inherit;
  padding:0 10px;cursor:pointer;transition:filter .15s, box-shadow .15s}
header select:hover, header .hdr-btn:hover{filter:brightness(1.06);
  box-shadow:0 1px 4px rgba(0,0,0,.12)}
header .hdr-btn{display:inline-flex;align-items:center;gap:5px;font-weight:600}
header .hdr-cor{position:relative;width:34px;height:34px;border-radius:9px;
  border:1px solid var(--borda);overflow:hidden;padding:0;cursor:pointer;background:none}
header .hdr-cor input{position:absolute;inset:-4px;width:calc(100% + 8px);
  height:calc(100% + 8px);border:0;padding:0;cursor:pointer}
header .hdr-reset{width:34px;justify-content:center;padding:0;font-size:15px}
header .hdr-ajuda{background:var(--azul);color:#fff;border-color:transparent}
select,button,input,textarea{font:inherit;color:var(--texto)}
input[type=text],textarea,select{background:var(--campo);border-color:var(--borda)}
.btn{color:#fff}
.btn{border:1px solid rgba(0,0,0,.12);border-radius:9px;padding:9px 14px;cursor:pointer;
  font-family:inherit;font-weight:600;font-size:13px;letter-spacing:.2px;color:#fff;
  white-space:normal;overflow-wrap:anywhere;line-height:1.25;max-width:100%;
  transition:filter .15s, transform .05s, box-shadow .15s;
  box-shadow:0 1px 2px rgba(0,0,0,.12)}
.btn:hover{filter:brightness(1.07)}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.4;cursor:default;box-shadow:none;filter:none}
.btn-cinza{background:var(--cinza)}
.dlg-rodape .btn{flex:0 1 auto}
.btn:active{transform:scale(.97)}
.btn-cinza{background:var(--cinza)} .btn-verde{background:var(--verde)}
.btn-azul{background:var(--azul)} .btn-roxo{background:var(--roxo)} .btn-ciano{background:var(--ciano)}
main{max-width:1320px;margin:0 auto;padding:12px}
.grupo{background:var(--panel);border-radius:12px;padding:12px;margin-bottom:12px;
       box-shadow:0 1px 3px rgba(0,0,0,.06)}
label{font-size:13px;color:var(--sutil);display:block;margin-bottom:3px}
input[type=text]{width:100%;border:1px solid var(--borda);border-radius:8px;padding:9px;
                 background:var(--campo)}
#destino{font-size:12px;color:var(--sutil);margin:6px 0 2px;line-height:1.4}
textarea{width:100%;min-height:260px;border:1px solid var(--borda);border-radius:8px;
         padding:10px;background:var(--campo);font-family:ui-monospace,Consolas,monospace;
         font-size:13px;resize:vertical}
.linha{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
#resumo{font-size:12.5px;color:var(--sutil);margin:4px 0 8px}
.card{border:2px solid var(--verde-borda);background:var(--verde-claro);border-radius:10px;
      padding:9px 11px;margin-bottom:8px}
.card.suspeito{border-color:var(--laranja-borda);background:var(--laranja-claro)}
.card .cab{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;
           color:var(--sutil);gap:8px;align-items:center}
.card.suspeito .cab .titulo{color:var(--laranja)}
.card .frente{font-weight:700;font-size:14px;margin-top:3px;word-break:break-word}
.card .verso{font-size:13.5px;margin-top:2px;word-break:break-word}
.card .tags{font-size:11.5px;color:var(--sutil);margin-top:3px}
.card .issue{font-size:11.5px;color:var(--laranja);font-style:italic;margin-top:3px}
.card.ignorado{border-color:var(--laranja-borda);background:var(--laranja-claro);
  color:var(--laranja);font-size:12.5px;padding:9px 11px}
.card.ignorado .ig-acoes{display:flex;gap:6px;margin-top:7px}
.card.ignorado .ig-acoes .btn{padding:4px 10px;font-size:11.5px}
/* linha técnica do rodapé: diagnóstico e registro. Discreta de propósito —
   servem para relatar problema, não fazem parte do uso normal. */
.rodape-tec{display:flex;gap:14px;justify-content:center;margin-top:6px}
.link-tec{background:none;border:0;padding:2px 4px;cursor:pointer;
  font-size:11px;color:var(--sutil);opacity:.65;text-decoration:underline}
.link-tec:hover{opacity:1;color:var(--texto)}
.rodape{position:fixed;left:0;right:0;bottom:0;background:var(--panel);
        box-shadow:0 -2px 8px rgba(0,0,0,.1);padding:10px 14px;display:flex;gap:8px;
        justify-content:center;z-index:5}
#status{font-size:11.5px;color:var(--sutil);text-align:center;margin-top:6px}
dialog{border:0;border-radius:14px;max-width:640px;width:92%;padding:0;color:var(--texto);
       background:var(--panel)}
dialog::backdrop{background:rgba(0,0,0,.45)}
.dlg-corpo{padding:16px;max-height:65vh;overflow:auto;white-space:pre-wrap;
           font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.45}
.dlg-rodape{display:flex;gap:8px;padding:12px 16px;flex-wrap:wrap;justify-content:center;
            border-top:1px solid rgba(128,128,128,.25)}
.ic-ajuda{border:0;border-radius:50%;width:18px;height:18px;font-size:11px;
  font-weight:700;background:var(--cinza);color:#fff;cursor:pointer;margin-left:4px;
  vertical-align:middle;line-height:1}
.card textarea,.card input[type=text]{width:100%;border:1px solid var(--borda);border-radius:6px;
  padding:6px;background:var(--campo);color:var(--texto);font-size:13px;margin-top:2px}
.card textarea{min-height:54px;overflow:hidden;resize:vertical}
/* Cada campo do cartão ganha uma faixa colorida à esquerda e uma
   etiqueta com bolinha, para o usuário identificar o tipo num relance. */
/* Cada campo do cartão em edição ganha uma faixa colorida à esquerda,
   um fundo bem leve na cor do campo e uma etiqueta com bolinha, para
   identificar o tipo (frente/verso/etc.) num relance. */
.campo-box{border-left:5px solid var(--cc, #999);padding:5px 8px;margin-top:8px;
  border-radius:0 7px 7px 0;background:var(--cc-bg, transparent)}
.campo-box .mini-lbl{font-weight:800;color:var(--cc);font-size:11px;
  text-transform:uppercase;letter-spacing:.4px}
.campo-box .pino{width:10px;height:10px;border-radius:50%;background:var(--cc);
  display:inline-block;flex:none}
.campo-frente{--cc:#2563eb;--cc-bg:rgba(37,99,235,.07)}
.campo-verso{--cc:#1a7f37;--cc-bg:rgba(26,127,55,.07)}
.campo-mais{--cc:#7c3aed;--cc-bg:rgba(124,58,237,.07)}
.campo-titulo{--cc:#e8940a;--cc-bg:rgba(232,148,10,.07)}
.campo-tags{--cc:#0e7490;--cc-bg:rgba(14,116,144,.07)}
.card textarea.campo-grande{min-height:64px;border-color:#2563eb;background:var(--campo)}
.grupo-tog{width:100%;text-align:left;margin-top:8px;font-size:12px;
  background:var(--cinza);opacity:.9}
.lac-aviso{font-size:11px;font-style:italic;margin:4px 0;line-height:1.35}
.lac-aviso.ok{color:#4caf50}
.lac-aviso.mid{color:#e8940a}
.lac-aviso.bad{color:#dc2626;font-weight:600}
.lac-ordem{font-size:11px;color:var(--sutil);margin-top:4px;line-height:1.4}
.lac-ordem b{color:#4caf50}
.tipo-linha{display:flex;gap:5px;margin:4px 0 2px;flex-wrap:wrap}
.tipo-linha .btn{flex:1 1 auto;padding:5px 8px;font-size:11.5px;opacity:.55}
.tipo-linha .btn.ativa{opacity:1;outline:2px solid rgba(255,255,255,.35)}
.card .mini-lbl{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--sutil);margin-top:6px;display:block}
.card .acoes{display:flex;gap:6px;margin-top:8px}
.card .btn{padding:5px 10px;font-size:12.5px}
dialog textarea,dialog input[type=text]{width:100%;border:1px solid var(--borda);
  border-radius:6px;padding:7px;background:var(--campo);color:var(--texto);font-size:13px;margin-top:3px}
.toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.toolbar .btn{flex:1 1 auto;min-width:0;max-width:100%;padding:9px 10px;font-size:12.5px;
  white-space:normal;overflow-wrap:anywhere;line-height:1.2;text-align:center}
.toolbar .btn.ativa{outline:3px solid rgba(37,99,235,.45)}
.dlg-grid{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:700px){.dlg-grid{grid-template-columns:1fr 1fr}}
.lac-box{border:1.5px dashed #8a8f98;border-radius:8px;padding:8px 10px;margin-top:6px}
.lac-box .titulo-lac{font-size:12px;font-weight:700;color:#2563eb}
.mc-row{display:flex;gap:8px;align-items:center;margin-top:4px}
.mc-row input[type=radio]{width:18px;height:18px;flex:none;accent-color:#1a7f37}
.mc-row input[type=text]{flex:1;margin-top:0}
@keyframes flashCard{
  0%{box-shadow:0 0 0 6px rgba(255,120,0,.95);background-color:rgba(255,140,0,.22)}
  45%{box-shadow:0 0 0 2px rgba(255,120,0,.55)}
  60%{box-shadow:0 0 0 6px rgba(255,120,0,.9)}
  100%{box-shadow:none}}
.card.flash{animation:flashCard 1.8s ease-out}
/* Controles do topo do painel direito em grade fluida: cada seletor
   ocupa no máximo a largura disponível e quebra de linha se faltar
   espaço, em vez de estourar o painel. */
.nota-export{font-size:11.5px;color:var(--sutil);margin:4px 0 2px;line-height:1.4}
.barra-revisao{background:var(--laranja-claro);border:1px solid var(--laranja-borda);
  border-radius:10px;padding:9px 11px;margin:2px 0 8px}
.barra-revisao .rev-titulo{font-size:12px;font-weight:800;color:var(--laranja);
  text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
.barra-revisao .rev-botoes{display:flex;flex-wrap:wrap;gap:5px}
.barra-revisao .rev-botoes .btn{padding:4px 9px;font-size:11px}
/* Três grupos com papéis diferentes: MARCAR (critérios), VER (estados) e
   AÇÕES (o que leva o trabalho adiante). Mesma forma dentro de cada grupo;
   o que só desfaz virou link, para não disputar atenção com o resto. */
.barra-revisao .rev-grupo{display:flex;flex-wrap:wrap;gap:6px;align-items:center;
  margin-top:7px;font-size:11.5px;color:var(--texto)}
.barra-revisao .rev-rot{font-size:10.5px;font-weight:800;letter-spacing:.4px;
  text-transform:uppercase;opacity:.65;min-width:52px}
.barra-revisao .rev-ver{gap:12px}
.barra-revisao .rev-contagem{color:var(--laranja);font-weight:700;
  margin-left:auto;text-align:right}
.barra-revisao .rev-acoes{display:flex;gap:6px;margin-top:9px}
.barra-revisao .rev-acoes .btn{flex:1 1 0;min-width:0;padding:7px 8px;font-size:12px}
.barra-revisao .rev-links{display:flex;gap:14px;justify-content:center;margin-top:7px}
.rev-topo{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px}
.rev-topo .btn{flex:1 1 auto}
/* selos de revisão (só visual; não vão para o cartão exportado) */
.card-badge-rev{font-size:11px;font-weight:800;margin:2px 0 4px;display:inline-block;
  padding:2px 8px;border-radius:6px;letter-spacing:.2px}
.card-badge-sel{color:#dc2626;background:rgba(220,38,38,.10);border:1px solid rgba(220,38,38,.35)}
.card-badge-rev-ok{color:var(--verde);background:rgba(26,127,55,.10);border:1px solid rgba(26,127,55,.35)}
/* trava visual das demais funções durante a revisão */
.em-revisao .trava{opacity:.4;pointer-events:none;filter:grayscale(.4)}
#colarRevSug .sug{margin-bottom:4px}
/* área de revisão com numeração de linhas, rolagem e expansão */
.rev-wrap{position:relative;background:var(--campo);border:1px solid var(--borda);
  border-radius:8px;overflow:hidden}
.rev-wrap .rev-nums{position:absolute;left:0;top:0;bottom:0;width:36px;z-index:2;
  overflow:hidden;padding:8px 5px 8px 0;box-sizing:border-box;text-align:right;
  font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;
  color:var(--sutil);opacity:.7;border-right:1px solid var(--borda);
  background:var(--campo);pointer-events:none;user-select:none}
.rev-wrap textarea{width:100%;height:220px;resize:vertical;display:block;
  font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;
  padding:8px 8px 8px 42px;border:0;background:transparent;color:var(--texto);
  overflow-y:auto;box-sizing:border-box}
.rev-wrap.expandido textarea{height:62vh}
.card .chk-rev{display:flex;align-items:center;gap:4px;font-weight:400;font-size:11px;
  color:var(--laranja)}
.prev-controles{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:2px 0 6px}
.prev-controles label{display:flex;align-items:center;gap:5px;font-size:11.5px;
  color:var(--sutil);min-width:0}
.prev-controles select{max-width:150px;min-width:0;padding:5px;border-radius:7px;
  font-size:12px;background:var(--campo);color:var(--texto);border:1px solid var(--borda)}
.prev-controles .chk-2col input{width:15px;height:15px}
/* Duas colunas de cartões (opcional, telas largas) */
/* Colunas automáticas: cada cartão tem no MÍNIMO 260px; o painel encaixa
   quantas colunas couberem no espaço disponível (1 no estreito, 2+ no
   largo) — nunca achata o texto. */
#cartoes.duas{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
  gap:8px;align-content:start}
#cartoes.duas .card{margin:0}
#cartoes{position:relative;overflow-y:auto;max-height:46vh;
  overscroll-behavior:contain;padding-right:2px;
  /* arrastar a alça inferior para ver mais cartões de uma vez */
  resize:vertical;min-height:200px}
.toolbar-sec{margin-top:10px}
.toolbar-sec .cap{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;
  color:var(--sutil);font-weight:700;margin-bottom:2px}
.toolbar-sec .toolbar{margin-top:2px}
.lado-rotulo{font-size:9.5px;letter-spacing:.6px;font-weight:800;opacity:.6;margin:8px 0 2px}
.chip-tag{font-size:9px;text-transform:uppercase;letter-spacing:.4px;opacity:.75;
  margin-right:4px;font-weight:800}
.norm-item{border:1px solid rgba(128,128,128,.35);border-radius:8px;
  padding:8px;margin-bottom:8px;font-size:12.5px}
.norm-item .cab-n{display:flex;gap:8px;align-items:center;font-weight:700;margin-bottom:4px}
.norm-item .antes{background:rgba(255,140,0,.16);border-left:3px solid #ff8c00;
  padding:4px 7px;border-radius:4px;margin-top:3px;white-space:pre-wrap}
.norm-item .depois{background:rgba(76,175,80,.16);border-left:3px solid #4caf50;
  padding:4px 7px;border-radius:4px;margin-top:3px;white-space:pre-wrap}
.norm-item .rot{font-size:10px;text-transform:uppercase;letter-spacing:.4px;opacity:.7}
#barraUpdate{position:fixed;left:8px;right:8px;top:8px;z-index:90;display:none;
  gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;
  background:#1d4ed8;color:#fff;padding:10px 14px;border-radius:12px;
  box-shadow:0 6px 20px rgba(0,0,0,.35);font-size:13px}
#barraUpdate.on{display:flex}
#avisoTopo{border:1.5px solid var(--laranja-borda);background:var(--laranja-claro);
  border-radius:10px;padding:9px 11px;margin:8px 0}
#avisoTopo .av-tit{font-size:12.5px;font-weight:800;color:var(--laranja);margin-bottom:3px}
#avisoTopo .av-txt{font-size:11.5px;color:var(--texto);opacity:.9;line-height:1.35}
#avisoTopo .av-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;
  color:var(--sutil);font-weight:700;margin:7px 0 3px}
/* Gaveta retrátil "Importar arquivo": alça sempre visível, corpo oculto
   por padrão (principalmente no navegador). */
.gaveta-importar{margin-bottom:10px;border:1px solid var(--borda);border-radius:9px;
  background:var(--campo);overflow:hidden}
.gaveta-alca{width:100%;display:flex;align-items:center;gap:8px;background:transparent;
  border:0;color:var(--texto);font:inherit;font-size:12.5px;font-weight:600;
  padding:9px 11px;cursor:pointer;text-align:left}
.gaveta-alca:hover{background:rgba(128,128,128,.08)}
.gaveta-alca .gv-icone{transition:transform .18s;display:inline-block;color:var(--sutil)}
.gaveta-alca[aria-expanded="true"] .gv-icone{transform:rotate(90deg)}
.gaveta-alca .gv-selo{margin-left:auto;font-size:10px;font-weight:800;text-transform:uppercase;
  letter-spacing:.4px;color:var(--laranja);background:var(--laranja-claro);
  border:1px solid var(--laranja-borda);border-radius:6px;padding:1px 7px}
.gaveta-alca.desktop-ok .gv-selo{display:none}
.gaveta-corpo{padding:0 11px 11px;display:flex;flex-direction:column;gap:8px}
.gaveta-corpo[hidden]{display:none}
" .gaveta-corpo .nota{font-size:11.5px;color:var(--sutil);line-height:1.4}
#importProgresso .ip-txt{font-size:11.5px;color:var(--sutil);margin-bottom:4px}
#importProgresso .ip-barra{height:8px;background:var(--borda);border-radius:5px;overflow:hidden}
#importProgresso .ip-fill{height:100%;width:0;background:var(--verde);transition:width .2s}
.imp-arq{border:1px solid var(--borda);border-radius:9px;margin-bottom:10px;overflow:hidden}
.imp-arq .imp-cab{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--campo);
  font-size:12.5px;cursor:pointer}
.imp-arq .imp-cab .imp-nome{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.imp-arq .imp-cab .imp-tam{color:var(--sutil);font-size:11px;flex:none}
.imp-arq .imp-corpo{padding:8px 10px}
.imp-arq textarea{width:100%;min-height:120px;font-family:ui-monospace,Consolas,monospace;
  font-size:12px;line-height:1.4;border:1px solid var(--borda);border-radius:6px;padding:8px;
  background:var(--campo);color:var(--texto)}
.imp-arq .imp-acoes{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.imp-arq .imp-acoes .btn{padding:3px 9px;font-size:11px}
.linha-colar{display:flex;gap:8px;margin:8px 0 2px;flex-wrap:wrap}
.linha-colar .btn{flex:1 1 auto;padding:9px;font-size:12.5px}
.linha-corrigir{margin:6px 0 2px}
@keyframes brilhoColagem{
  0%{background:rgba(26,127,55,.45)}
  100%{background:transparent}}
#editorHl .hl-novo{animation:brilhoColagem 2.2s ease-out;border-radius:3px}
.linha-corrigir .btn{width:100%;padding:9px}
@keyframes pulsoCorrigir{
  0%,100%{box-shadow:0 0 0 0 rgba(232,148,10,.65)}
  50%{box-shadow:0 0 0 7px rgba(232,148,10,0)}}
#btnNormalizar.ativo{background:#e8940a;animation:pulsoCorrigir 1.8s ease-out infinite}
#btnNormalizar:disabled{opacity:.45;cursor:default;animation:none}
/* Diálogo de aviso/confirmação. É um <dialog> de propósito: elemento
   comum não consegue aparecer acima de um <dialog> já aberto (o navegador
   coloca <dialog> numa camada própria), e o alerta ficava invisível até o
   usuário fechar a janela de baixo. */
dialog.ui-modal{max-width:440px;width:calc(100% - 36px);background:var(--panel);
  color:var(--texto);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.4);padding:18px}
dialog.ui-modal::backdrop{background:rgba(0,0,0,.42)}
dialog.ui-modal[open]{animation:uiEntra .22s cubic-bezier(.2,.9,.3,1.2)}
@keyframes uiEntra{from{transform:translateY(12px) scale(.97);opacity:.5}
  to{transform:none;opacity:1}}
.ui-modal .ui-msg{font-size:14px;line-height:1.5;white-space:pre-wrap;
  max-height:60vh;overflow:auto;margin-bottom:16px}
.ui-modal .ui-acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.ui-modal .ui-acoes .btn{min-width:96px}
#toast{position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:80;
  background:#1f2937;color:#fff;font-size:13px;font-weight:600;padding:9px 16px;
  border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,.4);opacity:0;
  transition:opacity .2s, transform .2s;pointer-events:none;max-width:88vw;text-align:center}
#toast.on{opacity:1;transform:translateX(-50%) translateY(-6px)}
.tipbox{position:fixed;z-index:99;background:#2b2b2b;color:#f2f2f2;font-size:12px;
  padding:6px 9px;border-radius:7px;max-width:280px;line-height:1.35;
  box-shadow:0 3px 10px rgba(0,0,0,.35);pointer-events:none}
.editor-wrap{position:relative;background:var(--campo);border-radius:8px}
/* Numeração das linhas: coluna fixa à esquerda, mesma métrica do texto,
   rolando junto com o editor. Fica FORA da área de digitação. */
#editorNums{position:absolute;left:0;top:0;bottom:0;width:38px;z-index:2;
  overflow:hidden;padding:10px 6px 10px 0;box-sizing:border-box;
  font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:13px;
  line-height:1.5;text-align:right;color:var(--sutil);opacity:.7;
  border-right:1px solid var(--borda);background:var(--campo);
  pointer-events:none;user-select:none}
#editorNums .lnum{white-space:pre}
#editorNums .lnum.err{color:#dc2626;opacity:1;font-weight:800}
#editorNums .lnum.warn{color:#e8940a;opacity:1;font-weight:700}
.editor-wrap textarea{position:relative;z-index:1;background:transparent;
  color:var(--texto);caret-color:var(--texto)}
/* A camada colorida e o campo precisam ter EXATAMENTE as mesmas métricas,
   senão a seleção do texto aparece deslocada ao copiar. */
#editorHl, .editor-wrap textarea{
  font-family:ui-monospace,Consolas,"Courier New",monospace;
  font-size:13px;line-height:1.5;letter-spacing:0;word-spacing:0;tab-size:2;
  text-indent:0;text-rendering:auto;font-kerning:none;
  padding:10px 10px 10px 44px;border:1px solid transparent;border-radius:8px;
  white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;
  box-sizing:border-box;margin:0;
  /* a MESMA calha de rolagem nos dois: sem isso a camada de trás fica
     mais larga que o campo e as quebras de linha (e a seleção) saem
     deslocadas */
  overflow-y:scroll;scrollbar-gutter:stable}
#editorHl{position:absolute;inset:0;pointer-events:none;
  color:transparent;z-index:0;scrollbar-width:none}
#editorHl::-webkit-scrollbar{width:0;height:0}
.editor-wrap textarea{border-color:var(--borda);resize:vertical}
.editor-wrap.sem-destaque #editorHl{display:none}
.grupo-titulo-geral{margin-bottom:10px}
.grupo-titulo-geral input{width:100%;border:1px solid var(--borda);border-radius:8px;
  padding:8px;background:var(--campo);color:var(--texto)}
.grupo-titulo-geral .nota{font-size:11px;color:var(--sutil);margin-top:3px;line-height:1.35}
.card-cab-edit{cursor:pointer;position:relative}
.card-cab-edit:hover::after{content:"✎";position:absolute;right:8px;top:50%;
  transform:translateY(-50%);font-size:12px;opacity:.8}
.card-cab-inherit{opacity:.85;font-style:italic;border:1px dashed rgba(255,255,255,.5)}
.card-badge-titulo{font-size:10.5px;margin-top:4px;padding:2px 6px;border-radius:5px;
  display:inline-block;line-height:1.35}
.card-badge-own{background:rgba(26,127,55,.14);color:var(--verde)}
.card-badge-gen{background:rgba(37,99,235,.12);color:#2563eb}
.card-badge-none{background:rgba(232,148,10,.14);color:var(--laranja)}
.linha-editor{display:flex;gap:8px;align-items:center;margin:2px 0 4px;flex-wrap:wrap}
.linha-editor .btn{padding:4px 10px;font-size:11.5px}
.chk-hl{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--sutil)}
.chk-hl input{width:15px;height:15px}
#editor::selection{background:rgba(37,99,235,.45)}
#editor::-moz-selection{background:rgba(37,99,235,.35)}
.hl-delim{background:rgba(255,157,46,.30);border-radius:3px}
:root[data-theme="light"] .hl-delim{background:rgba(194,65,12,.20)}
:root[data-theme="light"] .hl-cloze{background:rgba(29,78,216,.16)}
:root[data-theme="light"] .hl-mc{background:rgba(109,40,217,.16)}
.hl-cloze{background:rgba(99,164,255,.25);border-radius:3px}
.hl-mc{background:rgba(180,139,255,.30);border-radius:3px}
.hl-com{opacity:.55}
.hl-err{background:rgba(220,38,38,.18);border-radius:3px}
.hl-warn{background:rgba(232,148,10,.18);border-radius:3px}
#sugestoes{margin-top:8px;display:flex;flex-direction:column;gap:5px;font-size:12.5px}
.sug{display:flex;gap:7px;align-items:flex-start}
.sug .dot{width:9px;height:9px;border-radius:50%;margin-top:4px;flex:none}
.dot-red{background:#dc2626}.dot-org{background:#e8940a}
.dot-blue{background:#2563eb}.dot-green{background:#4caf50}
.sug{flex-wrap:wrap}
.sug .btn{padding:4px 10px;font-size:11.5px;margin-left:0}
.sug-acao{flex-basis:100%;display:flex;gap:6px;align-items:center;
  margin:4px 0 2px 16px;flex-wrap:wrap}
.sug-acao .rot{font-size:10.5px;opacity:.8}
.card .mais{font-size:12px;margin-top:5px;background:rgba(37,99,235,.10);
  border-left:3px solid #2563eb;padding:6px 8px;border-radius:5px}
.card .mais-cab{font-size:9.5px;font-weight:800;letter-spacing:.5px;
  text-transform:uppercase;color:#2563eb}
.card .info{font-size:11.5px;color:#2563eb;margin-top:3px}
.chip-cloze{background:#2563eb22;color:#2563eb;font-weight:700;
  border-radius:4px;padding:0 4px}
.chip-ops{background:#7c3aed22;color:#7c3aed;border-radius:4px;padding:0 4px;font-weight:600}
.chip-ops .certa{color:var(--verde);font-weight:800;text-decoration:underline}
#novoPreview .card{margin-top:4px}
.rev-mask{background:#2563eb22;color:#2563eb;font-weight:700;border-radius:4px;padding:0 4px}
.rev-certa{color:var(--verde);font-weight:700}
@media(min-width:760px){
  .duas-colunas{display:grid;grid-template-columns:minmax(320px,460px) minmax(0,1fr);
    gap:12px;align-items:start}
  .duas-colunas .grupo:nth-child(2){position:sticky;top:8px}
  #cartoes{max-height:calc(100vh - 250px)}
}
.duas-colunas > *{min-width:0}          /* impede o grid de estourar */
#cartoes{overflow-x:hidden}
#cartoes .card, #cartoes .card *{max-width:100%;overflow-wrap:anywhere;
  word-break:break-word}
#novoPreview *{max-width:100%;overflow-wrap:anywhere;word-break:break-word}
</style>
</head>
<body>
<header>
  <img src="icon-192.png" alt="" width="34" height="34" style="border-radius:8px">
  <h1>EasyAnkiCards <small>by MarlitosDev · <span id="versao"></span></small></h1>
  <div class="hdr-ctls">
    <select id="selTema" aria-label="Tema">
      <option value="auto"></option><option value="light"></option>
      <option value="dark"></option><option value="black"></option>
    </select>
    <label class="hdr-cor" title="Cor da letra">
      <input type="color" id="corLetra" aria-label="Cor da letra">
    </label>
    <button class="hdr-btn hdr-reset" id="btnCorReset" title="Cor automática">↺</button>
    <select id="selIdioma" aria-label="Idioma">
      <option value="pt">Português</option>
      <option value="en">English</option>
    </select>
    <button class="hdr-btn hdr-ajuda" id="btnAjuda" data-i18n="help_btn"></button>
  </div>
</header>

<main>
  <div class="duas-colunas">
    <div class="grupo">
      <div class="gaveta-importar">
        <button class="gaveta-alca" id="alcaImportar" aria-expanded="false">
          <span class="gv-icone">▸</span>
          <span data-i18n="import_handle"></span>
          <span class="gv-selo" id="importSelo" data-i18n="import_desktop_only"></span>
        </button>
        <div class="gaveta-corpo" id="gavetaImportar" hidden>
          <button class="btn btn-verde" id="btnImportar" data-i18n="import_choose"></button>
          <button class="btn btn-cinza" id="btnImportarReabrir" style="display:none" data-i18n="import_reopen"></button>
          <div class="nota" id="importAviso"></div>
          <div id="importProgresso" style="display:none">
            <div class="ip-txt" id="importProgTxt"></div>
            <div class="ip-barra"><div class="ip-fill" id="importProgFill"></div></div>
          </div>
        </div>
      </div>
      <label data-i18n="editor_label"></label>
      <div class="linha-editor">
        <button class="btn btn-cinza" id="btnSelecionarTudo" data-i18n="select_all"></button>
        <button class="btn btn-cinza" id="btnCopiarTudo" data-i18n="copy_all"></button>
        <button class="btn" id="btnApagarTudo" style="background:#b91c1c" data-i18n="clear_all"></button>
        <label class="chk-hl"><input type="checkbox" id="chkDestaque" checked>
          <span data-i18n="highlight_toggle"></span></label>
      </div>
      <div class="editor-wrap">
        <div id="editorNums" aria-hidden="true"></div>
        <pre id="editorHl" aria-hidden="true"></pre>
        <textarea id="editor" spellcheck="false"></textarea>
      </div>
      <div class="linha-colar">
        <button class="btn btn-cinza" id="btnColarMais" data-i18n="paste_more"></button>
        <button class="btn btn-cinza" id="btnDesfazerColagem" disabled
                data-i18n="undo_paste"></button>
      </div>
      <div id="sugestoes"></div>
      <div class="linha-corrigir">
        <button class="btn btn-cinza" id="btnNormalizar" data-i18n="normalize_btn"></button>
        <button class="btn btn-roxo" id="btnPromptCorrigir" data-i18n="fixprompt_btn"></button>
      </div>
      <div class="toolbar-sec"><div class="cap" data-i18n="group_create"></div>
        <div class="toolbar">
          <button class="btn btn-verde" id="btnNovoCartao" data-i18n="add_card_btn"></button>
          <button class="btn btn-roxo" id="btnMCRapido" data-i18n="mc_quick_btn"></button>
        </div>
      </div>
      <div class="toolbar-sec"><div class="cap" data-i18n="group_ai"></div>
        <div class="toolbar">
          <button class="btn btn-azul" id="btnPromptIA" data-i18n="prompt_main_btn"></button>
        </div>
      </div>
      <div class="toolbar-sec"><div class="cap" data-i18n="group_import"></div>
        <div class="toolbar">
          <button class="btn btn-ciano" id="btnApkgImport" data-i18n="apkg_import"></button>
          <input type="file" id="apkgFile" accept=".apkg" style="display:none">
        </div>
      </div>
    </div>
    <div class="grupo">
      <label data-i18n="preview_label"></label>
      <div class="rev-topo">
        <button class="btn btn-ciano" id="btnRevisar" data-i18n="review_btn"></button>
        <button class="btn btn-verde" id="btnRevFinalizar" style="display:none" data-i18n="review_finish"></button>
        <button class="btn" id="btnRevCancelar" style="display:none;background:#b91c1c" data-i18n="review_cancel"></button>
      </div>
      <div class="grupo-titulo-geral">
        <label for="tituloGeral"><span data-i18n="gen_title_label"></span></label>
        <input type="text" id="tituloGeral">
        <div class="nota" data-i18n="gen_title_note"></div>
      </div>
      <div id="barraRevisao" class="barra-revisao" style="display:none">
        <div class="rev-titulo" data-i18n="review_bar"></div>

        <!-- 1. MARCAR: critérios que selecionam cartões. Todos com a mesma
             forma e o mesmo peso — são alternativas entre si. -->
        <div class="rev-grupo">
          <span class="rev-rot" data-i18n="rev_group_mark"></span>
          <div class="rev-botoes">
            <button class="btn btn-cinza" id="selTodos" data-i18n="sel_all"></button>
            <button class="btn btn-cinza" id="selCurtos" data-i18n="sel_short"></button>
            <button class="btn btn-cinza" id="selSemResp" data-i18n="sel_noanswer"></button>
            <button class="btn btn-cinza" id="selSemPerg" data-i18n="sel_noquestion"></button>
            <button class="btn btn-cinza" id="selLongos" data-i18n="sel_long"></button>
            <button class="btn btn-cinza" id="selDup" data-i18n="sel_dup"></button>
            <button class="btn btn-cinza" id="selRisco" data-i18n="sel_risky"></button>
          </div>
        </div>

        <!-- 2. VER: o que aparece na tela. Caixas de seleção, não botões,
             porque são estados que ficam ligados. -->
        <div class="rev-grupo rev-ver">
          <span class="rev-rot" data-i18n="rev_group_view"></span>
          <label class="chk-2col"><input type="checkbox" id="chkFiltro">
            <span data-i18n="filter_marked"></span></label>
          <label class="chk-2col"><input type="checkbox" id="chkOcultarRev">
            <span data-i18n="hide_reviewed"></span></label>
          <span id="revContagem" class="rev-contagem"></span>
        </div>

        <!-- 3. AÇÕES: as duas que movem o trabalho adiante, mesma largura.
             O que apenas desfaz marcação virou link, para não competir. -->
        <div class="rev-acoes">
          <button class="btn btn-azul" id="btnCopiarMarcados" data-i18n="copy_marked"></button>
          <button class="btn btn-verde" id="btnSubstituirMarcados" data-i18n="replace_marked"></button>
        </div>
        <div class="rev-links">
          <button type="button" class="link-tec" id="selLimpar" data-i18n="sel_clear"></button>
          <button type="button" class="link-tec" id="btnLimparRevisados"
                  data-i18n="clear_reviewed" style="display:none"></button>
        </div>
      </div>
      </div>
      <div class="prev-controles">
        <label><span data-i18n="style_panel_label"></span>
          <select id="selEstiloPainel">
            <option value="esquema"></option>
            <option value="dark"></option><option value="paper"></option>
          </select>
        </label>
        <label><span data-i18n="align_label"></span>
          <select id="selAlinha">
            <option value="justify"></option><option value="left"></option>
          </select>
        </label>
        <label class="chk-2col"><input type="checkbox" id="chk2col">
          <span data-i18n="two_cols"></span></label>
      </div>
      <div id="resumo">—</div>
      <div id="cartoes"></div>
    </div>
  </div>
</main>

<div id="barraUpdate">
  <div>
    <strong id="updTitulo"></strong>
    <div id="updTexto" style="font-size:12px;opacity:.9"></div>
  </div>
  <div style="display:flex;gap:6px;flex:none">
    <button class="btn btn-verde" id="btnAtualizar"></button>
    <button class="btn btn-cinza" id="btnDepois"></button>
  </div>
</div>

<dialog id="uiModal" class="ui-modal">
  <div class="ui-box">
    <div class="ui-msg" id="uiModalMsg"></div>
    <div class="ui-acoes">
      <button class="btn btn-cinza" id="uiModalCancel"></button>
      <button class="btn btn-verde" id="uiModalOk"></button>
    </div>
  </div>
</dialog>

<div id="toast"></div>

<div class="rodape">
  <div style="width:100%;max-width:600px">
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn btn-azul" id="btnTxt" data-i18n="export_txt_btn"></button>
      <button class="btn btn-verde" id="btnApkg" data-i18n="export_apkg_btn"></button>
    </div>
    <div id="status"></div>
    <div class="rodape-tec">
      <button type="button" id="btnDiagnostico" class="link-tec" data-i18n="diag_btn"></button>
      <button type="button" id="btnRegistro" class="link-tec" data-i18n="log_btn"></button>
    </div>
  </div>
</div>

<dialog id="dlgAjuda">
  <div class="dlg-corpo" id="ajudaTexto"></div>
  <div class="dlg-rodape">
    <button class="btn btn-roxo" id="btnPromptFull" data-i18n="prompt_full_btn"></button>
    <button class="btn btn-ciano" id="btnPromptMini" data-i18n="prompt_mini_btn"></button>
    <button class="btn btn-azul" id="btnCheckUpdate" data-i18n="check_update_btn"></button>
    <button class="btn btn-cinza" id="btnFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgNormalizar" style="max-width:760px;width:94%">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="norm_dlg_title"></h3>
    <div id="normLista" style="max-height:52vh;overflow:auto"></div>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px">
      <input type="checkbox" id="chkNormWarn" checked style="width:17px;height:17px">
      <span data-i18n="norm_comment_warn"></span>
    </label>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnNormAplicar" data-i18n="norm_apply"></button>
    <button class="btn btn-cinza" id="btnNormFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgExport">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="export_dlg_title"></h3>
    <label for="deckExp" data-i18n="deck_label"></label>
    <input type="text" id="deckExp">
    <div id="destinoExp" style="font-size:12px;color:var(--sutil);margin:6px 0"></div>
    <div id="avisoTopo">
      <div id="avisoTopoTitulo" class="av-tit"></div>
      <div id="avisoTopoTexto" class="av-txt"></div>
      <label for="tituloExp" style="font-size:11.5px;margin-top:7px;display:block">
        <span data-i18n="title_label"></span>
        <button type="button" class="ic-ajuda" id="ajudaTitulo">?</button>
      </label>
      <div id="tituloExpNota" class="nota-export"></div>
      <input type="text" id="tituloExp">
      <button type="button" class="btn btn-cinza" id="btnTituloDeck"
              style="margin-top:5px;padding:4px 9px;font-size:11px"
              data-i18n="title_use_deck"></button>
      <div id="avisoTopoDemoLbl" class="av-lbl"></div>
      <div id="avisoTopoDemo"></div>
      <div id="avisoTopoTags" class="av-txt" style="margin-top:5px"></div>
    </div>
    <button type="button" class="btn btn-cinza" id="btnCaminhoExp"
            style="margin-bottom:10px" data-i18n="copy_path_btn"></button>
    <label for="selEstilo" style="margin-top:10px"><span data-i18n="style_label"></span>
      <button type="button" class="ic-ajuda" id="ajudaEstilo">?</button></label>
    <select id="selEstilo" style="width:100%;padding:8px;border-radius:8px">
      <option value="esquema"></option>
      <option value="dark"></option><option value="paper"></option>
    </select>
    <div id="stylePreview" style="margin-top:8px;border-radius:10px;padding:10px"></div>
    <div id="styleHintTxt" style="font-size:11.5px;color:var(--sutil);margin-top:6px"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnExportConfirm" data-i18n="export_confirm"></button>
    <button class="btn btn-cinza" id="btnExportFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgGerar" style="max-width:680px;width:94%">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="gen_title"></h3>
    <div class="toolbar" style="margin-bottom:8px">
      <button class="btn btn-roxo" id="btnGenFull" data-i18n="gen_full_tab"></button>
      <button class="btn btn-ciano" id="btnGenShort" data-i18n="gen_short_tab"></button>
    </div>
    <div class="nota" data-i18n="gen_note" style="margin-bottom:6px"></div>
    <textarea id="genTexto"
      style="width:100%;min-height:240px;font-family:ui-monospace,Consolas,monospace;
             font-size:12px;line-height:1.4"></textarea>
    <div id="genTam" style="font-size:11.5px;margin-top:6px"></div>
    <div id="genDone" style="font-size:12px;color:var(--verde);margin-top:6px;min-height:16px"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnGenCopiar" data-i18n="gen_copy"></button>
    <button class="btn btn-cinza" id="btnGenFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgImportar" style="max-width:680px;width:94%">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="import_result_title"></h3>
    <div id="importLista"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-cinza" id="btnImpCopiarTudo" data-i18n="import_copy_all"></button>
    <button class="btn btn-azul" id="btnImpGerarTudo" data-i18n="import_gen_all"></button>
    <button class="btn" id="btnImpLimpar" style="background:#b91c1c" data-i18n="import_clear"></button>
    <button class="btn btn-cinza" id="btnImpFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgColarRev" style="max-width:720px;width:94%">
  <div style="padding:16px">
    <h3 style="margin:0 0 6px" data-i18n="pastepanel_title"></h3>
    <div class="nota" data-i18n="pastepanel_note" style="margin-bottom:8px"></div>
    <div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:4px">
      <button type="button" class="btn btn-azul" id="btnColarRevColar"
              style="padding:3px 10px;font-size:11px" data-i18n="pastepanel_paste"></button>
      <button type="button" class="btn btn-cinza" id="btnColarRevExpandir"
              style="padding:3px 10px;font-size:11px" data-i18n="panel_expand"></button>
    </div>
    <div class="rev-wrap" id="colarRevWrap">
      <div class="rev-nums" id="colarRevNums" aria-hidden="true"></div>
      <textarea id="colarRevTexto" spellcheck="false"></textarea>
    </div>
    <div id="colarRevSug" style="margin-top:8px"></div>
    <div id="colarRevStatus" style="font-size:12px;margin-top:6px;min-height:16px"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnColarRevFinalizar" data-i18n="pastepanel_finish"></button>
    <button class="btn btn-roxo" id="btnColarRevPrompt" data-i18n="fixprompt_btn"></button>
    <button class="btn btn-cinza" id="btnColarRevFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgFixPrompt" style="max-width:760px;width:94%">
  <div style="padding:16px">
    <h3 style="margin:0 0 6px" data-i18n="fixprompt_title"></h3>
    <div class="toolbar" style="margin-bottom:8px">
      <button class="btn btn-roxo" id="btnFixTabParcial" data-i18n="fixpart_tab"></button>
      <button class="btn btn-ciano" id="btnFixTabInteiro" data-i18n="fixwhole_tab"></button>
    </div>
    <div class="nota" data-i18n="fixprompt_note" style="margin-bottom:8px"></div>
    <textarea id="fixPromptTexto" spellcheck="false"
      style="width:100%;min-height:280px;font-family:ui-monospace,Consolas,monospace;
             font-size:12px;line-height:1.4"></textarea>
    <div id="fixPromptTam" style="font-size:11.5px;margin-top:6px"></div>
    <div id="fixPromptConf" style="font-size:12px;margin-top:6px;line-height:1.5;
         max-height:26vh;overflow:auto"></div>
    <div id="fixPromptDone" style="font-size:12px;color:var(--verde);margin-top:6px;min-height:16px"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnFixPromptCopiar" data-i18n="fixprompt_copy"></button>
    <button class="btn btn-azul" id="btnFixPromptColar" data-i18n="fixpart_paste"></button>
    <button class="btn btn-verde" id="btnFixPromptAplicar" style="display:none"
            data-i18n="fixpart_apply"></button>
    <button class="btn btn-cinza" id="btnFixPromptFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgRevCopiar">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="revcopy_title"></h3>
    <div class="toolbar" style="margin-bottom:8px">
      <button class="btn btn-roxo" id="btnRevTabFull" data-i18n="revcopy_full_tab"></button>
      <button class="btn btn-ciano" id="btnRevTabShort" data-i18n="revcopy_short_tab"></button>
    </div>
    <div class="nota" data-i18n="revcopy_note" style="margin-bottom:6px"></div>
    <textarea id="revCopyTexto"
      style="width:100%;min-height:240px;font-family:ui-monospace,Consolas,monospace;
             font-size:12px;line-height:1.4"></textarea>
    <div id="revCopyTam" style="font-size:11.5px;margin-top:6px"></div>
    <div id="revCopyDone" style="font-size:12px;color:var(--verde);margin-top:6px;min-height:16px"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnRevCopyCopiar" data-i18n="revcopy_copy"></button>
    <button class="btn btn-cinza" id="btnRevCopyFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgPrompt">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="prompt_dlg_title"></h3>
    <div class="toolbar" style="margin-bottom:8px">
      <button class="btn btn-roxo" id="btnTabFull" data-i18n="prompt_full_tab"></button>
      <button class="btn btn-ciano" id="btnTabMini" data-i18n="prompt_mini_tab"></button>
    </div>
    <div id="promptDica" style="font-size:11.5px;color:var(--sutil);margin:0 0 6px"></div>
    <div id="promptTam" style="font-size:11.5px;margin:0 0 6px"></div>
    <textarea id="promptTexto"
      style="width:100%;min-height:240px;font-family:ui-monospace,Consolas,monospace;
             font-size:12px;line-height:1.4"></textarea>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnPromptCopiar" data-i18n="prompt_copy"></button>
    <button class="btn btn-roxo" id="btnPromptSalvar" data-i18n="prompt_save"></button>
    <button class="btn btn-cinza" id="btnPromptRestaurar" data-i18n="prompt_restore"></button>
    <button class="btn btn-cinza" id="btnPromptFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgRevisao">
  <div style="padding:16px">
    <div id="revContador" style="font-size:12px;color:var(--sutil);margin-bottom:8px"></div>
    <div id="revCartao" style="min-height:140px;font-size:15px;line-height:1.5"></div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-cinza" id="btnRevPrev" data-i18n="review_prev"></button>
    <button class="btn btn-verde" id="btnRevMostrar" data-i18n="review_show"></button>
    <button class="btn btn-cinza" id="btnRevProx" data-i18n="review_next"></button>
    <button class="btn btn-cinza" id="btnRevFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<dialog id="dlgNovo" style="max-width:920px;width:94%">
  <div style="padding:16px">
    <h3 style="margin:0 0 10px" data-i18n="add_title"></h3>
    <div class="dlg-grid">
      <div>
        <label data-i18n="tpl_label"></label>
        <select id="selModelo" style="width:100%;padding:8px;border-radius:8px;margin-bottom:10px">
          <option value="qa"></option><option value="def"></option>
          <option value="cloze"></option><option value="law"></option>
          <option value="juris"></option><option value="mc"></option>
          <option value="mc_cloze"></option>
        </select>
        <label><span id="lblFrente" data-i18n="field_front"></span>
          <button type="button" class="ic-ajuda" data-hint="hint_front">?</button></label>
        <textarea id="novoFrente" style="min-height:60px;overflow:hidden"></textarea>
        <div id="lacunaArea" style="display:none;margin-top:4px">
          <button type="button" class="btn btn-ciano" id="btnMarcarNovo" data-i18n="btn_mark_blank"></button>
          <button type="button" class="btn btn-cinza" id="btnLimparNovo" data-i18n="btn_clear_blanks"></button>
          <button type="button" class="ic-ajuda" data-hint="hint_mark_blank">?</button>
        </div>
        <div id="mcClozeArea" style="display:none;margin-top:6px">
          <label><span data-i18n="mc_correct_label"></span>
            <button type="button" class="ic-ajuda" data-hint="hint_mc_cloze">?</button></label>
          <input type="text" id="mcCerta">
          <label><span data-i18n="mc_wrong_label"></span></label>
          <input type="text" id="mcErr0" placeholder="1">
          <input type="text" id="mcErr1" placeholder="2">
          <input type="text" id="mcErr2" placeholder="3">
          <input type="text" id="mcErr3" placeholder="4">
          <button type="button" class="btn btn-ciano" id="btnEmbaralharCloze"
                  style="margin-top:6px" data-i18n="shuffle_btn"></button>
        </div>
        <div id="mcArea" style="display:none;margin-top:6px">
          <label><span data-i18n="mc_mark_correct"></span>
            <button type="button" class="ic-ajuda" data-hint="hint_mc">?</button></label>
          <div class="mc-row"><input type="radio" name="mcRadio" id="mcR0" checked><input type="text" id="mcOp0" placeholder="A"></div>
          <div class="mc-row"><input type="radio" name="mcRadio" id="mcR1"><input type="text" id="mcOp1" placeholder="B"></div>
          <div class="mc-row"><input type="radio" name="mcRadio" id="mcR2"><input type="text" id="mcOp2" placeholder="C"></div>
          <div class="mc-row"><input type="radio" name="mcRadio" id="mcR3"><input type="text" id="mcOp3" placeholder="D"></div>
          <div class="mc-row"><input type="radio" name="mcRadio" id="mcR4"><input type="text" id="mcOp4" placeholder="E"></div>
          <button type="button" class="btn btn-ciano" id="btnEmbaralhar"
                  style="margin-top:6px" data-i18n="shuffle_btn"></button>
        </div>
        <label style="margin-top:8px"><span data-i18n="field_back"></span>
          <button type="button" class="ic-ajuda" data-hint="hint_back">?</button></label>
        <textarea id="novoVerso" style="min-height:54px;overflow:hidden"></textarea>
        <label style="margin-top:8px"><span data-i18n="field_more"></span>
          <button type="button" class="ic-ajuda" data-hint="hint_more">?</button></label>
        <textarea id="novoMais" style="min-height:60px;overflow:hidden;resize:vertical"></textarea>
        <label style="margin-top:8px"><span data-i18n="field_tags"></span>
          <button type="button" class="ic-ajuda" data-hint="hint_tags">?</button></label>
        <input type="text" id="novoTags">
      </div>
      <div>
        <label data-i18n="preview_live"></label>
        <div id="novoPreview"></div>
        <div id="dicaCampo" style="font-size:12px;color:var(--sutil);margin-top:8px;min-height:16px"></div>
      </div>
    </div>
  </div>
  <div class="dlg-rodape">
    <button class="btn btn-verde" id="btnInserir" data-i18n="insert_btn"></button>
    <button class="btn btn-cinza" id="btnNovoFechar" data-i18n="help_close"></button>
  </div>
</dialog>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"></script>
<script>
window.__sqlPromise = initSqlJs({
  locateFile: f => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/" + f
});
</script>
<script src="i18n.js"></script>
<script src="parser.js"></script>
<script src="anki.js"></script>
<script src="app.js"></script>
</body>
</html>
