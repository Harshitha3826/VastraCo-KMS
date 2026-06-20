FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

RUN groupadd -r app && useradd -r -g app app
USER app

EXPOSE 3004
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3004"]
