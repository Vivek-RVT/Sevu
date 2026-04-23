export function getWhatsAppLink(phone: string, message: string) {
  // Strip all non-digits from the phone number
  const cleanPhone = phone.replace(/\D/g, "");
  // Default to appending to wa.me directly. If country code is missing, 
  // users should ideally input it, but we assume it's included for now.
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function formatReminderMessage(template: string, customerName: string, serviceType: string) {
  return template
    .replace(/\[Name\]/gi, customerName)
    .replace(/\[ServiceType\]/gi, serviceType);
}

export function formatReviewMessage(template: string, reviewLink: string) {
  return template.replace(/\[Review Link\]/gi, reviewLink);
}
