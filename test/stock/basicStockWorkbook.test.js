import { describe, expect, it } from 'vitest';
import {
  BASIC_STOCK_COLUMNS,
  buildBasicStockWorkbookBuffer,
  parseBasicStockWorkbook,
  validateBasicStockRawRow,
} from '../../lib/stock/basicStockWorkbook.js';

describe('basic stock workbook', () => {
  it('exposes exactly four columns', () => {
    expect(BASIC_STOCK_COLUMNS).toEqual(['Item Name', 'Quantity', 'Order Price', 'Selling Price']);
  });

  it('round-trips a workbook and skips example rows', async () => {
    const buffer = await buildBasicStockWorkbookBuffer(
      [{ itemName: 'Cooking Oil', quantity: 5, orderPrice: 160, sellingPrice: 200 }],
      { includeExample: true }
    );
    const parsed = await parseBasicStockWorkbook(buffer);
    expect(parsed.fileHash).toMatch(/^[a-f0-9]{64}$/);
    const example = parsed.rows.find((r) => r.skip);
    expect(example?.reason).toBe('EXAMPLE_ROW');
    const data = parsed.rows.find((r) => !r.skip);
    const validated = validateBasicStockRawRow(data);
    expect(validated).toMatchObject({
      status: 'VALID',
      itemName: 'Cooking Oil',
      quantity: 5,
      orderPrice: 160,
      sellingPrice: 200,
    });
  });

  it('rejects missing columns', async () => {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock');
    ws.addRow(['Item Name', 'Quantity']);
    ws.addRow(['Oil', 1]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(parseBasicStockWorkbook(buffer)).rejects.toMatchObject({
      code: 'MISSING_STOCK_IMPORT_COLUMN',
    });
  });
});
