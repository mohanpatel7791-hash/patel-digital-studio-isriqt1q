
import React, { useEffect, useState } from "react";
import "./style.css";
import CustomerLogin from "./CustomerLogin";
import { auth, db, rtdb } from "./firebase";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";

import {
  ref,
  set,
  onValue,
  onDisconnect
} from "firebase/database";

const ADMIN_EMAIL = "mohanpatel7791@gmail.com";
const DEFAULT_UPI = "9301152277@ybl";
const DEFAULT_PAYMENT_NAME = "Patel Digital Studio";
const WHATSAPP = "919301152277";
const PHONE = "9301152277";

const INITIAL_SERVICES = [
  { id: "pan", name: "PAN Card Services", category: "Government Services", price: 199, active: true },
  { id: "banking", name: "Banking Services", category: "Banking", price: 99, active: true },
  { id: "government", name: "Government Services", category: "Government", price: 149, active: true },
  { id: "education", name: "Education Services", category: "Education", price: 99, active: true },
  { id: "farmer", name: "Farmer Services", category: "Farmer", price: 99, active: true },
  { id: "digital", name: "Digital Services", category: "Digital", price: 99, active: true }
];

const money = (value) =>
  "₹" + Number(value || 0).toFixed(2);

function makeUpiLink(upi, name, amount, orderId) {
  const params = new URLSearchParams({
    pa: upi,
    pn: name,
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
    tn: `PDS Order ${orderId || ""}`
  });

  return `upi://pay?${params.toString()}`;
}

function makeQrUrl(value) {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=" +
    encodeURIComponent(value)
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [services, setServices] = useState(INITIAL_SERVICES);
  const [orders, setOrders] = useState([]);

  const [page, setPage] = useState("home");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [pendingService, setPendingService] = useState(null);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [newService, setNewService] = useState({
    name: "",
    category: "",
    price: ""
  });

  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");

  const [upiId, setUpiId] = useState(DEFAULT_UPI);
  const [paymentName, setPaymentName] = useState(DEFAULT_PAYMENT_NAME);
  const [paymentMessage, setPaymentMessage] = useState("");

  const [notice, setNotice] = useState("");
  const [founderImageError, setFounderImageError] = useState(false);

  // ---------------------------------------
  // 1. FIREBASE AUTHENTICATION
  // ---------------------------------------

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);

        if (!currentUser) {
          setCustomer(null);
          setIsAdmin(false);
          setAuthLoading(false);
          return;
        }

        const email = (
          currentUser.email || ""
        ).toLowerCase();

        if (email === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
          setCustomer(null);
          setAuthLoading(false);
          return;
        }

        setIsAdmin(false);

        try {
          const customerSnap = await getDoc(
            doc(db, "customers", currentUser.uid)
          );

          setCustomer(
            customerSnap.exists()
              ? customerSnap.data()
              : null
          );
        } catch (error) {
          console.error("Customer profile:", error);

          setNotice(
            "Profile load error: " +
            (error.message || "Please check Firebase Rules.")
          );
        }

        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ---------------------------------------
  // 2. REALTIME DATABASE - USER PRESENCE
  // ---------------------------------------

  useEffect(() => {
    if (!user) return;

    const statusRef = ref(
      rtdb,
      "presence/" + user.uid
    );

    const connectedRef = ref(
      rtdb,
      ".info/connected"
    );

    const unsubscribe = onValue(
      connectedRef,
      async (snapshot) => {
        if (snapshot.val() !== true) return;

        try {
          await onDisconnect(statusRef).set({
            online: false,
            lastSeen: Date.now()
          });

          await set(statusRef, {
            online: true,
            lastSeen: Date.now()
          });
        } catch (error) {
          console.warn("Realtime presence error:", error);
        }
      }
    );

    return () => {
      unsubscribe();

      set(statusRef, {
        online: false,
        lastSeen: Date.now()
      }).catch((error) => {
        console.warn("Presence cleanup:", error);
      });
    };
  }, [user]);

  // ---------------------------------------
  // 3. FIRESTORE LIVE SERVICES
  // ---------------------------------------

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "services"),
      async (snapshot) => {
        if (snapshot.empty) {
          setServices(INITIAL_SERVICES);

          if (isAdmin) {
            try {
              await Promise.all(
                INITIAL_SERVICES.map((service) =>
                  setDoc(
                    doc(db, "services", service.id),
                    {
                      ...service,
                      createdAt: serverTimestamp()
                    },
                    { merge: true }
                  )
                )
              );
            } catch (error) {
              console.error("Default services:", error);
            }
          }

          return;
        }

        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setServices(list);
      },
      (error) => {
        console.error("Services:", error);

        setNotice(
          "Services load nahi hui. Firebase Rules check karein."
        );
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // ---------------------------------------
  // 4. FIRESTORE LIVE ORDERS
  // ---------------------------------------

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    const ordersRef = collection(db, "orders");

    const ordersQuery = isAdmin
      ? ordersRef
      : query(
          ordersRef,
          where("uid", "==", user.uid)
        );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        list.sort(
          (a, b) =>
            (b.createdAt?.seconds || 0) -
            (a.createdAt?.seconds || 0)
        );

        setOrders(list);
      },
      (error) => {
        console.error("Orders:", error);

        setNotice(
          "Orders load nahi hue. Firebase Rules check karein."
        );
      }
    );

    return () => unsubscribe();
  }, [user, isAdmin]);

  // ---------------------------------------
  // 5. LIVE PAYMENT SETTINGS
  // ---------------------------------------

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "settings", "payment"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          setUpiId(data.upiId || DEFAULT_UPI);
          setPaymentName(
            data.paymentName || DEFAULT_PAYMENT_NAME
          );
        }
      },
      (error) => {
        console.error("Payment settings:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ---------------------------------------
  // 6. WHATSAPP
  // ---------------------------------------

  function whatsapp(message) {
    const url =
      `https://wa.me/${WHATSAPP}?text=` +
      encodeURIComponent(message);

    window.open(url, "_blank");
  }

  // ---------------------------------------
  // 7. CUSTOMER LOGIN CALLBACK
  // ---------------------------------------

  async function handleCustomerLogin(data) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("Customer login complete nahi hua.");
    }

    if (
      (currentUser.email || "").toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
    ) {
      setIsAdmin(true);
      setPage("admin");
      return;
    }

    try {
      const oldSnap = await getDoc(
        doc(db, "customers", currentUser.uid)
      );

      const oldData = oldSnap.exists()
        ? oldSnap.data()
        : {};

      const profile = {
        uid: currentUser.uid,
        name:
          data?.name?.trim() ||
          oldData.name ||
          currentUser.displayName ||
          "Customer",
        mobile:
          data?.mobile?.trim() ||
          oldData.mobile ||
          "",
        email: currentUser.email || "",
        updatedAt: serverTimestamp()
      };

      if (!profile.mobile) {
        throw new Error("Mobile number zaroor bharein.");
      }

      await setDoc(
        doc(db, "customers", currentUser.uid),
        profile,
        { merge: true }
      );

      setUser(currentUser);
      setCustomer(profile);

      setNotice("Customer login successful!");

      if (pendingService) {
        const selectedService = pendingService;

        setPendingService(null);

        await createOrder(selectedService, profile);
      } else {
        setPage("account");
      }
    } catch (error) {
      console.error("Customer profile save:", error);
      setNotice(error.message || "Customer profile save nahi hui.");
      throw error;
    }
  }

  // ---------------------------------------
  // 8. CUSTOMER LOGOUT
  // ---------------------------------------

  async function customerLogout() {
    try {
      await signOut(auth);
      setCustomer(null);
      setPage("home");
      setNotice("Logout successful.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  // ---------------------------------------
  // 9. CREATE CUSTOMER ORDER
  // ---------------------------------------

  async function createOrder(service, profile = customer) {
    const currentUser = auth.currentUser;

    if (!currentUser || !profile) {
      setPendingService(service);
      setPage("customer-login");
      return;
    }

    if (
      (currentUser.email || "").toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
    ) {
      setNotice("Order place karne ke liye Customer account use karein.");
      return;
    }

    if (!profile.mobile) {
      setPendingService(service);
      setPage("customer-login");
      setNotice("Order se pehle mobile number complete karein.");
      return;
    }

    try {
      const orderData = {
        uid: currentUser.uid,
        customerName: profile.name || "",
        mobile: profile.mobile || "",
        serviceName: service.name,
        serviceId: service.id,
        category: service.category || "",
        price: Number(service.price || 0),
        status: "Pending",
        paymentStatus: "Unpaid",
        transactionId: "",
        createdAt: serverTimestamp()
      };

      const orderRef = await addDoc(
        collection(db, "orders"),
        orderData
      );

      setPage("account");
      setNotice("Order successfully place ho gaya!");

      whatsapp(
        `New Order - Patel Digital Studio\n` +
        `Customer: ${profile.name || ""}\n` +
        `Mobile: ${profile.mobile || ""}\n` +
        `Service: ${service.name}\n` +
        `Amount: ${money(service.price)}\n` +
        `Order ID: ${orderRef.id}`
      );
    } catch (error) {
      console.error("Order error:", error);

      setNotice(
        "Order save nahi hua: " +
        (error.message || "Firebase Rules check karein.")
      );
    }
  }

  // ---------------------------------------
  // 10. ADMIN LOGIN
  // ---------------------------------------

  async function adminSignIn(event) {
    event.preventDefault();

    try {
      const email = adminEmail.trim().toLowerCase();

      if (email !== ADMIN_EMAIL.toLowerCase()) {
        setNotice("Yeh Admin Email authorized nahi hai.");
        return;
      }

      const result = await signInWithEmailAndPassword(
        auth,
        email,
        adminPassword
      );

      if (
        (result.user.email || "").toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
      ) {
        await signOut(auth);
        setNotice("Admin account authorized nahi hai.");
        return;
      }

      setIsAdmin(true);
      setCustomer(null);
      setShowAdminLogin(false);
      setAdminPassword("");
      setPage("admin");

      setNotice("Admin login successful!");
    } catch (error) {
      console.error("Admin login:", error);

      setNotice(
        "Admin login failed: " +
        (error.code === "auth/invalid-credential"
          ? "Email ya Password galat hai."
          : error.message)
      );
    }
  }

  // ---------------------------------------
  // 11. ADMIN LOGOUT
  // ---------------------------------------

  async function adminLogout() {
    try {
      await signOut(auth);
      setIsAdmin(false);
      setPage("home");
      setNotice("Admin logout successful.");
    } catch (error) {
      setNotice(error.message);
    }
  }

  // ---------------------------------------
  // 12. SAVE SERVICE
  // ---------------------------------------

  async function saveService(event) {
    event.preventDefault();

    if (!isAdmin) return;

    const data = {
      name: newService.name.trim(),
      category: newService.category.trim(),
      price: Number(newService.price),
      active: true,
      updatedAt: serverTimestamp()
    };

    if (
      !data.name ||
      !data.category ||
      !Number.isFinite(data.price) ||
      data.price <= 0
    ) {
      setNotice("Service details sahi bharein.");
      return;
    }

    try {
      if (editId) {
        await updateDoc(
          doc(db, "services", editId),
          data
        );

        setNotice("Service update ho gayi.");
      } else {
        await addDoc(
          collection(db, "services"),
          {
            ...data,
            createdAt: serverTimestamp()
          }
        );

        setNotice("New service add ho gayi.");
      }

      setNewService({
        name: "",
        category: "",
        price: ""
      });

      setEditId(null);
    } catch (error) {
      console.error(error);
      setNotice("Service save nahi hui: " + error.message);
    }
  }

  // ---------------------------------------
  // 13. EDIT SERVICE
  // ---------------------------------------

  function startEditService(service) {
    setNewService({
      name: service.name || "",
      category: service.category || "",
      price: String(service.price || "")
    });

    setEditId(service.id);
    setPage("admin");
  }

  // ---------------------------------------
  // 14. DELETE SERVICE
  // ---------------------------------------

  async function removeService(id) {
    if (!isAdmin) return;

    if (
      !window.confirm(
        "Kya aap is service ko delete karna chahte hain?"
      )
    ) return;

    try {
      await deleteDoc(doc(db, "services", id));
      setNotice("Service delete ho gayi.");
    } catch (error) {
      console.error(error);
      setNotice("Service delete nahi hui.");
    }
  }

  // ---------------------------------------
  // 15. ACTIVE / INACTIVE SERVICE
  // ---------------------------------------

  async function toggleService(service) {
    if (!isAdmin) return;

    try {
      await updateDoc(
        doc(db, "services", service.id),
        {
          active: service.active === false,
          updatedAt: serverTimestamp()
        }
      );

      setNotice("Service status update ho gaya.");
    } catch (error) {
      console.error(error);
      setNotice("Service status update nahi hua.");
    }
  }

  // ---------------------------------------
  // 16. UPDATE ORDER
  // ---------------------------------------

  async function updateOrder(id, changes) {
    if (!isAdmin) return;

    try {
      await updateDoc(
        doc(db, "orders", id),
        {
          ...changes,
          updatedAt: serverTimestamp()
        }
      );

      setNotice("Order update ho gaya.");
    } catch (error) {
      console.error(error);
      setNotice("Order update nahi hua: " + error.message);
    }
  }

  // ---------------------------------------
  // 17. PAYMENT SETTINGS
  // ---------------------------------------

  async function savePaymentSettings(event) {
    event.preventDefault();

    if (!isAdmin) return;

    if (!upiId.trim() || !paymentName.trim()) {
      setPaymentMessage("UPI ID aur Payment Name bharein.");
      return;
    }

    try {
      await setDoc(
        doc(db, "settings", "payment"),
        {
          upiId: upiId.trim(),
          paymentName: paymentName.trim(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setPaymentMessage("Payment settings save ho gayi.");
      setNotice("Payment settings updated.");
    } catch (error) {
      console.error(error);

      setPaymentMessage(
        "Settings save nahi hui: " + error.message
      );
    }
  }

  // ---------------------------------------
  // 18. DASHBOARD CALCULATIONS
  // ---------------------------------------

  const activeServices = services.filter(
    (service) => service.active !== false
  );

  const myOrders = orders.filter(
    (order) => order.uid === user?.uid
  );

  const totalRevenue = orders
    .filter(
      (order) => order.paymentStatus === "Paid"
    )
    .reduce(
      (sum, order) =>
        sum + Number(order.price || 0),
      0
    );

  const pendingPayments = orders
    .filter(
      (order) =>
        order.paymentStatus !== "Paid" &&
        order.paymentStatus !== "Refunded"
    )
    .reduce(
      (sum, order) =>
        sum + Number(order.price || 0),
      0
    );

  const filteredServices = activeServices.filter(
    (service) =>
      `${service.name} ${service.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  // ---------------------------------------
  // 19. LOADING SCREEN
  // ---------------------------------------

  if (authLoading) {
    return (
      <div className="pds-loading">
        <h2>PATEL DIGITAL STUDIO</h2>
        <p>Loading...</p>
      </div>
    );
  }

  // ---------------------------------------
  // 20. MAIN UI
  // ---------------------------------------

  return (
    <div className="pds-app">

      <style>{`
        .pds-app{
          min-height:100vh;
          background:#080808;
          color:#f5f1e8;
          font-family:Arial,sans-serif;
        }

        .pds-app *{box-sizing:border-box}

        .pds-header{
          background:#101010;
          border-bottom:1px solid #b58b37;
          padding:15px 5%;
          display:flex;
          align-items:center;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:14px;
          position:sticky;
          top:0;
          z-index:20;
        }

        .pds-brand{
          display:flex;
          align-items:center;
          gap:12px;
        }

        .pds-logo{
          width:48px;
          height:48px;
          border:2px solid #c69b43;
          border-radius:12px;
          display:grid;
          place-items:center;
          color:#e6bd65;
          font-size:23px;
          font-weight:bold;
        }

        .pds-brand h2{
          margin:0;
          color:#e5bd67;
          font-size:17px;
        }

        .pds-brand small{
          color:#aaa;
          font-size:10px;
          letter-spacing:2px;
        }

        .pds-nav{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }

        .pds-app button{
          cursor:pointer;
          border:1px solid #bd9343;
          background:#bd9343;
          color:#080808;
          border-radius:7px;
          padding:10px 14px;
          font-weight:bold;
        }

        .pds-app button.secondary{
          background:transparent;
          color:#e7c16f;
        }

        .pds-app button.danger{
          background:#8e2929;
          border-color:#8e2929;
          color:white;
        }

        .pds-container{
          max-width:1150px;
          margin:auto;
          padding:28px 18px;
        }

        .pds-hero{
          min-height:380px;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          padding:55px 18px;
          background:radial-gradient(
            ellipse at center,
            #292012 0%,
            #080808 70%
          );
        }

        .pds-hero h1{
          font-size:clamp(30px,6vw,55px);
          color:#e7c16f;
          margin:0 0 14px;
        }

        .pds-hero p{
          color:#ccc;
          line-height:1.7;
        }

        .pds-section-title{
          color:#e7c16f;
          text-align:center;
          margin:12px 0 25px;
        }

        .pds-grid{
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(220px,1fr));
          gap:16px;
        }

        .pds-card{
          background:#141414;
          border:1px solid #49391f;
          border-radius:12px;
          padding:19px;
          box-shadow:0 5px 20px #0005;
        }

        .pds-card h3{color:#e7c16f;margin-top:0}

        .pds-price{
          font-size:23px;
          color:#fff;
          margin:15px 0;
        }

        .pds-muted{
          color:#aaa;
          font-size:13px;
          line-height:1.6;
        }

        .pds-about{
          display:flex;
          gap:25px;
          align-items:center;
          flex-wrap:wrap;
        }

        .pds-founder{
          width:170px;
          height:190px;
          object-fit:cover;
          object-position:center;
          border-radius:12px;
          border:2px solid #bd9343;
          display:block;
        }

        .pds-founder-fallback{
          width:170px;
          height:190px;
          border:2px solid #bd9343;
          border-radius:12px;
          display:grid;
          place-items:center;
          background:#21190d;
          color:#e7c16f;
          font-size:45px;
          font-weight:bold;
        }

        .pds-form{display:grid;gap:12px}

        .pds-app input,
        .pds-app select,
        .pds-app textarea{
          width:100%;
          padding:12px;
          border:1px solid #62502e;
          background:#090909;
          color:white;
          border-radius:7px;
        }

        .pds-app label{
          color:#e7c16f;
          font-size:13px;
        }

        .pds-table-wrap{overflow-x:auto}

        .pds-table{
          width:100%;
          border-collapse:collapse;
          min-width:750px;
        }

        .pds-table th,
        .pds-table td{
          padding:11px;
          border-bottom:1px solid #393027;
          text-align:left;
          font-size:13px;
        }

        .pds-table th{color:#e7c16f}

        .pds-status{
          color:#e7c16f;
          font-weight:bold;
        }

        .pds-qr{
          display:block;
          width:250px;
          height:250px;
          max-width:100%;
          background:white;
          padding:8px;
          border-radius:10px;
          margin:15px auto;
        }

        .pds-payment{
          text-align:center;
          border:1px solid #80632e;
          background:#17130c;
          border-radius:12px;
          padding:18px;
          margin-top:18px;
        }

        .pds-footer{
          text-align:center;
          padding:28px 15px;
          border-top:1px solid #72572a;
          color:#aaa;
          background:#101010;
          margin-top:40px;
        }

        .pds-notice{
          position:fixed;
          bottom:85px;
          left:50%;
          transform:translateX(-50%);
          z-index:110;
          background:#e7c16f;
          color:#111;
          padding:12px 18px;
          border-radius:8px;
          max-width:90%;
          font-size:13px;
          box-shadow:0 5px 20px #0008;
          cursor:pointer;
        }

        .pds-wa{
          position:fixed;
          right:18px;
          bottom:18px;
          z-index:30;
          border-radius:50%!important;
          width:55px;
          height:55px;
          font-size:18px;
          padding:0!important;
        }

        .pds-loading{
          min-height:100vh;
          background:#080808;
          color:#e7c16f;
          display:grid;
          place-content:center;
          text-align:center;
        }

        .pds-login-box{
          max-width:480px;
          margin:25px auto;
        }

        @media(max-width:600px){
          .pds-header{justify-content:center}
          .pds-nav{justify-content:center}
          .pds-nav button{
            font-size:11px;
            padding:9px;
          }
          .pds-container{padding:22px 13px}
        }
      `}</style>

      {/* HEADER */}

      <header className="pds-header">

        <div className="pds-brand">
          <div className="pds-logo">PD</div>

          <div>
            <h2>PATEL DIGITAL STUDIO</h2>
            <small>SMART DIGITAL SOLUTIONS</small>
          </div>
        </div>

        <nav className="pds-nav">

          <button
            className="secondary"
            onClick={() => setPage("home")}
          >
            Home
          </button>

          <button
            className="secondary"
            onClick={() => setPage("services")}
          >
            Services
          </button>

          {user && !isAdmin && (
            <button
              className="secondary"
              onClick={() => setPage("account")}
            >
              My Account
            </button>
          )}

          {isAdmin ? (
            <>
              <button onClick={() => setPage("admin")}>
                Admin Panel
              </button>

              <button
                className="danger"
                onClick={adminLogout}
              >
                Logout
              </button>
            </>
          ) : user ? (
            <button
              className="danger"
              onClick={customerLogout}
            >
              Logout
            </button>
          ) : (
            <>
              <button
                className="secondary"
                onClick={() => setPage("customer-login")}
              >
                Customer Login
              </button>

              <button
                onClick={() => setShowAdminLogin(true)}
              >
                Admin Login
              </button>
            </>
          )}

        </nav>
      </header>

      {/* NOTICE */}

      {notice && (
        <div
          className="pds-notice"
          onClick={() => setNotice("")}
        >
          {notice} &nbsp; ✕
        </div>
      )}

      {/* HOME PAGE */}

      {page === "home" && (
        <>
          <section className="pds-hero">
            <div>
              <h1>Digital Services Made Easy</h1>

              <p>
                Your Trusted Online Digital Service Partner.
                <br />
                Government, Banking, Education and Digital Services.
              </p>

              <button onClick={() => setPage("services")}>
                Explore Services
              </button>

              {" "}

              <button
                className="secondary"
                onClick={() =>
                  whatsapp(
                    "Hello Patel Digital Studio, mujhe services ki jankari chahiye."
                  )
                }
              >
                Contact Us
              </button>
            </div>
          </section>

          <section className="pds-container">

            <h2 className="pds-section-title">
              OUR SERVICES
            </h2>

            <div className="pds-grid">

              {activeServices.slice(0, 6).map((service) => (
                <div className="pds-card" key={service.id}>

                  <h3>{service.name}</h3>

                  <p className="pds-muted">
                    {service.category}
                  </p>

                  {user && !isAdmin && (
  <div className="pds-price">
    {money(service.price)}
  </div>
)}

                  <button
                    onClick={() => createOrder(service)}
                  >
                    Order Now
                  </button>

                </div>
              ))}

            </div>

            <div style={{textAlign:"center",marginTop:25}}>
              <button
                className="secondary"
                onClick={() => setPage("services")}
              >
                View All Services
              </button>
            </div>

          </section>

          {/* ABOUT / FOUNDER */}

          <section className="pds-container">

            <h2 className="pds-section-title">
              ABOUT US
            </h2>

            <div className="pds-card pds-about">

              {!founderImageError ? (
                <img
                  src="/founder.png"
                  alt="Founder Mohan Patel"
                  className="pds-founder"
                  onError={() => setFounderImageError(true)}
                />
              ) : (
                <div className="pds-founder-fallback">
                  MP
                </div>
              )}

              <div style={{flex:1,minWidth:220}}>

                <h2 style={{color:"#e7c16f"}}>
                  Mohan Patel
                </h2>

                <h3>Founder - Patel Digital Studio</h3>

                <p className="pds-muted">
                  Patel Digital Studio ka uddeshya customers ko
                  reliable online digital services aasani se
                  uplabdh karana hai. Hum Government, Banking,
                  Education aur Digital Services mein sahayata
                  pradan karte hain.
                </p>

                <button
                  onClick={() =>
                    whatsapp(
                      "Hello, mujhe Patel Digital Studio se sampark karna hai."
                    )
                  }
                >
                  Contact Founder
                </button>

                {" "}

                <button
                  className="secondary"
                  onClick={() => {
                    window.location.href = `tel:${PHONE}`;
                  }}
                >
                  Call Now
                </button>

              </div>
            </div>

          </section>
        </>
      )}

      {/* SERVICES PAGE */}

      {page === "services" && (
        <main className="pds-container">

          <h2 className="pds-section-title">
            ALL SERVICES
          </h2>

          <input
            placeholder="Search services..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{marginBottom:20}}
          />

          <div className="pds-grid">

            {filteredServices.map((service) => (
              <div className="pds-card" key={service.id}>

                <h3>{service.name}</h3>

                <p className="pds-muted">
                  {service.category}
                </p>

                <div className="pds-price">
                  {money(service.price)}
                </div>

                <button
                  onClick={() => createOrder(service)}
                >
                  Order Now
                </button>

                {" "}

                <button
                  className="secondary"
                  onClick={() =>
                    whatsapp(
                      `Hello, mujhe ${service.name} ke baare mein jankari chahiye.`
                    )
                  }
                >
                  Enquire
                </button>

              </div>
            ))}

          </div>

          {filteredServices.length === 0 && (
            <p className="pds-muted">
              Koi service nahi mili.
            </p>
          )}

        </main>
      )}

      {/* CUSTOMER LOGIN PAGE */}

      {page === "customer-login" && (
        <main className="pds-container">

          <div className="pds-login-box">

            <CustomerLogin
              onLogin={handleCustomerLogin}
              onBack={() => {
                setPendingService(null);
                setPage("home");
              }}
            />

          </div>

        </main>
      )}

      {/* CUSTOMER DASHBOARD */}

      {page === "account" && (
        <main className="pds-container">

          <h2 className="pds-section-title">
            CUSTOMER DASHBOARD
          </h2>

          {!user || isAdmin ? (
            <div className="pds-card">
              <p>Please login with your customer account.</p>

              <button
                onClick={() => setPage("customer-login")}
              >
                Customer Login
              </button>
            </div>
          ) : (
            <>

              <div className="pds-card">

                <h3>
                  Welcome, {customer?.name || "Customer"}
                </h3>

                <p className="pds-muted">
                  Mobile: {customer?.mobile || "Not available"}
                </p>

                <p className="pds-muted">
                  Email: {user.email}
                </p>

              </div>

              <h3 style={{color:"#e7c16f",marginTop:25}}>
                My Orders
              </h3>

              {myOrders.length === 0 ? (
                <div className="pds-card">

                  <p>No orders found.</p>

                  <button
                    onClick={() => setPage("services")}
                  >
                    Order a Service
                  </button>

                </div>
              ) : (
                <div className="pds-grid">

                  {myOrders.map((order) => {

                    const upiLink = makeUpiLink(
                      upiId,
                      paymentName,
                      order.price,
                      order.id
                    );

                    return (
                      <div
                        className="pds-card"
                        key={order.id}
                      >

                        <h3>{order.serviceName}</h3>

                        <p className="pds-muted">
                          Order ID: {order.id}
                        </p>

                        <div className="pds-price">
                          {money(order.price)}
                        </div>

                        <p>
                          Status:
                          {" "}
                          <span className="pds-status">
                            {order.status || "Pending"}
                          </span>
                        </p>

                        <p>
                          Payment:
                          {" "}
                          <span className="pds-status">
                            {order.paymentStatus || "Unpaid"}
                          </span>
                        </p>

                        {order.paymentStatus !== "Paid" &&
                         order.paymentStatus !== "Refunded" && (

                          <div className="pds-payment">

                            <h3>Scan & Pay</h3>

                            <p className="pds-muted">
                              UPI ID: {upiId}
                            </p>

                            <img
                              className="pds-qr"
                              src={makeQrUrl(upiLink)}
                              alt="UPI Payment QR Code"
                            />

                            <p>
                              <b>
                                Amount: {money(order.price)}
                              </b>
                            </p>

                            <button
                              onClick={() => {
                                window.location.href = upiLink;
                              }}
                            >
                              Pay with UPI App
                            </button>

                            <p className="pds-muted">
                              Payment karne ke baad transaction
                              details WhatsApp par bhejein.
                            </p>

                            <button
                              className="secondary"
                              onClick={() =>
                                whatsapp(
                                  `Payment Done - Patel Digital Studio\n` +
                                  `Order ID: ${order.id}\n` +
                                  `Service: ${order.serviceName}\n` +
                                  `Amount: ${money(order.price)}\n` +
                                  `Transaction ID: `
                                )
                              }
                            >
                              Send Payment Details
                            </button>

                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              )}

            </>
          )}

        </main>
      )}

      {/* ADMIN DASHBOARD */}

      {page === "admin" && isAdmin && (
        <main className="pds-container">

          <h2 className="pds-section-title">
            ADMIN DASHBOARD
          </h2>

          <div className="pds-grid">

            <div className="pds-card">
              <p className="pds-muted">Total Orders</p>
              <h2>{orders.length}</h2>
            </div>

            <div className="pds-card">
              <p className="pds-muted">Paid Revenue</p>
              <h2 style={{color:"#e7c16f"}}>
                {money(totalRevenue)}
              </h2>
            </div>

            <div className="pds-card">
              <p className="pds-muted">Pending Payments</p>
              <h2>{money(pendingPayments)}</h2>
            </div>

            <div className="pds-card">
              <p className="pds-muted">Active Services</p>
              <h2>{activeServices.length}</h2>
            </div>

          </div>

          {/* ADD / EDIT SERVICE */}

          <section
            className="pds-card"
            style={{marginTop:22}}
          >

            <h3>
              {editId ? "Edit Service" : "Add New Service"}
            </h3>

            <form
              className="pds-form"
              onSubmit={saveService}
            >

              <label>Service Name</label>

              <input
                required
                value={newService.name}
                onChange={(e) =>
                  setNewService({
                    ...newService,
                    name:e.target.value
                  })
                }
                placeholder="PAN Card Services"
              />

              <label>Category</label>

              <input
                required
                value={newService.category}
                onChange={(e) =>
                  setNewService({
                    ...newService,
                    category:e.target.value
                  })
                }
                placeholder="Government Services"
              />

              <label>Price (₹)</label>

              <input
                required
                type="number"
                min="1"
                value={newService.price}
                onChange={(e) =>
                  setNewService({
                    ...newService,
                    price:e.target.value
                  })
                }
                placeholder="199"
              />

              <div>

                <button type="submit">
                  {editId ? "Update Service" : "Add Service"}
                </button>

                {editId && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditId(null);
                      setNewService({
                        name:"",
                        category:"",
                        price:""
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}

              </div>

            </form>

          </section>

          {/* MANAGE SERVICES */}

          <section
            className="pds-card"
            style={{marginTop:22}}
          >

            <h3>Manage Services</h3>

            <div className="pds-table-wrap">

              <table className="pds-table">

                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Visibility</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {services.map((service) => (

                    <tr key={service.id}>

                      <td>{service.name}</td>
                      <td>{service.category}</td>
                      <td>{money(service.price)}</td>

                      <td>
                        {service.active === false
                          ? "Inactive"
                          : "Active"}
                      </td>

                      <td>

                        <button
                          onClick={() => startEditService(service)}
                        >
                          Edit
                        </button>

                        {" "}

                        <button
                          className="secondary"
                          onClick={() => toggleService(service)}
                        >
                          {service.active === false
                            ? "Activate"
                            : "Deactivate"}
                        </button>

                        {" "}

                        <button
                          className="danger"
                          onClick={() => removeService(service.id)}
                        >
                          Delete
                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </section>

          {/* ALL CUSTOMER ORDERS */}

          <section
            className="pds-card"
            style={{marginTop:22}}
          >

            <h3>All Customer Orders</h3>

            <div className="pds-table-wrap">

              <table className="pds-table">

                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Order Status</th>
                    <th>Payment Status</th>
                    <th>Transaction ID</th>
                  </tr>
                </thead>

                <tbody>

                  {orders.map((order) => (

                    <tr key={order.id}>

                      <td>{order.customerName}</td>
                      <td>{order.mobile}</td>
                      <td>{order.serviceName}</td>
                      <td>{money(order.price)}</td>

                      <td>
                        <select
                          value={order.status || "Pending"}
                          onChange={(e) =>
                            updateOrder(order.id, {
                              status:e.target.value
                            })
                          }
                        >
                          <option>Pending</option>
                          <option>Processing</option>
                          <option>Completed</option>
                          <option>Rejected</option>
                        </select>
                      </td>

                      <td>
                        <select
                          value={order.paymentStatus || "Unpaid"}
                          onChange={(e) =>
                            updateOrder(order.id, {
                              paymentStatus:e.target.value
                            })
                          }
                        >
                          <option>Unpaid</option>
                          <option>Paid</option>
                          <option>Refunded</option>
                        </select>
                      </td>

                      <td>
                        <input
                          defaultValue={order.transactionId || ""}
                          placeholder="Transaction ID"
                          onBlur={(e) => {
                            if (
                              e.target.value !==
                              (order.transactionId || "")
                            ) {
                              updateOrder(order.id, {
                                transactionId:e.target.value
                              });
                            }
                          }}
                        />
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

            {orders.length === 0 && (
              <p className="pds-muted">
                Abhi koi customer order nahi aaya hai.
              </p>
            )}

          </section>

          {/* PAYMENT MANAGEMENT */}

          <section
            className="pds-card"
            style={{marginTop:22}}
          >

            <h3>Payment Management</h3>

            <form
              className="pds-form"
              onSubmit={savePaymentSettings}
            >

              <label>UPI ID</label>

              <input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                required
              />

              <label>Payment Name</label>

              <input
                value={paymentName}
                onChange={(e) =>
                  setPaymentName(e.target.value)
                }
                required
              />

              <button type="submit">
                Save Payment Settings
              </button>

              {paymentMessage && (
                <p className="pds-muted">
                  {paymentMessage}
                </p>
              )}

            </form>

            <div className="pds-payment">

              <h3>Payment QR Preview</h3>

              <p className="pds-muted">
                UPI ID: {upiId}
              </p>

              <img
                className="pds-qr"
                src={makeQrUrl(
                  makeUpiLink(
                    upiId,
                    paymentName,
                    1,
                    "PDS"
                  )
                )}
                alt="Payment QR Preview"
              />

              <p className="pds-muted">
                Customer order ka QR actual amount ke saath banega.
              </p>

            </div>

          </section>

        </main>
      )}

      {/* ADMIN ACCESS DENIED */}

      {page === "admin" && !isAdmin && (
        <main className="pds-container">

          <div className="pds-card">

            <h3>Admin access required</h3>

            <button
              onClick={() => setShowAdminLogin(true)}
            >
              Admin Login
            </button>

          </div>

        </main>
      )}

      {/* FOOTER */}

      <footer className="pds-footer">

        <h3 style={{color:"#e7c16f"}}>
          PD | PATEL DIGITAL STUDIO
        </h3>

        <p>SMART DIGITAL SOLUTIONS</p>
        <p>Contact: {PHONE}</p>

        <p>
          © {new Date().getFullYear()}
          {" "}Patel Digital Studio. All Rights Reserved.
        </p>

      </footer>

      {/* WHATSAPP */}

      <button
        className="pds-wa"
        title="WhatsApp"
        onClick={() =>
          whatsapp("Hello Patel Digital Studio")
        }
      >
        WA
      </button>

      {/* ADMIN LOGIN MODAL */}

      {showAdminLogin && (

        <div
          style={{
            position:"fixed",
            inset:0,
            zIndex:100,
            background:"#000d",
            display:"grid",
            placeItems:"center",
            padding:18
          }}
        >

          <div
            className="pds-card"
            style={{width:"100%",maxWidth:420}}
          >

            <h2 style={{color:"#e7c16f"}}>
              Admin Login
            </h2>

            <form
              className="pds-form"
              onSubmit={adminSignIn}
            >

              <label>Admin Email</label>

              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) =>
                  setAdminEmail(e.target.value)
                }
                placeholder="Admin Email"
              />

              <label>Password</label>

              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) =>
                  setAdminPassword(e.target.value)
                }
                placeholder="Admin Password"
              />

              <button type="submit">
                Login
              </button>

              <button
                type="button"
                className="secondary"
                onClick={() => setShowAdminLogin(false)}
              >
                Close
              </button>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}
