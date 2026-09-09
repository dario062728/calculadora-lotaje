const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const MARK_START = '# BLOQUEO-OPERATIVO START (no editar a mano dentro de este bloque)';
const MARK_END = '# BLOQUEO-OPERATIVO END';

function defaultHostsPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

function getHostsPath() {
  return process.env.BLOQUEO_OPERATIVO_HOSTS_PATH || defaultHostsPath();
}

function stripManagedBlock(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.trim() === MARK_START) { inBlock = true; continue; }
    if (line.trim() === MARK_END) { inBlock = false; continue; }
    if (!inBlock) out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join(os.EOL);
}

function domainVariants(domain) {
  const d = domain.replace(/^www\./, '');
  return [d, `www.${d}`];
}

function buildManagedBlock(domains) {
  const lines = [MARK_START];
  domains.forEach((domain) => {
    domainVariants(domain).forEach((host) => {
      lines.push(`127.0.0.1 ${host}`);
    });
  });
  lines.push(MARK_END);
  return lines.join(os.EOL);
}

function readHosts(hostsPath) {
  try {
    return fs.readFileSync(hostsPath, 'utf8');
  } catch (err) {
    throw new Error(`No pude leer el archivo hosts (${hostsPath}): ${err.message}`);
  }
}

function writeHosts(hostsPath, content) {
  try {
    fs.writeFileSync(hostsPath, content, 'utf8');
  } catch (err) {
    const hint = process.platform === 'win32'
      ? 'Probablemente falte ejecutar el launcher como Administrador.'
      : 'Probablemente falte ejecutar el launcher con sudo.';
    throw new Error(`No pude escribir el archivo hosts (${hostsPath}): ${err.message}. ${hint}`);
  }
}

function flushDnsCache() {
  try {
    if (process.platform === 'win32') {
      execSync('ipconfig /flushdns', { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      execSync('dscacheutil -flushcache; killall -HUP mDNSResponder', { stdio: 'ignore' });
    }
  } catch {
    // Best-effort: if this fails the block still applies, just slower to take effect.
  }
}

function applyBlock(domains) {
  const hostsPath = getHostsPath();
  const current = readHosts(hostsPath);
  const cleaned = stripManagedBlock(current);
  const managed = domains && domains.length ? buildManagedBlock(domains) : '';
  const next = managed ? `${cleaned}${os.EOL}${os.EOL}${managed}${os.EOL}` : `${cleaned}${os.EOL}`;
  writeHosts(hostsPath, next);
  flushDnsCache();
  return { hostsPath, blockedDomains: domains || [] };
}

function removeBlock() {
  const hostsPath = getHostsPath();
  const current = readHosts(hostsPath);
  const cleaned = stripManagedBlock(current);
  writeHosts(hostsPath, `${cleaned}${os.EOL}`);
  flushDnsCache();
  return { hostsPath };
}

function isManagedBlockActive() {
  const hostsPath = getHostsPath();
  const current = readHosts(hostsPath);
  return current.includes(MARK_START);
}

module.exports = { applyBlock, removeBlock, isManagedBlockActive, getHostsPath, stripManagedBlock, buildManagedBlock, MARK_START, MARK_END };
