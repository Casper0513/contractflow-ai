import { createInvoicePdf } from "@contractflow/invoice-pdf";

import { getInvoice } from "@/lib/invoices-api";
import { getCurrentOrganization } from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const [invoice, organization] = await Promise.all([
      getInvoice(id),
      getCurrentOrganization(),
    ]);

    const pdf = await createInvoicePdf(invoice, organization);

    const filename = sanitizeFilename(`${invoice.number}.pdf`);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return new Response("Invoice not found", {
        status: 404,
      });
    }

    console.error("Failed to generate invoice PDF", error);

    return new Response("Unable to generate invoice PDF", {
      status: 500,
    });
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
