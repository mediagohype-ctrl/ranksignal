import { describe, expect, it } from "vitest";
import { bccFor } from "@/lib/email/send";

const LIST = "support@mywebrank.tech, gourav.moksh@gmail.com,ravindranathjha76@gmail.com,, bad-address";

describe("hidden copies of outgoing email", () => {
  it("copies every normal email to the EMAIL_BCC list", () => {
    expect(bccFor({ to: "customer@example.com" }, LIST)).toEqual([
      "support@mywebrank.tech", "gourav.moksh@gmail.com", "ravindranathjha76@gmail.com",
    ]);
  });
  it("never copies one-time login, reset or invite links", () => {
    expect(bccFor({ to: "customer@example.com", private: true }, LIST)).toEqual([]);
  });
  it("doesn't copy the person the email is already going to", () => {
    expect(bccFor({ to: "Support@mywebrank.tech" }, LIST)).not.toContain("support@mywebrank.tech");
  });
  it("is off when EMAIL_BCC is empty", () => {
    expect(bccFor({ to: "a@b.co" }, "")).toEqual([]);
  });
});
