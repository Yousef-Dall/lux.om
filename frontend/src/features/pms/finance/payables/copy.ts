export const payablesCopy = {
  en: {
    financeControl: 'PMS financial control', overview: 'Overview', charges: 'Charges', payments: 'Payments', deposits: 'Deposits', periods: 'Financial periods', reconciliation: 'Reconciliation', statements: 'Owner statements', payouts: 'Owner payouts', vendorInvoices: 'Vendor invoices', records: 'Records',
    title: 'Vendor invoices and accounts payable', description: 'Review invoice evidence, enforce maker-checker approvals, and post one evidence-backed expense when payment is confirmed.',
    loading: 'Loading vendor invoices…', error: 'The vendor payable workspace could not be loaded.', noRecords: 'No vendor invoices match this view.', permission: 'Accounting management permission is required for invoice workflow actions.',
    create: 'Create draft invoice', edit: 'Edit draft', view: 'View details', close: 'Close', cancel: 'Cancel', save: 'Save draft', update: 'Save changes', upload: 'Upload evidence',
    search: 'Search invoice, vendor, property, or work order', all: 'All', status: 'Status', currency: 'Currency', property: 'Property', vendor: 'Vendor', sort: 'Sort', apply: 'Apply filters', clear: 'Clear', previous: 'Previous', next: 'Next', pageOf: 'of',
    invoice: 'Invoice', workOrder: 'Work order', issueDate: 'Issue date', dueDate: 'Due date', total: 'Total', approved: 'Approved', paid: 'Paid', actions: 'Actions',
    invoiceNumber: 'Invoice number', externalInvoiceNumber: 'External invoice reference', subtotal: 'Subtotal', tax: 'Tax', notes: 'Notes', chooseWorkOrder: 'Choose an assigned work order', quoteCeiling: 'Approved quote ceiling',
    documents: 'Evidence documents', ledger: 'Posted ledger expense', noDocuments: 'No evidence is linked.', noLedger: 'No expense has been posted.', documentTitle: 'Document title', documentType: 'Document type', invoiceFile: 'Invoice source', paymentEvidence: 'Payment evidence', file: 'File',
    submit: 'Submit for review', review: 'Mark reviewed', approve: 'Approve invoice', reject: 'Reject invoice', submitPayment: 'Submit payment', recordPaid: 'Record paid result', recordFailed: 'Record failed result', retry: 'Retry payment', void: 'Void invoice',
    reason: 'Reason', approvedAmount: 'Approved amount', paymentReference: 'Payment reference', paymentMethodNote: 'Payment evidence note', providerConfirmed: 'The payment adapter or bank evidence confirms this result', evidenceDocument: 'Linked evidence document', paidAt: 'Payment date',
    makerChecker: 'The invoice creator or submitter cannot approve it. The approver cannot submit payment, and the payment submitter cannot record the final paid result.',
    immutable: 'Approved invoice financial composition is immutable. Paid invoices have exactly one linked ledger expense.', formError: 'Complete all required fields with valid values.', actionError: 'The invoice workflow action could not be completed.',
    sortCreated: 'Recently created', sortDue: 'Due date: earliest first', sortAmount: 'Highest amount', sortStatus: 'Status', sortNumber: 'Invoice number', databaseTotal: 'Database total', visibleRows: 'Visible rows', outstanding: 'Approved and processing', overdue: 'Overdue',
  },
  ar: {
    financeControl: 'الرقابة المالية لنظام إدارة العقارات', overview: 'النظرة العامة', charges: 'المطالبات', payments: 'الدفعات', deposits: 'التأمينات', periods: 'الفترات المالية', reconciliation: 'المطابقة', statements: 'كشوف الملاك', payouts: 'دفعات الملاك', vendorInvoices: 'فواتير الموردين', records: 'السجلات',
    title: 'فواتير الموردين والحسابات الدائنة', description: 'مراجعة أدلة الفواتير وفرض الفصل بين المُعد والمعتمد وترحيل مصروف واحد عند تأكيد الدفع.',
    loading: 'جارٍ تحميل فواتير الموردين…', error: 'تعذر تحميل مساحة الحسابات الدائنة.', noRecords: 'لا توجد فواتير موردين تطابق العرض.', permission: 'تتطلب إجراءات الفواتير صلاحية إدارة المحاسبة.',
    create: 'إنشاء فاتورة مسودة', edit: 'تعديل المسودة', view: 'عرض التفاصيل', close: 'إغلاق', cancel: 'إلغاء', save: 'حفظ المسودة', update: 'حفظ التعديلات', upload: 'رفع دليل',
    search: 'البحث برقم الفاتورة أو المورد أو العقار أو أمر العمل', all: 'الكل', status: 'الحالة', currency: 'العملة', property: 'العقار', vendor: 'المورد', sort: 'الترتيب', apply: 'تطبيق التصفية', clear: 'مسح', previous: 'السابق', next: 'التالي', pageOf: 'من',
    invoice: 'الفاتورة', workOrder: 'أمر العمل', issueDate: 'تاريخ الإصدار', dueDate: 'تاريخ الاستحقاق', total: 'الإجمالي', approved: 'المعتمد', paid: 'المدفوع', actions: 'الإجراءات',
    invoiceNumber: 'رقم الفاتورة', externalInvoiceNumber: 'المرجع الخارجي', subtotal: 'المجموع الفرعي', tax: 'الضريبة', notes: 'ملاحظات', chooseWorkOrder: 'اختر أمر عمل مسنداً', quoteCeiling: 'سقف العرض المعتمد',
    documents: 'مستندات الدليل', ledger: 'مصروف دفتر الأستاذ', noDocuments: 'لا توجد أدلة مرتبطة.', noLedger: 'لم يتم ترحيل مصروف.', documentTitle: 'عنوان المستند', documentType: 'نوع المستند', invoiceFile: 'ملف الفاتورة', paymentEvidence: 'دليل الدفع', file: 'الملف',
    submit: 'إرسال للمراجعة', review: 'تأكيد المراجعة', approve: 'اعتماد الفاتورة', reject: 'رفض الفاتورة', submitPayment: 'إرسال الدفعة', recordPaid: 'تسجيل نتيجة مدفوعة', recordFailed: 'تسجيل نتيجة فاشلة', retry: 'إعادة محاولة الدفع', void: 'إبطال الفاتورة',
    reason: 'السبب', approvedAmount: 'المبلغ المعتمد', paymentReference: 'مرجع الدفع', paymentMethodNote: 'ملاحظة دليل الدفع', providerConfirmed: 'يؤكد دليل البنك أو محول الدفع هذه النتيجة', evidenceDocument: 'مستند الدليل المرتبط', paidAt: 'تاريخ الدفع',
    makerChecker: 'لا يمكن لمن أنشأ أو أرسل الفاتورة اعتمادها، ولا يمكن للمعتمد إرسال دفعتها، ولا يمكن لمرسل الدفعة تسجيل النتيجة النهائية.',
    immutable: 'التكوين المالي للفاتورة المعتمدة ثابت. لكل فاتورة مدفوعة مصروف واحد مرتبط.', formError: 'أكمل جميع الحقول المطلوبة بقيم صحيحة.', actionError: 'تعذر إكمال إجراء الفاتورة.',
    sortCreated: 'الأحدث إنشاءً', sortDue: 'الأقرب استحقاقاً', sortAmount: 'أعلى مبلغ', sortStatus: 'الحالة', sortNumber: 'رقم الفاتورة', databaseTotal: 'إجمالي قاعدة البيانات', visibleRows: 'الصفوف الظاهرة', outstanding: 'المعتمد وقيد المعالجة', overdue: 'متأخر',
  },
} as const;

export function payableStatusLabel(value: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    DRAFT: { en: 'Draft', ar: 'مسودة' }, SUBMITTED: { en: 'Submitted', ar: 'مرسلة' }, NEEDS_REVIEW: { en: 'Needs review', ar: 'بحاجة للمراجعة' }, APPROVED: { en: 'Approved', ar: 'معتمدة' }, PROCESSING: { en: 'Processing', ar: 'قيد المعالجة' }, PAID: { en: 'Paid', ar: 'مدفوعة' }, FAILED: { en: 'Failed', ar: 'فشلت' }, REJECTED: { en: 'Rejected', ar: 'مرفوضة' }, VOID: { en: 'Void', ar: 'مبطلة' },
  };
  return labels[value]?.[language] ?? value.replaceAll('_', ' ');
}
