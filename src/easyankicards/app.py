# -*- coding: utf-8 -*-
"""
EasyAnkiCards — interface desktop (CustomTkinter) v5.

Executar:  python app.py      |  Gerar .exe:  scripts\\build_exe.bat

ARQUITETURA (guia rápido de manutenção):
    Tooltip        balão de dica genérico para qualquer widget
    JanelaAjuda    guia de uso + botões que copiam os prompts de IA
    App            janela principal:
                     - idioma:       _trocar_idioma reconstrói a UI via
                                     _construir_ui, preservando o estado;
                                     preferência salva em ~/.easyankicards.json
                     - parsing:      _parse, do_preview, _desenhar_card
                     - inclusão:     _toggle_card, _excluidos (set)
                     - destino Anki: _atualizar_caminho_deck, _copiar_caminho_deck
                     - normalização: do_normalizar
                     - exportação:   _validate (trava), do_export_txt/apkg
    Todos os TEXTOS visíveis vêm de i18n.t(); as mensagens do parser,
    de core (core.set_language). Lógica de negócio: apenas em core.py.

Licença: MIT (arquivo LICENSE). Contribuições são bem-vindas.
"""

import json
import locale
import os
import tkinter as tk
import traceback
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

import core
import i18n
from i18n import t

CONFIG_PATH = Path.home() / ".easyankicards.json"

ctk.set_appearance_mode("system")
ctk.set_default_color_theme("blue")

# Cores da pré-visualização (modo claro, modo escuro)
COR_OK = ("#eaf6ea", "#1c2a1c")
COR_OK_BORDA = ("#4caf50", "#2e7d32")
COR_ALERTA = ("#fdf2df", "#33291a")
COR_ALERTA_BORDA = ("#e8940a", "#b46e00")
COR_TAG = ("#5b6472", "#9aa4b2")
COR_ISSUE = ("#b45309", "#f0a04b")
MAX_CARDS_VISUAIS = 150


def _idioma_inicial():
    """Config salva > idioma do sistema > português."""
    try:
        cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        if cfg.get("lang") in ("pt", "en"):
            return cfg["lang"]
    except Exception:
        pass
    try:
        loc = (locale.getdefaultlocale()[0] or "").lower()
        if loc.startswith("pt"):
            return "pt"
        if loc.startswith("en"):
            return "en"
    except Exception:
        pass
    return "pt"


def _salvar_idioma(lang):
    try:
        CONFIG_PATH.write_text(json.dumps({"lang": lang}), encoding="utf-8")
    except Exception:
        pass  # preferência não persistida não deve travar o app


class Tooltip:
    """Balão de dica exibido ao passar o mouse sobre o widget."""

    def __init__(self, widget, texto, delay_ms=450):
        self.widget = widget
        self.texto = texto
        self.delay = delay_ms
        self._id = None
        self._tip = None
        widget.bind("<Enter>", self._agendar, add="+")
        widget.bind("<Leave>", self._esconder, add="+")
        widget.bind("<ButtonPress>", self._esconder, add="+")

    def _agendar(self, _=None):
        self._cancelar()
        self._id = self.widget.after(self.delay, self._mostrar)

    def _cancelar(self):
        if self._id:
            self.widget.after_cancel(self._id)
            self._id = None

    def _mostrar(self):
        if self._tip:
            return
        x = self.widget.winfo_rootx() + 10
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 6
        self._tip = tk.Toplevel(self.widget)
        self._tip.wm_overrideredirect(True)
        self._tip.wm_geometry("+{}+{}".format(x, y))
        tk.Label(self._tip, text=self.texto, justify="left",
                 background="#2b2b2b", foreground="#f2f2f2",
                 relief="solid", borderwidth=1, padx=8, pady=5,
                 font=("Segoe UI", 9), wraplength=340).pack()

    def _esconder(self, _=None):
        self._cancelar()
        if self._tip:
            self._tip.destroy()
            self._tip = None


class JanelaAjuda(ctk.CTkToplevel):
    """Guia de uso no idioma atual + botões de copiar prompts de IA."""

    def __init__(self, master):
        super().__init__(master)
        self.title(t("help_title", v=core.__version__))
        self.geometry("640x580")
        self.minsize(500, 420)
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        box = ctk.CTkTextbox(self, wrap="word", font=("Consolas", 12))
        box.grid(row=0, column=0, sticky="nsew", padx=12, pady=(12, 6))
        box.insert("1.0", t("help_text"))
        box.configure(state="disabled")

        rodape = ctk.CTkFrame(self, fg_color="transparent")
        rodape.grid(row=1, column=0, pady=(0, 12))
        self._btn_full = ctk.CTkButton(
            rodape, text=t("prompt_full_btn"), width=180,
            fg_color="#7c3aed", hover_color="#6d28d9",
            command=lambda: self._copiar(t("prompt_full"), self._btn_full,
                                         t("prompt_full_btn")))
        self._btn_full.grid(row=0, column=0, padx=5)
        self._btn_mini = ctk.CTkButton(
            rodape, text=t("prompt_mini_btn"), width=230,
            fg_color="#0e7490", hover_color="#0c5f75",
            command=lambda: self._copiar(t("prompt_mini"), self._btn_mini,
                                         t("prompt_mini_btn")))
        self._btn_mini.grid(row=0, column=1, padx=5)
        ctk.CTkButton(rodape, text=t("help_close"), width=90,
                      command=self.destroy).grid(row=0, column=2, padx=5)
        self.after(200, self.lift)

    def _copiar(self, texto, botao, rotulo):
        self.clipboard_clear()
        self.clipboard_append(texto)
        botao.configure(text=t("copied"))
        self.after(2200, lambda: botao.configure(text=rotulo))


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.lang = _idioma_inicial()
        i18n.set_language(self.lang)
        core.set_language(self.lang)

        self.geometry("1080x740")
        self.minsize(840, 600)
        self._janela_ajuda = None
        self._prev_job = None
        self._excluidos = set()
        self._ultimo_result = None

        self._construir_ui()
        self.after(300, self.do_preview)

    # ------------------------------------------------------------------
    # Construção da interface (chamada no início e ao trocar de idioma)
    # ------------------------------------------------------------------

    def _construir_ui(self, estado=None):
        """Monta todos os widgets no idioma atual.
        `estado` (opcional) restaura texto/baralho/tags após troca de idioma."""
        self.title(t("app_title") + " — v" + core.__version__ + "  ·  " + t("brand"))
        self.grid_columnconfigure(0, weight=5)
        self.grid_columnconfigure(1, weight=4)
        self.grid_rowconfigure(1, weight=1)

        # ---- Barra superior ----
        top = ctk.CTkFrame(self)
        top.grid(row=0, column=0, columnspan=2, sticky="ew", padx=10, pady=(10, 5))
        top.grid_columnconfigure(1, weight=1)
        top.grid_columnconfigure(3, weight=1)

        ctk.CTkLabel(top, text=t("deck_label")).grid(row=0, column=0, padx=(10, 4), pady=8)
        self.deck_entry = ctk.CTkEntry(top, placeholder_text=t("deck_placeholder"))
        self.deck_entry.insert(0, estado["deck"] if estado else "Meu Baralho")
        self.deck_entry.grid(row=0, column=1, sticky="ew", padx=4, pady=8)
        Tooltip(self.deck_entry, t("deck_tooltip"))

        ctk.CTkLabel(top, text=t("tags_label")).grid(row=0, column=2, padx=(14, 4))
        self.tags_entry = ctk.CTkEntry(top, placeholder_text=t("tags_placeholder"))
        if estado and estado["tags"]:
            self.tags_entry.insert(0, estado["tags"])
        self.tags_entry.grid(row=0, column=3, sticky="ew", padx=4, pady=8)
        Tooltip(self.tags_entry, t("tags_tooltip"))
        self.tags_entry.bind("<KeyRelease>", self._agendar_preview)

        # Seletor de idioma (Português / English / Español)
        self.lang_menu = ctk.CTkOptionMenu(
            top, width=110, values=list(i18n.LANG_NAMES.values()),
            command=self._trocar_idioma)
        self.lang_menu.set(i18n.LANG_NAMES[self.lang])
        self.lang_menu.grid(row=0, column=4, padx=(10, 4), pady=8)

        self.help_btn = ctk.CTkButton(top, text=t("help_btn"), width=90,
                                      fg_color="#6b7280", hover_color="#4b5563",
                                      command=self.abrir_ajuda)
        self.help_btn.grid(row=0, column=5, padx=(4, 10), pady=8)
        Tooltip(self.help_btn, t("help_tooltip"))
        self.bind("<F1>", lambda e: self.abrir_ajuda())

        # Segunda linha: destino no Anki ("::" = hierarquia de pastas)
        self.deck_path_lbl = ctk.CTkLabel(top, anchor="w", font=("Segoe UI", 11),
                                          text_color=COR_TAG, text="")
        self.deck_path_lbl.grid(row=1, column=0, columnspan=4, sticky="ew",
                                padx=(10, 4), pady=(0, 6))
        self.copy_path_btn = ctk.CTkButton(
            top, text=t("copy_path_btn"), width=110, height=24,
            font=("Segoe UI", 11), fg_color="#6b7280", hover_color="#4b5563",
            command=self._copiar_caminho_deck)
        self.copy_path_btn.grid(row=1, column=4, columnspan=2,
                                padx=(10, 10), pady=(0, 6))
        Tooltip(self.copy_path_btn, t("copy_path_tooltip"))
        self.deck_entry.bind("<KeyRelease>", self._atualizar_caminho_deck)
        self._atualizar_caminho_deck()

        # ---- Editor (esquerda) ----
        left = ctk.CTkFrame(self)
        left.grid(row=1, column=0, sticky="nsew", padx=(10, 5), pady=5)
        left.grid_rowconfigure(1, weight=1)
        left.grid_columnconfigure(0, weight=1)

        cab = ctk.CTkFrame(left, fg_color="transparent")
        cab.grid(row=0, column=0, sticky="ew", padx=10, pady=(8, 2))
        cab.grid_columnconfigure(0, weight=1)
        lbl_editor = ctk.CTkLabel(cab, anchor="w", text=t("editor_label"))
        lbl_editor.grid(row=0, column=0, sticky="ew")
        Tooltip(lbl_editor, t("editor_tooltip"))
        btn_norm = ctk.CTkButton(cab, text=t("normalize_btn"), width=130,
                                 fg_color="#6b7280", hover_color="#4b5563",
                                 command=self.do_normalizar)
        btn_norm.grid(row=0, column=1, padx=(8, 0))
        Tooltip(btn_norm, t("normalize_tooltip"))

        self.textbox = ctk.CTkTextbox(left, wrap="word", font=("Consolas", 13))
        self.textbox.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.textbox.insert("1.0", estado["texto"] if estado else t("example"))
        self.textbox.bind("<KeyRelease>", self._agendar_preview)
        self.textbox.bind("<<Paste>>", self._agendar_preview, add="+")

        # ---- Pré-visualização (direita) ----
        right = ctk.CTkFrame(self)
        right.grid(row=1, column=1, sticky="nsew", padx=(5, 10), pady=5)
        right.grid_rowconfigure(2, weight=1)
        right.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(right, anchor="w", text=t("preview_label")).grid(
            row=0, column=0, sticky="ew", padx=10, pady=(8, 0))
        self.resumo_lbl = ctk.CTkLabel(right, anchor="w", text="—",
                                       font=("Segoe UI", 11), text_color=COR_TAG)
        self.resumo_lbl.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 4))

        self.cards_frame = ctk.CTkScrollableFrame(right, fg_color="transparent")
        self.cards_frame.grid(row=2, column=0, sticky="nsew", padx=6, pady=(0, 10))
        self.cards_frame.grid_columnconfigure(0, weight=1)

        # ---- Barra inferior ----
        bottom = ctk.CTkFrame(self)
        bottom.grid(row=2, column=0, columnspan=2, sticky="ew", padx=10, pady=(5, 10))
        bottom.grid_columnconfigure(3, weight=1)

        btn_txt = ctk.CTkButton(bottom, text=t("export_txt_btn"),
                                command=self.do_export_txt)
        btn_txt.grid(row=0, column=0, padx=(10, 5), pady=10)
        Tooltip(btn_txt, t("export_txt_tooltip"))

        btn_apkg = ctk.CTkButton(bottom, text=t("export_apkg_btn"),
                                 fg_color="#1a7f37", hover_color="#166b2f",
                                 command=self.do_export_apkg)
        btn_apkg.grid(row=0, column=1, padx=5, pady=10)
        Tooltip(btn_apkg, t("export_apkg_tooltip"))

        # Marca do desenvolvedor, sempre visível junto do nome/versão
        ctk.CTkLabel(bottom, anchor="w", font=("Segoe UI", 11, "italic"),
                     text_color=COR_TAG,
                     text=t("app_title") + " · " + t("brand")).grid(
            row=0, column=2, sticky="w", padx=(14, 0))
        self.status = ctk.CTkLabel(bottom, anchor="e",
                                   text=t("status_ready", v=core.__version__))
        self.status.grid(row=0, column=3, sticky="ew", padx=10)

    # ------------------------------------------------------------------
    # Troca de idioma
    # ------------------------------------------------------------------

    def _trocar_idioma(self, nome_exibido):
        novo = i18n.LANG_BY_NAME.get(nome_exibido, "pt")
        if novo == self.lang:
            return
        exemplo_antigo = t("example").strip()
        estado = {
            "texto": self.textbox.get("1.0", "end").rstrip("\n"),
            "deck": self.deck_entry.get(),
            "tags": self.tags_entry.get(),
        }
        self.lang = novo
        i18n.set_language(novo)
        core.set_language(novo)
        _salvar_idioma(novo)
        # se o editor ainda tem o exemplo, troca pelo exemplo do novo idioma
        if estado["texto"].strip() == exemplo_antigo:
            estado["texto"] = t("example")
        if self._janela_ajuda and self._janela_ajuda.winfo_exists():
            self._janela_ajuda.destroy()
        for w in self.winfo_children():
            w.destroy()
        self._construir_ui(estado)
        self.do_preview()

    # ------------------------------------------------------------------
    # Destino no Anki
    # ------------------------------------------------------------------

    def _atualizar_caminho_deck(self, _=None):
        nome = self._deck_name()
        partes = [p.strip() for p in nome.split("::") if p.strip()]
        if len(partes) > 1:
            self.deck_path_lbl.configure(
                text=t("dest_path", path="  >  ".join(partes), last=partes[-1]))
        else:
            self.deck_path_lbl.configure(text=t("dest_root", name=nome))

    def _copiar_caminho_deck(self):
        self.clipboard_clear()
        self.clipboard_append(self._deck_name())
        self.copy_path_btn.configure(text=t("copy_path_done"))
        self.after(2000, lambda: self.copy_path_btn.configure(text=t("copy_path_btn")))
        self.status.configure(text=t("copy_path_status"))

    # ------------------------------------------------------------------
    # Parsing e pré-visualização
    # ------------------------------------------------------------------

    def abrir_ajuda(self):
        if self._janela_ajuda is None or not self._janela_ajuda.winfo_exists():
            self._janela_ajuda = JanelaAjuda(self)
        else:
            self._janela_ajuda.lift()
            self._janela_ajuda.focus()

    def _parse(self, com_globais=True):
        raw = self.textbox.get("1.0", "end")
        tags = []
        if com_globais and self.tags_entry.get().strip():
            tags = core._parse_tags(self.tags_entry.get())
        return core.parse_text(raw, global_tags=tags)

    def _deck_name(self):
        name = self.deck_entry.get().strip()
        return name if name else "Deck"

    def _agendar_preview(self, _=None):
        if self._prev_job:
            self.after_cancel(self._prev_job)
        self._prev_job = self.after(700, self.do_preview)

    @staticmethod
    def _chave(card):
        return (card.line, card.front)

    def do_preview(self):
        self._prev_job = None
        result = self._parse()
        self._ultimo_result = result

        for w in self.cards_frame.winfo_children():
            w.destroy()

        linha = 0
        for n, c in enumerate(result.cards, start=1):
            if n > MAX_CARDS_VISUAIS:
                ctk.CTkLabel(self.cards_frame,
                             text=t("more_cards",
                                    n=len(result.cards) - MAX_CARDS_VISUAIS)).grid(
                    row=linha, column=0, sticky="ew", padx=4, pady=4)
                linha += 1
                break
            linha = self._desenhar_card(n, c, linha)

        for w in result.warnings:
            f = ctk.CTkFrame(self.cards_frame, fg_color=COR_ALERTA,
                             border_width=2, border_color=COR_ALERTA_BORDA,
                             corner_radius=8)
            f.grid(row=linha, column=0, sticky="ew", padx=4, pady=3)
            f.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(f, text=t("ignored_prefix") + w, anchor="w",
                         justify="left", wraplength=360, font=("Segoe UI", 11),
                         text_color=COR_ISSUE).grid(
                row=0, column=0, sticky="ew", padx=8, pady=6)
            linha += 1

        resumo = t("summary", n=len(result.cards), b=result.n_basic,
                   c=result.n_cloze, sel=self._n_incluidos(result))
        if result.n_suspicious:
            resumo += t("summary_verify", n=result.n_suspicious)
        self.resumo_lbl.configure(text=resumo)
        self.status.configure(text=t("status_auto", n=len(result.cards)))

    def _desenhar_card(self, n, c, linha):
        suspeito = bool(c.issues)
        f = ctk.CTkFrame(self.cards_frame,
                         fg_color=COR_ALERTA if suspeito else COR_OK,
                         border_width=2,
                         border_color=COR_ALERTA_BORDA if suspeito else COR_OK_BORDA,
                         corner_radius=8)
        f.grid(row=linha, column=0, sticky="ew", padx=4, pady=3)
        f.grid_columnconfigure(0, weight=1)

        cab = ctk.CTkFrame(f, fg_color="transparent")
        cab.grid(row=0, column=0, sticky="ew", padx=8, pady=(6, 0))
        cab.grid_columnconfigure(0, weight=1)
        titulo = "#{} · {} · {} {}".format(
            n, t("card_cloze") if c.kind == "cloze" else t("card_basic"),
            t("card_line"), c.line)
        if suspeito:
            titulo += "  — " + t("card_verify")
        ctk.CTkLabel(cab, text=titulo, anchor="w",
                     font=("Segoe UI", 11, "bold"),
                     text_color=COR_ISSUE if suspeito else None).grid(
            row=0, column=0, sticky="w")

        var = tk.BooleanVar(value=self._chave(c) not in self._excluidos)
        chk = ctk.CTkCheckBox(cab, text=t("include_chk"), width=70,
                              variable=var, checkbox_width=18, checkbox_height=18,
                              font=("Segoe UI", 11),
                              command=lambda c=c, v=var: self._toggle_card(c, v))
        chk.grid(row=0, column=1, sticky="e")
        Tooltip(chk, t("include_tooltip"))

        ctk.CTkLabel(f, text=c.front, anchor="w", justify="left", wraplength=370,
                     font=("Segoe UI", 12, "bold")).grid(
            row=1, column=0, sticky="ew", padx=10, pady=(2, 0))
        if c.back:
            ctk.CTkLabel(f, text=c.back, anchor="w", justify="left", wraplength=370,
                         font=("Segoe UI", 12)).grid(
                row=2, column=0, sticky="ew", padx=10, pady=(1, 0))
        r = 3
        if c.tags:
            ctk.CTkLabel(f, text=t("tags_prefix") + ", ".join(c.tags), anchor="w",
                         font=("Segoe UI", 10), text_color=COR_TAG).grid(
                row=r, column=0, sticky="ew", padx=10)
            r += 1
        for issue in c.issues:
            ctk.CTkLabel(f, text="(!) " + issue, anchor="w", justify="left",
                         wraplength=370, font=("Segoe UI", 10, "italic"),
                         text_color=COR_ISSUE).grid(
                row=r, column=0, sticky="ew", padx=10)
            r += 1
        ctk.CTkFrame(f, fg_color="transparent", height=4).grid(row=r, column=0)
        return linha + 1

    def _toggle_card(self, card, var):
        k = self._chave(card)
        if var.get():
            self._excluidos.discard(k)
        else:
            self._excluidos.add(k)
        if self._ultimo_result:
            self.status.configure(
                text=t("status_selected", n=self._n_incluidos(self._ultimo_result)))

    def _n_incluidos(self, result):
        return sum(1 for c in result.cards if self._chave(c) not in self._excluidos)

    # ------------------------------------------------------------------
    # Normalizar texto
    # ------------------------------------------------------------------

    def do_normalizar(self):
        result = self._parse(com_globais=False)
        if not result.cards and not result.warnings:
            return
        blocos = []
        for c in result.cards:
            campos = [c.front]
            if c.back or c.kind == "basic":
                campos.append(c.back)
            if c.tags:
                campos.append(", ".join(c.tags))
            blocos.append(" :: ".join(campos))
        texto = "\n\n".join(blocos)
        if result.warnings:
            texto += ("\n\n" + t("norm_ignored_header") + "\n"
                      + "\n".join("# " + w for w in result.warnings))
        self.textbox.delete("1.0", "end")
        self.textbox.insert("1.0", texto + "\n")
        self.status.configure(text=t("normalize_status", n=len(result.cards)))
        self.do_preview()

    # ------------------------------------------------------------------
    # Exportação
    # ------------------------------------------------------------------

    def _sugestao_arquivo(self):
        """Nome de arquivo sugerido: última parte do caminho do baralho.
        O nome do ARQUIVO é livre — o destino é definido pelo campo Baralho."""
        partes = [p.strip() for p in self._deck_name().split("::") if p.strip()]
        nome = partes[-1] if partes else "deck"
        for ch in '\\/:*?"<>|':
            nome = nome.replace(ch, "-")
        return nome

    def _nome_reservado(self, path):
        """Bloqueia 'collection.*': nome reservado do Anki para backup
        da coleção inteira — importá-lo pode confundir o usuário."""
        base = os.path.splitext(os.path.basename(path))[0].strip().lower()
        if base == "collection":
            messagebox.showwarning(t("collection_title"), t("collection_msg"))
            return True
        return False

    def _result_para_exportar(self):
        result = self._parse()
        selec = [c for c in result.cards if self._chave(c) not in self._excluidos]
        return core.ParseResult(cards=selec, warnings=result.warnings)

    def _validate(self):
        result = self._result_para_exportar()
        if not result.cards:
            messagebox.showwarning(t("none_title"), t("none_msg"))
            return None
        if result.has_problems:
            n_probs = result.n_suspicious + len(result.warnings)
            continuar = messagebox.askyesno(
                t("problems_title", n=n_probs),
                t("problems_msg", resumo=core.resumo_problemas(result)),
                icon="warning", default="no")
            if not continuar:
                self.status.configure(text=t("status_cancel"))
                return None
        return result

    def do_export_txt(self):
        result = self._validate()
        if result is None:
            return
        path = filedialog.asksaveasfilename(
            title=t("save_txt_title"), defaultextension=".txt",
            filetypes=[(t("file_type_txt"), "*.txt")],
            initialfile=self._sugestao_arquivo() + ".txt")
        if not path:
            return
        if self._nome_reservado(path):
            return
        core.export_txt(result, self._deck_name(), path)
        self.status.configure(text=t("status_saved", f=os.path.basename(path)))
        messagebox.showinfo(t("txt_done_title"), t("txt_done_msg"))

    def do_export_apkg(self):
        result = self._validate()
        if result is None:
            return
        path = filedialog.asksaveasfilename(
            title=t("save_apkg_title"), defaultextension=".apkg",
            filetypes=[(t("file_type_apkg"), "*.apkg")],
            initialfile=self._sugestao_arquivo() + ".apkg")
        if not path:
            return
        if self._nome_reservado(path):
            return
        try:
            core.export_apkg(result, self._deck_name(), path)
        except ImportError:
            messagebox.showerror(t("genanki_title"), t("genanki_msg"))
            return
        except Exception:
            messagebox.showerror(t("apkg_err_title"), traceback.format_exc())
            return
        self.status.configure(text=t("status_saved", f=os.path.basename(path)))
        partes = [p.strip() for p in self._deck_name().split("::") if p.strip()]
        messagebox.showinfo(t("apkg_done_title"),
                            t("apkg_done_msg", dest="  >  ".join(partes)))


if __name__ == "__main__":
    App().mainloop()
