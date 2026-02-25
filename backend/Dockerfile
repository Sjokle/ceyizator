FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Sistem bağımlılıkları (C extensions için)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python bağımlılıkları
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn eventlet

# Uygulama dosyaları
COPY . .

# Logs ve session klasörleri
RUN mkdir -p logs flask_session

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f "http://localhost:5000/api/health?1d8893c5cd2db2db3b1358961f2e25ce7a6efb175430bb3c || exit 1

# Gunicorn + Eventlet (SocketIO için)
CMD ["gunicorn", "-k", "eventlet", "-w", "4", "-b", "0.0.0.0:5000", "--timeout", "120", "--access-logfile", "logs/access.log", "--error-logfile", "logs/error.log", "main:app"]

