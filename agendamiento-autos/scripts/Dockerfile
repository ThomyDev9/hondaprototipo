FROM python:3.11-slim
WORKDIR /app/scripts
COPY requirements.txt ./
COPY procesar_solicitudes.py ./
COPY run_loop.sh ./
RUN pip install --no-cache-dir -r requirements.txt
CMD ["/bin/sh", "run_loop.sh"]
