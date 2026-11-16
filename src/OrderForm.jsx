
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

const UPI_ID = "9301152277@ybl";
const WHATSAPP = "919301152277";

export default function OrderForm({ onClose }) {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadServices = async () => {
      try {
        const q = query(
          collection(db, "services"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        setServices(list.filter(item => item.active !== false));
      } catch (err) {
        console.error("Services Error:", err);
        setError("Services load nahi hui. Firebase check karein.");
      }
    };

    loadServices();
  }, []);

  const selected = services.find(
    item => item.id === selectedService
  );

  const submitOrder = async (e) => {
    e.preventDefault();
    setError("");

    if (!selected) {
      setError("Please select a service.");
      return;
    }

    if (!name.trim()) {
      setError("Name enter karein.");
      return;
    }

    if (!/^[6-9][0-9]{9}$/.test(mobile)) {
      setError("Valid 10 digit mobile number enter karein.");
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        customerName: name.trim(),
        name: name.trim(),
        mobile: mobile.trim(),
        service: selected.name,
        serviceId: selected.id,
        price: Number(selected.price) || 0,
        details: details.trim(),
        status: "Pending",
        paymentStatus: "Not Verified",
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(
        collection(db, "orders"),
        orderData
      );

      const message =
        `New Order - Patel Digital Studio\n` +
        `Order ID: ${docRef.id}\n` +
        `Name: ${name}\n` +
        `Mobile: ${mobile}\n` +
        `Service: ${selected.name}\n` +
        `Price: ₹${selected.price}\n` +
        `Details: ${details}`;

      alert("Order successfully submitted! Order ID: " + docRef.id);

      window.open(
        `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`,
        "_blank"
      );

      setName("");
      setMobile("");
      setDetails("");
      setSelectedService("");

      if (onClose) onClose();

    } catch (err) {
      console.error("Order Submit Error:", err);
      setError(
        "Order submit nahi hua. Firebase Firestore Rules aur connection check karein."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-form">
      <h2>Place Your Order</h2>

      {error && (
        <p style={{ color: "#ff5555" }}>{error}</p>
      )}

      {services.length === 0 && (
        <p>Abhi koi service available nahi hai.</p>
      )}

      <form onSubmit={submitOrder}>
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <input
          type="tel"
          placeholder="Mobile Number"
          value={mobile}
          onChange={e => setMobile(e.target.value)}
          maxLength={10}
          required
        />

        <select
          value={selectedService}
          onChange={e => setSelectedService(e.target.value)}
          required
        >
          <option value="">Select Service</option>

          {services.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} - ₹{item.price}
            </option>
          ))}
        </select>

        {selected && (
          <div className="payment-section">
            <h3>Service Price: ₹{selected.price}</h3>
            <h3>Scan & Pay</h3>
            <p>Payment Name: Patel Digital Studio</p>
            <p>UPI ID: {UPI_ID}</p>

            <img
              src="/payment-qr.jpg"
              alt="Patel Digital Studio Payment QR"
              style={{
                width: "200px",
                height: "200px",
                objectFit: "contain"
              }}
            />

            <p>Payment karne ke baad Submit Order karein.</p>
            <p>Payment verification Admin karega.</p>
          </div>
        )}

        <textarea
          placeholder="Order Details"
          value={details}
          onChange={e => setDetails(e.target.value)}
          rows={4}
        />

        <button
          type="submit"
          disabled={loading || services.length === 0}
        >
          {loading ? "Submitting..." : "Submit Order"}
        </button>
      </form>
    </div>
  );
}
