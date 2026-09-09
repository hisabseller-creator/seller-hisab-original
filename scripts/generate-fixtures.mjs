import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import * as XLSX from "xlsx";

const root = path.resolve("tests/fixtures");
await fs.mkdir(root, { recursive: true });

const payments = [
  ["Sub Order Number", "Order ID", "Supplier SKU", "Order Status", "Selling Price", "Net Settlement Amount", "Settlement Date"],
  ["SO-1001", "O-501", "SKU-BLUE-M", "Delivered", 649, 548, "2026-08-02"],
  ["SO-1002", "O-502", "SKU-BOX-6", "RTO", 399, -76, "2026-08-03"],
  ["SO-1003", "O-503", "SKU-SANDAL-6", "Customer Return", 549, -126, "2026-08-04"],
  ["SO-1004", "O-504", "SKU-PENDING", "Shipped", 299, 0, "2026-08-05"],
];
const orders = [
  ["Order Status", "Selling Price", "Supplier SKU", "Sub Order Number", "Order ID", "Order Date", "Extra Column"],
  ["Delivered", 649, "SKU-BLUE-M", "SO-1001", "O-501", "2026-08-01", "ignored"],
  ["RTO", 399, "SKU-BOX-6", "SO-1002", "O-502", "2026-08-01", "ignored"],
  ["Customer Return", 549, "SKU-SANDAL-6", "SO-1003", "O-503", "2026-08-01", "ignored"],
  ["Shipped", 299, "SKU-PENDING", "SO-1004", "O-504", "2026-08-01", "ignored"],
];
const reordered = [
  ["Unrelated", "Net Settlement Amount", "Supplier SKU", "Settlement Date", "Sub Order Number", "Order Status", "Selling Price"],
  ["x", 548, "SKU-BLUE-M", "2026-08-02", "SO-1001", "Delivered", 649],
];
const quoted = 'Sub Order Number,Supplier SKU,Order Status,Selling Price,Net Settlement Amount\n"SO,2001","SKU,COMMA",Delivered,499,401\n';
const costs = "SKU,Product Cost,Packaging Cost,Variable Cost\nSKU-BLUE-M,305,14,0\nSKU-BOX-6,290,21,0\nSKU-SANDAL-6,380,18,0\nSKU-PENDING,115,12,0\n";
const unknown = "Random Ref,Item,Moneyish,State\nX1,SKU-1,500,Done\n";
const formula = "Sub Order Number,Supplier SKU,Order Status,Selling Price,Net Settlement Amount\nSO-3001,=HYPERLINK(\"https://bad.invalid\"),Delivered,499,401\n";
const ads = [
  ["Supplier SKU", "Ad Spend", "Attributed Sales"],
  ["SKU-BLUE-M", 120, 649],
  ["SKU-SANDAL-6", 90, 549],
];
const invalidValues = [
  ["Sub Order Number", "Supplier SKU", "Order Status", "Selling Price", "Net Settlement Amount", "Settlement Date"],
  ["SO-BAD-SALE", "SKU-BAD", "Delivered", -499, 400, "2026-08-10"],
  ["SO-BAD-DATE", "SKU-BLUE-M", "Delivered", 499, 400, "not-a-date"],
];

await fs.writeFile(path.join(root, "payments-basic.csv"), toCsv(payments));
await fs.writeFile(path.join(root, "orders-basic.csv"), toCsv(orders));
await fs.writeFile(path.join(root, "payments-reordered.csv"), toCsv(reordered));
await fs.writeFile(path.join(root, "payments-quoted-commas.csv"), quoted);
await fs.writeFile(path.join(root, "costs-basic.csv"), costs);
await fs.writeFile(path.join(root, "unknown-format.csv"), unknown);
await fs.writeFile(path.join(root, "formula-injection.csv"), formula);
await fs.writeFile(path.join(root, "ads-basic.csv"), toCsv(ads));
await fs.writeFile(path.join(root, "payments-invalid-values.csv"), toCsv(invalidValues));

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(payments), "Payments");
await fs.writeFile(path.join(root, "payments-basic.xlsx"), XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

const validZip = new JSZip();
validZip.file("payments/payments-basic.csv", toCsv(payments));
validZip.file("orders/orders-basic.csv", toCsv(orders));
await fs.writeFile(path.join(root, "valid-reports.zip"), await validZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

const unsafeZip = new JSZip();
unsafeZip.file("../escape.csv", toCsv(payments));
await fs.writeFile(path.join(root, "unsafe-path.zip"), await unsafeZip.generateAsync({ type: "nodebuffer" }));

const bombZip = new JSZip();
bombZip.file("payments.csv", "0".repeat(1_500_000));
await fs.writeFile(path.join(root, "compression-bomb.zip"), await bombZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } }));

const large = [["Sub Order Number", "Supplier SKU", "Order Status", "Selling Price", "Net Settlement Amount", "Settlement Date"]];
for (let index = 0; index < 10_050; index += 1) large.push([`SO-L-${index}`, `SKU-${index % 100}`, index % 10 === 0 ? "RTO" : "Delivered", 499, index % 10 === 0 ? -80 : 410, "2026-08-10"]);
await fs.writeFile(path.join(root, "payments-large-10050.csv"), toCsv(large));

function toCsv(rows) {
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\n") + "\n";
}
