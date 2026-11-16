
import React, { useEffect, useState } from "react";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

import {
  ref,
  set
} from "firebase/database";

import { db, rtdb } from "./firebase";

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
  const [servicesLoading, setServicesLoading] = useState(true);

  // LIVE SERVICES FROM FIRESTORE
  useEffect(() => {
    const q = query(
      collection(db, "services"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setServices(
          list.filter(item => item.active !== false)
        );

        setServicesLoading(false);
      },
      (err) => {
        console.error("Services Error:", err);
        setError("Services load nahi hui. Firebase Rules check karein.");
        setServicesLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const selected = services.find(
    item => item.id === selectedService
  );

  // SUBMIT ORDER TO BOTH DATABASES
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
      const orderId = "PDS-" + Date.now();
      const price = Number(selected.price) || 0;

      const orderData = {
        orderId,
        customerName: name.trim(),
        name: name.trim(),
        mobile: mobile.trim(),
        service: selected.name,
        serviceId: selected.id,
        price,
        details: details.trim(),
        status: "Pending",
        paymentStatus: "Not Verified",
        createdAt: serverTimestamp()
      };

      // 1. SAVE IN FIRESTORE
      const docRef = await addDoc(
        collection(db, "orders"),
        orderData
      );

      // 2. SAVE SAME ORDER IN REALTIME DATABASE
      let realtimeSaved = false;

      try {
        await set(
          ref(rtdb, "orders/" + docRef.id),
          {
            ...orderData,
            orderId: docRef.id,
            firestoreId: docRef.id,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        );

        realtimeSaved = true;

      } catch (realtimeError) {
        console.error(
          "Realtime Database Error:",
          realtimeError
        );
      }

      // 3. WHATSAPP MESSAGE
      const message =
        `New Order - Patel Digital Studio\n` +
        `Order ID: ${docRef.id}\n` +
        `Name: ${name.trim()}\n` +
        `Mobile: ${mobile.trim()}\n` +
        `Service: ${selected.name}\n` +
        `Price: Rs. ${price}\n` +
        `Details: ${details.trim()}\n` +
        `Status: Pending`;

      // 4. SUCCESS MESSAGE
      if (realtimeSaved) {
        alert(
          "Order successfully submitted!\n" +
          "Firestore: Saved\n" +
          "Realtime Database: Saved\n" +
          "Order ID: " + docRef.id
        );
      } else {
        alert(
          "Order Firestore me save ho gaya!\n" +
          "Realtime Database me save nahi hua.\n" +
          "Admin ko live update ke liye Rules check karne honge.\n" +
          "Order ID: " + docRef.id
        );
      }

      // 5. OPEN WHATSAPP
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
        "Order submit nahi hua. Firestore Rules aur Firebase connection check karein."
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-form">

      <h2>Place Your Order</h2>

      {error && (
        <p style={{ color: "#ff5555" }}>
          {error}
        </p>
      )}

      {servicesLoading && (
        <p>Loading services...</p>
      )}

      {!servicesLoading && services.length === 0 && (
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

            <h3>
              Service Price: ₹{Number(selected.price) || 0}
            </h3>

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

            <p>
              Payment karne ke baad Submit Order karein.
            </p>

            <p>
              Payment verification Admin karega.
            </p>

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
          disabled={loading || servicesLoading || services.length === 0}
        >
          {loading ? "Submitting..." : "Submit Order"}
        </button>

      </form>
    </div>
  );
}
