"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  barcode: string;
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

interface StoreProfile {
  store_name: string;
  gstin: string;
  phone: string;
  address: string;
  upi_id: string;
  state_code: string;
  printer_mode: "A4" | "THERMAL";
}

interface StaffMember {
  id: number;
  staff_email: string;
  role: "OWNER" | "CASHIER";
}

export default function BillingApp() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<"OWNER" | "CASHIER">("OWNER");
  const [activeTab, setActiveTab] = useState<"BILLING" | "INVENTORY" | "KHATA" | "REPORTS" | "SETTINGS" | "STAFF">("BILLING");
  const [loading, setLoading] = useState(true);

  // Auth state
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"LOGIN" | "SIGNUP">("LOGIN");
  const [authError, setAuthError] = useState("");

  // Store Profile & Staff
  const [profile, setProfile] = useState<StoreProfile>({
    store_name: "My Store",
    gstin: "",
    phone: "",
    address: "",
    upi_id: "",
    state_code: "23",
    printer_mode: "THERMAL",
  });
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"CASHIER" | "OWNER">("CASHIER");

  // Customer & Bill
  const [customerState, setCustomerState] = useState("23");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CREDIT">("CASH");

  // Database Records
  const [inventory, setInventory] = useState<Product[]>([]);
  const [parties, setParties] = useState<CustomerParty[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  // Inventory Form State
  const [newProdName, setNewProdName] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");
  const [newProdHsn, setNewProdHsn] = useState("");
  const [newProdSaleRate, setNewProdSaleRate] = useState<number | "">("");
  const [newProdPurchaseRate, setNewProdPurchaseRate] = useState<number | "">("");
  const [newProdGst, setNewProdGst] = useState<number>(18);
  const [newProdStock, setNewProdStock] = useState<number | "">("");

  // Barcode Scanning
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<any>(null);

  // Payment Collection State
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user);
      } else {
        setUser(null);
        setInventory([]);
        setParties([]);
        setInvoices([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadUserData = async (currentUser: any) => {
    setLoading(true);

    // 1. Check if user is in store_staff table
    const { data: staffMatch } = await supabase
      .from("store_staff")
      .select("*")
      .eq("staff_email", currentUser.email)
      .maybeSingle();

    let role: "OWNER" | "CASHIER" = "OWNER";
    let targetUserId = currentUser.id;

    if (staffMatch) {
      role = staffMatch.role; // 'CASHIER' or 'OWNER'
      targetUserId = staffMatch.owner_user_id; // Link to store owner's data
    } else {
      role = "OWNER";
    }

    setUserRole(role);

    // 2. Profile (Fetch owner's profile so staff see store name & settings)
    const { data: prof } = await supabase.from("store_profiles").select("*").eq("id", targetUserId).single();
    if (prof) {
      setProfile(prof);
      setCustomerState(prof.state_code || "23");
    }

    // 3. Inventory associated with target store owner
    const { data: prodData } = await supabase.from("products").select("*").eq("user_id", targetUserId).order("id", { ascending: false });
    if (prodData) setInventory(prodData);

    // 4. Parties
    const { data: partyData } = await supabase.from("parties").select("*").eq("user_id", targetUserId).order("id", { ascending: false });
    if (partyData) setParties(partyData);

    // 5. Invoices
    const { data: invData } = await supabase.from("invoices").select("*").eq("user_id", targetUserId).order("id", { ascending: false });
    if (invData) setInvoices(invData);

    // 6. Staff List
    const { data: staffData } = await supabase.from("store_staff").select("*").eq("owner_user_id", targetUserId);
    if (staffData) setStaffList(staffData);

    setLoading(false);
  };

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (authMode === "SIGNUP") {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      if (error) setAuthError(error.message);
      else if (data.user) alert("Account registered! You can now log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Save Store Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || userRole !== "OWNER") return;
    const { error } = await supabase.from("store_profiles").upsert({
      id: user.id,
      ...profile,
      updated_at: new Date().toISOString(),
    });
    if (error) alert("Error: " + error.message);
    else alert("Store settings updated successfully!");
  };

  // Add Staff Member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || userRole !== "OWNER") return;
    if (!newStaffEmail.trim()) return;

    const { error } = await supabase.from("store_staff").insert([
      {
        owner_user_id: user.id,
        staff_email: newStaffEmail.trim().toLowerCase(),
        role: newStaffRole,
      },
    ]);

    if (error) alert("Error adding staff: " + error.message);
    else {
      alert("Staff member added successfully!");
      setNewStaffEmail("");
      loadUserData(user);
    }
  };

  const handleRemoveStaff = async (staffId: number) => {
    if (userRole !== "OWNER") return;
    if (!window.confirm("Remove this staff member?")) return;
    await supabase.from("store_staff").delete().eq("id", staffId);
    loadUserData(user);
  };

  // Barcode Lookup
  const handleBarcodeLookup = (code: string) => {
    if (!code) return;
    const match = inventory.find((p) => p.barcode?.trim() === code.trim());
    if (match) {
      const emptyIdx = items.findIndex((it) => !it.name);
      const targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;

      const updated = [...items];
      updated[targetIdx] = {
        productId: match.id,
        name: match.name,
        hsn: match.hsn,
        qty: 1,
        rate: Number(match.rate),
        gstRate: Number(match.gst_rate),
      };
      setItems(updated);
      setBarcodeSearch("");
    } else {
      alert(`No product found with Barcode: ${code}`);
    }
  };

  const toggleCameraScanner = async () => {
    if (cameraActive) {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
      setCameraActive(false);
    } else {
      setCameraActive(true);
      setTimeout(async () => {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            handleBarcodeLookup(decodedText);
            scanner.stop();
            setCameraActive(false);
          },
          undefined
        );
      }, 200);
    }
  };

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

  // Add Product
  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = newProdName.trim();
    if (!trimmedName) return alert("Enter Product Name");

    // Determine target owner id
    let targetOwnerId = user.id;
    if (userRole === "CASHIER") {
      const { data: staffRec } = await supabase.from("store_staff").select("owner_user_id").eq("staff_email", user.email).single();
      if (staffRec) targetOwnerId = staffRec.owner_user_id;
    }

    const existingProduct = inventory.find(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    const stockToAdd = Number(newProdStock) || 0;

    if (existingProduct) {
      const confirmAdd = window.confirm(
        `"${existingProduct.name}" already exists with ${existingProduct.stock} stock.\n\nAdd +${stockToAdd} stock?`
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
            barcode: newProdBarcode || existingProduct.barcode,
            gst_rate: Number(newProdGst),
          })
          .eq("id", existingProduct.id);

        alert(`Stock updated! New total: ${newTotalStock}`);
        setNewProdName("");
        setNewProdBarcode("");
        setNewProdHsn("");
        setNewProdSaleRate("");
        setNewProdStock("");
        loadUserData(user);
      }
      return;
    }

    const newProd = {
      user_id: targetOwnerId,
      name: trimmedName,
      barcode: newProdBarcode.trim(),
      hsn: newProdHsn || "9999",
      rate: Number(newProdSaleRate) || 0,
      purchase_rate: Number(newProdPurchaseRate) || 0,
      gst_rate: Number(newProdGst),
      stock: stockToAdd,
    };

    const { error } = await supabase.from("products").insert([newProd]);
    if (error) return alert("Error: " + error.message);

    alert("New product saved!");
    setNewProdName("");
    setNewProdBarcode("");
    setNewProdHsn("");
    setNewProdSaleRate("");
    setNewProdPurchaseRate("");
    setNewProdStock("");
    loadUserData(user);
  };

  const handleDeleteProduct = async (productId: number, productName: string) => {
    if (userRole !== "OWNER") return alert("Only store owners can delete products.");
    if (!window.confirm(`Delete "${productName}"?`)) return;
    await supabase.from("products").delete().eq("id", productId);
    setInventory(inventory.filter((p) => p.id !== productId));
  };

  // Calculations
  const isIntraState = profile.state_code === customerState;
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

  // Save Bill
  const handleSaveAndPrint = async () => {
    if (!user) return;
    if (!customerName.trim()) return alert("Enter Customer Name");

    let targetOwnerId = user.id;
    if (userRole === "CASHIER") {
      const { data: staffRec } = await supabase.from("store_staff").select("owner_user_id").eq("staff_email", user.email).single();
      if (staffRec) targetOwnerId = staffRec.owner_user_id;
    }

    const invNo = currentInvoiceNo;
    const { error: invErr } = await supabase.from("invoices").insert([
      {
        user_id: targetOwnerId,
        invoice_number: invNo,
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal: subtotal,
        tax_amount: totalTax,
        grand_total: grandTotal,
        payment_mode: paymentMode,
      },
    ]);

    if (invErr) return alert("Error saving bill: " + invErr.message);

    for (const item of items) {
      if (item.productId) {
        const prod = inventory.find((p) => p.id === item.productId);
        if (prod) {
          const newStock = Math.max(0, prod.stock - item.qty);
          await supabase.from("products").update({ stock: newStock }).eq("id", item.productId);
        }
      }
    }

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
            user_id: targetOwnerId,
            name: customerName,
            phone: customerPhone || "N/A",
            balance_due: grandTotal,
          },
        ]);
      }
    }

    loadUserData(user);

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
    loadUserData(user);
    alert("Payment recorded successfully!");
  };

  if (!mounted) return null;

  // Auth Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-blue-600">VyaparFlow</h1>
            <p className="text-sm text-gray-500 mt-1">Multi-Shop Cloud GST Billing & POS</p>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded border border-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="storeowner@gmail.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full border border-gray-300 bg-white text-black font-medium rounded-lg px-3 py-2 text-sm focus:outline-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full border border-gray-300 bg-white text-black font-medium rounded-lg px-3 py-2 text-sm focus:outline-blue-600"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition"
            >
              {authMode === "LOGIN" ? "Sign In to Store" : "Create New Store Account"}
            </button>
          </form>

          <div className="text-center text-xs text-gray-500">
            {authMode === "LOGIN" ? (
              <p>
                Don't have a store account?{" "}
                <button onClick={() => setAuthMode("SIGNUP")} className="text-blue-600 font-bold hover:underline">
                  Register here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button onClick={() => setAuthMode("LOGIN")} className="text-blue-600 font-bold hover:underline">
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalSalesRevenue = invoices.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalCashCollected = invoices.filter((inv) => inv.payment_mode === "CASH").reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalUpiCollected = invoices.filter((inv) => inv.payment_mode === "UPI").reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
  const totalTaxCollected = invoices.reduce((sum, inv) => sum + Number(inv.tax_amount || 0), 0);
  const totalOutstandingUdhar = parties.reduce((sum, p) => sum + Number(p.balance_due || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100 p-2 md:p-6 text-black">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Navbar */}
        <header className="print:hidden flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm gap-3">
          <div className="flex items-center space-x-2">
            <div>
              <span className="text-xl font-extrabold text-blue-600 tracking-tight">{profile.store_name}</span>
              <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded uppercase ${userRole === 'OWNER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {userRole}
              </span>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("BILLING")}
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                activeTab === "BILLING" ? "bg-white text-blue-600 shadow" : "text-gray-600"
              }`}
            >
              📄 Bill (POS)
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
              📒 Udhar (₹{totalOutstandingUdhar.toFixed(0)})
            </button>

            {userRole === "OWNER" && (
              <>
                <button
                  onClick={() => setActiveTab("REPORTS")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                    activeTab === "REPORTS" ? "bg-white text-blue-600 shadow" : "text-gray-600"
                  }`}
                >
                  📊 Reports
                </button>
                <button
                  onClick={() => setActiveTab("STAFF")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                    activeTab === "STAFF" ? "bg-white text-blue-600 shadow" : "text-gray-600"
                  }`}
                >
                  👥 Staff
                </button>
                <button
                  onClick={() => setActiveTab("SETTINGS")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition ${
                    activeTab === "SETTINGS" ? "bg-white text-blue-600 shadow" : "text-gray-600"
                  }`}
                >
                  ⚙ Settings
                </button>
              </>
            )}

            <button
              onClick={handleLogout}
              className="px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </header>

        {/* =================== TAB: STAFF MANAGEMENT (OWNER ONLY) =================== */}
        {activeTab === "STAFF" && userRole === "OWNER" && (
          <div className="print:hidden bg-white p-6 rounded-lg shadow border space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Staff & Cashier Access Control</h2>
              <p className="text-xs text-gray-500">Authorize cashiers to generate bills without giving them access to financial reports or store settings.</p>
            </div>

            <form onSubmit={handleAddStaff} className="flex gap-3">
              <input
                type="email"
                required
                placeholder="cashier@store.com"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                className="flex-1 border rounded px-3 py-2 text-sm bg-white text-black"
              />
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as any)}
                className="border rounded px-3 py-2 text-sm bg-white text-black"
              >
                <option value="CASHIER">Cashier (Billing Only)</option>
                <option value="OWNER">Owner (Full Access)</option>
              </select>
              <button type="submit" className="bg-blue-600 text-white font-bold px-5 py-2 rounded text-sm hover:bg-blue-700">
                + Add Staff
              </button>
            </form>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3 border">Staff Email</th>
                  <th className="p-3 border">Assigned Role</th>
                  <th className="p-3 border text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((st) => (
                  <tr key={st.id} className="border-b">
                    <td className="p-3 border font-medium">{st.staff_email}</td>
                    <td className="p-3 border">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${st.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {st.role}
                      </span>
                    </td>
                    <td className="p-3 border text-center">
                      <button onClick={() => handleRemoveStaff(st.id)} className="text-red-500 text-xs font-semibold hover:underline">
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =================== TAB: SETTINGS (OWNER ONLY) =================== */}
        {activeTab === "SETTINGS" && userRole === "OWNER" && (
          <div className="print:hidden bg-white p-6 rounded-lg shadow border space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Store Profile & Printer Mode</h2>
              <p className="text-xs text-gray-500">Configure your store details and choose between A4 Tax Invoice or 3-inch Thermal Receipt mode.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  value={profile.store_name}
                  onChange={(e) => setProfile({ ...profile, store_name: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={profile.gstin}
                  onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                  className="w-full border rounded px-3 py-2 text-sm uppercase bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">UPI ID (For QR Slip)</label>
                <input
                  type="text"
                  placeholder="store@upi"
                  value={profile.upi_id}
                  onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice / Receipt Layout</label>
                <select
                  value={profile.printer_mode}
                  onChange={(e) => setProfile({ ...profile, printer_mode: e.target.value as any })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black font-semibold"
                >
                  <option value="THERMAL">Thermal Printer (3-inch / 58mm POS Receipt)</option>
                  <option value="A4">Standard A4 Tax Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">State Code</label>
                <select
                  value={profile.state_code}
                  onChange={(e) => setProfile({ ...profile, state_code: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black"
                >
                  <option value="23">23 - Madhya Pradesh</option>
                  <option value="27">27 - Maharashtra</option>
                  <option value="07">07 - Delhi</option>
                  <option value="09">09 - Uttar Pradesh</option>
                  <option value="24">24 - Gujarat</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-2 rounded shadow hover:bg-blue-700">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =================== TAB: BILLING & POS =================== */}
        {activeTab === "BILLING" && (
          <div className={`bg-white rounded-lg shadow border p-4 md:p-8 print:p-0 print:shadow-none print:border-none ${profile.printer_mode === 'THERMAL' ? 'print:max-w-[80mm]' : ''}`}>

            {/* Thermal Print Header */}
            {profile.printer_mode === 'THERMAL' && (
              <div className="hidden print:block text-center font-mono text-xs pb-2 mb-2 border-b border-dashed border-black space-y-1">
                <h1 className="text-sm font-black">{profile.store_name}</h1>
                <p>{profile.address}</p>
                <p>Ph: {profile.phone}</p>
                {profile.gstin && <p>GSTIN: {profile.gstin}</p>}
                <div className="text-left pt-2 font-semibold">
                  <p>Inv: {currentInvoiceNo}</p>
                  <p>Date: {billDate}</p>
                  <p>Customer: {customerName || "Walk-in"}</p>
                </div>
              </div>
            )}

            {/* A4 Print Header */}
            {profile.printer_mode === 'A4' && (
              <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-black tracking-tight">{profile.store_name}</h1>
                    <p className="text-xs text-gray-700">{profile.address}</p>
                    <p className="text-xs font-semibold">Phone: {profile.phone}</p>
                    {profile.gstin && <p className="text-xs font-bold mt-1">GSTIN: {profile.gstin}</p>}
                  </div>
                  <div className="text-right">
                    <span className="border-2 border-black font-black text-sm px-3 py-1 uppercase inline-block">TAX INVOICE</span>
                    <p className="text-xs font-bold mt-2">Invoice: {currentInvoiceNo}</p>
                    <p className="text-xs">Date: {billDate}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Screen Header */}
            <div className="print:hidden flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Quick Counter POS</h1>
                <p className="text-xs text-gray-500">Scan barcodes or pick stock for instant billing</p>
              </div>
              <button
                onClick={handleSaveAndPrint}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded font-semibold hover:bg-emerald-700 shadow flex items-center space-x-2"
              >
                <span>🖨️ Save & Print ({profile.printer_mode})</span>
              </button>
            </div>

            {/* Barcode Scanner Toolbar */}
            <div className="print:hidden bg-slate-50 border p-3 rounded-lg mb-6 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full flex gap-2">
                <input
                  type="text"
                  placeholder="⚡ Scan Barcode or type & press Enter..."
                  value={barcodeSearch}
                  onChange={(e) => setBarcodeSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBarcodeLookup(barcodeSearch);
                  }}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup(barcodeSearch)}
                  className="bg-blue-600 text-white text-xs px-4 py-2 rounded font-semibold"
                >
                  Lookup
                </button>
              </div>
              <button
                type="button"
                onClick={toggleCameraScanner}
                className={`w-full sm:w-auto text-xs px-4 py-2 rounded font-bold transition flex items-center justify-center gap-1 ${
                  cameraActive ? "bg-red-600 text-white" : "bg-purple-600 text-white"
                }`}
              >
                📷 {cameraActive ? "Stop Camera" : "Open Camera Scanner"}
              </button>
            </div>

            {cameraActive && (
              <div className="print:hidden mb-4 p-3 border rounded bg-black flex flex-col items-center">
                <div id="reader" className="w-full max-w-sm"></div>
                <p className="text-white text-xs mt-2">Point camera at product barcode</p>
              </div>
            )}

            {/* Customer Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:border print:p-2 print:mb-2 print:text-[10px]">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black print:border-none print:p-0 print:font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile No.</label>
                <input
                  type="text"
                  placeholder="Mobile No."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black print:border-none print:p-0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Place of Supply</label>
                <select
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white text-black print:border-none print:p-0"
                >
                  <option value={profile.state_code}>Same State (CGST + SGST)</option>
                  <option value="99">Other State (IGST)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className={`w-full border rounded px-3 py-2 text-sm font-semibold bg-white text-black print:border-none print:p-0 ${
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
              <table className="w-full border-collapse mb-4 text-sm print:text-[10px]">
                <thead>
                  <tr className="bg-gray-100 text-left text-gray-700 print:bg-white print:border-b print:border-black">
                    <th className="print:hidden p-2 border">Pick Stock</th>
                    <th className="p-2 border">Item</th>
                    <th className="p-2 border w-16">HSN</th>
                    <th className="p-2 border w-12 text-center">Qty</th>
                    <th className="p-2 border w-20 text-right">Rate</th>
                    <th className="p-2 border w-16 text-center">GST</th>
                    <th className="p-2 border w-24 text-right">Total</th>
                    <th className="print:hidden p-2 border w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="print:hidden p-2 border w-40">
                        <select
                          onChange={(e) => selectProductForItem(idx, Number(e.target.value))}
                          value={item.productId || ""}
                          className="w-full border rounded px-2 py-1 text-xs bg-white text-black"
                        >
                          <option value="">-- Stock --</option>
                          {inventory.map((inv) => (
                            <option key={inv.id} value={inv.id}>{inv.name} ({inv.stock})</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border font-medium">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemRow(idx, "name", e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm bg-white text-black print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => updateItemRow(idx, "hsn", e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm bg-white text-black print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItemRow(idx, "qty", Math.max(1, Number(e.target.value)))}
                          className="w-full border rounded px-2 py-1 text-sm text-center bg-white text-black print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border text-right">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItemRow(idx, "rate", Number(e.target.value))}
                          className="w-full border rounded px-2 py-1 text-sm text-right bg-white text-black print:border-none print:p-0"
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <select
                          value={item.gstRate}
                          onChange={(e) => updateItemRow(idx, "gstRate", Number(e.target.value))}
                          className="w-full border rounded px-1 py-1 text-sm bg-white text-black print:border-none print:p-0 text-center"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                      <td className="p-2 border text-right font-medium">{(item.qty * item.rate).toFixed(2)}</td>
                      <td className="print:hidden p-2 border text-center">
                        <button onClick={() => removeItemRow(idx)} className="text-red-500 font-bold">✕</button>
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

            {/* Calculations & Signatory Footer */}
            <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-start md:items-end print:text-[10px]">
              <div className="mb-4 md:mb-0 space-y-1">
                <div>
                  <span className="text-xs font-semibold text-gray-500 block">Payment Mode:</span>
                  <span className="text-sm font-bold text-gray-800">
                    {paymentMode === "CREDIT" ? "⚠️ Udhar / Khata" : `Paid via ${paymentMode}`}
                  </span>
                </div>

                {profile.upi_id && profile.printer_mode === 'THERMAL' && (
                  <div className="hidden print:block pt-1 font-mono">
                    <p>UPI ID: {profile.upi_id}</p>
                    <p className="text-[9px]">Scan & Pay via any UPI app</p>
                  </div>
                )}

                <div className="hidden print:block pt-4">
                  <p className="text-[10px]">Thank you! Visit again.</p>
                  <p className="font-bold mt-2 pt-2 border-t border-black">Authorized Signatory</p>
                </div>
              </div>

              <div className="w-full md:w-80 space-y-1 text-sm bg-gray-50 print:bg-white p-4 rounded border print:border-none print:p-0">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
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
                <div className="flex justify-between border-t-2 border-black pt-2 text-lg font-bold text-gray-900 print:text-sm">
                  <span>Grand Total:</span>
                  <span>₹{grandTotal}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================== TAB: INVENTORY =================== */}
        {activeTab === "INVENTORY" && (
          <div className="print:hidden space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Add or Update Stock</h2>
              <form onSubmit={handleAddNewProduct} className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-7 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Product name"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Barcode / SKU</label>
                  <input
                    type="text"
                    placeholder="8901030..."
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm font-mono bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">HSN</label>
                  <input
                    type="text"
                    placeholder="HSN"
                    value={newProdHsn}
                    onChange={(e) => setNewProdHsn(e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sale Rate (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={newProdSaleRate}
                    onChange={(e) => setNewProdSaleRate(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border rounded px-3 py-1.5 text-sm bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">GST %</label>
                  <select
                    value={newProdGst}
                    onChange={(e) => setNewProdGst(Number(e.target.value))}
                    className="w-full border rounded px-3 py-1.5 text-sm bg-white text-black"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Stock Qty</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full border rounded px-3 py-1.5 text-sm bg-white text-black"
                  />
                </div>
                <div className="sm:col-span-7 flex justify-end mt-2">
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
                    <th className="p-3 border">Barcode</th>
                    <th className="p-3 border">HSN</th>
                    <th className="p-3 border text-right">Sale Price</th>
                    <th className="p-3 border text-center">GST %</th>
                    <th className="p-3 border text-center">Stock</th>
                    {userRole === "OWNER" && <th className="p-3 border text-center w-24">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((prod) => (
                    <tr key={prod.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 border font-medium">{prod.name}</td>
                      <td className="p-3 border font-mono text-xs text-gray-500">{prod.barcode || "-"}</td>
                      <td className="p-3 border text-gray-600">{prod.hsn}</td>
                      <td className="p-3 border text-right font-semibold">₹{Number(prod.rate).toFixed(2)}</td>
                      <td className="p-3 border text-center">{prod.gst_rate}%</td>
                      <td className="p-3 border text-center font-bold">{prod.stock}</td>
                      {userRole === "OWNER" && (
                        <td className="p-3 border text-center">
                          <button
                            onClick={() => handleDeleteProduct(prod.id, prod.name)}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200"
                          >
                            Delete
                          </button>
                        </td>
                      )}
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
                        <td className="p-3 border text-right font-bold text-red-600">₹{Number(party.balance_due).toFixed(2)}</td>
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
                            className="w-28 border rounded px-2 py-1 text-sm text-center bg-white text-black"
                          />
                        </td>
                        <td className="p-3 border text-center">
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

        {/* =================== TAB: REPORTS (OWNER ONLY) =================== */}
        {activeTab === "REPORTS" && userRole === "OWNER" && (
          <div className="print:hidden space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-600">
                <div className="text-xs text-gray-500 font-bold uppercase">Total Lifetime Sales</div>
                <div className="text-2xl font-extrabold text-blue-700">₹{totalSalesRevenue.toFixed(2)}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-600">
                <div className="text-xs text-gray-500 font-bold uppercase">Cash Collected</div>
                <div className="text-2xl font-extrabold text-green-700">₹{totalCashCollected.toFixed(2)}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-600">
                <div className="text-xs text-gray-500 font-bold uppercase">UPI Collected</div>
                <div className="text-2xl font-extrabold text-purple-700">₹{totalUpiCollected.toFixed(2)}</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
                <div className="text-xs text-gray-500 font-bold uppercase">GST Tax Collected</div>
                <div className="text-2xl font-extrabold text-red-600">₹{totalTaxCollected.toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Invoice History</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left text-gray-700">
                    <th className="p-3 border">Inv No.</th>
                    <th className="p-3 border">Customer</th>
                    <th className="p-3 border">Date</th>
                    <th className="p-3 border">Mode</th>
                    <th className="p-3 border text-right">Tax (₹)</th>
                    <th className="p-3 border text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 border font-mono font-semibold text-blue-600">{inv.invoice_number}</td>
                      <td className="p-3 border font-medium">{inv.customer_name}</td>
                      <td className="p-3 border text-gray-500 text-xs">{new Date(inv.created_at).toLocaleString("en-IN")}</td>
                      <td className="p-3 border"><span className="text-xs px-2 py-0.5 rounded font-semibold bg-gray-100">{inv.payment_mode}</span></td>
                      <td className="p-3 border text-right">₹{Number(inv.tax_amount).toFixed(2)}</td>
                      <td className="p-3 border text-right font-bold">₹{Number(inv.grand_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}