export const governanceCopy = {
  en: {
    close: 'Close dialog', financeControl: 'PMS financial control', overview: 'Overview', charges: 'Charges', payments: 'Payments', deposits: 'Deposits', periods: 'Financial periods', reconciliation: 'Reconciliation', statements: 'Owner statements', payouts: 'Owner payouts', records: 'Records',
    depositsTitle: 'Security-deposit liabilities', depositsDescription: 'Track held tenant funds separately from income, with approval and posting history for deductions, refunds, and conversions.',
    periodsTitle: 'Financial periods', periodsDescription: 'Open, review, close, and reopen currency-specific periods with visible exception checks and reasons.',
    reconciliationTitle: 'Payment reconciliation', reconciliationDescription: 'Import external transactions, resolve duplicates and exceptions, and match each confirmed payment only once.',
    loading: 'Loading financial controls…', error: 'The financial controls could not be loaded.', noRecords: 'No records match this view.', permissionDenied: 'Accounting management permission is required for this action.',
    createDeposit: 'Create deposit account', createPeriod: 'Open financial period', createReconciliation: 'Add reconciliation item', search: 'Search', status: 'Status', source: 'Source', currency: 'Currency', all: 'All', filter: 'Apply filters', reset: 'Reset',
    property: 'Property', unit: 'Unit', tenant: 'Tenant', lease: 'Lease', expected: 'Expected', liability: 'Held liability', transactions: 'Transactions', actions: 'Actions', view: 'View', previous: 'Previous', next: 'Next',
    pageCount: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    expectedAmount: 'Expected amount', selectLease: 'Select lease', save: 'Save', cancel: 'Cancel', reason: 'Reason', amount: 'Amount', type: 'Type', payment: 'Payment', charge: 'Charge', optional: 'Optional',
    addTransaction: 'Add deposit transaction', approve: 'Approve', post: 'Post', void: 'Void', approvalRequired: 'Approval required before posting', postedImmediately: 'This transaction posts immediately after validation.',
    createdDate: 'Created date', transactionDate: 'Transaction date', postingDate: 'Posting date', approvalDate: 'Approval date', createdBy: 'Created by', approvedBy: 'Approved by', supportingDocuments: 'Supporting documents', noDocuments: 'No supporting documents linked.',
    periodStart: 'Period start', periodEnd: 'Period end', scope: 'Scope', companyWide: 'Company-wide', open: 'Open', review: 'Move to review', closePeriod: 'Close period', reopen: 'Reopen period', readiness: 'Close readiness', ready: 'Ready to close', blocked: 'Blocked', reconciliationExceptions: 'Reconciliation exceptions', pendingDeposits: 'Pending deposit transactions', auditTimeline: 'Audit timeline',
    externalReference: 'External reference', payerReference: 'Payer reference', matchPayment: 'Match payment', ignore: 'Ignore exception', restore: 'Restore to unmatched', duplicateOf: 'Duplicate of', matchedPayment: 'Matched payment',
    destructiveWarning: 'This action changes controlled financial history. Confirm the reason before continuing.', formError: 'Review the required fields.',
  },
  ar: {
    close: 'إغلاق النافذة', financeControl: 'الرقابة المالية لنظام إدارة العقارات', overview: 'النظرة العامة', charges: 'المطالبات', payments: 'الدفعات', deposits: 'التأمينات', periods: 'الفترات المالية', reconciliation: 'المطابقة البنكية', statements: 'كشوف الملاك', payouts: 'دفعات الملاك', records: 'السجلات',
    depositsTitle: 'التزامات التأمينات', depositsDescription: 'تتبّع أموال المستأجرين المحتجزة بشكل منفصل عن الدخل مع سجل اعتماد وترحيل الخصومات والاستردادات والتحويلات.',
    periodsTitle: 'الفترات المالية', periodsDescription: 'افتح وراجع وأغلق وأعد فتح الفترات حسب العملة مع إظهار الاستثناءات والأسباب.',
    reconciliationTitle: 'مطابقة الدفعات', reconciliationDescription: 'أدخل المعاملات الخارجية وعالج التكرارات والاستثناءات واربط كل دفعة مؤكدة مرة واحدة فقط.',
    loading: 'جارٍ تحميل الضوابط المالية…', error: 'تعذر تحميل الضوابط المالية.', noRecords: 'لا توجد سجلات مطابقة.', permissionDenied: 'يلزم إذن إدارة المحاسبة لهذا الإجراء.',
    createDeposit: 'إنشاء حساب تأمين', createPeriod: 'فتح فترة مالية', createReconciliation: 'إضافة معاملة مطابقة', search: 'بحث', status: 'الحالة', source: 'المصدر', currency: 'العملة', all: 'الكل', filter: 'تطبيق المرشحات', reset: 'إعادة ضبط',
    property: 'العقار', unit: 'الوحدة', tenant: 'المستأجر', lease: 'العقد', expected: 'المتوقع', liability: 'الالتزام المحتجز', transactions: 'المعاملات', actions: 'الإجراءات', view: 'عرض', previous: 'السابق', next: 'التالي',
    pageCount: (from: number, to: number, total: number) => `${from}–${to} من ${total}`,
    expectedAmount: 'المبلغ المتوقع', selectLease: 'اختر عقد الإيجار', save: 'حفظ', cancel: 'إلغاء', reason: 'السبب', amount: 'المبلغ', type: 'النوع', payment: 'الدفعة', charge: 'المطالبة', optional: 'اختياري',
    addTransaction: 'إضافة معاملة تأمين', approve: 'اعتماد', post: 'ترحيل', void: 'إلغاء', approvalRequired: 'يلزم الاعتماد قبل الترحيل', postedImmediately: 'تُرحّل هذه المعاملة مباشرة بعد التحقق.',
    createdDate: 'تاريخ الإنشاء', transactionDate: 'تاريخ المعاملة', postingDate: 'تاريخ الترحيل', approvalDate: 'تاريخ الاعتماد', createdBy: 'أنشأها', approvedBy: 'اعتمدها', supportingDocuments: 'المستندات الداعمة', noDocuments: 'لا توجد مستندات داعمة مرتبطة.',
    periodStart: 'بداية الفترة', periodEnd: 'نهاية الفترة', scope: 'النطاق', companyWide: 'كامل الشركة', open: 'مفتوحة', review: 'نقل للمراجعة', closePeriod: 'إغلاق الفترة', reopen: 'إعادة فتح', readiness: 'جاهزية الإغلاق', ready: 'جاهزة للإغلاق', blocked: 'محجوبة', reconciliationExceptions: 'استثناءات المطابقة', pendingDeposits: 'معاملات التأمين المعلقة', auditTimeline: 'السجل الرقابي',
    externalReference: 'المرجع الخارجي', payerReference: 'مرجع الدافع', matchPayment: 'مطابقة الدفعة', ignore: 'تجاهل الاستثناء', restore: 'إعادة إلى غير مطابق', duplicateOf: 'مكررة من', matchedPayment: 'الدفعة المطابقة',
    destructiveWarning: 'يغيّر هذا الإجراء السجل المالي الخاضع للرقابة. أكد السبب قبل المتابعة.', formError: 'راجع الحقول المطلوبة.',
  }
} as const;

export function governanceEnumLabel(value: string, language: 'en' | 'ar') {
  if (language === 'en') return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
  const labels: Record<string, string> = {
    EXPECTED: 'متوقع', HELD: 'محتجز', PARTIALLY_REFUNDED: 'مسترد جزئياً', REFUNDED: 'مسترد', CLOSED: 'مغلق',
    COLLECTION: 'تحصيل', DEDUCTION: 'خصم', REFUND: 'استرداد', CONVERSION_TO_INCOME: 'تحويل إلى دخل', ADJUSTMENT: 'تعديل',
    PENDING_APPROVAL: 'بانتظار الاعتماد', APPROVED: 'معتمد', POSTED: 'مرحّل', VOID: 'ملغى',
    OPEN: 'مفتوحة', REVIEWING: 'قيد المراجعة',
    UNMATCHED: 'غير مطابق', MATCHED: 'مطابق', DUPLICATE: 'مكرر', IGNORED: 'متجاهل',
    BANK: 'بنك', PAYMENT_PROVIDER: 'مزود دفع', CASHBOOK: 'دفتر النقدية', MANUAL: 'يدوي'
  };
  return labels[value] ?? value;
}
