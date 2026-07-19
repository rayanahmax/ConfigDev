export const calculateSubnet = (ip: string, prefix: number) => {
  const ipParts = ip.split('.').map(Number);
  const ipInt = (ipParts[0] << 24) >>> 0 | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  
  const mask = (~((1 << (32 - prefix)) - 1)) >>> 0;
  const networkInt = (ipInt & mask) >>> 0;
  const broadcastInt = (networkInt | ~mask) >>> 0;

  const intToIp = (num: number) => 
    [(num >>> 24) & 0xFF, (num >>> 16) & 0xFF, (num >>> 8) & 0xFF, num & 0xFF].join('.');

  return {
    network: intToIp(networkInt),
    broadcast: intToIp(broadcastInt),
    netmask: intToIp(mask),
    firstHost: prefix <= 30 ? intToIp(networkInt + 1) : "N/A",
    lastHost: prefix <= 30 ? intToIp(broadcastInt - 1) : "N/A",
    numHosts: Math.max(0, Math.pow(2, 32 - prefix) - 2)
  };
};