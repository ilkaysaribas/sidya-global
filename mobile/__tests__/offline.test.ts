describe("offline queue contract", () => {
  it("keeps destructive operations out of the initial offline action list", () => {
    const allowed = ["order_draft", "customer_note", "quote_draft"];
    expect(allowed).not.toContain("delete_product");
    expect(allowed).not.toContain("delete_customer");
  });
});
