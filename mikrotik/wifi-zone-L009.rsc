# =====================================================================
#  MikroTik L009 - WIFI ZONE (hotspot a vouchers) + ANTI-PARTAGE
#  RouterOS 7.x   -   A importer sur un routeur REMIS A ZERO
# =====================================================================
#  ATTENTION : le L009 n'a PAS de Wi-Fi integre. Branchez un point
#  d'acces (cAP ax, hAP, Ubiquiti...) en mode pont/AP sur ether3..ether8.
#
#  Plan des ports
#    ether1        -> WAN (Internet, DHCP client)
#    ether2        -> ADMIN (votre PC, 192.168.88.0/24)
#    ether3-ether8 -> points d'acces Wi-Fi (reseau clients 172.16.0.0/22)
#    sfp1          -> optionnel (2e AP / lien fibre), meme reseau clients
#
#  Utilisation
#    1) Reset sans config par defaut :
#         /system reset-configuration no-defaults=yes skip-backup=yes
#    2) Televerser ce fichier (Winbox > Files), puis :
#         /import file-name=wifi-zone-L009.rsc
#    3) Se reconnecter sur ether2 : 192.168.88.1 (admin, mot de passe
#       defini plus bas).
#
#  A MODIFIER avant import : mot de passe admin, nom de la zone,
#  debits dans les profils, DNS.
#  Non teste sur un routeur reel : verifier apres import (voir fin).
# =====================================================================

# ---------- 1. Identite et mot de passe ------------------------------
/system identity set name=WIFI-ZONE
/user set [find name=admin] password="CHANGEZ-MOI-2026"

# ---------- 2. Interfaces, ponts, listes -----------------------------
/interface list add name=WAN
/interface list add name=LAN
/interface list add name=MGMT

/interface bridge add name=bridge-hs comment="Reseau clients hotspot" protocol-mode=rstp

# Ports AP : horizon=1 => les ports ne se parlent pas entre eux (isolation)
/interface bridge port
add bridge=bridge-hs interface=ether3 horizon=1
add bridge=bridge-hs interface=ether4 horizon=1
add bridge=bridge-hs interface=ether5 horizon=1
add bridge=bridge-hs interface=ether6 horizon=1
add bridge=bridge-hs interface=ether7 horizon=1
add bridge=bridge-hs interface=ether8 horizon=1
add bridge=bridge-hs interface=sfp1   horizon=1

/interface list member
add list=WAN  interface=ether1
add list=LAN  interface=bridge-hs
add list=MGMT interface=ether2

# ---------- 3. Adresses IP -------------------------------------------
/ip address
add address=192.168.88.1/24 interface=ether2    comment="Administration"
add address=172.16.0.1/22   interface=bridge-hs comment="Clients Wi-Fi zone"

/ip dhcp-client add interface=ether1 use-peer-dns=no use-peer-ntp=no add-default-route=yes comment="WAN"

# ---------- 4. DNS, NTP ----------------------------------------------
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8 cache-size=4096KiB
/ip dns static add name=wifi.zone address=172.16.0.1 comment="Nom de la page de connexion"
/system ntp client set enabled=yes
/system ntp client servers add address=pool.ntp.org
/system clock set time-zone-name=Africa/Kinshasa

# ---------- 5. DHCP : admin et clients -------------------------------
/ip pool add name=pool-admin ranges=192.168.88.10-192.168.88.50
/ip dhcp-server add name=dhcp-admin interface=ether2 address-pool=pool-admin lease-time=1d
/ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1

/ip pool add name=pool-hs ranges=172.16.0.10-172.16.3.250
# Bail court : les adresses se liberent vite quand un client part
/ip dhcp-server add name=dhcp-hs interface=bridge-hs address-pool=pool-hs lease-time=1h \
    add-arp=no comment="DHCP clients zone"
/ip dhcp-server network add address=172.16.0.0/22 gateway=172.16.0.1 dns-server=172.16.0.1

# ---------- 6. Hotspot -----------------------------------------------
/ip hotspot profile
add name=prof-zone hotspot-address=172.16.0.1 dns-name=wifi.zone html-directory=hotspot \
    login-by=http-chap,cookie http-cookie-lifetime=1d split-user-domain=no use-radius=no

# --- Profils d'utilisateurs (forfaits) ---
# ANTI-PARTAGE integre a chaque profil :
#   shared-users=1  -> un seul appareil connecte par voucher en meme temps
#   on-login        -> LIE le voucher a la MAC du 1er appareil (impossible
#                      de le reutiliser sur un autre telephone)
#   idle/keepalive  -> deconnecte les appareils inactifs / partis
:local bind "{:local u \$user; :local m \$\"mac-address\"; :if ([/ip hotspot user get [find name=\$u] mac-address]=00:00:00:00:00:00) do={/ip hotspot user set [find name=\$u] mac-address=\$m}}"

/ip hotspot user profile
add name=1h     rate-limit=2M/2M   shared-users=1 session-timeout=1h  idle-timeout=5m keepalive-timeout=2m \
    status-autorefresh=1m add-mac-cookie=no on-login=$bind
add name=3h     rate-limit=3M/3M   shared-users=1 session-timeout=3h  idle-timeout=5m keepalive-timeout=2m \
    status-autorefresh=1m add-mac-cookie=no on-login=$bind
add name=1jour  rate-limit=3M/3M   shared-users=1 session-timeout=1d  idle-timeout=10m keepalive-timeout=2m \
    status-autorefresh=1m add-mac-cookie=yes mac-cookie-timeout=1d on-login=$bind
add name=1semaine rate-limit=4M/4M shared-users=1 session-timeout=1d  idle-timeout=10m keepalive-timeout=2m \
    status-autorefresh=1m add-mac-cookie=yes mac-cookie-timeout=3d on-login=$bind

# addresses-per-mac=1 : une seule adresse IP par appareil (stoppe les
# astuces de MAC clonee / plusieurs IP sur une meme carte)
/ip hotspot add name=hotspot-zone interface=bridge-hs address-pool=pool-hs profile=prof-zone \
    addresses-per-mac=1 idle-timeout=5m keepalive-timeout=2m login-timeout=none disabled=no

# Sites accessibles AVANT connexion (page de paiement, etc.) : a completer
# /ip hotspot walled-garden add dst-host=*.exemple.com comment="Avant login"

# Utilisateur de test (supprimez-le apres essai)
/ip hotspot user add name=test password=test profile=1h limit-uptime=30m comment="TEST - A SUPPRIMER"

# ---------- 7. Generateur de vouchers --------------------------------
# Lancer :  /system script run gen-vouchers   (modifier n, profil, duree)
/system script add name=gen-vouchers policy=read,write,policy,test source={
  :local n 20;
  :local prof "1h";
  :local dur 1h;
  :local chars "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  :for i from=1 to=$n do={
    :local c "";
    :for j from=1 to=6 do={
      :set c ($c . [:pick $chars [:rndnum from=0 to=([:len $chars]-1)]]);
    }
    /ip hotspot user add name=$c password=$c profile=$prof limit-uptime=$dur comment=("voucher " . [/system clock get date]);
  }
}

# Nettoyage : supprime les vouchers dont le temps est entierement consomme
/system script add name=clean-vouchers policy=read,write,policy,test source={
  :foreach u in=[/ip hotspot user find where name!="admin" and comment~"voucher"] do={
    :local lu [/ip hotspot user get $u limit-uptime];
    :if ($lu > 0s && [/ip hotspot user get $u uptime] >= $lu) do={ /ip hotspot user remove $u }
  }
}
/system scheduler add name=clean-vouchers interval=1h on-event="/system script run clean-vouchers" start-time=startup

# ---------- 8. ANTI-PARTAGE : TTL (tethering / routeur derriere un client)
# a) Les paquets envoyes AUX clients ont un TTL de 1 : un telephone en
#    "point d'acces" ne peut pas les relayer vers un 2e appareil.
/ip firewall mangle
add chain=postrouting out-interface=bridge-hs action=change-ttl new-ttl=set:1 passthrough=yes \
    comment="ANTI-PARTAGE: TTL=1 vers les clients"

# b) Un appareil directement connecte arrive avec TTL 64 (Android, iOS,
#    Linux) ou 128 (Windows). TTL 63 / 127 = il passe par un autre routeur
#    (partage de connexion) -> l'adresse IP est mise en liste noire 1 jour.
add chain=prerouting in-interface=bridge-hs ttl=equal:63  action=add-src-to-address-list \
    address-list=partage-detecte address-list-timeout=1d passthrough=no comment="ANTI-PARTAGE: TTL 63 (Android/iOS/Linux partage)"
add chain=prerouting in-interface=bridge-hs ttl=equal:127 action=add-src-to-address-list \
    address-list=partage-detecte address-list-timeout=1d passthrough=no comment="ANTI-PARTAGE: TTL 127 (Windows partage)"

# ---------- 9. Pare-feu ----------------------------------------------
/ip firewall filter
# --- INPUT (vers le routeur) ---
add chain=input action=accept connection-state=established,related,untracked comment="Connexions etablies"
add chain=input action=drop connection-state=invalid comment="Invalides"
add chain=input action=drop src-address-list=partage-detecte comment="ANTI-PARTAGE: liste noire (input)"
add chain=input action=accept protocol=icmp limit=20,5:packet comment="Ping limite"
add chain=input action=accept in-interface-list=MGMT comment="Administration depuis ether2 uniquement"
add chain=input action=accept in-interface-list=LAN protocol=udp dst-port=53,67 comment="DNS + DHCP clients"
add chain=input action=accept in-interface-list=LAN protocol=tcp dst-port=53 comment="DNS TCP clients"
add chain=input action=drop in-interface-list=WAN comment="Tout le reste du WAN : refuse"
add chain=input action=drop comment="Tout le reste : refuse"

# --- FORWARD (a travers le routeur) ---
add chain=forward action=accept connection-state=established,related,untracked comment="Connexions etablies"
add chain=forward action=drop connection-state=invalid comment="Invalides"
add chain=forward action=drop src-address-list=partage-detecte comment="ANTI-PARTAGE: liste noire (forward)"
add chain=forward action=drop in-interface-list=WAN connection-nat-state=!dstnat comment="WAN: pas de connexions entrantes"
add chain=forward action=drop in-interface=bridge-hs dst-address=192.168.88.0/24 comment="Clients -> reseau admin interdit"
add chain=forward action=drop in-interface=bridge-hs dst-address=172.16.0.0/22 comment="Isolation client a client (trafic route seulement ; l'isolation Wi-Fi se fait sur l'AP)"
# Limite de connexions par client (bloque torrent / gros partage)
add chain=forward action=drop protocol=tcp src-address=172.16.0.0/22 connection-limit=300,32 comment="ANTI-ABUS: max 300 connexions TCP par client"
add chain=forward action=drop protocol=udp src-address=172.16.0.0/22 connection-limit=300,32 comment="ANTI-ABUS: max 300 connexions UDP par client"
add chain=forward action=drop protocol=tcp dst-port=25,465,587 in-interface=bridge-hs comment="Anti-spam: SMTP bloque"
add chain=forward action=drop protocol=tcp dst-port=135,137-139,445 in-interface=bridge-hs comment="Ports Windows/SMB bloques"

# --- NAT ---
/ip firewall nat add chain=srcnat out-interface-list=WAN action=masquerade comment="Sortie Internet"

# ---------- 10. Durcissement du routeur ------------------------------
/ip service
set telnet disabled=yes
set ftp disabled=yes
set www disabled=yes
set www-ssl disabled=yes
set api disabled=yes
set api-ssl disabled=yes
set ssh address=192.168.88.0/24
set winbox address=192.168.88.0/24

/ip neighbor discovery-settings set discover-interface-list=MGMT
/tool mac-server set allowed-interface-list=MGMT
/tool mac-server mac-winbox set allowed-interface-list=MGMT
/tool bandwidth-server set enabled=no
/ip proxy set enabled=no
/ip socks set enabled=no
/ip upnp set enabled=no
/ip cloud set ddns-enabled=no update-time=no
/ip ssh set strong-crypto=yes

# ---------- 11. Journal (utile pour voir les abus) -------------------
/system logging add topics=hotspot,info,debug action=memory
/system logging add topics=firewall action=memory

# =====================================================================
#  APRES L'IMPORT - A VERIFIER
#    * /ip hotspot print            -> hotspot-zone actif
#    * /ip firewall address-list print where list=partage-detecte
#      (les IP detectees comme "partage" apparaissent ici)
#    * Sur chaque point d'acces Wi-Fi : activer l'isolation des clients
#      ("client isolation" / "forwarding=no") et le brancher en pont.
#    * Supprimer l'utilisateur "test".
#    * Si un client legitime est bloque a tort par la regle TTL, retirer
#      son IP :  /ip firewall address-list remove [find address=172.16.x.x]
#      ou desactiver les 2 regles mangle "ANTI-PARTAGE: TTL 63 / 127".
#    * Personnaliser la page de connexion : dossier "hotspot" (Files).
# =====================================================================
