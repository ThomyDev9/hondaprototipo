import imaplib
import datetime

print("Ejecución:", datetime.datetime.now(), flush=True)
import email
import re
import os
import requests
import json
from datetime import datetime, date, timezone

# ==============================
# ARCHIVO CONTROL ULTIMA FECHA
# ==============================
control_file = "ultima_fecha.txt"

ultima_fecha = None

if os.path.exists(control_file):
    with open(control_file, "r") as f:
        ultima_fecha_str = f.read().strip()
        if ultima_fecha_str:
            # La fecha guardada ya está en UTC sin zona
            ultima_fecha = datetime.strptime(ultima_fecha_str, "%Y-%m-%d %H:%M:%S")

print("Última fecha registrada:", ultima_fecha)

# ==============================
# CONFIGURACIÓN
# ==============================
IMAP_SERVER = "mail.kimobill.com"
EMAIL_ACCOUNT = "leads_maquitacushunchic@kimobill.com"
PASSWORD = "iE8h1wv}hat_+W{{"

WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxVLT-9LoM2Gh8OduwZt_GFPft9sQPSPV5FLi2ucrKTAyKq39cx-_ohNCC30trDijY37A/exec"

# ==============================
# CARPETA PDF EN SERVIDOR
# ==============================

fecha_hoy = date.today().strftime("%Y-%m-%d")
network_base = "/app/maquita"
pdf_folder = os.path.join(network_base, f"pdf_{fecha_hoy}")
os.makedirs(pdf_folder, exist_ok=True)

# Ruta adicional para guardar PDFs (usando variable de entorno o ruta relativa)
pdf_folder_extra = os.environ.get("UPLOADS_PATH")
if not pdf_folder_extra:
    # Por defecto, usa la carpeta uploads relativa al script
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pdf_folder_extra = os.path.join(base_dir, "uploads")
os.makedirs(pdf_folder_extra, exist_ok=True)

print("Guardando PDFs en:", pdf_folder)
print("Guardando PDFs también en:", pdf_folder_extra)

# ==============================
# CONECTAR CORREO
# ==============================
mail = imaplib.IMAP4_SSL(IMAP_SERVER)
mail.login(EMAIL_ACCOUNT, PASSWORD)
mail.select("inbox")

# ==============================
# BUSCAR CORREOS
# ==============================
if ultima_fecha:
    print("Buscando correos desde:", ultima_fecha)
    imap_date = ultima_fecha.strftime("%d-%b-%Y")
else:
    print("Primera ejecución → tomando desde el día 1 del mes")
    first_day = datetime.today().replace(day=1)
    imap_date = first_day.strftime("%d-%b-%Y")

status, messages = mail.search(None, f'(FROM "maquita.fin.ec" SINCE {imap_date})')

email_ids = messages[0].split()
print("Correos encontrados:", len(email_ids))

# ==============================
# PROCESAR CORREOS
# ==============================
ultima_fecha_procesada = ultima_fecha

for num in email_ids:

    status, msg_data = mail.fetch(num, "(RFC822)")

    for response_part in msg_data:
        if not isinstance(response_part, tuple):
            continue

        msg = email.message_from_bytes(response_part[1])

        # ==============================
        # FECHA REAL DEL CORREO (CON ZONA HORARIA CORRECTA)
        # ==============================
        fecha_email_raw = msg.get("Date")
        fecha_email = email.utils.parsedate_to_datetime(fecha_email_raw)

        # Convertir todo a UTC
        fecha_email = fecha_email.astimezone(timezone.utc)

        # Quitar zona horaria para comparar
        fecha_email = fecha_email.replace(tzinfo=None)

        # FILTRO PARA EVITAR DUPLICADOS
        if ultima_fecha and fecha_email <= ultima_fecha:
            continue

        fecha_email_str = fecha_email.isoformat()

        # ==============================
        # OBTENER CUERPO DEL CORREO
        # ==============================
        body = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()

                if content_type == "text/plain":
                    body = part.get_payload(decode=True).decode(errors="ignore")
                    break
                elif content_type == "text/html" and not body:
                    body = part.get_payload(decode=True).decode(errors="ignore")
        else:
            body = msg.get_payload(decode=True).decode(errors="ignore")

        body = re.sub("<.*?>", "", body)

        def extraer(campo):
            match = re.search(rf"{campo}:\s*(.+)", body)
            return match.group(1).strip() if match else ""

        nombres = extraer("Nombres completos")
        provincia = extraer("Provincia")
        cedula = extraer("Nº de cédula")
        estado = extraer("Estado civil")
        actividad = extraer("Actividad económica")
        tel_dom = extraer("Teléfono Domicilio")
        tel_cel = extraer("Teléfono Celular")

        if not cedula:
            continue

        print("Enviando:", nombres)

        # ==============================
        # ENVIAR A GOOGLE SHEETS
        # ==============================
        payload = {
            "fecha": fecha_email_str,
            "nombres": nombres,
            "provincia": provincia,
            "cedula": cedula,
            "estado": estado,
            "actividad": actividad,
            "tel_dom": tel_dom,
            "tel_cel": tel_cel,
        }

        try:
            response = requests.post(
                WEBAPP_URL,
                data=json.dumps(payload),
                headers={"Content-Type": "application/json"},
            )
            print("Status Code:", response.status_code)
        except Exception as e:
            print("Error enviando a Google:", e)

        # ==============================
        # DESCARGAR PDF
        # ==============================
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if "pdf" in content_type.lower() or "pdf" in content_disposition.lower():

                payload_pdf = part.get_payload(decode=True)

                if payload_pdf:
                    safe_name = nombres.replace(" ", "_")
                    new_filename = f"{cedula}_{safe_name}.pdf"
                    new_filename = re.sub(r'[<>:"/\\|?*]', "", new_filename)

                    filepath = os.path.join(pdf_folder, new_filename)
                    filepath_extra = os.path.join(pdf_folder_extra, new_filename)

                    with open(filepath, "wb") as f:
                        f.write(payload_pdf)
                    with open(filepath_extra, "wb") as f:
                        f.write(payload_pdf)

                    print("PDF guardado:", new_filename)
                    print("PDF también guardado en uploads:", new_filename)
                    break

        # Actualizar última fecha procesada
        if not ultima_fecha_procesada or fecha_email > ultima_fecha_procesada:
            ultima_fecha_procesada = fecha_email

# ==============================
# GUARDAR ULTIMA FECHA PROCESADA
# ==============================
if ultima_fecha_procesada:
    with open(control_file, "w") as f:
        f.write(ultima_fecha_procesada.strftime("%Y-%m-%d %H:%M:%S"))

    print("Nueva última fecha guardada:", ultima_fecha_procesada)

mail.logout()
print("Proceso terminado.")
