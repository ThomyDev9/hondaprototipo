#!/bin/sh
while true; do
  /usr/local/bin/python3 /app/scripts/procesar_solicitudes.py >> /app/scripts/procesar_solicitudes.log 2>&1
  sleep 300
done
