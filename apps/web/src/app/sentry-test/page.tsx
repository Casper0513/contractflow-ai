"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryTestPage() {
  const [sent, setSent] = useState(false);

  function sendTestEvent() {
    Sentry.captureException(new Error("ContractFlow Web Sentry production test"));
    setSent(true);
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Sentry Test</h1>
      <button type="button" onClick={sendTestEvent}>
        Send Sentry test event
      </button>
      {sent ? <p>Test event sent.</p> : null}
    </main>
  );
}
