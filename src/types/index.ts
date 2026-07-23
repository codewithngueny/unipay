export type Role = 'admin' | 'accountant' | 'customer';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  student_number: string;
  program: string;
  year_of_study: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  invoice_number: string;
  student_id: string;
  title: string;
  description: string | null;
  amount: number;
  balance_due: number;
  status: InvoiceStatus;
  due_date: string | null;
  created_at: string;
}

export interface InvoiceWithStudent extends Invoice {
  students?: Pick<Student, 'student_number' | 'program' | 'year_of_study'>;
  profile?: Pick<Profile, 'full_name'>;
}

export type PaymentStatus = 'successful' | 'failed' | 'pending';

export interface Payment {
  id: string;
  payment_reference: string;
  student_id: string;
  invoice_id: string | null;
  payment_method_id: string;
  amount: number;
  status: PaymentStatus;
  payer_details: Record<string, unknown> | null;
  created_at: string;
  payment_methods?: Pick<PaymentMethod, 'name' | 'code'>;
  invoices?: Pick<Invoice, 'invoice_number' | 'title'>;
  students?: Pick<Student, 'student_number' | 'program'>;
}

export interface Receipt {
  id: string;
  receipt_number: string;
  payment_id: string;
  student_id: string;
  amount: number;
  issued_at: string;
  payments?: Payment;
  students?: Pick<Student, 'student_number' | 'program'>;
}
