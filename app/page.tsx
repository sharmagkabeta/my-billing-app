"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  hsn: string;
  rate: number;
  purchase_rate: number;
  gst_rate: number;
  stock: number;
}

interface BillItem {
  productId?: number;
  name: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
}

interface CustomerParty {
  id: number;
  name: string;
  phone: string;
  balance_due: number;
}

interface InvoiceRecord {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  payment_mode: string;
  created_at: string;
}

export default function BillingApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"BILLING" | "INVENTORY" | "KHATA" | "REPORTS">("BILLING");
  const [loading, setLoading] = useState(true);

  // Shop Profile Settings
  const [shopName] = useState("SHARMA TRADERS & GENERAL STORE");
  const [shopGstin] = useState("23AAAAA0000A1Z5");
  const [shopAddress] = useState("Shop No. 4, MG Road, Indore, MP - 452001");
  const [shopPhone] = useState("+91 98765 43210");
  const [businessState] = useState("23"); // MP

  // Customer Settings
  const [customerState, setCustomerState] = useState("23");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CREDIT">("CASH");

  // Database Data
  const [inventory, setInventory] = useState<Product[]>([]);
  const [parties, setParties] = useState<CustomerParty[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  // Inventory Form State
  const [newProdName, setNewProdName] = useState("");
  const [newProdHsn, setNewProdHsn] = useState("");
  const [newProdSaleRate, setNewProdSaleRate] = useState<number | "">("");
  const [newProdPurchaseRate, setNewProdPurchaseRate] = useState<number | "">("");
  const [newProdGst, setNewProdGst] = useState<number>(18);
  const [newProdStock, setNewProdStock] = useState<number | "">("");

  // Quick Payment Collection State for Khata
  const [paymentAmount, setPaymentAmount] = useState<{ [key: number]: number | "" }>({});

  // Current Bill Items
  const [items, setItems] = useState<BillItem[]>([
    { name: "", hsn: "", qty: 1, rate: 0, gstRate: 18 },
  ]);
  const [currentInvoiceNo, setCurrentInvoiceNo] = useState("");
  const [billDate, setBillDate] = useState("");

  useEffect(() => {
    setMounted(true);
    setCurrentInvoiceNo("INV-" + Math.floor(100000 + Math.random() * 900000));
    setBillDate(new Date().toLocaleDateString("en-IN"));
    fetchCloudData();
  }, []);

  const fetchCloudData = async () => {
    setLoading(true);

    const { data: prodData } = await supabase.from("products").select("*").order("id", { ascending: false });
    if (prodData) setInventory(prodData);

    const { data: partyData } = await supabase.from("parties").select("*").order("id", { ascending: false });
    if (partyData) setParties(partyData);

    const { data: invData } = await supabase.from("invoices").select("*").order("id", { ascending: false });
    if (invData) setInvoices(invData);

    setLoading(false);
  };

  // Add Item to Bill
  const addItemRow = () => {
    setItems([...items, { name: "", hsn: "", qty: 1, rate: 0, gstRate: 18 }]);
  };

  const selectProductForItem = (index: number, productId: number) => {
    const selected = inventory.find((p) => p.id === productId);
    if (!selected) return;

    const updated = [...items];
    updated[index] = {
      productId: selected.id,
      name: selected.name,
      hsn: selected.hsn,
      qty: 1,
      rate: Number(selected.rate),
      gstRate: Number(selected.gst_rate),
    };
    setItems(updated);
  };

  const updateItemRow = (index: number, field: keyof BillItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Add/Update Product
  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newProdName.trim();
    if (!trimmedName) return alert("Enter Product Name");

    const existingProduct = inventory.find(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    const stockToAdd = Number(newProdStock) || 0;

    if (existingProduct) {
      const confirmAdd = window.confirm(
        `"${existingProduct.name}" already exists with ${existingProduct.stock} in stock.\n\nAdd +${stockToAdd} stock to existing product?`
      );

      if (confirmAdd) {
        const newTotalStock = existingProduct.stock + stockToAdd;
        const updatedRate = newProdSaleRate !== "" ? Number(newProdSaleRate) : existingProduct.rate;

        await supabase
          .from("products")
          .update({
            stock: newTotalStock,
            rate: updatedRate,
            hsn: newProdHsn || existingProduct.hsn,
            gst_rate: Number(newProdGst),
          })
          .eq("id", existingProduct.id);

        alert(`Stock updated! New total stock: ${newTotalStock}`);
        setNewProdName("");
        setNewProdHsn("");
        setNewProdSaleRate("");
        setNewProdStock("");
        fetchCloudData();
      }
      return;
    }

    const newProd = {
      name: trimmedName,
      hsn: newProdHsn || "9999",
      rate: Number(newProdSaleRate) || 0,
      purchase_rate: Number(newProdPurchaseRate) || 0,
      gst_rate: Number(newProdGst),
      stock: stockToAdd,
    };

    const { error } = await supabase.from("products").insert([newProd]);
    if (error) {
      alert("Error: " + error.message);
      return;
    }

    alert("New product saved!");
    setNewProdName("");
    setNewProdHsn("");
    setNewProdSaleRate("");
    setNewProdPurchaseRate("");
    setNewProdStock("");
    fetchCloudData();
  };

  const handleDeleteProduct = async (productId: number, productName: string) => {
    if (!window.confirm(`Delete "${productName}" from stock?`)) return;
    await supabase.from("products").delete().eq("id", productId);
    setInventory(inventory.filter((p) => p.id !== productId));
  };

  // Bill Calculations
  const isIntraState = businessState === customerState;
  const subtotal = items.reduce((acc, item) => acc + item.qty * item.rate, 0);

  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  items.forEach((item) => {
    const taxable = item.qty * item.rate;
    if (isIntraState) {
      cgstTotal += taxable * (item.gstRate / 2 / 100);
      sgstTotal += taxable * (item.gstRate / 2 / 100);
    } else {
      igstTotal += taxable * (item.gstRate / 100);
    }
  });

  const grandTotal = Math.round(subtotal + cgstTotal + sgstTotal + igstTotal);
  const totalTax = cgstTotal + sgstTotal + igstTotal;

  // Save Bill & Print
  const handleSaveAndPrint = async () => {
    if (!customerName.trim()) {
      alert("Please enter Customer Name");
      return;
    }

    const invNo = currentInvoiceNo;
    const { error: invErr } = await supabase.from("invoices").insert([
      {
        invoice_number: invNo,
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal: subtotal,
        tax_amount: totalTax,
        grand_total: grandTotal,
        payment_mode: paymentMode,
      },
    ]);

    if (invErr) {
      alert("Error saving bill: " + invErr.message);
      return;
    }

    // Deduct stock
    for (const item of items) {
      if (item.productId) {
        const prod = inventory.find((p) => p.id === item.productId);
        if (prod) {
          const newStock = Math.max(0, prod.stock - item.qty);
          await supabase.from("products").update({ stock: newStock }).eq("id", item.productId);
        }
      }
    }

    // Update Udhar
    if (paymentMode === "CREDIT") {
      const existingParty = parties.find(
        (p) => p.name.toLowerCase() === customerName.toLowerCase() || (customerPhone && p.phone === customerPhone)
      );

      if (existingParty) {
        const newBalance = Number(existingParty.balance_due) + grandTotal;
        await supabase.from("parties").update({ balance_due: newBalance }).eq("id", existingParty.id);
      } else {
        await supabase.from("parties").insert([
          {
            name: customerName,
            phone: customerPhone || "N/A",
            balance_due: grandTotal,
          },
        ]);
      }
    }

    fetchCloudData();

    setTimeout(() => {
      window.print();
      setCurrentInvoiceNo("INV-" + Math.floor(100000 + Math.random() * 900000));
    }, 300);
  };

  const handleReceivePayment = async (party: CustomerParty) => {
    const amt = Number(paymentAmount[party.id]);
    if (!amt || amt <= 0) return alert("Enter valid payment amount");

    const newBalance = Math.max(0, Number(party.balance_due) - amt);
    await supabase.from("parties").update({ balance_due: newBalance }).eq("id", party.id);

    setPaymentAmount({ ...paymentAmount, [party.id]: "" });
    fetchCloudData();
    alert("Payment recorded successfully!");
  };

  if (!mounted) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-gray-500">Loading Billing System...</div>;
  }

  // Reports Summary Metrics
  const totalSalesRevenue = invoices.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalCashCollected = invoices
    .filter((inv) => inv.payment_mode === "CASH")
    .reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalUpiCollected = invoices
    .filter((inv) => inv.payment_mode === "UPI")
    .reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalTaxCollected = invoices.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0);
  const totalOutstandingUdhar = parties.reduce((sum, p) => sum + Number(p.balance_due || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100 p-2 md:p-6 text-black">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Navbar */}
        <header className="print:hidden flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center space-x-2 mb-3 sm:mb-0">
            <span className="text-xl font-extrabold text-blue-600 tracking-tight">VyaparFlow</span>
            <span className="text-xs bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded">
              ☁ Cloud Sync Active
            </span>
          </div>

          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("BILLING")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                activeTab === "BILLING" ? "bg-white text-blue-600 shadow" : "text-gray-600"
              }`}
            >
              📄 New Bill
            </button>
            <button
              onClick={() => setActiveTab("INVENTORY")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                activeTab === "INVENTORY" ? "bg-white text-blue-600 shadow" : "text-gray-600"
              }`}
            >
              📦 Stock ({inventory.length})
            </button>
            <button
              onClick={() => setActiveTab("KHATA")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                activeTab === "KHATA" ? "bg-white text-blue-600 shadow" : "text-gray-600"
              }`}
            >
              📒 Customer Udhar (₹{totalOutstandingUdhar.toFixed(0)})
            </button>
            <button
              onClick={() => setActiveTab("REPORTS")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                activeTab === "REPORTS" ? "bg-white text-blue-600 shadow" : "text-gray-600"
              }`}
            >
              📊 Reports & Day Book
            </button>
          </div>
        </header>

        {loading && (
          <div className="print:hidden p-2 bg-blue-50 text-blue-700 text-xs rounded text-center font-medium">
            Syncing database...
          </div>
        )}

        {/* =================== TAB: REPORTS & DAY BOOK =================== */}
        {activeTab === "REPORTS" && (
          <div className="print:hidden space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-600">
                <div className="text-xs text-gray-500 font-bold uppercase">Total Lifetime Sales</div>
                <div className="text-2xl font-extrabold text-blue-700">₹{totalSalesRevenue.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">{invoices.length} Invoices Generated</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-600">
                <div className="text-xs text-gray-500 font-bold uppercase">Cash Collected</div>
                <div className="text-2xl font-extrabold text-green-700">₹{totalCashCollected.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">In cash drawer</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-600">
                <div className="text-xs text-gray-500 font-bold uppercase">UPI / Online</div>
                <div className="text-2xl font-extrabold text-purple-700">₹{totalUpiCollected.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">Direct to Bank</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                <div className="text-xs text-gray-500 font-bold uppercase">Total GST Output</div>
                <div className="text-2xl font-extrabold text-red-600">₹{totalTaxCollected.toFixed(2)}</div>
                <div className="text-xs text-gray-400 mt-1">For GSTR-1 Filing</div>
              </div>
            </div>

            {/* Invoices History Table */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Day Book / Invoice History</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-700">
                      <th className="p-3 border">Inv No.</th>
                      <th className="p-3 border">Customer</th>
                      <th className="p-3 border">Date & Time</th>
                      <th className="p-3 border">Mode</th>
                      <th className="p-3 border text-right">Tax (₹)</th>
                      <th className="p-3 border text-right">Grand Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 border font-mono font-semibold text-blue-600">{inv.invoice_number}</td>
                        <td className="p-3 border font-medium">
                          {inv.customer_name}
                          {inv.customer_phone ? ` (${inv.customer_phone})` : ""}
                        </td>
                        <td className="p-3 border text-gray-500 text-xs">
                          {new Date(inv.created_at).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3 border">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              inv.payment_mode === "CASH"
                                ? "bg-green-100 text-green-700"
                                : inv.payment_mode === "UPI"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {inv.payment_mode}
                          </span>
                        </td>
                        <td className="p-3 border text-right text-gray-600">₹{Number(inv.tax_amount).toFixed(2)}</td>
                        <td className="p-3 border text-right font-bold text-gray-900">
                          ₹{Number(inv.grand_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================== TAB: INVENTORY =================== */}
        {activeTab === "INVENTORY" && (
          <div className="print:hidden space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Add or Update Stock</h2>
              <p className="text-xs text-gray-500 mb-4">
                If the product already exists, saving will automatically increase the stock quantity.
              </p>
              <form onSubmit={handleAddNewProduct} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Product name"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">HSN</label>
                  <input
                    type="text"
                    placeholder="HSN"
                    value={newProdHsn}
                    onChange={(e) => setNewProdHsn(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sale Rate (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newProdSaleRate}
                    onChange={(e) => setNewProdSaleRate(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">GST %</label>
                  <select
                    value={newProdGst}
                    onChange={(e) => setNewProdGst(Number(e.target.value))}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Qty to Add</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-6 flex justify-end mt-2">
                  <button type="submit" className="bg-blue-600 text-white font-semibold px-5 py-2 rounded text-sm shadow hover:bg-blue-700">
                    + Save to Stock
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Stock Ledger</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left text-gray-700">
                    <th className="p-3 border">Item Name</th>
                    <th className="p-3 border">HSN</th>
                    <th className="p-3 border text-right">Sale Price</th>
                    <th className="p-3 border text-center">GST %</th>
                    <th className="p-3 border text-center">Current Stock</th>
                    <th className="p-3 border text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((prod) => (
                    <tr key={prod.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 border font-medium">{prod.name}</td>
                      <td className="p-3 border text-gray-600">{prod.hsn}</td>
                      <td className="p-3 border text-right font-semibold">₹{Number(prod.rate).toFixed(2)}</td>
                      <td className="p-3 border text-center">{prod.gst_rate}%</td>
                      <td className="p-3 border text-center font-bold text-base">{prod.stock}</td>
                      <td className="p-3 border text-center">
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.name)}
                          className="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================== TAB: KHATA =================== */}
        {activeTab === "KHATA" && (
          <div className="print:hidden space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500">
                <div className="text-xs text-gray-500 font-bold uppercase">Total Udhar to Collect</div>
                <div className="text-3xl font-extrabold text-red-600">₹{totalOutstandingUdhar.toFixed(2)}</div>
              </div>
              <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
                <div className="text-xs text-gray-500 font-bold uppercase">Registered Customers</div>
                <div className="text-3xl font-extrabold text-gray-800">{parties.length} Accounts</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Customer Udhar Ledger</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left text-gray-700">
                      <th className="p-3 border">Customer Name</th>
                      <th className="p-3 border">Phone</th>
                      <th className="p-3 border text-right">Balance Due</th>
                      <th className="p-3 border text-center">Receive Jama (₹)</th>
                      <th className="p-3 border text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map((party) => (
                      <tr key={party.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 border font-semibold">{party.name}</td>
                        <td className="p-3 border text-gray-600">{party.phone}</td>
                        <td className="p-3 border text-right font-bold text-red-600">
                          ₹{Number(party.balance_due).toFixed(2)}
                        </td>
                        <td className="p-3 border text-center">
                          <input
                            type="number"
                            placeholder="₹ Amount"
                            value={paymentAmount[party.id] ?? ""}
                            onChange={(e) =>
                              setPaymentAmount({
                                ...paymentAmount,
                                [party.id]: e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                            className="w-28 border rounded px-2 py-1 text-sm text-center"
                          />
                        </td>
                        <td className="p-3 border text-center space-x-2">
                          <button
                            onClick={() => handleReceivePayment(party)}
                            className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-semibold hover:bg-emerald-700"
                          >
                            Collect Cash
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =================== TAB: BILLING & TAX INVOICE =================== */}
        {activeTab === "BILLING" && (
          <div className="bg-white rounded-lg shadow p-4 md:p-8 print:p-0 print:shadow-none print:border-none border">

            {/* Print Header */}
            <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black tracking-tight">{shopName}</h1>
                  <p className="text-xs text-gray-700">{shopAddress}</p>
                  <p className="text-xs font-semibold">Phone: {shopPhone}</p>
                  <p className="text-xs font-bold mt-1">GSTIN: {shopGstin}</p>
                </div>
                <div className="text-right">
                  <span className="border-2 border-black font-black text-sm px-3 py-1 uppercase inline-block">
                    TAX INVOICE
                  </span>
                  <p className="text-xs font-bold mt-2">Invoice: {currentInvoiceNo}</p>
                  <p className="text-xs">Date: {billDate}</p>
                </div>
              </div>
            </div>

            {/* Screen Header */}
            <div className="print:hidden flex justify-between items-center border-b pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Quick Counter Bill</h1>
                <p className="text-xs text-gray-500">Live GST billing synced to cloud</p>
              </div>
              <button
                onClick={handleSaveAndPrint}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded font-semibold hover:bg-emerald-700 shadow flex items-center space-x-2"
              >
                <span>🖨️ Save & Print Bill</span>
              </button>
            </div>

            {/* Customer Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:border print:p-3 print:mb-4 print:text-xs">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm print:border-none print:p-0 print:font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile No.</label>
                <input
                  type="text"
                  placeholder="Mobile No."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm print:border-none print:p-0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Place of Supply</label>
                <select
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm print:border-none print:p-0 print:font-semibold"
                >
                  <option value="23">23 - Madhya Pradesh (CGST + SGST)</option>
                  <option value="27">27 - Maharashtra (IGST)</option>
                  <option value="07">07 - Delhi (IGST)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className={`w-full border rounded px-3 py-2 text-sm font-semibold print:border-none print:p-0 ${
                    paymentMode === "CREDIT" ? "bg-red-50 text-red-700 border-red-300" : ""
                  }`}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT">⚠️ Udhar (Khata)</option>
                </select>
              </div>
            </div>

            {/* Bill Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse mb-4 text-sm print:text-xs">
                <thead>
                  <tr className="bg-gray-100 text-left text-gray-700 print:bg-white print:border-b-2 print:border-black">
                    <th className="print:hidden p-2 border">Pick Stock</th>
                    <th className="p-2 border">Item Description</th>
                    <th className="p-2 border w-20">HSN</th>
                    <th className="p-2 border w-16 text-center">Qty</th>
                    <th className="p-2 border w-24 text-right">Rate (₹)</th>
                    <th className="p-2 border w-20 text-center">GST %</th>
                    <th className="p-2 border w-28 text-right">Total (₹)</th>
                    <th className="print:hidden p-2 border w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="print:hidden p-2 border w-44">
                        <select
                          onChange={(e) => selectProductForItem(idx, Number(e.target.value))}
                          value={item.productId || ""}
                          className="w-full border rounded px-2 py-1 text-xs"
                        >
                          <option value="">-- Stock --</option>
                          {inventory.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} ({inv.stock})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border font-medium">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemRow(idx, "name", e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => updateItemRow(idx, "hsn", e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItemRow(idx, "qty", Math.max(1, Number(e.target.value)))}
                          className="w-full border rounded px-2 py-1 text-sm text-center print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border text-right">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItemRow(idx, "rate", Number(e.target.value))}
                          className="w-full border rounded px-2 py-1 text-sm text-right print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <select
                          value={item.gstRate}
                          onChange={(e) => updateItemRow(idx, "gstRate", Number(e.target.value))}
                          className="w-full border rounded px-1 py-1 text-sm print:border-none print:p-0 text-center"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                      <td className="p-2 border text-right font-medium">
                        {(item.qty * item.rate).toFixed(2)}
                      </td>
                      <td className="print:hidden p-2 border text-center">
                        <button onClick={() => removeItemRow(idx)} className="text-red-500 font-bold">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addItemRow}
              className="print:hidden mb-6 bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-sm font-semibold hover:bg-blue-100"
            >
              + Add Item Row
            </button>

            {/* Calculations & Signatory Block */}
            <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-start md:items-end print:text-xs">
              <div className="mb-4 md:mb-0 space-y-2">
                <div>
                  <span className="text-xs font-semibold text-gray-500 block">Payment Mode:</span>
                  <span className="text-sm font-bold text-gray-800">
                    {paymentMode === "CREDIT" ? "⚠️ Udhar / Khata" : `Paid via ${paymentMode}`}
                  </span>
                </div>
                <div className="hidden print:block pt-8">
                  <p className="text-xs text-gray-500">Thank you for your business!</p>
                  <p className="text-xs font-bold mt-4 pt-4 border-t border-gray-400">Authorized Signatory</p>
                </div>
              </div>

              <div className="w-full md:w-80 space-y-2 text-sm bg-gray-50 print:bg-white p-4 rounded border">
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxable Subtotal:</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                {isIntraState ? (
                  <>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>CGST:</span>
                      <span>₹{cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>SGST:</span>
                      <span>₹{sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>IGST:</span>
                    <span>₹{igstTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-black pt-2 text-lg font-bold text-gray-900">
                  <span>Grand Total:</span>
                  <span>₹{grandTotal}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}