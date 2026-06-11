"""
ReciLuz — Script de Medição de Eficiência Energética
=====================================================
Executa automaticamente os Cenários A e B do protocolo de medição,
coleta leituras de corrente da API e calcula a economia percentual.

Uso:
    python medicao_eficiencia.py
    python medicao_eficiencia.py --url http://172.26.69.122:8000
"""

import argparse
import time
import sys
import statistics
import urllib.request
import urllib.error
import json
from datetime import datetime

# ── Configurações padrão ──────────────────────────────────────────────────────
DEFAULT_URL         = "http://localhost:8000"
TENSAO_V            = 12.0   # tensão da lâmpada (V)
INTERVALO_POLL_S    = 2      # intervalo entre leituras (s)
ESTABILIZACAO_S     = 30     # aguardo antes de iniciar coleta (s)
DURACAO_A_S         = 120    # duração do Cenário A (s)
DURACAO_B_S         = 120    # duração do Cenário B (s) — 60s ausência + 60s presença
TIMEOUT_CONFIRM_S   = 30     # tempo máx. para confirmar que o ESP32 aceitou o comando
PWM_MAXIMO          = 255    # valor de intensidade_pwm esperado no modo remoto ligado

# ── Helpers de terminal ───────────────────────────────────────────────────────
BOLD   = "\033[1m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RED    = "\033[91m"
RESET  = "\033[0m"

def titulo(texto):
    linha = "═" * 60
    print(f"\n{BOLD}{CYAN}{linha}{RESET}")
    print(f"{BOLD}{CYAN}  {texto}{RESET}")
    print(f"{BOLD}{CYAN}{linha}{RESET}")

def info(texto):
    print(f"  {CYAN}→{RESET} {texto}")

def ok(texto):
    print(f"  {GREEN}✔{RESET} {texto}")

def aviso(texto):
    print(f"  {YELLOW}⚠{RESET}  {texto}")

def erro(texto):
    print(f"  {RED}✘{RESET} {texto}")

def countdown(segundos, mensagem):
    """Exibe uma contagem regressiva inline."""
    for i in range(segundos, 0, -1):
        print(f"\r  ⏱  {mensagem} — {i:3d}s restantes…", end="", flush=True)
        time.sleep(1)
    print(f"\r  {GREEN}✔{RESET}  {mensagem} — concluído!          ")

# ── API helpers ───────────────────────────────────────────────────────────────
def _req(url, method="GET"):
    req = urllib.request.Request(url, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode())

def verificar_api(base_url):
    try:
        r = _req(f"{base_url}/health")
        return r.get("status") == "OK"
    except Exception:
        return False

def ligar_lampada(base_url):
    _req(f"{base_url}/lampada/ligar", method="POST")

def ativar_automatico(base_url):
    _req(f"{base_url}/lampada/automatico", method="POST")

def ultima_leitura(base_url):
    return _req(f"{base_url}/leituras/ultimas")

def aguardar_modo_remoto(base_url):
    """
    Confirma que o ESP32 recebeu o comando e está em modo remoto ligado
    (intensidade_pwm == 255). Retorna True se confirmado, False se timeout.
    """
    print()
    info(f"Aguardando confirmação do ESP32 (máx. {TIMEOUT_CONFIRM_S}s)…")
    inicio = time.time()
    tentativa = 0
    while time.time() - inicio < TIMEOUT_CONFIRM_S:
        tentativa += 1
        try:
            leitura = ultima_leitura(base_url)
            pwm  = leitura.get("intensidade_pwm")
            modo = leitura.get("modo", "")
            print(
                f"\r  ⏳ Tentativa {tentativa:2d} | PWM={pwm} | modo='{modo}'  ",
                end="", flush=True
            )
            if pwm == PWM_MAXIMO and "REMOTO" in (modo or "").upper():
                print(f"\r  {GREEN}✔{RESET} Confirmado: ESP32 em REMOTO LIGADO (PWM={pwm})        ")
                return True
        except Exception as exc:
            print(f"\r  Erro ao ler leitura: {exc}  ", end="", flush=True)
        time.sleep(INTERVALO_POLL_S)

    print(f"\r  {RED}✘{RESET} Timeout: ESP32 não confirmou modo remoto.                       ")
    return False

def aguardar_modo_automatico(base_url):
    """
    Confirma que o ESP32 voltou ao modo automático (modo != REMOTO).
    """
    print()
    info(f"Aguardando confirmação do modo automático (máx. {TIMEOUT_CONFIRM_S}s)…")
    inicio = time.time()
    tentativa = 0
    while time.time() - inicio < TIMEOUT_CONFIRM_S:
        tentativa += 1
        try:
            leitura = ultima_leitura(base_url)
            modo = leitura.get("modo", "")
            print(
                f"\r  ⏳ Tentativa {tentativa:2d} | modo='{modo}'  ",
                end="", flush=True
            )
            if "REMOTO" not in (modo or "").upper():
                print(f"\r  {GREEN}✔{RESET} Confirmado: ESP32 em modo automático (modo='{modo}')   ")
                return True
        except Exception as exc:
            print(f"\r  Erro ao ler leitura: {exc}  ", end="", flush=True)
        time.sleep(INTERVALO_POLL_S)

    print(f"\r  {RED}✘{RESET} Timeout: ESP32 não confirmou modo automático.                   ")
    return False

# ── Coleta de amostras ────────────────────────────────────────────────────────
def coletar_amostras(base_url, duracao_s, label):
    """
    Coleta leituras de corrente durante `duracao_s` segundos.
    Retorna lista de dicts com chaves 'corrente' (float) e 'presenca' (bool).
    """
    amostras = []
    inicio   = time.time()
    n        = 0

    print()
    while (elapsed := time.time() - inicio) < duracao_s:
        restante = duracao_s - elapsed
        try:
            leitura  = ultima_leitura(base_url)
            corrente = leitura.get("corrente")
            pwm      = leitura.get("intensidade_pwm", "?")
            presenca = leitura.get("presenca_detectada")

            if corrente is not None and corrente >= 0:
                amostras.append({"corrente": corrente, "presenca": bool(presenca)})
                n += 1
                status_presenca = "SIM" if presenca else "NÃO"
                print(
                    f"\r  [{label}] #{n:3d} | "
                    f"Corrente: {corrente:.3f} A | "
                    f"PWM: {pwm:>3} | "
                    f"Presença: {status_presenca} | "
                    f"{restante:5.1f}s",
                    end="", flush=True
                )
            else:
                print(f"\r  [{label}] Aguardando leitura válida… {restante:5.1f}s",
                      end="", flush=True)
        except Exception as exc:
            print(f"\r  [{label}] Erro ao ler API: {exc} — tentando novamente…",
                  end="", flush=True)

        time.sleep(INTERVALO_POLL_S)

    print()  # nova linha após coleta
    return amostras

# ── Resultado formatado ───────────────────────────────────────────────────────
def imprimir_resultados(amostras_a, amostras_b):
    titulo("RESULTADOS DA MEDIÇÃO")

    # ── Cenário A ─────────────────────────────────────────────────────────────
    correntes_a = [a["corrente"] for a in amostras_a]
    if not correntes_a:
        erro("Cenário A: sem amostras válidas!")
        return
    I_max = statistics.mean(correntes_a)
    sig_a = statistics.stdev(correntes_a) if len(correntes_a) > 1 else 0.0

    # ── Cenário B — separação por presença ────────────────────────────────────
    if not amostras_b:
        erro("Cenário B: sem amostras válidas!")
        return
    b_com = [a["corrente"] for a in amostras_b if     a["presenca"]]
    b_sem = [a["corrente"] for a in amostras_b if not a["presenca"]]

    I_com_bruto = statistics.mean(b_com) if b_com else 0.0
    I_sem_bruto = statistics.mean(b_sem) if b_sem else 0.0

    # Correção folded-distribution: abs() do ACS712 infla leituras de baixa
    # corrente — leituras sem presença (lâmpada apagada) são substituídas por 0
    b_corrigido = b_com + [0.0] * len(b_sem)
    I_med = statistics.mean(b_corrigido)
    sig_b = statistics.stdev(b_corrigido) if len(b_corrigido) > 1 else 0.0

    P_max = I_max * TENSAO_V
    P_med = I_med * TENSAO_V
    economia = ((P_max - P_med) / P_max) * 100 if P_max > 0 else 0.0
    cor = GREEN if economia > 0 else RED

    # ── Detalhamento das fases ────────────────────────────────────────────────
    print()
    ok(f"Cenário A            : {len(correntes_a):2d} amostras | "
       f"I = {I_max:.4f} A ± {sig_a:.4f} A")
    ok(f"Cenário B            : {len(amostras_b):2d} amostras total")
    info(f"  Com presença  ({len(b_com):2d}) : I_bruto = {I_com_bruto:.4f} A  →  usado como está")
    info(f"  Sem presença  ({len(b_sem):2d}) : I_bruto = {I_sem_bruto:.4f} A  →  corrigido para 0 A")
    info(f"  I_med corrigido    : {I_med:.4f} A ± {sig_b:.4f} A")

    # ── Tabela de resultados ──────────────────────────────────────────────────
    print()
    linha = "─" * 50
    print(f"  {BOLD}{linha}{RESET}")
    print(f"  {BOLD}{'Grandeza':<34} {'Valor':>12}{RESET}")
    print(f"  {linha}")
    print(f"  {'I_max  (Cenário A, PWM=255)':<34} {I_max:>11.4f} A")
    print(f"  {'I_med  (Cenário B, corrigido)':<34} {I_med:>11.4f} A")
    print(f"  {'P_max  (potência máxima)':<34} {P_max:>11.3f} W")
    print(f"  {'P_med  (potência média inteligente)':<34} {P_med:>11.3f} W")
    print(f"  {linha}")
    print(f"  {BOLD}{'Economia energética':<34} {cor}{economia:>10.1f} %{RESET}{BOLD}{RESET}")
    print(f"  {linha}")
    print()

    # ── Nota metodológica ─────────────────────────────────────────────────────
    aviso("Correção aplicada (folded-distribution do ACS712 + abs()):")
    aviso(f"  {len(b_sem)} leituras sem presença: {I_sem_bruto:.4f} A bruto → 0 A corrigido")
    aviso(f"  {len(b_com)} leituras com presença: mantidas ({I_com_bruto:.4f} A, corrente real)")
    print()

    # ── CSV com coluna de valor corrigido ─────────────────────────────────────
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv = f"medicao_{ts}.csv"
    with open(csv, "w") as f:
        f.write("cenario,amostra,corrente_A_bruta,presenca,corrente_A_corrigida\n")
        for i, a in enumerate(amostras_a, 1):
            f.write(f"A,{i},{a['corrente']:.5f},{a['presenca']},{a['corrente']:.5f}\n")
        for i, a in enumerate(amostras_b, 1):
            corrigida = a["corrente"] if a["presenca"] else 0.0
            f.write(f"B,{i},{a['corrente']:.5f},{a['presenca']},{corrigida:.5f}\n")
    ok(f"Amostras exportadas → {csv}")

    # ── Resumo para copiar no relatório ───────────────────────────────────────
    print()
    print(f"  {BOLD}── Copie para o relatório ──────────────────────────{RESET}")
    print(f"  I_max = {I_max:.4f} A  →  P_max = {P_max:.3f} W")
    print(f"  I_med = {I_med:.4f} A  →  P_med = {P_med:.3f} W  (corrigido)")
    print(f"  Economia = ({P_max:.3f} − {P_med:.3f}) / {P_max:.3f} × 100 "
          f"= {cor}{BOLD}{economia:.1f}%{RESET}")
    print()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ReciLuz — Medição de Eficiência")
    parser.add_argument("--url", default=DEFAULT_URL,
                        help=f"URL base da API (padrão: {DEFAULT_URL})")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    titulo("ReciLuz — Protocolo de Medição de Eficiência Energética")
    info(f"API alvo: {base}")
    info(f"Tensão configurada: {TENSAO_V} V")
    info(f"Intervalo de poll: {INTERVALO_POLL_S} s")
    print()

    # Verifica conectividade
    info("Verificando conexão com a API…")
    if not verificar_api(base):
        erro(f"API não respondeu em {base}/health")
        erro("Verifique se o backend está rodando e tente novamente.")
        sys.exit(1)
    ok("API acessível!")

    # ── CENÁRIO A ─────────────────────────────────────────────────────────────
    titulo("CENÁRIO A — Intensidade Máxima (2 min)")
    info("Enviando comando: LIGAR (modo remoto forçado)…")
    try:
        ligar_lampada(base)
        ok("Comando enviado ao Node-RED → MQTT.")
    except Exception as exc:
        erro(f"Falha ao enviar comando para a API: {exc}")
        sys.exit(1)

    # Confirma que o ESP32 realmente recebeu e aplicou o comando
    if not aguardar_modo_remoto(base):
        aviso("O ESP32 não confirmou o modo remoto no tempo esperado.")
        aviso("Possíveis causas: MQTT desconectado, Node-RED offline, Wi-Fi instável.")
        print()
        print(f"  {YELLOW}Alternativa manual:{RESET} posicione um objeto FIXO a menos de")
        print(f"  5 cm do sensor ultrassônico. Com distância < 5 cm o firmware")
        print(f"  aplica PWM=255 automaticamente, que é equivalente ao modo remoto.")
        print()
        resposta = input(f"  Deseja continuar mesmo assim? (s/N): ").strip().lower()
        if resposta != "s":
            sys.exit(1)
        aviso("Continuando sem confirmação do ESP32.")

    aviso(f"Aguardando {ESTABILIZACAO_S}s para a corrente estabilizar…")
    countdown(ESTABILIZACAO_S, "Estabilização Cenário A")

    info(f"Coletando amostras por {DURACAO_A_S}s…")
    amostras_a = coletar_amostras(base, DURACAO_A_S, "A")

    if not amostras_a:
        erro("Nenhuma amostra coletada no Cenário A. Abortando.")
        sys.exit(1)
    ok(f"{len(amostras_a)} amostras coletadas no Cenário A.")

    # ── CENÁRIO B ─────────────────────────────────────────────────────────────
    titulo("CENÁRIO B — Modo Automático (2 min)")
    info("Enviando comando: AUTOMÁTICO…")
    try:
        ativar_automatico(base)
        ok("Comando enviado ao Node-RED → MQTT.")
    except Exception as exc:
        erro(f"Falha ao enviar comando para a API: {exc}")
        sys.exit(1)

    if not aguardar_modo_automatico(base):
        aviso("O ESP32 não confirmou o modo automático no tempo esperado.")
        resposta = input(f"  Deseja continuar mesmo assim? (s/N): ").strip().lower()
        if resposta != "s":
            sys.exit(1)

    print()
    aviso("ATENÇÃO — siga o protocolo abaixo durante os próximos 2 minutos:")
    print(f"  {YELLOW}  • Primeiro 1 minuto:{RESET} mantenha NENHUM objeto a menos de 40 cm do sensor")
    print(f"  {YELLOW}  • Segundo 1 minuto: {RESET} posicione um objeto a menos de 40 cm do sensor")
    print()
    input(f"  Pressione {BOLD}Enter{RESET} quando estiver pronto para iniciar o Cenário B… ")

    info(f"Coletando amostras por {DURACAO_B_S}s…")
    amostras_b = coletar_amostras(base, DURACAO_B_S, "B")

    if not amostras_b:
        erro("Nenhuma amostra coletada no Cenário B. Abortando.")
        sys.exit(1)
    ok(f"{len(amostras_b)} amostras coletadas no Cenário B.")

    # ── Resultados ────────────────────────────────────────────────────────────
    imprimir_resultados(amostras_a, amostras_b)

    # Retorna lâmpada ao modo automático ao sair
    try:
        ativar_automatico(base)
    except Exception:
        pass


if __name__ == "__main__":
    main()
