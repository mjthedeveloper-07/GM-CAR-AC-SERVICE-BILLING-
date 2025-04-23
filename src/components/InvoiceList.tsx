
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  Wallet, 
  Download, 
  Phone, 
  Calendar, 
  Edit2, 
  Trash2, 
  Search as SearchIcon, 
  Car as CarIcon,
  MessageSquare,
} from 'lucide-react';
import PrintableInvoice from './PrintableInvoice';
import ReactDOMServer from 'react-dom/server';
import { format, isAfter, isBefore, isEqual, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Calendar as ShadCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface ServiceItem {
  description: string;
  amount: number;
}

interface Invoice {
  id: string;
  date: string;
  customerName: string;
  customerPhone: string;
  vehicleModel: string;
  vehicleNumber: string;
  services: ServiceItem[];
  total: number;
}

const parseInvoiceDate = (date: string) => {
  const d = new Date(date);
  return isNaN(d.getTime()) ? parseISO(date) : d;
};

const groupInvoicesByDate = (invoices: Invoice[]) => {
  const grouped: Record<string, Invoice[]> = {};
  invoices.forEach(inv => {
    const dateKey = format(parseInvoiceDate(inv.date), 'PPP');
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(inv);
  });
  const sortedKeys = Object.keys(grouped).sort(
    (a, b) => 
      parseInvoiceDate(b).getTime() - parseInvoiceDate(a).getTime()
  );
  const sortedGrouped: Record<string, Invoice[]> = {};
  for (const key of sortedKeys) {
    sortedGrouped[key] = grouped[key].sort(
      (a, b) => parseInvoiceDate(b.date).getTime() - parseInvoiceDate(a.date).getTime()
    );
  }
  return sortedGrouped;
};

const InvoiceList = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [searchVehicle, setSearchVehicle] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined });

  useEffect(() => {
    const storedInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    setInvoices(storedInvoices);
    setFilteredInvoices(storedInvoices);
  }, []);

  useEffect(() => {
    let result = invoices;

    if (searchVehicle.trim() !== "") {
      result = result.filter(invoice =>
        invoice.vehicleNumber.toLowerCase().includes(searchVehicle.trim().toLowerCase())
      );
    }

    if (dateRange.from && dateRange.to) {
      result = result.filter(invoice => {
        const dateObj = parseInvoiceDate(invoice.date);
        return (
          (isAfter(dateObj, dateRange.from) || isEqual(dateObj, dateRange.from)) &&
          (isBefore(dateObj, dateRange.to) || isEqual(dateObj, dateRange.to))
        );
      });
    }

    setFilteredInvoices(result);
  }, [invoices, searchVehicle, dateRange]);

  const resetFilters = () => {
    setSearchVehicle("");
    setDateRange({ from: undefined, to: undefined });
    setFilteredInvoices(invoices);
  };

  const downloadInvoice = (invoice: Invoice) => {
    const invoiceHTML = ReactDOMServer.renderToString(<PrintableInvoice {...invoice} />);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice - ${invoice.id}</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
              @media print {
                body {
                  print-color-adjust: exact;
                  -webkit-print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
            ${invoiceHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/edit/${id}`);
  };

  const handleDelete = (id: string) => {
    const updatedInvoices = invoices.filter(invoice => invoice.id !== id);
    localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
    setInvoices(updatedInvoices);
    setFilteredInvoices(updatedInvoices);
    toast.success("Invoice deleted successfully");
    setInvoiceToDelete(null);
  };

  const handleWhatsAppShare = (invoice: Invoice) => {
    const message = `📄 Invoice Details:\n\n` +
      `🆔 ID: ${invoice.id}\n` +
      `📅 Date: ${format(parseInvoiceDate(invoice.date), 'PPP')}\n` +
      `👤 Customer: ${invoice.customerName}\n` +
      `📱 Phone: ${invoice.customerPhone}\n` +
      `🚗 Vehicle: ${invoice.vehicleModel} (${invoice.vehicleNumber})\n` +
      `💵 Total: ₹${invoice.total}\n\n` +
      `🔧 Services:\n${invoice.services.map((s, i) => `${i + 1}. ${s.description} - ₹${s.amount}`).join('\n')}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const saveAllInvoicesAsPDF = () => {
    filteredInvoices.forEach((invoice) => {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(`Invoice #${invoice.id}`, 14, 20);

      doc.setFontSize(12);
      doc.text(`Date: ${format(parseInvoiceDate(invoice.date), 'PPP')}`, 14, 30);
      doc.text(`Customer Name: ${invoice.customerName}`, 14, 40);
      doc.text(`Phone: ${invoice.customerPhone}`, 14, 50);
      doc.text(`Vehicle Model: ${invoice.vehicleModel}`, 14, 60);
      doc.text(`Vehicle Number: ${invoice.vehicleNumber}`, 14, 70);

      let currentY = 85;
      doc.text("Services:", 14, currentY);
      currentY += 8;

      invoice.services.forEach((service, index) => {
        doc.text(`${index + 1}. ${service.description} - ₹${service.amount}`, 20, currentY);
        currentY += 8;
      });

      currentY += 5;
      doc.text(`Total: ₹${invoice.total}`, 14, currentY);

      const safeName = invoice.customerName.replace(/\s+/g, '_');
      doc.save(`Invoice_${safeName}_${invoice.id}.pdf`);
    });

    toast.success("All invoices saved as PDFs");
  };

  const gradientStyle = "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-400 text-white";
  const groupCardBg = "bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50";

  const grouped = groupInvoicesByDate(filteredInvoices);

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Recent Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-2 mb-4 items-start md:items-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`min-w-[230px] justify-start text-left font-normal ${gradientStyle}`}
                style={{
                  background:
                    'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 48%, #ec4899 100%)',
                  color: '#fff',
                  border: 'none'
                }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange.from && dateRange.to
                  ? `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`
                  : "Search by Date Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <ShadCalendar
                mode="range"
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) =>
                  setDateRange({
                    from: range?.from,
                    to: range?.to,
                  })
                }
                numberOfMonths={2}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            <CarIcon className="h-4 w-4 text-gray-500" />
            <Input
              value={searchVehicle}
              onChange={e => setSearchVehicle(e.target.value)}
              placeholder="Search by Vehicle Number"
              className="max-w-[180px] border-2 border-blue-500 focus:border-purple-500"
            />
          </div>
          <Button
            variant="secondary"
            className={`flex items-center gap-1 ${gradientStyle}`}
            type="button"
            style={{
              background:
                'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 48%, #ec4899 100%)',
              color: '#fff',
              border: 'none'
            }}
          >
            <SearchIcon className="h-4 w-4" /> Search
          </Button>
          <Button
            variant="ghost"
            onClick={resetFilters}
            className="flex items-center gap-1 text-blue-700 hover:underline"
            type="button"
          >
            Reset
          </Button>
        </div>

        <div className="flex justify-end mb-4 gap-2">
          <Button
            onClick={saveAllInvoicesAsPDF}
            className={gradientStyle}
            style={{
              background:
                'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 48%, #ec4899 100%)',
              color: '#fff',
              border: 'none'
            }}
          >
            Save All Invoices to PDFs
          </Button>
        </div>

        <ScrollArea className="h-[600px] w-full">
          <div className="space-y-6">
            {Object.keys(grouped).length === 0 && (
              <p className="text-center text-gray-500 py-4">No invoices found</p>
            )}
            {Object.entries(grouped).map(([date, groupInvs]) => (
              <div key={date} className={`rounded-xl shadow mb-4 ${groupCardBg} `}>
                <div
                  className="text-lg font-bold py-2 px-4 flex items-center gap-2"
                  style={{
                    background:
                      'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 48%, #ec4899 100%)',
                    color: '#fff',
                    borderTopLeftRadius: '0.75rem',
                    borderTopRightRadius: '0.75rem'
                  }}
                >
                  <Calendar className="h-5 w-5" />
                  {date}
                </div>
                <div className="p-3 space-y-2">
                  {groupInvs.map((invoice) => (
                    <Card key={invoice.id} className="p-4 hover:scale-105 transition-transform duration-200 hover:shadow-2xl bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{invoice.customerName}</h3>
                          {invoice.customerPhone && (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {invoice.customerPhone}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            {invoice.vehicleModel} - {invoice.vehicleNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">₹{invoice.total}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(parseInvoiceDate(invoice.date), 'PPP')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(invoice.id)}
                              className="hover:border-purple-500 hover:bg-purple-50 transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => downloadInvoice(invoice)}
                              className="hover:border-blue-500 hover:bg-blue-50 transition-colors"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleWhatsAppShare(invoice)}
                              className="text-green-600 hover:bg-green-50 hover:scale-110 hover:text-green-800 transition-all"
                              aria-label="Share on WhatsApp"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setInvoiceToDelete(invoice.id)}
                              className="text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <AlertDialog open={!!invoiceToDelete} onOpenChange={() => setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invoiceToDelete && handleDelete(invoiceToDelete)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default InvoiceList;
