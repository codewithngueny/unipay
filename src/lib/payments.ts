import { supabase } from '@/lib/supabase';
import type { Payment, PaymentMethod, Receipt, Student } from '@/types';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function fetchActivePaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []) as PaymentMethod[];
}

export async function fetchStudentForUser(userId: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Student | null;
}

export interface StripePaymentInput {
  studentId: string;
  invoiceId: string | null;
  paymentMethodId: string;
  amount: number;
  invoiceNumber?: string;
  invoiceTitle?: string;
  studentName?: string;
}

export interface MpesaPaymentInput {
  studentId: string;
  invoiceId: string | null;
  paymentMethodId: string;
  amount: number;
  phoneNumber: string;
  invoiceNumber?: string;
  invoiceTitle?: string;
  studentName?: string;
}

export interface ManualPaymentInput {
  studentId: string;
  invoiceId: string | null;
  paymentMethodId: string;
  amount: number;
  payerDetails?: Record<string, unknown>;
}

async function callEdgeFunction(name: string, body: object): Promise<Response> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not authenticated. Please sign in again.');

  const res = await fetch(`${FUNCTION_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res;
}

/** Initiate a Stripe Checkout payment. Redirects to Stripe-hosted checkout page. */
export async function initiateStripePayment(input: StripePaymentInput): Promise<void> {
  const res = await callEdgeFunction('stripe-checkout', input);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to start Stripe checkout');
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No checkout URL returned');
  }
}

/** Initiate an M-Pesa STK push payment. Returns the checkout request ID. */
export async function initiateMpesaPayment(input: MpesaPaymentInput): Promise<{
  paymentId: string;
  checkoutRequestId: string;
  message: string;
}> {
  const res = await callEdgeFunction('mpesa-stk', input);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to initiate M-Pesa payment');
  return {
    paymentId: data.paymentId,
    checkoutRequestId: data.checkoutRequestId,
    message: data.message,
  };
}

/** Poll for payment status until it's no longer pending (or timeout). */
export async function pollPaymentStatus(
  paymentId: string,
  timeoutMs = 120000,
  intervalMs = 3000,
): Promise<Payment | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();
    if (error) throw error;
    if (data && data.status !== 'pending') {
      return data as Payment;
    }
  }
  return null;
}

/** Create a manual payment (cash/bank transfer) — still simulated for staff verification. */
export async function makeManualPayment(input: ManualPaymentInput): Promise<{ payment: Payment; receipt: Receipt }> {
  const { data: ref, error: refError } = await supabase.rpc('generate_payment_reference');
  if (refError) throw refError;

  const { data: paymentRow, error: payError } = await supabase
    .from('payments')
    .insert({
      payment_reference: ref,
      student_id: input.studentId,
      invoice_id: input.invoiceId,
      payment_method_id: input.paymentMethodId,
      amount: input.amount,
      status: 'successful',
      provider: 'manual',
      payer_details: input.payerDetails ?? null,
    })
    .select('*')
    .single();
  if (payError) throw payError;
  const payment = paymentRow as Payment;

  const { data: receiptRow, error: recError } = await supabase
    .from('receipts')
    .select('*')
    .eq('payment_id', payment.id)
    .maybeSingle();
  if (recError) throw recError;
  if (!receiptRow) throw new Error('Receipt was not generated. Please contact support.');
  const receipt = receiptRow as Receipt;

  return { payment, receipt };
}

export async function fetchReceiptWithDetails(receiptId: string) {
  const { data, error } = await supabase
    .from('receipts')
    .select(`
      *,
      payments (
        *,
        payment_methods ( name, code ),
        invoices ( invoice_number, title )
      ),
      students ( student_number, program, year_of_study )
    `)
    .eq('id', receiptId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
