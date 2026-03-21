import { describe, expect, test } from "vite-plus/test";
import { parseQuery } from "../src/query.ts";

describe("parseQuery", () => {
  test("empty string returns empty object", () => {
    expect(parseQuery("")).toEqual({});
  });

  test("lone question mark returns empty object", () => {
    expect(parseQuery("?")).toEqual({});
  });

  test("single key-value pair", () => {
    expect(parseQuery("?foo=bar")).toEqual({ foo: "bar" });
  });

  test("without leading question mark", () => {
    expect(parseQuery("foo=bar")).toEqual({ foo: "bar" });
  });

  test("multiple key-value pairs", () => {
    expect(parseQuery("?a=1&b=2&c=3")).toEqual({ a: "1", b: "2", c: "3" });
  });

  test("key without value gives empty string", () => {
    expect(parseQuery("?flag")).toEqual({ flag: "" });
  });

  test("key with empty value", () => {
    expect(parseQuery("?key=")).toEqual({ key: "" });
  });

  test("duplicate keys produce array", () => {
    const result = parseQuery("?tag=a&tag=b&tag=c");
    expect(result.tag).toEqual(["a", "b", "c"]);
  });

  test("duplicate keys with two values produce array", () => {
    const result = parseQuery("?x=1&x=2");
    expect(result.x).toEqual(["1", "2"]);
  });

  test("mixed single and duplicate keys", () => {
    const result = parseQuery("?a=1&b=2&a=3");
    expect(result.a).toEqual(["1", "3"]);
    expect(result.b).toBe("2");
  });

  test("decodes URI-encoded keys and values", () => {
    expect(parseQuery("?hello%20world=foo%20bar")).toEqual({ "hello world": "foo bar" });
  });

  test("decodes plus signs as spaces", () => {
    expect(parseQuery("?q=hello+world")).toEqual({ q: "hello world" });
  });

  test("handles special characters", () => {
    expect(parseQuery("?email=user%40example.com")).toEqual({ email: "user@example.com" });
  });

  test("skips empty pairs from double ampersands", () => {
    const result = parseQuery("?a=1&&b=2");
    expect(result).toEqual({ a: "1", b: "2" });
  });

  test("value with equals sign", () => {
    expect(parseQuery("?expr=a=b")).toEqual({ expr: "a=b" });
  });

  test("malformed percent-encoding does not throw", () => {
    expect(parseQuery("?bad=%E0%A4%A")).toEqual({ bad: "%E0%A4%A" });
  });
});
