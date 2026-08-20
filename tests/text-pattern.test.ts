import { describe, expect, it } from "vitest";
import {
  emojiCharacters,
  emojiError,
  textCharacters,
  textError,
  textPatternSize,
} from "../lib/text-pattern";

describe("文字与 Emoji 输入", () => {
  it("移除空格并按用户看到的字符计数", () => {
    expect(textCharacters(" 拼 豆 A1 ")).toEqual(["拼", "豆", "A", "1"]);
    expect(textError("一二三四五")).toBe("");
    expect(textError("一二三四五六")).toBe("最多输入 5 个字符。");
  });

  it("文字入口拒绝 Emoji", () => {
    expect(textError("拼豆❤️")).toBe(
      "文字图纸不支持 Emoji，请使用 Emoji 转图纸。",
    );
  });

  it("组合 Emoji 按一个图案计算", () => {
    expect(emojiCharacters("👨‍👩‍👧‍👦")).toEqual(["👨‍👩‍👧‍👦"]);
    expect(emojiCharacters("🇨🇳")).toEqual(["🇨🇳"]);
    expect(emojiError("👍🏽")).toBe("");
  });

  it("Emoji 入口拒绝普通文字、混排和多个 Emoji", () => {
    expect(emojiError("拼")).toBe("请输入 Emoji，不要输入普通文字。");
    expect(emojiError("拼🐱")).toBe("每张图纸只能使用一个 Emoji。");
    expect(emojiError("🐱🐶")).toBe("每张图纸只能使用一个 Emoji。");
  });

  it("多个字增加豆板长度，不压缩单字大小", () => {
    expect(textPatternSize(3, 29, "horizontal")).toEqual({
      width: 93,
      height: 33,
      size: 29,
    });
    expect(textPatternSize(3, 29, "vertical")).toEqual({
      width: 33,
      height: 93,
      size: 29,
    });
  });
});
