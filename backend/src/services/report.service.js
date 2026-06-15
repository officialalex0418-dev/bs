import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Setting from '../models/Setting.js';

let APP_NAME = 'Business Sarthi';

function imageBuffer(source) {
  if (!source || typeof source !== 'string') return null;
  const match = source.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], 'base64');
}

/**
 * Stream an Excel workbook to the response.
 * columns: [{ header, key, width }], rows: array of objects
 */
export async function sendExcel(res, { filename, sheetName, columns, rows }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Business Sarthi';
  const ws = wb.addWorksheet(sheetName || 'Report');
  ws.columns = columns;

  // header style
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  ws.getRow(1).height = 22;

  rows.forEach((r) => ws.addRow(r));
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

/**
 * Stream a simple tabular PDF report.
 * sections: [{ heading, lines: [string] , table?: { headers: [], rows: [[]] } }]
 */
export function sendPdf(res, { filename, title, subtitle, sections = [], company = null }) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  const appLogo = imageBuffer(company?.appLogo);
  const companyLogo = imageBuffer(company?.logo);
  const appName = company?.appName || APP_NAME;

  doc.rect(0, 0, doc.page.width, 88).fill('#2563eb');
  if (appLogo) doc.image(appLogo, 40, 16, { fit: [48, 48] });
  else {
    doc.roundedRect(40, 16, 48, 48, 12).fill('#1d4ed8');
    doc.fill('#ffffff').fontSize(14).font('Helvetica-Bold').text('BS', 40, 31, { width: 48, align: 'center' });
  }
  doc.fill('#ffffff').fontSize(18).font('Helvetica-Bold').text(appName, 96, 24);
  doc.fontSize(9).font('Helvetica').text(new Date().toLocaleString(), 96, 48);

  if (company?.name) {
    if (companyLogo) doc.image(companyLogo, doc.page.width - 92, 16, { fit: [48, 48] });
    else {
      doc.roundedRect(doc.page.width - 92, 16, 48, 48, 10).fill('#1d4ed8');
      doc.fill('#ffffff').fontSize(14).font('Helvetica-Bold').text((company.name || 'C').slice(0, 2).toUpperCase(), doc.page.width - 92, 32, { width: 48, align: 'center' });
    }
    doc.fill('#ffffff').fontSize(10).font('Helvetica-Bold').text(company.name, 168, 24, { align: 'right', width: doc.page.width - 260 });
    const detailLines = [company.email, company.phone, company.address].filter(Boolean);
    doc.fill('#dbeafe').fontSize(8).font('Helvetica').text(detailLines.join(' · '), 168, 42, { align: 'right', width: doc.page.width - 260 });
  }
  doc.moveDown(2);
  doc.fill('#0f172a').fontSize(16).font('Helvetica-Bold').text(title, 40, 90);
  if (subtitle) doc.fontSize(10).fill('#64748b').font('Helvetica').text(subtitle);
  doc.moveDown();

  for (const sec of sections) {
    doc.moveDown(0.5);
    if (sec.heading) {
      doc.fontSize(12).fill('#2563eb').font('Helvetica-Bold').text(sec.heading);
      doc.moveDown(0.3);
    }
    if (sec.lines) {
      doc.fontSize(10).fill('#334155').font('Helvetica');
      sec.lines.forEach((l) => doc.text(l));
    }
    if (sec.table) {
      const { headers, rows } = sec.table;
      const colWidth = (doc.page.width - 80) / headers.length;
      let y = doc.y + 6;
      // header
      doc.fontSize(9).font('Helvetica-Bold').fill('#0f172a');
      headers.forEach((h, i) => doc.text(String(h), 40 + i * colWidth, y, { width: colWidth - 6 }));
      y = doc.y + 4;
      doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#cbd5e1').stroke();
      // rows
      doc.font('Helvetica').fill('#334155');
      for (const row of rows) {
        y = doc.y + 4;
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        row.forEach((cell, i) =>
          doc.text(String(cell ?? ''), 40 + i * colWidth, y, { width: colWidth - 6 })
        );
      }
      doc.moveDown();
    }
  }

  doc.end();
}
