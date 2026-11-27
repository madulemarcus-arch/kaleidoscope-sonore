# =====================================================================
#  POINT D'ACCES MikroTik (cAP ax, hAP ax2/ax3...)  -  RouterOS 7.13+
#  Associe a : wifi-zone-L009.rsc
# =====================================================================
#  Role : l'AP ne fait QUE du Wi-Fi. Pas de DHCP, pas de NAT, pas de
#  hotspot : tout cela reste sur le L009. L'AP est un simple pont.
#
#  Cablage : cAP ether1 (PoE) -> un port ether3..ether8 du L009.
#            Le L009 alimente l'AP seulement s'il a le PoE-out (ether8) ;
#            sinon utiliser un injecteur / switch PoE.
#
#  Utilisation
#    1) Reset : /system reset-configuration no-defaults=yes skip-backup=yes
#    2) Brancher un PC sur ether1 (IP fixe 192.168.88.x si besoin, ou
#       passer par Winbox en MAC), puis /import file-name=ap-wifi-zone.rsc
#    3) Brancher l'AP au L009. Adresse de gestion : 172.16.0.2
#       (hors de la plage DHCP du L009, qui commence a .10).
#
#  Pour un 2e AP : changer l'identite et l'adresse (172.16.0.3...).
#  Non teste sur un appareil reel : verifier apres import.
# =====================================================================

# ---------- 1. Identite et mot de passe ------------------------------
/system identity set name=AP-ZONE-1
/user set [find name=admin] password="CHANGEZ-MOI-AP-2026"

# ---------- 2. Pont : cable + Wi-Fi ----------------------------------
/interface bridge add name=bridge-ap protocol-mode=rstp
/interface bridge port
add bridge=bridge-ap interface=ether1 comment="Vers L009"
add bridge=bridge-ap interface=wifi1
add bridge=bridge-ap interface=wifi2

# ---------- 3. Reseau : adresse fixe, tout passe par le L009 ---------
/ip address add address=172.16.0.2/22 interface=bridge-ap
/ip route add gateway=172.16.0.1
/ip dns set servers=172.16.0.1
/system ntp client set enabled=yes
/system ntp client servers add address=172.16.0.1
/system clock set time-zone-name=Africa/Kinshasa

# ---------- 4. Wi-Fi : reseau ouvert (le hotspot gere la connexion) ---
# Le portail captif du L009 demande le voucher : le SSID reste ouvert,
# sinon les telephones n'affichent pas la page de connexion.
# Reglez le pays de votre zone (obligatoire pour la puissance/canaux) :
#   /interface wifi configuration set cfg-zone country="<Pays>"
/interface wifi configuration
add name=cfg-zone ssid=WIFI-ZONE mode=ap \
    client-isolation=yes \
    comment="Isolation: les clients ne se voient pas entre eux"

/interface wifi
set wifi1 configuration=cfg-zone configuration.mode=ap channel.band=2ghz-ax channel.width=20mhz disabled=no
set wifi2 configuration=cfg-zone configuration.mode=ap channel.band=5ghz-ax channel.width=20/40/80mhz disabled=no

# ---------- 5. Securite de l'AP (les clients Wi-Fi sont sur le meme L2)
# Seuls le L009 et le reseau d'administration peuvent parler a l'AP.
/ip firewall filter
add chain=input action=accept connection-state=established,related comment="Connexions etablies"
add chain=input action=accept src-address=172.16.0.1 comment="L009"
add chain=input action=accept src-address=192.168.88.0/24 comment="Administration"
add chain=input action=drop comment="Clients Wi-Fi : acces a l'AP interdit"

/ip service
set telnet disabled=yes
set ftp disabled=yes
set www disabled=yes
set www-ssl disabled=yes
set api disabled=yes
set api-ssl disabled=yes
set ssh address=172.16.0.1/32,192.168.88.0/24
set winbox address=172.16.0.1/32,192.168.88.0/24

/ip neighbor discovery-settings set discover-interface-list=none
/tool mac-server set allowed-interface-list=none
/tool mac-server mac-winbox set allowed-interface-list=none
/tool bandwidth-server set enabled=no

# =====================================================================
#  ANCIEN PAQUET "wireless" (hAP ac2, cAP ac...) : remplacer l'etape 4 par
#
#  /interface wireless security-profiles add name=open mode=none
#  /interface wireless
#  set wlan1 mode=ap-bridge ssid=WIFI-ZONE security-profile=open \
#      band=2ghz-g/n channel-width=20mhz default-forwarding=no disabled=no
#  set wlan2 mode=ap-bridge ssid=WIFI-ZONE security-profile=open \
#      band=5ghz-a/n/ac channel-width=20/40/80mhz-Ceee default-forwarding=no disabled=no
#
#  et ajouter wlan1 / wlan2 au pont a l'etape 2 (default-forwarding=no =
#  isolation des clients). Autre marque d'AP : activer "client isolation",
#  mettre le mode pont (pas de DHCP), meme SSID, adresse IP fixe.
# =====================================================================
