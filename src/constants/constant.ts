const studentFeeColumns = [
  { header: 'New/Old', key: 'newOld', width: 12 },
  { header: 'Class', key: 'studentClass', width: 12 },
  { header: 'Section', key: 'section', width: 10 },
  { header: 'Name', key: 'studentName', width: 20 },

  { header: 'Admission Amt', key: 'adminssionAmt', width: 15 },
  { header: 'Admission Paid', key: 'adminssionPaidAmt', width: 15 },
  { header: 'Admission Bill No', key: 'admissionBillNo', width: 18 },
  { header: 'Admission Date', key: 'admissionDate', width: 15 },

  { header: 'First Term Amt', key: 'firstTermAmt', width: 15 },
  { header: 'First Term Paid', key: 'firstTermPaidAmt', width: 15 },
  { header: 'First Term Bill No', key: 'firstTermBillNo', width: 18 },
  { header: 'First Term Date', key: 'firstTermDate', width: 15 },

  { header: 'Second Term Amt', key: 'secondTermAmt', width: 15 },
  { header: 'Second Term Paid', key: 'secondTermPaidAmt', width: 15 },
  { header: 'Second Term Bill No', key: 'secondTermBillNo', width: 18 },
  { header: 'Second Term Date', key: 'secondTermDate', width: 15 },

  { header: 'Annual Fee', key: 'annualFee', width: 12 },
  { header: 'Annual Paid', key: 'annualPaidAmt', width: 14 },
  { header: 'Dues', key: 'dues', width: 10 },
  { header: 'Concession', key: 'concession', width: 14 },
  { header: 'Remarks', key: 'remarks', width: 20 },

  { header: 'Bus 1st Term Amt', key: 'busFirstTermAmt', width: 18 },
  { header: 'Bus 1st Term Paid', key: 'busFirstTermPaidAmt', width: 18 },
  { header: 'Bus 1st Dues', key: 'busfirstTermDues', width: 15 },

  { header: 'Bus 2nd Term Amt', key: 'busSecondTermAmt', width: 18 },
  { header: 'Bus 2nd Term Paid', key: 'busSecondTermPaidAmt', width: 18 },
  { header: 'Bus 2nd Dues', key: 'busSecondTermDues', width: 15 },

  { header: 'Bus Point', key: 'busPoint', width: 15 },
  { header: 'WhatsApp No', key: 'whatsappNumber', width: 20 },
];

// module.exports = studentFeeColumns;
export default studentFeeColumns;




export const REDIS_KEYS = {
  // Other keys...

  // Group class caches strictly by schoolId
  schoolClasses: (schoolId: string) => `school:${schoolId}:classes`,

  // NEW: Handle both "all" and specific "classId" section queries
  schoolSections: (schoolId: string, classId?: string) =>
    `school:${schoolId}:sections:class:${classId || 'all'}`,

  schoolPremises: (schoolId: string) => `school:${schoolId}:premises`,
  schoolPremisesById: (schoolId: string, premisesId: string) =>
    `school:${schoolId}:premises:${premisesId}`,

  // NEW: EB Logs
  // only the unfiltered base list is cached; filtered/search queries bypass cache
  schoolEBLogs: (schoolId: string) => `school:${schoolId}:eblogs`,

  schoolEBLogById: (schoolId: string, logId: string) =>
    `school:${schoolId}:eblogs:log:${logId}`,



  // NEW: EB Dashboard / Analytics
  // date-stamped so cache naturally goes stale across days without manual invalidation
  schoolEBDashboard: (schoolId: string, dateStamp: string) =>
    `school:${schoolId}:eb:dashboard:${dateStamp}`,
  schoolEBPremisesAnalytics: (schoolId: string, dateStamp: string) =>
    `school:${schoolId}:eb:premisesAnalytics:${dateStamp}`,

  // period + premises + dateStamp -> naturally goes stale day to day
  schoolEBChart: (schoolId: string, period: string, premisesId: string, dateStamp: string) =>
    `school:${schoolId}:eb:chart:${period}:${premisesId}:${dateStamp}`,

  schoolTariffs: (schoolId: string) => `school:${schoolId}:tariffs`,
  schoolTariffById: (schoolId: string, tariffId: string) =>
    `school:${schoolId}:tariffs:${tariffId}`,

};