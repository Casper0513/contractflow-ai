import PDFDocument from "pdfkit";

import type { InvoicePdfInvoice, InvoicePdfOrganization } from "./types";

export async function createInvoicePdf(
  invoice: InvoicePdfInvoice,
  organization: InvoicePdfOrganization,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: {
      top: 48,
      right: 48,
      bottom: 48,
      left: 48,
    },
    bufferPages: true,
    info: {
      Title: `${invoice.number} - ${organization.name}`,
      Author: organization.name,
      Subject: `Invoice ${invoice.number}`,
    },
  });

  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);
  });

  drawInvoiceDocument(doc, invoice, organization);

  addPageNumbers(doc);

  doc.end();

  return completed;
}

function drawInvoiceDocument(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  organization: InvoicePdfOrganization,
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  drawBusinessHeader(doc, invoice, organization, left, right);

  drawBillToAndDetails(doc, invoice, left, right);

  drawLineItems(doc, invoice, left, right);

  drawTotals(doc, invoice, left, right);

  drawPayments(doc, invoice, left, right);

  drawNotesAndTerms(doc, invoice, left, right);

  drawFooter(doc, organization, left, right);
}

function drawBusinessHeader(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  organization: InvoicePdfOrganization,
  left: number,
  right: number,
) {
  const top = 48;

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(organization.name, left, top, {
      width: 310,
    });

  let businessY = top + 26;

  if (organization.legalName && organization.legalName !== organization.name) {
    doc
      .fillColor("#6B7280")
      .font("Helvetica")
      .fontSize(9)
      .text(organization.legalName, left, businessY, {
        width: 310,
      });

    businessY += 14;
  }

  const addressLines = buildBusinessAddress(organization);

  doc.fillColor("#4B5563").font("Helvetica").fontSize(9);

  for (const line of addressLines) {
    doc.text(line, left, businessY, {
      width: 310,
    });

    businessY += 13;
  }

  if (organization.email) {
    doc.text(organization.email, left, businessY, {
      width: 310,
    });

    businessY += 13;
  }

  if (organization.phone) {
    doc.text(organization.phone, left, businessY, {
      width: 310,
    });

    businessY += 13;
  }

  if (organization.website) {
    doc.text(organization.website, left, businessY, {
      width: 310,
    });

    businessY += 13;
  }

  if (organization.taxNumber) {
    doc.text(`Tax number: ${organization.taxNumber}`, left, businessY, {
      width: 310,
    });
  }

  doc
    .fillColor("#6B7280")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("INVOICE", right - 190, top, {
      width: 190,
      align: "right",
      characterSpacing: 1.5,
    });

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(invoice.number, right - 220, top + 22, {
      width: 220,
      align: "right",
    });

  drawStatusBadge(doc, invoice.status, right - 120, top + 58, 120);

  const dividerY = Math.max(businessY + 20, top + 105);

  doc
    .strokeColor("#E5E7EB")
    .lineWidth(1)
    .moveTo(left, dividerY)
    .lineTo(right, dividerY)
    .stroke();

  doc.y = dividerY + 24;
}

function drawBillToAndDetails(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  left: number,
  right: number,
) {
  const startY = doc.y;

  const customerName = [invoice.customer.firstName, invoice.customer.lastName]
    .filter(Boolean)
    .join(" ");

  doc
    .fillColor("#6B7280")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("BILL TO", left, startY, {
      characterSpacing: 1,
    });

  let customerY = startY + 18;

  if (invoice.customer.companyName) {
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(invoice.customer.companyName, left, customerY, {
        width: 240,
      });

    customerY += 16;
  }

  doc
    .fillColor("#111827")
    .font(invoice.customer.companyName ? "Helvetica" : "Helvetica-Bold")
    .fontSize(10)
    .text(customerName, left, customerY, {
      width: 240,
    });

  customerY += 16;

  if (invoice.customer.email) {
    doc
      .fillColor("#4B5563")
      .font("Helvetica")
      .fontSize(9)
      .text(invoice.customer.email, left, customerY, {
        width: 240,
      });

    customerY += 14;
  }

  if (invoice.customer.phone) {
    doc.text(invoice.customer.phone, left, customerY, {
      width: 240,
    });

    customerY += 14;
  }

  const detailLabelX = right - 230;
  const detailValueX = right - 115;

  doc
    .fillColor("#6B7280")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("INVOICE DETAILS", detailLabelX, startY, {
      width: 230,
      align: "right",
      characterSpacing: 1,
    });

  let detailY = startY + 20;

  detailY = drawDetailRow(
    doc,
    "Issue date",
    formatDate(invoice.issueDate),
    detailLabelX,
    detailValueX,
    detailY,
  );

  detailY = drawDetailRow(
    doc,
    "Due date",
    invoice.dueDate ? formatDate(invoice.dueDate) : "No due date",
    detailLabelX,
    detailValueX,
    detailY,
  );

  detailY = drawDetailRow(
    doc,
    "Currency",
    invoice.currency,
    detailLabelX,
    detailValueX,
    detailY,
  );

  if (invoice.job) {
    detailY = drawDetailRow(
      doc,
      "Job",
      invoice.job.name,
      detailLabelX,
      detailValueX,
      detailY,
    );
  }

  doc.y = Math.max(customerY, detailY) + 26;
}

function drawDetailRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  labelX: number,
  valueX: number,
  y: number,
) {
  doc.fillColor("#6B7280").font("Helvetica").fontSize(9).text(label, labelX, y, {
    width: 105,
    align: "right",
  });

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(value, valueX, y, {
    width: 115,
    align: "right",
  });

  return y + 17;
}

function drawLineItems(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  left: number,
  right: number,
) {
  const descriptionWidth = 260;
  const quantityWidth = 55;
  const unitWidth = 95;
  const totalWidth = 95;

  const quantityX = left + descriptionWidth;
  const unitX = quantityX + quantityWidth;
  const totalX = unitX + unitWidth;

  ensureSpace(doc, 70);

  let y = doc.y;

  doc.rect(left, y, right - left, 26).fill("#F3F4F6");

  doc
    .fillColor("#4B5563")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("DESCRIPTION", left + 8, y + 9, {
      width: descriptionWidth - 16,
    })
    .text("QTY", quantityX, y + 9, {
      width: quantityWidth - 8,
      align: "right",
    })
    .text("RATE", unitX, y + 9, {
      width: unitWidth - 8,
      align: "right",
    })
    .text("AMOUNT", totalX, y + 9, {
      width: totalWidth - 8,
      align: "right",
    });

  y += 26;

  for (const item of invoice.lineItems) {
    const descriptionHeight = doc.heightOfString(item.description, {
      width: descriptionWidth - 16,
    });

    const rowHeight = Math.max(34, descriptionHeight + 16);

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();

      y = doc.page.margins.top;

      doc.rect(left, y, right - left, 26).fill("#F3F4F6");

      doc
        .fillColor("#4B5563")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("DESCRIPTION", left + 8, y + 9, {
          width: descriptionWidth - 16,
        })
        .text("QTY", quantityX, y + 9, {
          width: quantityWidth - 8,
          align: "right",
        })
        .text("RATE", unitX, y + 9, {
          width: unitWidth - 8,
          align: "right",
        })
        .text("AMOUNT", totalX, y + 9, {
          width: totalWidth - 8,
          align: "right",
        });

      y += 26;
    }

    doc
      .fillColor("#111827")
      .font("Helvetica")
      .fontSize(9)
      .text(item.description, left + 8, y + 9, {
        width: descriptionWidth - 16,
      });

    doc
      .font("Helvetica")
      .text(formatQuantity(item.quantity), quantityX, y + 9, {
        width: quantityWidth - 8,
        align: "right",
      })
      .text(formatMoney(item.unitPriceCents, invoice.currency), unitX, y + 9, {
        width: unitWidth - 8,
        align: "right",
      })
      .font("Helvetica-Bold")
      .text(formatMoney(item.lineTotalCents, invoice.currency), totalX, y + 9, {
        width: totalWidth - 8,
        align: "right",
      });

    doc
      .strokeColor("#E5E7EB")
      .lineWidth(0.5)
      .moveTo(left, y + rowHeight)
      .lineTo(right, y + rowHeight)
      .stroke();

    y += rowHeight;
  }

  doc.y = y + 22;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  left: number,
  right: number,
) {
  ensureSpace(doc, 180);

  const width = 250;
  const x = right - width;

  let y = doc.y;

  y = drawTotalRow(
    doc,
    "Subtotal",
    formatMoney(invoice.subtotalCents, invoice.currency),
    x,
    width,
    y,
  );

  if (invoice.discountCents > 0) {
    y = drawTotalRow(
      doc,
      "Discount",
      `-${formatMoney(invoice.discountCents, invoice.currency)}`,
      x,
      width,
      y,
    );
  }

  y = drawTotalRow(
    doc,
    `Tax (${formatTaxRate(invoice.taxRate)})`,
    formatMoney(invoice.taxCents, invoice.currency),
    x,
    width,
    y,
  );

  doc
    .strokeColor("#D1D5DB")
    .moveTo(x, y + 2)
    .lineTo(right, y + 2)
    .stroke();

  y += 12;

  y = drawTotalRow(
    doc,
    "Total",
    formatMoney(invoice.totalCents, invoice.currency),
    x,
    width,
    y,
    true,
  );

  if (invoice.amountPaidCents > 0) {
    y = drawTotalRow(
      doc,
      "Payments",
      `-${formatMoney(invoice.amountPaidCents, invoice.currency)}`,
      x,
      width,
      y,
    );
  }

  y += 5;

  doc.rect(x, y, width, 42).fill("#F3F4F6");

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Balance due", x + 10, y + 14, {
      width: 100,
    });

  doc
    .fontSize(15)
    .text(formatMoney(invoice.balanceDueCents, invoice.currency), x + 105, y + 12, {
      width: width - 115,
      align: "right",
    });

  doc.y = y + 66;
}

function drawTotalRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  width: number,
  y: number,
  strong = false,
) {
  doc
    .fillColor(strong ? "#111827" : "#4B5563")
    .font(strong ? "Helvetica-Bold" : "Helvetica")
    .fontSize(strong ? 10 : 9)
    .text(label, x, y, {
      width: 110,
    });

  doc
    .fillColor("#111827")
    .font(strong ? "Helvetica-Bold" : "Helvetica")
    .text(value, x + 110, y, {
      width: width - 110,
      align: "right",
    });

  return y + (strong ? 22 : 18);
}

function drawPayments(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  left: number,
  right: number,
) {
  const payments = invoice.payments.filter((payment) => payment.status === "RECORDED");

  if (payments.length === 0) {
    return;
  }

  ensureSpace(doc, 90);

  let y = doc.y;

  doc
    .fillColor("#6B7280")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("PAYMENTS RECEIVED", left, y, {
      characterSpacing: 1,
    });

  y += 20;

  for (const payment of payments) {
    ensureSpaceAtY(doc, y, 35);

    if (y + 35 > doc.page.height - doc.page.margins.bottom) {
      y = doc.page.margins.top;
    }

    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(formatEnumLabel(payment.method), left, y, {
        width: 180,
      });

    doc
      .fillColor("#6B7280")
      .font("Helvetica")
      .fontSize(8)
      .text(buildPaymentReference(payment.receivedAt, payment.reference), left, y + 13, {
        width: 280,
      });

    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(formatMoney(payment.amountCents, invoice.currency), right - 120, y, {
        width: 120,
        align: "right",
      });

    y += 36;
  }

  doc.y = y + 12;
}

function drawNotesAndTerms(
  doc: PDFKit.PDFDocument,
  invoice: InvoicePdfInvoice,
  left: number,
  right: number,
) {
  if (!invoice.notes && !invoice.terms) {
    return;
  }

  ensureSpace(doc, 100);

  const width = invoice.notes && invoice.terms ? (right - left - 28) / 2 : right - left;

  const startY = doc.y;

  if (invoice.notes) {
    drawTextSection(doc, "NOTES", invoice.notes, left, startY, width);
  }

  if (invoice.terms) {
    drawTextSection(
      doc,
      "TERMS",
      invoice.terms,
      invoice.notes ? left + width + 28 : left,
      startY,
      width,
    );
  }

  const notesHeight = invoice.notes
    ? doc.heightOfString(invoice.notes, {
        width,
      })
    : 0;

  const termsHeight = invoice.terms
    ? doc.heightOfString(invoice.terms, {
        width,
      })
    : 0;

  doc.y = startY + Math.max(notesHeight, termsHeight) + 42;
}

function drawTextSection(
  doc: PDFKit.PDFDocument,
  title: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.fillColor("#6B7280").font("Helvetica-Bold").fontSize(8).text(title, x, y, {
    width,
    characterSpacing: 1,
  });

  doc
    .fillColor("#374151")
    .font("Helvetica")
    .fontSize(9)
    .text(value, x, y + 18, {
      width,
      lineGap: 3,
    });
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  organization: InvoicePdfOrganization,
  left: number,
  right: number,
) {
  ensureSpace(doc, 45);

  const y = doc.y;

  doc.strokeColor("#E5E7EB").moveTo(left, y).lineTo(right, y).stroke();

  doc
    .fillColor("#6B7280")
    .font("Helvetica")
    .fontSize(8)
    .text(
      organization.website
        ? `${organization.name} · ${organization.website}`
        : organization.name,
      left,
      y + 14,
      {
        width: right - left,
        align: "center",
      },
    );
}

function drawStatusBadge(
  doc: PDFKit.PDFDocument,
  status: InvoicePdfInvoice["status"],
  x: number,
  y: number,
  width: number,
) {
  const label = formatEnumLabel(status);

  doc.roundedRect(x, y, width, 22, 11).fill(statusFill(status));

  doc
    .fillColor(statusText(status))
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(label, x, y + 7, {
      width,
      align: "center",
    });
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();

  for (
    let pageIndex = range.start;
    pageIndex < range.start + range.count;
    pageIndex += 1
  ) {
    doc.switchToPage(pageIndex);

    const bottom = doc.page.height - 28;

    doc
      .fillColor("#9CA3AF")
      .font("Helvetica")
      .fontSize(7)
      .text(`Page ${pageIndex + 1} of ${range.count}`, doc.page.margins.left, bottom, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "right",
        lineBreak: false,
      });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom - 35;

  if (doc.y + requiredHeight > bottom) {
    doc.addPage();
  }
}

function ensureSpaceAtY(doc: PDFKit.PDFDocument, y: number, requiredHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom - 35;

  if (y + requiredHeight > bottom) {
    doc.addPage();
  }
}

function buildBusinessAddress(organization: InvoicePdfOrganization) {
  const cityLine = [organization.city, organization.province, organization.postalCode]
    .filter(Boolean)
    .join(", ");

  return [
    organization.addressLine1,
    organization.addressLine2,
    cityLine || null,
    organization.country,
  ].filter((value): value is string => Boolean(value));
}

function buildPaymentReference(receivedAt: string | Date, reference: string | null) {
  const date = formatDate(receivedAt);

  return reference ? `${date} · Ref: ${reference}` : date;
}

function statusFill(status: InvoicePdfInvoice["status"]) {
  switch (status) {
    case "PAID":
      return "#DCFCE7";

    case "OVERDUE":
      return "#FEE2E2";

    case "PARTIALLY_PAID":
      return "#FEF3C7";

    case "SENT":
    case "VIEWED":
      return "#DBEAFE";

    case "VOIDED":
      return "#E5E7EB";

    case "DRAFT":
    default:
      return "#F3F4F6";
  }
}

function statusText(status: InvoicePdfInvoice["status"]) {
  switch (status) {
    case "PAID":
      return "#166534";

    case "OVERDUE":
      return "#991B1B";

    case "PARTIALLY_PAID":
      return "#92400E";

    case "SENT":
    case "VIEWED":
      return "#1D4ED8";

    case "VOIDED":
      return "#52525B";

    case "DRAFT":
    default:
      return "#475569";
  }
}

function formatQuantity(value: string) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return value;
  }

  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 4,
  }).format(quantity);
}

function formatTaxRate(value: string | number) {
  const rate = Number(value);

  if (!Number.isFinite(rate)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    maximumFractionDigits: 4,
  }).format(rate);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(toDate(value));
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
