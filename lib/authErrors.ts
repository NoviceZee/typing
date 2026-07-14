export function formatPasswordResetError(errorMessage: string): string {
  if (/rate.?limit|over_email_send_rate_limit/i.test(errorMessage)) {
    return "Too many recovery emails have been requested. Use the newest reset email already sent, or try again later.";
  }

  return "The reset email could not be sent. Check your connection and try again later.";
}
