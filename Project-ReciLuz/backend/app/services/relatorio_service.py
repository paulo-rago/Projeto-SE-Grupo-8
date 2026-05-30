"""
Service for daily report generation and email delivery.
"""

import os
import asyncio
import smtplib
from collections import defaultdict
from datetime import datetime, timedelta, date, time
from email.message import EmailMessage
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.models import Leitura, Assinante

load_dotenv()

RECIFE_TZ     = ZoneInfo("America/Recife")
SMTP_HOST     = os.getenv("SMTP_HOST", "")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM     = os.getenv("SMTP_FROM", "") or SMTP_USER
HORA_ENVIO    = int(os.getenv("RELATORIO_HORA_ENVIO", "8"))


# ─── agregação ────────────────────────────────────────────────────────────────

def _resumo_dia(leituras: list) -> dict | None:
    if not leituras:
        return None

    def avg(vals):
        v = [x for x in vals if x is not None]
        return round(sum(v) / len(v), 2) if v else None

    def mx(vals):
        v = [x for x in vals if x is not None]
        return round(max(v), 2) if v else None

    def mn(vals):
        v = [x for x in vals if x is not None]
        return round(min(v), 2) if v else None

    total   = len(leituras)
    ligadas = sum(1 for r in leituras if r.intensidade_pwm and r.intensidade_pwm > 0)

    return {
        "total_leituras":     total,
        "temperatura_media":  avg([r.temperatura for r in leituras]),
        "temperatura_min":    mn([r.temperatura for r in leituras]),
        "temperatura_max":    mx([r.temperatura for r in leituras]),
        "umidade_media":      avg([r.umidade for r in leituras]),
        "umidade_min":        mn([r.umidade for r in leituras]),
        "umidade_max":        mx([r.umidade for r in leituras]),
        "corrente_media":     avg([r.corrente for r in leituras]),
        "corrente_max":       mx([r.corrente for r in leituras]),
        "potencia_media":     avg([r.potencia for r in leituras]),
        "potencia_max":       mx([r.potencia for r in leituras]),
        "consumo_total_kwh":  round(sum(r.consumo_estimado for r in leituras if r.consumo_estimado), 6),
        "pct_ligada":         round(ligadas / total * 100, 1) if total else 0,
        "deteccoes_presenca": sum(1 for r in leituras if r.presenca_detectada),
        "deteccoes_ruido":    sum(1 for r in leituras if r.som_detectado),
    }


def gerar_resumo(db: Session) -> dict:
    agora = datetime.now(RECIFE_TZ).replace(tzinfo=None)
    hoje  = agora.date()
    ontem = hoje - timedelta(days=1)

    inicio_janela = datetime.combine(hoje - timedelta(days=7), time(0, 0, 0))
    fim_janela    = datetime.combine(hoje,                      time(0, 0, 0))

    todas = (
        db.query(Leitura)
        .filter(Leitura.criada_em >= inicio_janela)
        .filter(Leitura.criada_em <  fim_janela)
        .order_by(Leitura.criada_em.asc())
        .all()
    )

    por_dia: dict[date, list] = defaultdict(list)
    for r in todas:
        por_dia[r.criada_em.date()].append(r)

    historico = []
    for i in range(6, -1, -1):
        dia = hoje - timedelta(days=i + 1)
        historico.append({
            "data":      dia.strftime("%d/%m"),
            "destaque":  dia == ontem,
            "resumo":    _resumo_dia(por_dia.get(dia, [])),
        })

    return {
        "data_relatorio": agora.strftime("%d/%m/%Y"),
        "data_ontem":     ontem.strftime("%d/%m/%Y"),
        "periodo":        f"{(hoje - timedelta(days=7)).strftime('%d/%m')} – {ontem.strftime('%d/%m/%Y')}",
        "ontem":          _resumo_dia(por_dia.get(ontem, [])),
        "historico_7d":   historico,
    }


# ─── html ─────────────────────────────────────────────────────────────────────

def _fmt(v, suf="", fallback="—") -> str:
    return f"{v} {suf}".strip() if v is not None else fallback


def _linha(label: str, valor: str) -> str:
    return f"""
      <tr>
        <td style="padding:7px 12px;color:#6b7280;font-size:13px;">{label}</td>
        <td style="padding:7px 12px;font-weight:600;font-size:13px;text-align:right;">{valor}</td>
      </tr>"""


def _secao_destaque(titulo: str, linhas: str) -> str:
    return f"""
    <h3 style="margin:0 0 8px;font-size:14px;color:#1e3a5f;font-weight:700;">{titulo}</h3>
    <table width="100%" cellspacing="0" cellpadding="0"
           style="border-collapse:collapse;background:#ffffff;border-radius:8px;overflow:hidden;">
      {linhas}
    </table>"""


def _bloco_ontem(ontem: dict | None, data_ontem: str) -> str:
    if not ontem:
        sem_dados = "<p style='color:#6b7280;font-size:13px;margin:0;'>Nenhum dado registrado neste dia.</p>"
    else:
        col1 = (
            _linha("Temp. média",   _fmt(ontem["temperatura_media"], "°C")) +
            _linha("Temp. mínima",  _fmt(ontem["temperatura_min"],   "°C")) +
            _linha("Temp. máxima",  _fmt(ontem["temperatura_max"],   "°C")) +
            _linha("Umidade média", _fmt(ontem["umidade_media"],     "%"))  +
            _linha("Umidade mín.",  _fmt(ontem["umidade_min"],       "%"))  +
            _linha("Umidade máx.",  _fmt(ontem["umidade_max"],       "%"))
        )
        col2 = (
            _linha("Corrente média",   _fmt(ontem["corrente_media"],    "A"))   +
            _linha("Corrente máxima",  _fmt(ontem["corrente_max"],      "A"))   +
            _linha("Potência média",   _fmt(ontem["potencia_media"],    "W"))   +
            _linha("Consumo total",    _fmt(ontem["consumo_total_kwh"], "kWh")) +
            _linha("Tempo ligada",     _fmt(ontem["pct_ligada"],        "%"))   +
            _linha("Det. presença",    str(ontem["deteccoes_presenca"]))         +
            _linha("Det. ruído",       str(ontem["deteccoes_ruido"]))
        )
        sem_dados = f"""
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr valign="top">
            <td width="50%" style="padding-right:8px;">
              {_secao_destaque("Ambiental", col1)}
            </td>
            <td width="50%" style="padding-left:8px;">
              {_secao_destaque("Elétrico & Atividade", col2)}
            </td>
          </tr>
        </table>"""

    return f"""
    <div style="background:linear-gradient(135deg,#e8f4ff,#f0f7ff);
                border:2px solid #93c5fd;border-radius:12px;padding:20px 20px 16px;
                margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;
                     padding:3px 10px;border-radius:20px;letter-spacing:0.05em;">
          DESTAQUE
        </span>
        <span style="font-size:15px;font-weight:700;color:#1e3a5f;">
          Dia anterior — {data_ontem}
        </span>
      </div>
      {sem_dados}
    </div>"""


def _tabela_7d(historico: list) -> str:
    cabecalho = """
    <tr style="background:#1e3a5f;">
      <th style="padding:9px 10px;color:#fff;font-size:12px;text-align:left;font-weight:600;">Data</th>
      <th style="padding:9px 10px;color:#fff;font-size:12px;text-align:right;font-weight:600;">Temp. média</th>
      <th style="padding:9px 10px;color:#fff;font-size:12px;text-align:right;font-weight:600;">Umidade</th>
      <th style="padding:9px 10px;color:#fff;font-size:12px;text-align:right;font-weight:600;">Consumo</th>
      <th style="padding:9px 10px;color:#fff;font-size:12px;text-align:right;font-weight:600;">Ligada</th>
      <th style="padding:9px 10px;color:#fff;font-size:12px;text-align:right;font-weight:600;">Presenças</th>
    </tr>"""

    linhas = ""
    for i, dia in enumerate(historico):
        r   = dia["resumo"]
        bg  = "#e8f4ff" if dia["destaque"] else ("#f9fafb" if i % 2 == 0 else "#ffffff")
        bw  = "font-weight:700;" if dia["destaque"] else ""
        txt = f'{dia["data"]} ★' if dia["destaque"] else dia["data"]

        if r:
            temp    = _fmt(r["temperatura_media"],  "°C")
            umid    = _fmt(r["umidade_media"],       "%")
            consumo = _fmt(r["consumo_total_kwh"],   "kWh")
            ligada  = _fmt(r["pct_ligada"],          "%")
            pres    = str(r["deteccoes_presenca"])
        else:
            temp = umid = consumo = ligada = pres = "—"

        linhas += f"""
        <tr style="background:{bg};">
          <td style="padding:8px 10px;font-size:13px;{bw}color:#1e3a5f;">{txt}</td>
          <td style="padding:8px 10px;font-size:13px;{bw}text-align:right;">{temp}</td>
          <td style="padding:8px 10px;font-size:13px;{bw}text-align:right;">{umid}</td>
          <td style="padding:8px 10px;font-size:13px;{bw}text-align:right;">{consumo}</td>
          <td style="padding:8px 10px;font-size:13px;{bw}text-align:right;">{ligada}</td>
          <td style="padding:8px 10px;font-size:13px;{bw}text-align:right;">{pres}</td>
        </tr>"""

    return f"""
    <h3 style="margin:0 0 10px;font-size:15px;color:#1e3a5f;">Histórico — últimos 7 dias</h3>
    <table width="100%" cellspacing="0" cellpadding="0"
           style="border-collapse:collapse;border-radius:10px;overflow:hidden;">
      {cabecalho}
      {linhas}
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:6px 0 0;text-align:right;">
      ★ = dia anterior (destaque)
    </p>"""


def montar_corpo_email(resumo: dict) -> str:
    corpo = _bloco_ontem(resumo["ontem"], resumo["data_ontem"]) + _tabela_7d(resumo["historico_7d"])

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2d6a9f);
                     padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">ReciLuz</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:14px;">
              Relatório semanal · {resumo['periodo']}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 32px;">
            {corpo}
            <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
              Você recebe este e-mail porque se inscreveu no ReciLuz Dashboard.<br>
              Para cancelar, acesse o dashboard e clique em "Cancelar inscrição".
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ─── envio ────────────────────────────────────────────────────────────────────

def enviar_email(destinatario: str, corpo_html: str, data: str) -> bool:
    if not SMTP_HOST:
        print("[RelatorioService] SMTP não configurado, e-mail não enviado.")
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = f"ReciLuz — Relatório semanal · {data}"
        msg["From"]    = SMTP_FROM
        msg["To"]      = destinatario
        msg.add_alternative(corpo_html, subtype="html")

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as smtp:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.send_message(msg)
        return True
    except Exception as e:
        print(f"[RelatorioService] Erro ao enviar e-mail para {destinatario}: {e}")
        return False


def enviar_relatorio_todos(db: Session) -> int:
    resumo    = gerar_resumo(db)
    corpo     = montar_corpo_email(resumo)
    assinantes = db.query(Assinante).filter(Assinante.ativo == True).all()
    enviados  = 0
    for assinante in assinantes:
        if enviar_email(assinante.email, corpo, resumo["data_relatorio"]):
            enviados += 1
    print(f"[RelatorioService] Relatório enviado para {enviados}/{len(assinantes)} assinante(s).")
    return enviados


# ─── scheduler ────────────────────────────────────────────────────────────────

async def loop_relatorio_diario():
    while True:
        agora   = datetime.now(RECIFE_TZ)
        proximo = agora.replace(hour=HORA_ENVIO, minute=0, second=0, microsecond=0)
        if proximo <= agora:
            proximo += timedelta(days=1)
        segundos = (proximo - agora).total_seconds()
        print(f"[RelatorioService] Próximo envio em {int(segundos // 3600)}h {int((segundos % 3600) // 60)}min.")
        await asyncio.sleep(segundos)
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            await asyncio.to_thread(enviar_relatorio_todos, db)
        finally:
            db.close()
