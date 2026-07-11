import { customerSchema, orderSchema, signInSchema } from "../src/schemas/forms";

describe("mobile form schemas", () => {
  it("accepts a valid sign in form", () => {
    expect(signInSchema.parse({ email: "export@sidyaglobal.com", password: "secret123", remember: true }).email).toBe("export@sidyaglobal.com");
  });

  it("rejects invalid email", () => {
    expect(() => signInSchema.parse({ email: "bad", password: "secret123", remember: true })).toThrow();
  });

  it("accepts a minimal customer", () => {
    expect(customerSchema.parse({ company_name: "ABC Export" }).company_name).toBe("ABC Export");
  });

  it("requires at least one order line", () => {
    expect(() => orderSchema.parse({ customer_id: "1", currency: "USD", exchange_rate: 1, lines: [] })).toThrow();
  });
});
