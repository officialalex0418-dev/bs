import React, { forwardRef } from 'react';
import { formatMoney, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export const InvoicePreview = forwardRef(({ invoice, company, distributor, dateFormat }, ref) => {
  const { settings } = useAuth();
  if (!invoice || !company) return null;

  const appBranding = settings?.branding || {
    appName: 'Business Sarthi',
    logoUrl: '/logo.png',
    tagline: 'Driving Your Business Forward'
  };

  const timesFont = { fontFamily: '"Times New Roman", Times, serif' };

  return (
    <div
      ref={ref}
      className="bg-white p-4 sm:p-8 w-full max-w-[850px] mx-auto text-black print:p-0 print:m-0 print:w-[210mm] print:shadow-none box-border flex flex-col min-h-[600px] sm:min-h-[1050px] print:min-h-[297mm] shadow-lg sm:shadow-sm"
      id="invoice-printable"
      style={timesFont}
    >
      {/* 1. Header Section - Logo and Name in same row */}
      <div
        style={{ backgroundColor: '#9e9e9e', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        className="p-4 sm:p-6 mb-4 sm:mb-8 text-black border-2 border-black flex flex-col items-center bg-grey-header shrink-0"
      >
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full justify-center mb-4">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0">
            {company.logo ? (
              <img src={company.logo} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="text-center leading-tight text-slate-300 font-bold text-[8px] sm:text-[10px]">Logo</div>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-center">{company.name}</h1>
        </div>

        {/* Address and Compliance Row */}
        <div className="w-full flex justify-center flex-wrap gap-x-3 sm:gap-x-6 text-[10px] sm:text-[13px] font-bold border-t border-black/30 pt-3">
          <span>Address: {company.address || '—'}</span>
          <span className="hidden sm:inline opacity-30">|</span>
          <span>Reg No: {company.registrationNumber || '—'}</span>
          <span className="hidden sm:inline opacity-30">|</span>
          <span>PAN/VAT: {company.panVat || '—'}</span>
        </div>
      </div>

      {/* 2. Customer & Bill Info Block */}
      <div className="px-2 sm:px-4 text-[12px] sm:text-[16px] font-bold space-y-2 sm:space-y-4 mb-2">
        <div className="flex flex-col sm:flex-row justify-between gap-1">
          <p>Bill NO: <span className="font-normal">{invoice.invoiceNumber || '—'}</span></p>
          <p>Issue Date: <span className="font-normal">{formatDate(invoice.saleDate, dateFormat)}</span></p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end border-b border-black/10 pb-1 sm:pt-2">
          <p className="w-24 shrink-0">Name:</p>
          <p className="font-normal w-full sm:flex-1 border-b border-black border-dotted">{invoice.customerName || distributor?.name || '—'}</p>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-2 sm:gap-4 pt-2">
          <div className="flex flex-col sm:flex-row flex-1 items-start sm:items-end w-full">
            <p className="w-24 shrink-0">Address:</p>
            <p className="font-normal w-full sm:flex-1 border-b border-black border-dotted">{distributor?.address || '—'}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-end w-full lg:w-auto lg:ml-10">
            <p className="w-24 lg:text-right mr-2 shrink-0">PAN/VAT:</p>
            <p className="font-normal w-full lg:min-w-[180px] border-b border-black border-dotted">{distributor?.panVat || '—'}</p>
          </div>
        </div>
      </div>

      {/* 3. Items Table - Spaced away from details */}
      <div className="px-0 sm:px-2 mb-4 sm:mb-8 mt-4 sm:mt-0 flex-1 overflow-x-auto sm:overflow-visible">
        <table className="w-full border-collapse border-[2px] sm:border-[2.5px] border-black text-[12px] sm:text-[15px] min-w-[500px] sm:min-w-0">
          <thead>
            <tr className="bg-white">
              <th className="border border-black p-1 sm:p-2 w-10 sm:w-14 text-center font-bold">S.N</th>
              <th className="border border-black p-1 sm:p-2 text-left font-bold">Particulars</th>
              <th className="border border-black p-1 sm:p-2 w-20 sm:w-28 text-center font-bold">Rate</th>
              <th className="border border-black p-1 sm:p-2 w-20 sm:w-28 text-center font-bold">Qty</th>
              <th className="border border-black p-1 sm:p-2 w-24 sm:w-36 text-center font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, idx) => (
              <tr key={idx}>
                <td className="border-x border-b border-black p-1 sm:p-2 text-center font-bold">{idx + 1}</td>
                <td className="border-x border-b border-black p-1 sm:p-2 px-2 sm:px-4 uppercase font-bold">{item.productName}</td>
                <td className="border-x border-b border-black p-1 sm:p-2 text-center font-bold">{item.price.toLocaleString()}</td>
                <td className="border-x border-b border-black p-1 sm:p-2 text-center font-bold">{item.quantity}</td>
                <td className="border-x border-b border-black p-1 sm:p-2 text-right px-2 sm:px-4 font-bold">{item.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Totals Calculation */}
      <div className="flex justify-end pr-2 sm:pr-8 mb-8 sm:mb-16 text-[13px] sm:text-[16px] font-bold">
        <div className="w-full sm:w-80 space-y-1 sm:space-y-2">
          <div className="flex justify-between">
            <span>Total Amount:</span>
            <span>{invoice.totalAmount?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount: {invoice.discountPct || 0}%:</span>
            <span>{invoice.discountAmount?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxable Amount:</span>
            <span>{invoice.taxableAmount?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT: {invoice.vatPct || 0}%:</span>
            <span>{invoice.vatAmount?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pt-1 text-[15px] sm:text-[18px] border-t-2 border-black mt-1 sm:mt-2">
            <span>Net Total Amount:</span>
            <span>{invoice.netTotal?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 5. Authorization Section */}
      <div className="flex flex-col sm:flex-row justify-between gap-10 px-4 sm:px-12 mb-10 sm:mb-20 text-[11px] sm:text-[14px] font-bold uppercase italic mt-auto">
        <div className="text-center w-full sm:w-52">
          <div className="border-t-2 border-black border-dotted mb-1.5 w-full"></div>
          VERIFIED BY:
        </div>
        <div className="text-center w-full sm:w-52">
          <div className="border-t-2 border-black border-dotted mb-1.5 w-full"></div>
          RECEIVED BY:
        </div>
      </div>

      {/* 6. Professional Multi-Segmented Footer */}
      <div className="flex flex-col sm:flex-row border-2 border-black font-sans font-bold overflow-hidden items-stretch bg-white shrink-0 break-inside-avoid print:mt-10 print:flex-row print:h-16">
        <div className="bg-[#9e9e9e] bg-grey-header px-4 py-2 flex items-center gap-3 border-b-2 sm:border-b-0 sm:border-r-2 border-black flex-1">
          <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center border border-gray-300 shrink-0 shadow-sm overflow-hidden">
             {appBranding.logoUrl ? (
               <img src={appBranding.logoUrl} alt="App" className="w-full h-full object-contain p-2" />
             ) : (
               <span className="text-[7px] font-black text-center text-slate-400">BS</span>
             )}
          </div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-tight">{appBranding.appName}</p>
            <p className="text-[7px] font-medium italic opacity-90">Driving Your Business Forward</p>
          </div>
        </div>

        <div className="flex-[1.2] bg-[#cecece] bg-grey-footer flex items-center justify-center px-2 border-r-2 border-black">
          <div className="text-center leading-none">
             <p className="text-[8px] uppercase tracking-widest text-gray-600 mb-1">Powered By</p>
             <p className="text-[10px] font-black uppercase tracking-tight text-black">Royal Consultancy Services</p>
             <p className="text-[8px] font-bold mt-1">📍 Koteshwor-32, Kathmandu</p>
          </div>
        </div>

        <div className="bg-[#9e9e9e] bg-grey-header px-4 flex flex-col justify-center text-[8px] leading-tight min-w-[180px]">
          <div className="flex justify-between gap-1"><span>📧</span> <span>contact@rcs.com.np</span></div>
          <div className="flex justify-between gap-1 my-1"><span>📞</span> <span>9741812381 | 9827765508</span></div>
          <div className="flex justify-between gap-1"><span>🌐</span> <span>www.rcs.com.np</span></div>
        </div>
      </div>
    </div>
  );
});
