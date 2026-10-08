# CISPOLstore - preparation du RB4011 pour la caisse locale
# A importer APRES avoir cree l'utilisateur "caisse" (voir LISEZ-MOI.txt, etape B).
# La caisse doit avoir l'adresse fixe 192.168.88.2 sur ether10 (port ADMIN).

# Acces de la caisse au routeur (API REST via le service www), reserve au reseau admin
/ip service set www disabled=no address=192.168.88.0/24

# Le vendeur peut ouvrir la caisse depuis le WiFi de la zone, sans ticket
/ip firewall filter add chain=forward in-interface=bridge-hotspot dst-address=192.168.88.2 protocol=tcp dst-port=8080 action=accept comment="Caisse locale" place-before=[find comment="Clients ne voient pas le reseau admin"]
/ip hotspot walled-garden ip add dst-address=192.168.88.2 protocol=tcp dst-port=8080 action=accept server=hotspot-cispol comment="Caisse locale"

# Adresse facile a retenir : http://caisse.cispol:8080
/ip dns static add name=caisse.cispol address=192.168.88.2 comment="Caisse locale"

:log info "CISPOLstore: routeur prepare pour la caisse locale"
