import { base44 } from "@/api/base44Client";

export const createPageUrl = (pageName) => {
  const cleanName = pageName.replace(/\.(js|jsx)$/, '');
  return `/${cleanName}`;
};

export const formatPhoneE164 = (phone) => {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10 && (digits.startsWith('787') || digits.startsWith('939'))) {
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
};

export const openWhatsApp = (phone, message = "") => {
  const phoneE164 = formatPhoneE164(phone);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${phoneE164.replace('+', '')}?text=${encodedMessage}`;
  window.open(url, '_blank');
};

export const makeCall = (phone) => {
  const phoneE164 = formatPhoneE164(phone);
  window.location.href = `tel:${phoneE164}`;
};

export const sendEmail = async (to, subject, body, attachments = []) => {
  try {
    await base44.integrations.Core.SendEmail({
      to,
      subject,
      body
    });
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

export const replaceTemplateVariables = (template, variables) => {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
};
