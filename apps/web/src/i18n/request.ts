import { getRequestConfig } from "next-intl/server";

import { getRequestLocale } from "./locale";

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();

  let messages: typeof import("../../messages/en.json");

  switch (locale) {
    case "fr":
      messages = (await import("../../messages/fr.json")).default;
      break;

    case "es":
      messages = (await import("../../messages/es.json")).default;
      break;

    default:
      messages = (await import("../../messages/en.json")).default;
      break;
  }

  return {
    locale,
    messages,
  };
});
