import { forwardRef } from 'react';
import type { Payment, Receipt, Student } from '@/types';
import { formatCurrency, formatDateTime } from '@/components/ui';
import unipayLogo from '@/assets/images/unipaylogo.png';

export interface ReceiptData {
  receipt:     Receipt;
  payment:     Payment;
  student:     Pick<Student, 'student_number' | 'program' | 'year_of_study'>;
  studentName: string;
  university?: string;
  course?:     string;
}

export const ReceiptDocument = forwardRef<HTMLDivElement, { data: ReceiptData }>(
  ({ data }, ref) => {
    const { receipt, payment, student, studentName, university, course } = data;
    const uniName = university ?? 'University of Kenya';

    return (
      <div
        ref={ref}
        id="receipt-print-area"
        className="bg-white p-8 max-w-md mx-auto font-sans text-slate-800"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-36 h-14 bg-[#6D001A] rounded-xl mb-3 shadow px-4">
            <img src={unipayLogo} alt="UniPay" className="h-9 w-auto object-contain" />
          </div>
          <h1 className="text-xl font-bold text-[#6D001A] tracking-tight">{uniName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Office of the Bursar — Fee Payment System</p>
        </div>

        {/* Receipt title band */}
        <div className="border-t-2 border-b-2 border-[#6D001A] py-2 my-4 text-center">
          <p className="text-sm font-bold text-[#6D001A] uppercase tracking-widest">Official Fee Receipt</p>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <Row label="Receipt No."    value={receipt.receipt_number} bold />
          <Row label="Payment Ref."   value={payment.payment_reference} />
          <Row label="Date Issued"    value={formatDateTime(receipt.issued_at)} />
          <Row label="Student Name"   value={studentName} />
          <Row label="Student No."    value={student.student_number} />
          {course   && <Row label="Programme"  value={course} />}
          {!course  && student.program && <Row label="Programme" value={student.program} />}
          <Row label="Year of Study"  value={`Year ${student.year_of_study}`} />
          <Row label="Payment Mode"   value={payment.payment_methods?.name ?? '—'} />
        </div>

        {/* Line item */}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left text-slate-600">
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3">
                  <span className="font-medium">Fee Payment</span>
                  {payment.invoices?.title ? ` — ${payment.invoices.title}` : course ? ` — ${course}` : ''}
                  <span className="block text-xs text-slate-400 mt-0.5">
                    via {payment.payment_methods?.name ?? '—'}
                  </span>
                </td>
                <td className="py-3 text-right font-semibold">{formatCurrency(receipt.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 font-bold text-slate-700 text-right pr-4">Total Paid</td>
                <td className="pt-4 text-right font-black text-xl text-[#6D001A]">
                  {formatCurrency(receipt.amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-1">
          <p>This is an official computer-generated receipt. Valid without a physical signature.</p>
          <p>Retain this document for your records.</p>
          <p className="pt-2 text-slate-400 text-[10px]">UniPay Fee Management System &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    );
  },
);
ReceiptDocument.displayName = 'ReceiptDocument';

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-0.5 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${bold ? 'font-bold text-[#6D001A]' : 'font-medium'}`}>{value}</span>
    </div>
  );
}
