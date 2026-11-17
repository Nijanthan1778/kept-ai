import { describe, expect, it } from "vitest";
import { IngestionError } from "../src/lib/errors.js";
import { assertPublicUrl, isPublicIp, type HostResolver } from "../src/lib/urlSafety.js";

/** A fake DNS so tests never touch the network. */
function resolverFor(records: Record<string, string[]>): HostResolver {
  return async (hostname) => {
    const addresses = records[hostname];
    if (!addresses) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    return addresses;
  };
}

const dns = resolverFor({
  "example.com": ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"],
  localhost: ["127.0.0.1", "::1"],
  "intranet.corp": ["10.0.0.12"],
  "rebind.example": ["93.184.215.14", "192.168.1.1"],
  "metadata.example": ["169.254.169.254"],
});

describe("isPublicIp", () => {
  it.each([
    "127.0.0.1",
    "127.255.255.254",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
  ])("rejects non-public address %s", (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.215.14", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "accepts public address %s",
    (ip) => {
      expect(isPublicIp(ip)).toBe(true);
    },
  );

  it("rejects strings that are not IP addresses", () => {
    expect(isPublicIp("example.com")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  const check = (url: string) => assertPublicUrl(new URL(url), dns);

  it("allows a public host", async () => {
    await expect(check("https://example.com/article")).resolves.toBeUndefined();
  });

  it.each([
    "http://localhost:4000/items",
    "http://127.0.0.1/",
    "http://[::1]:8080/",
    "http://169.254.169.254/latest/meta-data",
    "http://2130706433/", // decimal form of 127.0.0.1
    "http://0x7f000001/", // hex form of 127.0.0.1
    "http://intranet.corp/",
    "http://metadata.example/",
  ])("blocks %s", async (url) => {
    await expect(check(url)).rejects.toThrow(/private or local network/);
  });

  it("blocks a host if ANY of its addresses is private (mixed DNS answers)", async () => {
    await expect(check("http://rebind.example/")).rejects.toThrow(/private or local network/);
  });

  it("rejects non-http(s) schemes", async () => {
    await expect(check("file:///etc/passwd")).rejects.toThrow(/Only http/);
    await expect(check("ftp://example.com/")).rejects.toThrow(/Only http/);
  });

  it("reports hosts that don't resolve as a user-facing IngestionError", async () => {
    const error = await check("https://no-such-host.invalid/").catch((err: unknown) => err);
    expect(error).toBeInstanceOf(IngestionError);
    expect((error as Error).message).toMatch(/Could not resolve/);
  });
});
