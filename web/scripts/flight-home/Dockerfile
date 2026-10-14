FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv
COPY requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt
WORKDIR /app
COPY worker.mjs ./worker.mjs
COPY fr24_fetch.py ./src/lib/flights/fr24_fetch.py
ENV FR24_TRANSPORT=curl_cffi FR24_PYTHON=/opt/venv/bin/python FR24_IMPERSONATE=chrome120
CMD ["node", "worker.mjs"]
