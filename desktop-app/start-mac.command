#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no esta instalado."
  echo "Instalalo desde https://nodejs.org (version LTS, boton verde) y volve a hacer doble clic en este archivo."
  read -p "Presioná Enter para cerrar..."
  exit 1
fi

echo "Bloqueo Operativo necesita tu contraseña de administrador para poder bloquear sitios/apps a nivel de todo el sistema."
echo "(Se usa solo para editar el archivo hosts. El servidor corre únicamente en tu computadora, en localhost.)"
sudo node server.js
