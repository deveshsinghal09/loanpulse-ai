FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    MODEL_ARTIFACT_PATH=/app/artifacts/production
WORKDIR /app
COPY pyproject.toml requirements-ml.txt ./
COPY ml/src ./ml/src
RUN pip install --no-cache-dir .
COPY --chown=10001:10001 artifacts/production ./artifacts/production
RUN useradd --create-home --uid 10001 loanpulse
USER loanpulse
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health')"
CMD ["loanpulse-serve"]
