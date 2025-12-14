FROM alpine:3.20
WORKDIR /srv

# Descargar pocketbase
RUN apk add --no-cache wget unzip ca-certificates && \
    wget -O pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.22.14/pocketbase_0.22.14_linux_amd64.zip && \
    unzip pb.zip && rm pb.zip && chmod +x /srv/pocketbase

# ✅ Copiar hooks (y opcionalmente pb_migrations si usás)
COPY pb_hooks ./pb_hooks

# (Opcional) si tenés migrations
# COPY pb_migrations ./pb_migrations

# Si NO usás volumen para pb_data, podés copiarlo (pero lo normal es volumen)
# COPY pb_data ./pb_data

EXPOSE 8090
CMD ["/srv/pocketbase", "serve", "--http=0.0.0.0:8090"]
