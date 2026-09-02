import PDFDocument from "pdfkit";

import type { EstimatePdfEstimate, EstimatePdfOrganization } from "./types";
import { formatMinorAmount } from "./money";

export async function createEstimatePdf(
  estimate: EstimatePdfEstimate,
  organization: EstimatePdfOrganization,
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
      Title: `${estimate.number} - ${organization.name}`,
      Author: organization.name,
      Subject: `Estimate ${estimate.number}`,
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

  drawEstimateDocument(doc, estimate, organization);

  addPageNumbers(doc);

  doc.end();

  return completed;
}

function drawEstimateDocument(
  doc: PDFKit.PDFDocument,
  estimate: EstimatePdfEstimate,
  organization: EstimatePdfOrganization,
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  drawBusinessHeader(doc, estimate, organization, left, right);

  drawCustomerAndDetails(doc, estimate, left, right);

  drawLineItems(doc, estimate, left, right);

  drawTotals(doc, estimate, right);

  drawNotesAndTerms(doc, estimate, left, right);

  drawFooter(doc, organization, left, right);
}

function drawBusinessHeader(
  doc: PDFKit.PDFDocument,
  estimate: EstimatePdfEstimate,
  organization: EstimatePdfOrganization,
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
    .text("ESTIMATE", right - 190, top, {
      width: 190,
      align: "right",
      characterSpacing: 1.5,
    });

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(estimate.number, right - 220, top + 22, {
      width: 220,
      align: "right",
    });

  drawStatusBadge(doc, estimate.status, right - 120, top + 58, 120);

  const dividerY = Math.max(businessY + 20, top + 105);

  doc
    .strokeColor("#E5E7EB")
    .lineWidth(1)
    .moveTo(left, dividerY)
    .lineTo(right, dividerY)
    .stroke();

  doc.y = dividerY + 24;
}

function drawCustomerAndDetails(
  doc: PDFKit.PDFDocument,
  estimate: EstimatePdfEstimate,
  left: number,
  right: number,
) {
  const startY = doc.y;

  const customerName = [estimate.customer.firstName, estimate.customer.lastName]
    .filter(Boolean)
    .join(" ");

  doc
    .fillColor("#6B7280")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("PREPARED FOR", left, startY, {
      characterSpacing: 1,
    });

  let customerY = startY + 18;

  if (estimate.customer.companyName) {
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(estimate.customer.companyName, left, customerY, {
        width: 240,
      });

    customerY += 16;
  }

  doc
    .fillColor("#111827")
    .font(estimate.customer.companyName ? "Helvetica" : "Helvetica-Bold")
    .fontSize(10)
    .text(customerName, left, customerY, {
      width: 240,
    });

  customerY += 16;

  if (estimate.customer.email) {
    doc
      .fillColor("#4B5563")
      .font("Helvetica")
      .fontSize(9)
      .text(estimate.customer.email, left, customerY, {
        width: 240,
      });

    customerY += 14;
  }

  if (estimate.customer.phone) {
    doc.text(estimate.customer.phone, left, customerY, {
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
    .text("ESTIMATE DETAILS", detailLabelX, startY, {
      width: 230,
      align: "right",
      characterSpacing: 1,
    });

  let detailY = startY + 20;

  detailY = drawDetailRow(
    doc,
    "Valid until",
    estimate.validUntil ? formatDate(estimate.validUntil) : "No expiry date",
    detailLabelX,
    detailValueX,
    detailY,
  );

  detailY = drawDetailRow(
    doc,
    "Currency",
    estimate.currency,
    detailLabelX,
    detailValueX,
    detailY,
  );

  if (estimate.job) {
    detailY = drawDetailRow(
      doc,
      "Job",
      estimate.job.name,
      detailLabelX,
      detailValueX,
      detailY,
    );
  }

  if (estimate.title) {
    detailY = drawDetailRow(
      doc,
      "Title",
      estimate.title,
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
  estimate: EstimatePdfEstimate,
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

  y = drawLineItemHeader(
    doc,
    left,
    right,
    y,
    descriptionWidth,
    quantityWidth,
    unitWidth,
    totalWidth,
    quantityX,
    unitX,
    totalX,
  );

  for (const item of estimate.lineItems) {
    const descriptionHeight = doc.heightOfString(item.description, {
      width: descriptionWidth - 16,
    });

    const rowHeight = Math.max(34, descriptionHeight + 16);

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();

      y = doc.page.margins.top;

      y = drawLineItemHeader(
        doc,
        left,
        right,
        y,
        descriptionWidth,
        quantityWidth,
        unitWidth,
        totalWidth,
        quantityX,
        unitX,
        totalX,
      );
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
      .text(formatMinorAmount(item.unitPriceCents, estimate.currency), unitX, y + 9, {
        width: unitWidth - 8,
        align: "right",
      })
      .font("Helvetica-Bold")
      .text(formatMinorAmount(item.lineTotalCents, estimate.currency), totalX, y + 9, {
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

function drawLineItemHeader(
  doc: PDFKit.PDFDocument,
  left: number,
  right: number,
  y: number,
  descriptionWidth: number,
  quantityWidth: number,
  unitWidth: number,
  totalWidth: number,
  quantityX: number,
  unitX: number,
  totalX: number,
) {
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

  return y + 26;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  estimate: EstimatePdfEstimate,
  right: number,
) {
  ensureSpace(doc, 145);

  const width = 250;
  const x = right - width;

  let y = doc.y;

  y = drawTotalRow(
    doc,
    "Subtotal",
    formatMinorAmount(estimate.subtotalCents, estimate.currency),
    x,
    width,
    y,
  );

  if (estimate.discountCents > 0) {
    y = drawTotalRow(
      doc,
      "Discount",
      `-${formatMinorAmount(estimate.discountCents, estimate.currency)}`,
      x,
      width,
      y,
    );
  }

  y = drawTotalRow(
    doc,
    `Tax (${formatTaxRate(estimate.taxRate)})`,
    formatMinorAmount(estimate.taxCents, estimate.currency),
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

  doc.rect(x, y, width, 46).fill("#F3F4F6");

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Estimate total", x + 10, y + 15, {
      width: 110,
    });

  doc
    .fontSize(15)
    .text(formatMinorAmount(estimate.totalCents, estimate.currency), x + 115, y + 13, {
      width: width - 125,
      align: "right",
    });

  doc.y = y + 70;
}

function drawTotalRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  width: number,
  y: number,
) {
  doc.fillColor("#4B5563").font("Helvetica").fontSize(9).text(label, x, y, {
    width: 110,
  });

  doc
    .fillColor("#111827")
    .font("Helvetica")
    .text(value, x + 110, y, {
      width: width - 110,
      align: "right",
    });

  return y + 18;
}

function drawNotesAndTerms(
  doc: PDFKit.PDFDocument,
  estimate: EstimatePdfEstimate,
  left: number,
  right: number,
) {
  if (!estimate.notes && !estimate.terms) {
    return;
  }

  ensureSpace(doc, 100);

  const width = estimate.notes && estimate.terms ? (right - left - 28) / 2 : right - left;

  const startY = doc.y;

  if (estimate.notes) {
    drawTextSection(doc, "NOTES", estimate.notes, left, startY, width);
  }

  if (estimate.terms) {
    drawTextSection(
      doc,
      "TERMS",
      estimate.terms,
      estimate.notes ? left + width + 28 : left,
      startY,
      width,
    );
  }

  const notesHeight = estimate.notes
    ? doc.heightOfString(estimate.notes, {
        width,
      })
    : 0;

  const termsHeight = estimate.terms
    ? doc.heightOfString(estimate.terms, {
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
  organization: EstimatePdfOrganization,
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
  status: EstimatePdfEstimate["status"],
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

function buildBusinessAddress(organization: EstimatePdfOrganization) {
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

function statusFill(status: EstimatePdfEstimate["status"]) {
  switch (status) {
    case "APPROVED":
      return "#DCFCE7";

    case "DECLINED":
      return "#FEE2E2";

    case "EXPIRED":
      return "#FEF3C7";

    case "SENT":
    case "VIEWED":
      return "#DBEAFE";

    case "DRAFT":
    default:
      return "#F3F4F6";
  }
}

function statusText(status: EstimatePdfEstimate["status"]) {
  switch (status) {
    case "APPROVED":
      return "#166534";

    case "DECLINED":
      return "#991B1B";

    case "EXPIRED":
      return "#92400E";

    case "SENT":
    case "VIEWED":
      return "#1D4ED8";

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
