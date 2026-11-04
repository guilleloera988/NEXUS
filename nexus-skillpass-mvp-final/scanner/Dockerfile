# SkillPass antivirus scanner: ClamAV (clamd + freshclam) behind a small HTTP front (server.mjs).
# Needs about 2 GB of memory: clamd keeps the signature database (~1.2 GB) loaded.
FROM ubuntu:24.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends clamav-daemon clamav-freshclam nodejs ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY clamd.conf /etc/clamav/clamd.conf
COPY server.mjs start.sh /app/
# Files checked out on Windows may carry CRLF line endings, which break the shell script.
RUN sed -i 's/\r$//' /etc/clamav/clamd.conf /app/start.sh \
 && chmod 644 /etc/clamav/clamd.conf /app/server.mjs && chmod 755 /app/start.sh
ENV PORT=8080 CLAMD_SOCKET=/run/clamav/clamd.sock
EXPOSE 8080
CMD ["/app/start.sh"]
