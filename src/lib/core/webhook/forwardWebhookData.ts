
const URLS = [
  'https://orochi-portal-v2.vercel.app/api/webhook/order',
]

export const forwardWebhookData = async (data: any) => {
  for (const url of URLS) {
    try {
      await fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch (_) {
      // Silently ignore all errors
    }
  }
};