### Task 5: Spec acceptance sweep

- [ ] Inactive not in Quotation / Invoice / POS pickers
- [ ] API 400 on Inactive taxTypeId for quotation create
- [ ] Tax Codes still lists Inactive and can Activate
- [ ] Existing document with that tax still opens for view/edit of historical lines (read path unchanged)
- [ ] Run: `npx vitest run tests/unit/taxManagement/assertActiveTaxTypes.test.js`

---

