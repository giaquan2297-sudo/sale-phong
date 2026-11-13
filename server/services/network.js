import os from 'node:os';

export function getLanIps() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({
          interface: name,
          ip: net.address,
        });
      }
    }
  }
  return ips;
}

export function getNetworkInfo(port = 3000) {
  const lanIps = getLanIps();
  const primaryLan = lanIps[0]?.ip || '127.0.0.1';
  return {
    port: parseInt(port, 10),
    host: process.env.HOST || '0.0.0.0',
    localUrl: `http://localhost:${port}`,
    mobileUrl: `http://${primaryLan}:${port}`,
    lanUrls: lanIps.map((item) => ({
      interface: item.interface,
      ip: item.ip,
      url: `http://${item.ip}:${port}`,
    })),
  };
}
