FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir -U pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

ENV MCP_PORT=8080
EXPOSE 8080

CMD ["python", "server.py"]