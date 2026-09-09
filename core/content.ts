export const publicFaqs = [
  ["Do I need to provide my marketplace password?", "No. The app only uses report files exported by you. It never asks for your password, OTP, session cookie or marketplace login."],
  ["Is my report uploaded?", "No raw report is uploaded during normal analysis. Parsing, reconciliation, calculation and exports run inside your browser."],
  ["Is Confirmed Contribution the same as Net Profit?", "No. Contribution is the supplied settlement after product cost, packaging, variable costs and ads. Taxes and fixed overhead are included only when you explicitly provide those inputs."],
  ["What happens when a new report format appears?", "The parser fails closed. If a critical column cannot be mapped safely, no financial result is generated. Monetary columns are never guessed."],
  ["Is login required for the one-time payment?", "Yes for real payment. The free analysis works without login, but checkout requires an account so webhook-only payment completion and paid access can always be restored safely."],
] as const;

export const publicFaqsHinglish = [
  ["क्या मुझे marketplace password देना पड़ेगा?", "नहीं। सिर्फ आपके द्वारा export की हुई report file use होती है। Password, OTP, session cookie या marketplace login कभी नहीं माँगा जाता।"],
  ["क्या report upload होती है?", "Normal analysis में raw report server पर upload नहीं होती। Parsing, reconciliation, calculation और export browser के अंदर होते हैं।"],
  ["Confirmed Contribution क्या Net Profit है?", "नहीं। Contribution supplied settlement, product cost, packaging, variable costs और ads के बाद का amount है। Taxes और fixed overhead तभी include होते हैं जब आप explicitly input दें।"],
  ["New report format आया तो?", "Parser fail-closed है। Critical column safely map न हो तो financial result generate नहीं होगा। हम monetary columns guess नहीं करते।"],
  ["₹49 payment के लिए login ज़रूरी है?", "हाँ, real payment के लिए। Free analysis बिना login के चलता है, लेकिन checkout account से linked रहता है ताकि webhook से payment complete होने पर भी paid access safely restore हो सके।"],
] as const;
