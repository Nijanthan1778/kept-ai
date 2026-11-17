import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { IngestionError } from "./errors.js";

/**
 * SSRF protection: the server fetches user-supplied URLs, so it must never be pointed at
 * itself, the local network, or cloud metadata endpoints (e.g. 169.254.169.254).
 */
const NON_PUBLIC_RANGES: Array<[network: string, prefix: number, family: "ipv4" | "ipv6"]> = [
  ["0.0.0.0", 8, "ipv4"], // "this" network
  ["10.0.0.0", 8, "ipv4"], // private
  ["100.64.0.0", 10, "ipv4"], // carrier-grade NAT
  ["127.0.0.0", 8, "ipv4"], // loopback
  ["169.254.0.0", 16, "ipv4"], // link-local, incl. cloud metadata
  ["172.16.0.0", 12, "ipv4"], // private
  ["192.0.0.0", 24, "ipv4"], // IETF protocol assignments
  ["192.0.2.0", 24, "ipv4"], // documentation
  ["192.168.0.0", 16, "ipv4"], // private
  ["198.18.0.0", 15, "ipv4"], // benchmarking
  ["198.51.100.0", 24, "ipv4"], // documentation
  ["203.0.113.0", 24, "ipv4"], // documentation
  ["224.0.0.0", 4, "ipv4"], // multicast
  ["240.0.0.0", 4, "ipv4"], // reserved, incl. broadcast
  ["::", 128, "ipv6"], // unspecified
  ["::1", 128, "ipv6"], // loopback
  // No rule for IPv4-mapped IPv6 (::ffff:a.b.c.d): BlockList already checks those against the
  // IPv4 rules above, and a ::ffff:0:0/96 rule would match *every* IPv4 address.
  ["64:ff9b::", 96, "ipv6"], // NAT64: embeds an IPv4 address
  ["100::", 64, "ipv6"], // discard-only
  ["2001:db8::", 32, "ipv6"], // documentation
  ["fc00::", 7, "ipv6"], // unique local (private)
  ["fe80::", 10, "ipv6"], // link-local
  ["ff00::", 8, "ipv6"], // multicast
];

const nonPublicAddresses = new BlockList();
for (const [network, prefix, family] of NON_PUBLIC_RANGES) {
  nonPublicAddresses.addSubnet(network, prefix, family);
}

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false;
  return !nonPublicAddresses.check(ip, version === 4 ? "ipv4" : "ipv6");
}

export type HostResolver = (hostname: string) => Promise<string[]>;

const resolveWithDns: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

const BLOCKED_MESSAGE = "This URL points to a private or local network address, which can't be fetched";

/**
 * Throws an IngestionError unless the URL is http(s) and every address its host resolves
 * to is public. Checking *all* records stops a host that mixes public and private answers.
 *
 * Limitation: fetch() resolves DNS again, so a hostile DNS server could answer differently
 * the second time (DNS rebinding). Production fix: pin the checked IP in a custom HTTP agent.
 */
export async function assertPublicUrl(url: URL, resolve: HostResolver = resolveWithDns): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new IngestionError("Only http:// and https:// URLs can be fetched");
  }

  const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1"); // IPv6 literals come bracketed
  if (isIP(hostname) !== 0) {
    if (!isPublicIp(hostname)) throw new IngestionError(BLOCKED_MESSAGE);
    return;
  }

  let addresses: string[];
  try {
    addresses = await resolve(hostname);
  } catch (err) {
    throw new IngestionError(`Could not resolve the host "${hostname}"`, { cause: err });
  }

  if (addresses.length === 0 || !addresses.every(isPublicIp)) {
    throw new IngestionError(BLOCKED_MESSAGE);
  }
}
