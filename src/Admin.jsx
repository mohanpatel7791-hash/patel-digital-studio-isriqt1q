
import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

const ADMIN_EMAIL = "mohanpatel7791@gmail.com";
const UPI = "9301152277@ybl";
const BUSINESS = "Patel Digital Studio";

const css = `
*{box-sizing:border-box}
.admin{min-height:100vh;background:#090909;color:#f5f0df;font-family:Arial,sans-serif;padding:16px}
.admin button,.admin input,.admin select,.admin textarea{font:inherit}
.admin button{cursor:pointer}
.gold{color:#dfb653}
.login-wrap{min-height:85vh;display:grid;place-items:center}
.login{width:100%;max-width:390px;background:#171717;border:1px solid #b78b35;border-radius:18px;padding:28px;box-shadow:0 12px 45px #000}
.logo{font-size:38px;font-weight:900;color:#e6bd62;text-align:center}
.login h2{text-align:center;color:#fff}
.admin input,.admin select,.admin textarea{width:100%;padding:12px;margin:7px 0 14px;background:#242424;color:white;border:1px solid #555;border-radius:8px}
.admin textarea{min-height:75px}
.btn{border:0;border-radius:8px;padding:11px 15px;background:#c99b43;color:#111;font-weight:bold}
.btn.dark{background:#292929;color:#f5d58a;border:1px solid #80622d}
.btn.red{background:#7d2828;color:white}
.btn:disabled{opacity:.5}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #604a24;padding-bottom:16px}
.top h2{margin:0;color:#e6bd62}
.nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
.nav button{background:#202020;color:#ddd;border:1px solid #4c3c20;padding:10px 13px;border-radius:8px}
.nav button.active{background:#c99b43;color:#111;font-weight:bold}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:18px 0}
.card{background:#181818;border:1px solid #4e3b1d;border-radius:12px;padding:17px}
.card small{color:#aaa}
.card h2{color:#e6bd62;margin:10px 0 0;font-size:25px}
.panel{background:#171717;border:1px solid #44351e;border-radius:12px;padding:16px;margin:14px 0;overflow:hidden}
.panel h3{color:#e6bd62;margin-top:0}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:760px}
th,td{padding:12px 9px;border-bottom:1px solid #38332a;text-align:left;font-size:13px;vertical-align:top}
th{color:#e6bd62}
.status{display:inline-block;padding:5px 8px;border-radius:20px;background:#39301e;color:#f4d38a;font-size:12px}
.muted{color:#aaa;font-size:13px}
.actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.actions button{padding:7px 9px;font-size:12px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.empty{text-align:center;color:#aaa;padding:30px}
.service{background:#202020;border:1px solid #55401e;padding:14px;border-radius:10px;margin:9px 0}
.error{color:#ff7777}
.success{color:#8bdb9b}
.qr{width:210px;max-width:100%;background:white;padding:10px;border-radius:10px}
@media(max-width:600px){.admin{padding:10px}.login{padding:22px}.top h2{font-size:19px}.nav button{font-size:12px;padding:9px}.panel{padding:11px}}
`;

function val(v) {
  if (v === undefined || v === null || v === "") return "—";
  if (v?.toDate) return v.toDate().toLocaleString("en-IN");
  return String(v);
}

export default function Admin({ onClose }) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [logged, setLogged] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tab, setTab] = useState("Dashboard");
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [description, setDescription] = useState("");
  const [qrAmount, setQrAmount] = useState("");

  // Verify admin session
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const allowed =
        u?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      setLogged(Boolean(allowed));
      setChecking(false);

      if (u && !allowed) {
        signOut(auth).catch(console.error);
      }
    });
    return unsub;
  }, []);

  // Live orders
  useEffect(() => {
    if (!logged) return;

    const unsub = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id
        }));

        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });

        setOrders(list);
        setError("");
      },
      (e) => {
        console.error(e);
        setError("Orders लोड नहीं हुए। Firestore Rules जाँचें।");
      }
    );

    return unsub;
  }, [logged]);

  // Live services
  useEffect(() => {
    if (!logged) return;

    const unsub = onSnapshot(
      collection(db, "services"),
      (snapshot) => {
        setServices(snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id
        })));
      },
      (e) => {
        console.error(e);
        setError("Services लोड नहीं हुईं।");
      }
    );

    return unsub;
  }, [logged]);

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      setError("Admin Email सही नहीं है।");
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        ADMIN_EMAIL,
        password
      );

      if (result.user.email?.toLowerCase() !== ADMIN_EMAIL) {
        await signOut(auth);
        setError("Admin Access नहीं मिला।");
      } else {
        setPassword("");
        setLogged(true);
      }
    } catch (e) {
      console.error(e);
      setError(e.code === "auth/invalid-credential"
        ? "Email या Password गलत है।"
        : e.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setLogged(false);
      setPassword("");
      setMessage("");
      setTab("Dashboard");
      if (onClose) onClose();
    } catch (e) {
      setError("Logout नहीं हुआ।");
    }
  };

  const updateOrder = async (id, field, value) => {
    try {
      await updateDoc(doc(db, "orders", id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
      setMessage("Order अपडेट हो गया।");
      setError("");
    } catch (e) {
      console.error(e);
      setError("Order अपडेट नहीं हुआ।");
    }
  };

  const removeOrder = async (id) => {
    if (!window.confirm("क्या यह Order Delete करना है?")) return;

    try {
      await deleteDoc(doc(db, "orders", id));
      setMessage("Order Delete हो गया।");
    } catch (e) {
      setError("Order Delete नहीं हुआ।");
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    const price = Number(servicePrice);

    if (!serviceName.trim() || servicePrice === "" ||
        !Number.isFinite(price) || price < 0) {
      setError("Service Name और सही Price भरें।");
      return;
    }

    try {
      await addDoc(collection(db, "services"), {
        name: serviceName.trim(),
        price,
        description: description.trim(),
        active: true,
        createdAt: serverTimestamp()
      });

      setServiceName("");
      setServicePrice("");
      setDescription("");
      setMessage("नई Service जोड़ दी गई।");
      setError("");
    } catch (e) {
      console.error(e);
      setError("Service नहीं जुड़ी।");
    }
  };

  const editService = async (s) => {
    const name = window.prompt("Service Name", s.name);
    if (name === null || !name.trim()) return;

    const priceText = window.prompt("New Price", String(s.price));
    if (priceText === null) return;

    const price = Number(priceText);
    if (!Number.isFinite(price) || price < 0) {
      setError("सही Price डालें।");
      return;
    }

    try {
      await updateDoc(doc(db, "services", s.id), {
        name: name.trim(),
        price,
        updatedAt: serverTimestamp()
      });
      setMessage("Service अपडेट हो गई।");
    } catch (e) {
      setError("Service अपडेट नहीं हुई।");
    }
  };

  const toggleService = async (s) => {
    try {
      await updateDoc(doc(db, "services", s.id), {
        active: s.active === false,
        updatedAt: serverTimestamp()
      });
      setMessage("Service Status बदल गया।");
    } catch (e) {
      setError("Service Status नहीं बदला।");
    }
  };

  const removeService = async (id) => {
    if (!window.confirm("क्या Service Delete करनी है?")) return;

    try {
      await deleteDoc(doc(db, "services", id));
      setMessage("Service हटा दी गई।");
    } catch (e) {
      setError("Service Delete नहीं हुई।");
    }
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const text = [
        o.name, o.mobile, o.phone, o.orderId,
        o.service, o.serviceName, o.uid
      ].join(" ").toLowerCase();

      const payment = String(o.paymentStatus || "Unpaid").toLowerCase();

      return text.includes(search.toLowerCase()) &&
        (filter === "All" ||
          (filter === "Paid" && payment === "paid") ||
          (filter === "Unpaid" && payment !== "paid"));
    });
  }, [orders, search, filter]);

  const revenue = orders.reduce((sum, o) =>
    sum + (String(o.paymentStatus).toLowerCase() === "paid"
      ? Number(o.price || o.amount || 0) : 0), 0);

  const pending = orders.reduce((sum, o) =>
    sum + (String(o.paymentStatus).toLowerCase() !== "paid"
      ? Number(o.price || o.amount || 0) : 0), 0);

  const qrLink =
    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" +
    encodeURIComponent(
      "upi://pay?pa=" + UPI +
      "&pn=Patel%20Digital%20Studio&cu=INR" +
      (Number(qrAmount) > 0 ? "&am=" + Number(qrAmount) : "")
    );

  if (checking) {
    return <div className="admin"><style>{css}</style><div className="empty">Checking Admin...</div></div>;
  }

  return (
    <div className="admin">
      <style>{css}</style>

      {!logged ? (
        <div className="login-wrap">
          <form className="login" onSubmit={login}>
            <div className="logo">PD</div>
            <h2>ADMIN LOGIN</h2>
            <p className="muted" style={{ textAlign: "center" }}>{BUSINESS}</p>

            <label>Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Firebase Admin Password"
              required
            />

            {error && <p className="error">{error}</p>}

            <button className="btn" style={{ width: "100%" }} disabled={loading}>
              {loading ? "PLEASE WAIT..." : "SECURE LOGIN"}
            </button>

            {onClose && (
              <button type="button" className="btn dark"
                style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
                Back to Website
              </button>
            )}
          </form>
        </div>
      ) : (
        <>
          <header className="top">
            <div>
              <div className="logo" style={{ textAlign: "left", fontSize: 28 }}>PD</div>
              <h2>Patel Digital Studio</h2>
              <small className="muted">Premium Admin Control Panel</small>
            </div>
            <div className="actions">
              <button className="btn red" onClick={logout}>Logout</button>
            </div>
          </header>

          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}

          <nav className="nav">
            {["Dashboard", "Orders", "Payments", "Services"].map((t) => (
              <button key={t} className={tab === t ? "active" : ""}
                onClick={() => { setTab(t); setError(""); setMessage(""); }}>
                {t}
              </button>
            ))}
          </nav>

          {tab === "Dashboard" && (
            <>
              <h2 className="gold">Dashboard Overview</h2>
              <div className="cards">
                <div className="card"><small>Total Orders</small><h2>{orders.length}</h2></div>
                <div className="card"><small>Paid Collection</small><h2>₹{revenue}</h2></div>
                <div className="card"><small>Pending Amount</small><h2>₹{pending}</h2></div>
                <div className="card"><small>Total Services</small><h2>{services.length}</h2></div>
              </div>

              <div className="panel">
                <h3>Recent Orders</h3>
                {orders.length === 0 ? (
                  <div className="empty">अभी कोई Order नहीं आया है।</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Order ID</th><th>Customer</th><th>Mobile</th><th>Service</th><th>Amount</th><th>Payment</th></tr></thead>
                      <tbody>
                        {orders.slice(0, 5).map((o) => (
                          <tr key={o.id}>
                            <td>{o.id}</td>
                            <td>{val(o.name)}</td>
                            <td>{val(o.mobile)}</td>
                            <td>{val(o.service)}</td>
                            <td>₹{o.price || 0}</td>
                            <td><span className="status">{val(o.paymentStatus)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "Orders" && (
            <div className="panel">
              <h3>Complete Order Management</h3>
              <div className="grid2">
                <input placeholder="Search name, mobile, ID or UID"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option>All</option><option>Paid</option><option>Unpaid</option>
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Order / Date</th><th>Customer</th><th>Service</th><th>Amount</th><th>Payment</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}<br/><small>{val(o.createdAt)}</small></td>
                        <td>
                          <b>{val(o.name)}</b><br/>{val(o.mobile)}
                          <br/><small>UID: {val(o.uid)}</small>
                          <div className="actions">
                            {o.mobile && <a className="gold" href={"tel:" + o.mobile}>Call</a>}
                            {o.mobile && <a className="gold" target="_blank" rel="noreferrer"
                              href={"https://wa.me/91" + String(o.mobile).replace(/\D/g, "").slice(-10)}>WhatsApp</a>}
                          </div>
                        </td>
                        <td>{val(o.service)}<br/><small>{val(o.details)}</small></td>
                        <td>₹{o.price || 0}</td>
                        <td>
                          <select value={o.paymentStatus || "Unpaid"}
                            onChange={(e) => updateOrder(o.id, "paymentStatus", e.target.value)}>
                            <option>Unpaid</option><option>Paid</option><option>Failed</option><option>Refunded</option>
                          </select>
                          <small>UTR: {val(o.utr)}</small>
                          <br/>
                          <small>Submitted: {o.paymentSubmitted ? "Yes" : "No"}</small>
                        </td>
                        <td>
                          <select value={o.status || "Pending"}
                            onChange={(e) => updateOrder(o.id, "status", e.target.value)}>
                            <option>Pending</option><option>Processing</option><option>Completed</option><option>Cancelled</option>
                          </select>
                        </td>
                        <td><button className="btn red" onClick={() => removeOrder(o.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && <div className="empty">कोई Order नहीं मिला।</div>}
            </div>
          )}

          {tab === "Payments" && (
            <>
              <div className="cards">
                <div className="card"><small>Paid Collection</small><h2>₹{revenue}</h2></div>
                <div className="card"><small>Pending Collection</small><h2>₹{pending}</h2></div>
                <div className="card"><small>Paid Orders</small><h2>{orders.filter(o => String(o.paymentStatus).toLowerCase() === "paid").length}</h2></div>
              </div>
              <div className="panel">
                <h3>Business Payment Account</h3>
                <p>Business: <b>{BUSINESS}</b></p>
                <p>UPI ID: <b className="gold">{UPI}</b></p>
                <label>QR Amount (₹), optional</label>
                <input type="number" min="1" value={qrAmount}
                  onChange={(e) => setQrAmount(e.target.value)} placeholder="Enter amount"/>
                <div style={{ textAlign: "center", padding: 15 }}>
                  <img className="qr" src={qrLink} alt="Business UPI QR"/>
                  <p className="gold">{BUSINESS}</p>
                  <p>{UPI}</p>
                  <a className="btn" href={"upi://pay?pa=" + UPI + "&pn=Patel%20Digital%20Studio&cu=INR" + (Number(qrAmount) > 0 ? "&am=" + Number(qrAmount) : "")}>
                    Open UPI App
                  </a>
                </div>
                <p className="muted">Payment को Paid तभी करें जब बैंक खाते में वास्तविक भुगतान की पुष्टि हो जाए।</p>
              </div>
            </>
          )}

          {tab === "Services" && (
            <>
              <div className="panel">
                <h3>Add New Service</h3>
                <form onSubmit={addService}>
                  <label>Service Name</label>
                  <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="PAN Card" required/>
                  <label>Price ₹</label>
                  <input type="number" min="0" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} placeholder="199" required/>
                  <label>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Service details"/>
                  <button className="btn">+ Add Service</button>
                </form>
              </div>
              <div className="panel">
                <h3>All Services ({services.length})</h3>
                {services.map((s) => (
                  <div className="service" key={s.id}>
                    <div className="actions" style={{ justifyContent: "space-between" }}>
                      <div>
                        <b className="gold">{s.name}</b>
                        <p>₹{s.price}</p>
                        <small className="muted">{s.description}</small>
                        <p><span className="status">{s.active === false ? "Inactive" : "Active"}</span></p>
                      </div>
                      <div className="actions">
                        <button className="btn dark" onClick={() => editService(s)}>Edit</button>
                        <button className="btn dark" onClick={() => toggleService(s)}>
                          {s.active === false ? "Activate" : "Deactivate"}
                        </button>
                        <button className="btn red" onClick={() => removeService(s.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
                {services.length === 0 && <div className="empty">अभी कोई Service नहीं है।</div>}
              </div>
            </>
          )}

          <footer className="muted" style={{ textAlign: "center", padding: 20 }}>
            PD · PATEL DIGITAL STUDIO · SMART DIGITAL SOLUTIONS
          </footer>
        </>
      )}
    </div>
  );
}
